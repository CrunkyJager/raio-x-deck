#!/usr/bin/env python3
"""Fila de cartas a escrever: cartas do banco de 30 decks por frequência (em quantos decks aparece).
uso: python3 banco/ferramentas/fila.py [N=50] [--todas]   (--todas inclui as já escritas)
Saída: posição, nº de decks, nome, (já escrita?)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oraculo

BASICOS = {'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'}

def fila():
    banco = json.load(open(os.path.join(oraculo.RAIZ, 'ferramentas', 'calibra', 'banco.json')))
    freq = {}
    for deck in banco.values():
        vistos = set()
        for l in deck['lista'].splitlines():
            m = re.match(r'\s*(\d+)x?\s+(.+?)\s*$', l)
            if not m: continue
            nome = re.sub(r'\s*\([A-Z0-9]+\).*$', '', m.group(2))  # tira "(SET) 123"
            c = oraculo.acha(nome)
            nome = c['name'] if c else nome
            if nome in BASICOS or nome in vistos: continue
            vistos.add(nome); freq[nome] = freq.get(nome, 0) + 1
    return sorted(freq.items(), key=lambda x: (-x[1], x[0]))

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = int(args[0]) if args else 50
    feitas = oraculo.nossas()
    toda = fila()
    sem = [x for x in toda if not oraculo.acha(x[0])]
    lista = toda if '--todas' in sys.argv else [x for x in toda if x[0] not in feitas]
    for i, (nome, k) in enumerate(lista[:n], 1):
        print(f'{i:4} {k:3}  {nome}' + ('  (escrita)' if nome in feitas else ''))
    print(f'-- {len(toda)} cartas no banco de 30, {len(set(feitas.values()))} escritas, {sum(1 for x in toda if x[1]>=3)} em 3+ decks'
          + (f', {len(sem)} sem Oracle: ' + ', '.join(x[0] for x in sem[:10]) if sem else ''), file=sys.stderr)
