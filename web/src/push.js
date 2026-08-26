// Notificacao por Web Push, e o diagnostico de por que ela nao chegou.
//
// No Android isso e simples: o Chrome aceita push de qualquer site em HTTPS. No
// iPhone tem tres condicoes que falham em silencio, e por isso existe `diagnose()`:
//
//   1. o site TEM que ter sido aberto pela Tela de Inicio (navigator.standalone);
//      no Safari normal a API existe mas nunca entrega nada;
//   2. a permissao so pode ser pedida dentro de um toque do dedo — pedir no
//      carregamento da tela e recusado sem mensagem de erro;
//   3. precisa de iOS 16.4 ou mais novo.
//
// A tela de Perfil mostra o resultado disso em portugues, pra descobrir qual das
// tres falhou olhando o aparelho, em vez de adivinhar.

import { api } from './api'

export function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function isApple() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
}

export function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function permission() {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Lista legivel do que esta certo e do que falta neste aparelho. */
export function diagnose() {
  const items = []
  const secure = window.isSecureContext
  items.push({
    ok: secure,
    label: 'Conexao segura (HTTPS)',
    hint: secure ? '' : 'Notificacao so funciona em HTTPS. No PC, localhost tambem vale.',
  })

  const sw = 'serviceWorker' in navigator
  items.push({
    ok: sw,
    label: 'Service worker disponivel',
    hint: sw ? '' : 'Este navegador nao suporta. Use Safari no iPhone ou Chrome no Android.',
  })

  const pm = 'PushManager' in window
  items.push({
    ok: pm,
    label: 'Push disponivel',
    hint: pm ? '' : 'No iPhone isso aparece so a partir do iOS 16.4.',
  })

  if (isApple()) {
    const home = isStandalone()
    items.push({
      ok: home,
      label: 'Aberto pela Tela de Inicio',
      hint: home
        ? ''
        : 'No iPhone: botao de compartilhar > Adicionar a Tela de Inicio, e abra pelo icone. Pelo Safari a notificacao nunca chega.',
    })
  }

  const perm = permission()
  items.push({
    ok: perm === 'granted',
    label: 'Permissao concedida',
    hint:
      perm === 'granted'
        ? ''
        : perm === 'denied'
          ? 'Voce negou antes. Tem que liberar nos ajustes do aparelho — o app nao consegue perguntar de novo.'
          : 'Ainda nao foi pedida. Toque em "Ligar notificacoes".',
  })

  return { items, allOk: items.every((i) => i.ok) }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    // Pede a checagem de versao NA MAO.
    //
    // O iPhone segura o service worker com forca: uma vez instalado, ele pode
    // ficar dias servindo a versao antiga, e correcao no tratamento do push
    // simplesmente nao chega. Com `skipWaiting`/`clients.claim` do outro lado,
    // este `update()` faz a versao nova assumir ainda nesta abertura do app.
    registro.update().catch(() => {})
    return registro
  } catch (err) {
    console.warn('service worker nao registrou', err)
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Liga a notificacao neste aparelho. Precisa ser chamada de dentro de um clique.
 * Devolve { ok, reason } — nunca lanca, pra tela poder explicar o que houve.
 */
export async function enablePush(vapidPublicKey) {
  if (!supported()) return { ok: false, reason: 'Este navegador nao suporta notificacao.' }
  if (!vapidPublicKey) return { ok: false, reason: 'O servidor esta sem chave de notificacao.' }
  if (isApple() && !isStandalone()) {
    return {
      ok: false,
      reason:
        'No iPhone, primeiro adicione o app a Tela de Inicio e abra pelo icone. Pelo Safari a notificacao nao funciona.',
    }
  }

  const registration = (await registerServiceWorker()) || (await navigator.serviceWorker.ready)
  if (!registration) return { ok: false, reason: 'Nao consegui registrar o service worker.' }

  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return {
      ok: false,
      reason:
        perm === 'denied'
          ? 'Permissao negada. Libere nos ajustes do aparelho.'
          : 'Permissao nao concedida.',
    }
  }

  let subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    // Se o servidor trocou de chave VAPID, a assinatura antiga fica invalida e
    // todo envio falha em silencio. Refaz quando a chave nao bate.
    const current = subscription.options?.applicationServerKey
    const wanted = urlBase64ToUint8Array(vapidPublicKey)
    const same =
      current &&
      new Uint8Array(current).length === wanted.length &&
      new Uint8Array(current).every((b, i) => b === wanted[i])
    if (!same) {
      await subscription.unsubscribe().catch(() => {})
      subscription = null
    }
  }

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    } catch (err) {
      return { ok: false, reason: `O aparelho recusou a assinatura: ${err.message}` }
    }
  }

  const raw = subscription.toJSON()
  try {
    await api.post('/api/push/subscribe', {
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      label: deviceLabel(),
    })
  } catch (err) {
    return { ok: false, reason: `O servidor recusou o registro: ${err.message}` }
  }
  return { ok: true, reason: '' }
}

export async function disablePush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {})
  await subscription.unsubscribe().catch(() => {})
}

/**
 * Tira os avisos da bandeja do celular. Chamado ao ENTRAR no app.
 *
 * Dois caminhos porque nenhum deles sozinho cobre os dois aparelhos:
 *
 *  1. `registration.getNotifications()` — a página consegue listar e fechar os
 *     avisos do próprio service worker no Chrome/Android;
 *  2. o recado `limpar-avisos` pro service worker — no iPhone o `controller`
 *     é quem responde de forma confiável, e há o caso de a página ter sido
 *     aberta pelo próprio aviso, quando a lista ainda não está pronta aqui.
 *
 * Fechar aviso não é o mesmo que marcá-lo como lido no servidor: a tela de
 * Avisos continua com o histórico. O que some é a pilha na tela de bloqueio,
 * que era a reclamação.
 */
export async function limparAvisos() {
  try {
    if (navigator.setAppBadge) navigator.clearAppBadge().catch(() => {})
  } catch {
    /* navegador sem badge */
  }
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration?.getNotifications) {
      const lista = await registration.getNotifications()
      lista.forEach((aviso) => aviso.close())
    }
    navigator.serviceWorker.controller?.postMessage({ tipo: 'limpar-avisos' })
  } catch {
    /* sem service worker registrado ainda: nada a limpar */
  }
}

export function deviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'PC'
  if (/Macintosh/.test(ua)) return 'Mac'
  return 'Aparelho'
}
