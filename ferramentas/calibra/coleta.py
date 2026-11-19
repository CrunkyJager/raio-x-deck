# Calibração das metas do Montar (Passo 3): lê decks médios do EDHREC e conta funções com a régua do site.
# Uso: servidor local na 8765 (python3 -m http.server 8765) e ~/.venv-pw/bin/python ferramentas/calibra/coleta.py
import json, sys, os
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(__file__), 'decks.json')
TEMAS = {'voltron':'voltron','tokens':'tokens','counters':'plus-1-plus-1-counters','graveyard':'graveyard','artifacts':'artifacts','enchant':'enchantress','spells':'spellslinger','sac':'aristocrats','life':'lifegain','lands':'landfall','combat':'aggro','draw':'card-draw','flying':'flying'}
TRIBOS = ['elves','goblins','zombies','dragons','vampires','merfolk','angels','dinosaurs','wizards','humans','slivers','cats']
JS_TOP = r"""async (tag) => { const r = await fetch('https://json.edhrec.com/pages/tags/' + tag + '.json'); if (!r.ok) return [];
  const d = await r.json(); const l = d.container.json_dict.cardlists.find(x => x.tag === 'topcommanders'); return l ? l.cardviews.map(c => [c.sanitized, c.name, c.num_decks]) : []; }"""
JS = r"""async (path) => {
  const R = window.RAIOX, OK = new Set(['pedra','dork','terreno','tesouro']);
  const r = await fetch('https://json.edhrec.com/pages/average-decks/' + path + '.json'); if (!r.ok) return null;
  const d = await r.json(); if (!d.deck || !d.deck.cards) return null;
  const cnt = {lands:0, spells:0, semdb:0, ramp:0, rampTudo:0, draw:0, removal:0, wipe:0, protect:0, counter:0, tutor:0}; let sv = 0;
  for (const [g, arr] of Object.entries(d.deck.cards)) for (const [nm, q] of arr) {
    const c = R.C(R.lookupName(nm) || nm); if (!c) { cnt.semdb += q; continue; }
    if (R.isLand(c)) { cnt.lands += q; continue; }
    cnt.spells += q; sv += c.v * q; if (R.isTutor(c)) cnt.tutor += q;
    for (const k of R.rolesOf(c)) { if (k === 'ramp') { cnt.rampTudo += q; if (OK.has(R.tipoRamp(c))) cnt.ramp += q; } else if (k in cnt) cnt[k] += q; }
  }
  cnt.media = cnt.spells ? sv / cnt.spells : 0;
  const cm = (d.commanders || d.header || ''); cnt.header = d.header;
  return cnt; }"""
JS_CMD = r"""(nome) => { const R = window.RAIOX; const c = R.C(R.lookupName(nome) || nome); return c ? {v: c.v, ci: c.ci || c.c || '', o: c.o} : null; }"""
dados = json.load(open(OUT)) if os.path.exists(OUT) else {}
def salva(): json.dump(dados, open(OUT, 'w'), ensure_ascii=False, indent=0)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto('http://localhost:8765/'); pg.wait_for_function("window.RAIOX && window.RAIOX.C(\"Sol Ring\")", timeout=60000)
    tarefas = []  # (chave, path, tema, nome)
    tops = {}
    for k, tag in list(TEMAS.items()) + [('tribe:' + t, t) for t in TRIBOS]:
        tops[k] = pg.evaluate(JS_TOP, tag)[: (10 if not k.startswith('tribe') else 3)]
        for slug, nome, nd in tops[k]: tarefas.append((f'{slug}/{tag}', k, nome, nd))
    # amostra para bracket e orçamento: o mais jogado de cada tema (sem tema = deck geral do comandante)
    amostra = []
    for k in TEMAS: 
        for slug, nome, nd in tops[k][:3]:
            if slug not in [a[0] for a in amostra]: amostra.append((slug, nome, nd))
    for slug, nome, nd in amostra:
        for v in ['', '/budget', '/exhibition', '/core', '/upgraded', '/optimized']: tarefas.append((slug + v, 'geral' + v, nome, nd))
    print(len(tarefas), 'decks', flush=True)
    for i, (path, k, nome, nd) in enumerate(tarefas):
        if path in dados: continue
        try: r = pg.evaluate(JS, path)
        except Exception as e: r = None; print('erro', path, e)
        if r: r.update(tema=k, nome=nome, num=nd, cmd=pg.evaluate(JS_CMD, nome)); dados[path] = r
        if i % 20 == 0: salva(); print(i, path, flush=True)
        pg.wait_for_timeout(250)
    salva(); b.close()
print('ok', len(dados))
