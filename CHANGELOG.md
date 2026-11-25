# Changelog — Raio-X do Deck

Versão `v0.MENOR.CORREÇÃO` até o beta (T42). MENOR sobe a cada entrega que entra na main (bloco do banco, passo da estrutura, tarefa do roadmap); CORREÇÃO sobe em conserto sem função nova. Cada versão tem tag no git. Como entra: ramo do adepto → `integracao` (CI) → `main` + tag (só o coordenador). Detalhe do dia a dia em `planejamento/diario.md`.

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
