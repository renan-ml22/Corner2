// Teste de fumaça da conta na nuvem contra o Supabase DE VERDADE: exercita o mesmo código da rota /api/dados
// (lib/dados/servidor/servico.ts) com dois usuários de mentira e apaga tudo o que criou.
//
// Uso:  npm run supabase:fumaca
//
// Pré-requisitos: supabase/schema.sql já rodado no SQL Editor do Supabase, e NEXT_PUBLIC_SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY no .env.local. Se NEXT_PUBLIC_SUPABASE_ANON_KEY também estiver lá, confere ainda que a
// chave pública NÃO consegue ler nem gravar nada (é a proteção que impede qualquer pessoa de abrir os dados dos outros).

import { createClient } from '@supabase/supabase-js'
import { iguais } from '../lib/dados/fusao'
import { ErroConta, criarConta, entrarNoSupabase, type AuthLike } from '../lib/contas'
import { criarAlunosBancoSupabase } from '../lib/cornerman/banco'
import { ErroCornerman, apagarAluno, atualizarAluno, criarAluno, lerAluno, listarAlunos } from '../lib/cornerman/servico'
import { criarBancoSupabase } from '../lib/dados/servidor/banco-supabase'
import { ErroDados, carregarDados, salvarEntidades } from '../lib/dados/servidor/servico'
import { criarClienteParaEntrar, getSupabase } from '../lib/supabase'
import { usuarioDaSessao, verifyCredentials } from '../lib/users'
import { verificarEnv } from './verificar-env.mjs'

try { process.loadEnvFile('.env.local') } catch { /* usa só o ambiente */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !chaveSecreta) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
  process.exit(1)
}
const conferencia = verificarEnv(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>)
const problemas = conferencia.erros.filter(e => /SUPABASE/.test(e))
if (problemas.length > 0) {
  for (const p of problemas) console.error(`erro: ${p}`)
  process.exit(1)
}

const db = getSupabase()!
const banco = criarBancoSupabase(db)
const TABELAS = ['workouts', 'active_plans', 'profiles', 'user_data'] as const

const agora = Date.now()
const ana = { id: `u_fumaca_${agora}_ana`, nome: 'Ana da fumaça' }
const bia = { id: `u_fumaca_${agora}_bia`, nome: 'Bia da fumaça' }

