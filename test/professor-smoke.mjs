// Equipe da escola (worker/professor.js): o dono cadastra professores com
// nome, e-mail e PIN de 4 números; cada um ganha uma conta (/contas) e entra
// pela mesma tela do dono (worker/conta.js).
//
// O banco e o Identity Toolkit são de mentira: nada sai para a rede. O que
// importa provar: só o dono gere a equipe, o PIN nunca fica em texto puro nem
// onde um membro lê, o professor criado entra de verdade, e o dono de uma
// escola não consegue trocar o PIN de uma conta que é de outra escola.

import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { criarHandlerProfessor } from '../worker/professor.js';
import { criarHandlerConta } from '../worker/conta.js';
import { criarCustomToken } from '../worker/firebaseAuth.js';
import { hashSegredo, confereSegredo, ehUidProfessor } from '../src/domain/pin.js';
import { chaveDoEmail, hashPinConta } from '../src/domain/conta.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

{
  const reg = await hashSegredo('4829');
  checar('hash não contém o PIN', !JSON.stringify(reg).includes('4829'));
  checar('PIN certo confere', await confereSegredo('4829', reg));
  checar('PIN errado não confere', !(await confereSegredo('4828', reg)));
  checar('mesmo PIN, sal diferente, hash diferente', reg.hash !== (await hashSegredo('4829')).hash);
  checar('registro vazio não confere', !(await confereSegredo('4829', null)));
}

