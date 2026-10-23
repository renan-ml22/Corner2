import type { Metadata } from 'next'
import PlanoCliente from './PlanoCliente'

export const metadata: Metadata = { title: 'Seu plano · Corner' }

export default function PlanoPage() {
  return <PlanoCliente />
}
