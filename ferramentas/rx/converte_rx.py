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
      'Convoke': 'convocar', 'Improvise': 'improvisar', 'Umbra armor': 'armaduraUmbra', 'Riot': 'tumulto'}
# palavra-chave com custo de mana depois de ':'
KWC = {'Equip': 'equipar', 'Cycling': 'ciclar', 'Overload': 'sobrecarga', 'Flashback': 'flashback',
       'Madness': 'loucura', 'Kicker': 'chute', 'Foretell': 'prever', 'Eternalize': 'eternizar', 'Echo': 'eco',
       'Encore': 'bis', 'Crew': 'tripular', 'Fabricate': 'fabricar', 'Afterlife': 'posVida', 'Mobilize': 'mobilizar',
       'Hideaway': 'esconderijo', 'Affinity': 'afinidade', 'Ward': 'resguardo', 'Enchant': 'encantar',
       'Partner with': 'parceiroCom', 'TypeCycling': 'cicloTipo', 'Protection': 'protecao', 'Gift': 'ofertaPresente',
       'Offspring': 'prole'}
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
    for t in re.findall(r'\S+<[^>]*>|\S+', s or ''):
        if t == 'T':
            c['virar'] = True
        elif t == 'Q':
            c['desvirar'] = True
        elif re.fullmatch(r'Sac<1/(CARDNAME|NICKNAME)(/[^>]*)?>', t):
            c['sacrificar'] = 'este'
        elif m := re.fullmatch(r'Sac<(\d+)/([^/>]+)(?:/[^>]*)?>', t):
            c['sacrificar'] = {'f': filtro(m.group(2), falta), 'qtd': int(m.group(1))}
        elif m := re.fullmatch(r'Exile<1/(CARDNAME|NICKNAME)>', t):
            c['exilarEste'] = True
        elif m := re.fullmatch(r'Reveal<(\d+)/([^/>]+)(?:/[^>]*)?>', t):
            c['revelar'] = {'f': filtro(m.group(2).replace(';', ','), falta, 'mao'), 'qtd': int(m.group(1))}
        elif m := re.fullmatch(r'PayLife<(\d+|X)>', t):
            c['vida'] = int(m.group(1)) if m.group(1).isdigit() else 'X'
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
    if len(alts) == 2 and 'Card.Self' in alts:   # "este ou outro X" (Doomwake Giant)
        outro = alts[1 - alts.index('Card.Self')]
        f = filtro(re.sub(r'\+?(?<![A-Za-z])Other\b\+?', lambda m_: '+' if m_.group(0).count('+') == 2 else '', outro)
                   .rstrip('.+').replace('.+', '.'), falta, zona)
        f['ouEste'] = True
        return f
    if len(alts) > 1:   # Creature.Angel+YouCtrl,Creature.Demon+YouCtrl → um filtro com sub [Angel, Demon]
        sep = [(a.partition('.')[0], tuple(sorted(x for x in re.split(r'[+.]', a.partition('.')[2]) if x))) for a in alts]
        subs = [[x for x in qs if re.fullmatch(r'[A-Z][a-z]+', x) and x not in TIPOS and x not in ('Other', 'Self', 'Permanent', 'Token', 'Legendary', 'Basic', 'Snow', 'Historic', 'Nonbasic')] for _, qs in sep]
        resto = {(b_, tuple(x for x in qs if x not in sb)) for (b_, qs), sb in zip(sep, subs)}
        if len(resto) == 1 and all(len(sb) == 1 for sb in subs):
            b_, r_ = resto.pop()
            f = filtro(b_ + ('.' + '+'.join(r_) if r_ else ''), falta, zona)
            f['sub'] = sorted({sb[0] for sb in subs})
            return f
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
        elif q in ('ControlledBy TriggeredTarget', 'ControlledBy TriggeredPlayer', 'ControlledBy TriggeredDefender'):
            f['ctrl'] = 'doEvento'           # Hellkite Tyrant / Balefire Dragon: do jogador atingido
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
        elif q == 'HasCounters':
            f['comMarcador'] = 'qualquer'
        elif q == 'StrictlyOther':
            f['outro'] = True
        elif m := re.fullmatch(r'counters_GE1_(\w+)', q):
            f['comMarcador'] = marc(m.group(1))
        elif m := re.fullmatch(r'with(\w+)', q) and KW.get(re.fullmatch(r'with(\w+)', q).group(1)):
            f.setdefault('kw', []).append(KW[re.fullmatch(r'with(\w+)', q).group(1)])
        elif q == 'wasCastByYou':
            f['conjurada'] = True
        elif q == 'TopLibrary':
            f['topo'] = True
        elif q in ('IsRemembered', 'IsImprinted'):
            f['lembrada'] = True
        elif q == 'modified':
            f['modificada'] = True
        elif q == 'wasCast':
            f['conjurada'] = True
        elif q in COR:
            f['cor'] = COR[q]
        elif m := re.fullmatch(r'!(\w+)', q):
            f.setdefault('nao', []).append(m.group(1).capitalize())
        elif m := re.fullmatch(r'non(\w+)', q):
            n = m.group(1)
            f.setdefault('nao', []).append(n)  # nonLand, nonBasic, nonBlack… (cor fica pelo nome)
        elif m := re.fullmatch(r'(cmc|power|toughness)(LE|GE|LT|GT|EQ)(\d+)', q):
            k = {'cmc': 'vm', 'power': 'poder', 'toughness': 'resist'}[m.group(1)]
            n, op = int(m.group(3)), m.group(2)
            f[k] = {'GE': {'min': n}, 'GT': {'min': n + 1}, 'LE': {'max': n}, 'LT': {'max': n - 1}, 'EQ': {'igual': n}}[op]
        elif (m := re.fullmatch(r'(cmc|power|toughness)(LE|GE|EQ)([A-Z]\w*)', q)) and m.group(3) in _SV:
            # Whir of Invention: vm ≤ X (X pago ou contagem da carta)
            k = {'cmc': 'vm', 'power': 'poder', 'toughness': 'resist'}[m.group(1)]
            v = qtd(m.group(3), _SV, falta, {'ultAlvo': -1})
            f[k] = {{'GE': 'min', 'LE': 'max', 'EQ': 'igual'}[m.group(2)]: v}
        elif q in TIPOS or q in ('Permanent', 'Token'):  # Card.Creature
            f.setdefault('tipo', []).append(q)
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
    if zona in ('cemiterio', 'mao', 'grimorio', 'exilio') and 'ctrl' in f and 'dono' not in f:
        f['dono'] = f.pop('ctrl')        # fora do campo "YouCtrl" do Forge = é seu (dono)
    return f


def jogador(v, padrao='voce'):
    return {'': padrao, None: padrao, 'You': 'voce', 'Player.Opponent': 'cadaOponente', 'Opponent': 'cadaOponente',
            'Player': 'cadaJogador', 'Targeted': 'alvoJogador', 'TargetedPlayer': 'alvoJogador',
            'TargetedController': 'controlador', 'TargetedOwner': 'dono', 'TriggeredPlayer': 'doEvento',
            'TriggeredActivator': 'doEvento', 'TriggeredCardController': 'doEvento',
            'TriggeredSourceController': 'doEvento', 'TriggeredTarget': 'doEvento',
            'Opponent.Next': 'proximo', 'DelayTriggerRemembered': 'controlador',
            'RememberedController': 'controlador', 'Player.IsRemembered': 'cadaAtual',
            'Remembered': 'cadaAtual'}.get(v)


# ------------------------------------------------------------------ quantidades
ZONA_CONTA = {'Battlefield': 'campo', '': 'campo', 'Graveyard': 'cemiterio', 'Hand': 'mao',
              'Library': 'grimorio', 'Exile': 'exilio'}
