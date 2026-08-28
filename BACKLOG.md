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

### 26/08/2026 — Pente fino nos bichinhos, cenário da ilha e interação (Kinectimals)

Pedido do dono, na íntegra: ainda há olhos se sobrepondo; animações contorcendo o
corpo; asas do passarinho sempre pra cima; passar um pente fino em tudo que tem a
ver com os animais; melhorar o fundo da aba bichinhos, que está bem genérico,
usando o **Kinectimals** (jogo antigo de Windows Phone) como referência do tipo de
interação; e as orelhas estão apagadas nas pontas.

- **[x]** **A bancada estava aprovando o que ninguém via.** Todas as abas do
      `/lab` desenhavam em 1×, e a tela do bichinho passou a desenhar grande na
      entrega anterior — um monte de defeito só existe fora do 1×. Criada a aba
      **Escala grande**, que desenha cada espécie no tamanho real. Foi ali que
      tudo abaixo apareceu.
- **[x]** **"Animações contorcendo o corpo": a escala era aplicada DUAS VEZES.**
      O desenho multiplica todo valor de pose pela escala, então o clipe deveria
      falar em unidade crua — mas quase todos os 22 clipes escrevem a pose em
      cima do próprio plano (`-plano.pernaA * 0.85`), e o plano já vem escalado.
      Escala ao quadrado em todo deslocamento. Com a caixa fixa de 128×108 a
      escala era 1 e 1×1 continua 1: o defeito existia desde sempre e não
      aparecia. Grande (escala ≈ 3,8), virou ~15× em vez de 3,8. Corrigido numa
      linha, sem tocar nos clipes — e isso conserta também o cômodo, onde o
      movimento vinha pela metade.
- **[x]** **Olhos se sobrepondo.** A posição era fração fixa da cabeça e o raio
      saía de outra conta, que não sabia da primeira; no filhote (cabeça maior E
      olho aumentado) os dois brancos viravam uma mancha só. Agora a distância
      entre eles é derivada do raio, com folga e teto: não têm como se cruzar, e
      o filhote continua de olho grande, só que mais afastado.
- **[x]** **Ponta da orelha apagada.** A base da orelha media 8,4 px FIXOS: com a
      cabeça três vezes maior, virava agulha — e agulha some dentro do próprio
      contorno, sobrando só traço na ponta. Todas as medidas cruas do motor
      passaram a acompanhar a escala. No coelho, a orelha encurtou (1,95 → 1,45
      da altura da cabeça, que era orelha de lebre) e o rosa de dentro passou a
      parar em 76% dela.
- **[x]** **Asa do passarinho sempre pra cima.** O ângulo passava por dentro de um
      seno já perto do pico. Medido, ao longo de uma batida: antes a ponta ficava
      acima de 80% da altura em **5 de 13** quadros e a descida chegava a −0,25;
      agora é **1 de 13** e a descida vai a −0,65.
- **[x]** **Pente fino:** a cauda saía quase em pé e grossa como uma perna (lia
      como braço levantado — era isso que dava ao gato ar de bicho em pé); a
      coleira atravessava o focinho (estava ancorada na borda de baixo da cabeça,
      que numa cabeça grande ainda é bochecha) e ganhou fivela; a sombra flutuava
      longe da pata; o objeto do item ia parar no canto do quadro; e o aviso de ⚠
      virou uma placa de trânsito porque o tamanho estava preso à escala do bicho.
- **[x]** **Ele ocupa o palco.** Um coelho filhote dava 26% da largura da tela. A
      escala agora sai do tamanho do próprio bicho, então cada espécie enche a
      tela até onde dá — e crescer continua visível.
- **[x]** **O fundo virou um lugar.** Era um degradê de duas cores. Agora é uma
      ilha desenhada em pixel: céu com reticulado, sol (ou lua crescente) com
      halo, estrelas, nuvens com paralaxe, montanhas, mar com brilho que anda,
      praia, campo, moitas, flores, grama atrás e na frente do bichinho,
      borboletas de dia e vaga-lumes de noite. **A paleta muda com a hora** —
      abrir de manhã e à noite são duas coisas diferentes. O que não se mexe é
      pintado uma vez e colado, senão a tela esquentaria o celular à toa.
- **[x]** **Interação no espírito do Kinectimals.** Ele **acompanha o seu dedo**
      com a cabeça e com a pupila (é o que faz parecer que ele está do outro lado
      do vidro prestando atenção em você), e **passar a mão nele é carinho** — o
      afago conta distância percorrida, não tempo parado, que é a diferença entre
      a mão encostada e a mão fazendo carinho. Sobem coraçõezinhos, e de tanto em
      tanto vira o carinho de verdade no servidor. A regra travada continua: a
      reação é sempre, o prêmio tem hora — e a recusa é aviso, não erro.
- **[x]** **A bancada confere proporção sozinha.** Ela mede a caixa que o desenho
      ocupa em 1×, 2× e 3× e reprova em vermelho quando a fração muda. Dois
      cuidados que a medição ensinou: medir **andando** (parado os pés não saem do
      lugar, e era ali que estava a escala dupla) e comparar **2× com 3×**,
      deixando o 1× só para olhar — abaixo de ~2× a arte perde detalhe de verdade,
      e a assinatura disso é a altura bater nas três escalas enquanto só a largura
      encolhe.

Estado: **609 verificações, 0 falha**; build Vite aprovada; as 6 espécies
conferidas no tamanho real, o cômodo conferido, e o carinho testado ponta a ponta.
Causas no HANDOFF, seção 9.11.

### 26/08/2026 — Kinectimals, vozes, moedas dos jogos e a casa cheia

Pedido do dono: no Kinectimals o animal corre pelo cenário, vira de lado e
interage com a câmera (meio que lambendo a câmera) — achar todos esses
comportamentos e trazer; está bugado, não consigo dar sushi pra ele comer; os
minigames devem sempre gerar moedas, a não ser que o animal esteja cansado, aí
não deve dar pra jogar; pesquisar um jeito de criar sons pros animais condizentes
com cada um, assim como as interações; na casa devem aparecer todos os nossos
animais andando e interagindo um com o outro; e no perfil o gato ficou duplicado,
deixar só o Salem.

