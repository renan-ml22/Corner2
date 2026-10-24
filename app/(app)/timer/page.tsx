import type { Metadata } from 'next'
import TimerCliente from './TimerCliente'

export const metadata: Metadata = { title: 'Timer · Corner' }

export default function TimerPage() {
  return <TimerCliente />
}
