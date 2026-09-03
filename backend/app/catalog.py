"""Conteudo do jogo: comodos, itens de loja, perguntas do quiz.

Sobre a arte: o documento previa camadas de PNG transparente. Aqui nada e imagem
de arquivo — avatar, pet e mobilia sao **desenhados em SVG pelo proprio app**, e o
item guarda so os parametros (estilo, cor, tamanho em celulas). O motivo e pratico:
PNG exigiria centenas de desenhos prontos antes da primeira tela funcionar, e cada
roupa nova viraria trabalho de ilustracao. Com SVG, item novo e uma linha aqui.
O renderizador esta em `web/src/render/`.

Editar este arquivo e o jeito de aumentar a economia: o seed sincroniza por `code`,
entao item novo aparece na loja no proximo boot, e item removido some da loja sem
sumir do inventario de quem ja comprou.
"""

# ------------------------------------------------------------------ avatar
# Ordem de empilhamento das camadas, do fundo pra frente. O app respeita esta ordem.
AVATAR_LAYERS = ["base", "bottom", "top", "shoes", "hair", "face", "head", "extra"]

SKIN_TONES = ["#f6d5c0", "#eec1a2", "#d9a06f", "#b57545", "#8d5524", "#5c3620"]
HAIR_COLORS = ["#2b1b12", "#4a2c1a", "#8a5a2b", "#c98a3d", "#e0b872", "#9b2d2d", "#6b3fa0", "#d94f8a"]
EYE_COLORS = ["#3b2a20", "#5b3a1e", "#2f6f5e", "#2b5d8a", "#6b4b8a"]

# Comeco de todo mundo: o que ja vem vestido sem gastar nada.
DEFAULT_AVATAR = {
    "skin": "#eec1a2",
    "hair_style": "curto",
    "hair_color": "#2b1b12",
    "eyes": "redondo",
    "eye_color": "#3b2a20",
    "mouth": "sorriso",
    "brows": "reta",
    # Silhueta do corpo. Nao e roupa nem item de loja: e como a pessoa e, entao
    # e de graca e nao passa pela posse. Existe porque o boneco unico deixava
    # os dois iguais do pescoco pra baixo — e a dona do app disse, com razao,
    # que o dela nao parecia ela.
    "corpo": "reto",
    "top": "camiseta",
    "top_color": "#5b8def",
    "bottom": "jeans",
    "bottom_color": "#3c5a99",
    "shoes": "tenis",
    "shoes_color": "#f0f0f0",
    "head": "",
    "extra": "",
    "blush": False,
}

# Estilos que nao custam nada — ja vem liberado, nao aparece na loja.
FREE_AVATAR_STYLES = {
    "hair": ["curto", "medio"],
    "top": ["camiseta", "regata"],
    "bottom": ["jeans", "short"],
    "shoes": ["tenis", "chinelo"],
}


def _avatar(code, name, slot, style, price, description=""):
    return {
        "code": f"avatar_{code}",
        "category": "avatar",
        "subcategory": slot,
        "name": name,
        "description": description,
        "price": price,
        "metadata": {"slot": slot, "style": style},
    }


def _pet(code, name, sub, price, effect, description="", consumable=False):
    return {
        "code": f"pet_{code}",
        "category": "pet",
        "subcategory": sub,
        "name": name,
        "description": description,
        "price": price,
        "consumable": consumable,
        "metadata": effect,
    }


def _pet_species(code, name, price):
    # `consumable`: a licenca VIRA um bichinho e some do inventario.
    #
    # Antes ela nao se gastava, porque so trocava a especie do unico bichinho —
    # nao fazia sentido consumir. Agora cada licenca traz um bichinho novo, com a
    # vida dele; se continuasse sem gastar, uma compra so daria bichinho infinito
    # (bastava chamar a rota de novo). Trocar entre os que ja moram na casa segue
    # de graca — o que custa e trazer mais um pra dentro.
    return _pet(
        f"especie_{code}", name, "especie", price, {"species": code},
        "Mais um bichinho para a família", consumable=True,
    )


