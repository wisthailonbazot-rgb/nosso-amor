// Som DE JOGO: os efeitos gravados e a música de fundo.
//
// ---------------------------------------------------------------- por que aqui
//
// `sound.js` é o bipe de interface: toque, navegação, compra. Ele é sintetizado,
// nasce e morre em milissegundos e não precisa de nada além do oscilador. O som
// de jogo é outra coisa e por isso mora noutro arquivo:
//
//   - é **gravado**, então tem download, decodificação e cache;
//   - a música tem **vida**: começa, repete pra sempre, abaixa, para. Nada em
//     `sound.js` tem ciclo de vida, e enfiar isso lá misturaria as duas coisas.
//
// ------------------------------------------------------- por que gravado, e
//                                                          por que a música não
//
// A regra que este projeto aprendeu com o miado do gato (ver `petAudio.js`, e a
// seção 9.13 do HANDOFF) é a mesma aqui: **eu não escuto.** Ajustar TIMBRE no
// escuro já falhou duas vezes, e explosão, água e afundamento são timbre puro —
// não há número que me diga se um ruído soa como onda ou como chiado. Então eles
// vêm prontos, de quem gravou ouvindo.
//
// O que dá pra medir, eu medi: os dois jingles foram escolhidos pelo CONTORNO DE
// ALTURA, quadro a quadro (centroide espectral por Goertzel, 24 faixas
// log-espaçadas de 150 Hz a 3 kHz). Vitória sobe de tom, derrota desce — isso é
// número, não gosto:
//
//     vitoria.ogg  (jingles_HIT15)    557 Hz -> 771 Hz   **+214 Hz**
//     derrota.ogg  (jingles_STEEL07)  719 Hz -> 442 Hz   **-277 Hz**
//
// Foram os extremos entre os 85 jingles do pacote, entre os que têm pelo menos
// 0,8 s de som de verdade. É a mesma lição da bancada `/lab`: medir o que dá pra
// medir sem ouvido, e ser honesto sobre o resto. **Se algum som não agradar, a
// troca é um arquivo** — o nome aqui não muda.
//
// -------------------------------------------------------------------- licença
//
// Todo arquivo tem dono, e o crédito mora em `public/sons/CREDITOS.md`, que é
// versionado — não num comentário que some. Tudo aqui é CC0.
//
// > Nota, porque a pergunta vai voltar: o kit de MÓVEIS do Kenney foi removido
// > em 28/08 e o smoke proíbe a volta dele. Aquilo era **desenho**, e o motivo
// > era estilo: PNG genérico ao lado de pixel art nosso, cor assada no arquivo,
// > vocabulário que não batia com o catálogo. Nada disso vale pra som — som não
// > tem cor, não tem rotação e não fica ao lado de outro som destoando. A trava
// > do smoke é nominal (`furnitureKenney`, `drawKenneyItem`,
// > `public/kenney-furniture/`) e não encosta nisto.

/**
 * O AudioContext — ENTREGUE por `sound.js`, nunca importado dele.
 *
 * A direção importa. `sound.js` já importa este módulo (é ele quem recebe o
 * pedido `playSound('naval-acerto')` e reparte), e importar de volta fecharia um
 * ciclo. Ciclo de módulo não estoura na hora: ele funciona até o dia em que o
 * empacotador muda a ordem de avaliação e um dos dois lados nasce `undefined` —
 * e aí o som some sem erro nenhum na tela, que é o tipo de defeito que este
 * projeto já perseguiu por dias.
 *
 * Com a entrega, a seta aponta pra um lado só: `sound.js` → `jogoAudio.js`.
 *
 * O contexto é UM só no app inteiro. Um segundo, criado aqui, funcionaria no
 * Chrome e ficaria mudo no iPhone: o desbloqueio do Safari vale pro contexto que
 * existia no momento do toque.
 */
let ctx = null
const audioCtx = () => ctx

/**
 * Quem pediu carga ANTES de existir contexto.
 *
 * Isto conserta um defeito que foi medido no navegador: a tela pede
 * `prepararEfeitos` ao montar, mas o `AudioContext` só nasce no primeiro toque
 * de verdade. Quando a tela monta antes desse toque, `carregar` não tinha nada
 * onde decodificar, devolvia `null` **e ia embora** — nenhum arquivo era pedido,
 * nada reclamava, e o pacote de sons simplesmente não existia naquela sessão.
 *
 * Falha calada e permanente: o jogo continuava funcionando com os bipes de
 * reserva, então de fora parecia certo. É o mesmo formato de defeito da tela de
 * fim que não aparecia — a rede de segurança escondendo o estrago.
 *
 * Agora o pedido fica guardado e é atendido no instante em que o contexto chega.
 */
