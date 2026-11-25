# Continuar o Raio-X (de casa ou amanhã)

Atualizado em 25/11/2026 às 18:00 pelo coordenador (FARSEER). Quem retomar lê ESTE arquivo primeiro e, ao parar, ATUALIZA este arquivo (seção "Estado"), faz commit e push. Assim a próxima sessão, seja de casa ou do trabalho, começa daqui.

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

## Próximo passo (nesta ordem)
0. [FEITO 18:15] v0.38.0 na main = os dois ramos juntos (sem o patch T44). ATENÇÃO: "motor joga" conta só o que trava. Há cartas com pedaço em `falta` (frase que o motor ainda pula): Ivora 26 de 75, masmorras pelo menos as 11 de iniciativa/masmorra/completou/infect. O número honesto para o Felipe é "inteira = sem trava E sem falta".
1. Ivora 75/75 jogando: as 4 que faltam (motor, `src/motor/`), uma por commit, com teste. Pronto = motor-cobertura sem nenhuma carta do `ivora.txt` + uma partida no node com flashback, ciclar e Sangue no registro.
2. Mecânica de masmorras: venture (4 masmorras: Lost Mine of Phandelver, Dungeon of the Mad Mage, Tomb of Annihilation, Undercity), completar masmorra, iniciativa (CR 725) e antecedente (Background, CR 702.124). IA escolhe o caminho com critério. Teste em que a ordem dos gatilhos (`ordemGatilho`) muda o resultado.
3. Cartas de masmorras no banco (B) → **motor joga 81/81**.
4. Revisão de textos da Mesa (Felipe 25/11: "revise o UI para ser entendível"): ler as strings em `src/mesa/mesa-ui.js` (PERG, botões) e `src/mesa/arena-nova.ts` (rotulo, TITULO) direto no código, sem print. Toda opção tem que dizer PARA ONDE vai ou O QUE acontece.
5. T44 medida em lotes → T46 depois da autorização.

## Amanhã (trabalho, coordenador /raiox)
`git fetch` → ler o "Estado" deste arquivo (pode ter mudado em casa) → revisar os ramos `casa-*` → integrar na main → seguir o "Próximo passo".
