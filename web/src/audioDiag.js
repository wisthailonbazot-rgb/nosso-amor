// Diagnóstico do microfone — por que o áudio não sai deste aparelho.
//
// ------------------------------------------------------------ por que existe
//
// O dono relatou três vezes que "mandar áudio no Android não funciona", a
// última delas já com a correção do gravador publicada e **pelo navegador, no
// link** — ou seja, nem é caso de PWA ou de APK. Do lado de cá não há como
// adivinhar: gravar áudio depende de sete coisas em sequência, e quase todas
// falham do mesmo jeito quando falham — nada acontece.
//
// É a mesma situação do push no iPhone, que ficou meses "não chegando" até
// existir uma tela dizendo qual das três condições tinha falhado. A lição vale
// aqui: **transformar "não funciona" em "parou no passo N, por causa de X"**.
//
// Este módulo roda os sete passos de verdade — inclusive o envio ao servidor e
// a leitura de volta — e devolve uma linha por passo, em português. Nenhum
// passo é simulado: se der certo aqui, gravar no chat dá certo, porque é o
// mesmo caminho.
//
// Ele NÃO manda nada para a conversa: usa a rota de teste
// `POST /api/chat/audio/teste`, que valida o arquivo igualzinho e joga fora.

import { api, apiUrl, getToken } from './api'
import { entradasDeAudio, estadoDoMicrofone, ondeRoda, pedirMicrofone } from './lib/microfone'
import {
  isIOSDevice,
  prepareIOSAudioContext,
  startVoiceCapture,
  supportsVoiceRecording,
} from './lib/audioRecorder'

// `passos` é a lista do que fazer quando o passo falha e o conserto está fora
// do app (o caso da permissão bloqueada). Vazia na maioria: quando o motivo já
// diz tudo, mais texto é ruído.
const passo = (ok, label, detalhe = '', passos = []) => ({ ok, label, detalhe, passos })

/**
 * Roda o diagnóstico. TEM que ser chamado de dentro de um toque: pedir o
 * microfone fora de um gesto é recusado sem erro claro em vários navegadores.
 *
 * `aoAndar` recebe a lista parcial a cada passo, pra tela ir preenchendo em vez
 * de ficar parada — gravar leva 2 segundos e tela parada parece travada.
 */
