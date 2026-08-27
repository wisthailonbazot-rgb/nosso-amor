// A arte da batalha naval: o mar e os navios.
//
// ------------------------------------------------- por que isto é código
//
// O dono pediu "use a IA pras imagens", e a IA está usada — na tela de fim de
// partida, que é ilustração pura. O mar e os navios ficaram de fora, e a régua
// que decide isso não é minha: é a que este projeto já usa há tempo.
//
// As 14 cartas da memória são as únicas imagens de arquivo do app, e o HANDOFF
// explica o motivo delas serem: "aqui a carta É a arte, não tem estado, pose
// nem cor variável". O navio cai do outro lado dessa mesma frase — ele tem
// TAMANHO (2, 3 ou 4 casas), ORIENTAÇÃO (deitado ou em pé) e ESTADO (inteiro,
// atingido, afundado), e precisa cair alinhado ao pixel em cima de uma grade
// que muda de tamanho conforme a tela. Imagem gerada não entrega nenhuma
// dessas quatro coisas de forma confiável.
//
// Tentei mesmo assim, com três sementes por assunto, como manda o precedente
// das cartas: o modelo gratuito devolveu navio de guerra cinza EM PERSPECTIVA
// nas seis tentativas, nunca visto de cima. Um navio em perspectiva não tem
// como encaixar numa grade vista de cima — e um que não encaixa transforma o
// tabuleiro num quebra-cabeça de adivinhar qual casa é qual.
//
// Aqui é o mesmo motor de pixel que já desenha os 30 móveis, as 48 peças de
// avatar e as 24 figurinhas. Sai no estilo do resto do app, encaixa na casa por
// construção, e navio novo é uma linha na tabela.
//
// ------------------------------------------------------------ como é usado
//
// Tudo vira `data:` URL uma vez só e entra pelo CSS (`background-image`). O
// canvas é redesenhado a cada tela senão: a grade é feita de `<button>`, que é
// o que faz o toque cair na casa certa e o leitor de tela saber ler — trocar
// isso por um canvas só pela arte custaria as duas coisas.

import { Painter } from './pixel'

// A paleta do mar, do fundo pro raso. Sai do mesmo lugar que a cena da ilha do
// bichinho, pra os dois lugares do app que têm água não serem águas diferentes.
const AGUA_FUNDA = '#3f7fa8'
const AGUA = '#5a9fc4'
const AGUA_CLARA = '#7cbcd9'
const ESPUMA = '#dff1f8'

// A frota é COLORIDA, e isso é uma decisão, não enfeite.
//
// A primeira versão saiu cinza-chumbo, e o resultado era o que o dono chamou de
// genérico: três tubos iguais com quadradinhos brancos em cima, que ele mesmo
// já tinha diagnosticado noutro lugar do app ("chapada, lia como etiqueta de
// papel colada" — a coleira do bichinho, HANDOFF 9.11). Este é um app de casal
// em papel recortado e tom pastel; navio de guerra militar não é só feio aqui,
// é de outro jogo.
//
// Cada tamanho tem a SUA cor. Isso não é só estilo: no seu tabuleiro, cor
// diferente é o que deixa ver de relance qual navio já foi atingido e qual não,
// sem contar casinha por casinha.
const CASCOS = {
  2: { corpo: '#e8879b', escuro: '#b95f72', cabine: '#fff3f5' },
  3: { corpo: '#6fae8f', escuro: '#4a8467', cabine: '#f2fbf5' },
  4: { corpo: '#e0a24a', escuro: '#a97430', cabine: '#fff6e8' },
}
const CONVES = '#d8cdbb'
const VIDRO = '#5f86a8'
const OUT = '#33203a'

/** Um canvas de rascunho já no tamanho pedido. */
function tela(w, h) {
  const canvas = document.createElement('canvas')
  const p = new Painter(canvas)
  p.resize(w, h)
  p.clear()
  return { canvas, p }
}

/**
 * O ladrilho do mar.
 *
 * Ele se REPETE, então tudo aqui tem que fechar nas bordas: uma onda que
 * termina no meio da direita reaparece cortada na esquerda e vira uma emenda
 * visível de canto a canto do tabuleiro. Por isso as ondas são desenhadas com
 * o comprimento dividindo o lado do ladrilho, e o que passa da borda é
 * repetido do outro lado, na mão.
 */
