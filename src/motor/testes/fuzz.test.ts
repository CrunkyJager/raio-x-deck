// src/motor/testes/fuzz.test.ts — partidas com agente aleatório/básico checando invariantes a cada pergunta.
// T43 (b): migrado de motor2/testes/fuzz.js; além das invariantes, cada partida roda também no motor2/ em JS
// com a mesma semente e o mesmo agente, e o histórico de perguntas/respostas e o estado final têm de ser iguais
// (prova de que a migração não mudou nada). FUZZ=n muda o número de partidas (padrão 30, como antes).
import { test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { M } from '../index';
import { cartasRx, exemplos } from './cartas';

const req = createRequire(import.meta.url);
const J = req('../../../motor2/index.js');          // motor antigo, só para comparar (sai quando o motor2/ sair)
const cartas = cartasRx();
M.usarCartas(cartas); J.usarCartas(cartas);
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
for (let i = 0; i < N; i++) test(`fuzz semente ${1000 + i}`, () => {
  const novo = partida(M, i, true), velho = partida(J, i, false);
  turnos += novo.e.turno.n;
  expect(novo.hist.length).toBe(velho.hist.length);
  expect(novo.hist).toEqual(velho.hist);
  expect(JSON.stringify(novo.e)).toBe(JSON.stringify(velho.e));
});
test('fuzz: resumo', () => { console.log(`fuzz: ${N} partidas de 4 · erros 0 · ${(turnos / N).toFixed(0)} turnos/partida (igual ao motor2/ JS)`); });
