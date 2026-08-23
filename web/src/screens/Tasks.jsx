import { useEffect, useState } from 'react'

import { api } from '../api'
import { useStore, subscribe } from '../store'
import Icon from '../components/Icon'

const FREQ_LABEL = { once: 'uma vez', daily: 'todo dia', weekly: 'toda semana' }

function NewTask({ partner, me, onDone, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    frequency: 'once',
    reward_coins: 10,
    assigned_to: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/tasks', {
        title: form.title.trim(),
        frequency: form.frequency,
        reward_coins: Number(form.reward_coins),
        assigned_to: form.assigned_to === '' ? null : Number(form.assigned_to),
      })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="card tilt-2" onSubmit={submit}>
      <p className="card-title">Nova tarefa</p>
      {error && <div className="alert alert-error">{error}</div>}

      <label className="field">
        <span>O que é?</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ex.: mandar bom dia"
          maxLength={120}
        />
      </label>

      <label className="field">
        <span>Repete?</span>
        <select
          value={form.frequency}
          onChange={(e) => setForm({ ...form, frequency: e.target.value })}
        >
          <option value="once">Uma vez só</option>
          <option value="daily">Todo dia</option>
          <option value="weekly">Toda semana</option>
        </select>
      </label>

      <label className="field">
        <span>Pra quem?</span>
        <select
          value={form.assigned_to}
          onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
        >
          <option value="">Qualquer um de nós</option>
          <option value={me.id}>{me.name}</option>
          {partner && <option value={partner.id}>{partner.name}</option>}
        </select>
      </label>

      <label className="field">
        <span>Vale quantos corações? (até 200)</span>
        <input
          type="number"
          min={0}
          max={200}
          value={form.reward_coins}
          onChange={(e) => setForm({ ...form, reward_coins: e.target.value })}
        />
      </label>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn-primary grow" disabled={busy || !form.title.trim()}>
          Criar
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function Tasks() {
  const { user, partner, setBalance } = useStore()
  const [data, setData] = useState(null)
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setData(await api.get('/api/tasks'))
  }

  useEffect(() => {
    load().catch((err) => setStatus({ kind: 'error', text: err.message }))
    // o outro concluiu alguma coisa: a lista se atualiza sozinha
    return subscribe('tasks', () => load().catch(() => {}))
  }, [])

  async function toggle(task) {
    setBusyId(task.id)
    setStatus(null)
    try {
      const path = task.done ? 'undo' : 'complete'
      const result = await api.post(`/api/tasks/${task.id}/${path}`)
      setBalance(result.balance)
      if (!task.done && result.earned > 0) {
        setStatus({ kind: 'ok', text: `+${result.earned} corações!` })
      }
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
    setBusyId(null)
  }

  async function claimMission(mission) {
    setBusyId(`mission-${mission.id}`)
    setStatus(null)
    try {
      const result = await api.post(`/api/tasks/daily/${mission.id}/claim`)
      setBalance(result.balance)
      setStatus({ kind: 'ok', text: `Missão cumprida: +${result.earned_each} Corações para cada um!` })
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
    setBusyId(null)
  }

  async function remove(task) {
    setBusyId(task.id)
    try {
      await api.del(`/api/tasks/${task.id}`)
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
    setBusyId(null)
  }

  if (!data) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          Tarefas
        </h1>
        <button className="btn-accent btn-sm" onClick={() => setCreating((v) => !v)}>
          <Icon name={creating ? 'close' : 'plus'} size={15} />
        </button>
      </div>

      {status && (
        <div className={`alert alert-${status.kind === 'ok' ? 'ok' : 'error'}`}>{status.text}</div>
      )}

      {creating && (
        <NewTask
          me={user}
          partner={partner}
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            load()
          }}
        />
      )}

      <div className="card tilt">
        <div className="row between">
          <div>
            <p className="card-title" style={{ marginBottom: 2 }}>Missões de hoje</p>
            <div className="muted tiny">progresso dos dois · muda todo dia</div>
          </div>
          <span className="pill rose">nível {data.progression?.level || 1}</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>
          {data.progression?.in_level || 0}/5 missões para o próximo nível
        </div>
      </div>

      <div className="stack">
        {(data.daily_missions || []).map((mission) => {
          const percent = Math.round((mission.progress / mission.goal) * 100)
          return (
            <div key={mission.id} className={`card tight ${mission.claimed ? 'sage' : ''}`} style={{ marginBottom: 0 }}>
              <div className="row between">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{mission.title}</div>
                  <div className="muted tiny">{mission.description}</div>
                  <div style={{ height: 7, border: '1px solid var(--ink)', borderRadius: 8, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', background: 'var(--sage-deep)' }} />
                  </div>
                  <div className="row between tiny" style={{ marginTop: 4 }}>
                    <span>{mission.progress}/{mission.goal}</span>
                    <span className="coins"><Icon name="heart" size={11} filled /> {mission.reward_coins} para cada</span>
                  </div>
                </div>
                {mission.complete && !mission.claimed && (
                  <button className="btn-accent btn-sm" onClick={() => claimMission(mission)}
                    disabled={busyId === `mission-${mission.id}`}>Receber</button>
                )}
                {mission.claimed && <span className="check-mark yes">✓</span>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="group-title" style={{ marginTop: 18 }}>Tarefas criadas por vocês</p>

      {data.pending_for_me > 0 && (
        <div className="card rose tight center">
          <span className="small">
            <strong>{data.pending_for_me}</strong> pra você — valem{' '}
            <span className="coins">
              <Icon name="heart" size={13} filled /> {data.coins_available}
            </span>
          </span>
        </div>
      )}

      {data.items.length === 0 && (
        <div className="card center muted">
          Nenhuma tarefa pessoal. As missões do jogo continuam sendo geradas acima.
        </div>
      )}

      <div className="stack">
        {data.items.map((task) => (
          <div key={task.id} className={`card tight ${task.done ? 'sage' : ''}`} style={{ marginBottom: 0 }}>
            <div className="row top">
              <button
                className="btn-plain"
                onClick={() => toggle(task)}
                disabled={busyId === task.id}
                aria-label={task.done ? 'Desfazer' : 'Concluir'}
                style={{ marginTop: 2 }}
              >
                <span className={`check-mark ${task.done ? 'yes' : ''}`} style={{ width: 26, height: 26 }}>
                  {task.done ? '✓' : ''}
                </span>
              </button>

              <div className="grow">
                <div
                  style={{
                    fontWeight: 700,
                    textDecoration: task.done ? 'line-through' : 'none',
                    opacity: task.done ? 0.65 : 1,
                  }}
                >
                  {task.title}
                </div>
                <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                  <span className="pill flat tiny">{FREQ_LABEL[task.frequency]}</span>
                  {task.assigned_name && <span className="pill flat tiny">{task.assigned_name}</span>}
                  <span className="pill flat tiny coins">
                    <Icon name="heart" size={11} filled /> {task.reward_coins}
                  </span>
                </div>
                {task.done && task.done_by_name && (
                  <div className="muted tiny" style={{ marginTop: 4 }}>
                    feito por {task.done_by_name}
                  </div>
                )}
              </div>

              <button
                className="btn-plain muted"
                onClick={() => remove(task)}
                disabled={busyId === task.id}
                aria-label="Apagar"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