// ---- Custom token ----
{
  const par = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const pkcs8 = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', par.privateKey));
  let b = '';
  for (const x of pkcs8) b += String.fromCharCode(x);
  const sa = { client_email: 'sa@aviz.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(b)}\n-----END PRIVATE KEY-----\n` };
  const tok = await criarCustomToken(JSON.stringify(sa), 'prof-abc', { tid: 'escola' }, 1_700_000_000_000);
  const [h, c, sig] = tok.split('.');
  const dec = (seg) => JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
  const claims = dec(c);
  checar('custom token: aud do Identity Toolkit', claims.aud === 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
  checar('custom token: iss e sub são a conta de serviço', claims.iss === sa.client_email && claims.sub === sa.client_email);
  checar('custom token: leva o uid', claims.uid === 'prof-abc');
  checar('custom token: expira em até 1h', claims.exp - claims.iat === 3600);
  checar('custom token: claims extras', claims.claims && claims.claims.tid === 'escola');
  const ok = await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', par.publicKey, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${h}.${c}`));
  checar('custom token: assinatura confere', ok);
}

// ---- Handler ----
const DONO = 'uid-dono';
const TOKEN_DONO = 'id-token-dono';

function fakeDeps() {
  const banco = {
    tenants: {
      escola: { members: { [DONO]: { role: 'owner', nome: 'Pedro' } } },
      outra: { members: { 'uid-dona-outra': { role: 'owner', nome: 'Bia' } } },
    },
  };
  const ler = (caminho) => caminho.split('/').reduce((o, k) => (o == null ? null : o[k] ?? null), banco);
  const deps = {
    banco,
    agora: () => 1_000_000,
    ler: async (c) => { const v = ler(c); return v == null ? null : JSON.parse(JSON.stringify(v)); },
    lerChaves: async (c) => { const v = ler(c); return v ? Object.fromEntries(Object.keys(v).map((k) => [k, true])) : null; },
    lerMembros: async (tid) => ler(`tenants/${tid}/members`),
    atualizar: async (updates) => {
      for (const [caminho, v] of Object.entries(updates)) {
        const partes = caminho.split('/');
        const ultima = partes.pop();
        let o = banco;
        for (const p of partes) { o[p] = o[p] || {}; o = o[p]; }
        if (v == null) delete o[ultima]; else o[ultima] = JSON.parse(JSON.stringify(v));
      }
    },
    uidDoIdToken: async (t) => ({ [TOKEN_DONO]: DONO, 'id-token-dona-outra': 'uid-dona-outra', 'id-token-prof': 'prof-qualquer' }[t] || null),
    usuarioDoIdToken: async () => null,
    criarToken: async (uid) => `token:${uid}`,
  };
  return deps;
}

const post = (corpo) => ({ method: 'POST', text: async () => JSON.stringify(corpo) });
const corpoDe = async (r) => JSON.parse(await r.text());
const entrar = async (deps, email, pin) => {
  const h = criarHandlerConta(deps);
  const r = await h(new Request('https://x.dev/api/conta', { method: 'POST', body: JSON.stringify({ op: 'entrar', email, pin }) }));
  return { status: r.status, d: await r.json() };
};

{
  const deps = fakeDeps();
  const h = criarHandlerProfessor(deps);
  const novoAna = { op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Ana', email: 'Ana@Exemplo.com', pin: '4829' };

  // Só o dono cria
  let r = await h(post({ ...novoAna, idToken: undefined }));
  checar('criar sem ID token = 403', r.status === 403);
  r = await h(post({ ...novoAna, idToken: 'id-token-prof' }));
  checar('criar com token de quem não é dono = 403', r.status === 403);
  r = await h(post({ ...novoAna, email: '' }));
  checar('professor novo sem e-mail = 400', r.status === 400);
  r = await h(post({ ...novoAna, pin: '482915' }));
  checar('PIN de 6 números é recusado', r.status === 400);
  r = await h(post({ ...novoAna, pin: '1234' }));
  checar('PIN fraco é recusado', r.status === 400);
  r = await h(post({ ...novoAna, pin: undefined }));
  checar('professor novo sem PIN = 400', r.status === 400);
  r = await h(post(novoAna));
  checar('dono cria professor', r.status === 200, String(r.status));
  const { id: idAna } = await corpoDe(r);
  checar('uid do professor tem o formato certo', ehUidProfessor(idAna), idAna);

  const membroAna = deps.banco.tenants.escola.members[idAna];
  checar('membro criado com papel, nome e e-mail', membroAna.role === 'professor' && membroAna.nome === 'Ana' && membroAna.email === 'ana@exemplo.com');
  const chaveAna = await chaveDoEmail('ana@exemplo.com');
  checar('conta criada para o e-mail, marcada como desta escola', deps.banco.contas[chaveAna].uid === idAna && deps.banco.contas[chaveAna].criadaPor === 'escola');
  checar('PIN não está em texto puro em lugar nenhum', !JSON.stringify(deps.banco).includes('4829'));

  r = await entrar(deps, 'ana@exemplo.com', '4829');
  checar('professor entra com e-mail + PIN', r.status === 200 && r.d.token === `token:${idAna}`);
  checar('e cai na escola certa, como professor', r.d.escolas.length === 1 && r.d.escolas[0].e === 'escola' && r.d.escolas[0].papel === 'professor');

  r = await h(post({ ...novoAna, nome: 'ana ', email: 'outra@exemplo.com', pin: '7391' }));
  checar('nome repetido é recusado', r.status === 409);
  r = await h(post({ ...novoAna, nome: 'Ana Clara' }));
  checar('mesmo e-mail duas vezes é recusado', r.status === 409);

  // Trocar PIN e nome
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: idAna, pin: '7391' }));
  checar('dono troca o PIN do professor', r.status === 200 && deps.banco.tenants.escola.members[idAna].nome === 'Ana');
  checar('PIN antigo deixa de valer', (await entrar(deps, 'ana@exemplo.com', '4829')).status === 403);
  checar('PIN novo vale', (await entrar(deps, 'ana@exemplo.com', '7391')).status === 200);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: idAna, nome: 'Ana Souza', email: 'troca@exemplo.com' }));
  checar('editar troca o nome e mantém o e-mail', r.status === 200
    && deps.banco.tenants.escola.members[idAna].nome === 'Ana Souza' && deps.banco.tenants.escola.members[idAna].email === 'ana@exemplo.com');

  // Pessoa que já tem conta (a dona da outra escola vira professora aqui)
  const chaveBia = await chaveDoEmail('bia@exemplo.com');
  await deps.atualizar({ [`contas/${chaveBia}`]: { uid: 'uid-dona-outra', email: 'bia@exemplo.com', pin: await hashPinConta('5173') } });
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Bia', email: 'bia@exemplo.com', pin: '9046' }));
  const resBia = await corpoDe(r);
  checar('e-mail com conta: entra na equipe com o uid dela', r.status === 200 && resBia.id === 'uid-dona-outra' && deps.banco.tenants.escola.members['uid-dona-outra'].role === 'professor');
  checar('e-mail com conta: avisa que ela usa o PIN que já tem', /PIN que já usa/.test(resBia.aviso || ''));
  checar('dono NÃO troca o PIN de conta de outra escola', (await entrar(deps, 'bia@exemplo.com', '9046')).status === 403);
  r = await entrar(deps, 'bia@exemplo.com', '5173');
  checar('ela entra com o PIN dela e vê as duas escolas', r.status === 200 && r.d.escolas.map((x) => x.e).sort().join() === 'escola,outra');
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Pedro 2', email: 'x@exemplo.com', pin: '6082' }));
  const chaveX = await chaveDoEmail('x@exemplo.com');
  await deps.atualizar({ [`contas/${chaveX}/uid`]: DONO });
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Outro', email: 'x@exemplo.com', pin: '6082' }));
  checar('e-mail do próprio dono não vira professor', r.status === 409);

  // Professor antigo (nome + PIN de 6 números, sem e-mail) ganha e-mail
  const antigo = 'prof-aaaaaaaaaaaaaaaaaaaa';
  await deps.atualizar({ [`tenants/escola/members/${antigo}`]: { role: 'professor', nome: 'Caio', temPin: true }, [`pinsProfessor/escola/${antigo}`]: { hash: 'h' } });
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: antigo, nome: 'Caio' }));
  checar('professor antigo sem e-mail: editar pede e-mail', r.status === 400);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: antigo, nome: 'Caio', email: 'caio@exemplo.com' }));
  checar('professor antigo: e-mail sem PIN novo = 400', r.status === 400);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: antigo, nome: 'Caio', email: 'caio@exemplo.com', pin: '3958' }));
  checar('professor antigo ganha conta com o mesmo uid', r.status === 200 && (await corpoDe(r)).id === antigo);
  checar('professor antigo entra com e-mail + PIN', (await entrar(deps, 'caio@exemplo.com', '3958')).status === 200);

  // Não mexe no dono pelo caminho de professor
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: DONO, nome: 'X', pin: '7391' }));
  checar('não edita o dono como professor', r.status === 404 && deps.banco.tenants.escola.members[DONO].role === 'owner');
  r = await h(post({ op: 'remover', e: 'escola', idToken: TOKEN_DONO, id: DONO }));
  checar('não remove o dono', r.status === 404 && !!deps.banco.tenants.escola.members[DONO]);

  // Remover
  r = await h(post({ op: 'remover', e: 'escola', idToken: 'id-token-prof', id: idAna }));
  checar('remover sem ser dono = 403', r.status === 403);
  r = await h(post({ op: 'remover', e: 'escola', idToken: TOKEN_DONO, id: idAna }));
  checar('dono remove professor', r.status === 200 && !deps.banco.tenants.escola.members[idAna]);
  r = await entrar(deps, 'ana@exemplo.com', '7391');
  checar('removido entra, mas sem escola nenhuma', r.status === 200 && r.d.escolas.length === 0);

  // Dono de uma escola não mexe na equipe da outra
  r = await h(post({ op: 'remover', e: 'outra', idToken: TOKEN_DONO, id: 'uid-dona-outra' }));
  checar('dono não mexe em outra escola', r.status === 403);

  // Encanamento
  checar('GET = 405', (await h({ method: 'GET' })).status === 405);
  checar('escola inválida = 400', (await h(post({ op: 'salvar', e: 'Escola!' }))).status === 400);
  checar('operação desconhecida = 400', (await h(post({ op: 'toString', e: 'escola' }))).status === 400);
  checar('login antigo por nome + PIN não existe mais', (await h(post({ op: 'entrar', e: 'escola', id: antigo, pin: '482915' }))).status === 400);
}

// ---- Regras do Firebase: nenhum cliente lê PIN nem tentativas ----
{
  const regras = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  // O único acesso de cliente permitido é o dono APAGAR o nó ao excluir a
  // escola (ver docs/juridico.md): nada de leitura, nada de gravar valor.
  const soApagar = (no) => {
    if (!no) return true;
    const txt = JSON.stringify(no);
    const w = no.$tid && no.$tid['.write'];
    return !/"\.read"/.test(txt) && Object.keys(no).every((k) => k === '$tid')
      && Object.keys(no.$tid || {}).every((k) => k === '.write')
      && (!w || (w.includes('!newData.exists()') && w.includes("== 'owner'")));
  };
  checar('regras não liberam /pinsProfessor', soApagar(regras.pinsProfessor) && regras['.read'] !== true);
  checar('regras não liberam /pinTentativas', soApagar(regras.pinTentativas));
  checar('regras não liberam /contas nem /loginTentativas', !regras.contas && !regras.loginTentativas && !regras['.read'] && !regras['.write']);
}

console.log(falhas ? `\n❌ ${falhas} falha(s) na equipe` : '\n✅ equipe (e-mail + PIN) ok');
process.exit(falhas ? 1 : 0);
