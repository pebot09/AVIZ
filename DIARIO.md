# Diário do AVIZ

Registro das sessões, a mais recente no topo. Ao terminar uma tarefa, anote:
data, o que foi feito, o que ficou pendente e o próximo passo.

---

## 2026-10-23 — Cadastro de alunos em lote

### O que foi feito
- Em cada turma, "Colar lista": o dono cola os nomes (um por linha), vê quem
  entra e quem já estava, e confirma. Tira numeração e marcadores ("1.",
  "2)", "-", "•"); ignora repetidos sem diferença de maiúsculas e acentos;
  avisa se a turma passa da capacidade. Uma linha só no histórico.
  (`src/domain/listaAlunos.js`, ação `ADD_ALUNOS` no reducer.)
- Os links continuam sendo gerados um por um (decisão do Pedro).
- CLAUDE.md: saiu o bloco "PARA [NOME]:"; recados para outros agentes vão
  só no mural (seção 9 da Bíblia do AVIZ).

### Próximo passo
Pedro testar o "Colar lista" no celular. Depois: ajuda curta nas telas (item 11
do diagnóstico), se o Pedro concordar.

---

## 2026-10-23 — Testes que falhavam conforme a data

### O que foi feito
- Pedro testou no celular as entregas 1, 2 e 3 do login novo: tudo
  funcionou (incluindo marcar a conta dele como admin no console).
- Links de aluno em lote: descartado (decisão do Pedro); continuam um por
  um. O cadastro de nomes em lote foi feito depois (entrada acima).
- Testes que travariam o deploy em certas datas:
  - fatia do aluno falhava do fim de cada mês em diante (a partir de 28/10)
    e de 29 a 31/12: férias de teste no mês atual sem aula restante.
  - testes de PIN falhavam ~1 vez em 200: o hash às vezes contém "4829".
  Conferido rodando todos os testes com o relógio simulado em 70 dias, de
  manhã e à noite.

### Próximo passo
Escolher com o Pedro entre os itens 8 a 12 do diagnóstico (domínio próprio,
restaurar backup, auditoria do super-admin, ajuda nas telas, textos).

---

## 2026-10-23 — Criação de escola só pelo Pedro + convite do dono (entrega 2)

### O que foi feito
- `/?novo=1` (questionário) só funciona para admin logado: `/admins/{uid} =
  true`, marcado pelo Pedro no console. Quem não é admin vê "Só a equipe do
  AVIZ cria escolas".
- O questionário pede nome e e-mail do responsável. Ao criar, sai um LINK DE
  CONVITE (`/?convite=…`, uso único, 30 dias) com botões Copiar e WhatsApp.
  Convites não aceitos aparecem listados para reenviar.
- O dono abre o convite, aceita os Termos (o aceite foi do questionário para
  cá), escolhe o PIN de 4 números e já entra como dono. Se o e-mail já tem
  conta no AVIZ, entra com o PIN que já usa (o convite não troca PIN).
- Saíram: escola "pendente presa ao e-mail", assumir pelo link mágico, limite
  de criação por IP.

### Pendente
- Pedro: marcar a própria conta como admin no console (passo a passo na
  conversa de 2026-10-23) e testar criando uma escola e abrindo o convite.
- Os e-mails de "Esqueci meu PIN" ainda dependem da cota do Firebase (raro).

### Próximo passo
(Ver entrada mais nova.)

---

## 2026-10-23 — Professores com e-mail + PIN (entrega 3, adiantada a pedido do Pedro)

### O que foi feito
- O dono cadastra o professor com nome, e-mail e PIN de 4 números
  (Configurações → Equipe). O professor entra pela mesma tela do dono
  (e-mail + PIN) e o app acha a escola sozinho.
- Cada professor tem uma conta em `/contas` (criadaPor = escola). Se o
  e-mail já tem conta no AVIZ (ex.: dono de outra escola), a pessoa entra na
  equipe com o PIN que já usa: o dono NÃO consegue trocar PIN de conta criada
  por outra escola.
- O e-mail do professor não muda depois de salvo (para trocar: remover e
  adicionar). Professor antigo (sem e-mail) aparece com aviso; ao editar e
  pôr e-mail + PIN, passa a entrar.
- Saiu o login antigo de professor (escolher nome + PIN de 6 números) e o
  código dele (worker `listar`/`entrar`, PIN do dono por escola).
- "Esqueci meu PIN" também serve para professor.

### Pendente
- Entrega 2: criação de escola só pelo Pedro + link de convite para o dono
  escolher o PIN.
- Professores antigos das escolas de teste: editar e pôr e-mail + PIN.

### Próximo passo
Entrega 2.

---

## 2026-10-23 — Login por e-mail + PIN (entrega 1 de 3)

### Decisões do Pedro
- Dono e professores entram com e-mail + PIN de 4 números (teclado
  numérico). Nada de link por e-mail no dia a dia.
