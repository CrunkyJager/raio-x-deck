#!/usr/bin/env python3
"""Valida banco/cartas/*.json contra banco/esquema.json. uso: python3 banco/valida.py [arquivo…]"""
import json, glob, os, sys, jsonschema
AQUI = os.path.dirname(os.path.abspath(__file__))
val = jsonschema.Draft202012Validator(json.load(open(os.path.join(AQUI, 'esquema.json'))))
arqs = sys.argv[1:] or sorted(glob.glob(os.path.join(AQUI, 'cartas', '*.json')))
ruins, nomes = 0, {}
for a in arqs:
    c = json.load(open(a))
    erros = list(val.iter_errors(c))
    if c.get('n') in nomes: erros.append(f"nome repetido com {nomes[c['n']]}")
    nomes[c.get('n')] = a
    for e in erros[:3]:
        ruins += 1; print(os.path.basename(a), '→', getattr(e, 'message', e)[:200])
print(f'{len(arqs)} cartas, {ruins} erros'); sys.exit(1 if ruins else 0)
