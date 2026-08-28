// Bancada de conferência do motor de pixel.
//
// Desenha TODA forma de móvel e TODA peça de avatar, isolada. Serve pra duas
// coisas: olhar se ficou bonito, e pegar a peça que "não aparece" — erro fácil de
// passar batido quando o item está escondido atrás de outro na cena cheia.
//
// A conferência é automática: cada quadro é pintado num canvas de rascunho e os
// pixels são contados. Peça que pinta quase nada aparece marcada em vermelho.
//
// Rota /lab. Não entra em nenhum menu; é ferramenta de trabalho.

import { useEffect, useRef, useState } from 'react'

import { Painter } from '../render/pixel'
import { auditarTudo } from '../render/furnitureAudit'
import { SHAPES, drawItem } from '../render/furniture'
import { roomMetrics } from '../render/iso'
import { drawScene, FLOOR_STYLES, WALL_STYLES } from '../render/room'
import { AVATAR_H, AVATAR_W, STYLE_LISTS, drawAvatar } from '../render/avatar'
import { drawPetIcon, PET_ICON_CODES } from '../render/petitems'
import { STICKER_CODES, STICKER_LABEL } from '../render/stickers'
import Sticker from '../components/Sticker'
import { STICKERS_HD } from '../render/stickersHD'
import { drawPet } from '../render/PetCanvas'
import { CODIGOS_ESPECIE, NOMES_CLIPES, clipeDe, planoDe } from '../render/petRig'
import { VOZES, nomeDaVoz, vocalizar } from '../petVoz'
import { criarPalco, enquadrar } from '../render/petPalco'
import { desenharLambida } from '../render/petCena'
import { ladrilhoDoMar, navio, navioEmPe } from '../render/naval'
import { Tabuleiro } from './GameNaval'

