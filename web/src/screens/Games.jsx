import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api'
import Icon from '../components/Icon'
import PetCanvas from '../render/PetCanvas'
import PetRunner from '../render/PetRunner'

/**
 * Os jogos do bichinho.
 *
 * A tela é uma casca só: escolhe o jogo, cuida da tela cheia e conversa com o
 * servidor no fim da partida. A mecânica de cada jogo mora com ele.
 *
 * **Tela cheia, e por que são dois caminhos.** No Android o navegador tem a API
 * de tela cheia de verdade (`requestFullscreen`), que some com a barra do
 * sistema. No iPhone essa API **não existe** fora de vídeo — pedir lá devolve
 * erro e, se o código dependesse só dela, o botão não faria nada e ninguém
 * saberia por quê. Então o modo cheio é sempre uma sobreposição de CSS (isso
 * funciona nos dois), e a API nativa entra COMO EXTRA quando existe. Mesma
 * lição já registrada sobre o push no iOS: recurso do iPhone que falha calado
 * precisa de caminho próprio, não de um `try` mudo.
 */

const SPOTS = [
  [10, 22], [65, 17], [35, 54], [76, 60], [14, 68], [52, 31],
  [25, 40], [70, 43], [42, 15], [8, 48], [82, 29], [48, 67],
]