- **[x]** **O sushi.** Não era o sushi: era o **carinho por arrasto sequestrando
      o item**, regressão da entrega anterior. Levar a comida até ele é
      literalmente o gesto do afago (dedo pressionado passeando em cima dele), e
      a reação de "feliz" entrava por cima da cena de comer — dava pra dar sushi
      e nunca ver ele comer. Agora quem está com a mão ocupada não faz carinho, e
      o item em uso ganha da reação de toque. O cartão também passou a dizer o
      motivo (`acabou`, `sem fome`, `já limpo`, `descansando`) em vez de só ficar
      cinza, e a recusa por estado virou aviso, não erro vermelho.
- **[x]** **Minigame paga sempre; o freio é a energia.** O descanso de dois
      minutos saiu. Cada partida gasta energia e paga proporcional ao placar; sem
      energia não dá pra jogar, e a recusa diz que é cansaço. De 100 de energia
      saem umas sete partidas — a torneira continua fechada, mas por um motivo
      que aparece na barra e que dá pra resolver cuidando dele. Memória e naval
      também passaram a pagar sempre, com valor menor depois da primeira do dia
      (elas não gastam energia de ninguém, então precisavam de algum limite).
- **[x]** **Voz própria por espécie.** A pesquisa levou ao modelo do `soundgen`:
      fonte harmônica + ruído, moldados por formantes, com contorno de altura,
      abertura de boca e jitter. Miado, latido, guincho, piado, grunhido e
      rosnado — e o humor muda o jeito de falar. A bancada ganhou a aba **Vozes**
      (som era a única coisa do app sem conferência) e já reprovou uma coisa: gato
      e coelho estavam a 12% de distância e soariam iguais.
- **[x]** **Os comportamentos do Kinectimals.** Ele anda e corre pelo cenário com
      **profundidade** (longe fica pequeno e alto, perto fica grande e embaixo),
      **vira de lado**, faz truque (sentar, rolar, implorar, deitar, coçar,
      brincar) e **vem até o vidro e lambe** — com língua e rastro úmido que vai
      secando. Tocar longe dele é **chamar** (ele vem correndo); tocar nele é
      mexer com ele. Bichinho doente ou triste não passeia.
- **[x]** **A casa com todos.** Os quatro aparecem, cada um com o seu passeio, na
      mesma fila de profundidade dos móveis (um passa atrás do outro e atrás do
      sofá). Quando dois se encontram, **eles se viram um pro outro e reagem** —
      menos os que estão doentes ou dormindo.
- **[x]** **Dispensar bichinho** (`POST /api/pet/{id}/soltar`), que é o conserto
      do gato duplicado. Faltava: dava pra adotar e nunca pra desfazer, e como
      cada licença de espécie traz um bichinho NOVO, a segunda licença de gato
      deixa dois gatos na fila pra sempre. Não dá pra soltar o último, e soltar o
      ativo passa a vez pro próximo antes de apagar.
      - [ ] **O gato repetido de vocês** ainda está lá: eu não tenho como entrar
            na conta de vocês pra apagar, e não daria pra adivinhar qual dos dois
            é o Salem. Está a um toque: Bichinho → "Dispensar" no que não é o
            Salem, e confirmar.

Estado: **623 verificações, 0 falha**; build Vite aprovada; conferido no
navegador. Causas no HANDOFF, seção 9.12.

### 26/08/2026 — Vozes, áudio no Android, iPhone mudo, o passeio, a lambida e as moedas

Pedido do dono: as vozes dos animais não se parecem nem um pouco com eles, tá
bem estranho; no Android via site/app não envia áudio; no iPhone as notificações
não estão funcionando corretamente; o movimento do animal pra frente e pra trás
tá completamente bugado; ao lamber a câmera tá bem estranho; o sistema pra ganhar
moedas tá bem difícil, não ganha quase nada de jeito nenhum. E no meio da
rodada: estamos jogando batalha naval e não tá carregando direto as jogadas, tá
lento pra jogar.

- **[x]** **As vozes.** As peças estavam certas e PARADAS. Envelope igual pra
      todo mundo (que é a forma de um bipe), só o primeiro formante se mexendo
      (sem o cruzamento F1/F2 não existe miado), jitter rápido demais — que o
      ouvido lê como eletrônico — e nenhuma rugosidade, que é justamente o que
      faz um rosnado ser rosnado. Agora cada espécie tem a forma no tempo dela,
      a boca se move nos dois formantes, o tremor virou vibrato + jitter
      separados, e existe modulação de amplitude pros graves.
      - A bancada não podia pegar isso (volume e agudez olham o som inteiro de
        uma vez: um bipe e um miado têm a mesma agudez média). Ela ganhou
        **movimento** e **corpo**, e movimento abaixo de 1,25× reprova — e já
        reprovou uma coisa nesta rodada: gato e cachorro a 4% de distância.
- **[x]** **O movimento pra frente e pra trás.** Havia DUAS variáveis pra um
      fato só — `z` e `perto`, as duas mexendo no tamanho. `perto` era ligado
      por estado e não por posição, então ele pulava de 1× pra 1,5× parado no
      lugar e despencava ao sair da lambida sem ter andado. Apagado: a distância
      até a câmera é `z` e mais nada. Medido na aba **Passeio** nova: o código
      antigo dá 3,31% de salto num quadro (reprova), o novo dá 0,414%.
- **[x]** **A lambida.** A língua nascia no meio do rodapé da tela, fixo, e ele
      lambe parado no ponto em que chegou — subia por fora do corpo. Agora sai
      da boca, e cada batida deixa a marca dela, que seca sozinha.
