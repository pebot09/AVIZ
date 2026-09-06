// Autenticação por conta de serviço (worker/firebaseAuth.js).
//
// A parte arriscada é a assinatura RS256 do JWT com WebCrypto. Aqui geramos um
// par de chaves de verdade, assinamos, e VERIFICAMOS a assinatura com a chave
// pública — se bate, o Google aceitaria. A troca do JWT por access_token é um
// fetch simples e é testada com um fetch de mentira. Nada sai para a rede.

import { webcrypto } from 'node:crypto';
import { criarJwt, getAccessToken, _resetTokenCache } from '../worker/firebaseAuth.js';

// WebCrypto global, como no Worker.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

function b64urlParaBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function jsonDoSegmento(seg) {
  return JSON.parse(new TextDecoder().decode(b64urlParaBytes(seg)));
}

// Gera um par RSA e exporta a privada como PEM PKCS8 (formato do service account).
const par = await webcrypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
const pkcs8 = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', par.privateKey));
let b64 = '';
for (let i = 0; i < pkcs8.length; i++) b64 += String.fromCharCode(pkcs8[i]);
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(b64).match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;

const sa = {
  client_email: 'firebase-adminsdk@aviz-cb3c8.iam.gserviceaccount.com',
  private_key: pem,
  token_uri: 'https://oauth2.googleapis.com/token',
};

const agora = 1_700_000_000_000;
const jwt = await criarJwt(sa, agora);

const [h, c, sig] = jwt.split('.');
checar('JWT tem três partes', !!h && !!c && !!sig);

const header = jsonDoSegmento(h);
checar('header é RS256/JWT', header.alg === 'RS256' && header.typ === 'JWT');

const claims = jsonDoSegmento(c);
checar('emissor é o e-mail da conta de serviço', claims.iss === sa.client_email);
checar('escopo inclui firebase.database', claims.scope.includes('firebase.database'));
checar('aud é o token endpoint', claims.aud === sa.token_uri);
checar('exp é 1h após iat', claims.exp - claims.iat === 3600);
checar('iat bate com o relógio dado', claims.iat === Math.floor(agora / 1000));

// A prova: a assinatura confere com a chave pública.
const okSig = await webcrypto.subtle.verify(
  'RSASSA-PKCS1-v1_5', par.publicKey, b64urlParaBytes(sig),
  new TextEncoder().encode(`${h}.${c}`),
);
checar('assinatura confere com a chave pública', okSig);

// Adulterar os claims invalida a assinatura (prova que não é decorativa).
const claimsFalsos = { ...claims, scope: 'roubar-tudo' };
const cFalso = btoa(JSON.stringify(claimsFalsos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const okAdulterado = await webcrypto.subtle.verify(
  'RSASSA-PKCS1-v1_5', par.publicKey, b64urlParaBytes(sig),
  new TextEncoder().encode(`${h}.${cFalso}`),
);
checar('assinatura rejeita claims adulterados', !okAdulterado);

// Troca por access_token + cache, com fetch de mentira.
{
  _resetTokenCache();
  let chamadas = 0;
  const fakeFetch = async () => { chamadas++; return { ok: true, json: async () => ({ access_token: 'tok-abc', expires_in: 3600 }) }; };
  const t1 = await getAccessToken(sa, fakeFetch, agora);
  const t2 = await getAccessToken(sa, fakeFetch, agora + 60_000); // dentro da validade
  checar('access_token é devolvido', t1 === 'tok-abc');
  checar('token é reaproveitado do cache', t2 === 'tok-abc' && chamadas === 1);
  const t3 = await getAccessToken(sa, fakeFetch, agora + 3600_000); // depois de expirar
  checar('reautentica quando o token expira', t3 === 'tok-abc' && chamadas === 2);
}

console.log(falhas ? `\n❌ ${falhas} falha(s) na autenticação` : '\n✅ autenticação por conta de serviço ok');
process.exit(falhas ? 1 : 0);
