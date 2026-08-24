import { useEffect, useState } from 'react'

import { api } from '../api'
import Sticker from './Sticker'
import { Chuva, FIGURINHA_DO_TOQUE as FIGURINHA } from './AvisosAoVivo'

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

    // O toque QUE CHEGA nao e ouvido aqui: quem cuida disso e o `AvisosAoVivo`,
    // montado no casco do app. Se os dois ouvissem, o mesmo cutucao cairia duas
    // vezes na tela de Inicio — e continuaria nao caindo nas outras.
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
