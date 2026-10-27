// Foto de perfil: recorte quadrado, redução para 200×200 em JPEG e a letra que aparece quando não há foto.
// `recorteCentral` e `inicialDoNome` são puros; `prepararFoto` só funciona no navegador (usa canvas).

import { isFoto } from '@/lib/dados/contrato'

export const LADO_DA_FOTO = 200
export const QUALIDADE_DA_FOTO = 0.8
/** Maior arquivo escolhido, em bytes: recusado antes de decodificar (uma foto de celular tem de 2 a 8 MB). */
export const TAMANHO_MAX_DO_ARQUIVO = 15_000_000

/** Se a foto passar do limite de texto com a qualidade padrão (imagem muito granulada), tenta estas, da melhor para a pior. */
const QUALIDADES_DE_RESERVA = [0.6, 0.4]

/** O maior quadrado que cabe no centro da imagem, em pixels inteiros. `lado` 0 quando as medidas não valem. */
export function recorteCentral(largura: number, altura: number): { x: number; y: number; lado: number } {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return { x: 0, y: 0, lado: 0 }
  const lado = Math.floor(Math.min(largura, altura))
  return { x: Math.floor((largura - lado) / 2), y: Math.floor((altura - lado) / 2), lado }
}

/** Primeira letra do nome, em maiúscula (um emoji conta inteiro, mesmo composto). `?` para nome vazio. */
export function inicialDoNome(nome: string): string {
  const limpo = nome.trim()
  if (limpo === '') return '?'
  const primeira = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(limpo)[Symbol.iterator]().next().value?.segment ?? Array.from(limpo)[0]
    : Array.from(limpo)[0]
  return primeira.toLocaleUpperCase('pt-BR')
}

export type ResultadoFoto =
  | { ok: true; foto: string }
  | { ok: false; erro: 'nao_e_imagem' | 'muito_grande' | 'ilegivel' }

/**
 * Transforma o arquivo escolhido na foto de perfil (`data:image/jpeg;base64,…`, 200×200).
 * Recusa o que não é imagem ou é grande demais antes de decodificar. Nunca lança erro.
 */
export async function prepararFoto(arquivo: File): Promise<ResultadoFoto> {
  if (!arquivo.type.startsWith('image/')) return { ok: false, erro: 'nao_e_imagem' }
  if (arquivo.size > TAMANHO_MAX_DO_ARQUIVO) return { ok: false, erro: 'muito_grande' }

  try {
    // createImageBitmap respeita a orientação gravada pela câmera (EXIF), ao contrário de desenhar um <img> à mão.
    const imagem = await createImageBitmap(arquivo)
    try {
      const { x, y, lado } = recorteCentral(imagem.width, imagem.height)
      if (lado === 0) return { ok: false, erro: 'ilegivel' }

      const canvas = document.createElement('canvas')
      canvas.width = LADO_DA_FOTO
      canvas.height = LADO_DA_FOTO
      const ctx = canvas.getContext('2d')
      if (!ctx) return { ok: false, erro: 'ilegivel' }
      // JPEG não tem transparência: sem um fundo, as partes transparentes de um PNG ficariam pretas.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, LADO_DA_FOTO, LADO_DA_FOTO)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(imagem, x, y, lado, lado, 0, 0, LADO_DA_FOTO, LADO_DA_FOTO)

      for (const qualidade of [QUALIDADE_DA_FOTO, ...QUALIDADES_DE_RESERVA]) {
        const foto = canvas.toDataURL('image/jpeg', qualidade)
        if (foto !== '' && isFoto(foto)) return { ok: true, foto }
      }
      return { ok: false, erro: 'ilegivel' }
    } finally {
      imagem.close()
    }
  } catch {
    return { ok: false, erro: 'ilegivel' }
  }
}
