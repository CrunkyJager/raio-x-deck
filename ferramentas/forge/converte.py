#!/usr/bin/env python3
"""Lê os roteiros de cartas do Forge (GPL-3.0, github.com/Card-Forge/forge, forge-gui/res/cardsfolder)
e grava forge-db.js: para cada carta da cards-db, as FUNÇÕES que ela cumpre (ramp, compra, remoção,
limpa-mesa, proteção, contramágica) com os parâmetros que pesam (tipo, quantidade, alcance, repetição...).
Nada de ler o inglês: tudo sai dos campos estruturados do roteiro (SP$/AB$/DB$, T:, S:, R:, K:).

uso:  python3 ferramentas/forge/converte.py        (gera forge-db.js na raiz do site)
teste: python3 ferramentas/forge/testa.py          (casos esperados em esperado.json — tem que dar 100%)

Formato de cada entrada (lista por função):
  comuns: rep  = 0 (uma vez) | 'tap' | 'act' (ativada sem se sacrificar) | 'fase' (todo turno) | 'gatilho' | 'sempre' (estática)
          cond = modo do gatilho do Forge quando depende de um evento (SpellCast, Attacks, ChangesZone...)
          modal = 1 se é uma escolha entre modos/metades;  tras = 1 se só vale na face de trás (transformar)
  ramp:    tipo pedra|dork|terreno|tesouro|ritual|sacrifica|pede|extra|gatilho|reduz|terra-extra|desvira|multiplica, g = manas
  draw:    tipo compra|cava|impulso|topo|recursao|monarca|iniciativa|descobre|pista|conive, n, loot, todos (todos compram), paga (o oponente pode pagar)
  removal: modo destroi|exila|mao|grimorio|dano|menos|luta|edito|rouba|neutraliza, alc (o que pega), restr ('cor' ou rótulo do Forge), dano
  wipe:    modo (API do Forge ou 'sobrecarga'/'estatico'), alc, lado (só dos oponentes), poupa (poupa um tipo), restr, dano
  counter: alvo ('qualquer' ou o filtro do Forge), paga, volta (devolve em vez de anular)
  protect: kw (Hexproof/Indestructible/...|blink|desvia|volta), todos, quem si|alvo|anexo|magica
"""
import json, os, re, sys
from collections import Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
PASTA = os.path.join(AQUI, 'src', 'forge-gui', 'res', 'cardsfolder')
DBG = None  # auditoria: lista que recebe os efeitos lidos de cada carta
TERRA = r'(?<![nN]on)(?<!\.non)\b(Land|Forest|Plains|Island|Swamp|Mountain|Desert|Gate|Cave|Sphere|Locus|Town)\b'
FICHAS = {}  # roteiro das fichas do Forge: nome do script -> 'terreno' | 'tesouro' | 'dork' | ''
KWP = r'Hexproof|Indestructible|Shroud|Protection|Ward|Phasing'


# ------------------------------------------------------------------ leitura dos arquivos
def params(s):
    """'SP$ Draw | NumCards$ 2 | ...' -> ('SP', 'Draw', {...})"""
    partes = [p.strip() for p in (s or '').split('|')]
    m = re.match(r'(SP|AB|DB|ST)\$\s*(\w+)', partes[0])
    if not m:
        return None
    d = {}
    for p in partes[1:]:
        if '$' in p:
            k, v = p.split('$', 1); d[k.strip()] = v.strip()
    return m.group(1), m.group(2), d


def tparams(s):
    d = {}
    for p in (s or '').split('|'):
        if '$' in p:
            k, v = p.split('$', 1); d[k.strip()] = v.strip()
    return d


def le_face(linhas):
    f = {'A': [], 'T': [], 'S': [], 'K': [], 'R': [], 'SVar': {}}
    for l in linhas:
        if ':' not in l:
            continue
        k, v = l.split(':', 1)
        if k == 'SVar':
            n, _, val = v.partition(':'); f['SVar'][n] = val
        elif k in ('A', 'T', 'S', 'K', 'R'):
            f[k].append(v)
        elif k in ('Name', 'Types', 'ManaCost', 'PT', 'Oracle', 'AlternateMode'):
            f[k] = v
    return f


def le_arquivo(p):
    txt = open(p, encoding='utf-8', errors='replace').read().replace('\r', '')
    return [le_face(b.split('\n')) for b in re.split(r'\n\s*ALTERNATE\s*\n', txt)]


def inteiro(v, svars, fallback=2):
    """número do roteiro; X e contagens viram 'fallback' (valem 'algumas')"""
    if v is None or v == '':
        return 1
    if re.fullmatch(r'\d+', v):
        return int(v)
    m = re.fullmatch(r'Number\$(\d+)', svars.get(v, ''))
    return int(m.group(1)) if m else fallback


# ------------------------------------------------------------------ de quem é / quem é afetado
def le_fichas():
    pasta = os.path.join(AQUI, 'src', 'forge-gui', 'res', 'tokenscripts')
    if not os.path.isdir(pasta):
        return
    for a in os.listdir(pasta):
        f = le_face(open(os.path.join(pasta, a), encoding='utf-8', errors='replace').read().split('\n'))
        t = ''
        if re.search(r'\bLand\b', f.get('Types', '')):
            t = 'terreno'
        else:
            for ab in f['A']:
                r = params(ab)
                if r and r[1] == 'Mana':
                    c = r[2].get('Cost', '')
                    t = 'tesouro' if re.search(r'Sac<1/(CARDNAME|NICKNAME)[>/]', c) else 'dork' if 'Creature' in f.get('Types', '') else 'pedra'
        FICHAS[a[:-4]] = t


def eh_meu(v):
    return bool(re.search(r'YouCtrl|YouOwn|^You$|^Self$|Card\.Self|CARDNAME', v or ''))


def eh_dele(v):
    return bool(re.search(r'OppCtrl|YouDontCtrl|OppOwn|Opponent|TargetedController|TargetedOwner', v or ''))


