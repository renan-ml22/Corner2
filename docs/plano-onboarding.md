# Corner — Onboarding e contas de usuário

Estado: **pronto e verificado de ponta a ponta no navegador contra o Supabase de verdade** (cadastro pela tela, os 4 passos, dados no banco, sair e entrar, segundo aparelho). Falta publicar na `main`.

## O fluxo

| Passo | Rota | O que a pessoa faz | O que fica salvo |
|---|---|---|---|
| 1 | `/onboarding` (pública) | nome completo, e-mail e senha | usuário no Supabase Auth (já confirmado) e sessão aberta |
| 2 | `/onboarding/nivel` | escolhe Iniciante, Intermediário ou Avançado | experiência na configuração (`profiles`) |
| 3 | `/onboarding/frequencia` | escolhe 2, 3, 4 ou 5 dias por semana | meta semanal (`profiles.days_per_week`) |
| 4 | `/onboarding/plano` | vê o plano recomendado e clica em "Começar agora" | plano em `active_plans`, `onboardingFeito`, e segue para `/hoje` |

- Quem **já está logado** e abre `/onboarding` vai direto para `/hoje`. Os passos 2 a 4 exigem login.
- O passo 1 fica na tela de login como "Criar conta", **só quando o Supabase está configurado**.
- Cada passo mostra "Passo n de 4" e uma barra de progresso. Voltar mantém a escolha anterior.
- "Começar agora" tenta levar tudo para a conta antes de abrir o app (espera até 4 s). Sem rede, o app abre assim mesmo e o que ficou pendente é enviado depois.

### Plano recomendado

| Nível | Dias | Plano | Semanas | Dias/semana do plano |
|---|---|---|---|---|
| Iniciante | qualquer | Fundamentos | 4 | 3 |
| Intermediário | qualquer | Base Aeróbica | 6 | 4 |
| Avançado | 2 a 4 | Técnica Avançada | 4 | 4 |
| Avançado | 5 | Pré-competição | 6 | 5 |

A **meta semanal** é o que a pessoa pode treinar, limitada ao que o plano pede. A tela explica os dois casos (menos dias do que o plano pede, ou mais). Se o plano faz parte de uma assinatura que a pessoa não tem, a tela avisa e oferece o teste grátis; o plano fica guardado e a tela de assinatura o libera depois.

O nível é guardado como a experiência que o app já usava: Iniciante = menos de 1 ano, Intermediário = 1 a 3 anos, Avançado = mais de 3 anos. Na coluna `profiles.level` aparece em palavras (`iniciante`, `intermediario`, `avancado`).

## Como as contas funcionam

- **Supabase Auth guarda e confere e-mail e senha.** O app continua usando a **sua própria sessão** (cookie assinado de 7 dias). Ao criar a conta ou entrar, o servidor grava na sessão o id (uuid do Supabase), o e-mail e o nome, e o app lê o usuário dali, sem consultar o Supabase a cada página.
- **O usuário de teste** (variáveis de ambiente, id `u_test`) continua entrando como antes e **nunca** é conferido no Supabase. O e-mail dele é reservado: não dá para criar uma conta com ele.
- Os dados de cada pessoa ficam nas mesmas tabelas, com `user_id` = uuid da conta.
- O cadastro cria a conta **já confirmada**, sem e-mail de confirmação (veja as limitações).

### Regra de ouro: ninguém entra pelo cliente compartilhado

O servidor usa um cliente do Supabase para dados e para criar contas. Entrar (`signInWithPassword`) por esse mesmo cliente o faria guardar a sessão da pessoa, e **todas as consultas seguintes passariam a rodar com o papel dela**: o salvamento de dados falharia com "permission denied" para todo mundo naquele servidor. O teste de fumaça contra o Supabase real pegou esse defeito. Por isso:

- cada login usa um cliente novo e descartável (`criarClienteParaEntrar`);
- o cliente compartilhado **recusa** qualquer forma de entrar (`getSupabase`), então o erro é impossível, e não só desaconselhado.

## Segurança

O que protege:
- senha de 8 a 72 bytes (o Supabase corta em 72 em silêncio, então recusamos mais que isso), nunca em log, mensagem de erro, resposta nem de volta ao campo;
- e-mail normalizado (minúsculas, sem espaços), a mesma resposta para senha errada e e-mail desconhecido;
- login com o Supabase fora do ar mostra "não foi possível entrar agora", e nunca "senha incorreta";
- sessão assinada: trocar o nome, o e-mail ou o id dentro do cookie invalida a assinatura;
- o id da sessão precisa ser o do usuário de teste ou um uuid; qualquer outra coisa vale como "não logado";
- quem já está logado não consegue criar outra conta por cima da sessão;
- logs só registram status e código do erro do Supabase, nunca a mensagem (que pode citar o e-mail).

## Limitações conhecidas (leia antes de abrir o app ao público)

