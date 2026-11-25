# Pedidos de mudança no esquema (adepto B → coordenador)

| carta | frase do Oracle | proposta | decisão |
|---|---|---|---|
| Rogue's Passage (e outras "target creature can't be blocked this turn") | "Target creature can't be blocked this turn." | escrevi `efeitoTemporario` com `em:{alvo:0}` e `est:[{modo:"naoPodeSerBloqueada"}]` sem `afeta`; confirmar que `est` sem `afeta` dentro de efeitoTemporario vale para o `em` (ou criar `afeta:"alvo"`) | |
| Path of Ancestry | "When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1." | gatilho ao gastar a mana: campo `aoGastar` no fx mana (filtro da mágica + fxs). Por ora em `falta` | |
| Chaos Warp | "reveals the top card of their library. If it's a permanent card, they put it onto the battlefield." | usei `cavar` olha 1, pega 1, `revelar`, f Permanent, para campo, resto grimorio; o `revelarTopo` do vocabulário não tem descrição de campos — descrever ou tirar | |
| Hardened Scales | "If one or more +1/+1 counters would be put on a creature you control, that many plus one…" | `subst` ev `marcador` sem campo do tipo: criar `marc` (como no `gat`) para dizer "+1/+1". Por ora `muda.soma:1` + `falta` | |
| Cavern of Souls | "Spend this mana only to cast a creature spell of the chosen type, and that spell can't be countered." | campo no fx mana (ex.: `naoAnulavel:true`) para a mágica paga com ela. Por ora em `falta` | |
| Arcane Denial (e "draw up to N") | "may draw up to two cards" | `qtd` com `ate:true` (0 a N, quem escolhe). Por ora `talvez` + qtd 2 e a frase em `falta` | |
| Akroma's Will | "protection from each color" | usei 5 `protecao` (de W/U/B/R/G); o rx usa `de:"cadaCor"`. Escolher um e pôr no vocabulário | |
