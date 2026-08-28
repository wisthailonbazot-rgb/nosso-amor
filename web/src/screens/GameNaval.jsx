import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api'
import Icon from '../components/Icon'
import { subscribe, useStore } from '../store'
import { arteDaNaval } from '../render/naval'

/**
 * Batalha naval — o primeiro jogo de dois, cada um no seu celular.
 *
 * O que faz ele funcionar a dois não é a tela: é o servidor ser o dono da
 * verdade. A posição dos navios do outro **nunca** é enviada pra cá (ver
 * `routers/games.py`), e o resultado do tiro é decidido lá. Se o tabuleiro dele
 * viesse junto e ficasse só escondido no CSS, bastava abrir o painel do
 * navegador pra ganhar toda partida — e num app de duas pessoas isso não é uma
 * hipótese distante, é a primeira coisa que alguém faria de brincadeira.
 *
 * Por isso a tela é burra de propósito: ela mostra o que recebe, manda a casa
 * escolhida e volta a perguntar. O evento de tempo real também não carrega o
 * estado — carrega só "mexeu, vem buscar", justamente porque o estado é
 * diferente pra cada lado e um evento só vazaria um pro outro.
 */

const NADA = 0
const NAVIO = 1

function grade(lado) {
  return Array.from({ length: lado }, () => Array.from({ length: lado }, () => NADA))
}

/** Posiciona a frota sozinho, sem encavalar. É o botão que a maioria usa. */
function sortearFrota(lado, modelo) {
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const mapa = grade(lado)
    const navios = []
    let deuCerto = true
    for (const tamanho of modelo) {
      let posto = false
      for (let t = 0; t < 120 && !posto; t++) {
        const horizontal = Math.random() < 0.5
        const linha = Math.floor(Math.random() * (horizontal ? lado : lado - tamanho + 1))
        const coluna = Math.floor(Math.random() * (horizontal ? lado - tamanho + 1 : lado))
        const casas = []
        for (let i = 0; i < tamanho; i++) {
          casas.push(horizontal ? [linha, coluna + i] : [linha + i, coluna])
        }
        if (casas.some(([l, c]) => mapa[l][c] !== NADA)) continue
        casas.forEach(([l, c]) => { mapa[l][c] = NAVIO })
        navios.push({ linha, coluna, tamanho, horizontal })
        posto = true
      }
      if (!posto) { deuCerto = false; break }
    }
    if (deuCerto) return navios
  }
  return null
}

/**
 * Um tabuleiro. A `variante` decide o PAPEL dele na tela, não só o tamanho:
 * `mar` é onde se joga (ocupa o espaço que sobrar), `mini` é a sua frota como
 * minimapa (só de olhar, nunca recebe toque) e `frota` é o tamanho normal, que
 * só aparece na hora de esconder os navios — ali não existe segundo tabuleiro
 * disputando a tela.
 *
 * ------------------------------------------------ UMA grade, e só uma
 *
 * A casa e o navio que passa por cima dela são o MESMO fato geométrico, e por
 * isso saem da mesma grade: os `<button>` e os navios são irmãos aqui dentro,
 * colocados por `grid-column` / `grid-row` nas mesmas trilhas.
 *
 * A versão anterior desenhava os navios numa SEGUNDA grade sobreposta, com as
 * mesmas medidas repetidas — e duas grades podem discordar, que foi
 * exatamente o que aconteceu (ver HANDOFF 9.25). É a mesma família de defeito
 * que este projeto já pagou três vezes: o prompt com dois donos, o chão do
 * bichinho com dois números, o fundo do palco com dois donos.
 *
 * Dois cuidados que essa escolha obriga, e os dois estão no CSS:
 *
 *  - **as casas ganham posição explícita.** Com um item de posição explícita no
 *    meio (o navio), o preenchimento automático empurraria as casas seguintes
 *    pra outro lugar. Dizendo linha e coluna de cada casa, não existe
 *    preenchimento automático pra atrapalhar.
 *  - **o navio é um `<span>` com o desenho de FUNDO, nunca um `<img>`.** Uma
 *    imagem tem tamanho próprio, e esse tamanho entra na conta do tamanho da
 *    trilha — foi isso que inchava as linhas e esticava o navio pra fora das
 *    casas. Um `<span>` não tem tamanho nenhum: ele só pode ocupar a área que a
 *    grade der.
 *
 * O navio nunca recebe toque (`pointer-events: none`): quem responde ao dedo
 * continua sendo o `<button>` de cada casa, que é o que faz o toque cair certo
 * e o leitor de tela conseguir ler o tabuleiro.
 *
 * E ele só existe no SEU tabuleiro. A posição da frota do outro não chega neste
 * app (ver `routers/games.py`), então não há o que desenhar lá — e é isso que
 * impede o truque de abrir o painel do navegador e ver onde atirar.
 */
