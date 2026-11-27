# Continuar o Raio-X (de casa ou amanhã)

Atualizado em 27/11/2026 de manhã pelo coordenador (FARSEER). Quem retomar lê ESTE arquivo primeiro e, ao parar, ATUALIZA este arquivo (seção "Estado"), faz commit e push. Assim a próxima sessão, seja de casa ou do trabalho, começa daqui.

## Como começar (qualquer PC)
1. `git clone https://github.com/CrunkyJager/raio-x-deck` (ou `git pull` se já tiver) → `npm ci`.
2. Abra o Claude Code na pasta e cole: **"Leia planejamento/CONTINUAR.md e siga a seção Próximo passo. Uma tarefa por vez, testes verdes antes de commit, commit em português num ramo, push do ramo."**
3. Testes: `npm run check` · `npx vitest run` · `node ferramentas/motor-cobertura.mjs --por-carta /tmp/cob.json` (o que o motor ainda não joga, carta a carta).
4. Ao terminar: atualizar "Estado" abaixo + `CHANGELOG.md` se foi para a main → commit → push.
   Em casa (conta Pro, limite menor): trabalhe num ramo `casa-<assunto>` e NÃO faça merge na main; amanhã o coordenador revisa e junta.

## Regra que faltou hoje (Felipe 25/11)
"Carta no banco" ≠ "carta funcionando". Toda entrega de deck informa os DOIS números:
**no banco X/Y** e **motor joga X/Y** (motor-cobertura.mjs). Hoje eu disse que o deck da Ivora estava visto e 23 cartas ainda travavam (flashback, classe, lutar...). Não repetir.

## Estado em 25/11 18h
- main = v0.37.1: textos da Mesa mais claros (comandante: "Deixar no cemitério" × "Mandar de volta para a zona de comando"; lenda; modo mostra o efeito; botão de desenvolvedor escondido sem `?dev=1`).
- Decks do Edigar (listas em `planejamento/decks/`):
  - **Ivora** (`ivora.txt`): 75/75 no banco. **Motor joga 71/75** no ramo `t43-estrutura` (2401c3f, Vitest 219 verde, partidas 0 erros, cobertura 1201/1684), que ainda NÃO está na main. Faltam 4: Anger, Brotherhood Regalia, Cool but Rude e Clive (o Clive precisa também de conta `devocao` e descartar `qtd maoInteira`). O passo exato de cada uma está em `planejamento/adeptos/A.md`, no ramo. Falta também a partida do Ivora no node mostrando recapitular, ciclar e Sangue no registro.
  - **Masmorras** (`masmorras.txt`): no ramo `t20-banco` (c5d5c1b) estão **81/81 no banco** e o **motor joga 70/81**. Travam 11: Safana, Acererak, Alora, Demonic Gifts, Escape Tunnel, Fifty Feet of Rope, Imoen, Prosperous Thief, Replicating Ring, Slip Through Space e Withercrown. As propostas do B estão em `banco/pedidos-esquema.md`, seção "Blocos 36/37": fx `tomarIniciativa` + cond `temIniciativa`, fx `aventurar` + ev `sala`, cond/gat `completouMasmorra`/`completaMasmorra` e kw `infectar`, além da regra dos 10 venenos no motor. Antecedente = kw `escolhaAntecedente`, que já existe no esquema; o motor ainda não joga. Para o motor: 28 casos de teste prontos em `banco/testes/pedidos-masmorras.json` (iniciativa, masmorra, completou, infectar).
  - **T44:** 25/30 decks medidos em `banco_t44.json`, sem commit (fica na pasta do adepto B, no PC do trabalho). As cartas de masmorras entraram depois → refazer do zero em lotes de 10.
  - **Ultron**: 63/80 jogáveis (v0.36.0).
- Ramos dos adeptos (status em `planejamento/adeptos/A.md` e `B.md`): `t43-estrutura` (motor, A), `t20-banco` (cartas, B). T44 (pesos lidos do banco) tem patch fora da main; falta a medida dos 30 decks em lotes de 10 (a última caiu por falta de memória).
- T46 (fila automática pelo PC): ramo `t46-fila-auto`; o Apps Script ainda responde "Acesso negado" → o Felipe precisa abrir o editor, rodar `doGet` e Permitir.

