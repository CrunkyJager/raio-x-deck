#!/usr/bin/env python3
"""Preços de Magic em reais pela API pública do MYP Cards (https://mypcards.com/acesso-api).

A API é oficial e aberta: 10 pedidos/min sem token, 60/min com token (header X-Api-Token).
Condição de uso: o site tem que mostrar, onde o preço aparece, que ele vem do MYP Cards, com link.

1) coleta: GET /magic/precos página por página (50 impressões à venda por página, ~1.300 páginas)
   e guarda o bruto em myp-bruto.json (dá para parar e retomar; --novo recomeça do zero).
   Sem token leva ~2 h 15 min; com token ~25 min.
2) monta: para cada carta da cards-db, o MENOR preço entre todas as impressões à venda
   (cartas avulsas em português/inglês, qualquer estado, sem graduadas) e grava precos-myp.js na raiz:
   window.PRECOS_MYP = {data, p: {nome: reais}}.

uso: python3 -I ferramentas/precos/coleta_myp.py [--novo] [--so-montar]
     token opcional: variável MYP_TOKEN (ou arquivo ~/.config/raiox/myp_token)
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import date

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
BRUTO = os.path.join(AQUI, 'myp-bruto.json')
API = 'https://mypcards.com/api/v1/magic/precos?page_size=50&page_number='
TOKEN = os.environ.get('MYP_TOKEN') or (open(os.path.expanduser('~/.config/raiox/myp_token')).read().strip()
                                         if os.path.exists(os.path.expanduser('~/.config/raiox/myp_token')) else '')
PAUSA = 1.1 if TOKEN else 6.3  # um pouco abaixo do limite (60 ou 10 por minuto)
# impressões que não são a carta de jogo (cartas de arte, fichas, tamanho grande, substitutas): não contam no menor preço
FORA = ('art series', 'token', 'oversized', 'substitute', 'minigame', 'checklist', 'emblem', 'helper card', 'front card')


def pega(pg):
    h = {'User-Agent': 'raio-x-deck/1.0', 'Accept': 'application/json'}
    if TOKEN: h['X-Api-Token'] = TOKEN
    for tent in range(8):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(API + str(pg), headers=h), timeout=40))
        except urllib.error.HTTPError as e:
            espera = 65 if e.code == 429 else 20 * (tent + 1)
            print(f'página {pg}: HTTP {e.code}, espero {espera}s', flush=True); time.sleep(espera)
        except Exception as e:
            print(f'página {pg}: {e}, espero 20s', flush=True); time.sleep(20)
    raise SystemExit(f'PAROU na página {pg}: falhou 8 vezes (o que já veio está salvo; rode de novo para continuar)')


def coleta():
    st = {'feitas': 0, 'itens': {}} if '--novo' in sys.argv or not os.path.exists(BRUTO) else json.load(open(BRUTO))
    pg = st['feitas'] + 1
    print(f'começa na página {pg}; {len(st["itens"])} impressões já guardadas; {"com" if TOKEN else "sem"} token', flush=True)
    while True:
        cs = pega(pg).get('cards') or []
        if not cs: break
        for c in cs:
            if c.get('min_price') is None: continue
            st['itens'][str(c['internal_code'])] = [c.get('name_en') or '', c.get('edition_en') or '', c.get('edition_code') or '', float(c['min_price'])]
        st['feitas'] = pg
        if pg % 20 == 0:
            json.dump(st, open(BRUTO, 'w'), ensure_ascii=False); print(f'página {pg}: {len(st["itens"])} impressões', flush=True)
        pg += 1; time.sleep(PAUSA)
    st['fim'] = date.today().isoformat(); st['feitas'] = 0  # próxima rodada recomeça do início
    json.dump(st, open(BRUTO, 'w'), ensure_ascii=False)
    print(f'coleta completa: {pg - 1} páginas, {len(st["itens"])} impressões com preço', flush=True)


def monta():
    st = json.load(open(BRUTO))
    raw = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
    db = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
    idx = {}
    for n in db['cards']:
        idx.setdefault(n.lower(), n); idx.setdefault(n.split(' // ')[0].lower(), n)
    menor, fora, sem = {}, 0, 0
    for nome, ed, cod, v in st['itens'].values():
        if any(f in ed.lower() for f in FORA): fora += 1; continue
        n = idx.get(nome.lower().strip()) or idx.get(nome.split(' // ')[0].lower().strip())
        if not n: sem += 1; continue
        if v > 0 and (n not in menor or v < menor[n]): menor[n] = v
    txt = ('// Menor preço de cada carta no MYP Cards (R$), pela API pública (https://mypcards.com/acesso-api).\n'
           '// Gerado por ferramentas/precos/coleta_myp.py. O site tem que mostrar a fonte com link para mypcards.com.\n'
           f'window.PRECOS_MYP={{"data":"{st.get("fim") or date.today().isoformat()}","p":'
           + json.dumps({k: round(v, 2) for k, v in sorted(menor.items())}, ensure_ascii=False, separators=(',', ':')) + '};\n')
    open(os.path.join(RAIZ, 'precos-myp.js'), 'w', encoding='utf-8').write(txt)
    print(f'precos-myp.js: {len(menor)} cartas com preço; {fora} impressões fora (arte/ficha/etc.); {sem} nomes que não estão na base')


if __name__ == '__main__':
    if '--so-montar' not in sys.argv: coleta()
    monta()
