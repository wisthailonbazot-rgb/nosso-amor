import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { api } from '../api'
import Icon from '../components/Icon'
import { pararMusica, prepararEfeitos, tocarMusica } from '../jogoAudio'
import { desenharCozinha, estacaoNoPonto, medidas } from '../render/cozinha'
import { Painter } from '../render/pixel'
import { subscribe } from '../store'

/**
 * Cozinha do Amor — o 5º jogo. Sozinho ou a dois.
 *
 * O projeto inteiro, com a pesquisa que o embasa, está em
 * `docs/jogo-cozinha.md`. Aqui ficam as três coisas que a TELA precisa acertar.
 *
 * ------------------------------------------------- 1. ela não sabe nenhuma regra
 *
 * A tela não decide que a panela queimou, que o pedido venceu ou que o
 * cozinheiro chegou. O estado carrega, pra cada coisa em andamento, a hora em
 * que ela TERMINA — e daqui só sai conta de três entre duas horas conhecidas.
 * Quem aplica transição é o servidor.
 *
 * Se a tela também soubesse a regra, seriam dois donos pro mesmo fato, e o do
 * app é o que a pessoa vê. É o defeito mais caro deste projeto.
 *
 * -------------------------------------- 2. o relógio é o DO SERVIDOR, não o daqui
 *
 * Todo prazo vem em hora de servidor. O relógio do celular pode estar minutos
 * fora — e aí a barra da panela apareceria cheia desde o começo, ou nunca
 * andaria. Cada resposta traz `agora_ms`, e daí sai a diferença que corrige o
 * relógio local. Ver `desvio`.
 *
 * ---------------------------------------- 3. ela sabe o futuro, e não fica perguntando
 *
 * Como todo prazo está no estado, dá pra agendar UMA busca pro instante do
 * próximo prazo, em vez de perguntar de segundo em segundo. Entre um prazo e
 * outro não há o que perguntar: nada muda sozinho.
 */

const AVISOS = {
  picou: 'cozinha-picar',
  cozinhou: 'cozinha-panela',
  queimou: 'cozinha-queimou',
  lavou: 'cozinha-lavar',
  perdeu: 'cozinha-errado',
  fim: 'cozinha-fim',
}

