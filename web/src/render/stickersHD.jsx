/**
 * Figurinhas "de verdade" — redondas, com volume e brilho, em vez de pixel.
 *
 * Por que existe: o dono mandou a referência do app dele e pediu figurinha
 * REALISTA, não em pixel. O cenário isométrico continua em pixel (decisão
 * travada); o que muda é só a figurinha do chat, que sempre foi um assunto à
 * parte — ela vive numa bolha de conversa, não dentro do mundinho.
 *
 * **Sobre a referência:** os desenhos da foto são o emoji da Apple, que é arte
 * de outra empresa. Copiar aquilo seria pegar desenho dos outros. O que está
 * aqui é arte nossa, com os mesmos ASSUNTOS e no mesmo idioma visual (rosto
 * redondo amarelo, brilho em cima, sombra embaixo) — que é estilo, e estilo
 * não tem dono.
 *
 * Por que SVG e não canvas: aqui a graça é justamente a borda macia e o
 * degradê, o oposto do motor de pixel. SVG dá isso de graça, fica nítido em
 * qualquer tamanho e pesa pouco. O `Icon` do app já é SVG, então não é
 * tecnologia nova no projeto.
 *
 * Cada figurinha é desenhada numa caixa de 100×100.
 */

// ------------------------------------------------------------------ paleta
const AMARELO = { claro: '#ffe27a', meio: '#fdc93f', escuro: '#e8a41f' }
const ROSA = { claro: '#ff9db4', meio: '#ec5f80', escuro: '#c53b5e' }
const PELE = { claro: '#ffd9bd', meio: '#f2b78f', escuro: '#d18f66' }
const TRACO = '#5b3a1f'

/** Os degradês, declarados uma vez e reaproveitados por todas as figurinhas. */
function Defs() {
  return (
    <defs>
      <radialGradient id="fg-rosto" cx="38%" cy="30%" r="78%">
        <stop offset="0%" stopColor={AMARELO.claro} />
        <stop offset="62%" stopColor={AMARELO.meio} />
        <stop offset="100%" stopColor={AMARELO.escuro} />
      </radialGradient>
      <radialGradient id="fg-coracao" cx="34%" cy="26%" r="80%">
        <stop offset="0%" stopColor={ROSA.claro} />
        <stop offset="60%" stopColor={ROSA.meio} />
        <stop offset="100%" stopColor={ROSA.escuro} />
      </radialGradient>
      <radialGradient id="fg-boca" cx="40%" cy="20%" r="85%">
        <stop offset="0%" stopColor="#a3324f" />
        <stop offset="100%" stopColor="#5d1226" />
      </radialGradient>
      <radialGradient id="fg-pele" cx="36%" cy="28%" r="80%">
        <stop offset="0%" stopColor={PELE.claro} />
        <stop offset="65%" stopColor={PELE.meio} />
        <stop offset="100%" stopColor={PELE.escuro} />
      </radialGradient>
      <linearGradient id="fg-brilho" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/** O rosto amarelo, com o brilho de cima que dá o aspecto de bolinha. */
function Rosto({ r = 34, cx = 50, cy = 52 }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="url(#fg-rosto)" />
      {/* brilho: uma elipse clara no alto, o que faz a bola parecer redonda */}
      <ellipse cx={cx - r * 0.18} cy={cy - r * 0.52} rx={r * 0.55} ry={r * 0.3} fill="url(#fg-brilho)" />
    </>
  )
}

/** Olho fechado e feliz (o arquinho pra cima). */
function OlhoFeliz({ x, y, larg = 11 }) {
  return (
    <path
      d={`M ${x - larg / 2} ${y + 3} Q ${x} ${y - 5} ${x + larg / 2} ${y + 3}`}
      stroke={TRACO}
      strokeWidth="3.4"
      strokeLinecap="round"
      fill="none"
    />
  )
}

/** Olho aberto, com a luzinha branca que dá vida. */
function OlhoAberto({ x, y, rx = 4.6, ry = 6 }) {
  return (
    <>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#3d2b1a" />
      <circle cx={x - rx * 0.34} cy={y - ry * 0.38} r={rx * 0.36} fill="#fff" />
    </>
  )
}

/** Coração com brilho. Serve de olho, de enfeite e de figurinha inteira. */
function Coracao({ x, y, s = 1, fill = 'url(#fg-coracao)', opacity = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <path
        d="M0 9 C -9 1 -12 -6 -7 -10 C -3.5 -13 0 -10.5 0 -7 C 0 -10.5 3.5 -13 7 -10 C 12 -6 9 1 0 9 Z"
        fill={fill}
      />
      <ellipse cx="-3.4" cy="-6.4" rx="2.6" ry="1.7" fill="#fff" opacity="0.6" transform="rotate(-28 -3.4 -6.4)" />
    </g>
  )
}

/** Brilho de quatro pontas — o "uau". */
function Brilho({ x, y, s = 1, cor = '#fff3b0' }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -9 C 1 -3 3 -1 9 0 C 3 1 1 3 0 9 C -1 3 -3 1 -9 0 C -3 -1 -1 -3 0 -9 Z"
      fill={cor}
    />
  )
}

