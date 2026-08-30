// Ícones desenhados, não emoji.
//
// Emoji é o que mais entrega interface genérica: cada sistema desenha do seu jeito,
// o traço não combina com nada e o resultado parece montado às pressas. Estes aqui
// são traço único, canto arredondado e a mesma espessura em todos — combinam com o
// contorno desenhado dos cartões.

const STROKE = {
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const PATHS = {
  home: <path d="M3.5 11 12 3.5 20.5 11V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6h-4A1.5 1.5 0 0 1 3.5 19z" />,
  flower: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 9.6c-.6-2.6.3-4.6 0-5.6-.3 1-1.4 3 0 5.6M14.4 12c2.6-.6 4.6.3 5.6 0-1-.3-3-1.4-5.6 0M12 14.4c.6 2.6-.3 4.6 0 5.6.3-1 1.4-3 0-5.6M9.6 12c-2.6.6-4.6-.3-5.6 0 1 .3 3 1.4 5.6 0" />
      <path d="M13.9 10.1c1.8-2 4-2.5 4.7-3.2-.7.7-1.2 2.9-3.2 4.7M10.1 13.9c-1.8 2-4 2.5-4.7 3.2.7-.7 1.2-2.9 3.2-4.7" />
    </>
  ),
  chat: <path d="M20.5 11.8a7.7 7.7 0 0 1-11.1 6.9L4 20.5l1.8-5.4A7.7 7.7 0 1 1 20.5 11.8z" />,
  game: (
    <>
      <rect x="2.5" y="7.5" width="19" height="11" rx="5" />
      <path d="M7 11v4M5 13h4M15.5 12.5h.01M18.5 15h.01M18 11.5h.01M15.5 15.5h.01" />
    </>
  ),
  paw: (
    <>
      <path d="M12 20.5c-3 0-5-1.6-5-3.7 0-1.9 2-3.3 5-3.3s5 1.4 5 3.3c0 2.1-2 3.7-5 3.7z" />
      <ellipse cx="5.6" cy="10.4" rx="2" ry="2.5" />
      <ellipse cx="18.4" cy="10.4" rx="2" ry="2.5" />
      <ellipse cx="9.4" cy="6.4" rx="2" ry="2.6" />
      <ellipse cx="14.6" cy="6.4" rx="2" ry="2.6" />
    </>
  ),
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </>
  ),
  heart: <path d="M12 20.2S3.8 15.4 3.8 9.6a4.4 4.4 0 0 1 8.2-2.3 4.4 4.4 0 0 1 8.2 2.3c0 5.8-8.2 10.6-8.2 10.6z" />,
  bag: (
    <>
      <path d="M4.5 8h15l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H7.2A1.5 1.5 0 0 1 5.7 19z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </>
  ),
  check: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M8 12.5l2.6 2.6L16.5 9" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5h3.2l1.4-2.2h7.8l1.4 2.2h3.2v11h-17z" />
      <circle cx="12" cy="14" r="3.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16.5H6l1.3-2v-4a4.7 4.7 0 0 1 9.4 0v4z" />
      <path d="M10.2 19.5a2 2 0 0 0 3.6 0" />
    </>
  ),
  // O par do som. Os dois compartilham o mesmo alto-falante de propósito: só o
  // que está à direita muda, então o botão não "pula" ao alternar.
  som: (
    <>
      <path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4z" />
      <path d="M15 9.6a3.4 3.4 0 0 1 0 4.8M17.8 7.2a7 7 0 0 1 0 9.6" />
    </>
  ),
  mudo: (
    <>
      <path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4z" />
      <path d="m15.5 10 5 4M20.5 10l-5 4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5l1.2 2 2.3-.4.6 2.2 2.2.6-.4 2.3 2 1.2-1.4 1.8 1 2.1-2.1.9-.2 2.3-2.3-.2-1.4 1.9L12 19l-1.5 1.2-1.4-1.9-2.3.2-.2-2.3-2.1-.9 1-2.1L4.1 11.4l2-1.2-.4-2.3 2.2-.6.6-2.2 2.3.4z" />
    </>
  ),
  palette: (
    <>
      <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.6 2.6-3 2.6h-1.2a2 2 0 0 0-1.4 3.4c.5.6.2 2.5-2.9 2.5z" />
      <circle cx="8" cy="10" r="1.1" />
      <circle cx="12" cy="7.6" r="1.1" />
      <circle cx="15.8" cy="10" r="1.1" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 11.5V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5" />
      <path d="M3 12.2a1.7 1.7 0 0 1 3.4 0v2.3h11.2v-2.3a1.7 1.7 0 0 1 3.4 0V18H3z" />
      <path d="M6 18v2M18 18v2" />
    </>
  ),
  spark: <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />,
  fire: <path d="M12 20.5c-3.3 0-5.5-2.1-5.5-5 0-3.4 3.2-4.6 3.2-8 2.4 1.2 2.4 3.4 2.4 3.4s2-1.4 2-3.9c2.4 2 3.4 4.9 3.4 8.5 0 2.9-2.2 5-5.5 5z" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  // A seta de responder do chat. Sem ela desenhada, `Icon` devolveria `null` e o
  // botão de responder apareceria vazio — sem erro nenhum, que é a armadilha já
  // registrada no HANDOFF (os ícones `drop`/`sparkle`/`lock` sumiram assim).
  reply: <path d="M9.5 6.5L4.5 11l5 4.5V12.5c4 0 6.6 1.2 8.5 4-.6-4.6-3.4-7.4-8.5-7.7z" />,
  // --- Etapa 4: os quatro atributos do bichinho e o cadeado do cômodo
  drop: <path d="M12 3.8c3.2 3.6 5 6.2 5 8.7a5 5 0 0 1-10 0c0-2.5 1.8-5.1 5-8.7z" />,
  sparkle: (
    <>
      <path d="M12 4v5M12 15v5M4.9 12h5M14.1 12h5" />
      <path d="M7.4 7.4l2.6 2.6M14 14l2.6 2.6M16.6 7.4L14 10M10 14l-2.6 2.6" />
    </>
  ),
  lock: (
    <>
      <rect x="4.8" y="10.5" width="14.4" height="9.5" rx="2" />
      <path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" />
      <circle cx="12" cy="15.2" r="1.2" />
    </>
  ),
}

export default function Icon({ name, size = 24, color = 'currentColor', filled = false, ...rest }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke={color}
      fill={filled ? color : 'none'}
      {...STROKE}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  )
}
