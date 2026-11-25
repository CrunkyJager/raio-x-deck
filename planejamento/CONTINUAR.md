# Continuar o Raio-X (de casa ou amanhã)

Atualizado em 25/11/2026 às 17:50 pelo coordenador (FARSEER). Quem retomar lê ESTE arquivo primeiro e, ao parar, ATUALIZA este arquivo (seção "Estado"), faz commit e push. Assim a próxima sessão, seja de casa ou do trabalho, começa daqui.

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
  - **Ivora** (`ivora.txt`): 75/75 no banco; motor jogava 52/75. O adepto A já fechou jogar/lutar/modal/Pip-Boy (commit 1f99573 no ramo `t43-estrutura`, ainda NÃO está na main). Faltam: flashback, Anger (continuo.se), Witch's Mark/Key to the City/Wedding Invitation (modificar), Cool but Rude (classe/níveis), Reaver Cleaver (ficha.qtd), Kazuul's Fury/Kediss (dano.qtd), Kozilek/Ulamog (sacrificar.quem), Brallin/Kediss (parceiro), Pompous Battlemage (proeza), Brotherhood Regalia (continuo.sub), Tarrian's Soulcleaver (gat.de), Shadow of the Goblin (gat.naoDe), Clive (capítulo/mover/comprar.qtd). Conferir ciclar numa partida de verdade.
  - **Masmorras** (`masmorras.txt`): 12/81 no banco. O adepto B escreve as 69 que faltam (ramo `t20-banco`). O motor ainda NÃO tem venture/masmorras/iniciativa/completou nem **antecedente** (Background) → o adepto A faz isso depois do Ivora.
  - **Ultron**: 63/80 jogáveis (v0.36.0).
- Ramos dos adeptos (status em `planejamento/adeptos/A.md` e `B.md`): `t43-estrutura` (motor, A), `t20-banco` (cartas, B). T44 (pesos lidos do banco) tem patch fora da main; falta a medida dos 30 decks em lotes de 10 (a última caiu por falta de memória).
- T46 (fila automática pelo PC): ramo `t46-fila-auto`; o Apps Script ainda responde "Acesso negado" → o Felipe precisa abrir o editor, rodar `doGet` e Permitir.

## Próximo passo (nesta ordem)
1. Ivora 75/75 jogando: as travas acima (motor, `src/motor/`), uma por commit, com teste. Pronto = motor-cobertura sem nenhuma carta do `ivora.txt` + uma partida no node com flashback, ciclar e Sangue no registro.
2. Mecânica de masmorras: venture (4 masmorras: Lost Mine of Phandelver, Dungeon of the Mad Mage, Tomb of Annihilation, Undercity), completar masmorra, iniciativa (CR 725) e antecedente (Background, CR 702.124). IA escolhe o caminho com critério. Teste em que a ordem dos gatilhos (`ordemGatilho`) muda o resultado.
3. Cartas de masmorras no banco (B) → **motor joga 81/81**.
4. Revisão de textos da Mesa (Felipe 25/11: "revise o UI para ser entendível"): ler as strings em `src/mesa/mesa-ui.js` (PERG, botões) e `src/mesa/arena-nova.ts` (rotulo, TITULO) direto no código, sem print. Toda opção tem que dizer PARA ONDE vai ou O QUE acontece.
5. T44 medida em lotes → T46 depois da autorização.

## Amanhã (trabalho, coordenador /raiox)
`git fetch` → ler o "Estado" deste arquivo (pode ter mudado em casa) → revisar os ramos `casa-*` → integrar na main → seguir o "Próximo passo".
