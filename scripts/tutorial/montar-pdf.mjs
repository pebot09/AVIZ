// Monta o PDF do tutorial a partir de tutorial.html e das capturas.
//
// 1ª passada: imprime e descobre em que página caiu cada capítulo/seção
//    (âncoras invisíveis [[C3]], [[S3.2]] lidas com o pdftotext).
// 2ª passada: imprime de novo com os números no sumário e sem as âncoras.
//
// O rodapé com o número da página vem do próprio CSS (@page), sem rodapé na
// capa.
//
// Uso: node scripts/tutorial/montar-pdf.mjs [saida.pdf]
// Precisa: capturas prontas (capturar.mjs), Playwright e o pdftotext (poppler).

import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
function carregarPlaywright() {
  try { return require('playwright'); } catch { /* tenta o global */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = carregarPlaywright();

const aqui = path.dirname(fileURLToPath(import.meta.url));
const destino = path.resolve(process.argv[2] || path.join(aqui, 'saida', 'AVIZ-guia-completo.pdf'));
const capturas = JSON.parse(fs.readFileSync(path.join(aqui, 'saida', 'capturas.json'), 'utf8'));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hoje = new Date();
const edicao = `${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;


async function imprimir(navegador, extras, arquivo) {
  const page = await navegador.newPage();
  await page.addInitScript((d) => Object.assign(window, d), { CAPTURAS: capturas, EDICAO: edicao, ...extras });
  await page.goto(pathToFileURL(path.join(aqui, 'tutorial.html')).href, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const carregar = (i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }));
    await Promise.all([...document.images].map(carregar));
  });
  await page.pdf({ path: arquivo, preferCSSPageSize: true, printBackground: true });
  await page.close();
}

function paginasDasAncoras(arquivo) {
  const texto = execFileSync('pdftotext', ['-layout', arquivo, '-']).toString();
  const paginas = texto.split('\f');
  const achadas = {};
  paginas.forEach((t, i) => {
    for (const m of t.matchAll(/\[\[?([CS][\d.]+)\]\]?/g)) if (!achadas[m[1]]) achadas[m[1]] = i + 1;
  });
  return { achadas, total: paginas.filter((t) => t.trim()).length };
}

const navegador = await chromium.launch();
const rascunho = destino.replace(/\.pdf$/, '.rascunho.pdf');
await imprimir(navegador, {}, rascunho);
const { achadas, total } = paginasDasAncoras(rascunho);
await imprimir(navegador, { PAGINAS: achadas, SEM_ANCORAS: true }, destino);
await navegador.close();
if (!process.env.MANTER_RASCUNHO) fs.rmSync(rascunho);
console.log(`PDF: ${destino} (${total} páginas, ${Object.keys(achadas).length} títulos no sumário)`);
