# Sons deste app

Os sons daqui são GRAVAÇÕES DE VERDADE, e não síntese. Cada arquivo tem dono, e
o crédito vive aqui — não some num commit.

## Por que gravado, e não sintetizado

A síntese continua existindo e continua sendo a **reserva** de tudo o que está
aqui: se um arquivo não existir, não baixar, ou o navegador não souber tocar, o
app emite o som sintetizado no lugar e ninguém fica mudo esperando rede.

O motivo de ter arquivo é o mesmo escrito em `src/petAudio.js`: **quem escreve
este app não escuta.** Explosão, água e afundamento são timbre puro, e não existe
número que diga se um ruído soa como onda ou como chiado. Ajustar timbre no
escuro já falhou duas vezes neste projeto (o miado do gato). Som gravado tira a
questão do meu ouvido e põe no ouvido de quem gravou.

O que dava pra medir, foi medido — ver a nota dos jingles abaixo.

## Bichinho

| Arquivo | O que é | Fonte | Autor | Licença |
|---|---|---|---|---|
| `gato-miado.ogg` | miado de gato, 0,8 s | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Meow.ogg) | Dan Crosby | **CC BY-SA 3.0** |

## Batalha naval

| Arquivo | O que é | Original | Fonte | Autor | Licença |
|---|---|---|---|---|---|
| `naval/acerto.ogg` | tiro no casco | `explosionCrunch_000` | [Kenney — Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | Kenney | **CC0** |
| `naval/afunda.ogg` | navio afundando | `lowFrequency_explosion_000` | [Kenney — Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | Kenney | **CC0** |
| `naval/agua.ogg` | tiro na água | `splash_09` | [OpenGameArt — 40 CC0 water/splash/slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | **CC0** |
| `naval/vitoria.ogg` | fanfarra de vitória | `jingles_HIT15` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |
| `naval/derrota.ogg` | fim de partida | `jingles_STEEL07` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |
| `naval/tema.ogg` | música de fundo, laço de 16,6 s | `A Brand New Wisdom` | [OpenGameArt — Short Loops Background Music Pack](https://opengameart.org/content/short-loops-background-music-pack) | hernandack | **CC0** |

## Cozinha do Amor

| Arquivo | O que é | Original | Fonte | Autor | Licença |
|---|---|---|---|---|---|
| `cozinha-tema.ogg` | música de fundo, em laço | `Swinging Sweet` | [OpenGameArt — Short Loops Background Music Pack](https://opengameart.org/content/short-loops-background-music-pack) | hernandack | **CC0** |
| `cozinha/picar.ogg` | faca na tábua | `chop` | [Kenney — RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney | **CC0** |
| `cozinha/panela.ogg` | panela no fogão | `metalPot3` | [Kenney — RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney | **CC0** |
| `cozinha/pegar.ogg` | pegar/largar | `cloth2` | [Kenney — RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney | **CC0** |
| `cozinha/prato.ogg` | prato na bancada | `impactPlate_light_002` | [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | **CC0** |
| `cozinha/lavar.ogg` | água na pia | `splash_15` | [OpenGameArt — 40 CC0 water/splash/slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | **CC0** |
| `cozinha/entregue.ogg` | pedido entregue | `jingles_NES12` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |
| `cozinha/errado.ogg` | prato errado / pedido perdido | `jingles_HIT04` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |
| `cozinha/queimou.ogg` | comida queimada | `jingles_SAX11` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |
| `cozinha/fim.ogg` | fim do expediente | `jingles_NES00` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | **CC0** |

O vocabulário do RPG Audio caiu bem demais aqui pra ser coincidência: `chop`,
`knifeSlice` e `metalPot` são exatamente os gestos deste jogo. Os quatro jingles
seguem o mesmo critério medido dos da naval — `entregue` é dos que mais **sobem**
de tom (+243 Hz), `errado` e `queimou` dos que mais **descem** (−355 e −370 Hz), e
`fim` é o jingle mais longo do pacote, que é o que uma fanfarra de encerramento
pede.

### Como os dois jingles foram escolhidos, já que ninguém aqui ouviu

O pacote da Kenney traz 85 jingles com nome numerado — `jingles_HIT15`,
`jingles_STEEL07` — e nenhum diz "vitória" ou "derrota". Escolher no escuro seria
chute, então foram **medidos**: centroide espectral quadro a quadro (Goertzel, 24
faixas log-espaçadas de 150 Hz a 3 kHz, quadros de 100 ms, silêncio descartado),
comparando o primeiro terço com o último.

Vitória sobe de tom; derrota desce. Isso é número, não gosto. Os dois escolhidos
foram os **extremos** entre os que têm pelo menos 0,8 s de som de verdade:

| | escolhido | começo → fim | variação |
|---|---|---|---|
| vitória | `jingles_HIT15` | 557 Hz → 771 Hz | **+214 Hz** |
| derrota | `jingles_STEEL07` | 719 Hz → 442 Hz | **−277 Hz** |

É a mesma disciplina da bancada `/lab`: medir o que dá pra medir sem ouvido, e
ser honesto sobre o resto. **Se algum som não agradar, a troca é trocar o
arquivo** — os nomes em `src/jogoAudio.js` não mudam.

## As músicas foram reduzidas

Os dois temas vieram em estéreo, 44,1 kHz, 128–160 kbps. Foram reconvertidos para
**mono, 32 kHz, 72 kbps**, o que corta o peso pela metade sem diferença audível
num alto-falante de celular — e este app é um PWA que a pessoa baixa pelo 4G.

## O que as licenças exigem, em português

**CC0** é domínio público: não pede nada. O crédito acima é cortesia, e fica
porque saber de onde veio cada arquivo tem valor mesmo quando não é obrigatório.

**CC BY-SA 3.0** (só o miado) pede duas coisas: dar o crédito (é a tabela) e
manter o arquivo sob a mesma licença se ele for repassado. Ela vale sobre o SOM,
não sobre o app. Este app é privado, para duas pessoas, e não é distribuído — na
prática só a primeira obrigação se aplica, e está cumprida. Se um dia ele virar
produto, o caminho limpo é trocar por som CC0, como todo o resto já é.

## Nota sobre o kit Kenney de MÓVEIS

O pacote de móveis do Kenney foi removido em 28/08/2026 e o teste de fumaça
proíbe a volta dele. Aquilo era **desenho**, e o motivo era estilo: PNG genérico
ao lado da nossa pixel art, cor assada no arquivo em vez de parâmetro, e um
vocabulário que não batia com o catálogo da loja.

Nada disso vale para som: som não tem cor, não gira, e não fica ao lado de outro
som destoando. A trava do smoke é nominal (`furnitureKenney`, `drawKenneyItem`,
`public/kenney-furniture/`) e não encosta nestes arquivos.