CONTA_FIXA = {
    'Count$InYourHand': 'cartasNaMao', 'Count$CardsInYourHand': 'cartasNaMao',
    'Count$OppsInGame': 'oponentes', 'PlayerCountOpponents$Amount': 'oponentes',
    'PlayerCountPlayers$Amount': 'jogadores', 'Count$CardPower': 'poderDoEste',
    'Count$CardToughness': 'resistDoEste', 'Count$CardManaCost': 'vmDoEste',
    'TriggerCount$DamageAmount': 'danoCausado', 'TriggerCount$LifeAmount': 'vidaGanha',
    'Remembered$Amount': 'lembrados', 'Imprinted$Amount': 'lembrados',
    'Count$YourLifeTotal': 'suaVida', 'Count$YourStartingLife': 'vidaInicial',
    'Count$CardsInYourLibrary': 'cartasNoGrimorio', 'Count$YourCountersEnergy': 'energia',
    'Count$xPaid': 'X', 'Count$CastTotalManaSpent': 'X', 'Count$Converge': 'convergir',
    'Count$Domain': 'dominio', 'Count$Devotion': 'devocao', 'Count$TotalCommanderCastFromCommandZone': 'impostoCmd',
    'Count$YourTurns': 'seusTurnos', 'Count$ResolvedThisTurn': 'resolvidasNoTurno',
    'Count$ThisTurnCast_Card.YouCtrl': 'magiasNoTurno', 'Count$CardNumColors': 'coresDoEste',
    'Count$ChosenNumber': 'numeroEscolhido', 'Count$LifeYouGainedThisTurn': 'vidaGanhaNoTurno',
    'Count$YouDrewThisTurn': 'compradasNoTurno', 'TriggerObjectsAttackers$Amount': 'atacantes',
    'TriggeredCard$CardNumColors': 'coresDoEvento', 'Count$CardNumAttacksThisTurn': 'ataquesNoTurno',
    'TargetedPlayer$CardsInLibrary': 'grimorioDoAlvo', 'Count$AttackersDeclared': 'atacantes',
    'Count$LifeOppsLostThisTurn': 'vidaPerdidaOpsNoTurno', 'Count$LifeYouLostThisTurn': 'vidaPerdidaNoTurno',
    'Count$RememberedSize': 'lembrados', 'Count$TimesKicked': 'vezesKicker', 'TriggeredPlayer$CardsInHand': 'maoDoEvento',
}
CONTA_RE = [
    (r'(Remembered|Targeted|ParentTargeted|Sacrificed|Discarded|Exiled)(LKI)?\$CardManaCost', 'vmDoAlvo'),
    (r'(Remembered|Targeted|ParentTargeted|Sacrificed|Discarded|Exiled)(LKI)?\$CardPower', 'poderDoAlvo'),
    (r'(Remembered|Targeted|ParentTargeted|Sacrificed)(LKI)?\$CardToughness', 'resistDoAlvo'),
    (r'Triggered(Card|Attacker|Spell)?(LKICopy)?\$CardPower', 'poderDoEvento'),
    (r'Triggered(Card|Attacker)?(LKICopy)?\$CardToughness', 'resistDoEvento'),
    (r'Triggered(Card|Spell|SpellAbility)?(LKICopy)?\$CardManaCost', 'vmDoEvento'),
    (r'Triggered(Card)?(LKICopy)?\$CardCounters\.\w+', 'marcadoresNoEvento'),
    (r'Count\$CardCounters\.\w+', 'marcadoresNoEste'),
    (r'TargetedPlayer\$CardsInHand', 'maoDoAlvo'), (r'TargetedPlayer\$LifeTotal', 'vidaDoAlvo'),
    (r'Count\$MostProminentCreatureType .*', 'tipoMaisComum'),
    (r'PlayerCountPlayers\$Highest.*|PlayerCount\w*\$Highest.*', 'maiorEntreJogadores'),
    (r'Count\$Devotion\.\w+', 'devocao'), (r'Count\$DevotionDual\.\w+\.\w+', 'devocao'), (r'Count\$YourCounters\w+', 'marcadoresSeus'),
    (r'TriggerCount\$.*', 'evento'), (r'Count\$ThisTurnEntered_.*', 'entrouNoTurno'),
]
OPS = re.compile(r'/(Plus|Times|Twice|Thrice|Minus|Negative|HalfUp|HalfDown|Half|Double)(?:\.(-?\w+))?$')


def qtd(v, svars, falta, ctx, _prof=0):
    if v is None or v == '':
        return 1
    if re.fullmatch(r'-?\d+', v):
        return int(v)
    if v == 'All':
        return 'tudo'
    if v.startswith('-') and (v[1:] in svars or v[1:] in ('X', 'Y')):
        r = qtd(v[1:], svars, falta, ctx, _prof + 1)
        if isinstance(r, int): return -r
        if r == 'X': return {'conta': 'X', 'mult': -1}
        if isinstance(r, dict) and 'mult' not in r: return {**r, 'mult': -1}
        falta.append(f'qtd:{v}'); return 1
    sv = svars.get(v, '')
    if not sv and '$' in v:
        sv = v                           # expressão escrita direto no parâmetro
    if not sv and v == 'X':
        return 'X'
    if not sv and v in ('Result', 'Double', 'LastStateBattlefield'):
        return {'conta': 'resultado'}    # número que o efeito anterior lembrou (dado, dobro…)
    r = conta(sv, svars, falta, ctx, _prof)
    if r is None:
        falta.append(f'qtd:{v}={sv}')
        return 1
    return r


def conta(sv, svars, falta, ctx, prof=0):
    """expressão de contagem do Forge (Count$…, SVar$…/Plus.N) → qtd RX, ou None"""
    if prof > 4:
        return None
    mult, soma, metade = 1, 0, False
    while m := OPS.search(sv):
        op, a = m.group(1), m.group(2)
        sv = sv[:m.start()]
        if op in ('Twice', 'Double'): mult *= 2
        elif op == 'Thrice': mult *= 3
        elif op == 'Negative': mult *= -1
        elif op in ('Half', 'HalfDown', 'HalfUp'): metade = True
        elif a is None or not re.fullmatch(r'-?\d+', a): return None
        elif op == 'Plus': soma += int(a)
        elif op == 'Minus': soma -= int(a)
        elif op == 'Times': mult *= int(a)

    def fecha(q):
        if q == 'X': q = {'conta': 'X'}
        if isinstance(q, int):
            return (q * mult) // (2 if metade else 1) + soma
        if not isinstance(q, dict): return None
        q = dict(q)
        if mult != 1:
            q['mult'] = q.get('mult', 1) * mult
        if metade: q['metade'] = True
        if soma: q['soma'] = q.get('soma', 0) + soma
        return q if (mult != 1 or soma or metade or q.get('conta') != 'X') else 'X'

    if m := re.fullmatch(r'Number\$(-?\d+)', sv):
        return fecha(int(m.group(1)))
    if m := re.fullmatch(r'SVar\$(\w+)', sv):
        if m.group(1) == 'X' and 'X' not in svars: return fecha('X')
        sub = svars.get(m.group(1))
        return fecha(conta(sub, svars, falta, ctx, prof + 1)) if sub else None
    if m := re.fullmatch(r'Count\$(Kicked|PromisedGift|Bargained|Evoked|Foretold|Blitzed|Surge|Morbid|Revolt|'
                         r'Threshold|Delirium|Metalcraft|Ferocious|Raid|Hellbent|Landfall|wasCast|wasCastFromGraveyard|wasCastFromExile|Monarch|IfCastInOwnMainPhase)\.(-?\d+)\.(-?\d+)', sv):
        return fecha({'conta': 'se', 'cond': m.group(1).lower(), 'sim': int(m.group(2)), 'nao': int(m.group(3))})
    prop = None
    if m := re.fullmatch(r'(Count\$(?:Valid|Type)\w*\s*[^/$]+)\$(Colors|CardPower|CardToughness|CardManaCost|GreatestPower|SumPower|DifferentCardNames_|CreatureType)', sv):
        sv, prop = m.group(1), {'Colors': 'cores', 'CardPower': 'somaPoder', 'SumPower': 'somaPoder', 'GreatestPower': 'maiorPoder',
                                'CardToughness': 'somaResist', 'CardManaCost': 'somaVm', 'DifferentCardNames_': 'nomesDiferentes',
                                'CreatureType': 'tiposDiferentes'}[m.group(2)]
    if m := re.fullmatch(r'Count\$(?:Valid|Type)(Battlefield|Graveyard|Hand|Library|Exile|)\s*([^/]+)', sv):
        f = filtro(m.group(2), falta, ZONA_CONTA[m.group(1)])
        if prop:
            f.setdefault('ctrl' if m.group(1) in ('', 'Battlefield') else 'dono', 'qualquer')
            return fecha({'conta': f, 'prop': prop})
        f.setdefault('ctrl' if m.group(1) in ('', 'Battlefield') else 'dono', 'qualquer')
        if m.group(1) not in ('', 'Battlefield'): f['zona'] = ZONA_CONTA[m.group(1)]
        return fecha({'conta': f})
    if m := re.fullmatch(r'TargetedPlayer\$Valid\s*([^/]+)', sv):
        f = filtro(m.group(1), falta, 'campo'); f['ctrl'] = 'alvo'
        return fecha({'conta': f})
    if sv in CONTA_FIXA:
        c = CONTA_FIXA[sv]
        return fecha('X' if c == 'X' else {'conta': c})
    for rx, c in CONTA_RE:
        if re.fullmatch(rx, sv):
            q = {'conta': c}
            if c in ('vmDoAlvo', 'poderDoAlvo', 'resistDoAlvo'):
                q['alvo'] = max(ctx['ultAlvo'], 0)
            if c == 'devocao' and (m := re.search(r'Devotion(?:Dual)?\.([\w.]+)', sv)):   # devoção a vermelho / a W e B
                cs = [COR.get(x.capitalize(), x) for x in re.split(r'And|_|\.', m.group(1)) if x]
                q['de'] = ''.join(cs)
            elif c in ('marcadoresNoEste', 'marcadoresNoEvento', 'marcadoresSeus') and \
                    (m := re.search(r'(?:Counters\.|Counters)(\w+)$', sv)):
                q['de'] = marc(m.group(1))
            return fecha(q)
    return None


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
    elif any(x in ('Player', 'Opponent') for x in vt.split(',')):
        # Go-Shintai: "jogador ou planeswalker" → jog + f (um OU outro)
        jg = [x for x in vt.split(',') if x in ('Player', 'Opponent')]
        f = filtro(','.join(x for x in vt.split(',') if x not in jg), falta, zona)
        a = {'f': f, 'jog': 'oponente' if jg == ['Opponent'] else 'jogador'}
    else:
        f = filtro(vt, falta, zona)
        if zona == 'cemiterio' and 'dono' not in f:
            f['dono'] = 'qualquer'
    a = locals().get('a') or {'f': f}
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
    if df in ('TriggeredSpellAbility', 'TriggeredCard', 'TriggeredCardLKICopy', 'TriggeredNewCardLKICopy', 'TriggeredAttacker',
              'TriggeredAttackerLKICopy', 'TriggeredBlocker', 'TriggeredTarget'):
        return 'doEvento'
    if df in ('Remembered', 'Imprinted') and ctx['ultAlvo'] >= 0:
        return {'alvo': ctx['ultAlvo']}
    if df in ('DelayTriggerRemembered', 'DelayTriggerRememberedLKI', 'Remembered', 'Imprinted', 'Sacrificed', 'Discarded', 'Exiled', 'RememberedLKI', 'SacrificedCards'):
        return 'anterior'                # o objeto do custo / do efeito anterior
    if df.startswith('Valid '):          # Golgari Charm: Defined$ Valid Creature.YouCtrl
        return {'todos': filtro(df[6:], falta, zona)}
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


