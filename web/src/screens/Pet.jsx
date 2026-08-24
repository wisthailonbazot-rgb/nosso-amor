import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import Icon from '../components/Icon'
import ItemPreview from '../components/ItemPreview'
import PetCanvas from '../render/PetCanvas'
import { subscribe } from '../store'

const STAT = {
  hunger: ['Barriguinha', 'bag'], happiness: ['Alegria', 'heart'],
  energy: ['Energia', 'sparkle'], hygiene: ['Higiene', 'drop'],
}
const MOOD = {
  feliz: 'feliz e bem cuidado', ok: 'tranquilo', triste: 'sentindo falta de vocês',
  faminto: 'com muita fome', imundo: 'precisando de banho', doente: 'doente — precisa de cuidados',
  sonolento: 'sem energia', incomodado: 'incomodado com a sujeira', novo: 'esperando vocês',
}

function readyAt(value) { return !value || new Date(value).getTime() <= Date.now() }

function SpeciesChooser({ species, onChoose, busy }) {
  const [picked, setPicked] = useState(species[0]?.code || '')
  const [name, setName] = useState('')
  const current = species.find((s) => s.code === picked)
  return <>
    <div className="pet-intro card tilt taped"><p className="card-title">Uma decisão pra cuidar juntos</p><h1>Quem vai morar com vocês?</h1><p className="muted">Cada espécie tem seu próprio ritmo. A escolha é permanente para proteger toda a evolução.</p></div>
    <div className="species-grid">{species.map((s) => <button key={s.code} className={`species-card ${picked === s.code ? 'selected' : ''}`} onClick={() => setPicked(s.code)}><PetCanvas pet={{ ...s, species: s.code, species_name: s.name, stage: 'filhote', mood: 'feliz', accessories: {}, mess_count: 0 }} /><strong>{s.name}</strong><small>{s.tagline}</small></button>)}</div>
    {current && <div className="card pet-traits"><p className="card-title">O ritmo de {current.name}</p><div className="trait-row"><span>Fome</span><i style={{ width: `${Math.min(100, current.traits.hunger / 1.6 * 100)}%` }} /></div><div className="trait-row"><span>Carência</span><i style={{ width: `${Math.min(100, current.traits.happiness / 1.6 * 100)}%` }} /></div><div className="trait-row"><span>Sujeira</span><i style={{ width: `${Math.min(100, current.traits.mess_rate / 1.6 * 100)}%` }} /></div><p className="tiny muted">Barra maior = exige cuidado mais depressa.</p></div>}
    <label className="field"><span>Nome do bichinho</span><input value={name} maxLength={40} placeholder="Como ele vai se chamar?" onChange={(e) => setName(e.target.value)} /></label>
    <button className="btn btn-primary btn-block" disabled={busy || !picked || !name.trim()} onClick={() => onChoose(picked, name.trim())}>Adotar {current?.name}</button>
  </>
}

