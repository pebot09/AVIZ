// /api/professor — o dono gere a equipe da escola.
//
// Cada professor tem uma conta de e-mail + PIN de 4 números, igual à do dono
// (/contas, ver worker/conta.js), e entra pela mesma tela. Aqui o dono:
//   salvar   dono → { idToken, id?, nome, email?, pin? }   cria ou edita professor
//   remover  dono → { idToken, id }
//
// Regras da conta do professor:
//   - e-mail sem conta no AVIZ: cria a conta com o PIN que o dono definiu
//     (marcada com criadaPor = esta escola);
//   - e-mail que já tem conta: o professor entra com o PIN que já usa. O dono
//     só troca esse PIN se a conta foi criada por esta mesma escola — senão o
//     dono de uma escola poderia entrar como a pessoa em outra.
//   - professor antigo (sem e-mail): ao ganhar e-mail, passa a ter conta.
//
// "dono" = quem manda o ID token do Firebase de um membro com role 'owner'
// naquela escola. O Worker nunca confia no corpo para saber quem é quem.
//
// Puro em relação ao Firebase: tudo que toca o banco ou a rede vem em `deps`.

import { novoUidProfessor, ehUidProfessor, nomeProfessorValido } from '../src/domain/pin.js';
import {
  normalizarEmail, emailValido, problemaDoPinConta, chaveDoEmail, hashPinConta,
} from '../src/domain/conta.js';

const MAX_CORPO = 8 * 1024;
const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

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
    async salvar(tid, corpo) {
      const dono = await exigirDono(tid, corpo.idToken);
      if (!dono) return json({ erro: 'Só o responsável pela escola pode fazer isso.' }, 403);

      const novo = !corpo.id;
      const atual = novo ? null : dono.membros[corpo.id];
      if (!novo && !(atual && atual.role === 'professor')) return json({ erro: 'Professor não encontrado.' }, 404);

      const nome = corpo.nome === undefined && atual ? atual.nome : corpo.nome;
      if (!nomeProfessorValido(nome)) return json({ erro: 'Informe o nome (até 40 letras).' }, 400);
      const nomeLimpo = nome.trim();

      // O e-mail não muda depois de definido (para trocar, remova e adicione).
      const email = atual && atual.email ? atual.email : normalizarEmail(corpo.email);
      if (!emailValido(email)) return json({ erro: 'Informe o e-mail do professor.' }, 400);

      const pin = corpo.pin === '' ? undefined : corpo.pin;
      if (pin !== undefined) {
        const problema = problemaDoPinConta(pin);
        if (problema) return json({ erro: problema }, 400);
      }

      const chave = await chaveDoEmail(email);
      const conta = await deps.ler(`contas/${chave}`);
      const updates = {};
      let uid;
      let aviso = null;
      if (conta && conta.uid) {
        uid = conta.uid;
        if (pin !== undefined) {
          if (conta.criadaPor === tid) {
            updates[`contas/${chave}/pin`] = await hashPinConta(pin);
            updates[`loginTentativas/${chave}`] = null;
          } else {
            aviso = 'Essa pessoa já tinha conta no AVIZ: ela entra com o PIN que já usa. Se esqueceu, use "Esqueci meu PIN" na tela de entrada.';
          }
        }
      } else {
        if (pin === undefined) return json({ erro: 'Defina um PIN de 4 números.' }, 400);
        uid = !novo && ehUidProfessor(corpo.id) ? corpo.id : novoUidProfessor();
        updates[`contas/${chave}`] = { uid, email, pin: await hashPinConta(pin), criadaPor: tid, atualizadoEm: agora() };
      }

      const outro = dono.membros[uid];
      if (uid !== corpo.id && outro) {
        return json({ erro: outro.role === 'owner' ? 'Esse e-mail é do responsável pela escola.' : 'Essa pessoa já está na equipe.' }, 409);
      }
      const repetido = Object.entries(dono.membros)
        .some(([id, m]) => id !== corpo.id && id !== uid && m && (m.nome || '').trim().toLowerCase() === nomeLimpo.toLowerCase());
      if (repetido) return json({ erro: 'Já existe alguém da equipe com esse nome.' }, 409);

      // Professor antigo que ganhou e-mail de uma conta que já existia: o
      // membro passa para o uid da conta.
      if (!novo && uid !== corpo.id) {
        updates[`tenants/${tid}/members/${corpo.id}`] = null;
        updates[`pinsProfessor/${tid}/${corpo.id}`] = null;
      }
      updates[`tenants/${tid}/members/${uid}`] = {
        role: 'professor',
        nome: nomeLimpo,
        email,
        criadoEm: (atual && atual.criadoEm) || agora(),
      };
      await deps.atualizar(updates);
      return json({ id: uid, nome: nomeLimpo, ...(aviso ? { aviso } : {}) });
    },

    async remover(tid, corpo) {
      const dono = await exigirDono(tid, corpo.idToken);
      if (!dono) return json({ erro: 'Só o responsável pela escola pode fazer isso.' }, 403);
      const id = corpo.id;
      const atual = dono.membros[id];
      if (!(atual && atual.role === 'professor')) return json({ erro: 'Professor não encontrado.' }, 404);
      // Sem o registro de membro, as regras barram a sessão que ele já tinha
      // aberta na hora. A conta (e-mail + PIN) fica: pode estar em outra escola.
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
    return op(tid, corpo);
  };
}
