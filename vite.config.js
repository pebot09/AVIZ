import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AVIZ — build de produção antecipado (sem Babel no navegador do cliente).
export default defineConfig({
  plugins: [react()],
});
