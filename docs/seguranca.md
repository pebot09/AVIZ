# Regras de segurança do AVIZ

As regras vivem em [`../database.rules.json`](../database.rules.json) — JSON puro
(sem comentários, para o validador do Firebase aceitar). Este documento explica
o porquê de cada parte.

## Como publicar

Console: **Realtime Database → aba Regras** → colar o conteúdo de
`database.rules.json` → **Publicar**. (Ou, com o firebase CLI:
`firebase deploy --only database`.)

> Firebase RTDB usa `==`, não `===`. As regras precisam estar no caminho certo.

## O modelo

O banco nasce **fechado** (o oposto do Passarinho, que era aberto).

- **`/tenantsPublic/{tid}`** — vitrine pública (nome, logo, cor). Leitura livre,
  porque a tela de login/aluno precisa dela antes de qualquer autenticação.
  Escrita só pelo servidor (Admin SDK).

- **`/tenants/{tid}`** — dados da escola. Leitura só para quem é **membro**
  daquela escola. A escrita é concedida **por subárvore**, no nível certo:
  - `config` e `members`: só o **dono** (`role == 'owner'`).
  - `state` e `snapshots`: qualquer **membro** autenticado.

  > Semântica do RTDB: uma regra de pai que concede acesso **não pode** ser
  > restringida por um filho. Por isso a escrita nunca é concedida em bloco no
  > `$tid` — senão `members` ficaria gravável por qualquer membro. Cada
  > subárvore recebe sua própria `.write`.

- **`/billing/{tid}`** — cobrança. Fechado a cliente; só o super-admin via
  Admin SDK.

## Quem entra por onde

- **Dono** → Firebase Auth (link mágico) → acessa o banco direto. Funciona no
  plano grátis (Spark).
- **Professor** (PIN) → o Worker confere o PIN e devolve um *custom token* do
  Firebase; o navegador vira uma sessão normal do Firebase Auth com o `uid` do
  professor, e as mesmas regras de membro valem para ele (lê a escola, grava
  `state`/`snapshots`/`backups`; **não** grava `config` nem `members`). Detalhes
  em "Login do professor por PIN", abaixo.
- **Aluno** (link) → **não** tem conta Firebase, então as regras o barram no
  acesso direto — de propósito. Ele passa pelo Worker da Cloudflare
  (fatia-no-servidor), que valida a credencial e lê/grava o banco com a conta de
  serviço. Roda no plano grátis da Cloudflare — sem Blaze, sem cartão.

## Backup automático

O estado inteiro é gravado de uma vez, então uma escrita ruim pode, na pior das
hipóteses, estragar a escola. Rede de segurança: a cada carregamento (uma vez
por sessão, com intervalo mínimo de 6h), o app copia o estado bom para um anel
em `tenants/{tid}/backups`, guardando as **últimas 10** versões e podando as
antigas. É best-effort — se falhar, não atrapalha o uso.

Restaurar (enquanto não há botão na tela): no console do Realtime Database,
abra `tenants/{tid}/backups`, ache a versão desejada pelo `ts`/`resumo`, copie o
conteúdo de `dados` e cole em `tenants/{tid}/state`. Em código, `restaurarBackup`
e `listarBackups` (em `src/lib/store.js`) fazem isso — base para uma tela de
restauração de um clique.

## Bootstrap do primeiro dono

Como só o dono pode escrever em `members`, e no começo não há dono, o primeiro
registro de membro é semeado fora das regras:
1. o dono faz login uma vez (cria a conta Auth e ganha um `uid`);
2. cria-se manualmente `/tenants/{tid}/members/{uid} = { role: "owner", nome }`
   no console (ou via provisionamento com Admin SDK);
3. a partir daí o dono tem acesso pleno.

## Login do professor por PIN

O professor não tem e-mail. Cada um é um membro (`/tenants/{tid}/members/{uid}`,
`role: 'professor'`, `uid` com prefixo `prof-`) com um **PIN próprio** de 6
números, definido pelo dono em Configurações → Equipe. Um PIN por professor (e
não um da escola) para o log saber quem agiu e para o dono tirar alguém sem
trocar a senha de todo mundo.

Tudo passa por `/api/professor` no Worker (`worker/professor.js`):

1. **Dono cria/edita/remove** professor mandando o ID token do Firebase dele. O
   Worker valida o token no Identity Toolkit e confere `role == 'owner'` naquela
   escola antes de gravar. Remover apaga o membro, e as regras barram na hora a
   sessão que o professor tinha aberta.
