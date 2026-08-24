import { useCallback, useEffect, useRef, useState } from 'react'

import { api, mediaUrl } from '../api'
import { subscribe, useStore } from '../store'
import Icon from '../components/Icon'
import Sticker from '../components/Sticker'
import { clockTime, relativeDay, toDayString } from '../lib/dates'

const EMOJIS = ['❤️', '😂', '🥺', '😍', '😘', '👍', '🔥', '😅', '🤔', '😭', '🙈', '✨']

/** Grava áudio pelo microfone. Devolve o arquivo e a duração. */
function useRecorder() {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const ref = useRef({ recorder: null, chunks: [], inicio: 0, timer: null })

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // O Safari não grava webm; deixar o navegador escolher evita arquivo que o
      // servidor recusaria. O backend reconhece webm, ogg e m4a pelos bytes.
      const recorder = new MediaRecorder(stream)
      ref.current.chunks = []
      recorder.ondataavailable = (e) => e.data.size && ref.current.chunks.push(e.data)
      recorder.start()
      ref.current.recorder = recorder
      ref.current.inicio = Date.now()
      ref.current.timer = setInterval(
        () => setSegundos(Math.floor((Date.now() - ref.current.inicio) / 1000)),
        250
      )
      setSegundos(0)
      setGravando(true)
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: 'Não consegui acessar o microfone. Libere a permissão.' }
    }
  }

  function parar() {
    return new Promise((resolve) => {
      const { recorder, timer, inicio } = ref.current
      clearInterval(timer)
      setGravando(false)
      if (!recorder || recorder.state === 'inactive') return resolve(null)
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(ref.current.chunks, { type: recorder.mimeType || 'audio/webm' })
        resolve({ blob, duration: Date.now() - inicio })
      }
      recorder.stop()
    })
  }

  function cancelar() {
    const { recorder, timer } = ref.current
    clearInterval(timer)
    setGravando(false)
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => recorder.stream.getTracks().forEach((t) => t.stop())
      recorder.stop()
    }
    ref.current.chunks = []
  }

  return { gravando, segundos, iniciar, parar, cancelar, suportado: !!navigator.mediaDevices }
}

function Audio({ src, duration }) {
  const ref = useRef(null)
  const [tocando, setTocando] = useState(false)
  const total = Math.max(1, Math.round((duration || 0) / 1000))

  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        className="btn-plain audio-play"
        onClick={() => {
          const el = ref.current
          if (!el) return
          if (el.paused) {
            el.play()
            setTocando(true)
          } else {
            el.pause()
            setTocando(false)
          }
        }}
        aria-label={tocando ? 'Pausar' : 'Tocar'}
      >
        {tocando ? '❚❚' : '▶'}
      </button>
      {/* onda decorativa: barras de altura variada, o mesmo desenho toda vez
          pra mesma duração (sem aleatório, que mudaria a cada render) */}
      <div className="audio-wave">
        {Array.from({ length: 22 }).map((_, i) => (
          <i key={i} style={{ height: 4 + ((i * 7 + total * 3) % 14) }} />
        ))}
      </div>
      <span className="tiny muted">{total}s</span>
      <audio ref={ref} src={src} onEnded={() => setTocando(false)} preload="none" />
    </div>
  )
}

