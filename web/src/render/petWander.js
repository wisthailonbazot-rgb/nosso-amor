// O passeio do bichinho pelo cômodo — e o que ele faz quando chega lá.
//
// A decisão do dono foi direta: **ele não pode ficar parado**. Antes daqui a
// posição dele vinha de uma conta feita uma vez ("a célula livre ao lado da
// caminha") e nunca mais mudava — o bichinho era mobília com carinha.
//
// A primeira versão resolveu o andar: ele escolhia uma célula livre, andava até
// lá, parava, escolhia outra. Só que o destino era **sorteado**, e um bicho que
// anda em linha reta pra lugar nenhum ainda é um bicho burro. Agora o cômodo
// tem **pontos de interesse**: a caminha, o pote, o arranhador, o sofá, o
// tapete, a planta. Ele escolhe UM, vai até ele e **faz a coisa certa lá** —
// dorme na caminha, come no pote, se coça no arranhador, rola no tapete.
//
// É isso que liga o módulo do bichinho ao da casa nos dois sentidos: até aqui a
// casa afetava o bichinho (móvel ocupa célula, sujeira bloqueia), mas o
// bichinho não tinha o que fazer com a casa além de desviar dela.
//
// Por que não é um `setInterval` mexendo em estado do React: isso re-renderizaria
// a árvore inteira várias vezes por segundo só pra mover um bicho. Aqui o passeio
// é um objeto simples que o laço de desenho avança sozinho, no mesmo quadro em
// que pinta. O React só fica sabendo quando algo que importa pra ELE muda.

const PARADO_MIN = 700       // ms parado antes de escolher o que fazer
const PARADO_MAX = 2400
const VELOCIDADE = 1.6       // células por segundo

/**
 * O que cada móvel oferece ao bichinho.
 *
 * A chave é o código do catálogo (Python) e o valor diz que clipe de animação
 * rodar e por quanto tempo. Móvel que não está aqui simplesmente não atrai —
 * não existe caso especial escondido em outro arquivo.
 */
export const INTERESSES = {
  house_caminha_pet: { acao: 'dormir', dur: [7000, 16000], frase: 'dormindo na caminha' },
  house_casinha_pet: { acao: 'dormir', dur: [8000, 18000], frase: 'enfiado na casinha' },
  house_cama: { acao: 'dormir', dur: [6000, 14000], frase: 'roubando a cama de vocês' },
  house_comedouro: { acao: 'comer', dur: [3000, 6000], frase: 'beliscando no comedouro' },
  house_arranhador: { acao: 'cocar', dur: [2500, 5000], frase: 'afiando as unhas no arranhador' },
  house_sofa: { acao: 'deitar', dur: [6000, 13000], frase: 'esparramado no sofá' },
  house_puff: { acao: 'sentar', dur: [4000, 9000], frase: 'sentado no puff' },
  house_rede: { acao: 'deitar', dur: [7000, 15000], frase: 'balançando na rede' },
  house_tapete: { acao: 'rolar', dur: [2500, 5000], frase: 'rolando no tapete' },
  house_planta: { acao: 'cavar', dur: [2000, 4000], frase: 'cavucando a planta' },
  house_planta_grande: { acao: 'cavar', dur: [2000, 4000], frase: 'cavucando a planta' },
  house_horta: { acao: 'cavar', dur: [2500, 5000], frase: 'revirando a horta' },
  house_balanco: { acao: 'brincar', dur: [3000, 6000], frase: 'brincando no balanço' },
  house_arvore: { acao: 'brincar', dur: [3000, 7000], frase: 'rondando a árvore' },
  house_tv: { acao: 'sentar', dur: [5000, 11000], frase: 'assistindo TV com vocês' },
  house_geladeira: { acao: 'implorar', dur: [2500, 5000], frase: 'de olho na geladeira' },
  house_fogao: { acao: 'implorar', dur: [2500, 5000], frase: 'esperando cair comida' },
  house_churrasqueira: { acao: 'implorar', dur: [3000, 6000], frase: 'de olho na churrasqueira' },
}

