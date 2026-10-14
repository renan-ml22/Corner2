import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Datas dependem do fuso: fixar evita testes que passam num computador e falham no CI.
    env: { TZ: 'America/Sao_Paulo' },
  },
})
