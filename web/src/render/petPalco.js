// O que o bichinho FAZ enquanto você olha pra ele.
//
// Antes ele ficava plantado no meio do palco fazendo a animação de "parado". A
// referência que o dono deu — Kinectimals — não é sobre desenho bonito: é sobre
// o filhote ter vida própria. Ele corre pela ilha, para, olha pra você, vira de
// lado, volta correndo, **chega perto da câmera e lambe o vidro**. É isso que
// faz parecer que tem um bicho ali e não uma figurinha animada.
//
// ------------------------------------------------------------------ o modelo
//
// Um cérebro pequeno de estados, com três números:
//
//   `x`  — onde ele está na largura do palco (0 a 1);
//   `z`  — a PROFUNDIDADE (0 = lá no fundo, perto do mar; 1 = colado no vidro).
//          É o `z` que dá o tamanho e a altura na tela: longe fica pequeno e
//          alto, perto fica grande e embaixo. Sem profundidade ele desliza num
//          plano e a cena vira um teatro de sombras;
//   `virado` — pra que lado ele está olhando (-1 / 1).
//
// Cada estado tem uma duração e uma tabela de para-onde-ir-depois. A soma disso
// é um bicho que nunca faz a mesma sequência duas vezes, sem nenhum roteiro
// escrito.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const sorte = (n) => Math.random() < n
const entre = (a, b) => a + Math.random() * (b - a)

// Os truques que ele sabe. São os mesmos verbos do Kinectimals (sentar, rolar,
// fingir de morto, implorar, girar) traduzidos pros clipes que o motor já tem —
// nenhum desenho novo, só sequência.
const TRUQUES = ['sentar', 'rolar', 'implorar', 'deitar', 'cocar', 'brincar']

/**
 * Cria o cérebro de um bichinho no palco.
 *
 * Ele não sabe desenhar nada: devolve números. Quem desenha é o `PetCanvas`.
 */
