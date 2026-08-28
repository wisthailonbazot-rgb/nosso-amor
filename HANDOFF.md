# HANDOFF — App do Casal

Documento de continuidade. Quem abrir um chat novo lê **este arquivo primeiro**, depois
o [BACKLOG.md](BACKLOG.md) (o que falta) e só então o
[docs/projeto-app-casal.md](docs/projeto-app-casal.md) (o escopo original).

> Para retomar em outro chat, o texto pronto para colar está em
> **[PROMPT-CONTINUAR.md](PROMPT-CONTINUAR.md)**.

Onde o escopo original e a realidade divergem, **vale o que está aqui** — as divergências
estão explicadas, uma a uma, na seção "O que mudou em relação ao documento".

---

## 1. O que é

Um app privado para duas pessoas, na VPS que já existe. Reúne acompanhamento de ciclo
menstrual, coisas de casal (mural, toques de saudade, contador de dias, datas), chat,
minigames, bichinho virtual, casa decorável, avatares e uma economia de moedas
("Corações") que amarra tudo.

Não é produto: são dois usuários fixos, cadastrados na mão. Sem multi-tenant, sem
convite, sem pareamento, sem cobrança.

### O que já funciona hoje

| Módulo | Estado |
|---|---|
| Login dos dois, sessão longa, troca de senha | pronto |
| Notificação (Web Push) + tela de diagnóstico do aparelho | pronto no código, **falta confirmar no iPhone dela** |
| Carteira, check-in com sequência, extrato auditável | pronto |
| Tarefas única/diária/semanal, com desfazer | pronto |
| Loja (avatar/casa/bichinho), inventário, consumo | pronto |
| Avatar: 8 camadas, 48 peças, posse validada no servidor | pronto |
| Ciclo: registro, calendário, previsão com fonte clínica, privacidade | pronto |
| Chat: texto, emoji, foto, 24 figurinhas, áudio, visto, responder | pronto |
| Toques de saudade, datas importantes, mural de momentos | pronto |
| Motor de pixel isométrico + casa editável | pronto; vários cômodos, terreno e rua frontal |
| Bichinho | pronto; cuidados, casa e um jogo |
| Minigames | Bolinha, corrida, **memória** e **batalha naval a dois** prontos |
| Mapa do bairro | não começou; terreno da casa e rua frontal já prontos |

---

## 2. Como rodar aqui

```bash
cd "D:/beckup/arquivo env/app-casal/backend" && .venv/Scripts/python.exe dev_server.py
```

Sobe em `http://localhost:8020` com SQLite e dois usuários de teste:
`ele` / `senha123` e `ela` / `senha123`.

O app web tem dois modos:

```bash
cd "D:/beckup/arquivo env/app-casal/web" && npm run dev
```

`npm run dev` abre em `:5173` com recarga automática e faz proxy de `/api` e `/ws` pro
backend — é o modo de trabalhar no visual. Já `npm run build` + copiar `web/dist` para
`backend/app/static` reproduz **exatamente** o que roda em produção (um servidor só,
mesma origem); é assim que se testa service worker, PWA e push, que não funcionam
direito com duas origens.

Conferir se está tudo de pé depois de mexer no backend:

```bash
cd "D:/beckup/arquivo env/app-casal/backend" && .venv/Scripts/python.exe smoke_test.py
```

Sai com código 1 se qualquer verificação falhar. **Nenhuma etapa é considerada pronta
sem o bloco dela passando aqui.**

No Claude Code, os dois estão em `.claude/launch.json` como `casal-api` e `casal-web`.

### O ciclo de trabalho (é este, sempre)

Depois de mexer no app, para ver o resultado como ele será em produção:

```bash
cd "D:/beckup/arquivo env/app-casal/web" && npm run build && cd .. && rm -rf backend/app/static/assets && cp -r web/dist/* backend/app/static/ && echo publicado
```

> ### ⚠️ Isso publica só na SUA MÁQUINA
>
> Copiar `web/dist` pro `backend/app/static` atualiza o que roda em
> `localhost:8020`. **Não encosta em produção.** O site em
> `https://nossoamor.209.50.229.119.sslip.io` sai de OUTRO lugar: o repositório
> de deploy em `.deploy-repo/` (GitHub `wisthailonbazot-rgb/nosso-amor`), que o
> Coolify constrói pelo Dockerfile.
>
> Já aconteceu de tudo ser testado e aprovado no local, o dono abrir o link no
> celular e ver a versão velha. Pra publicar de verdade, ver **"Publicar em
> produção"** logo abaixo.

**Duas pegadinhas que já custaram tempo aqui:**

1. O `dev_server.py` **não recarrega sozinho**. Depois de mexer no backend é preciso
   parar e subir de novo — senão a rota nova simplesmente não existe, e o app quebra
   com um erro que não explica nada. (Foi o que aconteceu, e por isso rota de API
   desconhecida agora responde 404 em vez de devolver a página.)
2. `rm -rf backend/app/static/assets` antes de copiar: sem isso os arquivos antigos
   ficam lá, e o navegador pode servir uma mistura das duas versões.

### Publicar em produção (o passo que falta depois de tudo passar)

O site público **não** sai da pasta de trabalho: sai de `.deploy-repo/`, que é um
repositório git separado apontando pro GitHub `wisthailonbazot-rgb/nosso-amor`. O
Coolify constrói dali pelo `Dockerfile` — que compila o `web/` sozinho, então o
`dist` **não** vai versionado.

```bash
cd "D:/beckup/arquivo env/app-casal" && rm -rf .deploy-repo/backend/app .deploy-repo/web/src .deploy-repo/web/public && cp -r backend/app .deploy-repo/backend/app && cp backend/dev_server.py backend/requirements*.txt .deploy-repo/backend/ && cp -r web/src web/public .deploy-repo/web/ && cp web/index.html web/package.json web/package-lock.json web/vite.config.js web/capacitor.config.json .deploy-repo/web/ && cp Dockerfile .dockerignore HANDOFF.md BACKLOG.md .deploy-repo/ && rm -rf .deploy-repo/backend/app/static .deploy-repo/backend/app/__pycache__ .deploy-repo/backend/app/routers/__pycache__
```

Depois commitar e empurrar em `.deploy-repo/`, e disparar o build (o token está em
`../env-coolify.txt`, fora deste projeto):

```bash
cd "D:/beckup/arquivo env" && TOKEN=$(grep "^COOLIFY_TOKEN=" env-coolify.txt | sed 's/^COOLIFY_TOKEN= *//' | tr -d '
') && curl -s -X POST -H "Authorization: Bearer $TOKEN" "https://painel.barbeariabazot.com/api/v1/deploy?uuid=q13k8ab4ps5elmhoio0mov3t&force=true"
```

**Como saber se subiu mesmo:** o nome do arquivo do bundle é um resumo do
conteúdo. Se o `/assets/index-XXXX.js` que o site serve for o mesmo que o
`npm run build` gerou aqui, é a mesma versão. Procurar nomes de função no bundle
**não** serve — o build minifica e renomeia tudo; procure TEXTO que aparece na
tela ("Fazer carinho", "Entrar em casa").

### A bancada de arte: `/lab`

Rota escondida (nenhum menu aponta pra ela) que desenha **toda** peça de arte isolada:
30 móveis nas 4 rotações, 48 peças de avatar, 13 ícones de item e 24 figurinhas.

Ela se testa sozinha: cada peça é pintada num canvas de rascunho e os pixels são
contados. Peça que não desenha nada aparece **marcada em vermelho** — é a forma de
pegar o desenho quebrado sem depender de alguém reparar na tela cheia.

---

## 3. Arquitetura

```
  iPhone (PWA, Tela de Início) ┐
  Android (PWA ou APK)         ┼── HTTPS/WSS ──► FastAPI ──► PostgreSQL
  navegador                    ┘                 (Coolify/VPS)   (Coolify/VPS)
                                                     │
                                          Web Push (VAPID) ──► APNs / FCM
```

Um container só serve a API **e** o app: o mesmo build do React é servido pelo FastAPI,
então navegador e APK falam com a mesma origem e não existe problema de CORS nem de
endereço cravado.

---

## 4. Mapa dos arquivos

```
app-casal/
├── HANDOFF.md                    ← este arquivo, leia primeiro
├── BACKLOG.md                    ← o que falta + todo pedido do dono, com data
├── PROMPT-CONTINUAR.md           ← texto pronto pra colar num chat novo
├── docs/projeto-app-casal.md     ← escopo original (histórico)
│
├── backend/
│   ├── dev_server.py             ← sobe local com SQLite + usuários de teste
│   ├── smoke_test.py             ← a rede de segurança; chama os três abaixo
│   ├── test_economy.py           ← carteira, check-in, tarefas, loja, avatar
│   ├── test_cycle.py             ← o cálculo do ciclo contra a literatura
│   ├── test_couple.py            ← chat, arquivos que vêm de fora, toques, datas
│   ├── test_games.py             ← memória e naval, INCLUSIVE o teste de vazamento
│   └── app/
│       ├── main.py               ← rotas, WebSocket, mídia, servidor do app
│       ├── config.py             ← TODA variável de ambiente entra por aqui
│       ├── clock.py              ← data/hora de Brasília — LEIA antes de mexer com data
│       ├── db.py                 ← engine (e a correção de transação do SQLite)
│       ├── models.py             ← as 25 tabelas
│       ├── migrations.py         ← adiciona coluna nova sem quebrar deploy
│       ├── seed.py               ← primeiro boot; idempotente
│       ├── catalog.py            ← conteúdo do jogo (cômodos, loja, quiz)
│       ├── economy.py            ← carteira; ninguém mexe em saldo fora daqui
│       ├── periods.py            ← chave de período das tarefas que se repetem
│       ├── cycle_science.py      ← o cálculo do ciclo E as fontes clínicas
│       ├── media_store.py        ← recebe foto/áudio de fora com segurança
│       ├── push.py               ← Web Push + limpeza de aparelho morto
│       ├── realtime.py           ← WebSocket (exige 1 worker)
│       ├── security.py           ← senha, token, trava de força bruta
│       ├── settings_store.py     ← ajustes do casal (chave → JSON)
│       ├── vapid_keys.py         ← gera o par de chaves do push (rodar uma vez)
│       └── routers/
│           ├── auth.py           ← login, /api/me, troca de senha
│           ├── push_routes.py    ← assinatura de aparelho + tela de avisos
│           ├── wallet.py         ← saldo, check-in, sequência, extrato
│           ├── tasks.py          ← tarefas e conclusões por período
│           ├── shop.py           ← loja, inventário, consumo
│           ├── avatar.py         ← guarda-roupa, com validação de posse
│           ├── cycle.py          ← ciclo, calendário e privacidade
│           ├── chat.py           ← mensagens, figurinha, foto, áudio
│           ├── couple.py         ← toques, datas, mural
│           └── games.py          ← memória (sozinho) e batalha naval (a dois)
│
└── web/
    ├── public/                   ← manifest, service worker, ícones, fontes locais
    │   └── cartas/               ← as 14 cartas da memória (a ÚNICA arte em arquivo)
    └── src/
        ├── api.js                ← toda chamada HTTP passa aqui
        ├── store.js              ← sessão + WebSocket + presença (Zustand)
        ├── push.js               ← ligar notificação + diagnóstico do aparelho
        ├── petVoz.js             ← a VOZ de cada espécie, sintetizada
        │                            (harmônico + ruído + formantes)
        ├── lib/dates.js          ← irmão do clock.py, do lado do app
        ├── render/               ← motor de pixel art (nada é arquivo de imagem)
        │   ├── pixel.js          ← rasterização própria (borda dura, sem suavizar)
        │   ├── iso.js            ← projeção 2:1, bloco isométrico, ordem de desenho
        │   ├── furniture.js      ← 30 móveis: cada um compõe blocos
        │   ├── room.js           ← parede, piso e ordem de desenho do cômodo
        │   ├── RoomCanvas.jsx    ← o cômodo na tela (escala inteira, toque → célula)
        │   ├── avatar.js         ← o boneco: 8 camadas, 48 peças
        │   ├── petCena.js        ← o cenário da ilha atrás do bichinho (céu, mar,
        │   │                        campo, hora do dia), na tela dele
        │   ├── petPalco.js       ← o que ele FAZ no palco: anda, vira, faz truque
        │   │                        e vem lamber a câmera (Kinectimals)
        │   ├── petitems.js       ← 13 ícones de item, escritos como texto
        │   └── stickers.js       ← as 24 figurinhas do chat
        ├── components/           ← Icon (SVG desenhado), AvatarView, Sticker,
        │                            ItemPreview, LoveTaps, ErrorBoundary
        └── screens/              ← uma tela por rota, + /lab (a bancada)
```

---

## 5. Armadilhas que já estão tratadas (não desfaça sem ler)

1. **Dia de calendário nunca vira instante.** `2026-08-22` mandado como datetime volta
   pro navegador como 21/08 21:00 no fuso de Brasília, e a partir das 21h o app
   discorda do calendário. Regra: dia é texto `YYYY-MM-DD` nos dois lados
   (`clock.py`, `lib/dates.js`). No app, `new Date('2026-08-22')` é proibido.

2. **Moeda dobrada é corrida, não `if`.** Toque duplo no botão dispara duas requisições
   ao mesmo tempo; um `if já_ganhou` deixa as duas passarem. Quem barra é o índice
   único de `dedupe_key` em `wallet_transactions`, no banco.

3. **Saldo é cache.** A verdade é a soma de `wallet_transactions`. `economy.audit()`
   compara os dois, e o teste de fumaça falha se discordarem.

4. **Desfazer tarefa libera a chave de duplicidade.** Sem isso, refazer a mesma tarefa
   no mesmo período não pagaria nada e ninguém entenderia o motivo. A linha do extrato
   **não** é apagada — só a chave é aposentada.

5. **`db.rollback()` no meio de uma operação apaga a operação inteira.**
   Este foi o pior bug até agora, e a bateria de economia pegou. Quando um aviso ou
   uma recompensa repetida batia no índice único, o código chamava `db.rollback()` —
   que desfaz a transação toda, não só a linha repetida. Resultado: concluir tarefa
   respondia "ganhou 10 corações" e **não gravava nada**. A conclusão e o crédito
   iam junto, em silêncio, e a tela mostrava sucesso.
   Corrigido com ponto de salvamento (`db.begin_nested()`) em `economy._move` e
   `push.send_to_user`. **Regra:** nenhuma função chamada no meio de uma rota pode
   dar `rollback()` na sessão — ela isola o próprio erro ou deixa a exceção subir.

6. **O SQLite mentia sobre rollback.** O driver do Python abre transação por conta
   própria, e com isso `SAVEPOINT` não isolava e `rollback()` deixava linha pra trás.
   Produção é PostgreSQL e não tem o problema — mas o teste roda em SQLite, e um teste
   que mente sobre rollback é pior do que não ter teste. `db.py` desliga o controle
   automático do driver e emite o `BEGIN` na mão.

7. **Semente nunca sobrescreve senha.** Se sobrescrevesse, trocar a senha no app seria
   desfeito no próximo deploy.

8. **Um worker só.** O WebSocket guarda as conexões em memória; com dois processos, um
   receberia o evento e o outro não, e o chat pareceria mudo pra uma das pessoas.

9. **Push no iPhone tem três condições que falham caladas**: precisa estar aberto pela
   Tela de Início (não pelo Safari), a permissão só pode ser pedida dentro de um toque,
   e exige iOS 16.4+. A tela de Perfil mostra qual das três falhou, em português.

10. **Token de mídia ≠ token de sessão.** `<img src>` não manda cabeçalho, então o token
   vai na URL — e URL vaza. O token de mídia só abre arquivo, não abre a API.

---

## 6. O que mudou em relação ao documento original

| Documento | Aqui | Motivo |
|---|---|---|
| Supabase self-hosted | FastAPI + PostgreSQL | A VPS tem 2,1 GB livres e zero swap; o Supabase engoliria a folga e o kernel mataria o app da barbearia. A alternativa já estava prevista na seção 5 do documento. |
| Expo / React Native | React + Vite (PWA, e APK por Capacitor) | Reaproveita o caminho do `hvac-system`, que já está no ar. |
| AltStore no iPhone | PWA pela Tela de Início | Sem PC ligado, sem renovar toda semana, sem expirar em 7 dias. |
| Supabase Realtime | WebSocket próprio | Sem serviço extra num servidor apertado. |
| TanStack Query | Estado próprio + WebSocket | Com o servidor empurrando a verdade, um cache de consulta viraria uma segunda fonte da verdade. |
| Camadas de PNG | SVG e pixel art desenhados por código | PNG exigiria centenas de desenhos antes da primeira tela funcionar; assim, item novo é uma linha no catálogo. |
| Casa em grid 2D de cima | Isométrico 2.5D | Escolha do dono em 23/08. |
| `tasks.status` | `task_completions` com chave de período | `status` na tarefa não sobrevive a tarefa diária: concluir hoje apagaria ontem. |
| `role ('bazot'\|'namorada')` | `users.tracks_cycle` (booleano) | O módulo aparece pra quem menstrua sem o código adivinhar quem é quem. |

---

## 7. Deploy (ainda não feito)

Mesmo caminho do `hvac-system`, que já funciona:

1. Coolify → banco PostgreSQL novo, anotar a `DATABASE_URL` interna.
2. Coolify → aplicação, build pack **Dockerfile**, porta 8000.
3. **Limite de memória no container** — é o que protege os outros projetos.
4. Variáveis: `DATABASE_URL`, `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `USER_A_*`, `USER_B_*`, `CYCLE_OWNER_SLUG`, `COUPLE_START_DATE`,
   `STORAGE_DIR` (volume de disco, senão as fotos somem no deploy).
5. Gerar as chaves VAPID uma vez: `python -m app.vapid_keys`.

---

## 8. Para onde o jogo vai (decidido em 23/08)

O app deixa de ser "telas separadas" e vira um mundinho. Isso muda o alvo das Etapas
4 e 6, então está registrado aqui antes de qualquer código ser escrito.

### 8.1 O bairro em 2,5D — o próximo passo grande

Hoje a loja é uma lista. O alvo é ela virar **um lugar**: uma rua isométrica por onde
o avatar anda, com a casa do casal de um lado e comércio do outro. Comprar ração passa
a ser ir até o mercado.

O motor de pixel isométrico que já existe (`web/src/render/`) foi feito pensando nisso
e não precisa ser trocado — o que muda é a escala e o que entra na cena:

| Peça | O que já existe | O que falta |
|---|---|---|
| Projeção e blocos | `iso.js`, pronto | nada |
| Ordem de desenho | `depthSort`, pronto | ordenar também o avatar andando |
| Cômodo | `room.js` desenha 1 cômodo com 2 paredes | planta com **vários cômodos**, paredes internas, portas |
| Terreno e rua | — | grama, calçada, asfalto, muro, portão |
| Prédios da rua | — | fachadas (mercado, petshop) como blocos com porta |
| Avatar no mundo | avatar existe como configuração | sprite andando em 4 direções, com colisão |
| Navegação | rotas separadas | entrar num prédio = trocar de cena, guardando de onde veio |

**Ordem sugerida** (cada passo já entrega algo usável):
1. casa com vários cômodos (planta em vez de um retângulo);
2. terreno em volta: quintal, muro, calçada;
3. rua na frente, com o avatar andando entre a casa e a rua;
4. fachadas com porta que leva pra dentro (mercado primeiro);
5. a loja atual vira o interior do mercado — as rotas de compra **não mudam**, só a
   forma de chegar nelas.

**Cuidado técnico já identificado:** o cômodo hoje é desenhado inteiro a cada quadro.
Isso é barato com 8×8 células, mas não com uma rua. Quando chegar lá, o fundo estático
(chão, parede, prédio) tem que ser desenhado uma vez num canvas separado e só o que se
move é redesenhado por cima — senão o celular esquenta e a bateria vai embora.

**Base entregue na Etapa 4 (23/08/2026):** a casa já tem planta persistida com sala,
cozinha, quarto, varanda e quintal; editor ligado ao inventário permite adicionar,
arrastar, girar, guardar, trocar acabamentos e salvar com revisão otimista. O lote
externo já desenha muro, portão, caminho, calçada e rua. Isso é o terreno da casa,
não o mapa navegável do bairro: avatar andando, fachadas e mercado continuam como o
próximo passo grande desta seção.

### 8.2 O bichinho tem que dar trabalho

A decisão é explícita: **não pode ser um botão de carinho sem consequência**. Ele suja,
tem fome, fica triste se for esquecido — e **suja a casa**, o que liga o módulo do
bichinho ao da casa (sujeira aparece como item no cômodo e alguém precisa limpar).
Também tem **várias espécies** pra escolher no começo.

Isso encosta na economia: cuidar custa itens comprados, e descuidar custa progresso.
O equilíbrio precisa de teste com o relógio adiantado, igual ao que já existe pro
check-in em `test_economy.py`.

**Implementado em 23/08/2026:** seis espécies com taxas diferentes; quatro atributos
com sobra fracionária (ler a tela muitas vezes não congela o decaimento); energia se
recupera descansando quando alimentado; abandono derruba os atributos, adoece e para
o ganho de XP; sujeira nasce em célula livre do cômodo e bloqueia móvel até ser limpa;
comida/banho gastam inventário, brinquedo e carinho têm descanso, e acessórios são
vestidos no sprite. A tela mostra prazo até zerar para o dono entender que o tempo
está correndo. `test_pet.py` cobre inclusive 30 dias largado e o caminho real de
recuperação — não existe estado sem volta.

O navegador encontrou uma corrida que o teste sequencial não via: HTTP e WebSocket
gravando juntos no SQLite local podiam dar `database is locked`. A bancada agora usa
WAL + espera de 30 s (`app/db.py`), com duas verificações no smoke. Produção continua
PostgreSQL e não usa esses PRAGMAs.

Os sprites receberam silhueta, cauda, patas, luz no pelo, bochechas, marcas por
espécie, acessórios e animação. O jogo `Pega a bolinha` é deliberadamente o único
minigame desta entrega: mexe em energia/alegria/XP no servidor e descansa dois
minutos. Velha, forca, quiz, memória, damas e jogos de cartas ficam adiados para
depois da casa e do mapa do bairro.

O bichinho também mora dentro da cena isométrica da casa. Ele pode ser chamado para
qualquer cômodo aberto (o servidor persiste e sincroniza `room_code`) e procura uma
célula livre perto da caminha, pote, arranhador, casinha ou sofá. A animação e a frase
mudam conforme o móvel encontrado; sujeira e móveis continuam ocupando células, então
ele não aparece atravessando objetos. O ciclo adicionar → girar → arrastar → salvar →
recarregar foi executado no navegador. O renderer simplificado da casa foi removido:
a casa e a tela do pet agora chamam exatamente o mesmo `drawPet`, incluindo espécie,
cores, humor e acessórios. Há um botão de interação no cômodo que aplica carinho real
no servidor (com o mesmo descanso da tela de cuidados) e toca o som da espécie. Nesse
teste apareceu e foi corrigida uma dupla
inversão de largura/profundidade ao mover um móvel já girado.

O service worker também passou a usar rede primeiro para JS/CSS (`casal-v2`). O cache
primeiro podia misturar módulos de builds diferentes e quebrar os hooks do React até
limpar os dados do navegador.

**Revisão visual de 23/08/2026:** a vista externa deixou de desenhar quatro blocos.
Agora é uma fachada única com telhado contínuo, e sua largura/profundidade cresce de
acordo com o total de cômodos internos abertos. Céu, nuvens, sol, pássaro e árvore são
animados no próprio canvas; o fundo do cômodo também tem cenário animado. A sala nasce
com sofá, mesa, caminha e comedouro, todos pertencentes ao casal. O editor devolve
`placed` e bloqueia a segunda cópia já no clique, além da trava autoritativa que
continua no servidor. Pisos e paredes ganharam amostras coloridas/texturizadas.

A loja do pet agora vende seis licenças de espécie. Depois da compra, “Escolher” troca
o animal ativo sem apagar nome, atributos ou progressão. O chat passou de 18 para 24
figurinhas; as seis novas são sugestivas e não explícitas. `sound.js` usa Web Audio
procedural, inicializado no primeiro toque (regra obrigatória do Safari/iOS), com sons
de navegação, compra, sucesso, jogo e timbres próprios por espécie; não baixa áudio e
funciona também em Android.

O jogo agora se chama **Aventura da bolinha**: alvo muda sozinho, acelera com a
pontuação, tem três vidas, combo, limite de 12 e retorno de energia/alegria/XP no
servidor. O banco local foi reiniciado após os testes: ambos os usuários têm 1.000
Corações, pet ainda não escolhido, somente a sala inicial básica e nenhum histórico.

### 8.4 Tempo real — falha corrigida em 23/08/2026

As rotas HTTP são funções síncronas e rodam em worker thread. O `publish()` antigo
tentava `asyncio.get_running_loop()` nessa thread, recebia `RuntimeError` e retornava
sem enviar nada. Por isso chat e casa só atualizavam depois de recarregar. O `Hub`
agora registra o loop do WebSocket em `connect()` e usa
`asyncio.run_coroutine_threadsafe`. O smoke abre um WebSocket real, envia mensagem
por HTTP e exige o evento correto em até três segundos. Não retirar esse teste.

### 8.3 Chat de verdade

Estrutura parecida com a do WhatsApp, com **figurinhas** (como no Love8) e **envio de
áudio**. O áudio traz coisa nova pro backend: gravar no navegador, subir o arquivo,
guardar no volume de disco e servir com o token de mídia que já existe.

---

## 9. Estado hoje (23/08/2026)

- Etapa 1 pronta e testada.
- Teste de fumaça: **488 verificações, 0 falha** — `smoke_test.py` chama também
  `test_pet.py` e `test_house.py`; inclui progressão, abandono, recuperação, planta,
  posse, colisão, acabamentos e conflito de edição.
- Etapa 2 pronta: carteira, check-in com sequência, tarefas, loja, avatar — com as
  telas já na direção de arte nova.
- Motor de pixel isométrico funcionando; a tela da casa já desenha um cômodo real.
- Bancada `/lab` confere sozinha se toda peça de arte desenha algo (30 móveis nas
  4 rotações, 6 bichinhos × 3 estágios, 4 humores + 4 acessórios, 48 peças de
  avatar, 13 itens, 37 figurinhas) — rota escondida, sem link em menu nenhum.
- Etapa 3 pronta: ciclo com base clínica citada, privacidade em três níveis, chat
  estilo WhatsApp com figurinha e áudio, mural de momentos, toques de saudade e
  datas importantes.
- Etapa 4, bloco do pet pronto: escolha entre seis espécies, sprite em pixel por
  estado, decaimento, doença, evolução, inventário, descanso, acessórios e sujeira
  ligada à casa. Prints em `docs/screenshots/pet-adocao.png` e
  `docs/screenshots/pet-cuidados-topo.png`.
- Etapa 4 pronta: casa/editor/terreno/rua, 30 móveis desenhados, chat em tempo real
  corrigido e um jogo do pet. Provas em `docs/screenshots/casa-terreno.png`,
  `casa-arrastar-salvo.png`, `loja-moveis-novos.png`, `chat-tempo-real.png`,
  `pet-redesenhado.png` e `jogo-pet.png`.
- O pet agora aparece e interage dentro do cômodo; prova do arraste, rotação,
  persistência e interação em `docs/screenshots/casa-pet-interacao.png`.
- Produção no ar em `https://nossoamor.209.50.229.119.sslip.io`, isolada no Coolify.

