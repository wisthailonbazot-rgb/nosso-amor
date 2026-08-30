// Sons procedurais: nenhum MP3 pesado e nenhuma reprodução automática.
//
// A voz dos BICHINHOS mora em `petVoz.js`: ela é síntese de verdade (fonte
// harmônica + ruído + formantes), e não cabia aqui no meio dos bipes de
// interface. Aqui ficou o que é interface mesmo.
// O AudioContext só nasce no primeiro toque, exatamente como Safari/iOS exige.
import { GRAVACOES, carregarVoz, tocarGravacao } from './petAudio'
import { vocalizar } from './petVoz'
import { EFEITOS, estaMudo, tocarEfeito, usarContexto } from './jogoAudio'

let ctx
const AC=()=>window.AudioContext||window.webkitAudioContext
/** O AudioContext do app. Um so, e nasce no primeiro toque (Safari/iOS). */
export function audioCtx(){return ctx}
function tone(freq,duration=.09,type='sine',gain=.035,delay=0){
  if(!ctx)return
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+delay
  o.type=type;o.frequency.setValueAtTime(freq,now)
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration)
  o.connect(g).connect(ctx.destination);o.start(now);o.stop(now+duration+.02)
}
export function playSound(kind,detail=''){
  if(!ctx||ctx.state!=='running')return
  if(estaMudo())return
  // Som de jogo e GRAVADO e mora em `jogoAudio.js`. Quando o arquivo ainda nao
  // baixou, `tocarEfeito` devolve false e o bipe abaixo assume na mesma hora —
  // ninguem espera a rede pra ouvir o proprio tiro.
  if(kind in EFEITOS){
    if(tocarEfeito(kind))return
    // A reserva conta a mesma historia com oscilador: acerto e afundamento
    // descem (impacto), agua e um sopro curto, e os dois jingles seguem o
    // contorno medido — vitoria sobe, derrota desce.
    if(kind==='naval-acerto'){tone(180,.18,'sawtooth',.05);tone(90,.3,'sawtooth',.04,.03);return}
    if(kind==='naval-afunda'){tone(120,.45,'sawtooth',.055);tone(60,.6,'sine',.05,.05);return}
    if(kind==='naval-agua'){tone(620,.07,'sine',.02);tone(420,.12,'sine',.015,.05);return}
    if(kind==='naval-vitoria'){tone(523,.14,'triangle',.04);tone(659,.14,'triangle',.04,.12);tone(784,.3,'triangle',.04,.24);return}
    if(kind==='naval-derrota'){tone(392,.18,'triangle',.035);tone(311,.18,'triangle',.035,.16);tone(233,.4,'triangle',.03,.32);return}
    // A cozinha, na mesma logica: o gesto vira um bipe que conta a mesma coisa.
    if(kind==='cozinha-picar'){tone(1200,.035,'square',.02);tone(900,.045,'square',.016,.03);return}
    if(kind==='cozinha-panela'){tone(300,.12,'sine',.03);tone(450,.1,'sine',.02,.06);return}
    if(kind==='cozinha-prato'){tone(1500,.05,'sine',.02);return}
    if(kind==='cozinha-lavar'){tone(700,.1,'sine',.015);tone(520,.14,'sine',.012,.06);return}
    if(kind==='cozinha-entregue'){tone(659,.1,'triangle',.04);tone(880,.2,'triangle',.04,.09);return}
    if(kind==='cozinha-errado'){tone(311,.14,'square',.03);tone(233,.22,'square',.028,.12);return}
    if(kind==='cozinha-queimou'){tone(260,.2,'sawtooth',.04);tone(180,.3,'sawtooth',.035,.16);return}
    if(kind==='cozinha-fim'){tone(523,.14,'triangle',.04);tone(659,.14,'triangle',.04,.13);tone(784,.14,'triangle',.04,.26);tone(1047,.34,'triangle',.04,.39);return}
    return
  }
  // `detail` pode vir como "gato" ou como "gato:feliz" — a tela diz a especie e,
  // quando sabe, o humor. Dois bipes viravam o mesmo som pra todo mundo; agora
  // cada bicho tem a voz dele, e o humor muda o jeito de falar.
  if(kind==='pet'){
    const [especie,humor]=String(detail||'').split(':')
    // GRAVAÇÃO PRIMEIRO, SÍNTESE COMO RESERVA.
    //
    // `tocarGravacao` só toca se o arquivo daquela espécie já estiver
    // decodificado — e devolve `false` quando não estiver, o que faz a síntese
    // assumir na mesma hora. Nenhum bicho fica mudo esperando download.
    if(tocarGravacao(ctx,especie,{humor:humor||'normal'}))return
    vocalizar(ctx,especie,{humor:humor||'normal'})
    // Pede o arquivo pro PRÓXIMO toque. O primeiro carinho sai sintetizado; do
    // segundo em diante, gravado. É melhor do que segurar o som esperando rede.
    carregarVoz(ctx,especie)
    return
  }
  if(kind==='coin'){tone(740,.08,'square',.025);tone(990,.12,'square',.02,.07);return}
  if(kind==='success'){tone(440,.1,'triangle');tone(660,.1,'triangle',.035,.08);tone(880,.16,'triangle',.03,.16);return}
  if(kind==='game'){tone(240,.06,'square',.025);tone(360,.08,'square',.018,.04);return}
  tone(kind==='nav'?330:460,.055,'triangle',.018)
}
export function installSounds(){
  const unlock=()=>{
    if(!ctx&&AC())ctx=new (AC())()
    ctx?.resume()
    // Entrega o contexto pro som de jogo. Ele NAO importa daqui de volta — a
    // seta aponta pra um lado so, e o porque esta escrito la.
    usarContexto(ctx)
    // Assim que o navegador libera o áudio (primeiro toque), as gravações já
    // vão sendo buscadas — assim nem o primeiro carinho sai sintetizado.
    if(ctx)for(const especie of Object.keys(GRAVACOES))carregarVoz(ctx,especie)
  }
  window.addEventListener('pointerdown',unlock,{passive:true})
  document.addEventListener('click',(e)=>{
    const el=e.target.closest('button,a');if(!el)return
    const text=(el.textContent||'').toLowerCase()
    playSound(text.includes('comprar')||text.includes('coração')?'coin':el.tagName==='A'?'nav':'tap')
  })
  window.casalSound=playSound
}
