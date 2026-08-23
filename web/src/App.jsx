import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useStore } from './store'
import Icon from './components/Icon'
import Login from './screens/Login'
import Home from './screens/Home'
import Cycle from './screens/Cycle'
import Chat from './screens/Chat'
import Games from './screens/Games'
import PetScreen from './screens/Pet'
import More from './screens/More'
import House from './screens/House'
import Shop from './screens/Shop'
import Tasks from './screens/Tasks'
import Moments from './screens/Moments'
import Dates from './screens/Dates'
import Profile from './screens/Profile'
import AvatarEditor from './screens/AvatarEditor'
import Notifications from './screens/Notifications'
import ShapeLab from './screens/ShapeLab'

const TABS = [
  { to: '/', icon: 'home', label: 'Início', end: true },
  { to: '/ciclo', icon: 'flower', label: 'Ciclo' },
  { to: '/chat', icon: 'chat', label: 'Chat' },
  { to: '/jogos', icon: 'game', label: 'Jogos' },
  { to: '/pet', icon: 'paw', label: 'Bichinho' },
  { to: '/mais', icon: 'dots', label: 'Mais' },
]

function TabBar() {
  const unread = useStore((s) => s.unread)
  const user = useStore((s) => s.user)
  const privacy = useStore((s) => s.cyclePrivacy)

  // O modulo de ciclo some pra quem nao registra quando ela escolheu nao dividir.
  const hideCycle = !user?.tracks_cycle && privacy?.share === 'nada'
  const tabs = TABS.filter((t) => t.to !== '/ciclo' || !hideCycle)

  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}>
          <Icon name={tab.icon} size={23} />
          <span>{tab.label}</span>
          {tab.to === '/mais' && unread > 0 && (
            <span className="tab-dot">{unread > 9 ? '9+' : unread}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.querySelector('.app-main')?.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { ready, user, boot } = useStore()

  useEffect(() => {
    boot()
  }, [boot])

  if (!ready) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="app-shell">
      <ScrollTop />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ciclo/*" element={<Cycle />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/jogos/*" element={<Games />} />
          <Route path="/pet" element={<PetScreen />} />
          <Route path="/mais" element={<More />} />
          <Route path="/casa" element={<House />} />
          <Route path="/loja" element={<Shop />} />
          <Route path="/tarefas" element={<Tasks />} />
          <Route path="/momentos" element={<Moments />} />
          <Route path="/datas" element={<Dates />} />
          <Route path="/avisos" element={<Notifications />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/avatar" element={<AvatarEditor />} />
          <Route path="/lab" element={<ShapeLab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