export default function GameCozinha({ telaCheia = false }) {
  const [vista, setVista] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [escolhido, setEscolhido] = useState(null) // sozinho: cozinheiro na mão
  const [premio, setPremio] = useState(0)

  // A vista fica TAMBÉM numa gaveta porque o laço de animação roda fora do
  // React: um valor capturado por closure congelaria no primeiro quadro.
  const atual = useRef(null)
  const ocupado = useRef(false)
  const anunciado = useRef(new Set())

  /**
   * Quanto o relógio deste celular está atrasado (ou adiantado) em relação ao do
   * servidor. Somado a `Date.now()`, dá a hora que os prazos usam.
   */
  const desvio = useRef(0)
  const agoraServidor = useCallback(() => Date.now() + desvio.current, [])

  const aplicar = useCallback((nova) => {
    if (nova) desvio.current = nova.agora_ms - Date.now()
    atual.current = nova
    setVista(nova)
    if (nova?.premio_ganho) setPremio(nova.premio_ganho)
  }, [])

  const buscar = useCallback(async () => {
    try {
      const r = await api.get('/api/games/cozinha')
      aplicar(r.partida)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [aplicar])

  useEffect(() => {
    prepararEfeitos('cozinha-')
    buscar()
    const off = subscribe('game', (d) => { if (d?.jogo === 'cozinha') buscar() })
    const offVolta = subscribe('resumed', () => buscar())
    return () => { off(); offVolta() }
  }, [buscar])

  // ------------------------------------------------------- a busca AGENDADA
  //
  // Em vez de perguntar de segundo em segundo, a tela pergunta UMA vez, no
  // instante do proximo prazo. E o que a estrutura do estado permite: nada muda
  // sozinho entre dois prazos.
  //
  // Vale pros dois modos, e nao so pro de dois: sozinho, quem faz a panela
  // queimar tambem e o relogio, e sem isto a comida ficaria cozida pra sempre
  // na tela enquanto o servidor ja a considera perdida.
  useEffect(() => {
    if (!vista || vista.acabou) return
    const prazos = []
    for (const e of vista.estacoes) if (e.fim_ms != null) prazos.push(e.fim_ms)
    for (const p of vista.pedidos) prazos.push(p.vence_ms)
    for (const c of Object.values(vista.cozinheiros)) {
      if (c.chega_ms != null) prazos.push(c.chega_ms)
      if (c.ocupado_ate_ms != null) prazos.push(c.ocupado_ate_ms)
    }
    prazos.push(vista.fim_ms)
    const proximo = Math.min(...prazos.filter((v) => v > agoraServidor()))
    if (!Number.isFinite(proximo)) return
    // Uma folga de 120 ms: pedir no milissegundo exato faz a resposta chegar
    // ANTES de o servidor considerar o prazo vencido (a viagem de ida é curta),
    // e aí a tela ficaria pedindo em laço sem nada mudar.
    const espera = Math.max(120, proximo - agoraServidor() + 120)
    const timer = setTimeout(buscar, espera)
    return () => clearTimeout(timer)
  }, [vista, buscar, agoraServidor])

  // ------------------------------------------------------------------ o som
  useEffect(() => {
    for (const a of vista?.avisos || []) {
      const som = AVISOS[a.tipo]
      if (som) window.casalSound?.(som)
    }
  }, [vista])

  const jogando = !!vista && !vista.acabou
  useEffect(() => {
    if (jogando) tocarMusica('cozinha')
    else pararMusica()
  }, [jogando])
  useEffect(() => pararMusica, [])

  useEffect(() => {
    if (!vista?.acabou || anunciado.current.has(vista.id)) return
    anunciado.current.add(vista.id)
    window.casalSound?.('cozinha-fim')
  }, [vista?.acabou, vista?.id])

  // -------------------------------------------------------------- o comando
  async function mandar(lado, estacaoId) {
    if (ocupado.current) return
    ocupado.current = true
    try {
      const r = await api.post(`/api/games/cozinha/${vista.id}/acao`, { lado, estacao: estacaoId })
      aplicar(r.partida)
      if (r.partida.recusado) setAviso({ tipo: 'warn', texto: r.partida.recusado })
      else {
        setAviso(null)
        const som = r.partida.resultado?.som
        if (som === 'entregue') {
          setAviso({ tipo: 'ok', texto: `+${r.partida.resultado.pontos} pontos!` })
          window.casalSound?.('cozinha-entregue')
        } else if (som === 'errado') {
          setAviso({ tipo: 'warn', texto: 'Ninguém pediu isso…' })
          window.casalSound?.('cozinha-errado')
        } else if (som) {
          window.casalSound?.(`cozinha-${som === 'largar' || som === 'montar' ? 'pegar' : som}`)
        }
      }
    } catch (e) { setErro(e.message) }
    ocupado.current = false
  }

  /**
   * O toque na cozinha.
   *
   * Sozinho, o cozinheiro é escolhido pela tela: vai o mais PERTO que não está
   * ocupado. É a solução do Overcooked pro modo de um jogador — e a razão é a
   * mesma: se o jogo fizesse escolher qual boneco a cada toque, o modo sozinho
   * ficaria duas vezes mais lento que o modo a dois em vez de igual.
   *
   * Quem quiser mandar num cozinheiro específico toca nele antes; a escolha vale
   * pro toque seguinte e depois solta.
   */
  function tocar(x, y) {
    const v = atual.current
    if (!v || v.acabou) return
    const m = medidas(v.largura, v.altura)

    if (v.solo) {
      // Tocou EM CIMA de um cozinheiro? Então a intenção era escolher ele.
      for (const [lado, c] of Object.entries(v.cozinheiros)) {
        const [cx, cy] = projetarCozinheiro(c, m, agoraServidor())
        if (Math.hypot(x - cx, y - cy) < 26) {
          setEscolhido(lado === escolhido ? null : lado)
          window.casalSound?.('nav')
          return
        }
      }
    }
    const estacao = estacaoNoPonto(v, x, y)
    if (!estacao) return
    // "auto" = o SERVIDOR escolhe quem atende. A tela não tem como escolher
    // certo: pra isso seria preciso saber o que cada gesto faz, e isso é regra
    // do jogo — que mora num lugar só, de propósito. Ver `mandar_auto`.
    const lado = v.solo ? (escolhido || 'auto') : v.meu_lado
    setEscolhido(null)
    mandar(lado, estacao.id)
  }

  async function comecar(solo) {
    setErro(''); setCarregando(true); setPremio(0); setAviso(null)
    try {
      const r = await api.post('/api/games/cozinha/nova', { solo })
      aplicar(r.partida)
    } catch (e) { setErro(e.message) }
    setCarregando(false)
  }

  async function encerrar() {
    try {
      const r = await api.post(`/api/games/cozinha/${vista.id}/desistir`)
      aplicar(r.partida)
    } catch (e) { setErro(e.message) }
  }

  /** "Ja li." Quem tira o resultado da tela e o jogador, e nao o servidor. */
  async function fechar() {
    setPremio(0)
    try {
      await api.post(`/api/games/cozinha/${vista.id}/visto`)
      aplicar(null)
    } catch (e) { setErro(e.message) }
  }

  if (carregando) return <div className="full-center"><div className="spinner" /></div>

  // ------------------------------------------------------------ sem partida
  if (!vista) {
    return (
      <div className="card center">
        <Icon name="game" size={42} />
        <h2>Cozinha do Amor</h2>
        <p className="muted small">
          Os pedidos chegam sozinhos e cada um tem seu tempo. Piquem, cozinhem,
          montem o prato e entreguem antes do relógio. A panela esquecida queima,
          e os pratos acabam — aí alguém precisa largar tudo e ir lavar.
        </p>
        <p className="muted small">
          <strong>Toque numa estação</strong> e o cozinheiro vai até lá e faz o
          que der: pegar, largar, picar, montar ou entregar. Uma coisa por vez
          na mão — é por isso que a bancada do meio existe.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => comecar(true)}>
          <Icon name="game" size={17} /> Sozinho (os dois cozinheiros são seus)
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => comecar(false)}>
          <Icon name="heart" size={16} /> A dois, cada um no seu celular
        </button>
        {erro && <p className="notice error">{erro}</p>}
      </div>
    )
  }

  // -------------------------------------------------------------- acabou
  if (vista.acabou) {
    const bom = vista.pontos >= 300
    return (
      <div className={`cozinha-fim ${bom ? 'bom' : ''}`}>
        <div className="cozinha-fim-titulo">{bom ? 'Que rodada!' : 'Fim do expediente'}</div>
        <div className="cozinha-fim-pontos">{vista.pontos}</div>
        <div className="muted small">pontos</div>
        <div className="cozinha-fim-placar">
          <span><strong>{vista.entregues}</strong> entregues</span>
          <span><strong>{vista.perdidos}</strong> perdidos</span>
          <span><strong>{vista.errados}</strong> errados</span>
        </div>
        {premio > 0 ? (
          <div className="naval-fim-premio">
            <strong>+{premio}</strong>
            <span>{premio === 1 ? 'Coração' : 'Corações'}</span>
          </div>
        ) : (
          <p className="muted small naval-fim-nota">
            Rodada sem ponto não rende Coração — mas a próxima rende.
          </p>
        )}
        <div className="naval-fim-botoes">
          <button className="btn btn-primary btn-block" onClick={() => comecar(vista.solo)}>
            <Icon name="game" size={17} /> De novo
          </button>
          <button className="btn btn-ghost btn-block" onClick={fechar}>
            <Icon name="check" size={16} /> Fechar
          </button>
        </div>
        {erro && <p className="notice error">{erro}</p>}
      </div>
    )
  }

  // -------------------------------------------------------------- jogando
  const resta = Math.max(0, vista.fim_ms - agoraServidor())
  return (
    <div className={`cozinha ${telaCheia ? 'cheia' : ''}`}>
      <FilaDePedidos vista={vista} agora={agoraServidor} />

      <div className="cozinha-hud">
        <span className="cozinha-relogio">{Math.ceil(resta / 1000)}s</span>
        <span className="cozinha-pontos">{vista.pontos} pts</span>
        <span className="muted small">
          {vista.solo ? (escolhido ? `mandando no ${escolhido === 'p1' ? '1º' : '2º'}` : 'os dois são seus')
            : (vista.parceiro?.name ? `com ${vista.parceiro.name}` : 'a dois')}
        </span>
      </div>

      {aviso && <p className={`notice ${aviso.tipo} cozinha-aviso`}>{aviso.texto}</p>}

      <Palco vista={vista} atual={atual} agoraServidor={agoraServidor} aoTocar={tocar} />

      <button className="btn-ghost btn-sm" onClick={encerrar}>Encerrar o expediente</button>
      {erro && <p className="notice error">{erro}</p>}
    </div>
  )
}

