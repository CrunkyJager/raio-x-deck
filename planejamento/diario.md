# Diário de coordenação (mais novo em cima)

Formato: `DD/MM HH:MM · quem · o quê`. Coordenador = FARSEER (Opus Raio-X). A = RAIOX-A (T43), B = RAIOX-B (T20).

- 25/11 · FARSEER · v0.3.0: integracao = B 6b56c8c (correção + bloco 4 + Windfall/Belladonna) + A d82d443 (motor lê Fireball/Kolaghan); 253/0, Vitest 128/128.
- 25/11 · FARSEER · v0.2.0 na main; push das tags falhou 1x por queda de rede, repetido ok.
- 25/11 · FARSEER · v0.2.0: ramo `integracao`, tags, CHANGELOG, este diário (pedido do Felipe: "log do que está acontecendo, versões, branch para unir").
- 25/11 · B · correção + bloco 4 em t20-banco bfa116a (253 cartas). Fireball/Kolaghan falham no Vitest até o motor ler alvos[i].modo, quem {alvo:N}, max 'qualquer', dividir 'igual', impostoPorAlvo → pedido ao A; merge B+A juntos na integracao.
- 25/11 · FARSEER · 8dde966: contas maiorDescarte / resolucoesDestaHabNoTurno (pedidos do B). B liberado para o bloco 5.
- 25/11 · FARSEER · 6fa331d (v0.1.0): merge B (Amrou est.por, Unclaimed) + A (motor2 JS sai; CI roda Vitest). raiox-testes troca motor2 por vitest.
- 25/11 · A · force push negado pela permissão da sessão dele → fez merge da main no ramo (sem force). Regra: force nunca.
- 25/11 · FARSEER · 5647b7b: 16 pedidos de esquema decididos (tabela em banco/pedidos-esquema.md).
- 25/11 · FARSEER · 4a9da0d: deploy do Pages falhava (deploy-pages#451) → passo de espera.
- 25/11 · FARSEER · 872f2e9: merge T20 blocos 1–3 + 62 cartas dos casos de regra.
- 25/11 · FARSEER · 0ba06f4: merge T43 (a)+(b).
- 25/11 · Felipe · banco próprio sem Forge; Vite+TS+Svelte 5; 2 adeptos "sem virar várzea".
