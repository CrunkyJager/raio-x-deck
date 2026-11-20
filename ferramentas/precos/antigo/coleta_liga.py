#!/usr/bin/env python3
"""Coleta o MENOR preço de cada carta na LigaMagic, abrindo a busca no Edge Bancada 3D (CDP, porta 9223,
pelo cdp-proxy-up). A Liga não tem API e barra pedidos diretos (Cloudflare): só a navegação de verdade passa.

Grava ferramentas/precos/liga.json {nome: reais | null} a cada 25 cartas (dá para parar e retomar),
e no fim gera precos-liga.js na raiz do site (window.PRECOS_LIGA = {nome: reais}, data da coleta).

uso: ~/.local/share/chrome-bridge/venv/bin/python -I ferramentas/precos/coleta_liga.py [N] [--novo]
     N = quantas cartas, das mais jogadas (padrão 8000); --novo = refaz todas (coleta da semana)
Se a Cloudflare pedir verificação por mais de 90 s, para e avisa (salva o que já tinha).
"""
import json, os, subprocess, sys, time, urllib.parse
from datetime import date
from websockets.sync.client import connect

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
SAI = os.path.join(AQUI, 'liga.json')
N = int(next((a for a in sys.argv[1:] if a.isdigit()), 8000)); NOVO = '--novo' in sys.argv

raw = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
db = json.loads(raw[raw.index('{'):raw.rindex('}') + 1]); F = {f: i for i, f in enumerate(db['fields'])}
nomes = sorted((n for n, c in db['cards'].items() if c[F['r']] and not c[F['ban']]), key=lambda n: db['cards'][n][F['r']])[:N]
out = {} if NOVO or not os.path.exists(SAI) else json.load(open(SAI))
pend = [n for n in nomes if n not in out]
print(f'{len(nomes)} cartas; {len(pend)} a coletar', flush=True)

ws = connect(subprocess.run(['cdp-proxy-up'], capture_output=True, text=True, check=True).stdout.strip(), max_size=None, open_timeout=30)
seq = 0
def cdp(m, p=None, s=None):
    global seq; seq += 1
    msg = {'id': seq, 'method': m, 'params': p or {}}
    if s: msg['sessionId'] = s
    ws.send(json.dumps(msg))
    while True:
        r = json.loads(ws.recv(timeout=60))
        if r.get('id') == seq:
            if 'error' in r: raise RuntimeError(r['error'])
            return r['result']
def ev(expr, s):
    r = cdp('Runtime.evaluate', {'expression': expr, 'returnByValue': True}, s)['result']
    return r.get('value')

# reaproveita uma aba da Liga já aberta (ela já passou pela Cloudflare); aba nova em segundo plano fica presa na verificação
liga = [t for t in cdp('Target.getTargets')['targetInfos'] if t['type'] == 'page' and 'ligamagic.com.br' in t['url']]
NOVA = not liga
alvo = liga[0]['targetId'] if liga else cdp('Target.createTarget', {'url': 'https://www.ligamagic.com.br/'})['targetId']
sess = cdp('Target.attachToTarget', {'targetId': alvo, 'flatten': True})['sessionId']

# lê a página: lista de resultados (busca) ou a página da própria carta (quando a busca acha uma só)
LER = r"""(() => {
  if (/Just a moment|Um momento/i.test(document.title)) return {cf: true};
  if (document.readyState !== 'complete') return null;
  const num = t => { const m = (t || '').match(/R\$\s*([\d.]+,\d{2})/); return m ? +m[1].replace(/\./g, '').replace(',', '.') : null; };
  const rows = [...document.querySelectorAll('.mtg-single')].map(r => {
    const a = r.querySelector('a[href*="view=cards/card"]'); if (!a) return null;
    const q = new URLSearchParams(a.getAttribute('href').split('?')[1] || '');
    return { nome: (q.get('card') || '').trim(), min: num((r.querySelector('.price-min') || {}).textContent) };
  }).filter(Boolean);
  if (rows.length) return {rows};
  const min = document.querySelector('.price-min, [class*="price-min"]');
  if (min && /view=cards\/card/.test(location.href)) return {rows: [{nome: new URLSearchParams(location.search).get('card') || '', min: num(min.textContent), pagina: true}]};
  if (/Nenhum|não encontr/i.test(document.body.innerText)) return {rows: []};
  return null;
})()"""

def preco(n):
    frente = n.split(' // ')[0]
    url = 'https://www.ligamagic.com.br/?view=cards/search&card=' + urllib.parse.quote(frente)
    cdp('Page.navigate', {'url': url}, sess)
    t0, cf0 = time.time(), None
    while True:
        time.sleep(0.6)
        r = ev(LER, sess)
        if r and r.get('cf'):
            cf0 = cf0 or time.time()
            if time.time() - cf0 > 90: raise SystemExit('PAROU: a Cloudflare pediu verificação no Edge (resolva lá e rode de novo).')
            continue
        if r is not None: break
        if time.time() - t0 > 30: return 'erro'
    alvoN = frente.lower()
    # o nome exato em inglês (a Liga lista também Art Card, tokens e versões com outro nome)
    vs = [x['min'] for x in r['rows'] if x['nome'].lower() in (alvoN, n.lower()) or x['nome'].lower().split(' // ')[0] == alvoN]
    vs = [v for v in vs if v]  # R$ 0,00 = sem estoque
    return min(vs) if vs else None

try:
    for i, n in enumerate(pend):
        out[n] = preco(n)
        if i % 25 == 0:
            json.dump(out, open(SAI, 'w'), ensure_ascii=False)
            print(i, n, out[n], flush=True)
        time.sleep(1.2)  # devagar: a Liga é de graça para nós, não sobrecarregar
finally:
    json.dump(out, open(SAI, 'w'), ensure_ascii=False)
    if NOVA:
        try: cdp('Target.closeTarget', {'targetId': alvo})
        except Exception: pass
    ok = {k: v for k, v in out.items() if isinstance(v, (int, float))}
    txt = ('// Menor preço de cada carta na LigaMagic (R$), coletado pelo ferramentas/precos/coleta_liga.py\n'
           f'window.PRECOS_LIGA={{"data":"{date.today().isoformat()}","p":' + json.dumps(ok, ensure_ascii=False, separators=(',', ':')) + '};\n')
    open(os.path.join(RAIZ, 'precos-liga.js'), 'w', encoding='utf-8').write(txt)
    print(f'{len(ok)} com preço, {sum(1 for v in out.values() if v is None)} sem estoque/não achadas, {sum(1 for v in out.values() if v == "erro")} erros', flush=True)
