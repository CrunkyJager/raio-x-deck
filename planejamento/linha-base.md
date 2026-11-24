# Linha de base dos testes (T02, 23/11/2026)

Node v26.13.1 LTS em ~/.local/opt/node (links em ~/.local/bin), checksum conferido.
Rodado sobre a árvore com as alterações pela metade (NOTAS.md, analise.js, converte.py, forge-db.js, index.html), sem mexer nelas.

- `python3 ferramentas/forge/testa.py`: 161/161 ✔
- `node ferramentas/partida.js Stangg 200 5`: Stangg 17.5% | Krenko 34.5% | Lathril 8.5% | Edgar 38.0% | turno médio 9.1 | **erros 0** | ~5 s
- `node ferramentas/lacunas.js`: roda; principais grupos ignorados = fichas (6), morrer/cemitério (5), bônus P/T (4), conjurar (3), equipamento (3), marcadores (3).
- lacunas por exemplo: Stangg 1/65, Krenko 36/65, Lathril 23/65, Edgar 33/64 (iguais às NOTAS: nada regrediu).
