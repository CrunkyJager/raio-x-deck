// src/motor/index.ts — motor do Raio-X (T14+, ex-motor2/). Ordem importa: cada módulo usa o que os anteriores penduraram em M.
import './estado';
import './mana';
import './pilha';
import './efeitos';
import './turno';
import './combate';
import './gatilhos';
import './agentes';
import { M } from './nucleo';

export { M };
export default M;
