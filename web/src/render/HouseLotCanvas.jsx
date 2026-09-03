import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { drawItem } from './furniture'
import { depthSort, project, roomMetrics, tileDiamond, unproject } from './iso'
import { drawFloor, drawHousePet, FLOOR_STYLES, WALL_HEIGHT, WALL_STYLES } from './room'
import { Painter, shade } from './pixel'

// A casa inteira vive nesta grade. O quintal começa onde termina a planta
// interna: não é mais outro cenário, é o chão do mesmo lote.
const LOT_COLS = 20
const LOT_ROWS = 26
const YARD_Y = 16

function lugar(room) {
  return room.outdoor ? { x: 3, y: YARD_Y } : { x: room.x, y: room.y }
}

function portaEntre(doors, a, b) {
  return doors.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a))
}

function petPosition(pet, rooms, doors, t) {
  const open = new Map(rooms.filter((r) => r.unlocked).map((r) => [r.code, r]))
  let from = open.get(pet.room_code || 'sala') || open.get('sala')
  if (!from) return null
  const linksFrom = (room) => doors.filter((d) => (d.a === room.code && open.has(d.b)) || (d.b === room.code && open.has(d.a)))
  if (!linksFrom(from).length) {
    const p = lugar(from)
    return { col: p.x + from.w / 2, row: p.y + from.h / 2, olhando: 'direita' }
  }
  const cycle = 18000
  const seed = Number(pet.id || 0) * 7919
  const turn = Math.floor((t + seed) / cycle)
  const progress = ((t + seed) % cycle) / cycle
  // Os outros bichinhos também mudam de cômodo, não só o ativo. Calculamos o
  // passeio na própria planta para não depender de uma rota de API por animal.
  // A janela de 32 passos evita crescer para sempre numa aba aberta por dias.
  for (let step = 0; step < (turn % 32); step++) {
    const links = linksFrom(from)
    if (!links.length) break
    const link = links[(step + Number(pet.id || 0)) % links.length]
    from = open.get(link.a === from.code ? link.b : link.a) || from
  }
  const links = linksFrom(from)
  if (!links.length) {
    const p = lugar(from)
    return { col: p.x + from.w / 2, row: p.y + from.h / 2, olhando: 'direita' }
  }
  const door = links[(turn + Number(pet.id || 0)) % links.length]
  const toCode = door.a === from.code ? door.b : door.a
  const to = open.get(toCode)
  const a = lugar(from)
  const b = lugar(to)
  const start = { col: a.x + from.w / 2, row: a.y + from.h / 2 }
  const end = { col: b.x + to.w / 2, row: b.y + to.h / 2 }
  // A coordenada da porta já é global. Meio passo para cada lado faz o corpo
  // cruzar a parede, em vez de desaparecer de um cômodo e nascer no outro.
  const before = door.axis === 'v' ? { col: door.x - .45, row: door.y + .5 } : { col: door.x + .5, row: door.y - .45 }
  const after = door.axis === 'v' ? { col: door.x + .45, row: door.y + .5 } : { col: door.x + .5, row: door.y + .45 }
  const reverse = door.b === from.code
  const gateA = reverse ? after : before
  const gateB = reverse ? before : after
  const lerp = (u, v, n) => ({ col: u.col + (v.col - u.col) * n, row: u.row + (v.row - u.row) * n })
  let pos
  if (progress < .42) pos = lerp(start, gateA, progress / .42)
  else if (progress < .58) pos = lerp(gateA, gateB, (progress - .42) / .16)
  else pos = lerp(gateB, end, (progress - .58) / .42)
  return { ...pos, olhando: end.col >= start.col ? 'direita' : 'esquerda', targetRoom: toCode }
}

function wallSegment(p, a, b, style, origin, height = WALL_HEIGHT) {
  const wall = WALL_STYLES[style] || WALL_STYLES.padrao
  const A = project(a[0], a[1], height, origin)
  const B = project(b[0], b[1], height, origin)
  const C = project(b[0], b[1], 0, origin)
  const D = project(a[0], a[1], 0, origin)
  p.fillPoly([A, B, C, D], shade(wall.base, a[0] === b[0] ? -0.25 : -0.08))
  p.strokePoly([A, B, C, D], shade(wall.base, -0.55))
}

