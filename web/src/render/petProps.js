// O que aparece NA MÃO do bichinho quando ele usa cada item da loja.
//
// O pedido do dono foi "animação dele comendo, interagindo com osso etc, tudo o
// que vende na loja". Antes existiam só quatro ações genéricas (comer, banho,
// brincar, dormir) e o item comprado não aparecia em lugar nenhum: dar sushi e
// dar ração faziam exatamente o mesmo desenho.
//
// Aqui cada item vendido tem o seu objeto desenhado e o seu jeito de ser usado.
// A regra é a mesma do resto do projeto: **item novo é uma entrada nova aqui**,
// e o `smoke_test` cruza esta tabela com o catálogo do servidor — item vendido
// sem cena de uso reprova antes de chegar na tela de alguém.
//
// O sistema de coordenadas é o mesmo de `drawPet`: caixa de 128×108, bichinho
// centrado em x=64, chão em y≈92.

import { shade } from './pixel'

const OUT = '#33203a'

/**
 * `cena` diz COMO ele usa: muda a pose do corpo (ver `drawPet`).
 *   comer    — abaixa a cabeça até o chão, repetido
 *   roer     — senta e sacode a cabeça pros lados
 *   correr   — persegue o objeto, que foge à frente
 *   pular    — salta atrás do objeto no ar
 *   dormir   — deita, respiração lenta
 *   banho    — espuma e sacudida
 *   vestir   — parado, exibindo o acessório
 */
