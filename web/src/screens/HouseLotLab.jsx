// Bancada local da planta contínua. Não usa API nem sessão: existe para abrir
// a geometria real num telefone antes de publicar, inclusive portas e quintal.
import HouseLotCanvas from '../render/HouseLotCanvas'
import { useState } from 'react'

const rooms = [
  { code:'sala', name:'Sala', x:8, y:18, w:10, h:8, unlocked:true, floor:'madeira', wall:'rosa', items:[{id:1,shape:'sofa',col:2,row:2,w:3,d:1,dir:0}], mess:[] },
  { code:'cozinha', name:'Cozinha', x:8, y:10, w:10, h:8, unlocked:true, floor:'ceramica', wall:'azul', items:[{id:2,shape:'fridge',col:6,row:1,w:1,d:2,dir:0}], mess:[] },
  { code:'quarto', name:'Quarto', x:18, y:18, w:10, h:8, unlocked:true, floor:'tapete', wall:'verde', items:[{id:3,shape:'bed',col:2,row:3,w:3,d:2,dir:0}], mess:[] },
  { code:'varanda', name:'Varanda', x:18, y:10, w:10, h:8, unlocked:true, floor:'pedra', wall:'padrao', items:[], mess:[] },
  { code:'quintal', name:'Quintal', x:8, y:0, w:14, h:10, outdoor:true, unlocked:true, floor:'grama', wall:'padrao', items:[{id:4,shape:'tree',col:9,row:5,w:2,d:2,dir:0}], mess:[] },
]
const doors = [
  {a:'sala',b:'cozinha',x:12,y:18,axis:'h'}, {a:'sala',b:'quarto',x:18,y:21,axis:'v'},
  {a:'cozinha',b:'varanda',x:18,y:13,axis:'v'}, {a:'quarto',b:'varanda',x:22,y:18,axis:'h'},
  {a:'varanda',b:'quintal',x:21,y:10,axis:'h'}, {a:'sala',b:'quintal',x:8,y:22,axis:'v'},
  {a:'cozinha',b:'quintal',x:12,y:10,axis:'h'}, {a:'quarto',b:'quintal',x:28,y:22,axis:'v'},
]
const pets = [{id:1,name:'Mimi',species:'gato',room_code:'varanda',stage:'adulto',growth:1,colors:['#f2a03d'],accessories:{},mood:'feliz'}]

export default function HouseLotLab() {
  const [stage,setStage]=useState(1)
  const shown=rooms.map((r,i)=>({...r,unlocked:r.outdoor || i<stage}))
  return <main style={{maxWidth:1100,margin:'0 auto',padding:12}}><h1>Nossa casa — bancada</h1>
    <div className="room-tabs">{[1,2,4].map((n)=><button key={n} onClick={()=>setStage(n)}>{n===1?'Inicial':n===2?'Parcial':'Completa'}</button>)}</div>
    <HouseLotCanvas rooms={shown} doors={doors} activeRoom={shown[0]} pets={pets.map((p)=>({...p,room_code:'sala'}))}/></main>
}
