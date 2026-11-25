# Pedidos de mudança no esquema (adepto B → coordenador)

| carta | frase do Oracle | proposta | decisão |
|---|---|---|---|
| Rogue's Passage (e outras "target creature can't be blocked this turn") | "Target creature can't be blocked this turn." | escrevi `efeitoTemporario` com `em:{alvo:0}` e `est:[{modo:"naoPodeSerBloqueada"}]` sem `afeta`; confirmar que `est` sem `afeta` dentro de efeitoTemporario vale para o `em` (ou criar `afeta:"alvo"`) || OK: est sem afeta dentro de efeitoTemporario vale para o `em`. |
| Path of Ancestry | "When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1." | gatilho ao gastar a mana: campo `aoGastar` no fx mana (filtro da mágica + fxs). Por ora em `falta` || Feito: fx mana `aoGastar:{f,fx}`. |
| Chaos Warp | "reveals the top card of their library. If it's a permanent card, they put it onto the battlefield." | usei `cavar` olha 1, pega 1, `revelar`, f Permanent, para campo, resto grimorio; o `revelarTopo` do vocabulário não tem descrição de campos — descrever ou tirar || Usar `cavar` (como fez). `revelarTopo` não usar; sai na T45. |
| Hardened Scales | "If one or more +1/+1 counters would be put on a creature you control, that many plus one…" | `subst` ev `marcador` sem campo do tipo: criar `marc` (como no `gat`) para dizer "+1/+1". Por ora `muda.soma:1` + `falta` || Feito: `subst.marc` ('+1/+1'). |
| Cavern of Souls | "Spend this mana only to cast a creature spell of the chosen type, and that spell can't be countered." | campo no fx mana (ex.: `naoAnulavel:true`) para a mágica paga com ela. Por ora em `falta` || Feito: fx mana `naoAnulavel:true`. |
| Arcane Denial (e "draw up to N") | "may draw up to two cards" | `qtd` com `ate:true` (0 a N, quem escolhe). Por ora `talvez` + qtd 2 e a frase em `falta` || Feito: `qtd:{ate:N}` (tirar o talvez). |
| Akroma's Will | "protection from each color" | usei 5 `protecao` (de W/U/B/R/G); o rx usa `de:"cadaCor"`. Escolher um e pôr no vocabulário || `kw protecao de:'cadaCor'` (uma palavra só). |
| Spire of Industry | "Activate only if you control an artifact." | `se` (cond) no `atv`. Por ora `se` no fx mana e a frase em `falta` || Feito: `atv.se`. |
| Syr Konrad, the Grim | "a creature card is put into a graveyard from anywhere other than the battlefield" | campo `de`/`naoDe` (zona de origem) no `gat` vaiCemiterio || Feito: `gat.de` / `gat.naoDe` (zona). |
| Esper Sentinel | "their first noncreature spell each turn" | `limite` `umaPorTurnoPorJogador` (cada oponente tem a sua primeira) || Feito: limite `umaPorTurnoPorJogador`. |
| Harmonic Prodigy | "If a triggered ability of a Shaman or another Wizard you control triggers" | `dobraGatilho` com `afeta` = fonte do gatilho; confirmar (o `causa` é o objeto do evento) || OK: `afeta` = fonte do gatilho. |
| Guardian Project / Kutzil | "doesn't have the same name as…" / "power greater than its base power" | filtro `nomeUnico` e `poderAcimaBase` || Feito: filtro `nomeUnico` e `poderAcimaBase`. |
| Amrou Kithkin | "can't be blocked by creatures with power 3 or greater" | `est` naoPodeSerBloqueada não tem campo do bloqueador: usei `f` (o rx/motor lê `por`, que o esquema não aceita). Escolher um e pôr no esquema || Fica `por` (o motor já lê): `est.por`. Trocar f→por no Amrou. |
| Kolaghan's Command / Jace / Liliana / Blood Artist | "Target player discards / draws / sacrifices…" | usei alvo `{f:"jogador"}` + `quem:"alvoJogador"`; com vários alvos (Kolaghan) não diz QUAL alvo é o jogador. Proposta: `quem:{alvo:N}` || Feito: `quem:{alvo:N}`. E alvo de modo: `alvos[i].modo:N` (Kolaghan). |
| Chandra, Torch of Defiance | "You may cast that card. If you don't, …" | `jogar` não distingue conjurar de jogar; o "se não fizer" usei `se.pagou:false` (o rx usa objBate anterior) || Feito: `jogar.soConjurar:true`; 'se não fizer' = `se.pagou:false` (certo). |
| Fireball | "any number of targets, divided evenly…; costs {1} more for each target beyond the first" | alvo variável com divisão igual + imposto por alvo. Por ora 1 alvo e `falta` || Feito: alvo `max:'qualquer'`, `dividir:'igual'` e `impostoPorAlvo` na carta. |
| Windfall | "draws cards equal to the greatest number of cards a player discarded this way" | contagem do maior descarte do efeito (ex.: `conta:"maiorEntreJogadores"` com `de:"descartadas"`; hoje o nome existe sem descrição). Por ora o comprar está em `falta` | decidido 8dde966: `qtd {conta:"maiorDescarte"}`; escrito |
| Belladonna Took | "if this is the first time this ability has resolved this turn. If it's the second time… third time…" | contagem de vezes que ESTA habilidade resolveu no turno (o `resolvidasNoTurno` não diz de quê). Por ora só o ganho de vida e o resto em `falta` | decidido 8dde966: `conta:"resolucoesDestaHabNoTurno"` (conta a resolução atual: 1ª=1); escrito |
| Incubation Druid | "Add one mana of any type that a land you control could produce" | prod dos terrenos SEUS (o `refletida` é dos oponentes, Exotic Orchard); ex.: `prod:"refletidaSua"`. Por ora a mana está em `falta` | resolvido: prod `deSeusTerrenos` (v0.4.0) |
| Unbreakable Formation (Addendum) | "If you cast this spell during your main phase" | o bloco 7 usou `turno:'seu'` + conjurada, que aceita a instantânea no combate do seu turno | decidido FARSEER: cond `conjuradaNaPrincipal:true` (momento de conjurar; implica turno seu). Vale para todo Addendum |
| Wear // Tear (também Gisela, bloco 5) | "Fuse (You may cast one or both halves of this card from your hand.)" | kw `fundir` (sem custo; conjura as duas metades da mão pagando os dois custos somados, alvos das duas). Por ora `falta` nas duas faces | decidido FARSEER: kw `fusao` (Fuse). Gisela NÃO é Fuse, é Meld (712.4, junta com Bruna): fica em `falta` por ora; escrito |
| Valakut Awakening | "Put any number of cards from your hand on the bottom of your library, then draw that many cards plus one" | `qtd {ate:'qualquer'}` (como `alvo.max:'qualquer'`). Por ora `maoInteira` + talvez e `falta` | decidido FARSEER: `qtd {ate:'qualquer'}`; escrito |
| Ancient Copper/Gold/Silver Dragon | "roll a d20" | o bloco 8 usou média 10 + falta | decidido FARSEER: `qtd {dado:20}` (o motor rola com semente; a análise usa a média (N+1)/2 = 10,5); escrito |
| Ashaya, Soul of the Wild | "are Forest lands in addition to their other types" | o bloco 9 pôs "Forest" em est.tipo | decidido FARSEER: est `sub` (tipo ["Land"] + sub ["Forest"]); o Forest dá o {T}: G (305.6) |
| Assemble the Entmoot | "create an X/X … where X is the life you gained this turn" | o bloco 9 escreveu 0/0 + X marcadores | decidido FARSEER: token.pt aceita qtd (contagem fixada ao criar) |
| Bolas's Citadel | "pay life equal to its mana value rather than pay its mana cost" | `custoAlternativo` com `pagar {vida:{conta:'vmDoEvento'}}` (hoje vida só aceita número ou X). Por ora `falta` || decidido FARSEER: custoAtv.vida aceita qtd (anyOf); `vida {conta:'vmDoEvento'}` |
| Bloodghast | "has haste as long as an opponent has 10 or less life" | cond de vida de oponente (ex.: `vidaOponenteMax: 10`, algum oponente). Por ora a pressa está em `falta` || decidido FARSEER: cond `vidaOponenteMax: 10` (algum oponente) |
| Bloodchief Ascension | "if an opponent lost 2 or more life this turn" | contagem de UM oponente (hoje `vidaPerdidaOpsNoTurno` soma os oponentes); escrito com a soma + `falta` || decidido FARSEER: conta `maiorVidaPerdidaOpNoTurno` (o oponente que mais perdeu) + `cond.conta min 2` |
| Circle of Power, Cornered by Black Mages (bloco 11) | ficha Wizard com gatilho | `token.gat` | decidido FARSEER: `token.gat` (array de gat) |
| Urza, Chief Artificer (bloco 7) e outros 'artifact creature' | filtro tipo é 'ou' | filtro 'E' entre tipos | decidido FARSEER: filtro `tipoTodos` (todos os tipos); Urza passa a `tipoTodos [Artifact, Creature]` |
| Cloud, Ex-SOLDIER (bloco 11) | "as long as it's equipped" escrito como modificada | filtro só de Equipamento | decidido FARSEER: filtro `comEquipamento` (par do `encantada`, Calix) |
| Damning Verdict (bloco 12) | "creatures with no counters" | filtro sem marcador | decidido FARSEER: filtro `semMarcador` |
| Devoted Druid (bloco 12) | "Put a -1/-1 counter on this creature:" como custo | custoAtv pôr marcador | decidido FARSEER: custoAtv `porMarcador {tipo, qtd}` |
| Demon of Fate's Design (bloco 12) | "life equal to the sacrificed creature's mana value" | vm do sacrificado | decidido FARSEER: conta `vmDoSacrificado` |
| Curiosity (bloco 12) | "Whenever enchanted creature deals damage to an opponent" | gatilho na Aura + dano só a oponente | decidido FARSEER: gat NA Aura com `quem {equipada:true}` (a criatura anexada) + gat `aOponente`; quem compra = voce |
| Drivnod, Carnage Dominus (bloco 13) | "Exile three creature cards from your graveyard:" | exilarDe com filtro e qtd | decidido FARSEER: custoAtv `exilarDe` aceita a zona OU `{zona, f, qtd}` |
| Dour Port-Mage (bloco 13) | "leave the battlefield without dying" | gat sai sem morte | decidido FARSEER: gat `naoMorre: true` com ev `sai` |
| tipoMarc (bloco 13) | nomes de marcador | padrão | decidido FARSEER: inglês do Oracle (growth, charge…) |

