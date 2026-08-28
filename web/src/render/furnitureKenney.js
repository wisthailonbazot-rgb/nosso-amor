import { project } from './iso'

// Furniture Kit 2.0, por Kenney, CC0.
// Os PNGs vieram do ZIP entregue pelo dono e ficam em public/kenney-furniture.
// O nome do shape continua sendo o nosso: banco, inventario, colisao e tamanho
// nao mudam; apenas a camada de desenho troca.
export const KENNEY_MODELS = {
  sofa: 'loungeDesignSofa',
  bed: 'bedDouble',
  table: 'table',
  chair: 'chairCushion',
  shelf: 'bookcaseOpen',
  wardrobe: 'bookcaseClosedWide',
  puff: 'loungeSofaOttoman',
  frame: 'bathroomMirror',
  plant: 'plantSmall1',
  plant_big: 'pottedPlant',
  rug: 'rugRectangle',
  lamp: 'lampRoundFloor',
  tv: 'televisionModern',
  speaker: 'speaker',
  fridge: 'kitchenFridgeLarge',
  stove: 'kitchenStove',
  petbed: 'pillowBlueLong',
  gardenstool: 'stoolBarSquare',
}

// O nosso dir=0 olha para +row (baixo/esquerda na tela). Os nomes do kit
// descrevem a face vista pela camera, por isso esta ordem nao e alfabetica.
const VIEW_BY_DIR = ['SE', 'SW', 'NW', 'NE']
const cache = new Map()

function entryFor(shape, dir) {
  const model = KENNEY_MODELS[shape]
  if (!model || typeof Image === 'undefined') return null
  const view = VIEW_BY_DIR[((dir || 0) % 4 + 4) % 4]
  const key = `${model}_${view}`
  let entry = cache.get(key)
  if (entry) return entry

  const image = new Image()
  entry = { image, state: 'loading', listeners: new Set() }
  cache.set(key, entry)
  image.onload = () => {
    entry.state = 'ready'
    for (const listener of entry.listeners) listener()
    entry.listeners.clear()
  }
  image.onerror = () => {
    entry.state = 'error'
    entry.listeners.clear()
  }
  image.src = `/kenney-furniture/${key}.png`
  return entry
}

/**
 * Desenha a vista pronta alinhando o canto da frente ao mesmo ponto que a
 * grade usa. O kit foi exportado recortado rente ao objeto; o pixel inferior
 * central e o canto mais proximo da camera.
 *
 * Retorna false enquanto carrega ou quando o shape nao existe no kit. Quem
 * chama desenha imediatamente o nosso movel antigo como fallback — portanto
 * nunca existe quadro vazio, rede lenta nao apaga objeto e os desenhos antigos
 * continuam sendo um backup funcional, nao apenas um arquivo esquecido.
 */
export function drawKenneyItem(p, item, origin, onReady) {
  const entry = entryFor(item.shape, item.dir)
  if (!entry) return false
  if (entry.state !== 'ready') {
    if (entry.state === 'loading' && onReady) entry.listeners.add(onReady)
    return false
  }

  const { image } = entry
  const [frontX, frontY] = project(item.col + item.w, item.row + item.d, 0, origin)
  const x = Math.round(frontX - image.naturalWidth / 2)
  const y = Math.round(frontY - image.naturalHeight + 2)
  p.ctx.save()
  p.ctx.imageSmoothingEnabled = false
  p.ctx.drawImage(image, x, y)
  p.ctx.restore()
  return true
}

export function hasKenneyModel(shape) {
  return Boolean(KENNEY_MODELS[shape])
}
