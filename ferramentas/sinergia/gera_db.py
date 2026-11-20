#!/usr/bin/env python3
"""Gera sinergia-db.js (raiz do site) a partir de efeitos.json (saída do extrai.py).
Dados derivados dos roteiros de cartas do Forge (GPL-3.0, github.com/Card-Forge/forge).

Formato: window.SINERGIA = {"Nome": [{alimenta}, {consome}]}, valores x10 inteiros.
Códigos: f ficha, e criatura entrando, m criatura morrendo, c marcador +1/+1, v ganho de vida, a artefato,
n encantamento, s mágica (instantânea/feitiço), g cemitério, t terreno entrando, k ataque, x anexo (aura/equipamento),
d compra; "T:Elf" = tribo.
uso: python3 ferramentas/sinergia/extrai.py && python3 ferramentas/sinergia/gera_db.py
"""
import json, os
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
COD = {'ficha': 'f', 'entra': 'e', 'morre': 'm', 'p1p1': 'c', 'vida': 'v', 'artefato': 'a', 'encant': 'n', 'magia': 's',
       'cemit': 'g', 'terreno': 't', 'ataque': 'k', 'anexo': 'x', 'compra': 'd'}
ef = json.load(open(os.path.join(AQUI, 'efeitos.json')))
raw = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
nomes = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])['cards'].keys()
def cv(d):
    o = {}
    for k, v in d.items():
        c = 'T:' + k[6:] if k.startswith('tribo:') else COD.get(k)
        if c and round(v * 10): o[c] = round(v * 10)
    return o
out = {}
for n in nomes:
    e = ef.get(n) or ef.get(n.split(' // ')[0])
    if not e: continue
    p, u = cv(e['p']), cv(e['u'])
    if p or u: out[n] = [p, u]
txt = '// Sinergia: o que cada carta alimenta e consome, lido dos roteiros do Forge (GPL-3.0). Gerado por ferramentas/sinergia/gera_db.py\nwindow.SINERGIA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(RAIZ, 'sinergia-db.js'), 'w', encoding='utf-8').write(txt)
print(len(out), 'cartas,', len(txt) // 1024, 'KB')
