# AVIZ — Planta do Produto

> Documento único de referência para a construção do AVIZ.
> Consolida as decisões tomadas na fase de entendimento (set/2026).
> Base de origem: `pebot09/atelie-passarinho` (o app do Ateliê Passarinho, que serve de protótipo funcional).
> **O AVIZ é um app novo, código separado. Nada aqui reaproveita o repositório do Passarinho — ele serve só como referência de comportamento comprovado.**

---

## 0. Como ler este documento

Cada seção termina com o que está **travado** (decidido) e, quando existir, o que ainda **depende de decisão futura** (marcado 🔵). Nada marcado 🔵 bloqueia o começo da construção.

Convenção: sempre que aparecer *[termo]* entre colchetes e itálico (ex.: *[aluno]*, *[turma]*), é um termo que cada escola define no onboarding — o app nunca fala "aluno" fixo, fala o que a escola escolheu.

---

## 1. O produto

**AVIZ** é um sistema de gestão de faltas e reposições para negócios que funcionam em turmas recorrentes: escolas de arte, música, dança, luta, natação, idiomas, pilates, terapia em grupo — qualquer lugar onde alguém tem aula/sessão fixa na semana e às vezes falta.

**A dor:** controlar reposição de aula é um inferno de caderno e planilha. Quem faltou, quem tem direito, quando o direito vence, se tem vaga pra encaixar, se a reposição foi feita. Todo mundo erra, e o erro sempre cai no colo do professor.

**A tese do produto (a coisa mais importante deste documento):**

> **O AVIZ tira a dinâmica de reposição da mão do professor.**

O *[aluno]* se auto-gerencia: marca a própria falta, vê as vagas disponíveis, agenda a própria reposição, desmarca se mudar de ideia — até o último minuto. O professor não administra fila, não decide quem tem direito, não controla vencimento. O sistema faz isso. Se o *[aluno]* marca reposição e não aparece, o problema é dele, não da escola — o app registra "reposição feita" pela passagem da data, sem exigir confirmação de presença. Essa é uma decisão de produto deliberada, não uma limitação.

**Por que vende:** o núcleo (crédito de reposição, vaga extra, recesso, expiração de direito, painel do aluno por link) resolve as partes difíceis que ninguém copia num fim de semana. E o modelo comercial é desenhado para **não gerar suporte** — a regra de ouro está na seção 6.

---

## 2. O domínio — como as regras funcionam

Esta seção descreve o comportamento **comprovado** no Passarinho, que o AVIZ replica de forma configurável. Está organizado nas seis partes que foram entendidas uma a uma.

### 2.1 Ciclo falta → vaga → reposição

- **Falta** = um *[aluno]* + uma *[turma]* + **uma data**. Selecionar três datas cria três faltas independentes.
- Falta em feriado ou recesso **não pode ser lançada** (a UI impede a seleção).
- Falta duplicada (mesmo aluno/turma/data ainda ativa) é ignorada.
- Ciclo de vida: `pendente` → `marcada` (ganhou reposição) → some quando a reposição já passou **e** a data da falta já passou.
- **Vaga** = turma + data + origem (falta, ausência ou extra). Existir é estar livre; some ao ser reservada, volta ao cancelar.
- **Reposição** tem cinco formas: por falta comum, por crédito de férias, por crédito extra do professor, aula extra (paga), e o caso degenerado "sem falta vinculada" (o sistema **registra e sinaliza para verificar**, nunca bloqueia).
- **`realizada` é derivada do tempo:** a data da reposição passou → aconteceu. Sem confirmação de presença (ver tese, seção 1).
- **Consumo de direito por vencimento:** quando o aluno marca reposição, o sistema consome automaticamente o direito que **vence primeiro** — seja falta, crédito de férias ou crédito extra — numa lista unificada. Isso impede que um direito expire com o aluno tendo outro de sobra.
- **Falta retroativa** (o aluno some sem avisar e a falta é lançada depois da aula) é **exclusiva do professor** — nunca do painel do aluno. O aluno sempre avisa para a frente. Se um "sumiço" merece reposição, o professor marca a falta na mão, e esse ato é a concessão.

### 2.2 Ausências (férias) e créditos

