// Service worker do app.
//
// Ele existe por dois motivos: receber push (no iOS, push SO funciona com service
// worker registrado e o app aberto pela Tela de Inicio) e deixar o app abrir mesmo
// sem internet, mostrando a ultima casca carregada.
//
// Cuidado deliberado: a estrategia de cache e "rede primeiro" pra navegacao e
// "nunca cachear" pra /api. Um app de casal com chat nao pode servir mensagem
// velha do cache achando que e a atual.

const CACHE = 'casal-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return
  if (url.pathname.startsWith('/media')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')))
    return
  }
  // Rede primeiro também para JS/CSS. Cache primeiro aqui misturava módulos de
  // builds diferentes (inclusive duas cópias incompatíveis do React) e podia
  // deixar a interface quebrada até o usuário limpar os dados do navegador.
  event.respondWith(fetch(event.request).then((res) => {
    if (res.ok && url.origin === self.location.origin) {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(event.request, copy))
    }
    return res
  }).catch(() => caches.match(event.request)))
})

// ------------------------------------------------------------------ push
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Nosso app', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Nosso app'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // tag agrupa: cinco mensagens seguidas viram um aviso que se atualiza,
    // em vez de cinco avisos empilhados na tela de bloqueio
    tag: data.tag || data.kind || 'geral',
    renotify: true,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        // app ja aberto: leva pra tela certa em vez de abrir outra janela
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
