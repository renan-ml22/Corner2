# Plano Cornerman e área de gestão de alunos — desenho

Data: 26/10/2026 · Estado: **aguardando aprovação** · Quem pediu: Renan (dono do produto)

## Intenção

Dar ao **treinador de boxe** um lugar no Corner: cadastrar os próprios alunos, ver como cada um está treinando e sugerir planos de treino. É um plano pago novo, o **Cornerman**, e abre um segundo tipo de cliente (o treinador), além do atleta. A **foto de perfil** entra junto, para todos os planos, porque o painel do treinador fica muito mais claro com rostos.

## Metas

- Plano Cornerman a R$ 63,90/mês (R$ 6 abaixo do Profissional), com tudo do Iniciante e do Amador.
- Treinador cadastra até 20 alunos: à mão (ficha) ou convidando o aluno a usar o app.
- Painel "Meus Alunos" com status de treino (verde, amarelo, vermelho), perfil do aluno e histórico.
- Treinador sugere um plano; o aluno recebe um aviso na tela Hoje e aceita ou recusa.
- Foto de perfil 200×200 para todos.

## Não-metas

- Chat, agenda, cobrança do aluno pelo treinador, turmas, notificação push, e-mails que não sejam o convite.
- O treinador **registrar treinos** de aluno que não tem conta.
- Limites de planos ativos ("1 plano ativo" no gratuito) e "análise avançada de performance": não existem hoje, não serão inventados nem anunciados.
- Mais de um treinador ativo por aluno.

## Anti-metas (seria falha mesmo que "funcionasse")

- O treinador ver dado de saúde do aluno (lesões, peso, pancadas na cabeça, check-ins).
- Qualquer dado de aluno chegar ao navegador do treinador sem checagem **no servidor** de plano e vínculo.
- Mudar preço, nível ou acesso de quem já assina Iniciante, Amador ou Profissional.

## Restrições do que já existe

- **Planos:** a fonte única é `lib/assinatura/catalogo.ts` (níveis `iniciante`, `amador`, `profissional`; Stripe com `lookup_key` `<nivel>_<periodo>`; anual = 10 mensalidades). Cornerman entra ali como nível novo **entre Amador e Profissional**; o Profissional passa a incluir o que for do Cornerman (a ordem dos níveis já faz isso). Não se cria `data/planos-assinatura.ts` (seria uma segunda fonte).
- **Banco:** `profiles.id` e `user_id` são **texto** (ids do Supabase Auth são uuid em texto; o usuário de teste é `u_test`). Todas as tabelas têm RLS ligado, **sem política**, e `revoke` para `anon` e `authenticated`: só o servidor fala com o banco, com a chave secreta. As tabelas novas seguem o mesmo padrão. O SQL do pedido (`REFERENCES profiles(id)` com `uuid`) não serve como está.
- **Trava de plano hoje é só na tela.** Aqui ela passa a ser também no servidor: rota do treinador consulta o estado da assinatura (Stripe, com o cache assinado de 5 min que já existe) antes de devolver qualquer coisa.
- A sessão é do próprio app (cookie assinado); o Supabase Auth só guarda e-mail e senha.
- Stack: Next 16 (App Router, ler `node_modules/next/dist/docs/` antes de escrever), TypeScript estrito, CSS Modules, Phosphor, tema escuro com oklch, sem Tailwind e sem biblioteca nova. Textos em português; textos de avisos em `lib/textos.ts`.

## Abordagens consideradas

- **A. Tudo pelo servidor, no padrão atual (escolhida).** Tabelas fechadas; rotas `/api/cornerman/*` conferem sessão, plano e vínculo; testável com banco de mentira.
- **B. Navegador direto no banco com RLS por linha.** Refatoração do app inteiro (login, sincronização). Descartada.
- **C. Só fichas agora, vínculo depois.** Deixa de fora o acompanhamento, que é o centro do pedido. Descartada.

## Decisões já tomadas com o Renan

