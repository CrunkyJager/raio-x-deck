#!/usr/bin/env python3
"""Testes rápidos do Raio-X (local e no GitHub Actions). Sai com erro se algo piorou.
Trava: testa.py < 100% · partida com erros · gabarito de planos abaixo da base.
Só avisa: % de vitória da partida diferente da base (pode ser mudança de propósito).
Uso: python3 ferramentas/ci/verifica.py   (resumo em markdown; no Actions vai para o resumo do commit)"""
import json, os, re, subprocess, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
base = json.load(open(os.path.join(RAIZ, 'ferramentas/ci/base.json'), encoding='utf-8'))
linhas, falhas, avisos = ['## Raio-X — testes', '', '| teste | agora | base | |', '|---|---|---|---|'], [], []

def roda(cmd):
    r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

# 1) conversor do Forge: gabarito de cartas 100%
if not os.path.exists('forge-db.js'):  # Forge fora do site (main): não há o que testar; src/ não vai pro git
    linhas.append(f"| testa.py (cartas) | pulado: sem forge-db.js | {base['testa']} | – |")
else:
    rc, out = roda([sys.executable, 'ferramentas/forge/testa.py'])
    m = re.search(r'(\d+)/(\d+) casos certos', out)
    ok = rc == 0 and m and m.group(1) == m.group(2)
    linhas.append(f"| testa.py (cartas) | {m.group(0) if m else 'falhou'} | {base['testa']} | {'✔' if ok else '✘'} |")
    if not ok: falhas.append('testa.py abaixo de 100%:\n' + out[-1500:])

# 2) partida no motor (sementes fixas → resultado repetível)
rc, out = roda(['node', 'ferramentas/partida.js', 'Stangg', '200', '5'])
ult = [l for l in out.splitlines() if 'turno médio' in l]
if rc or not ult:
    falhas.append('partida.js não rodou:\n' + out[-1500:]); linhas.append('| partida.js | falhou | | ✘ |')
else:
    l = ult[-1]; err = int(re.search(r'erros (\d+)', l).group(1))
    agora = {k: float(v) for k, v in re.findall(r'([A-Za-zÀ-ú ]+?): ([\d.]+)%', l)}
    agora = {k.strip(' |'): v for k, v in agora.items()}; agora['turno'] = float(re.search(r'turno médio ([\d.]+)', l).group(1))
    for k, b in base['partida'].items():
        a = agora.get(k); dif = a is None or abs(a - b) > 1e-9
        linhas.append(f"| partida {k} | {a} | {b} | {'⚠' if dif else '✔'} |")
        if dif: avisos.append(f'partida {k}: {a} (base {b})')
    linhas.append(f"| partida erros | {err} | 0 | {'✔' if err == 0 else '✘'} |")
    if err: falhas.append(f'partida.js com {err} erros:\n' + out[-1500:])

# 2b) modo jogável (T27): um "humano robô" responde as perguntas do motor; a partida tem que chegar ao fim sem erro
for dk in ('Stangg', 'Krenko', 'Lathril', 'Edgar'):
    rc, out = roda(['node', 'ferramentas/jogavel.js', dk, '20', '1'])
    m = re.search(r'(\d+)/(\d+) partidas até o fim, erros (\d+)', out)
    ok = rc == 0 and m and m.group(1) == m.group(2) and m.group(3) == '0'
    linhas.append(f"| jogável {dk} | {m.group(0) if m else 'falhou'} | 20/20, erros 0 | {'✔' if ok else '✘'} |")
    if not ok: falhas.append(f'jogavel.js {dk} falhou:\n' + out[-1500:])

# 3) gabarito de planos (T05/T06): não pode cair
gab = os.path.join(RAIZ, 'ferramentas/gabarito')
guarda = {f: open(os.path.join(gab, f), encoding='utf-8').read() for f in ('linha-base.json', 'linha-base.md')}
rc, out = roda(['node', 'ferramentas/gabarito/mede.js'])
try:
    res = json.load(open(os.path.join(gab, 'linha-base.json'), encoding='utf-8'))
finally:
    for f, t in guarda.items(): open(os.path.join(gab, f), 'w', encoding='utf-8').write(t)  # mede.js reescreve; devolve o original
if rc:
    falhas.append('mede.js não rodou:\n' + out[-1500:]); linhas.append('| gabarito de planos | falhou | | ✘ |')
else:
    for k, b in base['gabarito'].items():
        a = res[k]; s = '✔' if a == b else ('⬆' if a > b else '✘')
        linhas.append(f"| planos {k} | {a}/{res['n']} | {b} | {s} |")
        if a < b: falhas.append(f'gabarito de planos caiu: {k} {a} (base {b})')
        elif a > b: avisos.append(f'gabarito {k} subiu para {a}: atualizar ferramentas/ci/base.json')

linhas += [''] + [f'- ⚠ {a}' for a in avisos] + [f'- ✘ {f}' for f in falhas]
linhas.append('' if falhas else '\n**Tudo verde.**' if not avisos else '\n**Verde, com avisos.**')
txt = '\n'.join(linhas)
print(txt)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write(txt + '\n')
sys.exit(1 if falhas else 0)
