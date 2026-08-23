import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import { useStore, subscribe } from '../store'
import { daysTogether, prettyDay } from '../lib/dates'
import AvatarView from '../components/AvatarView'
import Icon from '../components/Icon'
import LoveTaps from '../components/LoveTaps'

const SHORTCUTS = [
  { to: '/casa', icon: 'sofa', label: 'Nossa casa' },
  { to: '/loja', icon: 'bag', label: 'Loja' },
  { to: '/tarefas', icon: 'check', label: 'Tarefas' },
  { to: '/momentos', icon: 'camera', label: 'Momentos' },
]

function CheckinCard() {
  const setBalance = useStore((s) => s.setBalance)
  const [wallet, setWallet] = useState(null)
  const [earned, setEarned] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setWallet(await api.get('/api/wallet'))
  }

  useEffect(() => {
    load().catch(() => {})
    // volta do segundo plano depois da meia-noite: a sequência precisa reler
    return subscribe('resumed', () => load().catch(() => {}))
  }, [])

  async function checkin() {
    setBusy(true)
    try {
      const result = await api.post('/api/wallet/checkin')
      setBalance(result.balance)
      if (!result.already) setEarned(result.earned)
      await load()
    } catch {
      /* sem rede: o botão continua lá pra tentar de novo */
    }
    setBusy(false)
  }

  if (!wallet) return null
  const { streak } = wallet

  return (
    <div className="card tight">
      <div className="row between">
        <div className="row">
          <span
            className={streak.current > 0 ? '' : 'muted'}
            style={{ color: streak.current > 0 ? 'var(--mustard-deep)' : undefined }}
          >
            <Icon name="fire" size={26} filled={streak.current > 0} />
          </span>
          <div>
            <div style={{ fontWeight: 700 }}>
              {streak.current > 0 ? `${streak.current} dia${streak.current > 1 ? 's' : ''} seguidos` : 'Sem sequência'}
            </div>
            <div className="muted tiny">
              {streak.checked_in_today
                ? `melhor marca: ${streak.best}`
                : `hoje vale ${wallet.next_checkin_reward} corações`}
            </div>
          </div>
        </div>

        {streak.checked_in_today ? (
          <span className="pill sage">feito hoje</span>
        ) : (
          <button className="btn-accent btn-sm" onClick={checkin} disabled={busy}>
            Marcar presença
          </button>
        )}
      </div>

      {earned !== null && (
        <div className="alert alert-ok pop" style={{ margin: '12px 0 0' }}>
          +{earned} corações! Sequência de {streak.current} dia
          {streak.current > 1 ? 's' : ''}.
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { user, partner, balance, couple, online, connection } = useStore()
  const [avatars, setAvatars] = useState(null)
  const partnerOnline = !!partner && online.includes(partner.id)
  const days = daysTogether(couple?.start_date)

  useEffect(() => {
    api
      .get('/api/avatar')
      .then((data) => setAvatars({ mine: data.config, partner: data.partner?.config }))
      .catch(() => {})
    return subscribe('avatar', () => {
      api
        .get('/api/avatar')
        .then((data) => setAvatars({ mine: data.config, partner: data.partner?.config }))
        .catch(() => {})
    })
  }, [])

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="muted small">olá,</div>
          <h1 className="screen-title" style={{ margin: 0 }}>
            {user?.name}
          </h1>
        </div>
        <Link to="/loja" className="pill rose" style={{ textDecoration: 'none' }}>
          <Icon name="heart" size={14} filled /> {balance}
        </Link>
      </div>

      {/* os dois bonecos lado a lado, com o contador entre eles */}
      <div className="card tilt" style={{ paddingTop: 22 }}>
        <div className="tape" />
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          {avatars?.mine && <AvatarView config={avatars.mine} scale={2} />}
          <div className="center grow">
            {days !== null ? (
              <>
                <div className="muted small">juntos há</div>
                <div className="big-number">{days}</div>
                <div className="muted tiny">dias</div>
              </>
            ) : (
              <Icon name="heart" size={40} filled color="var(--rose)" />
            )}
          </div>
          {avatars?.partner && <AvatarView config={avatars.partner} scale={2} />}
        </div>
        {days !== null && (
          <div className="center muted tiny" style={{ marginTop: 8 }}>
            desde {prettyDay(couple.start_date)}
          </div>
        )}
      </div>

      <CheckinCard />

      <div className="card tight">
        <div className="row between">
          <div className="row">
            <span className={`dot ${partnerOnline ? 'on' : ''}`} />
            <div>
              <div style={{ fontWeight: 700 }}>{partner?.name || 'Seu par'}</div>
              <div className="muted tiny">{partnerOnline ? 'online agora' : 'offline'}</div>
            </div>
          </div>
          <Link to="/chat" className="btn btn-sm btn-ghost">
            <Icon name="chat" size={15} /> Conversar
          </Link>
        </div>
      </div>

      <LoveTaps partnerName={partner?.name} />

      <div className="card">
        <p className="card-title">Atalhos</p>
        <div className="grid-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="btn btn-ghost"
              style={{ flexDirection: 'column', padding: '16px 8px', gap: 7 }}
            >
              <Icon name={s.icon} size={26} />
              <span className="small">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {connection !== 'online' && (
        <div className="alert alert-info">
          Sem conexão em tempo real ({connection}). As telas continuam funcionando; o chat
          atualiza ao abrir.
        </div>
      )}
    </>
  )
}