// As seis espécies, os três estágios e os humores que MUDAM o desenho.
// Estão aqui porque o bichinho é desenhado por espécie: um `if` esquecido numa
// espécie só aparece pra quem escolheu aquela — e é justamente quem nunca vai
// abrir um chamado dizendo "meu coelho está sem orelha".
const LAB_SPECIES = [
  ['gato', ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2']],
  ['cachorro', ['#c98a4b', '#6b4a2f', '#e8dcc6', '#3a3340']],
  ['coelho', ['#f0ebe2', '#c9c4bd', '#9c7b62', '#3a3340']],
  ['passaro', ['#f2c53d', '#5bb9e8', '#7fd6b0', '#e8879b']],
  ['capivara', ['#a87b52', '#8a6340', '#c9a67f', '#3a3340']],
  ['dragao', ['#7fd6b0', '#6b4fa0', '#e8879b', '#f2c53d']],
]
const LAB_STAGES = ['filhote', 'jovem', 'adulto']

// O crescimento agora e CONTINUO (ver `petRig.planoDe`), entao a bancada precisa
// olhar os pontos do meio tambem: e entre um estagio e outro que uma conta de
// proporcao errada faz a perna atravessar o corpo, e nos tres estagios redondos
// isso pode nao aparecer.
const LAB_CRESCIMENTO = [0, 0.25, 0.5, 0.75, 1]

// Acessório vestido, em TODA espécie e em pose que MEXE no corpo.
//
// Antes só existia "gato parado com coleira". Isso bastava enquanto o bichinho
// era uma pilha de retângulos parada: o chapéu ficava num y fixo e pronto. Com
// o esqueleto, a cabeça abaixa pra comer, tomba pra dormir e sobe no pulo — e um
// acessório presilhado em coordenada fixa flutua no ar ou atravessa o pescoço.
// Por isso a conferência é cruzada: acessório × espécie, e cada um numa pose
// diferente, justamente as que mais deslocam a cabeça.
const LAB_ACESSORIOS = [
  ['pet_coleira', 'neck', 'comer'],
  ['pet_gravata', 'neck', 'dormir'],
  ['pet_chapeu', 'head', 'pular'],
  ['pet_oculos_pet', 'head', 'sentar'],
  ['pet_chapeu', 'head', 'deitar'],
]
const LAB_MOODS = ['feliz', 'triste', 'faminto', 'doente']

const MIN_PIXELS = 20 // abaixo disso, considera que a peça não desenhou nada

const SIZES = {
  sofa: [3, 1], bed: [3, 2], table: [2, 2], chair: [1, 1], shelf: [2, 1],
  wardrobe: [2, 1], puff: [1, 1], rug: [3, 2], tv: [2, 1], speaker: [1, 1],
  console: [1, 1], fridge: [1, 2], plant: [1, 1], plant_big: [1, 1],
  lamp: [1, 1], candles: [1, 1], frame: [1, 1], frame_couple: [2, 1],
  stove:[2,1], petbed:[2,2], petbowl:[1,1], scratchpost:[1,1], pethouse:[2,2],
  hammock:[3,1], grill:[2,1], garden:[2,2], swing:[2,2], tree:[2,2],
  clothesline:[3,1], gardenstool:[1,1],
}

/** Conta quantos pixels uma função de desenho pinta. É o teste automático. */
function countPainted(width, height, paint) {
  const canvas = document.createElement('canvas')
  const painter = new Painter(canvas)
  painter.resize(width, height)
  painter.clear()
  paint(painter)
  const data = painter.ctx.getImageData(0, 0, width, height).data
  let painted = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++
  return painted
}

/**
 * A caixa que o desenho realmente ocupa, em FRACAO do canvas.
 *
 * Serve pra comparar o mesmo bicho desenhado em escalas diferentes: se o motor
 * estiver certo, ele ocupa a mesma fatia do quadro nas duas. Quando alguma
 * medida nao acompanha a escala (numero cru em pixel, contorno de espessura
 * fixa, pose multiplicada duas vezes), essa fatia muda — e e assim que o
 * defeito aparece sem ninguem precisar olhar.
 */
function caixaPintada(width, height, paint) {
  const canvas = document.createElement('canvas')
  const painter = new Painter(canvas)
  painter.resize(width, height)
  painter.clear()
  paint(painter)
  const data = painter.ctx.getImageData(0, 0, width, height).data
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { larg: (x1 - x0 + 1) / width, alt: (y1 - y0 + 1) / height }
}

/**
 * A aba de VOZES.
 *
 * O som era a unica coisa do app que ninguem conferia. As artes tem bancada
 * desde cedo — movel, bichinho, figurinha, item —, mas a voz do bicho so dava
 * pra saber se estava certa apertando o botao e ouvindo, e ninguem faz isso
 * depois de cada mexida. Resultado: por muito tempo os seis bichos usaram o
 * MESMO bipe com a frequencia trocada, e isso passou.
 *
 * Aqui cada especie e sintetizada num `OfflineAudioContext` — que renderiza sem
 * tocar nada — e viram dois numeros e um desenho:
 *
 *   - **volume (RMS)**: se der zero, a voz nao esta saindo. E o equivalente ao
 *     "⚠ vazio" das abas de desenho;
 *   - **centro do espectro**: onde a energia do som se concentra. E o numero
 *     que separa um piado de um rosnado. Duas especies com o centro quase igual
 *     soariam iguais na pratica, e a aba reprova.
 *
 * O botao toca a voz de verdade, pra conferir de ouvido o que os numeros nao
 * contam.
 */
function AbaVozes() {
  const [medidas, setMedidas] = useState(null)

  useEffect(() => {
    let vivo = true
    const medir = async () => {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
      if (!OAC) { setMedidas('sem-suporte'); return }
      const saida = []
      for (const especie of Object.keys(VOZES)) {
        const ctx = new OAC(1, 44100 * 2, 44100)
        // `vocalizar` so trabalha com o contexto rodando; no offline o estado e
        // 'suspended' ate o render, entao a checagem e enganada de proposito.
        Object.defineProperty(ctx, 'state', { get: () => 'running' })
        vocalizar(ctx, especie, { humor: 'normal' })
        const buffer = await ctx.startRendering()
        const d = buffer.getChannelData(0)
        let soma = 0
        for (let i = 0; i < d.length; i++) soma += d[i] * d[i]
        const rms = Math.sqrt(soma / d.length)
        // centro do espectro por autocorrelacao grosseira: conta quantas vezes
        // o sinal cruza o zero. Mais cruzamentos = som mais agudo. E o jeito
        // mais simples de medir "grave x agudo" sem uma FFT inteira.
        let cruzou = 0
        let ultimo = 0
        let amostras = 0
        for (let i = 0; i < d.length; i++) {
          if (Math.abs(d[i]) < 1e-4) continue
          amostras++
          const sinal = d[i] > 0 ? 1 : -1
          if (ultimo && sinal !== ultimo) cruzou++
          ultimo = sinal
        }
        const agudez = amostras ? Math.round((cruzou / amostras) * 44100 / 2) : 0
        // quanto tempo houve som de verdade
        let dur = 0
        for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.002) dur = i

        // ------------------------------------------------- MOVIMENTO e CORPO
        //
        // Estas duas medidas nasceram do defeito que o dono ouviu: as vozes
        // passavam por aqui aprovadas e mesmo assim "não pareciam nem um pouco"
        // com os bichos. Volume e agudez não podiam pegar isso — as duas olham
        // o som inteiro de uma vez, e o que estava errado era o som não MUDAR
        // enquanto acontece. Um bipe e um miado têm a mesma agudez média.
        //
        //   `movimento` — a altura varia quanto ao longo do som? Mede a agudez
        //     em fatias de 20 ms e devolve a razão entre a maior e a menor. Som
        //     de altura fixa dá 1,0; um miado, um latido ou um piado sobem e
        //     descem e dão bem mais. Abaixo de 1,25 a aba REPROVA: aquilo é uma
        //     nota, não uma vocalização, e era exatamente o que estava aqui;
        //
        //   `corpo` — que fração do som fica perto do pico de energia. Baixo quer
        //     dizer que a energia se concentra num ápice (o miado, cuja altura
        //     varre por cima do formante no meio e estoura ali; o latido, que
        //     corta); alto quer dizer som parelho do começo ao fim. Não reprova:
        //     os dois extremos são legítimos. O número existe pra conferir que
        //     os seis NÃO têm todos a mesma forma no tempo — que era o caso
        //     antes, quando um envelope só servia pra todo mundo, e é metade do
        //     motivo de eles soarem parentes.
        const jan = Math.round(44100 * 0.02)
        const alturas = []
        const forcas = []
        for (let i = 0; i + jan < d.length; i += jan) {
          let c = 0
          let ult = 0
          let n = 0
          let energia = 0
          for (let k = i; k < i + jan; k++) {
            energia += d[k] * d[k]
            if (Math.abs(d[k]) < 1e-4) continue
            n++
            const sinal = d[k] > 0 ? 1 : -1
            if (ult && sinal !== ult) c++
            ult = sinal
          }
          const forca = Math.sqrt(energia / jan)
          // Só janelas com som de verdade: o silêncio entre sílabas tem altura
          // indefinida e entraria como "movimento" que não existe.
          if (forca > rms * 0.35 && n > jan * 0.2) {
            alturas.push((c / n) * 44100 / 2)
            forcas.push(forca)
          }
        }
        const movimento = alturas.length > 1
          ? +(Math.max(...alturas) / Math.max(1, Math.min(...alturas))).toFixed(2)
          : 1
        const pico = forcas.length ? Math.max(...forcas) : 0
        const corpo = forcas.length
          ? +(forcas.filter((f) => f > pico * 0.55).length / forcas.length).toFixed(2)
          : 0

        saida.push({
          especie,
          nome: nomeDaVoz(especie),
          rms: +(rms * 1000).toFixed(2),
          agudez,
          movimento,
          corpo,
          duracao: +(dur / 44100).toFixed(2),
        })
      }
      if (vivo) setMedidas(saida)
    }
    medir()
    return () => { vivo = false }
  }, [])

  function tocar(especie) {
    window.casalSound?.('pet', especie)
  }

  if (!medidas) return <p className="muted small">Sintetizando as vozes…</p>
  if (medidas === 'sem-suporte') return <p className="notice warn">Este navegador não renderiza áudio offline.</p>

  const mudas = medidas.filter((m) => m.rms <= 0.01)
  // Ver o comentário da medição: som de altura parada é bipe, não bicho.
  const paradas = medidas.filter((m) => m.movimento < 1.25)
  // Duas vozes com agudez muito parecida soam iguais na prática.
  const parecidas = []
  for (let i = 0; i < medidas.length; i++) {
    for (let j = i + 1; j < medidas.length; j++) {
      const a = medidas[i]
      const b = medidas[j]
      const dif = Math.abs(a.agudez - b.agudez) / Math.max(a.agudez, b.agudez, 1)
      if (dif < 0.12) parecidas.push(`${a.especie} e ${b.especie}`)
    }
  }

  return (
    <>
      <p className="muted small">
        Cada voz é sintetizada sem tocar nada e medida. Toque para ouvir —
        o áudio só liga depois do primeiro toque na página (regra do iPhone).
      </p>
      {mudas.length > 0 && (
        <p className="notice error">Sem som nenhum: {mudas.map((m) => m.especie).join(', ')}</p>
      )}
      {paradas.length > 0 && (
        <p className="notice error">
          Altura parada (soaria como bipe, não como bicho):{' '}
          {paradas.map((m) => `${m.especie} (${m.movimento}×)`).join(' · ')}
        </p>
      )}
      {parecidas.length > 0 && (
        <p className="notice error">
          Vozes quase idênticas (soariam iguais): {parecidas.join(' · ')}
        </p>
      )}
      <div className="lab-grid lab-vozes">
        {medidas.map((m) => (
          <button key={m.especie} className="lab-tile" onClick={() => tocar(m.especie)}>
            <strong>{m.especie}</strong>
            <span className="lab-tile-label">
              {m.nome} · {m.duracao}s<br />
              volume {m.rms} · agudez {m.agudez} Hz<br />
              movimento {m.movimento}× · corpo {m.corpo}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * O PASSEIO do bichinho: ele anda pelo cenário sem dar salto.
 *
 * Esta aba nasceu de um defeito que o dono descreveu como "o movimento do
 * animal pra frente e pra trás está completamente bugado", e que nenhuma aba
 * daqui podia pegar: as outras conferem DESENHO — se a peça sai, se a proporção
 * acompanha a escala —, e este era um defeito de MOVIMENTO. Peça nenhuma estava
 * errada; o que estava errado era o tamanho dela mudar aos trancos.
 *
 * A causa está escrita por extenso no `petPalco.js`: existiam duas variáveis
 * (`z` e `perto`) descrevendo a mesma coisa — a distância até a câmera — e as
 * duas entravam na conta do tamanho. `perto` era ligado por ESTADO, não por
 * posição, então trocar de estado fazia o bicho pular de 1× pra 1,5× parado no
 * lugar, e sair da lambida o fazia despencar sem ter andado.
 *
 * O que se mede aqui é exatamente isso: o palco é simulado a 60 quadros por
 * segundo, sem desenhar nada (ele é só contas), e se olha o **maior salto de um
 * quadro pro seguinte**. Bicho andando muda de tamanho devagar; o defeito
 * antigo dava um degrau que aparece na medição na hora. O limite é 1,5% por
 * quadro — a 60 quadros por segundo, isso ainda permite crescer 2,4× em um
 * segundo, que é mais rápido do que ele corre.
 *
 * Duas medidas vêm junto e não reprovam, porque servem pra ler o comportamento:
 * até onde ele chega (tem que encostar no vidro e tem que ir lá pro fundo) e
 * quanto tempo passa andando, pra a ilha não virar um bicho parado.
 */
function AbaPasseio() {
  const [r, setR] = useState(null)
  const [lambida, setLambida] = useState(null)

  /**
   * A LÍNGUA SAI DA BOCA, e não do rodapé da tela.
   *
   * O dono disse que "ao lamber a câmera fica bem estranho". Estava: a língua
   * nascia em `w * 0,5, h * 0,96` — o meio do rodapé —, fixo, viesse o bicho de
   * onde viesse. Como ele lambe parado no ponto em que chegou, ela subia por
   * fora do corpo dele e lia como uma coisa rosa crescendo do chão.
   *
   * A conferência é a mais direta possível: pinta a lambida com uma âncora de
   * boca CONHECIDA, acha o centro dos pixels que ela pintou, e mede a distância
   * até a âncora. Se o desenho voltar a ignorar a boca, essa distância explode —
   * é o mesmo raciocínio das outras abas, que pintam a peça e contam pixels.
   */
  useEffect(() => {
    const w = 256
    const h = 216
    const boca = { x: w * 0.32, y: h * 0.44 }
    const alcance = h * 0.3
    // Vários instantes ao longo de uma batida: a língua sai e volta, e um
    // instante só poderia cair justamente no meio em que ela está recolhida.
    let melhor = null
    let comLingua = 0
    for (let k = 0; k < 12; k++) {
      const t = k * 55
      const canvas = document.createElement('canvas')
      const painter = new Painter(canvas)
      painter.resize(w, h)
      painter.clear()
      desenharLambida(painter, { forca: 1, t, boca, alcance, virado: 1 })
      const data = painter.ctx.getImageData(0, 0, w, h).data
      let n = 0
      let sx = 0
      let sy = 0
      let rosa = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue
        const px = (i / 4) % w
        const py = Math.floor(i / 4 / w)
        n++
        sx += px
        sy += py
        // a língua é rosa forte; o rastro é branco quase transparente
        if (data[i] > 180 && data[i + 1] < 140 && data[i + 3] > 120) rosa++
      }
      if (!n) continue
      if (rosa > 30) comLingua++
      const cx = sx / n
      const cy = sy / n
      const dist = Math.hypot(cx - boca.x, cy - boca.y)
      if (!melhor || dist < melhor.dist) melhor = { dist, cx: +cx.toFixed(0), cy: +cy.toFixed(0), n }
    }
    setLambida({
      ...(melhor || { dist: 9999, cx: 0, cy: 0, n: 0 }),
      comLingua,
      boca,
      // O rastro tem que ficar DENTRO do alcance da língua. Mais longe que isso
      // e ele não é rastro daquela lambida — é borrão em outro lugar da tela.
      limite: alcance * 1.1,
    })
  }, [])

  useEffect(() => {
    // Três minutos de vida do bicho, a 60 quadros por segundo. Dá pra sortear
    // muitos estados — inclusive os de chegar no vidro e voltar, que eram
    // justamente onde o degrau acontecia.
    const QUADROS = 60 * 180
    const w = 360
    const h = 300
    const palco = criarPalco({})
    let t = 0
    let anterior = null
    let saltoEscala = 0
    let saltoChao = 0
    let quandoSaltou = 0
    let zMin = 1
    let zMax = 0
    let andando = 0
    let lambeu = 0
    for (let i = 0; i < QUADROS; i++) {
      t += 1000 / 60
      const pos = palco.passo(t, 1000 / 60)
      const enq = enquadrar(pos, { w, h, escalaBase: 40 })
      if (anterior) {
        const de = Math.abs(enq.escala - anterior.escala) / anterior.escala
        const dc = Math.abs(enq.chao - anterior.chao) / h
        if (de > saltoEscala) {
          saltoEscala = de
          quandoSaltou = t
        }
        if (dc > saltoChao) saltoChao = dc
      }
      anterior = enq
      zMin = Math.min(zMin, pos.z)
      zMax = Math.max(zMax, pos.z)
      if (pos.acao === 'andar' || pos.acao === 'correr') andando++
      if (pos.lambida > 0.5) lambeu++
    }
    setR({
      saltoEscala: +(saltoEscala * 100).toFixed(3),
      saltoChao: +(saltoChao * 100).toFixed(3),
      quandoSaltou: +(quandoSaltou / 1000).toFixed(1),
      zMin: +zMin.toFixed(2),
      zMax: +zMax.toFixed(2),
      andando: Math.round((andando / QUADROS) * 100),
      lambeu: +(lambeu / 60).toFixed(1),
    })
  }, [])

  if (!r) return <p className="muted small">Simulando o passeio…</p>

  // O limite de 1,5% por quadro: ver o comentário grande acima.
  const LIMITE = 1.5
  const passou = r.saltoEscala <= LIMITE
  return (
    <>
      <p className="muted small">
        Três minutos de palco simulados sem desenhar nada. O que importa é o
        maior salto de um quadro pro seguinte: bicho que anda cresce devagar,
        bicho com defeito dá degrau.
      </p>
      {passou ? (
        <p className="notice ok">
          Sem degrau: o maior salto de tamanho entre dois quadros foi{' '}
          <strong>{r.saltoEscala}%</strong> (o limite é {LIMITE}%).
        </p>
      ) : (
        <p className="notice error">
          Degrau no tamanho: <strong>{r.saltoEscala}%</strong> num quadro só, aos{' '}
          {r.quandoSaltou}s. Acima de {LIMITE}% isso se vê como um pulo, não como
          uma aproximação.
        </p>
      )}
      {lambida && (
        lambida.dist <= lambida.limite && lambida.comLingua > 0 ? (
          <p className="notice ok">
            A lambida sai da boca: o desenho ficou a{' '}
            <strong>{Math.round(lambida.dist)} px</strong> da âncora (o limite é{' '}
            {Math.round(lambida.limite)} px), e a língua apareceu em{' '}
            {lambida.comLingua} de 12 instantes.
          </p>
        ) : (
          <p className="notice error">
            A lambida ignorou a boca: o desenho saiu a {Math.round(lambida.dist)} px
            da âncora (limite {Math.round(lambida.limite)} px), língua vista em{' '}
            {lambida.comLingua} de 12 instantes. É o defeito da língua nascendo no
            rodapé da tela.
          </p>
        )
      )}
      <div className="lab-grid">
        <div className="lab-tile">
          <strong>{r.saltoEscala}%</strong>
          <span className="lab-tile-label">maior salto de tamanho num quadro</span>
        </div>
        <div className="lab-tile">
          <strong>{r.saltoChao}%</strong>
          <span className="lab-tile-label">maior salto do chão num quadro</span>
        </div>
        <div className="lab-tile">
          <strong>
            {r.zMin} – {r.zMax}
          </strong>
          <span className="lab-tile-label">
            profundidade visitada (perto de 1 é encostar no vidro)
          </span>
        </div>
        <div className="lab-tile">
          <strong>{r.andando}%</strong>
          <span className="lab-tile-label">do tempo andando ou correndo</span>
        </div>
        <div className="lab-tile">
          <strong>{r.lambeu}s</strong>
          <span className="lab-tile-label">lambendo o vidro, em 3 min</span>
        </div>
      </div>
    </>
  )
}

/**
 * A arte da batalha naval: o mar e os navios.
 *
 * Mesma regra das outras abas — peça que não desenha nada aparece MARCADA em
 * vermelho. Aqui isso importa mais que o normal por um motivo específico: estes
 * desenhos viram `data:` URL e entram pelo CSS como imagem de fundo. Quando um
 * `background-image` aponta pra uma imagem vazia, o navegador não reclama de
 * nada: a casa simplesmente fica sem fundo, e "sem fundo" é indistinguível de
 * "ainda não implementei". Um navio que não desenhou seria um navio invisível
 * no seu próprio tabuleiro.
 *
 * Duas conferências além de "pintou alguma coisa":
 *
 *  - **a proporção**, que é o que faz o navio encaixar na grade. Um navio de 3
 *    casas TEM que sair com 3× mais largura que altura; se essa conta escorregar,
 *    ele fica torto em cima das casas e não há CSS que conserte;
 *  - **a emenda do ladrilho do mar**, que se repete. Uma onda que termina no
 *    meio da borda direita reaparece cortada na esquerda e vira uma listra
 *    visível atravessando o tabuleiro inteiro. Aqui a coluna da esquerda é
 *    comparada com a da direita (e o topo com a base): quanto mais parecidas,
 *    mais invisível a emenda.
 */
function AbaNaval() {
  const [r, setR] = useState(null)

  useEffect(() => {
    const medir = (url) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = img.width
          c.height = img.height
          const ctx = c.getContext('2d')
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(img, 0, 0)
          const d = ctx.getImageData(0, 0, c.width, c.height).data
          let pintados = 0
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) pintados++
          resolve({ w: img.width, h: img.height, pintados, d, url })
        }
        img.onerror = () => resolve({ w: 0, h: 0, pintados: 0, d: null, url })
        img.src = url
      })

    Promise.all([
      medir(ladrilhoDoMar(48)),
      ...[2, 3, 4].map((n) => medir(navio(n))),
      ...[2, 3, 4].map((n) => medir(navioEmPe(n))),
    ]).then(([mar, h2, h3, h4, v2, v3, v4]) => {
      // A emenda: diferença média de cor entre a primeira e a última coluna, e
      // entre a primeira e a última linha. 0 seria emenda perfeita.
      let emenda = 999
      if (mar.d) {
        const { w, h, d } = mar
        const px = (x, y) => {
          const i = (y * w + x) * 4
          return [d[i], d[i + 1], d[i + 2]]
        }
        let soma = 0
        let n = 0
        for (let y = 0; y < h; y++) {
          const a = px(0, y)
          const b = px(w - 1, y)
          soma += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
          n++
        }
        for (let x = 0; x < w; x++) {
          const a = px(x, 0)
          const b = px(x, h - 1)
          soma += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
          n++
        }
        emenda = +(soma / n).toFixed(1)
      }
      const navios = [
        { nome: 'deitado 2', casas: 2, m: h2, deitado: true },
        { nome: 'deitado 3', casas: 3, m: h3, deitado: true },
        { nome: 'deitado 4', casas: 4, m: h4, deitado: true },
        { nome: 'em pé 2', casas: 2, m: v2, deitado: false },
        { nome: 'em pé 3', casas: 3, m: v3, deitado: false },
        { nome: 'em pé 4', casas: 4, m: v4, deitado: false },
      ].map((n) => {
        const razao = n.deitado ? n.m.w / Math.max(1, n.m.h) : n.m.h / Math.max(1, n.m.w)
        return { ...n, razao: +razao.toFixed(2), ok: Math.abs(razao - n.casas) < 0.02 && n.m.pintados > 0 }
      })
      setR({ mar, emenda, navios })
    })
  }, [])

  if (!r) return <p className="muted small">Desenhando o mar e a frota…</p>

  const vazios = [
    ...(r.mar.pintados === 0 ? ['o mar'] : []),
    ...r.navios.filter((n) => n.m.pintados === 0).map((n) => n.nome),
  ]
  const tortos = r.navios.filter((n) => n.m.pintados > 0 && !n.ok)
  // 18 é folga: o ladrilho tem faixas de profundidade, então as bordas nunca
  // são idênticas — o que não pode é haver um degrau de cor entre elas.
  const emendaOk = r.emenda <= 18

  return (
    <>
      <p className="muted small">
        O mar e os navios da batalha naval, desenhados pelo mesmo motor de pixel
        do resto do app. O que se confere aqui é o que o CSS não teria como
        acusar: desenho vazio, proporção errada e a emenda do ladrilho.
      </p>
      {vazios.length > 0 && (
        <p className="notice error">Não desenhou nada: {vazios.join(', ')}</p>
      )}
      {tortos.length > 0 && (
        <p className="notice error">
          Proporção errada (não encaixa na grade):{' '}
          {tortos.map((n) => `${n.nome} saiu ${n.razao}× em vez de ${n.casas}×`).join(' · ')}
        </p>
      )}
      {emendaOk ? (
        <p className="notice ok">
          A emenda do mar é invisível: diferença de <strong>{r.emenda}</strong> entre
          as bordas opostas (o limite é 18).
        </p>
      ) : (
        <p className="notice error">
          O ladrilho do mar não fecha: diferença de {r.emenda} entre as bordas.
          Isso vira uma listra atravessando o tabuleiro.
        </p>
      )}
      <div className="lab-grid">
        <div className="lab-tile">
          <img
            src={r.mar.url}
            alt="mar"
            style={{ width: 96, height: 96, imageRendering: 'pixelated' }}
          />
          <span className="lab-tile-label">
            mar 1× · {r.mar.pintados} px
          </span>
        </div>
        <div className="lab-tile">
          <div
            style={{
              width: 96,
              height: 96,
              backgroundImage: `url(${r.mar.url})`,
              backgroundSize: '48px 48px',
              imageRendering: 'pixelated',
            }}
          />
          <span className="lab-tile-label">repetido 2×2 (olhe a emenda)</span>
        </div>
        {r.navios.map((n) => (
          <div className="lab-tile" key={n.nome}>
            <img
              src={n.m.url}
              alt={n.nome}
              style={{
                width: n.deitado ? 120 : 40,
                height: n.deitado ? 40 : 120,
                imageRendering: 'pixelated',
              }}
            />
            <span className="lab-tile-label">
              {n.nome} · {n.razao}× · {n.m.pintados} px
            </span>
          </div>
        ))}
      </div>
      <AbaNavalEncaixe />
    </>
  )
}

