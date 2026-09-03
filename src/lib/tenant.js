// Resolução do tenant (a escola) a partir do endereço.
//
// Produção: subdomínio — escola-a.aviz.com.br  → tenantId "escola-a"
// Desenvolvimento / sem domínio: querystring   → ?e=escola-a → tenantId "escola-a"
//
// Enquanto o AVIZ roda no endereço grátis (aviz.pages.dev, sem wildcard de
// subdomínio), o caminho de verdade é o ?e=slug. O subdomínio entra quando
// houver domínio próprio.

const HOSTS_RESERVADOS = new Set(['www', 'app', 'aviz', 'localhost']);

export function resolveTenant(loc = window.location) {
  const host = loc.hostname || '';
  const partes = host.split('.');

  // Subdomínio só conta se houver domínio de verdade (ex.: escola.aviz.com.br),
  // não em aviz.pages.dev nem em localhost.
  if (partes.length >= 3) {
    const sub = partes[0];
    if (sub && !HOSTS_RESERVADOS.has(sub)) return sub;
  }

  const q = new URLSearchParams(loc.search).get('e');
  if (q) return q.trim();

  return null;
}

// Código de acesso do aluno (?c=CODIGO), quando presente.
export function resolveAccessCode(loc = window.location) {
  return new URLSearchParams(loc.search).get('c');
}
