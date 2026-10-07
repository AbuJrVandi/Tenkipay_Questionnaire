import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://127.0.0.1:3001' } }, build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules')) { if (/recharts|d3-|victory-vendor|react-smooth|decimal.js/.test(id)) return 'charts'; if (/react-dom|\/react\//.test(id.replaceAll('\\', '/'))) return 'react'; } } } } } });