def compara(c, falta):
    """'GE3' → {'min': 3}"""
    m = re.fullmatch(r'(GE|GT|LE|LT|EQ)\s*(\d+)', (c or 'GE1').strip())
    if not m:
        falta.append('Compare:' + c); return {'min': 1}
    n, op = int(m.group(2)), m.group(1)
    return {'GE': {'min': n}, 'GT': {'min': n + 1}, 'LE': {'max': n}, 'LT': {'max': n - 1}, 'EQ': {'igual': n}}[op]


def condicao(d, ctx, falta):
    """Condition*/IsPresent de um efeito ou gatilho → cond RX ('se'), ou None"""
    se = {}
    if d.get('ConditionCheckSVar'):
        q = qtd(d['ConditionCheckSVar'], ctx['sv'], falta, ctx)
        se['conta'] = {'q': q, **compara(d.get('ConditionSVarCompare'), falta)}
    for k, kc, kz in (('ConditionPresent', 'ConditionCompare', 'ConditionZone'), ('IsPresent', 'PresentCompare', 'PresentZone')):
        if not d.get(k) or d[k] in ('Card.Self', 'Card.StrictlySelf'):
            continue                      # "se este está na zona" = a zona ativa do gatilho (eminência)
        zn = ZONA.get(d.get(kz, 'Battlefield'), 'campo')
        if k == 'ConditionPresent' and d.get('ConditionDefined'):
            o = em_de({'Defined': d['ConditionDefined']}, ctx, falta)
            cm = compara(d.get(kc), falta)
            se['objBate'] = {'em': o or 'anterior', 'f': filtro(d[k], falta)}
            if cm == {'igual': 0}: se['objBate']['nao'] = True
        else:
            f = filtro(d[k], falta, zn)
            if 'ctrl' not in f and zn == 'campo': f['ctrl'] = 'qualquer'
            se['existe'] = {'f': f, **compara(d.get(kc), falta)}
    c = d.get('Condition') or ('PlayerTurn' if d.get('ConditionPlayerTurn') == 'True' else '')
    if c == 'PlayerTurn': se['turno'] = 'seu'
    elif c in ('NotPlayerTurn',) or d.get('ConditionOpponentTurn') == 'True': se['turno'] = 'deOutro'
    elif c == 'Kicked': se['conjuradaCom'] = 'kicker'
    elif c: se['palavra'] = c.lower()       # metalcraft, blessing (cidade abençoada), maxspeed…
    for k in ('ConditionPhases', 'ConditionFirstCombat', 'ConditionSVar', 'ConditionTargetValidTargeting', 'ConditionManaSpent'):
        if d.get(k): falta.append('Condition:' + k)
    return se or None


