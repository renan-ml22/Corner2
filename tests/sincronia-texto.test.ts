import { describe, expect, it } from 'vitest'
import { textoDaSincronia, textoDeOndeFicamOsDados } from '@/lib/dados/sincronia-texto'
import type { EstadoDaSincronia } from '@/lib/dados/repositorio-sincronizado'

const ESTADOS: EstadoDaSincronia[] = ['desligada', 'sincronizando', 'ok', 'pendente']

describe('textos da sincronização', () => {
  it('sem conta na nuvem, não há situação a mostrar e os dados "ficam só neste aparelho"', () => {
    expect(textoDaSincronia('desligada')).toBeNull()
    expect(textoDeOndeFicamOsDados('desligada')).toContain('só neste aparelho')
  })

  it.each(ESTADOS.filter(e => e !== 'desligada'))('com a conta ligada (%s), há uma situação e não se diz mais "só neste aparelho"', estado => {
    expect(textoDaSincronia(estado)).toEqual(expect.any(String))
    expect(textoDaSincronia(estado)!.length).toBeGreaterThan(10)
    expect(textoDeOndeFicamOsDados(estado)).not.toContain('só neste aparelho')
    expect(textoDeOndeFicamOsDados(estado)).toContain('sua conta')
  })

  it('pendente explica que nada se perde e vale tanto para "há algo a enviar" quanto para "a conta não respondeu"', () => {
    expect(textoDaSincronia('pendente')).toMatch(/salv\w+ neste aparelho/)
    expect(textoDaSincronia('pendente')).not.toMatch(/há alterações/i) // pode não haver alteração nenhuma (ex.: a conta nem respondeu ao abrir)
  })
})
