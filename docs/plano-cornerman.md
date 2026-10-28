# Plano Cornerman e gestão de alunos

Funcionalidade nova em 4 etapas. O desenho completo (decisões, segurança, o que ficou de fora) está em
`docs/superpowers/specs/2026-10-26-cornerman-design.md`. Este arquivo conta o que já foi entregue e como funciona.

## Etapa 1: plano e foto de perfil (pronta; Stripe de teste sincronizado em 27/10/2026)

### Plano Cornerman

- Novo nível de assinatura, **entre o Amador e o Profissional**: R$ 63,90 por mês ou R$ 639,00 por ano (10 mensalidades, como os outros).
- Inclui tudo do Iniciante e do Amador. **Não** inclui nada do Profissional. O Profissional inclui o Cornerman.
- Quem já assina Iniciante, Amador ou Profissional não muda de preço, de nível nem de acesso.
- O recurso exclusivo é `gestaoDeAlunos` (painel com até 20 alunos, fichas, notas e plano sugerido). A página dele chega na etapa 2: até lá, o cartão do plano já aparece na tela de assinatura, mas o pagamento está em modo de teste.
- Tudo mora em `lib/assinatura/catalogo.ts` (fonte única). Chave do preço no Stripe: `cornerman_mensal` e `cornerman_anual`.
- **Stripe de teste:** sincronizado em 27/10/2026 (produto "Corner Cornerman", `cornerman_mensal` e `cornerman_anual`, descrição do Profissional atualizada, Portal do Cliente atualizado; `npm run stripe:fumaca` passou). Se o catálogo mudar, rodar `npm run stripe:sincronizar` de novo (`-- --simular` mostra o que faria; só funciona com chave `sk_test_…`).

### Foto de perfil (todos os planos, inclusive o gratuito)

- Em **Perfil**: "Adicionar foto" / "Trocar foto" / "Remover foto". Sem foto, aparece a inicial do nome.
- O navegador recorta o centro da imagem em quadrado, reduz para **200×200** e guarda como JPEG (qualidade 0,8; se a imagem for muito granulada e o texto passar do limite, tenta 0,6 e 0,4). Aceita arquivo escolhido de até 15 MB e recusa o que não é imagem.
- Onde fica guardada: é a entidade `foto` do app (texto `data:image/jpeg;base64,…`). Texto vazio significa "sem foto". Vale o padrão de sempre: guarda no aparelho na hora e sincroniza com a conta em segundo plano (`user_data`, sem tabela nem coluna nova).
- O servidor só aceita JPEG nesse formato, com no máximo **60 000 caracteres** (uma foto normal tem uns 14 000). Qualquer outra coisa (SVG, PNG, `javascript:`, texto com lixo) é recusada com erro 400, e o pedido inteiro não grava nada.
- A foto **não** entra no arquivo de backup.
- Arquivos: `lib/foto.ts` (recorte, inicial, preparo), `hooks/useFoto.ts`, `components/FotoDePerfil.tsx`, `components/CabecalhoDoPerfil.tsx`.

### Como foi testado

- Testes de unidade para o catálogo, as regras de acesso, o Stripe (produtos, preços, portal), a validação da foto, a gravação no servidor e as regras de recorte.
- Testes de navegador (Chrome real): a tela de assinatura com 4 planos; a foto de ponta a ponta (recorte central de verdade, guardada como JPEG de 200×200, continua depois de recarregar, remoção, arquivo que não é imagem, arquivo quebrado, arquivo grande demais, acessibilidade com axe).
- `npm run supabase:fumaca` (Supabase real, só com usuários de teste que são apagados no fim): a foto vai e volta, e a remoção volta como texto vazio.

## Etapa 2: fichas e painel "Meus Alunos" (publicada em 27/10/2026; SQL aplicado e conferido no banco real)

### O que o treinador faz

Quem tem o plano Cornerman (ou o Profissional, que o inclui) abre **Perfil → Meus alunos** (`/alunos`):

