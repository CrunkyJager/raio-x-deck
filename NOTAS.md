# Notas do projeto — Raio-X do Deck

Leia antes de mexer. Atualize no fim de cada rodada de trabalho.

## O que é
Ferramenta de análise de decks de Commander (Magic), feita pelo CrunkyJager com o Edgar.
Site estático no GitHub Pages: https://crunkyjager.github.io/raio-x-deck/
Tudo roda no navegador (HTML + JS, sem servidor). Base de ideias: Grimório Arena, do Edgar (artefato na conta do serviço).

## Organização do código
- `index.html` — página, estilos (todo o CSS fica aqui, no fim há os blocos mais novos) e ordem dos scripts. Os scripts levam `?v=AAAAMMDDHHMM` para o navegador não usar versão velha: troque o número a cada publicação.
- `analise.js` — leitura da lista (Moxfield, Archidekt, LigaMagic, MTGO, seções em português), análise (funções, curva, mana, temas, bracket), abas/telas (`#lista`, `#resumo`, `#trocas`, `#funcoes` = aba Análise, `#mesa`, `#aovivo`; `#mana` e `#plano` abrem a Análise já no trecho certo), trocas sugeridas (sai → entra, com "Por que sai / Por que entra / Na prática"), ideia do deck (temas, modo, cartas travadas, cartas para testar), prévia ao passar o mouse, ampliar carta, imagens do Scryfall.
- `mesa-ui.js` — telas Mesa simulada e Mesa ao vivo. Oponentes, decks de amigos (localStorage), teste pareado das trocas, mesa visual com imagens do Scryfall (`/cards/collection` em lotes de 75, guardadas em localStorage).
- `motor/engine.js` e `motor/mesa.js` — motor de jogo do Grimório (Edgar), copiado sem mudar as regras. `motor/worker.js` roda os dois num Worker.
- `cards-db.js` — base de cartas (Scryfall + EDHREC). Campos: m, v, t, o, ci, r, gc, pm, usd, ban, tags, p. Não tem a resistência das criaturas.
- `papeis-ia.js` — o que cada carta faz, em português. `exemplos.js` — 4 decks médios do EDHREC.

## Bracket, orçamento e reais (18/11/2026)
- Todo preço aparece em reais. A base guarda dólar (Scryfall); `brl()`/`brlTxt()` em `analise.js` convertem pela cotação do dia (AwesomeAPI `economia.awesomeapi.com.br`, guardada 12 h no localStorage). Reserva: R$ 5,56 (11/11/2026). É conversão do preço americano, não preço de loja brasileira (LigaMagic costuma ser diferente).
- Na tela Trocas, "A ideia do deck" ganhou **Nível e orçamento**: bracket que o usuário quer (2, 3 ou 4), preço máximo do deck e por carta, em R$. Fica salvo junto da ideia (`CONC.br`, `CONC.teto`, `CONC.tetoCarta`).
- Em `buildSwaps`: 0a) bracket menor tira game changers além do limite (B2: 0, B3: 3), destruição de terrenos em massa, turnos extras em sequência e tutores além de 3; 0b) bracket maior põe game changers das cores até o limite; 0c) preço tira cartas acima do teto por carta e as mais caras até caber no orçamento, por outras da mesma função que custam menos da metade. `addOk()` e `cabe()` barram toda carta que entra fora do bracket ou do orçamento.
- No topo das trocas, blocos com preço antes → depois, bracket e game changers; atualizam ao marcar/desmarcar.
- `isTutor()`: busca de terreno (Rampant Growth, Kodama) não conta mais como tutor. Isso corrigiu o bracket estimado (o Stangg de exemplo caiu de 3 para 2).

## Gráficos das trocas (18/11/2026, antiga pendência 6)
Na linguagem do Grimório Arena (KPI, trilho com tracinho da média, colunas, réguas), com as cores do nosso tema. CSS no bloco "trocas: gráficos no estilo do Grimório Arena", no fim do `<style>`.
- Topo das trocas (`swapSum`, `#sw-sum`): KPIs com antes → depois e destaque verde/vermelho — vitórias na mesa simulada, preço, bracket, game changers. A vitória só aparece "depois" se o último teste foi feito com exatamente as trocas marcadas agora; senão pede para testar de novo.
- `swapGraf` (`#sw-graf`): réguas das funções (faixa normal, bolinha vazia = hoje, dourada = com as trocas) e curva de mana sobreposta (tracejado = hoje, dourado = depois). O "depois" sai de `analyze(newList(A))`; atualiza ao marcar/desmarcar.
- Em cada troca (`swapNums`, `.sw-num`): "Na mesa simulada" (trilho de vitória quando a carta sai × quando a que entra aparece, tracinho dourado na média do deck, nº de partidas), "No bolso" (barra para a esquerda = economiza, direita = soma, na escala da maior troca) e "Nas funções" (+1/−1 por função e custo).
- O motor (`testaTrocas` em `motor/mesa.js`) agora devolve `{ base, pares, todas }`: taxa de vitória da lista atual, de cada troca (com `cSai`/`cEntra`: vitórias nas partidas em que a carta apareceu) e de todas as trocas juntas. `mesa-ui.js` guarda em `window.RAIOX_TESTE` (preso ao objeto do deck) e dispara `raiox:teste`; a aba Trocas redesenha. Testar a partir da aba Trocas volta para ela no fim.
- `motor/worker.js` passa o `?v=` para `engine.js` e `mesa.js` (antes o navegador podia rodar um motor velho do cache).

