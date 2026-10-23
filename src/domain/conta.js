// Conta de quem entra no AVIZ com e-mail + PIN (dono e, depois, professores).
//
// O PIN tem 4 números (decisão do Pedro: teclado numérico, fácil de digitar
// no celular). Com só 10 mil combinações, a defesa é o limite de tentativas
// POR E-MAIL: depois de MAX_ERROS_LOGIN erros, aquele e-mail fica travado até
// a janela passar.
//
// Onde fica (só o Worker lê e grava; as regras não liberam para ninguém):
//   /contas/{chave}          { uid, email, pin: { alg, it, sal, hash } }
//   /loginTentativas/{chave} { n, desde }
// `chave` = SHA-256 do e-mail em minúsculas (e-mail tem "." e não pode ser
// chave no Realtime Database).

import { hashSegredo, confereSegredo } from './pin.js';

export const PIN_CONTA_TAMANHO = 4;
export const MAX_ERROS_LOGIN = 10;
export const JANELA_LOGIN_MS = 15 * 60 * 1000;

export function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function emailValido(email) {
  const e = normalizarEmail(email);
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function pinContaValido(pin) {
  return typeof pin === 'string' && new RegExp(`^\\d{${PIN_CONTA_TAMANHO}}$`).test(pin);
}

// 0000, 1111, 1234, 4321… ficam de fora.
export function pinContaFraco(pin) {
  if (!pinContaValido(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true;
  return '01234567890'.includes(pin) || '09876543210'.includes(pin);
}

export function problemaDoPinConta(pin) {
  if (!pinContaValido(pin)) return `O PIN precisa ter ${PIN_CONTA_TAMANHO} números.`;
  if (pinContaFraco(pin)) return 'Esse PIN é fácil demais de adivinhar. Escolha outro.';
  return null;
}

export async function chaveDoEmail(email) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizarEmail(email)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashPinConta = (pin) => hashSegredo(pin);
export async function conferePinConta(pin, registro) {
  return pinContaValido(pin) && confereSegredo(pin, registro);
}

// ---- Limite de tentativas por e-mail ----
export function loginBloqueado(t, agora) {
  return !!t && agora - (Number(t.desde) || 0) < JANELA_LOGIN_MS && (Number(t.n) || 0) >= MAX_ERROS_LOGIN;
}

export function registrarErroLogin(t, agora) {
  if (!t || agora - (Number(t.desde) || 0) >= JANELA_LOGIN_MS) return { n: 1, desde: agora };
  return { n: (Number(t.n) || 0) + 1, desde: t.desde };
}

export function minutosAteLiberarLogin(t, agora) {
  return Math.max(1, Math.ceil(((Number(t.desde) || 0) + JANELA_LOGIN_MS - agora) / 60000));
}
