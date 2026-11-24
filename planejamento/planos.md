# Lista de planos (T04, 23/11/2026) — v3, aprovada

## Plano × tema
- **Plano** = como o deck **ganha** (o que precisa acontecer na mesa). Um deck tem 1 plano principal e às vezes 1 secundário. É o que decide o peso de cada carta (`valorPlano`/`efPlano`).
- **Tema** = de que **peças** o deck é feito (fichas, artefatos, cemitério, tribo…). É o `THEMES` de hoje. Vários temas servem ao mesmo plano (fichas e tribo de Goblin servem a "ir largo").
- Hoje o código mistura os dois: `planoDe` só conhece ataque/voltron/tribo/goad, e "tribo" é tema, não plano. A proposta é: `planoDe` devolve um destes planos; o tema só ajuda a detectar o plano e a dar o peso.

## Os planos (versão 3, 36 em 7 famílias — aprovada pelo Felipe 23/11)

Cada deck recebe **plano principal + secundário** (decidido 23/11). Sinais: dado estruturado primeiro (efeitos do Forge, tipos, tags do Scryfall, oracle do comandante); regex só como reserva.

### A. Combate (ganha batendo)
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 1 | **Voltron** | 21 de dano de comandante com uma criatura carregada | comandante cita aura/equip.; ≥10 anexos | anexo barato com evasão/força, proteção, ímpeto |
| 2 | **Ir largo (go-wide)** | muitas criaturas/fichas + hino/finalizador (Craterhoof) | ≥15 geradores de ficha ou tribo grande | gerador de ficha, hino, finalizador em massa |
| 3 | **Aggro** | bater cedo e sempre com criaturas eficientes | gatilho de ataque no comandante, curva baixa | ímpeto, evasão, ramp até o comandante |
| 4 | **Criaturas grandes (stompy)** | poucas criaturas enormes com atropelar | custo médio de criatura ≥4, P/T alto | ramp, atropelar, proteção |
| 5 | **Veneno (infect/toxic)** | 10 marcadores de veneno | infect/toxic/proliferate | evasão, bônus de força, proliferar |
| 6 | **Combate extra** | vários combates por turno | ≥3 cartas de combate extra | combate extra, desvirar, ímpeto |
| 7 | **Tempo / devolver** | devolver as coisas deles e bater com criatura barata/evasiva | ninjutsu, bounce, flash, comandante evasivo barato | bounce barato, evasão, flash, ninjutsu |
| 8 | **Trapaça de custo (cheat)** | pôr coisa enorme em jogo sem pagar o custo | Sneak Attack, Elvish Piper, Quicksilver Amulet, cascade/discover | peça de trapaça, alvo enorme, proteção |

### B. Motor (ganha por gatilho repetido)
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 9 | **Aristocratas** | sacrificar e drenar 1 de cada vez | outlet + "quando morre" + dreno | outlet grátis, dreno em gatilho, fonte de corpos |
| 10 | **Dreno / group slug** | tirar vida de todos sem combate | perda de vida para cada oponente | pagamento em gatilho, multiplicador |
| 11 | **Ganho de vida que vira dano** | cada vida ganha vira perda do oponente | lifegain + pagamento (Sanguine Bond) | fonte de lifegain, pagamento |
| 12 | **Landfall** | cada terreno gera valor/dano/fichas | ≥8 gatilhos de landfall, terreno extra | terreno extra, fetch, pagamento de landfall |
| 13 | **Terrenos do cemitério (lands)** | reusar terrenos e ganhar com eles (Field of the Dead, Dark Depths) | jogar terreno do cemitério, Crucible, Ramunap, terreno que vira ameaça | recursão de terreno, fetch/sacrifício, terreno-ameaça |
| 14 | **Blink / ETB** | repetir "quando entra" | comandante ou ≥8 cartas de blink | blink barato, criatura com ETB forte |
| 15 | **Enchantress / artefatos (valor por tipo)** | comprar e gerar a cada aura/artefato | motor por tipo no comandante | motor de compra, permanente barato do tipo |

### C. Mágicas
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 16 | **Spellslinger** | gatilhos de instantânea/feitiço | ≥25 instant/sorcery; magecraft/prowess | mágica barata, redutor, cópia |
| 17 | **Storm / turno explosivo** | um turno com muitas mágicas | storm, rituais, recompra | ritual, redutor, recursão de mágica |
| 18 | **Turnos extras** | encadear turnos extras | ≥4 turnos extras | turno extra, recursão, cópia |
| 19 | **Fireball / mágica X** | rampar muito e ganhar com uma mágica X enorme | ≥4 mágicas X que causam dano/drenam; mana alta | ramp grande, mágica X, dobrador de mana |