def efeito(api, d, ctx, falta):
    """uma API do Forge (SP/AB/DB) → lista de fx RX"""
    sv = ctx['sv']
    q = lambda k: qtd(d.get(k), sv, falta, ctx)  # noqa: E731
    quem = jogador(d.get('Defined'))
    fx = None
    if api == 'Mana':
        p = prod(d.get('Produced'))
        cores = (d.get('Produced') or '').split()
        if p is None and len(cores) > 1 and all(re.fullmatch(r'[WUBRGC]', x) for x in cores):
            # 'R G' = adiciona as duas (Signet, karoo): um fx por símbolo
            ctx['_extra'] = ctx.get('_extra', []) + [{'op': 'mana', 'prod': [x], 'qtd': 1} for x in cores[1:]]
            p = [cores[0]]
        if p is None:
            falta.append('Mana:' + d.get('Produced', '')); return []
        fx = {'op': 'mana', 'prod': p, 'qtd': q('Amount')}
    elif api == 'ManaReflected':
        fx = {'op': 'mana', 'prod': 'refletida', 'qtd': 1}
    elif api in ('Regenerate', 'RegenerateAll'):
        em = {'todos': filtro(d.get('ValidCards', 'Creature'), falta, 'campo')} if api == 'RegenerateAll' \
            else em_de(d, ctx, falta) or 'este'
        fx = {'op': 'regenerar', 'em': em}
    elif api == 'Surveil':
        fx = {'op': 'vigiar', 'quem': quem or 'voce', 'qtd': q('Amount')}
    elif api == 'Fight':
        # Apex Altisaur: este (ou o do evento) luta com o alvo
        df = d.get('Defined', 'Self')
        a1 = 'este' if df == 'Self' else 'doEvento' if df.startswith('Triggered') else em_de({'Defined': df}, ctx, falta)
        a2 = em_de({k: v for k, v in d.items() if k != 'Defined'}, ctx, falta)
        if a1 is None or a2 is None: falta.append('Fight:' + df)
        fx = {'op': 'lutar', 'em': a1 or 'este', 'com': a2 or 'anterior'}
    elif api == 'WinsGame':
        fx = {'op': 'ganharJogo', 'quem': quem or 'voce'}
    elif api == 'BecomeMonarch':
        fx = {'op': 'virarMonarca', 'quem': quem or 'voce'}
    elif api == 'Discover':
        fx = {'op': 'descobrir', 'quem': 'voce', 'qtd': q('Num')}
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
        fx = {'op': 'ficha', 'quem': jogador(d.get('TokenOwner'), 'voce'), 'qtd': q('TokenAmount'), 'token': ficha_de(d, falta)}
        if d.get('TokenTapped') == 'True': fx['virada'] = True
        if d.get('TokenAttacking') == 'True': fx['atacando'] = True
    elif api in ('PutCounter', 'PutCounterAll'):
        em = {'todos': filtro(d.get('ValidCards', 'Permanent'), falta, 'campo')} if api == 'PutCounterAll' \
            else em_de(d, ctx, falta) or 'este'
        if d.get('Adapt'):   # adaptar N: se não tiver +1/+1, põe N
            fx = {'op': 'marcador', 'em': em, 'tipoMarc': '+1/+1', 'qtd': q('Adapt'),
                  'se': {'objBate': {'em': 'este', 'f': {'comMarcador': '+1/+1'}, 'nao': True}}}
        else:
            if not d.get('CounterType'): falta.append('PutCounter sem CounterType')
            fx = {'op': 'marcador', 'em': em, 'tipoMarc': marc(d.get('CounterType', '')), 'qtd': q('CounterNum')}
    elif api == 'PeekAndReveal':
        # olhar o topo; se bater, pode revelar e pôr na mão (a ChangeZone seguinte é a mesma ação)
        fx = {'op': 'cavar', 'quem': 'voce', 'olha': q('PeekAmount'), 'pega': 1, 'para': 'mao', 'resto': 'grimorio'}
        if d.get('RevealValid'): fx['f'] = filtro(d['RevealValid'], falta)
        if d.get('RevealOptional') == 'True': fx['talvez'] = True
        fx['revelar'] = True
        ctx['espiou'] = True
    elif api == 'Effect' and any(re.search(r'MayPlay\$ True', ctx['sv'].get(x.strip(), '')) and 'IsRemembered' in ctx['sv'].get(x.strip(), '')
                                 for x in (d.get('StaticAbilities') or '').split(',')):
        em = em_de(d, ctx, falta, ZONA.get(d.get('TgtZone', ''), 'campo')) if d.get('ValidTgts') else 'anterior'
        fx = {'op': 'jogar', 'em': em or 'anterior', 'talvez': True, 'dura': DURA.get(d.get('Duration', ''), 'fimDoTurno')}
    elif api == 'Effect':
        fx = {'op': 'efeitoTemporario', 'dura': DURA.get(d.get('Duration', ''), 'fimDoTurno'), 'est': []}
        if d.get('RememberObjects'):
            o = em_de({'Defined': d['RememberObjects'].replace('Valid ', '')}, ctx, []) \
                if not d['RememberObjects'].startswith('Valid ') else {'todos': filtro(d['RememberObjects'][6:], falta, 'campo')}
            if o: fx['em'] = o
        if (d.get('Name') or '').startswith('Emblem'): fx['emblema'] = True
        for s in (d.get('StaticAbilities') or '').split(','):
            e = estatica(ctx['sv'].get(s.strip(), ''), {'SVar': ctx['sv']}, falta) if s.strip() else None
            if e: fx['est'].append(e)
        for t in (d.get('Triggers') or '').split(','):
            g = gatilho(ctx['sv'].get(t.strip(), ''), {'SVar': ctx['sv']}, falta) if t.strip() else None
            if g: fx.setdefault('gat', []).append(g)
        for r in (d.get('ReplacementEffects') or '').split(','):
            su = substituicao(ctx['sv'].get(r.strip(), ''), {'SVar': ctx['sv']}, falta) if r.strip() else None
            if su: fx.setdefault('subst', []).append(su)
        if not fx['est']: fx.pop('est')
        if not (fx.get('est') or fx.get('gat') or fx.get('subst')):
            falta.append('Effect sem estática conhecida'); return []
    elif api == 'Phases':
        df = d.get('Defined', '')
        em = {'todos': filtro(df[6:], falta, 'campo')} if df.startswith('Valid ') else em_de(d, ctx, falta)
        fx = {'op': 'fasear', 'em': em}
    elif api == 'Proliferate':
        fx = {'op': 'proliferar', 'quem': 'voce'}
    elif api in ('TapAll', 'UntapAll'):
        fx = {'op': 'virar' if api == 'TapAll' else 'desvirar', 'em': {'todos': filtro(d.get('ValidCards', 'Permanent'), falta, 'campo')}}
    elif api in ('Tap', 'Untap'):
        fx = {'op': 'virar' if api == 'Tap' else 'desvirar', 'em': em_de(d, ctx, falta)}
    elif api == 'GainControl':
        em = {'todos': filtro(d['AllValid'], falta, 'campo')} if d.get('AllValid') else em_de(d, ctx, falta)
        if em is None: falta.append('GainControl sem objeto')
        fx = {'op': 'ganharControle', 'em': em, 'sobControle': 'voce'}
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
                antes = len(falta)
                v = qtd(d[k].lstrip('+'), sv, falta, ctx)
                if len(falta) == antes: fx[c] = v
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
        fx = {'op': 'cavar', 'quem': jogador(d.get('Defined'), 'voce'), 'olha': q('DigNum'), 'pega': q('ChangeNum'),
              'para': ZONA.get(d.get('DestinationZone', 'Hand'), 'mao'),
              'resto': ZONA.get(d.get('DestinationZone2', 'Library'), 'grimorio')}
        if d.get('ChangeValid'): fx['f'] = filtro(d['ChangeValid'], falta)
        if d.get('Optional') == 'True' or d.get('AnyNumber') == 'True': fx['talvez'] = True
    elif api in ('ChangeZone', 'ChangeZoneAll'):
        fx = mudazona(api, d, ctx, falta)
        if fx and fx.get('op') == 'mover' and fx.get('para') == 'grimorio' and d.get('Shuffle') == 'True' \
                and d.get('Origin') == 'Battlefield' and fx.get('em'):
            ctx['_extra'] = [{'op': 'embaralhar', 'quem': 'dono', 'em': fx['em']}]
    elif api == 'RepeatEach' and d.get('RepeatPlayers'):
        sub = params(sv.get(d.get('RepeatSubAbility', ''), ''))
        if not sub:
            falta.append('RepeatEach:sub'); return []
        interno = []
        cadeia(sub, ctx, falta, interno)
        cada = jogador(d['RepeatPlayers'].replace('Player.Opponent', 'Opponent'))
        if cada is None:
            falta.append('RepeatPlayers:' + d['RepeatPlayers']); return []
        fx = {'op': 'repetirCada', 'cada': cada, 'fx': interno}
        if d.get('RepeatOptionalForEachPlayer') == 'True': fx['talvez'] = True
    elif api == 'SetState' and d.get('Mode') == 'Transform':
        fx = {'op': 'transformar', 'em': em_de(d, ctx, falta) or 'este'}
    elif api == 'RemoveCounter':
        em = em_de(d, ctx, falta) or 'este'
        fx = {'op': 'marcador', 'em': em, 'tipoMarc': marc(d.get('CounterType', '')),
              'qtd': 'tudo' if d.get('CounterNum') == 'All' else qtd(d.get('CounterNum'), sv, falta, ctx)}
        if isinstance(fx['qtd'], int): fx['qtd'] = -fx['qtd']
        else: fx['tirar'] = True
    elif api == 'CopySpellAbility':
        em = em_de(d, ctx, falta, 'pilha')
        if d.get('Defined') in ('TriggeredSpellAbility', 'TriggeredCard', 'TriggeredSpellAbilityLKICopy'): em = 'doEvento'
        if em is None:
            return []
        fx = {'op': 'copiarMagica', 'em': em, 'qtd': q('Amount')}
        if d.get('MayChooseTarget') == 'True': fx['novoAlvo'] = True
    elif api == 'TargetOnly':
        i = alvo_de(d, ctx, falta, ZONA.get(d.get('TgtZone', ''), 'campo'))
        if i is not None: ctx.setdefault('marcados', []).append(i)
        return []
    elif api == 'Play':
        if d.get('ValidTgts'):
            em = em_de(d, ctx, falta, ZONA.get(d.get('TgtZone', ''), 'campo'))
        elif d.get('Valid'):
            em = {'todos': filtro(d['Valid'], falta, ZONA.get(d.get('ValidZone', 'Hand'), 'mao'))}
        else:
            em = em_de(d, ctx, falta)
            if d.get('Defined') == 'ExiledWith': em = 'anterior'; falta[:] = [x for x in falta if x != 'Defined:ExiledWith']
        if em is None:
            return []
        fx = {'op': 'jogar', 'em': em, 'semPilha': False}
        fx.pop('semPilha')
        if d.get('WithoutManaCost') == 'True': fx['gratis'] = True
        if d.get('Amount') and d['Amount'] != 'All': fx['qtd'] = q('Amount')
        if d.get('Optional') == 'True': fx['talvez'] = True
    elif api == 'ChooseType':
        fx = {'op': 'escolher', 'quem': 'voce', 'o': 'tipoCriatura' if d.get('Type') == 'Creature' else 'tipo'}
    elif api == 'AddPhase' and d.get('ExtraPhase') == 'Combat':
        fx = {'op': 'faseExtra', 'fase': 'combate'}
        if d.get('ConditionFirstCombat') == 'True': fx['se'] = {'palavra': 'primeiroCombate'}; d = {k: v for k, v in d.items() if k != 'ConditionFirstCombat'}
    elif api == 'DelayedTrigger':
        dd = {k: v for k, v in d.items() if k not in ('RememberObjects', 'SubAbility', 'TriggerDescription',
                                                     'SpellDescription', 'NextTurn', 'ThisTurn', 'Static')}
        g = gatilho(dd, {'SVar': sv}, falta)
        if g is None:
            return []
        if d.get('NextTurn') == 'True': g['proximoTurno'] = True
        if d.get('ThisTurn') == 'True': g['nesteTurno'] = True
        fx = {'op': 'gatilhoAtrasado', 'quando': g}
    elif api in ('Animate', 'AnimateAll'):
        em = {'todos': filtro(d.get('ValidCards', 'Creature'), falta, 'campo')} if api == 'AnimateAll' \
            else em_de(d, ctx, falta) or 'este'
        fx = {'op': 'animar', 'em': em}
        if d.get('RemoveKeywords'):
            ks = kw_lista(d['RemoveKeywords'], falta)
            if ks: fx['tiraKw'] = ks
        if d.get('AddAllCreatureTypes') == 'True': fx['todosTipos'] = True
        if d.get('Power') is not None: fx['p'] = q('Power')
        if d.get('Toughness') is not None: fx['r'] = q('Toughness')
        tps = [t for t in re.split(r'[,& ]+', d.get('Types', '')) if t]
        if tps:
            fx['tipos'] = [t for t in tps if t in TIPOS or t in ('Legendary',)]
            fx['sub'] = [t for t in tps if t not in fx['tipos']]
            if not fx['tipos']: fx.pop('tipos')
            if not fx['sub']: fx.pop('sub')
        if d.get('Colors'): fx['cores'] = wubrg(d['Colors'])
        if d.get('Keywords'):
            ks = kw_lista(d['Keywords'], falta)
            if ks: fx['kw'] = ks
        if d.get('Triggers') or d.get('Abilities') or d.get('staticAbilities'):
            h = habil_dada({'AddAbility': d.get('Abilities', ''), 'AddTrigger': d.get('Triggers', '')}, sv, falta)
            if h: fx['habil'] = h
            if d.get('staticAbilities'): falta.append('Animate:staticAbilities')
        if d.get('RemoveAllAbilities') == 'True': fx['semHabil'] = True
        fx['dura'] = DURA.get(d.get('Duration', ''), 'fimDoTurno')
    elif api == 'Attach':
        ob = d.get('Object', 'Self')
        if ob == 'Self': o = 'este'
        elif ob in ('Targeted', 'ParentTarget') and ctx['ultAlvo'] >= 0: o = {'alvo': ctx['ultAlvo']}
        else: o = em_de({'Defined': ob}, ctx, falta)
        a = em_de(d, ctx, falta)
        if o is None or a is None:
            return []
        fx = {'op': 'anexar', 'em': o, 'a': a}
    elif api == 'CopyPermanent' and not d.get('Defined', '').startswith('Valid '):
        if d.get('Populate') == 'True':
            cp = {'todos': {'tipo': ['Creature'], 'ficha': True, 'ctrl': 'voce'}}
        else:
            cp = em_de(d, ctx, falta)
        if cp is None:
            return []
        tk = {'copiaDe': cp}
        if d.get('SetPower') and d.get('SetToughness'):
            if d['SetPower'].isdigit() and d['SetToughness'].isdigit():
                tk['pt'] = [int(d['SetPower']), int(d['SetToughness'])]
            else: falta.append('CopyPermanent:SetPower X')
        if d.get('SetColor'): tk['cores'] = wubrg(d['SetColor'])
        if d.get('SetCreatureTypes'): tk['sub'] = d['SetCreatureTypes'].split()
        if d.get('AddTypes'): tk['tipos'] = d['AddTypes'].split(' & ')
        if d.get('AddKeywords') or d.get('PumpKeywords'):
            ks = kw_lista(d.get('AddKeywords') or d.get('PumpKeywords'), falta)
            if ks: tk['kw'] = ks
        if d.get('NonLegendary') == 'True': tk['naoLendaria'] = True
        fx = {'op': 'ficha', 'quem': jogador(d.get('Controller'), 'voce') or 'voce',
              'qtd': qtd(d.get('NumCopies'), sv, falta, ctx), 'token': tk}
        eot = d.get('AtEOT') or d.get('AtEOTTrig')
        if eot in ('Sacrifice', 'Exile'):
            op = 'sacrificar' if eot == 'Sacrifice' else 'exilar'
            res = [fx, {'op': 'gatilhoAtrasado', 'quando': {'ev': 'fase', 'passo': 'final', 'deQuem': 'cadaJogador',
                                                              'fx': [{'op': op, 'em': 'criadas'}]}}]
            ctx['_extra'] = res[1:]
        elif eot:
            falta.append('AtEOT:' + eot)
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
    if len(ctx.get('marcados', [])) > 1 and d.get('Defined') == 'Targeted' and fx.get('em') == {'alvo': ctx['ultAlvo']}:
        return [dict(fx, em={'alvo': i}) for i in ctx.pop('marcados')]   # Decimate: um efeito por alvo
    se = condicao(d, ctx, falta)
    if se:
        fx['se'] = {**fx.get('se', {}), **se}
    if d.get('UnlessResolveSubs'):
        falta.append('UnlessResolveSubs')
    if d.get('UnlessCost'):
        c, _ = custo_atv(d['UnlessCost'], falta)
        if d.get('UnlessSwitched') == 'True':
            fx['pagando'] = c            # só faz se pagar ("you may pay …; if you do")
        else:
            fx['aMenosQue'] = {'quem': jogador(d.get('UnlessPayer'), 'voce') or 'voce', 'custo': c}
    return [fx] + ctx.pop('_extra', [])


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
        em = {'todos': filtro(d.get('ChangeType', 'Permanent' if (de or 'campo') == 'campo' else 'Card'), falta, de or 'campo')}
        if d.get('Defined') in ('Player.IsRemembered', 'Remembered'):
            em['todos']['dono'] = 'cadaAtual'     # repetirCada: as cartas do jogador da vez
        elif d.get('Defined') == 'You':
            em['todos']['dono'] = 'voce'
    else:
        em = em_de(d, ctx, falta, de or 'campo')
    escolha = None
    if em is None and not d.get('ValidTgts'):
        df = d.get('Defined', '')
        if d.get('ChangeType') or (d.get('ChangeNum') and not df):
            # escolhe N cartas da zona que batem no filtro (Stoneforge, karoo, Brainstorm, Command Beacon)
            de = de or (o[0] if o else None)              # Six: Graveyard,Exile → a primeira
            fz = filtro(d.get('ChangeType', 'Card'), falta, de or 'campo')
            if de and de != 'campo': fz.setdefault('dono', 'voce')
            elif 'ctrl' not in fz: fz['ctrl'] = 'voce'
            escolha = {'f': fz, 'qtd': qtd(d.get('ChangeNum', '1'), ctx['sv'], falta, ctx)}
        elif not df:
            em = 'este'                                   # Bloodghast, Reassembling Skeleton
        elif df == 'Parent':
            em = 'este'                                   # a própria mágica (White Sun's Zenith)
        elif df == 'ChosenCard':
            em = 'escolhida'
        elif df in ('ExiledWith', 'DelayTriggerRememberedLKI', 'DelayTriggerRemembered'):
            em = 'anterior'                               # o que este exilou / lembrou
        else:
            falta.append('ChangeZone:Defined:' + df)
        if em is not None and falta and falta[-1] == 'Defined:' + df:
            falta.pop()                                   # em_de não conhecia; resolvido aqui
    op = 'exilar' if para == 'exilio' and de == 'campo' else 'mover'
    fx = {'op': op}
    if em is not None:
        fx['em'] = em
    if escolha:
        fx.update(escolha)
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
        elif api == 'Branch':
            # Scute Swarm: se a condição vale, faz o ramo True; senão, o False
            cd = {k.replace('Branch', ''): v for k, v in d.items() if k.startswith('Branch')}
            cd = {('ConditionCheckSVar' if k == 'ConditionSVar' else 'ConditionSVarCompare' if k == 'ConditionSVarCompare' else k): v
                  for k, v in cd.items()}
            se = condicao(cd, ctx, falta)
            if not se or set(se) != {'conta'}:
                falta.append('Branch:' + ','.join(sorted(d)))
            else:
                c = se['conta']; neg = {'q': c['q']}
                if 'min' in c and isinstance(c['min'], int): neg['max'] = c['min'] - 1
                elif 'max' in c and isinstance(c['max'], int): neg['min'] = c['max'] + 1
                else: falta.append('Branch:compara')
                for lado, cond in (('TrueSubAbility', c), ('FalseSubAbility', neg)):
                    if not d.get(lado): continue
                    m = []
                    cadeia(params(ctx['sv'].get(d[lado], '')), ctx, falta, m)
                    for e in m: e['se'] = {**e.get('se', {}), 'conta': cond}
                    fx_out.extend(m)
        elif api == 'ImmediateTrigger':
            # "quando fizer" (gatilho reflexivo): paga o custo → faz o Execute
            m = []
            ex = params(ctx['sv'].get(d.get('Execute', ''), ''))
            if not ex: falta.append('ImmediateTrigger:Execute')
            else: cadeia(ex, ctx, falta, m)
            pg = None
            if d.get('Cost'): pg, _ = custo_atv(d['Cost'], falta)
            elif d.get('UnlessCost') and d.get('UnlessSwitched') == 'True': pg, _ = custo_atv(d['UnlessCost'], falta)
            elif d.get('UnlessCost'): falta.append('ImmediateTrigger:UnlessCost')
            if pg and m:
                m[0]['pagando'] = pg
                for e in m[1:]: e['se'] = {**e.get('se', {}), 'pagou': True}
            se = condicao(d, ctx, falta)
            if se:
                for e in m: e['se'] = {**e.get('se', {}), **se}
            fx_out.extend(m)
        else:
            for e in efeito(api, d, ctx, falta):
                ant = fx_out[-1] if fx_out else None
                if e['op'] == 'efeitoTemporario' and ant and ant['op'] == 'efeitoTemporario' and ant['dura'] == e['dura'] \
                        and ant.get('em') == e.get('em'):
                    for k in ('est', 'gat', 'subst'):
                        if e.get(k): ant.setdefault(k, []).extend(e[k])
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
FASE = {'Upkeep': 'manutencao', 'Draw': 'compra', 'BeginCombat': 'inicioCombate', 'End of Turn': 'final', 'End Of Turn': 'final', 'Cleanup': 'final',
        'Main1': 'principal1', 'Main2': 'principal2'}


