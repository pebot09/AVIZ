// Modo demonstração: um link público (?e=escola-x&demo=1) para mostrar o app
// a quem pensa em comprar. A pessoa navega por tudo e vê os dados gravados,
// mas nada grava: toda ação que mexeria nos dados mostra o balão
// "Versão de demonstração" e para ali.
//
// Os dados vêm do Worker (/api/demo), que só serve as escolas da lista de
// demonstração. Quem abre o demo não tem conta: o banco continua fechado.

export const MSG_DEMO = 'Versão de demonstração';
const EVENTO = 'aviz-demo-bloqueado';

// Uma demonstração por página: os dados ficam aqui, só em memória.
let dados = null; // { state, config, pub, professores }
export const ehDemo = () => dados !== null;
export const dadosDemo = () => dados;
export function ligarDemo(d) { dados = d; }

export function querDemo(loc = window.location) {
  return new URLSearchParams(loc.search).has('demo');
}

// Lançado no meio do clique: interrompe o resto do handler (fechar modal,
// limpar formulário, mostrar "pronto"), para a tela não fingir que salvou.
export class DemoBloqueado extends Error {
  constructor() { super(MSG_DEMO); this.name = 'DemoBloqueado'; this.demo = true; }
}

// Mostra o balão (sem interromper nada).
export function avisarDemo() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO));
}

// Mostra o balão e interrompe a ação.
export function bloquearDemo() {
  avisarDemo();
  throw new DemoBloqueado();
}

export function aoBloquear(fn) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

// O erro lançado de propósito não é um erro de verdade: não suja o console.
export function silenciarBloqueios() {
  const ehBloqueio = (e) => e && e.demo === true;
  window.addEventListener('error', (ev) => { if (ehBloqueio(ev.error)) ev.preventDefault(); });
  window.addEventListener('unhandledrejection', (ev) => { if (ehBloqueio(ev.reason)) ev.preventDefault(); });
}

export async function carregarDemo(tenant) {
  let resp;
  try {
    resp = await fetch(`/api/demo?e=${encodeURIComponent(tenant)}`);
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão e tente de novo.');
  }
  let corpo = null;
  try { corpo = await resp.json(); } catch { /* sem json */ }
  if (!resp.ok) throw new Error((corpo && corpo.erro) || 'Não deu para abrir a demonstração.');
  return corpo;
}
