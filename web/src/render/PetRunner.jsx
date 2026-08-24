import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Painter } from './pixel'
import { drawPet } from './PetCanvas'

/**
 * Corrida do bichinho.
 *
 * Ele corre sozinho e você decide QUANDO pular e QUANDO abaixar. Obstáculo tira
 * uma vida, petisco vale ponto. Três vidas e acabou.
 *
 * Três escolhas que valem explicar:
 *
 * 1. **O jogo inteiro roda no laço de desenho, não no React.** Posição do
 *    bichinho, dos obstáculos e do chão mudam ~60 vezes por segundo; se cada
 *    quadro virasse `setState`, a árvore de componentes seria reconstruída 60
 *    vezes por segundo pra mexer três números. O React só fica sabendo do que
 *    interessa a ELE: pontos, vidas e o fim da partida.
 *
 * 2. **O bichinho é o mesmo desenho do resto do app.** Não existe um sprite
 *    "de corrida": é o `drawPet` de sempre, recebendo `action`. Assim o gato
 *    continua gato e o dragão continua dragão dentro do jogo, e o acessório que
 *    vocês compraram aparece aqui também. Com o motor novo (`petRig.js`), ele
 *    ainda por cima corre em GALOPE de verdade e abaixa dobrando as pernas.
 *
 * 3. **A pista se ajusta ao espaço, pela ALTURA.** A largura da arte é fixa em
 *    320 e a altura acompanha o formato do quadro, então em tela cheia o que
 *    sobra vira céu. O motivo de ser a altura, e não a largura, está explicado
 *    junto da conta — são dois defeitos medidos, não preferência.
 */

const LARGURA_ARTE = 320  // largura da arte, em pixels de canvas; a ALTURA acompanha
const ALTURA_MIN = 120
const ALTURA_MAX = 340
const CHAO_DO_FUNDO = 32  // o chão fica sempre a esta distância da borda de baixo
const GRAVIDADE = 0.42
const IMPULSO = -6.4
const VEL_INICIAL = 1.5
const TETO_PONTOS = 40    // igual ao teto do servidor em `JOGOS`

/** Quanto o dedo precisa andar pra virar gesto, em pixels de tela. */
const GESTO_MIN = 22

// O bichinho na pista: desenhado direto neste tamanho, sem redução.
//
// Cresceu junto com a altura da pista, e os dois têm que andar juntos: o pulo
// sobe uns 49 px (IMPULSO²/2·GRAVIDADE), então um bichinho maior numa pista
// baixa bate a cabeça no topo do quadro e some pela borda no ponto mais alto do
// salto — justamente quando a pessoa está olhando pra ele.
const PET_L = 84
const PET_A = 72
const PET_ESCALA = PET_A / 108
// Onde ele corre, em pixels de arte. UM número, usado pela colisão E pelo
// desenho: separados, eles divergem na primeira vez que alguém mexer num só, e
// o jogo passa a bater em coisa que não encostou nele.
const PET_X = 60

/**
 * O que vem vindo pela pista.
 *
 *   pedra    — baixo: tem que PULAR
 *   tronco   — baixo e largo: pular, e o pulo precisa ser no tempo certo
 *   galho    — ALTO: pular não adianta, tem que ABAIXAR
 *   abelha   — alta e balançando: também é de abaixar
 *   petisco  — ponto, no chão
 *   ossinho  — ponto, no alto: só pega pulando
 *
 * Ter obstáculo alto é o que dá sentido ao abaixar. Sem ele, abaixar seria um
 * botão a mais sem motivo — e o jogo continuaria sendo "toque pra pular".
 */
const TIPOS = {
  pedra: { altura: 'baixo', pontos: 0 },
  tronco: { altura: 'baixo', pontos: 0 },
  galho: { altura: 'alto', pontos: 0 },
  abelha: { altura: 'alto', pontos: 0 },
  petisco: { altura: 'baixo', pontos: 1 },
  ossinho: { altura: 'alto', pontos: 1 },
}

const nascer = (x, tipo) => ({ x, tipo, pego: false })

/** Sorteia o que vem, apertando conforme o placar sobe. */
function sortear(pontos) {
  const r = Math.random()
  if (r < 0.34) return pontos > 6 && Math.random() < 0.4 ? 'ossinho' : 'petisco'
  if (r < 0.56) return 'pedra'
  if (r < 0.72) return 'tronco'
  // os de abaixar só entram depois que a pessoa pegou o jeito de pular
  if (pontos < 3) return 'pedra'
  return r < 0.87 ? 'galho' : 'abelha'
}

