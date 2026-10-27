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

## Etapa 2: fichas e painel "Meus Alunos" (código pronto; falta rodar o SQL no Supabase)

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

## Etapa 3a: convites e vínculo (código pronto; falta rodar o SQL no Supabase)

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

### O que fica para a 3b

Guarda do quiz, status verde/amarelo/vermelho (dias desde o último treino), a aba "Treinos" na ficha do aluno com conta (gráfico semanal e filtro por tipo), o atleta compatível e os dados do aluno no painel, sempre campo a campo (nunca lesões, peso, check-ins nem pancadas na cabeça).

## Etapas seguintes

3b. Dados do aluno no painel: quiz guardado, status por cor, aba Treinos, atleta compatível.
4. Sugestões de plano e a aba "Alunos" na barra.
