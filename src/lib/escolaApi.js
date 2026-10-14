// Cliente de /api/escola: a escola nova é salva no servidor ANTES do login.
//
// Assim o link mágico funciona em qualquer aparelho: quem abre o link entra,
// e o app "assume" a escola pendente daquele e-mail (worker/escola.js).

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

// payload: { slug, email, nomeEscola, artigo, cor, donoNome, donoGenero, config }
export function criarEscola({ slug, ...resto }) {
  return chamar({ op: 'criar', e: slug, ...resto });
}

// Vira dono da escola pendente, se o e-mail do login for o do onboarding.
// Retorna true se assumiu; false se não havia nada para este e-mail.
export async function assumirEscola(tenant) {
  if (!auth.currentUser || !auth.currentUser.email) return false;
  try {
    await chamar({ op: 'assumir', e: tenant, idToken: await auth.currentUser.getIdToken() });
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

// Endereço completo do espaço, para o dono guardar e passar à equipe.
export function enderecoDaEscola(slug) {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/?e=${slug}`;
}
