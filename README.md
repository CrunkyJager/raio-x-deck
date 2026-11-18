# Raio-X do Deck

Análise de decks de Commander (Magic: The Gathering): funções do deck, curva, base de mana, plano de jogo, trocas sugeridas (sai → entra) e mesa simulada.

Site estático: só HTML e JavaScript, tudo roda no navegador. Publicado pelo GitHub Pages.

## Arquivos

- `index.html` — página e estilos
- `analise.js` — leitura da lista, análise, trocas sugeridas e navegação por abas
- `mesa-ui.js` — telas da Mesa simulada e da Mesa ao vivo
- `motor/` — motor de jogo do Grimório Arena (Edgar): cada jogador joga o próprio deck, carta a carta; roda num Worker
- `dados/` (opcional) — `cards.json` e `decks.json` do Grimório (cartas com força/resistência e decks de oponentes), `nomes-pt.json` (nomes em português)
- `cards-db.js` — base de cartas (Scryfall + EDHREC)
- `papeis-ia.js` — o que cada carta faz, em português
- `exemplos.js` — decks de exemplo

## Imagens

As imagens vêm do Scryfall na hora em que a carta aparece (`api.scryfall.com/cards/named?format=image`), com uma fila de ~110 ms entre pedidos, como o Scryfall pede. Ao ampliar uma carta, é usada a versão `large`.

Dados e imagens de cartas: [Scryfall](https://scryfall.com). Este projeto não é afiliado ao Scryfall nem à Wizards of the Coast.
