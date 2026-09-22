/**
 * Gravador de voz compartilhado pelo chat e pelo diagnostico.
 *
 * O iPhone nao usa MediaRecorder aqui. O Safari historicamente grava AAC/MP4,
 * e regressões do WebKit já produziram MP4 truncado ou sem o fechamento que o
 * servidor precisa. Para voz, PCM mono de 16 kHz resolve a raiz do problema:
 * o arquivo WAV e simples, toca no iPhone e no Android e o servidor consegue
 * conferir a assinatura RIFF sem confiar no nome enviado pelo navegador.
 *
 * Android/Chromium continua em MediaRecorder/WebM com fatias curtas. Esse
 * caminho evita o blob final vazio observado em alguns WebViews. Sao duas
 * implementacoes porque os defeitos reais das duas plataformas sao opostos.
 */

const MEDIA_FORMATS = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm', 'webm'],
  ['audio/ogg;codecs=opus', 'ogg'],
  ['audio/ogg', 'ogg'],
  ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
  ['audio/mp4', 'm4a'],
]

export function isIOSDevice(nav = globalThis.navigator) {
  const ua = nav?.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua)
    || (nav?.platform === 'MacIntel' && Number(nav?.maxTouchPoints || 0) > 1)
}

export function extensionForMime(type = '') {
  const value = String(type).toLowerCase()
  if (value.includes('wav')) return 'wav'
  if (value.includes('mp4') || value.includes('aac')) return 'm4a'
  if (value.includes('ogg')) return 'ogg'
  if (value.includes('mpeg') || value.includes('mp3')) return 'mp3'
  return 'webm'
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Converte blocos Float32 em WAV PCM16 mono, reduzido para voz. */
export function encodeVoiceWav(chunks, inputRate, outputRate = 16000) {
  const total = chunks.reduce((sum, part) => sum + part.length, 0)
  const joined = new Float32Array(total)
  let cursor = 0
  for (const part of chunks) {
    joined.set(part, cursor)
    cursor += part.length
  }

  const safeInputRate = Math.max(8000, Number(inputRate) || 48000)
  const safeOutputRate = Math.min(safeInputRate, Math.max(8000, Number(outputRate) || 16000))
  const ratio = safeInputRate / safeOutputRate
  const sampleCount = Math.max(0, Math.floor(joined.length / ratio))
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, safeOutputRate, true)
  view.setUint32(28, safeOutputRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  for (let out = 0; out < sampleCount; out++) {
    const start = Math.floor(out * ratio)
    const end = Math.max(start + 1, Math.min(joined.length, Math.floor((out + 1) * ratio)))
    let sum = 0
    for (let i = start; i < end; i++) sum += joined[i]
    const sample = Math.max(-1, Math.min(1, sum / (end - start)))
    view.setInt16(44 + out * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function stopTracks(stream) {
  try { stream?.getTracks?.().forEach((track) => track.stop()) } catch { /* ja parou */ }
}

async function createPcmRecorder(stream, preparedContext = null) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextClass) throw new Error('AudioContext indisponível')

  const context = preparedContext || new AudioContextClass()
  try { await context.resume() } catch { /* o estado abaixo confirma */ }
  if (context.state !== 'running') {
    try { await context.close() } catch { /* sem efeito */ }
    throw new Error('O iPhone não iniciou o gravador de voz')
  }

  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor?.(4096, 1, 1)
  if (!processor) {
    source.disconnect()
    try { await context.close() } catch { /* sem efeito */ }
    throw new Error('O iPhone não oferece captura PCM')
  }
  const silent = context.createGain()
  silent.gain.value = 0
  const chunks = []
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer?.getChannelData?.(0)
    if (input?.length) chunks.push(new Float32Array(input))
  }
  source.connect(processor)
  processor.connect(silent)
  silent.connect(context.destination)

  let closed = false
  async function closeGraph() {
    if (closed) return
    closed = true
    processor.onaudioprocess = null
    try { source.disconnect() } catch { /* sem efeito */ }
    try { processor.disconnect() } catch { /* sem efeito */ }
    try { silent.disconnect() } catch { /* sem efeito */ }
    try { await context.close() } catch { /* sem efeito */ }
    stopTracks(stream)
  }

  return {
    kind: 'pcm-wav',
    ext: 'wav',
    mimeType: 'audio/wav',
    async stop() {
      await closeGraph()
      const blob = encodeVoiceWav(chunks, context.sampleRate, 16000)
      return { blob, ext: 'wav', mimeType: 'audio/wav' }
    },
    async cancel() {
      chunks.length = 0
      await closeGraph()
    },
  }
}

function createNativeRecorder(stream, MediaRecorderClass = globalThis.MediaRecorder) {
  if (!MediaRecorderClass) throw new Error('MediaRecorder indisponível')

  let recorder = null
  for (const [mimeType] of MEDIA_FORMATS) {
    try {
      if (MediaRecorderClass.isTypeSupported && !MediaRecorderClass.isTypeSupported(mimeType)) continue
      recorder = new MediaRecorderClass(stream, { mimeType })
      break
    } catch {
      // `isTypeSupported` ja mentiu em aparelhos reais. Tenta o proximo tipo.
    }
  }
  if (!recorder) recorder = new MediaRecorderClass(stream)

  const chunks = []
  let recorderError = null
  recorder.ondataavailable = (event) => event.data?.size && chunks.push(event.data)
  recorder.onerror = (event) => { recorderError = event.error || new Error('Falha ao gravar') }
  recorder.start(250)

  return {
    kind: 'media-recorder',
    get ext() { return extensionForMime(recorder.mimeType) },
    get mimeType() { return recorder.mimeType || 'audio/webm' },
    stop() {
      return new Promise((resolve, reject) => {
        if (recorder.state === 'inactive') {
          stopTracks(stream)
          reject(recorderError || new Error('A gravação já estava parada'))
          return
        }
        let done = false
        const finish = () => {
          if (done) return
          done = true
          clearTimeout(timeout)
          stopTracks(stream)
          if (recorderError) return reject(recorderError)
          const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm'
          resolve({
            blob: new Blob(chunks, { type: mimeType }),
            ext: extensionForMime(mimeType),
            mimeType,
          })
        }
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data)
        }
        recorder.onstop = finish
        const timeout = setTimeout(finish, 3000)
        try { recorder.stop() } catch (error) { recorderError = error; finish() }
      })
    },
    async cancel() {
      chunks.length = 0
      recorder.ondataavailable = () => {}
      recorder.onstop = () => stopTracks(stream)
      try { if (recorder.state !== 'inactive') recorder.stop(); else stopTracks(stream) } catch { stopTracks(stream) }
    },
  }
}

