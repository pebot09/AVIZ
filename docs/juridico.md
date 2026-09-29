# Termos, Privacidade e dados (LGPD)

> **Os textos são rascunho e precisam de revisão jurídica antes de valer.**
> Foram escritos a partir da PLANTA (seções 7 e 8) e do que o código guarda
> hoje, não por um advogado.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Termos de Uso | [`src/legal/termos.js`](../src/legal/termos.js) → página `/termos` |
| Política de Privacidade | [`src/legal/privacidade.js`](../src/legal/privacidade.js) → página `/privacidade` |
| Dados do operador (razão social, CNPJ, encarregado, foro…) | [`src/legal/operador.js`](../src/legal/operador.js) |
| Aceite no onboarding | caixa na última etapa; grava `config.aceite = { versao, em }` |
| Exportar / excluir a escola | Configurações → **Dados e privacidade** (só o dono) |

As páginas mostram uma faixa **"Rascunho"** enquanto `REVISADO_JURIDICAMENTE`
for `false` ou houver algum `[CAMPO]` em aberto em `operador.js`. Depois da
revisão: preencher os campos, trocar `VERSAO_TEXTOS` e virar
`REVISADO_JURIDICAMENTE` para `true`.

## Pontos para o advogado olhar

1. **Papéis.** Escola = controladora dos dados de alunos e equipe; AVIZ =
   operador. AVIZ = controlador do e-mail do dono e da cobrança. Confirmar e,
   se preciso, anexar um acordo de tratamento de dados (DPA) aos Termos.
2. **Terapia/clínicas.** O vocabulário permite "paciente". Nome de paciente
   ligado a uma "sessão" de terapia pode revelar **dado de saúde** (sensível,
   art. 11). Os Termos proíbem inserir dado sensível, mas vale avaliar se o
   simples cadastro já entra nessa categoria para esse nicho.
3. **Menores.** O app não pede idade. Os Termos põem na escola a
   responsabilidade pelo art. 14 (consentimento dos responsáveis). Confirmar se
   basta.
4. **Transferência internacional.** Firebase (Google) guarda o banco nos EUA.
   A Política cita o art. 33; definir o mecanismo (cláusulas-padrão da ANPD).
5. **Retenção.** Suspensão em 30 dias de inadimplência, dados guardados por
   mais 90, depois exclusão (PLANTA, seção 8). Registros fiscais pelo prazo
   legal. Confirmar prazos.
6. **Limitação de responsabilidade** a 12 meses de mensalidade: validar.
7. **Foro, razão social, CNPJ, endereço, encarregado, gateway**: preencher em
   `operador.js`.

## Compromissos do texto que o código ainda não cumpre

Os textos descrevem o produto como vai estar no lançamento. Antes de publicar,
estes itens precisam existir (ou sair do texto):

- **Trilha de auditoria do super-admin** (Termos §6, Política §8). Ainda não há
  super-admin nem registro dos acessos dele (PLANTA 3.5).
- **Corte automático e exclusão após 90 dias** (Termos §7, Política §6).
  Depende da cobrança (fase 6), que ainda não existe.
- **Apagar um aluno por completo.** Tirar o aluno da turma remove o link, mas
  o nome continua no histórico de faltas, no log e nas cópias de segurança. Se
  um aluno pedir exclusão (art. 18, VI), hoje a escola só consegue renomear
  (troca o nome nas faltas e reposições, mas o log guarda o nome antigo, até
  na própria linha "Renomeou") ou excluir a escola inteira. Próximo passo sugerido: uma ação "anonimizar aluno".
- **Conta de login do dono.** Excluir a escola apaga os dados e o vínculo, mas
  a conta do Firebase Auth (o e-mail) continua existindo até ser apagada pelo
  operador. Idem `/billing/{escola}`, que só o operador acessa.

## Como a exclusão funciona

`planoExclusao` (em `src/domain/dadosEscola.js`) apaga na ordem que as regras
do banco permitem: primeiro os outros membros (ninguém mais grava enquanto a
escola é apagada), depois estado, fotos e backups, depois config e vitrine
(exigem ser dono) e, por último, o próprio dono. Se parar no meio, o erro diz
onde, e repetir termina o serviço. Coberto por `test/dados-smoke.jsx`, que
confere cada passo contra as regras.
