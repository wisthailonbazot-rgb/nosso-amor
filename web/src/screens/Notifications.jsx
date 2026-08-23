import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api'
import { useStore } from '../store'
import { stamp } from '../lib/dates'

const ICON = {
  teste: '🔔',
  chat: '💬',
  love_tap: '💗',
  tarefa: '✅',
  ciclo: '🌸',
  data: '📅',
  pet: '🐾',
  jogo: '🎮',
  streak: '🔥',
  geral: '✨',
}

export default function Notifications() {
  const [data, setData] = useState(null)
  const refreshUnread = useStore((s) => s.refreshUnread)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    api
      .get('/api/notifications')
      .then((result) => {
        if (!alive) return
        setData(result)
        // abrir a tela ja e ter lido
        return api.post('/api/notifications/read').then(refreshUnread)
      })
      .catch(() => alive && setData({ items: [] }))
    return () => {
      alive = false
    }
  }, [refreshUnread])

  if (!data) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <h1 className="screen-title">Avisos</h1>
      {data.items.length === 0 && (
        <div className="card center muted">Nenhum aviso por aqui ainda.</div>
      )}
      <div className="stack">
        {data.items.map((item) => (
          <button
            key={item.id}
            className="card tight"
            style={{ textAlign: 'left', marginBottom: 0, display: 'block', width: '100%' }}
            onClick={() => item.url && navigate(item.url)}
          >
            <div className="row">
              <span style={{ fontSize: 20 }}>{ICON[item.kind] || ICON.geral}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                {item.body && <div className="muted small">{item.body}</div>}
                <div className="muted tiny">{stamp(item.created_at)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
