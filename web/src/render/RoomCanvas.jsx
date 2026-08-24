import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Painter } from './pixel'
import { drawScene } from './room'
import { WALL_HEIGHT } from './room'
import { roomMetrics, unproject } from './iso'

/**
 * O cômodo na tela.
 *
 * O canvas é desenhado na resolução da arte e ampliado por CSS num fator INTEIRO.
 * Fator inteiro é o detalhe que importa: em 1,5x cada pixel viraria um pixel e meio,
 * e a arte sairia com franjas — o contrário do que se quer em pixel art.
 */
export default function RoomCanvas({
  scene,
  editing = false,
  hover = null,
  selectedId = null,
  onPickTile,
  onReleaseTile,
  animated = true,
  maxScale = 4,
}) {
  const holderRef = useRef(null)
  const canvasRef = useRef(null)
  const painterRef = useRef(null)
  const stateRef = useRef({ scene, editing, hover, selectedId })
  const [scale, setScale] = useState(1)

  stateRef.current = { scene, editing, hover, selectedId }

  const metrics = roomMetrics(scene.cols, scene.rows, WALL_HEIGHT)

  // Escala INTEIRA. Nunca 1,5x: meio pixel de arte vira franja e acaba com o
  // aspecto de pixel art. Se nem 1x couber na largura, o cômodo passa a rolar
  // pro lado — é o que jogo de decoração faz, e é melhor do que encolher a arte.
  useLayoutEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const measure = () => {
      const available = holder.clientWidth
      const fit = Math.max(1, Math.min(maxScale, Math.floor(available / metrics.width)))
      setScale(fit)
      // começa centralizado no cômodo, não encostado na parede da esquerda
      if (metrics.width * fit > available) {
        holder.scrollLeft = (metrics.width * fit - available) / 2
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(holder)
    return () => observer.disconnect()
  }, [metrics.width, maxScale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!painterRef.current) painterRef.current = new Painter(canvas)
    painterRef.current.resize(metrics.width, metrics.height)

    let frame = 0
    let running = true
    const paint = (t) => {
      const s = stateRef.current
      drawScene(painterRef.current, s.scene, { editing: s.editing, hover: s.hover, selectedId: s.selectedId }, t)
    }
    const loop = (t) => {
      if (!running) return
      paint(t)
      if (animated) frame = requestAnimationFrame(loop)
    }

    // Um quadro DESENHADO NA HORA, antes de pedir o primeiro `requestAnimationFrame`.
    //
    // O motivo apareceu na bancada: `requestAnimationFrame` nao roda em aba que
    // o navegador nao esta compondo (segundo plano, celular com a tela travada,
    // app aberto e minimizado). Sem este desenho imediato, quem volta pro app
    // encontra um retangulo VAZIO ate o navegador resolver animar de novo — e
    // o cenario parece quebrado, quando na verdade so nao chegou a ser pintado.
    paint(performance.now())
    if (animated) frame = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [metrics.width, metrics.height, animated])

  function tileFromEvent(event) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const point = event.touches?.[0] || event.changedTouches?.[0] || event
    const x = (point.clientX - rect.left) / (rect.width / metrics.width)
    const y = (point.clientY - rect.top) / (rect.height / metrics.height)
    const [col, row] = unproject(x, y, metrics.origin)
    if (col < 0 || row < 0 || col >= scene.cols || row >= scene.rows) return null
    // `x` e `y` vão junto de propósito: quem quiser acertar o que está DESENHADO
    // (e não a célula do chão) precisa do pixel. O bichinho é o caso — o corpo
    // dele é pintado bem acima da célula em que ele pisa.
    return { col, row, x, y }
  }

  // ------------------------------------------------------------------ arrastar
  // O cômodo é maior que a tela do celular, e a escala é INTEIRA de propósito
  // (meio pixel de arte vira franja). Então, quando não cabe, a saída não é
  // encolher a arte: é deixar deslocar a vista. Fora do modo de arrumar, o dedo
  // arrasta o cômodo; dentro dele, o dedo move o móvel.
  const arrasto = useRef(null)

  function inicioArrasto(e) {
    if (editing) return
    const holder = holderRef.current
    arrasto.current = {
      x: e.clientX,
      y: e.clientY,
      left: holder.scrollLeft,
      top: holder.scrollTop,
      id: e.pointerId,
    }
    // `setPointerCapture` estoura se o ponteiro ja nao estiver ativo (dedo que
    // saiu da tela, ponteiro sintetico). Sem o try, essa excecao derruba o
    // handler inteiro e o arrasto nao acontece — foi exatamente o que apareceu
    // na bancada.
    try {
      holder.setPointerCapture?.(e.pointerId)
    } catch {
      /* segue sem captura: o arrasto ainda funciona enquanto o dedo estiver em cima */
    }
  }

  function moverArrasto(e) {
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    const holder = holderRef.current
    holder.scrollLeft = a.left - (e.clientX - a.x)
    holder.scrollTop = a.top - (e.clientY - a.y)
  }

  function fimArrasto(e) {
    const a = arrasto.current
    if (a) {
      try {
        holderRef.current?.releasePointerCapture?.(a.id)
      } catch {
        /* ja tinha sido solto */
      }
    }
    arrasto.current = null
  }

  return (
    <div
      ref={holderRef}
      className={`room-holder ${editing ? 'editando' : 'arrastavel'}`}
      onPointerDown={inicioArrasto}
      onPointerMove={moverArrasto}
      onPointerUp={fimArrasto}
      onPointerCancel={fimArrasto}
    >
      <canvas
        ref={canvasRef}
        className="room-canvas"
        style={{ width: metrics.width * scale, height: metrics.height * scale }}
        onPointerDown={(e) => {
          if (!onPickTile) return
          const tile = tileFromEvent(e)
          if (tile) onPickTile(tile, e)
        }}
        onPointerMove={(e) => {
          if (!onPickTile || !editing) return
          const tile = tileFromEvent(e)
          if (tile) onPickTile(tile, e, true)
        }}
        onPointerUp={(e) => {
          if (!onReleaseTile) return
          const tile = tileFromEvent(e)
          onReleaseTile(tile, e)
        }}
        onPointerCancel={(e) => onReleaseTile?.(null, e)}
      />
    </div>
  )
}
