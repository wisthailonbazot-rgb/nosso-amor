// O avatar, desenhado em pixel a partir da configuração.
//
// Nada de imagem: cada peça de roupa é uma função que pinta retângulos. Isso é o
// que permite a loja ter dezenas de peças sem ninguém desenhar arquivo nenhum — e
// é o mesmo boneco que vai andar pelo mapa do bairro mais pra frente.
//
// Tamanho da arte: 32 x 48 pixels. A ordem de desenho é a de `AVATAR_LAYERS` no
// catálogo do servidor — base, baixo, cima, calçado, cabelo, rosto, cabeça, extra.

import { Painter, shade } from './pixel'

export const AVATAR_W = 32
export const AVATAR_H = 48

const OUT = '#3b2b26' // contorno

// Onde cada parte do corpo mora. Trocar aqui move tudo junto.
const HEAD = { x: 8, y: 5, w: 16, h: 16 }
const TORSO = { x: 9, y: 23, w: 14, h: 14 }
const LEG_L = { x: 11, y: 37, w: 4, h: 8 }
const LEG_R = { x: 17, y: 37, w: 4, h: 8 }
const ARM_L = { x: 6, y: 24, w: 3, h: 11 }
const ARM_R = { x: 23, y: 24, w: 3, h: 11 }

function box(p, o, x, y, w, h, fill) {
  p.rect(o.x + x - 1, o.y + y - 1, w + 2, h + 2, OUT)
  p.rect(o.x + x, o.y + y, w, h, fill)
}

function flat(p, o, x, y, w, h, fill) {
  p.rect(o.x + x, o.y + y, w, h, fill)
}

// ------------------------------------------------------------------ corpo
function drawBase(p, o, c) {
  const skin = c.skin
  const dark = shade(skin, -0.18)

  // pernas e braços primeiro: ficam por baixo do tronco
  box(p, o, LEG_L.x, LEG_L.y, LEG_L.w, LEG_L.h, skin)
  box(p, o, LEG_R.x, LEG_R.y, LEG_R.w, LEG_R.h, skin)
  box(p, o, ARM_L.x, ARM_L.y, ARM_L.w, ARM_L.h, skin)
  box(p, o, ARM_R.x, ARM_R.y, ARM_R.w, ARM_R.h, skin)
  box(p, o, TORSO.x, TORSO.y, TORSO.w, TORSO.h, skin)
  flat(p, o, 14, 21, 4, 3, dark) // pescoço, na sombra do queixo

  // cabeça e orelhinhas
  box(p, o, HEAD.x, HEAD.y, HEAD.w, HEAD.h, skin)
  box(p, o, 6, 12, 2, 4, skin)
  box(p, o, 24, 12, 2, 4, skin)
}

// ------------------------------------------------------------------ rosto
const EYES = {
  redondo: (p, o, col) => {
    flat(p, o, 12, 12, 2, 3, col)
    flat(p, o, 18, 12, 2, 3, col)
    flat(p, o, 12, 12, 1, 1, '#ffffff')
    flat(p, o, 18, 12, 1, 1, '#ffffff')
  },
  amendoado: (p, o, col) => {
    flat(p, o, 11, 13, 3, 2, col)
    flat(p, o, 18, 13, 3, 2, col)
    flat(p, o, 13, 13, 1, 1, '#ffffff')
    flat(p, o, 20, 13, 1, 1, '#ffffff')
  },
  fechado: (p, o, col) => {
    flat(p, o, 11, 14, 3, 1, col)
    flat(p, o, 18, 14, 3, 1, col)
  },
  sonolento: (p, o, col) => {
    flat(p, o, 11, 13, 3, 2, col)
    flat(p, o, 18, 13, 3, 2, col)
    flat(p, o, 11, 13, 3, 1, shade(col, -0.4))
    flat(p, o, 18, 13, 3, 1, shade(col, -0.4))
  },
  animado: (p, o, col) => {
    flat(p, o, 11, 11, 3, 4, col)
    flat(p, o, 18, 11, 3, 4, col)
    flat(p, o, 11, 11, 2, 2, '#ffffff')
    flat(p, o, 18, 11, 2, 2, '#ffffff')
  },
}

