// Projeção isométrica 2:1 e o bloco que forma todos os móveis.
//
// A grade continua sendo uma grade (coluna, linha) — igual ao modelo de dados do
// documento. O que muda é só como ela vira pixel na tela:
//
//     x = ox + (coluna - linha) * TW/2
//     y = oy + (coluna + linha) * TH/2 - altura * TZ
//
// Com TW = 2 * TH, a diagonal anda 2 pixels na horizontal para cada 1 na vertical.
// Essa proporção é a que deixa a linha diagonal sair "certinha" em pixel art: ela
// vira degraus de 2x1, sem pixel solto no meio.
//
// Todo móvel é composto de blocos (`isoBox`). Um sofá é uma caixa baixa + uma
// caixa fina atrás + dois braços. Isso evita ter que desenhar cada móvel em 4
// rotações na mão: girar é trocar largura por profundidade e trocar as faces.

// Tamanho do tile. Quanto maior, mais pixel sobra pra detalhe em cada móvel —
// e como as formas são descritas em fração de célula, aumentar aqui deixa TODOS
// os móveis mais detalhados de uma vez, sem redesenhar nenhum.
// 48x24 mantém a proporção 2:1 (obrigatória pra diagonal sair em degrau limpo).
export const TW = 48 // largura do losango de uma célula
export const TH = 24 // altura do losango
export const TZ = 24 // altura de uma "unidade" vertical

/** Célula (col, row) na altura z -> ponto na tela. */
export function project(col, row, z, origin) {
  return [
    origin.x + (col - row) * (TW / 2),
    origin.y + (col + row) * (TH / 2) - z * TZ,
  ]
}

/** O inverso: ponto na tela -> célula. Usado pra saber onde o dedo tocou. */
export function unproject(sx, sy, origin) {
  const dx = sx - origin.x
  const dy = sy - origin.y
  const col = dy / TH + dx / TW
  const row = dy / TH - dx / TW
  return [Math.floor(col), Math.floor(row)]
}

/** Losango do chão de uma célula (para realce e sombra). */
export function tileDiamond(col, row, origin, z = 0) {
  return [
    project(col, row, z, origin),
    project(col + 1, row, z, origin),
    project(col + 1, row + 1, z, origin),
    project(col, row + 1, z, origin),
  ]
}

// Quanto cada face escurece. O topo pega a luz inteira; a face que aponta pra
// esquerda pega menos; a da direita, menos ainda. É o que dá volume sem sombra.
export const FACE_TOP = 0.12
export const FACE_LEFT = -0.16
export const FACE_RIGHT = -0.34

/**
 * Desenha um bloco isométrico.
 *
 * col,row  = canto de trás do bloco (o mais distante do observador)
 * w,d      = quantas células ele ocupa em coluna e em linha
 * z        = altura em que a base está
 * h        = altura do bloco, em unidades
 */
export function isoBox(p, colors, { col, row, w, d, z, h }, origin, outline = '#2b1d2e') {
  const top = z + h
  const P = (c, r, e) => project(c, r, e, origin)

  const topFace = [P(col, row, top), P(col + w, row, top), P(col + w, row + d, top), P(col, row + d, top)]
  // face da esquerda: a que aponta pro observador no eixo das linhas
  const leftFace = [
    P(col, row + d, top),
    P(col + w, row + d, top),
    P(col + w, row + d, z),
    P(col, row + d, z),
  ]
  // face da direita: a que aponta pro observador no eixo das colunas
  const rightFace = [
    P(col + w, row, top),
    P(col + w, row + d, top),
    P(col + w, row + d, z),
    P(col + w, row, z),
  ]

  if (h > 0) {
    p.fillPoly(leftFace, colors.left)
    p.fillPoly(rightFace, colors.right)
  }
  p.fillPoly(topFace, colors.top)

  if (outline) {
    p.strokePoly(topFace, outline)
    if (h > 0) {
      p.strokePoly(leftFace, outline)
      p.strokePoly(rightFace, outline)
    }
  }
  return { topFace, leftFace, rightFace }
}

/**
 * Ordem de desenho. Em isométrico, quem está mais "ao fundo" tem que ser pintado
 * primeiro, senão o sofá aparece por cima da parede. A profundidade é col + row;
 * empate resolve por altura (quem está no chão primeiro) e depois por tamanho.
 */
export function depthSort(items) {
  return [...items].sort((a, b) => {
    const da = a.col + a.row + (a.w + a.d) / 2
    const dbb = b.col + b.row + (b.w + b.d) / 2
    if (da !== dbb) return da - dbb
    if ((a.z || 0) !== (b.z || 0)) return (a.z || 0) - (b.z || 0)
    return (a.id || 0) - (b.id || 0)
  })
}

/** Sombra achatada no chão, por baixo do móvel. Dá o peso que o objeto precisa. */
export function groundShadow(p, { col, row, w, d }, origin, color = 'rgba(40,22,44,0.28)') {
  p.fillPoly(
    [
      project(col + 0.15, row + 0.15, 0, origin),
      project(col + w - 0.15, row + 0.15, 0, origin),
      project(col + w - 0.15, row + d - 0.15, 0, origin),
      project(col + 0.15, row + d - 0.15, 0, origin),
    ],
    color
  )
}

/** Tamanho em pixels que um cômodo de `cols x rows` ocupa, com a parede. */
export function roomMetrics(cols, rows, wallHeight = 3) {
  const width = (cols + rows) * (TW / 2)
  const height = (cols + rows) * (TH / 2) + wallHeight * TZ
  // a origem fica no canto de cima, deslocada pra direita porque o losango
  // cresce pros dois lados a partir da célula (0,0)
  return {
    width: Math.ceil(width) + 2,
    height: Math.ceil(height) + 2,
    origin: { x: Math.round(rows * (TW / 2)) + 1, y: Math.round(wallHeight * TZ) + 1 },
  }
}
