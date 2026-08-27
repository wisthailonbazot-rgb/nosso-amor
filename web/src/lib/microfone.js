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
  if (onde.instalado && onde.android) {
    // ATENÇÃO À ORDEM AQUI — a primeira versão mandou pro lugar errado.
    //
    // O atalho instalado no Android não é um favorito: o Chrome o transforma
    // num aplicativo de verdade (WebAPK) e, quando faz isso, ele **delega o
    // microfone, a câmera e a localização às permissões do APLICATIVO**. Ou
    // seja: nesse caso o microfone NÃO mora no cadeado do endereço — mora nos
    // Ajustes do Android, na mesma lista em que ficam a câmera e os avisos.
    //
    // E como o atalho abre sem barra de endereço, não existe cadeado pra tocar:
    // era literalmente "não tem onde dar essa permissão". O caminho do
    // navegador continua listado abaixo, mas como segunda opção — ele só vale
    // se o atalho não tiver virado aplicativo.
    return [
      'Ajustes do Android → Apps (ou "Aplicativos") → Nosso app → Permissões.',
      'É a MESMA lista onde ficam a câmera e as notificações. Toca em Microfone e marca "Permitir".',
      'Se não houver "Microfone" nessa lista, o atalho não virou aplicativo: aí é pelo navegador — abre o mesmo endereço no ' + onde.navegador + ', toca no cadeado 🔒 → Permissões → Microfone → "Perguntar" (ou "Redefinir permissões").',
      'Volta pelo atalho e toca em "Liberar o microfone".',
    ]
  }
  if (onde.instalado) {
    return [
      'O atalho na tela de início usa a permissão do SITE, e ela está com "Bloquear" guardado.',
      `Abre o mesmo endereço no ${onde.navegador}, numa aba normal.`,
      'Toca no cadeado 🔒 ao lado do endereço → Permissões → Microfone → "Perguntar". Se aparecer "Redefinir permissões", serve também.',
      'Volta pelo atalho e toca em "Liberar o microfone".',
    ]
  }
  return [
    `No ${onde.navegador}, toca no cadeado 🔒 (ou no ⚙ / ⓘ) ao lado do endereço.`,
    'Abre "Permissões" e procura Microfone.',
    'Troca de "Bloquear" para "Perguntar" — ou toca em "Redefinir permissões", que apaga o "não" guardado.',
    'Recarrega a página e toca em "Liberar o microfone". Aí a pergunta volta a aparecer.',
  ]
}

/**
 * O caminho mais curto que existe entre um toque e a pergunta do navegador.
 *
 * É `pedirMicrofone` com a faixa devolvida na hora: quem chama isto não quer
 * gravar nada, quer só que a pergunta APAREÇA. Existe como botão próprio no
 * Perfil porque o pedido do dono foi exatamente esse — "ao clicar em testar
 * microfone, abre o modal de permissão igual foi com a câmera e as
 * notificações" — e porque o teste dos sete passos leva dois segundos gravando,
 * o que é muito para uma coisa que ou pergunta na hora ou não pergunta nunca.
 *
 * Segurar a faixa aberta acenderia a luzinha de "gravando" do celular sem
 * ninguém estar gravando; por isso ela é fechada assim que chega.
 */
export async function abrirPergunta() {
  const r = await pedirMicrofone()
  r.stream?.getTracks().forEach((t) => t.stop())
  return r
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

  // O PEDIDO VEM PRIMEIRO, E SEM NENHUM `await` NA FRENTE.
  //
  // Aqui estava o defeito que impedia o modal de aparecer. A versão anterior
  // perguntava `navigator.permissions.query()` ANTES de pedir o microfone, pra
  // decidir se valia a pena pedir — e essa consulta é uma Promise. Duas coisas
  // ruins saíam disso:
  //
  //   1. `getUserMedia` deixava de ser chamada DENTRO do toque. O navegador só
  //      mostra a pergunta enquanto a "ativação por gesto" está de pé, e um
  //      `await` no meio do caminho é justamente o que pode derrubá-la. É a
  //      armadilha nº 9 do HANDOFF ("a permissão só pode ser pedida dentro de um
  //      toque"), que eu reabri sozinho.
  //   2. Com o estado lido como `denied`, o código NEM TENTAVA. E o estado
  //      guardado erra: em WebView e em atalho instalado ele responde por outra
  //      via que nem sempre é a que vale, então "denied" ali pode ser um "não"
  //      velho enquanto a pergunta ainda apareceria de verdade.
  //
  // Agora é o contrário, e é a ordem certa: PEDE — e a pergunta aparece sempre
  // que ainda for possível aparecer. O estado só é consultado DEPOIS, e só pra
  // explicar uma recusa que já aconteceu. Consultar não conserta nada; pedir,
  // sim.
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