const MOUTHS = {
  sorriso: (p, o) => {
    flat(p, o, 14, 17, 4, 1, OUT)
    flat(p, o, 13, 16, 1, 1, OUT)
    flat(p, o, 18, 16, 1, 1, OUT)
  },
  serio: (p, o) => flat(p, o, 14, 17, 4, 1, OUT),
  risada: (p, o) => {
    flat(p, o, 13, 16, 6, 3, OUT)
    flat(p, o, 14, 17, 4, 1, '#ffffff')
  },
  bico: (p, o) => {
    flat(p, o, 15, 16, 2, 2, '#c9607a')
    flat(p, o, 14, 17, 4, 1, '#c9607a')
  },
  lingua: (p, o) => {
    flat(p, o, 14, 16, 4, 1, OUT)
    flat(p, o, 15, 17, 2, 2, '#e8879b')
  },
}

const BROWS = {
  reta: (p, o, col) => {
    flat(p, o, 11, 10, 3, 1, col)
    flat(p, o, 18, 10, 3, 1, col)
  },
  arqueada: (p, o, col) => {
    flat(p, o, 11, 10, 2, 1, col)
    flat(p, o, 13, 9, 1, 1, col)
    flat(p, o, 19, 9, 1, 1, col)
    flat(p, o, 20, 10, 2, 1, col)
  },
  grossa: (p, o, col) => {
    flat(p, o, 11, 9, 3, 2, col)
    flat(p, o, 18, 9, 3, 2, col)
  },
  fina: (p, o, col) => {
    flat(p, o, 12, 10, 2, 1, col)
    flat(p, o, 19, 10, 2, 1, col)
  },
}

function drawFace(p, o, c) {
  ;(BROWS[c.brows] || BROWS.reta)(p, o, shade(c.hair_color, -0.15))
  ;(EYES[c.eyes] || EYES.redondo)(p, o, c.eye_color)
  ;(MOUTHS[c.mouth] || MOUTHS.sorriso)(p, o)
  if (c.blush) {
    flat(p, o, 9, 15, 3, 2, '#f2a0b0')
    flat(p, o, 20, 15, 3, 2, '#f2a0b0')
  }
}

// ------------------------------------------------------------------ cabelo
const HAIR = {
  curto: (p, o, col) => {
    box(p, o, 7, 3, 18, 6, col)
    flat(p, o, 8, 9, 3, 2, col)
    flat(p, o, 21, 9, 3, 2, col)
  },
  medio: (p, o, col) => {
    box(p, o, 7, 3, 18, 6, col)
    flat(p, o, 7, 9, 3, 6, col)
    flat(p, o, 22, 9, 3, 6, col)
  },
  longo: (p, o, col) => {
    box(p, o, 7, 3, 18, 6, col)
    flat(p, o, 6, 9, 4, 20, col)
    flat(p, o, 22, 9, 4, 20, col)
    flat(p, o, 6, 27, 4, 2, shade(col, -0.2))
    flat(p, o, 22, 27, 4, 2, shade(col, -0.2))
  },
  cacheado: (p, o, col) => {
    box(p, o, 6, 1, 20, 8, col)
    for (const [x, y] of [[4, 5], [26, 5], [5, 10], [25, 10], [7, 14], [24, 14]]) {
      flat(p, o, x, y, 3, 3, col)
    }
    flat(p, o, 8, 2, 4, 2, shade(col, 0.25))
  },
  coque: (p, o, col) => {
    box(p, o, 7, 3, 18, 6, col)
    box(p, o, 13, -2, 6, 5, col)
    flat(p, o, 14, -1, 2, 2, shade(col, 0.25))
    flat(p, o, 8, 9, 2, 3, col)
    flat(p, o, 22, 9, 2, 3, col)
  },
  franja: (p, o, col) => {
    box(p, o, 7, 3, 18, 7, col)
    flat(p, o, 8, 10, 16, 1, col)
    flat(p, o, 7, 10, 3, 8, col)
    flat(p, o, 22, 10, 3, 8, col)
  },
  rabo: (p, o, col) => {
    box(p, o, 7, 3, 18, 6, col)
    box(p, o, 24, 8, 4, 14, col)
    flat(p, o, 25, 20, 3, 3, shade(col, -0.2))
    flat(p, o, 22, 7, 3, 3, col)
  },
  moicano: (p, o, col) => {
    box(p, o, 13, -2, 6, 11, col)
    flat(p, o, 8, 6, 16, 3, shade(col, -0.35))
    flat(p, o, 14, -1, 2, 4, shade(col, 0.3))
  },
}

