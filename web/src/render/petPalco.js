// O que o bichinho FAZ enquanto você olha pra ele.
//
// A referência que o dono deu — Kinectimals — não é sobre desenho bonito: é
// sobre o filhote ter vida própria. Ele corre pela ilha, para, olha pra você,
// vira de lado, volta correndo, chega perto da câmera e lambe o vidro.
//
// ------------------------------------------------------ o que estava quebrado
//
// O dono viu e disse: "o movimento do animal pra frente e pra trás está
// completamente bugado". Estava, e a causa era de estrutura, não de número.
//
// **Duas variáveis descreviam a MESMA coisa** — a distância do bicho até a
// câmera. Havia `z` (a profundidade, 0 no fundo, 1 no vidro) e havia `perto`
// (0 normal, 1 encostado), e as duas entravam na conta do tamanho ao mesmo
// tempo: `escala = base × (0,62 + z×0,55) × (1 + perto×0,95)`. Duas fontes da
// verdade pro mesmo fato sempre acabam discordando, e aqui elas discordavam de
// um jeito bem visível:
//
//   - `perto` era ligado por ESTADO e não por posição. Ao entrar em "chegando",
//     ele passava a valer o `z` da hora — que já era 0,55 no meio do palco.
//     Resultado: o bicho DAVA UM SALTO de tamanho (de 1× pra 1,5×) parado no
//     lugar, antes de dar o primeiro passo. Era o "pra frente" bugado;
//   - ao sair de "lambendo" pra "voltando", `perto` caía de 1 pra 0 de uma vez
//     com o bicho ainda colado no vidro: ele DESPENCAVA de tamanho sem ter
//     andado. Era o "pra trás";
//   - e nos dois casos a suavização de 420 ms transformava o salto num zoom
//     rápido, que é pior do que o salto: parece a câmera pulando, não o bicho
//     andando.
//
// **O conserto é apagar `perto`.** A distância até a câmera é `z`, e só. Quando
// ele vem lamber, ele ANDA até `z = 1` como andaria pra qualquer outro lugar, e
// fica grande porque chegou perto — não porque um segundo número foi ligado. Não
// existe mais como os dois discordarem, porque agora só existe um.
//
// Dois defeitos menores vinham junto, e os dois eram de unidade:
//
//   - **`x` e `z` andavam na mesma velocidade**, normalizados pela hipotenusa
//     como se fossem o mesmo espaço. Não são: atravessar o palco de lado é um
//     passeio, e atravessar a profundidade inteira é ir do horizonte até o seu
//     nariz. Com a mesma velocidade nos dois, o passeio pra frente virava um
//     avanço de tela cheia em dois segundos. Agora cada eixo tem a sua, e
//     `z` é bem mais devagar;
//   - **o alvo mudava de uma vez.** Trocar de estado trocava o destino no mesmo
//     quadro, e a direção virava em bico. Agora a velocidade tem inércia: ele
//     acelera e freia, e chega no lugar em vez de bater nele.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const sorte = (n) => Math.random() < n
const entre = (a, b) => a + Math.random() * (b - a)

// Os truques que ele sabe. São os mesmos verbos do Kinectimals (sentar, rolar,
// implorar, deitar, coçar, brincar) traduzidos pros clipes que o motor já tem —
// nenhum desenho novo, só sequência.
const TRUQUES = ['sentar', 'rolar', 'implorar', 'deitar', 'cocar', 'brincar']

// Quanto do palco ele atravessa por segundo, em cada eixo. Andando.
// Correr multiplica os dois. `Z` é menor porque a profundidade inteira vale
// muito mais na tela do que a largura inteira — ver o comentário lá em cima.
const VEL_X = 0.26
const VEL_Z = 0.12
const CORRER = 2.1

// O quanto ele chega perto quando vem no vidro, e o quanto o mais longe é longe.
const Z_VIDRO = 1
const Z_FUNDO = 0.18

/**
 * Cria o cérebro de um bichinho no palco.
 *
 * Ele não sabe desenhar nada: devolve números. Quem desenha é o `PetCanvas`.
 */
