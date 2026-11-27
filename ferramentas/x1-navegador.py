# T47: X1 de verdade no navegador — duas janelas (dois Chromium headless) jogam uma partida inteira pela sala do PeerJS.
# Uso: npx vite --port 5199 (em outro terminal) e ~/.venv-pw/bin/python ferramentas/x1-navegador.py http://localhost:5199/
# No fim imprime IGUAIS se as duas telas mostram a mesma mesa. Precisa de internet (servidor público do PeerJS).
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1]
async def prepara(p, ex):
    print('prepara', ex, flush=True); await p.goto(BASE); await p.wait_for_selector('#examples [data-ex]', timeout=30000)
    await p.locator('#examples [data-ex]').nth(ex).click(); await p.wait_for_function("() => location.hash === '#resumo'", timeout=90000)
    await p.locator('a[href="#aovivo"]').first.click(); await p.wait_for_selector('#v-x1', timeout=60000)
    if not await p.locator('#v-x1').count(): print('sem botão; msg:', await p.inner_text('#go-msg'), '| deck:', len(await p.input_value('#deck-in')), '| aovivo:', len(await p.inner_html('#aovivo'))); raise SystemExit
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); b2 = await pw.chromium.launch()
        A = await b.new_page(); B = await b2.new_page()
        for pg, n in ((A, 'A'), (B, 'B')): pg.on('console', lambda m, n=n: m.type == 'error' and print(n, 'console:', m.text[:200])); pg.on('pageerror', lambda e, n=n: print(n, 'PAGEERR', str(e)[:300]))
        await prepara(A, 0); await A.click('#v-x1')
        await A.wait_for_selector('#v-mesa input[readonly]', timeout=30000)
        url = await A.input_value('#v-mesa input[readonly]'); print('link:', url)
        await B.goto(url); await B.wait_for_selector('#examples [data-ex]', timeout=30000)
        await B.locator('#examples [data-ex]').nth(1).click(); await B.wait_for_function("() => location.hash === '#resumo'", timeout=90000)
        await B.locator('a[href="#aovivo"]').first.click(); await B.wait_for_selector('#v-x1', timeout=60000)
        print('B botão:', await B.inner_text('#v-x1')); await B.click('#v-x1')
        await B.wait_for_function("() => /Vez de|SUA VEZ/i.test(document.querySelector('#v-mesa')?.innerText || '')", timeout=60000)
        ESTADO = """() => [...document.querySelectorAll('#v-mesa .ja-lug')].map(l => l.innerText.replace(/\\s+/g, ' ').replace(/^.*?(Você )?/, '').replace('Você ', '').slice(0, 160)).sort().join(' || ')"""
        CLICA = """() => { const m = document.querySelector('#v-mesa .ja-meio.perg'); if (!m) { const p = document.querySelector('#v-mesa [data-b=pula]'); if (p) { p.click(); return 'pula'; } return ''; }
          const h = document.querySelector('#v-mesa [data-h]:not([data-h=cmd])'); if (h && !/mão inicial|Combate:/i.test(m.innerText)) { h.click(); return 'h ' + h.title.slice(0, 40) + ' @ ' + m.querySelector('p').innerText.slice(0, 50); }
          for (const v of ['0', 'nao', '-1']) { const b = m.querySelector(`.j-ops [data-b="${v}"]:not([disabled])`); if (b) { b.click(); return v + ' ' + m.querySelector('p').innerText.slice(0, 60); } }
          const b = m.querySelector('.j-ops button:not([disabled]):not([hidden]):not([data-b=motor]):not([data-b=desf]):not([data-b=sai])'); if (b) { b.click(); return 'x ' + b.innerText.slice(0, 40) + ' @ ' + m.querySelector('p').innerText.slice(0, 80); } return 'SEM ' + m.innerText.slice(0, 200).split(String.fromCharCode(10)).join(' | '); }"""
        cliques = 0; parado = 0
        for i in range(900):
            fez = False
            for pg, n in ((A, 'A'), (B, 'B')):
                r = await pg.evaluate(CLICA)
                if r.startswith("SEM") and i % 20 == 0: print(n, r[:250], flush=True)
                if r and r != "pula" and not r.startswith("SEM"):
                    cliques += 1; fez = True
                    if cliques <= 6 or cliques % 25 == 0 or r.startswith("SEM"): print(n, r, flush=True)
            parado = 0 if fez else parado + 1
            if parado > 40: break
            await A.wait_for_timeout(250)
            if i % 50 == 0: print(i, 'cliques', cliques, flush=True)
        print('fim cliques', cliques, 'parado', parado)
        ea, eb = await A.evaluate(ESTADO), await B.evaluate(ESTADO)
        print('A', ea[:400]); print('B', eb[:400]); print('IGUAIS' if ea == eb else 'DIFERENTES')
        print('A txt:', (await A.inner_text('#v-mesa'))[:200].replace('\n',' | '))
        print('B txt:', (await B.inner_text('#v-mesa'))[:200].replace('\n',' | '))
        await b.close(); await b2.close()
asyncio.run(main())
