// A voz dos bichinhos — sintetizada, sem nenhum arquivo de áudio.
//
// O que existia era um bipe de duas notas, igual pra todo mundo, só trocando a
// frequência: 620 pro gato, 220 pro cachorro. Dois bipes não são um miado nem um
// latido — são dois bipes. O dono pediu som "condizente com cada um".
//
// ------------------------------------------------------------------ o modelo
//
// A pesquisa levou ao mesmo desenho que o `soundgen` usa pra sintetizar
// vocalização animal, e ele cabe inteiro na Web Audio API:
//
//   1. uma FONTE HARMÔNICA (dente de serra, rica em harmônicos) com um CONTORNO
//      DE ALTURA — não uma nota, uma curva. É a curva que separa o miado
//      (sobe e desce) do latido (despenca) e do piado (varre pra cima);
//   2. uma FONTE DE RUÍDO misturada em proporção variável. É o ruído que dá o
//      rosnado do dragão e o "chiado" do latido; sem ele tudo vira apito;
//   3. FORMANTES — dois ou três filtros de pico em frequências fixas por
//      espécie. São eles que fazem a mesma nota soar como bicho diferente, do
//      mesmo jeito que a boca de uma pessoa faz "a" virar "i";
//   4. ABERTURA DE BOCA: o primeiro formante varre pra cima e volta ao longo do
//      som. Isso é literalmente o que um miado é;
//   5. JITTER — tremor aleatório na altura. Voz perfeitamente afinada soa
//      eletrônica; é o jitter que faz soar orgânico, e muito jitter vira rosnado.
//
// Nada disso baixa arquivo, e por isso continua funcionando no iPhone com o
// AudioContext criado só no primeiro toque, que é a regra do Safari.

/**
 * A receita de cada espécie.
 *
 * `f0` é o contorno de altura em Hz, lido como pontos igualmente espaçados ao
 * longo da sílaba. `formantes` são [frequência, Q, ganho em dB].
 */
export const VOZES = {
  gato: {
    // Miado: sobe e desce, boca abrindo no meio. Pouco ruído — gato é limpo.
    nome: 'miado',
    f0: [520, 680, 700, 560, 430],
    formantes: [[900, 6, 14], [2100, 8, 9], [3200, 6, 4]],
    bocaAbre: [0.7, 1.5, 0.8],
    ruido: 0.05,
    jitter: 0.012,
    silabas: [[0.52, 1]],
    onda: 'sawtooth',
    volume: 0.10,
  },
  cachorro: {
    // Latido: estouro curto que despenca, muito ruído e muito jitter. Dois.
    nome: 'latido',
    f0: [420, 300, 190, 150],
    formantes: [[520, 4, 15], [1500, 5, 10], [2600, 4, 3]],
    bocaAbre: [1.35, 0.8, 0.6],
    ruido: 0.42,
    jitter: 0.05,
    silabas: [[0.13, 1], [0.15, 0.85]],
    onda: 'sawtooth',
    volume: 0.13,
  },
  coelho: {
    // Coelho quase não vocaliza: é um guincho curtinho e agudo, bem baixinho.
    nome: 'guincho',
    // Bem mais agudo do que o gato, de proposito: a bancada mediu os dois a
    // 1075 e 1219 Hz e reprovou — a 12% de distancia eles soariam a mesma coisa,
    // e um miado nao pode ser confundido com um guincho de coelho.
    f0: [1250, 1750, 1400],
    formantes: [[2200, 11, 12], [3900, 8, 6]],
    bocaAbre: [0.9, 1.2, 0.9],
    ruido: 0.10,
    jitter: 0.02,
    silabas: [[0.11, 1], [0.09, 0.7]],
    onda: 'triangle',
    volume: 0.07,
  },
  passaro: {
    // Piado: varredura rápida pra cima, som quase puro, três sílabas.
    nome: 'piado',
    f0: [2100, 3100, 2700, 3300],
    formantes: [[3000, 12, 10], [4600, 10, 5]],
    bocaAbre: [1, 1, 1],
    ruido: 0.02,
    jitter: 0.008,
    silabas: [[0.09, 1], [0.08, 0.9], [0.1, 0.75]],
    onda: 'sine',
    volume: 0.06,
  },
  capivara: {
    // Capivara faz um assobio-grunhido nasal e grave. Formante baixo e fechado.
    nome: 'grunhido',
    f0: [270, 330, 290, 235],
    formantes: [[420, 5, 15], [1100, 6, 8]],
    bocaAbre: [0.8, 1.1, 0.7],
    ruido: 0.28,
    jitter: 0.03,
    silabas: [[0.3, 1], [0.22, 0.8]],
    onda: 'sawtooth',
    volume: 0.11,
  },
  dragao: {
    // Rosnado: grave, longo, jitter alto e ruído alto. É o jitter que rosna.
    nome: 'rosnado',
    f0: [78, 70, 86, 64],
    formantes: [[300, 4, 16], [900, 5, 10], [1800, 3, 4]],
    bocaAbre: [0.9, 1.25, 0.7],
    ruido: 0.5,
    jitter: 0.075,
    silabas: [[0.75, 1]],
    onda: 'sawtooth',
    volume: 0.12,
  },
}

