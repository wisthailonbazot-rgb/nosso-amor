// Desenha o cômodo inteiro: paredes, piso, móveis e os realces do editor.
//
// A ordem importa e não é negociável em isométrico: parede do fundo, piso, e só
// então os móveis, do mais distante pro mais perto. Se um móvel for pintado antes
// da parede, ele aparece atravessando a parede.

import { FACE_LEFT, FACE_RIGHT, TH, TW, TZ, project, roomMetrics, tileDiamond, depthSort } from './iso'
import { drawItem } from './furniture'
import { shade } from './pixel'
import { Painter } from './pixel'
import { drawPet } from './PetCanvas'

export const WALL_HEIGHT = 3 // em unidades de altura

export const FLOOR_STYLES = {
  madeira: { base: '#b07a4e', alt: '#a06f45', line: '#7d5232', plank: true },
  ceramica: { base: '#e3ded4', alt: '#d8d2c6', line: '#bdb5a6', plank: false },
  tapete: { base: '#b45f8a', alt: '#a9537f', line: '#8c4268', plank: false },
  padrao: { base: '#9c6f4b', alt: '#8f6543', line: '#6d4a30', plank: true },
  grama: { base: '#79a85f', alt: '#72a057', line: '#5d8648', plank: false },
  pedra: { base: '#aaa69f', alt: '#9d9992', line: '#77736d', plank: false },
}

export const WALL_STYLES = {
  rosa: { base: '#f0cdd9', motif: '#e0a8bc' },
  azul: { base: '#cfe0f5', motif: '#a6c1e4' },
  verde: { base: '#d3e8d0', motif: '#a9cfa5' },
  padrao: { base: '#e8dccd', motif: '#d0bda6' },
}

// ------------------------------------------------------------------ paredes
function drawWalls(p, cols, rows, origin, style) {
  const wall = WALL_STYLES[style] || WALL_STYLES.padrao
  const top = WALL_HEIGHT
  const P = (c, r, z) => project(c, r, z, origin)

  // parede que corre no eixo das linhas (fica à esquerda na tela)
  const leftWall = [P(0, 0, top), P(0, rows, top), P(0, rows, 0), P(0, 0, 0)]
  // parede que corre no eixo das colunas (fica à direita na tela)
  const rightWall = [P(0, 0, top), P(cols, 0, top), P(cols, 0, 0), P(0, 0, 0)]

  p.fillPoly(leftWall, shade(wall.base, FACE_RIGHT + 0.1))
  p.fillPoly(rightWall, shade(wall.base, FACE_LEFT + 0.06))

  // papel de parede: o motivo é projetado na própria parede, então acompanha a
  // inclinação em vez de parecer um adesivo colado por cima
  const motifLeft = shade(wall.motif, FACE_RIGHT + 0.1)
  const motifRight = shade(wall.motif, FACE_LEFT + 0.06)
  for (let r = 0.5; r < rows; r += 1) {
    for (let z = 0.4; z < top; z += 0.55) {
      const [x, y] = P(0, r, z)
      motif(p, x, y, motifLeft)
    }
  }
  for (let c = 0.5; c < cols; c += 1) {
    for (let z = 0.4; z < top; z += 0.55) {
      const [x, y] = P(c, 0, z)
      motif(p, x, y, motifRight)
    }
  }

  // rodapé: uma faixa mais escura embaixo dá o acabamento que falta
  const skirt = 0.32
  p.fillPoly([P(0, 0, skirt), P(0, rows, skirt), P(0, rows, 0), P(0, 0, 0)], shade(wall.base, -0.42))
  p.fillPoly([P(0, 0, skirt), P(cols, 0, skirt), P(cols, 0, 0), P(0, 0, 0)], shade(wall.base, -0.34))

  // quina e topo das paredes, pra separar do fundo
  const edge = shade(wall.base, -0.55)
  p.line(...P(0, 0, top), ...P(0, 0, 0), edge)
  p.strokePoly(leftWall, edge)
  p.strokePoly(rightWall, edge)
}

function motif(p, x, y, color) {
  // florzinha de 5 pixels — pequena o suficiente pra virar textura, não desenho
  p.px(x, y - 1, color)
  p.px(x - 1, y, color)
  p.px(x + 1, y, color)
  p.px(x, y + 1, color)
  p.px(x, y, shade(color, 0.25))
}