def jogador(defined, ctx, tgts=''):
    """quem é afetado: eu | opo | todos | alvo (jogador escolhido) | ?"""
    d = defined or ''
    if d == '' and tgts and re.search(r'(^|,)(Player|Opponent)', tgts):
        return 'alvo' if not re.search('Opponent', tgts) else 'opo'
    if d in ('TargetedAndYou', 'You & Targeted', 'You & TargetedPlayer'):
        return 'todos'
    if d in ('', 'You') or re.fullmatch(r'You( & .*)?|Triggered\w*Controller|TriggeredCardOwner|Remembered(Controller)?|TopOfLibrary', d):
        return 'eu'
    if d == 'TriggeredPlayer' or d == 'TriggeredTarget':
        vp = ctx.get('vp', '')
        return 'eu' if vp == 'You' else 'opo' if 'Opponent' in vp else 'todos'
    if re.fullmatch(r'(This)?Targeted(Player)?|ParentTarget', d):
        return 'opo' if re.search('Opponent', tgts) else 'alvo'
    if re.search(r'Opponent|Other|TargetedController|TargetedOwner|DefendingPlayer|TriggeredActivator', d):
        return 'opo'
    if re.fullmatch(r'Player(\.\w+)?|Each|Player\.IsRemembered', d):
        return 'todos'
    return '?'


def alcance(v):
    """'Creature.OppCtrl,Artifact' -> o que a remoção pega"""
    if not v:
        return ''
    s = {p.split('.')[0].split('+')[0] for p in v.split(',')}
    s -= {'Player', 'Opponent', 'You', 'Emblem'}
    if not s or (s <= {'Planeswalker', 'Battle'} and re.search(r'(^|,)(Player|Opponent)', v)):
        return 'jogador'  # 'jogador ou planeswalker' (Boros Charm) é dano no jogador, não remoção
    if s & {'Permanent', 'Card', 'Any'} and re.search(r'nonLand', v):
        return 'naoterreno'
    if s & {'Any'}:
        return 'qualquer'
    if s & {'Permanent', 'Card'}:
        return 'naocriatura' if re.search(r'\.nonCreature', v) else 'permanente'
    if 'Creature' in s and s & {'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle'}:
        return 'criatura+'
    if 'Creature' in s:
        return 'criatura'
    if s <= {'Artifact', 'Enchantment'}:
        return 'artefato/encantamento'
    if s <= {'Planeswalker', 'Battle'}:
        return 'planeswalker'
    if s <= {'Land', 'Forest', 'Plains', 'Island', 'Swamp', 'Mountain'}:
        return 'terreno'
    return 'outro'


def restrito(v):
    """restrição do alvo: 'cor' se for de cor; senão o rótulo do Forge; '' = sem restrição"""
    v = v or ''
    if re.search(r'\.(White|Blue|Black|Red|Green|nonWhite|nonBlue|nonBlack|nonRed|nonGreen)\b', v):
        return 'cor'
    m = re.search(r'\.(non(?!Land\b|Token\b)\w+|power(LE|GE|LT|GT)\w*|cmc(LE|GE|LT|GT)\w*|toughness(LE|GE)\w*|attacking|blocking|tapped|untapped|withFlying|withoutFlying|Colorless|Multicolor|token|Legendary|greatestPower\w*)', v)
    return m.group(1) if m else ''


# ------------------------------------------------------------------ achatar habilidades
class Leitor:
    """Achata as habilidades de uma face numa lista de efeitos, cada um com o contexto em que acontece."""

    def __init__(self, f):
        self.f, self.sv, self.efs, self.vistos = f, f['SVar'], [], set()

    def segue(self, txt, ctx, prof=0, modal=False):
        if prof > 14 or not txt or txt in self.vistos:
            return
        r = params(txt)
        if not r:
            return
        self.vistos.add(txt)
        _, api, d = r
        if api in ('Charm', 'GenericChoice', 'Branch'):
            for ch in re.split(r'[,]', d.get('Choices', '')) + [d.get('TrueSubAbility', ''), d.get('FalseSubAbility', '')]:
                if ch.strip():
                    self.segue(self.sv.get(ch.strip()), ctx, prof + 1, True)
        else:
            self.efs.append({'api': api, 'p': d, 'ctx': ctx, 'modal': modal})
        for k, v in d.items():
            if k in ('Choices', 'TrueSubAbility', 'FalseSubAbility') or v not in self.sv:
                continue
            if params(self.sv[v]):
                self.segue(self.sv[v], ctx, prof + 1, modal or k in ('UnchosenPile', 'OtherwiseSubAbility'))
        if api in ('Effect', 'DelayedTrigger', 'ImmediateTrigger', 'Animate', 'AnimateAll', 'Pump', 'PumpAll'):
            tmp = dict(ctx, tmp=1)
            for t in (d.get('Triggers', '') + ',' + d.get('AddTriggers', '')).split(','):
                td = tparams(self.sv.get(t.strip(), '')) if t.strip() else {}
                if td.get('Execute'):
                    self.segue(self.sv.get(td['Execute']), dict(tmp, mode=td.get('Mode', '?'), vc=td.get('ValidCard', '')), prof + 1, modal)
            for s in (d.get('StaticAbilities', '') + ',' + d.get('AddStaticAbilities', '')).split(','):
                if self.sv.get(s.strip()):
                    self.estatica(self.sv[s.strip()], tmp)
            for rr in d.get('ReplacementEffects', '').split(','):
                rd = tparams(self.sv.get(rr.strip(), '')) if rr.strip() else {}
                if rd.get('ReplaceWith'):
                    self.segue(self.sv.get(rd['ReplaceWith']), dict(tmp, mode='R:' + rd.get('Event', '')), prof + 1, modal)

    def estatica(self, s, ctx):
        d = tparams(s)
        self.efs.append({'api': 'S:' + d.get('Mode', ''), 'p': d, 'ctx': ctx, 'modal': False})
        dado = (d.get('AffectedDefined', '') + ' ' + d.get('Affected', '')).strip()
        for ab in re.split(r'\s*&\s*', d.get('AddAbility', '')):
            a = self.sv.get(ab.strip())
            r = params(a)
            if r:
                self.segue(a, {'k': 'act', 'cost': r[2].get('Cost', ''), 'zone': 'Battlefield', 'dado': dado, 'tmp': ctx.get('tmp', 0)})
        for tr in re.split(r'\s*&\s*', d.get('AddTrigger', '')):
            td = tparams(self.sv.get(tr.strip(), ''))
            if td.get('Execute'):
                self.segue(self.sv.get(td['Execute']), {'k': 'trig', 'mode': td.get('Mode', '?'), 'self': False, 'dado': dado, 'vc': td.get('ValidCard', ''),
                                                       'vp': td.get('ValidPlayer', ''), 'zone': 'Battlefield'})

    def tudo(self):
        f = self.f
        for a in f['A']:
            r = params(a)
            if not r:
                continue
            ctx = {'k': 'spell'} if r[0] == 'SP' else {'k': 'act', 'cost': r[2].get('Cost', ''), 'zone': r[2].get('ActivationZone', 'Battlefield')}
            self.segue(a, ctx)
        for t in f['T']:
            d = tparams(t)
            ctx = {'k': 'trig', 'mode': d.get('Mode', ''), 'self': d.get('ValidCard', '') in ('Card.Self', 'Creature.Self', 'Permanent.Self'),
                   'vp': d.get('ValidPlayer', '') or d.get('ValidActivatingPlayer', ''), 'zone': d.get('TriggerZones', 'Battlefield'),
                   'vc': d.get('ValidCard', ''), 'dest': d.get('Destination', ''), 'origin': d.get('Origin', '')}
            self.segue(self.sv.get(d.get('Execute', '')), ctx)
        for s in f['S']:
            self.estatica(s, {'k': 'static'})
        for rr in f['R']:
            d = tparams(rr)
            self.efs.append({'api': 'R:' + d.get('Event', ''), 'p': d, 'ctx': {'k': 'static'}, 'modal': False})
            if d.get('ReplaceWith'):
                self.segue(self.sv.get(d['ReplaceWith']), {'k': 'static', 'mode': 'R:' + d.get('Event', '')})
        for k in f['K']:
            if k.startswith('Hideaway'):
                self.efs.append({'api': 'Hideaway', 'p': {}, 'ctx': {'k': 'trig', 'mode': 'ChangesZone', 'self': True}, 'modal': False})
            if k.startswith('Chapter:'):
                for n in k.split(':')[2].split(','):
                    self.segue(self.sv.get(n.strip()), {'k': 'trig', 'mode': 'Chapter', 'self': True})
        # o que sobrou (níveis de Class, escolhas, gatilhos dados de outro jeito): contexto desconhecido
        for v in list(self.sv.values()):
            if re.match(r'\s*(DB|AB)\$', v) and v not in self.vistos:
                self.segue(v, {'k': 'trig', 'mode': '?', 'self': False})
        return self.efs


