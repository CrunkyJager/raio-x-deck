#!/usr/bin/env python3
"""Protótipo (fora do site): lê os roteiros do Forge e diz, para cada carta, que RECURSOS ela
PRODUZ (alimenta um tema) e que recursos ela USA (paga por eles). Nada de ler o inglês:
só os campos estruturados (T:Mode$, SP$/AB$/DB$, Cost$, S:, R:, K:, DeckHas/DeckNeeds/DeckHints).

Força de cada ligação: 1.0 = repetida (gatilho, ativada, estática); 0.4 = uma vez (mágica, "quando entra").
Saída: sinergia/efeitos.json  {nome: {"p": {recurso: força}, "u": {recurso: força}}}
"""
import json, os, re, sys

PASTA = os.path.expanduser('~/projetos/mtg-lab/data/forge/repo/forge-gui/res/cardsfolder')
SAI = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'efeitos.json')

REP, VEZ = 1.0, 0.4
TIPOS_CRI = None  # preenchido com os subtipos de criatura vistos


def kv(s):
    d = {}
    for p in s.split('|'):
        if '$' in p:
            k, v = p.split('$', 1); d[k.strip()] = v.strip()
    return d


def api(s):
    m = re.match(r'\s*(SP|AB|DB)\$\s*(\w+)', s)
    return (m.group(1), m.group(2)) if m else (None, None)


def le(p):
    txt = open(p, encoding='utf-8', errors='replace').read().replace('\r', '')
    faces = []
    for bloco in re.split(r'\n\s*ALTERNATE\s*\n', txt):
        f = {'A': [], 'T': [], 'S': [], 'K': [], 'R': [], 'SVar': {}, 'Deck': []}
        for l in bloco.split('\n'):
            if ':' not in l: continue
            k, v = l.split(':', 1)
            if k == 'SVar':
                n, _, val = v.partition(':'); f['SVar'][n] = val
            elif k in ('A', 'T', 'S', 'K', 'R'): f[k].append(v)
            elif k in ('DeckHas', 'DeckNeeds', 'DeckHints'): f['Deck'].append((k, v))
            elif k in ('Name', 'Types', 'PT', 'ManaCost'): f[k] = v
        faces.append(f)
    return faces


def cadeia(f, inicio, vistos=None):
    """segue Execute$/SubAbility$/Choices$ pelos SVars e devolve as partes (api, params)"""
    vistos = vistos or set(); out = []
    pend = [inicio] if isinstance(inicio, str) else list(inicio)
    while pend:
        s = pend.pop()
        if not s: continue
        if s in f['SVar'] and s not in vistos:
            vistos.add(s); s = f['SVar'][s]
        elif s in vistos: continue
        tp, a = api(s)
        if not a: continue
        d = kv(s); out.append((tp, a, d))
        for k in ('SubAbility', 'Execute'):
            if d.get(k): pend.append(d[k])
        for k in ('Choices', 'Defined'):
            if k == 'Choices' and d.get(k):
                pend += [x.strip() for x in d[k].split(',')]
    return out


TOKEN_ART = re.compile(r'treasure|clue|food|blood|gold|powerstone|map|junk|incubator|shard|_a_|_a$')


