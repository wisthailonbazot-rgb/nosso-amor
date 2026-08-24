import { useEffect, useRef } from 'react'

import { Painter } from './pixel'
import { cenaDoItem } from './petProps'
import {
  OUT, clipeDe, crescimentoDe, planoDe, poseEm, desenharRig,
} from './petRig'

/**
 * O bichinho.
 *
 * Este arquivo ficou fino de proposito: ele decide O QUE o bichinho esta
 * fazendo e pinta o que fica EM VOLTA dele (espuma, coracao, poeira, o objeto
 * do item). O corpo em si — esqueleto, pose, ciclo de passo, crescimento — mora
 * em `petRig.js`.
 *
 * Antes tudo isso era um bloco so, e por isso a arte travou: acrescentar uma
 * acao significava mais um `if` no meio do desenho, e acrescentar uma especie
 * significava mais um `if` no meio das acoes. Cada um multiplicava o outro.
 *
 * A assinatura NAO muda: `drawPet(painter, pet, tick)`, na mesma caixa de
 * 128x108. `room.js`, `PetRunner.jsx`, `ItemPreview.jsx` e a bancada `/lab` ja
 * colam esse canvas em quatro tamanhos diferentes.
 */

const PADRAO = ['#c98a4b', '#8a5f3c', '#f0ebe2', OUT]

/**
 * Qual acao desenhar, quando ninguem mandou uma.
 *
 * A ordem e a mesma decisao ja registrada no HANDOFF pra legenda do comodo: o
 * ESTADO RUIM vem antes de tudo. Um bichinho doente nao pode aparecer dando
 * pulinho de alegria so porque a tela nao passou `action` — foi exatamente esse
 * tipo de mentira ("tirando uma soneca na caminha", doente e com 12 sujeiras)
 * que teve de ser corrigido na revisao anterior.
 */
export function acaoDe(pet) {
  if (pet.action) return pet.action
  const cena = cenaDoItem(pet.prop)
  if (cena?.cena) return cena.cena
  if (pet.sick) return 'doente'
  if (pet.mood === 'sonolento') return 'dormir'
  if (['triste', 'faminto', 'imundo', 'incomodado'].includes(pet.mood)) return 'triste'
  if (pet.mood === 'feliz') return 'parado'
  return 'parado'
}

/**
 * Desenha o bichinho.
 *
 * `escala` é a razão em relação à caixa de referência de 128x108. Ela existe por
 * um motivo bem concreto: dentro da casa e na corrida, o bichinho ocupa uns
 * 50x42 pixels. Até agora ele era desenhado nos 128x108 cheios e **encolhido**
 * na hora de colar — e encolher pixel art JOGA PIXEL FORA. Cada três pixels de
 * arte viravam um, escolhido por arredondamento: o contorno esfarela, o olho
 * some, a perna fica com buraco. É exatamente a "qualidade baixíssima" que
 * aparecia no jogo e no cômodo, enquanto na tela do bichinho (que usa a caixa
 * inteira) ele estava bem.
 *
 * Com a escala, o motor desenha DIRETO no tamanho final: menos pixels, porém
 * todos escolhidos pelo desenho, e não pela conta de redução.
 */
export function drawPet(p, pet, tick, escala = 1) {
  const t = tick || 0
  const cores = pet.colors?.length >= 3 ? pet.colors : PADRAO
  const plano = planoDe(pet.species || 'gato', crescimentoDe(pet), escala)
  const acao = acaoDe(pet)
  const nome = clipeDe(acao, plano)
  const pose = poseEm(acao, plano, t + (pet.fase || 0), pet.velocidade || 1)

  const marcos = desenharRig(p, plano, pose, cores, {
    doente: !!pet.sick && nome !== 'dormir',
    bochechas: pet.mood === 'feliz' && !pet.sick,
  })

  vestir(p, pet, marcos, cores)
  extras(p, nome, t, marcos, cores, plano)

  // O objeto do item que ele esta usando de verdade (o osso, o potinho, a
  // bolinha). E o que faz "brincar com a varinha" parecer diferente de
  // "brincar com a bolinha", em vez das duas serem o mesmo pulo.
  // O objeto do item só é desenhado no tamanho cheio: ele foi escrito em pixel
  // fixo (`petProps.js`) e, reduzido, viraria três pontinhos sem leitura.
  const cena = escala > 0.8 ? cenaDoItem(pet.prop) : null
  if (cena) cena.desenhar(p, t, 0)

  // Aviso desenhado, sem emoji.
  if (pet.sick || pet.mess_count > 2) {
    const e = escala
    const tri = [[103 * e, 10 * e], [115 * e, 30 * e], [91 * e, 30 * e]]
    p.fillPoly(tri, '#f2b33d')
    p.strokePoly(tri, OUT)
    p.rect(102 * e, 17 * e, Math.max(1, 2 * e), Math.max(2, 7 * e), OUT)
    p.rect(102 * e, 26 * e, Math.max(1, 2 * e), Math.max(1, 2 * e), OUT)
  }
}

