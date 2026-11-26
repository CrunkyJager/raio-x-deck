// src/motor/masmorras.ts — o deck de masmorras (Safana do Edigar): infectar e veneno (CR 702.90, 704.5c), masmorras e
// aventurar (CR 309, 701.49), iniciativa (CR 727; o pedido chamava de 725, que no cr.txt de hoje é "Ending Turns").
// Arquivo próprio para mexer o mínimo em estado.ts/efeitos.ts: os outros módulos chamam as funções daqui pelo M.
import { M } from './nucleo';

// ---------- infectar (702.90) e marcadores no jogador (122.1) ----------
// Dano de fonte com infectar: em jogador vira veneno em vez de perda de vida (702.90b); em criatura vira marcadores
// −1/−1 em vez de dano marcado (702.90c, em M.danoEm). Vínculo com a vida continua (o dano foi causado). O veneno mora
// em J.veneno (proliferar e a ABE dos 10 venenos, 704.5c, já liam ali). Limite conhecido: infectar + toque mortífero
// numa criatura não destrói (a ABE olha o.mortal com dano marcado, e o infectar não marca dano).
M.temInfectar = kw => !!kw && kw.some(k => k.k === 'infectar');
/** dano (já sem prevenção) num jogador: veneno com infectar; senão perde vida, se a vida pode mudar (119.7, 119.8) */
M.danoJogador = (e, j, q, kw) => {
  const J = e.jogs[j];
  if (M.temInfectar(kw)) { J.veneno = (J.veneno || 0) + q; M.log(e, J.nome, 'recebe', q, 'veneno (infectar)'); return; }
  if (!M.vidaFixa(e, j)) J.vida -= q;
};
// marcador num jogador (op marcador com quem e sem em): 'poison' (nome do vocabulário, decisão do coordenador 25/11;
// 'veneno' fica aceito até a normalização do banco) em J.veneno; os outros (rad, experience…) em J.marc, que por ora só guarda.
M.marcadorJogador = (e, j, tipo, q, tirar) => {
  const J = e.jogs[j]; if (!J || J.saiu || !(q > 0)) return;
  if (tipo === 'poison' || tipo === 'veneno') { J.veneno = Math.max(0, (J.veneno || 0) + (tirar ? -q : q)); M.log(e, J.nome, tirar ? 'perde' : 'recebe', q, 'veneno'); return; }
  const m = J.marc || (J.marc = {});
  m[tipo] = Math.max(0, (m[tipo] || 0) + (tirar ? -q : q));
};