## Estado em 25/11 ~21h30 (sessão de CASA, ramos `casa-*`, nada na main)
- **`casa-ivora`** (coordenador de casa): passo 1 FEITO. Ivora **75/75 sem trava**, **50/75 inteiras** (25 com `falta`: frases que o esquema ainda não escreve — milagre, fuga, reconfigurar, "descartadas no turno"…). Anger (estática do cemitério, cond `esteEm`), Brotherhood Regalia (tipo dado à equipada + estáticas de regra de Equipamento), Cool but Rude (Classe 716 + gat ev `nivel` + descartar `aleatorio`), Clive (devoção 700.5; `marcadoresNoEste` lê `de`). Marcador de saga no motor agora é `lore` (nome do banco). Bug achado e corrigido: `talvez` + `pagando` quebrava a repetição do processo (Leaf-Crowned Visionary). IA sobe nível de Classe. Ferramenta nova `ferramentas/partida-deck.mjs`: 100 partidas da Ivora, 0 erros; registro com recapitular 16, ciclar 16, Blood 77. Vitest 224 verde. Esquema: masmorras (pedidos 1–4 e 6 do B) e gat ev `nivel` aceitos.
- **Ultron (mesmo ramo `casa-ivora`, c63c4cf):** 0 travas (eram 7: Ratchet grupo na saída, Dispatch metalcraft, Ugin buscar "quantas quiser", Unwinding Clock, Mycosynth afinidade, Organic Extinction improvisar, Deflecting Swat custo alternativo). Ainda com `falta`: 12 cartas; 7 nomes da lista do Felipe (`~/projetos/mtg-lab/magnus/lista.txt`, PC de casa) são apelidos (Megatron = Blightsteel…) — falta pôr a lista com nomes reais em `planejamento/decks/ultron.txt`. Vitest 229 verde.
- O `casa-ivora` já tem o ramo do B juntado, o `veneno` → `poison` e o Acererak com `completouMasmorra {nome, nao}`.
- **`casa-masmorras-banco`** (adepto B): 32 cartas reescritas com os campos novos; sobram 8 com `falta` no deck (Acererak "não completou Tomb" — esquema já aceito, falta escrever; Fifty Feet of Rope; as 6 do item 5). 47 casos em `banco/testes/correcao-masmorras.json`.
- **`casa-masmorras-motor`** (adepto A2): masmorras/iniciativa/infectar/antecedente no motor — ver `planejamento/adeptos/A.md` no ramo.
- Marcador de veneno do jogador = `poison` (decisão): normalizar as cartas do banco que escrevem `veneno`.
- Para integrar: `casa-ivora` + `casa-masmorras-banco` + `casa-masmorras-motor` → `integracao` → main + tag + CHANGELOG (coordenador).

## Estado em 26/11 manhã (trabalho) — v0.39.0 na main
- Os 3 ramos `casa-*` juntos na main (conflito do `estado.ts` resolvido como anotado: `morbid` na tabela PALAVRA). `masmorras.txt` sem a coluna dupla.
- **Ivora:** no banco 75/75 · motor joga 75/75 · inteiras 50/75. **Masmorras:** no banco 81/81 · motor joga 72/81 · inteiras 67/81. Ultron: 0 travas (lista com nomes reais ainda falta em `planejamento/decks/ultron.txt`).
- Partidas no node: Ivora 50 e masmorras 50, 0 erros; registro mostra aventura, iniciativa, completar masmorra, recapitular, Sangue.
- Divergência Undercity: o A2 seguiu a CR (aventurar com a Undercity aberta avança nela) — está certo; o caso do B é que precisa mudar.

## Estado em 26/11 tarde — v0.41.0 na main (CI verde)
- v0.40.0: o motor aplica substituições (entra com marcadores, fichas/marcadores dobrados, dano dobrado/metade/prevenir) e a cobertura ficou honesta (`M.substOk`): 1299/1753 inteiras. Ainda recusadas: anulada impedir (12), morre/vaiCemiterio (Liesa, Ravenloft, Blightsteel, Library of Leng), trocaPor, compra mult.
- Ivora: no banco 75/75 · motor joga 74/75 (Library of Leng) · inteiras 50/75. Masmorras: 81/81 · 73/81 · 68/81.
- v0.41.0 (Felipe 26/11): a Mesa ao vivo **indica, não limita** — mana quando quiser (⚡) e para fora da principal quando há o que usar; lugar em forma de tapete (comando no canto do centro), fundo escolhido por lugar.

