// A voz dos bichinhos — sintetizada, sem nenhum arquivo de áudio.
//
// ------------------------------------------------------- por que foi refeita
//
// A versão anterior já tinha as peças certas (fonte harmônica, ruído, formantes)
// e mesmo assim o dono ouviu e disse que "não se parecem nem um pouco com eles".
// Ele está certo, e o motivo não é falta de peça: é que **as peças estavam
// paradas**. Um som de bicho é uma coisa que MUDA enquanto acontece; o que saía
// aqui era uma nota com um envelope caindo por cima. Quatro defeitos, e todos
// eram de MOVIMENTO:
//
//   1. **O envelope não tinha corpo.** Ele subia num ataque e caía
//      exponencialmente até o fim, sem sustentação nenhuma. Isso é a assinatura
//      de um bipe de micro-ondas, não de um bicho: um miado se SEGURA no ar por
//      meio segundo antes de morrer, e um latido é o contrário — estoura e corta.
//      Com o mesmo formato de envelope pra todo mundo, os seis soavam parentes
//      por baixo, por mais que a frequência mudasse.
//
//   2. **Só o primeiro formante se mexia.** A boca de um bicho não abre num eixo
//      só. O que faz um miado ser reconhecido como "mi-a-ow" é F1 e F2 andando em
//      direções OPOSTAS: a boca abre (F1 sobe) e ao mesmo tempo arredonda (F2
//      desce). Com F2 cravado, o som varre de fechado pra aberto e volta sempre
//      pela mesma vogal — e vogal única é o que faz uma voz soar sintetizada.
//
//   3. **O jitter estava fazendo o papel errado.** Ele era sorteado em 40 pontos
//      ao longo da sílaba inteira, o que dá um tremor a umas 70 vezes por segundo
//      — isso não é jitter, é modulação de frequência, e o ouvido lê modulação de
//      frequência nessa faixa como "eletrônico". Voz de bicho tem DUAS coisas
//      diferentes por cima da nota: um vibrato lento e regular (5 a 8 Hz, que é o
//      que soa vivo) e um jitter fino e irregular (que é o que soa carnudo).
//      Agora são dois osciladores separados, e o jitter é lento o bastante pra
//      não virar apito.
//
//   4. **Faltava rugosidade.** Rosnado e grunhido não são "nota grave com ruído":
//      são a fonte PULSANDO, ligando e desligando dezenas de vezes por segundo.
//      Isso é modulação de amplitude, e sem ela o dragão era um zumbido de
//      transformador e a capivara um apito abafado. É a peça que estava faltando
//      pros dois graves, e ela não existia em lugar nenhum no arquivo antigo.
//
// ------------------------------------------------------------------ o modelo
//
// O desenho continua sendo o do `soundgen` (síntese paramétrica de vocalização),
// agora com as quatro coisas acima:
//
//   fonte harmônica ─┐
//                    ├─► envelope ADSR ─► rugosidade (AM) ─► F1 ─► F2 ─► F3 ─► saída
//   fonte de ruído ──┘        ▲                                ▲     ▲
//                             │                                └──┬──┘
//                    vibrato + jitter                     trajetória de boca
//                    somados na altura
//
// Nada disso baixa arquivo, e por isso continua funcionando no iPhone com o
// AudioContext criado só no primeiro toque, que é a regra do Safari.

/**
 * A receita de cada espécie.
 *
 * Campos:
 *   `silabas`   — cada sílaba tem duração, força, o contorno de altura DELA
 *                 (`f0`, em Hz, lido como pontos igualmente espaçados) e o
 *                 envelope. Sílabas com contornos diferentes é o que faz uma
 *                 sequência soar como um bicho falando em vez de um eco.
 *   `env`       — ataque, decaimento, nível de sustentação e release, em fração
 *                 da duração. É a forma do som no tempo, e ela é DIFERENTE por
 *                 espécie: é aí que mora "estouro" contra "chamado".
 *   `formantes` — [frequência base, Q, ganho em dB].
 *   `boca`      — trajetória dos dois primeiros formantes ao longo da sílaba,
 *                 como multiplicadores da frequência base. `f1` e `f2` andando
 *                 em direções opostas é o que desenha uma vogal mudando.
 *   `rugosidade`— { hz, prof }: a fonte pulsando. 0 de profundidade = liso.
 *   `vibrato`   — { hz, prof }: tremor lento e regular, em fração da altura.
 *   `jitter`    — tremor fino e irregular, em fração da altura.
 */