**Revisão de progressão e perfil (23/08/2026):** `/tarefas` agora gera cinco missões
compartilhadas por dia a partir de uma rotação determinística. Elas avançam somente
por ações reais registradas no servidor (chat, cutucada, check-in, compra, edição da
casa e cuidados/jogo do pet), têm meta com teto e, quando recebidas, pagam a mesma
quantia para os dois com chave anti-duplicidade por usuário. Cada cinco missões
recebidas aumenta o nível conjunto. As tarefas manuais continuam separadas abaixo.

O perfil agora permite alterar o próprio nome e a data de início, com validação no
servidor, e aponta claramente para o montador completo do personagem. A referência
enviada pelo dono virou 13 novas figurinhas pixel-art e seis novos cutucões; o pacote
passou de 24 para **37 figurinhas**, todas conferidas pela bancada `/lab` sem desenho
vazio. O smoke passou com **498 verificações, 0 falha** e a build Vite passou.

**Deploy móvel concluído:** as credenciais válidas estavam em `env-coolify.txt`. A
aplicação `q13k8ab4ps5elmhoio0mov3t` foi publicada pelo Dockerfile em
`https://nossoamor.209.50.229.119.sslip.io`, com PostgreSQL exclusivo
`gqn59a5xe8hk2rf6utzpa34w`, volume persistente, limites de memória/CPU e variáveis
somente de execução. Login dos dois perfis, saúde, missões, saldos de 1.000 Corações
e entrega WSS entre parceiros foram validados na aplicação pública.

### 9.1 Pacote móvel local (23/08/2026)

O frontend agora tem Capacitor 8 e o projeto Android nativo em `web/android`, com o
identificador `com.nossoapp.casal`, Android mínimo 7.0 (API 24) e alvo API 36. O APK
de depuração foi compilado com o JDK 21 e SDK Android portáteis guardados somente em
`.tools/`, sem instalar nem alterar ferramentas dos outros projetos. O pacote passou
no `apksigner` (assinatura v2), no `aapt` e no Gradle. Uma cópia de entrega fica em
`releases/NossoApp-casal-android.apk`.

O pacote final usa `https://nossoamor.209.50.229.119.sslip.io`, desabilita tráfego
HTTP em claro e funciona em qualquer rede com internet. O login e todos os dados
continuam no mesmo FastAPI/PostgreSQL; não há uma base separada dentro do APK.

A PWA para iPhone está no mesmo endereço HTTPS, com manifesto, service worker e tags
Apple. No Safari, usar Compartilhar → Adicionar à Tela de Início. O APK entregue é
instalável e assinado com a chave de depuração do Android; para publicar na Play Store
será necessário criar uma chave de release definitiva.

Validação desta etapa: **498 verificações, 0 falha**, `npm run build` e Gradle
aprovados, APK v2 inspecionado (SHA-256
`2EA12DA09CF0A13E2417AB6BB53635AB2B640CAEBAAD5DAF53B03C4812C6C80B`), saúde
HTTPS e tempo real WSS aprovados em produção.

### 9.2 Revisão final da Etapa 4 (23/08/2026)

Três defeitos que só apareceram na conferência de verdade — vale ler antes de mexer
no motor de desenho, porque os dois primeiros são do tipo que não dá erro nenhum:

1. **`requestAnimationFrame` não roda em aba que o navegador não está compondo.**
   Todo canvas do app desenhava só dentro do laço de animação, então aba em segundo
   plano, celular com a tela travada ou app minimizado devolviam um retângulo
   **em branco** — sem erro, sem log, sem nada. Foi medido: `document.hidden` verdadeiro,
   **zero** quadros em 1,5 s, e os seis canvases das espécies com 0 pixel pintado.
   Corrigido em `RoomCanvas`, `PetCanvas` e `PropertyCanvas`: **um quadro é pintado
   na hora**, de forma síncrona, antes de pedir o primeiro quadro animado.
   Cuidado ao mexer: em `PropertyCanvas` o `draw` agenda o próximo quadro sozinho,
   então chamar `draw()` **e** `requestAnimationFrame(draw)` cria dois laços no
   mesmo canvas e a cena pisca.

2. **`Icon` devolve `null` para nome que não existe.** As telas novas usavam `drop`,
   `sparkle` e `lock`, que nunca foram desenhados — os ícones das barras de atributo
   do bichinho simplesmente não apareciam, calados. Os três foram desenhados. Para
   conferir depois de acrescentar tela nova:

   ```bash
   cd "D:/beckup/arquivo env/app-casal" && grep -ohE 'name="[a-zA-Z_]+"' web/src/screens/*.jsx web/src/components/*.jsx | sed -E 's/name="([a-zA-Z_]+)"/\1/' | sort -u > /tmp/used.txt; grep -oE "^\s{2}[a-zA-Z_]+:" web/src/components/Icon.jsx | sed -E 's/[ :]//g' | sort -u > /tmp/have.txt; comm -23 /tmp/used.txt /tmp/have.txt
   ```

3. **A casa mentia sobre o bichinho.** A linha do cômodo dizia "tirando uma soneca
   na caminha" com ele doente e doze sujeiras no chão: a legenda saía do móvel
   favorito e ignorava o estado. Agora o estado ruim (doente / faminto / imundo /
   triste / casa suja) vem **antes** do móvel — é justamente o aviso que o dono
   precisa ver.

A bancada `/lab` ganhou as abas **Bichinhos** e **Humores** porque o bichinho era a
única arte do app que ninguém conferia sozinha — e foi exatamente onde o defeito 1
apareceu primeiro.

Conferido no navegador, contra o app publicado (`web/dist` copiado pro
`backend/app/static`, igual à produção): as 6 espécies desenham (2.580 a 3.853 pixels
cada, silhuetas diferentes), adoção pela tela funciona ponta a ponta, o editor
recusa o segundo móvel com "Vocês só têm 1 de Mesa", comprar → posicionar → girar →
salvar persiste (revisão 2 → 3, saldo 1.000 → 880) e um coelho largado 48 horas
chega a fome 0, alegria 0, higiene 8, **doente**, com **12 sujeiras** espalhadas pela
sala nos 4 tipos e nenhuma em cima de móvel. Com sujeira, o desenho do cômodo muda
(conferido por resumo da imagem); sem ela, volta ao anterior.

### 9.3 Rodada de validação no aparelho (23/08/2026)

O dono rodou no iPhone e no APK e voltou com uma lista. O que foi achado e feito:

**A causa da foto e do áudio não funcionarem no APK — e não era mídia.**
O servidor devolve o caminho **relativo** da mídia (`/media/x.jpg?token=…`), porque
não tem como saber com segurança por qual endereço público está sendo acessado. No
navegador isso resolve sozinho, porque o app é servido pelo próprio backend. Dentro
do APK, não: o app roda de `https://localhost`, e ali `/` é **o pacote embutido no
aparelho** — sem API e sem foto. A imagem quebrava e o áudio não tocava, calados.
Corrigido com `mediaUrl()` em `api.js`; **toda** foto, miniatura e áudio passa por ele.

Junto disso, duas coisas no Android que faltavam:
- `RECORD_AUDIO` no `AndroidManifest.xml`. Sem ela o `getUserMedia({audio:true})` da
  WebView falha **antes** de o Android pedir permissão — o áudio não gravava e não
  aparecia erro nenhum. Entraram também `READ_MEDIA_IMAGES` e `POST_NOTIFICATIONS`.
- O script `android:apk` chamava `npm run build`, **sem** o endereço do servidor —
  ou seja, gerava um APK que não fala com backend nenhum. Agora existe
  `npm run build:apk`, que usa `vite build --mode apk` e lê `web/.env.apk`.

> **Dois builds, de propósito.** `npm run build` (o que o FastAPI serve) tem que
> continuar **sem** endereço: lá o app e a API são a mesma origem. `npm run build:apk`
> crava o endereço. Trocar o endereço do servidor exige APK novo nos dois celulares —
> a mesma pegadinha já documentada no `hvac-system`.

**Notificação.** O encanamento está certo e a produção responde `push_enabled: true`
com chave VAPID. O que faltava no app era o **aviso com o app aberto**: quem ouvia o
cutucão era um componente que morava dentro da tela de Início, então trocar de aba
parava de receber. Agora existe `AvisosAoVivo`, montado no casco (`App.jsx`), fora
das rotas: cutucão vira chuva de figurinha e mensagem do parceiro vira faixa clicável
no topo, **em qualquer tela** — menos dentro do próprio chat, onde seria repetição.

Sobre o Android: o dono pediu "faz igual ao HVAC". Conferi o `hvac-system` e ele
**não tem notificação nenhuma** — as dependências de lá são `@capacitor/filesystem` e
`@capacitor/share`, pra PDF. O que aquele projeto resolveu, e que serve aqui, é o
endereço cravado (acima). **WebView do Android não entrega Web Push**: no APK isso
exige push nativo (Firebase/FCM) ou instalar como PWA pelo Chrome. Decisão pendente.

**"Interagir" com o bichinho na casa.** O botão chamava direto o carinho, que tem
descanso de 4 horas de propósito. Fora dessa janela o servidor recusava com 400, a
tela pintava erro e **nada acontecia com o bicho** — parecia quebrado. O conserto não
foi tirar o descanso (é decisão travada: carinho não pode ser botão sem consequência),
e sim **separar reação de prêmio**: encostar nele sempre faz ele pular e soltar
coração; só a alegria é que espera as 4 horas, e a recusa virou aviso, não erro.

**A casa estava empilhada.** Media **1.587 px de altura num visor de 918**: vista
externa, legenda, abas de cômodo, cômodo, linha do bichinho e editor, tudo na mesma
rolagem. Virou duas abas — "Do lado de fora" e "Por dentro" — com a **fachada inteira
clicável** pra entrar. Cada vista agora cabe na tela (812 px, sem rolagem lateral).

**O bichinho não pode ficar parado.** A posição dele vinha de uma conta feita uma vez
e nunca mudava. Agora existe `web/src/render/petWander.js`: ele escolhe um lugar livre,
**caminha** até lá em posição fracionária (a projeção isométrica aceita fração), para
e escolhe outro. Medido no navegador: **61 posições distintas em 6 segundos**.

Dois cuidados que isso trouxe:
1. O bichinho entrou na **ordem de profundidade** junto com os móveis. Enquanto ficava
   parado num canto, desenhar por último passava despercebido; andando, ele passaria
   por cima do sofá.
2. `scene.pet` agora pode ser uma **função do instante**. Um objeto fixo só mudaria
   quando o React re-renderizasse — ou seja, ele voltaria a ficar parado.

`drawPet` passou a receber `pet.action` e anima por ação: andar (poeira do passo),
comer (potinho e migalhas), banho (espuma e bolhas subindo), brincar/feliz (pulo e
coraçõezinhos) e dormir (respiração lenta e os "z"). Tudo desenhado, nada de emoji.

**Jogo novo: corrida do bichinho** (`web/src/render/PetRunner.jsx`), escolhido pelo
dono. Ele corre, você toca pra pular; pedra tira vida, ossinho vale ponto. Usa o mesmo
`drawPet`, então o acessório comprado aparece no jogo. A rota `/api/pet/game` foi
generalizada: `JOGOS` guarda teto de pontos, descanso e energia de cada um, num lugar
só, e placar acima do teto é recusado (só chega assim se o app foi adulterado).

> **O prêmio em moeda é o ponto perigoso.** Se fosse por partida, bastava ficar
> jogando pra imprimir Coração. São **12 Corações uma vez por dia, por jogo e por
> pessoa**, garantidos pelo índice único de `dedupe_key` — não por um `if`. Jogar mais
> continua valendo pela alegria do bichinho; só o dinheiro tem torneira fechada. A
> bateria cobre isso: cinco partidas seguidas e o saldo não se mexe.

**Figurinhas da foto de referência.** As 18 conferidas uma a uma; 17 já existiam e
faltava só **"Uau"**, agora desenhada. O seletor passou a mostrar o **nome embaixo de
cada figurinha**, como na referência — sem nome, "grudinho" e "toma s2" viravam dois
bonequinhos parecidos. A bancada `/lab` agora reprova figurinha **sem nome** do mesmo
jeito que reprova figurinha que não desenha.

**Armadilha em que eu mesmo caí, e que já estava escrita na seção 2:** o
`dev_server.py` **não recarrega**. Testei o prêmio da corrida contra um servidor com a
rota antiga, vi "não pagou" e quase fui atrás de um bug que não existia. Depois de
mexer no backend, **pare e suba de novo** antes de concluir qualquer coisa.

Estado: **516 verificações, 0 falha**. Bancada: 30 móveis × 4 rotações, 18 bichinhos,
8 humores, 13 itens e 38 figurinhas — nenhuma vazia e nenhuma sem nome.

**Próximo passo:** seção 8.1 — mapa navegável do bairro: avatar andando na rua,
fachadas e mercado como lugar. Os outros minigames continuam depois desse passo.

### 9.4 Motor de animação do bichinho (24/08/2026)

O pedido do dono foi que os bichinhos deixassem de ser "muito simplificados": motor
melhor, animações completas por espécie (gato e cachorro deitando/andando/pulando,
dragão e pássaro voando, coelho saltitando), interação com caminha/brinquedo/comida,
evolução de filhote a adulto, reação ao toque, minigames em tela cheia e a corrida
controlada por arrasto.

**Por que o desenho antigo tinha chegado ao limite.** Ele era uma pilha de retângulos
com UM número de deslocamento vertical (`bob`, de 0 a 2 px). Andar, comer, tomar banho
e dormir usavam a mesma peça, só com período diferente — não existia perna, joelho,
nem asa que batesse. Acrescentar uma ação significava mais um `if` no meio do desenho,
e acrescentar uma espécie, mais um `if` no meio das ações: cada um multiplicava o outro.

Agora existe `web/src/render/petRig.js`, com três camadas separadas:

| Camada | O que é | O que NÃO sabe |
|---|---|---|
| `planoDe(especie, g)` | quanto mede cada parte | nada de tempo nem de animação |
| `CLIPES[nome].pose(ph, plano)` | o que cada parte faz neste instante | nada de desenho |
| `desenharRig(p, plano, pose, cores)` | pinta o esqueleto posado | qual ação está rodando |

São **22 clipes** (parado, andar, correr, saltitar, pular, sentar, deitar, dormir,
comer, beber, roer, banho, brincar, feliz, triste, doente, voar, planar, coçar, rolar,
implorar, cavar) × 6 espécies = 132 combinações, todas na bancada. `clipeDe()` traduz
o que a espécie sabe fazer: coelho e pássaro **saltitam** em vez de andar, e quem não
tem asa nunca voa (pedir `voar` pra capivara devolveria o bicho boiando no ar).

A perna dobra por **cinemática inversa de dois ossos**, e o traseiro dobra ao contrário
do dianteiro — é isso que entrega "quadrúpede" antes de olhar a cabeça. A marcha é
diagonal no andar e galope no correr, com uma parte do ciclo com tudo no ar.

**Evolução contínua.** `pet_care.growth_of()` devolve 0 a 1 a partir da MESMA
progressão do nível (não de um segundo relógio — se fosse tempo de vida, cuidar bem e
largar num canto dariam o mesmo adulto). O `stage` de três degraus continua para o
TEXTO; o desenho usa o número contínuo e interpola a proporção: filhote tem cabeça
grande, perna curta, focinho quase inexistente e olho enorme; crescer é a cabeça perder
espaço relativo enquanto perna, focinho e cauda ganham. Cada medida tem o seu fator —
uma escala única faria o filhote parecer só um zoom do adulto.

**Cinco defeitos reais que só apareceram medindo, e as causas:**

1. **Cápsula era um polígono que se cruzava.** As duas meias-voltas das pontas varriam
   de π/2 a 3π/2, e metade de cada arco caía DENTRO da peça. O preenchimento por
   varredura conta cruzamentos e **cancela o miolo** de um polígono em laço: a peça
   aparecia só nas duas pontas. Em perna e cauda (curtas e grossas) o buraco era
   pequeno e passou batido; na orelha do coelho — comprida e fina — engoliu a peça
   inteira, e o coelho ficou **sem orelha**. Mesmo defeito, tamanhos diferentes.

2. **Emenda em cada articulação.** Cada peça era pintada inteira (contorno +
   preenchimento) antes da seguinte, então o contorno da coxa ficava carimbado por
   cima da canela e o bichinho aparecia costurado. Agora cada camada de profundidade é
   pintada em **dois passes**: contorno de tudo, depois preenchimento de tudo. Sobra
   traço só na silhueta externa. **Regra que saiu disso:** junção de CARNE
   (coxa/barriga, pescoço/peito) é pra ser sem emenda; APÊNDICE que se destaca da
   silhueta (orelha) precisa do próprio traço, e por isso tem camada própria — foi
   justamente ao pôr a orelha junto do crânio que ela sumiu no coelho branco.

3. **As 4 cores da espécie nunca foram uma rampa de sombra.** O desenho lia
   `[principal, escuro, claro, traço]`, mas no catálogo elas são quatro cores de
   ACENTO (no gato: laranja, cinza, quase-preto, creme). Com retângulos chapados dava
   pra viver com o engano; com esqueleto, o "escuro" caía nas quatro patas e na cauda
   e o gato laranja ficava com pernas cinza-chumbo numa mancha só. `paletaDe()` deriva
   sombra e luz **da cor principal** e usa o resto como acento (asa, marca, espinho).

4. **Silhueta de dinossauro.** Tronco de uma elipse comprida + pescoço projetado pra
   frente + cabeça pequena na ponta é a silhueta de um terópode. Agora o tronco é
   peito + barriga + garupa (três massas que se sobrepõem, então as costas afundam no
   meio), a cabeça fica ACIMA do peito e o focinho é curto. A cauda nasce pra cima e
   arqueia sobre a anca — saindo na horizontal, ela virava o prolongamento do tronco.

