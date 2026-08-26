// O lugar onde o bichinho mora — o cenário da tela dele.
//
// Antes isto era `background: linear-gradient(#dcead9 0 62%, #c99e70 62%)`: duas
// faixas de cor chapada, verde em cima e marrom embaixo. Funcionava como "não é
// branco", e só. O dono chamou de genérico, e é exatamente isso — não é um
// lugar, é um plano de fundo.
//
// A referência pedida foi o **Kinectimals**, e o que aquele jogo faz de certo
// não é a quantidade de detalhe: é o filhote estar num LUGAR (a ilha de
// Lemuria — praia, mata, montanha) e o lugar estar vivo enquanto ele não faz
// nada. Grama que balança, borboleta que passa, sol que reflete na água. É o
// cenário que faz o bicho parecer que está em algum canto do mundo em vez de
// posado num estúdio.
//
// Aqui a ilha é desenhada em pixel, na mesma linguagem do resto do app: céu em
// faixas com reticulado na emenda, montanha, mar com brilho que anda, praia,
// campo, moitas, flores, tufos de grama na frente, borboletas e pólen.
//
// ------------------------------------------------------------------ desempenho
//
// A cena inteira redesenhada a cada quadro sairia caro: são 384x324 pixels e o
// reticulado pinta um pixel por vez. Então o que NÃO se mexe (céu, sol,
// montanha, praia, campo) é pintado UMA vez num canvas de rascunho e colado a
// cada quadro; só nuvem, brilho da água, grama, borboleta e pólen são
// redesenhados. É a mesma precaução já anotada no HANDOFF para quando o mapa do
// bairro chegar — aqui ela já valeu, porque esta tela fica aberta parada,
// animando, enquanto a pessoa cuida do bicho.

import { mix, shade } from './pixel'

const TAU = Math.PI * 2

/**
 * A hora do dia muda a paleta inteira.
 *
 * Não é enfeite: é o que faz abrir o app de manhã e à noite serem duas coisas
 * diferentes, sem nenhum conteúdo novo. O bichinho de madrugada com vaga-lume
 * e estrela é a mesma cena de sempre com outra cor.
 */
export function periodoDe(hora) {
  if (hora < 5) return 'madrugada'
  if (hora < 9) return 'amanhecer'
  if (hora < 17) return 'dia'
  if (hora < 20) return 'entardecer'
  return 'noite'
}

const PALETAS = {
  madrugada: {
    ceu: ['#1b2447', '#2b3566', '#48507f'],
    astro: '#e8eaf6', halo: 'rgba(232,234,246,0.20)', astroY: 0.26, astroX: 0.74,
    montanhaLonge: '#2f3a63', montanhaPerto: '#26305a',
    mar: '#22305c', brilhoMar: '#4d5c8f',
    areia: '#6b6350', campo: '#2f4a3b', campoClaro: '#3a5a46',
    moita: '#25402f', flor: '#7f6fa8', estrelas: true, vagalume: true,
  },
  amanhecer: {
    ceu: ['#ffd9a8', '#ffc7b0', '#bfd8e8'],
    astro: '#fff0c2', halo: 'rgba(255,224,150,0.30)', astroY: 0.44, astroX: 0.20,
    montanhaLonge: '#9aa6c4', montanhaPerto: '#7d8bab',
    mar: '#7fa8c9', brilhoMar: '#ffd9a8',
    areia: '#e2cfa4', campo: '#7fae6a', campoClaro: '#9cc47f',
    moita: '#5f8a51', flor: '#ffd166', estrelas: false, vagalume: false,
  },
  dia: {
    ceu: ['#8fd0ef', '#a9dcf2', '#cfeaf6'],
    astro: '#fff6c8', halo: 'rgba(255,246,200,0.32)', astroY: 0.18, astroX: 0.78,
    montanhaLonge: '#9db8c9', montanhaPerto: '#7ea08f',
    mar: '#4fa3c9', brilhoMar: '#bfe6f5',
    areia: '#e8d5a6', campo: '#78b45f', campoClaro: '#96cd76',
    moita: '#4f8a45', flor: '#ff8fa8', estrelas: false, vagalume: false,
  },
  entardecer: {
    ceu: ['#ff9e6b', '#ffb98a', '#f3cfa8'],
    astro: '#ffe0a0', halo: 'rgba(255,180,110,0.34)', astroY: 0.52, astroX: 0.80,
    montanhaLonge: '#a0819a', montanhaPerto: '#7d6480',
    mar: '#c98a72', brilhoMar: '#ffd9a8',
    areia: '#d9b98c', campo: '#6d9a5c', campoClaro: '#8ab470',
    moita: '#4a7541', flor: '#ffc36b', estrelas: false, vagalume: true,
  },
  noite: {
    ceu: ['#232a52', '#333c72', '#57608f'],
    astro: '#f2f4ff', halo: 'rgba(242,244,255,0.22)', astroY: 0.22, astroX: 0.72,
    montanhaLonge: '#3a4570', montanhaPerto: '#2f3963',
    mar: '#2a3a68', brilhoMar: '#5b6da3',
    areia: '#7a715c', campo: '#3a5745', campoClaro: '#476852',
    moita: '#2b4a36', flor: '#9a8ad0', estrelas: true, vagalume: true,
  },
}