- Trava: 10 erros seguidos no mesmo e-mail → 15 min. Sem trava de 24 h.
- Só o Pedro cria escolas (entrega 2). O dono recebe um link de convite e
  escolhe o PIN antes de entrar.
- Professor: o dono cadastra nome, e-mail e PIN (entrega 3).
- "Esqueci meu PIN": link por e-mail para escolher um PIN novo.

### O que foi feito
- `/api/conta` (`worker/conta.js`): entrar (e-mail + PIN → custom token +
  lista de escolas), definirPin (exige estar logado com e-mail confirmado;
  mantém o uid da conta se já existir) e escolas. Contas em
  `/contas/{sha256(email)}`, tentativas em `/loginTentativas/…`: caminhos que
  as regras não liberam para ninguém, então não precisou mexer nas regras.
- Tela de entrada nova: e-mail + PIN, "Esqueci meu PIN" e "Sou professor"
  (nome + PIN antigo, até a entrega 3). Logado sem escola no endereço, o app
  acha as escolas da conta (uma → entra direto; várias → lista).
- "Esqueci meu PIN" leva o e-mail no próprio link: não pede o e-mail de novo.
- Tela "sem acesso" ganhou "Ver minhas escolas".
- Configurações → Equipe → "Seu PIN" agora troca o PIN da conta (4 números).
- Escola nova pelo questionário: o link do e-mail já abre pedindo o PIN.

### Pendente
- Entrega 2: criação só pelo Pedro (marcar a conta dele como admin no
  console) + link de convite para o dono escolher o PIN.
- Entrega 3: professores com e-mail + PIN; telinha para o Pedro gerar novo
  convite; tirar o login de professor por nome + PIN.
- Pedro: entrar na escola-x com "Esqueci meu PIN" (drive1) e testar o app.

### Próximo passo
Entrega 2.

---

## 2026-10-15 — App instalável (tela inicial do iOS e Android)

### O que foi feito
- "Adicionar à Tela de Início" agora cria um app: ícone próprio, tela cheia,
  sem barra do navegador. Ícone: um "A" discreto em forma de casa, branco no
  azul do app (decisão do Pedro). Gerado por `scripts/gerar-icones.py`.
- Nome embaixo do ícone = nome da escola (decisão do Pedro). O manifesto é
  gerado pelo Worker (`/manifest.webmanifest?e=…&c=…`, `worker/manifest.js`),
  lendo `tenantsPublic/{escola}/nome` (leitura pública).
- O app abre onde a pessoa estava: aluno no link pessoal, equipe no endereço
  da escola. Duas escolas no mesmo celular = dois ícones.
- Sem service worker de propósito: nada fica em cache, cada abertura pega a
  versão nova. O Chrome confirmou que o app é instalável sem ele.
- iPhone: o app instalado não compartilha o login com o Safari, e o link do
  e-mail abre no Safari. A tela de login por e-mail, dentro do app do
  iPhone, avisa para entrar com PIN.

### Pendente
- Pedro testar a instalação no iPhone e no Android.

### Próximo passo
Cadastrar alunos em lote (colar lista) e gerar/enviar links em lote.

---

## 2026-10-15 — CLAUDE.md: outros agentes + teste que falhava conforme a hora

- Feito: CLAUDE.md ganhou a regra de terminar com um bloco "PARA [NOME]:"
  quando algo precisar de outro agente (Gustavo: escolas e suporte; Adriana:
  preço, Termos, empresa; Júlia: coordenação).
- Feito: o teste da fatia do aluno quebrava às quintas depois das 19h30 (UTC)
  — usava a "próxima aula" mesmo já em andamento. Isso deixava a main
  vermelha e travava qualquer deploy. Agora usa só aulas que ainda não
  começaram; conferido simulando vários dias e horários.
- Pendente: o mesmo teste ainda falha no último dia do mês à noite (o teste
  de férias não acha aula restante no mês). Já existia antes; corrigir numa
  próxima sessão, antes de 30/10.
- Próximo passo: o mesmo da Sessão 2 (abaixo).

---

## 2026-10-15 — Sessão 2: Termos de teste e primeiros passos

### O que foi feito
- **Termos e Política do teste gratuito** (`src/legal/teste.js`): curtos,
  "gratuito, sem cobrança", sem faixa de RASCUNHO e sem campos em branco. Só
  prometem o que o código já faz (nada de auditoria nem corte em 90 dias).
  Contato: "pelo mesmo canal em que recebeu o convite". Chave `MODO_TESTE`
  em `operador.js`; os textos completos ficam guardados para depois.
  Versão aceita no onboarding agora é `2026-10-15-teste`.