// ------------------------------------------------------------------ acessorio
/**
 * Acessório comprado, VESTIDO na pose atual.
 *
 * Tudo aqui é escrito em coordenadas DO BICHINHO (`naCabeca`, `noCorpo`), nunca
 * em pixel do canvas. As duas funções já vêm do rig com a rotação e o tamanho da
 * pose aplicados, então o acessório acompanha sozinho a cabeça que abaixa pra
 * comer, tomba pra dormir ou sobe no pulo.
 *
 * Três defeitos que apareceram na aba "Vestidos" da bancada, todos com a mesma
 * origem — medida fixa em pixel:
 *
 *  1. a gravata caía **reta pra baixo** na tela. Deitado, o bichinho ficava com
 *     a gravata atravessando o chão. Agora ela segue o EIXO DO PESCOÇO, que é a
 *     direção em que uma gravata pende de verdade, deitado ou em pé;
 *  2. o chapéu era um retângulo de largura fixa: cabia no gato e sobrava no
 *     coelho. Agora ele é medido em fração da cabeça;
 *  3. os óculos usavam as âncoras de olho ANTIGAS, de antes de a cabeça mudar de
 *     lugar — ficavam sobre o corpo no passarinho. Agora saem exatamente das
 *     mesmas âncoras que o rosto usa, e não de uma cópia que envelheceu.
 */
function vestir(p, pet, m, cores) {
  const neck = pet.accessories?.neck || ''
  const head = pet.accessories?.head || ''
  const traco = (pts, cor) => { p.fillPoly(pts, cor); p.strokePoly(pts, OUT) }

  if (neck) {
    // O eixo do pescoço: da base dele até o queixo. É o que dá a inclinação.
    const [nx, ny] = m.pescoco
    const [hx, hy] = m.naCabeca(0, 0.9)
    const dx = hx - nx
    const dy = hy - ny
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d
    const px = -uy      // perpendicular ao pescoço: a direção da coleira
    const py = ux
    const meia = m.cabecaL * 0.34
    // a coleira fica logo abaixo do queixo, e não no meio das costas
    const cx = nx + ux * d * 0.55
    const cy = ny + uy * d * 0.55
    const esp = Math.max(2, m.cabecaA * 0.15)
    const cor = neck.includes('gravata') ? '#e8879b' : '#5bb9e8'
    traco([
      [cx + px * meia - ux * esp, cy + py * meia - uy * esp],
      [cx - px * meia - ux * esp, cy - py * meia - uy * esp],
      [cx - px * meia + ux * esp, cy - py * meia + uy * esp],
      [cx + px * meia + ux * esp, cy + py * meia + uy * esp],
    ], cor)

    if (neck.includes('gravata')) {
      // pende NO SENTIDO DO PESCOÇO (pra baixo em pé, pro peito deitado)
      const comp = m.cabecaA * 0.68
      const larg = m.cabecaL * 0.14
      const bx = cx + ux * esp
      const by = cy + uy * esp
      traco([
        [bx + px * larg, by + py * larg],
        [bx + ux * comp + px * larg * 1.35, by + uy * comp + py * larg * 1.35],
        [bx + ux * comp * 1.32, by + uy * comp * 1.32],
        [bx + ux * comp - px * larg * 1.35, by + uy * comp - py * larg * 1.35],
        [bx - px * larg, by - py * larg],
      ], cor)
    } else {
      // plaquinha da coleira, pendurada no mesmo eixo
      p.fillPoly([
        [cx + ux * esp * 1.2 - 2, cy + uy * esp * 1.2],
        [cx + ux * esp * 1.2 + 2, cy + uy * esp * 1.2],
        [cx + ux * (esp * 1.2 + 4), cy + uy * (esp * 1.2 + 4)],
      ], '#f2c53d')
    }
  }

  if (head.includes('chapeu')) {
    // Aba e copa em fração da cabeça: o mesmo chapéu serve pro gato e pro coelho.
    const aba = (fx, fy) => m.naCabeca(fx, fy)
    traco([aba(-1.05, -0.72), aba(1.05, -0.86), aba(1.05, -1.06), aba(-1.05, -0.92)], '#e8879b')
    traco([aba(-0.5, -0.9), aba(-0.42, -1.72), aba(0.62, -1.8), aba(0.66, -1.02)], '#e8879b')
    p.fillPoly([aba(-0.48, -1.2), aba(0.64, -1.3), aba(0.64, -1.46), aba(-0.46, -1.36)], '#c96a8a')
  } else if (head.includes('oculos')) {
    // MESMAS âncoras do rosto — ver o comentário no topo (defeito 3).
    const [ex, ey] = m.naCabeca(0.1, -0.2)
    const [dx2, dy2] = m.naCabeca(0.58, -0.18)
    const r = Math.max(3.4, m.cabecaL * 0.19)
    for (const [x, y] of [[ex, ey], [dx2, dy2]]) {
      const aro = [[x - r, y - r * 0.8], [x + r, y - r * 0.8], [x + r, y + r * 0.8], [x - r, y + r * 0.8]]
      p.fillPoly(aro, 'rgba(70,95,130,0.38)')
      p.strokePoly(aro, '#29242d')
    }
    p.line(ex + r, ey - 1, dx2 - r, dy2 - 1, '#29242d')
    // haste indo pra trás da cabeça, senão os óculos ficam boiando na cara
    const [tx, ty] = m.naCabeca(-0.7, -0.34)
    p.line(ex - r, ey - 1, tx, ty, '#29242d')
  }
}