/** Boca sorrindo, aberta. */
function BocaAberta({ x = 50, y = 62, larg = 20, alt = 13 }) {
  return (
    <>
      <path
        d={`M ${x - larg / 2} ${y} Q ${x} ${y + alt} ${x + larg / 2} ${y} Z`}
        fill="url(#fg-boca)"
      />
      <path d={`M ${x - larg / 2} ${y} Q ${x} ${y + alt} ${x + larg / 2} ${y}`} fill="none" stroke={TRACO} strokeWidth="1.6" />
      {/* língua: sem ela a boca vira um buraco preto */}
      <path d={`M ${x - 5} ${y + alt * 0.6} Q ${x} ${y + alt + 2} ${x + 5} ${y + alt * 0.6} Z`} fill="#e8607e" />
    </>
  )
}

/** Sorriso de linha. */
function Sorriso({ x = 50, y = 62, larg = 20 }) {
  return (
    <path
      d={`M ${x - larg / 2} ${y} Q ${x} ${y + 9} ${x + larg / 2} ${y}`}
      stroke={TRACO}
      strokeWidth="3.2"
      strokeLinecap="round"
      fill="none"
    />
  )
}

/** Bochecha corada. */
function Bochechas({ y = 60, dx = 22 }) {
  return (
    <>
      <ellipse cx={50 - dx} cy={y} rx="6" ry="4" fill={ROSA.claro} opacity="0.62" />
      <ellipse cx={50 + dx} cy={y} rx="6" ry="4" fill={ROSA.claro} opacity="0.62" />
    </>
  )
}

/** Boca de beijo, em bico. */
function Biquinho({ x = 50, y = 62 }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="7" ry="5.5" fill={ROSA.escuro} />
      <ellipse cx={x} cy={y - 1} rx="4.5" ry="3" fill={ROSA.meio} />
      <ellipse cx={x - 1.5} cy={y - 2} rx="2" ry="1.2" fill="#fff" opacity="0.5" />
    </g>
  )
}

/** Lábios vermelhos vistos de frente — a "boca" da referência. */
function Labios({ cx = 50, cy = 52, s = 1 }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path
        d="M -30 -2 C -22 -16 -8 -14 0 -6 C 8 -14 22 -16 30 -2 C 20 14 -20 14 -30 -2 Z"
        fill="url(#fg-coracao)"
        stroke={ROSA.escuro}
        strokeWidth="1.4"
      />
      {/* a linha entre os lábios e o brilho: é o que tira o aspecto de mancha */}
      <path d="M -30 -2 C -14 4 14 4 30 -2" stroke="#8e1f3d" strokeWidth="2.2" fill="none" />
      <ellipse cx="-13" cy="-6" rx="7" ry="3" fill="#fff" opacity="0.55" transform="rotate(-16 -13 -6)" />
      <ellipse cx="12" cy="6" rx="8" ry="2.6" fill="#fff" opacity="0.32" />
    </g>
  )
}