def repete(ctx):
    """o efeito acontece mais de uma vez?"""
    k = ctx['k']
    if k == 'act':
        c = ctx.get('cost', '')
        if re.search(r'Sac<1/(CARDNAME|NICKNAME)[>/]|Exile<1/CARDNAME>|SacMe', c) or ctx.get('zone') not in ('Battlefield', None):
            return 0
        return 'tap' if re.search(r'(^|\s)T(\s|$)', c) else 'act'
    if k == 'trig':
        m = ctx.get('mode', '')
        if (m == 'ChangesZone' and ctx.get('self')) or m in ('Chapter', 'Cycled', 'Exploited', 'Devoured', 'Championed'):
            return 0
        if m == 'Phase':
            return 'fase'
        z = ctx.get('zone', 'Battlefield')
        if z and 'Battlefield' not in z:
            return 0
        return 'gatilho'
    if k == 'static':
        return 'sempre'
    return 0


# ------------------------------------------------------------------ funções de uma face
def funcoes_face(f, tras, alt):
    tipos = f.get('Types', '')
    cri = 'Creature' in tipos
    inst = 'Instant' in tipos or any(k.split(':')[0] == 'Flash' for k in f['K'])
    efs = Leitor(f).tudo()
    kws = f['K']
    sv = f['SVar']
    out = {}
    cur = [None]
    curse = sv.get('AttachAILogic', '') in ('Curse', 'Pacifism', 'KeepTapped') or any(re.search(r'AILogic\$ *Curse', k) for k in kws)
    aura = any(k.startswith('Enchant:') for k in kws)

    def add(k, d):
        if tras: d['tras'] = 1
        if alt: d['modal'] = 1
        out.setdefault(k, []).append(d)
        if cur[0] is not None:
            cur[0].setdefault('_f', []).append(k)

    def depois(e, cond):
        """algum efeito da mesma cadeia, depois deste, satisfaz cond?"""
        i = efs.index(e)
        return any(cond(x) for x in efs[i + 1:] if x['ctx'] is e['ctx'] or x['ctx'].get('tmp'))

    def pode_jogar(x):
        """o efeito seguinte deixa jogar a carta exilada (impulso) ou a põe na mão depois (Necropotence)?"""
        if x['api'] == 'S:Continuous' and x['p'].get('MayPlay'):
            return True
        if x['api'] == 'Effect' and 'MayPlay' in ''.join(sv.get(s.strip(), '') for s in x['p'].get('StaticAbilities', '').split(',')):
            return True
        return x['api'] in ('ChangeZone', 'Play') and x['p'].get('Origin', 'Exile') == 'Exile' and x['p'].get('Destination', 'Hand') in ('Hand', 'Stack')

    if DBG is not None:
        DBG.append(efs)
    for e in efs:
        cur[0] = e
        api, p, ctx = e['api'], e['p'], e['ctx']
        rp = repete(ctx)
        base = {}
        if rp: base['rep'] = rp
        if e['modal']: base['modal'] = 1
        if ctx['k'] == 'trig' and not (ctx.get('mode') == 'ChangesZone' and ctx.get('self')) and ctx.get('mode') not in ('Chapter',):
            base['cond'] = ctx.get('mode', '?')
        vt = p.get('ValidTgts', '')
        if not vt and re.match(r'Targeted|ParentTarget', p.get('Defined', '')):  # alvo escolhido num passo anterior (TargetOnly, Tap...)
            vt = ','.join(x['p'].get('ValidTgts', '') for x in efs[:efs.index(e)] if x['ctx'] is ctx and x['p'].get('ValidTgts'))
        if not vt and re.match(r'ChosenCard|Remembered', p.get('Defined', '')) and api in ('Destroy', 'ChangeZone', 'GainControl'):
            vt = ','.join((x['p'].get('Choices') or x['p'].get('VoteCard', '')) for x in efs[:efs.index(e)] if x['ctx'] is ctx and x['api'] in ('ChooseCard', 'Vote') and (x['p'].get('Choices') or x['p'].get('VoteCard')))
        quemj = jogador(p.get('Defined', ''), ctx, vt)

        # ================= RAMP =================
        if api in ('Mana', 'ManaReflected'):
            am = inteiro(p.get('Amount'), sv)
            prod = p.get('Produced', '')
            if prod and ' ' in prod and not prod.startswith('Combo'):
                am = max(am, len(prod.split()))
            d = dict(base, g=am)
            dado = ctx.get('dado', '')
            if ctx['k'] == 'spell':
                d['tipo'] = 'ritual'
            elif ctx['k'] == 'act':
                c = ctx.get('cost', '')
                if re.search(r'Sac<1/(CARDNAME|NICKNAME)[>/]', c):
                    d['tipo'] = 'sacrifica'
                elif re.search(r'Sac<|Exert|tapXType|SubCounter|RemoveCounter|Discard<|PayEnergy|CollectEvidence', c):
                    d['tipo'] = 'pede'
                elif dado and re.search(r'Enchanted|Land', dado) and not re.search('Creature', dado):
                    d['tipo'] = 'fixa'  # Abundant Growth: o terreno só troca de cor
                else:
                    d['tipo'] = 'dork' if (cri and not dado) or 'Creature' in dado else 'pedra'
            elif ctx.get('mode') in ('TapsForMana', 'ManaAdded') or ctx.get('mode', '').startswith('R:'):
                d['tipo'] = 'extra'
            else:
                d['tipo'] = 'gatilho'
            if p.get('RestrictValid'): d['so'] = p['RestrictValid']
            if prod and set(prod.split()) == {'C'}: d['cor'] = 'C'
            elif re.search(r'Any|Combo|Chosen', prod) or api == 'ManaReflected': d['cor'] = 'qualquer'
            if d['tipo'] != 'fixa' or am >= 2:
                add('ramp', d)
        elif api == 'ChangeZone' and p.get('Destination') == 'Battlefield' and re.search(TERRA, p.get('ChangeType', '')) \
                and re.search(r'Library|Hand|Graveyard', p.get('Origin', '')) and not eh_dele(p.get('DefinedPlayer', '') + p.get('Chooser', '')):
            add('ramp', dict(base, tipo='terreno', g=inteiro(p.get('ChangeNum'), sv, 1), tap=1 if p.get('Tapped') else 0,
                             de={'Library': 'grimorio', 'Hand': 'mao', 'Graveyard': 'cemiterio'}.get(p.get('Origin').split(',')[0], 'grimorio'),
                             **({'todos': 1} if p.get('DefinedPlayer') in ('Player', 'Each') else {})))
        elif api == 'ChangeZone' and p.get('Destination') == 'Battlefield' and re.search(r'IsRemembered|Remembered|ChosenCard', p.get('ChangeType', '') + p.get('Defined', '')) \
                and any(x['api'] == 'ChangeZone' and re.search(TERRA, x['p'].get('ChangeType', '')) and x['ctx'] is ctx for x in efs) and not eh_dele(p.get('DefinedPlayer', '')):
            add('ramp', dict(base, tipo='terreno', g=inteiro(p.get('ChangeNum'), sv, 1), tap=1 if p.get('Tapped') else 0, de='grimorio'))
        elif api in ('Dig', 'DigUntil') and p.get('DestinationZone', p.get('FoundDestination', '')) == 'Battlefield' and re.search(TERRA, p.get('ChangeValid', '') + p.get('Valid', '')) and jogador(p.get('Defined', ''), ctx) == 'eu':
            add('ramp', dict(base, tipo='terreno', g=inteiro(p.get('ChangeNum'), sv, 1), de='topo'))
        elif api == 'Token' and any(FICHAS.get(t.strip()) for t in p.get('TokenScript', '').split(',')) and not eh_dele(p.get('TokenOwner', '')):
            tf = next(FICHAS[t.strip()] for t in p['TokenScript'].split(',') if FICHAS.get(t.strip()))
            d = dict(base, tipo='pedrinha' if 'powerstone' in p['TokenScript'] else tf, g=inteiro(p.get('TokenAmount'), sv))
            if p.get('TokenOwner', 'You') in ('Player', 'Each'): d['todos'] = 1
            add('ramp', d)
        elif api == 'S:ReduceCost' and p.get('Activator', 'You') == 'You' and p.get('Type', 'Spell') in ('Spell', '') and not p.get('Affected') \
                and not re.search(r'Self|CARDNAME', p.get('ValidCard', '')) and not p.get('ValidSpell', '').startswith('Activated'):
            add('ramp', dict(base, tipo='reduz', g=inteiro(p.get('Amount'), sv, 1), vale=p.get('ValidCard', 'Card')))
        elif api.startswith('S:') and p.get('AdjustLandPlays'):
            add('ramp', dict(base, tipo='terra-extra', g=inteiro(p.get('AdjustLandPlays'), sv, 1)))
        elif api == 'ChangeZoneAll' and p.get('Destination') == 'Battlefield' and re.search(TERRA, p.get('ChangeType', '')) and eh_meu(p.get('ChangeType', '')):
            add('ramp', dict(base, tipo='terreno', g=3, tap=1 if p.get('Tapped') else 0, de=p.get('Origin', '').lower()[:9] == 'graveyard' and 'cemiterio' or 'grimorio'))
        elif api in ('Untap', 'UntapAll') and re.search(TERRA, vt or p.get('ValidCards', '')) and not eh_dele(vt or p.get('ValidCards', '')):
            add('ramp', dict(base, tipo='desvira', g=inteiro(p.get('TargetMax') or p.get('Amount'), sv, 1) if api == 'Untap' else 3))
        elif api == 'ReplaceMana' and p.get('ReplaceAmount') and any(x['api'] == 'R:ProduceMana' and x['p'].get('ValidActivator') == 'You' for x in efs):
            # só quem multiplica a SUA mana (Mana Reflection, Nyxbloom); trocar a cor (Contamination, Damping Sphere) não é ramp
            add('ramp', dict(base, tipo='multiplica', g=inteiro(p.get('ReplaceAmount'), sv, 2), rep='sempre'))

        # ================= COMPRA =================
        mc = re.search(r'Draw<(\d+)/You>', p.get('Cost', ''))
        if mc and api != 'Draw':
            add('draw', dict(base, tipo='compra', n=int(mc.group(1))))
        if api == 'Draw':
            qj = jogador(p.get('Defined', ''), ctx, vt)
            if qj in ('eu', 'alvo', 'todos'):
                d = dict(base, tipo='compra', n=inteiro(p.get('NumCards'), sv, 3))
                if qj == 'todos': d['todos'] = 1
                if any(x['api'] == 'Discard' and x['ctx'] is ctx and jogador(x['p'].get('Defined', ''), ctx, x['p'].get('ValidTgts', '')) in ('eu', 'alvo') and x['p'].get('Mode', '') != 'Hand' for x in efs):
                    d['loot'] = 1
                if p.get('UnlessCost'): d['paga'] = 1
                if ctx['k'] == 'act': d['custo'] = ctx.get('cost', '')
                add('draw', d)
        elif api in ('Dig', 'DigMultiple', 'DigUntil') and p.get('DestinationZone', p.get('FoundDestination', 'Hand')) in ('Hand', 'Battlefield') \
                and jogador(p.get('Defined', ''), ctx) == 'eu' and not (api == 'DigUntil' and not p.get('FoundDestination')) \
                and not (p.get('DestinationZone', p.get('FoundDestination')) == 'Battlefield' and p.get('DestinationZone2') != 'Hand' and re.search(TERRA, p.get('ChangeValid', '') + p.get('Valid', '')) and not re.search(r'Creature|Permanent|Card(?!\.)', p.get('ChangeValid', '') + p.get('Valid', ''))):
            add('draw', dict(base, tipo='cava', n=inteiro(p.get('ChangeNum'), sv, 1) if p.get('ChangeNum') != 'All' else inteiro(p.get('DigNum'), sv, 2),
                             olha=inteiro(p.get('DigNum'), sv, 3), filtro=p.get('ChangeValid', '')))
        elif api in ('Dig', 'ChangeZone') and (p.get('DestinationZone') or p.get('Destination')) == 'Exile' and (p.get('Origin', 'Library') == 'Library') \
                and jogador(p.get('Defined', ''), ctx) in ('eu', 'opo', 'todos', 'alvo') \
                and (api == 'Dig' or re.search(r'TopOfLibrary', p.get('Defined', '')) or p.get('Defined', '') == '') and not p.get('ChangeType') \
                and depois(e, pode_jogar):
            dj = jogador(p.get('Defined', ''), ctx)
            add('draw', dict(base, tipo='impulso', n=inteiro(p.get('DigNum') or p.get('ChangeNum'), sv, 1), **({'deles': 1} if dj != 'eu' else {})))
        elif api == 'S:Continuous' and p.get('MayPlay') and re.search(r'TopLibrary|TopOfLibrary', p.get('Affected', '')) and not eh_dele(p.get('Affected', '')):
            add('draw', dict(base, tipo='topo', rep='sempre', filtro=p.get('Affected', '')))
        elif api == 'ChangeZone' and p.get('Origin') == 'Library' and p.get('Destination') == 'Hand' and not p.get('ChangeType') \
                and re.match(r'TopOfLibrary|Remembered|ChosenCard|ChosenPile', p.get('Defined', 'x')) and not p.get('ValidTgts') \
                and (p.get('Defined') == 'TopOfLibrary' or any(x['api'] in ('PeekAndReveal', 'TwoPiles', 'Dig', 'RearrangeTopOfLibrary') and x['ctx'] is ctx for x in efs)):
            add('draw', dict(base, tipo='topo', n=inteiro(p.get('ChangeNum'), sv, 1)))
        elif api in ('BecomeMonarch', 'TakeInitiative'):
            add('draw', dict(base, tipo='monarca' if api == 'BecomeMonarch' else 'iniciativa', n=1, rep='fase'))
        elif api in ('Discover', 'Hideaway'):
            add('draw', dict(base, tipo='descobre', n=1))
        elif api == 'Investigate':
            add('draw', dict(base, tipo='pista', n=inteiro(p.get('Num'), sv, 1)))
        elif api == 'Connive':
            add('draw', dict(base, tipo='conive', n=1, loot=1))
        elif api == 'ChangeZone' and 'Graveyard' in p.get('Origin', '') and p.get('Destination') == 'Hand' and not (ctx.get('zone') == 'Graveyard' and not vt) \
                and not re.match(r'Self|TriggeredNewCardLKICopy|TriggeredCard|Parent|CorrectedSelf', p.get('Defined', '')) \
                and not re.search(r'Card\.Self|CARDNAME', vt + p.get('ChangeType', '')):
            add('draw', dict(base, tipo='recursao', n=inteiro(p.get('TargetMax') or p.get('ChangeNum'), sv, 1), filtro=vt or p.get('ChangeType', '')))

        # ================= REMOÇÃO PONTUAL =================
        alvo_dele = vt and not eh_meu(vt)
        volta = depois(e, lambda x: x['api'] == 'ChangeZone' and x['p'].get('Destination') == 'Battlefield' and re.match(r'Targeted|Remembered|DelayTriggerRemembered|Parent', x['p'].get('Defined', '')) and not re.search('Library|Hand', x['p'].get('Origin', '')))
        if api in ('Destroy', 'ChangeZone') and alvo_dele and (api == 'Destroy' or (re.search('Battlefield', p.get('Origin', '')) and p.get('Destination') in ('Exile', 'Hand', 'Library', 'Graveyard'))):
            if api == 'ChangeZone' and p.get('Destination') == 'Exile' and volta:
                pass  # some e volta (Flickerwisp, blink): não é remoção
            else:
                modo = 'destroi' if api == 'Destroy' else {'Exile': 'exila', 'Hand': 'mao', 'Library': 'grimorio', 'Graveyard': 'destroi'}[p['Destination']]
                d = dict(base, modo=modo, alc=alcance(vt), restr=restrito(vt), n=inteiro(p.get('TargetMax'), sv, 2))
                # o dono/controlador do alvo ganha algo em troca (Beast Within: ficha 3/3; Chaos Warp: permanente do topo)
                if depois(e, lambda x: (x['api'] == 'Token' and re.match(r'Targeted(Controller|Owner)', x['p'].get('TokenOwner', '')))
                          or (x['api'] in ('Dig', 'DigUntil', 'ChangeZone') and re.match(r'Targeted(Controller|Owner)', x['p'].get('Defined', '') + x['p'].get('DefinedPlayer', ''))
                              and 'Battlefield' in x['p'].get('DestinationZone', '') + x['p'].get('FoundDestination', '') + x['p'].get('Destination', ''))):
                    d['compensa'] = 1
                add('removal', d)
        elif api == 'DealDamage' and alvo_dele and alcance(vt) not in ('jogador', ''):
            add('removal', dict(base, modo='dano', alc=alcance(vt), dano=inteiro(p.get('NumDmg'), sv, 4), restr=restrito(vt)))
        elif api == 'Pump' and alvo_dele and re.match(r'-', p.get('NumDef', '')):
            add('removal', dict(base, modo='menos', alc=alcance(vt), dano=inteiro(p['NumDef'][1:], sv, 3), restr=restrito(vt)))
        elif api == 'PutCounter' and alvo_dele and p.get('CounterType') == 'M1M1':
            add('removal', dict(base, modo='menos', alc=alcance(vt), dano=inteiro(p.get('CounterNum'), sv, 2), restr=restrito(vt)))
        elif api == 'Fight' and (alvo_dele or eh_dele(p.get('Defined', ''))):
            add('removal', dict(base, modo='luta', alc='criatura', restr=restrito(vt)))
        elif api == 'Sacrifice' and quemj in ('opo', 'alvo', 'todos') and not re.search(r'Self|CARDNAME|Remembered', p.get('SacValid', '')):
            add('removal', dict(base, modo='edito', alc=alcance(p.get('SacValid', 'Creature')), todos=1 if quemj == 'todos' else 0, n=inteiro(p.get('Amount'), sv, 1)))
        elif api == 'SacrificeAll' and re.search(r'IsRemembered|Remembered', p.get('ValidCards', '')) and any(x['api'] in ('ChooseCard', 'RepeatEach') and x['ctx'] is ctx for x in efs):
            add('removal', dict(base, modo='edito', alc='criatura', todos=0, n=1))  # Crackling Doom: cada oponente sacrifica a escolhida
        elif api == 'GainControl' and alvo_dele and not p.get('LoseControl') and not re.search(r'EOT|UntilEndOfTurn', p.get('Duration', '')) and not p.get('Untap'):
            add('removal', dict(base, modo='rouba', alc=alcance(vt), restr=restrito(vt)))
        elif api == 'Animate' and alvo_dele and (p.get('RemoveAllAbilities') or p.get('RemoveCardTypes')) and p.get('Duration', '') in ('Permanent', '', 'UntilHostLeavesPlay', 'UntilLoseControlOfHost', 'AsLongAsInPlay'):
            add('removal', dict(base, modo='neutraliza', alc=alcance(vt), restr=restrito(vt)))
        elif api == 'ExchangeControl' and vt and eh_dele(vt):
            add('removal', dict(base, modo='rouba', alc=alcance(vt), restr=restrito(vt)))
        elif api == 'S:Continuous' and aura and (curse or p.get('RemoveAllAbilities') or p.get('RemoveCardTypes')) and re.search(r'Enchanted', p.get('AffectedDefined', '') + p.get('Affected', '')) \
                and (p.get('RemoveAllAbilities') or p.get('RemoveCardTypes') or p.get('SetPower') == '0' or re.search(r'CARDNAME can.t (attack|block)', p.get('AddHiddenKeyword', ''))):
            add('removal', dict(base, modo='neutraliza', alc=alcance(next((k.split(':')[1] for k in kws if k.startswith('Enchant:')), 'Creature')), restr=''))
        elif re.match(r'S:Cant(Attack|Block|BeActivated)', api) and aura and curse and re.search(r'EnchantedBy|Enchanted', p.get('ValidCard', '') + p.get('ValidAttacker', '') + p.get('Affected', '')) \
                and not any('neutraliza' == d.get('modo') for d in out.get('removal', [])):
            if not re.search('CantBlock', api) and not any(re.search('CantBlock', x['api']) for x in efs) and 'CantBeActivated' not in api:
                pass  # só não ataca: meia remoção — fica de fora
            else:
                add('removal', dict(base, modo='neutraliza', alc='criatura', restr=''))

        # ================= LIMPA-MESA =================
        vc = p.get('ValidCards', '') or p.get('ChangeType', '') or ''
        if api in ('DestroyAll', 'DamageAll', 'SacrificeAll', 'PutCounterAll', 'PumpAll') or (api == 'ChangeZoneAll' and p.get('Origin', '') == 'Battlefield' and p.get('Destination') in ('Exile', 'Hand', 'Library', 'Graveyard')):
            neg = (api == 'PumpAll' and re.match('-', p.get('NumDef', ''))) or (api == 'PutCounterAll' and p.get('CounterType') == 'M1M1')
            if api in ('PumpAll', 'PutCounterAll') and not neg:
                pass
            elif not vc:
                pass  # sem ValidCards (Animate Dead: Defined$ o que ela trouxe)
            elif re.search(r'TargetedCard', vc):
                vt0 = ','.join(x['p'].get('ValidTgts', '') for x in efs[:efs.index(e)] if x['ctx'] is ctx and x['p'].get('ValidTgts'))
                if vt0 and not eh_meu(vt0):
                    add('removal', dict(base, modo='destroi', alc=alcance(vt0), restr=restrito(vt0), n=1))
            elif all(re.match(r'(Card\.|Creature\.|Permanent\.)?(Self|IsRemembered|Remembered\w*|Enchanted\w*|Equipped\w*|Targeted\w*|ChosenCard|Defined\w*|DelayTriggerRemembered\w*|TriggeredCard\w*)$', x) for x in vc.split(',')):
                pass  # só o que foi definido antes (Animate Dead): não é limpa-mesa
            elif eh_meu(vc) and not eh_dele(vc):
                pass
            elif api == 'DamageAll' and not vc and not p.get('ValidCards'):
                pass  # só jogadores
            else:
                d = dict(base, modo=api, alc=alcance(vc) or 'criatura', lado=1 if eh_dele(vc + p.get('ValidPlayers', '') + p.get('Defined', '')) else 0,
                         poupa=1 if re.search(r'\.non(?!Land|Token)\w+|!Remembered|ChosenType|IsNotRemembered|notSharesCreatureTypeWith|nonChosen|\.Other', vc) else 0,
                         restr=restrito(vc))
                if api == 'DamageAll': d['dano'] = inteiro(p.get('NumDmg'), sv, 4)
                if api == 'PumpAll': d['dano'] = inteiro(p['NumDef'][1:], sv, 3)
                if api == 'PutCounterAll': d['dano'] = inteiro(p.get('CounterNum'), sv, 2)
                add('wipe', d)
        elif api == 'S:Continuous' and re.match(r'-', p.get('AddToughness', '')) and re.search(r'^Creature', p.get('Affected', '')) and not re.search(r'Enchanted|Equipped|Self|Attached', p.get('Affected', '') + p.get('AffectedDefined', '')):
            add('wipe', dict(base, modo='estatico', alc='criatura', lado=1 if eh_dele(p['Affected']) else 0, poupa=0, restr=restrito(p['Affected']), dano=inteiro(p['AddToughness'][1:], sv, 1)))
        elif api == 'Sacrifice' and quemj == 'todos' and inteiro(p.get('Amount'), sv, 1) >= 2:
            add('wipe', dict(base, modo='sacrificio', alc=alcance(p.get('SacValid', 'Creature')), lado=0, poupa=0, restr=''))

        # ================= CONTRAMÁGICA =================
        if api == 'Counter':
            tt = p.get('TargetType', 'Spell'); vtg = p.get('ValidTgts', 'Card')
            add('counter', dict(base, alvo=('qualquer' if vtg in ('Card', 'Card,Emblem', '') else vtg) if tt == 'Spell' else tt, paga=1 if p.get('UnlessCost') else 0))
        elif api == 'ChangeZone' and 'Stack' in p.get('Origin', '') and ('Stack' in p.get('TgtZone', '') or 'Card.inZoneStack' in vt) and p.get('Destination') != 'Battlefield':
            add('counter', dict(base, alvo='qualquer', paga=0, volta=1))

        # ================= PROTEÇÃO =================
        kw = ' '.join(p.get(k, '') for k in ('KW', 'AddKeyword', 'AddHiddenKeyword', 'Keywords'))
        quem = vt or p.get('ValidCards', '') or (p.get('AffectedDefined', '') + ' ' + p.get('Affected', '')).strip() or p.get('Defined', '') or ctx.get('dado', '')
        anexo = bool(re.search(r'Equipped|Enchanted|AttachedBy|EquippedBy|EnchantedBy', quem))
        if re.search(KWP + '|Undying|Persist', kw) and api in ('Pump', 'PumpAll', 'S:Continuous', 'Animate', 'AnimateAll') and not eh_dele(quem) and not (anexo and curse):
            todos = api in ('PumpAll', 'AnimateAll') or (api == 'S:Continuous' and re.search(r'YouCtrl', quem) and not re.search(r'Self|Card\.Self', quem) and not anexo)
            q = 'anexo' if anexo else 'si' if (re.search(r'^(Self|Card\.Self|CARDNAME)$', quem) or (api == 'S:Continuous' and re.search(r'Card\.Self|^Self', quem))) else 'todos' if todos else 'alvo'
            d = dict(base, kw=sorted(set(re.findall(KWP + '|Undying|Persist', kw))), todos=1 if todos else 0, quem=q)
            if api == 'S:Continuous' and not ctx.get('tmp'): d['rep'] = 'sempre'
            if q == 'si': out['_si'] = 1  # protege só a si mesma (Yahenni, Paradise Druid): não ocupa a vaga de proteção
            else: add('protect', d)
        elif api in ('Protection', 'ProtectionAll') and not eh_dele(vt or p.get('ValidCards', '')):
            add('protect', dict(base, kw=['Protection'], todos=1 if api == 'ProtectionAll' else 0, quem='alvo'))
        elif api == 'Phases' and vt and not eh_meu(vt) and (p.get('WontPhaseInNormal') or eh_dele(vt)):  # alvo livre (Galadriel's Dismissal) = proteção
            add('removal', dict(base, modo='some', alc=alcance(vt), restr=restrito(vt)))
        elif api in ('Phases', 'PhasesAll') and not eh_dele(quem) and not p.get('PhaseInOrOut') and not (p.get('IsCurse') and eh_dele(vt)) and not p.get('WontPhaseInNormal') and quem not in ('Remembered', 'Self'):
            add('protect', dict(base, kw=['Phasing'], todos=1 if api == 'PhasesAll' or p.get('Defined', '').startswith('Valid ') else 0, quem='alvo'))
        elif api in ('Regenerate', 'RegenerateAll') and not eh_dele(quem):
            if p.get('Defined', '') in ('Self', '') and not vt and api == 'Regenerate': out['_si'] = 1
            else: add('protect', dict(base, kw=['Regenerate'], todos=1 if api == 'RegenerateAll' or p.get('Defined', '').startswith('Valid ') else 0, quem='alvo'))
        elif api == 'ChangeZone' and vt and eh_meu(vt) and re.search('Battlefield', p.get('Origin', '')) and p.get('Destination') == 'Exile' and volta and (inst or ctx['k'] == 'act'):
            add('protect', dict(base, kw=['blink'], todos=0, quem='alvo'))
        elif api == 'ChangeTargets':
            add('protect', dict(base, kw=['desvia'], todos=0, quem='magica'))
        elif api == 'ChangeZone' and p.get('Destination') == 'Battlefield' and re.match(r'TriggeredNewCardLKICopy|TriggeredCard', p.get('Defined', '')) \
                and ctx.get('mode') == 'ChangesZone' and not ctx.get('self') \
                and (re.search(r'AttachedBy|EnchantedBy|EquippedBy|YouCtrl', ctx.get('vc', '')) or ctx.get('tmp')):
            an = bool(re.search(r'AttachedBy|EnchantedBy|EquippedBy', ctx.get('vc', '')))
            add('protect', dict(base, kw=['volta'], todos=0 if an or ctx.get('tmp') else 1, quem='anexo' if an else 'alvo'))

    # ---- depois de ler tudo
    for d in out.get('ramp', []):
        if d.get('tipo') == 'terreno' and any(x['api'] == 'ChangeZone' and x['p'].get('Origin') == 'Library' and x['p'].get('Destination') == 'Hand' and re.search(TERRA, x['p'].get('ChangeType', '')) for x in efs):
            d['mao'] = 1
    ov = next((k.split(':', 1)[1] for k in kws if k.startswith('Overload')), None)
    if ov and out.get('removal'):
        r0 = out['removal'][0]
        add('wipe', {'modo': 'sobrecarga', 'alc': r0['alc'], 'lado': 1 if any(eh_dele(x['p'].get('ValidTgts', '')) for x in efs) else 0, 'poupa': 0, 'restr': r0.get('restr', ''), 'custo': ov})
    if any(k.split(':')[0] in ('Umbra armor', 'Totem armor') for k in kws):
        add('protect', {'kw': ['volta'], 'todos': 0, 'quem': 'anexo', 'rep': 'sempre'})
    k1 = {k.split(':')[0] for k in kws}
    if 'Annihilator' in k1:
        add('removal', {'modo': 'edito', 'alc': 'permanente', 'todos': 0, 'n': inteiro(next(k.split(':')[1] for k in kws if k.startswith('Annihilator')), sv, 2), 'rep': 'gatilho', 'cond': 'Attacks'})
    if 'Cascade' in k1:
        add('draw', {'tipo': 'cascata', 'n': sum(1 for k in kws if k.split(':')[0] == 'Cascade')})
    if k1 & {'Cycling', 'TypeCycling', 'Landcycling', 'Basic landcycling'} or any(re.match(r'\w*[Cc]ycling', k) for k in k1):
        add('draw', {'tipo': 'ciclo', 'n': 1})
    out['_kw'] = sorted(k1 & {'Hexproof', 'Shroud', 'Indestructible', 'Ward', 'Flash', 'Storm', 'Cycling', 'Equip', 'Kicker', 'Multikicker', 'Overload', 'Suspend', 'Cascade', 'Flying', 'Trample', 'Haste', 'Partner'})
    if any('AlternativeCost' in s and re.search(r'ValidSA\$ Spell\.Self|ValidCard\$ Card\.Self', s) for s in f['S']):
        out['_gratis'] = 1
    return out


