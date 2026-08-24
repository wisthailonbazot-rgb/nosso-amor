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
