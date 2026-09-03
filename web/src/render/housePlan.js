// Geometria única para piso, paredes, portas, toque e navegação.
export const cellKey = (x, y) => `${x}:${y}`
export const edgeKey = (a, b) => [cellKey(...a), cellKey(...b)].sort().join('|')

export function buildHousePlan(source, sourceDoors = []) {
  const yard = source.find((r) => r.outdoor && r.unlocked)
  const offset = yard?.w || 0
  // Quintal encostado à sala desde o primeiro desbloqueio, sem depender da
  // segunda fileira da casa. Coordenadas locais dos móveis não são migradas.
  const rooms = source.filter((r) => r.unlocked).map((r) => ({ ...r,
    x: r.outdoor ? 0 : offset + r.x, y: r.outdoor ? 0 : r.y,
  }))
  const byCode = new Map(rooms.map((r) => [r.code, r]))
  const cols = Math.max(1, ...rooms.map((r) => r.x + r.w))
  const rows = Math.max(1, ...rooms.map((r) => r.y + r.h))
  const cells = new Map()
  const occupied = new Set()
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) cells.set(cellKey(x, y), room.code)
    for (const item of [...(room.items || []), ...(room.mess || []).map((m) => ({ ...m, w: 1, d: 1 }))]) {
      for (let y = 0; y < item.d; y++) for (let x = 0; x < item.w; x++) occupied.add(cellKey(room.x + item.col + x, room.y + item.row + y))
    }
  }
  // Áreas ainda não construídas continuam sendo gramado do lote, não um
  // buraco no mundo. Isso também atende desbloqueios fora da ordem sugerida.
  if (yard) for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    if(!cells.has(cellKey(x,y)))cells.set(cellKey(x,y),yard.code)
  }
  const doors = sourceDoors.filter((d) => ![d.a, d.b].includes(yard?.code) && byCode.has(d.a) && byCode.has(d.b)).map((d) => ({ ...d, x: offset + d.x }))
  if (yard) for (const room of rooms.filter((r)=>!r.outdoor)) {
    const y=room.y+Math.floor(room.h/2)
    if(cells.get(cellKey(room.x-1,y))===yard.code)
      doors.push({a:yard.code,b:room.code,x:room.x,y,axis:'v',exterior:true})
  }
  for (const door of doors) {
    door.before = door.axis === 'v' ? [door.x - 1, door.y] : [door.x, door.y - 1]
    door.after = [door.x, door.y]
    door.key = edgeKey(door.before, door.after)
  }
  const portals = new Map(doors.map((d) => [d.key, d]))
  const edges = new Map()
  for (const room of rooms.filter((r) => !r.outdoor)) {
    const add = (axis, x, y, negative) => {
      const before = axis === 'v' ? [x - 1, y] : [x, y - 1]
      const after = [x, y]
      const key = edgeKey(before, after)
      if (edges.has(key)) return
      const otherCode = cells.get(cellKey(...(negative ? before : after)))
      const internal = otherCode && !byCode.get(otherCode)?.outdoor
      edges.set(key, { key, axis, x, y, style: room.wall, door: portals.get(key),
        // Cutaway: só as paredes de trás permanecem altas. As da frente e
        // divisórias viram rodapé espesso, jamais um painel caído sobre o piso.
        height: negative && !internal ? 2.4 : 0.18,
      })
    }
    for (let y = room.y; y < room.y + room.h; y++) { add('v', room.x, y, true); add('v', room.x + room.w, y, false) }
    for (let x = room.x; x < room.x + room.w; x++) { add('h', x, room.y, true); add('h', x, room.y + room.h, false) }
  }
  return { rooms, byCode, cells, occupied, doors, edges: [...edges.values()], portals,
    cols, rows,
  }
}

export function canStep(plan, a, b) {
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false
  const ca = plan.cells.get(cellKey(...a)), cb = plan.cells.get(cellKey(...b))
  return !!ca && !!cb && !plan.occupied.has(cellKey(...b)) && (ca === cb || plan.portals.has(edgeKey(a, b)))
}

export function findPath(plan, start, target) {
  const end = cellKey(...target), startKey = cellKey(...start)
  if (!plan.cells.has(startKey) || !plan.cells.has(end) || plan.occupied.has(end)) return []
  const queue = [start], parents = new Map([[startKey, null]])
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i], key = cellKey(...a)
    if (key === end) {
      const path = []; let at = a
      while (at) { path.push(at); at = parents.get(cellKey(...at)) }
      return path.reverse()
    }
    for (const b of [[a[0]+1,a[1]], [a[0]-1,a[1]], [a[0],a[1]+1], [a[0],a[1]-1]]) {
      const k = cellKey(...b)
      if (!parents.has(k) && canStep(plan, a, b)) { parents.set(k, a); queue.push(b) }
    }
  }
  return []
}

export function freeCell(plan, code) {
  const room = plan.byCode.get(code) || plan.rooms[0]
  if (!room) return null
  const center = [room.x + (room.w - 1)/2, room.y + (room.h - 1)/2]
  let best = null, dist = Infinity
  for (let y=room.y; y<room.y+room.h; y++) for (let x=room.x; x<room.x+room.w; x++) {
    if (plan.occupied.has(cellKey(x,y))) continue
    const d = Math.abs(x-center[0])+Math.abs(y-center[1])
    if (d<dist) { best=[x,y]; dist=d }
  }
  return best
}
