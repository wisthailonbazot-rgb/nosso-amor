// Motor de animacao do bichinho — esqueleto, poses e ciclos de passo.
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O desenho anterior era uma pilha de retangulos com UM numero de deslocamento
// vertical (`bob`, de 0 a 2 pixels). Tudo o que o bichinho sabia fazer era subir
// e descer o corpo inteiro: andar, comer, tomar banho e dormir usavam exatamente
// a mesma peca, so com periodo diferente. Nao existia perna, nao existia joelho,
// a cauda era um poligono fixo e a asa nunca batia. Por isso ele parecia
// simplificado — porque era: nao havia o que animar.
//
// Aqui o bichinho passa a ter ESQUELETO. Tres camadas, bem separadas:
//
//   1. PLANO DO CORPO (`planoDe`)  — quanto mede cada parte desta especie, neste
//      tamanho. E so medida: nao sabe nada de tempo nem de animacao.
//   2. CLIPE (`CLIPES`)            — o que cada parte esta fazendo NESTE instante
//      da acao. E so pose: nao sabe desenhar nada.
//   3. DESENHO (`desenharRig`)     — pinta o esqueleto posado. Nao sabe qual acao
//      esta rodando; recebe a pose pronta.
//
// A separacao paga em duas moedas: clipe novo (uma acao nova) nao encosta em
// desenho, e especie nova (um plano novo) nao encosta em clipe. Antes disso,
// acrescentar "deitar" significaria escrever mais um bloco de retangulos dentro
// do `if` gigante — que foi como o desenho velho chegou onde chegou.
//
// PIXEL, NAO VETOR. Todo poligono e preenchido por varredura em coordenada
// inteira (ver `pixel.js`) e o contorno sai de quatro copias deslocadas de 1px.
// Nada de `ctx.arc` com borda suavizada: franja cinza na diagonal e exatamente
// o que mata a leitura de pixel art quando o celular amplia o canvas.
//
// A CAIXA E A MESMA DE ANTES: 128x108, chao em y=92, centro em x=64. Isso nao e
// detalhe — `room.js`, `PetRunner.jsx`, `ItemPreview.jsx` e a bancada `/lab` ja
// colam esse canvas em tamanhos diferentes, e mudar a caixa quebraria os quatro
// de uma vez, calados.

import { mix, shade } from './pixel'

export const OUT = '#33203a'

/**
 * A paleta do bichinho, derivada da cor da espécie.
 *
 * O catálogo (Python) guarda QUATRO cores por espécie, e por muito tempo o
 * desenho leu essas quatro como se fossem `[principal, escuro, claro, traço]`.
 * Elas nunca foram isso: são quatro cores de ACENTO da espécie. No gato são
 * laranja, cinza, quase-preto e creme; no passarinho, amarelo, azul, verde e
 * rosa. Não existe rampa de sombra ali dentro.
 *
 * Com o desenho antigo — retângulos chapados — dava pra viver com o engano: o
 * cinza virava "uma mancha" e ninguém questionava. Com o esqueleto não dá: o
 * "escuro" cai nas quatro patas e na cauda, e um gato laranja aparece com
 * pernas cinza-chumbo e um rabo preto, tudo grudado numa mancha só. Foi
 * exatamente o que apareceu na bancada.
 *
 * A correção é ler cada coisa pelo que ela é: a sombra e a luz **saem da cor
 * principal** (por isso são sempre coerentes, em qualquer espécie), e as outras
 * cores do catálogo continuam sendo o que sempre foram — acentos: orelha por
 * dentro, ponta da cauda, asa, espinho, mancha.
 */
export function paletaDe(cores) {
  const lista = cores?.length ? cores : ['#c98a4b', '#8a5f3c', '#f0ebe2', OUT]
  const principal = lista[0]
  const acentos = lista.slice(1).filter(Boolean)
  return {
    principal,
    // `mix` em vez de `shade`: em cor já muito clara (o coelho é quase branco)
    // clarear por porcentagem estoura no branco e a barriga some. Misturar com
    // um alvo fixo dá degrau visível em toda a faixa, do branco ao roxo.
    escuro: mix(principal, '#3b2a33', 0.34),
    claro: mix(principal, '#fffaf2', 0.44),
    longe: mix(principal, '#3b2a33', 0.52),
    asa: acentos[0] || mix(principal, '#3b2a33', 0.3),
    marca: acentos[1] || acentos[0] || mix(principal, '#fffaf2', 0.6),
    detalhe: acentos[2] || '#f2b33d',
  }
}

export const CHAO = 92
export const CX = 64

// ------------------------------------------------------------------ geometria

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const TAU = Math.PI * 2

/** Elipse como lista de pontos. `rot` em radianos; `n` = quantos lados. */
function elipse(cx, cy, rx, ry, rot = 0, n = 16) {
  const pts = []
  const cos = Math.cos(rot)
  const sen = Math.sin(rot)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    pts.push([cx + x * cos - y * sen, cy + x * sen + y * cos])
  }
  return pts
}

/**
 * Capsula: um segmento com espessura, com as duas pontas arredondadas. E a peca
 * de que sao feitos perna, pescoco, cauda e dedo — qualquer coisa que seja
 * "osso com carne em volta".
 */
function capsula(x1, y1, x2, y2, r1, r2 = r1) {
  const dx = x2 - x1
  const dy = y2 - y1
  const d = Math.hypot(dx, dy) || 1
  const nx = -dy / d
  const ny = dx / d
  const ux = dx / d
  const uy = dy / d
  // O contorno tem que sair NUMA VOLTA SÓ, sem cruzar:
  //
  //   lado +n de 1 → meia-volta por FORA de 1 → lado -n de 1
  //   → (reto) lado -n de 2 → meia-volta por FORA de 2 → lado +n de 2 → fecha
  //
  // A primeira versão varria cada meia-volta de π/2 a 3π/2, e metade de cada
  // arco caía DENTRO da cápsula, no sentido do outro ponto. O polígono saía em
  // forma de laço, cruzando ele mesmo no meio — e o preenchimento por varredura
  // (que conta cruzamentos, ver `pixel.js`) CANCELA o miolo de um polígono que
  // se cruza. O resultado: a peça aparecia só nas duas pontas.
  //
  // Em perna e cauda, curtas e grossas, o buraco era pequeno e passou batido.
  // Na orelha do coelho — comprida e fina — o laço engoliu a peça inteira, e o
  // coelho ficou sem orelha. Mesmo defeito, tamanhos diferentes.
  const pts = []
  const N = 7
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI
    const c = Math.cos(a)
    const s = Math.sin(a)
    pts.push([x1 + nx * r1 * c - ux * r1 * s, y1 + ny * r1 * c - uy * r1 * s])
  }
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI
    const c = Math.cos(a)
    const s = Math.sin(a)
    pts.push([x2 - nx * r2 * c + ux * r2 * s, y2 - ny * r2 * c + uy * r2 * s])
  }
  return pts
}

/**
 * Cinematica inversa de dois ossos: dado o quadril e onde o pe precisa estar,
 * acha o joelho.
 *
 * E o que faz a perna DOBRAR em vez de esticar como um palito. Sem isto, o
 * bichinho andaria com as quatro pernas rigidas — que e o jeito mais rapido de
 * um desenho parecer de papelao. `dobra` = +1 joelho pra frente, -1 pra tras
 * (o traseiro de um quadrupede dobra ao contrario do dianteiro; isso sozinho ja
 * entrega "e um bicho de quatro patas" antes de olhar a cabeca).
 */
function ik2(hx, hy, px, py, l1, l2, dobra) {
  const dx = px - hx
  const dy = py - hy
  const bruto = Math.hypot(dx, dy) || 0.001
  const d = Math.min(bruto, l1 + l2 - 0.001)
  const ux = dx / bruto
  const uy = dy / bruto
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const mx = hx + ux * a
  const my = hy + uy * a
  return [mx - uy * h * dobra, my + ux * h * dobra]
}

/**
 * Curva do passo: onde esta o pe na fracao `ph` do ciclo.
 *
 * `apoio` e a parte do ciclo em que o pe esta NO CHAO empurrando pra tras; o
 * resto e o balanco, com o pe no ar voltando pra frente. Esse par apoio/balanco
 * e a definicao de andar. Encurtar o apoio e o que transforma andar em correr:
 * sobra tempo com os pes no ar.
 */
function passo(ph, alcance, altura, apoio = 0.62) {
  ph -= Math.floor(ph)
  if (ph < apoio) {
    const f = ph / apoio
    return { x: alcance * (1 - 2 * f), y: 0 }
  }
  const f = (ph - apoio) / (1 - apoio)
  return { x: alcance * (-1 + 2 * f), y: -altura * Math.sin(f * Math.PI) }
}

// ------------------------------------------------------------------ especies
//
// Medidas em pixel do canvas de 128x108, ja no tamanho ADULTO. O filhote sai
// destas mesmas medidas passadas pela conta de crescimento la embaixo — nao
// existe uma segunda tabela pra filhote, senao as duas divergiriam na primeira
// vez que alguem mexesse numa so.