def _house(code, name, sub, price, w, h, shape, description=""):
    return {
        "code": f"house_{code}",
        "category": "house",
        "subcategory": sub,
        "name": name,
        "description": description,
        "price": price,
        "metadata": {"width": w, "height": h, "shape": shape},
    }


# ------------------------------------------------------------------ comodos
# A casa e uma PLANTA, nao uma tela por comodo: cada comodo ocupa um retangulo
# numa grade unica de 20x16, e os que encostam dividem parede (com porta no meio).
# Foi o que permitiu parede interna e, depois, o avatar andando de um comodo pro
# outro sem trocar de tela.
#
#        x=0        x=10       x=20
#   y=0  +----------+----------+
#        |  sala    | cozinha  |
#   y=8  +----------+----------+
#        |  quarto  | varanda  |
#   y=16 +----------+----------+
#
# `quintal` fica FORA (outdoor): sem teto nem parede, chao de grama, muro e a
# calcada com a rua na frente. Ele nao entra no retangulo da casa — o cenario de
# fora e desenhado em volta dela.
ROOMS = [
    {"code": "sala", "name": "Sala", "width": 10, "height": 8, "unlock_price": 0,
     "x": 0, "y": 0},
    {"code": "cozinha", "name": "Cozinha", "width": 10, "height": 8, "unlock_price": 900,
     "x": 10, "y": 0},
    {"code": "quarto", "name": "Quarto", "width": 10, "height": 8, "unlock_price": 600,
     "x": 0, "y": 8},
    {"code": "varanda", "name": "Varanda", "width": 10, "height": 8, "unlock_price": 1400,
     "x": 10, "y": 8},
    {"code": "quintal", "name": "Quintal", "width": 14, "height": 10, "unlock_price": 0,
     "x": 0, "y": 0, "outdoor": True},
]

# Portas: por onde se passa de um comodo pro outro. Cada porta e um par de
# comodos + a celula (na grade da planta) onde o vao fica. A parede interna e
# desenhada inteira MENOS esta celula — assim porta e buraco de verdade na
# parede, e nao um adesivo desenhado por cima dela.
DOORS = [
    {"a": "sala", "b": "cozinha", "x": 10, "y": 3, "axis": "v"},
    {"a": "sala", "b": "quarto", "x": 4, "y": 8, "axis": "h"},
    {"a": "cozinha", "b": "varanda", "x": 14, "y": 8, "axis": "h"},
    {"a": "quarto", "b": "varanda", "x": 10, "y": 11, "axis": "v"},
    # A porta dos bichinhos para o quintal. O quintal aparece logo depois da
    # planta interna (y=16) no mapa continuo; a varanda e o comodo que faz a
    # transicao entre dentro e fora, como numa casa de verdade.
    {"a": "varanda", "b": "quintal", "x": 15, "y": 16, "axis": "h"},
]


# ------------------------------------------------------------------ especies
# Nao sao skins: cada especie tem RITMO diferente, e isso muda o cuidado que ela
# pede. Os numeros sao "pontos por hora" de queda, multiplicados sobre a base em
# `pet_care.py`. Gato quase nao suja e nao passa fome, mas fica triste sozinho;
# cachorro come muito e suja muito, e paga com alegria; coelho e o mais sujo.
#
# `mess_rate` multiplica a velocidade com que a sujeira aparece na casa.
PET_SPECIES = [
    {
        "code": "gato", "name": "Gato", "tagline": "Independente, mas cobra atenção",
        "hunger": 0.8, "hygiene": 0.5, "energy": 1.0, "happiness": 1.35, "mess_rate": 0.6,
        "colors": ["#f2a03d", "#8d8d97", "#3a3340", "#f0ebe2"],
    },
    {
        "code": "cachorro", "name": "Cachorro", "tagline": "Come muito e ama brincar",
        "hunger": 1.35, "hygiene": 1.2, "energy": 1.25, "happiness": 0.8, "mess_rate": 1.25,
        "colors": ["#c98a4b", "#6b4a2f", "#e8dcc6", "#3a3340"],
    },
    {
        "code": "coelho", "name": "Coelho", "tagline": "Fofo, e o que mais suja",
        "hunger": 1.15, "hygiene": 1.0, "energy": 0.85, "happiness": 1.0, "mess_rate": 1.6,
        "colors": ["#f0ebe2", "#c9c4bd", "#9c7b62", "#3a3340"],
    },
    {
        "code": "passaro", "name": "Passarinho", "tagline": "Come pouco, cansa rápido",
        "hunger": 0.65, "hygiene": 0.9, "energy": 1.5, "happiness": 1.1, "mess_rate": 1.1,
        "colors": ["#f2c53d", "#5bb9e8", "#7fd6b0", "#e8879b"],
    },
    {
        "code": "capivara", "name": "Capivara", "tagline": "Tranquila — mas vive suja",
        "hunger": 1.0, "hygiene": 1.6, "energy": 0.6, "happiness": 0.7, "mess_rate": 1.0,
        "colors": ["#a87b52", "#8a6340", "#c9a67f", "#3a3340"],
    },
    {
        "code": "dragao", "name": "Dragãozinho", "tagline": "Dá trabalho em tudo",
        "hunger": 1.3, "hygiene": 1.3, "energy": 1.3, "happiness": 1.3, "mess_rate": 1.3,
        "colors": ["#7fd6b0", "#6b4fa0", "#e8879b", "#f2c53d"],
    },
]