export const VOZES = {
  gato: {
    // MIADO. O som se segura no ar (sustentação alta, release longo) e a boca
    // faz o caminho fechado → aberto → arredondado, que é o "mi-a-ow". F1 sobe
    // enquanto F2 desce: é esse cruzamento que o ouvido lê como miado, e era
    // exatamente ele que faltava.
    nome: 'miado',
    onda: 'sawtooth',
    // Mais baixo que a conta ingenua pediria: a altura do miado varre POR CIMA
    // do primeiro formante no meio do som, e quando ela cruza a ressonancia o
    // volume dispara. E o "mi-AAA-ow", e e pra ser assim — mas medido na
    // bancada ele saia com quase o dobro da energia dos outros cinco.
    volume: 0.085,
    formantes: [[780, 5, 15], [1900, 7, 10], [3100, 5, 4]],
    boca: { f1: [0.62, 1.35, 1.15, 0.72], f2: [1.28, 1.0, 0.82, 0.7] },
    ruido: { qtd: 0.05, corte: 5 },
    rugosidade: { hz: 0, prof: 0 },
    vibrato: { hz: 6.2, prof: 0.022 },
    jitter: 0.014,
    silabas: [
      { dur: 0.62, forca: 1, f0: [540, 720, 850, 790, 640, 450],
        env: { a: 0.10, d: 0.16, s: 0.72, r: 0.42 } },
    ],
  },

  cachorro: {
    // LATIDO. O oposto do miado em tudo: ataque quase instantâneo, sustentação
    // baixa, release curto — estoura e some. O ruído é alto e o corpo é curto;
    // são dois, e o segundo sai um pouco mais grave e mais fraco, que é como um
    // cachorro late de verdade (o primeiro é o susto, o segundo é o eco dele).
    nome: 'latido',
    onda: 'sawtooth',
    volume: 0.15,
    formantes: [[560, 3.5, 16], [1450, 4.5, 11], [2500, 3, 4]],
    boca: { f1: [0.85, 1.55, 0.95, 0.6], f2: [0.9, 1.15, 0.85, 0.7] },
    // O corte baixo do ruido e o que separa o latido do miado na medicao — e
    // no ouvido. A bancada reprovou os dois a 4% de distancia na primeira
    // rodada desta correcao: o gato tinha descido pra faixa real do miado e o
    // cachorro estava sendo puxado pra cima por um ruido de banda larga, que e
    // chiado de "s", nao o "wuf" abafado de peito que um cachorro faz.
    ruido: { qtd: 0.45, corte: 2.4 },
    rugosidade: { hz: 0, prof: 0 },
    vibrato: { hz: 0, prof: 0 },
    jitter: 0.03,
    silabas: [
      { dur: 0.16, forca: 1, f0: [430, 360, 250, 175],
        env: { a: 0.02, d: 0.3, s: 0.35, r: 0.3 } },
      { dur: 0.14, forca: 0.78, f0: [370, 310, 215, 155],
        env: { a: 0.02, d: 0.3, s: 0.3, r: 0.3 } },
    ],
  },

  coelho: {
    // GUINCHO. Coelho quase não vocaliza: quando vocaliza é um som agudíssimo,
    // curto e apertado, quase sem boca (a trajetória mal se mexe — a garganta
    // dele é pequena demais pra fazer vogal). Fica bem mais agudo que o gato de
    // propósito: a bancada já reprovou os dois a 12% de distância.
    nome: 'guincho',
    onda: 'triangle',
    volume: 0.075,
    formantes: [[2400, 10, 13], [4100, 8, 6]],
    boca: { f1: [0.95, 1.15, 0.9], f2: [1.0, 1.05, 0.95] },
    ruido: { qtd: 0.08, corte: 3 },
    rugosidade: { hz: 0, prof: 0 },
    vibrato: { hz: 11, prof: 0.04 },
    jitter: 0.025,
    silabas: [
      { dur: 0.12, forca: 1, f0: [1300, 1900, 2050, 1650],
        env: { a: 0.05, d: 0.2, s: 0.55, r: 0.35 } },
      { dur: 0.10, forca: 0.65, f0: [1250, 1750, 1450],
        env: { a: 0.05, d: 0.2, s: 0.5, r: 0.35 } },
    ],
  },

  passaro: {
    // PIADO. Som quase puro e uma sequência de notas com contornos DIFERENTES —
    // é a variação entre as notas que soa como pássaro; três notas iguais soam
    // como alarme. Uma varre pra cima, outra desce, a última é um trinado curto.
    nome: 'piado',
    onda: 'sine',
    volume: 0.065,
    formantes: [[3200, 11, 11], [4800, 9, 5]],
    boca: { f1: [1.0, 1.1, 1.0], f2: [1.0, 1.0, 1.0] },
    ruido: { qtd: 0.02, corte: 3 },
    // A rugosidade rápida e rasa é o trinado — não chega a virar rosnado nessa
    // frequência, vira brilho.
    rugosidade: { hz: 42, prof: 0.28 },
    vibrato: { hz: 14, prof: 0.03 },
    jitter: 0.01,
    silabas: [
      { dur: 0.10, forca: 1, f0: [2300, 3400, 3100],
        env: { a: 0.07, d: 0.15, s: 0.7, r: 0.3 } },
      { dur: 0.08, forca: 0.85, f0: [3400, 2600],
        env: { a: 0.07, d: 0.15, s: 0.65, r: 0.3 } },
      { dur: 0.13, forca: 0.9, f0: [2700, 3600, 2900, 3500],
        env: { a: 0.07, d: 0.2, s: 0.6, r: 0.35 } },
    ],
  },

  capivara: {
    // GRUNHIDO. Capivara é um bicho GRANDE, e bicho grande fala grave: a altura
    // real fica na casa dos 130–200 Hz, não nos 300 que estavam aqui. O som dela
    // é pulsado — uma sequência de estalos rápidos que o ouvido junta —, e é a
    // rugosidade que faz isso. Sem ela, isto aqui era um apito abafado.
    nome: 'grunhido',
    onda: 'sawtooth',
    volume: 0.13,
    formantes: [[380, 4, 16], [980, 5, 9], [1700, 3, 3]],
    boca: { f1: [0.8, 1.25, 1.0, 0.75], f2: [1.1, 0.95, 0.9, 0.8] },
    ruido: { qtd: 0.22, corte: 6 },
    rugosidade: { hz: 34, prof: 0.55 },
    vibrato: { hz: 4.5, prof: 0.02 },
    jitter: 0.035,
    silabas: [
      { dur: 0.34, forca: 1, f0: [150, 195, 175, 140],
        env: { a: 0.08, d: 0.18, s: 0.7, r: 0.35 } },
      { dur: 0.26, forca: 0.75, f0: [140, 180, 130],
        env: { a: 0.08, d: 0.18, s: 0.65, r: 0.35 } },
    ],
  },

  dragao: {
    // ROSNADO. Grave, longo e RUGOSO: a rugosidade profunda e lenta é o que faz
    // um rosnado ser um rosnado — a fonte liga e desliga umas vinte vezes por
    // segundo, e o ouvido ouve isso como raspagem, não como nota. Muito ruído
    // por cima e um release longo, que é o ar acabando.
    nome: 'rosnado',
    onda: 'sawtooth',
    volume: 0.14,
    formantes: [[260, 3.5, 17], [820, 4.5, 10], [1600, 2.5, 4]],
    boca: { f1: [0.9, 1.3, 1.1, 0.8], f2: [1.05, 0.95, 0.9, 0.82] },
    ruido: { qtd: 0.45, corte: 8 },
    rugosidade: { hz: 21, prof: 0.72 },
    vibrato: { hz: 3.4, prof: 0.025 },
    jitter: 0.05,
    silabas: [
      { dur: 0.85, forca: 1, f0: [72, 88, 80, 92, 66],
        env: { a: 0.06, d: 0.14, s: 0.82, r: 0.3 } },
    ],
  },
}

