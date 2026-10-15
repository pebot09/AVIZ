// App instalável: o manifesto sai com o nome da escola e abre o app no
// endereço certo. O ponto crítico é o aluno: instalar não pode perder o link
// pessoal dele.

import fs from 'node:fs';
import { montarManifesto, criarHandlerManifesto } from '../worker/manifest.js';
import { linkManifesto } from '../src/lib/instalavel.js';

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// ---- montarManifesto ----
const aluno = montarManifesto({ e: 'atelie-sol', c: '123456', nome: 'Ateliê Sol' });
checar('aluno abre no link pessoal', aluno.start_url === '/?e=atelie-sol&c=123456');
checar('nome embaixo do ícone é o da escola', aluno.name === 'Ateliê Sol' && aluno.short_name === 'Ateliê Sol');
checar('abre em tela cheia', aluno.display === 'standalone');
checar('cada endereço é um app (id = start_url)', aluno.id === aluno.start_url);
const equipe = montarManifesto({ e: 'atelie-sol', nome: 'Ateliê Sol' });
checar('equipe abre no endereço da escola', equipe.start_url === '/?e=atelie-sol');
checar('sem escola: app genérico "AVIZ"', montarManifesto({}).start_url === '/' && montarManifesto({}).name === 'AVIZ');
checar('escola sem nome: "AVIZ"', montarManifesto({ e: 'x', nome: '  ' }).name === 'AVIZ');
checar('slug inválido é ignorado', montarManifesto({ e: '../x?y', c: '123456' }).start_url === '/');
checar('código inválido é ignorado', montarManifesto({ e: 'x', c: 'abc' }).start_url === '/?e=x');
checar('tem ícones 192 e 512 e um maskable', ['192x192', '512x512'].every((t) => aluno.icons.some((i) => i.sizes === t)) && aluno.icons.some((i) => i.purpose === 'maskable'));
for (const i of aluno.icons) checar(`ícone existe: ${i.src}`, fs.existsSync(`public${i.src}`));

// ---- os arquivos que o index.html aponta existem ----
const html = fs.readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/href="(\/icons\/[^"]+)"/g)) checar(`index.html → ${m[1]}`, fs.existsSync(`public${m[1]}`));
checar('index.html tem manifesto e modo app do iPhone', /rel="manifest"/.test(html) && /apple-mobile-web-app-capable/.test(html));

// ---- handler ----
const pedir = async (q, lerNome) => {
  const r = await criarHandlerManifesto({ lerNome })(new URL(`https://x.dev/manifest.webmanifest${q}`));
  return { r, m: await r.json() };
};
{
  let lido = null;
  const { r, m } = await pedir('?e=atelie-sol&c=123456', async (slug) => { lido = slug; return 'Ateliê Sol'; });
  checar('handler lê o nome da escola certa', lido === 'atelie-sol' && m.name === 'Ateliê Sol');
  checar('handler responde como manifesto', /manifest\+json/.test(r.headers.get('Content-Type')));
  checar('handler mantém o link do aluno', m.start_url === '/?e=atelie-sol&c=123456');
}
{
  const { m } = await pedir('?e=atelie-sol', async () => { throw new Error('rede'); });
  checar('banco fora do ar: ainda instala, com nome "AVIZ"', m.name === 'AVIZ' && m.start_url === '/?e=atelie-sol');
}
{
  let chamou = false;
  await pedir('?e=../../segredo', async () => { chamou = true; return 'x'; });
  checar('slug inválido nem consulta o banco', !chamou);
}

// ---- linkManifesto (navegador) ----
const loc = (u) => new URL(u);
checar('página do aluno pede o manifesto com o código', linkManifesto(loc('https://x.dev/?e=atelie-sol&c=123456')) === '/manifest.webmanifest?e=atelie-sol&c=123456');
checar('página da escola pede o manifesto da escola', linkManifesto(loc('https://x.dev/?e=atelie-sol')) === '/manifest.webmanifest?e=atelie-sol');
checar('criar escola: manifesto genérico', linkManifesto(loc('https://x.dev/?novo=1')) === '/manifest.webmanifest');

console.log(falhas ? `\n❌ ${falhas} falha(s) no app instalável` : '\n✅ app instalável ok');
if (falhas) process.exit(1);
