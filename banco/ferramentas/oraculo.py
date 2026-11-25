"""Acesso ao bulk oracle-cards do Scryfall (cache fora do git em ~/.cache/raiox/scryfall/).
Só dados públicos do Oracle: nome, custo, tipos, texto. Nada do Forge."""
import gzip, json, os, re, hashlib, glob

CACHE = os.path.expanduser('~/.cache/raiox/scryfall')
AQUI = os.path.dirname(os.path.abspath(__file__))
BANCO = os.path.dirname(AQUI)
RAIZ = os.path.dirname(BANCO)
_idx = None

def arquivo_bulk():
    arqs = sorted(glob.glob(os.path.join(CACHE, 'oracle-cards*.json*')))
    if not arqs:
        raise SystemExit('sem bulk: baixe oracle-cards em ' + CACHE)
    return arqs[-1]

def carrega():
    """dicionário nome (minúsculo) → carta do Scryfall; dupla face entra pelo nome cheio e pela frente."""
    global _idx
    if _idx is not None: return _idx
    a = arquivo_bulk(); op = gzip.open if a.endswith('.gz') else open
    _idx = {}
    with op(a, 'rt', encoding='utf-8') as f:
        linhas = f if a.endswith(('.jsonl', '.jsonl.gz')) else json.load(f)
        for l in linhas:
            c = json.loads(l) if isinstance(l, str) else l
            if c.get('layout') in ('token', 'double_faced_token', 'art_series', 'emblem'): continue
            nomes = [c['name']] + [x['name'] for x in c.get('card_faces', [])[:1]]
            for nm in nomes:
                _idx.setdefault(nm.lower(), c)
    return _idx

def acha(nome):
    i = carrega(); n = nome.strip().lower()
    return i.get(n) or i.get(n.split(' // ')[0])

def texto(c):
    """texto Oracle usado no hash: dupla face/split = faces juntas com \\n//\\n"""
    if c.get('card_faces'):
        return '\n//\n'.join(x.get('oracle_text', '') for x in c['card_faces'])
    return c.get('oracle_text', '')

def hash8(c):
    return hashlib.sha1(texto(c).encode('utf-8')).hexdigest()[:8]

def arquivo_de(nome):
    s = nome.split(' // ')[0].lower()
    s = re.sub(r"[’']", '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return os.path.join(BANCO, 'cartas', s + '.json')

def nossas():
    """nome → caminho das cartas já escritas"""
    out = {}
    for a in glob.glob(os.path.join(BANCO, 'cartas', '*.json')):
        try: c = json.load(open(a))
        except Exception: continue
        out[c['n']] = a
        if c.get('faces'):  # carta de duas faces: a fila usa o nome do Scryfall "A // B"
            out[' // '.join([c['n']] + [f['n'] for f in c['faces']])] = a
    return out

TIPOS = ['Kindred', 'Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Instant', 'Sorcery', 'Battle']
SUPERS = ['Legendary', 'Basic', 'Snow', 'World']

def mana(s):
    """'{2}{W}{U/P}{X}' → {"g":2,"p":["W","U/P"],"x":1} (formato do esquema)"""
    out = {}
    for sim in re.findall(r'\{([^}]+)\}', s or ''):
        if sim.isdigit(): out['g'] = out.get('g', 0) + int(sim)
        elif sim == 'X': out['x'] = out.get('x', 0) + 1
        else: out.setdefault('p', []).append(sim)
    return out

def linha_tipo(t):
    esq, _, dir_ = t.partition(' — ')
    pal = esq.split()
    return ([x for x in TIPOS if x in pal], [x for x in SUPERS if x in pal], dir_.split())

def _pt(v):
    try: return int(v)
    except (TypeError, ValueError): return v

def cabecalho(c, face=None):
    """campos de identidade copiados do Oracle (não do Forge)"""
    f = face or c
    tipos, sup, sub = linha_tipo(f.get('type_line', ''))
    out = {'n': f['name']}
    m = mana(f.get('mana_cost', ''))
    if m: out['custo'] = m
    if face is None:
        out['vm'] = int(c.get('cmc', 0)); out['ci'] = ''.join(x for x in 'WUBRG' if x in c.get('color_identity', []))
    cores = f.get('colors', c.get('colors', []))
    out['cores'] = ''.join(x for x in 'WUBRG' if x in cores)
    out['tipos'] = tipos
    if sup: out['super'] = sup
    if sub: out['sub'] = sub
    if 'power' in f: out['pt'] = [_pt(f['power']), _pt(f['toughness'])]
    if 'loyalty' in f: out['leal'] = _pt(f['loyalty'])
    return out

def esqueleto(c, por='adepto-b', em=None):
    import datetime
    faces = c.get('card_faces')
    duas = faces and c.get('layout') not in ('flip',)
    base = cabecalho(c, faces[0] if duas else None)
    if duas:
        base['vm'] = int(c.get('cmc', 0)); base['ci'] = ''.join(x for x in 'WUBRG' if x in c.get('color_identity', []))
    out = {'v': 2, 'n': base.pop('n'), 'id': c['oracle_id'], 'oracleHash': hash8(c)}
    out.update(base)
    if duas:
        out['forma'] = {'transform': 'duplaFace', 'modal_dfc': 'modal', 'adventure': 'aventura', 'split': 'split'}.get(c['layout'], 'duplaFace')
        out['faces'] = [cabecalho(c, f) for f in faces[1:]]
    out['rev'] = {'por': por, 'em': em or datetime.date.today().isoformat()}
    return out
