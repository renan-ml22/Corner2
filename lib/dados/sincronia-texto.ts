// Textos que descrevem a sincronização com a conta na nuvem (usados na tela de Perfil).

import type { EstadoDaSincronia } from './repositorio-sincronizado'

/** Frase sobre onde os dados ficam. Com a conta ligada, deixa de ser verdade que eles ficam "só neste aparelho". */
export function textoDeOndeFicamOsDados(estado: EstadoDaSincronia): string {
  return estado === 'desligada'
    ? 'Seus dados ficam só neste aparelho. Baixe um backup de vez em quando, principalmente antes de trocar de celular ou limpar o navegador.'
    : 'Seus dados ficam guardados na sua conta e também neste aparelho. Mesmo assim, baixe um backup de vez em quando.'
}

/** Situação do envio para a conta. `null` quando não há conta na nuvem (nada a mostrar). */
export function textoDaSincronia(estado: EstadoDaSincronia): string | null {
  switch (estado) {
    case 'desligada': return null
    case 'sincronizando': return 'Sincronizando com a sua conta…'
    case 'ok': return 'Tudo salvo na sua conta.'
    case 'pendente': return 'A sua conta não respondeu agora (sem conexão ou serviço fora do ar). O que você fizer fica salvo neste aparelho e vai para a conta assim que der.'
  }
}
