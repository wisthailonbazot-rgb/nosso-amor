import assert from 'node:assert/strict'
import { CITY_PLACES, CITY_START, cityPath, isCityWalkable } from './src/render/cityMap.js'

assert.ok(isCityWalkable(...CITY_START), 'a posicao inicial precisa ser caminhavel')
for (const place of CITY_PLACES) {
  assert.ok(isCityWalkable(...place.door), `${place.code}: a porta precisa estar ligada a rua`)
  const path=cityPath(CITY_START,place.door)
  assert.deepEqual(path[0],CITY_START,`${place.code}: o caminho nasce no avatar`)
  assert.deepEqual(path.at(-1),place.door,`${place.code}: o caminho chega na porta`)
  for(let i=1;i<path.length;i++){
    const distance=Math.abs(path[i][0]-path[i-1][0])+Math.abs(path[i][1]-path[i-1][1])
    assert.equal(distance,1,`${place.code}: nao pode atravessar lote/parede`)
  }
}
console.log(`cidade: ${CITY_PLACES.length} lugares ligados por caminhos reais`)
