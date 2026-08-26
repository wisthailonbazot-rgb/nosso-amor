# Backlog do App do Casal

Lista viva. Cada pedido novo entra aqui na hora, com data, pra nada se perder entre
uma conversa e outra. O documento de escopo original está em
[docs/projeto-app-casal.md](docs/projeto-app-casal.md); este arquivo é o que manda
quando os dois discordam.

Legenda: **[ ]** a fazer · **[~]** em andamento · **[x]** pronto e testado

---

## Decisões travadas (não mexer sem conversar)

| Decisão | O que ficou | Por quê |
|---|---|---|
| Backend | FastAPI + PostgreSQL na VPS, **com limite de memória fixo** | A VPS tem 2,1 GB livres e zero swap; o Supabase self-hosted (~2 GB) engoliria a folga e o kernel mataria o app da barbearia. O limite garante que um vazamento aqui não derruba nada de lá. |
| Tempo real | WebSocket próprio do FastAPI | Sem Redis, sem broker, sem container extra. Exige **1 worker** — está comentado em `realtime.py`. |
| App | React + Vite, PWA instalável (e APK por Capacitor depois) | Resolve o iPhone dela sem AltStore, sem PC ligado e sem expirar em 7 dias. |
| Notificação | Web Push (VAPID), iOS 16.4+ pela Tela de Início | Push de verdade nos dois aparelhos, custo zero, sem conta Apple. |
| Arte da interface | Direção A — "livro de histórias" (papel recortado, grão, contorno desenhado) | Escolhida em 23/08 sobre o visual genérico anterior. |
| Arte dos cenários | Pixel art **isométrico 2.5D**, resolução alta (1 pixel de arte = 1 px de CSS) | Escolhida em 23/08. Motor próprio em `web/src/render/`. |
| Datas | Dia de calendário é sempre texto `YYYY-MM-DD`, nos dois lados | Erro que já custou caro em outro projeto: DATE virando instante e voltando um dia. Ver `clock.py` e `lib/dates.js`. |
| Moedas | Nada mexe em `wallets.balance` direto; tudo passa por `economy.earn/spend` com `dedupe_key` | O índice único do banco é o que impede moeda dobrada — não um `if`, que perde a corrida no toque duplo. |

---

## Pedidos do dono (em ordem de chegada)

- **[x]** 23/08 — Backend na VPS que funcione **sem afetar os outros projetos**
- **[~]** 23/08 — Notificações funcionando no **iPhone 12 dela**, sem pagar nada
  - [x] Encanamento (VAPID, service worker, assinatura, tela de diagnóstico)
  - [ ] **Confirmar no aparelho dela** — a tela de diagnóstico do Perfil diz em
        português qual das três condições do iOS falhou, se falhar
- **[~]** 23/08 — Design melhor: "muito cara de IA", quer **fofo e cheio de detalhe**
  - [x] Duas direções construídas e escolhida a mistura (interface A + cenário pixel)
  - [x] Tema novo aplicado: papel com grão, cartão torto com fita, contorno
        desenhado, botão que afunda, fonte própria (self-hosted)
  - [x] Emoji trocado por ícones desenhados (era o que mais entregava "cara de IA")
  - [ ] Telas que ainda são placeholder (ciclo, chat, jogos, bichinho, momentos,
        datas) — entram nas Etapas 3 a 5
- **[x]** 23/08 — Cenários: **isométrico 2.5D**, com bastante pixel (nada de chunky)
  - motor próprio com rasterização por varredura (borda dura, sem suavizar);
    tile de 48×24, então cada móvel tem 2,25× mais pixel que no primeiro teste
- **[x]** 23/08 — Ciclo baseado em **documentos e estudos médicos reais**, com a
      fonte citada dentro do app. Nada de número de precisão inventado.
  - 5 fontes com link dentro do app (ACOG 651, Bull 2019, Wilcox 1995 e 2000, FIGO 2018)
  - a fase lútea usa 13 dias (média medida de 12,4 — Bull 2019), **não** os 14 do
    ensino clássico; janela fértil de 6 dias terminando na ovulação (Wilcox 1995)
  - aviso fixo de que **não é método anticoncepcional** (Wilcox 2000)
- **[~]** 23/08 — **Testes minuciosos de cada parte**, inclusive progressão e dinheiro
  - [x] 295 verificações passando, incluindo 60 dias de progressão simulada e a
        conferência do cálculo do ciclo contra os números da literatura
  - [x] Bancada `/lab`: confere sozinha se toda peça de arte desenha algo
  - [ ] Blocos das Etapas 3 a 5, conforme forem sendo construídas
- **[ ]** 23/08 — **Móveis e cenários personalizáveis**, loja pra comprar novos e
      **progressão de verdade**. Mesma coisa pra **avatares** e **bichinhos**.
- **[x]** 23/08 — Manter este backlog atualizado a cada pedido
- **[x]** 23/08 — Criar HANDOFF com o mapa do projeto, pra continuar em outro chat
- **[x]** 23/08 — Prompt pronto pra retomar noutro chat → `PROMPT-CONTINUAR.md`

### 23/08 — Ampliação do escopo (pedido do dono)

- **[x]** **Chat com cara de WhatsApp**: estrutura de conversa parecida, com
      **figurinhas** (como no Love8) e **envio de áudio**
  - 18 figurinhas desenhadas em pixel, bolhas, resposta citada, reação, apagar,
      "digitando…", visto ✓✓, divisória de dia, gravador de áudio com onda
