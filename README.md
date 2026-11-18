# Raio-X do Deck

Análise de decks de Commander (Magic: The Gathering): funções do deck, curva, base de mana, plano de jogo, trocas sugeridas (sai → entra) e mesa simulada.

Site estático: só HTML e JavaScript, tudo roda no navegador. Publicado pelo GitHub Pages.

## Arquivos

- `index.html` — página e estilos
- `analise.js` — leitura da lista, análise, trocas sugeridas e navegação por abas
- `teste.js`, `sim.js`, `forge-models.js`, `combos.js` — mesa simulada
- `cards-db.js` — base de cartas (Scryfall + EDHREC)
- `papeis-ia.js` — o que cada carta faz, em português
- `exemplos.js` — decks de exemplo

## Imagens

As imagens vêm do Scryfall na hora em que a carta aparece (`api.scryfall.com/cards/named?format=image`), com uma fila de ~110 ms entre pedidos, como o Scryfall pede. Ao ampliar uma carta, é usada a versão `large`.

Dados e imagens de cartas: [Scryfall](https://scryfall.com). Este projeto não é afiliado ao Scryfall nem à Wizards of the Coast.
