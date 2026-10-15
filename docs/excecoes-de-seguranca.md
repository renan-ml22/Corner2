# Exceções de segurança conhecidas

Ao rodar `npm audit` (com as dependências de desenvolvimento) aparecem **5 achados de severidade alta**. Eles estão aceitos de propósito, pelos motivos abaixo. O CI roda `npm audit --omit=dev --audit-level=high`, que cobre só o que vai para o site publicado e hoje dá **0 vulnerabilidades**.

| Pacote | Falha | Por que não dá para corrigir | Por que não afeta o app |
|---|---|---|---|
| `braces` ≤ 3.0.3 (GHSA-vfj7-8cjw-p6xm) | Negação de serviço com padrões de glob profundamente aninhados | A 3.0.3 é a **última versão publicada**; não existe versão corrigida | Só o lint usa (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). Roda na máquina de desenvolvimento e no CI, sobre arquivos do próprio repositório, nunca sobre dado de usuário. Não entra no build do site |
| `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next` | Os mesmos 4 acima, só por dependerem do `braces` | Idem | Idem |

A única "correção" que o `npm audit fix --force` oferece é voltar o `eslint-config-next` para a versão 14, o que quebra o lint do Next 16.

## Quando rever

- A cada atualização do `eslint-config-next` ou do Next: rode `npm audit` e veja se o `braces` saiu da cadeia ou ganhou uma versão corrigida.
- Se o app passar a processar glob vindo de usuário (não é o caso hoje), esta exceção deixa de valer.