- Vê a lista com o contador "**N de 20 alunos**", em ordem alfabética (sem diferenciar maiúsculas e acentos). Cada cartão mostra foto (ou inicial), nome, nível, estilo e o selo "Ficha manual". As fichas encerradas ficam recolhidas em "Encerrados (N)".
- **Novo aluno** (`/alunos/novo`): nome (obrigatório) e, se quiser, e-mail, telefone, nível, estilo, notas (até 2 000 caracteres) e foto (a mesma redução para 200×200 da foto de perfil).
- **Ficha** (`/alunos/<id>`), com duas abas: *Visão geral* (dados, e-mail e telefone como links, notas) e *Notas* (edição, com "Salvar notas"; trocar de aba com notas não salvas pergunta antes). Ali também: **Editar dados** (manda só o que mudou), **Encerrar ficha** (libera a vaga; pode ser reaberta), **Reabrir ficha** e **Apagar ficha** (de vez, com confirmação).
- Quem não tem o plano abre a página e vê o convite "Disponível a partir do plano Cornerman". O atalho no Perfil só aparece para quem tem o plano.

Todo aluno desta etapa é uma **ficha manual**: o selo diz "sem dados de treino". O status colorido (verde, amarelo, vermelho) só existe para aluno com conta e chega na etapa 3.

### Como funciona por baixo

- **Tabela `coach_alunos`** (`supabase/cornerman-etapa-2.sql`, também em `schema.sql`): mesmo padrão das outras (RLS ligado e sem política; só o servidor, com a chave secreta, fala com ela). Guarda nome, e-mail, telefone, nível, estilo, notas, foto, `aluno_user_id` (vazio até a etapa 3) e `status` (`ativo`, `convidado`, `encerrado`).
- **Limite de 20, garantido no banco:** um gatilho conta as fichas não encerradas do treinador ao criar e ao reabrir, com bloqueio por treinador (dois pedidos ao mesmo tempo na vaga 20: só um entra). O serviço traduz o erro do banco na mensagem "Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro." (409). Encerrada não conta. O 20 também está em `lib/cornerman/ficha.ts` (`LIMITE_DE_ALUNOS`): mudou lá, mude no SQL.
- **Plano conferido no servidor, em toda rota** (`lib/cornerman/acesso.ts`): sem Cornerman ou Profissional ativo (ou em teste, ou atrasado dentro dos 3 dias de tolerância), a resposta é 403 `plano_insuficiente`, inclusive nas rotas de leitura. Se o Stripe não responder, 502 (sem como saber o plano, não libera). O estado vem do cookie assinado de 5 minutos que já existia (lógica movida para `lib/assinatura/estado-servidor.ts`): **depois de cancelar, o acesso pode durar até 5 minutos**. Com o pagamento desligado no ambiente (sem `STRIPE_SECRET_KEY`), o app todo fica liberado, e esta área também.
- **Isolamento entre treinadores:** o id do treinador vem sempre da sessão; toda consulta ao banco filtra por `coach_id` **e** pelo id da ficha. Ficha de outro treinador, id que não existe e id que não é um uuid respondem exatamente igual (404 "Aluno não encontrado."). O corpo do pedido só aceita os campos da ficha: `coach_id`, `aluno_user_id`, `id` ou `status: "convidado"` recusam o pedido inteiro. A resposta monta a ficha campo a campo (não repassa a linha do banco; `aluno_user_id` vira `comConta: true/false`).
- **Rotas** (`app/api/cornerman/alunos`): `GET` e `POST` na lista; `GET`, `PATCH` e `DELETE` em `/<id>`. Pedido que muda algo só vale vindo do próprio site (403 `origem_invalida`); corpo de até 100 000 bytes (413 acima); JSON quebrado dá 400; sem Supabase, 503 `nao_configurado`.
- **Privacidade (dados de terceiros):** nome, e-mail, telefone e notas dos alunos são do treinador, que responde por eles. Nenhuma resposta de erro nem registro do servidor leva esses dados (o registro guarda só onde falhou). As notas aparecem na tela sempre como texto, nunca como HTML. Entram no pacote de LGPD já pendente: apagar a conta do treinador apaga as fichas.

