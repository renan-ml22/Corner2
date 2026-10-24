// Contraste de cores (WCAG) para os testes. Converte oklch para sRGB linear (fórmulas do Oklab, de Björn Ottosson)
// e calcula a luminância relativa.

/** "oklch(0.72 0.15 150)" -> luminância relativa de 0 a 1. */
export function luminancia(oklch: string): number {
  const partes = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(oklch.trim())
  if (!partes) throw new Error(`cor oklch inválida: ${oklch}`)
  const [l, c, h] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const fixa = (v: number) => Math.min(1, Math.max(0, v))
  const r = fixa(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)
  const g = fixa(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)
  const bl = fixa(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

/** Razão de contraste entre duas cores oklch (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}