- **[x]** **Bichinho tem que dar trabalho de verdade**: sujar, precisar de cuidado,
      e **sujar a casa** quando é deixado de lado — não pode ser um botão de carinho
      sem consequência
- **[x]** **Várias espécies de bichinho** pra escolher — seis, com ritmo próprio
- **[x]** **Casa com mais de um cômodo**, tudo personalizável
- **[x]** **Terreno em volta da casa** e a **rua na frente**, também construídos
- **[ ]** **PRÓXIMO PASSO — mapa 2,5D do bairro**: uma rua onde dá pra andar e
      **entrar em lugares**, incluindo um **mercado onde se compra ração** e os
      outros itens. A loja deixa de ser uma lista e vira um lugar.

> Estes seis mudam o formato do jogo: ele deixa de ser "telas separadas" e vira um
> mundinho. Cinco estão de pé; falta **o mapa do bairro**, que é a parte pesada —
> está anotada no HANDOFF, seção 8, com o caminho técnico pensado.

---

## Etapa 1 — Infraestrutura e base · **pronta**

- [x] Estrutura do projeto (`backend/`, `web/`, `docs/`)
- [x] Banco completo: 25 tabelas, criadas de uma vez
- [x] Migração leve (coluna nova em tabela existente, sem quebrar deploy)
- [x] Semente idempotente (não duplica, **não reseta senha trocada no app**)
- [x] Login dos dois usuários fixos, sessão longa, troca de senha derruba sessão antiga
- [x] Trava de força bruta por login e por IP
- [x] Token de mídia separado do token de sessão
- [x] WebSocket com presença e reconexão em espera crescente
- [x] Web Push: assinatura, envio, limpeza de aparelho morto, tela de diagnóstico
- [x] Casca do app com as 8 seções navegáveis
- [x] Teste de fumaça: 44 verificações, 0 falha

## Etapa 2 — Identidade e economia · **pronta**

- [x] Carteira com extrato e auditoria (saldo tem que bater com a soma das linhas)
- [x] Check-in diário com sequência (bônus por dia, com teto)
- [x] Tarefas: única/diária/semanal, com chave de período e desfazer que devolve moeda
- [x] Loja unificada (abas pet / avatar / casa) com compra e inventário
- [x] Roupa é individual; móvel e item de bichinho são do casal
- [x] Avatar: 8 camadas, editor com 48 peças e **validação de posse no servidor**
      (esconder o botão não é segurança — o servidor recusa vestir o que não é seu)
- [x] Miniatura da loja mostra a roupa **vestida no seu boneco**, não pendurada
- [x] Telas na direção de arte nova (início, loja, tarefas, avatar, perfil, mais)
- [x] Bateria de economia e progressão: 135 verificações, 0 falha

## Etapa 3 — Ciclo e casal · **pronta**

- [x] Ciclo: registro, calendário, previsão **com base clínica citada**, visão do parceiro
- [x] Privacidade do ciclo configurável por ela (resumo / completo / nada), testada
      dos dois lados — o que ele vê e o que ele **não** vê
- [x] Toques de saudade (6 tipos, com chuva de figurinha na tela do outro)
- [x] Contador de dias + datas importantes com contagem regressiva e "faz N anos"
- [x] Mural de momentos com foto, legenda, data e reação
- [x] Chat com estrutura de WhatsApp: texto, emoji, foto, **figurinhas**, **áudio**,
      confirmação de leitura, push
- [x] Bateria: 295 verificações no total, 0 falha

## Etapa 4 — Pet e casa

- **[x]** 23/08/2026 — Refazer as figurinhas do chat e os cutucões usando como
      referência a imagem enviada (`WhatsApp Image 2026-08-23 at 16.35.16.jpeg`):
      saudades, vem pra cá, beijo, toma amor, grudinho, menstruação, amo você,
      cafuné, abraço, amor seguro/protegido, comemoração, “acabei”, sono a dois,
      mordida, meu dia e foi mal. Manter a linguagem visual própria do app e não usar
      emoji do sistema como arte final.
- **[x]** 23/08/2026 — Revisão completa após validação do dono: trocar o fundo preto
      e o fundo azul vazio por cenário animado; impedir duplicação infinita de móveis;
      usar exatamente o mesmo bichinho, com arte melhor, na tela própria e na casa;
      permitir interação com ele dentro do cômodo; completar as artes de pisos e
      paredes na loja; incluir na loja a área de escolha/adoção de espécies; refazer
      a vista externa para começar como uma casa de um cômodo e crescer visualmente
      conforme os cômodos forem desbloqueados, sem os blocos atuais; dar mobília
      básica inicial. Reiniciar somente os dados locais do app e entregar 1.000
      Corações para cada integrante, para a experiência começar do zero.
- **[x]** 23/08/2026 — Criar identidade sonora para as partes do jogo e sons dos
      animais, usando uma solução que funcione no Safari/iPhone e Android e respeite
      a exigência de primeiro toque dos navegadores móveis.
- **[x]** 23/08/2026 — Melhorar o pacote de figurinhas do chat e acrescentar
      figurinhas de casal mais ousadas/sugestivas, mantendo a arte fofa e sem nudez
      explícita.
- **[x]** 23/08/2026 — Substituir o minigame simples atual por um jogo do bichinho
      mais completo e agradável; testar junto com todas as correções desta revisão.

