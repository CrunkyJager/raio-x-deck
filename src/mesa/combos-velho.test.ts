// Equilíbrio 2 (27/11): a lista de combos que o motor velho (motor/mesa.js, Mesa simulada) dá como vitória na hora
// só pode ter laço de verdade pelas regras.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx: any = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const COMBOS: string[][] = vm.runInContext('COMBOS', ctx);
const tem = (...ns: string[]) => COMBOS.some(c => ns.every(n => c.includes(n)) && c.length === ns.length);

describe('combos do motor velho', () => {
  it('Sanguine Bond + Vito não é laço: as duas são "ganhou vida → oponente perde", nada devolve a vida', () => expect(tem('Sanguine Bond', 'Vito, Thorn of the Dusk Rose')).toBe(false));
  it('laços de drenar (Exquisite Blood + Vito/Sanguine Bond) não ganham sem evento que comece (CR 603.2): ficam com o laço do motor', () => {
    expect(tem('Exquisite Blood', 'Vito, Thorn of the Dusk Rose')).toBe(false);
    expect(tem('Exquisite Blood', 'Sanguine Bond')).toBe(false);
    expect(tem('Edgar Markov', 'Sanguine Bond', 'Exquisite Blood')).toBe(false);
  });
  it('Krenko + Skirk Prospector + Impact Tremors não é laço: nada desvira o Krenko', () => expect(tem('Krenko, Mob Boss', 'Skirk Prospector', 'Impact Tremors')).toBe(false));
});
