// /api/escola — criação de escola (só administrador do AVIZ) e convite do dono.
//
// Fluxo (decisão do Pedro):
//   1. O Pedro (admin) responde o questionário e informa o e-mail do dono.
//      A escola nasce no banco com um CONVITE: um link secreto, de uso único.
//   2. O Pedro manda o link ao cliente. O cliente abre, aceita os Termos e
//      escolhe um PIN de 4 números: vira dono e já entra.
//   3. Dali em diante o dono entra com e-mail + PIN (worker/conta.js).
//
// Operações (sempre POST, corpo JSON com `op`):
//   souAdmin        logado → { idToken }                       → { admin }
//   criar           admin  → { idToken, e, email, nomeEscola, artigo, cor, donoNome, config }
//                                                              → { e, convite }
//   convites        admin  → { idToken }                       → { convites: [...] }
//   verConvite      público → { convite }                      → { escola, email, donoNome, temConta }
//   aceitarConvite  público → { convite, pin, aceite }         → { e, token }
//
// Admin = uid marcado em /admins/{uid} = true (o Pedro marca a própria conta
// no console do Firebase; as regras não liberam /admins para ninguém).
//
// Enquanto o convite não é aceito, a escola tem um membro-marcador
// (`_pendente`): assim a cláusula de bootstrap das regras ("primeiro membro
// numa escola vazia") não deixa outra conta qualquer tomar a escola.
//
// Puro em relação ao Firebase: tudo que toca o banco ou a rede vem em `deps`.

import {
  normalizarEmail, emailValido, problemaDoPinConta, chaveDoEmail, hashPinConta,
} from '../src/domain/conta.js';

const MAX_CORPO = 16 * 1024;
const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
const ehConvite = (s) => typeof s === 'string' && /^[0-9a-f]{48}$/.test(s);
const texto = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max;
const ehObjeto = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

export const MARCADOR = '_pendente';
// Convite não aceito vence depois disto (o Pedro gera outro criando de novo).
export const VALIDADE_CONVITE_MS = 30 * 24 * 60 * 60 * 1000;

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const novoConvite = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const novoUidDono = () => 'dono-' + hex(crypto.getRandomValues(new Uint8Array(10)));

// Só os campos que o questionário monta. Nada de chave inesperada no config.
function limparConfig(c) {
  if (!ehObjeto(c) || !ehObjeto(c.vocab) || !ehObjeto(c.regras)) return null;
  const out = { vocab: c.vocab, regras: c.regras };
  if (typeof c.criadoEm === 'string') out.criadoEm = c.criadoEm;
  return out;
}

