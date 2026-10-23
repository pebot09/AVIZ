// Cliente de /api/conta: entrar com e-mail + PIN, definir o PIN e listar as
// escolas de quem entrou. O Worker devolve um custom token, que vira uma
// sessão normal do Firebase Auth (e fica guardada: no app da tela inicial a
// pessoa entra uma vez e continua logada).

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase.js';

async function chamar(corpo) {
  let resp;
  try {
    resp = await fetch('/api/conta', {
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

async function idToken() {
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre de novo.');
  return auth.currentUser.getIdToken();
}

// Retorna a lista de escolas da conta: [{ e, nome, papel }].
export async function entrarComEmailPin(email, pin) {
  const { token, escolas } = await chamar({ op: 'entrar', email: (email || '').trim().toLowerCase(), pin });
  await signInWithCustomToken(auth, token);
  return escolas || [];
}

export async function definirMeuPin(pin) {
  const { escolas, token } = await chamar({ op: 'definirPin', idToken: await idToken(), pin });
  // O link do e-mail pode ter aberto uma sessão diferente da conta: troca.
  if (token) await signInWithCustomToken(auth, token);
  return escolas || [];
}

export async function minhasEscolas() {
  const { escolas } = await chamar({ op: 'escolas', idToken: await idToken() });
  return escolas || [];
}