/** Ruído estável: o mesmo `i` devolve sempre o mesmo número entre 0 e 1. */
function aleatorio(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ------------------------------------------------------------------ fundo fixo
const cacheFundo = new Map()

/**
 * Céu, astro, montanha, mar, praia e campo — tudo o que não se mexe.
 *
 * Fica guardado por (largura, altura, período, linha do chão). Trocar de hora ou
 * girar o celular gera outro; no uso normal ele é pintado uma vez e colado.
 */
function fundoFixo(w, h, periodo, chao) {
  const chave = `${w}x${h}:${periodo}:${chao}`
  const guardado = cacheFundo.get(chave)
  if (guardado) return guardado

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  x.imageSmoothingEnabled = false
  const cor = PALETAS[periodo] || PALETAS.dia
  const e = Math.max(1, Math.round(h / 108))

  const horizonte = Math.round(chao - h * 0.20)
  const linhaMar = Math.round(chao - h * 0.12)

  // --- céu em três faixas, com reticulado nas emendas
  //
  // Degradê liso no meio de uma tela de pixel art entrega na hora que ali é
  // CSS, e não desenho. O reticulado (o mesmo truque dos 16 bits) mistura duas
  // cores chapadas sem inventar uma terceira.
  const faixas = [0, horizonte * 0.42, horizonte * 0.74, horizonte]
  for (let i = 0; i < 3; i++) {
    x.fillStyle = cor.ceu[i]
    x.fillRect(0, Math.round(faixas[i]), w, Math.ceil(faixas[i + 1] - faixas[i]) + 1)
  }
  for (let i = 1; i < 3; i++) {
    const y0 = Math.round(faixas[i]) - 3 * e
    x.fillStyle = cor.ceu[i]
    for (let yy = 0; yy < 3 * e; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if ((xx + yy) % 2 === 0) x.fillRect(xx, y0 + yy, 1, 1)
      }
    }
  }

  // --- estrelas (só de noite), com tamanhos diferentes
  if (cor.estrelas) {
    for (let i = 0; i < 46; i++) {
      const sx = Math.round(aleatorio(i) * w)
      const sy = Math.round(aleatorio(i + 90) * horizonte * 0.8)
      const g = aleatorio(i + 300) > 0.85 ? 2 * e : 1 * e
      x.fillStyle = i % 7 === 0 ? '#ffe9a8' : '#ffffff'
      x.globalAlpha = 0.45 + aleatorio(i + 500) * 0.55
      x.fillRect(sx, sy, g, g)
    }
    x.globalAlpha = 1
  }

  // --- sol ou lua, com halo
  const ax = Math.round(w * cor.astroX)
  const ay = Math.round(horizonte * cor.astroY)
  const raio = Math.round(9 * e)
  x.fillStyle = cor.halo
  for (let k = 3; k >= 1; k--) {
    x.beginPath()
    x.arc(ax, ay, raio + k * 5 * e, 0, TAU)
    x.fill()
  }
  x.fillStyle = cor.astro
  x.beginPath()
  x.arc(ax, ay, raio, 0, TAU)
  x.fill()
  if (periodo === 'noite' || periodo === 'madrugada') {
    // a lua vira crescente com uma mordida da cor do céu que está atrás dela
    x.fillStyle = cor.ceu[0]
    x.beginPath()
    x.arc(ax - raio * 0.5, ay - raio * 0.25, raio * 0.92, 0, TAU)
    x.fill()
  }

  // --- montanhas: duas cordilheiras, a de trás mais clara (perspectiva aérea)
  const serra = (base, altura, cores, semente, passo) => {
    x.fillStyle = cores
    x.beginPath()
    x.moveTo(0, base)
    for (let i = 0; i <= w + passo; i += passo) {
      const t = i / passo
      const alt = altura * (0.45 + aleatorio(t + semente) * 0.55)
      x.lineTo(i, base - alt)
      x.lineTo(i + passo / 2, base - alt * 0.35)
    }
    x.lineTo(w, base)
    x.closePath()
    x.fill()
  }
  serra(horizonte + 1, h * 0.20, cor.montanhaLonge, 11, Math.round(26 * e))
  serra(horizonte + 1, h * 0.13, cor.montanhaPerto, 41, Math.round(18 * e))

  // --- mar
  x.fillStyle = cor.mar
  x.fillRect(0, horizonte, w, linhaMar - horizonte)

  // --- praia e campo
  x.fillStyle = cor.areia
  x.fillRect(0, linhaMar, w, Math.round(chao - linhaMar))
  x.fillStyle = cor.campo
  x.fillRect(0, Math.round(chao - 3 * e), w, h - Math.round(chao - 3 * e))
  // a beirada clara do capim, onde a luz bate
  x.fillStyle = cor.campoClaro
  for (let i = 0; i < w; i += 1) {
    const alt = 2 * e + Math.round(aleatorio(i * 0.3) * 2 * e)
    x.fillRect(i, Math.round(chao - 3 * e), 1, alt)
  }

  // --- moitas no fundo, atrás de onde o bichinho anda
  for (let i = 0; i < 7; i++) {
    const mx = Math.round(aleatorio(i + 7) * w)
    const raioM = (5 + aleatorio(i + 21) * 5) * e
    x.fillStyle = cor.moita
    x.beginPath()
    x.arc(mx, chao - 2 * e, raioM, Math.PI, TAU)
    x.arc(mx + raioM * 0.7, chao - 2 * e, raioM * 0.75, Math.PI, TAU)
    x.fill()
  }

  cacheFundo.set(chave, c)
  // Não deixa o cache crescer sem limite: girar o celular e virar o dia geram
  // chaves novas, e um canvas de 384x324 guardado pra sempre é memória à toa.
  if (cacheFundo.size > 8) cacheFundo.delete(cacheFundo.keys().next().value)
  return c
}

