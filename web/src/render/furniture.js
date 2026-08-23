// Os móveis. Cada um é uma função que compõe blocos isométricos.
//
// Nenhum arquivo de imagem: móvel novo é uma função nova aqui, e o item no
// catálogo do servidor só guarda o nome da forma, o tamanho em células e a cor.
// Girar o móvel troca largura por profundidade — a mesma função serve pras 4
// direções, e as que têm frente (sofá, cama, TV) recebem `dir` pra saber pra
// onde olhar.

import { FACE_LEFT, FACE_RIGHT, FACE_TOP, isoBox, project, groundShadow } from './iso'
import { mix, shade } from './pixel'

const OUTLINE = '#33203a'

/** Deriva as três faces a partir de uma cor só. */
export function faces(base) {
  return {
    top: shade(base, FACE_TOP),
    left: shade(base, FACE_LEFT),
    right: shade(base, FACE_RIGHT),
  }
}

/** Ferramentas que toda forma recebe, já amarradas à posição do item. */
function tools(p, item, origin) {
  const { col, row, w, d, dir = 0 } = item
  // Girar 90°: o que era largura vira profundidade. Assim uma forma só atende
  // as quatro direções sem desenho novo.
  const rotated = dir % 2 === 1
  const W = rotated ? d : w
  const D = rotated ? w : d

  /** Coordenadas locais (0..W, 0..D) -> absolutas, já respeitando a rotação. */
  const at = (lx, ly) => {
    switch (dir % 4) {
      case 1:
        return [col + (D - ly), row + lx]
      case 2:
        return [col + (W - lx), row + (D - ly)]
      case 3:
        return [col + ly, row + (W - lx)]
      default:
        return [col + lx, row + ly]
    }
  }

  return {
    W,
    D,
    /** Bloco em coordenada local. lw/ld são medidas, por isso passam pela rotação. */
    box(lx, ly, lw, ld, z, h, color) {
      const [ax, ay] = at(lx, ly)
      const [bx, by] = at(lx + lw, ly + ld)
      isoBox(
        p,
        faces(color),
        {
          col: Math.min(ax, bx),
          row: Math.min(ay, by),
          w: Math.abs(bx - ax),
          d: Math.abs(by - ay),
          z,
          h,
        },
        origin,
        OUTLINE
      )
    },
    /** Painel plano (tapete, tela, quadro deitado): bloco de altura zero. */
    flat(lx, ly, lw, ld, z, color) {
      const [ax, ay] = at(lx, ly)
      const [bx, by] = at(lx + lw, ly + ld)
      p.fillPoly(
        [
          project(Math.min(ax, bx), Math.min(ay, by), z, origin),
          project(Math.max(ax, bx), Math.min(ay, by), z, origin),
          project(Math.max(ax, bx), Math.max(ay, by), z, origin),
          project(Math.min(ax, bx), Math.max(ay, by), z, origin),
        ],
        color
      )
    },
    outlineFlat(lx, ly, lw, ld, z, color) {
      const [ax, ay] = at(lx, ly)
      const [bx, by] = at(lx + lw, ly + ld)
      p.strokePoly(
        [
          project(Math.min(ax, bx), Math.min(ay, by), z, origin),
          project(Math.max(ax, bx), Math.min(ay, by), z, origin),
          project(Math.max(ax, bx), Math.max(ay, by), z, origin),
          project(Math.min(ax, bx), Math.max(ay, by), z, origin),
        ],
        color
      )
    },
    /** Ponto na tela a partir de coordenada local — pra detalhe solto. */
    screen(lx, ly, z) {
      const [ax, ay] = at(lx, ly)
      return project(ax, ay, z, origin)
    },
  }
}

const WOOD = '#8a5f3c'
const WOOD_DARK = '#5f4028'

