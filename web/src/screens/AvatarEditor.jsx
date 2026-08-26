import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import { useStore } from '../store'
import AvatarView from '../components/AvatarView'
import Icon from '../components/Icon'
import { STYLE_LISTS } from '../render/avatar'

// Nome bonito pra cada estilo. O servidor manda o código; quem traduz é a tela.
const LABEL = {
  curto: 'Curto', medio: 'Médio', longo: 'Longo', cacheado: 'Cacheado', coque: 'Coque',
  franja: 'Franja', rabo: 'Rabo', moicano: 'Moicano', chanel: 'Chanel',
  trancas: 'Tranças', afro: 'Black power', raspado: 'Raspado',
  camiseta: 'Camiseta', regata: 'Regata', moletom: 'Moletom', vestido: 'Vestido',
  xadrez: 'Xadrez', jaqueta: 'Jaqueta', social: 'Social',
  jeans: 'Jeans', short: 'Short', saia: 'Saia',
  tenis: 'Tênis', chinelo: 'Chinelo', bota: 'Bota', sandalia: 'Sandália',
  bone: 'Boné', oculos: 'Óculos', laco: 'Laço', coroa: 'Coroa', touca: 'Touca',
  colar: 'Colar', mochila: 'Mochila', fone: 'Fone', asa: 'Asinhas',
  redondo: 'Redondo', amendoado: 'Amendoado', fechado: 'Fechado',
  sonolento: 'Sonolento', animado: 'Animado',
  sorriso: 'Sorriso', serio: 'Sério', risada: 'Risada', bico: 'Bico', lingua: 'Língua',
  reta: 'Reta', arqueada: 'Arqueada', grossa: 'Grossa', fina: 'Fina',
}

const label = (code) => LABEL[code] || code

const TABS = [
  { key: 'corpo', name: 'Corpo' },
  { key: 'rosto', name: 'Rosto' },
  { key: 'cabelo', name: 'Cabelo' },
  { key: 'roupa', name: 'Roupa' },
  { key: 'extras', name: 'Extras' },
]

function Swatches({ colors, value, onPick }) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {colors.map((color) => (
        <button
          key={color}
          className="swatch"
          onClick={() => onPick(color)}
          style={{
            background: color,
            outline: value === color ? '3px solid var(--rose-deep)' : 'none',
            outlineOffset: 2,
          }}
          aria-label={color}
        />
      ))}
    </div>
  )
}

function Choices({ options, value, onPick, allowEmpty = false, locked = [] }) {
  const lockedSet = new Set(locked)
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {allowEmpty && (
        <button className={value ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => onPick('')}>
          nenhum
        </button>
      )}
      {options.map((style) => {
        const isLocked = lockedSet.has(style)
        return (
          <button
            key={style}
            className={value === style ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => !isLocked && onPick(style)}
            disabled={isLocked}
            title={isLocked ? 'Ainda não é seu — compre na loja' : ''}
          >
            {isLocked && '🔒 '}
            {label(style)}
          </button>
        )
      })}
    </div>
  )
}

