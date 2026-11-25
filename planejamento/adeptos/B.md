# Adepto B — T20 banco
Feito: blocos 1–3 (fila 1–150; casos em bloco1/2/3.json) e as 62 cartas dos casos de regra do motor (lista do RAIOX-A: 11 já existiam, 51 escritas; casos em casos62.json). valida: 203 cartas, 0 erros.
Compara 62: 47 iguais, 15 divergem — decididas pelo Oracle: Blood Artist/Jace −1 −10/Liliana −2/Kolaghan descarte miram jogador (rx: você), Goblin Guide é o defensor que revela (rx: você), Bushwhacker só com chute (se conjuradaCom), Blooming Marsh conta "other lands" (outro), Chandra +1 "se não fizer" = se.pagou false; resto é forma.
Correção (decisões 5647b7b): Amrou est.por; Unclaimed/Cavern sem zona no so; Kolaghan alvos com modo (índice 0-based do modos) e quem {alvo:1}; Arcane Denial qtd {ate:2}; Akroma protecao cadaCor; Spire atv.se; Syr Konrad naoDe campo; Esper umaPorTurnoPorJogador; Hardened Scales subst.marc; Cavern naoAnulavel; Path aoGastar (falta: tipo em comum com o comandante); Fireball max qualquer/dividir igual/impostoPorAlvo; Chandra soConjurar; Guardian Project nomeUnico (falta: cemitério); Kutzil poderAcimaBase. Casos em correcao1.json.
Bloco 4 (fila 151–200): 50 escritas, 30 casos em bloco4.json; valida 253/0. Primeiro uso de atacantesDeclarados, animar, faseExtra, prole, afinidade, caminhadaTerreno, ofertaPresente, trocaPor; vale o A conferir no motor.
Vitest: 2 falhas (Fireball, Kolaghan) vêm do bloco de correção (campos novos que o motor ainda não lê), não do bloco 4.
Windfall/Belladonna Took refeitas com maiorDescarte/resolucoesDestaHabNoTurno (8dde966), sem falta.
Bloco 5 (fila 201–250): 50 escritas, 40 casos em bloco5.json; valida 303/0. Primeiro uso de proliferar, alvoDe, dobraGatilho com evs/causa, fabricar, est.podeJogar do próprio cemitério (Gravecrawler), mana.so por subtipo (Giada).
Consertos: Brainstorm (bloco 4) e Growth Spiral (bloco 3) usavam buscar de:mao — o motor busca sempre no grimório; agora mover f/qtd da mão (como o motor lê o Brainstorm).
Leituras a confirmar: Faerie Mastermind = compradasNoTurno igual 2 (do jogador do evento); Minas Tirith = ataquesNoTurno min 2 (criaturas que atacaram no turno); Enlightened Tutor = embaralha ANTES e põe no topo (mesmo resultado; buscar para grimorio põe no topo).
Faltas novas: Enduring Vitality (volta sem ser criatura), Incubation Druid (mana do tipo que seus terrenos produzem: pedido de prod), Kodama (não posta por esta habilidade), Gisela (fundir), Long River's Pull (alvo sem presente só criatura).
Vitest: as mesmas 2 falhas (Fireball, Kolaghan).
Agora: bloco 6 (fila 251–300), se liberado.