- Aluno cadastrado à mão é só **ficha** (nome, contato, nível, estilo, notas, foto, plano sugerido). Treino, esforço e quiz aparecem só para aluno com conta que aceitou o convite.
- Aluno com conta só aparece para o treinador **depois de aceitar**, e pode se desvincular quando quiser.
- Cornerman: R$ 63,90, entre Amador e Profissional, inclui Iniciante e Amador.
- Entrega em 4 etapas, nessa ordem, cada uma testada e publicável sozinha.

## Decisões minhas (marcadas como minhas; corrija o que não servir)

1. **Uma linha por aluno do treinador**, em `coach_alunos`: `coach_id`, dados da ficha (nome, e-mail, telefone, nível, estilo, notas, foto), `aluno_user_id` (vazio até o aluno aceitar), `status` (`ativo`, `convidado`, `encerrado`). Ao aceitar o convite, a **mesma linha** ganha o `aluno_user_id`: a ficha vira vínculo, sem duplicar. As **notas do treinador ficam nessa linha**, não no perfil do aluno (o aluno não vê, e outro treinador nunca herda).
2. **O plano do usuário não é gravado em `profiles`.** A fonte é o Stripe; uma coluna `plano` seria uma cópia que pode ficar errada ou ser adulterada. Fora também `estilo_boxe`/`is_southpaw` em `profiles`: o estilo vem do quiz.
3. **Limite de 20** conta fichas e vínculos com status diferente de `encerrado`, conferido no servidor ao criar (e ao aceitar um convite).
4. **O que o treinador vê de aluno com conta** (e só isso): nome, foto, nível, estilo, resultado do quiz e atleta compatível; do histórico, **dos últimos 30 dias**, data, tipo, rounds, minutos por round, esforço (RPE) e duração; plano ativo. **Nunca** lesões, peso, check-ins nem `sparring_head`. A rota monta a resposta campo a campo (lista de permitidos), não repassa a linha do banco.
5. **Quiz passa a ser guardado** (as 5 respostas, ex.: `01203`) no perfil do aluno, para o painel mostrar estilo e atleta compatível sem refazer o quiz. Segue o padrão de entidades já existente (local primeiro, sincroniza com a conta).
6. **Foto:** o navegador recorta ao centro e reduz a 200×200 (JPEG, qualidade 0,8, ~10 KB); o servidor só aceita `data:image/jpeg;base64,…` até 60 KB. A foto é uma entidade nova, `foto`, no padrão de entidades que já existe (guardada no aparelho, sincronizada com a conta em `user_data`, texto vazio = sem foto), em vez de uma coluna `profiles.avatar_url`: `profiles` é reescrita inteira a cada mudança de configuração, e a entidade já traz o "local primeiro", a fusão e a fila de envio, sem SQL novo na etapa 1. O treinador lê a foto do aluno no servidor, de `user_data`. Na ficha manual, a foto fica em `coach_alunos`.
7. **Convite por link e por e-mail (decidido pelo Renan: os dois).** O treinador gera um convite (token aleatório, guardado só como hash, vale 14 dias, uso único). O **link** é sempre o convite de verdade: ele copia ou compartilha (`navigator.share` / WhatsApp). O **e-mail** é um segundo jeito de entregar o mesmo link: botão "Enviar por e-mail" na ficha, para o e-mail cadastrado nela. O aluno abre `/convite/<token>`, entra ou cria a conta e aceita. A aba "Convidar" lista os convites pendentes (com "enviado por e-mail em…"), permite reenviar e cancelar.
   - **Como o e-mail sai:** pelo servidor, chamando a API de um provedor de e-mail (proposta: Resend) com `fetch`, sem biblioteca nova. Não uso o convite do Supabase Auth: ele cria a conta do aluno por conta própria e não combina com a sessão própria do app.
   - **Depende de uma coisa fora do código:** o provedor só entrega para qualquer pessoa depois de **verificar um domínio** (registros DNS). Sem isso, só chega ao dono da conta do provedor. Enquanto as variáveis `EMAIL_API_KEY` e `EMAIL_REMETENTE` não existirem, o botão de e-mail fica desligado com a explicação "envio por e-mail ainda não configurado" e o link funciona normalmente. Assim o código entra na etapa 3 sem esperar o domínio, e o e-mail liga quando o domínio estiver pronto.
   - **Proteção:** no máximo 20 e-mails de convite por treinador por dia, 1 reenvio a cada 10 minutos por convite, só para o e-mail da própria ficha (o treinador não digita destinatário solto: o app não vira disparador de spam). O e-mail leva só o nome do treinador, o botão e o link, sem notas, telefone nem dados de outros alunos.
   - **Privacidade:** o e-mail do aluno passa a ir para o provedor; entra na política de privacidade do pacote LGPD.
