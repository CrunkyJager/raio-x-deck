# Diário de coordenação (mais novo em cima)

Formato: `DD/MM HH:MM · quem · o quê`. Coordenador = FARSEER (Opus Raio-X). A = RAIOX-A (T43), B = RAIOX-B (T20).

- 25/11 · FARSEER · v0.9.0: A T43 faces (00919fc) + B correção faces/d20 (fed6dd7). Antes, v0.8.0 falhou no CI (mede.js precisa de typescript, job rodava verifica antes do npm ci) → acc7cd2. Limites do motor: Fire dividir (T16), Stomp efeitoTemporario, Beanstalk P/R '*'.
- 25/11 · FARSEER · v0.8.0: B bloco 8 (6384c50) + faces (0d20549, 461 cartas) + A analise.ts estrito (ccfe2a0). Felipe pediu 2 cartas de cada forma (MDFC, transforma, aventura, split) já testadas. Esquema: fusao, ate 'qualquer', dado N; Gisela é Meld, não Fuse (falta). Leituras ok: Access Tunnel, Angel of Destiny (vidaMin 55, só Commander), Ainok.
- 25/11 · FARSEER · v0.7.0: B bloco 7 (b4dfc9b, 403 cartas). Leituras ok: Wheel and Deal (alvos 0..qualquer, quem {alvo:0} para todos), Teferi's Puzzle Box (conta 'resultado'). Addendum recusado (turno seu + conjurada aceitava o combate) → cond conjuradaNaPrincipal (3092ced). B no bloco 8; A recebeu os usos novos do bloco 7 para conferir no motor.
- 25/11 · FARSEER · v0.6.0: B bloco 6 (dc27b7e, 353 cartas) + A fila do motor (283ef56). Leituras do B confirmadas (Molten Psyche conta 'resultado', Mystic Forge cor C + nao Land, Rishkar comMarcador 'qualquer'). Decisões do A aceitas (por sem tipo na pilha; causa = qualquer atacante; dobraGatilho aditivo; podeJogar só cemitério). mesa-ui.js fica .js no (d) até a T09 entrar.
- 25/11 · FARSEER · v0.5.0: A (c) 417bd7e (análise/montar/mesa em src/ como módulos; .ts estrito fica para o (d)). ATENÇÃO soltos da T09 em ~/raio-x-deck: mesa-ui.js mudou de lugar → guardados como patch antes de atualizar a pasta.
- 25/11 · FARSEER · v0.4.0: B bloco 5 (583c7c0, 303 cartas); prod deSeusTerrenos; leituras confirmadas (Faerie Mastermind, Minas Tirith, Enlightened Tutor). Fila do A depois do (c): conferir no motor proliferar, alvoDe, dobraGatilho evs/causa, fabricar, est.podeJogar do cemitério, mana.so por subtipo, prod deSeusTerrenos.
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
