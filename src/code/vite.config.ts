import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {validateEnvironment} from './lib/environment';
import {validateStagingEnvironment,STAGING_CSP} from './lib/stagingEnvironment.mjs';

export default defineConfig(({ command, mode }) => {
  const staging=mode==='staging';
  const env = staging?process.env:{ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if(staging){const error=validateStagingEnvironment(env);if(error)throw new Error(error);}
  if (command === 'build' || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    const error = validateEnvironment(env, command === 'build'&&!staging);
    if (error) throw new Error(error); // Never print variable values or credentials.
  }
  return {
    envDir:staging?false:undefined,
    plugins: [react(), tailwindcss()],
    build: {outDir:staging?'dist-staging':'dist', rollupOptions: { output: { manualChunks(id) {
      if (id.includes('/node_modules/@supabase/')) return 'supabase';
    } } } },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      ...(staging?{host:'127.0.0.1',port:3001,strictPort:true,headers:{'Content-Security-Policy':STAGING_CSP,'Cache-Control':'no-store'}}:{}),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
