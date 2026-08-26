// Estado global: sessao, presenca do outro, avisos e o canal de tempo real.
//
// O WebSocket vive aqui, num lugar so, e reconecta sozinho com espera crescente.
// Quem quiser reagir a um evento chama `subscribe(evento, callback)` — assim cada
// tela escuta o que lhe interessa sem abrir conexao propria.

import { create } from 'zustand'
import { api, getToken, setToken, wsUrl } from './api'
import { limparAvisos } from './push'

let socket = null
let retry = 0
let reconnectTimer = null
let pingTimer = null
// Se a conexao ja subiu alguma vez nesta sessao. Serve pra separar a PRIMEIRA
// conexao (a tela ja carregou o historico sozinha) de uma RECONEXAO (houve um
// buraco, e o que chegou nele precisa ser buscado).
let jaConectou = false
const listeners = new Map()

/**
 * O numerinho vermelho no icone do app.
 *
 * Com o app ABERTO quem manda e a tela; com ele fechado, quem manda e o service
 * worker (ver `sw.js`). Os dois chamam a mesma API do navegador, entao o numero
 * nao briga consigo mesmo.
 */
export function marcarIcone(total) {
  try {
    if (!navigator.setAppBadge) return
    const p = total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge()
    Promise.resolve(p).catch(() => {})
  } catch {
    /* navegador sem suporte: o contador na aba continua valendo */
  }
}

export function subscribe(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(handler)
  return () => listeners.get(event)?.delete(handler)
}

function emit(event, data) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(data)
    } catch (err) {
      console.error('listener quebrou', event, err)
    }
  })
  listeners.get('*')?.forEach((fn) => fn({ event, data }))
}

export const useStore = create((set, get) => ({
  ready: false,
  user: null,
  partner: null,
  balance: 0,
  couple: { start_date: '', name: 'Nosso app' },
  cyclePrivacy: { share: 'resumo' },
  pushEnabled: false,
  vapidKey: '',
  online: [],
  unread: 0,
  // Mensagens do outro ainda não lidas. Fica separado de `unread` (que é o
  // contador de AVISOS) porque são duas coisas diferentes e apareciam no lugar
  // errado: o chat não mostrava número nenhum.
  naoLidas: 0,
  connection: 'offline',

  async boot() {
    if (!getToken()) {
      set({ ready: true, user: null })
      return
    }
    try {
      await get().refreshMe()
      get().connect()
      get().refreshUnread()
      // Abriu o app: a bandeja do celular nao pode continuar com a pilha de
      // avisos que a pessoa acabou de vir ler.
      limparAvisos()
    } catch {
      setToken('')
      set({ user: null })
    } finally {
      set({ ready: true })
    }
  },

  async refreshMe() {
    const me = await api.get('/api/me')
    set({
      user: me.user,
      partner: me.partner,
      balance: me.balance,
      couple: me.couple,
      cyclePrivacy: me.cycle_privacy,
      pushEnabled: me.push_enabled,
      vapidKey: me.vapid_public_key,
    })
    return me
  },

  async refreshUnread() {
    try {
      const data = await api.get('/api/notifications?limit=1')
      set({ unread: data.unread })
    } catch {
      /* sem rede: mantem o que tinha */
    }
    try {
      const chat = await api.get('/api/chat/unread')
      get().definirNaoLidas(chat.unread)
    } catch {
      /* idem */
    }
  },

  async login(slug, password) {
    const data = await api.post('/api/auth/login', { slug, password })
    setToken(data.token)
    await get().refreshMe()
    get().connect()
    get().refreshUnread()
    set({ ready: true })
    return data.user
  },

  logout() {
    setToken('')
    jaConectou = false
    get().disconnect()
    set({ user: null, partner: null, balance: 0, online: [], unread: 0, naoLidas: 0 })
    marcarIcone(0)
  },

  setBalance(balance) {
    set({ balance })
  },

  // ---------------------------------------------------------------- tempo real
  connect() {
    const token = getToken()
    if (!token || socket) return
    set({ connection: 'conectando' })
    let ws
    try {
      ws = new WebSocket(wsUrl(token))
    } catch {
      get().scheduleReconnect()
      return
    }
    socket = ws

    ws.onopen = () => {
      const reconexao = jaConectou
      jaConectou = true
      retry = 0
      set({ connection: 'online' })
      // RECONEXÃO significa que houve um buraco: tudo o que o outro mandou
      // enquanto a conexão estava caída não passou por evento nenhum — o
      // WebSocket só entrega o que acontece com ele de pé. Quem estiver numa
      // tela que depende de histórico (o chat) tem que ir BUSCAR o que perdeu.
      //
      // Isto é separado do `visibilitychange` de propósito: perder sinal na rua
      // derruba a conexão sem esconder o app, então a visibilidade sozinha não
      // cobriria o caso.
      if (reconexao) {
        get().refreshUnread()
        emit('resumed', null)
      }
      clearInterval(pingTimer)
      // ping periodico: proxy costuma matar conexao parada em 60s
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    ws.onmessage = (raw) => {
      let message
      try {
        message = JSON.parse(raw.data)
      } catch {
        return
      }
      if (message.event === 'presence') set({ online: message.data.online || [] })
      if (message.event === 'notification') {
        set({ unread: get().unread + 1 })
      }
      if (message.event === 'wallet' && message.data?.balance !== undefined) {
        set({ balance: message.data.balance })
      }
      // Mensagem do parceiro chegando com o app aberto: soma no contador do
      // chat, a não ser que a conversa já esteja na tela.
      if (message.event === 'chat' && message.data?.message) {
        const minha = message.data.message.sender_id === get().user?.id
        const noChat = location.pathname.startsWith('/chat')
        if (!minha && !noChat) get().somarNaoLida(1)
      }
      if (message.event === 'chat_read') get().zerarNaoLidas()
      emit(message.event, message.data)
    }

    ws.onclose = () => {
      socket = null
      clearInterval(pingTimer)
      set({ connection: 'offline' })
      if (getToken()) get().scheduleReconnect()
    }

    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* ja fechou */
      }
    }
  },

  somarNaoLida(quantas = 1) {
    const total = Math.max(0, get().naoLidas + quantas)
    set({ naoLidas: total })
    marcarIcone(total)
  },

  definirNaoLidas(total) {
    const n = Math.max(0, Number(total) || 0)
    set({ naoLidas: n })
    marcarIcone(n)
  },

  zerarNaoLidas() {
    set({ naoLidas: 0 })
    marcarIcone(0)
  },

  scheduleReconnect() {
    clearTimeout(reconnectTimer)
    // espera crescente ate 15s: sem isso, celular sem sinal vira metralhadora
    const wait = Math.min(1000 * 2 ** retry, 15000)
    retry += 1
    reconnectTimer = setTimeout(() => get().connect(), wait)
  },

  disconnect() {
    clearTimeout(reconnectTimer)
    clearInterval(pingTimer)
    retry = 0
    if (socket) {
      const ws = socket
      socket = null
      try {
        ws.close()
      } catch {
        /* ja fechou */
      }
    }
    set({ connection: 'offline' })
  },
}))

// O celular fecha a conexao quando o app vai pro segundo plano. Ao voltar, o
// estado precisa ser re-sincronizado — senao a tela mostra dado de meia hora atras.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const store = useStore.getState()
    if (!store.user) return
    store.connect()
    store.refreshMe().catch(() => {})
    store.refreshUnread()
    limparAvisos()
    emit('resumed', null)
  })
}

export function partnerOnline() {
  const { partner, online } = useStore.getState()
  return !!partner && online.includes(partner.id)
}
