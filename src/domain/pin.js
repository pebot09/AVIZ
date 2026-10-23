// Hash de PIN e uid de professor — funções puras, usadas pelo Worker.
//
// O PIN em si (4 números, regras e limite de tentativas) está em
// src/domain/conta.js. O PIN nunca fica em texto puro: só o hash, em
// /contas, caminho que as regras não liberam para ninguém.

// Poucas iterações de propósito: o plano grátis do Worker tem ~10ms de CPU por
// pedido. O hash nem é legível por clientes; o custo aqui é defesa extra caso o
// banco vaze.
const ITERACOES = 5000;

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function deHex(s) {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derivar(pin, salBytes, iteracoes) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salBytes, iterations: iteracoes }, chave, 256));
}

// Registro guardado: { alg, it, sal, hash }.
export async function hashSegredo(pin) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { alg: 'pbkdf2-sha256', it: ITERACOES, sal: hex(sal), hash: await derivar(pin, sal, ITERACOES) };
}

// Compara em tempo constante (o tamanho é sempre o mesmo).
export async function confereSegredo(pin, registro) {
  if (typeof pin !== 'string' || !registro || !registro.sal || !registro.hash) return false;
  const calc = await derivar(pin, deHex(registro.sal), Number(registro.it) || ITERACOES);
  if (calc.length !== registro.hash.length) return false;
  let dif = 0;
  for (let i = 0; i < calc.length; i++) dif |= calc.charCodeAt(i) ^ registro.hash.charCodeAt(i);
  return dif === 0;
}

// uid do professor no Firebase Auth. Prefixo fixo para nunca colidir com o uid
// de uma conta criada pelo Firebase (link por e-mail).
export function novoUidProfessor() {
  return 'prof-' + hex(crypto.getRandomValues(new Uint8Array(10)));
}
export const ehUidProfessor = (s) => typeof s === 'string' && /^prof-[0-9a-f]{20}$/.test(s);

export function nomeProfessorValido(nome) {
  const n = typeof nome === 'string' ? nome.trim() : '';
  return n.length >= 1 && n.length <= 40;
}
