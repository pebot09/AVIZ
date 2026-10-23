// Login por e-mail + PIN de 4 números (worker/conta.js + src/domain/conta.js).
//
// Banco e Identity Toolkit de mentira: nada sai para a rede. O que importa:
// só o PIN certo vira sessão, o chute trava depois de 10 erros por e-mail,
// o PIN nunca fica em texto puro, "Esqueci meu PIN" mantém a conta (uid)
// certa, e o app acha as escolas da pessoa sozinho.

import { webcrypto } from 'node:crypto';
import { criarHandlerConta } from '../worker/conta.js';
import {
  pinContaValido, pinContaFraco, problemaDoPinConta, chaveDoEmail,
  MAX_ERROS_LOGIN, JANELA_LOGIN_MS,
} from '../src/domain/conta.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// ---- Regras do PIN ----
checar('PIN de 4 números é válido', pinContaValido('4829'));
checar('PIN de 6 números não serve aqui', !pinContaValido('482915'));
checar('PIN com letra é inválido', !pinContaValido('48a9'));
for (const fraco of ['0000', '1111', '1234', '4321', '7890']) checar(`${fraco} é fraco`, pinContaFraco(fraco));
checar('4829 não é fraco', !pinContaFraco('4829'));
checar('mensagem fala em 4 números', /4 números/.test(problemaDoPinConta('12')));

// ---- Banco de mentira ----
function montar() {
  const db = {};
  const pegar = (caminho) => caminho.split('/').reduce((o, k) => (o == null ? undefined : o[k]), db);
  const pôr = (caminho, valor) => {
    const partes = caminho.split('/');
    let o = db;
    for (const k of partes.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
    if (valor === null) delete o[partes.at(-1)]; else o[partes.at(-1)] = JSON.parse(JSON.stringify(valor));
  };
  const usuarios = {}; // idToken → { uid, email, emailVerificado }
  let relogio = 1_000_000;
  const tokens = [];
  const deps = {
    agora: () => relogio,
    ler: async (c) => { const v = pegar(c); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    lerChaves: async (c) => { const v = pegar(c); return v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).map((k) => [k, true])) : null; },
    atualizar: async (upd) => { for (const [c, v] of Object.entries(upd)) pôr(c, v); },
    usuarioDoIdToken: async (t) => usuarios[t] || null,
    criarToken: async (uid) => { tokens.push(uid); return `token-de-${uid}`; },
  };
  return { db, pôr, usuarios, deps, tokens, avançar: (ms) => { relogio += ms; } };
}

const pedir = (h, corpo) => h(new Request('https://x.dev/api/conta', { method: 'POST', body: JSON.stringify(corpo) }))
  .then(async (r) => ({ status: r.status, d: await r.json() }));