def gatilho(t, f, falta):
    d = t if isinstance(t, dict) else tparams(t)
    modo = d.get('Mode', '')
    g = {}
    vc = d.get('ValidCard', '')
    if modo == 'ChangesZoneAll':
        g['grupo'] = True; vc = d.get('ValidCards', '')
    if modo in ('ChangesZone', 'ChangesZoneAll'):
        o, de = d.get('Origin', 'Any'), d.get('Destination', 'Any')
        if de == 'Battlefield':
            g['ev'] = 'entra'
        elif o == 'Battlefield' and de == 'Graveyard':
            g['ev'] = 'morre' if re.match(r'(Creature|Card\.Self|Card\.EquippedBy|Card\.AttachedBy|Card\.EnchantedBy)', vc) else 'vaiCemiterio'
        elif o == 'Battlefield':
            g['ev'] = 'sai'
        elif de == 'Graveyard':
            g['ev'] = 'vaiCemiterio'
        elif o == 'Graveyard':
            g['ev'] = 'saiCemiterio'     # Teval: cartas deixam seu cemitério
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
    elif modo == 'AttackersDeclaredOneTarget':   # uma ou mais atacam o mesmo jogador
        g['ev'] = 'atacantesDeclarados'; g['umAlvo'] = True
        vc = d.get('ValidAttackers', '')
        if jogador(d.get('AttackedTarget', ''), None): g['jog'] = jogador(d['AttackedTarget'])
    elif modo in ('CounterAdded', 'CounterAddedOnce'):
        g['ev'] = 'marcadorPosto'
        if modo == 'CounterAddedOnce': g['grupo'] = True     # um ou mais marcadores de uma vez
        if d.get('CounterType'): g['marc'] = marc(d['CounterType'])
        vc = re.sub(r'\+inZoneBattlefield', '', vc)
    elif modo == 'TokenCreated':
        g['ev'] = 'fichaCriada'; vc = d.get('ValidToken', '')
    elif modo == 'Discarded':
        g['ev'] = 'descarta'
        if re.search(r'(^|[+.])OppOwn', vc): g['jog'] = 'oponente'
        elif re.search(r'(^|[+.])YouOwn', vc): g['jog'] = 'voce'
        vc = re.sub(r'\+?(OppOwn|YouOwn)', '', vc).rstrip('.')
        if vc == 'Card': vc = ''
    elif modo == 'TapsForMana':
        g['ev'] = 'viraParaMana'
        if d.get('Activator') == 'You': g['jog'] = 'voce'
    elif modo == 'Blocks':
        g['ev'] = 'bloqueia'
    elif modo in ('SpellCast', 'SpellCastOrCopy'):
        g['ev'] = 'conjura'
        if modo == 'SpellCastOrCopy': g['ouCopia'] = True
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
    se = condicao({k: v for k, v in d.items() if k != 'Condition' or v != 'PlayerTurn'}, ctx, falta)
    if d.get('CheckDefinedPlayer') == 'You.isMonarch':
        se = {**(se or {}), 'monarca': True}
    elif d.get('CheckDefinedPlayer'):
        falta.append('T:CheckDefinedPlayer:' + d['CheckDefinedPlayer'])
    if d.get('Condition') == 'PlayerTurn' or d.get('PlayerTurn') == 'True':
        se = {**(se or {}), 'turno': 'seu'}
    if se:
        g['se'] = {**g.get('se', {}), **se}   # condição de intervenção (CR 603.4)
    g['fx'] = fx
    return g


