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
- **Professor** (PIN) e **aluno** (link) → **não** têm conta Firebase, então as
  regras os barram no acesso direto — de propósito. Eles passam pela Cloud
  Function (fatia-no-servidor), que valida a credencial e escreve com Admin SDK.
  Isso exige o plano Blaze (pague-o-que-usar, ~grátis no volume inicial).

## Bootstrap do primeiro dono

Como só o dono pode escrever em `members`, e no começo não há dono, o primeiro
registro de membro é semeado fora das regras:
1. o dono faz login uma vez (cria a conta Auth e ganha um `uid`);
2. cria-se manualmente `/tenants/{tid}/members/{uid} = { role: "owner", nome }`
   no console (ou via provisionamento com Admin SDK);
3. a partir daí o dono tem acesso pleno.

## A fatia do aluno (`functions/`)

O aluno não tem conta no Firebase, então as regras o barram — de propósito. Mas
ele precisa ver as coisas dele e agir sobre elas. Isso passa pela função
`aluno` (`functions/src/index.js`), que usa o Admin SDK:

1. o link do aluno leva **escola e código** (`?e=escola&c=codigo`). Levar os
   dois evita um índice global de códigos, que seria enumerável;
2. a função confere o código contra `acessos` no estado da escola;
3. devolve só a **fatia** daquele aluno (`src/domain/fatiaAluno.js`) — nunca o
   estado da escola;
4. aceita apenas a lista fechada `ACOES_DO_ALUNO`, e **reescreve** a ação com o
   nome e a turma vindos do código. Sem isso bastaria trocar o `alunoNome` no
   corpo do pedido para agir no lugar de outra pessoa;
5. grava com transação condicional em `_updatedAt`, para não sobrescrever
   alteração feita no meio do caminho.

> A lógica de domínio é **importada** do app, não copiada. Servidor e cliente
> discordarem sobre as regras seria uma fábrica de bugs.

O que a fatia nunca inclui: nome de outro aluno, log, notas, snapshots, códigos
de acesso de terceiros, e o `faltaId` de uma vaga (que diria de quem ela é). A
única exceção é a `ausenciaId` das férias do próprio aluno, para ele reconhecer
"a vaga que eu liberei". Coberto por `test/fatia-smoke.mjs`, que varre a fatia
inteira atrás do nome de outro aluno.

### Publicar

Cloud Functions exige o plano **Blaze** (pague-o-que-usar; no volume inicial
fica praticamente em zero). Enquanto a função não estiver publicada, a tela do
aluno mostra um aviso em vez de dados.

```bash
cd functions && npm install
firebase deploy --only functions
```