export function Tabuleiro({ lado, marcas, aoTocar, titulo, ativo, variante = 'frota', navios = null }) {
  const arte = arteDaNaval()
  return (
    <div className={`naval-tab naval-${variante} ${ativo ? 'ativo' : ''}`}>
      {titulo && <div className="naval-titulo">{titulo}</div>}
      {/* `naval-campo` e o espaco que sobra depois do titulo, e e ele quem diz
          ao tabuleiro qual e o menor lado disponivel — ver o CSS. */}
      <div className="naval-campo">
      <div
        className="naval-grade"
        style={{ '--lado': lado, backgroundImage: `url(${arte.mar})` }}
      >
        {(navios || []).map((n, i) => {
          const linhas = n.casas.map((c) => c[0])
          const colunas = n.casas.map((c) => c[1])
          const l0 = Math.min(...linhas)
          const c0 = Math.min(...colunas)
          const deitado = Math.max(...linhas) === l0
          const fonte = deitado ? arte.navios.h : arte.navios.v
          const src = fonte[n.tamanho] || fonte[3]
          const afundado = n.atingidas.length >= n.tamanho
          return (
            <span
              key={`n${i}`}
              className={`naval-navio ${afundado ? 'afundado' : ''}`}
              aria-hidden="true"
              style={{
                gridColumn: `${c0 + 1} / span ${deitado ? n.tamanho : 1}`,
                gridRow: `${l0 + 1} / span ${deitado ? 1 : n.tamanho}`,
                backgroundImage: `url(${src})`,
              }}
            />
          )
        })}
        {Array.from({ length: lado * lado }).map((_, i) => {
          const l = Math.floor(i / lado)
          const c = i % lado
          const m = marcas[`${l},${c}`] || {}
          const classes = [
            'naval-casa',
            m.navio ? 'navio' : '',
            m.acerto ? 'acerto' : '',
            m.agua ? 'agua' : '',
            m.afundado ? 'afundado' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              className={classes}
              style={{ gridColumn: c + 1, gridRow: l + 1 }}
              disabled={!aoTocar || m.acerto || m.agua}
              onClick={aoTocar ? () => aoTocar(l, c) : undefined}
              aria-label={`linha ${l + 1}, coluna ${c + 1}`}
            />
          )
        })}
      </div>
      </div>
    </div>
  )
}