### D. Cemitério
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 20 | **Reanimador** | pôr coisa grande no cemitério e trazer de volta | reanimação + descarte/mill próprio | enchedor, reanimação barata, alvo grande |
| 21 | **Valor do cemitério (self-mill)** | jogar a partir do cemitério | flashback/escape/dredge, comandante lê o cemitério | moer a si mesmo, recursão |
| 22 | **Mill (oponentes)** | esvaziar o grimório deles | mill em massa | moedor, multiplicador, defesa |

### E. Controle
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 23 | **Controle (draw-go)** | responder a tudo e ganhar tarde | contramágicas + remoção + limpa-mesa ≥15 | resposta barata, compra, 1–3 finalizadores |
| 24 | **Limpa e reconstrói** | limpar a mesa sempre e sobreviver melhor que todos | ≥5 limpa-mesas + proteção/indestrutível/permanentes que voltam | limpa-mesa, proteção própria, recursão, motor que não é criatura |
| 25 | **Stax / trava** | impedir os oponentes de jogar | ≥6 cartas de stax/imposto | trava assimétrica, peças baratas |
| 26 | **Destruição de terrenos (MLD)** | deixar os oponentes sem mana | Armageddon, destruição repetida de terreno | destruição de terreno, ramp que sobrevive (artefato), recuperação |
| 27 | **Roubo (theft)** | ganhar com as cartas dos oponentes | ≥6 roubar/clonar o que é deles | roubo, cópia, sacrificar o roubado |
| 28 | **Punir mão (wheel/descarte)** | castigar quem compra/descarta | wheel + pagamento por compra/descarte | wheel, pagamento, descarte |

### F. Mesa e política
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 29 | **Goad / política** | fazer os oponentes se atacarem | goad, monarca, iniciativa, votação | goad, monarca, compra |
| 30 | **Pillow fort** | não ser atacado e ganhar devagar | imposto de ataque (Propaganda, Ghostly Prison), névoa, proteção | imposto de ataque, encantamento defensivo, finalizador que não ataca |
| 31 | **Group hug** | ajudar todos (mana, cartas) e ganhar com o que sobra ou com o pagamento escondido | "each player draws/adds", comandante simétrico | carta simétrica que favorece você, pagamento |
| 32 | **Caos** | mesa imprevisível (trocar, aleatório) em que só você está preparado | "at random", trocar controle, rolar dado/moeda | caos que você aproveita, proteção |
| 33 | **Superamigos (planeswalkers)** | vários planeswalkers e o ultimate | ≥10 planeswalkers, proliferar | planeswalker, proteção, proliferar |

### G. Vitória direta
| # | Plano | Como ganha | Sinais | O que pesa mais |
|---|---|---|---|---|
| 34 | **Combo infinito** | 2–3 cartas que juntas geram infinito e ganham | pares conhecidos (Commander Spellbook), tutores | peças do combo, tutor, proteção do combo |
| 35 | **Vitória alternativa** | carta que diz "você ganha o jogo" (Thassa's Oracle, Approach, Coalition Victory) | texto "you win the game"/"loses the game" | a carta de vitória, como chegar na condição, proteção |
| 36 | **Toolbox / cadeia de tutor** | buscar a peça certa para cada situação | Birthing Pod, tutores de criatura, Recruiter, comandante que busca | tutor repetível, peças de 1 cópia para cada resposta |

"Big mana" (rampa para coisa grande) entra como **secundário** de qualquer um: é o meio, não o fim.

Fora da lista (são **temas**, não planos): tribo, artefatos, encantamentos, marcadores +1/+1, fichas, ganho de vida. Cada um serve a 1–2 planos (ex.: marcadores → voltron ou ir largo; tribo → ir largo ou aggro). Landfall, lands e blink viraram plano (12–14) porque ganham por gatilho repetido.

"Pilha de cartas boas" (sem plano claro) é resposta válida: mostra o aviso que já existe na aba Plano.

## Decisão EDHREC (pendência 3) aplicada
- Nenhum sinal acima depende do EDHREC: só oracle, tipos e tags do Scryfall (e o Forge para o motor). Se ele aprovar "dado próprio + Scryfall", a T04 já está pronta assim.
- O `EDH_TEMA` (páginas de tema do EDHREC) fica só como comparação local, nunca no site.

## Próximo (T05)
Gabarito: banco amplo de decks com o plano marcado à mão (não os 4 exemplos), para medir quantos `planoDe` acerta.

## Para o Felipe decidir
- ✔ Lista aprovada 23/11: combo × vitória alternativa separados + 8 arquétipos novos (trapaça, tempo, toolbox, MLD, pillow fort, lands, limpa e reconstrói, mágica X) = 36.
- ✔ Principal + secundário (decidido 23/11).
