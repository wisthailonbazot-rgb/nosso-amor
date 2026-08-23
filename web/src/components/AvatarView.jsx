import { useEffect, useRef } from 'react'

import { AVATAR_H, AVATAR_W, paintAvatar } from '../render/avatar'

/**
 * O boneco na tela. `scale` é sempre inteiro — meio pixel borra a arte.
 */
export default function AvatarView({ config, scale = 2, padding = 4, className = '', style }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && config) paintAvatar(ref.current, config, { padding })
  }, [config, padding])

  const w = (AVATAR_W + padding * 2) * scale
  const h = (AVATAR_H + padding * 2 + 4) * scale

  return (
    <canvas
      ref={ref}
      className={`pixel-canvas ${className}`}
      style={{ width: w, height: h, ...style }}
    />
  )
}
