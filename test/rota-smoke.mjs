// Roteamento de entrada do app.
//
// Foi por aqui que "sumiram" os dados: abrir o app sem ?e= na URL não resolvia
// escola nenhuma e caía direto no onboarding. Refazer o cadastro com o mesmo
// nome criava um endereço "-2" — um espaço novo e vazio — enquanto o original
// seguia intacto. Estes testes fixam as regras de roteamento.

import { resolveTenant, resolveAccessCode, querEscolaNova } from '../src/lib/tenant.js';

let falhas = 0;
function checar(nome, cond, extra) {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
}

const loc = (href) => new URL(href);

// A decisão de rota do App, na mesma ordem do componente.
function rota({ href, ultimo, user }) {
  const l = loc(href);
  const noEndereco = resolveTenant(l);
  const novo = querEscolaNova(l);
  const tenant = noEndereco || (novo ? null : ultimo);
  if (resolveAccessCode(l)) return 'aluno';
  if (novo) return 'onboarding';
  if (!tenant) return 'entrada';
  if (!user) return 'login';
  return `escola:${tenant}`;
}

const BASE = 'https://aviz.pedrobotafogodrive2.workers.dev';

// O caso que causou o estrago: endereço puro, já tendo usado uma escola.
checar('endereço puro volta para a última escola, não para o onboarding',
  rota({ href: BASE + '/', ultimo: 'brabinho', user: {} }) === 'escola:brabinho',
  rota({ href: BASE + '/', ultimo: 'brabinho', user: {} }));

// Sem memória nenhuma: oferece escolher, nunca cria escola sozinho.
checar('sem escola e sem memória vai para a tela de entrada',
  rota({ href: BASE + '/', ultimo: null, user: {} }) === 'entrada');

// Criar escola é sempre explícito.
checar('onboarding só com ?novo=1',
  rota({ href: BASE + '/?novo=1', ultimo: 'brabinho', user: {} }) === 'onboarding');

// O endereço na URL manda sobre a memória.
checar('?e= tem precedência sobre a memória',
  rota({ href: BASE + '/?e=outra', ultimo: 'brabinho', user: {} }) === 'escola:outra');

// Deslogado numa escola conhecida: login daquela escola, não onboarding.
checar('deslogado com escola conhecida vai para o login',
  rota({ href: BASE + '/', ultimo: 'brabinho', user: null }) === 'login');

// Link do aluno continua tendo prioridade.
checar('link do aluno abre o painel do aluno',
  rota({ href: BASE + '/?c=123456', ultimo: 'brabinho', user: null }) === 'aluno');

console.log(falhas ? `\n❌ ${falhas} rota(s) erradas` : '\n✅ roteamento ok');
process.exit(falhas ? 1 : 0);