/**
 * O que ele faz sozinho, sem móvel nenhum por perto.
 *
 * Cômodo vazio não pode virar bichinho andando em círculo pra sempre: o
 * repertório mínimo existe justamente pra sala pelada continuar viva. O peso é
 * quantas vezes cada um entra no sorteio.
 */
const OCIOSAS = [
  { acao: null, peso: 5, dur: [900, 2600], frase: 'dando uma volta' },        // só parar
  { acao: 'sentar', peso: 3, dur: [3000, 7000], frase: 'sentado, observando' },
  { acao: 'deitar', peso: 2, dur: [5000, 11000], frase: 'deitado no chão' },
  { acao: 'cocar', peso: 2, dur: [1800, 3200], frase: 'se coçando' },
  { acao: 'rolar', peso: 1, dur: [2200, 4000], frase: 'rolando no chão' },
  { acao: 'brincar', peso: 2, dur: [2000, 4500], frase: 'brincando sozinho' },
  { acao: 'implorar', peso: 1, dur: [2000, 4000], frase: 'pedindo atenção' },
]

/** Quem tem asa também levanta voo de vez em quando. */
const OCIOSAS_VOADOR = [
  ...OCIOSAS,
  { acao: 'voar', peso: 4, dur: [2500, 5000], frase: 'dando uma voada' },
  { acao: 'planar', peso: 2, dur: [4000, 8000], frase: 'planando pelo cômodo' },
]

function sortearPesado(lista) {
  const total = lista.reduce((s, o) => s + o.peso, 0)
  let n = Math.random() * total
  for (const o of lista) {
    n -= o.peso
    if (n <= 0) return o
  }
  return lista[0]
}

const entre = ([a, b]) => a + Math.random() * (b - a)

/**
 * Cria o passeio.
 *
 * `ocupadas` é um Set de "col:row" onde ele não pode pisar. `interesses` é a
 * lista de móveis do cômodo (`{code, col, row, w, d}`) — o passeio descobre
 * sozinho quais deles têm algo a oferecer.
 */
export function criarPasseio(cols, rows, ocupadas, inicio, interesses = [], voador = false) {
  const livre = (c, r) =>
    c >= 0 && r >= 0 && c < cols && r < rows && !ocupadas.has(`${c}:${r}`)

  let col = inicio?.[0] ?? 0
  let row = inicio?.[1] ?? 0
  if (!livre(col, row)) {
    // o lugar onde ele estava virou móvel ou sujeira: acha o primeiro livre
    busca: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (livre(c, r)) { col = c; row = r; break busca }
      }
    }
  }

  return {
    col, row,
    deCol: col, deRow: row,
    paraCol: col, paraRow: row,
    andando: false,
    olhando: 'direita',
    progresso: 0,
    esperar: 600,
    ultimo: 0,
    acao: null,          // clipe forçado enquanto ele está ocupado
    frase: 'chegando agora',
    alvo: null,          // o que ele vai fazer quando terminar de andar
    livre, cols, rows, voador,
    interesses: pontosDeInteresse(interesses, livre),
  }
}

/**
 * Converte a lista de móveis nas células ONDE FICAR pra usar cada um.
 *
 * O bichinho não pode pisar em cima do móvel (a célula está ocupada, e o
 * servidor conta com isso), então o ponto é sempre uma célula LIVRE encostada
 * nele. Sem esse passo, ele andaria até a borda do sofá e pararia a dois metros
 * — ou pior, tentaria um destino impossível e ficaria travado.
 */
export function pontosDeInteresse(itens, livre) {
  const pontos = []
  for (const item of itens || []) {
    const oferta = INTERESSES[item.code]
    if (!oferta) continue
    const w = item.w || 1
    const d = item.d || 1
    const vizinhas = []
    for (let r = item.row - 1; r <= item.row + d; r++) {
      for (let c = item.col - 1; c <= item.col + w; c++) {
        const dentro = c >= item.col && c < item.col + w && r >= item.row && r < item.row + d
        if (dentro || !livre(c, r)) continue
        vizinhas.push([c, r])
      }
    }
    if (vizinhas.length) pontos.push({ ...oferta, code: item.code, vizinhas })
  }
  return pontos
}

