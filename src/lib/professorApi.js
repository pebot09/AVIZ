// Cliente de /api/professor: o dono gere a equipe. Cada professor tem conta de
// e-mail + PIN de 4 números e entra pela mesma tela do dono (contaApi.js).
// As ações vão com o ID token do dono, que o Worker confere.

import { auth } from './firebase.js';

const BASE = '/api/professor';

async function chamar(corpo) {
  let resp;
  try {
    resp = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão e tente de novo.');
  }
  let dados = null;
  try { dados = await resp.json(); } catch { /* resposta sem json */ }
  if (!resp.ok) throw new Error((dados && dados.erro) || 'Não foi possível completar. Tente de novo.');
  return dados;
}

async function idTokenDoDono() {
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre de novo.');
  return auth.currentUser.getIdToken();
}

// Cria (sem id) ou edita (com id) um professor. `pin` só vai quando muda.
// Retorna { id, nome, aviso? } — aviso quando o e-mail já tinha conta.
export async function salvarProfessor(tenant, { id, nome, email, pin }) {
  const corpo = { op: 'salvar', e: tenant, idToken: await idTokenDoDono(), nome };
  if (id) corpo.id = id;
  if (email) corpo.email = email.trim().toLowerCase();
  if (pin) corpo.pin = pin;
  return chamar(corpo);
}

export async function removerProfessor(tenant, id) {
  return chamar({ op: 'remover', e: tenant, idToken: await idTokenDoDono(), id });
}
