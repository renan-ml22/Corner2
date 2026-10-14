import { defineConfig } from '@playwright/test'
import { scryptSync } from 'node:crypto'
import { E2E_EMAIL, E2E_PORTA, E2E_SENHA, E2E_SESSION_SECRET } from './e2e/constantes'

// Testes de navegador (Chrome) contra o app em modo produção, com um usuário só de teste.
// Uso: `npm run e2e`. No CI o build já foi feito no passo anterior.

// Mesmo formato de lib/users.ts: "sal:hash" em base64url (scrypt, 64 bytes). Sal fixo: resultado previsível.
const sal = Buffer.alloc(16, 7)
const hashDaSenha = `${sal.toString('base64url')}:${scryptSync(E2E_SENHA, sal, 64).toString('base64url')}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  // Poucos navegadores por vez: muitos Chromes disputando CPU com o servidor deixam as páginas lentas demais.
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // No CI, o repórter `github` publica cada falha como anotação da execução (visível sem baixar logs).
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORTA}`,
    channel: 'chrome', // o Chrome já instalado (no GitHub Actions e na máquina de desenvolvimento)
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 420, height: 880 },
    acceptDownloads: true,
    serviceWorkers: 'block', // o service worker buscaria o CDN de ícones fora do alcance das respostas falsas
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CI ? `npx next start -p ${E2E_PORTA}` : `npm run build && npx next start -p ${E2E_PORTA}`,
    url: `http://localhost:${E2E_PORTA}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      SESSION_SECRET: E2E_SESSION_SECRET,
      AUTH_TEST_EMAIL: E2E_EMAIL,
      AUTH_TEST_NAME: 'Atleta de Teste',
      AUTH_TEST_PASSWORD_HASH: hashDaSenha,
    },
  },
})