export default function AvatarEditor() {
  const refreshMe = useStore((s) => s.refreshMe)
  const [config, setConfig] = useState(null)
  const [saved, setSaved] = useState(null)
  const [options, setOptions] = useState(null)
  const [tab, setTab] = useState('corpo')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/api/avatar'), api.get('/api/shop/avatar-options')])
      .then(([mine, opts]) => {
        setConfig(mine.config)
        setSaved(JSON.stringify(mine.config))
        setOptions(opts)
      })
      .catch((err) => setStatus({ kind: 'error', text: err.message }))
  }, [])

  const dirty = useMemo(
    () => (config && saved ? JSON.stringify(config) !== saved : false),
    [config, saved]
  )

  function set(patch) {
    setConfig((current) => ({ ...current, ...patch }))
    setStatus(null)
  }

  /** O que existe no desenho, menos o que este usuário pode usar = o que está trancado. */
  function lockedFor(slot) {
    const allowed = new Set(options?.allowed?.[slot] || [])
    return STYLE_LISTS[slot].filter((style) => !allowed.has(style))
  }

  async function save() {
    setBusy(true)
    try {
      const result = await api.put('/api/avatar', { config })
      setConfig(result.config)
      setSaved(JSON.stringify(result.config))
      setStatus({ kind: 'ok', text: 'Pronto, ficou salvo.' })
      refreshMe()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
    setBusy(false)
  }

  if (!config || !options) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <Link to="/perfil" className="btn-plain" aria-label="Voltar">
          <Icon name="back" size={22} />
        </Link>
        <h1 className="screen-title" style={{ margin: 0, fontSize: 24 }}>
          Meu avatar
        </h1>
        <span style={{ width: 22 }} />
      </div>

      {status && (
        <div className={`alert alert-${status.kind === 'ok' ? 'ok' : 'error'}`}>{status.text}</div>
      )}

      <div className="card center tilt" style={{ paddingTop: 22 }}>
        <div className="tape" />
        <AvatarView config={config} scale={3} />
      </div>

      <div className="shop-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setTab(t.key)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {tab === 'corpo' && (
        <div className="card">
          <p className="card-title">Tom de pele</p>
          <Swatches colors={options.colors.skin} value={config.skin} onPick={(v) => set({ skin: v })} />
          <div style={{ height: 14 }} />
          {/* Silhueta. Fica junto do tom de pele porque é da mesma natureza:
              é como a pessoa é, não é roupa — não custa nada e não passa pela
              posse. Antes o corpo era o mesmo retângulo pros dois, e a única
              diferença entre os bonecos era cabelo e roupa. */}
          <p className="card-title">Corpo</p>
          <Choices
            options={['reto', 'curvas']}
            value={config.corpo || 'reto'}
            onPick={(v) => set({ corpo: v })}
          />
        </div>
      )}

      {tab === 'rosto' && (
        <>
          <div className="card">
            <p className="card-title">Olhos</p>
            <Choices options={STYLE_LISTS.eyes} value={config.eyes} onPick={(v) => set({ eyes: v })} />
            <div style={{ height: 12 }} />
            <Swatches
              colors={options.colors.eyes}
              value={config.eye_color}
              onPick={(v) => set({ eye_color: v })}
            />
          </div>
          <div className="card">
            <p className="card-title">Boca</p>
            <Choices options={STYLE_LISTS.mouth} value={config.mouth} onPick={(v) => set({ mouth: v })} />
          </div>
          <div className="card">
            <p className="card-title">Sobrancelha</p>
            <Choices options={STYLE_LISTS.brows} value={config.brows} onPick={(v) => set({ brows: v })} />
          </div>
          <div className="card tight">
            <label className="row between" style={{ cursor: 'pointer' }}>
              <span>Bochecha corada</span>
              <input
                type="checkbox"
                checked={!!config.blush}
                onChange={(e) => set({ blush: e.target.checked })}
                style={{ width: 22, height: 22 }}
              />
            </label>
          </div>
        </>
      )}

      {tab === 'cabelo' && (
        <div className="card">
          <p className="card-title">Corte</p>
          <Choices
            options={STYLE_LISTS.hair}
            value={config.hair_style}
            onPick={(v) => set({ hair_style: v })}
            locked={lockedFor('hair')}
          />
          <div style={{ height: 12 }} />
          <p className="card-title">Cor</p>
          <Swatches
            colors={options.colors.hair}
            value={config.hair_color}
            onPick={(v) => set({ hair_color: v })}
          />
        </div>
      )}

      {tab === 'roupa' && (
        <>
          <div className="card">
            <p className="card-title">De cima</p>
            <Choices
              options={STYLE_LISTS.top}
              value={config.top}
              onPick={(v) => set({ top: v })}
              locked={lockedFor('top')}
            />
            <div style={{ height: 10 }} />
            <Swatches
              colors={['#5b8def', '#e8879b', '#9cbf9a', '#f2b33d', '#c9b6e8', '#fffaf3', '#4a3b37']}
              value={config.top_color}
              onPick={(v) => set({ top_color: v })}
            />
          </div>
          <div className="card">
            <p className="card-title">
              De baixo {config.top === 'vestido' && <span className="tiny">(o vestido cobre)</span>}
            </p>
            <Choices
              options={STYLE_LISTS.bottom}
              value={config.bottom}
              onPick={(v) => set({ bottom: v })}
              locked={lockedFor('bottom')}
            />
            <div style={{ height: 10 }} />
            <Swatches
              colors={['#3c5a99', '#4a3b37', '#e8879b', '#9cbf9a', '#8d7a70', '#2f2740']}
              value={config.bottom_color}
              onPick={(v) => set({ bottom_color: v })}
            />
          </div>
          <div className="card">
            <p className="card-title">Calçado</p>
            <Choices
              options={STYLE_LISTS.shoes}
              value={config.shoes}
              onPick={(v) => set({ shoes: v })}
              locked={lockedFor('shoes')}
            />
            <div style={{ height: 10 }} />
            <Swatches
              colors={['#f0f0f0', '#4a3b37', '#e8879b', '#5b8def', '#f2b33d', '#2f2740']}
              value={config.shoes_color}
              onPick={(v) => set({ shoes_color: v })}
            />
          </div>
        </>
      )}

      {tab === 'extras' && (
        <>
          <div className="card">
            <p className="card-title">Na cabeça</p>
            <Choices
              options={STYLE_LISTS.head}
              value={config.head}
              onPick={(v) => set({ head: v })}
              allowEmpty
              locked={lockedFor('head')}
            />
          </div>
          <div className="card">
            <p className="card-title">Acessório</p>
            <Choices
              options={STYLE_LISTS.extra}
              value={config.extra}
              onPick={(v) => set({ extra: v })}
              allowEmpty
              locked={lockedFor('extra')}
            />
          </div>
          <Link to="/loja" className="btn btn-accent btn-block">
            <Icon name="bag" size={18} /> Ver na loja
          </Link>
        </>
      )}

      <button className="btn-primary btn-block" onClick={save} disabled={busy || !dirty}>
        {dirty ? 'Salvar' : 'Tudo salvo'}
      </button>
    </>
  )
}
