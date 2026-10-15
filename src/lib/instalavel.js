// App instalável: aponta o manifesto para o endereço em que a pessoa está.
//
// O manifesto (worker/manifest.js) sai com o nome da escola e abre o app no
// mesmo endereço: o aluno no link pessoal, a equipe no endereço da escola.
// O iPhone usa o título da página e a meta apple-mobile-web-app-title como
// nome embaixo do ícone, então os dois também recebem o nome da escola.

import { resolveTenant, resolveAccessCode, ultimoTenant, querEscolaNova } from './tenant.js';

export function linkManifesto(loc = window.location) {
  const e = resolveTenant(loc) || (querEscolaNova(loc) ? null : ultimoTenant());
  if (!e) return '/manifest.webmanifest';
  const q = new URLSearchParams({ e });
  const c = resolveAccessCode(loc);
  if (c) q.set('c', c);
  return `/manifest.webmanifest?${q}`;
}

// Aberto pelo ícone na tela inicial do iPhone (não pelo Safari).
export function ehAppIos() {
  try { return window.navigator.standalone === true; } catch { return false; }
}

export function prepararInstalacao(doc = document, loc = window.location) {
  const href = linkManifesto(loc);
  let link = doc.querySelector('link[rel="manifest"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'manifest';
    doc.head.appendChild(link);
  }
  link.href = href;

  // O mesmo manifesto traz o nome: um lugar só decide como o app se chama.
  fetch(href)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (!m || !m.name) return;
      doc.title = m.name;
      const meta = doc.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (meta) meta.setAttribute('content', m.name);
    })
    .catch(() => { /* sem rede: fica "AVIZ" */ });
}