// Como o humor mexe na voz. São os mesmos três botões que a gente usa sem
// pensar: mais agudo e mais curto = animado; mais grave e mais longo = pra
// baixo; mais ruído e menos volume = sem forças.
//
// `aspereza` entra aqui porque bicho doente fica ROUCO — e rouquidão é
// rugosidade. Ela multiplica a que a espécie já tem; num bicho liso (gato,
// coelho) isso continua zero, e é o certo: gato doente não rosna, fica fraco.
const HUMORES = {
  feliz: { tom: 1.14, tempo: 0.88, ruido: 1, volume: 1.05, aspereza: 0.9 },
  normal: { tom: 1, tempo: 1, ruido: 1, volume: 1, aspereza: 1 },
  triste: { tom: 0.84, tempo: 1.3, ruido: 1.1, volume: 0.8, aspereza: 1.15 },
  doente: { tom: 0.78, tempo: 1.45, ruido: 1.9, volume: 0.62, aspereza: 1.6 },
  bravo: { tom: 0.92, tempo: 0.9, ruido: 1.5, volume: 1.1, aspereza: 1.5 },
}

// O ruído fica guardado com a taxa DELE ao lado, e não dentro do buffer:
// `AudioBuffer.sampleRate` é só de leitura, e escrever nele derruba tudo.
let ruidoGuardado = null
let ruidoTaxa = 0
/** Um segundo de ruído branco, feito uma vez e reaproveitado. */
function bufferDeRuido(ctx) {
  if (ruidoGuardado && ruidoTaxa === ctx.sampleRate) return ruidoGuardado
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  ruidoGuardado = b
  ruidoTaxa = ctx.sampleRate
  return b
}