export const ESPECIES = {
  gato: {
    tipo: 'quadrupede', corpoL: 28, corpoA: 15, cabecaL: 19, cabecaA: 18,
    focinho: 4, pescoco: 3, pernaA: 14, pernaE: 2.9, orelha: 'triangulo',
    cauda: 'longa', caudaSeg: 6, caudaL: 30, asa: null, andar: 'passo',
    velPasso: 1.0, marca: 'bigode',
  },
  cachorro: {
    tipo: 'quadrupede', corpoL: 29, corpoA: 20, cabecaL: 21, cabecaA: 19,
    focinho: 8, pescoco: 4, pernaA: 15, pernaE: 3.7, orelha: 'caida',
    cauda: 'media', caudaSeg: 4, caudaL: 20, asa: null, andar: 'passo',
    velPasso: 1.1, marca: 'manchas',
  },
  coelho: {
    tipo: 'quadrupede', corpoL: 22, corpoA: 17, cabecaL: 18, cabecaA: 17,
    focinho: 3, pescoco: 2, pernaA: 11, pernaE: 3.1, orelha: 'longa',
    cauda: 'pompom', caudaSeg: 1, caudaL: 7, asa: null, andar: 'pulo',
    velPasso: 1.3, marca: 'nenhuma',
  },
  capivara: {
    tipo: 'quadrupede', corpoL: 31, corpoA: 18, cabecaL: 21, cabecaA: 17,
    focinho: 7, pescoco: 2, pernaA: 10, pernaE: 3.9, orelha: 'redonda',
    cauda: 'toco', caudaSeg: 1, caudaL: 5, asa: null, andar: 'passo',
    velPasso: 0.8, marca: 'nenhuma',
  },
  passaro: {
    tipo: 'bipede', corpoL: 22, corpoA: 21, cabecaL: 17, cabecaA: 16,
    focinho: 7, pescoco: 4, pernaA: 11, pernaE: 1.8, orelha: 'nenhuma',
    cauda: 'leque', caudaSeg: 3, caudaL: 16, asa: 'pena', andar: 'saltito',
    velPasso: 1.4, marca: 'peito', bico: true, voa: true,
  },
  dragao: {
    tipo: 'quadrupede', corpoL: 30, corpoA: 18, cabecaL: 18, cabecaA: 15,
    focinho: 8, pescoco: 7, pernaA: 14, pernaE: 3.6, orelha: 'chifre',
    cauda: 'espinho', caudaSeg: 6, caudaL: 30, asa: 'membrana', andar: 'passo',
    velPasso: 1.0, marca: 'escamas', voa: true,
  },
}

export const CODIGOS_ESPECIE = Object.keys(ESPECIES)

/**
 * Plano do corpo desta especie NESTE ponto do crescimento.
 *
 * `g` vai de 0 (filhote recem-adotado) a 1 (adulto formado). O crescimento nao
 * e uma escala unica: se fosse, o filhote seria so o adulto menor, e todo mundo
 * enxerga isso como "zoom", nao como filhote.
 *
 * O que muda de verdade e a PROPORCAO — a mesma regra que os desenhistas chamam
 * de neotenia: filhote tem cabeca grande demais pro corpo, perna curta, focinho
 * quase inexistente, olho enorme e cauda de toco. Crescer e a cabeca PERDER
 * espaco relativo enquanto perna, focinho e cauda ganham. Por isso cada medida
 * tem o SEU fator, e nao um `scale` geral.
 */
export function planoDe(especie, g = 1, escala = 1) {
  const base = ESPECIES[especie] || ESPECIES.gato
  g = clamp(g, 0, 1)
  const geral = lerp(0.74, 1, g) * escala
  return {
    codigo: especie,
    tipo: base.tipo,
    g,
    escala,
    // As ancoras viajam DENTRO do plano. Antes eram duas constantes globais, e
    // por isso o bichinho so sabia existir numa caixa de 128x108 — quem
    // precisasse dele menor tinha que desenhar grande e encolher, que e
    // exatamente o que destruia a arte (ver o comentario de `drawPet`).
    cx: CX * escala,
    chao: CHAO * escala,
    corpoL: base.corpoL * geral * lerp(0.86, 1, g),
    corpoA: base.corpoA * geral * lerp(1.04, 1, g),
    cabecaL: base.cabecaL * geral * lerp(1.2, 1, g),
    cabecaA: base.cabecaA * geral * lerp(1.2, 1, g),
    focinho: base.focinho * geral * lerp(0.45, 1, g),
    pescoco: base.pescoco * geral * lerp(0.5, 1, g),
    pernaA: base.pernaA * geral * lerp(0.6, 1, g),
    pernaE: base.pernaE * geral * lerp(1.1, 1, g),
    orelha: base.orelha,
    orelhaF: lerp(0.8, 1, g),
    cauda: base.cauda,
    caudaSeg: base.caudaSeg,
    caudaL: base.caudaL * geral * lerp(0.55, 1, g),
    asa: base.asa,
    asaF: lerp(0.6, 1, g),
    andar: base.andar,
    velPasso: base.velPasso,
    marca: base.marca,
    bico: !!base.bico,
    voa: !!base.voa,
    olho: lerp(1.45, 1, g) * escala,
  }
}

/** Crescimento continuo a partir do que o servidor manda. */
export function crescimentoDe(pet) {
  if (typeof pet?.growth === 'number') return clamp(pet.growth, 0, 1)
  // Sem o campo do servidor, o estagio ainda da tres degraus — melhor do que
  // desenhar todo bichinho adulto porque um payload velho nao trouxe o numero.
  if (pet?.stage === 'adulto') return 1
  if (pet?.stage === 'jovem') return 0.5
  return 0
}

// ------------------------------------------------------------------ poses
//
// A pose e um objeto burro: numeros, sem nenhuma conta de tempo dentro. Quem
// faz a conta e o clipe; quem le e o desenho.

function poseNeutra(plano) {
  const pernas = plano.tipo === 'bipede' ? 2 : 4
  return {
    corpoX: 0, corpoY: 0, corpoAng: 0, corpoEsticar: 1, corpoAchatar: 1,
    cabecaX: 0, cabecaY: 0, cabecaAng: 0,
    pes: Array.from({ length: pernas }, () => ({ x: 0, y: 0 })),
    caudaAng: 0, caudaOnda: 0, caudaAmp: 0,
    asaAng: 0, asaAbrir: 0,
    orelhaAng: 0,
    olhos: 1, boca: 'sorriso',
    voo: 0,
    deitado: 0,
    sentado: 0,
  }
}

/**
 * Os clipes.
 *
 * Cada um recebe a fase `ph` (0 a 1, ja em loop) e o plano, e devolve o que
 * muda em relacao a pose neutra. `dur` e quanto tempo o ciclo leva, em ms.
 *
 * Regra que vale pra todos: NADA aqui desenha, e NADA aqui olha o relogio
 * direto. Recebendo so a fase, o mesmo clipe serve pra tela do bichinho, pro
 * comodo, pro jogo de corrida e pra bancada — inclusive rodando em velocidades
 * diferentes, que e o que a corrida precisa quando acelera.
 */