5. **A bancada aprovava arte que ninguém veria.** `Tile` só desenhava dentro do
   `requestAnimationFrame`, que não roda em aba que o navegador não está compondo. Os
   132 blocos novos liam **zero pixel** na tela enquanto a marca "⚠ vazio" dizia que
   estava tudo certo — ela conta num canvas de rascunho, pintado de forma síncrona.
   Era a última peça do app que ainda caía nessa armadilha (ver 9.2, defeito 1).

**Acessórios.** `vestir()` agora escreve tudo em coordenadas DO BICHINHO
(`naCabeca`/`noCorpo`, que já vêm com a rotação e o tamanho da pose). A gravata pende
no eixo do pescoço (deitado, ela acompanha o peito em vez de atravessar o chão), o
chapéu é medido em fração da cabeça (servia no gato e sobrava no coelho) e os óculos
saem das MESMAS âncoras do rosto — usavam uma cópia que envelheceu quando a cabeça
mudou de lugar, e apareciam sobre o corpo no passarinho. A bancada ganhou a aba
**Vestidos**: acessório × espécie, cada um numa pose que desloca a cabeça.

**O bichinho usa a casa.** `petWander.js` tinha destino sorteado — um bicho que anda em
linha reta pra lugar nenhum. Agora o cômodo tem **pontos de interesse** (`INTERESSES`,
por código do catálogo): ele escolhe a caminha, o pote, o arranhador, o sofá, o tapete
ou a planta, anda até uma célula livre encostada nela e **faz a coisa certa lá** —
dorme, come, se coça, rola, cavuca. Sem móvel por perto existe um repertório ocioso
(sentar, deitar, coçar, rolar, brincar; voar e planar pra quem tem asa). A legenda da
casa lê esse estado, então ela conta o que se vê — sempre depois do estado ruim, que
continua vindo primeiro. Medido: "esparramado no sofá", "dormindo na caminha",
"rolando no chão" e 14 posições distintas em 4 s.

**Toque.** Na tela do bichinho, a reação depende de ONDE se toca: cabeça faz coçar,
corpo faz pular de alegria, barriga faz rolar. Dentro do cômodo o toque sorteia entre
cinco reações — uma reação única vira botão, e na terceira vez ninguém mais encosta.
O acerto no cômodo é medido em **pixel, contra onde o bichinho está DESENHADO**: o
corpo é colado ~42 px acima da célula em que ele pisa, então comparar célula com
célula só pegava quem acertasse a sombra.

**Minigames em tela cheia.** Sobreposição de CSS (`.jogo-cheio`), porque a API de tela
cheia **não existe no iPhone** fora de vídeo — pedir só ela deixaria o botão sem efeito
e sem explicação. A API nativa entra como extra no Android. Mesma lição do push no iOS.

**Corrida por arrasto** (o pedido: arrasta pra cima pula, pra baixo abaixa). O que
existia era "metade de cima da tela pula, metade de baixo abaixa" — obriga a mirar numa
metade invisível enquanto se olha pro obstáculo, e na prática só dava pra pular. Agora
a DIREÇÃO é o comando, disparada no meio do arrasto (na soltura sairia tarde demais
pra servir de reflexo); toque seco continua pulando. O quadro usa `touch-action: none`,
senão o navegador entende o arrasto vertical como rolagem e a página desce em vez de o
bichinho pular. Medido: arrastar pra cima sobe 40 px, pra baixo achata de 20 para
10 px, e volta sozinho.

Na pista, a **largura da arte é fixa em 320** e a altura é que acompanha o quadro. Na
primeira versão era o contrário, e deu errado por dois motivos medidos: o pixel deixava
de ser quadrado em tela cheia (arte 240×150 esticada num quadro 942×723) e a
dificuldade mudava, porque a distância entre obstáculos é contada em pixels de arte.

**Conferido no navegador**, contra o app publicado: 132 combinações de espécie × clipe
desenham (774 a 1.629 px); as 20 poses reais do gato são distintas entre si (as 2
repetidas são `voar`/`planar` traduzidos para `pular`, correto para quem não tem asa);
o dragão tem 22/22 distintas e voando sobe a y=15 contra y=43 parado; o crescimento é
suave e muda a proporção (aspecto 1,275 → 1,421, não é zoom). **537 verificações,
0 falha**, e a build Vite passa.

> **Como medir animação nesta bancada:** o painel do navegador mantém a página com
> `document.hidden` verdadeiro, e aí `requestAnimationFrame` não dispara — o jogo fica
> congelado no primeiro quadro e qualquer medição dá falso negativo. Para medir, troque
> `requestAnimationFrame` por um baseado em `setTimeout` **na página** antes de montar
> a tela. Isso é ferramenta de medição, não vai pro app.

Ponte nova no smoke, no mesmo modelo da que já barra móvel sem arte: toda espécie do
catálogo Python tem plano de corpo no motor JS (e nenhum plano sobrando), todo clipe
que o app pede existe, e nenhum apelido de ação aponta pra clipe inexistente.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.5 Qualidade do sprite fora da tela do bichinho, e arrastar item (24/08/2026)

Dois pedidos do dono depois de rodar a versão de 9.4: o bichinho estava com
"qualidade baixíssima" **no joguinho e na casa** (na tela dele, não), e ele queria
**arrastar e soltar a comida e os objetos** até o bichinho.

**A causa da qualidade: encolher pixel art joga pixel fora.** O bichinho era sempre
desenhado na caixa cheia de 128×108 e depois colado com `drawImage` em 50×42 (cômodo)
e 54×46 (corrida). Isso não suaviza nem reduz com cuidado — de cada dois pixels e meio
sobra um, escolhido por arredondamento. Contorno esfarela, olho some, perna fica com
buraco. Na tela do bichinho, que usa a caixa inteira, ele estava bem; por isso o
defeito parecia "só no jogo e na casa".

Foi por isso que a decisão antiga ("um desenho só, colado em dois tamanhos", comentada
no `room.js`) precisou cair. O que ela protegia continua de pé: **não existe um segundo
sprite do bichinho**. O que mudou é que `drawPet(p, pet, tick, escala)` agora recebe
uma escala e o motor desenha DIRETO no tamanho final — `planoDe()` escala todas as
medidas e carrega as próprias âncoras (`plano.cx`, `plano.chao`), em vez das constantes
globais que amarravam o bichinho a uma caixa só. São menos pixels, mas todos escolhidos
pelo desenho.

Duas consequências que valem saber antes de mexer:

- **abaixo de 0,8 de escala, a miudeza não é desenhada** (bolha de sabão, migalha, o
  "z" do sono, a poeira do passo, e o objeto do item de `petProps.js`). Reduzida, ela
  vira sujeira de um pixel espalhada — pior do que não ter. Traço fino e raio de olho
  têm piso (`Math.max`), senão sumiriam de vez;
- **agachar na corrida deixou de ser achatamento da imagem.** Era um `drawImage`
  espremendo o sprite pela metade — mais uma redução em cima da que já estragava a
  arte. Agora é o clipe `deitar`, que abaixa o corpo dobrando as pernas. A caixa de
  colisão não mudou: quem decide continua sendo `j.abaixado`, não a altura do desenho.

Tamanhos em uso: **62×52** no cômodo e **68×58** na corrida.

**Arrastar e soltar o item no bichinho.** Feito com eventos de PONTEIRO, não com a API
de arrastar do HTML — aquela simplesmente **não dispara em toque**, e o recurso ficaria
só no computador, que é onde ninguém usa este app. Ponteiro é o mesmo caminho para
dedo, caneta e mouse.

Três decisões dentro disso:

1. **só vira arrasto depois de 8 px de dedo.** Sem essa folga, qualquer tremida viraria
   arrasto, o toque simples deixaria de funcionar e a rolagem da lista morreria junto.
   O toque continua valendo e faz exatamente o que sempre fez;
2. **soltar fora do bichinho não faz nada.** É desistir no meio. Aplicar mesmo assim
   gastaria um item do inventário sem a pessoa ter escolhido isso — conferido: soltar
   no rodapé deixa higiene e inventário intactos;
3. `touch-action: none` nos itens e `pointer-events: none` no item que segue o dedo. O
   segundo é obrigatório: se ele capturasse o ponteiro, o `pointerup` cairia nele e
   nunca no palco, e o item nunca chegaria ao bichinho.

O palco pisca quando há item na mão e acende quando o item está sobre ele, com a frase
"Solte para dar X" — sem essa resposta, quem arrasta não sabe até onde levar o dedo.

**Conferido no navegador**, contra o app publicado: arrastar o sushi até o bichinho
levou a fome de 35 para 80 com o aviso certo; soltar fora não mexeu em nada nem gastou
item; o toque simples continua aplicando (higiene 40 → 80, inventário 2 → 1). Recusa do
servidor continua honesta ("Pipoca está sem fome nenhuma"), não vira erro.

> **Um susto que não era bug:** no meio do teste apareceu `Internal Server Error` com
> `database is locked`. Foi a minha própria escrita externa no SQLite da bancada
> (ajustando atributos pra testar), não o código. Produção é PostgreSQL e não tem isso.
> Mexer no `casal_local.db` por fora enquanto o `dev_server` está de pé provoca
> exatamente esse erro — se aparecer, é a primeira suspeita.

**537 verificações, 0 falha.** Publicado em produção: commit `66bb2f8` no repositório de
deploy, build do Coolify, e o site passou a servir `index-C8hTN-kh.js` — o mesmo nome
que o `npm run build` gerou aqui, que é a prova de ser a mesma versão. Saúde HTTPS e os
textos novos conferidos no bundle que está no ar.

### 9.6 Rodada de acertos de tela e o chat estilo WhatsApp (24/08/2026)

Seis pedidos do dono na mesma rodada, todos depois de rodar no celular.

**1. O bichinho sumia no jogo.** Regressão do trabalho de 9.5, e do tipo que não dá
erro: eu troquei o tamanho do canvas de rascunho da corrida para 68×58 e **esqueci de
passar a escala** para o `drawPet`. Ele continuou desenhando na caixa de 128×108, e o
recorte de 68×58 pegou o canto de cima — que é só céu vazio. O bichinho existia, fora
da moldura.

O conserto não foi só passar o argumento. `drawPet` agora **deriva a escala do próprio
canvas** (`p.h / 108`) quando ninguém manda uma: o tamanho do canvas e o tamanho do
desenho passam a ter uma fonte só e não têm como discordar de novo. `ItemPreview`
entrou na mesma correção — a miniatura de espécie da loja ainda desenhava grande e
encolhia.

**2. A coleira estava torta.** Ela é perpendicular ao "eixo do pescoço", e esse eixo
era medido do peito até a **base** da cabeça. Com a anatomia nova (cabeça acima e um
pouco à frente do peito) esse vetor virou quase horizontal — então a coleira aparecia
como uma tira **em pé**, atravessando o bichinho, e a gravata apontava para o focinho.
Agora o eixo vai do peito ao **centro** da cabeça, que é a direção em que um pescoço
realmente corre. E o que pende (gravata, plaquinha) usa o "para baixo" **do corpo**, não
do pescoço — por isso continua caindo certo com ele deitado ou de cabeça baixa. A
gravata também para na linha do chão, senão atravessaria o assoalho no `dormir`.

**3. Aproximar a vista da casa.** No celular a escala que cabe dá 1× (o cômodo tem
434 px de arte e a tela tem 375), e aí o bichinho aparecia com os 62 px dele, perdido no
cenário. Agora existe **aproximar**: botões −/+ e **pinça de dois dedos**, em passos
INTEIROS (1× a 4×), com o cômodo passando a rolar — que é o que jogo de decoração faz.
Encolher a arte pra caber seria o contrário da direção de arte do projeto.

Três detalhes que valem: a aproximação fica **separada** da escala automática (senão
girar o celular jogaria fora o zoom escolhido); aproximar mantém o **meio da vista** no
lugar (sem isso cada passo joga a pessoa pro canto do cômodo e ela perde o bichinho de
vista); e os botões ficam **fora** do contêiner que rola — dentro, eles rolavam junto e
sumiam, e quem aproximasse não teria como afastar.

**4. As barras de atributo viravam meia tela.** Eram quatro cartões num grid embaixo do
cenário. Agora são quatro tracinhos num **HUD de canto**, dentro do palco. O prazo até
zerar não se perdeu — é ele que mostra que o tempo está correndo, decisão registrada em
8.2: virou o `title` de cada barra e aparece escrito **quando o atributo está baixo**,
que é quando importa.

**5. A aba do bichinho usa a tela do celular.** `.pet-tela` ocupa a altura entre o
cabeçalho e o menu (`100dvh`, e não `vh`: no celular a barra do navegador entra e sai, e
`vh` não conta isso — o rodapé ficaria escondido atrás dela). O palco ocupa a largura
inteira e as opções viraram uma faixa flutuante **sobre** o cenário; é a largura que
decide o tamanho do bichinho, então tirá-las do fluxo foi o que permitiu ele chegar a
3× no celular (era 1×). A ampliação continua **inteira** — ampliar em 1,5× daria franja
nas diagonais e acabaria com a pixel art.

Detalhe da conta: a largura pode passar 25% do palco, porque o bichinho ocupa o miolo da
caixa de 128 (o mais largo, o dragão, vai de 8 a 108) e o que estoura nas laterais é ar,
cortado pelo `overflow: hidden`. Com a folga antiga de 10% a conta perdia o 3× por dez
pixels numa tela de 375.

**6. Chat: marcar a mensagem e responder, como no WhatsApp.**

O que existia era um toque simples que abria um menuzinho embaixo da bolha — e tocar é o
mesmo gesto de abrir a foto, então o menu abria sem querer o tempo todo. Agora:

- **arrastar a mensagem de lado** responde. A setinha aparece por trás e **acende**
  quando o arrasto já passou do limite, pra soltar não virar aposta;
- **segurar 420 ms** marca a mensagem: ela fica destacada, ganha um selo, e as ações
  aparecem numa barra no topo — responder, copiar, reagir, apagar;
- a citação passou a mostrar **quem escreveu** ("Você" / o nome dela), como no WhatsApp.

O cuidado que faz o gesto conviver com a conversa: `touch-action: pan-y` na linha e, no
código, **a rolagem vence** — se o dedo desceu mais do que andou pro lado, o gesto é
cancelado. Sem isso, puxar pra responder mataria a rolagem da conversa. Conferido: um
arrasto vertical sobre a bolha não marca nem abre resposta.

> **`Icon` devolve `null` pra nome que não existe** — a armadilha de 9.2 de novo. A seta
> `reply` não existia e o botão de responder sairia vazio, sem erro. Foi desenhada.

**Conferido no navegador, em viewport de celular (375×812)**, contra o app publicado:
o bichinho reaparece na corrida (298 px pintados, antes 0); a coleira virou uma faixa
de 11×7 atravessando o pescoço (era uma tira em pé); o zoom da casa vai de 434×290 a
1302×870 com o indicador certo; o palco do bichinho chega a 3× (384×324 de canvas);
arrastar item continua funcionando no layout novo (fome 76 → 100); e no chat, puxar
responde, segurar marca (com as quatro ações), a citação sai com o autor e o arrasto
vertical não rouba a rolagem.

**537 verificações, 0 falha.**

### 9.7 App em branco no iPhone, zoom, coleira, avatar dela e vários bichinhos (25/08/2026)

**1. O app parou de abrir no iPhone — e a causa era cabeçalho de cache.**

O `index.html` era servido **sem `Cache-Control`**. Sem essa instrução o navegador
aplica cache por adivinhação, e o iPhone é o mais agressivo nisso, principalmente
aberto pela Tela de Início. O detalhe que transforma isso em tela branca: o nome do
arquivo em `/assets` é um resumo do conteúdo (`index-ABC123.js`) e **cada deploy apaga
os antigos**. O aparelho guardava um `index.html` velho, que apontava para um bundle
que já não existia — o HTML carregava, o script dava 404, e o app abria em branco. Sem
erro visível, e só no celular, porque no computador eu recarregava forçado o tempo todo.
Foram três deploys num dia; foi o bastante.

Três camadas de conserto, da causa para o sintoma:

- **servidor**: `index.html` e a casca vão com `no-cache, must-revalidate`; `/assets`
  vai com `max-age=31536000, immutable`. Guardar `/assets` para sempre é seguro
  justamente porque o nome muda quando o conteúdo muda;
- **service worker** (`casal-v4`): a navegação busca com `cache: 'reload'`, que pula o
  cache HTTP do próprio Safari. "Rede primeiro" não bastava — o `fetch` ainda passava
  por esse cache. Isto também é o que **destrava um aparelho que já está preso**;
- **rede de segurança no `index.html`**: se um arquivo de `/assets` falhar em carregar,
  a página joga fora service worker e caches e recarrega **uma vez** (travada por
  `sessionStorage`, senão viraria laço de recarregamento quando a falha for de
  internet).

**2. O zoom da casa saltava de 1× para 4× e travava lá.** Realimentação: `.scene-frame`
é flex, e item de flex tem `min-width: auto` — ou seja, cresce até caber o conteúdo. Ao
aproximar, o canvas ficava maior, o contêiner crescia junto, e a conta de "quanto cabe
na tela" (que mede esse contêiner) passava a ler 1736 px em vez de 375. Com
`min-width: 0` no `.room-wrap` o contêiner fica do tamanho da tela e o cômodo rola
dentro dele. Medido: 1×→2×→3×→4×, teto em 4, e volta.

> É a **terceira** vez nesta série que uma medida realimenta o que ela mede (antes: a
> altura da pista da corrida e a resolução da arte). Vale como regra: quem mede o
> espaço disponível nunca pode medir um elemento que cresce com o conteúdo.

**3. A coleira ainda ficava torta.** Ela era perpendicular a um "eixo de pescoço"
calculado entre o peito e a cabeça. Isso funciona no cachorro e falha no coelho e na
capivara, que praticamente não têm pescoço: os dois pontos ficam quase em cima um do
outro, a direção sai de uma diferença minúscula (portanto instável) e a faixa acabava
**atravessando o rosto**. Agora ela é ancorada **na cabeça**, logo abaixo do queixo, e
acompanha a mesma rotação do rosto — em qualquer espécie e em qualquer pose. O que
*pende* (gravata, plaquinha) continua seguindo o "para baixo" do corpo, porque quem
manda nisso é a gravidade, não a inclinação da cabeça.

**4. O boneco dela não parecia feminino.** O corpo era um retângulo só, igual para os
dois do pescoço para baixo — a única diferença entre eles era cabelo e roupa.

O caminho óbvio (desenhar um segundo corpo) seria o pior: as 48 peças de roupa são
retângulos posicionados sobre o tronco, então cada peça precisaria de uma segunda
versão — 48 desenhos novos para mudar uma silhueta. Aqui o corpo é **esculpido no fim**:
recorta-se ombro e cintura com `clearRect` depois da roupa, o que tira pele e tecido de
uma vez, e o contorno é redesenhado na borda nova. Toda roupa acompanha a forma sozinha,
inclusive as que ainda nem existem. Medido: ombro 22→20, cintura 22→18, quadril 22.

São **duas** formas, e não três. Havia um "largo" que só faria sentido *alargando* a
silhueta — e alargar exigiria pintar fora do tronco sem saber que roupa está por baixo.
Ele saía idêntico ao "reto": botão que não muda nada é pior do que não ter o botão.

A silhueta é escolha **livre** (como o tom de pele), não item de loja: fica em Perfil →
montar personagem → Base. O `seed` preenche o campo uma única vez em quem já tinha
avatar, e só quando a chave não existe — quem escolher outra forma não perde a escolha
no próximo deploy, mesma regra da senha.

**5. Mais de um bichinho.**

O que sustenta a feature: **todos continuam vivos ao mesmo tempo**. Congelar o que não
está na tela transformaria trocar de bichinho na forma de fugir do cuidado — bastava
deixar o faminto de lado — e "o bichinho tem que dar trabalho" é decisão travada (8.2).
Há teste para isso: adianta o relógio, lê uma vez, e exige que o ativo **e** o inativo
tenham perdido fome.

| Peça | Como ficou |
|---|---|
| `Pet.active` | um booleano; a exclusividade é garantida em `_ativar()`, não por um `if` na tela |
| `get_pet(db)` | passou a devolver o ATIVO — ponto único por onde casa, jogo e cuidado já passavam, e foi o que permitiu a mudança sem espalhar "qual deles?" pelo código |
| `POST /pet/adopt` | **cria um bichinho novo** (antes trocava a espécie do único), com nome e vida próprios |
| `POST /pet/{id}/select` | troca quem está na tela; de graça e sem apagar nada |
| `GET /pet` | devolve também `pets`: a fila curta, com o pior atributo de cada um |
| licença de espécie | virou **consumível**: uma compra, um bichinho. Sem isso, uma licença daria bichinho infinito — era só chamar a rota de novo |
| teto | 4 na casa. Não é limite técnico: a sujeira de todos cai na mesma sala |

Na tela, a fila só aparece quando há mais de um (com um só seria uma linha inútil
ocupando altura de cenário). Cada retrato é desenhado **uma vez, sem animação** — são
vários ao mesmo tempo, e um laço por retrato custaria mais bateria do que entrega. O
retrato mostra um ponto vermelho quando aquele bichinho está precisando de cuidado: com
vários, ninguém vai abrir um por um para descobrir qual está com fome.

**Conferido no navegador (375×812)**: o zoom anda em passos e volta; a coleira fica sob
o queixo nas seis espécies e nas cinco poses da aba Vestidos; três bichinhos na casa,
troca pelo retrato funcionando e a casa acompanhando o ativo; os cabeçalhos de cache
saem certos (`no-cache` no HTML, `immutable` nos assets). **555 verificações, 0 falha.**

### 9.8 Avatar, resolução do bichinho, dois jogos novos e três defeitos (26/08/2026)

Rodada grande. Três defeitos com causa em comum — **uma medida que atropela a
outra** — e duas features novas, sendo a primeira que é de dois jogadores.

**1. "Dois braços de cada lado" era um traço caindo dentro de outra peça.**
`box()` pintava contorno E preenchimento de uma caixa antes de ir pra próxima.
Com a manga (arte x 6..8) e o tronco (x 9..22) encostados, a manga era desenhada
depois e o contorno dela caía em x=9 — o primeiro pixel do tronco. Sobrava uma
coluna escura de 11 px descendo por dentro da camisa, colada no braço, e
ampliada na tela isso lê como um segundo braço. Não era erro de posição de
nenhuma das duas peças, e acontecia em **toda** roupa de cima com manga.

