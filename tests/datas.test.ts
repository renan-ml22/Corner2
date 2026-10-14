import { describe, expect, it } from 'vitest'
import {
  DIAS_CURTOS,
  DIAS_LETRA,
  DIAS_LONGOS,
  chaveDia,
  dataNaSemana,
  deChave,
  diferencaDias,
  formatarDataCurta,
  formatarDataLonga,
  inicioDaSemana,
  inicioDoDia,
  mesmoDia,
  nomeDoMes,
  somarDias,
} from '@/lib/datas'

// Referências fixas (mês é base 0 no construtor de Date).
// 13/10/2026 é uma terça-feira.
const terca = new Date(2026, 9, 13, 15, 30)

describe('constantes de dias da semana', () => {
  it('começam no domingo, como Date#getDay()', () => {
    expect(DIAS_CURTOS[0]).toBe('Dom')
    expect(DIAS_LONGOS[0]).toBe('Domingo')
    expect(DIAS_CURTOS[6]).toBe('Sáb')
    expect(DIAS_LONGOS[6]).toBe('Sábado')
  })

  it('têm sete entradas cada', () => {
    expect(DIAS_CURTOS).toHaveLength(7)
    expect(DIAS_LONGOS).toHaveLength(7)
    expect(DIAS_LETRA).toHaveLength(7)
  })

  it('o índice de uma data real aponta para o nome certo', () => {
    expect(DIAS_LONGOS[terca.getDay()]).toBe('Terça')
    expect(DIAS_CURTOS[terca.getDay()]).toBe('Ter')
    expect(DIAS_LETRA[terca.getDay()]).toBe('T')
  })
})