export const CLIPES = {
  parado: {
    dur: 2600,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const resp = Math.sin(ph * TAU)
      q.corpoY = resp * 0.9
      q.corpoAchatar = 1 + resp * 0.022
      q.cabecaY = resp * 0.7
      q.cabecaAng = Math.sin(ph * TAU * 0.5) * 0.05
      q.caudaAmp = 0.35
      q.caudaOnda = ph * TAU
      q.orelhaAng = Math.sin(ph * TAU + 1) * 0.06
      // piscada: rapida e rara, no fim do ciclo. Olho que nunca pisca e a coisa
      // que mais denuncia boneco — o olhar fica de vidro.
      q.olhos = ph > 0.93 && ph < 0.97 ? 0.1 : 1
      return q
    },
  },

  andar: {
    dur: 760,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const alc = plano.pernaA * 0.34
      const alt = plano.pernaA * 0.26
      if (plano.tipo === 'bipede') {
        q.pes[0] = passo(ph, alc, alt)
        q.pes[1] = passo(ph + 0.5, alc, alt)
        q.corpoY = Math.abs(Math.sin(ph * TAU)) * -1.4
        q.cabecaX = Math.sin(ph * TAU) * 1.2   // pescoco de passaro bombando
      } else {
        // Marcha diagonal: a pata da frente de um lado sai junto com a de tras
        // do outro. E a marcha real de gato e cachorro, e ela sozinha ja da a
        // leitura de "quatro patas" mesmo com a silhueta parada.
        //  [0] tras-longe  [1] frente-longe  [2] tras-perto  [3] frente-perto
        q.pes[0] = passo(ph, alc, alt)
        q.pes[1] = passo(ph + 0.5, alc, alt)
        q.pes[2] = passo(ph + 0.5, alc, alt)
        q.pes[3] = passo(ph, alc, alt)
        q.corpoY = Math.sin(ph * TAU * 2) * 0.9
        q.corpoAng = Math.sin(ph * TAU) * 0.03
        q.cabecaY = Math.sin(ph * TAU * 2 + 0.6) * 0.8
      }
      q.caudaAmp = 0.8
      q.caudaOnda = ph * TAU * 2
      q.orelhaAng = Math.sin(ph * TAU * 2) * 0.16
      return q
    },
  },

  saltitar: {
    // O coelho e o passaro nao andam: eles pulam. Usar `andar` pros dois seria o
    // erro visual mais barato de evitar aqui dentro.
    dur: 560,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const ar = Math.max(0, Math.sin(ph * TAU - 0.4))
      q.corpoY = -ar * plano.pernaA * 0.7
      q.corpoAng = -ar * 0.14
      q.corpoEsticar = 1 + ar * 0.10
      q.cabecaY = -ar * 1.6
      const dobrar = (1 - ar) * plano.pernaA * 0.34
      for (let i = 0; i < q.pes.length; i++) {
        const tras = plano.tipo === 'bipede' ? true : i === 0 || i === 2
        q.pes[i] = tras
          ? { x: -ar * plano.pernaA * 0.30, y: -ar * plano.pernaA * 0.55 + dobrar * 0.3 }
          : { x: ar * plano.pernaA * 0.22, y: -ar * plano.pernaA * 0.75 }
      }
      q.orelhaAng = -ar * 0.5 + 0.1            // orelha voa pra tras no pulo
      q.caudaAmp = 0.5
      q.caudaOnda = ph * TAU
      return q
    },
  },

  correr: {
    dur: 420,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const alc = plano.pernaA * 0.52
      const alt = plano.pernaA * 0.42
      if (plano.tipo === 'bipede') {
        q.pes[0] = passo(ph, alc, alt, 0.42)
        q.pes[1] = passo(ph + 0.5, alc, alt, 0.42)
        q.corpoAng = -0.16
        q.corpoY = -Math.abs(Math.sin(ph * TAU)) * 2.2
      } else {
        // Galope: as duas de tras juntas, as duas da frente juntas, com um
        // pedaco do ciclo com TUDO no ar. E o que separa correr de andar rapido.
        const tras = passo(ph, alc, alt, 0.34)
        const frente = passo(ph + 0.42, alc, alt, 0.34)
        q.pes[0] = tras
        q.pes[2] = { x: tras.x - 1, y: tras.y }
        q.pes[1] = frente
        q.pes[3] = { x: frente.x + 1, y: frente.y }
        const suspenso = Math.max(0, Math.sin(ph * TAU - 0.9))
        q.corpoY = -suspenso * plano.pernaA * 0.34
        q.corpoAng = -0.10 + Math.sin(ph * TAU) * 0.07
        q.corpoEsticar = 1 + Math.sin(ph * TAU) * 0.07   // coluna estica e recolhe
        q.cabecaY = -suspenso * 1.6
        q.cabecaAng = -0.08
      }
      q.caudaAng = -0.5
      q.caudaAmp = 1.1
      q.caudaOnda = ph * TAU * 2
      q.orelhaAng = -0.42
      return q
    },
  },

  pular: {
    dur: 900, loop: false,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      // agacha (0 a .22), sobe, flutua, cai e amortece (.85 a 1)
      let altura = 0
      let dobra = 0
      if (ph < 0.22) dobra = Math.sin((ph / 0.22) * Math.PI)
      else if (ph < 0.85) altura = Math.sin(((ph - 0.22) / 0.63) * Math.PI)
      else dobra = Math.sin(((ph - 0.85) / 0.15) * Math.PI) * 0.8

      q.corpoY = -altura * plano.pernaA * 1.5 + dobra * plano.pernaA * 0.34
      q.corpoAng = -altura * 0.16
      q.corpoEsticar = 1 + altura * 0.12
      q.corpoAchatar = 1 - dobra * 0.14
      q.cabecaY = -altura * 2.4 + dobra * 1.4
      for (let i = 0; i < q.pes.length; i++) {
        q.pes[i] = {
          x: altura * (i % 2 ? 2.5 : -2.5),
          y: -altura * plano.pernaA * 0.6 + dobra * plano.pernaA * 0.3,
        }
      }
      q.orelhaAng = -altura * 0.55
      q.caudaAng = -altura * 0.7
      q.caudaAmp = 0.9
      q.caudaOnda = ph * TAU * 2
      return q
    },
  },

  sentar: {
    dur: 3400,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.sentado = 1
      // bumbum no chao: o corpo desce e inclina pra tras, as traseiras dobram
      q.corpoY = plano.pernaA * 0.44
      q.corpoAng = 0.30
      q.cabecaY = plano.pernaA * 0.10 + Math.sin(ph * TAU) * 0.7
      q.pes[0] = { x: -plano.pernaA * 0.22, y: -plano.pernaA * 0.44 }
      if (q.pes[2]) q.pes[2] = { x: -plano.pernaA * 0.20, y: -plano.pernaA * 0.44 }
      q.caudaAng = 0.5
      q.caudaAmp = 0.55
      q.caudaOnda = ph * TAU
      q.orelhaAng = Math.sin(ph * TAU + 2) * 0.09
      q.olhos = ph > 0.9 && ph < 0.94 ? 0.1 : 1
      return q
    },
  },

  deitar: {
    dur: 4200,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      // Barriga no chao, patas dobradas pra frente, cabeca alta e acordada. E
      // pose de descanso, nao de sono — o dono pediu as duas, e sao diferentes:
      // deitado ele ainda olha em volta.
      q.deitado = 1
      q.corpoY = plano.pernaA * 0.82
      q.corpoAchatar = 1.08
      q.corpoEsticar = 1.06
      q.cabecaY = plano.pernaA * 0.42 + Math.sin(ph * TAU) * 0.8
      q.cabecaAng = 0.06
      for (let i = 0; i < q.pes.length; i++) {
        q.pes[i] = { x: (i % 2 ? 3.5 : -1.5), y: -plano.pernaA * 0.82 }
      }
      q.caudaAng = 0.72
      q.caudaAmp = 0.42
      q.caudaOnda = ph * TAU
      q.orelhaAng = Math.sin(ph * TAU * 1.5) * 0.12
      q.olhos = ph > 0.88 && ph < 0.93 ? 0.1 : 1
      return q
    },
  },

  dormir: {
    dur: 5200,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.deitado = 1
      const resp = Math.sin(ph * TAU)
      q.corpoY = plano.pernaA * 0.86
      q.corpoAchatar = 1.10 + resp * 0.035     // respiracao lenta e funda
      q.corpoEsticar = 1.08
      q.cabecaY = plano.pernaA * 0.66 + resp * 0.6
      q.cabecaAng = 0.24                       // cabeca tombada no chao
      for (let i = 0; i < q.pes.length; i++) {
        q.pes[i] = { x: (i % 2 ? 4 : -2), y: -plano.pernaA * 0.86 }
      }
      q.caudaAng = 0.9
      q.caudaAmp = 0.16
      q.caudaOnda = ph * TAU * 0.5
      q.orelhaAng = 0.22
      q.olhos = 0
      q.boca = 'reta'
      return q
    },
  },

  comer: {
    dur: 900,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const abaixa = (Math.sin(ph * TAU - Math.PI / 2) + 1) / 2
      q.cabecaY = abaixa * (plano.pernaA * 0.9 + plano.corpoA * 0.34)
      q.cabecaAng = abaixa * 0.42
      q.corpoY = abaixa * 1.6
      q.corpoAng = abaixa * 0.10
      q.boca = ph % 0.25 < 0.12 ? 'aberta' : 'reta'   // mastigada rapida
      q.caudaAmp = 0.9
      q.caudaOnda = ph * TAU * 3                      // rabo feliz de comida
      q.orelhaAng = 0.16
      return q
    },
  },

  roer: {
    dur: 460,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.sentado = 1
      q.corpoY = plano.pernaA * 0.36
      q.corpoAng = 0.22
      q.cabecaY = plano.pernaA * 0.20 + Math.sin(ph * TAU) * 1.4
      q.cabecaAng = 0.18 + Math.sin(ph * TAU) * 0.10
      q.boca = ph % 0.5 < 0.25 ? 'aberta' : 'reta'
      // as duas dianteiras SEGURAM: sobem ate a boca em vez de ficar no chao
      if (q.pes[1]) q.pes[1] = { x: plano.corpoL * 0.16, y: -plano.pernaA * 0.66 }
      if (q.pes[3]) q.pes[3] = { x: plano.corpoL * 0.18, y: -plano.pernaA * 0.72 }
      q.pes[0] = { x: -plano.pernaA * 0.2, y: -plano.pernaA * 0.36 }
      if (q.pes[2]) q.pes[2] = { x: -plano.pernaA * 0.18, y: -plano.pernaA * 0.36 }
      q.caudaAmp = 0.6
      q.caudaOnda = ph * TAU * 2
      return q
    },
  },

  beber: {
    dur: 700,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.cabecaY = plano.pernaA * 0.95 + plano.corpoA * 0.3
      q.cabecaAng = 0.5
      q.corpoY = 1.4
      q.boca = ph % 0.2 < 0.1 ? 'aberta' : 'reta'   // lambida
      q.caudaAmp = 0.4
      q.caudaOnda = ph * TAU
      return q
    },
  },

  banho: {
    dur: 620,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      // sacudida: o corpo GIRA de um lado pro outro, rapido. Antes disso "banho"
      // era o corpo subindo 1 pixel — indistinguivel de estar parado.
      const sac = Math.sin(ph * TAU * 3)
      q.corpoAng = sac * 0.15
      q.corpoX = sac * 1.8
      q.corpoAchatar = 1 + Math.abs(sac) * 0.05
      q.cabecaX = -sac * 2.4
      q.cabecaAng = -sac * 0.24
      q.orelhaAng = -sac * 0.6                       // orelha chicoteia junto
      q.caudaAmp = 1.2
      q.caudaOnda = ph * TAU * 4
      q.olhos = 0.25
      q.boca = 'reta'
      for (let i = 0; i < q.pes.length; i++) q.pes[i] = { x: sac * (i % 2 ? 1 : -1), y: 0 }
      return q
    },
  },

  brincar: {
    dur: 640,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      // agachada de brincadeira: bunda pro alto, peito no chao, e pulinho
      const salto = Math.max(0, Math.sin(ph * TAU))
      q.corpoY = -salto * plano.pernaA * 0.55
      q.corpoAng = -0.18 + salto * 0.3
      q.cabecaY = -salto * 2.2 - 1
      q.cabecaAng = -0.12
      for (let i = 0; i < q.pes.length; i++) {
        const frente = i === 1 || i === 3
        q.pes[i] = {
          x: frente ? salto * 4 : -salto * 2,
          y: -salto * plano.pernaA * (frente ? 0.8 : 0.4),
        }
      }
      q.caudaAng = -0.6
      q.caudaAmp = 1.4
      q.caudaOnda = ph * TAU * 3
      q.orelhaAng = -0.3
      q.boca = 'aberta'
      return q
    },
  },

  feliz: {
    dur: 720,
    pose(ph, plano) {
      const q = CLIPES.brincar.pose(ph, plano)
      q.boca = 'sorriso'
      return q
    },
  },

  cocar: {
    // Cocar a orelha com a pata de tras. E o gesto mais reconhecivel de bicho
    // domestico, e nao custa nada: e uma perna fora do lugar.
    dur: 1500,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.sentado = 1
      q.corpoY = plano.pernaA * 0.42
      q.corpoAng = 0.26
      const rapido = Math.sin(ph * TAU * 9)
      q.cabecaAng = 0.12 + rapido * 0.06
      q.cabecaX = -1
      q.pes[0] = { x: plano.corpoL * 0.30, y: -plano.pernaA * 1.15 + rapido * 1.8 }
      if (q.pes[2]) q.pes[2] = { x: -plano.pernaA * 0.2, y: -plano.pernaA * 0.42 }
      q.orelhaAng = -0.24 + rapido * 0.10
      q.caudaAmp = 0.4
      q.caudaOnda = ph * TAU
      q.olhos = 0.35
      return q
    },
  },

  rolar: {
    dur: 2000,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.deitado = 1
      const giro = Math.sin(ph * TAU)
      q.corpoY = plano.pernaA * 0.9
      q.corpoAng = giro * 0.42
      q.corpoAchatar = 1.14
      q.cabecaY = plano.pernaA * 0.5
      q.cabecaAng = giro * 0.4
      for (let i = 0; i < q.pes.length; i++) {
        // patinhas pro ar, mexendo
        q.pes[i] = {
          x: (i % 2 ? 3 : -3) + giro * 2,
          y: -plano.pernaA * 1.25 + Math.sin(ph * TAU * 4 + i) * 1.5,
        }
      }
      q.caudaAmp = 0.8
      q.caudaOnda = ph * TAU * 2
      q.boca = 'aberta'
      return q
    },
  },

  implorar: {
    dur: 1400,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.sentado = 1
      q.corpoY = plano.pernaA * 0.40
      q.corpoAng = 0.34
      q.cabecaY = -1 + Math.sin(ph * TAU) * 0.8
      q.cabecaAng = -0.14
      const mexe = Math.sin(ph * TAU * 3) * 1.6
      if (q.pes[1]) q.pes[1] = { x: plano.corpoL * 0.20, y: -plano.pernaA * 0.95 + mexe }
      if (q.pes[3]) q.pes[3] = { x: plano.corpoL * 0.24, y: -plano.pernaA * 1.05 - mexe }
      q.pes[0] = { x: -plano.pernaA * 0.2, y: -plano.pernaA * 0.40 }
      if (q.pes[2]) q.pes[2] = { x: -plano.pernaA * 0.18, y: -plano.pernaA * 0.40 }
      q.caudaAmp = 1.2
      q.caudaOnda = ph * TAU * 3
      q.orelhaAng = -0.1
      return q
    },
  },

  triste: {
    dur: 3800,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.corpoY = 2.6
      q.corpoAng = 0.10
      q.corpoAchatar = 1.05
      q.cabecaY = 4.2 + Math.sin(ph * TAU) * 0.6    // cabeca baixa
      q.cabecaAng = 0.28
      q.caudaAng = 1.15                              // rabo entre as pernas
      q.caudaAmp = 0.12
      q.caudaOnda = ph * TAU * 0.5
      q.orelhaAng = 0.55                             // orelha caida
      q.boca = 'triste'
      q.olhos = 0.7
      return q
    },
  },

  doente: {
    dur: 2600,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.deitado = 1
      const resp = Math.sin(ph * TAU)
      q.corpoY = plano.pernaA * 0.8
      q.corpoAchatar = 1.08 + resp * 0.05           // respiracao curta e rapida
      q.cabecaY = plano.pernaA * 0.58 + resp * 1.2
      q.cabecaAng = 0.3
      for (let i = 0; i < q.pes.length; i++) q.pes[i] = { x: (i % 2 ? 3 : -2), y: -plano.pernaA * 0.8 }
      q.caudaAng = 1.0
      q.caudaAmp = 0.08
      q.orelhaAng = 0.6
      q.boca = 'triste'
      q.olhos = 0.2
      return q
    },
  },

  voar: {
    // Pra quem tem asa. O bichinho sai do chao de verdade: a sombra encolhe, as
    // patas recolhem e a asa bate. Sem isso, "o passaro voa" seria o mesmo
    // sprite parado com duas listras balancando do lado, que era o que existia.
    dur: 480,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const bate = Math.sin(ph * TAU)
      q.voo = 1
      q.corpoY = -plano.pernaA * 1.9 - bate * 2.6    // sobe e desce com a batida
      q.corpoAng = -0.10 - bate * 0.05
      q.cabecaY = -bate * 1.2
      q.asaAng = bate * 1.15
      q.asaAbrir = 1
      for (let i = 0; i < q.pes.length; i++) {
        q.pes[i] = { x: -plano.pernaA * 0.25, y: -plano.pernaA * 0.85 }
      }
      q.caudaAng = -0.2
      q.caudaAmp = 0.5
      q.caudaOnda = ph * TAU
      return q
    },
  },

  planar: {
    dur: 2800,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      const onda = Math.sin(ph * TAU)
      q.voo = 1
      q.corpoY = -plano.pernaA * 2.1 + onda * 2.2
      q.corpoAng = -0.06 + onda * 0.05
      q.asaAng = 0.12 + onda * 0.12                  // asa quase parada, so ajusta
      q.asaAbrir = 1
      for (let i = 0; i < q.pes.length; i++) {
        q.pes[i] = { x: -plano.pernaA * 0.3, y: -plano.pernaA * 0.9 }
      }
      q.caudaAmp = 0.3
      q.caudaOnda = ph * TAU
      return q
    },
  },

  cavar: {
    dur: 520,
    pose(ph, plano) {
      const q = poseNeutra(plano)
      q.corpoAng = -0.22
      q.corpoY = 2.2
      q.cabecaY = 3.4
      q.cabecaAng = 0.34
      const cava = Math.sin(ph * TAU)
      if (q.pes[1]) q.pes[1] = { x: plano.corpoL * 0.12 + cava * 4, y: -Math.max(0, cava) * 6 }
      if (q.pes[3]) q.pes[3] = { x: plano.corpoL * 0.14 - cava * 4, y: -Math.max(0, -cava) * 6 }
      q.caudaAng = -0.5
      q.caudaAmp = 1.0
      q.caudaOnda = ph * TAU * 2
      return q
    },
  },
}

