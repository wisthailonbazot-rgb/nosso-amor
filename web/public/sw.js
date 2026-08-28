// Service worker do app.
//
// Ele existe por dois motivos: receber push (no iOS, push SO funciona com service
// worker registrado e o app aberto pela Tela de Inicio) e deixar o app abrir mesmo
// sem internet, mostrando a ultima casca carregada.
//
// Cuidado deliberado: a estrategia de cache e "rede primeiro" pra navegacao e
// "nunca cachear" pra /api. Um app de casal com chat nao pode servir mensagem
// velha do cache achando que e a atual.

// A versao do cache SOBE a cada vez que a casca muda de forma. O `activate`
// apaga tudo o que nao tem o nome atual, e e isso que destrava um aparelho que
// ficou preso no fundo rosa com um index.html velho. v7: entrou o kit Kenney
// (arquivos novos em /kenney-furniture) e a rede de seguranca do boot mudou.
const CACHE = 'casal-v7'
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
    // `cache: 'reload'` pula o cache HTTP do proprio navegador.
    //
    // "Rede primeiro" nao bastava: o `fetch` daqui ainda passava pelo cache do
    // Safari, que guardava o index.html por adivinhacao (ele vinha sem
    // `Cache-Control`). O aparelho reabria o app com um HTML velho apontando
    // pra um bundle ja apagado pelo deploy, e a tela ficava BRANCA. O servidor
    // agora manda `no-cache` nessa resposta; isto aqui e o cinto de seguranca,
    // e tambem o que destrava um aparelho que ja esta com o HTML velho preso.
    event.respondWith(
      fetch(new Request(event.request.url, { cache: 'reload', credentials: 'same-origin' }))
        .then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', copia))
          }
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
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

// Quantas mensagens ja estao acumuladas no aviso que esta na tela.
//
// O jeito do WhatsApp e UM aviso por conversa, que se atualiza e diz quantas
// mensagens tem. Ja tivemos os dois extremos aqui, e os dois estavam errados:
//
//   - tag unica "chat" sem contagem: a mensagem nova SUBSTITUIA a anterior e o
//     dono via uma so, achando que as outras nao chegaram;
//   - uma tag por mensagem (`chat-123`): nada substituia nada, e a tela de
//     bloqueio virava uma pilha de avisos separados. Foi o que ele reclamou.
//
// O certo e o meio: tag unica E contagem. Quem sabe quantas ja estao na tela e
// o proprio aparelho — `getNotifications` devolve as que estao aparecendo, e a
// contagem viaja dentro do `data` da anterior. Contar no servidor nao serviria:
// ele nao sabe quais avisos a pessoa ja dispensou com o dedo.
async function agrupar(tag, data) {
  if (!tag || !self.registration.getNotifications) return { titulo: data.title, corpo: data.body, n: 1 }
  let n = 1
  try {
    const abertas = await self.registration.getNotifications({ tag })
    for (const aviso of abertas) {
      n += (aviso.data && aviso.data.contagem) || 1
    }
  } catch (e) {
    /* navegador sem a API: segue como aviso unico */
  }
  const titulo = n > 1 ? `${data.title} (${n} mensagens)` : data.title
  return { titulo, corpo: data.body, n }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Nosso app', body: event.data ? event.data.text() : '' }
  }
  data.title = data.title || 'Nosso app'
  const ack = data.ack || ''

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

  const tag = data.tag || data.kind || 'geral'

  event.waitUntil(
    agrupar(tag, data).then(({ titulo, corpo, n }) => {
      const completa = {
        body: corpo || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // `tag` unica junta; `renotify` faz o aparelho avisar de novo em vez de
        // trocar o texto caladamente (sem ele, mensagem nova nao vibra).
        tag: tag,
        renotify: true,
        data: { url: data.url || '/', contagem: n },
      }
      const simples = {
        body: corpo || '',
        icon: '/icon-192.png',
        data: { url: data.url || '/', contagem: n },
      }
      return self.registration
        .showNotification(titulo, completa)
        .then(() => contar(ack, true, 'completa'))
        .catch((err) =>
          self.registration
            .showNotification(titulo, simples)
            .then(() => contar(ack, true, 'simples', err))
            .catch((err2) => contar(ack, false, 'nenhuma', err2))
        )
    })
  )
})

// Entrou no app: limpa a bandeja.
//
// A tela manda este recado quando o app volta a ficar visivel. Quem tem que
// fechar os avisos e o service worker — a pagina nao tem acesso as notificacoes
// mostradas por ele. Sem isto, o dono abria o app, lia tudo, e os avisos
// continuavam empilhados na tela de bloqueio.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.tipo !== 'limpar-avisos') return
  event.waitUntil(
    self.registration
      .getNotifications()
      .then((lista) => lista.forEach((aviso) => aviso.close()))
      .catch(() => {})
  )
})

// ----------------------------------------------- a assinatura que se renova
//
// ESTE HANDLER FALTAVA, e ele e a segunda causa do "as vezes o iPhone para de
// avisar e nunca mais volta".
//
// A assinatura de push nao e eterna: o proprio sistema a invalida e cria outra
// sozinho (o iOS faz isso com frequencia — ao limpar dados do Safari, ao ficar
// muito tempo sem o app ser aberto, ao atualizar o sistema). Quando isso
// acontece, o navegador dispara `pushsubscriptionchange` — e se ninguem
// escutar, o endpoint novo NUNCA chega ao servidor. Dai em diante o servidor
// manda pro endereco velho, leva 410, apaga o registro, e o aparelho fica sem
// push pra sempre. Do lado de fora parece "a notificacao parou", sem erro
// nenhum, e o unico jeito de voltar era ir no Perfil e ligar de novo na mao.
//
// Aqui a gente reassina com a MESMA chave do servidor e conta o endereco novo.
// A chave vem em `event.oldSubscription` quando o navegador manda (o Safari
// manda); quando nao vem, o `applicationServerKey` guardado no cache serve de
// plano B — sem ele nao da pra reassinar, porque `subscribe()` exige a chave.
const CHAVE_CACHE = '/__vapid__'

async function guardarChave(chave) {
  try {
    const c = await caches.open(CACHE)
    await c.put(CHAVE_CACHE, new Response(chave))
  } catch (e) {
    /* sem cache: o plano B fica indisponivel, o principal continua valendo */
  }
}

async function chaveGuardada() {
  try {
    const c = await caches.open(CACHE)
    const r = await c.match(CHAVE_CACHE)
    return r ? await r.text() : null
  } catch (e) {
    return null
  }
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const velha = event.oldSubscription
      let chave = velha && velha.options && velha.options.applicationServerKey
      if (!chave) chave = await chaveGuardada()
      if (!chave) return
      let nova = event.newSubscription
      if (!nova) {
        try {
          nova = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: chave,
          })
        } catch (e) {
          return
        }
      }
      const dados = nova.toJSON()
      try {
        await fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_endpoint: velha ? velha.endpoint : '',
            endpoint: dados.endpoint,
            p256dh: dados.keys.p256dh,
            auth: dados.keys.auth,
          }),
        })
      } catch (e) {
        /* sem rede agora; a tela reconfere o endereco no proximo boot */
      }
    })()
  )
})

// A tela manda a chave do servidor pra ca no boot, pro plano B acima existir.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.tipo !== 'guardar-chave' || !event.data.chave) return
  event.waitUntil(guardarChave(event.data.chave))
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
