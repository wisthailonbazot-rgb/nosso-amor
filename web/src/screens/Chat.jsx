import { useCallback, useEffect, useRef, useState } from 'react'

import { api, mediaUrl } from '../api'
import { subscribe, useStore } from '../store'
import Icon from '../components/Icon'
import Sticker from '../components/Sticker'
import { clockTime, relativeDay, toDayString } from '../lib/dates'

const EMOJIS = ['❤️', '😂', '🥺', '😍', '😘', '👍', '🔥', '😅', '🤔', '😭', '🙈', '✨']

/**
 * Grava audio pelo microfone.
 *
 * ---------------------------------------------------- o audio que nao ia
 *
 * No Android, pelo app instalado do site, gravar parecia funcionar e nada
 * chegava na conversa. Tres coisas concorriam pra isso, e as tres falhavam
 * CALADAS — que e o motivo de o defeito ter durado:
 *
 * 1. **`recorder.start()` sem fatia de tempo.** Sem argumento, o navegador so
 *    entrega os dados no fim, num `dataavailable` unico — e no WebView do
 *    Android esse evento final sai VAZIO com alguma frequencia (gravacao curta,
 *    troca de foco, o proprio `stop()` chegando antes de o codificador ter
 *    fechado o primeiro bloco). O `Blob` saia com 0 byte, o servidor recusava
 *    com "arquivo vazio" e a mensagem de erro se perdia. Com `start(250)` os
 *    pedacos vao chegando durante a gravacao e sempre ha o que mandar.
 *
 * 2. **O formato escolhido no escuro.** `new MediaRecorder(stream)` deixa o
 *    navegador decidir, e o padrao nem sempre e um formato que o servidor
 *    reconhece pelos primeiros bytes. Agora a lista de formatos e percorrida com
 *    `isTypeSupported` na ordem do que o backend sabe ler, e a EXTENSAO do
 *    arquivo sai do formato que saiu de verdade — antes ia `recado.webm`
 *    cravado, mesmo quando o aparelho gravou mp4.
 *
 * 3. **`onstop` como unico ponto de chegada.** A ordem entre `dataavailable` e
 *    `stop` nao e a mesma em todos os navegadores; onde o `stop` vem primeiro, a
 *    Promise resolvia com os pedacos ainda incompletos. Agora quem resolve e o
 *    que chegar por ultimo, e ha um prazo maximo pra nunca ficar pendurado.
 *
 * E a regra que vale pras tres: **esta funcao nunca devolve `null` calado**.
 * Ela devolve `{ ok:false, reason }` com o motivo em portugues, e a tela mostra.
 * Foi assim que se resolveu o push do iPhone, e pelo mesmo motivo — sem o
 * motivo na tela, "nao funciona" e um chute entre cinco suspeitos.
 */

// Na ordem de preferencia, e todos reconhecidos pelo `media_store.py` do
// servidor (que confere pelos primeiros bytes, nao pelo nome).
const FORMATOS = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm', 'webm'],
  ['audio/ogg;codecs=opus', 'ogg'],
  ['audio/ogg', 'ogg'],
  ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
  ['audio/mp4', 'm4a'],
]

function escolherFormato() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const [tipo, ext] of FORMATOS) {
    try {
      if (MediaRecorder.isTypeSupported?.(tipo)) return { tipo, ext }
    } catch {
      /* navegador sem isTypeSupported: cai no padrao logo abaixo */
    }
  }
  // Sem nenhum reconhecido, deixa o navegador escolher. E melhor tentar do que
  // desistir: o Safari antigo nao responde `isTypeSupported` e grava mp4 bem.
  return { tipo: '', ext: 'm4a' }
}

/** Por que o microfone recusou, em portugues. */
function motivoDoMicrofone(err) {
  const nome = err?.name || ''
  if (!window.isSecureContext) {
    return 'O app precisa estar em HTTPS pra usar o microfone. Abra pelo endereço com cadeado.'
  }
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return 'A permissão do microfone está negada. Libere nos ajustes do aparelho para este app.'
  }
  if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') {
    return 'Não encontrei microfone neste aparelho.'
  }
  if (nome === 'NotReadableError' || nome === 'TrackStartError') {
    return 'O microfone está ocupado por outro app. Feche a ligação ou o gravador e tente de novo.'
  }
  return `Não consegui acessar o microfone (${nome || 'motivo desconhecido'}).`
}

