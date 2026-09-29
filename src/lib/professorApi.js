// Cliente de /api/professor: login do professor por PIN e gestão da equipe.
//
// O professor não tem e-mail. O Worker confere o PIN e devolve um custom token;
// signInWithCustomToken o transforma numa sessão normal do Firebase Auth, e
// daí em diante as regras de membro e o EscolaApp valem igual ao do dono.
// As ações do dono vão com o ID token dele, que o Worker confere.

import { signInWithCustomToken } from 'firebase/auth';
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

export async function listarProfessores(tenant) {
  const r = await chamar({ op: 'listar', e: tenant });
  return r.professores || [];
}

export async function entrarComPin(tenant, id, pin) {
  const { token } = await chamar({ op: 'entrar', e: tenant, id, pin });
  const cred = await signInWithCustomToken(auth, token);
  return cred.user;
}

async function idTokenDoDono() {
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre de novo.');
  return auth.currentUser.getIdToken();
}

// Cria (sem id) ou edita (com id) um professor. `pin` só vai quando muda.
export async function salvarProfessor(tenant, { id, nome, pin }) {
  const corpo = { op: 'salvar', e: tenant, idToken: await idTokenDoDono(), nome };
  if (id) corpo.id = id;
  if (pin !== undefined && pin !== '') corpo.pin = pin;
  return chamar(corpo);
}

export async function removerProfessor(tenant, id) {
  return chamar({ op: 'remover', e: tenant, idToken: await idTokenDoDono(), id });
}