function Bolha({ msg, minha, citada, onResponder, onApagar, onReagir }) {
  const [menu, setMenu] = useState(false)

  return (
    <div className={`msg-row ${minha ? 'minha' : ''}`}>
      <div className="msg-bubble" onClick={() => setMenu((v) => !v)}>
        {citada && (
          <div className="msg-quote">
            {citada.type === 'sticker'
              ? 'figurinha'
              : citada.type === 'image'
                ? 'foto'
                : citada.type === 'audio'
                  ? 'áudio'
                  : citada.content}
          </div>
        )}

        {msg.type === 'sticker' && <Sticker code={msg.sticker} scale={3} />}

        {msg.type === 'image' && (
          <a href={mediaUrl(msg.media)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <img src={mediaUrl(msg.thumb)} alt="" className="msg-img" />
          </a>
        )}

        {msg.type === 'audio' && <Audio src={mediaUrl(msg.media)} duration={msg.duration_ms} />}

        {msg.content && <div className="msg-text">{msg.content}</div>}

        <div className="msg-meta">
          {clockTime(msg.created_at)}
          {minha && <span className={msg.read ? 'lido' : ''}>{msg.read ? ' ✓✓' : ' ✓'}</span>}
        </div>

        {msg.reaction && <span className="msg-reaction">{msg.reaction}</span>}
      </div>

      {menu && (
        <div className="msg-menu">
          <button className="btn-sm btn-ghost" onClick={() => { onResponder(msg); setMenu(false) }}>
            responder
          </button>
          {!minha && (
            <>
              {['❤️', '😂', '🥺'].map((e) => (
                <button key={e} className="btn-sm btn-ghost" onClick={() => { onReagir(msg, e); setMenu(false) }}>
                  {e}
                </button>
              ))}
            </>
          )}
          {minha && (
            <button className="btn-sm btn-danger" onClick={() => { onApagar(msg); setMenu(false) }}>
              apagar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Chat() {
  const { user, partner, online } = useStore()
  const [msgs, setMsgs] = useState([])
  const [stickers, setStickers] = useState([])
  const [temMais, setTemMais] = useState(false)
  const [texto, setTexto] = useState('')
  const [painel, setPainel] = useState(null) // 'emoji' | 'sticker' | null
  const [respondendo, setRespondendo] = useState(null)
  const [digitando, setDigitando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef(null)
  const listaRef = useRef(null)
  const gravador = useRecorder()
  const partnerOnline = !!partner && online.includes(partner.id)

  const rolarPraBaixo = useCallback((suave = false) => {
    fimRef.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto' })
  }, [])

  const carregar = useCallback(async () => {
    const data = await api.get('/api/chat')
    setMsgs(data.items)
    setStickers(data.stickers)
    setTemMais(data.has_more)
    await api.post('/api/chat/read').catch(() => {})
    // Abriu a conversa = leu. Zera o número da aba E o do ícone do app, senão
    // o iPhone fica com a bolinha vermelha pra sempre.
    useStore.getState().zerarNaoLidas()
    setTimeout(() => rolarPraBaixo(), 30)
  }, [rolarPraBaixo])

  useEffect(() => {
    carregar().catch((e) => setErro(e.message))

    const offNova = subscribe('chat', ({ message }) => {
      setMsgs((atual) => (atual.some((m) => m.id === message.id) ? atual : [...atual, message]))
      setDigitando(false)
      setTimeout(() => rolarPraBaixo(true), 30)
      // chegou mensagem com a tela aberta: já conta como lida
      api.post('/api/chat/read').catch(() => {})
    })
    const offLida = subscribe('chat_read', () => {
      setMsgs((atual) => atual.map((m) => (m.sender_id === user.id ? { ...m, read: true } : m)))
    })
    const offEditada = subscribe('chat_update', ({ message }) => {
      setMsgs((atual) => atual.map((m) => (m.id === message.id ? message : m)))
    })
    const offApagada = subscribe('chat_delete', ({ id }) => {
      setMsgs((atual) => atual.filter((m) => m.id !== id))
    })
    const offDigitando = subscribe('typing', () => {
      setDigitando(true)
      setTimeout(() => setDigitando(false), 3000)
    })

    return () => {
      offNova()
      offLida()
      offEditada()
      offApagada()
      offDigitando()
    }
  }, [carregar, rolarPraBaixo, user.id])

  async function carregarAntigas() {
    if (!msgs.length) return
    const lista = listaRef.current
    const alturaAntes = lista.scrollHeight
    const data = await api.get(`/api/chat?before=${msgs[0].id}`)
    setMsgs((atual) => [...data.items, ...atual])
    setTemMais(data.has_more)
    // mantém a posição visual: sem isto a tela salta pro topo ao carregar
    setTimeout(() => {
      lista.scrollTop = lista.scrollHeight - alturaAntes
    }, 20)
  }

  const ultimoAviso = useRef(0)
  function aoDigitar(valor) {
    setTexto(valor)
    const agora = Date.now()
    if (agora - ultimoAviso.current > 2500) {
      ultimoAviso.current = agora
      api.post('/api/chat/typing').catch(() => {})
    }
  }

  async function enviar() {
    const conteudo = texto.trim()
    if (!conteudo || enviando) return
    setEnviando(true)
    setTexto('')
    try {
      await api.post('/api/chat', { content: conteudo, reply_to: respondendo?.id || null })
      setRespondendo(null)
    } catch (e) {
      setErro(e.message)
      setTexto(conteudo) // devolve o texto: perder o que foi escrito é imperdoável
    }
    setEnviando(false)
  }

  async function enviarFigurinha(code) {
    setPainel(null)
    try {
      await api.post('/api/chat', { sticker: code, reply_to: respondendo?.id || null })
      setRespondendo(null)
    } catch (e) {
      setErro(e.message)
    }
  }

  async function enviarFoto(arquivo) {
    if (!arquivo) return
    setEnviando(true)
    const form = new FormData()
    form.append('file', arquivo)
    try {
      await api.post('/api/chat/image', form)
    } catch (e) {
      setErro(e.message)
    }
    setEnviando(false)
  }

  async function pararEEnviarAudio() {
    const resultado = await gravador.parar()
    if (!resultado || resultado.duration < 700) return // toque sem querer
    const form = new FormData()
    form.append('file', resultado.blob, 'recado.webm')
    form.append('duration_ms', String(resultado.duration))
    try {
      await api.post('/api/chat/audio', form)
    } catch (e) {
      setErro(e.message)
    }
  }

  // divisórias de dia, como no WhatsApp
  const comDatas = []
  let ultimoDia = null
  for (const m of msgs) {
    const dia = toDayString(new Date(m.created_at))
    if (dia !== ultimoDia) {
      comDatas.push({ separador: dia })
      ultimoDia = dia
    }
    comDatas.push(m)
  }

  return (
    <div className="chat-screen">
      <div className="chat-top">
        <div className="row">
          <span className={`dot ${partnerOnline ? 'on' : ''}`} />
          <div>
            <strong style={{ fontFamily: 'Baloo 2' }}>{partner?.name || 'Conversa'}</strong>
            <div className="muted tiny">
              {digitando ? 'digitando…' : partnerOnline ? 'online' : 'offline'}
            </div>
          </div>
        </div>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      <div className="chat-list" ref={listaRef}>
        {temMais && (
          <button className="btn-ghost btn-sm" style={{ margin: '0 auto 10px' }} onClick={carregarAntigas}>
            ver mensagens anteriores
          </button>
        )}

        {comDatas.map((item, i) =>
          item.separador ? (
            <div key={`sep-${item.separador}`} className="chat-sep">
              {relativeDay(item.separador)}
            </div>
          ) : (
            <Bolha
              key={item.id}
              msg={item}
              minha={item.sender_id === user.id}
              citada={item.reply_to ? msgs.find((m) => m.id === item.reply_to) : null}
              onResponder={setRespondendo}
              onReagir={(m, e) => api.post(`/api/chat/${m.id}/react`, { reaction: e }).catch(() => {})}
              onApagar={(m) => api.del(`/api/chat/${m.id}`).catch((err) => setErro(err.message))}
            />
          )
        )}
        <div ref={fimRef} />
      </div>

      {respondendo && (
        <div className="chat-reply">
          <div className="grow tiny">
            respondendo: {respondendo.content || respondendo.type}
          </div>
          <button className="btn-plain" onClick={() => setRespondendo(null)} aria-label="Cancelar">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {painel === 'emoji' && (
        <div className="chat-panel">
          {EMOJIS.map((e) => (
            <button key={e} className="emoji-btn" onClick={() => { setTexto((t) => t + e); setPainel(null) }}>
              {e}
            </button>
          ))}
        </div>
      )}

      {painel === 'sticker' && (
        <div className="chat-panel stickers">
          {stickers.map((code) => (
            <Sticker key={code} code={code} scale={2} comNome onClick={() => enviarFigurinha(code)} />
          ))}
        </div>
      )}

      <div className="chat-bar">
        {gravador.gravando ? (
          <>
            <button className="btn-plain" onClick={gravador.cancelar} aria-label="Cancelar">
              <Icon name="close" size={20} />
            </button>
            <div className="grow row" style={{ gap: 8 }}>
              <span className="rec-dot" />
              <span className="small">gravando… {gravador.segundos}s</span>
            </div>
            <button className="btn-primary btn-sm" onClick={pararEEnviarAudio}>
              enviar
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-plain"
              onClick={() => setPainel(painel === 'sticker' ? null : 'sticker')}
              aria-label="Figurinhas"
            >
              <Icon name="spark" size={22} />
            </button>
            <button
              className="btn-plain"
              onClick={() => setPainel(painel === 'emoji' ? null : 'emoji')}
              aria-label="Emoji"
            >
              <span style={{ fontSize: 20 }}>🙂</span>
            </button>

            <input
              className="chat-input grow"
              value={texto}
              onChange={(e) => aoDigitar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="mensagem"
            />

            <label className="btn-plain" aria-label="Foto" style={{ cursor: 'pointer' }}>
              <Icon name="camera" size={22} />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => enviarFoto(e.target.files?.[0])}
              />
            </label>

            {texto.trim() ? (
              <button className="btn-primary btn-sm" onClick={enviar} disabled={enviando}>
                <Icon name="back" size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
            ) : (
              gravador.suportado && (
                <button
                  className="btn-accent btn-sm"
                  onClick={async () => {
                    const r = await gravador.iniciar()
                    if (!r.ok) setErro(r.reason)
                  }}
                  aria-label="Gravar áudio"
                >
                  🎙
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
