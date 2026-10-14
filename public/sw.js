// Service worker do Corner: deixa o app abrir (e o cronômetro funcionar) em academias com sinal ruim.
// - Arquivos estáticos (JS/CSS do build, ícones, fonte de ícones): cache primeiro.
// - Telas: rede primeiro; sem rede, usa a última cópia visitada ou a página offline.
// - Dados do usuário ficam no localStorage, então não passam por aqui.

const VERSAO = 'corner-v1'
const ESTATICO = `${VERSAO}-estatico`
const PAGINAS = `${VERSAO}-paginas`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(ESTATICO)
      .then(cache => cache.addAll([OFFLINE_URL, '/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => !n.startsWith(VERSAO)).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

async function cachePrimeiro(request) {
  const cache = await caches.open(ESTATICO)
  const guardado = await cache.match(request)
  if (guardado) return guardado
  const resposta = await fetch(request)
  if (resposta.ok || resposta.type === 'opaque') cache.put(request, resposta.clone())
  return resposta
}

async function atualizarEmSegundoPlano(request) {
  const cache = await caches.open(ESTATICO)
  const guardado = await cache.match(request)
  const rede = fetch(request)
    .then(resposta => {
      if (resposta.ok || resposta.type === 'opaque') cache.put(request, resposta.clone())
      return resposta
    })
    .catch(() => guardado)
  return guardado ?? rede
}

async function redePrimeiro(request) {
  try {
    const resposta = await fetch(request)
    // Só guarda páginas normais: redirecionamentos (ex.: sessão expirada → /login) não podem
    // ser salvos no lugar da página pedida.
    if (resposta.ok && resposta.type === 'basic' && !resposta.redirected) {
      const cache = await caches.open(PAGINAS)
      cache.put(request, resposta.clone())
    }
    return resposta
  } catch {
    const guardada = await caches.match(request, { ignoreSearch: true, cacheName: PAGINAS })
    return guardada ?? (await caches.match(OFFLINE_URL)) ?? Response.error()
  }
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Fontes de ícones (Phosphor) vêm do unpkg: guarda uma cópia para uso offline.
  if (url.hostname === 'unpkg.com') {
    event.respondWith(atualizarEmSegundoPlano(request))
    return
  }

  if (url.origin !== self.location.origin) return

  // Requisições internas do Next (RSC) e rotas de API passam direto.
  if (url.searchParams.has('_rsc') || request.headers.has('RSC') || url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/') || /^\/icon-.*\.png$/.test(url.pathname)) {
    event.respondWith(cachePrimeiro(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(redePrimeiro(request))
  }
})
