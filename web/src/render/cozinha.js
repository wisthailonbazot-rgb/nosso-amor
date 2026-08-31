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
// A parede subiu de 2 pra 3, e isso e ganho de TELA.
//
// A arte isometrica e limitada pela largura (~2:1), entao a altura sobrava. A
// parede e a unica parte da cena que pode crescer sem deformar nada: ela nao tem
// celulas, nao entra na projecao do chao, e cada unidade dela sao 48 px de arte
// a mais.
//
// Cheguei a por 4, e ficou ERRADO: a faixa acima dos armarios virava um paredao
// azul de ~100 px e a cozinha parecia estar no fundo de um poco. 3 e o ponto em
// que a parede ainda cresce (+48 px de arte, canvas de 246 -> 290 px de tela)
// sem passar a dominar a cena. Espaco aproveitado nao e espaco preenchido.
//
// Mas parede vazia e pior que tela vazia — ficaria um poco azul. Por isso ela
// ganhou azulejo, uma JANELA com vista e uma prateleira com potes: o espaco que
// era desperdicio passou a ser cozinha.
const ALTURA_PAREDE = 3
const QUEIMADO = 'queimado'

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
  decorarParede(p, largura, altura, origin)

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

/**
 * O que enche a parede alta: azulejo, uma janela e uma prateleira.
 *
 * A parede cresceu pra aproveitar a altura da tela (ver `ALTURA_PAREDE`), e
 * parede lisa de 4 unidades seria um paredão azul — trocaria "tela vazia" por
 * "cozinha vazia", que não é melhor. Com azulejo, janela e potes, o espaço que
 * era desperdício vira cenário.
 *
 * Tudo aqui é desenhado UMA vez, junto com o fundo: nada disso se mexe.
 */
function decorarParede(p, largura, altura, origin) {
  // ---------------------------------------------------------- o azulejo
  // Faixas horizontais nas duas paredes, a cada meia unidade de altura. Elas
  // dão escala à parede: sem nenhuma linha, não dá pra perceber que ela é alta.
  for (let z = 0.5; z < ALTURA_PAREDE; z += 0.5) {
    const claro = shade(COR.parede, z % 1 === 0 ? -0.1 : 0.06)
    // a de trás (ao longo das colunas)
    p.fillPoly([
      project(-0.35, 0, z, origin), project(largura, 0, z, origin),
      project(largura, 0, z - 0.06, origin), project(-0.35, 0, z - 0.06, origin),
    ], claro)
    // a da esquerda (ao longo das linhas)
    p.fillPoly([
      project(0, -0.35, z, origin), project(0, altura, z, origin),
      project(0, altura, z - 0.06, origin), project(0, -0.35, z - 0.06, origin),
    ], claro)
  }

  // ------------------------------------------------------------ a janela
  // Na parede do fundo, acima das despensas. Ela é o único ponto de fuga da
  // cena — sem ela a parede alta não tem pra onde olhar.
  const jc = Math.max(1.2, largura - 3.2)
  const moldura = (c0, c1, z0, z1, cor) => p.fillPoly([
    project(c0, 0, z1, origin), project(c1, 0, z1, origin),
    project(c1, 0, z0, origin), project(c0, 0, z0, origin),
  ], cor)
  moldura(jc - 0.12, jc + 2.12, 1.62, 2.82, '#8d7a6b')          // caixilho
  moldura(jc, jc + 2, 1.72, 2.72, '#a8dcef')                     // o céu
  moldura(jc, jc + 2, 1.72, 2.02, '#7fc46a')                     // o campo lá fora
  moldura(jc + 0.35, jc + 0.75, 2.08, 2.34, '#fdfbf4')           // uma nuvem
  moldura(jc + 1.15, jc + 1.45, 2.22, 2.45, '#fdfbf4')
  moldura(jc + 0.94, jc + 1.06, 1.72, 2.72, '#8d7a6b')           // o caixilho do meio

  // -------------------------------------------------------- a prateleira
  // Na parede da esquerda, com potes de cores diferentes. Dá vida ao lado que
  // não tem janela, e reforça que aquilo ali é uma cozinha.
  const prat = (r0, r1, z, cor) => p.fillPoly([
    project(0, r0, z, origin), project(0, r1, z, origin),
    project(0, r1, z - 0.09, origin), project(0, r0, z - 0.09, origin),
  ], cor)
  prat(0.3, altura - 0.3, 2.12, '#b98a5e')
  const potes = ['#e0553f', '#7cc45f', '#e8c86a', '#d78ab0']
  potes.forEach((cor, i) => {
    const r0 = 0.45 + i * 0.72
    if (r0 + 0.5 > altura - 0.3) return
    prat(r0, r0 + 0.5, 2.55, cor)
  })
}