- **O cadastro é aberto e não confirma o e-mail.** Qualquer pessoa com o endereço do site cria uma conta com qualquer e-mail, inclusive de outra pessoa. Não há captcha nem limite de cadastros por IP. Para uso público: e-mail de confirmação (exige um serviço de e-mail próprio no Supabase, porque o padrão envia poucos e-mails por hora) e proteção contra cadastros em massa. Consequências concretas:
  - **Tomada prévia de um e-mail alheio:** alguém cria a conta com o e-mail de outra pessoa, que depois recebe "este e-mail já tem uma conta" e não consegue se cadastrar nem recuperar (não há "esqueci a senha").
  - **Teste grátis ilimitado:** cada conta nova ganha os 7 dias de teste de um plano pago, sem cartão. Contas em massa dão acesso pago de graça.
  - **Armazenamento:** cada conta pode gravar até 3 MB por envio; contas em massa enchem o plano gratuito do Supabase.
- **O limite de tentativas do Supabase é por endereço de IP, e todos os logins saem do IP do servidor.** Alguém pode esgotar o limite com tentativas erradas e impedir o login das contas do Supabase por alguns minutos (a tela mostra "Muitas tentativas em pouco tempo. Aguarde alguns minutos"). O usuário de teste não é afetado. Confira o limite em Authentication → Rate Limits no painel do Supabase; a solução definitiva é captcha ou um limite próprio.
- **Sessão válida, mas sem usuário:** se as variáveis `AUTH_TEST_*` forem removidas enquanto o usuário de teste está logado, o app entra em laço de redirecionamento até o cookie expirar. Limpar os cookies do site resolve. Não acontece com contas do Supabase.
- **A sessão dura 7 dias e não é revogada.** Apagar um usuário no Supabase não derruba quem já está logado até a sessão expirar.
- **O cadastro revela se um e-mail já tem conta** ("este e-mail já tem uma conta"). É a escolha de usabilidade mais comum; o login, ao contrário, nunca revela.
- **Não há "esqueci a senha", troca de senha nem exclusão de conta** ainda. Exclusão é obrigação da LGPD antes de abrir ao público.
- **Termos de uso e política de privacidade** ainda não existem e devem ser aceitos no cadastro antes de abrir ao público.
- Quem criou conta e abandonou no meio do onboarding entra direto em `/hoje`, sem plano. O perfil de atleta (Perfil → Montar perfil de atleta) continua disponível.

## O que a revisão de segurança achou e foi corrigido

Uma segunda leitura independente do código achou, entre outras coisas:
- **Regex de e-mail com custo quadrático (ReDoS):** um e-mail hostil de 200 KB levava **35 segundos de CPU** para ser recusado, e o formulário aceita até 1 MB (cerca de 13 minutos). Qualquer pessoa, sem login, podia travar o servidor. A regex agora é linear, o tamanho é conferido antes dela, e há testes com entradas de 1 MB. O login (que já tinha o problema) usa a mesma conferência.
- **Limite de tentativas do Supabase** aparecia como "serviço fora do ar": agora tem mensagem própria.
- **Sessões sobrando no Supabase:** cada login criava uma sessão que nunca era encerrada; agora é encerrada logo depois de conferir a senha.
- **Cliente compartilhado:** a trava que recusa entrar passou a cobrir também `signUp`, `refreshSession`, `reauthenticate` e `linkIdentity`.

Não há como forjar sessão, colidir com o usuário de teste, acessar dados de outra pessoa nem vazar a chave de serviço para o navegador (conferido e coberto por testes).

## Como testar

- `npm test`: regras (`tests/onboarding.test.ts`), contas (`tests/contas.test.ts`, `tests/cadastro.test.ts`), login e sessão (`tests/users.test.ts`, `tests/session.test.ts`) e o cliente compartilhado (`tests/supabase-banco.test.ts`).
- `npm run e2e`: `e2e/onboarding.spec.ts` (cadastro sem Supabase, fluxo completo, teclado, volta, acessibilidade). O servidor de teste não tem Supabase, então criar conta de verdade não entra aqui.
- `npm run supabase:fumaca`: contra o Supabase **de verdade**: cria uma conta, entra, recusa senha errada e e-mail repetido, confere perfil e plano, e **apaga o usuário e os dados** no fim.

### Roteiro manual (com as variáveis do Supabase no `.env.local`)

1. `npm run dev`, abra `/login` e clique em **Criar conta**.
2. Preencha nome, e-mail e senha de 8+ caracteres e continue.
3. Escolha o nível, os dias e confira o plano. Clique em **Começar agora**: abre o `/hoje`.
4. No Supabase (Authentication → Users) a conta aparece; no Table Editor, `profiles` e `active_plans` têm os seus dados.
5. Saia (Perfil → Sair) e entre de novo com o mesmo e-mail e senha.

## Na Vercel

Nada novo: as duas variáveis do Supabase (`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`) passam a servir também para o cadastro e o login. **Sem elas**, o link "Criar conta" some e o cadastro responde "ainda não está disponível neste ambiente".