/**
 * Nomes de acao que ja circulam pelo app apontando pro clipe certo.
 *
 * Existem tres origens de nome vivas hoje: as acoes em ingles do desenho antigo
 * (`walk`, `eat`, `sleep`), as cenas em portugues do `petProps.js` (`comer`,
 * `roer`, `correr`) e agora estas. Uma tabela SO — se cada arquivo mantivesse a
 * sua, elas divergiriam na primeira acao nova, e a divergencia apareceria como
 * bichinho parado, sem erro nenhum no console.
 */
export const ALIAS = {
  idle: 'parado', parado: 'parado', neutro: 'parado',
  walk: 'andar', andar: 'andar', andando: 'andar',
  run: 'correr', correr: 'correr',
  jump: 'pular', pular: 'pular',
  hop: 'saltitar', saltitar: 'saltitar',
  sit: 'sentar', sentar: 'sentar', sentado: 'sentar',
  lie: 'deitar', deitar: 'deitar', deitado: 'deitar',
  sleep: 'dormir', dormir: 'dormir',
  eat: 'comer', comer: 'comer',
  drink: 'beber', beber: 'beber',
  gnaw: 'roer', roer: 'roer',
  bath: 'banho', banho: 'banho',
  play: 'brincar', brincar: 'brincar',
  happy: 'feliz', feliz: 'feliz',
  sad: 'triste', triste: 'triste',
  sick: 'doente', doente: 'doente',
  fly: 'voar', voar: 'voar',
  glide: 'planar', planar: 'planar',
  scratch: 'cocar', cocar: 'cocar',
  roll: 'rolar', rolar: 'rolar',
  beg: 'implorar', implorar: 'implorar',
  dig: 'cavar', cavar: 'cavar',
}

export const NOMES_CLIPES = Object.keys(CLIPES)

/**
 * Traduz a acao pedida pro clipe que esta especie realmente sabe fazer.
 *
 * Duas correcoes moram aqui, e so aqui:
 *  - coelho e passaro nao ANDAM, saltitam;
 *  - quem nao tem asa nunca voa, ainda que alguem peca (o dragao voa, a capivara
 *    nao) — pedir `voar` pra capivara devolveria uma pose com o bicho boiando
 *    no ar sem asa nenhuma.
 */
export function clipeDe(acao, plano) {
  let nome = ALIAS[acao] || (CLIPES[acao] ? acao : 'parado')
  if ((nome === 'voar' || nome === 'planar') && !plano.voa) nome = 'pular'
  if (nome === 'andar' && plano.andar !== 'passo') nome = 'saltitar'
  if (nome === 'correr' && plano.andar === 'pulo') nome = 'saltitar'
  return nome
}

/** A pose desta especie, nesta acao, neste instante. `vel` acelera o ciclo. */
// As medidas do plano que sao COMPRIMENTO. O resto (tipo, andar, codigo, os
// fatores) nao tem escala e passa direto.
const MEDIDAS = [
  'cx', 'chao', 'corpoL', 'corpoA', 'cabecaL', 'cabecaA',
  'focinho', 'pescoco', 'pernaA', 'pernaE', 'caudaL', 'olho',
]

/**
 * O plano SEM a escala, que e o que os clipes esperam receber.
 *
 * ---------------------------------------------------------------- por que
 *
 * Havia uma escala aplicada DUAS VEZES, e era ela a "animacao contorcendo o
 * corpo".
 *
 * O desenho multiplica todo valor de pose pela escala — `corpoCY` soma
 * `q.corpoY * plano.escala`, a perna mira em `pe.y * plano.escala`. Ou seja: o
 * clipe deveria falar em unidades CRUAS. Só que quase todos os clipes escrevem
 * as poses em cima do proprio plano (`q.pes[0] = { y: -plano.pernaA * 0.85 }`),
 * e `plano.pernaA` JA vem multiplicado pela escala. O resultado e escala ao
 * quadrado em tudo que e deslocamento de pose.
 *
 * Enquanto a caixa foi sempre 128x108 a escala era 1, e 1 x 1 continua 1: o
 * defeito existia e nao aparecia. Desenhando o bichinho grande (escala perto de
 * 4), os deslocamentos passaram a ser ~15 vezes em vez de 4 — pata mirando
 * muito alem do chao, cabeca deslocada pra fora do pescoco, corpo afundando.
 * Cada clipe deformava de um jeito diferente, porque cada um mexe num conjunto
 * diferente de valores. Era isso que se via como o corpo se contorcendo.
 *
 * O conserto e uma linha em vez de mexer nos 22 clipes: eles recebem o plano
 * com os comprimentos divididos pela escala. Aí `plano.pernaA * 0,85` volta a
 * ser uma fracao CRUA, a multiplicacao do desenho aplica a escala uma vez so, e
 * os numeros soltos que alguns clipes usam (`{ x: 3.5 }`) passam a escalar
 * junto — coisa que antes nao acontecia, e que deixava esses pes parados no
 * lugar enquanto o resto crescia.
 */
