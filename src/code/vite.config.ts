import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {validateEnvironment} from './lib/environment';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (command === 'build' || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    const error = validateEnvironment(env, command === 'build');
    if (error) throw new Error(error); // Never print variable values or credentials.
  }
  return {
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { output: { manualChunks(id) {
      if (id.includes('/node_modules/@supabase/')) return 'supabase';
    } } } },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
