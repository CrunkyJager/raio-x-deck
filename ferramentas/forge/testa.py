#!/usr/bin/env python3
"""Confere o forge-db.js contra o gabarito esperado.json. Tem que dar 100% antes de qualquer commit.
uso: python3 ferramentas/forge/testa.py [--gera]   (--gera roda o conversor antes)"""
import json, os, sys, subprocess
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
if '--gera' in sys.argv:
    subprocess.run([sys.executable, os.path.join(AQUI, 'converte.py')], check=True)
t = open(os.path.join(RAIZ, 'forge-db.js'), encoding='utf-8').read()
fx = json.loads(t[t.index('{'):t.rindex('}') + 1])
esp = json.load(open(os.path.join(AQUI, 'esperado.json')))
erros = 0; n = 0
for nome, e in esp.items():
    if nome.startswith('_'):
        continue
    n += 1
    F = fx.get(nome)
    if F is None and nome in fx.get('_falta', []):
        print(f'?? {nome}: não está no Forge'); erros += 1; continue
    F = F or {}
    falhas = []
    for k, want in e.get('tem', {}).items():
        L = F.get(k, [])
        if not L:
            falhas.append(f'falta {k}')
        elif not any(all(d.get(a) == b for a, b in want.items()) for d in L):
            falhas.append(f'{k} sem {want} (tem {L})')
    for k in e.get('nao', []):
        if F.get(k):
            falhas.append(f'não devia ter {k}: {F[k]}')
    if e.get('gratis') and not F.get('_gratis'):
        falhas.append('falta _gratis')
    if falhas:
        erros += 1
        print(f'XX {nome}: ' + ' | '.join(falhas)[:600])
print(f'\n{n - erros}/{n} casos certos' + ('' if erros else ' ✔'))
sys.exit(1 if erros else 0)