function semEscala(plano) {
  const e = plano.escala || 1
  if (e === 1) return plano
  const copia = { ...plano, escala: 1 }
  for (const k of MEDIDAS) copia[k] = plano[k] / e
  return copia
}

export function poseEm(acao, plano, tMs, vel = 1) {
  const nome = clipeDe(acao, plano)
  const clipe = CLIPES[nome]
  const dur = clipe.dur / Math.max(0.15, vel * (plano.velPasso || 1))
  const ph = ((tMs % dur) + dur) % dur / dur
  const q = clipe.pose(ph, semEscala(plano))
  q.clipe = nome
  q.fase = ph
  return q
}

// ------------------------------------------------------------------ desenho
// ------------------------------------------------------------------ desenho

/**
 * Uma camada de profundidade, pintada em DOIS PASSES: contorno de tudo, depois
 * preenchimento de tudo.
 *
 * É o conserto da emenda em cada articulação.
 *
 * Antes, cada peça era pintada inteira (contorno + preenchimento) antes da
 * seguinte. O resultado é que o contorno da coxa ficava carimbado POR CIMA da
 * canela, o do pescoço por cima do peito, e o bichinho aparecia costurado —
 * uma linha escura atravessando o corpo em todo lugar onde duas peças se
 * encontram. Não era erro de conta: era a ordem de pintura.
 *
 * Com dois passes o contorno de todas as peças da camada vai pro canvas
 * primeiro, e os preenchimentos passam por cima em seguida. Sobra traço só onde
 * NENHUM preenchimento chegou — ou seja, exatamente na silhueta externa. As
 * junções internas somem, que é como um bicho é: coxa e barriga são a mesma
 * carne, não duas peças encostadas.
 *
 * A separação continua existindo ENTRE camadas: a pata de longe é uma camada
 * atrás, então o contorno dela sobrevive contra o corpo e continua dando pra
 * ver que são duas patas diferentes. É o mesmo princípio de sempre — o que está
 * longe sai primeiro —, só que agora aplicado a grupos, e não a peça por peça.
 */
//
// `t` e a ESPESSURA do contorno, em pixels do canvas. Ela nao pode ser fixa em
// 1: quando o bichinho passou a ser desenhado em resolucao maior (a tela dele
// hoje pinta ate 3x mais pixels que a caixa de referencia), um traco de 1 px
// vira um fio de cabelo do lado de um corpo tres vezes maior — o desenho perde
// justamente o contorno grosso que da a cara de desenho. Ela tambem nao pode
// ser fracionaria: meio pixel de traco e franja cinza na diagonal.
/** Linha com espessura: `p.line` so faz 1 px, e 1 px some numa arte 3x maior. */
function grossa(p, x1, y1, x2, y2, t = 1, cor = OUT) {
  const d = Math.max(1, Math.round(t))
  for (let i = 0; i < d; i++) {
    p.line(x1, y1 + i, x2, y2 + i, cor)
    if (d > 1) p.line(x1 + i, y1, x2 + i, y2, cor)
  }
}

function desenharCamada(p, pecas, t = 1) {
  const d = Math.max(1, Math.round(t))
  for (const { pts } of pecas) {
    p.fillPoly(pts.map(([x, y]) => [x - d, y]), OUT)
    p.fillPoly(pts.map(([x, y]) => [x + d, y]), OUT)
    p.fillPoly(pts.map(([x, y]) => [x, y - d]), OUT)
    p.fillPoly(pts.map(([x, y]) => [x, y + d]), OUT)
  }
  for (const { pts, fill } of pecas) p.fillPoly(pts, fill)
}

/**
 * Pinta o esqueleto já posado.
 *
 * ANATOMIA. A primeira versão desenhava o tronco como UMA elipse comprida, com
 * o pescoço saindo pra frente e a cabeça lá na ponta. Isso é a silhueta de um
 * dinossauro bípede, não a de um gato — e foi o que o dono viu na hora. Três
 * coisas mudaram, e são as três que definem um quadrúpede doméstico:
 *
 *   1. o tronco é feito de PEITO + BARRIGA + GARUPA (três massas que se
 *      sobrepõem), então as costas afundam no meio e sobem na anca, como em
 *      bicho de verdade. Uma elipse só é um tubo, e tubo lê como réptil;
 *   2. a cabeça fica ACIMA do peito, não à frente dele. Cachorro e gato quase
 *      não têm pescoço aparente vistos de lado; o pescoço comprido projetado pra
 *      frente é justamente a marca do dinossauro;
 *   3. a cabeça é grande em relação ao corpo, e o focinho é curto. Cabeça
 *      pequena na ponta de um pescoço é a leitura oposta da que se quer aqui.
 */