def efeito(prod, uso, tp, a, d, forca, self_only_etb=False):
    """um efeito → recursos produzidos/usados"""
    def P(r, x=forca):
        prod[r] = max(prod.get(r, 0), x)
    def U(r, x=forca):
        uso[r] = max(uso.get(r, 0), x)
    n = d.get('TokenAmount') or d.get('Amount') or '1'
    mult = 1.3 if (n.isdigit() and int(n) >= 2) or n == 'X' else 1.0
    if a in ('Token', 'CopyPermanent') and (d.get('TokenScript') or a == 'Token'):
        for ts in (d.get('TokenScript') or '').split(','):
            ts = ts.strip().lower()
            if not ts: continue
            if re.search(r'treasure|clue|food|blood|gold|powerstone|map|junk|incubator', ts) or ts.startswith('c_a_'):
                P('artefato', forca * mult)
                if 'treasure' in ts: P('mana_tesouro', forca * mult)
            else:  # ficha de criatura: cor_força_resistência_tipo
                P('ficha', forca * mult); P('entra', forca * mult)
                partes = ts.split('_')
                for t in partes[3:]:
                    if t and t[0].isalpha() and len(t) > 2: P('tribo:' + t.capitalize(), forca * mult)
    if a in ('PutCounter', 'PutCounterAll') and 'P1P1' in d.get('CounterType', ''):
        P('p1p1', forca * (1.3 if a == 'PutCounterAll' else 1))
    if a == 'Proliferate': P('p1p1', forca * 0.7)
    if a == 'GainLife': P('vida', forca)
    if a in ('Mill', 'Surveil') and d.get('Defined', 'You') in ('You', ''): P('cemit', forca)
    if a == 'Discard' and 'You' in d.get('Defined', 'You'): P('cemit', forca * 0.8)
    if a == 'Dig' and d.get('DestinationZone2', '') == 'Graveyard': P('cemit', forca * 0.6)
    if a == 'Draw': P('compra', forca)
    if a == 'Sacrifice' and d.get('SacValid') and 'Self' not in d.get('SacValid', '') and 'You' in d.get('Defined', 'You') and re.search(r'Creature|Permanent', d['SacValid']):
        P('morre', forca)
    if a == 'ChangeZone':
        o, de, ct = d.get('Origin', ''), d.get('Destination', ''), d.get('ChangeType', '') + d.get('ValidTgts', '')
        if 'Graveyard' in o and de in ('Hand', 'Battlefield', 'Library'): U('cemit', forca)
        if 'Library' in o and de == 'Battlefield' and re.search(r'Land|Forest|Plains|Island|Swamp|Mountain', ct): P('terreno', forca)
        if de == 'Graveyard' and 'Library' in o: P('cemit', forca)
    if a == 'PutOnBattlefield' or (a == 'ChangeZone' and d.get('Destination') == 'Battlefield' and 'Hand' in d.get('Origin', '') and 'Land' in d.get('ChangeType', '')):
        P('terreno', forca)
    if a in ('AddPhase',) and 'Combat' in d.get('ExtraPhase', 'Combat'): P('ataque', forca)
    if a == 'Attach': P('anexo', forca * 0.6)
    if a in ('PumpAll',) and 'Creature.YouCtrl' in d.get('ValidCards', ''): U('ficha', forca * 0.6)


def valid_rec(v, quem='YouCtrl'):
    """o que um ValidCard$ fala (para gatilhos/estáticas que pagam por algo)"""
    r = {}
    if not v: return r
    if re.fullmatch(r'Card\.Self|Creature\.Self|Card\.AttachedBy|Card\.EquippedBy|Card\.EnchantedBy|Creature\.EquippedBy|Creature\.EnchantedBy', v):
        return r
    if 'token' in v and '!token' not in v and 'nonToken' not in v: r['ficha'] = 1
    if re.search(r'\bCreature\b', v) or 'Permanent' in v: r['entra'] = 1
    if re.search(r'\bArtifact\b', v): r['artefato'] = 1
    if re.search(r'\bEnchantment\b', v): r['encant'] = 1
    if re.search(r'\bLand\b', v): r['terreno'] = 1
    if re.search(r'\bEquipment\b|\bAura\b|equipped|enchanted|Equipped|Enchanted', v): r['anexo'] = 1
    if re.search(r'Instant|Sorcery|nonCreature|Card\.nonLand', v): r['magia'] = 1
    if 'counters_GE1_P1P1' in v: r['p1p1'] = 1
    for t in re.findall(r'(?:Creature|Card|Permanent)\.([A-Z][a-z]+)(?=[+,| ]|$)', v):
        if t not in ('Self', 'Other', 'YouCtrl', 'OppCtrl', 'Equipped', 'Enchanted', 'Attacking', 'Blocking', 'Legendary', 'Basic', 'Snow', 'Historic'):
            r['tribo:' + t] = 1
    return r


