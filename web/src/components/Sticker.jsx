import { useEffect, useRef } from 'react'

import { Painter } from '../render/pixel'
import { STICKER_SIZE, drawSticker } from '../render/stickers'

export default function Sticker({ code, scale = 3, onClick, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const painter = new Painter(ref.current)
    painter.resize(STICKER_SIZE, STICKER_SIZE)
    painter.clear()
    drawSticker(painter, code)
  }, [code])

  const size = STICKER_SIZE * scale
  const canvas = (
    <canvas ref={ref} className={`pixel-canvas ${className}`} style={{ width: size, height: size }} />
  )

  if (!onClick) return canvas
  return (
    <button className="sticker-btn" onClick={onClick} aria-label={code}>
      {canvas}
    </button>
  )
}
