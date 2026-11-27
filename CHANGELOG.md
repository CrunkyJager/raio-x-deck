# Changelog — Raio-X do Deck

Versão `v0.MENOR.CORREÇÃO` até o beta (T42). MENOR sobe a cada entrega que entra na main (bloco do banco, passo da estrutura, tarefa do roadmap); CORREÇÃO sobe em conserto sem função nova. Cada versão tem tag no git. Como entra: ramo do adepto → `integracao` (CI) → `main` + tag (só o coordenador). Detalhe do dia a dia em `planejamento/diario.md`.

## v0.70.0 — 27/11/2026 · Motor joga 1755 das 1756 cartas inteiras (lotes A, B, C, D, F, G, H, I, rodada 3)
Testes: check 0 erros · Vitest 541/541 · partida Stangg igual à linha de base (26.5 | 29.5 | 7.0 | 36.0 | turno 8.7 | erros 0) · banco valida 0 erros. Motor joga inteiras **1755/1756** (eram 1751). Selo ⓘ da Mesa atualizado.
- Cartas novas na Mesa: Semblance Anvil, Chandra's Ignition, Champions of Minas Tirith, Cloud's Limit Break (custo por modo), Angel of Jubilation (proíbe pagar vida/sacrificar), Baleful Mastery, Gluntch, Cyclone Summoner ("se conjurou da mão"), Gitaxian Probe, Ghyrson Starn, Mox Amber, Myriad Landscape, Nim Deathmantle, Overlords (iminente), Platinum Angel, Tiamat, The First Sliver (cascata), The Master Transcendent, Timestream Navigator (turno extra), Thassa's Oracle e outras.
- Onde dois adeptos fizeram a mesma coisa ficou uma versão só: monstruosidade, Baleful Mastery, Platinum Angel, Cloud Key, turno extra, Thunderherd Migration.
- Para testar: aba Mesa → qualquer deck; o selo ⓘ deve mostrar 1755/1756.

## v0.69.0 — 27/11/2026 · Motor joga 1751 das 1756 cartas inteiras (lotes A, B, C, D, F, G + contagens)
Testes: check 0 erros · Vitest 482/482 · partida Stangg igual à linha de base (26.5 | 29.5 | 7.0 | 36.0 | turno 8.7 | erros 0) · banco valida 0 erros. Motor joga inteiras **1751/1756** (eram 1714). Selo ⓘ da Mesa atualizado.
- Cartas que tinham "falta" completadas pelos adeptos (A, G, F): custo alternativo com parte física (Force of Will, Sephara, Flare of Fortitude), tumulto (Rhythm of the Wild), intimidar, mana de "cada cor entre suas permanentes" (Faeburrow Elder, Bloom Tender), monstruosidade, Portador do Anel nas condições, "cartas compradas / vida perdida no turno", Omnath (resoluções da habilidade no turno), delve não exila os alvos.
- Onde dois adeptos fizeram a mesma coisa ficou uma versão só (miríade, corpo-a-corpo, explorar, resoluções no turno).
- Para testar: aba Mesa → qualquer deck; o selo ⓘ deve mostrar 1751/1756.

