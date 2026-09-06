// Fatia do aluno no servidor.
//
// Por que existe: as regras do banco barram o aluno de propósito — ele não tem
// conta no Firebase, e dar leitura do estado da escola a quem tem um link
// entregaria os dados de todos os outros alunos. Então o aluno fala com esta
// função, que:
//   1. confere o código de acesso contra o estado da escola;
//   2. devolve só a fatia dele (src/domain/fatiaAluno.js);
//   3. aceita apenas a lista fechada de ações do aluno, sempre carimbando a
//      identidade a partir do código — nunca do que o cliente mandou.
//
// A lógica de domínio é a MESMA do app (importada, não copiada). Se servidor e
// cliente discordassem sobre as regras, cada divergência viraria um bug.

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

import { reducer, normalizeState } from '../../src/domain/reducer.js';
import { fatiaAluno, acaoDoAluno } from '../../src/domain/fatiaAluno.js';

initializeApp();

const MAX_CORPO = 64 * 1024;

function cors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  // A resposta é pessoal e depende do código: nunca deve ser cacheada.
  res.set('Cache-Control', 'no-store');
}

const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
const ehCodigo = (s) => typeof s === 'string' && /^\d{4,12}$/.test(s);

async function carregar(db, tid) {
  const [stSnap, cfSnap, pubSnap] = await Promise.all([
    db.ref(`tenants/${tid}/state`).get(),
    db.ref(`tenants/${tid}/config`).get(),
    db.ref(`tenantsPublic/${tid}`).get(),
  ]);
  return {
    bruto: stSnap.val(),
    state: normalizeState(stSnap.val()),
    config: cfSnap.val() || {},
    pub: pubSnap.val() || {},
  };
}

function acharAcesso(state, codigo) {
  return (state.acessos || []).find((a) => String(a.codigo) === String(codigo)) || null;
}

export const aluno = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const fonte = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const tid = fonte.e;
    const codigo = fonte.c;

    if (!ehSlug(tid) || !ehCodigo(codigo)) {
      return res.status(400).json({ erro: 'Link inválido.' });
    }
    if (req.method === 'POST' && JSON.stringify(req.body || {}).length > MAX_CORPO) {
      return res.status(413).json({ erro: 'Pedido grande demais.' });
    }

    const db = getDatabase();
    const { bruto, state, config, pub } = await carregar(db, tid);

    const acesso = acharAcesso(state, codigo);
    // Mesma resposta para código errado e escola inexistente: não confirmamos
    // quais escolas existem para quem está chutando link.
    if (!acesso) return res.status(403).json({ erro: 'Link inválido ou desativado.' });

    const responder = (s) => res.json({
      fatia: fatiaAluno(s, config, acesso),
      config: { regras: config.regras || {}, vocab: config.vocab || {}, calendario: config.calendario || {} },
      escola: { nome: pub.nome || tid },
    });

    if (req.method === 'GET') return responder(state);

    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não suportado.' });

    const check = acaoDoAluno(req.body && req.body.acao, acesso, state, config);
    if (!check.ok) return res.status(403).json({ erro: check.erro });

    // O autor já vem carimbado dentro da ação por acaoDoAluno.
    const proximo = reducer(state, check.acao, config);
    if (proximo === state) return responder(state); // nada mudou

    // Gravação condicional: se a escola mudou depois da leitura, aborta e
    // manda o cliente tentar de novo com o estado novo, em vez de sobrescrever.
    const base = Number(bruto && bruto._updatedAt) || 0;
    const ref = db.ref(`tenants/${tid}/state`);
    const tx = await ref.transaction((servidor) => {
      const versao = Number(servidor && servidor._updatedAt) || 0;
      if (versao > base) return undefined; // aborta
      return { ...proximo, _updatedAt: Date.now() };
    });

    if (!tx.committed) {
      return res.status(409).json({ erro: 'A escola mudou enquanto você decidia. Tente de novo.' });
    }
    return responder(normalizeState(tx.snapshot.val()));
  } catch (e) {
    console.error('[aluno]', e);
    return res.status(500).json({ erro: 'Erro no servidor.' });
  }
});