`peca()` faz os dois passes (contorno de tudo, depois preenchimento de tudo) e o
preenchimento do tronco cobre o traço da manga. Sobra traço só na silhueta
externa. Com a emenda removida, o braço sumia dentro do tronco (mesma cor), então
entrou o `vinco`: 1 px numa sombra da própria cor da roupa. É exatamente a lição
de 9.4 (defeito 2), que estava escrita pro bichinho e não tinha sido aplicada aqui.

> Medido lado a lado, com o mesmo desenho nas duas ordens: na antiga sobravam
> colunas escuras em x=9 e x=22 **dentro** da camisa; na nova, nenhuma.

**2. A silhueta feminina: só dava pra estreitar, e sem quadril não há silhueta.**
A primeira tentativa (9.7) recortava a cintura com `clearRect`. Funcionava, mas
mudava pouco — e não tinha como ir mais longe, porque apagar só ESTREITA:
alargar exigiria pintar fora do tronco sem saber que roupa está por baixo.

O que resolve os dois de uma vez sem redesenhar nada é **reescalar cada linha de
pixel na horizontal**, em torno do meio do corpo. Abaixo de 1 estreita (ombro,
cintura), acima de 1 alarga (quadril) — e o que está sendo esticado são os
pixels JÁ PINTADOS, então pele, tecido e contorno acompanham sozinhos. As 48
peças continuam valendo sem uma segunda versão, inclusive as que não existem
ainda. Largura de destino arredondada pra inteiro e `imageSmoothingEnabled:
false`: a borda continua dura.

> Medido: `reto` = 22 px do ombro ao quadril, reto de cima a baixo.
> `curvas` = ombro 20, cintura 16, quadril 23.

**3. "A maioria dos bonecos é careca" — faltava volume em todos, não um corte.**
Cada corte pintava uma faixa de 6 px no alto da cabeça (arte y 3..8) mais dois
tracinhos nas têmporas. O crânio dos lados — x 8..10 e 21..23, de y 9 a y 20 —
ficava com a **cor da pele**. Ampliado, isso lê como entrada funda dos dois lados.
Agora todo corte parte de `casco()`, com volume no topo e costeleta pelo lado.

> Medido na faixa lateral do crânio: 12/48 pixels cobertos antes; 26/48 no
> `curto`, 34/48 no `medio`.

Quatro cortes novos na loja: chanel, tranças, black power e **raspado** — este
com a sombra do corte na pele, pra careca ser uma escolha e não a aparência de
quem está sem arte. E o `moicano` deixou de mostrar pele nos lados raspados
(virou o cabelo curto numa sombra da cor), pelo mesmo motivo.

**4. O bichinho ganhou 8,9x mais pixel sem mudar de tamanho.**
Na tela dele a arte era sempre 128x108, ampliada por CSS num fator inteiro. Isso
protege a borda dura, mas trava a QUANTIDADE de pixel: no celular o palco cabe
3x, e 3x de uma arte de 128 é a mesma arte de 128 com cada pixel virando um
quadrado de 3. O corpo fica grande e a informação é a mesma.

A saída não foi abandonar o fator inteiro, e sim escolher — **entre as
combinações que dão o mesmo tamanho físico** — a que tem mais pixel de arte.
128x3 (zoom 3) e 384x1 (res 3, zoom 1) ocupam os mesmos 384 px; a segunda tem
nove vezes mais pixel. O motor já sabia fazer isso: `planoDe` recebe uma escala e
desenha DIRETO no tamanho final (foi o que consertou o bichinho borrado do cômodo
e da corrida, em 9.5). Ninguém tinha pedido pra ele desenhar **maior** que a
caixa de referência.

Duas coisas precisaram acompanhar, e são a resposta ao "verifica se não vai bugar":

- **o contorno**. `desenharCamada` usava deslocamento fixo de 1 px. Num corpo
  três vezes maior, 1 px vira fio de cabelo e o desenho perde justamente o traço
  grosso que dá cara de desenho. Agora a espessura acompanha a escala, sempre
  arredondada pra inteiro (meio pixel de traço é franja na diagonal);
- **o rosto**. Nariz (2,4 x 1,7), boca (6), bigode (9 px), brilho do olho: tudo
  era número cru. O corpo cresceria e o rosto não — sairia um bicho grande com
  narizinho de alfinete. Tudo o que é rosto passou a multiplicar por
  `plano.escala`.

> **O cômodo e a corrida continuam na resolução da cena, de propósito.** Lá o
> bichinho precisa ter a mesma grossura de pixel do sofá; em alta resolução ele
> pareceria colado por cima da cena. Na tela dele ele está sozinho no palco e não
> tem com quem destoar. Medido: 384 px na tela nos dois casos, 1.103 para 9.821
> pixels desenhados. Bancada: 132 animações, 18 bichinhos, 30 acessórios
> vestidos e 30 móveis, nenhum vazio.

**5. O chat não trazia o que chegou enquanto o app estava fechado.**
O WebSocket entrega o que acontece **com ele de pé**, e o celular derruba a
conexão assim que o app vai pro segundo plano. O que o outro manda nesse
intervalo chega no banco e fica lá: não passa por evento nenhum. E como a tela do
chat continua MONTADA (o React não a remonta ao voltar), o `carregar()` da
montagem também não rodava de novo. Ninguém ia buscar.

Agora ela re-sincroniza em dois gatilhos, e os dois são necessários: o app voltar
a ficar visível, e o **WebSocket reconectar** — perder sinal na rua derruba a
conexão sem esconder o app, então só a visibilidade não cobriria. A busca JUNTA
em vez de substituir, senão quem já rolou pra trás perderia o histórico
carregado.

> Ao medir isto no navegador vale saber: com a pane do navegador escondida,
> `document.visibilityState` é **hidden**, e o `visibilitychange` do store sai
> logo na primeira linha. Sem forçar `visible`, a medição dá falso negativo.

**6. Notificação: já foi dos dois jeitos errados.**
Tag única sem contagem agrupa — e agrupar, no celular, quer dizer que a nova
SUBSTITUI a anterior; o dono via uma só. Uma tag por mensagem (`chat-123`, o
conserto anterior) não substitui nada e virou a pilha de avisos separados, que foi
esta reclamação. O certo é o meio: **tag única E contagem**, como no WhatsApp.

A contagem não vem do servidor: ele não sabe quais avisos a pessoa já dispensou
com o dedo. Ela é somada no service worker, lendo `getNotifications()` e o
`contagem` que viaja no `data` da anterior. E ao ENTRAR no app a bandeja é limpa
— pela página e por um recado ao service worker, porque a página não alcança as
notificações mostradas por ele.

> Medido com uma bandeja falsa: "Ele — oi", "Ele (2 mensagens) — tudo bem?",
> "Ele (3 mensagens) — me responde"; aviso de outro assunto não entra na conta.

**7. O zoom da casa: 704 px que nenhum arrasto alcançava.**
`.room-holder` era `display:flex; justify-content:center`. Centralizar por flex
funciona enquanto o conteúdo CABE; passando disso, o flexbox distribui a sobra
dos dois lados — e a metade que fica **antes** do início do contêiner é
inalcançável, porque `scrollLeft` não vai abaixo de zero. Com bloco +
`margin: 0 auto` no canvas o comportamento volta a ser o certo: sobrando espaço
centraliza, faltando a margem automática vira zero e tudo fica dentro da rolagem.

> Medido com o mesmo conteúdo nos dois CSS: **704 px inalcançáveis à esquerda**
> no antigo, 0 no novo. No app, de 1x a 4x, nada cortado em nenhum passo.

Isto é a **quarta** vez nesta série que uma medida atropela a outra (antes: a
altura da pista, a resolução da arte, e o contêiner que crescia com o conteúdo em
9.7, defeito 2). Vale como regra ao lado daquela: **quem centraliza conteúdo que
pode passar do quadro não pode centralizar por flexbox.**

### 9.9 Os dois jogos novos (26/08/2026)

`backend/app/routers/games.py` + `test_games.py`. Os dois usam a tabela
`minigame_matches`, que já tinha `state` em JSON, `turn_user_id` e os dois
jogadores — criar tabela por jogo espalharia a mesma coisa em dois lugares.

**Memória.** Tabuleiro 4x4, sorteado a partir da DATA (não de um `random` sem
semente), então é **o mesmo nos dois celulares** — é isso que dá sentido a "fiz
em 11 tentativas". 14 cartas de imagem, as únicas imagens de arquivo do app
inteiro: aqui a carta É a arte, não tem estado, pose nem cor variável.

> **Sobre gerar por IA.** O único modelo gratuito (`sana`, no Pollinations)
> desenha bem objeto simples e fofo, e erra o assunto com frequência: pedindo "um
> coração vermelho brilhante" devolveu um bichinho nas TRÊS sementes, e "uma
> chave dourada" virou um hamster nas três. Por isso foram geradas 3 opções por
> assunto e **escolhidas olhando, uma a uma**; o que não acertou ficou de fora,
> junto com o que saiu em foto no meio de um baralho de desenho (o café) e o que
> veio com mão de gente na imagem. Tentar corrigir com um prompt mais literal
> ("flat 2d cartoon, not a photo") piorou — saiu escuro e abstrato. Sobraram 14
> assuntos, 58 KB no total, e o smoke confere que toda carta da lista tem arquivo
> no disco: carta sem arquivo não dá erro, aparece um quadrado branco, e dois
> quadrados brancos são um par indistinguível.

**Batalha naval, a dois.** 8x8 (o clássico 10x10 daria 30 px por casa num celular
de 375 e o dedo erraria a vizinha), frota 4/3/3/2, quem acerta joga de novo.

> **O ponto que decide o jogo:** a posição dos navios do outro **nunca sai do
> servidor**, e o tiro é resolvido lá. Mandar o tabuleiro inteiro e esconder no
> CSS não esconderia nada — bastava abrir o painel do navegador pra ganhar toda
> partida, e num app de duas pessoas isso não é hipótese distante. `_vista()`
> monta uma resposta diferente pra cada lado: o seu tabuleiro inteiro, e o do
> outro só nas casas onde você já atirou. Há caso de teste que converte a
> resposta inteira em texto e procura as casas do adversário lá dentro.
>
> Pelo mesmo motivo o **evento de tempo real não carrega o estado**: ele diz só
> "mexeu, vem buscar", e cada app busca a SUA vista. Um evento com o estado
> dentro vazaria um lado pro outro.

A frota é validada no servidor (dentro do tabuleiro, sem encavalar, tamanhos
certos) mesmo com a tela validando também: a tela é do jogador, e sem isso
bastava mandar quatro navios de 2 empilhados num canto. O prêmio é por DIA, não
por vitória, travado por `dedupe_key` — senão bastava ganhar em série pra
imprimir Coração.

Conferido nos dois lados ao vivo: a tela dela virou sozinha quando ele
posicionou; o tiro dele apareceu sem recarregar; ela acertou pelo dedo e o
tabuleiro dele continuou com **zero** casas de navio visíveis, inclusive na
resposta da API.

### 9.10 Figurinhas: o problema era a mistura, não o desenho (26/08/2026)

As 18 da referência do dono já eram redondas com brilho (SVG); as outras 20
continuavam em pixel, e as duas linguagens apareciam **lado a lado no mesmo
seletor**. Era isso a "qualidade das figurinhas" — não que as de pixel fossem
malfeitas, e sim que metade do pacote era de outro material. As 20 foram
convertidas; as 38 estão na mesma linguagem, e o smoke não deixa a mistura voltar.

Dois aprendizados desta parte:

1. **A bancada conferia a arte que o app não usa.** A aba de figurinhas do `/lab`
   desenhava todas em pixel, chamando `drawSticker` direto — mas o `Sticker` do
   app prefere a versão redonda. Ou seja, a única arte conferida era justamente a
   que o chat não mostra mais. Agora a bancada usa o mesmo `Sticker` do chat.
2. **Nome de componente errado em JSX não é desenho faltando: é o app em branco.**
   Uma das figurinhas novas chamava `<Zzz>` e o auxiliar se chama `Zezinho`. Como
   as figurinhas são montadas na abertura do módulo, o `ReferenceError` derrubava
   o app INTEIRO. Foi o console da bancada que denunciou. Entrou uma conferência
   no smoke: todo componente usado dentro de `STICKERS_HD` tem que estar definido
   no arquivo.

Entraram também três pontes novas no smoke, todas do mesmo tipo das que já
existiam: toda peça de avatar vendida tem desenho, todo estilo desenhado tem nome
no editor, e toda carta da memória tem imagem no disco.

**Estado: 609 verificações, 0 falha.** Build Vite aprovada. **Falta publicar em
produção** — ver "Publicar em produção" na seção 2.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.11 Pente fino nos bichinhos, e o cenário da ilha (26/08/2026)

O dono voltou depois de rodar a 9.8: olhos se sobrepondo, animações contorcendo o
corpo, asa do passarinho sempre pra cima, ponta da orelha apagada, e o fundo da
aba do bichinho "bem genérico" — com a referência do **Kinectimals** para o tipo
de interação que ele queria.

**Antes de tudo: a bancada estava aprovando o que ninguém via.** Todas as abas do
`/lab` desenhavam na caixa de referência (128×108, escala 1). A tela do bichinho
passou a desenhar GRANDE na 9.8 — e um monte de defeito só existe quando a escala
é diferente de 1. Por isso existe agora a aba **Escala grande**, que desenha cada
espécie no tamanho em que ela aparece de verdade. Foi olhando ali (e na tela) que
tudo abaixo apareceu.

**1. A escala aplicada DUAS VEZES — a causa da "animação contorcendo o corpo".**

O desenho multiplica todo valor de pose pela escala: `corpoCY` soma
`q.corpoY * plano.escala`, a perna mira em `pe.y * plano.escala`. Ou seja, o
clipe deveria falar em unidades CRUAS. Só que quase todos os 22 clipes escrevem a
pose em cima do próprio plano — `q.pes[0] = { y: -plano.pernaA * 0.85 }` — e
`plano.pernaA` **já vem multiplicado pela escala**. Resultado: escala ao quadrado
em tudo que é deslocamento de pose.

Enquanto a caixa foi sempre 128×108 a escala era 1, e 1×1 continua 1: o defeito
existia desde sempre e não aparecia. Com o bichinho grande (escala ≈ 3,8) os
deslocamentos viraram ~15× em vez de 3,8 — pata mirando muito além do chão,
cabeça saindo do pescoço, corpo afundando. Cada clipe deformava diferente, porque
cada um mexe num conjunto diferente de valores.

O conserto é **uma linha**, e não mexer nos 22 clipes: `poseEm` entrega ao clipe o
plano com os comprimentos divididos pela escala (`semEscala`). Aí
`plano.pernaA * 0,85` volta a ser uma fração crua, a multiplicação do desenho
aplica a escala uma vez só, **e os números soltos que alguns clipes usam
(`{ x: 3.5 }`) passam a escalar junto** — coisa que antes não acontecia e deixava
esses pés parados no lugar enquanto o resto crescia.

> Isto também conserta o cômodo, que desenha o bichinho a ~0,5 de escala: lá os
> deslocamentos vinham 0,25 em vez de 0,5, ou seja, metade do movimento.

**2. Os olhos se sobrepondo.**

Ficavam em duas frações fixas da cabeça (0,1 e 0,58) enquanto o raio saía de
outra conta, que não sabia da primeira. Na cabeça de filhote — proporcionalmente
maior E com o olho aumentado, que é o que dá cara de bebê — os dois brancos se
encontravam no meio da cara e viravam UMA mancha com dois pontos dentro.
Acontecia em toda escala; no gato adulto já encostavam.

Agora existe uma conta só: o raio manda, a meia-distância entre os centros é o
raio do branco mais uma folga fixa, e um teto garante que o par inteiro cabe na
testa. Eles não têm como se cruzar, cresça o olho o quanto crescer — e o filhote
continua de olho grande, só que mais afastado, que é o que se vê num rosto de bebê.

**3. A ponta da orelha apagada.**

A base da orelha de gato media **8,4 px fixos**. Com a cabeça três vezes maior e a
base igual, a orelha vira uma agulha — e agulha some dentro do próprio contorno:
o traço é pintado em quatro cópias deslocadas, e numa peça fina elas cobrem quase
todo o miolo. Sobra preenchimento num fiozinho, e a ponta, que afina até zero,
fica só de traço.

Todas as medidas cruas do desenho passaram a acompanhar a escala (orelha, chifre,
bico, cauda, pata, asa, espinho, marca, sombra). Junto disso, duas decisões de
desenho no coelho: a orelha encurtou de 1,95 para 1,45 da altura da cabeça (1,95
é orelha de lebre, e ela dominava o bicho), e o **rosa por dentro para em 76% da
orelha** em vez de ir até a ponta — indo até lá, ele cobria justamente a parte que
já tinha pouco preenchimento e a orelha virava uma listra rosa de borda apagada.

**4. A asa do passarinho sempre pra cima.**

O ângulo da asa passava por dentro de um seno que já estava perto do pico:
`sin(0,9 + a)`, com `a` indo de −1,15 a +1,15, percorre 0,9 → 2,05 radianos — e o
pico do seno (1,57) fica bem no meio disso. A ponta mal saía do alto em toda a
metade de cima da batida e só desabava no extremo.

> Medido, com a altura da ponta normalizada ao longo de uma batida:
> **antes** a ponta ficava acima de 80% da altura em **5 de 13** quadros e a
> descida chegava só a −0,25; **agora** é **1 de 13**, e a descida vai a −0,65.
> A batida deixou de ser "parada em cima com um tranco" e virou sobe-e-desce.

O conserto é não usar o seno como curva de controle: `a` virou o ÂNGULO de
elevação e a ponta gira em torno do ombro.

**5. O resto do pente fino.**

- **A cauda saía quase em pé** e ia ficando mais vertical a cada elo (144° → 119°).
  Grossa, comprida e vertical por cima das costas, ela não lia como cauda: lia
  como braço levantado, e era isso que dava ao gato aquele ar de bicho em pé.
  Agora sai quase pra trás (166°), a curvatura CRESCE do início pro fim (só a
  ponta sobe) e a grossura caiu de 0,22 para 0,15 da altura do corpo — 0,22 é a
  grossura de uma perna.
- **A coleira atravessava o focinho.** Ela era ancorada na borda de baixo da
  cabeça (1,02) — e a borda de baixo de uma cabeça grande ainda é bochecha.
  Desceu para 1,38, que é o pescoço, e ganhou faixa clara e fivela: chapada, ela
  lia como etiqueta de papel colada no bicho.
- **A sombra flutuava.** Nascia 3 unidades abaixo do chão — 3 px na caixa pequena,
  11 px com o bichinho grande, e aparecia um vão entre a pata e a sombra.
- **O objeto do item ia parar no canto.** `petProps.js` é escrito na caixa de
  128×108 com número cru (`p.solid(58, 88, …)` quer dizer "ao lado do focinho"
  só enquanto o canvas TEM 128 de largura). Em vez de reescrever as treze cenas,
  o desenho delas entra numa transformação que leva a caixa de 128×108 para as
  âncoras reais.
- **O aviso de ⚠ virou uma placa de trânsito**: o tamanho estava preso à escala do
  bicho. Agora sai do canvas.

**6. O enquadramento: ele ocupa o palco.**

Com as âncoras da caixa de referência, um coelho filhote dava uns 26% da largura
da tela, perdido no quadro. A escala agora sai do TAMANHO DO BICHO — altura e
largura estimadas do plano do corpo, e a maior escala que ainda cabe. Um fator
fixo serviria para um e estouraria para o outro (a orelha do coelho mede quase
três cabeças; o dragão tem o corpo mais comprido). Cada espécie enche a tela até
onde dá, sozinha, e crescer continua visível.

**7. O cenário: a ilha.**

O fundo era `linear-gradient(#dcead9 0 62%, #c99e70 62%)` — duas faixas chapadas.
O que o Kinectimals faz de certo não é a quantidade de detalhe: é o filhote estar
num LUGAR, e o lugar estar vivo enquanto ele não faz nada.

`web/src/render/petCena.js` desenha, na mesma linguagem de pixel do resto: céu em
faixas com reticulado na emenda, sol (ou lua crescente) com halo, estrelas,
nuvens com paralaxe, duas cordilheiras, mar com brilho que anda, praia, campo,
moitas, flores, tufos de grama atrás E na frente do bichinho, borboletas de dia e
vaga-lumes de noite, pólen subindo no sol. **A paleta inteira muda com a hora**
(madrugada, amanhecer, dia, entardecer, noite): abrir o app de manhã e à noite
viram duas coisas diferentes sem nenhum conteúdo novo.

> **Desempenho:** a cena inteira a cada quadro sairia caro (o reticulado pinta um
> pixel por vez). O que não se mexe é pintado UMA vez num canvas de rascunho e
> colado; só nuvem, água, grama, borboleta e pólen são redesenhados. É a mesma
> precaução já anotada na seção 8.1 para o mapa do bairro — aqui ela já valeu,
> porque esta tela fica aberta animando enquanto a pessoa cuida do bicho.

**8. A interação: ele olha pra você, e você faz carinho.**

Duas coisas, e as duas são o que o Kinectimals faz:

- **Ele acompanha o seu dedo** com a cabeça e com a PUPILA. É a coisa mais barata
  e mais eficaz do jogo inteiro: sem isso o bicho é um desenho que anima sozinho;
  com isso ele parece estar do outro lado do vidro prestando atenção em você. O
  olhar entra como acréscimo na pose, então ele consegue olhar pra você enquanto
  anda, come ou dorme — e volta ao normal sozinho depois que o dedo sai.
- **Passar a mão nele é carinho.** O afago conta DISTÂNCIA percorrida, não tempo
  parado — é a diferença entre "a mão está encostada" e "a mão está fazendo
  carinho". A cada trecho ele reage e sobem coraçõezinhos do lombo; de tanto em
  tanto isso vira o carinho de verdade, o do servidor.

