#!/usr/bin/env python3
"""T13 — conversor Forge (GPL-3.0) + cards-db (Scryfall) → formato RX (ferramentas/rx/esquema.json).

Scryfall/cards-db dá nome, custo, vm, identidade, tipos, poder; o roteiro do Forge dá o comportamento
(A: SP$/AB$, T:, S:, R:, K:). Nada de ler o inglês. O que não entende vai para "falta" (item do Forge),
o motor joga o resto.

uso:  python3 ferramentas/rx/converte_rx.py              (gera cartas-rx.js na raiz + relatório)
      python3 ferramentas/rx/converte_rx.py "Sol Ring" … (mostra só essas cartas)
teste: python3 ferramentas/rx/testa_rx.py
"""
import json, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(RAIZ, 'ferramentas', 'forge'))
from converte import params, tparams, PASTA  # noqa: E402  (reaproveita a leitura do converte.py)

WUBRG = 'WUBRG'
TIPOS = ['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Instant', 'Sorcery', 'Battle', 'Kindred']
SUPER = ['Legendary', 'Basic', 'Snow', 'World']
BASICO = {'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G'}
ZONA = {'Battlefield': 'campo', 'Hand': 'mao', 'Library': 'grimorio', 'Graveyard': 'cemiterio',
        'Exile': 'exilio', 'Stack': 'pilha', 'Command': 'comando', 'Any': 'qualquer'}
COR = {'White': 'W', 'Blue': 'U', 'Black': 'B', 'Red': 'R', 'Green': 'G'}
KW = {'Flying': 'voar', 'Vigilance': 'vigilancia', 'Trample': 'atropelar', 'Lifelink': 'vinculoVida',
      'Haste': 'pressa', 'Indestructible': 'indestrutivel', 'Flash': 'lampejo', 'First Strike': 'primeiroAtaque',
      'Double Strike': 'golpeDuplo', 'Deathtouch': 'toqueMortifero', 'Reach': 'alcance', 'Menace': 'ameaca',
      'Hexproof': 'antimagia', 'Shroud': 'manto', 'Changeling': 'metamorfo', 'Defender': 'defensor', 'Storm': 'tempestade',
      'Prowess': 'proeza', 'Ascend': 'ascender', 'Melee': 'corpo-a-corpo', 'Evolve': 'evoluir', 'Persist': 'persistir',
      'Myriad': 'miriade', 'Partner': 'parceiro', 'Choose a Background': 'escolhaAntecedente', 'Mentor': 'mentor',
      'Convoke': 'convocar', 'Improvise': 'improvisar', 'Umbra armor': 'armaduraUmbra', 'Offspring': 'prole'}
# palavra-chave com custo de mana depois de ':'
KWC = {'Equip': 'equipar', 'Cycling': 'ciclar', 'Overload': 'sobrecarga', 'Flashback': 'flashback',
       'Madness': 'loucura', 'Kicker': 'chute', 'Foretell': 'prever', 'Eternalize': 'eternizar', 'Echo': 'eco',
       'Encore': 'bis', 'Crew': 'tripular', 'Fabricate': 'fabricar', 'Afterlife': 'posVida', 'Mobilize': 'mobilizar',
       'Hideaway': 'esconderijo', 'Affinity': 'afinidade', 'Ward': 'resguardo', 'Enchant': 'encantar',
       'Partner with': 'parceiroCom', 'TypeCycling': 'cicloTipo', 'Protection': 'protecao', 'Gift': 'ofertaPresente'}
KW_N = {'tripular', 'fabricar', 'posVida', 'mobilizar', 'esconderijo'}  # parâmetro é número, não custo


# ------------------------------------------------------------------ leitura
def le_faces(p):
    txt = open(p, encoding='utf-8', errors='replace').read().replace('\r', '')
    out = []
    for b in re.split(r'\n\s*ALTERNATE\s*\n', txt):
        f = {'A': [], 'T': [], 'S': [], 'K': [], 'R': [], 'SVar': {}}
        for l in b.split('\n'):
            k, s, v = l.partition(':')
            if not s:
                continue
            if k == 'SVar':
                n, _, val = v.partition(':'); f['SVar'][n] = val
            elif k in ('A', 'T', 'S', 'K', 'R'):
                f[k].append(v)
            elif k in ('Name', 'Types', 'ManaCost', 'PT', 'Loyalty', 'AlternateMode', 'Colors'):
                f[k] = v
        out.append(f)
    return out


def le_db():
    s = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
    db = json.loads(s[s.index('{'):s.rindex('}') + 1])
    return db['fields'], db['cards']


def wubrg(s):
    return ''.join(c for c in WUBRG if c in s)


# ------------------------------------------------------------------ custos
def mana_scry(m):
    """'{2}{R}{R}' → {'g':2,'p':['R','R']} (Scryfall)"""
    out, p = {}, []
    for s in re.findall(r'\{([^}]+)\}', m or ''):
        if s.isdigit():
            out['g'] = out.get('g', 0) + int(s)
        elif s == 'X':
            out['x'] = out.get('x', 0) + 1
        else:
            p.append(s)
    if p:
        out['p'] = p
    return out


def mana_forge(s):
    """'1 G' / 'X R R' / 'W/U 2/B B/P' (Forge) → mana RX; None se tiver algo que não é mana"""
    out, p = {}, []
    for t in s.split():
        if t.isdigit():
            out['g'] = out.get('g', 0) + int(t)
        elif t == 'X':
            out['x'] = out.get('x', 0) + 1
        elif re.fullmatch(r'[WUBRGCS]', t):
            p.append(t)
        elif re.fullmatch(r'[WUBRG2]/[WUBRGP]', t):
            p.append(t)
        elif re.fullmatch(r'[WUBRG]{2}', t):  # híbrido escrito 'WU'
            p.append(t[0] + '/' + t[1])
        else:
            return None
    if p:
        out['p'] = p
    return out


