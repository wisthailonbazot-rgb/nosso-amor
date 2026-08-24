import { useCallback, useEffect, useRef, useState } from 'react'

import { api, mediaUrl } from '../api'
import { subscribe, useStore } from '../store'
import Icon from '../components/Icon'
import { prettyDay, stamp, today } from '../lib/dates'

const REACOES = ['❤️', '😍', '🥺', '😂', '🔥']

function Novo({ aoCriar, aoCancelar }) {
  const [texto, setTexto] = useState('')
  const [quando, setQuando] = useState(today())
  const [arquivo, setArquivo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function escolher(file) {
    if (!file) return
    setArquivo(file)
    // prévia local: a pessoa vê a foto antes de subir, sem esperar o servidor
    setPrevia(URL.createObjectURL(file))
  }

  async function enviar() {
    if (!texto.trim() && !arquivo) {
      setErro('Escreva alguma coisa ou escolha uma foto.')
      return
    }
    setEnviando(true)
    setErro('')
    const form = new FormData()
    if (arquivo) form.append('file', arquivo)
    form.append('caption', texto)
    form.append('happened_on', quando)
    try {
      await api.post('/api/couple/moments', form)
      aoCriar()
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="card tilt-2">
      <div className="row between" style={{ marginBottom: 10 }}>
        <p className="card-title" style={{ margin: 0 }}>
          Novo momento
        </p>
        <button className="btn-plain" onClick={aoCancelar} aria-label="Fechar">
          <Icon name="close" size={18} />
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {previa && <img src={previa} alt="" className="moment-preview" />}

      <label className="field">
        <span>O que aconteceu</span>
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="conta aí"
        />
      </label>

      <label className="field">
        <span>Quando foi</span>
        <input type="date" value={quando} max={today()} onChange={(e) => setQuando(e.target.value)} />
      </label>

      <div className="row" style={{ gap: 8 }}>
        <label className="btn btn-ghost grow" style={{ cursor: 'pointer' }}>
          <Icon name="camera" size={18} />
          {arquivo ? 'trocar foto' : 'escolher foto'}
          <input type="file" accept="image/*" hidden onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
        <button className="btn-primary" onClick={enviar} disabled={enviando}>
          Postar
        </button>
      </div>
    </div>
  )
}

export default function Moments() {
  const { user } = useStore()
  const [itens, setItens] = useState([])
  const [temMais, setTemMais] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)

  const carregar = useCallback(async () => {
    const data = await api.get('/api/couple/moments')
    setItens(data.items)
    setTemMais(data.has_more)
  }, [])

  useEffect(() => {
    carregar().catch((e) => setErro(e.message))
    return subscribe('moments', () => carregar().catch(() => {}))
  }, [carregar])

  async function reagir(momento, emoji) {
    const atual = momento.reactions?.[String(user.id)]
    await api
      .post(`/api/couple/moments/${momento.id}/react`, {
        reaction: atual === emoji ? '' : emoji,
      })
      .catch((e) => setErro(e.message))
    setAberto(null)
    carregar()
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          Momentos
        </h1>
        <button className="btn-accent btn-sm" onClick={() => setCriando((v) => !v)}>
          <Icon name={criando ? 'close' : 'plus'} size={15} />
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {criando && (
        <Novo
          aoCancelar={() => setCriando(false)}
          aoCriar={() => {
            setCriando(false)
            carregar()
          }}
        />
      )}

      {itens.length === 0 && !criando && (
        <div className="card center muted">
          O mural está vazio. O primeiro momento pode ser hoje mesmo.
        </div>
      )}

      <div className="stack">
        {itens.map((m, i) => {
          const minhaReacao = m.reactions?.[String(user.id)]
          const outras = Object.entries(m.reactions || {}).filter(([id]) => id !== String(user.id))
          return (
            <div key={m.id} className={`card ${i % 2 ? 'tilt' : 'tilt-2'}`} style={{ marginBottom: 0 }}>
              {m.thumb && (
                <a href={mediaUrl(m.media)} target="_blank" rel="noreferrer">
                  <img src={mediaUrl(m.thumb)} alt="" className="moment-img" />
                </a>
              )}

              {m.caption && <p style={{ margin: m.thumb ? '10px 0 6px' : '0 0 6px' }}>{m.caption}</p>}

              <div className="row between">
                <span className="muted tiny">
                  {m.author_name} · {m.happened_on ? prettyDay(m.happened_on, { short: true }) : stamp(m.created_at)}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  {outras.map(([id, emoji]) => (
                    <span key={id} className="pill flat tiny">
                      {emoji}
                    </span>
                  ))}
                  <button
                    className={minhaReacao ? 'pill rose' : 'pill flat'}
                    onClick={() => setAberto(aberto === m.id ? null : m.id)}
                  >
                    {minhaReacao || <Icon name="heart" size={13} />}
                  </button>
                  {m.author_id === user.id && (
                    <button
                      className="btn-plain muted"
                      onClick={() =>
                        api.del(`/api/couple/moments/${m.id}`).then(carregar).catch((e) => setErro(e.message))
                      }
                      aria-label="Apagar"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  )}
                </div>
              </div>

              {aberto === m.id && (
                <div className="row wrap" style={{ gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  {REACOES.map((e) => (
                    <button key={e} className="emoji-btn" onClick={() => reagir(m, e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {temMais && (
        <button
          className="btn-ghost btn-block"
          style={{ marginTop: 12 }}
          onClick={async () => {
            const data = await api.get(`/api/couple/moments?before=${itens[itens.length - 1].id}`)
            setItens((atual) => [...atual, ...data.items])
            setTemMais(data.has_more)
          }}
        >
          ver mais antigos
        </button>
      )}
    </>
  )
}
