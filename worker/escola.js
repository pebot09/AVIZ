// /api/escola — criação de uma escola nova pelo onboarding.
//
// Por que no servidor: o dono preenche o onboarding ANTES de ter login (o
// login é o link mágico no e-mail). Se as respostas ficassem só no navegador,
// abrir o link noutro aparelho (ou no navegador interno do app de e-mail)
// perdia tudo e o dono caía em "sem acesso". Aqui a escola já nasce salva no
// banco, presa ao e-mail informado; o dono só "assume" depois de provar, pelo
// login, que aquele e-mail é dele — em qualquer aparelho.
//
// Operações (sempre POST, corpo JSON com `op` e `e` = escola):
//   criar    público  → { email, nomeEscola, artigo, cor, donoNome, config }
//   assumir  logado   → { idToken }  vira dono se o e-mail do login bate
//
// Enquanto ninguém assumiu, a escola tem um membro-marcador (`_pendente`):
// assim a cláusula de bootstrap das regras ("primeiro membro numa escola
// vazia") não deixa outra conta qualquer tomar a escola antes do dono.
//
// Puro em relação ao Firebase: tudo que toca o banco ou a rede vem em `deps`.

const MAX_CORPO = 16 * 1024;
const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);
const ehEmail = (s) => typeof s === 'string' && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const texto = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= max;
const ehObjeto = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

export const MARCADOR = '_pendente';
// Escola criada e nunca assumida libera o endereço depois disto.
export const VALIDADE_PENDENTE_MS = 7 * 24 * 60 * 60 * 1000;
// Limite de escolas criadas por IP, para ninguém encher o banco de escolas.
export const MAX_CRIACOES = 10;
export const JANELA_CRIACOES_MS = 60 * 60 * 1000;

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function chaveDoIp(ip) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ip || 'sem-ip')));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Só os campos que o onboarding monta. Nada de chave inesperada no config.
function limparConfig(c) {
  if (!ehObjeto(c) || !ehObjeto(c.vocab) || !ehObjeto(c.regras)) return null;
  const out = { vocab: c.vocab, regras: c.regras };
  if (typeof c.criadoEm === 'string') out.criadoEm = c.criadoEm;
  if (ehObjeto(c.aceite)) out.aceite = c.aceite;
  return out;
}

export function criarHandlerEscola(deps) {
  const agora = () => (deps.agora ? deps.agora() : Date.now());

  const ops = {
    async criar(tid, corpo, request) {
      const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
      if (!ehEmail(email)) return json({ erro: 'Informe um e-mail válido.' }, 400);
      if (!texto(corpo.nomeEscola, 80)) return json({ erro: 'Informe o nome do espaço.' }, 400);
      if (!texto(corpo.donoNome, 60)) return json({ erro: 'Informe seu nome.' }, 400);
      const config = limparConfig(corpo.config);
      if (!config) return json({ erro: 'Respostas do formulário incompletas.' }, 400);

      const chave = await chaveDoIp(request.headers && request.headers.get && request.headers.get('CF-Connecting-IP'));
      const lim = await deps.ler(`limiteCriacao/${chave}`);
      const t = agora();
      const dentro = lim && t - lim.desde < JANELA_CRIACOES_MS;
      if (dentro && lim.n >= MAX_CRIACOES) return json({ erro: 'Muitas escolas criadas daqui. Tente mais tarde.' }, 429);

      // Endereço já usado? Só pode ser reaproveitado se for uma criação
      // pendente que venceu, ou do mesmo e-mail (refez o formulário porque o
      // e-mail não chegou).
      const [pub, pendente] = await Promise.all([deps.ler(`tenantsPublic/${tid}`), deps.ler(`escolasPendentes/${tid}`)]);
      if (pub) {
        const livre = pendente && (pendente.email === email || t - pendente.criadoEm > VALIDADE_PENDENTE_MS);
        if (!livre) return json({ erro: 'Esse endereço já está em uso.' }, 409);
      }

      await deps.atualizar({
        [`tenantsPublic/${tid}`]: {
          nome: corpo.nomeEscola.trim(),
          artigo: corpo.artigo === 'a' ? 'a' : 'o',
          cor: typeof corpo.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(corpo.cor) ? corpo.cor : '#2563eb',
        },
        [`tenants/${tid}/config`]: config,
        [`tenants/${tid}/members`]: { [MARCADOR]: { role: 'pendente' } },
        [`escolasPendentes/${tid}`]: {
          email,
          donoNome: corpo.donoNome.trim(),
          criadoEm: t,
        },
        [`limiteCriacao/${chave}`]: dentro ? { n: lim.n + 1, desde: lim.desde } : { n: 1, desde: t },
      });
      return json({ ok: true, e: tid });
    },

    async assumir(tid, corpo) {
      if (typeof corpo.idToken !== 'string' || !corpo.idToken) return json({ erro: 'Entre de novo.' }, 401);
      const quem = await deps.usuarioDoIdToken(corpo.idToken);
      if (!quem) return json({ erro: 'Entre de novo.' }, 401);
      const pendente = await deps.ler(`escolasPendentes/${tid}`);
      // Mesma resposta para "não existe" e "não é seu": não confirma e-mails.
      const erro = () => json({ erro: 'Nada para assumir nesta escola com este e-mail.' }, 404);
      if (!pendente) return erro();
      if (!quem.emailVerificado || (quem.email || '').toLowerCase() !== pendente.email) return erro();
      await deps.atualizar({
        [`tenants/${tid}/members/${quem.uid}`]: { role: 'owner', nome: pendente.donoNome },
        [`tenants/${tid}/members/${MARCADOR}`]: null,
        [`escolasPendentes/${tid}`]: null,
      });
      return json({ ok: true });
    },
  };

  return async function (request) {
    if (request.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);
    const bruto = await request.text();
    if (bruto.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
    let corpo;
    try { corpo = JSON.parse(bruto || '{}'); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    if (!ehObjeto(corpo)) return json({ erro: 'Pedido inválido.' }, 400);
    const tid = corpo.e;
    if (!ehSlug(tid)) return json({ erro: 'Endereço inválido.' }, 400);
    const op = Object.prototype.hasOwnProperty.call(ops, corpo.op) ? ops[corpo.op] : null;
    if (!op) return json({ erro: 'Operação desconhecida.' }, 400);
    return op(tid, corpo, request);
  };
}