def custo_atv(s, falta):
    """Cost$ do Forge → custoAtv RX (+ lealdade)"""
    c, mana, leal = {}, [], None
    for t in (s or '').split():
        if t == 'T':
            c['virar'] = True
        elif t == 'Q':
            c['desvirar'] = True
        elif re.fullmatch(r'Sac<1/(CARDNAME|NICKNAME)>', t):
            c['sacrificar'] = 'este'
        elif m := re.fullmatch(r'Sac<(\d+)/([^/>]+)(?:/[^>]*)?>', t):
            c['sacrificar'] = {'f': filtro(m.group(2), falta), 'qtd': int(m.group(1))}
        elif m := re.fullmatch(r'PayLife<(\d+)>', t):
            c['vida'] = int(m.group(1))
        elif m := re.fullmatch(r'Discard<(\d+)/[^>]*>', t):
            c['descartar'] = int(m.group(1))
        elif m := re.fullmatch(r'AddCounter<(\d+)/LOYALTY>', t):
            leal = int(m.group(1))
        elif m := re.fullmatch(r'SubCounter<(\d+)/LOYALTY>', t):
            leal = -int(m.group(1))
        elif m := re.fullmatch(r'SubCounter<(\d+)/([A-Z0-9_+-]+)>', t):
            c['tirarMarcador'] = {'tipo': m.group(2).lower(), 'qtd': int(m.group(1))}
        elif m := re.fullmatch(r'tapXType<(\d+)/([^/>]+)(?:/[^>]*)?>', t):
            fo = filtro(m.group(2), falta)
            fo.setdefault('ctrl', 'voce'); fo.setdefault('virada', False)  # virar N desviradas suas
            c['virarOutros'] = {'f': fo, 'qtd': int(m.group(1))}
        elif mana_forge(t) is not None:
            mana.append(t)
        else:
            falta.append('Cost:' + t)
    if mana:
        m = mana_forge(' '.join(mana))
        if m:
            c['mana'] = m
    return c, leal


# ------------------------------------------------------------------ filtros
def filtro(v, falta, zona=None):
    """ValidTgts/ValidCard do Forge ('Creature.OppCtrl+nonBlack,Artifact') → filtro RX.
    Alternativas com ',' só se tiverem os mesmos qualificadores (junta os tipos)."""
    alts = [a.strip() for a in v.split(',') if a.strip()]
    f = {}
    quals = None
    for a in alts:
        base, _, q = a.partition('.')
        qs = tuple(sorted(x for x in re.split(r'[+.]', q) if x))
        if quals is None:
            quals = qs
        elif qs != quals:
            falta.append('filtro:' + v); break
        if base in ('Card', 'Permanent', 'Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker',
                    'Instant', 'Sorcery', 'Battle', 'Spell', 'Token'):
            if base != 'Card' or len(alts) > 1:
                f.setdefault('tipo', []).append(base)
        elif base in BASICO or re.fullmatch(r'[A-Z][a-z]+', base):
            f.setdefault('sub', []).append(base)
        else:
            falta.append('filtro:' + a)
    for q in quals or ():
        if q in ('Self', 'StrictlySelf'):
            f['este'] = True
        elif q == 'YouDontCtrl':
            f['ctrl'] = 'oponente'
        elif q == 'untapped':
            f['virada'] = False
        elif q == 'ChosenType':
            f.setdefault('sub', []).append('escolhido')
        elif q == 'Other':
            f['outro'] = True
        elif q == 'YouCtrl':
            f['ctrl'] = 'voce'
        elif q in ('OppCtrl', 'OppOwn' if False else 'OppCtrl'):
            f['ctrl'] = 'oponente'
        elif q == 'YouOwn':
            f['dono'] = 'voce'
        elif q == 'OppOwn':
            f['dono'] = 'oponente'
        elif q in SUPER:
            f.setdefault('super', []).append(q)
        elif q == 'token':
            f['ficha'] = True
        elif q == 'nonToken':
            f.setdefault('nao', []).append('Token')
        elif q == 'Attached':
            f['anexadoA'] = 'este'
        elif q == 'EquippedBy' or q == 'AttachedBy':
            f['equipada'] = True
        elif q == 'tapped':
            f['virada'] = True
        elif q == 'attacking':
            f['atacando'] = True
        elif q == 'IsCommander':
            f['comandante'] = True
        elif q in COR:
            f['cor'] = COR[q]
        elif m := re.fullmatch(r'non(\w+)', q):
            n = m.group(1)
            f.setdefault('nao', []).append(n)  # nonLand, nonBasic, nonBlack… (cor fica pelo nome)
        elif m := re.fullmatch(r'(cmc|power|toughness)(LE|GE|LT|GT|EQ)(\d+)', q):
            k = {'cmc': 'vm', 'power': 'poder', 'toughness': 'resist'}[m.group(1)]
            n, op = int(m.group(3)), m.group(2)
            f[k] = {'GE': {'min': n}, 'GT': {'min': n + 1}, 'LE': {'max': n}, 'LT': {'max': n - 1}, 'EQ': {'igual': n}}[op]
        elif re.fullmatch(r'[A-Z][a-z]+', q):  # Card.Vampire: subtipo como qualificador
            f.setdefault('sub', []).append(q)
        else:
            falta.append('filtro:.' + q)
    if f.get('sub'):
        f['sub'] = sorted(f['sub'])
    if f.get('este') and f.get('tipo'):
        f.pop('tipo')  # Creature.Self = a própria carta
    if zona:
        f['zona'] = zona
    return f


def jogador(v, padrao='voce'):
    return {'': padrao, None: padrao, 'You': 'voce', 'Player.Opponent': 'cadaOponente', 'Opponent': 'cadaOponente',
            'Player': 'cadaJogador', 'Targeted': 'alvoJogador', 'TargetedPlayer': 'alvoJogador',
            'TargetedController': 'controlador', 'TargetedOwner': 'dono', 'TriggeredPlayer': 'doEvento',
            'TriggeredActivator': 'doEvento', 'TriggeredCardController': 'doEvento',
            'TriggeredSourceController': 'doEvento', 'TriggeredTarget': 'doEvento',
            'Opponent.Next': 'proximo'}.get(v)


# ------------------------------------------------------------------ quantidades
def qtd(v, svars, falta, ctx):
    if v is None or v == '':
        return 1
    if re.fullmatch(r'-?\d+', v):
        return int(v)
    sv = svars.get(v, '')
    if m := re.fullmatch(r'Number\$(\d+)', sv):
        return int(m.group(1))
    if sv in ('Count$xPaid', 'Count$CastTotalManaSpent') or v == 'X' and not sv:
        return 'X'
    if m := re.fullmatch(r'Count\$Valid(?:Battlefield)? ([^/]+?)(/Times\.(\d+))?', sv):
        f = filtro(m.group(1), falta, 'campo')
        f.setdefault('ctrl', 'qualquer')
        q = {'conta': f}
        if m.group(3):
            q['mult'] = int(m.group(3))
        return q
    if sv in ('Count$InYourHand', 'Count$CardsInYourHand'):
        return {'conta': 'cartasNaMao'}
    if re.fullmatch(r'(Remembered|Targeted)(LKI)?\$CardManaCost', sv):
        return {'conta': 'vmDoAlvo', 'alvo': max(ctx['ultAlvo'], 0)}
    if re.fullmatch(r'(Remembered|Targeted)(LKI)?\$CardPower', sv):
        return {'conta': 'poderDoAlvo', 'alvo': max(ctx['ultAlvo'], 0)}
    if sv == 'Count$OppsInGame' or sv == 'PlayerCountOpponents$Amount':
        return {'conta': 'oponentes'}
    if sv == 'TriggerCount$DamageAmount':
        return {'conta': 'danoCausado'}
    if sv == 'TriggerCount$LifeAmount':
        return {'conta': 'vidaGanha'}
    if sv.startswith('TriggerCount$'):
        return {'conta': 'evento'}
    falta.append(f'qtd:{v}={sv}')
    return 1


