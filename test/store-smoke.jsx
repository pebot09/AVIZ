// Travas de gravação do store.
//
// Duas coisas já morderam aqui:
//   1. sobrescrever a escola com vazio (voltar do "sair" e achar tudo zerado);
//   2. a gravação ser descartada em silêncio — o app mostrava o aluno (estado
//      otimista) mas nada era salvo (foi o caso do export do escola-x: log só
//      com "Criou turma", nenhum aluno persistido).
//
// A correção do (2) é aplicar o reducer DENTRO da transação, sobre o valor mais
// recente do servidor, para que edições concorrentes se somem. Estes testes
// fixam os dois comportamentos com um Firebase de mentira, sem rede.

import React from 'react';
import { renderToString } from 'react-dom/server';
import { useTenantStore } from '../src/lib/store.js';
import { paths } from '../src/lib/paths.js';
import { fake } from 'firebase/database';
import { ref, onValue, get, runTransaction } from 'firebase/database';
import { reducer, normalizeState } from '../src/domain/reducer.js';

const TID = 'escola-teste';
const CAMINHO = paths.state(TID);
const CFG = { regras: {} };

const ESCOLA_CHEIA = {
  turmas: [{ id: 't1', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0, horario: '09h' }], capacidade: 7, alunos: ['Bia', 'Caio'] }],
  faltas: [{ id: 'f1', alunoNome: 'Bia', turmaId: 't1', datas: ['2026-09-08'], status: 'pendente' }],
  reposicoes: [], vagas: [], ausencias: [], acessos: [], creditos: [], notas: [],
  log: [], aulasCanceladas: [], snapshots: [], resumosDiarios: {}, _updatedAt: 1000,
};

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// Espelha o caminho de gravação do dispatch: puxa a verdade do servidor e
// aplica o reducer DENTRO da transação. É o que garante que nada some.
async function gravarComoDispatch(acao) {
  await get(ref(null, CAMINHO));
  return runTransaction(ref(null, CAMINHO), (servidor) => {
    const base = normalizeState(servidor);
    const next = reducer(base, acao, CFG);
    if (next === base) return undefined;
    return { ...next, _updatedAt: Date.now() + Math.floor(Math.random() * 1000) };
  });
}

function montar() {
  let capturado = null;
  function Sonda() { capturado = useTenantStore(TID, 'Ana', CFG); return null; }
  renderToString(<Sonda />);
  return capturado;
}

async function main() {
  // ---- 1. dispatch antes de carregar não grava ----
  {
    fake.limpar();
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    const store = montar(); // renderToString não roda o efeito → nunca carregou
    store.dispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Novo' });
    await new Promise((r) => setTimeout(r, 10));
    const srv = fake.lerServidor(CAMINHO);
    checar('não grava antes de carregar', srv.turmas.length === 1 && srv.turmas[0].alunos.length === 2);
  }

  // ---- 2. vazio depois de carregado não zera a escola ----
  {
    fake.limpar();
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    let visto = null; let carregado = false; let versao = 0;
    const un = onValue(ref(null, CAMINHO), (snap) => {
      const raw = snap.val();
      if (raw == null && carregado && versao > 0) return; // a regra do store
      visto = normalizeState(raw); versao = Number(raw && raw._updatedAt) || 0; carregado = true;
    });
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    const antes = visto.turmas.length; // t1 + turma-extra = 2 (normalizeState soma a extra)
    const tinhaT1 = visto.turmas.some((t) => t.id === 't1');
    fake.entregarVazio(CAMINHO);
    un();
    checar('vazio após carregado não substitui os dados', visto.turmas.length === antes && tinhaT1 && visto.turmas.some((t) => t.id === 't1'));
    checar('servidor intacto após o vazio', fake.lerServidor(CAMINHO).turmas.length === 1);
  }

  // ---- 3. duas gravações concorrentes se somam (o conserto do escola-x) ----
  {
    fake.limpar();
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    // Duas "abas" adicionam alunos diferentes à mesma turma. Antes, a segunda
    // era descartada (abortava por versão). Agora cada uma parte do estado já
    // gravado pela outra.
    await gravarComoDispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Ana', autor: 'x' });
    await gravarComoDispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Duda', autor: 'x' });
    const alunos = fake.lerServidor(CAMINHO).turmas.find((t) => t.id === 't1').alunos;
    checar('as duas gravações somam (nenhuma some)', ['Bia', 'Caio', 'Ana', 'Duda'].every((n) => alunos.includes(n)), alunos.join(','));
  }

  // ---- 4. a gravação realmente persiste (não é só otimista) ----
  {
    fake.limpar();
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    const res = await gravarComoDispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Ema', autor: 'x' });
    checar('a transação confirma (committed)', res.committed === true);
    checar('o aluno fica no servidor', fake.lerServidor(CAMINHO).turmas[0].alunos.includes('Ema'));
    // e o log registrou — era isto que faltava no export do escola-x
    checar('a ação entra no log persistido', fake.lerServidor(CAMINHO).log.some((e) => /Ema/.test(e.descricao)));
  }

  // ---- 5. adicionar aluno duplicado não duplica ----
  {
    fake.limpar();
    fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
    await gravarComoDispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Bia', autor: 'x' });
    const alunos = fake.lerServidor(CAMINHO).turmas[0].alunos;
    checar('duplicado não vira dois', alunos.filter((n) => n === 'Bia').length === 1);
  }

  console.log(falhas ? `\n❌ ${falhas} trava(s) falharam` : '\n✅ travas de gravação ok');
  process.exit(falhas ? 1 : 0);
}

main();