PET_SPECIES_BY_CODE = {s["code"]: s for s in PET_SPECIES}


# ------------------------------------------------------------------ loja
SHOP_ITEMS = [
    # --- avatar: cabelo
    _avatar("hair_longo", "Cabelo longo", "hair", "longo", 120),
    _avatar("hair_cacheado", "Cabelo cacheado", "hair", "cacheado", 140),
    _avatar("hair_coque", "Coque", "hair", "coque", 130),
    _avatar("hair_franja", "Franja", "hair", "franja", 110),
    _avatar("hair_rabo", "Rabo de cavalo", "hair", "rabo", 130),
    _avatar("hair_moicano", "Moicano", "hair", "moicano", 180),
    _avatar("hair_chanel", "Chanel", "hair", "chanel", 140),
    _avatar("hair_trancas", "Tranças", "hair", "trancas", 170),
    _avatar("hair_afro", "Black power", "hair", "afro", 190),
    _avatar("hair_raspado", "Raspado", "hair", "raspado", 90, "Careca de propósito, com a sombra do corte"),
    # --- avatar: roupa de cima
    _avatar("top_moletom", "Moletom", "top", "moletom", 150),
    _avatar("top_vestido", "Vestido", "top", "vestido", 220, "Peça única: dispensa a de baixo"),
    _avatar("top_xadrez", "Camisa xadrez", "top", "xadrez", 170),
    _avatar("top_jaqueta", "Jaqueta", "top", "jaqueta", 240),
    _avatar("top_social", "Camisa social", "top", "social", 200),
    # --- avatar: roupa de baixo
    _avatar("bottom_saia", "Saia", "bottom", "saia", 130),
    _avatar("bottom_calca_social", "Calça social", "bottom", "social", 160),
    _avatar("bottom_moletom", "Calça de moletom", "bottom", "moletom", 140),
    # --- avatar: calcado
    _avatar("shoes_bota", "Bota", "shoes", "bota", 190),
    _avatar("shoes_sandalia", "Sandália", "shoes", "sandalia", 120),
    _avatar("shoes_social", "Sapato social", "shoes", "social", 200),
    # --- avatar: cabeca
    _avatar("head_bone", "Boné", "head", "bone", 150),
    _avatar("head_oculos", "Óculos", "head", "oculos", 160),
    _avatar("head_laco", "Laço", "head", "laco", 110),
    _avatar("head_coroa", "Coroa", "head", "coroa", 500, "Pra quem ganhou muito minigame"),
    _avatar("head_touca", "Touca", "head", "touca", 130),
    # --- avatar: acessorio extra
    _avatar("extra_colar", "Colar", "extra", "colar", 140),
    _avatar("extra_mochila", "Mochila", "extra", "mochila", 180),
    _avatar("extra_fone", "Fone de ouvido", "extra", "fone", 200),
    _avatar("extra_asa", "Asinhas", "extra", "asa", 600, "Puro exagero, e o ponto é esse"),
    # --- pet: espécies adotáveis
    *[_pet_species(s["code"], s["name"], 350) for s in PET_SPECIES],
    # --- pet: comida (consumivel)
    # Comida rende MAIS por moeda desde 26/08. A conta que estourava era esta:
    # a fome caia 72 pontos por dia e a racao dava 30 por 25 Coracoes, entao
    # so manter o bichinho de barriga cheia custava ~60 por dia de uma renda de
    # ~90. O consumivel deixou de ser cuidado e virou imposto. Aqui o preco
    # desceu e o efeito subiu; do outro lado, a fome passou a cair 2,0 por hora
    # (`settings_store.py`). Sao os dois lados da mesma conta.
    _pet("petisco", "Petisco", "comida", 8, {"hunger": 15}, "Um agrado rápido", True),
    _pet("racao", "Ração", "comida", 20, {"hunger": 40}, "O básico bem feito", True),
    _pet("bolo", "Bolo de aniversário", "comida", 45, {"hunger": 45, "happiness": 15}, "", True),
    _pet("sushi", "Sushi", "comida", 70, {"hunger": 55, "happiness": 25}, "Chique demais", True),
    _pet("banho_kit", "Kit de banho", "comida", 24, {"hygiene": 50}, "Shampoo e toalha", True),
    # --- pet: brinquedo (nao some, tem descanso entre usos)
    _pet("bolinha", "Bolinha", "brinquedo", 40, {"happiness": 15, "energy": -8, "cooldown_min": 30}),
    _pet("ossinho", "Ossinho", "brinquedo", 50, {"happiness": 18, "energy": -6, "cooldown_min": 40}),
    _pet("varinha", "Varinha", "brinquedo", 80, {"happiness": 25, "energy": -12, "cooldown_min": 60}),
    _pet("almofada", "Almofada", "brinquedo", 70, {"energy": 30, "cooldown_min": 120}, "Pra cochilar"),
    # --- pet: acessorio (so visual)
    _pet("coleira", "Coleira", "acessorio", 120, {"slot": "neck", "style": "coleira"}),
    _pet("gravata", "Gravatinha", "acessorio", 140, {"slot": "neck", "style": "gravata"}),
    _pet("chapeu", "Chapeuzinho", "acessorio", 150, {"slot": "head", "style": "chapeu"}),
    _pet("oculos_pet", "Óculos escuros", "acessorio", 180, {"slot": "head", "style": "oculos"}),
    # --- casa: estrutural
    _house("piso_madeira", "Piso de madeira", "estrutural", 200, 0, 0, "floor:madeira"),
    _house("piso_ceramica", "Piso de cerâmica", "estrutural", 220, 0, 0, "floor:ceramica"),
    _house("piso_tapete", "Piso acarpetado", "estrutural", 260, 0, 0, "floor:carpete"),
    _house("parede_rosa", "Parede rosa", "estrutural", 180, 0, 0, "wall:rosa"),
    _house("parede_azul", "Parede azul", "estrutural", 180, 0, 0, "wall:azul"),
    _house("parede_verde", "Parede verde", "estrutural", 180, 0, 0, "wall:verde"),
    _house("piso_grama", "Grama caprichada", "estrutural", 200, 0, 0, "floor:grama"),
    _house("piso_pedra", "Piso de pedra", "estrutural", 240, 0, 0, "floor:pedra"),
    # --- casa: moveis
    _house("sofa", "Sofá", "moveis", 300, 3, 1, "sofa"),
    _house("cama", "Cama de casal", "moveis", 380, 3, 2, "bed"),
    _house("mesa", "Mesa", "moveis", 260, 2, 2, "table"),
    _house("cadeira", "Cadeira", "moveis", 90, 1, 1, "chair"),
    _house("estante", "Estante", "moveis", 320, 2, 1, "shelf"),
    _house("armario", "Armário", "moveis", 340, 2, 1, "wardrobe"),
    _house("puff", "Puff", "moveis", 110, 1, 1, "puff"),
    # --- casa: decoracao
    _house("quadro", "Quadro", "decoracao", 130, 1, 1, "frame"),
    _house("quadro_casal", "Quadro do casal", "decoracao", 350, 2, 1, "frame_couple"),
    _house("planta", "Planta", "decoracao", 120, 1, 1, "plant"),
    _house("planta_grande", "Planta grande", "decoracao", 210, 1, 1, "plant_big"),
    _house("tapete", "Tapete", "decoracao", 190, 3, 2, "rug"),
    _house("luminaria", "Luminária", "decoracao", 160, 1, 1, "lamp"),
    _house("velas", "Velas", "decoracao", 90, 1, 1, "candles"),
    # --- casa: eletronicos
    _house("tv", "TV", "eletronicos", 420, 2, 1, "tv"),
    _house("som", "Caixa de som", "eletronicos", 250, 1, 1, "speaker"),
    _house("videogame", "Videogame", "eletronicos", 460, 1, 1, "console"),
    _house("geladeira", "Geladeira", "eletronicos", 480, 1, 2, "fridge"),
    _house("fogao", "Fogão", "eletronicos", 400, 2, 1, "stove"),
    # --- casa: coisas do bichinho (ficam no comodo, nao no inventario dele)
    _house("caminha_pet", "Caminha do bichinho", "bichinho", 200, 2, 2, "petbed"),
    _house("comedouro", "Comedouro", "bichinho", 130, 1, 1, "petbowl"),
    _house("arranhador", "Arranhador", "bichinho", 260, 1, 1, "scratchpost"),
    _house("casinha_pet", "Casinha", "bichinho", 340, 2, 2, "pethouse"),
    # --- casa: quintal (so encaixa em area de fora)
    _house("rede", "Rede de descanso", "quintal", 280, 3, 1, "hammock"),
    _house("churrasqueira", "Churrasqueira", "quintal", 420, 2, 1, "grill"),
    _house("horta", "Horta", "quintal", 190, 2, 2, "garden"),
    _house("balanco", "Balanço", "quintal", 300, 2, 2, "swing"),
    _house("arvore", "Árvore", "quintal", 240, 2, 2, "tree"),
    _house("varal", "Varal", "quintal", 150, 3, 1, "clothesline"),
    _house("banquinho", "Banquinho de jardim", "quintal", 120, 1, 1, "gardenstool"),
]