/**
 * Deve ser chamado sincronicamente no toque, antes de pedir a permissao. Assim
 * o AudioContext do iPhone nasce com ativacao do usuario, nao depois do modal.
 */
export function prepareIOSAudioContext(nav = globalThis.navigator) {
  if (!isIOSDevice(nav)) return null
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextClass) return null
  try {
    const context = new AudioContextClass()
    Promise.resolve(context.resume()).catch(() => {})
    return context
  } catch {
    return null
  }
}

export async function startVoiceCapture(stream, { preparedContext = null, nav = globalThis.navigator } = {}) {
  if (isIOSDevice(nav)) {
    try {
      return await createPcmRecorder(stream, preparedContext)
    } catch (pcmError) {
      try { await preparedContext?.close?.() } catch { /* sem efeito */ }
      // Plano B para iPhone antigo sem ScriptProcessor. Ainda e melhor tentar o
      // gravador nativo do que deixar o botao morrer sem uma alternativa.
      try { return createNativeRecorder(stream) } catch { throw pcmError }
    }
  }
  try { await preparedContext?.close?.() } catch { /* sem efeito */ }
  return createNativeRecorder(stream)
}

export function supportsVoiceRecording() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
  return typeof globalThis.MediaRecorder !== 'undefined' || !!AudioContextClass
}
