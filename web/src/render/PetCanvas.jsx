import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Painter, mix } from './pixel'
import { desenharCena, desenharFrente, desenharLambida, periodoDe } from './petCena'
import { CHAO_FUNDO, criarPalco, enquadrar } from './petPalco'
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
  // O ITEM EM USO GANHA DE TUDO, inclusive de `action`.
  //
  // `action` e a reacao de toque (ele pula, coca, rola). Dar comida e uma
  // decisao que a pessoa acabou de tomar, e a mao dela passa POR CIMA do
  // bichinho no caminho ate soltar o prato — entao a reacao de toque disparava
  // e engolia a cena de comer. O resultado era o dono dando sushi e nao vendo
  // ele comer nenhuma vez. Entre "encostei nele" e "dei comida pra ele", quem
  // manda e a comida.
  const cena = cenaDoItem(pet.prop)
  if (cena?.cena) return cena.cena
  if (pet.action) return pet.action
  if (pet.sick) return 'doente'
  if (pet.mood === 'sonolento') return 'dormir'
  if (['triste', 'faminto', 'imundo', 'incomodado'].includes(pet.mood)) return 'triste'
  // O que o CEREBRO DO PALCO esta mandando fazer (andar, correr, um truque).
  // Fica abaixo dos estados ruins de proposito: bichinho doente nao sai
  // correndo pela ilha porque o sorteio mandou.
  if (pet.acaoPalco) return pet.acaoPalco
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
export function drawPet(p, pet, tick, escala, enquadrar) {
  const t = tick || 0
  // A escala sai do PRÓPRIO canvas quando ninguém manda uma. Uma fonte só, de
  // propósito: já aconteceu de eu trocar o tamanho do canvas de rascunho da
  // corrida e esquecer de avisar o desenho. O bichinho continuou sendo pintado
  // na caixa de 128x108, o recorte de 68x58 pegou o canto vazio acima dele e
  // ele **sumiu do jogo** — sem erro no console, sem nada. Derivando daqui, o
  // canvas e o desenho não têm como discordar.
  if (escala == null) escala = (p.h || 108) / 108
  const cores = pet.colors?.length >= 3 ? pet.colors : PADRAO
  const plano = planoDe(pet.species || 'gato', crescimentoDe(pet), escala)
  // ENQUADRAMENTO: onde ele pisa e onde fica o meio dele.
  //
  // Por padrao as ancoras saem da caixa de referencia (x=64, chao=92, vezes a
  // escala) — e isso vale pro comodo e pra corrida, onde o bichinho e colado
  // dentro de uma cena que ja existe. Na tela DELE nao serve: pra ele aparecer
  // grande, a escala tem que subir, e a escala subindo joga o x=64*escala pra
  // fora do canvas. Quem manda ali e o palco, entao o palco passa as ancoras.
  if (enquadrar) {
    if (enquadrar.cx != null) plano.cx = enquadrar.cx
    if (enquadrar.chao != null) plano.chao = enquadrar.chao
  }
  const acao = acaoDe(pet)
  const nome = clipeDe(acao, plano)
  const pose = poseEm(acao, plano, t + (pet.fase || 0), pet.velocidade || 1)

  const marcos = desenharRig(p, plano, pose, cores, {
    doente: !!pet.sick && nome !== 'dormir',
    bochechas: (pet.mood === 'feliz' || pet.carinho > 0) && !pet.sick,
    // Pra onde ele esta olhando. Vem da tela (o dedo), nao da animacao.
    mirar: pet.mirar || null,
  })

  vestir(p, pet, marcos, cores, plano)

  // Enquanto a mao passa nele, sobem coracoes do lombo. E o retorno imediato do
  // carinho: sem ele, arrastar o dedo em cima do bichinho nao parece fazer nada,
  // e a pessoa desiste antes de o carinho valer.
  if (pet.carinho > 0) {
    const [lx, ly] = marcos.noCorpo(0, -0.6)
    const n = 3
    for (let i = 0; i < n; i++) {
      const fase = ((t / 900) + i / n) % 1
      const cx2 = lx + Math.sin(fase * 6 + i * 2) * plano.corpoL * 0.28
      const cy2 = ly - fase * plano.corpoA * 2.2
      const tam = Math.max(1.5, plano.corpoA * 0.13) * (1 - fase * 0.35) * Math.min(1, pet.carinho)
      p.fillPoly(
        [
          [cx2, cy2 + tam], [cx2 - tam, cy2], [cx2 - tam * 0.5, cy2 - tam * 0.8],
          [cx2, cy2 - tam * 0.25], [cx2 + tam * 0.5, cy2 - tam * 0.8], [cx2 + tam, cy2],
        ],
        '#e8879b',
      )
    }
  }
  extras(p, nome, t, marcos, cores, plano)

  // O objeto do item que ele esta usando de verdade (o osso, o potinho, a
  // bolinha). E o que faz "brincar com a varinha" parecer diferente de
  // "brincar com a bolinha", em vez das duas serem o mesmo pulo.
  // O objeto do item só é desenhado no tamanho cheio: ele foi escrito em pixel
  // fixo (`petProps.js`) e, reduzido, viraria três pontinhos sem leitura.
  const cena = escala > 0.8 ? cenaDoItem(pet.prop) : null
  if (cena) {
    // O objeto do item e escrito na caixa de 128x108 (`petProps.js`), com
    // numero cru: `p.solid(58, 88, ...)` quer dizer "ao lado do focinho" so
    // enquanto o canvas TEM 128 de largura. Desenhando o bichinho maior, esses
    // numeros passaram a apontar pro canto de cima do canvas — o potinho ficava
    // longe do bicho, sem erro nenhum pra denunciar.
    //
    // Em vez de reescrever as treze cenas, o desenho delas entra numa
    // transformacao que leva a caixa de 128x108 pras ancoras de verdade. Assim
    // `58, 88` volta a querer dizer o que sempre quis.
    const ctx = p.ctx
    ctx.save()
    ctx.translate(plano.cx - 64 * escala, plano.chao - 92 * escala)
    ctx.scale(escala, escala)
    cena.desenhar(p, t, 0)
    ctx.restore()
  }

  // Aviso desenhado, sem emoji.
  //
  // `semAviso` existe pro CÔMODO: lá são vários bichinhos na mesma cena, e um
  // triângulo por cabeça vira uma placa de obra no meio da sala. O aviso é útil
  // na tela DELE, onde há um só e onde se resolve o problema; na casa quem
  // conta o estado é a legenda embaixo do cômodo.
  if (!pet.semAviso && (pet.sick || pet.mess_count > 2)) {
    // Preso ao CANTO DO CANVAS, e nao a caixa de 128: com o bichinho grande, as
    // coordenadas antigas jogavam o aviso pra fora da tela.
    // O tamanho sai do CANVAS, nao da escala do bicho. Preso a escala, ele
    // crescia junto com o bichinho e virava uma placa de transito tapando a
    // cena — aviso e aviso, nao e o assunto da tela.
    const g = Math.max(6, p.w * 0.045)
    const ax = p.w - g * 1.5
    const ay = g * 0.7
    const tri = [[ax, ay], [ax + g, ay + g * 1.7], [ax - g, ay + g * 1.7]]
    p.fillPoly(tri, '#f2b33d')
    p.strokePoly(tri, OUT)
    p.rect(ax - g * 0.09, ay + g * 0.6, Math.max(1, g * 0.18), Math.max(2, g * 0.6), OUT)
    p.rect(ax - g * 0.09, ay + g * 1.35, Math.max(1, g * 0.18), Math.max(1, g * 0.18), OUT)
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
function vestir(p, pet, m, cores, plano) {
  const neck = pet.accessories?.neck || ''
  const head = pet.accessories?.head || ''
  const traco = (pts, cor) => { p.fillPoly(pts, cor); p.strokePoly(pts, OUT) }

  if (neck) {
    // A coleira é ancorada NA CABEÇA, logo abaixo do queixo — não num "eixo de
    // pescoço" calculado entre o peito e a cabeça.
    //
    // Aquele eixo funcionava no cachorro e falhava no coelho e na capivara, que
    // praticamente não têm pescoço: os dois pontos ficam quase em cima um do
    // outro, a direção sai de uma diferença minúscula (portanto instável) e a
    // faixa acabava atravessando o ROSTO do bichinho. Deitado, com a cabeça
    // tombada, ficava pior ainda.
    //
    // Preso à cabeça isso não tem como acontecer: coleira fica embaixo do
    // queixo em qualquer espécie e em qualquer pose, porque acompanha a mesma
    // rotação que o rosto.
    // 1,02 e a BORDA de baixo da cabeca — e a borda de baixo de uma cabeca
    // grande e ainda a bochecha. Na tela pequena isso passava; desenhado
    // grande, a coleira aparecia atravessada no focinho de todas as especies.
    // 1,38 poe ela abaixo do queixo... no bicho que TEM queixo.
    //
    // 1,38 da meia-altura da cabeca sao 0,38 de raio ABAIXO da borda dela. Num
    // cachorro, que tem pescoco, isso cai no pescoco mesmo. No coelho e na
    // capivara — os dois que "praticamente nao tem pescoco", como ja estava
    // anotado aqui em cima — a cabeca encosta no corpo, e 0,38 de raio abaixo
    // da borda ja e PEITO. A coleira virava um cracha pendurado no meio da
    // barriga, e era assim nas seis especies vistas grandes.
    //
    // 1,14 e a borda da cabeca mais uma folga fina: encosta no queixo em quem
    // tem pescoco e continua no lugar certo em quem nao tem. O erro de 1,02
    // (bochecha) e o de 1,38 (peito) sao os dois extremos da mesma medida, e o
    // valor bom fica bem mais perto do primeiro do que a correcao anterior
    // supos.
    const centro = m.naCabeca(-0.06, 1.14)
    const o = m.naCabeca(0, 0)
    const b = m.naCabeca(0, 1)
    const dc = Math.hypot(b[0] - o[0], b[1] - o[1]) || 1
    const ux = (b[0] - o[0]) / dc   // "para baixo" DA CABEÇA
    const uy = (b[1] - o[1]) / dc
    const px = -uy                  // atravessa o pescoço
    const py = ux

    // O que PENDE (gravata, plaquinha) segue o "para baixo" do CORPO: é a
    // gravidade que manda nisso, não a inclinação da cabeça.
    const co = m.noCorpo(0, 0)
    const cb = m.noCorpo(0, 1)
    const db = Math.hypot(cb[0] - co[0], cb[1] - co[1]) || 1
    const gx = (cb[0] - co[0]) / db
    const gy = (cb[1] - co[1]) / db

    const meia = Math.max(3, m.cabecaL * 0.26)
    const esp = Math.max(1.5, m.cabecaA * 0.085)
    const cx = centro[0]
    const cy = centro[1]
    const cor = neck.includes('gravata') ? '#e8879b' : '#5bb9e8'
    traco([
      [cx + px * meia - ux * esp, cy + py * meia - uy * esp],
      [cx - px * meia - ux * esp, cy - py * meia - uy * esp],
      [cx - px * meia + ux * esp, cy - py * meia + uy * esp],
      [cx + px * meia + ux * esp, cy + py * meia + uy * esp],
    ], cor)
    // Faixa clara em cima e fivela no meio. Sao dois detalhes que so existem
    // porque agora ha pixel pra eles: chapada, a coleira lia como uma etiqueta
    // de papel colada no bicho.
    p.fillPoly([
      [cx + px * meia * 0.86 - ux * esp * 0.9, cy + py * meia * 0.86 - uy * esp * 0.9],
      [cx - px * meia * 0.86 - ux * esp * 0.9, cy - py * meia * 0.86 - uy * esp * 0.9],
      [cx - px * meia * 0.86 - ux * esp * 0.1, cy - py * meia * 0.86 - uy * esp * 0.1],
      [cx + px * meia * 0.86 - ux * esp * 0.1, cy + py * meia * 0.86 - uy * esp * 0.1],
    ], mix(cor, '#ffffff', 0.4))
    const fiv = Math.max(1.2, esp * 0.8)
    p.fillPoly([
      [cx + px * fiv - ux * esp * 1.15, cy + py * fiv - uy * esp * 1.15],
      [cx - px * fiv - ux * esp * 1.15, cy - py * fiv - uy * esp * 1.15],
      [cx - px * fiv + ux * esp * 1.15, cy - py * fiv + uy * esp * 1.15],
      [cx + px * fiv + ux * esp * 1.15, cy + py * fiv + uy * esp * 1.15],
    ], '#f2c53d')

    const bx = cx + gx * esp
    const by = cy + gy * esp
    if (neck.includes('gravata')) {
      // Pende pra baixo, mas PARA no chão: deitado, o peito fica quase no piso
      // e uma gravata de comprimento fixo atravessaria o assoalho.
      const ateOChao = Math.max(0, plano.chao - by)
      const comp = Math.max(4, Math.min(m.cabecaA * 0.6, ateOChao))
      const larg = Math.max(2, m.cabecaL * 0.13)
      const lx = -gy
      const ly = gx
      traco([
        [bx + lx * larg, by + ly * larg],
        [bx + gx * comp + lx * larg * 1.4, by + gy * comp + ly * larg * 1.4],
        [bx + gx * comp * 1.3, by + gy * comp * 1.3],
        [bx + gx * comp - lx * larg * 1.4, by + gy * comp - ly * larg * 1.4],
        [bx - lx * larg, by - ly * larg],
      ], cor)
    } else {
      const r = Math.max(1.6, m.cabecaL * 0.09)
      const pin = [
        [bx - gy * r, by + gx * r],
        [bx + gy * r, by - gx * r],
        [bx + gx * r * 2.2, by + gy * r * 2.2],
      ]
      p.fillPoly(pin, '#f2c53d')
      p.strokePoly(pin, OUT)
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
export default function PetCanvas({ pet, onPoke, arrastando = false }) {
  const ref = useRef(null)
  // `res` = quantas vezes a caixa de referencia (128x108) o desenho tem de
  // resolucao; `zoom` = a ampliacao INTEIRA que o CSS aplica em cima.
  const [{ res, zoom }, setVista] = useState({ res: 1, zoom: 2 })

  // Mais pixel no bichinho, sem perder o tamanho na tela.
  //
  // O que existia era: arte sempre em 128x108, ampliada por CSS num fator
  // inteiro. Isso protege a borda dura (fator quebrado da franja na diagonal),
  // mas trava a QUANTIDADE de pixel: no celular o palco cabe 3x, e 3x de uma
  // arte de 128 e a mesma arte de 128 com cada pixel virando um quadrado de 3.
  // O corpo fica grande e continua com o mesmo tanto de informacao — foi o
  // "ainda tem poucos pixels, da pra deixar mais desenhado".
  //
  // A saida nao e abandonar o fator inteiro: e escolher, entre as combinacoes
  // que dao o MESMO tamanho fisico, a que tem mais pixel de arte. 128x3 (zoom 3)
  // e 384x1 (res 3, zoom 1) ocupam exatamente os mesmos 384 px na tela; a
  // segunda tem 9 vezes mais pixel de desenho. O motor ja sabia fazer isso —
  // `planoDe` recebe uma escala e desenha DIRETO no tamanho final (foi o que
  // consertou o bichinho borrado do comodo e da corrida) —, so ninguem tinha
  // pedido pra ele desenhar MAIOR do que a caixa de referencia.
  //
  // O cenario isometrico continua em 1x de propriedade: la o bichinho tem que
  // ter a mesma grossura de pixel do sofa, senao ele parece colado por cima da
  // cena. Aqui ele esta sozinho no palco, e nao tem com quem destoar.
  useLayoutEffect(() => {
    const canvas = ref.current
    const pai = canvas?.parentElement
    if (!pai) return
    const medir = () => {
      // 1,25 de folga: o bichinho ocupa mais ou menos o miolo da caixa de 128
      // (o desenho mais largo, o dragao, vai de 8 a 108), entao o que estoura nas
      // laterais e ar — e o palco corta com `overflow: hidden`. Com 1,1 a conta
      // perdia o 3x por dez pixels numa tela de 375.
      const larg = pai.clientWidth * 1.25
      const alt = pai.clientHeight - 8
      let melhor = { res: 1, zoom: 1, fisico: 128 }
      // Resolucoes inteiras: 128*res tem que ser inteiro, senao a ampliacao
      // por CSS voltaria a cair em meio pixel.
      for (const r of [3, 2, 1]) {
        const z = Math.max(1, Math.min(4, Math.min(
          Math.floor(larg / (128 * r)),
          Math.floor(alt / (108 * r)),
        ) || 0))
        if (!z) continue
        const fisico = 128 * r * z
        if (fisico > larg) continue
        // Empate no tamanho fisico: ganha quem tem MAIS pixel de arte, que e o
        // ponto todo desta conta.
        if (fisico > melhor.fisico || (fisico === melhor.fisico && r > melhor.res)) {
          melhor = { res: r, zoom: z, fisico }
        }
      }
      setVista({ res: melhor.res, zoom: melhor.zoom })
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(pai)
    return () => obs.disconnect()
  }, [])
  // A reacao ao toque vive FORA do React: `setState` a cada toque re-renderizaria
  // a arvore e reiniciaria o laco de desenho no meio da animacao — o bichinho
  // daria um tranco justamente no quadro em que devia reagir.
  const reacao = useRef({ ate: 0, acao: null })
  // Pra onde ele olha, e ha quanto tempo a mao passou por ele. Os dois vivem
  // FORA do React de proposito: sao atualizados a cada movimento do dedo, e um
  // `setState` por movimento re-renderizaria a arvore dezenas de vezes por
  // segundo, reiniciando o laco de desenho no meio da animacao.
  const olhar = useRef({ dx: 0, dy: 0, ate: 0 })
  const afago = useRef({ forca: 0, andado: 0, ultimo: 0, premiado: 0 })
  const palcoRef = useRef(null)

  useEffect(() => {
    let frame = 0
    let alive = true
    const canvas = ref.current
    const painter = new Painter(canvas)
    painter.resize(128 * res, 108 * res)
    // O bichinho ocupa o PALCO, e nao um cantinho dele.
    //
    // Com as ancoras da caixa de referencia ele saia com o tamanho relativo de
    // sempre: um coelho filhote dava uns 26% da largura da tela, perdido no meio
    // do quadro. Na referencia que o dono mandou (Kinectimals) o filhote ENCHE a
    // tela — e nao e vaidade de enquadramento: e o que faz dar vontade de
    // encostar nele. O 1,5 aumenta sem igualar filhote e adulto, entao crescer
    // continua sendo visivel.
    // A escala sai do TAMANHO DO BICHO, e nao de um numero escolhido a dedo.
    //
    // Um fator fixo serve pra um e estoura pro outro: a orelha do coelho mede
    // quase tres cabecas, o dragao tem o corpo mais comprido de todos. Com 1,5
    // fixo, o coelho saia com as orelhas cortadas em cima e o dragao com a
    // cauda pra fora. Aqui a altura e a largura do bicho sao estimadas a partir
    // do plano do corpo, e a escala e a maior que ainda cabe no palco — entao
    // cada especie enche a tela ate onde da, sozinha.
    const medida = planoDe(pet.species || 'gato', crescimentoDe(pet), 1)
    const alturaU = medida.pernaA + medida.corpoA * 1.15
      + medida.cabecaA * (medida.orelha === 'longa' ? 2.15 : 1.5)
    const larguraU = medida.corpoL + medida.caudaL * 0.8 + medida.cabecaL
    const escalaCena = Math.min((painter.h * 0.74) / alturaU, (painter.w * 0.92) / larguraU)
    // O cerebro do palco: ele anda, vira de lado, faz truque e vem no vidro.
    // Fica FORA do estado do React porque muda a cada quadro.
    if (!palcoRef.current) palcoRef.current = criarPalco({})
    let ultimo = 0
    const paint = (t) => {
      painter.clear()
      const dt = ultimo ? Math.min(120, t - ultimo) : 16
      ultimo = t
      const r = reacao.current
      const ol = olhar.current
      // O olhar volta ao normal sozinho depois que o dedo sai: ficar congelado
      // olhando pro canto e pior do que nao olhar.
      const vivo = ol.ate > Date.now()
      const af = afago.current
      af.forca = Math.max(0, af.forca - 0.02)
      // Bichinho doente ou pra baixo NAO passeia: ele fica onde esta. Um
      // bicho doente correndo pela ilha seria a mesma mentira que a legenda da
      // casa dizia ("soneca na caminha", doente e com doze sujeiras).
      // "incomodado" fica de FORA: esse humor é sobre a CASA estar suja, não
      // sobre ele estar mal. Bicho incomodado com bagunça anda pela ilha do
      // mesmo jeito — o que ele não faz é sair correndo estando doente ou
      // faminto.
      const quieto = !!pet.sick || ['triste', 'faminto', 'imundo', 'sonolento'].includes(pet.mood)
      const pos = quieto
        ? { x: 0.5, z: 0.55, virado: 1, acao: null, estado: 'parado', perto: 0, lambida: 0 }
        : palcoRef.current.passo(t, dt)
      const enq = enquadrar(pos, { w: painter.w, h: painter.h, escalaBase: escalaCena })

      const atual = {
        ...(r.ate > t ? { ...pet, action: r.acao } : pet),
        mirar: vivo ? { dx: ol.dx, dy: ol.dy } : null,
        carinho: af.forca,
        acaoPalco: pos.acao,
      }
      const periodo = periodoDe(new Date().getHours())
      // O CHAO DA CENA E O MESMO EM QUE ELE PISA.
      //
      // Estava cravado em 0,84 da altura aqui, enquanto o bichinho passou a
      // pisar entre 0,60 e 0,98 conforme a profundidade — e por isso ele andava
      // POR CIMA da grama a maior parte do tempo, com a borda reta do campo
      // atravessando a tela. Agora os dois saem da mesma constante; ver o
      // comentario dela em `petPalco.js`.
      desenharCena(painter, {
        t,
        chao: painter.h * CHAO_FUNDO,
        periodo,
        triste: !!pet.sick,
      })

      // ESPELHAR pra ele virar de lado.
      //
      // O desenho todo olha pra um lado so — dar a ele um segundo conjunto de
      // poses viradas seria refazer o motor inteiro. Espelhar em volta do
      // proprio centro resolve, e leva junto o acessorio, o item na boca e o
      // olhar, porque tudo isso e desenhado la dentro.
      const ctx = painter.ctx
      ctx.save()
      if (pos.virado < 0) {
        ctx.translate(enq.cx, 0)
        ctx.scale(-1, 1)
        ctx.translate(-enq.cx, 0)
      }
      drawPet(painter, atual, t, enq.escala, { cx: enq.cx, chao: enq.chao })
      ctx.restore()

      // A grama da frente entra DEPOIS: o bichinho passa atras dela, e e essa
      // camada que tira a cena do "figurinha colada no vidro".
      desenharFrente(painter, { t, periodo })
      // ...e a lambida vem por ULTIMO, porque ela acontece NO vidro, na frente
      // de tudo — inclusive da grama.
      //
      // A ANCORA DA BOCA e o conserto do "ao lamber a camera fica bem estranho":
      // antes a lingua nascia no rodape da tela, no meio, viesse o bicho de onde
      // viesse — e ele lambe parado no lugar em que chegou, que e um ponto
      // sorteado. Aqui a boca sai das mesmas medidas que ja enquadram o bicho:
      // `alturaU` e a altura dele em unidades de plano, entao 0,74 dela acima do
      // chao e a altura do focinho, e o deslocamento lateral acompanha o lado
      // pra onde ele esta virado. Vale pra qualquer especie e qualquer tamanho,
      // que e o motivo de sair da medida e nao de um numero fixo.
      if (pos.lambida > 0) {
        const alturaPx = alturaU * enq.escala
        desenharLambida(painter, {
          forca: pos.lambida,
          t,
          boca: {
            x: enq.cx + pos.virado * larguraU * enq.escala * 0.16,
            y: enq.chao - alturaPx * 0.74,
          },
          alcance: alturaPx * 0.34,
          virado: pos.virado,
        })
      }
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
    // `res` entra aqui: sem ele o canvas continuaria no tamanho antigo depois de
    // a medida mudar, e o desenho sairia recortado.
  }, [pet, res])

  /**
   * Toque no bichinho.
   *
   * A reacao e SEMPRE — a mesma regra ja decidida pro botao da casa: encostar
   * nele faz alguma coisa acontecer na hora, mesmo quando o premio do servidor
   * esta em descanso. O que reage depende de ONDE se toca, porque cocar a
   * barriga e mexer na cabeca nao sao o mesmo carinho.
   */
  /** Onde o dedo esta, em -1..1, medido do meio do palco. */
  function direcao(e) {
    const caixa = ref.current.getBoundingClientRect()
    const dx = ((e.clientX - caixa.left) / caixa.width - 0.5) * 2
    // O rosto fica no terco de cima; medir do meio do quadro faria ele olhar
    // pra baixo o tempo todo.
    const dy = ((e.clientY - caixa.top) / caixa.height - 0.38) * 2
    return { dx: Math.max(-1, Math.min(1, dx)), dy: Math.max(-1, Math.min(1, dy)) }
  }

  /**
   * O dedo passeando: ele acompanha com o olhar, e ARRASTAR EM CIMA DELE e
   * carinho.
   *
   * O afago e por DISTANCIA percorrida, nao por tempo parado — e a diferenca
   * entre "a mao esta encostada" e "a mao esta fazendo carinho", que e
   * exatamente o gesto do Kinectimals. A cada trecho andado ele reage; e de
   * tanto em tanto o carinho vira o carinho DE VERDADE, o do servidor, que tem
   * o descanso de sempre (decisao travada: carinho nao pode ser botao sem
   * consequencia). A recusa por descanso nao vira erro — a reacao continua.
   */
  function mover(e) {
    if (!ref.current) return
    const d = direcao(e)
    olhar.current = { ...d, ate: Date.now() + 2600 }
    const apertado = e.buttons > 0 || e.pointerType === 'touch'
    if (!apertado) return
    // COM UM ITEM NA MAO, passar por cima dele NAO e carinho.
    //
    // Levar o sushi ate o bichinho e arrastar o dedo em cima dele — exatamente o
    // gesto do afago. Sem esta linha, o caminho ate soltar o prato virava uma
    // sequencia de carinhos, a reacao de "feliz" ficava por cima da cena de
    // comer, e ainda saia uma chamada de carinho no servidor que a pessoa nunca
    // pediu. Quem esta com a mao ocupada nao esta fazendo carinho.
    if (arrastando) return
    const af = afago.current
    const agora = performance.now()
    const dist = af.ultimo ? Math.hypot(e.clientX - af.px, e.clientY - af.py) : 0
    af.px = e.clientX
    af.py = e.clientY
    af.ultimo = agora
    if (dist > 40) return   // pulo de dedo (ou primeiro toque): nao conta
    af.andado += dist
    if (af.andado > 30) {
      af.andado = 0
      af.forca = Math.min(1.6, af.forca + 0.5)
      if (!pet.sick) reacao.current = { ate: agora + 1200, acao: 'feliz' }
      // O carinho de verdade nao e a cada trechinho: seria uma chuva de
      // chamadas no servidor enquanto o dedo anda.
      if (agora - af.premiado > 4000) {
        af.premiado = agora
        window.casalSound?.('pet', `${pet.species}:${pet.sick ? 'doente' : 'feliz'}`)
        onPoke?.('carinho')
      }
    }
  }

  function soltar() {
    afago.current.ultimo = 0
    afago.current.andado = 0
  }

  function tocar(e) {
    const canvas = ref.current
    if (!canvas) return
    olhar.current = { ...direcao(e), ate: Date.now() + 2600 }
    // Tocar LONGE dele e chamar; tocar NELE e mexer com ele. E o mesmo gesto
    // com dois sentidos, separados pela distancia — que e como funciona com
    // bicho de verdade.
    const caixaC = canvas.getBoundingClientRect()
    const fx = (e.clientX - caixaC.left) / caixaC.width
    const fy = (e.clientY - caixaC.top) / caixaC.height
    if (Math.hypot(fx - 0.5, fy - 0.62) > 0.34) {
      palcoRef.current?.chamar()
      window.casalSound?.('pet', `${pet.species}:feliz`)
      return
    }
    afago.current.px = e.clientX
    afago.current.py = e.clientY
    afago.current.ultimo = performance.now()
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
    window.casalSound?.('pet', `${pet.species}:${pet.sick ? 'doente' : acao === 'triste' ? 'triste' : 'feliz'}`)
    onPoke?.(acao)
  }

  return (
    <canvas
      ref={ref}
      className="pet-canvas"
      style={{ width: 128 * res * zoom, height: 108 * res * zoom }}
      onPointerDown={tocar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerLeave={soltar}
      aria-label={`${pet.species_name || 'bichinho'} ${pet.mood || ''}`}
    />
  )
}