/** Lê uma lista de pontos como uma curva contínua, em `t` de 0 a 1. */
function emT(pontos, t) {
  if (!pontos || !pontos.length) return 1
  if (pontos.length === 1) return pontos[0]
  const p = Math.min(0.999999, Math.max(0, t)) * (pontos.length - 1)
  const a = Math.floor(p)
  return pontos[a] + (pontos[a + 1] - pontos[a]) * (p - a)
}

/**
 * A curva de altura de uma sílaba.
 *
 * O jitter entra AQUI e de propósito num passo grosso (a curva tem poucos
 * pontos por segundo), porque tremor rápido demais não soa carnudo: soa
 * eletrônico. O tremor rápido e regular é trabalho do vibrato, que é um
 * oscilador separado somado na frequência lá embaixo.
 */
function curvaDeAltura(f0, tom, jitter, dur) {
  // ~60 pontos por segundo. Abaixo disso o contorno fica escadinha; acima, o
  // jitter começa a virar modulação audível — que é o defeito que se está
  // consertando.
  const pontos = Math.max(6, Math.min(160, Math.round(dur * 60)))
  const curva = new Float32Array(pontos)
  for (let i = 0; i < pontos; i++) {
    const alvo = emT(f0, i / (pontos - 1))
    const tremor = 1 + (Math.random() * 2 - 1) * jitter
    curva[i] = Math.max(30, alvo * tom * tremor)
  }
  return curva
}

/**
 * O envelope ADSR como curva.
 *
 * Uma curva única em vez de quatro rampas encadeadas: rampa exponencial não
 * aceita zero, e a sequência delas já tinha dado som cortado quando a sílaba é
 * curta (o latido tem 160 ms — três rampas não cabem ali dentro sem se
 * atropelar). Com a curva, a forma sai igual em qualquer duração.
 */
