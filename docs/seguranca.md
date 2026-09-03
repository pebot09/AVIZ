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