- **Ausência (férias)** = aluno + turma + **mês** (não datas). Ao registrar, o app abre uma vaga por data de aula do mês, para outros reporem no lugar.
- Trava dupla: uma por aluno/turma/mês, uma por período (ex.: 1× por ano). **A trava de período é por aluno**, não por turma.
- Mês de recesso não gera crédito.
- **Crédito de férias** expira num prazo a partir do fim do mês.
- **Crédito extra** é concedido manualmente pelo professor, com data de validade digitada caso a caso (de propósito — cada caso é um caso).
- **Expirar = marcar, nunca apagar.** Direito que vence deixa rastro (para o histórico e para as travas de período continuarem funcionando). Nunca remover o registro.
- **Aula cancelada pela escola:** todos os alunos ganham falta automática (menos quem está de férias ou já faltava); reposições que visitantes tinham marcado para aquela aula são desfeitas **sem punição**; as vagas da data somem.

### 2.3 Calendário

- Turma tem dia da semana e horário (com **minutos**, no AVIZ — ex.: 19h30) e **duração em minutos** (opcional, por turma).
- Data de aula = todo dia da semana que bate com o dia da turma (recorrência).
- **Feriado** = um dia sem aula; **não** mexe em crédito.
- **Recesso** = um período sem aula; **zera o crédito** dos meses que ele toca (os meses sem crédito **derivam** dos recessos, não são configurados à parte).
- Feriado e recesso **aparecem riscados/marcados**, não somem — o aluno vê que naquele dia não tem aula.

### 2.4 Vagas extras e capacidade

Duas capacidades distintas, ambas configuráveis e flexíveis:

- **Capacidade nominal (por turma):** o teto de matrícula — quantos o professor atende bem. Governa exibição e aviso "turma cheia". Não entra em cálculo de vaga.
- **Capacidade física (do espaço):** quantos corpos cabem na sala num dia. É o teto real que governa quantas vagas extras podem existir. **Global por escola, com override opcional por turma** (turma numa sala menor herda um valor próprio).

A vaga extra é **residual**: só existe depois que faltas e reposições se acomodam entre si. Fórmula (comprovada):

```
alvo_de_vagas_extras = max(0, capacidadeFísica − alunosEfetivos + faltas − reposiçõesMarcadas − vagasDeFaltaExistentes)
```

- `alunosEfetivos` = matriculados − quem está de férias no mês.
- Vaga extra abre só a partir de uma janela antes da aula (configurável — no Passarinho, a véspera), para dar tempo de alguém ocupar.
- Se **todos** faltam, a aula não acontece: as vagas extras somem (não se dá aula só para repositores).
- Ao reservar, o sistema consome **primeiro** a vaga de falta e só depois a extra — para manter o resíduo correto.

### 2.5 Acessos e painel do aluno

- O aluno acessa por um **link pessoal** (`?c=CÓDIGO`). O código é a credencial — não há senha, não há login para o aluno.
- Um código por par (aluno, turma). Aluno em duas turmas tem dois links.
- Pelo painel, o aluno faz **todas as ações dele**: lançar falta, marcar/cancelar reposição, registrar férias, ajustar avisos de vaga. Quais dessas ficam disponíveis é **configurável por escola** (ver 5).
- **Watchlist + notificação:** o aluno marca turmas de interesse e o navegador avisa quando abre vaga. Recurso de destaque do produto. (Se a escola não deixa o aluno marcar reposição sozinho, a notificação simplesmente não faz sentido e some — não é um interruptor à parte.)

### 2.6 Sincronização e armazenamento

Como o Passarinho faz hoje (para referência — o AVIZ muda o modelo de escrita, ver 3.3):
- Estado inteiro num blob JSON no Firebase; cada ação grava tudo.
- Leitura em tempo real via SSE; toda gravação empurra o estado para todos.
- Concorrência otimista manual (confere timestamp antes de gravar) — **estreita mas não fecha** a janela de corrida, o que obrigou a existir uma migration de deduplicação. É a fraqueza estrutural do modelo blob.
- Snapshot automático de hora em hora, retenção de 7 dias.
- Modo manutenção: fora o admin, ninguém grava (auto-expira em 6h para nunca travar).

**Travado:** o comportamento acima é a especificação funcional do AVIZ. As diferenças de implementação estão na seção 3.

---

## 3. Arquitetura comercial

### 3.1 Multi-tenant: um deploy, um banco, N escolas

```
   escola-a.aviz.com.br ─┐
   escola-b.aviz.com.br ─┤─→  1 build (Cloudflare/Vercel)  ─→  1 projeto Firebase
   escola-c.aviz.com.br ─┘        tenantId resolvido            /tenants/{tenantId}/...
                                  do subdomínio
```

`git push` uma vez → todas as escolas atualizadas. Custo marginal por escola ≈ zero. **Nunca** "uma conta por cliente".

Resolução de tenant: subdomínio como fonte primária, `?e=slug` como fallback de desenvolvimento.

