# T05: candidatos do gabarito de planos a partir das tags do EDHREC (só teste offline; nada vai pro site).
# Para cada plano (planejamento/planos.md) pega os comandantes mais jogados nas tags dele,
# depois lê as tags de cada comandante para propor principal + secundário. Revisão humana depois.
# Uso: python3 ferramentas/gabarito/coleta.py   → edhrec_bruto.json + candidatos.json
import json, os, time, urllib.request
D = os.path.dirname(os.path.abspath(__file__))
PLANOS = {  # nº do plano → tags do EDHREC
 1:['voltron','equipment','auras'], 2:['go-wide'], 3:['aggro','weenies'], 4:['stompy'], 5:['infect'],
 6:['extra-combats'], 7:['tempo','ninjutsu','bounce'], 8:['sneak-attack','cascade','discover'],
 9:['aristocrats'], 10:['group-slug','burn'], 11:['lifedrain','lifegain'], 12:['landfall'], 13:['lands-matter'],
 14:['blink','etb'], 15:['enchantress','artifacts'], 16:['spellslinger'], 17:['storm'], 18:['extra-turns'],
 19:['x-spells'], 20:['reanimator'], 21:['self-mill','dredge','flashback'], 22:['mill'], 23:['control','counterspells'],
 24:[], 25:['stax','prison'], 26:['land-destruction'], 27:['theft','clones'], 28:['wheels','discard'],
 29:['politics','forced-combat','monarch','voting'], 30:['pillow-fort','turbo-fog'], 31:['group-hug'],
 32:['chaos','coin-flip','die-roll'], 33:['planeswalkers','proliferate'], 34:['combo'], 35:['doomsday'], 36:['toolbox','birthing-pod'],
}
TAG2P = {t: p for p, ts in PLANOS.items() for t in ts}
FORA = {'Stangg, Echo Warrior', 'Krenko, Mob Boss', 'Lathril, Blade of the Elves', 'Edgar Markov'}
POR_PLANO, TOP = 3, 5  # até 3 por plano, de identidades diferentes
# planos sem tag no EDHREC (24 limpa e reconstrói, 35 vitória alternativa) e clássicos que a popularidade esconde
MANUAL = {'Child of Alara': (24, 'child-of-alara'), 'Avacyn, Angel of Hope': (24, 'avacyn-angel-of-hope'),
  'Purphoros, God of the Forge': (10, 'purphoros-god-of-the-forge'), 'Ghalta, Primal Hunger': (4, 'ghalta-primal-hunger'),
  'Talrand, Sky Summoner': (16, 'talrand-sky-summoner'), 'Meren of Clan Nel Toth': (20, 'meren-of-clan-nel-toth'),
  'Kinnan, Bonder Prodigy': (34, 'kinnan-bonder-prodigy'), 'Oloro, Ageless Ascetic': (11, 'oloro-ageless-ascetic'),
  'Jodah, the Unifier': (8, 'jodah-the-unifier'), 'Phenax, God of Deception': (22, 'phenax-god-of-deception'),
  # 35: Scryfall is:commander o:"win the game" (23/11)
  'Knuckles the Echidna': (35, 'knuckles-the-echidna'), 'Ramses, Assassin Lord': (35, 'ramses-assassin-lord'),
  'Zenos yae Galvus // Shinryu, Transcendent Rival': (35, 'zenos-yae-galvus')}
def get(path):
    for i in range(3):
        try:
            r = urllib.request.Request('https://json.edhrec.com/pages/' + path + '.json', headers={'User-Agent': 'Mozilla/5.0'})
            return json.load(urllib.request.urlopen(r, timeout=20))
        except Exception as e: err = e; time.sleep(2)
    print('falhou', path, err); return None
B = os.path.join(D, 'edhrec_bruto.json')  # cache: apague para baixar de novo
bruto = json.load(open(B)) if os.path.exists(B) else {'tags': {}, 'cmd': {}}
for p, ts in PLANOS.items():
    for t in ts:
        if t in bruto['tags']: continue
        d = get('tags/' + t); time.sleep(0.4)
        if not d: continue
        cl = next((c for c in d['container']['json_dict']['cardlists'] if c.get('header') == 'Top Commanders'), None)
        bruto['tags'][t] = [(v['name'], v['sanitized'], v.get('num_decks', 0), v.get('potential_decks', 0)) for v in (cl or {}).get('cardviews', [])]
def cmd(n, s):  # tags do próprio comandante (com cache)
    if n in bruto['cmd']: return bruto['cmd'][n]
    d = get('commanders/' + s); time.sleep(0.4)
    if not d: return None
    tl = d['panels'].get('taglinks', []); card = d['container']['json_dict'].get('card', {})
    ci = ''.join(c for c in 'WUBRG' if c in (card.get('color_identity') or []))
    bruto['cmd'][n] = {'slug': s, 'ci': ci or 'C', 'decks': card.get('num_decks') or sum(x['count'] for x in tl),
                       'tags': [(x['slug'], x['count']) for x in tl[:12]]}
    return bruto['cmd'][n]
escolha = {}  # nome → (plano, tag, slug)
for p, ts in PLANOS.items():  # mais jogados primeiro; o plano tem que estar no top 5 de tags do próprio comandante
    cand = sorted({(n, s, k, t) for t in ts for n, s, k, pot in bruto['tags'].get(t, [])}, key=lambda x: -x[2])
    pegou, cis = 0, set()
    for n, s, k, t in cand:
        if pegou >= POR_PLANO: break
        if n in FORA or n in escolha: continue
        c = cmd(n, s)
        if not c or not any(sl in ts for sl, _ in c['tags'][:TOP]): continue
        if c['ci'] in cis: continue  # cores variadas dentro do plano
        escolha[n] = (p, t, s); pegou += 1; cis.add(c['ci'])
for n, (p, s) in MANUAL.items():
    if n not in escolha and cmd(n, s): escolha[n] = (p, 'manual', s)
json.dump(bruto, open(os.path.join(D, 'edhrec_bruto.json'), 'w'), ensure_ascii=False)
cands = []
for n, (p, t, s) in escolha.items():
    c = bruto['cmd'].get(n)
    if not c: continue
    pl = []  # planos pelas tags do comandante, na ordem de contagem
    for sl, k in c['tags']:
        q = TAG2P.get(sl)
        if q and q not in [x[0] for x in pl]: pl.append((q, sl, k))
    top = pl[0][2] if pl else 1
    sec = [q for q, sl, k in pl if q != p and k >= 0.3 * top][:1]
    duv = not pl or pl[0][0] != p
    cands.append({'nome': n, 'ci': c['ci'], 'decks': c['decks'], 'pescado_por': [p, t], 'principal': p,
                  'secundario': sec, 'planos_tags': [[q, sl, k] for q, sl, k in pl[:4]],
                  'tags_top': [sl for sl, k in c['tags'][:6]], 'duvidoso': duv})
json.dump(cands, open(os.path.join(D, 'candidatos.json'), 'w'), ensure_ascii=False, indent=1)
print('candidatos', len(cands), 'duvidosos', sum(x['duvidoso'] for x in cands))
