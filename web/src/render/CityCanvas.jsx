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

function pointOnRoute(route, distance) {
  const lengths = route.map((point, index) => index
    ? Math.hypot(point[0] - route[index - 1][0], point[1] - route[index - 1][1])
    : 0)
  const total = lengths.reduce((sum, value) => sum + value, 0)
  let remaining = ((distance % total) + total) % total
  for (let i = 1; i < route.length; i++) {
    if (remaining <= lengths[i]) {
      const f = lengths[i] ? remaining / lengths[i] : 0
      return [
        route[i - 1][0] + (route[i][0] - route[i - 1][0]) * f,
        route[i - 1][1] + (route[i][1] - route[i - 1][1]) * f,
      ]
    }
    remaining -= lengths[i]
  }
  return route[0]
}

const PARTNER_ROUTE = [[10,10],[10,8],[5,8],[10,8],[10,4],[10,8],[17,8],[10,8],[10,15],[10,10]]
const WALKERS = [
  { route:[[2,9],[9,9],[11,9],[18,9],[11,9],[2,9]], speed:.00075, phase:1, color:'#7b79b8' },
  { route:[[11,1],[11,7],[11,9],[11,16],[11,9],[11,1]], speed:.00062, phase:7, color:'#d78362' },
  { route:[[6,8],[10,8],[10,12],[10,8],[15,8],[10,8],[6,8]], speed:.00058, phase:13, color:'#5c9c7a' },
]

function drawPerson(p, x, y, color, now, seed = 0) {
  const [sx,sy]=project(x+.5,y+.5,.04)
  const bob=Math.sin(now/105+seed)*1.2
  p.ctx.fillStyle='rgba(45,31,49,.2)';p.ctx.beginPath();p.ctx.ellipse(sx,sy+2,8,3,0,0,Math.PI*2);p.ctx.fill()
  p.rect(sx-4,sy-19+bob,8,14,color)
  p.rect(sx-5,sy-27+bob,10,9,'#e7bca1')
  p.rect(sx-4,sy-5,3,6,'#443a45');p.rect(sx+1,sy-5,3,6,'#443a45')
}

function drawCar(p, x, y, axis, color) {
  const w=axis==='x'?1.35:.72, d=axis==='x'?.72:1.35
  box(p,x,y,w,d,.04,.34,color)
  box(p,x+.2,y+.13,Math.max(.3,w-.4),Math.max(.3,d-.26),.38,.22,'#b9dae1')
}

function drawSkyLife(p, now) {
  // Nuvens em coordenada de tela: lentas e atrás de tudo que anda no chão.
  for (let i=0;i<3;i++) {
    const x=((now*.006+i*310)%(WIDTH+130))-70
    const y=24+i*23
    p.rect(x,y+7,54,9,'rgba(255,255,255,.72)')
    p.rect(x+10,y,20,13,'rgba(255,255,255,.72)')
    p.rect(x+29,y+3,16,11,'rgba(255,255,255,.72)')
  }
  for (let i=0;i<4;i++) {
    const x=((now*.018+i*183)%(WIDTH+40))-20, y=42+(i%2)*24+Math.sin(now/500+i)*4
    p.line(x-4,y,x,y-3,'#554b5b');p.line(x,y-3,x+4,y,'#554b5b')
  }
}

