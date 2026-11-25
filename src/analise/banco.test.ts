// T44: o perfil de função lido do banco próprio, conferido em cartas de função conhecida.
import { describe, it, expect } from 'vitest';
import { perfilBanco } from './banco';

const f = (n: string) => { const p = perfilBanco(n); if (!p) throw new Error('fora do banco: ' + n); return p; };
const tem = (n: string, ...k: string[]) => it(`${n}: ${k.join(', ')}`, () => { for (const x of k) expect([...f(n).f]).toContain(x); });
const naoTem = (n: string, ...k: string[]) => it(`${n}: não ${k.join(', ')}`, () => { for (const x of k) expect([...f(n).f]).not.toContain(x); });

describe('funções', () => {
  tem('Sol Ring', 'ramp'); tem('Llanowar Elves', 'ramp'); tem('Cultivate', 'ramp'); tem('Rampant Growth', 'ramp');
  tem('Smothering Tithe', 'ramp', 'tokens'); naoTem('Path to Exile', 'ramp'); naoTem("Ashnod's Altar", 'ramp');
  tem('Rhystic Study', 'draw'); tem('Phyrexian Arena', 'draw'); tem('Faithless Looting', 'cardflow');
  tem('Swords to Plowshares', 'removal'); tem('Path to Exile', 'removal'); tem('Lightning Bolt', 'removal'); tem('Chaos Warp', 'removal'); tem('Beast Within', 'removal');
  tem('Wrath of God', 'wipe'); tem('Toxic Deluge', 'wipe'); tem('Cyclonic Rift', 'wipe'); naoTem('Wrath of God', 'removal');
  tem('Heroic Intervention', 'protect'); tem('Lightning Greaves', 'protect'); tem('Swiftfoot Boots', 'protect'); tem("Teferi's Protection", 'protect');
  tem('Counterspell', 'counter'); tem('Demonic Tutor', 'tutor'); naoTem('Cultivate', 'tutor');
  tem('Eternal Witness', 'recursion'); tem('Reanimate', 'recursion'); tem('Bojuka Bog', 'gyhate');
  tem('Blood Artist', 'drain'); tem("Cathars' Crusade", 'counters');
});
describe('detalhes', () => {
  it('Sol Ring é pedra, Llanowar é dork, Cultivate é terreno', () => { expect(f('Sol Ring').ramp).toBe('pedra'); expect(f('Llanowar Elves').ramp).toBe('dork'); expect(f('Cultivate').ramp).toBe('terreno'); });
  it('Rhystic e Arena repetem a compra', () => { expect(f('Rhystic Study').rep.has('draw')).toBe(true); expect(f('Phyrexian Arena').draw.fase).toBe(true); });
  it('Faithless Looting só filtra', () => expect(f('Faithless Looting').draw.loot).toBe(true));
  it('Swords pega só criatura, Beast Within qualquer permanente e compensa', () => { expect(f('Swords to Plowshares').removal.alcance).toBe('criatura'); expect(f('Beast Within').removal.alcance).toBe('permanente'); expect(f('Beast Within').removal.compensa).toBe(true); });
  it('Cyclonic Rift só do lado dos oponentes', () => expect(f('Cyclonic Rift').wipe.lado).toBe(true));
  it('Wrath é simétrico', () => expect(f('Wrath of God').wipe.lado).toBe(false));
  it('Counterspell na hora, sem pagar', () => { expect(f('Counterspell').inst).toBe(true); expect(f('Counterspell').counter.pagavel).toBe(false); });
  it('Heroic Intervention protege todas', () => expect(f('Heroic Intervention').protect.todas).toBe(true));
  it('Greaves fica na mesa', () => expect(f('Lightning Greaves').protect.fica).toBe(true));
});