## Faltas em lote (bloco 15, para o FARSEER decidir junto)
Contagem: cartas do banco com a frase em `falta` (811 cartas) e cartas da fila que ainda não escrevemos (774) com a mecânica no Oracle.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| rad (marcador em jogador + regra da principal 1) | 2 | 14 | Bloatfly Swarm, Contaminated Drink (Feral Ghoul já põe `marcador rad` em jogador) | regra do motor no início da principal 1 (revela N do topo, moer, perde 1 por não-terreno e tira o marcador); o esquema já escreve o marcador | |
| revelar ATÉ achar N | 2 | 6 | Empty the Laboratory, Etali | `cavar.ate {f, qtd}` (revela até achar qtd que batem em f; resto conforme `resto`) | |
| historic (artefato, lendário ou Saga) | 1 | 3 | Excalibur | filtro `historico: true` | |
| mover marcadores | 1 | 3 | Forgotten Ancient | op `moverMarcador {de, para, tipoMarc, qtd}` | |
| fim de combate | 1 | 3 | Flamerush Rider | passo `fimCombate` (gatilhoAtrasado: exilar a ficha) | |
| o Anel te tenta | 3 | 0 | Boromir Warden, Call of the Ring, Frodo | op `tentarAnel` + cond `portadorDoAnel` | |
| níveis de Classe | 2 | 1 | Caretaker's Talent, Fighter Class | `niveis: [{n, custo, est/gat/atv}]` na carta (o kw `classe` já existe sem campos) | |
| exílio jogável | 1 | 6 | Expressive Iteration | já dá com `cavar para exilio` + `jogar` `lembrada` `dura fimDoTurno` (Birgi); a falta da Expressive é o cavar com 3 destinos: `cavar.destinos` como no buscar | |
| descartar ao acaso | 1 | 2 | Gamble | `descartar.aleatorio: true` | |
| rebound | 1 | 0 | Ephemerate | kw `rebote` | |
| Room (destrancar porta) | 2 | 0 | Dazzling Theater, Funeral Room | gat `destranca` + atv de destrancar como feitiço | |
| monstruoso | 2 | 0 | Alpha Deathclaw, Giggling Skitterspike | kw `monstruosidade n` + cond `monstruoso` | |
| meld | 2 | 0 | Gisela the Broken Blade, Bruna | forma `meld` | |
| dash | 1 | 1 | Flamerush Rider | kw `investida custo` | |