# ------------------------------------------------------------------ efeitos
def alvo_de(d, ctx, falta, zona):
    """ValidTgts$/TargetType$ → índice em ctx['alvos'] (ou None)"""
    vt, tt = d.get('ValidTgts'), d.get('TargetType')
    if not vt and not tt:
        return None
    if tt == 'Spell' or (vt or '').startswith('Card') and zona == 'pilha':
        f = 'magica'
    elif vt == 'Any':
        f = 'qualquerAlvo'
    elif vt == 'Player':
        f = 'jogador'
    elif vt == 'Opponent':
        f = 'oponente'
    else:
        f = filtro(vt, falta, zona)
        if zona == 'cemiterio' and 'dono' not in f:
            f['dono'] = 'qualquer'
    a = {'f': f}
    if 'TargetMin' in d:
        a['min'] = qtd(d['TargetMin'], ctx['sv'], falta, ctx)
        if not isinstance(a['min'], int): a.pop('min')
    if 'TargetMax' in d:
        a['max'] = qtd(d['TargetMax'], ctx['sv'], falta, ctx)
        if not isinstance(a['max'], int): a.pop('max')
    ctx['alvos'].append(a)
    ctx['ultAlvo'] = len(ctx['alvos']) - 1
    return ctx['ultAlvo']


def em_de(d, ctx, falta, zona='campo'):
    """objeto afetado: alvo novo, alvo anterior (Defined$ Targeted), este, equipada…"""
    i = alvo_de(d, ctx, falta, zona)
    if i is not None:
        return {'alvo': i}
    df = d.get('Defined', '')
    if df in ('Targeted', 'ParentTarget', 'TargetedCard') and ctx['ultAlvo'] >= 0:
        return {'alvo': ctx['ultAlvo']}
    if df == 'Self':
        return 'este'
    if df == 'Equipped' or df == 'Enchanted':
        return 'equipada'
    if df in ('TriggeredCard', 'TriggeredCardLKICopy', 'TriggeredNewCardLKICopy'):
        return 'doEvento'
    if df in ('Remembered', 'Imprinted') and ctx['ultAlvo'] >= 0:
        return {'alvo': ctx['ultAlvo']}
    if df:
        falta.append('Defined:' + df)
    return None


def prod(v):
    v = (v or '').strip()
    if v in ('Any', 'Combo Any'):
        return 'qualquer'
    if v == 'Combo ColorIdentity':
        return 'comandante'
    if v == 'Chosen':
        return 'escolhida'
    if m := re.fullmatch(r'Combo ((?:[WUBRGC] ?)+)', v):
        return m.group(1).split()
    if re.fullmatch(r'[WUBRGC]', v):
        return [v]
    return None


COMUNS = {'Treasure', 'Clue', 'Food', 'Blood', 'Map', 'Gold', 'Powerstone', 'Junk', 'Shard', 'Incubator'}
PASTA_FICHAS = os.path.join(os.path.dirname(PASTA), 'tokenscripts')
_FICHAS = {}


def ficha_roteiro(nome):
    """lê forge-gui/res/tokenscripts/<nome>.txt → token RX (None se não tem)"""
    if nome in _FICHAS:
        return _FICHAS[nome]
    p = os.path.join(PASTA_FICHAS, nome + '.txt')
    t = None
    if os.path.exists(p):
        f = le_faces(p)[0]
        tl = f.get('Types', '').split()
        sub = [x for x in tl if x not in TIPOS and x not in SUPER]
        n = re.sub(r' Token$', '', f.get('Name', ''))
        if sub and sub[0] in COMUNS and 'Creature' not in tl:
            t = {'nome': sub[0]}
        else:
            t = {}
            if 'Legendary' in tl:
                t['nome'] = n
            if f.get('PT'):
                p_, _, r = f['PT'].partition('/')
                t['pt'] = [int(p_) if p_.isdigit() else 0, int(r) if r.isdigit() else 0]
            t['cores'] = wubrg(''.join(COR.get(x.capitalize(), '') for x in f.get('Colors', '').split(',')))
            t['tipos'] = [x for x in tl if x in TIPOS]
            sup = [x for x in tl if x in SUPER]
            if sup: t['super'] = sup
            if sub: t['sub'] = sub
            ks = [{'k': KW[k]} for k in f['K'] if k in KW]
            if ks: t['kw'] = ks
    _FICHAS[nome] = t
    return t


def ficha_de(d, falta):
    nome = (d.get('TokenScript') or '').split(',')[0]
    t = ficha_roteiro(nome)
    if t is not None:
        return dict(t)
    if m := re.fullmatch(r'([wubrgc]+)_(\d+|x)_(\d+|x)_((?:[a-z]+_?)+)', nome):
        cores, p, r, resto = m.groups()
        partes = resto.split('_')
        tipos = [t.capitalize() for t in partes if t.capitalize() in TIPOS]
        kws = [p_ for p_ in partes if p_.capitalize() not in TIPOS]
        sub = []
        t = {'pt': [int(p) if p.isdigit() else 0, int(r) if r.isdigit() else 0],
             'cores': wubrg(cores.upper().replace('C', '')), 'tipos': tipos or ['Creature']}
        for k in kws:
            if k.capitalize() in [x.lower().capitalize() for x in KW]:
                t.setdefault('kw', []).append({'k': KW[next(x for x in KW if x.lower() == k)]})
            else:
                sub.append(k.capitalize())
        if sub:
            t['sub'] = sub
        return t
    if nome in ('c_a_treasure_sac', 'c_a_clue_draw', 'c_a_food_sac', 'c_a_blood_draw', 'c_a_map_sac'):
        return {'nome': {'c_a_treasure_sac': 'Treasure', 'c_a_clue_draw': 'Clue', 'c_a_food_sac': 'Food',
                         'c_a_blood_draw': 'Blood', 'c_a_map_sac': 'Map'}[nome]}
    falta.append('ficha:' + nome)
    return {'nome': nome}


DURA = {'UntilYourNextTurn': 'proximoTurnoSeu', 'Permanent': 'sempre', 'UntilHostLeavesPlay': 'enquantoNoCampo',
        'UntilEndOfTurn': 'fimDoTurno', '': 'fimDoTurno'}


def marc(t):
    return {'P1P1': '+1/+1', 'M1M1': '-1/-1'}.get(t, t.lower())


def kw_lista(s, falta, pre='KW:'):
    out = []
    for k in s.split(' & '):
        if k in KW:
            out.append({'k': KW[k]})
        elif k == 'Protection from everything':
            out.append({'k': 'protecao', 'de': 'tudo'})
        elif k == 'Protection from each color':
            out.append({'k': 'protecao', 'de': 'cadaCor'})
        elif m := re.fullmatch(r'Protection from (\w+)', k):
            out.append({'k': 'protecao', 'de': COR.get(m.group(1).capitalize(), m.group(1).lower())})
        else:
            falta.append(pre + k)
    return out


