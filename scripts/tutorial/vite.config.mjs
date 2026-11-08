// Vite só para o tutorial: o app de verdade, com o Firebase trocado pelo de
// mentira e a página inicial apontando para app-falso.jsx.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../..');

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AVIZ</title></head>
<body><div id="root"></div>
<script type="module" src="/scripts/tutorial/app-falso.jsx"></script></body></html>`;

function paginaDoTutorial() {
  return {
    name: 'pagina-do-tutorial',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const caminho = (req.url || '/').split('?')[0];
        const ehPagina = caminho === '/' || caminho === '/index.html' || caminho === '/termos' || caminho === '/privacidade';
        if (!ehPagina) return next();
        const html = await server.transformIndexHtml(req.url, HTML);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  root: raiz,
  configFile: false,
  plugins: [react(), paginaDoTutorial()],
  resolve: {
    alias: [
      { find: /^firebase\/(app|database|auth)$/, replacement: path.join(aqui, 'firebase-falso.js') },
    ],
  },
  server: { port: 5199, strictPort: true, host: 'localhost', hmr: false },
  logLevel: 'warn',
});
