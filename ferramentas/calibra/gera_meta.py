# Reescreve o bloco META do montar.js a partir de tabela.json (rodar depois de coleta.py e formula.py).
import json, re, os
H = os.path.dirname(os.path.abspath(__file__)); M = os.path.join(H, '..', '..', 'montar.js')
t = json.load(open(os.path.join(H, 'tabela.json')))
K = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter']
SING = {'elves': 'Elf', 'goblins': 'Goblin', 'zombies': 'Zombie', 'dragons': 'Dragon', 'vampires': 'Vampire', 'merfolk': 'Merfolk', 'angels': 'Angel', 'dinosaurs': 'Dinosaur', 'wizards': 'Wizard', 'humans': 'Human', 'slivers': 'Sliver', 'cats': 'Cat'}
L = lambda v: '[' + ','.join(f"{v[k]:g}" for k in K) + ']'
obj = lambda d: '{ ' + ', '.join(f"{k}: {L(v)}" for k, v in d.items()) + ' }'
s = (f"  // metas do Passo 3 calibradas nos decks médios do EDHREC (ferramentas/calibra, {t['amostra']['decks']} decks: os 10 comandantes mais jogados de cada tema,\n"
     f"  // 3 de cada tribo, e 36 comandantes em cada bracket e no orçamento baixo). Ordem: ramp, compra, remoção, limpa-mesa, proteção, contramágica.\n"
     f"  // Tema/tribo/bracket/orçamento = diferença para a média geral (tema já sem o efeito da cor). Gerado por ferramentas/calibra/gera_meta.py.\n"
     f"  const META = {{ base: {L(t['base'])}, contraAzul: {t['baseContraAzul']}, verde: {t['verde']}, azulCompra: {t['azulCompra']},\n"
     f"    tema: {obj(t['tema'])},\n"
     f"    tribo: {obj({SING[k]: v for k, v in t['tribos'].items()})},\n"
     f"    bracket: {obj(t['bracket'])},\n"
     f"    barato: {L(t['barato'])} }};\n")
src = open(M).read()
src, n = re.subn(r"  // metas do Passo 3 calibradas.*?\n  const META = \{.*?\};\n", lambda m: s, src, count=1, flags=re.S)
assert n == 1; open(M, 'w').write(src); print(s)
