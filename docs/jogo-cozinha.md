# Cozinha do Amor — o 5º jogo

Documento de projeto. Escrito **antes** do código, porque a decisão difícil aqui
não é desenhar: é como dois celulares jogam a mesma partida em tempo real sem o
jogo ficar mole.

Pedido do dono (30/08/2026): *"pesquise e projete um jogo de cozinhar tipo
Overcooked... quero algo bom e completo, com animações funcionais, com mecânicas
bem feitas e pensadas. Use o que achar na internet pra te ajudar a decidir qual
caminho tomar. Será o 5º jogo, e quero que ele seja pra jogar de dois ou
sozinho."*

---

## 1. O que a pesquisa disse, e o que eu tirei dela

Fontes: o *Deep Dive* dos próprios criadores no Game Developer, a análise da
SUPERJUMP e a decomposição de mecânicas do Mechanics of Magic (links no fim).

Cinco decisões deles que este jogo copia, porque são elas que fazem o jogo
funcionar — e não a temática:

| O que eles fizeram | Por quê | Como entra aqui |
|---|---|---|
| **A bancada compartilhada é o ponto central.** Deixar o ingrediente no balcão pra o outro pegar foi, nas palavras deles, a ideia número um do jogo. | É o que obriga a conversar. Sem ela, dois jogadores viram dois jogos solitários lado a lado. | Existe uma **bancada** que é só um lugar de largar coisa. Nada obriga a usá-la, e é exatamente por isso que usá-la é decisão de vocês. |
| **Sempre mais tarefa do que mão.** | Impede que alguém se acomode numa função só. | Os pedidos chegam mais rápido do que um cozinheiro sozinho dá conta, e o ritmo aperta com o tempo. |
| **Limite de TEMPO, não de vidas.** Errar um pedido tira ponto, não encerra. | Eles trocaram vidas por tempo de propósito: perder por engano frustra e faz jogar defensivo. | Rodada de 3 minutos. Pedido perdido custa pontos. Nunca "game over". |
| **Interface por ícone, sem palavra.** | Dá pra entender o pedido do outro lado da sala, mas ainda obriga a combinar quem faz o quê. | Pedido é desenho de prato. Nenhum texto no meio do jogo. |
| **No modo sozinho você controla DOIS cozinheiros.** | Foi a solução deles pra não perder a mecânica central sem o segundo jogador. | Igual: sozinho, os dois cozinheiros são seus, e o jogo continua sendo sobre dividir tarefa — só que consigo mesmo. |

**A que eu descartei:** eles usam obstáculos móveis (terremoto, ratos, bancada
que anda) pra forçar reavaliação. Fica de fora da primeira versão — é conteúdo de
nível, e conteúdo de nível sem o jogo base pronto é enfeite.

---

## 2. A decisão técnica difícil: como dois celulares jogam junto

Esta é a decisão que define se o jogo fica bom ou fica mal feito, e ela foi
tomada olhando o que este projeto **já** tem de pé.

### O caminho que NÃO foi tomado: posição contínua em tempo real

O jeito "óbvio" é o servidor rodar um laço a 20 quadros por segundo, mandar a
posição de cada cozinheiro e o app interpolar. É como jogo de ação se faz.

Ele foi descartado por três motivos, e nenhum é preguiça:

1. **É outra arquitetura.** Tudo neste app é pedido/resposta com um evento
   dizendo "mexeu, vem buscar". Um laço assíncrono permanente no servidor seria a
   primeira coisa do tipo — num container com limite de memória fixo, que existe
   pra proteger os outros projetos da VPS.
2. **Na rede de celular ele fica ruim, não fica difícil.** 100 a 200 ms de atraso
   num jogo de precisão espacial vira cozinheiro que não obedece. O pedido foi
   "não quero algo mal feito"; entregar movimento contínuo travado seria isso.
3. **Não dá pra testar.** A bateria deste projeto é a rede de segurança de tudo,
   e ela é síncrona. Um laço de tempo real não caberia nela.

### O caminho escolhido: ação discreta + relógio de parede

O cozinheiro não é dirigido com direcional: **você toca numa estação e ele vai
até lá e age**. Isso torna cada mudança de estado um **evento discreto com hora
marcada**, e é essa propriedade que resolve tudo o resto.

O estado da partida guarda, pra cada coisa que está acontecendo, **quando ela
termina**:

```
cozinheiro p1:  saiu de (2,3) às 10:00:01.200, chega em (4,1) às 10:00:02.000
tábua 1:        picando, termina às 10:00:03.400
panela 2:       cozido desde 10:00:05.000, QUEIMA às 10:00:11.000
pedido #7:      vence às 10:00:47.000
```

Disso saem três consequências, e as três importam:

**a) O app não precisa saber nenhuma regra.** Ele não decide que a panela
queimou: ele desenha uma barra que anda de `início` até `fim`, e um cozinheiro
que caminha entre dois pontos. Isso é **interpolação, não simulação** — é
desenhar um número que já veio pronto. Quem aplica a transição é só o servidor.

> Isso é deliberado e é a lição mais cara deste projeto: **dois donos pro mesmo
> fato**. O prompt com dois donos, o chão do bichinho com dois números, a segunda
> grade da batalha naval. Se o app também soubesse a regra de queimar, ele e o
> servidor discordariam em algum momento — e a versão do app é a que a pessoa vê.

**b) O app sabe o FUTURO, então não precisa ficar perguntando.** Como todo prazo
está no estado, o app agenda uma busca pro instante do próximo prazo. Entre um
prazo e outro não há o que perguntar: nada muda sozinho. Sem varredura de 1 em 1
segundo, sem gastar bateria à toa.