2. **O PIN nunca fica legível para cliente nenhum.** O Worker guarda só o hash
   (PBKDF2-SHA256 com sal) em `/pinsProfessor/{tid}/{uid}`. Esse caminho não
   aparece em `database.rules.json`, e o RTDB nega por padrão o que não é
   liberado — só a conta de serviço alcança. (Guardar dentro de `/tenants/{tid}`
   não serviria: a leitura de membro ali é herdada por todos os filhos.)
3. **Entrar:** a tela de login lista os nomes dos professores; o professor
   escolhe o seu e digita o PIN. PIN certo → custom token assinado com a chave
   da conta de serviço → `signInWithCustomToken`.
4. **Limite de tentativas:** 5 erros em 15 min bloqueiam aquele endereço IP
   naquela escola até a janela passar (`/pinTentativas/{tid}/{hash do IP}`, também
   fora das regras). Com 6 dígitos e PINs óbvios recusados (000000, 123456…),
   o chute às cegas fica inviável.

Precisa da `FIREBASE_SERVICE_ACCOUNT` (a mesma do aluno); o segredo legado não
assina custom token. Nada a ligar no console do Firebase: login por custom token
não depende de provedor habilitado. Coberto por `test/professor-smoke.mjs`.

## A fatia do aluno (Cloudflare Worker)

O aluno não tem conta no Firebase, então as regras o barram — de propósito. Mas
ele precisa ver as coisas dele e agir sobre elas. Isso passa pelo Worker da
Cloudflare (`worker/index.js`), no endpoint `/api/aluno`:

1. o link do aluno leva **escola e código** (`?e=escola&c=codigo`). Levar os
   dois evita um índice global de códigos, que seria enumerável;
2. o Worker fala com o banco como **conta de serviço** (Admin SDK): assina um
   JWT com a chave privada e troca por um `access_token` do Google
   (`worker/firebaseAuth.js`), que dá acesso de administrador (ignora as
   regras) — o acesso de um servidor de confiança. A chave fica na variável
   `FIREBASE_SERVICE_ACCOUNT` do Worker, **nunca** no navegador. (Projetos
   novos não têm mais o "segredo do Realtime Database" legado; se um projeto
   antigo tiver, o Worker também aceita `FIREBASE_DB_SECRET`.);
3. confere o código contra `acessos` e devolve só a **fatia** daquele aluno
   (`src/domain/fatiaAluno.js`) — nunca o estado da escola;
4. aceita apenas a lista fechada `ACOES_DO_ALUNO`, e **reescreve** a ação com o
   nome e a turma vindos do código. Sem isso bastaria trocar o `alunoNome` no
   corpo do pedido para agir no lugar de outra pessoa;
5. grava condicionalmente por **ETag** (o equivalente REST da transação): se a
   escola mudou entre a leitura e a escrita, aborta com 409 em vez de
   sobrescrever.

> A lógica de domínio é **importada** do app, não copiada. Servidor e cliente
> discordarem sobre as regras seria uma fábrica de bugs.

O que a fatia nunca inclui: nome de outro aluno, log, notas, snapshots, códigos
de acesso de terceiros, e o `faltaId` de uma vaga (que diria de quem ela é). A
única exceção é a `ausenciaId` das férias do próprio aluno, para ele reconhecer
"a vaga que eu liberei". Coberto por `test/fatia-smoke.mjs`, que varre a fatia
inteira atrás do nome de outro aluno.

### Publicar

Roda no **plano grátis da Cloudflare** — nada de Blaze nem cartão. Precisa só da
chave da conta de serviço guardada como secret do Worker (uma vez):

```bash
# 1) baixe a chave: Firebase → Configurações do projeto → Contas de serviço →
#    "Gerar nova chave privada" → baixa um .json
# 2) guarde o .json como secret do Worker (pipe do arquivo, sem colar à mão):
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < caminho/para/a-chave.json
# 3) publique o app + Worker juntos:
npm run build && npx wrangler deploy
```

> A chave dá acesso de administrador ao banco. Ela vai só como secret do Worker
> (nunca no Git — o `.gitignore` já barra `*.json` de conta de serviço). Se
> vazar, revogue em "Gerenciar permissões da conta de serviço" e gere outra.

Enquanto o secret não estiver configurado, `/api/aluno` responde com um aviso
claro e a tela do aluno o mostra; o app do professor não depende disto.
