import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Served from https://delwing.github.io/arkadia-spis-zlomu/
export default defineConfig({
    base: '/arkadia-spis-zlomu/',
    plugins: [react()],
    server: { port: 5181 },
    test: { environment: 'node' },
});
