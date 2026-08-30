// A cozinha isométrica: estações, cozinheiros e o que eles carregam.
//
// Reaproveita o motor da casa (`iso.js`, `pixel.js`) sem tocar nele. Isso não é
// economia: é a decisão travada de direção de arte (pixel art isométrico 2.5D).
// Uma cozinha vista de cima destoaria de todo o resto do app.
//
// ------------------------------------------------------------- o que é regra,
//                                                                e o que é aqui
//
// **Este arquivo não sabe NENHUMA regra do jogo.** Ele não decide que a panela
// queimou, que o pedido venceu ou que o cozinheiro chegou. Ele recebe o estado
// (que carrega, pra cada coisa em andamento, a hora em que ela termina) e
// desenha o instante pedido.
//
// A diferença é a linha entre INTERPOLAR e SIMULAR:
//
//   - interpolar é `(agora - saiu) / (chega - saiu)` — desenhar um número que já
//     veio pronto. É tudo o que acontece aqui;
//   - simular seria decidir o que a barra cheia significa. Isso é do servidor.
//
// Se este arquivo também soubesse a regra, seriam **dois donos pro mesmo fato**,
// e o do app é o que a pessoa vê. É o defeito mais caro deste projeto (o prompt
// com dois donos, o chão do bichinho com dois números, a segunda grade da naval),
// e aqui ele foi evitado por desenho.
//
// ------------------------------------------------------------------ o custo
//
// O HANDOFF (seção 8.1) avisa que redesenhar a cena inteira a cada quadro é onde
// o celular esquenta. Piso, paredes e o corpo das estações **não se mexem**, então
// são desenhados UMA vez num canvas separado e colados. Por quadro sobra o que
// muda: o que está em cima das estações, as barras e os dois cozinheiros.

import { FACE_LEFT, FACE_RIGHT, FACE_TOP, TH, TW, TZ, depthSort, groundShadow, isoBox, project, roomMetrics } from './iso'
import { Painter, mix, shade } from './pixel'

const OUTLINE = '#33203a'
const ALTURA_PAREDE = 2

/** As três faces a partir de uma cor só — igual aos móveis da casa. */
function faces(base) {
  return {
    top: shade(base, FACE_TOP),
    left: shade(base, FACE_LEFT),
    right: shade(base, FACE_RIGHT),
  }
}

const COR = {
  piso: '#f0e2cd',
  pisoAlt: '#e6d4ba',
  parede: '#cfe3e6',
  bancada: '#e8dcc6',
  madeira: '#c08c4e',
  metal: '#b9c2cb',
  fogao: '#6f7a86',
  fogo: '#f08a3c',
  agua: '#7fc4e0',
  lixo: '#7d8a6b',
  entrega: '#f2b3c4',
  prato: '#fdfbf4',
  sujo: '#c4b79a',
  queimado: '#4a3a34',
}

export function medidas(largura, altura) {
  return roomMetrics(largura, altura, ALTURA_PAREDE)
}

// ============================================================= o fundo parado
//
// Piso, paredes e o CORPO das estacoes, desenhados uma vez. Guardados por uma
// chave que descreve o que esta ali: mudou a planta, mudou a chave, redesenha.

const cacheFundo = new Map()

