# Plano Cornerman e gestão de alunos

Funcionalidade nova em 4 etapas. O desenho completo (decisões, segurança, o que ficou de fora) está em
`docs/superpowers/specs/2026-10-26-cornerman-design.md`. Este arquivo conta o que já foi entregue e como funciona.

## Etapa 1: plano e foto de perfil (código pronto; falta sincronizar o Stripe de teste)

### Plano Cornerman

- Novo nível de assinatura, **entre o Amador e o Profissional**: R$ 63,90 por mês ou R$ 639,00 por ano (10 mensalidades, como os outros).
- Inclui tudo do Iniciante e do Amador. **Não** inclui nada do Profissional. O Profissional inclui o Cornerman.
- Quem já assina Iniciante, Amador ou Profissional não muda de preço, de nível nem de acesso.
- O recurso exclusivo é `gestaoDeAlunos` (painel com até 20 alunos, fichas, notas e plano sugerido). A página dele chega na etapa 2: até lá, o cartão do plano já aparece na tela de assinatura, mas o pagamento está em modo de teste.
- Tudo mora em `lib/assinatura/catalogo.ts` (fonte única). Chave do preço no Stripe: `cornerman_mensal` e `cornerman_anual`.
- **Stripe de teste:** é preciso rodar `npm run stripe:sincronizar` (use `-- --simular` para só ver o que faria). Ele cria o produto "Corner Cornerman" e os dois preços, e atualiza a descrição do "Corner Profissional" ("Tudo do Cornerman…"). Enquanto isso não for feito, assinar o Cornerman falha no pagamento (o preço ainda não existe no Stripe). Só funciona com chave de teste (`sk_test_…`).

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

## Etapas seguintes

2. Fichas e painel "Meus Alunos".
3. Convites (link; e-mail fica desligado até haver domínio) e vínculo do aluno.
4. Sugestões de plano e a aba "Alunos" na barra.