/** Sorteia um destino perto, pra ele passear em vez de teleportar pro outro canto. */
function celulaSolta(p) {
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    const dc = Math.round((Math.random() - 0.5) * 6)
    const dr = Math.round((Math.random() - 0.5) * 6)
    const c = Math.round(p.col + dc)
    const r = Math.round(p.row + dr)
    if ((dc || dr) && p.livre(c, r)) return [c, r]
  }
  return null
}

/**
 * Decide o próximo compromisso.
 *
 * Metade das vezes ele procura um móvel; a outra metade é volta sem destino.
 * Se fosse sempre móvel, o bichinho viraria um robô de rotina indo de estação
 * em estação; se nunca fosse, os móveis comprados não teriam serventia nenhuma
 * pra ele — que é como estava.
 */
function decidir(p) {
  const querMovel = p.interesses.length > 0 && Math.random() < 0.55
  if (querMovel) {
    const ponto = p.interesses[Math.floor(Math.random() * p.interesses.length)]
    const livres = ponto.vizinhas.filter(([c, r]) => p.livre(c, r))
    if (livres.length) {
      const [c, r] = livres[Math.floor(Math.random() * livres.length)]
      return { destino: [c, r], alvo: ponto }
    }
  }
  const destino = celulaSolta(p)
  const ocio = sortearPesado(p.voador ? OCIOSAS_VOADOR : OCIOSAS)
  return { destino, alvo: ocio }
}

/**
 * Avança o passeio até o instante `t` (em ms). Devolve o próprio estado.
 *
 * Ele recebe o relógio em vez de guardar um `setInterval` porque assim o
 * movimento acompanha o quadro: em aba que o navegador segurou, o tempo pula e
 * ele aparece no lugar certo, sem "correr" pra recuperar o atraso.
 *
 * `congelado` é o veto de fora: enquanto a tela está mandando uma ação (o
 * "Interagir", ou o bichinho doente), o passeio não decide nada por conta.
 */
export function passearAte(p, t, congelado = false) {
  if (!p.ultimo) p.ultimo = t
  // Teto no salto de tempo: voltando de uma aba parada por 10 minutos, sem isto
  // ele atravessaria o cômodo inteiro de uma vez.
  const dt = Math.min(250, t - p.ultimo)
  p.ultimo = t
  if (dt <= 0) return p

  if (congelado) {
    p.andando = false
    return p
  }

  if (p.andando) {
    p.progresso += (dt / 1000) * VELOCIDADE
    const passos = Math.max(1, Math.abs(p.paraCol - p.deCol) + Math.abs(p.paraRow - p.deRow))
    const f = Math.min(1, p.progresso / passos)
    p.col = p.deCol + (p.paraCol - p.deCol) * f
    p.row = p.deRow + (p.paraRow - p.deRow) * f
    if (f >= 1) {
      p.col = p.paraCol
      p.row = p.paraRow
      p.andando = false
      // Chegou: agora ele FAZ o que veio fazer. É aqui que "andar até a caminha"
      // vira "dormir na caminha" — sem isto, chegar e sair de novo seria a mesma
      // caminhada aleatória de antes, só que passando perto dos móveis.
      const alvo = p.alvo
      p.acao = alvo?.acao || null
      p.frase = alvo?.frase || 'dando uma volta'
      p.esperar = alvo?.dur ? entre(alvo.dur) : PARADO_MIN + Math.random() * (PARADO_MAX - PARADO_MIN)
      p.alvo = null
    }
    return p
  }

  p.esperar -= dt
  if (p.esperar > 0) return p

  p.acao = null
  const { destino, alvo } = decidir(p)
  if (!destino) {
    p.esperar = 1200 // cômodo lotado: tenta de novo daqui a pouco
    return p
  }
  p.deCol = p.col
  p.deRow = p.row
  p.paraCol = destino[0]
  p.paraRow = destino[1]
  p.progresso = 0
  p.andando = true
  p.alvo = alvo
  p.frase = 'indo dar uma volta'
  // Em isométrico, "pra direita na tela" é coluna crescendo E linha diminuindo.
  // Usar só a coluna deixaria ele andando de costas metade do tempo.
  const rumo = p.paraCol - p.deCol - (p.paraRow - p.deRow)
  if (rumo !== 0) p.olhando = rumo > 0 ? 'direita' : 'esquerda'
  return p
}
