// Demonstração pública (?e=escola-x&demo=1).
//
// O que não pode quebrar:
//   1. o Worker só serve escolas da lista de demonstração, e mascara e-mails;
//   2. o link do aluno de uma escola de demonstração não grava nada;
//   3. no app, toda ação de clique é barrada (balão) e o estado não muda; as
//      automáticas (congelar resumo, limpeza) rodam só na memória;
//   4. salvar config, exportar dados e mexer na equipe também são barrados;
//   5. a tela da escola e a do aluno renderizam em modo demonstração.

import React from 'react';
import { renderToString } from 'react-dom/server';
import { criarHandlerDemo, ehEscolaDemo, mascararEmail } from '../worker/demo.js';
import { criarHandlerAluno } from '../worker/index.js';
import { reducer, normalizeState } from '../src/domain/reducer.js';
import { TURMA_EXTRA_ID } from '../src/domain/helpers.js';
import { ligarDemo, aoBloquear, ehDemo } from '../src/lib/demo.js';
import { useTenantStore, saveConfig, saveTenantPublic } from '../src/lib/store.js';
import { exportarDadosEscola } from '../src/lib/dados.js';
import EscolaApp from '../src/components/EscolaApp.jsx';
import GerarLinkModal from '../src/components/GerarLinkModal.jsx';
import { makeVocab } from '../src/domain/vocab.js';
import { fake } from 'firebase/database';

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

const config = { regras: { capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30 }, calendario: {}, vocab: {} };
let s = normalizeState({});
const d = (a) => { s = reducer(s, a, config, 'Pedro'); };
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }], capacidade: 7 });
const t1 = s.turmas.find((t) => t.id !== TURMA_EXTRA_ID);
d({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Ana' });
d({ type: 'GERAR_ACESSO', alunoNome: 'Ana', turmaId: t1.id });
const CODIGO = s.acessos[0].codigo;

const membros = { u1: { role: 'owner', nome: 'Pedro', email: 'pedro@exemplo.com' }, u2: { role: 'professor', nome: 'Lia', email: 'lia@exemplo.com' } };
let gravou = 0;
const deps = {
  async lerTudo() { return { bruto: s, etag: 'e1', config, pub: { nome: 'Escola X' } }; },
  async lerMembros() { return membros; },
  async gravar() { gravou++; return { conflito: false }; },
};
const corpo = async (r) => JSON.parse(await r.text());
const url = (q) => new URL(`https://aviz.example.com/api/demo${q}`);

async function main() {
  // ---- 1. Worker ----
  checar('escola-x é de demonstração', ehEscolaDemo('escola-x'));
  checar('escola de cliente não é', !ehEscolaDemo('atelie-da-maria'));
  const h = criarHandlerDemo(deps);
  const ok = await h({ method: 'GET' }, url('?e=escola-x'));
  const dados = await corpo(ok);
  checar('demo da escola-x = 200', ok.status === 200, String(ok.status));
  checar('devolve turmas e alunos', dados.state.turmas.some((t) => (t.alunos || []).includes('Ana')));
  checar('nome da escola vem junto', dados.pub.nome === 'Escola X');
  checar('e-mail da equipe mascarado', dados.membros.u2.email === 'l•••@exemplo.com' && !JSON.stringify(dados).includes('lia@exemplo.com'));
  checar('mascarar sem e-mail = vazio', mascararEmail(undefined) === '');
  checar('outra escola = 404', (await h({ method: 'GET' }, url('?e=atelie-da-maria'))).status === 404);
  checar('sem escola = 404', (await h({ method: 'GET' }, url(''))).status === 404);
  checar('POST no demo = 405', (await h({ method: 'POST' }, url('?e=escola-x'))).status === 405);

  // ---- 2. Link do aluno numa escola de demonstração ----
  const ha = criarHandlerAluno(deps);
  const g = await ha({ method: 'GET' }, new URL(`https://x/api/aluno?e=escola-x&c=${CODIGO}`));
  checar('aluno da escola-x vê a fatia', g.status === 200, String(g.status));
  const acao = { type: 'ADD_AUSENCIA', tipo: 'ferias', mesAno: '2026-12' };
  const p = await ha({ method: 'POST', text: async () => JSON.stringify({ e: 'escola-x', c: CODIGO, acao }) }, new URL('https://x/api/aluno'));
  checar('aluno da escola-x não grava (403)', p.status === 403 && gravou === 0, `${p.status} gravou=${gravou}`);
  checar('mensagem é "Versão de demonstração"', (await corpo(p)).erro === 'Versão de demonstração');

  // ---- 3. Store em modo demonstração ----
  fake.limpar();
  let baloes = 0;
  globalThis.window = globalThis.window || new EventTarget();
  aoBloquear(() => { baloes++; });
  ligarDemo(dados);
  checar('modo demonstração ligado', ehDemo());

  let st = null;
  function Sonda() { st = useTenantStore('escola-x', 'Demonstração', config); return null; }
  renderToString(<Sonda />);
  checar('estado da demonstração já carregado', st.state && st.state.turmas.length === s.turmas.length);
  let barrou = false;
  try { st.dispatch({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Bruno' }); } catch (e) { barrou = e && e.demo === true; }
  checar('ação de clique é barrada', barrou);
  checar('balão aparece', baloes === 1, String(baloes));
  checar('nada vai ao banco', fake.lerServidor('tenants/escola-x/state') === null);
  let automaticaOk = true;
  try { st.dispatch({ type: 'CLEANUP' }); st.dispatch({ type: 'FREEZE_RESUMOS' }); } catch { automaticaOk = false; }
  checar('automáticas rodam sem balão', automaticaOk && baloes === 1, String(baloes));

  // ---- 4. Outras gravações ----
  for (const [nome, fn] of [
    ['salvar regras', () => saveConfig('escola-x', { regras: {} })],
    ['salvar nome e cor', () => saveTenantPublic('escola-x', { nome: 'X' })],
    ['baixar dados', () => exportarDadosEscola('escola-x')],
  ]) {
    let b = false;
    try { await fn(); } catch (e) { b = e && e.demo === true; }
    checar(`${nome} é barrado`, b);
  }
  checar('cada bloqueio mostra o balão', baloes === 4, String(baloes));

  // ---- 5. Telas ----
  globalThis.window.location = new URL('https://aviz.example.com/?e=escola-x&demo=1');
  const html = renderToString(<EscolaApp tenant="escola-x" user={{ uid: 'demo', email: null }} membro={{ role: 'owner', nome: 'Demonstração' }} />);
  checar('painel da escola renderiza', html.includes('Escola X') && html.includes('Turmas'));
  checar('sem botão sair na demonstração', !/>sair</.test(html));
  const modal = renderToString(<GerarLinkModal state={s} dispatch={() => {}} vocab={makeVocab(config)} tenantId="escola-x" onClose={() => {}} />);
  checar('modal do link renderiza', modal.includes('Link do'));
}

main().then(() => {
  console.log(falhas ? `\n❌ ${falhas} falha(s) na demonstração` : '\n✅ demonstração ok');
  process.exit(falhas ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
