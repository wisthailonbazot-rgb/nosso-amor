// As figurinhas do chat, desenhadas em pixel.
//
// Cada uma é uma função que pinta retângulos numa arte de 32x32, ampliada depois
// sem borrar. Escolhi função em vez de desenho escrito linha a linha porque
// figurinha tem muita forma redonda repetida (coração, carinha, bolha) — com
// funções auxiliares, cada figurinha nova sai em poucas linhas em vez de 32.
//
// A lista de códigos válidos vive no servidor (`routers/chat.py`). Se um código
// chegar sem desenho aqui, aparece um coração no lugar — nunca um buraco.

const C = {
  out: '#3b2b26',
  white: '#fffaf3',
  rose: '#e8879b',
  roseDark: '#c9607a',
  rosePale: '#ffd3dd',
  skin: '#f6d5c0',
  skinDark: '#e0b49a',
  hair: '#4a3524',
  gold: '#f2b33d',
  goldDark: '#d99a24',
  sage: '#9cbf9a',
  sageDark: '#6f9c6d',
  sky: '#a8cde0',
  blue: '#5b8def',
  purple: '#c9b6e8',
  brown: '#8a5f3c',
  gray: '#8d7a70',
}

export const STICKER_SIZE = 32

// ------------------------------------------------------------------ auxiliares
function fill(p, x, y, w, h, color) {
  p.rect(x, y, w, h, color)
}

/**
 * Pinta uma forma descrita como máscara de linhas e devolve os pixels usados.
 *
 * O contorno é calculado, não desenhado à mão: um pixel vira contorno quando ele
 * está vazio e tem vizinho cheio. Isso garante contorno certo em qualquer escala
 * e evita o que estava acontecendo antes — traço colado no lugar errado, que
 * transformava o desenho numa mancha.
 */
function stamp(p, mask, x0, y0, scale, color, line = C.out) {
  const h = mask.length
  const w = mask[0].length
  const on = (i, j) => i >= 0 && j >= 0 && i < h && j < w && mask[i][j] !== ' '

  if (line) {
    for (let i = -1; i <= h; i++) {
      for (let j = -1; j <= w; j++) {
        if (on(i, j)) continue
        const vizinho =
          on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)
        if (vizinho) fill(p, x0 + j * scale, y0 + i * scale, scale, scale, line)
      }
    }
  }
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      if (on(i, j)) fill(p, x0 + j * scale, y0 + i * scale, scale, scale, color)
    }
  }
}

// Coração de verdade: dois lóbulos em cima e uma ponta embaixo. Desenhado uma
// vez como máscara e reaproveitado em qualquer tamanho — foi tentar calcular a
// forma que produzia triângulo em vez de coração.
const HEART_MASK = [
  ' XX   XX ',
  'XXXXXXXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  ' XXXXXXX ',
  '  XXXXX  ',
  '   XXX   ',
  '    X    ',
]

/** `size` é o raio aproximado: o coração fica com cerca de 2x isso de largura. */
function heart(p, cx, cy, size, color, line = C.out) {
  const scale = Math.max(1, Math.round(size / 4))
  const w = HEART_MASK[0].length * scale
  const h = HEART_MASK.length * scale
  stamp(p, HEART_MASK, Math.round(cx - w / 2), Math.round(cy - h / 2), scale, color, line)
}

/** Círculo cheio em pixel, com contorno derivado da própria forma. */
function disc(p, cx, cy, r, color, line = C.out) {
  const dentro = (dx, dy) => dx * dx + dy * dy <= r * r + r * 0.4

  if (line) {
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        if (dentro(dx, dy)) continue
        const vizinho =
          dentro(dx - 1, dy) || dentro(dx + 1, dy) || dentro(dx, dy - 1) || dentro(dx, dy + 1)
        if (vizinho) p.px(cx + dx, cy + dy, line)
      }
    }
  }
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dentro(dx, dy)) p.px(cx + dx, cy + dy, color)
    }
  }
}