/**
 * O ENCAIXE do navio na casa — e não mais só o desenho dele.
 *
 * Esta é a conferência que faltava, e a falta dela custou caro: a arte dos
 * navios estava certa (proporção exata, emenda invisível — é o que as medidas
 * acima já diziam) e mesmo assim, no iPhone do dono, os navios saíam gigantes,
 * atravessando o tabuleiro por cima dos botões. O defeito nunca esteve no
 * desenho: estava em ONDE o desenho era colocado.
 *
 * É a mesma lição da 9.10 ("a bancada conferia a arte que o app não usa"): aqui
 * quem é montado é o `Tabuleiro` DE VERDADE, o mesmo componente que a tela do
 * jogo usa, com o CSS de verdade. O que se mede é uma pergunta só, e ela não
 * depende de olhar:
 *
 *   a caixa do navio bate com a união das casas que ele ocupa?
 *
 * Se bater, ele está encaixado, seja qual for o navegador. Se não bater, esta
 * aba fica vermelha e diz de quantos pixels foi o desvio — inclusive se alguém
 * abrir o `/lab` no próprio iPhone, que é onde o defeito aparecia.
 *
 * As duas variantes entram porque elas têm medidas diferentes (o tabuleiro
 * grande tem vão de 3px e margem de 5px; o minimapa, 1px e 3px), e já houve
 * defeito que acertava numa e errava na outra.
 */
