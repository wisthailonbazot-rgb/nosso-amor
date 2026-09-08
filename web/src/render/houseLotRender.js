import { isoBox, project, roomMetrics, tileDiamond } from './iso'
import { drawFloor, WALL_STYLES } from './room'
import { Painter, shade } from './pixel'

export function lotMetrics(plan) {
  const m = roomMetrics(plan.cols, plan.rows, 3)
  return { width: m.width + 96, height: m.height + 72, origin: { x: m.origin.x + 48, y: m.origin.y + 24 } }
}
export function makeLotFloor(plan, metrics, fullWalls=false) {
  const canvas = document.createElement('canvas')
  canvas.width = metrics.width; canvas.height = metrics.height
  const p = new Painter(canvas); p.clear('#dae4ce')
  for (let y=0; y<plan.rows; y++) for (let x=0; x<plan.cols; x++) {
    const road=y>=plan.rows-4, walk=y>=plan.rows-6&&!road
    p.fillPoly(tileDiamond(x,y,metrics.origin),road?'#555b64':walk?((x+y)%2?'#d8d0c2':'#c9c1b4'):((x+y)%2?'#8eb477':'#86aa70'))
  }
  // Paisagem do lote: lago, canteiros, caminho da casa e faixa da rua.
  for(let y=5;y<9;y++)for(let x=1;x<5;x++)p.fillPoly(tileDiamond(x,y,metrics.origin,.01),(x+y)%2?'#67abc0':'#75bdd0')
  for(let x=4;x<9;x++)p.fillPoly(tileDiamond(x,22,metrics.origin,.01),'#cfbea2')
  for(let y=22;y<28;y++)p.fillPoly(tileDiamond(7,y,metrics.origin,.01),'#cfbea2')
  for(let x=2;x<8;x++)for(let y=14;y<16;y++)p.fillPoly(tileDiamond(x,y,metrics.origin,.01),(x+y)%2?'#6f9255':'#789d5c')
  for (const room of plan.rooms) {
    const [x,y] = project(room.x, room.y, 0, metrics.origin)
    drawFloor(p, room.w, room.h, {x,y}, room.floor || (room.outdoor ? 'grama' : 'padrao'))
  }
  for (const d of plan.doors.filter((d) => d.exterior)) {
    const [bx,by]=d.before
    if(plan.byCode.get(plan.cells.get(`${bx}:${by}`))?.outdoor)p.fillPoly(tileDiamond(bx,by,metrics.origin,.02), '#d3c2a6')
  }
  // Paredes são fundo estático. Rodapés ficam sob os móveis; assim nunca
  // atravessam sofá, cama ou item sendo arrastado.
  for(const edge of [...plan.edges].sort((a,b)=>(a.x+a.y)-(b.x+b.y)))drawLotEdge(p,edge,metrics.origin,fullWalls)
  // Nome no próprio piso elimina ambiguidade entre aba e cômodo.
  p.ctx.textAlign='center';p.ctx.textBaseline='middle';p.ctx.font='700 20px "Baloo 2", sans-serif'
  for(const room of plan.rooms.filter(r=>!r.outdoor)) {
    const [x,y]=project(room.x+room.w/2,room.y+room.h/2,.03,metrics.origin)
    p.ctx.fillStyle='rgba(255,255,255,.76)';p.ctx.fillText(room.name,x+1,y+1)
    p.ctx.fillStyle='rgba(54,40,49,.62)';p.ctx.fillText(room.name,x,y)
  }
  // Arbustos e flores fora da área decorável dão contorno sem disputar espaço.
  for(const [x,y,c] of [[2,14,'#628e50'],[4,16,'#6e9d59'],[31,5,'#628e50'],[33,7,'#729f58'],[3,24,'#648f50'],[31,24,'#6b9852']]) {
    block(p,metrics.origin,c,x+.15,y+.15,.7,.7,.45)
    const [fx,fy]=project(x+.5,y+.5,.5,metrics.origin);p.solid(fx-2,fy-2,4,4,(x+y)%2?'#f4a0b8':'#f4d565','#4e6e42')
  }
  return canvas
}
function block(p, origin, color, col, row, w, d, h, z=0) {
  isoBox(p, {top:shade(color,.12),left:shade(color,-.1),right:shade(color,-.26)}, {col,row,w,d,h,z}, origin, shade(color,-.5))
}
export function drawLotEdge(p, edge, origin, fullWalls=false) {
  const {x,y,axis,style,door} = edge, vertical = axis === 'v'
  const base = (WALL_STYLES[style] || WALL_STYLES.padrao).base
  const h = fullWalls ? 2.4 : edge.height
  if (!door) {
    block(p,origin,base, x-(vertical?.07:0),y-(vertical?0:.07),vertical?.14:1,vertical?1:.14,h)
    return
  }
  // O vão não tem parede; batentes, verga e folha aberta são volumes próprios.
  const post = (along) => block(p,origin,'#a47b54',x+(vertical?-.09:along),y+(vertical?along:-.09),.18,.18,2.05)
  post(-.06); post(.88)
  block(p,origin,'#ba9165',x-(vertical?.09:.06),y-(vertical?.06:.09),vertical?.18:1.12,vertical?1.12:.18,.16,1.94)
  block(p,origin,'#d6c5a4',x-(vertical?.13:0),y-(vertical?0:.13),vertical?.26:1,vertical?1:.26,.035)
  const points = vertical ? [[x+.08,y+.10],[x+.77,y+.20]] : [[x+.10,y+.08],[x+.20,y+.77]]
  const [a,b] = points
  const quad = [project(...a,1.83,origin),project(...b,1.83,origin),project(...b,.04,origin),project(...a,.04,origin)]
  p.fillPoly(quad,'#c49a6c'); p.strokePoly(quad,'#79573e')
  const [hx,hy]=project(b[0],b[1],.9,origin)
  p.solid(hx-2,hy-2,4,4,'#efca64','#6f5132')
}
