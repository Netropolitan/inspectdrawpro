import { defineConfig } from 'vite';
import { resolve } from 'path';
// Custom domain (inspectdrawpro.com) serves at root, so base is '/'.
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
});