{
  const m = montar();
  const h = criarHandlerConta(m.deps);
  // Duas escolas: a Ana é dona de uma e professora da outra; uma terceira não é dela.
  m.pôr('tenants/atelie-sol/members/uid-ana', { role: 'owner', nome: 'Ana' });
  m.pôr('tenantsPublic/atelie-sol', { nome: 'Ateliê Sol' });
  m.pôr('tenants/estudio-lua/members/uid-ana', { role: 'professor', nome: 'Ana' });
  m.pôr('tenantsPublic/estudio-lua', { nome: 'Estúdio Lua' });
  m.pôr('tenants/outra/members/uid-bia', { role: 'owner', nome: 'Bia' });
  m.usuarios['tok-ana'] = { uid: 'uid-ana', email: 'Ana@Exemplo.com', emailVerificado: true };
  m.usuarios['tok-sem-verif'] = { uid: 'uid-x', email: 'x@exemplo.com', emailVerificado: false };

  let r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '4829' });
  checar('sem PIN criado, não entra', r.status === 403);
  checar('e-mail sem conta não grava tentativa', !m.db.loginTentativas);

  r = await pedir(h, { op: 'definirPin', idToken: 'tok-sem-verif', pin: '4829' });
  checar('criar PIN exige e-mail confirmado', r.status === 403);
  r = await pedir(h, { op: 'definirPin', idToken: 'tok-ana', pin: '1234' });
  checar('PIN fraco é recusado', r.status === 400);
  r = await pedir(h, { op: 'definirPin', idToken: 'tok-ana', pin: '4829' });
  checar('dona define o PIN', r.status === 200);
  const chave = await chaveDoEmail('ana@exemplo.com');
  checar('conta guardada pela chave do e-mail, com o uid dela', m.db.contas[chave].uid === 'uid-ana');
  checar('PIN não fica em texto puro', !JSON.stringify(m.db).includes('4829'));
  checar('definir PIN já devolve as escolas', r.d.escolas.length === 2);

  r = await pedir(h, { op: 'entrar', email: '  ANA@exemplo.com ', pin: '4829' });
  checar('PIN certo entra (e-mail sem diferença de maiúsculas/espaços)', r.status === 200 && r.d.token === 'token-de-uid-ana');
  checar('acha as duas escolas dela, com nome', r.d.escolas.map((x) => x.nome).join('|') === 'Ateliê Sol|Estúdio Lua');
  checar('diz o papel em cada escola', r.d.escolas.find((x) => x.e === 'estudio-lua').papel === 'professor');
  checar('não lista escola dos outros', !r.d.escolas.some((x) => x.e === 'outra'));

  // Trava: 10 erros → 15 min.
  for (let i = 0; i < MAX_ERROS_LOGIN; i++) r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '9999' });
  checar(`${MAX_ERROS_LOGIN}º erro ainda é "incorreto"`, r.status === 403);
  r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '4829' });
  checar('depois de 10 erros, nem o PIN certo entra', r.status === 429 && /min/.test(r.d.erro));
  m.avançar(JANELA_LOGIN_MS + 1);
  r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '4829' });
  checar('passados 15 min, entra de novo', r.status === 200);
  checar('acertar zera as tentativas', !m.db.loginTentativas || !m.db.loginTentativas[chave]);

  // 9 erros não travam.
  for (let i = 0; i < MAX_ERROS_LOGIN - 1; i++) await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '9999' });
  r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '4829' });
  checar('9 erros ainda deixam entrar', r.status === 200);

  // Esqueci meu PIN: o link criou outro usuário no Firebase (uid novo), mas a
  // conta continua sendo a da Ana (é esse uid que é membro das escolas).
  m.usuarios['tok-ana-novo'] = { uid: 'uid-novo', email: 'ana@exemplo.com', emailVerificado: true };
  r = await pedir(h, { op: 'definirPin', idToken: 'tok-ana-novo', pin: '5173' });
  checar('esqueci o PIN: mantém o uid da conta', r.status === 200 && m.db.contas[chave].uid === 'uid-ana');
  checar('esqueci o PIN: devolve sessão da conta certa', r.d.token === 'token-de-uid-ana');
  r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '4829' });
  checar('PIN antigo para de valer', r.status === 403);
  r = await pedir(h, { op: 'entrar', email: 'ana@exemplo.com', pin: '5173' });
  checar('PIN novo vale', r.status === 200);

  r = await pedir(h, { op: 'escolas', idToken: 'tok-ana' });
  checar('escolas: lista as da pessoa logada', r.status === 200 && r.d.escolas.length === 2);
  r = await pedir(h, { op: 'escolas', idToken: 'inventado' });
  checar('escolas: sem sessão, 401', r.status === 401);
  r = await pedir(h, { op: 'qualquer' });
  checar('operação desconhecida é recusada', r.status === 400);
  r = await pedir(h, { op: '__proto__' });
  checar('__proto__ não vira operação', r.status === 400);
}

console.log(falhas ? `\n❌ ${falhas} falha(s) no login por e-mail + PIN` : '\n✅ login por e-mail + PIN ok');
process.exit(falhas ? 1 : 0);