// ------------------------------------------------------------------ piso
function drawFloor(p, cols, rows, origin, style) {
  const floor = FLOOR_STYLES[style] || FLOOR_STYLES.padrao
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const diamond = tileDiamond(c, r, origin)
      p.fillPoly(diamond, (c + r) % 2 === 0 ? floor.base : floor.alt)
    }
  }
  // as juntas por cima de tudo, senão o losango de um tile come a linha do vizinho
  for (let r = 0; r <= rows; r++) {
    p.line(...project(0, r, 0, origin), ...project(cols, r, 0, origin), floor.line)
  }
  for (let c = 0; c <= cols; c++) {
    p.line(...project(c, 0, 0, origin), ...project(c, rows, 0, origin), floor.line)
  }
  if (floor.plank) {
    // veio da madeira: risquinhos curtos no sentido das tábuas
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((c * 7 + r * 3) % 4 !== 0) continue
        const [x, y] = project(c + 0.3, r + 0.5, 0, origin)
        p.px(x, y, floor.line)
        p.px(x + 1, y, floor.line)
        p.px(x + 2, y + 1, floor.line)
      }
    }
  }
}

// ------------------------------------------------------------------ realces
function highlight(p, col, row, w, d, origin, color) {
  for (let r = row; r < row + d; r++) {
    for (let c = col; c < col + w; c++) {
      p.fillPoly(tileDiamond(c, r, origin, 0.02), color)
    }
  }
}

function gridOverlay(p, cols, rows, origin) {
  const color = 'rgba(255,255,255,0.16)'
  for (let r = 0; r <= rows; r++) {
    p.line(...project(0, r, 0.02, origin), ...project(cols, r, 0.02, origin), color)
  }
  for (let c = 0; c <= cols; c++) {
    p.line(...project(c, 0, 0.02, origin), ...project(c, rows, 0.02, origin), color)
  }
}

// ------------------------------------------------------------------ tudo junto
/**
 * @param scene { cols, rows, floor, wall, items:[{id,shape,col,row,w,d,dir,color}] }
 * @param ui    { editing, hover:{col,row,w,d,ok}, selectedId }
 */
export function drawScene(p, scene, ui = {}, t = 0) {
  const { cols, rows } = scene
  const { origin } = roomMetrics(cols, rows, WALL_HEIGHT)

  p.clear()
  if (!scene.outdoor) drawWalls(p, cols, rows, origin, scene.wall)
  drawFloor(p, cols, rows, origin, scene.floor)
  if (ui.editing) gridOverlay(p, cols, rows, origin)

  // O bichinho entra na MESMA fila de profundidade dos moveis.
  //
  // Enquanto ele ficava parado num canto, desenhar por ultimo passava
  // despercebido. Agora que ele anda, desenhar por ultimo o faria atravessar o
  // sofa por cima ao passar atras dele — em isometrico, quem esta mais ao fundo
  // tem que ser pintado primeiro, e isso vale pro bicho igual vale pra mobilia.
  const fila = [...(scene.items || [])]
  // `scene.pet` pode ser um objeto OU uma funcao do instante.
  //
  // Funcao e o caso do comodo: a posicao dele muda a cada quadro, e um objeto
  // fixo so mudaria quando o React re-renderizasse — ou seja, ele voltaria a
  // ficar parado, que e exatamente o que a gente esta consertando.
  // UM ou VÁRIOS. `scene.pets` é a casa com todos os bichinhos dentro; `scene.pet`
  // continua valendo pra quem só tem um pra mostrar.
  //
  // Eles entram na MESMA fila de profundidade dos móveis, e é isso que faz um
  // passar atrás do outro e atrás do sofá. Desenhar os bichos por último (que
  // seria o caminho fácil) deixaria todos colados por cima da cena.
  const varios = typeof scene.pets === 'function' ? scene.pets(t || 0) : scene.pets
  if (Array.isArray(varios)) {
    for (const b of varios) if (b) fila.push({ ...b, semAviso: true, w: 1, d: 1, _pet: true })
  } else {
    const bicho = typeof scene.pet === 'function' ? scene.pet(t || 0) : scene.pet
    if (bicho) fila.push({ ...bicho, semAviso: true, w: 1, d: 1, _pet: true })
  }

  for (const item of depthSort(fila)) {
    if (item._pet) {
      drawHousePet(p, item, origin, t)
      continue
    }
    if (item.id === ui.selectedId) {
      highlight(p, item.col, item.row, item.w, item.d, origin, 'rgba(255,207,107,0.45)')
    }
    if (item.mess) drawMess(p, item, origin, t)
    else drawItem(p, item, origin, t)
  }

  if (ui.hover) {
    const { col, row, w, d, ok } = ui.hover
    highlight(
      p,
      col,
      row,
      w,
      d,
      origin,
      ok ? 'rgba(127,214,176,0.45)' : 'rgba(255,107,107,0.45)'
    )
  }
  return origin
}

