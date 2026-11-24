// motor2/testes/casos.js — casos de regra do núcleo (cena montada → ação → estado esperado), cada um com o número da CR.
// Rodar: node motor2/testes/casos.js   (sai com código 1 se algum falhar)
'use strict';
global.window = global.window || {};
require('../../cartas-rx.js');
const M = require('..');
M.usarCartas(window.CARTAS_RX);

const casos = [];
const caso = (cr, nome, fn) => casos.push({ cr, nome, fn });
const ok = (c, msg) => { if (!c) throw new Error(msg || 'falhou'); };
const igual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const enche = (n, c = 'Wastes') => Array(n).fill(c);

// cena: pula o mulligan e começa na principal 1 do turno 2 do jogador 0
function cena({ jogs = 2, cmd = [], campo = [], mao = [], grimorio = 30, passo = 'principal1' } = {}) {
  const decks = [];
  for (let i = 0; i < jogs; i++) decks.push({ comandante: cmd[i] ? [cmd[i]] : [], cartas: enche(grimorio) });
  const e = M.novoJogo(decks, { semente: 3 });
  Object.assign(e.turno, { n: 2, ativo: 0, primeiro: 0, passo, feito: true, passar: false });
  const por = (j, n, o = {}) => {
    const id = e.prox;
    const obj = { id, n, dono: j, ctrl: j, zona: 'grimorio', ts: ++e.ts, virada: false, dano: 0, marc: {}, doente: false, cmd: false };
    e.objs[id] = obj; e.prox++; e.jogs[j].zonas.grimorio.push(id);
    const z = o.zona || 'campo';
    M.mover(e, id, z, { virada: !!o.virada });
    Object.assign(obj, { doente: !!o.doente }, o.obj || {});
    return obj;
  };
  for (const [j, n, o] of campo) por(j, n, o);
  for (const [j, n] of mao) por(j, n, { zona: 'mao' });
  e.abeNovo = [];
  e.por = por;
  return e;
}
const opsDe = (e, a) => e.perg ? e.perg.ops.filter(o => o.a === a) : [];
const resp = (e, pred) => { const k = e.perg.ops.findIndex(pred); ok(k >= 0, 'opção não existe'); M.responder(e, k); };
const passarAte = (e, passo) => { let g = 0; while (e.turno.passo !== passo && !e.fim) { const pr = x => x.turno.passo === passo; M.avancar(e, pr); if (e.perg && e.perg.tipo === 'acao') M.responder(e, 0, pr); if (++g > 500) throw new Error('não chegou em ' + passo); } };

// ---------- começo do jogo ----------
caso('103.4c', 'Commander começa com 40 de vida', () => {
  const e = M.novoJogo([{ comandante: ['Krenko, Mob Boss'], cartas: enche(99, 'Mountain') }, { cartas: enche(99, 'Forest') }]);
  igual(e.jogs.map(j => j.vida), [40, 40]);
});
caso('903.6', 'comandante começa na zona de comando; identidade de cor (903.4)', () => {
  const e = M.novoJogo([{ comandante: ['Lathril, Blade of the Elves'], cartas: enche(99, 'Forest') }]);
  igual(e.jogs[0].zonas.comando.map(id => e.objs[id].n), ['Lathril, Blade of the Elves']);
  igual(e.jogs[0].ci, 'BG');
});
caso('103.5', 'cada um compra 7 e decide o mulligan na ordem do turno', () => {
  const e = M.novoJogo([{ cartas: enche(40) }, { cartas: enche(40) }, { cartas: enche(40) }], { semente: 5 });
  M.avancar(e);
  igual(e.jogs.map(j => j.zonas.mao.length), [7, 7, 7]);
  igual(e.perg.tipo, 'mulligan'); igual(e.perg.j, e.turno.primeiro);
});
caso('103.5c', 'multijogador: 1º mulligan grátis, o 2º põe 1 no fundo', () => {
  const e = M.novoJogo([{ cartas: enche(40) }, { cartas: enche(40) }, { cartas: enche(40) }], { semente: 5 });
  const quer = { [e.turno.primeiro]: 2 };
  M.avancar(e);
  while (e.perg && (e.perg.tipo === 'mulligan' || e.perg.tipo === 'fundo')) {
    const j = e.perg.j;
    if (e.perg.tipo === 'mulligan') M.responder(e, quer[j] > 0 ? (quer[j]--, 1) : 0); else M.responder(e, 0);
  }
  const p = e.turno.primeiro;
  // já comprou a do 1º turno (103.8c): 6 + 1
  igual(e.jogs[p].mulls, 2); igual(e.jogs[p].zonas.mao.length, 7, 'mão do que fez 2 mulligans');
  igual(e.jogs[p].zonas.grimorio.length, 33); igual(e.jogs[(p + 1) % 3].zonas.mao.length, 7);
});
caso('103.5', '2 jogadores: o 1º mulligan já põe 1 no fundo (London)', () => {
  const e = M.novoJogo([{ cartas: enche(40) }, { cartas: enche(40) }], { semente: 5 });
  M.avancar(e);
  const p = e.turno.primeiro;
  M.responder(e, 1); M.responder(e, 0);      // p pede, o outro mantém
  M.responder(e, 0);                         // p mantém a nova
  igual(e.perg.tipo, 'fundo'); M.responder(e, 0);
  igual(e.jogs[p].zonas.mao.length, 6); igual(e.jogs[p].zonas.grimorio.length, 34);
});
caso('103.8a', '2 jogadores: quem começa não compra no 1º turno', () => {
  const e = M.novoJogo([{ cartas: enche(40) }, { cartas: enche(40) }], { semente: 5 });
  const p = e.turno.primeiro;
  M.avancar(e); M.responder(e, 0); M.responder(e, 0);
  passarAte(e, 'principal1');
  igual(e.jogs[p].zonas.mao.length, 7);
});
caso('103.8c', 'multijogador: quem começa compra no 1º turno', () => {
  const e = M.novoJogo([{ cartas: enche(40) }, { cartas: enche(40) }, { cartas: enche(40) }], { semente: 5 });
  const p = e.turno.primeiro;
  M.avancar(e); M.responder(e, 0); M.responder(e, 0); M.responder(e, 0);
  passarAte(e, 'principal1');
  igual(e.jogs[p].zonas.mao.length, 8);
});

