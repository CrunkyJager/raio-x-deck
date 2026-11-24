# Regras usadas pelo motor (CR de 06/11/2026) — `regra <número>` devolve o trecho

| Seção | O que é | Tarefa |
|---|---|---|
| 103 | começo do jogo, mulligan (103.5 mulligan) | T14 |
| 106 | mana, tipos de mana, pool | T14 |
| 117 | prioridade (quem pode agir) | T15 |
| 405 | pilha | T15 |
| 500–505 | turno: início, desvirar, manutenção, compra, principal | T14 |
| 506–511 | combate: início, atacantes, bloqueadores, dano, fim | T16 |
| 512–514 | final: etapa final, limpeza (descarte até 7) | T14 |
| 601 | conjurar mágica (601.2 ordem; 601.2f custo) | T15, T19 |
| 602 | habilidade ativada | T15 |
| 603 | gatilho (603.3 pôr na pilha; 603.10 olhar para trás) | T17 |
| 604 | estática | T18 |
| 605 | habilidade de mana (não usa pilha) | T14 |
| 606 | lealdade (planeswalker) | T15 |
| 607 | habilidades ligadas | T17 |
| 608 | resolver (608.2b alvo ilegal) | T15 |
| 613 | camadas dos efeitos contínuos (613.1 ordem; 613.7 timestamp) | T18 |
| 614 | substituição ("instead", "enters with", "as ... enters") | T19 |
| 615 | prevenção | T19 |
| 616 | várias substituições juntas | T19 |
| 702 | palavras-chave (702.2 toque mortífero, 702.19 atropelar… 196 ao todo) | T16–T18 |
| 704 | ações de estado (704.5 lista; 704.6c dano de comandante) | T14 |
| 800–806 | multijogador (800.4 jogador que sai; 806 Free-for-All) | T14, T16 |
| 903 | Commander (903.4 identidade; 903.8 imposto; 903.9 volta à zona de comando; 903.10 dano 21) | T14, T22 |

Commander além do CR: `regra --cmd` (formato e brackets), `regra --ban Nome` (banidas e Game Changers, do Scryfall).
Atualizar: baixar o .txt novo de magic.wizards.com/en/rules para cr.txt (tirar BOM e \r) e rodar `regra 704.5` para conferir.
