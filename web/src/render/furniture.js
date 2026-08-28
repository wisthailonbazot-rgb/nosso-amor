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

// Um espião no lugar das ferramentas, pra AUDITAR sem desenhar.
//
// As formas descrevem as peças em coordenada local (`k.box(...)`), e é essa
// descrição que a auditoria de sobreposição precisa ler. Em vez de mudar a
// assinatura das 30 formas, `tools` devolve o espião quando há um instalado —
// e ele só existe durante a chamada de `comEspiao`, que é síncrona.
// Ver `furnitureAudit.js`.
let ESPIAO = null

export function comEspiao(espiao, executar) {
  ESPIAO = espiao
  try {
    executar()
  } finally {
    ESPIAO = null
  }
}

/** Ferramentas que toda forma recebe, já amarradas à posição do item. */
function tools(p, item, origin) {
  if (ESPIAO) return ESPIAO
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
  sofa(p, item, origin) {
    const c = item.color || '#7fae7d'
    const k = tools(p, item, origin)
    // -------------------------------------------------------------- refeito
    //
    // O anterior tinha três peças se atravessando, e por isso "nem parecia um
    // sofá". A auditoria (`furnitureAudit.js`) mostrou a conta:
    //
    //   * o encosto ia de 0,10 a 0,65 de profundidade e o assento começava em
    //     0,62 — o assento entrava 3 centésimos DENTRO do encosto;
    //   * os braços iam de 0,60 a 0,90 e também pegavam o encosto;
    //   * as duas almofadas iam de 0,60 a 1,10 e de 0,90 a 1,40 — **elas se
    //     sobrepunham uma na outra** por 0,20;
    //   * e as duas passavam de 0,85, que é onde a base termina: sobravam pra
    //     fora, boiando na frente do sofá.
    //
    // Agora as faixas são calculadas e ENCOSTAM sem invadir: cada peça começa
    // exatamente onde a anterior termina. É por isso que as medidas viraram
    // variáveis em vez de números soltos — com número solto, mexer numa quebra
    // a vizinha em silêncio, que foi o que aconteceu.
    const borda = 0.08
    const braco = 0.26
    const costas = 0.3
    const x0 = borda
    const x1 = k.W - borda
    const y0 = borda
    const yAssento = y0 + costas        // onde o encosto acaba e o assento começa
    const y1 = k.D - borda

    // pés
    for (const [px, py] of [[x0, yAssento], [x1 - 0.14, yAssento], [x0, y1 - 0.14], [x1 - 0.14, y1 - 0.14]]) {
      k.box(px, py, 0.14, 0.14, 0, 0.12, shade(c, -0.6))
    }
    k.box(x0, y0, x1 - x0, y1 - y0, 0.12, 0.16, shade(c, -0.45)) // estrutura

    k.box(x0, y0, x1 - x0, costas, 0.28, 0.66, c)                // encosto
    // as almofadas do encosto: SAEM 0,04 pra frente dele, então têm sombra
    // própria em vez de ficarem enterradas
    const nAlm = Math.max(1, Math.round((x1 - x0 - 2 * braco) / 0.62))
    const largAlm = (x1 - x0 - 2 * braco - 0.06 * (nAlm - 1)) / nAlm
    for (let i = 0; i < nAlm; i++) {
      const ax = x0 + braco + i * (largAlm + 0.06)
      k.box(ax, yAssento - 0.06, largAlm, 0.1, 0.42, 0.42, shade(c, 0.14))
    }

    k.box(x0, yAssento, braco, y1 - yAssento, 0.28, 0.4, shade(c, -0.14))       // braço esquerdo
    k.box(x1 - braco, yAssento, braco, y1 - yAssento, 0.28, 0.4, shade(c, -0.14)) // braço direito

    // assento: entre os braços, na frente do encosto, sem tocar em nenhum
    const sx = x0 + braco
    const sw = x1 - braco - sx
    k.box(sx, yAssento, sw, y1 - yAssento, 0.28, 0.16, shade(c, 0.1))
    // as almofadas do assento, uma por vão, com folga entre elas
    for (let i = 0; i < nAlm; i++) {
      const ax = sx + i * (largAlm + 0.06)
      k.box(ax, yAssento + 0.04, largAlm, y1 - yAssento - 0.08, 0.44, 0.1, shade(c, 0.24))
    }
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
    k.box(k.W / 2 - 0.09, k.D / 2 - 0.07, 0.14, 0.14, 0.8, 0.05, '#8a5f3c') // o café passa da borda
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
    // As portas SAEM da face do corpo (que termina em k.D - 0.06), em vez de
    // ficarem enterradas nele. Enterrada, a face da porta caía no mesmo plano
    // da face do corpo, e duas faces coplanares com contorno viram um risco.
    k.box(0.06, k.D - 0.1, (k.W - 0.12) / 2 - 0.03, 0.08, 0.08, 1.7, shade(c, -0.22))
    k.box(k.W / 2 + 0.01, k.D - 0.1, (k.W - 0.12) / 2 - 0.03, 0.08, 0.08, 1.7, shade(c, -0.22))
    k.box(k.W / 2 - 0.11, k.D - 0.05, 0.07, 0.07, 0.9, 0.2, '#f2b33d') // puxadores
    k.box(k.W / 2 + 0.05, k.D - 0.05, 0.07, 0.07, 0.9, 0.2, '#f2b33d')
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
    // O PÉ FICA DEBAIXO DO CORPO, e não no meio da célula.
    //
    // Estava em `k.D / 2`, enquanto o corpo está em `k.D - 0.36`. No 0° a
    // diferença some no meio dos pixels; girado, a projeção separa os dois e o
    // pé aparece como um bloco escuro solto no chão, ao lado da TV. É a
    // família de defeito que o dono chamou de "objeto bugado quando gira".
    k.box(k.W / 2 - 0.2, k.D - 0.34, 0.4, 0.18, 0, 0.22, '#3a2f4a') // pé
    k.box(k.W / 2 - 0.32, k.D - 0.36, 0.64, 0.22, 0.2, 0.04, '#2b2338') // base do pé
    k.box(0.08, k.D - 0.36, k.W - 0.16, 0.22, 0.22, 0.95, '#241d33') // corpo
    // a tela pisca devagar, como se estivesse ligada
    const glow = Math.sin((t || 0) / 900) > 0 ? '#4f7fb8' : '#3f6da8'
    k.flat(0.16, k.D - 0.38, k.W - 0.32, 0.02, 0.34, glow)
    k.box(0.16, k.D - 0.4, k.W - 0.32, 0.03, 0.34, 0.72, glow)
    k.box(k.W / 2 - 0.16, k.D - 0.42, 0.32, 0.02, 0.62, 0.18, '#ff7fa3') // coraçãozinho
  },

  speaker(p, item, origin, t) {
    const k = tools(p, item, origin)
    // Os alto-falantes eram lâminas de 0,03 de célula — 1 px. Uma caixa de som
    // com dois riscos de 1 px é um bloco escuro, que foi como ela apareceu.
    // Agora os cones são AFUNDADOS na face da frente, com aro e centro.
    k.box(0.28, 0.28, k.W - 0.56, k.D - 0.56, 0, 0.06, '#2b2338') // pezinho
    k.box(0.24, 0.24, k.W - 0.48, k.D - 0.48, 0.06, 0.92, '#4a3f66') // caixa
    k.box(0.26, 0.26, k.W - 0.52, k.D - 0.52, 0.98, 0.03, '#5d5080') // tampo

    // grave (grande, embaixo) e agudo (pequeno, em cima)
    const face = k.D - 0.27
    k.box(0.3, face, k.W - 0.6, 0.05, 0.16, 0.4, '#241d33')
    k.box(0.35, face - 0.01, k.W - 0.7, 0.05, 0.21, 0.3, '#6b5b96')
    k.box(0.42, face + 0.04, k.W - 0.84, 0.05, 0.29, 0.14, '#241d33') // miolo do cone, saindo do aro

    k.box(0.34, face, k.W - 0.68, 0.05, 0.64, 0.22, '#241d33')
    k.box(0.38, face - 0.01, k.W - 0.76, 0.05, 0.67, 0.16, '#8d7ab5')

    const on = Math.sin((t || 0) / 700) > 0
    k.box(k.W - 0.4, face, 0.08, 0.05, 0.9, 0.05, on ? '#7fd6b0' : '#3f6a5a')
  },

  console(p, item, origin, t) {
    const k = tools(p, item, origin)
    // Era um bloco de 0,26 de altura com dois pontinhos: no cômodo virava uma
    // mancha escura sem leitura nenhuma. Ganhou corpo, tampa clara, bandeja de
    // disco e um controle com cabo — que é o que faz reconhecer o que é.
    k.box(0.14, 0.26, k.W - 0.28, k.D - 0.52, 0, 0.3, '#3d3356')
    k.box(0.16, 0.28, k.W - 0.32, k.D - 0.56, 0.3, 0.06, '#5a4c7d') // tampa
    k.box(0.3, 0.34, k.W - 0.6, k.D - 0.72, 0.36, 0.03, '#2a2340') // rebaixo do disco

    const face = k.D - 0.28
    k.box(0.24, face, k.W - 0.48, 0.04, 0.08, 0.06, '#241d33') // bandeja
    const on = Math.sin((t || 0) / 900) > 0
    k.box(k.W - 0.34, face, 0.08, 0.04, 0.18, 0.06, on ? '#7fd6b0' : '#3f6a5a')

    // o controle, jogado ao lado, com os dois analógicos e o cabo
    k.box(0.2, k.D - 0.2, 0.44, 0.16, 0, 0.1, '#e8879b')
    k.box(0.18, k.D - 0.17, 0.1, 0.1, 0, 0.12, '#e8879b') // punho esquerdo
    k.box(0.56, k.D - 0.17, 0.1, 0.1, 0, 0.12, '#e8879b') // punho direito
    k.box(0.27, k.D - 0.17, 0.08, 0.08, 0.1, 0.03, '#241d33')
    k.box(0.45, k.D - 0.17, 0.08, 0.08, 0.1, 0.03, '#241d33')
  },

  fridge(p, item, origin) {
    const k = tools(p, item, origin)
    // Refeita. A anterior punha as duas portas como lâminas de 0,06 de célula
    // coladas na face da frente: com 48 px de tile isso dava 3 px, e três
    // pixels não descrevem uma porta — viravam um risco cinza atravessado, que
    // é o que se via. Agora o corpo é um bloco só e a divisão das portas, o
    // puxador e o vão são desenhados como RELEVO na face da frente, com
    // profundidade de verdade.
    const corpo = '#eceae4'
    const porta = '#e2ded6'
    k.box(0.08, 0.08, k.W - 0.16, k.D - 0.16, 0, 1.95, corpo)

    // as duas portas, afundadas 0,03 em relação ao corpo (por isso o recuo em
    // x e em y): é o recuo que faz a linha de sombra aparecer sozinha
    // As duas portas SAEM 0,04 da face do corpo (que acaba em k.D - 0.08). Era
    // aqui o "risco cinza atravessado": elas ficavam inteiras dentro do corpo, e
    // as duas faces caíam no mesmo plano.
    k.box(0.14, k.D - 0.11, k.W - 0.28, 0.07, 0.1, 1.02, porta)   // freezer embaixo
    k.box(0.14, k.D - 0.11, k.W - 0.28, 0.07, 1.2, 0.68, porta)   // geladeira em cima

    // puxadores verticais, um por porta, saindo da face das portas
    k.box(k.W - 0.26, k.D - 0.06, 0.06, 0.07, 0.45, 0.45, '#9a8f86')
    k.box(k.W - 0.26, k.D - 0.06, 0.06, 0.07, 1.42, 0.34, '#9a8f86')

    // ímã de geladeira e um bilhetinho — o detalhe que faz parecer casa de gente
    k.box(0.26, k.D - 0.06, 0.14, 0.05, 1.62, 0.12, '#f2b33d')
    k.box(0.24, k.D - 0.06, 0.2, 0.05, 1.3, 0.22, '#fdf4ea')
  },

  plant(p, item, origin, t) {
    const k = tools(p, item, origin)
    const sway = Math.sin((t || 0) / 1400) * 0.03
    k.box(0.32, 0.32, k.W - 0.64, k.D - 0.64, 0, 0.34, '#c9744f') // vaso
    k.box(0.36, 0.36, k.W - 0.72, k.D - 0.72, 0.34, 0.05, '#6b4a34') // terra
    k.box(k.W / 2 - 0.05, k.D / 2 - 0.05, 0.1, 0.1, 0.38, 0.4, '#5f8a5d') // caule
    const leaf = '#7fae7d'
    // As folhas ficam DENTRO da boca do vaso.
    //
    // A do lado saía 0,34 de célula do centro, e o vaso tem 0,32 de raio: a
    // folha nascia FORA dele e, girado, a projeção afastava as duas — planta de
    // um lado, vaso do outro. Agora nenhuma passa da borda, e o balanço é
    // pequeno o bastante pra não desencostar.
    k.box(k.W / 2 - 0.28 + sway, k.D / 2 - 0.12, 0.26, 0.22, 0.6, 0.13, leaf)
    k.box(k.W / 2 + 0.02 - sway, k.D / 2 - 0.14, 0.26, 0.22, 0.68, 0.13, shade(leaf, 0.12))
    k.box(k.W / 2 - 0.14, k.D / 2 - 0.28 + sway, 0.24, 0.24, 0.76, 0.13, shade(leaf, -0.1))
    k.box(k.W / 2 - 0.12, k.D / 2 - 0.1, 0.24, 0.22, 0.86, 0.12, shade(leaf, 0.2))
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
    // As velas eram três palitos de 0,12 de célula com a chama em pixel solto:
    // a 48 px de tile cada uma tinha 6 px e a chama era um ponto. Agora são
    // castiçais com corpo, e a chama tem forma.
    k.box(0.22, 0.28, k.W - 0.44, k.D - 0.56, 0, 0.08, '#8d7a70') // bandeja
    k.box(0.26, 0.32, k.W - 0.52, k.D - 0.64, 0.08, 0.02, '#a8968a')
    const velas = [
      [0.3, 0.4, 0.42],
      [0.46, 0.36, 0.3],
      [0.6, 0.44, 0.36],
    ]
    velas.forEach(([lx, ly, h], i) => {
      k.box(lx, ly, 0.14, 0.14, 0.1, h, '#fdf4ea')
      k.box(lx + 0.01, ly + 0.01, 0.12, 0.12, 0.1 + h, 0.02, '#e6dccb') // cera derretida
      k.box(lx + 0.05, ly + 0.05, 0.04, 0.04, 0.12 + h, 0.05, '#6b5b4a') // pavio
      // a chama treme: dois blocos, um dentro do outro
      const alto = 0.09 + (Math.sin((t || 0) / 170 + i * 2) > 0 ? 0.03 : 0)
      k.box(lx + 0.035, ly + 0.035, 0.07, 0.07, 0.15 + h, alto, '#ffb347')
      // o miolo da chama PASSA da ponta da chama de fora: enterrado, ele
      // dividia a mesma face e virava um pontinho sem brilho
      k.box(lx + 0.05, ly + 0.05, 0.04, 0.04, 0.15 + h + alto * 0.55, alto * 0.6, '#fff0b8')
    })
  },

  frame(p, item, origin) {
    const k = tools(p, item, origin)
    // O QUADRO ENCOSTA NA PAREDE DE TRÁS, não na frente da célula.
    //
    // Estava em `k.D - 0.22`, que é a beirada de FRENTE — a mais perto de quem
    // olha. Um quadro pendurado a 1,1 de altura na beirada da frente não
    // encosta em nada: ele fica pairando no meio do cômodo, e foi assim que o
    // dono viu. O fundo da célula é `ly = 0`, que é onde a parede está.
    const moldura = '#8a6a4a'
    // A moldura é um ARO, e não um bloco cheio: quatro barras em volta. Assim a
    // foto fica NA ABERTURA, e não enterrada dentro da madeira.
    k.box(0.12, 0.06, k.W - 0.24, 0.07, 1.05, 0.08, moldura)          // barra de baixo
    k.box(0.12, 0.06, k.W - 0.24, 0.07, 1.75, 0.08, moldura)          // barra de cima
    k.box(0.12, 0.06, 0.09, 0.07, 1.13, 0.62, moldura)                // montante esquerdo
    k.box(k.W - 0.21, 0.06, 0.09, 0.07, 1.13, 0.62, moldura)          // montante direito
    k.box(0.21, 0.08, k.W - 0.42, 0.04, 1.13, 0.62, '#f3ead9')        // paspatur, recuado
    k.box(0.27, 0.09, k.W - 0.54, 0.04, 1.19, 0.5, '#a8cde0')         // a foto
    k.box(0.27, 0.11, k.W - 0.54, 0.04, 1.19, 0.16, '#7fae7d')        // o horizonte, saindo da foto
  },

  frame_couple(p, item, origin) {
    const k = tools(p, item, origin)
    // Mesma correção do `frame`: a moldura é um ARO. Antes era um bloco cheio, e
    // TODO o resto (paspatur, foto, os dois rostos, os olhos, o coração) ficava
    // inteiro dentro dele — quinze peças enterradas, o pior da lista.
    const moldura = '#8a6a4a'
    k.box(0.1, 0.06, k.W - 0.2, 0.07, 0.98, 0.09, moldura)
    k.box(0.1, 0.06, k.W - 0.2, 0.07, 1.82, 0.09, moldura)
    k.box(0.1, 0.06, 0.1, 0.07, 1.07, 0.75, moldura)
    k.box(k.W - 0.2, 0.06, 0.1, 0.07, 1.07, 0.75, moldura)
    k.box(0.2, 0.08, k.W - 0.4, 0.04, 1.07, 0.75, '#f3ead9')   // paspatur
    k.box(0.26, 0.09, k.W - 0.52, 0.04, 1.13, 0.63, '#cfe4d8') // a foto

    // os dois rostinhos, cada um SAINDO da foto — em bloco, que gira junto
    // (antes eram `p.rect` em coordenada de tela, que não gira)
    k.box(0.32, 0.12, 0.18, 0.03, 1.24, 0.24, '#ffd9c0')
    k.box(k.W - 0.5, 0.12, 0.18, 0.03, 1.24, 0.24, '#f6c9b0')
    // os olhos saem do rosto pelo mesmo motivo
    k.box(0.35, 0.14, 0.04, 0.03, 1.38, 0.05, '#33203a')
    k.box(0.43, 0.14, 0.04, 0.03, 1.38, 0.05, '#33203a')
    k.box(k.W - 0.47, 0.14, 0.04, 0.03, 1.38, 0.05, '#33203a')
    k.box(k.W - 0.39, 0.14, 0.04, 0.03, 1.38, 0.05, '#33203a')
    k.box(k.W / 2 - 0.06, 0.13, 0.12, 0.03, 1.52, 0.1, '#e8879b') // coraçãozinho
  },

  stove(p, item, origin, t) {
    const k = tools(p, item, origin)
    // Era uma caixa cinza com quatro riscos de 5x2 px. Virou fogão: corpo,
    // tampo escuro, quatro bocas com grade, porta do forno com visor e puxador,
    // e os botões na frente. Tudo em BLOCO — o que era `p.rect` em coordenada
    // de tela não girava junto com o móvel.
    k.box(0.06, 0.06, k.W - 0.12, k.D - 0.12, 0, 0.7, '#d9d4cc')
    k.box(0.08, 0.08, k.W - 0.16, k.D - 0.16, 0.7, 0.06, '#37333b') // tampo
    for (const [bx, by] of [[0.24, 0.26], [k.W - 0.44, 0.26], [0.24, k.D - 0.46], [k.W - 0.44, k.D - 0.46]]) {
      k.box(bx, by, 0.2, 0.2, 0.76, 0.03, '#22202a')      // boca
      k.box(bx + 0.05, by + 0.05, 0.1, 0.1, 0.79, 0.03, '#8f8a84') // queimador
    }
    // tudo o que é frente SAI da face do corpo (que acaba em k.D - 0.06)
    const face = k.D - 0.09
    k.box(0.12, face, k.W - 0.24, 0.07, 0.08, 0.44, '#c6c0b7')       // porta do forno
    k.box(0.2, face + 0.03, k.W - 0.4, 0.05, 0.16, 0.28, '#4a4550')  // visor
    k.box(0.16, face + 0.05, k.W - 0.32, 0.06, 0.54, 0.05, '#9a938a') // puxador
    for (let i = 0; i < 3; i++) {
      k.box(0.2 + i * 0.22, face + 0.05, 0.09, 0.06, 0.6, 0.07, '#8f8a84') // botões
    }
  },

  petbed(p, item, origin) {
    const k = tools(p, item, origin)
    const c = item.color || '#e8879b'
    // Era um bloco de 0,18 com um miolo de 0,06 em cima: lido de cima virava um
    // tapete quadrado. Caminha tem BORDA alta e miolo FUNDO — é a diferença de
    // altura entre os dois que faz reconhecer.
    k.box(0.08, 0.08, k.W - 0.16, k.D - 0.16, 0, 0.1, shade(c, -0.4)) // fundo
    // as quatro paredinhas da borda
    k.box(0.08, 0.08, k.W - 0.16, 0.16, 0.1, 0.2, shade(c, -0.12))
    k.box(0.08, k.D - 0.24, k.W - 0.16, 0.16, 0.1, 0.2, shade(c, -0.12))
    k.box(0.08, 0.22, 0.16, k.D - 0.44, 0.1, 0.2, shade(c, -0.2))
    k.box(k.W - 0.24, 0.22, 0.16, k.D - 0.44, 0.1, 0.2, shade(c, -0.2))
    // a almofada, fofa e mais clara, afundada dentro da borda
    k.box(0.24, 0.24, k.W - 0.48, k.D - 0.48, 0.1, 0.14, shade(c, 0.3))
    k.box(0.3, 0.3, k.W - 0.6, k.D - 0.6, 0.24, 0.03, shade(c, 0.42))
  },

  petbowl(p, item, origin) {
    const k = tools(p, item, origin)
    // Duas tigelas — água e ração — num tapetinho, que é o que se vê em casa
    // com bicho. Uma tigela sozinha de 0,54 de célula sumia no piso.
    k.box(0.1, 0.2, k.W - 0.2, k.D - 0.4, 0, 0.03, '#8d7a70') // tapetinho
    k.box(0.14, 0.26, 0.34, 0.34, 0.03, 0.16, '#6ea7bd')      // tigela da água
    k.box(0.19, 0.31, 0.24, 0.24, 0.13, 0.07, '#8fd0ef') // a água passa da borda
    k.box(k.W - 0.48, 0.26, 0.34, 0.34, 0.03, 0.16, '#c98a4b') // tigela da ração
    k.box(k.W - 0.43, 0.31, 0.24, 0.24, 0.13, 0.08, '#8a5f3c') // a ração passa da borda
    k.box(k.W - 0.4, 0.34, 0.08, 0.08, 0.19, 0.04, '#a06f45')  // uns grãos
    k.box(k.W - 0.31, 0.4, 0.07, 0.07, 0.19, 0.04, '#a06f45')
  },

  scratchpost(p, item, origin) {
    const k = tools(p, item, origin)
    // O tronco tinha 0,22 de célula e as voltas da corda eram riscos de 7x1 px
    // em coordenada de TELA — não giravam com o móvel. Agora a corda é feita de
    // anéis (blocos), então ela acompanha a rotação, e ganhou base e brinquedo.
    k.box(0.12, 0.12, k.W - 0.24, k.D - 0.24, 0, 0.12, WOOD)      // base
    k.box(0.14, 0.14, k.W - 0.28, k.D - 0.28, 0.12, 0.03, '#8f7b5d')
    for (let z = 0.15; z < 1.15; z += 0.14) {
      const claro = Math.round(z * 100) % 28 === 0
      k.box(0.36, 0.36, 0.28, 0.28, z, 0.12, claro ? '#d3bf99' : '#c7b38d')
    }
    k.box(0.24, 0.24, 0.52, 0.52, 1.22, 0.12, shade(item.color || '#e8879b', -0.1)) // plataforma
    k.box(0.28, 0.28, 0.44, 0.44, 1.34, 0.04, shade(item.color || '#e8879b', 0.22))
    k.box(0.42, 0.18, 0.16, 0.16, 1.0, 0.16, '#f2b33d') // bolinha pendurada
  },

  pethouse(p, item, origin) {
    const k = tools(p, item, origin)
    // Reposta depois de eu apagá-la sem querer ao reescrever o bloco vizinho —
    // e foi o smoke que avisou ("todo móvel vendido tem desenho"), não o olho.
    //
    // Melhorada junto: a porta era um retângulo em coordenada de TELA, então
    // não girava com a casinha e ficava na parede errada. Agora é um vão
    // afundado na face da frente, e o telhado tem duas águas em degrau em vez
    // de dois blocos empilhados.
    const parede = item.color || '#c98a4b'
    k.box(0.06, 0.06, k.W - 0.12, k.D - 0.12, 0, 0.82, parede)
    k.box(0.1, 0.1, k.W - 0.2, k.D - 0.2, 0.82, 0.06, shade(parede, -0.25)) // friso

    // telhado em duas águas: três degraus, cada um menor que o de baixo
    k.box(0, 0, k.W, k.D, 0.88, 0.12, '#8c4e45')
    k.box(0.14, 0.14, k.W - 0.28, k.D - 0.28, 1.0, 0.12, '#a95c4f')
    k.box(0.3, 0.3, k.W - 0.6, k.D - 0.6, 1.12, 0.1, '#bd6a5b')

    // a portinha: um vão escuro afundado na frente, com soleira clara
    const face = k.D - 0.09
    k.box(k.W / 2 - 0.22, face, 0.44, 0.05, 0, 0.5, '#33203a')
    k.box(k.W / 2 - 0.26, face - 0.01, 0.52, 0.05, 0.5, 0.06, shade(parede, 0.2)) // verga
    k.box(k.W / 2 - 0.26, face - 0.01, 0.52, 0.05, 0, 0.04, shade(parede, 0.3)) // soleira
  },

  hammock(p, item, origin, t) {
    const k = tools(p, item, origin)
    // O pano eram 25 retângulos de 2x4 px soltos numa reta de tela: lido de
    // longe virava um pontilhado, e nenhum deles girava junto. Agora a rede é
    // uma sequência de BLOCOS que segue a curva da corda em altura — então ela
    // gira com o móvel e tem volume.
    k.box(0.02, 0.36, 0.14, 0.22, 0, 1.3, WOOD_DARK) // poste
    k.box(k.W - 0.16, 0.36, 0.14, 0.22, 0, 1.3, WOOD_DARK)
    k.box(0.02, 0.36, 0.14, 0.22, 1.3, 0.06, '#8a5f3c') // capitel
    k.box(k.W - 0.16, 0.36, 0.14, 0.22, 1.3, 0.06, '#8a5f3c')

    const balanco = Math.sin((t || 0) / 700) * 0.04
    const vaos = 12
    for (let i = 0; i <= vaos; i++) {
      const f = i / vaos
      const lx = 0.1 + f * (k.W - 0.2)
      // a barriga da rede: mais funda no meio, e balançando devagar
      const z = 1.16 - Math.sin(f * Math.PI) * (0.42 + balanco)
      const largura = (k.W - 0.2) / vaos + 0.02
      k.box(lx, 0.34, largura, 0.28, z, 0.07, i % 2 ? '#e8879b' : '#f2c53d')
    }
  },

  grill(p, item, origin, t) {
    const k = tools(p, item, origin)
    // Era uma caixa com um risco laranja e quatro pixels de fumaça. Virou
    // churrasqueira: pés, cuba funda, grelha com barras de verdade, brasa
    // debaixo dela e tampa levantada atrás.
    for (const [lx, ly] of [[0.18, 0.24], [k.W - 0.3, 0.24], [0.18, k.D - 0.36], [k.W - 0.3, k.D - 0.36]]) {
      k.box(lx, ly, 0.12, 0.12, 0, 0.42, '#3b3740')
    }
    // A cuba é RASA e a brasa e a grelha ficam ACIMA da borda dela.
    //
    // Antes a cuba era um bloco de 0,42 a 0,72 e tudo — brasa, carvão e as cinco
    // barras da grelha — morava dentro dela, abaixo do tampo. Nove peças
    // enterradas: nada disso aparecia, e a churrasqueira era um caixote.
    k.box(0.14, 0.2, k.W - 0.28, k.D - 0.4, 0.42, 0.16, '#55505a') // cuba
    k.box(0.2, 0.26, k.W - 0.4, k.D - 0.52, 0.54, 0.08, '#7a2f22') // brasa, saindo da cuba
    for (let i = 0; i < 3; i++) {
      k.box(0.26 + i * 0.2, 0.32, 0.12, k.D - 0.64, 0.58, 0.06, '#e8724a') // carvão aceso
    }
    // a grelha fica POR CIMA de tudo, que é onde grelha fica
    for (let i = 0; i < 5; i++) {
      k.box(0.18 + i * 0.15, 0.22, 0.07, k.D - 0.44, 0.64, 0.05, '#2b282f')
    }
    k.box(0.14, 0.16, k.W - 0.28, 0.1, 0.7, 0.5, '#43404a') // tampa levantada
    const sobe = ((t || 0) / 260) % 6
    k.box(k.W / 2 - 0.06, k.D / 2 - 0.06, 0.12, 0.12, 1.2 + sobe * 0.06, 0.1, '#cfc9c2') // fumaça
  },

  garden(p,item,origin){ const k=tools(p,item,origin); k.box(.04,.04,k.W-.08,k.D-.08,0,.16,WOOD); k.box(.12,.12,k.W-.24,k.D-.24,.14,.05,'#6b4a2f'); for(let x=.3;x<k.W;x+=.5)for(let y=.3;y<k.D;y+=.5){const q=k.screen(x,y,.2);p.rect(q[0],q[1]-5,1,5,'#4c7c3d');p.rect(q[0]-2,q[1]-6,5,2,'#7ead52')} },
  swing(p,item,origin,t){ const k=tools(p,item,origin); for(const x of [.08,k.W-.2])for(const y of [.15,k.D-.27])k.box(x,y,.12,.12,0,1.5,WOOD_DARK); k.box(.05,.4,k.W-.1,.1,1.5,.1,WOOD); const q=k.screen(k.W/2,.45,1.5),s=Math.sin((t||0)/600)*2;p.rect(q[0]-7+s,q[1],1,22,'#665b50');p.rect(q[0]+7+s,q[1],1,22,'#665b50');p.rect(q[0]-10+s,q[1]+22,21,4,'#c98a4b') },
  tree(p,item,origin){ const k=tools(p,item,origin); k.box(k.W/2-.16,k.D/2-.16,.32,.32,0,1.35,'#6b4a2f'); k.box(.05,.05,k.W-.1,k.D-.1,1.2,.48,'#4f8745'); k.box(.27,.27,k.W-.54,k.D-.54,1.68,.4,'#68a354'); k.box(.48,.48,k.W-.96,k.D-.96,2.08,.25,'#7eb660') },
  clothesline(p,item,origin,t){ const k=tools(p,item,origin); k.box(.05,.43,.12,.14,0,1.4,WOOD_DARK); k.box(k.W-.17,.43,.12,.14,0,1.4,WOOD_DARK); const a=k.screen(.1,.5,1.4),b=k.screen(k.W-.1,.5,1.4);p.line(...a,...b,'#ddd4c7');['#e8879b','#5bb9e8','#f2c53d'].forEach((c,i)=>{const f=(i+1)/4,x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;p.rect(x-4,y+1,8,10,c)}) },
  gardenstool(p,item,origin){ const k=tools(p,item,origin); for(const [x,y] of [[.25,.25],[.62,.25],[.25,.62],[.62,.62]])k.box(x,y,.1,.1,0,.4,WOOD_DARK); k.box(.16,.16,.68,.68,.4,.1,'#9c7b62') },
}

