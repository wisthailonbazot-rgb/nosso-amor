// Caça-sobreposição: acha peça de móvel enfiada dentro de outra, sozinha.
//
// ------------------------------------------------------------------ por que
//
// O dono disse "os objetos ainda estão bugados, com partes se sobrepondo, o sofá
// nem parece um sofá". Ele está certo, e o motivo é chato: cada móvel é uma
// pilha de blocos escritos em fração de célula, e é fácil dois blocos ocuparem o
// MESMO espaço sem ninguém perceber. No sofá, por exemplo, o encosto ia até 0,65
// de profundidade e o assento começava em 0,62 — três centésimos de célula de
// invasão, que na tela viram a borda do assento saindo por dentro do encosto.
//
// Olhar 30 móveis em 4 rotações é 120 telas, e defeito de 3 centésimos não se vê
// numa miniatura. Mas a máquina vê: cada bloco é uma CAIXA (x, y, z, largura,
// profundidade, altura), e duas caixas que se cruzam nos três eixos ao mesmo
// tempo estão dentro uma da outra. Isso é conta, não olho.
//
// ------------------------------------------------------- o que NÃO é defeito
//
// Encostar não é invadir: o assento que começa exatamente onde o encosto termina
// compartilha uma parede, e isso é o certo. Por isso a conta usa uma folga —
// só conta como sobreposição quando a interseção tem volume de verdade.
//
// E existe sobreposição PROPOSITAL: um friso afundado na porta da geladeira, um
// cone de alto-falante embutido na caixa, a almofada que afunda no sofá. Esses
// são o jeito de fazer relevo sem mais geometria. Por isso o que se mede é
// quanto do bloco MENOR está enterrado: até um terço é acabamento; acima disso é
// peça perdida dentro de outra, que é o que aparece como "bugado".

import { SHAPES, comEspiao } from './furniture'

/** Um pintor que não pinta: só anota as caixas que pediram pra desenhar. */
function pintorDeMentira() {
  const nada = () => {}
  return {
    ctx: {
      save: nada, restore: nada, translate: nada, scale: nada, fill: nada,
      beginPath: nada, arc: nada, moveTo: nada, lineTo: nada, closePath: nada,
      createRadialGradient: () => ({ addColorStop: nada }),
      set fillStyle(_) {}, get fillStyle() { return '#000' },
      set strokeStyle(_) {}, get strokeStyle() { return '#000' },
      set globalAlpha(_) {}, get globalAlpha() { return 1 },
    },
    w: 512,
    h: 512,
    clear: nada,
    px: nada,
    rect: nada,
    line: nada,
    fillPoly: nada,
    strokePoly: nada,
  }
}

/**
 * Roda uma forma anotando as caixas, em vez de desenhar.
 *
 * O truque é trocar `isoBox` por um espião — mas `isoBox` é importada direto
 * pela `furniture.js`, então não dá pra trocar de fora. Em vez disso a gente
 * chama a forma com um pintor de mentira e lê as caixas pelo `fillPoly`… que
 * também não serve, porque ele já recebe pixel.
 *
 * A saída é mais simples e mais honesta: as formas descrevem as caixas em
 * coordenada LOCAL, e é essa a coordenada que interessa. Então a auditoria passa
 * um `tools` espião — o mesmo objeto que as formas usam — e anota o que chega em
 * `box()`. É por isso que `SHAPES` recebe as ferramentas de fora nesta versão.
 */
export function caixasDe(nome, { w = 2, d = 1 } = {}) {
  const forma = SHAPES[nome]
  if (!forma) return []
  const caixas = []
  const espiao = {
    W: w,
    D: d,
    box(lx, ly, lw, ld, z, h) {
      if (lw > 0 && ld > 0 && h > 0) caixas.push({ lx, ly, lw, ld, z, h })
    },
    flat: () => {},
    outlineFlat: () => {},
    screen: () => [0, 0],
  }
  try {
    comEspiao(espiao, () => {
      forma(pintorDeMentira(), { col: 0, row: 0, w, d, dir: 0, color: '#888' }, { x: 0, y: 0 }, 0)
    })
  } catch {
    return []
  }
  return caixas
}

/** Quanto duas caixas se cruzam, em volume. */
function volumeComum(a, b) {
  const x = Math.min(a.lx + a.lw, b.lx + b.lw) - Math.max(a.lx, b.lx)
  const y = Math.min(a.ly + a.ld, b.ly + b.ld) - Math.max(a.ly, b.ly)
  const z = Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z)
  // A folga tira o "encostar": partilhar uma parede dá interseção de espessura
  // zero, e arredondamento de fração faz isso virar um fiapo.
  const folga = 0.004
  if (x <= folga || y <= folga || z <= folga) return 0
  return x * y * z
}

const volume = (c) => c.lw * c.ld * c.h

/**
 * Auditoria de uma forma: devolve os pares enterrados um no outro.
 *
 * `fundo` é a fração do bloco MENOR que pode ficar enterrada sem ser defeito.
 *
 * O limite subiu de um terço para 0,95 depois da primeira rodada, e o motivo é
 * o que a primeira rodada ensinou: **afundar é a técnica, não o defeito**. Uma
 * almofada meio enterrada no assento é o que dá volume ao sofá; o cone afundado
 * na caixa de som é o que faz ele ter cara de cone.
 *
 * O defeito é a peça **inteiramente dentro** de outra. Ela não some — o desenho
 * é por cima, então ela pinta em cima do pai — mas as duas faces caem no MESMO
 * plano, e duas faces coplanares com contorno viram um risco atravessado no
 * lugar de um relevo. Foi exatamente isso na porta da geladeira.
 *
 * A regra que saiu daqui, e que vale pra móvel novo: **todo detalhe tem que
 * SAIR da face do pai**, nem que seja por 0,04 de célula. Aí ele ganha sombra
 * própria e o contorno tem onde encostar.
 */
export function sobreposicoesDe(nome, tamanho, fundo = 0.95) {
  const caixas = caixasDe(nome, tamanho)
  const achados = []
  for (let i = 0; i < caixas.length; i++) {
    for (let j = i + 1; j < caixas.length; j++) {
      const comum = volumeComum(caixas[i], caixas[j])
      if (!comum) continue
      const menor = Math.min(volume(caixas[i]), volume(caixas[j]))
      const parte = comum / menor
      if (parte > fundo) achados.push({ a: i, b: j, parte: Number(parte.toFixed(2)) })
    }
  }
  return achados
}

/** A mesma auditoria em todas as formas, pro que a bancada e o smoke mostram. */
export function auditarTudo(tamanhos = {}) {
  const relatorio = []
  for (const nome of Object.keys(SHAPES)) {
    const t = tamanhos[nome] || { w: 2, d: 1 }
    const achados = sobreposicoesDe(nome, t)
    if (achados.length) relatorio.push({ nome, achados })
  }
  return relatorio
}