8. **Sugestão de plano** (`coach_suggestions`): só para aluno com conta vinculada. Aluno aceita → o plano vira o ativo (pedindo confirmação se já tiver outro). Se o plano exigir um nível de assinatura que o aluno não tem, ele vê o convite ao plano e a sugestão continua pendente. Recusar encerra a sugestão. Mensagem opcional do treinador. Para ficha manual, a "sugestão" é só um registro no histórico da ficha.
9. **Se o treinador deixa de assinar:** o painel mostra a tela de upgrade; fichas e vínculos ficam guardados; o acesso aos dados do aluno para na hora (checagem no servidor).
10. **Um treinador ativo por aluno.** Convite de aluno que já tem treinador pede que ele se desvincule antes.
11. **Aba "Alunos"** na barra (ícone `ph-users-three`) só para Cornerman e Profissional, ao lado de Perfil, com selo de alunos em vermelho (7+ dias sem treinar; só vínculos com conta). Com 7 colunas a barra aperta: validar em 360 px de largura; se não couber, o rótulo encurta ou a aba substitui um atalho (decidir na etapa 4 vendo a tela).
12. **Status de treino, só por dias desde o último treino** (dias de calendário no fuso de São Paulo; sem depender de "semana", que cria faixas que se sobrepõem): 0 a 2 dias = verde; 3 a 6 = amarelo; 7 ou mais = vermelho; sem nenhum treino ou ficha manual = cinza ("sem dados"). Isso muda a frase do pedido ("verde = treinou essa semana") para uma regra sem buraco; o selo da aba "Alunos" conta os vermelhos.
13. Foto de perfil é do nível **gratuito** (o pedido a lista no Cornerman e também em "todos os planos"; vale a seção "todos os planos").
14. Nome do plano na vitrine: **Cornerman**. Os cartões de plano da tela de assinatura não têm ícone nem cor própria hoje, então o Cornerman também não ganha nenhum lá. O ícone (`ph-whistle` se existir na lista oficial do Phosphor 2.1.1; o teste `tests/icones.test.ts` confere) e a cor azul `oklch(0.66 0.16 258)` entram nas telas do treinador (etapas 2 e 4).

15. **Acesso do treinador após cancelar:** vale o cache assinado de 5 minutos que já existe (até 5 min de atraso, e só no sentido "ainda libera"); a rota não pergunta ao Stripe a cada pedido. O **teste grátis de 7 dias** do Cornerman conta como Cornerman (igual aos outros níveis hoje).
16. **Aceite do convite:** o link de uso único é a credencial; **não** se compara o e-mail da conta com o da ficha (o aluno pode ter outro e-mail). Quem recebe o link e o repassa dá acesso a quem aceitar primeiro: o texto na tela do convite diz isso ao treinador.
17. **Desvincular:** a linha vira `encerrado` e **mantém** a ficha e as notas do treinador; o `aluno_user_id` é limpo e o treinador perde todo acesso aos dados do aluno. Linha `encerrado` não conta no limite de 20 e pode ser reaberta com um novo convite (reaproveita a mesma ficha). O treinador também pode encerrar.
18. **Onboarding:** quem assina o Cornerman usa o mesmo onboarding de hoje (nível, dias por semana, plano) e ganha a aba "Alunos"; não há entrada própria de treinador.
19. **Quiz de quem já usa o app:** a primeira sincronização depois da atualização envia as respostas que já estão no aparelho, se o servidor ainda não tiver as do usuário. Sem isso o treinador veria "sem quiz" até a pessoa refazer.
20. **Várias sugestões:** no máximo **uma pendente por aluno**; uma nova sugestão substitui a pendente (a antiga fica no histórico como `substituida`).

