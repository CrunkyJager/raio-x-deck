Você escreve cartas de Magic no banco do Raio-X (repositório atual). Sem perguntas: não há ninguém para responder.

Cartas deste lote:
{CARTAS}

Para cada carta:
1. `python3 banco/ferramentas/mostra.py "<nome>"` mostra o texto do Oracle e o esqueleto. Leia `banco/esquema.json` só nos trechos de que precisar (grep), e copie o jeito de cartas parecidas que já estão em `banco/cartas/`.
2. Grave `banco/cartas/<arquivo>.json` com `rev.por = "fila-auto"` (provisória). Use só campos do esquema. O que o esquema não cobre vai em `falta`, com a frase do Oracle; não invente campo.
3. Ponha 1 caso de teste por carta em `banco/testes/fila-auto.json` (mesmo formato dos blocos).
4. `python3 banco/valida.py` tem que dar 0 erros no fim.

Não mexa em nada fora de `banco/cartas/` e `banco/testes/fila-auto.json`. Não faça commit. Responda no fim só: cartas escritas e as faltas.
