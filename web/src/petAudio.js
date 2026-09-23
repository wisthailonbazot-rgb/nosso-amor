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
// Commons. As outras espécies usam gravações CC0/domínio público ou CC BY-SA;
// fonte, autor, recortes e licença ficam no mesmo arquivo de créditos.

/**
 * Cada espécie tem gravações próprias. Mais de uma variação impede que todo
 * carinho pareça apertar exatamente o mesmo botão de brinquedo.
 */
export const GRAVACOES = {
  gato: ['/sons/gato-miado.ogg'],
  cachorro: [
    '/sons/bichos/cachorro-1.ogg',
    '/sons/bichos/cachorro-2.ogg',
    '/sons/bichos/cachorro-3.ogg',
  ],
  coelho: ['/sons/bichos/coelho-1.ogg', '/sons/bichos/coelho-2.ogg'],
  passaro: ['/sons/bichos/passaro-1.ogg', '/sons/bichos/passaro-2.ogg'],
  capivara: ['/sons/bichos/capivara-1.ogg', '/sons/bichos/capivara-2.ogg'],
  // Dragão não existe para ser gravado: o silvo de jacaré dá uma voz animal
  // real, grave e reptiliana, sem voltar ao oscilador artificial.
  dragao: ['/sons/bichos/dragao-1.ogg', '/sons/bichos/dragao-2.ogg'],
}

export const PASSOS = [1, 2, 3, 4].map((n) => `/sons/bichos/passo-${n}.ogg`)

// O áudio já decodificado, por espécie. Decodificar custa; tocar não.
const prontos = new Map()
const carregando = new Map()
// Quem já falhou não é tentado de novo a cada carinho.
const desistidos = new Set()
let passosProntos = []
let passosCarregando = null
const ultimoIndice = new Map()

function decodificar(ctx, caminho) {
  return fetch(caminho, { cache: 'force-cache' })
    .then((resposta) => {
      if (!resposta.ok) throw new Error(String(resposta.status))
      return resposta.arrayBuffer()
    })
    .then((bytes) => new Promise((resolve, reject) => {
      const r = ctx.decodeAudioData(bytes, resolve, reject)
      if (r && typeof r.then === 'function') r.then(resolve, reject)
    }))
}

/**
 * Carrega e decodifica a gravação de uma espécie, uma vez só.
 *
 * Devolve `null` sempre que não der — e "não deu" inclui não existir arquivo
 * para aquela espécie, a rede falhar e o navegador não saber decodificar o
 * formato. Quem chama trata `null` como "usa a síntese".
 */
export async function carregarVoz(ctx, especie) {
  const caminhos = GRAVACOES[especie]
  if (!caminhos || !ctx || desistidos.has(especie)) return null
  if (prontos.has(especie)) return prontos.get(especie)
  if (carregando.has(especie)) return carregando.get(especie)

  const promessa = Promise.allSettled(caminhos.map((caminho) => decodificar(ctx, caminho)))
    .then((resultados) => resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value))
    .then((audios) => {
      if (!audios.length) { desistidos.add(especie); return null }
      prontos.set(especie, audios)
      return audios
    })
    .finally(() => carregando.delete(especie))
  carregando.set(especie, promessa)
  return promessa
}

export async function carregarPassos(ctx) {
  if (!ctx) return []
  if (passosProntos.length) return passosProntos
  if (passosCarregando) return passosCarregando
  passosCarregando = Promise.allSettled(PASSOS.map((caminho) => decodificar(ctx, caminho)))
    .then((resultados) => resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value))
    .then((audios) => { passosProntos = audios; return audios })
    .finally(() => { passosCarregando = null })
  return passosCarregando
}

function escolher(lista, chave) {
  if (!lista?.length) return null
  const anterior = ultimoIndice.get(chave) ?? -1
  let indice = Math.floor(Math.random() * lista.length)
  if (lista.length > 1 && indice === anterior) indice = (indice + 1) % lista.length
  ultimoIndice.set(chave, indice)
  return lista[indice]
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
  const audio = escolher(prontos.get(especie), `voz:${especie}`)
  if (!ctx || !audio) return false

  const ritmo = humor === 'doente' ? 0.78
    : humor === 'triste' ? 0.86
      : humor === 'feliz' ? 1.08
        : 1
  const forca = humor === 'doente' ? 0.5 : humor === 'triste' ? 0.68 : 0.85

  const fonte = ctx.createBufferSource()
  fonte.buffer = audio
  // Variação mínima preserva a identidade do animal e evita repetição mecânica.
  fonte.playbackRate.value = ritmo * (0.975 + Math.random() * 0.05)
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

/** Passo curto e baixo; espécie muda peso/altura sem inventar outra gravação. */
export function tocarPasso(ctx, especie, { volume = 1, destino = null } = {}) {
  const audio = escolher(passosProntos, 'passo')
  if (!ctx || !audio) return false
  const fonte = ctx.createBufferSource()
  fonte.buffer = audio
  fonte.playbackRate.value = especie === 'passaro' ? 1.55
    : especie === 'coelho' ? 1.35
      : especie === 'capivara' ? 0.82
        : especie === 'dragao' ? 0.68
          : especie === 'gato' ? 1.12 : 1
  const ganho = ctx.createGain()
  ganho.gain.value = (especie === 'dragao' ? 0.13 : especie === 'capivara' ? 0.1 : 0.075) * volume
  fonte.connect(ganho).connect(destino || ctx.destination)
  fonte.start()
  return true
}

/** Já existe gravação pronta pra esta espécie? (a bancada usa pra comparar) */
export function temGravacao(especie) {
  return (prontos.get(especie)?.length || 0) > 0
}