/** Carinha simples: rosto + olhos + boca. */
function face(p, cx, cy, r, { eyes = 'normal', mouth = 'smile', blush = true } = {}) {
  disc(p, cx, cy, r, C.skin)
  const ex = Math.round(r * 0.45)
  const ey = Math.round(r * 0.15)

  if (eyes === 'closed' || eyes === 'happy') {
    fill(p, cx - ex - 1, cy - ey, 3, 1, C.out)
    fill(p, cx + ex - 1, cy - ey, 3, 1, C.out)
    if (eyes === 'happy') {
      p.px(cx - ex - 2, cy - ey - 1, C.out)
      p.px(cx - ex + 1, cy - ey - 1, C.out)
      p.px(cx + ex - 2, cy - ey - 1, C.out)
      p.px(cx + ex + 1, cy - ey - 1, C.out)
    }
  } else if (eyes === 'hearts') {
    heart(p, cx - ex, cy - ey, 4, C.roseDark, null)
    heart(p, cx + ex, cy - ey, 4, C.roseDark, null)
  } else if (eyes === 'sad') {
    fill(p, cx - ex - 1, cy - ey, 2, 2, C.out)
    fill(p, cx + ex, cy - ey, 2, 2, C.out)
    fill(p, cx - ex - 2, cy - ey - 2, 4, 1, C.out)
    fill(p, cx + ex - 1, cy - ey - 2, 4, 1, C.out)
  } else {
    fill(p, cx - ex - 1, cy - ey, 2, 3, C.out)
    fill(p, cx + ex, cy - ey, 2, 3, C.out)
    p.px(cx - ex - 1, cy - ey, C.white)
    p.px(cx + ex, cy - ey, C.white)
  }

  const my = cy + Math.round(r * 0.42)
  if (mouth === 'smile') {
    fill(p, cx - 2, my, 4, 1, C.out)
    p.px(cx - 3, my - 1, C.out)
    p.px(cx + 2, my - 1, C.out)
  } else if (mouth === 'kiss') {
    fill(p, cx - 1, my - 1, 3, 2, C.roseDark)
  } else if (mouth === 'open') {
    fill(p, cx - 2, my - 1, 5, 3, C.out)
    fill(p, cx - 1, my, 3, 1, C.rose)
  } else if (mouth === 'flat') {
    fill(p, cx - 2, my, 5, 1, C.out)
  } else if (mouth === 'frown') {
    fill(p, cx - 2, my, 4, 1, C.out)
    p.px(cx - 3, my + 1, C.out)
    p.px(cx + 2, my + 1, C.out)
  }

  if (blush) {
    fill(p, cx - r + 1, cy + Math.round(r * 0.25), 3, 2, C.rosePale)
    fill(p, cx + r - 3, cy + Math.round(r * 0.25), 3, 2, C.rosePale)
  }
}

