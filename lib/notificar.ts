/** Mostra uma notificação do sistema (preferindo o service worker, que funciona no Android). */
export async function notificar(titulo: string, corpo: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opcoes = { body: corpo, icon: '/icon-192.png', tag: 'corner-lembrete' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(titulo, opcoes)
      return
    }
    new Notification(titulo, opcoes)
  } catch {
    // Navegador bloqueou: sem notificação, sem erro para o usuário.
  }
}

export async function pedirPermissaoNotificacao(): Promise<NotificationPermission | 'indisponivel'> {
  if (typeof Notification === 'undefined') return 'indisponivel'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}
