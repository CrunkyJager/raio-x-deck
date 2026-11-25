# Changelog — Raio-X do Deck

Versão `v0.MENOR.CORREÇÃO` até o beta (T42). MENOR sobe a cada entrega que entra na main (bloco do banco, passo da estrutura, tarefa do roadmap); CORREÇÃO sobe em conserto sem função nova. Cada versão tem tag no git. Como entra: ramo do adepto → `integracao` (CI) → `main` + tag (só o coordenador). Detalhe do dia a dia em `planejamento/diario.md`.

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
