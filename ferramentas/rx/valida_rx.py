#!/usr/bin/env python3
"""T12 — confere cartas RX: esquema (esquema.json) + dados batem com o cards-db (nome, vm, identidade, tipos).
uso: python3 ferramentas/rx/valida_rx.py [arquivo.json]   (padrão: esperado_rx.json)"""
import json, os, sys
import jsonschema

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
esq = json.load(open(os.path.join(AQUI, 'esquema.json')))
arq = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'esperado_rx.json')
cartas = json.load(open(arq))['cartas']
s = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
db = json.loads(s[s.index('{'):s.rindex('}') + 1])
F, C = db['fields'], db['cards']
porFrente = {k.split(' // ')[0]: k for k in C}
val = jsonschema.Draft202012Validator(esq)
erros = 0
for c in cartas:
    msgs = [f'{"/".join(map(str, e.absolute_path))}: {e.message[:140]}' for e in val.iter_errors(c)]
    k = porFrente.get(c['n'])
    if not k:
        msgs.append('não está no cards-db')
    else:
        d = dict(zip(F, C[k]))
        if c.get('vm') != d['v']: msgs.append(f'vm {c.get("vm")} ≠ {d["v"]}')
        if sorted(c.get('ci', '')) != sorted(d['ci']): msgs.append(f'ci {c.get("ci")} ≠ {d["ci"]}')
        tl = d['t'].split(' // ')[0].split(' — ')[0].split()
        for t in c['tipos']:
            if t not in tl: msgs.append(f'tipo {t} não está em "{d["t"]}"')
        for t in c.get('super', []):
            if t not in tl: msgs.append(f'super {t} não está em "{d["t"]}"')
        if c.get('pt') and d.get('p') and str(c['pt'][0]) != str(d['p']): msgs.append(f'poder {c["pt"][0]} ≠ {d["p"]}')
    erros += bool(msgs)
    print(('✘ ' if msgs else '✔ ') + c['n'] + ''.join('\n    ' + m for m in msgs))
print(f'\n{len(cartas) - erros}/{len(cartas)} cartas certas' + (' ✔' if not erros else ''))
sys.exit(1 if erros else 0)
