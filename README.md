# AVIZ

Gestão de faltas e reposições para negócios que funcionam em turmas recorrentes
(escolas de arte, música, dança, luta, natação, idiomas, pilates, terapia).

> A planta completa do produto está em [`PLANTA.md`](./PLANTA.md).

## Stack

- **Frontend:** React + Vite (build antecipado, sem Babel no navegador).
- **Backend:** Firebase (Realtime Database + Auth + Cloud Functions). *A plugar.*
- **Hospedagem:** Cloudflare Pages (grátis) → `aviz.pages.dev` enquanto não houver domínio.

## Rodar localmente

```bash
npm install
npm run dev      # abre o Vite
npm run build    # gera dist/ (o que a Cloudflare publica)
```

Como ainda não há domínio próprio, a escola é resolvida pela querystring:
`http://localhost:5173/?e=nome-da-escola`. Painel do aluno: `?c=CODIGO`.

## Estado atual

Esqueleto da Fase 1 (fundação multi-tenant). Resolve o tenant pelo endereço e
roteia entre painel da escola e painel do aluno. Firebase, Auth e as telas reais
entram em seguida — ver ordem de construção na PLANTA.