// ------------------------------------------------------------------ roupa
const TOPS = {
  camiseta: (p, o, col) => {
    box(p, o, TORSO.x, TORSO.y, TORSO.w, 11, col)
    box(p, o, ARM_L.x, ARM_L.y, 3, 4, col)
    box(p, o, ARM_R.x, ARM_R.y, 3, 4, col)
    flat(p, o, 14, TORSO.y, 4, 2, shade(col, -0.25)) // gola
  },
  regata: (p, o, col) => {
    box(p, o, 11, TORSO.y, 10, 11, col)
    flat(p, o, 13, TORSO.y, 6, 2, shade(col, -0.25))
  },
  moletom: (p, o, col) => {
    box(p, o, 8, TORSO.y - 1, 16, 13, col)
    box(p, o, ARM_L.x, ARM_L.y - 1, 3, 11, col)
    box(p, o, ARM_R.x, ARM_R.y - 1, 3, 11, col)
    flat(p, o, 12, TORSO.y - 1, 8, 3, shade(col, -0.2)) // capuz
    flat(p, o, 15, 30, 2, 4, shade(col, -0.3)) // cordão
  },
  vestido: (p, o, col) => {
    box(p, o, 11, TORSO.y, 10, 10, col)
    box(p, o, 8, 33, 16, 9, col)
    flat(p, o, 8, 40, 16, 2, shade(col, -0.2))
    flat(p, o, 13, TORSO.y, 6, 2, shade(col, -0.25))
  },
  xadrez: (p, o, col) => {
    box(p, o, TORSO.x, TORSO.y, TORSO.w, 12, col)
    box(p, o, ARM_L.x, ARM_L.y, 3, 10, col)
    box(p, o, ARM_R.x, ARM_R.y, 3, 10, col)
    const line = shade(col, -0.3)
    for (let y = TORSO.y + 2; y < TORSO.y + 12; y += 3) flat(p, o, TORSO.x, y, TORSO.w, 1, line)
    for (let x = TORSO.x + 2; x < TORSO.x + TORSO.w; x += 3) flat(p, o, x, TORSO.y, 1, 12, line)
  },
  jaqueta: (p, o, col) => {
    box(p, o, 8, TORSO.y - 1, 16, 13, col)
    box(p, o, ARM_L.x - 1, ARM_L.y - 1, 4, 12, col)
    box(p, o, ARM_R.x, ARM_R.y - 1, 4, 12, col)
    flat(p, o, 14, TORSO.y - 1, 4, 13, shade(col, -0.35)) // zíper
    flat(p, o, 15, TORSO.y, 2, 12, shade(col, 0.3))
    flat(p, o, 10, TORSO.y - 1, 4, 3, shade(col, -0.2)) // lapelas
    flat(p, o, 18, TORSO.y - 1, 4, 3, shade(col, -0.2))
  },
  social: (p, o, col) => {
    box(p, o, TORSO.x, TORSO.y, TORSO.w, 12, col)
    box(p, o, ARM_L.x, ARM_L.y, 3, 11, col)
    box(p, o, ARM_R.x, ARM_R.y, 3, 11, col)
    flat(p, o, 15, TORSO.y, 2, 12, shade(col, -0.25))
    flat(p, o, 13, TORSO.y, 6, 2, '#ffffff')
    flat(p, o, 15, TORSO.y + 2, 2, 3, '#c9607a') // gravatinha
  },
}

