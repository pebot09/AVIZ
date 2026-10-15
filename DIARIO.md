# Diário do AVIZ

Registro das sessões, a mais recente no topo. Ao terminar uma tarefa, anote:
data, o que foi feito, o que ficou pendente e o próximo passo.

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