export const PROPS = {
  // ---------------------------------------------------------------- comida
  pet_petisco: {
    cena: 'comer',
    desenhar(p, t, bob) {
      // biscoitinho no chão, sumindo em três mordidas
      const mordidas = Math.floor((t / 420) % 3)
      const larg = 12 - mordidas * 4
      if (larg <= 0) return
      p.solid(58, 88, larg, 6, '#c9a06b', OUT)
      p.px(60, 90, '#8a5f3c')
      p.px(63, 91, '#8a5f3c')
    },
  },

  pet_racao: {
    cena: 'comer',
    desenhar(p, t) {
      // potinho com as bolinhas de ração, que vão baixando
      p.solid(52, 86, 24, 9, '#9c5f4b', OUT)
      const nivel = 3 - Math.floor((t / 500) % 3)
      for (let i = 0; i < nivel; i++) {
        p.rect(56 + i * 6, 84 - i, 5, 4, '#c98a4b')
        p.px(57 + i * 6, 84 - i, '#8a5f3c')
      }
    },
  },

  pet_bolo: {
    cena: 'comer',
    desenhar(p, t) {
      // fatia de bolo com velinha acesa
      p.solid(52, 78, 24, 16, '#f3d9c0', OUT)
      p.rect(52, 78, 24, 4, '#e8879b')          // cobertura
      p.rect(52, 86, 24, 3, '#c98a4b')          // recheio
      p.rect(63, 70, 2, 8, '#fdf4ea')           // vela
      const chama = Math.sin(t / 150) > 0 ? 0 : 1
      p.px(63, 68 - chama, '#ffd06b')
      p.px(63, 67 - chama, '#fff0b8')
    },
  },

  pet_sushi: {
    cena: 'comer',
    desenhar(p, t) {
      // dois niguiris na tábua
      p.solid(48, 88, 32, 5, '#8a5f3c', OUT)
      for (const dx of [0, 15]) {
        p.solid(52 + dx, 80, 13, 8, '#fdf4ea', OUT)
        p.rect(52 + dx, 79, 13, 4, '#e8724a')   // o peixe por cima
        p.rect(56 + dx, 82, 5, 6, '#3a3340')    // a alga
      }
      // vapor
      const sobe = ((t / 12) % 20) | 0
      p.px(58, 74 - sobe / 2, 'rgba(255,255,255,0.6)')
    },
  },

  pet_banho_kit: {
    cena: 'banho',
    desenhar(p, t) {
      // vidro de shampoo e a bacia
      p.solid(96, 78, 12, 16, '#7fd6b0', OUT)
      p.rect(99, 74, 6, 4, '#5aa88a')
      p.solid(20, 84, 26, 10, '#9dc8ff', OUT)
      // pingos caindo do alto
      for (let i = 0; i < 4; i++) {
        const cai = ((t / 7 + i * 26) % 70) | 0
        p.px(38 + i * 14, 20 + cai, '#bfe0ef')
        p.px(38 + i * 14, 21 + cai, '#e8f5fb')
      }
    },
  },

  // ------------------------------------------------------------ brinquedo
  pet_bolinha: {
    cena: 'correr',
    desenhar(p, t) {
      // a bolinha quica à frente dele
      const fase = (t / 300) % 1
      const x = 92 + Math.sin(t / 300) * 10
      const quique = Math.abs(Math.sin(fase * Math.PI * 2)) * 16
      const y = 88 - quique
      p.solid(Math.round(x) - 5, Math.round(y) - 5, 10, 10, '#e8879b', OUT)
      p.px(Math.round(x) - 2, Math.round(y) - 2, '#ffd3dd')
      // sombra que encolhe quando ela sobe
      const s = Math.max(2, 6 - quique / 4)
      p.rect(Math.round(x) - s / 2, 93, s, 2, 'rgba(40,22,44,0.25)')
    },
  },

  pet_ossinho: {
    cena: 'roer',
    desenhar(p, t, bob) {
      // o ossinho preso na boca, balançando junto com a cabeça
      const gira = Math.sin(t / 120) * 2
      const x = 76 + gira
      const y = 62 + (bob || 0)
      p.solid(x, y, 16, 5, '#f0ebe2', OUT)
      p.solid(x - 3, y - 2, 5, 9, '#f0ebe2', OUT)
      p.solid(x + 14, y - 2, 5, 9, '#f0ebe2', OUT)
      // lasquinhas voando de roer
      if (Math.floor(t / 200) % 2 === 0) {
        p.px(x + 20, y - 3, '#c9c4bd')
        p.px(x + 22, y + 4, '#c9c4bd')
      }
    },
  },

  pet_varinha: {
    cena: 'pular',
    desenhar(p, t) {
      // a peninha da varinha, dançando no alto — ele pula atrás
      const bx = 92 + Math.sin(t / 260) * 14
      const by = 34 + Math.cos(t / 200) * 8
      p.line(118, 12, Math.round(bx), Math.round(by), '#8a5f3c')
      p.fillPoly(
        [
          [bx, by - 7],
          [bx + 6, by],
          [bx, by + 7],
          [bx - 6, by],
        ],
        '#e8879b'
      )
      p.px(Math.round(bx), Math.round(by), '#fff0b8')
    },
  },

  pet_almofada: {
    cena: 'dormir',
    desenhar(p, t) {
      // a almofada embaixo dele
      p.solid(38, 84, 52, 12, '#c88fb0', OUT)
      p.rect(42, 86, 44, 3, shade('#c88fb0', 0.25))
      p.px(40, 90, shade('#c88fb0', -0.3))
      p.px(87, 90, shade('#c88fb0', -0.3))
    },
  },

  // ------------------------------------------------------------ acessorio
  // Acessório não tem cena própria: ele fica VESTIDO (o `drawPet` já desenha),
  // e aqui só entra o brilho que mostra que acabou de ser posto.
  pet_coleira: { cena: 'vestir', desenhar: brilhoDeEstreia },
  pet_gravata: { cena: 'vestir', desenhar: brilhoDeEstreia },
  pet_chapeu: { cena: 'vestir', desenhar: brilhoDeEstreia },
  pet_oculos_pet: { cena: 'vestir', desenhar: brilhoDeEstreia },
}

/** Estrelinhas em volta, pra estrear o acessório. */
function brilhoDeEstreia(p, t) {
  for (let i = 0; i < 4; i++) {
    const fase = ((t / 9 + i * 30) % 120) | 0
    if (fase > 70) continue
    const x = 26 + i * 26
    const y = 30 + (i % 2) * 26
    const r = 2 + (fase % 6) / 3
    p.rect(x - r, y, r * 2 + 1, 1, '#fff0b8')
    p.rect(x, y - r, 1, r * 2 + 1, '#fff0b8')
  }
}

/** A cena de uso de um item. `null` se o item não tem uma (piso, móvel...). */
export function cenaDoItem(code) {
  return PROPS[code] || null
}

export const CODIGOS_COM_CENA = Object.keys(PROPS)
