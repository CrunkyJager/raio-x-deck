# Pedidos de mudança no esquema (adepto B → coordenador)

| carta | frase do Oracle | proposta | decisão |
|---|---|---|---|
| Rogue's Passage (e outras "target creature can't be blocked this turn") | "Target creature can't be blocked this turn." | escrevi `efeitoTemporario` com `em:{alvo:0}` e `est:[{modo:"naoPodeSerBloqueada"}]` sem `afeta`; confirmar que `est` sem `afeta` dentro de efeitoTemporario vale para o `em` (ou criar `afeta:"alvo"`) | |
| Path of Ancestry | "When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1." | gatilho ao gastar a mana: campo `aoGastar` no fx mana (filtro da mágica + fxs). Por ora em `falta` | |
| Chaos Warp | "reveals the top card of their library. If it's a permanent card, they put it onto the battlefield." | usei `cavar` olha 1, pega 1, `revelar`, f Permanent, para campo, resto grimorio; o `revelarTopo` do vocabulário não tem descrição de campos — descrever ou tirar | |