## v0.68.0 — 27/11/2026 · Motor: mais ~40 mecânicas e formato único de contagem (adeptos A, B, C + coordenador)
Testes: check 0 erros · Vitest 423/423 · partida Stangg igual à linha de base (26.5 | 29.5 | 7.0 | 36.0 | turno 8.7 | erros 0) · banco valida 0 erros. Motor joga inteiras **1714/1756** (eram 1619). Selo ⓘ da Mesa atualizado.
- **Contagens numa conta só** ("de onde + o quê + como junta"), pedido do Felipe: cada carta nova não cria mais um nome de contagem.
- Mecânicas novas para ver na Mesa: corpo-a-corpo, explorar, persistir, pós-vida, miríade, eco, bis, eternizar, mentor, prole, incitar, vigiar, tentar o Anel, mover marcador; entrar como cópia (Clone e parecidas); "sacrifique Comidas ao entrar" (Feasting Hobbit); "vire/desvire até N" (Myr Battlesphere, Snap); mana que só serve para mágica (Klauth); gatilho "1ª mágica do oponente no turno" (Esper Sentinel); custo alternativo dado por outra permanente (Rooftop Storm, Bolas's Citadel); impostos ao mirar.
- Para testar: aba Mesa → jogue com um deck que tenha essas cartas; o selo ⓘ mostra quantas o motor joga inteiras.

## v0.67.1 — 27/11/2026 · Conserto do login (Meus decks)
- **Entrar com Google** deve funcionar agora também no celular e no Safari. Antes o botão esperava baixar o Firebase e só depois abria a janela do Google; o navegador via isso como janela "sem clique" e bloqueava, e a reserva (ir e voltar pela página do Google) não funciona com o site no github.io. Agora o Firebase carrega quando o bloco "Meus decks" aparece na tela, e o clique abre a janela na hora. Se o navegador ainda bloquear, aparece o aviso para clicar de novo ou liberar pop-ups.
- Para testar: aba Lista → Meus decks → Entrar com Google (ou com e-mail) → cole uma lista → Salvar → abra o site em outro navegador/PC e entre: o deck está lá.

## v0.67.0 — 27/11/2026 · Motor: mais 26 mecânicas (adeptos A, B, C + coordenador)
Testes: check 0 erros · Vitest 412/412 · testa 161/161 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1619/1756 (eram 1573). Selo ⓘ da Mesa atualizado.
- Mecânicas novas: popular, tentar o Anel, mover marcador, vigiar, anexar, explorar, turno extra, mentor, prole, tripular e outras da lista do T43 (detalhe nos commits `T43:` do dia).
- Variações de efeitos que já existiam: mover aleatório (Tomb Tyrant), revelar o topo (Descendants' Path), "compre duas no lugar de uma" (Bard, King of Dale), contar cores entre permanentes, deuses de Theros, tipos de terreno ganhos (Yavimaya, Ashaya).
- Pendente: reestruturar as contagens (hoje um nome por caso) numa conta só de "de onde + o quê + de quem".

## v0.66.0 — 27/11/2026 · Motor: 11 mecânicas (4 adeptos em paralelo)
Testes: check 0 erros · Vitest 395/395 · testa 161/161 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1573/1756 (eram 1539). Selo ⓘ da Mesa atualizado.
- **Tempestade** (702.40): Grapeshot, Empty the Warrens, Brain Freeze, Flusterstorm, Radstorm. Conta as mágicas de todos os jogadores no turno.
- **Ciclo de tipo** (702.29e): Step Through, Homing Sliver e outras.
- **Regenerar** (701.15): escudo que troca destruir/dano letal por virar + tirar o dano + sair do combate, só no turno; respeita "não pode ser regenerada".
- **Amassar** (701.47): Orcish Bowmasters, Dreadhorde Invasion, Lazotep Plating e outras.
- **Esconderijo**, **deuses de Theros** (deixam de ser criatura com pouca devoção), **comprar/criar fichas com quantidade calculada** (Windfall, Peer into the Abyss, Chasm Skulker, Elenda), **tipo escolhido** (Metallic Mimic, Yavimaya), **custo alternativo** (Bolas's Citadel, Rooftop Storm), **modificar** (Liliana Death's Majesty, Rivaz).
- Simplificações anotadas: deus que deixa de ser criatura em combate não sai do combate (506.4); custo alternativo por vida só da carta do topo.

## v0.65.0 — 27/11/2026 · Motor: ascender
Testes: check 0 erros · Vitest 388/388 · testa 161/161 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1539/1756 (eram 1535). Selo ⓘ da Mesa atualizado.
- **Ascender / bênção da cidade** (CR 702.131): Ocelot Pride, Radiant Destiny, Twilight Prophet, Wayward Swordtooth e outras. Com 10 permanentes e uma com ascender, o jogador ganha a bênção e fica com ela até o fim.
- Conserto: antes a bênção vinha com 10 permanentes mesmo sem nenhuma carta com ascender.

## v0.64.0 — 27/11/2026 · Motor: gatilho de moer
Testes: check 0 erros · Vitest 387/387 · testa 161/161 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1535/1756 (eram 1530).
- **"Sempre que um jogador moer uma carta"** (CR 701.13): Glowing One, Infesting Radroach (volta do cemitério), Mirelurk Queen, Screeching Scorchbeast (uma vez pelo lote, tantas fichas quantas cartas não-terreno) e The Wise Mothman. Carta que uma substituição manda para outra zona não conta como moída.
- Simplificação: The Wise Mothman dispara uma vez por carta, com um alvo cada (a carta real é uma vez pelo lote com até X alvos).

## v0.63.0 — 27/11/2026 · Motor: sobrecarga
Testes: check 0 erros · Vitest 386/386 · testa 161/161 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1530/1756 (eram 1525).
- **Sobrecarga** (CR 702.96): Cyclonic Rift e as outras de um alvo. Com mana para o custo de sobrecarga, a Mesa pergunta normal ou sobrecarga; na sobrecarga não tem alvo e o efeito vale para cada objeto que o alvo aceitaria. Sem mana, nem pergunta.

## v0.62.0 — 27/11/2026 · Conta e Meus decks na nuvem
Testes: check 0 erros · Vitest 385/385 · partida Stangg igual à linha de base (erros 0) · navegador: criar conta → salvar → entrar em outro navegador → abrir → apagar ok; sem login o banco recusa (403).
- **Meus decks** (aba Lista): entrar com Google ou com e-mail e senha, salvar o deck com nome e abrir em qualquer PC. Firebase, como no Grimório Arena. Cada pessoa só vê os próprios decks.

## v0.61.0 — 27/11/2026 · X1 online (Mesa ao vivo)
Testes: check 0 erros · Vitest 385/385 · partida Stangg igual à linha de base (erros 0) · `mesa-nova.mjs 7 --x1` IGUAIS · `x1-navegador.py`: partida inteira entre duas janelas, 21 turnos, telas IGUAIS.
- **Jogar com amigo**: cada um no seu PC. O anfitrião cria a sala e manda o link, e o amigo entra com o deck dele. Só as escolhas passam pela rede e as duas telas refazem a mesma partida. Desfazer fica desligado no X1.
- Conserto: clicar num exemplo antes da análise carregar não fazia nada; agora avisa e roda quando ela chega.

## v0.60.0 — 27/11/2026 · Motor: destruir sem regenerar
Testes: check 0 erros · Vitest 385/385 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1525/1756 (eram 1520). Ivora e Masmorras: 20 partidas cada, 0 erros.
- **"Não pode ser regenerada"** (CR 701.15c): Terminate, Putrefy, Pongify, Rapid Hybridization, Artifact Mutation. O motor ainda não tem regenerar, então a destruição já era definitiva; o campo agora é aceito. Quando regenerar entrar, tem que respeitar este campo.

## v0.59.0 — 27/11/2026 · Motor: copiar mágica
Testes: check 0 erros · Vitest 384/384 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1520/1756 (eram 1514). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste de cópia: 40 partidas, 0 erros (Zada copiando Shock no registro).
- **Copiar mágica** (CR 707.10): Zada, Dualcaster Mage, Naru Meha, Archmage of Echoes, Reflections of Littjara, Bygone Marvels. A cópia leva modo, X, alvos e chute da original, é de quem copiou e não conta como conjurada (não dispara a Zada de novo). Pode trocar os alvos (mesmo número). Some ao sair da pilha; cópia de permanente entra como ficha (608.3f).

## v0.58.0 — 27/11/2026 · Motor: convocar
Testes: check 0 erros · Vitest 382/382 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1514/1756 (eram 1508). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste de convocar: 20 partidas, 0 erros (March of the Multitudes com X=4).
- **Convocar** (CR 702.51): Hour of Reckoning, March of the Multitudes, Lethal Scheme, Clever Concealment, Collective Inferno. Cada criatura sua desvirada que vira paga {1} ou uma mana da cor dela; primeiro as que não dão mana. Wildfire Awakener ainda trava em outro gatilho.

## v0.57.0 — 27/11/2026 · Motor: dano fora do combate é evento; "quando esta receber dano"
Testes: check 0 erros · Vitest 381/381 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1508/1756 (eram 1502). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste de Dinossauros: 20 partidas, 0 erros, enrage disparando.
- **Conserto:** dano de mágica/habilidade (Lightning Bolt, Impact Tremors, Pyroclasm) não gerava o evento de dano; só o de combate. Os gatilhos "sempre que causar dano" de 86 cartas não viam esse dano.
- **"Sempre que esta receber dano"** (enrage): Ripjaw Raptor, Apex Altisaur, Wrathful Raptors, Spiteful Sliver, Strong, Metropolis Reformer. No combate, várias fontes ao mesmo tempo disparam uma vez só.

## v0.56.0 — 27/11/2026 · Motor: gatilho "sai do seu cemitério"
Testes: check 0 erros · Vitest 380/380 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1502/1756 (eram 1496). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste do Syr Konrad: 20 partidas, 0 erros.
- **"Sempre que uma ou mais cartas saírem do seu cemitério"**: Syr Konrad, Teval, Teval's Judgment, Kheru Goldkeeper, Kishla Skimmer, Insidious Roots. "Uma ou mais" dispara uma vez pelo grupo; carta do cemitério do oponente não conta.

## v0.55.0 — 27/11/2026 · Motor: fases de combate extras
Testes: check 0 erros · Vitest 379/379 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1496/1756 (eram 1490). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste da Aurelia: 20 partidas, 45 fases extras, 0 erros.
- **Fase extra** (CR 500.8): Aurelia, Combat Celebrant, Genji Glove, Karlach, Moraug, Aggravated Assault (combate + principal logo depois da principal em que foi ativada). Várias na fila: a criada por último vem primeiro.
- Condições "se for o primeiro combate do turno" e "se for a sua fase principal". Tifa ainda falta o "corpo-a-corpo".

## v0.54.0 — 27/11/2026 · Motor: "escolha um tipo de criatura / uma cor"
Testes: check 0 erros · Vitest 377/377 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1490/1756 (eram 1483). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste com as 7 cartas: 20 partidas, 26 escolhas, 0 erros.
- **Escolher na resolução** (op escolher): Kindred Dominance, Kindred Judgment, Raise the Palisade, Distant Melody, Pact of the Serpent, Patriarch's Bidding, Mother of Runes (proteção da cor escolhida). As opções de tipo são os tipos de criatura que existem na partida; a IA escolhe o tipo de que mais tem (no campo pesa 2).
- Changeling conta como do tipo escolhido (também no Morophon/Herald's Horn).

## v0.53.0 — 27/11/2026 · Motor: gatilho "sacrificado"
Testes: check 0 erros · Vitest 376/376 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1483/1756 (eram 1477). Ivora e Masmorras: 20 partidas cada, 0 erros; deck de teste da Carmen: 20 partidas, 30 disparos de "sacrificado", 0 erros.
- **Gatilho "sacrificado"** (CR 701.21): Tireless Tracker, Captain Lannery Storm, Carmen, Rapacious Guest, Nuka-Cola Vending Machine, The Sackville-Bagginses (Mirkwood Bats ainda falta o "ficha criada"). Vale para sacrifício como custo (Pista, Tesouro, Comida, altar), como efeito (édito), "a menos que sacrifique", masmorra e saga que termina (714.4). Olha para trás (603.10a): a Carmen sacrificada também dispara. Morrer sem sacrificar não conta.
- **Mesa:** selo ⓘ das cartas que o motor não joga inteiras em dia (estava atrasado desde a v0.52.0).

## v0.52.0 — 27/11/2026 · Motor: jogar do topo, ganhar o controle, marcador posto
Testes: check 0 erros · Vitest 374/374 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1477/1756 (eram 1453). Ivora e Masmorras: 20 partidas cada, 0 erros.
- **Jogar do topo do grimório** com permissão (Courser of Kruphix, Oracle of Mul Daya, Mihail, Realmwalker, Verge Rangers, Mystic Forge, Summoning Materia, Case of the Locked Hothouse): antes a cobertura contava como lido e o motor não jogava. A Mesa mostra "topo: carta" no seu grimório quando você pode olhar.
- **Mesa:** terreno do cemitério/topo aparecia como "Baixar X (outra face)"; agora "Baixar X (do cemitério)" / "(do topo do grimório)".
- **Ganhar o controle** (camada 2, CR 613.1b): até o fim do turno (Zealous Conscripts), para sempre (Sliver Overlord, Captivating Vampire), enquanto você controlar a fonte (Roil Elemental, Yuffie); muda de lado com enjoo e sai do combate.
- **Conserto:** filtro "controlado pelo jogador do evento" valia para qualquer jogador (Hellkite Tyrant pegaria os artefatos de todos; Balefire Dragon acertaria todas as criaturas).
- **Gatilho "marcador posto"** (CR 122.6): Simic Ascendancy, Fathom Mage, Exemplar of Light, Shalai and Hallar, All Will Be One, Benthic Biomancer, Evolution Witness. Proliferar agora põe pelo mesmo caminho (Doubling Season dobra).

## v0.51.0 — 27/11/2026 · Motor: camada 7b, modificada, monarca-alvo, gatilho de mana
Testes: check 0 erros · Vitest 370/370 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1453/1756 (eram 1444). Masmorras: 20 partidas, 0 erros.
- **Sephiroth:** filtro "modificada" (CR 700.9: marcador, Equipamento ou Aura sua) e P/R base fixado até o fim do turno (camada 7b, 613.4b); o +X da 7c soma por cima.
- **Éomer:** "jogador-alvo vira o monarca"; a IA escolhe a si mesma. **Faramir:** gatilho "se você é o monarca" (603.4).
- **Gatilho de mana ao virar terreno** (CR 605.1b, sem pilha): Wild Growth, Fertile Ground, Regal Behemoth, Mirari's Wake; o pagamento automático conta a mana a mais.

## v0.50.0 — 26/11/2026 · Motor: efeitos temporários, monarca, emblemas e o pedido do Edigar
Testes: check 0 erros · Vitest 367/367 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1444/1756 (eram 1400). Ivora e Masmorras: 30 partidas cada, 0 erros.
- **Pedido do Edigar:** marcador +1/+1 separado do bônus de lorde na Mesa; a Mesa não pergunta a ordem dos gatilhos quando a ordem não muda nada (CR 701.9a, 603.3b); "vai ao cemitério de qualquer lugar" dispara vindo da mão/grimório (Kozilek, Ulamog).
- **Aviso de versão nova:** aba aberta com site antigo mostra "Saiu uma versão nova… Recarregar".
- **Efeito temporário:** substituição de dano, terra extra, mão máxima, conjurar com lampejo, não pode conjurar, antimagia de jogador, dano não prevenível (Bonecrusher), gatilho e estática contínua em emblema (Chandra, Daretti, Sorin), flashback dado no cemitério (Past in Flames).
- **Monarca** (CR 724), modo escolhido ao entrar (Sieges), Lightning, Army of One, Mortarpod (arma viva), modificar até o seu próximo turno / enquanto no campo, Hellkite Courser (devolve o comandante à zona de comando).

## v0.49.1 — 26/11/2026 · Conserto: tutor para o topo; "se você a conjurou"
Testes: check 0 erros · Vitest 348/348 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1400/1755 (eram 1390). Ivora e Masmorras: 0 erros.
- **Conserto (entrou na v0.49.0):** buscar para o grimório (Mystical Tutor, Enlightened Tutor…) perdia o "pôr no topo"; o pulo era do cavar (Thassa's Oracle). Caso novo pega o erro.
- **Filtros conjurada e atacouNoTurno:** The One Ring, Tiamat, Zacama, Cyclone Summoner, Wedding Ring, Cacophony Unleashed, Wakening Sun's Avatar, Riders of the Mark jogam inteiras.
- **magiasNoTurno** (de quem conjurou): Aetherflux Reservoir inteira.

## v0.49.0 — 26/11/2026 · T46: fila automática (planilha → PC → claude -p) e vitória por efeito
Testes: check 0 erros · Vitest 345 (0 falhas) · valida 1755 cartas, 0 erros · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1390/1755 (eram 1385).
- **Fila automática** (T46): o web app da planilha liberado; o trabalhador pega o pedido, escreve as cartas e grava a resposta. 1º pedido real: Aetherflux Reservoir e Thassa's Oracle.
- **Vencer/perder o jogo por efeito** (CR 104.2b, 104.3e): ganharJogo e perderJogo estavam no esquema mas o motor não fazia; agora jogam Thassa's Oracle, Triskaidekaphile, Simic Ascendancy, Hellkite Tyrant, Halo Fountain, Twenty-Toed Toad.
- **Comparar duas contagens** na condição (min/max/igual aceitam contagem) e contagem **cartasNoGrimorio**: devoção a azul ≥ cartas no grimório. Cavar aceita destino grimório (fica no topo).

## v0.48.0 — 26/11/2026 · Motor: perda de vida, alvo de jogador, descobrir e mana restrita
Testes: check 0 erros · Vitest 344/344 · partida Stangg igual à linha de base (erros 0). Motor joga inteiras 1385/1753 (eram 1371). Partidas: deck de drenar vida (Vito, Sanguine Bond, Exquisite Blood, Mindcrank, Vilis, Blood Artist) 20, 0 erros.
- **Perder vida vira evento** (CR 119.3): dano em jogador, "perde N de vida" e pagar vida (119.4) disparam Mindcrank, Exquisite Blood, Vilis, The Master of Lake-town. "That much" lê quanto ganhou ou perdeu (Sanguine Bond, Vito, Prize Pig, Wedding Ring, Treebeard, Well of Lost Dreams). Sanguine Bond + Exquisite Blood mata o oponente e o laço para.
- **"Jogador alvo" escolhe o alvo**: antes o alvo não era escolhido e o efeito sumia, em 17 cartas (Blood Artist, Hedron Crab, Diregraf Captain, Liliana of the Veil, Jace Beleren, Priest of Forgotten Gods…).
- **Descobrir N** (CR 701.57) e Tecutlan; **mana restrita** na reserva (CR 106.6): Master of Dark Rites e Unclaimed Territory só pagam a mágica que bate. Ramos ganha um +1/+1 por cor.

## v0.47.0 — 26/11/2026 · T44: a análise lê o banco próprio
Testes: check 0 erros · Vitest 337/337 · testa 161/161 · partida Stangg igual à linha de base (erros 0) · build ok. Banco de 30 decks (200 partidas por troca): T44 −0,04 ±0,20 contra a main de hoje −0,39 ±0,19; deck a deck +0,40 ±0,32 a favor da T44 (melhor em 15, pior em 8, de 27).
- **O que cada carta faz vem de `banco/cartas`** (`src/analise/banco.ts`): ramp, compra, remoção, limpa-mesa, proteção, contramágica, recursão, tutor, fichas, e os detalhes que pesam no efetiv (repete, na hora, quantas cartas, só um lado da mesa, o oponente pode pagar). A regex no inglês e as etiquetas do Scryfall ficam só para carta sem dado.
- Medida em lotes de 10 e com dois ramos lado a lado (`banco_mesa.py` com LOTE e PORTA). Resultados em `ferramentas/calibra/banco_t44.json` e `banco_hoje46.json`.
- Achado para depois: tirar o Mindcrank do Wise Mothman custa −3,6 nas duas versões; o motor nem jogava o Mindcrank (o conserto está no ramo `perde-vida`).

## v0.46.1 — 26/11/2026 · Mesa ao vivo: perguntas que apareciam com o nome interno
Testes: check 0 erros · Vitest 297/297 · build ok.
- Ganharam título e botões em português: quem a criatura que entra atacando ataca, custo adicional com "ou" (ex.: "Sacrificar 1 artefato" / "Descartar 1 carta"), conjurar com chute/presente, para qual oponente vai o presente, conjurar agora (de graça), dividir o dano, ordem do dano ("X recebe o dano primeiro"), devolver à mão como custo, exilar do cemitério (fuga).
- Custo de sacrificar/descartar: "Sacrificar Grizzly Bears" no lugar de "sacrificar: Grizzly Bears".

## v0.46.0 — 26/11/2026 · Mana com escolha no custo: altares, Krark-Clan, Steam-Kin, Simian Spirit Guide
Testes: check 0 erros · Vitest 297/297 · raiox-testes igual à linha de base. Motor joga inteiras 1371/1753 (eram 1363). Partidas: deck de altares 40, Ivora 40, masmorras 40, 0 erros.
- **Nova ação de mana com pergunta** (CR 605.3a, sem pilha): sacrificar outra (Ashnod's Altar, Phyrexian Altar, Krark-Clan Ironworks, Skirk Prospector, Phyrexian Tower, Gilded Goose com Food), tirar marcadores (Runaway Steam-Kin) e exilar da mão (Simian Spirit Guide). Fica fora do pagamento automático, para nunca sacrificar sem querer; na Mesa ao vivo aparece junto dos botões de mana e pergunta o que sacrificar.
- Seguem de fora: Master of Dark Rites (mana só para Vampire/Cleric/Demon: a reserva ainda não guarda restrição) e Ramos (falta "marcador.qtd").
- A IA ainda não usa essa ação (T21); só o jogador.

## v0.45.0 — 26/11/2026 · Ivora 75/75 e masmorras 83/83 inteiras: 15 mecânicas novas
Testes: check 0 erros · Vitest 294/294 · raiox-testes igual à linha de base. Motor joga inteiras 1363/1753 (eram 1361). Partidas: Ivora 40 e masmorras 40, 0 erros (registro mostra milagre, cópia preparada, "não pode procurar").
- **Custos:** custo adicional com "ou" (Demand Answers: sacrificar artefato ou descartar); rondar (Knowledge Exploitation); prever, ação especial com {2} e conjurar do exílio num turno seguinte (Skull Raid); ninjutsu da mão (Prosperous Thief).
- **Gatilhos e durações:** gatilho reflexo "quando você fizer isso", com alvo escolhido depois (Inti); "até o seu próximo passo final"; milagre (Reforge the Soul); "você desceu neste turno" (Brass's Tunnel-Grinder); "criatura ferida por esta neste turno morre" (Markov Enforcer).
- **Permanentes:** Role, ficha Aura com estática e gatilho, só o Role mais novo fica (Witch's Mark, Monstrous Rage); reconfigurar (Lizard Blades); "exilada com este" (Bag of Holding); preparar, com cópia da mágica no exílio (Pompous Battlemage); loucura dada às cartas fora do campo (Falkenrath Gorger); oponentes não procuram no grimório (Ashiok); um terço da vida arredondado para cima (Dire Fleet Ravager); buscar no grimório do oponente e conjurar de graça.
- **Conserto:** Edgar Markov's Coffin nunca transformava (tirava os marcadores antes de conferir os 3). Corrigido, com caso.
- Decks: **Ivora no banco 75/75 · motor joga 75/75 · inteiras 75/75.** **Masmorras 83/83 · 83/83 · 83/83.** Ainda fica `falta` no verso de Brass's Tunnel-Grinder (Tecutlan: descobrir ao gastar a mana dele).
- A IA ainda não usa prever, ninjutsu nem reconfigurar (fica para a T21); o motor aceita as jogadas e os testes cobrem.

## v0.44.0 — 26/11/2026 · Ivora 65/75 inteiras: fuga, gatilhos novos, "outro", descartadas no turno
Testes: check 0 erros · Vitest 278/278 · raiox-testes igual à linha de base. Partidas: Ivora 40, 0 erros (o registro mostra "fuga: exila 8 do cemitério").
- **Fuga** (Ox of Agonas foge com +1/+1; Underworld Breach dá fuga a toda mágica do seu cemitério pelo custo dela + exilar 3).
- **Gatilhos novos:** quando você cicla (Magmakin Artillerist), quando desvira (Key to the City paga {2} e compra), quando joga terreno de fora da mão (Shadow of the Goblin), quando prolifera (Voidwing Hybrid volta do cemitério).
- **"Outro":** cada OUTRO oponente (Kediss), OUTRA criatura alvo (Markov Retribution), dano a jogador ou planeswalker (Neheb, The Reaver Cleaver).
- **Contas:** cartas descartadas neste turno (Change of Fortune, Misty Knight); Skull Raid compra a diferença; Grab the Prize só dá dano se a descartada não era terreno; Monument to Endurance não repete modo no turno.
- Decks: **Ivora no banco 75/75 · motor joga 75/75 · inteiras 65/75** (eram 51). Masmorras 83/83 · 83/83 · 78/83.

## v0.43.0 — 26/11/2026 · Ivora 75/75 no motor; "não pode ser anulada", Baylen, "para cada criatura", fichas atacando
Testes: check 0 erros · Vitest 272/272 · raiox-testes igual à linha de base. Motor joga inteiras 1361/1753 (eram 1345). Partidas: Ivora 40 e masmorras 40, 0 erros.
- **Library of Leng:** descarte por efeito pode ir ao topo do grimório, escolhido carta a carta; descarte como custo e na limpeza vai ao cemitério (ruling).
- **"Não pode ser anulada"** (12 cartas): a própria mágica (Dovin's Veto, Supreme Verdict, Void Rend…) ou as que um permanente protege (Rhythm of the Wild, Root Sliver, Destiny Spinner, Chimil).
- **Baylen:** mana virando duas fichas (só fichas sem mana própria, para não usar a mesma duas vezes). A cobertura agora confere o custo das habilidades de mana e mostra 10 que o motor ainda não paga: Ashnod's Altar, Phyrexian Altar, Krark-Clan Ironworks, Gilded Goose, Simian Spirit Guide, Runaway Steam-Kin…
- **"Para cada criatura/ficha…"** (Kalonian Hydra dobra os marcadores, Second Harvest copia cada ficha) e filtro "entrou neste turno" (Ocelot Pride).
- **Fichas viradas e atacando** (Hero of Bladehold, Brimaz, Hanweir Garrison, Mardu Ascendancy…); em "para cada oponente" cada uma ataca aquele jogador (Adeline, Ainok).
- Caso do banco da Undercity corrigido (CR 701.49b).
- Decks: **Ivora no banco 75/75 · motor joga 75/75 · inteiras 51/75.** Masmorras 83/83 · 83/83 · 77/83.

## v0.42.0 — 26/11/2026 · masmorras 83/83 no motor (as 8 travas)
Testes: check 0 erros · Vitest 267/267 · raiox-testes igual à linha de base. Motor joga inteiras 1345/1753 (eram 1299). Partidas de masmorras 40, 0 erros.
- **"Para cada oponente…" (`repetirCada`, jogador da vez `cadaAtual`):** Acererak, Braids, Tempt with Bunnies/Discovery, Echo of Eons, Field of Ruin, Dark Deal, Winds of Change, Kwain, Lobelia. O progresso por jogador sobrevive às perguntas. Braids: só quem não sacrificou perde 2 e você compra (o banco escrevia "sempre").
- **Corpse Cur** (filtro "com infectar"), **Demonic Gifts** (ganha "quando morrer, volta" até o fim do turno), **Dungeon Descent** e mais 7 (custo "vire uma criatura sua": Lathril, Kumena, Inalla, Galecaster, Azami, Cryptbreaker, The Shire), **Fifty Feet of Rope** e Junk Winder ("não desvira no próximo desvirar"), **Prosperous Thief** ("uma ou mais causam dano" = uma vez), **Ravenloft Adventurer** (morre → exílio com marcador hit; perda de vida pelas cartas com hit), Liesa e Blightsteel (substituição de morrer/ir ao cemitério), **Alora** (o gatilho do fim do turno lembra a criatura; se ela mudou de zona, não volta).
- Consertos de regra achados no caminho: marcador de palavra-chave dá a palavra-chave (122.1b: flying, indestructible…); "criatura sem voar morre" olha como ela estava ao morrer (Luminous Broodmoth não devolve mais a que voa).
- Decks: Ivora no banco 75/75 · motor joga 74/75 (Library of Leng) · inteiras 50/75. Masmorras no banco 83/83 · motor joga 83/83 · inteiras 77/83.
- Pendente: habilidade de mana com custo "vire outra" (Baylen) ainda não é usada pelo motor, e a cobertura não confere habilidades de mana.

## v0.41.0 — 26/11/2026 · Mesa ao vivo: mana quando quiser e lugar em forma de tapete
Testes: check 0 erros · Vitest 257/257 · Chrome headless sem erro na página.
- **Mana livre (Felipe 26/11: a Mesa indica, não limita):** com prioridade, botões "⚡ Mountain → {R}" viram a fonte e a mana fica na reserva até o fim da etapa (o texto mostra "Na reserva"). Fora da sua fase principal, a Mesa para sempre que você tem instantânea ou habilidade para usar, e diz em que etapa está. Prova no node: `ferramentas/mesa-mana.mjs`.
- **Tapete:** cada lugar tem campo de batalha, terrenos e uma coluna com vida, comando, exílio, grimório e cemitério (a última carta do cemitério aparece no fundo). Os lugares são espelhados para a zona de comando ficar no canto mais perto do meio da mesa, e os de cima têm o campo virado para o centro.
- **Fundo de cada lugar:** botão "fundo" escolhe uma imagem do computador (fica só neste navegador; clique direito tira).
- Conserto: erro de tipo da v0.40.0 que derrubou o CI.

## v0.40.0 — 26/11/2026 · substituições de verdade (entra com marcadores, fichas e marcadores dobrados, dano dobrado/prevenido)
Testes: check 0 erros · Vitest 257/257. Motor joga inteiras 1299/1753.
- **Contagem honesta:** a cobertura dava como "lida" qualquer substituição cujo nome aparecia no código; o motor só aplicava `entra` virada e `ganhaVida`. Agora o motor diz o que aplica (`M.substOk`): 50 cartas que contavam como inteiras sem funcionar (1313 → 1263).
- **Motor:** entra com N marcadores (Kalonian Hydra não morre mais como 0/0; X pago; os dados por outras: Arwen, Bramblewood), marcadores a mais/dobrados/impedidos (Hardened Scales, Doubling Season, Darksteel Angel), fichas dobradas e "mais uma" (Parallel Lives, Doubling Season, Queen Allenal, Bilbo), dano dobrado, pela metade, prevenido e "todo menos 1" (Gisela, Fiery Emancipation, Dolmen Gate, Temple Altisaur), e Withercrown (perde 1 de vida a menos que sacrifique a criatura; IA só sacrifica com vida baixa). 1263 → 1299.
- Decks: Ivora no banco 75/75 · motor joga 74/75 (Library of Leng: a substituição de descarte nunca funcionou) · inteiras 50/75. Masmorras 81/81 · motor joga 73/81 · inteiras 68/81. Partidas 40+40, 0 erros.

## v0.39.0 — 26/11/2026 · sessão de casa: Ivora e Ultron sem trava, masmorras no motor
Testes: check 0 erros · Vitest 253/253 · raiox-testes verde. Motor joga inteiras 1313/1753. Partidas no node: Ivora 50 e masmorras 50, 0 erros.
- **Ivora:** no banco 75/75 · motor joga 75/75 (inteiras 50/75; 25 com frase que o motor ainda pula). Anger, Brotherhood Regalia, Cool but Rude (Classe) e Clive (devoção). Corrigido "pode" + pagar que quebrava a repetição (Leaf-Crowned Visionary).
- **Ultron:** 0 travas (grupo na saída, metalcraft/coven/blessing, buscar "quantas quiser", afinidade, improvisar, custo alternativo).
- **Masmorras:** iniciativa (CR 727), aventurar nas 4 masmorras, completar, infectar + 10 venenos, Escolha um Antecedente; IA escolhe masmorra e sala por valor. Deck: no banco 81/81 · motor joga 72/81 (inteiras 67/81). Travam 9: Acererak, Corpse Cur, Demonic Gifts, Dungeon Descent, Fifty Feet of Rope, Prosperous Thief, Ravenloft Adventurer, Withercrown, Alora.
- Ferramenta `ferramentas/partida-deck.mjs` (partidas de um deck de lista, conta mecânicas no registro).

## v0.38.0 — 25/11/2026 · decks do Edigar: Ivora 71/75 no motor, masmorras no banco
Testes: valida 1753/0 · check 0 erros · Vitest 219/219 · testa 161/161 · verifica verde · build ok.
- **Motor (A):** jogar carta de outro lugar, lutar, modal em gatilho, recapitular, proeza, parceiro, gatilhos de/não de/a oponente, modificar até o fim do turno (Key to the City, Wedding Invitation, Witch's Mark), laço obrigatório (104.4b). Ivora: faltam Anger, Brotherhood Regalia, Cool but Rude e Clive.
- **Banco (B):** 69 cartas do deck de masmorras (81/81 no banco) e 28 casos de teste para o motor (iniciativa, masmorra, completou, infectar). O motor ainda não faz masmorra, iniciativa nem antecedente.
- Patch T44 (analise lê o banco) continua fora da main até a medida dos 30 decks.

## v0.37.1 — 25/11/2026 · textos da Mesa mais claros
Testes: check (motor) ok · Vitest 210/210.
- **Mesa:** a pergunta do comandante diz qual é a carta, e as opções dizem para onde ela vai ("Deixar no cemitério/exílio" × "Mandar de volta para a zona de comando"). Só a opção segura fica destacada. A regra da lenda diz qual fica e que a outra vai para o cemitério. A escolha de modo mostra o efeito de cada modo, e o botão "Recarregar motor" só aparece com `?dev=1`.
- **Planejamento:** `planejamento/CONTINUAR.md` (como retomar de casa ou amanhã) e as listas dos decks do Edigar em `planejamento/decks/`.

## v0.37.0 — 25/11/2026 · comandantes do Ultron funcionam (Ultra Magnus, Ultron, Arcee)
Testes: valida 1684/0 · check 0 erros · Vitest verde · testa 161/161 · verifica verde · build ok. Motor joga inteiras 1098/1684.
- **Motor (A):** gatilho atrasado (603.7), entrar atacando, resguardo, animar, tipo dado a esta, pagar genérico, ficha cópia e gatilho opcional.

## v0.36.0 — 25/11/2026 · Mesa rápida com muitas fichas; incolor, poder somado e histórico
Testes: valida 1684/0 · check 0 erros · Vitest 205/205 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 1022/1684.
- **Motor (A):** partida com centenas de fichas deixou de travar (Krenko: 34 s → 2,6 s); filtro incolor (Mystic Forge, Ugin); soma/maior poder (Ghalta, The Great Henge, Metalwork Colossus, Jhoira's Familiar, Mycosynth Golem); teste aleatório sem instabilidade.

## v0.35.0 — 25/11/2026 · motor joga sagas, fases e efeitos temporários (deck do Ultron)
Testes: valida 1684/0 · check 0 erros · Vitest 202/202 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 1004/1684.
- **Motor (A):** "a menos que" genérico (Smothering Tithe), efeito até o fim do turno (Teferi's Protection, Rogue's Passage), fasear, sagas com capítulos (Urza's Saga) e leitura do banco em lote.

## v0.34.0 — 25/11/2026 · deck do Ultra Magnus/Ultron inteiro no banco
Testes: valida 1684/0 · check 0 erros · Vitest 198/198 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 987/1684.
- **Banco (B, T20 blocos 34/35):** as 39 cartas do deck do Ultron que faltavam (Ultra Magnus, Ultron, Krang, Memnarch, Blightsteel Colossus, Darksteel Forge, Ishgard, Ugin, Cloud Key…), 39 casos; o deck inteiro (80) está no banco. Em 200 partidas, 199 sem erro; a outra foi lenta por causa das 1484 fichas do Krenko (desempenho do motor).
- Ainda não funcionam na Mesa: Urza's Saga, Teferi's Protection, Smothering Tithe, Unwinding Clock, Organic Extinction e outras (com o adepto A).

## v0.33.0 — 25/11/2026 · motor conta ataques e obriga bloqueio
Testes: valida 1645/0 · check 0 erros · Vitest 198/198 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 965/1645.
- **Motor (A, item 6c):** contas de atacantes, atacantes em você e ataques no turno (Mangara, Firemane, Alesha, Windbrisk, Faramir); bloqueio obrigatório (509.1c), que a IA cumpre; filtro "tipo em comum" (metamorfo conta como todos); mover a carta transformada (712.14a) e mover esta do cemitério/exílio (Ojer Taq, Ajani). Fundir (meld) ainda fica de fora.

## v0.32.0 — 25/11/2026 · deck da Ivora inteiro no banco; motor joga descarte, loucura e ciclar
Testes: valida 1645/0 · check 0 erros · Vitest 194/194 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 958/1645.
- **Banco (B, T20 blocos 32/33):** as 60 cartas do deck da Ivora que faltavam (Ivora, Insatiable Heir, Inti, Magmakin Artillerist, Containment Construct, Kozilek, Ulamog, Brallin, Neheb, Spider-Man…), 50 casos; o deck inteiro (75) está no banco. Lote decidido: correção 18 (descartadasNoTurno, ev nivel, outro alvo / outros oponentes) na fila do B.
- **Motor (A):** todo descarte passa por um só caminho e dispara `descarta` por carta e `descartaGrupo` pelo lote (efeito, custo e limpeza); fx descartar "até N"/"quantas quiser", conta das descartadas, "se fizer". Loucura (702.35): exílio e conjurar pelo custo de loucura, senão cemitério. Ciclar (702.29a). Mana na resolução (Path of the Pyromancer, Neheb). A IA descarta antes a carta de loucura e o terreno sobrando. Deck da Ivora: 37 de 60 jogam inteiras (ainda travam op jogar, modal em gatilho, classe, lutar, parceiro).

## v0.31.0 — 25/11/2026 · fichas com nome ganham habilidade (Treasure, Clue, Food, Blood…)
Testes: check 0 erros · Vitest 188/188 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 861/1585.
- **Motor (A):** fichas predefinidas (Treasure, Gold, Clue, Food, Blood, Powerstone, Lander, Shard; Map e Junk só com tipo). Antes saíam sem nome nem habilidade. O plano de mana usa Treasure, Gold e Lotus Petal; a IA quebra Clue/Food/Shard/Lander com mana sobrando e usa Blood para trocar terreno sobrando. Correção 17 lida: custo devolver, chute e presente na conjuração, alvo por opção.

## v0.30.0 — 25/11/2026 · Mesa ao vivo beta: filtro do registro, parar em gatilho/efeito e link ?beta=1
Testes: check 0 erros · Vitest 180/180 · testa 161/161 · verifica verde · build ok · Chromium headless (filtro, pausa, ?beta) sem erro no console.
- **Mesa ao vivo (A, T22 parte 2, pedido do usuário):** botões Mostrar (todos / ⚡ gatilho / ✧ efeito / ▲ camada / ⚙ habilidade); chave "parar em ⚡ gatilho / ✧ efeito" (desligada por padrão) que segura o replay e o você-joga até Continuar; `?beta=1` na URL liga o motor novo (beta), `?beta=0` desliga. Só no motor beta.

## v0.29.0 — 25/11/2026 · motor lê redução de custo e a fonte do dano; esquema do pente geral
Testes: valida 1585/0 · check 0 erros · Vitest 180/180 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 851/1585.
- **Motor (A):** redução de custo (601.2f) em mágicas e habilidades, inclusive símbolos coloridos (Morophon) e tipo escolhido (Herald's Horn); fx dano com `fonte` (o alvo ou o objeto do evento causa o dano, com toque mortífero e vínculo dele) e filtro `nome`.
- **Banco (B):** correção 17, o lote do pente geral (25 cartas): custo `devolver`, defensor (`atacado` no filtro), conta `atacantesEmVoce`, `deveBloquear`, alvo `opcao` (chute/presente), filtro `tipoEmComum`, `fundir` (Brisela, Mishra), mover `transformada`. O motor ainda não lê esses campos (próximos itens do A).

## v0.28.0 — 25/11/2026 · T20 fechada: banco cobre os 30 decks; motor lê ganho de vida e "descartar esta carta"
Testes: valida 1585/0 · check 0 erros · Vitest 173/173 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 825/1585.
- **Banco (B):** correção 16 (fx dano `fonte` e filtro `nome`: Chandra's Ignition, Warstorm Surge, Wrathful Raptors, Ingris, Dragon Tempest, Scourge of Valkas, Ancestral Anger, Wedding Ring). Pente geral: as 1538 cartas dos 30 decks do banco de teste estão todas no banco (T20 fechada); top 10 das faltas no pedidos-esquema.md.
- **Motor (A):** todo ganho de vida passa pelas substituições `ganhaVida` (Angel of Vitality, Bilbo, The Wind Crystal; somas antes dos dobros, 616.1); vínculo com a vida fora do combate dispara o evento. Custo `descartarEste` na habilidade da mão (canalizar: Shigeki, Ziatora's Proving Ground…).

## v0.27.0 — 25/11/2026 · banco completo da fila do Oracle (1585 cartas); motor rápido com fichas em massa
Testes: valida 1585/0 · check 0 erros · Vitest 169/169 (~28 s; era ~65 s) · testa 161/161 · verifica verde · build ok. Motor joga inteiras 827/1585.
- **Motor (A):** fichas em massa sem travar (índice do campo, lote e cemitério; a semente do fuzz com 13 mil Goblins caiu de 59 s para 5 s, partidas idênticas antes/depois); estáticas da própria ficha (`token.est`: Constructs, Gnome Soldier com P/R definido).
- **Banco (B):** correção 15 (custo `descartarEste`: Otawara, Shigeki, Trumpeting Carnosaur), bloco 30 (1451–1500) e bloco 31 (últimas 24 cartas, Wrenn and Seven … Éowyn). A fila do Oracle acabou.
- Ainda não lidos pelo motor: `ganhaVida`, `descartarEste` (próximos itens do A).

## v0.26.0 — 25/11/2026 · motor cava o topo do grimório; banco com 1511 cartas
Testes: valida 1511/0 · check 0 erros · Vitest 167/167 · testa 161/161 · partidas e lacunas = base · verifica verde · build ok. Motor joga inteiras 801/1511.
- **Motor (A):** `op cavar` (olhar/revelar do topo, até achar, destinos, resto no topo ou no fundo); sacrificar guarda o resultado (Empty the Laboratory); gatilho com alvo sem alvo declarado não joga. 7 casos (701.16).
- **Mesa ao vivo (beta):** a camada sai sem o nome repetido ("Elenda: 1/1 → 2/2").
- **Banco (B):** correção 12 (estáticas da própria ficha: 4 Constructs, Gnome Soldier), correções 13/14 (ganho de vida em substituição só no ganho: Angel of Vitality, Bilbo, The Wind Crystal), bloco 29 (1401–1450, 50 casos). Esquema: `token.est`, subst ev `ganhaVida`.
- Atenção: o Vitest leva ~65 s (era 18 s): uma semente do fuzz deixa o Krenko dobrar milhares de Goblins e o motor fica lento com fichas em massa. É o próximo item do motor.

## v0.25.0 — 25/11/2026 · banco com 1461 cartas (blocos 27/28, correção 11)
Testes: valida 1461/0 · check 0 erros · Vitest 160/160 · testa 161/161 · verifica verde · build ok. Motor joga inteiras 763/1461.
- **Banco (B):** bloco 27 (1301–1350, 50 casos), correção 11 (Mirrodin Besieged, Windcrag Siege, Struggle, Marisi, Taunt from the Rampart, Junk Winder, Tamiyo), bloco 28 (1351–1400, 50 casos: The One Ring, Ur-Dragon, Gitrog, Great Henge, Tireless Tracker…). Esquema: `modoEscolhido`, `incitar`, `naoDesvira`.
- **Mesa ao vivo (beta):** cobertura do motor novo refeita com o banco 1461.

## v0.24.0 — 25/11/2026 · Mesa ao vivo no motor novo (beta) e banco com 1361 cartas
Testes: valida 1361/0 · check 0 erros · Vitest 160/160 · testa 161/161 · partidas = base, erros 0 · verifica verde · build ok. Motor joga inteiras 713/1361.
- **Mesa ao vivo (A, T22 parte 1):** chave "Motor novo (beta)", desligada por padrão. Com ela ligada, a partida roda no motor novo com o banco próprio, e o registro mostra os gatilhos (⚡), os efeitos (✧), as camadas mudando P/R e palavras-chave (▲) e as habilidades (⚙). Dá para jogar você mesmo e continuar de onde parou. Cartas fora do banco jogam só o corpo (selo ⓘ).
- **Banco (B):** correção 9 (Scapeshift, Feasting Hobbit), bloco 26 (1251–1300, 50 casos), correção 10 (Soaring Lightbringer). Esquema: fx `porJogadorAtacado` na ficha.

## v0.23.0 — 25/11/2026 · banco com 1311 cartas
Testes: valida 1311/0 · check 0 erros · Vitest 160/160 · testa 161/161 · partidas = base, erros 0 · verifica verde · build ok. Motor joga inteiras 685/1311.
- **Banco (B):** correção 8 (Riders of the Mark com `atacouNoTurno`, Rivaz só do seu cemitério) e bloco 25 (1201–1250, 50 casos). Sem campo novo no esquema (sacrificar quantos quiser usa `ate: "qualquer"`).

## v0.22.0 — 25/11/2026 · camadas volta 2: equipar e habilidades dadas
Testes: valida 1261/0 · check 0 erros · Vitest 160/160 (20 s: fuzz com Equipamento) · testa 161/161 · partidas = base, erros 0 · verifica verde · build ok. Motor joga inteiras 660/1261 (eram 638).
- **Motor (A):** anexar/equipar (equipar = ativada na velocidade de feitiço, ações do estado 704.5m/n, `afeta 'equipada'`), habilidades dadas (gatilhos e ativadas que vêm de estáticas, LKI 603.10a). Consertado um O(n²) que deixava uma partida em 145 s.

## v0.21.0 — 25/11/2026 · banco com 1261 cartas
Testes: valida 1261/0 · check 0 erros · Vitest 153/153 · testa 161/161 · Stangg 26.5 / Krenko 29.5 · erros 0 · jogáveis 20/20 nos 4 decks · verifica verde · build ok. Motor joga inteiras 638/1261.
- **Banco (B):** bloco 23 (1101–1150) e bloco 24 (1151–1200), 50 casos cada; correção 6 (12 cartas do lote 22, Ponder certo) e correção 7 (6 cartas do lote 23).
- **Esquema (lotes 23 e 24):** fx `exceto` no sacrificar (escolhe N que ficam), filtros `moidaNoTurno` e `atacouNoTurno`, `naoPrimeira` também na subst.

## v0.20.0 — 25/11/2026 · camadas do motor (CR 613) e banco com 1161 cartas
Testes: valida 1161/0 · check 0 erros · Vitest 153/153 (15 s) · testa 161/161 · Stangg 26.5 / Krenko 29.5 · erros 0 · jogáveis 20/20 nos 4 decks · verifica verde · build ok. Motor joga inteiras 601/1161 (eram 488/1061).
- **Motor (A, camadas volta 1):** CR 613 camada 6 (palavras-chave dadas) e 7c (somar P/R) a partir das estáticas `continuo` no campo; `modificar` até o fim do turno com números presos na resolução (611.2c) e limpeza (514.2). Poder, resistência e palavras-chave passam pelas camadas; proteção e toque mortífero dados valem no combate. Lista de fontes guardada: Vitest em 15 s. Ferramenta `ferramentas/motor-cobertura.mjs`.
- **Banco (B):** bloco 21 (1001–1050) e bloco 22 (1051–1100), 50 casos cada; correção 5 (22 cartas com os campos dos lotes 17–21).
- **Esquema (lotes 21 e 22):** cond `fasePrincipal`, filtro `entrouNoTurno`, est `naoPodeAtivar` e `cores`, kw `intimidar` e `decaida`, fx `semRegenerar`, prop `maiorVm`, gat `naoPrimeira`, modos `aleatorio`.

## v0.19.0 — 25/11/2026 · banco com 1061 cartas
Testes: valida 1061/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 · erros 0 · jogáveis 20/20 nos 4 decks · verifica verde · build ok.
- **Banco (B):** bloco 19 (901–950, 50 casos: Living Death, Liesa, Luminous Broodmoth, Lotus Cobra…) e bloco 20 (951–1000, 50 casos: Meren, Mikaeus, Mirari's Wake, Mizzix's Mastery…).
- **Esquema (lotes dos blocos 17–20, regra ≥3 ocorrências):** cond `maisTerrenosOponente` e `primeiroCombate`, gat `recebe` (quem recebe o dano), gat ev `explora`, `ate` com contagem, fx mana `ficaNoTurno`; ficha com nome + P/R já cabia. O resto fica em `falta`. O motor ainda não lê esses campos (fila do A).

## v0.18.0 — 25/11/2026 · página toda em componentes Svelte (T43 d fechada)
Testes: valida 961/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · lacunas = base · verifica verde · build ok.
- **Estrutura (A, T43 d):** janelas da análise (prévia, detalhe da carta, zoom) em `src/telas/Janelas.svelte`; a saída inteira (Resumo, Trocas, Análise) em `src/telas/Saida.svelte`; saíram do analise.ts o render(), o wire() e os innerHTML. Trocar comandante e a leitura do Claude ficam no Resumo. A Mesa segue em .js até a T09.

## v0.17.0 — 25/11/2026 · banco com 961 cartas
Testes: valida 961/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** correção 4 (22 cartas antigas com os campos dos lotes 15/16: Anel, Classe, ateAchar, explorar, amassar, popular, moe, porOponente, historico…), bloco 17 (801–850, 51 casos) e bloco 18 (851–900, 50 casos).

## v0.16.0 — 25/11/2026 · banco com 861 cartas
Testes: valida 861/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** bloco 15 (fila 701–750, 49 casos) e bloco 16 (751–800, 49 casos). Goblin Anarchomancer corrigido pelo coordenador (era −2 numa mágica vermelha e verde; agora 1 redução com `cor ["R","G"]`).
- **Esquema (lotes dos blocos 15 e 16):** cavar `ateAchar`, `destinos` no cavar, filtro `historico`, `cor` em lista, ops `moverMarcador`, `tentarAnel`, `explorar`, `amassar`, `popular`, cond `portadorDoAnel`, `niveis` de Classe, passo `fimCombate`, gat `moe`, descartar `aleatorio`, alvo `porOponente`, conta `poderDoSacrificado`. O motor ainda não lê esses campos (fila do A).

## v0.15.0 — 25/11/2026 · aba Montar em componentes Svelte
Testes: valida 761/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · lacunas = base · verifica verde · build ok.
- **Estrutura (A, T43 d):** a aba Montar vira `src/telas/montar/` (Montar + Topo, Passos, Cores, Ideia, Junto, Busca, Deck, Como, Saida); `montar.ts` fica só com estado, contas e ações (822 → 641 linhas). Roteiro de 59 etapas com HTML, texto, foco e decks salvos iguais aos de antes.
- **Conserto:** mudar o orçamento no passo 4 esvaziava a aba no Svelte (o change do campo em foco disparava de novo no meio do redesenho); o redesenho agora vai para a fila.

## v0.14.0 — 25/11/2026 · banco com 761 cartas
Testes: valida 761/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** bloco 13 (fila 601–650, 50 casos) e bloco 14 (651–700, 54 casos); correção 3 (Curiosity com o gatilho na Aura, Damning Verdict, Devoted Druid, Demon of Fate's Design); Drivnod e Dour Port-Mage sem falta. Marcadores com o nome em inglês do Oracle (growth, charge…).

## v0.13.0 — 25/11/2026 · telas em componentes Svelte; preço certo na 1ª análise
Testes: valida 661/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · lacunas = base · verifica verde · build ok.
- **Estrutura (A, T43 d):** Lista, Resumo, Análise (funções, mana, plano, cortes) e Trocas viram componentes em `src/telas/`; HTML igual ao de antes nos 4 exemplos e na troca de comandante.
- **Conserto:** a 1ª análise depois de abrir a página às vezes somava o preço com o dólar padrão (5,56) e depois multiplicava pela cotação nova (Stangg R$ 661 em vez de 626). Agora a análise espera a cotação até 2,5 s e refaz quando ela chega; cotação guardada vale 12 h.
- **Esquema:** custoAtv `exilarDe {zona, f, qtd}` (Drivnod) e gat `naoMorre` (Dour Port-Mage).

## v0.12.0 — 25/11/2026 · banco com 661 cartas
Testes: valida 661/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** bloco 11 (fila 501–550, 55 casos) e bloco 12 (551–600, 51 casos); correção 2 (13 casos): Urza, Chief Artificer dava ameaça a TODA criatura sua → `tipoTodos` (também Chief of the Foundry, Thopter Spy Network, Weaver of Harmony); Citadel, Bloodghast, Bloodchief, Circle of Power, Cornered, Cloud sem falta.
- **Esquema:** custoAtv.vida com contagem, cond `vidaOponenteMax`, contas `maiorVidaPerdidaOpNoTurno` e `vmDoSacrificado`, `token.gat`, filtros `tipoTodos`, `comEquipamento` e `semMarcador`, custoAtv `porMarcador`, gat `aOponente`. O motor ainda não lê esses campos (fila do A).

## v0.11.0 — 25/11/2026 · banco com 561 cartas; montar.ts e casca Svelte
Testes: valida 561/0 · check 0 erros · Vitest 148/148 · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** bloco 10 (fila 451–500, 55 casos); correção Ashaya (est tipo Land + sub Forest) e Assemble the Entmoot (token X/X pela vida ganha no turno).
- **Motor (A):** lê qtd `{ate:'qualquer'}` (Valakut Awakening), qtd `{dado:N}` e est `ptDefinido`; caso Wear // Tear com a carta do banco.
- **Estrutura (A, T43 d):** montar.js vira `src/montar/montar.ts` estrito; casca da página (cabeçalho, abas, rodapé) sai do index.html para `src/App.svelte`.
- **Esquema:** filtro `encantada` (Aura anexada) — Calix usava `modificada`, que pegava também equipada e com marcador.

## v0.10.0 — 25/11/2026 · banco com 511 cartas; sagas
Testes: valida 511/0 · check 0 erros · Vitest verde · testa 161/161 · verifica verde · build ok.
- **Banco (B):** bloco 9 (fila 401–450, 49 casos); primeiras sagas (kw capitulo + gat capitulo); oraculo.nossas() reconhece "A // B".
- **Esquema:** est `sub` (Ashaya: Forest é subtipo) e token.pt com contagem fixada ao criar (Assemble the Entmoot X/X).

## v0.9.0 — 25/11/2026 · o motor joga cartas de várias faces
Testes: valida 461/0 · check 0 erros · Vitest 145/145 (fuzz erros 0) · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Motor (A, T43 faces):** modal (a face de terreno gasta a jogada de terreno, 712.9), dupla face com transformar (mesmo objeto, marcadores ficam, 701.27), aventura (exílio e depois a criatura, 716.3), split (uma metade, 709.3) e fusão (só da mão, 702.102). 8 casos de regra com as cartas do banco. Ficou de fora: Fire dividir à escolha, Stomp, P/R '*' do Beanstalk Giant.
- **Banco (B):** Wear // Tear com kw `fusao`, Valakut Awakening com `ate:'qualquer'`, Ancient Copper/Gold/Silver Dragon com `dado:20`; Gisela (Meld) em falta.
- **CI:** `npm ci` antes do verifica.py; o banco de 30 sobe o vite (acc7cd2).

## v0.8.0 — 25/11/2026 · banco com 461 cartas; cartas de várias faces; análise em TypeScript
Testes: valida 461/0 · check 0 erros · Vitest 137/137 (fuzz erros 0) · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0 · verifica verde · build ok.
- **Banco (B):** bloco 8 (fila 351–400) e 8 cartas de várias faces (pedido do Felipe, 2 de cada): modal Bala Ged Recovery e Valakut Awakening; duplaFace Legion's Landing e Search for Azcanta; aventura Bonecrusher Giant e Beanstalk Giant; split Fire // Ice e Wear // Tear. 18 casos em banco/testes/faces.json. O motor ainda não joga essas cartas (A, próximo passo).
- **Esquema:** kw `fusao` (Fuse), `qtd {ate:'qualquer'}`, `qtd {dado:N}`.
- **Estrutura (A, T43 d):** src/analise/analise.ts com TypeScript estrito; o JS gerado minifica igual ao de antes.

## v0.7.0 — 25/11/2026 · banco com 403 cartas; Addendum
Testes: valida 403/0 · check 0 erros · Vitest 137/137 (fuzz erros 0) · testa 161/161 · verifica verde · build ok.
- **Banco (B):** bloco 7 (fila 301–350, casos em banco/testes/bloco7.json). Campos novos: protecao 'escolhido' + protecaoJogador, ataqueCusta com qtd, desviraNoTurnoDeOutro, aumentaCusto aoMirar pagando vida, afinidade com f, ouCopia, danoUmaVez.
- **Esquema:** cond `conjuradaNaPrincipal` (Addendum; Unbreakable Formation com casos principal/combate/turno do oponente).

## v0.6.0 — 25/11/2026 · banco com 353 cartas; fila do motor
Testes: valida 353/0 · check 0 erros · Vitest 137/137 (fuzz 30 partidas, erros 0) · testa 161/161 · verifica verde · build ok.
- **Banco (B):** bloco 6 (fila 251–300, 33 casos em banco/testes/bloco6.json); Incubation Druid com prod `deSeusTerrenos` (sai da falta). Campos novos: copiarPermanente, token.copiaDe, repetirCada com filtro, esconderijo, improvisar, est.tiraTipo + devocao, est.limite por tipo, custoAlternativo pagar.virarOutros, muda.maisFicha, comMarcador 'qualquer', fx.pagando.
- **Motor (A, T43):** proliferar, alvoDe (por), dobraGatilho (evs/causa, aditivo, vale para fabricar), fabricar, est.podeJogar do cemitério, mana.so por subtipo, prod deSeusTerrenos; 9 casos de regra novos.

## v0.5.0 — 25/11/2026 · análise, Montar e Mesa em módulos
Testes: check 0 erros · Vitest 128/128 · testa 161/161 · partidas = linha de base · build ok.
- **Estrutura (A, T43 c):** analise.js, montar.js e mesa-ui.js → `src/analise/`, `src/montar/`, `src/mesa/` como módulos ES carregados pelo `src/main.ts` (com hash no build, sem ?v=); JS checado pelo TypeScript (checkJs); minificado idêntico ao original. Ferramentas (mede.js, gera_meta.py, coleta.py, banco_mesa.py) apontam para `src/` e `npx vite`.
- Ver a página local agora é `npx vite --port 8765 --strictPort` (CLAUDE.md, NOTAS.md).

## v0.4.0 — 25/11/2026 · banco com 303 cartas
Testes: valida 303/0 · Vitest 128/128 · testa 161/161 · linha de base igual.
- **Banco (B):** bloco 5 (fila 201–250); Brainstorm e Growth Spiral corrigidos (mover da mão, não buscar).
- **Esquema:** prod `deSeusTerrenos` (Incubation Druid).

## v0.3.0 — 25/11/2026 · banco com 253 cartas; motor lê Fireball/Kolaghan
Testes: valida 253/0 · Vitest 128/128 (97 casos + 31 fuzz) · testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · erros 0.
- **Banco (B):** correção pelas decisões do esquema (Amrou est.por, Kolaghan alvos por modo, Arcane Denial qtd {ate}, Akroma's Will cadaCor, Syr Konrad gat.naoDe…); bloco 4 (cartas 151–200); Windfall e Belladonna Took sem falta.
- **Motor (A):** quem {alvo:N}, alvo max 'qualquer', dividir 'igual' (601.2d/608.2b), impostoPorAlvo (601.2f); 2 casos novos.

## v0.2.0 — 25/11/2026 · controle de versão
- Ramo `integracao` com CI; tags de versão; CHANGELOG e diário de coordenação.
- Esquema: contas `maiorDescarte` e `resolucoesDestaHabNoTurno` (8dde966).

## v0.1.0 — 25/11/2026 · saída do Forge (6fa331d)
Linha de base: testa 161/161 · Stangg 26.5 / Krenko 29.5 / Lathril 7.0 / Edgar 36.0 · turno 8.7 · erros 0 · Vitest 126/126.
- **Decisão do Felipe:** banco de cartas próprio escrito do Oracle; Forge só para conferir e sai na T45; Vite + TypeScript + Svelte 5; dois adeptos coordenados.
- **Banco (T20, adepto B):** formato v2 `banco/esquema.json` + `valida.py` (7b1e5b1); 203 cartas: blocos 1–3 da fila do banco de 30 e as 62 dos casos de regra (872f2e9, 3dec986); 16+ pedidos de esquema decididos (5647b7b).
- **Estrutura (T43, adepto A):** Vite 8.1.7, Svelte 5.57.3, TypeScript 6.0.3, Vitest 5.1.0; `motor2/` → `src/motor/` em TS com resultado idêntico; motor2 JS removido; casos de regra leem `banco/cartas`; CI roda check + Vitest + build; Pages publica `dist/` (0ba06f4, 6fa331d).
- **CI:** espera o artefato antes do deploy (actions/deploy-pages#451) (4a9da0d).
- **Roadmap:** T20 banco próprio, T43 estrutura, T44 análise no banco, T45 tirar o Forge; T31/T37 absorvidas.
