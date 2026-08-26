// Bancada de conferência do motor de pixel.
//
// Desenha TODA forma de móvel e TODA peça de avatar, isolada. Serve pra duas
// coisas: olhar se ficou bonito, e pegar a peça que "não aparece" — erro fácil de
// passar batido quando o item está escondido atrás de outro na cena cheia.
//
// A conferência é automática: cada quadro é pintado num canvas de rascunho e os
// pixels são contados. Peça que pinta quase nada aparece marcada em vermelho.
//
// Rota /lab. Não entra em nenhum menu; é ferramenta de trabalho.

import { useEffect, useRef, useState } from 'react'

import { Painter } from '../render/pixel'
import { SHAPES, drawItem } from '../render/furniture'
import { roomMetrics } from '../render/iso'
import { drawScene, FLOOR_STYLES, WALL_STYLES } from '../render/room'
import { AVATAR_H, AVATAR_W, STYLE_LISTS, drawAvatar } from '../render/avatar'
import { drawPetIcon, PET_ICON_CODES } from '../render/petitems'
import { STICKER_CODES, STICKER_LABEL } from '../render/stickers'
import Sticker from '../components/Sticker'
import { STICKERS_HD } from '../render/stickersHD'
import { drawPet } from '../render/PetCanvas'
import { CODIGOS_ESPECIE, NOMES_CLIPES, clipeDe, planoDe } from '../render/petRig'
import { VOZES, nomeDaVoz, vocalizar } from '../petVoz'

