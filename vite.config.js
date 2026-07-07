// ============================================================
// FILE: vite.config.js
// ============================================================
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        home: 'home.html',
        upload: 'upload.html',
        admin: 'admin.html',
        profile: 'profile.html',
        search: 'search.html',
        library: 'library.html'
      }
    },
    outDir: 'dist'
  }
});
