import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import { useStore } from '../store'
import { diagnose, disablePush, enablePush, isApple, isStandalone, permission } from '../push'
import { stamp } from '../lib/dates'

export default function Profile() {
  const { user, partner, balance, couple, vapidKey, pushEnabled, logout, refreshMe } = useStore()
  const [status, setStatus] = useState(null)
  const [report, setReport] = useState(() => diagnose())
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', start_date: couple?.start_date || '' })

  useEffect(() => {
    if (!editing) setProfileForm({ name: user?.name || '', start_date: couple?.start_date || '' })
  }, [user?.name, couple?.start_date, editing])

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.put('/api/couple/profile', { name: profileForm.name })
      await api.put('/api/couple/settings', { start_date: profileForm.start_date })
      await refreshMe()
      setEditing(false)
      setMessage({ kind: 'ok', text: 'Perfil do casal atualizado.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    }
    setBusy(false)
  }

  async function loadStatus() {
    try {
      setStatus(await api.get('/api/push/status'))
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    const result = await enablePush(vapidKey)
    setReport(diagnose())
    setMessage(
      result.ok
        ? { kind: 'ok', text: 'Notificações ligadas neste aparelho.' }
        : { kind: 'error', text: result.reason }
    )
    await loadStatus()
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    await disablePush()
    setReport(diagnose())
    setMessage({ kind: 'ok', text: 'Notificações desligadas neste aparelho.' })
    await loadStatus()
    setBusy(false)
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await api.post('/api/push/test')
      setMessage(
        result.sent > 0
          ? { kind: 'ok', text: `Enviado para ${result.sent} aparelho(s). Deve chegar agora.` }
          : {
              kind: 'error',
              text:
                result.skipped ||
                'O servidor não encontrou nenhum aparelho ligado para você. Ligue as notificações primeiro.',
            }
      )
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    }
    setBusy(false)
  }

  const granted = permission() === 'granted'
  const needsHomeScreen = isApple() && !isStandalone()

  return (
    <>
      <h1 className="screen-title">Perfil</h1>

      <div className="card">
        <div className="row between">
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
            <div className="muted small">com {partner?.name || '—'}</div>
          </div>
          <span className="coins">💗 {balance}</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <Link to="/perfil/avatar" className="btn btn-ghost btn-block">
            Montar meu personagem
          </Link>
          <button className="btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setEditing(!editing)}>
            {editing ? 'Cancelar edição' : 'Editar nome e nossa data'}
          </button>
        </div>
      </div>

      {editing && (
        <form className="card tilt-2" onSubmit={saveProfile}>
          <p className="card-title">Nossa história começa aqui</p>
          <label className="field">
            <span>Como você quer aparecer?</span>
            <input value={profileForm.name} minLength={2} maxLength={40}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Quando vocês começaram?</span>
            <input type="date" value={profileForm.start_date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setProfileForm({ ...profileForm, start_date: e.target.value })} />
          </label>
          <button className="btn-primary btn-block" disabled={busy || profileForm.name.trim().length < 2}>
            Salvar nossa história
          </button>
        </form>
      )}

      {/* ---------------------------------------------------- notificações */}
      <div className="card">
        <p className="card-title">Notificações neste aparelho</p>

        {message && (
          <div className={`alert alert-${message.kind === 'ok' ? 'ok' : 'error'}`}>
            {message.text}
          </div>
        )}

        {!pushEnabled && (
          <div className="alert alert-info">
            O servidor está sem chave de notificação configurada. Nenhum aviso será
            entregue até isso ser definido no deploy.
          </div>
        )}

        {needsHomeScreen && (
          <div className="alert alert-info">
            <strong>iPhone:</strong> toque no botão de compartilhar do Safari →{' '}
            <em>Adicionar à Tela de Início</em>, e abra o app pelo ícone. Aberto direto
            no Safari, o iPhone não entrega notificação — não é problema do app, é
            regra da Apple.
          </div>
        )}

        <ul className="check-list">
          {report.items.map((item) => (
            <li key={item.label}>
              <span className={`check-mark ${item.ok ? 'yes' : 'no'}`}>
                {item.ok ? '✓' : '!'}
              </span>
              <span>
                {item.label}
                {item.hint && <div className="muted tiny">{item.hint}</div>}
              </span>
            </li>
          ))}
        </ul>

        <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
          {!granted ? (
            <button className="btn-primary grow" onClick={turnOn} disabled={busy}>
              🔔 Ligar notificações
            </button>
          ) : (
            <>
              <button className="btn-ghost grow" onClick={sendTest} disabled={busy}>
                Enviar teste
              </button>
              <button className="btn-ghost" onClick={turnOn} disabled={busy}>
                Reconectar
              </button>
              <button className="btn-danger" onClick={turnOff} disabled={busy}>
                Desligar
              </button>
            </>
          )}
        </div>

        {status?.devices?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p className="card-title" style={{ marginBottom: 6 }}>
              Aparelhos registrados
            </p>
            {status.devices.map((d) => (
              <div key={d.id} className="row between small" style={{ padding: '5px 0' }}>
                <span>{d.label}</span>
                <span className="muted tiny">
                  {d.last_ok_at ? stamp(d.last_ok_at) : 'sem envio ainda'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <p className="card-title">Nós dois</p>
        <div className="row between small">
          <span className="muted">Começamos em</span>
          <span>{couple?.start_date || '—'}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link to="/datas" className="btn btn-ghost btn-block">
            📅 Datas importantes
          </Link>
        </div>
      </div>

      <button className="btn-danger btn-block" onClick={logout}>
        Sair
      </button>
    </>
  )
}