**c) A simulação é PREGUIÇOSA, e isso já é o jeito da casa.** O servidor não roda
nada em segundo plano: qualquer leitura chama `avancar(estado, agora)`, que
aplica de uma vez tudo o que venceu desde a última vez. Pedido expira, panela
queima e a rodada acaba mesmo que ninguém toque em nada — porque a conta é feita
na hora de olhar.
>
> Esse é exatamente o mecanismo do bichinho, que decai por tempo decorrido e não
> por relógio rodando (`app/pet.py`). Nada novo pra manter.

### E ainda é um jogo de espaço?

É, e é aqui que a escolha se paga em vez de custar. **Andar leva tempo de
verdade**, proporcional à distância. A alface está longe da tábua; a panela está
do outro lado da pia. Escolher a ordem das tarefas e quem faz cada uma continua
sendo o jogo — só que a habilidade cobrada é planejar, não apertar rápido.

Isso também é mais justo num celular: dedo em tela pequena erra alvo, e um jogo
de reflexo por toque castigaria quem tem a tela menor.

---

## 3. As mecânicas

### O cozinheiro
- Carrega **uma coisa por vez**. É esta regra que faz a bancada existir; sem ela,
  ninguém precisaria do outro.
- Um toque só resolve tudo (como no original): o que acontece depende do que ele
  tem na mão e do que tem na estação. Pegar, largar, picar, cozinhar, montar,
  entregar e lavar são o mesmo gesto.

### As estações
| Estação | O que faz |
|---|---|
| **Despensa** | fonte infinita de um ingrediente cru |
| **Tábua** | pica: cru → picado (leva tempo, e ocupa o cozinheiro) |
| **Panela** | cozinha: picado → cozido → **queimado** se ficar esquecido |
| **Bancada** | não faz nada. Só guarda. É o coração do jogo a dois. |
| **Pratos** | pega prato limpo |
| **Entrega** | manda o prato montado |
| **Pia** | lava prato sujo |
| **Lixo** | joga fora o que queimou |

### O ciclo do prato
Prato limpo → montar ingredientes → entregar → **volta sujo pra pia** depois de
um tempo. Os pratos são poucos. Quando acabam, alguém **tem** que largar a comida
e ir lavar — é a segunda fonte de "mais tarefa do que mão", e vem do original.

### Os pedidos
Chegam sozinhos, cada um com sua contagem. Entregou certo: pontos, e vale mais
quanto mais sobrou de tempo. Entregou errado: o prato suja e perde ponto.
Deixou vencer: perde ponto. **Nunca encerra a rodada** — só o relógio encerra.

### Receitas
| Prato | Precisa de |
|---|---|
| Salada | alface picada + tomate picado |
| Macarrão | massa cozida + tomate cozido |
| Hambúrguer | pão + carne cozida + alface picada |
| Prato do casal | massa cozida + carne cozida + tomate picado |

O caminho de cada ingrediente é curto de propósito: `cru → picado → cozido`. A
dificuldade vem de **quantos caminhos correm ao mesmo tempo**, não de decorar
combinação.

---

## 4. Sozinho e a dois

**Sozinho:** os dois cozinheiros são seus. Tocar numa estação manda o cozinheiro
**livre mais perto**; tocar num cozinheiro antes disso escolhe ele na mão. É a
mesma solução do original, e é o que mantém o jogo sendo sobre dividir tarefa.

**A dois:** cada um manda no seu, cada um no seu celular, ao mesmo tempo. O
servidor é o dono da verdade e o evento de tempo real avisa "mexeu" — o mesmo
encanamento da batalha naval, que já está de pé.

---

## 5. Arte

Isométrico, reaproveitando `web/src/render/iso.js` — o mesmo motor da casa e do
bichinho. Isso não é economia: é a **decisão travada** de direção de arte
(pixel art isométrico 2.5D), e uma cozinha vista de cima destoaria de todo o
resto do app.

O que já existe e serve sem mudança: `project` / `unproject` (dedo → célula),
`isoBox` (todo móvel é composto de blocos), `depthSort` (ordem de desenho),
`groundShadow`, e o `Painter` de varredura, que é o que dá a borda dura.

**Cuidado que o HANDOFF já avisa (seção 8.1):** a cena inteira redesenhada a cada
quadro esquenta o celular. O fundo (piso, paredes, estações paradas) é desenhado
**uma vez** num canvas separado e colado; por cima, só o que se move — os dois
cozinheiros, o que eles carregam e as barras de progresso.

---

## 6. O que fica de fora desta versão

Escrito pra não parecer esquecimento:

- obstáculo móvel e mudança de regra no meio do nível (terremoto, ratos);
- mais de dois cozinheiros;
- vários níveis com plantas diferentes — a planta é dado, então acrescentar é
  barato depois;
- ranking histórico. O placar do dia basta, como na memória.

---

## Fontes

- [Game Design Deep Dive: Building truly cooperative play in Overcooked](https://www.gamedeveloper.com/design/game-design-deep-dive-building-truly-cooperative-play-in-i-overcooked-i-) — Game Developer
- [Overcooked: How Design Creates Teamwork](https://www.superjumpmagazine.com/overcooked-how-design-creates-teamwork/) — SUPERJUMP
- [Mechanics of Overcooked](https://mechanicsofmagic.com/2021/04/08/mechanics-of-overcooked/) — The Mechanics of Magic
