// Firebase de mentira, para o navegador, usado só para gerar o tutorial.
//
// Faz as vezes de firebase/app, firebase/database e firebase/auth: um banco
// em memória (árvore), listeners que avisam quem olha um caminho, e um login
// fingido. Assim o app de verdade roda sem rede e as capturas mostram as telas
// reais, com os dados da escola fictícia (ver cenario.js).

const raiz = { valor: {} };
const ouvintes = new Map(); // caminho -> Set(fn)
const clonar = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
const partes = (c) => String(c || '').split('/').filter(Boolean);

function ler(caminho) {
  let o = raiz.valor;
  for (const p of partes(caminho)) {
    if (o == null || typeof o !== 'object') return null;
    o = o[p];
  }
  return o === undefined ? null : o;
}

function gravar(caminho, valor) {
  const ps = partes(caminho);
  if (!ps.length) { raiz.valor = valor || {}; avisar(caminho); return; }
  let o = raiz.valor;
  for (const p of ps.slice(0, -1)) {
    if (o[p] == null || typeof o[p] !== 'object') o[p] = {};
    o = o[p];
  }
  const ult = ps[ps.length - 1];
  if (valor == null) delete o[ult]; else o[ult] = clonar(valor);
  avisar(caminho);
}

const foto = (v) => ({ val: () => clonar(v), exists: () => v != null });

function avisar(caminho) {
  const c = partes(caminho).join('/');
  for (const [k, fns] of ouvintes) {
    if (k === c || k.startsWith(c + '/') || c.startsWith(k + '/') || c === '' || k === '') {
      const v = ler(k);
      fns.forEach((fn) => setTimeout(() => fn(foto(v)), 0));
    }
  }
}

// ---- firebase/app ----
export function initializeApp() { return {}; }

// ---- firebase/database ----
export const db = {};
export function getDatabase() { return db; }
export function ref(_db, caminho) { return { caminho: partes(caminho).join('/') }; }
export function onValue(r, ok) {
  const s = ouvintes.get(r.caminho) || new Set();
  s.add(ok);
  ouvintes.set(r.caminho, s);
  setTimeout(() => ok(foto(ler(r.caminho))), 0);
  return () => s.delete(ok);
}
export async function get(r) { return foto(ler(r.caminho)); }
export async function set(r, valor) { gravar(r.caminho, valor); }
export async function remove(r) { gravar(r.caminho, null); }
export async function runTransaction(r, fn) {
  const atual = clonar(ler(r.caminho));
  const novo = fn(atual);
  if (novo === undefined) return { committed: false, snapshot: foto(atual) };
  gravar(r.caminho, novo);
  return { committed: true, snapshot: foto(novo) };
}

// ---- firebase/auth ----
const authObj = { currentUser: null, languageCode: 'pt-BR' };
const authOuvintes = new Set();
export function getAuth() { return authObj; }
function usuario(uid, email) {
  return { uid, email, getIdToken: async () => `token-${uid}` };
}
function trocarUsuario(u) {
  authObj.currentUser = u;
  authOuvintes.forEach((fn) => setTimeout(() => fn(u), 0));
}
export function onAuthStateChanged(_a, fn) {
  authOuvintes.add(fn);
  setTimeout(() => fn(authObj.currentUser), 0);
  return () => authOuvintes.delete(fn);
}
export async function signOut() { trocarUsuario(null); }
export async function signInWithCustomToken(_a, token) { trocarUsuario(usuario(token, null)); return {}; }
export async function sendSignInLinkToEmail() {}
export function isSignInWithEmailLink() { return false; }
export async function signInWithEmailLink() { return {}; }

// ---- controle do tutorial ----
export const falso = {
  semear(dados) { raiz.valor = clonar(dados); },
  ler,
  gravar,
  logar(uid, email) { authObj.currentUser = uid ? usuario(uid, email) : null; },
};
