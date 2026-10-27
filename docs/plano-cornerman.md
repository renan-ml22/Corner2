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

## Etapas seguintes

3. Convites (link; e-mail fica desligado até haver domínio) e vínculo do aluno; status verde, amarelo e vermelho.
4. Sugestões de plano e a aba "Alunos" na barra.