- **[x]** **O áudio no Android.** Três falhas caladas: gravação sem fatia de
      tempo (o WebView entrega o bloco final vazio, e ia um arquivo de 0 byte),
      formato escolhido no escuro, e a Promise resolvendo no evento errado. E
      agora **nada falha em silêncio**: o motivo aparece na tela em português.
      - [ ] **Confirmar no seu Android** — se ainda não for, a tela vai dizer
            qual das cinco coisas travou.
- **[x]** **As notificações do iPhone.** Duas causas: o envio ia sem
      `Urgency: high`, e o padrão do protocolo faz a Apple SEGURAR o aviso pra
      entregar quando for conveniente; e não havia `pushsubscriptionchange` — o
      iOS renova a assinatura sozinho com o app fechado, o endereço novo nunca
      chegava, e o aparelho ficava mudo pra sempre. Agora o service worker avisa
      e a tela reconfere o endereço a cada abertura.
      - [ ] **Confirmar no iPhone dela** — esta é a mesma pendência de 23/08,
            agora com duas causas reais corrigidas por trás.
- **[x]** **As moedas.** A conta não fechava: ~90 Corações por dia jogando tudo,
      e só a comida do bichinho comia ~60. Um sofá de 300 levava dez dias. Os
      dois lados da conta mudaram — a renda subiu (check-in, os três jogos, as
      missões) e o custo de manutenção desceu (a fome cai 2,0/h em vez de 3,0, e
      a comida rende mais por moeda). E **o carinho passou a pagar**: até aqui o
      bichinho só tirava dinheiro, e nenhuma das coisas que se faz com ele de
      graça devolvia nada.
- **[x]** **A batalha naval "lenta".** O `ping` do tempo real era um monólogo: o
      app mandava a cada 25s e nunca conferia se voltava. Conexão de celular
      morre meio aberta (troca de Wi-Fi, proxy que desiste) e nesse estado o
      app fica se achando conectado pra sempre, com o indicador verde — a jogada
      do outro não chegava por evento nenhum e só aparecia ao trocar de tela.
      Agora todo sinal marca a hora e dois pings de silêncio derrubam o socket
      pra reconectar. Junto: a revisão da partida viaja pra tela (resposta
      atrasada não faz mais o tabuleiro voltar atrás) e, só enquanto a vez é do
      outro, a tela confere a cada 5 segundos.

Estado: **640 verificações, 0 falha**; build Vite aprovada; conferido no
navegador. Causas no HANDOFF, seção 9.13.

### 26/08/2026 — A naval ganha lugar, e o rosto que vazava

Pedido do dono: "cria o desenho das embarcações no jogo, e uma tela finalizando
mostrando quem ganhou e o presente em moedas também, do jeito que está é
genérico, e nem tem um final, a tela só some; cria o desenho do mar também;
além disso encontre um jeito de caber a tela toda do jogo, tá meio bugado pra
jogar, fica com as informações dos outros jogos lá em cima; use a IA pras
imagens". No meio da rodada: "a língua do bichinho continua bugada, e tem
recorte verde na parte de cima".

- **[x]** **Caber na tela.** Não faltava rolagem: eram DOIS tabuleiros 8×8
      empilhados, e a naval era o único jogo fora do modo tela cheia por causa
      disso. Agora é um grande por vez — o mar do outro ocupa a tela, a sua
      frota virou minimapa no rodapé — e ela entra em tela cheia como os outros.
- **[x]** **Tela de fim de partida.** Quem venceu, o prêmio em Corações em
      destaque, o placar dos dois lados e a revanche. O valor vem do `coins` da
      resposta do tiro vencedor e é guardado quando chega; quem perdeu não vê
      número nenhum, em vez de ver um chutado.
- **[x]** **O mar e a frota.** Mar em pixel art ladrilhado (emenda conferida) e
      três navios coloridos, um por tamanho, com proa, cabine e chaminé. Duas
      rodadas de desenho: a primeira saiu com o mar em listra de zebra e três
      tubos cinza — genérico do mesmo jeito, e os dois só apareceram olhando.
- **[x]** **A IA nas imagens** — na tela de fim, que é onde imagem funciona
      (ilustração pura, sem estado e sem grade). Os navios eu tentei, 3 sementes
      por assunto como manda o precedente das cartas: o modelo gratuito devolveu
      navio de guerra cinza EM PERSPECTIVA nas seis, e navio em perspectiva não
      encaixa numa grade vista de cima. Uma das opções do troféu veio com mão de
      gente e foi descartada.
- **[x]** **O recorte verde.** O chão da cena era 0,84 cravado e o bichinho
      passou a pisar entre 0,60 e 0,98 — dois números pro mesmo fato, de novo.
      Ele andava POR CIMA da grama e a borda do campo cortava a tela.
- **[x]** **A "língua bugada" era o ROSTO vazando.** Bochecha e nariz eram
      ancorados numa fração fixa da meia-largura da cabeça, que é uma elipse:
      perto da borda ela já estreitou. No coelho a bochecha direita saía 5,7 px
      pra FORA do contorno e o nariz 2,6 px — a mancha rosa que ele via na
      lateral da cara. É o mesmo defeito dos olhos da 9.11, que não tinha sido
      corrigido nestas três peças.
      - Junto: a **coleira** estava em 1,38, que é peito em bicho sem pescoço
        (coelho, capivara) — virava um crachá na barriga. Foi pra 1,14.
- **[x]** **Bancada: aba Naval** (proporção dos navios, emenda do mar, desenho
      vazio) e o smoke conferindo que as duas ilustrações existem no disco.

Estado: **642 verificações, 0 falha**; build Vite aprovada. Causas no HANDOFF,
seção 9.14.

### 27/08/2026 — O campo, a língua e o diagnóstico do microfone

Pedido do dono: "o quadrado verde na metade da tela do bichinho continua, quando
ele lambe a câmera ainda tá bugado, e mandar áudio no Android ainda não
funciona, mesmo no navegador pelo link".