### 3.2 Modelo de dados

```
/tenants/{tenantId}/
    config/          ← todas as regras do onboarding (ver 5)
    state/           ← turmas, faltas, reposicoes, vagas, ausencias, acessos, log, estatisticas
    members/{uid}    ← equipe (dono + professores)
    snapshots/{key}  ← backup automático por escola
/tenantsPublic/{tenantId}/   ← nome, logo, cor (leitura pública, para a tela de login/aluno)
/billing/{tenantId}/         ← plano, status, vencimento (só o super-admin escreve)
```

### 3.3 Escrita por caminho (elimina a race na raiz)

Diferente do Passarinho (blob), o AVIZ grava **só o que mudou** no caminho específico (ex.: uma falta em `/faltas/{id}`). Dois professores mexendo em coisas diferentes nunca colidem. Isso elimina a classe inteira de bug que no Passarinho é remendada por migration. Decisão travada porque é barata agora e caríssima de trocar depois de ter clientes.

### 3.4 Segurança — o item nº 1

- **Nada de segredo em texto puro no código** (o Passarinho usa `_auth: '109'`; o AVIZ não).
- **Leitura direta do `state` é proibida.** O painel do aluno (`?c=`) **não baixa o estado da escola** — ele chama uma **função no servidor** que devolve **só a fatia daquele aluno**.
- Essa função também **media as escritas do aluno** (as seis ações da seção 2.5): cada uma valida "este código é mesmo deste aluno, e ele só está mexendo no que é dele". A confiança sai do navegador e vai para o servidor.
- Regras do Firebase liberam cada `/tenants/$tid` só para membros daquele tenant.

### 3.5 Super-admin (acesso do operador)

- Cada escola tem seu próprio dono (admin da escola).
- **Você (operador do AVIZ) tem um super-admin** que entra em qualquer escola — necessário na fase inicial, cheia de bugs, para dar suporte.
- **Todo acesso seu a uma escola fica logado** (trilha de auditoria). É proteção sua e do cliente, e requisito de LGPD (ver 7).

### 3.6 Build

O AVIZ nasce com passo de build (Vite): compilação antecipada (sem Babel no navegador do cliente), CSS purgado, variáveis de ambiente. `git push` → build e deploy automáticos. Some o passo manual de copiar arquivos.

**Travado.** 🔵 Vercel vs Cloudflare Pages: começa no Cloudflare (grátis, comercial OK); migra para Vercel se a comodidade valer os ~US$20/mês.

---

## 4. Autenticação

- **Professores:** PIN da escola + escolhem o próprio nome (para o log saber quem agiu). **Sem e-mail.** Coerente com "só nome, mais nada".
- **Dono:** entra por **link mágico no e-mail** para as ações de dono — mudar regras, gerir equipe, cobrança, manutenção. É o único e-mail que o sistema guarda, e ele faz dupla função (receber acesso/cobrança + ser a chave das ações de dono).
- **Aluno:** link pessoal, sem senha (ver 2.5).
- **Super-admin (você):** ver 3.5.

**Mudança de regra vale para o passado?** Quando o dono altera uma regra (ex.: encurta a validade da falta), o app **pergunta na hora da ação** se a mudança vale só dali para a frente ou também para o que já existe. O dono decide caso a caso. Implicação técnica: cada falta/crédito precisa carregar a regra que valia quando nasceu, para "só para a frente" ser possível.

---

## 5. Catálogo de regras configuráveis

**Princípio:** nada vem pré-setado. Todas as regras de negócio são escolhidas no onboarding, sem sugestão — é isso que personaliza o app para cada escola e é o que sustenta o argumento de venda ("seu app, do seu jeito"). Parâmetros **técnicos** (retenção de log, horizonte de geração de vagas, timeout de manutenção, retenção de snapshot) **não** vão para o formulário — ficam num valor sensato no código, invisíveis ao dono.

Cada regra abaixo: opções oferecidas → onde muda o sistema.

