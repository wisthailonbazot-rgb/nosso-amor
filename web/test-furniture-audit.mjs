import assert from 'node:assert/strict'

import { auditarTudo, caixasDe } from './src/render/furnitureAudit.js'
import { SHAPES, retanguloGirado } from './src/render/furniture.js'
import { FURNITURE_SIZES } from './src/render/furnitureSizes.js'

assert.equal(Object.keys(SHAPES).length, 56, 'a bancada precisa cobrir os 56 desenhos')
assert.deepEqual(
  new Set(Object.keys(FURNITURE_SIZES)),
  new Set(Object.keys(SHAPES)),
  'todo desenho precisa ser auditado no tamanho em que é vendido',
)

const sizes = Object.fromEntries(
  Object.entries(FURNITURE_SIZES).map(([name, [w, d]]) => [name, { w, d }]),
)
const overlaps = auditarTudo(sizes)
assert.deepEqual(overlaps, [], `peças enterradas: ${JSON.stringify(overlaps)}`)

// A auditoria antiga só chamava cada forma em 0°. Isso deixava passar justamente
// a regressão relatada: o objeto bom parado e quebrado depois de tocar em Girar.
// Agora os blocos dos 56 objetos atravessam a mesma transformação do desenho nas
// quatro direções, e nenhum pode fugir materialmente da célula que bloqueia.
for (const [name, [intrinsicW, intrinsicD]] of Object.entries(FURNITURE_SIZES)) {
  const boxes = caixasDe(name, { w: intrinsicW, d: intrinsicD })
  for (let dir = 0; dir < 4; dir++) {
    const w = dir % 2 ? intrinsicD : intrinsicW
    const d = dir % 2 ? intrinsicW : intrinsicD
    for (const [index, box] of boxes.entries()) {
      const turned = retanguloGirado(
        { col: 0, row: 0, w, d, dir },
        box.lx, box.ly, box.lw, box.ld,
      )
      // Puxadores, botões e a curva da rede passam alguns centésimos da base de
      // propósito. Mais de 0,20 célula já é peça desenhada fora do móvel.
      const margin = 0.2
      assert.ok(
        turned.col >= -margin && turned.row >= -margin &&
          turned.col + turned.w <= w + margin && turned.row + turned.d <= d + margin,
        `${name} ${dir * 90}°: bloco ${index} saiu da área ${w}x${d}`,
      )
    }
    const whole = retanguloGirado({ col: 0, row: 0, w, d, dir }, 0, 0, intrinsicW, intrinsicD)
    assert.ok(Math.abs(whole.w - w) < 1e-9 && Math.abs(whole.d - d) < 1e-9,
      `${name} ${dir * 90}°: a rotação não ocupa ${w}x${d}`)
  }
}

console.log('móveis: 56 desenhos × 4 rotações, sem peça enterrada ou fora da área')