// ------------------------------------------------------------------ figurinhas
export const STICKERS = {
  coracao(p) {
    heart(p, 16, 16, 12, C.rose)
    // brilho: um risquinho claro no lóbulo esquerdo, como reflexo de luz
    fill(p, 9, 9, 3, 5, C.rosePale)
    fill(p, 12, 8, 2, 3, C.rosePale)
  },

  beijo(p) {
    face(p, 14, 15, 9, { eyes: 'closed', mouth: 'kiss' })
    heart(p, 26, 6, 5, C.roseDark)
    heart(p, 27, 15, 3, C.rose)
  },

  abraco(p) {
    // dois corpinhos encostados, e só depois as cabeças por cima
    fill(p, 4, 20, 11, 9, C.rose)
    fill(p, 17, 20, 11, 9, C.blue)
    fill(p, 3, 19, 13, 1, C.out)
    fill(p, 16, 19, 13, 1, C.out)
    fill(p, 3, 20, 1, 9, C.out)
    fill(p, 28, 20, 1, 9, C.out)
    face(p, 10, 12, 6, { eyes: 'happy', mouth: 'smile' })
    face(p, 22, 12, 6, { eyes: 'happy', mouth: 'smile' })
    heart(p, 16, 24, 5, C.roseDark)
  },

  saudade(p) {
    face(p, 16, 17, 9, { eyes: 'sad', mouth: 'frown' })
    // lagriminha
    fill(p, 9, 20, 2, 3, C.sky)
    p.px(9, 23, C.sky)
    heart(p, 26, 6, 4, C.rose)
  },

  carinha_apaixonada(p) {
    face(p, 16, 17, 10, { eyes: 'hearts', mouth: 'smile' })
    heart(p, 5, 5, 3, C.rose)
    heart(p, 27, 7, 3, C.roseDark)
  },

  dormindo(p) {
    face(p, 14, 18, 9, { eyes: 'closed', mouth: 'flat' })
    // zzz subindo
    fill(p, 24, 4, 5, 1, C.gray)
    fill(p, 27, 5, 1, 1, C.gray)
    fill(p, 25, 6, 1, 1, C.gray)
    fill(p, 24, 7, 5, 1, C.gray)
    fill(p, 25, 10, 4, 1, C.gray)
    fill(p, 27, 11, 1, 1, C.gray)
    fill(p, 25, 12, 4, 1, C.gray)
  },

  com_fome(p) {
    face(p, 16, 12, 8, { eyes: 'normal', mouth: 'open' })
    // garfo e faca
    fill(p, 5, 22, 2, 8, C.gray)
    fill(p, 4, 22, 1, 3, C.gray)
    fill(p, 7, 22, 1, 3, C.gray)
    fill(p, 25, 22, 2, 8, C.gray)
    fill(p, 25, 21, 3, 4, C.gray)
    fill(p, 12, 24, 9, 5, C.brown)
    fill(p, 12, 23, 9, 1, C.out)
  },

  chateado(p) {
    face(p, 16, 18, 9, { eyes: 'sad', mouth: 'frown', blush: false })
    // nuvenzinha em cima
    disc(p, 12, 6, 4, C.gray)
    disc(p, 19, 6, 3, C.gray)
    fill(p, 11, 12, 2, 4, C.sky)
    fill(p, 17, 12, 2, 3, C.sky)
  },

  risada(p) {
    face(p, 16, 16, 10, { eyes: 'happy', mouth: 'open' })
    // lágrimas de rir
    fill(p, 4, 14, 2, 4, C.sky)
    fill(p, 26, 14, 2, 4, C.sky)
  },

  piscada(p) {
    disc(p, 16, 16, 10, C.skin)
    fill(p, 10, 14, 3, 1, C.out) // olho fechado
    fill(p, 19, 13, 2, 3, C.out) // olho aberto
    p.px(19, 13, C.white)
    fill(p, 14, 21, 4, 1, C.out)
    p.px(13, 20, C.out)
    p.px(18, 20, C.out)
    fill(p, 7, 19, 3, 2, C.rosePale)
    fill(p, 23, 19, 3, 2, C.rosePale)
    heart(p, 27, 5, 3, C.rose)
  },

  flor(p) {
    // pétalas
    for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0], [4, -4], [4, 4], [-4, 4], [-4, -4]]) {
      disc(p, 16 + dx, 12 + dy, 3, C.rose)
    }
    disc(p, 16, 12, 3, C.gold)
    fill(p, 15, 16, 2, 13, C.sageDark)
    fill(p, 10, 22, 5, 3, C.sage)
    fill(p, 17, 25, 5, 3, C.sage)
  },

  cafe(p) {
    fill(p, 7, 12, 16, 14, C.white)
    fill(p, 6, 11, 18, 1, C.out)
    fill(p, 6, 26, 18, 1, C.out)
    fill(p, 6, 12, 1, 14, C.out)
    fill(p, 23, 12, 1, 14, C.out)
    fill(p, 8, 13, 14, 4, C.brown)
    fill(p, 24, 15, 4, 1, C.out)
    fill(p, 27, 16, 1, 4, C.out)
    fill(p, 24, 20, 4, 1, C.out)
    // fumacinha
    fill(p, 11, 5, 1, 4, C.gray)
    fill(p, 12, 3, 1, 2, C.gray)
    fill(p, 17, 5, 1, 4, C.gray)
    fill(p, 18, 3, 1, 2, C.gray)
  },

  bolo(p) {
    fill(p, 15, 3, 2, 5, C.gold) // vela
    p.px(15, 1, C.goldDark)
    fill(p, 15, 0, 2, 2, C.gold)
    fill(p, 6, 9, 20, 6, C.white)
    fill(p, 6, 15, 20, 8, C.rose)
    fill(p, 6, 23, 20, 4, C.white)
    fill(p, 5, 8, 22, 1, C.out)
    fill(p, 5, 27, 22, 1, C.out)
    fill(p, 5, 9, 1, 18, C.out)
    fill(p, 26, 9, 1, 18, C.out)
    for (let x = 8; x < 25; x += 5) fill(p, x, 11, 2, 3, C.roseDark)
  },

  estrela(p) {
    const pts = [
      [16, 3], [18, 11], [27, 11], [20, 16], [23, 25],
      [16, 20], [9, 25], [12, 16], [5, 11], [14, 11],
    ]
    p.fillPoly(pts, C.gold)
    p.strokePoly(pts, C.out)
    fill(p, 14, 10, 3, 3, '#fff0c2')
  },

  chuva(p) {
    disc(p, 12, 10, 5, C.white)
    disc(p, 20, 10, 4, C.white)
    fill(p, 10, 12, 12, 4, C.white)
    fill(p, 9, 16, 15, 1, C.out)
    for (const [x, y] of [[10, 20], [15, 22], [20, 19], [13, 26], [19, 26]]) {
      fill(p, x, y, 2, 3, C.sky)
      p.px(x, y + 3, C.sky)
    }
  },

  sol(p) {
    for (const [dx, dy] of [[0, -11], [11, 0], [0, 11], [-11, 0]]) {
      fill(p, 15 + dx, 15 + dy, 3, 3, C.gold)
    }
    for (const [dx, dy] of [[8, -8], [8, 8], [-8, 8], [-8, -8]]) {
      fill(p, 15 + dx, 15 + dy, 2, 2, C.gold)
    }
    disc(p, 16, 16, 7, C.gold)
    fill(p, 12, 14, 2, 2, C.out)
    fill(p, 18, 14, 2, 2, C.out)
    fill(p, 14, 19, 4, 1, C.out)
    fill(p, 10, 18, 2, 2, C.goldDark)
    fill(p, 20, 18, 2, 2, C.goldDark)
  },

  gatinho(p) {
    // orelhas
    p.fillPoly([[7, 12], [10, 4], [14, 11]], C.gold)
    p.fillPoly([[25, 12], [22, 4], [18, 11]], C.gold)
    p.strokePoly([[7, 12], [10, 4], [14, 11]], C.out)
    p.strokePoly([[25, 12], [22, 4], [18, 11]], C.out)
    p.fillPoly([[9, 11], [10, 7], [12, 11]], C.rose)
    p.fillPoly([[23, 11], [22, 7], [20, 11]], C.rose)
    disc(p, 16, 17, 9, C.gold)
    fill(p, 12, 15, 2, 3, C.out)
    fill(p, 18, 15, 2, 3, C.out)
    p.px(12, 15, C.white)
    p.px(18, 15, C.white)
    fill(p, 15, 19, 2, 2, C.roseDark)
    fill(p, 14, 21, 1, 1, C.out)
    fill(p, 17, 21, 1, 1, C.out)
    // bigodes
    fill(p, 4, 18, 5, 1, C.out)
    fill(p, 23, 18, 5, 1, C.out)
    fill(p, 4, 21, 5, 1, C.out)
    fill(p, 23, 21, 5, 1, C.out)
    fill(p, 6, 22, 3, 2, C.rosePale)
    fill(p, 23, 22, 3, 2, C.rosePale)
  },

  presente(p) {
    fill(p, 5, 13, 22, 15, C.rose)
    fill(p, 4, 12, 24, 1, C.out)
    fill(p, 4, 28, 24, 1, C.out)
    fill(p, 4, 13, 1, 15, C.out)
    fill(p, 27, 13, 1, 15, C.out)
    fill(p, 4, 12, 24, 4, C.roseDark) // tampa
    fill(p, 14, 12, 4, 16, C.gold) // fita
    fill(p, 4, 18, 24, 3, C.gold)
    // laço
    disc(p, 12, 8, 4, C.gold)
    disc(p, 20, 8, 4, C.gold)
    fill(p, 14, 6, 4, 6, C.goldDark)
  },
  quero_voce(p) {
    face(p,10,17,7,{eyes:'hearts',mouth:'kiss'});face(p,23,15,7,{eyes:'closed',mouth:'smile'})
    heart(p,17,25,5,C.roseDark);fill(p,4,3,24,3,C.purple)
  },
  hoje_tem(p) {
    heart(p,16,15,12,C.roseDark);fill(p,8,12,16,2,C.white);fill(p,10,17,12,2,C.white)
    fill(p,12,24,8,3,C.gold)
  },
  vem_ca(p) {
    face(p,12,16,8,{eyes:'happy',mouth:'kiss'});heart(p,25,9,5,C.rose)
    p.line(20,23,28,23,C.out);p.line(25,20,28,23,C.out);p.line(25,26,28,23,C.out)
  },
  beijo_pescoco(p) {
    face(p,12,13,7,{eyes:'closed',mouth:'kiss'});face(p,21,19,8,{eyes:'closed',mouth:'smile'})
    heart(p,7,25,4,C.roseDark);heart(p,27,7,3,C.rose)
  },
  debaixo_coberta(p) {
    fill(p,3,16,26,13,C.purple);fill(p,3,15,26,2,C.out)
    face(p,11,13,6,{eyes:'happy',mouth:'smile'});face(p,22,13,6,{eyes:'closed',mouth:'kiss'})
    heart(p,16,24,4,C.rose)
  },
  fogo(p) {
    p.fillPoly([[16,29],[7,24],[9,15],[14,19],[13,5],[21,13],[24,8],[26,22]],C.roseDark)
    p.fillPoly([[16,27],[12,23],[16,13],[20,21],[22,17],[22,25]],C.gold)
    heart(p,16,23,4,C.white,null)
  },
  toma_amor(p) {
    face(p,11,16,8,{eyes:'happy',mouth:'kiss'});heart(p,23,11,6,C.roseDark)
    heart(p,26,23,3,C.rose);p.line(17,20,24,25,C.skinDark)
  },
  grudinho(p) {
    face(p,11,15,7,{eyes:'hearts',mouth:'smile'});face(p,22,15,7,{eyes:'happy',mouth:'smile'})
    fill(p,5,22,22,7,C.purple);heart(p,16,25,4,C.roseDark)
  },
  menstruacao(p) {
    fill(p,6,7,20,21,C.white);fill(p,6,7,20,5,C.rose);fill(p,10,4,2,7,C.out);fill(p,20,4,2,7,C.out)
    p.fillPoly([[16,14],[11,22],[13,27],[19,27],[21,22]],C.roseDark);p.strokePoly([[16,14],[11,22],[13,27],[19,27],[21,22]],C.out)
  },
  amo_voce(p) {
    face(p,12,14,8,{eyes:'normal',mouth:'kiss'});heart(p,23,19,8,C.roseDark)
    fill(p,6,24,7,3,C.skinDark);fill(p,20,25,7,3,C.skinDark)
  },
  cafune(p) {
    face(p,16,18,9,{eyes:'happy',mouth:'smile'});fill(p,7,5,18,4,C.skinDark)
    fill(p,5,7,6,3,C.skin);fill(p,21,7,6,3,C.skin)
  },
  amor_seguro(p) {
    fill(p,4,10,11,15,C.rosePale);fill(p,17,10,11,15,C.sky);fill(p,4,9,24,2,C.out)
    heart(p,16,19,6,C.roseDark)
  },
  amor_protegido(p) {
    p.fillPoly([[16,3],[27,8],[25,22],[16,29],[7,22],[5,8]],C.purple);p.strokePoly([[16,3],[27,8],[25,22],[16,29],[7,22],[5,8]],C.out)
    heart(p,16,16,6,C.roseDark)
  },
  // "Uau": a única da foto de referência que ainda não existia aqui.
  // Olhos de coração, boca aberta e brilhos em volta — o espanto apaixonado.
  uau(p) {
    face(p, 16, 17, 9, { eyes: 'hearts', mouth: 'open' })
    // brilhos de quatro pontas, em pixel: a estrelinha de espanto
    for (const [bx, by, t] of [[4, 6, 2], [27, 8, 2], [25, 24, 1], [6, 22, 1]]) {
      fill(p, bx - t, by, t * 2 + 1, 1, C.gold)
      fill(p, bx, by - t, 1, t * 2 + 1, C.gold)
      p.px(bx, by, C.white)
    }
    // dois coraçõezinhos subindo
    heart(p, 9, 4, 3, C.rose, null)
    heart(p, 23, 3, 3, C.roseDark, null)
  },

  comemoracao(p) {
    face(p,16,18,9,{eyes:'happy',mouth:'open'});fill(p,5,4,2,5,C.gold);fill(p,25,5,2,5,C.sky)
    p.line(9,3,12,8,C.roseDark);p.line(21,8,24,2,C.sageDark)
  },
  acabei(p) {
    face(p,16,18,9,{eyes:'sad',mouth:'open',blush:false});fill(p,7,5,4,3,C.brown);fill(p,21,4,4,3,C.brown)
    fill(p,4,8,3,2,C.brown);fill(p,26,9,3,2,C.brown)
  },
  sono_a_dois(p) {
    fill(p,3,16,26,13,C.blue);fill(p,3,15,26,2,C.out);face(p,11,13,6,{eyes:'closed',mouth:'smile'});face(p,22,13,6,{eyes:'closed',mouth:'smile'})
    heart(p,16,24,3,C.rose)
  },
  mordida(p) {
    fill(p,6,12,20,10,C.roseDark);fill(p,8,11,16,2,C.white);fill(p,8,22,16,2,C.white)
    fill(p,11,13,3,3,C.white);fill(p,18,13,3,3,C.white)
  },
  meu_dia(p) {
    face(p,13,17,8,{eyes:'happy',mouth:'smile'});fill(p,22,8,7,13,C.blue);fill(p,23,9,5,9,C.sky)
    heart(p,25,24,3,C.rose)
  },
  foi_mal(p) {
    face(p,14,16,9,{eyes:'sad',mouth:'frown',blush:false});fill(p,22,11,7,12,C.white);fill(p,23,13,5,2,C.roseDark)
    fill(p,8,23,2,4,C.sky)
  },
}

