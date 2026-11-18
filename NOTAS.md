# Notas do projeto — Raio-X do Deck

Leia antes de mexer. Atualize no fim de cada rodada de trabalho.

## O que é
Ferramenta de análise de decks de Commander (Magic), feita pelo CrunkyJager com o Edgar.
Site estático no GitHub Pages: https://crunkyjager.github.io/raio-x-deck/
Tudo roda no navegador (HTML + JS, sem servidor). Base de ideias: Grimório Arena, do Edgar (artefato na conta do serviço).

## Organização do código
- `index.html` — página, estilos (todo o CSS fica aqui, no fim há os blocos mais novos) e ordem dos scripts. Os scripts levam `?v=AAAAMMDDHHMM` para o navegador não usar versão velha: troque o número a cada publicação.
- `analise.js` — leitura da lista (Moxfield, Archidekt, LigaMagic, MTGO, seções em português), análise (funções, curva, mana, temas, bracket), abas/telas (`#lista`, `#resumo`, `#trocas`, `#funcoes`, `#mana`, `#plano`, `#mesa`, `#aovivo`), trocas sugeridas (sai → entra, com "Por que sai / Por que entra / Na prática"), ideia do deck (temas, modo, cartas travadas, cartas para testar), prévia ao passar o mouse, ampliar carta, imagens do Scryfall.
- `mesa-ui.js` — telas Mesa simulada e Mesa ao vivo. Oponentes, decks de amigos (localStorage), teste pareado das trocas, mesa visual com imagens do Scryfall (`/cards/collection` em lotes de 75, guardadas em localStorage).
- `motor/engine.js` e `motor/mesa.js` — motor de jogo do Grimório (Edgar), copiado sem mudar as regras. `motor/worker.js` roda os dois num Worker.
- `cards-db.js` — base de cartas (Scryfall + EDHREC). Campos: m, v, t, o, ci, r, gc, pm, usd, ban, tags, p. Não tem a resistência das criaturas.
- `papeis-ia.js` — o que cada carta faz, em português. `exemplos.js` — 4 decks médios do EDHREC.

## Visual
Desde 18/11/2026, a mesma linguagem do **mapa visual** do Mapa do Sistema SAC (artefato do usuário): quadro azul-noite com grade de pontos e brilho no topo, núcleo com anel em arco-íris no cabeçalho, abas em pílula (a aberta acende no degradê da cor da tela), destaque dourado `#ffc23d` nos botões principais, painéis escuros com filete grosso na cor da tela e uma bolinha brilhante antes do título.
- Fontes: Chakra Petch (títulos), IBM Plex Sans (texto), IBM Plex Mono (números e sobretítulos). Ícones: Material Symbols Rounded (só os nomes listados em `icon_names` no `<link>`; ícone novo precisa entrar lá).
- Cor por tela em `--h` (matiz): lista 44, resumo 212, trocas 24, funções 142, mana 186, plano 268, mesa simulada 318, mesa ao vivo 352. Nas abas o `--h` vai no `style` de cada link.
- O bloco “estética do mapa visual” fica no fim do `<style>` e vale sobre os anteriores. A Mesa ao vivo continua no feltro verde (é a mesa de jogo).
- Se a fonte de ícones não carregar, um script no fim do `index.html` põe `noicons` no body: os ícones somem e os números das abas (01…08) aparecem no lugar.
- A barra de abas fica numa linha só; abaixo de ~1280 px rola de lado e traz a aba aberta para a vista.
- Resumo: o preço do deck fica em destaque, num bloco dourado (`.stats` / `.stat.price` em `analise.js`), com as 3 cartas mais caras embaixo; ao lado ficam blocos de cartas, custo médio e terrenos. Antes o preço ficava escondido numa linha cinza e o usuário não achava.
- O usuário não gosta de tela apertada: manter o respiro.

## Pendências
1. **Dados do Grimório** (`cards.json`, `decks.json`, `names.tsv`, `alias.json`, `pt.json`) para a pasta `dados/`. O código já procura por `dados/cards.json` (força/resistência certas no combate), `dados/decks.json` (oponentes reais) e `dados/nomes-pt.json` (formato `{"nome em português": "English name"}`; montar a partir de `names.tsv`/`pt.json`). Sem eles: combate aproximado, só 4 oponentes de exemplo, nomes em português não funcionam.
2. Teste das trocas na Mesa simulada deu "empate" em tudo com o deck do Stangg: conferir com os dados do Grimório; se continuar, ver quais cartas o motor não sabe jogar (`naoModelado` em `motor/engine.js`).
3. As imagens das trocas e da prévia ainda usam `cards/named` uma a uma (fila de 110 ms); dá para passar a usar o mesmo lote de `/cards/collection` da Mesa ao vivo.

## Como testar
`python3 -m http.server` na pasta e abrir `http://localhost:8000`. Clicar num deck de exemplo, passar pelas abas, jogar na Mesa simulada (200 partidas) e uma partida na Mesa ao vivo.
