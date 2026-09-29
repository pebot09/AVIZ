// PIN do professor — regras puras, usadas pelo Worker (e pelos testes).
//
// Cada professor é um membro da escola (/tenants/{tid}/members/{uid}, role
// 'professor') com um PIN próprio definido pelo dono. O PIN nunca fica em texto
// puro nem em lugar que um membro consiga ler: só o hash, em
// /pinsProfessor/{tid}/{uid}, caminho que as regras não liberam para ninguém —
// quem lê e grava ali é o Worker, como conta de serviço.
//
// Por que um PIN por professor (e não um PIN da escola): o log sabe quem agiu
// de verdade, e o dono tira um professor sem trocar a senha de todo mundo.

export const PIN_TAMANHO = 6;

// Tentativas erradas: a partir de MAX_ERROS dentro da JANELA, aquele endereço
// fica bloqueado naquela escola até a janela passar. Com 6 dígitos, isso deixa
// o chute às cegas inviável.
export const MAX_ERROS = 5;
export const JANELA_MS = 15 * 60 * 1000;

// Poucas iterações de propósito: o plano grátis do Worker tem ~10ms de CPU por
// pedido. O hash nem é legível por clientes; o custo aqui é defesa extra caso o
// banco vaze.
const ITERACOES = 5000;

export function pinValido(pin) {
  return typeof pin === 'string' && new RegExp(`^\\d{${PIN_TAMANHO}}$`).test(pin);
}

// Sequências óbvias que o dono não pode escolher.
export function pinFraco(pin) {
  if (!pinValido(pin)) return true;
  if (/^(\d)\1+$/.test(pin)) return true; // 000000, 111111…
  const sobe = '01234567890123456789';
  const desce = '98765432109876543210';
  return sobe.includes(pin) || desce.includes(pin);
}

// Mensagem de erro para o dono ao definir um PIN, ou null se está bom.
export function problemaDoPin(pin) {
  if (!pinValido(pin)) return `O PIN precisa ter ${PIN_TAMANHO} números.`;
  if (pinFraco(pin)) return 'Esse PIN é fácil demais de adivinhar. Escolha outro.';
  return null;
}

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

// Gera o registro guardado em /pinsProfessor: { alg, it, sal, hash }.
export async function hashPin(pin) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { alg: 'pbkdf2-sha256', it: ITERACOES, sal: hex(sal), hash: await derivar(pin, sal, ITERACOES) };
}

// Compara em tempo constante (o tamanho é sempre o mesmo).
export async function conferePin(pin, registro) {
  if (!pinValido(pin) || !registro || !registro.sal || !registro.hash) return false;
  const calc = await derivar(pin, deHex(registro.sal), Number(registro.it) || ITERACOES);
  if (calc.length !== registro.hash.length) return false;
  let dif = 0;
  for (let i = 0; i < calc.length; i++) dif |= calc.charCodeAt(i) ^ registro.hash.charCodeAt(i);
  return dif === 0;
}

// ---- Limite de tentativas ----
// `t` é o registro guardado: { n: erros na janela, desde: início da janela }.

export function estaBloqueado(t, agora) {
  return !!t && agora - (Number(t.desde) || 0) < JANELA_MS && (Number(t.n) || 0) >= MAX_ERROS;
}

export function registrarErro(t, agora) {
  if (!t || agora - (Number(t.desde) || 0) >= JANELA_MS) return { n: 1, desde: agora };
  return { n: (Number(t.n) || 0) + 1, desde: t.desde };
}

// Minutos até liberar (para a mensagem de bloqueio).
export function minutosAteLiberar(t, agora) {
  return Math.max(1, Math.ceil(((Number(t.desde) || 0) + JANELA_MS - agora) / 60000));
}

// uid do professor no Firebase Auth. Prefixo fixo para nunca colidir com o uid
// de uma conta de e-mail (dono).
export function novoUidProfessor() {
  return 'prof-' + hex(crypto.getRandomValues(new Uint8Array(10)));
}
export const ehUidProfessor = (s) => typeof s === 'string' && /^prof-[0-9a-f]{20}$/.test(s);

export function nomeProfessorValido(nome) {
  const n = typeof nome === 'string' ? nome.trim() : '';
  return n.length >= 1 && n.length <= 40;
}
