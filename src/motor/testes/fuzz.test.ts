// src/motor/testes/fuzz.test.ts — partidas com agente aleatório/básico checando invariantes a cada pergunta.
// T43 (b): migrado de motor2/testes/fuzz.js (no 74fb095 cada partida era comparada com o motor2/ em JS, igual em
// histórico e estado final; o motor2/ saiu depois disso). FUZZ=n muda o número de partidas (padrão 30, como antes).
import { test, expect } from 'vitest';
import { M } from '../index';
import { temCartasRx, cartasRx, exemplos } from './cartas';

// cartas reais dos 4 decks de exemplo: do cartas-rx.js enquanto o banco próprio não tiver os decks (T20)
const TEM = temCartasRx();
if (TEM) M.usarCartas(cartasRx());
else console.warn('fuzz: sem cartas-rx.js (gerado, fora do git) — pulado; depois da T20 passa a usar banco/cartas');
const N = +(process.env.FUZZ || 30);

function invariantes(e) {
  const visto = new Map();
  const marca = (id, onde) => { if (visto.has(id)) throw new Error(`objeto ${id} em duas zonas: ${visto.get(id)} e ${onde}`); visto.set(id, onde); };
  e.campo.forEach(id => marca(id, 'campo')); e.pilha.forEach(id => marca(id, 'pilha'));
  for (const Jg of e.jogs) for (const z of M.ZONAS_JOG) Jg.zonas[z].forEach(id => marca(id, Jg.nome + ':' + z));
  for (const id in e.objs) {
    const o = e.objs[id], onde = visto.get(+id);
    if (!onde) throw new Error(`objeto ${id} (${o.n}) sem zona`);
    if (!onde.endsWith(o.zona)) throw new Error(`objeto ${id} diz ${o.zona}, está em ${onde}`);
  }
  if (visto.size !== Object.keys(e.objs).length) throw new Error('id em zona sem objeto');
  for (const Jg of e.jogs) for (const c in Jg.reserva) if (Jg.reserva[c] < 0) throw new Error('mana negativa');
  for (const id of e.campo) if (e.jogs[e.objs[id].ctrl].saiu) throw new Error('permanente de quem saiu');
}

function partida(Mx, i, checa) {
  const ds = Object.values(exemplos()).map(Mx.lerLista);
  const e = Mx.novoJogo(ds, { semente: 1000 + i, maxTurnos: 400 });
  const ag = i % 2 ? Mx.agenteAleatorio() : Mx.agenteBasico();
  const hist: number[] = []; let perguntas = 0;
  Mx.avancar(e);
  while (e.perg && !e.fim) {
    if (checa) invariantes(e);
    const k = ag(e, e.perg); hist.push(k);
    Mx.responder(e, k);
    if (++perguntas > 5e6) throw new Error('não termina');
  }
  if (checa) invariantes(e);
  if (!e.fim) throw new Error('acabou sem fim');
  return { e, hist };
}

let turnos = 0;
for (let i = 0; i < N; i++) test.skipIf(!TEM)(`fuzz semente ${1000 + i}`, () => {
  const { e } = partida(M, i, true);
  turnos += e.turno.n;
  expect(e.fim).toBeTruthy();
});
test.skipIf(!TEM)('fuzz: resumo', () => { console.log(`fuzz: ${N} partidas de 4 · erros 0 · ${(turnos / N).toFixed(0)} turnos/partida`); });