function useRecorder() {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const ref = useRef({ recorder: null, chunks: [], inicio: 0, timer: null, ext: 'webm' })

  async function iniciar() {
    if (!navigator.mediaDevices?.getUserMedia) {
      // Isto acontece de verdade: fora de HTTPS o `mediaDevices` nem existe, e
      // antes o botao de gravar simplesmente sumia da barra sem explicacao.
      return {
        ok: false,
        reason: window.isSecureContext
          ? 'Este navegador não grava áudio.'
          : 'Sem HTTPS o navegador não deixa gravar áudio. Abra o app pelo endereço com cadeado.',
      }
    }
    const formato = escolherFormato()
    if (!formato) return { ok: false, reason: 'Este navegador não grava áudio.' }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      return { ok: false, reason: motivoDoMicrofone(err) }
    }

    let recorder
    try {
      recorder = formato.tipo
        ? new MediaRecorder(stream, { mimeType: formato.tipo })
        : new MediaRecorder(stream)
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      return { ok: false, reason: `Este aparelho recusou a gravação (${err?.name || 'erro'}).` }
    }

    ref.current.chunks = []
    ref.current.ext = formato.ext
    recorder.ondataavailable = (e) => e.data?.size && ref.current.chunks.push(e.data)
    // A FATIA DE TEMPO E O CONSERTO PRINCIPAL — ver o comentario grande acima.
    recorder.start(250)
    ref.current.recorder = recorder
    ref.current.inicio = Date.now()
    ref.current.timer = setInterval(
      () => setSegundos(Math.floor((Date.now() - ref.current.inicio) / 1000)),
      250
    )
    setSegundos(0)
    setGravando(true)
    return { ok: true, reason: '' }
  }

  function parar() {
    return new Promise((resolve) => {
      const { recorder, timer, inicio, ext } = ref.current
      clearInterval(timer)
      setGravando(false)
      if (!recorder || recorder.state === 'inactive') {
        return resolve({ ok: false, reason: 'A gravação não chegou a começar.' })
      }

      let resolvido = false
      const fechar = () => {
        if (resolvido) return
        resolvido = true
        clearTimeout(prazo)
        try {
          recorder.stream.getTracks().forEach((t) => t.stop())
        } catch {
          /* ja parado */
        }
        const tipo = recorder.mimeType || 'audio/webm'
        const blob = new Blob(ref.current.chunks, { type: tipo })
        ref.current.chunks = []
        if (!blob.size) {
          // Continua possivel (microfone mudo, gravacao de meio segundo), mas
          // agora tem nome: antes isso virava um 400 do servidor sem contexto.
          return resolve({
            ok: false,
            reason: 'A gravação saiu vazia. Tente segurar mais um pouco.',
          })
        }
        resolve({ ok: true, blob, ext, duration: Date.now() - inicio })
      }

      // Quem resolve e o ULTIMO a chegar: a ordem entre `dataavailable` e
      // `stop` muda de navegador pra navegador.
      recorder.onstop = fechar
      recorder.ondataavailable = (e) => {
        if (e.data?.size) ref.current.chunks.push(e.data)
        if (recorder.state === 'inactive') fechar()
      }
      // E um prazo, pra nunca ficar pendurado esperando um evento que nao veio.
      const prazo = setTimeout(fechar, 1500)
      try {
        recorder.stop()
      } catch {
        fechar()
      }
    })
  }

  function cancelar() {
    const { recorder, timer } = ref.current
    clearInterval(timer)
    setGravando(false)
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => recorder.stream.getTracks().forEach((t) => t.stop())
      try {
        recorder.stop()
      } catch {
        /* ja parado */
      }
    }
    ref.current.chunks = []
  }

  // O botao aparece sempre que ha `MediaRecorder`, mesmo sem `mediaDevices`:
  // escondido, ele nao explicava nada. Agora ele aparece e o toque diz o motivo.
  return {
    gravando,
    segundos,
    iniciar,
    parar,
    cancelar,
    suportado: typeof MediaRecorder !== 'undefined',
  }
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

/**
 * Uma mensagem na conversa.
 *
 * O jeito de responder mudou pra ser o do WhatsApp, que é o que o dono pediu e o
 * que todo mundo já tem no dedo:
 *
 *  - **arrastar a mensagem de lado** responde na hora. É o gesto mais usado, e
 *    não custa um toque a mais nem tapa a tela com menu;
 *  - **segurar** MARCA a mensagem. Marcada, ela fica destacada e as ações
 *    aparecem numa barra — responder, reagir, copiar, apagar.
 *
 * O que existia era um toque simples que abria um menuzinho embaixo da bolha.
 * Dois problemas: tocar é o mesmo gesto de abrir a foto (então o menu abria sem
 * querer o tempo todo), e não havia como "marcar" nada — a mensagem nunca ficava
 * escolhida, o menu só piscava.
 */
