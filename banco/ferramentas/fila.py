#!/usr/bin/env python3
"""Fila de cartas a escrever: cartas do banco de 30 decks por frequência (em quantos decks aparece).
uso: python3 banco/ferramentas/fila.py [N=50] [--todas]   (--todas inclui as já escritas)
     python3 banco/ferramentas/fila.py --deck lista.txt   (ou `--deck -` lendo a lista colada da entrada)
Saída: posição, nº de decks, nome, (já escrita?).
Com --deck: as cartas da lista que faltam no banco, o comandante (1ª carta, ou a seção Commander) primeiro e
depois por frequência no banco de 30; no fim "N de M cartas no banco"."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oraculo

BASICOS = {'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'}

def nome_da_linha(l):
    """'1x Sol Ring (C21) 263' / 'Sol Ring' → 'Sol Ring' (None se a linha não é carta)"""
    l = l.strip()
    if not l or l.startswith(('#', '//')) or l.endswith(':') or l.lower() in ('commander', 'deck', 'sideboard', 'maybeboard'): return None
    m = re.match(r'(\d+)x?\s+(.+)$', l)
    nome = m.group(2) if m else l
    return re.sub(r'\s*\([A-Z0-9]+\).*$', '', nome).replace(' *F*', '').strip() or None

def do_deck(texto):
    """cartas da lista fora do banco: [(nome, nº de decks do banco de 30, comandante?)] + totais"""
    feitas = oraculo.nossas(); freq = dict(fila()); vistos, faltam, total = set(), [], 0
    linhas = texto.splitlines(); cmd_sec = False; primeiro = True
    for l in linhas:
        if l.strip().lower().startswith('commander'): cmd_sec = True; continue
        if l.strip().lower() in ('deck', 'mainboard') or (cmd_sec and not l.strip()): cmd_sec = False
        nm = nome_da_linha(l)
        if not nm: continue
        c = oraculo.acha(nm); nm = c['name'] if c else nm
        eh_cmd = cmd_sec or primeiro; primeiro = False
        if nm in BASICOS or nm in vistos: continue
        vistos.add(nm); total += 1
        if nm not in feitas: faltam.append((nm, freq.get(nm, 0), eh_cmd, bool(c)))
    faltam.sort(key=lambda x: (not x[2], -x[1], x[0]))
    return faltam, total

def fila():
    banco = json.load(open(os.path.join(oraculo.RAIZ, 'ferramentas', 'calibra', 'banco.json')))
    freq = {}
    for deck in banco.values():
        vistos = set()
        for l in deck['lista'].splitlines():
            m = re.match(r'\s*(\d+)x?\s+(.+?)\s*$', l)
            if not m: continue
            nome = re.sub(r'\s*\([A-Z0-9]+\).*$', '', m.group(2))  # tira "(SET) 123"
            c = oraculo.acha(nome)
            nome = c['name'] if c else nome
            if nome in BASICOS or nome in vistos: continue
            vistos.add(nome); freq[nome] = freq.get(nome, 0) + 1
    return sorted(freq.items(), key=lambda x: (-x[1], x[0]))

if __name__ == '__main__':
    if '--deck' in sys.argv:
        arq = sys.argv[sys.argv.index('--deck') + 1] if len(sys.argv) > sys.argv.index('--deck') + 1 else '-'
        faltam, total = do_deck(sys.stdin.read() if arq == '-' else open(arq).read())
        for i, (nome, k, cmd, ok) in enumerate(faltam, 1):
            print(f'{i:4} {k:3}  {nome}' + ('  (comandante)' if cmd else '') + ('' if ok else '  (sem Oracle)'))
        print(f'-- {total - len(faltam)} de {total} cartas no banco; faltam {len(faltam)}', file=sys.stderr)
        sys.exit(0)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = int(args[0]) if args else 50
    feitas = oraculo.nossas()
    toda = fila()
    sem = [x for x in toda if not oraculo.acha(x[0])]
    lista = toda if '--todas' in sys.argv else [x for x in toda if x[0] not in feitas]
    for i, (nome, k) in enumerate(lista[:n], 1):
        print(f'{i:4} {k:3}  {nome}' + ('  (escrita)' if nome in feitas else ''))
    print(f'-- {len(toda)} cartas no banco de 30, {len(set(feitas.values()))} escritas, {sum(1 for x in toda if x[1]>=3)} em 3+ decks'
          + (f', {len(sem)} sem Oracle: ' + ', '.join(x[0] for x in sem[:10]) if sem else ''), file=sys.stderr)