## Aba Análise (18/11/2026)
Funções, Mana e curva e Plano e cortes viraram uma aba só, a pedido do usuário. Tela `funcoes`, com três blocos `.sub` (`#sub-funcoes`, `#sub-mana`, `#sub-plano`), cada um com o seu `--h` (142, 186, 268). No topo, um índice fixo (`.subnav`) leva a cada bloco. `SUBS` em `analise.js` manda `#mana`/`#plano` para a aba e rola até o bloco. As abas ficaram 01–06.

## Mesa ao vivo, versão legível (18/11/2026)
O usuário achou feia e difícil: não via os terrenos, faltavam detalhes. Mudou em `lugarHTML` (`mesa-ui.js`) e no bloco "Mesa ao vivo, versão mais legível" do CSS:
- Terrenos aparecem como cartas (imagem), agrupados por nome com selo ×N e "N virados"; o título da zona diz quantos estão virados, quantos dá para usar e "+1 agora" quando entrou um.
- Cada zona tem nome (Terrenos, Criaturas, Outras permanentes, Sua mão) e os contadores têm rótulo (Mão, Grimório, Cemitério, Comandante: na zona/em jogo e imposto, Dano de comandante x/21, vermelho a partir de 15).
- Carta virada não gira mais (o nome ficava de lado): fica apagada com o selo "virada".
- Legenda acima da mesa; "jogando agora"/"é o alvo" ao lado do nome; "vida" escrito sobre o número.
- Os 5 últimos do cemitério aparecem com nome clicável (o motor agora manda `gyL`, os 12 últimos, em cada quadro; só exibição, não mexe nas regras).
- Os lances do turno ficam sempre abertos embaixo da mesa (`.vlog2`), com o lance atual destacado.

## Visual
Desde 18/11/2026, a mesma linguagem do **mapa visual** do Mapa do Sistema SAC (artefato do usuário): quadro azul-noite com grade de pontos e brilho no topo, núcleo com anel em arco-íris no cabeçalho, abas em pílula (a aberta acende no degradê da cor da tela), destaque dourado `#ffc23d` nos botões principais, painéis escuros com filete grosso na cor da tela e uma bolinha brilhante antes do título.
- Fontes: Chakra Petch (títulos), IBM Plex Sans (texto), IBM Plex Mono (números e sobretítulos). Ícones: Material Symbols Rounded (só os nomes listados em `icon_names` no `<link>`; ícone novo precisa entrar lá).
- Cor por tela em `--h` (matiz): lista 44, resumo 212, trocas 24, análise 142 (dentro dela, mana 186 e plano 268), mesa simulada 318, mesa ao vivo 352. Nas abas o `--h` vai no `style` de cada link.
- O bloco “estética do mapa visual” fica no fim do `<style>` e vale sobre os anteriores. A Mesa ao vivo continua no feltro verde (é a mesa de jogo).
- Se a fonte de ícones não carregar, um script no fim do `index.html` põe `noicons` no body: os ícones somem e os números das abas (01…08) aparecem no lugar.
- A barra de abas fica numa linha só; abaixo de ~1280 px rola de lado e traz a aba aberta para a vista.
- Resumo: o preço do deck fica em destaque, num bloco dourado (`.stats` / `.stat.price` em `analise.js`), com as 3 cartas mais caras embaixo; ao lado ficam blocos de cartas, custo médio e terrenos. Antes o preço ficava escondido numa linha cinza e o usuário não achava.
- O usuário não gosta de tela apertada: manter o respiro.

## Pendências
1. **Dados do Grimório** (`cards.json`, `decks.json`, `names.tsv`, `alias.json`, `pt.json`) para a pasta `dados/`. O código já procura por `dados/cards.json` (força/resistência certas no combate), `dados/decks.json` (oponentes reais) e `dados/nomes-pt.json` (formato `{"nome em português": "English name"}`; montar a partir de `names.tsv`/`pt.json`). Sem eles: combate aproximado, só 4 oponentes de exemplo, nomes em português não funcionam.
2. Teste das trocas na Mesa simulada deu "empate" em tudo com o deck do Stangg: conferir com os dados do Grimório; se continuar, ver quais cartas o motor não sabe jogar (`naoModelado` em `motor/engine.js`).
3. As imagens das trocas e da prévia ainda usam `cards/named` uma a uma (fila de 110 ms); dá para passar a usar o mesmo lote de `/cards/collection` da Mesa ao vivo.

5. Ideia: usar preço da LigaMagic em vez de converter o do Scryfall (precisa de uma fonte de dados; não há API aberta).


## Como testar
`python3 -m http.server` na pasta e abrir `http://localhost:8000`. Clicar num deck de exemplo, passar pelas abas, jogar na Mesa simulada (200 partidas) e uma partida na Mesa ao vivo.