def efeito(api, d, ctx, falta):
    """uma API do Forge (SP/AB/DB) → lista de fx RX"""
    sv = ctx['sv']
    q = lambda k: qtd(d.get(k), sv, falta, ctx)  # noqa: E731
    quem = jogador(d.get('Defined'))
    fx = None
    if api == 'Mana':
        p = prod(d.get('Produced'))
        if p is None:
            falta.append('Mana:' + d.get('Produced', '')); return []
        fx = {'op': 'mana', 'prod': p, 'qtd': q('Amount')}
    elif api == 'Draw':
        fx = {'op': 'comprar', 'quem': quem or 'voce', 'qtd': q('NumCards')}
    elif api == 'Discard':
        fx = {'op': 'descartar', 'quem': quem or 'voce', 'qtd': 'maoInteira' if d.get('Mode') == 'Hand' else q('NumCards')}
    elif api == 'Mill':
        fx = {'op': 'moer', 'quem': quem or 'voce', 'qtd': q('NumCards')}
    elif api == 'Scry':
        fx = {'op': 'videncia', 'quem': 'voce', 'qtd': q('ScryNum')}
    elif api == 'GainLife':
        fx = {'op': 'ganharVida', 'quem': quem or 'voce', 'qtd': q('LifeAmount')}
    elif api == 'LoseLife':
        fx = {'op': 'perderVida', 'quem': quem or 'voce', 'qtd': q('LifeAmount')}
    elif api == 'Destroy':
        fx = {'op': 'destruir', 'em': em_de(d, ctx, falta)}
    elif api == 'DestroyAll':
        fx = {'op': 'destruir', 'em': {'todos': filtro(d.get('ValidCards', 'Permanent'), falta, 'campo')}}
    elif api == 'DealDamage':
        i = alvo_de(d, ctx, falta, 'campo')
        fx = {'op': 'dano', 'em': {'alvo': i}} if i is not None else {'op': 'dano', 'quem': jogador(d.get('Defined'), 'cadaOponente')}
        fx['qtd'] = q('NumDmg')
    elif api == 'DamageAll':
        fx = {'op': 'dano', 'qtd': q('NumDmg')}
        if d.get('ValidCards'):
            fx['em'] = {'todos': filtro(d['ValidCards'], falta, 'campo')}
        if d.get('ValidPlayers'):
            fx['quem'] = jogador(d['ValidPlayers'], 'cadaJogador')
    elif api == 'Counter':
        fx = {'op': 'anular', 'em': em_de(d, ctx, falta, 'pilha')}
    elif api == 'Sacrifice':
        fx = {'op': 'sacrificar', 'quem': quem or 'voce', 'f': filtro(d.get('SacValid', 'Permanent'), falta, 'campo'),
              'qtd': q('Amount')}
    elif api == 'Token':
        fx = {'op': 'ficha', 'quem': 'voce', 'qtd': q('TokenAmount'), 'token': ficha_de(d, falta)}
        if d.get('TokenTapped') == 'True': fx['virada'] = True
        if d.get('TokenAttacking') == 'True': fx['atacando'] = True
    elif api in ('PutCounter', 'PutCounterAll'):
        em = {'todos': filtro(d.get('ValidCards', 'Permanent'), falta, 'campo')} if api == 'PutCounterAll' \
            else em_de(d, ctx, falta) or 'este'
        fx = {'op': 'marcador', 'em': em, 'tipoMarc': marc(d.get('CounterType', '')), 'qtd': q('CounterNum')}
    elif api == 'PeekAndReveal':
        # olhar o topo; se bater, pode revelar e pôr na mão (a ChangeZone seguinte é a mesma ação)
        fx = {'op': 'cavar', 'quem': 'voce', 'olha': q('PeekAmount'), 'pega': 1, 'para': 'mao', 'resto': 'grimorio'}
        if d.get('RevealValid'): fx['f'] = filtro(d['RevealValid'], falta)
        if d.get('RevealOptional') == 'True': fx['talvez'] = True
        fx['revelar'] = True
        ctx['espiou'] = True
    elif api == 'Effect':
        fx = {'op': 'efeitoTemporario', 'dura': DURA.get(d.get('Duration', ''), 'fimDoTurno'), 'est': []}
        for s in (d.get('StaticAbilities') or '').split(','):
            e = estatica(ctx['sv'].get(s.strip(), ''), {'SVar': ctx['sv']}, falta) if s.strip() else None
            if e: fx['est'].append(e)
        if not fx['est']:
            falta.append('Effect sem estática conhecida'); return []
    elif api == 'Phases':
        df = d.get('Defined', '')
        em = {'todos': filtro(df[6:], falta, 'campo')} if df.startswith('Valid ') else em_de(d, ctx, falta)
        fx = {'op': 'fasear', 'em': em}
    elif api == 'Proliferate':
        fx = {'op': 'proliferar', 'quem': 'voce'}
    elif api in ('Tap', 'Untap'):
        fx = {'op': 'virar' if api == 'Tap' else 'desvirar', 'em': em_de(d, ctx, falta)}
    elif api == 'GainControl':
        fx = {'op': 'ganharControle', 'em': em_de(d, ctx, falta), 'sobControle': 'voce'}
        if d.get('LoseControl') == 'EOT' or d.get('Duration') == 'UntilEndOfTurn':
            fx['dura'] = 'fimDoTurno'
    elif api in ('Pump', 'PumpAll'):
        fx = {'op': 'modificar'}
        if api == 'PumpAll':
            fx['em'] = {'todos': filtro(d.get('ValidCards', 'Creature'), falta, 'campo')}
        elif d.get('Defined') != 'You':
            fx['em'] = em_de(d, ctx, falta) or 'este'
        for k, c in (('NumAtt', 'p'), ('NumDef', 'r')):
            if k in d:
                v = qtd(d[k].lstrip('+'), sv, falta, ctx)
                if isinstance(v, int): fx[c] = v
                else: falta.append(f'{k}:{d[k]}')
        if d.get('KW'):
            ks = kw_lista(d['KW'], falta)
            if ks: fx['kw'] = ks
        fx['dura'] = DURA.get(d.get('Duration', ''), 'fimDoTurno')
        if api == 'Pump' and d.get('Defined') == 'You':  # proteção do jogador (Teferi's Protection)
            fx = {'op': 'efeitoTemporario', 'dura': fx['dura'],
                  'est': [{'modo': 'protecaoJogador', 'afeta': 'voce', 'kw': fx.get('kw', [])}]}
    elif api == 'Shuffle':
        fx = {'op': 'embaralhar', 'quem': quem or 'voce'}
    elif api == 'AddTurn':
        fx = {'op': 'turnoExtra', 'quem': quem or 'voce', 'qtd': q('NumTurns')}
    elif api == 'Dig':
        fx = {'op': 'cavar', 'quem': 'voce', 'olha': q('DigNum'), 'pega': q('ChangeNum'),
              'para': ZONA.get(d.get('DestinationZone', 'Hand'), 'mao'),
              'resto': ZONA.get(d.get('DestinationZone2', 'Library'), 'grimorio')}
        if d.get('ChangeValid'): fx['f'] = filtro(d['ChangeValid'], falta)
        if d.get('Optional') == 'True' or d.get('AnyNumber') == 'True': fx['talvez'] = True
    elif api in ('ChangeZone', 'ChangeZoneAll'):
        fx = mudazona(api, d, ctx, falta)
    elif api == 'CopyPermanent' and d.get('Defined', '').startswith('Valid '):
        # uma ficha cópia de cada objeto que bate (Stangg: cada Aura/Equipamento anexado)
        tk = {'copiaDe': 'cadaAtual'}
        if d.get('AttachedTo') == 'Imprinted': tk['anexadaA'] = 'criadas'
        fx = {'op': 'repetirCada', 'cada': filtro(d['Defined'][6:], falta),
              'fx': [{'op': 'ficha', 'quem': 'voce', 'qtd': 1, 'token': tk}]}
    elif api == 'EndOfTurn' and d.get('AtEOT') in ('Sacrifice', 'Exile') and d.get('Defined') == 'Remembered':
        op = 'sacrificar' if d['AtEOT'] == 'Sacrifice' else 'exilar'
        fx = {'op': 'gatilhoAtrasado', 'quando': {'ev': 'fase', 'passo': 'final', 'deQuem': 'cadaJogador',
                                                  'fx': [{'op': op, 'em': 'criadas'}]}}
    elif api in ('Cleanup', 'StoreSVar'):
        return []
    else:
        falta.append('API:' + api)
        return []
    if fx is None:
        return []
    if fx.get('em', 1) is None:
        fx.pop('em')
    if fx.get('quem') in ('controlador', 'dono') and 'em' not in fx and ctx['ultAlvo'] >= 0:
        fx['em'] = {'alvo': ctx['ultAlvo']}  # controlador/dono do alvo (Swords to Plowshares)
    if 'quem' in fx and fx['quem'] is None:
        fx.pop('quem'); falta.append(f'{api}:Defined:{d.get("Defined", "")}')
    if (d.get('Optional') == 'True' or d.get('OptionalDecider') == 'You') and fx['op'] not in ('cavar',):
        fx['talvez'] = True
    if d.get('UnlessCost'):
        c, _ = custo_atv(d['UnlessCost'], falta)
        fx['aMenosQue'] = {'quem': jogador(d.get('UnlessPayer'), 'voce') or 'voce', 'custo': c}
    return [fx]