function curvaEnvelope(env, forca) {
  const n = 64
  const c = new Float32Array(n)
  const a = Math.max(0.005, env.a)
  const d = Math.max(0.005, env.d)
  const r = Math.max(0.02, env.r)
  // O release ocupa a fauda do tempo; ataque e decaimento, o começo.
  const inicioR = Math.max(a + d + 0.02, 1 - r)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    let v
    if (t < a) v = t / a
    else if (t < a + d) v = 1 - (1 - env.s) * ((t - a) / d)
    else if (t < inicioR) v = env.s
    else v = env.s * Math.max(0, 1 - (t - inicioR) / (1 - inicioR))
    c[i] = Math.max(0.0001, v * forca)
  }
  c[n - 1] = 0.0001
  return c
}

/** A trajetória de um formante ao longo da sílaba, em Hz. */
function curvaFormante(base, mults) {
  const n = 32
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    // O teto existe porque um filtro acima de Nyquist deixa de filtrar e o som
    // "abre" de repente no meio da palavra.
    c[i] = Math.max(60, Math.min(11000, base * emT(mults, i / (n - 1))))
  }
  return c
}

/** Aplica uma curva num AudioParam, com plano B onde o navegador recusa. */
function aplicar(param, curva, quando, dur) {
  try {
    param.setValueCurveAtTime(curva, quando, dur)
  } catch {
    // Safari recusa curva em algumas versões; a rampa ainda dá a direção do
    // movimento, só menos detalhada — melhor do que ficar parado (parado é
    // justamente o defeito que este arquivo existe pra corrigir).
    param.setValueAtTime(curva[0], quando)
    param.linearRampToValueAtTime(curva[Math.floor(curva.length / 2)], quando + dur * 0.5)
    param.linearRampToValueAtTime(curva[curva.length - 1], quando + dur)
  }
}

/**
 * Solta a voz do bichinho.
 *
 * `ctx` tem que estar rodando (o app só cria o AudioContext no primeiro toque).
 * `destino` permite ligar num nó de ganho externo; por padrão vai direto.
 */
