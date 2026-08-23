import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api'
import RoomCanvas from '../render/RoomCanvas'
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
  const petScene = useMemo(() => {
    if (!room || !data?.pet?.chosen || data.pet.room_code !== room.code) return null
    const occupied = new Set()
    for (const item of draft) for (let r=item.row;r<item.row+item.d;r++) for (let c=item.col;c<item.col+item.w;c++) occupied.add(`${c}:${r}`)
    for (const mess of room.mess) occupied.add(`${mess.col}:${mess.row}`)
    const favorites = ['house_caminha_pet','house_comedouro','house_arranhador','house_casinha_pet','house_sofa']
    const friend = favorites.map((code)=>draft.find((item)=>item.code===code)).find(Boolean)
    const candidates = friend
      ? [[friend.col+friend.w,friend.row],[friend.col-1,friend.row],[friend.col,friend.row+friend.d],[friend.col,friend.row-1]]
      : [[Math.floor(room.w/2),Math.floor(room.h/2)]]
    let spot = candidates.find(([c,r])=>c>=0&&r>=0&&c<room.w&&r<room.h&&!occupied.has(`${c}:${r}`))
    if (!spot) for(let r=room.h-1;r>=0&&!spot;r--) for(let c=room.w-1;c>=0;c--) if(!occupied.has(`${c}:${r}`)){spot=[c,r];break}
    const activities = {
      house_caminha_pet:'tirando uma soneca na caminha', house_comedouro:'farejando o potinho',
      house_arranhador:'brincando no arranhador', house_casinha_pet:'descansando na casinha',
      house_sofa:'fazendo companhia no sofá',
    }
    return spot ? {...data.pet,col:spot[0],row:spot[1],w:1,d:1,activity:activities[friend?.code]||'explorando o cômodo'} : null
  }, [room, data?.pet, draft])
  const scene = useMemo(() => room ? { cols:room.w, rows:room.h, floor:room.floor, wall:room.wall, outdoor:room.outdoor, pet:petScene, items:[...draft,...room.mess.map((m)=>({...m,id:`mess-${m.id}`,w:1,d:1,mess:true}))] } : null,[room,draft,petScene])

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
  async function interactPet() {
    try { const result=await api.post('/api/pet/cuddle'); setData((old)=>({...old,pet:{...old.pet,...result.pet}})); window.casalSound?.('pet',result.pet.species); setStatus({kind:'ok',text:`${result.pet.name} veio brincar com você no cômodo.`}) }
    catch(e){setStatus({kind:'error',text:e.message})}
  }
  function pick(tile,_event,moving) {
    if(!editing) return
    if(!moving){ const hit=[...draft].reverse().find((i)=>tile.col>=i.col&&tile.col<i.col+i.w&&tile.row>=i.row&&tile.row<i.row+i.d); dragging.current=hit?.id||null; setSelectedId(hit?.id||null); return }
    const id=dragging.current; if(!id)return
    const item=draft.find((i)=>i.id===id); const others=draft.filter((i)=>i.id!==id)
    const ok=fits(item,tile.col,tile.row,room,others); setHover({...tile,w:item.w,d:item.d,ok}); if(ok)setDraft(draft.map((i)=>i.id===id?{...i,col:tile.col,row:tile.row}:i))
  }

  if(!data||!room||!scene) return <div className="full-center"><div className="spinner" /></div>
  const selected=draft.find((i)=>i.id===selectedId)

  return (
    <>
      <div className="row between"><h1 className="screen-title">Nossa casa</h1><span className="pill mustard"><Icon name="heart" size={14}/>{data.balance}</span></div>
      {status&&<p className={`notice ${status.kind}`}>{status.text}</p>}
      <PropertyCanvas rooms={data.rooms}/>
      <p className="property-caption">Quintal, muro, portão, calçada e a rua em frente — o começo do bairro.</p>

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
      {data.pet.chosen&&<div className="pet-at-home"><span><strong>{data.pet.name}</strong> {petScene ? petScene.activity : `está em ${data.rooms.find((r)=>r.code===data.pet.room_code)?.name||'outro cômodo'}`}.</span>{petScene?<button className="btn btn-sm" onClick={interactPet}>Interagir</button>:<button className="btn btn-sm" onClick={bringPet}>Chamar para cá</button>}</div>}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>{editing?<><button className="btn btn-ghost" onClick={()=>{setDraft(room.items);setEditing(false)}}>Cancelar</button><button className="btn btn-primary grow" disabled={saving} onClick={save}><Icon name="check" size={17}/>Salvar para nós dois</button></>:<button className="btn btn-ghost grow" onClick={()=>setEditing(true)}><Icon name="palette" size={17}/>Arrastar e decorar</button>}
      </div>
      {editing&&<div className="house-editor card"><div className="finish-row"><label>Piso<select value={room.floor} onChange={(e)=>finish('floor',e.target.value)}>{data.floors.map((x)=><option key={x}>{x}</option>)}</select></label>{!room.outdoor&&<label>Parede<select value={room.wall} onChange={(e)=>finish('wall',e.target.value)}>{data.walls.map((x)=><option key={x}>{x}</option>)}</select></label>}</div>{selected&&<div className="selected-tools"><strong>{data.catalog.find((x)=>x.code===selected.code)?.name}</strong><button className="btn btn-sm" onClick={rotateSelected}>Girar</button><button className="btn btn-sm btn-danger" onClick={()=>{setDraft(draft.filter((i)=>i.id!==selected.id));setSelectedId(null)}}>Guardar</button></div>}<p className="card-title">Móveis de vocês</p><div className="furniture-tray">{data.catalog.filter((x)=>room.outdoor?x.subcategory==='quintal':x.subcategory!=='quintal').map((spec)=><button key={spec.code} onClick={()=>add(spec)}><ItemPreview item={{category:'house',metadata:{shape:spec.shape,width:spec.w,height:spec.d}}} scale={1}/><span>{spec.name}</span><small>{draft.filter((i)=>i.code===spec.code).length}/{spec.owned}</small></button>)}</div></div>}
      </>}
    </>
  )
}
