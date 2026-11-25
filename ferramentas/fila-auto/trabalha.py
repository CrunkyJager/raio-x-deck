#!/usr/bin/env python3
"""T46 — fila automática de cartas pelo PC (ideia do Edigar, 25/11).

Pedidos chegam como listas de deck em ~/.cache/raiox/fila-auto/pedidos/*.txt (quem põe lá: o leitor da planilha
do Apps Script, ou à mão). Este script pega o pedido mais antigo, acha as cartas fora do banco, chama `claude -p`
(conta do PC: Max no trabalho, Pro em casa) para escrevê-las em lotes, roda valida.py e os testes e faz commit
num ramo `fila-auto`. Carta escrita aqui sai com rev.por = "fila-auto" (provisória até revisão).

uso: python3 ferramentas/fila-auto/trabalha.py [--seco] [--teto N] [--lote N] [--repo CAMINHO] [--sem-push]
  --seco   não chama o Claude nem faz commit: só mostra o que faria
  --teto   cartas por dia neste PC (padrão 300; casa/Pro: 50)
Sem custo de API: usa o `claude` logado no PC.
"""
import datetime, json, os, re, subprocess, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.expanduser('~/.cache/raiox/fila-auto')
PED, FEITOS, CONTA = (os.path.join(BASE, d) for d in ('pedidos', 'feitos', 'conta'))
TRAVA = os.path.join(BASE, 'trava')
BASICOS = {'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'}
SECOES = {'commander', 'deck', 'sideboard', 'maybeboard', 'companion'}


def arg(nome, padrao):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


def nome_da_linha(l):
    """'1x Sol Ring (C21) 263' / 'Sol Ring' → 'Sol Ring' (None se a linha não é carta)"""
    l = l.strip()
    if not l or l.startswith(('#', '//')) or l.endswith(':') or l.lower() in SECOES:
        return None
    m = re.match(r'(\d+)x?\s+(.+)$', l)
    nome = m.group(2) if m else l
    return re.sub(r'\s*\([A-Z0-9]+\).*$', '', nome).replace(' *F*', '').strip() or None


def faltam(texto, repo):
    sys.path.insert(0, os.path.join(repo, 'banco', 'ferramentas'))
    import oraculo
    feitas = oraculo.nossas()
    vistos, fora, sem_oracle = set(), [], []
    for l in texto.splitlines():
        n = nome_da_linha(l)
        if not n or n in BASICOS or n in vistos:
            continue
        vistos.add(n)
        c = oraculo.acha(n)
        if not c:
            sem_oracle.append(n)
            continue
        if c['name'] not in feitas and n not in feitas:
            fora.append(c['name'])
    return fora, len(vistos), sem_oracle


def gasto_hoje():
    os.makedirs(CONTA, exist_ok=True)
    p = os.path.join(CONTA, datetime.date.today().isoformat())
    return int(open(p).read() or 0) if os.path.exists(p) else 0, p


def roda(cmd, repo, tempo=900):
    r = subprocess.run(cmd, cwd=repo, capture_output=True, text=True, timeout=tempo)
    return r.returncode, (r.stdout + r.stderr)[-3000:]


def escreve(cartas, repo):
    """um claude -p por lote; devolve (ok, saída)"""
    ordem = open(os.path.join(AQUI, 'ordem.md')).read().replace('{CARTAS}', '\n'.join('- ' + c for c in cartas))
    cmd = ['timeout', '1500', 'claude', '-p', ordem, '--permission-mode', 'acceptEdits',
           '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands',
           '--max-turns', '80', '--output-format', 'json',
           '--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash(python3 banco/*),Bash(grep *),Bash(cut *),Bash(ls *)']
    return roda(cmd, repo, 1600)


def main():
    seco = '--seco' in sys.argv
    teto, lote = int(arg('--teto', 300)), int(arg('--lote', 10))
    repo = os.path.abspath(arg('--repo', os.path.join(AQUI, '..', '..')))
    for d in (PED, FEITOS):
        os.makedirs(d, exist_ok=True)
    pedidos = sorted((os.path.getmtime(os.path.join(PED, f)), f) for f in os.listdir(PED) if f.endswith('.txt'))
    if not pedidos:
        print('fila vazia'); return 0
    if os.path.exists(TRAVA) and time.time() - os.path.getmtime(TRAVA) < 3600:
        print('outro trabalhador rodando (trava)'); return 0
    usado, conta = gasto_hoje()
    if usado >= teto:
        print(f'teto do dia: {usado}/{teto}'); return 0
    _, arq = pedidos[0]
    fora, total, sem = faltam(open(os.path.join(PED, arq)).read(), repo)
    print(f'{arq}: {total} cartas, {len(fora)} fora do banco' + (f', sem Oracle: {", ".join(sem)}' if sem else ''))
    fazer = fora[:teto - usado]
    if seco:
        for i in range(0, len(fazer), lote):
            print(f'  lote {i // lote + 1}: ' + ' · '.join(fazer[i:i + lote]))
        print(f'  hoje {usado}/{teto}; sobram {len(fora) - len(fazer)} para amanhã'); return 0
    open(TRAVA, 'w').write(str(os.getpid()))
    try:
        for i in range(0, len(fazer), lote):
            parte = fazer[i:i + lote]
            ok, saida = escreve(parte, repo)
            v, sv = roda(['python3', 'banco/valida.py'], repo)
            t, st = roda(['npx', 'vitest', 'run'], repo)
            if v or t:
                roda(['git', 'checkout', '--', 'banco'], repo); roda(['git', 'clean', '-fdq', 'banco/cartas', 'banco/testes'], repo)
                print(f'  lote {i // lote + 1} REPROVADO (valida {v}, testes {t}); desfeito\n' + sv[-600:] + st[-600:]); return 1
            roda(['git', 'add', 'banco'], repo)
            roda(['git', 'commit', '-qm', f'fila-auto: {len(parte)} cartas provisórias do pedido {arq} ({", ".join(parte[:4])}…)'], repo)
            usado += len(parte); open(conta, 'w').write(str(usado))
            print(f'  lote {i // lote + 1}: {len(parte)} cartas ok (hoje {usado}/{teto})')
        if '--sem-push' not in sys.argv:
            roda(['git', 'push', '-q', 'origin', 'HEAD:fila-auto'], repo)
        if len(fazer) == len(fora):
            os.replace(os.path.join(PED, arq), os.path.join(FEITOS, arq))
    finally:
        os.path.exists(TRAVA) and os.remove(TRAVA)
    return 0


if __name__ == '__main__':
    sys.exit(main())