export function fundoDaCozinha(largura, altura, estacoes) {
  const chave = `${largura}x${altura}|${estacoes.map((e) => `${e.tipo}${e.col},${e.row}`).join(';')}`
  const guardado = cacheFundo.get(chave)
  if (guardado) return guardado

  const { width, height, origin } = medidas(largura, altura)
  const tela = document.createElement('canvas')
  tela.width = width
  tela.height = height
  const p = new Painter(tela)

  // ------------------------------------------------------------ as paredes
  // Só as duas do fundo, como no cômodo da casa: as da frente esconderiam a
  // cozinha inteira.
  const pf = faces(COR.parede)
  isoBox(p, pf, { col: -0.35, row: -0.35, w: largura + 0.35, d: 0.35, z: 0, h: ALTURA_PAREDE }, origin, OUTLINE)
  isoBox(p, pf, { col: -0.35, row: 0, w: 0.35, d: altura, z: 0, h: ALTURA_PAREDE }, origin, OUTLINE)

  // ---------------------------------------------------------------- o piso
  // Xadrez, que é o que uma cozinha tem — e ajuda a contar as casas de olho,
  // que é como se calcula "está longe?" antes de tocar.
  for (let row = 0; row < altura; row++) {
    for (let col = 0; col < largura; col++) {
      const cor = (col + row) % 2 === 0 ? COR.piso : COR.pisoAlt
      p.fillPoly([
        project(col, row, 0, origin),
        project(col + 1, row, 0, origin),
        project(col + 1, row + 1, 0, origin),
        project(col, row + 1, 0, origin),
      ], cor)
    }
  }

  // -------------------------------------------------------- o corpo parado
  for (const estacao of depthSort(estacoes.map((e) => ({ ...e, w: 1, d: 1 })))) {
    corpoDaEstacao(p, estacao, origin)
  }

  const resultado = { tela, origin, width, height }
  // O cache guarda um canvas por planta. Como só existe uma planta hoje, e nível
  // novo é uma entrada nova no catálogo, ele nunca cresce sozinho — mas o teto
  // fica aqui pra que um dia com muitos níveis não vire memória parada.
  if (cacheFundo.size > 8) cacheFundo.clear()
  cacheFundo.set(chave, resultado)
  return resultado
}

