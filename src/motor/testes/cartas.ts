// cartas-rx.js (12 MB, gerado, fora do git) e exemplos.js são scripts que penduram em window: carregados pelo require
// do node (sem passar pelo transformador do Vite). Saem na T45, quando o motor ler o banco próprio.
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const g = globalThis as any;
g.window = g.window || g;
export const cartasRx = () => { if (!g.window.CARTAS_RX) req('../../../cartas-rx.js'); return g.window.CARTAS_RX; };
export const exemplos = () => { if (!g.window.EXEMPLOS) req('../../../exemplos.js'); return g.window.EXEMPLOS; };
