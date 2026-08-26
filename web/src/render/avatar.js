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

/**
 * Várias caixas que formam UMA peça: contorno de todas, depois preenchimento de
 * todas.
 *
 * Este é o conserto do "boneco com dois braços de cada lado", e a causa é a
 * mesma emenda que já tinha aparecido no bichinho (HANDOFF 9.4, defeito 2).
 *
 * `box()` pinta o contorno e logo em seguida o preenchimento daquela caixa. Com
 * duas caixas encostadas — a manga (x 6..8) e o tronco (x 9..22) — a manga era
 * desenhada DEPOIS, e o contorno dela caía em x=9, que é o primeiro pixel do
 * tronco. Resultado: uma coluna escura de 11 px descendo por dentro da camisa,
 * coladinha no braço. Ampliada na tela, ela lê exatamente como um segundo
 * braço. Não era um erro de posição de nenhuma das duas peças: era o traço de
 * uma caindo dentro da outra, e acontecia em TODA roupa de cima com manga.
 *
 * Fazendo os dois passes, todo contorno é pintado antes de qualquer
 * preenchimento — então o preenchimento do tronco cobre o traço da manga e só
 * sobra traço na silhueta de fora, que é onde ele deve estar.
 */
function peca(p, o, partes) {
  for (const [x, y, w, h] of partes) p.rect(o.x + x - 1, o.y + y - 1, w + 2, h + 2, OUT)
  for (const [x, y, w, h, cor] of partes) p.rect(o.x + x, o.y + y, w, h, cor)
}

/**
 * O vinco que separa o braço do tronco depois que a emenda sumiu.
 *
 * Sem o traço preto entre os dois, manga e corpo viram uma massa só da mesma
 * cor — e aí o braço deixa de existir. Uma linha de 1 px numa sombra da própria
 * cor da roupa devolve a separação sem o peso do contorno, que era o problema.
 */
function vinco(p, o, x, y, h, cor) {
  flat(p, o, x, y, 1, h, shade(cor, -0.2))
}