describe('chaveDia', () => {
  it('formata como AAAA-MM-DD com zeros à esquerda', () => {
    expect(chaveDia(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(chaveDia(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('ignora o horário do dia, inclusive 23:59', () => {
    expect(chaveDia(new Date(2026, 9, 13, 0, 0, 0))).toBe('2026-10-13')
    expect(chaveDia(new Date(2026, 9, 13, 23, 59, 59))).toBe('2026-10-13')
  })

  it('usa o fuso local, não UTC (22h em São Paulo já é dia seguinte em UTC)', () => {
    expect(chaveDia(new Date(2026, 9, 13, 22, 0))).toBe('2026-10-13')
  })
})

describe('deChave', () => {
  it('cria a meia-noite local do dia indicado', () => {
    const d = deChave('2026-10-13')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9)
    expect(d.getDate()).toBe(13)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('aceita chave sem zeros à esquerda', () => {
    expect(chaveDia(deChave('2026-1-5'))).toBe('2026-01-05')
  })

  it('ida e volta: chaveDia(deChave(x)) devolve x', () => {
    for (const chave of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-12-31', '1999-07-09']) {
      expect(chaveDia(deChave(chave))).toBe(chave)
    }
  })

  it('ida e volta: deChave(chaveDia(d)) devolve o início do dia de d', () => {
    expect(deChave(chaveDia(terca)).getTime()).toBe(inicioDoDia(terca).getTime())
  })

  it('o dia de início do horário de verão de 2018 (00:00 não existe) mantém a chave', () => {
    // Em 04/11/2018 os relógios de São Paulo pularam de 00:00 para 01:00.
    expect(chaveDia(deChave('2018-11-04'))).toBe('2018-11-04')
  })
})

describe('inicioDoDia', () => {
  it('zera hora, minuto, segundo e milissegundo', () => {
    const r = inicioDoDia(new Date(2026, 9, 13, 15, 30, 45, 123))
    expect(r.getTime()).toBe(new Date(2026, 9, 13).getTime())
  })

  it('é idempotente', () => {
    const uma = inicioDoDia(terca)
    expect(inicioDoDia(uma).getTime()).toBe(uma.getTime())
  })

  it('não altera a data recebida', () => {
    const original = new Date(2026, 9, 13, 15, 30)
    const antes = original.getTime()
    inicioDoDia(original)
    expect(original.getTime()).toBe(antes)
  })
})

describe('somarDias', () => {
  it('soma dias dentro do mesmo mês', () => {
    expect(chaveDia(somarDias(new Date(2026, 9, 13), 5))).toBe('2026-10-18')
  })

  it('aceita zero e devolve uma cópia, não a mesma instância', () => {
    const r = somarDias(terca, 0)
    expect(r.getTime()).toBe(terca.getTime())
    expect(r).not.toBe(terca)
  })

  it('subtrai com valores negativos', () => {
    expect(chaveDia(somarDias(new Date(2026, 9, 13), -13))).toBe('2026-09-30')
  })

  it('vira o mês', () => {
    expect(chaveDia(somarDias(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(chaveDia(somarDias(new Date(2026, 3, 30), 1))).toBe('2026-05-01')
  })

  it('vira o ano nos dois sentidos', () => {
    expect(chaveDia(somarDias(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
    expect(chaveDia(somarDias(new Date(2026, 0, 1), -1))).toBe('2025-12-31')
  })

  it('respeita ano bissexto', () => {
    expect(chaveDia(somarDias(new Date(2024, 1, 28), 1))).toBe('2024-02-29')
    expect(chaveDia(somarDias(new Date(2024, 1, 28), 2))).toBe('2024-03-01')
    expect(chaveDia(somarDias(new Date(2026, 1, 28), 1))).toBe('2026-03-01')
  })

  it('soma 366 dias em um ano bissexto e 365 em um comum', () => {
    expect(chaveDia(somarDias(new Date(2024, 0, 1), 366))).toBe('2025-01-01')
    expect(chaveDia(somarDias(new Date(2026, 0, 1), 365))).toBe('2027-01-01')
  })

  it('preserva o horário local do dia', () => {
    const r = somarDias(new Date(2026, 9, 13, 15, 30), 10)
    expect(r.getHours()).toBe(15)
    expect(r.getMinutes()).toBe(30)
  })

  it('não altera a data recebida', () => {
    const original = new Date(2026, 9, 13)
    somarDias(original, 7)
    expect(chaveDia(original)).toBe('2026-10-13')
  })

  // São Paulo teve horário de verão até fevereiro de 2019: dias de 23h e de 25h.
  it('não perde um dia ao entrar no horário de verão (dia de 23h)', () => {
    expect(chaveDia(somarDias(deChave('2018-11-03'), 1))).toBe('2018-11-04')
    expect(chaveDia(somarDias(deChave('2018-11-03'), 2))).toBe('2018-11-05')
  })

  it('não repete um dia ao sair do horário de verão (dia de 25h)', () => {
    expect(chaveDia(somarDias(deChave('2019-02-16'), 1))).toBe('2019-02-17')
    expect(chaveDia(somarDias(deChave('2019-02-16'), 2))).toBe('2019-02-18')
  })

  it('percorrer 120 dias seguidos atravessando a virada gera chaves consecutivas', () => {
    let d = deChave('2018-10-01')
    let anterior = chaveDia(d)
    for (let i = 1; i <= 120; i++) {
      d = somarDias(d, 1)
      const atual = chaveDia(d)
      expect(atual > anterior).toBe(true)
      expect(diferencaDias(deChave(atual), deChave(anterior))).toBe(1)
      anterior = atual
    }
    expect(anterior).toBe('2019-01-29')
  })
})

describe('inicioDaSemana', () => {
  it('a semana começa na segunda-feira', () => {
    expect(chaveDia(inicioDaSemana(terca))).toBe('2026-10-12')
    expect(inicioDaSemana(terca).getDay()).toBe(1)
  })

  it('segunda-feira devolve ela mesma', () => {
    expect(chaveDia(inicioDaSemana(new Date(2026, 9, 12)))).toBe('2026-10-12')
  })

  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(chaveDia(inicioDaSemana(new Date(2026, 9, 18)))).toBe('2026-10-12')
  })

  it('o dia seguinte ao domingo (segunda) abre uma nova semana', () => {
    expect(chaveDia(inicioDaSemana(new Date(2026, 9, 19)))).toBe('2026-10-19')
  })

  it('devolve meia-noite, mesmo se a entrada tiver horário', () => {
    const r = inicioDaSemana(new Date(2026, 9, 16, 23, 59))
    expect(r.getTime()).toBe(new Date(2026, 9, 12).getTime())
  })

  it('cruza a virada de mês e de ano', () => {
    // 01/01/2026 é quinta-feira
    expect(chaveDia(inicioDaSemana(new Date(2026, 0, 1)))).toBe('2025-12-29')
    // 01/03/2026 é domingo
    expect(chaveDia(inicioDaSemana(new Date(2026, 2, 1)))).toBe('2026-02-23')
  })

  it('todos os sete dias de uma semana resultam na mesma segunda', () => {
    for (let i = 0; i < 7; i++) {
      expect(chaveDia(inicioDaSemana(new Date(2026, 9, 12 + i, 10)))).toBe('2026-10-12')
    }
  })

  it('funciona na semana do início do horário de verão de 2018', () => {
    // 04/11/2018 (domingo) teve 23h; a semana começou na segunda 29/10.
    expect(chaveDia(inicioDaSemana(deChave('2018-11-04')))).toBe('2018-10-29')
  })
})

describe('diferencaDias', () => {
  it('é zero para o mesmo dia, mesmo com horários diferentes', () => {
    expect(diferencaDias(new Date(2026, 9, 13, 23, 59), new Date(2026, 9, 13, 0, 1))).toBe(0)
  })

  it('é positivo quando a primeira data é posterior', () => {
    expect(diferencaDias(new Date(2026, 9, 20), new Date(2026, 9, 13))).toBe(7)
  })

  it('é negativo quando a primeira data é anterior', () => {
    expect(diferencaDias(new Date(2026, 9, 13), new Date(2026, 9, 20))).toBe(-7)
  })

  it('conta dias de calendário, não períodos de 24h', () => {
    // 23:59 de um dia contra 00:01 do seguinte: só 2 minutos, mas 1 dia de calendário.
    expect(diferencaDias(new Date(2026, 9, 14, 0, 1), new Date(2026, 9, 13, 23, 59))).toBe(1)
  })

  it('atravessa meses, anos e ano bissexto', () => {
    expect(diferencaDias(new Date(2026, 0, 1), new Date(2025, 11, 31))).toBe(1)
    expect(diferencaDias(new Date(2027, 0, 1), new Date(2026, 0, 1))).toBe(365)
    expect(diferencaDias(new Date(2025, 0, 1), new Date(2024, 0, 1))).toBe(366)
    expect(diferencaDias(new Date(2024, 2, 1), new Date(2024, 1, 28))).toBe(2)
  })

  it('não erra por causa do dia de 23h do horário de verão', () => {
    expect(diferencaDias(deChave('2018-11-05'), deChave('2018-11-03'))).toBe(2)
    expect(diferencaDias(deChave('2018-11-04'), deChave('2018-11-03'))).toBe(1)
  })

  it('não erra por causa do dia de 25h do fim do horário de verão', () => {
    expect(diferencaDias(deChave('2019-02-18'), deChave('2019-02-16'))).toBe(2)
    expect(diferencaDias(deChave('2019-02-17'), deChave('2019-02-16'))).toBe(1)
  })

  it('é consistente com somarDias', () => {
    const base = new Date(2026, 9, 13)
    for (const n of [-400, -30, -1, 0, 1, 30, 400]) {
      expect(diferencaDias(somarDias(base, n), base)).toBe(n)
    }
  })
})

describe('dataNaSemana', () => {
  const segunda = new Date(2026, 9, 12)

  it('segunda (1) é o próprio início da semana', () => {
    expect(chaveDia(dataNaSemana(segunda, 1))).toBe('2026-10-12')
  })

  it('devolve cada dia usando a convenção 0 = domingo', () => {
    expect(chaveDia(dataNaSemana(segunda, 2))).toBe('2026-10-13') // terça
    expect(chaveDia(dataNaSemana(segunda, 3))).toBe('2026-10-14') // quarta
    expect(chaveDia(dataNaSemana(segunda, 4))).toBe('2026-10-15') // quinta
    expect(chaveDia(dataNaSemana(segunda, 5))).toBe('2026-10-16') // sexta
    expect(chaveDia(dataNaSemana(segunda, 6))).toBe('2026-10-17') // sábado
  })

  it('domingo (0) é o último dia da semana, não o primeiro', () => {
    expect(chaveDia(dataNaSemana(segunda, 0))).toBe('2026-10-18')
  })

  it('o dia da semana do resultado bate com o pedido', () => {
    for (let dia = 0; dia < 7; dia++) {
      expect(dataNaSemana(segunda, dia).getDay()).toBe(dia)
    }
  })

  it('cruza a virada de ano', () => {
    const segundaDeNatal = new Date(2025, 11, 29)
    expect(chaveDia(dataNaSemana(segundaDeNatal, 4))).toBe('2026-01-01')
  })

  it('combina com inicioDaSemana', () => {
    expect(chaveDia(dataNaSemana(inicioDaSemana(terca), 5))).toBe('2026-10-16')
  })
})

describe('mesmoDia', () => {
  it('é verdadeiro para horários diferentes do mesmo dia', () => {
    expect(mesmoDia(new Date(2026, 9, 13, 0, 0), new Date(2026, 9, 13, 23, 59))).toBe(true)
  })

  it('é falso para dias consecutivos, mesmo a poucos minutos de distância', () => {
    expect(mesmoDia(new Date(2026, 9, 13, 23, 59), new Date(2026, 9, 14, 0, 1))).toBe(false)
  })

  it('é falso para o mesmo dia e mês em anos diferentes', () => {
    expect(mesmoDia(new Date(2025, 9, 13), new Date(2026, 9, 13))).toBe(false)
  })
})

describe('formatarDataLonga', () => {
  it('mostra dia da semana, dia e mês por extenso em pt-BR', () => {
    expect(formatarDataLonga(terca)).toBe('terça-feira, 13 de outubro')
  })

  it('não usa zero à esquerda no dia', () => {
    expect(formatarDataLonga(new Date(2026, 0, 5))).toBe('segunda-feira, 5 de janeiro')
  })
})

describe('formatarDataCurta', () => {
  it('usa dia com dois dígitos e mês abreviado', () => {
    expect(formatarDataCurta(new Date(2026, 2, 5))).toBe('05 de mar')
  })

  it('remove o ponto final da abreviação', () => {
    expect(formatarDataCurta(new Date(2026, 9, 13))).not.toContain('.')
    expect(formatarDataCurta(new Date(2026, 9, 13))).toBe('13 de out')
  })

  it('meses cuja abreviação já não tem ponto continuam intactos', () => {
    expect(formatarDataCurta(new Date(2026, 4, 5))).toBe('05 de mai')
  })
})

describe('nomeDoMes', () => {
  it('devolve mês e ano com a inicial maiúscula', () => {
    expect(nomeDoMes(terca)).toBe('Outubro de 2026')
  })

  it('funciona em janeiro e dezembro', () => {
    expect(nomeDoMes(new Date(2026, 0, 1))).toBe('Janeiro de 2026')
    expect(nomeDoMes(new Date(2026, 11, 31))).toBe('Dezembro de 2026')
  })

  it('mantém acento em março', () => {
    expect(nomeDoMes(new Date(2026, 2, 10))).toBe('Março de 2026')
  })
})
