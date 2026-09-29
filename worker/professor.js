// /api/professor — login do professor por PIN e gestão da equipe pelo dono.
//
// O professor não tem e-mail, então não tem como entrar no Firebase Auth
// sozinho. O Worker confere o PIN e devolve um custom token do Firebase para
// aquele professor; o navegador troca isso por uma sessão normal
// (signInWithCustomToken), e daí em diante as MESMAS regras de membro valem
// para ele — sem mexer em database.rules.json.
//
// Operações (sempre POST, corpo JSON com `op` e `e` = escola):
//   listar   público  → nomes dos professores com PIN (para a tela de login)
//   entrar   público  → { id, pin } → { token }        (com limite de tentativas)
//   salvar   dono     → { idToken, id?, nome, pin? }   cria ou edita professor
//   remover  dono     → { idToken, id }
//
// "dono" = quem manda o ID token do Firebase de um membro com role 'owner'
// naquela escola. O Worker nunca confia no corpo para saber quem é quem.
//
// Puro em relação ao Firebase: tudo que toca o banco ou a rede vem em `deps`.

import {
  problemaDoPin, pinValido, hashPin, conferePin,
  estaBloqueado, registrarErro, minutosAteLiberar,
  novoUidProfessor, ehUidProfessor, nomeProfessorValido,
} from '../src/domain/pin.js';

const MAX_CORPO = 8 * 1024;
const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Chave do limite de tentativas: hash do IP (não guardamos o IP em si).
async function chaveDoIp(ip) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ip || 'sem-ip')));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const professoresDe = (membros) => Object.entries(membros || {})
  .filter(([uid, m]) => m && m.role === 'professor' && ehUidProfessor(uid));

export function criarHandlerProfessor(deps) {
  const agora = () => (deps.agora ? deps.agora() : Date.now());

  async function exigirDono(tid, idToken) {
    if (typeof idToken !== 'string' || !idToken) return null;
    const uid = await deps.uidDoIdToken(idToken);
    if (!uid) return null;
    const membros = await deps.lerMembros(tid);
    return membros && membros[uid] && membros[uid].role === 'owner' ? { uid, membros } : null;
  }

  const ops = {
    async listar(tid) {
      const membros = await deps.lerMembros(tid);
      const professores = professoresDe(membros)
        .filter(([, m]) => m.temPin)
        .map(([id, m]) => ({ id, nome: m.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return json({ professores });
    },

    async entrar(tid, corpo, request) {
      const chave = await chaveDoIp(request.headers && request.headers.get && request.headers.get('CF-Connecting-IP'));
      const t = await deps.lerTentativa(tid, chave);
      if (estaBloqueado(t, agora())) {
        return json({ erro: `Muitas tentativas erradas. Tente de novo em ${minutosAteLiberar(t, agora())} min.` }, 429);
      }
      const id = corpo.id;
      const pin = corpo.pin;
      let ok = false;
      if (ehUidProfessor(id) && pinValido(pin)) {
        const [membros, registro] = await Promise.all([deps.lerMembros(tid), deps.lerPin(tid, id)]);
        const m = membros && membros[id];
        ok = !!(m && m.role === 'professor' && await conferePin(pin, registro));
      }
      if (!ok) {
        await deps.gravarTentativa(tid, chave, registrarErro(t, agora()));
        return json({ erro: 'PIN incorreto.' }, 403);
      }
      if (t) await deps.gravarTentativa(tid, chave, null);
      return json({ token: await deps.criarToken(id, { tid, role: 'professor' }) });
    },

    async salvar(tid, corpo) {
      const dono = await exigirDono(tid, corpo.idToken);
      if (!dono) return json({ erro: 'Só o responsável pela escola pode fazer isso.' }, 403);

      const novo = !corpo.id;
      const id = novo ? novoUidProfessor() : corpo.id;
      const atual = novo ? null : dono.membros[id];
      if (!novo && !(ehUidProfessor(id) && atual && atual.role === 'professor')) {
        return json({ erro: 'Professor não encontrado.' }, 404);
      }

      const nome = corpo.nome === undefined && atual ? atual.nome : corpo.nome;
      if (!nomeProfessorValido(nome)) return json({ erro: 'Informe o nome (até 40 letras).' }, 400);
      const nomeLimpo = nome.trim();
      const repetido = professoresDe(dono.membros)
        .some(([uid, m]) => uid !== id && (m.nome || '').trim().toLowerCase() === nomeLimpo.toLowerCase());
      if (repetido) return json({ erro: 'Já existe alguém da equipe com esse nome.' }, 409);

      const pin = corpo.pin;
      if (novo || pin !== undefined) {
        const problema = problemaDoPin(pin);
        if (problema) return json({ erro: problema }, 400);
      }

      const updates = {
        [`tenants/${tid}/members/${id}`]: {
          role: 'professor',
          nome: nomeLimpo,
          temPin: true,
          criadoEm: (atual && atual.criadoEm) || agora(),
        },
      };
      if (pin !== undefined) updates[`pinsProfessor/${tid}/${id}`] = await hashPin(pin);
      await deps.atualizar(updates);
      return json({ id, nome: nomeLimpo });
    },

    async remover(tid, corpo) {
      const dono = await exigirDono(tid, corpo.idToken);
      if (!dono) return json({ erro: 'Só o responsável pela escola pode fazer isso.' }, 403);
      const id = corpo.id;
      const atual = dono.membros[id];
      if (!(ehUidProfessor(id) && atual && atual.role === 'professor')) {
        return json({ erro: 'Professor não encontrado.' }, 404);
      }
      // Sem o registro de membro, as regras barram a sessão que ele já tinha
      // aberta na hora — não precisa esperar o token do Firebase expirar.
      await deps.atualizar({ [`tenants/${tid}/members/${id}`]: null, [`pinsProfessor/${tid}/${id}`]: null });
      return json({ ok: true });
    },
  };

  return async function (request) {
    if (request.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);
    const texto = await request.text();
    if (texto.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
    let corpo;
    try { corpo = JSON.parse(texto || '{}'); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    if (!corpo || typeof corpo !== 'object') return json({ erro: 'Pedido inválido.' }, 400);

    const tid = corpo.e;
    if (!ehSlug(tid)) return json({ erro: 'Escola inválida.' }, 400);
    const op = Object.prototype.hasOwnProperty.call(ops, corpo.op) ? ops[corpo.op] : null;
    if (!op) return json({ erro: 'Operação desconhecida.' }, 400);
    return op(tid, corpo, request);
  };
}
