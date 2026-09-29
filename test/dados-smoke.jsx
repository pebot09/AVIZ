// Exportação e exclusão dos dados da escola (LGPD) + textos legais.
//
// Roda com o Firebase de mentira (mesmos aliases do store-smoke). O que
// importa provar:
//   1. o arquivo exportado tem tudo o que é da escola, e nada de outra escola;
//   2. a exclusão apaga tudo da escola, na ordem que as regras do banco
//      permitem, e não encosta em outra escola nem em /billing;
//   3. uma exclusão que para no meio avisa onde parou e termina ao repetir;
//   4. os Termos e a Política cobrem os pontos obrigatórios da PLANTA.

import React from 'react';
import { renderToString } from 'react-dom/server';
import { fake } from 'firebase/database';
import { paths } from '../src/lib/paths.js';
import { exportarDadosEscola, excluirEscola } from '../src/lib/dados.js';
import { montarExportacao, planoExclusao, confirmacaoExclusaoOk, nomeArquivoExportacao, FORMATO_EXPORTACAO } from '../src/domain/dadosEscola.js';
import { TERMOS } from '../src/legal/termos.js';
import { PRIVACIDADE } from '../src/legal/privacidade.js';
import { OPERADOR, textosProntos } from '../src/legal/operador.js';
import { paginaLegal } from '../src/legal/rota.js';
import PaginaLegal from '../src/legal/PaginaLegal.jsx';
import DadosSec from '../src/components/DadosSec.jsx';

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

const TID = 'escola-a';
const OUTRA = 'escola-b';
const DONO = 'uid-dono';
const PROF = 'uid-prof';

const STATE = {
  turmas: [{ id: 't1', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }], capacidade: 7, alunos: ['Bia', 'Caio'] }],
  faltas: [{ id: 'f1', alunoNome: 'Bia', turmaId: 't1', datas: ['2026-09-08'], status: 'pendente' }],
  reposicoes: [], vagas: [], ausencias: [], creditos: [], notas: [],
  acessos: [{ alunoNome: 'Bia', turmaId: 't1', codigo: '123456' }],
  log: [{ ts: 1, autor: 'Ana', descricao: 'Criou turma' }],
  _updatedAt: 1000,
};

function semear() {
  fake.limpar();
  for (const tid of [TID, OUTRA]) {
    fake.semearServidor(paths.tenantPublic(tid), { nome: `Escola ${tid}`, artigo: 'a', cor: '#123456' });
    fake.semearServidor(paths.config(tid), { regras: { capacidadeNominal: 7 }, aceite: { versao: 'v1', em: 'x' } });
    fake.semearServidor(paths.state(tid), { ...STATE, turmas: [{ ...STATE.turmas[0], alunos: tid === TID ? ['Bia', 'Caio'] : ['Zeca'] }] });
    fake.semearServidor(paths.members(tid), { [DONO]: { role: 'owner', nome: 'Ana', genero: 'a' }, [PROF]: { role: 'professor', nome: 'Beto' } });
    fake.semearServidor(paths.snapshots(tid), { s1: { label: 'foto' } });
    fake.semearServidor(paths.backups(tid), { 1: { ts: 1, dados: STATE } });
    fake.semearServidor(paths.billing(tid), { status: 'ativo' });
  }
}

// Mini-avaliador de database.rules.json para os caminhos que a exclusão
// toca: diz se o dono ainda pode remover `caminho`, dado o banco naquele
// momento. Espelha as regras — se elas mudarem, isto precisa mudar junto.
function donoPodeRemover(caminho, tid, uid) {
  const members = fake.lerServidor(paths.members(tid)) || {};
  const ehMembro = !!members[uid];
  const ehDono = ehMembro && members[uid].role === 'owner';
  if (caminho === paths.state(tid) || caminho === paths.snapshots(tid) || caminho === paths.backups(tid)) return ehMembro;
  if (caminho === paths.config(tid) || caminho === paths.tenantPublic(tid)) return ehDono;
  if (caminho.startsWith(paths.members(tid) + '/')) return ehDono;
  return false; // qualquer outro caminho (o $tid inteiro, /billing) não tem .write para cliente
}

