// Service worker do app.
//
// Ele existe por dois motivos: receber push (no iOS, push SO funciona com service
// worker registrado e o app aberto pela Tela de Inicio) e deixar o app abrir mesmo
// sem internet, mostrando a ultima casca carregada.
//
// Cuidado deliberado: a estrategia de cache e "rede primeiro" pra navegacao e
// "nunca cachear" pra /api. Um app de casal com chat nao pode servir mensagem
// velha do cache achando que e a atual.

const CACHE = 'casal-v3'
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
//
// Duas coisas aqui existem por causa de um caso real: o servidor mandava, a
// Apple aceitava, e nada aparecia no iPhone.
//
// 1. **Plano B na hora de mostrar.** `showNotification` REJEITA se alguma opcao
//    nao agradar o navegador — e a Safari e mais exigente que as outras. Uma
//    opcao ruim (um `badge` que ela nao aceita, por exemplo) fazia o aviso
//    inteiro nao aparecer, sem erro em lugar nenhum. Se a versao completa
//    falhar, mostra a versao simples: melhor um aviso sem enfeite do que aviso
//    nenhum.
//
// 2. **Bilhete de volta.** O `ack` que veio no push e devolvido pro servidor
//    dizendo se deu certo. E o que separa "o aparelho nem acordou" de "acordou e
//    nao conseguiu mostrar" — do lado de fora, os dois parecem a mesma coisa.
async function contar(ack, ok, modo, erro) {
  if (!ack) return
  try {
    await fetch('/api/push/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ack, ok, modo, erro: String(erro || '').slice(0, 200) }),
    })
  } catch (e) {
    /* sem rede: paciencia, o aviso e o que importa */
  }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Nosso app', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Nosso app'
  const ack = data.ack || ''

  const completa = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // tag agrupa: cinco mensagens seguidas viram um aviso que se atualiza,
    // em vez de cinco avisos empilhados na tela de bloqueio
    tag: data.tag || data.kind || 'geral',
    renotify: true,
    data: { url: data.url || '/' },
  }
  const simples = { body: data.body || '', icon: '/icon-192.png', data: { url: data.url || '/' } }

  // O numerinho vermelho no icone do app.
  //
  // No iPhone, com o app fechado, ele e a UNICA pista de que chegou coisa nova.
  // Precisa ser posto AQUI, no service worker, e nao na tela: a tela nem esta
  // rodando quando o push chega. `setAppBadge` existe no iOS 16.4+ pra web app
  // da Tela de Inicio; onde nao existir, o `catch` engole e o aviso normal
  // continua valendo.
  if (typeof data.badge === 'number' && self.navigator && self.navigator.setAppBadge) {
    const acao =
      data.badge > 0
        ? self.navigator.setAppBadge(data.badge)
        : self.navigator.clearAppBadge()
    Promise.resolve(acao).catch(() => {})
  }

  event.waitUntil(
    self.registration
      .showNotification(title, completa)
      .then(() => contar(ack, true, 'completa'))
      .catch((err) =>
        self.registration
          .showNotification(title, simples)
          .then(() => contar(ack, true, 'simples', err))
          .catch((err2) => contar(ack, false, 'nenhuma', err2))
      )
  )
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
