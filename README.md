# AVIZ

Gestão de faltas e reposições para negócios que funcionam em turmas recorrentes
(escolas de arte, música, dança, luta, natação, idiomas, pilates, terapia).

> A planta completa do produto está em [`PLANTA.md`](./PLANTA.md).

## Stack

- **Frontend:** React + Vite (build antecipado, sem Babel no navegador).
- **Backend:** Firebase (Realtime Database + Auth) + um Cloudflare Worker para a fatia do aluno (`worker/index.js`).
- **Hospedagem:** Cloudflare Workers (grátis) — app e Worker no mesmo deploy (`wrangler deploy`).

## Rodar localmente

```bash
npm install
npm run dev      # abre o Vite
npm run build    # gera dist/ (o que a Cloudflare publica)
```

Como ainda não há domínio próprio, a escola é resolvida pela querystring:
`http://localhost:5173/?e=nome-da-escola`. Painel do aluno: `?c=CODIGO`.

## Publicar (deploy)

Produção só sai da branch `main`:

1. Trabalho novo vai numa branch própria e vira PR para a `main`.
2. O workflow **Checagem** roda testes e build no PR (sem publicar nada).
3. PR revisado e verde → merge na `main` → o workflow **Deploy no Cloudflare**
   roda os testes de novo e publica.

Nenhuma outra branch publica. Dá para refazer um deploy na mão pela aba Actions
(só na `main`).

## Estado atual

Esqueleto da Fase 1 (fundação multi-tenant). Resolve o tenant pelo endereço e
roteia entre painel da escola e painel do aluno. Firebase, Auth e as telas reais
entram em seguida — ver ordem de construção na PLANTA.