export function criarHandlerEscola(deps) {
  const agora = () => (deps.agora ? deps.agora() : Date.now());

  async function ehAdmin(idToken) {
    if (typeof idToken !== 'string' || !idToken) return false;
    const u = await deps.usuarioDoIdToken(idToken);
    return !!u && /^[A-Za-z0-9_-]{1,128}$/.test(u.uid) && (await deps.ler(`admins/${u.uid}`)) === true;
  }

  async function conviteValido(token) {
    if (!ehConvite(token)) return null;
    const c = await deps.ler(`convites/${token}`);
    if (!c || !ehSlug(c.e) || agora() - (Number(c.criadoEm) || 0) > VALIDADE_CONVITE_MS) return null;
    return c;
  }

  const CONVITE_INVALIDO = 'Este convite não vale mais. Peça um novo a quem te enviou.';

  const ops = {
    async souAdmin(corpo) {
      return json({ admin: await ehAdmin(corpo.idToken) });
    },

    async criar(corpo) {
      if (!(await ehAdmin(corpo.idToken))) return json({ erro: 'Só a equipe do AVIZ cria escolas.' }, 403);
      const tid = corpo.e;
      if (!ehSlug(tid)) return json({ erro: 'Endereço inválido.' }, 400);
      const email = normalizarEmail(corpo.email);
      if (!emailValido(email)) return json({ erro: 'Informe o e-mail do responsável.' }, 400);
      if (!texto(corpo.nomeEscola, 80)) return json({ erro: 'Informe o nome do espaço.' }, 400);
      if (!texto(corpo.donoNome, 60)) return json({ erro: 'Informe o nome do responsável.' }, 400);
      const config = limparConfig(corpo.config);
      if (!config) return json({ erro: 'Respostas do formulário incompletas.' }, 400);
      if (await deps.ler(`tenantsPublic/${tid}`)) return json({ erro: 'Esse endereço já está em uso.' }, 409);

      const convite = novoConvite();
      await deps.atualizar({
        [`tenantsPublic/${tid}`]: {
          nome: corpo.nomeEscola.trim(),
          artigo: corpo.artigo === 'a' ? 'a' : 'o',
          cor: typeof corpo.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(corpo.cor) ? corpo.cor : '#2563eb',
        },
        [`tenants/${tid}/config`]: config,
        [`tenants/${tid}/members`]: { [MARCADOR]: { role: 'pendente' } },
        [`convites/${convite}`]: { e: tid, email, donoNome: corpo.donoNome.trim(), criadoEm: agora() },
      });
      return json({ e: tid, convite });
    },

    async convites(corpo) {
      if (!(await ehAdmin(corpo.idToken))) return json({ erro: 'Só a equipe do AVIZ vê os convites.' }, 403);
      const tokens = Object.keys((await deps.lerChaves('convites')) || {}).filter(ehConvite);
      const lista = await Promise.all(tokens.map(async (t) => {
        const c = await deps.ler(`convites/${t}`);
        if (!c || !ehSlug(c.e)) return null;
        const nome = await deps.ler(`tenantsPublic/${c.e}/nome`);
        return {
          convite: t, e: c.e, nome: (typeof nome === 'string' && nome) || c.e, email: c.email,
          criadoEm: c.criadoEm, vencido: agora() - (Number(c.criadoEm) || 0) > VALIDADE_CONVITE_MS,
        };
      }));
      return json({ convites: lista.filter(Boolean).sort((a, b) => b.criadoEm - a.criadoEm) });
    },

    async verConvite(corpo) {
      const c = await conviteValido(corpo.convite);
      if (!c) return json({ erro: CONVITE_INVALIDO }, 404);
      const [nome, conta] = await Promise.all([
        deps.ler(`tenantsPublic/${c.e}/nome`),
        deps.ler(`contas/${await chaveDoEmail(c.email)}`),
      ]);
      return json({ e: c.e, escola: (typeof nome === 'string' && nome) || c.e, email: c.email, donoNome: c.donoNome, temConta: !!(conta && conta.uid) });
    },

    async aceitarConvite(corpo) {
      const c = await conviteValido(corpo.convite);
      if (!c) return json({ erro: CONVITE_INVALIDO }, 404);
      if (corpo.aceite !== true) return json({ erro: 'Para entrar, aceite os Termos de Uso e a Política de Privacidade.' }, 400);

      const chave = await chaveDoEmail(c.email);
      const conta = await deps.ler(`contas/${chave}`);
      const updates = {};
      let uid;
      if (conta && conta.uid) {
        // Já tem conta no AVIZ: entra com o PIN que já usa. O convite não
        // troca o PIN de ninguém (quem tem o link não provou ser dono do e-mail).
        uid = conta.uid;
      } else {
        const problema = problemaDoPinConta(corpo.pin);
        if (problema) return json({ erro: problema }, 400);
        uid = novoUidDono();
        updates[`contas/${chave}`] = { uid, email: c.email, pin: await hashPinConta(corpo.pin), criadaPor: c.e, atualizadoEm: agora() };
      }
      Object.assign(updates, {
        [`tenants/${c.e}/members/${uid}`]: { role: 'owner', nome: c.donoNome || 'Responsável', email: c.email },
        [`tenants/${c.e}/members/${MARCADOR}`]: null,
        [`tenants/${c.e}/config/aceite`]: { versao: typeof corpo.versao === 'string' ? corpo.versao.slice(0, 40) : null, em: new Date(agora()).toISOString() },
        [`convites/${corpo.convite}`]: null,
      });
      await deps.atualizar(updates);
      return json({ e: c.e, token: await deps.criarToken(uid, {}) });
    },
  };

  return async function (request) {
    if (request.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);
    const bruto = await request.text();
    if (bruto.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
    let corpo;
    try { corpo = JSON.parse(bruto || '{}'); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    if (!ehObjeto(corpo)) return json({ erro: 'Pedido inválido.' }, 400);
    const op = Object.prototype.hasOwnProperty.call(ops, corpo.op) ? ops[corpo.op] : null;
    if (!op) return json({ erro: 'Operação desconhecida.' }, 400);
    return op(corpo);
  };
}