export function criarPalco({ correParaCamera = true } = {}) {
  const eu = {
    x: 0.5,
    z: 0.55,
    virado: 1,
    estado: 'parado',
    acao: 'parado',
    ate: 0,
    alvoX: 0.5,
    alvoZ: 0.55,
    // O quanto ele está "no vidro": 0 normal, 1 encostado na câmera.
    perto: 0,
    lambida: 0,
    chamado: false,
  }

  /** Escolhe o próximo estado. É aqui que mora a personalidade. */
  function decidir(agora) {
    // Chamado tem prioridade: se a pessoa tocou no cenário, ele VEM.
    if (eu.chamado && correParaCamera) {
      eu.chamado = false
      eu.estado = 'chegando'
      eu.acao = 'correr'
      eu.alvoX = entre(0.42, 0.58)
      eu.alvoZ = 1
      eu.ate = agora + 2600
      return
    }
    if (eu.estado === 'chegando') {
      // Chegou no vidro: lambe.
      eu.estado = 'lambendo'
      eu.acao = 'brincar'
      eu.lambida = 0
      eu.ate = agora + entre(1800, 2800)
      return
    }
    if (eu.estado === 'lambendo') {
      eu.estado = 'voltando'
      eu.acao = 'andar'
      eu.alvoX = entre(0.2, 0.8)
      eu.alvoZ = entre(0.35, 0.7)
      eu.ate = agora + 2600
      return
    }
    // Do resto, sorteia.
    const r = Math.random()
    if (correParaCamera && r < 0.16) {
      eu.estado = 'chegando'
      eu.acao = 'correr'
      eu.alvoX = entre(0.42, 0.58)
      eu.alvoZ = 1
      eu.ate = agora + 2600
    } else if (r < 0.42) {
      eu.estado = 'andando'
      eu.acao = sorte(0.3) ? 'correr' : 'andar'
      eu.alvoX = entre(0.1, 0.9)
      eu.alvoZ = entre(0.25, 0.85)
      eu.ate = agora + entre(2200, 4200)
    } else if (r < 0.62) {
      eu.estado = 'truque'
      eu.acao = TRUQUES[Math.floor(Math.random() * TRUQUES.length)]
      eu.ate = agora + entre(2200, 3600)
    } else {
      eu.estado = 'parado'
      eu.acao = 'parado'
      eu.ate = agora + entre(1600, 3200)
      // Parado, ele VIRA PRA VOCÊ de vez em quando — é o gesto que faz o bicho
      // parecer que sabe que você está aí.
      if (sorte(0.6)) eu.virado = sorte(0.5) ? 1 : -1
    }
  }

  return {
    /** A pessoa chamou (tocou no cenário longe dele): ele vem correndo. */
    chamar() {
      eu.chamado = true
      eu.ate = 0
    },
    /** Um passo do tempo. `dt` em milissegundos. */
    passo(agora, dt) {
      if (agora >= eu.ate) decidir(agora)

      const indoPraAlgumLugar = ['andando', 'chegando', 'voltando'].includes(eu.estado)
      if (indoPraAlgumLugar) {
        // Velocidade em fração de palco por segundo. Correr é o dobro.
        const vel = (eu.acao === 'correr' ? 0.42 : 0.20) * (dt / 1000)
        const dx = eu.alvoX - eu.x
        const dz = eu.alvoZ - eu.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.02) {
          // Chegou antes da hora: parte pro próximo.
          eu.ate = 0
        } else {
          eu.x = clamp(eu.x + (dx / dist) * vel, 0.04, 0.96)
          eu.z = clamp(eu.z + (dz / dist) * vel, 0.15, 1)
          // Vira pro lado pra onde anda — mas só se estiver andando de lado de
          // verdade. Vindo reto pra frente, ele continua encarando você, que é
          // o que um bicho faz ao vir na sua direção.
          if (Math.abs(dx) > Math.abs(dz) * 0.6) eu.virado = dx > 0 ? 1 : -1
        }
      }

      // `perto` sobe quando ele está colado no vidro. Não é o mesmo que `z`:
      // ele só "encosta" de verdade nos estados de chegar e lamber, senão
      // qualquer passeio pra frente daria zoom na cara dele.
      const querPerto = eu.estado === 'lambendo' ? 1 : eu.estado === 'chegando' ? eu.z : 0
      eu.perto += (querPerto - eu.perto) * Math.min(1, dt / 420)

      if (eu.estado === 'lambendo') {
        eu.lambida = Math.min(1, eu.lambida + dt / 500)
        eu.virado = 1
      } else {
        eu.lambida = Math.max(0, eu.lambida - dt / 400)
      }

      return {
        x: eu.x,
        z: eu.z,
        virado: eu.virado,
        acao: eu.acao,
        estado: eu.estado,
        perto: eu.perto,
        lambida: eu.lambida,
      }
    },
  }
}

/**
 * Traduz a posição do cérebro pro enquadramento do desenho.
 *
 * `chaoBase` é onde ele pisa quando está no meio da profundidade. Longe, o pé
 * sobe (mais perto do horizonte) e o bicho encolhe; perto, desce e cresce. É
 * essa variação junta — tamanho E altura — que lê como profundidade; mexer só
 * no tamanho parece um balão inflando.
 */
export function enquadrar(pos, { w, h, escalaBase }) {
  const perto = pos.perto
  // Longe = 0,62 do tamanho; no meio = 1; colado no vidro = 2,1.
  const porProfundidade = 0.62 + pos.z * 0.55
  const escala = escalaBase * porProfundidade * (1 + perto * 0.95)
  const chaoLonge = h * 0.62
  const chaoPerto = h * 0.90
  const chao = chaoLonge + (chaoPerto - chaoLonge) * pos.z + perto * h * 0.12
  return { cx: w * pos.x, chao, escala }
}
