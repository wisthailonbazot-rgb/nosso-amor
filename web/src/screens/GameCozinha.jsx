import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { api } from '../api'
import Icon from '../components/Icon'
import { pararMusica, prepararEfeitos, tocarMusica } from '../jogoAudio'
import { desenharCozinha, estacaoNoPonto, medidas, pontoDaEstacao, pontosDosRotulos } from '../render/cozinha'
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

/**
 * O nome de cada estação, escrito na tela.
 *
 * Existe porque o dono não conseguiu jogar a primeira versão: *"visualmente os
 * negócios são tudo iguais, só muda a cor; é extremamente difícil identificar
 * onde fazer o quê."*
 *
 * A arte foi refeita (cada estação tem silhueta e altura próprias, ver
 * `render/cozinha.js`), mas silhueta só resolve depois que a pessoa já sabe o
 * que a forma quer dizer. Na PRIMEIRA partida ninguém sabe, e nenhum desenho é
 * auto-explicativo. O nome escrito resolve isso de uma vez, e sai do caminho
 * sozinho: quem já aprendeu pode desligar no botão.
 */
const NOMES = {
  tabua: 'tábua', panela: 'fogão', bancada: 'bancada', pratos: 'pratos',
  pia: 'pia', lixo: 'lixo', entrega: 'entrega',
}

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
  const [premio, setPremio] = useState(0)
  // Os nomes e a dica ficam no aparelho: quem aprendeu desliga uma vez e não
  // precisa desligar de novo a cada rodada.
  const [rotulos, setRotulos] = useState(() => {
    try { return localStorage.getItem('casal:cozinha-rotulos') !== '0' } catch { return true }
  })
  const [ajuda, setAjuda] = useState(() => {
    try { return localStorage.getItem('casal:cozinha-ajuda') !== '0' } catch { return true }
  })
  // Abre sozinho na PRIMEIRA vez, e nunca mais. Um jogo que precisa de
  // explicação e esconde a explicação atrás de um botão não explicou nada — e
  // foi exatamente isso que aconteceu na primeira versão.
  const [comoJogar, setComoJogar] = useState(() => {
    try { return localStorage.getItem('casal:cozinha-visto') !== '1' } catch { return false }
  })

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
      setErro('')
    } catch {
      // LER que falha não vira erro na tela, e isso é decisão, não desleixo.
      //
      // Esta busca se repete sozinha: ela é agendada pro próximo prazo e
      // disparada de novo a cada evento de tempo real. Um soluço de rede (ou um
      // `database is locked` do SQLite da bancada) some na tentativa seguinte —
      // mas o aviso vermelho ficava na tela pra sempre, no meio de uma partida,
      // como se algo estivesse quebrado. Ficava a CICATRIZ de um problema que
      // já tinha passado.
      //
      // Se as buscas pararem de vez, isso aparece de um jeito muito mais claro:
      // o jogo congela. Não é um caso que precise de aviso próprio.
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
    } catch (e) {
      // Jogada que falhou por rede vira AVISO, e não erro: o aviso some no
      // próximo toque, e num jogo de três minutos ninguém vai parar pra ler um
      // erro vermelho — vai tocar de novo, que é a resposta certa mesmo.
      setAviso({ tipo: 'warn', texto: 'Não foi dessa vez — toque de novo' })
    }
    ocupado.current = false
  }

  /**
   * O toque na cozinha.
   *
   * Sozinho existe UM cozinheiro, então não há quem escolher: o servidor
   * resolve com `auto`. A dois, cada um manda no seu.
   *
   * Quando a DICA está apontando justamente a estação tocada, quem vai é o
   * cozinheiro que ela indicou — ela sabe QUEM precisa agir, e a escolha
   * automática não.
   */
  function tocar(x, y) {
    const v = atual.current
    if (!v || v.acabou) return
    const m = medidas(v.largura, v.altura)

    // Não existe mais "escolher o cozinheiro": sozinho há UM, e a dois cada um
    // manda no seu. Era uma escolha que só existia pra contornar dois bonecos na
    // mão de uma pessoa — e essa ideia caiu (ver `cozinha.py`).
    const estacao = estacaoNoPonto(v, x, y)
    if (!estacao) return
    // Se a DICA está apontando justamente esta estação, obedece o cozinheiro que
    // ela indicou. Isso não é enfeite: a dica sabe QUEM precisa agir, e a escolha
    // automática não. Ela prefere quem está carregando algo — então "pegue o
    // tomate picado" era atendido por quem segurava o PRATO, e chegar com um
    // prato não pega: MONTA. O tomate ia parar num macarrão que quer ele cozido,
    // e o prato virava lixo. Medido, e agora impossível.
    const dica = v.dica
    const usarDaDica = dica && dica.estacao === estacao.id && dica.lado && !dica.esperar
    // "auto" = o SERVIDOR escolhe quem atende. A tela não tem como escolher
    // certo: pra isso seria preciso saber o que cada gesto faz, e isso é regra
    // do jogo — que mora num lugar só, de propósito. Ver `mandar_auto`.
    const lado = usarDaDica ? dica.lado : (v.solo ? 'auto' : v.meu_lado)
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
          {vista.solo ? 'sozinho' : (vista.parceiro?.name ? `com ${vista.parceiro.name}` : 'a dois')}
        </span>
      </div>

      {/* A DICA. Ela responde "e agora?", que foi exatamente o que faltou na
          primeira versão. Vem calculada do servidor, porque saber o próximo
          passo exige conhecer as receitas — regra do jogo, um dono só. */}
      {ajuda && vista.dica && (
        <p className={`cozinha-dica ${vista.dica.urgente ? 'urgente' : ''} ${vista.dica.esperar ? 'esperando' : ''}`}>
          <strong>{vista.dica.esperar ? 'Aguarde' : 'Agora'}</strong>
          {vista.dica.texto}
        </p>
      )}
      {aviso && <p className={`notice ${aviso.tipo} cozinha-aviso`}>{aviso.texto}</p>}

      <Palco vista={vista} atual={atual} agoraServidor={agoraServidor} aoTocar={tocar}
             rotulos={rotulos} ajuda={ajuda} />

      <div className="cozinha-ajustes">
        <button
          className={`btn-chip ${ajuda ? 'ligado' : ''}`}
          onClick={() => { const v = !ajuda; setAjuda(v); try { localStorage.setItem('casal:cozinha-ajuda', v ? '1' : '0') } catch { /* aba privada */ } }}
        >
          {ajuda ? 'Dica ligada' : 'Dica desligada'}
        </button>
        <button
          className={`btn-chip ${rotulos ? 'ligado' : ''}`}
          onClick={() => { const v = !rotulos; setRotulos(v); try { localStorage.setItem('casal:cozinha-rotulos', v ? '1' : '0') } catch { /* aba privada */ } }}
        >
          {rotulos ? 'Nomes ligados' : 'Nomes desligados'}
        </button>
        <button className="btn-chip" onClick={() => setComoJogar(true)}>Como jogar</button>
        <button className="btn-chip" onClick={encerrar}>Encerrar</button>
      </div>
      {comoJogar && (
        <ComoJogar
          vista={vista}
          aoFechar={() => {
            setComoJogar(false)
            try { localStorage.setItem('casal:cozinha-visto', '1') } catch { /* aba privada */ }
          }}
        />
      )}
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
            {/* A RECEITA ESCRITA, e não só as bolinhas coloridas.
                O dono pediu: "nas comandas coloque o nome ao invés só da cor,
                fica meio confuso de achar certas coisas; coloque a receita".
                Ele está certo pelo mesmo motivo das estações: cor sozinha não
                diz nada — e aqui é pior, porque tomate e carne são dois tons de
                vermelho num círculo de 11 px.
                A bolinha fica, mas como reforço: ela é a ponte visual entre a
                comanda e o ingrediente desenhado na cozinha. */}
            <ul className="cozinha-receita">
              {(receita?.itens || []).map(([ing, estado], i) => (
                <li key={i}>
                  <span
                    className={`cozinha-bolinha ${estado}`}
                    style={{ background: vista.ingredientes[ing]?.cor }}
                  />
                  {receita.rotulos?.[i] || `${vista.ingredientes[ing]?.nome} ${estado}`}
                </li>
              ))}
            </ul>
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
function Palco({ vista, atual, agoraServidor, aoTocar, rotulos, ajuda }) {
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

  // Os nomes e o realce vão numa camada de HTML POR CIMA do canvas, e não
  // desenhados dentro dele. Texto em canvas de pixel art sai borrado (fonte
  // suavizada sobre arte de borda dura); em HTML ele é texto de verdade, cresce
  // com o ajuste de fonte do sistema e o leitor de tela enxerga.
  //
  // `pointer-events: none` na camada é obrigatório: sem isso as etiquetas comem
  // o toque e o jogo inteiro para de responder.
  const dica = vista.dica
  const alvo = ajuda && dica?.estacao != null ? pontoDaEstacao(vista, dica.estacao) : null

  return (
    <div className="cozinha-palco" ref={holder}>
      <div className="cozinha-cena" style={{ width: escala ? m.width * escala : '100%' }}>
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
        {escala > 0 && (
          <div className="cozinha-camada" aria-hidden="true">
            {alvo && (
              <span
                className={`cozinha-alvo ${dica.esperar ? 'esperando' : ''} ${dica.urgente ? 'urgente' : ''}`}
                style={{ left: alvo.x * escala, top: alvo.y * escala }}
              />
            )}
            {rotulos && pontosDosRotulos(vista, NOMES, escala).map((r) => (
              <span
                key={r.id}
                className={`cozinha-rotulo ${dica?.estacao === r.id && ajuda ? 'apontado' : ''}`}
                style={{ left: r.x * escala, top: r.y * escala }}
              >
                {r.texto}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * "Como jogar" — o cartão que faltava.
 *
 * O dono abriu a primeira versão e não conseguiu começar: *"não deu pra
 * entender o que é pra fazer"*. Não havia lugar nenhum no app explicando o
 * fluxo, e um jogo com oito estações e quatro receitas não se descobre sozinho
 * no meio de uma rodada de três minutos.
 *
 * Ele mostra a CADEIA, que é a única coisa que precisa ser entendida uma vez:
 * pegar → preparar → montar no prato → entregar. O resto o jogo ensina jogando,
 * e a dica cobre o "e agora?" em cada passo.
 */
function ComoJogar({ vista, aoFechar }) {
  const passos = [
    ['Pegue', 'Toque numa despensa (as altas, no fundo) e o cozinheiro busca o ingrediente. Ele carrega uma coisa por vez.'],
    ['Prepare', 'Leve à tábua pra picar, ou ao fogão pra cozinhar. Cozinhar não prende o cozinheiro — e é por isso que dá pra esquecer a comida e queimar.'],
    ['Monte', 'Pegue um prato na estante e junte os ingredientes prontos. Tanto faz levar o prato até a comida ou a comida até o prato.'],
    ['Entregue', 'Leve o prato montado até o balcão de entrega, o do vão e da sineta, antes do tempo do pedido acabar.'],
    ['Lave', 'Os pratos são poucos. Depois de entregar eles voltam sujos pra pia, e alguém precisa largar tudo e ir lavar.'],
  ]
  return (
    <div className="cozinha-comojogar" role="dialog" aria-label="Como jogar">
      <h2>Como jogar</h2>
      <ol className="cozinha-passos">
        {passos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <span className="cozinha-passo-n">{i + 1}</span>
            <div><strong>{titulo}.</strong> {texto}</div>
          </li>
        ))}
      </ol>

      <h3>Os pedidos</h3>
      <p className="muted small">
        Cada um mostra as bolinhas do que ele leva. <strong>Bolinha redonda</strong> é
        o ingrediente inteiro, <strong>quadrada</strong> é picado, e a que tem um
        anel branco dentro é cozido.
      </p>
      <div className="cozinha-cardapio">
        {Object.entries(vista.receitas).map(([codigo, r]) => (
          <div key={codigo} className="cozinha-cardapio-item">
            <strong>{r.nome}</strong>
            <div className="cozinha-pedido-itens">
              {r.itens.map(([ing, estado], i) => (
                <span key={i} className={`cozinha-bolinha ${estado}`}
                      style={{ background: vista.ingredientes[ing]?.cor }} />
              ))}
            </div>
            <span className="muted small">
              {(r.rotulos || r.itens.map(([ing, e]) => `${vista.ingredientes[ing]?.nome} ${e}`)).join(' + ')}
            </span>
          </div>
        ))}
      </div>

      <p className="muted small">
        Se travar, deixe a <strong>dica</strong> ligada: ela diz o que fazer agora
        e acende a estação certa. Quando não precisar mais, é só desligar.
      </p>
      <button className="btn btn-primary btn-block" onClick={aoFechar}>Entendi</button>
    </div>
  )
}