// Como o humor mexe na voz. São os mesmos três botões que a gente usa sem
// pensar: mais agudo e mais curto = animado; mais grave e mais longo = pra
// baixo; mais ruído e menos volume = sem forças.
const HUMORES = {
  feliz: { tom: 1.14, tempo: 0.88, ruido: 1, volume: 1.05 },
  normal: { tom: 1, tempo: 1, ruido: 1, volume: 1 },
  triste: { tom: 0.84, tempo: 1.3, ruido: 1.1, volume: 0.8 },
  doente: { tom: 0.78, tempo: 1.45, ruido: 1.9, volume: 0.62 },
  bravo: { tom: 0.92, tempo: 0.9, ruido: 1.5, volume: 1.1 },
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

/** A curva de altura de uma sílaba, com o jitter já misturado. */
function curvaDeAltura(receita, tom, jitter, pontos = 40) {
  const base = receita.f0
  const curva = new Float32Array(pontos)
  for (let i = 0; i < pontos; i++) {
    const t = (i / (pontos - 1)) * (base.length - 1)
    const a = Math.floor(t)
    const b = Math.min(base.length - 1, a + 1)
    const f = t - a
    const alvo = base[a] + (base[b] - base[a]) * f
    // O jitter é ruído SOBRE a curva, não um vibrato regular: vibrato soa
    // cantado, jitter soa vivo.
    const tremor = 1 + (Math.random() * 2 - 1) * jitter
    curva[i] = Math.max(40, alvo * tom * tremor)
  }
  return curva
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

  // Formantes: filtros de PICO em série. Pico e não passa-banda porque o
  // passa-banda joga fora o resto do espectro e o bicho fica com voz de rádio.
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

  let quando = ctx.currentTime + 0.01
  for (const [durBase, forca] of receita.silabas) {
    const dur = durBase * h.tempo
    const fim = quando + dur

    // --- fonte harmônica
    const osc = ctx.createOscillator()
    osc.type = receita.onda
    const curva = curvaDeAltura(receita, h.tom, receita.jitter)
    try {
      osc.frequency.setValueCurveAtTime(curva, quando, dur)
    } catch {
      // Safari recusa curva em algumas versões; a rampa simples ainda dá o
      // contorno, só menos detalhado — melhor do que ficar mudo.
      osc.frequency.setValueAtTime(curva[0], quando)
      osc.frequency.linearRampToValueAtTime(curva[curva.length - 1], fim)
    }
    const gOsc = ctx.createGain()
    gOsc.gain.value = 1 - receita.ruido * 0.6
    osc.connect(gOsc)

    // --- fonte de ruído
    const ruido = ctx.createBufferSource()
    ruido.buffer = bufferDeRuido(ctx)
    ruido.loop = true
    const gRuido = ctx.createGain()
    gRuido.gain.value = receita.ruido * h.ruido * 0.5
    // O ruído passa por um passa-baixa que acompanha a altura: sem isso ele
    // fica igual em todos os bichos e some a diferença entre chiado e rosnado.
    const corta = ctx.createBiquadFilter()
    corta.type = 'lowpass'
    corta.frequency.value = Math.max(700, curva[0] * 6)
    ruido.connect(corta).connect(gRuido)

    // --- envelope da sílaba
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, quando)
    // O ataque curto é o que dá o "estouro" do latido; o miado precisa de um
    // ataque mais macio, senão vira um tapa.
    const ataque = Math.min(0.05, dur * (receita.ruido > 0.3 ? 0.06 : 0.22))
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, forca), quando + ataque)
    env.gain.exponentialRampToValueAtTime(0.0001, fim)
    gOsc.connect(env)
    gRuido.connect(env)
    env.connect(cadeia)

    // --- abertura de boca: o PRIMEIRO formante varre e volta
    //
    // `filtros[0]` e o formante F1 (o mais grave), que e o que a boca mexe. A
    // ordem da cadeia e ao contrario da ordem da lista — cada filtro novo se
    // liga no anterior, entao o sinal entra pelo ULTIMO criado. Pegar o ultimo
    // da lista aqui mexeria no formante agudo e a boca nao abriria.
    const f1 = filtros[0] || null
    if (f1 && receita.bocaAbre) {
      const base = receita.formantes[0][0]
      const [a, b, c] = receita.bocaAbre
      f1.frequency.setValueAtTime(base * a, quando)
      f1.frequency.linearRampToValueAtTime(base * b, quando + dur * 0.45)
      f1.frequency.linearRampToValueAtTime(base * c, fim)
    }

    osc.start(quando)
    osc.stop(fim + 0.03)
    ruido.start(quando)
    ruido.stop(fim + 0.03)

    // A pausa entre sílabas é proporcional: latido tem pausa curta, grunhido
    // de capivara tem pausa longa, e as duas saem da mesma conta.
    quando = fim + dur * 0.55
  }
}

/** O nome do som daquela espécie, pra tela poder dizer o que aconteceu. */
export function nomeDaVoz(especie) {
  return (VOZES[especie] || VOZES.gato).nome
}
