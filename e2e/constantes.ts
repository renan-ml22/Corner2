// Credenciais SÓ para os testes de navegador: o servidor de teste sobe com elas (veja playwright.config.ts).
// Não têm relação com o usuário real nem com as variáveis da Vercel.
export const E2E_EMAIL = 'e2e@corner.test'
export const E2E_SENHA = 'senha-de-teste-e2e'
export const E2E_SESSION_SECRET = 'segredo-de-sessao-apenas-para-testes-e2e-0123456789'

/** Id do usuário de teste no app (definido em lib/users.ts): parte das chaves do localStorage. */
export const E2E_USUARIO_ID = 'u_test'

export const E2E_PORTA = 3100
