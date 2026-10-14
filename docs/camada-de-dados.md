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
  fonte.ts              liga uma entidade ao useSyncExternalStore (testável sem navegador)
hooks/useEntidade.ts    hook fino: useEntidade(repo, 'pesos')
components/CornerProvider.tsx   cria o repositório e expõe o estado às telas
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

## Trocar o armazenamento por um banco (próxima etapa)

1. Criar `repositorio-api.ts` que implemente `Repositorio`: carrega as entidades ao entrar (preenchendo o cache), `gravar` atualiza o cache na hora e envia ao servidor em segundo plano.
2. Rodar contra ele o mesmo conjunto de testes de `tests/repositorio-local.test.ts` (leitura, gravação, assinatura, falhas). Se passa, as telas não percebem a troca.
3. Em `CornerProvider.tsx`, trocar `criarRepositorioLocal(...)` pela nova fábrica. É a única linha que muda.
4. Importar para a conta os dados que já estão no aparelho usando o fluxo de backup (`lerBackup`), que já valida e migra.

## Mudar o formato de uma entidade

1. Some 1 a `VERSAO_ESQUEMA` em `esquema.ts`.
2. Acrescente `{ de: <versão antiga>, migrar }` em `MIGRACOES`.
3. Escreva o teste da migração (veja os exemplos com migrações falsas em `tests/backup.test.ts` e `tests/repositorio-local.test.ts`).
4. Backups antigos e dados no aparelho passam pela mesma migração.

## Adicionar uma entidade

Inclua-a em `DadosDoApp` e em `ENTIDADES` (`entidades.ts`), com o validador no `contrato.ts`. Para entrar no backup, dê a ela uma `erroBackup`. Os testes de `tests/backup.test.ts` conferem a tabela.