const FROTA_LAB = [
  { tamanho: 4, atingidas: [], casas: [[0, 1], [0, 2], [0, 3], [0, 4]] },
  { tamanho: 3, atingidas: [[2, 6]], casas: [[2, 6], [3, 6], [4, 6]] },
  { tamanho: 3, atingidas: [], casas: [[5, 0], [5, 1], [5, 2]] },
  { tamanho: 2, atingidas: [[7, 4], [7, 5]], casas: [[7, 4], [7, 5]] },
]

function AbaNavalEncaixe() {
  const caixa = useRef(null)
  const [medida, setMedida] = useState(null)

  useEffect(() => {
    let vivo = true
    // Dois quadros: o primeiro fecha o layout, o segundo garante que as fontes
    // e o `background-size` já entraram. Medir cedo demais devolve zero e um
    // zero desses viraria um verde falso.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!vivo || !caixa.current) return
        const linhas = []
        for (const grade of caixa.current.querySelectorAll('.naval-grade')) {
          const lado = +getComputedStyle(grade).getPropertyValue('--lado')
          const casas = [...grade.querySelectorAll('.naval-casa')]
          const g = grade.getBoundingClientRect()
          const c0 = casas[0].getBoundingClientRect()
          let pior = 0
          for (const n of grade.querySelectorAll('.naval-navio')) {
            const st = getComputedStyle(n)
            const mc = st.gridColumn.match(/(\d+)\s*\/\s*span\s*(\d+)/)
            const mr = st.gridRow.match(/(\d+)\s*\/\s*span\s*(\d+)/)
            if (!mc || !mr) { pior = 999; break }
            const col = +mc[1] - 1
            const nc = +mc[2]
            const lin = +mr[1] - 1
            const nl = +mr[2]
            const primeira = casas[lin * lado + col].getBoundingClientRect()
            const ultima = casas[(lin + nl - 1) * lado + (col + nc - 1)].getBoundingClientRect()
            const b = n.getBoundingClientRect()
            pior = Math.max(
              pior,
              Math.abs(b.x - primeira.x),
              Math.abs(b.y - primeira.y),
              Math.abs(b.right - ultima.right),
              Math.abs(b.bottom - ultima.bottom),
            )
          }
          linhas.push({
            nome: grade.closest('.naval-mini') ? 'minimapa' : 'tabuleiro grande',
            lado: `${g.width.toFixed(0)}×${g.height.toFixed(0)}`,
            // O tabuleiro tem que ser quadrado: quando ele não é, as linhas
            // dividem uma altura diferente da largura que as colunas dividem, e
            // o navio (que ocupa a LINHA) fica mais alto que a casa que marca.
            fora: +Math.abs(g.width - g.height).toFixed(2),
            casa: `${c0.width.toFixed(1)}×${c0.height.toFixed(1)}`,
            casaFora: +Math.abs(c0.width - c0.height).toFixed(2),
            pior: +pior.toFixed(2),
          })
        }
        setMedida(linhas)
      }),
    )
    return () => { vivo = false; cancelAnimationFrame(id) }
  }, [])

  // 1px de folga é arredondamento de subpixel; acima disso o navio começa a
  // cobrir uma casa que não é dele, e é isso que se enxerga na tela.
  const ruins = (medida || []).filter((m) => m.pior > 1 || m.fora > 1 || m.casaFora > 1)

  return (
    <>
      <h2>O navio encaixa na casa?</h2>
      <p className="muted small">
        Aqui não é a arte, é o ENCAIXE: o <code>Tabuleiro</code> de verdade, com o
        CSS de verdade, e a pergunta é se a caixa de cada navio bate com a união
        das casas que ele ocupa. Foi este defeito que deixou a naval impossível
        de jogar no iPhone, com a arte passando em tudo aqui em cima.
      </p>
      {medida && (ruins.length > 0 ? (
        <p className="notice error">
          {ruins.map((m) => (
            `${m.nome}: navio fora da casa por ${m.pior}px`
            + (m.fora > 1 ? `, tabuleiro ${m.lado} (não é quadrado)` : '')
            + (m.casaFora > 1 ? `, casa ${m.casa} (não é quadrada)` : '')
          )).join(' · ')}
        </p>
      ) : (
        <p className="notice ok">
          Encaixe exato nas duas variantes:{' '}
          {medida.map((m) => `${m.nome} ${m.lado}, casa ${m.casa}, desvio ${m.pior}px`).join(' · ')}
        </p>
      ))}
      <div ref={caixa} className="naval" style={{ maxWidth: 380 }}>
        <Tabuleiro lado={8} marcas={{}} variante="mar" navios={FROTA_LAB} titulo="tabuleiro grande" />
        <div className="naval-rodape">
          <Tabuleiro lado={8} marcas={{}} variante="mini" navios={FROTA_LAB} />
          <span className="muted small">minimapa (vão e margem menores)</span>
        </div>
      </div>
    </>
  )
}