/**
 * ============================================================== A SILHUETA
 *
 * A primeira versão destas estações era a MESMA CAIXA em cores diferentes, e o
 * dono não conseguiu jogar: *"visualmente os negócios são tudo iguais, só muda a
 * cor; é extremamente difícil identificar onde fazer o quê."* Ele está certo, e
 * o erro tem nome.
 *
 * Cor é o pior canal pra distinguir peça num jogo de correria:
 *
 *  - ela **não sobrevive ao tamanho.** No celular a cozinha inteira sai a 0,586
 *    de escala; uma estação tem ~56 px de tela. Nesse tamanho o olho lê CONTORNO
 *    primeiro, e cor depois — se é que chega a olhar a cor;
 *  - ela **não sobrevive à pressa.** Numa rodada de 3 minutos ninguém para pra
 *    comparar dois tons de creme;
 *  - e ela **não sobrevive à pessoa.** Quem confunde verde e vermelho fica sem
 *    nenhuma informação, e cerca de um homem em cada doze confunde.
 *
 * Então agora cada estação se distingue por **três coisas ao mesmo tempo**, e
 * qualquer uma delas sozinha já resolve:
 *
 *   1. **ALTURA.** Elas iam todas de 0,56 a 0,66. Agora vão de 0,42 (a bancada,
 *      deliberadamente a mais baixa e vazia) a 1,3 (a despensa, um armário
 *      alto). Isso muda a silhueta antes de qualquer detalhe.
 *   2. **FORMA.** Redondo contra quadrado: o lixo e a panela são cilindros; a
 *      pia tem uma torneira em arco; a entrega é um vão aberto, não um bloco.
 *   3. **COR**, que continua existindo, mas como terceiro reforço e não como
 *      única pista.
 *
 * E acima disso a tela escreve o NOME de cada uma (ver `GameCozinha.jsx`),
 * porque nenhum desenho é auto-explicativo na primeira partida.
 */

/** Um cilindro isométrico. É o que separa "redondo" de "quadrado" na silhueta. */
function isoCilindro(p, base, { col, row, r, z, h }, origin, lados = 12) {
  const anel = (altura) => {
    const pontos = []
    for (let i = 0; i < lados; i++) {
      const a = (i / lados) * Math.PI * 2
      pontos.push(project(col + 0.5 + Math.cos(a) * r, row + 0.5 + Math.sin(a) * r, altura, origin))
    }
    return pontos
  }
  const baixo = anel(z)
  const cima = anel(z + h)
  // A parede: cada fatia entre o anel de baixo e o de cima. Desenhar da mais
  // funda pra mais próxima mantém a ordem certa sem teste de visibilidade.
  const ordem = [...Array(lados).keys()].sort((a, b) => cima[a][1] - cima[b][1])
  for (const i of ordem) {
    const j = (i + 1) % lados
    const meio = (Math.cos((i / lados) * Math.PI * 2) - Math.sin((i / lados) * Math.PI * 2)) / 2
    p.fillPoly([cima[i], cima[j], baixo[j], baixo[i]], shade(base, -0.34 + meio * 0.2))
  }
  p.fillPoly(cima, shade(base, FACE_TOP))
  p.strokePoly(cima, OUTLINE)
  return cima
}

/**
 * O móvel de cada estação, sem nada em cima. Isto é o que não se mexe, e por
 * isso é desenhado uma vez só e colado (ver `fundoDaCozinha`).
 */