def mudazona(api, d, ctx, falta):
    o = [ZONA.get(z) for z in d.get('Origin', '').split(',') if z]
    de = o[0] if len(o) == 1 else None
    para = ZONA.get(d.get('Destination', ''))
    if ctx.get('espiou') and d.get('Defined') == 'TopOfLibrary':
        return None  # já está no cavar do PeekAndReveal
    if de == 'pilha' and not d.get('ValidTgts') and not d.get('Defined') and para == 'exilio':
        return {'op': 'exilar', 'em': 'este'}
    if para is None:
        falta.append('Destination:' + d.get('Destination', '')); return None
    # buscar no grimório (tutor/ramp de terreno)
    if de == 'grimorio' and d.get('ChangeType') and 'IsRemembered' not in d.get('ChangeType', ''):
        fx = {'op': 'buscar', 'quem': jogador(d.get('DefinedPlayer'), 'voce') or 'voce',
              'f': filtro(d['ChangeType'], falta), 'qtd': qtd(d.get('ChangeNum'), ctx['sv'], falta, ctx)}
        if fx['quem'] == 'controlador' and ctx['ultAlvo'] >= 0:
            fx['em'] = {'alvo': ctx['ultAlvo']}
        if para != 'grimorio':
            fx['para'] = para
        if d.get('Tapped') == 'True': fx['virada'] = True
        if d.get('Reveal') == 'True': fx['revelar'] = True
        ctx['busca'] = fx
        if d.get('Shuffle') != 'False':
            ctx['depois'].append({'op': 'embaralhar', 'quem': fx['quem'], **({'em': fx['em']} if 'em' in fx else {})})
        return fx
    if 'IsRemembered' in d.get('ChangeType', '') and ctx.get('busca'):
        b = ctx['busca']  # Cultivate: divide o que buscou entre destinos
        b.pop('para', None)
        dst = {'para': para, 'qtd': qtd(d.get('ChangeNum'), ctx['sv'], falta, ctx)}
        if d.get('Tapped') == 'True': dst['virada'] = True
        b.setdefault('destinos', []).append(dst)
        if not ctx['depois']:
            ctx['depois'].append({'op': 'embaralhar', 'quem': b['quem']})
        return None
    if api == 'ChangeZoneAll':
        em = {'todos': filtro(d.get('ChangeType', 'Permanent'), falta, de or 'campo')}
    else:
        em = em_de(d, ctx, falta, de or 'campo')
    op = 'exilar' if para == 'exilio' and de == 'campo' else 'mover'
    fx = {'op': op}
    if em is not None:
        fx['em'] = em
    if op == 'mover':
        fx['para'] = para
        if de and de != 'campo' and not (isinstance(em, dict) and 'alvo' in em):
            fx['de'] = de
    if d.get('GainControl') == 'True':
        fx['sobControle'] = 'voce'
    if d.get('Tapped') == 'True': fx['virada'] = True
    if d.get('LibraryPosition') == '-1': fx['fundo'] = True
    return fx


def escolhe(d, ctx, falta):
    """CharmNum/MinCharmNum; 'Count$Compare Y GE1.2.1' = 2 se Y≥1 senão 1 (Akroma's Will)"""
    cn = d.get('CharmNum', '1')
    mn = int(d['MinCharmNum']) if d.get('MinCharmNum', '').isdigit() else None
    if m := re.fullmatch(r'Count\$Compare (\w+) GE(\d+)\.(\d+)\.(\d+)', cn):
        y, ge, sim, nao = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))
        mv = re.fullmatch(r'Count\$Valid(?:Battlefield)? (.+)', ctx['sv'].get(y, ''))
        if mv:
            fo = filtro(mv.group(1), falta, 'campo')
            fo.pop('ctrl', None) if fo.get('ctrl') == 'voce' else None  # 'controla' já é seu
            return {'min': mn if mn is not None else nao, 'max': nao,
                    'maxSe': {'se': {'controla': {'f': fo, 'min': ge}}, 'max': sim}}
        falta.append('CharmNum:' + cn)
        return {'min': 1, 'max': 1}
    n = qtd(cn, ctx['sv'], falta, ctx)
    n = n if isinstance(n, int) else 1
    return {'min': mn if mn is not None else n, 'max': n}


