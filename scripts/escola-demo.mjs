#!/usr/bin/env node
// Cria a escola fictícia "Ateliê Barro Bom" no banco do AVIZ, para gravar o
// vídeo de demonstração. Roda no computador do Pedro (precisa da chave da
// conta de serviço do Firebase, que nunca vai para o repositório).
//
//   node scripts/escola-demo.mjs --chave caminho/da/chave.json --dono seu@email.com
//
// Opções:
//   --simular     monta os dados e mostra o resumo, sem gravar nada
//   --substituir  se a escola de demonstração já existe, recria (só ela)
//   --site URL    endereço do app (padrão: o publicado)
//
// Só mexe em /tenantsPublic/atelie-barro-bom e /tenants/atelie-barro-bom.
// Nenhuma outra escola é lida ou alterada.

import fs from 'node:fs';
import { getAccessToken } from '../worker/firebaseAuth.js';
import { chaveDoEmail, normalizarEmail, emailValido } from '../src/domain/conta.js';
import { montarEscolaDemo, SLUG_DEMO, PROTAGONISTA } from './escolaDemo.js';

const DB = 'https://aviz-cb3c8-default-rtdb.firebaseio.com'; // o mesmo de src/lib/firebase.js
const SITE_PADRAO = 'https://aviz.pedrobotafogodrive2.workers.dev';

function args(argv) {
  const out = { simular: false, substituir: false, site: SITE_PADRAO };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--simular') out.simular = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a === '--chave') out.chave = argv[++i];
    else if (a === '--dono') out.dono = argv[++i];
    else if (a === '--site') out.site = argv[++i];
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return out;
}

function sair(msg) { console.error(`\n✋ ${msg}\n`); process.exit(1); }

const op = args(process.argv.slice(2));
const demo = montarEscolaDemo(new Date());
const turmas = demo.state.turmas.filter((t) => t.id !== 'turma-extra');
const link = `${op.site.replace(/\/$/, '')}/?e=${SLUG_DEMO}&c=${demo.codigoMarina}`;

console.log(`Escola: ${demo.publico.nome} (${SLUG_DEMO})`);
for (const t of turmas) console.log(`  · ${t.encontros[0].diaSemana} ${t.encontros[0].horario} ${t.observacao}: ${t.alunos.length}/7`);
console.log(`  · ${demo.state.faltas.length} faltas, ${demo.state.reposicoes.length} reposição(ões), ${demo.state.ausencias.length} férias`);

if (op.simular) {
  console.log(`\n(simulação: nada foi gravado)\nLink da ${PROTAGONISTA} seria: ${link}\n`);
  process.exit(0);
}

if (!op.chave || !fs.existsSync(op.chave)) sair('Informe a chave da conta de serviço: --chave caminho/da/chave.json');
if (!emailValido(op.dono)) sair('Informe o seu e-mail de dono: --dono seu@email.com');

const token = await getAccessToken(fs.readFileSync(op.chave, 'utf8'));
const q = `access_token=${encodeURIComponent(token)}`;
const ler = async (caminho) => {
  const r = await fetch(`${DB}/${caminho}.json?${q}`);
  if (!r.ok) throw new Error(`leitura ${caminho}: ${r.status}`);
  return r.json();
};

const existe = await ler(`tenantsPublic/${SLUG_DEMO}`);
if (existe && !op.substituir) sair(`A escola ${SLUG_DEMO} já existe. Para recriar (só ela), rode de novo com --substituir.`);

const email = normalizarEmail(op.dono);
const conta = await ler(`contas/${await chaveDoEmail(email)}`);
if (!conta || !conta.uid) sair(`Não achei conta para ${email}. Entre uma vez no AVIZ com esse e-mail e PIN e rode de novo.`);

const r = await fetch(`${DB}/.json?${q}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    [`tenantsPublic/${SLUG_DEMO}`]: demo.publico,
    [`tenants/${SLUG_DEMO}/config`]: demo.config,
    [`tenants/${SLUG_DEMO}/members`]: { [conta.uid]: { role: 'owner', nome: 'Pedro', email } },
    [`tenants/${SLUG_DEMO}/state`]: demo.state,
  }),
});
if (!r.ok) sair(`O banco recusou a gravação (${r.status}). Nada foi alterado.`);

console.log(`\n✅ Pronto.\n`);
console.log(`Painel do dono: entre no AVIZ com ${email} e escolha "${demo.publico.nome}".`);
console.log(`Link da aluna ${PROTAGONISTA}: ${link}\n`);
