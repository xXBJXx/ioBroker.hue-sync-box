import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    plugins: [react()],
    build: {
        outDir: '../admin',
        emptyOutDir: false,
        sourcemap: false,
        rollupOptions: {
            input: {
                index: resolve(import.meta.dirname, 'index.html'),
                tab: resolve(import.meta.dirname, 'tab.html'),
            },
        },
    },
});
