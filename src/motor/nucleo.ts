// src/motor/nucleo.ts — o objeto único do motor (antes globalThis.MOTOR2). Cada módulo pendura nele as suas funções,
// na mesma ordem de antes (index.ts); assim a migração do motor2/ é mecânica e os módulos se enxergam como antes.
import type { Motor } from './tipos';

export const M = {} as Motor;