// ------------------------------------------------------------------ cena
/**
 * O que aparece EM VOLTA dele por causa da acao: bolha de sabao, migalha,
 * coracao, o "z" do sono, a poeira do passo.
 *
 * Continua separado do corpo de proposito: o corpo e o mesmo em toda acao — o
 * que muda e a cena. Agora recebe as ancoras do rig, entao a espuma nasce na
 * cabeca ONDE ELA ESTA (inclusive abaixada), e nao num y fixo.
 */
function extras(p, clipe, t, m, cores, plano) {
  const claro = cores[2] || '#f0ebe2'
  const e = plano.escala
  const CH = plano.chao
  const CXP = plano.cx
  const [cabX, cabY] = m.cabeca
  // Miudeza (bolha, migalha, "z", poeira) só cabe no tamanho cheio. Reduzida,
  // ela vira sujeira de um pixel espalhada pelo canvas — pior que não ter.
  if (e < 0.8) return

  if (clipe === 'banho') {
    p.fillPoly(bolha(cabX - 3, cabY - m.cabecaA * 0.55, 12), '#f4fbff')
    p.fillPoly(bolha(cabX + 3, cabY - m.cabecaA * 0.75, 8), '#ffffff')
    for (let i = 0; i < 6; i++) {
      const sobe = ((t / 9 + i * 22) % 96) | 0
      const x = 34 + i * 12 + ((Math.sin(t / 300 + i) * 3) | 0)
      p.rect(x, 98 - sobe, 3, 3, 'rgba(210,238,250,0.85)')
      p.px(x, 98 - sobe, '#ffffff')
    }
  }

  if (clipe === 'comer') {
    // migalhas saltando de onde a boca esta
    for (let i = 0; i < 3; i++) {
      if (((t / 130) | 0) % 3 === i) {
        p.rect(m.focinho[0] + 4 + i * 3, m.focinho[1] - 2 + (i % 2) * 4, 2, 2, '#a8763f')
      }
    }
  }

  if (clipe === 'dormir') {
    // tres "z" subindo em fila, cada um no seu tempo
    for (let i = 0; i < 3; i++) {
      const fase = ((t / 12 + i * 40) % 120) | 0
      if (fase > 100) continue
      const x = cabX + 12 + i * 4
      const y = cabY - 14 - fase / 3
      const tam = 3 + i
      p.rect(x, y, tam, 1, OUT)
      p.rect(x, y + tam, tam, 1, OUT)
      for (let k = 0; k < tam; k++) p.px(x + tam - 1 - k, y + 1 + k, OUT)
    }
  }

  if (clipe === 'feliz' || clipe === 'brincar' || clipe === 'implorar') {
    for (let i = 0; i < 3; i++) {
      const fase = ((t / 10 + i * 33) % 100) | 0
      if (fase > 88) continue
      const x = 34 + i * 26 + ((Math.sin(t / 260 + i) * 4) | 0)
      const y = 46 - fase / 3
      p.rect(x - 2, y, 2, 2, '#e8879b')
      p.rect(x + 1, y, 2, 2, '#e8879b')
      p.rect(x - 2, y + 2, 5, 1, '#e8879b')
      p.px(x, y + 3, '#e8879b')
    }
  }

  if (clipe === 'andar' || clipe === 'correr' || clipe === 'saltitar') {
    // poeirinha do passo, atras dele
    const q = ((t / 110) | 0) % 3
    p.px(26 + q * 3, CH - 1, claro)
    p.px(23 + q * 3, CH + 1, claro)
    if (clipe === 'correr') {
      p.rect(20 + q * 4, CH - 4, 4, 1, 'rgba(255,255,255,0.5)')
      p.rect(16 + q * 4, CH - 8, 6, 1, 'rgba(255,255,255,0.35)')
    }
  }

  if (clipe === 'voar' || clipe === 'planar') {
    // riscos de vento pra leitura de deslocamento no ar
    for (let i = 0; i < 3; i++) {
      const x = ((t / 4 + i * 40) % 130) | 0
      p.rect(CXP + 24 - x, m.corpo[1] - 6 + i * 7, 7, 1, 'rgba(255,255,255,0.45)')
    }
  }

  if (clipe === 'cavar') {
    for (let i = 0; i < 4; i++) {
      const fase = ((t / 7 + i * 25) % 60) | 0
      p.px(m.peFrente[0] + 4 + fase / 3, CH - 4 - Math.sin((fase / 60) * Math.PI) * 12, '#a8763f')
    }
  }

  if (clipe === 'doente') {
    // suor frio: uma gota escorrendo da testa, devagar
    const fase = (t / 22) % 100
    if (fase < 60) p.fillPoly(bolha(cabX + m.cabecaL * 0.42, cabY - 6 + fase / 5, 4), '#8fd0ef')
  }
}

