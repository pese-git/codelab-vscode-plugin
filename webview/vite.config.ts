import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css') {
            return 'index.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown': ['marked', 'highlight.js']
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