- **[~]** 23/08/2026 — Retomada autorizada: concluir a Etapa 4 parte por parte,
      mantendo smoke test, validação no navegador e prints das telas alteradas
- **[x]** 23/08/2026 — Fechar **toda** a Etapa 4: caprichar mais no desenho dos
      bichinhos; corrigir o chat que só recebe mensagem depois de atualizar; terminar
      casa/editor/terreno/rua; criar apenas **um jogo simples para brincar com o
      bichinho**. Os outros jogos ficam para depois, registrados no HANDOFF junto do
      próximo passo grande do mapa do bairro. Conferir também bugs encontrados no
      caminho, sem considerar nada pronto sem teste e print.
- **[x]** 23/08/2026 — Vários objetos da loja ainda não têm arte criada: auditar
      catálogo × renderizadores, desenhar todos os faltantes e travar isso em teste.
      Conferir e completar também as tarefas no fechamento desta etapa.
- **[x]** 23/08/2026 — Validar no navegador o ciclo completo do editor da casa
      (adicionar, mover, girar, salvar e recarregar) e colocar o bichinho dentro da
      casa, interagindo visualmente e mecanicamente com o cômodo e seus objetos.

- [x] Pet: **várias espécies** pra escolher no começo — seis espécies com ritmo
      próprio, escolha permanente, testada na base visual isolada
- [x] Pet: decaimento por tempo, alimentar/brincar/banhar, evolução por nível —
      tela completa, prazos visíveis, itens e descansos ligados ao backend
- [x] Pet: **suja e dá trabalho** — e **suja a casa** quando é esquecido — sujeira
      ocupa célula real e pode ser limpa na tela; bateria de abandono e recuperação
      passando
- [x] Casa: **vários cômodos**, editor isométrico, arrastar, girar, tempo real
- [x] Casa: **terreno em volta** (quintal, muro, calçada) e a **rua na frente**
- [x] Desbloqueio de cômodos por progressão
- [x] Chat: corrigido recebimento em tempo real — `publish()` era chamado da worker
      thread e descartava o evento; agora agenda no loop dono do WebSocket
- [x] Loja: 30/30 móveis com arte; smoke cruza catálogo Python com `SHAPES` JS

### 23/08/2026 — fechamento da Etapa 4: o que a revisão final encontrou

Três defeitos reais que a bateria e a bancada pegaram, com a causa corrigida:

- [x] **Cenário aparecia vazio em aba que o navegador não está compondo.** Todo
      canvas só desenhava dentro de `requestAnimationFrame`, e aba em segundo
      plano (ou celular com a tela travada) simplesmente não recebe quadro. Quem
      voltava pro app via um retângulo em branco. Agora `RoomCanvas`, `PetCanvas`
      e `PropertyCanvas` pintam **um quadro na hora**, antes de pedir animação.
- [x] **Três ícones usados nas telas novas não existiam** (`drop`, `sparkle`,
      `lock`). `Icon` devolve `null` para nome desconhecido, então eles sumiam
      calados — justamente nas barras de atributo do bichinho. Desenhados, e a
      conferência "todo `name=` usado tem desenho" ficou registrada.
- [x] **A casa mentia sobre o bichinho:** dizia "tirando uma soneca na caminha"
      com ele doente e doze sujeiras no chão. A legenda agora sai do estado real
      (doente / faminto / imundo / triste / casa suja) antes do móvel favorito.
- [x] Bancada `/lab` ganhou as abas **Bichinhos** (6 espécies × 3 estágios) e
      **Humores** (4 humores + 4 acessórios vestidos) — antes o bichinho era a
      única arte do app que ninguém conferia sozinho.

## Etapa 5 — Minigames

- [x] Um jogo simples de brincar com o bichinho: **Pega a bolinha**, com energia,
      alegria, XP, pontuação limitada e descanso de dois minutos
- [ ] Velha · forca colaborativa · quiz "quem conhece melhor" · memória · damas —
      **adiados por decisão de 23/08/2026**, depois da casa e do mapa do bairro
- [ ] Truco/UNO simplificado (por último)

## Etapa 6 — O bairro e o acabamento

- **[x]** 23/08/2026 — Criar configuração inicial e edição posterior do casal:
      montar os dois perfis/personagens, nomes e data de início do relacionamento,
      com persistência, validação e experiência guiada no primeiro acesso.
- **[x]** 23/08/2026 — Transformar tarefas em um sistema coeso de progressão conjunta:
      missões diárias aleatórias, renovação automática e geração contínua sem manutenção
      manual; ações reais do jogo devem avançar objetivos, pagar Corações uma única vez
      e alimentar progressão/metas compartilhadas do casal.
- **[x]** 23/08/2026 — O APK local não consegue autenticar fora da rede. Usar as
      credenciais corretas guardadas em `D:\beckup\arquivo env\env-coolify.txt` para
      implantar o app-casal isoladamente na VPS/Coolify, validar login e tempo real
      por HTTPS/WSS e gerar outro APK apontando para o endereço público. Não alterar
      nem interromper os demais projetos hospedados nessa VPS.
      Publicado em `https://nossoamor.209.50.229.119.sslip.io`, com PostgreSQL
      exclusivo, HTTPS/WSS, login e tempo real validados sem tocar nos outros projetos.
