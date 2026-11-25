#!/usr/bin/env python3
"""Confere o nosso JSON com o cartas-rx.js (conversão do Forge) — SÓ PARA CONFERIR, nunca copiar.
Cada divergência: reler o Oracle e decidir; quem manda é o Oracle.
uso: python3 banco/ferramentas/compara.py [nome ou arquivo…]   (sem argumento: todas as nossas)
     --rx CAMINHO  (padrão: cartas-rx.js na raiz do repositório principal)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oraculo

IGNORA = {'v', 'id', 'oracleHash', 'rev', 'forge', 'n', '_'}

def acha_rx(args):
    if '--rx' in args:
        i = args.index('--rx'); p = args[i + 1]; del args[i:i + 2]; return p
    for base in (oraculo.RAIZ, os.path.expanduser('~/raio-x-deck')):
        p = os.path.join(base, 'cartas-rx.js')
        if os.path.exists(p): return p
    raise SystemExit('cartas-rx.js não encontrado (use --rx)')

def carrega_rx(p):
    s = open(p, encoding='utf-8').read()
    return json.loads(s[s.index('{'):].rstrip().rstrip(';'))

PADRAO = {'qtd': 1, 'quem': 'voce'}   # valores que o motor assume quando o campo falta

def limpa(x, pai=None):
    """normaliza só o que não muda o sentido: padrões omitidos, listas de nomes como conjunto, todos{} no campo"""
    if isinstance(x, dict):
        out = {k: limpa(v, k) for k, v in x.items() if k not in IGNORA and not k.startswith('_')}
        if 'op' in out:
            for k, v in PADRAO.items():
                if out.get(k) == v: del out[k]
        if pai == 'todos' and out.get('zona') == 'campo': del out['zona']
        return out
    if isinstance(x, list):
        if x and all(isinstance(v, str) for v in x): return sorted(x)
        x = [limpa(v) for v in x]
        if x and all(isinstance(v, dict) and 'k' in v for v in x): x.sort(key=lambda v: v['k'])   # kw: ordem não importa
        return x
    return x

def difs(a, b, cam=''):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: yield f'{cam}.{k}', '—', b[k]
            elif k not in b: yield f'{cam}.{k}', a[k], '—'
            else: yield from difs(a[k], b[k], f'{cam}.{k}')
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)): yield from difs(x, y, f'{cam}[{i}]')
    elif a != b:
        yield cam or '.', a, b

def curto(x, n=160):
    s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + '…'

if __name__ == '__main__':
    args = sys.argv[1:]
    rx = carrega_rx(acha_rx(args))
    nossas = oraculo.nossas()
    alvos = [a if os.path.exists(a) else nossas.get(a) or oraculo.arquivo_de(a) for a in args] or sorted(nossas.values())
    iguais = 0
    for a in alvos:
        c = json.load(open(a)); r = rx.get(c['n'])
        if r is None: print(f"## {c['n']}: não está no cartas-rx"); continue
        d = list(difs(limpa(c), limpa(r)))
        if not d: iguais += 1; continue
        print(f"## {c['n']}")
        for cam, x, y in d: print(f'  {cam}\n    nosso: {curto(x)}\n    rx   : {curto(y)}')
    print(f'-- {len(alvos)} cartas, {iguais} iguais ao rx, {len(alvos) - iguais} com divergência', file=sys.stderr)