function corpoDaEstacao(p, e, origin) {
  const { col, row } = e
  groundShadow(p, { col, row, w: 1, d: 1 }, origin)
  const balcao = (h, cor = COR.bancada) =>
    isoBox(p, faces(cor), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0, h }, origin, OUTLINE)

  // ------------------------------------------------------------- DESPENSA
  // Armário ALTO com porta e puxador, e a comida à mostra numa prateleira.
  // É a mais alta da cozinha (1,3) — a fileira do fundo vira uma parede de
  // armários, que é o que uma despensa parece.
  if (e.tipo === 'd') {
    const madeira = COR.madeira
    isoBox(p, faces(madeira), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0, h: 1.3 }, origin, OUTLINE)
    // a porta, um pouco pra fora, com puxador
    isoBox(p, faces(shade(madeira, -0.12)), { col: col + 0.1, row: row + 0.9, w: 0.8, d: 0.06, z: 0.1, h: 0.7 }, origin, OUTLINE)
    isoBox(p, faces('#f0d9a8'), { col: col + 0.66, row: row + 0.94, w: 0.08, d: 0.06, z: 0.42, h: 0.08 }, origin, OUTLINE)
    // a prateleira de cima, aberta, com o ingrediente dentro
    isoBox(p, faces(shade(madeira, -0.3)), { col: col + 0.12, row: row + 0.12, w: 0.76, d: 0.76, z: 1.3, h: 0.04 }, origin, OUTLINE)
    desenharComida(p, e.ing, 'cru', col, row, 1.34, origin, e.cor)
    return
  }

  // ---------------------------------------------------------------- TÁBUA
  // Balcão BAIXO com a tábua grossa em cima e a faca ESPETADA, de pé. A faca em
  // pé é o detalhe que se vê de longe: é a única coisa vertical e fina da cozinha.
  if (e.tipo === 'tabua') {
    balcao(0.5, '#e3d3b6')
    isoBox(p, faces('#c98f4e'), { col: col + 0.12, row: row + 0.16, w: 0.76, d: 0.68, z: 0.5, h: 0.1 }, origin, OUTLINE)
    isoBox(p, faces('#dba766'), { col: col + 0.16, row: row + 0.2, w: 0.68, d: 0.6, z: 0.6, h: 0.02 }, origin, OUTLINE)
    // lâmina + cabo, espetados na ponta da tábua
    isoBox(p, faces('#dfe6ec'), { col: col + 0.72, row: row + 0.3, w: 0.05, d: 0.18, z: 0.62, h: 0.42 }, origin, OUTLINE)
    isoBox(p, faces('#5b4636'), { col: col + 0.71, row: row + 0.28, w: 0.07, d: 0.22, z: 1.04, h: 0.16 }, origin, OUTLINE)
    return
  }

  // ---------------------------------------------------------------- FOGÃO
  // Corpo escuro, BOCA REDONDA acesa e a panela como cilindro com duas alças.
  // Redondo sobre quadrado: é o par mais fácil de separar de longe.
  if (e.tipo === 'panela') {
    isoBox(p, faces('#59626d'), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0, h: 0.52 }, origin, OUTLINE)
    // painel com dois botões, na frente
    isoBox(p, faces('#3d444c'), { col: col + 0.14, row: row + 0.9, w: 0.72, d: 0.06, z: 0.3, h: 0.14 }, origin, OUTLINE)
    isoBox(p, faces('#e8564a'), { col: col + 0.26, row: row + 0.94, w: 0.08, d: 0.05, z: 0.34, h: 0.07 }, origin, OUTLINE)
    isoBox(p, faces('#f0d9a8'), { col: col + 0.42, row: row + 0.94, w: 0.08, d: 0.05, z: 0.34, h: 0.07 }, origin, OUTLINE)
    // a chama: um anel redondo escuro com miolo laranja
    isoCilindro(p, '#2e343a', { col, row, r: 0.3, z: 0.52, h: 0.04 }, origin)
    isoCilindro(p, COR.fogo, { col, row, r: 0.19, z: 0.55, h: 0.02 }, origin)
    return
  }

  // -------------------------------------------------------------- BANCADA
  // A MAIS BAIXA e a mais vazia da cozinha, de propósito. Ela não faz nada: é só
  // um lugar de largar coisa. Sendo a mais rasa, o que estiver em cima dela fica
  // sendo a coisa mais visível — que é exatamente o papel dela no jogo a dois.
  if (e.tipo === 'bancada') {
    balcao(0.42, '#efe6d2')
    // uma borda mais clara em volta, pra ela ler como "superfície livre"
    isoBox(p, faces('#fbf6e9'), { col: col + 0.02, row: row + 0.02, w: 0.96, d: 0.96, z: 0.42, h: 0.05 }, origin, OUTLINE)
    return
  }

  // --------------------------------------------------------------- PRATOS
  // Estante aberta, com as prateleiras à vista. Só ela tem vãos horizontais.
  if (e.tipo === 'pratos') {
    isoBox(p, faces('#b98a5e'), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0, h: 0.16 }, origin, OUTLINE)
    for (const [zi, lado] of [[0.16, 0.1], [0.5, 0.1]]) {
      isoBox(p, faces('#a97a4e'), { col: col + 0.08, row: row + 0.08, w: lado, d: 0.84, z: zi, h: 0.34 }, origin, OUTLINE)
      isoBox(p, faces('#a97a4e'), { col: col + 0.82, row: row + 0.08, w: lado, d: 0.84, z: zi, h: 0.34 }, origin, OUTLINE)
    }
    isoBox(p, faces('#c99a6e'), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0.5, h: 0.06 }, origin, OUTLINE)
    isoBox(p, faces('#c99a6e'), { col: col + 0.06, row: row + 0.06, w: 0.88, d: 0.88, z: 0.84, h: 0.06 }, origin, OUTLINE)
    return
  }

  // ------------------------------------------------------------------ PIA
  // Cuba AFUNDADA (um buraco, e não um bloco) e torneira em ARCO. O arco é a
  // única curva fina da cozinha; ele se reconhece antes de qualquer cor.
  if (e.tipo === 'pia') {
    balcao(0.56, '#dfe4e8')
    isoBox(p, faces('#8c98a3'), { col: col + 0.14, row: row + 0.14, w: 0.72, d: 0.72, z: 0.4, h: 0.16 }, origin, OUTLINE)
    isoBox(p, faces('#6d7783'), { col: col + 0.2, row: row + 0.2, w: 0.6, d: 0.6, z: 0.4, h: 0.04 }, origin, OUTLINE)
    // o arco da torneira, montado em três pedaços
    isoBox(p, faces(COR.metal), { col: col + 0.14, row: row + 0.12, w: 0.09, d: 0.09, z: 0.56, h: 0.42 }, origin, OUTLINE)
    isoBox(p, faces(COR.metal), { col: col + 0.14, row: row + 0.12, w: 0.42, d: 0.09, z: 0.94, h: 0.08 }, origin, OUTLINE)
    isoBox(p, faces(COR.metal), { col: col + 0.48, row: row + 0.12, w: 0.09, d: 0.09, z: 0.84, h: 0.12 }, origin, OUTLINE)
    return
  }

  // ----------------------------------------------------------------- LIXO
  // CILINDRO estreito e alto, com tampa que sobra pra fora e pedal. É o único
  // objeto solto no chão — não é balcão, não encosta em nada.
  if (e.tipo === 'lixo') {
    isoCilindro(p, '#6f7d5e', { col, row, r: 0.3, z: 0, h: 0.86 }, origin)
    isoCilindro(p, '#5b684d', { col, row, r: 0.35, z: 0.86, h: 0.08 }, origin)
    isoBox(p, faces('#4b5540'), { col: col + 0.36, row: row + 0.02, w: 0.28, d: 0.1, z: 0.06, h: 0.06 }, origin, OUTLINE)
    return
  }

  // -------------------------------------------------------------- ENTREGA
  // Um VÃO, e não um bloco: dois montantes e um travessão em cima, com o balcão
  // baixo no meio. É a única estação com um buraco no meio, e é por isso que ela
  // se acha na hora — que importa, porque é aonde a corrida termina.
  if (e.tipo === 'entrega') {
    balcao(0.44, '#e8b7c6')
    isoBox(p, faces('#f7f1e4'), { col: col + 0.02, row: row + 0.02, w: 0.96, d: 0.96, z: 0.44, h: 0.05 }, origin, OUTLINE)
    isoBox(p, faces('#d1758f'), { col: col + 0.04, row: row + 0.04, w: 0.12, d: 0.12, z: 0.49, h: 0.62 }, origin, OUTLINE)
    isoBox(p, faces('#d1758f'), { col: col + 0.84, row: row + 0.04, w: 0.12, d: 0.12, z: 0.49, h: 0.62 }, origin, OUTLINE)
    isoBox(p, faces('#d1758f'), { col: col + 0.04, row: row + 0.04, w: 0.92, d: 0.12, z: 1.11, h: 0.12 }, origin, OUTLINE)
    // a sineta do balcão, redonda e dourada
    isoCilindro(p, '#f0c14b', { col: col + 0.16, row: row + 0.2, r: 0.16, z: 0.49, h: 0.16 }, origin)
    return
  }

  balcao(0.6)
}