- **[x]** 23/08/2026 — Gerar o APK Android instalável e fechar a versão de abrir/
      instalar no iPhone como PWA, ambos usando o login existente do casal. O APK de
      teste para a rede local foi compilado, assinado e validado; a PWA local foi
      publicada. A versão final usa o servidor HTTPS público e funciona fora do Wi-Fi.
      - [x] APK Android de teste apontando para `http://192.168.1.250:8020`
      - [x] Manifesto, service worker e metadados Apple publicados localmente
      - [x] Implantar em HTTPS/WSS e recompilar o APK de produção com a URL definitiva

- [ ] **Mapa 2,5D do bairro**: rua com o avatar andando, fachadas com porta
- [ ] **Mercado** onde se compra ração — a loja vira um lugar, não uma lista
- [ ] Mais itens de loja, animações, sons
- [ ] APK Android por GitHub Actions (Capacitor)
- [ ] Backup do banco (dump agendado, fora da VPS)

---

## Pendências técnicas conhecidas

- [x] Gerar chaves VAPID de produção e guardar no Coolify (as de desenvolvimento
      estão fixas em `dev_server.py` **de propósito**, e não valem em produção)
- [ ] Definir os dois usuários de verdade (slug, nome, senha) e a data de início
- [x] Limite de memória dos containers no Coolify — é o que protege os outros projetos
- [ ] Fonte self-hosted já baixada (340 KB); conferir se compensa cortar peso


---

## 23/08/2026 — Pedidos do dono (rodada de validação no aparelho)

Tudo isto veio depois de rodar o app no iPhone e no APK. Nada aqui é considerado
pronto sem o bloco no smoke test e o print da tela.

### Notificações e tempo real
- **[ ]** **Notificação não funciona nem no Android nem no iPhone.** Diagnosticar os
      dois caminhos separadamente: PWA no iPhone (Web Push/VAPID) e APK no Android.
      Atenção: WebView do Android **não** entrega Web Push — no APK isso exige push
      nativo (Firebase/FCM), que é dependência externa. Ver a mesma lição no app do
      painel da barbearia.
- **[x]** **Cutucão chega em qualquer lugar do app.** Causa: quem ouvia o evento era
      um componente que morava DENTRO da tela de Início; trocou de aba, parou de
      chegar. Agora o ouvinte mora no casco (`AvisosAoVivo`), fora das rotas.
- **[~]** **Mensagem do parceiro como faixa no topo** — faixa clicável (leva pro chat)
      pronta e valendo em qualquer tela, menos dentro do próprio chat, onde seria
      barulho repetido. A parte de **notificação com o app fechado** depende do push,
      abaixo.

### APK (Android)
- **[x]** **Foto no APK.** Causa achada: o servidor devolve o caminho RELATIVO
      (`/media/x.jpg?token=…`), e dentro do APK isso vira `https://localhost/media/…`
      — o pacote embutido no aparelho, onde não existe foto nenhuma. Criado
      `mediaUrl()` em `api.js`; toda foto, miniatura e áudio passa por ele.
- **[x]** **Áudio no APK.** Duas causas: a mesma URL relativa acima (não tocava) e a
      falta de `RECORD_AUDIO` no `AndroidManifest.xml` (não gravava — o Android nem
      chegava a pedir permissão, falhava calado). As duas corrigidas.

### Casa
- **[x]** **Casa em abas.** Estava medindo **1.587 px de altura num visor de 918** —
      vista externa, legenda, abas de cômodo, cômodo, linha do bichinho e editor,
      tudo na mesma rolagem. Agora são duas abas ("Do lado de fora" / "Por dentro"),
      **a fachada inteira é clicável pra entrar**, e cada vista cabe na tela (812 px,
      sem rolagem lateral).

### Figurinhas
- **[x]** **Figurinhas da foto**: as 18 conferidas uma a uma na bancada. 17 já
      existiam do trabalho anterior; faltava só **"Uau"**, agora desenhada. E o
      seletor passou a mostrar o **nome embaixo de cada uma**, como na sua foto —
      sem nome, "grudinho" e "toma s2" viravam dois bonequinhos parecidos.
      Pedido original:: Saudades,
      Vem pra cá, Beijo, Toma s2, Uau, Grudadinho, Menstruação, Amo vc, Vem cá,
      Cafuné, Abraço, Amor seguro, Amor protegido, Boa!, Acabei, Sono a dois,
      Mordida, Meu dia, Foi mal. **Na nossa linguagem visual** (pixel art própria) —
      a foto é referência de assunto, não arte pra copiar: emoji de sistema é
      desenho de terceiro e já foi decidido que não entra como arte final.

### Bichinho
- **[x]** **Ele anda.** A posição vinha de uma conta feita uma vez e nunca mudava.
      Agora existe `petWander.js`: ele escolhe um lugar, caminha até lá em posição
      fracionária, para e escolha outro. Medido: **61 posições distintas em 6 s**.
      Entrou também na ordem de profundidade, senão passaria por cima do sofá.
- **[x]** **Animações de ação**: andar (poeira do passo), comer (potinho e migalhas),
      banho (espuma e bolhas subindo), brincar/feliz (pulo e coraçõezinhos) e dormir
      (respiração lenta e os "z" subindo). Tudo desenhado, nada de emoji.
- **[x]** **Mais interativo**: ele anda pelo cômodo, reage ao toque na hora e a frase
      da casa conta o estado real dele.