export default function Pet() {
  const [pet, setPet] = useState(null)
  const [species, setSpecies] = useState([])
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('comida')
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState(null)

  async function load() {
    // /pet e /items aplicam decaimento e portanto gravam `last_decay_at`.
    // No SQLite da bancada, abrir os dois em paralelo pode disputar a trava de
    // escrita; primeiro envelhece o pet, depois busca as listas em paralelo.
    const state = await api.get('/api/pet')
    const [kinds, owned] = await Promise.all([api.get('/api/pet/species'), api.get('/api/pet/items')])
    setPet(state.pet); setSpecies(kinds.species); setItems(owned.items)
    if (state.since?.mess_born) setStatus({ kind: 'warn', text: `${state.since.mess_born} sujeira nova apareceu na casa.` })
  }
  useEffect(() => { load().catch((e) => setStatus({ kind: 'error', text: e.message })); return subscribe('pet', (next) => setPet(next)) }, [])
  // O item que ele esta usando AGORA, so pro desenho. Some sozinho depois da
  // cena — e o que faz voce VER ele comendo a racao, roendo o osso ou correndo
  // atras da bolinha, em vez de so o numero da barra subir.
  const [emUso, setEmUso] = useState(null)

  async function act(path, body, label) {
    setBusy(path + (body?.code || '')); setStatus(null)
    if (body?.code) {
      setEmUso(body.code)
      clearTimeout(act.timer)
      act.timer = setTimeout(() => setEmUso(null), 2600)
    }
    try { const result = await api.post(`/api/pet/${path}`, body); setPet(result.pet); setStatus({ kind: 'ok', text: label }); setItems((await api.get('/api/pet/items')).items) }
    catch (e) {
      setStatus({ kind: 'error', text: e.message })
      setEmUso(null)  // deu errado: nao mostra cena de uso que nao aconteceu
    }
    setBusy('')
  }
  const shown = useMemo(() => items.filter((i) => i.subcategory === tab), [items, tab])
  if (!pet) return status?.kind === 'error'
    ? <div className="card center"><Icon name="paw" size={42} /><p>{status.text}</p><button className="btn btn-primary" onClick={load}>Tentar de novo</button></div>
    : <div className="full-center"><div className="spinner" /></div>
  if (!pet.chosen) return <><SpeciesChooser species={species} onChoose={(code, name) => act('choose', { species: code, name }, 'Agora vocês têm alguém esperando em casa.')} busy={busy} />{status && <p className={`notice ${status.kind}`}>{status.text}</p>}</>

  const cuddleReady = readyAt(pet.can_cuddle_at)
  return <>
    <div className="row between"><div><h1 className="screen-title pet-name">{pet.name}</h1><p className="muted small pet-sub">{pet.species_name} · nível {pet.level} · {pet.stage}</p></div><span className={`pill ${pet.sick ? 'rose' : 'sage'}`}>{MOOD[pet.mood] || pet.mood}</span></div>
    {status && <p className={`notice ${status.kind}`}>{status.text}</p>}
    <div className={`pet-stage card ${pet.sick ? 'sick' : ''}`}><PetCanvas pet={{ ...pet, prop: emUso }} /><div className="pet-stage-note"><strong>{pet.mood === 'feliz' ? 'Tudo em ordem por aqui' : 'Ele está tentando avisar vocês'}</strong><span>{pet.mess_count ? `${pet.mess_count} sujeira${pet.mess_count > 1 ? 's' : ''} pela casa` : 'Casa limpinha'}</span></div></div>
    <div className="pet-stats">{Object.entries(pet.stats).map(([key, value]) => <div className={`pet-stat ${value < 30 ? 'low' : ''}`} key={key}><div className="row between"><span><Icon name={STAT[key][1]} size={15} /> {STAT[key][0]}</span><strong>{value}</strong></div><div className="stat-track"><i style={{ width: `${value}%` }} /></div>{pet.empty_in_hours[key] != null && <small>zera em cerca de {pet.empty_in_hours[key]}h</small>}</div>)}</div>
    <div className="xp-strip"><span>Nível {pet.level}</span><div><i style={{ width: `${pet.xp_ratio * 100}%` }} /></div><small>{pet.xp_need ? `${pet.xp_into}/${pet.xp_need} XP` : 'máximo'}</small></div>
    <div className="pet-tabs">{[['comida','Alimentar'],['brinquedo','Brincar'],['acessorio','Vestir']].map(([code, label]) => <button key={code} className={tab === code ? 'active' : ''} onClick={() => setTab(code)}>{label}</button>)}</div>
    <div className="pet-items">{shown.map((item) => { const can = item.quantity > 0 && (tab !== 'brinquedo' || item.ready); const path = tab === 'comida' && item.effect.hygiene ? 'bathe' : tab === 'comida' ? 'feed' : tab === 'brinquedo' ? 'play' : 'accessory'; return <button key={item.code} className="pet-item" disabled={busy || !can} onClick={() => act(path, { code: item.code }, tab === 'acessorio' ? `${item.name} vestido.` : `${pet.name} recebeu ${item.name}.`)}><span className="pet-item-art"><ItemPreview item={{ ...item, category: 'pet' }} scale={1.35} /></span><strong>{item.name}</strong><small>{item.quantity ? `vocês têm ${item.quantity}` : `${item.price} Corações na loja`}</small></button> })}</div>
    {!shown.some((i) => i.quantity) && <Link to="/loja" className="btn btn-accent btn-block"><Icon name="bag" size={17} /> Ir comprar na loja</Link>}
    <button className="btn btn-ghost btn-block pet-cuddle" disabled={busy || !cuddleReady} onClick={() => act('cuddle', undefined, `${pet.name} ganhou um carinho.`)}><Icon name="heart" size={17} /> {cuddleReady ? 'Carinho (descansa 4 horas)' : 'Carinho ainda descansando'}</button>
    {pet.mess_count > 0 && <div className="card mess-list"><p className="card-title">A casa não se limpa sozinha</p>{pet.mess.map((m) => <div className="row between" key={m.id}><span><Icon name="drop" size={16} /> Sujeira na {m.room_code}</span><button className="btn btn-sm btn-sage" onClick={() => act(`mess/${m.id}/clean`, undefined, 'Uma sujeira a menos.')}>Limpar</button></div>)}</div>}
  </>
}