export function ladrilhoDoMar(lado = 48) {
  const { canvas, p } = tela(lado, lado)
  p.clear(AGUA)

  // ---------------------------------------------------- a água quase lisa
  //
  // A primeira versão tinha faixas de profundidade fortes em diagonal, e o
  // resultado, visto ladrilhado, não era água: era ZEBRA. Listra diagonal
  // repetida a cada 48px vira padrão de tecido, e ainda por cima competia com a
  // grade de casas por cima — que é a coisa que a pessoa PRECISA enxergar pra
  // saber onde está atirando.
  //
  // O fundo de um tabuleiro é fundo: ele tem que dar textura sem chamar
  // atenção. Aqui a variação ficou fraca de propósito (dois tons vizinhos, não
  // três contrastantes) e em manchas largas e arredondadas, que é como água
  // parada se comporta — em vez de riscos atravessando o quadro.
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      // Duas ondas de períodos diferentes que fecham no ladrilho (1 e 2 voltas
      // inteiras), somadas: o resultado não repete visivelmente dentro do
      // quadro, mas casa perfeitamente na borda.
      const a = Math.sin((x / lado) * Math.PI * 2)
      const b = Math.cos((y / lado) * Math.PI * 2)
      const c = Math.sin(((x + y) / lado) * Math.PI * 2)
      const v = a * 0.5 + b * 0.5 + c * 0.35
      // RETICULADO, e não mancha sólida.
      //
      // Com mancha sólida estas regiões viraram gotas ovais escuras espalhadas
      // pelo quadro — o ladrilho parecia pele de réptil, ou chuva batendo. O
      // reticulado (pinta um pixel sim, um não) dá a MESMA variação de tom sem
      // desenhar uma forma: de perto são pontinhos, de longe é só água um
      // tiquinho mais clara ali. É o mesmo recurso que a cena da ilha do
      // bichinho usa na emenda do céu, e pelo mesmo motivo.
      const trama = (x + y) % 2 === 0
      if (v > 0.55 && trama) p.px(x, y, AGUA_CLARA)
      else if (v < -0.62 && trama) p.px(x, y, AGUA_FUNDA)
    }
  }

  // ------------------------------------------------------ as ondinhas
  //
  // Poucas, pequenas e espalhadas. São elas que dizem "isto é mar" — mas mais
  // do que três por ladrilho e elas viram um padrão que se percebe repetindo,
  // que é o defeito que a versão anterior tinha.
  //
  // Cada uma é um traço em "v" deitado, com as pontas caídas: é o desenho de
  // onda que se reconhece mesmo com cinco pixels.
  const ondas = [
    { x: 6, y: 11 },
    { x: 30, y: 26 },
    { x: 16, y: 39 },
  ]
  for (const o of ondas) {
    for (let i = -4; i <= 4; i++) {
      const x = (o.x + i + lado) % lado
      // O meio sobe um pixel; as pontas descem. Sem isso é um risco reto, e
      // risco reto lê como linha de grade, não como onda.
      const sobe = Math.abs(i) <= 1 ? 1 : 0
      const y = (o.y - sobe + lado) % lado
      p.px(x, y, ESPUMA)
    }
    // a sombra logo abaixo dá relevo à crista
    for (let i = -2; i <= 2; i++) {
      p.px((o.x + i + lado) % lado, (o.y + 1) % lado, AGUA_CLARA)
    }
  }

  return canvas.toDataURL('image/png')
}

/**
 * Um navio visto de cima, deitado, ocupando `casas` casas.
 *
 * A proa fica na esquerda. A imagem sai com a proporção exata de `casas`x1, e é
 * esticada pela largura das casas que ele ocupa — então ele encaixa na grade
 * por construção, e não por ajuste fino de pixel que quebraria na próxima
 * mudança de tamanho de tela.
 */
export function navio(casas = 3, { unidade = 24 } = {}) {
  const { canvas, p } = tela(casas * unidade, unidade)
  desenharNavioEm(p, casas, unidade)
  return canvas.toDataURL('image/png')
}

/**
 * O desenho em si, num painter que já veio do tamanho certo.
 *
 * A leitura de "barco" vem de três coisas, nesta ordem de importância: a PROA
 * em bico (sem ela é uma pastilha), a CABINE quebrando a linha do casco (sem
 * ela é um tijolo) e a faixa de convés (que dá a terceira dimensão). Tudo é
 * medido em fração da unidade, então o mesmo código serve pros três tamanhos.
 */
