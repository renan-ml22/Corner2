import { readFileSync } from 'node:fs'
import { arquivoJson, contagemDeTreinos, expect, gravarRaw, lerJson, lerRaw, test, treino } from './fixtures'

const ruim = () => ({ id: 'ruim', data: '2026-10-11T12:00:00.000Z', tipo: 'tec', rounds: 4, minPorRound: 3, rpe: 99, duracaoSegundos: 10 })
const backup = (dados: Record<string, unknown>, versao = 1) => ({ app: 'corner', versao, exportadoEm: new Date().toISOString(), dados })

test.describe('dados: leitura de dados antigos', () => {
  test('histórico com um item corrompido mostra os bons e não altera o que está salvo', async ({ pagina }) => {
    const bruto = JSON.stringify([treino('a'), ruim(), treino('b', { tipo: 'con' })])
    await gravarRaw(pagina, 'historico', bruto)
    await pagina.goto('/progresso')
    await expect(contagemDeTreinos(pagina)).toHaveText('2 treinos')
    expect(await lerRaw(pagina, 'historico')).toBe(bruto)
    expect(await lerRaw(pagina, 'historico:quarentena')).toBeNull()
    expect(await lerRaw(pagina, 'esquema')).toBeNull()
  })

  test('JSON quebrado não derruba a tela, e a gravação seguinte guarda o original em quarentena', async ({ pagina }) => {
    await gravarRaw(pagina, 'pesos', '{quebrado')
    await pagina.goto('/saude')
    await pagina.fill('input[aria-label="Peso de hoje em quilos"]', '72')
    await pagina.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect.poll(async () => (await lerJson(pagina, 'pesos'))?.length).toBe(1)
    expect(await lerRaw(pagina, 'pesos:quarentena')).toBe('{quebrado')
  })
})

test.describe('dados: gravação pela interface', () => {
  test('registrar peso grava na chave de sempre, preserva o antigo, carimba a versão e sobrevive ao recarregar', async ({ pagina }) => {
    const historico = JSON.stringify([treino('a')])
    await gravarRaw(pagina, 'historico', historico)
    await gravarRaw(pagina, 'pesos', JSON.stringify([{ id: 'p0', data: '2026-09-01', kg: 70 }]))
    await pagina.goto('/saude')
    await pagina.fill('input[aria-label="Peso de hoje em quilos"]', '71,5')
    await pagina.getByRole('button', { name: 'Registrar', exact: true }).click()

    await expect.poll(async () => (await lerJson(pagina, 'pesos')).length).toBe(2)
    const pesos = await lerJson(pagina, 'pesos')
    expect(pesos.map((p: { id: string }) => p.id)).toContain('p0')
    expect(pesos.some((p: { kg: number }) => p.kg === 71.5)).toBe(true)
    expect(await lerRaw(pagina, 'esquema')).toBe('1')
    expect(await lerRaw(pagina, 'historico')).toBe(historico)

    await pagina.reload()
    await expect(pagina.getByText('71,5').first()).toBeVisible()
  })
})

test.describe('dados: backup', () => {
  test('exportar leva só dados válidos e nada do dia, com versão e data', async ({ pagina }) => {
    await gravarRaw(pagina, 'historico', JSON.stringify([treino('a'), ruim(), treino('b')]))
    await gravarRaw(pagina, 'pesos', JSON.stringify([{ id: 'p0', data: '2026-09-01', kg: 70 }]))
    await gravarRaw(pagina, 'config', JSON.stringify({ metaSemanal: 4, postura: 'southpaw' }))
    await pagina.goto('/perfil')

    const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: /Baixar backup/ }).click()])
    const arquivo = JSON.parse(readFileSync(await download.path(), 'utf8'))
    expect(arquivo).toMatchObject({ app: 'corner', versao: 1 })
    expect(typeof arquivo.exportadoEm).toBe('string')
    expect(arquivo.dados.historico).toHaveLength(2)
    expect(arquivo.dados.pesos).toHaveLength(1)
    expect(arquivo.dados.config).toEqual({ metaSemanal: 4 }) // o campo inválido não vai para o arquivo
    expect(arquivo.dados).not.toHaveProperty('checklist')
    expect(arquivo.dados).not.toHaveProperty('lembrete')
  })

  test('importar backup válido substitui o que veio, preserva o resto e guarda o histórico antigo ruim em quarentena', async ({ pagina }) => {
    const antigo = JSON.stringify([treino('a'), ruim()])
    await gravarRaw(pagina, 'historico', antigo)
    await gravarRaw(pagina, 'config', JSON.stringify({ metaSemanal: 4 }))
    await pagina.goto('/perfil')

    await pagina.locator('input[type=file][accept*="json"]').setInputFiles(arquivoJson('ok.json', backup({
      historico: [treino('so-um', { rounds: 8 })], pesos: [{ id: 'q1', data: '2026-10-01', kg: 68 }],
    })))
    await expect(pagina.getByText('Backup importado')).toBeVisible()

    expect((await lerJson(pagina, 'historico')).map((t: { id: string }) => t.id)).toEqual(['so-um'])
    expect(await lerJson(pagina, 'pesos')).toHaveLength(1)
    expect((await lerJson(pagina, 'config')).metaSemanal).toBe(4)
    expect(await lerRaw(pagina, 'historico:quarentena')).toBe(antigo)
  })

  test('backup inválido é recusado com a mensagem certa e não altera nada', async ({ pagina }) => {
    const atual = JSON.stringify([treino('a')])
    await gravarRaw(pagina, 'historico', atual)
    await pagina.goto('/perfil')
    await pagina.locator('input[type=file][accept*="json"]').setInputFiles(arquivoJson('ruim.json', backup({ historico: [{ ...treino('x'), rpe: 99 }] })))
    await expect(pagina.getByText('O histórico do backup está corrompido.')).toBeVisible()
    expect(await lerRaw(pagina, 'historico')).toBe(atual)
  })

  test('backup de uma versão mais nova do app é recusado com orientação', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.locator('input[type=file][accept*="json"]').setInputFiles(arquivoJson('futuro.json', backup({}, 2)))
    await expect(pagina.getByText(/mais nova do Corner/)).toBeVisible()
  })

  test('arquivo que não é um backup do Corner é recusado', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.locator('input[type=file][accept*="json"]').setInputFiles(arquivoJson('outro.json', { app: 'outro', dados: {} }))
    await expect(pagina.getByText('Este arquivo não é um backup do Corner.')).toBeVisible()
  })
})

test.describe('dados: várias abas', () => {
  test('a segunda aba se atualiza sozinha quando a primeira muda os dados', async ({ pagina, context }) => {
    await gravarRaw(pagina, 'historico', JSON.stringify([treino('a')]))
    const aba2 = await context.newPage()
    await aba2.goto('/progresso')
    await expect(aba2.getByText('1 treino', { exact: true })).toBeVisible()

    await pagina.goto('/perfil')
    await pagina.locator('input[type=file][accept*="json"]').setInputFiles(arquivoJson('tres.json', backup({ historico: [treino('1'), treino('2'), treino('3')] })))
    await expect(aba2.getByText('3 treinos', { exact: true })).toBeVisible()
  })
})
