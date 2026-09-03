import { isoBox, project, roomMetrics, tileDiamond } from './iso'
import { drawFloor, WALL_STYLES } from './room'
import { Painter, shade } from './pixel'

export function lotMetrics(plan) {
  const m = roomMetrics(plan.cols, plan.rows, 3)
  return { width: m.width + 96, height: m.height + 72, origin: { x: m.origin.x + 48, y: m.origin.y + 24 } }
}
export function makeLotFloor(plan, metrics) {
  const canvas = document.createElement('canvas')
  canvas.width = metrics.width; canvas.height = metrics.height
  const p = new Painter(canvas); p.clear('#dae4ce')
  for (let y=0; y<plan.rows; y++) for (let x=0; x<plan.cols; x++) p.fillPoly(tileDiamond(x,y,metrics.origin), '#89aa76')
  for (const room of plan.rooms) {
    const [x,y] = project(room.x, room.y, 0, metrics.origin)
    drawFloor(p, room.w, room.h, {x,y}, room.floor || (room.outdoor ? 'grama' : 'padrao'))
  }
  for (const d of plan.doors.filter((d) => d.exterior)) {
    for (let x=d.x-3; x<d.x; x++) p.fillPoly(tileDiamond(x,d.y,metrics.origin,.01), '#d3c2a6')
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