def carta(faces):
    prod, uso = {}, {}
    f = faces[0]
    tipos = f.get('Types', '')
    # o que a carta É (força fraca: qualquer criatura "entra", qualquer artefato conta para artefatos)
    if 'Creature' in tipos:
        prod['entra'] = 0.25
        sub = tipos.split('Creature', 1)[1].split()
        for t in sub: prod['tribo:' + t] = 1.0
    if 'Artifact' in tipos: prod['artefato'] = max(prod.get('artefato', 0), 0.6)
    if 'Enchantment' in tipos: prod['encant'] = max(prod.get('encant', 0), 0.6)
    if re.search(r'\bInstant\b|\bSorcery\b', tipos): prod['magia'] = 0.6
    if re.search(r'\bEquipment\b|\bAura\b', tipos): prod['anexo'] = 0.9
    for face in faces:
        # habilidades ativadas e mágicas
        for s in face['A']:
            tp, a = api(s); d = kv(s)
            cost = d.get('Cost', '')
            selfsac = bool(re.search(r'Sac<1/CARDNAME>|Sac<1/NICKNAME>', cost))
            forca = VEZ if tp == 'SP' or selfsac else REP
            m = re.search(r'Sac<\d+/([^>/]+)', cost)
            if m and not selfsac and re.search(r'Creature|Permanent|Artifact|Elf|Goblin|Zombie|[A-Z][a-z]+', m.group(1)):
                if re.search(r'Creature|Permanent', m.group(1)): prod['morre'] = max(prod.get('morre', 0), REP)
                if 'Artifact' in m.group(1): uso['artefato'] = max(uso.get('artefato', 0), 0.7)
            for (tp2, a2, d2) in cadeia(face, s):
                efeito(prod, uso, tp2, a2, d2, forca)
        # gatilhos: o que dispara (uso) e o que faz (produção repetida)
        for s in face['T']:
            d = kv(s); modo = d.get('Mode', ''); v = d.get('ValidCard', '')
            self_only = bool(re.fullmatch(r'(Card|Creature)\.Self', v or 'Card.Self')) and modo in ('ChangesZone', 'Attacks', 'DamageDone')
            forca = VEZ if (modo == 'ChangesZone' and self_only and d.get('Destination') == 'Battlefield') else REP
            if modo in ('ChangesZone', 'ChangesZoneAll'):
                de, o = d.get('Destination', ''), d.get('Origin', '')
                if de == 'Battlefield' and not self_only:
                    for r in valid_rec(v): uso[r] = max(uso.get(r, 0), REP)
                if o == 'Battlefield' and de == 'Graveyard' and v and v not in ('Card.Self', 'Creature.Self') and not re.fullmatch(r'[\w.]*OppCtrl[\w.+]*', v):
                    if re.search(r'Creature|Permanent|Card\.Other|Card\.YouCtrl|Artifact', v): uso['morre'] = REP
                    if re.search(r'Artifact', v): uso['artefato'] = max(uso.get('artefato', 0), 0.8)
                    if 'EquippedBy' in v or 'EnchantedBy' in v: uso['morre'] = 0.7
                if o == 'Graveyard': uso['cemit'] = max(uso.get('cemit', 0), REP)
                if de == 'Graveyard' and o in ('Library', 'Hand', 'Any', ''): uso['cemit'] = max(uso.get('cemit', 0), 0.7)
            elif modo in ('Sacrificed', 'Exploited') and not re.fullmatch(r'(Card|Creature)\.Self', v or ''):
                uso['morre'] = REP
            elif modo in ('SpellCast', 'SpellCastOrCopy'):
                vc = d.get('ValidCard', 'Card')
                rr = valid_rec(vc)
                if vc in ('Card', 'Spell', '') or 'nonCreature' in vc: rr['magia'] = 1
                if re.fullmatch(r'Creature.*', vc): rr = {'entra': 1}
                for r in rr: uso[r] = max(uso.get(r, 0), REP)
            elif modo == 'LifeGained': uso['vida'] = REP
            elif modo in ('CounterAdded', 'CounterAddedOnce') and 'P1P1' in d.get('CounterType', 'P1P1'): uso['p1p1'] = REP
            elif modo == 'TokenCreated' or modo == 'TokenCreatedOnce': uso['ficha'] = REP
            elif modo in ('Attacks', 'AttackersDeclared', 'AttackersDeclaredOneTarget'):
                uso['ataque'] = REP if not self_only else 0.5
            elif modo in ('DamageDone', 'DamageDoneOnce') and d.get('CombatDamage') == 'True':
                uso['ataque'] = max(uso.get('ataque', 0), REP if 'Self' not in d.get('ValidSource', 'Self') else 0.5)
                if 'EquippedBy' in d.get('ValidSource', '') or 'EnchantedBy' in d.get('ValidSource', ''): uso['anexo'] = 0.6
            elif modo == 'Drawn' and 'Opp' not in d.get('ValidPlayer', '') + d.get('ValidCard', ''): uso['compra'] = REP
            elif modo in ('Discarded', 'Milled'): uso['cemit'] = max(uso.get('cemit', 0), 0.7)
            elif modo == 'LandPlayed': uso['terreno'] = REP
            elif modo == 'Attached': uso['anexo'] = REP
            ex = d.get('Execute')
            if ex:
                for (tp2, a2, d2) in cadeia(face, ex):
                    efeito(prod, uso, tp2, a2, d2, forca)
        # estáticas
        for s in face['S']:
            d = kv(s); modo = d.get('Mode', '')
            af = d.get('Affected', '') + ' ' + d.get('ValidCard', '')
            if modo == 'Continuous':
                if re.search(r'AddPower|AddToughness|AddKeyword', s) and re.search(r'Creature\.', af) and 'Opp' not in af:
                    rr = valid_rec(af); tri = any(r.startswith('tribo:') for r in rr)
                    for r in rr:
                        if r == 'entra':
                            if not tri: uso['ficha'] = max(uso.get('ficha', 0), 0.6)
                        elif r.startswith('tribo:'): uso[r] = REP
                        elif r in ('artefato', 'encant', 'anexo', 'ficha', 'p1p1'): uso[r] = REP
                    if re.search(r'AddKeyword\$[^|]*(Haste|Flying|Trample|Double Strike|Menace)', s) and 'YouCtrl' in af:
                        prod['ataque'] = max(prod.get('ataque', 0), 0.6)
                if 'AdjustLandPlays' in s: prod['terreno'] = REP
                if re.search(r'Affected\$ Card\.(Equipped|Enchanted|AttachedBy)|AffectedDefined\$ (Equipped|Enchanted)', s):
                    prod['anexo'] = max(prod.get('anexo', 0), 0.9)
            if modo == 'ReduceCost':
                for r in valid_rec(d.get('ValidCard', '')):
                    if r != 'entra': uso[r] = REP
        for s in face['R']:
            d = kv(s); ev = d.get('Event', '')
            if ev == 'CreateToken': uso['ficha'] = REP
            if ev == 'AddCounter' and 'P1P1' in s: uso['p1p1'] = REP
            if ev == 'GainLife': uso['vida'] = REP
            if ev == 'Moved' and d.get('Destination') == 'Graveyard' and 'Exile' in s: pass
        for k in face['K']:
            if k.startswith(('Flashback', 'Escape', 'Unearth', 'Embalm', 'Eternalize', 'Disturb', 'Retrace', 'Jump-start', 'Scavenge', 'Encore')):
                uso['cemit'] = max(uso.get('cemit', 0), 0.4)
            if k.startswith(('Dredge',)): prod['cemit'] = REP
            if k.startswith(('Affinity:Artifact', 'Improvise')): uso['artefato'] = max(uso.get('artefato', 0), 0.7)
            if k.startswith('Prowess'): uso['magia'] = max(uso.get('magia', 0), 0.6)
            if k.startswith('Lifelink'): prod['vida'] = max(prod.get('vida', 0), 0.5)
            if k.startswith(('etbCounter:P1P1', 'Evolve', 'Modular', 'Graft', 'Adapt', 'Bolster', 'Outlast', 'Training', 'Riot')):
                prod['p1p1'] = max(prod.get('p1p1', 0), 0.5)
            if k.startswith(('Haste',)): pass
            if k.startswith('Equip'): prod['anexo'] = max(prod.get('anexo', 0), 0.9)
            if k.startswith('Bestow'): prod['anexo'] = max(prod.get('anexo', 0), 0.7)
        # as dicas de montagem do próprio Forge
        for k, v in face['Deck']:
            for parte in v.split('&'):
                if '$' not in parte: continue
                cat, vals = parte.split('$', 1)
                for x in vals.split('|'):
                    x = x.strip(); r = None
                    if cat.strip() == 'Ability':
                        r = {'Token': 'ficha', 'Counters': 'p1p1', 'LifeGain': 'vida', 'Lifegain': 'vida', 'Sacrifice': None if k == 'DeckHas' else 'morre',
                             'Graveyard': 'cemit', 'Mill': 'cemit', 'Discard': 'cemit', 'Surveil': 'cemit', 'Proliferate': 'p1p1'}.get(x)
                    elif cat.strip() == 'Type':
                        r = {'Artifact': 'artefato', 'Enchantment': 'encant', 'Equipment': 'anexo', 'Aura': 'anexo',
                             'Instant': 'magia', 'Sorcery': 'magia', 'Land': 'terreno'}.get(x)
                        if not r and x[:1].isupper() and x.isalpha() and x not in ('Creature', 'Legendary', 'Planeswalker'): r = 'tribo:' + x
                    if not r: continue
                    if k == 'DeckHas':
                        if r == 'ficha' and prod.get('artefato', 0) >= 1 and 'ficha' not in prod: continue  # Token = tesouro/pista
                        prod[r] = max(prod.get(r, 0), 0.6)
                    else: uso[r] = max(uso.get(r, 0), 0.8 if k == 'DeckNeeds' else 0.6)
    return prod, uso


