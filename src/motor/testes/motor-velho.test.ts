// src/motor/testes/motor-velho.test.ts — consertos de regra no motor velho (motor/engine.js + motor/mesa.js, o da Mesa
// simulada e do ferramentas/partida.js). Equilíbrio do Lathril (27/11/2026): cada teste é uma regra que o motor lia errado.
import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const raiz = path.resolve(__dirname, '../../..');
const ctx: any = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js'])
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
const DB = ctx.CARD_DB, F = Object.fromEntries(DB.fields.map((f: string, i: number) => [f, i]));
const rec = (n: string) => { const e = DB.cards[n]; if (!e) throw new Error('sem carta ' + n); const p = String(e[F.p] || '').split(' // ')[0]; return [n, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
const mod = (n: string) => ctx.modelo(rec(n));

test('106.1/605.1a: "Add {G} for each Elf" dá uma mana por elfo, não 1', () => {
  const a = mod('Elvish Archdruid'), p = mod('Priest of Titania'), c = mod('Circle of Dreams Druid');
  expect([a.manaX, a.manaXq, a.mana]).toEqual(['elf', 'eu', 0]);       // "you control"
  expect([p.manaX, p.manaXq, p.mana]).toEqual(['elf', 'todos', 0]);    // "on the battlefield"
  expect([c.manaX, c.manaXq]).toEqual(['*', 'eu']);                     // "for each creature you control"
  expect(a.lac).toEqual([]);
});

test('Wirewood Channeler: X é o número de Elfos (antes contava o tipo "elvess" e dava 1 fixo)', () => {
  const w = mod('Wirewood Channeler');
  expect([w.manaX, w.manaXq, w.mana]).toEqual(['elf', 'todos', 0]);
});

test('702.110 (menace) e afins: palavra-chave com texto de lembrete também vale', () => {
  expect(mod('Lathril, Blade of the Elves').kws).toContain('menace');
  expect(mod('Vampire Nighthawk').kws).toEqual(expect.arrayContaining(['flying', 'deathtouch', 'lifelink']));
});

test('Lathril: dez elfos → cada oponente perde 10 e você ganha 10', () => {
  const h = mod('Lathril, Blade of the Elves').hab.find((h: any) => h.dez);
  expect(h.e).toEqual({ dren: 10, vida: 10 });
});

test('111.4: a ficha tem os tipos do texto; "for each Elf you control" multiplica', () => {
  expect(mod('Hordeling Outburst').tokTipos).toEqual(['goblin']);
  const e = mod('Elvish Promenade');
  expect(e.tokTipos).toEqual(['elf', 'warrior']);
  expect(e.tokPor).toBe('perm:elf');
});

test('partidas do Lathril no motor velho terminam sem erro', () => {
  const DB2 = ctx.CARD_DB, norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const IDX: any = {}; for (const k of Object.keys(DB2.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
  const achar = (n: string) => { const k = IDX[norm(n)]; return k ? rec(k) : null; };
  const nomes = Object.keys(ctx.EXEMPLOS);
  const decks = nomes.map(n => ctx.monta(ctx.parseLista(ctx.EXEMPLOS[n]), achar, null));
  for (let s = 1; s <= 10; s++) { const r = ctx.arena(decks, s, { T: 20 }); expect(r.turno).toBeGreaterThan(0); }
});

/* ===== varredura das cartas dos 30 decks (ferramentas/varre-motor-velho.js), 27/11/2026 ===== */
test('111.4/603.2: ficha de gatilho tem tipo e não sai em dobro', () => {
  const s = mod('Sigil of the Empty Throne');            // hab conj já cria o Angel 4/4: o tokR não dispara de novo
  expect(s.tokR.q).toBe('');
  expect(s.hab.find((h: any) => h.q === 'conj').e.fic.tipos).toEqual(['angel']);
  expect(mod('Hero of Bladehold').tokR.tipos).toEqual(['soldier']);
  const y = mod('Young Pyromancer');                     // "instant or sorcery spell" agora é lido (antes: ficha sem tipo em toda mágica)
  expect(y.hab[0]).toMatchObject({ q: 'conj', tipo: 'instsorc', e: { fic: { tipos: ['elemental'] } } });
  expect(y.tokR.q).toBe('');
  expect(mod('Agate Instigator').tokTipos).toEqual(['lizard', 'rogue']);   // prole: cópia tem os tipos (707.2)
});

test('601.2: gatilho de conjurar noncreature/histórico/cor tem o tipo certo', () => {
  expect(mod('Coruscation Mage').hab.some((h: any) => h.q === 'conj' && h.tipo === 'noncreature')).toBe(true);
  expect(mod('Runaway Steam-Kin').hab.some((h: any) => h.q === 'conj' && h.tipo === 'red')).toBe(true);
});

test('107.3/608.2h: "for each X you control" vira contagem, não número fixo', () => {
  expect(mod('Mass Appeal').drPor).toBe('perm:human');
  expect(mod('Earthshaker Dreadmaw').drPor).toBe('outro:perm:dinosaur');
  expect(mod('Avenger of Zendikar').hab.find((h: any) => h.q === 'etb').e.fic.n).toBe('terr');
  expect(mod('Honden of Cleansing Fire').hab[0].e.vida).toBe('2*perm:shrine');
  expect(mod('Riot Control').hab[0].e.vida).toBe('op:cri');
  expect(mod('Cadira, Caller of the Small').hab[0].e.fic.n).toBe('ficha');
  expect(mod('Visions of Glory').tokPor).toBe('cri');
  expect(mod('Crescent Island Temple').tokPor).toBe('perm:shrine');
});

test('106.1: mana por marcador / por poder', () => {
  expect([mod('Gyre Sage').manaX, mod('Gyre Sage').mana]).toEqual(['cont', 0]);
  for (const n of ['Marwyn, the Nurturer', 'Cradle Clearcutter', 'Kami of Whispered Hopes']) expect(mod(n).manaX).toBe('poder');
});

test('702: palavra-chave junto de outra desconhecida e resguardo com custo de vida', () => {
  expect(mod('Battle Angels of Tyr').kws).toContain('flying');
  expect(mod('Hexing Squelcher').kws).toContain('ward');
  expect(mod('Valgavoth, Terror Eater').kws).toEqual(expect.arrayContaining(['flying', 'lifelink', 'ward']));
});

test('varredura: nenhuma ficha sem tipo nem palavra-chave perdida nas cartas do banco', () => {
  const r = require('node:child_process').execFileSync('node', [path.join(raiz, 'ferramentas/varre-motor-velho.js')], { encoding: 'utf8' });
  expect(r.split('\n').filter((l: string) => /^(kw|fichaTipo|fichaPT) /.test(l))).toEqual([]);
});
