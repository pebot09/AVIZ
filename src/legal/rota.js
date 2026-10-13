// Endereços das páginas legais. Ficam fora de qualquer escola (valem para
// todas) e abrem sem login — quem vai aceitar precisa poder ler antes.

const PAGINAS = { '/termos': 'termos', '/privacidade': 'privacidade' };

export function paginaLegal(loc = window.location) {
  const caminho = (loc.pathname || '/').replace(/\/+$/, '') || '/';
  return PAGINAS[caminho] || null;
}

export const LINK_TERMOS = '/termos';
export const LINK_PRIVACIDADE = '/privacidade';
