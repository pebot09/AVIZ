// Login do professor por PIN (worker/professor.js + src/domain/pin.js).
//
// O banco e o Identity Toolkit são de mentira: nada sai para a rede. O que
// importa provar aqui é quem consegue o quê — só o dono gere a equipe, só o PIN
// certo vira sessão, o chute às cegas trava, e o PIN nunca vai parar num lugar
// que um membro consegue ler.

import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { criarHandlerProfessor } from '../worker/professor.js';
import { criarCustomToken } from '../worker/firebaseAuth.js';
import {
  pinValido, pinFraco, problemaDoPin, hashPin, conferePin,
  estaBloqueado, registrarErro, MAX_ERROS, JANELA_MS, ehUidProfessor,
} from '../src/domain/pin.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// ---- Regras do PIN ----
checar('PIN de 6 números é válido', pinValido('482915'));
checar('PIN curto é inválido', !pinValido('4829'));
checar('PIN com letra é inválido', !pinValido('48291a'));
checar('PIN número (não string) é inválido', !pinValido(482915));
checar('000000 é fraco', pinFraco('000000'));
checar('123456 é fraco', pinFraco('123456'));
checar('654321 é fraco', pinFraco('654321'));
checar('482915 não é fraco', !pinFraco('482915'));
checar('problemaDoPin explica o tamanho', /6 números/.test(problemaDoPin('12')));

{
  const reg = await hashPin('482915');
  checar('hash não contém o PIN', !JSON.stringify(reg).includes('482915'));
  checar('PIN certo confere', await conferePin('482915', reg));
  checar('PIN errado não confere', !(await conferePin('482916', reg)));
  const reg2 = await hashPin('482915');
  checar('mesmo PIN, sal diferente, hash diferente', reg.hash !== reg2.hash);
  checar('registro vazio não confere', !(await conferePin('482915', null)));
}

{
  let t = null;
  for (let i = 0; i < MAX_ERROS; i++) t = registrarErro(t, 1000 + i);
  checar(`${MAX_ERROS} erros bloqueiam`, estaBloqueado(t, 2000));
  checar('bloqueio passa depois da janela', !estaBloqueado(t, 1000 + JANELA_MS + 1));
  checar('erro depois da janela recomeça a contagem', registrarErro(t, 1000 + JANELA_MS + 1).n === 1);
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
    tenants: { escola: { members: { [DONO]: { role: 'owner', nome: 'Pedro' } } } },
    pinsProfessor: {},
    pinTentativas: {},
  };
  let agora = 1_000_000;
  const ler = (caminho) => caminho.split('/').reduce((o, k) => (o == null ? null : o[k] ?? null), banco);
  return {
    banco,
    passar: (ms) => { agora += ms; },
    agora: () => agora,
    lerMembros: async (tid) => ler(`tenants/${tid}/members`),
    lerPin: async (tid, uid) => ler(`pinsProfessor/${tid}/${uid}`),
    lerTentativa: async (tid, k) => ler(`pinTentativas/${tid}/${k}`),
    gravarTentativa: async (tid, k, v) => {
      banco.pinTentativas[tid] = banco.pinTentativas[tid] || {};
      if (v == null) delete banco.pinTentativas[tid][k]; else banco.pinTentativas[tid][k] = v;
    },
    atualizar: async (updates) => {
      for (const [caminho, v] of Object.entries(updates)) {
        const partes = caminho.split('/');
        const ultima = partes.pop();
        let o = banco;
        for (const p of partes) { o[p] = o[p] || {}; o = o[p]; }
        if (v == null) delete o[ultima]; else o[ultima] = v;
      }
    },
    uidDoIdToken: async (t) => (t === TOKEN_DONO ? DONO : t === 'id-token-prof' ? 'prof-qualquer' : null),
    criarToken: async (uid, claims) => `token:${uid}:${claims.role}`,
  };
}

const ip = (x) => ({ get: (n) => (n === 'CF-Connecting-IP' ? x : null) });
const post = (corpo, deIp = '1.2.3.4') => ({ method: 'POST', headers: ip(deIp), text: async () => JSON.stringify(corpo) });
const corpoDe = async (r) => JSON.parse(await r.text());