function pieces(from, to, gap) {
  if (gap == null || gap < from || gap >= to) return [[from, to]]
  return [[from, gap], [gap + 1, to]].filter(([a, b]) => b > a)
}

function drawRoomWalls(p, room, unlockedByCode, doors, origin) {
  if (room.outdoor) return
  const { x, y } = lugar(room)
  const right = x + room.w
  const bottom = y + room.h
  const neighborRight = [...unlockedByCode.values()].find((r) => !r.outdoor && r.x === right && r.y === y)
  const neighborBottom = [...unlockedByCode.values()].find((r) => !r.outdoor && r.y === bottom && r.x === x)
  const doorRight = neighborRight && portaEntre(doors, room.code, neighborRight.code)
  const doorBottom = neighborBottom && portaEntre(doors, room.code, neighborBottom.code)

  // Só as paredes que ficam visíveis na projeção. Nas divisas internas elas
  // continuam, mas com um buraco real de uma célula para a porta.
  // Parede interna em meia altura, como no modo "paredes baixas" de The Sims:
  // separa os cômodos sem esconder o piso e os móveis da planta ao lado.
  const internalHeight = 1.15
  pieces(y, bottom, doorRight?.y).forEach(([a, b]) => wallSegment(p, [right, a], [right, b], room.wall, origin, neighborRight ? internalHeight : WALL_HEIGHT))
  pieces(x, right, doorBottom?.x).forEach(([a, b]) => wallSegment(p, [a, bottom], [b, bottom], room.wall, origin, neighborBottom ? internalHeight : WALL_HEIGHT))
  if (x === 0) wallSegment(p, [x, y], [x, bottom], room.wall, origin)
  if (y === 0) wallSegment(p, [x, y], [right, y], room.wall, origin)

  // Porta física para o quintal: a parede sul da varanda tem um vão e uma
  // soleira. Ela só aparece quando a varanda está aberta.
  if (room.code === 'varanda') {
    const d = portaEntre(doors, 'varanda', 'quintal')
    if (d) {
      p.fillPoly(tileDiamond(d.x, d.y, origin, 0.03), '#d7b583')
      const [cx, cy] = project(d.x + 0.5, d.y + 0.5, 0, origin)
      p.rect(cx - 11, cy - 4, 22, 4, '#8d6248')
    }
  }
}

function makeBackground(rooms, doors, metrics) {
  const canvas = document.createElement('canvas')
  canvas.width = metrics.width
  canvas.height = metrics.height
  const p = new Painter(canvas)
  p.clear('#bfe0ef')
  const unlocked = rooms.filter((r) => r.unlocked)
  const byCode = new Map(unlocked.map((r) => [r.code, r]))

  // Quintal primeiro: ele passa por baixo da casa e une os dois lugares.
  const yard = byCode.get('quintal')
  if (yard) {
    const pos = lugar(yard)
    drawFloor(p, yard.w, yard.h, {
      x: metrics.origin.x + (pos.x - pos.y) * 48,
      y: metrics.origin.y + (pos.x + pos.y) * 24,
    }, yard.floor || 'grama')
  }
  for (const room of unlocked.filter((r) => !r.outdoor)) {
    const pos = lugar(room)
    drawFloor(p, room.w, room.h, {
      x: metrics.origin.x + (pos.x - pos.y) * 48,
      y: metrics.origin.y + (pos.x + pos.y) * 24,
    }, room.floor)
  }
  for (const room of unlocked.filter((r) => !r.outdoor)) drawRoomWalls(p, room, byCode, doors, metrics.origin)

  // Contorno baixo do quintal: delimita o lote sem transformá-lo em outra tela.
  if (yard) {
    const { x, y } = lugar(yard)
    wallSegment(p, [x, y + yard.h], [x + yard.w, y + yard.h], 'verde', metrics.origin, 0.45)
    wallSegment(p, [x + yard.w, y], [x + yard.w, y + yard.h], 'verde', metrics.origin, 0.45)
  }
  return canvas
}