## Faltas em lote (bloco 16, para o FARSEER decidir junto)
Contagem: banco 861 cartas / fila 724 ainda não escritas. As do bloco 15 seguem na tabela acima (rad agora 2/13 — Glowing One já põe o marcador; meld 3/1 com Hanweir Garrison).

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| poder do sacrificado | 1 | 1 | Greater Good (escrito comprar 3) | conta `poderDoSacrificado` (par do `vmDoSacrificado`) | |
| explorar | 1 | 4 | Hakbal of the Surging Soul | op `explorar {em}` (revela o topo: terreno vai à mão, senão +1/+1 e pode moer) | |
| moer como gatilho | 1 | 5 | Glowing One | gat `moe {jog, f}` (por carta moída que bate em f) | |
| amass | 2 | 2 | Dreadhorde Invasion, Gleaming Overseer | op `amass {sub, qtd}` | |
| popular | 1 | 2 | Growing Ranks | op `popular` (ficha copiando uma ficha de criatura sua à escolha) | |
| cor "ou" no filtro | 1 | 0 | Goblin Anarchomancer (escrito como duas reduções) | filtro `cor` aceitar lista (o motor já aceita array em `estado.ts:186`; o esquema só string) | |
| um alvo por oponente | 2 | 0 | Bronzebeak Foragers, Grasp of Fate | alvo `porControlador: true` | |
| desvirar outras como custo | 1 | 0 | Halo Fountain (escrito com `se` de N viradas) | custoAtv `desvirarOutros {f, qtd}` | |
| sacrificar este E outras | 1 | 0 | Glass-Cast Heart (escrito só as 13 Blood) | custoAtv `sacrificar` aceitar lista | |
| replicar, morph, skulk, olhar a mão | 1 cada | 0 | Hatchery Sliver, Grim Haruspex, Gollum, Gitaxian Probe | kw `replicar custo`, `morph custo`, `espreitar`; olhar a mão sem efeito no jogo (pode ficar falta) | |