/** Onde o cozinheiro está DESENHADO, em pixel — pra saber se o dedo caiu nele. */
function projetarCozinheiro(c, m, agora) {
  const dur = c.chega_ms - c.saiu_ms
  const f = dur > 0 && agora < c.chega_ms ? Math.max(0, (agora - c.saiu_ms) / dur) : 1
  const col = c.de_col + (c.col - c.de_col) * f
  const row = c.de_row + (c.row - c.de_row) * f
  const TWl = 96, THl = 48, TZl = 48
  return [
    m.origin.x + (col + 0.5 - (row + 0.5)) * (TWl / 2),
    m.origin.y + (col + 0.5 + row + 0.5) * (THl / 2) - 0.8 * TZl,
  ]
}

/**
 * A fila de pedidos, com a contagem de cada um.
 *
 * Um relógio próprio de 250 ms, e não o estado do jogo: a barra tem que descer
 * suave mesmo quando nada acontece na cozinha, e re-renderizar a tela inteira
 * quatro vezes por segundo pra isso seria caro. Aqui só este pedaço redesenha.
 */
function FilaDePedidos({ vista, agora }) {
  const [, tique] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tique((v) => v + 1), 250)
    return () => clearInterval(t)
  }, [])
  const t = agora()
  return (
    <div className="cozinha-pedidos">
      {vista.pedidos.length === 0 && (
        <div className="cozinha-pedido vazio"><span className="muted small">sem pedidos…</span></div>
      )}
      {vista.pedidos.map((p) => {
        const receita = vista.receitas[p.receita]
        const total = p.vence_ms - p.nasce_ms
        const sobra = Math.max(0, Math.min(1, (p.vence_ms - t) / total))
        return (
          <div key={p.id} className={`cozinha-pedido ${sobra < 0.25 ? 'apertado' : ''}`}>
            <strong>{receita?.nome}</strong>
            {/* Os ingredientes como PONTOS COLORIDOS, e não como texto: é a
                interface por ícone que o gênero pede — dá pra conferir o pedido
                de relance, no meio da correria. */}
            <div className="cozinha-pedido-itens">
              {(receita?.itens || []).map(([ing, estado], i) => (
                <span
                  key={i}
                  className={`cozinha-bolinha ${estado}`}
                  style={{ background: vista.ingredientes[ing]?.cor }}
                  title={`${vista.ingredientes[ing]?.nome} ${estado}`}
                />
              ))}
            </div>
            <div className="cozinha-pedido-barra">
              <span style={{ width: `${sobra * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}


/**
 * O palco: o canvas isométrico e o laço de animação.
 *
 * ------------------------------------------------- por que é um componente
 *
 * Ele existe separado por um defeito medido no navegador, e não por organização.
 *
 * Quando o canvas e o laço moravam no componente de cima, os efeitos que os
 * preparam rodavam na PRIMEIRA renderização — em que a tela ainda mostra o
 * carregador e o `<canvas>` não existe. As refs vinham nulas, os efeitos saíam
 * pela porta dos fundos, e quando o canvas finalmente aparecia as dependências
 * deles não tinham mudado (a cozinha é sempre 7×5), então **eles nunca mais
 * rodavam**.
 *
 * O estrago não dava erro nenhum: o canvas ficava com os 300×150 de fábrica,
 * esticados por CSS até 578×386. Medido exatamente assim. A cozinha aparecia
 * borrada e fora de escala, e a conta do toque errava a estação, porque a arte e
 * a caixa na tela tinham tamanhos diferentes.
 *
 * Sendo um componente próprio, ele **monta junto com o canvas**: quando os
 * efeitos rodam, as refs já existem. É a solução do React pra isso, e não um
 * `setTimeout` esperando o elemento aparecer.
 */
function Palco({ vista, atual, agoraServidor, aoTocar }) {
  const holder = useRef(null)
  const canvas = useRef(null)
  const painter = useRef(null)
  const [escala, setEscala] = useState(0)

  const m = medidas(vista.largura, vista.altura)

  useLayoutEffect(() => {
    const caixa = holder.current
    if (!caixa) return
    // A cozinha inteira TEM que caber de uma vez.
    //
    // Na casa o cômodo pode rolar pro lado, porque quem decora tem tempo. Numa
    // rodada de 3 minutos, rolar a tela pra achar a panela é perder a rodada.
    //
    // Por isso, e só por isso, aqui a escala aceita fração quando nem 1× cabe —
    // o resto do app usa escala inteira porque meio pixel de arte vira franja.
    // No celular a conta dá ~0,58, e é o preço de ver a cozinha toda.
    const medir = () => {
      const disponivel = caixa.clientWidth
      if (!disponivel) return
      const inteira = Math.floor(disponivel / m.width)
      setEscala(inteira >= 1 ? Math.min(3, inteira) : disponivel / m.width)
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(caixa)
    return () => obs.disconnect()
  }, [m.width])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    if (!painter.current) painter.current = new Painter(c)
    painter.current.resize(m.width, m.height)
    let vivo = true
    let quadro = 0
    const pintar = (t) => {
      const v = atual.current
      if (v) desenharCozinha(painter.current, v, agoraServidor(), t)
    }
    const laco = (t) => {
      if (!vivo) return
      pintar(t)
      quadro = requestAnimationFrame(laco)
    }
    // Um quadro DESENHADO NA HORA antes do primeiro `requestAnimationFrame`:
    // ele não roda em aba que o navegador não está compondo, e quem volta pro
    // app encontraria um retângulo vazio. Mesma lição do cômodo da casa.
    pintar(performance.now())
    quadro = requestAnimationFrame(laco)
    return () => { vivo = false; cancelAnimationFrame(quadro) }
  }, [m.width, m.height, agoraServidor, atual])

  function clique(evento) {
    const caixa = canvas.current.getBoundingClientRect()
    const ponto = evento.changedTouches?.[0] || evento
    // Do pixel da TELA pro pixel da ARTE. Sem esta divisão o toque cairia na
    // estação errada em qualquer escala diferente de 1 — que é o caso do celular.
    aoTocar(
      (ponto.clientX - caixa.left) / (caixa.width / m.width),
      (ponto.clientY - caixa.top) / (caixa.height / m.height),
    )
  }

  return (
    <div className="cozinha-palco" ref={holder}>
      <canvas
        ref={canvas}
        className="cozinha-canvas"
        style={{
          // Enquanto a medida não saiu, o canvas fica invisível em vez de
          // aparecer no tamanho errado e pular quando a medida chegar.
          width: escala ? m.width * escala : '100%',
          height: escala ? m.height * escala : 'auto',
          visibility: escala ? 'visible' : 'hidden',
        }}
        onClick={clique}
      />
    </div>
  )
}