> A regra travada continua: **a reação é sempre, o prêmio tem hora**. Fora da
> janela o servidor recusa, e aqui isso vira um aviso tranquilo ("gostou, mas a
> alegria dele já está no talo"), não um erro vermelho. Ele reagiu de qualquer
> jeito; o que estava em descanso era a alegria, não o afeto.

**9. A bancada passou a conferir proporção sozinha.**

A aba Escala grande mede a caixa que o desenho ocupa em 1×, 2× e 3× e **reprova
em vermelho** quando a fração muda — é assim que "medida presa em pixel" aparece
sem ninguém olhar. Dois cuidados que a própria medição ensinou:

1. **Medir ANDANDO, e no meio do passo.** Em `parado` os pés ficam quase no lugar,
   e era justamente nos deslocamentos de pose que estava a escala dupla — medir
   parado deixaria o defeito passar de novo.
2. **A conferência é entre 2× e 3×, com o 1× só para olhar.** Não é o teste sendo
   afrouxado: abaixo de ~2× a arte perde detalhe de verdade (decisão antiga, 9.5).
   A assinatura disso é clara nos números — a ALTURA bate nas três escalas e só a
   LARGURA encolhe no 1×, que é ponta fina sumindo. Medida presa em pixel mexeria
   nas duas. Entre 2× e 3× não há essa perda: gato 4,0%, cachorro 4,8%, coelho
   5,1%, pássaro 5,4%, capivara 4,4%, dragão 3,1% — todos dentro da folga de 8%.

> **Como medir animação nesta bancada** (vale repetir, porque custou tempo de
> novo): com a janela do navegador escondida, `requestAnimationFrame` não dispara
> e o canvas fica congelado no primeiro quadro. Duas capturas saem IDÊNTICAS e a
> medida dá falso negativo — foi o que fez a primeira conferência do olhar
> parecer que não funcionava. Trocar o `rAF` por um baseado em `setTimeout` na
> página resolve; é ferramenta de medição, não vai pro app.

**Estado: 609 verificações, 0 falha.** Build Vite aprovada. Conferido no navegador
contra o app publicado: as 6 espécies no tamanho real, o cômodo, e o carinho
ponta a ponta (corações subindo e o servidor aceitando).

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.12 Comportamento de Kinectimals, vozes, moedas e a casa cheia (26/08/2026)

Rodada pedida depois de rodar a 9.11: trazer os comportamentos do Kinectimals
(ele corre pelo cenário, vira de lado, chega perto e lambe a câmera), consertar
o sushi que não funcionava, fazer o minigame **sempre** pagar (a não ser com o
bichinho cansado), pesquisar um jeito de dar voz própria a cada espécie, pôr
**todos** os bichinhos andando e interagindo na casa, e um jeito de tirar o gato
duplicado do perfil.

**1. O sushi: o carinho por arrasto estava sequestrando o item.**

Regressão minha, da 9.11. O afago é disparado por movimento de dedo com o
ponteiro pressionado em cima do bichinho — e levar o sushi até ele é exatamente
isso. Então o caminho até soltar o prato virava uma sequência de carinhos: a
reação de "feliz" entrava por cima da cena de comer (`acaoDe` dava prioridade a
`pet.action`), e ainda saía uma chamada de carinho no servidor que ninguém pediu.
O dono dava sushi e nunca via ele comer.

Dois consertos, e os dois são de PRIORIDADE, não de posição:

- **quem está com a mão ocupada não está fazendo carinho**: `PetCanvas` recebe
  `arrastando` e o afago sai de cena enquanto houver item na mão;
- **o item em uso ganha de tudo**, inclusive de `action`. Entre "encostei nele" e
  "dei comida pra ele", quem manda é a comida.

Junto disso, o cartão do item passou a dizer **por que** não dá pra usar agora —
`acabou`, `sem fome`, `já limpo`, `descansando`. Antes ele só ficava cinza, e
cinza não explica nada: são quatro motivos com quatro saídas diferentes. E a
recusa do servidor por estado do bichinho virou aviso amarelo, não erro vermelho
(a mesma lição do botão "Interagir" da casa).

**2. Minigame: toda partida paga, e o freio é a energia.**

Era uma vez por dia, por medo de virar caça-níquel. O medo era justo, mas o efeito
colateral era pior: a partir da segunda partida o jogo não valia nada, e jogo que
não rende ninguém repete.

O que resolve os dois é o limite não ser o RELÓGIO e sim a **energia do
bichinho** — cada partida gasta, e sem energia não dá pra jogar. A torneira
continua fechada (de 100 de energia saem umas sete partidas; há caso de teste
para isso), mas fecha por um motivo que aparece na barra e que dá pra resolver
cuidando dele. O descanso de dois minutos por jogo saiu: eram dois freios pro
mesmo problema e o de relógio não tinha relação nenhuma com o bicho.

> **A chave anti-duplicidade mudou de significado.** Ela não separa mais "hoje"
> de "amanhã", e sim UMA PARTIDA da seguinte — porque agora essa diferença é
> dinheiro. Datar pelo relógio não serve: duas partidas curtas cabem no mesmo
> segundo e uma delas deixaria de pagar sem motivo. O app sorteia um `match_id`
> quando a partida COMEÇA e manda junto do placar; o toque duplo no fim repete o
> mesmo id, duas partidas mandam ids diferentes.

Memória e batalha naval também passaram a pagar sempre — mas com valor menor
depois da primeira do dia. Elas não gastam energia de bichinho nenhum, então não
há nada segurando a repetição: pagar o cheio toda vez seria imprimir Coração.

**3. Vozes de verdade, uma por espécie.**

O que existia eram dois bipes com a frequência trocada. A pesquisa levou ao mesmo
desenho do `soundgen` (síntese paramétrica de vocalização), e ele cabe inteiro na
Web Audio API — `web/src/petVoz.js`:

| Peça | O que faz |
|---|---|
| contorno de altura | não é uma nota, é uma CURVA. É ela que separa o miado (sobe e desce) do latido (despenca) e do piado (varre pra cima) |
| fonte de ruído | o chiado do latido e o rosnado do dragão. Sem ela tudo vira apito |
| formantes | 2–3 filtros de pico. São eles que fazem a mesma nota soar como bicho diferente |
| abertura de boca | o primeiro formante varre e volta ao longo do som. Isso É um miado |
| jitter | tremor aleatório na altura. Voz afinada demais soa eletrônica; muito jitter vira rosnado |

O humor entra como três botões (mais agudo/curto = animado; mais grave/longo =
pra baixo; mais ruído/menos volume = sem forças), então `feliz`, `triste` e
`doente` mudam o jeito de falar sem receita nova.

> **A bancada ganhou a aba Vozes, e o som era a única coisa do app sem
> conferência.** Cada voz é sintetizada num `OfflineAudioContext` (que renderiza
> sem tocar nada) e vira dois números: volume — se der zero, a voz não está
> saindo, o equivalente ao "⚠ vazio" das abas de desenho — e **agudez**, que é
> onde a energia se concentra. Duas espécies com agudez parecida soariam iguais,
> e a aba reprova. Ela pegou isso na primeira medição: gato (1075 Hz) e coelho
> (1219 Hz) estavam a 12% um do outro. Hoje: dragão 255, capivara 337, cachorro
> 520, gato 1105, coelho 1837, pássaro 3338 Hz.

**4. O comportamento do Kinectimals.**

`web/src/render/petPalco.js` — um cérebro de estados com três números: `x` (onde
está na largura), `z` (a PROFUNDIDADE) e `virado`.

A profundidade é o que faltava. Ela dá o tamanho **e** a altura na tela ao mesmo
tempo: longe fica pequeno e alto, perto fica grande e embaixo. Mexer só no
tamanho pareceria um balão inflando; sem nenhuma das duas ele desliza num plano e
a cena vira teatro de sombras.

O que ele faz: anda, corre, para, **vira de lado** (espelhado em volta do próprio
centro — dar a ele um segundo conjunto de poses viradas seria refazer o motor), faz
truque (sentar, rolar, implorar, deitar, coçar, brincar — os mesmos verbos do
Kinectimals traduzidos pros clipes que já existem) e, de vez em quando, **vem até
o vidro e lambe**.

> **Tocar LONGE dele é chamar; tocar NELE é mexer com ele.** O mesmo gesto com
> dois sentidos, separados pela distância — que é como funciona com bicho de
> verdade. Chamado, ele vem correndo.

A lambida é desenhada por ÚLTIMO, na frente inclusive da grama da frente, porque
acontece na superfície da tela e não dentro da cena. São duas partes: a língua e
o **rastro úmido** que ela deixa e vai secando — é o rastro que vende a ideia de
vidro.

> Medido: chamando do canto, ele veio e cresceu **5,26×** (de 1.623 para 8.531
> pixels pintados) e a língua apareceu.

Bichinho doente, triste, faminto ou imundo **não passeia** — fica onde está. Um
bicho doente correndo pela ilha seria a mesma mentira que a legenda da casa já
contou uma vez. "Incomodado" ficou de fora dessa lista de propósito: esse humor é
sobre a CASA estar suja, não sobre ele estar mal.

**5. A casa com todos os moradores.**

Ela mostrava um bichinho mesmo com quatro adotados — e eles moram todos lá (a
sujeira de cada um cai no mesmo chão). Agora `/api/house` manda a lista inteira,
cada um tem o seu passeio (guardado por id, senão todos recomeçariam do meio da
sala a cada re-render) e todos entram na MESMA fila de profundidade dos móveis —
é isso que faz um passar atrás do outro e atrás do sofá. Desenhar os bichos por
último, que seria o caminho fácil, deixaria todos colados por cima da cena.

**Eles se encontram.** Quem chega a menos de uma célula e meia vira pro outro e
troca a ação por uma social. Bicho doente, triste ou dormindo não entra na
brincadeira — continua no estado dele.

O triângulo de ⚠ some no cômodo: lá são vários, e um por cabeça vira placa de
obra no meio da sala. Ele continua na tela do bichinho, que é onde há um só e
onde se resolve o problema.

**6. Dispensar um bichinho — o desfazer que faltava.**

Dava pra adotar e nunca pra desfazer. Como cada licença de espécie traz um
bichinho NOVO, comprar a segunda licença de gato deixa dois gatos na fila pra
sempre, sem saída — foi o que aconteceu com o dono. `POST /api/pet/{id}/soltar`,
com duas travas: **não dá pra soltar o último** (sem bichinho a casa perde o
morador e a tela volta pra adoção), e **soltar o ATIVO passa a vez pro próximo
antes de apagar**, senão `get_pet` ficaria sem ativo e todas as rotas de cuidado
passariam a responder sobre um bichinho que não existe mais. A sujeira que ele
deixou continua lá de propósito: o bicho foi embora, a bagunça não se limpa
sozinha.

**Estado: 623 verificações, 0 falha.** Build Vite aprovada. Conferido no
navegador: os três bichinhos na sala, o passeio com profundidade, a chamada e a
lambida no vidro, as seis vozes medidas e o dispensar ponta a ponta.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.13 As vozes, o áudio do Android, o iPhone mudo, o passeio e as moedas (26/08/2026)

Rodada pedida logo depois da 9.12, com sete coisas: as vozes não parecem com os
bichos, o Android não envia áudio pelo app do site, as notificações do iPhone
não funcionam direito, o movimento pra frente e pra trás está "completamente
bugado", a lambida na câmera ficou estranha, ganhar moeda está dificílimo — e,
no meio da rodada, que a **batalha naval não carrega as jogadas na hora**.

Cinco das sete tinham a mesma forma por baixo: **duas coisas descrevendo o
mesmo fato, ou nenhuma coisa conferindo o fato.**

**1. As vozes: as peças estavam certas e paradas.**

O arquivo já tinha fonte harmônica, ruído e formantes — o desenho do `soundgen`
— e mesmo assim os seis soavam parentes. O que faltava não era peça, era
MOVIMENTO. Quatro defeitos, todos do mesmo tipo:

- **o envelope não tinha corpo**: subia num ataque e caía até o fim, igual pra
  todo mundo. Isso é um bipe. Um miado se segura no ar meio segundo; um latido
  estoura e corta. Com a mesma forma no tempo pros seis, eles soavam da mesma
  família por baixo da frequência. Agora cada espécie tem o ADSR dela;
- **só o F1 se mexia**. O que faz o ouvido reconhecer um miado é F1 e F2 andando
  em direções OPOSTAS — a boca abre e ao mesmo tempo arredonda, que é o
  "mi-a-ow". Com o F2 cravado, todo som varria sempre pela mesma vogal, e vogal
  única soa sintetizada;
- **o jitter estava no papel errado**: era sorteado 40 vezes ao longo da sílaba,
  o que dá um tremor a ~70 Hz. Isso não é jitter, é modulação de frequência, e o
  ouvido lê isso como "eletrônico". Voz viva tem duas coisas separadas: vibrato
  lento e regular (5–8 Hz) e jitter fino e irregular. Agora são dois;
- **faltava rugosidade**. Rosnado e grunhido não são nota grave com ruído: são a
  fonte PULSANDO dezenas de vezes por segundo. É modulação de amplitude, e ela
  não existia em lugar nenhum — por isso o dragão era um zumbido de
  transformador e a capivara um apito abafado.

> **A bancada não podia ter pego isso, e agora pode.** Volume e agudez olham o
> som inteiro de uma vez: um bipe e um miado têm a mesma agudez média. A aba
> Vozes ganhou **movimento** (a agudez medida em fatias de 20 ms, e a razão
> entre a maior e a menor) e **corpo** (onde a energia se concentra no tempo).
> Movimento abaixo de 1,25× REPROVA — abaixo disso é uma nota, não uma
> vocalização. Hoje: 1,55× a 2,32×.
>
> E ela reprovou uma coisa na primeira medição desta correção: gato e cachorro
> tinham ficado a **4%** de distância de agudez. O gato tinha descido pra faixa
> real do miado e o cachorro estava sendo puxado pra cima por um ruído de banda
> larga — que é chiado de "s", não o "wuf" abafado de peito. Hoje: dragão 252,
> capivara 348, cachorro 567, gato 738, coelho 1696, pássaro 3121 Hz.

**2. O movimento pra frente e pra trás: duas variáveis para um fato só.**

O palco tinha `z` (a profundidade) **e** `perto` (o quanto está no vidro), e as
duas entravam na conta do tamanho ao mesmo tempo. Duas fontes da verdade pro
mesmo fato sempre acabam discordando, e aqui a discordância era visível:

- `perto` era ligado por ESTADO, não por posição. Ao entrar em "chegando" ele
  passava a valer o `z` da hora — que já era 0,55. O bicho **pulava de 1× pra
  1,5× parado no lugar**, antes do primeiro passo. Era o "pra frente" bugado;
- ao sair da lambida, `perto` caía de 1 pra 0 de uma vez com o bicho ainda
  colado no vidro: ele **despencava de tamanho sem ter andado**. Era o "pra
  trás";
- e a suavização de 420 ms transformava os dois saltos num zoom rápido, que é
  pior que o salto: parece a câmera pulando, não o bicho andando.

**O conserto é apagar `perto`.** A distância até a câmera é `z`, e só. Ele chega
perto porque ANDOU até lá. Não existe mais como os dois discordarem.

Dois defeitos de unidade vinham junto: `x` e `z` andavam na mesma velocidade,
normalizados pela hipotenusa como se fossem o mesmo espaço (atravessar de lado é
um passeio; atravessar a profundidade é ir do horizonte até o seu nariz), e o
destino trocava de uma vez, o que virava a direção em bico. Agora cada eixo tem
a sua velocidade e existe inércia.

> **A bancada ganhou a aba Passeio.** Ela simula três minutos de palco sem
> desenhar nada e mede o **maior salto de um quadro pro seguinte**. Bicho que
> anda cresce devagar; o defeito dava degrau. Medido: o palco **antigo** dá
> **3,31%** num quadro só (reprova); o novo, **0,414%** — com o limite em 1,5%.
> A prova de que a medida não está sempre verde é essa: ela reprova o código
> velho.

**3. A lambida: a língua nascia no rodapé.**

`base = h * 0,96`, `cx = w * 0,5`, fixo — o meio do rodapé da tela, viesse ele
de onde viesse. E ele lambe parado no ponto em que chegou, que é sorteado. A
língua subia por fora do corpo e lia como uma coisa rosa crescendo do chão. E o
"rastro" eram três elipses brancas no meio da tela, pulsando o tempo todo,
inclusive ANTES da primeira passada.

Agora a língua sai da BOCA (a tela passa a âncora, do mesmo jeito que já faz pro
objeto do item), na diagonal, e cada batida deixa a marca DELA, que seca sozinha
da beirada pro meio. Sem guardar estado: as batidas são periódicas, então dá pra
saber onde e quando foram as últimas quatro só olhando o relógio.

> Conferido na mesma aba Passeio, pelo método das outras abas — pinta e conta
> pixels: com uma âncora conhecida, o desenho ficou a **30 px** dela (o limite é
> 71), e a língua apareceu em 5 dos 12 instantes medidos.

**4. O áudio do Android: três falhas caladas.**

- **`recorder.start()` sem fatia de tempo.** Sem argumento, os dados só saem no
  fim, num `dataavailable` único — e no WebView do Android esse evento sai VAZIO
  com alguma frequência. O `Blob` ia com 0 byte, o servidor recusava e a
  mensagem se perdia. Com `start(250)` sempre há o que mandar;
- **o formato escolhido no escuro.** Agora a lista é percorrida com
  `isTypeSupported` na ordem do que o servidor sabe ler, e a extensão do arquivo
  sai do que foi gravado de verdade (ia `recado.webm` cravado, mesmo num mp4);
- **`onstop` como único ponto de chegada.** A ordem entre `dataavailable` e
  `stop` muda de navegador pra navegador. Agora resolve quem chegar por último,
  com prazo máximo pra nunca ficar pendurado.

E a regra que vale pras três: **nada mais falha em silêncio**. `parar()` devolve
`{ ok, reason }` com o motivo em português, os erros de microfone estão
separados (permissão negada, sem microfone, ocupado, sem HTTPS), e o botão de
gravar não some mais quando `mediaDevices` não existe — sumir não explicava
nada. É a mesma lição da tela de diagnóstico do push.

**5. O iPhone: faltava `Urgency`, e faltava escutar a assinatura mudar.**

Duas causas independentes, e as duas explicam "às vezes chega, às vezes não":

- **o envio ia sem `Urgency`**, e o padrão do protocolo é `normal` — que o APNs
  trata como "entrego quando for conveniente". Com o aparelho em baixo consumo,
  a tela apagada ou o app fechado, a Apple SEGURA e entrega em lote. Do lado do
  servidor tudo parecia certo, porque ela aceita (202) e decide o horário
  depois. Agora vai `Urgency: high`, e `Topic` junto (com o aparelho sem sinal,
  os avisos empilhados no serviço se substituem em vez de despencarem todos);
- **não havia `pushsubscriptionchange`.** A assinatura não é eterna: o iOS a
  renova sozinho, e com o app fechado. Sem ninguém escutando, o endereço novo
  nunca chegava ao servidor — que seguia mandando pro velho, levava 410, apagava
  o registro, e o aparelho ficava mudo **pra sempre**, sem erro em lugar nenhum.
  O único jeito de voltar era ligar de novo na mão, no Perfil.

O service worker agora avisa (`POST /api/push/resubscribe`), **e a tela
reconfere o endereço a cada abertura do app**. Os dois são necessários e por
motivos diferentes: o evento só dispara se o navegador estiver rodando na hora
da troca, e o iPhone troca com o app fechado — nesse caso o evento se perde e
quem conserta é a reconferência do boot.

> A rota não pede token, e não pode pedir: quem chama é o service worker, que
> roda sem página, sem `localStorage` e sem sessão. Se exigisse login, ela nunca
> poderia ser chamada na única situação em que existe pra ser usada. Quem prova
> a identidade é o endereço ANTIGO — uma URL longa e aleatória que só aquele
> aparelho conhece. **Sem ele, recusa**: adivinhar um dono mandaria as mensagens
> do casal pro celular errado. Os três casos estão no teste de fumaça.

**6. As moedas: a conta do dia não fechava.**

Medida com os valores antigos, uma pessoa tirava ~90 Corações por dia jogando
tudo o que dá pra jogar. E só a comida do bichinho comia ~60 deles: a fome caía
3 pontos por hora (72 por dia) e a ração dava 30 por 25 moedas. Sobravam uns 30
— um sofá de 300 levava **dez dias**. O jogo virou trabalho.

O conserto não é "aumentar um número", é mexer nos DOIS lados da conta. Só
aumentar a renda deixaria a manutenção comendo a mesma fatia, que era o defeito:

| | antes | agora |
|---|---|---|
| check-in (base + bônus por dia de sequência) | 15 + 2 | **25 + 3** |
| jogo com o bichinho (por partida, pelo placar) | 2 a 10 | **6 a 22** |
| memória / naval (primeira do dia) | 12 / 15 | **25 / 30** |
| as seguintes | 3 | **8** |
| as 5 missões do dia, somadas | ~100 | **~200** |
| **carinho** | nada | **12, por janela de 4 h** |
| fome que cai por hora | 3,0 | **2,0** |
| ração | 25 moedas por 30 de fome | **20 por 40** |

**O carinho passou a pagar**, e essa é a mudança de fundo. Até aqui o bichinho
só TIRAVA dinheiro do casal — comida, brinquedo, acessório, licença de espécie —
e nenhuma das coisas que se faz com ele de graça devolvia nada. Cuidar era
despesa e só o minigame era renda. O carinho já tinha descanso de 4 horas, então
ele é o lugar certo: a torneira já está fechada por um limite que existe por
outro motivo, e não precisou de regra nova. A chave de duplicidade é a JANELA, e
não o instante — dois toques no mesmo segundo pagariam duas vezes, que é a mesma
lição do `match_id` dos minijogos.

**7. A batalha naval "lenta": o ping era um monólogo.**

Pedido no meio da rodada: "estamos jogando batalha naval, não tá carregando
direto as jogadas, tá lento pra jogar".

O app mandava um `ping` a cada 25 segundos e **nunca conferia se voltava alguma
coisa**. O servidor sempre respondeu `pong` — só que ninguém do lado de cá
olhava. E conexão de celular não morre de um jeito limpo: trocar de Wi-Fi pra
4G, um proxy que desiste, o sistema congelando a aba deixam o socket **meio
aberto**. Nesse estado o `readyState` fica `OPEN` pra sempre, `onclose` nunca
dispara, e o app fica se achando conectado — com o indicador verde e tudo.

O efeito era exatamente o descrito: a jogada do outro não chegava por evento
nenhum e só aparecia quando algo forçasse uma busca (trocar de tela, minimizar e
voltar). Parecia lentidão do jogo; era uma conexão morta que ninguém tinha como
perceber. Agora todo sinal que chega marca a hora, e dois pings de silêncio
fecham o socket na marra — o `onclose` que já existia cuida da reconexão. A
queda deixa de ser eterna e passa a durar ~1 minuto.

Duas coisas vieram junto:

- **a revisão da partida viaja pra tela.** Toda jogada tem duas respostas
  viajando ao mesmo tempo (a do POST do tiro e a do GET que o evento dispara); se
  voltam fora de ordem, a mais velha sobrescrevia a mais nova e o tabuleiro
  piscava pra trás. A tela agora só aplica vista com revisão MAIOR;
- **uma rede de segurança só na vez do outro.** O conserto de verdade é o
  heartbeat, mas numa partida em que a pessoa está esperando a vez, dez segundos
  parados são o jogo travado. Enquanto a partida está em andamento **e** a vez é
  do outro, a tela busca a cada 5 segundos. Na sua vez ela para: aí quem manda a
  informação é o seu próprio toque.

**Estado: 640 verificações, 0 falha.** Build Vite aprovada. Conferido no
navegador: as seis vozes medidas e separadas, o passeio sem degrau (com o código
antigo reprovando na mesma régua) e a lambida saindo da boca.

**Ainda em aberto:** confirmar no aparelho — o áudio no Android e as
notificações no iPhone são correções que só o celular de vocês fecha, e as duas
agora dizem na tela o que deu errado se ainda der.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.14 A batalha naval ganha lugar, e o rosto que vazava (26/08/2026)

Pedido do dono, no mesmo dia: desenhar as embarcações e o mar ("do jeito que
está é genérico"), uma tela de fim mostrando quem ganhou e o prêmio em moedas
("nem tem um final, a tela só some"), fazer o jogo caber na tela ("fica com as
informações dos outros jogos lá em cima") — e, no meio disso, que a língua do
bichinho continuava bugada e havia "um recorte verde na parte de cima".

**1. Não cabia porque eram dois tabuleiros, não porque faltava rolagem.**

A naval era o ÚNICO jogo fora do modo tela cheia, e havia um comentário no
`Games.jsx` explicando o motivo: "são DOIS tabuleiros que precisam rolar". Só
que a rolagem era o remendo, não o problema. Num celular sobravam o título, o
botão, a fileira de abas dos quatro jogos, a barra de navegação **e** dois 8×8
empilhados.

Agora é **um tabuleiro grande por vez**: o mar do adversário ocupa a tela e a
sua frota virou minimapa de 92 px no rodapé, ao lado do contador e do Desistir.
Com isso a naval passou a caber, e a exclusão do modo tela cheia caiu junto —
ela entra como os outros três.

**2. O fim de partida virou uma tela.**

Antes, o tiro final derrubava a partida no mesmo `if` do "sem partida": a tela
do jogo sumia e voltava o cartão de abrir, com um aviso de uma linha. Quem
perdia nem entendia que tinha acabado. Agora é um estado próprio, com quem
venceu, o prêmio em Corações em destaque, o placar dos dois lados e a revanche.

> O valor **não** está na vista da partida: ele vem no `coins` da resposta do
> tiro que venceu, e só pra quem venceu. Ele é guardado quando chega. Quem
> perdeu, e quem recarregou a tela entre o tiro e o fim, não vê número nenhum —
> chutar um valor ali seria pior do que não mostrar.

**3. A arte: onde a IA entra, e onde ela não entra.**

O dono pediu "use a IA pras imagens". A régua de onde usar não foi inventada
agora — é a que o projeto já tinha escrito, na 9.9, sobre as cartas da memória:
*"aqui a carta É a arte, não tem estado, pose nem cor variável"*.

- **A tela de fim usa IA** (Pollinations `sana`, o mesmo gerador das cartas):
  duas ilustrações, 3 sementes por assunto, escolhidas olhando uma a uma. Uma
  das opções do troféu veio com uma **mão de gente** na imagem e foi descartada
  — o mesmo defeito que já tinha aparecido nas cartas. 3,2 KB e 2,4 KB.
- **O mar e os navios são código.** O navio cai do outro lado daquela frase: ele
  tem tamanho (2, 3 ou 4 casas), orientação (deitado ou em pé) e estado
  (inteiro, afundado), e precisa cair alinhado ao pixel numa grade que muda de
  tamanho conforme a tela. Tentei mesmo assim, como manda o precedente: o modelo
  devolveu **navio de guerra cinza em perspectiva nas seis tentativas**, nunca
  visto de cima — e um navio em perspectiva não encaixa numa grade vista de
  cima.

> **Duas rodadas de desenho, e as duas correções vieram de OLHAR.** A primeira
> versão saiu com o mar em faixas diagonais fortes, que ladrilhado não lia como
> água e sim como ZEBRA, e com três tubos cinza iguais de quadradinho branco em
> cima — genérico exatamente como o dono tinha reclamado. Hoje o mar é quase
> liso, com a variação em RETICULADO (mancha sólida virava gotas espalhadas, e o
> ladrilho parecia pele de réptil) e três ondinhas por quadro; e cada tamanho de
> navio tem a sua cor, com proa curta, cabine com janelinha e chaminé. A cor por
> tamanho não é enfeite: no seu tabuleiro é o que deixa ver de relance qual
> navio já foi atingido.

**4. Como os navios encaixam na grade.**

Uma camada que é uma grade IDÊNTICA à de baixo, sobreposta, com o navio
posicionado por `grid-column: span N` — quem faz a conta do tamanho da casa, do
vão e da margem é o navegador. Ela nunca recebe toque: quem responde ao dedo
continua sendo o `<button>` de cada casa.

> A camada copiava `inset: 5px` e `gap: 3px` na mão. Batia no tabuleiro grande e
> errava no minimapa, que usa `padding: 3px` e `gap: 1px` — os navios saíam de 1
> a 2 px fora das casas. Com `padding: inherit` e `gap: inherit` o desvio caiu
> pra menos de 1 px, e passa a valer pra qualquer variante nova.

E ela só existe no SEU tabuleiro: a posição da frota do outro não chega neste
app, então não há o que desenhar lá — que é a mesma trava de sempre.

**5. O "recorte verde": o chão da cena não era o chão do bicho.**

`desenharCena` recebe onde o bichinho pisa, e o próprio comentário dela avisava:
*"a mesma `plano.chao`, senão ele aparece flutuando acima da grama"*. O
`PetCanvas` mandava **0,84 da altura, cravado**, enquanto o passeio novo (9.13)
faz ele pisar entre 0,60 e 0,98 conforme a profundidade.

Dois números para o mesmo fato, **de novo** — e o resultado era o bicho andando
no ar a maior parte do tempo, com a borda reta do campo cortando a tela no meio
como um recorte colado. Agora os dois saem da mesma constante exportada
(`CHAO_FUNDO`), e a faixa de grama é grande o bastante pra caber o passeio.

**6. A "língua bugada" não era a língua: era o rosto vazando.**

O que o dono via era uma mancha rosa grudada na lateral da cara, **do lado de
fora do contorno**. Não tinha relação com a lambida no vidro.

A cabeça é uma ELIPSE, e cada peça do rosto era ancorada numa fração fixa da
meia-largura com o raio saindo de outra conta, que não sabia da primeira — a
mesma frase que descreve o defeito dos olhos, corrigido na 9.11. A lista daquela
rodada (orelha, chifre, bico, cauda, pata, asa, espinho, marca, sombra) não
incluiu nariz, bochecha e boca, e neles o defeito sobreviveu.

Perto do meio da altura isso passa; perto da borda, a elipse já estreitou e a
meia-largura real ali é bem menor. Medido no coelho grande, que é o pior caso
(cabeça menor em relação ao corpo, porque as orelhas comem o tamanho):

| peça | borda | limite da cabeça | |
|---|---|---|---|
| bochecha direita | 36,1 | 30,4 | **vazava 5,7 px** |
| nariz | 35,8 | 33,2 | **vazava 2,6 px** |
| bochecha esquerda | 10,2 | 31,0 | ok |
| focinho | 29,2 | 32,2 | ok |

Agora existe `noRosto(fx, fy, raio)`: ele calcula a meia-largura da elipse **na
altura em que a peça vai ficar** e recua o `x` o quanto for preciso. Não há como
uma peça sair do rosto, cresça a escala o quanto crescer.

> **A coleira veio junto, e é o outro extremo da mesma medida.** Ela tinha ido
> de 1,02 (que era bochecha) para 1,38 na 9.11. Só que 1,38 são 0,38 de raio
> ABAIXO da borda da cabeça: num cachorro isso é pescoço, mas no coelho e na
> capivara — os dois que praticamente não têm pescoço, como já estava anotado no
> próprio código — a cabeça encosta no corpo e aquilo já é PEITO. A coleira
> virava um crachá pendurado na barriga nas seis espécies. 1,14 é a borda mais
> uma folga fina, e serve para quem tem e para quem não tem pescoço.

**7. A bancada ganhou a aba Naval.**

Ela confere o que o CSS não teria como acusar, porque estes desenhos viram
`data:` URL e entram como imagem de fundo — e um `background-image` vazio não
reclama de nada, só deixa a casa sem fundo:

- **desenho vazio** (a regra de sempre, em vermelho);
- **a proporção**, que é o que faz o navio encaixar: um navio de 3 casas TEM que
  sair com 3× mais largura que altura. Os seis batem exatamente, e as versões em
  pé têm a mesma contagem de pixels das deitadas — prova de que a rotação (feita
  no canvas, não por `transform`, que reamostra) não perde nada;
- **a emenda do ladrilho**: a coluna da esquerda é comparada com a da direita e o
  topo com a base. Uma onda que não fecha vira uma listra atravessando o
  tabuleiro inteiro. Deu **2,4** de diferença, com o limite em 18.

E o teste de fumaça passou a conferir que as duas ilustrações do fim existem no
disco — mesma ponte das cartas da memória, e pelo mesmo motivo: arquivo faltando
não dá erro, dá um buraco na tela.

**Estado: 642 verificações, 0 falha.** Build Vite aprovada.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.15 O campo, a língua e o diagnóstico do microfone (27/08/2026)

Terceira volta nos mesmos três pontos: "o quadrado verde na metade da tela do
bichinho continua", "quando ele lambe a câmera ainda tá bugado" e "mandar áudio
no Android ainda não funciona, mesmo no navegador pelo link".

**1. O quadrado verde: eu tinha consertado a geometria e criado um problema de
desenho.**

Na 9.14 o chão da cena passou a ser o mesmo em que o bichinho pisa — e isso
estava certo, ele parou de flutuar. Só que o campo era um `fillRect` de cor
chapada, o que bastava enquanto ele ocupava a faixa fina de baixo. Passando a
ocupar **40% da tela**, um retângulo liso desse tamanho não lê como campo: lê
como um bloco verde colado por cima do cenário, com uma borda reta atravessando
de ponta a ponta. Era literalmente um quadrado verde na metade da tela.

Agora o campo tem distância, como o céu e o mar já tinham: cinco faixas do mais
escuro e frio no fundo ao mais claro na frente, **com reticulado nas emendas**
(faixa sem reticulado devolve a listra dura que se está tirando) e manchas de
tom espalhadas por cima.

**2. A língua: eu estava chutando onde fica a boca.**

Três tentativas, e as duas primeiras erradas pelo mesmo motivo de fundo.

A da 9.13 ancorava a língua em **0,74 da altura do bicho**, medida do chão pra
cima. Parece razoável até lembrar de QUEM é o bichinho dele: um coelho, cuja
altura é quase toda orelha. Nele, 0,74 cai na altura das **pontas das orelhas** —
e era de lá que a língua saía, apontando pro lado. Antes disso, na 9.12, ela
nascia no meio do rodapé da tela.

O conserto é não chutar: `desenharRig` já devolve `focinho: [x, y]`, que é onde
o desenho colocou o focinho **naquele quadro**, com pose, espécie e crescimento
já aplicados. `drawPet` passou a devolver esses marcos, e a lambida usa o ponto
real. É o mesmo ponto que o rig usa pra desenhar o nariz — não há como
divergirem.

> Dois detalhes que a correção obrigou: o espelhamento tem de ser desfeito na
> mão (o bicho é desenhado dentro de um `scale(-1, 1)` e a lambida roda fora
> daquele `save/restore`), e o alcance da língua passou a sair da **cabeça**, não
> da altura total — pela mesma razão das orelhas.
>
> E a direção: ela subia de 0,55 a 0,85 do alcance ACIMA da boca. Um bicho
> lambendo o vidro passa a língua PELA FRENTE do rosto, na altura da boca. Agora
> o deslocamento grande é no eixo em que ele está virado, e o de altura fica em
> ±0,2 — o suficiente pra as passadas não caírem na mesma linha.

**3. O áudio: parei de adivinhar e construí o diagnóstico.**

Três relatos de "não funciona", o último já com o gravador corrigido **e pelo
navegador, no link** — nem é caso de PWA ou APK. Daqui não há como saber onde
para: gravar áudio depende de sete coisas em sequência, e quase todas falham do
mesmo jeito quando falham — nada acontece.

É a mesma situação do push no iPhone, que ficou muito tempo "não chegando" até
existir uma tela dizendo qual das três condições tinha falhado. Então o
entregável desta rodada não é mais um palpite de correção: é **transformar "não
funciona" em "parou no passo N, por causa de X"**.

`Perfil → Áudio neste aparelho` roda os sete passos de verdade, um por linha, em
português:

1. conexão segura (sem HTTPS o navegador nem pergunta);
2. o navegador sabe gravar (`mediaDevices` e `MediaRecorder`);
3. qual formato ele escolheu;
4. a permissão do microfone — com o motivo separado por tipo de recusa
   (negada, sem microfone, ocupado, bloqueada);
5. **a faixa está viva e não está muda** — uma faixa `muted` grava silêncio e
   ninguém avisa;
6. grava 2 segundos e diz quantos KB saíram (é aqui que a gravação vazia do
   WebView do Android apareceria, com nome);
7. **manda pro servidor conferir** — o único passo que a tela não consegue
   testar sozinha, e onde um formato que o servidor não reconhece apareceria,
   porque ele decide o tipo pelos primeiros BYTES;
8. e toca de volta.

> A rota é `POST /api/chat/audio/teste`, e ela **valida pelo mesmo caminho do
> envio de verdade** (`media_store.probe_audio`, que divide a detecção com o
> `save_audio` numa função só) e joga o arquivo fora. Um diagnóstico que valida
> diferente do caminho real manda procurar o defeito no lugar errado — pior do
> que não ter diagnóstico. O smoke confere as duas coisas: que ele aceita e
> recusa igual ao envio, e que **não deixa nada na conversa**.

**Duas coisas que só apareceram porque a tela foi aberta de verdade:** o
`Profile.jsx` não importava `Icon` (a tela inteira caía no ErrorBoundary com
"Icon is not defined" — build passa, porque JS não confere símbolo), e não
existe ícone `mic` no conjunto; um nome desconhecido não desenha nada e não
reclama.

**Estado: 646 verificações, 0 falha.** Build Vite aprovada.

**O que fica com você:** abra Perfil → Áudio neste aparelho no Android e me diga
em que linha aparece o ❌. Com esse dado o conserto é direto; sem ele, qualquer
correção minha continua sendo chute.

### 9.16 O microfone estava bloqueado, e o quadrado verde era o CSS (27/08/2026)

Pedido do dono: "o quadro verde acima do boneco ainda aparece, já pedi pra
corrigir múltiplas vezes; e o áudio ainda não funciona, e não pede a permissão
como deveria".

Desta vez ele veio com o print do diagnóstico da 9.15, e o print **entregou a
resposta**: os três primeiros passos ✅ e o quarto ❌ — `NotAllowedError`. Foi
exatamente pra isso que a tela foi feita.

#### O áudio: o navegador não pergunta mais porque já tem um "não" guardado

O erro `NotAllowedError` cobre dois fatos bem diferentes, e o app tratava os
dois como um só:

| O que aconteceu | Dá pra tentar de novo? |
|---|---|
| A pergunta apareceu e foi fechada sem resposta | **Sim** — toca de novo e responde |
| A permissão está negada para a ORIGEM | **Não.** O navegador não pergunta mais nada |

No segundo caso não existe recurso do lado do app: nenhuma chamada, nenhum
gesto e nenhuma opção reabrem a pergunta. Só o dono do aparelho reabre, nos
ajustes do site. Enquanto a tela dizia só "libere nos ajustes do site", a pessoa
ficava tocando no botão esperando uma pergunta que nunca mais vinha — que é
literalmente o "não pede a permissão como deveria" do relato.

E como o "não" é guardado **por origem**, ele vale para o site, para o atalho na
tela de início e para qualquer aba: todos são o mesmo `https://<host>`. Por isso
"no navegador pelo link também não" nunca contradisse nada — é o mesmo lugar,
com o mesmo "não".

**O que mudou:**

- Nasceu `web/src/lib/microfone.js`, **fonte única**: onde o app está rodando
  (site, atalho ou APK), o estado guardado da permissão
  (`navigator.permissions.query`), o caminho de volta em passos para *aquele*
  aparelho, e uma porta só de pedir o microfone.
  - A tradução do erro existia em DOIS lugares — no chat e no diagnóstico —,
    duas listas parecidas e diferentes pro mesmo fato. É a família de defeito
    que este projeto já pagou caro três vezes (o prompt com dois donos, o chão
    com dois números, o fundo do palco logo abaixo). Agora é uma.
- O estado é lido **antes** de pedir, e relido **depois** de falhar: é a única
  forma de separar "fechou a pergunta agora" de "está bloqueado", já que o erro
  é o mesmo nos dois casos.
- Quando está bloqueado, a tela mostra o passo a passo **do aparelho em que ela
  está** — Ajustes do Android → Apps no APK, cadeado 🔒 → Permissões no
  navegador, Ajustes → Safari → Microfone no iPhone. Sem "verifique as
  configurações".
- Isso vale nos dois lugares: no diagnóstico do Perfil **e** no erro do chat, que
  é onde a pessoa está quando o problema aparece.
- "Detalhes do aparelho" ganhou duas linhas que faltavam pra qualquer diagnóstico
  à distância: `microfone: granted|denied|prompt` e `rodando: site no Chrome |
  atalho na tela de início | APK`.

**O resto da corrente está provado bom.** Com o microfone substituído por uma
faixa de áudio real gerada no próprio navegador (um tom de 440 Hz por
`MediaStreamDestination` — um `MediaStream` de verdade, não um simulacro), os
sete passos passam: grava 31,4 KB, o servidor reconhece como webm e o arquivo
toca de volta. Gravador, formato, envio e reprodução estão certos; **o único elo
quebrado no aparelho dele é a permissão.**

> ⚠️ **O APK em `releases/` é de 23/08** — anterior a todas as correções de
> áudio, e às telas de diagnóstico. Quem abrir o áudio por ele não está testando
> nada do que foi feito depois. Os prints do dono mostram a tela nova, então ele
> está pelo link; mas o APK precisa ser regerado antes de ser usado pra julgar
> qualquer coisa.

#### O quadrado verde: terceira aparição, terceiro dono duplicado

As duas primeiras foram a geometria do chão (9.14) e a cor chapada do campo
(9.15). As duas estavam certas — e o quadrado continuou lá, porque **ele nunca
foi desenhado**. Era CSS:

```css
.pet-stage { background: linear-gradient(#dcead9 0 62%, #c99e70 62%); }
```

Esse é o fundo de duas faixas chapadas de **antes da ilha existir** — o próprio
cabeçalho de `petCena.js` o cita como "o que havia antes". A cena passou a ser
pintada em canvas e ninguém apagou a linha. Ele só aparecia na sobra da caixa, e
por isso parecia um retângulo com borda reta encostado no céu azul do desenho.

E a sobra era **enorme** por uma segunda causa, medida no navegador:

| | antes | depois |
|---|---|---|
| Palco | 343 × **614** | 343 × 614 |
| Cena desenhada | 384 × **324** | 384 × **612** |
| Sobra acima do bichinho | **288 px** | **0** |

O palco tinha `height: 100%` num grid `align-items: stretch`: ele esticava até a
altura da **lista de itens** ao lado. Seis itens, 614 px de caixa — e a cena com
128×108 cravado nunca ia cobrir isso.

**O conserto tem três partes, e nenhuma delas é pintar a sobra:**

1. O CSS perdeu o fundo próprio. Quem decide a cor é o desenho: `corDoCeu()` em
   `petCena.js` entrega a mesma cor da primeira faixa do céu, e a tela passa por
   `--pet-ceu`. Uma fonte só.
2. O palco parou de esticar (`align-items: start`) e ganhou a proporção da
   própria cena.
3. **A caixa de referência deixou de ser 128×108 cravado.** A cena nunca precisou
   disso: `petCena` recebe largura, altura e a linha do chão, e `enquadrar` mede
   tudo em fração da altura — só a caixa é que estava fixa. Com `preencher`, a
   altura sai da caixa REAL, o canvas cobre o palco inteiro e **não existe mais
   sobra pra pintar, de qualquer cor**.

O bichinho não encolheu: ele continua com os mesmos 198 px de largura, e o que
era bloco verde virou céu, montanha, mar, praia e as cinco faixas do campo.
Fora da tela do bichinho nada muda — a ficha de espécie e a corrida continuam na
caixa de 108, porque `preencher` é opt-in.

**As duas causas ficaram travadas no smoke:** o CSS não pode voltar a ter fundo
próprio (conferido com os comentários removidos, pra explicação poder citar o
gradiente errado), o palco não pode voltar a esticar, a cena tem que desenhar na
altura da caixa, e as duas telas do microfone têm que pedir pela fonte única sem
tabela de erro própria.

**Estado: 655 verificações, 0 falha.** Build Vite aprovada. Conferido no
navegador: sobra 0 px, bancada `/lab` com as 13 abas sem nenhum desenho vazio, e
o diagnóstico do microfone rodado nos dois caminhos (bloqueado e liberado).

**O que fica com você:** liberar o microfone nos ajustes do site, pelos passos
que a tela agora mostra. Depois disso o áudio do chat funciona — o resto da
corrente já está provado.

### 9.17 Eu tirei o pedido de dentro do toque, e por isso o modal sumiu (27/08/2026)

Pedido do dono: "não tem onde dar essa permissão; quero que ao clicar em testar
microfone abra o modal de permissão, igual foi com a câmera e as notificações".

Duas coisas erradas, e a primeira é minha, da 9.16.

#### 1. A consulta na frente do pedido matou a pergunta

Na 9.16 eu escrevi `pedirMicrofone` assim:

```js
const antes = await estadoDoMicrofone()     // ← navigator.permissions.query
if (antes === 'denied') return { bloqueado: true, ... }
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
```

Parecia esperto e é o defeito inteiro, por dois motivos:

1. **`getUserMedia` deixou de ser chamada dentro do toque.** O navegador só
   mostra a pergunta enquanto a ativação por gesto está de pé, e um `await` no
   caminho é exatamente o que pode derrubá-la. É a **armadilha nº 9 deste
   próprio HANDOFF** ("a permissão só pode ser pedida dentro de um toque") — eu
   a reabri escrevendo o conserto dela.
2. **Com o estado lido como `denied`, o código nem tentava.** E o estado
   guardado erra: em WebView e em atalho instalado ele responde por outra via.
   Um "não" velho ali passou a impedir a pergunta que ainda apareceria.

Agora a ordem é a certa e não tem nada na frente: **pede primeiro**. O estado só
é consultado **depois de uma recusa**, e só para explicá-la. Consultar não
conserta nada; pedir, sim.

> **Medido no navegador, não deduzido.** Um ouvinte de captura no botão marca o
> início do toque e agenda uma microtarefa; o `getUserMedia` é interceptado e
> anota se ela já rodou. Se rodou, houve `await` no meio. Os três caminhos —
> "Liberar o microfone", "Testar o microfone" e o botão do chat — respondem
> **"mesma tarefa do toque"**. E o smoke trava isso: dentro de `pedirMicrofone`,
> o `await navigator.mediaDevices.getUserMedia` tem que vir antes de qualquer
> `await estadoDoMicrofone`. (Conferido reintroduzindo o defeito de propósito: a
> verificação fica vermelha.)

#### 2. "Não tem onde dar essa permissão" — e não tinha mesmo

O caminho que a 9.16 mandava para o atalho instalado era o cadeado 🔒 do
navegador. **Num atalho instalado não existe barra de endereço**, logo não existe
cadeado; e pior, para um atalho que virou aplicativo (WebAPK, que é o que o
Chrome no Android faz com um app instalável) o próprio Chrome **delega o
microfone, a câmera e a localização às permissões do APLICATIVO**. Ou seja: nesse
caso o microfone nem mora no cadeado — mora nos Ajustes do Android, na mesma
lista em que ficam a câmera e os avisos, que são justamente os dois que ele viu
funcionar.

O passo a passo do caso instalado agora começa por lá — Ajustes → Apps → Nosso
app → Permissões → Microfone — e o caminho do navegador fica como segunda opção,
para quando o atalho não tiver virado aplicativo.

#### 3. Um botão só para abrir a pergunta

`abrirPergunta()` é o caminho mais curto que existe entre um toque e o
`getUserMedia`: pede, fecha a faixa na hora (segurá-la acenderia a luz de
"gravando" sem ninguém gravar) e devolve o motivo. Virou o botão **"Liberar o
microfone"**, em destaque, acima do teste dos sete passos — que continua existindo
e leva dois segundos gravando, tempo demais para uma coisa que ou pergunta na
hora ou não pergunta nunca.

**Uma hipótese descartada de saída, e vale registrar:** certificado inválido faz
o Chrome bloquear permissões *sem oferecer onde liberar*, que casava exatamente
com o relato. Não é o caso — `nossoamor.209.50.229.119.sslip.io` tem Let's
Encrypt válido até 09/11/2026, conferido sem `-k`.

**Estado: 657 verificações, 0 falha.** Build Vite aprovada.

### 9.18 A trava do microfone tem três andares, e eu insistia num só (27/08/2026)

Pedido do dono: "continua não funcionando, e nem pedindo a permissão como
deveria, e as instruções suas de como liberar não funcionam; **testei em outros
navegadores**".

Ele mandou dois prints, e os dois derrubam o que eu vinha dizendo.

#### A frase que resolve o caso

**"Testei em outros navegadores."** Permissão de site é guardada *por navegador*.
Se falha em mais de um, **não é permissão de site** — só sobra o que é comum aos
dois, que é o aparelho. Eu passei duas rodadas mandando ele consertar uma coisa
que, pela própria observação dele, não podia ser a causa.

`NotAllowedError` sai igualzinho de **três** coisas diferentes:

| Andar | Alcance | Onde se mexe |
|---|---|---|
| Chave geral do microfone do Android | o **aparelho inteiro** | Ajustes → Segurança e privacidade → Controles de privacidade → Acesso ao microfone |
| Permissão de app do navegador | **todos os sites** daquele navegador | Ajustes → Apps → *navegador* → Permissões → Microfone |
| Permissão do site | **um** site num navegador | configurações do navegador |

Os dois primeiros atravessam navegador. Eu chamava os três de "bloqueado para
este endereço", com toda a confiança do mundo.

**O que separa é `enumerateDevices()`**, e ele não pede nada a ninguém:

- `audioinput` = **0** → o sistema não entrega microfone nenhum: a trava está
  **abaixo** do site (chave geral ou permissão do app);
- `audioinput` ≥ 1 **sem nome** → existe microfone, e é o site que está negado (o
  nome só aparece depois do "permitir");
- `audioinput` ≥ 1 **com nome** → já está liberado.

Agora a tela diz o andar provável, mostra o **seguinte logo abaixo** dito como o
que é ("se a chave geral já estiver ligada, é a permissão do navegador"), e
imprime o nome cru do erro. Do lado de cá não dá pra ter certeza de qual andar é
— dá pra saber o mais provável. Fingir certeza foi o erro; mostrar os dois na
ordem é o conserto.

#### O outro print: o cadeado do Samsung Internet não tem permissões

Ele é usuário do **Samsung Internet**, e o print do painel do cadeado mostra
"Informações de privacidade": conexão segura, rastreadores bloqueados, cookies,
OK. **Não existe seção de permissões ali.** Minha instrução — "toca no cadeado 🔒
→ Permissões → Microfone" — mandava pra uma tela que não existe naquele
navegador.

O caminho do site agora é **por navegador**, escrito com o nome que cada um usa:
Samsung Internet vai por Menu ☰ → Configurações → Sites e downloads → Permissões
de site → Microfone (e a primeira linha avisa que o cadeado não serve); o Chrome
vai por Menu ⋮ → Configurações → Configurações do site.

> **A lição, que é a mesma de sempre neste projeto:** instrução para o dono é
> entrega, e entrega não conferida é chute. Eu escrevi três caminhos de
> recuperação sem nunca ter aberto a tela de nenhum deles.

**Travado no smoke:** que a medida de `enumerateDevices` exista, que os andares
`geral` e `app` sejam apontados, que o caminho do Samsung Internet não mande pro
cadeado, e que o nome do erro chegue à tela.

**Estado: 662 verificações, 0 falha.** Build Vite aprovada; os dois cenários
(nenhuma entrada de áudio, e entrada existindo com o site negado) conferidos no
navegador.

### 9.19 O atalho não tem microfone pra dar, e a URL do áudio balançava (27/08/2026)

Duas coisas nesta rodada, e a segunda é uma regressão de verdade que o dono
pegou no meio: "agora os áudios que a outra pessoa enviou não estão funcionando
também".

#### 1. O microfone: o atalho instalado não tem a permissão, e nem tem como ter

Os prints fecharam o caso. A tela "Permissões do app" do **"Nos"** (que é o
`short_name` do nosso `manifest.webmanifest` — é o atalho instalado) mostra:

```
Com permissão:   Notificações
Sem permissão:   Nenhuma permissão negada
```

**Não existe Microfone em lugar nenhum daquela lista.** Não foi negado: não há o
que permitir. E o print do Chrome, ao lado, mostra Câmera, Localização,
**Microfone** e Notificações todos concedidos — ou seja, a chave geral do
aparelho está ligada e o Chrome tem microfone. As duas hipóteses das rodadas 9.17
e 9.18 caem juntas.

O que acontece de verdade: quando o Chrome instala um app na tela de início, ele
gera um **aplicativo Android (WebAPK)** com um manifesto próprio de permissões, e
**delega** microfone/câmera/localização à permissão desse aplicativo. O WebAPK
gerado aqui declarou só notificações. Então, dentro do atalho, o pedido de
microfone morre antes de virar pergunta — sem prompt, sem erro visível e sem
nenhum ajuste que resolva. Foi isso que o dono viveu por três rodadas enquanto eu
mandava ele mexer em permissão de site.

`enumerateDevices()` devolvendo **zero** entradas de áudio é o sinal, e agora ele
é lido **antes** da hipótese da chave geral — os dois casos dão zero, e o do
atalho é o mais específico.

A tela agora diz isso com todas as letras e oferece a saída em um toque: um botão
**"Abrir no Chrome"**. `target="_blank"` não serve (o endereço está no escopo do
próprio app, então abre ali mesmo, que é justamente o lugar de onde se precisa
sair); quem sai é um `intent:` nomeando o pacote do Chrome. Ao lado fica
"Copiar o link", porque o intent depende do Chrome estar instalado.

> **O que ficou pendente e não dá pra resolver daqui:** gravar áudio *dentro do
> atalho* exige um app que declare `RECORD_AUDIO` — que é exatamente o que o APK
> por Capacitor faz (`web/android/.../AndroidManifest.xml` já tem a linha, e o
> Capacitor 8 mostra o modal nativo por `onPermissionRequest`). Mas **não há Java
> nem Android SDK nesta máquina** (`java: command not found`, `ANDROID_HOME`
> vazio) e o projeto não tem workflow de CI. O APK em `releases/` continua o de
> 23/08. Montar o build no GitHub Actions, como no app do painel da barbearia, é
> a tarefa que fecha isso.

#### 2. A regressão: a URL da mídia mudava a cada leitura

A URL de mídia é **duas coisas ao mesmo tempo**: a identidade do arquivo (o
caminho) e a credencial pra abrir (o `?token=`). E o token era cunhado com
`exp = agora + 120min` — **que muda a cada segundo**. Duas leituras seguidas da
mesma conversa devolviam endereços diferentes pra mesma mensagem. Medido:

```
mensagem 27: a URL e a MESMA nas duas leituras? False
mensagem 28: a URL e a MESMA nas duas leituras? False
```

Do lado do app isso não é detalhe: trocar o `src` de um `<audio>` faz o navegador
**abortar e recarregar** o elemento. E a conversa se re-sincroniza a cada evento
do WebSocket, a cada volta pro app e a cada reconexão — então o áudio da outra
pessoa parava no meio, ou nem começava. Piorou agora porque a 9.13 deixou a
reconexão mais agressiva (dois pings de silêncio derrubam o socket) e acrescentou
uma conferência a cada 5 s. As **fotos** eram baixadas de novo pelo mesmo motivo.

**Conserto na raiz, no servidor:** `create_media_token` arredonda o vencimento
pra próxima marca de uma janela (`MEDIA_TOKEN_JANELA_MIN = 60`). JWT com a mesma
carga e a mesma chave dá o mesmo texto, então leituras seguidas devolvem o token
**byte por byte igual**. O token continua curto (entre 1 e 2 horas) e continua
abrindo só mídia.

**Cinto de segurança no app:** o `<audio>` passou a ser governado pelo
**caminho**, não pela URL inteira — token novo do mesmo arquivo não recarrega
nada. E se tocar falhar, ele tenta uma segunda vez com o endereço mais recente
(o caso de a tela ficar aberta além da validade).

**E o defeito calado que estava junto:** `el.play()` devolve uma Promise e a
recusa dela **nunca era lida**. O botão virava ❚❚, nada tocava e nada aparecia na
tela. Agora o motivo aparece embaixo do áudio.

> **Medido no navegador:** com o áudio tocando, uma sincronização da conversa
> forçada no meio — ele seguiu de 0,48 s para 1,71 s, ainda tocando, e o `src`
> não mudou.

**Travado no smoke:** duas chamadas seguidas de `create_media_token` têm que dar
o mesmo texto, e o token não pode passar de ~3 h de vida (arredondar não pode
virar token eterno).

**Estado: 664 verificações, 0 falha.** Build Vite aprovada.

### 9.20 Eu quebrei a reprodução tentando protegê-la (27/08/2026)

Relato do dono: "agora diz que o aparelho não sabe tocar o áudio; o negócio tava
funcionando, você estragou. E abri no navegador e nem no navegador envia o
áudio, nada a ver com o atalho."

Ele está certo nas duas, e a primeira é minha, da 9.19.

#### A tentativa de conserto que virou o defeito

Junto com o conserto de raiz da 9.19 (o token de mídia arredondado, que é bom e
fica) eu enfiei um **plano B** no caminho da reprodução: se o primeiro
`el.play()` falhasse, o código trocava `el.src`, chamava `el.load()` e tentava de
novo, "caso o token tivesse vencido".

Isso é a única coisa nova capaz de **criar** um estado de erro onde não havia.
`load()` aborta um carregamento em andamento; uma recusa passageira do primeiro
`play()` — comuníssima no Android — passava a terminar num elemento em erro. E
o texto que eu escrevi pra esse caso culpava o aparelho pelo formato:

> "Este aparelho não sabe tocar o formato deste áudio."

Ou seja: eu transformei um tropeço transitório numa acusação, e a acusação estava
errada. **O plano B foi removido inteiro.**

Também tirei o `estado + efeito` que fixava a URL e pus um `ref` decidido **no
render**: estado atualizado por efeito tem uma janela em que o elemento já está
na tela com o valor velho. Agora não há janela.

#### E a mensagem de erro não chuta mais

O `<audio>` é péssima testemunha: ele reduz "não achei o arquivo", "não posso ler
o arquivo" e "não sei tocar esse formato" ao **mesmo** `NotSupportedError`. Então,
quando falha, a tela agora **lê o endereço** e diz o que voltou:

| O que a busca responde | O que a tela diz |
|---|---|
| 401 / 403 | "O endereço deste áudio venceu. Puxa a conversa pra baixo." |
| 404 | "Este áudio não está mais no servidor." |
| 0 byte | "Este áudio foi gravado vazio — não há som nele." |
| 200, com tamanho | "O arquivo chegou inteiro (tipo, KB), mas este navegador não sabe tocar esse formato." |

Só no último caso o formato é acusado — e com o tipo e o tamanho na mão.

> **Conferido com áudio de verdade, no botão de verdade** — que foi o teste que
> faltou na 9.19. Um webm/opus real de 30 KB, gravado no navegador por
> `MediaRecorder`, enviado pela rota do chat e tocado pelo ▶: **1,86 s de um
> arquivo de 2 s, sem erro**. E o arquivo propositalmente quebrado dá a mensagem
> nova, correta: "O arquivo chegou inteiro (video/webm, 5 KB), mas este navegador
> não sabe tocar esse formato."

#### O envio: parei de responder com palpite

"Não envia áudio" chegou até mim três rodadas seguidas como três palavras, e três
vezes eu respondi com hipótese. Agora **toda recusa carrega uma linha com tudo**,
e ela aparece no chat — onde a pessoa está quando o problema acontece — e não só
no diagnóstico do Perfil:

```
[NotFoundError · permissão: denied · microfones: 0 · Chrome]
```

Erro cru, estado guardado da permissão, quantos microfones o sistema entrega e
onde o app está rodando. Uma foto da tela passa a bastar.

**Uma hipótese conferida e descartada de saída:** o servidor não reconhecer o
formato do Samsung Internet. `_detect_audio` já trata `ftyp` (MP4/AAC) além de
webm, ogg, mp3 e wav — o envio não é recusado por formato.

**Estado: 664 verificações, 0 falha.** Build Vite aprovada.

### 9.21 Eu apaguei as fotos e os áudios de vocês (27/08/2026)

> **Esta é a seção mais importante deste arquivo. Leia antes de dar qualquer
> deploy neste projeto.**

Relato do dono, depois de horas: "os áudios enviados do iPhone dela continuam não
reproduzindo no meu Android, o que funcionava antes, nem faz sentido isso ter
parado de funcionar". E depois, a frase que resolveu: **"abri o dela no meu
celular e funciona"**.

Eu passei quatro rodadas atrás de formato, permissão e código. Não era nada
disso.

#### A causa

```
$ docker inspect <container> --format '{{json .Mounts}}'
[]
```

**`/app/media` nunca esteve num volume.** Ele vivia na camada de escrita do
container. Todo deploy troca o container — e leva junto **toda** foto e **todo**
áudio já enviados. Eu dei **cinco deploys hoje**.

O passo 4 da seção 7 deste arquivo diz, desde o começo:

> `STORAGE_DIR` (volume de disco, senão as fotos somem no deploy)

Estava escrito, e nunca foi feito. Eu li esse arquivo hoje de manhã e deployei
cinco vezes sem conferir.

#### Por que o rastro apontava pro lugar errado

O **banco é PostgreSQL e persiste** — então as mensagens continuaram lá, com as
bolhas de áudio e as miniaturas de foto na tela. Só o **arquivo** sumiu. O
`<audio>` pedia o arquivo, levava 404, e o navegador reduz isso a
`MEDIA_ERR_SRC_NOT_SUPPORTED` — o mesmo erro de "não sei tocar este formato".
Foi exatamente isso que a minha mensagem da 9.19 leu e traduziu como "este
aparelho não sabe tocar o formato deste áudio": uma acusação errada, construída
em cima de um erro ambíguo.

E "abri o dela no meu celular e funciona" fecha: o único áudio que restava era um
que ela tinha mandado **depois** do último deploy. Esse tocava. Todos os
anteriores tinham sido destruídos.

#### O que foi feito

1. **Os três arquivos que sobraram foram copiados pra fora do container** antes
   de qualquer coisa (`/root/media-casal-resgate`).
2. **Volume permanente criado**: `/data/casal-media` → `/app/media`, pela API do
   Coolify (`type: "persistent"` — os outros valores que tentei são recusados).
3. Os arquivos foram postos no volume e o app redeployado. Conferido no
   container novo:
   ```
   /data/casal-media -> /app/media (bind)
   202608_kQz2kkwtHE76bNnB.m4a   202608_l4ttSpcngk4BUf9n.jpg   thumb_...jpg
   ```
   **A partir de agora deploy não apaga mais nada.**
4. **O que foi apagado antes disso não volta.** Procurei em volumes órfãos, em
   containers parados e nas camadas do Docker: não sobrou nada. Os backups do
   Coolify são do banco, não de arquivo. As fotos e os áudios anteriores a
   27/08 16:10 UTC estão perdidos, e a culpa é minha.

> **Regra que fica:** antes do primeiro deploy de qualquer app deste servidor,
> `docker inspect <container> --format '{{json .Mounts}}'`. Se voltar `[]` e o
> app escrever arquivo, **não deploye** — crie o volume primeiro.

#### E um defeito de verdade que apareceu no caminho

Enquanto media o problema achei outro, assimétrico e traiçoeiro: o evento ao vivo
do chat era montado **uma vez, com o token de mídia de quem ENVIOU**, e mandado
igual pros dois. Quem recebia um áudio ficava com um endereço emprestado do
outro: tocava enquanto aquele token valia e parava depois — **enquanto pra quem
mandou continuava funcionando**. Recarregar a tela escondia, porque
`GET /api/chat` sempre montou o token certo.

Agora existe `Hub.send_to_all_per_user` / `publish_por_pessoa`, e o chat monta a
mensagem **para cada pessoa**. O smoke abre um socket como ela, manda um áudio
como ele e confere que o `sub` do token que chega é o **dela** — conferido
reintroduzindo o defeito de propósito, que deixa a verificação vermelha.

**Estado: 667 verificações, 0 falha.**

### 9.22 A câmera sumiu sozinha, e eu ramifiquei o texto num palpite (27/08/2026)

Relato do dono: a linha do diagnóstico veio
`NotAllowedError · permissão: denied · microfones: 1 · atalho`, e junto:
"essa instrução do Nosso app nem faz sentido, tô abrindo direto no navegador,
não está instalado". E mais: "a parte da câmera agora só aparece as fotos já
tiradas, antes aparecia a opção de abrir a câmera e tirar a foto na hora".

#### 1. A linha finalmente diz qual dos três andares é

`microfones: 1` derruba as duas hipóteses "de baixo": o sistema **está**
entregando microfone, então não é a chave geral do aparelho nem a permissão de
app do navegador. O que está negado é a permissão **do site**.

Só que o texto que apareceu abria com "Ajustes → Apps → **Nosso app** →
Permissões", porque eu **ramifiquei a instrução pelo `display-mode: standalone`**.
Duas coisas erradas nisso:

1. **A detecção erra.** Vários navegadores Android respondem `standalone` fora de
   um app instalado — e o dono estava numa aba normal. A linha dizia "atalho" e
   ele leu uma afirmação errada sobre o próprio aparelho.
2. **Mesmo acertando, aquela lista não tem Microfone.** Ele já tinha fotografado
   a tela: um WebAPK só lista o que declarou.

**Regra que fica:** escrever a instrução com o que foi **medido**, nunca com o
que foi **deduzido**. Existe microfone + este endereço negado = permissão de
site; isso vale em aba normal e em atalho, e o texto não precisa (nem deve)
afirmar em qual dos dois a pessoa está. O caminho é o do navegador, com o do
Samsung Internet escrito à parte (o cadeado dele não tem permissões), e o botão
"Abrir no Chrome" fica disponível de qualquer forma — se for atalho é o único
caminho até os ajustes, e se já for navegador não atrapalha.

A linha de resumo também passou a mostrar **navegador e modo**
(`Chrome`, `Chrome (modo app)`), em vez de um esconder o outro.

#### 2. A câmera: o Android trocou o seletor debaixo do app

Nada mudou no nosso código — mudou o Android. O `<input accept="image/*">`
sempre deixou o sistema escolher entre câmera e galeria, e a partir do Android 13
esse pedido passa a ser atendido pelo **seletor de fotos do sistema**, que mostra
as fotos já tiradas e **não tem botão de câmera**. A opção de fotografar na hora
sumiu sem ninguém encostar no app.

Quem devolve a câmera é o atributo `capture` — e ele é **exclusivo**: com
`capture` só dá pra fotografar, sem ele só dá pra escolher. Não existe um pedido
que ofereça os dois de novo.

Então agora são **duas entradas declaradas, uma por intenção**, em vez de um
pedido ambíguo que o sistema resolve como quiser: no chat o ícone da câmera abre
"Tirar foto agora" / "Escolher da galeria"; no mural são dois botões, "tirar
foto" e "galeria".

**Estado: 667 verificações, 0 falha.** Build Vite aprovada; menu conferido no
navegador (as duas entradas existem, uma com `capture="environment"` e outra
sem).

### 9.23 A CAUSA: o app proibia o próprio microfone (27/08/2026)

```
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Esse cabeçalho é do **nosso servidor** (`app/main.py`, middleware
`security_headers`). Uma lista vazia em Permissions-Policy **não** quer dizer
"sem restrição extra": quer dizer **nenhuma origem pode** — e a própria página
está incluída nisso.

Com ele, `getUserMedia` é recusado na hora, com `NotAllowedError`, **sem nunca
mostrar a pergunta**. E `navigator.permissions.query` responde `denied`.

#### Por que custou um dia inteiro

Porque **todo lugar onde se procura mostra "está liberado"**:

| Onde eu (e o dono) olhamos | O que dizia |
|---|---|
| Chrome → Configurações do site → Microfone | "Os sites podem pedir acesso" — e **nenhum site bloqueado na lista** |
| Ajustes → Apps → Chrome → Permissões | Microfone **concedido** |
| Chave geral do microfone do Android | ligada |
| `enumerateDevices()` | devolve **1** microfone |

Nada disso é o dono da decisão. Quem nega é a **política que a própria página
declara**, e ela não aparece em ajuste nenhum — o dono chegou a fotografar a
tela do Chrome pra provar que não havia bloqueio. E não havia mesmo.

**E explica a assimetria que parecia impossível:** no iPhone dela gravava, no
Android dele não. O Safari **não aplica** Permissions-Policy a `getUserMedia` em
documento de topo; o Chrome aplica. Mesmo site, mesma conta, resultados opostos
só por causa do navegador. Eu passei rodadas procurando diferença de formato e de
permissão por causa disso.

**E a câmera também era isto.** `camera=()` bloqueia o caminho de tirar foto na
hora — por isso "abre só a galeria". Eu tinha atribuído à mudança do seletor de
fotos do Android 13, que é real, mas não era a causa aqui. As duas entradas
separadas (câmera / galeria) continuam certas e ficam; o que destrava é o
cabeçalho.

#### O conserto

```python
response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self), camera=(self)"
```

`self` é o valor certo: a **página** pode pedir — e o navegador ainda pergunta ao
dono do aparelho, que é a trava que importa — e **ninguém mais**: nenhum iframe
de terceiro herda nada. Geolocalização continua fechada, porque o app não usa.

> **Medido, antes e depois.** Na produção, com o cabeçalho velho:
> `document.featurePolicy.allowsFeature('microphone')` → **false**, e `camera`
> → **false**. Local, com o novo: **true**.

**Travado no smoke:** o cabeçalho tem que trazer `microphone=(self)` e
`camera=(self)`, e não pode virar `*`.

> **A lição, e ela é cara:** um cabeçalho de segurança copiado sem ler o que a
> lista vazia significa desligou uma função inteira do produto, e o rastro
> apontava pra todo lado menos pra ele. Quando o navegador nega **sem
> perguntar** e todos os ajustes dizem "liberado", suspeite do que a **página**
> declara — `Permissions-Policy`, `Content-Security-Policy`, atributo `allow` de
> iframe — antes de suspeitar do aparelho de quem está usando.

**Estado: 670 verificações, 0 falha.**

### 9.24 A casa em 64px, os móveis um a um, e o miado gravado (27/08/2026)

Pedido do dono: "a casa, os móveis, tá cheio de objeto bugado quando gira, além
de tá com poucos pixels — aumenta ao máximo e melhora todos os bugados, verifica
um por um. Além disso o miado do gato tá péssimo".

#### 1. O tile foi de 48 pra 64 — e ficou mais barato

`TW/TH/TZ` passaram de 48/24/24 para **64/32/32** (a proporção 2:1 é
obrigatória; o número dentro dela é escolha). Cada face ganhou ~78% de área: uma
prateleira de 0,06 de célula tinha 3 px e agora tem 4 — abaixo disso nenhum
detalhe sobrevive, e era essa a razão de tanta peça virar um risco.

Isso só foi possível porque **o fundo parou de ser redesenhado**. Piso e paredes
são a maior parte dos pixels e não mudam nunca, mas eram repintados a cada
quadro — com reticulado, pixel a pixel — enquanto o bichinho anda pelo cômodo.
Agora `fundoDoComodo` (em `room.js`) pinta uma vez num canvas de rascunho,
guarda por (tamanho, piso, parede) e cola. É a precaução que a seção 8.1 já
pedia, e ela paga o aumento com sobra: **o que ficou mais caro é justamente o
que parou de ser refeito**.

> Medido: o canvas do cômodo foi de 434x290 para **578x386**.
> **Não medi quadros por segundo** — a janela do navegador estava oculta na
> bancada e o `requestAnimationFrame` não roda sem compor. Fica como conferência
> pendente no aparelho.

#### 2. Os móveis, um a um

Olhados na bancada `/lab` nas quatro rotações, ampliados. O que estava errado:

| Peça | O que havia | O que era |
|---|---|---|
| **TV** | ao girar, um bloco escuro solto no chão ao lado | o pé estava no meio da célula (`k.D/2`) e o corpo na beirada (`k.D-0.36`); girado, a projeção separa os dois |
| **geladeira** | um risco cinza atravessado, sem forma de porta | as portas eram lâminas de 0,06 de célula = 3 px |
| **quadro** e **quadro do casal** | pendurados no ar, no meio da sala | estavam na beirada da FRENTE (`k.D-0.22`); a parede é o fundo (`ly = 0`) |
| **planta** | vaso de um lado, folhas do outro | a folha saía 0,34 do centro e o vaso tem 0,32 de raio: nascia fora dele |
| **rede** | um pontilhado entre dois postes | o pano eram 25 retângulos em coordenada de TELA, que não giram |
| **arranhador** | as voltas da corda não giravam com o móvel | mesma causa: `p.rect` em tela |
| **casinha do bicho** | a porta ficava na parede errada ao girar | mesma causa |
| **fogão, churrasqueira, caminha, comedouro, velas, caixa de som, console** | blocos sem leitura | escritos em uma linha, com detalhes de 1 a 3 px |

Todos foram refeitos com **relevo de verdade** (faces afundadas, que é o que faz
a linha de sombra aparecer sozinha) e com os detalhes em BLOCO, nunca em pixel
de tela — porque bloco gira junto com o móvel e pixel de tela não. É essa a
regra por trás de quase toda a lista acima.

**Quadro só gira entre paredes que existem.** O cômodo mostra duas paredes (fundo
e esquerda); as outras duas rotações penduravam o quadro no ar. Em vez de
inventar arte para parede que não existe, `NA_PAREDE` faz o editor alternar só
entre as duas direções com parede.

> **O smoke pegou um erro meu no meio disso:** ao reescrever o bloco vizinho eu
> apaguei a `pethouse` inteira, e a verificação "todo móvel vendido tem desenho"
> ficou vermelha na hora. Sem ela, a casinha sumiria calada da loja de quem
> comprou.

#### 3. O miado: gravação de verdade, síntese como reserva

A voz é sintetizada e foi ajustada duas vezes; passou nas medições da bancada e
o dono continuou dizendo que está péssimo. As duas coisas são verdade: a bancada
mede volume, agudez, movimento e corpo — e um miado real e um sintético podem
empatar em tudo isso e ainda assim um soar como gato e o outro como brinquedo.

E aqui o limite é meu: **eu não escuto**. Ajustar timbre no escuro já falhou
duas vezes; a terceira seria chute. Uma gravação tira a decisão do meu ouvido.

- `petAudio.js`: carrega, decodifica e toca a gravação da espécie. O humor mexe
  em **duas** coisas só — altura e velocidade juntas (`playbackRate`), que é como
  fita mais lenta fica mais grave; mexer em mais começa a soar processado.
- **A síntese continua inteira e continua sendo o padrão de todo mundo.** Se o
  arquivo não existir, não baixar ou não decodificar, o bicho fala como sempre.
  Nenhum bicho fica mudo por causa de um arquivo.
- O primeiro toque destrava o áudio e já busca as gravações, então nem o primeiro
  carinho sai sintetizado.

> **Licença, e ela é real:** o miado é de Dan Crosby, **CC BY-SA 3.0**, do
> Wikimedia Commons. O crédito está em `public/sons/CREDITOS.md` — em arquivo, e
> não num comentário que some. CC BY-SA pede crédito e manter o SOM sob a mesma
> licença ao repassar; vale sobre o som, não sobre o app, e este app é privado e
> não distribuído. Se um dia virar produto, o caminho limpo é trocar por CC0.

Conferido: o arquivo chega (200, `audio/ogg`), decodifica em **0,79 s, 48 kHz,
mono**, e toca pelo caminho real do app (`casalSound('pet','gato:feliz')`) sem
erro no console.

**Estado: 670 verificações, 0 falha.** Build Vite aprovada.

#### Adendo à 9.24: o tipo do arquivo servido

O `.ogg` do miado subiu e o servidor entregou como **`text/plain`**, enquanto na
bancada saía `audio/ogg`. A tabela de tipos do sistema muda de máquina — e é
exatamente a forma de defeito que custou o dia de hoje: **funciona aqui, quebra
no ar, e o rastro não explica**.

Como o app busca o arquivo e decodifica na mão, ele tocaria assim mesmo; mas um
`<audio src>` não tocaria, e a próxima pessoa perderia horas. Agora o tipo do
que **nós** publicamos é declarado em `TIPOS` (`app/main.py`), e o palpite do
sistema fica só pro resto. Travado no smoke.

### 9.25 O navio saía da casa, e o tabuleiro não era quadrado (28/08/2026)

Pedido do dono, com dois prints: "no iphone tá completamente bugado a batalha
naval". Nos prints, os navios saem **gigantes** — atravessam o tabuleiro, passam
por cima dos botões, um deles cruza a barra de navegação e some pra fora da tela.

**A arte estava certa, e é por isso que ninguém tinha pegado.** A aba Naval da
bancada media a proporção de cada navio (os seis batiam), a emenda do mar (2,4
com limite 18) e o desenho vazio. Tudo verde. O defeito nunca esteve no desenho:
estava em **onde** o desenho era colocado — e isso a bancada não olhava.

Reproduzi no Chrome a 375 de largura, na primeira tentativa. São **duas** causas,
e as duas são a mesma frase que este projeto já escreveu quatro vezes: **dois
donos para o mesmo fato.**

#### 1. Duas grades para o mesmo tabuleiro

Os navios eram desenhados numa **segunda grade sobreposta** (`.naval-frota`),
com as medidas do tabuleiro repetidas — a 9.14 até já tinha corrigido um desvio
de 1 a 2 px ali, trocando os números na mão por `padding: inherit` e
`gap: inherit`. O conserto foi no lugar errado: o problema não era o número
copiado, era **haver uma segunda grade**.

E ela discordava da primeira por uma razão que nenhum ajuste de `inherit`
alcança: o navio era um `<img>`. Uma imagem é um **elemento substituído** — tem
tamanho próprio, e esse tamanho entra na conta do tamanho da trilha da grade.
Medido no navegador, com o código antigo, numa grade de 8:

```
linhas:  37,875  37,875  37,875  37,875  37,875  40  40,75  37,875
colunas: 38,5    38,5    38,5    38,5    38,5    38,5  38,5  38,5
```

As linhas estavam infladas **pelos próprios navios que deveriam apenas ocupá-las**.
Zerando o mínimo automático (`min-height: 0`) as oito voltavam a 38,5 na hora — é
essa a prova de que a causa era o tamanho intrínseco da imagem, e não outra coisa.

No Chrome isso custava 1 a 3 px. O Safari resolve o mesmo cálculo de outro jeito,
e lá custava a tela inteira.

#### 2. Em tela cheia o tabuleiro não era quadrado

A regra era `height: 100%` com `width: auto`: a altura virava a sobra do casco, a
largura saía dela pela proporção — e aí `max-width: 100%` cortava a largura **sem
recalcular a altura**. Medido num aparelho de 375:

| | antes | depois |
|---|---|---|
| tabuleiro | 355 × **511** | 355 × **355** |
| linha | **59,5 px** | 40 px |
| casa | **40 px** | 40 px |

Oito linhas dividindo 511 enquanto oito colunas dividiam 355. A casa tinha
proporção **própria** (`aspect-ratio: 1`) e ficava com 40 px dentro de uma linha
de 59,5 — mais dois donos, e o navio ocupa a **linha**. Saía uma vez e meia mais
alto que a casa que ele marca.

#### O conserto: uma grade só

Casas e navios agora são **irmãos na mesma grade**, colocados nas mesmas trilhas
por `grid-column` / `grid-row`. Não há mais o que discordar. Três detalhes que
essa escolha obriga:

- **o navio é um `<span>` com o desenho de fundo**, nunca um `<img>`. Um `<span>`
  não tem tamanho próprio pra oferecer: ele só pode ocupar a área que a grade
  der, e `background-size: 100% 100%` se ajusta ao que sobrar;
- **as casas ganharam posição explícita**, senão um navio de posição explícita no
  meio empurraria o preenchimento automático das casas seguintes;
- **a casa perdeu a proporção própria.** Quem diz o tamanho dela é a trilha — a
  mesma trilha do navio.

E o tabuleiro passou a sair quadrado **pelo lado que faltar**. Nenhuma das duas
formas ingênuas faz isso: `height: 100%` + `width: auto` é certo deitado e
errado em pé; `width: 100%` + `height: auto` é o espelho (medido: 720 × 123 numa
tela baixa). Quem sabe o menor dos dois lados é o próprio espaço disponível, e a
forma de perguntar isso é a **unidade de container** — `min(100cqw, 100cqh)`, com
`width: 100%` ficando como degrau pra quem não entende a unidade. O container é
uma caixa nova, `.naval-campo`, e não `.naval-mar` inteiro: `.naval-mar` inclui a
linha do título, e com o título na conta o tabuleiro saía 147,5 × 123,5.

> **Duas armadilhas medidas no caminho, e as duas do mesmo tipo:** um container
> de tamanho **não pode medir o próprio conteúdo**. Centralizado por
> `align-items: center`, ele saiu com 0 de largura e levou o tabuleiro junto
> (14 × 14); com `flex-basis: auto`, a mesma coisa. `align-self: stretch` e
> `flex: 1 1 0` resolvem as duas.

#### A bancada passou a medir o encaixe, e não só o desenho

A aba Naval do `/lab` agora monta o **`Tabuleiro` de verdade**, com o CSS de
verdade, e faz uma pergunta só: *a caixa de cada navio bate com a união das casas
que ele ocupa?* É a lição da 9.10 ("a bancada conferia a arte que o app não
usa"), aplicada ao layout.

Conferido reintroduzindo o defeito de propósito: a aba fica vermelha e diz
`navio fora da casa por 14,63px, tabuleiro 343×460 (não é quadrado)`. E ela roda
em qualquer navegador que abrir o `/lab` — **inclusive no iPhone**, que é onde o
defeito aparecia e onde eu não tenho como medir daqui.

**Medido nos três tamanhos, com a partida de verdade rodando:**

| tela | tabuleiro | casa | desvio navio/casa |
|---|---|---|---|
| 375 × 812, normal | 343 × 343 | 38,5 | **0 px** |
| 390 × 844, tela cheia | 370 × 370 | 41,88 | **0 px** |
| 740 × 380 (deitado) | 123,5 × 123,5 | 11,06 | **0 px** |
| minimapa (vão e margem menores) | 92 × 92 | 9,63 | **0 px** |

O toque continua sendo do `<button>` (conferido: no centro de uma casa com navio,
quem responde é `naval-casa navio`), e o tabuleiro do adversário continua com
**zero** navios desenhados — a posição dele não chega neste app.

**Travado no smoke:** o navio não pode voltar a ser imagem, a segunda grade não
pode voltar, as casas têm que ter posição explícita, a grade tem que declarar as
linhas, a casa não pode ter proporção própria e a receita de tela cheia não pode
voltar. As três reintroduções foram testadas de propósito e as três ficaram
vermelhas.

**Estado: 679 verificações, 0 falha.** Build Vite aprovada. Publicado em produção
— e o volume de mídia foi conferido antes (`/data/casal-media → /app/media`),
como manda a regra da 9.21.

**Próximo passo:** continua sendo a seção 8.1 — mapa navegável do bairro.

### 9.25 A bancada estava medindo errado, e o sofá se atravessava (27/08/2026)

Pedido do dono: "o áudio ficou bom, mas os objetos ainda estão bugados com
partes se sobrepondo, e ainda tem poucos pixels — o sofá mesmo nem parece um
sofá. Talvez já existam modelos prontos na internet, em 3D; veja essa opção."

#### 1. A bancada girava o móvel sem girar a pegada

Este é o achado da rodada, e é constrangedor: **a `/lab` estava mentindo**.

Na casa, girar um móvel troca `w` por `d` — um sofá 2x1 vira 1x2
(`rotateSelected`, em `House.jsx`). A bancada girava só o `dir` e deixava a
pegada como estava. Com isso `tools` calculava `W` e `D` ao contrário, e a peça
se desenhava com as proporções trocadas.

Ou seja: a bancada **mostrava "bugado ao girar" em móveis que na casa estavam
certos, e escondia os que estavam errados de verdade**. Eu persegui defeitos que
só existiam ali. É o mesmo princípio que a rota de teste do áudio já respeita —
**bancada que valida diferente do que roda é pior do que não ter bancada**,
porque manda procurar no lugar errado.

#### 2. O sofá: três peças se atravessando

Com a bancada dizendo a verdade, o sofá continuou errado — e a conta explicou:

- o encosto ia até 0,65 de profundidade e o assento começava em **0,62**: o
  assento entrava dentro do encosto;
- os braços iam de 0,60 a 0,90 e também pegavam o encosto;
- as duas almofadas iam de 0,60 a 1,10 e de 0,90 a 1,40 — **uma dentro da
  outra**, por 0,20;
- e as duas passavam de 0,85, onde a base termina: **sobravam pra fora**,
  boiando na frente do sofá.

Refeito com as faixas calculadas, cada peça começando onde a anterior termina, e
o número de almofadas saindo da largura (sofá maior ganha almofada, não almofada
esticada). As medidas viraram variáveis porque com número solto mexer numa
quebra a vizinha em silêncio — que foi exatamente o que aconteceu.

#### 3. O caça-sobreposição: 30 móveis conferidos por conta, não por olho

Olhar 30 móveis em 4 rotações é 120 telas, e invasão de 3 centésimos de célula
não aparece em miniatura. Então `furnitureAudit.js` lê a descrição das peças
(cada `k.box` é uma caixa) e acha as que se cruzam nos três eixos.

A primeira rodada acusou 16 móveis — e ensinou a distinção que importa:

> **Afundar é a técnica, não o defeito.** Almofada meio enterrada no assento é o
> que dá volume; cone afundado na caixa é o que faz o cone. O defeito é a peça
> **inteiramente dentro** de outra: ela não some (o desenho é por cima), mas as
> duas faces caem no MESMO plano — e duas faces coplanares com contorno viram um
> **risco atravessado** em vez de um relevo. Era isso na porta da geladeira.

Daí saiu a regra que vale pra todo móvel novo: **todo detalhe tem que SAIR da
face do pai**, nem que seja por 0,04 de célula — aí ele ganha sombra própria e o
contorno tem onde encostar.

Corrigidos por essa regra: guarda-roupa, geladeira, mesa, fogão, comedouro,
caixa de som, velas, churrasqueira (a cuba era funda e a grelha morava DENTRO
dela, invisível), quadro e quadro do casal (viraram **aro** em vez de bloco
cheio — no do casal eram quinze peças enterradas, o pior da lista).

**Agora a bancada diz: "Nenhuma peça enterrada dentro de outra."**

#### 4. Mais pixel, segunda subida: 64 → 96

A área por face dobrou de novo. Uma prateleira de 0,06 de célula tinha 3 px no
começo, 4 com 64 e agora tem **6** — e é a partir de 5 ou 6 que um detalhe deixa
de ser um risco e vira peça com sombra. Vários itens "sem leitura" só passaram a
existir de verdade aqui.

O custo por quadro não dobrou junto porque o fundo saiu da conta na 9.24 (piso e
paredes viraram desenho colado). O cômodo foi de 578x386 para **866x578** e rola
pro lado — escolha, não efeito colateral: é o que jogo de decoração faz, e
encolher a arte pra caber desfaria o ganho.

#### 5. A opção dos modelos prontos

Existe e é boa: o **Furniture Kit do Kenney** tem 120 objetos, **CC0** (sem
obrigação nenhuma), com render isométrico em **4 ângulos** já prontos. Não é
conversa fiada — resolveria rotação e acabamento de uma vez.

O que ele custaria, e por isso não foi feito sem perguntar:

| | hoje (desenhado por código) | com o kit pronto |
|---|---|---|
| Estilo | pixel art, igual ao bichinho, ao avatar, às figurinhas e à naval | render 3D liso — **destoa de tudo o mais na tela** |
| Cor por item | a loja vende o mesmo móvel em cores; a cor é um parâmetro | fixa no PNG; acabaria a variação |
| Móvel novo | uma função | achar/renderizar 4 ângulos |
| Peso | zero arquivo | ~480 PNGs |
| O bichinho | é desenhado no MESMO plano de pixel do móvel | ficaria pixelado ao lado de um sofá liso |

O nó é o quinto: o bichinho e o avatar são pixel art e vivem dentro do cômodo.
Trocar só os móveis quebra a unidade; trocar tudo é refazer o app inteiro.

**Estado: 679 verificações, 0 falha.** Build Vite aprovada; auditoria limpa;
sofá conferido nas rotações com a bancada já corrigida.

### 9.26 A tela rosa era um bundle velho, e o detector chegava tarde (28/08/2026)

O app e a API estavam saudáveis. Nos logs do aparelho apareceu a sequência que
explica a tela inteira rosa: ele abriu um HTML antigo e pediu
`/assets/index-CbUqF9D2.js`, já removido da publicação, recebendo **404**. O CSS
antigo ainda pintava o fundo, mas sem JavaScript o React nunca montava nada.

Já existia uma recuperação automática, porém ela morava no fim do `<body>`.
Durante o build, o Vite põe o módulo principal no `<head>`; um 404 rápido podia
acontecer antes de o detector ser instalado. A correção ficou em três camadas:

- o detector agora nasce no `<head>`, antes do módulo, e captura erro de asset;
- após o carregamento, ele também detecta `#root` ainda vazio, apaga caches e
  service workers e recarrega uma única vez (trava em `sessionStorage` impede
  ciclo infinito);
- o cache do worker subiu de `casal-v5` para `casal-v6`, e o registro usa
  `updateViaCache: 'none'`, para a correção não depender do cache HTTP antigo.

O Furniture Kit 2.0 enviado pelo dono também entrou. Foram escolhidos os 18
modelos que têm equivalência real no catálogo (sofá, cama, mesa, cadeira,
estantes, puff, espelho, plantas, tapete, luminária, TV, caixa de som,
geladeira, fogão, caminha e banco), cada um nas quatro vistas isométricas. Os
PNG ficam em `web/public/kenney-furniture/`, junto da licença **CC0**. O motor
tenta o Kenney primeiro; enquanto a imagem carrega, se faltar ou se falhar, a
função desenhada por código continua inteira em `furniture.js` como backup.
Objetos próprios do app sem equivalente honesto no kit — por exemplo quadro do
casal, comedouro, arranhador, rede e churrasqueira — continuam com nossa arte.

A bancada foi conferida em 0° e 90°, e a casa real em viewport de telefone
375×812. Smoke: **687 verificações, 0 falha**; build Vite aprovada. Publicado
no commit `3f4aa01`; produção `running:healthy`, bundle novo e PNG Kenney em
200, e o volume `/data/casal-media → /app/media` foi reconferido antes e depois.
