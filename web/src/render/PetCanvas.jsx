import { useEffect, useRef } from 'react'

import { Painter, shade } from './pixel'

const OUT = '#33203a'

export function drawPet(p, pet, tick) {
  const colors = pet.colors?.length ? pet.colors : ['#c98a4b', '#8a5f3c', '#f0ebe2', OUT]
  const [main, dark, light] = colors
  const adult = pet.stage === 'adulto'
  const young = pet.stage === 'jovem'
  const scale = adult ? 1.12 : young ? 1.02 : 0.9
  const bob = Math.sin(tick / 450) > 0 ? 0 : 1
  const cx = 64
  const ground = 92

  // sombra dura, em degraus: nada de blur na pixel art
  p.rect(34, ground + 3, 60, 5, 'rgba(51,32,58,.18)')
  p.rect(44, ground + 8, 40, 2, 'rgba(51,32,58,.12)')

  const rect = (x, y, w, h, fill, line = OUT) => {
    if (line) p.solid(x, y + bob, w, h, fill, line)
    else p.rect(x, y + bob, w, h, fill)
  }
  // cauda atrás do corpo: muda a silhueta antes mesmo de olhar o rosto
  if (pet.species === 'gato') {
    p.fillPoly([[84,70+bob],[101,58+bob],[108,62+bob],[98,68+bob],[107,75+bob],[102,80+bob],[84,79+bob]], dark)
    p.strokePoly([[84,70+bob],[101,58+bob],[108,62+bob],[98,68+bob],[107,75+bob],[102,80+bob],[84,79+bob]],OUT)
  } else if (pet.species === 'cachorro') {
    p.fillPoly([[86,67+bob],[105,61+bob],[110,67+bob],[99,74+bob],[87,76+bob]], main)
    p.strokePoly([[86,67+bob],[105,61+bob],[110,67+bob],[99,74+bob],[87,76+bob]],OUT)
  } else if (pet.species === 'coelho') {
    rect(85,64,13,13,light)
  } else if (pet.species === 'capivara') {
    rect(85,69,8,8,dark)
  }
  const face = (ear) => {
    // corpo, cabeça e focinho compartilham a mesma gramática de blocos do motor
    rect(cx - 22 * scale, 53, 44 * scale, 33 * scale, main)
    rect(cx - 19 * scale, 28, 38 * scale, 34 * scale, main)
    ear(rect, cx, scale, main, dark)
    rect(cx - 10, 48, 20, 11, light, null)
  }

  if (pet.species === 'passaro') {
    rect(47, 42, 34, 38, main)
    rect(34, 49, 18, 26, dark)
    rect(76, 49, 18, 26, dark)
    rect(58, 72, 12, 8, '#f2b33d')
    rect(61, 80, 2, 9, '#8a5f3c', null)
    rect(68, 80, 2, 9, '#8a5f3c', null)
    // penas do peito e pontas das asas
    p.rect(56,60+bob,17,3,light); p.rect(60,65+bob,10,2,light)
    p.rect(35,65+bob,8,3,shade(dark,-.2)); p.rect(85,65+bob,8,3,shade(dark,-.2))
  } else if (pet.species === 'coelho') {
    face((r, x, s, c, d) => {
      r(x - 16, 4, 11, 32, c)
      r(x + 5, 4, 11, 32, c)
      r(x - 13, 8, 5, 23, shade(c, .28), null)
      r(x + 8, 8, 5, 23, shade(c, .28), null)
    })
  } else if (pet.species === 'dragao') {
    face((r, x, s, c, d) => {
      r(x - 19, 18, 11, 17, c)
      r(x + 8, 18, 11, 17, c)
      r(x - 14, 10, 6, 10, '#f2b33d')
      r(x + 8, 10, 6, 10, '#f2b33d')
    })
    // asas e cauda serrilhadas
    p.fillPoly([[40,58],[23,49],[28,70],[40,74]], dark)
    p.fillPoly([[87,61],[107,54],[99,70],[106,76],[84,78]], dark)
    // escamas no peito e espinhos das costas
    for(let y=58;y<82;y+=7)p.rect(61,y+bob,7,3,light)
    for(let y=54;y<78;y+=8)p.fillPoly([[85,y+bob],[92,y-4+bob],[90,y+4+bob]],'#f2b33d')
  } else if (pet.species === 'capivara') {
    face((r, x, s, c) => {
      r(x - 19, 23, 10, 13, c)
      r(x + 9, 23, 10, 13, c)
    })
    rect(47, 45, 34, 17, light)
    p.rect(51,49+bob,26,4,shade(light,-.16)); p.rect(58,56+bob,12,3,shade(light,.18))
  } else {
    // gato e cachorro; as orelhas entregam a diferença
    face((r, x, s, c, d) => {
      if (pet.species === 'gato') {
        p.fillPoly([[x-19,35+bob],[x-16,13+bob],[x-4,31+bob]], c)
        p.fillPoly([[x+19,35+bob],[x+16,13+bob],[x+4,31+bob]], c)
        p.strokePoly([[x-19,35+bob],[x-16,13+bob],[x-4,31+bob]], OUT)
        p.strokePoly([[x+19,35+bob],[x+16,13+bob],[x+4,31+bob]], OUT)
      } else {
        r(x - 27, 25, 12, 27, d)
        r(x + 15, 25, 12, 27, d)
      }
    })
  }

  // patas deixam de ser um corpo quadrado flutuando
  if (pet.species !== 'passaro') {
    rect(44,78,18,10,dark); rect(67,78,18,10,dark)
    p.rect(47,85+bob,12,3,light); p.rect(70,85+bob,12,3,light)
  }
  // volume do pelo: poucos pixels claros, nunca gradiente borrado
  p.rect(47,58+bob,3,13,shade(main,.22)); p.rect(51,57+bob,2,8,shade(main,.22))
  p.rect(78,61+bob,2,10,shade(dark,-.12))
  for (const [dx,dy] of [[-13,1],[-7,-2],[8,-1],[14,2]]) p.px(cx+dx,70+dy+bob,shade(main,.3))

  // rosto: o estado altera o desenho, não apenas uma legenda embaixo
  const eyeY = 43 + bob
  if (pet.sick) {
    p.line(51, eyeY - 2, 57, eyeY + 3, OUT); p.line(57, eyeY - 2, 51, eyeY + 3, OUT)
    p.line(71, eyeY - 2, 77, eyeY + 3, OUT); p.line(77, eyeY - 2, 71, eyeY + 3, OUT)
  } else if (['triste', 'faminto', 'imundo'].includes(pet.mood)) {
    p.rect(52, eyeY, 5, 2, OUT); p.rect(72, eyeY, 5, 2, OUT)
  } else {
    p.rect(53, eyeY - 2, 4, 5, OUT); p.rect(72, eyeY - 2, 4, 5, OUT)
    p.px(54, eyeY - 2, '#fff'); p.px(73, eyeY - 2, '#fff')
  }
  p.rect(63, eyeY + 7, 3, 2, dark)
  // bochechas aparecem quando está feliz; no estado ruim elas somem
  if (pet.mood === 'feliz') { p.rect(46,eyeY+7,6,2,'#e8879b'); p.rect(77,eyeY+7,6,2,'#e8879b') }
  if (pet.mood === 'feliz') {
    p.line(59, eyeY + 11, 64, eyeY + 14, OUT); p.line(64, eyeY + 14, 70, eyeY + 10, OUT)
  } else {
    p.line(60, eyeY + 14, 64, eyeY + 11, OUT); p.line(64, eyeY + 11, 69, eyeY + 14, OUT)
  }
  // espécie também aparece nas marcas do rosto
  if (pet.species === 'gato') { p.line(45,eyeY+10,55,eyeY+11,dark); p.line(74,eyeY+11,84,eyeY+9,dark) }
  if (pet.species === 'cachorro') { p.rect(49,34+bob,8,6,shade(dark,-.08)); p.rect(73,33+bob,7,7,shade(dark,-.08)) }

  // acessórios realmente vestidos
  if (pet.accessories?.neck) {
    rect(47, 61, 35, 5, pet.accessories.neck.includes('gravata') ? '#e8879b' : '#5bb9e8')
    if (pet.accessories.neck.includes('gravata')) p.fillPoly([[64,65+bob],[57,77+bob],[64,84+bob],[71,77+bob]], '#e8879b')
  }
  const head = pet.accessories?.head || ''
  if (head.includes('chapeu')) {
    rect(46, 18, 37, 5, '#e8879b'); rect(53, 7, 23, 13, '#e8879b')
  } else if (head.includes('oculos')) {
    rect(48, 39, 13, 8, '#29242d'); rect(68, 39, 13, 8, '#29242d'); rect(61, 41, 7, 2, OUT, null)
  }

  // aviso desenhado, sem emoji
  if (pet.sick || pet.mess_count > 2) {
    p.fillPoly([[101,12],[113,32],[89,32]], '#f2b33d')
    p.strokePoly([[101,12],[113,32],[89,32]], OUT)
    p.rect(100,19,2,7,OUT); p.rect(100,28,2,2,OUT)
  }
}

export default function PetCanvas({ pet }) {
  const ref = useRef(null)
  useEffect(() => {
    let frame = 0
    let alive = true
    const canvas = ref.current
    const painter = new Painter(canvas)
    painter.resize(128, 108)
    const loop = (t) => {
      if (!alive) return
      painter.clear()
      drawPet(painter, pet, t)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(frame) }
  }, [pet])
  return <canvas ref={ref} className="pet-canvas" aria-label={`${pet.species_name} ${pet.mood}`} />
}