### Passo do Renan

Colar `supabase/cornerman-etapa-2.sql` no **SQL Editor do Supabase** e rodar (é idempotente). Sem isso a tela abre, mas qualquer chamada à API de alunos falha no banco. Depois, `npm run supabase:fumaca` confere o isolamento entre treinadores, o limite de 20 e a corrida na vaga 20 de verdade (hoje ele imprime "PULOU" para esse bloco).

### Como foi testado

- Unidade: validação da ficha, serviço (com banco de mentira que imita o gatilho), banco (cliente do Supabase de mentira: todo pedido filtra pelo treinador), trava de plano (por nível e situação da assinatura, cookie de outro usuário ou adulterado, Stripe fora do ar), tradução de erros sem vazar dados, chamadas do navegador, aba acesa.
- Navegador (Chrome real): a API real sem banco (401, 403, 404, 503, 400, 413, nada repete o que foi enviado) e as telas com a API simulada em memória (lista, limite, cadastro com foto, duplo clique, sem conexão, ficha, notas, HTML nas notas, editar só o que mudou, encerrar, reabrir, apagar, cancelar as perguntas, teclado, axe, 360 px).

## Etapa 3a: convites e vínculo (publicada em 27/10/2026; SQL aplicado e conferido no banco real)

### O fluxo

1. **Treinador:** na ficha de um aluno, "Gerar link de convite". O link (`/convite/<token>`) aparece **uma única vez**, com "Copiar link" e "Compartilhar" (o compartilhamento do celular, ou o WhatsApp). A ficha passa a "Convidado" e continua contando nos 20. Gerar de novo mata o link anterior; "Cancelar convite" devolve a ficha a "Ficha manual". O botão "Enviar por e-mail" aparece **desligado** ("Envio por e-mail ainda não está disponível"): decisão do Renan, sem código de envio nem variável de ambiente nesta etapa.
2. **Aluno sem conta:** abre o link e vê quem o convidou (só o **primeiro nome** do treinador), o que o treinador poderá ver (nome, foto, nível, estilo, quiz, plano ativo e treinos dos últimos 30 dias) e o que **nunca** verá (lesões, peso, check-ins, pancadas na cabeça). Toca em "Entrar" ou "Criar conta": o convite vai num cookie (`corner_convite`, HttpOnly, 1 hora, só para convite válido) e, ao terminar o login ou o cadastro (e o onboarding, que é o mesmo de sempre), o `proxy.ts` leva o aluno de volta ao convite quando ele abre `/hoje`.
3. **Aluno com conta:** "Aceitar convite" liga a conta dele à ficha ("Com conta"). Quem recebe o link e aceita primeiro fica vinculado: o e-mail da conta não precisa bater com o da ficha. A tela do treinador avisa isso.
4. **Desvincular:** o aluno faz em **Perfil → Meu treinador**; o treinador, encerrando a ficha. A ficha vira "Encerrada", perde a conta (o treinador mantém a ficha e as notas e perde todo acesso à conta), e **reabrir a ficha não restaura o vínculo**: só um convite novo. Ficha em "convidado" não aceita mudança de status pelo PATCH (cancela-se o convite antes).

### Regras e segurança

