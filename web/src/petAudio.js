// Vozes GRAVADAS de bicho — e por que elas existem ao lado da síntese.
//
// ------------------------------------------------------------------ por que
//
// A voz dos bichinhos é sintetizada (`petVoz.js`: fonte harmônica + ruído +
// formantes). Ela foi ajustada duas vezes, passou nas medições da bancada — e o
// dono continuou dizendo que o miado está péssimo. As duas coisas são
// verdadeiras ao mesmo tempo, e vale entender por quê:
//
//   a bancada mede o que dá pra medir sem ouvido — volume, agudez, movimento,
//   corpo. Um miado real e um miado sintético podem empatar em todos esses
//   números e ainda assim um soar como gato e o outro como brinquedo. O que
//   falta é o que a medida não pega: o ataque irregular da glote, o ruído de
//   sopro no começo, o jeito como o timbre muda DENTRO de cada milissegundo.
//
// E aqui entra o limite honesto: **eu não escuto**. Ajustar timbre no escuro já
// falhou duas vezes; insistir seria chutar uma terceira. Um som gravado tira a
// questão do meu ouvido e põe no ouvido de quem gravou o gato.
//
// A síntese continua inteira e continua sendo o padrão de todo mundo. Ela é a
// reserva: se o arquivo não existir, não baixar, ou o navegador não souber
// tocar, o bicho fala do mesmo jeito de sempre. Nenhum bicho fica mudo por
// causa de um arquivo.
//
// -------------------------------------------------------------- licença
//
// Os arquivos têm dono, e o crédito mora em `public/sons/CREDITOS.md` — não num
// comentário que some. O miado é de Dan Crosby, CC BY-SA 3.0, do Wikimedia
// Commons.

/**
 * Que espécie tem gravação, e qual arquivo.
 *
 * Só o gato por enquanto: foi dele que o dono reclamou, e é uma gravação por
 * vez — cada uma tem licença própria pra conferir antes de entrar.
 */
export const GRAVACOES = {
  gato: '/sons/gato-miado.ogg',
}

// O áudio já decodificado, por espécie. Decodificar custa; tocar não.
const prontos = new Map()
// Quem já falhou não é tentado de novo a cada carinho.
const desistidos = new Set()

/**
 * Carrega e decodifica a gravação de uma espécie, uma vez só.
 *
 * Devolve `null` sempre que não der — e "não deu" inclui não existir arquivo
 * para aquela espécie, a rede falhar e o navegador não saber decodificar o
 * formato. Quem chama trata `null` como "usa a síntese".
 */
export async function carregarVoz(ctx, especie) {
  const caminho = GRAVACOES[especie]
  if (!caminho || !ctx || desistidos.has(especie)) return null
  if (prontos.has(especie)) return prontos.get(especie)

  try {
    const resposta = await fetch(caminho, { cache: 'force-cache' })
    if (!resposta.ok) throw new Error(String(resposta.status))
    const bytes = await resposta.arrayBuffer()
    // `decodeAudioData` com Promise não existe no Safari antigo; a forma com
    // callback funciona nos dois.
    const audio = await new Promise((resolve, reject) => {
      const r = ctx.decodeAudioData(bytes, resolve, reject)
      if (r && typeof r.then === 'function') r.then(resolve, reject)
    })
    prontos.set(especie, audio)
    return audio
  } catch {
    desistidos.add(especie)
    return null
  }
}

/**
 * Toca a gravação, se houver uma pronta. Devolve `false` quando não houver —
 * e aí quem chamou cai na síntese.
 *
 * O humor mexe em duas coisas de propósito, e só nessas duas: a ALTURA e a
 * VELOCIDADE, que andam juntas num `playbackRate` (é assim que fita andando
 * mais devagar fica mais grave, e o ouvido aceita). Bicho triste ou doente mia
 * mais grave e mais arrastado; bicho feliz, um tiquinho mais agudo. Mexer em
 * mais do que isso numa gravação real começa a soar processado — que é
 * justamente o defeito de que se está fugindo.
 */
export function tocarGravacao(ctx, especie, { humor = 'normal', volume = 1, destino = null } = {}) {
  const audio = prontos.get(especie)
  if (!ctx || !audio) return false

  const ritmo = humor === 'doente' ? 0.78
    : humor === 'triste' ? 0.86
      : humor === 'feliz' ? 1.08
        : 1
  const forca = humor === 'doente' ? 0.5 : humor === 'triste' ? 0.68 : 0.85

  const fonte = ctx.createBufferSource()
  fonte.buffer = audio
  fonte.playbackRate.value = ritmo
  const ganho = ctx.createGain()
  ganho.gain.value = forca * volume

  // Um respiro no fim evita o "clique" de corte seco, que é o que mais denuncia
  // som colado num app.
  const fim = ctx.currentTime + audio.duration / ritmo
  ganho.gain.setValueAtTime(forca * volume, Math.max(ctx.currentTime, fim - 0.06))
  ganho.gain.linearRampToValueAtTime(0.0001, fim)

  fonte.connect(ganho).connect(destino || ctx.destination)
  fonte.start()
  return true
}

/** Já existe gravação pronta pra esta espécie? (a bancada usa pra comparar) */
export function temGravacao(especie) {
  return prontos.has(especie)
}
