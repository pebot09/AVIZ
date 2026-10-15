// Criação de escola pelo onboarding (worker/escola.js).
//
// Banco e Identity Toolkit de mentira. O que importa provar: a escola nasce
// salva antes do login, só o dono do e-mail informado consegue assumi-la (em
// qualquer aparelho), e ninguém toma uma escola que já existe.

import { webcrypto } from 'node:crypto';
import { criarHandlerEscola, MARCADOR, MAX_CRIACOES, VALIDADE_PENDENTE_MS } from '../worker/escola.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

function bancoFalso() {
  const raiz = {};
  const pegar = (caminho) => caminho.split('/').reduce((n, k) => (n == null ? undefined : n[k]), raiz);
  const por = (caminho, valor) => {
    const ks = caminho.split('/');
    let n = raiz;
    for (const k of ks.slice(0, -1)) { if (typeof n[k] !== 'object' || n[k] === null) n[k] = {}; n = n[k]; }
    if (valor === null) delete n[ks[ks.length - 1]];
    else n[ks[ks.length - 1]] = JSON.parse(JSON.stringify(valor));
  };
  return { raiz, pegar, por };
}

function montar({ usuarios = {}, agora = 1_000_000 } = {}) {
  const b = bancoFalso();
  const relogio = { t: agora };
  const h = criarHandlerEscola({
    agora: () => relogio.t,
    ler: async (c) => { const v = b.pegar(c); return v === undefined ? null : v; },
    atualizar: async (u) => { for (const [c, v] of Object.entries(u)) b.por(c, v); },
    usuarioDoIdToken: async (tok) => usuarios[tok] || null,
  });
  const pedir = async (corpo, ip = '1.1.1.1') => {
    const req = new Request('https://x/api/escola', {
      method: 'POST', body: JSON.stringify(corpo), headers: { 'CF-Connecting-IP': ip },
    });
    const r = await h(req);
    return { status: r.status, dados: await r.json() };
  };
  return { b, pedir, relogio };
}

const config = { vocab: { aluno: 'aluno' }, regras: { capacidadeNominal: 6 }, criadoEm: '2026-10-14', aceite: { versao: 'x' }, intruso: 1 };
const criar = (extra = {}) => ({ op: 'criar', e: 'atelie-sol', email: 'Ana@Exemplo.com', nomeEscola: 'Ateliê Sol', artigo: 'o', donoNome: 'Ana', donoGenero: 'a', config, ...extra });

{
  const { b, pedir } = montar({
    usuarios: {
      'tok-ana': { uid: 'uid-ana', email: 'ana@exemplo.com', emailVerificado: true },
      'tok-outro': { uid: 'uid-x', email: 'x@exemplo.com', emailVerificado: true },
      'tok-nao-verif': { uid: 'uid-nv', email: 'ana@exemplo.com', emailVerificado: false },
    },
  });

  const r = await pedir(criar());
  checar('cria a escola antes do login', r.status === 200, JSON.stringify(r.dados));
  checar('vitrine pública gravada', b.pegar('tenantsPublic/atelie-sol/nome') === 'Ateliê Sol');
  checar('config gravado', b.pegar('tenants/atelie-sol/config/regras/capacidadeNominal') === 6);
  checar('config sem chave inesperada', b.pegar('tenants/atelie-sol/config/intruso') === undefined);
  checar('marcador bloqueia o bootstrap das regras', !!b.pegar(`tenants/atelie-sol/members/${MARCADOR}`));
  checar('e-mail fica fora de /tenants (membro não lê)', b.pegar('escolasPendentes/atelie-sol/email') === 'ana@exemplo.com');
  checar('nenhum dono ainda', !Object.values(b.pegar('tenants/atelie-sol/members')).some((m) => m.role === 'owner'));

  const outro = await pedir(criar({ email: 'x@exemplo.com' }));
  checar('outro e-mail não sobrescreve escola pendente', outro.status === 409);
  checar('e-mail original mantido', b.pegar('escolasPendentes/atelie-sol/email') === 'ana@exemplo.com');

  const refaz = await pedir(criar({ nomeEscola: 'Ateliê Sol!' }));
  checar('mesmo e-mail pode refazer o formulário', refaz.status === 200 && b.pegar('tenantsPublic/atelie-sol/nome') === 'Ateliê Sol!');

  checar('assumir sem token pede login', (await pedir({ op: 'assumir', e: 'atelie-sol' })).status === 401);
  checar('token inválido não assume', (await pedir({ op: 'assumir', e: 'atelie-sol', idToken: 'lixo' })).status === 401);
  checar('outro e-mail não assume', (await pedir({ op: 'assumir', e: 'atelie-sol', idToken: 'tok-outro' })).status === 404);
  checar('e-mail não verificado não assume', (await pedir({ op: 'assumir', e: 'atelie-sol', idToken: 'tok-nao-verif' })).status === 404);
  checar('ainda sem dono', !b.pegar('tenants/atelie-sol/members/uid-x') && !b.pegar('tenants/atelie-sol/members/uid-nv'));

  const a = await pedir({ op: 'assumir', e: 'atelie-sol', idToken: 'tok-ana' });
  checar('dono do e-mail assume (qualquer aparelho)', a.status === 200);
  const dono = b.pegar('tenants/atelie-sol/members/uid-ana');
  checar('vira owner só com nome (sem gênero)', dono && dono.role === 'owner' && dono.nome === 'Ana' && !('genero' in dono));
  checar('marcador some', b.pegar(`tenants/atelie-sol/members/${MARCADOR}`) === undefined);
  checar('pendência some', b.pegar('escolasPendentes/atelie-sol') === undefined);

  checar('assumir de novo não faz nada', (await pedir({ op: 'assumir', e: 'atelie-sol', idToken: 'tok-ana' })).status === 404);
  const tomar = await pedir(criar());
  checar('escola já assumida não pode ser recriada, nem pelo mesmo e-mail', tomar.status === 409);
  checar('config da escola real intacto', b.pegar('tenantsPublic/atelie-sol/nome') === 'Ateliê Sol!');
}

{
  const { b, pedir, relogio } = montar();
  await pedir(criar());
  relogio.t += VALIDADE_PENDENTE_MS + 1;
  const r = await pedir(criar({ email: 'novo@exemplo.com' }));
  checar('escola pendente abandonada libera o endereço', r.status === 200 && b.pegar('escolasPendentes/atelie-sol/email') === 'novo@exemplo.com');
}

{
  const { pedir } = montar();
  checar('e-mail inválido recusado', (await pedir(criar({ email: 'nada' }))).status === 400);
  checar('sem nome do espaço recusado', (await pedir(criar({ nomeEscola: '  ' }))).status === 400);
  checar('config sem regras recusado', (await pedir(criar({ config: { vocab: {} } }))).status === 400);
  checar('slug inválido recusado', (await pedir(criar({ e: '../billing' }))).status === 400);
  checar('operação desconhecida recusada', (await pedir({ op: 'apagar', e: 'atelie-sol' })).status === 400);
  let ultimo;
  for (let i = 0; i < MAX_CRIACOES + 1; i++) ultimo = await pedir(criar({ e: `escola-${i}` }), '9.9.9.9');
  checar('limite de criações por IP', ultimo.status === 429);
  checar('outro IP segue livre', (await pedir(criar({ e: 'escola-z' }), '8.8.8.8')).status === 200);
}

if (falhas) { console.log(`\n❌ ${falhas} falha(s)`); process.exit(1); }
console.log('\n✅ criação de escola ok');
