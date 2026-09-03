import assert from 'node:assert/strict'
import {buildHousePlan, canStep, cellKey, findPath, freeCell} from './src/render/housePlan.js'

const rooms = [
  {code:'sala',x:0,y:0,w:10,h:8},
  {code:'cozinha',x:10,y:0,w:10,h:8},
  {code:'quarto',x:0,y:8,w:10,h:8},
  {code:'varanda',x:10,y:8,w:10,h:8},
  {code:'quintal',x:0,y:0,w:14,h:10,outdoor:true},
]
const doors = [
  {a:'sala',b:'cozinha',x:10,y:3,axis:'v'},
  {a:'sala',b:'quarto',x:4,y:8,axis:'h'},
  {a:'cozinha',b:'varanda',x:14,y:8,axis:'h'},
  {a:'quarto',b:'varanda',x:10,y:11,axis:'v'},
]
for(let mask=0;mask<8;mask++) {
  const source=rooms.map((r,i)=>({...r,unlocked:i===0||i===4||!!(mask&(1<<(i-1)))}))
  const p=buildHousePlan(source,doors)
  assert.equal(new Set(p.edges.map(e=>e.key)).size,p.edges.length,'parede duplicada')
  assert.equal(p.cells.size,p.cols*p.rows,'buraco no piso')
  assert.ok(p.doors.some(d=>d.exterior),'sem acesso ao quintal')
  for(const door of p.doors) {
    assert.deepEqual(new Set([p.cells.get(cellKey(...door.before)),p.cells.get(cellKey(...door.after))]),new Set([door.a,door.b]))
    assert.equal(p.edges.filter(e=>e.key===door.key&&e.door).length,1,'porta sem abertura na parede')
    assert.ok(canStep(p,door.before,door.after))
  }
  for(const room of p.rooms) {
    const path=findPath(p,freeCell(p,'sala'),freeCell(p,room.code))
    assert.ok(path.length,`sem caminho para ${room.code}, mask=${mask}`)
    for(let n=1;n<path.length;n++)assert.ok(canStep(p,path[n-1],path[n]))
  }
  for(const edge of p.edges.filter(e=>!e.door)) {
    const a=edge.axis==='v'?[edge.x-1,edge.y]:[edge.x,edge.y-1]
    assert.equal(canStep(p,a,[edge.x,edge.y]),false,'atravessou parede')
  }
}
const p=buildHousePlan(rooms.map(r=>({...r,unlocked:true,items:r.code==='sala'?[{col:2,row:2,w:3,d:2}]:[]})),doors)
const sala=p.byCode.get('sala')
assert.deepEqual(findPath(p,freeCell(p,'sala'),[sala.x+2,2]),[],'entrou no movel')
const path=findPath(p,[sala.x,2],[sala.x+6,2])
assert.ok(path.length>7,'nao desviou do movel')
assert.ok(path.every(c=>!p.occupied.has(cellKey(...c))))
assert.equal(canStep(p,[sala.x,0],[sala.x+1,1]),false,'passo diagonal')
console.log('Geometria OK: 8 combinacoes de ampliacao, pisos, paredes, portas, caminhos e colisao.')
