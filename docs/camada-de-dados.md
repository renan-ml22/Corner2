# Camada de dados

Como o Corner guarda os dados do usuário e como trocar o armazenamento (por exemplo, por um banco de dados) sem mexer nas telas.

## Mapa

```
lib/dados/
  contrato.ts           validadores: o que é um registro válido (fonte única)
  entidades.ts          tabela: cada entidade, valor inicial, validador, leitura tolerante, se entra no backup
  esquema.ts            VERSAO_ESQUEMA e as migrações entre versões
  backup.ts             montarBackup / lerBackup (puros)
  repositorio.ts        interface Repositorio (a "porta")
  repositorio-local.ts  implementação sobre o localStorage
  repositorio-sincronizado.ts  por cima do local: sincroniza com a conta (Supabase) em segundo plano
  fusao.ts              fusão dos dados do aparelho com os da conta (só na primeira vez de cada aparelho)
  remoto-http.ts        fala com a rota /api/dados
  sincronia-texto.ts    textos do estado da sincronização (Perfil)
  fonte.ts              liga uma entidade ao useSyncExternalStore (testável sem navegador)
  servidor/             só no servidor: validação e gravação nas tabelas (mapeamento, servico, banco-supabase, http)
hooks/useEntidade.ts    hook fino: useEntidade(repo, 'pesos')
hooks/useSincronia.ts   estado da sincronização para a tela
components/CornerProvider.tsx   cria o repositório e expõe o estado às telas
app/api/dados/route.ts  GET e PUT dos dados do usuário logado
supabase/schema.sql     as tabelas (rode no SQL Editor do Supabase)
```

As telas e o provider **não citam chaves nem `localStorage`**. Só falam com o `Repositorio`.

## Como o dado é guardado hoje

- Chave: `corner:{usuárioId}:{entidade}`; valor: JSON puro. Nada disso mudou quando a camada foi criada, então dados antigos continuam valendo.
- Versão do esquema: `corner:{usuárioId}:esquema` (hoje `1`). Ausente = versão 1.
- Quarentena: `corner:{usuárioId}:{entidade}:quarentena` guarda o texto original antes de sobrescrever um valor corrompido ou com itens inválidos.

## Regras que valem para qualquer implementação

1. **Leitura síncrona** a partir de um cache em memória; a mesma referência é devolvida enquanto o dado não muda (o React depende disso).
2. **Leitura tolerante e sem efeitos:** item inválido é descartado, não a lista inteira; ler nunca grava.
3. **Nunca apagar em silêncio:** antes de sobrescrever dado inválido, guardar o original.
4. **Falha de gravação não derruba o app:** o valor fica em memória.
5. **`assinar`** avisa mudanças locais e de outras abas/dispositivos.

## Conta na nuvem (feito: Supabase)

O banco entrou como previsto: uma segunda implementação por cima da primeira, sem as telas perceberem. O aparelho continua sendo a fonte do que a tela mostra; `repositorio-sincronizado.ts` carrega a conta ao abrir, envia o que muda em segundo plano e guarda as pendências no aparelho. Como funciona, as decisões e as limitações estão em [`plano-supabase.md`](plano-supabase.md).

Regras que a sincronização acrescenta às de cima:

6. **Primeira vez que um aparelho encontra uma conta com dados:** fundir, nunca sobrescrever, e guardar o original do aparelho na quarentena.
7. **Pendência nunca se perde:** alteração ainda não enviada fica marcada no aparelho (`corner:{usuário}:sync`) e vence a conta no próximo acesso.
8. **Só dado do atleta vai para a conta** (`ENTIDADES_SINCRONIZADAS`); `lembrete` e `assinatura` ficam no aparelho.
9. **Sem as variáveis do Supabase, nada muda:** a rota responde `ativo: false` e o repositório se comporta como o local.

## Mudar o formato de uma entidade

1. Some 1 a `VERSAO_ESQUEMA` em `esquema.ts`.
2. Acrescente `{ de: <versão antiga>, migrar }` em `MIGRACOES`.
3. Escreva o teste da migração (veja os exemplos com migrações falsas em `tests/backup.test.ts` e `tests/repositorio-local.test.ts`).
4. Backups antigos e dados no aparelho passam pela mesma migração.

## Adicionar uma entidade

Inclua-a em `DadosDoApp` e em `ENTIDADES` (`entidades.ts`), com o validador no `contrato.ts`. Para entrar no backup, dê a ela uma `erroBackup`. Os testes de `tests/backup.test.ts` conferem a tabela.
