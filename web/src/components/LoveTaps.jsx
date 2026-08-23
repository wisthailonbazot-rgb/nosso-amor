import { useEffect, useState } from 'react'

import { api } from '../api'
import { subscribe } from '../store'
import Sticker from './Sticker'

// Cada toque vira uma figurinha na tela do outro. O mesmo desenho do chat, para
// o app ter uma linguagem só em vez de dois conjuntos de arte.
const FIGURINHA = {
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
function Chuva({ code, aoTerminar }) {
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
          <Sticker code={FIGURINHA[code] || 'coracao'} scale={2} />
        </span>
      ))}
    </div>
  )
}

export default function LoveTaps({ partnerName }) {
  const [tipos, setTipos] = useState([])
  const [chuva, setChuva] = useState(null)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState('')

  useEffect(() => {
    api
      .get('/api/couple/taps')
      .then((d) => setTipos(d.kinds))
      .catch(() => {})

    // toque do outro chegando com o app aberto: cai na hora, sem notificação
    const off = subscribe('love_tap', ({ type, label }) => {
      setChuva(type)
      setAviso(`${partnerName || 'Ele'} ${label ? label.toLowerCase() : ''}`)
      api.post('/api/couple/taps/seen').catch(() => {})
    })
    return off
  }, [partnerName])

  async function mandar(code) {
    setEnviando(code)
    setAviso('')
    try {
      await api.post('/api/couple/taps', { type: code })
      setChuva(code)
    } catch (e) {
      setAviso(e.message)
    }
    setEnviando('')
  }

  return (
    <div className="card">
      <p className="card-title">Mandar um toque</p>
      {aviso && <div className="alert alert-info" style={{ marginBottom: 10 }}>{aviso}</div>}
      <div className="tap-grid">
        {tipos.map((t) => (
          <button
            key={t.code}
            className="tap-btn"
            onClick={() => mandar(t.code)}
            disabled={enviando === t.code}
          >
            <Sticker code={FIGURINHA[t.code] || 'coracao'} scale={1.6} />
            <span className="tiny">{t.label}</span>
          </button>
        ))}
      </div>

      {chuva && <Chuva code={chuva} aoTerminar={() => setChuva(null)} />}
    </div>
  )
}
