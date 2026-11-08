# Tutorial em PDF ("Guia completo do AVIZ")

Gera o PDF com o passo a passo de todas as telas, com capturas reais do app.
Refaça sempre que uma tela mudar.

```bash
npm run tutorial                         # capturas + PDF
node scripts/tutorial/capturar.mjs turmas link   # refaz só algumas capturas
node scripts/tutorial/montar-pdf.mjs     # só remonta o PDF
```

Sai em `scripts/tutorial/saida/AVIZ-guia-completo.pdf` (fora do git). A versão
entregue vai para o repositório aviz-equipe (`tutorial/`).

Como funciona:

- `app-falso.jsx` + `vite.config.mjs`: o app de verdade, com o Firebase trocado
  por um banco em memória (`firebase-falso.js`) e as rotas `/api` atendidas no
  navegador. Nada fala com o banco de produção.
- `cenario.js`: a escola fictícia Ateliê Barro Bom (a do vídeo,
  `scripts/escolaDemo.js`) com notas, créditos, aula extra, foto da lista etc.
  As datas saem do dia em que roda.
- `cenas.mjs`: cada captura (toques, recorte e marcadores numerados).
- `capturar.mjs`: abre cada cena no Chromium do Playwright (celular de 390 px,
  no endereço de produção desviado para o servidor local) e grava as imagens.
- `tutorial.html`: o texto e a diagramação. `montar-pdf.mjs` imprime duas
  vezes: a primeira só para descobrir as páginas do sumário.

Precisa: Playwright com Chromium (já vem no ambiente dos agentes) e `pdftotext`
(poppler-utils). Fontes: Inter instalada no sistema.
