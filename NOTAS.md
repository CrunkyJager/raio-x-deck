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
Tema escuro de feltro, fontes Alegreya Sans / Alegreya Sans SC / JetBrains Mono. Referência de organização: o Mapa do Sistema SAC (espaço para respirar, sobretítulos em mono, uma cor por área no filete de cima dos painéis, abas sublinhadas). O usuário não gosta de tela apertada.

## Pendências
1. **Dados do Grimório** (`cards.json`, `decks.json`, `names.tsv`, `alias.json`, `pt.json`) para a pasta `dados/`. O código já procura por `dados/cards.json` (força/resistência certas no combate), `dados/decks.json` (oponentes reais) e `dados/nomes-pt.json` (formato `{"nome em português": "English name"}`; montar a partir de `names.tsv`/`pt.json`). Sem eles: combate aproximado, só 4 oponentes de exemplo, nomes em português não funcionam.
2. Teste das trocas na Mesa simulada deu "empate" em tudo com o deck do Stangg: conferir com os dados do Grimório; se continuar, ver quais cartas o motor não sabe jogar (`naoModelado` em `motor/engine.js`).
3. As imagens das trocas e da prévia ainda usam `cards/named` uma a uma (fila de 110 ms); dá para passar a usar o mesmo lote de `/cards/collection` da Mesa ao vivo.

## Como testar
`python3 -m http.server` na pasta e abrir `http://localhost:8000`. Clicar num deck de exemplo, passar pelas abas, jogar na Mesa simulada (200 partidas) e uma partida na Mesa ao vivo.