/**
 * O bichinho dentro do comodo.
 *
 * Ele e desenhado num canvas separado e depois colado na cena — mas agora **no
 * tamanho em que vai aparecer**, nao encolhido.
 *
 * A versao anterior pintava nos 128x108 cheios e colava em 50x42. Parecia
 * economico ("um desenho so, colado em dois tamanhos"), e era justamente o que
 * arruinava a arte: reduzir pixel art nao suaviza, JOGA PIXEL FORA. De cada
 * dois pixels e meio sobrava um, escolhido por arredondamento — contorno
 * esfarelado, olho sumido, perna com buraco. Na tela do bichinho, que usa a
 * caixa inteira, ele estava bonito; aqui e no jogo, nao.
 *
 * O motor aceita escala (ver `drawPet`), entao o desenho sai direto em 50x42:
 * sao menos pixels, mas todos escolhidos pelo desenho. Continua sendo O MESMO
 * `drawPet` — a regra de nao existir um segundo sprite do bichinho vale.
 *
 * `pet.col` e `pet.row` aceitam fracao: e assim que o passeio (`petWander.js`)
 * faz ele ANDAR em vez de pular de celula em celula.
 */
const PET_L = 62
const PET_A = 52
const PET_ESCALA = PET_A / 108

function drawHousePet(p, pet, origin, t) {
  const [x, y] = project(pet.col + 0.5, pet.row + 0.5, 0.05, origin)
  if (!drawHousePet.canvas) {
    drawHousePet.canvas = document.createElement('canvas')
    drawHousePet.painter = new Painter(drawHousePet.canvas)
  }
  const sprite = drawHousePet.painter
  sprite.resize(PET_L, PET_A)
  sprite.clear()
  drawPet(sprite, pet, t, PET_ESCALA)

  const ex = Math.round(x - PET_L / 2)
  const ey = Math.round(y - PET_A)
  if (pet.olhando === 'esquerda') {
    // Espelha na hora de colar, em vez de desenhar um segundo conjunto de
    // sprites virados. `drawImage` com escala negativa e nitido: nao interpola,
    // entao a pixel art continua com borda dura.
    p.ctx.save()
    p.ctx.translate(ex + PET_L, ey)
    p.ctx.scale(-1, 1)
    p.ctx.drawImage(drawHousePet.canvas, 0, 0)
    p.ctx.restore()
  } else {
    p.ctx.drawImage(drawHousePet.canvas, ex, ey)
  }
}

function drawMess(p, item, origin, t) {
  const [x, y] = project(item.col + .5, item.row + .5, .03, origin)
  if (item.kind === 'puddle') {
    p.fillPoly([[x-8,y],[x-3,y-4],[x+7,y-2],[x+9,y+2],[x,y+4],[x-7,y+3]], '#c3aa69')
    p.px(x-2,y-1,'#eee0a6')
  } else if (item.kind === 'fur') {
    for (let i=0;i<7;i++) p.rect(x-7+i*2,y+(i%3)-2,3,1,'#c8bbaa')
  } else if (item.kind === 'crumbs') {
    for (const [dx,dy] of [[-6,1],[-2,-2],[3,2],[6,-1],[0,3]]) p.px(x+dx,y+dy,'#9b6938')
  } else {
    p.rect(x-5,y-3,10,4,'#6b4a2f'); p.rect(x-3,y-6,6,3,'#805a38'); p.rect(x-1,y-8,2,2,'#8a5f3c')
  }
  const fly = Math.sin(t/220) > 0 ? 1 : -1
  p.px(x-7+fly,y-11,'#33203a'); p.px(x+6-fly,y-9,'#33203a')
}

export { roomMetrics, TW, TH, TZ }