/**
 * Formas que ficam PENDURADAS NA PAREDE.
 *
 * O cômodo isométrico só mostra duas paredes: a de trás (row 0) e a da esquerda
 * (col 0). Um quadro tem quatro rotações como qualquer móvel, mas só duas delas
 * põem as costas dele contra uma parede que existe — nas outras duas ele fica
 * pendurado no ar, no meio da sala. Foi assim que o dono viu: "gira e some na
 * parede errada".
 *
 * Em vez de inventar arte para uma parede que não existe, o editor pula as duas
 * direções sem parede. Girar um quadro passa a alternar entre a parede do fundo
 * e a da esquerda, que é o que a pessoa quer dizer quando gira um quadro.
 *
 * `at()` (em `tools`) manda o fundo local para a menor linha na direção 0 e
 * para a menor coluna na direção 3 — são essas as duas.
 */
export const NA_PAREDE = new Set(['frame', 'frame_couple'])
export const DIRECOES_DE_PAREDE = [0, 3]

/** Formas que não são móveis: acabamento do cômodo. */
export const FINISHES = new Set(['floor', 'wall'])

// O KIT KENNEY FOI REMOVIDO — e a decisão é do dono, depois de ver rodando.
//
// Ele pediu pra experimentar, os 73 PNGs entraram, e o resultado no cômodo não
// convenceu: "não funcionaram direito". Dá pra ver por quê sem gosto nenhum no
// meio — os renders são de um kit genérico e o nosso catálogo não tem o mesmo
// vocabulário. A caminha do bichinho virava um travesseiro azul comprido, o
// quadro virava um espelho de banheiro, e o que não tinha equivalente ficava
// desenhado por código do lado do que tinha: dois estilos na mesma sala.
//
// Somando: os PNGs não aceitam a cor por item (a loja vende o mesmo móvel em
// cores), e o bichinho e o avatar são pixel art desenhados no MESMO plano —
// um sofá liso ao lado deles destoa.
//
// Fica o registro pra não ser tentado de novo sem motivo novo: a alternativa foi
// experimentada de verdade, no ar, e voltou atrás por decisão de quem usa.
export function drawItem(p, item, origin, t) {
  const shape = SHAPES[item.shape]
  if (!shape) return false
  groundShadow(p, { col: item.col, row: item.row, w: item.w, d: item.d }, origin)
  shape(p, item, origin, t)
  return true
}

export { mix }
