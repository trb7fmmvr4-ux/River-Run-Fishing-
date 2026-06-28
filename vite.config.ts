import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    target: 'es2022'
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    typecheck: { tsconfig: './tsconfig.test.json' }
  }
});
