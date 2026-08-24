// O passeio do bichinho pelo cômodo.
//
// A decisão do dono foi direta: **ele não pode ficar parado**. Antes daqui a
// posição dele vinha de uma conta feita uma vez ("a célula livre ao lado da
// caminha") e nunca mais mudava — o bichinho era mobília com carinha.
//
// Como funciona: ele escolhe uma célula livre, anda até lá em linha, para um
// pouco, e escolhe outra. Andar é interpolar entre a célula de onde saiu e a de
// destino; a posição vira fracionária (4,3 em vez de 4), e o desenho usa isso
// direto na projeção isométrica — que aceita fração sem problema nenhum.
//
// Por que não é um `setInterval` mexendo em estado do React: isso re-renderizaria
// a árvore inteira várias vezes por segundo só pra mover um bicho. Aqui o passeio
// é um objeto simples que o laço de desenho avança sozinho, no mesmo quadro em
// que pinta. O React só fica sabendo quando algo que importa pra ELE muda.

const PARADO_MIN = 900       // ms parado antes de escolher outro lugar
const PARADO_MAX = 3200
const VELOCIDADE = 1.6       // células por segundo

/** Cria o passeio. `ocupadas` é um Set de "col:row" onde ele não pode pisar. */
export function criarPasseio(cols, rows, ocupadas, inicio) {
  const livre = (c, r) =>
    c >= 0 && r >= 0 && c < cols && r < rows && !ocupadas.has(`${c}:${r}`)

  let col = inicio?.[0] ?? 0
  let row = inicio?.[1] ?? 0
  if (!livre(col, row)) {
    // o lugar onde ele estava virou móvel ou sujeira: acha o primeiro livre
    busca: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (livre(c, r)) {
          col = c
          row = r
          break busca
        }
      }
    }
  }

  return {
    col,
    row,
    deCol: col,
    deRow: row,
    paraCol: col,
    paraRow: row,
    andando: false,
    olhando: 'direita',
    progresso: 0,
    esperar: 600,
    ultimo: 0,
    livre,
    cols,
    rows,
  }
}

/** Sorteia um destino perto, pra ele passear em vez de teleportar pro outro canto. */
function escolherDestino(p) {
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    const dc = Math.round((Math.random() - 0.5) * 6)
    const dr = Math.round((Math.random() - 0.5) * 6)
    const c = p.col + dc
    const r = p.row + dr
    if ((dc || dr) && p.livre(Math.round(c), Math.round(r))) return [Math.round(c), Math.round(r)]
  }
  return null
}

/**
 * Avança o passeio até o instante `t` (em ms). Devolve o próprio estado.
 *
 * Ele recebe o relógio em vez de guardar um `setInterval` porque assim o
 * movimento acompanha o quadro: em aba que o navegador segurou, o tempo pula e
 * ele aparece no lugar certo, sem "correr" pra recuperar o atraso.
 */
export function passearAte(p, t, parado = false) {
  if (!p.ultimo) p.ultimo = t
  // Teto no salto de tempo: voltando de uma aba parada por 10 minutos, sem isto
  // ele atravessaria o cômodo inteiro de uma vez.
  const dt = Math.min(250, t - p.ultimo)
  p.ultimo = t
  if (dt <= 0) return p

  // Enquanto ele está fazendo outra coisa (comendo, tomando banho, dormindo),
  // o passeio fica congelado — senão ele comeria andando.
  if (parado) {
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
      p.esperar = PARADO_MIN + Math.random() * (PARADO_MAX - PARADO_MIN)
    }
    return p
  }

  p.esperar -= dt
  if (p.esperar > 0) return p

  const destino = escolherDestino(p)
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
  // Em isométrico, "pra direita na tela" é coluna crescendo E linha diminuindo.
  // Usar só a coluna deixaria ele andando de costas metade do tempo.
  const rumo = p.paraCol - p.deCol - (p.paraRow - p.deRow)
  if (rumo !== 0) p.olhando = rumo > 0 ? 'direita' : 'esquerda'
  return p
}