## Etapas

1. **Plano e foto.** Nível `cornerman` no catálogo (preço, `lookup_key`, recursos, textos), `npm run stripe:sincronizar` (modo teste), tela de assinatura com o plano novo; foto de perfil (recorte no navegador, coluna, perfil).
2. **Fichas e painel.** Tabela `coach_alunos`, rotas `/api/cornerman/alunos`, página "Meus Alunos" (lista, contador "3 de 20", status), cadastro manual, perfil da ficha (visão geral e notas editáveis), tela de upgrade para quem não tem o plano.
3. **Convites e vínculo.** Tabela `coach_invites`, `/convite/<token>`, envio do link por e-mail (desligado até as variáveis existirem), aceite e desvinculação (seção "Meu treinador" no perfil do aluno), guarda do quiz, dados do aluno no painel (aba Treinos com gráfico semanal e filtro por tipo; atleta compatível).
4. **Sugestões e barra.** Tabela `coach_suggestions`, aba "Plano sugerido", banner na tela Hoje do aluno (ver plano, aceitar, recusar), selo "Sugerido pelo seu treinador [Nome]" no plano, aba "Alunos" com selo na barra.

Cada etapa: testes primeiro (unidade com banco de mentira, navegador com a API simulada, axe), `npm run supabase:fumaca` ampliado, SQL idempotente em arquivo novo (`supabase/cornerman-etapa-N.sql`) mais `supabase/schema.sql` atualizado, doc em `docs/`.

## Segurança e privacidade (pontos de atenção)

- Toda rota nova: pedido que muda algo só vale se vier do próprio site; usuário vem **sempre da sessão**; id de aluno do corpo do pedido é conferido contra `coach_alunos` do treinador da sessão (nunca confiar em id vindo do navegador).
- Token de convite: aleatório (32 bytes), só o hash vai ao banco, expira, uso único, limite de tentativas.
- Mensagens de erro iguais para "não existe" e "não é seu" (não revelar quais ids existem).
- Dados pessoais de terceiros (contato e notas das fichas; alunos podem ser menores de idade): o treinador é quem responde por eles. Entra no pacote de LGPD já pendente (termos, política de privacidade, consentimento, apagar conta); esta funcionalidade **adiciona** itens a ele: apagar conta do treinador apaga as fichas; apagar conta do aluno desfaz o vínculo.
- Registro de erros sem e-mail, telefone nem notas.

## Variáveis de ambiente

Duas novas, **opcionais**, a partir da etapa 3: `EMAIL_API_KEY` (chave do provedor) e `EMAIL_REMETENTE` (ex.: `Corner <convites@seu-dominio>`). Sem elas o app funciona, só sem o botão de e-mail. As demais são as que já existem (Supabase, Stripe, `SESSION_SECRET`). Há um passo manual no Stripe de teste (`stripe:sincronizar`) e, em produção, o mesmo no Stripe real quando o pagamento sair do modo de teste.

## Perguntas em aberto (só o Renan responde)

Nenhuma bloqueia a construção. Para o e-mail ligar (não precisa estar pronto antes da etapa 3): qual domínio será usado como remetente (ex.: um subdomínio de `maisfocoformaturas.com.br`, se você tiver acesso ao DNS) e criar a conta no provedor. A chave vai pelo método da área de transferência, nunca no chat.

## O que fica para quem constrói

Nomes de colunas e arquivos, forma exata das rotas, onde guardar o quiz dentro do padrão de entidades, visual dos cartões e do gráfico semanal (CSS Module, sem biblioteca), textos finos em português.