/** Mãozinha, pra cafuné, abraço e "meu dia". */
function Mao({ x, y, s = 1, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`}>
      <rect x="-10" y="-7" width="20" height="15" rx="7" fill="url(#fg-pele)" />
      <rect x="-11" y="-11" width="5.5" height="10" rx="2.7" fill="url(#fg-pele)" />
      <rect x="-5" y="-13" width="5.5" height="12" rx="2.7" fill="url(#fg-pele)" />
      <rect x="1" y="-13" width="5.5" height="12" rx="2.7" fill="url(#fg-pele)" />
      <rect x="7" y="-11" width="5" height="10" rx="2.5" fill="url(#fg-pele)" />
    </g>
  )
}

/** O "z" do sono, em traço — nunca como texto (ver o comentário em `sono_a_dois`). */
function Zezinho({ x, y, s = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M -5 -5 H 5 L -5 5 H 5"
      stroke="#7f9bd6"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  )
}

/** Uma pessoinha dormindo, pra "sono a dois". */
function Cabeca({ x, y, cabelo, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="0" r="9" fill="url(#fg-pele)" />
      <path d="M -9 -2 A 9 9 0 0 1 9 -2 L 9 -5 A 9 9 0 0 0 -9 -5 Z" fill={cabelo} />
      <path d="M -4 2 Q -3 3.4 -1.6 2" stroke={TRACO} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 1.6 2 Q 3 3.4 4 2" stroke={TRACO} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  )
}

// ------------------------------------------------------------------ as 18
export const STICKERS_HD = {
  saudade: (
    <>
      <Rosto />
      <OlhoAberto x={39} y={48} />
      <OlhoAberto x={59} y={48} />
      <Bochechas />
      <path d="M 42 64 Q 50 60 58 64" stroke={TRACO} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <Mao x={70} y={58} s={0.72} rot={-18} />
      <Coracao x={74} y={22} s={1.15} />
      <Coracao x={86} y={36} s={0.62} opacity={0.75} />
    </>
  ),

  vem_ca: (
    <>
      <Labios />
      {/* a cerejinha da referência */}
      <circle cx="62" cy="30" r="7" fill="#d92b3f" />
      <ellipse cx="59.6" cy="27.6" rx="2.4" ry="1.5" fill="#fff" opacity="0.6" />
      <path d="M 62 23 Q 66 12 76 10" stroke="#5f8f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),

  beijo: (
    <>
      <Rosto />
      <OlhoFeliz x={38} y={47} />
      <OlhoFeliz x={62} y={47} />
      <Biquinho y={64} />
      {/* marquinhas de beijo em volta */}
      {[[22, 30], [76, 28], [18, 62], [80, 60], [50, 18], [34, 82], [66, 82]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 37})`}>
          <path d="M -5 0 C -3.6 -3.4 -1.2 -3.4 0 -1.2 C 1.2 -3.4 3.6 -3.4 5 0 C 3.6 3.4 -3.6 3.4 -5 0 Z" fill={ROSA.escuro} />
        </g>
      ))}
    </>
  ),

  toma_amor: (
    <>
      <Rosto />
      <OlhoFeliz x={38} y={48} />
      <OlhoAberto x={60} y={48} />
      <Bochechas />
      <Biquinho x={46} y={64} />
      <Mao x={66} y={66} s={0.66} rot={-30} />
      <Coracao x={76} y={50} s={0.9} />
      <Coracao x={86} y={36} s={0.62} opacity={0.8} />
      <Coracao x={82} y={64} s={0.5} opacity={0.6} />
    </>
  ),

  uau: (
    <>
      <Rosto />
      <Coracao x={38} y={46} s={0.82} />
      <Coracao x={62} y={46} s={0.82} />
      <BocaAberta y={62} larg={17} alt={12} />
      <Brilho x={16} y={22} s={1.1} />
      <Brilho x={84} y={28} s={0.85} />
      <Brilho x={80} y={76} s={0.7} />
    </>
  ),

  grudinho: (
    <>
      <Rosto />
      <Coracao x={38} y={46} s={0.9} />
      <Coracao x={62} y={46} s={0.9} />
      <BocaAberta y={62} larg={22} alt={15} />
      {/* a gotinha de "babando" da referência */}
      <path d="M 66 70 q 3 6 0 8 q -3 -2 0 -8 Z" fill="#7fc7e8" />
      <Coracao x={20} y={20} s={0.72} />
      <Coracao x={82} y={22} s={0.6} opacity={0.85} />
    </>
  ),

  menstruacao: (
    <>
      {/* folhinha de calendário */}
      <rect x="18" y="24" width="64" height="58" rx="9" fill="#fff" stroke="#d9cfc4" strokeWidth="2" />
      <path d="M 18 33 a 9 9 0 0 1 9 -9 h 46 a 9 9 0 0 1 9 9 v 5 H 18 Z" fill="#e05a5a" />
      <circle cx="34" cy="22" r="4" fill="#b9b1a8" />
      <circle cx="66" cy="22" r="4" fill="#b9b1a8" />
      {/* a gota */}
      <path d="M 50 46 C 60 58 63 63 63 67 a 13 13 0 0 1 -26 0 c 0 -4 3 -9 13 -21 Z" fill="#d92b3f" />
      <ellipse cx="45" cy="64" rx="3.6" ry="5" fill="#fff" opacity="0.35" />
    </>
  ),

  amo_voce: (
    <>
      <Rosto />
      <OlhoAberto x={38} y={44} />
      <OlhoAberto x={62} y={44} />
      <Biquinho y={58} />
      {/* segurando um coração grande na frente */}
      <Coracao x={50} y={76} s={1.7} />
      <Mao x={31} y={78} s={0.6} rot={26} />
      <Mao x={69} y={78} s={0.6} rot={-26} />
    </>
  ),

  cafune: (
    <>
      <Rosto r={30} cy={58} />
      <OlhoFeliz x={40} y={56} />
      <OlhoFeliz x={60} y={56} />
      <Bochechas y={66} dx={20} />
      <Sorriso y={68} larg={16} />
      {/* a mão fazendo carinho na cabeça */}
      <Mao x={52} y={26} s={1.05} rot={8} />
      <path d="M 32 34 q 4 -5 9 -6" stroke={PELE.escuro} strokeWidth="2" fill="none" opacity="0.5" />
    </>
  ),

  abraco: (
    <>
      <Rosto r={30} cy={50} />
      <OlhoFeliz x={40} y={46} />
      <OlhoFeliz x={60} y={46} />
      <Bochechas y={58} dx={20} />
      <Sorriso y={58} larg={16} />
      {/* os dois bracinhos abertos */}
      <Mao x={18} y={70} s={0.86} rot={38} />
      <Mao x={82} y={70} s={0.86} rot={-38} />
    </>
  ),

  amor_seguro: (
    <>
      {/* dois sachês, como na referência */}
      <g transform="rotate(-14 40 52)">
        <rect x="20" y="30" width="34" height="44" rx="5" fill="#ff9db4" stroke="#d3607e" strokeWidth="2" />
        <circle cx="37" cy="52" r="10" fill="#ffc3d2" />
        <circle cx="37" cy="52" r="5.5" fill="#ff8aa8" />
      </g>
      <g transform="rotate(12 62 54)">
        <rect x="46" y="32" width="34" height="44" rx="5" fill="#9dc8ff" stroke="#5f88d3" strokeWidth="2" />
        <circle cx="63" cy="54" r="10" fill="#c3dcff" />
        <circle cx="63" cy="54" r="5.5" fill="#8ab0ff" />
      </g>
    </>
  ),

  amor_protegido: (
    <>
      {/* o personagem roxo da referência, desenhado por nós */}
      <path d="M 50 14 c 9 0 13 6 13 14 v 44 a 13 13 0 0 1 -26 0 V 28 c 0 -8 4 -14 13 -14 Z" fill="#b98ae0" />
      <path d="M 50 14 c 9 0 13 6 13 14 v 8 H 37 v -8 c 0 -8 4 -14 13 -14 Z" fill="#a071d1" />
      <ellipse cx="43" cy="34" rx="4" ry="9" fill="#fff" opacity="0.28" />
      <ellipse cx="43" cy="56" rx="3.4" ry="4" fill="#3d2b1a" />
      <ellipse cx="57" cy="56" rx="3.4" ry="4" fill="#3d2b1a" />
      <circle cx="41.8" cy="54.4" r="1.3" fill="#fff" />
      <circle cx="55.8" cy="54.4" r="1.3" fill="#fff" />
      <path d="M 44 66 Q 50 71 56 66" stroke="#3d2b1a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>
  ),

  comemoracao: (
    <>
      <Rosto />
      <OlhoFeliz x={38} y={48} />
      <OlhoFeliz x={62} y={48} />
      <BocaAberta y={62} larg={20} alt={14} />
      {/* chapéu de festa */}
      <path d="M 24 30 L 40 -2 L 52 30 Z" fill="#5fb8e8" transform="translate(6 4)" />
      <path d="M 30 34 L 46 2 L 50 12 Z" fill="#ffd75e" transform="translate(6 4)" opacity="0.9" />
      {/* confete */}
      {[['#ff8aa8', 78, 20, 18], ['#7fd6b0', 86, 40, -24], ['#ffd75e', 20, 74, 40], ['#9dc8ff', 82, 70, -12]].map(
        ([c, x, y, r], i) => (
          <rect key={i} x={x} y={y} width="7" height="4" rx="1.5" fill={c} transform={`rotate(${r} ${x} ${y})`} />
        )
      )}
    </>
  ),

  acabei: (
    <>
      <Rosto r={30} cy={58} />
      {/* as duas mãos no rosto, de susto */}
      <Mao x={22} y={62} s={0.8} rot={22} />
      <Mao x={78} y={62} s={0.8} rot={-22} />
      <OlhoAberto x={41} y={54} rx={4} ry={5.4} />
      <OlhoAberto x={59} y={54} rx={4} ry={5.4} />
      <ellipse cx="50" cy="70" rx="6" ry="7.5" fill="url(#fg-boca)" />
      {/* as três nuvenzinhas marrons da referência */}
      {[[30, 22, 1], [50, 15, 1.15], [70, 22, 1]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M -9 6 q 0 -6 4 -7 q 0 -6 5 -6 q 5 0 5 6 q 4 1 4 7 Z" fill="#8a5f3c" />
          <path d="M -9 6 h 18 q 1 3 -2 3 h -14 q -3 0 -2 -3 Z" fill="#6f4a2c" />
        </g>
      ))}
    </>
  ),

  sono_a_dois: (
    <>
      {/* a cama */}
      <rect x="12" y="44" width="76" height="34" rx="6" fill="#8a5f3c" />
      <rect x="12" y="38" width="10" height="42" rx="4" fill="#6f4a2c" />
      <rect x="78" y="38" width="10" height="42" rx="4" fill="#6f4a2c" />
      <rect x="20" y="52" width="60" height="10" rx="4" fill="#fdf6ec" />
      <rect x="20" y="60" width="60" height="16" rx="4" fill="#5f88d3" />
      <Cabeca x={38} y={50} cabelo="#4a3524" s={0.92} />
      <Cabeca x={62} y={50} cabelo="#8a5f3c" s={0.92} />
      {/* Os "z" do sono, DESENHADOS e não escritos.
          Com `<text>` eles viravam texto de verdade: vazavam pro rótulo do
          botão ("z z Sono a dois") e sumiriam se a fonte não carregasse. */}
      <Zezinho x={72} y={22} s={1} />
      <Zezinho x={84} y={12} s={0.68} />
    </>
  ),

  mordida: (
    <>
      <Labios cy={54} />
      {/* os dentinhos mordendo */}
      <path d="M 34 48 l 5 9 l 5 -9 Z" fill="#fff" />
      <path d="M 56 48 l 5 9 l 5 -9 Z" fill="#fff" />
      <rect x="30" y="44" width="40" height="6" rx="3" fill="#fff" opacity="0.92" />
    </>
  ),

  meu_dia: (
    <>
      <Rosto />
      <OlhoFeliz x={38} y={48} />
      <OlhoAberto x={60} y={48} />
      <Bochechas />
      <Sorriso y={64} larg={17} />
      {/* mãozinha segurando o celular */}
      <g transform="rotate(-10 74 58)">
        <rect x="66" y="38" width="17" height="30" rx="4" fill="#3d3a44" />
        <rect x="68" y="41" width="13" height="22" rx="2" fill="#9dd4ff" />
        <circle cx="74.5" cy="66" r="1.6" fill="#8f8c98" />
      </g>
      <Mao x={72} y={74} s={0.62} rot={-10} />
    </>
  ),

  foi_mal: (
    <>
      <Rosto />
      {/* sobrancelhas caídas: é o que faz ler como "desculpa" */}
      <path d="M 30 38 Q 38 34 45 38" stroke={TRACO} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 55 38 Q 62 34 70 38" stroke={TRACO} strokeWidth="3" fill="none" strokeLinecap="round" />
      <OlhoAberto x={38} y={50} rx={5} ry={6.4} />
      <OlhoAberto x={62} y={50} rx={5} ry={6.4} />
      {/* a lágrima */}
      <path d="M 68 56 C 73 63 75 66 75 69 a 7 7 0 0 1 -14 0 c 0 -3 2 -6 7 -13 Z" fill="#7fc7e8" opacity="0.9" />
      <path d="M 42 68 Q 50 64 58 68" stroke={TRACO} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
}

export const STICKERS_HD_CODES = Object.keys(STICKERS_HD)

/** Desenha uma figurinha realista. Devolve `null` se ela ainda não existir em HD. */
export default function StickerHD({ code, size = 64 }) {
  const arte = STICKERS_HD[code]
  if (!arte) return null
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden="true">
      <Defs />
      {arte}
    </svg>
  )
}