- **[x]** **O quadrado verde.** A geometria da 9.14 estava certa (ele parou de
      flutuar), mas o campo era um retângulo de cor chapada — e passando a
      ocupar 40% da tela, virou um bloco verde com borda reta atravessando tudo.
      Agora tem profundidade: cinco faixas do fundo pra frente, com reticulado
      nas emendas e manchas de tom.
- **[x]** **A língua.** Terceira tentativa, e as duas anteriores erraram porque
      eu estava CHUTANDO onde fica a boca — a última usava 0,74 da altura do
      bicho, e a altura do coelho é quase toda orelha, então a língua saía das
      PONTAS DAS ORELHAS. Agora ela usa `marcos.focinho`, que é onde o desenho
      pôs o focinho naquele quadro. E vai pra frente do rosto, não pra cima.
- **[~]** **O áudio no Android.** Parei de adivinhar: agora existe
      **Perfil → Áudio neste aparelho**, que roda os sete passos de verdade
      (HTTPS, APIs, formato, permissão, faixa viva, gravar 2s, mandar pro
      servidor conferir, tocar de volta) e diz em qual deles parou, em
      português. Mesma solução que destravou o push do iPhone.
      - [ ] **Rodar no seu Android e me dizer em que linha aparece o ❌.** Com
            esse dado o conserto é direto; sem ele qualquer correção é chute.

Estado: **646 verificações, 0 falha**. Causas no HANDOFF, seção 9.15.

### 27/08/2026 — O quadrado verde era o CSS, e o microfone está bloqueado

Pedido do dono: "o quadro verde acima do boneco ainda aparece, já pedi pra
corrigir múltiplas vezes; e o áudio ainda não funciona, e não pede a permissão
como deveria". Veio com o print do diagnóstico da 9.15 — e o print entregou a
resposta.

- **[x]** **O quadrado verde, terceira vez — e as duas primeiras estavam certas.**
      Ele nunca foi desenhado: era `linear-gradient(#dcead9 0 62%, #c99e70 62%)`
      no `.pet-stage`, o fundo de duas faixas chapadas de antes da ilha existir,
      que ninguém apagou quando a cena virou canvas. Aparecia na SOBRA da caixa —
      e a sobra era de **288 px**, porque o palco tinha `height: 100%` e esticava
      até a altura da lista de itens do lado (614 px) enquanto a cena tinha 324.
      - Conserto em três partes, e nenhuma é pintar a sobra: o CSS perdeu o
        fundo próprio (a cor vem de `corDoCeu()`, do desenho); o palco parou de
        esticar; e a caixa de referência deixou de ser 128×108 cravado — a cena
        sempre soube desenhar em qualquer tamanho, só a caixa é que estava fixa.
      - Medido no navegador: sobra **288 px → 0**. O bichinho não encolheu (os
        mesmos 198 px de largura); o bloco verde virou céu, montanha, mar, praia
        e as cinco faixas do campo.
- **[x]** **O áudio: o navegador não pergunta mais porque já tem um "não"
      guardado.** `NotAllowedError` cobre dois fatos e o app tratava como um:
      pergunta fechada agora (dá pra tentar de novo) e permissão negada pra
      ORIGEM (não dá — nenhuma chamada reabre a pergunta, só os ajustes). Era
      esse o "não pede a permissão como deveria".
      - Agora o app lê o estado guardado antes e depois de pedir, separa os dois
        casos, e mostra o passo a passo **do aparelho em que está** — no
        diagnóstico e também no erro do chat.
      - Fonte única em `lib/microfone.js`: a tradução do erro estava em dois
        lugares, duas listas parecidas e diferentes pro mesmo fato.
      - "Detalhes do aparelho" ganhou `microfone: denied` e `rodando: site no
        Chrome`, que é o que faltava pra diagnosticar à distância.
      - **O resto da corrente está provado bom:** com uma faixa de áudio real
        gerada no navegador, os sete passos passam (31,4 KB gravados, servidor
        reconhece como webm, toca de volta). O único elo quebrado no seu
        aparelho é a permissão.
      - [ ] **Liberar o microfone nos ajustes do site**, pelos passos que a tela
            mostra agora. Depois disso o áudio do chat funciona.
- **[ ]** **O APK de `releases/` é de 23/08** — anterior a todas as correções de
      áudio e às telas de diagnóstico. Precisa ser regerado antes de servir pra
      julgar qualquer coisa. (Seus prints são da tela nova, então você está pelo
      link — o APK não está no caminho deste problema.)

Estado: **655 verificações, 0 falha**; build Vite aprovada; conferido no
navegador (sobra 0 px, `/lab` com as 13 abas sem desenho vazio, diagnóstico do
microfone rodado bloqueado e liberado). Causas no HANDOFF, seção 9.16.

### 27/08/2026 — O modal de permissão do microfone

Pedido do dono: "não tem onde dar essa permissão; quero que ao clicar em testar
microfone abra o modal de permissão, igual foi com a câmera e as notificações".

- **[x]** **A culpa do modal não aparecer era minha, de hoje de manhã.** Na
      correção anterior eu botei uma consulta (`navigator.permissions.query`)
      ANTES de pedir o microfone. Consultar é uma Promise, e um `await` na
      frente tira o pedido de dentro do toque — que é a condição pro navegador
      MOSTRAR a pergunta. É a armadilha nº 9 do HANDOFF, que eu reabri
      escrevendo o conserto dela. De quebra, com o estado lido como "denied" o
      código nem tentava.
      - Agora pede primeiro, sem nada na frente. Medido no navegador nos três
        caminhos (o botão novo, o teste e o botão do chat): todos pedem na mesma
        tarefa do toque. Travado no smoke, e conferido reintroduzindo o defeito
        de propósito.