- **[x]** **Corrida do bichinho** (escolha do dono). Ele corre, você toca pra pular;
      pedra tira vida, ossinho vale ponto. É o mesmo `drawPet` de sempre, então o
      acessório comprado aparece no jogo. Prêmio de 12 Corações **uma vez por dia,
      por jogo**, travado por `dedupe_key` — jogar mais rende alegria, não dinheiro.

### Acrescentado no mesmo dia
- **[x]** **"Interagir" na casa.** O botão chamava direto o carinho, que tem descanso
      de 4 horas de propósito; fora dessa janela o servidor recusava com 400, a tela
      pintava erro vermelho e **nada acontecia com o bicho**. Consertado sem tirar o
      descanso: **a reação é sempre** (ele pula e solta coração), só o **prêmio** é
      que tem hora — e a recusa virou aviso honesto, não erro.
- **[x]** Jogo novo escolhido pelo dono: **corrida do bichinho** (ele corre pelo
      cenário, você toca pra pular obstáculo e pegar petisco).

> **Sobre "fazer igual ao HVAC":** conferi o `hvac-system` e ele **não tem
> notificação nenhuma** — nem Web Push, nem Firebase. As dependências de lá são
> `@capacitor/filesystem` e `@capacitor/share`, pra PDF. O que aquele projeto
> resolveu, e que **serve aqui**, é outra coisa: o **endereço do servidor cravado
> no APK**. É exatamente a causa da foto e do áudio não funcionarem aqui — então a
> estrutura do HVAC foi copiada pra esse problema. Push no Android continua
> precisando de PWA ou Firebase; a escolha ficou pendente com o dono.


### 23/08/2026 — segunda rodada (correções do dono)

- **[x]** Correção do dono: quem tem notificação funcionando é o **`bazot-app`**,
      não o `hvac-system`. Estrutura conferida lá: plugin nativo
      `@capacitor/push-notifications`, `google-services.json` do projeto Firebase
      `barberia-bazot` e `plugins.PushNotifications` no `capacitor.config.json`.
      É essa a estrutura a copiar.
- **[ ]** **Push nativo no APK do app-casal**, copiando o bazot-app.
      **Depende de duas coisas que só o dono pode gerar** (a credencial do Firebase
      é amarrada ao nome do pacote, e o do casal é `com.nossoapp.casal`, diferente
      do `com.barbeariabazot.admin`):
      1. adicionar um app Android novo ao projeto `barberia-bazot` e baixar o
         `google-services.json` do pacote `com.nossoapp.casal`;
      2. a chave de conta de serviço do mesmo projeto, pro backend conseguir
         **enviar** por FCM (o envio de hoje é Web Push/VAPID, que é outro caminho).
- **[x]** Dono confirmou: **eu mesmo gero o APK** quando terminar a correção.
- **[x]** **Figurinhas realistas, não em pixel** — do jeito da foto enviada (brilho,
      volume, traço liso). Muda a direção de arte **das figurinhas do chat**; o
      cenário isométrico continua em pixel.
      ⚠️ Os desenhos da foto são o emoji da Apple, que é arte de terceiro: não dá
      pra copiar. O que dá, e é o que foi feito, é desenhar **arte nossa no mesmo
      estilo** (redondo, com brilho e sombra), com os mesmos assuntos.
- **[x]** **Bichinho animado de verdade**: animação dele **interagindo com cada
      item que a loja vende** — comendo a ração, roendo o ossinho, correndo atrás
      da bolinha, brincando com a varinha, dormindo na almofada, tomando banho.
- **[x]** **A casa corta o cômodo na tela do celular.** Criar um jeito de
      **arrastar pra ver o cômodo inteiro** (a escala é inteira de propósito, então
      quando não cabe tem que dar pra deslocar a vista, não encolher a arte).
- **[x]** **Corrida mais difícil**: mais tipos de obstáculo e a opção de **abaixar**,
      além de pular.

**Feito nesta rodada (23/08/2026, noite):**
- 18 figurinhas realistas em SVG (rosto com degradê, brilho e sombra), com queda
  automática pras de pixel que ainda não foram convertidas.
- `petProps.js`: cada item da loja tem o SEU objeto e o SEU jeito de ser usado —
  potinho de ração baixando, biscoito sumindo em três mordidas, bolo com velinha,
  sushi com vapor, chuveiro com pingos, bolinha quicando, osso na boca com
  lasquinhas, pena da varinha dançando, almofada pra dormir e brilho de estreia
  pros acessórios. Poses novas: roer, correr, pular.
- Casa: `.room-holder` rola nos DOIS eixos, com teto de altura, e **arrastar com
  o dedo** move a vista (fora do modo de arrumar). Conferido: 53 → 0 → 53.
- Corrida: 6 tipos de coisa na pista (pedra, tronco, galho, abelha, petisco,
  ossinho), **abaixar** com toque na metade de baixo ou seta pra baixo, e o
  bichinho ACHATA (46 → 26 px) em vez de virar outro sprite.
- **APK gerado e assinado** (`releases/NossoApp-casal-android.apk`, 4,6 MB), com
  `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES` e o endereço cravado.

### 24/08/2026 — Motor de animação do bichinho e minigames em tela cheia

Pedido do dono, na íntegra: bichinhos estavam "muito simplificados"; usar um motor
melhor e fazer animações completas de todos os animais (gato e cachorro deitando,
andando, pulando; dragão e pássaro voando; coelho andando), com eles interagindo com
caminha, brinquedos e comida; criar evolução de filhote a adulto; criar interações ao
clicar na tela; pôr os minigames em tela cheia; e corrigir os controles da corrida
para arrastar na tela (arrasta pra cima pula, pra baixo abaixa).

