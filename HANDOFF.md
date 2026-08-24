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
| Minigames | Pega a bolinha pronto; demais adiados |
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
cd "D:/beckup/arquivo env" && TOKEN=$(grep "^COOLIFY_TOKEN=" env-coolify.txt | sed 's/^COOLIFY_TOKEN= *//' | tr -d '') && curl -s -X POST -H "Authorization: Bearer $TOKEN" "https://painel.barbeariabazot.com/api/v1/deploy?uuid=q13k8ab4ps5elmhoio0mov3t&force=true"
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
│           └── couple.py         ← toques, datas, mural
│
└── web/
    ├── public/                   ← manifest, service worker, ícones, fontes locais
    └── src/
        ├── api.js                ← toda chamada HTTP passa aqui
        ├── store.js              ← sessão + WebSocket + presença (Zustand)
        ├── push.js               ← ligar notificação + diagnóstico do aparelho
        ├── lib/dates.js          ← irmão do clock.py, do lado do app
        ├── render/               ← motor de pixel art (nada é arquivo de imagem)
        │   ├── pixel.js          ← rasterização própria (borda dura, sem suavizar)
        │   ├── iso.js            ← projeção 2:1, bloco isométrico, ordem de desenho
        │   ├── furniture.js      ← 30 móveis: cada um compõe blocos
        │   ├── room.js           ← parede, piso e ordem de desenho do cômodo
        │   ├── RoomCanvas.jsx    ← o cômodo na tela (escala inteira, toque → célula)
        │   ├── avatar.js         ← o boneco: 8 camadas, 48 peças
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
