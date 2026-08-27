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
 * Quantos microfones o sistema está ENTREGANDO para o navegador.
 *
 * ------------------------------------------------------------- por que importa
 *
 * Este é o dado que separa as três coisas que davam a mesma mensagem, e que
 * eu vinha tratando como uma só. O dono disse a frase que resolve: **"testei em
 * outros navegadores"**. Permissão de site é guardada por navegador — se falha
 * em mais de um, não é permissão de site. Só sobra o que é comum aos dois: o
 * APARELHO.
 *
 * `enumerateDevices()` responde isso sem pedir nada a ninguém:
 *
 * | audioinput | o que significa |
 * |---|---|
 * | 0 | o Android não está entregando microfone NENHUM ao navegador — chave geral do aparelho desligada, ou o navegador sem a permissão de app |
 * | 1+ sem nome | existe microfone, e o site é que não tem permissão (o nome só aparece depois do "permitir") |
 * | 1+ com nome | já está liberado |
 *
 * Sem esta medida, "bloqueado para este endereço" era um chute — e foi um chute
 * errado, que mandou o dono procurar uma tela de permissões que o Samsung
 * Internet nem tem no cadeado.
 */
export async function entradasDeAudio() {
  try {
    const lista = await navigator.mediaDevices.enumerateDevices()
    const audio = lista.filter((d) => d.kind === 'audioinput')
    return { total: audio.length, comNome: audio.filter((d) => d.label).length }
  } catch {
    return { total: -1, comNome: -1 }
  }
}

/**
 * O caminho de volta, em passos, para o aparelho em que estamos.
 *
 * Escrito como quem explica para alguém com o celular na mão: onde tocar, com
 * que nome a coisa aparece na tela. Sem "verifique as configurações".
 */
