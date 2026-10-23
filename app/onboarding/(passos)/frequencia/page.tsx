import type { Metadata } from 'next'
import FrequenciaCliente from './FrequenciaCliente'

export const metadata: Metadata = { title: 'Dias de treino · Corner' }

export default function FrequenciaPage() {
  return <FrequenciaCliente />
}