/**
 * A comida desenhada com a FORMA dela, e não como um cubo colorido.
 *
 * Mesmo motivo da silhueta das estações: cinco cubos em cinco cores são cinco
 * cubos. Aqui cada ingrediente tem contorno próprio, então dá pra saber o que
 * está na tábua sem comparar tons.
 */
function desenharComida(p, ing, estado, col, row, z, origin, cor) {
  const base = estado === QUEIMADO ? COR.queimado : (cor || '#999')
  const F = faces(base)
  if (ing === 'alface') {
    // um pé redondo e folhudo: cilindro largo e baixo + folhas por cima
    isoCilindro(p, base, { col, row, r: 0.26, z, h: 0.16 }, origin)
    isoCilindro(p, shade(base, 0.16), { col: col + 0.06, row, r: 0.16, z: z + 0.16, h: 0.08 }, origin)
    return
  }
  if (ing === 'tomate') {
    isoCilindro(p, base, { col, row, r: 0.22, z, h: 0.2 }, origin)
    // o cabinho verde, que é o que faz ler "tomate" e não "bola vermelha"
    isoBox(p, faces('#5d9b48'), { col: col + 0.44, row: row + 0.44, w: 0.12, d: 0.12, z: z + 0.2, h: 0.07 }, origin, OUTLINE)
    return
  }
  if (ing === 'carne') {
    // bife: baixo, largo e com gordura clara na borda
    isoBox(p, F, { col: col + 0.2, row: row + 0.26, w: 0.6, d: 0.48, z, h: 0.1 }, origin, OUTLINE)
    isoBox(p, faces('#e8cdbb'), { col: col + 0.2, row: row + 0.26, w: 0.6, d: 0.08, z: z + 0.02, h: 0.07 }, origin, OUTLINE)
    return
  }
  if (ing === 'massa') {
    // três fios longos, cruzados
    isoBox(p, F, { col: col + 0.16, row: row + 0.3, w: 0.68, d: 0.08, z, h: 0.07 }, origin, OUTLINE)
    isoBox(p, F, { col: col + 0.16, row: row + 0.46, w: 0.68, d: 0.08, z, h: 0.07 }, origin, OUTLINE)
    isoBox(p, faces(shade(base, -0.12)), { col: col + 0.42, row: row + 0.2, w: 0.08, d: 0.56, z, h: 0.07 }, origin, OUTLINE)
    return
  }
  if (ing === 'pao') {
    // pãozinho: comprido, arredondado e com um corte claro em cima
    isoCilindro(p, base, { col: col + 0.02, row, r: 0.24, z, h: 0.18 }, origin, 10)
    isoBox(p, faces(shade(base, 0.22)), { col: col + 0.34, row: row + 0.3, w: 0.3, d: 0.08, z: z + 0.18, h: 0.03 }, origin, OUTLINE)
    return
  }
  isoBox(p, F, { col: col + 0.26, row: row + 0.26, w: 0.48, d: 0.48, z, h: 0.2 }, origin, OUTLINE)
}