const BOTTOMS = {
  jeans: (p, o, col) => {
    box(p, o, LEG_L.x, 36, 4, 9, col)
    box(p, o, LEG_R.x, 36, 4, 9, col)
    flat(p, o, 11, 36, 10, 2, shade(col, -0.2))
  },
  short: (p, o, col) => {
    box(p, o, LEG_L.x, 36, 4, 5, col)
    box(p, o, LEG_R.x, 36, 4, 5, col)
    flat(p, o, 11, 36, 10, 2, shade(col, -0.2))
  },
  saia: (p, o, col) => {
    box(p, o, 9, 35, 14, 7, col)
    flat(p, o, 9, 40, 14, 2, shade(col, -0.22))
  },
  social: (p, o, col) => {
    box(p, o, LEG_L.x, 35, 4, 10, col)
    box(p, o, LEG_R.x, 35, 4, 10, col)
    flat(p, o, 11, 35, 10, 2, shade(col, -0.35))
    flat(p, o, 15, 35, 2, 1, '#f2b33d') // fivela
  },
  moletom: (p, o, col) => {
    box(p, o, 10, 35, 5, 10, col)
    box(p, o, 17, 35, 5, 10, col)
    flat(p, o, 10, 43, 5, 2, shade(col, -0.25))
    flat(p, o, 17, 43, 5, 2, shade(col, -0.25))
  },
}

const SHOES = {
  tenis: (p, o, col) => {
    box(p, o, 10, 44, 5, 4, col)
    box(p, o, 17, 44, 5, 4, col)
    flat(p, o, 10, 46, 5, 2, '#ffffff')
    flat(p, o, 17, 46, 5, 2, '#ffffff')
  },
  chinelo: (p, o, col) => {
    box(p, o, 10, 46, 5, 2, col)
    box(p, o, 17, 46, 5, 2, col)
  },
  bota: (p, o, col) => {
    box(p, o, 10, 41, 5, 7, col)
    box(p, o, 17, 41, 5, 7, col)
    flat(p, o, 10, 46, 5, 2, shade(col, -0.35))
    flat(p, o, 17, 46, 5, 2, shade(col, -0.35))
  },
  sandalia: (p, o, col) => {
    box(p, o, 10, 45, 5, 3, col)
    box(p, o, 17, 45, 5, 3, col)
    flat(p, o, 11, 43, 3, 1, col)
    flat(p, o, 18, 43, 3, 1, col)
  },
  social: (p, o, col) => {
    box(p, o, 10, 44, 6, 4, col)
    box(p, o, 17, 44, 6, 4, col)
    flat(p, o, 10, 44, 6, 1, shade(col, 0.35))
    flat(p, o, 17, 44, 6, 1, shade(col, 0.35))
  },
}

