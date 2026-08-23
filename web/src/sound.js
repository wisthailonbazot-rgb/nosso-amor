// Sons procedurais: nenhum MP3 pesado e nenhuma reprodução automática.
// O AudioContext só nasce no primeiro toque, exatamente como Safari/iOS exige.
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
  if(kind==='pet'){const f={gato:620,cachorro:220,coelho:760,passaro:1100,capivara:180,dragao:120}[detail]||480;tone(f,.13,detail==='dragao'?'sawtooth':'triangle',.045);tone(f*1.3,.1,'sine',.025,.1);return}
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