- **Guia "Primeiros passos"** para o dono (`PrimeirosPassos.jsx`), com os
  passos que o Pedro definiu: 1. conferir regras; 2. turmas e horários;
  3. alunos; 4. enviar link; 5. professores (opcional). Cada passo tem um
  botão que leva ao lugar certo. Turmas, alunos e links ganham ✓ pelos
  dados; regras e professores, quando o dono toca no botão (guardado no
  aparelho). O guia some quando os 4 obrigatórios estão feitos, ou em
  "Esconder guia".
- Teste de domínio agora falha de verdade quando um `console.assert` falha
  (antes só imprimia e o deploy seguia).

### Pendente
- Itens 6 (depois do 1º cliente), 7 a 12 do diagnóstico.
- Contato oficial (e-mail) nos Termos, quando o Pedro quiser um.

### Ajustes depois do teste do Pedro no celular
- Onboarding não pergunta mais o artigo (O/A) do dono: o AVIZ não guarda o
  gênero de ninguém (decisão do Pedro). O artigo do **nome do espaço** fica.
  Escolas criadas antes guardaram `genero` no membro dono; não é lido em
  lugar nenhum.
- Cloudflare: "Disable builds" ligado (confirmado por print) e "Builds for
  non-production branches" desmarcado pelo Pedro. Só o GitHub Actions publica.

### Próximo passo
Pedro: criar uma escola nova no celular e seguir o guia até o fim. Depois,
**item 7**: cadastrar vários alunos de uma vez (colar lista) e gerar/enviar
os links em lote.

---

## 2026-10-15 — Sessão 1: o AVIZ visto pelo primeiro cliente-teste

### Diagnóstico (escola que nunca viu o sistema)

**Bloqueia o uso**
1. Escola não era criada se o link do e-mail abrisse em outro aparelho (as
   respostas do onboarding ficavam só no navegador) — e um `window.prompt`
   pedia o e-mail. → **resolvido**
2. Dono não sabia o endereço do espaço (`?e=…`). → **resolvido**
3. Nenhuma orientação depois de criar a escola (tela vazia, sem "primeiros passos").
4. Termos com faixa "RASCUNHO" e campos em branco (`[CNPJ]` etc.).
5. Conferir infraestrutura de produção (chave de serviço no Worker, domínios
   autorizados no Firebase Auth, regras publicadas). → confirmado na prática:
   Pedro testou no celular e funcionou.

**Bloqueia parte das escolas**
6. Não existe o interruptor "o que o aluno faz sozinho" (PLANTA, seção 5).
7. Cadastrar alunos e gerar/enviar links é um por um.

**Seria bom ter**
8. Domínio próprio (`escola.aviz.com.br`). 9. Botão de restaurar backup.
10. Super-admin com auditoria. 11. Ajuda curta nas telas. 12. Textos da tela de login.

### Decisões do Pedro
- O AVIZ não faz cobrança de alunos; a assinatura da escola existe. O
  CLAUDE.md não menciona cobrança nem outros apps — só o AVIZ.
- Termos (item 4): para o teste, um termo simples de "período de teste
  gratuito, sem cobrança", sem faixa de RASCUNHO e sem campos em branco. Os
  Termos completos ficam para depois.
- Item 6 fica para depois do primeiro cliente.
- Pedro não revisa código: com testes passando, merge na main e push. Nunca
  publicar com teste falhando. Quebrou em produção → reverter primeiro.
- O agente se chama Dave.

### O que foi feito
- **Escola nasce salva no servidor** (`/api/escola`, `worker/escola.js`):
  criada antes do login, presa ao e-mail; quem entra com aquele e-mail vira
  o dono, em qualquer aparelho. Escolhido em vez de levar as respostas no
  link (não dava para garantir o limite de tamanho do Firebase).
- Link aberto noutro aparelho pede o e-mail numa tela do app.
- Endereço do espaço aparece na revisão, na tela "Quase lá" e num aviso na
  primeira entrada do dono, com botão de copiar.
- E-mail do link de acesso em português (`auth.languageCode = 'pt-BR'`) e
  erros do Firebase traduzidos (`src/lib/erros.js`).
- `deploy.yml` publica só da main, com testes antes (falhou, não publica).
- CLAUDE.md atualizado (Dave, stack, regras de trabalho, diário).
- PRs: pebot09/AVIZ#7 e pebot09/AVIZ#8 (merge feito pelo Dave).
- **Pedro testou no celular o onboarding e o painel do aluno: funcionou.**
- Cloudflare: "Disable builds" ligado — só o GitHub Actions publica (com testes).

### Pendente
- Itens 3, 4 (feitos na Sessão 2), 6 (depois do 1º cliente), 7 a 12.

### Notas para a próxima sessão
- A `main` recusa push direto (regra do GitHub). Caminho: push na branch de
  trabalho → PR → esperar a "Checagem" passar → merge pelo GitHub (sem
  revisão do Pedro) → o deploy roda sozinho.

### Próximo passo
**Sessão 2:** Termos simples de teste gratuito (sem cobrança, sem faixa de
rascunho, sem campos em branco) + "primeiros passos" na tela vazia da escola.
