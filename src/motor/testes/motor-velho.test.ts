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
  expect(e.tokPor).toBe('elf');
});

test('partidas do Lathril no motor velho terminam sem erro', () => {
  const DB2 = ctx.CARD_DB, norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const IDX: any = {}; for (const k of Object.keys(DB2.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
  const achar = (n: string) => { const k = IDX[norm(n)]; return k ? rec(k) : null; };
  const nomes = Object.keys(ctx.EXEMPLOS);
  const decks = nomes.map(n => ctx.monta(ctx.parseLista(ctx.EXEMPLOS[n]), achar, null));
  for (let s = 1; s <= 10; s++) { const r = ctx.arena(decks, s, { T: 20 }); expect(r.turno).toBeGreaterThan(0); }
});
