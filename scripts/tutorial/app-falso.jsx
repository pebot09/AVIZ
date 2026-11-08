// Ponto de entrada do app no modo "tutorial": o App de verdade, com o banco
// de mentira (firebase-falso.js) e as rotas /api atendidas aqui mesmo, no
// navegador. Só serve para tirar as capturas do tutorial (capturar.mjs).
//
// ?quem=dona | prof | ninguem  → quem está logado (padrão: dona)

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { falso } from 'firebase/database';
import { montarCenario, ESCOLA, DONA, PROFS } from './cenario.js';
import { criarHandlerAluno } from '../../worker/index.js';
import App from '../../src/App.jsx';

const { banco } = montarCenario(new Date());
falso.semear(banco);

const quem = new URLSearchParams(window.location.search).get('quem') || 'dona';
if (quem === 'dona') falso.logar(DONA.uid, DONA.email);
else if (quem === 'prof') falso.logar(PROFS[0].uid, PROFS[0].email);
else falso.logar(null);

const nomeEscola = banco.tenantsPublic[ESCOLA].nome;
const resposta = (dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json' } });

const handlerAluno = criarHandlerAluno({
  async lerTudo(tid) {
    return { bruto: falso.ler(`tenants/${tid}/state`), etag: 'x', config: falso.ler(`tenants/${tid}/config`) || {}, pub: falso.ler(`tenantsPublic/${tid}`) || {} };
  },
  async gravar(tid, dados) { falso.gravar(`tenants/${tid}/state`, dados); return { conflito: false }; },
});

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (entrada, init = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada.url, window.location.origin);
  const corpo = () => { try { return JSON.parse(init.body || '{}'); } catch { return {}; } };
  if (url.pathname === '/api/aluno') return handlerAluno(new Request(url, init), url);
  if (url.pathname === '/manifest.webmanifest') return resposta({ name: nomeEscola });
  if (url.pathname === '/api/escola') {
    const { op } = corpo();
    if (op === 'verConvite') return resposta({ escola: nomeEscola, email: DONA.email, donoNome: DONA.nome, temConta: false });
    if (op === 'aceitarConvite') return resposta({ e: ESCOLA, token: DONA.uid });
    return resposta({});
  }
  if (url.pathname === '/api/conta') {
    const { op } = corpo();
    if (op === 'entrar') return resposta({ token: DONA.uid, escolas: [{ e: ESCOLA, nome: nomeEscola }] });
    return resposta({ escolas: [{ e: ESCOLA, nome: nomeEscola, papel: 'dono' }] });
  }
  if (url.pathname === '/api/professor') return resposta({ ok: true });
  return fetchOriginal(entrada, init);
};

createRoot(document.getElementById('root')).render(<App />);