function drawPlazaLife(p, now) {
  const center=project(17.4,7.5,.86)
  for(let i=0;i<3;i++){
    const phase=now/260+i*2.1
    p.rect(center[0]+Math.sin(phase)*8-1,center[1]-9-Math.abs(Math.cos(phase))*13,3,5,'rgba(205,246,255,.8)')
  }
  // Folhas cruzando a praça: poucas, determinísticas e baratas.
  for(let i=0;i<5;i++){
    const x=((now*.012+i*71)%190)+WIDTH*.48, y=230+((now*.008+i*43)%115)
    p.rect(x,y,3,2,i%2?'#6fa35b':'#d9a74b')
  }
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
  const hour=new Date().getHours(), night=hour<6||hour>=19
  p.clear(night?'#506486':'#bcdce8')
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

export default function CityCanvas({ avatar, partnerAvatar, partnerName='' }) {
  const staticRef=useRef(null)
  const movingRef=useRef(null)
  const stateRef=useRef({position:savedPosition(),path:[],step:0,from:null,to:null,started:0,route:''})
  const navigate=useNavigate()

  useEffect(()=>{ drawStatic(staticRef.current) },[])

  useEffect(()=>{
    const canvas=movingRef.current
    const p=new Painter(canvas);p.resize(WIDTH,HEIGHT)
    let frame=0, alive=true, reported=false
    const render=(now)=>{
      if(!alive)return
      try {
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
      drawSkyLife(p,now)
      drawPlazaLife(p,now)
      if(state.path.length){
        for(const cell of state.path.slice(state.step+1)){
          const [x,y]=project(cell[0]+.5,cell[1]+.5,.04);p.rect(x-2,y-2,5,4,'rgba(255,244,188,.8)')
        }
      }
      const actors=[]
      // Carros usam somente as duas pistas, em sentidos e velocidades diferentes.
      const carX=((now*.0042)%25)-2
      const carY=((now*.0035+9)%22)-2
      actors.push({depth:carX+8.2,draw:()=>drawCar(p,carX,8.16,'x','#d86e78')})
      actors.push({depth:10.16+carY,draw:()=>drawCar(p,10.16,carY,'y','#e2b84f')})
      for(const walker of WALKERS){
        const pos=pointOnRoute(walker.route,now*walker.speed+walker.phase)
        actors.push({depth:pos[0]+pos[1],draw:()=>drawPerson(p,pos[0],pos[1],walker.color,now,walker.phase)})
      }
      if(partnerAvatar){
        const pos=pointOnRoute(PARTNER_ROUTE,now*.00048+4)
        actors.push({depth:pos[0]+pos[1],draw:()=>{
          const [px,py]=project(pos[0]+.5,pos[1]+.5,.06), bob=Math.sin(now/110)*1.2
          p.ctx.fillStyle='rgba(45,31,49,.24)';p.ctx.beginPath();p.ctx.ellipse(px,py+2,12,5,0,0,Math.PI*2);p.ctx.fill()
          drawAvatar(p,partnerAvatar,px-20,py-55+bob)
          if(partnerName){p.ctx.textAlign='center';p.ctx.font='800 10px "Nunito", sans-serif';p.ctx.fillStyle='#fff8e8';p.ctx.fillText(partnerName,px,py-58+bob)}
        }})
      }
      const [x,y]=project(state.position[0]+.5,state.position[1]+.5,.06)
      actors.push({depth:state.position[0]+state.position[1]+.01,draw:()=>{
        const bob=state.path.length?Math.sin(now/85)*1.4:0
        p.ctx.fillStyle='rgba(45,31,49,.28)';p.ctx.beginPath();p.ctx.ellipse(x,y+2,14,6,0,0,Math.PI*2);p.ctx.fill()
        if(avatar) drawAvatar(p,avatar,x-20,y-55+bob)
        else { p.rect(x-7,y-30,14,25,'#e8879b');p.rect(x-9,y-40,18,14,'#f0c8ad') }
      }})
      actors.sort((a,b)=>a.depth-b.depth).forEach((actor)=>actor.draw())
      } catch (error) {
        // Um ator nunca pode matar a cidade inteira. O primeiro erro continua
        // visível no console para diagnóstico, mas o quadro seguinte acontece.
        if(!reported){reported=true;console.error('Falha ao desenhar a cidade',error)}
      }
      if(alive)frame=requestAnimationFrame(render)
    }
    // Há navegadores que suspendem requestAnimationFrame fora da aba. Um quadro
    // síncrono impede a camada móvel de nascer vazia até o próximo foco.
    render(performance.now())
    return()=>{alive=false;cancelAnimationFrame(frame)}
  },[avatar,partnerAvatar,partnerName,navigate])

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