export function criarPalco({ correParaCamera = true } = {}) {
  const eu = {
    x: 0.5,
    z: 0.5,
    virado: 1,
    estado: 'parado',
    acao: 'parado',
    ate: 0,
    alvoX: 0.5,
    alvoZ: 0.5,
    // A velocidade atual em cada eixo. Existe pra ele acelerar e frear em vez
    // de mudar de direção em bico quando o destino troca.
    vx: 0,
    vz: 0,
    lambida: 0,
    chamado: false,
  }

  function irPara(x, z, acao, estado, agora, prazo) {
    eu.alvoX = clamp(x, 0.06, 0.94)
    eu.alvoZ = clamp(z, Z_FUNDO, Z_VIDRO)
    eu.acao = acao
    eu.estado = estado
    eu.ate = agora + prazo
  }

  /** Escolhe o próximo estado. É aqui que mora a personalidade. */
  function decidir(agora) {
    // Chamado tem prioridade: se a pessoa tocou no cenário, ele VEM.
    if (eu.chamado && correParaCamera) {
      eu.chamado = false
      irPara(entre(0.42, 0.58), Z_VIDRO, 'correr', 'chegando', agora, 4200)
      return
    }
    if (eu.estado === 'chegando') {
      // Chegou no vidro: lambe. Ele NÃO muda de tamanho aqui — já está grande
      // porque andou até aqui, que é o ponto inteiro desta correção.
      eu.estado = 'lambendo'
      eu.acao = 'brincar'
      eu.alvoX = eu.x
      eu.alvoZ = eu.z
      eu.lambida = 0
      eu.ate = agora + entre(1800, 2800)
      return
    }
    if (eu.estado === 'lambendo') {
      irPara(entre(0.2, 0.8), entre(0.3, 0.65), 'andar', 'voltando', agora, 5200)
      return
    }
    // Do resto, sorteia.
    const r = Math.random()
    if (correParaCamera && r < 0.14) {
      irPara(entre(0.42, 0.58), Z_VIDRO, 'correr', 'chegando', agora, 4200)
    } else if (r < 0.42) {
      // O passeio comum mexe POUCO na profundidade: quem anda de um lado pro
      // outro do quintal não fica indo e voltando do horizonte pro seu nariz.
      // Antes o destino de `z` era sorteado no intervalo inteiro toda vez, e o
      // bicho vivia crescendo e encolhendo sem parar — parte do "bugado".
      const perto = clamp(eu.z + entre(-0.22, 0.22), Z_FUNDO, 0.85)
      irPara(entre(0.08, 0.92), perto, sorte(0.3) ? 'correr' : 'andar', 'andando',
        agora, entre(2600, 4800))
    } else if (r < 0.62) {
      eu.estado = 'truque'
      eu.acao = TRUQUES[Math.floor(Math.random() * TRUQUES.length)]
      eu.alvoX = eu.x
      eu.alvoZ = eu.z
      eu.ate = agora + entre(2200, 3600)
    } else {
      eu.estado = 'parado'
      eu.acao = 'parado'
      eu.alvoX = eu.x
      eu.alvoZ = eu.z
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
      // O passo grande é o inimigo de qualquer simulação com inércia: voltar pro
      // app depois de um minuto entrega um `dt` gigante e o bicho aparece do
      // outro lado do palco. 60 ms é o teto (uns 15 quadros por segundo).
      const passo = Math.min(60, Math.max(1, dt))
      const seg = passo / 1000
      if (agora >= eu.ate) decidir(agora)

      const andando = eu.estado === 'andando' || eu.estado === 'chegando' || eu.estado === 'voltando'
      const correndo = eu.acao === 'correr'
      const maxX = VEL_X * (correndo ? CORRER : 1)
      const maxZ = VEL_Z * (correndo ? CORRER : 1)

      // Cada eixo por si. Nada de normalizar pela hipotenusa: `x` e `z` não são
      // a mesma unidade de tela, e tratá-los como se fossem era o que fazia o
      // avanço em profundidade sair rápido demais.
      const alvoVX = andando ? clamp((eu.alvoX - eu.x) * 4, -1, 1) * maxX : 0
      const alvoVZ = andando ? clamp((eu.alvoZ - eu.z) * 4, -1, 1) * maxZ : 0
      // Inércia: 250 ms pra chegar na velocidade pedida. É o que dá a arrancada
      // e a freada, e o que impede a virada em bico quando o destino troca.
      const inercia = Math.min(1, seg / 0.25)
      eu.vx += (alvoVX - eu.vx) * inercia
      eu.vz += (alvoVZ - eu.vz) * inercia

      eu.x = clamp(eu.x + eu.vx * seg, 0.05, 0.95)
      eu.z = clamp(eu.z + eu.vz * seg, Z_FUNDO, Z_VIDRO)

      if (andando) {
        const faltaX = Math.abs(eu.alvoX - eu.x)
        const faltaZ = Math.abs(eu.alvoZ - eu.z)
        if (faltaX < 0.02 && faltaZ < 0.02) eu.ate = Math.min(eu.ate, agora + 120)
        // Vira pro lado pra onde anda — mas só quando o movimento é de lado de
        // verdade. Vindo reto pra frente ele continua encarando você, que é o
        // que um bicho faz ao vir na sua direção. A comparação é entre as
        // velocidades já convertidas pra "quanto disso aparece na tela", senão
        // um passinho lateral viraria o bicho inteiro.
        if (Math.abs(eu.vx) > Math.abs(eu.vz) * 1.6 && Math.abs(eu.vx) > maxX * 0.25) {
          eu.virado = eu.vx > 0 ? 1 : -1
        }
      }

      if (eu.estado === 'lambendo') {
        eu.lambida = Math.min(1, eu.lambida + passo / 500)
        eu.virado = 1
      } else {
        eu.lambida = Math.max(0, eu.lambida - passo / 400)
      }

      return {
        x: eu.x,
        z: eu.z,
        virado: eu.virado,
        acao: eu.acao,
        estado: eu.estado,
        lambida: eu.lambida,
        // O quanto ele está "no vidro", derivado de `z` e de mais nada. Continua
        // saindo daqui porque o desenho usa (a lambida, o desfoque), mas agora é
        // uma LEITURA da profundidade, não um segundo número que pode discordar
        // dela. Só os 25% finais contam como "colado".
        perto: clamp((eu.z - 0.75) / 0.25, 0, 1),
      }
    },
  }
}

