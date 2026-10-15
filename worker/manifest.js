// Manifesto do app instalável (PWA): /manifest.webmanifest?e=escola[&c=codigo]
//
// Quem toca em "Adicionar à Tela de Início" ganha um ícone que abre o AVIZ em
// tela cheia. O manifesto é gerado por endereço, porque:
//   - o nome embaixo do ícone é o nome da escola, não "AVIZ";
//   - o app tem que abrir onde a pessoa estava: o aluno no link pessoal dele
//     (?e=…&c=…), a equipe no endereço da escola (?e=…). Um start_url fixo em
//     "/" faria o aluno perder o link ao instalar.

const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
const ehCodigo = (s) => typeof s === 'string' && /^\d{4,12}$/.test(s);

export const COR_TEMA = '#2563eb';
export const COR_FUNDO = '#f3f4f6';

// Monta o manifesto. Parâmetros inválidos são ignorados (cai no app genérico).
export function montarManifesto({ e, c, nome }) {
  const slug = ehSlug(e) ? e : null;
  const codigo = slug && ehCodigo(c) ? c : null;
  const start = slug ? `/?e=${slug}${codigo ? `&c=${codigo}` : ''}` : '/';
  const titulo = (typeof nome === 'string' && nome.trim()) ? nome.trim().slice(0, 60) : 'AVIZ';
  return {
    // id = start_url: duas escolas (ou dois alunos) no mesmo aparelho viram
    // dois apps, cada um com o seu ícone.
    id: start,
    name: titulo,
    short_name: titulo,
    start_url: start,
    scope: '/',
    display: 'standalone',
    background_color: COR_FUNDO,
    theme_color: COR_TEMA,
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

// `lerNome(slug)` devolve o nome público da escola (ou null). Falhar ao ler
// não impede a instalação: o ícone sai com o nome "AVIZ".
export function criarHandlerManifesto({ lerNome }) {
  return async (url) => {
    const e = url.searchParams.get('e');
    let nome = null;
    if (ehSlug(e)) {
      try { nome = await lerNome(e); } catch { nome = null; }
    }
    const corpo = montarManifesto({ e, c: url.searchParams.get('c'), nome });
    return new Response(JSON.stringify(corpo), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        // Curto: se o dono renomear a escola, o próximo ícone já sai certo.
        'Cache-Control': 'public, max-age=300',
      },
    });
  };
}
