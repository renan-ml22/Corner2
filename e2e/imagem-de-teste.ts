import { deflateSync } from 'node:zlib'

// ── Uma imagem PNG decodificável, montada à mão (sem arquivo binário no repositório) ──

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (dados: Buffer) => {
  let c = 0xffffffff
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const bloco = (tipo: string, dados: Buffer) => {
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const tamanho = Buffer.alloc(4); tamanho.writeUInt32BE(dados.length)
  const soma = Buffer.alloc(4); soma.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, soma])
}
/** PNG RGB com uma faixa vermelha à esquerda e azul à direita (dá para ver que o recorte é central). */
export function png(largura: number, altura: number): Buffer {
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(largura, 0); cabecalho.writeUInt32BE(altura, 4)
  cabecalho.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB, sem entrelaçamento
  const linhas = Buffer.alloc((1 + largura * 3) * altura)
  for (let y = 0; y < altura; y++) {
    const inicio = y * (1 + largura * 3) // o primeiro byte da linha é o filtro (0 = nenhum)
    for (let x = 0; x < largura; x++) linhas.set(x < largura / 2 ? [200, 30, 30] : [30, 30, 200], inicio + 1 + x * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho), bloco('IDAT', deflateSync(linhas)), bloco('IEND', Buffer.alloc(0)),
  ])
}

export const arquivoPng = (nome = 'foto.png', largura = 400, altura = 200) => ({ name: nome, mimeType: 'image/png', buffer: png(largura, altura) })