// ------------------------------------------------------------------ corpo
function drawBase(p, o, c) {
  const skin = c.skin
  const dark = shade(skin, -0.18)

  // O corpo inteiro numa peça só: contorno de tudo, depois pele de tudo. Braço
  // e tronco encostam, e desenhar um de cada vez carimbava o traço de um dentro
  // do outro (ver `peca`).
  peca(p, o, [
    [LEG_L.x, LEG_L.y, LEG_L.w, LEG_L.h, skin],
    [LEG_R.x, LEG_R.y, LEG_R.w, LEG_R.h, skin],
    [ARM_L.x, ARM_L.y, ARM_L.w, ARM_L.h, skin],
    [ARM_R.x, ARM_R.y, ARM_R.w, ARM_R.h, skin],
    [TORSO.x, TORSO.y, TORSO.w, TORSO.h, skin],
  ])
  // O vinco do braço: com a emenda removida, sem ele o braço some no tronco.
  vinco(p, o, ARM_L.x + ARM_L.w, ARM_L.y, ARM_L.h, skin)
  vinco(p, o, ARM_R.x - 1, ARM_R.y, ARM_R.h, skin)
  flat(p, o, 14, 21, 4, 3, dark) // pescoço, na sombra do queixo

  // cabeça e orelhinhas
  peca(p, o, [
    [HEAD.x, HEAD.y, HEAD.w, HEAD.h, skin],
    [6, 12, 2, 4, skin],
    [24, 12, 2, 4, skin],
  ])
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
/**
 * A touca de cabelo que TODO corte usa como base.
 *
 * Antes cada corte pintava so uma faixa de 6 px no alto da cabeca (y 3..8) e
 * mais dois tracinhos nas tempora. O cranio dos lados — x 8..10 e x 21..23, de
 * y 9 ate y 20 — ficava com a COR DA PELE. Ampliado na tela isso le como
 * entrada funda dos dois lados, e foi o "a maioria dos bonecos e careca": nao
 * faltava um corte, faltava volume em todos eles.
 *
 * `alto` = ate onde o cabelo sobe acima do cranio (volume no topo).
 * `lado` = ate que altura ele desce pelo lado da cabeca (costeleta).
 */
function casco(p, o, col, { alto = 2, lado = 14 } = {}) {
  peca(p, o, [
    [7, alto, 18, 9 - alto, col],
    [7, 9, 2, lado - 9, col],
    [23, 9, 2, lado - 9, col],
  ])
  flat(p, o, 9, alto + 1, 5, 2, shade(col, 0.28)) // o brilho, que da o volume
}

const HAIR = {
  curto: (p, o, col) => {
    casco(p, o, col, { lado: 14 })
    flat(p, o, 9, 9, 3, 1, col)   // pontinha da franja, quebrando a linha reta
    flat(p, o, 20, 9, 3, 1, col)
  },
  medio: (p, o, col) => {
    casco(p, o, col, { lado: 17 })
    peca(p, o, [[6, 12, 3, 6, col], [23, 12, 3, 6, col]])
  },
  longo: (p, o, col) => {
    casco(p, o, col, { lado: 16 })
    peca(p, o, [[5, 11, 4, 19, col], [23, 11, 4, 19, col]])
    flat(p, o, 5, 28, 4, 2, shade(col, -0.2))
    flat(p, o, 23, 28, 4, 2, shade(col, -0.2))
  },
  cacheado: (p, o, col) => {
    casco(p, o, col, { alto: 1, lado: 15 })
    // Os cachos entram como uma peca so, senao o contorno de cada bolinha cai
    // dentro da vizinha e o volume vira uma renda escura.
    peca(p, o, [
      [4, 4, 4, 4, col], [24, 4, 4, 4, col],
      [4, 9, 4, 4, col], [24, 9, 4, 4, col],
      [6, 14, 4, 4, col], [22, 14, 4, 4, col],
      [8, 0, 6, 3, col], [18, 0, 6, 3, col],
    ])
    flat(p, o, 9, 3, 4, 2, shade(col, 0.25))
  },
  coque: (p, o, col) => {
    casco(p, o, col, { lado: 13 })
    peca(p, o, [[13, -3, 7, 6, col]])
    flat(p, o, 14, -2, 3, 2, shade(col, 0.28))
  },
  franja: (p, o, col) => {
    casco(p, o, col, { lado: 17 })
    // A franja desce ate a linha da sobrancelha. Ela e desenhada DEPOIS do
    // cabelo (drawFace), entao aparece por cima — que e como franja fica.
    flat(p, o, 8, 9, 16, 2, col)
    peca(p, o, [[6, 11, 3, 8, col], [23, 11, 3, 8, col]])
  },
  rabo: (p, o, col) => {
    casco(p, o, col, { lado: 13 })
    peca(p, o, [[24, 8, 4, 15, col]])
    flat(p, o, 25, 21, 3, 2, shade(col, -0.22))
    flat(p, o, 22, 7, 3, 3, col)
  },
  moicano: (p, o, col) => {
    // O lado raspado NAO e pele: e o cabelo bem curto, numa sombra da cor. Com
    // a pele aparecendo, o corte lia como calvicie em vez de moicano.
    const raspado = shade(col, -0.45)
    casco(p, o, raspado, { alto: 4, lado: 13 })
    peca(p, o, [[13, -2, 6, 11, col]])
    flat(p, o, 14, -1, 2, 4, shade(col, 0.3))
  },
  chanel: (p, o, col) => {
    casco(p, o, col, { lado: 16 })
    peca(p, o, [[5, 11, 4, 11, col], [23, 11, 4, 11, col]])
    flat(p, o, 5, 20, 4, 2, shade(col, -0.22)) // as pontas viradas
    flat(p, o, 23, 20, 4, 2, shade(col, -0.22))
    flat(p, o, 8, 9, 16, 1, col)
  },
  trancas: (p, o, col) => {
    casco(p, o, col, { lado: 14 })
    peca(p, o, [[4, 12, 4, 16, col], [24, 12, 4, 16, col]])
    // os nos da tranca, alternados dos dois lados
    const no = shade(col, -0.3)
    for (let y = 14; y < 28; y += 4) {
      flat(p, o, 4, y, 4, 1, no)
      flat(p, o, 24, y + 2, 4, 1, no)
    }
    flat(p, o, 4, 27, 4, 2, '#e8879b') // a fitinha da ponta
    flat(p, o, 24, 27, 4, 2, '#e8879b')
  },
  afro: (p, o, col) => {
    peca(p, o, [
      [5, 0, 22, 12, col],
      [3, 3, 3, 8, col], [26, 3, 3, 8, col],
      [6, 11, 3, 5, col], [23, 11, 3, 5, col],
    ])
    flat(p, o, 8, 2, 5, 3, shade(col, 0.22))
    // reticulado do volume: da textura sem inventar uma terceira cor
    const t = shade(col, -0.22)
    for (let y = 1; y < 12; y++) for (let x = 5; x < 27; x++) if ((x + y) % 3 === 0) flat(p, o, x, y, 1, 1, t)
  },
  raspado: (p, o, col) => {
    // Careca DE PROPOSITO, e nao por falta de desenho. A sombra do cabelo na
    // pele e o que separa "raspou" de "o corte nao foi desenhado".
    const sombra = shade(col, -0.15)
    casco(p, o, sombra, { alto: 5, lado: 12 })
    const t = shade(col, 0.35)
    for (let y = 5; y < 12; y++) for (let x = 8; x < 24; x++) if ((x * 2 + y) % 5 === 0) flat(p, o, x, y, 1, 1, t)
  },
}

// ------------------------------------------------------------------ roupa
const TOPS = {
  camiseta: (p, o, col) => {
    peca(p, o, [
      [TORSO.x, TORSO.y, TORSO.w, 11, col],
      [ARM_L.x, ARM_L.y, 3, 4, col],
      [ARM_R.x, ARM_R.y, 3, 4, col],
    ])
    vinco(p, o, ARM_L.x + 3, ARM_L.y, 4, col)
    vinco(p, o, ARM_R.x - 1, ARM_R.y, 4, col)
    flat(p, o, 14, TORSO.y, 4, 2, shade(col, -0.25)) // gola
  },
  regata: (p, o, col) => {
    peca(p, o, [[11, TORSO.y, 10, 11, col]])
    flat(p, o, 13, TORSO.y, 6, 2, shade(col, -0.25))
  },
  moletom: (p, o, col) => {
    peca(p, o, [
      [8, TORSO.y - 1, 16, 13, col],
      [ARM_L.x, ARM_L.y - 1, 3, 11, col],
      [ARM_R.x, ARM_R.y - 1, 3, 11, col],
    ])
    vinco(p, o, ARM_L.x + 3, ARM_L.y - 1, 11, col)
    vinco(p, o, ARM_R.x - 1, ARM_R.y - 1, 11, col)
    flat(p, o, 12, TORSO.y - 1, 8, 3, shade(col, -0.2)) // capuz
    flat(p, o, 15, 30, 2, 4, shade(col, -0.3)) // cordao
  },
  vestido: (p, o, col) => {
    peca(p, o, [
      [11, TORSO.y, 10, 10, col],
      [8, 33, 16, 9, col],
    ])
    flat(p, o, 8, 40, 16, 2, shade(col, -0.2))
    flat(p, o, 13, TORSO.y, 6, 2, shade(col, -0.25))
  },
  xadrez: (p, o, col) => {
    peca(p, o, [
      [TORSO.x, TORSO.y, TORSO.w, 12, col],
      [ARM_L.x, ARM_L.y, 3, 10, col],
      [ARM_R.x, ARM_R.y, 3, 10, col],
    ])
    const line = shade(col, -0.3)
    for (let y = TORSO.y + 2; y < TORSO.y + 12; y += 3) flat(p, o, TORSO.x, y, TORSO.w, 1, line)
    for (let x = TORSO.x + 2; x < TORSO.x + TORSO.w; x += 3) flat(p, o, x, TORSO.y, 1, 12, line)
    vinco(p, o, ARM_L.x + 3, ARM_L.y, 10, col)
    vinco(p, o, ARM_R.x - 1, ARM_R.y, 10, col)
  },
  jaqueta: (p, o, col) => {
    peca(p, o, [
      [8, TORSO.y - 1, 16, 13, col],
      [ARM_L.x - 1, ARM_L.y - 1, 4, 12, col],
      [ARM_R.x, ARM_R.y - 1, 4, 12, col],
    ])
    vinco(p, o, ARM_L.x + 3, ARM_L.y - 1, 12, col)
    vinco(p, o, ARM_R.x - 1, ARM_R.y - 1, 12, col)
    flat(p, o, 14, TORSO.y - 1, 4, 13, shade(col, -0.35)) // ziper
    flat(p, o, 15, TORSO.y, 2, 12, shade(col, 0.3))
    flat(p, o, 10, TORSO.y - 1, 4, 3, shade(col, -0.2)) // lapelas
    flat(p, o, 18, TORSO.y - 1, 4, 3, shade(col, -0.2))
  },
  social: (p, o, col) => {
    peca(p, o, [
      [TORSO.x, TORSO.y, TORSO.w, 12, col],
      [ARM_L.x, ARM_L.y, 3, 11, col],
      [ARM_R.x, ARM_R.y, 3, 11, col],
    ])
    vinco(p, o, ARM_L.x + 3, ARM_L.y, 11, col)
    vinco(p, o, ARM_R.x - 1, ARM_R.y, 11, col)
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
 * A silhueta do corpo, moldada DEPOIS de a roupa estar pintada.
 *
 * O problema: o boneco era um retangulo so, igual pros dois do pescoco pra
 * baixo. A primeira tentativa recortava 2 px de cintura com `clearRect` — o que
 * de fato mudava alguma coisa, mas tao pouco que o dono voltou dizendo que
 * continuava nao parecendo feminino. E ela nao tinha como ir mais longe: dava
 * pra ESTREITAR (apagando), nunca pra ALARGAR — alargar exigiria pintar fora do
 * tronco sem saber que roupa esta por baixo. Sem quadril, nao ha silhueta.
 *
 * O jeito que resolve os dois de uma vez e nao redesenhar nada: **reescalar
 * cada linha de pixel na horizontal**, em torno do meio do corpo. Um fator
 * abaixo de 1 estreita (ombro, cintura), acima de 1 alarga (quadril) — e como o
 * que esta sendo esticado sao os pixels JA PINTADOS, a roupa, a pele e o
 * contorno acompanham a forma sozinhos. Toda peca de roupa segue a silhueta sem
 * ganhar uma segunda versao, inclusive as que ainda nao existem: era esse o
 * requisito que impedia desenhar um segundo corpo (48 pecas x 2).
 *
 * Como e nearest-neighbour com `imageSmoothingEnabled: false` e largura
 * arredondada pra inteiro, a borda continua dura — nao borra a pixel art.
 */
const SILHUETAS = {
  reto: null, // o padrao: nada a moldar
  // y da arte -> fator de largura. Entre um ponto e outro o valor e interpolado,
  // senao a mudanca sairia em degrau seco e o corpo ficaria facetado.
  curvas: [
    [22, 0.86], // ombro estreito
    [26, 1.0],  // busto
    [31, 0.76], // cintura
    [36, 1.16], // quadril
    [41, 1.06],
    [45, 1.0],
  ],
}

/** O fator de largura naquela linha, interpolado entre os pontos do perfil. */
function fatorEm(perfil, y) {
  if (y <= perfil[0][0]) return perfil[0][1]
  const ultimo = perfil[perfil.length - 1]
  if (y >= ultimo[0]) return ultimo[1]
  for (let i = 0; i + 1 < perfil.length; i++) {
    const [ya, fa] = perfil[i]
    const [yb, fb] = perfil[i + 1]
    if (y >= ya && y <= yb) return fa + ((fb - fa) * (y - ya)) / (yb - ya)
  }
  return 1
}

// A faixa moldada: do alto do tronco ate o fim da perna. Nao encosta na cabeca
// (o rosto nao pode esticar) nem no calcado (pe esticado fica de palhaco).
const FAIXA = { y0: TORSO.y - 2, y1: 43 }

let _rascunho = null
function rascunho() {
  if (!_rascunho) _rascunho = document.createElement('canvas')
  return _rascunho
}

function moldarCorpo(p, o, c) {
  const perfil = SILHUETAS[c.corpo]
  if (!perfil) return
  const ctx = p.ctx
  const y0 = o.y + FAIXA.y0
  const altura = FAIXA.y1 - FAIXA.y0
  const meio = o.x + AVATAR_W / 2
  if (altura <= 0) return

  // Uma copia da faixa ANTES de mexer. Sem ela, cada linha seria lida ja
  // deformada pela linha anterior e o corpo derreteria de cima pra baixo.
  // O canvas de rascunho e reaproveitado: a loja desenha dezenas de avatares
  // numa tela so, e criar um canvas por boneco custa caro no celular.
  const copia = rascunho()
  copia.width = p.w
  copia.height = altura
  const cctx = copia.getContext('2d')
  cctx.imageSmoothingEnabled = false
  cctx.drawImage(p.canvas, 0, y0, p.w, altura, 0, 0, p.w, altura)

  ctx.clearRect(0, y0, p.w, altura)
  ctx.imageSmoothingEnabled = false
  for (let i = 0; i < altura; i++) {
    const f = fatorEm(perfil, FAIXA.y0 + i)
    // Largura inteira: meio pixel de destino e o que poria franja na pixel art.
    const larguraDestino = Math.max(1, Math.round(p.w * f))
    const destinoX = Math.round(meio - larguraDestino * (meio / p.w))
    ctx.drawImage(copia, 0, i, p.w, 1, destinoX, y0 + i, larguraDestino, 1)
  }
}

/**
 * O vinco do busto, por cima do que estiver vestido.
 *
 * A moldagem acima da a forma vista de fora, mas de frente um tronco liso
 * continua chapado. Este e o volume — e ele le a COR QUE ESTA NO CANVAS naquele
 * ponto pra se escurecer a partir dela, em vez de chutar uma cor. Assim ele cai
 * certo na pele, na camiseta, no vestido e em qualquer roupa futura, sem saber
 * qual delas esta ali.
 */
function vincoDoBusto(p, o, c) {
  if (c.corpo !== 'curvas') return
  const ctx = p.ctx
  const y = o.y + 28
  const marcas = [
    [o.x + 11, y], [o.x + 12, y + 1], [o.x + 13, y + 1],
    [o.x + 18, y + 1], [o.x + 19, y + 1], [o.x + 20, y],
  ]
  let dados
  try {
    dados = ctx.getImageData(o.x + 9, y, 14, 2)
  } catch {
    return // canvas "sujo" por imagem de outra origem: melhor sem o vinco
  }
  for (const [mx, my] of marcas) {
    const ix = mx - (o.x + 9)
    const iy = my - y
    const at = (iy * 14 + ix) * 4
    const alfa = dados.data[at + 3]
    if (alfa < 200) continue // fora do corpo: nao inventa pixel no ar
    const hex = `#${[0, 1, 2]
      .map((k) => dados.data[at + k].toString(16).padStart(2, '0'))
      .join('')}`
    p.rect(mx, my, 1, 1, shade(hex, -0.24))
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
  moldarCorpo(p, o, c)
  vincoDoBusto(p, o, c)
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
  corpo: Object.keys(SILHUETAS),
}