// ---------- turno ----------
caso('500.1', 'ordem das etapas; sem atacantes pula bloqueio e dano (508.8)', () => {
  const e = cena({ passo: 'desvirar' }); e.turno.feito = false;
  const vistos = [];
  for (let g = 0; g < 40 && e.turno.n === 2; g++) {
    if (vistos[vistos.length - 1] !== e.turno.passo) vistos.push(e.turno.passo);
    const p0 = e.turno.passo; const pr = x => x.turno.passo !== p0; M.avancar(e, pr); if (e.perg) M.responder(e, 0, pr);
  }
  igual(vistos, ['desvirar', 'manutencao', 'compra', 'principal1', 'inicioCombate', 'atacantes', 'fimCombate', 'principal2', 'final', 'limpeza']);
});
caso('502.3', 'desvirar: só as permanentes do jogador ativo', () => {
  const e = cena({ campo: [[0, 'Forest', { virada: true }], [1, 'Forest', { virada: true }]], passo: 'limpeza' });
  e.turno.ativo = 1; e.turno.feito = true;
  passarAte(e, 'manutencao');
  igual(e.campo.map(id => e.objs[id].virada), [false, true]);
});
caso('106.4', 'a reserva de mana esvazia no fim da etapa', () => {
  const e = cena({ campo: [[0, 'Forest']], mao: [[0, 'Mountain']] });   // terreno na mão: a pergunta continua
  M.avancar(e); resp(e, o => o.a === 'mana');
  igual(e.jogs[0].reserva.G, 1);
  resp(e, o => o.a === 'passar');
  igual(e.jogs[0].reserva.G, 0);
});
caso('305.2', 'só um terreno por turno', () => {
  const e = cena({ mao: [[0, 'Forest'], [0, 'Mountain']] });
  M.avancar(e); igual(opsDe(e, 'terreno').length, 2);
  resp(e, o => o.a === 'terreno');
  igual(opsDe(e, 'terreno').length, 0);
});
caso('302.6', 'criatura "doente" não vira para mana; no turno seguinte do dono pode', () => {
  const e = cena({ campo: [[0, 'Llanowar Elves', { doente: true }]] });
  igual(M.fontesDeMana(e, 0).length, 0);
  e.turno.passo = 'limpeza'; e.turno.ativo = 1; e.turno.feito = true;
  passarAte(e, 'principal1');
  igual(M.fontesDeMana(e, 0).length, 1);
});
caso('514.1', 'limpeza: descarta até 7', () => {
  const e = cena({ mao: enche(9, 'Forest').map(n => [0, n]), passo: 'final' });
  passarAte(e, 'limpeza'); M.avancar(e);
  igual(e.perg.tipo, 'descartar'); M.responder(e, 0); M.responder(e, 0);
  igual(e.jogs[0].zonas.mao.length, 7); igual(e.jogs[0].zonas.cemiterio.length, 2);
});
caso('402.2', 'Reliquary Tower: sem limite de mão', () => {
  const e = cena({ campo: [[0, 'Reliquary Tower']], mao: enche(9, 'Forest').map(n => [0, n]), passo: 'final' });
  passarAte(e, 'limpeza'); M.avancar(e);
  ok(!e.perg || e.perg.tipo !== 'descartar'); igual(e.jogs[0].zonas.mao.length, 9);
});
caso('514.2', 'limpeza: dano marcado sai', () => {
  const e = cena({ campo: [[0, 'Llanowar Elves', { obj: { dano: 0 } }], [1, 'Grizzly Bears']], passo: 'final' });
  e.objs[e.campo[1]].dano = 1;
  passarAte(e, 'limpeza'); M.avancar(e); if (e.perg) M.responder(e, 0);
  igual(e.objs[e.campo[1]].dano, 0);
});

