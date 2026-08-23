// Motor de desenho em pixel.
//
// Por que nao usar o canvas do jeito normal: `ctx.fill()` suaviza as bordas, e
// borda suavizada e exatamente o que mata a cara de pixel art — o desenho fica
// com franjinha cinza em toda diagonal. Aqui os poligonos sao preenchidos por
// varredura, linha a linha, em coordenada inteira. Cada pixel e ou da cor, ou
// nao e; nao existe meio termo.
//
// O canvas e desenhado na resolucao da arte (1 pixel de arte = 1 pixel do canvas)
// e ampliado por CSS com `image-rendering: pixelated`, entao no celular cada pixel
// vira um quadradinho nitido em vez de um borrao.

export class Painter {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.ctx.imageSmoothingEnabled = false
    this.w = canvas.width
    this.h = canvas.height
  }

  resize(w, h) {
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width = w
    this.canvas.height = h
    this.w = w
    this.h = h
    this.ctx.imageSmoothingEnabled = false
  }

  clear(color) {
    if (color) {
      this.ctx.fillStyle = color
      this.ctx.fillRect(0, 0, this.w, this.h)
    } else {
      this.ctx.clearRect(0, 0, this.w, this.h)
    }
  }

  px(x, y, color) {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x | 0, y | 0, 1, 1)
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  /** Retangulo com contorno de 1px por fora — o que destaca o objeto do fundo. */
  solid(x, y, w, h, fill, line) {
    if (line) this.rect(x - 1, y - 1, w + 2, h + 2, line)
    this.rect(x, y, w, h, fill)
  }

  /**
   * Preenchimento por varredura. `points` = [[x,y], ...] em ordem, poligono fechado.
   * Sem suavizacao: para cada linha inteira de y, acha onde o poligono comeca e
   * termina e pinta os pixels entre os dois.
   */
  fillPoly(points, color) {
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of points) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    minY = Math.max(0, Math.ceil(minY))
    maxY = Math.min(this.h - 1, Math.floor(maxY))
    if (maxY < minY) return

    this.ctx.fillStyle = color
    const n = points.length
    const crossings = []

    for (let y = minY; y <= maxY; y++) {
      crossings.length = 0
      const scan = y + 0.5 // meio do pixel: evita ambiguidade em vertice exato
      for (let i = 0; i < n; i++) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[(i + 1) % n]
        if (y1 === y2) continue
        if (scan < Math.min(y1, y2) || scan >= Math.max(y1, y2)) continue
        crossings.push(x1 + ((scan - y1) / (y2 - y1)) * (x2 - x1))
      }
      if (crossings.length < 2) continue
      crossings.sort((a, b) => a - b)
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const xa = Math.round(crossings[i])
        const xb = Math.round(crossings[i + 1])
        if (xb > xa) this.ctx.fillRect(xa, y, xb - xa, 1)
      }
    }
  }

  /** Linha de 1px (Bresenham) — para contorno de face. */
  line(x1, y1, x2, y2, color) {
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    x2 = Math.round(x2)
    y2 = Math.round(y2)
    const dx = Math.abs(x2 - x1)
    const dy = -Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx + dy
    this.ctx.fillStyle = color
    for (;;) {
      this.ctx.fillRect(x1, y1, 1, 1)
      if (x1 === x2 && y1 === y2) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x1 += sx
      }
      if (e2 <= dx) {
        err += dx
        y1 += sy
      }
    }
  }

  strokePoly(points, color) {
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      this.line(x1, y1, x2, y2, color)
    }
  }

  /**
   * Reticulado dentro de um poligono: escurece/clareia uma face sem inventar
   * uma cor nova. E o truque que os consoles de 16 bits usavam pra dar volume.
   * `step` 2 = xadrez 50%, 3 = mais raro.
   */
  ditherPoly(points, color, step = 2, phase = 0) {
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of points) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    minY = Math.max(0, Math.ceil(minY))
    maxY = Math.min(this.h - 1, Math.floor(maxY))
    this.ctx.fillStyle = color
    const n = points.length
    for (let y = minY; y <= maxY; y++) {
      const scan = y + 0.5
      const crossings = []
      for (let i = 0; i < n; i++) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[(i + 1) % n]
        if (y1 === y2) continue
        if (scan < Math.min(y1, y2) || scan >= Math.max(y1, y2)) continue
        crossings.push(x1 + ((scan - y1) / (y2 - y1)) * (x2 - x1))
      }
      if (crossings.length < 2) continue
      crossings.sort((a, b) => a - b)
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const xa = Math.round(crossings[i])
        const xb = Math.round(crossings[i + 1])
        for (let x = xa; x < xb; x++) {
          if ((x + y + phase) % step === 0) this.ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }

  /**
   * Sprite escrito como texto. Cada caractere e uma cor do mapa; espaco e vazio.
   * Serve pros desenhos pequenos (rosto, itens) onde e mais facil "escrever" o
   * desenho do que compor formas.
   */
  sprite(rows, palette, x, y, scale = 1) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]
      for (let i = 0; i < row.length; i++) {
        const color = palette[row[i]]
        if (!color) continue
        this.ctx.fillStyle = color
        this.ctx.fillRect(x + i * scale, y + j * scale, scale, scale)
      }
    }
  }
}

// ------------------------------------------------------------------ cores
/** Clareia/escurece um hex. Serve pra derivar as 3 faces de um movel de UMA cor. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(((n >> 16) & 255) * (1 + amount))
  const g = clamp(((n >> 8) & 255) * (1 + amount))
  const b = clamp((n & 255) * (1 + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16)
  const b = parseInt(hexB.slice(1), 16)
  const ch = (shift) => {
    const va = (a >> shift) & 255
    const vb = (b >> shift) & 255
    return Math.round(va + (vb - va) * t)
  }
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
