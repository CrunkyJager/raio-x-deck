#!/usr/bin/env python3
"""T13 — testa o conversor RX contra o gabarito à mão (esperado_rx.json).

Cada carta é comparada BLOCO a BLOCO (base, kw, atv, gat, est, subst, fx+alvos, faces).
Campos _obs do gabarito são ignorados. A carta só conta como certa se TODOS os blocos batem e
a saída passa no esquema. Bloco ainda não feito no conversor fica listado em PENDENTES
(carta: [blocos]) — conta à parte, não como erro, e tem que ir diminuindo (T13 parte 2).

uso: python3 ferramentas/rx/testa_rx.py [-v]      (-v mostra o diff dos blocos errados)
"""
import json, os, sys
import jsonschema

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from converte_rx import converte  # noqa: E402

# blocos que o conversor v1 ainda não modela nessas cartas (T13 parte 2): vão sair daqui
PENDENTES = {}
PEND = os.path.join(AQUI, 'pendentes_rx.json')
if os.path.exists(PEND):
    PENDENTES = json.load(open(PEND))

BASE = ('n', 'custo', 'vm', 'ci', 'cores', 'tipos', 'super', 'sub', 'pt', 'leal', 'forma', 'custoAd')
BLOCOS = {'base': BASE, 'kw': ('kw',), 'atv': ('atv',), 'gat': ('gat',), 'est': ('est',),
          'subst': ('subst',), 'fx': ('fx', 'alvos'), 'faces': ('faces',)}


def limpa(x):
    if isinstance(x, dict):
        return {k: limpa(v) for k, v in x.items() if not k.startswith('_') and k not in ('falta', 'forge')}
    if isinstance(x, list):
        return [limpa(v) for v in x]
    return x


def main():
    v = '-v' in sys.argv
    esq = jsonschema.Draft202012Validator(json.load(open(os.path.join(AQUI, 'esperado_rx.json' if False else 'esquema.json'))))
    gab = json.load(open(os.path.join(AQUI, 'esperado_rx.json')))['cartas']
    saida = converte([c['n'] for c in gab])
    certas, erros, pend_n = 0, 0, 0
    for g in gab:
        n = g['n']
        s = saida.get(n)
        if not s:
            print(f'✘ {n}: conversor não gerou'); erros += 1; continue
        ruins = [f'esquema {"/".join(map(str, e.absolute_path))}: {e.message[:100]}' for e in esq.iter_errors(s)]
        gl, sl = limpa(g), limpa(s)
        pend = set(PENDENTES.get(n, []))
        blocos_ruins, blocos_pend = [], []
        for b, ks in BLOCOS.items():
            a = {k: gl.get(k) for k in ks if gl.get(k) is not None}
            o = {k: sl.get(k) for k in ks if sl.get(k) is not None}
            if a != o:
                (blocos_pend if b in pend else blocos_ruins).append(b)
                if v and b not in pend:
                    print(f'  {n} [{b}]\n    gabarito: {json.dumps(a, ensure_ascii=False)}\n    saída:    {json.dumps(o, ensure_ascii=False)}')
            elif b in pend:
                ruins.append(f'bloco {b} já bate: tirar de pendentes_rx.json')
        ruins += [f'bloco {b}' for b in blocos_ruins]
        if ruins:
            erros += 1
            print(f'✘ {n}: ' + '; '.join(ruins))
        elif blocos_pend:
            pend_n += 1
            print(f'… {n}: pendente {",".join(blocos_pend)}  falta={s.get("falta", [])}')
        else:
            certas += 1
            print(f'✔ {n}')
    print(f'\n{certas}/{len(gab)} inteiras · {pend_n} com bloco pendente · {erros} erradas' + (' ✔' if not erros else ''))
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