// ---------- terrenos que entram virados ----------
caso('614.1c', 'Temple entra virado', () => {
  const e = cena({ mao: [[0, 'Temple of Malady']] });
  M.avancar(e); resp(e, o => o.a === 'terreno');
  ok(e.objs[e.campo[0]].virada);
});
caso('614.1c', 'Sacred Foundry: paga 2 de vida e entra desvirado; sem pagar, virado', () => {
  const e = cena({ mao: [[0, 'Sacred Foundry']] });
  M.avancar(e); resp(e, o => o.a === 'terreno');
  igual(e.perg.tipo, 'aMenosQue'); resp(e, o => o.a === 'pagar');
  ok(!e.objs[e.campo[0]].virada); igual(e.jogs[0].vida, 38);
  const f = cena({ mao: [[0, 'Sacred Foundry']] });
  M.avancar(f); resp(f, o => o.a === 'terreno'); resp(f, o => o.a === 'naoPagar');
  ok(f.objs[f.campo[0]].virada); igual(f.jogs[0].vida, 40);
});
caso('614.1c', 'Dragonskull Summit: desvirado com Pântano/Montanha, virado sem', () => {
  const e = cena({ campo: [[0, 'Swamp']], mao: [[0, 'Dragonskull Summit']] });
  M.avancar(e); resp(e, o => o.a === 'terreno');
  ok(!e.objs[e.campo[1]].virada, 'com Swamp');
  const f = cena({ campo: [[0, 'Forest'], [1, 'Mountain']], mao: [[0, 'Dragonskull Summit']] });
  M.avancar(f); resp(f, o => o.a === 'terreno');
  ok(f.objs[f.campo[2]].virada, 'Mountain do oponente não conta');
});
caso('614.1c', 'Blooming Marsh: virado com 3+ outros terrenos', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest']], mao: [[0, 'Blooming Marsh']] });
  M.avancar(e); resp(e, o => o.a === 'terreno'); ok(!e.objs[e.campo[2]].virada, 'com 2');
  const f = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Forest']], mao: [[0, 'Blooming Marsh']] });
  M.avancar(f); resp(f, o => o.a === 'terreno'); ok(f.objs[f.campo[3]].virada, 'com 3');
});