# ------------------------------------------------------------------ estáticas e substituições (v1: as comuns)
def estatica(s, f, falta):
    d = tparams(s)
    m = d.get('Mode', '')
    if m == 'Continuous' and d.get('AffectedZone') and (d.get('MayPlay') or d.get('MayLookAt')):
        zn = ZONA.get(d['AffectedZone'].split(',')[0], 'qualquer')
        af = d.get('Affected', 'Card.Self')
        e = {'modo': 'podeJogar' if d.get('MayPlay') else 'podeOlhar',
             'afeta': 'este' if af == 'Card.Self' else filtro(af, falta, zn)}
        if e['afeta'] == 'este': e['de'] = zn
        if d.get('MayPlayLimit', '').isdigit(): e['limite'] = int(d['MayPlayLimit'])
        if d.get('MayPlayWithoutManaCost') == 'True': e['gratis'] = True
        if d.get('Condition') == 'PlayerTurn': e['se'] = {'turno': 'seu'}
        resto = set(d) - {'Mode', 'Affected', 'AffectedZone', 'MayPlay', 'MayLookAt', 'MayPlayLimit', 'MayPlayText',
                          'MayPlayWithoutManaCost', 'Condition', 'EffectZone', 'Description', 'AILogic'}
        if resto: falta.append('S:Continuous:' + ','.join(sorted(resto)))
        return e
    if m == 'Continuous' and d.get('CharacteristicDefining') == 'True' and (d.get('SetPower') or d.get('SetToughness')):
        e = {'modo': 'continuo', 'afeta': 'este', 'camada': '7a'}
        for k, c in (('SetPower', 'pBase'), ('SetToughness', 'rBase')):
            if d.get(k): e[c] = qtd(d[k], f['SVar'], falta, {'ultAlvo': -1})
        return e
    if m == 'Continuous':
        e = {'modo': 'continuo'}
        d.pop('AddSVar', None); d.pop('AILogic', None)   # SVar de apoio / dica de IA do Forge
        zaf = ZONA.get(d.pop('AffectedZone', 'Battlefield').split(',')[0], 'qualquer') if d.get('AffectedZone') != 'All' else (d.pop('AffectedZone') and 'qualquer')
        if d.get('IsPresent'):
            se = condicao({k: d.pop(k) for k in ('IsPresent', 'PresentCompare', 'PresentZone') if k in d},
                          {'sv': f['SVar'], 'ultAlvo': -1}, falta)
            if se: e['se'] = se
        if d.get('CheckSVar'):
            e['se'] = {**e.get('se', {}), 'conta': {'q': qtd(d.pop('CheckSVar'), f['SVar'], falta, {'ultAlvo': -1}),
                                                   **compara(d.pop('SVarCompare', 'GE1'), falta)}}
        if d.get('AddType'):
            e['tipo'] = d.pop('AddType').split(' & ')
        if d.get('RemoveType'):
            e['tiraTipo'] = d.pop('RemoveType').split(' & ')
        if d.get('SetMaxHandSize') or d.get('AdjustLandPlays'):
            pass
        elif d.get('AffectedDefined') in ('Equipped', 'Enchanted'):
            e['afeta'] = 'equipada'
        elif d.get('AffectedDefined') == 'Self':
            e['afeta'] = 'este'
        elif d.get('Affected'):
            e['afeta'] = 'este' if d['Affected'] == 'Card.Self' else filtro(d['Affected'], falta, zaf)
        else:
            falta.append('S:Continuous sem Affected'); return None
        for k, c in (('AddPower', 'p'), ('AddToughness', 'r')):
            if k in d:
                e[c] = qtd(d[k].lstrip('+'), f['SVar'], falta, {'ultAlvo': -1})
        if d.get('AddKeyword'):
            ks = []
            for k in d['AddKeyword'].split(' & '):
                if k in KW: ks.append({'k': KW[k]})
                elif k.partition(':')[0] in KWC and (kk := palavra(k, [])): ks.append(kk)
                else: falta.append('S:AddKeyword:' + k)
            if ks: e['kw'] = ks
        if d.get('AddAbility') or d.get('AddTrigger'):
            h = habil_dada(d, f['SVar'], falta)
            if h: e['habil'] = h
            d.pop('AddAbility', None); d.pop('AddTrigger', None)
        if d.get('AdjustLandPlays', '').isdigit() and d.get('Affected') == 'You':
            e = {'modo': 'terraExtra', 'afeta': 'voce', 'qtd': int(d.pop('AdjustLandPlays'))}
            d.pop('Affected')
            if set(d) - {'Mode', 'Description'}:
                falta.append('S:Continuous:' + ','.join(sorted(set(d) - {'Mode', 'Description'})))
            return e
        if d.get('SetMaxHandSize'):
            mh = d.pop('SetMaxHandSize')
            e = {'modo': 'maoMax', 'afeta': jogador(d.get('Affected'), 'voce') or 'voce',
                 'qtd': 'tudo' if mh == 'Unlimited' else int(mh) if mh.isdigit() else 7}
            d.pop('Affected', None)
            if set(d) - {'Mode', 'Description'}:
                falta.append('S:Continuous:' + ','.join(sorted(set(d) - {'Mode', 'Description'})))
            return e
        if d.get('Condition') == 'PlayerTurn':
            e['se'] = {**e.get('se', {}), 'turno': 'seu'}; d.pop('Condition')
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
    if m == 'RaiseCost' and d.get('ValidTarget'):
        # Terror of the Peaks / Kopala: mágicas (ou habilidades) que miram o seu custam mais
        vt = re.sub(r'\+inZoneBattlefield', '', d['ValidTarget'])
        e = {'modo': 'aumentaCusto', 'afeta': 'este' if vt == 'Card.Self' else filtro(vt, falta, 'campo'), 'aoMirar': True}
        if d.get('Activator', '').endswith('Opponent'): e['quem'] = 'cadaOponente'
        if d.get('Type') == 'Ability': e['deHabil'] = True
        if d.get('Cost'):
            e['pagar'], _ = custo_atv(d['Cost'], falta)
        else:
            e['qtd'] = qtd(d.get('Amount', '1'), f['SVar'], falta, {'ultAlvo': -1})
        return e
    if m == 'CantChangeLife':
        return {'modo': 'vidaNaoMuda', 'afeta': jogador(d.get('ValidPlayer'), 'voce') or 'voce'}
    if m == 'CantPreventDamage':
        return {'modo': 'danoNaoPrevenivel', 'afeta': 'cadaJogador'}
    if m == 'Panharmonicon' and d.get('Destination') == 'Battlefield':
        e = {'modo': 'dobraGatilhoEntrar', 'afeta': filtro(d.get('ValidCause') or d.get('ValidCard', 'Permanent'), falta, 'campo')}
        return e
    if m == 'AlternativeCost' and (d.get('ValidCard') == 'Card.Self' or d.get('ValidSA') == 'Spell.Self'):
        c, _ = custo_atv(d.get('Cost', '0'), falta)
        e = {'modo': 'custoAlternativo', 'afeta': 'este', 'pagar': c}
        if d.get('IsPresent'):
            e['se'] = {'controla': {'f': filtro(d['IsPresent'], falta, 'campo')}}
        return e
    if m == 'CantBeCast':
        e = {'modo': 'naoPodeConjurar', 'afeta': jogador(d.get('Caster'), 'cadaJogador') or 'cadaJogador'}
        if d.get('Caster') == 'Opponent': e['afeta'] = 'cadaOponente'
        if d.get('ValidCard') and d['ValidCard'] != 'Card': e['f'] = filtro(d['ValidCard'], falta, 'pilha')
        if d.get('Condition') == 'PlayerTurn': e['se'] = {'turno': 'seu'}
        se = condicao({k: v for k, v in d.items() if k in ('IsPresent', 'PresentCompare', 'PresentZone')}, {'sv': f['SVar'], 'ultAlvo': -1}, falta)
        if se: e['se'] = {**e.get('se', {}), **se}
        return e
    if m == 'Panharmonicon':
        EVS = {'ChangesZone': 'entra', 'ChangesZoneAll': 'entra', 'Attacks': 'ataca', 'AttackersDeclared': 'ataca',
               'AttackersDeclaredOneTarget': 'ataca'}
        e = {'modo': 'dobraGatilho', 'afeta': filtro(d.get('ValidCard', 'Permanent.YouCtrl'), falta, 'campo')}
        if d.get('ValidMode'):
            evs = sorted({EVS.get(x, x) for x in d['ValidMode'].split(',')})
            if d.get('Origin') == 'Battlefield' and d.get('Destination') == 'Graveyard': evs = ['morre']
            e['evs'] = evs
        if d.get('ValidCause'): e['causa'] = filtro(d['ValidCause'], falta)
        return e
    if m in ('CantAttack', 'CantBlock', 'CantAttackUnless', 'CastWithFlash', 'UntapOtherPlayer') and not d.get('UnlessDefender') \
            and not d.get('DefenderNotNearestToYouInChosenDirection'):
        modo = {'CantAttack': 'naoPodeAtacar', 'CantBlock': 'naoPodeBloquear', 'CantAttackUnless': 'ataqueCusta',
                'CastWithFlash': 'conjurarComLampejo', 'UntapOtherPlayer': 'desviraNoTurnoDeOutro'}[m]
        vc = d.pop('ValidCard', 'Card.Self')
        e = {'modo': modo, 'afeta': 'este' if vc in ('Card.Self', 'Creature.Self') else 'equipada'
             if vc in ('Creature.EnchantedBy', 'Creature.EquippedBy', 'Card.EnchantedBy', 'Card.AttachedBy')
             else filtro(vc, falta, 'pilha' if m == 'CastWithFlash' else 'campo')}
        if m == 'CastWithFlash' and d.get('Caster') == 'You' and isinstance(e['afeta'], dict): e['afeta']['ctrl'] = 'voce'
        if d.get('Target'):              # contra quem não pode atacar (você, seus planeswalkers…)
            tg = d.pop('Target').split(',')
            jg = [x for x in tg if jogador(x, None)]
            e['contra'] = {'jog': jogador(jg[0])} if len(jg) == 1 else {}
            if ob := [x for x in tg if x not in jg]: e['contra']['f'] = filtro(','.join(ob), falta)
        if m == 'CantAttackUnless':
            c = d.pop('Cost', '0')
            e['custo'] = mana_forge(c) if mana_forge(c) is not None else (falta.append('S:CantAttackUnless:' + c) or {})
            if c == 'X' and f['SVar'].get('X'):
                e['custo'] = {'g': 0}; e['qtd'] = qtd('X', f['SVar'], falta, {'ultAlvo': -1})   # Sphere of Safety: {X}, X = contagem
        sv = {'sv': f['SVar'], 'ultAlvo': -1}
        cd = {k: d.pop(k) for k in ('IsPresent', 'PresentCompare', 'PresentZone', 'Condition') if k in d}
        if d.get('CheckSVar'): cd['ConditionCheckSVar'] = d.pop('CheckSVar'); cd['ConditionSVarCompare'] = d.pop('SVarCompare', 'GE1')
        if se := condicao(cd, sv, falta): e['se'] = se
        resto = set(d) - {'Mode', 'Description', 'Secondary', 'ValidSA', 'Caster', 'EffectZone', 'AILogic'}
        if resto: falta.append(f'S:{m}:' + ','.join(sorted(resto)))
        return e
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
    if ev == 'AddCounter' and rw and rw[1] == 'ReplaceCounter':
        vc = re.sub(r'\+inZoneBattlefield', '', d.get('ValidCard', 'Permanent.YouCtrl'))
        y = f['SVar'].get(rw[2].get('Amount', ''), '')
        if y in ('ReplaceCount$CounterNum/Twice', 'ReplaceCount$CounterNum/Times.2'):
            return {'ev': 'marcador', 'quem': filtro(vc, falta), 'muda': {'mult': 2}}
        if m := re.fullmatch(r'ReplaceCount\$CounterNum/Plus\.(\d+)', y):
            return {'ev': 'marcador', 'quem': filtro(vc, falta), 'muda': {'soma': int(m.group(1))}}
    if ev == 'CreateToken' and rw and rw[1] == 'ReplaceToken' and rw[2].get('Type') == 'Amount':
        s = {'ev': 'ficha', 'quem': filtro(d.get('ValidToken', 'Card.YouCtrl'), falta), 'muda': {'mult': 2}}
        if rw[2].get('Amount', '').isdigit(): s['muda'] = {'soma': int(rw[2]['Amount'])}
        return s
    if ev == 'CreateToken' and rw and rw[1] == 'ReplaceToken' and rw[2].get('Type') in ('AddToken', 'ReplaceToken') \
            and rw[2].get('TokenScript'):
        fs = [ficha_de({'TokenScript': t}, falta) for t in rw[2]['TokenScript'].split(',')]
        vt = d.get('ValidToken', 'Card.YouCtrl')
        if d.get('ValidPlayer') == 'You' and 'YouCtrl' not in vt:
            vt = ','.join(x + ('+YouCtrl' if '.' in x else '.YouCtrl') for x in vt.split(','))
        if rw[2]['Type'] == 'AddToken':   # Peregrin Took: aquelas fichas + mais uma
            muda = {'maisFicha': fs[0]}
            if rw[2].get('Amount', '1') != '1': muda['maisQtd'] = int(rw[2]['Amount'])
        else:                              # Academy Manufactor: em vez disso, uma de cada
            muda = {'trocaPor': fs}
        return {'ev': 'ficha', 'quem': filtro(vt, falta), 'muda': muda}
    if ev == 'DamageDone' and rw and rw[1] in ('ReplaceEffect', 'ReplaceDamage') and \
            (rw[1] == 'ReplaceDamage' or rw[2].get('VarName') == 'DamageAmount'):
        y = f['SVar'].get(rw[2].get('VarValue') or rw[2].get('Amount', ''), '')
        muda = None
        if rw[1] == 'ReplaceEffect':
            k = {'Twice': 2, 'Thrice': 3}.get(y.rpartition('/')[2]) if y.startswith('ReplaceCount$DamageAmount/') else None
            if k: muda = {'mult': k}
        elif y == 'ReplaceCount$DamageAmount/HalfUp':
            muda = {'metade': True}          # previne metade arredondada p/ cima → fica a metade p/ baixo
        elif m := re.fullmatch(r'ReplaceCount\$DamageAmount/Minus\.(\d+)', y):
            muda = {'teto': int(m.group(1))}  # previne todo menos N
        if muda:
            s = {'ev': 'dano', 'muda': muda}
            if d.get('ValidSource') and d['ValidSource'] not in ('Card,Emblem',):
                s['por'] = filtro(','.join(x for x in d['ValidSource'].split(',') if not x.startswith('Emblem')), falta)
            vt = [x for x in d.get('ValidTarget', '').split(',') if x and x not in ('Permanent', 'Player')]
            jg = [x for x in vt if jogador(x, None)]
            if len(jg) == 1: s['jog'] = jogador(jg[0])   # jog + quem juntos = a esse jogador OU a esse objeto
            elif jg: falta.append('dano:jogadores ' + ','.join(jg))
            if ob := [x for x in vt if x not in jg]: s['quem'] = filtro(','.join(ob), falta)
            if d.get('IsCombat') == 'True': s['combate'] = True
            return s
    if ev == 'Counter' and d.get('Layer') == 'CantHappen':
        if d.get('ValidCard') == 'Card.Self':
            q = {'este': True}
        else:
            q = filtro(re.sub(r'(^|,)Spell(\.|$)', lambda m_: m_.group(1) + 'Card' + m_.group(2), d.get('ValidSA', 'Spell')), falta, 'pilha')
        return {'ev': 'anulada', 'quem': q, 'muda': {'impedir': True}}
    if ev == 'DamageDone' and (d.get('Prevent') == 'True' or d.get('PreventionEffect') == 'True') and not d.get('ReplaceWith'):
        s = {'ev': 'dano', 'muda': {'prevenir': True}}
        vt = d.get('ValidTarget', '')
        if jogador(vt, None): s['jog'] = jogador(vt)
        elif vt: s['quem'] = filtro(vt, falta)
        if d.get('IsCombat') == 'True': s['combate'] = True
        return s
    if ev == 'DamageDone' and rw and rw[1] == 'ReplaceDamage' and 'Twice' in f['SVar'].get(rw[2].get('Amount', ''), ''):
        s = {'ev': 'dano', 'muda': {'mult': 2}}
        if d.get('ValidSource'): s['por'] = filtro(d['ValidSource'].replace(',Emblem', ''), falta)
        vt = d.get('ValidTarget', '')
        if jogador(vt, None): s['jog'] = jogador(vt)
        elif vt: s['quem'] = filtro(vt, falta)
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
    if r and r[1] == 'PutCounter' and r[2].get('ETB') == 'True':
        # Giada / Metallic Mimic: cada outro X seu entra com marcador(es) a mais
        partes = sv.split(':')
        vc = partes[3] if len(partes) > 3 else 'Card.Self'
        q = qtd(r[2].get('CounterNum', '1'), f['SVar'], falta, {'ultAlvo': -1})
        sb = {'ev': 'entra', 'quem': {'este': True} if vc in ('Card.Self', 'Creature.Self') else filtro(vc, falta),
              'muda': {'marcadores': {marc(r[2].get('CounterType', 'P1P1')): q}}}   # q pode ser contagem (Giada)
        se = condicao(r[2], {'sv': f['SVar'], 'ultAlvo': -1}, falta)
        if se: sb['se'] = se
        return sb
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
        elif kk['k'] == 'resguardo' and mana_forge(arg) is None and '<' in arg:
            c, _ = custo_atv(arg, falta)          # Ward—Pay 2 life
            kk['pagar'] = c
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
def monta_atv(api, d, ctx, efs, falta):
    c, leal = custo_atv(d.get('Cost', ''), falta)
    at = {'custo': c, 'fx': efs}
    if ctx['alvos']: at['alvos'] = ctx['alvos']
    if api in ('Mana', 'ManaReflected'): at['deMana'] = True
    if d.get('SorcerySpeed') == 'True': at['vel'] = 'feitico'
    if d.get('ActivationZone'): at['zona'] = ZONA.get(d['ActivationZone'], 'qualquer')
    if d.get('ActivationLimit') == '1': at['limite'] = 'umaPorTurno'
    if leal is not None: at['lealdade'] = leal
    return at