export async function diagnosticarAudio(aoAndar = () => {}) {
  const linhas = []
  const anda = (p) => {
    linhas.push(p)
    aoAndar([...linhas])
    return p.ok
  }

  // 1. contexto seguro
  const seguro = window.isSecureContext
  if (!anda(passo(
    seguro,
    'Conexão segura (HTTPS)',
    seguro ? location.protocol : 'sem HTTPS o navegador bloqueia o microfone, e nem pergunta'
  ))) return linhas

  // 2. as APIs existem
  const temMD = !!navigator.mediaDevices?.getUserMedia
  const temGravador = supportsVoiceRecording()
  if (!anda(passo(
    temMD && temGravador,
    'O navegador sabe gravar',
    temMD && temGravador ? '' : `mediaDevices: ${temMD ? 'sim' : 'não'}, gravador: ${temGravador ? 'sim' : 'não'}`
  ))) return linhas

  // 3. caminho. No iPhone e WAV/PCM de proposito: nao depende do fechamento
  // MP4 do Safari e toca igual no Android de quem recebe.
  const preparedContext = prepareIOSAudioContext()
  anda(passo(
    true,
    'Formato de gravação',
    isIOSDevice() ? 'WAV PCM mono (compatível com iPhone e Android)' : 'WebM/Opus do navegador',
  ))

  // 4. permissão + microfone
  //
  // Aqui estava o buraco da rodada passada. O passo devolvia `NotAllowedError`
  // e dizia "Você (ou o navegador) negou — libere nos ajustes do site", que é
  // verdade e não serve: não diz ONDE ficam esses ajustes, e principalmente não
  // diz que **o navegador não vai perguntar de novo** enquanto o "não" estiver
  // guardado. O dono continuou tocando no botão esperando a pergunta.
  //
  // `pedirMicrofone` separa os dois casos que dão o MESMO erro — pergunta
  // fechada agora (dá pra tentar de novo) e permissão bloqueada na origem (só
  // nos ajustes) — e devolve o caminho de volta em passos, para ESTE aparelho.
  const pedido = await pedirMicrofone()
  if (!pedido.ok) {
    try { await preparedContext?.close?.() } catch { /* sem efeito */ }
    const extra = pedido.depois?.length
      ? [`— ${pedido.tituloDepois}`, ...pedido.depois]
      : []
    anda(passo(
      false,
      'Permissão do microfone',
      `${pedido.motivo} (o navegador respondeu ${pedido.erro || '?'})`,
      [...(pedido.passos || []), ...extra],
    ))
    return linhas
  }
  const stream = pedido.stream
  const faixas = stream.getAudioTracks()
  anda(passo(true, 'Permissão do microfone', faixas[0]?.label || 'liberado'))

  // 5. a faixa está viva? (uma faixa "muted" grava silêncio e ninguém avisa)
  const faixa = faixas[0]
  anda(passo(
    !!faixa && faixa.readyState === 'live' && !faixa.muted,
    'O microfone está ligado',
    faixa ? `estado: ${faixa.readyState}${faixa.muted ? ', MUDO' : ''}` : 'sem faixa de áudio'
  ))

  // 6. grava 2 segundos de verdade
  let blob = null
  let ext = 'webm'
  try {
    const capture = await startVoiceCapture(stream, { preparedContext })
    await new Promise((r) => setTimeout(r, 2000))
    const result = await capture.stop()
    blob = result.blob
    ext = result.ext
  } catch (err) {
    anda(passo(false, 'Gravar 2 segundos', `o aparelho recusou: ${err?.name || err}`))
    stream.getTracks().forEach((t) => t.stop())
    return linhas
  }
  stream.getTracks().forEach((t) => t.stop())

  if (!anda(passo(
    blob.size > (ext === 'wav' ? 44 : 0),
    'Gravar 2 segundos',
    blob.size > 0 ? `${(blob.size / 1024).toFixed(1)} KB` : 'saiu VAZIO — o navegador não entregou os dados'
  ))) return linhas

  // 7. o servidor aceita?
  //
  // Este é o passo que ninguém consegue testar de fora, e é onde um formato que
  // o servidor não reconhece apareceria — ele confere os primeiros BYTES, não o
  // que o navegador diz que é.
  const form = new FormData()
  form.append('file', blob, `teste.${ext}`)
  try {
    const r = await api.post('/api/chat/audio/teste', form, { timeoutMs: 90000 })
    anda(passo(true, 'O servidor aceitou o arquivo', `reconhecido como ${r?.tipo || '?'}, ${r?.bytes || 0} bytes`))
  } catch (err) {
    anda(passo(false, 'O servidor aceitou o arquivo', `${err?.status || ''} ${err?.message || err}`))
    return linhas
  }

  // 8. dá pra ouvir de volta? (o `<audio>` do chat usa o mesmo caminho)
  try {
    const url = URL.createObjectURL(blob)
    const el = new Audio()
    el.src = url
    await new Promise((resolve, reject) => {
      el.onloadedmetadata = resolve
      el.onerror = () => reject(new Error('o navegador não consegue tocar este formato'))
      setTimeout(resolve, 1500)
    })
    URL.revokeObjectURL(url)
    anda(passo(true, 'Dá pra tocar de volta', ''))
  } catch (err) {
    anda(passo(false, 'Dá pra tocar de volta', String(err?.message || err)))
  }

  return linhas
}

/**
 * O que a tela mostra em "Detalhes do aparelho".
 *
 * Ganhou duas linhas nesta rodada, e as duas por causa do caso do Android: o
 * ESTADO GUARDADO da permissão (que é o que explica o navegador não perguntar)
 * e ONDE o app está rodando (site, atalho ou APK) — sem isso não dá pra saber
 * em quais ajustes a pessoa tem que mexer, e a resposta é diferente em cada um.
 *
 * É `async` agora porque ler a permissão é uma Promise.
 */
export async function ondeEstamos() {
  const onde = ondeRoda()
  return {
    endereco: location.origin,
    api: apiUrl('/api'),
    seguro: window.isSecureContext,
    temToken: !!getToken(),
    microfone: await estadoDoMicrofone(),
    // Quantos microfones o SISTEMA entrega ao navegador. Zero aqui é a prova de
    // que a trava está abaixo do site (chave geral do aparelho ou permissão do
    // app do navegador) — e é o que explica falhar em vários navegadores.
    entradasDeAudio: JSON.stringify(await entradasDeAudio()),
    rodando: onde.apk ? 'APK' : onde.instalado ? 'atalho na tela de início' : `site no ${onde.navegador}`,
    agente: navigator.userAgent.slice(0, 120),
  }
}
