# Gera a tabela da fórmula das metas a partir de decks.json e mede o erro contra os próprios decks médios.
import json, statistics as st
d = json.load(open('decks.json'))
K = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter']
mean = lambda xs: st.mean(xs) if xs else 0
tema = lambda r: 'tribe' if r['tema'].startswith('tribe') else r['tema']
geral = [r for r in d.values() if r['tema'] == 'geral']
temas = [r for r in d.values() if not r['tema'].startswith('geral') and r.get('cmd')]
B = {k: mean([r[k] for r in geral + temas]) for k in K}
# efeitos de cor e custo medidos como desvio da média do tema
tm = {}
for r in temas + geral: tm.setdefault(tema(r), []).append(r)
dev = lambda r, k: r[k] - mean([x[k] for x in tm[tema(r)]])
cor = {}
for k in K:
    cor[k] = {'G': (mean([dev(r, k) for r in temas if 'G' in r['cmd']['ci']]) - mean([dev(r, k) for r in temas if 'G' not in r['cmd']['ci']])) / 2,
              'U': (mean([dev(r, k) for r in temas if 'U' in r['cmd']['ci']]) - mean([dev(r, k) for r in temas if 'U' not in r['cmd']['ci']])) / 2}
def semCor(r, k):  # tira o efeito da cor do comandante antes de comparar temas (landfall e elfos são quase sempre verdes)
    ci = r['cmd']['ci']
    if k == 'ramp': return r[k] - cor['ramp']['G'] * (1 if 'G' in ci else -1)
    if k == 'draw': return r[k] - cor['draw']['U'] * (1 if 'U' in ci else -1)
    return r[k]
T = {t: {k: round(mean([semCor(r, k) for r in rs]) - B[k], 1) for k in K} for t, rs in tm.items() if t != 'geral'}
# tribos amostradas (3 comandantes cada): meio caminho entre a tribo e a média das tribos
TR = {}
for r in temas:
    if r['tema'].startswith('tribe:'): TR.setdefault(r['tema'][6:], []).append(r)
TRB = {tb: {k: round(T['tribe'][k] + 0.5 * (mean([semCor(r, k) for r in rs]) - B[k] - T['tribe'][k]), 1) for k in K} for tb, rs in TR.items()}
# contramágica: só decks com azul
BU = mean([r['counter'] for r in temas + geral if 'U' in r['cmd']['ci']])
for t, rs in tm.items():
    if t == 'geral': continue
    u = [r['counter'] for r in rs if 'U' in r['cmd']['ci']]
    T[t]['counter'] = round((mean(u) - BU) * len(u) / (len(u) + 4), 1) if u else 0   # encolhe para 0 com poucos decks
gb = {r['nome']: r for r in geral}
V = {}
for v in ['budget', 'exhibition', 'core', 'upgraded', 'optimized']:
    rs = [r for r in d.values() if r['tema'] == 'geral/' + v and r['nome'] in gb]
    V[v] = {k: round(mean([r[k] - gb[r['nome']][k] for r in rs]), 1) for k in K + ['lands']}
tab = {'base': {k: round(B[k], 1) for k in K}, 'baseContraAzul': round(BU, 1), 'verde': round(cor['ramp']['G'], 1), 'azulCompra': round(cor['draw']['U'], 1),
       'tema': T, 'tribos': TRB, 'bracket': {1: V['exhibition'], 2: V['core'], 3: V['upgraded'], 4: V['optimized']}, 'barato': V['budget'],
       'amostra': {'decks': len(d), 'temas': {t: len(rs) for t, rs in tm.items()}}}
# terrenos: regressão nos decks médios. Testado com custo médio + ramp + compra + comandante de 6+: só o custo médio pesa
# (ramp e compra ~0; erro 1,15 × 1,17 só com a média; Karsten erra 2,0 e dá ~1 a mais). Fica terrenos = a + b × custo médio,
# e cada tema/bracket/orçamento é o resíduo médio do grupo (encolhido para 0 quando há poucos decks).
def ols(X, y):
    k = len(X[0]); A = [[sum(x[i] * x[j] for x in X) for j in range(k)] + [sum(x[i] * yy for x, yy in zip(X, y))] for i in range(k)]
    for i in range(k):
        p = max(range(i, k), key=lambda r: abs(A[r][i])); A[i], A[p] = A[p], A[i]
        for r in range(k):
            if r != i: f = A[r][i] / A[i][i]; A[r] = [a - f * b for a, b in zip(A[r], A[i])]
    return [A[i][k] / A[i][i] for i in range(k)]
todos = [r for r in d.values() if r.get('cmd')]
lin = lambda r: [1, r['media']]
cf = ols([lin(r) for r in todos], [r['lands'] for r in todos])
res = lambda r: r['lands'] - sum(a * b for a, b in zip(cf, lin(r)))
grupo = {}
for r in todos: grupo.setdefault(r['tema'] if r['tema'].startswith('geral') else tema(r), []).append(res(r))
r0 = mean(grupo['geral'])
encolhe = lambda xs: round((mean(xs) - r0) * len(xs) / (len(xs) + 5), 1)   # poucos decks: puxa para 0
tab['terrenos'] = {'a': round(cf[0] + r0, 2), 'b': round(cf[1], 2), 'tema': {t: encolhe(v) for t, v in grupo.items() if not t.startswith('geral')},
                   'bracket': {1: encolhe(grupo['geral/exhibition']), 2: encolhe(grupo['geral/core']), 3: encolhe(grupo['geral/upgraded']), 4: encolhe(grupo['geral/optimized'])},
                   'barato': encolhe(grupo['geral/budget'])}
json.dump(tab, open('tabela.json', 'w'), ensure_ascii=False, indent=1)
print('terrenos', json.dumps(tab['terrenos']))
def prev(r):
    t, ci = tema(r), r['cmd']['ci']; o = {}
    for k in K:
        tt = TRB[r['tema'][6:]] if r['tema'].startswith('tribe:') else T.get(t)
        x = B[k] + (tt[k] if tt else 0)
        if k == 'ramp': x += tab['verde'] * (1 if 'G' in ci else -1)
        if k == 'draw': x += tab['azulCompra'] * (1 if 'U' in ci else -1)
        if k == 'counter': x = (BU + (tt['counter'] if tt else 0)) if 'U' in ci else 0
        o[k] = round(x)
    return o
FIX = {'ramp': 10, 'draw': 10, 'removal': 8, 'wipe': 3, 'protect': 4, 'counter': 3}
print('erro médio por deck (fórmula nova × metas fixas de hoje)')
for k in K:
    rs = temas if k != 'counter' else [r for r in temas if 'U' in r['cmd']['ci']]
    print(f"  {k:8s} {mean([abs(prev(r)[k] - r[k]) for r in rs]):4.1f}  ×  {mean([abs(FIX[k] - r[k]) for r in rs]):4.1f}")
print(json.dumps({k: v for k, v in tab.items() if k != 'tema' and k != 'amostra'}))