- **Token:** 32 bytes aleatórios (43 caracteres base64url); no banco vai só o **hash SHA-256**; vale 14 dias; uso único; nunca aparece em log nem em erro. Convite inexistente, expirado, usado, cancelado e token malformado respondem **igual** ("Convite inválido ou expirado.").
- **Aceite atômico** (função SQL `aceitar_convite`): dois aceites ao mesmo tempo de um convite, só um vence. **Um treinador ativo por aluno** é garantido por um índice único parcial no banco; quem já tem treinador recebe "Você já tem um treinador. Desvincule-se dele no Perfil antes de aceitar outro convite." O treinador não aceita o próprio convite.
- **Cookie e proxy:** só o caminho `/hoje` é desviado, só com sessão e cookie bem formado (43 caracteres base64url: nenhum redirecionamento para fora do site). `/convite/<token>` é público para quem entrou e para quem não entrou. O cookie é apagado ao aceitar, ao falhar o aceite, em "Agora não" e quando a página vê que o convite não vale mais (para não prender o aluno num ciclo).
- **Rotas:** treinador `POST/DELETE /api/cornerman/alunos/<id>/convite` (e `GET /alunos/<id>` agora traz também o convite pendente, só com a validade); público `GET /api/convite/<token>`, `POST/DELETE /api/convite/<token>/guardar`, `POST /api/convite/<token>/aceitar` (exige sessão, qualquer plano); aluno `GET/DELETE /api/meu-treinador`. `GET /api/meu-treinador` sem Supabase responde 200 `{ treinador: null }` (o Perfil o consulta em toda abertura; um 5xx viraria erro de console).
- **Validação mais estrita da ficha (pendência da revisão da etapa 2):** e-mail sem `? & # %` (não esconde Cc/Bcc num `mailto:`), sem NUL, controles nem substitutos soltos (o Postgres os recusava com 502; agora dá 400), e nome com pelo menos um caractere visível.

### Rulings (o desenho não dizia)

- **Decisão 19 do desenho não se aplica:** o quiz **não guarda nada** no aparelho (o resultado só existe em `/quiz?r=…`), então não há o que subir. Quem já fez o quiz aparece como "sem quiz" até refazê-lo. A guarda do quiz (entidade) entra na etapa 3b.
- **"Limite de tentativas" do token:** não há contador por IP (a Vercel é sem estado e o projeto não tem Redis). O token de 256 bits torna a adivinhação inviável e o convite expira em 14 dias.

### Passo do Renan

Colar `supabase/cornerman-etapa-3a.sql` no SQL Editor do Supabase, **depois** do `cornerman-etapa-2.sql` (é idempotente). Depois, `npm run supabase:fumaca` confere de verdade o aceite simultâneo, o índice de um treinador por aluno, o desvínculo e que o token nunca está no banco (hoje esses blocos imprimem "PULOU").

## Etapa 3b: dados do aluno no painel (publicada em 27/10/2026; SQL aplicado e conferido no banco real)

### O que o treinador vê

- **Na lista "Meus Alunos":** cada aluno com conta ganha um status, sempre com **cor e texto** (a cor sozinha nunca diz o estado): verde "Treinou hoje/ontem/há 2 dias", amarelo "Treinou há 3 a 6 dias", vermelho "Treinou há 7 dias ou mais", cinza "Sem treinos registrados". Conta dias de calendário no fuso de São Paulo. Ficha manual, convidada ou encerrada não tem status.
- **Na ficha, aba "Treinos"** (só para ficha ativa com conta): nível, foto da conta, **atleta compatível** (o primeiro do quiz do aluno, com a porcentagem), plano ativo e semana, depois os **últimos 30 dias**: treinos, minutos (rounds × minutos por round) e esforço médio, **gráfico de treinos por semana** (5 semanas, segunda a domingo, feito em CSS) e a lista dos treinos. Um filtro por tipo (Todos, Técnica, Condicionamento, Sparring) vale para o resumo, o gráfico e a lista.
- **Nunca**: lesões, peso, check-ins, pancadas na cabeça do sparring, parceiro de sparring, anotações do aluno, respostas cruas do quiz.

### Como funciona por baixo