{
  const deps = fakeDeps();
  const h = criarHandlerProfessor(deps);

  // Só o dono cria
  let r = await h(post({ op: 'salvar', e: 'escola', nome: 'Ana', pin: '482915' }));
  checar('criar sem ID token = 403', r.status === 403);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: 'id-token-prof', nome: 'Ana', pin: '482915' }));
  checar('criar com token de quem não é dono = 403', r.status === 403);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Ana', pin: '123456' }));
  checar('PIN fraco é recusado', r.status === 400);
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'Ana', pin: '482915' }));
  checar('dono cria professor', r.status === 200, String(r.status));
  const { id: idAna } = await corpoDe(r);
  checar('uid do professor tem o formato certo', ehUidProfessor(idAna), idAna);

  const membroAna = deps.banco.tenants.escola.members[idAna];
  checar('membro criado com papel professor', membroAna && membroAna.role === 'professor' && membroAna.nome === 'Ana');
  checar('PIN não está no registro de membro', !JSON.stringify(deps.banco.tenants).includes('482915') && !('pin' in membroAna) && !('hash' in membroAna));
  checar('hash guardado fora de /tenants', !!deps.banco.pinsProfessor.escola[idAna].hash);

  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, nome: 'ana ', pin: '739184' }));
  checar('nome repetido é recusado', r.status === 409);

  // Lista pública: só nomes de professores
  r = await h(post({ op: 'listar', e: 'escola' }));
  const lista = (await corpoDe(r)).professores;
  checar('listar traz o professor', lista.length === 1 && lista[0].nome === 'Ana' && lista[0].id === idAna);
  checar('listar não traz o dono', !JSON.stringify(lista).includes('Pedro'));

  // Entrar
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482915' }));
  checar('PIN certo devolve token', r.status === 200 && (await corpoDe(r)).token === `token:${idAna}:professor`);
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482916' }));
  checar('PIN errado = 403', r.status === 403);
  r = await h(post({ op: 'entrar', e: 'escola', id: DONO, pin: '482915' }));
  checar('não dá para entrar como o dono por PIN', r.status === 403);

  // Bloqueio por tentativas (o erro de cima já contou 2: PIN errado + dono)
  for (let i = 0; i < MAX_ERROS; i++) await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '000001' }, '9.9.9.9'));
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482915' }, '9.9.9.9'));
  checar('depois de muitos erros, nem o PIN certo entra (429)', r.status === 429, String(r.status));
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482915' }, '5.5.5.5'));
  checar('bloqueio é por endereço, não trava a escola toda', r.status === 200);
  deps.passar(JANELA_MS + 1);
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482915' }, '9.9.9.9'));
  checar('bloqueio expira', r.status === 200);
  checar('acerto zera as tentativas', !Object.keys(deps.banco.pinTentativas.escola).some((k) => deps.banco.pinTentativas.escola[k].n >= MAX_ERROS));

  // Trocar PIN
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: idAna, pin: '739184' }));
  checar('dono troca o PIN', r.status === 200);
  checar('nome mantido ao trocar só o PIN', deps.banco.tenants.escola.members[idAna].nome === 'Ana');
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '482915' }, '7.7.7.7'));
  checar('PIN antigo deixa de valer', r.status === 403);
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '739184' }, '7.7.7.7'));
  checar('PIN novo vale', r.status === 200);

  // Não mexe no dono pelo caminho de professor
  r = await h(post({ op: 'salvar', e: 'escola', idToken: TOKEN_DONO, id: DONO, nome: 'X', pin: '739184' }));
  checar('não edita o dono como professor', r.status === 404 && deps.banco.tenants.escola.members[DONO].role === 'owner');
  r = await h(post({ op: 'remover', e: 'escola', idToken: TOKEN_DONO, id: DONO }));
  checar('não remove o dono', r.status === 404 && !!deps.banco.tenants.escola.members[DONO]);

  // Remover
  r = await h(post({ op: 'remover', e: 'escola', idToken: 'id-token-prof', id: idAna }));
  checar('remover sem ser dono = 403', r.status === 403);
  r = await h(post({ op: 'remover', e: 'escola', idToken: TOKEN_DONO, id: idAna }));
  checar('dono remove professor', r.status === 200 && !deps.banco.tenants.escola.members[idAna] && !deps.banco.pinsProfessor.escola[idAna]);
  r = await h(post({ op: 'entrar', e: 'escola', id: idAna, pin: '739184' }, '8.8.8.8'));
  checar('removido não entra mais', r.status === 403);

  // Escola inexistente ou excluída: nada é gravado
  r = await h(post({ op: 'entrar', e: 'apagada', id: idAna, pin: '000001' }, '6.6.6.6'));
  checar('entrar em escola inexistente = 403', r.status === 403);
  checar('entrar em escola inexistente não grava tentativas', !deps.banco.pinTentativas.apagada && !deps.banco.tenants.apagada);
  r = await h(post({ op: 'salvar', e: 'apagada', idToken: TOKEN_DONO, nome: 'Zé', pin: '739184' }));
  checar('salvar em escola inexistente = 403 e não grava', r.status === 403 && !deps.banco.tenants.apagada && !deps.banco.pinsProfessor.apagada);

  // Encanamento
  checar('GET = 405', (await h({ method: 'GET', headers: ip('1') })).status === 405);
  checar('escola inválida = 400', (await h(post({ op: 'listar', e: 'Escola!' }))).status === 400);
  checar('operação desconhecida = 400', (await h(post({ op: 'toString', e: 'escola' }))).status === 400);
}

// ---- Regras do Firebase: nenhum cliente lê PIN nem tentativas ----
{
  const regras = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  checar('regras não liberam /pinsProfessor', !('pinsProfessor' in regras) && regras['.read'] !== true);
  checar('regras não liberam /pinTentativas', !('pinTentativas' in regras));
}

console.log(falhas ? `\n❌ ${falhas} falha(s) no login por PIN` : '\n✅ login por PIN ok');
process.exit(falhas ? 1 : 0);