def habil_dada(d, sv, falta):
    """AddAbility$/AddTrigger$ de uma estática → {'atv': [...], 'gat': [...]}"""
    h = {}
    for nome in (d.get('AddAbility') or '').split('&'):
        r = params(sv.get(nome.strip(), '')) if nome.strip() else None
        if not r:
            if nome.strip(): falta.append('AddAbility:' + nome.strip())
            continue
        ctx = {'sv': sv, 'alvos': [], 'ultAlvo': -1, 'depois': [], 'busca': None}
        efs = []
        cadeia(r, ctx, falta, efs)
        h.setdefault('atv', []).append(monta_atv(r[1], r[2], ctx, efs, falta))
    for nome in (d.get('AddTrigger') or '').split('&'):
        t = sv.get(nome.strip(), '') if nome.strip() else ''
        if t:
            g = gatilho(t, {'SVar': sv}, falta)
            if g: h.setdefault('gat', []).append(g)
    return h


_SV = {}   # SVars da face em conversão (filtro com 'cmcLEX' precisa)


def face_rx(f, falta):
    global _SV
    _SV = f['SVar']
    out = {}
    ESP = ('ETBReplacement:', 'etbCounter:', 'Chapter:')
    kws = [x for x in (palavra(k, falta) for k in f['K'] if not k.startswith(ESP)) if x]
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
            ad, _ = custo_atv(d.get('Cost', ''), falta)
            ad.pop('mana', None)
            if ad: out['custoAd'] = ad      # custo adicional da mágica (sacrificar, pagar vida, descartar…)
        else:
            atv.append(monta_atv(api, d, ctx, efs, falta))
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
    for k in f['K']:                     # saga: K:Chapter:N:SVar1,SVar2… → gatilho por capítulo (CR 714)
        if k.startswith('Chapter:'):
            _, n, nomes = k.split(':', 2)
            for i, nm in enumerate(nomes.split(','), 1):
                r = params(f['SVar'].get(nm.strip(), ''))
                if not r:
                    falta.append('Chapter:' + nm); continue
                ctx = novo_ctx(f); efs = []
                cadeia(r, ctx, falta, efs)
                g = {'ev': 'capitulo', 'n': i, 'fx': efs}
                if ctx['alvos']: g['alvos'] = ctx['alvos']
                gs.append(g)
    if gs: out['gat'] = gs
    es = [x for x in (estatica(s, f, falta) for s in f['S']) if x]
    if es: out['est'] = es
    ss = [x for x in (etb_repl(k.partition(':')[2], f, falta) for k in f['K'] if k.startswith('ETBReplacement:')) if x]
    ss += [x for x in (substituicao(r, f, falta) for r in f['R']) if x]
    for k in f['K']:                     # K:etbCounter:P1P1:N → entra com N marcadores
        if k.startswith('etbCounter:'):
            pp = k.split(':')
            n = qtd(pp[2] if len(pp) > 2 else '1', f['SVar'], falta, {'ultAlvo': -1})
            ss.append({'ev': 'entra', 'quem': {'este': True}, 'muda': {'marcadores': {marc(pp[1]): n}}})
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