def cadeia(kind_api_d, ctx, falta, fx_out):
    """segue SubAbility$ juntando os fx"""
    vistos = set()
    while kind_api_d:
        _, api, d = kind_api_d
        if api == 'Charm':
            modos = []
            for c in d.get('Choices', '').split(','):
                sub = params(ctx['sv'].get(c.strip(), ''))
                if not sub:
                    falta.append('Charm:' + c); continue
                m = []
                cadeia(sub, ctx, falta, m)
                modos.append(m)
            fx_out.append({'op': 'modal', 'escolhe': escolhe(d, ctx, falta), 'modos': modos})
        else:
            for e in efeito(api, d, ctx, falta):
                ant = fx_out[-1] if fx_out else None
                if e['op'] == 'efeitoTemporario' and ant and ant['op'] == 'efeitoTemporario' and ant['dura'] == e['dura']:
                    ant['est'].extend(e['est'])
                else:
                    fx_out.append(e)
        nx = d.get('SubAbility')
        if not nx or nx in vistos:
            break
        vistos.add(nx)
        kind_api_d = params(ctx['sv'].get(nx, ''))
        if not kind_api_d:
            falta.append('SubAbility:' + nx)
    fx_out.extend(ctx['depois'])
    ctx['depois'] = []


def novo_ctx(f):
    return {'sv': f['SVar'], 'alvos': [], 'ultAlvo': -1, 'depois': [], 'busca': None}


# ------------------------------------------------------------------ gatilhos
FASE = {'Upkeep': 'manutencao', 'Draw': 'compra', 'BeginCombat': 'inicioCombate', 'End of Turn': 'final',
        'Main1': 'principal1', 'Main2': 'principal2'}


def gatilho(t, f, falta):
    d = tparams(t)
    modo = d.get('Mode', '')
    g = {}
    vc = d.get('ValidCard', '')
    if modo == 'ChangesZone':
        o, de = d.get('Origin', 'Any'), d.get('Destination', 'Any')
        if de == 'Battlefield':
            g['ev'] = 'entra'
        elif o == 'Battlefield' and de == 'Graveyard':
            g['ev'] = 'morre' if re.match(r'(Creature|Card\.Self|Card\.EquippedBy|Card\.AttachedBy|Card\.EnchantedBy)', vc) else 'vaiCemiterio'
        elif o == 'Battlefield':
            g['ev'] = 'sai'
        elif de == 'Graveyard':
            g['ev'] = 'vaiCemiterio'
        else:
            falta.append(f'T:ChangesZone {o}->{de}'); return None
    elif modo == 'Phase':
        p = FASE.get(d.get('Phase', ''))
        if not p:
            falta.append('T:Phase ' + d.get('Phase', '')); return None
        g['ev'] = 'fase'; g['passo'] = p
        vp = d.get('ValidPlayer', '')
        g['deQuem'] = 'voce' if vp == 'You' else 'oponente' if vp.startswith('Opponent') else 'cadaJogador'
    elif modo == 'Attacks':
        g['ev'] = 'ataca'
    elif modo == 'AttackersDeclared':
        g['ev'] = 'atacantesDeclarados'
    elif modo == 'Blocks':
        g['ev'] = 'bloqueia'
    elif modo == 'SpellCast':
        g['ev'] = 'conjura'
        vap = d.get('ValidActivatingPlayer', '')
        if vap:
            g['jog'] = {'You': 'voce', 'Opponent': 'oponente', 'Player': 'cadaJogador'}.get(vap, 'cadaJogador')
        vc = d.get('ValidCard', '')
    elif modo == 'Drawn':
        g['ev'] = 'compra'
    elif modo in ('DamageDone', 'DamageDoneOnce'):
        g['ev'] = 'dano' if modo == 'DamageDone' else 'danoUmaVez'
        vc = d.get('ValidSource', '')
        if d.get('CombatDamage') == 'True': g['combate'] = True
        if d.get('ValidTarget', '').startswith(('Player', 'Opponent')): g['aJogador'] = True
    elif modo == 'LifeGained':
        g['ev'] = 'ganhaVida'
    elif modo == 'LifeLost':
        g['ev'] = 'perdeVida'
    elif modo == 'Sacrificed':
        g['ev'] = 'sacrificado'
    elif modo == 'Taps':
        g['ev'] = 'vira'
    elif modo == 'BecomesTarget':
        g['ev'] = 'alvoDe'
        vc = d.get('ValidTarget', '')
        if d.get('ValidSource'):
            g['por'] = filtro(d['ValidSource'], falta)
    else:
        falta.append('T:' + modo); return None
    if modo == 'Drawn' and re.fullmatch(r'Card\.(OppOwn|YouOwn)', vc or ''):
        g['jog'] = 'oponente' if 'Opp' in vc else 'voce'; vc = ''
    if vc and g['ev'] != 'fase':
        fq = filtro(vc, falta)
        if fq: g['quem'] = fq
    if d.get('TriggerZones') and d['TriggerZones'] != 'Battlefield':
        g['zonaAtiva'] = [ZONA.get(z, 'qualquer') for z in d['TriggerZones'].split(',')]
    ex = params(f['SVar'].get(d.get('Execute', ''), ''))
    if not ex:
        falta.append('Execute:' + d.get('Execute', '')); return None
    ctx = novo_ctx(f)
    fx = []
    cadeia(ex, ctx, falta, fx)
    if d.get('OptionalDecider') and fx:
        fx[0]['talvez'] = True
    if ctx['alvos']:
        g['alvos'] = ctx['alvos']
    g['fx'] = fx
    return g


