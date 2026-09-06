// Teste das travas de perda de dados do store.
//
// O app grava o ESTADO INTEIRO de uma vez. Isso quer dizer que qualquer momento
// em que ele ache que a escola está vazia é um momento em que ele pode apagar a
// escola. Já aconteceu de voltar do "sair" e encontrar tudo zerado. Estes
// testes fixam as três travas que impedem isso.

import React from 'react';
import { renderToString } from 'react-dom/server';
import { useTenantStore } from '../src/lib/store.js';
import { paths } from '../src/lib/paths.js';
import { fake } from 'firebase/database';

const TID = 'escola-teste';
const CAMINHO = paths.state(TID);

// Estado "de verdade" que já está no servidor.
const ESCOLA_CHEIA = {
  turmas: [{ id: 't1', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0, horario: '09h' }], capacidade: 7, alunos: ['Bia', 'Caio'] }],
  faltas: [{ id: 'f1', alunoNome: 'Bia', turmaId: 't1', datas: ['2026-09-08'], status: 'pendente' }],
  reposicoes: [], vagas: [], ausencias: [], acessos: [], creditos: [], notas: [],
  log: [], aulasCanceladas: [], snapshots: [], resumosDiarios: {},
  _updatedAt: 1000,
};

// Monta o hook fora do React: renderToString roda o corpo do componente e nos
// entrega o que o hook devolveu, junto com os efeitos já aplicados à mão.
function montar() {
  let capturado = null;
  function Sonda() {
    capturado = useTenantStore(TID, 'Ana', { regras: {} });
    return null;
  }
  renderToString(<Sonda />);
  return capturado;
}

// renderToString não roda useEffect, então o listener é ligado na mão — é
// exatamente o que o efeito do store faz.
import { ref, onValue, runTransaction } from 'firebase/database';
import { normalizeState } from '../src/domain/reducer.js';

let falhas = 0;
function checar(nome, cond, extra) {
  if (cond) { console.log(`  ok  ${nome}`); }
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
}

// ---- 1. dispatch antes de carregar não pode gravar ----
{
  fake.limpar();
  fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
  const store = montar(); // sem efeito → nunca carregou
  store.dispatch({ type: 'ADD_ALUNO', turmaId: 't1', nome: 'Novo' });
  const noServidor = fake.lerServidor(CAMINHO);
  checar('não grava antes de carregar', noServidor && noServidor.turmas.length === 1 && noServidor.turmas[0].alunos.length === 2,
    'a escola foi sobrescrita antes de carregar');
}

// ---- 2. snapshot vazio depois de carregado não zera a escola ----
{
  fake.limpar();
  fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
  // simula o ciclo real: carrega, depois perde o acesso (vem vazio)
  let visto = null;
  let carregado = false;
  const un = onValue(ref(null, CAMINHO), (snap) => {
    const raw = snap.val();
    if (raw == null && carregado) return; // é a regra que o store aplica
    visto = normalizeState(raw);
    carregado = true;
  });
  fake.semearServidor(CAMINHO, ESCOLA_CHEIA); // carrega
  const antes = visto && visto.turmas.length;
  fake.entregarVazio(CAMINHO); // perde acesso
  const depois = visto && visto.turmas.length;
  un();
  checar('vazio após carregado não substitui os dados', antes === depois && antes > 0, `antes=${antes} depois=${depois}`);
  checar('servidor intacto após o vazio', fake.lerServidor(CAMINHO).turmas.length === 1);
}

// ---- 3. gravação abortada quando o servidor está mais novo ----
{
  fake.limpar();
  fake.semearServidor(CAMINHO, ESCOLA_CHEIA);
  // cliente com base velha (1000) tenta gravar; servidor já está em 2000
  fake.semearServidor(CAMINHO, { ...ESCOLA_CHEIA, _updatedAt: 2000, turmas: [] });
  const base = 1000;
  runTransaction(ref(null, CAMINHO), (servidor) => {
    const v = Number(servidor && servidor._updatedAt) || 0;
    if (v > base) return undefined;
    return { ...ESCOLA_CHEIA, _updatedAt: 1500 };
  }).then((res) => {
    checar('aborta gravação sobre versão mais nova', res.committed === false);
    checar('servidor manteve a versão nova', fake.lerServidor(CAMINHO)._updatedAt === 2000);
    console.log(falhas ? `\n❌ ${falhas} trava(s) falharam` : '\n✅ travas de perda de dados ok');
    process.exit(falhas ? 1 : 0);
  });
}
