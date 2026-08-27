// O microfone: em que aparelho estamos, em que estado ele está, e como liberar.
//
// ---------------------------------------------------------------- por que existe
//
// O diagnóstico de 27/08 fez o trabalho dele: rodou os sete passos no Android do
// dono e parou no passo 4 com `NotAllowedError` — "Você (ou o navegador) negou o
// microfone para este site". O relato que veio junto foi **"e não pede a
// permissão como deveria"**, e as duas coisas juntas são a resposta inteira:
//
//   quando o navegador já tem um "não" guardado para a origem, ele NÃO pergunta
//   de novo. `getUserMedia` falha na hora, com o mesmo `NotAllowedError` de quem
//   acabou de tocar em "Bloquear". Do lado do app não existe recurso: nenhuma
//   chamada, nenhum gesto e nenhuma opção reabrem a pergunta. Só o dono do
//   aparelho reabre, nos ajustes do site.
//
// Enquanto o app tratava os dois casos como um só, a tela dizia "libere nos
// ajustes" e a pessoa ficava tocando no botão esperando uma pergunta que nunca
// mais vinha. É o mesmo padrão do push do iPhone e do próprio diagnóstico:
// **um "não funciona" vira um "está assim, faça isto"**.
//
// Como o "não" é guardado por ORIGEM, ele vale para o site, para o atalho na
// tela de início e para qualquer aba — todos são o mesmo `https://<host>`. É por
// isso que "no navegador pelo link também não" não contradiz nada: é o mesmo
// lugar, com o mesmo "não" guardado.
//
// Este módulo tem uma responsabilidade só: dizer o estado e o caminho de volta.
// Quem grava é o chat; quem mede os sete passos é o `audioDiag`.

/**
 * Onde o app está rodando.
 *
 * Serve para escolher o TEXTO da recuperação, que é diferente em cada caso — nos
 * ajustes do Android o app empacotado aparece como aplicativo, e o site aparece
 * dentro do navegador. Mandar a pessoa para o lugar errado é o mesmo que não
 * dizer nada.
 */
