# Linha de base do plano (T06, 2026-11-25)

Gabarito: `planos.json` (T05 23/11/2026 (21 duvidosos revisados pelo Felipe)), 109 comandantes.
Sistema medido: `planoDe` + temas do comandante (`themesOf`) em `analise.js`, **só o comandante** (sem as 99).
Rodar de novo: `node ferramentas/gabarito/mede.js`.

## Resultado
| Medida | Acerto |
|---|---|
| Principal exato | **10/109 (9,2%)** |
| Principal previsto está no gabarito (principal ou secundário) | 18/109 (16,5%) |
| Principal do gabarito aparece em algum palpite | 24/109 (22,0%) |
| Sem palpite nenhum | 28/109 |
| Principal do gabarito é um plano que o sistema nem sabe dizer | 69/109 (63,3%) |

## Como o sistema de hoje foi traduzido para os 36 planos (suposição desta medida)
voltron (flag ou tema) → 1 · goad → 29 · ataque (flag/tema combat) → 3 · tokens → 2 · counters → 4 · graveyard → 21 · artifacts/enchant → 15 · spells → 16 · sac → 9 · life → 11 · lands → 12 · draw → 28.
Ordem do principal: voltron > goad > temas na ordem do THEMES > ataque. Planos fora disso: 24 dos 36.

## Por plano do gabarito
| Plano (gabarito) | Comandantes | Acertos | |
|---|---|---|---|
| 8 Trapaça de custo (cheat) | 5 | 0 | não sabe dizer |
| 15 Enchantress / artefatos (valor por tipo) | 5 | 0 |  |
| 4 Criaturas grandes (stompy) | 4 | 0 |  |
| 9 Aristocratas | 4 | 1 |  |
| 10 Dreno / group slug | 4 | 0 | não sabe dizer |
| 13 Terrenos do cemitério (lands) | 4 | 0 | não sabe dizer |
| 14 Blink / ETB | 4 | 0 | não sabe dizer |
| 22 Mill (oponentes) | 4 | 0 | não sabe dizer |
| 28 Punir mão (wheel/descarte) | 4 | 0 |  |
| 29 Goad / política | 4 | 1 |  |
| 31 Group hug | 4 | 0 | não sabe dizer |
| 34 Combo infinito | 4 | 0 | não sabe dizer |
| 1 Voltron | 3 | 3 |  |
| 3 Aggro | 3 | 1 |  |
| 5 Veneno (infect/toxic) | 3 | 0 | não sabe dizer |
| 6 Combate extra | 3 | 0 | não sabe dizer |
| 7 Tempo / devolver | 3 | 0 | não sabe dizer |
| 12 Landfall | 3 | 1 |  |
| 16 Spellslinger | 3 | 1 |  |
| 17 Storm / turno explosivo | 3 | 0 | não sabe dizer |
| 19 Fireball / mágica X | 3 | 0 | não sabe dizer |
| 20 Reanimador | 3 | 0 | não sabe dizer |
| 21 Valor do cemitério (self-mill) | 3 | 0 |  |
| 23 Controle (draw-go) | 3 | 0 | não sabe dizer |
| 33 Superamigos (planeswalkers) | 3 | 0 | não sabe dizer |
| 35 Vitória alternativa | 3 | 0 | não sabe dizer |
| 2 Ir largo (go-wide) | 2 | 1 |  |
| 11 Ganho de vida que vira dano | 2 | 1 |  |
| 18 Turnos extras | 2 | 0 | não sabe dizer |
| 24 Limpa e reconstrói | 2 | 0 | não sabe dizer |
| 26 Destruição de terrenos (MLD) | 2 | 0 | não sabe dizer |
| 27 Roubo (theft) | 2 | 0 | não sabe dizer |
| 30 Pillow fort | 2 | 0 | não sabe dizer |
| 25 Stax / trava | 1 | 0 | não sabe dizer |
| 32 Caos | 1 | 0 | não sabe dizer |
| 36 Toolbox / cadeia de tutor | 1 | 0 | não sabe dizer |

## Erros mais comuns (gabarito → previsto)
| Par | Vezes |
|---|---|
| 15 Enchantress / artefatos (valor por tipo) → 2 Ir largo (go-wide) | 4 |
| 8 Trapaça de custo (cheat) → (sem palpite) | 3 |
| 10 Dreno / group slug → (sem palpite) | 3 |
| 17 Storm / turno explosivo → 16 Spellslinger | 3 |
| 21 Valor do cemitério (self-mill) → 2 Ir largo (go-wide) | 3 |
| 22 Mill (oponentes) → 21 Valor do cemitério (self-mill) | 3 |
| 8 Trapaça de custo (cheat) → 3 Aggro | 2 |
| 9 Aristocratas → 2 Ir largo (go-wide) | 2 |
| 13 Terrenos do cemitério (lands) → 2 Ir largo (go-wide) | 2 |
| 19 Fireball / mágica X → 4 Criaturas grandes (stompy) | 2 |
| 20 Reanimador → 21 Valor do cemitério (self-mill) | 2 |
| 24 Limpa e reconstrói → (sem palpite) | 2 |
| 27 Roubo (theft) → (sem palpite) | 2 |
| 28 Punir mão (wheel/descarte) → (sem palpite) | 2 |
| 29 Goad / política → 2 Ir largo (go-wide) | 2 |
