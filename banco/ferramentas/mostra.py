#!/usr/bin/env python3
"""Mostra o Oracle e o esqueleto (cabeçalho do Scryfall) das próximas cartas da fila, para escrever à mão.
uso: python3 banco/ferramentas/mostra.py [N=10] | python3 banco/ferramentas/mostra.py "Nome" …"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oraculo, fila

args = sys.argv[1:]
if args and not args[0].isdigit(): nomes = args
else:
    feitas = oraculo.nossas(); n = int(args[0]) if args else 10
    nomes = [x for x, _ in fila.fila() if x not in feitas][:n]
for nm in nomes:
    c = oraculo.acha(nm)
    if not c: print('## sem Oracle:', nm); continue
    print('##', c['name'], '|', c.get('type_line'), '|', os.path.basename(oraculo.arquivo_de(c['name'])))
    print(oraculo.texto(c))
    print(json.dumps(oraculo.esqueleto(c), ensure_ascii=False, separators=(',', ':')))
    print()
