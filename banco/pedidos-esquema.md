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
| Spire of Industry | "Activate only if you control an artifact." | `se` (cond) no `atv`. Por ora `se` no fx mana e a frase em `falta` | |
| Syr Konrad, the Grim | "a creature card is put into a graveyard from anywhere other than the battlefield" | campo `de`/`naoDe` (zona de origem) no `gat` vaiCemiterio | |
| Esper Sentinel | "their first noncreature spell each turn" | `limite` `umaPorTurnoPorJogador` (cada oponente tem a sua primeira) | |
| Harmonic Prodigy | "If a triggered ability of a Shaman or another Wizard you control triggers" | `dobraGatilho` com `afeta` = fonte do gatilho; confirmar (o `causa` é o objeto do evento) | |
| Guardian Project / Kutzil | "doesn't have the same name as…" / "power greater than its base power" | filtro `nomeUnico` e `poderAcimaBase` | |
| Amrou Kithkin | "can't be blocked by creatures with power 3 or greater" | `est` naoPodeSerBloqueada não tem campo do bloqueador: usei `f` (o rx/motor lê `por`, que o esquema não aceita). Escolher um e pôr no esquema | |
| Kolaghan's Command / Jace / Liliana / Blood Artist | "Target player discards / draws / sacrifices…" | usei alvo `{f:"jogador"}` + `quem:"alvoJogador"`; com vários alvos (Kolaghan) não diz QUAL alvo é o jogador. Proposta: `quem:{alvo:N}` | |
| Chandra, Torch of Defiance | "You may cast that card. If you don't, …" | `jogar` não distingue conjurar de jogar; o "se não fizer" usei `se.pagou:false` (o rx usa objBate anterior) | |
| Fireball | "any number of targets, divided evenly…; costs {1} more for each target beyond the first" | alvo variável com divisão igual + imposto por alvo. Por ora 1 alvo e `falta` | |
