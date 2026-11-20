#!/usr/bin/env python3
"""Cartas que ficaram sem preço em dólar na cards-db (a impressão que o bulk "Oracle Cards" do Scryfall
escolheu não tem preço): busca a impressão MAIS BARATA com preço (usd, senão usd_foil/usd_etched)
e grava em precos-extra.json {nome: usd}. Depois: python3 ferramentas/precos/aplica.py
uso: python3 ferramentas/precos/sem_preco.py   (~10 consultas por segundo, respeita o limite do Scryfall)
"""
import json, os, time, urllib.request, urllib.parse
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
raw = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
db = json.loads(raw[raw.index('{'):raw.rindex('}') + 1]); F = {f: i for i, f in enumerate(db['fields'])}
alvo = [n for n, c in db['cards'].items() if not c[F['usd']] and not c[F['ban']]]
SAI = os.path.join(AQUI, 'precos-extra.json')
out = json.load(open(SAI)) if os.path.exists(SAI) else {}
H = {'User-Agent': 'raio-x-deck/1.0', 'Accept': 'application/json'}
def busca(n):
    q = urllib.parse.quote(f'!"{n.split(" // ")[0]}" unique:prints')
    url = f'https://api.scryfall.com/cards/search?q={q}&order=usd&dir=asc'
    melhor = None
    while url:
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=20))
        except Exception:
            return None
        for c in d.get('data', []):
            p = c.get('prices') or {}
            v = next((float(p[k]) for k in ('usd', 'usd_foil', 'usd_etched') if p.get(k)), None)
            if v and (melhor is None or v < melhor): melhor = v
        url = d.get('next_page') if melhor is None else None
        time.sleep(0.1)
    return melhor
pend = [n for n in alvo if n not in out]
print(len(alvo), 'sem preço;', len(pend), 'a buscar')
for i, n in enumerate(pend):
    out[n] = busca(n); time.sleep(0.1)
    if i % 200 == 0: json.dump(out, open(SAI, 'w'), ensure_ascii=False); print(i, n, out[n], flush=True)
json.dump(out, open(SAI, 'w'), ensure_ascii=False)
print('com preço achado:', sum(1 for v in out.values() if v), 'de', len(out))
