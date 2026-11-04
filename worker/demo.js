// /api/demo — a demonstração pública do app (?e=escola-x&demo=1).
//
// Quem abre o demo não tem conta, e o banco barra quem não tem conta. Por isso
// o Worker lê a escola e devolve os dados — mas SÓ das escolas desta lista,
// que são de mentira. Nenhuma escola de cliente pode entrar aqui.
//
// Também usada pelo /api/aluno: nas escolas de demonstração o link do aluno é
// só leitura, para ninguém mexer nos dados a partir de um link que viu no demo.

export const ESCOLAS_DEMO = new Set(['escola-x']);
export const ehEscolaDemo = (tid) => ESCOLAS_DEMO.has(tid);

// E-mail da equipe aparece mascarado: p•••@gmail.com.
export function mascararEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [u, d] = email.split('@');
  return `${u.slice(0, 1)}•••@${d}`;
}

// deps: { lerTudo(tid) → { bruto, config, pub }, lerMembros(tid) }
export function criarHandlerDemo(deps) {
  return async function (request, url) {
    if (request.method !== 'GET') return json({ erro: 'Versão de demonstração' }, 405);
    const tid = url.searchParams.get('e');
    if (!ehEscolaDemo(tid)) return json({ erro: 'Esta escola não tem demonstração.' }, 404);
    const [{ bruto, config, pub }, membros] = await Promise.all([deps.lerTudo(tid), deps.lerMembros(tid)]);
    // Da equipe, só nome, papel e e-mail mascarado.
    const equipe = {};
    for (const [id, m] of Object.entries(membros || {})) {
      if (!m) continue;
      equipe[id] = { nome: m.nome || '', role: m.role || '', email: mascararEmail(m.email) };
    }
    return json({ state: bruto || {}, config: config || {}, pub: pub || {}, membros: equipe });
  };
}

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