// ------------------------------------------------------------------ acessórios
const HEAD_ACC = {
  bone: (p, o) => {
    box(p, o, 7, 2, 18, 5, '#5b8def')
    flat(p, o, 6, 6, 14, 2, shade('#5b8def', -0.3)) // aba
    flat(p, o, 14, 1, 4, 2, shade('#5b8def', 0.25))
  },
  oculos: (p, o) => {
    box(p, o, 10, 12, 5, 4, '#2f2740')
    box(p, o, 17, 12, 5, 4, '#2f2740')
    flat(p, o, 11, 13, 3, 2, '#a8cde0')
    flat(p, o, 18, 13, 3, 2, '#a8cde0')
    flat(p, o, 15, 13, 2, 1, '#2f2740')
  },
  laco: (p, o) => {
    box(p, o, 20, 2, 4, 4, '#e8879b')
    box(p, o, 24, 3, 3, 3, '#e8879b')
    flat(p, o, 23, 3, 1, 2, '#c9607a')
  },
  coroa: (p, o) => {
    box(p, o, 9, 0, 14, 4, '#f2b33d')
    flat(p, o, 10, -2, 2, 3, '#f2b33d')
    flat(p, o, 15, -3, 2, 4, '#f2b33d')
    flat(p, o, 20, -2, 2, 3, '#f2b33d')
    flat(p, o, 15, 1, 2, 2, '#e8879b')
  },
  touca: (p, o) => {
    box(p, o, 7, 1, 18, 7, '#9cbf9a')
    flat(p, o, 7, 7, 18, 2, shade('#9cbf9a', -0.25))
    box(p, o, 14, -3, 4, 4, '#fffaf3') // pompom
  },
}

const EXTRA_ACC = {
  colar: (p, o) => {
    flat(p, o, 13, 24, 6, 1, '#f2b33d')
    flat(p, o, 15, 25, 2, 2, '#e8879b')
  },
  mochila: (p, o) => {
    box(p, o, 4, 25, 4, 9, '#c9744f')
    flat(p, o, 4, 28, 4, 2, shade('#c9744f', -0.3))
    box(p, o, 24, 25, 4, 9, '#c9744f')
    flat(p, o, 24, 28, 4, 2, shade('#c9744f', -0.3))
  },
  fone: (p, o) => {
    box(p, o, 6, 8, 3, 6, '#2f2740')
    box(p, o, 23, 8, 3, 6, '#2f2740')
    flat(p, o, 8, 3, 16, 2, '#2f2740')
    flat(p, o, 7, 9, 1, 4, '#e8879b')
    flat(p, o, 24, 9, 1, 4, '#e8879b')
  },
  asa: (p, o) => {
    box(p, o, 1, 22, 6, 10, '#e9dcf7')
    box(p, o, 25, 22, 6, 10, '#e9dcf7')
    flat(p, o, 2, 25, 4, 1, '#c9b6e8')
    flat(p, o, 2, 28, 4, 1, '#c9b6e8')
    flat(p, o, 26, 25, 4, 1, '#c9b6e8')
    flat(p, o, 26, 28, 4, 1, '#c9b6e8')
  },
}

// ------------------------------------------------------------------ silhueta
/**
 * Esculpe a silhueta DEPOIS da roupa.
 *
 * O boneco era um retângulo só, igual pros dois do pescoço pra baixo — a única
 * diferença entre eles era cabelo e roupa. A dona do app disse, com razão, que
 * o dela não parecia ela.
 *
 * O jeito óbvio seria desenhar um segundo corpo. Seria o pior caminho: as 48
 * peças de roupa são retângulos posicionados em cima do tronco, então cada
 * peça teria que ganhar uma segunda versão — 48 desenhos novos pra mudar uma
 * silhueta.
 *
 * Aqui o corpo é ESCULPIDO no fim: recorta-se a cintura (e o ombro, no caso
 * curvilíneo) com `clearRect`, que tira skin e tecido de uma vez. Como o corte
 * acontece depois de tudo, TODA roupa acompanha a forma sozinha — inclusive as
 * que ainda nem existem. Depois o contorno é redesenhado na borda nova, senão o
 * corte deixaria a silhueta sem traço justamente onde ela mais aparece.
 */
// Duas formas, e não três. Existia um "largo" que só fazia sentido ALARGANDO a
// silhueta — e alargar exigiria pintar por fora do tronco, sem saber que roupa
// está por baixo. Ele saía idêntico ao "reto": um botão que não muda nada é pior
// do que não ter o botão.
const CORPOS = {
  reto: null,   // o padrão: nada a esculpir
  curvas: { ombro: 1, cintura: 2, cinturaY: 6, cinturaH: 5 },
}