# ------------------------------------------------------------------ estáticas e substituições (v1: as comuns)
def estatica(s, f, falta):
    d = tparams(s)
    m = d.get('Mode', '')
    if m == 'Continuous':
        e = {'modo': 'continuo'}
        if d.get('AffectedDefined') in ('Equipped', 'Enchanted'):
            e['afeta'] = 'equipada'
        elif d.get('Affected'):
            e['afeta'] = 'este' if d['Affected'] == 'Card.Self' else filtro(d['Affected'], falta, 'campo')
        else:
            falta.append('S:Continuous sem Affected'); return None
        for k, c in (('AddPower', 'p'), ('AddToughness', 'r')):
            if k in d:
                if re.fullmatch(r'[+-]?\d+', d[k]): e[c] = int(d[k])
                else: falta.append(f'S:{k}:{d[k]}')
        if d.get('AddKeyword'):
            ks = [{'k': KW[k]} for k in d['AddKeyword'].split(' & ') if k in KW]
            for k in d['AddKeyword'].split(' & '):
                if k not in KW: falta.append('S:AddKeyword:' + k)
            if ks: e['kw'] = ks
        if set(d) - {'Mode', 'Affected', 'AffectedDefined', 'AddPower', 'AddToughness', 'AddKeyword', 'Description', 'EffectZone'}:
            falta.append('S:Continuous:' + ','.join(sorted(set(d) - {'Mode', 'Affected', 'AffectedDefined', 'AddPower', 'AddToughness', 'AddKeyword', 'Description'})))
        return e
    if m == 'ReduceCost':
        e = {'modo': 'reduzCusto'}
        if d.get('ValidCard') == 'Card.Self' or d.get('ValidSpell') == 'Card.Self':
            e['afeta'] = 'este'
        elif d.get('ValidCard'):
            e['afeta'] = filtro(d['ValidCard'], falta, 'pilha')
            if d.get('Activator') == 'You': e['afeta']['ctrl'] = 'voce'
        e['qtd'] = qtd(d.get('Amount'), f['SVar'], falta, {'ultAlvo': -1})
        return e
    if m == 'CantChangeLife':
        return {'modo': 'vidaNaoMuda', 'afeta': jogador(d.get('ValidPlayer'), 'voce') or 'voce'}
    if m == 'CantPreventDamage':
        return {'modo': 'danoNaoPrevenivel', 'afeta': 'cadaJogador'}
    if m == 'MustAttack':
        return {'modo': 'deveAtacar', 'afeta': 'este'}
    if m == 'CantBlockBy':
        return {'modo': 'naoPodeSerBloqueada', 'afeta': 'este'}
    falta.append('S:' + m)
    return None


def substituicao(r, f, falta):
    d = tparams(r)
    ev = d.get('Event', '')
    rw = params(f['SVar'].get(d.get('ReplaceWith', ''), ''))
    if ev == 'Moved' and d.get('ValidCard') == 'Card.Self' and d.get('Destination') == 'Battlefield' \
            and rw and rw[1] == 'Tap' and rw[2].get('ETB') == 'True':
        s = {'ev': 'entra', 'quem': {'este': True}, 'muda': {'virada': True}}
        if rw[2].get('UnlessCost'):
            c, _ = custo_atv(rw[2]['UnlessCost'], falta)
            s['aMenosQue'] = {'quem': 'voce', 'custo': c}
        return s
    if ev == 'CreateToken' and rw and rw[1] == 'ReplaceToken' and rw[2].get('Type') == 'Amount':
        s = {'ev': 'ficha', 'quem': filtro(d.get('ValidToken', 'Card.YouCtrl'), falta), 'muda': {'mult': 2}}
        if rw[2].get('Amount', '').isdigit(): s['muda'] = {'soma': int(rw[2]['Amount'])}
        return s
    falta.append('R:' + ev)
    return None


def etb_repl(arg, f, falta):
    """K:ETBReplacement:Other:SVar → substituição 'ao entrar faz X' (escolher tipo, cor…)"""
    _, _, sv = arg.partition(':')
    r = params(f['SVar'].get(sv.split(':')[0], ''))
    if r and r[1] == 'ChooseType' and r[2].get('Type') == 'Creature':
        return {'ev': 'entra', 'quem': {'este': True}, 'emVez': [{'op': 'escolher', 'quem': 'voce', 'o': 'tipoCriatura'}]}
    if r and r[1] == 'ChooseColor':
        return {'ev': 'entra', 'quem': {'este': True}, 'emVez': [{'op': 'escolher', 'quem': 'voce', 'o': 'cor'}]}
    falta.append('K:ETBReplacement:' + (r[1] if r else sv))
    return None


# ------------------------------------------------------------------ palavras-chave
def palavra(k, falta):
    nome, _, arg = k.partition(':')
    if nome in KW and not arg:
        return {'k': KW[nome]}
    if nome == 'Protection' or nome.startswith('Protection from'):
        cor = COR.get(nome.replace('Protection from ', '').capitalize())
        return {'k': 'protecao', 'de': cor or nome.replace('Protection from ', '').lower()}
    if nome in KWC:
        kk = {'k': KWC[nome]}
        a0 = arg.split(':')[0]
        if kk['k'] in KW_N:
            if a0.isdigit(): kk['n'] = int(a0)
        elif kk['k'] == 'encantar':
            kk['f'] = filtro(a0, falta)
        elif kk['k'] == 'afinidade':
            kk['tipo'] = a0.split('.')[0]
        elif kk['k'] == 'cicloTipo':
            kk['tipo'] = a0; c = mana_forge(arg.split(':')[1]) if ':' in arg else None
            if c is not None: kk['custo'] = c
        else:
            c = mana_forge(a0)
            if c is None:
                falta.append('K:' + k)
            elif c:
                kk['custo'] = c
        return kk
    falta.append('K:' + nome)
    return None


# ------------------------------------------------------------------ carta inteira
def face_rx(f, falta):
    out = {}
    kws = [x for x in (palavra(k, falta) for k in f['K'] if not k.startswith('ETBReplacement:')) if x]
    if kws: out['kw'] = kws
    atv, fx, alvos = [], [], []
    for a in f['A']:
        r = params(a)
        if not r:
            falta.append('A:?'); continue
        kind, api, d = r
        ctx = novo_ctx(f)
        efs = []
        cadeia(r, ctx, falta, efs)
        if kind == 'SP':
            if fx:  # mais de uma SP$ (custo alternativo/sobrecarga): fica a primeira
                continue
            fx, alvos = efs, ctx['alvos']
        else:
            c, leal = custo_atv(d.get('Cost', ''), falta)
            at = {'custo': c, 'fx': efs}
            if ctx['alvos']: at['alvos'] = ctx['alvos']
            if api == 'Mana': at['deMana'] = True
            if d.get('SorcerySpeed') == 'True': at['vel'] = 'feitico'
            if d.get('ActivationZone'): at['zona'] = ZONA.get(d['ActivationZone'], 'qualquer')
            if d.get('ActivationLimit') == '1': at['limite'] = 'umaPorTurno'
            if leal is not None: at['lealdade'] = leal
            atv.append(at)
    # terreno com subtipo básico: a habilidade de mana é implícita (CR 305.6)
    tl = f.get('Types', '').split()
    if 'Land' in tl:
        cs = [BASICO[t] for t in tl if t in BASICO]
        if cs:
            atv.insert(0, {'custo': {'virar': True}, 'deMana': True, 'fx': [{'op': 'mana', 'prod': cs, 'qtd': 1}]})
    if atv: out['atv'] = atv
    if alvos: out['alvos'] = alvos
    if fx: out['fx'] = fx
    gs = []
    for t in f['T']:
        td = tparams(t)
        if td.get('Secondary') == 'True':
            # eminência: mesmo gatilho em outra zona — junta no anterior de mesmo Execute
            ant = next((g for g, tt in reversed(gs) if tparams(tt).get('Execute') == td.get('Execute')), None)
            if ant:
                ant.setdefault('zonaAtiva', ['campo'])
                z = ZONA.get(td.get('TriggerZones', 'Battlefield'), 'campo')
                if z not in ant['zonaAtiva']: ant['zonaAtiva'].append(z)
                continue
        g = gatilho(t, f, falta)
        if g: gs.append((g, t))
    gs = [g for g, _ in gs]
    if gs: out['gat'] = gs
    es = [x for x in (estatica(s, f, falta) for s in f['S']) if x]
    if es: out['est'] = es
    ss = [x for x in (etb_repl(k.partition(':')[2], f, falta) for k in f['K'] if k.startswith('ETBReplacement:')) if x]
    ss += [x for x in (substituicao(r, f, falta) for r in f['R']) if x]
    if ss: out['subst'] = ss
    return out