export function comoLiberar(onde = ondeRoda(), tipo = 'site') {
  // -------------------------------------------------- A CHAVE GERAL DO APARELHO
  //
  // Isto é o que faltava, e é o que explica "testei em outros navegadores".
  //
  // O Android (12+, e a One UI da Samsung com mais destaque ainda) tem um
  // interruptor de "Acesso ao microfone" que vale pro APARELHO INTEIRO. Com ele
  // desligado, nenhum app e nenhum navegador conseguem gravar — e não existe
  // nada em ajuste de site que resolva, porque não é permissão de site. O sinal
  // dele é um **ícone de microfone cortado na barra de status**, que fica lá o
  // tempo todo.
  //
  // Nesse estado o navegador ainda devolve `NotAllowedError`, o MESMO erro de
  // um site bloqueado. Foi por isso que o diagnóstico anterior apontou o lugar
  // errado com toda a confiança do mundo.
  // ---------------------------- O ATALHO INSTALADO NÃO TEM MICROFONE PRA DAR
  //
  // Este é o caso que os prints de 27/08 fecharam, e ele não é "permissão
  // negada" — é permissão que NÃO EXISTE.
  //
  // Quando o Chrome instala um app na tela de início, ele não cria um atalho:
  // ele gera um aplicativo Android de verdade (WebAPK), com um manifesto
  // próprio de permissões. E o microfone só pode ser concedido a um aplicativo
  // que o DECLARE. O WebAPK gerado aqui declarou só notificações.
  //
  // A tela de "Permissões do app" do bichinho de coração prova isso melhor do
  // que qualquer erro de JavaScript:
  //
  //     Com permissão:   Notificações
  //     Sem permissão:   Nenhuma permissão negada
  //
  // Não há Microfone em lugar nenhum da lista. Nada foi negado — não há o que
  // permitir. E como o Chrome, para um app instalado, DELEGA o microfone à
  // permissão do aplicativo, o pedido morre antes de virar pergunta: sem
  // pergunta, sem erro visível, e sem nenhum ajuste que resolva. Foi
  // exatamente isso que o dono viveu por três rodadas.
  //
  // O navegador comum não tem esse problema: o print do Chrome mostra Câmera,
  // Localização, Microfone e Notificações todos concedidos. É por lá que dá.
  // ------------------ ATALHO INSTALADO, MICROFONE EXISTE, MAS O SITE ESTÁ NEGADO
  //
  // Este caso veio da linha de diagnóstico do próprio dono:
  //
  //     NotAllowedError · permissão: denied · microfones: 1 · atalho
  //
  // `microfones: 1` derruba as duas hipóteses "de baixo": o sistema ESTÁ
  // entregando microfone, então não é a chave geral do aparelho nem a permissão
  // do aplicativo. O que está negado é a permissão **do site** — e ela mora no
  // perfil do Chrome, por origem.
  //
  // E aqui está o nó: o atalho instalado usa o perfil do Chrome, mas **não tem
  // barra de endereço**, logo não tem cadeado nem menu de site. Mandar pra
  // "Ajustes → Apps → Nosso app → Permissões" (o que esta função fazia antes)
  // é mandar pra lista que o dono já fotografou e que **não tem Microfone**:
  // um WebAPK só lista o que declarou, e microfone não estava lá.
  //
  // O caminho que existe de verdade é desfazer o "não" no Chrome. Como o atalho
  // e o Chrome compartilham o mesmo perfil e a mesma origem, liberar lá vale
  // aqui dentro também.
  if (tipo === 'site-negado') {
    // ------------------------------------------ SEM PALPITE SOBRE ONDE ELE ESTÁ
    //
    // A versão anterior escolhia o texto pelo `display-mode: standalone` e
    // abria com "Ajustes → Apps → Nosso app". O dono respondeu: "essa instrução
    // do Nosso app nem faz sentido, tô abrindo direto no navegador, não está
    // instalado". E ele tem razão duas vezes: a detecção pode errar (vários
    // navegadores Android respondem `standalone` fora de um app instalado), e
    // mesmo acertando, aquela lista **não tem Microfone** — um WebAPK só lista
    // o que declarou.
    //
    // O que foi MEDIDO, e não deduzido, é o suficiente: existe microfone no
    // aparelho e a permissão deste endereço está negada. Isso é permissão de
    // SITE, guardada pelo navegador. Então o texto fala só disso, e serve nos
    // dois casos — aba normal ou atalho — sem afirmar em qual deles a pessoa
    // está.
    const passos = []
    if (onde.navegador === 'Samsung Internet') {
      passos.push('No Samsung Internet o cadeado NÃO tem permissões (só conexão, rastreadores e cookies).')
      passos.push('Menu ☰ → Configurações → "Sites e downloads" → "Permissões de site" → Microfone → acha este endereço e marca "Permitir".')
    } else {
      passos.push('Toca no cadeado 🔒 ao lado do endereço → "Permissões" → Microfone → "Perguntar". Se aparecer "Redefinir permissões", serve e é mais rápido.')
      passos.push('Se não houver nada disso no cadeado: menu ⋮ → Configurações → "Configurações do site" → Microfone → acha este endereço e marca "Permitir".')
    }
    passos.push('Se você abriu por um atalho da tela de início, ele não tem barra de endereço: usa o botão "Abrir no Chrome" aqui embaixo — é o mesmo endereço e a mesma permissão.')
    passos.push('Recarrega a página e toca em "Liberar o microfone". A pergunta volta a aparecer.')
    return passos
  }

  // ---------------------------- O ATALHO INSTALADO NÃO TEM MICROFONE PRA DAR
  //
  // Este é o caso que os prints de 27/08 fecharam, e ele não é "permissão
  // negada" — é permissão que NÃO EXISTE.
  //
  // Quando o Chrome instala um app na tela de início, ele não cria um atalho:
  // ele gera um aplicativo Android de verdade (WebAPK), com um manifesto
  // próprio de permissões. E o microfone só pode ser concedido a um aplicativo
  // que o DECLARE. O WebAPK gerado aqui declarou só notificações.
  //
  // A tela de "Permissões do app" do bichinho de coração prova isso melhor do
  // que qualquer erro de JavaScript:
  //
  //     Com permissão:   Notificações
  //     Sem permissão:   Nenhuma permissão negada
  //
  // Não há Microfone em lugar nenhum da lista. Nada foi negado — não há o que
  // permitir. E como o Chrome, para um app instalado, DELEGA o microfone à
  // permissão do aplicativo, o pedido morre antes de virar pergunta: sem
  // pergunta, sem erro visível, e sem nenhum ajuste que resolva. Foi
  // exatamente isso que o dono viveu por três rodadas.
  //
  // O navegador comum não tem esse problema: o print do Chrome mostra Câmera,
  // Localização, Microfone e Notificações todos concedidos. É por lá que dá.
  // ------------------ ATALHO INSTALADO, MICROFONE EXISTE, MAS O SITE ESTÁ NEGADO
  //
  // Este caso veio da linha de diagnóstico do próprio dono:
  //
  //     NotAllowedError · permissão: denied · microfones: 1 · atalho
  //
  // `microfones: 1` derruba as duas hipóteses "de baixo": o sistema ESTÁ
  // entregando microfone, então não é a chave geral do aparelho nem a permissão
  // do aplicativo. O que está negado é a permissão **do site** — e ela mora no
  // perfil do Chrome, por origem.
  //
  // E aqui está o nó: o atalho instalado usa o perfil do Chrome, mas **não tem
  // barra de endereço**, logo não tem cadeado nem menu de site. Mandar pra
  // "Ajustes → Apps → Nosso app → Permissões" (o que esta função fazia antes)
  // é mandar pra lista que o dono já fotografou e que **não tem Microfone**:
  // um WebAPK só lista o que declarou, e microfone não estava lá.
  //
  // O caminho que existe de verdade é desfazer o "não" no Chrome. Como o atalho
  // e o Chrome compartilham o mesmo perfil e a mesma origem, liberar lá vale
  // aqui dentro também.
  if (tipo === 'atalho-site-negado') {
    return [
      'O "não" é do SITE, e não do aplicativo — por isso não adianta procurar Microfone em Ajustes → Apps (o atalho não tem essa permissão na lista).',
      'Toca em "Abrir no Chrome" logo abaixo: é o mesmo endereço, no navegador, onde existe barra de endereço.',
      'Lá, toca no cadeado 🔒 ao lado do endereço → "Permissões" → "Redefinir permissões". Se preferir: menu ⋮ → Configurações → Configurações do site → Microfone → acha este endereço e marca "Permitir".',
      'Ainda no Chrome, toca em "Liberar o microfone" e responde "Permitir" na pergunta.',
      'Pronto: o atalho usa o mesmo perfil do Chrome, então ele passa a gravar também.',
    ]
  }

  if (tipo === 'atalho-sem-microfone') {
    return [
      'Não é permissão negada: o atalho instalado NÃO TEM microfone na lista dele pra dar.',
      'Dá pra conferir: Ajustes → Apps → "Nos" → Permissões. Só aparece Notificações, e embaixo "Nenhuma permissão negada".',
      'Quem instala o atalho é o Chrome, e ele só pede as permissões que o app declarou na hora de instalar — microfone não estava lá.',
      'O caminho que funciona hoje é abrir o mesmo endereço no Chrome (o botão logo abaixo faz isso). O Chrome já tem microfone: dá pra ver em Ajustes → Apps → Chrome → Permissões.',
    ]
  }

  if (tipo === 'geral') {
    return [
      'Olha a barra de status do celular: se tiver um ícone de microfone CORTADO, é isto.',
      'Puxa a barra de cima e procura o botão "Acesso ao microfone" — se estiver desligado, liga.',
      'Ou: Ajustes → Segurança e privacidade → Controles de privacidade → Acesso ao microfone.',
      'Essa chave vale pro aparelho inteiro: enquanto estiver desligada, NENHUM app e nenhum navegador gravam, e ajuste de site não resolve.',
      'Depois volta aqui e toca em "Liberar o microfone".',
    ]
  }

  // ------------------------------------------- A PERMISSÃO DO APP DO NAVEGADOR
  //
  // O segundo andar, e o segundo que atravessa navegador: o Samsung Internet e
  // o Chrome são dois aplicativos Android, cada um com a própria permissão de
  // microfone. Um site só consegue o microfone se o navegador dele tiver.
  if (tipo === 'app') {
    const app = onde.apk ? 'Nosso app' : onde.navegador
    return [
      `Ajustes do Android → Apps (ou "Aplicativos") → ${app} → Permissões → Microfone.`,
      'Marca "Permitir". É a MESMA lista onde ficam a câmera e as notificações.',
      'Esta é a permissão do aplicativo, e vale pra todos os sites que ele abre — é diferente da permissão do site.',
      'Volta e toca em "Liberar o microfone".',
    ]
  }

  if (onde.apk) {
    return [
      'Sai do app.',
      'Ajustes do Android → Apps → Nosso app → Permissões → Microfone.',
      'Marca "Permitir".',
      'Abre o app de novo e toca em "Liberar o microfone".',
    ]
  }
  if (onde.iOS) {
    return [
      'Ajustes do iPhone → Safari → Microfone.',
      'Deixa este site em "Perguntar" (ou "Permitir").',
      'Fecha o app de vez e abre de novo — o atalho da tela de início só relê isso ao reabrir.',
      'Toca em "Liberar o microfone" e responde "Permitir".',
    ]
  }
  if (onde.instalado && onde.android) {
    // O atalho instalado no Android vira aplicativo (WebAPK), e o Chrome delega
    // microfone, câmera e localização às permissões do APLICATIVO. Além de não
    // existir barra de endereço ali pra ter cadeado.
    return [
      'Ajustes do Android → Apps (ou "Aplicativos") → Nosso app → Permissões.',
      'É a MESMA lista onde ficam a câmera e as notificações. Toca em Microfone e marca "Permitir".',
      'O atalho não tem barra de endereço, então não existe cadeado pra tocar: é por aqui mesmo.',
      'Volta pelo atalho e toca em "Liberar o microfone".',
    ]
  }
  // O caminho do SITE, por navegador — e ele é diferente em cada um.
  //
  // A versão anterior mandava "toca no cadeado → Permissões" pra todo mundo.
  // No Samsung Internet o cadeado abre "Informações de privacidade", que mostra
  // conexão, rastreadores e cookies — e **não tem permissões**. Mandar alguém
  // pra uma tela que não existe é pior do que não dizer nada.
  if (onde.navegador === 'Samsung Internet') {
    return [
      'O cadeado do Samsung Internet NÃO tem permissões (só conexão, rastreadores e cookies) — não é por lá.',
      'Menu ☰ (as três barras embaixo à direita) → Configurações.',
      '"Sites e downloads" → "Permissões de site" → Microfone.',
      'Acha nossoamor.209.50.229.119.sslip.io e marca "Permitir". Se ele não estiver na lista, a trava não é do site — é a chave geral ou a permissão do app.',
    ]
  }
  if (onde.navegador === 'Chrome') {
    return [
      'Menu ⋮ → Configurações → "Configurações do site" → Microfone.',
      'Acha nossoamor.209.50.229.119.sslip.io na lista e troca para "Permitir".',
      'Pelo cadeado 🔒 também dá: Permissões → Microfone (ou "Redefinir permissões").',
      'Recarrega a página e toca em "Liberar o microfone".',
    ]
  }
  return [
    `No ${onde.navegador}, abre as configurações do navegador e procura "Permissões de site" → Microfone.`,
    'Acha nossoamor.209.50.229.119.sslip.io e permite.',
    'Pelo cadeado 🔒 ao lado do endereço também costuma dar, quando esse navegador oferece permissões por lá.',
    'Recarrega a página e toca em "Liberar o microfone".',
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
    return { ok: true, bloqueado: false, erro: '', motivo: '', passos: [], stream }
  } catch (err) {
    const nome = err?.name || 'erro'

    // ------------------------------------------------- DE QUAL ANDAR É A TRAVA
    //
    // `NotAllowedError` sai igualzinho de três coisas bem diferentes, e a versão
    // anterior chamava as três de "bloqueado para este endereço" — com toda a
    // confiança, e errado. Mandou o dono procurar permissões numa tela do
    // Samsung Internet que nem tem permissões.
    //
    // O que separa é quantos microfones o SISTEMA entrega ao navegador. Nenhum
    // significa que a trava está abaixo do site: ou a chave geral do aparelho,
    // ou a permissão de app do navegador. As duas atravessam navegador — que é
    // exatamente o que o dono observou ao testar em mais de um.
    const entradas = await entradasDeAudio()
    // UMA LINHA COM TUDO O QUE IMPORTA.
    //
    // Três rodadas seguidas eu respondi "não envia áudio" com palpite, porque
    // três palavras é o que chegava até mim. Esta linha vai junto de toda recusa
    // — no chat, onde a pessoa está quando o problema acontece — e uma foto da
    // tela passa a dizer qual das causas é, sem ninguém ter que navegar até o
    // diagnóstico do Perfil.
    const estado = await estadoDoMicrofone()
    // O navegador aparece SEMPRE, e o modo vai entre parênteses. Antes um
    // escondia o outro: a linha dizia só "atalho", e o dono — que estava numa
    // aba normal — leu uma afirmação errada sobre o próprio aparelho.
    const resumo = `${nome} · permissão: ${estado} · microfones: ${entradas.total}`
      + ` · ${onde.navegador}${onde.apk ? ' (APK)' : onde.instalado ? ' (modo app)' : ''}`

    // A ORDEM IMPORTA: o atalho instalado vem antes da chave geral.
    //
    // Os dois dão zero entrada de áudio, e por isso a rodada anterior apontou a
    // chave geral do aparelho — que estava LIGADA o tempo todo. O que separa é
    // que aqui o app está rodando como aplicativo instalado, e nesse caso o
    // microfone é delegado à permissão do aplicativo, que o WebAPK não tem nem
    // como ter. Conferir isso antes evita mandar mexer numa chave que não é a
    // culpada.
    if (entradas.total === 0 && onde.instalado && onde.android && !onde.apk) {
      return {
        ok: false,
        bloqueado: true,
        erro: nome,
        resumo,
        abrirNoChrome: true,
        motivo: 'O atalho instalado na tela de início não tem permissão de microfone — e não é que foi negada: ela não existe na lista dele.',
        passos: comoLiberar(onde, 'atalho-sem-microfone'),
        depois: comoLiberar({ ...onde, instalado: false, navegador: 'Chrome' }, 'site'),
        tituloDepois: 'Já no Chrome, se mesmo assim não perguntar, é a permissão do site:',
      }
    }

    if (entradas.total === 0) {
      return {
        ok: false,
        bloqueado: true,
        erro: nome,
        resumo,
        motivo: 'O aparelho não está entregando NENHUM microfone para o navegador. Isso não é permissão deste site — é a chave geral do microfone do Android, ou a permissão do próprio navegador. Por isso falha em todos os navegadores:',
        passos: comoLiberar(onde, 'geral'),
        depois: comoLiberar(onde, 'app'),
        tituloDepois: 'Se a chave geral já estiver ligada, é a permissão do navegador:',
      }
    }

    if (nome === 'NotAllowedError' || nome === 'SecurityError') {
      // O estado guardado é o que separa "fechou a pergunta" de "está
      // bloqueado": o erro é o MESMO nos dois casos. Ele já foi lido acima,
      // junto com o resumo — perguntar de novo seria uma segunda fonte pro
      // mesmo fato, e num arquivo que existe justamente pra acabar com isso.
      if (estado === 'denied') {
        // Dentro do atalho instalado não existe barra de endereço, e a permissão
        // negada é a do SITE — que se desfaz no Chrome, não em Ajustes → Apps.
        return {
          ok: false,
          bloqueado: true,
          erro: nome,
          resumo,
          // O botão de sair pro Chrome vale aqui de qualquer jeito: se for
          // atalho, é o único caminho até os ajustes; se já for navegador, não
          // atrapalha ninguém.
          abrirNoChrome: true,
          motivo: 'Existe microfone no aparelho (o diagnóstico achou 1) — então não é a chave geral nem a permissão do navegador. O que está negado é a permissão DESTE ENDEREÇO, e enquanto estiver assim ele não pergunta de novo:',
          passos: comoLiberar(onde, 'site-negado'),
        }
      }
      return {
        ok: false,
        bloqueado: false,
        erro: nome,
        resumo,
        motivo: 'A pergunta do microfone foi fechada sem resposta. Toca de novo e responde "Permitir" — fechando algumas vezes seguidas, o navegador para de perguntar e aí só nos ajustes.',
        passos: [],
      }
    }

    const tabela = {
      NotFoundError: 'Não encontrei microfone neste aparelho.',
      DevicesNotFoundError: 'Não encontrei microfone neste aparelho.',
      NotReadableError: 'O microfone existe mas ninguém conseguiu abrir: ou outro app está com ele (ligação, gravador), ou a chave geral do microfone do aparelho está desligada.',
      TrackStartError: 'O microfone existe mas ninguém conseguiu abrir: ou outro app está com ele, ou a chave geral do microfone do aparelho está desligada.',
      AbortError: 'O aparelho interrompeu o pedido do microfone.',
      OverconstrainedError: 'Este aparelho não tem um microfone que sirva.',
    }
    const geral = nome === 'NotReadableError' || nome === 'TrackStartError'
    return {
      ok: false,
      bloqueado: false,
      erro: nome,
      resumo,
      motivo: tabela[nome] || `Não consegui acessar o microfone (${nome}).`,
      passos: geral ? comoLiberar(onde, 'geral') : [],
    }
  }
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
 * O endereço desta mesma página, escrito para o Android abrir NO CHROME.
 *
 * `target="_blank"` de dentro de um app instalado não serve: o link está no
 * escopo do próprio app, então ele abre ali mesmo — no lugar exato de onde a
 * pessoa precisa sair. O `intent:` do Android resolve nomeando o pacote do
 * Chrome, e é o que transforma quatro passos de instrução num toque.
 *
 * Se o Chrome não estiver instalado, o link simplesmente não vai a lugar
 * nenhum; por isso a tela sempre oferece "copiar o link" do lado.
 */
export function linkParaOChrome(url = location.href) {
  const semEsquema = url.replace(/^https?:\/\//, '')
  return `intent://${semEsquema}#Intent;scheme=https;package=com.android.chrome;end`
}
