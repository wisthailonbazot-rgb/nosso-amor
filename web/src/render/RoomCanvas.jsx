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
  // `perto` é o quanto a pessoa se APROXIMOU, somado à escala que cabe na tela.
  // Fica separado do ajuste automático de propósito: se fosse tudo o mesmo
  // número, girar o celular (que remede o espaço) jogaria fora a aproximação
  // que a pessoa escolheu.
  const [perto, setPerto] = useState(0)
  const [cabe, setCabe] = useState(1)

  stateRef.current = { scene, editing, hover, selectedId }

  const metrics = roomMetrics(scene.cols, scene.rows, WALL_HEIGHT)

  // Escala INTEIRA. Nunca 1,5x: meio pixel de arte vira franja e acaba com o
  // aspecto de pixel art. Se nem 1x couber na largura, o cômodo passa a rolar
  // pro lado — é o que jogo de decoração faz, e é melhor do que encolher a arte.
  //
  // No celular, "o que cabe" dá quase sempre 1x — o cômodo tem 434 px de arte e
  // a tela tem 375. Aí o bichinho aparece com os 62 px dele e some no cenário.
  // Por isso existe o APROXIMAR: a escala sobe em passos inteiros e o cômodo
  // passa a rolar, que é como jogo de decoração faz. Encolher a arte pra caber
  // seria o contrário do que se quer.
  const ZOOM_MAX = 4
  useLayoutEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const measure = () => {
      const available = holder.clientWidth
      setCabe(Math.max(1, Math.min(maxScale, Math.floor(available / metrics.width))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(holder)
    return () => observer.disconnect()
  }, [metrics.width, maxScale])

  useLayoutEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const alvo = Math.max(1, Math.min(ZOOM_MAX, cabe + perto))
    if (alvo === scale) return
    // Aproximar tem que manter o MEIO da vista no lugar. Sem isto, cada passo de
    // zoom joga a pessoa pro canto superior esquerdo do cômodo e ela perde de
    // vista o que estava olhando — normalmente o bichinho.
    const meioX = (holder.scrollLeft + holder.clientWidth / 2) / (metrics.width * scale)
    const meioY = (holder.scrollTop + holder.clientHeight / 2) / (metrics.height * scale)
    setScale(alvo)
    requestAnimationFrame(() => {
      holder.scrollLeft = meioX * metrics.width * alvo - holder.clientWidth / 2
      holder.scrollTop = meioY * metrics.height * alvo - holder.clientHeight / 2
    })
  }, [cabe, perto, scale, metrics.width, metrics.height])

  const aproximar = (passo) => setPerto((v) => {
    const alvo = Math.max(1, Math.min(ZOOM_MAX, cabe + v + passo))
    return alvo - cabe
  })

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
  // A pinça de dois dedos é o gesto que todo mundo tenta primeiro num cenário.
  // Ela mexe no MESMO `perto` dos botões — não existe um segundo nível de zoom.
  const pinca = useRef(null)
  const dedos = useRef(new Map())

  function distanciaDosDedos() {
    const [a, b] = [...dedos.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function inicioArrasto(e) {
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size === 2) {
      arrasto.current = null           // dois dedos: é pinça, não arrasto
      pinca.current = distanciaDosDedos()
      return
    }
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
    if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size === 2 && pinca.current != null) {
      const agora = distanciaDosDedos()
      // Um passo por vez, com folga de 45 px: sem a folga, o tremor natural dos
      // dedos faria a escala pular pra frente e pra trás sem parar.
      if (agora - pinca.current > 45) { aproximar(1); pinca.current = agora }
      else if (pinca.current - agora > 45) { aproximar(-1); pinca.current = agora }
      return
    }
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    const holder = holderRef.current
    holder.scrollLeft = a.left - (e.clientX - a.x)
    holder.scrollTop = a.top - (e.clientY - a.y)
  }

  function fimArrasto(e) {
    dedos.current.delete(e.pointerId)
    if (dedos.current.size < 2) pinca.current = null
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
    // Os botões de aproximar ficam FORA do contêiner que rola.
    //
    // Estavam dentro, posicionados de forma absoluta — e aí, ao aproximar, eles
    // rolavam junto com o cômodo e sumiam da tela. Quem aproximasse não teria
    // mais como afastar. É a mesma armadilha de sempre: elemento absoluto se
    // ancora no primeiro pai posicionado, e o pai posicionado era justamente o
    // que se move.
    <div className="room-wrap">
      <div className="room-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Afastar" disabled={scale <= 1} onClick={() => aproximar(-1)}>–</button>
        <span>{scale}×</span>
        <button type="button" aria-label="Aproximar" disabled={scale >= ZOOM_MAX} onClick={() => aproximar(1)}>+</button>
      </div>
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
    </div>
  )
}
