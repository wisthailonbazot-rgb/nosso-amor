import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api'
import Icon from '../components/Icon'
import { useStore } from '../store'

/**
 * Jogo da memória.
 *
 * O tabuleiro do dia é o MESMO nos dois celulares — o servidor sorteia a partir
 * da data, e não de um `random` sem semente. Isso é o que dá sentido à lista do
 * fim: "fiz em 11 tentativas" só quer dizer alguma coisa se os dois jogaram a
 * mesma distribuição.
 *
 * As cartas são as únicas imagens de arquivo do app inteiro. O resto (avatar,
 * bichinho, móveis, figurinhas) é desenhado por código de propósito, pra loja
 * poder crescer sem ninguém desenhar arquivo — mas aqui a carta É a arte, ela
 * não precisa de estado, pose nem cor variável, e desenhar dezoito ilustrações
 * a mão em pixel só pra virar e desvirar seria trabalho sem retorno.
 */

// Quanto tempo o par errado fica virado antes de voltar. Menos que isso e não
// dá tempo de decorar a segunda carta, que é o jogo inteiro.
const OLHADA_MS = 850

function Carta({ carta, virada, casada, aoTocar, indice }) {
  return (
    <button
      type="button"
      className={`memo-carta ${virada ? 'virada' : ''} ${casada ? 'casada' : ''}`}
      onClick={aoTocar}
      aria-label={virada || casada ? carta : `Carta ${indice + 1}, virada para baixo`}
      disabled={casada}
    >
      <span className="memo-face memo-costas" aria-hidden="true">
        <Icon name="heart" size={26} />
      </span>
      <span className="memo-face memo-frente" aria-hidden="true">
        <img src={`/cartas/${carta}.webp`} alt="" draggable="false" />
      </span>
    </button>
  )
}

export default function GameMemoria({ telaCheia }) {
  const user = useStore((s) => s.user)
  const partner = useStore((s) => s.partner)
  const [dados, setDados] = useState(null)
  const [viradas, setViradas] = useState([])   // índices virados agora
  const [casadas, setCasadas] = useState([])   // índices já resolvidos
  const [tentativas, setTentativas] = useState(0)
  const [comecou, setComecou] = useState(0)
  const [agora, setAgora] = useState(Date.now())
  const [fim, setFim] = useState(null)
  const [erro, setErro] = useState('')
  // A trava fica numa gaveta, e não no estado: `setState` não é imediato, e no
  // toque rápido dava pra virar uma terceira carta antes de o React re-renderizar
  // — a dupla errada ficava presa virada e o tabuleiro travava.
  const resolvendo = useRef(false)
  const enviado = useRef(false)

  const carregar = useCallback(() => {
    api.get('/api/games/memoria').then(setDados).catch((e) => setErro(e.message))
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (!comecou || fim) return
    const id = setInterval(() => setAgora(Date.now()), 500)
    return () => clearInterval(id)
  }, [comecou, fim])

  function tocar(i) {
    if (resolvendo.current || fim) return
    if (casadas.includes(i) || viradas.includes(i)) return
    if (!comecou) { setComecou(Date.now()); setAgora(Date.now()) }
    window.casalSound?.('nav')

    const abertas = [...viradas, i]
    setViradas(abertas)
    if (abertas.length < 2) return

    setTentativas((v) => v + 1)
    const [a, b] = abertas
    if (dados.cartas[a] === dados.cartas[b]) {
      setCasadas((v) => [...v, a, b])
      setViradas([])
      window.casalSound?.('success')
      return
    }
    resolvendo.current = true
    setTimeout(() => {
      setViradas([])
      resolvendo.current = false
    }, OLHADA_MS)
  }

  // Fim de partida: todas casadas.
  useEffect(() => {
    if (!dados || fim || enviado.current) return
    if (casadas.length < dados.cartas.length) return
    enviado.current = true
    const duracao = Math.max(1000, Date.now() - comecou)
    api
      .post('/api/games/memoria/fim', { tentativas, duration_ms: duracao })
      .then((r) => {
        setFim({ ...r, duracao })
        window.casalSound?.('success')
      })
      .catch((e) => setErro(e.message))
  }, [casadas, dados, tentativas, comecou, fim])

  function recomecar() {
    setViradas([]); setCasadas([]); setTentativas(0)
    setComecou(0); setFim(null); setErro('')
    resolvendo.current = false
    enviado.current = false
    carregar()
  }

  if (erro && !dados) return <p className="notice error">{erro}</p>
  if (!dados) return <div className="full-center"><div className="spinner" /></div>
  const segundos = comecou ? Math.round(((fim ? comecou + fim.duracao : agora) - comecou) / 1000) : 0
  const nomeDe = (id) => (id === user?.id ? 'Você' : partner?.name || 'Seu amor')
  const melhores = (fim?.melhores || dados.melhores) ?? []

  return (
    <>
      {!telaCheia && (
        <p className="muted small">
          O tabuleiro é sorteado pelo dia e é <strong>o mesmo</strong> no celular
          dos dois — dá pra comparar quem fez em menos tentativas.
        </p>
      )}

      <div className="game-hud memo-hud">
        <strong>{tentativas} tentativas</strong>
        <span>{casadas.length / 2}/{dados.pares} pares</span>
        <span>{segundos}s</span>
      </div>

      <div className="memo-grade">
        {dados.cartas.map((carta, i) => (
          <Carta
            key={i}
            indice={i}
            carta={carta}
            virada={viradas.includes(i)}
            casada={casadas.includes(i)}
            aoTocar={() => tocar(i)}
          />
        ))}
      </div>

      {fim && (
        <div className="card center">
          <h2>Fechou em {tentativas} tentativas!</h2>
          <p className="muted small">
            {Math.round(fim.duracao / 1000)} segundos.
            {fim.coins
              ? ` Vocês ganharam ${fim.coins} Corações — o prêmio é uma vez por dia.`
              : ' Hoje o prêmio já foi pago; jogar de novo continua valendo pelo placar.'}
          </p>
          <button className="btn btn-primary btn-block" onClick={recomecar}>
            <Icon name="game" size={17} /> Jogar de novo
          </button>
        </div>
      )}

      {melhores.length > 0 && (
        <div className="card">
          <h3>Hoje</h3>
          <ul className="memo-placar">
            {melhores.map((m, i) => (
              <li key={m.user_id}>
                <span className="memo-pos">{i + 1}º</span>
                <strong>{nomeDe(m.user_id)}</strong>
                <span className="muted">
                  {m.tentativas} tentativas · {Math.round(m.duration_ms / 1000)}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {erro && <p className="notice error">{erro}</p>}
    </>
  )
}