## Estado em 26/11 ~10h — v0.42.0 na main
- **Masmorras: no banco 83/83 · motor joga 83/83 · inteiras 77/83.** Ivora: 75/75 · 74/75 (Library of Leng) · 50/75. Motor joga inteiras 1345/1753. Vitest 267.
- Novos no motor: `repetirCada` por jogador (`cadaAtual`), custo `virarOutros`, `virar.naoDesvira/soNaoDesvira` (esquema), subst `morre`/`vaiCemiterio` no `M.mover` (muda.para, exilar+marcador, embaralhar no grimório), gat `danoUmaVez`, filtros `kw`/`comMarcador`, dono `atacado`, atrasado que herda o alvo, `modificar.gat`, marcador de palavra-chave (122.1b), objBate doEvento com LKI no gatilho.

## Estado em 26/11 ~11h — v0.43.0 na main
- **Ivora: no banco 75/75 · motor joga 75/75 · inteiras 51/75.** Masmorras: 83/83 · 83/83 · 77/83. Motor joga inteiras 1361/1753. Vitest 272.
- Passo 1 antigo feito (Leng, anulada, Baylen, repetirCada de objetos, fichas atacando, caso da Undercity).

## Estado em 26/11 ~12h — v0.44.0 na main
- **Ivora: no banco 75/75 · motor joga 75/75 · inteiras 65/75.** Masmorras: 83/83 · 83/83 · 78/83. Vitest 278.
- Faltam na Ivora (10): Demand Answers (custo "ou"), Inti (reflexo; até o próximo final), Falkenrath Gorger (loucura dada fora do campo), Reforge the Soul (milagre), Witch's Mark (Role), Lizard Blades (reconfigurar), Brass's Tunnel-Grinder (descer), Bag of Holding ("exilado com este"), Pompous Battlemage (preparada), Markov Enforcer ("recebeu dano deste"). Masmorras (5): Ashiok, Dire Fleet Ravager, Knowledge Exploitation, Prosperous Thief (ninjutsu), Skull Raid (prever).

## Estado em 26/11 ~13h30 — v0.45.0 na main
- **Ivora: no banco 75/75 · motor joga 75/75 · inteiras 75/75. Masmorras: 83/83 · 83/83 · 83/83.** Vitest 294. Motor joga inteiras 1363/1753.
- Sobra: verso de Brass's Tunnel-Grinder (Tecutlan: "descobrir X ao gastar a mana dele"). A IA não usa prever/ninjutsu/reconfigurar (T21).

## Estado em 26/11 ~11h30 — v0.46.0 na main
- Mana com escolha no custo virou ação com pergunta (`manaEsc`, src/motor/pilha.ts): 9 cartas jogam; inteiras 1371/1753. Faltam Master of Dark Rites (mana restrita na reserva) e Ramos (marcador.qtd). A IA não usa (T21).

## Estado em 26/11 18h — v0.50.0 na main (fim do expediente)
- **Motor joga inteiras 1444/1756** (eram 1400 na v0.49.1). Vitest 367 verde, check 0 erros, Stangg igual à base (erros 0).
- **Ivora: 75/75 no banco · 75/75 motor · 30 partidas 0 erros. Masmorras: 81/81 · 81/81 · 30 partidas 0 erros.** Taxa de vitória baixa (2/30, 1/30): IA fraca nesses planos (T21).
- Hoje: pedido do Edigar feito (marcador +1/+1 separado do lorde; ordem de gatilhos indiferente não pergunta — CR 701.9a + 603.3b; falta mostrar a citação a ele); aviso "Saiu uma versão nova… Recarregar" (o ⚠ falso na mão era aba com o site de 25/11); motor: modo ao entrar, efeito temporário (substituição de dano, terra extra, mão máxima, lampejo, não conjurar, antimagia de jogador, gatilho e contínua em emblema), monarca (CR 724), dano não prevenível, Lightning, Past in Flames (flashback dado no cemitério), modificar até o seu próximo turno / enquanto no campo, Hellkite Courser (atrasado com 'anterior', mover para a zona de comando), Mortarpod (arma viva).
- Fila automática: `~/.local/bin/raiox-fila` (worktree `~/raio-x-c`, ramo `fila-auto`); falta o Felipe pôr a linha no crontab (*/30).

