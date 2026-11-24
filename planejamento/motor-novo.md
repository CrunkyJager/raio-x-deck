# Motor próprio do Raio-X (planejamento, 24/11/2026)

Decisão do Felipe (24/11): motor do zero, **formato de carta próprio** (conversor Forge/Scryfall → nosso formato) e **regras completas** (pilha, prioridade, fases, camadas, substituições). Motivo: na Mesa ao vivo gatilhos não funcionam (Anje's Ravager: "ataca se puder", "ao atacar descarte a mão e compre 3", madness).

## 1. O que existe hoje (motor velho)

| Peça | O que faz | Problema |
|---|---|---|
| `motor/engine.js` `modelo()` + `lerHab()` | lê cada carta do inglês (regex) num resumo: terreno, ramp, remoção, lorde, gatilhos… | adivinha frase; o que não reconhece vira lacuna (lacunas.js: Krenko 36/65, Edgar 33/64) |
| `engine.js` `jogo()` | partida "goldfish" abstrata (sem oponente de verdade) | modelo próprio, separado da arena |
| `motor/mesa.js` `arena()` | mesa de 4 numa função de ~850 linhas: turno, combate, remoção, wipes, anexos | sem pilha, sem prioridade, sem camadas; efeitos por "atalho" |
| humano (T08) | cada resposta roda a partida **do zero** com a mesma semente até a próxima pergunta | custo cresce com a partida (O(n²)); foto do estado cara |
| `forge-motor.js` | peças das mágicas lidas do Forge (só instantâneas/feitiços) | metade do caminho: permanentes continuam na regex |
| `torneio/testaTrocas/variantes/estudo/analisa/explica` (mesa.js) | o que a tela usa, via Worker (`tipo`: torneio, partida, jogar, estudo, trocas, analisar, variantes) | **é a fronteira que o motor novo precisa respeitar** |

Quem depende: `mesa-ui.js` (Mesa simulada, ao vivo, trocas, variantes, estudo, revisão T09), `montar.js` (analisa), `ferramentas/partida.js`, `jogavel.js`, `lacunas.js`, `analise.js` (node), `calibra/banco_mesa.py` (banco de 30), CI (`ferramentas/ci/verifica.py`, base.json).
**Não depende do motor:** `analise.js` (funções/pesos vêm do `forge-db.js`), `montar.js` fora o analisa.

Tamanho da linguagem do Forge (cardsfolder, 35 mil roteiros): 139 modos de gatilho (ChangesZone 7,8 mil, Phase 2,4 mil, Attacks 1,6 mil, SpellCast 1,4 mil, DamageDone 0,9 mil…), 198 tipos de efeito (67 cobrem 95% dos usos), 82 modos de estática, 243 palavras-chave, 1,7 mil cartas com substituição (R:). É finito: dá para cobrir por ordem de frequência **nas cartas dos nossos decks**.

## 2. Dívidas para arrumar já (antes ou no começo do motor)

1. **LICENSE GPL-3**: adiado pelo Felipe (24/11: "vamos trocar o motor"). Lembrete: o RX também é gerado do Forge, então a GPL volta a valer na publicação do motor novo (T24).
2. **T09 sem commit**: Felipe 24/11 — segurar até o motor novo (T22).
3. **`planejamento/` fora do git** e 30 arquivos soltos (`*.bak-*`, `banco_forge*.json/log`, `ferramentas/gabarito/*`): versionar o planejamento, `.gitignore` para .bak e logs.
4. **Stangg 36 bilhões** (copia 9 auras + Thran Power Suit): **não consertar no motor velho** (Felipe 24/11) — o motor novo, com camadas, resolve por regra; até lá, o banco de 30 fica com esse viés anotado.
5. **Motor velho congelado**: só conserto de travamento. Tudo novo vai para o motor novo.
6. `oponentes-edhrec.js` sai do site (decisão T03) — o motor novo precisa de decks de oponente próprios (entra na migração, T24).

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
- **O mesmo formato alimenta os pesos do analise.js** (substitui o forge-db aos poucos; a T31 vira parte disto).

- **Feito na T12 (24/11):** `ferramentas/rx/esquema.json` (JSON Schema 2020-12: blocos kw/atv/gat/est/subst/fx/faces; 40 ops, 19 eventos de gatilho, 17 modos de estática, 9 de substituição, 57 palavras-chave; filtro, qtd, cond, custo) + `esperado_rx.json` (20 cartas difíceis à mão: os 4 comandantes + Anje, Rhystic, Tithe, Skullclamp, Cultivate, Path, Herald's Horn, Anointed Procession, Cyclonic Rift, Teferi's Protection, Akroma's Will, Sacred Foundry, Blasphemous Act, Impact Tremors, Reanimate, Bonecrusher) + `valida_rx.py` (esquema + nome/vm/identidade/tipos/poder contra o cards-db; 20/20).
- Decisões do formato: identidade em ordem WUBRG; o que a regra já faz não vai no fx (sobrecarga troca alvo por cada — CR 702.96; aventura/loucura/flashback pela regra); "a menos que pague" é campo `aMenosQue` do fx (Rhystic, Tithe, terreno de choque); eminência = `zonaAtiva:["comando","campo"]`; tipo escolhido ao entrar = `sub:["escolhido"]`; campos `_obs` livres para nota.

### 3.2 Conversor Forge + Scryfall → RX
Python, em `ferramentas/rx/` (reaproveita `params`/`le_arquivo` do `converte.py`). Scryfall dá nome, custo, tipos, identidade, legalidade; Forge dá o comportamento. Gabarito `esperado_rx.json` (cartas à mão) e `testa_rx.py` 100% antes de commit. Relatório de cobertura: % das cartas do cards-db e do banco de 30 sem `falta`.
- **T13 parte 1 (24/11):** `ferramentas/rx/converte_rx.py` (importa `params`/`tparams`/`PASTA` do converte.py; base do cards-db + PT/lealdade do Forge; kw, custos de ativada e lealdade, A: SP/AB com cadeia de SubAbility, alvos, ~35 APIs, Charm com "escolhe os dois se controla comandante", gatilhos (entra/morre/fase/ataca/conjura/compra/dano/alvoDe…, eminência junta zonas), estáticas comuns (Continuous, ReduceCost, CantChangeLife…), substituições (entra virado com/sem pagar, dobra ficha, escolher tipo ao entrar), fichas lidas de `tokenscripts/`, mana implícita de terreno com tipo básico). `testa_rx.py` compara bloco a bloco com o gabarito: **20/20**. Base inteira: 32 614 cartas, **todas no esquema**; banco de 30 + exemplos: **59,0% das cópias sem `falta`** (`rx/cobertura_rx.json`). Esquema: + `manto` (Shroud), mana híbrida fireixiana `G/W/P` e `C/W`. `cartas-rx.js` (11,5 MB) é gerado e fica fora do git até o motor usar.
- **T13 parte 2, rodada 1 (24/11):** custo com `<…>` inteiro (Reveal/Exile/Sac com texto), `!token`, `All`=tudo, poder/resist/vm do evento e do este, AffectedDefined Self, "no seu turno", impulso (exila e pode jogar) = `jogar` com dura, mana refletida, mão sem limite, terra extra, habilidades dadas por estática (`habil`), Panharmonicon, dobra marcador, desvirar todos; −X/−X não vira mais +1/+1 (bug pego na conferência). Esquema + `refletida`, `terraExtra`, `revelar`/`exilarEste` no custo, contas do evento. Banco **59,0% → 67,2%** sem falta; gabarito 20/20; base toda no esquema.
- **T13 parte 2, rodada 2 (24/11):** contagens gerais (`Count$Valid<Zona>`, `/Plus` `/Times` `/Twice` `/Half`, `$Colors`/soma de poder, kicker/presente 'se', −X), P/R aceitam qtd, cópia de permanente (ficha cópia com exceções, fim do turno), gatilho atrasado, animar, anexar, "pode jogar/olhar" de outra zona, Play, repetir por jogador (`cadaAtual`), transformar, copiar mágica, Decimate (vários TargetOnly), sagas (capítulos), entra com marcadores, combate extra, **condições** de efeito/gatilho/estática (`se`: conta/existe/objBate/palavra — antes eram ignoradas em silêncio), **custo adicional de mágica** (`custoAd`, ex. Toxic Deluge — antes descartado), "este ou outro X" (`ouEste`), não-anulável, prevenção/dobro de dano, custo alternativo, CDA (`pBase`/`rBase`). Bugs pegos nas comuns: Beast Within (ficha é do controlador do alvo), Chaos Warp (grimório do dono + embaralha), Eternal Witness (seu cemitério = dono), Toxic Deluge. Gabarito 20 → **38** (+18 comuns conferidas à mão), 38/38; base toda no esquema. Banco **67,2% → 78,1%**.
- **T13 parte 2 (próxima rodada):** atacar o topo de `cobertura_rx.json` → `falta_top` (X pago, Continuous sem Affected/AddAbility/MayPlay/SetMaxHandSize, ManaReflected, IsRemembered, !token, CopyPermanent geral, custo "ou", Animate, DelayedTrigger, RepeatEach, Surveil, Attach, Regenerate, Chapter, etbCounter) e crescer o gabarito com cartas comuns (Sol Ring, Swords, Beast Within, Evolving Wilds, Greaves, Chaos Warp…) para não ajustar só às 20 difíceis. Meta: ≥ 85% do banco sem `falta`.

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
O núcleo nunca decide: toda escolha vira `pergunta {tipo, ops}` para um **agente** (IA ou humano). Com estado clonável, o humano responde e o motor **continua de onde parou** (acaba o "roda do zero" da T08). A tela da T08/T09 (botões, revisão lance a lance, dica ao vivo) é reaproveitada.

### 3.5 IA que joga
Camada separada do núcleo: avaliação do estado (vida, mesa, cartas, mana, ameaça de cada oponente) + política por tipo de pergunta; valor das cartas tirado dos **pesos do Raio-X** (é aqui que a Mesa prova os pesos). Monte Carlo em cima do clone para decisões grandes (o mesmo da T09).

### 3.6 Testes
1. **Casos de regra** com número da CR (cena montada → ação → estado esperado), crescendo a cada parte do núcleo; usa a T10 (regras consultáveis).
2. **Fumaça por carta**: cada carta convertida entra, usa a habilidade e sai sem erro.
3. **Fuzz**: milhares de partidas aleatórias checando invariantes (nenhuma carta em duas zonas, mana nunca negativa, partida termina).
4. **Desempenho**: meta ≥ 10 partidas de 4 jogadores/s por núcleo no node (hoje ~40/s no motor simplificado); Mesa simulada continua em Workers.
5. **Sanidade no banco de 30** e nos 4 exemplos: números plausíveis, não iguais ao velho (o velho tem erros conhecidos).
Tudo no CI (GitHub Actions da T07).

### 3.7 Migração
O motor novo responde à **mesma API do Worker** (torneio, partida, jogar, estudo, trocas, analisar, variantes). Na tela, chave "motor novo (beta)" até passar nos testes; aí vira padrão e o velho sai (`engine.js`/`mesa.js`/`forge-motor.js`/`lacunas.js`).

### Ordem do núcleo pela cobertura (T11, 24/11 — `planejamento/cobertura.md`)
Banco de 30 + 4 exemplos: 2859 cópias não básicas, todas com roteiro no Forge; 328 tipos de item. Implementando os K mais frequentes, as cópias que ficam inteiras: K=10 → 28%, 30 → 48%, 50 → 63%, 100 → 81%, 150 → 91%, 200 → 95%.
- Topo: Mana (686), gatilho de entrar (403), Tap (400), substituição Moved (392 = terreno que entra virado), Draw (381), Token (363), ChangeZone Library→Battlefield (208, ramp de terreno).
- **Ajuste na ordem:** a substituição "entra virado" (Moved/ETBReplacement) é a 5ª coisa mais comum → vai já na T14 (terrenos), não espera a T19. As outras substituições são raras (CreateToken 25, AddCounter 16).
- Gatilhos (T17): entrar 403, fase/etapa 155, morrer/ir ao cemitério 123, ataque 106, mágica conjurada 93, dano 50, compra 41.
- Estáticas (T18): AddKeyword 196, AddPower/Toughness 160/142, ReduceCost 68.

## 4. Tarefas (no roadmap, fase F7)
T11 Cobertura · T12 Formato RX · T13 Conversor v1 · T14 Núcleo: estado, turno, mana · T15 Pilha e prioridade · T16 Combate · T17 Gatilhos · T18 Estáticas e camadas · T19 Substituição e custos alternativos · T20 Conversor v2 (≥95% do banco) · T21 IA jogadora · T22 Worker + Mesa no motor novo · T23 Testes no CI e desempenho · T24 Migração e aposentar o velho.
Total estimado: 20–25 sessões · R$ 0.