export function drawSticker(painter, code) {
  const draw = STICKERS[code] || STICKERS.coracao
  draw(painter)
}

export const STICKER_CODES = Object.keys(STICKERS)

/**
 * O nome de cada figurinha, do jeito que a gente fala.
 *
 * A referencia que o dono mandou mostra cada figurinha COM o nome embaixo, e e
 * assim que ele espera escolher. Sem nome, "grudinho" e "toma_amor" viravam
 * dois bonequinhos parecidos e ninguem achava o que queria.
 *
 * Figurinha que nao esta aqui aparece com o proprio codigo — some ninguem, mas
 * fica feio; a bancada `/lab` denuncia as que faltam.
 */
export const STICKER_LABEL = {
  saudade: 'Saudades',
  vem_ca: 'Vem pra cá',
  beijo: 'Beijo',
  toma_amor: 'Toma s2',
  uau: 'Uau',
  grudinho: 'Grudadinho',
  menstruacao: 'Menstruação',
  amo_voce: 'Amo vc',
  cafune: 'Cafuné',
  abraco: 'Abraço',
  amor_seguro: 'Amor seguro',
  amor_protegido: 'Amor protegido',
  comemoracao: 'Boa!',
  acabei: 'Acabei',
  sono_a_dois: 'Sono a dois',
  mordida: 'Mordida',
  meu_dia: 'Meu dia',
  foi_mal: 'Foi mal',
  quero_voce: 'Quero você',
  beijo_pescoco: 'No pescoço',
  debaixo_coberta: 'Debaixo da coberta',
  hoje_tem: 'Hoje tem',
  coracao: 'Coração',
  carinha_apaixonada: 'Apaixonada',
  piscada: 'Piscadinha',
  risada: 'Risada',
  chateado: 'Chateado',
  com_fome: 'Com fome',
  dormindo: 'Dormindo',
  presente: 'Presente',
  flor: 'Flor',
  bolo: 'Bolo',
  cafe: 'Café',
  sol: 'Sol',
  chuva: 'Chuva',
  estrela: 'Estrela',
  fogo: 'Fogo',
  gatinho: 'Gatinho',
  disc: 'Música',
  draw: 'Desenho',
  stamp: 'Selo',
}
