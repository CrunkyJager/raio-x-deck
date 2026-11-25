# T44: diff carta a carta das funções e do peso (efetiv) com o banco próprio × sem ele (etiquetas + regex), nos decks do banco.json.
# Uso: servidor na 8765 (`npx vite --port 8765 --strictPort`); ~/.venv-pw/bin/python ferramentas/calibra/t44_diff.py
# Grava ferramentas/calibra/t44-diff.json (tudo) e t44-diff.md (resumo, por função, e as mudanças mais pesadas).
import json, os, time, collections
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
banco = json.load(open(os.path.join(D, 'banco.json')))
JS = """([lista, sem]) => { const R = window.RAIOX; R.semBanco(sem); const A = R.analyze(lista); const out = {};
  for (const c of A.uniq.concat(A.cmds)) { if (/Land/.test(c.t.split(' // ')[0])) continue; const e = R.efetiv(A, c);
    out[c.name] = { f: [...R.rolesOf(c)].sort(), v: Object.fromEntries(Object.entries(e.v).map(([k, x]) => [k, Math.round(x * 100) / 100])), why: e.why }; }
  R.semBanco(false); return out; }"""
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('http://localhost:8765/?x=%d' % time.time()); pg.wait_for_function("!!(window.RAIOX && window.RAIOX.semBanco)", timeout=120000)
    for path, d in banco.items():
        antes = pg.evaluate(JS, [d['lista'], True]); depois = pg.evaluate(JS, [d['lista'], False])
        for n in depois:
            a, z = antes.get(n), depois[n]
            if not a: continue
            r = res.setdefault(n, {'decks': [], 'antes': a, 'depois': z}); r['decks'].append(path)
    b.close()
porF = collections.Counter(); ganhou = collections.Counter(); perdeu = collections.Counter(); mud = []
for n, r in res.items():
    fa, fz = set(r['antes']['f']), set(r['depois']['f'])
    for k in fz - fa: ganhou[k] += 1
    for k in fa - fz: perdeu[k] += 1
    va, vz = r['antes']['v'], r['depois']['v']
    dv = {k: round(vz.get(k, 0) - va.get(k, 0), 2) for k in set(va) | set(vz) if abs(vz.get(k, 0) - va.get(k, 0)) >= 0.01}
    r['dv'] = dv; r['peso'] = round(sum(abs(x) for x in dv.values()), 2)
    if fa != fz or dv: mud.append(n)
    for k in fa ^ fz: porF[k] += 1
json.dump(res, open(os.path.join(D, 't44-diff.json'), 'w'), ensure_ascii=False, indent=1)
L = [f'# T44: funções com o banco × sem o banco', '', f'{len(res)} cartas (não terreno) dos {len(banco)} decks; {sum(1 for n in res if set(res[n]["antes"]["f"]) != set(res[n]["depois"]["f"]))} mudaram de função; {len(mud)} mudaram função ou peso.', '',
     '| função | ganhou | perdeu |', '|---|---|---|'] + [f'| {k} | {ganhou[k]} | {perdeu[k]} |' for k in sorted(porF, key=lambda k: -porF[k])]
L += ['', '## Mudanças mais pesadas (soma de |Δ peso| nas funções principais)', '']
for n in sorted(mud, key=lambda n: -res[n]['peso'])[:60]:
    r = res[n]; fa, fz = set(r['antes']['f']), set(r['depois']['f'])
    L.append(f"- **{n}** ({r['peso']}): " + ', '.join([f'+{k}' for k in sorted(fz - fa)] + [f'−{k}' for k in sorted(fa - fz)]) + (' · ' if fa ^ fz and r['dv'] else '') + ', '.join(f"{k} {r['antes']['v'].get(k, 0)}→{r['depois']['v'].get(k, 0)}" for k in r['dv']))
L += ['', 'Todas as cartas: t44-diff.json (antes/depois: funções, peso e porquê).']
open(os.path.join(D, 't44-diff.md'), 'w').write('\n'.join(L) + '\n')
print('\n'.join(L[:40]))