// ---------- mana e custos ----------
caso('605.3', 'Temple: escolhe B ou G; Gruul Turf: R e G juntos', () => {
  const e = cena({ campo: [[0, 'Temple of Malady'], [0, 'Gruul Turf']] });
  const f = M.fontesDeMana(e, 0);
  igual(f[0].pacotes.map(M.fmtMana), ['B', 'G']); igual(f[1].pacotes.map(M.fmtMana), ['RG']);
});
caso('903.4f', 'Command Tower: cores da identidade; sem comandante não produz', () => {
  const e = cena({ cmd: ['Lathril, Blade of the Elves'], campo: [[0, 'Command Tower'], [1, 'Command Tower']] });
  igual(M.fontesDeMana(e, 0)[0].pacotes.map(M.fmtMana), ['B', 'G']);
  igual(M.fontesDeMana(e, 1).length, 0);
});
caso('106.7', 'Exotic Orchard: cores que os terrenos dos oponentes produziriam', () => {
  const e = cena({ campo: [[0, 'Exotic Orchard'], [1, 'Temple of Malady'], [0, 'Mountain']] });
  igual(M.fontesDeMana(e, 0).find(f => e.objs[f.id].n === 'Exotic Orchard').pacotes.map(M.fmtMana), ['B', 'G']);
});
caso('107.4e', 'híbrido paga com qualquer das duas cores; 2/W paga com {2}', () => {
  ok(M.pagarDaReserva({ ...M.zeroMana(), W: 1 }, { p: ['R/W'] }));
  ok(!M.pagarDaReserva({ ...M.zeroMana(), U: 1 }, { p: ['R/W'] }));
  ok(M.pagarDaReserva({ ...M.zeroMana(), C: 2 }, { p: ['2/W'] }));
  ok(!M.pagarDaReserva({ ...M.zeroMana(), C: 1 }, { p: ['2/W'] }));
});
caso('107.4f', 'phyrexiano: cor ou 2 de vida', () => {
  igual(M.pagarDaReserva(M.zeroMana(), { p: ['B/P'] }), null);
  igual(M.pagarDaReserva(M.zeroMana(), { p: ['B/P'] }, { vidaDisp: 2 }).vida, 2);
  igual(M.pagarDaReserva({ ...M.zeroMana(), B: 1 }, { p: ['B/P'] }, { vidaDisp: 2 }).vida, 0);
});
caso('601.2g', 'plano de mana: Krenko {2}{R}{R} com Mountain×2 + Sol Ring; sem 2 vermelhos não dá', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Sol Ring'], [0, 'Forest']] });
  const pl = M.planoMana(e, 0, M.carta('Krenko, Mob Boss').custo);
  ok(pl); igual(pl.passos.length, 3, 'usa Sol Ring e deixa a Forest');
  const f = cena({ campo: [[0, 'Mountain'], [0, 'Forest'], [0, 'Forest'], [0, 'Forest']] });
  igual(M.planoMana(f, 0, M.carta('Krenko, Mob Boss').custo), null);
});
caso('601.2g', 'plano guarda a fonte flexível: {G}{B} com Forest + Command Tower(BG) usa a Tower no B', () => {
  const e = cena({ cmd: ['Lathril, Blade of the Elves'], campo: [[0, 'Command Tower'], [0, 'Forest']] });
  const pl = M.planoMana(e, 0, { p: ['G', 'B'] });
  ok(pl); ok(M.pagarComPlano(e, 0, { p: ['G', 'B'] }));
  ok(e.campo.every(id => e.objs[id].virada)); igual(M.somaMana(e.jogs[0].reserva), 0);
});
caso('903.8', 'imposto do comandante: +{2} por conjuração anterior', () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'] });
  const id = e.jogs[0].cmd[0];
  igual(M.custoComImposto(e, e.objs[id]), { g: 2, p: ['R', 'R'] });
  e.jogs[0].imposto[id] = 2;
  igual(M.custoComImposto(e, e.objs[id]), { g: 6, p: ['R', 'R'] });
});