async function main() {
  // ---- 1. o arquivo exportado ----
  {
    semear();
    const agora = Date.parse('2026-09-29T12:00:00Z');
    const exp = await exportarDadosEscola(TID, agora);
    checar('exportação tem formato e versão', exp.formato === FORMATO_EXPORTACAO && exp.versao === 1);
    checar('exportação diz a escola e a data', exp.escola === TID && exp.geradoEm === '2026-09-29T12:00:00.000Z');
    checar('exportação traz vitrine e config', exp.vitrine.nome === 'Escola escola-a' && exp.config.regras.capacidadeNominal === 7);
    checar('exportação traz o estado completo', exp.dados.turmas[0].alunos.join() === 'Bia,Caio' && exp.dados.faltas.length === 1 && exp.dados.acessos.length === 1 && exp.dados.log.length === 1);
    checar('exportação não carrega controle interno', !('_updatedAt' in exp.dados));
    checar('exportação traz a equipe só com nome e papel', exp.equipe[DONO].nome === 'Ana' && exp.equipe[DONO].role === 'owner' && !('genero' in exp.equipe[DONO]) && exp.equipe[PROF].role === 'professor');
    checar('exportação traz as fotos da lista', exp.snapshots.s1.label === 'foto');
    checar('exportação traz o resumo', exp.resumo.alunos === 2 && exp.resumo.faltas === 1, JSON.stringify(exp.resumo));
    checar('exportação não mistura outra escola', !JSON.stringify(exp).includes('Zeca'));
    checar('exportação não traz cobrança', !JSON.stringify(exp).includes('ativo'));
    checar('exportação vira JSON', JSON.parse(JSON.stringify(exp)).escola === TID);
    checar('nome do arquivo tem escola e data', nomeArquivoExportacao(TID, agora) === 'aviz-escola-a-2026-09-29.json');
    const vazia = montarExportacao({ tenant: 'nova' });
    checar('escola vazia exporta sem quebrar', vazia.resumo.alunos === 0 && vazia.dados && vazia.equipe);
  }

  // ---- 2. o plano de exclusão respeita as regras ----
  {
    semear();
    const plano = planoExclusao(TID, [DONO, PROF], DONO);
    checar('dono é o último a sair', plano[plano.length - 1] === paths.member(TID, DONO));
    checar('outros membros saem primeiro', plano[0] === paths.member(TID, PROF));
    checar('plano não toca /billing', !plano.some((c) => c.startsWith('billing')));
    checar('plano não toca outra escola', plano.every((c) => c.includes(TID)));
    // simula passo a passo com as regras: cada remoção precisa ser permitida
    let bloqueado = null;
    for (const c of plano) {
      if (!donoPodeRemover(c, TID, DONO)) { bloqueado = c; break; }
      fake.semearServidor(c, null);
      if (c.startsWith(paths.members(TID) + '/')) {
        const m = { ...(fake.lerServidor(paths.members(TID)) || {}) };
        delete m[c.split('/').pop()];
        fake.semearServidor(paths.members(TID), m);
      }
    }
    checar('todas as remoções são permitidas pelas regras, na ordem', bloqueado === null, bloqueado);
    // e o contrário: dono primeiro trancaria o resto
    semear();
    const ruim = [paths.member(TID, DONO), paths.config(TID)];
    fake.semearServidor(paths.members(TID), { [PROF]: { role: 'professor' } });
    checar('(controle) sem o dono, config não pode mais ser apagado', !donoPodeRemover(ruim[1], TID, DONO));
  }

  // ---- 3. excluir de verdade ----
  {
    semear();
    await excluirEscola(TID, DONO);
    const sobrou = [paths.tenantPublic(TID), paths.config(TID), paths.state(TID), paths.snapshots(TID), paths.backups(TID)]
      .filter((c) => fake.lerServidor(c) != null);
    checar('apaga vitrine, config, estado, fotos e backups', sobrou.length === 0, sobrou.join(', '));
    const equipe = fake.lerServidor(paths.members(TID)) || {};
    checar('apaga a equipe inteira', Object.keys(equipe).length === 0, Object.keys(equipe).join(','));
    checar('outra escola fica intacta',
      fake.lerServidor(paths.state(OUTRA)).turmas[0].alunos[0] === 'Zeca'
      && Object.keys(fake.lerServidor(paths.members(OUTRA))).length === 2
      && fake.lerServidor(paths.backups(OUTRA)) != null);
    checar('cobrança não é tocada pelo cliente', fake.lerServidor(paths.billing(TID)).status === 'ativo');
  }

  // ---- 4. exclusão que para no meio ----
  {
    semear();
    fake.falharRemove(paths.config(TID));
    let msg = '';
    try { await excluirEscola(TID, DONO); } catch (e) { msg = e.message; }
    checar('falha diz onde parou', msg.includes(paths.config(TID)), msg);
    checar('dono continua dono depois da falha (dá para repetir)', fake.lerServidor(paths.members(TID))[DONO].role === 'owner');
    fake.falharRemove(paths.config(TID), false);
    await excluirEscola(TID, DONO);
    checar('repetir termina a exclusão', fake.lerServidor(paths.config(TID)) == null && Object.keys(fake.lerServidor(paths.members(TID)) || {}).length === 0);
  }

  // ---- 5. confirmação digitada ----
  checar('confirma com o endereço exato', confirmacaoExclusaoOk('escola-a', TID));
  checar('confirma ignorando espaços e caixa', confirmacaoExclusaoOk('  Escola-A ', TID));
  checar('não confirma vazio', !confirmacaoExclusaoOk('', TID));
  checar('não confirma endereço parecido', !confirmacaoExclusaoOk('escola', TID));

  // ---- 6. textos legais ----
  const texto = (doc) => doc.secoes.map((s) => [s.titulo, ...s.blocos.map((b) => (typeof b === 'string' ? b : b.lista.join(' ')))].join(' ')).join(' ');
  const t = texto(TERMOS);
  const p = texto(PRIVACIDADE);
  const exige = [
    ['Termos: escola controladora, AVIZ operador', /controladora[\s\S]*operador/.test(t)],
    ['Termos: escola responde por poder cadastrar os nomes', /base legal para cadastrar/.test(t)],
    ['Termos: acesso de suporte auditado', /trilha de auditoria/.test(t)],
    ['Termos: corte em 30 dias e 90 dias de guarda', /30 dias/.test(t) && /90 dias/.test(t)],
    ['Termos: exportação e exclusão', /baixar uma cópia/.test(t) && /excluir a Escola/.test(t)],
    ['Termos: proíbe dado sensível', /sensíveis/.test(t)],
    ['Privacidade: só nome, turma e histórico', /só o nome, a turma/.test(p)],
    ['Privacidade: pagamento fica com o parceiro', /nunca com o AVIZ/.test(p)],
    ['Privacidade: direitos do art. 18', /art\. 18/.test(p)],
    ['Privacidade: crianças (art. 14)', /art\. 14/.test(p)],
    ['Privacidade: transferência internacional (art. 33)', /art\. 33/.test(p)],
    ['Privacidade: retenção de 90 dias', /90 dias/.test(p)],
    ['Privacidade: encarregado', /Encarregado/.test(p)],
    ['Privacidade: suboperadores nomeados', /Firebase/.test(p) && /Cloudflare/.test(p)],
  ];
  for (const [nome, ok] of exige) checar(nome, ok);
  checar('textos ainda são rascunho (há campos em aberto)', !textosProntos());
  const preenchido = Object.fromEntries(Object.keys(OPERADOR).map((k) => [k, 'x']));
  checar('textos prontos só quando revisados e preenchidos', textosProntos(preenchido, true) && !textosProntos(preenchido, false) && !textosProntos(OPERADOR, true));

  // ---- 7. rotas e telas ----
  const loc = (h) => new URL(h);
  checar('/termos abre os Termos', paginaLegal(loc('https://x.dev/termos')) === 'termos');
  checar('/privacidade/ abre a Política', paginaLegal(loc('https://x.dev/privacidade/?e=a')) === 'privacidade');
  checar('raiz não é página legal', paginaLegal(loc('https://x.dev/?e=a')) === null);
  for (const [nome, el] of [
    ['PaginaLegal termos', <PaginaLegal qual="termos" />],
    ['PaginaLegal privacidade', <PaginaLegal qual="privacidade" />],
    ['DadosSec', <DadosSec tenant={TID} uid={DONO} onDone={() => {}} />],
  ]) {
    try {
      const html = renderToString(el);
      checar(`render ${nome}`, html.length > 200 && (!nome.startsWith('PaginaLegal') || html.includes('Rascunho')));
    } catch (e) { checar(`render ${nome}`, false, e.message); }
  }

  console.log(falhas ? `\n❌ ${falhas} falha(s) em dados/LGPD` : '\n✅ dados e LGPD ok');
  process.exit(falhas ? 1 : 0);
}

main();
