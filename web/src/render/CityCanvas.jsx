import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { drawAvatar } from './avatar'
import { Painter, shade } from './pixel'
import {
  CITY_COLS,
  CITY_PLACES,
  CITY_ROWS,
  CITY_START,
  cityPath,
  cityPlaceAt,
  isCityWalkable,
  nearestCityWalkable,
} from './cityMap'

const TW = 40
const TH = 20
const TZ = 20
const WIDTH = (CITY_COLS + CITY_ROWS) * (TW / 2) + 48
const HEIGHT = (CITY_COLS + CITY_ROWS) * (TH / 2) + 190
const ORIGIN = { x: CITY_ROWS * (TW / 2) + 24, y: 140 }

const project = (x, y, z = 0) => [
  ORIGIN.x + (x - y) * (TW / 2),
  ORIGIN.y + (x + y) * (TH / 2) - z * TZ,
]

function unproject(sx, sy) {
  const dx = sx - ORIGIN.x
  const dy = sy - ORIGIN.y
  return [Math.floor(dy / TH + dx / TW), Math.floor(dy / TH - dx / TW)]
}

function diamond(x, y, z = 0) {
  return [project(x,y,z),project(x+1,y,z),project(x+1,y+1,z),project(x,y+1,z)]
}

function box(p, x, y, w, d, z, h, color, outline = '#3d3040') {
  const top = z + h
  const topFace=[project(x,y,top),project(x+w,y,top),project(x+w,y+d,top),project(x,y+d,top)]
  const left=[project(x,y+d,top),project(x+w,y+d,top),project(x+w,y+d,z),project(x,y+d,z)]
  const right=[project(x+w,y,top),project(x+w,y+d,top),project(x+w,y+d,z),project(x+w,y,z)]
  if (h) { p.fillPoly(left,shade(color,-.14));p.fillPoly(right,shade(color,-.3)) }
  p.fillPoly(topFace,shade(color,.12))
  if (outline) { p.strokePoly(topFace,outline);if(h){p.strokePoly(left,outline);p.strokePoly(right,outline)} }
}

function groundKind(x, y) {
  if ((x === 10 || x === 11) || (y === 8 || y === 9)) return 'road'
  if (isCityWalkable(x, y)) return 'path'
  return 'grass'
}

function drawTree(p, x, y, variant = 0) {
  box(p,x+.42,y+.42,.16,.16,0,.75,'#6c4b33')
  box(p,x+.13,y+.13,.74,.74,.65,.38,variant ? '#5a9855' : '#4d8b4c')
  box(p,x+.26,y+.26,.48,.48,1.03,.3,variant ? '#75ad62' : '#67a357')
}

function drawLamp(p, x, y) {
  box(p,x+.44,y+.44,.12,.12,0,1.1,'#4c4650')
  box(p,x+.29,y+.29,.42,.42,1.1,.16,'#f4cf73')
}

function drawBuilding(p, place) {
  if (place.outdoor) {
    for (let x=place.x;x<place.x+place.w;x++) for(let y=place.y;y<place.y+place.d;y++) {
      p.fillPoly(diamond(x,y,.02),(x+y)%2?'#82bd76':'#78b36e')
    }
    box(p,place.x+1.7,place.y+.8,1.4,1.4,0,.32,'#d7c5a1')
    box(p,place.x+2.15,place.y+1.25,.5,.5,.32,.55,'#78b6ce')
    return
  }
  box(p,place.x,place.y,place.w,place.d,0,1.7,place.color)
  box(p,place.x-.12,place.y-.12,place.w+.24,place.d+.24,1.7,.34,place.roof)
  // Porta na face voltada para a rua e duas janelas iluminadas.
  const faceY=place.y+place.d-.05
  box(p,place.x+place.w/2-.35,faceY,.7,.08,0,1.1,'#5b4138')
  box(p,place.x+.55,faceY+.03,.68,.07,.72,.52,'#bde0e5')
  box(p,place.x+place.w-1.23,faceY+.03,.68,.07,.72,.52,'#bde0e5')
}

