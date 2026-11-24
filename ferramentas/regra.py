#!/usr/bin/env python3
"""regra — consulta as Comprehensive Rules (Raio-X, T10).
  regra 704          seção inteira (até 60 linhas; --tudo p/ todas)
  regra 704.5        regra + subregras (704.5a, 704.5b...)
  regra 702.19b      só essa subregra
  regra trample      verbete do glossário + regras que citam a palavra (até 15)
  regra "last known" frase também vale
  regra --indice     seções que o motor usa
  regra --cmd        regras do Commander (formato, brackets)
  regra --ban Nome   carta banida / Game Changer no Commander?
"""
import os, re, sys

D = os.path.expanduser('~/raio-x-deck/regras')
CR = os.path.join(D, 'cr.txt')


def carrega():
    L = open(CR, encoding='utf-8').read().split('\n')
    # corpo das regras = depois do 2º "1. Game Concepts"; glossário = 2º "Glossary" até 2º "Credits"
    ini = [i for i, l in enumerate(L) if l == '1. Game Concepts'][1]
    glo = [i for i, l in enumerate(L) if l == 'Glossary'][1]
    fim = [i for i, l in enumerate(L) if l == 'Credits'][1]
    regras = [l for l in L[ini:glo] if l.strip()]
    gl, bloco = {}, []
    for l in L[glo + 1:fim] + ['']:
        if l.strip():
            bloco.append(l)
        elif bloco:
            gl[bloco[0].lower()] = bloco
            bloco = []
    return regras, gl, L[2] if len(L) > 2 else ''


def cabe(linhas, tudo, lim):
    if tudo or len(linhas) <= lim:
        return '\n'.join(linhas)
    return '\n'.join(linhas[:lim]) + f'\n… mais {len(linhas) - lim} linhas (use --tudo)'


def main(a):
    tudo = '--tudo' in a
    a = [x for x in a if x != '--tudo']
    if not a or a[0] in ('-h', '--help'):
        print(__doc__.strip()); return 0
    if a[0] == '--indice':
        print(open(os.path.join(D, 'indice.md'), encoding='utf-8').read().rstrip()); return 0
    if a[0] == '--cmd':
        t = open(os.path.join(D, 'commander.txt'), encoding='utf-8').read()
        print(t.split('\n## Banidas')[0].rstrip()); return 0
    if a[0] == '--ban':
        nome = ' '.join(a[1:]).strip().lower()
        t = open(os.path.join(D, 'commander.txt'), encoding='utf-8').read()
        ban = t.split('## Banidas')[1].split('## Game Changers')[0].lower().split('\n')[1:]
        gc = t.split('## Game Changers')[1].lower().split('\n')[1:]
        ok = False
        for n, lista in (('BANIDA no Commander', ban), ('Game Changer', gc)):
            hits = [x for x in lista if x and (x == nome or (len(nome) > 3 and nome in x))]
            for h in hits:
                print(f'{h} → {n}'); ok = True
        if not ok:
            print(f'"{nome}": nem banida nem Game Changer')
        return 0

    regras, gl, data = carrega()
    q = ' '.join(a).strip()
    m = re.fullmatch(r'(\d{3})(?:\.(\d+)([a-z])?)?\.?', q)
    if m:
        sec, sub, letra = m.groups()
        if letra:
            pre = re.compile(rf'^{sec}\.{sub}{letra}\b')
        elif sub:
            pre = re.compile(rf'^{sec}\.{sub}(\.|[a-z]\b)')
        else:
            pre = re.compile(rf'^{sec}\.')
        hits = [l for l in regras if pre.match(l)]
        if not hits:
            print(f'regra {q} não existe ({data})'); return 1
        print(cabe(hits, tudo, 60)); return 0

    ql = q.lower()
    saida = []
    if ql in gl:
        saida += ['[glossário]'] + gl[ql] + ['']
    else:
        parecidos = [k for k in gl if ql in k][:8]
        if parecidos:
            saida += ['[glossário, parecidos] ' + ' · '.join(gl[k][0] for k in parecidos), '']
    pal = re.compile(r'\b' + re.escape(ql) + r'\w*', re.I)
    hits = [l for l in regras if re.match(r'^\d{3}\.\d', l) and pal.search(l)]
    if hits:
        saida.append(f'[regras que citam "{q}": {len(hits)}]')
        saida += [(l if len(l) <= 220 else l[:217] + '...') for l in (hits if tudo else hits[:15])]
        if not tudo and len(hits) > 15:
            saida.append(f'… mais {len(hits) - 15} (use --tudo)')
    if not saida:
        print(f'nada para "{q}"'); return 1
    print('\n'.join(saida).rstrip()); return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
