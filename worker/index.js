// Cloudflare Worker do AVIZ.
//
// Faz duas coisas:
//   1. /api/aluno  → a fatia do aluno (o "servidorzinho" que antes seria uma
//      Cloud Function). Aqui não precisa do plano Blaze do Firebase: o Worker
//      já roda junto com o app na Cloudflare, no plano grátis.
//   2. qualquer outro caminho → o app (arquivos estáticos em ./dist).
//
// Por que existe: o aluno não tem conta no Firebase, e as regras barram quem
// não tem conta — senão ele leria os dados de todos os outros alunos. O Worker
// tem um segredo do banco (em variável de ambiente, NUNCA no navegador), lê o
// estado, e devolve só a fatia dele. As ações passam pela lista fechada de
// acaoDoAluno, sempre com a identidade vinda do código de acesso.
//
// A lógica de domínio é IMPORTADA do app, não copiada — servidor e cliente
// discordarem sobre as regras seria fábrica de bug.

import { reducer, normalizeState } from '../src/domain/reducer.js';
import { fatiaAluno, acaoDoAluno } from '../src/domain/fatiaAluno.js';

const DB = 'https://aviz-cb3c8-default-rtdb.firebaseio.com';
const MAX_CORPO = 64 * 1024;

const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
const ehCodigo = (s) => typeof s === 'string' && /^\d{4,12}$/.test(s);

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ---- Acesso ao Firebase por REST, usando o segredo do banco ----
// O segredo (?auth=) dá acesso total, ignorando as regras — é o que um servidor
// de confiança usa. Ele vive só aqui, nas variáveis do Worker.
function depsFirebase(env) {
  const auth = `auth=${encodeURIComponent(env.FIREBASE_DB_SECRET)}`;
  return {
    async lerTudo(tid) {
      const [st, cf, pub] = await Promise.all([
        // X-Firebase-ETag liga o controle de versão: usamos o ETag depois para
        // gravar só se ninguém mexeu no meio (o equivalente REST da transação).
        fetch(`${DB}/tenants/${tid}/state.json?${auth}`, { headers: { 'X-Firebase-ETag': 'true' } }),
        fetch(`${DB}/tenants/${tid}/config.json?${auth}`),
        fetch(`${DB}/tenantsPublic/${tid}.json?${auth}`),
      ]);
      if (!st.ok) throw new Error(`firebase read ${st.status}`);
      return {
        bruto: await st.json(),
        etag: st.headers.get('ETag'),
        config: cf.ok ? (await cf.json()) || {} : {},
        pub: pub.ok ? (await pub.json()) || {} : {},
      };
    },
    async gravar(tid, dados, etag) {
      const res = await fetch(`${DB}/tenants/${tid}/state.json?${auth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'if-match': etag || 'null_etag' },
        body: JSON.stringify(dados),
      });
      if (res.status === 412) return { conflito: true };
      if (!res.ok) throw new Error(`firebase write ${res.status}`);
      return { conflito: false };
    },
  };
}

// ---- Handler do aluno (puro em relação ao Firebase: recebe `deps`) ----
export function criarHandlerAluno(deps) {
  return async function (request, url) {
    let fonte;
    if (request.method === 'GET') {
      fonte = { e: url.searchParams.get('e'), c: url.searchParams.get('c') };
    } else if (request.method === 'POST') {
      const texto = await request.text();
      if (texto.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
      try { fonte = JSON.parse(texto || '{}'); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    } else {
      return json({ erro: 'Método não suportado.' }, 405);
    }

    const tid = fonte.e;
    const codigo = fonte.c;
    if (!ehSlug(tid) || !ehCodigo(codigo)) return json({ erro: 'Link inválido.' }, 400);

    const { bruto, etag, config, pub } = await deps.lerTudo(tid);
    const state = normalizeState(bruto);
    const acesso = (state.acessos || []).find((a) => String(a.codigo) === String(codigo));
    // Mesma resposta para código errado e escola inexistente: não confirmamos
    // quais escolas existem para quem está chutando link.
    if (!acesso) return json({ erro: 'Link inválido ou desativado.' }, 403);

    const responder = (s) => json({
      fatia: fatiaAluno(s, config, acesso),
      config: { regras: config.regras || {}, vocab: config.vocab || {}, calendario: config.calendario || {} },
      escola: { nome: pub.nome || tid },
    });

    if (request.method === 'GET') return responder(state);

    const check = acaoDoAluno(fonte.acao, acesso, state, config);
    if (!check.ok) return json({ erro: check.erro }, 403);

    const proximo = reducer(state, check.acao, config);
    if (proximo === state) return responder(state); // nada mudou

    const gravado = { ...proximo, _updatedAt: Date.now() };
    const r = await deps.gravar(tid, gravado, etag);
    if (r.conflito) return json({ erro: 'A escola mudou enquanto você decidia. Tente de novo.' }, 409);
    return responder(normalizeState(gravado));
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/aluno') {
      if (!env.FIREBASE_DB_SECRET) {
        // Ainda não configurado: mensagem clara em vez de erro 500. O app do
        // aluno mostra isto; o app do professor não depende disto para nada.
        return json({ erro: 'O acesso do aluno ainda não foi ativado nesta escola.' }, 503);
      }
      try {
        return await criarHandlerAluno(depsFirebase(env))(request, url);
      } catch (e) {
        return json({ erro: 'Erro no servidor.' }, 500);
      }
    }

    // Todo o resto é o app (SPA servida pelos assets).
    return env.ASSETS.fetch(request);
  },
};