let falhas = 0
const confere = (nome: string, ok: boolean, detalhe = '') => {
  if (!ok) falhas++
  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${!ok && detalhe ? `  → ${detalhe}` : ''}`)
}

const treino = (id: string, extra: object = {}) => ({ id, data: '2026-10-10T12:00:00.123Z', tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900, ...extra })

// Dados que exigem cuidado: ordem própria (não é ordem de data), números fracionados, milissegundos, emoji, aspas e quebra de linha.
const TUDO = {
  historico: [
    treino('z-novo', { data: '2026-10-09T08:00:00.000Z' }), // inserido primeiro, mas com data MAIS ANTIGA que o seguinte
    treino('a-meio', { tipo: 'spa', minPorRound: 2.5, duracaoSegundos: 1234.5, nota: 'Senti o ombro 🥊 "forte"\ne a mão', sessaoId: 'fun-s1-qua', sparring: { intensidade: 'forte', cabeca: 'leves', parceiro: 'Zé' } }),
    treino('m-velho', { data: '2026-09-01T10:00:00.000Z', tipo: 'con' }),
  ],
  plano: { planoId: 'fundamentos', inicio: '2026-10-12' },
  config: { metaSemanal: 4, postura: 'canhoto', experiencia: '1a3', notificacoes: false, lembreteHora: '07:30', pesoCategoria: 67.5 },
  checkins: [{ data: '2026-10-13', sono: 4, dor: 2, energia: 3 }],
  lesoes: [{ id: 'l1', regiao: 'ombros', intensidade: 3, inicio: '2026-10-01', nota: 'treino de sábado' }],
  pesos: [{ id: 'p1', data: '2026-10-13', kg: 66.4 }],
  reag: { 'fun-s1-qua': 4 },
  checklist: { data: '2026-10-14', itens: { aquecimento: true } },
  ajuste: { data: '2026-10-14', aplicado: true },
  foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/==',
}

/** Entrar como o app faz: cada login usa um cliente descartável (o compartilhado se recusa a entrar). */
const entrar = (email: string, senha: string) => entrarNoSupabase(criarClienteParaEntrar()!.auth as unknown as AuthLike, email, senha)

/** Contas criadas no Supabase Auth durante o teste: são apagadas (usuário e dados) no fim. */
const contasCriadas: string[] = []

async function limpar() {
  for (const id of contasCriadas) await db.auth.admin.deleteUser(id)
  for (const id of [ana.id, bia.id, ...contasCriadas]) {
    await db.from('workouts').delete().eq('user_id', id)
    await db.from('active_plans').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('user_data').delete().eq('user_id', id)
    await db.from('coach_alunos').delete().eq('coach_id', id) // erro (tabela ainda não criada) é ignorado
  }
}

async function contarLinhas(): Promise<number> {
  let total = 0
  for (const id of contasCriadas) {
    const { data } = await db.auth.admin.getUserById(id)
    if (data?.user) total++ // o usuário ainda existe no Auth
  }
  for (const id of [ana.id, bia.id, ...contasCriadas]) {
    for (const [tabela, coluna] of [['workouts', 'user_id'], ['active_plans', 'user_id'], ['profiles', 'id'], ['user_data', 'user_id'], ['coach_alunos', 'coach_id']] as const) {
      const { count } = await db.from(tabela).select('*', { count: 'exact', head: true }).eq(coluna, id)
      total += count ?? 0
    }
  }
  return total
}

async function principal() {
  // 0. As tabelas existem?
  try {
    await carregarDados(banco, ana.id)
  } catch (e) {
    console.error(`Não foi possível ler as tabelas: ${e instanceof Error ? e.message : e}`)
    console.error('Rodou o supabase/schema.sql no SQL Editor do Supabase?')
    process.exit(1)
  }

  // 1. Usuário novo: nada gravado (ausente, não "vazio").
  confere('usuário novo não tem nada gravado', iguais(await carregarDados(banco, ana.id), {}))

  // 2. Ida e volta de tudo, com a ordem do histórico preservada.
  await salvarEntidades(banco, ana, TUDO)
  const lido = await carregarDados(banco, ana.id)
  confere('tudo volta idêntico (inclui ordem, decimais, milissegundos, emoji e quebra de linha)', iguais(lido, TUDO), JSON.stringify(lido).slice(0, 300))
  confere('a ordem do histórico é a do app, e não a da data', lido.historico?.map(t => t.id).join(',') === 'z-novo,a-meio,m-velho', lido.historico?.map(t => t.id).join(','))
  const { data: perfil } = await db.from('profiles').select('name,level,days_per_week').eq('id', ana.id).single()
  confere('o nome do perfil vem do login; nível e meta ficam nas colunas', perfil?.name === ana.nome && perfil?.level === 'intermediario' && perfil?.days_per_week === 4, JSON.stringify(perfil))

  // 3. Trocar a lista: o que saiu some, a ordem nova vale.
  await salvarEntidades(banco, ana, { historico: [TUDO.historico[2], TUDO.historico[0]] })
  const apos = await carregarDados(banco, ana.id)
  confere('treino removido da lista some do banco e a ordem nova vale', apos.historico?.map(t => t.id).join(',') === 'm-velho,z-novo', apos.historico?.map(t => t.id).join(','))
  confere('as outras entidades não foram tocadas', iguais(apos.config, TUDO.config) && iguais(apos.pesos, TUDO.pesos))

  // 4. Vazio de propósito é diferente de nunca gravado.
  await salvarEntidades(banco, ana, { historico: [], plano: null, foto: '' })
  const vazio = await carregarDados(banco, ana.id)
  confere('histórico vazio e "sem plano" voltam como gravados, e não como ausentes', iguais(vazio.historico, []) && Object.hasOwn(vazio, 'plano') && vazio.plano === null)
  confere('foto removida volta como texto vazio (o banco não aceita nulo)', Object.hasOwn(vazio, 'foto') && vazio.foto === '', JSON.stringify(vazio.foto))

  // 5. Isolamento entre usuários.
  confere('outro usuário não vê nada da Ana', iguais(await carregarDados(banco, bia.id), {}))
  await salvarEntidades(banco, bia, { historico: [treino('da-bia')], config: { metaSemanal: 2 } })
  const deNovoAna = await carregarDados(banco, ana.id)
  confere('gravar para a Bia não altera a Ana', iguais(deNovoAna.config, TUDO.config) && iguais(deNovoAna.historico, []))
  const daBia = await carregarDados(banco, bia.id)
  confere('a Bia só tem o que é dela', daBia.historico?.length === 1 && daBia.historico[0].id === 'da-bia' && iguais(daBia.config, { metaSemanal: 2 }))

  // 6. A mesma id de treino em dois usuários não se mistura (a chave é user_id + id).
  await salvarEntidades(banco, ana, { historico: [treino('mesmo-id', { rpe: 3 })] })
  await salvarEntidades(banco, bia, { historico: [treino('mesmo-id', { rpe: 9 })] })
  const [a2, b2] = await Promise.all([carregarDados(banco, ana.id), carregarDados(banco, bia.id)])
  confere('o mesmo id de treino em dois usuários não se mistura', a2.historico?.[0].rpe === 3 && b2.historico?.[0].rpe === 9)

  // 7. Lista grande de uma vez, numa transação só.
  const grande = Array.from({ length: 400 }, (_, i) => treino(`g${i}`, { data: new Date(Date.UTC(2026, 0, 1 + (i % 300))).toISOString() }))
  const t0 = Date.now()
  await salvarEntidades(banco, ana, { historico: grande })
  const volta = await carregarDados(banco, ana.id)
  confere(`400 treinos de uma vez (${Date.now() - t0} ms), na mesma ordem`, iguais(volta.historico, grande))

  // 8. Dado inválido é recusado antes de tocar no banco.
  const invalido = await salvarEntidades(banco, ana, { historico: [treino('x', { rpe: 99 })] }).catch(e => e)
  confere('dado inválido é recusado (400) e não altera o que já estava gravado', invalido instanceof ErroDados && invalido.status === 400 && (await carregarDados(banco, ana.id)).historico?.length === 400)

  // 9. Contas de usuário no Supabase Auth (cadastro do onboarding e login).
  const email = `fumaca+${agora}@corner.test`
  const senha = 'Senha-da-fumaça-123'
  const criada = await criarConta(db.auth as unknown as AuthLike, { nome: 'Conta da fumaça', email, senha })
  contasCriadas.push(criada.id)
  confere('a conta é criada já confirmada, com id uuid, e-mail e nome certos', /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(criada.id) && criada.email === email && criada.name === 'Conta da fumaça', JSON.stringify(criada))

  const entrou = await entrar(email, senha)
  confere('entrar com a senha certa devolve a mesma conta', entrou?.id === criada.id && entrou?.name === 'Conta da fumaça')
  confere('senha errada: null', (await entrar(email, 'senha-errada-123')) === null)
  confere('e-mail que não existe: null (a mesma resposta da senha errada)', (await entrar(`ninguem+${agora}@corner.test`, senha)) === null)

  const repetida = await criarConta(db.auth as unknown as AuthLike, { nome: 'Outra', email: email.toUpperCase(), senha }).catch(e => e)
  confere('o mesmo e-mail (até em maiúsculas) não cria outra conta (409)', repetida instanceof ErroConta && repetida.codigo === 'email_ja_cadastrado' && repetida.status === 409, String(repetida?.message))

  const login = await verifyCredentials(`  ${email.toUpperCase()} `, senha)
  confere('o login do app (verifyCredentials) aceita a conta, com o e-mail normalizado', login?.id === criada.id)
  confere('o login do app recusa a senha errada', (await verifyCredentials(email, 'errada-errada')) === null)
  confere('a sessão reconhece a conta pelo token (e-mail e nome vêm assinados)', iguais(usuarioDaSessao({ userId: criada.id, email: criada.email, nome: criada.name }), criada))

  await salvarEntidades(banco, { id: criada.id, nome: criada.name }, { config: { experiencia: '1a3', metaSemanal: 4, onboardingFeito: true }, plano: { planoId: 'base-aerobica', inicio: '2026-10-12' } })
  const { data: perfilNovo } = await db.from('profiles').select('name,level,days_per_week').eq('id', criada.id).single()
  const { data: planoNovo } = await db.from('active_plans').select('plan_id,started_at').eq('user_id', criada.id).single()
  confere('os dados do onboarding ficam no perfil e no plano ativo da conta nova', perfilNovo?.name === 'Conta da fumaça' && perfilNovo?.level === 'intermediario' && perfilNovo?.days_per_week === 4 && planoNovo?.plan_id === 'base-aerobica' && planoNovo?.started_at === '2026-10-12', JSON.stringify({ perfilNovo, planoNovo }))

  // 10. As chaves públicas não podem ler nem gravar nada.
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const papel = (() => { try { return JSON.parse(Buffer.from(chavePublica!.split('.')[1], 'base64url').toString()).role } catch { return null } })()
  if (!chavePublica || (papel !== 'anon' && !chavePublica.startsWith('sb_publishable_'))) {
    console.log('PULOU   chave pública não pode ler nem gravar (defina NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local para conferir)')
  } else {
    const anon = createClient(url!, chavePublica, { auth: { persistSession: false, autoRefreshToken: false } })
    for (const tabela of TABELAS) {
      const { data, error } = await anon.from(tabela).select('*').limit(5)
      confere(`a chave pública não lê ${tabela}`, !!error || (data ?? []).length === 0, `${(data ?? []).length} linhas visíveis`)
    }
    const escrita = await anon.from('user_data').insert({ user_id: `u_fumaca_${agora}_intruso`, entity: 'pesos', value: [] })
    confere('a chave pública não grava em user_data', !!escrita.error)
    const funcao = await anon.rpc('substituir_treinos', { p_user: `u_fumaca_${agora}_intruso`, p_linhas: [] })
    confere('a chave pública não executa substituir_treinos', !!funcao.error)
    await db.from('user_data').delete().eq('user_id', `u_fumaca_${agora}_intruso`)
  }
}

const FOTO_DE_TESTE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/=='

/** Fichas de aluno do treinador (supabase/cornerman-etapa-2.sql): isolamento, limite de 20 e corrida na vaga 20. */
async function blocoDosAlunos() {
  const sondagem = await db.from('coach_alunos').select('id').limit(1)
  if (sondagem.error) {
    console.log('PULOU   fichas de aluno: a tabela coach_alunos não existe (rode supabase/cornerman-etapa-2.sql no SQL Editor do Supabase)')
    return
  }
  const alunos = criarAlunosBancoSupabase(db)
  const erroDe = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
  const naoEncontrado = (e: unknown) => e instanceof ErroCornerman && e.codigo === 'nao_encontrado' && e.status === 404

  // 1. Ida e volta, com o que costuma quebrar (emoji, aspas, quebra de linha) e a foto.
  const notas = 'Senti o ombro 🥊 "forte"\ne a mão'
  const criada = await criarAluno(alunos, ana.id, { nome: 'Beto 🥊', email: 'beto@exemplo.com', telefone: '(11) 91234-5678', nivel: 'avancado', estilo: 'Out-boxer', notas, foto: FOTO_DE_TESTE })
  const lida = await lerAluno(alunos, ana.id, criada.id)
  confere('a ficha volta idêntica (emoji, aspas, quebra de linha e foto)', iguais(lida, criada) && lida.nome === 'Beto 🥊' && lida.notas === notas && lida.foto === FOTO_DE_TESTE && lida.status === 'ativo' && !lida.comConta)

  // 2. Isolamento: a ficha de outro treinador responde igual a um id que não existe.
  const inexistente = '00000000-0000-4000-8000-000000000000'
  const lerDaAna = await erroDe(lerAluno(alunos, bia.id, criada.id))
  const lerInexistente = await erroDe(lerAluno(alunos, bia.id, inexistente))
  confere('a Bia não lê a ficha da Ana (404, igual a um id que não existe)', naoEncontrado(lerDaAna) && naoEncontrado(lerInexistente) && (lerDaAna as Error).message === (lerInexistente as Error).message)
  confere('a Bia não altera a ficha da Ana', naoEncontrado(await erroDe(atualizarAluno(alunos, bia.id, criada.id, { notas: 'invasão' }))) && (await lerAluno(alunos, ana.id, criada.id)).notas === notas)
  confere('a Bia não apaga a ficha da Ana', naoEncontrado(await erroDe(apagarAluno(alunos, bia.id, criada.id))) && (await lerAluno(alunos, ana.id, criada.id)).id === criada.id)
  confere('a lista da Bia está vazia e a da Ana tem a ficha', (await listarAlunos(alunos, bia.id)).alunos.length === 0 && (await listarAlunos(alunos, ana.id)).alunos.length === 1)

  // 3. Limite de 20 (gatilho do banco).
  for (let i = 2; i <= 20; i++) await criarAluno(alunos, ana.id, { nome: `Aluno ${String(i).padStart(2, '0')}` })
  const lista20 = await listarAlunos(alunos, ana.id)
  confere('20 fichas ativas: "20 de 20"', lista20.alunos.length === 20 && lista20.ativos === 20 && lista20.limite === 20)
  const vinteEUm = await erroDe(criarAluno(alunos, ana.id, { nome: 'Aluno 21' }))
  confere('a 21ª ficha é recusada (409, limite_de_alunos)', vinteEUm instanceof ErroCornerman && vinteEUm.codigo === 'limite_de_alunos' && vinteEUm.status === 409 && (await listarAlunos(alunos, ana.id)).alunos.length === 20)
  confere('o limite é por treinador: a Bia cadastra normalmente', (await criarAluno(alunos, bia.id, { nome: 'Da Bia' })).status === 'ativo')

  // 4. Encerrar libera a vaga; reabrir com 20 ativas é recusado; dois pedidos juntos na última vaga: só um entra.
  const alunosDaAna = (await listarAlunos(alunos, ana.id)).alunos
  const encerrada = await atualizarAluno(alunos, ana.id, alunosDaAna[0].id, { status: 'encerrado' })
  confere('encerrar libera a vaga ("19 de 20")', encerrada.status === 'encerrado' && (await listarAlunos(alunos, ana.id)).ativos === 19)
  const corrida = await Promise.allSettled([criarAluno(alunos, ana.id, { nome: 'Corrida A' }), criarAluno(alunos, ana.id, { nome: 'Corrida B' })])
  const entraram = corrida.filter(r => r.status === 'fulfilled').length
  const recusadas = corrida.filter(r => r.status === 'rejected' && r.reason instanceof ErroCornerman && r.reason.codigo === 'limite_de_alunos').length
  confere('dois pedidos ao mesmo tempo na vaga 20: só um entra e o outro é recusado pelo limite', entraram === 1 && recusadas === 1, JSON.stringify(corrida.map(r => r.status)))
  confere('continuam 20 ativas', (await listarAlunos(alunos, ana.id)).ativos === 20)
  const reabrir = await erroDe(atualizarAluno(alunos, ana.id, encerrada.id, { status: 'ativo' }))
  confere('reabrir uma ficha encerrada com 20 ativas é recusado e ela continua encerrada', reabrir instanceof ErroCornerman && reabrir.codigo === 'limite_de_alunos' && (await lerAluno(alunos, ana.id, encerrada.id)).status === 'encerrado')

  // 5. Apagar de verdade libera a vaga, e reabrir passa a funcionar.
  await apagarAluno(alunos, ana.id, alunosDaAna[1].id)
  confere('apagar remove a ficha', naoEncontrado(await erroDe(lerAluno(alunos, ana.id, alunosDaAna[1].id))))
  confere('com vaga livre, reabrir funciona', (await atualizarAluno(alunos, ana.id, encerrada.id, { status: 'ativo' })).status === 'ativo')

  // 6. A chave pública não lê a tabela.
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (chavePublica) {
    const anon = createClient(url!, chavePublica, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await anon.from('coach_alunos').select('*').limit(5)
    confere('a chave pública não lê coach_alunos', !!error || (data ?? []).length === 0, `${(data ?? []).length} linhas visíveis`)
  }
}

async function executar() {
  try {
    await principal()
    await blocoDosAlunos()
  } finally {
    await limpar()
    const sobrou = await contarLinhas()
    confere('limpeza: nenhuma linha de teste ficou no banco', sobrou === 0, `${sobrou} linhas`)
  }
  console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} verificação(ões) falharam.`)
  process.exit(falhas === 0 ? 0 : 1)
}

executar().catch(e => {
  console.error(`\nO teste parou por um erro: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