## Decisões do lote do bloco 15 (FARSEER 25/11)
- rad: SEM campo novo; marcador `rad` em jogador (op marcador) + regra do motor no início da principal 1 (fila do A).
- revelar até achar: fx `ateAchar {f, qtd}` no cavar.
- historic: filtro `historico: true`.
- mover marcadores: op `moverMarcador` (`em` = de onde, `paraObj` = quem recebe, `tipoMarc`, `qtd`).
- fim de combate: passo `fimCombate`.
- Anel: op `tentarAnel` + cond `portadorDoAnel`.
- Classe: `niveis: [{n, custo, est/gat/atv}]` na carta.
- exílio jogável: `destinos` vale também no cavar (Expressive Iteration).
- ao acaso: fx `aleatorio: true` no descartar.
- deHabil vale também no reduzCusto (Forensic Gadgeteer).
- Ficam em `falta` por ora (≤2 cartas): rebound, Room, monstruoso, meld, dash.

## Decisões do lote do bloco 16 (FARSEER 25/11)
- conta `poderDoSacrificado` (Greater Good).
- op `explorar` (701.44), op `amassar` (`sub` = tipo do Exército, `qtd`), op `popular`.
- gat ev `moe` (uma ou mais cartas moídas; `quem`/`f` filtram as cartas).
- filtro `cor` aceita lista = alguma destas. Goblin Anarchomancer: UMA redução com `cor ["R","G"]` (escrito com 2 reduções = −2 numa mágica RG: ERRADO).
- alvo `porOponente: true`.
- Ficam em `falta` por ora: desvirarOutros no custo, sacrificar este + outras, replicar, morph, skulk, marcadores do Gluntch.

## Faltas em lote (bloco 17, para o FARSEER decidir junto)
Contagem: banco 911 cartas / fila 674 ainda não escritas. Todas raras: nenhuma passa de 1/1.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| bestow (concessão) | 1 | 1 | Indebted Spirit (parte da Aura escrita como `equipada`) | kw `concessao custo` | |
| prowl | 1 | 0 | Hunting Velociraptor | kw `espreitar custo` (ou deixar falta) | |
| velocidade (Start your engines / Max speed) | 1 | 0 | Howlsquad Heavy | deixar falta | |
| cond "criou ficha neste turno" | 1 | 0 | Idol of Oblivion (escrito sem a condição) | cond `fichaCriadaNoTurno` | |
| tirar do combate / combate extra do oponente | 1 | 0 | Illusionist's Gambit | deixar falta | |
| não bloqueia nem é bloqueada por não-Spirit | 1 | 0 | Hei Bai (ficha) | deixar falta | |
| contar oponentes que levaram dano | 1 | 0 | Hordewing Skaab (escrito 1 por gatilho) | deixar falta | |
| "ou Ugin planeswalker" no alvo | 1 | 0 | Haven of the Spirit Dragon | alvo com lista de filtros (ou deixar falta) | |