## Estado em 27/11 manhã — v0.56.0 na main
- v0.56.0: `M.mover` emite o evento de zona também ao sair do cemitério (com `snapCem`); gat ev `saiCemiterio` aceita `grupo`.
- v0.55.0: `M.faseExtra(e, fase, chave)` enche `turno.extras` (500.8); `proximoPasso` troca de fase pela fila e volta ao passo guardado (`turno.volta`); `turno.combates` conta os combates (se.primeiroCombate); se.fasePrincipal.
- v0.54.0: op `escolher` (tipoCriatura/cor) grava `ctx.escolha`; filtro `sub`/`nao` 'escolhido' lê ctx.escolha antes da escolha ao entrar (`ehEscolhido`, changeling conta); modificar troca kw protecao de 'escolhido' pela cor; agente: tipo com mais criaturas suas.
- v0.53.0: gat ev `sacrificado` — `M.mover(..., { sac: true })` põe `sac` no evento de zona; todos os pontos que sacrificam passam a flag (custo em pilha/mana, op sacrificar, aMenosQue, masmorra, saga 714.4); 'sacrificado' está em SAIDA (olha para trás).
- **Motor joga inteiras 1477/1756** (eram 1444 na v0.50.0). Vitest 374 verde, check 0, Ivora e Masmorras 20 partidas 0 erros.
- v0.51.0: Sephiroth (filtro `modificada` 700.9 + camada 7b `e.temp.base`), Éomer (`virarMonarca` alvoJogador; IA escolhe a si: `paraSi` no ask de alvo), Faramir (`monarca` no gat.se), gatilho de mana `viraParaMana` (605.1b, `M.gatsMana` em mana.ts somado aos pacotes).
- v0.52.0: jogar do topo (`permissoes` com `s.de 'grimorio'` + filtro `topo`; `M.olhaTopo`; Mesa mostra "topo:"), ganhar o controle (`e.ctrlEf` + `M.recalcCtrl`, o.ctrl0), filtro ctrl `doEvento` consertado, gat ev `marcadorPosto` (emitido no `M.porMarcadores`; proliferar passa por ele).
- Tamiyo, Field Researcher ficou para depois: a carta precisa ser reescrita (o +1 é gatilho "até o seu próximo turno" com quem compra = você; o −7 é emblema de custo alternativo grátis da mão).

## Próximo passo (27/11 tarde, nesta ordem)
1. T43 travas (`node ferramentas/motor-cobertura.mjs --por-carta /tmp/cob.json`): (gat ev sacrificado v0.53.0, op escolher v0.54.0, op faseExtra v0.55.0, gat ev saiCemiterio v0.56.0), gat.recebe (6), kw convocar (6), op copiarMagica (6), op destruir.semRegenerar (6). Depois Tamiyo.
2. Pendências do Felipe: lista do Ultra Magnus com nomes reais (`planejamento/decks/ultron.txt`); linha do cron da fila; ok para remover worktrees `~/raio-x-base`/`~/raio-x-b`.
3. T44: medida dos 30 decks em lotes de 10 (arquivos no ramo `t44-medida`).

## Próximo passo (antigo, manhã de 27/11)
1. T43 travas da cobertura (`node ferramentas/motor-cobertura.mjs --por-carta /tmp/cob.json`), uma por commit com caso no `casos.test.ts`:
   Sephiroth (custoAtv.sacrificar com filtro `modificada` + est ptDefinido), Tamiyo (modificar com habil e dura proximoTurnoSeu; carta com `falta`: quem compra é VOCÊ), Éomer (virarMonarca.quem), Faramir (gat.se), Regal Behemoth (gat ev viraParaMana, 4 cartas). Depois as de mais cartas: est podeOlhar (9), op ganharControle (9), gat ev marcadorPosto (8), op escolher (7), op faseExtra (7).
2. Pendências do Felipe: lista do Ultra Magnus com nomes reais (`planejamento/decks/ultron.txt`); linha do cron da fila; ok para remover worktrees `~/raio-x-base`/`~/raio-x-b`.
3. T44: medida dos 30 decks em lotes de 10 (arquivos da medida no ramo `t44-medida`).

## Próximo passo (antigo, manhã de 26/11)
1. ~~Habilidades de mana com escolha~~ FEITO na v0.46.0. Era: Habilidades de mana com escolha que o motor ainda não paga (10, aparecem como `custoMana.*` na cobertura): sacrificar outra (altares, Krark-Clan, Gilded Goose), tirar marcador (Steam-Kin, Ramos), exilar da mão (Simian Spirit Guide). Não pôr no solver automático (sacrificaria sem querer): virar ação com pergunta.
2. ~~`falta` da Ivora e masmorras~~ FEITO na v0.45.0 (sobra o verso Tecutlan).
3. ~~Revisão de textos da Mesa~~ FEITO na v0.46.1 (9 perguntas sem título/rótulo). Era: Revisão de textos da Mesa (PERG/botões em `src/mesa/mesa-ui.js`, rotulo/TITULO em `src/mesa/arena-nova.ts`).
4. T44 medida em lotes → T46 depois da autorização.

