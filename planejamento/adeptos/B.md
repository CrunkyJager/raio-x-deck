# Adepto B — T20 banco
Feito: bloco 1 — bulk oracle-cards em ~/.cache/raiox/scryfall/; banco/ferramentas/ (oraculo.py, fila.py, mostra.py, compara.py); 50 cartas (fila 1–50 do banco de 30, 3 pedidos em pedidos-esquema.md); banco/testes/bloco1.json (22 casos). valida: 52 cartas, 0 erros.
Compara × cartas-rx: 41 iguais, 11 divergem — decididas pelo Oracle: Bojuka Bog (rx sem alvo), An Offer (rx sem "noncreature"), Rogue's Passage (rx vazio), Path of Ancestry (falta do scry), Blasphemous Act (redução só na mão), fetch/check sem tipo Land ("a Mountain card"), Chaos Warp pega 1 + revelar, Swords qtd.alvo (padrão 0).
Agora: bloco 2 (fila 51–100: Polluted Delta, Reanimate, Secluded Courtyard…).
Dúvidas: as 3 do pedidos-esquema.md; formato de banco/testes (por ora carta/situação/espera, o motor não roda).
