import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Otimizações de build para melhor performance
    target: 'esnext',
    minify: 'esbuild', // Mais rápido que terser
    cssMinify: true,
    sourcemap: false, // Desabilitar em produção para menor bundle
    rollupOptions: {
      output: {
        // Code splitting automático - deixar Vite decidir
        // Nomes de arquivos otimizados
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Otimizações de chunk size
    chunkSizeWarningLimit: 1000, // Avisar se chunk > 1MB
  },
  // Otimizações de dependências
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    // Não excluir recharts do optimizeDeps para evitar problemas com lodash
    esbuildOptions: {
      target: 'esnext',
    },
  },
}));
