#!/usr/bin/env bash
# Testes de fumaça do AVIZ.
#
# Por que existem: um identificador usado sem import não quebra o build — o
# bundler trata como global e o erro só aparece em runtime, como tela branca.
# Já aconteceu. Estes testes montam um estado de verdade, renderizam cada tela
# e abrem os acordeões e modais, que é onde esse tipo de erro se esconde.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── domínio ──"
node test/domain-smoke.mjs

echo
echo "── render ──"
# O esbuild precisa rodar de dentro do projeto para resolver react/react-dom.
./node_modules/.bin/esbuild test/render-smoke.jsx \
  --bundle --platform=node --format=cjs --outfile=./.render-smoke.cjs \
  --loader:.jsx=jsx --jsx=automatic --log-level=error
trap 'rm -f ./.render-smoke.cjs' EXIT
node ./.render-smoke.cjs