export default function PetRunner({ pet, aoTerminar, telaCheia = false }) {
  const quadroRef = useRef(null)
  const canvasRef = useRef(null)
  const jogoRef = useRef(null)
  const [placar, setPlacar] = useState({ pontos: 0, vidas: 3, rodando: false })
  const [fim, setFim] = useState(null)
  const [dim, setDim] = useState({ w: LARGURA_ARTE, h: 150, chao: 150 - CHAO_DO_FUNDO })

  // ---------------------------------------------------------------- tamanho
  //
  // A LARGURA da arte é fixa e a ALTURA é que acompanha o quadro. Poderia ser o
  // contrário, e na primeira versão era — deu errado por dois motivos, os dois
  // medidos na bancada:
  //
  //  1. **pixel deixava de ser quadrado.** Em tela cheia o quadro ficou 942×723
  //     (proporção 1,30) enquanto a arte saía 240×150 (proporção 1,60). Com o
  //     canvas esticado a 100% nos dois eixos, cada pixel virava 3,9 de largura
  //     por 4,8 de altura. É exatamente a "listra" contra a qual eu tinha
  //     escrito o comentário aqui — e caí nela mesmo assim;
  //  2. **mudava a dificuldade.** A distância entre obstáculos é contada em
  //     pixels de arte. Pista mais estreita = menos tempo de reação, então o
  //     jogo ficaria mais difícil em tela cheia sem ninguém ter pedido.
  //
  // Com a largura travada em 320, os dois somem: a dificuldade é sempre a mesma
  // e a altura só acrescenta céu. O chão fica ancorado na borda de baixo.
  useLayoutEffect(() => {
    const quadro = quadroRef.current
    if (!quadro) return
    const medir = () => {
      const caixa = quadro.getBoundingClientRect()
      if (!caixa.width || !caixa.height) return
      const altura = Math.max(
        ALTURA_MIN,
        Math.min(ALTURA_MAX, Math.round(LARGURA_ARTE * (caixa.height / caixa.width)))
      )
      setDim({ w: LARGURA_ARTE, h: altura, chao: altura - CHAO_DO_FUNDO })
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(quadro)
    return () => obs.disconnect()
  }, [telaCheia])

  function comecar() {
    jogoRef.current = {
      y: 0,              // altura acima do chão
      vy: 0,
      noAr: false,
      vel: VEL_INICIAL,
      coisas: [nascer(dim.w + 40, 'pedra')],
      proxima: dim.w + 200,
      pontos: 0,
      vidas: 3,
      inicio: performance.now(),
      rodando: true,
      piscando: 0,
      abaixado: 0,   // quadros restantes agachado
    }
    setFim(null)
    setPlacar({ pontos: 0, vidas: 3, rodando: true })
    window.casalSound?.('game')
  }

  function pular() {
    const j = jogoRef.current
    if (!j || !j.rodando || j.noAr) return
    j.abaixado = 0
    j.vy = IMPULSO
    j.noAr = true
    window.casalSound?.('game')
  }

  /** Abaixar dura pouco e sozinho: segurar abaixado o jogo inteiro seria trapaça. */
  function abaixar() {
    const j = jogoRef.current
    if (!j || !j.rodando) return
    if (j.noAr) {
      // no ar, abaixar puxa ele pro chão — é como se jogasse o peso pra baixo,
      // e serve pra corrigir um pulo dado cedo demais
      j.vy = Math.max(j.vy, 3.2)
      return
    }
    j.abaixado = 34
    window.casalSound?.('game')
  }

  // ---------------------------------------------------------------- gestos
  //
  // O pedido do dono foi este: **arrastar na tela**. Arrasta pra cima, pula;
  // arrasta pra baixo, abaixa.
  //
  // O que existia antes era "metade de cima da tela pula, metade de baixo
  // abaixa". Parece a mesma coisa e não é: obriga a pessoa a mirar numa metade
  // invisível enquanto olha pro obstáculo. Errar a metade custava uma vida, e
  // no calor do jogo o polegar sempre volta pro mesmo lugar — na prática, quem
  // jogava só conseguia pular.
  //
  // O gesto resolve porque a DIREÇÃO é o comando: o dedo pode começar em
  // qualquer ponto da pista. Ele dispara no meio do arrasto (não na soltura),
  // senão o pulo sairia tarde demais pra servir de reflexo.
  const gesto = useRef(null)

  function inicioGesto(e) {
    e.preventDefault()
    if (!jogoRef.current?.rodando) return
    gesto.current = { x: e.clientX, y: e.clientY, usado: false, t: performance.now() }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* segue sem captura */ }
  }

  function moverGesto(e) {
    const g = gesto.current
    if (!g || g.usado) return
    const dy = e.clientY - g.y
    if (Math.abs(dy) < GESTO_MIN) return
    g.usado = true
    if (dy < 0) pular()
    else abaixar()
  }

  function fimGesto(e) {
    const g = gesto.current
    gesto.current = null
    if (!g) return
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* já solto */ }
    // Toque seco, sem arrastar, continua valendo como pular. Tirar isso
    // quebraria quem já pegou o jeito de tocar — e pular é o gesto mais usado.
    if (!g.usado && performance.now() - g.t < 350) pular()
  }

  // ---------------------------------------------------------------- desenho
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const p = new Painter(canvas)
    p.resize(dim.w, dim.h)

    // O bichinho é desenhado num canvas de rascunho JÁ NO TAMANHO da pista e
    // colado sem redução — mesma correção feita no cômodo. Pintar em 128x108 e
    // encolher pra 54x46 descartava dois de cada três pixels, e era o que
    // deixava ele esfarelado dentro do jogo.
    const rascunho = document.createElement('canvas')
    const pintorPet = new Painter(rascunho)
    pintorPet.resize(PET_L, PET_A)

    let vivo = true
    let quadro = 0

    const laco = (t) => {
      if (!vivo) return
      const j = jogoRef.current
      desenhar(p, pintorPet, rascunho, pet, j, t, dim)
      if (j && j.rodando) avancar(j, t)
      quadro = requestAnimationFrame(laco)
    }
    // um quadro na hora: aba em segundo plano não recebe `requestAnimationFrame`
    desenhar(p, pintorPet, rascunho, pet, jogoRef.current, performance.now(), dim)
    quadro = requestAnimationFrame(laco)

    // Teclado, pra quem joga no computador. No celular ninguém usa, mas aqui é
    // o que me deixa testar o jogo sem depender do dedo de alguém.
    const tecla = (e) => {
      if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); pular() }
      if (e.key === 'ArrowDown') { e.preventDefault(); abaixar() }
    }
    window.addEventListener('keydown', tecla)
    return () => {
      vivo = false
      cancelAnimationFrame(quadro)
      window.removeEventListener('keydown', tecla)
    }
  }, [pet, dim.w, dim.h, dim.chao])

  /** A física e as colisões. Fica fora do React de propósito (ver o cabeçalho). */
  function avancar(j, t) {
    j.vy += GRAVIDADE
    j.y = Math.min(0, j.y + j.vy)
    if (j.y >= 0) {
      j.y = 0
      j.vy = 0
      j.noAr = false
    }

    // acelera devagar: o jogo aperta sozinho sem precisar de fases
    j.vel = Math.min(4.2, VEL_INICIAL + j.pontos * 0.07)
    for (const c of j.coisas) c.x -= j.vel
    j.coisas = j.coisas.filter((c) => c.x > -30)

    j.proxima -= j.vel
    if (j.proxima <= 0) {
      j.coisas.push(nascer(dim.w + 20, sortear(j.pontos)))
      // espaço mínimo cresce com a velocidade, senão vira impossível
      j.proxima = 90 + Math.random() * 70 + j.vel * 14
    }

    if (j.piscando > 0) j.piscando -= 1
    if (j.abaixado > 0) j.abaixado -= 1

    // Caixa de colisão do bichinho: estreita de propósito. Larga demais, o jogo
    // parece injusto ("passei longe e perdi") — e injusto é o que faz largar.
    const petX = PET_X
    const noAlto = j.y < -14        // pulou o bastante pra passar por cima
    const agachado = j.abaixado > 0 && !j.noAr
    for (const c of j.coisas) {
      if (c.pego || c.x > petX + 12 || c.x < petX - 14) continue
      const regra = TIPOS[c.tipo]

      // Quem escapa de quê: do obstáculo BAIXO se escapa pulando; do ALTO,
      // abaixando. É a regra inteira do jogo, num lugar só.
      const escapou = regra.altura === 'baixo' ? noAlto : agachado

      if (regra.pontos) {
        // ponto: o de cima só é alcançado no ar, o de baixo só no chão
        const alcancou = regra.altura === 'alto' ? noAlto : !agachado
        if (!alcancou) continue
        c.pego = true
        j.pontos = Math.min(TETO_PONTOS, j.pontos + regra.pontos)
        setPlacar({ pontos: j.pontos, vidas: j.vidas, rodando: true })
        window.casalSound?.('success')
        if (j.pontos >= TETO_PONTOS) terminar(j, t)
      } else if (!escapou && j.piscando <= 0) {
        c.pego = true
        j.vidas -= 1
        j.piscando = 40
        setPlacar({ pontos: j.pontos, vidas: j.vidas, rodando: true })
        if (j.vidas <= 0) terminar(j, t)
      }
    }
  }

  function terminar(j, t) {
    j.rodando = false
    const dur = Math.round(t - j.inicio)
    setPlacar({ pontos: j.pontos, vidas: Math.max(0, j.vidas), rodando: false })
    setFim({ pontos: j.pontos })
    // o piso de 5s é exigência do servidor: partida mais curta que isso não é partida
    aoTerminar?.(j.pontos, Math.max(5000, Math.min(180000, dur)))
  }

  return (
    <>
      <div
        ref={quadroRef}
        className={`runner-frame ${telaCheia ? 'cheia' : ''}`}
        onPointerDown={inicioGesto}
        onPointerMove={moverGesto}
        onPointerUp={fimGesto}
        onPointerCancel={fimGesto}
      >
        <canvas ref={canvasRef} className="runner-canvas" />
        {/* O placar mora DENTRO da pista. Ele é posicionado de forma absoluta, e
            fora de um pai com `position: relative` ele se ancorava na PÁGINA —
            aparecia por cima do título da tela, não sobre o jogo. */}
        <div className="game-hud">
          <strong>{placar.pontos} petiscos</strong>
          <span>
            {'●'.repeat(Math.max(0, placar.vidas))}
            {'○'.repeat(Math.max(0, 3 - placar.vidas))}
          </span>
        </div>
        {!placar.rodando && (
          <div className="runner-overlay">
            {fim ? (
              <>
                <strong>{fim.pontos} petiscos</strong>
                <span>
                  {fim.pontos >= TETO_PONTOS
                    ? 'Correu tudo que dava!'
                    : 'Arraste pra cima pra pular, pra baixo pra abaixar.'}
                </span>
              </>
            ) : (
              <span>
                Arraste <strong>pra cima</strong> pra pular e{' '}
                <strong>pra baixo</strong> pra abaixar
              </span>
            )}
          </div>
        )}
      </div>

      {placar.rodando ? (
        <p className="muted tiny center" style={{ margin: '6px 0 0' }}>
          Arraste na pista: ↑ pula · ↓ abaixa
        </p>
      ) : (
        <button className="btn btn-primary btn-block" onClick={comecar}>
          {fim ? 'Correr de novo' : 'Começar a corrida'}
        </button>
      )}
    </>
  )
}

