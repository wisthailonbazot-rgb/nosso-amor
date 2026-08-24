import { useEffect,useRef,useState } from 'react'
import { api } from '../api'
import Icon from '../components/Icon'
import PetCanvas from '../render/PetCanvas'
import PetRunner from '../render/PetRunner'

const SPOTS=[[10,22],[65,17],[35,54],[76,60],[14,68],[52,31],[25,40],[70,43],[42,15],[8,48],[82,29],[48,67]]
export default function Games(){
  const[pet,setPet]=useState(null),[playing,setPlaying]=useState(false),[time,setTime]=useState(20)
  const[score,setScore]=useState(0),[combo,setCombo]=useState(0),[lives,setLives]=useState(3),[target,setTarget]=useState(0)
  const[status,setStatus]=useState(null),[sending,setSending]=useState(false),[clock,setClock]=useState(Date.now())
  const started=useRef(0),sent=useRef(false),caught=useRef(false)
  const[jogo,setJogo]=useState('corrida')
  useEffect(()=>{api.get('/api/pet').then(x=>setPet(x.pet)).catch(e=>setStatus({kind:'error',text:e.message}))},[])
  useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),4000);return()=>clearInterval(id)},[])
  useEffect(()=>{if(!playing)return;const id=setInterval(()=>setTime(v=>Math.max(0,v-1)),1000);return()=>clearInterval(id)},[playing])
  useEffect(()=>{if(!playing)return;const speed=Math.max(420,900-score*28);const id=setInterval(()=>{if(!caught.current){setLives(v=>Math.max(0,v-1));setCombo(0)}caught.current=false;setTarget(v=>(v+3+Math.floor(Math.random()*5))%SPOTS.length)},speed);return()=>clearInterval(id)},[playing,score])
  useEffect(()=>{if(playing&&(time===0||lives===0||score>=12)&&!sent.current){sent.current=true;setPlaying(false);setSending(true);api.post('/api/pet/game',{game:'bolinha',score,duration_ms:Math.max(5000,Date.now()-started.current)}).then(x=>{setPet(x.pet);window.casalSound?.('success');setStatus({kind:'ok',text:`${pet?.name||'Seu bichinho'} fez ${score} pontos!`})}).catch(e=>setStatus({kind:'error',text:e.message})).finally(()=>setSending(false))}},[time,lives,score,playing,pet?.name])
  function start(){setScore(0);setCombo(0);setLives(3);setTarget(Math.floor(Math.random()*SPOTS.length));setTime(20);setStatus(null);sent.current=false;caught.current=true;started.current=Date.now();setPlaying(true);window.casalSound?.('game')}
  function hit(){if(!playing)return;caught.current=true;setScore(v=>Math.min(12,v+1));setCombo(v=>v+1);setTarget(v=>(v+5)%SPOTS.length);window.casalSound?.('game')}
  if(!pet)return <div className="full-center"><div className="spinner"/></div>
  if(!pet.chosen)return <div className="card center"><Icon name="paw" size={44}/><h1>Primeiro escolham o bichinho</h1></div>
  const[left,top]=SPOTS[target],cooldown=pet.toy_ready?.game_bolinha,resting=cooldown&&new Date(cooldown).getTime()>clock

  /** Fim de corrida: manda o placar pro servidor, que é quem paga. */
  async function terminouCorrida(pontos, duracao) {
    setSending(true)
    try {
      const r = await api.post('/api/pet/game', { game: 'corrida', score: pontos, duration_ms: duracao })
      setPet(r.pet)
      window.casalSound?.('success')
      setStatus({
        kind: 'ok',
        text: r.coins
          ? `${pontos} petiscos! Vocês ganharam ${r.coins} Corações — o prêmio é uma vez por dia.`
          : `${pontos} petiscos! ${pet.name} ficou mais feliz.`,
      })
    } catch (e) {
      setStatus({ kind: e.status === 409 ? 'warn' : 'error', text: e.message })
    }
    setSending(false)
  }

  const abas = [['corrida', 'Corrida'], ['bolinha', 'Bolinha']]

  return <>
    <h1 className="screen-title">Brincar com {pet.name}</h1>
    <div className="vista-tabs">
      {abas.map(([code, nome]) => (
        <button key={code} className={jogo === code ? 'active' : ''} onClick={() => { setJogo(code); setStatus(null) }}>
          {nome}
        </button>
      ))}
    </div>
    {status && <p className={`notice ${status.kind}`}>{status.text}</p>}
    {jogo === 'corrida' ? (
      <>
        <p className="muted small">
          Ele corre sozinho — você escolhe a hora de pular. Pedra tira uma vida,
          ossinho vale ponto.
        </p>
        <PetRunner pet={pet} aoTerminar={terminouCorrida} />
      </>
    ) : (
    <><p className="muted small">Acerte antes que ela fuja. Três erros encerram a rodada; cada acerto acelera o desafio.</p><div className="pet-game card"><div className="game-hud"><strong>{score}/12</strong><span>combo ×{combo}</span><span>{'●'.repeat(lives)}{'○'.repeat(3-lives)}</span><span>{time}s</span></div><div className="game-bush bush-a"/><div className="game-bush bush-b"/><PetCanvas pet={pet}/>{playing&&<button className="game-ball" aria-label="Pegar bolinha" style={{left:`${left}%`,top:`${top}%`}} onClick={hit}/>} {playing&&combo>=4&&<div className="game-perfect">Combo! Está ficando rápido.</div>}</div><button className="btn btn-primary btn-block" disabled={playing||sending||resting} onClick={start}><Icon name="game" size={18}/>{playing?'Pegando...':sending?'Guardando...':resting?'Descansando (2 min)':'Começar aventura'}</button>
    </>
    )}
  </>
}
