import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { drawItem } from './furniture'
import { tileDiamond, unproject } from './iso'
import { drawHousePet, drawMess } from './room'
import { Painter } from './pixel'
import { buildHousePlan, canStep, cellKey, findPath, freeCell } from './housePlan'
import { drawLotEdge, lotMetrics, makeLotFloor } from './houseLotRender'

export default function HouseLotCanvas({ rooms, doors=[], activeRoom, editing=false, hover, selectedId, onPickTile, onReleaseTile, pets=[] }) {
  const holderRef=useRef(null), canvasRef=useRef(null), walkers=useRef(new Map())
  const [scale,setScale]=useState(.25), [fullWalls,setFullWalls]=useState(false)
  const [fitScale,setFitScale]=useState(.25)
  const plan=useMemo(()=>buildHousePlan(rooms,doors),[rooms,doors])
  const metrics=useMemo(()=>lotMetrics(plan),[plan.cols,plan.rows])
  const floor=useMemo(()=>makeLotFloor(plan,metrics),[plan,metrics])
  const current=useRef(null)
  current.current={plan,metrics,floor,editing,hover,selectedId,activeRoom,pets,fullWalls}

  useLayoutEffect(()=>{
    const h=holderRef.current
    const measure=()=>{
      const fit=Math.min(1,h.clientWidth/metrics.width,h.clientHeight/metrics.height)
      setFitScale(fit); setScale(fit); h.scrollLeft=0; h.scrollTop=0
    }
    measure()
    const observer=new ResizeObserver(measure); observer.observe(h)
    return ()=>observer.disconnect()
  },[metrics.width,metrics.height])

  function zoom(value) {
    const h=holderRef.current, next=Math.max(fitScale,Math.min(2,value))
    const cx=(h.scrollLeft+h.clientWidth/2)/scale, cy=(h.scrollTop+h.clientHeight/2)/scale
    setScale(next)
    requestAnimationFrame(()=>{h.scrollLeft=cx*next-h.clientWidth/2;h.scrollTop=cy*next-h.clientHeight/2})
  }

  useEffect(()=>{
    const p=new Painter(canvasRef.current); p.resize(metrics.width,metrics.height)
    let frame=0, last=0
    function paint(t) {
      frame=requestAnimationFrame(paint)
      if(t-last<33) return
      const dt=Math.min(.08,(t-last)/1000); last=t
      const s=current.current, queue=[]
      p.ctx.drawImage(s.floor,0,0)
      for(const room of s.plan.rooms) {
        for(const item of room.items || []) queue.push({...item,col:room.x+item.col,row:room.y+item.row,roomCode:room.code})
        for(const mess of room.mess || []) queue.push({...mess,col:room.x+mess.col,row:room.y+mess.row,w:1,d:1,mess:true})
      }
      for(const edge of s.plan.edges) queue.push({edge,col:edge.x,row:edge.y,w:edge.axis==='v'?0:1,d:edge.axis==='v'?1:0})
      const live=new Set()
      for(const pet of s.pets.filter((p)=>p.species)) {
        live.add(pet.id)
        let walk=walkers.current.get(pet.id)
        if(!walk || walk.sourceRoom!==pet.room_code || !s.plan.cells.has(cellKey(...walk.cell)) || s.plan.occupied.has(cellKey(...walk.cell))) {
          const cell=freeCell(s.plan,pet.room_code)
          if(!cell) continue
          walk={cell,pos:[...cell],path:[],wait:t+500,step:0,sourceRoom:pet.room_code};walkers.current.set(pet.id,walk)
        }
        const frozen=pet.sick || pet.mood==='sonolento' || pet.reaction
        if(!frozen) {
          if(walk.path.length && !canStep(s.plan,walk.cell,walk.path[0])) {walk.path=[];walk.pos=[...walk.cell]}
          if(!walk.path.length && t>walk.wait) {
            const roomCode=s.plan.cells.get(cellKey(...walk.cell))
            const targets=s.plan.doors.flatMap((d)=>d.a===roomCode?[d.b]:d.b===roomCode?[d.a]:[])
            for(let n=0;n<targets.length;n++) {
              const target=freeCell(s.plan,targets[(walk.step+n)%targets.length])
              const path=target?findPath(s.plan,walk.cell,target):[]
              if(path.length>1) {walk.path=path.slice(1);walk.step++;break}
            }
            walk.wait=t+2200
          }
          if(walk.path.length) {
            const target=walk.path[0], dx=target[0]-walk.pos[0],dy=target[1]-walk.pos[1],dist=Math.hypot(dx,dy),step=dt*1.6
            if(dist<=step) {walk.cell=[...target];walk.pos=[...target];walk.path.shift();if(!walk.path.length)walk.wait=t+2200}
            else {walk.pos[0]+=dx/dist*step;walk.pos[1]+=dy/dist*step}
            walk.facing=dx-dy>=0?'direita':'esquerda'
          }
        }
        queue.push({...pet,_pet:true,col:walk.pos[0],row:walk.pos[1],w:1,d:1,olhando:walk.facing || 'direita',action:pet.sick?'doente':pet.mood==='sonolento'?'dormir':pet.reaction || (walk.path.length?'andar':'parado')})
      }
      for(const id of walkers.current.keys())if(!live.has(id))walkers.current.delete(id)
      // Paredes e portas dividem a fila de profundidade com os móveis.
      queue.sort((a,b)=>(a.col+a.row+(a.w+a.d)/2)-(b.col+b.row+(b.w+b.d)/2))
      for(const item of queue) {
        if(item.edge) drawLotEdge(p,item.edge,metrics.origin,s.fullWalls)
        else if(item._pet)drawHousePet(p,item,metrics.origin,t)
        else if(item.mess)drawMess(p,item,metrics.origin,t)
        else {
          if(s.editing && item.roomCode===s.activeRoom?.code && item.id===s.selectedId)
            for(let r=0;r<item.d;r++)for(let c=0;c<item.w;c++)p.fillPoly(tileDiamond(item.col+c,item.row+r,metrics.origin),'rgba(255,207,107,.5)')
          drawItem(p,item,metrics.origin,t)
        }
      }
      if(s.editing && s.hover) {
        const room=s.plan.byCode.get(s.hover.roomCode || s.activeRoom?.code)
        if(room) for(let r=0;r<s.hover.d;r++)for(let c=0;c<s.hover.w;c++)p.fillPoly(tileDiamond(room.x+s.hover.col+c,room.y+s.hover.row+r,metrics.origin,.02),s.hover.ok?'rgba(127,214,176,.5)':'rgba(255,107,107,.5)')
      }
    }
    paint(performance.now())
    return ()=>cancelAnimationFrame(frame)
  },[metrics])

  function target(e) {
    const rect=canvasRef.current.getBoundingClientRect()
    const x=(e.clientX-rect.left)*metrics.width/rect.width,y=(e.clientY-rect.top)*metrics.height/rect.height
    const [col,row]=unproject(x,y,metrics.origin), room=plan.byCode.get(plan.cells.get(cellKey(col,row)))
    if(!room)return null
    return {roomCode:room.code,col:col-room.x,row:row-room.y,x,y}
  }
  const drag=useRef(null)
  function down(e) {
    const tile=target(e), room=tile && plan.byCode.get(tile.roomCode)
    const hit=editing && room?.code===activeRoom?.code && room.items?.some((i)=>tile.col>=i.col&&tile.col<i.col+i.w&&tile.row>=i.row&&tile.row<i.row+i.d)
    const h=holderRef.current
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:h.scrollLeft,top:h.scrollTop,item:hit,tile}
    try{h.setPointerCapture(e.pointerId)}catch{/* ponteiro já encerrado */}
    if(hit)onPickTile?.(tile,e)
  }
  function move(e) {
    const d=drag.current;if(!d||d.id!==e.pointerId)return
    if(d.item) {const tile=target(e);if(tile)onPickTile?.(tile,e,true)}
    else {holderRef.current.scrollLeft=d.left-(e.clientX-d.x);holderRef.current.scrollTop=d.top-(e.clientY-d.y)}
  }
  function up(e) {
    const d=drag.current;drag.current=null
    if(d && !d.item && Math.hypot(e.clientX-d.x,e.clientY-d.y)<7 && d.tile)onPickTile?.(d.tile,e)
    onReleaseTile?.(target(e),e)
    try{holderRef.current.releasePointerCapture(e.pointerId)}catch{/* já solto */}
  }
  return <div className="lot-wrap">
    <div className="lot-toolbar">
      <button type="button" onClick={()=>{setScale(fitScale);holderRef.current.scrollLeft=0;holderRef.current.scrollTop=0}}>Ver lote</button>
      <button type="button" aria-label="Afastar casa" disabled={scale<=fitScale+.001} onClick={()=>zoom(scale/1.5)}>−</button>
      <span>{Math.round(scale*100)}%</span>
      <button type="button" aria-label="Aproximar casa" disabled={scale>=2} onClick={()=>zoom(scale*1.5)}>+</button>
      <button type="button" aria-pressed={fullWalls} onClick={()=>setFullWalls(!fullWalls)}>{fullWalls?'Paredes altas':'Paredes recortadas'}</button>
    </div>
    <div ref={holderRef} className={`lot-holder ${editing?'editando':''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e)=>{drag.current=null;onReleaseTile?.(null,e)}}>
      <div style={{minHeight:'100%',width:'max-content',minWidth:'100%',display:'flex',alignItems:'center'}}>
        <canvas ref={canvasRef} className="lot-canvas" aria-label="Planta da casa e quintal conectados" style={{width:metrics.width*scale,height:metrics.height*scale}}/>
      </div>
    </div>
    <div className="lot-hint">{editing?'Arraste um móvel; no chão vazio, mova a câmera':'Aproxime e arraste para explorar a casa'}</div>
  </div>
}
