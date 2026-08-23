import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import { subscribe, useStore } from '../store'
import Icon from '../components/Icon'
import { daysTogether, prettyDay, today } from '../lib/dates'

const EMOJIS = ['💕', '🎂', '✈️', '🏠', '💍', '🎓', '🐾', '🎉', '🌙', '⭐']

function contagem(dias) {
  if (dias === 0) return 'é hoje!'
  if (dias === 1) return 'amanhã'
  if (dias < 30) return `em ${dias} dias`
  if (dias < 60) return 'em cerca de 1 mês'
  return `em ${Math.round(dias / 30)} meses`
}

export default function Dates() {
  const { couple, refreshMe } = useStore()
  const [itens, setItens] = useState([])
  const [criando, setCriando] = useState(false)
  const [editandoInicio, setEditandoInicio] = useState(false)
  const [inicio, setInicio] = useState('')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    title: '',
    day: today(),
    repeat_yearly: true,
    reminder_days_before: 3,
    emoji: '💕',
  })

  const carregar = useCallback(async () => {
    const data = await api.get('/api/couple/dates')
    setItens(data.items)
    setInicio(data.couple?.start_date || '')
  }, [])

  useEffect(() => {
    carregar().catch((e) => setErro(e.message))
    return subscribe('dates', () => carregar().catch(() => {}))
  }, [carregar])

  async function criar(event) {
    event.preventDefault()
    setErro('')
    try {
      await api.post('/api/couple/dates', { ...form, title: form.title.trim() })
      setCriando(false)
      setForm({ ...form, title: '' })
      carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  async function salvarInicio() {
    setErro('')
    try {
      await api.put('/api/couple/settings', { start_date: inicio })
      setEditandoInicio(false)
      refreshMe()
      carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  const dias = daysTogether(couple?.start_date)

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          Datas
        </h1>
        <button className="btn-accent btn-sm" onClick={() => setCriando((v) => !v)}>
          <Icon name={criando ? 'close' : 'plus'} size={15} />
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {/* ------------------------------------------------ desde quando */}
      <div className="card rose center tilt" style={{ paddingTop: 20 }}>
        <div className="tape" />
        {dias !== null ? (
          <>
            <div className="muted small">juntos há</div>
            <div className="big-number">{dias}</div>
            <div className="muted small">dias, desde {prettyDay(couple.start_date)}</div>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            Ainda não sabemos desde quando vocês estão juntos.
          </p>
        )}

        {editandoInicio ? (
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <input type="date" value={inicio} max={today()} onChange={(e) => setInicio(e.target.value)} />
            <button className="btn-primary btn-sm" onClick={salvarInicio}>
              ok
            </button>
          </div>
        ) : (
          <button
            className="btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setEditandoInicio(true)}
          >
            {dias === null ? 'definir a data' : 'mudar a data'}
          </button>
        )}
      </div>

      {/* ------------------------------------------------ nova data */}
      {criando && (
        <form className="card tilt-2" onSubmit={criar}>
          <p className="card-title">Nova data</p>

          <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                className={form.emoji === e ? 'emoji-btn selecionado' : 'emoji-btn'}
                onClick={() => setForm({ ...form, emoji: e })}
              >
                {e}
              </button>
            ))}
          </div>

          <label className="field">
            <span>O que é</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: nosso primeiro beijo"
              maxLength={120}
            />
          </label>

          <label className="field">
            <span>Quando</span>
            <input
              type="date"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            />
          </label>

          <label className="row between" style={{ marginBottom: 12, cursor: 'pointer' }}>
            <span className="small">Repete todo ano</span>
            <input
              type="checkbox"
              checked={form.repeat_yearly}
              onChange={(e) => setForm({ ...form, repeat_yearly: e.target.checked })}
              style={{ width: 22, height: 22 }}
            />
          </label>

          <label className="field">
            <span>Avisar quantos dias antes</span>
            <input
              type="number"
              min={0}
              max={60}
              value={form.reminder_days_before}
              onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })}
            />
          </label>

          <button className="btn-primary btn-block" disabled={!form.title.trim()}>
            Guardar
          </button>
        </form>
      )}

      {/* ------------------------------------------------ lista */}
      {itens.length === 0 && !criando && (
        <div className="card center muted">Nenhuma data guardada ainda.</div>
      )}

      <div className="stack">
        {itens.map((d) => (
          <div key={d.id} className="card tight" style={{ marginBottom: 0 }}>
            <div className="row">
              <span style={{ fontSize: 26 }}>{d.emoji || '📌'}</span>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{d.title}</div>
                <div className="muted tiny">
                  {prettyDay(d.day)}
                  {d.repeat_yearly && d.years ? ` · faz ${d.years} ano${d.years > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {d.days_until === null ? (
                  <span className="muted tiny">já passou</span>
                ) : (
                  <span className={d.days_until <= 7 ? 'pill rose' : 'pill flat'}>
                    {contagem(d.days_until)}
                  </span>
                )}
              </div>
              <button
                className="btn-plain muted"
                onClick={() =>
                  api.del(`/api/couple/dates/${d.id}`).then(carregar).catch((e) => setErro(e.message))
                }
                aria-label="Apagar"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