| Regra | Opções | Muda em |
|---|---|---|
| **Vocabulário** | pares aluno/turma/professor (aluno·praticante·atleta·paciente / turma·aula·sessão / professor·instrutor·treinador·terapeuta), com plural e gênero; "outro" digitável | camada de exibição |
| **Capacidade nominal** | número por turma | exibição e aviso "cheia" |
| **Capacidade física** | número global + override por turma | fórmula de vaga extra |
| **Validade da falta** | X dias / fim do mês / fim do semestre / não expira | expiração da falta, CLEANUP |
| **Antecedência mínima** | sem exigência … 48h | classificação `semAntecedência` |
| **Falta sem antecedência** | não permite / permite e vale só dentro de Y horas da aula / vale sempre | consumo do direito |
| **Abertura da vaga extra** | véspera / X horas antes / X dias antes / assim que houver folga | cálculo de vaga extra |
| **Créditos por férias** | quantos (1 / por semana / proporcional) + granularidade (mês / período / por aula) | criação da ausência |
| **Validade do crédito de férias** | fim do mês + X dias / X dias após / fim do semestre | expiração da ausência |
| **Limite de férias por período** | liga/desliga; 1×/ano, N×/ano, ilimitado (escopo por aluno) | trava de período |
| **Crédito extra do professor** | existe / não existe; validade padrão | concessão de crédito |
| **Recessos** | lista de períodos {de, até} | recesso; deriva meses sem crédito |
| **Feriados** | cidade (base automática) + lista extra + toggle por feriado (paralisa ou não) | dias sem aula |
| **Aula cancelada pela escola** | gera falta pra todos (sim/não); gera direito a repor (sim/não) | cancelamento de aula |
| **Duração da aula** | minutos por turma (opcional) | horário de fim da aula |
| **O que o aluno faz sozinho** | interruptor por ação: lançar falta / marcar reposição / registrar férias / cancelar | ações expostas no painel do aluno |

🔵 A lista de opções de cada regra pode crescer conforme escolas reais pedirem — a estrutura já comporta.

---

## 6. Onboarding — o formulário

O formulário de onboarding **é** a configuração: cada resposta preenche um campo do `config` da escola. Isso resolve duas coisas de uma vez — personalização (valor percebido) e provisionamento sem trabalho manual.

### 6.1 Princípios

1. **Conversacional e progressivo** — uma pergunta por vez.
2. **Auto-explicativo** — cada pergunta explica, curto e inteligente, o que ela significa.
3. **Usa o vocabulário da pessoa** — depois que ela diz que quem vem é "praticante", todas as perguntas seguintes falam "praticante".
4. **Condicional** — só pergunta o detalhe se a porta anterior abriu ("vocês fazem férias?" antes de qualquer coisa sobre crédito).
5. **Widget certo** — number picker para prazos, escolha para opções, campo livre para "outro".

### 6.2 Abertura

- "Como podemos te chamar?" → artigo + nome (para tratar a pessoa pelo nome no resto do formulário).
- "E o espaço?" → artigo + nome do espaço.
- "Como vocês chamam quem vem ao/à [espaço]?" → aluno / praticante / atleta / paciente / outro.
- daí em diante o termo escolhido aparece em tudo.

### 6.3 Blocos condicionais (o encadeamento)

```
CAPACIDADES
  "Máximo de [praticantes] por turma?"          (o tamanho ideal de uma turma cheia)
  "Máximo de [praticantes] no espaço ao mesmo tempo?"  (o limite real da sala — é o que
                                                        permite abrir vagas de reposição)

FALTAS
  "Prazo mínimo pro [praticante] avisar que vai faltar?"   → [sem exigência … 48h]
  "Permitir falta sem antecedência?"  (aviso que chega perto demais — ainda pode faltar,
                                       mas com direito limitado)
     └ sim → "Até quantas horas antes ainda vale avisar sem antecedência?"  → dentro da janela
              (esse mesmo número define até quando pode MARCAR reposição sem antecedência)

VAGA EXTRA
  "Liberar vaga extra pros [praticantes]?"  (quando sobra espaço num dia, abre a cadeira pra repor)
     └ sim → "Quando a vaga extra abre?"  → véspera / X horas antes / X dias antes

FÉRIAS
  "Vocês oferecem marcação de férias?"  (tem escola que não oferece)
     └ sim → "As férias dão direito a crédito de reposição?"
              └ sim → "Quantos créditos?"
                      "Quanto tempo o crédito dura?"
                      "Tem limite de férias por ano?"
```

(Demais regras da tabela 5 entram como perguntas no mesmo estilo.)

### 6.4 Automação

```
Formulário → resposta estruturada (JSON)
   → função de provisionamento cria /tenants/{escola}/config + /tenantsPublic/{escola}
   → convite por link mágico para o dono
   → app da escola nasce configurado
```

Nos primeiros ~10 clientes, o último passo pode ser um clique seu (revisando antes). Depois, webhook do formulário automatiza de ponta a ponta.

---

## 7. Dados e LGPD

**Minimização como vantagem competitiva.** O AVIZ guarda o mínimo possível:

