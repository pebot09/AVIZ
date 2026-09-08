// Firebase de mentira para os testes do store.
//
// Só o suficiente para exercitar useTenantStore: um nó de dados na memória, um
// listener, e uma transação que enxerga o valor "do servidor". O que queremos
// provar aqui não é o Firebase — é que o app nunca grava por cima da escola
// quando não tem os dados em mãos.

export const db = { __fake: true };
export const app = {};
export const auth = {};
export function initializeApp() { return app; }
export function getDatabase() { return db; }
export function getAuth() { return auth; }

const nos = new Map(); // caminho -> valor
const listeners = new Map(); // caminho -> Set de {ok, err}

export function ref(_db, caminho) { return { caminho }; }

function entregar(caminho) {
  const val = nos.has(caminho) ? nos.get(caminho) : null;
  (listeners.get(caminho) || new Set()).forEach((l) => l.ok({ val: () => val, exists: () => val != null }));
}

export function onValue(r, ok, err) {
  const set_ = listeners.get(r.caminho) || new Set();
  const l = { ok, err };
  set_.add(l);
  listeners.set(r.caminho, set_);
  return () => set_.delete(l);
}

export async function set(r, valor) {
  nos.set(r.caminho, valor);
  entregar(r.caminho);
}

export async function get(r) {
  const val = nos.has(r.caminho) ? nos.get(r.caminho) : null;
  return { val: () => val, exists: () => val != null };
}

export async function remove(r) {
  nos.delete(r.caminho);
  entregar(r.caminho);
}

export async function runTransaction(r, fn) {
  const atual = nos.has(r.caminho) ? nos.get(r.caminho) : null;
  const novo = fn(atual);
  if (novo === undefined) return { committed: false, snapshot: { val: () => atual } };
  nos.set(r.caminho, novo);
  entregar(r.caminho);
  return { committed: true, snapshot: { val: () => novo } };
}

// ---- controle do teste ----
export const fake = {
  // grava direto, como se outro dispositivo/servidor tivesse escrito
  semearServidor(caminho, valor) { nos.set(caminho, valor); entregar(caminho); },
  // simula perda de acesso: o listener passa a receber vazio
  entregarVazio(caminho) {
    (listeners.get(caminho) || new Set()).forEach((l) => l.ok({ val: () => null, exists: () => false }));
  },
  lerServidor(caminho) { return nos.has(caminho) ? nos.get(caminho) : null; },
  limpar() { nos.clear(); listeners.clear(); },
};