export function ondeRoda() {
  const ua = navigator.userAgent || ''
  const apk = !!(window.Capacitor?.isNativePlatform?.() || / wv\b/.test(ua))
  const iOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  const instalado = window.matchMedia?.('(display-mode: standalone)')?.matches
    || navigator.standalone === true
  let navegador = 'o navegador'
  if (/EdgA?\//.test(ua)) navegador = 'Edge'
  else if (/SamsungBrowser/.test(ua)) navegador = 'Samsung Internet'
  else if (/Firefox|FxiOS/.test(ua)) navegador = 'Firefox'
  else if (/CriOS|Chrome/.test(ua)) navegador = 'Chrome'
  else if (/Safari/.test(ua) && iOS) navegador = 'Safari'
  return { apk, iOS, android, instalado, navegador }
}

/**
 * O estado guardado da permissão, ANTES de tentar gravar.
 *
 * `granted` / `denied` / `prompt` / `desconhecido`. O último não é falha: a API
 * de permissões não existe em todo lugar (Safari até pouco tempo, e várias
 * WebViews), e aí o único jeito de saber é tentando — o que está certo, porque
 * tentar é justamente o que faz o navegador perguntar.
 */
export async function estadoDoMicrofone() {
  try {
    const p = await navigator.permissions?.query({ name: 'microphone' })
    return p?.state || 'desconhecido'
  } catch {
    return 'desconhecido'
  }
}

/**
 * O caminho de volta, em passos, para o aparelho em que estamos.
 *
 * Escrito como quem explica para alguém com o celular na mão: onde tocar, com
 * que nome a coisa aparece na tela. Sem "verifique as configurações".
 */
export function comoLiberar(onde = ondeRoda()) {
  if (onde.apk) {
    return [
      'Sai do app.',
      'Ajustes do Android → Apps → Nosso app → Permissões → Microfone.',
      'Marca "Permitir".',
      'Abre o app de novo e toca em "Testar o microfone".',
    ]
  }
  if (onde.iOS) {
    return [
      'Ajustes do iPhone → Safari → Microfone.',
      'Deixa este site em "Perguntar" (ou "Permitir").',
      'Fecha o app de vez e abre de novo — o atalho da tela de início só relê isso ao reabrir.',
      'Toca em "Testar o microfone" e responde "Permitir".',
    ]
  }
  if (onde.instalado) {
    return [
      'O atalho na tela de início usa a permissão do SITE, e ela está com "Bloquear" guardado.',
      `Abre o mesmo endereço no ${onde.navegador}, numa aba normal.`,
      'Toca no cadeado 🔒 ao lado do endereço → Permissões → Microfone → "Perguntar". Se aparecer "Redefinir permissões", serve também.',
      'Volta pelo atalho e toca em "Testar o microfone".',
    ]
  }
  return [
    `No ${onde.navegador}, toca no cadeado 🔒 (ou no ⚙ / ⓘ) ao lado do endereço.`,
    'Abre "Permissões" e procura Microfone.',
    'Troca de "Bloquear" para "Perguntar" — ou toca em "Redefinir permissões", que apaga o "não" guardado.',
    'Recarrega a página e toca em "Testar o microfone". Aí a pergunta volta a aparecer.',
  ]
}

/**
 * Pede o microfone e devolve o motivo já traduzido.
 *
 * Uma porta só para o chat e para o diagnóstico. Antes eram dois caminhos com
 * duas tabelas de mensagem parecidas mas diferentes — e a do chat era a pior
 * justamente onde a pessoa está quando o problema aparece.
 *
 * A distinção que importa está aqui: `NotAllowedError` com a permissão ainda em
 * `prompt` significa que a PERGUNTA FOI FECHADA agora (tocou fora, ou o
 * navegador desistiu) — dá para tentar de novo. Com a permissão em `denied` não
 * dá: pedir mil vezes devolve o mesmo erro sem mostrar nada na tela.
 */
export async function pedirMicrofone() {
  const onde = ondeRoda()
  if (!window.isSecureContext) {
    return {
      ok: false,
      bloqueado: false,
      motivo: 'Sem HTTPS o navegador não deixa gravar, e nem chega a perguntar. Abre o app pelo endereço com o cadeado.',
      passos: [],
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, bloqueado: false, motivo: 'Este navegador não sabe gravar áudio.', passos: [] }
  }

  const antes = await estadoDoMicrofone()
  if (antes === 'denied') {
    return {
      ok: false,
      bloqueado: true,
      motivo: 'O microfone está BLOQUEADO para este endereço — é por isso que ele não pergunta mais nada. Só dá para reabrir nos ajustes:',
      passos: comoLiberar(onde),
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    return { ok: true, bloqueado: false, motivo: '', passos: [], stream }
  } catch (err) {
    const nome = err?.name || 'erro'
    if (nome === 'NotAllowedError' || nome === 'SecurityError') {
      // Reler o estado é o que separa "fechou a pergunta" de "está bloqueado":
      // o erro é o MESMO nos dois casos, e só o estado depois conta a diferença.
      const depois = await estadoDoMicrofone()
      if (depois === 'denied') {
        return {
          ok: false,
          bloqueado: true,
          motivo: 'O microfone ficou bloqueado para este endereço. Enquanto estiver assim, o navegador não pergunta de novo:',
          passos: comoLiberar(onde),
        }
      }
      return {
        ok: false,
        bloqueado: false,
        motivo: 'A pergunta do microfone foi fechada sem resposta. Toca de novo e responde "Permitir" — fechando algumas vezes seguidas, o navegador para de perguntar e aí só nos ajustes.',
        passos: [],
      }
    }
    const tabela = {
      NotFoundError: 'Não encontrei microfone neste aparelho.',
      DevicesNotFoundError: 'Não encontrei microfone neste aparelho.',
      NotReadableError: 'O microfone está ocupado por outro app. Fecha a ligação ou o gravador e tenta de novo.',
      TrackStartError: 'O microfone está ocupado por outro app. Fecha a ligação ou o gravador e tenta de novo.',
      AbortError: 'O aparelho interrompeu o pedido do microfone.',
      OverconstrainedError: 'Este aparelho não tem um microfone que sirva.',
    }
    return {
      ok: false,
      bloqueado: false,
      motivo: tabela[nome] || `Não consegui acessar o microfone (${nome}).`,
      passos: [],
    }
  }
}
