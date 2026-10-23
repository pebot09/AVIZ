// Cliente de /api/escola: criação de escola (só admin) e convite do dono.
// Ver worker/escola.js.

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase.js';

async function chamar(corpo) {
  let resp;
  try {
    resp = await fetch('/api/escola', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão e tente de novo.');
  }
  let dados = null;
  try { dados = await resp.json(); } catch { /* resposta sem json */ }
  if (!resp.ok) {
    const err = new Error((dados && dados.erro) || 'Não foi possível completar. Tente de novo.');
    err.status = resp.status;
    throw err;
  }
  return dados;
}

const idToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);

export async function souAdmin() {
  if (!auth.currentUser) return false;
  try { return !!(await chamar({ op: 'souAdmin', idToken: await idToken() })).admin; } catch { return false; }
}

// payload: { slug, email, nomeEscola, artigo, cor, donoNome, config } → { e, convite }
export async function criarEscola({ slug, ...resto }) {
  return chamar({ op: 'criar', e: slug, idToken: await idToken(), ...resto });
}

export async function listarConvites() {
  return (await chamar({ op: 'convites', idToken: await idToken() })).convites || [];
}

export function verConvite(convite) {
  return chamar({ op: 'verConvite', convite });
}

// Aceita o convite (e escolhe o PIN, se a pessoa ainda não tem conta) e entra.
export async function aceitarConvite(convite, pin, versao) {
  const { e, token } = await chamar({ op: 'aceitarConvite', convite, pin, aceite: true, versao });
  await signInWithCustomToken(auth, token);
  return e;
}

export function linkDoConvite(convite) {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/?convite=${convite}`;
}

// Endereço completo do espaço, para o dono guardar e passar à equipe.
export function enderecoDaEscola(slug) {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/?e=${slug}`;
}