function drawStatic(canvas) {
  const p=new Painter(canvas)
  p.resize(WIDTH,HEIGHT)
  p.clear('#bcdce8')
  // Horizonte e terreno. O céu fica visível acima dos telhados.
  p.rect(0,105,WIDTH,HEIGHT-105,'#9ac778')
  for (let sum=0;sum<CITY_COLS+CITY_ROWS;sum++) {
    for (let x=0;x<CITY_COLS;x++) {
      const y=sum-x
      if(y<0||y>=CITY_ROWS) continue
      const kind=groundKind(x,y)
      const color=kind==='road'?'#55545b':kind==='path'?'#d7c8aa':(x+y)%2?'#8abd6f':'#82b567'
      p.fillPoly(diamond(x,y),color)
      p.strokePoly(diamond(x,y),kind==='road'?'#67666d':'rgba(54,75,47,.18)')
      if(kind==='road' && ((x===10||x===11) && y%3===0)) {
        const [sx,sy]=project(x+.5,y+.5,.01);p.rect(sx-1,sy-2,3,5,'#d9c86d')
      }
    }
  }

  const scenery=[]
  for (const place of CITY_PLACES) scenery.push({depth:place.x+place.y+place.w+place.d,draw:()=>drawBuilding(p,place)})
  for (const [x,y,v] of [[.5,1,0],[1,7,1],[6,16,0],[20,4,1],[20,15,0],[13,16,1],[7,6,0],[19,10,1]]) scenery.push({depth:x+y+1,draw:()=>drawTree(p,x,y,v)})
  for (const [x,y] of [[9,3],[12,5],[8,10],[12,13]]) scenery.push({depth:x+y+1,draw:()=>drawLamp(p,x,y)})
  scenery.sort((a,b)=>a.depth-b.depth).forEach((item)=>item.draw())

  p.ctx.textAlign='center';p.ctx.textBaseline='bottom';p.ctx.font='800 13px "Baloo 2", sans-serif'
  for(const place of CITY_PLACES){
    const [x,y]=project(place.x+place.w/2,place.y,2.35)
    const width=Math.max(62,p.ctx.measureText(place.name).width+12)
    p.rect(x-width/2,y-18,width,18,'#fff8e8')
    p.ctx.fillStyle='#382d3c';p.ctx.fillText(place.name,x,y-3)
  }
}

function savedPosition() {
  try {
    const value=JSON.parse(localStorage.getItem('casal.city.position')||'null')
    if(Array.isArray(value)&&value.length===2&&isCityWalkable(value[0],value[1])) return value
  } catch { /* posicao inicial */ }
  return CITY_START
}

export default function CityCanvas({ avatar }) {
  const staticRef=useRef(null)
  const movingRef=useRef(null)
  const stateRef=useRef({position:savedPosition(),path:[],step:0,from:null,to:null,started:0,route:''})
  const navigate=useNavigate()

  useEffect(()=>{ drawStatic(staticRef.current) },[])

  useEffect(()=>{
    const canvas=movingRef.current
    const p=new Painter(canvas);p.resize(WIDTH,HEIGHT)
    let frame=0
    const render=(now)=>{
      const state=stateRef.current
      if(state.path.length>1 && state.step<state.path.length-1){
        if(!state.from){state.from=state.path[state.step];state.to=state.path[state.step+1];state.started=now}
        const progress=Math.min(1,(now-state.started)/170)
        state.position=[state.from[0]+(state.to[0]-state.from[0])*progress,state.from[1]+(state.to[1]-state.from[1])*progress]
        if(progress>=1){
          state.step+=1;state.position=[...state.to];state.from=null;state.to=null
          if(state.step>=state.path.length-1){
            try{localStorage.setItem('casal.city.position',JSON.stringify(state.position))}catch{/* sem espaco */}
            const route=state.route;state.route='';state.path=[]
            if(route) navigate(route)
          }
        }
      }
      p.clear()
      if(state.path.length){
        for(const cell of state.path.slice(state.step+1)){
          const [x,y]=project(cell[0]+.5,cell[1]+.5,.04);p.rect(x-2,y-2,5,4,'rgba(255,244,188,.8)')
        }
      }
      const [x,y]=project(state.position[0]+.5,state.position[1]+.5,.06)
      p.ctx.fillStyle='rgba(45,31,49,.28)';p.ctx.beginPath();p.ctx.ellipse(x,y+2,14,6,0,0,Math.PI*2);p.ctx.fill()
      if(avatar) drawAvatar(p,avatar,x-20,y-55)
      else { p.rect(x-7,y-30,14,25,'#e8879b');p.rect(x-9,y-40,18,14,'#f0c8ad') }
      frame=requestAnimationFrame(render)
    }
    frame=requestAnimationFrame(render)
    return()=>cancelAnimationFrame(frame)
  },[avatar,navigate])

  function walkTo(target, route='') {
    const current=nearestCityWalkable(Math.round(stateRef.current.position[0]),Math.round(stateRef.current.position[1]))
    const path=cityPath(current,target)
    stateRef.current={...stateRef.current,position:current,path,step:0,from:null,to:null,started:0,route}
    if(path.length<=1&&route) navigate(route)
  }

  function pointer(event) {
    const rect=event.currentTarget.getBoundingClientRect()
    const x=(event.clientX-rect.left)*(WIDTH/rect.width)
    const y=(event.clientY-rect.top)*(HEIGHT/rect.height)
    const cell=unproject(x,y)
    const place=cityPlaceAt(...cell)
    if(place) walkTo(place.door,place.route)
    else walkTo(nearestCityWalkable(...cell))
  }

  return (
    <div className="city-map" style={{aspectRatio:`${WIDTH}/${HEIGHT}`}}>
      <canvas ref={staticRef} width={WIDTH} height={HEIGHT} aria-hidden="true" />
      <canvas ref={movingRef} width={WIDTH} height={HEIGHT} onPointerUp={pointer} aria-label="Mapa do bairro; toque na rua para caminhar ou em um prédio para entrar" />
    </div>
  )
}
