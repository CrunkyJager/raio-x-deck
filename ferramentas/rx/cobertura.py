#!/usr/bin/env python3
"""T11 — Cobertura do Forge nos nossos decks.

Conta, nos roteiros do Forge, quais EFEITOS (SP/AB/DB$ Api), GATILHOS (T: Mode$), ESTÁTICAS (S: Mode$ e,
no Continuous, o que muda), SUBSTITUIÇÕES (R: Event$) e PALAVRAS-CHAVE (K:) aparecem:
  - no banco de 30 decks do EDHREC + 4 exemplos (por cópia no deck: o que o motor vai ver de verdade)
  - no cards-db inteiro (por carta)
e simula a ordem do núcleo: implementando os K itens mais frequentes, quantas cartas do banco ficam
inteiras (todos os itens dela prontos).

uso: python3 ferramentas/rx/cobertura.py   → planejamento/cobertura.md + ferramentas/rx/cobertura.json
"""
import json, os, re, sys
from collections import Counter, defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(RAIZ, 'ferramentas', 'forge'))
from converte import PASTA, le_arquivo, params, tparams  # noqa: E402

CAT = {'E': 'efeito', 'G': 'gatilho', 'S': 'estática', 'R': 'substituição', 'K': 'palavra-chave'}
SEM_REGRA = {'Basic Land', 'Snow Basic'}  # terrenos básicos não têm item: ficam fora da conta


def itens_face(f):
    """conjunto de itens (cat, chave) de uma face"""
    out = set()
    sv = f['SVar']

    def efeito(txt, d=0):
        p = params(txt)
        if not p or d > 8:
            return
        _, api, kv = p
        if api in ('ChangeZone', 'ChangeZoneAll'):
            api += f"[{kv.get('Origin', '?').split(',')[0]}→{kv.get('Destination', '?').split(',')[0]}]"
        out.add(('E', api))
        for k in ('SubAbility', 'Execute', 'ReplaceWith'):
            n = kv.get(k)
            if n and n in sv:
                efeito(sv[n], d + 1)
        for k in ('Choices',):  # Charm/GenericChoice
            for n in (kv.get(k) or '').split(','):
                n = n.strip()
                if n in sv:
                    efeito(sv[n], d + 1)

    for a in f['A']:
        efeito(a)
    for t in f['T']:
        kv = tparams(t)
        m = kv.get('Mode', '?')
        if m == 'ChangesZone':
            m += '→' + kv.get('Destination', '?').split(',')[0]
        out.add(('G', m))
        if kv.get('Execute') in sv:
            efeito(sv[kv['Execute']])
    for s in f['S']:
        kv = tparams(s)
        m = kv.get('Mode', '?')
        if m == 'Continuous':
            muda = [k for k in kv if k.startswith(('Add', 'Set', 'Remove', 'Gain')) or k in ('CharacteristicDefining',)]
            for k in muda or ['outro']:
                out.add(('S', 'Continuous.' + k))
        else:
            out.add(('S', m))
    for r in f['R']:
        kv = tparams(r)
        out.add(('R', kv.get('Event', '?')))
        if kv.get('ReplaceWith') in sv:
            efeito(sv[kv['ReplaceWith']])
    for k in f['K']:
        out.add(('K', k.split(':')[0].strip()))
    # SVars de efeito soltos (usados por custos, Charm, etc.) que não vieram pelas ligações acima
    for v in sv.values():
        if re.match(r'\s*(DB|AB|SP)\$', v):
            efeito(v)
    return out


def le_forge():
    por_nome = {}
    for raiz, _, arqs in os.walk(PASTA):
        for a in arqs:
            if not a.endswith('.txt'):
                continue
            faces = le_arquivo(os.path.join(raiz, a))
            if not faces or 'Name' not in faces[0]:
                continue
            tipos = faces[0].get('Types', '')
            its = set()
            for f in faces:
                its |= itens_face(f)
            basico = 'Basic' in tipos and 'Land' in tipos
            por_nome[faces[0]['Name']] = (its, basico)
    return por_nome


def decks():
    b = json.load(open(os.path.join(RAIZ, 'ferramentas', 'calibra', 'banco.json')))
    listas = {d['nome']: d['lista'] for d in b.values()}
    s = open(os.path.join(RAIZ, 'exemplos.js'), encoding='utf-8').read()
    listas.update(json.loads(s[s.index('{'):s.rindex('}') + 1]))
    for nome, lista in listas.items():
        for l in lista.split('\n'):
            m = re.match(r'^(\d+)\s+(.+?)\s*$', l)
            if m:
                yield nome, int(m.group(1)), m.group(2).split(' // ')[0]


