// Login do dono por link mágico (sem senha).
//
// Fluxo:
//   1. dono digita o e-mail → enviamos um link para ele
//   2. dono clica no link → volta para o app já autenticado
//   3. onAuthStateChanged nos avisa quem está logado
//
// O link volta para a MESMA URL (preservando ?e=escola), então o dono cai de
// novo na escola certa. O domínio dessa URL precisa estar em
// Authentication → Settings → Domínios autorizados (localhost já vem; o
// aviz.pages.dev e o domínio próprio entram quando publicarmos).

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase.js';

const EMAIL_KEY = 'aviz_login_email';

function actionCodeSettings() {
  return {
    url: window.location.href, // preserva ?e=escola
    handleCodeInApp: true,
  };
}

// Passo 1: envia o link. Guarda o e-mail localmente para completar no retorno
// (o Firebase exige o mesmo e-mail para fechar o login).
export async function sendLoginLink(email) {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) throw new Error('E-mail vazio');
  await sendSignInLinkToEmail(auth, clean, actionCodeSettings());
  try { localStorage.setItem(EMAIL_KEY, clean); } catch { /* ignore */ }
  return clean;
}

// Passo 2: se a URL atual é um link de login, fecha o login. Chamar no load.
// Retorna o usuário logado, ou null se não era um link.
export async function completeLoginIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;

  let email = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch { /* ignore */ }
  // Link aberto noutro dispositivo: pedimos o e-mail de novo.
  if (!email) {
    email = window.prompt('Confirme seu e-mail para entrar:');
  }
  if (!email) throw new Error('E-mail não informado para completar o login');

  const cred = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
  try { localStorage.removeItem(EMAIL_KEY); } catch { /* ignore */ }

  // Limpa os parâmetros do link da URL, mantendo ?e=escola.
  const tenant = new URLSearchParams(window.location.search).get('e');
  const limpo = window.location.pathname + (tenant ? `?e=${tenant}` : '');
  window.history.replaceState({}, '', limpo);

  return cred.user;
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function logout() {
  return signOut(auth);
}