/** Bolinha de N pixels de largura, sem borda — espuma, gota, bolha. */
function bolha(cx, cy, d) {
  const r = d / 2
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92])
  }
  return pts
}

// ------------------------------------------------------------------ componente
export default function PetCanvas({ pet, onPoke }) {
  const ref = useRef(null)
  // A reacao ao toque vive FORA do React: `setState` a cada toque re-renderizaria
  // a arvore e reiniciaria o laco de desenho no meio da animacao — o bichinho
  // daria um tranco justamente no quadro em que devia reagir.
  const reacao = useRef({ ate: 0, acao: null })

  useEffect(() => {
    let frame = 0
    let alive = true
    const canvas = ref.current
    const painter = new Painter(canvas)
    painter.resize(128, 108)
    const paint = (t) => {
      painter.clear()
      const r = reacao.current
      const atual = r.ate > t ? { ...pet, action: r.acao } : pet
      drawPet(painter, atual, t)
    }
    const loop = (t) => {
      if (!alive) return
      paint(t)
      frame = requestAnimationFrame(loop)
    }

    // Um quadro DESENHADO NA HORA, antes de pedir o primeiro `requestAnimationFrame`.
    //
    // O motivo apareceu na bancada: `requestAnimationFrame` nao roda em aba que
    // o navegador nao esta compondo (segundo plano, celular com a tela travada,
    // app aberto e minimizado). Sem este desenho imediato, quem volta pro app
    // encontra um retangulo VAZIO ate o navegador resolver animar de novo — e
    // o cenario parece quebrado, quando na verdade so nao chegou a ser pintado.
    paint(performance.now())
    frame = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(frame) }
  }, [pet])

  /**
   * Toque no bichinho.
   *
   * A reacao e SEMPRE — a mesma regra ja decidida pro botao da casa: encostar
   * nele faz alguma coisa acontecer na hora, mesmo quando o premio do servidor
   * esta em descanso. O que reage depende de ONDE se toca, porque cocar a
   * barriga e mexer na cabeca nao sao o mesmo carinho.
   */
  function tocar(e) {
    const canvas = ref.current
    if (!canvas) return
    const caixa = canvas.getBoundingClientRect()
    const y = (e.clientY - caixa.top) / caixa.height
    const acao = pet.sick
      ? 'triste'
      : y < 0.42
        ? 'cocar'            // cabeca: ele coca junto
        : y < 0.72
          ? 'feliz'          // corpo: pulo de alegria
          : 'rolar'          // barriga: deita e rola
    reacao.current = { ate: performance.now() + (acao === 'rolar' ? 2000 : 1500), acao }
    window.casalSound?.('pet')
    onPoke?.(acao)
  }

  return (
    <canvas
      ref={ref}
      className="pet-canvas"
      onPointerDown={tocar}
      aria-label={`${pet.species_name || 'bichinho'} ${pet.mood || ''}`}
    />
  )
}
