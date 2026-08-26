// Sons procedurais: nenhum MP3 pesado e nenhuma reprodução automática.
//
// A voz dos BICHINHOS mora em `petVoz.js`: ela é síntese de verdade (fonte
// harmônica + ruído + formantes), e não cabia aqui no meio dos bipes de
// interface. Aqui ficou o que é interface mesmo.
// O AudioContext só nasce no primeiro toque, exatamente como Safari/iOS exige.
import { vocalizar } from './petVoz'

let ctx
const AC=()=>window.AudioContext||window.webkitAudioContext
function tone(freq,duration=.09,type='sine',gain=.035,delay=0){
  if(!ctx)return
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+delay
  o.type=type;o.frequency.setValueAtTime(freq,now)
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration)
  o.connect(g).connect(ctx.destination);o.start(now);o.stop(now+duration+.02)
}
export function playSound(kind,detail=''){
  if(!ctx||ctx.state!=='running')return
  // `detail` pode vir como "gato" ou como "gato:feliz" — a tela diz a especie e,
  // quando sabe, o humor. Dois bipes viravam o mesmo som pra todo mundo; agora
  // cada bicho tem a voz dele, e o humor muda o jeito de falar.
  if(kind==='pet'){const [especie,humor]=String(detail||'').split(':');vocalizar(ctx,especie,{humor:humor||'normal'});return}
  if(kind==='coin'){tone(740,.08,'square',.025);tone(990,.12,'square',.02,.07);return}
  if(kind==='success'){tone(440,.1,'triangle');tone(660,.1,'triangle',.035,.08);tone(880,.16,'triangle',.03,.16);return}
  if(kind==='game'){tone(240,.06,'square',.025);tone(360,.08,'square',.018,.04);return}
  tone(kind==='nav'?330:460,.055,'triangle',.018)
}
export function installSounds(){
  const unlock=()=>{if(!ctx&&AC())ctx=new (AC())();ctx?.resume()}
  window.addEventListener('pointerdown',unlock,{passive:true})
  document.addEventListener('click',(e)=>{
    const el=e.target.closest('button,a');if(!el)return
    const text=(el.textContent||'').toLowerCase()
    playSound(text.includes('comprar')||text.includes('coração')?'coin':el.tagName==='A'?'nav':'tap')
  })
  window.casalSound=playSound
}