- **Quiz guardado:** nova entidade `quiz` (texto `00020`, um dígito por pergunta, ou vazio), local primeiro e sincronizada com a conta em `user_data`, fora do backup. Só grava quem **termina** o quiz; abrir o resultado de outra pessoa pelo endereço não troca as suas respostas. Quem já tinha feito o quiz aparece como "ainda não fez" até refazer (o quiz antigo não guardava nada no aparelho).
- **Rota** `GET /api/cornerman/alunos/[id]/dados`: confere sessão, plano (Cornerman ou Profissional) e vínculo **no servidor**. O id da conta do aluno sai da ficha do treinador, nunca do pedido. Ficha de outro treinador, inexistente ou malformada: 404 igual às demais; ficha sem conta ativa: 409 `sem_vinculo`, mesmo que guarde um vínculo antigo.
- **Banco estreito** (`lib/cornerman/aluno-dados-banco.ts`): só seleciona `date,type,rounds,round_min,rpe,duration_seconds` dos treinos (a partir de 30 dias atrás), `plan_id,started_at`, `level` e as entidades `quiz` e `foto`. O serviço valida tudo e monta a resposta campo a campo.
- **Status:** função SQL `ultimo_treino_por_aluno(p_coach)` (só para a chave de serviço) devolve a data do último treino de cada aluno ativo com conta. Se ela ainda não existir (ou o banco falhar), a lista continua funcionando, os alunos aparecem como "Status indisponível" (nunca como "sem treinos") e o servidor registra a mensagem do banco.

### Rulings (o desenho não dizia)

- Minutos de treino = rounds × minutos por round (a duração real depende de ter usado o cronômetro).
- Treino com data no futuro (relógio errado) conta como "hoje" no status.
- O "cache de plano de 5 minutos" já existe desde a etapa 2 (cookie assinado); as rotas novas só o reutilizam.
- Decisão 19 (subir o quiz que já está no aparelho) não se aplica: o quiz antigo não guardava nada.

### Passo do Renan

Colar `supabase/cornerman-etapa-3b.sql` no SQL Editor do Supabase (depois dos arquivos das etapas 2 e 3a; é idempotente). Depois, `npm run supabase:fumaca` confere no banco real o último treino, o isolamento entre treinadores, os 30 dias, que nada de saúde sai e que a chave pública não executa a função (hoje o bloco imprime "PULOU").

## Etapa 4: sugestões de plano e aba "Alunos" (código pronto; falta rodar o SQL no Supabase)

Plano e decisões: `docs/superpowers/plans/2026-10-28-cornerman-etapa-4-sugestoes-e-barra.md`.

### O que o treinador faz

- **Aba "Plano sugerido" na ficha** (toda ficha, com ou sem conta): escolhe um plano da lista (os 4 planos e os 10 treinos no estilo de atletas), escreve uma mensagem opcional (até 500 caracteres) e envia. O histórico mostra cada sugestão com o estado em texto (aguardando resposta, aceita, recusada, substituída por outra, cancelada porque o vínculo terminou, registrada na ficha).
- **Aluno com conta vinculada:** a sugestão fica pendente e o aluno recebe o aviso. **No máximo uma pendente por aluno**: enviar outra troca a anterior (que vira "substituída"); o banco garante isso mesmo com dois pedidos ao mesmo tempo.
- **Ficha sem conta** (manual ou convidada): a sugestão é só um registro no histórico da ficha. **Ficha encerrada:** o histórico aparece, mas não se sugere (409).
- **Aba "Alunos" na barra** (ícone `ph-users-three`, entre Progresso e Perfil), só com Cornerman ou Profissional (ou com o pagamento desligado no ambiente). O **selo vermelho** conta os alunos com conta há 7 dias ou mais sem treinar (a mesma regra do status da lista; "9+" acima de 9; o leitor de tela ouve o número exato). Vem de `GET /api/cornerman/alunos/selo`, que usa a mesma função SQL da lista, sem ler fichas nem fotos. Falha na consulta: sem selo, sem erro na tela.

### O que o aluno vê

- **Aviso na tela Hoje**, no alto: "[Nome] sugeriu um plano para você", o plano, a mensagem, "Ver o plano" (nível, duração, resumo), "Aceitar plano" e "Recusar".
- **Aceitar:** o servidor confirma primeiro (atômico, só para sugestão pendente do vínculo ativo dele); depois o plano passa a valer no aparelho. Se já houver outro plano, pergunta antes de trocar (a semana 1 recomeça); se já está **no mesmo plano**, não pergunta nem reinicia a semana. Se o servidor recusar (já respondida, vínculo desfeito), o erro aparece e o plano **não** é aplicado.
- **Plano que o nível dele não libera:** sem botão de aceitar, aparece o convite ao plano; a sugestão continua pendente e ele ainda pode recusar. A trava dos planos continua só na tela, como já era.
- **Selo "Sugerido pelo seu treinador [Nome]"** no plano (Hoje e Plano), quando o plano ativo é o da última sugestão aceita neste vínculo (inclusive quando a pessoa já usava aquele plano e só o aceitou). Limite conhecido: quem escolher o mesmo plano outra vez, por conta própria, depois de aceitar continua vendo o selo.

