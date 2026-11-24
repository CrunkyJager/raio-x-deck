# Motor próprio do Raio-X (planejamento, 24/11/2026)

Decisão do Felipe (24/11): motor do zero, **formato de carta próprio** (conversor Forge/Scryfall → nosso formato) e **regras completas** (pilha, prioridade, fases, camadas, substituições). Motivo: na Mesa ao vivo gatilhos não funcionam (Anje's Ravager: "ataca se puder", "ao atacar descarte a mão e compre 3", madness).

## 1. O que existe hoje (motor velho)

| Peça | O que faz | Problema |
|---|---|---|
| `motor/engine.js` `modelo()` + `lerHab()` | lê cada carta do inglês (regex) num resumo: terreno, ramp, remoção, lorde, gatilhos… | adivinha frase; o que não reconhece vira lacuna (lacunas.js: Krenko 36/65, Edgar 33/64) |
| `engine.js` `jogo()` | partida "goldfish" abstrata (sem oponente de verdade) | modelo próprio, separado da arena |
| `motor/mesa.js` `arena()` | mesa de 4 numa função de ~850 linhas: turno, combate, remoção, wipes, anexos | sem pilha, sem prioridade, sem camadas; efeitos por "atalho" |
| humano (T27) | cada resposta roda a partida **do zero** com a mesma semente até a próxima pergunta | custo cresce com a partida (O(n²)); foto do estado cara |
| `forge-motor.js` | peças das mágicas lidas do Forge (só instantâneas/feitiços) | metade do caminho: permanentes continuam na regex |
| `torneio/testaTrocas/variantes/estudo/analisa/explica` (mesa.js) | o que a tela usa, via Worker (`tipo`: torneio, partida, jogar, estudo, trocas, analisar, variantes) | **é a fronteira que o motor novo precisa respeitar** |

Quem depende: `mesa-ui.js` (Mesa simulada, ao vivo, trocas, variantes, estudo, revisão T28), `montar.js` (analisa), `ferramentas/partida.js`, `jogavel.js`, `lacunas.js`, `analise.js` (node), `calibra/banco_mesa.py` (banco de 30), CI (`ferramentas/ci/verifica.py`, base.json).
**Não depende do motor:** `analise.js` (funções/pesos vêm do `forge-db.js`), `montar.js` fora o analisa.

Tamanho da linguagem do Forge (cardsfolder, 35 mil roteiros): 139 modos de gatilho (ChangesZone 7,8 mil, Phase 2,4 mil, Attacks 1,6 mil, SpellCast 1,4 mil, DamageDone 0,9 mil…), 198 tipos de efeito (67 cobrem 95% dos usos), 82 modos de estática, 243 palavras-chave, 1,7 mil cartas com substituição (R:). É finito: dá para cobrir por ordem de frequência **nas cartas dos nossos decks**.

## 2. Dívidas para arrumar já (antes ou no começo do motor)

1. **LICENSE GPL-3**: adiado pelo Felipe (24/11: "vamos trocar o motor"). Lembrete: o RX também é gerado do Forge, então a GPL volta a valer na publicação do motor novo (T42).
2. **T28 sem commit**: Felipe 24/11 — segurar até o motor novo (T40).
3. **`planejamento/` fora do git** e 30 arquivos soltos (`*.bak-*`, `banco_forge*.json/log`, `ferramentas/gabarito/*`): versionar o planejamento, `.gitignore` para .bak e logs.
4. **Stangg 36 bilhões** (copia 9 auras + Thran Power Suit): **não consertar no motor velho** (Felipe 24/11) — o motor novo, com camadas, resolve por regra; até lá, o banco de 30 fica com esse viés anotado.
5. **Motor velho congelado**: só conserto de travamento. Tudo novo vai para o motor novo.
6. `oponentes-edhrec.js` sai do site (decisão T03) — o motor novo precisa de decks de oponente próprios (entra na migração, T42).

## 3. Motor novo — desenho

### 3.1 Formato de carta RX (`cartas-rx`)
JSON por carta, gerado; nada de texto em inglês no motor.
```
{ "n":"Anje's Ravager", "custo":{"g":2,"p":["R"]}, "ci":"R", "tipos":["Creature"], "sub":["Vampire","Berserker"], "pt":[3,3],
  "kw":[{"k":"madness","custo":{"g":1,"p":["R"]}}],
  "est":[{"modo":"deveAtacar","quem":"este"}],
  "gat":[{"ev":"ataca","quem":"este","fx":[{"op":"descartar","quem":"voce","qtd":"mao"},{"op":"comprar","quem":"voce","qtd":3}]}] }
```
- Blocos: `kw` (palavras-chave com parâmetro), `atv` (ativadas: custo + efeito), `gat` (gatilhos: evento + filtro + condição + efeito), `est` (estáticas: modo + filtro + camada), `sub` (substituição/prevenção), `fx` (efeito de mágica), `faces` (dupla face, aventura, split).
- `op` = vocabulário fechado (~70 no começo, os mesmos 67 do Forge que cobrem 95%), cada um com parâmetros tipados; filtros (`quem`, `alvo`) numa mini-linguagem própria (tipo, controlador, cor, P/T, marcadores).
- Carta que o conversor não entende inteira sai com `"falta":[...]` — o motor joga o que entendeu e a tela avisa "não modelado: …". Nunca regex no motor.
- **O mesmo formato alimenta os pesos do analise.js** (substitui o forge-db aos poucos; a T13 vira parte disto).

### 3.2 Conversor Forge + Scryfall → RX
Python, em `ferramentas/rx/` (reaproveita `params`/`le_arquivo` do `converte.py`). Scryfall dá nome, custo, tipos, identidade, legalidade; Forge dá o comportamento. Gabarito `esperado_rx.json` (cartas à mão) e `testa_rx.py` 100% antes de commit. Relatório de cobertura: % das cartas do cards-db e do banco de 30 sem `falta`.

### 3.3 Núcleo de regras (`motor2/`, JS puro, roda no Worker, página e node)
- **Estado** serializável e clonável barato (objetos com id e timestamp; zonas: grimório, mão, campo, cemitério, exílio, pilha, comando). Clonar é a base da IA e da análise (sem rodar do zero).
- **Turno**: fases e passos completos (CR 500), passar prioridade, pilha (CR 405/608), resolver, ações baseadas em estado (CR 704).
- **Mana e custos**: reserva de mana, X, custos adicionais (sacrificar, descartar, pagar vida), alternativos (madness, flashback, kicker, evoke, convoke…), imposto do comandante.
- **Gatilhos** (CR 603): eventos publicados pelo núcleo, fila APNAP, "quando fizer", gatilhos atrasados, condição de intervenção.
- **Estáticas e camadas** (CR 613): cópia, controle, texto, tipo, cor, habilidade, P/T (7a–7d), timestamps e dependência.
- **Substituição e prevenção** (CR 614–616): "em vez de", "se for morrer", escolha do afetado.
- **Combate** multijogador: atacar jogador/planeswalker/batalha, bloqueio, primeiro ataque, atropelar, toque mortífero, dano de comandante 21.
- **Commander**: zona de comando, 40 vidas, identidade de cor, regra de substituição do comandante.

### 3.4 Decisões: um só ponto de pergunta
O núcleo nunca decide: toda escolha vira `pergunta {tipo, ops}` para um **agente** (IA ou humano). Com estado clonável, o humano responde e o motor **continua de onde parou** (acaba o "roda do zero" da T27). A tela da T27/T28 (botões, revisão lance a lance, dica ao vivo) é reaproveitada.

### 3.5 IA que joga
Camada separada do núcleo: avaliação do estado (vida, mesa, cartas, mana, ameaça de cada oponente) + política por tipo de pergunta; valor das cartas tirado dos **pesos do Raio-X** (é aqui que a Mesa prova os pesos). Monte Carlo em cima do clone para decisões grandes (o mesmo da T28).

### 3.6 Testes
1. **Casos de regra** com número da CR (cena montada → ação → estado esperado), crescendo a cada parte do núcleo; usa a T25 (regras consultáveis).
2. **Fumaça por carta**: cada carta convertida entra, usa a habilidade e sai sem erro.
3. **Fuzz**: milhares de partidas aleatórias checando invariantes (nenhuma carta em duas zonas, mana nunca negativa, partida termina).
4. **Desempenho**: meta ≥ 10 partidas de 4 jogadores/s por núcleo no node (hoje ~40/s no motor simplificado); Mesa simulada continua em Workers.
5. **Sanidade no banco de 30** e nos 4 exemplos: números plausíveis, não iguais ao velho (o velho tem erros conhecidos).
Tudo no CI (GitHub Actions da T07).

### 3.7 Migração
O motor novo responde à **mesma API do Worker** (torneio, partida, jogar, estudo, trocas, analisar, variantes). Na tela, chave "motor novo (beta)" até passar nos testes; aí vira padrão e o velho sai (`engine.js`/`mesa.js`/`forge-motor.js`/`lacunas.js`).

## 4. Tarefas (no roadmap, fase F7)
T29 Cobertura · T30 Formato RX · T31 Conversor v1 · T32 Núcleo: estado, turno, mana · T33 Pilha e prioridade · T34 Combate · T35 Gatilhos · T36 Estáticas e camadas · T37 Substituição e custos alternativos · T38 Conversor v2 (≥95% do banco) · T39 IA jogadora · T40 Worker + Mesa no motor novo · T41 Testes no CI e desempenho · T42 Migração e aposentar o velho.
Total estimado: 20–25 sessões · R$ 0.
