// Autenticação do Worker no Firebase por conta de serviço.
//
// Projetos novos do Firebase não têm mais o "segredo do Realtime Database"
// (legado, aposentado). O jeito atual é uma conta de serviço: assinamos um JWT
// com a chave privada dela, trocamos por um access_token do Google, e usamos
// esse token para falar com o Realtime Database por REST — com acesso de
// administrador (ignora as regras), que é o que um servidor de confiança usa.
//
// Tudo roda no Worker com WebCrypto; a chave privada vive só na variável
// FIREBASE_SERVICE_ACCOUNT, nunca no navegador.

const ESCOPO = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';

function base64urlDeBytes(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Sem `unescape` (global legado que pode não existir no runtime da Cloudflare):
// codifica a string em bytes UTF-8 e reaproveita o base64url de bytes.
function base64urlDeString(str) {
  return base64urlDeBytes(new TextEncoder().encode(str));
}

async function importarChave(pemPkcs8) {
  const corpo = pemPkcs8
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(corpo);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

// Cria o JWT assinado (exportado para teste — dá para verificar a assinatura
// sem tocar na rede).
export async function criarJwt(sa, nowMs = Date.now()) {
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: ESCOPO,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  };
  const semAssinatura = `${base64urlDeString(JSON.stringify(header))}.${base64urlDeString(JSON.stringify(claims))}`;
  const chave = await importarChave(sa.private_key);
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(semAssinatura));
  return `${semAssinatura}.${base64urlDeBytes(assinatura)}`;
}

// Token em cache no módulo — vale ~1h, então não reassinamos a cada requisição.
let cache = { token: null, expira: 0 };

export async function getAccessToken(saJson, fetchImpl = fetch, nowMs = Date.now()) {
  if (cache.token && nowMs < cache.expira) return cache.token;
  const sa = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
  const jwt = await criarJwt(sa, nowMs);
  const resp = await fetchImpl(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!resp.ok) throw new Error(`token ${resp.status}`);
  const dados = await resp.json();
  cache = { token: dados.access_token, expira: nowMs + (Number(dados.expires_in) - 60) * 1000 };
  return cache.token;
}

// Só para testes: zera o cache entre casos.
export function _resetTokenCache() { cache = { token: null, expira: 0 }; }