# ------------------------------------------------------------------ quiz
QUIZ_QUESTIONS = [
    {"text": "Qual a comida favorita?", "category": "gosto"},
    {"text": "Qual o maior medo?", "category": "intimo"},
    {"text": "Qual a música que nunca enjoa?", "category": "gosto"},
    {"text": "Qual filme você assistiria de novo agora?", "category": "gosto"},
    {"text": "Qual foi o melhor presente que ja ganhou?", "category": "memoria"},
    {"text": "Que lugar do mundo quer conhecer primeiro?", "category": "sonho"},
    {"text": "Qual o apelido preferido?", "category": "casal"},
    {"text": "O que mais te irrita no trânsito?", "category": "geral"},
    {"text": "Doce ou salgado?", "category": "gosto"},
    {"text": "Praia ou montanha?", "category": "gosto"},
    {"text": "Qual seria o superpoder escolhido?", "category": "sonho"},
    {"text": "Qual matéria você mais odiava na escola?", "category": "memoria"},
    {"text": "Que série você maratonaria de novo?", "category": "gosto"},
    {"text": "Qual foi nosso melhor programa juntos?", "category": "casal"},
    {"text": "O que te acalma num dia ruim?", "category": "intimo"},
    {"text": "Qual animal você seria?", "category": "geral"},
    {"text": "Café da manhã ou janta?", "category": "gosto"},
    {"text": "Qual hábito seu você mudaria?", "category": "intimo"},
    {"text": "Qual foi a primeira coisa que reparou em mim?", "category": "casal"},
    {"text": "Que cheiro te lembra infância?", "category": "memoria"},
    {"text": "Domingo perfeito: sair ou ficar em casa?", "category": "casal"},
    {"text": "Qual comida você nunca comeria?", "category": "gosto"},
]
