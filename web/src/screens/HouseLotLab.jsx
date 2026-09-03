// Bancada local da planta contínua. Não usa API nem sessão: existe para abrir
// a geometria real num telefone antes de publicar, inclusive portas e quintal.
import HouseLotCanvas from '../render/HouseLotCanvas'

const rooms = [
  { code:'sala', name:'Sala', x:0, y:0, w:10, h:8, unlocked:true, floor:'madeira', wall:'rosa', items:[{id:1,shape:'sofa',col:2,row:2,w:3,d:1,dir:0}], mess:[] },
  { code:'cozinha', name:'Cozinha', x:10, y:0, w:10, h:8, unlocked:true, floor:'ceramica', wall:'azul', items:[{id:2,shape:'fridge',col:6,row:1,w:1,d:1,dir:0}], mess:[] },
  { code:'quarto', name:'Quarto', x:0, y:8, w:10, h:8, unlocked:true, floor:'tapete', wall:'verde', items:[{id:3,shape:'bed',col:2,row:3,w:3,d:2,dir:0}], mess:[] },
  { code:'varanda', name:'Varanda', x:10, y:8, w:10, h:8, unlocked:true, floor:'pedra', wall:'padrao', items:[], mess:[] },
  { code:'quintal', name:'Quintal', x:0, y:0, w:14, h:10, outdoor:true, unlocked:true, floor:'grama', wall:'padrao', items:[{id:4,shape:'tree',col:9,row:5,w:2,d:2,dir:0}], mess:[] },
]
const doors = [
  {a:'sala',b:'cozinha',x:10,y:3,axis:'v'}, {a:'sala',b:'quarto',x:4,y:8,axis:'h'},
  {a:'cozinha',b:'varanda',x:14,y:8,axis:'h'}, {a:'quarto',b:'varanda',x:10,y:11,axis:'v'},
  {a:'varanda',b:'quintal',x:15,y:16,axis:'h'},
]
const pets = [{id:1,name:'Mimi',species:'gato',room_code:'varanda',stage:'adulto',growth:1,colors:['#f2a03d'],accessories:{},mood:'feliz'}]

export default function HouseLotLab() {
  return <main style={{maxWidth:520,margin:'0 auto',padding:12}}><h1>Nossa casa — bancada</h1><HouseLotCanvas rooms={rooms} doors={doors} activeRoom={rooms[0]} pets={pets}/></main>
}