export function desenharRig(p, plano, q, cores, extra = {}) {
  const pal = paletaDe(cores)
  const { principal, escuro, claro, longe } = pal
  const bipede = plano.tipo === 'bipede'
  // A escala do plano, para as medidas que NAO saem dele.
  //
  // O corpo inteiro ja e proporcional (`planoDe` multiplica cada osso), mas o
  // rosto era escrito em numeros crus — nariz 2.4 x 1.7, bigode de 9 px, boca
  // de 6. Enquanto a caixa foi sempre 128x108 isso funcionou. Ao desenhar o
  // bichinho em resolucao maior, o corpo cresce e o rosto NAO: sobra um bicho
  // grande com um narizinho de alfinete no meio da cara. Por isso tudo o que e
  // rosto passa por `e`.
  const e = plano.escala
  const traco = e

  // ----------------------------------------------------------- âncoras
  const pernaA = plano.pernaA
  const { cx: ANCX, chao: ANCHAO } = plano
  const corpoCX = ANCX + q.corpoX * plano.escala - 2 * plano.escala
  const corpoCY = ANCHAO - pernaA - plano.corpoA / 2 + q.corpoY * plano.escala
  const corpoL = (plano.corpoL * q.corpoEsticar) / 2
  const corpoA = (plano.corpoA * q.corpoAchatar) / 2
  const ang = q.corpoAng

  /** Um ponto em coordenadas do tronco (-1 a 1 nos dois eixos), já inclinado. */
  const noCorpo = (fx, fy) => {
    const x = fx * corpoL
    const y = fy * corpoA
    return [
      corpoCX + x * Math.cos(ang) - y * Math.sin(ang),
      corpoCY + x * Math.sin(ang) + y * Math.cos(ang),
    ]
  }

  const quadril = noCorpo(-0.52, 0.42)
  const ombro = bipede ? noCorpo(-0.05, 0.55) : noCorpo(0.5, 0.42)

  // A cabeça sobe em cima do peito. `pescoco` agora inclina ela pra frente em
  // vez de empurrá-la pra longe — é a diferença entre um cachorro e um bípede.
  const peito = noCorpo(bipede ? 0.1 : 0.52, -0.42)
  const cabecaCX = peito[0] + (bipede ? 1 : plano.pescoco * 0.55 + plano.cabecaL * 0.10) + q.cabecaX * plano.escala
  const miraPre = extra.mirar || null
  const cabecaCY = peito[1] - plano.cabecaA * (bipede ? 0.62 : 0.42) - plano.pescoco * 0.30
    + q.cabecaY * plano.escala + (miraPre ? miraPre.dy * plano.cabecaA * 0.10 : 0)
  const pescocoBase = noCorpo(bipede ? 0.1 : 0.46, -0.34)

  // O BICHINHO OLHA PRA VOCE.
  //
  // E a coisa mais barata e mais eficaz que o Kinectimals faz: o filhote segue a
  // sua mao com a cabeca e com o olho. Sem isso o bicho e um desenho que anima
  // sozinho; com isso ele parece estar do outro lado do vidro, prestando
  // atencao em voce. `extra.mirar` chega em -1..1 (esquerda/direita e
  // cima/baixo) e entra como um ACRESCIMO na pose — a animacao continua mandando
  // no resto, entao ele consegue olhar pra voce enquanto anda, come ou dorme.
  const mira = extra.mirar || null
  const ca = q.cabecaAng + (mira ? mira.dx * 0.22 + mira.dy * 0.10 : 0)
  const naCabeca = (fx, fy) => {
    const x = (fx * plano.cabecaL) / 2
    const y = (fy * plano.cabecaA) / 2
    return [
      cabecaCX + x * Math.cos(ca) - y * Math.sin(ca),
      cabecaCY + x * Math.sin(ca) + y * Math.cos(ca),
    ]
  }

  /**
   * Como `naCabeca`, mas GARANTINDO que uma peça de raio `rx` caiba no rosto.
   *
   * A cabeça é uma ELIPSE, e é isso que a versão anterior de cada peça do rosto
   * esquecia: cada uma era ancorada numa fração fixa da meia-largura (o nariz em
   * 0,78, a bochecha direita em 0,80) com o raio saindo de outra conta, que não
   * sabia da primeira. Enquanto a peça fica perto do meio da altura isso passa;
   * perto da borda de cima ou de baixo, a elipse já estreitou e a meia-largura
   * real ali é bem menor que `cabecaL / 2`.
   *
   * Medido no coelho grande — o pior caso, porque é quem tem a cabeça menor em
   * relação ao corpo: a bochecha direita passava **5,7 px** da borda e o nariz
   * **2,6 px**. Na tela isso lia como uma mancha rosa grudada na lateral da
   * cara, do lado de fora do contorno, e foi o que o dono viu e chamou de
   * "a língua continua bugada" — não era a língua, era o rosto vazando.
   *
   * Aqui a meia-largura é calculada NA ALTURA em que a peça vai ficar, e o `x`
   * recua o quanto for preciso. Vale pra qualquer espécie e qualquer escala.
   */
  const noRosto = (fx, fy, rx = 0) => {
    const ry = (fy * plano.cabecaA) / 2
    const a = plano.cabecaL / 2
    const b = plano.cabecaA / 2
    // Meia-largura da elipse naquela altura. O `max` evita raiz de negativo
    // quando a peça é pedida acima do topo da cabeça.
    const meia = a * Math.sqrt(Math.max(0, 1 - (ry / b) ** 2))
    const limite = Math.max(0, meia - rx)
    const bruto = (fx * plano.cabecaL) / 2
    const x = Math.sign(bruto) * Math.min(Math.abs(bruto), limite)
    return [
      cabecaCX + x * Math.cos(ca) - ry * Math.sin(ca),
      cabecaCY + x * Math.sin(ca) + ry * Math.cos(ca),
    ]
  }

  // ----------------------------------------------------------- sombra
  // Encolhe conforme ele sobe. É o único jeito de a altura ser LEGÍVEL: sem
  // sombra que responde, pulo e voo viram o sprite deslizando pra cima.
  const alturaDoChao = Math.max(0, ANCHAO - (corpoCY + corpoA))
  const solta = clamp(alturaDoChao / (pernaA * 2.6), 0, 1)
  p.fillPoly(
    // A sombra ficava 3 unidades ABAIXO do chao — 3 px na caixa pequena, mas 11
    // px com o bichinho grande, e aparecia um vao entre a pata e a sombra. Ela
    // tem que nascer na linha em que ele pisa.
    elipse(ANCX, ANCHAO + 1 * plano.escala, plano.corpoL * (1 - solta * 0.45) * 0.5,
      Math.max(1.2 * e, 3.4 * plano.escala) * (1 - solta * 0.4), 0, 14),
    `rgba(51,32,58,${(0.2 - solta * 0.1).toFixed(3)})`
  )

  // ----------------------------------------------------------- as camadas
  const fundo = []    // o que está do outro lado do corpo
  const orelhas = []  // apêndices: precisam de contorno PRÓPRIO (ver abaixo)
  const corpo = []    // o bicho em si — tudo aqui é uma carne só, sem emenda
  const frente = []   // o que passa por cima dele

  /** Perna de dois ossos com o joelho resolvido por cinemática inversa. */
  const perna = (lista, base, pe, cor, dobra, curta) => {
    const l = pernaA * (curta ? 0.48 : 0.55)
    const alvoX = base[0] + pe.x * plano.escala
    const alvoY = Math.min(ANCHAO, base[1] + pernaA + pe.y * plano.escala)
    const [jx, jy] = ik2(base[0], base[1], alvoX, alvoY, l, l, dobra)
    // A coxa é mais grossa que a canela: perna de espessura constante é a
    // segunda coisa que faz um bicho parecer de brinquedo (a primeira é ela
    // não dobrar).
    lista.push({ pts: capsula(base[0], base[1], jx, jy, Math.max(1 * e, plano.pernaE * 1.05), Math.max(0.8 * e, plano.pernaE * 0.72)), fill: cor })
    lista.push({ pts: capsula(jx, jy, alvoX, alvoY, Math.max(0.9 * e, plano.pernaE * 0.68), Math.max(0.7 * e, plano.pernaE * 0.5)), fill: cor })
    // patinha achatada, virada pra frente
    lista.push({ pts: elipse(alvoX + 1.5 * e, alvoY - 1 * e, plano.pernaE * 1.15, plano.pernaE * 0.6, 0, 10), fill: cor })
    return [alvoX, alvoY]
  }

  /** Asa. Fica numa camada própria, senão fundiria com o tronco. */
  const asa = (lista, cor, frenteDele) => {
    if (!plano.asa) return
    const abrir = lerp(0.3, 1, q.asaAbrir)
    const env = plano.corpoL * 0.95 * abrir * plano.asaF
    const alt = plano.corpoA * 1.25 * plano.asaF
    const a = q.asaAng * (frenteDele ? 1 : 0.86)
    const ox = corpoCX - (frenteDele ? 1 : 4) * e
    const oy = corpoCY - corpoA * 0.45 - (frenteDele ? 0 : 2) * e
    // A ASA VIVIA PRA CIMA porque o angulo dela passava por dentro de um seno
    // que ja estava perto do pico. `sin(0.9 + a)`, com `a` indo de -1,15 a
    // +1,15, percorre 0,9 -> 2,05 radianos — e o pico do seno (1,57) esta bem
    // no meio disso. Resultado: em TODA a metade de cima da batida o valor mal
    // saia de 0,8, a ponta quase nao se mexia, e so no extremo de baixo ela
    // desabava. Lido na tela, isso e uma asa parada la em cima com um tranco.
    //
    // O conserto e nao usar o seno como curva de controle: `a` vira o ANGULO de
    // elevacao da asa, e a ponta gira em torno do ombro. A batida passa a subir
    // e descer a mesma coisa dos dois lados.
    const elev = 0.15 + a * 0.75
    const px1 = ox - env * Math.cos(elev)
    const py1 = oy - alt * Math.sin(elev)
    if (plano.asa === 'membrana') {
      lista.push({
        pts: [
          [ox + 3 * e, oy], [px1 + 4 * e, py1 - 2 * e], [px1 - 3 * e, py1 + alt * 0.35],
          [ox - env * 0.55, oy + alt * 0.3 + a * 3 * e],
          [ox - env * 0.22, oy + alt * 0.16], [ox - 1 * e, oy + 3 * e],
        ],
        fill: cor,
      })
    } else {
      for (let i = 0; i < 3; i++) {
        const f = 1 - i * 0.2
        lista.push({
          pts: capsula(
            ox + (1 - i * 2) * e, oy + i * 2.2 * e,
            px1 * f + ox * (1 - f), py1 * f + oy * (1 - f) + i * 2.4 * e,
            plano.corpoA * 0.19, plano.corpoA * 0.1
          ),
          fill: i === 0 ? cor : mix(cor, '#3b2a33', 0.18),
        })
      }
    }
  }

  /** Cauda. Vai no fundo: ela sai POR TRÁS da anca. */
  const cauda = (lista) => {
    if (plano.cauda === 'toco') {
      const [bx, by] = noCorpo(-0.92, -0.15)
      lista.push({ pts: elipse(bx - 1 * e, by, plano.caudaL * 0.55, plano.caudaL * 0.5, 0, 10), fill: shade(principal, -0.12) })
      return
    }
    if (plano.cauda === 'pompom') {
      const [bx, by] = noCorpo(-0.94, -0.1)
      const bal = Math.sin(q.caudaOnda) * q.caudaAmp
      lista.push({ pts: elipse(bx - 2 * e + bal, by - 1 * e, plano.caudaL * 0.66, plano.caudaL * 0.62, 0, 12), fill: claro })
      return
    }
    if (plano.cauda === 'leque') {
      const [bx, by] = noCorpo(-0.88, 0.1)
      // Leque de verdade: as penas ABREM em ângulo e afinam na ponta. Empilhadas
      // quase paralelas (como estavam) elas se sobrepõem e viram uma tábua saindo
      // do passarinho — o defeito só ficou visível depois que a cápsula passou a
      // preencher o miolo.
      const a = q.caudaAng - 0.25 + Math.sin(q.caudaOnda) * q.caudaAmp * 0.18
      for (let i = -1; i <= 1; i++) {
        const aa = a + i * 0.5
        const comp = plano.caudaL * (i === 0 ? 1 : 0.84)
        lista.push({
          pts: capsula(bx, by, bx - Math.cos(aa) * comp, by + Math.sin(aa) * comp * 0.75,
            plano.corpoA * 0.11, plano.corpoA * 0.05),
          fill: i === 0 ? escuro : longe,
        })
      }
      return
    }
    // Cauda em corrente: cada elo herda o ângulo do anterior mais a onda, com
    // ATRASO. É o atraso que faz a ponta chicotear DEPOIS da base — cauda em que
    // tudo se move junto parece um pedaço de arame.
    const n = plano.caudaSeg
    const passoSeg = plano.caudaL / n
    let [x, y] = noCorpo(-0.86, -0.36)
    // A cauda nasce pra CIMA e pra trás, e vai se curvando por cima da anca.
    // Saindo na horizontal (como saía) ela vira o prolongamento do tronco, e é
    // justamente essa linha reta comprida que faz um gato ler como réptil.
    //
    // O sinal de `caudaAng` importa: positivo ABAIXA (rabo entre as pernas, no
    // triste e no doente), negativo LEVANTA (correndo, brincando). Com o sinal
    // trocado, o bichinho corria de rabo caído e ficava triste de rabo em pé.
    // A CAUDA SAIA QUASE EM PE e ia ficando mais vertical a cada elo: comecava
    // a 144 graus e o `a -= 0,075` de cada segmento a levava pra perto dos 119.
    // Uma peca grossa, comprida e quase vertical passando por cima das costas
    // nao le como cauda — le como braco levantado, e era isso que dava ao gato
    // aquele ar de bicho em pe. Agora ela sai quase pra tras (166 graus) e SO A
    // PONTA sobe, que e a curva de uma cauda de verdade.
    let a = Math.PI * 0.92 + q.caudaAng
    for (let i = 0; i < n; i++) {
      // A curvatura CRESCE do inicio pro fim: os primeiros elos quase nao
      // viram (a cauda sai reta pra tras) e os ultimos e que levantam.
      a -= (0.02 + 0.10 * (i / n)) - Math.sin(q.caudaOnda - i * 0.7) * q.caudaAmp * 0.3
      const nx = x + Math.cos(a) * passoSeg
      const ny = y - Math.sin(a) * passoSeg
      // A cauda AFINA de verdade da base pra ponta. Antes ela mantinha quase a
      // mesma grossura e virava um cabo saindo do bicho.
      // 0,22 da altura do corpo e a grossura de uma PERNA. Cauda de gato e
      // fina; grossa assim, ela competia com o corpo e reforcava a leitura de
      // "braco". Os pisos tambem passaram a acompanhar a escala, senao em
      // resolucao alta a ponta virava um fio.
      const r1 = Math.max(1.0 * e, plano.corpoA * 0.15 * (1 - i / (n + 0.9)))
      const r2 = Math.max(0.8 * e, plano.corpoA * 0.15 * (1 - (i + 1) / (n + 0.9)))
      lista.push({ pts: capsula(x, y, nx, ny, r1, r2), fill: shade(principal, -0.13) })
      if (plano.cauda === 'espinho' && i > 0) {
        lista.push({
          pts: [[nx, ny - r2 - 3.5 * e], [nx - 2.5 * e, ny - r2 + 0.5 * e], [nx + 2.5 * e, ny - r2 + 0.5 * e]],
          fill: pal.detalhe,
        })
      }
      x = nx
      y = ny
    }
    if (plano.cauda === 'longa') {
      corpo.push({ pts: elipse(x, y, 2.3 * e, 2.3 * e, 0, 8), fill: pal.marca })  // pontinha
    }
  }

  // ------------------------------------------------------- monta o fundo
  asa(fundo, mix(pal.asa, '#3b2a33', 0.3), false)
  cauda(fundo)
  if (!bipede) {
    perna(fundo, quadril, q.pes[0], longe, -1, false)
    perna(fundo, ombro, q.pes[1], longe, 1, false)
  }

  // ------------------------------------------------------- monta o corpo
  //
  // Peito, barriga e garupa se sobrepõem. Como estão na MESMA camada, os
  // contornos internos somem no segundo passe e as três viram um tronco só —
  // com a linha das costas afundando no meio, que é o desenho de um quadrúpede.
  if (bipede) {
    corpo.push({ pts: elipse(corpoCX, corpoCY, corpoL, corpoA, ang, 18), fill: principal })
  } else {
    corpo.push({ pts: elipse(...noCorpo(-0.34, 0.02), corpoL * 0.52, corpoA * 0.98, ang, 16), fill: principal })
    corpo.push({ pts: elipse(...noCorpo(0.0, 0.10), corpoL * 0.62, corpoA * 0.80, ang, 16), fill: principal })
    corpo.push({ pts: elipse(...noCorpo(0.32, 0.0), corpoL * 0.54, corpoA * 1.0, ang, 16), fill: principal })
  }

  // pescoço curto: só o bastante pra ligar peito e cabeça
  corpo.push({
    pts: capsula(pescocoBase[0], pescocoBase[1], cabecaCX - plano.cabecaL * 0.12,
      cabecaCY + plano.cabecaA * 0.32, plano.cabecaA * 0.36, plano.cabecaA * 0.34),
    fill: principal,
  })

  // patas da frente, na mesma camada do corpo — coxa e barriga são a mesma carne
  let peFrente = null
  if (!bipede) {
    perna(corpo, quadril, q.pes[2], shade(principal, -0.09), -1, false)
    peFrente = perna(corpo, ombro, q.pes[3], principal, 1, false)
  } else {
    perna(corpo, [ombro[0] - 2 * e, ombro[1]], q.pes[0], shade(pal.detalhe, -0.2), 1, true)
    peFrente = perna(corpo, [ombro[0] + 2 * e, ombro[1]], q.pes[1], pal.detalhe, 1, true)
  }

  // ORELHA TEM CAMADA PRÓPRIA, e isso não é detalhe de organização.
  //
  // Elas estavam junto do crânio, na camada do corpo. Como a camada inteira é
  // pintada sem emenda por dentro (é o conserto da articulação costurada), a
  // orelha perdia o contorno contra a cabeça e **desaparecia**: no coelho, que é
  // branco sobre branco, sumiu por completo — ele ficou sem orelha nenhuma, que
  // foi exatamente o que o dono viu.
  //
  // A regra que sai disso: junção de CARNE (coxa/barriga, pescoço/peito) é pra
  // ser sem emenda; APÊNDICE que se destaca da silhueta (orelha) precisa do
  // próprio traço, e por isso vai numa camada atrás — o crânio pinta por cima e
  // sobra o contorno da parte que passa dele.
  const oa = q.orelhaAng
  if (plano.orelha === 'triangulo') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.5, -0.74)
      const alt = plano.cabecaA * 0.74 * plano.orelhaF
      const pt = [bx + Math.sin(oa) * alt * lado * 0.4 - lado * 1.5 * e, by - Math.cos(oa) * alt]
      // A BASE DA ORELHA MEDIA 8,4 px FIXOS. Enquanto a caixa foi sempre 128x108
      // isso passou; desenhando o bichinho em resolucao maior, a cabeca triplica
      // e a orelha continua com a mesma base — vira uma agulha. E agulha some no
      // contorno: o traco (que agora acompanha a escala) e pintado em quatro
      // copias deslocadas, e numa peca fina elas cobrem quase todo o miolo. O
      // preenchimento so sobra num fiozinho no meio, e a PONTA, que afina ate
      // zero, fica so de traco. Era esse o "orelha apagada na ponta".
      orelhas.push({
        pts: [[bx - 4.2 * e, by + 3 * e], pt, [bx + 4.2 * e, by + 2 * e]],
        fill: lado < 0 ? shade(principal, -0.12) : principal,
      })
    }
  } else if (plano.orelha === 'caida') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.76, -0.5)
      const comp = plano.cabecaA * 0.9 * plano.orelhaF
      orelhas.push({
        pts: capsula(bx, by, bx + lado * 2 + Math.sin(oa) * comp * 0.55, by + Math.cos(oa * 0.5) * comp,
          plano.cabecaL * 0.17, plano.cabecaL * 0.21),
        fill: lado < 0 ? longe : escuro,
      })
    }
  } else if (plano.orelha === 'longa') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.3, -0.78)
      // 1,95x a altura da cabeca era orelha de lebre, nao de coelho de desenho:
      // ela dominava o bicho inteiro e puxava o olhar pra longe do rosto.
      const comp = plano.cabecaA * 1.45 * plano.orelhaF
      const incl = oa + lado * 0.16
      // A ponta e quase tao larga quanto a base (0,17 -> 0,15). Afinando muito,
      // ela desaparecia dentro do proprio contorno — o mesmo defeito da orelha
      // de gato, so que aqui em cima de uma peca comprida, onde da mais na vista.
      orelhas.push({
        pts: capsula(bx, by, bx + Math.sin(incl) * comp, by - Math.cos(incl) * comp,
          plano.cabecaL * 0.19, plano.cabecaL * 0.15),
        fill: lado < 0 ? shade(principal, -0.14) : principal,
      })
    }
  } else if (plano.orelha === 'redonda') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.62, -0.58)
      orelhas.push({ pts: elipse(bx, by - 1, plano.cabecaL * 0.17, plano.cabecaL * 0.17, 0, 10), fill: lado < 0 ? longe : escuro })
    }
  } else if (plano.orelha === 'chifre') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.46, -0.76)
      const alt = plano.cabecaA * 0.58 * plano.orelhaF
      orelhas.push({
        pts: [[bx - 2.4 * e, by + 2 * e], [bx + (1 + lado) * e, by - alt], [bx + 3 * e, by + 1.5 * e]],
        fill: pal.detalhe,
      })
    }
  }

  // crânio e focinho, também na mesma carne
  corpo.push({ pts: elipse(cabecaCX, cabecaCY, plano.cabecaL / 2, plano.cabecaA / 2, ca, 16), fill: principal })
  const [fx, fy] = naCabeca(0.8, 0.34)
  if (plano.bico) {
    corpo.push({ pts: [[fx - 2 * e, fy - 3.5 * e], [fx + plano.focinho, fy + 0.4 * e], [fx - 2 * e, fy + 3.5 * e]], fill: pal.detalhe })
  } else if (plano.focinho > 1.2) {
    // Focinho CURTO e colado no crânio. Comprido e projetado é bico de réptil.
    corpo.push({
      pts: elipse(fx + plano.focinho * 0.26, fy + 0.8, plano.focinho * 0.62, plano.focinho * 0.46, ca, 12),
      fill: principal,
    })
  }

  asa(frente, pal.asa, true)

  // ------------------------------------------------------- pinta tudo
  desenharCamada(p, fundo, traco)
  desenharCamada(p, orelhas, traco)
  desenharCamada(p, corpo, traco)
  desenharCamada(p, frente, traco)

  // ------------------------------------------------------- volume e marcas
  // Sem contorno: são sombra e luz DENTRO da silhueta que acabou de ser fechada.
  const [bax, bay] = noCorpo(-0.05, 0.42)
  p.fillPoly(elipse(bax, bay, corpoL * 0.62, corpoA * 0.4, ang, 14), claro)
  const [cox, coy] = noCorpo(0.08, -0.5)
  p.ditherPoly(elipse(cox, coy, corpoL * 0.55, corpoA * 0.3, ang, 14), mix(principal, '#fffaf2', 0.3), 2)
  p.ditherPoly(elipse(cabecaCX + 1 * e, cabecaCY - plano.cabecaA * 0.26, plano.cabecaL * 0.32, plano.cabecaA * 0.2, ca, 12),
    mix(principal, '#fffaf2', 0.3), 2)

  if (plano.marca === 'escamas') {
    for (let i = -2; i <= 2; i++) {
      const [ex, ey] = noCorpo(i * 0.3, 0.34)
      p.fillPoly(elipse(ex, ey, 2.3 * e, 1.5 * e, 0, 8), pal.marca)
    }
  } else if (plano.marca === 'manchas') {
    const [mx, my] = noCorpo(-0.36, -0.12)
    p.fillPoly(elipse(mx, my, corpoL * 0.2, corpoA * 0.28, ang, 10), pal.marca)
  } else if (plano.marca === 'peito') {
    const [px2, py2] = noCorpo(0.24, 0.2)
    p.fillPoly(elipse(px2, py2, corpoL * 0.3, corpoA * 0.46, ang, 12), claro)
  }
  if (plano.cauda === 'espinho') {
    for (let i = -2; i <= 1; i++) {
      const [sx, sy] = noCorpo(i * 0.3, -0.9)
      p.fillPoly([[sx, sy - 4], [sx - 2.4, sy + 0.5], [sx + 2.4, sy + 0.5]], pal.detalhe)
    }
  }
  // orelha por dentro, depois do crânio fechado
  if (plano.orelha === 'triangulo') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.5, -0.74)
      const alt = plano.cabecaA * 0.74 * plano.orelhaF
      const pt = [bx + Math.sin(oa) * alt * lado * 0.4 - lado * 1.5, by - Math.cos(oa) * alt]
      p.fillPoly([[bx - 1.6 * e, by + 2 * e], [pt[0], pt[1] + 4 * e], [bx + 2 * e, by + 1.6 * e]], '#e8879b')
    }
  } else if (plano.orelha === 'longa') {
    for (const lado of [-1, 1]) {
      const [bx, by] = naCabeca(lado * 0.3, -0.78)
      const comp = plano.cabecaA * 1.95 * plano.orelhaF
      const incl = oa + lado * 0.16
      const ex = bx + Math.sin(incl) * comp
      const ey = by - Math.cos(incl) * comp
      // O rosa PARA ANTES DA PONTA (vai de 30% a 76% da orelha) e e estreito.
      // Indo ate a ponta, ele cobria justamente a parte que ja tinha pouco
      // preenchimento e a orelha virava uma listra rosa com a borda apagada.
      // Ficar dentro deixa a orelha com miolo, borda e ponta cheia.
      const rosaR = plano.cabecaL * 0.075
      p.fillPoly(
        capsula(
          bx + (ex - bx) * 0.30, by + (ey - by) * 0.30,
          bx + (ex - bx) * 0.76, by + (ey - by) * 0.76,
          rosaR, rosaR * 0.8,
        ),
        '#e8879b',
      )
    }
  }

  // ------------------------------------------------------- rosto
  //
  // OS OLHOS NAO PODEM SE CRUZAR, e por isso a posicao deles sai do TAMANHO.
  //
  // Eles ficavam em duas fracoes fixas da cabeca (0.1 e 0.58) enquanto o raio
  // vinha de outra conta, que nao sabia da primeira. Na cabeca de filhote — que
  // e proporcionalmente MAIOR e ainda por cima tem o olho aumentado, que e o
  // que da cara de bebe — os dois brancos se encontravam no meio da cara e
  // viravam UMA mancha branca com dois pontos dentro. Era isso o "olhos se
  // sobrepondo", e acontecia em toda escala: no gato adulto os brancos ja
  // encostavam, no filhote se cruzavam fundo.
  //
  // Agora existe uma conta so: o raio manda, a meia-distancia entre os centros
  // e o raio do branco mais uma folga, e o teto garante que o par inteiro cabe
  // na testa. Assim eles nunca se cruzam, cresca o olho o quanto crescer — e o
  // filhote continua de olho grande, so que mais afastado, que e exatamente o
  // que se ve num rosto de bebe.
  const FOLGA_OLHOS = 1.2 * e          // o vao entre os dois brancos
  const testa = plano.cabecaL * 0.80   // o quanto da cabeca o par pode ocupar
  const rQuerido = Math.max(1.2 * e, 2.3 * plano.olho * lerp(0.9, 1, plano.g))
  // 2 brancos + o vao tem que caber em `testa`; o branco mede r + 0.9e
  const rTeto = (testa - FOLGA_OLHOS) / 4 - 0.9 * e
  const r = Math.max(1.0 * e, Math.min(rQuerido, rTeto))
  const meiaOlhos = r + 0.9 * e + FOLGA_OLHOS / 2
  const dFx = meiaOlhos / (plano.cabecaL / 2)
  const [oxE, oyE] = naCabeca(0.16 - dFx, -0.2)
  const [oxD, oyD] = naCabeca(0.16 + dFx, -0.18)
  const olho = (x, y) => {
    if (extra.doente) {
      grossa(p, x - r, y - r, x + r, y + r, traco)
      grossa(p, x + r, y - r, x - r, y + r, traco)
      return
    }
    if (q.olhos < 0.25) { p.rect(x - r, y, r * 2, 1.4 * e, OUT); return }
    if (q.olhos < 0.75) { p.rect(x - r, y - r * 0.4, r * 2, r * 1.1, OUT); return }
    p.fillPoly(elipse(x, y, r + 0.9 * e, r + 1.1 * e, 0, 10), '#ffffff')
    // A PUPILA anda dentro do branco, na direcao do dedo. E o que separa "tem
    // dois olhos desenhados" de "esta olhando pra mim" — e o passo que faz o
    // toque parecer conversa em vez de botao.
    const pdx = mira ? mira.dx * r * 0.42 : 0
    const pdy = mira ? mira.dy * r * 0.34 : 0
    p.fillPoly(elipse(x + pdx, y + 0.3 * e + pdy, r * 0.78, r * 0.95, 0, 10), OUT)
    p.rect(x + pdx - r * 0.5, y + pdy - r * 0.7, 1.6 * e, 1.6 * e, '#ffffff')   // brilho: o olhar acende
  }
  olho(oxE, oyE)
  olho(oxD, oyD)

  // focinheira: o narizinho fecha a leitura de mamífero
  if (!plano.bico) {
    const narizRx = Math.min(2.4 * e, plano.cabecaL * 0.11)
    const [nx, ny] = noRosto(0.78, 0.24, narizRx)
    p.fillPoly(elipse(nx, ny, narizRx, Math.min(1.7 * e, plano.cabecaA * 0.08), 0, 10), OUT)
    p.rect(nx - narizRx * 0.42, ny - narizRx * 0.42, Math.max(1, e), Math.max(1, e),
      mix(principal, '#fffaf2', 0.5))
  }

  // ---------------------------------------------------------------- a boca
  //
  // A MEDIDA SAI DA CABECA, e nao da escala solta. Este e o mesmo defeito que
  // os olhos tinham antes da 9.11 — "ficavam em duas fracoes fixas da cabeca
  // enquanto o raio saia de outra conta, que nao sabia da primeira" — e ele
  // sobreviveu ali na boca porque a lista daquela rodada (orelha, chifre, bico,
  // cauda, pata, asa, espinho, marca, sombra) nao incluiu ela.
  //
  // O estrago aparecia no COELHO, que e quem tem a cabeca menor em relacao ao
  // corpo (as orelhas comem o resto do tamanho): a boca aberta, com raio de
  // 3,1 unidades de escala, ficava maior do que o espaco que sobrava do
  // focinho ate a borda — e, ancorada em 0,62 da meia-largura, ela VAZAVA PRA
  // FORA do rosto. Na tela isso lia como uma bolha rosa grudada na lateral da
  // cara, e foi isso que o dono chamou de "a lingua continua bugada": a lingua
  // que ele via nao era a da lambida no vidro, era a boca aberta escapando do
  // rosto durante as animacoes de comer, brincar e lamber-se.
  //
  // Agora o raio tem TETO pela cabeca, e a ancora recua o quanto for preciso
  // pra boca inteira caber. Nao ha como ela sair do rosto, cresca a escala o
  // quanto crescer.
  const bocaRx = Math.min(3.1 * e, plano.cabecaL * 0.15)
  const bocaRy = Math.min(2.5 * e, plano.cabecaA * 0.13)
  const [bmx, bmy] = noRosto(0.62, 0.58, bocaRx)
  // O traco tambem: uma boca fechada de 3,6 unidades de cada lado estourava
  // pelo mesmo motivo, so que sem cor pra chamar atencao.
  const bw = Math.min(3.6 * e, plano.cabecaL * 0.17)

  if (q.boca === 'aberta') {
    p.fillPoly(elipse(bmx, bmy + bocaRy * 0.4, bocaRx, bocaRy, 0, 10), '#a2495a')
    // A lingua: sempre menor que a boca e presa ao fundo dela, pra nunca
    // aparecer sozinha se a boca encolher.
    p.fillPoly(
      elipse(bmx + bocaRx * 0.16, bmy + bocaRy * 0.8, bocaRx * 0.55, bocaRy * 0.44, 0, 8),
      '#e8879b'
    )
  } else if (q.boca === 'triste') {
    grossa(p, bmx - bw, bmy + 1.6 * e, bmx, bmy - 0.4 * e, traco)
    grossa(p, bmx, bmy - 0.4 * e, bmx + bw, bmy + 1.6 * e, traco)
  } else if (q.boca === 'reta') {
    p.rect(bmx - bw * 0.85, bmy, bw * 1.7, Math.max(1, traco), OUT)
  } else {
    grossa(p, bmx - bw, bmy - 0.6 * e, bmx - bw * 0.28, bmy + 1.4 * e, traco)
    grossa(p, bmx - bw * 0.28, bmy + 1.4 * e, bmx + bw * 0.44, bmy - 1 * e, traco)
    grossa(p, bmx + bw * 0.44, bmy - 1 * e, bmx + bw, bmy + 0.4 * e, traco)
  }

  if (extra.bochechas) {
    // A da direita era a pior: em 0,80 da meia-largura, numa altura em que a
    // elipse já estreitou, ela saía inteira pra fora do rosto.
    const rE = Math.min(2.5 * e, plano.cabecaL * 0.12)
    const rD = Math.min(2.3 * e, plano.cabecaL * 0.11)
    const [cxE, cyE] = noRosto(0.02, 0.42, rE)
    const [cxD, cyD] = noRosto(0.8, 0.46, rD)
    p.fillPoly(elipse(cxE, cyE, rE, rE * 0.6, 0, 8), '#e8879b')
    p.fillPoly(elipse(cxD, cyD, rD, rD * 0.61, 0, 8), '#e8879b')
  }
  if (plano.marca === 'bigode') {
    const [wx, wy] = naCabeca(0.72, 0.36)
    for (let i = -1; i <= 1; i++) grossa(p, wx + 2 * e, wy + i * 2 * e, wx + 9 * e, wy + (i * 3.2 - 1) * e, Math.max(1, traco * 0.7), mix(principal, '#3b2a33', 0.45))
  }

  // Âncoras devolvidas pra quem precisa pendurar coisa no bichinho: acessório na
  // cabeça, coleira no pescoço, o osso na boca. Sem isto, cada chamador teria
  // que refazer a conta da pose — e o chapéu ficaria flutuando quando ele deita.
  return {
    cabeca: [cabecaCX, cabecaCY],
    cabecaAng: ca,
    cabecaL: plano.cabecaL,
    cabecaA: plano.cabecaA,
    corpo: [corpoCX, corpoCY],
    corpoL: corpoL * 2,
    corpoA: corpoA * 2,
    pescoco: pescocoBase,
    focinho: [fx, fy],
    peFrente,
    solta,
    naCabeca,
    noCorpo,
  }
}