## Próximo passo (antigo, 25/11)
**Amanhã, primeiro:** ler `planejamento/adeptos/A.md` no ramo `casa-masmorras-motor` (onde o A2 parou), juntar `casa-ivora` + `casa-masmorras-motor` (casa-ivora já contém o banco do B) → rodar check + Vitest + `node ferramentas/motor-cobertura.mjs` + `node ferramentas/partida-deck.mjs planejamento/decks/masmorras.txt --comandante "Safana, Calimport Cutthroat" --basico Swamp --partidas 50` → integracao → main + tag + CHANGELOG. O que o A2 não terminou vira o passo 2 abaixo.
**A2 terminou (casa-masmorras-motor, 1b0f115):** os 5 itens (infectar + 10 venenos, as 4 masmorras/aventurar/completar, iniciativa CR 727, IA de masmorra com caso 603.3b, antecedente), Vitest 248 verde; 40 partidas de masmorras (Safana|Dungeon Delver) sem erro; deck masmorras 69/83 inteiras, 9 travadas (Acererak repetirCada, Withercrown perderVida.aMenosQue, Ravenloft perderVida.qtd comMarcador, Alora gatilho atrasado com alvo, Corpse Cur filtro com infect, Demonic Gifts modificar.gat, Dungeon Descent virarOutros, Fifty Feet virar.naoDesvira, Prosperous Thief danoUmaVez). O merge com o casa-ivora tem UM conflito em `src/motor/estado.ts` (COND_OK/condValorOk): ficar com a tabela PALAVRA do casa-ivora, pôr `morbid: e => M.morbido(e)` nela, manter `temIniciativa`/`completouMasmorra` no COND_OK e `&& M.condMasmorraOk(se)` no condValorOk. Divergência a decidir: o caso do B diz que aventurar comum com a Undercity escolhe outra masmorra; o A2 seguiu a CR 701.49b/309.5a (avança na Undercity). `masmorras.txt` tem duas colunas de número ("1 1 Safana…"): tirar a primeira. Ao medir, cuidado: as cartas novas do B usam campos que só o motor do A2 lê (sem ele, o deck de masmorras mostra 35 travas).
0. [FEITO 18:15] v0.38.0 na main = os dois ramos juntos (sem o patch T44). ATENÇÃO: "motor joga" conta só o que trava. Há cartas com pedaço em `falta` (frase que o motor ainda pula): Ivora 26 de 75, masmorras pelo menos as 11 de iniciativa/masmorra/completou/infect. O número honesto para o Felipe é "inteira = sem trava E sem falta".
1. [FEITO em casa 25/11, ramo casa-ivora] Ivora 75/75 jogando: as 4 que faltam (motor, `src/motor/`), uma por commit, com teste. Pronto = motor-cobertura sem nenhuma carta do `ivora.txt` + uma partida no node com flashback, ciclar e Sangue no registro.
2. Mecânica de masmorras: venture (4 masmorras: Lost Mine of Phandelver, Dungeon of the Mad Mage, Tomb of Annihilation, Undercity), completar masmorra, iniciativa (CR 725) e antecedente (Background, CR 702.124). IA escolhe o caminho com critério. Teste em que a ordem dos gatilhos (`ordemGatilho`) muda o resultado.
3. Cartas de masmorras no banco (B) → **motor joga 81/81**.
4. Revisão de textos da Mesa (Felipe 25/11: "revise o UI para ser entendível"): ler as strings em `src/mesa/mesa-ui.js` (PERG, botões) e `src/mesa/arena-nova.ts` (rotulo, TITULO) direto no código, sem print. Toda opção tem que dizer PARA ONDE vai ou O QUE acontece.
5. T44 medida em lotes → T46 depois da autorização.

## Amanhã (trabalho, coordenador /raiox)
`git fetch` → ler o "Estado" deste arquivo (pode ter mudado em casa) → revisar os ramos `casa-*` → integrar na main → seguir o "Próximo passo".