function Tile({ label, width, height, paint, animate = false }) {
  const ref = useRef(null)
  const [painted, setPainted] = useState(null)

  useEffect(() => {
    setPainted(countPainted(width, height, (p) => paint(p, 0)))
    const painter = new Painter(ref.current)
    painter.resize(width, height)
    let raf
    const pintar = (t) => {
      painter.clear()
      paint(painter, t)
    }
    const loop = (t) => {
      pintar(t)
      raf = requestAnimationFrame(loop)
    }

    // Um quadro NA HORA, antes de pedir animação — e isto vale também aqui.
    //
    // Esta era a última peça do app que ainda caía na armadilha já registrada no
    // HANDOFF: `requestAnimationFrame` não roda em aba que o navegador não está
    // compondo. O bloco animado só desenhava dentro do laço, então em aba de
    // segundo plano ele ficava com **zero pixel pintado** — e apareceu do jeito
    // mais irônico possível: conferindo os 132 blocos de animação novos, os 132
    // leram vazio na tela enquanto a marca de "⚠ vazio" dizia que estava tudo
    // certo (ela conta num canvas de rascunho, que é pintado de forma síncrona).
    // Ou seja: a bancada estava aprovando arte que ninguém veria.
    pintar(0)
    if (animate) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [label, width, height, animate])

  const empty = painted !== null && painted < MIN_PIXELS
  return (
    <div className={`lab-tile ${empty ? 'lab-empty' : ''}`}>
      <canvas ref={ref} className="pixel-canvas" style={{ width, height }} />
      <div className="tiny muted center">
        {label}
        {empty ? ' ⚠ vazio' : ''}
      </div>
    </div>
  )
}

const BASE_AVATAR = {
  skin: '#eec1a2', hair_style: 'curto', hair_color: '#2b1b12',
  eyes: 'redondo', eye_color: '#3b2a20', mouth: 'sorriso', brows: 'reta',
  top: 'camiseta', top_color: '#5b8def', bottom: 'jeans', bottom_color: '#3c5a99',
  shoes: 'tenis', shoes_color: '#f0f0f0', head: '', extra: '', blush: false,
}

/** O que está enterrado dentro de quê — ver `furnitureAudit.js`. */
function AuditoriaMoveis() {
  const achados = auditarTudo(
    Object.fromEntries(Object.entries(SIZES).map(([k, [w, d]]) => [k, { w, d }]))
  )
  if (!achados.length) {
    return <p className="notice">Nenhuma peça enterrada dentro de outra.</p>
  }
  return (
    <div className="notice error" style={{ marginBottom: 12 }}>
      <strong>Peças enterradas uma na outra:</strong>
      <ul className="tiny" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {achados.map((x) => (
          <li key={x.nome}>
            {x.nome}: {x.achados.map((a) => `bloco ${a.a}+${a.b} (${Math.round(a.parte * 100)}%)`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ShapeLab() {
  const [dir, setDir] = useState(0)
  const [aba, setAba] = useState('moveis')

  const abas = [
    { key: 'moveis', name: `Móveis (${Object.keys(SHAPES).length})` },
    { key: 'avatar', name: 'Avatar' },
    { key: 'bichinhos', name: `Bichinhos (${LAB_SPECIES.length * LAB_STAGES.length})` },
    { key: 'humores', name: `Humores (${LAB_MOODS.length * 2})` },
    { key: 'animacoes', name: `Animações (${LAB_SPECIES.length * NOMES_CLIPES.length})` },
    { key: 'crescimento', name: `Crescimento (${LAB_SPECIES.length * LAB_CRESCIMENTO.length})` },
    { key: 'vestidos', name: `Vestidos (${LAB_SPECIES.length * LAB_ACESSORIOS.length})` },
    { key: 'escala', name: `Escala grande (${LAB_SPECIES.length})` },
    { key: 'vozes', name: `Vozes (${Object.keys(VOZES).length})` },
    { key: 'passeio', name: 'Passeio' },
    { key: 'naval', name: 'Naval' },
    { key: 'itens', name: `Itens (${PET_ICON_CODES.length})` },
    { key: 'figurinhas', name: `Figurinhas (${STICKER_CODES.length})` },
    { key: 'cores', name: 'Acabamentos' },
  ]

  return (
    <>
      <h1 className="screen-title">Bancada</h1>
      <div className="shop-tabs">
        {abas.map((a) => (
          <button
            key={a.key}
            className={aba === a.key ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setAba(a.key)}
          >
            {a.name}
          </button>
        ))}
      </div>

      {aba === 'moveis' && (
        <>
          {/* AUDITORIA DE SOBREPOSIÇÃO.
              O dono viu "partes se sobrepondo" e ele estava certo — mas defeito
              de três centésimos de célula não se enxerga numa miniatura, e são
              30 móveis em 4 rotações. A máquina enxerga: cada peça é uma caixa,
              e duas caixas que se cruzam nos três eixos estão uma dentro da
              outra. Ver `furnitureAudit.js`. */}
          <AuditoriaMoveis />
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            {[0, 1, 2, 3].map((d) => (
              <button
                key={d}
                className={dir === d ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                onClick={() => setDir(d)}
              >
                {d * 90}°
              </button>
            ))}
          </div>
          <div className="lab-grid">
            {Object.keys(SHAPES).map((shape) => {
              const [w, d] = SIZES[shape] || [1, 1]
              const cols = Math.max(w, d) + 2
              const metrics = roomMetrics(cols, cols, 2)
              return (
                <Tile
                  key={shape}
                  label={`${shape} · ${dir * 90}°`}
                  width={metrics.width}
                  height={metrics.height}
                  animate
                  paint={(p, t) =>
                    drawScene(
                      p,
                      {
                        cols,
                        rows: cols,
                        floor: 'ceramica',
                        wall: 'padrao',
                        // A PEGADA GIRA JUNTO — e é isto que faltava aqui.
                        //
                        // Na casa, girar um móvel troca `w` por `d` (ver
                        // `rotateSelected` em `House.jsx`): um sofá 2x1 vira
                        // 1x2. A bancada girava só o `dir` e deixava a pegada
                        // como estava, então `tools` calculava W e D ao
                        // contrário e a peça se desenhava com as proporções
                        // trocadas. Resultado: a bancada mostrava "bugado ao
                        // girar" em móveis que na casa estavam certos — e
                        // escondia os que estavam errados de verdade.
                        //
                        // Uma bancada que mede diferente do que roda é pior do
                        // que não ter bancada: manda procurar defeito onde não
                        // há. Mesmo erro que a rota de teste do áudio evita ao
                        // validar pelo caminho real.
                        items: [{
                          id: 1,
                          shape,
                          col: 1,
                          row: 1,
                          w: dir % 2 ? d : w,
                          d: dir % 2 ? w : d,
                          dir,
                        }],
                      },
                      {},
                      t
                    )
                  }
                />
              )
            })}
          </div>
        </>
      )}

      {aba === 'avatar' && (
        <>
          {Object.entries(STYLE_LISTS).map(([slot, styles]) => (
            <div key={slot}>
              <p className="group-title">{slot}</p>
              <div className="lab-grid">
                {styles.map((style) => {
                  const field =
                    slot === 'hair'
                      ? 'hair_style'
                      : slot === 'eyes' || slot === 'mouth' || slot === 'brows'
                        ? slot
                        : slot
                  return (
                    <Tile
                      key={`${slot}-${style}`}
                      label={style}
                      width={AVATAR_W + 8}
                      height={AVATAR_H + 8}
                      paint={(p) => drawAvatar(p, { ...BASE_AVATAR, [field]: style }, 4, 4)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'bichinhos' && (
        <div className="lab-grid">
          {LAB_SPECIES.flatMap(([code, colors]) =>
            LAB_STAGES.map((stage) => (
              <Tile
                key={`${code}-${stage}`}
                label={`${code} · ${stage}`}
                width={128}
                height={108}
                paint={(p, t) =>
                  drawPet(
                    p,
                    { species: code, colors, stage, mood: 'feliz', accessories: {}, mess_count: 0 },
                    t
                  )
                }
              />
            ))
          )}
        </div>
      )}

      {aba === 'humores' && (
        <div className="lab-grid">
          {LAB_MOODS.map((mood) => (
            <Tile
              key={mood}
              label={`gato · ${mood}`}
              width={128}
              height={108}
              paint={(p, t) =>
                drawPet(
                  p,
                  {
                    species: 'gato',
                    colors: ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2'],
                    stage: 'jovem',
                    mood,
                    sick: mood === 'doente',
                    accessories: {},
                    mess_count: 0,
                  },
                  t
                )
              }
            />
          ))}
          {[['pet_coleira', 'neck'], ['pet_gravata', 'neck'], ['pet_chapeu', 'head'], ['pet_oculos_pet', 'head']].map(
            ([item, slot]) => (
              <Tile
                key={item}
                label={`gato · ${item.replace('pet_', '')}`}
                width={128}
                height={108}
                paint={(p, t) =>
                  drawPet(
                    p,
                    {
                      species: 'gato',
                      colors: ['#f2a03d', '#8d8d97', '#3a3340', '#f0ebe2'],
                      stage: 'jovem',
                      mood: 'feliz',
                      accessories: { [slot]: item },
                      mess_count: 0,
                    },
                    t
                  )
                }
              />
            )
          )}
        </div>
      )}

      {/* Toda especie em TODA acao.
          Esta e a aba que faltava: o motor novo tem clipe por acao, e clipe que
          nao desenha nada (ou que joga o bichinho pra fora da caixa de 128x108)
          nao da erro nenhum — some calado, exatamente como sumiram os icones
          `drop`/`sparkle`/`lock` na revisao anterior. Aqui cada combinacao e
          pintada e CONTADA. */}
      {aba === 'animacoes' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {NOMES_CLIPES.map((clipe) => {
                  // O clipe pedido nem sempre e o clipe rodado: coelho nao anda
                  // (saltita) e capivara nao voa (pula). A bancada mostra os dois
                  // nomes pra essa traducao ficar visivel, e nao escondida.
                  const real = clipeDe(clipe, planoDe(code, 1))
                  return (
                    <Tile
                      key={`${code}-${clipe}`}
                      label={real === clipe ? clipe : `${clipe} → ${real}`}
                      width={128}
                      height={108}
                      animate
                      paint={(p, t) =>
                        drawPet(
                          p,
                          {
                            species: code, colors, growth: 1, mood: 'feliz',
                            accessories: {}, mess_count: 0, action: clipe,
                          },
                          t
                        )
                      }
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* O crescimento, lado a lado. Filhote e adulto tem que ser a MESMA especie
          com outra proporcao — se saissem iguais, so menor, a evolucao seria zoom. */}
      {aba === 'crescimento' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {LAB_CRESCIMENTO.map((g) => (
                  <Tile
                    key={`${code}-${g}`}
                    label={`${code} · ${Math.round(g * 100)}%`}
                    width={128}
                    height={108}
                    paint={(p, t) =>
                      drawPet(
                        p,
                        {
                          species: code, colors, growth: g, mood: 'feliz',
                          accessories: {}, mess_count: 0, action: 'parado',
                        },
                        t
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'vestidos' && (
        <>
          {LAB_SPECIES.map(([code, colors]) => (
            <div key={code}>
              <p className="card-title">{code}</p>
              <div className="lab-grid">
                {LAB_ACESSORIOS.map(([item, slot, acao]) => (
                  <Tile
                    key={`${code}-${item}-${acao}`}
                    label={`${item.replace('pet_', '')} · ${acao}`}
                    width={128}
                    height={108}
                    animate
                    paint={(p, t) =>
                      drawPet(
                        p,
                        {
                          species: code, colors, growth: 1, mood: 'feliz',
                          accessories: { [slot]: item }, mess_count: 0, action: acao,
                        },
                        t
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'escala' && (
        <>
          {/* A ABA QUE FALTAVA, e a falta dela custou caro.

              Todo o resto da bancada desenha na caixa de referencia (128x108,
              escala 1). Quando a tela do bichinho passou a desenhar GRANDE, a
              bancada continuou aprovando tudo — porque uma pilha de defeitos so
              existe quando a escala e diferente de 1: medida escrita em pixel
              cru que nao acompanha, contorno que vira fio, e principalmente a
              escala que era aplicada duas vezes nas poses (1x1 continua 1, e por
              isso ninguem via).

              Aqui cada especie e desenhada no MESMO tamanho em que ela aparece
              na tela do bichinho. E aqui que se olha depois de mexer no rig. */}
          <p className="muted small">
            Cada bicho no tamanho em que ele aparece na tela dele. Defeito de
            escala só existe fora do 1× — é nesta aba que ele aparece.
          </p>
          <div className="lab-grid lab-grid-grande">
            {LAB_SPECIES.map(([code, colors]) => {
              // O MESMO bicho, medido nas duas escalas. Ele tem que ocupar a
              // mesma fracao do quadro nas duas — se nao ocupa, alguma medida
              // ficou presa em pixel e nao acompanhou.
              // A medida e feita ANDANDO, e no meio do passo.
              //
              // Em `parado` os pes ficam quase no lugar, e era justamente nos
              // deslocamentos de pose que estava a escala aplicada duas vezes —
              // medir parado deixaria o defeito passar de novo. Andar poe perna,
              // corpo e cabeca todos fora da posicao neutra, que e onde o erro
              // aparece.
              const pintar = (escalaDe) => (p) => {
                const pet = { species: code, colors, stage: 'adulto', growth: 1,
                  mood: 'feliz', accessories: {}, mess_count: 0, action: 'andar' }
                const m = planoDe(code, 1, 1)
                const aU = m.pernaA + m.corpoA * 1.15
                  + m.cabecaA * (m.orelha === 'longa' ? 2.15 : 1.5)
                const lU = m.corpoL + m.caudaL * 0.8 + m.cabecaL
                const esc = escalaDe(p)
                drawPet(p, pet, 700, esc, { cx: p.w / 2, chao: p.h * 0.84 })
              }
              const ajustar = (p) => {
                const m = planoDe(code, 1, 1)
                const aU = m.pernaA + m.corpoA * 1.15
                  + m.cabecaA * (m.orelha === 'longa' ? 2.15 : 1.5)
                const lU = m.corpoL + m.caudaL * 0.8 + m.cabecaL
                return Math.min((p.h * 0.74) / aU, (p.w * 0.92) / lU)
              }
              const pequeno = caixaPintada(128, 108, pintar(ajustar))
              const medio = caixaPintada(256, 216, pintar(ajustar))
              const grande = caixaPintada(384, 324, pintar(ajustar))
              const fmt = (b) => b ? `${(b.larg*100).toFixed(1)}x${(b.alt*100).toFixed(1)}` : '-'
              const detalhe = `1x ${fmt(pequeno)} | 2x ${fmt(medio)} | 3x ${fmt(grande)}`
              // A conferencia e entre 2x e 3x, e o 1x fica so pra olhar.
              //
              // Nao e o teste sendo afrouxado pra passar: e que abaixo de ~2x a
              // arte PERDE detalhe de verdade, e isso e uma decisao antiga do
              // projeto (HANDOFF 9.5: abaixo de 0,8 de escala a miudeza nao e
              // desenhada). Uma cauda que afina ate meio pixel simplesmente nao
              // cabe num quadro de 128, e a largura medida cai — foi exatamente
              // o que apareceu aqui: a ALTURA bate nas tres escalas e so a
              // largura encolhe no 1x, que e a assinatura de ponta fina sumindo,
              // e nao de medida presa em pixel (essa mexeria nas duas).
              //
              // Entre 2x e 3x nao ha essa perda, entao qualquer diferenca ali e
              // defeito de escala de verdade — que e o que esta linha guarda.
              const desvio = medio && grande
                ? Math.max(
                  Math.abs(medio.larg - grande.larg) / medio.larg,
                  Math.abs(medio.alt - grande.alt) / medio.alt,
                )
                : 1
              // 8% de folga: o arredondamento pra pixel inteiro sozinho ja mexe
              // um pouco na borda, e cobrar exatidao daria alarme falso.
              const torto = desvio > 0.08
              return (
              <div key={`escala-${code}`} className={torto ? 'lab-fora-de-escala' : undefined}>
              {torto && (
                <p className="notice error">
                  {code}: ocupa {(medio ? medio.larg * 100 : 0).toFixed(0)}% do quadro em 2×
                  e {(grande ? grande.larg * 100 : 0).toFixed(0)}% em 3× — alguma medida não
                  está acompanhando a escala.
                </p>
              )}
              <Tile
                label={`${code} · ${detalhe} · desvio 2→3 ${(desvio * 100).toFixed(1)}%`}
                width={384}
                height={324}
                animate
                paint={(p, t) => {
                  const pet = { species: code, colors, stage: 'adulto', growth: 1,
                    mood: 'feliz', accessories: { neck: 'pet_coleira' }, mess_count: 0 }
                  const medida = planoDe(code, 1, 1)
                  const alturaU = medida.pernaA + medida.corpoA * 1.15
                    + medida.cabecaA * (medida.orelha === 'longa' ? 2.6 : 1.55)
                  const larguraU = medida.corpoL + medida.caudaL * 0.8 + medida.cabecaL
                  const escala = Math.min((p.h * 0.74) / alturaU, (p.w * 0.92) / larguraU)
                  drawPet(p, pet, t, escala, { cx: p.w / 2, chao: p.h * 0.84 })
                }}
              />
              </div>
              )
            })}
          </div>
        </>
      )}

      {aba === 'vozes' && <AbaVozes />}
      {aba === 'passeio' && <AbaPasseio />}
      {aba === 'naval' && <AbaNaval />}

      {aba === 'itens' && (
        <div className="lab-grid">
          {PET_ICON_CODES.map((code) => (
            <Tile
              key={code}
              label={code.replace('pet_', '')}
              width={32}
              height={32}
              paint={(p) => drawPetIcon(p, code, '')}
            />
          ))}
        </div>
      )}

      {aba === 'figurinhas' && (
        <>
          {/* Figurinha sem nome aparece como problema, do mesmo jeito que
              figurinha que nao desenha: no seletor ela viraria um bonequinho
              sem legenda, e o dono pediu a lista COM nome. */}
          {STICKER_CODES.some((c) => !STICKER_LABEL[c]) && (
            <p className="notice error">
              Sem nome: {STICKER_CODES.filter((c) => !STICKER_LABEL[c]).join(', ')}
            </p>
          )}
        {/* A bancada mostra a figurinha COMO O CHAT MOSTRA.

            Antes ela desenhava todas em pixel, chamando `drawSticker` direto.
            Isso conferia um desenho que o app nao usa mais: `Sticker` prefere a
            versao redonda (SVG) e so cai no pixel quando a redonda nao existe.
            Ou seja, a unica arte que a bancada olhava era justamente a que o
            chat NAO mostra — e um erro na versao redonda (que foi o que
            aconteceu: um componente com o nome errado derrubando o app inteiro)
            passava aqui como se estivesse tudo certo. */}
        <div className="lab-grid">
          {STICKER_CODES.map((code) => (
            <div key={code} className="lab-tile">
              <Sticker code={code} scale={2} />
              <span className="lab-tile-label">
                {STICKER_LABEL[code] || `${code} ⚠ sem nome`}
                {!STICKERS_HD[code] && ' ⚠ ainda em pixel'}
              </span>
            </div>
          ))}
        </div>
        </>
      )}

      {aba === 'cores' && (
        <div className="card">
          <p className="card-title">Pisos e paredes</p>
          <div className="row wrap" style={{ gap: 12 }}>
            {[
              ...Object.entries(FLOOR_STYLES).map(([k, v]) => ['piso ' + k, v.base]),
              ...Object.entries(WALL_STYLES).map(([k, v]) => ['parede ' + k, v.base]),
            ].map(([name, color]) => (
              <div key={name} className="tiny center">
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: color,
                    border: '2px solid var(--ink)',
                    borderRadius: 8,
                  }}
                />
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