export function vocalizar(ctx, especie, { humor = 'normal', destino = null, volume = 1 } = {}) {
  if (!ctx || ctx.state !== 'running') return
  const receita = VOZES[especie] || VOZES.gato
  const h = HUMORES[humor] || HUMORES.normal
  const saida = destino || ctx.destination

  // Um ganho só pro bicho inteiro: é onde o volume da espécie e o do humor se
  // encontram, em vez de multiplicar em cada nó.
  const mestre = ctx.createGain()
  mestre.gain.value = receita.volume * h.volume * volume
  mestre.connect(saida)

  let quando = ctx.currentTime + 0.01
  for (const silaba of receita.silabas) {
    const dur = silaba.dur * h.tempo
    const fim = quando + dur

    // ---------------------------------------------------------- os formantes
    //
    // São por SÍLABA, e não por som inteiro: eles se movem ao longo de cada
    // sílaba, e um conjunto compartilhado faria a segunda sílaba começar com a
    // boca na posição em que a primeira terminou.
    //
    // Ligação em série, do agudo pro grave em direção à saída. `filtros[i]`
    // corresponde a `formantes[i]`, então `filtros[0]` é sempre F1 — o que a
    // boca mexe mais.
    let cadeia = mestre
    const filtros = []
    for (const [freq, q, ganho] of receita.formantes) {
      const f = ctx.createBiquadFilter()
      f.type = 'peaking'
      f.frequency.value = freq
      f.Q.value = q
      f.gain.value = ganho
      f.connect(cadeia)
      cadeia = f
      filtros.push(f)
    }
    const boca = receita.boca || {}
    if (filtros[0] && boca.f1) {
      aplicar(filtros[0].frequency, curvaFormante(receita.formantes[0][0], boca.f1), quando, dur)
    }
    if (filtros[1] && boca.f2) {
      aplicar(filtros[1].frequency, curvaFormante(receita.formantes[1][0], boca.f2), quando, dur)
    }

    // ------------------------------------------------------------ rugosidade
    //
    // A fonte pulsando. Entra como um ganho que oscila entre (1-prof) e 1 —
    // nunca chega a zero de propósito: zerando, o som vira uma metralhadora de
    // estalos separados em vez de uma voz raspada.
    const aspera = Math.min(0.95, (receita.rugosidade?.prof || 0) * h.aspereza)
    const rugoso = ctx.createGain()
    rugoso.gain.value = 1
    rugoso.connect(cadeia)
    let lfoRug = null
    if (aspera > 0.01 && receita.rugosidade.hz > 0) {
      rugoso.gain.value = 1 - aspera / 2
      lfoRug = ctx.createOscillator()
      lfoRug.type = 'sine'
      lfoRug.frequency.value = receita.rugosidade.hz
      const prof = ctx.createGain()
      prof.gain.value = aspera / 2
      lfoRug.connect(prof).connect(rugoso.gain)
      lfoRug.start(quando)
      lfoRug.stop(fim + 0.05)
    }

    // ------------------------------------------------------------- envelope
    const env = ctx.createGain()
    env.gain.value = 0.0001
    aplicar(env.gain, curvaEnvelope(silaba.env, silaba.forca), quando, dur)
    env.connect(rugoso)

    // -------------------------------------------------------- fonte harmônica
    const osc = ctx.createOscillator()
    osc.type = receita.onda
    const curva = curvaDeAltura(silaba.f0, h.tom, receita.jitter, dur)
    aplicar(osc.frequency, curva, quando, dur)

    // O vibrato é somado NA frequência: conexão em AudioParam soma ao valor da
    // automação, então ele conviver com a curva de altura não é conflito — é o
    // desenho. A profundidade é fração da altura, senão um vibrato bom pro gato
    // desafinaria o dragão inteiro.
    let lfoVib = null
    if (receita.vibrato?.hz > 0 && receita.vibrato.prof > 0) {
      lfoVib = ctx.createOscillator()
      lfoVib.type = 'sine'
      lfoVib.frequency.value = receita.vibrato.hz
      const prof = ctx.createGain()
      prof.gain.value = emT(silaba.f0, 0.5) * h.tom * receita.vibrato.prof
      lfoVib.connect(prof).connect(osc.frequency)
      lfoVib.start(quando)
      lfoVib.stop(fim + 0.05)
    }

    const gOsc = ctx.createGain()
    gOsc.gain.value = 1 - (receita.ruido?.qtd || 0) * 0.6
    osc.connect(gOsc).connect(env)

    // --------------------------------------------------------- fonte de ruído
    const qtdRuido = (receita.ruido?.qtd || 0) * h.ruido
    let ruido = null
    if (qtdRuido > 0.005) {
      ruido = ctx.createBufferSource()
      ruido.buffer = bufferDeRuido(ctx)
      ruido.loop = true
      // O passa-baixa acompanha a altura da voz: sem isso o ruído fica igual em
      // todos os bichos e some a diferença entre o chiado do latido e a
      // raspagem do rosnado.
      const corta = ctx.createBiquadFilter()
      corta.type = 'lowpass'
      corta.frequency.value = Math.max(600, emT(silaba.f0, 0.3) * h.tom * (receita.ruido.corte || 5))
      const gRuido = ctx.createGain()
      gRuido.gain.value = qtdRuido * 0.5
      ruido.connect(corta).connect(gRuido).connect(env)
      ruido.start(quando)
      ruido.stop(fim + 0.03)
    }

    osc.start(quando)
    osc.stop(fim + 0.03)

    // A pausa entre sílabas é proporcional: latido tem pausa curta, grunhido de
    // capivara tem pausa longa, e as duas saem da mesma conta.
    quando = fim + dur * 0.55
  }
}

/** O nome do som daquela espécie, pra tela poder dizer o que aconteceu. */
export function nomeDaVoz(especie) {
  return (VOZES[especie] || VOZES.gato).nome
}
