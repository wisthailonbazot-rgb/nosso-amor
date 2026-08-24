import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api'
import { subscribe, useStore } from '../store'
import Sticker from './Sticker'

/**
 * O avisador do app inteiro.
 *
 * Fica montado no casco (`App.jsx`), fora das rotas, e por isso continua vivo
 * quando você troca de tela. Era esse o problema: o cutucão só caía na tela de
 * Início, porque o componente que ouvia o evento morava lá dentro — trocou de
 * aba, parou de chegar. E a mensagem do parceiro só aparecia se você já
 * estivesse com o chat aberto.
 *
 * Ele cuida de duas coisas, e as duas valem em QUALQUER tela:
 *
 *   1. o cutucão, que vira chuva de figurinha por cima de tudo;
 *   2. a mensagem do parceiro, que vira uma faixa no topo — clicável, leva pro
 *      chat — e some sozinha.
 *
 * O que ele NÃO faz é notificação com o app fechado: isso é o Web Push, que
 * mora em `push.js` e depende do aparelho. Aqui é só com o app na mão.
 */

// Cada toque tem a sua figurinha. O mesmo desenho do chat, pro app ter uma
// linguagem visual só em vez de dois conjuntos de arte.
export const FIGURINHA_DO_TOQUE = {
  heart: 'coracao',
  kiss: 'beijo',
  hug: 'abraco',
  miss: 'saudade',
  poke: 'piscada',
  thinking: 'carinha_apaixonada',
  come_here: 'vem_ca',
  cuddle: 'grudinho',
  cafune: 'cafune',
  sorry: 'foi_mal',
  safe: 'amor_seguro',
}

/** A chuva de figurinhas que cai quando o toque chega. */
export function Chuva({ code, aoTerminar }) {
  useEffect(() => {
    const timer = setTimeout(aoTerminar, 2600)
    return () => clearTimeout(timer)
  }, [aoTerminar])

  return (
    <div className="tap-rain" onClick={aoTerminar}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className="tap-drop"
          style={{
            left: `${6 + i * 10.5}%`,
            animationDelay: `${(i % 4) * 0.18}s`,
            animationDuration: `${1.9 + (i % 3) * 0.4}s`,
          }}
        >
          <Sticker code={FIGURINHA_DO_TOQUE[code] || 'coracao'} scale={2} />
        </span>
      ))}
    </div>
  )
}

/** Resumo curto da mensagem, pra caber numa linha da faixa. */
function resumir(msg) {
  if (msg.type === 'photo') return 'mandou uma foto'
  if (msg.type === 'audio') return 'mandou um áudio'
  if (msg.type === 'sticker') return 'mandou uma figurinha'
  const texto = (msg.content || '').trim()
  if (!texto) return 'mandou uma mensagem'
  return texto.length > 64 ? `${texto.slice(0, 63)}…` : texto
}

export default function AvisosAoVivo() {
  const user = useStore((s) => s.user)
  const partner = useStore((s) => s.partner)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [chuva, setChuva] = useState(null)
  const [faixa, setFaixa] = useState(null)
  const sumir = useRef(null)

  // O caminho atual entra numa gaveta em vez de virar dependência do efeito:
  // se ele fosse dependência, cada troca de tela desligaria e religaria o
  // ouvinte do WebSocket — e uma mensagem que chegasse exatamente nesse
  // intervalo seria perdida, o que é justamente o bug que isto veio consertar.
  const ondeEstou = useRef(pathname)
  ondeEstou.current = pathname

  const fechar = useCallback(() => {
    clearTimeout(sumir.current)
    setFaixa(null)
  }, [])

  useEffect(() => {
    const offToque = subscribe('love_tap', ({ type, label }) => {
      setChuva(type)
      setFaixa({
        tipo: 'toque',
        texto: `${partner?.name || 'Seu amor'} ${label ? label.toLowerCase() : 'mandou um toque'}`,
        code: type,
      })
      clearTimeout(sumir.current)
      sumir.current = setTimeout(() => setFaixa(null), 4200)
      api.post('/api/couple/taps/seen').catch(() => {})
    })

    const offChat = subscribe('chat', ({ message }) => {
      if (!message || message.sender_id === user?.id) return
      // Com o chat aberto a mensagem já aparece na conversa; a faixa por cima
      // seria barulho repetido.
      if (ondeEstou.current.startsWith('/chat')) return
      setFaixa({ tipo: 'chat', texto: resumir(message), de: partner?.name || 'Seu amor' })
      clearTimeout(sumir.current)
      sumir.current = setTimeout(() => setFaixa(null), 5200)
    })

    return () => {
      offToque()
      offChat()
      clearTimeout(sumir.current)
    }
  }, [user?.id, partner?.name])

  return (
    <>
      {faixa && (
        <div
          className={`aviso-faixa ${faixa.tipo}`}
          role="status"
          onClick={() => {
            fechar()
            if (faixa.tipo === 'chat') navigate('/chat')
          }}
        >
          <Sticker
            code={faixa.tipo === 'toque' ? FIGURINHA_DO_TOQUE[faixa.code] || 'coracao' : 'coracao'}
            scale={1.1}
          />
          <div className="aviso-texto">
            <strong>{faixa.tipo === 'chat' ? faixa.de : 'Chegou um toque'}</strong>
            <span>{faixa.texto}</span>
          </div>
          <button
            className="aviso-fechar"
            onClick={(e) => {
              e.stopPropagation()
              fechar()
            }}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}

      {chuva && <Chuva code={chuva} aoTerminar={() => setChuva(null)} />}
    </>
  )
}
