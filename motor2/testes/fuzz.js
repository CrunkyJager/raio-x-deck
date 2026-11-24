// motor2/testes/fuzz.js — partidas com agente aleatório checando invariantes a cada pergunta (CR à parte: são do motor).
// node motor2/testes/fuzz.js [partidas=30]
'use strict';
global.window = global.window || {};
require('../../cartas-rx.js'); require('../../exemplos.js');
const M = require('..');
M.usarCartas(window.CARTAS_RX);
const ds = Object.values(window.EXEMPLOS).map(M.lerLista);
const N = +process.argv[2] || 30;

function invariantes(e) {
  const visto = new Map();
  const marca = (id, onde) => { if (visto.has(id)) throw new Error(`objeto ${id} em duas zonas: ${visto.get(id)} e ${onde}`); visto.set(id, onde); };
  e.campo.forEach(id => marca(id, 'campo')); e.pilha.forEach(id => marca(id, 'pilha'));
  for (const J of e.jogs) for (const z of M.ZONAS_JOG) J.zonas[z].forEach(id => marca(id, J.nome + ':' + z));
  for (const id in e.objs) {
    const o = e.objs[id], onde = visto.get(+id);
    if (!onde) throw new Error(`objeto ${id} (${o.n}) sem zona`);
    if (!onde.endsWith(o.zona)) throw new Error(`objeto ${id} diz ${o.zona}, está em ${onde}`);
  }
  if (visto.size !== Object.keys(e.objs).length) throw new Error('id em zona sem objeto');
  for (const J of e.jogs) for (const c in J.reserva) if (J.reserva[c] < 0) throw new Error('mana negativa');
  for (const id of e.campo) if (e.jogs[e.objs[id].ctrl].saiu) throw new Error('permanente de quem saiu');
}

let turnos = 0, perguntas = 0, erros = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const e = M.novoJogo(ds, { semente: 1000 + i, maxTurnos: 60 })   // sem combate (T16): Krenko dobra fichas sem parar; 60 turnos bastam;
  const ag = i % 2 ? M.agenteAleatorio() : M.agenteBasico();
  try {
    M.avancar(e);
    while (e.perg && !e.fim) {
      invariantes(e);
      M.responder(e, ag(e, e.perg));
      if (++perguntas > 5e6) throw new Error('não termina');
    }
    invariantes(e);
    if (!e.fim) throw new Error('acabou sem fim');
    turnos += e.turno.n;
  } catch (err) { erros++; if (erros <= 5) console.log(`✘ semente ${1000 + i}: ${err.message}`); }
}
const s = (Date.now() - t0) / 1000;
console.log(`fuzz: ${N} partidas de 4 · erros ${erros} · ${(turnos / N).toFixed(0)} turnos/partida · ${(N / s).toFixed(1)} partidas/s (${s.toFixed(1)} s)`);
process.exit(erros ? 1 : 0);