def funcoes(faces, nome=None):
    """junta as faces: a da frente sempre; as outras se não forem terreno (verso de MDFC terreno é terreno, não ramp)"""
    out = {}
    for i, f in enumerate(faces):
        if i and re.search(r'\bLand\b', f.get('Types', '')):
            continue
        modo = faces[0].get('AlternateMode', '')
        tras = i > 0 and modo in ('DoubleFaced', 'Flip', 'Meld')
        alt = i > 0 and modo in ('Split', 'Adventure', 'Modal', 'Omen', 'Prepare')
        if i == 0 and modo in ('Split',) and len(faces) > 1:
            alt = True  # as duas metades de uma carta dividida são escolha
        fx = funcoes_face(f, tras, alt)
        for k, v in fx.items():
            if k == '_kw':
                out[k] = sorted(set(out.get(k, [])) | set(v))
            elif k.startswith('_'):
                out[k] = 1
            else:
                out.setdefault(k, []).extend(v)
    if not out.get('_kw'):
        out.pop('_kw', None)
    return out


def main():
    le_fichas()
    s = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
    db = json.loads(s[s.index('{'):s.rindex('}') + 1])
    nomes = set(db['cards'])
    porFrente = {}
    for n in nomes:
        porFrente.setdefault(n.split(' // ')[0], n)
    out, achou, tipos = {}, set(), Counter()
    for raiz, _, arqs in os.walk(PASTA):
        for a in sorted(arqs):
            if not a.endswith('.txt'):
                continue
            faces = le_arquivo(os.path.join(raiz, a))
            if not faces or 'Name' not in faces[0]:
                continue
            alvo = porFrente.get(faces[0]['Name'])
            if not alvo:
                continue
            fx = funcoes(faces, alvo)
            achou.add(alvo)
            if fx:
                out[alvo] = fx
                for k in fx: tipos[k] += 1
    print(f'cards-db: {len(nomes)}  achadas no Forge: {len(achou)} ({100*len(achou)/len(nomes):.1f}%)  com dado: {len(out)}')
    print('por função:', dict(tipos))
    faltam = sorted(nomes - achou)
    out['_falta'] = faltam
    open(os.path.join(AQUI, 'faltam.txt'), 'w').write('\n'.join(faltam))
    js = 'window.FORGE_FX=' + json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n'
    open(os.path.join(RAIZ, 'forge-db.js'), 'w', encoding='utf-8').write(
        '// Funções de cada carta lidas dos roteiros do Forge (GPL-3.0, github.com/Card-Forge/forge). Gerado por ferramentas/forge/converte.py\n' + js)
    print('forge-db.js:', len(js) // 1024, 'KB')


if __name__ == '__main__':
    main()