/** O móvel de cada estação, sem nada em cima. Isto é o que não se mexe. */
function corpoDaEstacao(p, e, origin) {
  const { col, row } = e
  const base = { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0 }
  groundShadow(p, { col, row, w: 1, d: 1 }, origin)

  if (e.tipo === 'd') {
    // Despensa: caixote de madeira com a cor do ingrediente na tampa, pra dar
    // pra achar o tomate sem ler nada — a interface do gênero é por ícone.
    isoBox(p, faces(COR.madeira), { ...base, h: 0.62 }, origin, OUTLINE)
    const cor = e.cor || '#999'
    isoBox(p, faces(cor), { col: col + 0.2, row: row + 0.2, w: 0.6, d: 0.6, z: 0.62, h: 0.14 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'tabua') {
    isoBox(p, faces(COR.bancada), { ...base, h: 0.6 }, origin, OUTLINE)
    // a tábua em si, mais escura, e a faca encostada
    isoBox(p, faces('#d9a869'), { col: col + 0.16, row: row + 0.2, w: 0.68, d: 0.6, z: 0.6, h: 0.06 }, origin, OUTLINE)
    isoBox(p, faces(COR.metal), { col: col + 0.62, row: row + 0.26, w: 0.08, d: 0.42, z: 0.66, h: 0.03 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'panela') {
    isoBox(p, faces(COR.fogao), { ...base, h: 0.6 }, origin, OUTLINE)
    // a boca do fogão
    isoBox(p, faces('#3f4750'), { col: col + 0.2, row: row + 0.2, w: 0.6, d: 0.6, z: 0.6, h: 0.04 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'bancada') {
    isoBox(p, faces(COR.bancada), { ...base, h: 0.66 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'pratos') {
    isoBox(p, faces(COR.bancada), { ...base, h: 0.58 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'pia') {
    isoBox(p, faces(COR.bancada), { ...base, h: 0.6 }, origin, OUTLINE)
    // a cuba, afundada
    isoBox(p, faces('#9aa6b0'), { col: col + 0.18, row: row + 0.18, w: 0.64, d: 0.64, z: 0.52, h: 0.08 }, origin, OUTLINE)
    // a torneira
    isoBox(p, faces(COR.metal), { col: col + 0.42, row: row + 0.08, w: 0.1, d: 0.1, z: 0.6, h: 0.34 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'lixo') {
    isoBox(p, faces(COR.lixo), { col: col + 0.16, row: row + 0.16, w: 0.68, d: 0.68, z: 0, h: 0.72 }, origin, OUTLINE)
    isoBox(p, faces(shade(COR.lixo, -0.2)), { col: col + 0.1, row: row + 0.1, w: 0.8, d: 0.8, z: 0.72, h: 0.08 }, origin, OUTLINE)
    return
  }
  if (e.tipo === 'entrega') {
    isoBox(p, faces(COR.entrega), { ...base, h: 0.56 }, origin, OUTLINE)
    // a sineta do balcão: é o único enfeite, e é o que diz "é aqui que sai"
    isoBox(p, faces('#f6d372'), { col: col + 0.34, row: row + 0.34, w: 0.32, d: 0.32, z: 0.56, h: 0.16 }, origin, OUTLINE)
    return
  }
  isoBox(p, faces(COR.bancada), { ...base, h: 0.6 }, origin, OUTLINE)
}

// =========================================================== o que se mexe
//
// Daqui pra baixo tudo recebe `agora` e desenha O INSTANTE. Nenhuma decisao: so
// conta de tres.

/** Altura do tampo de cada estação — onde a comida pousa. */
function tampo(tipo) {
  if (tipo === 'lixo') return 0.8
  if (tipo === 'bancada') return 0.66
  if (tipo === 'd') return 0.76
  if (tipo === 'panela') return 0.64
  return 0.6
}

/** Um ingrediente, do tamanho de um punhado. A forma muda com o preparo. */
function desenharItem(p, item, col, row, z, origin, cores) {
  if (!item) return
  if (item.ing === 'prato') {
    const cor = item.estado === 'limpo' ? COR.prato : COR.sujo
    isoBox(p, faces(cor), { col: col + 0.22, row: row + 0.22, w: 0.56, d: 0.56, z, h: 0.06 }, origin, OUTLINE)
    // O que está montado aparece EMPILHADO no prato. É a única forma de saber o
    // que tem nele sem tocar — e num jogo de correria ninguém vai tocar pra ver.
    let altura = z + 0.06
    for (const dentro of item.montado || []) {
      const cor = cores[dentro.ing]?.cor || '#999'
      isoBox(p, faces(cor), { col: col + 0.3, row: row + 0.3, w: 0.4, d: 0.4, z: altura, h: 0.09 }, origin, OUTLINE)
      altura += 0.09
    }
    return
  }
  const base = item.estado === 'queimado' ? COR.queimado : (cores[item.ing]?.cor || '#999')
  if (item.estado === 'picado') {
    // Picado = três pedacinhos separados. A leitura é de longe: forma, não cor.
    for (const [dx, dy] of [[0.2, 0.24], [0.46, 0.3], [0.3, 0.52]]) {
      isoBox(p, faces(base), { col: col + dx, row: row + dy, w: 0.2, d: 0.2, z, h: 0.09 }, origin, OUTLINE)
    }
    return
  }
  const h = item.estado === 'cozido' ? 0.16 : 0.24
  isoBox(p, faces(base), { col: col + 0.26, row: row + 0.26, w: 0.48, d: 0.48, z, h }, origin, OUTLINE)
}

/**
 * A barra de progresso de uma estação.
 *
 * Ela é o rosto do desenho inteiro: sai de duas horas que vieram no estado, e é
 * a prova de que o app não precisa saber a regra. Vermelha quando é o prazo de
 * QUEIMAR — a mesma barra, com o significado invertido, e a cor é o que avisa.
 */
function barra(p, e, origin, agora, tempos) {
  if (e.fim_ms == null || e.fase == null) return
  const total = {
    picando: tempos.picar,
    cozinhando: tempos.cozinhar,
    queimando: tempos.queimar,
    lavando: tempos.lavar,
  }[e.fase]
  if (!total) return
  const andado = Math.max(0, Math.min(1, 1 - (e.fim_ms - agora) / total))
  const [x, y] = project(e.col + 0.5, e.row + 0.5, 1.35, origin)
  const larg = Math.round(TW * 0.52)
  const alt = 7
  const x0 = Math.round(x - larg / 2)
  const y0 = Math.round(y)
  p.rect(x0 - 1, y0 - 1, larg + 2, alt + 2, OUTLINE)
  p.rect(x0, y0, larg, alt, '#fff6e6')
  const cor = e.fase === 'queimando'
    ? mix('#f0b03c', '#e0432c', andado)   // esquenta conforme o estrago se aproxima
    : e.fase === 'lavando' ? COR.agua : '#7fd6b0'
  p.rect(x0, y0, Math.round(larg * andado), alt, cor)
}

/** Fumaça de queimado: o aviso que se vê sem olhar a barra. */
function fumaca(p, e, origin, t) {
  const [x, y] = project(e.col + 0.5, e.row + 0.5, 1.05, origin)
  for (let i = 0; i < 3; i++) {
    const fase = (t / 620 + i * 0.33) % 1
    const raio = 2 + fase * 4
    const px = Math.round(x + Math.sin((fase + i) * 5) * 6)
    const py = Math.round(y - fase * 26)
    p.rect(px - raio, py - raio, raio * 2, raio * 2, `rgba(70,60,66,${0.42 * (1 - fase)})`)
  }
}

/**
 * Onde o cozinheiro ESTÁ neste instante.
 *
 * Interpolação pura entre a célula de onde ele saiu e a de destino, usando as
 * duas horas que o servidor mandou. Este arquivo não decide que ele chegou — ele
 * só para de andar porque `agora` passou de `chega_ms`.
 */
export function ondeEsta(c, agora) {
  const dur = c.chega_ms - c.saiu_ms
  if (dur <= 0 || agora >= c.chega_ms) return { col: c.col, row: c.row, andando: false }
  const f = Math.max(0, (agora - c.saiu_ms) / dur)
  return {
    col: c.de_col + (c.col - c.de_col) * f,
    row: c.de_row + (c.row - c.de_row) * f,
    andando: true,
  }
}

const CORES_COZINHEIRO = {
  p1: { roupa: '#5ba8d6', pele: '#f0c9a4' },
  p2: { roupa: '#e07f9e', pele: '#f3d3b3' },
}

/** O cozinheiro: corpo, cabeça, chapéu, e o que ele carrega na frente. */
function desenharCozinheiro(p, c, lado, origin, agora, t, cores, ehMeu) {
  const pos = ondeEsta(c, agora)
  const cor = CORES_COZINHEIRO[lado] || CORES_COZINHEIRO.p1
  const col = pos.col
  const row = pos.row
  // O gingado só existe andando. Parado, ele fica parado — figura que treme no
  // lugar cansa a vista numa tela em que se olha o tempo todo.
  const balanco = pos.andando ? Math.abs(Math.sin(t / 90)) * 0.055 : 0
  const ocupado = c.ocupado_ate_ms != null && c.ocupado_ate_ms > agora
  // Ocupado (picando, lavando) ele se curva pra frente e volta: é o que mostra
  // que ele NÃO vai obedecer agora, sem precisar de texto.
  const trabalho = ocupado ? Math.abs(Math.sin(t / 110)) * 0.05 : 0

  groundShadow(p, { col, row, w: 1, d: 1 }, origin, 'rgba(40,22,44,0.24)')

  // pernas
  isoBox(p, faces('#4a4a58'), { col: col + 0.34, row: row + 0.36, w: 0.14, d: 0.24, z: 0, h: 0.26 + balanco }, origin, OUTLINE)
  isoBox(p, faces('#4a4a58'), { col: col + 0.52, row: row + 0.36, w: 0.14, d: 0.24, z: 0, h: 0.26 - balanco }, origin, OUTLINE)
  // corpo (o avental)
  isoBox(p, faces(cor.roupa), { col: col + 0.28, row: row + 0.3, w: 0.44, d: 0.36, z: 0.26, h: 0.42 - trabalho }, origin, OUTLINE)
  isoBox(p, faces('#fdfbf4'), { col: col + 0.34, row: row + 0.26, w: 0.32, d: 0.08, z: 0.3, h: 0.3 - trabalho }, origin, OUTLINE)
  // cabeça e chapéu
  const zc = 0.68 - trabalho
  isoBox(p, faces(cor.pele), { col: col + 0.32, row: row + 0.32, w: 0.36, d: 0.32, z: zc, h: 0.26 }, origin, OUTLINE)
  isoBox(p, faces('#fdfbf4'), { col: col + 0.3, row: row + 0.3, w: 0.4, d: 0.36, z: zc + 0.26, h: 0.1 }, origin, OUTLINE)
  isoBox(p, faces('#fdfbf4'), { col: col + 0.34, row: row + 0.34, w: 0.32, d: 0.28, z: zc + 0.36, h: 0.16 }, origin, OUTLINE)

  // o que ele carrega, na altura do peito
  if (c.mao) desenharItem(p, c.mao, col, row - 0.34, 0.62, origin, cores)

  // A SETA de quem é você. Num jogo de dois bonecos parecidos correndo, saber
  // qual é o seu tem que ser instantâneo — e cor sozinha não basta pra quem não
  // distingue bem as duas.
  if (ehMeu) {
    const [x, y] = project(col + 0.5, row + 0.5, 1.5 + (ocupado ? 0 : Math.sin(t / 260) * 0.06), origin)
    p.fillPoly([[x - 7, y - 8], [x + 7, y - 8], [x, y + 2]], '#f6d372')
    p.strokePoly([[x - 7, y - 8], [x + 7, y - 8], [x, y + 2]], OUTLINE)
  }
}

/**
 * Desenha a cozinha inteira num instante.
 *
 * `agora` vem de fora (o relógio do app, corrigido pelo do servidor) porque é
 * ele que decide onde o cozinheiro está — e não `t`, que é só o tempo de
 * animação e serve pra fumaça balançar.
 */
export function desenharCozinha(p, vista, agora, t = 0) {
  const { largura, altura, estacoes, cozinheiros } = vista
  const cores = vista.ingredientes || {}
  const enfeitadas = estacoes.map((e) => ({
    ...e, w: 1, d: 1, cor: cores[e.ing]?.cor,
  }))
  const fundo = fundoDaCozinha(largura, altura, enfeitadas)
  const origin = fundo.origin

  p.clear()
  p.ctx.drawImage(fundo.tela, 0, 0)

  // Tudo o que se mexe entra na MESMA fila de profundidade. Desenhar os
  // cozinheiros por último (o caminho fácil) os faria passar POR CIMA das
  // estações ao andar atrás delas — em isométrico quem está ao fundo vem antes.
  const fila = [...enfeitadas]
  for (const [lado, c] of Object.entries(cozinheiros)) {
    const pos = ondeEsta(c, agora)
    fila.push({ _chef: true, lado, c, col: pos.col, row: pos.row, w: 1, d: 1 })
  }

  for (const coisa of depthSort(fila)) {
    if (coisa._chef) {
      desenharCozinheiro(p, coisa.c, coisa.lado, origin, agora, t, cores, coisa.lado === vista.meu_lado)
      continue
    }
    // o corpo já veio no fundo; aqui só o que está EM CIMA dele
    if (coisa.tipo === 'pratos') {
      for (let i = 0; i < (vista.pratos_limpos || 0); i++) {
        isoBox(p, faces(COR.prato), {
          col: coisa.col + 0.24, row: coisa.row + 0.24, w: 0.52, d: 0.52,
          z: tampo('pratos') + i * 0.07, h: 0.06,
        }, origin, OUTLINE)
      }
      continue
    }
    if (coisa.tipo === 'pia') {
      for (let i = 0; i < (coisa.sujos || 0); i++) {
        isoBox(p, faces(COR.sujo), {
          col: coisa.col + 0.24, row: coisa.row + 0.24, w: 0.5, d: 0.5,
          z: 0.56 + i * 0.07, h: 0.06,
        }, origin, OUTLINE)
      }
      barra(p, coisa, origin, agora, vista.tempos)
      continue
    }
    if (coisa.tipo === 'panela' && coisa.item) {
      // a panela em volta da comida, pra ela não parecer boiando no fogão
      isoBox(p, faces(COR.metal), {
        col: coisa.col + 0.18, row: coisa.row + 0.18, w: 0.64, d: 0.64, z: 0.64, h: 0.1,
      }, origin, OUTLINE)
    }
    desenharItem(p, coisa.item, coisa.col, coisa.row, tampo(coisa.tipo), origin, cores)
    barra(p, coisa, origin, agora, vista.tempos)
    if (coisa.item?.estado === 'queimado') fumaca(p, coisa, origin, t)
  }
}

/** O pixel do dedo -> a estação tocada, ou null. Usado pela tela. */
export function estacaoNoPonto(vista, x, y) {
  const { origin } = medidas(vista.largura, vista.altura)
  // As estações são altas, então o dedo quase sempre cai no CORPO delas e não na
  // célula do chão. Converter direto por `unproject` acertaria a célula de trás.
  // Por isso a busca é pela distância ao topo desenhado de cada estação, que é
  // onde a pessoa está de fato mirando.
  let melhor = null
  let menor = Infinity
  for (const e of vista.estacoes) {
    const [ex, ey] = project(e.col + 0.5, e.row + 0.5, tampo(e.tipo), origin)
    const dist = Math.hypot(x - ex, y - ey)
    if (dist < menor) {
      menor = dist
      melhor = e
    }
  }
  // Um raio de meia célula: fora disso o toque foi no chão, e chão não é alvo.
  return menor <= TW * 0.42 ? melhor : null
}

export { TW, TH, TZ }