- **[x]** **"Não tem onde dar essa permissão" — e não tinha mesmo.** Eu te mandei
      pro cadeado 🔒 do navegador, e num atalho instalado não existe barra de
      endereço nem cadeado. Pior: quando o atalho vira aplicativo, o Chrome
      **delega o microfone às permissões do APP** — a mesma lista da câmera e
      dos avisos, que são justo os dois que funcionaram pra você. O passo a
      passo agora começa por Ajustes → Apps → Nosso app → Permissões → Microfone.
- **[x]** **Botão "Liberar o microfone"**, em destaque no Perfil, separado do
      teste dos sete passos: é só tocar e a pergunta aparece. O teste continua
      lá pra quando a pergunta já foi respondida e o áudio mesmo assim não sai.
- **[x]** Descartado de saída: certificado inválido (o Chrome bloqueia permissão
      sem oferecer onde liberar, o que casava com o relato). O Let's Encrypt do
      site é válido até 09/11/2026, conferido sem `-k`.

Estado: **657 verificações, 0 falha**; build Vite aprovada; conferido no
navegador. Causas no HANDOFF, seção 9.17.

### 27/08/2026 — A trava do microfone tem três andares

Pedido do dono: "continua não funcionando, nem pedindo a permissão, e as
instruções não funcionam; **testei em outros navegadores**".

- **[x]** **A frase que resolve: "testei em outros navegadores".** Permissão de
      site é guardada por navegador. Se falha em mais de um, não é permissão de
      site — só sobra o aparelho. Eu passei duas rodadas mandando você consertar
      uma coisa que a sua própria observação já descartava.
      - `NotAllowedError` sai igual de TRÊS coisas: a chave geral do microfone
        do Android (aparelho inteiro), a permissão de app do navegador (todos os
        sites dele) e a permissão do site. As duas primeiras atravessam
        navegador.
      - `enumerateDevices()` separa sem pedir nada: zero entrada de áudio =
        a trava está abaixo do site. A tela agora diz o andar provável, mostra o
        seguinte logo abaixo, e imprime o nome cru do erro.
- **[x]** **O cadeado do Samsung Internet não tem permissões.** Seu print mostra
      "Informações de privacidade": conexão, rastreadores, cookies. Só. Eu te
      mandei pra uma tela que não existe nesse navegador. O caminho do site agora
      é escrito por navegador, com o nome que cada um usa — e no Samsung Internet
      a primeira linha avisa que o cadeado não serve.
      - [ ] **Primeiro suspeito, e é de graça conferir:** olha a barra de status
            do celular. Se tiver um ícone de **microfone cortado**, é a chave
            geral do Android — nenhum app grava, e nenhum ajuste de site resolve.

Estado: **662 verificações, 0 falha**; build Vite aprovada; os dois cenários
conferidos no navegador. Causas no HANDOFF, seção 9.18.

### 27/08/2026 — O atalho sem microfone, e o áudio que recarregava sozinho

- **[x]** **O microfone: seus prints fecharam o caso, e não era nada do que eu
      vinha dizendo.** A tela "Permissões do app" do **"Nos"** (o atalho
      instalado) mostra "Com permissão: Notificações" e "Sem permissão: Nenhuma
      permissão negada" — **não existe Microfone naquela lista**. Não foi
      negado: não há o que permitir. E o Chrome, ao lado, tem Microfone
      concedido — então a chave geral do aparelho está ligada e o navegador tem
      microfone. As duas hipóteses anteriores caem juntas.
      - Quem instala o atalho é o Chrome, e ele gera um aplicativo Android
        (WebAPK) que **delega** o microfone à permissão do próprio app — e esse
        app declarou só notificações. Dentro do atalho o pedido morre antes de
        virar pergunta.
      - A tela agora diz isso e oferece **"Abrir no Chrome"** em um toque
        (`target="_blank"` não sai do atalho; um `intent:` nomeando o Chrome
        sai), com "Copiar o link" do lado.
      - [ ] **Pra gravar DENTRO do atalho** só com um app que declare
            `RECORD_AUDIO` — que é o APK por Capacitor (o manifesto já tem a
            linha). Não dá pra gerar aqui: esta máquina não tem Java nem Android
            SDK. Montar o build no GitHub Actions, como no app do painel da
            barbearia, fecha isso.
- **[x]** **Os áudios da outra pessoa: a URL mudava a cada leitura.** Achado
      medindo: duas leituras seguidas da mesma conversa devolviam endereços
      diferentes pra mesma mensagem, porque o token da mídia era cunhado com
      "agora + 2h" e isso muda a cada segundo. Trocar o `src` de um `<audio>`
      faz o navegador ABORTAR e recarregar — e a conversa se re-sincroniza a
      cada evento do WebSocket e a cada volta pro app. Piorou agora porque a
      reconexão ficou mais agressiva em 26/08. As fotos baixavam de novo junto.
      - Raiz no servidor: o vencimento passou a ser arredondado pra uma janela,
        então leituras seguidas dão o token byte por byte igual (e ele continua
        curto, entre 1 e 2 horas).
      - No app: o `<audio>` é governado pelo CAMINHO, não pela URL inteira; e se
        falhar, tenta de novo com o endereço mais recente.
      - E `el.play()` falhava **em silêncio** (a recusa da Promise nunca era
        lida): botão virava ❚❚, nada tocava, nada explicava. Agora o motivo
        aparece embaixo do áudio.
      - Medido: com o áudio tocando, uma sincronização forçada no meio — seguiu
        de 0,48s para 1,71s, ainda tocando, sem trocar de endereço.

Estado: **664 verificações, 0 falha**; build Vite aprovada; conferido no
navegador. Causas no HANDOFF, seção 9.19.

### 27/08/2026 — Eu quebrei a reprodução; desfeito

- **[x]** **"Você estragou" — sim, estraguei, e desfiz.** Junto com o conserto do
      token (que é bom e fica), eu enfiei um plano B no caminho da reprodução:
      se o `play()` falhasse, trocava o `src`, dava `load()` e tentava de novo.
      Isso é a única coisa nova capaz de CRIAR erro onde não havia — `load()`
      aborta um carregamento em andamento, e uma falha passageira virava
      elemento em erro. Pior: o texto que escrevi pra esse caso acusava o teu
      aparelho de não saber tocar o formato. Removido inteiro.