// ------------------------------------------------------------------ desenho
function desenhar(p, pintorPet, rascunho, pet, j, t, dim) {
  const { w: LARGURA, h: ALTURA, chao: CHAO } = dim
  p.clear('#bfe0ef')

  // morros ao fundo, andando devagar: é o que dá sensação de velocidade sem
  // precisar de nada complicado (paralaxe de duas camadas)
  const desloc = j ? (t / 26) % 160 : 0
  for (let i = -1; i < Math.ceil(LARGURA / 160) + 2; i++) {
    const x = i * 160 - (desloc % 160)
    p.fillPoly([[x, CHAO], [x + 44, CHAO - 34], [x + 90, CHAO]], '#8fbf85')
    p.fillPoly([[x + 70, CHAO], [x + 108, CHAO - 22], [x + 150, CHAO]], '#7fae7d')
  }

  // chão
  p.rect(0, CHAO, LARGURA, ALTURA - CHAO, '#c9a06b')
  p.rect(0, CHAO, LARGURA, 3, '#8a5f3c')
  const risco = j ? (t / 8) % 24 : 0
  for (let x = -24; x < LARGURA + 24; x += 24) p.rect(x - risco, CHAO + 9, 10, 2, '#a8763f')

  if (!j) return

  // obstáculos e petiscos
  for (const c of j.coisas) {
    if (c.pego) continue
    const x = Math.round(c.x)
    if (c.tipo === 'pedra') {
      p.solid(x - 7, CHAO - 14, 15, 14, '#8d8d97', '#33203a')
      p.rect(x - 4, CHAO - 11, 6, 4, '#a9a9b3')
    } else if (c.tipo === 'tronco') {
      // largo e baixo: exige pular na hora certa
      p.solid(x - 13, CHAO - 12, 27, 12, '#8a5f3c', '#33203a')
      p.rect(x - 10, CHAO - 9, 21, 2, '#6f4a2c')
      p.rect(x - 10, CHAO - 5, 21, 2, '#6f4a2c')
    } else if (c.tipo === 'galho') {
      // ALTO: pular não resolve, tem que abaixar
      p.rect(x - 2, CHAO - 62, 4, 26, '#6f4a2c')
      p.solid(x - 15, CHAO - 40, 31, 9, '#4f8a45', '#33203a')
      p.rect(x - 11, CHAO - 44, 8, 5, '#5f9c55')
      p.rect(x + 3, CHAO - 45, 9, 6, '#5f9c55')
    } else if (c.tipo === 'abelha') {
      // alta e balançando — também é de abaixar
      const y = Math.round(CHAO - 42 + Math.sin(t / 130 + x) * 3)
      p.solid(x - 6, y, 13, 9, '#f2c53d', '#33203a')
      p.rect(x - 3, y, 3, 9, '#3a3340')
      p.rect(x + 2, y, 3, 9, '#3a3340')
      const asa = Math.floor(t / 60) % 2
      p.rect(x - 5, y - 4 - asa, 6, 3, 'rgba(255,255,255,0.75)')
      p.rect(x + 1, y - 4 - asa, 6, 3, 'rgba(255,255,255,0.75)')
    } else if (c.tipo === 'ossinho') {
      // ponto lá no alto: só pega quem pula
      const y = CHAO - 46
      p.solid(x - 7, y, 14, 6, '#f0ebe2', '#33203a')
      p.solid(x - 10, y - 2, 5, 10, '#f0ebe2', '#33203a')
      p.solid(x + 6, y - 2, 5, 10, '#f0ebe2', '#33203a')
    } else {
      // petisco no chão
      p.solid(x - 7, CHAO - 24, 14, 6, '#f2c53d', '#33203a')
      p.rect(x - 9, CHAO - 26, 5, 10, '#f2c53d')
      p.rect(x + 5, CHAO - 26, 5, 10, '#f2c53d')
    }
  }

  // o bichinho
  const piscando = j.piscando > 0 && Math.floor(j.piscando / 4) % 2 === 0
  if (!piscando) {
    const agachado = j.abaixado > 0 && !j.noAr
    pintorPet.clear()
    // A velocidade da corrida acelera o CICLO DE PASSO junto: com o clipe rodando
    // sempre no mesmo ritmo, o bichinho patinaria quando o jogo apertasse.
    drawPet(
      pintorPet,
      {
        ...pet,
        action: agachado ? 'deitar' : j.noAr ? 'pular' : j.rodando ? 'correr' : 'parado',
        velocidade: j.rodando ? Math.max(1, j.vel / VEL_INICIAL) : 1,
      },
      t,
      PET_ESCALA
    )
    // Agachar deixou de ser um ACHATAMENTO da imagem e virou pose de verdade.
    //
    // Antes o sprite era espremido pela metade no `drawImage` — o que, além de
    // deformar o bichinho, era mais uma redução em cima da redução que já
    // estragava a arte. Agora o clipe `deitar` abaixa o corpo dobrando as
    // pernas, que é o motivo de existir um esqueleto. A caixa de colisão não
    // muda: quem decide é `j.abaixado`, não a altura do desenho.
    const y = Math.round(CHAO - PET_A + 4 + j.y)
    p.ctx.drawImage(rascunho, Math.round(PET_X - PET_L / 2), y)
  }
}