/**
 * Traduz a posição do cérebro pro enquadramento do desenho.
 *
 * `z` manda em tudo: longe fica pequeno e alto (perto do horizonte), perto fica
 * grande e embaixo. É essa variação junta — tamanho E altura — que lê como
 * profundidade; mexer só no tamanho parece um balão inflando.
 *
 * A curva do tamanho é `1/(distância)`, que é como perspectiva funciona de
 * verdade, e não uma reta. Com reta, o último passo até o vidro cresce tanto
 * quanto o primeiro passo lá do fundo — e é justamente chegando perto que a
 * coisa tem que crescer depressa, senão a aproximação não se sente.
 */
export function enquadrar(pos, { w, h, escalaBase }) {
  const z = Math.max(0, Math.min(1, pos.z))
  // Distância em unidades arbitrárias. O fundo e o vidro estão nomeados porque
  // os dois aparecem em duas contas cada, e um deles trocado sem o outro faz o
  // tamanho e o chão se descolarem — que é a família de defeito que esta
  // rodada inteira está consertando.
  const D_FUNDO = 2.2
  const D_VIDRO = 0.96
  const distancia = D_FUNDO - z * (D_FUNDO - D_VIDRO)
  // 1,36 é escolhido pra dar ~0,62× no fundo e ~1,42× no vidro. Mais que isso
  // e a cabeça sai do quadro antes de ele chegar a lamber.
  const escala = escalaBase * (1.36 / distancia)
  const chaoLonge = h * 0.6
  const chaoPerto = h * 0.98
  // O chão acompanha a mesma curva do tamanho, e não uma reta: se os dois não
  // andarem juntos, o bicho parece deslizar pra cima enquanto cresce.
  const t = (D_FUNDO / distancia - 1) / (D_FUNDO / D_VIDRO - 1)
  const chao = chaoLonge + (chaoPerto - chaoLonge) * t
  return { cx: w * pos.x, chao, escala }
}