const naFila = new Set()

export function usarContexto(novo) {
  const primeiroContexto = !ctx && !!novo
  ctx = novo
  if (!primeiroContexto) return
  const pendentes = [...naFila]
  naFila.clear()
  for (const caminho of pendentes) carregar(caminho)
  // A música tem o mesmo problema, e é mais visível: a partida começaria em
  // silêncio pra sempre porque o pedido chegou um instante cedo demais.
  if (musicaAtual) tocarMusica(musicaAtual)
}

/** Os efeitos, por nome. O nome é o que a tela pede; o caminho é detalhe daqui. */
export const EFEITOS = {
  'naval-acerto': '/sons/naval/acerto.ogg',
  'naval-afunda': '/sons/naval/afunda.ogg',
  'naval-agua': '/sons/naval/agua.ogg',
  'naval-vitoria': '/sons/naval/vitoria.ogg',
  'naval-derrota': '/sons/naval/derrota.ogg',

  // A cozinha. Os nomes dizem o GESTO, e nao o arquivo: trocar o som e trocar o
  // arquivo, e nenhuma tela precisa saber.
  'cozinha-picar': '/sons/cozinha/picar.ogg',
  'cozinha-panela': '/sons/cozinha/panela.ogg',
  'cozinha-pegar': '/sons/cozinha/pegar.ogg',
  'cozinha-prato': '/sons/cozinha/prato.ogg',
  'cozinha-lavar': '/sons/cozinha/lavar.ogg',
  'cozinha-entregue': '/sons/cozinha/entregue.ogg',
  'cozinha-errado': '/sons/cozinha/errado.ogg',
  'cozinha-queimou': '/sons/cozinha/queimou.ogg',
  'cozinha-fim': '/sons/cozinha/fim.ogg',
}

/** As músicas de fundo, por nome. */
export const MUSICAS = {
  naval: '/sons/naval/tema.ogg',
  cozinha: '/sons/cozinha-tema.ogg',
}

const prontos = new Map()   // nome -> AudioBuffer já decodificado
const desistidos = new Set() // quem já falhou não é tentado a cada tiro
const baixando = new Map()  // nome -> Promise, pra dois pedidos não virarem dois downloads

const CHAVE_MUDO = 'casal:som-mudo'

/**
 * Está no mudo?
 *
 * Vive no `localStorage` porque é preferência do aparelho, não do casal: o
 * celular dela pode estar no silencioso numa reunião enquanto o dele não está.
 * O `try` existe porque em aba privada o acesso ESTOURA em vez de devolver
 * vazio — e um jogo que não abre por causa disso seria um estrago grande por um
 * motivo pequeno.
 */
export function estaMudo() {
  try { return localStorage.getItem(CHAVE_MUDO) === '1' } catch { return false }
}

