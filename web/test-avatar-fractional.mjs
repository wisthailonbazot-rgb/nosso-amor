import assert from 'node:assert/strict'

// O corpo curvo usa um canvas temporário para moldar a silhueta. A bancada Node
// fornece somente o pedaço da API necessário para testar a conta dos pixels.
const draftContext = { imageSmoothingEnabled: false, drawImage() {} }
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas')
    return { width: 0, height: 0, getContext: () => draftContext }
  },
}

const { drawAvatar } = await import('./src/render/avatar.js')

const pixels = new Uint8ClampedArray(14 * 2 * 4)
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 180
  pixels[i + 1] = 100
  pixels[i + 2] = 120
  pixels[i + 3] = 255
}

const leituras = []
const painter = {
  w: 848,
  h: 590,
  canvas: {},
  rect(x, y, w, h) {
    assert.ok([x, y, w, h].every(Number.isFinite), 'retângulo recebeu coordenada inválida')
  },
  ctx: {
    imageSmoothingEnabled: false,
    clearRect() {},
    drawImage() {},
    getImageData(x, y, w, h) {
      leituras.push([x, y, w, h])
      return { data: pixels }
    },
  },
}

const config = {
  skin: '#d9a381',
  hair_color: '#4f3228',
  eye_color: '#3b2b26',
  hair_style: 'curto',
  eyes: 'redondo',
  brows: 'reta',
  mouth: 'sorriso',
  corpo: 'curvas',
  top: 'camiseta',
  top_color: '#e8879b',
  bottom: 'jeans',
  bottom_color: '#5b8def',
  shoes: 'tenis',
  shoes_color: '#5a4540',
  head: '',
  extra: '',
}

// Este número reproduz a perda de precisão da cidade:
// (x + 11) - (x + 9) era 1.9999999999999982, não 2.
drawAvatar(painter, config, 5.002006018054162, 77.00601805416249)

assert.equal(leituras.length, 1)
assert.deepEqual(leituras[0], [14, 105, 14, 2])
assert.ok(leituras[0].every(Number.isInteger), 'ImageData precisa usar pixels inteiros')
console.log('avatar: coordenadas fracionárias do mapa não quebram a leitura de pixels')