export default function GameNaval({ telaCheia = false }) {
  const user = useStore((s) => s.user)
  const [partida, setPartida] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [rascunho, setRascunho] = useState(null) // frota antes de confirmar
  const [aviso, setAviso] = useState(null)
  const [erro, setErro] = useState('')
  // Quantos Corações o tiro da vitória pagou.
  //
  // Isto NÃO está na vista da partida: o valor só existe na resposta do POST do
  // tiro que venceu (o prêmio é por dia e travado por `dedupe_key`, então a vista
  // não teria como dizer "quanto" sem inventar). Por isso ele é guardado aqui na
  // hora em que chega — e quem PERDEU nunca recebe esse campo: a tela de fim dele
  // fica sem número nenhum, que é o certo, em vez de mostrar um valor chutado.
  const [premio, setPremio] = useState(null)
  const ocupado = useRef(false)

  // A revisão da última vista aplicada. Fica FORA do estado do React de
  // propósito: ela é consultada dentro de respostas que chegam a qualquer
  // momento, e um valor capturado por closure estaria velho na hora de decidir.
  const revisao = useRef(-1)

  /**
   * Aplica uma vista, mas nunca uma mais VELHA do que a que já está na tela.
   *
   * Toda jogada tem duas respostas viajando ao mesmo tempo: a do próprio POST e
   * a do GET que o evento de tempo real dispara. Se elas voltam fora de ordem —
   * o que numa rede de celular acontece —, a mais velha sobrescrevia a mais
   * nova e o tabuleiro voltava atrás por um instante. O contador do servidor
   * resolve isso sem inventar regra: quem tem revisão maior manda.
   */
  const aplicar = useCallback((nova) => {
    if (!nova) {
      revisao.current = -1
      setPartida(null)
      return
    }
    const r = typeof nova.revision === 'number' ? nova.revision : revisao.current + 1
    if (r < revisao.current) return
    revisao.current = r
    setPartida(nova)
  }, [])

  const buscar = useCallback(async () => {
    try {
      const r = await api.get('/api/games/naval')
      aplicar(r.partida)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [aplicar])

  useEffect(() => {
    buscar()
    // O evento diz só que mexeu; quem busca a SUA vista é cada app. É o que
    // impede o estado de um lado de viajar pro outro num evento só.
    const off = subscribe('game', (d) => { if (d?.jogo === 'naval') buscar() })
    // Voltar pro app depois de um tempo fora: o WebSocket estava caído e a
    // jogada do outro não chegou por evento nenhum. Mesma lição do chat.
    const offVolta = subscribe('resumed', () => buscar())
    return () => { off(); offVolta() }
  }, [buscar])

  // ------------------------------------------------ a rede de segurança
  //
  // O conserto de verdade da lentidão está no `store.js` (o ping que agora
  // espera resposta, e por isso percebe a conexão morta). Isto aqui é o cinto
  // de segurança pra este jogo em específico, e ele existe por uma diferença
  // real: no chat, uma mensagem que atrasa dez segundos é chata; numa partida
  // em que a pessoa está esperando a vez, dez segundos parados são o jogo
  // travado, e ninguém sabe se é a vez de quem.
  //
  // Roda SÓ enquanto a partida está em andamento e a vez é do outro — que é
  // exatamente o momento em que não há nada a fazer além de esperar. Na sua vez
  // ele para: aí quem manda a informação é o seu próprio toque, e um GET no
  // meio disso só concorreria com ele. Fora da partida também não roda.
  //
  // São duas pessoas num app privado: um pedido a cada 5 segundos durante a vez
  // do outro não é carga nenhuma, e o `aplicar` acima garante que uma resposta
  // atrasada não desfaz nada.
  // "in_progress" e o status que a rota poe quando as duas frotas estao no
  // tabuleiro; antes disso ("waiting") o evento de tempo real ja resolve, e
  // depois ("finished") nao ha mais o que esperar.
  const esperandoOOutro =
    partida?.status === 'in_progress' && !partida.sua_vez && !partida.vencedor_id
  useEffect(() => {
    if (!esperandoOOutro) return
    const timer = setInterval(buscar, 5000)
    return () => clearInterval(timer)
  }, [esperandoOOutro, buscar])

  const lado = partida?.lado_do_tamanho || 8
  const modelo = partida?.frota_modelo || [4, 3, 3, 2]

  async function abrir() {
    setErro(''); setCarregando(true)
    // Revanche: o prêmio da partida anterior não pode aparecer na próxima.
    setPremio(null); setAviso(null)
    try {
      const r = await api.post('/api/games/naval/nova')
      aplicar(r.partida)
    } catch (e) { setErro(e.message) }
    setCarregando(false)
  }

  function sortear() {
    const navios = sortearFrota(lado, modelo)
    if (!navios) { setErro('Não consegui posicionar; tente de novo'); return }
    setRascunho(navios)
    window.casalSound?.('nav')
  }

  async function confirmarFrota() {
    if (!rascunho) return
    setErro('')
    try {
      const r = await api.post(`/api/games/naval/${partida.id}/frota`, { navios: rascunho })
      aplicar(r.partida)
      setRascunho(null)
      window.casalSound?.('success')
    } catch (e) { setErro(e.message) }
  }

  async function atirar(linha, coluna) {
    // A trava é uma gaveta, não estado: entre o toque e a resposta o React
    // ainda não re-renderizou, e o toque duplo mandava dois tiros — o segundo
    // voltava com "espere a sua vez" e pintava um erro que não era erro.
    if (ocupado.current || !partida?.sua_vez) return
    ocupado.current = true
    setErro('')
    try {
      const r = await api.post(`/api/games/naval/${partida.id}/tiro`, { linha, coluna })
      if (r.venceu) setPremio(typeof r.coins === 'number' ? r.coins : null)
      aplicar(r.partida)
      window.casalSound?.(r.acertou ? 'success' : 'nav')
      setAviso(
        r.venceu
          ? { tipo: 'ok', texto: r.coins ? `Você ganhou! +${r.coins} Corações` : 'Você ganhou!' }
          : r.afundou
            ? { tipo: 'ok', texto: 'Afundou um navio! Joga de novo.' }
            : r.acertou
              ? { tipo: 'ok', texto: 'Acertou! Joga de novo.' }
              : { tipo: 'warn', texto: 'Água. Passou a vez.' }
      )
    } catch (e) {
      setErro(e.message)
    }
    ocupado.current = false
  }

  async function desistir() {
    try {
      const r = await api.post(`/api/games/naval/${partida.id}/desistir`)
      aplicar(r.partida)
    } catch (e) { setErro(e.message) }
  }

  if (carregando) return <div className="full-center"><div className="spinner" /></div>

  // -------------------------------------------------------- fim de partida
  //
  // Estado PRÓPRIO, e não mais um aviso pequeno em cima do cartão de abrir
  // partida. Do jeito antigo a tela do jogo simplesmente sumia no tiro final e
  // voltava pro começo — quem perdeu nem chegava a entender que tinha acabado.
  if (partida?.status === 'finished') {
    const ganhei = !!partida.sou_o_vencedor
    const nome = ganhei
      ? (user?.name || 'Você')
      : (partida.parceiro?.name || 'Seu amor')
    return (
      <div className={`naval-fim ${ganhei ? 'venci' : 'perdi'}`}>
        {/* A ILUSTRAÇÃO É GERADA POR IA, e este é o lugar certo pra ela.
            Aqui a imagem É a arte: não tem estado, não gira, não precisa
            encaixar em grade nenhuma — o mesmo caso das 14 cartas da memória.
            (O mar e os navios ficaram de fora por causa disso mesmo, e o motivo
            está escrito por extenso em `render/naval.js`.)
            Escolhidas olhando, 3 sementes por assunto, como manda o precedente:
            uma das opções do troféu veio com uma MÃO de gente na imagem e foi
            descartada — o mesmo defeito que já tinha aparecido nas cartas. */}
        <img
          className="naval-fim-arte"
          src={ganhei ? '/naval-vitoria.webp' : '/naval-derrota.webp'}
          alt=""
          width="256"
          height="256"
        />
        <div className="naval-fim-titulo">{ganhei ? 'Vitória!' : 'Fim de partida'}</div>
        <div className="naval-fim-nome">{nome} venceu</div>
        {/* Sem número quando não houve número. Duas situações diferentes:
            quem PERDEU nunca recebe `coins`, e quem ganhou pode ter recarregado
            a tela entre o tiro final e este momento — aí o valor se perdeu no
            caminho e chutar um número seria pior do que não mostrar nenhum.
            (Toda vitória paga desde 26/08; o que muda é o valor cair depois da
            primeira do dia.) */}
        {ganhei && premio ? (
          <div className="naval-fim-premio">
            <strong>+{premio}</strong>
            <span>Corações</span>
          </div>
        ) : (
          <p className="muted small naval-fim-nota">
            {ganhei
              ? 'Os Corações já entraram na sua carteira.'
              : 'A sua frota foi afundada primeiro. Vai que a revanche é sua.'}
          </p>
        )}
        <div className="naval-fim-placar">
          <span>{partida.afundados_dele}/{modelo.length} afundados</span>
          <span>{partida.afundados_meus}/{modelo.length} perdidos</span>
        </div>
        <button className="btn btn-primary btn-block" onClick={abrir}>
          <Icon name="game" size={17} /> Revanche
        </button>
        {erro && <p className="notice error">{erro}</p>}
      </div>
    )
  }

  // ---------------------------------------------------------- sem partida
  if (!partida) {
    return (
      <div className="card center">
        <Icon name="game" size={42} />
        <h2>Batalha naval</h2>
        <p className="muted small">
          Cada um no seu celular. Vocês escondem {modelo.length} navios no
          tabuleiro de {lado}×{lado} e vão atirando um no outro. Quem acerta,
          joga de novo — quem erra, passa a vez.
        </p>
        <button className="btn btn-primary btn-block" onClick={abrir}>
          <Icon name="game" size={17} /> Abrir partida
        </button>
        {erro && <p className="notice error">{erro}</p>}
      </div>
    )
  }

  // --------------------------------------------------- posicionando a frota
  if (!partida.lado_pronto) {
    const marcas = {}
    for (const n of rascunho || []) {
      for (let i = 0; i < n.tamanho; i++) {
        const l = n.horizontal ? n.linha : n.linha + i
        const c = n.horizontal ? n.coluna + i : n.coluna
        marcas[`${l},${c}`] = { navio: true }
      }
    }
    return (
      <div className={`naval ${telaCheia ? 'cheia' : ''}`}>
        <p className="muted small">
          Esconda a sua frota: {modelo.join(', ')} casas. Só você vê onde ela
          está — o servidor não manda a sua posição pro outro celular.
        </p>
        <Tabuleiro
          lado={lado}
          marcas={marcas}
          titulo="Sua frota"
          ativo
          variante="mar"
          navios={(rascunho || []).map((n) => ({
            tamanho: n.tamanho,
            atingidas: [],
            casas: Array.from({ length: n.tamanho }, (_, i) => [
              n.horizontal ? n.linha : n.linha + i,
              n.horizontal ? n.coluna + i : n.coluna,
            ]),
          }))}
        />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-block" onClick={sortear}>
            <Icon name="sparkle" size={16} /> {rascunho ? 'Sortear de novo' : 'Posicionar'}
          </button>
          <button className="btn btn-primary btn-block" disabled={!rascunho} onClick={confirmarFrota}>
            <Icon name="check" size={16} /> Confirmar
          </button>
        </div>
        <button className="btn-ghost btn-sm" onClick={desistir}>Cancelar a partida</button>
        {erro && <p className="notice error">{erro}</p>}
      </div>
    )
  }

  // ----------------------------------------------------- esperando o outro
  if (!partida.outro_pronto) {
    return (
      <div className="card center">
        <div className="spinner" />
        <h2>Frota escondida</h2>
        <p className="muted small">
          Esperando {partida.parceiro?.name || 'seu amor'} posicionar. Assim que
          ele entrar, a partida começa aqui sozinha — não precisa atualizar.
        </p>
        <button className="btn-ghost btn-sm" onClick={desistir}>Cancelar a partida</button>
      </div>
    )
  }

  // ------------------------------------------------------------- jogando
  const meu = {}
  for (const n of partida.meu_tabuleiro.navios) {
    const afundado = n.atingidas.length >= n.tamanho
    for (const [l, c] of n.casas) meu[`${l},${c}`] = { navio: true, afundado }
  }
  for (const t of partida.meu_tabuleiro.tiros_recebidos) {
    const chave = `${t.linha},${t.coluna}`
    meu[chave] = meu[chave]?.navio ? { ...meu[chave], acerto: true } : { agua: true }
  }
  const dele = {}
  for (const t of partida.meus_tiros) {
    dele[`${t.linha},${t.coluna}`] = t.acertou
      ? { acerto: true, afundado: t.afundou }
      : { agua: true }
  }

  // Um tabuleiro grande por vez. Os DOIS 8×8 empilhados não cabiam num celular
  // junto com título, abas e barra de navegação — e era isso que fazia a tela
  // parecer bugada. O mar do outro é onde se joga, então fica grande; a sua
  // frota vira um minimapa no rodapé, que é só informação (quantas casas já
  // levaram tiro) e nunca precisa de toque.
  return (
    <div className={`naval naval-jogo ${telaCheia ? 'cheia' : ''}`}>
      <div className={`naval-vez ${partida.sua_vez ? 'minha' : ''}`}>
        {partida.sua_vez
          ? 'Sua vez — escolha uma casa'
          : `Vez de ${partida.parceiro?.name || 'seu amor'}`}
      </div>
      {aviso && <p className={`notice ${aviso.tipo} naval-aviso`}>{aviso.texto}</p>}

      <Tabuleiro
        lado={lado}
        marcas={dele}
        titulo={`Mar de ${partida.parceiro?.name || 'seu amor'} — ${partida.afundados_dele}/${modelo.length} afundados`}
        aoTocar={partida.sua_vez ? atirar : null}
        ativo={partida.sua_vez}
        variante="mar"
      />

      <div className="naval-rodape">
        <Tabuleiro
          lado={lado}
          marcas={meu}
          variante="mini"
          navios={partida.meu_tabuleiro.navios}
        />
        <div className="naval-rodape-info">
          <strong>Sua frota</strong>
          <span className="muted small">{partida.afundados_meus}/{modelo.length} perdidos</span>
          <button className="btn-ghost btn-sm" onClick={desistir}>Desistir</button>
        </div>
      </div>
      {erro && <p className="notice error">{erro}</p>}
    </div>
  )
}