// ---------------------------------------------------------------- as formas
export const SHAPES = {
  sofa(p, item, origin, t) {
    const c = item.color || '#7fae7d'
    const k = tools(p, item, origin)
    k.box(0.15, 0.15, k.W - 0.3, k.D - 0.3, 0, 0.28, shade(c, -0.45)) // base
    k.box(0.1, 0.1, k.W - 0.2, 0.55, 0.28, 0.75, c) // encosto
    k.box(0.1, 0.6, 0.35, k.D - 0.7, 0.28, 0.45, shade(c, -0.12)) // braços
    k.box(k.W - 0.45, 0.6, 0.35, k.D - 0.7, 0.28, 0.45, shade(c, -0.12))
    k.box(0.5, 0.62, k.W - 1.0, k.D - 0.75, 0.28, 0.2, shade(c, 0.16)) // assento
    // almofadas
    k.box(0.6, 0.68, 0.5, 0.32, 0.48, 0.3, '#f2b33d')
    k.box(k.W - 1.1, 0.68, 0.5, 0.32, 0.48, 0.3, '#e8879b')
  },

  bed(p, item, origin) {
    const c = item.color || '#c88fb0'
    const k = tools(p, item, origin)
    k.box(0.1, 0.1, k.W - 0.2, k.D - 0.2, 0, 0.3, WOOD_DARK) // estrado
    k.box(0.05, 0.05, k.W - 0.1, 0.25, 0.3, 0.85, WOOD) // cabeceira
    k.box(0.12, 0.32, k.W - 0.24, k.D - 0.45, 0.3, 0.3, '#fdf4ea') // colchão
    k.box(0.12, 0.9, k.W - 0.24, k.D - 1.02, 0.55, 0.06, c) // coberta
    k.box(0.25, 0.4, 0.6, 0.4, 0.6, 0.16, '#ffffff') // travesseiros
    k.box(k.W - 0.85, 0.4, 0.6, 0.4, 0.6, 0.16, '#ffffff')
  },

  table(p, item, origin) {
    // madeira clara: a mesa fica no meio do cômodo, e escura demais virava
    // um buraco preto no meio do tapete
    const c = item.color || '#c19a68'
    const k = tools(p, item, origin)
    const leg = 0.16
    for (const [lx, ly] of [
      [0.12, 0.12],
      [k.W - 0.12 - leg, 0.12],
      [0.12, k.D - 0.12 - leg],
      [k.W - 0.12 - leg, k.D - 0.12 - leg],
    ]) {
      k.box(lx, ly, leg, leg, 0, 0.58, shade(c, -0.34))
    }
    k.box(0.06, 0.06, k.W - 0.12, k.D - 0.12, 0.52, 0.06, shade(c, -0.24)) // travessa
    k.box(0.02, 0.02, k.W - 0.04, k.D - 0.04, 0.58, 0.1, c) // tampo
    // veio da madeira no tampo, senão fica uma chapa lisa
    k.flat(0.16, 0.2, k.W - 0.32, 0.02, 0.685, shade(c, -0.14))
    k.flat(0.16, k.D / 2, k.W - 0.32, 0.02, 0.685, shade(c, -0.14))
    k.flat(0.16, k.D - 0.25, k.W - 0.32, 0.02, 0.685, shade(c, -0.14))
    // uma xicrinha em cima, pra mesa não ficar vazia
    k.box(k.W / 2 - 0.12, k.D / 2 - 0.1, 0.2, 0.2, 0.68, 0.14, '#fdf4ea')
    k.box(k.W / 2 - 0.09, k.D / 2 - 0.07, 0.14, 0.14, 0.8, 0.02, '#8a5f3c')
  },

  chair(p, item, origin) {
    const c = item.color || WOOD
    const k = tools(p, item, origin)
    const leg = 0.12
    for (const [lx, ly] of [
      [0.16, 0.16],
      [k.W - 0.16 - leg, 0.16],
      [0.16, k.D - 0.16 - leg],
      [k.W - 0.16 - leg, k.D - 0.16 - leg],
    ]) {
      k.box(lx, ly, leg, leg, 0, 0.45, shade(c, -0.3))
    }
    k.box(0.1, 0.1, k.W - 0.2, k.D - 0.2, 0.45, 0.1, c)
    k.box(0.1, 0.1, k.W - 0.2, 0.14, 0.55, 0.6, c) // encosto
  },

  shelf(p, item, origin) {
    const c = item.color || WOOD
    const k = tools(p, item, origin)
    k.box(0.08, 0.08, 0.14, k.D - 0.16, 0, 1.5, shade(c, -0.25)) // laterais
    k.box(k.W - 0.22, 0.08, 0.14, k.D - 0.16, 0, 1.5, shade(c, -0.25))
    for (const z of [0.02, 0.5, 0.98, 1.4]) {
      k.box(0.08, 0.1, k.W - 0.16, k.D - 0.2, z, 0.09, c)
    }
    // livrinhos coloridos
    const books = ['#e8879b', '#9cbf9a', '#f2b33d', '#a8cde0', '#c88fb0']
    books.forEach((color, i) => {
      k.box(0.28 + i * 0.16, 0.3, 0.11, 0.2, 0.59, 0.32 + (i % 3) * 0.06, color)
    })
    books.slice(0, 3).forEach((color, i) => {
      k.box(0.3 + i * 0.16, 0.3, 0.11, 0.2, 1.07, 0.26, color)
    })
  },

  wardrobe(p, item, origin) {
    const c = item.color || WOOD
    const k = tools(p, item, origin)
    k.box(0.06, 0.06, k.W - 0.12, k.D - 0.12, 0, 1.9, c)
    k.box(0.06, k.D - 0.14, (k.W - 0.12) / 2 - 0.03, 0.05, 0.08, 1.7, shade(c, -0.22))
    k.box(k.W / 2 + 0.01, k.D - 0.14, (k.W - 0.12) / 2 - 0.03, 0.05, 0.08, 1.7, shade(c, -0.22))
    k.box(k.W / 2 - 0.1, k.D - 0.18, 0.06, 0.06, 0.95, 0.1, '#f2b33d') // puxadores
    k.box(k.W / 2 + 0.06, k.D - 0.18, 0.06, 0.06, 0.95, 0.1, '#f2b33d')
  },

  puff(p, item, origin) {
    const c = item.color || '#e8879b'
    const k = tools(p, item, origin)
    k.box(0.22, 0.22, k.W - 0.44, k.D - 0.44, 0, 0.36, c)
    k.box(0.28, 0.28, k.W - 0.56, k.D - 0.56, 0.36, 0.08, shade(c, 0.2))
  },

  rug(p, item, origin) {
    const c = item.color || '#e8879b'
    const k = tools(p, item, origin)
    k.flat(0.05, 0.05, k.W - 0.1, k.D - 0.1, 0.01, c)
    k.flat(0.3, 0.3, k.W - 0.6, k.D - 0.6, 0.012, shade(c, 0.28))
    k.flat(0.55, 0.55, k.W - 1.1, k.D - 1.1, 0.014, shade(c, -0.2))
    k.outlineFlat(0.05, 0.05, k.W - 0.1, k.D - 0.1, 0.01, shade(c, -0.4))
  },

  tv(p, item, origin, t) {
    const k = tools(p, item, origin)
    k.box(k.W / 2 - 0.18, k.D / 2 - 0.1, 0.36, 0.2, 0, 0.22, '#3a2f4a') // pé
    k.box(0.08, k.D - 0.36, k.W - 0.16, 0.22, 0.22, 0.95, '#241d33') // corpo
    // a tela pisca devagar, como se estivesse ligada
    const glow = Math.sin((t || 0) / 900) > 0 ? '#4f7fb8' : '#3f6da8'
    k.flat(0.16, k.D - 0.38, k.W - 0.32, 0.02, 0.34, glow)
    k.box(0.16, k.D - 0.4, k.W - 0.32, 0.03, 0.34, 0.72, glow)
    k.box(k.W / 2 - 0.16, k.D - 0.42, 0.32, 0.02, 0.62, 0.18, '#ff7fa3') // coraçãozinho
  },

  speaker(p, item, origin, t) {
    const k = tools(p, item, origin)
    k.box(0.3, 0.3, k.W - 0.6, k.D - 0.6, 0, 0.08, '#3a3050') // pezinho
    k.box(0.26, 0.26, k.W - 0.52, k.D - 0.52, 0.08, 0.85, '#4a3f66') // caixa
    // os dois alto-falantes, com aro claro pra não virar bloco chapado
    k.box(0.32, k.D - 0.3, k.W - 0.64, 0.03, 0.2, 0.26, '#241d33')
    k.box(0.37, k.D - 0.31, k.W - 0.74, 0.03, 0.24, 0.18, '#8d7ab5')
    k.box(0.34, k.D - 0.3, k.W - 0.68, 0.03, 0.56, 0.2, '#241d33')
    k.box(0.38, k.D - 0.31, k.W - 0.76, 0.03, 0.59, 0.14, '#8d7ab5')
    // luzinha piscando: mostra que está ligado
    const on = Math.sin((t || 0) / 700) > 0
    k.box(0.42, k.D - 0.32, 0.1, 0.03, 0.82, 0.06, on ? '#7fd6b0' : '#3f6a5a')
  },

  console(p, item, origin, t) {
    const k = tools(p, item, origin)
    k.box(0.18, 0.3, k.W - 0.36, k.D - 0.62, 0, 0.26, '#3d3356') // aparelho
    k.box(0.22, 0.34, k.W - 0.44, k.D - 0.7, 0.26, 0.05, '#544773')
    const on = Math.sin((t || 0) / 900) > 0
    k.box(0.28, k.D - 0.36, 0.14, 0.03, 0.1, 0.06, on ? '#7fd6b0' : '#3f6a5a')
    k.box(0.5, k.D - 0.36, 0.3, 0.03, 0.1, 0.04, '#241d33') // entradinha
    // controle jogado do lado, com os dois analógicos
    k.box(0.3, k.D - 0.26, 0.42, 0.2, 0, 0.1, '#e8879b')
    k.box(0.34, k.D - 0.22, 0.1, 0.1, 0.1, 0.04, '#241d33')
    k.box(0.58, k.D - 0.22, 0.1, 0.1, 0.1, 0.04, '#241d33')
  },

  fridge(p, item, origin) {
    const k = tools(p, item, origin)
    k.box(0.1, 0.1, k.W - 0.2, k.D - 0.2, 0, 1.9, '#e9e4dc')
    k.box(0.1, k.D - 0.16, k.W - 0.2, 0.06, 0.08, 0.72, '#d5cec4')
    k.box(0.1, k.D - 0.16, k.W - 0.2, 0.06, 0.86, 0.98, '#d5cec4')
    k.box(k.W - 0.3, k.D - 0.2, 0.06, 0.08, 0.4, 0.24, '#8d7a70')
    k.box(k.W - 0.3, k.D - 0.2, 0.06, 0.08, 1.2, 0.24, '#8d7a70')
    k.box(0.3, k.D - 0.18, 0.16, 0.04, 1.4, 0.2, '#f2b33d') // imãzinho
  },

  plant(p, item, origin, t) {
    const k = tools(p, item, origin)
    const sway = Math.sin((t || 0) / 1400) * 0.03
    k.box(0.32, 0.32, k.W - 0.64, k.D - 0.64, 0, 0.34, '#c9744f') // vaso
    k.box(0.36, 0.36, k.W - 0.72, k.D - 0.72, 0.34, 0.05, '#6b4a34') // terra
    k.box(k.W / 2 - 0.05, k.D / 2 - 0.05, 0.1, 0.1, 0.38, 0.4, '#5f8a5d') // caule
    const leaf = '#7fae7d'
    k.box(k.W / 2 - 0.34 + sway, k.D / 2 - 0.12, 0.3, 0.24, 0.6, 0.14, leaf)
    k.box(k.W / 2 + 0.06 - sway, k.D / 2 - 0.14, 0.3, 0.24, 0.68, 0.14, shade(leaf, 0.12))
    k.box(k.W / 2 - 0.16, k.D / 2 - 0.34 + sway, 0.26, 0.28, 0.76, 0.14, shade(leaf, -0.1))
  },

  plant_big(p, item, origin, t) {
    const k = tools(p, item, origin)
    const sway = Math.sin((t || 0) / 1600) * 0.04
    k.box(0.24, 0.24, k.W - 0.48, k.D - 0.48, 0, 0.5, '#b5603f')
    k.box(0.28, 0.28, k.W - 0.56, k.D - 0.56, 0.5, 0.05, '#6b4a34')
    k.box(k.W / 2 - 0.06, k.D / 2 - 0.06, 0.12, 0.12, 0.54, 0.9, '#5f8a5d')
    const leaf = '#6fa06d'
    for (let i = 0; i < 5; i++) {
      const z = 0.86 + i * 0.16
      const off = (i % 2 === 0 ? -1 : 1) * (0.3 - i * 0.03) + sway * (i % 2 ? 1 : -1)
      k.box(k.W / 2 - 0.14 + off, k.D / 2 - 0.16, 0.32, 0.3, z, 0.12, shade(leaf, i * 0.05))
    }
  },

  lamp(p, item, origin, t) {
    const k = tools(p, item, origin)
    k.box(k.W / 2 - 0.22, k.D / 2 - 0.22, 0.44, 0.44, 0, 0.1, '#5f4028') // base
    k.box(k.W / 2 - 0.07, k.D / 2 - 0.07, 0.14, 0.14, 0.1, 1.2, WOOD) // haste
    k.box(k.W / 2 - 0.3, k.D / 2 - 0.3, 0.6, 0.6, 1.3, 0.42, '#ffe0a3') // cúpula
    // o brilho do abajur, desenhado como halo transparente
    const [sx, sy] = k.screen(k.W / 2, k.D / 2, 1.55)
    const pulse = 26 + Math.sin((t || 0) / 800) * 3
    const g = p.ctx.createRadialGradient(sx, sy, 2, sx, sy, pulse)
    g.addColorStop(0, 'rgba(255,224,163,0.42)')
    g.addColorStop(1, 'rgba(255,224,163,0)')
    p.ctx.fillStyle = g
    p.ctx.beginPath()
    p.ctx.arc(sx, sy, pulse, 0, Math.PI * 2)
    p.ctx.fill()
  },

  candles(p, item, origin, t) {
    const k = tools(p, item, origin)
    k.box(0.3, 0.3, k.W - 0.6, k.D - 0.6, 0, 0.06, '#8d7a70')
    const heights = [0.34, 0.24, 0.3]
    heights.forEach((h, i) => {
      const lx = 0.32 + i * 0.16
      k.box(lx, 0.4, 0.12, 0.12, 0.06, h, '#fdf4ea')
      const [sx, sy] = k.screen(lx + 0.06, 0.46, 0.06 + h)
      const flick = Math.sin((t || 0) / 160 + i) > 0 ? 0 : 1
      p.px(sx, sy - 2 - flick, '#ffd06b')
      p.px(sx, sy - 3 - flick, '#fff0b8')
    })
  },

  frame(p, item, origin) {
    const k = tools(p, item, origin)
    // quadro encostado na parede: fica alto e fino
    k.box(0.15, k.D - 0.22, k.W - 0.3, 0.1, 1.1, 0.7, '#e9dcc6')
    k.box(0.25, k.D - 0.24, k.W - 0.5, 0.04, 1.2, 0.5, '#a8cde0')
  },

  frame_couple(p, item, origin) {
    const k = tools(p, item, origin)
    k.box(0.12, k.D - 0.22, k.W - 0.24, 0.1, 1.0, 0.85, '#e9dcc6')
    k.box(0.2, k.D - 0.24, k.W - 0.4, 0.04, 1.1, 0.65, '#cfe4d8')
    const [sx, sy] = k.screen(k.W / 2, k.D - 0.25, 1.45)
    p.rect(sx - 7, sy - 4, 6, 7, '#ffd9c0') // dois rostinhos
    p.rect(sx + 1, sy - 4, 6, 7, '#f6c9b0')
    p.rect(sx - 6, sy - 2, 1, 1, '#33203a')
    p.rect(sx - 3, sy - 2, 1, 1, '#33203a')
    p.rect(sx + 2, sy - 2, 1, 1, '#33203a')
    p.rect(sx + 5, sy - 2, 1, 1, '#33203a')
    p.rect(sx - 1, sy - 7, 2, 2, '#e8879b') // coraçãozinho entre os dois
    p.rect(sx - 2, sy - 6, 4, 1, '#e8879b')
  },

  stove(p,item,origin){ const k=tools(p,item,origin); k.box(.08,.08,k.W-.16,k.D-.16,0,.72,'#d9d4cc'); k.box(.1,.1,k.W-.2,k.D-.2,.72,.07,'#37333b'); for(const x of [.3,k.W-.35])for(const y of [.3,k.D-.35]){const [sx,sy]=k.screen(x,y,.8);p.rect(sx-2,sy-1,5,2,'#b8aba0')} },
  petbed(p,item,origin){ const k=tools(p,item,origin),c=item.color||'#e8879b'; k.box(.1,.1,k.W-.2,k.D-.2,0,.18,shade(c,-.3)); k.box(.27,.27,k.W-.54,k.D-.54,.15,.06,shade(c,.28)) },
  petbowl(p,item,origin){ const k=tools(p,item,origin); k.box(.23,.25,.54,.5,0,.16,'#6ea7bd'); k.box(.31,.33,.38,.34,.15,.04,'#c98a4b') },
  scratchpost(p,item,origin){ const k=tools(p,item,origin); k.box(.15,.15,.7,.7,0,.1,WOOD); k.box(.39,.39,.22,.22,.1,1.1,'#c7b38d'); for(let z=.2;z<1.2;z+=.13){const [x,y]=k.screen(.5,.5,z);p.rect(x-3,y,7,1,'#8f7b5d')} k.box(.22,.22,.56,.56,1.2,.1,'#e8879b') },
  pethouse(p,item,origin){ const k=tools(p,item,origin); k.box(.08,.08,k.W-.16,k.D-.16,0,.8,'#c98a4b'); k.box(0,0,k.W,k.D,.8,.16,'#8c4e45'); k.box(.2,.2,k.W-.4,k.D-.4,.96,.14,'#a95c4f'); const [x,y]=k.screen(k.W/2,k.D,.05);p.rect(x-6,y-18,13,18,'#33203a') },
  hammock(p,item,origin,t){ const k=tools(p,item,origin); k.box(.04,.4,.13,.2,0,1.25,WOOD_DARK); k.box(k.W-.17,.4,.13,.2,0,1.25,WOOD_DARK); const a=k.screen(.1,.5,1.2),b=k.screen(k.W-.1,.5,1.2),s=Math.sin((t||0)/700)*2; for(let i=0;i<25;i++){const f=i/24;p.rect(a[0]+(b[0]-a[0])*f-1,a[1]+(b[1]-a[1])*f+Math.sin(f*Math.PI)*10+s,2,4,i%2?'#e8879b':'#f2c53d')} },
  grill(p,item,origin,t){ const k=tools(p,item,origin); k.box(.15,.18,k.W-.3,k.D-.36,0,.55,'#55505a'); k.box(.1,.12,k.W-.2,k.D-.24,.55,.08,'#28252d'); const [x,y]=k.screen(k.W/2,k.D/2,.65);p.rect(x-5,y-2,10,2,'#e8724a'); for(let i=0;i<4;i++)p.px(x+(i%2),y-7-i*3,'#d7d1ca') },
  garden(p,item,origin){ const k=tools(p,item,origin); k.box(.04,.04,k.W-.08,k.D-.08,0,.16,WOOD); k.box(.12,.12,k.W-.24,k.D-.24,.14,.05,'#6b4a2f'); for(let x=.3;x<k.W;x+=.5)for(let y=.3;y<k.D;y+=.5){const q=k.screen(x,y,.2);p.rect(q[0],q[1]-5,1,5,'#4c7c3d');p.rect(q[0]-2,q[1]-6,5,2,'#7ead52')} },
  swing(p,item,origin,t){ const k=tools(p,item,origin); for(const x of [.08,k.W-.2])for(const y of [.15,k.D-.27])k.box(x,y,.12,.12,0,1.5,WOOD_DARK); k.box(.05,.4,k.W-.1,.1,1.5,.1,WOOD); const q=k.screen(k.W/2,.45,1.5),s=Math.sin((t||0)/600)*2;p.rect(q[0]-7+s,q[1],1,22,'#665b50');p.rect(q[0]+7+s,q[1],1,22,'#665b50');p.rect(q[0]-10+s,q[1]+22,21,4,'#c98a4b') },
  tree(p,item,origin){ const k=tools(p,item,origin); k.box(k.W/2-.16,k.D/2-.16,.32,.32,0,1.35,'#6b4a2f'); k.box(.05,.05,k.W-.1,k.D-.1,1.2,.48,'#4f8745'); k.box(.27,.27,k.W-.54,k.D-.54,1.68,.4,'#68a354'); k.box(.48,.48,k.W-.96,k.D-.96,2.08,.25,'#7eb660') },
  clothesline(p,item,origin,t){ const k=tools(p,item,origin); k.box(.05,.43,.12,.14,0,1.4,WOOD_DARK); k.box(k.W-.17,.43,.12,.14,0,1.4,WOOD_DARK); const a=k.screen(.1,.5,1.4),b=k.screen(k.W-.1,.5,1.4);p.line(...a,...b,'#ddd4c7');['#e8879b','#5bb9e8','#f2c53d'].forEach((c,i)=>{const f=(i+1)/4,x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;p.rect(x-4,y+1,8,10,c)}) },
  gardenstool(p,item,origin){ const k=tools(p,item,origin); for(const [x,y] of [[.25,.25],[.62,.25],[.25,.62],[.62,.62]])k.box(x,y,.1,.1,0,.4,WOOD_DARK); k.box(.16,.16,.68,.68,.4,.1,'#9c7b62') },
}

/** Formas que não são móveis: acabamento do cômodo. */
export const FINISHES = new Set(['floor', 'wall'])

export function drawItem(p, item, origin, t) {
  const shape = SHAPES[item.shape]
  if (!shape) return false
  groundShadow(p, { col: item.col, row: item.row, w: item.w, d: item.d }, origin)
  shape(p, item, origin, t)
  return true
}

export { mix }