// =========================================================== o que se mexe
//
// Daqui pra baixo tudo recebe `agora` e desenha O INSTANTE. Nenhuma decisao: so
// conta de tres.

/**
 * O que está visível AGORA, quando o estado carrega um "antes" com hora.
 *
 * A ação é resolvida no instante do toque, mas só acontece de verdade quando o
 * cozinheiro chega. O servidor manda os dois lados e a hora da virada; aqui só
 * se escolhe qual desenhar. Continua sendo interpolação: nada é decidido, só
 * comparado com o relógio.
 *
 * Sem isto, o item aparecia na mão de quem ainda estava indo buscá-lo, sumia da
 * tábua antes de alguém chegar nela, e pousava no balcão adiantado.
 */
function visivel(dono, campo, agora) {
  const quando = dono?.[`${campo}_ms`]
  return quando != null && agora < quando ? dono[`${campo}_antes`] : dono?.[campo]
}

/**
 * Onde a comida POUSA em cada estação.
 *
 * Cada número aqui corresponde ao topo desenhado em `corpoDaEstacao`, e os dois
 * têm que andar juntos: um tampo errado deixa a comida flutuando no ar ou
 * enterrada dentro do móvel. Foi por isso que estes valores mudaram todos quando
 * as estações ganharam alturas próprias.
 */