## Faltas em lote (bloco 18, para o FARSEER decidir junto)
Contagem: banco 961 cartas / fila 624 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| cond "oponente controla mais terrenos que você" | 2 | 3 | Archaeomancer's Map, Land Tax (escritos sem a condição) | cond `maisTerrenosOponente` (ou `compara` com o jogador do evento) | |
| primeiro combate do turno | 2 | 1 | Genji Glove, Karlach (escritos como uma vez por turno) | cond `primeiroCombate` | |
| mana que não some entre passos | 2 | 1 | Birgi, Klauth | fx mana `ficaNoTurno` | |
| ficha com nome próprio + P/R | 2 | 2 | Ingris (Cadet), Kher Keep (Kobolds) | token `nome` junto com `pt` (nome só como rótulo) | |
| "até X" no buscar | 1 | 2 | Kyoshi Island Plaza (escrito X) | qtd `ate` aceitar contagem | |
| dobrar marcadores | 1 | 1 | Kalonian Hydra (escrito repetirCada + `marcadoresNoEvento` em `cadaAtual`) | op `dobrarMarcadores` ou confirmar a leitura | |
| conjurada do cemitério (filtro / exílio / custo adicional) | 2 | 0 | Kess, Kotis | deixar falta | |
| não desvira no próximo desvirar | 1 | 0 | Junk Winder | deixar falta | |
| contar dano prevenido | 1 | 0 | Inkshield | deixar falta | |
| Companion | 1 | 0 | Kaheera | deixar falta | |
| custo com dois filtros (um Pântano E uma Floresta) | 1 | 0 | Jarad (escrito 2 entre Pântano/Floresta) | deixar falta | |
| um de cada subtipo no cavar | 1 | 0 | Kaalia, Zenith Seeker (escrito até 3 entre os tipos) | deixar falta | |

## Faltas em lote (bloco 19, para o FARSEER decidir junto)
Contagem: banco 1011 cartas / fila 574 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| cond "oponente controla mais terrenos que você" | 3 | 2 | Archaeomancer's Map, Land Tax, Loyal Warhound (escritos sem a condição) | cond `maisTerrenosOponente` (soma ao lote do bloco 18) | |
| mana gasta na mágica | 2 | 0 | Liberator (escrito sem a condição), Mana Sculpt (escrito com vmDoAlvo) | conta `manaGasta` ou deixar vm | |
| afflict | 1 | 0 | Lazotep Sliver | kw `aflingir` n + gat "fica bloqueada" | |
| conivir | 1 | 0 | Lethal Scheme ("cada criatura que convocou") | deixar falta | |
| dragar | 1 | 0 | Life from the Loam | deixar falta | |
| travar habilidades ativadas | 1 | 0 | Linvala, Keeper of Silence | est `naoPodeAtivar` com afeta | |
| continuo que muda cor / todas as cores | 1 | 0 | Leyline of the Guildpact (também mão inicial) | deixar falta | |
| "um de cada tipo de permanente" | 1 | 0 | Liliana, Dreadhorde General −9 | deixar falta | |
| N-ésima do topo | 1 | 0 | Lost to Legend (escrito no topo) | deixar falta | |
| subst de dano a jogador E aos permanentes dele | 1 | 0 | Lightning, Army of One (escrito só o jogador) | subst `jog` valer para os permanentes dele (`eSeus`) | |
| N atacantes contra você | 1 | 0 | Mangara (escrito sem a condição) | deixar falta | |
| mágica incolor no filtro | 1 | 0 | Liberator (escrito só artefato) | filtro `incolor` | |
| exilada virada para baixo | 1 | 3 | Lobelia | deixar falta | |

## Faltas em lote (bloco 20, para o FARSEER decidir junto)
Contagem: banco 1061 cartas / fila 524 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| gatilho "é causado dano A esta" (enrage, ganhar o dano) | 2 | 4 | Apex Altisaur, Metropolis Reformer (Marauding Raptor e Body of Knowledge já escritos de outro jeito) | gat dano com `em` (quem recebe) além do `quem` (fonte) | |
| gatilho "uma criatura sua explora" | 1 | 3 | Merfolk Cave-Diver | gat ev `explora` | |
| devolver permanente à mão como custo | 2 | 0 | Master Transmuter, Mina and Denn | custoAtv `devolver {f, qtd}` | |
| multikicker (alvos até vezesKicker) | 1 | 0 | Marshal's Anthem (escrito: quantos quiser) | alvo `max` aceitar qtd | |
| incitar (goad) | 1 | 0 | Marisi | deixar falta | |
| gatilho de desvirar | 1 | 0 | Mesmeric Orb | deixar falta | |
| desenterrar (unearth) | 1 | 0 | Molten Gatekeeper | deixar falta | |
| ataca sozinha / não bloqueada / vida vira 1 | 1 | 0 | Master of Cruelties | deixar falta | |
| restrição de bloqueio e ataque | 1 | 0 | Mirri | deixar falta | |
| naoPodeConjurar só no combate | 1 | 0 | Marisi | deixar falta | |
| modo escolhido ao entrar (Mirran/Phyrexian) | 2 | 0 | Windcrag Siege, Mirrodin Besieged (os dois modos escritos) | cond `escolhido` com o nome do modo | |