function desenharNavioEm(p, casas, unidade) {
  const w = casas * unidade
  const h = unidade
  const cor = CASCOS[casas] || CASCOS[3]
  const meio = h / 2
  // O casco não encosta na borda da casa: a folga é o que deixa o mar aparecer
  // em volta e impede que dois navios vizinhos pareçam um só.
  const folga = h * 0.16
  const topo = meio - (h / 2 - folga)
  const base = meio + (h / 2 - folga)
  // A proa é um bico CURTO e cortado na ponta. Puxada demais (a primeira
  // versão ia até quase a borda, com o ombro em 0,55 de altura) ela virava uma
  // seta — e uma fileira de setas apontando pro mesmo lado lê como sinalização,
  // não como frota. Aqui ela avança pouco e termina numa quina reta, que é o
  // que um barco tem de verdade.
  const proa = w - h * 0.22
  const popa = h * 0.14
  const bico = h * 0.3

  const contorno = [
    [popa, topo],
    [proa - bico, topo],
    [proa, meio - (meio - topo) * 0.34],
    [proa, meio + (base - meio) * 0.34],
    [proa - bico, base],
    [popa, base],
    [popa - h * 0.08, meio],
  ]

  p.fillPoly(contorno, cor.corpo)
  // A metade de baixo mais escura: é o que dá volume sem contorno interno.
  p.fillPoly(
    [
      [popa, meio + (base - meio) * 0.15],
      [w - h * 0.62, meio + (base - meio) * 0.15],
      [w - h * 0.55, base],
      [popa, base],
    ],
    cor.escuro
  )
  // A faixa de convés, clara, na parte de cima.
  p.fillPoly(
    [
      [popa + h * 0.12, topo + h * 0.1],
      [w - h * 0.72, topo + h * 0.1],
      [w - h * 0.62, meio - (meio - topo) * 0.1],
      [popa + h * 0.08, meio - (meio - topo) * 0.1],
    ],
    CONVES
  )

  // ------------------------------------------------------------- a cabine
  //
  // Ela é o que faz a silhueta ser lida como barco. Fica atrás do meio (mais
  // perto da popa), que é onde uma cabine fica de verdade — no meio exato ela
  // parece um botão no meio de uma pastilha.
  const cx = Math.round(w * 0.34)
  const cw = Math.round(unidade * 0.34)
  const ch = Math.round(h * 0.42)
  p.solid(cx, Math.round(meio - ch / 2), cw, ch, cor.cabine, OUT)
  // A janelinha: dois pixels de vidro escuro. É pouco, e é o que tira a cara de
  // etiqueta branca colada — a cabine passa a ter dentro.
  p.rect(cx + Math.max(1, Math.round(cw * 0.25)), Math.round(meio - ch * 0.18),
    Math.max(1, Math.round(cw * 0.5)), Math.max(1, Math.round(ch * 0.3)), VIDRO)

  // Os navios maiores ganham um mastro na frente da cabine — mais um ponto de
  // quebra na silhueta, e é o que diferencia o 3 do 4 de relance.
  // A chaminé, e não um mastro.
  //
  // O mastro era um risco preto de ponta a ponta do casco, e a leitura dele não
  // era "mastro": era um CORTE, como se o navio estivesse partido em dois
  // naquele ponto. Uma chaminé baixa e larga, com a boca escura em cima, quebra
  // a silhueta do mesmo jeito sem cortar nada.
  if (casas >= 3) {
    const chx = Math.round(w * 0.55)
    const chw = Math.max(2, Math.round(unidade * 0.16))
    const chh = Math.round(h * 0.3)
    p.solid(chx, Math.round(meio - chh * 0.72), chw, chh, cor.escuro, OUT)
    p.rect(chx, Math.round(meio - chh * 0.72), chw, 1, OUT)
  }
  if (casas >= 4) {
    p.solid(Math.round(w * 0.68), Math.round(meio - h * 0.16),
      Math.round(unidade * 0.16), Math.round(h * 0.32), cor.cabine, OUT)
  }

  // O contorno por fora vem por último, por cima de tudo: é ele que separa o
  // navio da água.
  p.strokePoly(contorno, OUT)
}

/**
 * O mesmo navio em pé.
 *
 * Girado no canvas, e não com `transform: rotate()` no CSS. A rotação por CSS
 * gira a caixa junto: um navio de 3x1 vira uma caixa de 1x3 girada, que não
 * ocupa as células que a grade reservou, e ainda passa por uma reamostragem
 * suavizada — que é exatamente a franjinha cinza que este motor existe pra
 * evitar. Girando aqui, o que sai é uma imagem 1x3 de verdade, com pixel
 * inteiro, e a grade encaixa ela sem saber que houve rotação.
 */
export function navioEmPe(casas = 3, opcoes = {}) {
  const unidade = opcoes.unidade || 24
  const w = unidade
  const h = casas * unidade
  const { canvas, p } = tela(w, h)
  // A fonte é o canvas do navio deitado, desenhado de novo aqui — reaproveitar
  // o `data:` URL exigiria esperar a imagem carregar, e este módulo precisa
  // devolver tudo pronto na hora em que a tela pergunta.
  const fonte = document.createElement('canvas')
  const pf = new Painter(fonte)
  pf.resize(casas * unidade, unidade)
  pf.clear()
  desenharNavioEm(pf, casas, unidade)
  const ctx = p.ctx
  ctx.save()
  // Proa pra cima: gira 90° no sentido horário.
  ctx.translate(w, 0)
  ctx.rotate(Math.PI / 2)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(fonte, 0, 0)
  ctx.restore()
  return canvas.toDataURL('image/png')
}

// Os três tamanhos da frota (4/3/3/2 — o 3 serve os dois navios médios), nas
// duas orientações, e o ladrilho: feitos UMA vez e guardados. Sem isto, cada
// re-render do React redesenharia sete canvas e recodificaria sete PNG.
let cache = null

export function arteDaNaval() {
  if (cache) return cache
  cache = {
    mar: ladrilhoDoMar(48),
    navios: {
      h: { 2: navio(2), 3: navio(3), 4: navio(4) },
      v: { 2: navioEmPe(2), 3: navioEmPe(3), 4: navioEmPe(4) },
    },
  }
  return cache
}
