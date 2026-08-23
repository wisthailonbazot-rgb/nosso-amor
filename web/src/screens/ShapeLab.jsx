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
import { drawSticker, STICKER_CODES, STICKER_SIZE } from '../render/stickers'

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

function Tile({ label, width, height, paint, animate = false }) {
  const ref = useRef(null)
  const [painted, setPainted] = useState(null)

  useEffect(() => {
    setPainted(countPainted(width, height, (p) => paint(p, 0)))
    const painter = new Painter(ref.current)
    painter.resize(width, height)
    let raf
    const loop = (t) => {
      painter.clear()
      paint(painter, t)
      if (animate) raf = requestAnimationFrame(loop)
    }
    if (animate) raf = requestAnimationFrame(loop)
    else loop(0)
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
        <div className="lab-grid">
          {STICKER_CODES.map((code) => (
            <Tile
              key={code}
              label={code}
              width={STICKER_SIZE * 2}
              height={STICKER_SIZE * 2}
              paint={(p) => {
                p.ctx.save()
                p.ctx.scale(2, 2)
                drawSticker(p, code)
                p.ctx.restore()
              }}
            />
          ))}
        </div>
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
