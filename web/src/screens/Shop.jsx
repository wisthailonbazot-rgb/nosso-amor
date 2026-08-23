import { useEffect, useState } from 'react'

import { api } from '../api'
import { useStore } from '../store'
import ItemPreview from '../components/ItemPreview'
import Icon from '../components/Icon'

const GROUP_LABEL = {
  hair: 'Cabelo',
  top: 'Roupa de cima',
  bottom: 'Roupa de baixo',
  shoes: 'Calçado',
  head: 'Na cabeça',
  extra: 'Acessórios',
  comida: 'Comida',
  brinquedo: 'Brinquedos',
  acessorio: 'Acessórios',
  estrutural: 'Piso e parede',
  moveis: 'Móveis',
  decoracao: 'Decoração',
  eletronicos: 'Eletrônicos',
  geral: 'Geral',
  especie: 'Adotar outra espécie',
}

export default function Shop() {
  const balance = useStore((s) => s.balance)
  const setBalance = useStore((s) => s.setBalance)
  const [data, setData] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [pet, setPet] = useState(null)
  const [tab, setTab] = useState('avatar')
  const [status, setStatus] = useState(null)
  const [busyCode, setBusyCode] = useState(null)

  async function load() {
    const [shop, mine, petData] = await Promise.all([api.get('/api/shop'), api.get('/api/avatar'), api.get('/api/pet')])
    setData(shop)
    setAvatar(mine.config)
    setPet(petData.pet)
    setBalance(shop.balance)
  }
  async function adopt(item) {
    try { const result=await api.post('/api/pet/adopt',{species:item.metadata.species});setPet(result.pet);window.casalSound?.('pet',result.pet.species);setStatus({kind:'ok',text:`${item.name} agora é o bichinho ativo da casa.`}) }
    catch(err){setStatus({kind:'error',text:err.message})}
  }

  useEffect(() => {
    load().catch((err) => setStatus({ kind: 'error', text: err.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buy(item) {
    setBusyCode(item.code)
    setStatus(null)
    try {
      const result = await api.post('/api/shop/buy', { code: item.code })
      setBalance(result.balance)
      setStatus({ kind: 'ok', text: `${item.name} é de vocês agora.` })
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
    setBusyCode(null)
  }

  if (!data) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  const current = data.categories.find((c) => c.code === tab) || data.categories[0]

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>
          Loja
        </h1>
        <span className="pill rose">
          <Icon name="heart" size={14} filled /> {balance}
        </span>
      </div>

      {status && (
        <div className={`alert alert-${status.kind === 'ok' ? 'ok' : 'error'}`}>{status.text}</div>
      )}

      <div className="shop-tabs">
        {data.categories.map((cat) => (
          <button
            key={cat.code}
            className={current?.code === cat.code ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setTab(cat.code)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {current?.groups.map((group) => (
        <div key={group.code}>
          <p className="group-title">{GROUP_LABEL[group.code] || group.code}</p>
          <div className="shop-grid">
            {group.items.map((item) => {
              const affordable = balance >= item.price
              return (
                <div key={item.code} className={`shop-item ${item.owned ? 'owned' : ''}`}>
                  <div className="shop-preview">
                    <ItemPreview item={item} avatarConfig={avatar} scale={2} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{item.name}</div>
                    {item.description && (
                      <div className="muted tiny" style={{ marginTop: 2 }}>
                        {item.description}
                      </div>
                    )}
                  </div>

                  {item.subcategory==='especie'&&item.owned>0 ? (
                    <button className="btn-primary btn-sm" disabled={pet?.species===item.metadata.species} onClick={()=>adopt(item)}>{pet?.species===item.metadata.species?'Está na casa':'Escolher'}</button>
                  ) : item.owned > 0 && !item.consumable ? (
                    <span className="pill sage" style={{ justifyContent: 'center' }}>
                      já é seu
                    </span>
                  ) : (
                    <button
                      className={affordable ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
                      onClick={() => buy(item)}
                      disabled={busyCode === item.code || !affordable}
                    >
                      <Icon name="heart" size={13} filled /> {item.price}
                      {item.owned > 0 && item.consumable ? ` · tem ${item.owned}` : ''}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