def main():
    forge = le_forge()
    s = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
    db = json.loads(s[s.index('{'):s.rindex('}') + 1])['cards']

    # ---- banco (por cópia) ----
    copias, cartas_b, sem_roteiro, decks_de = Counter(), Counter(), Counter(), defaultdict(set)
    n_decks = set()
    for dk, q, nome in decks():
        n_decks.add(dk)
        if nome not in forge:
            sem_roteiro[nome] += q; continue
        its, basico = forge[nome]
        if basico:
            continue
        cartas_b[nome] += q
        for it in its:
            copias[it] += q
            decks_de[it].add(dk)
    total_b = sum(cartas_b.values())

    # ---- cards-db (por carta) ----
    por_carta, achadas = Counter(), 0
    for n in db:
        x = forge.get(n.split(' // ')[0])
        if not x:
            continue
        achadas += 1
        for it in x[0]:
            por_carta[it] += 1

    # exemplos: as cartas mais jogadas que têm o item
    ex = defaultdict(list)
    for nome, q in cartas_b.most_common():
        for it in forge[nome][0]:
            if len(ex[it]) < 3:
                ex[it].append(nome)

    # ---- ordem do núcleo: guloso por frequência no banco ----
    ordem = [it for it, _ in copias.most_common()]
    pos = {it: i for i, it in enumerate(ordem)}
    pronta_em = Counter()  # K mínimo para a carta ficar inteira
    for nome, q in cartas_b.items():
        its = forge[nome][0]
        k = max((pos[i] + 1 for i in its), default=0)
        pronta_em[k] += q
    curva, acum = [], 0
    marcos = [0, 10, 20, 30, 50, 75, 100, 150, 200, len(ordem)]
    ks = sorted(pronta_em)
    for K in marcos:
        acum = sum(v for k, v in pronta_em.items() if k <= K)
        curva.append((K, acum, 100 * acum / total_b if total_b else 0))

    # ---- saída ----
    J = {'decks': len(n_decks), 'copias_banco': total_b, 'sem_roteiro': dict(sem_roteiro),
         'cardsdb': len(db), 'cardsdb_no_forge': achadas,
         'itens': [{'cat': CAT[c], 'item': k, 'copias': copias[(c, k)], 'decks': len(decks_de[(c, k)]),
                    'cardsdb': por_carta[(c, k)], 'ex': ex[(c, k)]} for c, k in ordem],
         'so_cardsdb': [{'cat': CAT[c], 'item': k, 'cardsdb': v} for (c, k), v in por_carta.most_common() if (c, k) not in copias][:80],
         'curva': curva}
    json.dump(J, open(os.path.join(AQUI, 'cobertura.json'), 'w'), ensure_ascii=False, indent=1)

    L = [f'# Cobertura do Forge nos nossos decks (T11, gerado por ferramentas/rx/cobertura.py)', '',
         f'Banco: {len(n_decks)} decks (30 EDHREC + 4 exemplos), {total_b} cópias não básicas com roteiro; '
         f'{sum(sem_roteiro.values())} cópias sem roteiro no Forge ({len(sem_roteiro)} cartas). '
         f'cards-db: {len(db)} cartas, {achadas} no Forge ({100 * achadas / len(db):.1f}%).', '',
         '## Ordem do núcleo (implementar os K itens mais frequentes → cópias do banco que ficam inteiras)', '',
         '| K itens | cópias inteiras | % do banco |', '|---:|---:|---:|']
    L += [f'| {K} | {a} | {p:.1f}% |' for K, a, p in curva]
    for c in 'EGSRK':
        lst = [it for it in ordem if it[0] == c]
        L += ['', f'## {CAT[c].capitalize()} ({len(lst)} tipos no banco)', '',
              '| # geral | item | cópias | decks | cards-db | exemplos |', '|---:|---|---:|---:|---:|---|']
        for it in lst[:40]:
            L.append(f'| {pos[it] + 1} | {it[1]} | {copias[it]} | {len(decks_de[it])} | {por_carta[it]} | {", ".join(ex[it])} |')
        if len(lst) > 40:
            L.append(f'| | … mais {len(lst) - 40} (cobertura.json) | | | | |')
    if sem_roteiro:
        L += ['', '## Sem roteiro no Forge', '', ', '.join(f'{n} ×{q}' for n, q in sem_roteiro.most_common())]
    open(os.path.join(RAIZ, 'planejamento', 'cobertura.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print(f'decks {len(n_decks)} · cópias {total_b} · sem roteiro {sum(sem_roteiro.values())} ({len(sem_roteiro)} cartas) · '
          f'itens no banco {len(ordem)} · cards-db no Forge {achadas}/{len(db)}')
    for K, a, p in curva:
        print(f'  K={K:>4}: {p:5.1f}% do banco inteiro')


if __name__ == '__main__':
    main()
