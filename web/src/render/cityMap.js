export const CITY_COLS = 22
export const CITY_ROWS = 18

export const CITY_PLACES = [
  { code: 'casa', name: 'Nossa casa', hint: 'Decorar e cuidar dos bichinhos', route: '/casa', x: 2, y: 2, w: 5, d: 4, door: [7, 6], color: '#e9a6b5', roof: '#9d526d' },
  { code: 'fliperama', name: 'Fliperama', hint: 'Todos os jogos do casal', route: '/jogos', x: 14, y: 2, w: 4, d: 4, door: [13, 6], color: '#8b79bd', roof: '#51447d' },
  { code: 'petshop', name: 'Pet shop', hint: 'Cuidar e brincar com a família', route: '/pet', x: 2, y: 12, w: 4, d: 3, door: [6, 12], color: '#79b899', roof: '#3d7d64' },
  { code: 'mercado', name: 'Shopping do Coração', hint: 'Móveis, roupas e itens do pet', route: '/loja?tab=house', x: 14, y: 11, w: 5, d: 4, door: [14, 10], color: '#e8ba62', roof: '#a16b35' },
  { code: 'praca', name: 'Praça do casal', hint: 'Momentos e lembranças', route: '/momentos', x: 15, y: 6, w: 5, d: 3, door: [14, 7], color: '#70af78', roof: '#437e4b', outdoor: true },
  { code: 'missoes', name: 'Central de missões', hint: 'Tarefas que rendem Corações', route: '/tarefas', x: 7, y: 1, w: 3, d: 4, door: [10, 5], color: '#74a7c9', roof: '#406987' },
]

const key = (x, y) => `${x},${y}`
const inside = (x, y) => x >= 0 && y >= 0 && x < CITY_COLS && y < CITY_ROWS

function line(cells, from, to) {
  let [x, y] = from
  const [tx, ty] = to
  cells.add(key(x, y))
  while (x !== tx) { x += Math.sign(tx - x); cells.add(key(x, y)) }
  while (y !== ty) { y += Math.sign(ty - y); cells.add(key(x, y)) }
}

export function cityWalkableSet() {
  const cells = new Set()
  // Duas pistas em cruz. O avatar anda no asfalto e nos caminhos dos lotes.
  for (let x = 0; x < CITY_COLS; x++) for (const y of [8, 9]) cells.add(key(x, y))
  for (let y = 0; y < CITY_ROWS; y++) for (const x of [10, 11]) cells.add(key(x, y))
  for (const place of CITY_PLACES) {
    const junction = Math.abs(place.door[0] - 10) < Math.abs(place.door[1] - 8)
      ? [place.door[0], place.door[1] < 8 ? 8 : 9]
      : [place.door[0] < 10 ? 10 : 11, place.door[1]]
    line(cells, place.door, junction)
  }
  // Passeio da praça, para ela ser um lugar e não só um botão.
  for (let x = 15; x <= 19; x++) cells.add(key(x, 7))
  return cells
}

export const CITY_WALKABLE = cityWalkableSet()
export const CITY_START = [10, 10]

export function isCityWalkable(x, y) {
  return CITY_WALKABLE.has(key(x, y))
}

export function cityPlaceAt(x, y) {
  return CITY_PLACES.find((place) =>
    x >= place.x && x < place.x + place.w && y >= place.y && y < place.y + place.d
  ) || null
}

export function nearestCityWalkable(x, y) {
  if (isCityWalkable(x, y)) return [x, y]
  let best = CITY_START
  let distance = Infinity
  for (const cell of CITY_WALKABLE) {
    const [cx, cy] = cell.split(',').map(Number)
    const next = Math.abs(cx - x) + Math.abs(cy - y)
    if (next < distance) { distance = next; best = [cx, cy] }
  }
  return best
}

export function cityPath(from, to) {
  const start = nearestCityWalkable(...from)
  const goal = nearestCityWalkable(...to)
  const queue = [start]
  const cameFrom = new Map([[key(...start), null]])
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    if (current[0] === goal[0] && current[1] === goal[1]) break
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = [current[0] + dx, current[1] + dy]
      const nextKey = key(...next)
      if (!inside(...next) || !isCityWalkable(...next) || cameFrom.has(nextKey)) continue
      cameFrom.set(nextKey, current)
      queue.push(next)
    }
  }
  if (!cameFrom.has(key(...goal))) return [start]
  const result = []
  let cursor = goal
  while (cursor) {
    result.push(cursor)
    cursor = cameFrom.get(key(...cursor))
  }
  return result.reverse()
}