export default function Games() {
  const [pet, setPet] = useState(null)
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const [jogo, setJogo] = useState('corrida')
  const [cheia, setCheia] = useState(false)
  const casco = useRef(null)

  // bolinha
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(20)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [lives, setLives] = useState(3)
  const [target, setTarget] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const started = useRef(0)
  const sent = useRef(false)
  const caught = useRef(false)

  useEffect(() => {
    api.get('/api/pet').then((x) => setPet(x.pet)).catch((e) => setStatus({ kind: 'error', text: e.message }))
  }, [])
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 4000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setTime((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [playing])
  useEffect(() => {
    if (!playing) return
    const speed = Math.max(420, 900 - score * 28)
    const id = setInterval(() => {
      if (!caught.current) { setLives((v) => Math.max(0, v - 1)); setCombo(0) }
      caught.current = false
      setTarget((v) => (v + 3 + Math.floor(Math.random() * 5)) % SPOTS.length)
    }, speed)
    return () => clearInterval(id)
  }, [playing, score])

  useEffect(() => {
    if (!(playing && (time === 0 || lives === 0 || score >= 12) && !sent.current)) return
    sent.current = true
    setPlaying(false)
    setSending(true)
    api.post('/api/pet/game', { game: 'bolinha', score, duration_ms: Math.max(5000, Date.now() - started.current) })
      .then((x) => {
        setPet(x.pet)
        window.casalSound?.('success')
        setStatus({ kind: 'ok', text: `${pet?.name || 'Seu bichinho'} fez ${score} pontos!` })
      })
      .catch((e) => setStatus({ kind: 'error', text: e.message }))
      .finally(() => setSending(false))
  }, [time, lives, score, playing, pet?.name])

  // ---------------------------------------------------------------- tela cheia
  const sair = useCallback(() => {
    setCheia(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  function alternarCheia() {
    if (cheia) { sair(); return }
    setCheia(true)
    // O extra do Android. `catch` vazio de propósito e comentado: no iPhone
    // isto SEMPRE falha, e não é erro — a sobreposição de CSS acima já entregou
    // a tela cheia. O que não pode é o app pintar um erro vermelho por causa
    // de um recurso que nem devia estar sendo esperado ali.
    casco.current?.requestFullscreen?.().catch(() => {})
  }

  useEffect(() => {
    if (!cheia) return
    // Saindo pelo botão do navegador ou pelo Esc, a sobreposição tem que sair
    // junto — senão o app fica preso numa tela cheia falsa, sem barra de menu.
    const sync = () => { if (!document.fullscreenElement) setCheia(false) }
    const esc = (e) => { if (e.key === 'Escape') sair() }
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('keydown', esc)
    document.body.classList.add('sem-rolagem')
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      window.removeEventListener('keydown', esc)
      document.body.classList.remove('sem-rolagem')
    }
  }, [cheia, sair])

  function start() {
    setScore(0); setCombo(0); setLives(3)
    setTarget(Math.floor(Math.random() * SPOTS.length))
    setTime(20); setStatus(null)
    sent.current = false; caught.current = true
    started.current = Date.now()
    setPlaying(true)
    window.casalSound?.('game')
  }
  function hit() {
    if (!playing) return
    caught.current = true
    setScore((v) => Math.min(12, v + 1))
    setCombo((v) => v + 1)
    setTarget((v) => (v + 5) % SPOTS.length)
    window.casalSound?.('game')
  }

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

  if (!pet) return <div className="full-center"><div className="spinner" /></div>
  if (!pet.chosen) {
    return <div className="card center"><Icon name="paw" size={44} /><h1>Primeiro escolham o bichinho</h1></div>
  }

  const [left, top] = SPOTS[target]
  const cooldown = pet.toy_ready?.game_bolinha
  const resting = cooldown && new Date(cooldown).getTime() > clock
  const abas = [['corrida', 'Corrida'], ['bolinha', 'Bolinha']]

  const corrida = (
    <PetRunner pet={pet} aoTerminar={terminouCorrida} telaCheia={cheia} />
  )

  const bolinha = (
    <>
      <div className={`pet-game card ${cheia ? 'cheia' : ''}`}>
        <div className="game-hud">
          <strong>{score}/12</strong>
          <span>combo ×{combo}</span>
          <span>{'●'.repeat(lives)}{'○'.repeat(3 - lives)}</span>
          <span>{time}s</span>
        </div>
        <div className="game-bush bush-a" />
        <div className="game-bush bush-b" />
        <PetCanvas pet={pet} />
        {playing && (
          <button
            className="game-ball"
            aria-label="Pegar bolinha"
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={hit}
          />
        )}
        {playing && combo >= 4 && <div className="game-perfect">Combo! Está ficando rápido.</div>}
      </div>
      <button className="btn btn-primary btn-block" disabled={playing || sending || resting} onClick={start}>
        <Icon name="game" size={18} />
        {playing ? 'Pegando...' : sending ? 'Guardando...' : resting ? 'Descansando (2 min)' : 'Começar aventura'}
      </button>
    </>
  )

  return (
    <div ref={casco} className={cheia ? 'jogo-cheio' : undefined}>
      <div className="row between">
        {cheia ? (
          <strong className="jogo-cheio-titulo">{jogo === 'corrida' ? 'Corrida' : 'Bolinha'} · {pet.name}</strong>
        ) : (
          <h1 className="screen-title">Brincar com {pet.name}</h1>
        )}
        <button className="btn btn-sm btn-ghost" onClick={alternarCheia}>
          <Icon name={cheia ? 'check' : 'game'} size={15} />
          {cheia ? 'Sair' : 'Tela cheia'}
        </button>
      </div>

      {!cheia && (
        <div className="vista-tabs">
          {abas.map(([code, nome]) => (
            <button
              key={code}
              className={jogo === code ? 'active' : ''}
              onClick={() => { setJogo(code); setStatus(null) }}
            >
              {nome}
            </button>
          ))}
        </div>
      )}

      {status && <p className={`notice ${status.kind}`}>{status.text}</p>}

      {jogo === 'corrida' ? (
        <>
          {!cheia && (
            <p className="muted small">
              Ele corre sozinho — você escolhe a hora. Arraste pra cima pra pular,
              pra baixo pra abaixar. Pedra e tronco se pulam; galho e abelha, só
              abaixando.
            </p>
          )}
          {corrida}
        </>
      ) : (
        <>
          {!cheia && (
            <p className="muted small">
              Acerte antes que ela fuja. Três erros encerram a rodada; cada acerto
              acelera o desafio.
            </p>
          )}
          {bolinha}
        </>
      )}
    </div>
  )
}
