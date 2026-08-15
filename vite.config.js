import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Remove type="module"/crossorigin do HTML final: o bundle já é gerado como
// script clássico (IIFE), mas o Vite ainda marca a tag como módulo por padrão,
// o que faz o navegador bloquear o carregamento via file:// (CORS) quando
// alguém testa abrindo dist/index.html direto, sem servidor.
function classicScriptHtml() {
  return {
    name: 'classic-script-html',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin /g, '<script defer ')
        .replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), classicScriptHtml()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Gera um script clássico (não ES module) para funcionar tanto abrindo
    // o index.html direto via file:// quanto hospedado (Netlify).
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
