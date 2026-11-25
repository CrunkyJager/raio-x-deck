# Changelog — Raio-X do Deck

Versão `v0.MENOR.CORREÇÃO` até o beta (T42). MENOR sobe a cada entrega que entra na main (bloco do banco, passo da estrutura, tarefa do roadmap); CORREÇÃO sobe em conserto sem função nova. Cada versão tem tag no git. Como entra: ramo do adepto → `integracao` (CI) → `main` + tag (só o coordenador). Detalhe do dia a dia em `planejamento/diario.md`.

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
