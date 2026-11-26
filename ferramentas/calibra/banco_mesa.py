# Roda a Mesa (todas as trocas ligadas × lista original) nos decks do banco.json e grava banco_<tag>.json.
# Uso: servidor na 8765 (T43: `npx vite --port 8765 --strictPort`); ~/.venv-pw/bin/python ferramentas/calibra/banco_mesa.py TAG [N=200] [paralelo=4]
# LOTE=10 mede só os próximos 10 que faltam (retoma do json); PORTA=8766 usa outro servidor (medir dois ramos lado a lado).
import json, os, sys, time, statistics as st
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright
D = os.path.dirname(os.path.abspath(__file__))
tag = sys.argv[1]; N = sys.argv[2] if len(sys.argv) > 2 else '200'; PAR = int(sys.argv[3]) if len(sys.argv) > 3 else 4
banco = json.load(open(os.path.join(D, 'banco.json')))
OUT = os.path.join(D, f'banco_{tag}.json')
res = json.load(open(OUT)) if os.path.exists(OUT) else {}
def um(path):
    lista = banco[path]['lista']
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 1000}); erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        try:
            pg.goto('http://localhost:%s/?x=%d' % (os.environ.get('PORTA', '8765'), time.time())); pg.wait_for_function("window.RAIOX && window.RAIOX.C('Sol Ring')", timeout=60000)
            pg.evaluate("localStorage.setItem('raiox:n','%s'); localStorage.setItem('raiox:refsMeta','0')" % N)
            pg.reload(); pg.wait_for_function("window.RAIOX && window.RAIOX.C('Sol Ring')", timeout=60000)
            pg.fill('#deck-in', lista); pg.evaluate("RAIOX.run()"); pg.wait_for_timeout(1500)
            pg.evaluate("location.hash='#trocas'"); pg.wait_for_timeout(3000)
            sw = pg.evaluate("RAIOX.swaps().filter(s=>s.on).map(s=>s.out+' → '+s.inn)")
            if not sw: return path, {'sw': [], 'd': 0, 'se': 0, 'base': None, 'erros': erros}
            pg.evaluate("location.hash='#mesa'"); pg.wait_for_timeout(1500)
            pg.locator('#m-tro').click()
            pg.wait_for_function("window.RAIOX_TESTE && window.RAIOX_TESTE.todas", timeout=1500000, polling=2000)
            T = pg.evaluate("(()=>{const T=window.RAIOX_TESTE;return {base:T.base, todas:T.todas, pares:T.pares.map(t=>[t.out,t.inn,t.d,t.se])}})()")
            return path, {'sw': sw, 'd': T['todas']['d'], 'se': T['todas']['se'], 'base': T['base'], 'pares': T['pares'], 'erros': erros}
        except Exception as e:
            return path, {'falha': str(e)[:300], 'erros': erros}
        finally: b.close()
faltam = [k for k in banco if k not in res or 'falha' in res[k]]
if os.environ.get('LOTE'): faltam = faltam[:int(os.environ['LOTE'])]
with ThreadPoolExecutor(PAR) as ex:
    for path, r in ex.map(um, faltam):
        res[path] = r; json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
        print(f"{path:55s} " + (f"falha {r['falha'][:80]}" if 'falha' in r else f"{len(r['sw']):2d} trocas  {r['d']:+5.1f} ±{r['se']:.1f}  base {r['base']}"), flush=True)
ok = [r for r in res.values() if 'falha' not in r and r['sw']]
ds = [r['d'] for r in ok]
print(f"\n{tag}: {len(ok)} decks com trocas | média {st.mean(ds):+.2f} (erro da média ±{(sum(r["se"]**2 for r in ok)**.5/len(ok)):.2f}) | melhoram {sum(r['d']>1.5*r['se'] for r in ok)} | pioram {sum(r['d']<-1.5*r['se'] for r in ok)} | mediana {st.median(ds):+.1f}")
