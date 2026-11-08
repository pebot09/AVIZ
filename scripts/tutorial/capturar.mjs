// Tira as capturas de tela do tutorial.
//
// Sobe o app de mentira (vite.config.mjs), abre cada cena num celular de
// 390 px no Chromium do Playwright e grava em saida/capturas/<id>.png, mais
// saida/capturas.json com o tamanho de cada imagem e a posição dos
// marcadores numerados (em % da imagem), que o montar-pdf.mjs desenha.
//
// O app é aberto no endereço de produção (as requisições são desviadas para
// o servidor local), para os links e endereços nas telas saírem certos.
//
// Uso: node scripts/tutorial/capturar.mjs [só-estes-ids...]

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'vite';
import { CENAS } from './cenas.mjs';

const require = createRequire(import.meta.url);
function carregarPlaywright() {
  try { return require('playwright'); } catch { /* tenta o global */ }
  const global = execSync('npm root -g').toString().trim();
  return require(path.join(global, 'playwright'));
}
const { chromium } = carregarPlaywright();

const aqui = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(aqui, 'saida', 'capturas');
export const PRODUCAO = 'https://aviz.pedrobotafogodrive2.workers.dev';
const LOCAL = 'http://localhost:5199';

fs.mkdirSync(SAIDA, { recursive: true });
const arquivoInfo = path.join(aqui, 'saida', 'capturas.json');
const info = fs.existsSync(arquivoInfo) ? JSON.parse(fs.readFileSync(arquivoInfo, 'utf8')) : {};

const servidor = await createServer({ configFile: path.join(aqui, 'vite.config.mjs') });
await servidor.listen();

// --lang: datas e meses nos campos do navegador em português.
const navegador = await chromium.launch({ args: ['--lang=pt-BR'], env: { ...process.env, LANG: 'pt_BR.UTF-8', LANGUAGE: 'pt_BR:pt', LC_ALL: 'pt_BR.UTF-8' } });
const so = process.argv.slice(2);
const cenas = so.length ? CENAS.filter((c) => so.includes(c.id)) : CENAS;
let falhas = 0;

for (const cena of cenas) {
  const largura = 390;
  const alto = cena.alto || 844;
  const ctx = await navegador.newContext({
    viewport: { width: largura, height: alto }, deviceScaleFactor: 2,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', hasTouch: false,
  });
  await ctx.route(`${PRODUCAO}/**`, async (route) => {
    const u = new URL(route.request().url());
    const resp = await route.fetch({ url: LOCAL + u.pathname + u.search });
    await route.fulfill({ response: resp });
  });
  if (cena.guiaVisto !== false) {
    await ctx.addInitScript(() => {
      try {
        for (const e of ['atelie-barro-bom']) {
          localStorage.setItem(`aviz_endereco_visto_${e}`, '1');
          localStorage.setItem(`aviz_passos_${e}`, JSON.stringify({ regras: true, professores: true }));
        }
      } catch { /* ignore */ }
    });
  }
  if (cena.permissoes) await ctx.grantPermissions(cena.permissoes, { origin: PRODUCAO });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  try {
    const sep = cena.url.includes('?') ? '&' : '?';
    await page.goto(`${PRODUCAO}${cena.url}${sep}quem=${cena.quem || 'dona'}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    if (cena.passos) await cena.passos(page);
    await page.waitForTimeout(400);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.mouse.move(0, 0);

    // Área da captura: a tela inteira ou um pedaço (com folga).
    let clip = { x: 0, y: 0, width: largura, height: alto };
    if (cena.alvo) {
      const caixa = await cena.alvo(page).first().boundingBox();
      if (!caixa) throw new Error('alvo não encontrado');
      const folga = cena.folga ?? 10;
      const x = Math.max(0, caixa.x - folga);
      const y = Math.max(0, caixa.y - folga);
      clip = { x, y, width: Math.min(largura, caixa.x + caixa.width + folga) - x, height: Math.min(alto, caixa.y + caixa.height + folga) - y };
    }
    if (cena.corte) clip.height = Math.min(clip.height, cena.corte);

    const marcas = [];
    for (const [n, achar, ancora = 'c'] of cena.marcas || []) {
      const b = await achar(page).first().boundingBox();
      if (!b) { console.warn(`  ! ${cena.id}: marca ${n} não encontrada`); continue; }
      let px = b.x + b.width / 2;
      let py = b.y + b.height / 2;
      if (ancora === 'l') px = b.x;
      if (ancora === 'r') px = b.x + b.width;
      if (ancora === 't') py = b.y;
      if (ancora === 'b') py = b.y + b.height;
      marcas.push({ n, a: ancora, x: +(((px - clip.x) / clip.width) * 100).toFixed(2), y: +(((py - clip.y) / clip.height) * 100).toFixed(2) });
    }
    await page.screenshot({ path: path.join(SAIDA, `${cena.id}.png`), clip });
    info[cena.id] = { w: Math.round(clip.width), h: Math.round(clip.height), tela: !cena.alvo && !cena.corte, marcas };
    console.log(`ok ${cena.id}${erros.length ? '  (erros: ' + erros.join(' | ') + ')' : ''}`);
  } catch (e) {
    falhas++;
    console.error(`FALHOU ${cena.id}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(SAIDA, `_erro_${cena.id}.png`) }).catch(() => {});
  }
  await ctx.close();
}

fs.writeFileSync(arquivoInfo, JSON.stringify(info, null, 1));
await navegador.close();
await servidor.close();
if (falhas) { console.error(`${falhas} cena(s) falharam`); process.exit(1); }
