# T05: candidatos.json (tags do EDHREC) + revisão do Claude → planos.json (gabarito). Duvidosos ficam marcados para o Felipe.
import json, os, re
D = os.path.dirname(os.path.abspath(__file__))
md = open(os.path.join(D, '../../planejamento/planos.md')).read()
NOMES = {int(n): re.sub(r'\*', '', t) for n, t in re.findall(r'^\| (\d+) \| \*\*(.+?)\*\*', md, re.M)}
# revisão do Claude: nome → (principal, [secundário], duvidoso, nota)
REV = {
 'Bard, King of Dale': None,  # tags genéricas (fichas, compra): fora
 'Trostani, Selesnya\'s Voice': (2, [11], False, ''),
 'Bello, Bard of the Brambles': (3, [15], True, 'artefatos/encantamentos viram criaturas e atacam: aggro ou enchantress?'),
 'The Gitrog, Ravenous Ride': (4, [13], True, 'stompy com terrenos'),
 'Ghalta, Primal Hunger': (4, [3], False, ''), 'Gishath, Sun\'s Avatar': (4, [8], False, ''),
 'Lightning, Army of One': (6, [1], False, ''),
 'Meren of Clan Nel Toth': (9, [20], False, ''),
 'Omnath, Locus of Creation': (12, [13], False, ''), 'Hearthhull, the Worldseed': (12, [13], False, ''),
 'Aesi, Tyrant of Gyre Strait': (12, [13], False, ''),
 'Teval, the Balanced Scale': (21, [13], False, ''),
 'Y\'shtola, Night\'s Blessed': (23, [10], True, 'dreno por valor de mana; EDHREC diz controle/spellslinger'),
 'Storm, Force of Nature': (17, [16], False, ''), 'Zada, Hedron Grinder': (17, [2], True, 'copia mágica para cada criatura: storm ou ir largo?'),
 'Tivit, Seller of Secrets': (29, [15], True, 'voto + tesouros; turno extra só com Time Sieve'),
 'Obeka, Brute Chronologist': (18, [34], True, 'termina o turno / upkeep extra'),
 'Hashaton, Scarab\'s Fist': (20, [], False, ''),
 'The Gitrog Monster': (13, [34], False, ''), 'Sidisi, Brood Tyrant': (21, [20], False, ''),
 'Quintorius, History Chaser': (21, [20], False, ''),
 'Kefka, Court Mage': (28, [23], False, ''),
 'Child of Alara': (24, [13], True, 'escolhido à mão: limpa a mesa ao morrer'),
 'Avacyn, Angel of Hope': (24, [4], True, 'escolhida à mão: indestrutível + limpa-mesa'),
 'Zur the Enchanter': (15, [25], True, 'busca encantamento: enchantress, stax ou voltron?'),
 'Urza, Lord High Artificer': (34, [15], False, ''),
 'Lord Windgrace': (13, [26], False, ''),
 'Kynaios and Tiro of Meletis': (31, [30], False, ''),
 'Killian, Decisive Mentor': (29, [15], True, 'auras que goadam'),
 'Mr. House, President and CEO': (15, [32], True, 'dado + tesouro/robôs: caos ou artefatos?'),
 'Deadpool, Trading Card': (27, [32], True, 'troca/cópia: caos ou roubo?'),
 'Chatterfang, Squirrel General': (9, [34], False, ''),
 'Sisay, Weatherlight Captain': (36, [34], False, ''),
 'Thrasios, Triton Hero // Tymna the Weaver': (34, [36], False, ''),
 'Miirym, Sentinel Wyrm': (4, [14], True, 'copia os próprios dragões (clone, não roubo): stompy?'),
 'Orvar, the All-Form': (14, [34], True, 'clones; pouco roubo de verdade'),
 'Atraxa, Praetors\' Voice': (5, [33], True, 'proliferar serve a veneno, superamigos e marcadores'),
 'Giada, Font of Hope': (2, [11], True, 'anjos com marcadores: ganho de vida é tema, não plano'),
 'Frodo, Adventurous Hobbit // Sam, Loyal Attendant': (11, [2], True, 'comida/ganho de vida; ganho de vida é tema'),
 'Knuckles the Echidna': (35, [3], True, 'tem "você ganha", mas o deck do EDHREC joga tesouro/aggro'),
 'Ramses, Assassin Lord': (35, [5], True, 'tem "você ganha" (assassinos), deck também joga veneno'),
 'Zenos yae Galvus // Shinryu, Transcendent Rival': (35, [1], True, 'tem "você ganha", deck do EDHREC é voltron'),
 'Henzie "Toolbox" Torre': (8, [3], True, 'blitz barateado: trapaça ou aggro?'),
}
out = []
for c in json.load(open(os.path.join(D, 'candidatos.json'))):
    r = REV.get(c['nome'], (c['principal'], c['secundario'], c['duvidoso'], ''))
    if r is None: continue
    p, sec, duv, nota = r
    if duv and not nota: nota = 'tags do EDHREC apontam para ' + ', '.join(NOMES[q] for q, *_ in c['planos_tags'][:2])
    out.append({'nome': c['nome'], 'ci': c['ci'], 'principal': p, 'principal_nome': NOMES[p],
                'secundario': sec, 'secundario_nome': [NOMES[q] for q in sec],
                'fonte': 'manual' if c['pescado_por'][1] == 'manual' else 'edhrec:' + c['pescado_por'][1],
                'tags_edhrec': c['tags_top'], 'duvidoso': duv, 'nota': nota, 'revisado_felipe': duv})
out.sort(key=lambda x: (x['principal'], x['nome']))
json.dump({'versao': 'T05 23/11/2026 (21 duvidosos revisados pelo Felipe)', 'planos': NOMES, 'sem_comandante': [p for p in NOMES if not any(x['principal'] == p for x in out)],
           'comandantes': out}, open(os.path.join(D, 'planos.json'), 'w'), ensure_ascii=False, indent=1)
print(len(out), 'comandantes ·', sum(x['duvidoso'] for x in out), 'duvidosos · sem comandante:', [p for p in NOMES if not any(x['principal'] == p for x in out)])
for x in out:
    if x['duvidoso']: print(f"  {x['principal']:2} {x['nome'][:34]:34} {x['ci']:5} sec{x['secundario']} — {x['nota']}")
