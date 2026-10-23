// Criação de escola (só admin) e convite do dono (worker/escola.js).
//
// Banco e Identity Toolkit de mentira. O que importa provar: só o admin cria;
// a escola nasce com um convite de uso único; quem abre o convite escolhe o
// PIN, aceita os Termos e vira dono (e entra de verdade com e-mail + PIN);
// o convite não troca o PIN de quem já tem conta; ninguém toma escola que já
// existe.

import { webcrypto } from 'node:crypto';
import { criarHandlerEscola, MARCADOR, VALIDADE_CONVITE_MS } from '../worker/escola.js';
import { criarHandlerConta } from '../worker/conta.js';
import { chaveDoEmail, hashPinConta } from '../src/domain/conta.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

function montar() {
  const raiz = {};
  const pegar = (c) => c.split('/').reduce((n, k) => (n == null ? undefined : n[k]), raiz);
  const por = (c, v) => {
    const ks = c.split('/');
    let n = raiz;
    for (const k of ks.slice(0, -1)) { if (typeof n[k] !== 'object' || n[k] === null) n[k] = {}; n = n[k]; }
    if (v === null) delete n[ks.at(-1)]; else n[ks.at(-1)] = JSON.parse(JSON.stringify(v));
  };
  const relogio = { t: 1_000_000 };
  const usuarios = { 'tok-pedro': { uid: 'uid-pedro' }, 'tok-outro': { uid: 'uid-outro' } };
  const deps = {
    agora: () => relogio.t,
    ler: async (c) => { const v = pegar(c); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    lerChaves: async (c) => { const v = pegar(c); return v ? Object.fromEntries(Object.keys(v).map((k) => [k, true])) : null; },
    atualizar: async (u) => { for (const [c, v] of Object.entries(u)) por(c, v); },
    usuarioDoIdToken: async (t) => usuarios[t] || null,
    criarToken: async (uid) => `token:${uid}`,
  };
  por('admins/uid-pedro', true);
  const h = criarHandlerEscola(deps);
  const pedir = async (corpo) => {
    const r = await h(new Request('https://x/api/escola', { method: 'POST', body: JSON.stringify(corpo) }));
    return { status: r.status, d: await r.json() };
  };
  const entrar = async (email, pin) => {
    const r = await criarHandlerConta(deps)(new Request('https://x/api/conta', { method: 'POST', body: JSON.stringify({ op: 'entrar', email, pin }) }));
    return { status: r.status, d: await r.json() };
  };
  return { raiz, pegar, por, pedir, entrar, relogio };
}

const config = { vocab: { aluno: 'aluno' }, regras: { capacidadeNominal: 6 }, criadoEm: '2026-10-14', intruso: 1 };
const criar = (extra = {}) => ({ op: 'criar', idToken: 'tok-pedro', e: 'atelie-sol', email: 'Ana@Exemplo.com', nomeEscola: 'Ateliê Sol', artigo: 'o', donoNome: 'Ana', config, ...extra });

{
  const m = montar();
  checar('Pedro é admin', (await m.pedir({ op: 'souAdmin', idToken: 'tok-pedro' })).d.admin === true);
  checar('outro não é admin', (await m.pedir({ op: 'souAdmin', idToken: 'tok-outro' })).d.admin === false);
  checar('sem login não é admin', (await m.pedir({ op: 'souAdmin' })).d.admin === false);

  let r = await m.pedir(criar({ idToken: undefined }));
  checar('criar sem login = 403', r.status === 403 && !m.raiz.tenantsPublic);
  r = await m.pedir(criar({ idToken: 'tok-outro' }));
  checar('criar sem ser admin = 403', r.status === 403 && !m.raiz.tenantsPublic);
  r = await m.pedir(criar({ email: 'sem-arroba' }));
  checar('e-mail inválido = 400', r.status === 400);
  r = await m.pedir(criar({ config: { vocab: 1 } }));
  checar('config incompleto = 400', r.status === 400);

  r = await m.pedir(criar());
  checar('admin cria a escola', r.status === 200 && r.d.e === 'atelie-sol');
  const convite = r.d.convite;
  checar('convite é um segredo longo', /^[0-9a-f]{48}$/.test(convite));
  checar('escola nasce com nome público', m.pegar('tenantsPublic/atelie-sol/nome') === 'Ateliê Sol');
  checar('config limpo (sem chave intrusa)', !('intruso' in m.pegar('tenants/atelie-sol/config')));
  checar('escola nasce sem dono, com o marcador', Object.keys(m.pegar('tenants/atelie-sol/members')).join() === MARCADOR);
  checar('convite guarda escola e e-mail', m.pegar(`convites/${convite}/e`) === 'atelie-sol' && m.pegar(`convites/${convite}/email`) === 'ana@exemplo.com');

  r = await m.pedir(criar({ email: 'outra@exemplo.com' }));
  checar('ninguém cria em cima de escola que existe', r.status === 409);

  r = await m.pedir({ op: 'convites', idToken: 'tok-pedro' });
  checar('admin vê os convites pendentes', r.status === 200 && r.d.convites.length === 1 && r.d.convites[0].nome === 'Ateliê Sol');
  checar('outro não vê os convites', (await m.pedir({ op: 'convites', idToken: 'tok-outro' })).status === 403);

  r = await m.pedir({ op: 'verConvite', convite });
  checar('convite mostra escola, e-mail e que não há conta', r.status === 200 && r.d.escola === 'Ateliê Sol' && r.d.email === 'ana@exemplo.com' && r.d.temConta === false);
  checar('convite inventado = 404', (await m.pedir({ op: 'verConvite', convite: 'f'.repeat(48) })).status === 404);
  checar('convite com formato errado = 404', (await m.pedir({ op: 'verConvite', convite: '../admins' })).status === 404);

  r = await m.pedir({ op: 'aceitarConvite', convite, pin: '4829' });
  checar('sem aceitar os Termos não entra', r.status === 400 && !m.pegar('contas'));
  r = await m.pedir({ op: 'aceitarConvite', convite, pin: '1234', aceite: true });
  checar('PIN fraco é recusado', r.status === 400);
  r = await m.pedir({ op: 'aceitarConvite', convite, pin: '4829', aceite: true, versao: 'v-teste' });
  checar('aceitar o convite entra (token)', r.status === 200 && r.d.e === 'atelie-sol' && /^token:dono-/.test(r.d.token));
  const uid = r.d.token.slice('token:'.length);
  const membros = m.pegar('tenants/atelie-sol/members');
  checar('vira dono, e o marcador sai', membros[uid].role === 'owner' && membros[uid].nome === 'Ana' && !membros[MARCADOR]);
  checar('aceite dos Termos registrado', m.pegar('tenants/atelie-sol/config/aceite/versao') === 'v-teste');
  checar('PIN não fica em texto puro', !JSON.stringify(m.raiz).includes('"4829"'));
  checar('convite some depois de usado', !m.pegar(`convites/${convite}`));
  checar('convite não vale duas vezes', (await m.pedir({ op: 'aceitarConvite', convite, pin: '5173', aceite: true })).status === 404);

  r = await m.entrar('ana@exemplo.com', '4829');
  checar('dono entra com e-mail + PIN e cai na escola', r.status === 200 && r.d.escolas.length === 1 && r.d.escolas[0].e === 'atelie-sol' && r.d.escolas[0].papel === 'owner');

  // Quem já tem conta: o convite não troca o PIN.
  const chave = await chaveDoEmail('bia@exemplo.com');
  m.por(`contas/${chave}`, { uid: 'uid-bia', email: 'bia@exemplo.com', pin: await hashPinConta('5173') });
  r = await m.pedir(criar({ e: 'estudio-lua', nomeEscola: 'Estúdio Lua', email: 'bia@exemplo.com', donoNome: 'Bia' }));
  const c2 = r.d.convite;
  checar('convite avisa que a pessoa já tem conta', (await m.pedir({ op: 'verConvite', convite: c2 })).d.temConta === true);
  r = await m.pedir({ op: 'aceitarConvite', convite: c2, pin: '9046', aceite: true });
  checar('quem já tem conta vira dono com o mesmo uid', r.status === 200 && m.pegar('tenants/estudio-lua/members/uid-bia/role') === 'owner');
  checar('o convite não troca o PIN de quem já tem conta', (await m.entrar('bia@exemplo.com', '9046')).status === 403 && (await m.entrar('bia@exemplo.com', '5173')).status === 200);

  // Convite vencido
  r = await m.pedir(criar({ e: 'velha', nomeEscola: 'Velha', email: 'v@exemplo.com' }));
  m.relogio.t += VALIDADE_CONVITE_MS + 1;
  checar('convite vencido não vale', (await m.pedir({ op: 'verConvite', convite: r.d.convite })).status === 404);
  checar('admin vê que venceu', (await m.pedir({ op: 'convites', idToken: 'tok-pedro' })).d.convites.find((x) => x.e === 'velha').vencido === true);

  // Encanamento
  checar('operação desconhecida = 400', (await m.pedir({ op: 'assumir' })).status === 400);
  checar('__proto__ não vira operação', (await m.pedir({ op: '__proto__' })).status === 400);
}

console.log(falhas ? `\n❌ ${falhas} falha(s) na criação de escola` : '\n✅ criação de escola e convite ok');
process.exit(falhas ? 1 : 0);