// As seis espécies, os três estágios e os humores que MUDAM o desenho.
// Estão aqui porque o bichinho é desenhado por espécie: um `if` esquecido numa
// espécie só aparece pra quem escolheu aquela — e é justamente quem nunca vai
// abrir um chamado dizendo "meu coelho está sem orelha".
const LAB_SPECIES = [
  ['gato', ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2']],
  ['cachorro', ['#c98a4b', '#6b4a2f', '#e8dcc6', '#3a3340']],
  ['coelho', ['#f0ebe2', '#c9c4bd', '#9c7b62', '#3a3340']],
  ['passaro', ['#f2c53d', '#5bb9e8', '#7fd6b0', '#e8879b']],
  ['capivara', ['#a87b52', '#8a6340', '#c9a67f', '#3a3340']],
  ['dragao', ['#7fd6b0', '#6b4fa0', '#e8879b', '#f2c53d']],
]
const LAB_STAGES = ['filhote', 'jovem', 'adulto']

// O crescimento agora e CONTINUO (ver `petRig.planoDe`), entao a bancada precisa
// olhar os pontos do meio tambem: e entre um estagio e outro que uma conta de
// proporcao errada faz a perna atravessar o corpo, e nos tres estagios redondos
// isso pode nao aparecer.
const LAB_CRESCIMENTO = [0, 0.25, 0.5, 0.75, 1]

// Acessório vestido, em TODA espécie e em pose que MEXE no corpo.
//
// Antes só existia "gato parado com coleira". Isso bastava enquanto o bichinho
// era uma pilha de retângulos parada: o chapéu ficava num y fixo e pronto. Com
// o esqueleto, a cabeça abaixa pra comer, tomba pra dormir e sobe no pulo — e um
// acessório presilhado em coordenada fixa flutua no ar ou atravessa o pescoço.
// Por isso a conferência é cruzada: acessório × espécie, e cada um numa pose
// diferente, justamente as que mais deslocam a cabeça.
const LAB_ACESSORIOS = [
  ['pet_coleira', 'neck', 'comer'],
  ['pet_gravata', 'neck', 'dormir'],
  ['pet_chapeu', 'head', 'pular'],
  ['pet_oculos_pet', 'head', 'sentar'],
  ['pet_chapeu', 'head', 'deitar'],
]
const LAB_MOODS = ['feliz', 'triste', 'faminto', 'doente']

const MIN_PIXELS = 20 // abaixo disso, considera que a peça não desenhou nada

const SIZES = {
  sofa: [3, 1], bed: [3, 2], table: [2, 2], chair: [1, 1], shelf: [2, 1],
  wardrobe: [2, 1], puff: [1, 1], rug: [3, 2], tv: [2, 1], speaker: [1, 1],
  console: [1, 1], fridge: [1, 2], plant: [1, 1], plant_big: [1, 1],
  lamp: [1, 1], candles: [1, 1], frame: [1, 1], frame_couple: [2, 1],
  stove:[2,1], petbed:[2,2], petbowl:[1,1], scratchpost:[1,1], pethouse:[2,2],
  hammock:[3,1], grill:[2,1], garden:[2,2], swing:[2,2], tree:[2,2],
  clothesline:[3,1], gardenstool:[1,1],
}

/** Conta quantos pixels uma função de desenho pinta. É o teste automático. */
function countPainted(width, height, paint) {
  const canvas = document.createElement('canvas')
  const painter = new Painter(canvas)
  painter.resize(width, height)
  painter.clear()
  paint(painter)
  const data = painter.ctx.getImageData(0, 0, width, height).data
  let painted = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++
  return painted
}

/**
 * A caixa que o desenho realmente ocupa, em FRACAO do canvas.
 *
 * Serve pra comparar o mesmo bicho desenhado em escalas diferentes: se o motor
 * estiver certo, ele ocupa a mesma fatia do quadro nas duas. Quando alguma
 * medida nao acompanha a escala (numero cru em pixel, contorno de espessura
 * fixa, pose multiplicada duas vezes), essa fatia muda — e e assim que o
 * defeito aparece sem ninguem precisar olhar.
 */
function caixaPintada(width, height, paint) {
  const canvas = document.createElement('canvas')
  const painter = new Painter(canvas)
  painter.resize(width, height)
  painter.clear()
  paint(painter)
  const data = painter.ctx.getImageData(0, 0, width, height).data
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { larg: (x1 - x0 + 1) / width, alt: (y1 - y0 + 1) / height }
}

/**
 * A aba de VOZES.
 *
 * O som era a unica coisa do app que ninguem conferia. As artes tem bancada
 * desde cedo — movel, bichinho, figurinha, item —, mas a voz do bicho so dava
 * pra saber se estava certa apertando o botao e ouvindo, e ninguem faz isso
 * depois de cada mexida. Resultado: por muito tempo os seis bichos usaram o
 * MESMO bipe com a frequencia trocada, e isso passou.
 *
 * Aqui cada especie e sintetizada num `OfflineAudioContext` — que renderiza sem
 * tocar nada — e viram dois numeros e um desenho:
 *
 *   - **volume (RMS)**: se der zero, a voz nao esta saindo. E o equivalente ao
 *     "⚠ vazio" das abas de desenho;
 *   - **centro do espectro**: onde a energia do som se concentra. E o numero
 *     que separa um piado de um rosnado. Duas especies com o centro quase igual
 *     soariam iguais na pratica, e a aba reprova.
 *
 * O botao toca a voz de verdade, pra conferir de ouvido o que os numeros nao
 * contam.
 */
function AbaVozes() {
  const [medidas, setMedidas] = useState(null)

  useEffect(() => {
    let vivo = true
    const medir = async () => {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
      if (!OAC) { setMedidas('sem-suporte'); return }
      const saida = []
      for (const especie of Object.keys(VOZES)) {
        const ctx = new OAC(1, 44100 * 2, 44100)
        // `vocalizar` so trabalha com o contexto rodando; no offline o estado e
        // 'suspended' ate o render, entao a checagem e enganada de proposito.
        Object.defineProperty(ctx, 'state', { get: () => 'running' })
        vocalizar(ctx, especie, { humor: 'normal' })
        const buffer = await ctx.startRendering()
        const d = buffer.getChannelData(0)
        let soma = 0
        for (let i = 0; i < d.length; i++) soma += d[i] * d[i]
        const rms = Math.sqrt(soma / d.length)
        // centro do espectro por autocorrelacao grosseira: conta quantas vezes
        // o sinal cruza o zero. Mais cruzamentos = som mais agudo. E o jeito
        // mais simples de medir "grave x agudo" sem uma FFT inteira.
        let cruzou = 0
        let ultimo = 0
        let amostras = 0
        for (let i = 0; i < d.length; i++) {
          if (Math.abs(d[i]) < 1e-4) continue
          amostras++
          const sinal = d[i] > 0 ? 1 : -1
          if (ultimo && sinal !== ultimo) cruzou++
          ultimo = sinal
        }
        const agudez = amostras ? Math.round((cruzou / amostras) * 44100 / 2) : 0
        // quanto tempo houve som de verdade
        let dur = 0
        for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.002) dur = i
        saida.push({
          especie,
          nome: nomeDaVoz(especie),
          rms: +(rms * 1000).toFixed(2),
          agudez,
          duracao: +(dur / 44100).toFixed(2),
        })
      }
      if (vivo) setMedidas(saida)
    }
    medir()
    return () => { vivo = false }
  }, [])

  function tocar(especie) {
    window.casalSound?.('pet', especie)
  }

  if (!medidas) return <p className="muted small">Sintetizando as vozes…</p>
  if (medidas === 'sem-suporte') return <p className="notice warn">Este navegador não renderiza áudio offline.</p>

  const mudas = medidas.filter((m) => m.rms <= 0.01)
  // Duas vozes com agudez muito parecida soam iguais na prática.
  const parecidas = []
  for (let i = 0; i < medidas.length; i++) {
    for (let j = i + 1; j < medidas.length; j++) {
      const a = medidas[i]
      const b = medidas[j]
      const dif = Math.abs(a.agudez - b.agudez) / Math.max(a.agudez, b.agudez, 1)
      if (dif < 0.12) parecidas.push(`${a.especie} e ${b.especie}`)
    }
  }

  return (
    <>
      <p className="muted small">
        Cada voz é sintetizada sem tocar nada e medida. Toque para ouvir —
        o áudio só liga depois do primeiro toque na página (regra do iPhone).
      </p>
      {mudas.length > 0 && (
        <p className="notice error">Sem som nenhum: {mudas.map((m) => m.especie).join(', ')}</p>
      )}
      {parecidas.length > 0 && (
        <p className="notice error">
          Vozes quase idênticas (soariam iguais): {parecidas.join(' · ')}
        </p>
      )}
      <div className="lab-grid lab-vozes">
        {medidas.map((m) => (
          <button key={m.especie} className="lab-tile" onClick={() => tocar(m.especie)}>
            <strong>{m.especie}</strong>
            <span className="lab-tile-label">
              {m.nome} · {m.duracao}s<br />
              volume {m.rms} · agudez {m.agudez} Hz
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

function Tile({ label, width, height, paint, animate = false }) {
  const ref = useRef(null)
  const [painted, setPainted] = useState(null)

  useEffect(() => {
    setPainted(countPainted(width, height, (p) => paint(p, 0)))
    const painter = new Painter(ref.current)
    painter.resize(width, height)
    let raf
    const pintar = (t) => {
      painter.clear()
      paint(painter, t)
    }
    const loop = (t) => {
      pintar(t)
      raf = requestAnimationFrame(loop)
    }

    // Um quadro NA HORA, antes de pedir animação — e isto vale também aqui.
    //
    // Esta era a última peça do app que ainda caía na armadilha já registrada no
    // HANDOFF: `requestAnimationFrame` não roda em aba que o navegador não está
    // compondo. O bloco animado só desenhava dentro do laço, então em aba de
    // segundo plano ele ficava com **zero pixel pintado** — e apareceu do jeito
    // mais irônico possível: conferindo os 132 blocos de animação novos, os 132
    // leram vazio na tela enquanto a marca de "⚠ vazio" dizia que estava tudo
    // certo (ela conta num canvas de rascunho, que é pintado de forma síncrona).
    // Ou seja: a bancada estava aprovando arte que ninguém veria.
    pintar(0)
    if (animate) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [label, width, height, animate])

  const empty = painted !== null && painted < MIN_PIXELS
  return (
    <div className={`lab-tile ${empty ? 'lab-empty' : ''}`}>
      <canvas ref={ref} className="pixel-canvas" style={{ width, height }} />
      <div className="tiny muted center">
        {label}
        {empty ? ' ⚠ vazio' : ''}
      </div>
    </div>
  )
}

const BASE_AVATAR = {
  skin: '#eec1a2', hair_style: 'curto', hair_color: '#2b1b12',
  eyes: 'redondo', eye_color: '#3b2a20', mouth: 'sorriso', brows: 'reta',
  top: 'camiseta', top_color: '#5b8def', bottom: 'jeans', bottom_color: '#3c5a99',
  shoes: 'tenis', shoes_color: '#f0f0f0', head: '', extra: '', blush: false,
}

export default function ShapeLab() {
  const [dir, setDir] = useState(0)
  const [aba, setAba] = useState('moveis')

  const abas = [
    { key: 'moveis', name: `Móveis (${Object.keys(SHAPES).length})` },
    { key: 'avatar', name: 'Avatar' },
    { key: 'bichinhos', name: `Bichinhos (${LAB_SPECIES.length * LAB_STAGES.length})` },
    { key: 'humores', name: `Humores (${LAB_MOODS.length * 2})` },
    { key: 'animacoes', name: `Animações (${LAB_SPECIES.length * NOMES_CLIPES.length})` },
    { key: 'crescimento', name: `Crescimento (${LAB_SPECIES.length * LAB_CRESCIMENTO.length})` },
    { key: 'vestidos', name: `Vestidos (${LAB_SPECIES.length * LAB_ACESSORIOS.length})` },
    { key: 'escala', name: `Escala grande (${LAB_SPECIES.length})` },
    { key: 'vozes', name: `Vozes (${Object.keys(VOZES).length})` },
    { key: 'itens', name: `Itens (${PET_ICON_CODES.length})` },
    { key: 'figurinhas', name: `Figurinhas (${STICKER_CODES.length})` },
    { key: 'cores', name: 'Acabamentos' },
  ]

  return (
    <>
      <h1 className="screen-title">Bancada</h1>
      <div className="shop-tabs">
        {abas.map((a) => (
          <button
            key={a.key}
            className={aba === a.key ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setAba(a.key)}
          >
            {a.name}
          </button>
        ))}
      </div>

      {aba === 'moveis' && (
        <>
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            {[0, 1, 2, 3].map((d) => (
              <button
                key={d}
                className={dir === d ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                onClick={() => setDir(d)}
              >
                {d * 90}°
              </button>
            ))}
          </div>
          <div className="lab-grid">
            {Object.keys(SHAPES).map((shape) => {
              const [w, d] = SIZES[shape] || [1, 1]
              const cols = Math.max(w, d) + 2
              const metrics = roomMetrics(cols, cols, 2)
              return (
                <Tile
                  key={shape}
                  label={`${shape} · ${dir * 90}°`}
                  width={metrics.width}
                  height={metrics.height}
                  animate
                  paint={(p, t) =>
                    drawScene(
                      p,
                      {
                        cols,
                        rows: cols,
                        floor: 'ceramica',
                        wall: 'padrao',
                        items: [{ id: 1, shape, col: 1, row: 1, w, d, dir }],
                      },
                      {},
                      t
                    )
                  }
                />
              )
            })}
          </div>
        </>
      )}

      {aba === 'avatar' && (
        <>
          {Object.entries(STYLE_LISTS).map(([slot, styles]) => (
            <div key={slot}>
              <p className="group-title">{slot}</p>
              <div className="lab-grid">
                {styles.map((style) => {
                  const field =
                    slot === 'hair'
                      ? 'hair_style'
                      : slot === 'eyes' || slot === 'mouth' || slot === 'brows'
                        ? slot
                        : slot
                  return (
                    <Tile
                      key={`${slot}-${style}`}
                      label={style}
                      width={AVATAR_W + 8}
                      height={AVATAR_H + 8}
                      paint={(p) => drawAvatar(p, { ...BASE_AVATAR, [field]: style }, 4, 4)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'bichinhos' && (
        <div className="lab-grid">
          {LAB_SPECIES.flatMap(([code, colors]) =>
            LAB_STAGES.map((stage) => (
              <Tile
                key={`${code}-${stage}`}
                label={`${code} · ${stage}`}
                width={128}
                height={108}
                paint={(p, t) =>
                  drawPet(
                    p,
                    { species: code, colors, stage, mood: 'feliz', accessories: {}, mess_count: 0 },
                    t
                  )
                }
              />
            ))
          )}
        </div>
      )}

      {aba === 'humores' && (
        <div className="lab-grid">
          {LAB_MOODS.map((mood) => (
            <Tile
              key={mood}
              label={`gato · ${mood}`}
              width={128}
              height={108}
              paint={(p, t) =>
                drawPet(
                  p,
                  {
                    species: 'gato',
                    colors: ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2'],
                    stage: 'jovem',
                    mood,
                    sick: mood === 'doente',
                    accessories: {},
                    mess_count: 0,
                  },
                  t
                )
              }
            />
          ))}
          {[['pet_coleira', 'neck'], ['pet_gravata', 'neck'], ['pet_chapeu', 'head'], ['pet_oculos_pet', 'head']].map(
            ([item, slot]) => (
              <Tile
                key={item}
                label={`gato · ${item.replace('pet_', '')}`}
                width={128}
                height={108}
                paint={(p, t) =>
                  drawPet(
                    p,
                    {
                      species: 'gato',
                      colors: ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2'],
                      stage: 'jovem',
                      mood: 'feliz',
                      accessories: { [slot]: item },
                      mess_count: 0,
                    },
                    t
                  )
                }
              />
            )
          )}
        </div>
      )}

      {/* Toda especie em TODA acao.
          Esta e a aba que faltava: o motor novo tem clipe por acao, e clipe que
          nao desenha nada (ou que joga o bichinho pra fora da caixa de 128x108)
          nao da erro nenhum — some calado, exatamente como sumiram os icones
          `drop`/`sparkle`/`lock` na revisao anterior. Aqui cada combinacao e
          pintada e CONTADA. */}
      {aba === 'animacoes' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {NOMES_CLIPES.map((clipe) => {
                  // O clipe pedido nem sempre e o clipe rodado: coelho nao anda
                  // (saltita) e capivara nao voa (pula). A bancada mostra os dois
                  // nomes pra essa traducao ficar visivel, e nao escondida.
                  const real = clipeDe(clipe, planoDe(code, 1))
                  return (
                    <Tile
                      key={`${code}-${clipe}`}
                      label={real === clipe ? clipe : `${clipe} → ${real}`}
                      width={128}
                      height={108}
                      animate
                      paint={(p, t) =>
                        drawPet(
                          p,
                          {
                            species: code, colors, growth: 1, mood: 'feliz',
                            accessories: {}, mess_count: 0, action: clipe,
                          },
                          t
                        )
                      }
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* O crescimento, lado a lado. Filhote e adulto tem que ser a MESMA especie
          com outra proporcao — se saissem iguais, so menor, a evolucao seria zoom. */}
      {aba === 'crescimento' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {LAB_CRESCIMENTO.map((g) => (
                  <Tile
                    key={`${code}-${g}`}
                    label={`${code} · ${Math.round(g * 100)}%`}
                    width={128}
                    height={108}
                    paint={(p, t) =>
                      drawPet(
                        p,
                        {
                          species: code, colors, growth: g, mood: 'feliz',
                          accessories: {}, mess_count: 0, action: 'parado',
                        },
                        t
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'vestidos' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {LAB_ACESSORIOS.map(([item, slot, acao]) => (
                  <Tile
                    key={`${code}-${item}-${acao}`}
                    label={`${item.replace('pet_', '')} · ${acao}`}
                    width={128}
                    height={108}
                    animate
                    paint={(p, t) =>
                      drawPet(
                        p,
                        {
                          species: code, colors, growth: 1, mood: 'feliz',
                          accessories: { [slot]: item }, mess_count: 0, action: acao,
                        },
                        t
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'escala' && (
        <>
          {/* A ABA QUE FALTAVA, e a falta dela custou caro.

              Todo o resto da bancada desenha na caixa de referencia (128x108,
              escala 1). Quando a tela do bichinho passou a desenhar GRANDE, a
              bancada continuou aprovando tudo — porque uma pilha de defeitos so
              existe quando a escala e diferente de 1: medida escrita em pixel
              cru que nao acompanha, contorno que vira fio, e principalmente a
              escala que era aplicada duas vezes nas poses (1x1 continua 1, e por
              isso ninguem via).

              Aqui cada especie e desenhada no MESMO tamanho em que ela aparece
              na tela do bichinho. E aqui que se olha depois de mexer no rig. */}
          <p className="muted small">
            Cada bicho no tamanho em que ele aparece na tela dele. Defeito de
            escala só existe fora do 1× — é nesta aba que ele aparece.
          </p>
          <div className="lab-grid lab-grid-grande">
            {LAB_SPECIES.map(([code, colors]) => {
              // O MESMO bicho, medido nas duas escalas. Ele tem que ocupar a
              // mesma fracao do quadro nas duas — se nao ocupa, alguma medida
              // ficou presa em pixel e nao acompanhou.
              // A medida e feita ANDANDO, e no meio do passo.
              //
              // Em `parado` os pes ficam quase no lugar, e era justamente nos
              // deslocamentos de pose que estava a escala aplicada duas vezes —
              // medir parado deixaria o defeito passar de novo. Andar poe perna,
              // corpo e cabeca todos fora da posicao neutra, que e onde o erro
              // aparece.
              const pintar = (escalaDe) => (p) => {
                const pet = { species: code, colors, stage: 'adulto', growth: 1,
                  mood: 'feliz', accessories: {}, mess_count: 0, action: 'andar' }
                const m = planoDe(code, 1, 1)
                const aU = m.pernaA + m.corpoA * 1.15
                  + m.cabecaA * (m.orelha === 'longa' ? 2.15 : 1.5)
                const lU = m.corpoL + m.caudaL * 0.8 + m.cabecaL
                const esc = escalaDe(p)
                drawPet(p, pet, 700, esc, { cx: p.w / 2, chao: p.h * 0.84 })
              }
              const ajustar = (p) => {
                const m = planoDe(code, 1, 1)
                const aU = m.pernaA + m.corpoA * 1.15
                  + m.cabecaA * (m.orelha === 'longa' ? 2.15 : 1.5)
                const lU = m.corpoL + m.caudaL * 0.8 + m.cabecaL
                return Math.min((p.h * 0.74) / aU, (p.w * 0.92) / lU)
              }
              const pequeno = caixaPintada(128, 108, pintar(ajustar))
              const medio = caixaPintada(256, 216, pintar(ajustar))
              const grande = caixaPintada(384, 324, pintar(ajustar))
              const fmt = (b) => b ? `${(b.larg*100).toFixed(1)}x${(b.alt*100).toFixed(1)}` : '-'
              const detalhe = `1x ${fmt(pequeno)} | 2x ${fmt(medio)} | 3x ${fmt(grande)}`
              // A conferencia e entre 2x e 3x, e o 1x fica so pra olhar.
              //
              // Nao e o teste sendo afrouxado pra passar: e que abaixo de ~2x a
              // arte PERDE detalhe de verdade, e isso e uma decisao antiga do
              // projeto (HANDOFF 9.5: abaixo de 0,8 de escala a miudeza nao e
              // desenhada). Uma cauda que afina ate meio pixel simplesmente nao
              // cabe num quadro de 128, e a largura medida cai — foi exatamente
              // o que apareceu aqui: a ALTURA bate nas tres escalas e so a
              // largura encolhe no 1x, que e a assinatura de ponta fina sumindo,
              // e nao de medida presa em pixel (essa mexeria nas duas).
              //
              // Entre 2x e 3x nao ha essa perda, entao qualquer diferenca ali e
              // defeito de escala de verdade — que e o que esta linha guarda.
              const desvio = medio && grande
                ? Math.max(
                  Math.abs(medio.larg - grande.larg) / medio.larg,
                  Math.abs(medio.alt - grande.alt) / medio.alt,
                )
                : 1
              // 8% de folga: o arredondamento pra pixel inteiro sozinho ja mexe
              // um pouco na borda, e cobrar exatidao daria alarme falso.
              const torto = desvio > 0.08
              return (
              <div key={`escala-${code}`} className={torto ? 'lab-fora-de-escala' : undefined}>
              {torto && (
                <p className="notice error">
                  {code}: ocupa {(medio ? medio.larg * 100 : 0).toFixed(0)}% do quadro em 2×
                  e {(grande ? grande.larg * 100 : 0).toFixed(0)}% em 3× — alguma medida não
                  está acompanhando a escala.
                </p>
              )}
              <Tile
                label={`${code} · ${detalhe} · desvio 2→3 ${(desvio * 100).toFixed(1)}%`}
                width={384}
                height={324}
                animate
                paint={(p, t) => {
                  const pet = { species: code, colors, stage: 'adulto', growth: 1,
                    mood: 'feliz', accessories: { neck: 'pet_coleira' }, mess_count: 0 }
                  const medida = planoDe(code, 1, 1)
                  const alturaU = medida.pernaA + medida.corpoA * 1.15
                    + medida.cabecaA * (medida.orelha === 'longa' ? 2.6 : 1.55)
                  const larguraU = medida.corpoL + medida.caudaL * 0.8 + medida.cabecaL
                  const escala = Math.min((p.h * 0.74) / alturaU, (p.w * 0.92) / larguraU)
                  drawPet(p, pet, t, escala, { cx: p.w / 2, chao: p.h * 0.84 })
                }}
              />
              </div>
              )
            })}
          </div>
        </>
      )}

      {aba === 'vozes' && <AbaVozes />}

      {aba === 'itens' && (
        <div className="lab-grid">
          {PET_ICON_CODES.map((code) => (
            <Tile
              key={code}
              label={code.replace('pet_', '')}
              width={32}
              height={32}
              paint={(p) => drawPetIcon(p, code, '')}
            />
          ))}
        </div>
      )}

      {aba === 'figurinhas' && (
        <>
          {/* Figurinha sem nome aparece como problema, do mesmo jeito que
              figurinha que nao desenha: no seletor ela viraria um bonequinho
              sem legenda, e o dono pediu a lista COM nome. */}
          {STICKER_CODES.some((c) => !STICKER_LABEL[c]) && (
            <p className="notice error">
              Sem nome: {STICKER_CODES.filter((c) => !STICKER_LABEL[c]).join(', ')}
            </p>
          )}
        {/* A bancada mostra a figurinha COMO O CHAT MOSTRA.

            Antes ela desenhava todas em pixel, chamando `drawSticker` direto.
            Isso conferia um desenho que o app nao usa mais: `Sticker` prefere a
            versao redonda (SVG) e so cai no pixel quando a redonda nao existe.
            Ou seja, a unica arte que a bancada olhava era justamente a que o
            chat NAO mostra — e um erro na versao redonda (que foi o que
            aconteceu: um componente com o nome errado derrubando o app inteiro)
            passava aqui como se estivesse tudo certo. */}
        <div className="lab-grid">
          {STICKER_CODES.map((code) => (
            <div key={code} className="lab-tile">
              <Sticker code={code} scale={2} />
              <span className="lab-tile-label">
                {STICKER_LABEL[code] || `${code} ⚠ sem nome`}
                {!STICKERS_HD[code] && ' ⚠ ainda em pixel'}
              </span>
            </div>
          ))}
        </div>
        </>
      )}

      {aba === 'cores' && (
        <div className="card">
          <p className="card-title">Pisos e paredes</p>
          <div className="row wrap" style={{ gap: 12 }}>
            {[
              ...Object.entries(FLOOR_STYLES).map(([k, v]) => ['piso ' + k, v.base]),
              ...Object.entries(WALL_STYLES).map(([k, v]) => ['parede ' + k, v.base]),
            ].map(([name, color]) => (
              <div key={name} className="tiny center">
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: color,
                    border: '2px solid var(--ink)',
                    borderRadius: 8,
                  }}
                />
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
