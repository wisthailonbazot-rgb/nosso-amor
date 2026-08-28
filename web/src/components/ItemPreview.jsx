import { useEffect, useRef } from 'react'

import { Painter } from '../render/pixel'
import { drawItem } from '../render/furniture'
import { roomMetrics } from '../render/iso'
import { drawAvatar } from '../render/avatar'
import { drawPetIcon } from '../render/petitems'
import { drawPet } from '../render/PetCanvas'

/**
 * A miniatura de um item na loja.
 *
 * Roupa é mostrada NO BONECO, não solta — ver a peça pendurada não diz nada;
 * ver como fica vestido é o que faz decidir a compra. Móvel é desenhado sozinho,
 * sem o cômodo em volta, pra caber no cartão.
 */
export default function ItemPreview({ item, avatarConfig, scale = 2 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const painter = new Painter(canvas)
    const meta = item.metadata || {}

    if (item.category === 'avatar') {
      // veste a peça por cima do avatar atual: dá pra ver como fica em VOCÊ
      const dressed = { ...avatarConfig }
      if (meta.slot === 'hair') dressed.hair_style = meta.style
      else if (meta.slot) dressed[meta.slot] = meta.style

      // E mostra só o pedaço do corpo onde a peça está. Com o boneco inteiro num
      // cartão pequeno, saia e calça ficam iguais — o que derrota o propósito da
      // miniatura. Aqui a janela acompanha a peça.
      const WINDOW = {
        hair: [0, 26],
        head: [0, 26],
        top: [16, 42],
        extra: [14, 44],
        bottom: [30, 52],
        shoes: [34, 56],
      }
      const [from, to] = WINDOW[meta.slot] || [0, 56]
      painter.resize(40, to - from)
      painter.clear()
      drawAvatar(painter, dressed, 4, 4 - from)
      return
    }

    if (item.category === 'house') {
      const w = meta.width ?? 1
      const d = meta.height ?? 1
      if (!w || !d || /^(floor|wall):/.test(meta.shape||'')) {
        painter.resize(52, 36)
        const [kind,style]=(meta.shape||'').split(':')
        const colors={madeira:['#b07a4e','#7d5232'],ceramica:['#e3ded4','#bdb5a6'],carpete:['#b45f8a','#8c4268'],grama:['#79a85f','#5d8648'],pedra:['#aaa69f','#77736d'],rosa:['#f0cdd9','#d58fa9'],azul:['#cfe0f5','#8aafd9'],verde:['#d3e8d0','#8dbb88']}
        const [base,line]=colors[style]||['#d8c6ae','#8e745b']
        painter.clear(base)
        if(kind==='floor') for(let y=4;y<36;y+=8)for(let x=(y/8)%2?0:8;x<52;x+=16){painter.line(x,y,x+12,y,line);painter.line(x+12,y,x+16,y-4,line)}
        else { for(let x=7;x<52;x+=13)for(let y=7;y<36;y+=12){painter.px(x,y,line);painter.px(x-1,y+1,line);painter.px(x+1,y+1,line)} }
        painter.strokePoly(
          [
            [2, 2],
            [50, 2],
            [50, 34],
            [2, 34],
          ],
          '#4a3b37'
        )
        return
      }
      const metrics = roomMetrics(w + 1, d + 1, 0)
      const draw = () => {
        painter.resize(metrics.width, metrics.height + 26)
        painter.clear()
        drawItem(
          painter,
          {
            id: 0,
            shape: (meta.shape || '').split(':')[0],
            col: 0,
            row: 0,
            w,
            d,
            dir: 0,
          },
          { x: metrics.origin.x, y: 24 },
          0,
          draw
        )
      }
      draw()
      return
    }

    if (item.category === 'pet' && item.subcategory === 'especie') {
      const species=meta.species||'gato'
      const colors={gato:['#f2a03d','#8d8d97','#f0ebe2'],cachorro:['#c98a4b','#6b4a2f','#e8dcc6'],coelho:['#f0ebe2','#c9c4bd','#fff'],passaro:['#f2c53d','#5bb9e8','#fff'],capivara:['#a87b52','#8a6340','#c9a67f'],dragao:['#7fd6b0','#6b4fa0','#e8879b']}
      // Direto no tamanho do cartão, sem desenhar grande e encolher: reduzir
      // pixel art joga pixel fora, e era o que deixava a miniatura da espécie
      // esfarelada na loja.
      painter.resize(64,54);painter.clear()
      drawPet(painter,{species,colors:colors[species],stage:'filhote',mood:'feliz',accessories:{}},0)
      return
    }
    // pet: comida, brinquedo, acessório
    painter.resize(32, 32)
    painter.clear()
    drawPetIcon(painter, item.code, item.subcategory)
  }, [item, avatarConfig])

  return <canvas ref={ref} style={{ transform: `scale(${scale})`, transformOrigin: 'center' }} />
}
