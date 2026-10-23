// Link de acesso por e-mail. Hoje só serve para "Esqueci meu PIN" e para o
// primeiro acesso do dono de uma escola nova: o dia a dia é e-mail + PIN
// (src/lib/contaApi.js).
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

function actionCodeSettings(continueUrl) {
  return {
    url: continueUrl || window.location.href, // preserva ?e=escola (ou volta para a escola recém-criada)
    handleCodeInApp: true,
  };
}

// Passo 1: envia o link. Guarda o e-mail localmente para completar no retorno
// (o Firebase exige o mesmo e-mail para fechar o login).
export async function sendLoginLink(email, continueUrl) {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) throw new Error('E-mail vazio');
  await sendSignInLinkToEmail(auth, clean, actionCodeSettings(continueUrl));
  try { localStorage.setItem(EMAIL_KEY, clean); } catch { /* ignore */ }
  return clean;
}

// A URL atual é um link de login aberto num aparelho que não guardou o
// e-mail (outro celular, navegador interno do app de e-mail)? Então o app
// precisa pedir o e-mail numa tela própria antes de fechar o login.
export function linkPedeEmail() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;
  if (emailDoLink()) return false;
  try { return !localStorage.getItem(EMAIL_KEY); } catch { return true; }
}

// O link de "Esqueci meu PIN" leva o e-mail junto (?email=…): assim quem abre
// o link noutro navegador (o do app de e-mail, por exemplo) não precisa
// digitar o e-mail de novo.
function emailDoLink() {
  return new URLSearchParams(window.location.search).get('email') || null;
}

// Passo 2: se a URL atual é um link de login, fecha o login. Chamar no load.
// Retorna o usuário logado, ou null se não era um link (ou se falta o e-mail —
// ver linkPedeEmail; aí chame de novo passando o e-mail digitado).
export async function completeLoginIfPresent(emailDigitado) {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;

  let email = emailDigitado || null;
  if (!email) { try { email = localStorage.getItem(EMAIL_KEY); } catch { /* ignore */ } }
  if (!email) email = emailDoLink();
  if (!email) return null;

  const cred = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
  try { localStorage.removeItem(EMAIL_KEY); } catch { /* ignore */ }

  // Limpa os parâmetros do link da URL, mantendo ?e=escola e o pedido de PIN.
  const atual = new URLSearchParams(window.location.search);
  const fica = new URLSearchParams();
  if (atual.get('e')) fica.set('e', atual.get('e'));
  if (atual.has('novopin')) fica.set('novopin', '1');
  const limpo = window.location.pathname + (fica.toString() ? `?${fica}` : '');
  window.history.replaceState({}, '', limpo);

  return cred.user;
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function logout() {
  return signOut(auth);
}
