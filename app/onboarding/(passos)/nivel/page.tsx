import type { Metadata } from 'next'
import NivelCliente from './NivelCliente'

export const metadata: Metadata = { title: 'Seu nível · Corner' }

export default function NivelPage() {
  return <NivelCliente />
}
