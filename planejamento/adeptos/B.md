# Adepto B — T20 banco
Feito: blocos 1–3 (fila 1–150; casos em bloco1/2/3.json) e as 62 cartas dos casos de regra do motor (lista do RAIOX-A: 11 já existiam, 51 escritas; casos em casos62.json). valida: 203 cartas, 0 erros.
Compara 62: 47 iguais, 15 divergem — decididas pelo Oracle: Blood Artist/Jace −1 −10/Liliana −2/Kolaghan descarte miram jogador (rx: você), Goblin Guide é o defensor que revela (rx: você), Bushwhacker só com chute (se conjuradaCom), Blooming Marsh conta "other lands" (outro), Chandra +1 "se não fizer" = se.pagou false; resto é forma.
Correção (decisões 5647b7b): Amrou est.por; Unclaimed/Cavern sem zona no so; Kolaghan alvos com modo (índice 0-based do modos) e quem {alvo:1}; Arcane Denial qtd {ate:2}; Akroma protecao cadaCor; Spire atv.se; Syr Konrad naoDe campo; Esper umaPorTurnoPorJogador; Hardened Scales subst.marc; Cavern naoAnulavel; Path aoGastar (falta: tipo em comum com o comandante); Fireball max qualquer/dividir igual/impostoPorAlvo; Chandra soConjurar; Guardian Project nomeUnico (falta: cemitério); Kutzil poderAcimaBase. Casos em correcao1.json.
Bloco 4 (fila 151–200): 50 escritas, 30 casos em bloco4.json; valida 253/0. Primeiro uso de atacantesDeclarados, animar, faseExtra, prole, afinidade, caminhadaTerreno, ofertaPresente, trocaPor; vale o A conferir no motor.
Vitest: 2 falhas (Fireball, Kolaghan) vêm do bloco de correção (campos novos que o motor ainda não lê), não do bloco 4.
Agora: bloco 5 (fila 201–250).
Dúvidas: 2 pedidos novos (Windfall, Belladonna Took).