- **[x]** **Motor novo** `web/src/render/petRig.js`: esqueleto com plano de corpo,
      clipes de pose e desenho separados em três camadas. Perna com cinemática inversa
      de dois ossos, marcha diagonal no andar, galope no correr, cauda em corrente com
      atraso, asa que bate. **22 clipes × 6 espécies = 132 combinações**, todas na
      bancada `/lab`, aba **Animações**.
- **[x]** **Animações por espécie:** deitar, dormir, sentar, andar, correr, pular,
      saltitar, comer, beber, roer, banho, brincar, coçar, rolar, implorar, cavar,
      voar e planar. Coelho e pássaro saltitam em vez de andar; só quem tem asa voa.
- **[x]** **Interação com os móveis:** `petWander.js` ganhou pontos de interesse por
      código do catálogo — ele vai até a caminha e dorme, até o pote e come, até o
      arranhador e se coça, rola no tapete, cavuca a planta. Antes o destino era
      sorteado e ele andava em linha reta pra lugar nenhum.
- **[x]** **Evolução contínua filhote → adulto:** `pet_care.growth_of()` (0 a 1) sai da
      mesma progressão do nível; o desenho interpola a PROPORÇÃO, não a escala.
      Bancada: aba **Crescimento**.
- **[x]** **Interação ao tocar:** na tela do bichinho a reação depende de onde se toca
      (cabeça / corpo / barriga); dentro do cômodo, cinco reações sorteadas.
- **[x]** **Minigames em tela cheia**, com sobreposição de CSS (a API nativa não existe
      no iPhone) e a API do Android como extra.
- **[x]** **Corrida por arrasto**: cima pula, baixo abaixa, toque seco ainda pula.
- **[x]** Correções do dono na mesma rodada: silhueta que parecia dinossauro, emendas
      nas articulações, coelho e cachorro sem orelha, e conferência dos acessórios
      (coleira, gravata, chapéu, óculos) em todas as espécies e poses — aba
      **Vestidos** na bancada.

Estado: **537 verificações, 0 falha**; build Vite aprovada; conferido no navegador
contra o app publicado. As causas de cada defeito estão no HANDOFF, seção 9.4 — vale
ler antes de mexer no motor de desenho.

### 24/08/2026 — Qualidade do sprite e arrastar item (segunda rodada)

- **[x]** **"O boneco do joguinho e na casa está com qualidade baixíssima."** Causa: o
      bichinho era desenhado em 128×108 e **encolhido** pra 50×42 (cômodo) e 54×46
      (corrida) — reduzir pixel art joga pixel fora, de cada dois e meio sobra um.
      Na tela dele, que usa a caixa cheia, estava bom; por isso o defeito só aparecia
      nesses dois lugares. Agora `drawPet` recebe uma escala e o motor desenha DIRETO
      no tamanho final (62×52 no cômodo, 68×58 na corrida). Continua sendo o mesmo
      `drawPet` — não existe um segundo sprite do bichinho.
- **[x]** **Arrastar e soltar comida e objetos no bichinho.** Eventos de ponteiro (a
      API de arrastar do HTML não dispara em toque), com folga de 8 px antes de virar
      arrasto — assim o toque simples e a rolagem da lista continuam funcionando.
      Soltar fora do bichinho não gasta item. O palco acende e diz "Solte para dar X".
- **[x]** Publicado em produção: `https://nossoamor.209.50.229.119.sslip.io` servindo
      `index-C8hTN-kh.js`, o mesmo nome gerado pelo build local.

Estado: **537 verificações, 0 falha**. Detalhes e causas no HANDOFF, seção 9.5.

### 24/08/2026 — Acertos de tela e chat estilo WhatsApp (terceira rodada)

- **[x]** **Coleira bugada.** O "eixo do pescoço" ia do peito à BASE da cabeça, e com a
      anatomia nova esse vetor ficou quase horizontal — a coleira virava uma tira em pé
      atravessando o bichinho. Agora vai até o CENTRO da cabeça, e o que pende (gravata,
      plaquinha) usa o "para baixo" do corpo, parando na linha do chão.
- **[x]** **Aproximar a vista da casa.** Botões −/+ e pinça de dois dedos, em passos
      inteiros de 1× a 4×, com o cômodo rolando. No celular a escala automática dava
      sempre 1× e o bichinho sumia no cenário.
- **[x]** **O bichinho ficava invisível no jogo, no celular.** Regressão minha: troquei o
      tamanho do canvas da corrida e esqueci de avisar o desenho, que continuou pintando
      na caixa de 128×108 — o recorte pegava só o céu. Agora a escala sai do próprio
      canvas, então os dois não têm como discordar.
- **[x]** **Barras de atributo pequenas, no canto.** Eram quatro cartões ocupando meia
      tela; viraram quatro tracinhos num HUD dentro do cenário. O prazo até zerar
      continua (no `title`, e escrito quando o atributo está baixo).
- **[x]** **A aba do bichinho usa a tela do celular.** O cenário ocupa a altura toda,
      as opções viraram uma faixa flutuante na lateral, e o bichinho passou de 1× para
      **3×**. Interação por toque (cabeça/corpo/barriga) e arrastar item seguem valendo.
