#!/usr/bin/env python3
"""Põe na cards-db.js o preço da impressão mais barata (precos-extra.json) das cartas que estavam sem preço.
Rodar de novo sempre que a cards-db for regerada (o bulk "Oracle Cards" deixa ~1.300 cartas sem usd)."""
import json, os
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
p = os.path.join(RAIZ, 'cards-db.js'); raw = open(p, encoding='utf-8').read()
db = json.loads(raw[raw.index('{'):raw.rindex('}') + 1]); F = {f: i for i, f in enumerate(db['fields'])}
ex = json.load(open(os.path.join(AQUI, 'precos-extra.json')))
n = 0
for nome, v in ex.items():
    c = db['cards'].get(nome)
    if c and v and not c[F['usd']]: c[F['usd']] = round(v, 2); n += 1
open(p, 'w', encoding='utf-8').write('window.CARD_DB=' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(n, 'preços aplicados;', sum(1 for c in db['cards'].values() if not c[F['usd']] and not c[F['ban']]), 'continuam sem preço')