def tipos_de_criatura():
    tt = set()
    for raiz, _, arqs in os.walk(PASTA):
        for a in arqs:
            if not a.endswith('.txt'): continue
            for l in open(os.path.join(raiz, a), encoding='utf-8', errors='replace'):
                if l.startswith('Types:') and 'Creature' in l:
                    tt.update(x for x in l.split('Creature', 1)[1].split() if x[:1].isupper())
    return tt


def main():
    out = {}
    TRIBOS = tipos_de_criatura()
    for raiz, _, arqs in os.walk(PASTA):
        for a in arqs:
            if not a.endswith('.txt'): continue
            try:
                faces = le(os.path.join(raiz, a))
            except Exception:
                continue
            nome = faces[0].get('Name')
            if not nome: continue
            if len(faces) > 1 and faces[1].get('Name'): nome2 = nome + ' // ' + faces[1]['Name']
            else: nome2 = None
            p, u = carta(faces)
            for d in (p, u):
                for k in [k for k in d if k.startswith('tribo:') and (k[6:] not in TRIBOS or k[6:] in ('Treasure', 'Clue', 'Food', 'Blood', 'Gold', 'Equipment', 'Aura', 'Vehicle'))]: del d[k]
            if p.get('ficha') == 0.6 and not any(k.startswith('tribo:') for k in p if p[k] < 1) and p.get('artefato') and 'entra' not in p or (p.get('ficha') == 0.6 and p.get('entra', 0) <= 0.25 and p.get('artefato')):
                del p['ficha']  # DeckHas Token que é só tesouro/pista
            rnd = lambda d: {k: round(v, 2) for k, v in d.items()}
            out[nome] = {'p': rnd(p), 'u': rnd(u)}
            if nome2: out[nome2] = out[nome]
    json.dump(out, open(SAI, 'w'), ensure_ascii=False)
    print(len(out), 'cartas →', SAI)


if __name__ == '__main__':
    main()
