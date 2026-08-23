import { Link } from 'react-router-dom'

import { useStore } from '../store'
import Icon from '../components/Icon'

const LINKS = [
  { to: '/casa', icon: 'sofa', label: 'Nossa casa', hint: 'Decorar o cômodo juntos' },
  { to: '/loja', icon: 'bag', label: 'Loja', hint: 'Roupas, móveis e coisas do bichinho' },
  { to: '/tarefas', icon: 'check', label: 'Tarefas', hint: 'Missões que valem corações' },
  { to: '/momentos', icon: 'camera', label: 'Momentos', hint: 'Nosso mural' },
  { to: '/datas', icon: 'calendar', label: 'Datas importantes', hint: 'Com lembrete' },
  { to: '/avisos', icon: 'bell', label: 'Avisos', hint: 'O que já foi notificado' },
  { to: '/perfil', icon: 'gear', label: 'Perfil e notificações', hint: '' },
]

export default function More() {
  const unread = useStore((s) => s.unread)
  return (
    <>
      <h1 className="screen-title">Mais</h1>
      <div className="stack">
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="card tight" style={{ textDecoration: 'none', color: 'inherit', marginBottom: 0 }}>
            <div className="row">
              <Icon name={link.icon} size={22} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{link.label}</div>
                {link.hint && <div className="muted tiny">{link.hint}</div>}
              </div>
              {link.to === '/avisos' && unread > 0 && (
                <span className="pill" style={{ background: 'var(--pink)', color: '#fff' }}>
                  {unread}
                </span>
              )}
              <span className="muted">›</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
