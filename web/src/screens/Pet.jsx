import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import Icon from '../components/Icon'
import ItemPreview from '../components/ItemPreview'
import PetCanvas from '../render/PetCanvas'
import { drawPet } from '../render/PetCanvas'
import { Painter } from '../render/pixel'
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

/**
 * O retrato pequeno de um bichinho, pra fila de troca.
 *
 * Desenhado UMA vez, sem animação: são vários na tela ao mesmo tempo, e manter
 * um laço por retrato só pra eles respirarem custaria mais bateria do que
 * qualquer coisa que se ganhasse. O da vez continua animado no palco.
 */
const CHIP = 46
function PetChip({ dados, ativo, onTrocar }) {
  const ref = useRef(null)
  useEffect(() => {
    const p = new Painter(ref.current)
    p.resize(CHIP, Math.round(CHIP * 108 / 128))
    p.clear()
    drawPet(p, {
      species: dados.species, colors: dados.colors, growth: dados.growth,
      mood: dados.mood, sick: dados.sick, accessories: {}, action: 'parado',
    }, 0)
  }, [dados.species, dados.growth, dados.mood, dados.sick])
  // O pior atributo vira um aviso no retrato: é assim que dá pra ver quem está
  // precisando de você SEM ter que entrar em cada bichinho pra conferir.
  const precisa = dados.sick || dados.worst < 30
  return (
    <button
      className={`pet-chip ${ativo ? 'ativo' : ''} ${precisa ? 'precisa' : ''}`}
      onClick={() => !ativo && onTrocar(dados)}
      title={`${dados.name} · nível ${dados.level}${precisa ? ' · precisando de cuidado' : ''}`}
    >
      <canvas ref={ref} />
      <span>{dados.name}</span>
      {precisa && <i aria-label="precisando de cuidado" />}
    </button>
  )
}

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
  const [pets, setPets] = useState([])
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
    setPet(state.pet); setPets(state.pets || []); setSpecies(kinds.species); setItems(owned.items)
    if (state.since?.mess_born) setStatus({ kind: 'warn', text: `${state.since.mess_born} sujeira nova apareceu na casa.` })
  }
  useEffect(() => { load().catch((e) => setStatus({ kind: 'error', text: e.message })); return subscribe('pet', (next) => setPet(next)) }, [])
  // O item que ele esta usando AGORA, so pro desenho. Some sozinho depois da
  // cena — e o que faz voce VER ele comendo a racao, roendo o osso ou correndo
  // atras da bolinha, em vez de so o numero da barra subir.
  const [emUso, setEmUso] = useState(null)

  // ------------------------------------------------------------- arrastar
  //
  // Arrastar a comida (ou o brinquedo, ou o acessório) até o bichinho, em vez de
  // só apertar um botão. É o gesto que a criança faz com o brinquedo de verdade,
  // e dá ao item um destino: você vê a ração ir até ele.
  //
  // Feito com eventos de PONTEIRO, não com a API de arrastar do HTML. A API de
  // arrastar do navegador simplesmente **não existe em toque** — no celular ela
  // nunca dispara, e o recurso ficaria só no computador, que é onde ninguém usa
  // este app. Ponteiro é o mesmo caminho para dedo, caneta e mouse.
  //
  // O toque simples continua valendo: só vira arrasto depois de o dedo andar uns
  // pixels. Sem essa folga, qualquer tremida no dedo viraria arrasto e o toque
  // deixaria de funcionar — e a rolagem da lista morreria junto.
  const palcoRef = useRef(null)
  const [arrasto, setArrasto] = useState(null)
  const arrastoRef = useRef(null)

  const sobreOPalco = useCallback((x, y) => {
    const caixa = palcoRef.current?.getBoundingClientRect()
    if (!caixa) return false
    return x >= caixa.left && x <= caixa.right && y >= caixa.top && y <= caixa.bottom
  }, [])

  function comecarArrasto(e, item, path, label) {
    if (busy || item.quantity <= 0) return
    arrastoRef.current = {
      item, path, label,
      x0: e.clientX, y0: e.clientY,
      x: e.clientX, y: e.clientY,
      virou: false, sobre: false,
    }
    const mover = (ev) => {
      const a = arrastoRef.current
      if (!a) return
      const dist = Math.hypot(ev.clientX - a.x0, ev.clientY - a.y0)
      if (!a.virou && dist < 8) return
      a.virou = true
      a.x = ev.clientX
      a.y = ev.clientY
      a.sobre = sobreOPalco(ev.clientX, ev.clientY)
      // impede a página de rolar junto enquanto o item está na mão
      ev.preventDefault?.()
      setArrasto({ code: a.item.code, name: a.item.name, x: a.x, y: a.y, sobre: a.sobre })
    }
    const soltar = (ev) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      const a = arrastoRef.current
      arrastoRef.current = null
      setArrasto(null)
      if (!a) return
      // Toque simples (não virou arrasto) continua fazendo o que sempre fez.
      if (!a.virou) { act(a.path, { code: a.item.code }, a.label); return }
      if (sobreOPalco(ev.clientX, ev.clientY)) act(a.path, { code: a.item.code }, a.label)
      // Soltar fora do bichinho não faz nada, de propósito: é como desistir no
      // meio. Aplicar mesmo assim gastaria um item do inventário sem a pessoa
      // ter escolhido isso.
    }
    window.addEventListener('pointermove', mover, { passive: false })
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }

  async function act(path, body, label) {
    setBusy(path + (body?.code || '')); setStatus(null)
    if (body?.code) {
      setEmUso(body.code)
      clearTimeout(act.timer)
      act.timer = setTimeout(() => setEmUso(null), 2600)
    }
    try {
      const result = await api.post(`/api/pet/${path}`, body)
      setPet(result.pet)
      setStatus({ kind: 'ok', text: label })
      const [inv, estado] = await Promise.all([api.get('/api/pet/items'), api.get('/api/pet')])
      setItems(inv.items)
      setPets(estado.pets || [])
    }
    catch (e) {
      // Recusa por ESTADO do bichinho (sem fome, já limpo, cansado) não é erro
      // do app: é o jogo funcionando. Vermelho ali fazia parecer defeito — foi
      // a mesma lição do botão "Interagir" na casa.
      const doBicho = e.status === 400 || e.status === 409
      setStatus({ kind: doBicho ? 'warn' : 'error', text: e.message })
      setEmUso(null)  // deu errado: nao mostra cena de uso que nao aconteceu
    }
    setBusy('')
  }
  /**
   * Fazer carinho com o DEDO, passando a mao nele no palco.
   *
   * O botao "Carinho" continua existindo — mas botao e botao. Passar a mao em
   * cima do bichinho e o gesto que o dono pediu quando falou do Kinectimals, e
   * e o unico que parece carinho de verdade.
   *
   * A regra ja travada continua valendo: a REACAO e sempre, o PREMIO tem hora.
   * Fora da janela o servidor recusa com 400, e aqui isso vira um aviso
   * tranquilo — nao um erro vermelho. Ele reagiu de qualquer jeito; o que
   * estava em descanso era a alegria, nao o afeto.
   */
  const [soltando, setSoltando] = useState(null)

  /** Dispensa um bichinho. O servidor recusa se for o último. */
  async function soltarBichinho(alvo) {
    setBusy('soltar'); setStatus(null)
    try {
      const r = await api.post(`/api/pet/${alvo.id}/soltar`)
      setPet(r.pet)
      const estado = await api.get('/api/pet')
      setPets(estado.pets || [])
      setStatus({ kind: 'ok', text: `${alvo.name} foi dispensado.` })
    } catch (e) {
      setStatus({ kind: 'warn', text: e.message })
    }
    setSoltando(null)
    setBusy('')
  }

  const afagoRef = useRef(0)
  async function aoAfagar(acao) {
    if (acao !== 'carinho') return
    const agora = Date.now()
    if (agora - afagoRef.current < 3500) return
    afagoRef.current = agora
    try {
      const result = await api.post('/api/pet/cuddle')
      setPet(result.pet)
      setStatus({ kind: 'ok', text: `${pet.name} adorou o carinho.` })
    } catch (e) {
      setStatus({ kind: 'warn', text: `${pet.name} gostou, mas a alegria dele já está no talo — volte mais tarde.` })
    }
  }

  async function trocarPara(alvo) {
    setStatus(null)
    try {
      const r = await api.post(`/api/pet/${alvo.id}/select`)
      setPet(r.pet)
      window.casalSound?.('nav')
      const estado = await api.get('/api/pet')
      setPets(estado.pets || [])
      setItems((await api.get('/api/pet/items')).items)
    } catch (e) { setStatus({ kind: 'error', text: e.message }) }
  }

  const shown = useMemo(() => items.filter((i) => i.subcategory === tab), [items, tab])
  if (!pet) return status?.kind === 'error'
    ? <div className="card center"><Icon name="paw" size={42} /><p>{status.text}</p><button className="btn btn-primary" onClick={load}>Tentar de novo</button></div>
    : <div className="full-center"><div className="spinner" /></div>
  if (!pet.chosen) return <><SpeciesChooser species={species} onChoose={(code, name) => act('choose', { species: code, name }, 'Agora vocês têm alguém esperando em casa.')} busy={busy} />{status && <p className={`notice ${status.kind}`}>{status.text}</p>}</>

  const cuddleReady = readyAt(pet.can_cuddle_at)
  return <>
    <div className="pet-tela">
    <div className="row between"><div><h1 className="screen-title pet-name">{pet.name}</h1><p className="muted small pet-sub">{pet.species_name} · nível {pet.level} · {pet.stage}</p></div><span className={`pill ${pet.sick ? 'rose' : 'sage'}`}>{MOOD[pet.mood] || pet.mood}</span></div>
    {status && <p className={`notice ${status.kind}`}>{status.text}</p>}
    {/* A casa pode ter mais de um bichinho. A fila mostra todos e troca quem
        está na tela — de graça, e sem apagar nada de ninguém. */}
    {pets.length > 1 && (
      <>
        <div className="pet-fila">
          {pets.map((x) => (
            <PetChip key={x.id} dados={x} ativo={x.id === pet.id} onTrocar={trocarPara} />
          ))}
        </div>
        {/* SOLTAR: faltava um jeito de desfazer uma adoção.
            Cada licença de espécie da loja traz um bichinho NOVO — então comprar
            a segunda licença de gato deixa dois gatos na fila pra sempre, sem
            saída. Fica pequeno e com confirmação porque é o único botão do app
            que apaga alguma coisa de verdade. */}
        <button
          className="btn-ghost btn-sm pet-soltar"
          onClick={() => setSoltando(pet)}
        >
          <Icon name="close" size={13} /> Dispensar {pet.name}
        </button>
      </>
    )}
    {soltando && (
      <div className="card center">
        <h3>Dispensar {soltando.name}?</h3>
        <p className="muted small">
          Ele sai da casa e o histórico dele vai junto. Não dá pra desfazer —
          e a licença da espécie não volta. Os outros continuam onde estão.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-block" onClick={() => setSoltando(null)}>
            Deixa quieto
          </button>
          <button
            className="btn btn-primary btn-block"
            disabled={busy === 'soltar'}
            onClick={() => soltarBichinho(soltando)}
          >
            Dispensar
          </button>
        </div>
      </div>
    )}
    {/* A ARENA: o bichinho grande no meio, as opções na lateral.
        Antes o palco era uma faixa baixa e a lista de itens ocupava a largura
        toda embaixo — o bichinho ficava pequeno e longe do que se faz com ele.
        Com as opções em pé, do lado, sobra altura pro cenário e o arrasto vira
        um caminho curto: o item sai da lateral e cai em cima dele. */}
    <div className="pet-arena">
      <div ref={palcoRef} className={`pet-stage card ${pet.sick ? 'sick' : ''} ${arrasto ? (arrasto.sobre ? 'alvo-aceso' : 'alvo') : ''}`}>
        <PetCanvas pet={{ ...pet, prop: emUso }} onPoke={aoAfagar} arrastando={!!arrasto} />
        {/* As barras viraram um HUD de canto.
            Elas ocupavam quatro cartões num grid embaixo do cenário — metade da
            tela pra dizer quatro números. Aqui são quatro tracinhos no canto,
            como em jogo: dá pra ler de relance e o cenário fica com o espaço.
            O prazo até zerar não se perdeu (é ele que mostra que o tempo está
            correndo, decisão registrada no HANDOFF): virou o `title` de cada
            barra, e aparece escrito quando o atributo está baixo — que é
            justamente quando importa. */}
        <div className="pet-hud">
          {Object.entries(pet.stats).map(([key, value]) => (
            <div
              key={key}
              className={`hud-linha ${value < 30 ? 'baixo' : ''}`}
              title={`${STAT[key][0]}: ${value}${pet.empty_in_hours[key] != null ? ` · zera em cerca de ${pet.empty_in_hours[key]}h` : ''}`}
            >
              <Icon name={STAT[key][1]} size={11} />
              <i><b style={{ width: `${value}%` }} /></i>
              {value < 30 && pet.empty_in_hours[key] != null && <em>{pet.empty_in_hours[key]}h</em>}
            </div>
          ))}
          <div className="hud-xp" title={pet.xp_need ? `${pet.xp_into}/${pet.xp_need} XP` : 'nível máximo'}>
            <span>Nv {pet.level}</span>
            <i><b style={{ width: `${pet.xp_ratio * 100}%` }} /></i>
          </div>
        </div>
        <div className="pet-stage-note">
          <strong>{pet.mood === 'feliz' ? 'Tudo em ordem' : 'Ele quer avisar algo'}</strong>
          <span>{pet.mess_count ? `${pet.mess_count} sujeira${pet.mess_count > 1 ? 's' : ''} pela casa` : 'Casa limpinha'}</span>
        </div>
        {arrasto && <span className="pet-stage-dica">{arrasto.sobre ? `Solte para dar ${arrasto.name}` : `Arraste até ${pet.name}`}</span>}
      </div>

      <div className="pet-lateral">
        <div className="pet-tabs">{[['comida', 'Comer', 'bag'], ['brinquedo', 'Brincar', 'game'], ['acessorio', 'Vestir', 'sparkle']].map(([code, label, ic]) => (
          <button key={code} className={tab === code ? 'active' : ''} onClick={() => setTab(code)} title={label}>
            <Icon name={ic} size={15} /><span>{label}</span>
          </button>
        ))}</div>
        <div className="pet-items">{shown.map((item) => {
          // POR QUE ESTE ITEM NAO PODE SER USADO AGORA — dito no cartao, antes
          // do toque.
          //
          // O botao so ficava cinza, e cinza nao explica nada: o dono tentou dar
          // sushi, nao aconteceu nada (ou apareceu um erro vermelho depois) e
          // leu como app quebrado. Sao tres motivos diferentes e cada um tem uma
          // saida diferente — comprar mais, esperar o brinquedo, ou dar comida
          // mais tarde —, entao cada um diz o seu.
          const cheio = item.effect.hunger && pet.stats?.hunger >= 100
          const limpo = item.effect.hygiene && !item.effect.hunger && pet.stats?.hygiene >= 100
          const motivo = item.quantity <= 0
            ? 'acabou'
            : tab === 'brinquedo' && !item.ready
              ? 'descansando'
              : cheio
                ? 'sem fome'
                : limpo
                  ? 'já limpo'
                  : ''
          const can = !motivo
          const path = tab === 'comida' && item.effect.hygiene ? 'bathe' : tab === 'comida' ? 'feed' : tab === 'brinquedo' ? 'play' : 'accessory'
          const label = tab === 'acessorio' ? `${item.name} vestido.` : `${pet.name} recebeu ${item.name}.`
          return <button
            key={item.code}
            className={`pet-item ${arrasto?.code === item.code ? 'na-mao' : ''} ${motivo ? 'sem-uso' : ''}`}
            disabled={busy || !can}
            title={motivo ? `${item.name} — ${motivo}` : item.name}
            onPointerDown={(e) => { if (can) comecarArrasto(e, item, path, label) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (can) act(path, { code: item.code }, label) } }}
          >
            <span className="pet-item-art"><ItemPreview item={{ ...item, category: 'pet' }} scale={1.15} /></span>
            <strong>{item.name}</strong>
            <small>{motivo || `×${item.quantity}`}</small>
          </button>
        })}</div>
        <button className="btn btn-ghost pet-cuddle" disabled={busy || !cuddleReady} onClick={() => act('cuddle', undefined, `${pet.name} ganhou um carinho.`)}>
          <Icon name="heart" size={16} /><span>{cuddleReady ? 'Carinho' : 'Descansando'}</span>
        </button>
      </div>
    </div>
    </div>
    {!shown.some((i) => i.quantity) && <Link to="/loja" className="btn btn-accent btn-block"><Icon name="bag" size={17} /> Ir comprar na loja</Link>}
    {arrasto && (
      <span
        className={`arrasto-fantasma ${arrasto.sobre ? 'aceso' : ''}`}
        style={{ left: arrasto.x, top: arrasto.y }}
        aria-hidden="true"
      >
        <ItemPreview item={{ code: arrasto.code, category: 'pet', subcategory: tab }} scale={1.6} />
      </span>
    )}
    {pet.mess_count > 0 && <div className="card mess-list"><p className="card-title">A casa não se limpa sozinha</p>{pet.mess.map((m) => <div className="row between" key={m.id}><span><Icon name="drop" size={16} /> Sujeira na {m.room_code}</span><button className="btn btn-sm btn-sage" onClick={() => act(`mess/${m.id}/clean`, undefined, 'Uma sujeira a menos.')}>Limpar</button></div>)}</div>}
  </>
}