- **[x]** **Chat: marcar a mensagem e responder, como no WhatsApp.** Arrastar de lado
      responde (com setinha que acende no limite); segurar marca a mensagem e abre a
      barra de ações (responder, copiar, reagir, apagar); a citação mostra quem
      escreveu. A rolagem da conversa continua ganhando do gesto.

Estado: **537 verificações, 0 falha**. Causas no HANDOFF, seção 9.6.

### 25/08/2026 — iPhone em branco, zoom, coleira, avatar dela e vários bichinhos

- **[x]** **O app web parou de funcionar no iPhone.** Causa: o `index.html` era servido
      **sem `Cache-Control`**. O aparelho guardava o HTML velho, que apontava para um
      bundle já apagado pelo deploy seguinte — o script dava 404 e a tela ficava branca.
      Corrigido em três camadas: `no-cache` no HTML e `immutable` nos assets (servidor),
      navegação com `cache: 'reload'` no service worker (destrava quem já está preso), e
      uma recuperação automática no próprio `index.html` se um asset falhar.
- **[x]** **O zoom da casa não funcionava direito.** Um clique pulava de 1× para 4× e
      travava: o contêiner que rola crescia junto com o canvas, e a conta de "quanto
      cabe na tela" media esse contêiner. Agora anda em passos e volta.
- **[x]** **A coleira ainda ficava bugada na aba bichinho.** Ela saía perpendicular a um
      eixo peito→cabeça, que é instável em quem não tem pescoço (coelho, capivara) — a
      faixa atravessava o rosto. Agora é ancorada na cabeça, abaixo do queixo.
- **[x]** **O boneco dela não parecia feminino.** O corpo era o mesmo retângulo para os
      dois. Agora existe silhueta (`reto` / `curvas`), esculpida DEPOIS da roupa — então
      todas as 48 peças acompanham a forma sem precisarem ser redesenhadas. Fica em
      Perfil → montar personagem → Base, e é de graça (não é item de loja).
- **[x]** **O sistema permite mais de um bichinho.** Cada licença de espécie da loja
      traz um bichinho novo, com nome, atributos e progressão próprios; a fila de
      retratos troca quem está na tela, de graça. Teto de 4 na casa.
      **Todos continuam vivos ao mesmo tempo** — trocar de bichinho não congela o outro,
      senão seria o jeito de escapar do cuidado. Há teste para isso.

Estado: **555 verificações, 0 falha**. Causas no HANDOFF, seção 9.7.

### 26/08/2026 — Avatar, bichinho em alta resolução, dois jogos novos e três defeitos

Pedido do dono, na íntegra: o corpo da personagem feminina ainda não é feminino;
o boneco masculino parece ter dois braços de cada lado; o bichinho tem poucos
pixels e dá pra deixar mais desenhado (conferindo se não bugava roupas etc.);
criar mais jogos — um jogo da memória com cartas de imagem, geradas por uma IA
gratuita e feitas com capricho — e um jogo de dois, cada um no seu celular,
pesquisado e bem feito, sem erros e não simples demais; o chat às vezes não
carrega as mensagens novas ao sair e entrar; as notificações ficam todas
separadas, juntar igual ao WhatsApp e sumir quando entrar no app; melhorar a
qualidade das figurinhas; a maioria dos bonecos é careca; e o zoom da casa
continua bugado, não dá pra arrastar e ver a casa toda.

- **[x]** **"Dois braços de cada lado".** Não era posição de nada: era o traço de
      uma peça caindo DENTRO da outra. `box()` pintava contorno e preenchimento
      de cada caixa antes da seguinte, então o contorno da manga caía em cima do
      primeiro pixel do tronco e virava uma coluna escura de 11 px descendo por
      dentro da camisa, coladinha no braço. Acontecia em TODA roupa de cima com
      manga. Medido lado a lado: na ordem antiga sobravam colunas escuras em
      x=9 e x=22 dentro da camisa; na nova (contorno de tudo, depois
      preenchimento de tudo), nenhuma. É a mesma lição já registrada no bichinho.
- **[x]** **Corpo feminino de verdade.** O recorte de 2 px de cintura mudava
      pouco e só sabia ESTREITAR — sem quadril não há silhueta. Agora cada linha
      de pixel é reescalada na horizontal em torno do meio do corpo, o que
      estreita E alarga, e a roupa acompanha sozinha (nenhuma das 48 peças
      precisou ser redesenhada). Medido: reto = 22 px de largura do ombro ao
      quadril; curvas = ombro 20, cintura 16, quadril 23.
- **[x]** **"A maioria dos bonecos é careca".** Todo corte pintava só uma faixa
      de 6 px no alto da cabeça: o crânio dos lados ficava com a COR DA PELE, e
      ampliado isso lê como entrada funda. Agora todo corte parte de um "casco"
      com volume e costeleta. Medido na faixa lateral: 12/48 pixels cobertos
      antes, 26/48 no curto e 34/48 no médio. Entraram quatro cortes novos na
      loja (chanel, tranças, black power e raspado — este último careca DE
      PROPÓSITO, com a sombra do corte, pra careca virar escolha e não defeito).