- **Alunos:** só **nome + turma + link**. Sem CPF, sem e-mail, sem contato, sem data de nascimento. É a faixa de risco mais baixa que existe.
- **Dono:** só o **e-mail** (para acesso e cobrança). O meio de pagamento fica **no gateway, nunca com você**.

Pontos honestos:
- Nome ligado a uma turma **ainda é dado pessoal** pela LGPD — o AVIZ não fica isento, mas fica no risco mínimo, com obrigações mínimas.
- Não coletar idade não é blindagem total quanto a menores, mas somado a "só o nome" o risco é baixíssimo. **Os Termos deixam a escola (controladora) responsável por ter o direito de cadastrar aqueles nomes; você é o operador que guarda o mínimo.**
- **Super-admin auditado** (3.5) precisa estar nos Termos como acesso do operador para suporte.

Obrigatórios: Termos de Uso + Política de Privacidade no aceite do onboarding; exportação de dados; fluxo de exclusão; política de retenção (alinhada com a inadimplência — ver 8).

---

## 8. Cobrança

- **Pagamento pelo próprio app**, meios fáceis: **Pix Automático** (recorrência) como principal; carteiras (Apple Pay / Google Pay) na web entram como cartão — **sem a taxa de 30% da Apple** (isso só existe em app nativo da loja; o AVIZ é web).
- **Automático, sem conferência manual:** o gateway (Asaas/Pagar.me) cobra e avisa o sistema por webhook. Pagou → escola ativa. Falhou → começa a contagem.
- **Inadimplência:** aviso → **corta o serviço em 30 dias** → **dados guardados por 90 dias** para reativação → depois apaga.
- Fallback quando o banco do cliente não suporta Pix Automático: boleto recorrente ou link de Pix mensal (que também dispara webhook ao ser pago). Em nenhum cenário você confere extrato na mão.

🔵 Preço final e faixas de plano: decisão sua, sem pressa. Ponto de partida discutido: assinatura mensal (R$59–119) + taxa de implantação. **Um plano só no lançamento** (o sistema precisa estar inteiro para funcionar; não dá para "meia escola"); faixas por tamanho só se uma escola crescer muito.

---

## 9. Hospedagem e passos

**Stack:**
- **Backend:** Firebase (Realtime Database + Auth + Cloud Functions).
- **Frontend:** Cloudflare Pages (grátis, comercial OK) ou Vercel (~US$20/mês, DX mais polida). Começa no Cloudflare.
- **Domínio:** `aviz.com.br` (~R$40/ano); cada escola em `escola.aviz.com.br`.
- GitHub Pages **não serve** (não faz build, função de servidor nem subdomínio por escola).

**Quem faz o quê (a maior parte é construção — minha):**

| Passo | Quem | Quando |
|---|---|---|
| Repositório `aviz` | ✅ feito | — |
| Construir o app (roda no endereço grátis) | eu | agora em diante |
| Projeto Firebase do AVIZ | você (seu login Google; eu guio) | quando eu precisar plugar dados |
| Comprar `aviz.com.br` | você (seu cartão) | perto do 1º cliente |
| Conectar repo ao Cloudflare | você autoriza, eu configuro | antes de publicar |

Você nunca fica travado esperando aprender algo técnico; quando eu precisar de você, digo exatamente o quê e por quê.

---

## 10. Ordem de construção

1. **Fundação multi-tenant + Auth** — `/tenants/{id}`, resolução por subdomínio, PIN de professor, link mágico do dono, regras do Firebase por tenant. *Bloqueia todo o resto.*
2. **Config como dado + escrita por caminho** — o `config` do onboarding e o modelo de gravação por caminho.
3. **O núcleo do domínio** — o ciclo falta→vaga→reposição, ausências/créditos, calendário, capacidade, lendo tudo do `config`.
4. **Painel do aluno + fatia-no-servidor** — a função que lê e media as escritas do aluno com segurança.
5. **Onboarding** — o formulário condicional e o provisionamento automático.
6. **Cobrança + jurídico** — gateway, inadimplência automática, Termos e Política.
7. **Comercial** — landing, ajuda, monitoramento.

Cada fase fecha antes da próxima começar. Segurança antes de configuração, configuração antes de vender.

---

## 11. Pendências que são suas (não bloqueiam a construção)

- 🔵 Preço final e formato de plano.
- 🔵 Cloudflare vs Vercel (padrão: Cloudflare).
- 🔵 Restaurar backup: self-service do dono ou pedido a você (detalhe pequeno, decide-se ao construir).
- 🔵 Nicho de entrada para os primeiros clientes (recomendação: escolher **um** para focar a mensagem).