- **[x]** **A mensagem de erro não chuta mais.** O `<audio>` reduz "não achei o
      arquivo", "não posso ler" e "não sei tocar" ao mesmo erro. Agora, quando
      falha, a tela LÊ o endereço e diz o que voltou: 401 (venceu), 404 (sumiu),
      0 byte (gravado vazio) ou — só aí — "chegou inteiro (tipo, KB), mas este
      navegador não sabe tocar".
      - Conferido com áudio DE VERDADE no botão de verdade, que foi o teste que
        faltou: webm/opus real de 30 KB tocou 1,86 s de 2 s, sem erro.
- **[x]** **O envio: parei de responder com palpite.** Toda recusa agora carrega
      uma linha com tudo, e ela aparece no CHAT, não só no Perfil:
      `[NotFoundError · permissão: denied · microfones: 0 · Chrome]` — erro cru,
      estado da permissão, quantos microfones o sistema entrega e onde o app
      está rodando.
      - [ ] **Me manda a foto dessa linha.** Com ela eu paro de ter que adivinhar.
- **[x]** Descartado: o servidor recusar o formato do Samsung Internet.
      `_detect_audio` já trata `ftyp` (MP4/AAC) além de webm, ogg, mp3 e wav.

Estado: **664 verificações, 0 falha**; build Vite aprovada. Causas no HANDOFF,
seção 9.20.

### 27/08/2026 — Eu apaguei as fotos e os áudios de vocês

- **[x]** **A causa dos áudios não tocarem era eu, mas não era o código: era o
      deploy.** `/app/media` nunca esteve num volume — vivia dentro do container.
      Todo deploy troca o container e leva junto TODA foto e TODO áudio já
      enviados. Eu dei cinco deploys hoje.
      - O banco persiste, então as mensagens continuaram na tela com a bolha de
        áudio; só o arquivo sumiu. O `<audio>` levava 404, e o navegador reduz
        isso ao mesmo erro de "não sei tocar este formato" — que foi o que a
        minha mensagem leu e traduziu como culpa do seu aparelho.
      - "Abri o dela no meu celular e funciona" fechou o caso: o único áudio que
        restava era um que ela mandou DEPOIS do último deploy.
      - O passo 4 do HANDOFF já dizia "volume de disco, senão as fotos somem no
        deploy". Estava escrito, e eu deployei cinco vezes sem conferir.
- **[x]** **Consertado de vez.** Volume permanente `/data/casal-media` →
      `/app/media`, criado pela API do Coolify; os arquivos que sobraram foram
      salvos antes e recolocados; conferido no container novo que o bind existe e
      que os arquivos sobreviveram ao deploy. Deploy não apaga mais nada.
- **[ ]** **O que foi apagado não volta.** Procurei em volumes órfãos, containers
      parados e camadas do Docker — não sobrou nada, e os backups do Coolify são
      do banco, não de arquivo. As fotos e os áudios anteriores a hoje 16:10 UTC
      estão perdidos. Sinto muito: isso foi erro meu.
- **[x]** **Um defeito real achado no caminho:** o evento ao vivo do chat levava
      o token de mídia de QUEM ENVIOU pros dois. Quem recebia ficava com o
      endereço emprestado — tocava enquanto o token do outro valia e parava
      depois, enquanto pra quem mandou continuava funcionando. Agora a mensagem
      ao vivo é montada para cada pessoa (`publish_por_pessoa`), com trava no
      smoke.

Estado: **667 verificações, 0 falha**. Causas no HANDOFF, seção 9.21.

### 27/08/2026 — A câmera sumiu sozinha, e o texto do microfone chutava

- **[x]** **A linha do diagnóstico resolveu o microfone:** `microfones: 1`
      significa que o sistema ENTREGA microfone — então não é a chave geral nem
      a permissão do navegador. O que está negado é a permissão **do site**.
- **[x]** **Você estava certo sobre a instrução sem sentido.** Eu escolhia o
      texto pelo `display-mode: standalone`, e essa detecção erra (vários
      navegadores Android respondem "standalone" numa aba normal) — por isso
      apareceu "Ajustes → Apps → Nosso app", que além de errado aponta pra uma
      lista que não tem Microfone. Agora o texto usa só o que foi MEDIDO e não
      afirma onde você está: caminho do navegador (com o do Samsung Internet
      escrito à parte, porque o cadeado dele não tem permissões) e o botão
      "Abrir no Chrome" sempre disponível.
      - A linha de resumo passou a mostrar navegador **e** modo (`Chrome`,
        `Chrome (modo app)`), em vez de um esconder o outro.
- **[x]** **A câmera: não regrediu por minha causa — o Android trocou o
      seletor.** Desde o Android 13 o `<input accept="image/*">` é atendido pelo
      seletor de fotos do sistema, que só mostra o que já foi tirado e não tem
      botão de câmera. Quem devolve a câmera é o atributo `capture`, e ele é
      exclusivo (com ele só fotografa, sem ele só escolhe) — não existe mais um
      pedido que ofereça os dois.
      - Agora são duas entradas declaradas: no chat o ícone abre "Tirar foto
        agora" / "Escolher da galeria"; no mural, dois botões.

Estado: **667 verificações, 0 falha**; build aprovada; conferido no navegador.
Causas no HANDOFF, seção 9.22.

### 27/08/2026 — ACHEI: o app proibia o próprio microfone

