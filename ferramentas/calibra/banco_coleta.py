# Banco de teste: 30 decks médios do EDHREC variados (tema, tribo, cor), com a lista completa.
# Os 4 exemplos do site ficam de fora: as regras não podem ser calibradas por eles.
# Uso: servidor local na 8765 e ~/.venv-pw/bin/python ferramentas/calibra/banco_coleta.py
import json, os
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
dados = json.load(open(os.path.join(D, 'decks.json')))
FORA = {'Stangg, Echo Warrior', 'Krenko, Mob Boss', 'Lathril, Blade of the Elves', 'Edgar Markov'}
esc, cores = [], set()
por_tema = {}
for path, r in dados.items():
    if r['tema'].startswith('geral') or r['nome'] in FORA or not r.get('cmd'): continue
    por_tema.setdefault(r['tema'], []).append((int(r['num']), path, r))
for t, l in por_tema.items(): l.sort(reverse=True)
usados = set()
for t, l in por_tema.items():  # 1 por tema/tribo (o mais jogado, sem repetir comandante)
    x = next((x for x in l if x[2]['nome'] not in usados), None)
    if x: esc.append(x); cores.add(x[2]['cmd']['ci']); usados.add(x[2]['nome'])
extra = []
for t, l in sorted(por_tema.items()):  # 2º comandante de outra identidade, nos temas que não são tribo
    if t.startswith('tribe'): continue
    for x in l[1:]:
        if x[2]['cmd']['ci'] not in cores and x[2]['nome'] not in usados: extra.append(x); cores.add(x[2]['cmd']['ci']); break
esc += extra[: 30 - len(esc)]
JS = r"""async (path) => { const r = await fetch('https://json.edhrec.com/pages/average-decks/' + path + '.json'); if (!r.ok) return null;
  const d = await r.json(); if (!d.deck || !d.deck.cards) return null; const out = [];
  for (const [g, arr] of Object.entries(d.deck.cards)) for (const [nm, q] of arr) out.push([nm, q]); return out; }"""
banco = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto('http://localhost:8765/')
    for num, path, r in esc:
        l = pg.evaluate(JS, path)
        if not l: print('falhou', path); continue
        nome = r['nome']; resto = [(n, q) for n, q in l if n != nome]
        txt = 'Commander\n1 ' + nome + '\n\nDeck\n' + '\n'.join(f'{q} {n}' for n, q in resto)
        banco[path] = {'nome': nome, 'tema': r['tema'], 'ci': r['cmd']['ci'], 'cartas': sum(q for _, q in resto) + 1, 'lista': txt}
        print(len(banco), path, r['cmd']['ci'], banco[path]['cartas'], flush=True)
        pg.wait_for_timeout(300)
    b.close()
json.dump(banco, open(os.path.join(D, 'banco.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(banco))
