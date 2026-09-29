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
  if (falharEm.has(r.caminho)) throw new Error('permission_denied');
  // Como no banco de verdade: some o nó, tudo abaixo dele, e a chave dentro de
  // um pai que tenha sido gravado como objeto.
  for (const k of [...nos.keys()]) {
    if (k === r.caminho || k.startsWith(r.caminho + '/')) nos.delete(k);
  }
  const partes = r.caminho.split('/');
  for (let i = 1; i < partes.length; i++) {
    const pai = partes.slice(0, i).join('/');
    let o = nos.get(pai);
    const resto = partes.slice(i);
    while (o && typeof o === 'object' && resto.length > 1) o = o[resto.shift()];
    if (o && typeof o === 'object' && resto.length === 1) delete o[resto[0]];
  }
  entregar(r.caminho);
}

const falharEm = new Set();

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
  limpar() { nos.clear(); listeners.clear(); falharEm.clear(); },
  // faz o próximo remove() neste caminho falhar (simula regra/rede)
  falharRemove(caminho, ligar = true) { if (ligar) falharEm.add(caminho); else falharEm.delete(caminho); },
};