function Bolha({ msg, minha, citada, autorCitado, marcada, onMarcar, onResponder }) {
  const [puxada, setPuxada] = useState(0)
  const gesto = useRef(null)
  const espera = useRef(null)

  const LIMITE = 52   // o quanto arrastar pra virar resposta

  function inicio(e) {
    // Só com um dedo, e nunca em cima de link/imagem (lá o toque abre a mídia).
    gesto.current = { x: e.clientX, y: e.clientY, ativo: false, cancelado: false }
    clearTimeout(espera.current)
    // Segurar marca. 420 ms é o tempo do WhatsApp: curto pra não parecer travado
    // e longo pra não disparar quando a pessoa só está rolando a conversa.
    espera.current = setTimeout(() => {
      if (gesto.current && !gesto.current.cancelado) {
        gesto.current.cancelado = true
        onMarcar(msg)
        window.casalSound?.('nav')
      }
    }, 420)
  }

  function mover(e) {
    const g = gesto.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    // Rolagem vertical vence: se o dedo desceu mais do que andou pro lado, é a
    // pessoa navegando a conversa, não puxando a mensagem.
    if (!g.ativo && Math.abs(dy) > Math.abs(dx)) { cancelar(); return }
    if (Math.abs(dx) < 8) return
    g.ativo = true
    clearTimeout(espera.current)
    e.preventDefault?.()
    // Só pra um lado, e com teto: puxar sem limite faria a bolha sair da tela.
    setPuxada(Math.max(0, Math.min(LIMITE + 12, minha ? -dx : dx)))
  }

  function fim() {
    clearTimeout(espera.current)
    const soltou = puxada
    setPuxada(0)
    gesto.current = null
    if (soltou >= LIMITE) { onResponder(msg); window.casalSound?.('nav') }
  }

  function cancelar() {
    clearTimeout(espera.current)
    gesto.current = null
    setPuxada(0)
  }

  const resumo = msg.type === 'sticker' ? 'figurinha'
    : msg.type === 'image' ? 'foto'
      : msg.type === 'audio' ? 'áudio' : msg.content

  return (
    <div
      className={`msg-row ${minha ? 'minha' : ''} ${marcada ? 'marcada' : ''}`}
      onPointerDown={inicio}
      onPointerMove={mover}
      onPointerUp={fim}
      onPointerCancel={cancelar}
    >
      {/* a setinha que aparece por trás enquanto a mensagem é puxada */}
      {puxada > 0 && (
        <span className={`msg-puxa ${puxada >= LIMITE ? 'pronta' : ''}`} aria-hidden="true">
          <Icon name="reply" size={15} />
        </span>
      )}

      <div
        className="msg-bubble"
        style={puxada ? { transform: `translateX(${minha ? -puxada : puxada}px)` } : undefined}
      >
        {citada && (
          <div className="msg-quote">
            {autorCitado && <b>{autorCitado}</b>}
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

      {marcada && <span className="msg-marca" aria-label="Mensagem marcada"><Icon name="check" size={12} /></span>}
      <span className="visually-hidden">{resumo}</span>
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
  const [marcada, setMarcada] = useState(null)
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

  /**
   * Busca a página mais nova e junta com o que já está na tela.
   *
   * É o mesmo caminho da primeira carga e da RE-SINCRONIZAÇÃO. Ele junta em vez
   * de substituir porque quem já rolou pra trás (`carregarAntigas`) perderia o
   * histórico carregado se a lista fosse trocada inteira.
   */
  const sincronizar = useCallback(async () => {
    const data = await api.get('/api/chat')
    setStickers(data.stickers)
    setMsgs((atual) => {
      if (!data.items.length) return atual
      const maisAntigaDaPagina = data.items[0].id
      // O que veio do servidor é a verdade da janela nova (inclusive reação,
      // edição e visto); o que é mais velho que ela continua como estava.
      const anteriores = atual.filter((m) => m.id < maisAntigaDaPagina)
      if (!anteriores.length) setTemMais(data.has_more)
      return [...anteriores, ...data.items]
    })
    await api.post('/api/chat/read').catch(() => {})
    // Abriu a conversa = leu. Zera o número da aba E o do ícone do app, senão
    // o iPhone fica com a bolinha vermelha pra sempre.
    useStore.getState().zerarNaoLidas()
    setTimeout(() => rolarPraBaixo(), 30)
  }, [rolarPraBaixo])

  const carregar = sincronizar

  useEffect(() => {
    carregar().catch((e) => setErro(e.message))

    // Voltar pro app precisa BUSCAR o que perdeu.
    //
    // O WebSocket entrega o que acontece enquanto ele está de pé — e o celular
    // derruba a conexão assim que o app vai pro segundo plano. Tudo o que o
    // outro mandar nesse intervalo não passa por evento nenhum: chega no banco
    // e fica lá. Como a tela do chat continua MONTADA (o React não a remonta ao
    // voltar), `carregar()` também não rodava de novo — e a conversa ficava
    // parada no que existia antes de o app ser minimizado. Era esse o "saio e
    // entro e não carrega as mensagens novas".
    //
    // `resumed` é emitido pelo store quando o app volta a ficar visível E
    // quando o WebSocket reconecta depois de ter caído (queda de sinal não
    // esconde o app, então só a visibilidade não bastaria).
    const offVolta = subscribe('resumed', () => {
      sincronizar().catch(() => {
        /* sem rede: o próximo `resumed` tenta de novo */
      })
    })

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
      offVolta()
      offNova()
      offLida()
      offEditada()
      offApagada()
      offDigitando()
    }
  }, [carregar, sincronizar, rolarPraBaixo, user.id])

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
    // Nada aqui volta a falhar em silencio. Antes, `parar()` devolvendo nada e
    // a gravacao curta demais saiam pelo mesmo `return` mudo — e do lado de ca
    // "gravei e nao apareceu" era indistinguivel de "o app nem tentou".
    if (!resultado?.ok) {
      setErro(resultado?.reason || 'Não consegui terminar a gravação.')
      return
    }
    if (resultado.duration < 700) {
      setErro('Áudio curto demais. Segure o botão de gravar um pouco mais.')
      return
    }
    const form = new FormData()
    // A extensao acompanha o que foi gravado de verdade. (O servidor decide o
    // tipo pelos primeiros bytes, mas mandar `recado.webm` num mp4 e mentira
    // gratuita, e mentira gratuita e o que despista a proxima investigacao.)
    form.append('file', resultado.blob, `recado.${resultado.ext}`)
    form.append('duration_ms', String(resultado.duration))
    setEnviando(true)
    try {
      await api.post('/api/chat/audio', form)
    } catch (e) {
      setErro(e.message)
    }
    setEnviando(false)
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

      {/* Barra de ações da mensagem marcada, como no WhatsApp: a mensagem fica
          escolhida e o que dá pra fazer com ela aparece aqui em cima. */}
      {marcada && (
        <div className="msg-acoes">
          <button className="btn-plain" onClick={() => setMarcada(null)} aria-label="Cancelar">
            <Icon name="close" size={17} />
          </button>
          <span className="grow tiny">1 mensagem marcada</span>
          <button className="btn-sm btn-ghost" onClick={() => { setRespondendo(marcada); setMarcada(null) }}>
            <Icon name="reply" size={14} /> Responder
          </button>
          {marcada.content && (
            <button className="btn-sm btn-ghost" onClick={() => { navigator.clipboard?.writeText(marcada.content); setMarcada(null) }}>
              Copiar
            </button>
          )}
          {marcada.sender_id !== user.id && ['❤️', '😂', '🥺'].map((e) => (
            <button key={e} className="btn-sm btn-ghost" onClick={() => {
              api.post(`/api/chat/${marcada.id}/react`, { reaction: e }).catch(() => {})
              setMarcada(null)
            }}>{e}</button>
          ))}
          {marcada.sender_id === user.id && (
            <button className="btn-sm btn-danger" onClick={() => {
              api.del(`/api/chat/${marcada.id}`).catch((err) => setErro(err.message))
              setMarcada(null)
            }}>Apagar</button>
          )}
        </div>
      )}

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
              autorCitado={(() => {
                const alvo = item.reply_to ? msgs.find((m) => m.id === item.reply_to) : null
                if (!alvo) return ''
                return alvo.sender_id === user.id ? 'Você' : partner?.name || ''
              })()}
              marcada={marcada?.id === item.id}
              onMarcar={setMarcada}
              onResponder={setRespondendo}
            />
          )
        )}
        <div ref={fimRef} />
      </div>

      {respondendo && (
        <div className="chat-reply">
          <div className="grow tiny">
            <b>respondendo</b> {respondendo.content
              || (respondendo.type === 'sticker' ? 'figurinha'
                : respondendo.type === 'image' ? 'foto'
                  : respondendo.type === 'audio' ? 'áudio' : '')}
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
