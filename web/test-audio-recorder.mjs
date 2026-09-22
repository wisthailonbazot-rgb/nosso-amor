import assert from 'node:assert/strict'

import { encodeVoiceWav, extensionForMime, isIOSDevice } from './src/lib/audioRecorder.js'

const sourceRate = 48000
const seconds = 1
const samples = new Float32Array(sourceRate * seconds)
for (let i = 0; i < samples.length; i++) samples[i] = Math.sin((i / sourceRate) * Math.PI * 2 * 440) * 0.5

// Dois blocos simulam os callbacks sucessivos do AudioContext do iPhone.
const wav = encodeVoiceWav([samples.slice(0, 17000), samples.slice(17000)], sourceRate, 16000)
assert.equal(wav.type, 'audio/wav')
assert.equal(wav.size, 44 + 16000 * 2, 'um segundo mono PCM16 precisa ter exatamente 32 KB de dados')

const bytes = new Uint8Array(await wav.arrayBuffer())
const ascii = (start, size) => String.fromCharCode(...bytes.slice(start, start + size))
const view = new DataView(bytes.buffer)
assert.equal(ascii(0, 4), 'RIFF')
assert.equal(ascii(8, 4), 'WAVE')
assert.equal(ascii(12, 4), 'fmt ')
assert.equal(ascii(36, 4), 'data')
assert.equal(view.getUint16(20, true), 1, 'formato PCM')
assert.equal(view.getUint16(22, true), 1, 'um canal')
assert.equal(view.getUint32(24, true), 16000, '16 kHz')
assert.equal(view.getUint16(34, true), 16, '16 bits')
assert.equal(view.getUint32(40, true), 32000, 'tamanho do bloco de áudio')

assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6)', platform: 'iPhone' }), true)
assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 }), true)
assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l' }), false)
assert.equal(extensionForMime('audio/mp4;codecs=mp4a.40.2'), 'm4a')
assert.equal(extensionForMime('audio/webm;codecs=opus'), 'webm')
assert.equal(extensionForMime('audio/wav'), 'wav')

console.log('áudio: WAV PCM mono 16 kHz válido e detecção de plataforma conferida')