def base(nome, dd, f):
    """campos do cards-db (Scryfall) + PT/lealdade do Forge"""
    c = {'n': nome.split(' // ')[0]}
    m = mana_scry(dd['m'].split(' // ')[0])
    if dd['m'].split(' // ')[0]:
        c['custo'] = m
    c['vm'] = dd['v']
    c['ci'] = wubrg(dd['ci'])
    c['cores'] = wubrg(''.join(re.findall(r'[WUBRG]', dd['m'].split(' // ')[0])))
    if f.get('Colors'):
        c['cores'] = wubrg(''.join(COR.get(x.capitalize(), '') for x in f['Colors'].split(',')))
    tl = dd['t'].split(' // ')[0]
    esq, _, dir_ = tl.partition(' — ')
    pal = esq.split()
    c['tipos'] = [t for t in pal if t in TIPOS] or ['Kindred' if 'Tribal' in pal else 'Card']
    sup = [t for t in pal if t in SUPER]
    if sup: c['super'] = sup
    if dir_: c['sub'] = dir_.split()
    if f.get('PT'):
        p, _, r = f['PT'].partition('/')
        c['pt'] = [int(p) if p.lstrip('-').isdigit() else '*', int(r) if r.lstrip('-').isdigit() else '*']
    if f.get('Loyalty', '').isdigit():
        c['leal'] = int(f['Loyalty'])
    return c


FORMA = {'DoubleFaced': 'duplaFace', 'Adventure': 'aventura', 'Split': 'split', 'Modal': 'modal', 'Flip': 'flip'}


def carta(nome, dd, faces, arq):
    falta = []
    c = base(nome, dd, faces[0])
    c.update(face_rx(faces[0], falta))
    modo = faces[0].get('AlternateMode', '')
    if len(faces) > 1:
        c['forma'] = FORMA.get(modo, 'normal')
        outras = []
        for f in faces[1:]:
            fo = {'n': f.get('Name', ''), 'tipos': [t for t in f.get('Types', '').split() if t in TIPOS] or ['Card']}
            mc = mana_forge(f.get('ManaCost', '')) if f.get('ManaCost', 'no cost') != 'no cost' else None
            if mc: fo['custo'] = mc
            sub = [t for t in f.get('Types', '').split() if t not in TIPOS and t not in SUPER]
            if sub: fo['sub'] = sub
            if f.get('PT'):
                p, _, r = f['PT'].partition('/')
                fo['pt'] = [int(p) if p.isdigit() else '*', int(r) if r.isdigit() else '*']
            if fo['tipos'] == ['Card']:
                falta.append('face sem tipo: ' + fo['n']); continue
            fo.update(face_rx(f, falta))
            outras.append(fo)
        c['faces'] = outras
    if falta:
        c['falta'] = sorted(set(falta))
    c['forge'] = arq
    return c


def indice_forge():
    idx = {}
    for raiz, _, arqs in os.walk(PASTA):
        for a in arqs:
            if a.endswith('.txt'):
                p = os.path.join(raiz, a)
                with open(p, encoding='utf-8', errors='replace') as fh:
                    l = fh.readline()
                if l.startswith('Name:'):
                    idx[l[5:].strip()] = p
    return idx


def converte(nomes=None):
    F, C = le_db()
    idx = indice_forge()
    out = {}
    for k in (nomes or C):
        k = next((x for x in C if x.split(' // ')[0] == k), k) if k not in C else k
        if k not in C:
            continue
        p = idx.get(k.split(' // ')[0])
        if not p:
            continue
        dd = dict(zip(F, C[k]))
        c = carta(k, dd, le_faces(p), os.path.relpath(p, PASTA))
        if c['tipos'] == ['Card']:
            continue  # Conspiracy/Scheme/Plane: fora do Commander
        if not c.get('faces'):
            c.pop('forma', None) if c.get('forma') == 'normal' else None
        out[c['n']] = c
    return out


def main():
    if len(sys.argv) > 1:
        for c in converte(sys.argv[1:]).values():
            print(json.dumps(c, ensure_ascii=False))
        return
    out = converte()
    sem = sum(1 for c in out.values() if 'falta' not in c)
    print(f'cartas: {len(out)}  sem falta: {sem} ({100 * sem / len(out):.1f}%)')
    js = 'window.CARTAS_RX=' + json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n'
    open(os.path.join(RAIZ, 'cartas-rx.js'), 'w', encoding='utf-8').write(
        '// Cartas no formato RX (ferramentas/rx/esquema.json), geradas por ferramentas/rx/converte_rx.py '
        'a partir dos roteiros do Forge (GPL-3.0, github.com/Card-Forge/forge) e do Scryfall.\n' + js)
    print('cartas-rx.js:', len(js) // 1024, 'KB')
    relatorio(out)


def relatorio(out):
    """cobertura no banco de 30 + exemplos (por cópia, sem básicos): % sem 'falta' e o que mais falta"""
    from collections import Counter
    from cobertura import decks
    tot = inteiras = 0
    falta, sem = Counter(), Counter()
    for _, q, nome in decks():
        c = out.get(nome)
        if not c:
            sem[nome] += q; continue
        if 'Basic' in c.get('super', []):
            continue
        tot += q
        if 'falta' in c:
            for x in c['falta']:
                falta[re.sub(r'=.*', '', x)[:60]] += q
        else:
            inteiras += q
    print(f'banco (30 EDHREC + 4 exemplos): {inteiras}/{tot} cópias sem falta ({100 * inteiras / tot:.1f}%)'
          + (f' · sem carta: {sum(sem.values())}' if sem else ''))
    J = {'copias': tot, 'inteiras': inteiras, 'pct': round(100 * inteiras / tot, 1), 'sem_carta': dict(sem),
         'falta_top': falta.most_common(60)}
    json.dump(J, open(os.path.join(AQUI, 'cobertura_rx.json'), 'w'), ensure_ascii=False, indent=1)
    print('mais faltam:', ', '.join(f'{k} {v}' for k, v in falta.most_common(12)))


if __name__ == '__main__':
    main()