- **[x]** **A causa, enfim.** O nosso servidor mandava
      `Permissions-Policy: geolocation=(), microphone=(), camera=()`. Lista vazia
      não é "sem restrição extra": é **nenhuma origem pode**, e a própria página
      está incluída. Com isso o navegador recusa o microfone na hora e **nunca
      mostra a pergunta** — exatamente o que você descreveu desde o começo.
      - Custou um dia porque **todo lugar onde se procura diz "liberado"**: o
        Chrome não lista bloqueio nenhum (não é decisão do site, é a política da
        página), a permissão do app está concedida, a chave do aparelho está
        ligada e o diagnóstico acha 1 microfone. Você chegou a fotografar a tela
        do Chrome pra provar que não havia bloqueio — e não havia mesmo.
      - **Explica o iPhone dela gravar e o seu Android não:** o Safari não aplica
        esse cabeçalho ao microfone em página de topo; o Chrome aplica.
      - **E explica a câmera.** `camera=()` bloqueia tirar foto na hora — era por
        isso que abria só a galeria. As duas entradas (câmera/galeria) que fiz
        continuam certas, mas o que destravava era o cabeçalho.
      - Conserto: `microphone=(self), camera=(self)` — a página pode pedir (e o
        navegador ainda pergunta a você), e nenhum terceiro herda nada.
      - Medido na produção antes: `allowsFeature('microphone')` = **false**.
        Depois, local: **true**. Travado no smoke.

Estado: **670 verificações, 0 falha**. Causa no HANDOFF, seção 9.23.

### 27/08/2026 — A casa em 64px, os móveis um a um, e o miado gravado

- **[x]** **Mais pixel: o tile foi de 48 pra 64.** Cada face ganhou ~78% de
      área — uma prateleira que tinha 3 px passou a ter 4, e abaixo disso nenhum
      detalhe sobrevive (era essa a razão de tanta peça virar um risco). O
      canvas do cômodo foi de 434x290 para 578x386.
      - Deu pra aumentar porque o FUNDO parou de ser redesenhado: piso e paredes
        são a maior parte dos pixels, não mudam nunca, e eram repintados a cada
        quadro enquanto o bichinho anda. Agora são pintados uma vez e colados.
      - [ ] **Conferir no seu celular se ficou fluido.** Não consegui medir
            quadros por segundo aqui (a janela do navegador estava oculta na
            bancada e a animação não roda sem ela compor).
- **[x]** **Os móveis, um a um, nas quatro rotações.** Consertados: TV (o pé se
      soltava ao girar), geladeira (as portas eram um risco de 3 px), quadro e
      quadro do casal (pendurados no ar, no meio da sala), planta (vaso de um
      lado e folhas do outro), rede (um pontilhado no lugar do pano), arranhador
      e casinha do bicho (detalhe que não girava junto), fogão, churrasqueira,
      caminha, comedouro, velas, caixa de som e console (blocos sem leitura).
      - A causa se repetia: detalhe desenhado em coordenada de TELA não gira com
        o móvel. Agora tudo é bloco, que gira junto.
      - Quadro passou a girar só entre as duas paredes que existem — as outras
        duas rotações penduravam ele no ar.
      - O smoke pegou um erro meu no meio: apaguei a casinha do bicho sem querer
        e a verificação "todo móvel vendido tem desenho" ficou vermelha na hora.
- **[x]** **O miado agora é gravação de verdade.** Você sugeriu e é o caminho
      certo, porque o limite aqui é meu: **eu não escuto**, e ajustar timbre no
      escuro já falhou duas vezes.
      - Som do Wikimedia Commons (Dan Crosby, **CC BY-SA 3.0**), creditado em
        `public/sons/CREDITOS.md`. A licença pede crédito e vale sobre o som, não
        sobre o app; como ele é privado, é só isso. Virando produto, troca-se por
        CC0.
      - A síntese continua inteira como reserva: se o arquivo falhar, o bicho
        fala como sempre. Nenhum bicho fica mudo.
      - [ ] **Me diz se ficou bom.** Se sim, eu busco os outros cinco bichos do
            mesmo jeito.

Estado: **673 verificações, 0 falha**; build aprovada. Causas no HANDOFF, 9.24.

- **[x]** **E o tipo do arquivo servido.** O `.ogg` chegou como `text/plain` no ar
      e como `audio/ogg` aqui — a tabela do sistema muda de máquina. Agora o tipo
      do que a gente publica é declarado, não adivinhado.

### 28/08/2026 — A naval bugada no iPhone

Pedido do dono, com dois prints: "no iphone tá completamente bugado a batalha
naval". Nos prints os navios saem gigantes, atravessando o tabuleiro por cima
dos botões e da barra de navegação.

- **[x]** **O navio voltou pra dentro da casa.** Duas causas, as duas de "dois
      donos pro mesmo fato":
      - os navios eram desenhados numa **segunda grade sobreposta**, e como eram
        `<img>` (que tem tamanho próprio) eles **inflavam as próprias linhas**
        que deveriam só ocupar — medido: `37,875 … 40 40,75 37,875` numa grade de
        8, contra 38,5 nas colunas. Agora é UMA grade só: casa e navio são
        irmãos nas mesmas trilhas, e o navio é um `<span>` com o desenho de
        fundo, que não tem tamanho pra oferecer;
      - em tela cheia o tabuleiro **não saía quadrado** (355 × 511 num aparelho
        de 375): a linha ficava de 59,5px com a casa de 40px dentro, e o navio
        ocupa a LINHA. Agora ele sai quadrado pelo lado que faltar, e a casa
        perdeu a proporção própria — quem manda é a trilha.
- **[x]** **A bancada passou a medir o ENCAIXE, não só o desenho.** A arte
      estava certa e passava em tudo (proporção, emenda, desenho vazio) — o
      defeito era de layout. A aba Naval do `/lab` agora monta o `Tabuleiro` de
      verdade e pergunta se a caixa do navio bate com a união das casas.
      **Ela roda no iPhone também**, que é onde eu não consigo medir daqui.
- **[x]** Medido com a partida rodando, desvio **0 px** em 375×812 normal,
      390×844 tela cheia, 740×380 deitado e no minimapa de 92px.
- **[x]** Smoke trava as seis causas; as três reintroduções foram testadas de
      propósito e ficaram vermelhas.