### Como funciona por baixo

- **SQL** `supabase/cornerman-etapa-4.sql` (e cópia em `schema.sql`): tabela `coach_suggestions` (RLS sem política, revoke de anon e authenticated); índice único parcial de uma pendente por aluno; funções `sugerir_plano`, `sugestoes_do_aluno` e `responder_sugestao` (só para a chave de serviço); e um **gatilho** em `coach_alunos` que, quando a ficha perde a conta (o aluno se desvincula ou o treinador encerra a ficha), cancela a sugestão pendente e marca as aceitas como "de um vínculo que acabou" (`vinculo_encerrado`). Cada sugestão guarda também a conta a quem foi enviada (`aluno_user_id`). Assim nada do vínculo antigo reaparece num vínculo futuro, nem para a mesma conta que volta nem para **outra conta** que aceite um convite novo da mesma ficha (a mensagem pessoal escrita para um aluno nunca chega a outro). O treinador continua vendo tudo no histórico da ficha.
- **Rotas:** treinador `GET/POST /api/cornerman/alunos/[id]/sugestoes` (plano Cornerman ou Profissional conferido no servidor; ficha de outro treinador, inexistente ou malformada: 404 igual) e `GET /api/cornerman/alunos/selo`; aluno `GET /api/sugestao-do-treinador` e `POST /api/sugestao-do-treinador/[id]/aceitar|recusar` (qualquer plano). As duas consultas feitas em toda abertura de tela (selo e aviso) respondem **200 vazio sem banco** (um 5xx viraria erro de console).
- **O que sai ao aluno:** só plano, mensagem, data e o **primeiro nome** do treinador, nunca ids internos. Ao treinador: só o histórico da própria ficha.
- **Mensagem do treinador** (vai para outra pessoa): sem caracteres de controle nem de direção de texto; nenhum erro nem log repete o texto.

### Rulings (o desenho não dizia)

- Planos sugeríveis: os que têm dono no catálogo de assinatura (`RECURSO_DO_PLANO_DE_TREINO`).
- O treinador **não** tem "retirar sugestão": enviar outra substitui a pendente.
- O servidor **não** confere o nível da assinatura do aluno ao aceitar (a trava dos planos continua só na tela, como já era em todo o app): um pedido montado à mão pode marcar como aceita uma sugestão de plano que o aluno não tem; nada é liberado por isso.
- A rota do selo responde 200 `vermelhos: null` também quando o Stripe não responde (é consultada em toda tela).
- Barra com 7 colunas (botão central de 62 px e rótulos de 10 px): conferida em 360 px, sem sobreposição nem texto cortado.
- O selo vermelho da barra usa um vermelho mais escuro que o do resto do app (o branco do número precisa de 4,5:1).

### Passo do Renan

Colar `supabase/cornerman-etapa-4.sql` no SQL Editor do Supabase (depois dos das etapas 2 e 3a; é idempotente). Depois, `npm run supabase:fumaca` confere no banco real: uma pendente por aluno (inclusive com quatro pedidos ao mesmo tempo), a troca por "substituída", o isolamento entre treinadores, quem pode responder (e só uma resposta vence), o cancelamento pelo gatilho (aluno que se desvincula e treinador que encerra), o limite de 500 caracteres, o histórico apagado com a ficha e o selo vermelho (hoje o bloco imprime "PULOU"). Sem o SQL, a aba "Plano sugerido" mostra erro ao carregar o histórico, e o aluno simplesmente não vê aviso.