## Decisões dos lotes dos blocos 17–20 (FARSEER 25/11)
Regra: 3 ou mais ocorrências (banco + fila) → campo novo; o resto fica em `falta`.
- cond `maisTerrenosOponente`: `"algum"` (Land Tax, Loyal Warhound) ou `"doEvento"` (Archaeomancer's Map). Reescrever as 3 cartas.
- gat `recebe` (filtro de quem RECEBE o dano no ev `dano`; `quem` continua = fonte). Enrage → `recebe {este: true}`. Reescrever Apex Altisaur e Metropolis Reformer.
- gat ev `explora` (`quem` = a criatura que explorou). Reescrever Merfolk Cave-Diver.
- ficha com nome + P/R: o esquema JÁ aceita `token {nome, pt, …}` (nome só como rótulo). Reescrever Ingris e Kher Keep.
- qtd `ate` aceita contagem (`{"ate": {"conta": …}}`). Reescrever Kyoshi Island Plaza.
- cond `primeiroCombate`. Reescrever Genji Glove e Karlach.
- fx mana `ficaNoTurno`. Reescrever Birgi e Klauth.
- Kalonian Hydra: a leitura com repetirCada fica (sem op nova).
- Ficam em `falta`: bestow, prowl, velocidade, fichaCriadaNoTurno, combate do oponente, Hei Bai, Hordewing, alvo "ou Ugin", Kess/Kotis, Junk Winder, Inkshield, Companion, Jarad, Kaalia, mana gasta (Mana Sculpt segue com vmDoAlvo), afflict, conivir, dragar, naoPodeAtivar, Leyline, Liliana −9, N-ésima do topo, Lightning (eSeus), Mangara, incolor, Lobelia, devolver no custo, multikicker, goad, desvirar, unearth, Master of Cruelties, Mirri, Marisi, modo escolhido ao entrar.

## Faltas em lote (bloco 21, para o FARSEER decidir junto)
Contagem: banco 1111 cartas / fila 474 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| "fase principal" na condição (não só turno seu) | 2 | 1 | Moraug (escrito: turno seu) | cond `faseprincipal` | |
| "entrou neste turno" (Food entrou, fichas que entraram) | 2 | 1 | Motivated Pony, Ocelot Pride (junto do fichaCriadaNoTurno do 17) | filtro `entrouNoTurno` | |
| Role (ficha de Aura com efeito) | 1 | 1 | Monstrous Rage (escrito: +1/+1 e atropelar direto na criatura) | token `est` ou Roles nomeadas no motor | |
| travar habilidades ativadas | 1 | 1 | Myrel (junto do naoPodeAtivar do 19) | deixar falta | |
| marcador de qualquer tipo no filtro | 2 | 0 | Mutational Advantage (escrito: +1/+1) | `comMarcador: "qualquer"` | |
| intimidar (intimidate) | 2 | 0 | Nim Deathmantle (e Mikaeus do 20) | kw `intimidar` | |
| vira cor / perde tipos de criatura | 2 | 0 | Nim Deathmantle | deixar falta | |
| explora terreno / não-terreno | 1 | 0 | Nicanzil (escritas as duas com ev `explora`) | cond do card revelado | |
| o resto 1/0 | | | Moraug (ataques por criatura), Mox Amber (cores das lendárias), New Blood (troca de texto), Nightkin Ambusher (rad do defensor) | deixar falta | |

## Decisões do lote do bloco 21 (FARSEER 25/11)
Regra ≥3 ocorrências (somando os lotes anteriores).
- cond `fasePrincipal` (Moraug).
- filtro `entrouNoTurno` (Motivated Pony, Ocelot Pride; Idol of Oblivion = `ficha` + `entrouNoTurno`).
- est modo `naoPodeAtivar` com `afeta` (Linvala do 19 + Myrel).
- kw `intimidar` (Mikaeus do 20 + Nim Deathmantle).
- est `cores` = passa a ter só estas cores (Nim Deathmantle 'B', Leyline of the Guildpact 'WUBRG'); perder tipos já é `tiraTipo`.
- Ficam em `falta`: Role, comMarcador qualquer, explora terreno/não-terreno, o resto 1/0.
- Reescrever na correção 5: Moraug, Motivated Pony, Ocelot Pride, Idol of Oblivion, Linvala, Myrel, Mikaeus, Nim Deathmantle, Leyline of the Guildpact.

## Faltas em lote (bloco 22, para o FARSEER decidir junto)
Contagem: banco 1161 cartas / fila 424 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| não pode ser regenerada | 5 | 2 | Pongify, Artifact Mutation e outras | fx `semRegenerar` no destruir | |
| decayed | 3 | 1 | Poppet Stitcher, Crowded Crypt… | kw `decaida` | |
| habilidade custa {1} a menos por objeto | 2 | 2 | Otawara (por lendária) | reduzCusto `deHabil` com qtd contagem no atv | |
| maior valor de mana entre | 2 | 1 | One with the Machine | prop `maiorVm` | |
| exceto a primeira compra do passo de compra | 2 | 1 | Orcish Bowmasters, Bard | gat compra `naoPrimeira` | |
| ao acaso (modal) | 2 | 1 | Outlaws' Merriment (Gamble já tem descartar aleatorio) | modal `aleatorio` | |
| impending | 2 | 0 | os dois Overlords | deixar falta | |
| canalizar (descartar esta como custo) | 2 | 0 | Otawara, Shigeki | custoAtv `descartarEste` | |
| perde todas as habilidades | 2 | 0 | Poppet Factory | deixar falta | |
| o resto 1/0 | | | Peer into the Abyss (arredondar para cima), Patriarch's Bidding (cada jogador escolhe), Perch Protection (exila a si), Phelia (quem controla a que voltou) | deixar falta | |

## Decisões do lote do bloco 22 (FARSEER 25/11)
- fx `semRegenerar` no destruir (7 ocorrências).
- kw `decaida` (decayed).
- habilidade mais barata por objeto: o est `reduzCusto` com `deHabil` já aceita `qtd` com contagem; usar isso (Otawara), sem campo novo.
- prop `maiorVm` na contagem (`{"conta": filtro, "prop": "maiorVm"}`, One with the Machine).
- gat `naoPrimeira` no ev compra (Orcish Bowmasters, Bard).
- `aleatorio` também vale para os modos (Outlaws' Merriment).
- Ficam em `falta`: impending, canalizar (2/0), perde todas as habilidades, o resto 1/0.
- Ponder: está escrito só como embaralhar + compra. Falta olhar as 3 do topo e reordenar (cavar olha 3, resto no topo em qualquer ordem). Corrigir.
- Reescrever na correção 6: as 7 de não regenerar, as de decayed, Otawara, One with the Machine, Bowmasters, Bard, Outlaws' Merriment e Ponder.

## Correção 6 (adepto B, 25/11): o que não coube
- Bard, King of Dale: a dobra de compra é `subst` (ev compra, mult 2) e `naoPrimeira` só existe no `gat`; o valida recusou. Fica a falta. Proposta: aceitar `naoPrimeira` também na subst de compra.
- Otawara: `reduzCusto` com `afeta "este"` e `deHabil`; a habilidade é da mão (canalizar), e a est não tem zona onde vale. Fica a falta do canalizar.

## Faltas em lote (bloco 23, para o FARSEER decidir junto)
Contagem: banco 1211 cartas / fila 374 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| escolhe N e sacrifica o resto | 3 | 0 | Archfiend of Depravity, Ajani Nacatl Pariah, Promise of Loyalty | op `sacrificar` com `exceto` N escolhidas por jogador | |
| moída neste turno | 1 | 2 | Raul (fila: Tato Farmer, The Master) | filtro `moidaNoTurno` | |
| exert | 2 | 0 | Pride Sovereign, Combat Celebrant | deixar falta | |
| copiar habilidades ativadas | 2 | 0 | Quicksilver Elemental, Drana and Linvala | deixar falta | |
| o resto 1/0 | | | Preacher (maior vida), Hojo (1ª habilidade com alvo mais barata), Progenitor's Icon (só a próxima mágica), Yao Guai (vm total ≤ X), Quicksilver (mana azul como qualquer cor) | deixar falta | |

## Decisões do lote do bloco 23 (FARSEER 25/11)
- fx `exceto {qtd, porTipo?}` no sacrificar: cada jogador escolhe N que ficam e sacrifica o resto (Archfiend of Depravity, Ajani Nacatl Pariah, Promise of Loyalty).
- filtro `moidaNoTurno` (Raul; fila: Tato Farmer, The Master).
- subst `naoPrimeira` (Bard), igual ao gat.
- Ficam em `falta`: exert, copiar habilidades ativadas, o resto 1/0.
- Reescrever na correção 7: Archfiend, Ajani Nacatl Pariah, Promise of Loyalty, Raul, Bard.

## Faltas em lote (bloco 24, decidido)
Contagem: banco 1261 cartas / fila 324 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| atacou neste turno | 2 | 1 | Riders of the Mark, Faramir (fila: Searslicer Goblin) | filtro `atacouNoTurno` (como `entrouNoTurno`) | filtro `atacouNoTurno` (correção 8: Riders; Faramir é "atacou você", fica falta) |
| dash | 2 | 0 | Riders of Rohan, Flamerush Rider | kw `investida` com custo (pressa + volta à mão no fim do turno) | falta |
| mana de uma cor só | 2 | 0 | Gilded Lotus, Sanctum of Fruitful Harvest | prod `umaCor` (qualquer, mas toda da mesma) | falta |
| descartar com filtro no custo | 1 | 1 | Sanctum of Shattered Heights (fila: Tortured Existence) | custo `descartar {f, qtd}` além do número | falta |
| o resto 1/0 | | | Reforge the Soul (milagre), Resurgent Belief (suspender), Rith (dano excedente), Ruthless Technomancer (sacrificar X no custo), Runic Armasaur (ev ativa habilidade), Retreat to Coralhelm (virar ou desvirar), Sanctum of All (grimório e/ou cemitério), Righteous Valkyrie (vida inicial + 7: escrito vidaMin 47) | deixar falta | falta |

## Decisões do lote do bloco 24 (FARSEER 25/11)
- filtro `atacouNoTurno` (Riders of the Mark + 2 da fila). Reescrever Riders na correção 8.
- Ficam em `falta`: dash (também 2 no lote 15), mana de uma cor só, descartar com filtro no custo (1/1), o resto 1/0.

## Faltas em lote (bloco 25, para o FARSEER decidir junto)
Contagem: banco 1311 cartas / fila 274 ainda não escritas. Nenhuma falta nova se repete na fila.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| sacrificar quantos quiser | 2 | 0 | Scapeshift, Feasting Hobbit | qtd `{ate:"qualquer"}` no sacrificar (hoje escrito "tudo") | decidido FARSEER: `qtd {ate:"qualquer"}`; escrito (correção 9) |
| o resto 1/0 | | | Sarkhan Soul Aflame (vira cópia até o fim do turno), Season of the Burrow (modos por {P}, repetidos), Selfless Squire (ev dano prevenido), Selvala Explorer Returned (parley: escrito a média, metade dos jogadores), Selvala Heart of the Wilds (maior poder que cada outra), Serra the Benevolent (emblema vida não cai abaixo de 1), Siege Smash (split second) | deixar falta | falta |

## Faltas em lote (bloco 26, para o FARSEER decidir junto)
Contagem: banco 1361 cartas / fila 224 ainda não escritas.

| falta | no banco | na fila | cartas do banco | proposta | decisão |
|---|---|---|---|---|---|
| retrace | 2 | 0 | Deeproot Historian, Six | kw `retrace` concedida às cartas do cemitério (est continuo `afeta` cemitério, como o bis do Homing/Mist Dancer) | |
| bestow (concedido) | 2 | 0 | Indebted Spirit, Springheart Nantuko | kw `concedido` com custo; a parte Aura fica como `equipada` | |
| ficha por jogador atacado | 3 | 0 | Adeline, Ainok Strike Leader, Soaring Lightbringer | `repetirCada` por jogador atacado, ficha atacando `atacado` | |
| ficha de artefato com +1/+1 por artefato | 2 | 0 | Simulacrum Synthesizer (e o Construct do lote anterior) | `est` na ficha | |
| o resto 1/0 | | | Silumgar (só o jogador defensor), Sink into Stupor (mágica OU permanente no mesmo alvo), Sliver Gravemother (regra de lenda; bis {X} = vm da carta), Spelunking (4 de vida se for Cave), Spiteful Sliver (jogador ou planeswalker), Starfield of Nyx (P/R base = vm de cada encantamento) | deixar falta | |