// ---------- ações baseadas em estado ----------
caso('704.5a', 'vida 0 perde; 800.4a: as cartas dele saem do jogo', () => {
  const e = cena({ jogs: 3, campo: [[1, 'Forest']] });
  e.jogs[1].vida = 0; M.avancar(e);
  ok(e.jogs[1].saiu); igual(e.campo.length, 0); ok(!e.fim);
});
caso('704.5b', 'comprar de grimório vazio perde', () => {
  const e = cena({ jogs: 3, grimorio: 0 });
  M.comprar(e, 2, 1); M.avancar(e);
  ok(e.jogs[2].saiu); ok(!e.jogs[0].saiu);
});
caso('704.5c', '10 venenos perde', () => {
  const e = cena({ jogs: 3 }); e.jogs[1].veneno = 10; M.avancar(e); ok(e.jogs[1].saiu);
});
caso('903.10a', '21 de dano do mesmo comandante perde; 20+20 de dois não', () => {
  const e = cena({ jogs: 3 }); e.jogs[1].danoCmd = { 5: 21 }; e.jogs[2].danoCmd = { 5: 20, 6: 20 };
  M.avancar(e); ok(e.jogs[1].saiu); ok(!e.jogs[2].saiu);
});
caso('104.2a', 'sobra um: ele vence', () => {
  const e = cena({ jogs: 2 }); e.jogs[1].vida = -3; M.avancar(e);
  igual(e.fim.vencedor, 0);
});
caso('704.5d', 'ficha fora do campo deixa de existir', () => {
  const e = cena();
  const o = e.por(0, 'Grizzly Bears'); o.ficha = { n: 'Goblin', tipos: ['Creature'], pt: [1, 1] };
  M.mover(e, o.id, 'cemiterio'); M.avancar(e);
  ok(!e.objs[o.id]); igual(e.jogs[0].zonas.cemiterio.length, 0);
});
caso('704.5f', 'resistência 0 vai ao cemitério', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears', { obj: { marc: { '-1/-1': 2 } } }]] });
  M.avancar(e); igual(e.campo.length, 0); igual(e.jogs[0].zonas.cemiterio.length, 1);
});
caso('704.5g', 'dano letal destrói; dano menor não', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  e.objs[e.campo[0]].dano = 1; e.objs[e.campo[1]].dano = 1;
  M.avancar(e); igual(e.campo.map(id => e.objs[id].n), ['Grizzly Bears']);
});
caso('704.5j', 'regra da lenda: o controlador escolhe qual fica; de jogadores diferentes ficam as duas', () => {
  const e = cena({ campo: [[0, 'Krenko, Mob Boss'], [0, 'Krenko, Mob Boss'], [1, 'Krenko, Mob Boss']] });
  M.avancar(e); igual(e.perg.tipo, 'lenda'); igual(e.perg.ops.length, 2);
  const fica = e.perg.ops[1].id; M.responder(e, 1);
  igual(e.campo.filter(id => e.objs[id].ctrl === 0), [fica]); igual(e.campo.length, 2);
});
caso('903.9a', 'comandante no cemitério: o dono pode mandar ao comando', () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'] });
  const id = e.jogs[0].cmd[0];
  M.mover(e, id, 'campo'); M.mover(e, id, 'cemiterio'); M.avancar(e);
  igual(e.perg.tipo, 'cmdZona'); resp(e, o => o.a === 'comando');
  igual(e.objs[id].zona, 'comando');
  const f = cena({ cmd: ['Krenko, Mob Boss'] }); const i2 = f.jogs[0].cmd[0];
  M.mover(f, i2, 'exilio'); M.avancar(f); resp(f, o => o.a === 'ficar');
  igual(f.objs[i2].zona, 'exilio'); M.avancar(f); ok(!f.perg || f.perg.tipo !== 'cmdZona', 'não pergunta de novo');
});
caso('903.9b', 'comandante que iria para a mão vai ao comando', () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'] }); const id = e.jogs[0].cmd[0];
  M.mover(e, id, 'campo'); M.mover(e, id, 'mao'); igual(e.objs[id].zona, 'comando');
});
caso('400.7', 'mudar de zona: objeto novo (timestamp novo, dano e marcadores zerados)', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears', { obj: { marc: { '+1/+1': 1 } } }]] });
  const o = e.objs[e.campo[0]], ts = o.ts; o.dano = 1;
  M.mover(e, o.id, 'mao'); M.mover(e, o.id, 'campo');
  ok(o.ts > ts); igual(o.dano, 0); igual(o.marc, {}); ok(o.doente);
});
caso('800.4k', 'quem saiu não tem turno', () => {
  const e = cena({ jogs: 3, passo: 'limpeza' }); e.jogs[1].vida = 0;
  passarAte(e, 'manutencao');
  igual(e.turno.ativo, 2);
});

// ---------- estado clonável e determinístico ----------
caso('—', 'mesma semente = mesma partida; clonar no meio e continuar dá o mesmo fim', () => {
  require('../../exemplos.js');
  const ds = Object.values(window.EXEMPLOS).map(M.lerLista);
  const roda = e => M.rodar(e, ds.map(() => M.agenteBasico()));
  const a = roda(M.novoJogo(ds, { semente: 11 })), b = roda(M.novoJogo(ds, { semente: 11 }));
  igual(a.fim, b.fim);
  const c = M.novoJogo(ds, { semente: 11 }); M.avancar(c);
  const ag = M.agenteBasico();
  for (let i = 0; i < 300 && c.perg; i++) M.responder(c, ag(c, c.perg));
  const d = M.clonar(c);
  igual(roda(c).fim, roda(d).fim);
});

// ---------- rodar ----------
let falhas = 0;
for (const c of casos) {
  try { c.fn(); } catch (err) { falhas++; console.log(`✘ CR ${c.cr} — ${c.nome}\n   ${err.message}`); }
}
console.log(`${casos.length - falhas}/${casos.length} casos de regra ${falhas ? '✘' : '✔'}`);
process.exit(falhas ? 1 : 0);
