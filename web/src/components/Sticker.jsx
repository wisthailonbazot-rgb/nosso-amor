import { useEffect, useRef } from 'react'

import { Painter } from '../render/pixel'
import { STICKER_LABEL, STICKER_SIZE, drawSticker } from '../render/stickers'
import StickerHD, { STICKERS_HD } from '../render/stickersHD'

export default function Sticker({ code, scale = 3, onClick, className = '', comNome = false }) {
  const ref = useRef(null)

  // A figurinha realista (SVG) tem preferencia; a de pixel continua valendo pras
  // que ainda nao foram redesenhadas. Assim da pra converter uma a uma sem
  // nenhum buraco na tela no meio do caminho.
  const temHD = !!STICKERS_HD[code]

  useEffect(() => {
    if (temHD || !ref.current) return
    const painter = new Painter(ref.current)
    painter.resize(STICKER_SIZE, STICKER_SIZE)
    painter.clear()
    drawSticker(painter, code)
  }, [code, temHD])

  const size = STICKER_SIZE * scale
  const canvas = temHD ? (
    <span className={`sticker-hd ${className}`} style={{ width: size, height: size }}>
      <StickerHD code={code} size={size} />
    </span>
  ) : (
    <canvas ref={ref} className={`pixel-canvas ${className}`} style={{ width: size, height: size }} />
  )

  const nome = STICKER_LABEL[code] || code
  if (!onClick) return canvas
  return (
    // `aria-label` sempre com o nome falado, nao com o codigo: quem usa leitor
    // de tela ouvia "toma_amor" no lugar de "Toma s2".
    <button className={`sticker-btn ${comNome ? 'com-nome' : ''}`} onClick={onClick} aria-label={nome}>
      {canvas}
      {comNome && <span className="sticker-nome">{nome}</span>}
    </button>
  )
}
