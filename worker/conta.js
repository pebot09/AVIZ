// /api/conta — login por e-mail + PIN de 4 números.
//
// O Worker confere o PIN e devolve um custom token do Firebase para o uid da
// conta; o navegador troca isso por uma sessão normal (signInWithCustomToken).
// Daí em diante valem as mesmas regras de membro de sempre.
//
// Operações (sempre POST, corpo JSON com `op`):
//   entrar      público  → { email, pin }      → { token, escolas }
//   definirPin  logado   → { idToken, pin }    → { escolas }
//   escolas     logado   → { idToken }         → { escolas }
//
// "Esqueci meu PIN": a pessoa entra pelo link no e-mail (Firebase) e chama
// definirPin. Provar que é dona do e-mail basta para trocar o PIN daquela
// conta. Se a conta já existe, o uid dela é mantido (é ele que é membro das
// escolas), mesmo que o link tenha criado outro usuário no Firebase.
//
// Puro em relação ao Firebase: tudo que toca o banco ou a rede vem em `deps`.

import {
  normalizarEmail, emailValido, pinContaValido, problemaDoPinConta,
  chaveDoEmail, hashPinConta, conferePinConta,
  loginBloqueado, registrarErroLogin, minutosAteLiberarLogin,
} from '../src/domain/conta.js';

const MAX_CORPO = 8 * 1024;
const ehUid = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const ehSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s);

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const ERRO_LOGIN = 'E-mail ou PIN incorreto.';

export function criarHandlerConta(deps) {
  const agora = () => (deps.agora ? deps.agora() : Date.now());

  // Escolas em que o uid é membro, com o nome público. Varre as escolas: com
  // dezenas delas é barato; com milhares, trocar por um índice uid → escolas.
  async function escolasDe(uid) {
    const ids = Object.keys((await deps.lerChaves('tenants')) || {}).filter(ehSlug);
    const achadas = await Promise.all(ids.map(async (tid) => {
      const role = await deps.ler(`tenants/${tid}/members/${uid}/role`);
      if (role !== 'owner' && role !== 'professor') return null;
      const nome = await deps.ler(`tenantsPublic/${tid}/nome`);
      return { e: tid, nome: (typeof nome === 'string' && nome) || tid, papel: role };
    }));
    return achadas.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async function quemEsta(idToken) {
    if (typeof idToken !== 'string' || !idToken) return null;
    const u = await deps.usuarioDoIdToken(idToken);
    return u && ehUid(u.uid) ? u : null;
  }

  const ops = {
    async entrar(corpo) {
      if (!emailValido(corpo.email) || typeof corpo.pin !== 'string') return json({ erro: ERRO_LOGIN }, 403);
      const chave = await chaveDoEmail(corpo.email);
      const conta = await deps.ler(`contas/${chave}`);
      // E-mail sem conta: mesma resposta de PIN errado, sem gravar nada (senão
      // qualquer e-mail inventado viraria um registro no banco).
      if (!conta || !ehUid(conta.uid)) return json({ erro: ERRO_LOGIN }, 403);

      const t = await deps.ler(`loginTentativas/${chave}`);
      if (loginBloqueado(t, agora())) {
        return json({ erro: `Muitas tentativas erradas. Tente de novo em ${minutosAteLiberarLogin(t, agora())} min.` }, 429);
      }
      const ok = pinContaValido(corpo.pin) && await conferePinConta(corpo.pin, conta.pin);
      if (!ok) {
        await deps.atualizar({ [`loginTentativas/${chave}`]: registrarErroLogin(t, agora()) });
        return json({ erro: ERRO_LOGIN }, 403);
      }
      if (t) await deps.atualizar({ [`loginTentativas/${chave}`]: null });
      const [token, escolas] = await Promise.all([deps.criarToken(conta.uid, {}), escolasDe(conta.uid)]);
      return json({ token, escolas });
    },

    async definirPin(corpo) {
      const u = await quemEsta(corpo.idToken);
      if (!u) return json({ erro: 'Entre de novo.' }, 401);
      if (!u.email || !u.emailVerificado || !emailValido(u.email)) {
        return json({ erro: 'Entre pelo link enviado ao seu e-mail para criar o PIN.' }, 403);
      }
      const problema = problemaDoPinConta(corpo.pin);
      if (problema) return json({ erro: problema }, 400);

      const chave = await chaveDoEmail(u.email);
      const atual = await deps.ler(`contas/${chave}`);
      const uid = atual && ehUid(atual.uid) ? atual.uid : u.uid;
      await deps.atualizar({
        [`contas/${chave}`]: { uid, email: normalizarEmail(u.email), pin: await hashPinConta(corpo.pin), atualizadoEm: agora() },
        [`loginTentativas/${chave}`]: null,
      });
      // Se o uid da conta é outro (o link criou um usuário novo no Firebase),
      // devolve um token da conta certa para o navegador trocar de sessão.
      const token = uid !== u.uid ? await deps.criarToken(uid, {}) : null;
      return json({ escolas: await escolasDe(uid), ...(token ? { token } : {}) });
    },

    async escolas(corpo) {
      const u = await quemEsta(corpo.idToken);
      if (!u) return json({ erro: 'Entre de novo.' }, 401);
      return json({ escolas: await escolasDe(u.uid) });
    },
  };

  return async function (request) {
    if (request.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);
    const texto = await request.text();
    if (texto.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
    let corpo;
    try { corpo = JSON.parse(texto || '{}'); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return json({ erro: 'Pedido inválido.' }, 400);
    const op = Object.prototype.hasOwnProperty.call(ops, corpo.op) ? ops[corpo.op] : null;
    if (!op) return json({ erro: 'Operação desconhecida.' }, 400);
    return op(corpo);
  };
}