export default function HouseLotCanvas({ rooms, doors = [], activeRoom, editing, hover, selectedId, onPickTile, onReleaseTile, pets = [] }) {
  const holderRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [scale, setScale] = useState(1)
  const metrics = roomMetrics(LOT_COLS, LOT_ROWS, WALL_HEIGHT)
  const backgroundRef = useRef(null)

  stateRef.current = { rooms, doors, activeRoom, editing, hover, selectedId, pets }
  useEffect(() => { backgroundRef.current = makeBackground(rooms, doors, metrics) }, [rooms, doors, metrics.width, metrics.height])

  useLayoutEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    // A casa cresce; a câmera não tenta espremê-la de volta na tela. 1x é o
    // pixel real e o dedo arrasta o lote como em um jogo de decoração.
    setScale(1)
    requestAnimationFrame(() => {
      holder.scrollLeft = Math.max(0, (metrics.width - holder.clientWidth) * 0.42)
      holder.scrollTop = Math.max(0, (metrics.height - holder.clientHeight) * 0.12)
    })
  }, [metrics.width, metrics.height])

  useEffect(() => {
    const canvas = canvasRef.current
    const p = new Painter(canvas)
    p.resize(metrics.width, metrics.height)
    let frame = 0
    let alive = true
    const paint = (t) => {
      if (!alive) return
      const s = stateRef.current
      p.clear('#bfe0ef')
      if (backgroundRef.current) p.ctx.drawImage(backgroundRef.current, 0, 0)
      const queue = []
      for (const room of s.rooms.filter((r) => r.unlocked)) {
        const pos = lugar(room)
        const items = room.code === s.activeRoom.code ? s.activeRoom.items : room.items
        for (const item of items || []) queue.push({ ...item, col: item.col + pos.x, row: item.row + pos.y, roomCode: room.code })
        for (const mess of room.mess || []) queue.push({ ...mess, id: `mess-${mess.id}`, col: mess.col + pos.x, row: mess.row + pos.y, w: 1, d: 1, mess: true })
      }
      for (const pet of s.pets) {
        const pos = petPosition(pet, s.rooms, s.doors, t)
        if (!pos) continue
        queue.push({ ...pet, ...pos, _pet: true, w: 1, d: 1, action: 'andar' })
      }
      for (const item of depthSort(queue)) {
        if (item._pet) drawHousePet(p, item, metrics.origin, t)
        else if (!item.mess) drawItem(p, item, metrics.origin, t)
      }
      if (s.editing && s.hover) {
        const room = s.rooms.find((r) => r.code === s.hover.roomCode)
        if (room) {
          const pos = lugar(room)
          for (let rr = 0; rr < s.hover.d; rr++) for (let cc = 0; cc < s.hover.w; cc++)
            p.fillPoly(tileDiamond(pos.x + s.hover.col + cc, pos.y + s.hover.row + rr, metrics.origin, .02), s.hover.ok ? 'rgba(127,214,176,.5)' : 'rgba(255,107,107,.5)')
        }
      }
      frame = requestAnimationFrame(paint)
    }
    paint(performance.now())
    return () => { alive = false; cancelAnimationFrame(frame) }
  }, [metrics.width, metrics.height])

  function target(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / (rect.width / metrics.width)
    const y = (e.clientY - rect.top) / (rect.height / metrics.height)
    const [gc, gr] = unproject(x, y, metrics.origin)
    const room = rooms.filter((r) => r.unlocked).find((r) => {
      const pos = lugar(r)
      return gc >= pos.x && gr >= pos.y && gc < pos.x + r.w && gr < pos.y + r.h
    })
    if (!room) return null
    const pos = lugar(room)
    return { roomCode: room.code, col: gc - pos.x, row: gr - pos.y, x, y }
  }

  const drag = useRef(null)
  function down(e) {
    if (editing) { const tile = target(e); if (tile) onPickTile?.(tile, e); return }
    const h = holderRef.current
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: h.scrollLeft, top: h.scrollTop }
    try { h.setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
  }
  function move(e) {
    if (editing) { const tile = target(e); if (tile) onPickTile?.(tile, e, true); return }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    holderRef.current.scrollLeft = d.left - (e.clientX - d.x)
    holderRef.current.scrollTop = d.top - (e.clientY - d.y)
  }
  function up(e) { drag.current = null; onReleaseTile?.(target(e), e) }

  return <div className="lot-wrap">
    <div className="lot-hint">Arraste para passear pela casa inteira</div>
    <div ref={holderRef} className={`lot-holder ${editing ? 'editando' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <canvas ref={canvasRef} className="lot-canvas" style={{ width: metrics.width * scale, height: metrics.height * scale }} />
    </div>
  </div>
}