- **[x]** **Bichinho com mais pixel.** Na tela dele a arte era sempre 128×108
      ampliada por CSS: no celular dava 3×, ou seja, cada pixel virava um
      quadrado de 3 e o desenho continuava com a mesma informação. Agora a tela
      escolhe, entre as combinações que dão o MESMO tamanho físico, a que tem
      mais pixel de arte. Medido: 384 px na tela nos dois casos, **8,9× mais
      pixel desenhado** (1.103 → 9.821). Pra isso funcionar, o contorno e o rosto
      (nariz, boca, bigode, olho) deixaram de ser medidas fixas e passaram a
      acompanhar a escala — sem isso sairia um bicho grande com narizinho de
      alfinete. O cômodo e a corrida continuam na resolução da cena de propósito:
      lá o bichinho precisa ter a mesma grossura de pixel do sofá. Conferido na
      bancada: 132 animações, 18 bichinhos, 30 acessórios vestidos e 30 móveis,
      nenhum vazio.
- **[x]** **Jogo da memória**, com carta de imagem. O tabuleiro do dia é sorteado
      pela data, então é **o mesmo nos dois celulares** — é isso que dá sentido à
      lista de "quem fez em menos tentativas". 14 cartas geradas pelo Pollinations
      e **escolhidas olhando, uma a uma**: o gerador erra o assunto com
      frequência (pedindo um coração vermelho devolveu um bichinho nas três
      tentativas; "uma chave" virou um hamster), e o que não acertou ficou de
      fora. 58 KB no total. Prêmio de 12 Corações uma vez por dia.
- **[x]** **Batalha naval, a dois, cada um no seu celular.** Tabuleiro 8×8, frota
      de 4/3/3/2, quem acerta joga de novo. O que faz ele funcionar não é a tela:
      **a posição dos navios do outro nunca sai do servidor**, e o tiro é
      resolvido lá. Mandar o tabuleiro inteiro e esconder no CSS não esconderia
      nada — bastava abrir o painel do navegador pra ganhar toda partida. Tem
      caso de teste que varre a resposta inteira atrás das casas do adversário.
      Conferido nos dois lados ao vivo: a tela dela virou sozinha quando ele
      posicionou, o tiro dele apareceu sem recarregar, e o tabuleiro dele ficou
      com zero casas de navio visíveis mesmo depois de ela acertar uma.
- **[x]** **Chat não carregava as mensagens novas ao voltar pro app.** O
      WebSocket entrega o que acontece com ele DE PÉ, e o celular derruba a
      conexão quando o app vai pro segundo plano — o que chega nesse intervalo
      não passa por evento nenhum. Como a tela do chat continua montada, nada
      ia buscar. Agora ela re-sincroniza quando o app volta a ficar visível E
      quando o WebSocket reconecta (perder sinal na rua não esconde o app, então
      só a visibilidade não bastaria). Conferido: ao voltar, o app faz
      `GET /api/chat`, a mensagem aparece e não duplica.
- **[x]** **Notificações juntas, como no WhatsApp, e limpas ao entrar.** Já foi
      dos dois jeitos errados: tag única sem contagem (a nova SUBSTITUÍA a
      anterior e só aparecia uma) e uma tag por mensagem (a pilha de avisos
      separados, que foi esta reclamação). O certo é o meio — tag única E
      contagem —, e quem conta é o aparelho, porque o servidor não sabe quais a
      pessoa já dispensou com o dedo. Medido: "Ele — oi", "Ele (2 mensagens) —
      tudo bem?", "Ele (3 mensagens) — me responde", e aviso de outro assunto
      não entra na conta. Ao abrir o app, a bandeja é limpa e o numerinho zera.
- **[x]** **Qualidade das figurinhas.** A causa não era o desenho: metade do
      pacote era de OUTRO MATERIAL. As 18 da referência já eram redondas com
      brilho e as outras 20 continuavam em pixel, lado a lado no mesmo seletor.
      As 20 foram convertidas; as 38 estão na mesma linguagem, e o smoke não
      deixa a mistura voltar. A bancada `/lab` também passou a mostrar a
      figurinha COMO O CHAT MOSTRA — ela desenhava todas em pixel, ou seja,
      conferia justamente a arte que o app não usa mais.
- **[x]** **Zoom da casa: agora dá pra ver a casa toda.** `.room-holder` era
      `display:flex; justify-content:center`. Centralizar por flex funciona
      enquanto o conteúdo cabe; passando disso, o flexbox joga metade da sobra
      ANTES do início do contêiner, e essa metade é inalcançável porque
      `scrollLeft` não vai abaixo de zero. Medido com o mesmo conteúdo nos dois
      CSS: **704 px inalcançáveis à esquerda** no antigo, 0 no novo. Conferido
      no app: 1× a 4×, nada cortado em nenhum passo, e o arrasto chega às duas
      pontas.

**Sobre a IA de imagem, honestamente:** o único modelo gratuito disponível
(`sana`, no Pollinations) desenha bem objeto simples e fofo — e por isso serve
pras cartas da memória, onde o assunto é "um bolo", "uma pizza". Ele **não**
serve pras figurinhas: erra assunto simples (um coração virou bicho nas três
tentativas) e não teria como acertar "saudade", "amor protegido" ou "acabei".
Além disso ele só devolve JPEG com fundo — figurinha precisa de fundo
transparente. Por isso a melhora das figurinhas foi feita fechando a mistura de
materiais, que era o problema real e é exato.

Estado: **609 verificações, 0 falha**; build Vite aprovada; tudo conferido no
navegador contra o app publicado. Causas no HANDOFF, seção 9.8.
