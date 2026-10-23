# Corner — Conta na nuvem (Supabase)

Estado: **código pronto e testado com um banco de mentira.** Falta você rodar o SQL no Supabase, me passar as credenciais certas e fazermos a verificação contra o banco de verdade (`npm run supabase:fumaca`). Sem as variáveis do Supabase o app funciona exatamente como antes (só com o aparelho).

## Decisões (suas)

- **Manter o login atual** (usuário de teste por variáveis de ambiente). O Supabase é só o armazenamento.
- **Tudo vai para o banco**: treinos, plano, configurações, check-ins, lesões, peso, reagendamentos e o estado do dia.

## Como funciona

```
Tela  ->  repositório sincronizado  ->  /api/dados (confere o login)  ->  Supabase (chave secreta)
          (aparelho primeiro)           id do usuário vem da sessão
```

- **O aparelho continua mandando na tela.** Toda leitura e gravação acontece na hora no `localStorage`; por isso o app funciona offline e a interface continua rápida.
- **Por que o servidor, e não o navegador, fala com o Supabase:** o login não é do Supabase, então o banco não tem como saber quem está pedindo. O servidor do Corner conhece a pessoa (pela sessão) e usa a chave secreta (`service_role`), que **nunca vai ao navegador**. As tabelas ficam com RLS ligado e **sem nenhuma política**: a chave pública não lê nem grava nada.
- **A chave `anon` não é usada pelo app.** Ela só serve ao script de verificação, para provar que a proteção funciona.

### O que cada tabela guarda

| Tabela | Conteúdo |
|---|---|
| `workouts` | um treino por linha (com sparring e nota), na ordem da lista do app (`position`) |
| `active_plans` | o plano ativo (no máximo um por usuário) |
| `profiles` | nome, nível, meta semanal e as configurações completas (`settings`) |
| `user_data` | check-ins, lesões, peso, reagendamentos, estado do dia, e marcas de "já gravado" |

Ficam **só no aparelho**, de propósito: `lembrete` (data do último aviso neste aparelho) e `assinatura` (cópia do que o Stripe informou).

### Reconciliação ao abrir o app

1. **Primeira vez que este aparelho encontra a conta**, se os dois lados têm dados diferentes: **funde** (listas viram a união; no mesmo id ou dia vale a versão da conta; o que só tem um valor, como o plano, fica com o da conta) e guarda o original do aparelho na **quarentena**. Nunca um lado sobrescreve o outro sem rede de segurança.
2. **Depois**, uma alteração feita neste aparelho e ainda não enviada **vence** a conta; o que não foi alterado aqui vem da conta.
3. **Gravar**: marca a entidade como pendente (guardado no aparelho, sobrevive a fechar o app) e envia depois de ~1,5 s. Ao esconder a aba, envia na hora de um jeito que termina mesmo com a aba sumindo.
4. **Se o envio falha** (sem rede, serviço fora): nada se perde. As pendências ficam e o app tenta de novo esperando 5 s, 15 s, 1 min e 5 min, e também quando a rede volta.

Em **Perfil → Backup dos dados** aparece a situação: "Tudo salvo na sua conta", "Sincronizando…" ou "A sua conta não respondeu agora".

## O que mudou em relação ao prompt original

| Prompt | O que foi feito | Por quê |
|---|---|---|
| `profiles.id uuid references auth.users` | `id text` | o login atual não é do Supabase; não existe `auth.users` |
| `user_id uuid` | `user_id text` | o id do usuário do app é `u_test` (e o app pode gerar ids que não são uuid fora de https) |
| `workouts.id uuid` | `id text`, chave `(user_id, id)` | os ids dos treinos nem sempre são uuid; a chave composta impede um usuário de sobrescrever o treino de outro |
| `rounds`, `round_min`, `rpe`, `duration_seconds` como `int` | `numeric` | o app aceita decimais (2,5 min por round); com `int`, um treino válido seria recusado e a sincronização travaria |
| `active_plans.started_at timestamptz` | `started_at date` | o plano começa numa data do calendário; com fuso, o dia poderia mudar na ida e volta |
| só 3 tabelas | + `user_data`, + colunas de sparring, nota, sessão e posição | o app guarda mais coisas; sem isso elas se perderiam |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local` | opcional, só para o script de verificação | o navegador não fala com o Supabase |
| `lib/supabase.ts` | criado, **só servidor** (`server-only`) | a chave secreta nunca pode ir ao navegador |

## Como ligar, passo a passo

1. **SQL:** Supabase → *SQL Editor* → *New query* → cole todo o [`supabase/schema.sql`](../supabase/schema.sql) → *Run*. Pode rodar de novo sem problema.
2. **Credenciais** (Supabase → *Project Settings → API*): a **Project URL** e a chave **service_role** (secreta; em projetos novos, *Secret key*). Elas vão para o `.env.local` como `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. **Não cole a chave secreta no chat**: copie com o ícone do painel e peça para eu gravar a partir da área de transferência.
3. `npm run verificar-env` confere o formato (URL com 20 letras e números, chave inteira, papel `service_role`, mesmo projeto da URL).
4. `npm run supabase:fumaca` exercita tudo contra o banco de verdade com dois usuários de mentira e limpa o que criou.
5. `npm run dev`, entre e use o app. As tabelas passam a receber os seus dados.
6. **Vercel** (produção): cadastre as **duas** variáveis em *Settings → Environment Variables → Production* (marque a chave como *Sensitive*) e faça um novo deploy.

## Roteiro de teste manual

1. Abra o app com dados já registrados no aparelho. Em **Perfil → Backup dos dados** deve aparecer "Tudo salvo na sua conta".
2. No painel do Supabase (*Table Editor*), confira `workouts`, `profiles` e `user_data` com as suas informações.
3. Registre um treino. Em poucos segundos ele aparece em `workouts`.
4. Abra o app num segundo navegador (ou aba anônima), entre com o mesmo usuário: o histórico vem da conta.
5. Desligue a internet, registre um treino: a tela mostra "A sua conta não respondeu agora…". Ligue de novo: ele sobe sozinho.

## Limitações conhecidas

- **Dois aparelhos usados ao mesmo tempo:** cada entidade é enviada inteira e vale a última que chegar. Se você registrar treinos em dois aparelhos offline e depois conectar os dois, o último a enviar prevalece naquela entidade. A fusão linha a linha só acontece na primeira vez de cada aparelho.
- **Um usuário só** (`u_test`). Para várias pessoas, o próximo passo é migrar o login para o Supabase Auth, trocar `user_id` por `uuid` e as regras de linha por `auth.uid()`.
- **Mudar o formato de uma entidade** exige migrar também as linhas do banco: a versão do esquema (`VERSAO_ESQUEMA`) só é aplicada aos dados do aparelho.
- **Sair da conta não apaga os dados do aparelho** (já era assim). Em aparelho compartilhado, limpe os dados do site no navegador.
- **O bloqueio de recursos por plano continua só na tela.** Com o banco, dá para movê-lo para o servidor.