Estado: **679 verificações, 0 falha**; build aprovada; publicado em produção
(volume de mídia conferido antes, como manda a regra da 9.21). Causas no
HANDOFF, seção 9.25.

### 27/08/2026 — O sofá, o caça-sobreposição e 96px

- **[x]** **A bancada estava mentindo.** Ela girava o móvel sem girar a pegada
      (na casa, girar troca `w` por `d`; lá não trocava). Resultado: mostrava
      "bugado ao girar" em móveis que na casa estavam certos, e escondia os
      errados de verdade. Corrigido — e é a causa de eu ter perseguido defeito
      que não existia.
- **[x]** **O sofá tinha três peças se atravessando** (o assento entrava no
      encosto, os braços também, e as duas almofadas ficavam uma dentro da outra
      e sobravam pra fora da base). Refeito com as faixas calculadas, e o número
      de almofadas sai da largura.
- **[x]** **Caça-sobreposição automático.** 30 móveis em 4 rotações são 120
      telas, e invasão de 3 centésimos não se vê em miniatura. Agora o código lê
      a descrição das peças e acha as que se cruzam. Acusou 16 móveis; todos
      corrigidos. **A bancada agora diz "nenhuma peça enterrada dentro de
      outra".**
      - A regra que saiu: afundar é a técnica (almofada, cone de alto-falante),
        o defeito é a peça INTEIRAMENTE dentro de outra — as duas faces caem no
        mesmo plano e viram um risco atravessado. Todo detalhe tem que SAIR da
        face do pai.
- **[x]** **Mais pixel de novo: 64 → 96.** Uma prateleira que tinha 3 px no
      começo agora tem 6. O cômodo foi pra 866x578 e rola pro lado, como jogo de
      decoração.
- **[x]** **A opção dos modelos prontos, conferida.** O Furniture Kit do Kenney
      tem 120 objetos CC0 com render isométrico em 4 ângulos — resolveria
      rotação e acabamento de uma vez. O problema é estilo: é render 3D liso, e
      o bichinho, o avatar e as figurinhas são pixel art no mesmo cômodo.
      Trocar só os móveis quebra a unidade; trocar tudo é refazer o app.
      - [ ] **Sua decisão.** Se quiser ver, eu monto um cômodo de teste com o kit
            pra comparar lado a lado antes de decidir.

Estado: **679 verificações, 0 falha**. Causas no HANDOFF, seção 9.25.

### 28/08/2026 — Tela rosa e Furniture Kit do Kenney

Pedidos do dono: "no telefone tá abrindo rosa e não carrega nada", depois
"não tá abrindo em nenhum lugar"; resolvido isso, usar os objetos do arquivo
`kenney_furniture-kit.zip` no lugar dos nossos, mantendo os nossos de backup.

- **[x]** **Causa da tela rosa encontrada.** Um aparelho ainda solicitava o
      bundle antigo `index-CbUqF9D2.js`, que já não existia e voltava 404. O
      CSS carregava (por isso rosa), mas o React não iniciava.
- **[x]** **Recuperação deixa de perder a corrida.** O detector passou para
      antes do bundle, ganhou verificação de `#root` vazio e recarrega uma vez
      após limpar caches e service workers.
- **[x]** **Cache velho invalidado de verdade.** Service worker `casal-v6` e
      registro com `updateViaCache: 'none'`.
- **[x]** **Kenney substitui os móveis compatíveis.** 18 modelos, quatro
      rotações cada, com licença CC0 no repositório. Os desenhos antigos não
      foram apagados: são fallback automático quando não há modelo equivalente
      ou a imagem não carrega.
- **[x]** **Conferido no tamanho do telefone.** Casa abriu e o sofá Kenney foi
      renderizado em 375×812; bancada conferida em 0° e 90°.

Estado: **687 verificações, 0 falha**; build aprovada e publicada no commit
`3f4aa01`. Produção saudável e volume de mídia reconferido. Detalhes no HANDOFF,
seção 9.26.

### 28/08/2026 — A tela rosa, e eu apaguei o trabalho de outra sessão

- **[x]** **Restaurado o que eu apaguei.** Enquanto eu trabalhava, outra sessão
      consertou a tela rosa e implementou o kit Kenney. Meu bloco de publicação
      apaga o destino e copia a minha pasta por cima — e como a minha não tinha
      os 73 PNGs nem o `furnitureKenney.js`, o meu commit **apagou tudo isso** e
      foi pro ar. Desfeito com `git revert`, republicado, e a minha pasta
      sincronizada a partir do repositório de deploy.
      - Regra nova de procedimento: antes de publicar, conferir se o topo do
        `.deploy-repo` é o meu último commit. Se não for, sincronizar de lá pra
        cá primeiro.
- **[x]** **Minha hipótese pra tela rosa estava errada, e eu medi.** Suspeitei do
      tile 96 estourando memória e cheguei a reverter pra 64. Medido: o cômodo
      usa **1,9 MB** de canvas e o modo decorar **2,7 MB**, com heap de 6 MB.
      Não é memória. O 96 ficou.
- **[x]** **Folguei o prazo da rede de segurança do boot** de 2,5 s para 8 s
      depois do `load`. Com 2,5 s volta a recarga falsa em aparelho lento — que
      é o motivo pelo qual essa checagem já tinha sido removida uma vez.
- **[x]** **Cache do worker pra v7**, que é o que apaga a casca velha de quem
      ficou preso no fundo rosa.
- **[x]** **Duas travas do smoke estavam atrapalhando:** uma cravava
      `casal-v6` (reprovava o próprio conserto) e a outra proibia o kit Kenney
      (o oposto do que você pediu). A segunda mudou de lado: agora garante que o
      Kenney vem primeiro **e que o nosso desenho assume quando o PNG não vem**.
      - [ ] **Confirma pra mim que o app abre no seu Android.** Eu não consegui
            reproduzir a tela rosa aqui em nenhum momento.

Estado: **686 verificações, 0 falha**. Causas no HANDOFF, seção 9.26.
