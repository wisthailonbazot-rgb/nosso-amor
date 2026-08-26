import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api'
import RoomCanvas from '../render/RoomCanvas'
import { project, roomMetrics } from '../render/iso'
import { WALL_HEIGHT } from '../render/room'
import { criarPasseio, passearAte, pontosDeInteresse } from '../render/petWander'
import PropertyCanvas from '../render/PropertyCanvas'
import ItemPreview from '../components/ItemPreview'
import Icon from '../components/Icon'
import { subscribe, useStore } from '../store'

function fits(item, col, row, room, others) {
  const { w, d } = item
  if (col < 0 || row < 0 || col + w > room.w || row + d > room.h) return false
  const dirty = new Set(room.mess.map((m) => `${m.col}:${m.row}`))
  for (let r=row;r<row+d;r++) for(let c=col;c<col+w;c++) {
    if (dirty.has(`${c}:${r}`)) return false
    if (others.some((o) => c >= o.col && c < o.col + o.w && r >= o.row && r < o.row + o.d)) return false
  }
  return true
}

export default function House() {
  const setBalance = useStore((s) => s.setBalance)
  const [data, setData] = useState(null)
  const [roomCode, setRoomCode] = useState('sala')
  const [draft, setDraft] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [hover, setHover] = useState(null)
  const [editing, setEditing] = useState(false)
  // 'fora' = a casa vista de fora, com quintal e rua. 'dentro' = os comodos.
  //
  // Antes as duas coisas ficavam EMPILHADAS na mesma rolagem: a vista externa,
  // a legenda, as abas de comodo, o comodo, a linha do bichinho e o editor, tudo
  // de uma vez. Media 1.587 pixels de altura num visor de 918 — voce so via
  // pedaco de cada coisa. Agora e um lugar de cada vez, e voce ENTRA na casa.
  const [vista, setVista] = useState('fora')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const dragging = useRef(null)

  async function load(keepDraft = false) {
    const next = await api.get('/api/house'); setData(next); setBalance(next.balance)
    const room = next.rooms.find((r) => r.code === roomCode) || next.rooms[0]
    if (!keepDraft) setDraft(room?.items || [])
  }
  useEffect(() => { load().catch((e) => setStatus({kind:'error',text:e.message})); return subscribe('house', (event) => {
    if (editing) setStatus({kind:'warn',text:'Seu amor mexeu na casa. Salve ou cancele para recarregar.'})
    else if (event?.room?.code === roomCode) { setData((old) => ({...old,rooms:old.rooms.map((r)=>r.code===roomCode?event.room:r)})); setDraft(event.room.items) }
    else load().catch(()=>{})
  }) }, [editing, roomCode])
  useEffect(() => { const room=data?.rooms.find((r)=>r.code===roomCode); if(room&&!editing) setDraft(room.items) },[roomCode,data,editing])

  const room = data?.rooms.find((r) => r.code === roomCode)
  // ------------------------------------------------------------------ o bicho
  // As celulas onde ele nao pode pisar. Recalculado quando a mobilia ou a
  // sujeira muda; o passeio em si NAO e refeito, pra ele nao teleportar toda
  // vez que voce arrasta um movel.
  const bloqueadas = useMemo(() => {
    const set = new Set()
    if (!room) return set
    for (const item of draft)
      for (let r = item.row; r < item.row + item.d; r++)
        for (let c = item.col; c < item.col + item.w; c++) set.add(`${c}:${r}`)
    for (const m of room.mess) set.add(`${m.col}:${m.row}`)
    return set
  }, [room, draft])

  const passeio = useRef(null)
  const aqui = data?.pet?.chosen && room && data.pet.room_code === room.code

  // Quem tem asa levanta voo de vez em quando; quem nao tem, nunca — pedir
  // `voar` pra capivara devolveria o bicho boiando sem asa nenhuma.
  const voador = ['passaro', 'dragao'].includes(data?.pet?.species)

  // Quem está NESTE cômodo. O ativo entra sempre (é o que a tela cuida); os
  // outros entram pelo `room_code` que cada um carrega.
  //
  // Antes só o ativo aparecia, e a casa com quatro bichinhos mostrava um. O
  // dono pediu todos andando e interagindo — e faz sentido: eles moram lá, a
  // sujeira de todos cai no mesmo chão, e ver a casa vazia com três bichos
  // adotados é a casa mentindo.
  const moradores = useMemo(() => {
    if (!data?.pet || !room) return []
    const lista = (data.pets || []).filter((p) => p.species)
    if (!lista.length) return [{ ...data.pet, id: 0 }]
    // O ATIVO usa o objeto completo (`data.pet`), que traz mess_count e o
    // resto; os outros usam o resumo. Sem isso o ativo perderia informação que
    // a tela já tinha.
    return lista
      .map((p) => (p.active ? { ...p, ...data.pet, id: p.id } : p))
      .filter((p) => (p.room_code || 'sala') === room.code)
  }, [data?.pet, data?.pets, room?.code])

  useEffect(() => {
    if (!aqui) { passeio.current = null; return }
    const livre = (c, r) =>
      c >= 0 && r >= 0 && c < room.w && r < room.h && !bloqueadas.has(`${c}:${r}`)
    // recria so quando troca de comodo; dentro do mesmo comodo ele continua de
    // onde estava, so respeitando os obstaculos novos
    if (!passeio.current || passeio.current.comodo !== room.code) {
      passeio.current = criarPasseio(
        room.w, room.h, bloqueadas,
        [Math.floor(room.w / 2), Math.floor(room.h / 2)],
        draft, voador
      )
      passeio.current.comodo = room.code
    } else {
      passeio.current.livre = livre
      // Os pontos de interesse sao recalculados junto com os obstaculos: mover
      // a caminha e mudar PRA ONDE ele vai dormir. Sem esta linha ele andaria
      // ate o lugar onde a caminha ESTAVA e dormiria no chao, sem erro nenhum.
      passeio.current.interesses = pontosDeInteresse(draft, livre)
      passeio.current.voador = voador
    }
  }, [aqui, room?.code, room?.w, room?.h, bloqueadas, draft, voador])

  // A acao que ele esta fazendo agora. `reacao` e temporaria (o "Interagir"),
  // o resto sai do estado dele — e por isso um bicho doente NAO aparece
  // brincando feliz no meio da sala.
  const [reacao, setReacao] = useState(null)

  // O que ele esta fazendo, em palavras, saindo do proprio passeio.
  //
  // O passeio roda FORA do React de proposito (60 quadros por segundo nao podem
  // virar `setState`). Entao a legenda le esse estado de tempos em tempos, e nao
  // a cada quadro: 1,2 s e devagar o bastante pra nao pesar e rapido o bastante
  // pra frase acompanhar o que se ve na tela.
  const [afazer, setAfazer] = useState('')
  useEffect(() => {
    if (!aqui) { setAfazer(''); return }
    const id = setInterval(() => setAfazer(passeio.current?.frase || ''), 1200)
    return () => clearInterval(id)
  }, [aqui])
  const acaoDoBicho = () => {
    if (reacao) return reacao
    if (!data?.pet) return 'idle'
    if (data.pet.sick) return 'doente'
    if (data.pet.mood === 'sonolento') return 'dormir'
    return null // null = deixa o passeio decidir entre andar e parar
  }

  // Um passeio por morador, guardado por id. Recriar a cada quadro faria todos
  // recomeçarem do meio do cômodo a cada re-render do React.
  const passeios = useRef(new Map())
  useEffect(() => {
    if (!room) return
    const livre = (c, r) =>
      c >= 0 && r >= 0 && c < room.w && r < room.h && !bloqueadas.has(`${c}:${r}`)
    const vivos = new Set()
    moradores.forEach((bicho, i) => {
      vivos.add(bicho.id)
      const guardado = passeios.current.get(bicho.id)
      const voa = ['passaro', 'dragao'].includes(bicho.species)
      if (!guardado || guardado.comodo !== room.code) {
        // Cada um começa num canto diferente, senão os quatro nascem empilhados
        // no meio da sala e levam alguns segundos pra se separar.
        const inicio = [
          Math.min(room.w - 1, 1 + (i * 2) % Math.max(1, room.w - 2)),
          Math.min(room.h - 1, 1 + (i * 3) % Math.max(1, room.h - 2)),
        ]
        const novo = criarPasseio(room.w, room.h, bloqueadas, inicio, draft, voa)
        novo.comodo = room.code
        passeios.current.set(bicho.id, novo)
      } else {
        guardado.livre = livre
        guardado.interesses = pontosDeInteresse(draft, livre)
        guardado.voador = voa
      }
    })
    // quem saiu do cômodo (ou foi dispensado) perde o passeio
    for (const id of [...passeios.current.keys()]) {
      if (!vivos.has(id)) passeios.current.delete(id)
    }
  }, [moradores, room?.code, room?.w, room?.h, bloqueadas, draft])

  /** O estado dos OUTROS bichinhos (os que não estão sendo cuidados agora). */
  function estadoDe(bicho) {
    if (bicho.sick) return 'doente'
    if (bicho.mood === 'sonolento') return 'dormir'
    if (['triste', 'faminto', 'imundo'].includes(bicho.mood)) return 'triste'
    return null
  }

  /**
   * Quando dois se encontram, eles se OLHAM e reagem.
   *
   * É o pedido de "interagindo um com o outro", e é o mínimo que faz a casa
   * parecer habitada em vez de ter vários bichos ignorando uns aos outros no
   * mesmo cômodo. A conta é simples de propósito: quem está a menos de uma
   * célula e meia de distância vira pro outro e troca a ação por uma social.
   *
   * Bicho doente ou triste NÃO entra na brincadeira — ele continua no estado
   * dele. Um bicho doente pulando de alegria porque passou perto de outro seria
   * a mesma mentira que a legenda da casa já contou uma vez.
   */
  function conversar(lista) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        const dist = Math.hypot(a.col - b.col, a.row - b.row)
        if (dist > 1.6) continue
        const ocupado = (x) => ['doente', 'triste', 'dormir'].includes(x.action)
        // eles se encaram
        if (!ocupado(a)) a.olhando = b.col > a.col ? 'direita' : 'esquerda'
        if (!ocupado(b)) b.olhando = a.col > b.col ? 'direita' : 'esquerda'
        // e reagem: quem está mais à esquerda cheira, o outro responde
        if (!ocupado(a)) a.action = 'cocar'
        if (!ocupado(b)) b.action = 'feliz'
        a.juntos = true
        b.juntos = true
      }
    }
    return lista
  }

  const scene = useMemo(
    () =>
      room
        ? {
            cols: room.w,
            rows: room.h,
            floor: room.floor,
            wall: room.wall,
            outdoor: room.outdoor,
            // `pet` e uma FUNCAO, avaliada a cada quadro pelo desenho. Se fosse
            // um objeto fixo, a posicao so mudaria quando o React re-renderizasse
            // — ou seja, o bichinho voltaria a ficar parado.
            // TODOS os bichinhos do cômodo, avaliados a cada quadro.
            pets: (t) => {
              const saida = []
              for (const bicho of moradores) {
                const passo = passeios.current.get(bicho.id)
                if (!passo) continue
                const ativo = bicho.id === data.pet.id
                const forcado = ativo ? acaoDoBicho() : estadoDe(bicho)
                passearAte(passo, t, forcado !== null)
                saida.push({
                  ...bicho,
                  col: passo.col,
                  row: passo.row,
                  olhando: passo.olhando,
                  // Tres origens, nesta ordem: o que a tela mandou (carinho,
                  // doente), o que ele foi FAZER no movel (dormir na caminha,
                  // comer no pote) e, por ultimo, andar ou estar parado.
                  action: forcado || passo.acao || (passo.andando ? 'andar' : 'parado'),
                })
              }
              return conversar(saida)
            },
            items: [
              ...draft,
              ...room.mess.map((m) => ({ ...m, id: `mess-${m.id}`, w: 1, d: 1, mess: true })),
            ],
          }
        : null,
    [room, draft, aqui, data?.pet, data?.pets, moradores, reacao, voador]
  )

  async function save() {
    setSaving(true); setStatus(null)
    try { const result=await api.put(`/api/house/room/${room.code}/layout`,{revision:room.revision,floor:room.floor,wall:room.wall,items:draft.map(({code,col,row,dir=0})=>({code,col,row,dir}))}); setData((old)=>({...old,rooms:old.rooms.map((r)=>r.code===room.code?result.room:r)})); setDraft(result.room.items); setEditing(false); setStatus({kind:'ok',text:'A casa ficou assim para vocês dois.'}) }
    catch(e){ setStatus({kind:'error',text:e.message}); if(e.status===409) await load() }
    setSaving(false)
  }
  async function unlock(target) { try { const result=await api.post(`/api/house/room/${target.code}/unlock`); setBalance(result.balance); await load(); setRoomCode(target.code) } catch(e){setStatus({kind:'error',text:e.message})} }
  async function finish(kind,value) { const changed={...room,[kind]:value}; setData((old)=>({...old,rooms:old.rooms.map((r)=>r.code===room.code?changed:r)})) }
  function add(spec) {
    const originallyHere=(room.items||[]).filter((i)=>i.code===spec.code).length
    const elsewhere=Math.max(0,(spec.placed||0)-originallyHere)
    if(draft.filter((i)=>i.code===spec.code).length>=spec.owned-elsewhere) {
      setStatus({kind:'error',text:`Vocês só têm ${spec.owned} de ${spec.name}. Para usar outro, compre na loja.`}); return
    }
    for(let row=0;row<room.h;row++) for(let col=0;col<room.w;col++) if(fits({...spec,dir:0},col,row,room,draft)) { const id=`new-${Date.now()}`; setDraft([...draft,{...spec,id,col,row,dir:0}]); setSelectedId(id); return }
    setStatus({kind:'error',text:'Não achei espaço livre para esse móvel.'})
  }
  function rotateSelected() {
    if (!selected) return
    const spec=data.catalog.find((x)=>x.code===selected.code)
    const dir=(selected.dir+1)%4
    const turned={...selected,dir,w:dir%2?spec.d:spec.w,d:dir%2?spec.w:spec.d}
    const others=draft.filter((i)=>i.id!==selected.id)
    if(!fits(turned,turned.col,turned.row,room,others)) { setStatus({kind:'error',text:'Não dá para girar aqui: o móvel bateria em algo ou na parede.'}); return }
    setDraft(draft.map((i)=>i.id===selected.id?turned:i)); setStatus(null)
  }
  async function bringPet() {
    try { const result=await api.post('/api/pet/move',{room_code:room.code}); setData((old)=>({...old,pet:{...old.pet,...result.pet}})); setStatus({kind:'ok',text:`${result.pet.name} veio para ${room.name.toLowerCase()}.`}) }
    catch(e){setStatus({kind:'error',text:e.message})}
  }
  /**
   * Carinho no bichinho dentro do cômodo.
   *
   * Aqui estava o "não funciona": o botão chamava direto o carinho, que tem
   * descanso de 4 horas de propósito. Fora dessa janela o servidor recusava com
   * 400, a tela pintava um erro vermelho e **nada acontecia com o bicho** — o
   * botão parecia quebrado.
   *
   * O conserto não é tirar o descanso (ele existe pra o carinho não virar botão
   * sem consequência, que é decisão travada). O conserto é separar as duas
   * coisas: **a reação é sempre**, o **prêmio** é que tem hora. Encostar nele
   * sempre faz ele pular e soltar coraçãozinho; só a alegria é que não sobe
   * antes das 4 horas — e a tela diz isso sem parecer erro.
   */
  async function interactPet() {
    setReacao('happy')
    window.casalSound?.('pet', data.pet.species)
    setTimeout(() => setReacao(null), 1800)
    try {
      const result = await api.post('/api/pet/cuddle')
      setData((old) => ({ ...old, pet: { ...old.pet, ...result.pet } }))
      setStatus({ kind: 'ok', text: `${result.pet.name} adorou o carinho.` })
    } catch (e) {
      const descansando = e.status === 400 && /carinho/i.test(e.message || '')
      setStatus({
        kind: descansando ? 'warn' : 'error',
        text: descansando
          ? `${data.pet.name} retribuiu, mas já tinha ganhado carinho — o próximo rende de novo daqui a pouco.`
          : e.message,
      })
    }
  }
  /**
   * Reacoes ao TOQUE no bichinho dentro do comodo.
   *
   * Sorteadas, e nao uma so, porque uma reacao unica vira botao: na terceira vez
   * a pessoa ja sabe o que vai acontecer e para de encostar. `null` no fim
   * devolve o controle pro passeio.
   */
  const REACOES = ['feliz', 'brincar', 'pular', 'rolar', 'implorar']

  function cutucarNoComodo(tile) {
    if (!aqui || !passeio.current) return false

    // O acerto é medido em PIXEL, contra onde o bichinho está DESENHADO.
    //
    // A primeira versão comparava a célula do toque com a célula em que ele
    // pisa, e não funcionava: o corpo é colado uns 42 px ACIMA dessa célula
    // (ver `drawHousePet` em `room.js`). Quem toca no bichinho está tocando,
    // pela grade, num pedaço de chão duas ou três linhas atrás dele — e o toque
    // era descartado. Só pegava quem acertasse a sombra.
    const m = roomMetrics(room.w, room.h, WALL_HEIGHT)
    const [px, py] = project(passeio.current.col + 0.5, passeio.current.row + 0.5, 0.05, m.origin)
    const dentro =
      tile.x >= px - 30 && tile.x <= px + 30 &&
      tile.y >= py - 46 && tile.y <= py + 8
    if (!dentro) return false
    const acao = data.pet.sick ? 'triste' : REACOES[Math.floor(Math.random() * REACOES.length)]
    setReacao(acao)
    window.casalSound?.('pet', data.pet.species)
    clearTimeout(cutucarNoComodo.timer)
    cutucarNoComodo.timer = setTimeout(() => setReacao(null), 1800)
    return true
  }

  function pick(tile,_event,moving) {
    if(!editing) { if(!moving) cutucarNoComodo(tile); return }
    if(!moving){ const hit=[...draft].reverse().find((i)=>tile.col>=i.col&&tile.col<i.col+i.w&&tile.row>=i.row&&tile.row<i.row+i.d); dragging.current=hit?.id||null; setSelectedId(hit?.id||null); return }
    const id=dragging.current; if(!id)return
    const item=draft.find((i)=>i.id===id); const others=draft.filter((i)=>i.id!==id)
    const ok=fits(item,tile.col,tile.row,room,others); setHover({...tile,w:item.w,d:item.d,ok}); if(ok)setDraft(draft.map((i)=>i.id===id?{...i,col:tile.col,row:tile.row}:i))
  }

  // O que ele esta fazendo, em palavras. O estado ruim vem ANTES do movel
  // favorito: a legenda simpatica escondendo bichinho doente ja foi bug uma vez.
  function fraseDoBicho() {
    if (reacao) return {
      feliz: 'todo feliz com o carinho', happy: 'todo feliz com o carinho',
      brincar: 'querendo brincar com vocês', pular: 'pulando de alegria',
      rolar: 'rolando de barriga pra cima', implorar: 'pedindo mais atenção',
      triste: 'sem ânimo nem pra reagir',
    }[reacao] || 'reagindo ao carinho'
    if (data.pet.sick) return 'largado num canto, doente'
    if (data.pet.mood === 'faminto') return 'rondando o comedouro, com fome'
    if (data.pet.mood === 'imundo') return 'precisando muito de um banho'
    if (data.pet.mood === 'sonolento') return 'tirando uma soneca'
    if (data.pet.mood === 'triste') return 'quietinho, sentindo falta de vocês'
    if (room.mess.length > 2) return 'sem saber onde pisar, de tanta sujeira'
    // Nenhum estado ruim: agora da pra contar o que ele esta fazendo DE VERDADE,
    // que sai do proprio passeio (dormindo na caminha, cavucando a planta).
    return afazer || 'passeando pelo cômodo'
  }

  if(!data||!room||!scene) return <div className="full-center"><div className="spinner" /></div>
  const selected=draft.find((i)=>i.id===selectedId)

  return (
    <>
      <div className="row between">
        <h1 className="screen-title">Nossa casa</h1>
        <span className="pill mustard"><Icon name="heart" size={14}/>{data.balance}</span>
      </div>

      {/* Duas abas, um lugar de cada vez. */}
      <div className="vista-tabs">
        <button className={vista === 'fora' ? 'active' : ''} onClick={() => setVista('fora')}>
          Do lado de fora
        </button>
        <button className={vista === 'dentro' ? 'active' : ''} onClick={() => setVista('dentro')}>
          Por dentro
        </button>
      </div>

      {status&&<p className={`notice ${status.kind}`}>{status.text}</p>}

      {vista === 'fora' ? (
        <>
          {/* A fachada inteira e clicavel: e o jeito natural de "entrar". */}
          <div className="fachada" onClick={() => setVista('dentro')} role="button" tabIndex={0}
               onKeyDown={(e) => e.key === 'Enter' && setVista('dentro')}>
            <PropertyCanvas rooms={data.rooms}/>
            <span className="fachada-porta">Entrar em casa</span>
          </div>
          <p className="property-caption">
            Quintal, muro, portão, calçada e a rua em frente — o começo do bairro.
          </p>
          <div className="card">
            <p className="card-title">Como está a casa</p>
            <p className="muted small" style={{ margin: 0 }}>
              {data.rooms.filter((r) => r.unlocked && !r.outdoor).length} de{' '}
              {data.rooms.filter((r) => !r.outdoor).length} cômodos abertos
              {data.rooms.some((r) => r.mess?.length)
                ? ` · tem sujeira esperando em ${data.rooms.filter((r) => r.mess?.length).map((r) => r.name.toLowerCase()).join(', ')}`
                : ' · tudo limpo por aqui'}
              .
            </p>
          </div>
        </>
      ) : (
        <>
      <div className="room-tabs">{data.rooms.map((r)=><button key={r.code} className={roomCode===r.code?'active':''} onClick={()=>setRoomCode(r.code)}>{!r.unlocked&&<Icon name="lock" size={13}/>} {r.name}</button>)}</div>
      {!room.unlocked ? <div className="card center"><Icon name="lock" size={36}/><h2>{room.name} está fechado</h2><p className="muted">Abrir custa {room.unlock_price} Corações.</p><button className="btn btn-primary" onClick={()=>unlock(room)}>Abrir cômodo</button></div> : <>

      <div className="scene-frame">
        <RoomCanvas
          scene={scene}
          editing={editing}
          hover={hover}
          selectedId={selectedId}
          onPickTile={pick}
          onReleaseTile={()=>{dragging.current=null;setHover(null)}}
        />
      </div>
      {data.pet.chosen && (
        <div className="pet-at-home">
          <span>
            <strong>{data.pet.name}</strong>{' '}
            {aqui
              ? fraseDoBicho()
              : `está em ${data.rooms.find((r) => r.code === data.pet.room_code)?.name || 'outro cômodo'}`}
            .
          </span>
          {aqui ? (
            <button className="btn btn-sm" onClick={interactPet}>Fazer carinho</button>
          ) : (
            <button className="btn btn-sm" onClick={bringPet}>Chamar para cá</button>
          )}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>{editing?<><button className="btn btn-ghost" onClick={()=>{setDraft(room.items);setEditing(false)}}>Cancelar</button><button className="btn btn-primary grow" disabled={saving} onClick={save}><Icon name="check" size={17}/>Salvar para nós dois</button></>:<button className="btn btn-ghost grow" onClick={()=>setEditing(true)}><Icon name="palette" size={17}/>Arrastar e decorar</button>}
      </div>
      {editing&&<div className="house-editor card"><div className="finish-row"><label>Piso<select value={room.floor} onChange={(e)=>finish('floor',e.target.value)}>{data.floors.map((x)=><option key={x}>{x}</option>)}</select></label>{!room.outdoor&&<label>Parede<select value={room.wall} onChange={(e)=>finish('wall',e.target.value)}>{data.walls.map((x)=><option key={x}>{x}</option>)}</select></label>}</div>{selected&&<div className="selected-tools"><strong>{data.catalog.find((x)=>x.code===selected.code)?.name}</strong><button className="btn btn-sm" onClick={rotateSelected}>Girar</button><button className="btn btn-sm btn-danger" onClick={()=>{setDraft(draft.filter((i)=>i.id!==selected.id));setSelectedId(null)}}>Guardar</button></div>}<p className="card-title">Móveis de vocês</p><div className="furniture-tray">{data.catalog.filter((x)=>room.outdoor?x.subcategory==='quintal':x.subcategory!=='quintal').map((spec)=><button key={spec.code} onClick={()=>add(spec)}><ItemPreview item={{category:'house',metadata:{shape:spec.shape,width:spec.w,height:spec.d}}} scale={1}/><span>{spec.name}</span><small>{draft.filter((i)=>i.code===spec.code).length}/{spec.owned}</small></button>)}</div></div>}
      </>}
        </>
      )}
    </>
  )
}
