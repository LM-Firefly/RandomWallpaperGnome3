import { defineConfig } from 'vite';

// Tauri 2 default Vite configuration.
export default defineConfig(async () => ({
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: '127.0.0.1',
        watch: {
            ignored: ['**/src-tauri/**'],
        },
    },
    build: {
        target: 'esnext',
        minify: 'esbuild',
        sourcemap: true,
    },
}));
