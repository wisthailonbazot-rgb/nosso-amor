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

**Duas pegadinhas que já custaram tempo aqui:**

1. O `dev_server.py` **não recarrega sozinho**. Depois de mexer no backend é preciso
   parar e subir de novo — senão a rota nova simplesmente não existe, e o app quebra
   com um erro que não explica nada. (Foi o que aconteceu, e por isso rota de API
   desconhecida agora responde 404 em vez de devolver a página.)
2. `rm -rf backend/app/static/assets` antes de copiar: sem isso os arquivos antigos
   ficam lá, e o navegador pode servir uma mistura das duas versões.

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
- Bancada `/lab` confere sozinha se toda peça de arte desenha algo (30 móveis,
  48 peças de avatar, 13 itens) — rota escondida, sem link em menu nenhum.
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
- Nada no ar ainda: roda só localmente.

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

**Deploy móvel bloqueado:** `credenciais.md` está desatualizado para os três caminhos
de acesso: o token da API Coolify responde 401, o login/senha do painel retorna para
`/login` e a chave local `id_ed25519` apontada no documento não existe. Não houve
alteração na VPS. Renovar um token Coolify com acesso às aplicações (preferível) ou
restaurar a chave SSH; só então publicar em HTTPS/WSS e recompilar o APK. Não entregar
outro APK com IP local.

### 9.1 Pacote móvel local (23/08/2026)

O frontend agora tem Capacitor 8 e o projeto Android nativo em `web/android`, com o
identificador `com.nossoapp.casal`, Android mínimo 7.0 (API 24) e alvo API 36. O APK
de depuração foi compilado com o JDK 21 e SDK Android portáteis guardados somente em
`.tools/`, sem instalar nem alterar ferramentas dos outros projetos. O pacote passou
no `apksigner` (assinatura v2), no `aapt` e no Gradle. Uma cópia de entrega fica em
`releases/NossoApp-casal-android-debug.apk`.

Esta primeira cópia usa `http://192.168.1.250:8020` e, portanto, é somente para teste
no mesmo Wi-Fi, com este computador e o backend ligados. `dev_server.py` escuta em
`0.0.0.0` e aceita as origens nativas do Capacitor. O login e todos os dados continuam
no mesmo FastAPI; não há uma base separada dentro do APK.

A build web normal foi copiada para `backend/app/static`; manifesto, service worker
e tags Apple já permitem testar no Safari pelo endereço local. A versão definitiva
para iPhone exige publicar a aplicação em HTTPS/WSS na VPS, pois instalação PWA,
service worker e Web Push não devem depender de HTTP ou do IP doméstico. Ao receber
a URL pública, recompilar o APK com `VITE_API_URL=https://...`, sincronizar o
Capacitor e gerar uma assinatura de release; a chave de debug atual não é publicação.

Validação desta etapa: **488 verificações, 0 falha**, `npm run build` aprovado,
Gradle aprovado, APK inspecionado e rota de saúde acessível pelo IP da rede local.

**Próximo passo:** seção 8.1 — mapa navegável do bairro: avatar andando na rua,
fachadas e mercado como lugar. Os outros minigames continuam depois desse passo.
