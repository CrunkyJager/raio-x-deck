"""Gera forge-motor.js: as PEÇAS das mágicas (instantâneas/feitiços) lidas dos roteiros do Forge (GPL-3.0),
para o MOTOR da Mesa montar o efeito a partir de dado estruturado, e não de frase em inglês.
Não mexe no forge-db.js nem nos pesos da análise. Só cartas que existem no cards-db.js.

Formato por carta:  {"c": {"sac": [n, "Creature"]},            custo adicional (sacrificar)
                     "e": [{"api": "DealDamage", "alvo": "Any", "n": "sac.poder"}, ...]}   corrente SP$ -> SubAbility$
Número: inteiro, "x" (X do custo), "sac.poder"/"sac.res"/"sac.cmc" (da criatura sacrificada) ou "?" (não sei).
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from converte import params, le_arquivo, PASTA

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))
CAMPOS_N = ('NumDmg', 'NumCards', 'LifeAmount', 'Amount', 'CounterNum', 'TokenAmount')
SAC_PROP = {'CardPower': 'sac.poder', 'CardToughness': 'sac.res', 'CardManaCost': 'sac.cmc'}


def numero(v, sv):
    v = (v or '').strip()
    if re.fullmatch(r'-?\d+', v):
        return int(v)
    s = sv.get(v, '')
    m = re.match(r'Sacrificed\$(\w+)', s)
    if m:
        return SAC_PROP.get(m.group(1), '?')
    if re.match(r'Count\$xPaid', s):
        return 'x'
    if re.match(r'Number\$(\d+)', s):
        return int(re.match(r'Number\$(\d+)', s).group(1))
    return '?'


def custo_sac(cost):
    m = re.search(r'\bSac<(\d+|X)/([^/>]+)', cost or '')
    if not m or m.group(2) == 'CARDNAME':
        return None
    return [int(m.group(1)) if m.group(1).isdigit() else 'x', m.group(2)]


def peca(api, d, sv):
    e = {'api': api}
    for k in CAMPOS_N:
        if k in d:
            e['n'] = numero(d[k], sv); break
    if 'ValidTgts' in d:
        e['alvo'] = d['ValidTgts']
    elif 'Defined' in d:
        e['def'] = d['Defined']
    for k in ('Origin', 'Destination', 'TargetMin', 'TargetMax'):
        if k in d:
            e[k[0].lower() + k[1:]] = d[k]
    return e


def corrente(d, sv, lim=8):
    out, sub = [], d.get('SubAbility')
    while sub and lim:
        p = params(sv.get(sub, ''))
        if not p:
            break
        _, api, dd = p
        out.append(peca(api, dd, sv)); sub = dd.get('SubAbility'); lim -= 1
    return out


def main():
    s = open(os.path.join(RAIZ, 'cards-db.js'), encoding='utf-8').read()
    db = json.loads(s[s.index('{'):].rstrip().rstrip(';'))
    nomes = set()
    for k in db['cards']:
        nomes.add(k); nomes.add(k.split(' // ')[0])
    out = {}
    for raiz, _, arqs in os.walk(PASTA):
        for a in arqs:
            if not a.endswith('.txt'):
                continue
            for f in le_arquivo(os.path.join(raiz, a)):
                nome = f.get('Name')
                if nome not in nomes or not re.search(r'\b(Instant|Sorcery)\b', f.get('Types', '')):
                    continue
                sps = [p for p in (params(x) for x in f['A']) if p and p[0] == 'SP']
                if len(sps) != 1:      # modal/várias mágicas: fica para depois (regex de reserva)
                    continue
                _, api, d = sps[0]
                if api == 'Charm':
                    continue
                r = {'e': [peca(api, d, f['SVar'])] + corrente(d, f['SVar'])}
                c = custo_sac(d.get('Cost'))
                if c:
                    r['c'] = {'sac': c}
                out[nome] = r
    dest = os.path.join(RAIZ, 'forge-motor.js')
    with open(dest, 'w', encoding='utf-8') as fh:
        fh.write('// Peças das mágicas lidas dos roteiros do Forge (GPL-3.0, github.com/Card-Forge/forge) para o motor da Mesa. Gerado por ferramentas/forge/motor_db.py\n')
        fh.write('globalThis.FORGE_MOTOR=' + json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n')
    sac = sum(1 for v in out.values() if 'c' in v)
    print(f'{len(out)} mágicas, {sac} com sacrifício no custo, {os.path.getsize(dest)//1024} KB')


if __name__ == '__main__':
    main()