export function definirMudo(mudo) {
  try { localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0') } catch { /* aba privada */ }
  if (mudo) pararMusica()
  else if (musicaAtual) tocarMusica(musicaAtual)
}

/**
 * Baixa e decodifica um arquivo, uma vez só.
 *
 * Devolve `null` sempre que não der — arquivo inexistente, rede caída, formato
 * que o navegador não decodifica. Quem chama trata `null` como "usa o bipe", e é
 * isso que impede o jogo de ficar mudo por causa de um download.
 */
async function carregar(caminho) {
  const ctx = audioCtx()
  if (desistidos.has(caminho)) return null
  // Sem contexto ainda: guarda o pedido em vez de descartá-lo. Ver `naFila`.
  if (!ctx) { naFila.add(caminho); return null }
  if (prontos.has(caminho)) return prontos.get(caminho)
  if (baixando.has(caminho)) return baixando.get(caminho)

  const tarefa = (async () => {
    try {
      const resposta = await fetch(caminho, { cache: 'force-cache' })
      if (!resposta.ok) throw new Error(String(resposta.status))
      const buffer = await ctx.decodeAudioData(await resposta.arrayBuffer())
      prontos.set(caminho, buffer)
      return buffer
    } catch {
      desistidos.add(caminho)
      return null
    } finally {
      baixando.delete(caminho)
    }
  })()
  baixando.set(caminho, tarefa)
  return tarefa
}

/**
 * Toca um efeito. Devolve `false` quando não tocou — e aí quem chamou emite o
 * bipe sintetizado no lugar, sem esperar rede nenhuma.
 *
 * Note que ele **não espera** o download: se o arquivo ainda não está pronto,
 * ele pede (pro próximo tiro) e devolve `false` agora. Segurar o som esperando
 * a rede é pior do que um bipe — num jogo, som atrasado é som errado.
 */
export function tocarEfeito(nome, { volume = 0.5 } = {}) {
  const caminho = EFEITOS[nome]
  const ctx = audioCtx()
  if (!caminho || !ctx || ctx.state !== 'running' || estaMudo()) return false
  const buffer = prontos.get(caminho)
  if (!buffer) { carregar(caminho); return false }
  const fonte = ctx.createBufferSource()
  const ganho = ctx.createGain()
  fonte.buffer = buffer
  ganho.gain.value = volume
  fonte.connect(ganho).connect(ctx.destination)
  fonte.start()
  return true
}

/** Deixa os efeitos de um jogo prontos ANTES da partida começar. */
export function prepararEfeitos(prefixo) {
  for (const nome of Object.keys(EFEITOS)) {
    if (nome.startsWith(prefixo)) carregar(EFEITOS[nome])
  }
}

// ------------------------------------------------------------------- a música
//
// Um nó só, guardado aqui no módulo. Trocar de tela não pode empilhar duas
// músicas tocando juntas, e é exatamente isso que acontece se cada tela guardar
// a sua: o React desmonta a tela velha DEPOIS de montar a nova em algumas
// transições, e as duas ficariam vivas ao mesmo tempo.
let fonteMusica = null
let ganhoMusica = null
let musicaAtual = null
const VOLUME_MUSICA = 0.22

/**
 * Começa (ou troca) a música de fundo, em laço.
 *
 * **Só funciona depois de um toque**, e isso não é um azar a contornar: o
 * `AudioContext` só nasce no primeiro `pointerdown` (regra do Safari/iOS, ver
 * `sound.js`). Como quem chama isto é o botão de começar a partida, o toque já
 * aconteceu. Se por algum caminho não tiver acontecido, a música simplesmente
 * não começa — e nunca um erro na tela.
 *
 * Entra em rampa de 1,2 s. Música que começa no volume cheio assusta, ainda mais
 * num app que a pessoa abre na cama.
 */
export function tocarMusica(nome) {
  musicaAtual = nome
  const caminho = MUSICAS[nome]
  const ctx = audioCtx()
  if (!caminho || !ctx || ctx.state !== 'running' || estaMudo()) return
  carregar(caminho).then((buffer) => {
    // Duas guardas, e as duas já aconteceram de verdade em telas com abas: o
    // pedido pode voltar depois de a pessoa ter saído do jogo (`musicaAtual`
    // mudou), ou depois de outra chamada já ter posto música pra tocar.
    if (!buffer || musicaAtual !== nome || fonteMusica) return
    const fonte = ctx.createBufferSource()
    const ganho = ctx.createGain()
    fonte.buffer = buffer
    fonte.loop = true
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime)
    ganho.gain.exponentialRampToValueAtTime(VOLUME_MUSICA, ctx.currentTime + 1.2)
    fonte.connect(ganho).connect(ctx.destination)
    fonte.start()
    fonteMusica = fonte
    ganhoMusica = ganho
  })
}

/** Para a música, descendo o volume — cortar seco estala no alto-falante. */
export function pararMusica() {
  musicaAtual = null
  const ctx = audioCtx()
  const fonte = fonteMusica
  const ganho = ganhoMusica
  fonteMusica = null
  ganhoMusica = null
  if (!fonte || !ctx) return
  try {
    ganho.gain.cancelScheduledValues(ctx.currentTime)
    ganho.gain.setValueAtTime(Math.max(0.0001, ganho.gain.value), ctx.currentTime)
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    fonte.stop(ctx.currentTime + 0.4)
  } catch {
    // `stop` estoura se a fonte nem chegou a começar. Não há o que fazer, e
    // também não há nada tocando — é justamente o caso que queríamos.
  }
}
