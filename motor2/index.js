// motor2/index.js — no node: const M = require('./motor2'); na página/Worker: carregar estado, mana, turno, agentes.
require('./estado.js'); require('./mana.js'); require('./turno.js'); require('./agentes.js');
module.exports = globalThis.MOTOR2;