// ------------------------------------------------------------------ a cena
/**
 * Pinta o cenário inteiro. Chamar ANTES do bichinho.
 *
 * `chao` é a linha em que ele pisa — a mesma `plano.chao`, senão ele aparece
 * flutuando acima da grama ou com as patas enterradas nela.
 */
export function desenharCena(p, { t = 0, chao, periodo = 'dia', triste = false } = {}) {
  const w = p.w
  const h = p.h
  const linhaChao = chao == null ? h * 0.85 : chao
  const cor = PALETAS[periodo] || PALETAS.dia
  const e = Math.max(1, Math.round(h / 108))
  const ctx = p.ctx

  ctx.drawImage(fundoFixo(w, h, periodo, Math.round(linhaChao)), 0, 0)

  const horizonte = Math.round(linhaChao - h * 0.20)
  const linhaMar = Math.round(linhaChao - h * 0.12)

  // --- brilho na água: riscos claros que andam devagar
  ctx.fillStyle = cor.brilhoMar
  for (let i = 0; i < 16; i++) {
    const base = aleatorio(i + 3)
    const y = horizonte + 2 * e + Math.round(base * (linhaMar - horizonte - 3 * e))
    const desloca = (t * 0.006 * (0.4 + base) + base * w) % (w + 40 * e)
    const larg = (4 + aleatorio(i + 60) * 9) * e
    ctx.globalAlpha = 0.35 + Math.sin(t * 0.002 + i) * 0.2
    ctx.fillRect(Math.round(desloca - 20 * e), y, Math.round(larg), Math.max(1, e))
  }
  ctx.globalAlpha = 1

  // --- nuvens, com paralaxe: a de trás anda mais devagar
  const nuvem = (nx, ny, escalaN, alfa) => {
    ctx.globalAlpha = alfa
    ctx.fillStyle = periodo === 'noite' || periodo === 'madrugada' ? '#8f97c4' : '#ffffff'
    const r = 5 * e * escalaN
    ctx.beginPath()
    ctx.arc(nx, ny, r, 0, TAU)
    ctx.arc(nx + r * 1.1, ny + r * 0.25, r * 0.8, 0, TAU)
    ctx.arc(nx - r * 1.1, ny + r * 0.3, r * 0.7, 0, TAU)
    ctx.arc(nx + r * 0.2, ny - r * 0.55, r * 0.62, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  for (let i = 0; i < 3; i++) {
    const vel = 0.004 + i * 0.003
    const nx = ((t * vel + i * w * 0.42) % (w + 60 * e)) - 30 * e
    nuvem(nx, horizonte * (0.24 + i * 0.16), 1 + i * 0.28, 0.55 + i * 0.12)
  }

  // --- tufos de grama na frente, balançando
  //
  // Eles ficam ABAIXO da linha do chão, no rodapé: é a moldura que dá
  // profundidade, porque o bichinho passa ATRÁS deles em vez de estar colado no
  // vidro. Sem essa camada a cena continua bonita e continua chata.
  const desenharTufo = (gx, altura, corG, fase, atras) => {
    ctx.fillStyle = corG
    for (let l = -2; l <= 2; l++) {
      const inclina = Math.sin(t * 0.0016 + fase + l * 0.5) * altura * 0.22
      const baseY = atras ? linhaChao - 1 * e : h - 1
      const topoY = baseY - altura * (0.7 + Math.abs(l) * -0.1 + 0.3)
      ctx.beginPath()
      ctx.moveTo(gx + l * 2 * e, baseY)
      ctx.quadraticCurveTo(
        gx + l * 2.4 * e + inclina * 0.5, (baseY + topoY) / 2,
        gx + l * 2.6 * e + inclina, topoY,
      )
      ctx.lineTo(gx + l * 2 * e + 1.6 * e, baseY)
      ctx.closePath()
      ctx.fill()
    }
  }
  // atrás do bichinho, curtinha
  for (let i = 0; i < 9; i++) {
    desenharTufo(aleatorio(i + 31) * w, (4 + aleatorio(i + 55) * 3) * e,
      shade(cor.campo, -0.12), i * 1.7, true)
  }

  // --- flores no campo
  for (let i = 0; i < 8; i++) {
    const fx = Math.round(aleatorio(i + 77) * w)
    const fy = Math.round(linhaChao + 2 * e + aleatorio(i + 91) * (h - linhaChao - 6 * e))
    const bal = Math.sin(t * 0.0018 + i) * e * 0.6
    ctx.fillStyle = shade(cor.campo, -0.25)
    ctx.fillRect(Math.round(fx + bal * 0.4), fy, Math.max(1, e), Math.round(3 * e))
    ctx.fillStyle = cor.flor
    ctx.fillRect(Math.round(fx - e + bal), fy - Math.round(2 * e), Math.round(3 * e), Math.round(3 * e))
    ctx.fillStyle = mix(cor.flor, '#ffffff', 0.55)
    ctx.fillRect(Math.round(fx + bal), fy - Math.round(e), Math.max(1, e), Math.max(1, e))
  }

  // --- borboletas de dia, vaga-lumes de noite
  //
  // As duas coisas resolvem o mesmo problema: **algo tem que se mexer quando o
  // bichinho está parado**, senão a cena morre entre uma interação e outra. É o
  // que o Kinectimals faz com o mato e os bichinhos de fundo da ilha.
  const bichinhos = cor.vagalume ? 7 : 4
  for (let i = 0; i < bichinhos; i++) {
    const base = aleatorio(i + 13)
    const fase = t * 0.0009 + base * TAU
    const bx = w * (0.12 + base * 0.76) + Math.cos(fase * 1.7) * w * 0.14
    const by = horizonte + (linhaChao - horizonte) * (0.15 + aleatorio(i + 44) * 0.7)
      + Math.sin(fase * 2.3) * h * 0.06
    if (cor.vagalume) {
      const brilho = 0.35 + Math.abs(Math.sin(t * 0.003 + i * 2)) * 0.65
      ctx.globalAlpha = brilho * 0.35
      ctx.fillStyle = '#ffe9a0'
      ctx.beginPath()
      ctx.arc(bx, by, 3 * e, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = brilho
      ctx.fillRect(Math.round(bx), Math.round(by), Math.max(1, e), Math.max(1, e))
      ctx.globalAlpha = 1
    } else {
      // asa que bate: dois losangos que abrem e fecham
      const abre = Math.abs(Math.sin(t * 0.012 + i))
      ctx.fillStyle = i % 2 ? '#ffd166' : '#ff9ec4'
      for (const lado of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + lado * 3 * e * (0.35 + abre), by - 2.2 * e)
        ctx.lineTo(bx + lado * 3.4 * e * (0.35 + abre), by + 1.4 * e)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = '#5b3a1f'
      ctx.fillRect(Math.round(bx), Math.round(by - e), Math.max(1, e), Math.round(2.4 * e))
    }
  }

  // --- pólen / poeirinha de luz subindo (só onde há sol)
  if (!cor.vagalume) {
    ctx.fillStyle = '#fff6c8'
    for (let i = 0; i < 10; i++) {
      const base = aleatorio(i + 200)
      const px2 = base * w
      const sobe = (t * 0.02 * (0.5 + base) + base * h) % h
      ctx.globalAlpha = 0.10 + Math.abs(Math.sin(t * 0.002 + i)) * 0.22
      ctx.fillRect(Math.round(px2), Math.round(linhaChao - sobe * 0.5), Math.max(1, e), Math.max(1, e))
    }
    ctx.globalAlpha = 1
  }

  // Dia ruim do bichinho: a cena inteira perde cor. É o mesmo aviso das barras,
  // dito pelo lugar em vez de por um número — e ler o humor do ambiente é o que
  // faz o cuidado parecer que importa.
  if (triste) {
    ctx.fillStyle = 'rgba(70,70,95,0.20)'
    ctx.fillRect(0, 0, w, h)
  }
}

/** Os tufos que passam NA FRENTE do bichinho. Chamar DEPOIS de desenhá-lo. */
export function desenharFrente(p, { t = 0, periodo = 'dia' } = {}) {
  const cor = PALETAS[periodo] || PALETAS.dia
  const e = Math.max(1, Math.round(p.h / 108))
  const ctx = p.ctx
  ctx.fillStyle = shade(cor.campo, -0.3)
  for (let i = 0; i < 7; i++) {
    const gx = aleatorio(i + 301) * p.w
    const altura = (7 + aleatorio(i + 402) * 6) * e
    for (let l = -2; l <= 2; l++) {
      const inclina = Math.sin(t * 0.0014 + i * 1.3 + l * 0.4) * altura * 0.26
      const baseY = p.h + e
      const topoY = baseY - altura
      ctx.beginPath()
      ctx.moveTo(gx + l * 2.4 * e, baseY)
      ctx.quadraticCurveTo(
        gx + l * 2.8 * e + inclina * 0.5, (baseY + topoY) / 2,
        gx + l * 3 * e + inclina, topoY,
      )
      ctx.lineTo(gx + l * 2.4 * e + 2 * e, baseY)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/**
 * A lambida no vidro.
 *
 * É o gesto que o dono citou do Kinectimals: o filhote chega no vidro e passa a
 * língua nele, do seu lado. Ela é desenhada por ÚLTIMO, na frente de tudo —
 * inclusive da grama da frente —, porque acontece na superfície da tela, e não
 * dentro da cena.
 *
 * ------------------------------------------------------ por que foi refeita
 *
 * O dono viu e disse que "ao lamber a câmera fica bem estranho". Dois defeitos,
 * e os dois eram de LUGAR — o desenho não sabia onde o bichinho estava:
 *
 * 1. **A língua nascia no rodapé da tela, no meio.** `base = h * 0,96`, `cx =
 *    w * 0,5`, sempre, viesse o bicho de onde viesse. Como ele lambe parado no
 *    lugar em que chegou (e ele chega num ponto sorteado entre 42% e 58% da
 *    largura), a língua saía DO CHÃO, ao lado dele, e subia por fora do corpo.
 *    Não lia como "ele está lambendo": lia como uma coisa rosa crescendo do
 *    rodapé. Agora ela sai da BOCA — a tela passa a âncora, do mesmo jeito que
 *    já faz pro objeto do item e pro triângulo de aviso.
 *
 * 2. **O rastro não era rastro.** Eram três elipses brancas fixas no meio da
 *    tela, pulsando o tempo todo enquanto a lambida durasse — inclusive ANTES
 *    da primeira passada da língua, o que é um borrão aparecendo do nada. Um
 *    rastro é o contrário disso: ele fica ONDE a língua encostou e vai secando
 *    sozinho. Aqui cada batida da língua deixa a marca dela, e as marcas somem
 *    em ordem de idade — a mais velha primeiro. Não é guardado estado nenhum: as
 *    batidas são periódicas, então dá pra saber a hora e o lugar das últimas
 *    quatro só olhando o relógio.
 *
 * Recebe:
 *   `forca`   — 0 a 1, o quanto a lambida está acontecendo;
 *   `t`       — o relógio da animação;
 *   `boca`    — { x, y } na tela, de onde a língua sai (o focinho);
 *   `alcance` — o tamanho da língua, em pixels de tela. Sai do tamanho do bicho
 *               na hora, senão um filhote lamberia com a língua de um adulto.
 *   `virado`  — pra que lado ele está olhando; a língua acompanha.
 */

// Uma batida de língua a cada tanto de milissegundos, e quanto tempo a marca
// molhada leva pra secar. Secar mais devagar que a batida é o que faz várias
// marcas conviverem na tela — é isso que parece vidro lambido.
const LAMBIDA_MS = 620
const SECA_MS = 1900

export function desenharLambida(p, { forca = 0, t = 0, boca = null, alcance = 0, virado = 1 } = {}) {
  const ctx = p.ctx
  const w = p.w
  const h = p.h
  const f = Math.max(0, Math.min(1, forca))
  if (f < 0.02) return

  // Sem âncora, cai no meio-baixo da tela. Não deveria acontecer (a tela sempre
  // manda), mas um desenho que soma `undefined` some inteiro e em silêncio.
  const bx = boca && Number.isFinite(boca.x) ? boca.x : w * 0.5
  const by = boca && Number.isFinite(boca.y) ? boca.y : h * 0.72
  const comprimento = alcance > 4 ? alcance : h * 0.22

  // Onde a n-ésima batida encostou no vidro. Espalhado de um jeito repetível
  // (não sorteado): sorteando, a marca mudaria de lugar a cada quadro e o
  // rastro tremeria inteiro.
  const alvoDa = (n) => {
    const giro = Math.sin(n * 2.399) // irracional o bastante pra não repetir cedo
    const sobe = 0.55 + 0.3 * Math.abs(Math.cos(n * 1.7))
    return {
      x: bx + virado * comprimento * (0.35 + 0.3 * giro),
      y: by - comprimento * sobe,
    }
  }

  // ------------------------------------------------------------- o rastro
  //
  // As quatro últimas batidas, da mais velha pra mais nova, pra a mais nova
  // ficar por cima. Cada uma some sozinha conforme envelhece.
  const batidaAtual = Math.floor(t / LAMBIDA_MS)
  ctx.save()
  ctx.fillStyle = '#ffffff'
  for (let k = 3; k >= 0; k--) {
    const n = batidaAtual - k
    if (n < 0) continue
    const idade = t - n * LAMBIDA_MS
    if (idade < 0 || idade > SECA_MS) continue
    const seco = idade / SECA_MS
    const alvo = alvoDa(n)
    const raio = comprimento * (0.26 + seco * 0.1)
    ctx.globalAlpha = (1 - seco) * 0.22 * f
    // Achatada, e inclinada no sentido da passada: uma marca redonda parece
    // gota, e gota escorre — o que se quer é a marca de uma língua raspando.
    ctx.beginPath()
    ctx.ellipse(alvo.x, alvo.y, raio, raio * 0.42, -0.35 * virado, 0, TAU)
    ctx.fill()
    // O contorno mais claro é a borda da água ainda molhada; ele some antes do
    // miolo, que é o que dá a sensação de secar da beirada pro meio.
    ctx.globalAlpha = (1 - seco) * (1 - seco) * 0.28 * f
    ctx.beginPath()
    ctx.ellipse(alvo.x, alvo.y, raio * 0.62, raio * 0.24, -0.35 * virado, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // -------------------------------------------------------------- a língua
  //
  // Ela sai e volta dentro de cada batida: fora nos primeiros 45% do ciclo,
  // recolhida no resto. Antes era um seno contínuo, e a língua vivia meio
  // esticada o tempo todo — língua meio esticada parada é a cara de "bug".
  const fase = (t % LAMBIDA_MS) / LAMBIDA_MS
  if (fase > 0.45) return
  const saida = Math.sin((fase / 0.45) * Math.PI) * f
  if (saida < 0.04) return

  const alvo = alvoDa(batidaAtual)
  const px = bx + (alvo.x - bx) * saida
  const py = by + (alvo.y - by) * saida
  const larg = comprimento * 0.19 * (0.75 + saida * 0.35)

  // A língua é desenhada como uma faixa da boca até a ponta, e não como um
  // triângulo em pé: ela tem que parecer sair de dentro dele, na diagonal.
  const ang = Math.atan2(py - by, px - bx)
  const nx = Math.cos(ang + Math.PI / 2) * larg
  const ny = Math.sin(ang + Math.PI / 2) * larg

  ctx.save()
  ctx.fillStyle = '#e8607e'
  ctx.beginPath()
  ctx.moveTo(bx - nx, by - ny)
  ctx.quadraticCurveTo(px - nx * 1.1, py - ny * 1.1, px, py)
  ctx.quadraticCurveTo(px + nx * 1.1, py + ny * 1.1, bx + nx, by + ny)
  ctx.closePath()
  ctx.fill()
  // o vinco do meio, que é o que faz ler como língua e não como pétala
  ctx.strokeStyle = '#c9435f'
  ctx.lineWidth = Math.max(1, h / 108)
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + (px - bx) * 0.78, by + (py - by) * 0.78)
  ctx.stroke()
  // brilho de saliva, perto da ponta
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#ffb6c8'
  ctx.beginPath()
  ctx.ellipse(
    bx + (px - bx) * 0.6 - nx * 0.3,
    by + (py - by) * 0.6 - ny * 0.3,
    larg * 0.32,
    larg * 0.18,
    ang,
    0,
    TAU
  )
  ctx.fill()
  ctx.restore()
}