function tampo(tipo) {
  return {
    d: 1.34,        // a prateleira aberta, no alto do armário
    tabua: 0.62,    // a superfície da tábua
    panela: 0.57,   // a boca do fogão
    bancada: 0.47,  // a mais baixa da cozinha, de propósito
    pratos: 0.9,    // a prateleira de cima da estante
    pia: 0.44,      // o fundo da cuba, que é afundada
    lixo: 0.94,     // a tampa
    entrega: 0.49,  // o balcão, dentro do vão
  }[tipo] ?? 0.6
}

/**
 * A altura que o DEDO mira, que não é a mesma em que a comida pousa.
 *
 * O armário da despensa tem 1,3 de altura: mirar no topo dele faria o alvo do
 * toque ficar bem acima do móvel, sobre o vizinho de trás. O dedo mira o meio da
 * massa visível, que é onde a pessoa naturalmente aponta.
 */
function alvoDoToque(tipo) {
  return {
    d: 0.7, tabua: 0.5, panela: 0.4, bancada: 0.4,
    pratos: 0.55, pia: 0.5, lixo: 0.5, entrega: 0.5,
  }[tipo] ?? 0.5
}

/** Um ingrediente ou um prato, do jeito que ele aparece em cima de uma estação. */
function desenharItem(p, item, col, row, z, origin, cores) {
  if (!item) return
  if (item.ing === 'prato') {
    const cor = item.estado === 'limpo' ? COR.prato : COR.sujo
    // Prato é REDONDO. Era um quadrado, e ficava igual a qualquer outra coisa.
    isoCilindro(p, cor, { col, row, r: 0.3, z, h: 0.05 }, origin, 14)
    isoCilindro(p, shade(cor, -0.1), { col, row, r: 0.2, z: z + 0.05, h: 0.01 }, origin, 14)
    // O que está montado aparece EMPILHADO no prato, cada um com a forma dele.
    // É a única forma de saber o que tem no prato sem tocar — e num jogo de
    // correria ninguém vai tocar pra ver.
    let altura = z + 0.06
    for (const dentro of item.montado || []) {
      desenharComida(p, dentro.ing, dentro.estado, col, row, altura, origin, cores[dentro.ing]?.cor)
      altura += 0.11
    }
    return
  }
  if (item.estado === 'picado') {
    // Picado = pedacinhos separados, sempre, seja qual for o ingrediente. É a
    // forma dizendo "isto já passou pela faca", e ela lê antes da cor.
    const base = cores[item.ing]?.cor || '#999'
    for (const [dx, dy] of [[0.2, 0.24], [0.46, 0.3], [0.3, 0.52], [0.54, 0.54]]) {
      isoBox(p, faces(base), { col: col + dx, row: row + dy, w: 0.17, d: 0.17, z, h: 0.08 }, origin, OUTLINE)
    }
    return
  }
  desenharComida(p, item.ing, item.estado, col, row, z, origin, cores[item.ing]?.cor)
  if (item.estado === 'cozido') {
    // Cozido ganha um brilho quente por cima: é o "está pronto" visto de longe.
    isoBox(p, faces('#ffd9a0'), { col: col + 0.34, row: row + 0.3, w: 0.18, d: 0.1, z: z + 0.16, h: 0.02 }, origin, null)
  }
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
function desenharCozinheiro(p, c, lado, origin, agora, t, cores, ehMeu, desvio = 0) {
  const pos = ondeEsta(c, agora)
  const cor = CORES_COZINHEIRO[lado] || CORES_COZINHEIRO.p1
  // Os cozinheiros deixaram de se bloquear (uma estação de acesso único ficava
  // TRANCADA enquanto o outro estivesse parado ali). O preço é que agora eles
  // podem cair na mesma célula — e aí cada um é deslocado meio corpo pro lado,
  // pra não ficar um desenhado dentro do outro.
  const col = pos.col + desvio
  const row = pos.row - desvio
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
  const naMao = visivel(c, 'mao', agora)
  if (naMao) desenharItem(p, naMao, col, row - 0.36, 0.66, origin, cores)

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

  // Quem está pisando na mesma casa que outro é afastado meio corpo. A conta é
  // feita aqui (e não no desenho) porque ela precisa ver os DOIS.
  const ondeEstao = new Map()
  for (const item of fila) {
    if (!item._chef) continue
    const casa = `${Math.round(item.col)},${Math.round(item.row)}`
    ondeEstao.set(casa, (ondeEstao.get(casa) || 0) + 1)
  }
  let jaDesviado = new Set()

  for (const coisa of depthSort(fila)) {
    if (coisa._chef) {
      const casa = `${Math.round(coisa.col)},${Math.round(coisa.row)}`
      let desvio = 0
      if ((ondeEstao.get(casa) || 0) > 1) {
        desvio = jaDesviado.has(casa) ? 0.19 : -0.19
        jaDesviado.add(casa)
      }
      desenharCozinheiro(p, coisa.c, coisa.lado, origin, agora, t, cores,
                         coisa.lado === vista.meu_lado, desvio)
      continue
    }
    // o corpo já veio no fundo; aqui só o que está EM CIMA dele
    if (coisa.tipo === 'pratos') {
      for (let i = 0; i < (vista.pratos_limpos || 0); i++) {
        isoCilindro(p, COR.prato, {
          col: coisa.col, row: coisa.row, r: 0.28, z: tampo('pratos') + i * 0.07, h: 0.06,
        }, origin, 14)
      }
      continue
    }
    if (coisa.tipo === 'pia') {
      for (let i = 0; i < (coisa.sujos || 0); i++) {
        isoCilindro(p, COR.sujo, {
          col: coisa.col, row: coisa.row, r: 0.26, z: tampo('pia') + i * 0.07, h: 0.06,
        }, origin, 14)
      }
      barra(p, coisa, origin, agora, vista.tempos)
      continue
    }
    const emCima = visivel(coisa, 'item', agora)
    if (coisa.tipo === 'panela' && emCima) {
      // A PANELA em volta da comida: cilindro com duas alças. Só aparece quando
      // há algo cozinhando, então "fogão vazio" e "fogão ocupado" se distinguem
      // pela silhueta, e não por um detalhe pequeno em cima.
      isoCilindro(p, '#8b949d', { col: coisa.col, row: coisa.row, r: 0.31, z: 0.57, h: 0.16 }, origin)
      isoBox(p, faces('#6b737b'), { col: coisa.col - 0.04, row: coisa.row + 0.42, w: 0.14, d: 0.16, z: 0.65, h: 0.05 }, origin, OUTLINE)
      isoBox(p, faces('#6b737b'), { col: coisa.col + 0.9, row: coisa.row + 0.42, w: 0.14, d: 0.16, z: 0.65, h: 0.05 }, origin, OUTLINE)
    }
    desenharItem(p, emCima, coisa.col, coisa.row, tampo(coisa.tipo), origin, cores)
    barra(p, coisa, origin, agora, vista.tempos)
    if (emCima?.estado === 'queimado') fumaca(p, coisa, origin, t)
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
    const [ex, ey] = project(e.col + 0.5, e.row + 0.5, alvoDoToque(e.tipo), origin)
    const dist = Math.hypot(x - ex, y - ey)
    if (dist < menor) {
      menor = dist
      melhor = e
    }
  }
  // Um raio de meia célula: fora disso o toque foi no chão, e chão não é alvo.
  return menor <= TW * 0.42 ? melhor : null
}

/**
 * Onde pendurar o rótulo de cada estação, em pixel de arte.
 *
 * A tela desenha os NOMES em HTML por cima do canvas, e não aqui dentro. Duas
 * razões, e a segunda é a que decide:
 *
 *  - texto em canvas de pixel art ou sai borrado (fonte suavizada sobre arte de
 *    borda dura) ou exige desenhar uma fonte letra a letra;
 *  - em HTML ele é **texto de verdade**: cresce com o ajuste de tamanho de fonte
 *    do sistema, e o leitor de tela enxerga.
 *
 * O `z` de cada tipo é a altura do móvel, pra a etiqueta pousar logo acima dele
 * em vez de flutuar solta ou entrar dentro da estação.
 */
export function pontosDosRotulos(vista, nomes, escala = 1) {
  const { origin } = medidas(vista.largura, vista.altura)
  const topo = {
    d: 1.5, tabua: 1.2, panela: 0.95, bancada: 0.55,
    pratos: 1.05, pia: 1.1, lixo: 1.0, entrega: 1.28,
  }

  // UM rotulo por TIPO, e nao um por estacao.
  //
  // Com um em cada, os quinze se atropelavam: as duas bancadas ficam em celulas
  // vizinhas, e em isometrico isso da 24 px de arte entre elas — menos que a
  // altura da propria etiqueta. O meio da cozinha virava uma pilha de palavras
  // ilegivel, o que e o oposto do que os nomes vieram resolver.
  //
  // E nao faz falta: as duas tabuas SAO a mesma coisa e sao desenhadas iguais.
  // Nomear uma ja diz o que a outra e. A despensa e a excecao — cada uma guarda
  // um ingrediente diferente, entao todas as cinco levam nome.
  //
  // Quando ha mais de uma do tipo, a escolhida e a da FRENTE (maior col+row):
  // e a menos coberta por outros moveis, e a que o olho acha primeiro.
  const porGrupo = new Map()
  for (const e of vista.estacoes) {
    const grupo = e.tipo === 'd' ? `d:${e.ing}` : e.tipo
    const atual = porGrupo.get(grupo)
    if (!atual || e.col + e.row > atual.col + atual.row) porGrupo.set(grupo, e)
  }

  const itens = [...porGrupo.values()].map((e) => {
    const [x, y] = project(e.col + 0.5, e.row + 0.5, topo[e.tipo] ?? 0.9, origin)
    const texto = e.tipo === 'd'
      ? (vista.ingredientes?.[e.ing]?.nome || e.ing)
      : (nomes?.[e.tipo] || e.tipo)
    return { id: e.id, tipo: e.tipo, ing: e.ing, texto, x, y }
  })

  // ------------------------------------------------- e agora tira o encavalamento
  //
  // Mesmo com um por tipo eles ainda se sobrepunham: as cinco despensas ficam
  // numa fileira, e em isometrico uma fileira vira uma DIAGONAL — cada vizinha
  // sai 28 px de tela pro lado, e a palavra "alface" tem 40. Medido: 7 pares
  // sobrepostos.
  //
  // Entao os rotulos sao empurrados PRA CIMA, um degrau por vez, ate pararem de
  // se tocar. Sempre pra cima porque abaixo deles esta o movel que eles nomeiam;
  // empurrar pro lado apontaria pro vizinho errado, que e pior do que sobrepor.
  //
  // A conta e em pixel de ARTE, e por isso a escala entra: a etiqueta tem tamanho
  // fixo em pixel de TELA (é texto de verdade, não desenho), então quanto menor a
  // escala, MAIOR ela é em relação à cena — e é justamente no celular, onde a
  // escala é ~0,59, que o problema aparece.
  const alturaTela = 16
  const alt = alturaTela / escala
  const larg = (t) => (t.length * 5.4 + 14) / escala
  const degrau = alt * 0.9

  // De cima pra baixo: quem está mais ao fundo assenta primeiro, e quem vem à
  // frente sobe se precisar. Assim os que sobem são os da frente, que têm céu
  // livre acima.
  itens.sort((a, b) => a.y - b.y)
  const postos = []
  for (const item of itens) {
    const meia = larg(item.texto) / 2
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const bate = postos.some((o) => (
        Math.abs(o.x - item.x) < meia + larg(o.texto) / 2
        && Math.abs(o.y - item.y) < alt
      ))
      if (!bate) break
      item.y -= degrau
    }
    postos.push(item)
  }
  return itens
}

/** O centro de uma estação na tela — pra o realce da dica pousar em cima dela. */
export function pontoDaEstacao(vista, id) {
  const { origin } = medidas(vista.largura, vista.altura)
  const e = vista.estacoes.find((x) => x.id === id)
  if (!e) return null
  const [x, y] = project(e.col + 0.5, e.row + 0.5, alvoDoToque(e.tipo), origin)
  return { x, y }
}

export { TW, TH, TZ }
