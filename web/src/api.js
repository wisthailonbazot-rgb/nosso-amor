// Conversa com a API. Um lugar so pra token, erro e URL.
//
// O app e servido pelo proprio backend em producao, e em desenvolvimento o Vite
// faz proxy de /api — entao a URL e sempre relativa e o codigo nao precisa saber
// onde esta rodando. A excecao e o APK do Capacitor, que roda em
// capacitor://localhost e precisa do endereco cravado: e o que VITE_API_URL faz.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// Dentro do APK o app NAO e servido pelo backend: ele roda de
// `https://localhost` (Capacitor), e ali "/" e o pacote embutido, nao o
// servidor. Por isso o endereco vem cravado no build por `VITE_API_URL` — e a
// mesma estrutura que ja funciona no `hvac-system`.
export const RODANDO_EMPACOTADO =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && !!BASE))

const TOKEN_KEY = 'casal.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* modo privado do Safari pode recusar; o app segue com sessao de memoria */
  }
}

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function apiUrl(path) {
  return `${BASE}${path}`
}

/**
 * Resolve o endereco de uma foto ou audio que veio do servidor.
 *
 * ESTE ERA O BUG DA FOTO E DO AUDIO NO APK. O servidor devolve o caminho
 * RELATIVO ("/media/abc.jpg?token=..."), porque ele nao tem como saber com
 * seguranca por qual endereco publico esta sendo acessado. No navegador isso
 * resolve sozinho, porque o app e servido pelo proprio backend. Dentro do APK,
 * nao: `<img src="/media/...">` vira `https://localhost/media/...`, que aponta
 * pro pacote embutido no aparelho — onde nao existe foto nenhuma. A imagem
 * ficava quebrada e o audio nao tocava, sem erro na tela.
 *
 * Toda foto, miniatura e audio TEM que passar por aqui.
 */
export function mediaUrl(path) {
  if (!path) return path
  // ja e absoluto (http, blob de previa local, data:) — nao mexe
  if (/^(https?:|blob:|data:|capacitor:)/.test(path)) return path
  return `${BASE}${path}`
}

export function wsUrl(token) {
  if (BASE) {
    return `${BASE.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/ws?token=${encodeURIComponent(token)}`
}

async function request(method, path, body, options = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(apiUrl(path), { method, headers, body: payload, ...options })
  } catch {
    throw new ApiError(0, 'Sem conexao com o servidor')
  }

  if (response.status === 204) return null

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const detail = (data && data.detail) || (typeof data === 'string' ? data : '') || 'Deu erro'
    // 401 em qualquer rota = sessao morreu. Limpa e deixa o App mandar pro login.
    if (response.status === 401) setToken('')
    throw new ApiError(response.status, detail, data)
  }
  return data
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  del: (path, body, options) => request('DELETE', path, body, options),
}