function esculpirCorpo(p, o, c) {
  const forma = CORPOS[c.corpo]
  if (!forma) return
  const ctx = p.ctx
  const yTopo = o.y + TORSO.y - 1
  const x0 = o.x + TORSO.x - 1
  const x1 = o.x + TORSO.x + TORSO.w + 1

  const corta = (x, y, w, h) => { if (w > 0) ctx.clearRect(x, y, w, h) }
  const traco = (x, y, w, h) => p.rect(x, y, w, h, OUT)

  // ombro
  if (forma.ombro > 0) {
    corta(x0, yTopo, forma.ombro, 3)
    corta(x1 - forma.ombro, yTopo, forma.ombro, 3)
    traco(x0 + forma.ombro, yTopo, 1, 3)
    traco(x1 - forma.ombro - 1, yTopo, 1, 3)
  }
  // cintura
  if (forma.cintura > 0) {
    const cy = yTopo + forma.cinturaY
    corta(x0, cy, forma.cintura, forma.cinturaH)
    corta(x1 - forma.cintura, cy, forma.cintura, forma.cinturaH)
    traco(x0 + forma.cintura, cy, 1, forma.cinturaH)
    traco(x1 - forma.cintura - 1, cy, 1, forma.cinturaH)
    // os cantos, pra transição não ficar em degrau seco
    traco(x0 + forma.cintura - 1, cy - 1, 1, 1)
    traco(x1 - forma.cintura, cy - 1, 1, 1)
    traco(x0 + forma.cintura - 1, cy + forma.cinturaH, 1, 1)
    traco(x1 - forma.cintura, cy + forma.cinturaH, 1, 1)
  }
}

// ------------------------------------------------------------------ tudo junto
export function drawAvatar(p, config, x = 0, y = 0) {
  const c = { ...config }
  const o = { x, y }

  drawBase(p, o, c)

  // vestido cobre a peça de baixo; desenhar as duas deixaria a saia por cima
  const wearingDress = c.top === 'vestido'
  if (!wearingDress && BOTTOMS[c.bottom]) BOTTOMS[c.bottom](p, o, c.bottom_color)
  if (TOPS[c.top]) TOPS[c.top](p, o, c.top_color)
  if (SHOES[c.shoes]) SHOES[c.shoes](p, o, c.shoes_color)
  esculpirCorpo(p, o, c)
  if (HAIR[c.hair_style]) HAIR[c.hair_style](p, o, c.hair_color)
  drawFace(p, o, c)
  if (HEAD_ACC[c.head]) HEAD_ACC[c.head](p, o)
  if (EXTRA_ACC[c.extra]) EXTRA_ACC[c.extra](p, o)
}

/** Desenha o avatar num canvas do tamanho certo. Usado pela loja e pelo editor. */
export function paintAvatar(canvas, config, { padding = 4 } = {}) {
  const painter = new Painter(canvas)
  painter.resize(AVATAR_W + padding * 2, AVATAR_H + padding * 2 + 4)
  painter.clear()
  // sombrinha no chão: sem ela o boneco parece flutuando
  painter.ctx.fillStyle = 'rgba(74,59,55,0.18)'
  painter.ctx.fillRect(padding + 9, padding + AVATAR_H + 1, 14, 3)
  drawAvatar(painter, config, padding, padding)
  return painter
}

export const STYLE_LISTS = {
  hair: Object.keys(HAIR),
  top: Object.keys(TOPS),
  bottom: Object.keys(BOTTOMS),
  shoes: Object.keys(SHOES),
  head: Object.keys(HEAD_ACC),
  extra: Object.keys(EXTRA_ACC),
  eyes: Object.keys(EYES),
  mouth: Object.keys(MOUTHS),
  brows: Object.keys(BROWS),
  corpo: Object.keys(CORPOS),
}
