import assert from 'node:assert/strict'

import { auditarTudo } from './src/render/furnitureAudit.js'
import { SHAPES } from './src/render/furniture.js'
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

console.log('móveis: 56 desenhos conferidos, nenhuma peça enterrada em outra')
