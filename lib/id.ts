/** Id único para registros novos. `crypto.randomUUID` só existe em contexto seguro (https/localhost). */
export function novoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
