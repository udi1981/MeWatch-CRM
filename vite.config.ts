import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        proxy: {
          '/wixapi': {
            target: 'https://www.wixapis.com',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/wixapi/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.WIX_SITE_ID': JSON.stringify(env.WIX_SITE_ID),
        'process.env.WIX_AUTH_TOKEN': JSON.stringify(env.WIX_AUTH_TOKEN)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
