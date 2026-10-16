// Textos e números que a tela de assinatura mostra, calculados a partir do catálogo e do estado.
// Puro: sem React, sem rede. A tela só desenha o que sai daqui.

import {
  ANUAL_EM_MESES, NIVEIS, NOME_DO_NIVEL, RECURSOS, TESTE_GRATIS_DIAS, precoEmCentavos, recurso,
  type NivelAssinatura, type NivelDeAcesso, type Periodo, type RecursoId,
} from './catalogo'
import { formatarDataCurta } from '@/lib/datas'
import type { EstadoAssinatura } from './regras'

const DIA_MS = 24 * 60 * 60 * 1000

/** O que o nível acrescenta (nomes dos recursos). Para o `gratuito`, é tudo o que ele oferece. */
export function recursosNovosDoNivel(nivel: NivelDeAcesso): string[] {
  return (Object.keys(RECURSOS) as RecursoId[]).filter(id => recurso(id).nivelMinimo === nivel).map(id => recurso(id).nome)
}

/** Quanto o anual economiza em relação a pagar 12 meses, em % inteiro. */
/** É igual para os três planos, porque o anual é sempre o mesmo número de meses do mensal. */
export const economiaDoAnualPercentual = (): number => Math.round(((12 - ANUAL_EM_MESES) / 12) * 100)

/** Preço do plano anual dividido por 12, em centavos: serve para comparar com o mensal. */
export const mensalEquivalenteEmCentavos = (nivel: NivelAssinatura): number => Math.round(precoEmCentavos(nivel, 'anual') / 12)

// "20 de out": o mesmo formato curto das outras telas.
function dataCurta(iso: string): string | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : formatarDataCurta(d)
}

export interface ResumoDoEstado {
  titulo: string
  detalhe: string
  /** neutro: sem destaque; destaque: assinatura saudável; alerta: pede atenção. */
  tom: 'neutro' | 'destaque' | 'alerta'
}

export function resumoDoEstado(estado: EstadoAssinatura, agora: Date = new Date()): ResumoDoEstado {
  const nome = estado.nivel ? NOME_DO_NIVEL[estado.nivel] : ''
  const fim = estado.fimDoPeriodo ? dataCurta(estado.fimDoPeriodo) : null

  switch (estado.situacao) {
    case 'teste': {
      const fimTeste = estado.fimDoTeste ? dataCurta(estado.fimDoTeste) : null
      const restante = estado.fimDoTeste ? Date.parse(estado.fimDoTeste) - agora.getTime() : null
      let quando = ''
      if (restante !== null && Number.isFinite(restante)) {
        if (restante < DIA_MS) quando = 'Termina hoje. '
        else {
          const n = Math.ceil(restante / DIA_MS)
          quando = `Faltam ${n} ${n === 1 ? 'dia' : 'dias'}${fimTeste ? ` (termina em ${fimTeste})` : ''}. `
        }
      }
      return {
        titulo: `Teste grátis do ${nome}`,
        detalhe: `${quando}Sem cartão cadastrado, depois do teste você volta ao plano gratuito. Para continuar, cadastre um cartão em "Gerenciar assinatura".`,
        tom: 'destaque',
      }
    }
    case 'ativa':
      if (estado.cancelaNoFim) {
        return { titulo: `Plano ${nome} ${estado.periodo ?? ''}`.trim(), detalhe: `Cancelada: vale${fim ? ` até ${fim}` : ' até o fim do período'}. Depois, você volta ao plano gratuito.`, tom: 'alerta' }
      }
      return { titulo: `Plano ${nome} ${estado.periodo ?? ''}`.trim(), detalhe: fim ? `Renova em ${fim}.` : 'Assinatura ativa.', tom: 'destaque' }
    case 'atrasada':
      return { titulo: 'Pagamento atrasado', detalhe: `Atualize o cartão em "Gerenciar assinatura" para não perder o acesso ao plano ${nome}.`, tom: 'alerta' }
    case 'cancelada':
      return { titulo: 'Assinatura encerrada', detalhe: 'Você voltou ao plano gratuito. Seus dados continuam salvos.', tom: 'neutro' }
    default:
      return { titulo: 'Plano gratuito', detalhe: 'Você usa o Corner sem custo, com os recursos básicos. Assine para liberar mais.', tom: 'neutro' }
  }
}

export interface RotuloDoBotao {
  texto: string
  /**
   * assinar: abre a página de pagamento; trocar: abre a confirmação da troca no Portal do Cliente;
   * portal: abre o portal comum (resolver pagamento); nenhuma: sem ação.
   */
  acao: 'assinar' | 'trocar' | 'portal' | 'nenhuma'
}

export function rotuloDoBotao(estado: EstadoAssinatura, nivel: NivelAssinatura, periodo: Periodo): RotuloDoBotao {
  if (estado.situacao === 'atrasada') return { texto: 'Resolver pagamento', acao: 'portal' }
  if (estado.situacao === 'ativa' || estado.situacao === 'teste') {
    if (estado.nivel === nivel && estado.periodo === periodo) return { texto: 'Plano atual', acao: 'nenhuma' }
    if (estado.nivel === nivel) return { texto: `Mudar para o ${periodo}`, acao: 'trocar' }
    return { texto: 'Mudar para este plano', acao: 'trocar' }
  }
  if (estado.situacao === 'cancelada') return { texto: 'Assinar', acao: 'assinar' }
  return { texto: `Começar ${TESTE_GRATIS_DIAS} dias grátis`, acao: 'assinar' }
}

export { NIVEIS }
