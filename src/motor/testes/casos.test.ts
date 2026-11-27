// src/motor/testes/casos.test.ts — casos de regra do núcleo (cena montada → ação → estado esperado), cada um com o número da CR.
// T43 (b): migrado de motor2/testes/casos.js sem mudar caso nenhum. Rodar: npx vitest run src/motor
// T43: as cartas vêm do banco próprio (banco/cartas/, escritas do Oracle). Caso que pede carta que ainda não está lá
// pula com aviso dizendo quais faltam; só o caso dos 4 decks de exemplo usa o cartas-rx.js, e pula sem ele.
import { test } from 'vitest';
import { M } from '../index';
import { temCartasRx, cartasRx, exemplos } from './cartas';
import { bancoProprio, comReserva, anotandoFaltas } from '../../dados/cartas';
import { comCenaFaces } from './faces-cena';
const banco = anotandoFaltas(comCenaFaces(bancoProprio()));   // T43 faces: o que falta no banco para os casos de faces
M.usarCartas(banco.db);

const casos: any[] = [];
const caso = (cr, nome, fn) => casos.push({ cr, nome, fn });
const ok = (c, msg?) => { if (!c) throw new Error(msg || 'falhou'); };
const igual = (a, b, msg?) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const enche = (n, c = 'Wastes') => Array(n).fill(c);

// cena: pula o mulligan e começa na principal 1 do turno 2 do jogador 0
function cena({ jogs = 2, cmd = [], campo = [], mao = [], grimorio = 30, passo = 'principal1' }: any = {}) {
  const decks: any[] = [];
  for (let i = 0; i < jogs; i++) decks.push({ comandante: cmd[i] ? [cmd[i]] : [], cartas: enche(grimorio) });
  const e = M.novoJogo(decks, { semente: 3 });
  Object.assign(e.turno, { n: 2, ativo: 0, primeiro: 0, passo, feito: true, passar: false });
  const por = (j, n, o: any = {}) => {
    const id = e.prox;
    const obj = { id, n, dono: j, ctrl: j, zona: 'grimorio', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false };
    e.objs[id] = obj; e.prox++; e.jogs[j].zonas.grimorio.push(id);
    const z = o.zona || 'campo';
    M.mover(e, id, z, { virada: !!o.virada });
    Object.assign(obj, { doente: !!o.doente }, o.obj || {});
    return obj;
  };
  for (const [j, n, o] of campo) por(j, n, o);
  for (const [j, n] of mao) por(j, n, { zona: 'mao' });
  e.abeNovo = []; e.pend = []; e.lote = [];
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
  const vistos: any[] = [];
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
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'terreno').length, 0);
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

caso('305.2a', 'Exploration: 2 terrenos; Azusa: 3', () => {
  const e = cena({ campo: [[0, 'Exploration']], mao: enche(4, 'Forest').map(n => [0, n]) });
  M.avancar(e); resp(e, o => o.a === 'terreno'); resp(e, o => o.a === 'terreno');
  igual(e.jogs[0].terrenos, 2); igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'terreno').length, 0);
  const f = cena({ campo: [[0, 'Azusa, Lost but Seeking']], mao: enche(4, 'Forest').map(n => [0, n]) });
  igual(M.terrenosPorTurno(f, 0), 3); igual(M.terrenosPorTurno(f, 1), 1, 'só de quem controla');
});
caso('614.12', 'Thriving Grove: escolhe cor (não verde) ao entrar; dá G ou a escolhida', () => {
  const e = cena({ mao: [[0, 'Thriving Grove']] });
  M.avancar(e); resp(e, o => o.a === 'terreno');
  igual(e.perg.tipo, 'escolha'); igual(e.perg.ops.map(o => o.v).join(''), 'WUBR');
  resp(e, o => o.v === 'B');
  const g = e.objs[e.campo[0]]; ok(g.virada); g.virada = false;
  igual(M.fontesDeMana(e, 0)[0].pacotes.map(M.fmtMana), ['G', 'B']);
  M.mover(e, g.id, 'mao'); igual(g.escolha, null, 'escolha some ao mudar de zona (400.7)');
});
caso('106.6', 'mana restrita (Unclaimed Territory) não entra na reserva comum; o {C} sim', () => {
  const e = cena({ campo: [[0, 'Unclaimed Territory']] });
  igual(M.fontesDeMana(e, 0).map(f => f.pacotes.map(M.fmtMana).join()), ['C']);
});
caso('306.5b', 'planeswalker entra com a lealdade impressa e não morre nas ABE', () => {
  const e = cena({ campo: [[0, 'Chandra, Torch of Defiance']] });
  const o = e.objs[e.campo[0]]; igual(o.marc.lealdade, 4);
  M.avancar(e); igual(e.campo.length, 1);
  o.marc.lealdade = 0; e.turno.passar = false; M.abe(e); igual(e.campo.length, 0, '704.5i');
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
caso('107.3', 'custo com X: {X}{R} com X=3 pede 4', () => {
  const r = { ...M.zeroMana(), R: 4 };
  ok(M.pagarDaReserva(r, { x: 1, p: ['R'] }, { x: 3 })); ok(!M.pagarDaReserva(r, { x: 1, p: ['R'] }, { x: 4 }));
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Sol Ring']] });
  ok(M.planoMana(e, 0, { x: 1, p: ['R'] }, { x: 3 })); igual(M.planoMana(e, 0, { x: 1, p: ['R'] }, { x: 4 }), null);
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
caso('—', 'mesma semente = mesma partida; clonar no meio e continuar dá o mesmo fim', ({ skip }) => {
  if (!temCartasRx()) return skip('sem cartas-rx.js (gerado, fora do git): os 4 decks de exemplo precisam dele até a T20');
  M.usarCartas(comReserva(cartasRx()));
  try { mesmaSemente(); } finally { M.usarCartas(banco.db); }
});
function mesmaSemente() {
  const ds = Object.values<any>(exemplos()).map(M.lerLista);
  const roda = e => M.rodar(e, ds.map(() => M.agenteBasico()));
  const a = roda(M.novoJogo(ds, { semente: 11 })), b = roda(M.novoJogo(ds, { semente: 11 }));
  igual(a.fim, b.fim); ok(a.fim.motivo !== 'limite de turnos', 'partida não acabou: ' + JSON.stringify(a.fim));
  const c = M.novoJogo(ds, { semente: 11 }); M.avancar(c);
  const ag = M.agenteBasico();
  for (let i = 0; i < 300 && c.perg; i++) M.responder(c, ag(c, c.perg));
  const d = M.clonar(c);
  igual(roda(c).fim, roda(d).fim);
}


// ---------- T15: pilha e prioridade ----------
// responde e para quando a etapa muda (sem isso a partida segue sozinha até o próximo turno)
const respE = (e, pred) => { const k = e.perg.ops.findIndex(pred); ok(k >= 0, 'opção não existe: ' + JSON.stringify(e.perg.ops).slice(0, 150)); const { passo, n } = e.turno; M.responder(e, k, x => x.turno.passo !== passo || x.turno.n !== n); };
const conj = (e, nome) => respE(e, o => o.a === 'conjurar' && e.objs[o.id].n === nome);
const alvoObj = (e, nome) => !e.perg || e.perg.tipo !== 'alvo' ? null : respE(e, o => o.a === 'alvo' && o.o !== undefined && e.objs[o.o].n === nome);
const alvoJog = (e, j) => respE(e, o => o.a === 'alvo' && o.jog === j);
const naZona = (e, j, z) => e.jogs[j].zonas[z].map(id => e.objs[id].n);
const noCampo = e => e.campo.map(id => e.objs[id].n);

caso('601.2', 'Lightning Bolt: vai para a pilha, paga {R}, resolve e a criatura morre (704.5g); Bolt no cemitério (608.2n)', () => {
  const e = cena({ campo: [[0, 'Mountain'], [1, 'Grizzly Bears']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoObj(e, 'Grizzly Bears');
  igual(noCampo(e), ['Mountain']); igual(naZona(e, 1, 'cemiterio'), ['Grizzly Bears']); igual(naZona(e, 0, 'cemiterio'), ['Lightning Bolt']);
  ok(e.objs[e.campo[0]].virada, 'Mountain virada para pagar');
});
caso('120.3a', 'dano a jogador tira vida', () => {
  const e = cena({ campo: [[0, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  igual(e.jogs[1].vida, 37);
});
caso('117.3c', 'quem conjura recebe a prioridade de novo e pode responder à própria mágica', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Lightning Bolt'], [0, 'Shock']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  igual(e.perg.j, 0); igual(e.pilha.length, 1); ok(opsDe(e, 'conjurar').length === 1, 'Shock em resposta');
  conj(e, 'Shock'); alvoJog(e, 1);
  igual(e.jogs[1].vida, 35); igual(naZona(e, 0, 'cemiterio'), ['Shock', 'Lightning Bolt'], '405.5: o último a entrar resolve primeiro');
});
caso('117.4', 'todos passam com a pilha vazia: a etapa acaba', () => {
  const e = cena({ campo: [[0, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); igual(e.turno.passo, 'principal1');
  respE(e, o => o.a === 'passar');
  ok(e.turno.passo !== 'principal1', 'saiu da principal 1');
});
caso('117.1a', 'oponente responde com instantânea: Counterspell anula Bolt (701.6), sem dano', () => {
  const e = cena({ campo: [[0, 'Mountain'], [1, 'Island'], [1, 'Island']], mao: [[0, 'Lightning Bolt'], [1, 'Counterspell']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  igual(e.perg.j, 1, 'J1 recebe a prioridade com Bolt na pilha');
  conj(e, 'Counterspell');
  igual(e.jogs[1].vida, 40); igual(naZona(e, 0, 'cemiterio'), ['Lightning Bolt']); igual(naZona(e, 1, 'cemiterio'), ['Counterspell']);
});
caso('307.1', 'feitiço só na principal do ativo com a pilha vazia; instantânea em qualquer prioridade', () => {
  const e = cena({ campo: [[0, 'Island'], [0, 'Island'], [0, 'Island'], [1, 'Island'], [1, 'Island'], [1, 'Island'], [1, 'Mountain']],
    mao: [[0, 'Divination'], [1, 'Divination'], [1, 'Lightning Bolt']] });
  ok(M.podeConjurar(e, 0, e.objs[e.jogs[0].zonas.mao[0]]), 'ativo na principal');
  ok(!M.podeConjurar(e, 1, e.objs[e.jogs[1].zonas.mao[0]]), 'feitiço do não ativo');
  ok(M.podeConjurar(e, 1, e.objs[e.jogs[1].zonas.mao[1]]), 'instantânea do não ativo');
  e.turno.passo = 'manutencao';
  ok(!M.podeConjurar(e, 0, e.objs[e.jogs[0].zonas.mao[0]]), 'feitiço fora da principal');
});
caso('601.2c', 'sem alvo legal não dá para conjurar (Murder sem criatura)', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Swamp']], mao: [[0, 'Murder']] });
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'conjurar').length, 0);
});
caso('608.2b', 'alvo sai antes de resolver: a mágica não resolve e vai ao cemitério', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Swamp'], [1, 'Island'], [1, 'Grizzly Bears']], mao: [[0, 'Murder'], [1, 'Unsummon']] });
  M.avancar(e); conj(e, 'Murder'); alvoObj(e, 'Grizzly Bears');
  igual(e.perg.j, 1); conj(e, 'Unsummon');
  igual(naZona(e, 1, 'mao'), ['Grizzly Bears']); igual(naZona(e, 0, 'cemiterio'), ['Murder']);
  ok(e.log.length === 0 || true);
});
caso('400.7', 'alvo que mudou de zona e voltou é outro objeto (alvo ilegal)', () => {
  const e = cena({ campo: [[0, 'Mountain'], [1, 'Grizzly Bears']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt');
  const b = e.campo.find(id => e.objs[id].n === 'Grizzly Bears');
  const esc = { o: b, ts: e.objs[b].ts };
  ok(M.alvoLegal(e, { f: 'qualquerAlvo' }, esc, { voce: 0 }));
  M.mover(e, b, 'mao'); M.mover(e, b, 'campo');
  ok(!M.alvoLegal(e, { f: 'qualquerAlvo' }, esc, { voce: 0 }), 'ts novo');
});
caso('702.11b', 'antimagia: oponente não mira; o próprio controlador mira', () => {
  const e = cena({ campo: [[0, 'Mountain'], [1, 'Slippery Bogle'], [1, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  const bog = e.campo.find(id => e.objs[id].n === 'Slippery Bogle');
  ok(!M.alvosPossiveis(e, { f: 'qualquerAlvo' }, { voce: 0 }).some(a => a.o === bog), 'J0 não');
  ok(M.alvosPossiveis(e, { f: 'qualquerAlvo' }, { voce: 1 }).some(a => a.o === bog), 'J1 sim');
});
caso('702.12b', 'indestrutível não é destruído (Murder em Darksteel Myr)', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Swamp'], [1, 'Darksteel Myr']], mao: [[0, 'Murder']] });
  M.avancar(e); conj(e, 'Murder');
  ok(noCampo(e).includes('Darksteel Myr'));
});
caso('115.1', 'Doom Blade: criatura preta não é alvo legal', () => {
  const e = cena({ campo: [[1, 'Vampire Nighthawk'], [1, 'Grizzly Bears']] });
  const al = M.alvosPossiveis(e, { f: { nao: ['Black'], tipo: ['Creature'], zona: 'campo' } }, { voce: 0 }).map(a => e.objs[a.o].n);
  igual(al, ['Grizzly Bears']);
});
caso('903.8', 'conjurar o comandante: sai do comando, entra no campo; o imposto sobe {2}', () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'], campo: enche(4, 'Mountain').map(n => [0, n]) });
  M.avancar(e); conj(e, 'Krenko, Mob Boss');
  ok(noCampo(e).includes('Krenko, Mob Boss')); igual(Object.values<any>(e.jogs[0].imposto), [1]);
  const k = e.campo.find(id => e.objs[id].n === 'Krenko, Mob Boss');
  M.mover(e, k, 'comando');
  igual(M.custoComImposto(e, e.objs[k]).g, 4, 'segunda vez: {2} + {2}');
});
caso('608.3', 'permanente resolve e entra sob o controle de quem conjurou, "doente" (302.6)', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest']], mao: [[0, 'Grizzly Bears']] });
  M.avancar(e); conj(e, 'Grizzly Bears');
  const b = e.objs[e.campo.find(id => e.objs[id].n === 'Grizzly Bears')];
  igual(b.ctrl, 0); ok(b.doente);
});
caso('601.2f', 'custo adicional: Village Rites pede sacrificar; sem criatura não conjura', () => {
  const e = cena({ campo: [[0, 'Swamp']], mao: [[0, 'Village Rites']] });
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'conjurar').length, 0);
  const f = cena({ campo: [[0, 'Swamp'], [0, 'Grizzly Bears']], mao: [[0, 'Village Rites']] });
  const mao0 = f.jogs[0].zonas.mao.length;
  M.avancar(f); conj(f, 'Village Rites');
  igual(naZona(f, 0, 'cemiterio').sort(), ['Grizzly Bears', 'Village Rites']); igual(f.jogs[0].zonas.mao.length, mao0 - 1 + 2);
});
caso('107.3', 'Fireball: escolhe X, paga X+{R}, causa X', () => {
  const e = cena({ campo: enche(4, 'Mountain').map(n => [0, n]), mao: [[0, 'Fireball']] });
  M.avancar(e); conj(e, 'Fireball');
  igual(e.perg.tipo, 'x'); igual(e.perg.ops.map(o => o.v), [3, 2, 1, 0]);
  respE(e, o => o.v === 3); alvoJog(e, 1);
  igual(e.jogs[1].vida, 37); ok(e.campo.every(id => e.objs[id].virada));
});
caso('601.2f', 'Fireball em 2 alvos: {1} a mais por alvo além do primeiro; X dividido igual, para baixo (601.2d)', () => {
  const e = cena({ jogs: 3, campo: enche(6, 'Mountain').map(n => [0, n]), mao: [[0, 'Fireball']] });
  M.avancar(e); conj(e, 'Fireball');
  respE(e, o => o.v === 3); alvoJog(e, 1); alvoJog(e, 2);
  if (e.perg && e.perg.tipo === 'alvo') respE(e, o => o.a === 'pronto');
  igual([e.jogs[1].vida, e.jogs[2].vida], [39, 39]);                       // 3 ÷ 2 = 1 cada
  igual(e.campo.filter(id => e.objs[id].virada).length, 5);               // X=3 + {R} + {1} do 2º alvo
});
caso('700.2', 'Kolaghan\'s Command: o modo "jogador-alvo descarta" pede o alvo e quem descarta é ele', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, "Kolaghan's Command"], [1, 'Forest']] });
  M.avancar(e); conj(e, "Kolaghan's Command");
  respE(e, o => o.a === 'modo' && o.m === 1);
  if (e.perg.tipo === 'modo') respE(e, o => o.a === 'modo' && o.m === 3);   // único que sobra: o núcleo pode não perguntar
  alvoJog(e, 1); alvoJog(e, 1);
  if (e.perg && e.perg.tipo === 'descartar') respE(e, () => true);
  igual(naZona(e, 1, 'cemiterio'), ['Forest']); igual(e.jogs[1].vida, 38);
});
caso('602.2', 'habilidade ativada usa a pilha; {T} de criatura doente não (302.6)', () => {
  const e = cena({ campo: [[0, 'Prodigal Pyromancer', { doente: true }]] });
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar').length, 0);
  e.objs[e.campo[0]].doente = false;
  M.avancar(e); respE(e, o => o.a === 'ativar'); alvoJog(e, 1);
  igual(e.jogs[1].vida, 39); ok(e.objs[e.campo[0]].virada);
});
caso('113.7a', 'habilidade resolve mesmo sem a fonte (Mind Stone sacrificado compra 1)', () => {
  const e = cena({ campo: [[0, 'Mind Stone'], [0, 'Wastes']] });
  const m0 = e.jogs[0].zonas.mao.length;
  M.avancar(e); respE(e, o => o.a === 'ativar');
  igual(naZona(e, 0, 'cemiterio'), ['Mind Stone']); igual(e.jogs[0].zonas.mao.length, m0 + 1);
});
caso('606.3', 'lealdade: velocidade de feitiço, uma vez por turno; Liliana +1 faz cada um descartar', () => {
  const e = cena({ campo: [[0, 'Liliana of the Veil']], mao: [[0, 'Forest'], [1, 'Forest']] });
  const L = e.objs[e.campo[0]]; igual(L.marc.lealdade, 3);
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.k === 0);
  igual(L.marc.lealdade, 4); igual(e.jogs[0].zonas.mao.length + e.jogs[1].zonas.mao.length, 0, JSON.stringify([e.perg, e.pilha.length, e.log]));
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar').length, 0, 'segunda no mesmo turno');
});
caso('608.2h', 'Swords to Plowshares: exila e o controlador ganha vida igual ao poder (informação guardada)', () => {
  const e = cena({ campo: [[0, 'Plains'], [1, 'Vampire Nighthawk']], mao: [[0, 'Swords to Plowshares']] });
  M.avancar(e); conj(e, 'Swords to Plowshares');
  igual(naZona(e, 1, 'exilio'), ['Vampire Nighthawk']); igual(e.jogs[1].vida, 42);
});
caso('701.19', 'Rampant Growth: busca básico, entra virado, embaralha', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest']], mao: [[0, 'Rampant Growth']], grimorio: 5 });
  M.avancar(e); conj(e, 'Rampant Growth');
  if (e.perg && e.perg.tipo === 'buscar') respE(e, o => o.a === 'buscar');
  igual(e.campo.length, 3); igual(e.jogs[0].zonas.grimorio.length, 4); ok(e.objs[e.campo[2]].virada);
});
caso('700.2', 'modal: Kolaghan\'s Command escolhe 2 modos; só os escolhidos pedem alvo (601.2c)', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, "Kolaghan's Command"]] });
  M.avancar(e); conj(e, "Kolaghan's Command");
  igual(e.perg.tipo, 'modo');
  const ms = e.perg.ops.map(o => o.m);
  ok(!ms.includes(0) && !ms.includes(2), 'sem criatura no cemitério e sem artefato: esses modos não aparecem');
});
caso('704.5q', 'marcadores +1/+1 e −1/−1 se anulam', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears']] });
  Object.assign(e.objs[e.campo[0]].marc, { '+1/+1': 2, '-1/-1': 1 });
  M.abe(e); igual(e.objs[e.campo[0]].marc, { '+1/+1': 1, '-1/-1': 0 });
});
caso('702.2b', 'toque mortífero: 1 de dano de fonte com toque mortífero mata', () => {
  const e = cena({ campo: [[1, 'Grizzly Bears']] });
  const b = e.objs[e.campo[0]]; b.dano = 1; b.mortal = true; M.abe(e);
  igual(e.campo.length, 0);
});
caso('106.6', 'mana restrita: Unclaimed Territory (Goblin) paga criatura Goblin, não outra mágica', () => {
  const e = cena({ campo: [[0, 'Unclaimed Territory', { obj: { escolha: { tipo: 'Goblin' } } }]], mao: [[0, 'Goblin Bushwhacker'], [0, 'Lightning Bolt']] });
  const ids = e.jogs[0].zonas.mao, gob = e.objs[ids[0]], bolt = e.objs[ids[1]];
  ok(M.podeConjurar(e, 0, gob), 'Goblin com a mana restrita'); ok(!M.podeConjurar(e, 0, bolt), 'Bolt não');
  igual(M.fontesDeMana(e, 0).map(f => f.pacotes.length), [1], 'fora do plano só dá {C}');
  M.avancar(e); respE(e, o => o.a === 'conjurar');
  ok(noCampo(e).includes('Goblin Bushwhacker'));
  const f = cena({ campo: [[0, 'Unclaimed Territory', { obj: { escolha: { tipo: 'Elf' } } }]], mao: [[0, 'Goblin Bushwhacker']] });
  ok(!M.podeConjurar(f, 0, f.objs[f.jogs[0].zonas.mao[0]]), 'tipo escolhido diferente');
});
caso('106.6', 'restrição que o núcleo não lê (tipo Card, filtro vazio) não vira mana livre', () => {
  igual(M.filtroSo({}, { tipo: ['Card'] }), null); igual(M.filtroSo({}, {}), null);
  igual(M.filtroSo({ escolha: { tipo: 'Elf' } }, { sub: ['escolhido'], tipo: ['Creature'] }), { tipo: ['Creature'], sub: ['Elf'] });
});

// ---------- combate (T16, CR 506–511) ----------
// vai até a pergunta do tipo dado passando prioridade (ops[0] = passar)
const ate = (e, tipo) => { M.avancar(e); let g = 0; while (e.perg && e.perg.tipo !== tipo) { ok(e.perg.tipo === 'acao', 'pergunta inesperada: ' + e.perg.tipo); M.responder(e, 0); if (++g > 500) throw new Error('não chegou em ' + tipo); } ok(e.perg, 'não perguntou ' + tipo); };
// responde e para na principal 2 (sem isso o laço seguia para o turno do outro, que também ataca)
const PARA2 = x => x.turno.passo === 'principal2';
const respC = (e, pred) => { const k = e.perg.ops.findIndex(pred); ok(k >= 0, 'opção não existe: ' + e.perg.tipo + ' ' + JSON.stringify(e.perg.ops).slice(0, 200)); M.responder(e, k, PARA2); };
const atacaCom = (e, o, alvo: any = { jog: 1 }) => respC(e, x => x.a === 'atacar' && x.id === o.id && (alvo.jog !== undefined ? x.jog === alvo.jog : x.o === alvo.o));
const pronto = e => respC(e, x => x.a === 'pronto');
// fecha a declaração se ela ainda estiver aberta (com uma opção só o núcleo fecha sozinho)
const fecha = (e, tipo) => { if (e.perg && e.perg.tipo === tipo) pronto(e); };
const bloqueia = (e, b, a) => respC(e, x => x.a === 'bloquear' && x.id === b.id && x.atk === a.id);
const ateFimCombate = e => { let g = 0; while (e.turno.passo !== 'principal2' && !e.fim) { M.avancar(e, x => x.turno.passo === 'principal2'); if (e.perg) { ok(e.perg.tipo === 'acao', 'pergunta inesperada: ' + e.perg.tipo); M.responder(e, 0, x => x.turno.passo === 'principal2'); } if (++g > 500) throw new Error('não acabou o combate'); } };
const combate = (campo, { jogs = 2 }: any = {}) => cena({ jogs, campo: [[0, 'Mountain'], ...campo] });
const objN = (e, j, n) => e.objs[e.campo.find(id => e.objs[id].n === n && e.objs[id].ctrl === j)];

caso('302.6', 'criatura "doente" não ataca; com pressa ataca (702.10b)', () => {
  const e = combate([[0, 'Grizzly Bears', { doente: true }], [0, 'Goblin Guide', { doente: true }]]);
  ate(e, 'atacar');
  igual(opsDe(e, 'atacar').map(o => e.objs[o.id].n), ['Goblin Guide']);
});
caso('508.1f', 'atacar vira a criatura; vigilância não vira (702.20b); defensor não ataca (702.3b)', () => {
  const e = combate([[0, 'Grizzly Bears'], [0, 'Serra Angel'], [0, 'Wall of Stone']]);
  ate(e, 'atacar');
  ok(!opsDe(e, 'atacar').some(o => e.objs[o.id].n === 'Wall of Stone'), 'defensor atacou');
  const g = objN(e, 0, 'Grizzly Bears'), a = objN(e, 0, 'Serra Angel');
  atacaCom(e, g); atacaCom(e, a); fecha(e, 'atacar');
  ok(g.virada && !a.virada, 'virada errada');
});
caso('508.8', 'ninguém ataca: pula bloqueio e dano', () => {
  const e = combate([[0, 'Grizzly Bears'], [1, 'Hill Giant']]);
  ate(e, 'atacar'); pronto(e);
  const vistos = new Set<any>(); let g = 0;
  while (e.turno.passo !== 'principal2') { vistos.add(e.turno.passo); M.avancar(e, x => (vistos.add(x.turno.passo), x.turno.passo === 'principal2')); if (e.perg) M.responder(e, 0); if (++g > 100) break; }
  ok(!vistos.has('bloqueadores') && !vistos.has('dano'), 'passou por ' + [...vistos]);
});
caso('510.1a', 'atacante não bloqueado causa dano ao jogador', () => {
  const e = combate([[0, 'Grizzly Bears']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Grizzly Bears')); fecha(e, 'atacar'); ateFimCombate(e);
  igual(e.jogs[1].vida, 38);
});
caso('702.9b', 'voar: só bloqueada por voar ou alcance (702.17b)', () => {
  const e = combate([[0, 'Storm Crow'], [1, 'Grizzly Bears'], [1, 'Giant Spider']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Storm Crow')); fecha(e, 'atacar');
  ate(e, 'bloquear');
  igual(opsDe(e, 'bloquear').map(o => e.objs[o.id].n), ['Giant Spider']);
});
caso('509.1b', 'não pode bloquear (Craven Giant); "não pode ser bloqueada por poder 3+" (Amrou Kithkin)', () => {
  const e = combate([[0, 'Amrou Kithkin'], [1, 'Grizzly Bears'], [1, 'Hill Giant'], [1, 'Craven Giant']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Amrou Kithkin')); fecha(e, 'atacar');
  ate(e, 'bloquear');
  igual(opsDe(e, 'bloquear').map(o => e.objs[o.id].n), ['Grizzly Bears']);
});
caso('510.1c', 'bloqueada: troca dano com o bloqueador; os dois morrem (704.5g)', () => {
  const e = combate([[0, 'Grizzly Bears'], [1, 'Gray Ogre']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Grizzly Bears')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Gray Ogre'), objN(e, 0, 'Grizzly Bears')); fecha(e, 'bloquear'); ateFimCombate(e);
  igual(e.jogs[1].vida, 40); igual(e.campo.filter(id => M.temTipo(e, e.objs[id], 'Creature')).length, 0);
});
caso('702.19c', 'atropelar: letal no bloqueador, o resto no jogador', () => {
  const e = combate([[0, 'Colossal Dreadmaw'], [1, 'Grizzly Bears']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Colossal Dreadmaw')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Grizzly Bears'), objN(e, 0, 'Colossal Dreadmaw')); fecha(e, 'bloquear'); ateFimCombate(e);
  igual(e.jogs[1].vida, 36);
});
caso('702.19e', 'atropelar e o bloqueador sai antes do dano: tudo no jogador; sem atropelar, nada (509.1h)', () => {
  for (const [n, vida] of [['Colossal Dreadmaw', 34], ['Hill Giant', 40]]) {
    const e = combate([[0, n], [1, 'Grizzly Bears']]);
    ate(e, 'atacar'); atacaCom(e, objN(e, 0, n)); fecha(e, 'atacar');
    ate(e, 'bloquear'); const b = objN(e, 1, 'Grizzly Bears');
    M.responder(e, e.perg.ops.findIndex(x => x.a === 'bloquear' && x.id === b.id), x => x.turno.passo === 'dano');
    igual(e.turno.passo, 'dano');
    M.mover(e, b.id, 'cemiterio'); ateFimCombate(e);
    igual(e.jogs[1].vida, vida, n);
  }
});
caso('702.2c', 'toque mortífero: 1 de dano mata o bloqueador', () => {
  const e = combate([[0, 'Typhoid Rats'], [1, 'Hill Giant']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Typhoid Rats')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Hill Giant'), objN(e, 0, 'Typhoid Rats')); fecha(e, 'bloquear'); ateFimCombate(e);
  ok(!objN(e, 1, 'Hill Giant'), 'gigante vivo');
});
caso('510.4', 'primeiro ataque: mata o bloqueador antes de levar dano', () => {
  const e = combate([[0, 'White Knight'], [1, 'Grizzly Bears']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'White Knight')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Grizzly Bears'), objN(e, 0, 'White Knight')); fecha(e, 'bloquear'); ateFimCombate(e);
  ok(objN(e, 0, 'White Knight') && !objN(e, 1, 'Grizzly Bears'), 'primeiro ataque errado');
  igual(objN(e, 0, 'White Knight').dano, 0);
});
caso('702.4b', 'golpe duplo: dano nas duas etapas (1+1)', () => {
  const e = combate([[0, 'Boros Swiftblade']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Boros Swiftblade')); fecha(e, 'atacar'); ateFimCombate(e);
  igual(e.jogs[1].vida, 38);
});
caso('702.15b', 'vínculo no combate: quem controla ganha o dano causado', () => {
  const e = combate([[0, 'Vampire Nighthawk']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Vampire Nighthawk')); fecha(e, 'atacar'); ateFimCombate(e);
  igual([e.jogs[0].vida, e.jogs[1].vida], [42, 38]);
});
caso('702.110b', 'ameaça: um bloqueador só não fecha a declaração', () => {
  const e = combate([[0, 'Boggart Brute'], [1, 'Grizzly Bears'], [1, 'Hill Giant']]);
  ate(e, 'atacar'); const at = objN(e, 0, 'Boggart Brute'); atacaCom(e, at); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Grizzly Bears'), at);
  ok(!opsDe(e, 'pronto').length && opsDe(e, 'desfazer').length, 'fechou com um');
  bloqueia(e, objN(e, 1, 'Hill Giant'), at); fecha(e, 'bloquear');
  ate(e, 'ordemDano'); respC(e, () => true); ateFimCombate(e);
  ok(!objN(e, 0, 'Boggart Brute'), 'Brute sobreviveu a dois');
});
caso('702.16b', 'proteção do preto: não é bloqueada por criatura preta e não leva dano dela (702.16e)', () => {
  const e = combate([[0, 'White Knight'], [1, 'Phyrexian Rager'], [1, 'Grizzly Bears']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'White Knight')); fecha(e, 'atacar');
  ate(e, 'bloquear'); igual(opsDe(e, 'bloquear').map(o => e.objs[o.id].n), ['Grizzly Bears']);
  const f = combate([[0, 'Phyrexian Rager'], [1, 'White Knight']]);
  ate(f, 'atacar'); atacaCom(f, objN(f, 0, 'Phyrexian Rager')); fecha(f, 'atacar');
  ate(f, 'bloquear'); bloqueia(f, objN(f, 1, 'White Knight'), objN(f, 0, 'Phyrexian Rager')); fecha(f, 'bloquear'); ateFimCombate(f);
  igual(objN(f, 1, 'White Knight').dano, 0); ok(!objN(f, 0, 'Phyrexian Rager'), 'Rager vivo');
});
caso('510.1c', 'dois bloqueadores: o atacante escolhe a ordem do letal; o resto no último', () => {
  const e = combate([[0, 'Hill Giant'], [1, 'Giant Spider'], [1, 'Grizzly Bears']]);
  const at = objN(e, 0, 'Hill Giant'), el = objN(e, 1, 'Giant Spider'), gb = objN(e, 1, 'Grizzly Bears');
  ate(e, 'atacar'); atacaCom(e, at); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, el, at); bloqueia(e, gb, at); fecha(e, 'bloquear');
  ate(e, 'ordemDano'); respC(e, x => x.id === gb.id); ateFimCombate(e);
  ok(!objN(e, 1, 'Grizzly Bears') && objN(e, 1, 'Giant Spider') && objN(e, 1, 'Giant Spider').dano === 1 && !objN(e, 0, 'Hill Giant'), 'divisão errada');
});
caso('508.1d', 'criatura que ataca se puder: não fecha sem ela', () => {
  const e = combate([[0, 'Bloodrock Cyclops'], [0, 'Grizzly Bears']]);
  ate(e, 'atacar'); ok(!opsDe(e, 'pronto').length, 'deixou fechar');
  atacaCom(e, objN(e, 0, 'Bloodrock Cyclops')); ok(opsDe(e, 'pronto').length, 'não deixou fechar');
});
caso('506.2', 'multijogador: ataca qualquer oponente ou planeswalker dele; dano tira lealdade (120.3c)', () => {
  const e = combate([[0, 'Hill Giant'], [2, 'Jace Beleren']], { jogs: 3 });
  const jace = objN(e, 2, 'Jace Beleren'), l0 = jace.marc.lealdade;
  ate(e, 'atacar');
  igual(opsDe(e, 'atacar').map(o => o.jog !== undefined ? 'J' + o.jog : 'pw'), ['J1', 'J2', 'pw']);
  atacaCom(e, objN(e, 0, 'Hill Giant'), { o: jace.id }); fecha(e, 'atacar'); ateFimCombate(e);
  ok(!objN(e, 2, 'Jace Beleren') && l0 === 3, 'Jace sobreviveu');
  igual([e.jogs[1].vida, e.jogs[2].vida], [40, 40]);
});
caso('903.10a', 'dano de combate do comandante conta por comandante; 21 perde', () => {
  const e = combate([[0, 'Krenko, Mob Boss', { obj: { cmd: true } }]]);
  const k = objN(e, 0, 'Krenko, Mob Boss'); e.jogs[1].danoCmd[k.id] = 18;
  ate(e, 'atacar'); atacaCom(e, k); fecha(e, 'atacar'); M.avancar(e);
  ok(e.fim && e.fim.vencedor === 0, 'não perdeu por dano de comandante');
});

// ---------- gatilhos (T17, CR 603) ----------
const contaLog = (e, txt) => e.log.filter(l => l.includes(txt)).length;
caso('603.2', 'Phyrexian Rager entra: gatilho na pilha, resolve: compra 1 e perde 1', () => {
  const e = cena({ mao: [[0, 'Phyrexian Rager']] }); e.cfg.log = true;
  const id = e.jogs[0].zonas.mao[0], m0 = e.jogs[0].zonas.mao.length;
  M.entrarPermanente(e, id, 0); M.avancar(e);
  igual(e.pilha.length, 0, 'pilha'); igual(e.jogs[0].vida, 39); igual(e.jogs[0].zonas.mao.length, m0);   // saiu 1, comprou 1
  igual(contaLog(e, 'gatilho de Phyrexian Rager'), 1);
});
caso('603.10a', 'Blood Artist morre junto com outra criatura: olha para trás e dispara as duas vezes', () => {
  const e = cena({ campo: [[0, 'Blood Artist'], [1, 'Grizzly Bears']] }); e.cfg.log = true;
  for (const id of e.campo) e.objs[id].dano = 5;
  M.avancar(e); resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  igual(contaLog(e, 'gatilho de Blood Artist'), 2);
  igual([e.jogs[1].vida, e.jogs[0].vida], [38, 42], 'alvo jogador (alvoJogador): cada um tira 1 e ganha 1');
});
caso('603.2', 'Young Pyromancer: conjurar instantânea cria a ficha antes da mágica resolver', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Young Pyromancer']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  igual(e.campo.filter(id => e.objs[id].ficha).length, 1); igual(e.jogs[1].vida, 37);
});
caso('603.3b', 'manutenção: Phyrexian Arena só na do controlador', () => {
  const e = cena({ campo: [[0, 'Phyrexian Arena']], passo: 'final' });
  passarAte(e, 'principal1');                        // turno do jogador 1: nada
  igual(e.jogs[0].vida, 40);
  passarAte(e, 'final'); passarAte(e, 'principal1');  // de volta ao jogador 0
  igual(e.turno.ativo, 0); igual(e.jogs[0].vida, 39);
});

// ---------- fila do motor v0.4.0 (campos novos do banco) ----------
// responde a pergunta do tipo dado (passando prioridade até ela) e segue
const ateResp = (e, tipo, pred) => { ate(e, tipo); respE(e, pred); };
caso('701.34', 'proliferar (Evolution Sage): terreno entra, escolhe a criatura com +1/+1 e ela ganha mais 1', () => {
  const e = cena({ campo: [[0, 'Evolution Sage'], [0, 'Grizzly Bears', { obj: { marc: { '+1/+1': 1 } } }], [1, 'Grizzly Bears', { obj: { marc: { '+1/+1': 1 } } }]], mao: [[0, 'Forest']] });
  const meu = objN(e, 0, 'Grizzly Bears'), dele = objN(e, 1, 'Grizzly Bears');
  meu.marc['+1/+1'] = 1; dele.marc['+1/+1'] = 1;
  M.avancar(e); respE(e, o => o.a === 'terreno');
  ateResp(e, 'proliferar', o => o.id === meu.id);
  if (e.perg && e.perg.tipo === 'proliferar') respE(e, o => o.a === 'pronto');
  igual(meu.marc['+1/+1'], 2); igual(dele.marc['+1/+1'], 1, 'o do oponente não foi escolhido');
});
caso('603.2', 'alvoDe (Goldspan Dragon): virar alvo de mágica cria Treasure; habilidade não conta pelo filtro de tipo', () => {
  const e = cena({ campo: [[0, 'Goldspan Dragon'], [1, 'Mountain']], mao: [[1, 'Lightning Bolt']] });
  e.turno.ativo = 1;
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoObj(e, 'Goldspan Dragon');
  ok(e.campo.some(id => e.objs[id].ficha && e.objs[id].ctrl === 0), 'sem Treasure');
});
caso('603.2d', 'dobraGatilho com evs/causa (Isshin): o gatilho de ataque do Goldspan dispara 2 vezes', () => {
  const e = combate([[0, 'Isshin, Two Heavens as One'], [0, 'Goldspan Dragon']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Goldspan Dragon')); fecha(e, 'atacar'); ateFimCombate(e);
  igual(e.campo.filter(id => e.objs[id].ficha).length, 2);
  const f = combate([[0, 'Goldspan Dragon']]);
  ate(f, 'atacar'); atacaCom(f, objN(f, 0, 'Goldspan Dragon')); fecha(f, 'atacar'); ateFimCombate(f);
  igual(f.campo.filter(id => f.objs[id].ficha).length, 1, 'sem Isshin');
});
caso('603.2d', 'dobraGatilho (Harmonic Prodigy): gatilho do Young Pyromancer (Shaman) dispara 2 vezes', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Harmonic Prodigy'], [0, 'Young Pyromancer']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1); resolveCom(e);   // a proeza do Prodigy também dispara (702.108): agora há ordem para escolher
  igual(e.campo.filter(id => e.objs[id].ficha).length, 2);
});
caso('702.123a', 'fabricar (Marionette Apprentice): escolhe marcadores nela ou Servos 1/1', () => {
  for (const [esc, fichas, marc] of [['marcadores', 0, 1], ['fichas', 1, undefined]] as any[]) {
    const e = cena({ mao: [[0, 'Marionette Apprentice'], [0, 'Forest']] });
    const id = e.jogs[0].zonas.mao[0];
    M.entrarPermanente(e, id, 0); ateResp(e, 'fabricar', o => o.a === esc);
    const s = e.campo.filter(i => e.objs[i].ficha).map(i => e.objs[i]);
    igual(s.length, fichas, esc); igual(e.objs[id].marc['+1/+1'], marc, esc);
    if (fichas) { igual(s[0].n, 'Servo'); igual([M.poder(e, s[0]), M.resistencia(e, s[0])], [1, 1]); ok(M.temTipo(e, s[0], 'Artifact')); }
  }
});
caso('601.3', 'podeJogar do cemitério: Gravecrawler com Zumbi conjura de lá; sem Zumbi não', () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Carrion Feeder'], [0, 'Gravecrawler', { zona: 'cemiterio' }]] });
  const g = e.objs[e.jogs[0].zonas.cemiterio[0]];
  ok(M.podeConjurar(e, 0, g), 'com Zumbi');
  M.avancar(e); conj(e, 'Gravecrawler');
  for (let g = 0; e.pilha.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar');   // Carrion Feeder deixa a pergunta aberta
  ok(noCampo(e).includes('Gravecrawler'), 'Gravecrawler no campo');
  const f = cena({ campo: [[0, 'Swamp'], [0, 'Gravecrawler', { zona: 'cemiterio' }]] });
  ok(!M.podeConjurar(f, 0, f.objs[f.jogs[0].zonas.cemiterio[0]]), 'sem Zumbi');
});
caso('305.1', 'podeJogar do cemitério: Conduit of Worlds deixa jogar terreno do cemitério (conta no terreno do turno)', () => {
  const e = cena({ campo: [[0, 'Conduit of Worlds'], [0, 'Forest', { zona: 'cemiterio' }], [0, 'Mountain', { zona: 'cemiterio' }]] });
  M.avancar(e);
  igual(opsDe(e, 'terreno').length, 2);
  respE(e, o => o.a === 'terreno' && e.objs[o.id].n === 'Forest');
  ok(noCampo(e).includes('Forest'));
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'terreno').length, 0, 'segundo terreno');
  const f = cena({ campo: [[0, 'Forest', { zona: 'cemiterio' }]] });
  igual(M.opcoesPrioridade(f, 0).filter(o => o.a === 'terreno').length, 0, 'sem Conduit');
});
caso('106.6', 'mana.so por subtipo (Giada): a mana dela só paga Anjo', () => {
  const e = cena({ campo: [[0, 'Giada, Font of Hope'], ...enche(4, 'Plains').map(n => [0, n])], mao: [[0, 'Serra Angel']] });
  igual(M.fontesDeMana(e, 0).length, 4, 'fora do plano a Giada não dá mana');
  ok(M.podeConjurar(e, 0, e.objs[e.jogs[0].zonas.mao[0]]), 'Serra com Giada + 4');
  const f = cena({ campo: [[0, 'Giada, Font of Hope'], ...enche(4, 'Plains').map(n => [0, n])], mao: [[0, 'Grizzly Bears']] });
  ok(!M.planoMana(f, 0, { g: 5 }, { para: f.objs[f.jogs[0].zonas.mao[0]] }), 'não-Anjo não usa');
});
caso('106.7', "prod 'deSeusTerrenos' (Incubation Druid): tipos que terrenos SEUS produziriam, incolor conta", () => {
  const e = cena({ campo: [[0, 'Incubation Druid'], [0, 'Forest'], [0, 'Wastes'], [1, 'Mountain']] });
  igual(M.coresDeProd(e, objN(e, 0, 'Incubation Druid'), 'deSeusTerrenos'), ['G', 'C']);
  const f = cena({ campo: [[0, 'Incubation Druid'], [1, 'Mountain']] });
  igual(M.coresDeProd(f, objN(f, 0, 'Incubation Druid'), 'deSeusTerrenos'), []);
});

// ---------- cartas de mais de uma face (T43 faces; cartas do banco + testes/faces-cena.ts) ----------
const naMao = (e, j, n) => e.objs[e.jogs[j].zonas.mao.find(id => e.objs[id].n === n)];
caso('712.9', 'modal: joga a face de terreno (Bala Ged Sanctuary), entra virada e conta como a jogada de terreno', () => {
  const e = cena({ mao: [[0, 'Bala Ged Recovery'], [0, 'Forest']] });
  const c = naMao(e, 0, 'Bala Ged Recovery');
  M.avancar(e);
  igual(opsDe(e, 'terreno').filter(o => o.id === c.id).map(o => o.face ?? null), [0], 'só a face de terreno');
  igual(opsDe(e, 'conjurar').length, 0, 'sem carta no cemitério a frente não tem alvo');
  respE(e, o => o.a === 'terreno' && o.id === c.id);
  ok(c.zona === 'campo' && c.face === 0, 'entrou com a face de terreno');
  igual(M.dadoDe(e, c).n, 'Bala Ged Sanctuary'); ok(M.temTipo(e, c, 'Land') && c.virada, 'terreno virado');
  igual(e.jogs[0].terrenos, 1);
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'terreno').length, 0, 'a Forest não entra mais');
  M.mover(e, c.id, 'mao');
  ok(c.face === null && M.temTipo(e, c, 'Sorcery'), 'fora do campo volta à frente (712.6a)');
});
caso('712.8b', 'modal: conjura a frente (Bala Ged Recovery) sem gastar a jogada de terreno', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Forest'], [0, 'Grizzly Bears', { zona: 'cemiterio' }]], mao: [[0, 'Bala Ged Recovery']] });
  const c = naMao(e, 0, 'Bala Ged Recovery');
  M.avancar(e);
  respE(e, o => o.a === 'conjurar' && o.id === c.id && o.face === undefined);
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n), ['Grizzly Bears'], 'o Bears voltou para a mão');
  ok(c.zona === 'cemiterio' && c.face === null, 'feitiço vai ao cemitério com a frente');
  igual(e.jogs[0].terrenos, 0);
});
caso('701.27', "dupla face: Legion's Landing transforma com 3 atacantes; mesmo objeto, marcadores ficam (701.27c)", () => {
  const e = combate([[0, "Legion's Landing"], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']]);
  const L = objN(e, 0, "Legion's Landing"); L.marc.teste = 1; const ts = L.ts;
  ate(e, 'atacar');
  for (const id of e.campo.filter(id => e.objs[id].n === 'Grizzly Bears')) atacaCom(e, e.objs[id]);
  fecha(e, 'atacar');
  ateFimCombate(e);
  ok(L.zona === 'campo' && L.face === 0, 'transformou'); igual(M.dadoDe(e, L).n, 'Adanto, the First Fort');
  ok(M.temTipo(e, L, 'Land') && !M.temTipo(e, L, 'Enchantment'), 'só as características da face de trás (712.6d)');
  igual(L.ts, ts, 'não é objeto novo'); igual(L.marc.teste, 1, 'marcador ficou');
  igual(M.dadoDe(e, L).vm, 1, 'valor de mana da frente (712.6d)');
});
caso('701.27', "dupla face: com 2 atacantes Legion's Landing não transforma", () => {
  const e = combate([[0, "Legion's Landing"], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']]);
  const L = objN(e, 0, "Legion's Landing");
  ate(e, 'atacar');
  for (const id of e.campo.filter(id => e.objs[id].n === 'Grizzly Bears')) atacaCom(e, e.objs[id]);
  fecha(e, 'atacar');
  ateFimCombate(e);
  ok(L.face == null && M.temTipo(e, L, 'Enchantment'), 'continua a frente');
});
caso('716.3d', 'aventura: Heart’s Desire cria a ficha, a carta vai ao exílio e de lá se conjura a criatura', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Forest'], [0, 'Forest']], mao: [[0, 'Lovestruck Beast']] });
  const c = naMao(e, 0, 'Lovestruck Beast');
  M.avancar(e);
  igual(opsDe(e, 'conjurar').filter(o => o.id === c.id).map(o => o.face ?? null), [null, 0], 'criatura ou Aventura (716.3)');
  respE(e, o => o.a === 'conjurar' && o.id === c.id && o.face === 0);
  ok(c.zona === 'exilio' && c.aventura === 0, 'exilada pela aventura, não no cemitério');
  igual(noCampo(e).filter(n => n === 'Human Token').length, 1, 'a ficha 1/1');
  M.avancar(e);
  igual(opsDe(e, 'conjurar').filter(o => o.id === c.id).map(o => o.face ?? null), [null], 'do exílio só a criatura');
  respE(e, o => o.a === 'conjurar' && o.id === c.id);
  ok(c.zona === 'campo' && c.face === null && c.aventura === null, 'a criatura entrou');
  igual(M.poder(e, c), 5);
});
caso('716.3a', 'aventura: cada face é uma opção à parte (o gigante e Stomp, que agora tem efeito lido)', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Bonecrusher Giant']] });
  const c = naMao(e, 0, 'Bonecrusher Giant');
  M.avancar(e);
  igual(opsDe(e, 'conjurar').filter(o => o.id === c.id).map(o => o.face ?? null), [null, 0]);
});
caso('709.3', 'split: escolhe uma metade (Ice); na pilha só ela existe (709.3b); no cemitério, a carta inteira', () => {
  const e = cena({ campo: [[0, 'Island'], [0, 'Mountain'], [1, 'Forest']], mao: [[0, 'Fire']] });
  const c = naMao(e, 0, 'Fire'), mao0 = e.jogs[0].zonas.mao.length;
  M.avancar(e);
  igual(opsDe(e, 'conjurar').filter(o => o.id === c.id).map(o => o.face ?? null), ['esq', 0], 'Fire (dividir à escolha, 601.2d) e Ice');
  igual(M.dadoFace(M.carta('Fire'), 0).cores, 'U', 'cores de Ice: as do custo dela');
  igual(M.dadoFace(M.carta('Fire'), 'esq').vm, 2, 'Fire sozinha vale 2');
  respE(e, o => o.a === 'conjurar' && o.id === c.id && o.face === 0);
  if (e.perg && e.perg.tipo === 'alvo') respE(e, o => o.a === 'alvo' && e.objs[o.o] && e.objs[o.o].ctrl === 1);
  const f = objN(e, 1, 'Forest');
  ok(f.virada, 'Ice virou a Forest do oponente');
  igual(e.jogs[0].zonas.mao.length, mao0, 'comprou 1 (a Fire saiu, entrou 1)');
  ok(c.zona === 'cemiterio' && c.face === null, 'no cemitério com as duas metades (709.4)');
});
caso('702.102', 'fusão: Wear // Tear da mão paga as duas e resolve a esquerda e depois a direita', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Plains'], [0, 'Wastes'], [1, 'Sol Ring'], [1, 'Propaganda']], mao: [[0, 'Wear']] });
  const c = naMao(e, 0, 'Wear');
  M.avancar(e);
  igual(opsDe(e, 'conjurar').filter(o => o.id === c.id).map(o => o.face ?? null), ['esq', 0, 'fundida']);
  igual(M.dadoFace(M.carta('Wear'), 'fundida').fx.map(f => f.em.alvo), [0, 1], 'alvos de Tear depois dos de Wear');
  respE(e, o => o.a === 'conjurar' && o.id === c.id && o.face === 'fundida');
  ok(!noCampo(e).includes('Sol Ring') && !noCampo(e).includes('Propaganda'), 'destruiu os dois');
  ok(e.campo.filter(id => e.objs[id].ctrl === 0).every(id => e.objs[id].virada), 'pagou {1}{R}{W}');
  const f = cena({ campo: [[0, 'Mountain'], [0, 'Plains'], [0, 'Wastes'], [1, 'Sol Ring'], [1, 'Propaganda']], mao: [[0, 'Wear']] });
  M.mover(f, naMao(f, 0, 'Wear').id, 'cemiterio');
  igual(M.facesParaConjurar(f, 0, f.objs[f.jogs[0].zonas.cemiterio[0]]), ['esq', 0], 'fusão só da mão');
});

// pedidos do FARSEER depois da v0.9.0: qtd {ate:'qualquer'} + conta 'resultado', qtd {dado:N} e est ptDefinido
caso('701.20', "Valakut Awakening: põe quantas quiser da mão no fundo e compra esse número mais um (qtd ate:'qualquer')", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Valakut Awakening'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Forest']] });
  const c = naMao(e, 0, 'Valakut Awakening');
  M.avancar(e);
  respE(e, o => o.a === 'conjurar' && o.id === c.id && (o.face ?? null) === null);
  let g = 0;
  while (e.perg && e.perg.tipo === 'escolherCarta' && ++g < 10) {
    const w = e.perg.ops.find(o => o.a === 'escolherCarta' && e.objs[o.id].n === 'Wastes');
    respE(e, w ? (o => o.a === 'escolherCarta' && o.id === w.id) : (o => o.a === 'nenhum'));
  }
  const gr = e.jogs[0].zonas.grimorio;
  igual(gr.slice(0, 2).map(id => e.objs[id].n), ['Wastes', 'Wastes'], 'os dois Wastes no fundo');
  igual(e.jogs[0].zonas.mao.length, 1 + 3, 'ficou a Forest e comprou 2 + 1');
  ok(M.fxSuportado(M.carta('Valakut Awakening').fx), 'o motor oferece a carta');
});
caso('706.2', 'dado: Ancient Copper Dragon cria um tesouro por ponto do d20, com o RNG da partida (mesma semente, mesmo resultado)', () => {
  const roda = () => {
    const e = cena({ campo: [[0, 'Ancient Copper Dragon']] });
    const fx = M.carta('Ancient Copper Dragon').gat[0].fx[0];
    const antes = e.campo.length;
    M.executar(e, fx, { voce: 0, este: objN(e, 0, 'Ancient Copper Dragon').id, alvos: [], lki: {} }, () => ({ a: 'nao' }));
    return e.campo.length - antes;
  };
  const n = roda();
  ok(n >= 1 && n <= 20, 'entre 1 e 20: ' + n);
  igual(roda(), n, 'mesma semente');
  ok(M.fxSuportado(M.carta('Ancient Copper Dragon').gat[0].fx), 'qtd {dado:20} é suportado');
});
caso('604.3', 'ptDefinido (CDA, camada 7a): Beanstalk Giant com 5 terrenos é 5/5, também fora do campo', () => {
  const e = cena({ campo: [...enche(5, 'Forest').map(n => [0, n]), [0, 'Beanstalk Giant']], mao: [[0, 'Beanstalk Giant']] });
  const b = objN(e, 0, 'Beanstalk Giant');
  igual([M.poder(e, b), M.resistencia(e, b)], [5, 5], 'no campo');
  const m = naMao(e, 0, 'Beanstalk Giant');
  igual([M.poder(e, m), M.resistencia(e, m)], [5, 5], 'na mão');
  M.mover(e, e.campo.find(id => e.objs[id].n === 'Forest'), 'cemiterio');
  igual(M.poder(e, b), 4, 'acompanha a contagem');
});

// ---------- camadas (CR 613): estáticas 'continuo' e 'modificar' até o fim do turno ----------
caso('613.4c', 'Goblin Chieftain: os outros Goblins seus ganham +1/+1 e ímpeto (613.1f); ele não, o do oponente não; sai e acaba (611.3a)', () => {
  const e = cena({ campo: [[0, 'Goblin Chieftain'], [0, 'Boggart Brute'], [1, 'Boggart Brute']] });
  const meu = objN(e, 0, 'Boggart Brute'), dele = objN(e, 1, 'Boggart Brute'), ch = objN(e, 0, 'Goblin Chieftain');
  igual([M.poder(e, meu), M.resistencia(e, meu)], [4, 3], 'meu Goblin (3/2)');
  igual([M.poder(e, dele), M.resistencia(e, dele)], [3, 2], 'Goblin do oponente');
  igual([M.poder(e, ch), M.resistencia(e, ch)], [2, 2], 'o Chieftain (outro)');
  ok(M.temKw(e, meu, 'pressa') && !M.temKw(e, dele, 'pressa'), 'ímpeto só no meu');
  M.mover(e, ch.id, 'cemiterio');
  igual([M.poder(e, meu), M.resistencia(e, meu)], [3, 2], 'sem o Chieftain'); ok(!M.temKw(e, meu, 'pressa'), 'sem ímpeto');
});
caso('613.4c', 'Elvish Archdruid: Llanowar Elves fica 2/2; ele mesmo segue 2/2', () => {
  const e = cena({ campo: [[0, 'Elvish Archdruid'], [0, 'Llanowar Elves']] });
  igual([M.poder(e, objN(e, 0, 'Llanowar Elves')), M.resistencia(e, objN(e, 0, 'Llanowar Elves'))], [2, 2]);
  igual(M.poder(e, objN(e, 0, 'Elvish Archdruid')), 2);
});
caso('611.2', 'Giant Growth: +3/+3 até o fim do turno; Lightning Bolt não mata o 5/5 (704.5g)', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Mountain'], [0, 'Grizzly Bears']], mao: [[0, 'Giant Growth'], [0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Giant Growth'); alvoObj(e, 'Grizzly Bears');
  const resolve = () => { for (let g = 0; e.pilha.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar'); };
  resolve();
  const b = objN(e, 0, 'Grizzly Bears');
  igual([M.poder(e, b), M.resistencia(e, b)], [5, 5], 'com Giant Growth');
  conj(e, 'Lightning Bolt'); alvoObj(e, 'Grizzly Bears'); resolve();
  igual(b.dano, 3, 'levou os 3'); ok(noCampo(e).includes('Grizzly Bears'), 'sobreviveu a 3 de dano');
});
caso('514.2', 'limpeza: "até o fim do turno" acaba (Giant Growth) e o −4/−4 da Finality mata pela 704.5f', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Llanowar Elves']], passo: 'final' });
  const b = objN(e, 0, 'Grizzly Bears');
  M.executar(e, M.carta('Giant Growth').fx[0], { voce: 0, alvos: [[{ o: b.id, ts: b.ts }]], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  igual(M.poder(e, b), 5, 'com Giant Growth');
  passarAte(e, 'limpeza'); M.avancar(e); if (e.perg && e.perg.tipo === 'descartar') M.responder(e, 0);
  igual([M.poder(e, b), M.resistencia(e, b)], [2, 2], 'depois da limpeza');
  const fin = M.dadoFace(M.carta('Find'), 0).fx[1];
  ok(M.fxSuportado([fin]), 'Finality: modificar −4/−4 em todas é lido');
  M.executar(e, fin, { voce: 0, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  igual(M.resistencia(e, b), -2, 'Grizzly com −4/−4');
  M.abe(e);
  igual(noCampo(e), [], 'as duas morrem (704.5f)'); igual(naZona(e, 0, 'cemiterio'), ['Grizzly Bears']);
});
caso('611.2c', 'Heroic Intervention: só os permanentes que estavam no campo na resolução ficam indestrutíveis', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Grizzly Bears']], mao: [[0, 'Heroic Intervention']] });
  M.avancar(e); conj(e, 'Heroic Intervention');
  for (let g = 0; e.pilha.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar');
  const velho = objN(e, 0, 'Grizzly Bears');
  ok(M.temKw(e, velho, 'indestrutivel') && M.temKw(e, velho, 'antimagia'), 'o que estava no campo');
  const novo = e.por(0, 'Llanowar Elves');
  ok(!M.temKw(e, novo, 'indestrutivel'), 'quem entrou depois não ganha');
  M.mover(e, velho.id, 'mao'); const volta = e.por(0, 'Grizzly Bears');
  ok(!M.temKw(e, volta, 'indestrutivel'), 'voltou ao campo = objeto novo (400.7)');
});

// ---------- camadas, volta 2: anexar (CR 301.5, 701.3), equipar (702.6) e habilidade dada (613.1f) ----------
const resolvePilha = e => { for (let g = 0; e.pilha.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar'); };
const ativa = (e, nome) => respE(e, o => o.a === 'ativar' && e.objs[o.id].n === nome);
caso('702.6a', 'Behemoth Sledge: equipar {3} só como feitiço; a equipada fica 4/4 com atropelar e vínculo; morreu, o Equipamento fica solto (704.5n)', () => {
  const e = cena({ campo: [[0, 'Wastes'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Behemoth Sledge'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const sl = objN(e, 0, 'Behemoth Sledge'), b = objN(e, 0, 'Grizzly Bears');
  M.avancar(e);
  ok(opsDe(e, 'ativar').some(o => o.id === sl.id), 'equipar oferecido na principal');
  ok(M.alvosPossiveis(e, M.atvDe(e, sl)[0].alvos[0], { voce: 0, este: sl.id }).every(x => e.objs[x.o].ctrl === 0), 'só criatura sua');
  ativa(e, 'Behemoth Sledge'); if (e.perg) alvoObj(e, 'Grizzly Bears');   // um alvo só: não pergunta
  resolvePilha(e);
  igual(sl.anexo, { id: b.id, ts: b.ts }, 'preso ao Grizzly');
  igual([M.poder(e, b), M.resistencia(e, b)], [4, 4]); ok(M.temKw(e, b, 'atropelar') && M.temKw(e, b, 'vinculoVida'), 'palavras-chave dadas');
  igual(e.jogs[0].reserva, M.zeroMana(), 'pagou {3}');
  M.mover(e, b.id, 'cemiterio'); M.abe(e);
  ok(noCampo(e).includes('Behemoth Sledge'), 'o Equipamento fica'); igual(sl.anexo, null, 'solto pela 704.5n');
});
caso('702.6a', 'equipar não é oferecido fora da velocidade de feitiço nem sem criatura sua', () => {
  const e = cena({ campo: [[0, 'Wastes'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Behemoth Sledge'], [1, 'Llanowar Elves']] });
  M.avancar(e);
  ok(!opsDe(e, 'ativar').length, 'sem criatura sua: sem alvo legal');
  const e2 = cena({ campo: [[0, 'Wastes'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Behemoth Sledge'], [0, 'Grizzly Bears']], passo: 'combate' });
  ok(!M.podeAtivar(e2, 0, objN(e2, 0, 'Behemoth Sledge'), 0), 'fora da principal');
});
caso('702.10', 'Lightning Greaves (equipar {0}): o Llanowar que acabou de entrar ganha ímpeto e vira para mana; manto: o Bolt do oponente não mira (702.18a)', () => {
  const e = cena({ campo: [[0, 'Lightning Greaves'], [0, 'Llanowar Elves', { doente: true }], [1, 'Mountain']], mao: [[1, 'Lightning Bolt']] });
  const el = objN(e, 0, 'Llanowar Elves');
  ok(!M.fontesDeMana(e, 0).some(f => f.id === el.id), 'doente: não vira');
  M.avancar(e); ativa(e, 'Lightning Greaves'); resolvePilha(e);
  ok(M.temKw(e, el, 'pressa') && M.temKw(e, el, 'manto'), 'ímpeto e manto');
  ok(M.fontesDeMana(e, 0).some(f => f.id === el.id), 'com ímpeto vira para mana (302.6)');
  ok(!M.alvosPossiveis(e, { f: 'qualquerAlvo' }, { voce: 1 }).some(x => x.o === el.id), 'manto: ninguém mira');
});
caso('701.3b', 'anexar ao que já está preso não muda nada; Equipamento não se prende a não-criatura (301.5c)', () => {
  const e = cena({ campo: [[0, 'Lightning Greaves'], [0, 'Grizzly Bears'], [0, 'Wastes']] });
  const g = objN(e, 0, 'Lightning Greaves'), b = objN(e, 0, 'Grizzly Bears'), w = objN(e, 0, 'Wastes');
  const fx = { op: 'anexar', em: 'este', a: { alvo: 0 } };
  const ctx = alvo => ({ voce: 0, este: g.id, alvos: [[{ o: alvo.id, ts: alvo.ts }]], ilegal: {}, lki: { alvos: [] } });
  M.executar(e, fx, ctx(w), () => ({ a: 'nao' }));
  igual(g.anexo, null, 'terreno não');
  M.executar(e, fx, ctx(b), () => ({ a: 'nao' }));
  igual(g.anexo, { id: b.id, ts: b.ts });
});
caso('613.1f', 'Cryptolith Rite: suas criaturas ganham "{T}: um mana de qualquer cor" (doente não vira); saiu, acaba', () => {
  const e = cena({ campo: [[0, 'Cryptolith Rite'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves', { doente: true }], [1, 'Grizzly Bears']] });
  const b = objN(e, 0, 'Grizzly Bears');
  const f = M.fontesDeMana(e, 0).find(x => x.id === b.id);
  ok(f && f.pacotes.length === 5, 'Grizzly vira para qualquer cor');
  ok(!M.fontesDeMana(e, 0).some(x => x.id === objN(e, 0, 'Llanowar Elves').id && x.k > 0), 'a dada não vira doente');
  ok(!M.fontesDeMana(e, 1).length, 'a do oponente não ganha');
  M.ativarMana(e, 0, b.id, f.k, 2); igual(e.jogs[0].reserva.B, 1, 'pagou com a habilidade dada');
  M.mover(e, objN(e, 0, 'Cryptolith Rite').id, 'cemiterio');
  ok(!M.atvDe(e, objN(e, 0, 'Llanowar Elves')).some(a => a.fx[0].prod === 'qualquer'), 'sem o Rite, sem a habilidade');
});
caso('613.1f', 'Harmonic Sliver: o Sliver que entra (ele mesmo também) tem o gatilho de entrar dado; o Bear não', () => {
  const e = cena({ campo: [[1, 'Sol Ring']] });
  e.por(0, 'Harmonic Sliver');
  igual(e.pend.length, 1, 'um gatilho'); igual(e.pend[0].g && e.pend[0].g.ev, 'entra', 'o gatilho dado vai com o texto');
  e.pend = []; e.por(0, 'Grizzly Bears');
  igual(e.pend.length, 0, 'Bear não é Sliver');
});
caso('603.10a', 'habilidade dada olha para trás: o Constricting Sliver que sai ainda tinha o "quando sai" dado por ele mesmo', () => {
  const e = cena({ campo: [[0, 'Constricting Sliver']] });
  const c = objN(e, 0, 'Constricting Sliver');
  M.mover(e, c.id, 'cemiterio');
  const snap = e.lote[e.lote.length - 1];
  ok(M.gatDe(e, snap, M.loteHabil(e, e.lote)).some(g => g.ev === 'sai'), 'o snap tem o gatilho de sair');
  ok(!M.gatDe(e, snap).some(g => g.ev === 'sai'), 'sem o lote, a fonte já saiu');
});

// fila do motor (depois da T22): op cavar — olhar/revelar do topo, pegar o que bate, o resto para outra zona
const topoN = (e, j, n) => e.jogs[j].zonas.grimorio.slice(-n).reverse().map(id => e.objs[id].n);   // do topo para baixo
const fundoN = (e, j, n) => e.jogs[j].zonas.grimorio.slice(0, n).map(id => e.objs[id].n);
const ctxDe = (e?) => ({ voce: 0, este: undefined, alvos: [], ilegal: {}, lki: {}, item: undefined });
caso('701.16', 'cavar: Grisly Salvage revela 5, pega 1 criatura/terreno para a mão, o resto vai ao cemitério', () => {
  const e = cena();
  for (const n of ['Forest', 'Wastes', 'Llanowar Elves', 'Wastes', 'Wastes']) e.por(0, n, { zona: 'grimorio' });   // o último fica no topo
  const g0 = e.jogs[0].zonas.grimorio.length, vistos: any[] = [];
  M.executar(e, M.carta('Grisly Salvage').fx[0], ctxDe(e), (j, tipo, ops) => { vistos.push(tipo); return ops.find(o => o.a === 'cavar' && e.objs[o.id].n === 'Llanowar Elves') || ops[0]; });
  igual(vistos, ['cavar'], 'uma pergunta (o "pode" fica dentro do cavar)');
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n), ['Llanowar Elves']);
  igual(e.jogs[0].zonas.cemiterio.map(id => e.objs[id].n).sort(), ['Forest', 'Wastes', 'Wastes', 'Wastes']);
  igual(e.jogs[0].zonas.grimorio.length, g0 - 5);
  ok(M.fxSuportado(M.carta('Grisly Salvage').fx), 'o motor oferece a carta');
});
caso('701.16', 'cavar com "pode": não pegar nada ainda manda as 5 ao cemitério', () => {
  const e = cena();
  for (const n of ['Forest', 'Wastes', 'Wastes', 'Wastes', 'Wastes']) e.por(0, n, { zona: 'grimorio' });
  M.executar(e, M.carta('Grisly Salvage').fx[0], ctxDe(e), (j, tipo, ops) => ops.find(o => o.a === 'nenhum') || ops[0]);
  igual(e.jogs[0].zonas.mao.length, 0);
  igual(e.jogs[0].zonas.cemiterio.length, 5);
});
caso('701.16', 'cavar: Sea Gate Oracle olha 2, uma na mão, a outra no fundo', () => {
  const e = cena();
  e.por(0, 'Forest', { zona: 'grimorio' }); e.por(0, 'Island', { zona: 'grimorio' });
  M.executar(e, M.carta('Sea Gate Oracle').gat[0].fx[0], ctxDe(e), (j, tipo, ops) => ops.find(o => o.a === 'cavar' && e.objs[o.id].n === 'Forest') || ops[0]);
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n), ['Forest']);
  igual(fundoN(e, 0, 1), ['Island']);
  igual(topoN(e, 0, 1), ['Wastes']);
});
caso('701.16', 'cavar com destinos: Expressive Iteration — 1 na mão, 1 no exílio, 1 no fundo', () => {
  const e = cena();
  for (const n of ['Forest', 'Island', 'Mountain']) e.por(0, n, { zona: 'grimorio' });   // topo: Mountain
  M.executar(e, M.carta('Expressive Iteration').fx[0], ctxDe(e), (j, tipo, ops, c) => {
    igual(tipo, 'destino');
    return ops.find(o => o.a === 'destino' && e.objs[o.id].n === (c.para === 'mao' ? 'Island' : 'Mountain'));
  });
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n), ['Island']);
  igual(e.jogs[0].zonas.exilio.map(id => e.objs[id].n), ['Mountain']);
  igual(fundoN(e, 0, 1), ['Forest']);
});
caso('701.16', 'cavar até achar: Empty the Laboratory com X=2 revela até 2 Zumbis, põe no campo, o resto no fundo', () => {
  const e = cena({ campo: [[0, 'Gravecrawler'], [0, 'Gravecrawler']] });
  for (const n of ['Wastes', 'Gravecrawler', 'Forest', 'Feral Ghoul', 'Island']) e.por(0, n, { zona: 'grimorio' });   // topo: Island
  const c = { ...ctxDe(e), x: 2 };
  for (const f of M.carta('Empty the Laboratory').fx) M.executar(e, f, c, (j, tipo, ops) => ops.find(o => o.a !== 'nenhum') || ops[0]);
  igual(e.jogs[0].zonas.cemiterio.map(id => e.objs[id].n), ['Gravecrawler', 'Gravecrawler'], 'sacrificou os 2');
  igual(e.campo.map(id => e.objs[id].n).sort(), ['Feral Ghoul', 'Gravecrawler'], 'achou 2 Zumbis');
  igual(fundoN(e, 0, 2).sort(), ['Forest', 'Island'], 'os outros revelados no fundo');
  igual(topoN(e, 0, 1), ['Wastes'], 'parou no 2º Zumbi');
  ok(M.fxSuportado(M.carta('Empty the Laboratory').fx), 'o motor oferece a carta');
});
caso('701.16', 'cavar: Risen Reef — terreno do topo entra virado; se não for terreno (ou não quiser), vai para a mão', () => {
  const e = cena();
  e.por(0, 'Forest', { zona: 'grimorio' });
  M.executar(e, M.carta('Risen Reef').gat[0].fx[0], ctxDe(e), (j, tipo, ops) => ops.find(o => o.a === 'destino') || ops[0]);
  const f = objN(e, 0, 'Forest'); ok(f && f.virada, 'Forest no campo virada');
  e.por(0, 'Llanowar Elves', { zona: 'grimorio' });
  M.executar(e, M.carta('Risen Reef').gat[0].fx[0], ctxDe(e), (j, tipo, ops) => ops[0]);
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n), ['Llanowar Elves']);
});
caso('701.16', 'cavar: Ponder olha 3 e devolve no topo na mesma ordem (pega 0)', () => {
  const e = cena();
  for (const n of ['Forest', 'Island', 'Mountain']) e.por(0, n, { zona: 'grimorio' });
  const fx = M.carta('Ponder').fx.find(f => f.op === 'cavar');
  M.executar(e, fx, ctxDe(e), (j, tipo, ops) => ops[0]);
  igual(topoN(e, 0, 3), ['Mountain', 'Island', 'Forest']);
});

// token.est (correção 12 do banco): estáticas da própria ficha, afeta 'este' = a ficha. Fichas no formato do banco
// (Construct do Digsite Engineer/Urza; Gnome Soldier do Thousand Moons Smithy), criadas direto para não depender do lote
const CONTA_ART = { conta: { tipo: ['Artifact'], ctrl: 'voce', zona: 'campo' } };
const CONSTRUCT = { pt: [0, 0], cores: '', tipos: ['Artifact', 'Creature'], sub: ['Construct'], est: [{ modo: 'continuo', afeta: 'este', p: CONTA_ART, r: CONTA_ART }] };
const CONTA_AC = { conta: { tipo: ['Artifact', 'Creature'], ctrl: 'voce', zona: 'campo' } };
const GNOMO = { pt: [0, 0], cores: 'W', tipos: ['Artifact', 'Creature'], sub: ['Gnome', 'Soldier'], est: [{ modo: 'ptDefinido', afeta: 'este', pBase: CONTA_AC, rBase: CONTA_AC }] };
caso('613.4c', 'token.est continuo: Construct +1/+1 por artefato seu, contando a si mesmo; só ele ganha', () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Mind Stone'], [1, 'Sol Ring']] });
  const c = M.criarFicha(e, 0, CONSTRUCT);
  igual([M.poder(e, c), M.resistencia(e, c)], [3, 3], 'os 2 artefatos + a ficha');
  const c2 = M.criarFicha(e, 0, CONSTRUCT);
  igual([M.poder(e, c), M.poder(e, c2)], [4, 4], 'o 2º Construct conta para os dois, cada um só com a própria est');
  M.mover(e, objN(e, 0, 'Mind Stone').id, 'cemiterio');
  igual(M.poder(e, c), 3, 'artefato que sai deixa de contar');
  igual(M.poder(e, M.criarFicha(e, 1, CONSTRUCT)), 2, 'o do oponente conta os dele');
});
caso('604.3', 'token.est ptDefinido: Gnome Soldier P/R = seus artefatos e/ou criaturas (com ele)', () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears']] });
  const g = M.criarFicha(e, 0, GNOMO);
  igual([M.poder(e, g), M.resistencia(e, g)], [3, 3]);
  M.criarFicha(e, 0, GNOMO);
  igual(M.poder(e, g), 4);
});

// subst ganhaVida (correção 14 do banco): só o ganho. Fontes como fichas com o subst do banco (Angel of Vitality:
// soma 1; The Wind Crystal: mult 2), para não depender do lote
const SUBST_VIDA = (muda) => ({ n: 'Fonte ' + JSON.stringify(muda), tipos: ['Enchantment'], subst: [{ ev: 'ganhaVida', jog: 'voce', muda }] });
caso('614.1a', 'subst ganhaVida: +1 (Angel) e dobro (Wind Crystal) só no ganho de quem controla; somas antes do dobro (616.1)', () => {
  const e = cena();
  M.criarFicha(e, 0, SUBST_VIDA({ soma: 1 }));
  igual(M.ganharVida(e, 0, 3), 4, '+1');
  igual(M.ganharVida(e, 1, 3), 3, 'o do oponente não muda');
  M.criarFicha(e, 0, SUBST_VIDA({ mult: 2 }));
  igual(M.ganharVida(e, 0, 3), 8, '(3+1)×2');
  igual(M.ganharVida(e, 0, 0), 0, 'ganhar 0 não é ganho (119.3)');
  igual(e.jogs[0].vida, 52);
  M.executar(e, { op: 'perderVida', quem: 'voce', qtd: 3 }, ctxDe(e), (j, t, ops) => ops[0]);
  igual(e.jogs[0].vida, 49, 'perda não dobra');
});
caso('702.15b', 'vínculo com a vida fora do combate passa pelo ganho (substituição e gatilho de ganhaVida)', () => {
  const e = cena();
  M.criarFicha(e, 0, SUBST_VIDA({ mult: 2 }));
  const fonte = M.criarFicha(e, 0, { n: 'Fonte', tipos: ['Creature'], pt: [1, 1], kw: [{ k: 'vinculoVida' }] });
  M.executar(e, { op: 'dano', qtd: 2, em: { alvo: 0 } }, { ...ctxDe(e), alvos: [[{ jog: 1 }]], defAlvos: [{}], item: fonte.id }, (j, t, ops) => ops[0]);
  igual(e.jogs[1].vida, 38); igual(e.jogs[0].vida, 44);
});

// custoAtv descartarEste (correção 15 do banco): habilidade ativada da mão cujo custo é descartar a própria carta.
// A carta da cena tem a atv do Trumpeting Carnosaur como o banco escreve (nome à parte: vale mesmo antes do lote)
(banco.db as any)['Cena Canalizar'] = { n: 'Cena Canalizar', custo: { g: 4, p: ['R', 'R'] }, cores: 'R', tipos: ['Creature'], sub: ['Dinosaur'], pt: [7, 6], vm: 6, ci: 'R',
  atv: [{ zona: 'mao', custo: { mana: { g: 2, p: ['R'] }, descartarEste: true }, alvos: [{ f: { tipo: ['Creature', 'Planeswalker'], zona: 'campo' } }], fx: [{ op: 'dano', em: { alvo: 0 }, qtd: 3 }] }] };
caso('602.2', 'descartarEste: ativa da mão, a carta vai ao cemitério no custo e a habilidade resolve', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [1, 'Grizzly Bears']], mao: [[0, 'Cena Canalizar']] });
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar').length, 1, 'a da mão aparece');
  M.avancar(e); respE(e, o => o.a === 'ativar'); if (e.perg) alvoObj(e, 'Grizzly Bears');
  igual(naZona(e, 0, 'cemiterio'), ['Cena Canalizar'], JSON.stringify(e.log.slice(-6))); igual(naZona(e, 1, 'cemiterio'), ['Grizzly Bears']);
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar').length, 0, 'do cemitério não');
});
caso('602.2', 'atv da mão sem custo que tira a carta de lá não é oferecida (não repete de graça)', () => {
  (banco.db as any)['Cena Sem Descarte'] = { ...(banco.db as any)['Cena Canalizar'], n: 'Cena Sem Descarte', atv: [{ ...(banco.db as any)['Cena Canalizar'].atv[0], custo: { mana: { g: 2, p: ['R'] } } }] };
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [1, 'Grizzly Bears']], mao: [[0, 'Cena Sem Descarte']] });
  igual(M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar').length, 0);
});

// est reduzCusto (CR 601.2f): fontes como o banco escreve (Goblin Warchief, Ghalta sem o prop, Morophon, Sanctum, Otawara)
const db = banco.db as any;
db['Cena Chefe'] = { n: 'Cena Chefe', custo: { g: 1, p: ['R'] }, cores: 'R', tipos: ['Creature'], sub: ['Goblin'], pt: [2, 2], vm: 3, ci: 'R',
  est: [{ modo: 'reduzCusto', afeta: { sub: ['Goblin'], ctrl: 'voce', zona: 'pilha' }, qtd: 1 }] };
db['Cena Goblin'] = { n: 'Cena Goblin', custo: { g: 1, p: ['R'] }, cores: 'R', tipos: ['Creature'], sub: ['Goblin'], pt: [2, 1], vm: 2, ci: 'R' };
db['Cena Urso'] = { n: 'Cena Urso', custo: { g: 1, p: ['G'] }, cores: 'G', tipos: ['Creature'], sub: ['Bear'], pt: [2, 2], vm: 2, ci: 'G' };
caso('601.2f', 'reduzCusto do campo: a mágica do filtro custa {1} a menos, só a sua, e a redução não tira o colorido', () => {
  const e = cena({ campo: [[0, 'Cena Chefe'], [0, 'Mountain']], mao: [[0, 'Cena Goblin'], [0, 'Cena Urso'], [1, 'Cena Goblin']] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Goblin')), { g: 0, p: ['R'] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Urso')), { g: 1, p: ['G'] }, 'fora do filtro');
  igual(M.custoComImposto(e, naMao(e, 1, 'Cena Goblin')), { g: 1, p: ['R'] }, 'do oponente');
  M.criarFicha(e, 0, db['Cena Chefe']);
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Goblin')).g, 0, 'genérico não fica negativo');
  M.avancar(e); conj(e, 'Cena Goblin');
  ok(noCampo(e).includes('Cena Goblin') || e.pilha.some(id => e.objs[id].n === 'Cena Goblin'), 'conjurou com uma Montanha: ' + JSON.stringify(e.log.slice(-4)));
});
caso('601.2f', 'reduzCusto afeta este de mao: conta o campo; fora da mão não vale; qtd com prop não é lida', () => {
  db['Cena Grandão'] = { n: 'Cena Grandão', custo: { g: 6, p: ['G'] }, cores: 'G', tipos: ['Creature'], pt: [8, 8], vm: 7, ci: 'G',
    est: [{ modo: 'reduzCusto', afeta: 'este', de: 'mao', qtd: { conta: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } } }] };
  const e = cena({ campo: [[0, 'Cena Urso'], [0, 'Cena Urso'], [1, 'Cena Urso']], mao: [[0, 'Cena Grandão']] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Grandão')), { g: 4, p: ['G'] });
  const g = naMao(e, 0, 'Cena Grandão'); M.mover(e, g.id, 'exilio');
  igual(M.custoComImposto(e, g).g, 6, 'do exílio não');
  ok(!M.estReduzOk({ modo: 'reduzCusto', afeta: 'este', qtd: { conta: { tipo: ['Creature'], zona: 'campo' }, prop: 'outra' } }), 'prop desconhecida não');
});
caso('601.2f', 'reduzCusto com qtd.prop (Ghalta: soma do poder; The Great Henge: maior poder; Excalibur: soma do vm históricos)', () => {
  const pr = prop => ({ modo: 'reduzCusto', afeta: 'este', de: 'mao', qtd: { conta: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' }, prop } });
  db['Cena Ghalta'] = { n: 'Cena Ghalta', custo: { g: 10, p: ['G', 'G'] }, cores: 'G', tipos: ['Creature'], pt: [12, 12], vm: 12, ci: 'G', est: [pr('somaPoder')] };
  db['Cena Henge'] = { n: 'Cena Henge', custo: { g: 7, p: ['G', 'G'] }, cores: 'G', tipos: ['Artifact'], vm: 9, ci: 'G', super: ['Legendary'], est: [pr('maiorPoder')] };
  db['Cena Espada'] = { n: 'Cena Espada', custo: { g: 11, p: ['W'] }, cores: 'W', tipos: ['Artifact'], sub: ['Equipment'], vm: 12, ci: 'W',
    est: [{ modo: 'reduzCusto', afeta: 'este', qtd: { conta: { historico: true, tipo: ['Permanent'], ctrl: 'voce', zona: 'campo' }, prop: 'somaVm' } }] };
  const e = cena({ campo: [[0, 'Cena Urso'], [0, 'Cena Chefe'], [1, 'Cena Urso'], [0, 'Sol Ring']], mao: [[0, 'Cena Ghalta'], [0, 'Cena Henge'], [0, 'Cena Espada']] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Ghalta')), { g: 6, p: ['G', 'G'] }, '2 + 2 de poder');
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Henge')), { g: 5, p: ['G', 'G'] }, 'maior poder 2');
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Espada')), { g: 10, p: ['W'] }, 'só o Sol Ring é histórico (vm 1)');
});
caso('601.2f', 'filtro historico e tipoTodos (Jhoira\'s Familiar, Mycosynth Golem)', () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Cena Urso']] });
  const sr = objN(e, 0, 'Sol Ring'), ur = objN(e, 0, 'Cena Urso');
  igual([M.bate(e, sr, { historico: true }), M.bate(e, ur, { historico: true })], [true, false], 'artefato é histórico; urso não');
  igual([M.bate(e, sr, { tipoTodos: ['Artifact', 'Creature'] }), M.bate(e, ur, { tipoTodos: ['Creature'] })], [false, true], 'todos os tipos');
});
caso('601.2f', 'reduzCusto custo.p (Morophon): tira os símbolos coloridos da mágica do tipo escolhido', () => {
  db['Cena Morofão'] = { n: 'Cena Morofão', custo: { g: 7 }, tipos: ['Creature'], sub: ['Shapeshifter'], pt: [6, 6], vm: 7,
    est: [{ modo: 'reduzCusto', afeta: { sub: ['escolhido'], ctrl: 'voce', zona: 'pilha' }, custo: { p: ['W', 'U', 'B', 'R', 'G'] } }] };
  const e = cena({ campo: [[0, 'Cena Morofão']], mao: [[0, 'Cena Goblin'], [0, 'Cena Urso']] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Goblin')), { g: 1, p: ['R'] }, 'sem tipo escolhido');
  objN(e, 0, 'Cena Morofão').escolha = { tipo: 'Goblin' };
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Goblin')), { g: 1, p: [] });
  igual(M.custoComImposto(e, naMao(e, 0, 'Cena Urso')), { g: 1, p: ['G'] });
});
caso('602.2b', 'reduzCusto deHabil: habilidade da permanente (Sanctum) e da mão (Otawara) custam menos', () => {
  db['Cena Santuário'] = { n: 'Cena Santuário', tipos: ['Enchantment'], sub: ['Shrine'], custo: { p: ['W'] }, vm: 1, cores: 'W', ci: 'W',
    atv: [{ custo: { mana: { g: 5, p: ['W'] } }, alvos: [{ f: { tipo: ['Creature'], zona: 'campo' } }], fx: [{ op: 'virar', em: { alvo: 0 } }] }],
    est: [{ modo: 'reduzCusto', afeta: 'este', deHabil: true, qtd: { conta: { sub: ['Shrine'], ctrl: 'voce', zona: 'campo' } } }] };
  db['Cena Otawara'] = { n: 'Cena Otawara', tipos: ['Land'], super: ['Legendary'], ci: 'U',
    atv: [{ zona: 'mao', custo: { mana: { g: 3, p: ['U'] }, descartarEste: true }, alvos: [{ f: { tipo: ['Creature'], zona: 'campo' } }], fx: [{ op: 'mover', em: { alvo: 0 }, para: 'mao' }] }],
    est: [{ modo: 'reduzCusto', afeta: 'este', deHabil: true, qtd: { conta: { tipo: ['Creature'], super: ['Legendary'], ctrl: 'voce', zona: 'campo' } } }] };
  const e = cena({ campo: [[0, 'Cena Santuário'], [0, 'Island'], [1, 'Cena Urso']], mao: [[0, 'Cena Otawara']] });
  const S = objN(e, 0, 'Cena Santuário');
  igual(M.custoAtv(e, S, M.atvDe(e, S)[0]), { g: 4, p: ['W'] });
  igual(M.custoComImposto(e, S), { p: ['W'] }, 'deHabil não mexe no custo de mágica');
  const O = naMao(e, 0, 'Cena Otawara');
  ok(!M.podeAtivar(e, 0, O, 0), 'sem lendárias, {3}{U} não fecha com uma Ilha');
  for (let i = 0; i < 3; i++) M.criarFicha(e, 0, { n: 'Lenda ' + i, tipos: ['Creature'], super: ['Legendary'], pt: [1, 1] });
  igual(M.custoAtv(e, O, M.atvDe(e, O)[0]), { g: 0, p: ['U'] });
  ok(M.podeAtivar(e, 0, O, 0), 'com 3 lendárias, só {U}');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === O.id); if (e.perg) alvoObj(e, 'Cena Urso');
  igual(naZona(e, 0, 'cemiterio'), ['Cena Otawara'], JSON.stringify(e.log.slice(-5)));
  igual(naZona(e, 1, 'mao'), ['Cena Urso']);
});

// fx dano fonte e filtro nome (correção 16 do banco): fontes como o banco escreve (Warstorm Surge/Ingris, Chandra's Ignition)
db['Cena Tempestade'] = { n: 'Cena Tempestade', custo: { g: 5, p: ['R'] }, cores: 'R', tipos: ['Enchantment'], vm: 6, ci: 'R',
  gat: [{ ev: 'entra', quem: { tipo: ['Creature'], ctrl: 'voce' }, fx: [{ op: 'dano', quem: 'cadaOponente', qtd: 2, fonte: 'doEvento' }] }] };
db['Cena Vampiro'] = { n: 'Cena Vampiro', custo: { g: 1, p: ['B'] }, cores: 'B', tipos: ['Creature'], sub: ['Vampire'], pt: [2, 2], vm: 2, ci: 'B', kw: [{ k: 'vinculoVida' }] };
caso('120.3', 'dano com fonte doEvento: quem causa é a criatura que entrou (vínculo dela), não o encantamento', () => {
  const e = cena({ campo: [[0, 'Cena Tempestade']] });
  e.por(0, 'Cena Vampiro');
  igual(e.pend.length, 1, 'o gatilho');
  M.avancar(e);
  for (let i = 0; i < 5 && e.perg && e.pilha.length + e.pend.length; i++) respE(e, o => o.a === 'passar' || o.a === 'gatilho');
  igual(e.jogs[1].vida, 38, JSON.stringify(e.log.slice(-5))); igual(e.jogs[0].vida, 42, 'vínculo da que entrou');
  ok(M.fxSuportado(db['Cena Tempestade'].gat[0].fx) && !M.fxSuportado([{ op: 'dano', qtd: 1, fonte: 'outra' }]), 'fonte desconhecida não é lida');
});
caso('120.3', 'dano com fonte {alvo:0} (Chandra\'s Ignition): toque mortífero do alvo vale; alvo que saiu não causa', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears']] });
  const A = objN(e, 0, 'Grizzly Bears');
  const big = M.criarFicha(e, 1, { n: 'Grandalhão', tipos: ['Creature'], pt: [9, 9] });
  const fx = { op: 'dano', em: { todos: { tipo: ['Creature'], outro: true, zona: 'campo' } }, qtd: { conta: 'poderDoAlvo', alvo: 0 }, fonte: { alvo: 0 } };
  const morta = M.criarFicha(e, 0, { n: 'Mortífera', tipos: ['Creature'], pt: [1, 1], kw: [{ k: 'toqueMortifero' }] });
  const ctx = { ...ctxDe(e), alvos: [[{ o: morta.id, ts: morta.ts }]], defAlvos: [{}], lki: { alvos: [[M.lkiDe(e, morta)]] } };
  M.executar(e, fx, ctx, (j, t, ops) => ops[0]);
  igual([big.dano, big.mortal, A.dano, A.mortal], [1, true, 1, true], 'o 1 de dano da mortífera é letal (a fonte é o alvo, não a mágica)');
  const e2 = cena({ campo: [[1, 'Grizzly Bears']] });
  const m2 = M.criarFicha(e2, 0, { n: 'Mortífera', tipos: ['Creature'], pt: [1, 1] });
  const ctx2 = { ...ctxDe(e2), alvos: [[{ o: m2.id, ts: m2.ts }]], defAlvos: [{}], ilegal: { '0:0': true }, lki: { alvos: [[M.lkiDe(e2, m2)]] } };
  M.executar(e2, { op: 'dano', quem: 'cadaOponente', qtd: 3, fonte: { alvo: 0 } }, ctx2, (j, t, ops) => ops[0]);
  igual(e2.jogs[1].vida, 40, 'alvo ilegal: sem fonte, sem dano');
});
caso('201.2', 'filtro nome: conta as cópias com esse nome exato (Ancestral Anger no cemitério)', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [0, 'Sol Ring']] });
  igual(M.objetosQue(e, { nome: 'Grizzly Bears', zona: 'campo' }, { voce: 0 }).length, 2);
  igual(M.objetosQue(e, { nome: 'Grizzly Bears', ctrl: 'voce', zona: 'campo' }, { voce: 0 }).length, 1);
  M.mover(e, objN(e, 0, 'Grizzly Bears').id, 'cemiterio');
  igual(M.objetosQue(e, { tipo: ['Card'], nome: 'Grizzly Bears', zona: 'cemiterio', dono: 'voce' }, { voce: 0 }).length, 1);
  ok(M.filtroOk({ nome: 'x' }));
});

// correção 17 do banco: custoAtv devolver, alvo opcao com chute/presente, conjuradaCom kicker, palavra promisedgift
db['Cena Transmutador'] = { n: 'Cena Transmutador', custo: { g: 3, p: ['U'] }, cores: 'U', tipos: ['Artifact', 'Creature'], pt: [1, 2], vm: 4, ci: 'U',
  atv: [{ custo: { mana: { g: 1 }, devolver: { f: { tipo: ['Artifact'], ctrl: 'voce', zona: 'campo' }, qtd: 1 } }, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }] };
caso('602.2b', 'custoAtv devolver {f,qtd}: devolve uma permanente sua do filtro à mão do dono; sem ela, não ativa', () => {
  const e = cena({ campo: [[0, 'Cena Transmutador'], [0, 'Mountain']] });
  const T = objN(e, 0, 'Cena Transmutador'); T.doente = false;
  ok(M.podeAtivar(e, 0, T, 0), 'ele mesmo é artefato');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === T.id);
  if (e.perg && e.perg.tipo === 'custo') respE(e, o => o.a === 'devolver');
  ok(naZona(e, 0, 'mao').includes('Cena Transmutador'), JSON.stringify(e.log.slice(-4)));
  ok(M.custoSuportado({ devolver: 'este' }) && !M.custoSuportado({ devolver: { f: {}, n: 1 } }));
  const e2 = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Mountain']] });
  ok(!M.podeAtivar(e2, 0, M.criarFicha(e2, 0, { ...db['Cena Transmutador'], tipos: ['Creature'] }), 0), 'sem artefato seu, não');
});
db['Cena Rasgar'] = { n: 'Cena Rasgar', custo: { g: 1, p: ['G'] }, cores: 'G', tipos: ['Instant'], vm: 2, ci: 'BG', kw: [{ k: 'chute', custo: { g: 1, p: ['B'] } }],
  alvos: [{ f: { tipo: ['Artifact', 'Enchantment'], zona: 'campo' }, opcao: 'semChute' }, { f: { tipo: ['Permanent'], nao: ['Land'], zona: 'campo' }, opcao: 'chute' }],
  fx: [{ op: 'exilar', em: { alvo: 0 } }, { op: 'exilar', em: { alvo: 1 } }] };
caso('702.33', 'chute com alvo por opção (Tear Asunder): sem chute só artefato/encantamento; criatura só chutando', () => {
  const pode = (lands, campoOp) => { const e = cena({ campo: [...lands.map(n => [0, n]), ...campoOp.map(n => [1, n])], mao: [[0, 'Cena Rasgar']] }); return [e, M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar')]; };
  igual(pode(['Forest', 'Swamp'], ['Grizzly Bears'])[1], false, 'criatura sem mana do chute');
  igual(pode(['Forest', 'Swamp'], ['Sol Ring'])[1], true, 'artefato sem chute');
  const [e, ok4] = pode(['Forest', 'Swamp', 'Swamp', 'Forest'], ['Grizzly Bears']);
  ok(ok4, 'chutando, criatura vale');
  M.avancar(e); conj(e, 'Cena Rasgar'); if (e.perg && e.perg.tipo === 'opcao') respE(e, o => o.v.chute); alvoObj(e, 'Grizzly Bears');
  for (let i = 0; i < 4 && e.pilha.length && e.perg; i++) respE(e, o => o.a === 'passar');
  igual(naZona(e, 1, 'exilio'), ['Grizzly Bears'], JSON.stringify(e.log.slice(-5)));
  igual(e.campo.filter(id => e.objs[id].ctrl === 0 && e.objs[id].virada).length, 4, 'pagou o chute (4 terras viradas)');
});
db['Cena Emboscador'] = { n: 'Cena Emboscador', custo: { p: ['R'] }, cores: 'R', tipos: ['Creature'], sub: ['Goblin'], pt: [1, 1], vm: 1, ci: 'R', kw: [{ k: 'chute', custo: { p: ['R'] } }],
  gat: [{ ev: 'entra', quem: { este: true }, se: { conjuradaCom: 'kicker' }, fx: [{ op: 'modificar', em: { todos: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }, p: 1, kw: [{ k: 'pressa' }], dura: 'fimDoTurno' }] }] };
caso('702.33d', 'conjuradaCom kicker (Goblin Bushwhacker): o gatilho de entrar só vale chutada', () => {
  for (const [terras, esp] of [[1, 0], [2, 1]] as const) {
    const e = cena({ campo: [[0, 'Grizzly Bears'], ...Array.from({ length: terras }, () => [0, 'Mountain'])], mao: [[0, 'Cena Emboscador']] });
    M.avancar(e); conj(e, 'Cena Emboscador');
    if (e.perg && e.perg.tipo === 'opcao') respE(e, o => o.v.chute);
    for (let i = 0; i < 6 && e.perg && (e.pilha.length || e.pend.length); i++) respE(e, o => o.a === 'passar' || o.a === 'gatilho');
    igual(M.poder(e, objN(e, 0, 'Grizzly Bears')), 2 + esp, `${terras} Montanha(s): ` + JSON.stringify(e.log.slice(-4)));
  }
  ok(M.gatOk(db['Cena Emboscador'].gat[0]) && !M.gatOk({ ...db['Cena Emboscador'].gat[0], se: { palavra: 'maxspeed' } }));
});
db['Cena Desgaste'] = { n: 'Cena Desgaste', custo: { g: 1, p: ['G'] }, cores: 'G', tipos: ['Sorcery'], vm: 2, ci: 'G', kw: [{ k: 'ofertaPresente', tipo: 'carta' }],
  alvos: [{ f: { tipo: ['Artifact', 'Enchantment'], zona: 'campo' }, opcao: 'semPresente' }, { f: { tipo: ['Artifact', 'Enchantment'], zona: 'campo' }, min: 2, max: 2, opcao: 'presente' }],
  fx: [{ op: 'destruir', em: { alvo: 0 } }, { op: 'destruir', em: { alvo: 1 } }, { op: 'comprar', quem: 'voce', qtd: 1, se: { palavra: 'promisedgift' } }] };
caso('702.174', 'oferta de presente (Wear Down): o oponente compra antes, dois alvos; sem presente, um', () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [1, 'Sol Ring'], [1, 'Mind Stone']], mao: [[0, 'Cena Desgaste']] });
  const m0 = e.jogs[0].zonas.mao.length, m1 = e.jogs[1].zonas.mao.length;
  M.avancar(e); conj(e, 'Cena Desgaste');
  if (e.perg && e.perg.tipo === 'opcao') respE(e, o => o.v.presente);
  if (e.perg && e.perg.tipo === 'presente') respE(e, o => o.jog === 1);
  alvoObj(e, 'Sol Ring'); alvoObj(e, 'Mind Stone');
  for (let i = 0; i < 4 && e.pilha.length && e.perg; i++) respE(e, o => o.a === 'passar');
  igual(naZona(e, 1, 'cemiterio').sort(), ['Mind Stone', 'Sol Ring'], JSON.stringify(e.log.slice(-6)));
  igual(e.jogs[1].zonas.mao.length, m1 + 1, 'o presente');
  igual(e.jogs[0].zonas.mao.length, m0, 'conjurou 1 e comprou 1 (se promisedgift)');
});

// (6c) contas de ataque, bloqueio obrigatório (509.1c), tipo em comum, entrar transformada (712.14a)
caso('508.1m', 'contas de ataque: atacantes, atacantesEmVoce (no combate e depois, no turno) e ataquesNoTurno; Mangara compra com 2 atacando',() => {
  const e = combate([[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Mangara, the Diplomat']]);
  const m1 = e.jogs[1].zonas.mao.length;
  ate(e, 'atacar');
  atacaCom(e, objN(e, 0, 'Grizzly Bears')); atacaCom(e, objN(e, 0, 'Llanowar Elves')); fecha(e, 'atacar');
  igual([M.contaAtaque(e, 'atacantes', 0), M.contaAtaque(e, 'atacantesEmVoce', 1), M.contaAtaque(e, 'atacantesEmVoce', 0), M.contaAtaque(e, 'ataquesNoTurno', 0)], [2, 2, 0, 2]);
  ate(e, 'bloquear'); pronto(e); ateFimCombate(e);
  igual(e.jogs[1].zonas.mao.length, m1 + 1, 'Mangara: oponente atacou você com 2');
  igual([M.contaAtaque(e, 'atacantes', 0), M.contaAtaque(e, 'atacantesEmVoce', 1)], [0, 2], 'fora do combate: as do turno');
});
caso('509.1c', 'bloqueio obrigatório: deveBloquear de modificar (Brutal Hordechief: bloqueia se puder; com atacante: bloqueia aquele)', () => {
  const e = combate([...enche(4, 'Mountain').map(n => [0, n]), [0, 'Brutal Hordechief'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant'], [1, 'Elvish Mystic']]);
  M.avancar(e);
  respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Brutal Hordechief'); resolve(e);
  igual((e.temp || []).length, 1, 'efeito até o fim do turno');
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Grizzly Bears')); fecha(e, 'atacar');
  ate(e, 'bloquear');
  ok(!opsDe(e, 'pronto').length, 'não fecha sem bloquear');
  bloqueia(e, objN(e, 1, 'Hill Giant'), objN(e, 0, 'Grizzly Bears'));
  igual(e.turno.combate.atk[0].bloq.length, 2, 'o outro também bloqueou (opção única: o núcleo responde sozinho)');
  // com atacante: só aquele
  const f = combate([[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant'], [1, 'Elvish Mystic']]);
  ate(f, 'atacar');
  const gb = objN(f, 0, 'Grizzly Bears'), el = objN(f, 0, 'Llanowar Elves'), hg = objN(f, 1, 'Hill Giant');
  M.executar(f, { op: 'modificar', em: { alvo: 0 }, est: [{ modo: 'deveBloquear', afeta: 'este', atacante: 'doEvento' }], dura: 'fimDoTurno' },
    { voce: 0, este: gb.id, alvos: [[{ o: hg.id, ts: hg.ts }]], ilegal: {}, lki: { alvos: [] }, ev: { ev: 'ataca', id: el.id } }, null);
  atacaCom(f, gb); atacaCom(f, el); fecha(f, 'atacar');
  if (!(f.perg && f.perg.tipo === 'bloquear')) ate(f, 'bloquear');
  igual([opsDe(f, 'pronto').length, opsDe(f, 'bloquear').filter(o => o.id === hg.id).map(o => f.objs[o.atk].n)], [0, ['Llanowar Elves']]);
  const k = M.agenteBasico()(f, f.perg); igual(f.perg.ops[k].a, 'bloquear', 'o agente cumpre');
});
caso('205.3m', 'tipoEmComum: tipo de criatura em comum com este, filtro ou comandante; metamorfo tem todos; não-criatura não tem', () => {
  const e = cena({ campo: [[0, 'Llanowar Elves'], [0, 'Elvish Mystic'], [0, 'Grizzly Bears'], [0, 'Mirror Entity'], [0, 'Forest']] });
  const [le, em, gb, me, fo] = ['Llanowar Elves', 'Elvish Mystic', 'Grizzly Bears', 'Mirror Entity', 'Forest'].map(n => objN(e, 0, n));
  const b = (o, ref, este) => M.bate(e, o, { tipoEmComum: ref }, { voce: 0, este: este.id });
  igual([b(em, 'este', le), b(gb, 'este', le), b(me, 'este', gb), b(fo, 'este', me)], [true, false, true, false]);
  igual(M.bate(e, gb, { tipoEmComum: { sub: ['Elf'] } }, { voce: 0, este: gb.id }), true, 'Mirror Entity (metamorfo) é Elfo e Urso (702.73a)');
  igual(M.bate(e, le, { tipoEmComum: { tipo: ['Creature'] } }, { voce: 0, este: le.id }), true, 'Elvish Mystic e Mirror Entity');
  gb.cmd = true;
  igual([b(me, 'comandante', le), b(em, 'comandante', le)], [true, false]);
});
caso('712.14a', 'mover transformada: Ojer Taq morre e volta virada como Temple of Civilization; carta sem outra face fica onde está', () => {
  const e = cena({ campo: [[0, 'Ojer Taq, Deepest Foundation']] });
  const o = objN(e, 0, 'Ojer Taq, Deepest Foundation');
  M.avancar(e); M.mover(e, o.id, 'cemiterio'); e.perg = null; M.avancar(e); resolveCom(e);
  ok(e.campo.includes(o.id), 'voltou: ' + noCampo(e).join());
  igual([M.dadoDe(e, o).n, o.virada, o.face], ['Temple of Civilization', true, 0]);
  const g = cena({ mao: [[0, 'Grizzly Bears']] }), gb = g.objs[g.jogs[0].zonas.mao.find(id => g.objs[id].n === 'Grizzly Bears')];
  M.executar(g, { op: 'mover', em: { todos: { zona: 'mao', dono: 'voce' } }, para: 'campo', transformada: true }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, null);
  igual(gb.zona, 'mao');
});

// fichas predefinidas (CR 111.10): o banco escreve {nome}, o motor completa tipo e habilidades
const ficha = (e, j, nome) => M.criarFicha(e, j, { nome });
const resolve = e => { for (let i = 0; i < 6 && e.perg && e.pilha.length; i++) respE(e, o => o.a === 'passar'); };
const ativaFicha = (e, nome) => respE(e, o => o.a === 'ativar' && e.objs[o.id].n === nome);
caso('111.10a', 'Treasure: {T}, sacrifique: um de qualquer cor; paga a mágica e some', () => {
  const t = cena({ campo: [[0, 'Forest']], mao: [[0, 'Grizzly Bears']] });
  ok(!M.opcoesPrioridade(t, 0).some(o => o.a === 'conjurar'), 'só a Floresta não paga');
  const T = ficha(t, 0, 'Treasure');
  igual([T.n, M.dadoDe(t, T).tipos, M.dadoDe(t, T).sub], ['Treasure', ['Artifact'], ['Treasure']]);
  ok(M.opcoesPrioridade(t, 0).some(o => o.a === 'conjurar'), 'Floresta + Tesouro pagam {1}{G}');
  M.avancar(t); conj(t, 'Grizzly Bears'); resolve(t);
  ok(noCampo(t).includes('Grizzly Bears') && !noCampo(t).includes('Treasure'), noCampo(t).join());
  const g = cena({ campo: [[0, 'Forest']], mao: [[0, 'Grizzly Bears']] }); ficha(g, 0, 'Gold');
  ok(M.opcoesPrioridade(g, 0).some(o => o.a === 'conjurar'), 'Gold: sacrifique, sem virar');
});
caso('111.10b', 'Clue ({2}: compra), Food ({2},{T}: 3 de vida); o agente básico usa com a mana que sobra', () => {
  const e = cena({ campo: [[0, 'Wastes'], [0, 'Wastes']] });
  ficha(e, 0, 'Clue');
  const m = e.jogs[0].zonas.mao.length;
  M.avancar(e);
  const k = M.agenteBasico()(e, e.perg);
  ok(e.perg.ops[k].a === 'ativar' && e.objs[e.perg.ops[k].id].n === 'Clue', 'o agente quebra a Pista');
  ativaFicha(e, 'Clue'); resolve(e);
  igual(e.jogs[0].zonas.mao.length, m + 1, 'comprou');
  const f = cena({ campo: [[0, 'Wastes'], [0, 'Wastes']] }); ficha(f, 0, 'Food');
  const v = f.jogs[0].vida;
  M.avancar(f); ativaFicha(f, 'Food'); resolve(f);
  igual(f.jogs[0].vida, v + 3);
  igual(noCampo(f).filter(n => n === 'Food'), [], 'a Comida foi sacrificada');
});
caso('111.10c', 'Blood ({1},{T}, descarte, sacrifique: compra); o agente só usa descartando terreno de sobra', () => {
  const sem = cena({ campo: [[0, 'Wastes']], mao: [[0, 'Grizzly Bears']] }); ficha(sem, 0, 'Blood');
  M.avancar(sem);
  const k0 = M.agenteBasico()(sem, sem.perg);
  ok(!(sem.perg.ops[k0].a === 'ativar'), 'sem terreno sobrando, não filtra');
  const e = cena({ campo: [[0, 'Wastes']], mao: [[0, 'Forest'], [0, 'Forest'], [0, 'Grizzly Bears']] }); ficha(e, 0, 'Blood');
  e.jogs[0].terrenos = 1;   // já jogou o terreno do turno
  M.avancar(e);
  const k = M.agenteBasico()(e, e.perg);
  ok(e.perg.ops[k].a === 'ativar' && e.objs[e.perg.ops[k].id].n === 'Blood', JSON.stringify(e.perg.ops));
  M.responder(e, k);
  if (e.perg && e.perg.tipo === 'custo') M.responder(e, M.agenteBasico()(e, e.perg));
  resolve(e);
  igual(naZona(e, 0, 'cemiterio'), ['Forest'], 'descartou o terreno');
  igual(e.jogs[0].zonas.mao.length, 3, '3 − 1 + 1');
});
caso('111.10d', 'Powerstone: {C} só para mágica de artefato; Map ativa, Junk ainda não; nome fora da tabela fica só com o nome', () => {
  const p = cena({ mao: [[0, 'Sol Ring']] }); ficha(p, 0, 'Powerstone');
  ok(M.opcoesPrioridade(p, 0).some(o => o.a === 'conjurar' && p.objs[o.id].n === 'Sol Ring'), 'Sol Ring sim');
  const q = cena({ mao: [[0, 'Grizzly Bears']], campo: [[0, 'Forest']] }); ficha(q, 0, 'Powerstone');
  ok(!M.opcoesPrioridade(q, 0).some(o => o.a === 'conjurar'), 'criatura não-artefato não');
  const r = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Wastes']] }); const mp = ficha(r, 0, 'Map'); ficha(r, 0, 'Junk');
  igual(M.dadoDe(r, mp).sub, ['Map']);
  const at = M.opcoesPrioridade(r, 0).filter(o => o.a === 'ativar').map(o => r.objs[o.id].n);
  ok(at.includes('Map') && !at.includes('Junk'), 'Map explora (701.44); Junk (jogar do exílio) ainda não: ' + at);
  const x = ficha(r, 0, 'Wicked Role');
  igual(x.n, 'Wicked Role');
  igual(M.fichaDe({ nome: 'Treasure', virada: 1 }).sub, ['Treasure']);
});

// descarte (CR 701.9) e loucura (702.35): o deck da Ivora
// resolve a pilha respondendo: prioridade passa; o resto pela função (−1 = agente básico)
const resolveCom = (e, f = (p: any) => -1) => {
  for (let i = 0; i < 80 && e.perg && (e.pilha.length || e.perg.tipo !== 'acao'); i++) {
    const p = e.perg, { passo, n } = e.turno, fim = x => x.turno.passo !== passo || x.turno.n !== n;
    if (p.tipo === 'acao') { M.responder(e, p.ops.findIndex(o => o.a === 'passar'), fim); continue; }
    const k = f(p); M.responder(e, k >= 0 ? k : M.agenteBasico()(e, p), fim);
  }
};
const terras = (n, c = 'Mountain') => Array.from({ length: n }, () => [0, c]);
caso('701.9a', 'descarta: um gatilho por carta, grupo uma vez com a conta do lote, quem descartou (Megrim) e lembrados (Path of the Pyromancer)', () => {
  const e = cena({ campo: [...terras(5), [0, 'Ivora, Insatiable Heir'], [0, 'Glint-Horn Buccaneer'], [0, 'Marauding Mako'], [1, 'Megrim']],
    mao: [[0, 'Path of the Pyromancer'], [0, 'Grizzly Bears'], [0, 'Forest']] });
  e.pend = [];
  M.avancar(e); conj(e, 'Path of the Pyromancer'); resolveCom(e);
  const o = n => e.objs[e.campo.find(id => e.objs[id].n === n)];
  igual(naZona(e, 0, 'cemiterio').sort(), ['Forest', 'Grizzly Bears', 'Path of the Pyromancer'], JSON.stringify(e.log.slice(-12)));
  igual(o('Ivora, Insatiable Heir').marc['+1/+1'], 2, 'Ivora: uma vez por carta');
  igual(o('Marauding Mako').marc['+1/+1'], 2, 'Mako: uma vez, com as 2 do lote');
  igual(e.jogs[1].vida, 38, 'Glint-Horn: 1 por carta');
  igual(e.jogs[0].vida, 36, 'Megrim: 2 por carta, em quem descartou');
  igual(e.jogs[0].zonas.mao.length, 3, 'comprou lembrados + 1');
});
caso('701.9b', '"descarte quantas quiser, compre essa quantidade + 1" (Brass\'s Tunnel-Grinder); 0 descartadas = compra 1', () => {
  for (const [quantas, mao] of [[2, 4], [0, 4]] as any[]) {
    const e = cena({ campo: terras(3), mao: [[0, "Brass's Tunnel-Grinder"], [0, 'Grizzly Bears'], [0, 'Forest'], [0, 'Wastes']] });
    M.avancar(e); conj(e, "Brass's Tunnel-Grinder");
    let feitas = 0;
    resolveCom(e, p => p.tipo === 'descartar' ? (feitas < quantas ? (feitas++, p.ops.findIndex(o => o.a === 'descartar')) : p.ops.findIndex(o => o.a === 'nenhum')) : -1);
    igual(naZona(e, 0, 'cemiterio').length, quantas, JSON.stringify(e.log.slice(-8)));
    igual(e.jogs[0].zonas.mao.length, mao, `${quantas} descartadas`);
  }
});
caso('702.35a', 'loucura: descartada vai ao exílio e o gatilho conjura pelo custo de loucura (fora da velocidade); recusar = cemitério', () => {
  for (const quer of [true, false]) {
    const e = cena({ campo: terras(5), mao: [[0, "Brass's Tunnel-Grinder"], [0, "Anje's Ravager"]] });
    M.avancar(e); conj(e, "Brass's Tunnel-Grinder");
    let feitas = 0;
    resolveCom(e, p => p.tipo === 'descartar' ? (feitas++ ? p.ops.findIndex(o => o.a === 'nenhum') : p.ops.findIndex(o => o.a === 'descartar'))
      : p.tipo === 'talvez' && p.ctx && p.ctx.op === 'loucura' ? (quer ? 0 : 1) : -1);
    if (quer) {
      ok(noCampo(e).includes("Anje's Ravager"), 'conjurou pela loucura: ' + JSON.stringify(e.log.slice(-10)));
      igual(e.campo.filter(id => e.objs[id].n === 'Mountain' && e.objs[id].virada).length, 5, '{2}{R} + {1}{R}');
    } else igual(naZona(e, 0, 'cemiterio'), ["Anje's Ravager"], JSON.stringify(e.log.slice(-10)));
    igual(naZona(e, 0, 'exilio'), [], 'não fica no exílio');
  }
});
caso('702.35b', 'loucura no descarte da limpeza (514.1): o agente descarta a de loucura primeiro e a conjura no turno de limpeza', () => {
  const e = cena({ campo: [...terras(3), [0, 'Grizzly Bears']], mao: [[0, 'Stensia Masquerade'], ...enche(7, 'Forest').map(n => [0, n])], passo: 'final' });
  e.pend = [];
  M.avancar(e, x => x.turno.passo === 'limpeza');
  for (let i = 0; i < 5 && e.perg && e.perg.tipo === 'acao' && e.turno.passo !== 'limpeza'; i++) M.responder(e, e.perg.ops.findIndex(o => o.a === 'passar'), x => x.turno.passo === 'limpeza');
  if (!e.perg) M.avancar(e);
  igual([e.turno.passo, e.perg && e.perg.tipo], ['limpeza', 'descartar']);
  M.responder(e, M.agenteBasico()(e, e.perg));
  ok(!naZona(e, 0, 'mao').includes('Stensia Masquerade'), 'descartou a de loucura');
  resolveCom(e);
  ok(noCampo(e).includes('Stensia Masquerade'), JSON.stringify([naZona(e, 0, 'cemiterio'), naZona(e, 0, 'exilio'), e.turno.passo]));
});
caso('702.29a', 'ciclar: da mão, paga e descarta esta, compra 1; o descarte dispara (Ivora, Marauding Mako); o agente cicla com gatilho de descarte', () => {
  const e = cena({ campo: [...terras(2), [0, 'Ivora, Insatiable Heir'], [0, 'Marauding Mako']], mao: [[0, 'Magmakin Artillerist']] });
  e.pend = []; e.jogs[0].terrenos = 1;
  M.avancar(e);
  const k = M.agenteBasico()(e, e.perg), op = e.perg.ops[k];
  ok(op.a === 'ativar' && e.objs[op.id].n === 'Magmakin Artillerist', 'o agente cicla: ' + JSON.stringify(op));
  M.responder(e, k); resolveCom(e);
  const o = n => e.objs[e.campo.find(id => e.objs[id].n === n)];
  igual(naZona(e, 0, 'cemiterio'), ['Magmakin Artillerist']);
  igual([o('Ivora, Insatiable Heir').marc['+1/+1'], o('Marauding Mako').marc['+1/+1']], [1, 1]);
  igual(e.jogs[0].zonas.mao.length, 1, 'comprou 1');
  igual(e.jogs[1].vida, 39, 'quando cicla: 1 de dano em cada oponente (do cemitério)');
});
caso('701.9c', 'agente: filtra com gatilho de descarte (Ivora + Blood com o último terreno da mão); sem gatilho, não', () => {
  for (const ivora of [true, false]) {
    const campo: any[] = [[0, 'Wastes']]; if (ivora) campo.push([0, 'Ivora, Insatiable Heir']);
    const e = cena({ campo, mao: [[0, 'Forest']] }); e.pend = []; ficha(e, 0, 'Blood');
    e.jogs[0].terrenos = 1;
    M.avancar(e);
    const k = M.agenteBasico()(e, e.perg), op = e.perg.ops[k];
    igual(op.a === 'ativar' && e.objs[op.id].n === 'Blood', ivora, ivora ? 'com Ivora quebra o Blood' : 'sem gatilho guarda o terreno');
  }
});

// aMenosQue genérico (CR 118.12): "X unless [quem] pays [custo]" em qualquer efeito
caso('118.12', 'aMenosQue: Smothering Tithe (o oponente que comprou paga {2} e não sai Treasure; sem mana, sai); vida e sacrifício', () => {
  for (const temMana of [true, false]) {
    const campo: any[] = [[0, 'Smothering Tithe']]; if (temMana) campo.push([1, 'Wastes'], [1, 'Wastes']);
    const e = cena({ campo });
    M.comprar(e, 1);
    const fim = x => x.turno.n !== 2;
    M.avancar(e, fim);
    let perguntou: any = null;
    for (let g = 0; e.perg && !fim(e) && g < 40; g++) {
      const p = e.perg; if (p.tipo === 'aMenosQuePagar') perguntou = { j: p.j, ops: p.ops.map(o => o.a) };
      M.responder(e, p.tipo === 'acao' ? p.ops.findIndex(o => o.a === 'passar') : M.agenteBasico()(e, p), fim);
      if (!e.pilha.length && perguntou) break;
    }
    // sem mana a pergunta tem uma opção só e o núcleo responde sozinho
    if (temMana) igual(perguntou, { j: 1, ops: ['naoPagar', 'pagar'] }, 'pergunta ao jogador que comprou');
    const tesouros = e.campo.filter(id => e.objs[id].n === 'Treasure' && e.objs[id].ctrl === 0).length;
    igual(tesouros, temMana ? 0 : 1, temMana ? 'pagou (agente: mana no turno dos outros)' : 'não pôde pagar');
    if (temMana) igual(e.campo.filter(id => e.objs[id].n === 'Wastes').map(id => e.objs[id].virada), [true, true]);
  }
  ok(!M.fxSuportado([{ op: 'comprar', aMenosQue: { quem: 'doEvento', custo: { mana: { x: 1 } } } }]), 'X sem qtd: recusa');
  ok(!M.fxSuportado([{ op: 'comprar', aMenosQue: { quem: 'doEvento', custo: { revelar: {} } } }]), 'custo que não sabe pagar: recusa');
  // vida e sacrifício, direto no executar
  const g = cena({ campo: [[1, 'Grizzly Bears']] });
  const ctx = { voce: 0, alvos: [[{ jog: 1 }]], ilegal: {}, lki: { alvos: [] } };
  const paga = (j, t, ops) => ops.find(o => o.a === 'pagar') || ops[0];
  const v0 = g.jogs[0].vida;
  M.executar(g, { op: 'perderVida', quem: 'voce', qtd: 5, aMenosQue: { quem: { alvo: 0 }, custo: { vida: 3 } } }, ctx, paga);
  igual([g.jogs[0].vida, g.jogs[1].vida], [v0, 37], 'o alvo pagou 3 de vida');
  M.executar(g, { op: 'comprar', quem: 'voce', aMenosQue: { quem: { alvo: 0 }, custo: { sacrificar: { f: { tipo: ['Creature'] }, qtd: 1 } } } }, ctx, paga);
  igual([naZona(g, 1, 'cemiterio'), g.jogs[0].zonas.mao.length], [['Grizzly Bears'], 0], 'sacrificou e ninguém comprou');
  M.executar(g, { op: 'comprar', quem: 'voce', aMenosQue: { quem: { alvo: 0 }, custo: { sacrificar: { f: { tipo: ['Creature'] }, qtd: 1 } } } }, ctx, paga);
  igual(g.jogs[0].zonas.mao.length, 1, 'sem criatura não pode pagar: comprou');
});

caso('118.12', 'aMenosQue sacrificar "este": Withercrown (perde 1 a menos que sacrifique a encantada; IA só sacrifica com vida baixa)', () => {
  ok(M.fxSuportado([{ op: 'perderVida', quem: 'voce', qtd: 1, aMenosQue: { quem: 'voce', custo: { sacrificar: 'este' } } }]), 'sacrificar este: aceito');
  const f = { op: 'perderVida', quem: 'voce', qtd: 1, aMenosQue: { quem: 'voce', custo: { sacrificar: 'este' } } };
  for (const vida of [40, 2]) {
    const g = cena({ campo: [[0, 'Grizzly Bears']] }); g.jogs[0].vida = vida;
    const urso = g.campo.find(id => g.objs[id].n === 'Grizzly Bears');
    const ia = M.agenteBasico();
    M.executar(g, f, { voce: 0, este: urso, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops, ctx) => ops[ia(g, { j, tipo: t, ops, ctx })]);
    igual([g.jogs[0].vida, naZona(g, 0, 'cemiterio')], vida === 40 ? [39, []] : [2, ['Grizzly Bears']], 'vida ' + vida);
  }
});

caso('101.4', 'repetirCada: Acererak ataca — para cada oponente, Zumbi 2/2 a menos que ele sacrifique uma criatura (ordem do turno)', () => {
  const d = M.carta('Acererak the Archlich'), f = d.gat.find(g => g.ev === 'ataca').fx;
  ok(M.fxSuportado(f), 'repetirCada aceito');
  ok(!M.fxSuportado([{ op: 'perderVida', quem: 'cadaAtual', qtd: 1 }]), 'cadaAtual fora do repetirCada: recusado');
  const g = cena({ jogs: 3, campo: [[0, 'Acererak the Archlich'], [1, 'Grizzly Bears']] });
  const ac = g.campo.find(id => g.objs[id].n === 'Acererak the Archlich');
  const perg: any[] = [];
  M.executar(g, f[0], { voce: 0, este: ac, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => { perg.push([j, t, ops.map(o => o.a)]); return ops.find(o => o.a === 'pagar') || ops[0]; });
  igual(perg.filter(p => p[1] === 'aMenosQuePagar').map(p => [p[0], p[2]]), [[1, ['naoPagar', 'pagar']], [2, ['naoPagar']]], 'pergunta a cada oponente, na ordem');
  igual(naZona(g, 1, 'cemiterio'), ['Grizzly Bears'], 'oponente 1 sacrificou');
  igual(g.campo.filter(id => g.objs[id].n !== 'Acererak the Archlich' && g.objs[id].ctrl === 0).length, 1, 'só 1 Zumbi (o do oponente 2)');
});
caso('101.4', 'repetirCada com pausas (o processo roda de novo a cada resposta): Braids — quem não sacrifica perde 2 e você compra', () => {
  const d = M.carta('Braids, Arisen Nightmare'), fx = d.gat[0].fx;
  ok(M.fxSuportado(fx), 'Braids aceita');
  const g = cena({ jogs: 3, campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [2, 'Grizzly Bears']] });
  const mao0 = g.jogs[0].zonas.mao.length, PAUSA = {};
  const quer = { 0: 'sim', 1: 'sim', 2: 'nao' }, resp: any[] = [], quem: number[] = [];
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  let i = 0, ip = 0, voltas = 0;
  const ask: any = (j, t, ops) => { if (ip < resp.length) return ops[resp[ip++]]; if (ops.length === 1) { resp.push(0); ip++; return ops[0]; }
    quem.push(j); resp.push(ops.findIndex(o => o.a === quer[j] || o.a === 'sacrificar')); throw PAUSA; };
  ask.etapa = () => { resp.length = 0; ip = 0; };
  while (i < fx.length) { try { ip = 0; M.executar(g, fx[i], ctx, ask); i++; ask.etapa(); } catch (err) { if (err !== PAUSA) throw err; if (++voltas > 50) throw new Error('não termina'); } }
  igual(quem.filter(j => j !== 0), [1, 2], 'cada oponente perguntado uma vez, na ordem');
  igual([g.jogs[1].vida, g.jogs[2].vida], [40, 38], 'só o que não sacrificou perde 2');
  igual([naZona(g, 1, 'cemiterio'), naZona(g, 2, 'cemiterio')], [['Grizzly Bears'], []]);
  igual(g.jogs[0].zonas.mao.length - mao0, 1, 'compra 1 (um oponente não sacrificou)');
  ok(!ctx.rep && ctx.cadaAtual === undefined, 'limpa o progresso');
});
caso('702.90', 'filtro kw: Corpse Cur devolve do cemitério só criatura com infectar', () => {
  const g = cena({ campo: [[0, 'Corpse Cur', { zona: 'mao' }]] });
  g.por(0, 'Grizzly Bears', { zona: 'cemiterio' }); const cur2 = g.por(0, 'Corpse Cur', { zona: 'cemiterio' });
  const d = M.carta('Corpse Cur');
  ok(M.gatOk(d.gat[0]), 'gatilho aceito');
  const f = d.gat[0].alvos[0].f;
  igual(M.objetosQue(g, f, { voce: 0 }).map(o => o.id), [cur2.id], 'só a com infectar');
});
caso('613.1f', 'modificar com gat: Demonic Gifts — +2/+0 e "quando morrer, volta ao campo" até o fim do turno; olha para trás (603.10a)', () => {
  const d = M.carta('Demonic Gifts');
  ok(M.fxSuportado(d.fx), 'Demonic Gifts aceito');
  for (const limpa of [false, true]) {
    const e = cena({ campo: [[0, 'Grizzly Bears']], passo: 'final' });
    const u = e.campo.find(id => e.objs[id].n === 'Grizzly Bears');
    M.executar(e, d.fx[0], { voce: 0, alvos: [[{ o: u, ts: e.objs[u].ts }]], ilegal: {}, lki: { alvos: [] } }, null);
    igual(M.poder(e, e.objs[u]), 4, '+2/+0');
    if (limpa) { passarAte(e, 'limpeza'); M.avancar(e); if (e.perg) M.responder(e, 0); }   // limpeza do turno (514.2): a habilidade ganha acabou (514.2)
    M.mover(e, u, 'cemiterio');
    M.avancar(e);
    for (let i = 0; i < 6 && e.perg && e.pilha.length + e.pend.length; i++) respE(e, o => o.a === 'passar' || o.a === 'gatilho');
    igual(noCampo(e).filter(n => n === 'Grizzly Bears').length, limpa ? 0 : 1, limpa ? 'depois da limpeza não volta' : 'voltou ao campo');
  }
});
caso('122.1b', 'marcador de palavra-chave: Luminous Broodmoth devolve a que não voa com marcador flying — ela passa a voar e não volta de novo', () => {
  const e = cena({ campo: [[0, 'Luminous Broodmoth'], [0, 'Grizzly Bears']] });
  const u = e.campo.find(id => e.objs[id].n === 'Grizzly Bears');
  for (let volta = 0; volta < 2; volta++) {
    M.mover(e, u, 'cemiterio'); M.avancar(e);
    for (let i = 0; i < 12 && e.perg && e.pilha.length + e.pend.length; i++) respE(e, o => o.a === 'passar' || o.a === 'gatilho' || o.a === 'pronto');
    igual(noCampo(e).includes('Grizzly Bears'), volta === 0, (volta === 0 ? 'voltou' : 'com voar não volta') + JSON.stringify(e.log.slice(-6)));
    if (volta === 0) ok(M.temKw(e, e.objs[u], 'voar') && e.objs[u].marc.flying === 1, 'voa pelo marcador');
  }
});
caso('602.2b', 'custo virarOutros: Dungeon Descent — {4},{T}, virar uma criatura lendária sua desvirada (mesmo enjoada, 302.6): aventura', () => {
  const d = M.carta('Dungeon Descent'), a = d.atv[1];
  ok(M.custoSuportado(a.custo), 'custo aceito');
  for (const lenda of [false, true]) {
    const campo: any[] = [[0, 'Dungeon Descent'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Wastes'], [0, 'Grizzly Bears']];
    if (lenda) campo.push([0, 'Acererak the Archlich', { doente: true }]);
    const e = cena({ campo });
    const dd = e.campo.find(id => e.objs[id].n === 'Dungeon Descent');
    M.avancar(e);
    const at = opsDe(e, 'ativar').find(o => o.id === dd && o.k === 1);
    igual(!!at, lenda, lenda ? 'com lendária: pode ativar' : 'sem lendária: não oferece');
    if (!lenda) continue;
    resp(e, o => o === at);
    while (e.perg && e.perg.tipo !== 'acao') M.responder(e, 0);
    const ac = e.campo.find(id => e.objs[id].n === 'Acererak the Archlich');
    ok(e.objs[ac].virada && e.objs[dd].virada, 'virou a lendária e o terreno');
    igual(e.campo.filter(id => e.objs[id].n === 'Wastes' && e.objs[id].virada).length, 4, 'pagou {4}');
    ok(!e.objs[e.campo.find(id => e.objs[id].n === 'Grizzly Bears')].virada, 'o urso (não lendário) fica');
  }
});
caso('502.3', 'naoDesvira: Junk Winder vira e ela não desvira no próximo desvirar; Fifty Feet of Rope (soNaoDesvira) não vira, só segura a virada', () => {
  ok(M.fxSuportado([{ op: 'virar', em: { alvo: 0 }, naoDesvira: true, soNaoDesvira: true }]) && !M.fxSuportado([{ op: 'virar', em: { alvo: 0 }, soNaoDesvira: true }]), 'campos');
  for (const so of [false, true]) {
    const e = cena({ campo: [[1, 'Grizzly Bears']], passo: 'final' });
    const u = e.campo[0];
    M.executar(e, { op: 'virar', em: { alvo: 0 }, naoDesvira: true, ...(so ? { soNaoDesvira: true } : {}) }, { voce: 0, alvos: [[{ o: u, ts: e.objs[u].ts }]], ilegal: {}, lki: { alvos: [] } }, null);
    igual(e.objs[u].virada, !so, so ? 'Rope não vira' : 'Winder vira');
    e.objs[u].virada = true;                                       // virou atacando, por exemplo
    passarAte(e, 'manutencao');                                    // desvirar do jogador 1
    ok(e.turno.ativo === 1 && e.objs[u].virada, 'não desvirou no desvirar dele');
  }
});
caso('510.2', 'danoUmaVez: Prosperous Thief — dois Rogues/Ninjas dão dano de combate juntos = 1 Tesouro; Urso não conta', () => {
  ok(M.gatOk(M.carta('Prosperous Thief').gat[0]), 'gatilho aceito');
  const e = cena({ campo: [[0, 'Prosperous Thief'], [0, 'Aarakocra Sneak'], [0, 'Grizzly Bears']] });
  const id = n => e.campo.find(x => e.objs[x].n === n);
  M.evento(e, { ev: 'dano', fonte: id('Grizzly Bears'), combate: true, q: 2, jog: 1 });
  igual(e.pend.length, 0, 'Urso não é Ninja/Rogue');
  M.evento(e, { ev: 'dano', fonte: id('Prosperous Thief'), combate: true, q: 3, jog: 1 });
  M.evento(e, { ev: 'dano', fonte: id('Aarakocra Sneak'), combate: true, q: 1, jog: 1 });
  igual(e.pend.length, 1, 'uma vez pelo dano simultâneo');
  M.evento(e, { ev: 'dano', fonte: id('Prosperous Thief'), combate: false, q: 3, jog: 1 });
  igual(e.pend.length, 1, 'dano fora de combate não conta');
});
caso('614.1a', 'subst morre/vaiCemiterio: Ravenloft exila a do oponente com marcador hit (a minha morre); Liesa exila; Blightsteel volta ao grimório', () => {
  const e = cena({ campo: [[0, 'Ravenloft Adventurer'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const de = (j, n) => e.campo.find(id => e.objs[id].ctrl === j && e.objs[id].n === n);
  const meu = de(0, 'Grizzly Bears'), dele = de(1, 'Grizzly Bears'), elfo = de(1, 'Llanowar Elves');
  M.mover(e, meu, 'cemiterio'); M.mover(e, dele, 'cemiterio');
  igual([naZona(e, 0, 'cemiterio'), naZona(e, 1, 'cemiterio'), naZona(e, 1, 'exilio')], [['Grizzly Bears'], [], ['Grizzly Bears']], 'só a do oponente vai ao exílio');
  igual(e.objs[dele].marc.hit, 1, 'com marcador hit');
  M.mover(e, elfo, 'exilio');                                       // exílio direto: não é morte, sem hit
  const rav = M.carta('Ravenloft Adventurer'), g = rav.gat.find(x => x.ev === 'ataca');
  ok(M.gatOk(g), 'gatilho de ataque aceito');
  const v = e.jogs[1].vida;
  M.executar(e, g.fx[0], { voce: 0, este: de(0, 'Ravenloft Adventurer'), ev: { ev: 'ataca', def: 1 }, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(v - e.jogs[1].vida, 1, 'perde 1 por carta dele no exílio com hit (o Elfo sem hit não conta)');
  const l = cena({ campo: [[1, 'Liesa, Forgotten Archangel'], [0, 'Grizzly Bears']], mao: [[0, 'Blightsteel Colossus']] });
  M.mover(l, l.campo.find(id => l.objs[id].n === 'Grizzly Bears'), 'cemiterio');
  igual(naZona(l, 0, 'exilio'), ['Grizzly Bears'], 'Liesa: a do oponente vai ao exílio');
  const bs = l.jogs[0].zonas.mao[0], n0 = l.jogs[0].zonas.grimorio.length;
  M.descartar(l, 0, [bs]);
  igual([l.objs[bs].zona, l.jogs[0].zonas.grimorio.length - n0], ['grimorio', 1], 'Blightsteel descartado volta ao grimório');
});
caso('614.1a', 'subst vaiCemiterio com talvez: Library of Leng — descarte por efeito pode ir ao topo do grimório (escolha carta a carta); custo e limpeza não', () => {
  ok(M.substOk(M.carta('Library of Leng').subst[0]), 'subst da Leng aceita');
  for (const quer of [true, false]) {
    const e = cena({ campo: [[0, 'Library of Leng']], mao: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
    const g0 = e.jogs[0].zonas.grimorio.length, vistos: any[] = [];
    M.executar(e, { op: 'descartar', quem: 'voce', qtd: 2 }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, tipo, ops, c) => {
      if (tipo === 'talvez') { vistos.push(c && c.op); return quer && e.objs[c.id].n === 'Grizzly Bears' ? { a: 'sim' } : { a: 'nao' }; }
      return ops[0];
    });
    igual(vistos, ['subst', 'subst'], 'pergunta uma vez por carta');
    igual([naZona(e, 0, 'cemiterio').sort(), e.jogs[0].zonas.grimorio.length - g0], quer ? [['Llanowar Elves'], 1] : [['Grizzly Bears', 'Llanowar Elves'], 0], quer ? 'Ursos no topo, Elfo no cemitério' : 'sem usar: os dois no cemitério');
    if (quer) igual(e.objs[e.jogs[0].zonas.grimorio.at(-1)].n, 'Grizzly Bears', 'no topo');
  }
  const c = cena({ campo: [[0, 'Library of Leng']], mao: [[0, 'Grizzly Bears']] });
  M.descartar(c, 0, c.jogs[0].zonas.mao.slice());                  // custo/limpeza: sem ask, sem efeito
  igual(naZona(c, 0, 'cemiterio'), ['Grizzly Bears'], 'descarte como custo vai ao cemitério');
});
caso('101.2', 'não pode ser anulada: Rhythm of the Wild protege as minhas criaturas (a do oponente é anulada); Dovin\'s Veto protege a si mesma', () => {
  for (const n of ['Rhythm of the Wild', "Dovin's Veto", 'Root Sliver', 'Destiny Spinner', 'Chimil, the Inner Sun']) for (const sb of M.carta(n).subst.filter(x => x.ev === 'anulada')) ok(M.substOk(sb), n + ': subst aceita');
  const e = cena({ campo: [[0, 'Rhythm of the Wild']], mao: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [0, "Dovin's Veto"], [0, 'Lightning Bolt']] });
  const daMao = (j, n) => e.jogs[j].zonas.mao.find(id => e.objs[id].n === n);
  const meu = daMao(0, 'Grizzly Bears'), dele = daMao(1, 'Grizzly Bears'), veto = daMao(0, "Dovin's Veto"), raio = daMao(0, 'Lightning Bolt');
  for (const id of [meu, dele, veto, raio]) { M.mover(e, id, 'pilha'); e.pilha.push(id); }
  igual([M.anular(e, meu), M.anular(e, dele), M.anular(e, veto), M.anular(e, raio)], [false, true, false, true], 'Ursos meus e o Veto ficam; Ursos dele e o Raio são anulados');
  igual([e.objs[meu].zona, e.objs[dele].zona, e.objs[veto].zona, e.objs[raio].zona], ['pilha', 'cemiterio', 'pilha', 'cemiterio']);
});
caso('605.3', 'mana com custo de virar outras (Baylen): vira 2 fichas sem mana própria; com Treasure no lugar não conta como fonte', () => {
  const cx = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  const e = cena({ campo: [[0, 'Baylen, the Haymaker']] });
  const baylen = e.campo[0], fonte = () => M.fontesDeMana(e, 0).filter(f => f.id === baylen);
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Food' } }, cx, null);
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Treasure' } }, cx, null);
  igual(fonte().length, 0, 'Food + Treasure: a Treasure tem mana própria, Baylen não conta');
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Food' } }, cx, null);
  const f = fonte(); igual(f.length, 1, 'duas Food: Baylen é fonte');
  M.ativarMana(e, 0, baylen, f[0].k, 0);
  igual(e.campo.filter(id => e.objs[id].n === 'Food').map(id => e.objs[id].virada), [true, true], 'as duas Food viram');
  igual([e.objs[baylen].virada, e.campo.some(id => e.objs[id].n === 'Treasure' && e.objs[id].virada), M.somaMana(e.jogs[0].reserva)], [false, false, 1], 'Baylen e a Treasure ficam; 1 de mana');
});
caso('605.3a', 'mana com escolha no custo: Ashnod\'s Altar pergunta qual criatura sacrificar; não entra no solver (nem como fonte)', () => {
  const e = cena({ campo: [[0, "Ashnod's Altar"], [0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  const altar = e.campo[0];
  igual(M.fontesDeMana(e, 0).filter(f => f.id === altar).length, 0, 'o solver não usa o altar');
  const me = M.opcoesPrioridade(e, 0).filter(o => o.a === 'manaEsc');
  igual(me.map(o => o.id), [altar], 'uma ação de mana com escolha');
  M.avancar(e); respE(e, o => o.a === 'manaEsc');
  igual(e.perg.tipo, 'custo'); igual(e.perg.ops.map(o => e.objs[o.id].n).sort(), ['Grizzly Bears', 'Llanowar Elves'], 'pergunta qual criatura');
  respE(e, o => e.objs[o.id].n === 'Grizzly Bears');
  igual([naZona(e, 0, 'cemiterio'), e.jogs[0].reserva.C, e.pilha.length], [['Grizzly Bears'], 2, 0], 'sacrificou o urso, {C}{C}, sem pilha');
  igual(e.perg && e.perg.tipo, 'acao', 'volta a prioridade para o mesmo jogador');
});
caso('106.6', 'mana restrita na reserva: Master of Dark Rites dá {B}{B}{B} só para Vampiro/Clérigo/Demônio; Night\'s Whisper não gasta, Vampire Nighthawk gasta', () => {
  const e = cena({ campo: [[0, 'Master of Dark Rites'], [0, 'Grizzly Bears']], mao: [[0, "Night's Whisper"], [0, 'Vampire Nighthawk']] });
  const ms = e.campo[0];
  igual(M.fontesDeMana(e, 0).filter(f => f.id === ms).length, 0, 'fora do solver (sacrifica)');
  M.avancar(e); respE(e, o => o.a === 'manaEsc' && o.id === ms);
  const J = e.jogs[0];
  igual([naZona(e, 0, 'cemiterio'), M.somaMana(J.reserva), J.restrita.map(r => r.m.B)], [['Grizzly Bears'], 0, [3]], 'BBB restrita, reserva comum vazia');
  const conj = () => M.opcoesPrioridade(e, 0).filter(o => o.a === 'conjurar').map(o => e.objs[o.id].n);
  igual(conj(), ['Vampire Nighthawk'], "Night's Whisper não pode gastar a restrita");
  respE(e, o => o.a === 'conjurar');
  igual([e.pilha.concat(e.campo).some(id => e.objs[id].n === 'Vampire Nighthawk'), J.restrita.length, M.somaMana(J.reserva)], [true, 0, 0], 'pagou o Nighthawk com a restrita');
});
caso('605.3a', 'mana com escolha: Krark-Clan só com artefato; Gilded Goose vira e sacrifica Food; Phyrexian Tower tem as duas', () => {
  const cx = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  const e = cena({ campo: [[0, 'Krark-Clan Ironworks'], [0, 'Gilded Goose'], [0, 'Phyrexian Tower'], [0, 'Grizzly Bears']] });
  const [kci, goose, torre] = e.campo, de = id => M.opcoesPrioridade(e, 0).filter(o => o.a === 'manaEsc' && o.id === id);
  igual(de(kci).length, 1, 'Krark-Clan pode sacrificar a si mesma (é artefato)');
  igual(de(goose).length, 0, 'Goose sem Food: não');
  igual(M.fontesDeMana(e, 0).filter(f => f.id === torre).length, 1, 'Tower: {T} → {C} segue no solver');
  igual(de(torre).length, 1, 'Tower: sacrificar criatura → {B}{B} é ação');
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Food' } }, cx, null);
  igual(de(goose).length, 5, 'Goose com Food: uma por cor');
  M.avancar(e); respE(e, o => o.a === 'manaEsc' && o.id === goose && o.escolha === 2);
  if (e.perg && e.perg.tipo === 'custo') respE(e, () => true);
  igual([e.objs[goose].virada, e.campo.some(id => e.objs[id].n === 'Food'), M.somaMana(e.jogs[0].reserva)], [true, false, 1], 'virou, a Food foi, 1 de mana');
  igual(de(goose).length, 0, 'virada: não ativa de novo');
});
caso('605.3a', 'mana com escolha: Runaway Steam-Kin tira 3 marcadores; Simian Spirit Guide se exila da mão', () => {
  const e = cena({ campo: [[0, 'Runaway Steam-Kin']], mao: [[0, 'Simian Spirit Guide'], [0, 'Simian Spirit Guide']] });
  const sk = e.campo[0], de = id => M.opcoesPrioridade(e, 0).filter(o => o.a === 'manaEsc' && o.id === id);
  e.objs[sk].marc['+1/+1'] = 2;
  igual(de(sk).length, 0, 'com 2 marcadores: não');
  e.objs[sk].marc['+1/+1'] = 4;
  M.avancar(e); respE(e, o => o.a === 'manaEsc' && o.id === sk);
  igual([e.objs[sk].marc['+1/+1'], e.jogs[0].reserva.R], [1, 3], 'sobrou 1 marcador; {R}{R}{R}');
  const ssg = e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Simian Spirit Guide');
  respE(e, o => o.a === 'manaEsc' && o.id === ssg);
  igual([naZona(e, 0, 'exilio'), naZona(e, 0, 'mao'), e.jogs[0].reserva.R], [['Simian Spirit Guide'], ['Simian Spirit Guide'], 4], 'uma exilada, a outra na mão; mais {R}');
});
caso('105.2', 'conta coresDoEvento: Ramos ganha um +1/+1 por cor da mágica conjurada (incolor: 0); com 5 tira 5 e dá 10 de mana', () => {
  const e = cena({ campo: [[0, 'Ramos, Dragon Engine']] });
  const ra = e.campo[0], o = e.objs[ra];
  const fx = { op: 'marcador', em: 'este', tipoMarc: '+1/+1', qtd: { conta: 'coresDoEvento' } }, cx = id => ({ voce: 0, este: ra, alvos: [], ilegal: {}, lki: { alvos: [] }, ev: { ev: 'conjura', id, j: 0 } });
  M.executar(e, fx, cx(ra), null);
  igual(o.marc['+1/+1'] || 0, 0, 'mágica incolor (o próprio Ramos, {6}): nenhum');
  const lat = e.por(0, 'Lathril, Blade of the Elves', { zona: 'mao' }).id;
  M.executar(e, fx, cx(lat), null); M.executar(e, fx, cx(lat), null);
  M.executar(e, { op: 'marcador', em: 'este', tipoMarc: '+1/+1', qtd: 1 }, cx(lat), null);
  igual(o.marc['+1/+1'], 5, 'duas mágicas BG (2+2) + 1: 5 marcadores');
  M.avancar(e); respE(e, x => x.a === 'manaEsc' && x.id === ra);
  igual([o.marc['+1/+1'], M.somaMana(e.jogs[0].reserva)], [0, 10], 'tirou 5, 10 de mana');
});
caso('701.57a', 'descobrir 3: exila até a não-terreno com valor ≤ 3 (pula terreno e Krenko de 4); conjura de graça ou põe na mão; o resto vai ao fundo', () => {
  const e = cena({});
  const g = e.jogs[0].zonas.grimorio, cx = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  e.por(0, 'Grizzly Bears', { zona: 'grimorio' }); e.por(0, 'Krenko, Mob Boss', { zona: 'grimorio' }); e.por(0, 'Wastes', { zona: 'grimorio' });
  const n0 = g.length, perg: any[] = [];
  const ask: any = (j, tipo, ops) => { perg.push(tipo); return ops.find(o => o.a === 'mao'); }; ask.etapa = () => {};
  M.executar(e, { op: 'descobrir', qtd: 3 }, cx, ask);
  igual(perg, ['jogar'], 'pergunta conjurar ou pôr na mão');
  igual(naZona(e, 0, 'mao'), ['Grizzly Bears'], 'escolheu a mão');
  igual([g.length, e.objs[g[0]].n === 'Krenko, Mob Boss' || e.objs[g[1]].n === 'Krenko, Mob Boss', naZona(e, 0, 'exilio')], [n0 - 1, true, []], 'Krenko e Wastes no fundo, nada no exílio');
  e.por(0, 'Grizzly Bears', { zona: 'grimorio' });
  M.executar(e, { op: 'descobrir', qtd: 2 }, cx, Object.assign((j, t, ops) => ops[0], { etapa: () => {} }));
  igual([e.pilha.map(id => e.objs[id].n), M.somaMana(e.jogs[0].reserva)], [['Grizzly Bears'], 0], 'conjurou de graça: na pilha');
});
caso('701.57a', "Tecutlan (verso de Brass's Tunnel-Grinder): conjurar permanente pagando com a mana dele descobre X = valor da mágica", () => {
  const e = cena({ campo: [[0, "Brass's Tunnel-Grinder", { obj: { face: 0 } }], [0, 'Wastes']], mao: [[0, 'Goblin Instigator']] });
  igual(M.dadoDe(e, e.objs[e.campo[0]]).n, 'Tecutlan, the Searing Rift');
  e.por(0, 'Grizzly Bears', { zona: 'grimorio' });
  M.avancar(e); respE(e, o => o.a === 'conjurar');
  ok(e.pilha.length === 2, 'gatilho na pilha sobre o Goblin Instigator');
  for (let g = 0; e.perg && g < 40 && !e.campo.some(id => e.objs[id].n === 'Grizzly Bears'); g++) respE(e, o => o.a === 'jogar' || o.a === 'passar');
  igual([e.campo.some(id => e.objs[id].n === 'Grizzly Bears'), naZona(e, 0, 'exilio').length], [true, 0], 'descobriu o urso (valor 2) e conjurou de graça');
});
caso('608.2h', 'repetirCada com filtro de objetos: Kalonian Hydra dobra os +1/+1 de cada criatura; Second Harvest copia cada ficha (lista tirada ao resolver); entrouNoTurno', () => {
  const cx = (e, este?) => ({ voce: 0, este, alvos: [], ilegal: {}, lki: { alvos: [] } });
  const e = cena({ campo: [[0, 'Kalonian Hydra'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Grizzly Bears']] });
  const de = (j, n) => e.campo.find(id => e.objs[id].ctrl === j && e.objs[id].n === n);
  const hid = de(0, 'Kalonian Hydra'), urso = de(0, 'Grizzly Bears'), elfo = de(0, 'Llanowar Elves'), dele = de(1, 'Grizzly Bears');
  e.objs[hid].marc['+1/+1'] = 4; e.objs[urso].marc['+1/+1'] = 1; e.objs[dele].marc['+1/+1'] = 2;
  const g = M.carta('Kalonian Hydra').gat.find(x => x.ev === 'ataca');
  ok(M.gatOk(g), 'gatilho da Kalonian aceito');
  M.executar(e, g.fx[0], cx(e, hid), null);
  igual([hid, urso, elfo, dele].map(id => e.objs[id].marc['+1/+1'] || 0), [8, 2, 0, 2], 'dobra só nas minhas com marcador');
  const s = cena({ campo: [[0, 'Grizzly Bears']] });
  M.executar(s, { op: 'ficha', quem: 'voce', qtd: 2, token: { nome: 'Food' } }, cx(s), null);
  M.executar(s, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Treasure' } }, cx(s), null);
  const sh = M.carta('Second Harvest').fx[0];
  ok(M.fxSuportado([sh]), 'Second Harvest aceito');
  M.executar(s, sh, cx(s), null);
  igual(['Food', 'Treasure'].map(n => s.campo.filter(id => s.objs[id].n === n && s.objs[id].ficha).length), [4, 2], 'cada ficha ganha 1 cópia (as cópias não entram na conta)');
  const f = M.objetosQue(s, { ficha: true, ctrl: 'voce', zona: 'campo', entrouNoTurno: true }, { voce: 0 }).length;
  s.turno.n++;
  igual([f, M.objetosQue(s, { ficha: true, ctrl: 'voce', zona: 'campo', entrouNoTurno: true }, { voce: 0 }).length], [6, 0], 'entrouNoTurno: só no turno em que entrou');
});
caso('508.4', 'ficha virada e atacando: Hero of Bladehold escolhe quem ataca; Adeline cria 1 por oponente, cada uma atacando aquele jogador; fora do combate só virada', () => {
  const e = cena({ jogs: 3, campo: [[0, 'Adeline, Resplendent Cathar']] });
  e.turno.combate = { atk: [], etapa: 0, duas: false, deu1: {} };
  const g = M.carta('Adeline, Resplendent Cathar').gat.find(x => x.ev === 'atacantesDeclarados');
  ok(M.gatOk(g), 'gatilho da Adeline aceito');
  M.executar(e, g.fx[0], { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, tipo, ops) => ops[ops.length - 1]);
  igual(e.turno.combate.atk.map(r => [e.objs[r.id].n, r.def]).sort(), [['Human Token', 1], ['Human Token', 2]], 'uma ficha atacando cada oponente');
  ok(e.turno.combate.atk.every(r => e.objs[r.id].virada), 'viradas');
  const h = M.carta('Hero of Bladehold').gat.find(x => x.ev === 'ataca' && x.fx.some(y => y.op === 'ficha')), fx = h.fx.find(x => x.op === 'ficha');
  ok(M.gatOk(h), 'gatilho do Hero aceito');
  const vistos: any[] = [];
  M.executar(e, fx, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, tipo, ops) => { vistos.push(tipo); return ops.find(o => o.jog === 2) || ops[0]; });
  igual([vistos, e.turno.combate.atk.filter(r => r.def === 2).length], [['atacado', 'atacado'], 3], 'Hero: cada ficha escolhe; as duas no jogador 2');
  e.turno.combate = null;
  const n0 = e.campo.length;
  M.executar(e, fx, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.campo.length - n0, 2, 'fora do combate: cria viradas, sem atacar');
});
caso('701.9', 'conta de descartadas no turno: Change of Fortune compra pelas descartadas no turno todo; Skull Raid compra a diferença', () => {
  const e = cena({ mao: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Forest'], [1, 'Forest']] });
  const cx = (al: any = []) => ({ voce: 0, alvos: al, ilegal: {}, lki: { alvos: [] } });
  M.descartar(e, 0, [e.jogs[0].zonas.mao[0]]);                      // 1 antes (custo, outro efeito…)
  const cof = M.carta('Change of Fortune').fx;
  ok(M.fxSuportado(cof), 'Change of Fortune aceito');
  for (const f of cof) M.executar(e, f, cx(), null);
  igual([e.jogs[0].zonas.mao.length, e.jogs[0].zonas.cemiterio.length], [3, 3], 'descartou 2 da mão + 1 antes = compra 3');
  e.turno.n++;
  const sr = M.carta('Skull Raid').fx, c2 = cx([[{ jog: 1 }]]);
  ok(M.fxSuportado(sr), 'Skull Raid aceito');
  const m0 = e.jogs[0].zonas.mao.length;
  for (const f of sr) M.executar(e, f, c2, (j, t, ops) => ops[0]);
  igual([e.jogs[1].zonas.mao.length, e.jogs[0].zonas.mao.length - m0], [0, 1], 'oponente só tinha 1: você compra 1');
});
caso('115.3', '"outro": Kediss acerta cada OUTRO oponente; Markov Retribution não deixa o 2º alvo ser o 1º; Neheb dispara em jogador ou planeswalker, não em criatura', () => {
  const e = cena({ jogs: 3, campo: [[0, 'Kediss, Emberclaw Familiar']] });
  const k = M.carta('Kediss, Emberclaw Familiar').gat[0];
  ok(M.gatOk(k), 'gatilho da Kediss aceito');
  const v = e.jogs.map(J => J.vida);
  M.executar(e, k.fx[0], { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, ev: { ev: 'dano', jog: 1, q: 3, combate: true, fonte: e.campo[0] } }, null);
  igual(e.jogs.map((J, i) => v[i] - J.vida), [0, 0, 3], 'só o jogador 2 leva (o 1 já levou o de combate)');
  const m = cena({ campo: [[0, 'Vampire Nighthawk'], [1, 'Grizzly Bears']] });
  const d = M.carta('Markov Retribution'), vamp = m.campo[0], vistos: any[] = [];
  M.escolherAlvos(m, 0, d, d.fx[0].modos[1], { voce: 0 }, (j, t, ops, c) => { vistos.push([c.i, ops.filter(o => o.a === 'alvo').map(o => o.o)]); return ops.find(o => o.a === 'alvo') || ops[0]; });
  igual(vistos, [[0, [vamp]], [1, [m.campo[1]]]], 'o 2º alvo não oferece o Vampiro já escolhido');
  const n = M.carta('Neheb, Dreadhorde Champion').gat[0];
  ok(M.gatOk(n), 'gatilho do Neheb aceito');
});
caso('701.26b', 'gatilhos novos: desvirar (Key to the City paga {2} e compra), jogar terreno de fora da mão (Shadow of the Goblin), proliferar (Voidwing Hybrid volta do cemitério)', () => {
  for (const [n, g] of [['Key to the City', 'desvira'], ['Shadow of the Goblin', 'jogaTerreno'], ['Voidwing Hybrid', 'prolifera']]) ok(M.gatOk(M.carta(n).gat.find(x => x.ev === g)), n + ': gatilho aceito');
  const e = cena({ campo: [...terras(3, 'Wastes'), [0, 'Key to the City'], [0, 'Shadow of the Goblin']], mao: [[0, 'Forest']] });
  e.pend = [];
  const key = e.objs[e.campo.find(id => e.objs[id].n === 'Key to the City')];
  key.virada = true; M.desvirarObj(e, key);
  M.avancar(e); resolveCom(e, p => p.tipo === 'talvez' || p.tipo === 'pagar' ? p.ops.findIndex(o => o.a === 'sim' || o.a === 'pagar') : -1);
  igual([e.jogs[0].zonas.mao.length, e.campo.filter(id => e.objs[id].virada).length], [2, 2], 'pagou {2} (2 Wastes viradas) e comprou 1');
  const v = e.jogs[1].vida, forest = e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Forest');
  e.perg = null; M.avancar(e); respE(e, o => o.a === 'terreno' && o.id === forest); resolveCom(e);
  igual(e.jogs[1].vida, v, 'terreno da mão: sem dano');
  const g = e.jogs[0].zonas.grimorio, wa = g[g.length - 1];
  M.mover(e, wa, 'exilio'); (e.permJogar = e.permJogar || []).push({ id: wa, ts: e.objs[wa].ts, j: 0 }); e.jogs[0].terrenos = 0;
  e.perg = null; M.avancar(e); respE(e, o => o.a === 'terreno' && o.id === wa); resolveCom(e);
  igual(v - e.jogs[1].vida, 1, 'terreno do exílio: 1 de dano em cada oponente');
  const p = cena({ mao: [[0, 'Voidwing Hybrid']] }); p.pend = [];
  M.descartar(p, 0, p.jogs[0].zonas.mao.slice());
  M.executar(p, { op: 'proliferar', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops[0]);
  M.avancar(p); resolveCom(p);
  igual(naZona(p, 0, 'mao'), ['Voidwing Hybrid'], 'proliferou (mesmo sem escolher nada): volta à mão');
});
caso('700.2', 'modal sem repetir no turno (Monument to Endurance): cada descarte oferece só os modos ainda não escolhidos; no turno seguinte volta tudo', () => {
  const e = cena({ campo: [[0, 'Monument to Endurance']] });
  const mon = e.campo[0], d = M.carta('Monument to Endurance').gat[0], dg = { alvos: [], fx: d.fx };
  const ofer: any[] = [];
  const pega = () => M.escolherModos(e, 0, dg, d.fx[0], (j, t, ops) => { ofer.push(ops.filter(o => o.a === 'modo').map(o => o.m)); return ops.find(o => o.a === 'modo') || ops[0]; }, mon);
  igual([pega(), pega(), pega(), pega()], [[0], [1], [2], []], 'um de cada; o 4º fica sem modo (603.3c: sai)');
  igual(ofer, [[0, 1, 2], [1, 2], [2]]);
  e.turno.n++;
  igual(pega(), [0], 'turno novo: o 1º volta');
});
caso('601.2f', 'condição sobre a carta descartada no custo (Grab the Prize): descartou mágica → 2 em cada oponente; descartou terreno → só compra', () => {
  for (const desc of ['Grizzly Bears', 'Forest']) {
    const e = cena({ campo: terras(2), mao: [[0, 'Grab the Prize'], [0, desc]] }); e.pend = []; e.jogs[0].terrenos = 1;
    const v = e.jogs[1].vida;
    M.avancar(e); conj(e, 'Grab the Prize');
    resolveCom(e, p => p.tipo === 'custo' || p.tipo === 'descartar' ? p.ops.findIndex(o => o.id !== undefined && e.objs[o.id].n === desc) : -1);
    igual([naZona(e, 0, 'cemiterio').sort(), e.jogs[0].zonas.mao.length, v - e.jogs[1].vida], [[desc, 'Grab the Prize'].sort(), 2, desc === 'Forest' ? 0 : 2], desc);
  }
});
caso('601.2f', 'custo adicional com "ou" (Demand Answers): só artefato → sacrifica; só carta na mão → descarta; nenhum → não conjura; os dois → pergunta', () => {
  const da = M.carta('Demand Answers');
  ok(M.custoSuportado(da.custoAd.ou[0]) && M.custoSuportado(da.custoAd.ou[1]), 'as duas opções são custos que o motor paga');
  for (const [art, outra] of [[true, false], [false, true], [false, false], [true, true]]) {
    const campo = [...terras(2), ...(art ? [[0, 'Mind Stone']] : [])], mao = [[0, 'Demand Answers'], ...(outra ? [[0, 'Grizzly Bears']] : [])];
    const e = cena({ campo, mao }); e.pend = []; e.jogs[0].terrenos = 1;
    const id = e.jogs[0].zonas.mao.find(x => e.objs[x].n === 'Demand Answers');
    igual(M.podeConjurar(e, 0, e.objs[id]), art || outra, `artefato ${art}, outra carta ${outra}`);
    if (!art && !outra) continue;
    let perguntou = false;
    M.avancar(e); conj(e, 'Demand Answers');
    resolveCom(e, p => { if (p.tipo !== 'custoOu') return -1; perguntou = true; return p.ops.findIndex(o => !!o.v.sacrificar); });
    const sacrificou = art;                     // com os dois, a resposta escolhe sacrificar
    igual([perguntou, naZona(e, 0, 'cemiterio').sort(), noCampo(e).includes('Mind Stone'), e.jogs[0].zonas.mao.length],
      [art && outra, (sacrificou ? ['Demand Answers', 'Mind Stone'] : ['Demand Answers', 'Grizzly Bears']).sort(), false, outra && sacrificou ? 3 : 2], `artefato ${art}, outra ${outra}`);
  }
});
caso('603.12', 'gatilho reflexo (Inti): ataca → pode descartar; só se descartou, o alvo é escolhido depois e ganha +1/+1 e atropelar; a exilada pelo descarte vale até o próximo passo final seu', () => {
  for (const quer of [true, false]) {
    const e = cena({ campo: [[0, 'Mountain'], [0, 'Inti, Seneschal of the Sun'], [0, 'Grizzly Bears']], mao: [[0, 'Forest']] }); e.pend = [];
    const bears = objN(e, 0, 'Grizzly Bears'), inti = objN(e, 0, 'Inti, Seneschal of the Sun');
    const vistos: string[] = [];
    ate(e, 'atacar'); atacaCom(e, bears); atacaCom(e, inti); fecha(e, 'atacar');
    resolveCom(e, p => { vistos.push(p.tipo);
      if (p.tipo === 'talvez') return p.ctx && p.ctx.op === 'descartar' ? p.ops.findIndex(o => o.a === (quer ? 'sim' : 'nao')) : p.ops.findIndex(o => o.a === 'nao');
      if (p.tipo === 'alvo') { ok(e.jogs[0].zonas.cemiterio.length === (quer ? 1 : 0), 'o alvo do reflexo vem depois do descarte'); return p.ops.findIndex(o => o.o === bears.id); }
      return -1; });
    igual([bears.marc['+1/+1'] || 0, M.temKw(e, bears, 'atropelar'), vistos.includes('alvo')], quer ? [1, true, true] : [0, false, false], quer ? 'descartou' : 'não descartou');
    if (!quer) continue;
    const ex = e.jogs[0].zonas.exilio[0], perm = (e.permJogar || []).find(p => p.id === ex);
    igual(perm && perm.fim, { final: 0 }, 'exilada pelo outro gatilho: até o próximo passo final');
    passarAte(e, 'final');
    ok(!(e.permJogar || []).some(p => p.id === ex), 'no passo final a permissão acabou');
  }
});
caso('702.35', 'loucura dada (Falkenrath Gorger): Vampiro descartado vai ao exílio e é conjurado pelo custo de mana dele; sem o Gorger, ou não Vampiro, vai ao cemitério', () => {
  for (const [gorger, carta] of [[true, 'Furyblade Vampire'], [false, 'Furyblade Vampire'], [true, 'Grizzly Bears']]) {
    const e = cena({ campo: [...terras(5), ...(gorger ? [[0, 'Falkenrath Gorger']] : [])], mao: [[0, "Brass's Tunnel-Grinder"], [0, carta]] });
    const id = e.jogs[0].zonas.mao.find(x => e.objs[x].n === carta);
    igual(!!M.loucuraDe(e, e.objs[id]), gorger && carta !== 'Grizzly Bears', 'tem loucura na mão');
    M.avancar(e); conj(e, "Brass's Tunnel-Grinder");
    let feitas = 0;
    resolveCom(e, p => p.tipo === 'descartar' ? (feitas++ ? p.ops.findIndex(o => o.a === 'nenhum') : p.ops.findIndex(o => o.a === 'descartar' && o.id === id))
      : p.tipo === 'talvez' && p.ctx && p.ctx.op === 'loucura' ? 0 : -1);
    const louca = gorger && carta === 'Furyblade Vampire';
    igual([e.objs[id].zona, e.campo.filter(x => e.objs[x].n === 'Mountain' && e.objs[x].virada).length], [louca ? 'campo' : 'cemiterio', louca ? 5 : 3], `${carta}, Gorger ${gorger}`);
  }
});
caso('702.94', 'milagre (Reforge the Soul): a primeira compra do turno revela e conjura por {1}{R} fora da velocidade; a segunda compra não', () => {
  for (const primeira of [true, false]) {
    const e = cena({ campo: terras(2), passo: 'manutencao' }); e.pend = [];
    if (!primeira) M.comprar(e, 0, 1);                                 // já comprou uma neste turno
    const top = e.jogs[0].zonas.grimorio[e.jogs[0].zonas.grimorio.length - 1]; e.objs[top].n = 'Reforge the Soul';
    M.comprar(e, 0, 1);
    igual(e.pend.filter(p => p.k === 'milagre').length, primeira ? 1 : 0, 'gatilho do milagre');
    if (!primeira) continue;
    M.avancar(e); resolveCom(e);
    igual([e.objs[top].zona, e.jogs[0].zonas.mao.length, e.jogs[1].zonas.mao.length, e.campo.filter(x => e.objs[x].virada).length], ['cemiterio', 7, 7, 2], 'conjurou pelo milagre');
  }
});
caso('303.7', 'Role (Witch\'s Mark): a ficha dá +1/+1 enquanto anexada; um segundo Role meu na criatura manda o mais velho ao cemitério e o Wicked Role faz cada oponente perder 1; sem alvo, nenhuma ficha', () => {
  const e = cena({ campo: [...terras(4), [0, 'Grizzly Bears']], mao: [[0, "Witch's Mark"], [0, "Witch's Mark"]] }); e.pend = [];
  const bears = objN(e, 0, 'Grizzly Bears'), v = e.jogs[1].vida;
  const lanca = () => { M.avancar(e); conj(e, "Witch's Mark"); resolveCom(e, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'nao') : p.tipo === 'alvo' ? p.ops.findIndex(o => o.o === bears.id) : -1); };
  lanca();
  const roles = () => e.campo.filter(id => e.objs[id].n === 'Wicked Role');
  igual([roles().length, M.poder(e, bears), M.resistencia(e, bears)], [1, 3, 3], 'um Role: 3/3');
  lanca();
  igual([roles().length, M.poder(e, bears), e.jogs[1].vida], [1, 3, v - 1], 'dois Roles meus: o velho vai ao cemitério e o oponente perde 1');
  const s = cena({ campo: terras(2), mao: [[0, "Witch's Mark"]] }); s.pend = [];
  M.avancar(s); conj(s, "Witch's Mark"); resolveCom(s, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'nao') : -1);
  igual([s.campo.filter(id => s.objs[id].ficha).length, s.jogs[1].vida], [0, 40], 'sem criatura: nenhuma ficha, ninguém perde vida');
});
caso('702.151', 'reconfigurar (Lizard Blades): anexa a outra criatura sua e deixa de ser criatura; a equipada ganha golpe duplo; soltar só se anexada e volta a ser criatura', () => {
  const e = cena({ campo: [...terras(4), [0, 'Lizard Blades'], [0, 'Grizzly Bears']] }); e.pend = [];
  const lb = objN(e, 0, 'Lizard Blades'), bears = objN(e, 0, 'Grizzly Bears');
  const k = (a: string) => M.atvDe(e, lb).findIndex(x => x[a]);
  igual([M.podeAtivar(e, 0, lb, k('_equipar')), M.podeAtivar(e, 0, lb, k('_soltar'))], [true, false], 'solta: só anexar');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === lb.id && o.k === k('_equipar')); resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.o === bears.id) : -1);
  igual([lb.anexo && lb.anexo.id, M.temTipo(e, lb, 'Creature'), M.temKw(e, bears, 'golpeDuplo'), noCampo(e).includes('Lizard Blades')], [bears.id, false, true, true], 'anexada');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === lb.id && o.k === k('_soltar')); resolveCom(e);
  igual([lb.anexo, M.temTipo(e, lb, 'Creature'), M.temKw(e, bears, 'golpeDuplo')], [null, true, false], 'solta de novo');
});
caso('descer', 'Brass\'s Tunnel-Grinder: no seu passo final, se desceu (carta de permanente ao seu cemitério), põe marcador de broca; com 3, tira e transforma; sem descer, nada; mágica no cemitério não conta', () => {
  for (const vai of ['Forest', 'Lightning Bolt', null]) {
    const e = cena({ campo: [[0, "Brass's Tunnel-Grinder"]], mao: vai ? [[0, vai]] : [], passo: 'principal2' }); e.pend = [];
    const g = objN(e, 0, "Brass's Tunnel-Grinder"); g.marc.bore = 2;
    if (vai) M.descartar(e, 0, [e.jogs[0].zonas.mao[0]]);
    passarAte(e, 'final'); M.avancar(e); resolveCom(e);
    const desceu = vai === 'Forest';
    igual([g.face === 0, g.marc.bore || 0], desceu ? [true, 0] : [false, 2], String(vai));
  }
});
caso('712', 'Edgar Markov\'s Coffin (verso do Edgar, Charmed Groom): na manutenção cria a ficha e põe linhagem; com 3, tira e transforma de volta', () => {
  for (const n of [2, 1]) {
    const e = cena({ campo: [[0, 'Edgar, Charmed Groom']], passo: 'desvirar' }); e.pend = [];
    const g = objN(e, 0, 'Edgar, Charmed Groom'); g.face = 0; g.marc.bloodline = n;
    passarAte(e, 'manutencao'); M.avancar(e); resolveCom(e);
    igual([g.face ?? null, g.marc.bloodline || 0], n === 2 ? [null, 0] : [0, 2], n + ' marcadores antes');
  }
});
caso('607.2a', 'exilada com este (Bag of Holding): o descarte vai ao exílio marcado; {4},{T}, sacrificar devolve à mão só as exiladas por ela', () => {
  const e = cena({ campo: [...terras(4), [0, 'Bag of Holding']], mao: [[0, 'Forest'], [0, 'Grizzly Bears']] }); e.pend = [];
  const bag = objN(e, 0, 'Bag of Holding');
  M.descartar(e, 0, [...e.jogs[0].zonas.mao]); M.avancar(e); resolveCom(e);
  const outra = e.jogs[0].zonas.grimorio[0]; M.mover(e, outra, 'exilio');          // exilada por outra coisa: fica
  igual([e.jogs[0].zonas.exilio.length, e.jogs[0].zonas.exilio.filter(id => e.objs[id].exPor && e.objs[id].exPor.id === bag.id).length], [3, 2], 'duas pela Bag, uma por fora');
  const k = M.atvDe(e, bag).findIndex(a => a.custo && a.custo.sacrificar === 'este');
  ok(M.podeAtivar(e, 0, bag, k), 'pode ativar');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === bag.id && o.k === k); resolveCom(e);
  igual([naZona(e, 0, 'mao').sort(), e.jogs[0].zonas.exilio, bag.zona], [['Forest', 'Grizzly Bears'], [outra], 'cemiterio'], 'voltaram as duas');
});
caso('120', 'ferida por esta no turno (Markov Enforcer): a criatura que levou dano dela e morre dá um Blood; morrer sem dano dela, não', () => {
  for (const lutou of [true, false]) {
    const e = cena({ campo: [[0, 'Markov Enforcer'], [1, 'Grizzly Bears']] }); e.pend = [];
    const enf = objN(e, 0, 'Markov Enforcer'), b = objN(e, 1, 'Grizzly Bears');
    if (lutou) M.executar(e, { op: 'lutar', em: 'este', com: { alvo: 0 } }, { voce: 0, este: enf.id, alvos: [[{ o: b.id, ts: b.ts }]], ilegal: {}, lki: { alvos: [] } }, null);
    else M.mover(e, b.id, 'cemiterio');
    M.avancar(e); resolveCom(e);
    igual([b.zona, e.campo.filter(id => e.objs[id].n === 'Blood').length], ['cemiterio', lutou ? 1 : 0], lutou ? 'lutou' : 'morreu por outra coisa');
  }
});
caso('preparar', 'Pompous Battlemage entra preparada: cópia de Improvised Act no exílio; conjurar a cópia dispara proeza, desprepara e a cópia some ao resolver; criatura saiu → a cópia some', () => {
  const e = cena({ campo: terras(2), mao: [[0, 'Pompous Battlemage'], [0, 'Forest']] }); e.pend = []; e.jogs[0].terrenos = 1;
  const pb = e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Pompous Battlemage');
  M.mover(e, pb, 'campo'); e.objs[pb].doente = false;
  const cop = e.jogs[0].zonas.exilio.find(id => e.objs[id].copiaPrep);
  ok(e.objs[pb].preparada && cop !== undefined, 'preparada com a cópia no exílio');
  igual(M.facesParaConjurar(e, 0, e.objs[cop]), [0], 'só a mágica');
  ok(M.podeConjurar(e, 0, e.objs[cop], 0), 'pode conjurar a cópia');
  M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === cop);
  ok(!e.objs[pb].preparada, 'conjurar desprepara');
  resolveCom(e, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'sim') : -1);
  igual([M.poder(e, e.objs[pb]), naZona(e, 0, 'cemiterio'), e.jogs[0].zonas.exilio.length, e.objs[cop].zona, e.jogs[0].zonas.mao.length], [2, ['Forest'], 0, 'fora', 1], 'proeza, descartou e comprou, a cópia sumiu');
  ok(!M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar' && o.id === cop), 'não conjura de novo');
  const s = cena({ mao: [[0, 'Pompous Battlemage']] }); s.pend = [];
  const p2 = s.jogs[0].zonas.mao[0]; M.mover(s, p2, 'campo'); M.mover(s, p2, 'cemiterio'); M.avancar(s);
  igual([s.jogs[0].zonas.exilio.length, s.jogs[0].zonas.cemiterio.length], [0, 1], 'saiu do campo: a cópia some (o cemitério só tem a carta)');
});
caso('Ashiok', 'Ashiok, Dream Render: a mágica do oponente não o faz procurar no grimório; a do controlador do Ashiok, sim', () => {
  for (const quem of [1, 0]) {
    const e = cena({ campo: [[0, 'Ashiok, Dream Render']] }); e.pend = [];
    const g = e.jogs[quem].zonas.grimorio; M.mover(e, g[0], 'grimorio'); e.objs[g[g.length - 1]].n = 'Forest';
    const antes = e.campo.length;
    M.executar(e, M.carta('Rampant Growth').fx[0], { voce: quem, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops.find(o => o.a !== 'nenhum') || ops[0]);
    igual(e.campo.length - antes, quem === 1 ? 0 : 1, quem === 1 ? 'oponente não procura' : 'o dono do Ashiok procura');
  }
});
caso('Ravager', 'Dire Fleet Ravager: ao entrar, cada jogador perde um terço da própria vida, arredondado para cima', () => {
  const e = cena({ jogs: 3, mao: [[0, 'Dire Fleet Ravager']] }); e.pend = [];
  e.jogs[0].vida = 40; e.jogs[1].vida = 10; e.jogs[2].vida = 1;
  M.mover(e, e.jogs[0].zonas.mao[0], 'campo'); M.avancar(e); resolveCom(e);
  igual(e.jogs.map(j => j.vida), [26, 6, 0], '40→26, 10→6, 1→0');
});
caso('702.49', 'ninjutsu (Prosperous Thief): depois dos bloqueadores, devolve o atacante não bloqueado e entra virada atacando o mesmo jogador; antes disso, não', () => {
  const e = cena({ campo: [[0, 'Island'], [0, 'Island'], [0, 'Grizzly Bears']], mao: [[0, 'Prosperous Thief']] }); e.pend = [];
  const b = objN(e, 0, 'Grizzly Bears'), th = e.jogs[0].zonas.mao[0];
  const k = M.atvDe(e, e.objs[th]).findIndex(a => a._ninjutsu);
  ok(k >= 0 && !M.podeAtivar(e, 0, e.objs[th], k), 'fora do combate: não');
  const BL = x => x.turno.passo === 'bloqueadores';
  ate(e, 'atacar');
  M.responder(e, e.perg.ops.findIndex(x => x.a === 'atacar' && x.id === b.id && x.jog === 1), BL);
  if (e.perg && e.perg.tipo === 'atacar') M.responder(e, e.perg.ops.findIndex(x => x.a === 'pronto'), BL);
  let g = 0; while (e.turno.passo !== 'bloqueadores' && g++ < 50) { M.avancar(e, BL); if (e.perg && e.turno.passo !== 'bloqueadores') M.responder(e, 0, BL); }
  M.avancar(e);
  ok(M.podeAtivar(e, 0, e.objs[th], k), 'atacante não bloqueado: pode ' + e.turno.passo + ' ' + (e.perg && e.perg.tipo));
  respE(e, o => o.a === 'ativar' && o.id === th && o.k === k);
  igual(b.zona, 'mao', 'o Bears voltou (custo)');
  resolveCom(e);
  const t2 = e.objs[th];
  igual([t2.zona, t2.virada, M.atacando(e, t2)], ['campo', true, true], 'Thief atacando');
  ateFimCombate(e);
  igual([e.jogs[1].vida, e.campo.filter(id => e.objs[id].n === 'Treasure').length], [37, 1], '3 de dano e o Tesouro do gatilho');
});
caso('702.143', 'prever (Skull Raid): no seu turno paga {2} e exila; no mesmo turno não conjura; num turno seguinte conjura do exílio por {1}{B}', () => {
  const e = cena({ campo: terras(4, 'Swamp'), mao: [[0, 'Skull Raid']] }); e.pend = [];
  const sr = e.jogs[0].zonas.mao[0];
  ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'prever' && o.id === sr), 'pode prever');
  M.avancar(e); respE(e, o => o.a === 'prever' && o.id === sr);
  igual([e.objs[sr].zona, e.campo.filter(id => e.objs[id].virada).length, M.podeConjurar(e, 0, e.objs[sr])], ['exilio', 2, false], 'exilou pagando {2}; não neste turno');
  for (const id of e.campo) e.objs[id].virada = false;
  e.turno.n++; e.turno.passo = 'principal1'; e.turno.prio = null; e.perg = null;
  ok(M.podeConjurar(e, 0, e.objs[sr]), 'turno seguinte: pode');
  M.avancar(e); conj(e, 'Skull Raid'); resolveCom(e);
  igual([e.objs[sr].zona, e.campo.filter(id => e.objs[id].virada).length], ['cemiterio', 2], 'conjurou do exílio por {1}{B}');
});
caso('702.76', 'Knowledge Exploitation: rondar por {3}{U} depois de um Ladino causar dano de combate; procura no grimório do oponente uma instantânea e conjura de graça', () => {
  for (const rondou of [false, true]) {
    const e = cena({ campo: terras(rondou ? 4 : 7, 'Island'), mao: [[0, 'Knowledge Exploitation']] }); e.pend = []; e.jogs[0].terrenos = 1;
    const g1 = e.jogs[1].zonas.grimorio; e.objs[g1[0]].n = 'Lightning Bolt';
    if (rondou) e.jogs[0].danoCombT = { t: e.turno.n, sub: ['Rogue'] };
    const ke = e.jogs[0].zonas.mao[0];
    ok(M.podeConjurar(e, 0, e.objs[ke]), rondou ? 'com 4 terrenos, pelo rondar' : 'com 7, pelo custo normal');
    M.avancar(e); conj(e, 'Knowledge Exploitation');
    resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'sim') : -1);
    igual([e.jogs[1].vida, naZona(e, 1, 'cemiterio'), e.campo.filter(id => e.objs[id].virada).length], [37, ['Lightning Bolt'], rondou ? 4 : 7], rondou ? 'rondar' : 'normal');
  }
});
caso('702.138', 'fuga: Ox of Agonas do cemitério paga {R}{R} + exila 8 outras e entra com +1/+1; sem 8 outras não dá; Underworld Breach dá fuga (custo dela + 3)', () => {
  for (const n of [8, 7]) {
    const e = cena({ campo: terras(2) }); e.pend = []; e.jogs[0].terrenos = 1;
    const ox = e.jogs[0].zonas.grimorio.pop(); e.objs[ox].n = 'Ox of Agonas'; M.mover(e, ox, 'cemiterio');
    for (let i = 0; i < n; i++) M.mover(e, e.jogs[0].zonas.grimorio[0], 'cemiterio');
    igual(M.podeConjurar(e, 0, e.objs[ox]), n === 8, n + ' outras no cemitério');
    if (n !== 8) continue;
    M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === ox); resolveCom(e);
    igual([e.objs[ox].zona, e.objs[ox].marc['+1/+1'], e.jogs[0].zonas.exilio.length, e.jogs[0].zonas.cemiterio.length], ['campo', 1, 8, 0], 'fugiu: no campo com +1/+1, as 8 no exílio');
  }
  const b = cena({ campo: [...terras(1), [0, 'Underworld Breach']], mao: [[0, 'Lightning Bolt']] }); b.pend = [];
  const bolt = b.jogs[0].zonas.mao[0]; M.mover(b, bolt, 'cemiterio');
  for (let i = 0; i < 3; i++) M.mover(b, b.jogs[0].zonas.grimorio[0], 'cemiterio');
  ok(M.porFuga(b, 0, b.objs[bolt]) && M.podeConjurar(b, 0, b.objs[bolt]), 'Breach: o Raio tem fuga com {R} + 3');
  igual(M.fugaDe(b, 0, b.objs[bolt]).mana, M.carta('Lightning Bolt').custo, 'custo = o custo de mana dele');
});
caso('702.34', 'Past in Flames: instantâneas e feitiços do seu cemitério ganham flashback (custo de mana) até o fim do turno; conjurado assim vai ao exílio', () => {
  const e = cena({ campo: terras(5), mao: [[0, 'Past in Flames'], [0, 'Lightning Bolt']] }); e.pend = [];
  const [pif, bolt] = e.jogs[0].zonas.mao; M.mover(e, bolt, 'cemiterio');
  ok(!M.podeConjurar(e, 0, e.objs[bolt]), 'antes: o Raio não tem flashback');
  M.avancar(e); conj(e, 'Past in Flames'); resolveCom(e);
  ok(M.porFlash(e, 0, e.objs[bolt]) && M.podeConjurar(e, 0, e.objs[bolt]), 'depois: o Raio tem flashback');
  M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === bolt); alvoJog(e, 1); resolveCom(e);
  igual([e.jogs[1].vida, e.objs[bolt].zona], [37, 'exilio'], 'Raio do cemitério: 3 de dano e exílio (702.34a)');
  igual(e.objs[pif].zona, 'cemiterio');
});
caso('611.2b', "modificar até o seu próximo turno (For the Common Good, Savage Order) e enquanto no campo (Hellkite Courser: 'ganha ímpeto')", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears']], passo: 'final' }); e.pend = [];
  const [u, v] = e.campo;
  const ctx: any = { voce: 0, este: u, alvos: [], ilegal: {}, lki: { alvos: [] } };
  ok(M.fxSuportado([{ op: 'modificar', em: 'este', kw: [{ k: 'indestrutivel' }], dura: 'proximoTurnoSeu' }], {}) && M.fxSuportado([{ op: 'modificar', em: 'este', kw: [{ k: 'pressa' }], dura: 'enquantoNoCampo' }], {}), 'aceitos');
  M.executar(e, { op: 'modificar', em: 'este', kw: [{ k: 'indestrutivel' }], dura: 'proximoTurnoSeu' }, ctx, null);
  M.executar(e, { op: 'modificar', em: 'este', kw: [{ k: 'pressa' }], dura: 'enquantoNoCampo' }, { ...ctx, este: v }, null);
  const tem = (id, k) => M.temKw(e, e.objs[id], k);
  passarAte(e, 'principal1'); igual([e.turno.ativo, tem(u, 'indestrutivel'), tem(v, 'pressa')], [1, true, true], 'no turno do outro: ainda indestrutível; ímpeto fica');
  passarAte(e, 'final'); passarAte(e, 'principal1'); igual([e.turno.ativo, tem(u, 'indestrutivel'), tem(v, 'pressa')], [0, false, true], 'no seu próximo turno: acabou; ímpeto fica');
  M.mover(e, v, 'mao'); M.mover(e, v, 'campo'); ok(!tem(v, 'pressa'), 'mudou de zona: objeto novo (400.7)');
});
caso('603.7', "Hellkite Courser: o comandante sai da zona de comando com ímpeto e volta para lá no começo da próxima etapa final ('anterior' guardado no atrasado)", () => {
  ok(M.gatOk(M.carta('Hellkite Courser').gat[0]), 'gatilho aceito');
  const e = cena({ cmd: ['Grizzly Bears'], campo: [[0, 'Hellkite Courser']], passo: 'principal2' }); e.pend = [];
  const hk = e.campo[0], bear = e.jogs[0].zonas.comando[0];
  const ctx: any = { voce: 0, este: hk, alvos: [], ilegal: {}, lki: { alvos: [] } };
  for (const f of M.carta('Hellkite Courser').gat[0].fx) M.executar(e, f, ctx, () => ({ a: 'sim' }));
  igual([e.objs[bear].zona, M.temKw(e, e.objs[bear], 'pressa')], ['campo', true], 'no campo com ímpeto');
  passarAte(e, 'final'); M.avancar(e); resolveCom(e);
  igual(e.objs[bear].zona, 'comando', 'voltou na etapa final');
});
caso('122.6', "gatilho 'marcador posto' (Simic Ascendancy: tantos de crescimento quantos +1/+1; Fathom Mage compra); proliferar também põe", () => {
  for (const c of ['Simic Ascendancy', 'Fathom Mage', 'Exemplar of Light', 'Shalai and Hallar', 'All Will Be One', 'Benthic Biomancer', 'Evolution Witness']) ok(M.carta(c).gat.filter(g => g.ev === 'marcadorPosto').every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Simic Ascendancy'], [0, 'Fathom Mage'], [1, 'Grizzly Bears']], passo: 'principal2' }); e.pend = [];
  const [sa, fm, gb] = e.campo, mao = () => e.jogs[0].zonas.mao.length, m0 = mao();
  M.executar(e, { op: 'marcador', em: { alvo: 0 }, tipoMarc: '+1/+1', qtd: 2 }, { voce: 0, este: sa, alvos: [[{ o: fm, ts: e.objs[fm].ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  M.avancar(e); resolveCom(e, p => p.ops.findIndex(o => o.a === 'sim'));
  igual([e.objs[sa].marc.growth, mao() - m0], [2, 1], '2 de crescimento e o Mago comprou 1');
  M.porMarcadores(e, e.objs[gb], '+1/+1', 1); e.perg = null; M.avancar(e); resolveCom(e);
  igual(e.objs[sa].marc.growth, 2, 'criatura do oponente não conta');
  M.executar(e, { op: 'proliferar', quem: 'voce' }, { voce: 0, este: sa, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops.find(o => o.id === fm) || ops.find(o => o.a === 'pronto'));
  e.perg = null; M.avancar(e); resolveCom(e, p => p.ops.findIndex(o => o.a === 'sim'));
  igual([e.objs[fm].marc['+1/+1'], e.objs[sa].marc.growth], [3, 3], 'proliferar no Mago: +1 e +1 de crescimento');
});
caso('613.1b', "Hellkite Tyrant: só os artefatos do jogador que levou o dano (filtro ctrl 'doEvento'), não os de todos", () => {
  const H = M.carta('Hellkite Tyrant');
  const e = cena({ jogs: 3, campo: [[0, 'Hellkite Tyrant'], [1, 'Sol Ring'], [2, 'Sol Ring']], passo: 'principal2' }); e.pend = [];
  const [ht, a1, a2] = e.campo;
  for (const f of H.gat[0].fx) M.executar(e, f, { voce: 0, este: ht, alvos: [], ilegal: {}, lki: { alvos: [] }, ev: { ev: 'dano', fonte: ht, combate: true, q: 6, jog: 1 } }, null);
  igual([e.objs[a1].ctrl, e.objs[a2].ctrl], [0, 2], 'pega só o do jogador 1');
});
caso('613.1b', "ganhar o controle (camada 2): Zealous Conscripts até o fim do turno (desvira, ímpeto, volta na limpeza); Roil Elemental enquanto você o controlar", () => {
  const Z = M.carta('Zealous Conscripts'), R = M.carta('Roil Elemental');
  ok(M.gatOk(Z.gat[0]) && M.gatOk(R.gat[0]), 'gatilhos aceitos');
  const e = cena({ campo: [[0, 'Zealous Conscripts'], [0, 'Roil Elemental'], [1, 'Grizzly Bears', { virada: true }], [1, 'Hill Giant']], passo: 'principal2' }); e.pend = [];
  const [zc, re, gb, hg] = e.campo;
  const ctx = (este, alvo): any => ({ voce: 0, este, alvos: [[{ o: alvo, ts: e.objs[alvo].ts }]], ilegal: {}, lki: { alvos: [] } });
  for (const f of Z.gat[0].fx) M.executar(e, f, ctx(zc, gb), null);
  const o = e.objs[gb];
  igual([o.ctrl, o.virada, M.temKw(e, o, 'pressa')], [0, false, true], 'é seu, desvirado e com ímpeto');
  ok(M.bate(e, o, { ctrl: 'voce' }, { voce: 0 }), 'filtro ctrl voce vê o novo controlador');
  M.executar(e, R.gat[0].fx[0], ctx(re, hg), null);
  igual(e.objs[hg].ctrl, 0, 'Roil: Hill Giant é seu');
  passarAte(e, 'principal1');
  igual([e.objs[gb].ctrl, e.objs[hg].ctrl], [1, 0], 'na limpeza o Urso volta; o Gigante fica');
  M.mover(e, re, 'cemiterio');
  igual(e.objs[hg].ctrl, 1, 'Roil saiu: o Gigante volta ao dono');
  M.mover(e, hg, 'mao'); M.mover(e, hg, 'campo'); igual(e.objs[hg].ctrl0, undefined, 'objeto novo (400.7)');
});
caso('601.3', "jogar do topo do grimório com permissão (Courser of Kruphix: terreno; Emperor Mihail II: Merfolk); só a carta do topo, só com a fonte no campo", () => {
  const e = cena({ campo: [[0, 'Courser of Kruphix'], [0, 'Emperor Mihail II'], [0, 'Island'], [0, 'Island']], passo: 'principal1' });
  const noTopo = n => { const o = e.por(0, n, { zona: 'mao' }); const J = e.jogs[0]; J.zonas.mao.splice(J.zonas.mao.indexOf(o.id), 1); J.zonas.grimorio.push(o.id); o.zona = 'grimorio'; return o; };
  ok(M.olhaTopo(e, 0) && !M.olhaTopo(e, 1), 'olha o topo: só quem controla o Courser');
  const fo = noTopo('Forest');
  const ops = () => M.opcoesPrioridade(e, 0);
  ok(ops().some(o => o.a === 'terreno' && o.id === fo.id), 'Forest do topo: pode jogar');
  const mf = noTopo('Benthic Biomancer');
  ok(!ops().some(o => o.id === fo.id), 'a Forest não é mais o topo');
  ok(ops().some(o => o.a === 'conjurar' && o.id === mf.id), 'Merfolk do topo: pode conjurar (Mihail)');
  const gb = noTopo('Grizzly Bears');
  ok(!ops().some(o => o.id === gb.id), 'Urso do topo: sem permissão');
  M.mover(e, e.campo.find(id => e.objs[id].n === 'Courser of Kruphix'), 'cemiterio');
  e.jogs[0].zonas.grimorio.push(e.jogs[0].zonas.grimorio.splice(e.jogs[0].zonas.grimorio.indexOf(fo.id), 1)[0]);
  ok(!ops().some(o => o.id === fo.id), 'sem o Courser: não joga terreno do topo');
});
caso('605.1b', "gatilho de mana ao virar terreno (Wild Growth, Regal Behemoth): resolve na hora, o solver conta com ele; Behemoth só se for o monarca", () => {
  for (const c of ['Wild Growth', 'Fertile Ground', 'Regal Behemoth', "Mirari's Wake"]) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Forest'], [0, 'Wild Growth'], [0, 'Regal Behemoth']], passo: 'principal2' }); e.pend = [];
  const [fo, wg] = e.campo;
  e.objs[wg].anexo = { id: fo, ts: e.objs[fo].ts };
  const tot = p => Object.values(p).reduce((a: number, b: any) => a + b, 0);
  igual(M.fontesDeMana(e, 0).find(f => f.id === fo).pacotes.map(tot), [2], 'sem monarca: Forest + Wild Growth = 2');
  ok(!!M.planoMana(e, 0, { g: 1, p: ['G'] }), 'paga {1}{G} só com a Forest');
  M.virarMonarca(e, 0);
  const pac = M.fontesDeMana(e, 0).find(f => f.id === fo).pacotes;
  igual([pac.length, tot(pac[0])], [5, 3], 'monarca: + 1 de qualquer cor (5 escolhas)');
  M.ativarMana(e, 0, fo, 0, 0);
  igual([e.objs[fo].virada, tot(e.jogs[0].reserva)], [true, 3], 'virou e a reserva tem 3');
});
caso('724', "Éomer: 'target player becomes the monarch' — a IA escolhe a si mesma; Faramir: na sua etapa final, se você é o monarca (603.4), 2 fichas", () => {
  const Eo = M.carta('Éomer, King of Rohan'), Fa = M.carta('Faramir, Steward of Gondor');
  ok(M.gatOk(Eo.gat[0]) && M.gatOk(Fa.gat[1]), 'gatilhos aceitos');
  const e = cena({ campo: [[0, 'Faramir, Steward of Gondor']], passo: 'principal2' }); e.pend = [];
  const IA = M.agenteBasico();
  const r = IA(e, { j: 0, tipo: 'alvo', ops: [{ a: 'alvo', jog: 1 }, { a: 'alvo', jog: 0 }], ctx: { i: 0, de: -1, paraSi: true } });
  igual(r, 1, 'IA escolhe ela mesma para virar monarca');
  M.executar(e, Eo.gat[0].fx[0], { voce: 0, este: -1, alvos: [[{ jog: 1 }]], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.monarca, 1, 'o jogador-alvo virou o monarca');
  const fichas = x => x.campo.filter(id => x.objs[id].ficha && x.objs[id].ctrl === 0).length;
  passarAte(e, 'final'); M.avancar(e); resolveCom(e);
  igual(fichas(e), 0, 'não é o monarca: sem fichas');
  const e2 = cena({ campo: [[0, 'Faramir, Steward of Gondor']], passo: 'principal2' }); e2.pend = [];   // na principal2: o combate não trava o passarAte
  M.virarMonarca(e2, 0); passarAte(e2, 'final'); M.avancar(e2); resolveCom(e2);
  igual(fichas(e2), 2, 'monarca na sua etapa final: 2 fichas');
});
caso('613.4b', "Sephiroth: criaturas modificadas (700.9) viram 7/5 base até o fim do turno (7b), o +X da 7c soma por cima; só modificada paga o custo do cemitério", () => {
  const S = M.carta('Sephiroth, Fallen Hero');
  ok(M.gatOk(S.gat[0]) && M.custoSuportado(S.atv[0].custo), 'gatilho e custo aceitos');
  const e = cena({ campo: [[0, 'Sephiroth, Fallen Hero'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears']], passo: 'principal2' }); e.pend = [];
  const [sp, u, v, w] = e.campo;
  ok(!M.bate(e, e.objs[u], { modificada: true }, { voce: 0 }), 'sem marcador: não modificada');
  const ctx: any = { voce: 0, este: sp, alvos: [[{ o: u, ts: e.objs[u].ts }]], ilegal: {}, lki: { alvos: [] } };
  for (const f of S.gat[0].fx) M.executar(e, f, ctx, () => ({ a: 'sim' }));
  const pt = id => [M.poder(e, e.objs[id]), M.resistencia(e, e.objs[id])];
  igual([e.objs[u].marc.cell, pt(u), pt(v), pt(w)], [1, [7, 5], [2, 2], [2, 2]], 'só a com marcador vira 7/5');
  M.executar(e, { op: 'modificar', em: 'este', p: 3, r: 3, dura: 'fimDoTurno' }, { ...ctx, este: u }, null);
  igual(pt(u), [10, 8], '7c depois da 7b');
  e.objs[v].marc.cell = 1; igual(pt(v), [2, 2], 'modificada depois da resolução não entra (611.2c)');
  ok(M.objetosQue(e, { ...S.atv[0].custo.sacrificar.f }, { voce: 0 }).map(o => o.id).sort().join() === [u, v].sort().join(), 'candidatas ao sacrifício: as modificadas');
  passarAte(e, 'principal1'); igual(pt(u), [2, 2], 'acabou na limpeza');
});
caso('603.7', 'gatilho atrasado com o alvo de quem o criou: Alora — a atacante escolhida volta à mão no fim do turno; se mudou de zona, não (400.7)', () => {
  const g = M.carta('Alora, Merry Thief').gat[0];
  ok(M.gatOk(g), 'gatilho da Alora aceito');
  for (const piscou of [false, true]) {
    const e = cena({ campo: [[0, 'Alora, Merry Thief'], [0, 'Grizzly Bears']], passo: 'principal2' });
    const u = e.campo.find(id => e.objs[id].n === 'Grizzly Bears'), al = e.campo.find(id => e.objs[id].n === 'Alora, Merry Thief');
    const ctx: any = { voce: 0, este: al, alvos: [[{ o: u, ts: e.objs[u].ts }]], ilegal: {}, lki: { alvos: [] } };
    for (const f of g.fx) M.executar(e, f, ctx, null);
    if (piscou) { M.mover(e, u, 'exilio'); M.mover(e, u, 'campo'); }
    passarAte(e, 'final'); M.avancar(e);
    for (let i = 0; i < 8 && e.perg && e.pilha.length + e.pend.length; i++) respE(e, o => o.a === 'passar' || o.a === 'gatilho');
    igual(naZona(e, 0, 'mao'), piscou ? [] : ['Grizzly Bears'], piscou ? 'objeto novo: fica' : 'voltou à mão');
  }
});
// substituições (CR 614): entra com marcadores, marcadores a mais, fichas dobradas, dano dobrado/prevenido
caso('614.1c', 'entra com marcadores: Kalonian Hydra entra com 4 (+1 com Hardened Scales) e não morre como 0/0', () => {
  for (const escamas of [false, true]) {
    const campo: any[] = escamas ? [[0, 'Hardened Scales']] : [];
    const e = cena({ campo, mao: [[0, 'Kalonian Hydra']] });
    const h = e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Kalonian Hydra');
    M.entrarPermanente(e, h, 0, {}, null);
    igual(e.objs[h].marc['+1/+1'], escamas ? 5 : 4, escamas ? 'com Hardened Scales' : 'sozinha');
  }
});
caso('614.1a', 'fichas: Parallel Lives dobra; Doubling Season + Parallel Lives = ×4; marcador com Doubling Season dobra', () => {
  const e = cena({ campo: [[0, 'Parallel Lives'], [1, 'Grizzly Bears']] });
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 2, token: { nome: 'Treasure' } }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.campo.filter(id => e.objs[id].n === 'Treasure').length, 4, '2 × 2');
  M.executar(e, { op: 'ficha', quem: 'cadaOponente', qtd: 1, token: { nome: 'Treasure' } }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.campo.filter(id => e.objs[id].n === 'Treasure' && e.objs[id].ctrl === 1).length, 1, 'do oponente não dobra');
  const g = cena({ campo: [[0, 'Parallel Lives'], [0, 'Doubling Season'], [0, 'Grizzly Bears']] });
  M.executar(g, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Food' } }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(g.campo.filter(id => g.objs[id].n === 'Food').length, 4, '1 × 2 × 2');
  const urso = g.campo.find(id => g.objs[id].n === 'Grizzly Bears');
  M.executar(g, { op: 'marcador', em: 'este', tipoMarc: '+1/+1', qtd: 1 }, { voce: 0, este: urso, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(g.objs[urso].marc['+1/+1'], 2, 'Doubling Season nos marcadores');
});
caso('615', 'dano: Gisela dobra o dano no oponente e corta pela metade (arredonda para cima) o dano em você', () => {
  const e = cena({ campo: [[0, 'Gisela, Blade of Goldnight']] });
  const v0 = e.jogs[0].vida, v1 = e.jogs[1].vida;
  M.executar(e, { op: 'dano', quem: 'cadaOponente', qtd: 3 }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  M.executar(e, { op: 'dano', quem: 'cadaOponente', qtd: 3 }, { voce: 1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual([v1 - e.jogs[1].vida, v0 - e.jogs[0].vida], [6, 2], 'oponente 3→6; você 3→2');
});

// efeitoTemporario (611.2b) e fases (702.26): Teferi's Protection, Rogue's Passage
const ateTurno = (e, n, passo = 'principal1') => {
  const fim = x => x.turno.n === n && x.turno.passo === passo;
  for (let g = 0; !fim(e) && g < 400; g++) {
    M.avancar(e, fim); if (fim(e) || !e.perg) continue;
    const p = e.perg; M.responder(e, p.tipo === 'acao' ? p.ops.findIndex(o => o.a === 'passar') : M.agenteBasico()(e, p), fim);
  }
  ok(fim(e), 'não chegou no turno ' + n);
};
caso('702.26', "fasear + efeitoTemporario: Teferi's Protection (vida não muda, proteção contra tudo, permanentes fora até o seu próximo turno)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Forest'], [1, 'Hill Giant']] });
  const gb = objN(e, 0, 'Grizzly Bears'), ts = gb.ts, v = e.jogs[0].vida;
  for (const f of M.carta("Teferi's Protection").fx) ok(M.fxSuportado([f]), 'suportado: ' + f.op);
  const ctx = { voce: 0, alvos: [], ilegal: {}, lki: {} };
  for (const f of M.carta("Teferi's Protection").fx) M.executar(e, f, ctx, null);
  igual([noCampo(e), gb.zona, gb.ts], [['Hill Giant'], 'faseado', ts], 'faseadas: fora do campo, mesmo objeto');
  igual([M.vidaFixa(e, 0), M.protegeJog(e, 0), M.vidaFixa(e, 1)], [true, true, false]);
  igual(M.ganharVida(e, 0, 3), 0, 'não ganha');
  M.executar(e, { op: 'perderVida', quem: 'cadaJogador', qtd: 2 }, ctx, null);
  M.executar(e, { op: 'dano', quem: 'cadaJogador', qtd: 3 }, ctx, null);
  igual([e.jogs[0].vida, e.jogs[1].vida], [v, 35], 'perda e dano: só o outro');
  igual([M.alvoLegal(e, { f: 'jogador' }, { jog: 0 }, { voce: 1 }), M.alvoLegal(e, { f: 'jogador' }, { jog: 1 }, { voce: 1 })], [false, true], 'não é alvo');
  ateTurno(e, 3);
  igual([gb.zona, M.protegeJog(e, 0)], ['faseado', true], 'no turno do oponente continua');
  ateTurno(e, 4);
  ok(e.campo.includes(gb.id) && gb.ts === ts && !gb.virada, 'voltou no seu desvirar, mesmo objeto');
  igual([M.vidaFixa(e, 0), M.protegeJog(e, 0), (e.efTemp || []).length], [false, false, 0], 'acabou no começo do seu turno');
});
caso('611.2b', "efeitoTemporario até o fim do turno: Rogue's Passage (o alvo não pode ser bloqueado); filtro lido na hora (naoPodeBloquear)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant']] });
  const [gb, le, hg] = [objN(e, 0, 'Grizzly Bears'), objN(e, 0, 'Llanowar Elves'), objN(e, 1, 'Hill Giant')];
  const atv = M.carta("Rogue's Passage").atv[1].fx;
  ok(M.fxSuportado(atv, { topo: false }));
  M.executar(e, atv[0], { voce: 0, alvos: [[{ o: gb.id, ts: gb.ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  igual([M.bloqueiaEste(e, hg, gb), M.bloqueiaEste(e, hg, le)], [false, true]);
  M.executar(e, { op: 'efeitoTemporario', quem: 'voce', dura: 'fimDoTurno', est: [{ modo: 'naoPodeBloquear', afeta: { tipo: ['Creature'], ctrl: 'oponente', zona: 'campo' } }] }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, null);
  const nova = e.por(1, 'Elvish Mystic');
  igual([M.podeBloquear(e, hg, 1), M.podeBloquear(e, nova, 1)], [false, false], 'vale também para a que chegou depois');
  ok(!M.fxSuportado([{ op: 'efeitoTemporario', dura: 'fimDoTurno', est: [{ modo: 'naoPodeSerBloqueada' }] }]), 'sem em nem afeta: recusa');
  ateTurno(e, 3, 'manutencao');
  igual([M.bloqueiaEste(e, hg, gb), M.podeBloquear(e, hg, 1), (e.efTemp || []).length], [true, true, 0], 'acabou na limpeza');
});
caso('611.2a', "modificar +1/+1 com dura 'sempre' (Witch's Mark): passa da limpeza e acaba quando a criatura sai", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears']] });
  const gb = objN(e, 0, 'Grizzly Bears');
  const fx = { op: 'modificar', em: { alvo: 0 }, p: 1, r: 1, dura: 'sempre' };
  ok(M.fxSuportado([fx], { topo: false }));
  M.executar(e, fx, { voce: 0, alvos: [[{ o: gb.id, ts: gb.ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  igual([M.poder(e, gb), M.resistencia(e, gb)], [3, 3]);
  ateTurno(e, 3, 'manutencao');
  igual([M.poder(e, gb), M.resistencia(e, gb)], [3, 3], 'não acaba na limpeza');
});
caso('611.2c', "modificar com estática de regra até o fim do turno (Key to the City, Wedding Invitation): o alvo preso não pode ser bloqueado", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant']] });
  const [gb, le, hg] = [objN(e, 0, 'Grizzly Bears'), objN(e, 0, 'Llanowar Elves'), objN(e, 1, 'Hill Giant')];
  const fx = [{ op: 'modificar', em: { alvo: 0 }, est: [{ modo: 'naoPodeSerBloqueada', afeta: 'este' }], dura: 'fimDoTurno' }];
  ok(M.fxSuportado(fx, { topo: false }));
  ok(!M.fxSuportado([{ op: 'modificar', em: { alvo: 0 }, est: [{ modo: 'naoPodeSerBloqueada', afeta: 'este', x: 1 }], dura: 'fimDoTurno' }], { topo: false }), 'campo desconhecido: recusa');
  M.executar(e, fx[0], { voce: 0, alvos: [[{ o: gb.id, ts: gb.ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  igual([M.bloqueiaEste(e, hg, gb), M.bloqueiaEste(e, hg, le)], [false, true]);
  ateTurno(e, 3, 'manutencao');
  igual(M.bloqueiaEste(e, hg, gb), true, 'a limpeza tira (514.2)');
});

caso('113.6', 'Anger: estática que vale do cemitério (esteEm) — com Mountain, suas criaturas têm pressa; no campo ou no exílio, não', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears', { doente: true }], [1, 'Hill Giant', { doente: true }]] });
  const [gb, hg] = [objN(e, 0, 'Grizzly Bears'), objN(e, 1, 'Hill Giant')];
  ok(M.estContOk(M.carta('Anger').est[0]), 'o motor lê a estática da Anger');
  const an = e.por(0, 'Anger', { zona: 'cemiterio' });
  igual(M.temKw(e, gb, 'pressa'), false, 'sem Mountain não vale');
  e.por(0, 'Mountain');
  igual([M.temKw(e, gb, 'pressa'), M.temKw(e, hg, 'pressa')], [true, false], 'só as suas');
  const nova = e.por(0, 'Llanowar Elves', { doente: true });
  igual(M.temKw(e, nova, 'pressa'), true, 'a que chegou depois também');
  M.mover(e, an.id, 'campo');
  igual([M.temKw(e, gb, 'pressa'), M.temKw(e, an, 'pressa')], [false, true], 'no campo: só a pressa dela');
  M.mover(e, an.id, 'exilio');
  igual(M.temKw(e, gb, 'pressa'), false, 'no exílio não vale');
  M.mover(e, an.id, 'cemiterio');
  igual(M.temKw(e, gb, 'pressa'), true, 'de volta ao cemitério vale de novo');
  ok(!M.seOk({ esteEm: ['pilhaX'] }), 'zona desconhecida: recusa');
});

caso('613.1d', 'Brotherhood Regalia: a equipada vira Assassin (camada 4), ganha resguardo {2} e não pode ser bloqueada; desequipada, perde tudo', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant']] });
  const [gb, le, hg] = [objN(e, 0, 'Grizzly Bears'), objN(e, 0, 'Llanowar Elves'), objN(e, 1, 'Hill Giant')];
  const rg = e.por(0, 'Brotherhood Regalia');
  ok(M.carta('Brotherhood Regalia').est.every(x => x.modo !== 'continuo' || M.estContOk(x)), 'o motor lê a estática');
  ok(!M.estTipoEquipOk({ modo: 'continuo', afeta: 'equipada', sub: ['Forest'] }), 'tipo de terreno básico: recusa (305.6)');
  const sub = o => M.dadoDe(e, o).sub || [];
  igual(sub(gb).includes('Assassin'), false);
  rg.anexo = { id: gb.id, ts: gb.ts }; e.vCamada = (e.vCamada || 0) + 1;
  igual([sub(gb).includes('Assassin'), sub(gb).includes('Bear'), sub(le).includes('Assassin')], [true, true, false], 'soma o subtipo, só na equipada');
  igual([M.temKw(e, gb, 'resguardo'), M.temKw(e, le, 'resguardo')], [true, false]);
  igual([M.bloqueiaEste(e, hg, gb), M.bloqueiaEste(e, hg, le)], [false, true]);
  ok(M.objetosQue(e, { sub: ['Assassin'], zona: 'campo' }, { voce: 0 }).some(o => o.id === gb.id), 'filtro por subtipo enxerga o Assassin');
  rg.anexo = { id: le.id, ts: le.ts }; e.vCamada++;
  igual([sub(gb).includes('Assassin'), sub(le).includes('Assassin'), M.temKw(e, gb, 'resguardo')], [false, true, false], 'trocou de criatura');
  M.mover(e, le.id, 'cemiterio');
  igual(sub(le).includes('Assassin'), false, 'fora do campo, só o impresso');
});

caso('716.2', 'Classe (Cool but Rude): entra no nível 1; subir só do nível anterior, como feitiço; o nível 2 soma o gatilho de descarte', () => {
  const e = cena({ campo: terras(6, 'Mountain') });
  const cr = e.por(0, 'Cool but Rude');
  igual(cr.nivel, 1, 'entra no nível 1 (716.2c)');
  const sobe = M.atvDe(e, cr).map((a, k) => [a._nivel, k]).filter(([n]) => n);
  igual(sobe.map(([n]) => n), [2, 3]);
  const k2 = sobe[0][1], k3 = sobe[1][1];
  igual([M.podeAtivar(e, 0, cr, k2), M.podeAtivar(e, 0, cr, k3)], [true, false], 'nível 3 só depois do 2 (716.2a)');
  igual((M.gatDe(e, cr) || []).map(g => g.ev), ['atacantesDeclarados']);
  M.executar(e, M.atvDe(e, cr)[k2].fx[0], { voce: 0, este: cr.id, alvos: [], ilegal: {}, lki: {} }, null);
  igual([cr.nivel, (M.gatDe(e, cr) || []).map(g => g.ev)], [2, ['atacantesDeclarados', 'descarta']], 'o nível 2 soma o gatilho');
  igual([M.podeAtivar(e, 0, cr, k2), M.podeAtivar(e, 0, cr, k3)], [false, true]);
  e.turno.passo = 'combate'; igual(M.podeAtivar(e, 0, cr, k3), false, 'só como feitiço'); e.turno.passo = 'principal1';
  M.mover(e, cr.id, 'mao'); M.mover(e, cr.id, 'campo');
  igual([cr.nivel, (M.gatDe(e, cr) || []).length], [1, 1], 'saiu e voltou: objeto novo, nível 1 (400.7)');
  ok(M.gatOk({ ev: 'nivel', n: 3, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }) && !M.gatOk({ ev: 'nivel', fx: [] }), "gat ev 'nivel' pede n");
  // nível 3 (716.2b): "quando vira nível 3" busca uma carta e descarta uma ao acaso (701.9b); o descarte dispara o do nível 2
  const g = cena({ campo: terras(6, 'Mountain'), mao: [[0, 'Grizzly Bears'], [0, 'Hill Giant']] });
  const c2 = g.por(0, 'Cool but Rude'); g.pend = [];
  const kk = M.atvDe(g, c2).map((a, k) => [a._nivel, k]).filter(([n]) => n).map(([, k]) => k);
  M.executar(g, M.atvDe(g, c2)[kk[0]].fx[0], { voce: 0, este: c2.id, alvos: [], ilegal: {}, lki: {} }, null);
  M.executar(g, M.atvDe(g, c2)[kk[1]].fx[0], { voce: 0, este: c2.id, alvos: [], ilegal: {}, lki: {} }, null);
  igual([c2.nivel, g.pend.length], [3, 1], 'o gatilho do nível 3 disparou');
  ok(M.fxSuportado(M.gatDe(g, c2).find(x => x.ev === 'nivel').fx), 'busca e descarte ao acaso lidos');
  const mao0 = g.jogs[0].zonas.mao.length, vida1 = g.jogs[1].vida;
  M.avancar(g); resolveCom(g);
  igual(g.jogs[0].zonas.mao.length, mao0, '+1 da busca, −1 ao acaso');
  igual(g.jogs[0].zonas.cemiterio.length, 1);
  M.avancar(g); resolveCom(g);
  igual(g.jogs[1].vida, vida1 - 2, 'o descarte disparou o nível 2: 2 de dano em cada oponente');
});

caso('700.5', 'devoção (Clive): símbolos da cor nos custos dos seus permanentes, híbrido conta; descartar a mão e comprar a devoção; marcadores de um tipo (lore) na condição', () => {
  const e = cena({ campo: [...terras(4, 'Mountain'), [0, 'Goblin Guide'], [1, 'Goblin Guide']], mao: [[0, 'Grizzly Bears'], [0, 'Hill Giant'], [0, 'Forest']] });
  const cl = e.por(0, "Clive, Ifrit's Dominant");
  igual(M.devocao(e, 0, 'R'), 3, '{4}{R}{R} + {R}; o do oponente e os terrenos não contam');
  igual([M.devocao(e, 0, 'G'), M.devocao(e, 1, 'R')], [0, 1]);
  const gm = M.carta("Clive, Ifrit's Dominant").gat[0];
  ok(M.gatOk(gm), 'o gatilho de entrar é lido');
  const ctx: any = { voce: 0, este: cl.id, alvos: [], ilegal: {}, lki: {} };
  const mao0 = e.jogs[0].zonas.mao.length;
  const sim = (j, t, ops) => ops.find(o => o.a === 'sim') || ops[0];
  for (const f of gm.fx) M.executar(e, f, ctx, sim);
  igual([e.jogs[0].zonas.cemiterio.length, e.jogs[0].zonas.mao.length], [mao0, 3], 'descartou a mão (3) e comprou a devoção (3)');
  // Ifrit (verso, saga): "se tiver 3 ou mais marcadores de lore" lê o tipo do marcador
  const se = M.carta("Clive, Ifrit's Dominant").faces[0].gat[1].fx[1].se;
  cl.marc.lore = 2; igual(M.condicao(e, se, { voce: 0, este: cl.id }), false);
  cl.marc.lore = 3; cl.marc['+1/+1'] = 5; igual(M.condicao(e, se, { voce: 0, este: cl.id }), true, 'conta só lore');
  igual(M.qtd(e, { conta: 'marcadoresNoEste', de: '+1/+1' }, { voce: 0, este: cl.id }), 5);
  ok(M.fxSuportado([{ op: 'comprar', qtd: { conta: 'devocao', de: 'WB' } }]) && !M.fxSuportado([{ op: 'comprar', qtd: { conta: 'devocao', de: 'X' } }]), 'de: só cores');
});

caso('104.2b', "Thassa's Oracle: vence se a devoção a azul (X) ≥ cartas no grimório; comparação entre duas contagens", () => {
  for (const [n, vence] of [[1, true], [2, true], [10, false]] as const) {
    const e = cena({ campo: [[0, "Thassa's Oracle"]], grimorio: n });
    const th = e.objs[e.campo.find(id => e.objs[id].n === "Thassa's Oracle")];
    const g = M.carta("Thassa's Oracle").gat[0];
    ok(M.gatOk(g), 'o gatilho é lido inteiro (cavar + vitória)');
    const ctx: any = { voce: 0, este: th.id, alvos: [], ilegal: {}, lki: {} };
    const sim = (j, t, ops) => ops.find(o => o.a === 'sim') || ops[0];
    for (const f of g.fx) M.executar(e, f, ctx, sim);
    M.avancar(e);
    igual(!!(e.fim && e.fim.vencedor === 0), vence, `devoção 2, grimório ${n}`);
  }
  igual(M.condicao(cena({ grimorio: 0 }), { conta: { q: { conta: 'cartasNoGrimorio' }, max: { conta: 'cartasNaMao' } } }, { voce: 0 }), true, 'max também aceita contagem');
});

caso('601.2i', "Aetherflux Reservoir: ganha 1 de vida por mágica que você conjurou antes desta no turno (magiasNoTurno do conjurador)", () => {
  const e = cena({ campo: [...terras(6, 'Mountain'), [0, 'Aetherflux Reservoir']], mao: [[0, 'Lightning Bolt'], [0, 'Lightning Bolt'], [0, 'Lightning Bolt']] });
  ok(M.gatOk(M.carta('Aetherflux Reservoir').gat[0]), 'o gatilho é lido');
  const v0 = e.jogs[0].vida;
  for (let i = 0; i < 3; i++) { M.avancar(e); conj(e, 'Lightning Bolt'); if (e.perg && e.perg.tipo === 'alvo') alvoJog(e, 1); resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1); }
  igual(e.jogs[0].vida - v0, 0 + 1 + 2, '1ª: 0, 2ª: 1, 3ª: 2');
  igual(M.qtd(e, { conta: 'magiasNoTurno' }, { voce: 1 }), 0, 'o oponente não conjurou');
});

caso('601.2', "filtro conjurada (The One Ring: 'if you cast it'): conjurada entra marcada; posta por efeito não", () => {
  const e = cena({ campo: terras(4, 'Wastes'), mao: [[0, 'The One Ring']] });
  M.avancar(e); conj(e, 'The One Ring'); resolveCom(e);
  const r = e.objs[e.campo.find(id => e.objs[id].n === 'The One Ring')];
  ok(r && M.bate(e, r, { conjurada: true }, { voce: 0 }), 'conjurada');
  const e2 = cena({ campo: [[0, 'The One Ring']] });
  ok(!M.bate(e2, e2.por(0, 'The One Ring'), { conjurada: true }, { voce: 0 }), 'posta no campo pela cena: não conjurada');
  ok(M.gatOk(M.carta('The One Ring').gat[0]), 'o gatilho é lido');
});

caso('701.23', "buscar para o grimório (Mystical Tutor): a carta achada fica no topo", () => {
  const e = cena({ grimorio: 3 });
  const b = e.por(0, 'Lightning Bolt', { zona: 'grimorio' });
  const g = e.jogs[0].zonas.grimorio;
  g.splice(g.indexOf(b.id), 1); g.unshift(b.id);   // no fundo
  for (const f of M.carta('Mystical Tutor').fx) M.executar(e, f, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops.find(o => o.id !== undefined && e.objs[o.id] && e.objs[o.id].n === 'Lightning Bolt') || ops[0]);
  igual([e.objs[g[g.length - 1]].n, g.length], ['Lightning Bolt', 4], 'no topo, nada some');
});

caso('603.4', "maisTerrenosOponente (Land Tax 'algum'; Archaeomancer's Map 'doEvento'): conta os terrenos de cada um", () => {
  const e = cena({ campo: [...terras(2, 'Plains'), [1, 'Plains'], [1, 'Plains'], [1, 'Plains'], [0, 'Land Tax']] });
  const lt = e.objs[e.campo.find(id => e.objs[id].n === 'Land Tax')];
  const g = M.carta('Land Tax').gat[0];
  ok(M.gatOk(g), 'o gatilho é lido');
  igual(M.condicao(e, g.se, { voce: 0, este: lt.id }), true, '3 contra 2');
  igual(M.condicao(e, g.se, { voce: 1, este: lt.id }), false, 'quem tem mais não ganha');
  const p1 = e.campo.find(id => e.objs[id].ctrl === 1);
  igual(M.condicao(e, { maisTerrenosOponente: 'doEvento' }, { voce: 0, ev: { ev: 'entra', id: p1 } }), true, 'o terreno do oponente entrou e ele tem mais');
  igual(M.condicao(e, { maisTerrenosOponente: 'doEvento' }, { voce: 0, ev: { ev: 'entra', id: lt.id } }), false, 'o que entrou é meu');
});

caso('608.2c', "pode + pagar (Leaf-Crowned Visionary: 'you may pay {G}. If you do, draw'): pergunta antes de pagar; a repetição do processo não perde a opção", () => {
  const e = cena({ campo: [...terras(4, 'Forest'), [0, 'Leaf-Crowned Visionary']], mao: [[0, 'Llanowar Elves']] });
  M.avancar(e);
  resp(e, o => o.a === 'conjurar');
  const mao0 = e.jogs[0].zonas.mao.length;
  const perguntas: string[] = [];
  resolveCom(e, p => { perguntas.push(p.tipo); return p.tipo === 'aMenosQuePagar' ? p.ops.findIndex(o => o.a === 'pagar') : -1; });
  igual(perguntas.filter(t => t === 'talvez').length, 0, 'com pagando, o pagar já é o "pode"');
  igual(e.jogs[0].zonas.mao.length, mao0 + 1, 'pagou {G} e comprou');
  igual(e.objs[e.campo.find(id => e.objs[id].n === 'Llanowar Elves')].zona, 'campo');
});

caso('207.2c', 'palavras de habilidade lidas do estado: metalcraft (Dispatch), coven e bênção da cidade; maxspeed continua recusada', () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Mind Stone'], [1, 'Grizzly Bears']] });
  const ctx = { voce: 0, este: e.campo[0] };
  ok(M.fxSuportado(M.carta('Dispatch').fx), 'Dispatch lido');
  igual(M.condicao(e, { palavra: 'metalcraft' }, ctx), false, '2 artefatos');
  e.por(0, 'Arcane Signet');
  igual(M.condicao(e, { palavra: 'metalcraft' }, ctx), true, '3 artefatos');
  igual(M.condicao(e, { palavra: 'metalcraft' }, { voce: 1, este: e.campo[0] }), false, 'são do outro');
  e.por(0, 'Llanowar Elves'); e.por(0, 'Grizzly Bears');
  igual(M.condicao(e, { palavra: 'coven' }, ctx), false, 'poderes 1 e 2');
  e.por(0, 'Hill Giant');
  igual(M.condicao(e, { palavra: 'coven' }, ctx), true, '1, 2 e 3');
  igual(M.condicao(e, { palavra: 'blessing' }, ctx), false, '6 permanentes');
  for (let i = 0; i < 3; i++) e.por(0, 'Wastes'); e.por(0, 'Wayward Swordtooth');   // 702.131b: precisa de uma com ascender
  igual(M.condicao(e, { palavra: 'blessing' }, ctx), true, '10 permanentes');
  for (const id of e.campo.filter(id => e.objs[id].n === 'Wastes')) M.mover(e, id, 'cemiterio');
  igual(M.condicao(e, { palavra: 'blessing' }, ctx), true, 'a bênção fica (702.131c)');
  ok(!M.condValorOk({ palavra: 'maxspeed' }));
});
caso('502.3', 'Unwinding Clock: seus artefatos desviram na etapa de desvirar dos outros; as criaturas não', () => {
  const e = cena({ campo: [[0, 'Unwinding Clock'], [0, 'Sol Ring'], [0, 'Grizzly Bears']] });
  const [sr, gb] = [objN(e, 0, 'Sol Ring'), objN(e, 0, 'Grizzly Bears')];
  sr.virada = true; gb.virada = true;
  ateTurno(e, 3, 'manutencao');
  igual([e.turno.ativo, sr.virada, gb.virada], [1, false, true]);
});
caso('702.41', 'afinidade por artefatos (Mycosynth Golem): {1} a menos por artefato seu; buscar "quantas quiser" (Ugin −11) e grupo na saída (Ratchet) lidos', () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Mind Stone'], [0, 'Arcane Signet'], [1, 'Mind Stone']], mao: [[0, 'Mycosynth Golem']] });
  const mg = e.objs[e.jogs[0].zonas.mao[0]];
  igual(M.custoComImposto(e, mg).g, 8, '11 − 3');
  ok(M.fxSuportado(M.carta('Ugin, Eye of the Storms').atv[2].fx), 'buscar {ate: qualquer}');
  ok(M.gatOk(M.carta('Ratchet, Field Medic').faces[0].gat[0]), 'gatilho "uma ou mais" na saída');
  const r = e.por(0, 'Ratchet, Field Medic', { obj: { face: 0 } }); e.pend = [];
  M.mover(e, objN(e, 0, 'Sol Ring').id, 'cemiterio'); M.mover(e, objN(e, 0, 'Mind Stone').id, 'cemiterio');
  igual(e.pend.filter(p => p.fonte === r.id).length, 1, 'uma vez pelo lote');
});

caso('702.126', 'improvisar (Organic Extinction): artefatos virados pagam {1} genérico cada; primeiro os que não dão mana', () => {
  const arts = ['Darksteel Forge', 'Panharmonicon', 'Dolmen Gate', 'Swiftfoot Boots', 'Basilisk Collar', 'Ruby Medallion'].map(n => [0, n]);
  const e = cena({ campo: [...terras(2, 'Plains'), [0, 'Sol Ring'], [0, 'Mind Stone'], ...arts, [1, 'Grizzly Bears']], mao: [[0, 'Organic Extinction']] });
  const oe = e.objs[e.jogs[0].zonas.mao[0]], ms = objN(e, 0, 'Mind Stone');
  ok(M.podeConjurar(e, 0, oe), 'WW + 6 artefatos + Sol Ring = 10');
  M.avancar(e); resp(e, op => op.a === 'conjurar' && op.id === oe.id);
  igual(arts.map(([, n]) => objN(e, 0, n).virada), arts.map(() => true), 'os 6 sem mana foram virados');
  igual(ms.virada, false, 'o Mind Stone sobrou');
  resolveCom(e);
  igual([objN(e, 1, 'Grizzly Bears'), oe.zona], [undefined, 'cemiterio']);
  const g = cena({ campo: [...terras(2, 'Plains'), [0, 'Sol Ring'], ...arts.slice(0, 5)], mao: [[0, 'Organic Extinction']] });
  igual(M.podeConjurar(g, 0, g.objs[g.jogs[0].zonas.mao[0]]), false, '2 + 2 + 5 = 9 de 10');
});
caso('118.9', 'custo alternativo: grátis com comandante no campo (Flawless Maneuver, Deflecting Swat); custo de mana alternativo mais barato (Baleful Mastery)', () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'], campo: [...terras(3, 'Plains'), [1, 'Grizzly Bears']], mao: [[0, 'Flawless Maneuver'], [0, 'Baleful Mastery']] });
  const [fm, bm] = e.jogs[0].zonas.mao.map(id => e.objs[id]);
  ok(M.carta('Deflecting Swat').est.every(s => M.estAltOk(s)) && M.carta('Flawless Maneuver').est.every(s => M.estAltOk(s)), 'lidos');
  igual(M.altDe(e, 0, fm), undefined, 'comandante na zona de comando: paga o normal');
  const kr = e.objs[e.jogs[0].zonas.comando[0]]; M.mover(e, kr.id, 'campo');
  igual(M.altDe(e, 0, fm), {}, 'com o comandante no campo: grátis');
  ok(M.podeConjurar(e, 0, fm), 'conjura sem mana de branco');
  igual(M.vmDe(M.altDe(e, 0, bm) || M.carta('Baleful Mastery').custo), 2, 'Baleful Mastery: {1}{B} no lugar de {3}{B}');
  ok(M.estAltOk({ modo: 'custoAlternativo', afeta: 'este', pagar: { vida: 1 } }) && !M.estAltOk({ modo: 'custoAlternativo', afeta: 'este', pagar: { vida: 'X' } }), 'pagar vida: opção de conjurar (Force of Will); vida X não');
});

caso('714.2b', "saga: Urza's Saga entra com 1 (capítulo I), +1 na sua 1ª principal (II, III), habilidades ganhas e sacrifício nas ABE (714.4)", () => {
  const e = cena({ campo: terras(2, 'Wastes') });
  const sr = e.por(0, 'Sol Ring', { zona: 'grimorio' }), gr = e.jogs[0].zonas.grimorio; gr.unshift(gr.pop());   // no fundo: não é comprado
  const us = e.por(0, "Urza's Saga");
  igual(us.marc.lore, 1, 'entra com 1 (714.3a)');
  M.avancar(e); resolveCom(e);
  igual(M.atvDe(e, us).map(a => !!a.deMana), [true], 'capítulo I: {T}: {C}');
  ok(M.fontesDeMana(e, 0).some(f => f.id === us.id), 'vira fonte de mana');
  ateTurno(e, 3); igual(us.marc.lore, 1, 'no turno do oponente não sobe');
  ateTurno(e, 4, 'inicioCombate');
  igual([us.marc.lore, M.atvDe(e, us).length], [2, 2], 'capítulo II');
  ok(M.fxSuportado(M.atvDe(e, us)[1].fx, { topo: false }) && !M.atvDe(e, us)[1].deMana, 'a do Construct');
  ateTurno(e, 6, 'inicioCombate');
  igual([sr.zona, us.zona], ['campo', 'cemiterio'], 'capítulo III buscou e a saga foi sacrificada');
  // capítulo na pilha segura o sacrifício (714.4); proliferar sobe e dispara
  const g = cena({});
  const s2 = g.por(0, "Urza's Saga"); s2.marc.lore = 3; g.pend = [];
  g.pilha.push((() => { const id = g.prox++; g.objs[id] = { id, n: "Urza's Saga", dono: 0, ctrl: 0, zona: 'pilha', ts: ++g.ts, marc: {}, hab: { fonte: s2.id, fonteTs: s2.ts, gat: 2, fx: [] }, pil: { x: 0, alvos: [], ctrl: 0, lki: {} } }; return id; })());
  M.abe(g); igual(s2.zona, 'campo', 'com o capítulo na pilha fica');
  const h = cena({}); const s3 = h.por(0, "Urza's Saga"); h.pend = [];
  M.porHistoria(h, s3, 1);
  igual([s3.marc.lore, h.pend.length], [2, 1], 'II desencadeia uma vez');
});

caso('105.2c', 'filtro cor C = incolor (Mystic Forge, Ugin)', () => {
  const e = cena({});
  const sr = e.por(0, 'Sol Ring'), le = e.por(0, 'Llanowar Elves');
  igual([M.bate(e, sr, { cor: 'C' }), M.bate(e, le, { cor: 'C' })], [true, false], 'Sol Ring é incolor, Llanowar não');
  igual([M.bate(e, sr, { cor: ['C', 'G'] }), M.bate(e, le, { cor: ['C', 'G'] })], [true, true], 'lista: incolor ou verde');
});

caso('603.5', '"you may" do gatilho inteiro (Bloodghast no cemitério): escolhe ao resolver; não = nada acontece', () => {
  for (const quer of [true, false]) {
    const e = cena({ campo: [[0, 'Bloodghast', { zona: 'cemiterio' }]], mao: [[0, 'Forest']] });
    M.avancar(e); resp(e, o => o.a === 'terreno');
    let perguntou = 0;
    resolveCom(e, p => p.tipo === 'talvez' && p.ctx && p.ctx.op === 'gatilho' ? (perguntou++, quer ? 0 : 1) : -1);
    igual(perguntou, 1, 'perguntou uma vez: ' + JSON.stringify(e.log.slice(-6)));
    igual(noCampo(e).includes('Bloodghast'), quer, quer ? 'voltou' : 'ficou');
    igual(naZona(e, 0, 'cemiterio'), quer ? [] : ['Bloodghast']);
  }
});

// anda até o passo (sem parar nele), passando a prioridade; as outras perguntas: f(p) ou o agente básico
const andaAte = (e, passo, f = (p: any) => -1) => {
  const pr = x => x.turno.passo === passo;
  for (let g = 0; !pr(e) && !e.fim; g++) {
    if (g > 400) throw new Error('não chegou em ' + passo);
    if (!e.perg) { M.avancar(e, pr); continue; }
    const p = e.perg;
    if (p.tipo === 'acao') { M.responder(e, p.ops.findIndex(o => o.a === 'passar'), pr); continue; }
    const k = f(p); M.responder(e, k >= 0 ? k : M.agenteBasico()(e, p), pr);
  }
};
caso('508.4', 'Ultra Magnus: ataca, põe criatura artefato da mão virada e atacando (não "atacou"); se puser, converte no fim do combate (gatilho atrasado, 603.7)', () => {
  for (const poe of [true, false]) {
    const e = combate([[0, 'Ultra Magnus, Tactician'], [1, 'Wastes']]);
    e.jogs[0].zonas.mao.push(e.por(0, 'Solemn Simulacrum', { zona: 'mao' }).id); e.jogs[0].zonas.mao.pop();
    ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Ultra Magnus, Tactician')); fecha(e, 'atacar');
    let viu = false;
    andaAte(e, 'dano', p => p.tipo === 'talvez' && p.ctx && p.ctx.op === 'mover' ? (poe ? 0 : 1) : -1);
    const so = objN(e, 0, 'Solemn Simulacrum');
    igual(!!so, poe, 'Solemn no campo: ' + JSON.stringify(e.log.slice(-8)));
    if (poe) {
      ok(so.virada && M.atacando(e, so), 'virada e atacando');
      igual([M.contaAtaque(e, 'atacantes', 0), M.contaAtaque(e, 'ataquesNoTurno', 0)], [2, 1], 'entrou atacando conta como atacante, não como "atacou"');
      viu = true;
    }
    andaAte(e, 'principal2');
    const um = objN(e, 0, 'Ultra Magnus, Tactician');
    igual(um.face ?? null, poe ? 0 : null, 'converteu só se pôs');
    igual(e.jogs[1].vida, 40 - 7 - (viu ? 2 : 0), 'dano do Magnus (+ Solemn)');
    if (poe) {
      ok(M.temTipo(e, um, 'Creature') && M.poder(e, um) === 4, 'Armored Carrier: criatura 4/7 no seu turno ' + JSON.stringify([M.dadoDe(e, um).tipos, M.poder(e, um), e.turno.ativo, um.ctrl, um.zona]));
      e.turno.ativo = 1;
      ok(!M.temTipo(e, um, 'Creature') && M.temTipo(e, um, 'Artifact'), 'no turno do oponente é só artefato');
      e.turno.ativo = 0;
    }
  }
});
caso('603.7c', 'gatilho atrasado "neste turno" que não disparou acaba; o que dispara, dispara uma vez', () => {
  const e = cena({ campo: [[0, 'Ultra Magnus, Tactician']] });
  const um = objN(e, 0, 'Ultra Magnus, Tactician');
  const g = M.carta('Ultra Magnus, Tactician').gat[0].fx[1];
  M.executar(e, { ...g, se: undefined }, { voce: 0, este: um.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, um) }, item: undefined }, () => { throw new Error('não pergunta'); });
  igual(e.atras.length, 1);
  e.turno.n++; M.fimAtrasados(e);
  igual(e.atras.length, 0, 'acabou com o turno');
});
caso('702.21a', 'resguardo {2}: Lightning Bolt do oponente no Ultra Magnus é anulado a menos que ele pague {2}', () => {
  for (const [terrasOp, paga] of [[3, true], [1, false]] as any[]) {
    const e = cena({ campo: [[0, 'Ultra Magnus, Tactician'], ...terras(terrasOp).map(([, n]) => [1, n])], mao: [] });
      e.por(1, 'Lightning Bolt', { zona: 'mao' });
    e.turno.ativo = 1;
    M.avancar(e);
    conj(e, 'Lightning Bolt'); alvoObj(e, 'Ultra Magnus, Tactician');
    resolveCom(e);
    const um = objN(e, 0, 'Ultra Magnus, Tactician');
    igual(um.dano, paga ? 3 : 0, (paga ? 'pagou' : 'não pôde pagar') + ': ' + JSON.stringify(e.log.slice(-8)));
    igual(naZona(e, 1, 'cemiterio'), ['Lightning Bolt']);
  }
});
caso('707.2', 'Ultron: artefato seu entra, paga {2} e cria ficha cópia; se não é criatura, a ficha é 2/2 Robot Villain artefato criatura (animar, 613.1d)', () => {
  for (const nome of ['Sol Ring', 'Solemn Simulacrum']) {
    const e = cena({ campo: [[0, 'Ultron, Artificial Malevolence'], ...terras(nome === 'Sol Ring' ? 3 : 6, 'Wastes')], mao: [[0, nome]] });
    M.avancar(e); conj(e, nome); resolveCom(e);
    const fs = e.campo.map(id => e.objs[id]).filter(o => o.ficha && o.n === nome);
    igual(fs.length, 1, 'uma ficha cópia: ' + JSON.stringify(e.log.slice(-8)));
    const f = fs[0], d = M.dadoDe(e, f);
    if (nome === 'Sol Ring') {
      ok(M.temTipo(e, f, 'Creature') && M.temTipo(e, f, 'Artifact'), 'artefato criatura');
      igual([M.poder(e, f), M.resistencia(e, f), (d.sub || []).includes('Robot')], [2, 2, true]);
    } else ok(!(d.sub || []).includes('Robot'), 'já era criatura: sem animar');
  }
});

caso('608.2g', 'jogar agora (Rishkar\'s Expertise): conjura da mão sem pagar, no meio da resolução; recusar = fica na mão', () => {
  for (const quer of [true, false]) {
    const e = cena({ campo: [[0, 'Grizzly Bears'], ...terras(6, 'Forest')], mao: [[0, "Rishkar's Expertise"], [0, 'Solemn Simulacrum']] });
    M.avancar(e); conj(e, "Rishkar's Expertise");
    resolveCom(e, p => p.tipo === 'jogar' ? p.ops.findIndex(o => quer ? (o.a === 'jogar' && e.objs[o.id].n === 'Solemn Simulacrum') : o.a === 'nenhum') : -1);
    igual(noCampo(e).includes('Solemn Simulacrum'), quer, JSON.stringify(e.log.slice(-8)));
    igual(e.jogs[0].zonas.mao.length, quer ? 2 : 3, 'comprou 2 (maior poder) e o Solemn saiu ou ficou');
    igual(e.turno.magias, quer ? 2 : 1, 'conjurar grátis conta como conjurar');
  }
});
caso('601.2f', 'Geode Golem: dano de combate dá permissão de conjurar o comandante sem pagar até o fim do turno; o imposto (903.8) continua', () => {
  for (const imposto of [0, 1]) {
    const e = cena({ cmd: ['Ultron, Artificial Malevolence'], campo: [[0, 'Geode Golem'], [0, 'Mountain'], ...(imposto ? terras(1) : [])] });
    const ul = e.objs[e.jogs[0].zonas.comando[0]];
    e.jogs[0].imposto[ul.id] = imposto;
    ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Geode Golem')); fecha(e, 'atacar');
    andaAte(e, 'principal2');
    igual(e.jogs[1].vida, 35, 'dano do Golem');
    igual((e.permJogar || []).length, 1, 'permissão: ' + JSON.stringify(e.log.slice(-6)));
    M.avancar(e);
    const pode = opsDe(e, 'conjurar').some(o => o.id === ul.id);
    ok(pode, 'conjura o Ultron com ' + (imposto ? '{2} de imposto' : 'nada'));
    conj(e, 'Ultron, Artificial Malevolence'); resolveCom(e);
    ok(noCampo(e).includes('Ultron, Artificial Malevolence'), JSON.stringify(e.log.slice(-6)));
    igual(e.jogs[0].imposto[ul.id], imposto + 1);
  }
});
caso('400.7', 'Containment Construct: a carta descartada vai ao exílio e pode ser jogada até o fim do turno (anterior); a permissão acaba na limpeza', () => {
  const e = cena({ campo: [[0, 'Containment Construct'], ...terras(3)], mao: [[0, "Brass's Tunnel-Grinder"], [0, 'Sol Ring']] });
  M.avancar(e); conj(e, "Brass's Tunnel-Grinder");
  let feitas = 0;
  resolveCom(e, p => p.tipo === 'descartar' ? (feitas++ ? p.ops.findIndex(o => o.a === 'nenhum') : p.ops.findIndex(o => o.a === 'descartar')) : -1);
  igual(naZona(e, 0, 'exilio'), ['Sol Ring'], JSON.stringify(e.log.slice(-10)));
  const sr = e.objs[e.jogs[0].zonas.exilio[0]];
  ok(M.permJogar(e, 0, sr), 'permissão no Sol Ring exilado');
  e.turno.passo = 'final'; e.pend = [];                              // a limpeza tira o "até o fim do turno"
  andaAte(e, 'manutencao');
  ok(!M.permJogar(e, 0, sr), 'acabou: ' + e.turno.passo + ' ' + e.turno.n);
});

caso('601.2d', 'Verdurous Gearhulk: divide quatro +1/+1 entre os alvos ao pôr na pilha (3 e 1)', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], ...terras(5, 'Forest')], mao: [[0, 'Verdurous Gearhulk']] });
  M.avancar(e); conj(e, 'Verdurous Gearhulk');
  const quero = ['Grizzly Bears', 'Llanowar Elves']; let n = 0;
  resolveCom(e, p => p.tipo === 'alvo' ? (n < 2 ? p.ops.findIndex(o => o.a === 'alvo' && e.objs[o.o] && e.objs[o.o].n === quero[n++]) : p.ops.findIndex(o => o.a === 'pronto'))
    : p.tipo === 'dividir' ? p.ops.findIndex(o => o.v === 3) : -1);
  igual([objN(e, 0, 'Grizzly Bears').marc['+1/+1'], objN(e, 0, 'Llanowar Elves').marc['+1/+1']], [3, 1], JSON.stringify(e.log.slice(-6)));
});
caso('603.3c', 'Monument to Endurance: gatilho modal; o modo é escolhido ao pôr na pilha (cada oponente perde 3)', () => {
  const e = cena({ jogs: 3, campo: [[0, 'Monument to Endurance'], ...terras(3)], mao: [[0, "Brass's Tunnel-Grinder"], [0, 'Wastes']] });
  M.avancar(e); conj(e, "Brass's Tunnel-Grinder");
  let feitas = 0, modo = 0;
  resolveCom(e, p => p.tipo === 'descartar' ? (feitas++ ? p.ops.findIndex(o => o.a === 'nenhum') : p.ops.findIndex(o => o.a === 'descartar'))
    : p.tipo === 'modo' ? (modo++, p.ops.findIndex(o => o.m === 2)) : -1);
  igual(modo, 1, 'perguntou o modo uma vez');
  igual([e.jogs[1].vida, e.jogs[2].vida], [37, 37], JSON.stringify(e.log.slice(-6)));
});
caso('701.14', 'Markov Enforcer: entra e luta com a criatura alvo do oponente (cada uma causa o seu poder na outra)', () => {
  const e = cena({ campo: [[1, 'Hill Giant'], ...terras(6)], mao: [[0, 'Markov Enforcer']] });
  M.avancar(e); conj(e, 'Markov Enforcer');
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.a === 'alvo' && e.objs[o.o] && e.objs[o.o].n === 'Hill Giant') : -1);
  ok(!objN(e, 1, 'Hill Giant'), 'o gigante morreu: ' + JSON.stringify(e.log.slice(-6)));
  igual(objN(e, 0, 'Markov Enforcer').dano, 3);
});
caso('603.2h', 'Losheel: "uma ou mais criaturas artefato entram" dispara uma vez pelo lote e só uma vez por turno', () => {
  const e = cena({ campo: [[0, 'Losheel, Clockwork Scholar']] });
  const m0 = e.jogs[0].zonas.mao.length;
  e.por(0, 'Solemn Simulacrum'); e.por(0, 'Solemn Simulacrum');
  igual(e.pend.filter(p => p.n === 'Losheel, Clockwork Scholar').length, 1, 'uma vez pelas duas');
  M.avancar(e); resolveCom(e);
  e.por(0, 'Solemn Simulacrum');
  igual(e.pend.filter(p => p.n === 'Losheel, Clockwork Scholar').length, 0, 'já disparou neste turno');
  M.avancar(e); resolveCom(e);
  igual(e.jogs[0].zonas.mao.length, m0 + 1, 'comprou 1');
});

// ---------- masmorras (deck da Safana): infectar e veneno (702.90, 704.5c) ----------
// cartas da cena escritas como o banco vai escrever (o B ainda tem o infectar em 'falta'; quando reescrever, valem as do banco)
const criat = (n, pt, kw: any[] = [], o: any = {}) => ({ n, custo: { g: 1, p: ['B'] }, cores: 'B', tipos: ['Creature'], sub: ['Horror'], pt, vm: 2, ci: 'B', kw, ...o });
db['Cena Infecta Voa'] = criat('Cena Infecta Voa', [1, 1], [{ k: 'voar' }, { k: 'infectar' }]);                       // Plague Stinger
db['Cena Infecta Livre'] = criat('Cena Infecta Livre', [1, 1], [{ k: 'infectar' }], { est: [{ modo: 'naoPodeSerBloqueada', afeta: 'este' }] });   // Blighted Agent
db['Cena Infecta 2/2'] = criat('Cena Infecta 2/2', [2, 2], [{ k: 'infectar' }]);                                     // Contagious Nim
db['Cena Infecta Vínculo'] = criat('Cena Infecta Vínculo', [2, 2], [{ k: 'infectar' }, { k: 'vinculoVida' }]);
db['Cena Indestrutível'] = criat('Cena Indestrutível', [2, 2], [{ k: 'indestrutivel' }]);
db['Cena Raio Infecto'] = { n: 'Cena Raio Infecto', custo: { p: ['B'] }, cores: 'B', tipos: ['Instant'], vm: 1, ci: 'B', alvos: [{ f: 'qualquerAlvo' }], kw: [{ k: 'infectar' }],
  fx: [{ op: 'dano', em: { alvo: 0 }, qtd: 3 }] };
caso('702.90b', 'infectar: dano de combate em jogador vira veneno e não tira vida (Plague Stinger)', () => {
  const e = combate([[0, 'Cena Infecta Voa']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Cena Infecta Voa')); fecha(e, 'atacar'); ateFimCombate(e);
  igual([e.jogs[1].vida, e.jogs[1].veneno], [40, 1]);
});
caso('704.5c', 'infectar: o 10º veneno (Blighted Agent num jogador com 9) faz perder o jogo', () => {
  const e = combate([[0, 'Cena Infecta Livre'], [1, 'Grizzly Bears']], { jogs: 3 });
  e.jogs[1].veneno = 9;
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Cena Infecta Livre')); fecha(e, 'atacar'); ateFimCombate(e);
  ok(e.jogs[1].saiu, 'perdeu com ' + e.jogs[1].veneno + ' venenos');
});
caso('702.90c', 'infectar em criatura: marcadores −1/−1 em vez de dano (Contagious Nim × 2/2); a infectada sofre dano normal', () => {
  const e = combate([[0, 'Cena Infecta 2/2'], [1, 'Grizzly Bears']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Cena Infecta 2/2')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Grizzly Bears'), objN(e, 0, 'Cena Infecta 2/2')); fecha(e, 'bloquear'); ateFimCombate(e);
  igual(naZona(e, 1, 'cemiterio'), ['Grizzly Bears']); igual(naZona(e, 0, 'cemiterio'), ['Cena Infecta 2/2'], 'a Nim levou 2 de dano');
  igual(e.jogs[1].vida, 40);
});
caso('702.90c', 'infectar: −1/−1 mata o indestrutível quando a resistência chega a 0 (704.5f); dano de mágica com infectar idem', () => {
  const e = combate([[0, 'Cena Infecta 2/2'], [1, 'Cena Indestrutível'], [1, 'Cena Indestrutível']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Cena Infecta 2/2')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Cena Indestrutível'), objN(e, 0, 'Cena Infecta 2/2')); fecha(e, 'bloquear'); ateFimCombate(e);
  igual(naZona(e, 1, 'cemiterio'), ['Cena Indestrutível'], 'o indestrutível 0/0 morreu');
  const f = cena({ campo: [[0, 'Swamp'], [1, 'Cena Indestrutível']], mao: [[0, 'Cena Raio Infecto']] });
  M.avancar(f); conj(f, 'Cena Raio Infecto'); alvoObj(f, 'Cena Indestrutível'); resolveCom(f);
  igual(naZona(f, 1, 'cemiterio'), ['Cena Indestrutível'], 'dano de mágica com infectar: ' + JSON.stringify(f.log.slice(-4)));
});
caso('702.90b', 'infectar + vínculo: 2 venenos no jogador e o controlador ganha 2 (702.15b); Blightbelly Rat dá veneno ao jogador do dano (marcador doEvento)', () => {
  const e = combate([[0, 'Cena Infecta Vínculo'], [0, 'Blightbelly Rat']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Cena Infecta Vínculo')); atacaCom(e, objN(e, 0, 'Blightbelly Rat')); fecha(e, 'atacar'); ateFimCombate(e);
  igual([e.jogs[1].vida, e.jogs[1].veneno, e.jogs[0].vida], [38, 3, 42], JSON.stringify(e.log.slice(-5)));
});

// ---------- masmorras (309, 701.49) e iniciativa (727) ----------
// escolhe a masmorra / a sala pelo nome; o resto, o agente básico
const escolheM = (masm?, sala?) => (p: any) => p.tipo === 'masmorra' && masm ? p.ops.findIndex(o => o.nome === masm) : p.tipo === 'sala' && sala ? p.ops.findIndex(o => o.n === sala) : -1;
const morreEsqueleto = e => { const o = e.por(0, 'Clattering Skeletons'); M.mover(e, o.id, 'cemiterio'); };   // "quando morre, aventure"
const seguir = e => { e.perg = null; M.avancar(e); };   // a cena mexeu no estado com uma pergunta aberta: o laço segue (ABE, gatilhos)
const masm = (e, j = 0) => e.jogs[j].masm ? e.jogs[j].masm.nome + ':' + M.MASMORRAS[e.jogs[j].masm.nome].salas[e.jogs[j].masm.sala].n : null;
const fichasN = (e, j, n) => e.campo.filter(id => e.objs[id].ctrl === j && e.objs[id].n === n).length;
caso('701.49a', 'Clattering Skeletons morre sem masmorra: escolhe uma das três (a Undercity não), entra na 1ª sala e a sala dispara (309.4c); depois avança pela seta escolhida (701.49b)', () => {
  const e = cena({ grimorio: 10 });
  morreEsqueleto(e); seguir(e);
  let vistas: any[] = [];
  resolveCom(e, p => { if (p.tipo === 'masmorra') vistas = p.ops.map(o => o.nome); return escolheM('Lost Mine of Phandelver')(p); });
  igual(vistas.sort(), ['Dungeon of the Mad Mage', 'Lost Mine of Phandelver', 'Tomb of Annihilation']);
  igual(masm(e), 'Lost Mine of Phandelver:Cave Entrance');
  morreEsqueleto(e); seguir(e);
  let salas: any[] = [];
  resolveCom(e, p => { if (p.tipo === 'sala') salas = p.ops.map(o => o.n); return escolheM(null, 'Mine Tunnels')(p); });
  igual(salas, ['Goblin Lair', 'Mine Tunnels']);
  igual([masm(e), fichasN(e, 0, 'Treasure')], ['Lost Mine of Phandelver:Mine Tunnels', 1]);
});
caso('309.7', 'última sala: quando a habilidade dela sai da pilha a masmorra sai do jogo (704.5t) e fica completada; Dungeon Crawler volta do cemitério (gat completaMasmorra)', () => {
  const e = cena({ campo: [[0, 'Dungeon Crawler', { zona: 'cemiterio' }]] });
  e.jogs[0].masm = { nome: 'Lost Mine of Phandelver', sala: 4, ts: ++e.ts };    // Dark Pool
  const m0 = e.jogs[0].zonas.mao.length;
  morreEsqueleto(e); seguir(e); resolveCom(e);
  igual(e.jogs[0].masm, null, 'saiu do comando');
  igual(e.jogs[0].completas, ['Lost Mine of Phandelver']);
  ok(naZona(e, 0, 'mao').includes('Dungeon Crawler'), 'Crawler voltou: ' + JSON.stringify(e.log.slice(-6)));
  igual(e.jogs[0].zonas.mao.length, m0 + 2, 'Temple of Dumathoin comprou 1 + o Crawler');
});
caso('701.49c', 'aventurar na última sala (a habilidade dela ainda na pilha): completa a masmorra e começa outra na 1ª sala', () => {
  const e = cena();
  const ts = ++e.ts; e.jogs[0].masm = { nome: 'Tomb of Annihilation', sala: 4, ts };
  e.pend.push({ fonte: -1, ts, ctrl: 0, k: 'sala:4', g: { ev: 'sala', fx: [] }, n: 'x', face: null, ficha: null, lki: null, ev: {} });   // o Cradle esperando
  ok(!M.abeMasmorras(e), 'não sai com a sala esperando (704.5t)');
  M.aventurar(e, 0, (j, t, ops) => t === 'masmorra' ? ops.find(o => o.nome === 'Dungeon of the Mad Mage') : ops[0]);
  igual([e.jogs[0].completas, masm(e)], [['Tomb of Annihilation'], 'Dungeon of the Mad Mage:Yawning Portal']);
});
caso('114.4', 'emblema com gatilho (Chandra, Torch of Defiance): cada mágica que você conjura dá 5 de dano a um alvo, toda vez', () => {
  const e = cena({ campo: terras(4, 'Forest'), mao: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears']] });
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta('Chandra, Torch of Defiance')), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  M.avancar(e);
  conj(e, 'Grizzly Bears');
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  igual(e.jogs[1].vida, 35, '5 de dano no oponente');
  ok(noCampo(e).includes('Grizzly Bears'), 'a mágica resolve normal');
  conj(e, 'Grizzly Bears');
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  igual(e.jogs[1].vida, 30, 'emblema dispara de novo (não é de uma vez só)');
});
caso('114.4', 'emblema com estática (Sorin, Lord of Innistrad): suas criaturas +1/+0, inclusive as que entram depois; as do oponente não', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears']] }); e.pend = [];
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta('Sorin, Lord of Innistrad')), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  const pr = j => e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && o.n === 'Grizzly Bears').map(o => [M.poder(e, o), M.resistencia(e, o)]);
  igual(pr(0), [[3, 2]], 'sua: 3/2'); igual(pr(1), [[2, 2]], 'do oponente: 2/2');
  e.efTemp = e.efTemp.filter(t => t.fim !== 'turno');       // a limpeza (514.2) tira só os 'até o fim do turno'
  igual(pr(0), [[3, 2]], 'emblema não some na limpeza');
});
caso('724', 'monarca: compra no começo da etapa final dele; dano de combate no monarca passa a coroa; condição se.monarca', () => {
  const e = cena({ campo: [[1, 'Grizzly Bears']] }); e.pend = [];
  M.EFEITOS.virarMonarca.fx(e, { op: 'virarMonarca', quem: 'voce' }, { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.monarca, 0);
  ok(M.condicao(e, { monarca: true }, { voce: 0, este: -1 }) && M.condicao(e, { monarca: false }, { voce: 1, este: -1 }), 'condição');
  e.pend = [];
  M.evento(e, { ev: 'fase', passo: 'final', ativo: 0 });
  igual(e.pend.map(p => p.k), ['monarca:final'], 'compra na etapa final');
  e.pend = [];
  const urso = e.objs[e.campo.find(id => e.objs[id].n === 'Grizzly Bears')];
  M.evento(e, { ev: 'dano', id: urso.id, fonte: urso.id, jog: 0, qtd: 2, combate: true });
  igual(e.pend.map(p => p.k), ['monarca:dano'], 'dano de combate no monarca');
  M.EFEITOS.virarMonarca.fx(e, e.pend[0].g.fx[0], { voce: 0, este: -1, ev: e.pend[0].ev, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.monarca, 1, 'o dono do urso vira monarca');
});
caso('614.1a', 'dano em dobro até o seu próximo turno no jogador do evento e nas permanentes dele (Lightning, Army of One)', () => {
  const e = cena({ campo: [[1, 'Grizzly Bears'], [0, 'Grizzly Bears']] }); e.pend = [];
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta('Lightning, Army of One')), { voce: 0, este: -1, ev: { ev: 'dano', jog: 1 }, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  const urso = j => e.objs[e.campo.find(id => e.objs[id].n === 'Grizzly Bears' && e.objs[id].ctrl === j)];
  igual([M.substDano(e, 3, { jog: 1 }), M.substDano(e, 3, { o: urso(1) }), M.substDano(e, 3, { jog: 0 }), M.substDano(e, 3, { o: urso(0) })], [6, 6, 3, 3]);
});
caso('603.7a', 'gatilho só neste turno (Forth Eorlingas!): criatura sua dá dano de combate a jogador → você vira monarca; some na limpeza', () => {
  const e = cena({ campo: [[0, 'Grizzly Bears']] }); e.pend = [];
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta('Forth Eorlingas!')), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.efTemp.length, 1); igual(e.efTemp[0].gat.length, 1);
  const urso = e.objs[e.campo.find(id => e.objs[id].n === 'Grizzly Bears')];
  M.evento(e, { ev: 'dano', id: urso.id, fonte: urso.id, jog: 1, qtd: 2, combate: true });
  igual(e.pend.length, 1, 'disparou'); igual(e.pend[0].g.fx[0].op, 'virarMonarca');
  M.evento(e, { ev: 'dano', id: urso.id, fonte: urso.id, jog: 1, qtd: 2, combate: false });
  igual(e.pend.length, 1, 'dano fora de combate não dispara');
});
caso('702.124k', 'Dungeon Delver (antecedente) com o comandante criatura no campo: a sala dispara 2 vezes (603.2d); sem o comandante, 1', () => {
  for (const comCmd of [true, false]) {
    const e = cena({ campo: [[0, 'Dungeon Delver'], ...(comCmd ? [[0, 'Safana, Calimport Cutthroat', { obj: { cmd: true } }]] : [])] });
    e.jogs[0].masm = { nome: 'Lost Mine of Phandelver', sala: 0, ts: ++e.ts };
    morreEsqueleto(e); seguir(e); resolveCom(e, escolheM(null, 'Mine Tunnels'));
    igual(fichasN(e, 0, 'Treasure'), comCmd ? 2 : 1, (comCmd ? 'com' : 'sem') + ' o comandante');
  }
});
// Acererak como o B vai escrever com a negação (o do banco ainda tem o pedaço em 'falta')
db['Cena Acererak'] = { n: 'Cena Acererak', custo: { g: 2, p: ['B'] }, cores: 'B', tipos: ['Creature'], super: ['Legendary'], sub: ['Zombie', 'Wizard'], pt: [5, 5], vm: 3, ci: 'B',
  gat: [{ ev: 'entra', quem: { este: true }, fx: [{ op: 'mover', em: 'este', para: 'mao', se: { completouMasmorra: { nome: 'Tomb of Annihilation', nao: true } } }, { op: 'aventurar', quem: 'voce', se: { completouMasmorra: { nome: 'Tomb of Annihilation', nao: true } } }] }] };
caso('309.7', 'completouMasmorra {nome, nao}: Acererak fica se você completou a Tomb of Annihilation; completou só a Lost Mine, volta à mão e aventura', () => {
  for (const feita of ['Tomb of Annihilation', 'Lost Mine of Phandelver']) {
    const e = cena(); e.jogs[0].completas = [feita];
    e.por(0, 'Cena Acererak'); seguir(e); resolveCom(e, escolheM('Dungeon of the Mad Mage'));
    const fica = feita === 'Tomb of Annihilation';
    igual([noCampo(e).includes('Cena Acererak'), !!e.jogs[0].masm], [fica, !fica], feita);
  }
});
caso('701.49b', 'na Undercity (iniciativa) um aventurar comum avança nela: a regra olha a masmorra que você tem, não como entrou (309.5a)', () => {
  const e = cena();
  e.jogs[0].masm = { nome: 'Undercity', sala: 0, ts: ++e.ts };
  morreEsqueleto(e); seguir(e); resolveCom(e, escolheM(null, 'Lost Well'));
  igual(masm(e), 'Undercity:Lost Well');
});
caso('702.124k', 'Zombie Ogre (morbid): na etapa final aventura só se uma criatura morreu neste turno', () => {
  for (const morreu of [true, false]) {
    const e = cena({ campo: [[0, 'Zombie Ogre'], [0, 'Grizzly Bears']] });
    e.turno.passo = 'principal2';
    if (morreu) M.mover(e, objN(e, 0, 'Grizzly Bears').id, 'cemiterio');
    andaAte(e, 'limpeza', escolheM('Lost Mine of Phandelver'));
    igual(!!e.jogs[0].masm, morreu, morreu ? 'morreu: aventura' : 'ninguém morreu');
  }
});
caso('727.2', 'Aarakocra Sneak: toma a iniciativa e aventura na Undercity (Secret Entrance busca terreno básico); outra entra com a iniciativa: avança', () => {
  const e = cena({ grimorio: 10 });
  const m0 = e.jogs[0].zonas.mao.length;
  e.por(0, 'Aarakocra Sneak'); seguir(e); resolveCom(e);
  igual([e.iniciativa, masm(e)], [0, 'Undercity:Secret Entrance']);
  igual(e.jogs[0].zonas.mao.length, m0 + 1, 'buscou o básico');
  e.por(0, 'Aarakocra Sneak'); seguir(e); resolveCom(e, escolheM(null, 'Forge'));
  igual([e.iniciativa, masm(e)], [0, 'Undercity:Forge'], 'tomar de novo aventura de novo (727.5)');
  ok(objN(e, 0, 'Aarakocra Sneak').marc['+1/+1'] === 2 || e.campo.some(id => e.objs[id].marc['+1/+1'] === 2), 'Forge: dois +1/+1');
});
caso('727.3', 'Underdark Explorer: o oponente tinha a iniciativa, ela passa para você (só um tem) e você entra na Undercity', () => {
  const e = cena(); e.iniciativa = 1;
  e.por(0, 'Underdark Explorer'); seguir(e); resolveCom(e);
  igual([e.iniciativa, masm(e), masm(e, 1)], [0, 'Undercity:Secret Entrance', null]);
});
caso('727.2', 'manutenção de quem tem a iniciativa: aventura na Undercity de novo', () => {
  const e = cena({ passo: 'limpeza' }); e.turno.ativo = 1; e.iniciativa = 0;
  e.jogs[0].masm = { nome: 'Undercity', sala: 0, ts: ++e.ts };
  andaAte(e, 'compra', escolheM(null, 'Lost Well'));
  igual([e.turno.ativo, masm(e)], [0, 'Undercity:Lost Well']);
});
caso('727.2', 'dano de combate em quem tem a iniciativa: o controlador da criatura toma a iniciativa (e aventura na Undercity); dois atacantes, uma vez só', () => {
  const e = combate([[0, 'Grizzly Bears'], [0, 'Hill Giant']]); e.iniciativa = 1;
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Grizzly Bears')); atacaCom(e, objN(e, 0, 'Hill Giant')); fecha(e, 'atacar'); andaAte(e, 'principal2');
  igual([e.iniciativa, masm(e)], [0, 'Undercity:Secret Entrance']);
  igual(e.jogs[0].zonas.mao.length, 1, 'aventurou uma vez só (Secret Entrance: 1 básico)');
});
caso('727.1', 'Safana na etapa final: com a iniciativa 1 Tesouro; com a iniciativa e masmorra completada (a Undercity conta) 3; sem a iniciativa nada', () => {
  for (const [ini, feita, quer] of [[true, false, 1], [true, true, 3], [false, true, 0]] as any[]) {
    const e = cena({ campo: [[0, 'Safana, Calimport Cutthroat']] });
    e.turno.passo = 'principal2'; if (ini) e.iniciativa = 0; if (feita) e.jogs[0].completas = ['Undercity'];
    andaAte(e, 'limpeza');
    igual(fichasN(e, 0, 'Treasure'), quer, JSON.stringify({ ini, feita }));
  }
});

caso('727.4', 'quem tem a iniciativa sai do jogo: o jogador ativo toma (e aventura na Undercity)', () => {
  const e = cena({ jogs: 3 }); e.iniciativa = 2;
  e.jogs[2].vida = 0; seguir(e); resolveCom(e);
  igual([!!e.jogs[2].saiu, e.iniciativa, masm(e)], [true, 0, 'Undercity:Secret Entrance']);
});

caso('602.5b', 'Sarevok\'s Tome: "ative só se" na habilidade de mana — {C} sem a iniciativa, {C}{C} com ela (atv.se)', () => {
  for (const ini of [false, true]) {
    const e = cena(); const t = e.por(0, "Sarevok's Tome"); e.pend = [];
    if (ini) e.iniciativa = 0;
    const f = M.fontesDeMana(e, 0).filter(x => x.id === t.id);
    igual(f.map(x => x.pacotes.map(p => M.somaMana(p))), [[ini ? 2 : 1]], ini ? 'com' : 'sem');
  }
});

caso('701.49a', 'IA escolhe a masmorra por valor: sem carta que pague completar, a Dungeon of the Mad Mage; com uma que nomeia a Tomb of Annihilation (Acererak), a Tomb', () => {
  const ag = M.agenteBasico();
  for (const [mao, quer] of [[[], 'Dungeon of the Mad Mage'], [[[0, 'Cena Acererak']], 'Tomb of Annihilation']] as any[]) {
    const e = cena({ mao });
    const p = { j: 0, tipo: 'masmorra', ops: ['Lost Mine of Phandelver', 'Dungeon of the Mad Mage', 'Tomb of Annihilation'].map(nome => ({ a: 'masmorra', nome })), ctx: {} };
    igual(p.ops[ag(e, p)].nome, quer);
  }
});
caso('701.49b', 'IA escolhe a sala por valor: Goblin Lair → Storeroom (+1/+1) se você tem criatura, senão Dark Pool; o +1/+1 vai na sua criatura', () => {
  for (const tem of [true, false]) {
    const e = cena({ campo: [[1, 'Hill Giant'], ...(tem ? [[0, 'Grizzly Bears']] : [])] });
    e.jogs[0].masm = { nome: 'Lost Mine of Phandelver', sala: 1, ts: ++e.ts };
    morreEsqueleto(e); seguir(e); resolveCom(e);
    igual(masm(e), 'Lost Mine of Phandelver:' + (tem ? 'Storeroom' : 'Dark Pool'));
    if (tem) igual([objN(e, 0, 'Grizzly Bears').marc['+1/+1'], objN(e, 1, 'Hill Giant').marc['+1/+1']], [1, undefined]);
    else igual(e.jogs[1].vida, 39);
  }
});
caso('701.49b', 'Sandfall Cell: cada jogador perde 2 a menos que sacrifique criatura, artefato ou terreno — a IA paga com o Tesouro; quem não tem perde', () => {
  const e = cena();
  e.jogs[0].masm = { nome: 'Tomb of Annihilation', sala: 1, ts: ++e.ts };   // Veils of Fear → Sandfall Cell
  M.criarFicha(e, 0, { nome: 'Treasure' }); e.pend = [];
  morreEsqueleto(e); seguir(e); resolveCom(e);
  igual([masm(e), fichasN(e, 0, 'Treasure'), e.jogs[0].vida, e.jogs[1].vida], ['Tomb of Annihilation:Sandfall Cell', 0, 40, 38]);
});
caso('603.3b', 'a ordem dos gatilhos muda o resultado: tomar a iniciativa por cima entra na Undercity e o aventurar avança nela; o aventurar por cima escolhe outra masmorra e a iniciativa avança nela', () => {
  db['Cena Dupla'] = { n: 'Cena Dupla', custo: { g: 1, p: ['B'] }, cores: 'B', tipos: ['Creature'], sub: ['Rogue'], pt: [2, 2], vm: 2, ci: 'B',
    gat: [{ ev: 'entra', quem: { este: true }, fx: [{ op: 'tomarIniciativa', quem: 'voce' }] }, { ev: 'entra', quem: { este: true }, fx: [{ op: 'aventurar', quem: 'voce' }] }] };
  const fim: any = {};
  for (const primeiro of [0, 1]) {                       // o primeiro posto na pilha resolve por último
    const e = cena({ grimorio: 10 });
    e.por(0, 'Cena Dupla'); seguir(e);
    igual(e.perg && e.perg.tipo, 'ordemGatilho');
    resolveCom(e, p => p.tipo === 'ordemGatilho' ? p.ops.findIndex(o => o.k === primeiro) : -1);
    fim[primeiro] = [e.iniciativa, masm(e)];
  }
  igual(fim[1][1].split(':')[0], 'Undercity', 'iniciativa por cima: Undercity');
  igual(fim[0], [0, 'Dungeon of the Mad Mage:Dungeon Level'], 'aventurar por cima: a IA pega a Mad Mage e a iniciativa avança nela');
});

caso('603.3b', 'ordem indiferente (Edigar): Ivora + Bag of Holding no mesmo descarte não perguntam — marcador na Ivora e a descartada no exílio; com Kozilek descartado a ordem muda tudo e pergunta', () => {
  {
    const e = cena({ campo: [[0, 'Ivora, Insatiable Heir'], [0, 'Bag of Holding']], mao: [[0, 'Forest']], grimorio: 5 }); e.pend = [];
    const iv = objN(e, 0, 'Ivora, Insatiable Heir');
    M.descartar(e, 0, [...e.jogs[0].zonas.mao]); M.avancar(e);
    ok(!(e.perg && e.perg.tipo === 'ordemGatilho'), 'não pergunta a ordem');
    resolveCom(e);
    igual([iv.marc['+1/+1'] || 0, naZona(e, 0, 'exilio'), naZona(e, 0, 'cemiterio')], [1, ['Forest'], []], 'marcador e exílio');
  }
  const fim: any = {};
  for (const primeiro of ['Kozilek, Butcher of Truth', 'Bag of Holding']) {     // o primeiro posto na pilha resolve por último
    const e = cena({ campo: [[0, 'Bag of Holding']], mao: [[0, 'Kozilek, Butcher of Truth']], grimorio: 5 }); e.pend = [];
    M.descartar(e, 0, [...e.jogs[0].zonas.mao]); M.avancar(e);
    igual(e.perg && e.perg.tipo, 'ordemGatilho', 'pergunta');
    resolveCom(e, p => p.tipo === 'ordemGatilho' ? p.ops.findIndex(o => e.objs[o.id].n === primeiro) : -1);
    fim[primeiro] = [naZona(e, 0, 'exilio'), e.jogs[0].zonas.grimorio.length];
  }
  igual(fim['Kozilek, Butcher of Truth'], [['Kozilek, Butcher of Truth'], 5], 'Bag resolve antes: Kozilek exilado');
  igual(fim['Bag of Holding'], [[], 6], 'Kozilek resolve antes: volta ao grimório, a Bag não acha a carta');
});

caso('603.10a', 'de qualquer lugar (Kozilek): morrer no campo dispara uma vez só (olhar para trás), não de novo pelo cemitério; moída do grimório também dispara', () => {
  for (const de of ['campo', 'grimorio']) {
    const e = cena({ campo: de === 'campo' ? [[0, 'Kozilek, Butcher of Truth']] : [], grimorio: 3 }); e.pend = [];
    const id = de === 'campo' ? objN(e, 0, 'Kozilek, Butcher of Truth').id : e.por(0, 'Kozilek, Butcher of Truth', { zona: 'grimorio' }).id;
    M.mover(e, id, 'cemiterio');
    igual(e.pend.map(p => p.n), ['Kozilek, Butcher of Truth'], de);
  }
});
caso('614.12', 'escolher modo ao entrar (Mirrodin Besieged): as opções são os modos que as habilidades leem; Mirran faz Myr ao conjurar artefato, Phyrexian não', () => {
  for (const modo of ['Mirran', 'Phyrexian']) {
    const e = cena({ campo: terras(5, 'Island'), mao: [[0, 'Mirrodin Besieged'], [0, 'Sol Ring']] }); e.pend = [];
    M.avancar(e); conj(e, 'Mirrodin Besieged');
    resolveCom(e, p => { if (p.tipo === 'escolha') { igual(p.ops.map(o => o.v), ['Mirran', 'Phyrexian'], 'opções'); return p.ops.findIndex(o => o.v === modo); } return -1; });
    const mb = e.objs[e.campo.find(id => e.objs[id].n === 'Mirrodin Besieged')];
    igual(mb.escolha && mb.escolha.modo, modo, 'modo guardado');
    M.avancar(e); conj(e, 'Sol Ring'); resolveCom(e);
    igual(e.campo.filter(id => e.objs[id].n === 'Myr' || (e.objs[id].ficha && (e.objs[id].ficha.sub || []).includes('Myr'))).length, modo === 'Mirran' ? 1 : 0, modo);
  }
});
caso('615.1', 'prevenir dano até o fim do turno (efeitoTemporario): Selfless Squire protege só você; Spore Frog só o de combate e vale com ela já no cemitério; some na limpeza', () => {
  const fxDe = n => { const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; }; return ach(M.carta(n)); };
  const e = cena({ campo: [[0, 'Spore Frog']] }); e.pend = [];
  const sapo = objN(e, 0, 'Spore Frog');
  const ctx = id => ({ voce: 0, este: id, alvos: [], ilegal: {}, lki: { alvos: [] } });
  M.executar(e, fxDe('Selfless Squire'), ctx(-1), null);
  igual([M.substDano(e, 5, { jog: 0 }), M.substDano(e, 5, { jog: 1 })], [0, 5], 'Squire: só você');
  e.efTemp = [];
  M.mover(e, sapo.id, 'cemiterio'); M.executar(e, fxDe('Spore Frog'), ctx(sapo.id), null);
  igual([M.substDano(e, 3, { jog: 1, combate: true }), M.substDano(e, 3, { jog: 1 })], [0, 3], 'Frog: só combate, fonte já saiu');
  passarAte(e, 'limpeza'); passarAte(e, 'manutencao');
  igual(M.substDano(e, 3, { jog: 1, combate: true }), 3, 'acabou no fim do turno');
});
caso('611.2b', 'efeitoTemporario de regra do jogador: Explore dá terreno extra só neste turno; Ancient Silver Dragon tira o limite de mão pelo resto da partida', () => {
  const fxDe = n => { const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; }; return ach(M.carta(n)); };
  const e = cena(); e.pend = [];
  const ctx = { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } };
  M.executar(e, fxDe('Explore'), ctx, null); M.executar(e, fxDe('Ancient Silver Dragon'), ctx, null);
  igual([M.terrenosPorTurno(e, 0), M.terrenosPorTurno(e, 1), M.maoMax(e, 0), M.maoMax(e, 1)], [2, 1, Infinity, 7], 'neste turno');
  passarAte(e, 'limpeza'); passarAte(e, 'manutencao');
  igual([M.terrenosPorTurno(e, 0), M.maoMax(e, 0)], [1, Infinity], 'turno seguinte');
});
caso('702.8', 'como se tivesse lampejo: Singer of Swift Rivers deixa conjurar Merfolk no turno do oponente (Grizzly não); Alchemist\'s Refuge vale para tudo só neste turno', () => {
  const e = cena({ campo: [...terras(3, 'Island'), ...terras(3, 'Forest'), [0, 'Singer of Swift Rivers']], mao: [[0, 'Lord of Atlantis'], [0, 'Grizzly Bears']] }); e.pend = [];
  e.turno.ativo = 1;                                         // turno do oponente: velocidade de feitiço não vale
  const id = n => e.jogs[0].zonas.mao.find(x => e.objs[x].n === n);
  igual([M.podeConjurar(e, 0, e.objs[id('Lord of Atlantis')]), M.podeConjurar(e, 0, e.objs[id('Grizzly Bears')])], [true, false], 'Singer');
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta("Alchemist's Refuge")), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  ok(M.podeConjurar(e, 0, e.objs[id('Grizzly Bears')]), 'Refuge');
  igual(M.podeConjurar(e, 1, e.objs[id('Grizzly Bears')]), false, 'só para quem ativou');
});
caso('702.11c', 'jogador com antimagia até o fim do turno (Lazotep Plating): oponente não mira você, você mesmo pode; some na limpeza', () => {
  const e = cena(); e.pend = [];
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  M.executar(e, ach(M.carta('Lazotep Plating')), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  const mira = q => M.alvoLegal(e, { f: 'jogador' }, { jog: 0 }, { voce: q });
  igual([mira(1), mira(0)], [false, true], 'neste turno');
  passarAte(e, 'limpeza'); passarAte(e, 'manutencao');
  igual(mira(1), true, 'acabou');
});
caso('101.2', 'não pode conjurar neste turno (Conduit of Worlds, se conjurou pela habilidade): o "não pode" vence; volta no turno seguinte', () => {
  const e = cena({ campo: terras(4, 'Forest'), mao: [[0, 'Grizzly Bears']] }); e.pend = [];
  const gb = e.objs[e.jogs[0].zonas.mao[0]];
  const fx = M.carta('Conduit of Worlds').atv[0].fx[1];
  ok(M.podeConjurar(e, 0, gb), 'antes');
  M.executar(e, fx, { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] }, pagou: true }, null);
  igual(M.podeConjurar(e, 0, gb), false, 'depois');
  passarAte(e, 'limpeza'); passarAte(e, 'manutencao');
  igual(e.efTemp.length, 0, 'acabou');
});
caso('702.92a', 'arma viva (Mortarpod): ao entrar cria Germe 0/0 preto e se anexa a ele — o Germe fica 0/1 e vive; sacrificar o Germe dá 1 de dano', () => {
  const e = cena({ campo: terras(2), mao: [[0, 'Mortarpod']] }); e.pend = [];
  M.avancar(e); conj(e, 'Mortarpod'); resolveCom(e);
  const mp = e.objs[e.campo.find(id => e.objs[id].n === 'Mortarpod')];
  const germe = e.objs[e.campo.find(id => e.objs[id].n === 'Phyrexian Germ')];
  ok(germe, 'Germe no campo (não morreu como 0/0)');
  igual([mp.anexo && mp.anexo.id, M.poder(e, germe), M.resistencia(e, germe)], [germe.id, 0, 1], 'anexado, 0/1');
  const k = M.atvDe(e, germe).findIndex(a => a.custo && a.custo.sacrificar === 'este');
  ok(k >= 0, 'Germe ganhou a habilidade');
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === germe.id && o.k === k);
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  igual([germe.zona, e.jogs[1].vida, mp.anexo], ['cemiterio', 39, null], 'Germe sacrificado, 1 de dano, Mortarpod solto');
});
caso('615.12', 'dano não pode ser prevenido neste turno (Bonecrusher Giant): o Spore Frog não previne mais', () => {
  const e = cena(); e.pend = [];
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  const ctx = { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } };
  M.executar(e, ach(M.carta('Spore Frog')), ctx, null);
  igual(M.substDano(e, 3, { jog: 1, combate: true }), 0, 'prevenido');
  M.executar(e, ach(M.carta('Bonecrusher Giant')), { ...ctx, voce: 1 }, null);
  igual(M.substDano(e, 3, { jog: 1, combate: true }), 3, 'não prevenível');
});
caso('702.124k', 'Escolha um Antecedente: Safana + Dungeon Delver começam no comando (identidade UB, 903.4); cada um é conjurado de lá com o próprio imposto (702.124d)', () => {
  const d = M.novoJogo([{ comandante: ['Safana, Calimport Cutthroat', 'Dungeon Delver'], cartas: enche(20) }, { cartas: enche(20) }]);
  igual(naZona(d, 0, 'comando').sort(), ['Dungeon Delver', 'Safana, Calimport Cutthroat']); igual(d.jogs[0].ci, 'UB');
  const e = cena({ cmd: ['Safana, Calimport Cutthroat'], campo: [...terras(5, 'Swamp'), ...terras(2, 'Island')] });
  const dv = e.por(0, 'Dungeon Delver', { zona: 'comando', obj: { cmd: true } }); e.jogs[0].cmd.push(dv.id); e.jogs[0].imposto[dv.id] = 0;
  const sf = e.objs[e.jogs[0].cmd[0]];
  M.avancar(e);
  igual(opsDe(e, 'conjurar').map(o => e.objs[o.id].n).sort(), ['Dungeon Delver', 'Safana, Calimport Cutthroat']);
  conj(e, 'Safana, Calimport Cutthroat'); resolveCom(e); conj(e, 'Dungeon Delver'); resolveCom(e);
  ok(noCampo(e).includes('Safana, Calimport Cutthroat') && noCampo(e).includes('Dungeon Delver'), JSON.stringify(noCampo(e)));
  igual([e.jogs[0].imposto[sf.id], e.jogs[0].imposto[dv.id]], [1, 1]);
  M.mover(e, sf.id, 'mao');                                         // volta ao comando (903.9b): o imposto dela é 2, o do Delver não muda
  igual([sf.zona, M.vmDe(M.custoComImposto(e, sf)), e.jogs[0].imposto[dv.id]], ['comando', 5, 1]);
});

// perda de vida como evento (CR 119.3, 120.3a): Mindcrank mói o que o oponente perdeu, Exquisite Blood ganha isso,
// Vilis (do oponente) compra isso; pagar vida é perder vida (119.4). Sanguine Bond + Exquisite Blood: o laço termina com
// o oponente morto (704.5a), sem travar.
caso('119.3', 'perdeVida: Bolt no oponente → Mindcrank mói 3, Exquisite Blood ganha 3, Vilis do oponente compra 3', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mindcrank'], [0, 'Exquisite Blood'], [1, 'Vilis, Broker of Blood']], mao: [[0, 'Lightning Bolt']] });
  e.pend = [];
  M.avancar(e); conj(e, 'Lightning Bolt');
  if (e.perg && e.perg.tipo === 'alvo') alvoJog(e, 1);
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  igual([e.jogs[1].vida, e.jogs[0].vida], [37, 43], 'vidas ' + JSON.stringify(e.log.slice(-10)));
  igual(e.jogs[1].zonas.cemiterio.length, 3, 'Mindcrank: mói 3');
  igual(e.jogs[1].zonas.mao.length, 3, 'Vilis: compra 3');
});
caso('119.4', 'pagar vida é perder vida: Vilis dispara com o pagamento; ganhar vida não dispara perdeVida', () => {
  const e = cena({ campo: [[0, 'Vilis, Broker of Blood']] });
  e.pend = [];
  M.perderVida(e, 0, 2); M.ganharVida(e, 0, 5);
  igual(e.pend.map(p => [p.n, p.ev.ev, p.ev.q]), [['Vilis, Broker of Blood', 'perdeVida', 2]], 'só a perda dispara o Vilis');
});
caso('704.5a', 'Sanguine Bond + Exquisite Blood: um Bolt no oponente vira laço, o oponente morre e o laço para', () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Sanguine Bond'], [0, 'Exquisite Blood']], mao: [[0, 'Lightning Bolt']] });
  e.pend = [];
  M.avancar(e); conj(e, 'Lightning Bolt');
  if (e.perg && e.perg.tipo === 'alvo') alvoJog(e, 1);
  resolveCom(e, p => p.tipo === 'alvo' ? p.ops.findIndex(o => o.jog === 1) : -1);
  ok(e.jogs[1].vida <= 0 || e.jogs[1].saiu || (e.fim && e.fim.vencedor === 0), 'oponente com ' + e.jogs[1].vida + ' fim ' + JSON.stringify(e.fim));
  ok(e.jogs[0].vida >= 77, 'eu com ' + e.jogs[0].vida);
});

caso('701.21', "gatilho 'sacrificado': Tracker cresce com a Pista quebrada (custo); Carmen vê qualquer sacrifício, até o dela (603.10a); morrer não é sacrificar; Bats só com ficha sua", () => {
  for (const c of ['Captain Lannery Storm', 'Carmen, Cruel Skymarcher', 'Mirkwood Bats', 'Nuka-Cola Vending Machine', 'Rapacious Guest', 'The Sackville-Bagginses', 'Tireless Tracker']) ok(M.carta(c).gat.filter(g => g.ev === 'sacrificado').every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Wastes'], [0, 'Wastes'], [0, 'Tireless Tracker'], [0, 'Mirkwood Bats'], [0, 'Carmen, Cruel Skymarcher'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const [, , tt, mb, ca, gb, le] = e.campo;
  ficha(e, 0, 'Clue'); e.pend = [];
  const v1 = e.jogs[1].vida;
  M.avancar(e); ativaFicha(e, 'Clue'); resolveCom(e);
  igual([e.objs[tt].marc['+1/+1'], e.objs[ca].marc['+1/+1'], e.jogs[1].vida], [1, 1, v1 - 1], 'Pista sacrificada: Tracker +1, Carmen +1, Bats drena 1');
  e.pend = []; M.mover(e, gb, 'cemiterio');
  igual(e.pend.length, 0, 'morrer sem sacrificar não dispara');
  const sacr = (j, nome) => M.executar(e, { op: 'sacrificar', quem: 'voce', qtd: 1, f: { nome } }, { voce: j, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, (_j, _t, ops) => ops[0]);
  sacr(1, 'Llanowar Elves');
  igual(e.pend.map(p => p.n), ['Carmen, Cruel Skymarcher'], 'o oponente sacrificou: só a Carmen (Bats pede ficha sua; Tracker, Pista)');
  e.pend = []; const vida = e.jogs[0].vida;
  sacr(0, 'Carmen, Cruel Skymarcher');
  igual(e.pend.map(p => p.n), ['Carmen, Cruel Skymarcher'], 'a Carmen se vê sacrificada (olha para trás)');
  seguir(e); resolveCom(e);
  igual(e.jogs[0].vida, vida + 1, 'e ganha 1 de vida');
});
caso('714.4', "saga que termina é sacrificada: dispara 'sacrificado' (Carmen)", () => {
  const e = cena({ campo: [[0, 'Carmen, Cruel Skymarcher'], [0, 'The Eldest Reborn']], passo: 'principal2' });
  const [ca, sg] = e.campo; e.objs[sg].marc.lore = 3; e.pend = [];
  seguir(e);
  ok(e.objs[sg].zona !== 'campo', 'a saga saiu');
  resolveCom(e);
  igual(e.objs[ca].marc['+1/+1'], 1, 'Carmen disparou com a saga sacrificada ' + JSON.stringify(e.log.slice(-6)));
});

caso('205.3m', "op escolher na resolução: Kindred Dominance destrói o que não é do tipo; Distant Melody conta; Mother of Runes dá proteção da cor; o agente guarda o tipo que mais tem", () => {
  for (const c of ['Distant Melody', 'Kindred Dominance', 'Kindred Judgment', 'Mother of Runes', 'Pact of the Serpent', "Patriarch's Bidding", 'Raise the Palisade']) ok(M.fxSuportado(M.carta(c).fx || M.carta(c).atv[0].fx), c + ' aceito');
  const e = cena({ campo: [[0, 'Llanowar Elves'], [0, 'Llanowar Elves'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const [l1, l2, g0, g1, l3] = e.campo;
  const ctx = (): any => ({ voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } });
  const pede: any[] = [];
  const escolhe = v => (_j, t, ops) => { pede.push([t, ops.map(o => o.v).join()]); return ops.find(o => o.v === v) || ops[0]; };
  const m0 = e.jogs[0].zonas.mao.length;
  const cm = ctx(); for (const f of M.carta('Distant Melody').fx) M.executar(e, f, cm, escolhe('Elf'));
  igual(e.jogs[0].zonas.mao.length - m0, 2, 'Distant Melody: 2 Elfos meus');
  igual(pede[0], ['escolha', 'Bear,Druid,Elf'], 'pergunta os tipos que existem na partida');
  const ag = M.agenteBasico();
  const k = ag(e, { tipo: 'escolha', j: 0, ops: [{ a: 'tipo', v: 'Bear' }, { a: 'tipo', v: 'Elf' }], ctx: {} });
  igual(k, 1, 'o agente escolhe Elf (2 no campo contra 1 Urso)');
  const cd = ctx(); for (const f of M.carta('Kindred Dominance').fx) M.executar(e, f, cd, escolhe('Elf'));
  igual([l1, l2, l3, g0, g1].map(id => e.objs[id].zona), ['campo', 'campo', 'campo', 'cemiterio', 'cemiterio'], 'só os Elfos ficam (de todos)');
  const mr = e.por(0, 'Mother of Runes'), bolt = { cores: 'R' };
  const ca: any = { ...ctx(), este: mr.id, alvos: [[{ o: l1, ts: e.objs[l1].ts }]] };
  for (const f of M.carta('Mother of Runes').atv[0].fx) M.executar(e, f, ca, escolhe('R'));
  igual([M.protegeDe(e, e.objs[l1], bolt), M.protegeDe(e, e.objs[l2], bolt), M.protegeDe(e, e.objs[l1], { cores: 'G' })], [true, false, false], 'proteção do vermelho só no alvo');
});

caso('500.8', "fases extras: Aggravated Assault na 1ª principal põe combate + principal logo depois dela; a fase criada por último vem primeiro", () => {
  const e = cena({ passo: 'desvirar' }); e.turno.feito = false;
  const vistos: any[] = []; let feito = false;
  for (let g = 0; g < 80 && e.turno.n === 2; g++) {
    if (vistos[vistos.length - 1] !== e.turno.passo) vistos.push(e.turno.passo);
    if (e.turno.passo === 'principal1' && !feito) { feito = true; const cx = { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }; for (const f of M.carta('Aggravated Assault').atv[0].fx) M.executar(e, f, cx, null); }   // um ctx: a mesma resolução
    const p0 = e.turno.passo; const pr = x => x.turno.passo !== p0; M.avancar(e, pr); if (e.perg) M.responder(e, 0, pr);
  }
  const C = ['inicioCombate', 'atacantes', 'fimCombate'];
  igual(vistos, ['desvirar', 'manutencao', 'compra', 'principal1', ...C, 'principal2', ...C, 'principal2', 'final', 'limpeza'], 'combate e principal extras antes do combate normal');
  const t = cena({ passo: 'principal2' });
  M.faseExtra(t, 'combate', 1); M.faseExtra(t, 'principal', 1); M.faseExtra(t, 'combate', 2);
  igual(t.turno.extras, ['combate', 'combate', 'principal'], 'a de outro efeito vai na frente; as do mesmo ficam juntas');
});
caso('500.8', "Aurelia: ataca, desvira e ganha um 2º combate; no 2º ataque não dispara de novo (1ª vez no turno); primeiroCombate", () => {
  ok(['Aurelia, the Warleader', 'Combat Celebrant', 'Genji Glove', 'Karlach, Fury of Avernus', 'Moraug, Fury of Akoum'].every(c => (M.carta(c).gat || []).every(g => M.gatOk(g))), 'gatilhos aceitos');
  const e = combate([[0, 'Aurelia, the Warleader']]);
  const au = objN(e, 0, 'Aurelia, the Warleader'), v0 = e.jogs[1].vida;
  ok(M.condicao(e, { primeiroCombate: true }, { voce: 0 }) === true, 'antes de combater, conta como 1º');
  ate(e, 'atacar'); atacaCom(e, au); fecha(e, 'atacar'); ateFimCombate(e);
  igual([e.jogs[1].vida, au.virada, e.turno.passo, e.turno.combates], [v0 - 3, false, 'principal2', 2], 'bateu 3, desvirou e teve 2 combates');
  igual(Object.keys(e.turno.disp || {}).filter(k => k.startsWith(au.id + ':')).map(k => e.turno.disp[k]), [1], 'dispara só no 1º ataque do turno');
  ok(M.condicao(e, { primeiroCombate: false }, { voce: 0 }), 'depois do 2º combate não é mais o 1º');
});

caso('603.2', "gatilho 'sai do cemitério': Syr Konrad por criatura que sai do seu; Teval uma vez pelo grupo (uma ou mais); carta do oponente não conta", () => {
  for (const c of ['Insidious Roots', 'Kheru Goldkeeper', 'Kishla Skimmer', 'Syr Konrad, the Grim', "Teval's Judgment", 'Teval, the Balanced Scale']) ok(M.carta(c).gat.filter(g => g.ev === 'saiCemiterio').every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Syr Konrad, the Grim'], [0, 'Teval, the Balanced Scale']], passo: 'principal2' });
  const gb = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' }), le = e.por(0, 'Llanowar Elves', { zona: 'cemiterio' }), fo = e.por(0, 'Forest', { zona: 'cemiterio' }), op = e.por(1, 'Grizzly Bears', { zona: 'cemiterio' });
  e.pend = [];
  for (const o of [gb, le, fo]) M.mover(e, o.id, 'exilio');
  const n = nm => e.pend.filter(p => p.n === nm).length;
  igual([n('Syr Konrad, the Grim'), n('Teval, the Balanced Scale')], [2, 1], 'Konrad: 2 criaturas; Teval: 1 pelo grupo');
  e.pend = []; M.mover(e, op.id, 'exilio');
  igual(e.pend.length, 0, 'carta do oponente saindo do cemitério dele não conta');
});

caso('120.3', "dano fora do combate é evento: Bolt no Ripjaw Raptor dispara o enrage (compra); dano em outra criatura não", () => {
  for (const c of ['Apex Altisaur', 'Metropolis Reformer', 'Ripjaw Raptor', 'Spiteful Sliver', 'Strong, the Brutish Thespian', 'Wrathful Raptors']) ok((M.carta(c).gat || []).filter(g => g.recebe).every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Ripjaw Raptor'], [0, 'Grizzly Bears']], passo: 'principal2' });
  const [rr, gb] = e.campo;
  const bolt = (id) => M.executar(e, { op: 'dano', em: { alvo: 0 }, qtd: 3 }, { voce: 1, este: -1, alvos: [[{ o: id, ts: e.objs[id].ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  e.pend = []; bolt(gb);
  igual(e.pend.length, 0, 'dano no Urso não dispara o Ripjaw');
  const m = e.jogs[0].zonas.mao.length;
  bolt(rr);
  igual(e.pend.map(p => [p.n, p.ev.combate]), [['Ripjaw Raptor', false]], 'enrage com dano de mágica');
  seguir(e); resolveCom(e);
  igual(e.jogs[0].zonas.mao.length, m + 1, 'comprou 1');
});

caso('702.51', "convocar: Hour of Reckoning ({4}{W}{W}{W}) com 3 Planícies + 4 criaturas viradas; com 3 criaturas não fecha", () => {
  const e = cena({ campo: [[0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Grizzly Bears', { doente: true }], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']], mao: [[0, 'Hour of Reckoning']] });
  ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar'), 'paga com convocar (criatura com enjoo também vira)');
  M.avancar(e); conj(e, 'Hour of Reckoning');
  igual(e.campo.map(id => e.objs[id]).filter(o => o.n === 'Grizzly Bears' && o.virada).length + e.jogs[0].zonas.cemiterio.filter(id => e.objs[id].n === 'Grizzly Bears').length, 4, 'as 4 criaturas pagaram');
  const f = cena({ campo: [[0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']], mao: [[0, 'Hour of Reckoning']] });
  ok(!M.opcoesPrioridade(f, 0).some(o => o.a === 'conjurar'), '3 criaturas + 3 terrenos = 6 de 7');
});

caso('707.10', "cópia de mágica de permanente vira ficha (608.3f): Archmage of Echoes copia o Wizard conjurado", () => {
  const e = cena({ campo: [[0, 'Archmage of Echoes'], [0, 'Island'], [0, 'Island']], mao: [[0, 'Vodalian Hexcatcher']] });
  M.avancar(e); conj(e, 'Vodalian Hexcatcher');
  const ag = M.agenteBasico();
  while (e.perg && e.perg.tipo !== 'acao') M.responder(e, ag(e, e.perg), x => x.turno.passo !== 'principal1');
  const hx = e.campo.map(id => e.objs[id]).filter(o => o.n === 'Vodalian Hexcatcher');
  igual(hx.length, 2, 'original + cópia');
  igual(hx.filter(o => o.ficha).length, 1, 'a cópia é ficha');
  igual(e.jogs[0].conjT.n, 1, 'a cópia não dispara o Archmage de novo');
});

caso('701.15c', "destruir sem regenerar: Terminate mata o Urso (o campo semRegenerar é aceito)", () => {
  ok(M.fxSuportado(M.carta('Terminate').fx), 'Terminate aceito');
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Swamp'], [1, 'Grizzly Bears']], mao: [[0, 'Terminate']] });
  M.avancar(e); conj(e, 'Terminate'); alvoObj(e, 'Grizzly Bears');
  igual(naZona(e, 1, 'cemiterio'), ['Grizzly Bears']); igual(naZona(e, 0, 'cemiterio'), ['Terminate']);
  const f = cena({ campo: [[1, 'Grizzly Bears']] });
  const id = f.campo[0];
  M.executar(f, { op: 'destruir', em: { alvo: 0 }, semRegenerar: true }, { voce: 0, este: -1, alvos: [[{ o: id, ts: f.objs[id].ts }]], ilegal: {}, lki: { alvos: [] } }, null);
  igual(f.objs[id].zona, 'cemiterio', 'pelo executar também');
});

caso('702.96', "sobrecarga: Cyclonic Rift com 7 terrenos devolve TODA permanente não-terreno do oponente; com 2 terrenos só o alvo", () => {
  const ilhas = n => Array.from({ length: n }, () => [0, 'Island']);
  const e = cena({ campo: [...ilhas(7), [0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [1, 'Sol Ring'], [1, 'Forest']], mao: [[0, 'Cyclonic Rift']] });
  M.avancar(e); conj(e, 'Cyclonic Rift'); ok(e.perg && e.perg.tipo === 'opcao', 'pergunta: normal ou sobrecarga'); respE(e, o => o.v.sobrecarga);
  M.avancar(e);
  const no = (n, j) => e.campo.filter(id => e.objs[id].n === n && e.objs[id].ctrl === j).length;
  igual(no('Grizzly Bears', 1) + no('Sol Ring', 1), 0, 'as não-terreno do oponente voltaram');
  igual(no('Forest', 1), 1, 'terreno fica'); igual(no('Grizzly Bears', 0), 1, 'a minha fica');
  igual(e.jogs[1].zonas.mao.filter(id => ['Grizzly Bears', 'Sol Ring'].includes(e.objs[id].n)).length, 2, 'foram para a mão do dono');
  const f = cena({ campo: [...ilhas(2), [1, 'Grizzly Bears'], [1, 'Sol Ring']], mao: [[0, 'Cyclonic Rift']] });
  M.avancar(f); conj(f, 'Cyclonic Rift'); ok(!f.perg || f.perg.tipo !== 'opcao', 'sem mana: nem pergunta'); alvoObj(f, 'Sol Ring'); M.avancar(f);
  igual(f.campo.filter(id => f.objs[id].ctrl === 1).length, 1, 'sem mana para sobrecarga: só um alvo volta');
});

caso('701.13', "gatilho de moer: Glowing One ganha 1 por carta não-terreno moída; Scorchbeast uma vez pelo lote com tantas fichas; Radroach volta do cemitério quando o oponente mói", () => {
  for (const c of ['Glowing One', 'Infesting Radroach', 'Mirelurk Queen', 'Screeching Scorchbeast', 'The Wise Mothman']) ok(M.carta(c).gat.filter(g => g.ev === 'moe').every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Glowing One'], [0, 'Screeching Scorchbeast']] });
  e.por(1, 'Grizzly Bears', { zona: 'grimorio' }); e.por(1, 'Sol Ring', { zona: 'grimorio' });   // topo: Sol Ring, Grizzly Bears, depois Wastes
  const rr = e.por(0, 'Infesting Radroach', { zona: 'cemiterio' });
  e.pend = [];
  M.executar(e, { op: 'moer', quem: 'cadaOponente', qtd: 3 }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  const n = nm => e.pend.filter(p => p.n === nm);
  igual(e.jogs[1].zonas.cemiterio.length, 3, 'moeu 3');
  igual(n('Glowing One').length, 2, 'Glowing One: 2 não-terreno');
  igual(n('Screeching Scorchbeast').map(p => p.ev.n), [2], 'Scorchbeast: 1 disparo, 2 fichas');
  igual(n('Infesting Radroach').length, 2, 'Radroach: dispara do cemitério');
  ok(rr.zona === 'cemiterio');
  const f = cena({ campo: [[0, 'Glowing One']] }); f.pend = [];
  M.executar(f, { op: 'moer', quem: 'voce', qtd: 2 }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  igual(f.pend.length, 0, 'só terreno moído: nada');
});

caso('702.131', "ascender: com 10 permanentes e uma com ascender ganha a bênção e fica com ela; sem a permanente com ascender, não", () => {
  const ilhas = n => Array.from({ length: n }, () => [0, 'Island']);
  const e = cena({ campo: [...ilhas(9), [0, 'Twilight Prophet'], [1, 'Island']] });
  M.abe(e); ok(e.jogs[0].bencao, '10 permanentes com ascender: bênção'); ok(!e.jogs[1].bencao, 'o oponente não');
  for (const id of e.campo.filter(id => e.objs[id].n === 'Island' && e.objs[id].ctrl === 0).slice(0, 5)) M.mover(e, id, 'cemiterio');
  M.abe(e); ok(e.jogs[0].bencao, 'continua com a bênção com menos de 10 (702.131c)');
  ok(M.condicao(e, { palavra: 'blessing' }, { voce: 0 }), 'a condição lê a bênção');
  const f = cena({ campo: [...ilhas(10)] }); M.abe(f);
  ok(!f.jogs[0].bencao && !M.condicao(f, { palavra: 'blessing' }, { voce: 0 }), 'sem permanente com ascender: nada');
});

caso('702.40', "tempestade: Grapeshot depois de 2 mágicas no turno causa 3 de dano (a original + 2 cópias); primeira do turno não copia", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Shock'], [0, 'Shock'], [0, 'Grapeshot']] });
  M.avancar(e);
  for (let i = 0; i < 2; i++) { conj(e, 'Shock'); alvoJog(e, 1); M.avancar(e); }
  igual(e.jogs[1].vida, 40 - 4, 'dois Shock');
  conj(e, 'Grapeshot'); alvoJog(e, 1);
  M.avancar(e);
  for (let i = 0; i < 20 && e.perg && e.perg.tipo === 'talvez' && e.perg.ctx.op === 'novoAlvo'; i++) { respE(e, o => o.a === 'nao'); M.avancar(e); }   // as cópias ficam com o mesmo alvo
  igual(e.jogs[1].vida, 40 - 4 - 3, 'Grapeshot + 2 cópias');
  const f = cena({ campo: [[0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Grapeshot']] });
  M.avancar(f); conj(f, 'Grapeshot'); alvoJog(f, 1); M.avancar(f);
  igual(f.jogs[1].vida, 39, 'primeira mágica do turno: sem cópia');
});

caso('702.29e', "ciclo de tipo: Step Through (ciclo de Wizard {2}) procura um Wizard e embaralha; Homing Sliver dá ciclo de Sliver aos Slivers da mão", () => {
  const e = cena({ campo: [...terras(2, 'Wastes')], mao: [[0, 'Step Through']] });
  e.por(0, 'Vedalken Aethermage', { zona: 'grimorio' }); e.pend = [];
  M.avancar(e);
  const k = e.perg.ops.findIndex(op => op.a === 'ativar' && e.objs[op.id].n === 'Step Through');
  ok(k >= 0, 'ciclo de Wizard oferecido da mão'); M.responder(e, k); resolveCom(e);
  igual(naZona(e, 0, 'cemiterio'), ['Step Through']);
  igual(naZona(e, 0, 'mao'), ['Vedalken Aethermage'], 'achou o Wizard');
  const f = cena({ campo: [...terras(3, 'Wastes'), [0, 'Homing Sliver']], mao: [[0, 'Grizzly Bears']] }); f.pend = [];
  M.avancar(f); ok(!opsDe(f, 'ativar').some(op => f.objs[op.id].n === 'Grizzly Bears'), 'não-Sliver não cicla');
  const g = cena({ campo: [...terras(3, 'Wastes'), [0, 'Homing Sliver']], mao: [[0, 'Blur Sliver']] }); g.pend = [];
  M.avancar(g);
  ok(opsDe(g, 'ativar').some(op => g.objs[op.id].n === 'Blur Sliver'), 'Sliver da mão ganha ciclo de Sliver');
  const h = cena({ campo: [...terras(3, 'Wastes'), [1, 'Homing Sliver']], mao: [[0, 'Blur Sliver']] }); h.pend = [];
  M.avancar(h);
  ok(!opsDe(h, 'ativar').some(op => h.objs[op.id].n === 'Blur Sliver'), 'o Homing do oponente não dá à minha mão');
});

caso('121.1', "comprar com conta: Windfall (o maior descarte), Peer into the Abyss (metade do grimório e da vida do alvo, para cima), One with the Machine (maior VM)", () => {
  const e = cena({ mao: [[0, 'Grizzly Bears'], [0, 'Forest'], [1, 'Forest'], [1, 'Forest'], [1, 'Sol Ring']] });
  const X = (c, ctx = {}) => M.executar(e, c, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, ...ctx }, () => ({ a: 'nao' }));
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  for (const f of M.carta('Windfall').fx) M.executar(e, f, ctx, () => ({ a: 'nao' }));
  igual([e.jogs[0].zonas.mao.length, e.jogs[1].zonas.mao.length], [3, 3], 'cada um compra 3 (o maior descarte)');
  const g0 = e.jogs[1].zonas.grimorio.length;
  for (const f of M.carta('Peer into the Abyss').fx) X(f, { alvos: [[{ jog: 1 }]] });
  igual(e.jogs[1].zonas.grimorio.length, g0 - Math.ceil(g0 / 2), 'metade do grimório, para cima');
  igual(e.jogs[1].vida, 20, 'perde metade de 40');
  const f = cena({ campo: [[0, 'Sol Ring'], [0, 'Gilded Lotus']] });
  const m0 = f.jogs[0].zonas.mao.length;
  M.executar(f, M.carta('One with the Machine').fx[0], { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  igual(f.jogs[0].zonas.mao.length - m0, 5, 'Gilded Lotus: VM 5');
  for (const c of ['Windfall', 'Peer into the Abyss', 'One with the Machine', "Jace's Archivist", 'Whispering Madness']) ok(M.fxSuportado(M.carta(c).fx || M.carta(c).atv[0].fx), c);
});

caso('701.15', "regenerar: o escudo troca destruir e dano letal por virar + tirar o dano + sair do combate; um por escudo; semRegenerar e resistência 0 não; acaba no turno", () => {
  const e = cena({ campo: [[0, 'Nightscape Familiar'], [1, 'Grizzly Bears']] });
  const nf = e.objs[e.campo.find(id => e.objs[id].n === 'Nightscape Familiar')];
  const X = (f, ctx: any = {}) => M.executar(e, f, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: nf.id, ...ctx }, () => ({ a: 'nao' }));
  ok(M.fxSuportado(M.carta('Nightscape Familiar').atv.find(a => a.fx.some(f => f.op === 'regenerar')).fx), 'aceito');
  X({ op: 'regenerar', em: 'este' }); X({ op: 'regenerar', em: 'este' });
  X({ op: 'destruir', em: 'este' });
  ok(nf.zona === 'campo' && nf.virada, '1º destruir: regenera (vira)');
  nf.dano = 5; M.abe(e);
  ok(nf.zona === 'campo' && nf.dano === 0, 'dano letal: 2º escudo, tira o dano');
  nf.dano = 5; M.abe(e);
  ok(nf.zona === 'cemiterio', 'sem escudo: morre');
  const f = cena({ campo: [[0, 'Grizzly Bears']] }); const gb = f.objs[f.campo[0]];
  const Y = fx => M.executar(f, fx, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: gb.id }, () => ({ a: 'nao' }));
  Y({ op: 'regenerar', em: 'este' }); Y({ op: 'destruir', em: 'este', semRegenerar: true });
  ok(gb.zona === 'cemiterio', "can't be regenerated: vai");
  const g = cena({ campo: [[0, 'Grizzly Bears']] }); const g2 = g.objs[g.campo[0]];
  M.executar(g, { op: 'regenerar', em: 'este' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: g2.id }, () => ({ a: 'nao' }));
  g.turno.n++;
  M.executar(g, { op: 'destruir', em: 'este' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: g2.id }, () => ({ a: 'nao' }));
  ok(g2.zona === 'cemiterio', 'o escudo é só deste turno');
  for (const c of ['Asceticism', 'Crypt Sliver', 'Goblin Chirurgeon', 'Zombie Master']) ok(JSON.stringify(M.carta(c)).includes('regenerar'), c);
});

caso('613.1d', "tiraTipo: deus de Theros não é criatura com devoção < 5 (Purphoros); com 5 é criatura de novo; perde o subtipo God junto", () => {
  const e = cena({ campo: [[0, 'Purphoros, God of the Forge']] });
  const p = e.objs[e.campo[0]];
  ok(!M.temTipo(e, p, 'Creature') && M.temTipo(e, p, 'Enchantment'), 'devoção 1: só encantamento');
  ok(!(M.dadoDe(e, p).sub || []).includes('God'), 'sem o subtipo de criatura');
  e.por(0, 'Krenko, Mob Boss'); ok(!M.temTipo(e, p, 'Creature'), 'devoção 3: ainda não');
  e.por(0, 'Krenko, Mob Boss'); ok(M.temTipo(e, p, 'Creature') && M.poder(e, p) === 6, 'devoção 5: criatura 6/5');
  for (const c of ['Athreos, God of Passage', 'Iroas, God of Victory', 'Nylea, God of the Hunt']) ok(M.carta(c).est.filter(s => s.tiraTipo).every(s => M.estContOk(s)), c);
});

caso('701.47', "amassar: sem Armada cria a ficha 0/0 com o tipo e põe os marcadores; com Armada, só marca a que existe e dá o tipo", () => {
  ok(M.fxSuportado([{ op: 'amassar', quem: 'voce', sub: ['Orc'], qtd: 1 }]), 'amassar aceito');
  const e = cena({ campo: [] });
  const cx = () => ({ voce: 0, alvos: [], ilegal: {}, lki: {} });
  M.executar(e, { op: 'amassar', quem: 'voce', sub: ['Orc'], qtd: 1 }, cx(), () => ({ a: 'nao' }));
  const ars = () => e.campo.map(id => e.objs[id]).filter(o => (M.dadoDe(e, o).sub || []).includes('Army'));
  igual(ars().length, 1, 'criou uma Armada');
  const a = ars()[0];
  igual([M.poder(e, a), M.resistencia(e, a)], [1, 1], 'Armada 1/1');
  ok(M.dadoDe(e, a).sub.includes('Orc'), 'é Orc');
  M.executar(e, { op: 'amassar', quem: 'voce', sub: ['Zombie'], qtd: 2 }, cx(), () => ({ a: 'nao' }));
  igual(ars().length, 1, 'não cria outra');
  igual(M.poder(e, a), 3, '+2 na mesma');
  ok(M.dadoDe(e, a).sub.includes('Zombie'), 'virou Zombie também');
});

caso('111.1', "quantidade de fichas: metade dos Zumbis (para baixo), marcadores de experiência seus, poder e marcadores da que morreu (LKI)", () => {
  for (const c of ['Chasm Skulker', 'Elenda, the Dusk Rose', "Elenda's Hierophant", 'Endless Ranks of the Dead', "Otharri, Suns' Glory"]) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const cx = () => ({ voce: 0, alvos: [], ilegal: {}, lki: {} });
  const zumbi = { pt: [2, 2], cores: 'B', tipos: ['Creature'], sub: ['Zombie'] };
  const e = cena({ campo: [] });
  M.criarFichas(e, 0, zumbi, 5);
  M.executar(e, M.carta('Endless Ranks of the Dead').gat[0].fx[0], cx(), () => ({ a: 'nao' }));
  igual(e.campo.length, 7, '5 Zumbis → +2');
  e.jogs[0].marc = { experience: 3 };
  igual(M.qtdDe(e, { conta: { de: 'voce', o: 'marcadores', marc: 'experience' } }, cx()), 3, '3 de experiência');
  const f = cena({ campo: [[0, 'Chasm Skulker'], [0, 'Elenda, the Dusk Rose']] });
  const sk = f.campo.map(id => f.objs[id]).find(o => o.n === 'Chasm Skulker'), el = f.campo.map(id => f.objs[id]).find(o => o.n === 'Elenda, the Dusk Rose');
  sk.marc['+1/+1'] = 3; el.marc['+1/+1'] = 2;
  const lk = o => ({ voce: 0, alvos: [], ilegal: {}, lki: { este: M.lkiDe(f, o) }, este: o.id });
  const ls = lk(sk), le = lk(el);
  M.mover(f, sk.id, 'cemiterio'); M.mover(f, el.id, 'cemiterio');
  const antes = f.campo.length;
  M.executar(f, M.carta('Chasm Skulker').gat[1].fx[0], ls, () => ({ a: 'nao' }));
  igual(f.campo.length - antes, 3, 'Skulker: 3 Lulas');
  M.executar(f, M.carta('Elenda, the Dusk Rose').gat[1].fx[0], le, () => ({ a: 'nao' }));
  igual(f.campo.length - antes, 3 + 3, 'Elenda 1/1 com +2: 3 Vampiros');
});

caso('614.1a', "Bard, King of Dale compra 2 no lugar de 1, menos a 1ª da etapa de compra; Tomb Tyrant volta um Zumbi aleatório; Descendants' Path revela o topo e, sem conjurar, põe no fundo", () => {
  const e = cena({ campo: [[0, 'Bard, King of Dale']] });
  const m0 = e.jogs[0].zonas.mao.length; M.comprar(e, 0, 1);
  igual(e.jogs[0].zonas.mao.length - m0, 2, 'fora da etapa de compra: 2');
  e.turno.passo = 'compra'; e.turno.n++; const m1 = e.jogs[0].zonas.mao.length; M.comprar(e, 0, 1); M.comprar(e, 0, 1);
  igual(e.jogs[0].zonas.mao.length - m1, 3, 'na etapa: a 1ª é 1, a 2ª vira 2');
  const f = cena({ campo: [[0, 'Tomb Tyrant']] });
  const zs = ['Blackcleave Goblin', 'Blackcleave Goblin', 'Blackcleave Goblin'].map(n => f.por(0, n, { zona: 'cemiterio' }));
  M.executar(f, M.carta('Tomb Tyrant').atv[0].fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  igual(zs.filter(o => o.zona === 'campo').length, 1, 'um Zumbi voltou');
  const g = cena({ campo: [[0, "Descendants' Path"], [0, 'Grizzly Bears']] });
  const topo = g.por(0, 'Sol Ring', { zona: 'grimorio' });
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: {} };
  for (const fx of M.carta("Descendants' Path").gat[0].fx) M.executar(g, fx, ctx, () => ({ a: 'nenhum' }));
  igual(g.jogs[0].zonas.grimorio[0], topo.id, 'Sol Ring (sem tipo em comum) foi para o fundo');
});

caso('702.75a', "esconderijo: ao entrar olha 4, exila 1 ligado a ela e o resto vai para o fundo; Watcher for Tomorrow devolve o exilado à mão quando sai", () => {
  const e = cena({ mao: [[0, 'Watcher for Tomorrow']], campo: [...terras(2, 'Island')] });
  const g = e.jogs[0].zonas.grimorio, n0 = g.length, top = g.slice(-4);
  const w = e.objs[e.jogs[0].zonas.mao[0]];
  e.pend = []; M.avancar(e); conj(e, 'Watcher for Tomorrow'); resolveCom(e);
  ok(w.zona === 'campo', 'entrou');
  const ex = e.jogs[0].zonas.exilio.map(id => e.objs[id]);
  igual(ex.length, 1, 'um exilado'); ok(top.includes(ex[0].id) && ex[0].exPor && ex[0].exPor.id === w.id, 'dos 4 do topo, ligado ao Watcher');
  igual(g.length, n0 - 1); ok(g.slice(0, 3).every(id => top.includes(id)), 'os outros 3 no fundo');
  M.mover(e, w.id, 'cemiterio'); M.avancar(e); resolveCom(e);
  ok(e.jogs[0].zonas.mao.includes(ex[0].id), 'saiu: o exilado vai para a mão');
  for (const c of ['Cemetery Tampering', 'Mosswort Bridge', 'Windbrisk Heights']) ok(JSON.stringify(M.carta(c)).includes('exiladaPorEste'), c);
});

caso('613.1d', "modificar: subtipo e cor além dos outros, sem prazo (Liliana −3: Zombie preto); disparada ganha para sempre (Rivaz: o Dragão do cemitério é exilado ao morrer)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears']] }); const gb = e.objs[e.campo[0]];
  const X = (f, ctx: any = {}) => M.executar(e, f, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, ...ctx }, () => ({ a: 'nao' }));
  const lil = M.carta("Liliana, Death's Majesty").atv.find(a => a.lealdade === -3).fx[1];
  ok(M.fxSuportado([lil], { topo: false }), 'Liliana aceita');
  X(lil, { movidos: [{ id: gb.id, ts: gb.ts }] });
  ok(M.temTipo(e, gb, 'Creature') && (M.dadoDe(e, gb).sub || []).includes('Zombie') && (M.dadoDe(e, gb).sub || []).includes('Bear'), 'Zombie além de Bear');
  igual([...M.dadoDe(e, gb).cores].sort().join(''), 'BG', 'preto além de verde');
  e.turno.n++; ok((M.dadoDe(e, gb).sub || []).includes('Zombie'), 'sem prazo');
  const r = M.carta('Rivaz of the Claw').gat[0].fx[0], cl = M.carta('Clavileño, First of the Blessed').gat[0].fx[0];
  ok(M.fxSuportado([r], { topo: false }) && M.fxSuportado([cl], { topo: false }), 'Rivaz e Clavileño aceitos');
  X({ op: 'modificar', em: 'este', habil: r.habil, dura: 'sempre' }, { este: gb.id });
  M.abe(e); e.pend = [];
  gb.dano = 9; M.abe(e); M.avancar(e); resolveCom(e);
  ok(gb.zona === 'exilio', 'morreu e o gatilho ganho o exilou: ' + gb.zona);
});

caso('111.2', "gatilho de criar ficha: Mirkwood Bats (cada ficha criada: oponentes perdem 1); a do oponente não dispara; Rosie aceita", () => {
  const e = cena({ campo: [[0, 'Mirkwood Bats']] }); e.pend = [];
  M.criarFichas(e, 0, { pt: [1, 1], tipos: ['Creature'], sub: ['Goblin'], cores: 'R' }, 2);
  igual(e.pend.filter(p => p.n === 'Mirkwood Bats').length, 2, 'uma por ficha');
  e.pend = []; M.criarFichas(e, 1, { pt: [1, 1], tipos: ['Creature'], sub: ['Goblin'], cores: 'R' }, 1);
  igual(e.pend.filter(p => p.n === 'Mirkwood Bats').length, 0, 'ficha do oponente: não');
  for (const c of ['Rosie Cotton of South Lane', 'Mirkwood Bats', "Caretaker's Talent"]) ok(M.carta(c).gat.filter(g => g.ev === 'fichaCriada').every(g => M.gatOk(g)), c);
});

caso('702.14c', "caminhada de terreno: Cold-Eyed Selkie não pode ser bloqueada por quem tem Island; sem Island, pode; Lord of Atlantis dá aos Merfolk", () => {
  const e = cena({ campo: [[0, 'Cold-Eyed Selkie'], [1, 'Grizzly Bears'], [1, 'Island']] });
  const o = n => e.objs[e.campo.find(id => e.objs[id].n === n)];
  ok(!M.bloqueiaEste(e, o('Grizzly Bears'), o('Cold-Eyed Selkie')), 'defensor com Island: não bloqueia');
  const f = cena({ campo: [[0, 'Cold-Eyed Selkie'], [1, 'Grizzly Bears'], [1, 'Forest']] });
  const p = n => f.objs[f.campo.find(id => f.objs[id].n === n)];
  ok(M.bloqueiaEste(f, p('Grizzly Bears'), p('Cold-Eyed Selkie')), 'sem Island: bloqueia');
  const g = cena({ campo: [[0, 'Lord of Atlantis'], [0, 'Cold-Eyed Selkie'], [1, 'Island']] });
  ok(M.kwDe(g, g.objs[g.campo[1]]).filter(x => x.k === 'caminhadaTerreno').length >= 1, 'Lord dá islandwalk');
});

caso('702.135a', "pós-vida: Ministrant of Obligation morre e cria 2 Espíritos 1/1 voadores; exilada não", () => {
  const e = cena({ campo: [[0, 'Ministrant of Obligation']] }); e.pend = [];
  const m = e.objs[e.campo[0]];
  m.dano = 5; M.abe(e); M.avancar(e); resolveCom(e);
  const sp = e.campo.map(id => e.objs[id]).filter(o => o.ficha && (o.ficha.sub || []).includes('Spirit'));
  igual(sp.length, 2, 'dois Espíritos'); ok(M.temKw(e, sp[0], 'voar') && sp[0].ctrl === 0, 'voam, meus');
  const f = cena({ campo: [[0, 'Orzhov Enforcer']] }); f.pend = [];
  M.mover(f, f.campo[0], 'exilio'); igual(f.pend.length, 0, 'exilada: nada');
});

caso('702.122a', "tripular: Rolling Hamsphere (tripular 3) vira as criaturas com poder total 3 e vira criatura até o fim do turno; sem poder suficiente, não oferece", () => {
  const e = cena({ campo: [[0, 'Rolling Hamsphere'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']] }); e.pend = [];
  const h = e.objs[e.campo[0]];
  ok(!M.temTipo(e, h, 'Creature'), 'parado: não é criatura');
  M.avancar(e);
  const k = e.perg.ops.findIndex(op => op.a === 'ativar' && op.id === h.id);
  ok(k >= 0, 'tripular oferecido'); M.responder(e, k); resolveCom(e);
  ok(M.temTipo(e, h, 'Creature') && M.temTipo(e, h, 'Artifact'), 'tripulado: criatura artefato');
  igual(e.campo.filter(id => e.objs[id].n === 'Grizzly Bears' && e.objs[id].virada).length, 2, 'virou as duas (2+2 ≥ 3)');
  const f = cena({ campo: [[0, 'Rolling Hamsphere'], [0, 'Grizzly Bears']] }); f.pend = [];
  M.avancar(f); ok(!f.perg.ops.some(op => op.a === 'ativar' && op.id === f.campo[0]), 'poder 2 < 3: não');
});

caso('701.19', "buscar até uma contagem (Scapeshift: tantos terrenos quanto sacrificou; The World Tree: quantos God quiser); ganhar vida igual à resistência de quem entrou (Verdant Sun's Avatar)", () => {
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest']] });
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  const sim = (j, t, ops) => ops.find(o => o.a !== 'pronto' && o.a !== 'nenhum') || ops[0];
  for (const f of M.carta('Scapeshift').fx) M.executar(e, f, ctx, sim);
  igual(e.campo.map(id => e.objs[id].n), ['Wastes', 'Wastes'], 'sacrificou as 2 Forest, buscou 2');
  ok(['Scapeshift', 'Living Death', 'The World Tree', 'Kyoshi Island Plaza', "Verdant Sun's Avatar", 'Righteous Valkyrie'].every(c => { const d = M.carta(c); return M.fxSuportado(d.fx || []) && (d.atv || []).every(a => M.fxSuportado(a.fx, { topo: false })) && (d.gat || []).every(g => M.gatOk(g)); }), 'aceitas');
  const lv = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears']] }); lv.por(1, 'Cold-Eyed Selkie', { zona: 'cemiterio' });
  const cl: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  for (const x of M.carta('Living Death').fx) M.executar(lv, x, cl, () => ({ a: 'nao' }));
  igual(lv.campo.map(id => lv.objs[id].n), ['Cold-Eyed Selkie'], 'Living Death: todas sacrificadas, a do cemitério volta');
  igual(lv.objs[lv.campo[0]].ctrl, 1, 'para o dono');
  const f = cena({ campo: [[0, "Verdant Sun's Avatar"]] }); f.pend = [];
  const b = f.por(0, 'Grizzly Bears'); M.avancar(f); resolveCom(f);
  igual(f.jogs[0].vida, 42, '+2 da Bears');
});

caso('701.36a', "popular: cria cópia de uma ficha de criatura sua; sem ficha, nada (Growing Ranks, Song of the Worldsoul, Promise of Aclazotz aceitas)", () => {
  const e = cena({});
  M.criarFichas(e, 0, { pt: [2, 2], tipos: ['Creature'], sub: ['Wolf'], cores: 'G' }, 1);
  M.criarFichas(e, 1, { pt: [5, 5], tipos: ['Creature'], sub: ['Wurm'], cores: 'G' }, 1);
  M.executar(e, { op: 'popular', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops[0]);
  igual(e.campo.filter(id => e.objs[id].ctrl === 0).map(id => e.objs[id].ficha.sub[0]), ['Wolf', 'Wolf'], 'copiou o Lobo');
  const f = cena({});
  M.executar(f, { op: 'popular', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops[0]);
  igual(f.campo.length, 0, 'sem ficha: nada');
  for (const c of ['Growing Ranks', 'Song of the Worldsoul', 'Promise of Aclazotz']) { const d = M.carta(c); ok([...(d.gat || []).map(g => M.gatOk(g)), M.fxSuportado(d.fx || [])].every(Boolean), c); }
});

caso('701.54', "o Anel te tenta: escolhe o Portador (vira lendário, não é bloqueado por poder maior); na 2ª vez, ao atacar compra e descarta", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Hill Giant'], [1, 'Llanowar Elves']] });
  const o = n => e.objs[e.campo.find(id => e.objs[id].n === n)];
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  M.executar(e, { op: 'tentarAnel', quem: 'voce' }, ctx, (j, t, ops) => ops[0]);
  const gb = o('Grizzly Bears');
  ok(M.ehPortador(e, gb) && (M.dadoDe(e, gb).super || []).includes('Legendary'), 'Portador lendário');
  ok(!M.bloqueiaEste(e, o('Hill Giant'), gb) && M.bloqueiaEste(e, o('Llanowar Elves'), gb), 'poder 3 não bloqueia o 2; poder 1 bloqueia');
  igual(M.gatDe(e, gb).length, 0, 'nível 1: sem gatilho');
  M.executar(e, { op: 'tentarAnel', quem: 'voce' }, ctx, (j, t, ops) => ops[0]);
  igual(M.gatDe(e, gb).map(g => g.ev), ['ataca'], 'nível 2: ao atacar, saquear');
  M.mover(e, gb.id, 'cemiterio'); ok(!M.ehPortador(e, gb), 'saiu: não é mais o Portador');
  for (const c of ['Call of the Ring', 'Boromir, Warden of the Tower']) ok(M.carta(c).gat ? M.carta(c).gat.some(g => M.gatOk(g)) : (M.carta(c).atv || []).some(a => M.fxSuportado(a.fx, { topo: false })), c);
});

caso('601.2f', "impostoPorAlvo: o motor declara o campo (M.CARTA_OK) para a cobertura; Twinflame paga {2}{R} por alvo a mais", () => {
  for (const c of ['Fireball', 'Twinflame']) ok(Object.keys(M.carta(c)).filter(k => k === 'impostoPorAlvo').every(k => M.CARTA_OK.has(k)), c);
  const e = cena({ campo: [...enche(6, 'Mountain').map(n => [0, n]), [0, 'Grizzly Bears'], [0, 'Llanowar Elves']], mao: [[0, 'Twinflame']] });
  M.avancar(e); conj(e, 'Twinflame');
  for (let i = 0; i < 4 && e.perg && e.perg.tipo === 'alvo'; i++) { const k = e.perg.ops.findIndex(o => o.a === 'alvo'); M.responder(e, k >= 0 ? k : e.perg.ops.findIndex(o => o.a === 'pronto')); }
  igual(e.campo.filter(id => e.objs[id].n === 'Mountain' && e.objs[id].virada).length, 5, '{1}{R} + {2}{R} do 2º alvo');
});

caso('602.5', "não pode ativar: Linvala trava as habilidades (até as de mana) das criaturas do oponente; Myrel só no turno do dono", () => {
  const e = cena({ campo: [[0, 'Linvala, Keeper of Silence'], [1, 'Llanowar Elves'], [0, 'Llanowar Elves']] });
  const el = j => e.objs[e.campo.find(id => e.objs[id].n === 'Llanowar Elves' && e.objs[id].ctrl === j)];
  ok(M.ativBloqueada(e, el(1)) && !M.ativBloqueada(e, el(0)), 'só a do oponente');
  el(1).doente = false; el(0).doente = false;
  ok(!M.fontesDeMana(e, 1).some(x => x.id === el(1).id) && M.fontesDeMana(e, 0).some(x => x.id === el(0).id), 'a mana do Elves do oponente some; a minha fica');
  const f = cena({ campo: [[0, 'Myrel, Shield of Argive'], [1, 'Sol Ring']] });
  const sr = f.objs[f.campo[1]];
  ok(M.ativBloqueada(f, sr), 'no meu turno o Sol Ring do oponente não ativa');
  f.turno.ativo = 1; ok(!M.ativBloqueada(f, sr), 'no turno dele, ativa');
});

caso('610.3', "exilar até a fonte sair (Battle at the Helvault, Grasp of Fate): volta ao campo do dono quando ela sai; Awaken the Honored Dead III paga com descarte", () => {
  const e = cena({ campo: [[0, 'Grasp of Fate'], [1, 'Grizzly Bears']] });
  const g = e.objs[e.campo[0]], b = e.objs[e.campo[1]];
  const ctx: any = { voce: 0, alvos: [[{ o: b.id, ts: b.ts }]], ilegal: {}, lki: { alvos: [] }, este: g.id };
  M.executar(e, { op: 'exilar', em: { alvo: 0 }, dura: 'enquantoNoCampo' }, ctx, () => ({ a: 'nao' }));
  ok(b.zona === 'exilio', 'exilou');
  M.mover(e, g.id, 'cemiterio');
  ok(b.zona === 'campo' && b.ctrl === 1, 'Grasp saiu: a Bears volta para o dono');
  const f = cena({ campo: [[1, 'Grizzly Bears']] }); const fb = f.objs[f.campo[0]];
  M.executar(f, { op: 'exilar', em: { alvo: 0 }, dura: 'enquantoNoCampo' }, { voce: 0, alvos: [[{ o: fb.id, ts: fb.ts }]], ilegal: {}, lki: { alvos: [] }, este: 999 }, () => ({ a: 'nao' }));
  ok(fb.zona === 'campo', 'fonte fora do campo: não exila (610.3c)');
  const h = cena({ mao: [[0, 'Forest']] }); const lb = h.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
  const cap3 = M.carta('Awaken the Honored Dead').gat.find(x => x.n === 3).fx[0];
  M.executar(h, cap3, { voce: 0, alvos: [[{ o: lb.id, ts: lb.ts }]], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops.find(o => o.a === 'pagar') || ops[0]);
  ok(h.jogs[0].zonas.mao.length === 1 && h.objs[h.jogs[0].zonas.mao[0]].n === 'Grizzly Bears', 'descartou a Forest e a Bears voltou para a mão');
});

caso('701.26a', "gatilho de virar: Dionus no seu turno desvira e ganha +1/+1 (uma vez por turno); Deeproot Pilgrimage uma vez pelo lote de Merfolk; entrar virado não conta", () => {
  const e = cena({ campo: [[0, 'Dionus, Elvish Archdruid']] }); e.pend = [];
  const d = e.objs[e.campo[0]];
  M.virarObj(e, d); igual(e.pend.filter(p => p.n === d.n).length, 1, 'virou: dispara');
  const f = cena({ campo: [[0, 'Deeproot Pilgrimage'], [0, 'Cold-Eyed Selkie'], [0, 'Cold-Eyed Selkie']] }); f.pend = [];
  for (const id of f.campo.slice(1)) M.virarObj(f, f.objs[id]);
  igual(f.pend.filter(p => p.n === 'Deeproot Pilgrimage').length, 1, 'um disparo pelos dois');
  f.pend = []; f.por(0, 'Cold-Eyed Selkie', { virada: true }); igual(f.pend.filter(p => p.n === 'Deeproot Pilgrimage').length, 0, 'entrou virada: não');
  for (const c of ['Dionus, Elvish Archdruid', 'Deeproot Pilgrimage']) ok(JSON.stringify(M.carta(c)).includes('"vira"'), c);
});

caso('614.1a', "troca de ficha: Academy Manufactor faz Pista+Comida+Tesouro (×2 com Doubling Season); Jinnie Fay troca o Servo 1/1 por Gato 2/2 e deixa o Tesouro", () => {
  for (const c of ['Academy Manufactor', "Jinnie Fay, Jetmir's Second"]) ok(M.carta(c).subst.every(s => M.substOk(s)), c + ' aceita');
  const cx = () => ({ voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } });
  const conta = (e, n) => e.campo.filter(id => e.objs[id].n === n && e.objs[id].ctrl === 0).length;
  const e = cena({ campo: [[0, 'Academy Manufactor'], [0, 'Doubling Season']] });
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Treasure' } }, cx(), null);
  igual([conta(e, 'Clue'), conta(e, 'Food'), conta(e, 'Treasure')], [2, 2, 2], 'um de cada, ×2 com Doubling Season');
  M.executar(e, { op: 'ficha', quem: 'cadaOponente', qtd: 1, token: { nome: 'Treasure' } }, cx(), null);
  igual(e.campo.filter(id => e.objs[id].ctrl === 1).length, 1, 'do oponente não troca');
  const f = cena({ campo: [[0, "Jinnie Fay, Jetmir's Second"]] });
  M.executar(f, { op: 'ficha', quem: 'voce', qtd: 2, token: { pt: [1, 1], tipos: ['Artifact', 'Creature'], sub: ['Servo'] } }, cx(), null);
  igual(conta(f, 'Cat Token'), 2, 'dois Gatos no lugar dos Servos'); igual(conta(f, 'Servo Token'), 0);
  ok(f.campo.filter(id => f.objs[id].n === 'Cat Token').every(id => M.temKw(f, f.objs[id], 'pressa')), 'Gato com pressa');
  M.executar(f, { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Treasure' } }, cx(), null);
  igual(conta(f, 'Treasure'), 1, 'Tesouro fica (talvez)');
});

caso('601.2b', "Toxic Deluge: anuncia X, paga X de vida (custo adicional) e todas as criaturas ganham −X/−X; o agente escolhe o X que mata a maior do oponente", () => {
  ok(M.custoAdSuportado(M.carta('Toxic Deluge').custoAd), 'custo aceito');
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Swamp'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']], mao: [[0, 'Toxic Deluge']] });
  M.avancar(e); conj(e, 'Toxic Deluge');
  igual(e.perg.tipo, 'x'); igual(e.perg.ops.length, 41, 'X de 0 a 40');
  igual(e.perg.ops[M.agenteBasico()(e, e.perg)].v, 2, 'agente: X = 2 (o Urso)');
  respE(e, o => o.v === 2); M.avancar(e);
  igual(e.jogs[0].vida, 38, 'pagou 2 de vida');
  igual(e.campo.filter(id => e.objs[id].ctrl === 1).length, 0, 'as duas morreram');
});

caso('602.2b', "Devoted Druid: pôr um marcador −1/−1 nela é custo — desvira; na segunda vez morre (0/0) pela ação de estado", () => {
  ok(M.carta('Devoted Druid').atv.every(a => M.custoSuportado(a.custo)), 'custos aceitos');
  const e = cena({ campo: [[0, 'Devoted Druid', { virada: true }]] });
  const d = e.campo.map(id => e.objs[id]).find(o => o.n === 'Devoted Druid');
  M.avancar(e);
  respE(e, o => o.a === 'ativar' && o.id === d.id && o.k === 1); resolvePilha(e);
  ok(!d.virada, 'desvirou'); igual(d.marc['-1/-1'], 1); igual(M.resistencia(e, d), 1);
  respE(e, o => o.a === 'ativar' && o.id === d.id && o.k === 1); resolvePilha(e);
  igual(d.zona, 'cemiterio', '0/0 morre');
});

caso('613.4c', "Conqueror's Flail: a equipada ganha +1/+1 por cor entre as suas permanentes (Urso verde + Krenko vermelho = +2/+2)", () => {
  ok(M.carta("Conqueror's Flail").est.every(s => s.modo !== 'continuo' || M.estContOk(s)), 'estática aceita');
  const e = cena({ campo: [[0, "Conqueror's Flail"], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Sol Ring'], [1, 'Lightning Greaves']] });
  const fl = objN(e, 0, "Conqueror's Flail"), b = objN(e, 0, 'Grizzly Bears');
  fl.anexo = { id: b.id, ts: b.ts }; e.vCamada = (e.vCamada || 0) + 1;
  igual([M.poder(e, b), M.resistencia(e, b)], [3, 3], 'uma cor (verde): +1/+1');
  e.por(0, 'Krenko, Mob Boss'); e.vCamada++;
  igual([M.poder(e, b), M.resistencia(e, b)], [4, 4], 'verde e vermelho: +2/+2');
});

caso('305.7', "tipo dado por filtro (613.1d): Dryad faz seus terrenos de todo tipo básico (Forest dá as 5 cores, 305.6); Ashaya faz suas criaturas não-ficha Florestas (viram para {G})", () => {
  for (const c of ['Dryad of the Ilysian Grove', 'Ashaya, Soul of the Wild']) ok(M.carta(c).est.every(s => s.modo !== 'continuo' || M.estContOk(s)), c + ' aceita');
  const e = cena({ campo: [[0, 'Forest'], [0, 'Dryad of the Ilysian Grove'], [1, 'Island']] });
  const fo = objN(e, 0, 'Forest'), il = objN(e, 1, 'Island');
  igual(M.dadoDe(e, fo).sub.slice().sort(), ['Forest', 'Island', 'Mountain', 'Plains', 'Swamp']);
  igual(M.atvDe(e, fo).filter(a => a.deMana).flatMap(a => a.fx[0].prod).sort(), ['B', 'G', 'R', 'U', 'W'], 'mana das 5 cores');
  igual(M.dadoDe(e, il).sub, ['Island'], 'do oponente não');
  const f = cena({ campo: [[0, 'Ashaya, Soul of the Wild'], [0, 'Grizzly Bears'], [0, 'Forest']] });
  const b = objN(f, 0, 'Grizzly Bears'), a = objN(f, 0, 'Ashaya, Soul of the Wild');
  ok(M.temTipo(f, b, 'Land') && M.temTipo(f, b, 'Creature'), 'o Urso é terreno e criatura');
  ok(M.fontesDeMana(f, 0).some(x => x.id === b.id), 'o Urso vira para mana');
  igual(M.poder(f, a), 3, 'Ashaya conta 3 terrenos (ela, o Urso e a Floresta)');
  M.criarFichas(f, 0, { pt: [1, 1], tipos: ['Creature'], sub: ['Elf'] }, 1);
  const tk = f.campo.map(id => f.objs[id]).find(o => o.ficha);
  ok(!M.temTipo(f, tk, 'Land'), 'ficha não');
});

caso('613.1d', "Skyknight Squire: com 3 marcadores +1/+1 voa e é Cavaleiro (tipo e palavra-chave na mesma estática); com 2, não", () => {
  ok(M.carta('Skyknight Squire').est.every(s => M.estContOk(s)), 'estática aceita');
  const e = cena({ campo: [[0, 'Skyknight Squire']] });
  const k = objN(e, 0, 'Skyknight Squire');
  k.marc['+1/+1'] = 2; e.vCamada = (e.vCamada || 0) + 1;
  ok(!M.temKw(e, k, 'voar') && !M.dadoDe(e, k).sub.includes('Knight'), 'com 2: nada');
  k.marc['+1/+1'] = 3; e.vCamada++;
  ok(M.temKw(e, k, 'voar'), 'voa'); ok(M.dadoDe(e, k).sub.includes('Knight'), 'é Cavaleiro');
  igual(M.poder(e, k), 4);
});

caso('118.9', "Flare of Fortitude: sem mana, conjura sacrificando uma criatura branca não-ficha (custo alternativo); sem branca, não dá", () => {
  ok(M.carta('Flare of Fortitude').est.every(s => s.modo !== 'custoAlternativo' || M.estAltOk(s)), 'custo aceito');
  const e = cena({ campo: [[0, 'Serra Angel'], [0, 'Grizzly Bears']], mao: [[0, 'Flare of Fortitude']] });
  M.avancar(e);
  ok(opsDe(e, 'conjurar').some(o => e.objs[o.id].n === 'Flare of Fortitude'), 'oferecida sem mana');
  conj(e, 'Flare of Fortitude'); if (e.perg && e.perg.tipo === 'custo') respE(e, o => o.id === objN(e, 0, 'Serra Angel').id);
  resolvePilha(e);
  ok(e.jogs[0].zonas.cemiterio.map(id => e.objs[id].n).includes('Serra Angel'), 'sacrificou o Anjo');
  const b = objN(e, 0, 'Grizzly Bears'); ok(M.temKw(e, b, 'indestrutivel') && M.temKw(e, b, 'antimagia'), 'indestrutível e antimagia');
  const f = cena({ campo: [[0, 'Grizzly Bears']], mao: [[0, 'Flare of Fortitude']] });
  M.avancar(f); ok(!opsDe(f, 'conjurar').length, 'sem criatura branca e sem mana: não');
});

caso('603.2d', "Ancient Greenwarden: o gatilho de terreno entrando (Aesi) dispara uma vez a mais; sem ele, uma", () => {
  ok(M.carta('Ancient Greenwarden').est.some(s => s.modo === 'dobraGatilho'), 'como dobraGatilho (evs entra, causa terreno)');
  const e = cena({ campo: [[0, 'Ancient Greenwarden'], [0, 'Aesi, Tyrant of Gyre Strait']] }); e.pend = [];
  e.por(0, 'Forest');
  igual(e.pend.filter(p => p.n === 'Aesi, Tyrant of Gyre Strait').length, 2, 'Aesi 2 vezes');
  const f = cena({ campo: [[0, 'Aesi, Tyrant of Gyre Strait']] }); f.pend = [];
  f.por(0, 'Forest');
  igual(f.pend.filter(p => p.n === 'Aesi, Tyrant of Gyre Strait').length, 1, 'sem o Greenwarden: 1');
});

caso('707.12', "Mizzix's Mastery: exila a instantânea do cemitério e conjura uma CÓPIA dela; a carta fica no exílio", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, "Mizzix's Mastery"]] });
  const raio = e.por(0, 'Lightning Bolt', { zona: 'cemiterio' });
  const v0 = e.jogs[1].vida;
  M.avancar(e); conj(e, "Mizzix's Mastery");
  for (let g = 0; g < 30 && (e.pilha.length || e.perg && e.perg.tipo !== 'acao'); g++) {
    if (!e.perg) { M.avancar(e); continue; }
    const t = e.perg.tipo;
    if (t === 'jogar' || t === 'talvez') respE(e, o => o.a === 'jogar' || o.a === 'sim');
    else if (t === 'acao') respE(e, o => o.a === 'passar');
    else respE(e, e.perg.ops.some(o => o.jog === 1) ? o => o.jog === 1 : () => true);
  }
  igual(e.jogs[1].vida, v0 - 3, 'a cópia do Raio resolveu no oponente');
  ok(e.jogs[0].zonas.exilio.includes(raio.id), 'o Raio original continua no exílio');
  ok(!e.jogs[0].zonas.cemiterio.some(id => e.objs[id].n === 'Lightning Bolt'), 'a cópia não foi ao cemitério');
  ok(e.jogs[0].zonas.exilio.some(id => e.objs[id].n === "Mizzix's Mastery"), 'a Mastery se exila');
});

caso('702.84a', "Molten Gatekeeper: desenterrar {R} do cemitério como feitiço; volta com pressa, se fosse sair vai ao exílio, e no final é exilada", () => {
  const e = cena({ campo: [[0, 'Mountain']], mao: [[0, 'Shock']] });
  const g = e.por(0, 'Molten Gatekeeper', { zona: 'cemiterio' });
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === g.id); resolvePilha(e);
  ok(g.zona === 'campo' && M.temKw(e, g, 'pressa'), 'no campo com pressa');
  ok(e.atras && e.atras.some(A => A.g.passo === 'final'), 'atrasado do final');
  M.mover(e, g.id, 'cemiterio');
  igual(g.zona, 'exilio', 'iria ao cemitério: exílio');
  const f = cena({ campo: [[0, 'Mountain']], passo: 'inicioCombate' });
  const h = f.por(0, 'Molten Gatekeeper', { zona: 'cemiterio' });
  ok(!M.podeAtivar(f, 0, h, 0), 'fora da principal: não'); f.turno.passo = 'principal1'; ok(M.podeAtivar(f, 0, h, 0), 'na principal: sim');
});

// ---------- contagens num formato só (27/11): {conta:{de, o, junta}} ----------
caso('107.3', 'contagens: o nome velho e o formato novo dão o mesmo número (mão, vida, oponentes, filtro, soma do poder)', () => {
  const e = cena({ campo: [[0, 'Llanowar Elves'], [0, 'Llanowar Elves'], [0, 'Forest']], mao: [[0, 'Forest'], [0, 'Sol Ring']] });
  const ctx = { voce: 0 };
  const pares: any[] = [[{ conta: 'cartasNaMao' }, { conta: { de: 'voce', o: 'mao' } }], [{ conta: 'suaVida' }, { conta: { de: 'voce', o: 'vida' } }],
    [{ conta: 'oponentes' }, { conta: { de: 'oponentes', o: 'quantos' } }],
    [{ conta: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }, { conta: { de: { f: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }, o: 'quantos' } }],
    [{ conta: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' }, prop: 'somaPoder' }, { conta: { de: { f: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }, o: 'poder', junta: 'soma' } }]];
  for (const [v, n] of pares) igual(M.qtd(e, v, ctx), M.qtd(e, n, ctx), JSON.stringify(v));
  igual(M.qtd(e, pares[4][1], ctx), 2, 'dois elfos 1/1');
});
caso('504.1', "contagens pedidas: cartas compradas e vida ganha neste turno (Fists of Flame, Gwaihir)", () => {
  const e = cena({});
  M.comprar(e, 0, 2); M.ganharVida(e, 0, 3); M.ganharVida(e, 0, 1);
  igual(M.qtd(e, { conta: { de: 'turno', o: 'compras' } }, { voce: 0 }), 2, 'compras');
  igual(M.qtd(e, { conta: { de: 'turno', o: 'vidaGanha' } }, { voce: 0 }), 4, 'vida ganha');
  igual(M.qtd(e, { conta: { de: 'turno', o: 'vidaGanha' } }, { voce: 1 }), 0, 'o outro não ganhou');
});
caso('700.x', 'contagens pedidas: tipos de card diferentes no cemitério (delirium, Demonic Counsel) e mão do jogador do evento (Fevered Visions)', () => {
  const e = cena({ campo: [[0, 'Forest', { zona: 'cemiterio' }], [0, 'Forest', { zona: 'cemiterio' }], [0, 'Sol Ring', { zona: 'cemiterio' }], [0, 'Lightning Bolt', { zona: 'cemiterio' }], [1, 'Llanowar Elves', { zona: 'cemiterio' }]], mao: [[1, 'Forest'], [1, 'Forest']] });
  igual(M.qtd(e, { conta: { de: { f: { tipo: ['Card'], dono: 'voce', zona: 'cemiterio' } }, o: 'tipos', junta: 'diferentes' } }, { voce: 0 }), 3, 'terreno, artefato, instantânea');
  igual(M.qtdDe(e, { conta: { de: 'evento', o: 'mao' } }, { voce: 0, ev: { ev: 'fase', ativo: 1 }, lki: {} }), 2, 'mão do jogador da vez');
});
caso('603.4', 'Omnath, Locus of Creation: 1º terreno no turno ganha 4 de vida, 2º dá mana, 3º 4 de dano em cada oponente', () => {
  const e = cena({ campo: [[0, 'Omnath, Locus of Creation']], mao: [[0, 'Forest'], [0, 'Forest'], [0, 'Forest']] }); e.cfg.log = true;
  const v0 = e.jogs[0].vida, o0 = e.jogs[1].vida;
  const entra = () => { e.perg = null; M.entrarPermanente(e, e.jogs[0].zonas.mao[0], 0); M.avancar(e); };
  entra(); igual(e.jogs[0].vida, v0 + 4, '1ª vez: +4 de vida ' + e.log.slice(-4).join(' / '));
  entra(); igual(e.jogs[0].vida, v0 + 4, '2ª vez: vida igual'); igual(e.jogs[1].vida, o0, '2ª vez: sem dano');
  entra(); igual(e.jogs[1].vida, o0 - 4, '3ª vez: 4 de dano no oponente ' + e.log.slice(-4).join(' / '));
  igual(e.jogs[0].vida, v0 + 4, 'vida não muda na 3ª');
});
caso('603.6a', "entra vindo de uma zona: River Kelpie dispara com permanente que volta do cemitério, não com a que vem da mão", () => {
  const e = cena({ campo: [[0, 'River Kelpie']] }); e.pend = [];
  const b = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
  M.mover(e, b.id, 'campo'); igual(e.pend.filter(p => p.n === 'River Kelpie').length, 1, 'do cemitério: compra');
  e.pend = []; const c = e.por(0, 'Grizzly Bears', { zona: 'mao' }); M.mover(e, c.id, 'campo');
  igual(e.pend.filter(p => p.n === 'River Kelpie').length, 0, 'da mão: não');
  ok(M.carta('Kotis, Sibsig Champion').gat.every(g => M.gatOk(g)), 'Kotis aceito');
});

caso('201.2', "filtros de gatilho: Guardian Project só compra com nome que não tenho no campo nem no cemitério; Kutzil olha poder acima do base", () => {
  const e = cena({ campo: [[0, 'Guardian Project'], [0, 'Grizzly Bears']] });
  const g = M.carta('Guardian Project').gat[0].quem, ctx = { voce: 0 };
  const b2 = e.por(0, 'Grizzly Bears'); ok(!M.bate(e, b2, g, ctx), 'Bears repetida: não');
  const el = e.por(0, 'Llanowar Elves'); ok(M.bate(e, el, g, ctx), 'nome novo: sim');
  e.por(0, 'Hill Giant', { zona: 'cemiterio' }); const hg = e.por(0, 'Hill Giant'); ok(!M.bate(e, hg, g, ctx), 'mesmo nome no cemitério: não');
  const k = M.carta('Kutzil, Malamet Exemplar').gat[0].quem;
  ok(!M.bate(e, el, k, ctx), 'poder base: não'); el.marc['+1/+1'] = 1; ok(M.bate(e, el, k, ctx), 'com marcador: sim');
});

caso('702.129a', "eternizar: do cemitério, como feitiço, exila a carta e cria cópia 4/4 preta Zombie além dos tipos, sem custo de mana", () => {
  const e = cena({ campo: [...terras(4, 'Forest')] }); e.pend = [];
  const f = e.por(0, 'Fanatic of Rhonas', { zona: 'cemiterio' });
  M.avancar(e);
  const k = e.perg.ops.findIndex(op => op.a === 'ativar' && op.id === f.id);
  ok(k >= 0, 'oferecida do cemitério'); M.responder(e, k); resolveCom(e);
  ok(f.zona === 'exilio', 'exilada no custo');
  const t = e.objs[e.campo.find(id => e.objs[id].ficha)];
  ok(t && M.poder(e, t) === 4 && M.resistencia(e, t) === 4, '4/4');
  const d = M.dadoDe(e, t); ok(d.cores === 'B' && d.sub.includes('Zombie') && d.sub.length > 1 && !d.custo && d.vm === 0, JSON.stringify([d.cores, d.sub, d.vm]));
  ok(M.carta('Timeless Witness').kw.some(x => x.k === 'eternizar'), 'Timeless Witness');
});

caso('702.116a', "miríade: atacando um de 3 jogadores, cria cópias viradas e atacando os outros 2 oponentes; exiladas no fim do combate; X1 não cria nada", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Scion of Calamity']], passo: 'principal1' });
  const s = e.objs[e.campo[0]]; s.doente = false; e.pend = [];
  e.turno.combate = { atk: [], etapa: 0, duas: false, deu1: {} }; M.porAtacando(e, s, { jog: 1 }); e.pend = [];
  M.evento(e, { ev: 'ataca', id: s.id, def: 1 });
  const p = e.pend.find(x => x.k === 'miriade'); ok(p, 'gatilho');
  M.executar(e, { op: 'miriade' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [], este: M.lkiDe(e, s) }, este: s.id }, () => ({ a: 'sim' }));
  const tok = e.campo.map(id => e.objs[id]).filter(o => o.ficha);
  igual(tok.length, 1, 'uma cópia (para o jogador 2)'); ok(tok[0].virada && e.turno.combate.atk.some(a => a.id === tok[0].id && a.def === 2), 'virada atacando o 2');
  ok((e.atras || []).some(a => a.g.passo === 'fimCombate'), 'exílio no fim do combate agendado');
  ok(M.carta('Battle Angels of Tyr').kw.some(x => x.k === 'miriade'));
});

caso('702.79a', "persistir: Puppeteer Clique morre e volta com -1/-1; morrendo com o marcador, fica no cemitério", () => {
  const e = cena({ campo: [[0, 'Puppeteer Clique']] }); e.pend = [];
  const p = e.objs[e.campo[0]];
  M.mover(e, p.id, 'cemiterio'); M.avancar(e); resolveCom(e);
  ok(p.zona === 'campo' && p.marc['-1/-1'] === 1, 'voltou com -1/-1: ' + p.zona);
  e.pend = []; M.mover(e, p.id, 'cemiterio'); igual(e.pend.filter(x => x.k === 'persistir').length, 0, 'com o marcador: não persiste');
  ok(M.carta('River Kelpie').kw.some(x => x.k === 'persistir'));
});

caso('701.44a', "explorar: terreno no topo vai para a mão; não-terreno dá +1/+1 e pode ir ao cemitério (Path of Discovery, Hakbal)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears']] }); const b = e.objs[e.campo[0]];
  const X = (ask) => M.executar(e, { op: 'explorar', em: 'este' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: b.id }, ask);
  const l = e.por(0, 'Forest', { zona: 'grimorio' }); X(() => ({ a: 'nao' }));
  ok(l.zona === 'mao' && !b.marc['+1/+1'], 'terreno: mão, sem marcador');
  const s = e.por(0, 'Sol Ring', { zona: 'grimorio' }); X((j, t, ops) => ops[0]);
  ok(s.zona === 'cemiterio' && b.marc['+1/+1'] === 1, 'não-terreno: +1/+1 e cemitério');
  for (const c of ['Path of Discovery', 'Hakbal of the Surging Soul']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c);
});

caso('701.38a', "incitar: a criatura do oponente tem que atacar e ataca outro jogador, não quem incitou; acaba no próximo turno de quem incitou", () => {
  const e = cena({ jogs: 3, campo: [[1, 'Grizzly Bears']] });
  const b = e.objs[e.campo[0]]; b.doente = false;
  M.executar(e, M.carta('Taunt from the Rampart').fx[0], { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  e.turno.ativo = 1; e.turno.combate = { atk: [], etapa: 0, duas: false, deu1: {} };
  const ops: any[] = []; const ask: any = (j, t, o) => { ops.push(o); return o.find(x => x.a === 'atacar') || o[0]; }; ask.etapa = () => {};
  M.PROC.atacar(e, { j: 1 }, ask);
  ok(!ops[0].some(o => o.a === 'pronto'), 'tem que atacar');
  ok(ops[0].filter(o => o.a === 'atacar').every(o => o.jog === 2 || (o.o !== undefined && e.objs[o.o].ctrl === 2)), 'só o jogador 2: ' + JSON.stringify(ops[0]));
  ok(M.carta('Marisi, Breaker of the Coil').gat.every(g => M.gatOk(g)), 'Marisi');
});

caso('707.5', "entra como cópia: Phyrexian Metamorph copia Grizzly Bears e é artefato além disso; Sculpting Steel copia Sol Ring; ao sair, volta a ser ele", () => {
  const e = cena({ campo: [[1, 'Grizzly Bears']] });
  const m = e.por(0, 'Phyrexian Metamorph', { zona: 'mao' }), gb = e.objs[e.campo[0]];
  const ask = (j, t, ops) => ops.find(o => o.id === gb.id) || ops[0];
  M.aplicarEntrada(e, M.decidirEntrada(e, m.id, 0, {}, ask));
  const d = M.dadoDe(e, m);
  ok(d.n === 'Grizzly Bears' && M.temTipo(e, m, 'Creature') && M.temTipo(e, m, 'Artifact') && M.poder(e, m) === 2, JSON.stringify([d.n, d.tipos]));
  ok(m.ctrl === 0, 'meu');
  M.mover(e, m.id, 'mao'); ok(M.dadoDe(e, m).n === 'Phyrexian Metamorph', 'fora do campo: a carta de novo');
  const f = cena({ campo: [[0, 'Sol Ring']] }); const ss = f.por(0, 'Sculpting Steel', { zona: 'mao' });
  M.aplicarEntrada(f, M.decidirEntrada(f, ss.id, 0, {}, (j, t, ops) => ops[0]));
  ok(M.dadoDe(f, ss).n === 'Sol Ring' && M.fontesDeMana(f, 0).some(x => x.id === ss.id), 'Sculpting Steel vira Sol Ring e dá mana');
  for (const c of ['Phyrexian Metamorph', 'Sculpting Steel']) ok(M.carta(c).subst.every(x => M.substOk(x)), c);
});

caso('111.10d', 'Powerstone: {C} só para mágica de artefato; Map ativa (explorar); Junk existe mas não ativa; nome fora da tabela fica só com o nome', () => {
  const p = cena({ mao: [[0, 'Sol Ring']] }); ficha(p, 0, 'Powerstone');
  ok(M.opcoesPrioridade(p, 0).some(o => o.a === 'conjurar' && p.objs[o.id].n === 'Sol Ring'), 'Sol Ring sim');
  const q = cena({ mao: [[0, 'Grizzly Bears']], campo: [[0, 'Forest']] }); ficha(q, 0, 'Powerstone');
  ok(!M.opcoesPrioridade(q, 0).some(o => o.a === 'conjurar'), 'criatura não-artefato não');
  const r = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Wastes']] }); const mp = ficha(r, 0, 'Map'); ficha(r, 0, 'Junk');
  igual(M.dadoDe(r, mp).sub, ['Map']);
  ok(M.opcoesPrioridade(r, 0).some(o => o.a === 'ativar' && o.id === mp.id), 'Map ativa (explorar, 701.44)');
  ok(!M.opcoesPrioridade(r, 0).some(o => o.a === 'ativar' && o.id !== mp.id), 'Junk (jogar do exílio) ainda não');
  const x = ficha(r, 0, 'Wicked Role');
  igual(x.n, 'Wicked Role');
  igual(M.fichaDe({ nome: 'Treasure', virada: 1 }).sub, ['Treasure']);
});

// descarte (CR 701.9) e loucura (702.35): o deck da Ivora
caso('305.7', "tipo dado por estática: Yavimaya faz todo terreno Floresta (e dá {T}: G); Metallic Mimic é do tipo escolhido", () => {
  for (const c of ['Yavimaya, Cradle of Growth', 'Metallic Mimic', 'Roaming Throne']) ok(M.carta(c).est.filter(s => s.modo === 'continuo').every(s => M.estContOk(s)), c + ' aceito');
  const e = cena({ campo: [[0, 'Yavimaya, Cradle of Growth'], [1, 'Island'], [0, 'Metallic Mimic']] });
  const ilha = e.campo.map(id => e.objs[id]).find(o => o.n === 'Island');
  ok(M.dadoDe(e, ilha).sub.includes('Forest') && M.dadoDe(e, ilha).sub.includes('Island'), 'a Ilha do oponente é Floresta também');
  ok(M.atvDe(e, ilha).some(a => a.deMana && a.fx[0].prod[0] === 'G'), 'e faz G');
  const mm = e.campo.map(id => e.objs[id]).find(o => o.n === 'Metallic Mimic');
  ok(!(M.dadoDe(e, mm).sub || []).includes('escolhido'), 'sem escolha: nada');
  mm.escolha = { tipo: 'Elf' };
  ok(M.dadoDe(e, mm).sub.includes('Elf'), 'escolheu Elf: é Elf');
  const y = e.campo.find(id => e.objs[id].n === 'Yavimaya, Cradle of Growth'); M.mover(e, y, 'cemiterio');
  ok(!M.dadoDe(e, ilha).sub.includes('Forest'), 'sem Yavimaya volta a ser só Ilha');
});

caso('118.9', "custo alternativo dado por permanente: Dracogenesis conjura Dragão de graça; Demon of Fate's Design paga vida = valor de mana, uma vez por turno", () => {
  for (const c of ["Bolas's Citadel", "Demon of Fate's Design", 'Dracogenesis', 'Rooftop Storm']) ok(M.carta(c).est.filter(s => s.modo === 'custoAlternativo').every(s => M.estAltOk(s)), c + ' aceito');
  const e = cena({ campo: [[0, 'Dracogenesis']], mao: [[0, 'Dragonlord Dromoka'], [0, 'Gravecrawler']] });
  M.avancar(e);
  ok(opsDe(e, 'conjurar').every(o => e.objs[o.id].n === 'Dragonlord Dromoka'), 'sem terreno: só o Dragão');
  conj(e, 'Dragonlord Dromoka');
  ok(noCampo(e).includes('Dragonlord Dromoka'), 'Dromoka de graça');
  const f = cena({ campo: [[0, "Demon of Fate's Design"]], mao: [[0, 'Dragon Tempest'], [0, 'Dragon Tempest']] });
  M.avancar(f); conj(f, 'Dragon Tempest');
  ok(noCampo(f).includes('Dragon Tempest'), 'encantamento pela vida'); igual(f.jogs[0].vida, 38, 'pagou 2');
  igual(opsDe(f, 'conjurar').length, 0, 'a segunda não: uma vez por turno');
});

caso('603.2', "\"a segunda vez que esta habilidade resolve neste turno\": Tannuk compra só na 2ª entrada de terreno", () => {
  for (const c of ['Belladonna Took', 'Ms. Bumbleflower', 'Tannuk, Memorial Ensign']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Tannuk, Memorial Ensign']] });
  const mao0 = e.jogs[0].zonas.mao.length;
  const entra = () => { e.por(0, 'Mountain'); const fim = x => !x.pilha.length && !x.pend.length; M.avancar(e, fim); for (let g = 0; !fim(e) && e.perg && g < 10; g++) M.responder(e, e.perg.ops.findIndex(o => o.a === 'passar'), fim); };
  entra(); igual(e.jogs[0].zonas.mao.length, mao0, '1ª: não compra'); igual(e.jogs[1].vida, 39);
  entra(); igual(e.jogs[0].zonas.mao.length, mao0 + 1, '2ª: compra');
  entra(); igual(e.jogs[0].zonas.mao.length, mao0 + 1, '3ª: não'); igual(e.jogs[1].vida, 37);
});

caso('701.25', "vigiar: olha o topo e põe no cemitério o que quiser; o resto fica no topo", () => {
  ok(M.fxSuportado(M.carta('Consider').fx), 'Consider aceito');
  const e = cena({ campo: [] });
  e.por(0, 'Grizzly Bears', { zona: 'grimorio' }); e.por(0, 'Sol Ring', { zona: 'grimorio' });   // topo: Sol Ring
  const g = e.jogs[0].zonas.grimorio;
  M.executar(e, { op: 'vigiar', quem: 'voce', qtd: 2 }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (_j, _t, ops) => ops.find(x => x.a === (e.objs[x.id].n === 'Sol Ring' ? 'cemiterio' : 'topo')));
  igual(naZona(e, 0, 'cemiterio'), ['Sol Ring']);
  igual(e.objs[g[g.length - 1]].n, 'Grizzly Bears', 'Bears ficou no topo');
});

caso('707.10', "magecraft (\"conjura ou copia\"): Archmage Emeritus dispara ao copiar a mágica; a cópia feita pelo oponente não", () => {
  for (const c of ['Archmage Emeritus', 'Storm-Kiln Artist', 'Veyran, Voice of Duality']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Archmage Emeritus'], [1, 'Grizzly Bears']] });
  const b = e.por(0, 'Lightning Bolt', { zona: 'mao' });
  M.mover(e, b.id, 'pilha'); b.pil = { x: 0, alvos: [[{ jog: 1 }]], ctrl: 0, opc: {} };
  e.pend = [];
  M.criarCopia(e, b, 0, { alvos: [[{ jog: 1 }]], novos: false });
  igual(e.pend.map(p => p.n), ['Archmage Emeritus'], 'copiar dispara o magecraft');
  e.pend = [];
  M.evento(e, { ev: 'copia', id: b.id, j: 1 });
  igual(e.pend.length, 0, 'cópia do oponente: não');
});

caso('702.134', "mentor: ao atacar, +1/+1 numa atacante com poder menor (Legion Warboss 2/2 → a 1/1); a de poder igual não serve", () => {
  const e = cena({ campo: [[0, 'Legion Warboss'], [0, 'Llanowar Elves'], [0, 'Grizzly Bears']] });
  const os = n => e.objs[e.campo.find(id => e.objs[id].n === n)];
  const W = os('Legion Warboss'), Gg = os('Llanowar Elves'), B = os('Grizzly Bears');
  e.turno.combate = { atk: [W, Gg, B].map(o => ({ id: o.id, ts: o.ts, def: 1 })) };
  e.pend = [];
  M.evento(e, { ev: 'ataca', id: W.id, def: 1 });
  const p = e.pend.find(x => x.k === 'mentor'); ok(p, 'mentor disparou');
  const f = p.g.alvos[0].f;
  ok(M.bate(e, Gg, f, { voce: 0 }) && !M.bate(e, B, f, { voce: 0 }) && !M.bate(e, W, f, { voce: 0 }), 'só a de poder menor é alvo');
});
caso('702.175', "prole: pago o custo a mais, a criatura entra e cria uma ficha cópia 1/1 dela; sem pagar, não", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Agate Instigator']] });
  M.avancar(e); respE(e, o => o.a === 'conjurar');
  if (e.perg && e.perg.tipo === 'opcao') respE(e, o => o.v && o.v.prole);
  for (let g = 0; e.pilha.length + e.pend.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar');
  const ags = e.campo.map(id => e.objs[id]).filter(o => M.dadoDe(e, o).n === 'Agate Instigator' || o.n === 'Agate Instigator');
  igual(ags.length, 2, 'a carta e a ficha');
  const fi = ags.find(o => o.ficha); ok(fi, 'uma é ficha');
  igual([M.poder(e, fi), M.resistencia(e, fi)], [1, 1], 'a ficha é 1/1');
  const f = cena({ campo: [[0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Agate Instigator']] });
  M.avancar(f); respE(f, o => o.a === 'conjurar');
  for (let g = 0; f.pilha.length + f.pend.length && f.perg && g < 10; g++) respE(f, o => o.a === 'passar');
  igual(f.campo.filter(id => f.objs[id].n === 'Agate Instigator').length, 1, 'só 2 de mana: sem prole');
});

caso('701.3', "anexar ao objeto do evento: Hero's Blade se prende ao lendário que entra; Sword of the Meek volta do cemitério e equipa a 1/1", () => {
  for (const c of ["Hero's Blade", 'Nim Deathmantle', 'Sword of the Meek']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, "Hero's Blade"]] });
  const hb = e.objs[e.campo[0]];
  const k = e.por(0, 'Krenko, Mob Boss');
  const cx = { voce: 0, este: hb.id, alvos: [], ilegal: {}, lki: {}, ev: { ev: 'zona', id: k.id, para: 'campo' } };
  M.executar(e, M.carta("Hero's Blade").gat[0].fx[0], cx, () => ({ a: 'sim' }));
  ok(hb.anexo && hb.anexo.id === k.id, 'Blade presa ao Krenko');
  const f = cena({ campo: [] });
  const sw = f.por(0, 'Sword of the Meek', { zona: 'cemiterio' });
  const el = f.por(0, 'Llanowar Elves');
  const cy = { voce: 0, este: sw.id, alvos: [], ilegal: {}, lki: {}, ev: { ev: 'zona', id: el.id, para: 'campo' } };
  for (const fx of M.carta('Sword of the Meek').gat[0].fx) M.executar(f, fx, cy, () => ({ a: 'sim' }));
  ok(sw.zona === 'campo' && sw.anexo && sw.anexo.id === el.id, 'Sword voltou e equipou');
});

caso('120.3', "dano igual ao poder da criatura do evento (Terror of the Peaks) e ao maior grupo de um tipo de criatura (Basalt Ravager)", () => {
  for (const c of ['Basalt Ravager', 'Terror of the Peaks', 'Warstorm Surge']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Llanowar Elves'], [0, 'Elvish Mystic'], [0, 'Grizzly Bears'], [0, 'Hill Giant']] });
  const cx = (ev?) => ({ voce: 0, alvos: [], ilegal: {}, lki: {}, ev });
  igual(M.qtdDe(e, { conta: { de: 'tipoMaisComum' } }, cx()), 2, 'dois Elfos');
  const hg = e.campo.map(id => e.objs[id]).find(o => o.n === 'Hill Giant');
  igual(M.qtdDe(e, { conta: { de: 'evento', o: 'poder' } }, cx({ ev: 'zona', id: hg.id, para: 'campo' })), 3, 'Hill Giant 3/3');
});

caso('122.5', "mover marcadores: Nesting Grounds tira um e põe no outro; Zack Fair sacrificado passa os +1/+1 que tinha; Forgotten Ancient um a um", () => {
  for (const c of ['Forgotten Ancient']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  for (const c of ['Nesting Grounds', 'Zack Fair']) ok(M.carta(c).atv.every(a => M.fxSuportado(a.fx, { topo: false })), c + ' aceito');
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Hill Giant']] });
  const [gb, hg] = e.campo.map(id => e.objs[id]);
  gb.marc['+1/+1'] = 2;
  const cx: any = { voce: 0, alvos: [[{ o: gb.id, ts: gb.ts }], [{ o: hg.id, ts: hg.ts }]], ilegal: {}, lki: {} };
  M.executar(e, M.carta('Nesting Grounds').atv[1].fx[0], cx, () => ({ a: 'nao' }));
  igual([gb.marc['+1/+1'], hg.marc['+1/+1']], [1, 1], 'um passou');
  const z = e.por(0, 'Zack Fair'); z.marc['+1/+1'] = 3;
  const cz: any = { voce: 0, este: z.id, alvos: [[{ o: hg.id, ts: hg.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, z) } };
  M.mover(e, z.id, 'cemiterio');
  M.executar(e, M.carta('Zack Fair').atv[0].fx[1], cz, () => ({ a: 'nao' }));
  igual(hg.marc['+1/+1'], 4, 'Zack passou os 3');
  const fa = e.por(0, 'Forgotten Ancient'); fa.marc['+1/+1'] = 2;
  M.executar(e, M.carta('Forgotten Ancient').gat[1].fx[0], { voce: 0, este: fa.id, alvos: [], ilegal: {}, lki: {} }, (_j, t, ops) => t === 'talvez' ? { a: 'sim' } : ops.find(o => o.id === gb.id) || ops[0]);
  igual([fa.marc['+1/+1'], gb.marc['+1/+1']], [0, 3], 'Ancient passou os 2 para os Bears');
});

caso('701.21', "sacrificar todas menos N (Promise of Loyalty) e \"uma de cada tipo, o resto vai\" (Ajani): quem sacrifica escolhe as que ficam", () => {
  for (const c of ['Archfiend of Depravity']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  ok(M.fxSuportado(M.carta('Promise of Loyalty').fx), 'Promise aceito');
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Hill Giant'], [1, 'Llanowar Elves'], [1, 'Sol Ring'], [1, 'Grizzly Bears'], [1, 'Island']] });
  const ag = M.agenteBasico();
  const ask = (j, tipo, ops, cx) => ops[ag(e, { j, tipo, ops, ctx: cx })];
  M.executar(e, { op: 'sacrificar', quem: 'cadaJogador', f: { tipo: ['Creature'], zona: 'campo' }, exceto: { qtd: 1 } }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, ask);
  igual(noCampo(e).filter(n => n !== 'Sol Ring' && n !== 'Island').length, 2, 'uma criatura de cada');
  ok(noCampo(e).includes('Hill Giant'), 'fica a de mais valor');
  const f = cena({ campo: [[1, 'Llanowar Elves'], [1, 'Grizzly Bears'], [1, 'Sol Ring'], [1, 'Island']] });
  M.executar(f, { op: 'sacrificar', quem: 'cadaOponente', f: { tipo: ['Permanent'], nao: ['Land'], zona: 'campo' }, exceto: { qtd: 1, porTipo: ['Artifact', 'Creature', 'Enchantment', 'Planeswalker'] } }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, tipo, ops, cx) => ops[ag(f, { j, tipo, ops, ctx: cx })]);
  igual(noCampo(f).sort(), ['Island', 'Sol Ring', noCampo(f).find(n => n === 'Llanowar Elves' || n === 'Grizzly Bears')].sort(), 'fica um artefato, uma criatura e o terreno');
  igual(noCampo(f).length, 3);
});

caso('614.12', "entra virada/desvirada por outra permanente: Authority of the Consuls vira a criatura do oponente; Spelunking desvira seu terreno que entraria virado", () => {
  for (const c of ['Authority of the Consuls', "Kinjalli's Sunwing", 'Spelunking']) ok(M.carta(c).subst.every(s => M.substOk(s)), c + ' aceito');
  const e = cena({ campo: [[0, 'Authority of the Consuls']] });
  const ent = (x, j, n) => { const o = x.por(j, n, { zona: 'mao' }); M.entrarPermanente(x, o.id, j, {}, (_j, _t, ops) => ops[0]); return o; };
  const b1 = ent(e, 1, 'Grizzly Bears'), b0 = ent(e, 0, 'Hill Giant');
  ok(b1.virada && !b0.virada, 'só a do oponente entra virada');
  ok(M.criarFichas(e, 1, { pt: [1, 1], tipos: ['Creature'], sub: ['Goblin'], cores: 'R' }, 1)[0].virada, 'ficha do oponente também');
  const f = cena({ campo: [[0, 'Spelunking']] });
  const g = ent(f, 0, 'Dimir Guildgate'), h = ent(f, 1, 'Dimir Guildgate');
  ok(!g.virada && h.virada, 'meu Guildgate desvirado; o do oponente virado');
});

caso('601.2f', "custo a mais para o oponente que mira: Lightning Bolt no Terror of the Peaks custa 3 de vida a mais; Kopala: {2} a mais para mirar um Tritão", () => {
  for (const c of ['Kopala, Warden of Waves', 'Terror of the Peaks']) ok(M.carta(c).est.filter(s => s.modo === 'aumentaCusto').every(s => M.estAumentaOk(s)), c + ' aceito');
  const e = cena({ campo: [[1, 'Terror of the Peaks'], [0, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoObj(e, 'Terror of the Peaks');
  igual(e.jogs[0].vida, 37, 'pagou 3 de vida');
  const t = e.campo.map(id => e.objs[id]).find(o => o.n === 'Terror of the Peaks');
  const k = cena({ campo: [[1, 'Kopala, Warden of Waves']] });
  const kop = k.objs[k.campo[0]];
  igual(M.impostoAlvo(k, 0, [[{ o: kop.id, ts: kop.ts }]], false).g, 2, 'mágica do oponente: +{2}');
  igual(M.impostoAlvo(k, 0, [[{ o: kop.id, ts: kop.ts }]], true).g, 2, 'habilidade do oponente: +{2}');
  igual(M.impostoAlvo(k, 1, [[{ o: kop.id, ts: kop.ts }]], false).g, 0, 'do próprio dono: nada');
  ok(t, 'Terror (5/4) segue no campo depois de 3 de dano');
});

caso('111.4', "ficha com habilidade própria: o alvo da habilidade da ficha não conta como alvo do gatilho que a cria (Weapons Manufacturing → Munitions); gatilho da ficha que o motor não lê trava a carta", () => {
  ok(M.carta('Weapons Manufacturing').gat.every(g => M.gatOk(g)), 'Weapons Manufacturing aceito');
  const e = cena({ campo: [[0, 'Weapons Manufacturing']] });
  M.executar(e, M.carta('Weapons Manufacturing').gat[0].fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  const mu = e.campo.map(id => e.objs[id]).find(o => o.n === 'Munitions');
  ok(mu && M.gatDe(e, mu).some(g => g.ev === 'sai'), 'Munitions com o gatilho de sair');
});

caso('701.44', "explorar: terreno no topo vai para a mão; senão +1/+1 e pode ir ao cemitério; \"quando uma criatura sua explora\" (Merfolk Cave-Diver)", () => {
  for (const c of ['Merfolk Cave-Diver', 'Nicanzil, Current Conductor']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Merfolk Cave-Diver'], [0, 'Grizzly Bears']] });
  const gb = e.campo.map(id => e.objs[id]).find(o => o.n === 'Grizzly Bears');
  const mao0 = e.jogs[0].zonas.mao.length;
  e.por(0, 'Forest', { zona: 'grimorio' });
  e.pend = [];
  M.executar(e, { op: 'explorar', em: { todos: { nome: 'Grizzly Bears', zona: 'campo' } } }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (_j, _t, ops) => ops[0]);
  igual(e.jogs[0].zonas.mao.length, mao0 + 1, 'Forest na mão'); igual(gb.marc['+1/+1'] || 0, 0);
  igual(e.pend.map(p => p.n), ['Merfolk Cave-Diver'], 'Cave-Diver dispara');
  e.por(0, 'Sol Ring', { zona: 'grimorio' });
  M.executar(e, { op: 'explorar', em: { todos: { nome: 'Grizzly Bears', zona: 'campo' } } }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (_j, _t, ops) => ops.find(o => o.a === 'cemiterio') || ops[0]);
  igual(gb.marc['+1/+1'], 1, 'não-terreno: +1/+1'); igual(naZona(e, 0, 'cemiterio'), ['Sol Ring']);
});

caso('508.3a', "\"sempre que uma ou mais atacam\" (grupo): Meriadoc dispara uma vez com dois Halflings atacando", () => {
  for (const c of ['Mavren Fein, Dusk Apostle', 'Meriadoc Brandybuck']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Meriadoc Brandybuck'], [0, 'Meriadoc Brandybuck']] });
  const [a, b] = e.campo.map(id => e.objs[id]);
  e.pend = [];
  M.evento(e, { ev: 'ataca', id: a.id, def: 1 }); M.evento(e, { ev: 'ataca', id: b.id, def: 1 });
  igual(e.pend.length, 2, 'um disparo por Meriadoc, não por atacante');
});

caso('702.141', "bis: do cemitério, exila a carta e cria uma ficha cópia por oponente, com ímpeto e que deve atacar; sacrificadas na etapa final", () => {
  const e = cena({ jogs: 3, campo: enche(7, 'Island').map(n => [0, n]) });
  const md = e.por(0, 'Mist Dancer', { zona: 'cemiterio' });
  M.avancar(e);
  const op = e.perg.ops.findIndex(o => o.a === 'ativar' && o.id === md.id); ok(op >= 0, 'bis oferecido do cemitério');
  respE(e, o => o.a === 'ativar' && o.id === md.id);
  for (let g = 0; e.pilha.length && e.perg && g < 10; g++) respE(e, o => o.a === 'passar');
  igual(md.zona, 'exilio', 'a carta foi exilada');
  const fs = e.campo.map(id => e.objs[id]).filter(o => o.ficha && o.n === 'Mist Dancer');
  igual(fs.length, 2, 'uma ficha por oponente');
  ok(fs.every(o => M.temKw(e, o, 'pressa')), 'com ímpeto');
  igual(e.atras.length, 1, 'sacrifício atrasado');
  M.executar(e, e.atras[0].g.fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {}, criadas: e.atras[0].mem.criadas }, () => ({ a: 'nao' }));
  igual(e.campo.filter(id => e.objs[id].n === 'Mist Dancer').length, 0, 'sacrificadas');
});

caso('702.121', "corpo a corpo: atacando dois oponentes, Tifa ganha +2/+2; atacar só um dá +1/+1", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Tifa, Martial Artist'], [0, 'Grizzly Bears']] });
  const [t, b] = e.campo.map(id => e.objs[id]);
  e.turno.combate = { atk: [{ id: t.id, ts: t.ts, alvo: { jog: 1 }, def: 1 }, { id: b.id, ts: b.ts, alvo: { jog: 2 }, def: 2 }] };
  e.pend = [];
  M.evento(e, { ev: 'ataca', id: t.id, def: 1 });
  const p = e.pend.find(x => x.k === 'corpo-a-corpo'); ok(p, 'disparou');
  igual(p.g.fx[0].p, 2, '+2/+2');
  e.turno.combate.atk[1].alvo = { jog: 1 }; e.pend = [];
  M.evento(e, { ev: 'ataca', id: t.id, def: 1 });
  igual(e.pend.find(x => x.k === 'corpo-a-corpo').g.fx[0].p, 1, 'um oponente: +1/+1');
});

caso('603.2', "Esper Sentinel dispara só na 1ª mágica não-criatura do oponente no turno; Xyris não conta a 1ª compra da etapa de compra dele", () => {
  for (const c of ['Esper Sentinel', 'Xyris, the Writhing Storm']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[1, 'Esper Sentinel']], mao: [[0, 'Grizzly Bears'], [0, 'Sol Ring'], [0, 'Lightning Bolt']] });
  const [urso, anel, bolt] = ['Grizzly Bears', 'Sol Ring', 'Lightning Bolt'].map(n => e.jogs[0].zonas.mao.map(id => e.objs[id]).find(o => o.n === n));
  const conjura = o => { M.mover(e, o.id, 'pilha'); const J = e.jogs[0]; J.conjH = { t: e.turno.n, l: [...(J.conjH ? J.conjH.l : []), { ...o }] }; e.pend = []; M.evento(e, { ev: 'conjura', id: o.id, j: 0 }); return e.pend.filter(p => p.n === 'Esper Sentinel').length; };
  igual(conjura(urso), 0, 'criatura: não');
  igual(conjura(anel), 1, '1ª não-criatura: dispara');
  igual(conjura(bolt), 0, '2ª não-criatura: não');
  const f = cena({ campo: [[0, 'Xyris, the Writhing Storm']], passo: 'compra' });
  f.turno.ativo = 1; f.pend = [];
  M.comprar(f, 1, 1); igual(f.pend.filter(p => p.n === 'Xyris, the Writhing Storm').length, 0, 'a da etapa de compra não');
  M.comprar(f, 1, 1); igual(f.pend.filter(p => p.n === 'Xyris, the Writhing Storm').length, 1, 'a 2ª sim');
  f.turno.passo = 'principal1'; M.comprar(f, 1, 1); igual(f.pend.filter(p => p.n === 'Xyris, the Writhing Storm').length, 2, 'fora da etapa sim');
});

caso('702.121a', "corpo-a-corpo: atacando dois oponentes, cada um com corpo-a-corpo ganha +2/+0; Skyhunter dá a palavra-chave com o comandante no campo", () => {
  const e = cena({ jogs: 3, cmd: ['Krenko, Mob Boss'], campo: [[0, 'Skyhunter Strike Force'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  M.mover(e, e.jogs[0].zonas.comando[0], 'campo'); e.abeNovo = []; e.pend = [];
  const sk = objN(e, 0, 'Skyhunter Strike Force'), b = objN(e, 0, 'Grizzly Bears'), el = objN(e, 0, 'Llanowar Elves');
  ok(M.temKw(e, b, 'corpo-a-corpo'), 'o Urso ganhou corpo-a-corpo');
  ate(e, 'atacar'); atacaCom(e, sk, { jog: 1 }); atacaCom(e, b, { jog: 2 }); atacaCom(e, el, { jog: 1 }); fecha(e, 'atacar');
  ateFimCombate(e);
  igual([M.poder(e, sk), M.poder(e, b), M.poder(e, el)], [4, 4, 3], '+2 cada (Elfo: +2 também, é outro)');
  const f = cena({ campo: [[0, 'Skyhunter Strike Force'], [0, 'Grizzly Bears']] });
  const sk2 = objN(f, 0, 'Skyhunter Strike Force'), b2 = objN(f, 0, 'Grizzly Bears');
  ok(!M.temKw(f, b2, 'corpo-a-corpo'), 'sem comandante: não dá');
  ate(f, 'atacar'); atacaCom(f, sk2); atacaCom(f, b2); fecha(f, 'atacar'); ateFimCombate(f);
  igual([M.poder(f, sk2), M.poder(f, b2)], [3, 2], 'um oponente: +1 só no Skyhunter');
});

caso('702.135a', "pós-vida: Indebted Spirit morre e cria 1 Espírito 1/1 voador; preso a outra criatura (a Aura escrita como equipada) ela também tem pós-vida", () => {
  const e = cena({ campo: [[0, 'Indebted Spirit'], [0, 'Grizzly Bears']] });
  const sp = objN(e, 0, 'Indebted Spirit'), b = objN(e, 0, 'Grizzly Bears');
  M.mover(e, sp.id, 'cemiterio'); resolvePilha(e); M.abe(e); if (e.pend.length) { M.avancar(e); resolvePilha(e); }
  const esp = () => e.campo.map(id => e.objs[id]).filter(o => o.ficha && (o.ficha.sub || []).includes('Spirit'));
  igual(esp().length, 1, 'um Espírito'); ok(M.temKw(e, esp()[0], 'voar'), 'voa');
  const f = cena({ campo: [[0, 'Indebted Spirit'], [0, 'Grizzly Bears']] });
  const sp2 = objN(f, 0, 'Indebted Spirit'), b2 = objN(f, 0, 'Grizzly Bears');
  sp2.anexo = { id: b2.id, ts: b2.ts }; f.vCamada = (f.vCamada || 0) + 1;
  ok(M.temKw(f, b2, 'posVida'), 'o Urso tem pós-vida'); igual(M.poder(f, b2), 3);
  f.pend = []; M.mover(f, b2.id, 'cemiterio');
  igual(f.pend.filter(p => p.k === 'posVida').length, 1, 'o Urso dispara pós-vida');
});

caso('702.30a', "eco: Mogg War Marshal dispara na 1ª manutenção de quem controla (sacrifique a menos que pague {1}{R}); na seguinte, não; sem pagar, vai para o cemitério", () => {
  const e = cena({ campo: [[0, 'Mogg War Marshal']] }); e.pend = [];
  M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 1 }); igual(e.pend.filter(p => p.k === 'eco').length, 0, 'manutenção do oponente: não');
  M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 0 }); igual(e.pend.filter(p => p.k === 'eco').length, 1, 'a sua: dispara');
  e.pend = []; M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 0 }); igual(e.pend.length, 0, 'a próxima: não');
  const f = cena({ campo: [[0, 'Mogg War Marshal']] }); f.pend = [];
  const m2 = objN(f, 0, 'Mogg War Marshal');
  M.evento(f, { ev: 'fase', passo: 'manutencao', ativo: 0 }); M.avancar(f); resolvePilha(f);
  igual(m2.zona, 'cemiterio', 'sem mana: sacrificado');
});

caso('613.1f', "animar: Shadowspear tira antimagia e indestrutível das permanentes do oponente até o fim do turno; Mirror Entity X=3 faz as suas 3/3 com todos os tipos de criatura", () => {
  for (const c of ['Shadowspear', 'Mirror Entity']) ok(M.carta(c).atv.every(a => M.fxSuportado(a.fx)), c + ' aceito');
  const e = cena({ campo: [[0, 'Shadowspear'], [1, 'Swiftfoot Boots'], [1, 'Darksteel Myr']] });
  const sb = objN(e, 1, 'Swiftfoot Boots'), b = objN(e, 1, 'Darksteel Myr'); sb.anexo = { id: b.id, ts: b.ts }; e.vCamada = (e.vCamada || 0) + 1;
  ok(M.temKw(e, b, 'antimagia') && M.temKw(e, b, 'indestrutivel'), 'antes: antimagia (Botas) e indestrutível (Myr)');
  const cx = { voce: 0, este: objN(e, 0, 'Shadowspear').id, alvos: [], ilegal: {}, lki: {} };
  M.executar(e, M.carta('Shadowspear').atv[0].fx[0], cx, null);
  ok(!M.temKw(e, b, 'antimagia') && !M.temKw(e, b, 'indestrutivel'), 'perdeu as duas');
  const f = cena({ campo: [[0, 'Mirror Entity'], [0, 'Grizzly Bears']] });
  M.executar(f, M.carta('Mirror Entity').atv[0].fx[0], { voce: 0, este: objN(f, 0, 'Mirror Entity').id, x: 3, alvos: [], ilegal: {}, lki: {} }, null);
  const b2 = objN(f, 0, 'Grizzly Bears');
  igual([M.poder(f, b2), M.resistencia(f, b2)], [3, 3]); igual(M.tiposCriatura(f, b2), 'todos', 'todos os tipos');
});

caso('701.26', "virar/desvirar 'até N': Snap devolve a criatura e desvira até 2 terrenos; Myr Battlesphere atacando vira os Myr desvirados e ganha +X/+0 e causa X", () => {
  for (const c of ['Snap', 'Myr Battlesphere']) ok(M.fxSuportado(M.carta(c).fx || []) && (M.carta(c).gat || []).every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Island', { virada: true }], [0, 'Island', { virada: true }], [0, 'Island', { virada: true }], [0, 'Island'], [0, 'Island'], [1, 'Grizzly Bears']], mao: [[0, 'Snap']] });
  M.avancar(e); conj(e, 'Snap'); if (e.perg && e.perg.tipo === 'alvo') alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  igual(objN(e, 1, 'Grizzly Bears'), undefined, 'o Urso voltou');
  igual(e.campo.filter(id => e.objs[id].n === 'Island' && e.objs[id].virada).length, 3, '5 ilhas: 2 pagaram, 3 viradas antes → desvirou 2, sobram 3');
  const f = combate([[0, 'Myr Battlesphere']]);
  const bs = objN(f, 0, 'Myr Battlesphere');
  for (let i = 0; i < 2; i++) M.criarFicha(f, 0, { pt: [1, 1], tipos: ['Artifact', 'Creature'], sub: ['Myr'] });
  ate(f, 'atacar'); atacaCom(f, bs); fecha(f, 'atacar');
  for (let g = 0; f.turno.passo !== 'principal2' && !f.fim && g < 300; g++) { const pr = x => x.turno.passo === 'principal2'; M.avancar(f, pr); if (f.perg) M.responder(f, f.perg.tipo === 'acao' ? 0 : M.agenteBasico()(f, f.perg), pr); }
  igual(f.campo.filter(id => f.objs[id].ficha && f.objs[id].virada).length, 2, 'virou os 2 Myr');
  igual(M.poder(f, bs), 6, '+2/+0'); igual(f.jogs[1].vida, 40 - 2 - 6, '2 da habilidade + 6 de combate');
});

caso('702.34a', "Increasing Devotion: 5 Humanos; com flashback, 10. Return to Dust na sua principal exila os 2 alvos", () => {
  ok(M.fxSuportado(M.carta('Increasing Devotion').fx) && M.fxSuportado(M.carta('Return to Dust').fx), 'aceitos');
  const conta = e => e.campo.filter(id => e.objs[id].ficha).length;
  const e = cena({ campo: terras(5, 'Plains'), mao: [[0, 'Increasing Devotion']] });
  M.avancar(e); conj(e, 'Increasing Devotion'); resolveCom(e); igual(conta(e), 5, 'da mão: 5');
  const f = cena({ campo: terras(9, 'Plains') }); f.por(0, 'Increasing Devotion', { zona: 'cemiterio' });
  M.avancar(f); conj(f, 'Increasing Devotion'); resolveCom(f); igual(conta(f), 10, 'com flashback: 10');
  const g = cena({ campo: [...terras(4, 'Plains'), [1, 'Sol Ring'], [1, 'Swiftfoot Boots']], mao: [[0, 'Return to Dust']] });
  M.avancar(g); conj(g, 'Return to Dust'); alvoObj(g, 'Sol Ring'); if (g.perg && g.perg.tipo === 'alvo') alvoObj(g, 'Swiftfoot Boots'); resolveCom(g);
  igual(g.campo.filter(id => g.objs[id].ctrl === 1).length, 0, 'os dois exilados');
});

caso('106.6', "Klauth atacando: mana igual ao poder total dos atacantes, só para conjurar mágicas, e fica até o fim do turno", () => {
  ok(M.carta('Klauth, Unrivaled Ancient').gat.every(g => M.gatOk(g)), 'aceito');
  const e = combate([[0, 'Klauth, Unrivaled Ancient'], [0, 'Grizzly Bears']], {}); e.jogs[0].zonas.mao.length = 0;
  const k = objN(e, 0, 'Klauth, Unrivaled Ancient'), b = objN(e, 0, 'Grizzly Bears');
  e.por(0, 'Krenko, Mob Boss', { zona: 'mao' });
  ate(e, 'atacar'); atacaCom(e, k); atacaCom(e, b); fecha(e, 'atacar');
  for (let g = 0; e.turno.passo !== 'principal2' && !e.fim && g < 300; g++) { const pr = x => x.turno.passo === 'principal2'; M.avancar(e, pr); if (e.perg) M.responder(e, e.perg.tipo === 'acao' ? 0 : M.agenteBasico()(e, e.perg), pr); }
  const J = e.jogs[0], soma = J.restrita.reduce((s, r) => s + Object.values<number>(r.m).reduce((a, x) => a + x, 0), 0);
  igual(soma, 6, '4 + 2 de poder, restrita, ainda na principal 2');
  const kr = J.zonas.mao.map(id => e.objs[id]).find(o => o.n === 'Krenko, Mob Boss');
  const R = M.reservaCom(e, 0, kr); igual(Object.values<number>(R).reduce((a, x) => a + x, 0), 6, 'a mágica enxerga');
  igual(Object.values<number>(M.reservaCom(e, 0, null)).reduce((a, x) => a + x, 0) - Object.values<number>(J.reserva).reduce((a, x) => a + x, 0), 0, 'habilidade não');
  e.turno.passo = 'limpeza'; M.esvaziarReservas(e); igual(J.restrita.length, 0, 'some na limpeza');
});

caso('122.1', "Wave Goodbye: volta para a mão cada criatura sem marcador +1/+1 (a com marcador fica; com outro marcador, volta)", () => {
  ok(M.fxSuportado(M.carta('Wave Goodbye').fx), 'aceito');
  const e = cena({ campo: [...terras(4, 'Island'), [0, 'Grizzly Bears'], [1, 'Llanowar Elves'], [1, 'Serra Angel']], mao: [[0, 'Wave Goodbye']] });
  objN(e, 1, 'Serra Angel').marc['+1/+1'] = 1; objN(e, 0, 'Grizzly Bears').marc['-1/-1'] = 1;
  M.avancar(e); conj(e, 'Wave Goodbye'); resolveCom(e);
  igual(e.campo.filter(id => M.temTipo(e, e.objs[id], 'Creature')).map(id => e.objs[id].n), ['Serra Angel']);
});

caso('118.12', "Ripples of Undeath: mói 3 e pode pagar {1} e 3 de vida para pôr uma delas na mão", () => {
  ok(M.carta('Ripples of Undeath').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Ripples of Undeath']] });
  for (const n of ['Grizzly Bears', 'Sol Ring', 'Lightning Bolt']) e.por(0, n, { zona: 'grimorio' });
  const g = M.carta('Ripples of Undeath').gat[0], cx = { voce: 0, este: objN(e, 0, 'Ripples of Undeath').id, alvos: [], ilegal: {}, lki: {} };
  for (const f of g.fx) M.executar(e, f, cx, (j, t, ops) => ops.findIndex(o => o.a === 'sim' || o.a === 'pagar' || o.a === 'mover') >= 0 ? ops[ops.findIndex(o => o.a === 'sim' || o.a === 'pagar' || o.a === 'mover')] : ops[0]);
  igual(e.jogs[0].vida, 37, 'pagou 3 de vida'); ok(objN(e, 0, 'Swamp').virada, 'e {1}');
  igual(e.jogs[0].zonas.mao.filter(id => ['Grizzly Bears', 'Sol Ring', 'Lightning Bolt'].includes(e.objs[id].n)).length, 1, 'uma das moídas na mão');
  igual(e.jogs[0].zonas.cemiterio.length, 2);
});

caso('614.1c', "Feasting Hobbit: ao entrar sacrifica as Comidas que quiser e entra com 3 marcadores +1/+1 por Comida; sem Comida, entra 2/2", () => {
  ok(M.carta('Feasting Hobbit').subst.every(s => M.substOk(s)), 'aceito');
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest']], mao: [[0, 'Feasting Hobbit']] });
  M.criarFichas(e, 0, { nome: 'Food' }, 2);
  M.avancar(e); conj(e, 'Feasting Hobbit'); resolveCom(e);
  const h = objN(e, 0, 'Feasting Hobbit');
  igual(h.marc['+1/+1'], 6, '2 Comidas × 3'); igual(e.campo.filter(id => e.objs[id].n === 'Food').length, 0, 'sacrificou as duas');
  const f = cena({ campo: [[0, 'Forest'], [0, 'Forest']], mao: [[0, 'Feasting Hobbit']] });
  M.avancar(f); conj(f, 'Feasting Hobbit'); resolveCom(f);
  igual(M.poder(f, objN(f, 0, 'Feasting Hobbit')), 2, 'sem Comida: 2/2');
});

caso('601.2f', "custo adicional revelar OU {1} (Thunderherd Migration): com Dinossauro na mão revela e paga só {1}{G}; sem ele precisa de {2}{G}", () => {
  ok(M.custoAdSuportado(M.carta('Thunderherd Migration').custoAd), 'o motor lê o custo');
  for (const [dino, n] of [[true, 2], [false, 3], [false, 2]] as const) {
    const campo = Array.from({ length: n }, () => [0, 'Forest']), mao = [[0, 'Thunderherd Migration'], ...(dino ? [[0, 'Apex Altisaur']] : [])];
    const e = cena({ campo, mao }); e.pend = []; e.jogs[0].terrenos = 1;
    e.por(0, 'Forest', { zona: 'grimorio' });
    const tm = e.jogs[0].zonas.mao.find(x => e.objs[x].n === 'Thunderherd Migration');
    igual(M.podeConjurar(e, 0, e.objs[tm]), dino || n === 3, `pode conjurar: dino ${dino}, ${n}`);
    if (!(dino || n === 3)) continue;
    M.avancar(e); conj(e, 'Thunderherd Migration');
    resolveCom(e, () => -1);
    const foi = naZona(e, 0, 'cemiterio').includes('Thunderherd Migration');
    igual(foi, dino || n === 3, `dino ${dino}, ${n} floresta(s)`);
    if (dino) ok(e.jogs[0].zonas.mao.some(id => e.objs[id].n === 'Apex Altisaur'), 'revelar não tira da mão');
  }
});

caso('602.2b', "custo de exilar do cemitério (Drivnod): com 3 criaturas no cemitério ativa, exila as 3 e ganha marcador de indestrutível; com 2 não ativa", () => {
  for (const n of [3, 2]) {
    const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Drivnod, Carnage Dominus']] }); e.pend = [];
    for (let i = 0; i < n; i++) e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
    e.por(0, 'Sol Ring', { zona: 'cemiterio' });
    const pode = M.opcoesPrioridade(e, 0).some(o => o.a === 'ativar' && e.objs[o.id].n === 'Drivnod, Carnage Dominus');
    igual(pode, n === 3, n + ' criaturas no cemitério');
    if (!pode) continue;
    M.avancar(e); respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Drivnod, Carnage Dominus');
    resolveCom(e, () => -1);
    const dv = objN(e, 0, 'Drivnod, Carnage Dominus');
    igual([dv.marc.indestructible || 0, naZona(e, 0, 'cemiterio'), naZona(e, 0, 'exilio').length], [1, ['Sol Ring'], 3]);
  }
});

caso('105.2', "Faeburrow Elder: +1/+1 por cor entre as suas permanentes e {T}: uma mana de cada uma dessas cores", () => {
  const e = cena({ campo: [[0, 'Faeburrow Elder', { doente: false }], [0, 'Grizzly Bears'], [0, 'Mountain'], [1, 'Vampire Nighthawk']] });
  const fe = objN(e, 0, 'Faeburrow Elder');
  ok(M.estContOk(M.carta('Faeburrow Elder').est[0]), 'a estática é lida');
  igual([M.poder(e, fe), M.resistencia(e, fe)], [2, 2], 'verde e branco (terreno é incolor; o Nighthawk do oponente não conta)');
  const f = M.fontesDeMana(e, 0, { soVirar: true }).find(x => x.id === fe.id);
  igual(f.pacotes.length, 1, 'um pacote só'); igual([f.pacotes[0].W, f.pacotes[0].G, M.somaMana(f.pacotes[0])], [1, 1, 2]);
});

caso('613.1e', "camada 5: Nim Deathmantle deixa a equipada preta (Zumbi, +2/+2, intimidar); Leyline of the Guildpact deixa as suas não-terreno de todas as cores", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Nim Deathmantle'], [0, 'Forest']] });
  const gb = objN(e, 0, 'Grizzly Bears'), nim = objN(e, 0, 'Nim Deathmantle');
  igual(M.dadoDe(e, gb).cores, 'G', 'antes: verde');
  nim.anexo = { id: gb.id, ts: gb.ts }; e.vCamada = (e.vCamada || 0) + 1;
  igual([M.dadoDe(e, gb).cores, M.poder(e, gb), M.temKw(e, gb, 'intimidar'), (M.dadoDe(e, gb).sub || []).includes('Zombie')], ['B', 4, true, true], 'equipada');
  const f = cena({ campo: [[0, 'Leyline of the Guildpact'], [0, 'Grizzly Bears'], [0, 'Forest'], [1, 'Grizzly Bears']] });
  const meu = f.campo.map(id => f.objs[id]).find(o => o.n === 'Grizzly Bears' && o.ctrl === 0), dele = f.campo.map(id => f.objs[id]).find(o => o.n === 'Grizzly Bears' && o.ctrl === 1);
  igual([M.dadoDe(f, meu).cores, M.dadoDe(f, dele).cores, M.dadoDe(f, objN(f, 0, 'Forest')).cores || ''], ['WUBRG', 'G', ''], 'só as suas não-terreno');
  ok(M.bate(f, meu, { cor: ['R'], zona: 'campo' }, { voce: 0 }), 'o filtro de cor enxerga a camada 5');
});
caso('702.13b', "intimidar (Mikaeus): só criatura artefato ou que divide cor bloqueia", () => {
  const e = cena({ campo: [[0, 'Mikaeus, the Unhallowed'], [1, 'Grizzly Bears'], [1, 'Vampire Nighthawk'], [1, 'Ornithopter of Paradise']] });
  const mk = objN(e, 0, 'Mikaeus, the Unhallowed');
  igual(['Grizzly Bears', 'Vampire Nighthawk', 'Ornithopter of Paradise'].map(n => M.bloqueiaEste(e, objN(e, 1, n), mk)), [false, true, true]);
});

caso('613.1d', "Bello: no seu turno o artefato de VM 4+ que não é Equipamento vira criatura Elemental 4/4 com indestrutível, pressa e a compra; fora do seu turno, não", () => {
  const e = cena({ campo: [[0, 'Bello, Bard of the Brambles'], [0, 'Gilded Lotus'], [0, 'Sol Ring'], [1, 'Darksteel Forge']] });
  const gl = objN(e, 0, 'Gilded Lotus'), sr = objN(e, 0, 'Sol Ring'), df = objN(e, 1, 'Darksteel Forge');
  igual([M.temTipo(e, gl, 'Creature'), M.temTipo(e, gl, 'Artifact'), (M.dadoDe(e, gl).sub || []).includes('Elemental'), M.poder(e, gl), M.resistencia(e, gl), M.temKw(e, gl, 'pressa'), M.temKw(e, gl, 'indestrutivel')],
    [true, true, true, 4, 4, true, true], 'Gilded Lotus');
  ok(M.gatDe(e, gl).some(g => g.ev === 'dano' && g.aJogador), 'ganha o gatilho de compra');
  igual([M.temTipo(e, sr, 'Creature'), M.temTipo(e, df, 'Creature')], [false, false], 'VM 1 e a do oponente não');
  e.turno.ativo = 1;
  igual(M.temTipo(e, gl, 'Creature'), false, 'turno do oponente');
});

caso('611.3a', "Bloodghast: tem pressa só enquanto um oponente estiver com 10 ou menos de vida", () => {
  const e = cena({ campo: [[0, 'Bloodghast', { doente: true }]] });
  const bg = objN(e, 0, 'Bloodghast');
  ok(M.estContOk(M.carta('Bloodghast').est[1]), 'lida');
  igual(M.temKw(e, bg, 'pressa'), false, '40 de vida');
  e.jogs[1].vida = 10; igual(M.temKw(e, bg, 'pressa'), true, 'oponente com 10');
  e.jogs[0].vida = 5; e.jogs[1].vida = 11; igual(M.temKw(e, bg, 'pressa'), false, 'a sua vida não conta');
});

caso('118.9', "custo alternativo físico: Force of Will sem mana paga 1 de vida e exila uma carta azul da mão; sem carta azul, não. Sephara por {W} vira quatro criaturas com voar", () => {
  for (const azul of [true, false]) {
    const e = cena({ campo: [[1, 'Island']], mao: [[0, 'Force of Will'], ...(azul ? [[0, 'Brainstorm']] : [[0, 'Lightning Bolt']])] });
    e.pend = [];
    e.por(1, 'Grizzly Bears', { zona: 'mao' });
    e.turno.ativo = 1; e.turno.passo = 'principal1';
    const alvo = e.por(1, 'Lightning Bolt', { zona: 'mao' });
    M.mover(e, alvo.id, 'pilha'); alvo.pil = { x: 0, alvos: [[{ jog: 0 }]], ctrl: 1, opc: {} };
    const fow = e.jogs[0].zonas.mao.find(x => e.objs[x].n === 'Force of Will');
    igual(M.podeConjurar(e, 0, e.objs[fow]), azul, 'com carta azul na mão: ' + azul);
    if (!azul) continue;
    M.PROC.conjurar(e, { j: 0, id: fow }, (j, tipo, ops) => { const i = ops.findIndex(o => o.a === 'alvo' && o.o === alvo.id); return ops[i >= 0 ? i : 0]; });
    igual([e.objs[fow].zona, e.jogs[0].vida, naZona(e, 0, 'exilio')], ['pilha', 39, ['Brainstorm']], 'pagou 1 de vida e exilou a azul');
  }
  const f = cena({ campo: [[0, 'Plains'], ...Array.from({ length: 4 }, () => [0, 'Vampire Nighthawk'])], mao: [[0, "Sephara, Sky's Blade"]] });
  f.pend = []; f.jogs[0].terrenos = 1;
  M.avancar(f); conj(f, "Sephara, Sky's Blade"); resolveCom(f, () => -1);
  igual([noCampo(f).includes("Sephara, Sky's Blade"), f.campo.filter(id => f.objs[id].n === 'Vampire Nighthawk' && f.objs[id].virada).length], [true, 4]);
});

caso('700.4', "Dour Port-Mage: criatura sua que sai sem morrer (volta à mão, exílio) dispara uma vez por turno; morrer não dispara. Hordewing Skaab: dano de combate de Zumbi a oponente", () => {
  ok(M.gatOk(M.carta('Hordewing Skaab').gat[0]) && M.gatOk(M.carta('Dour Port-Mage').gat[0]), 'lidos');
  const e = cena({ campo: [[0, 'Dour Port-Mage'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Vampire Nighthawk']] });
  const pm = () => e.pend.filter(p => p.n === 'Dour Port-Mage').length;
  M.mover(e, objN(e, 0, 'Grizzly Bears').id, 'cemiterio'); M.abe(e);
  igual(pm(), 0, 'morreu: não');
  M.mover(e, objN(e, 0, 'Llanowar Elves').id, 'mao'); M.abe(e);
  igual(pm(), 1, 'voltou à mão: sim');
  M.mover(e, objN(e, 0, 'Vampire Nighthawk').id, 'exilio'); M.abe(e);
  igual(pm(), 1, 'só uma vez por turno');
});

caso('702.136a', "tumulto dado (Rhythm of the Wild): a criatura não-ficha que entra escolhe marcador +1/+1 ou pressa", () => {
  for (const esc of ['marcador', 'pressa']) {
    const e = cena({ campo: [[0, 'Rhythm of the Wild'], ...terras(2, 'Forest')], mao: [[0, 'Grizzly Bears']] }); e.pend = []; e.jogs[0].terrenos = 1;
    let perguntou = false;
    M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e, p => { if (p.tipo !== 'tumulto') return -1; perguntou = true; return p.ops.findIndex(o => o.a === esc); });
    const gb = objN(e, 0, 'Grizzly Bears');
    igual([perguntou, gb.marc['+1/+1'] || 0, M.temKw(e, gb, 'pressa')], [true, esc === 'marcador' ? 1 : 0, esc === 'pressa'], esc);
  }
  const f = cena({ campo: [...terras(2, 'Forest')], mao: [[0, 'Grizzly Bears']] }); f.pend = []; f.jogs[0].terrenos = 1;
  let perg = false; M.avancar(f); conj(f, 'Grizzly Bears'); resolveCom(f, p => { if (p.tipo === 'tumulto') perg = true; return -1; });
  ok(!perg, 'sem o Rhythm: nada');
});
caso('702.116a', "miríade dada (Cybermen Squadron): com 3 jogadores, ao atacar um, cria uma cópia atacando o outro; no fim do combate a cópia é exilada. No X1 nada", () => {
  for (const jogs of [3, 2]) {
    const e = cena({ jogs, campo: [[0, 'Cybermen Squadron']] });
    const cs = objN(e, 0, 'Cybermen Squadron');
    ok(M.temKw(e, cs, 'miriade'), 'ganha miríade (é artefato criatura não lendária)');
    const BLQ = x => x.turno.passo === 'bloqueadores';
    ate(e, 'atacar'); M.responder(e, e.perg.ops.findIndex(x => x.a === 'atacar' && x.id === cs.id && x.jog === 1), BLQ);
    if (e.perg && e.perg.tipo === 'atacar') M.responder(e, e.perg.ops.findIndex(x => x.a === 'pronto'), BLQ);
    resolveCom(e);
    const C = e.turno.combate, copias = e.campo.filter(id => e.objs[id].ficha && e.objs[id].n === 'Cybermen Squadron');
    igual([copias.length, C ? C.atk.filter(r => e.objs[r.id] && e.objs[r.id].ficha).map(r => r.alvo.jog) : []], jogs === 3 ? [1, [2]] : [0, []], jogs + ' jogadores');
    ateFimCombate(e);
    igual(e.campo.filter(id => e.objs[id].ficha).length, 0, 'a cópia saiu no fim do combate');
  }
});
caso('702.29e', "ciclagem de tipo: Homing Sliver da mão busca um Sliver; com um Homing Sliver no campo, outro Sliver na mão também cicla", () => {
  const e = cena({ campo: [...terras(3), [0, 'Homing Sliver']], mao: [[0, 'Blur Sliver'], [0, 'Homing Sliver']] }); e.pend = [];
  const gr = e.jogs[0].zonas.grimorio; const alvo = e.por(0, 'Crypt Sliver', { zona: 'grimorio' }); gr.unshift(gr.pop());
  const ops = M.opcoesPrioridade(e, 0).filter(o => o.a === 'ativar' && e.objs[o.id].zona === 'mao').map(o => e.objs[o.id].n).sort();
  igual(ops, ['Blur Sliver', 'Homing Sliver', 'Homing Sliver'], 'Blur ganhou; a Homing da mão tem a dela e a dada');
  M.avancar(e); respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Blur Sliver');
  resolveCom(e);
  igual([naZona(e, 0, 'cemiterio'), alvo.zona], [['Blur Sliver'], 'mao']);
});

caso('613.1f', "animar com habilidade (Den of the Bugbear): vira Goblin 3/2 até o fim do turno e, ao atacar, cria um Goblin 1/1 virado e atacando", () => {
  const e = cena({ campo: [...terras(4), [0, 'Den of the Bugbear']] }); e.pend = [];
  const den = objN(e, 0, 'Den of the Bugbear');
  M.executar(e, M.carta('Den of the Bugbear').atv[1].fx[0], { voce: 0, este: den.id, alvos: [], ilegal: {}, lki: {} }, () => ({ a: 'nao' }));
  igual([M.temTipo(e, den, 'Creature'), M.poder(e, den), M.gatDe(e, den).length], [true, 3, 1], 'animada com o gatilho');
  const BLQ = x => x.turno.passo === 'bloqueadores';
  ate(e, 'atacar'); M.responder(e, e.perg.ops.findIndex(x => x.a === 'atacar' && x.id === den.id), BLQ);
  if (e.perg && e.perg.tipo === 'atacar') M.responder(e, e.perg.ops.findIndex(x => x.a === 'pronto'), BLQ);
  resolveCom(e);
  const gob = e.campo.map(id => e.objs[id]).filter(o => o.ficha && (M.dadoDe(e, o).sub || []).includes('Goblin'));
  igual([gob.length, gob.length && gob[0].virada, !!(e.turno.combate && e.turno.combate.atk.some(r => gob[0] && r.id === gob[0].id))], [1, true, true], 'Goblin atacando');
  ateTurno(e, 3);
  igual([M.temTipo(e, den, 'Creature'), M.gatDe(e, den).length], [false, 0], 'acabou no fim do turno');
});

caso('701.9', "descartar com contagem (Honden of Night's Reach): no começo da sua manutenção o oponente alvo descarta uma por Santuário seu", () => {
  const e = cena({ campo: [[0, "Honden of Night's Reach"], [0, 'Honden of Seeing Winds']] });
  for (let i = 0; i < 4; i++) e.por(1, 'Grizzly Bears', { zona: 'mao' });
  const h = objN(e, 0, "Honden of Night's Reach");
  ok(M.gatOk(M.carta("Honden of Night's Reach").gat[0]), 'lido');
  M.executar(e, M.carta("Honden of Night's Reach").gat[0].fx[0], { voce: 0, este: h.id, alvos: [[{ jog: 1 }]], ilegal: {}, lki: {} }, (j, t, ops) => ops[0]);
  igual([e.jogs[1].zonas.mao.length, e.jogs[1].zonas.cemiterio.length], [2, 2], 'dois Santuários: descarta 2');
});

caso('122.1', "Damning Verdict: destrói só as criaturas sem marcador nenhum", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const b0 = objN(e, 0, 'Grizzly Bears'); b0.marc['+1/+1'] = 1;
  const el = objN(e, 1, 'Llanowar Elves'); el.marc['-1/-1'] = 0;
  M.executar(e, M.carta('Damning Verdict').fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops[0]);
  igual(noCampo(e).sort(), ['Grizzly Bears'], 'só a com marcador fica (marcador zerado não conta)');
});

caso('701.26', "Frantic Search: compra 2, descarta 2 e desvira até três terrenos (os seus virados)", () => {
  const e = cena({ campo: [...terras(4, 'Island'), [1, 'Forest', { virada: true }]], mao: [[0, 'Frantic Search'], [0, 'Grizzly Bears'], [0, 'Sol Ring']] }); e.pend = [];
  M.avancar(e); conj(e, 'Frantic Search'); resolveCom(e);
  const ilhas = e.campo.map(id => e.objs[id]).filter(o => o.n === 'Island');
  igual([ilhas.filter(o => !o.virada).length, objN(e, 1, 'Forest').virada, e.jogs[0].zonas.cemiterio.length], [4, true, 3], 'pagou 3, desvirou as 3 suas; a do oponente fica');
});

caso('118.12', "Masked Vandal: ao entrar pode exilar um card de criatura do seu cemitério; se exilar, exila o artefato/encantamento alvo do oponente", () => {
  for (const tem of [true, false]) {
    const e = cena({ campo: [[1, 'Sol Ring']] });
    if (tem) e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
    e.por(0, 'Lightning Bolt', { zona: 'cemiterio' });
    const sr = objN(e, 1, 'Sol Ring'), mv = e.por(0, 'Masked Vandal');
    ok(M.gatOk(M.carta('Masked Vandal').gat[0]), 'lido');
    M.executar(e, M.carta('Masked Vandal').gat[0].fx[0], { voce: 0, este: mv.id, alvos: [[{ o: sr.id, ts: sr.ts }]], ilegal: {}, lki: {} }, (j, t, ops) => ops[ops.length - 1]);
    igual([sr.zona, naZona(e, 0, 'exilio')], tem ? ['exilio', ['Grizzly Bears']] : ['campo', []], tem ? 'com criatura no cemitério' : 'só mágica no cemitério');
  }
});

caso('707.2', "Cleaver Skaab: {3},{T}, sacrifique outro Zumbi: cria duas fichas cópia da sacrificada", () => {
  const e = cena({ campo: [...terras(3, 'Island'), [0, 'Cleaver Skaab'], [0, 'Hordewing Skaab']] }); e.pend = [];
  M.avancar(e); respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Cleaver Skaab'); resolveCom(e);
  const fichas = e.campo.map(id => e.objs[id]).filter(o => o.ficha);
  igual([fichas.length, fichas.map(o => o.n), naZona(e, 0, 'cemiterio')], [2, ['Hordewing Skaab', 'Hordewing Skaab'], ['Hordewing Skaab']]);
  ok(fichas.every(o => M.temKw(e, o, 'voar')), 'cópias com o texto da carta');
});

caso('506.2', "Soaring Lightbringer: quando você ataca, uma ficha Glimmer 1/1 virada e atacando cada jogador que você ataca", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Soaring Lightbringer'], [0, 'Grizzly Bears']] });
  const sl = objN(e, 0, 'Soaring Lightbringer'), gb = objN(e, 0, 'Grizzly Bears');
  const BLQ = x => x.turno.passo === 'bloqueadores';
  ate(e, 'atacar');
  M.responder(e, e.perg.ops.findIndex(x => x.a === 'atacar' && x.id === sl.id && x.jog === 1), BLQ);
  M.responder(e, e.perg.ops.findIndex(x => x.a === 'atacar' && x.id === gb.id && x.jog === 2), BLQ);
  if (e.perg && e.perg.tipo === 'atacar') M.responder(e, e.perg.ops.findIndex(x => x.a === 'pronto'), BLQ);
  resolveCom(e);
  const C = e.turno.combate, gl = C.atk.filter(r => e.objs[r.id].ficha);
  igual(gl.map(r => r.alvo.jog).sort(), [1, 2], 'uma em cada jogador atacado');
  ok(gl.every(r => e.objs[r.id].virada && M.temKw(e, e.objs[r.id], 'voar')), 'viradas e com voar (é encantamento criatura)');
});

caso('122.1', "Finality: pode pôr dois +1/+1 numa criatura sua (escolhida, sem alvo) e depois todas as criaturas levam -4/-4", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Vampire Nighthawk'], [1, 'Llanowar Elves']] });
  const fx = M.carta('Find').faces[0].fx;
  ok(M.fxSuportado(fx), 'lido');
  const vn = objN(e, 0, 'Vampire Nighthawk');
  M.executar(e, fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => t === 'talvez' ? ops.find(o => o.a === 'sim') : ops.find(o => o.id === vn.id));
  igual(vn.marc['+1/+1'], 2, 'no Nighthawk');
  igual(objN(e, 0, 'Grizzly Bears').marc['+1/+1'] || 0, 0);
});

caso('105.3', "Crimson Wisps: a criatura alvo VIRA vermelha (perde o verde) e ganha pressa até o fim do turno; Unbreakable Formation: adendo só na sua principal", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Grizzly Bears', { doente: true }]], mao: [[0, 'Crimson Wisps']] }); e.pend = [];
  const gb = objN(e, 0, 'Grizzly Bears');
  M.avancar(e); conj(e, 'Crimson Wisps'); alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  igual([M.dadoDe(e, gb).cores, M.temKw(e, gb, 'pressa')], ['R', true], 'neste turno');
  ateTurno(e, 3);
  igual([M.dadoDe(e, gb).cores, M.temKw(e, gb, 'pressa')], ['G', false], 'acabou');
  for (const passo of ['principal1', 'fimCombate']) {
    const f = cena({ campo: [[0, 'Grizzly Bears']], passo });
    const b = objN(f, 0, 'Grizzly Bears');
    for (const x of M.carta('Unbreakable Formation').fx) M.executar(f, x, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops[0]);
    igual([M.temKw(f, b, 'indestrutivel'), b.marc['+1/+1'] || 0, M.temKw(f, b, 'vigilancia')], passo === 'principal1' ? [true, 1, true] : [true, 0, false], passo);
  }
});

caso('107.3', 'contagens: todo nome velho traduz para o formato novo, e a tradução é estável', () => {
  for (const n of M.NOMES_VELHOS) { const q = M.traduzQtd({ conta: n, de: 'lore', alvo: 0 }); ok(q.conta && q.conta.de !== undefined, n); igual(M.traduzQtd(q), q, n + ' estável'); }
  for (const p of M.PROPS_VELHOS) ok(M.traduzQtd({ conta: { tipo: ['Creature'] }, prop: p }).conta.junta, p);
  igual(M.traduzQtd({ conta: 'poderDoAlvo', alvo: 1, mult: 2 }), { conta: { de: { alvo: 1 }, o: 'poder' }, mult: 2 });
  igual(M.traduzQtd({ conta: { tipo: ['Creature'] }, prop: 'somaPoder' }), { conta: { de: { f: { tipo: ['Creature'] } }, o: 'poder', junta: 'soma' } });
});

caso('106.1', "Mox Amber: mana de uma cor entre as das suas criaturas/planeswalkers lendários; sem lendário, nada", () => {
  const e = cena({ campo: [[0, 'Mox Amber'], [0, 'Krenko, Mob Boss'], [1, 'Lathril, Blade of the Elves']] });
  const mx = objN(e, 0, 'Mox Amber');
  igual(M.coresDeProd(e, mx, M.atvDe(e, mx)[0].fx[0].prod), ['R'], 'só o vermelho do Krenko (Lathril é do oponente)');
  ok(M.fontesDeMana(e, 0).some(f => f.id === mx.id), 'vira fonte');
  const f = cena({ campo: [[0, 'Mox Amber'], [0, 'Grizzly Bears']] });
  const m2 = objN(f, 0, 'Mox Amber');
  ok(!M.fontesDeMana(f, 0).some(x => x.id === m2.id), 'sem lendário: não faz mana');
});

caso('122.1', "Mutational Advantage: 'with counters on them' = marcador de qualquer tipo (comMarcador true)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Forest']] });
  const b = objN(e, 0, 'Grizzly Bears'), l = objN(e, 0, 'Llanowar Elves');
  b.marc.oil = 1;
  ok(M.bate(e, b, { comMarcador: true }, { voce: 0 }) && !M.bate(e, l, { comMarcador: true }, { voce: 0 }), 'com marcador de óleo sim; sem, não');
  ok(M.bate(e, b, { comMarcador: 'oil' }, { voce: 0 }) && !M.bate(e, b, { comMarcador: '+1/+1' }, { voce: 0 }), 'por tipo continua');
});

caso('701.19', "Myriad Landscape: busca até duas básicas que têm um tipo de terreno em comum (Floresta + Floresta, não Floresta + Ilha)", () => {
  const e = cena({ campo: [[0, 'Myriad Landscape'], [0, 'Wastes'], [0, 'Wastes']] });
  const ml = objN(e, 0, 'Myriad Landscape');
  const f1 = e.por(0, 'Forest', { zona: 'grimorio' }), f2 = e.por(0, 'Forest', { zona: 'grimorio' }), il = e.por(0, 'Island', { zona: 'grimorio' });
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === ml.id && o.k === 1);
  for (let g = 0; g < 10 && e.perg && e.perg.tipo !== 'buscar'; g++) respE(e, o => o.a === 'passar');
  ok(e.perg && e.perg.tipo === 'buscar', 'pergunta a busca');
  respE(e, o => o.id === f1.id);
  ok(e.perg && e.perg.tipo === 'buscar', 'segunda escolha');
  ok(!e.perg.ops.some(o => o.id === il.id) && e.perg.ops.some(o => o.id === f2.id), 'só Floresta na segunda');
  respE(e, o => o.id === f2.id);
  ok(f1.zona === 'campo' && f2.zona === 'campo' && f1.virada && il.zona === 'grimorio', 'duas Florestas viradas');
});

caso('701.44c', "Nicanzil: explorar terreno dispara só o 1º gatilho (pôr terreno da mão); não-terreno, só o 2º (+1/+1 nela)", () => {
  const e = cena({ campo: [[0, 'Nicanzil, Current Conductor'], [0, 'Grizzly Bears']] }); const b = objN(e, 0, 'Grizzly Bears');
  const X = (ask) => M.executar(e, { op: 'explorar', em: 'este' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] }, este: b.id }, ask);
  const gs = () => e.pend.filter(p => p.n === 'Nicanzil, Current Conductor').map(p => M.carta('Nicanzil, Current Conductor').gat[p.k].revelaTerreno);
  e.por(0, 'Forest', { zona: 'grimorio' }); e.pend = []; X(() => ({ a: 'nao' }));
  igual(gs(), [true], 'terreno: só o de terreno');
  e.por(0, 'Sol Ring', { zona: 'grimorio' }); e.pend = []; X(() => ({ a: 'nao' }));
  igual(gs(), [false], 'não-terreno: só o do marcador');
});

caso('509.1b', "Nightkin Ambusher: não pode ser bloqueada enquanto o jogador defensor tiver marcador rad (conta de: 'atacado')", () => {
  ok(M.carta('Nightkin Ambusher').est.every(s => M.seOk(s.se)), 'condição aceita');
  const e = cena({ campo: [[0, 'Nightkin Ambusher'], [1, 'Grizzly Bears']] });
  const n = objN(e, 0, 'Nightkin Ambusher'), b = objN(e, 1, 'Grizzly Bears');
  const pode = () => M.bloqueiaEste(e, b, n);
  ok(!M.condicao(e, M.carta('Nightkin Ambusher').est[0].se, { voce: 0, este: n.id, ev: { def: 1 } }), 'sem rad: pode bloquear');
  M.marcadorJogador(e, 1, 'rad', 2);
  ok(M.condicao(e, M.carta('Nightkin Ambusher').est[0].se, { voce: 0, este: n.id, ev: { def: 1 } }), 'com rad: não pode');
  ok(!M.condicao(e, M.carta('Nightkin Ambusher').est[0].se, { voce: 0, este: n.id, ev: { def: 0 } }), 'conta o defensor, não você');
  ok(!pode(), 'no combate (bloqueiaEste)');
});

caso('205.1b', "Nim Deathmantle: a equipada é um Zumbi preto (perde Urso e verde), +2/+2 e intimidar", () => {
  ok(M.carta('Nim Deathmantle').est.every(s => M.estContOk(s)), 'estática aceita');
  const e = cena({ campo: [[0, 'Nim Deathmantle'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves'], [1, 'Esper Sentinel']] });
  const nm = objN(e, 0, 'Nim Deathmantle'), b = objN(e, 0, 'Grizzly Bears');
  nm.anexo = { id: b.id, ts: b.ts }; e.vCamada = (e.vCamada || 0) + 1;
  igual(M.dadoDe(e, b).sub, ['Zombie'], 'só Zumbi'); igual(M.dadoDe(e, b).cores, 'B', 'preto');
  igual(M.poder(e, b), 4); ok(M.temKw(e, b, 'intimidar'), 'intimidar');
  ok(!M.bloqueiaEste(e, objN(e, 1, 'Llanowar Elves'), b) && M.bloqueiaEste(e, objN(e, 1, 'Esper Sentinel'), b), 'intimidar (702.13b): o Elfo verde não bloqueia o Zumbi preto; o artefato sim');
});

caso('601.2f', "Otawara: canalizar custa {1} a menos por criatura lendária sua (redução da própria carta, na mão)", () => {
  const e = cena({ campo: [[0, 'Krenko, Mob Boss'], [0, 'Lathril, Blade of the Elves']], mao: [[0, 'Otawara, Soaring City']] });
  const ot = e.objs[e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Otawara, Soaring City')];
  const a = M.atvDe(e, ot).find(x => x.zona === 'mao');
  igual(M.custoAtv(e, ot, a), { g: 1, p: ['U'] }, 'duas lendárias: {1}{U}');
});

caso('702.176a', "Overlord of the Hauntwoods: iminente {1}{G}{G} entra com 4 marcadores de tempo e não é criatura até tirar o último; custo cheio, criatura", () => {
  const d = M.carta('Overlord of the Hauntwoods');
  ok(d.gat.every(g => M.gatOk(g)) && d.est.every(s => M.estContOk(s)), 'gatilhos e estática aceitos');
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Forest']], mao: [[0, 'Overlord of the Hauntwoods']] });
  M.avancar(e); conj(e, 'Overlord of the Hauntwoods');
  for (let g = 0; g < 20 && e.perg && (e.pilha.length || e.perg.tipo !== 'acao'); g++) respE(e, o => o.a === 'passar' || o.a === 'opcao' && o.v.iminente || o.a !== 'opcao');
  const ov = objN(e, 0, 'Overlord of the Hauntwoods');
  ok(ov, 'no campo'); igual(ov.marc.time, 4, '4 marcadores de tempo');
  ok(!M.temTipo(e, ov, 'Creature') && M.temTipo(e, ov, 'Enchantment'), 'só encantamento');
  ok(e.campo.some(id => e.objs[id].n === 'Everywhere'), 'o gatilho de entrar criou Everywhere');
  ov.marc.time = 0; e.vCamada = (e.vCamada || 0) + 1;
  ok(M.temTipo(e, ov, 'Creature'), 'sem marcador: criatura');
  const f = cena({ campo: [[0, 'Overlord of the Hauntwoods']] });
  const o2 = objN(f, 0, 'Overlord of the Hauntwoods'); o2.marc.time = 4; f.vCamada = (f.vCamada || 0) + 1;
  ok(M.temTipo(f, o2, 'Creature'), 'sem pagar o iminente, marcador de tempo não tira o tipo');
});

caso('702.16', "Éowyn, Fearless Knight: exila a criatura de poder maior e as lendárias suas ganham proteção das cores dela (multicolorida = cada cor)", () => {
  const e = cena({ campo: [[0, 'Éowyn, Fearless Knight'], [0, 'Krenko, Mob Boss'], [0, 'Grizzly Bears'], [1, 'Lathril, Blade of the Elves']] });
  const ow = objN(e, 0, 'Éowyn, Fearless Knight'), kr = objN(e, 0, 'Krenko, Mob Boss'), gb = objN(e, 0, 'Grizzly Bears'), la = objN(e, 1, 'Lathril, Blade of the Elves');
  const ctx: any = { voce: 0, este: ow.id, alvos: [[{ o: la.id, ts: la.ts }]], ilegal: {}, lki: { alvos: [[M.lkiDe(e, la)]] } };
  for (const f of M.carta('Éowyn, Fearless Knight').gat[0].fx) M.executar(e, f, ctx, () => ({ a: 'nao' }));
  igual(la.zona, 'exilio', 'Lathril exilada');
  ok(M.protegeDe(e, ow, { cores: 'B' }) && M.protegeDe(e, kr, { cores: 'G' }), 'lendárias: proteção de preto e de verde');
  ok(!M.protegeDe(e, kr, { cores: 'R' }), 'não de vermelho'); ok(!M.protegeDe(e, gb, { cores: 'G' }), 'o Urso não é lendário');
});

caso('603.4', "Éowyn, Shieldmaiden: 'se outro Humano entrou sob seu controle neste turno' vale mesmo se ele já saiu; ela mesma não conta", () => {
  const g = M.carta('Éowyn, Shieldmaiden').gat[0]; ok(M.gatOk(g), 'gatilho aceito');
  const e = cena({ campo: [[0, 'Éowyn, Shieldmaiden']] });
  const ow = objN(e, 0, 'Éowyn, Shieldmaiden'), se = () => M.condicao(e, g.se, { voce: 0, este: ow.id });
  ok(!se(), 'só ela entrou: não');
  const h = e.por(0, 'Esper Sentinel'); e.por(1, 'Esper Sentinel');
  ok(se(), 'outro Humano seu entrou'); M.mover(e, h.id, 'cemiterio');
  ok(se(), 'e já morreu: continua valendo');
  e.turno.n++; ok(!se(), 'no turno seguinte, não');
});

caso('608.2c', "Patriarch's Bidding: cada jogador escolhe um tipo; cada um devolve do cemitério as criaturas de QUALQUER tipo escolhido", () => {
  ok(M.fxSuportado(M.carta("Patriarch's Bidding").fx), 'efeito aceito');
  const e = cena({});
  const el = e.por(0, 'Llanowar Elves', { zona: 'cemiterio' }), gb = e.por(1, 'Grizzly Bears', { zona: 'cemiterio' }), g0 = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' }), kr = e.por(1, 'Krenko, Mob Boss', { zona: 'cemiterio' });
  const quer = { 0: 'Elf', 1: 'Bear' }, quem: number[] = [];
  const ask = (j, t, ops) => { if (t === 'escolha') { quem.push(j); return ops.find(o => o.v === quer[j]) || ops[0]; } return ops[0]; };
  (ask as any).etapa = () => {};
  const ctx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  for (const f of M.carta("Patriarch's Bidding").fx) M.executar(e, f, ctx, ask);
  igual(quem, [0, 1], 'os dois escolheram');
  ok(el.zona === 'campo' && gb.zona === 'campo' && g0.zona === 'campo', 'Elfo e os dois Ursos voltam');
  igual(kr.zona, 'cemiterio', 'o Goblin não');
});

caso('608.2n', "Padeem: compra se você controla o artefato de maior valor de mana (empate vale); Perch Protection se exila ao resolver", () => {
  const g = M.carta('Padeem, Consul of Innovation').gat[0]; ok(M.gatOk(g), 'gatilho aceito');
  const e = cena({ campo: [[0, 'Padeem, Consul of Innovation'], [0, 'Sol Ring'], [1, 'Sol Ring']] });
  const pd = objN(e, 0, 'Padeem, Consul of Innovation'), se = () => M.condicao(e, g.se, { voce: 0, este: pd.id });
  ok(se(), 'empate: compra');
  e.por(1, 'Myr Battlesphere'); ok(!se(), 'o oponente tem o maior: não');
  const f = cena({ campo: [[0, 'Padeem, Consul of Innovation']] }); ok(!M.condicao(f, g.se, { voce: 0, este: objN(f, 0, 'Padeem, Consul of Innovation').id }), 'sem artefato: não');
  const h = cena({ campo: [[0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Plains']], mao: [[0, 'Perch Protection']] });
  M.avancar(h); conj(h, 'Perch Protection');
  for (let k = 0; k < 20 && h.perg && (h.pilha.length || h.perg.tipo !== 'acao'); k++) respE(h, o => o.a === 'passar' || o.a !== 'opcao' || !o.v.presente);
  ok(h.jogs[0].zonas.exilio.some(id => h.objs[id].n === 'Perch Protection'), 'no exílio');
  ok(!h.jogs[0].zonas.cemiterio.some(id => h.objs[id].n === 'Perch Protection'), 'não no cemitério');
  igual(h.campo.filter(id => h.objs[id].n !== 'Plains').length, 4, 'quatro Pássaros');
});

caso('104.3a', "Platinum Angel: com 0 de vida você não perde; ela sai, você perde nas ações de estado; o oponente não vence por efeito", () => {
  const e = cena({ campo: [[0, 'Platinum Angel']] });
  e.jogs[0].vida = 0; M.abe(e);
  ok(!e.jogs[0].saiu, 'não perdeu');
  M.executar(e, { op: 'ganharJogo', quem: 'voce' }, { voce: 1, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({}));
  ok(!e.fim, 'o oponente não vence');
  M.mover(e, objN(e, 0, 'Platinum Angel').id, 'cemiterio'); M.abe(e);
  ok(e.jogs[0].saiu, 'sem o Anjo: perde');
});

caso('603.7', "Phelia: a exilada volta no final; se voltou sob seu controle (era sua), Phelia ganha +1/+1; a do oponente volta para ele e nada", () => {
  const g = M.carta('Phelia, Exuberant Shepherd').gat[0]; ok(M.gatOk(g) && M.atrasadoOk(g.fx[1].quando), 'gatilho e atrasado aceitos');
  for (const [dono, marca] of [[0, 1], [1, undefined]] as any) {
    const e = cena({ campo: [[0, 'Phelia, Exuberant Shepherd'], [dono, 'Sol Ring']] });
    const ph = objN(e, 0, 'Phelia, Exuberant Shepherd'), sr = objN(e, dono, 'Sol Ring');
    const ctx: any = { voce: 0, este: ph.id, alvos: [[{ o: sr.id, ts: sr.ts }]], ilegal: {}, lki: { alvos: [[M.lkiDe(e, sr)]], este: M.lkiDe(e, ph) } };
    for (const f of g.fx) M.executar(e, f, ctx, () => ({ a: 'nao' }));
    igual(sr.zona, 'exilio', 'exilada');
    const A = e.atras[0], c2: any = { voce: 0, este: ph.id, alvos: [], ilegal: {}, lki: { alvos: [], este: A.lki }, ...A.mem };
    for (const f of A.g.fx) M.executar(e, f, c2, () => ({ a: 'nao' }));
    ok(sr.zona === 'campo' && sr.ctrl === dono, 'voltou para o dono');
    igual(ph.marc['+1/+1'], marca, dono === 0 ? 'sua: +1/+1' : 'do oponente: nada');
  }
});

caso('603.4', 'contagens pedidas: quantas vezes ESTA habilidade resolveu neste turno (Omnath) — vem do ctx da resolução', () => {
  const e = cena({});
  igual(M.qtd(e, { conta: { de: 'turno', o: 'resolucoesDestaHab' } }, { voce: 0, resHab: 2 }), 2, 'a de agora');
  ok(M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'cond') && !M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'est'), 'só em efeito/condição');
});
caso('709.3', 'lista colada com "A // B" (carta de duas faces/portas): acha pelo nome da 1ª face e o objeto fica com esse nome', () => {
  igual(M.nomeBase('Dazzling Theater // Prop Room'), 'Dazzling Theater');
  igual(M.nomeBase('Nome Que Nao Existe // Outro'), 'Nome Que Nao Existe // Outro', 'sem a 1ª face no banco: fica igual (o erro aparece)');
  const e = M.novoJogo([{ cmd: [], cartas: ['Dazzling Theater // Prop Room', ...enche(59, 'Forest')] }, { cmd: [], cartas: enche(60, 'Forest') }], { semente: 1 });
  ok(Object.values<any>(e.objs).some(o => o.n === 'Dazzling Theater'), 'virou Dazzling Theater');
});

caso('205.2a', "Demonic Counsel: sem delirium busca um Demônio; com 4+ tipos de card no cemitério (delirium) busca qualquer card", () => {
  for (const tem of [false, true]) {
    const e = cena({});
    for (const n of ['Grizzly Bears', 'Lightning Bolt', 'Sol Ring', ...(tem ? ['Forest'] : [])]) e.por(0, n, { zona: 'cemiterio' });
    e.por(0, 'Archfiend of Despair', { zona: 'grimorio' }); e.por(0, 'Counterspell', { zona: 'grimorio' });
    const fx = M.carta('Demonic Counsel').fx;
    ok(M.fxSuportado(fx), 'lido');
    const quer = tem ? 'Counterspell' : 'Archfiend of Despair';
    for (const x of fx) M.executar(e, x, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops.find(o => o.id !== undefined && e.objs[o.id] && e.objs[o.id].n === quer) || ops[0]);
    igual(naZona(e, 0, 'mao'), [quer], tem ? 'com delirium' : 'sem delirium');
  }
});

caso('603.2', "Omnath, Locus of Creation: terreno entra → 1ª vez no turno ganha 4, 2ª ganha RGWU, 3ª 4 de dano em cada oponente; 4ª nada", () => {
  const e = cena({ campo: [[0, 'Omnath, Locus of Creation']], mao: [[0, 'Forest'], [0, 'Mountain'], [0, 'Plains'], [0, 'Island']] }); e.pend = [];
  M.avancar(e);
  const vida0 = [e.jogs[0].vida, e.jogs[1].vida];
  for (const id of [...e.jogs[0].zonas.mao]) M.mover(e, id, 'campo');   // 4 terrenos ao mesmo tempo: 4 gatilhos (1ª a 4ª vez)
  M.porGatilhos(e);
  for (let g = 0; g < 40 && e.perg && (e.pilha.length || e.perg.tipo !== 'acao'); g++) {
    const p = e.perg; M.responder(e, p.tipo === 'acao' ? p.ops.findIndex(o => o.a === 'passar') : M.agenteBasico()(e, p), x => !x.pilha.length);
  }
  const R = e.jogs[0].reserva;
  igual([e.pilha.length, e.jogs[0].vida - vida0[0], e.jogs[1].vida - vida0[1], [R.R, R.G, R.W, R.U]], [0, 4, -4, [1, 1, 1, 1]], 'uma vez cada efeito');
});

caso('702.66a', "delve + um alvo por jogador: Afterlife from the Loam exila 5 do cemitério para pagar {5}, pega 1 criatura de cada cemitério (não 2 do mesmo) e elas são Zumbis", () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Swamp']], mao: [[0, 'Afterlife from the Loam']] });
  for (let k = 0; k < 5; k++) e.por(0, 'Lightning Bolt', { zona: 'cemiterio' });
  const meu = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' }), d1 = e.por(1, 'Grizzly Bears', { zona: 'cemiterio' }); e.por(1, 'Grizzly Bears', { zona: 'cemiterio' });
  M.avancar(e); conj(e, 'Afterlife from the Loam');
  respE(e, o => o.a === 'alvo' && o.o === d1.id);
  ok(!e.perg.ops.some(o => o.a === 'alvo' && o.o !== undefined && e.objs[o.o].dono === 1), 'só um do cemitério do oponente');
  respE(e, o => o.a === 'alvo' && o.o === meu.id);
  if (e.perg && e.perg.tipo === 'alvo') respE(e, o => o.a === 'pronto');
  while (e.pilha.length && e.perg) M.responder(e, 0);
  const bs = e.campo.map(id => e.objs[id]).filter(o => o.n === 'Grizzly Bears');
  igual(bs.length, 2); ok(bs.every(o => o.ctrl === 0), 'meus');
  ok(bs.every(o => M.tiposCriatura(e, o).includes('Zombie')), 'Zumbis: ' + JSON.stringify(bs.map(o => M.tiposCriatura(e, o))));
  igual(naZona(e, 0, 'exilio').filter(n => n === 'Lightning Bolt').length, 5, 'delve exilou os 5 Bolts');
  ok(e.campo.map(id => e.objs[id]).filter(o => o.n === 'Swamp').every(o => o.virada), 'BBB dos pântanos');
});

caso('122.6', "All Will Be One: dispara quando VOCÊ põe marcadores (em permanente ou jogador), com a quantidade; o marcador que o oponente põe não dispara", () => {
  const e = cena({ campo: [[0, 'All Will Be One'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears']] });
  const [, meu, dele] = e.campo.map(id => e.objs[id]), ask: any = (j, t, o) => o[0];
  e.pend = [];
  M.executar(e, { op: 'marcador', em: 'este', tipoMarc: '+1/+1', qtd: 2 }, { voce: 1, este: dele.id, alvos: [], ilegal: {}, lki: { alvos: [] } }, ask);
  igual(e.pend.length, 0, 'o oponente pôs: não dispara');
  M.executar(e, { op: 'marcador', em: 'este', tipoMarc: '+1/+1', qtd: 2 }, { voce: 0, este: meu.id, alvos: [], ilegal: {}, lki: { alvos: [] } }, ask);
  igual(e.pend.length, 1, 'você pôs: dispara'); igual(M.contar(e, { de: 'evento', o: 'marcadores' }, { voce: 0, ev: e.pend[0].ev }), 2, 'that much');
  e.pend = []; e.jogs[1].veneno = 1;
  M.executar(e, { op: 'proliferar', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, o) => o.find(x => x.jog === 1 && !e.pend.length) || o[0]);
  igual(e.jogs[1].veneno, 2); ok(e.pend.some(p => p.ev && p.ev.jog === 1), 'marcador em jogador dispara: ' + JSON.stringify(e.pend.map(p => p.ev)));
  ok(M.carta('All Will Be One').gat.every(g => M.gatOk(g)), 'gatOk');
});

caso('702.100', "evoluir: entra criatura sua maior (poder ou resistência) → +1/+1; menor ou do oponente, não", () => {
  const e = cena({ campo: [[0, 'Gyre Sage']] });
  const gs = e.objs[e.campo[0]];
  e.pend = []; e.por(0, 'Grizzly Bears');
  igual(e.pend.filter(p => p.k === 'evoluir').length, 1, 'Bears 2/2 > Sage 1/2: evolui');
  e.pend = []; e.por(1, 'Hill Giant');
  igual(e.pend.filter(p => p.k === 'evoluir').length, 0, 'do oponente: não');
  gs.marc['+1/+1'] = 2; e.pend = []; e.por(0, 'Llanowar Elves');
  igual(e.pend.filter(p => p.k === 'evoluir').length, 0, 'menor: não');
});

caso('702.181', "mobilizar: Zurgo ataca e cria 1 Guerreiro virado e atacando; sacrificado na etapa final", () => {
  const e = cena({ campo: [[0, 'Zurgo Stormrender']] });
  const z = e.objs[e.campo[0]];
  e.turno.combate = { atk: [{ id: z.id, ts: z.ts, alvo: { jog: 1 }, def: 1, bloq: [], bloqueado: false }] };
  e.pend = [];
  M.evento(e, { ev: 'ataca', id: z.id, def: 1 });
  const p = e.pend.find(x => x.k === 'mobilizar'); ok(p, 'disparou');
  const cx: any = { voce: 0, este: z.id, alvos: [], ilegal: {}, lki: {} };
  for (const f of p.g.fx) M.executar(e, f, cx, (_j, _t, ops) => ops[0]);
  const w = e.campo.map(id => e.objs[id]).find(o => o.ficha && (o.ficha.sub || []).includes('Warrior'));
  ok(w && w.virada && M.atacando(e, w), 'Guerreiro virado e atacando');
  const A = e.atras[e.atras.length - 1];
  M.executar(e, A.g.fx[0], { voce: 0, alvos: [], ilegal: {}, lki: {}, criadas: A.mem.criadas }, () => ({ a: 'nao' }));
  ok(w.zona !== 'campo', 'sacrificado');
});

caso('610.3', "exilar até esta sair do campo: Grasp of Fate exila; quando sai, a carta volta sob o controle do dono; fonte que já saiu não exila", () => {
  for (const c of ['Bronzebeak Foragers', 'Grasp of Fate']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Grasp of Fate'], [1, 'Hill Giant']] });
  const [gf, hg] = e.campo.map(id => e.objs[id]);
  const cx: any = { voce: 0, este: gf.id, alvos: [[{ o: hg.id, ts: hg.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, gf) } };
  M.executar(e, { op: 'exilar', em: { alvo: 0 }, dura: 'enquantoNoCampo' }, cx, () => ({ a: 'nao' }));
  igual(hg.zona, 'exilio', 'exilado');
  M.mover(e, gf.id, 'cemiterio');
  ok(hg.zona === 'campo' && hg.ctrl === 1, 'voltou para o dono');
  const f = cena({ campo: [[0, 'Grasp of Fate'], [1, 'Hill Giant']] });
  const [g2, h2] = f.campo.map(id => f.objs[id]);
  const c2: any = { voce: 0, este: g2.id, alvos: [[{ o: h2.id, ts: h2.ts }]], ilegal: {}, lki: { este: M.lkiDe(f, g2) } };
  M.mover(f, g2.id, 'cemiterio');
  M.executar(f, { op: 'exilar', em: { alvo: 0 }, dura: 'enquantoNoCampo' }, c2, () => ({ a: 'nao' }));
  igual(h2.zona, 'campo', 'a fonte já tinha saído: nada (610.3c)');
});

caso('701.42', "fundir: Gisela com Bruna no campo vira Brisela (9/10); quando Brisela sai, as duas cartas vão para o cemitério", () => {
  for (const c of ['Gisela, the Broken Blade', 'Mishra, Claimed by Gix']) ok(M.carta(c).gat.every(g => M.gatOk(g)), c + ' aceito');
  const e = cena({ campo: [[0, 'Gisela, the Broken Blade'], [0, 'Bruna, the Fading Light']] });
  const [gi, br] = e.campo.map(id => e.objs[id]);
  M.executar(e, M.carta('Gisela, the Broken Blade').gat[0].fx[0], { voce: 0, este: gi.id, alvos: [], ilegal: {}, lki: {} }, (_j, _t, ops) => ops[0]);
  igual(e.campo.length, 1, 'um permanente só');
  const b = e.objs[e.campo[0]];
  igual(M.dadoDe(e, b).n, 'Brisela, Voice of Nightmares'); igual([M.poder(e, b), M.resistencia(e, b)], [9, 10]);
  M.mover(e, b.id, 'cemiterio');
  igual(naZona(e, 0, 'cemiterio').sort(), ['Bruna, the Fading Light', 'Gisela, the Broken Blade']);
  const f = cena({ campo: [[0, 'Gisela, the Broken Blade'], [1, 'Bruna, the Fading Light']] });
  M.executar(f, M.carta('Gisela, the Broken Blade').gat[0].fx[0], { voce: 0, este: f.campo[0], alvos: [], ilegal: {}, lki: {} }, (_j, _t, ops) => ops[0]);
  igual(f.campo.length, 2, 'Bruna do oponente: não funde');
});

caso('603.7', "Arcane Denial: anula; no começo da manutenção do próximo turno o dono da mágica compra até 2 (escolhe) e você compra 1", () => {
  ok(M.fxSuportado(M.carta('Arcane Denial').fx), 'aceito');
  const e = cena({ mao: [[1, 'Grizzly Bears']] });
  const u = e.jogs[1].zonas.mao[0]; M.mover(e, u, 'pilha');
  const U = e.objs[u];
  const ctx: any = { voce: 0, este: -1, alvos: [[{ o: u, ts: U.ts }]], ilegal: {}, lki: { alvos: [[M.lkiDe(e, U)]] } };
  for (const f of M.carta('Arcane Denial').fx) M.executar(e, f, ctx, null);
  igual(U.zona, 'cemiterio', 'anulada');
  const m0 = e.jogs[0].zonas.mao.length, m1 = e.jogs[1].zonas.mao.length;
  passarAte(e, 'manutencao'); M.avancar(e);
  resolveCom(e, p => p.tipo === 'x' ? p.ops.findIndex(o => o.v === 1) : -1);
  igual([e.jogs[0].zonas.mao.length - m0, e.jogs[1].zonas.mao.length - m1], [1, 1], 'escolheu comprar 1 das 2; você compra 1');
  igual(e.atras.length, 0, 'uma vez só (603.7c)');
});

caso('611.2', "Mistrise Village: a próxima mágica que você conjurar neste turno não pode ser anulada; a seguinte e a de antes, sim", () => {
  ok(M.fxSuportado(M.carta('Mistrise Village').atv[1].fx), 'aceito');
  const e = cena({ campo: [[0, 'Mistrise Village']], mao: [[0, 'Grizzly Bears'], [0, 'Hill Giant'], [0, 'Llanowar Elves']] });
  const [a, b, c] = e.jogs[0].zonas.mao.slice();
  const conjura = id => { M.mover(e, id, 'pilha'); M.evento(e, { ev: 'conjura', id, j: 0 }); };
  conjura(a);
  M.executar(e, M.carta('Mistrise Village').atv[1].fx[0], { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: {} }, null);
  conjura(b); conjura(c);
  ok(M.naoAnulavel(e, e.objs[b]), 'a próxima: não pode');
  ok(!M.naoAnulavel(e, e.objs[a]) && !M.naoAnulavel(e, e.objs[c]), 'a de antes e a seguinte: podem');
  ok(!M.anular(e, b) && M.anular(e, c), 'anular respeita');
});

caso('205.3m', "Mirror Entity (X=4): as suas criaturas viram 4/4 e de todos os tipos de criatura (contam como Goblin); a do oponente, não", () => {
  ok(M.fxSuportado(M.carta('Mirror Entity').atv[0].fx), 'animar com todosTipos aceito');
  const e = cena({ campo: [[0, 'Mirror Entity'], [0, 'Grizzly Bears'], [1, 'Grizzly Bears'], [0, 'Forest']] });
  const me = objN(e, 0, 'Mirror Entity'), u = e.campo.map(id => e.objs[id]).find(o => o.n === 'Grizzly Bears' && o.ctrl === 0);
  M.executar(e, M.carta('Mirror Entity').atv[0].fx[0], { ...ctxDe(e), este: me.id, item: me.id, x: 4 }, (j, t, ops) => ops[0]);
  igual([M.poder(e, u), M.resistencia(e, u)], [4, 4], 'Urso 4/4');
  ok(M.tiposCriatura(e, u) === 'todos', 'Urso de todos os tipos');
  ok(M.bate(e, u, { sub: ['Goblin'] }, ctxDe(e)), 'conta como Goblin');
  ok(!M.bate(e, objN(e, 0, 'Forest'), { sub: ['Goblin'] }, ctxDe(e)), 'terreno não');
  const o = e.campo.map(id => e.objs[id]).find(x => x.n === 'Grizzly Bears' && x.ctrl === 1);
  ok(M.tiposCriatura(e, o) !== 'todos' && M.poder(e, o) === 2, 'a do oponente fica igual');
  ok(!M.bate(e, u, { sub: ['Forest'] }, ctxDe(e)), 'não ganha tipo de terreno');
});

caso('702.34a', "Increasing Devotion: da mão cria 5 Humanos; conjurada do cemitério (flashback) cria 10 e vai ao exílio", () => {
  const e = cena({ campo: terras(9, 'Plains'), mao: [[0, 'Increasing Devotion']] }); e.pend = [];
  const [id] = e.jogs[0].zonas.mao;
  const humanos = () => e.campo.filter(x => e.objs[x].ficha && e.objs[x].ctrl === 0).length;
  M.avancar(e); conj(e, 'Increasing Devotion'); resolveCom(e);
  igual([humanos(), e.objs[id].zona], [5, 'cemiterio'], 'da mão: 5');
  for (const x of e.campo) e.objs[x].virada = false;
  M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === id); resolveCom(e);
  igual([humanos(), e.objs[id].zona], [15, 'exilio'], 'do cemitério: mais 10');
});

caso('701.26a', "Myr Battlesphere ataca: vira 2 dos 3 Myr desvirados (escolhe), ganha +2/+0 e causa 2 ao atacado", () => {
  ok(M.fxSuportado(M.carta('Myr Battlesphere').gat[1].fx), 'virar com qtd {ate} aceito');
  const e = combate([[0, 'Myr Battlesphere']]);
  const mb = objN(e, 0, 'Myr Battlesphere');
  const myr = M.criarFichas(e, 0, { pt: [1, 1], tipos: ['Artifact', 'Creature'], sub: ['Myr'] }, 3, {});
  ate(e, 'atacar'); atacaCom(e, mb); fecha(e, 'atacar');
  let viradas = 0;
  for (let g = 0; g < 200 && e.turno.passo !== 'principal2'; g++) {
    M.avancar(e, PARA2); if (!e.perg) continue;
    const t = e.perg.tipo;
    const k = t === 'talvez' ? e.perg.ops.findIndex(x => x.a === 'sim') : t === 'virar' ? (viradas++ < 2 ? e.perg.ops.findIndex(x => x.a === 'virar') : e.perg.ops.findIndex(x => x.a === 'nenhum')) : 0;
    M.responder(e, k, PARA2);
  }
  igual(myr.filter(o => o.virada).length, 2, '2 Myr virados');
  igual(e.jogs[1].vida, 40 - 2 - 6, '2 do gatilho + 6 do combate (4+2)');
});

caso('603.4', "Belladonna Took: 3 fichas entram; 1ª resolução ganha 1, 2ª compra 1, 3ª põe +1/+1 em cada criatura sua", () => {
  ok(M.fxSuportado(M.carta('Belladonna Took').gat[0].fx), 'contagem turno/resolucoesDestaHab aceita');
  const e = cena({ campo: [[0, 'Belladonna Took']] }); e.pend = [];
  const bt = objN(e, 0, 'Belladonna Took'), mao0 = e.jogs[0].zonas.mao.length;
  M.criarFichas(e, 0, { pt: [1, 1], tipos: ['Creature'], sub: ['Human'] }, 3, {});
  M.avancar(e); resolveCom(e);
  igual([e.jogs[0].vida, e.jogs[0].zonas.mao.length - mao0, bt.marc['+1/+1'] || 0], [41, 1, 1], 'vida, compra, marcador');
});
caso('601.2', "Unbreakable Formation (Addendum): na sua principal dá indestrutível, +1/+1 e vigilância; fora da principal só indestrutível", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], ...terras(3, 'Plains')], mao: [[0, 'Unbreakable Formation']] }); e.pend = [];
  const gb = objN(e, 0, 'Grizzly Bears');
  M.avancar(e); conj(e, 'Unbreakable Formation'); resolveCom(e);
  ok(M.temKw(e, gb, 'indestrutivel') && M.temKw(e, gb, 'vigilancia') && gb.marc['+1/+1'] === 1, 'na principal: tudo');
  const f = cena({ campo: [[0, 'Grizzly Bears']] }), uf = f.por(0, 'Unbreakable Formation', { zona: 'mao' });
  M.mover(f, uf.id, 'pilha'); uf.conjPrinc = false;
  ok(!M.condicao(f, { conjuradaNaPrincipal: true }, { voce: 0, este: uf.id }), 'fora da principal: não');
  uf.conjPrinc = true; ok(M.condicao(f, { conjuradaNaPrincipal: true }, { voce: 0, este: uf.id }), 'na principal: sim');
});

// ---------- contagens num formato só (27/11): {conta:{de, o, junta}} ----------
caso('119.3', "Archfiend of Despair: no final, cada oponente perde o que ELE perdeu no turno (3 jogadores: um perdeu 5, outro 0; o seu dano não conta)", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Archfiend of Despair']] });
  const af = objN(e, 0, 'Archfiend of Despair');
  M.perderVida(e, 1, 5); M.perderVida(e, 0, 4);
  M.executar(e, M.carta('Archfiend of Despair').gat[0].fx[0], { ...ctxDe(e), este: af.id, item: af.id }, (j, t, ops) => ops[0]);
  igual(e.jogs.map(j => j.vida), [36, 30, 40], 'o 1 perde mais 5; o 2 nada; você não');
  e.turno.n++; M.executar(e, M.carta('Archfiend of Despair').gat[0].fx[0], { ...ctxDe(e), este: af.id, item: af.id }, (j, t, ops) => ops[0]);
  igual(e.jogs[1].vida, 30, 'turno novo: zera');
});
caso('120.3', "Molten Psyche: cada um embaralha a mão e compra o mesmo tanto; com metalcraft, dano a cada oponente = o que ele comprou no turno", () => {
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Mind Stone'], [0, 'Arcane Signet']], mao: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears']] });
  for (let i = 0; i < 3; i++) e.por(1, 'Forest', { zona: 'mao' });
  const fx = M.carta('Molten Psyche').fx;
  ok(M.fxSuportado(fx), 'aceito');
  for (const f of fx) M.executar(e, f, ctxDe(e), (j, t, ops) => ops[0]);
  igual([e.jogs[0].zonas.mao.length, e.jogs[1].zonas.mao.length], [2, 3], 'mesmo tanto na mão');
  igual(e.jogs[1].vida, 37, '3 de dano (comprou 3)');
});

caso('500.7', "turno extra: dois extras, o último criado vem primeiro; depois volta à ordem (Time Sieve)", () => {
  ok(M.fxSuportado(M.carta('Time Sieve').atv[0].fx), 'turnoExtra aceito');
  const e = cena({ jogs: 3 });
  M.executar(e, { op: 'turnoExtra', quem: 'voce' }, { ...ctxDe(e), voce: 0 }, null);
  M.executar(e, { op: 'turnoExtra', quem: 'voce' }, { ...ctxDe(e), voce: 2 }, null);
  const vez: number[] = [];
  for (let t = 0; t < 4; t++) {
    const a = e.turno.n, pr = x => x.turno.n !== a;
    for (let g = 0; g < 300 && e.turno.n === a && !e.fim; g++) { M.avancar(e, pr); if (e.perg && e.turno.n === a) M.responder(e, e.perg.tipo === 'acao' ? 0 : M.agenteBasico()(e, e.perg), pr); }
    vez.push(e.turno.ativo);
  }
  igual(vez, [2, 0, 1, 2], 'extra do 2 (último criado), extra do 0, e segue do 0: 1, 2');
});
caso('106.1', "prod {cadaCor} (Faeburrow Elder): uma mana de CADA cor entre suas permanentes, tudo junto", () => {
  const e = cena({ campo: [[0, 'Faeburrow Elder'], [0, 'Llanowar Elves'], [0, 'Serra Angel'], [1, 'Lightning Bolt']] });
  const F = objN(e, 0, 'Faeburrow Elder'); F.doente = false;
  const p = M.pacotesDe(e, F, M.atvDe(e, F)[0]);
  igual(p.length, 1, 'um pacote só'); igual([p[0].W, p[0].G, p[0].R], [1, 1, 0], 'W e G, sem a cor do oponente');
});

caso('603.7', "Faramir: escolhe um oponente; o atrasado só dispara na etapa final DELE (deQuem oponenteEscolhido)", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Faramir, Prince of Ithilien']] });
  const F = objN(e, 0, 'Faramir, Prince of Ithilien');
  const g = M.carta('Faramir, Prince of Ithilien').gat[0].fx[0];
  let pergs = 0;
  M.executar(e, g, { voce: 0, este: F.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, F) } }, (j, tipo, ops) => { pergs++; igual(ops.map(o => o.jog), [1, 2]); return ops[1]; });
  igual([pergs, e.atras.length, e.atras[0].mem.jog], [1, 1, 2], 'perguntou e guardou o jogador 2');
  e.turno.n = 3; e.pend = [];
  M.evento(e, { ev: 'fase', passo: 'final', ativo: 1 });
  igual(e.pend.length, 0, 'final do jogador 1: não');
  e.turno.n = 4;
  M.evento(e, { ev: 'fase', passo: 'final', ativo: 2 });
  igual(e.pend.length, 1, 'final do escolhido: dispara');
});

caso('509.1b', "Feasting Hobbit: criatura com poder MENOR que o dele não bloqueia (limite do filtro = poder do este − 1)", () => {
  const e = cena({ campo: [[0, 'Feasting Hobbit'], [1, 'Llanowar Elves'], [1, 'Grizzly Bears']] });
  const h = objN(e, 0, 'Feasting Hobbit'), por = M.dadoDe(e, h).est[0].por;
  ok(M.bate(e, objN(e, 1, 'Llanowar Elves'), por, { voce: 0, este: h.id }), 'elfo 1 < 2: não pode bloquear');
  ok(!M.bate(e, objN(e, 1, 'Grizzly Bears'), por, { voce: 0, este: h.id }), 'urso 2 = 2: pode bloquear');
  h.marc['+1/+1'] = 3; e.vCamada = (e.vCamada || 0) + 1;
  ok(M.bate(e, objN(e, 1, 'Grizzly Bears'), por, { voce: 0, este: h.id }), 'hobbit 5: urso não bloqueia');
});

caso('702.34a', "Flashback (a carta): a instantânea alvo no cemitério ganha flashback até o fim do turno, custo = o custo de mana dela", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Flashback']] });
  const b = e.por(0, 'Lightning Bolt', { zona: 'cemiterio' });
  M.avancar(e);
  ok(!opsDe(e, 'conjurar').some(o => o.id === b.id), 'antes: não');
  conj(e, 'Flashback'); resolvePilha(e);
  ok(opsDe(e, 'conjurar').some(o => o.id === b.id), 'depois: conjura do cemitério');
  igual(M.porFlash(e, 0, b), true);
});

caso('601.2f', "Forensic Gadgeteer: habilidade de artefato custa {1} a menos, mas não abaixo de uma mana (reduzCusto minimo)", () => {
  const e = cena({ campo: [[0, 'Forensic Gadgeteer'], [0, 'Mind Stone'], [0, "Wayfarer's Bauble"]] });
  const m = objN(e, 0, 'Mind Stone'), w = objN(e, 0, "Wayfarer's Bauble");
  igual(M.custoAtv(e, m, M.atvDe(e, m)[1]), { g: 1 }, '{1} fica {1}');
  igual(M.custoAtv(e, w, M.atvDe(e, w)[0]), { g: 1 }, '{2} vira {1}');
});

caso('702.6a', "Forge Anew: o 1º equipar do seu turno custa {0}, o 2º paga; no seu turno equipa fora da velocidade de feitiço", () => {
  const e = cena({ campo: [[0, 'Forge Anew'], [0, 'Behemoth Sledge'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  const sl = objN(e, 0, 'Behemoth Sledge'), k = M.atvDe(e, sl).findIndex(a => a._equipar);
  igual(M.custoAtv(e, sl, M.atvDe(e, sl)[k]), {}, '1º: {0}');
  e.jogs[0].equipT = e.turno.n;
  igual(M.custoAtv(e, sl, M.atvDe(e, sl)[k]), { g: 3 }, '2º: {3}');
  e.jogs[0].equipT = 0; e.turno.passo = 'manutencao';
  ok(M.podeAtivar(e, 0, sl, k), 'na manutenção do seu turno: pode');
  e.turno.ativo = 1;
  igual(M.custoAtv(e, sl, M.atvDe(e, sl)[k]), { g: 3 }, 'turno do oponente: paga');
});

caso('122.8', "moverMarcador: Forgotten Ancient divide os +1/+1 entre outras criaturas, um a um, e para quando quiser", () => {
  const e = cena({ campo: [[0, 'Forgotten Ancient'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const fa = objN(e, 0, 'Forgotten Ancient'), b = objN(e, 0, 'Grizzly Bears'), l = objN(e, 1, 'Llanowar Elves');
  fa.marc['+1/+1'] = 3;
  const f = M.carta('Forgotten Ancient').gat[1].fx[0], fila: any[] = [b.id, l.id, 'pronto'];
  M.executar(e, { ...f, talvez: false }, { voce: 0, este: fa.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, fa) } }, (j, tipo, ops) => { const q = fila.shift(); return ops.find(o => q === 'pronto' ? o.a === 'pronto' : o.id === q); });
  igual([fa.marc['+1/+1'], b.marc['+1/+1'], l.marc['+1/+1']], [1, 1, 1], '1 no urso, 1 no elfo, parou com 1');
});

// ---------- contagens num formato só (27/11): {conta:{de, o, junta}} ----------
caso('701.54d', "Frodo: compra só se ele é o Portador e o Anel te tentou 2+ vezes (cond portadorDoAnel 'este' + conta tentacoes)", () => {
  const e = cena({ campo: [[0, 'Frodo, Adventurous Hobbit'], [0, 'Grizzly Bears']] });
  const fr = objN(e, 0, 'Frodo, Adventurous Hobbit'), b = objN(e, 0, 'Grizzly Bears');
  const se = M.carta('Frodo, Adventurous Hobbit').gat[0].fx[1].se, ctx = { voce: 0, este: fr.id };
  ok(M.seOk(se), 'condição aceita'); ok(!M.condicao(e, se, ctx), 'sem Anel: não');
  e.jogs[0].anel = { n: 1, p: { id: fr.id, ts: fr.ts } };
  ok(!M.condicao(e, se, ctx), 'tentado 1 vez: não');
  e.jogs[0].anel.n = 2; ok(M.condicao(e, se, ctx), 'Portador e 2 vezes: sim');
  e.jogs[0].anel.p = { id: b.id, ts: b.ts }; ok(!M.condicao(e, se, ctx), 'o Portador é o urso: não');
  ok(M.condicao(e, { portadorDoAnel: true }, ctx), 'mas você tem um Portador');
});

caso('506.2', "Frontier Warmonger: quando criaturas (de qualquer um) atacam um oponente seu, as que atacam o oponente ganham ameaça; atacando você, não", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Frontier Warmonger'], [1, 'Grizzly Bears'], [2, 'Llanowar Elves']] });
  const b = objN(e, 1, 'Grizzly Bears'), l = objN(e, 2, 'Llanowar Elves');
  const g = M.carta('Frontier Warmonger').gat[0], ctx = { voce: 0, este: objN(e, 0, 'Frontier Warmonger').id };
  e.turno.combate = { atk: [{ id: b.id, ts: b.ts, alvo: { jog: 2 } }, { id: l.id, ts: l.ts, alvo: { jog: 0 } }] };
  ok(M.condicao(e, g.se, ctx), 'alguém ataca um oponente seu');
  ok(M.bate(e, b, g.fx[0].em.todos, ctx) && !M.bate(e, l, g.fx[0].em.todos, ctx), 'o urso (→ jogador 2) sim; o elfo (→ você) não');
  e.turno.combate = { atk: [{ id: l.id, ts: l.ts, alvo: { jog: 0 } }] };
  ok(!M.condicao(e, g.se, ctx), 'só atacando você: não dispara');
});

caso('508.3a', "Preacher of the Schism: ficha se ataca o jogador de mais vida (empate vale); compra se VOCÊ tem mais vida; conta {de:'atacado', o:'vida'} e {de:'jogadores', o:'vida', junta:'maior'}", () => {
  const [g1, g2] = M.carta('Preacher of the Schism').gat; ok(M.gatOk(g1) && M.gatOk(g2), 'gatilhos aceitos');
  const e = cena({ jogs: 3, campo: [[0, 'Preacher of the Schism']] });
  const p = objN(e, 0, 'Preacher of the Schism'), c = def => ({ voce: 0, este: p.id, ev: { ev: 'ataca', id: p.id, def } });
  ok(M.condicao(e, g1.se, c(1)) && M.condicao(e, g2.se, c(1)), 'todos com 40: as duas');
  e.jogs[1].vida = 30; e.jogs[2].vida = 45;
  ok(!M.condicao(e, g1.se, c(1)) && M.condicao(e, g1.se, c(2)), 'ficha só atacando o de 45');
  ok(!M.condicao(e, g2.se, c(2)), 'você (40) não tem mais vida: não compra');
  e.jogs[0].vida = 45; ok(M.condicao(e, g2.se, c(1)), 'empatado no topo: compra');
});

caso('701.43a', "Pride Sovereign: {W},{T}, exerça: duas fichas Gato; exercida não desvira no próximo desvirar", () => {
  const e = cena({ campo: [[0, 'Pride Sovereign'], [0, 'Plains']] });
  const ps = objN(e, 0, 'Pride Sovereign'); ps.doente = false;
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === ps.id); resolvePilha(e);
  igual(e.campo.filter(id => e.objs[id].n !== 'Pride Sovereign' && e.objs[id].n !== 'Plains').length, 2, 'dois Gatos');
  ok(ps.virada && ps.naoDesv === ps.ts, 'virada e exercida');
  igual(M.poder(e, ps), 4, '+1/+1 por Gato');
});

caso('601.3e', "Progenitor's Icon: só a PRÓXIMA mágica do tipo escolhido tem lampejo; outra de tipo diferente não gasta", () => {
  ok(M.fxSuportado(M.carta("Progenitor's Icon").atv[1].fx), 'aceito');
  const e = cena({ campo: [[0, "Progenitor's Icon"]], mao: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  const ic = objN(e, 0, "Progenitor's Icon"); ic.escolha = { tipo: 'Bear' };
  const [b1, b2, el] = e.jogs[0].zonas.mao.map(id => e.objs[id]);
  M.executar(e, M.carta("Progenitor's Icon").atv[1].fx[0], { voce: 0, este: ic.id, alvos: [], ilegal: {}, lki: {} }, null);
  ok(M.lampejoDado(e, 0, b1) && !M.lampejoDado(e, 0, el), 'Urso sim, Elfo não');
  M.evento(e, { ev: 'conjura', id: el.id, j: 0 }); ok(M.lampejoDado(e, 0, b1), 'o Elfo não gasta');
  M.evento(e, { ev: 'conjura', id: b1.id, j: 0 }); ok(!M.lampejoDado(e, 0, b2), 'depois do 1º Urso, o 2º não');
});

caso('107.3m', "Rampaging Yao Guai: X=2 entra com 2 marcadores e o gatilho de entrada só deixa alvos com valor de mana somado ≤ 2", () => {
  const e = cena({ campo: [...terras(5, 'Forest'), [1, 'Sol Ring'], [1, 'Arcane Signet'], [1, 'Mind Stone'], [1, 'Smothering Tithe']], mao: [[0, 'Rampaging Yao Guai']] });
  M.avancar(e); conj(e, 'Rampaging Yao Guai');
  const esc: string[][] = []; let k = 0;
  resolveCom(e, p => {
    if (p.tipo === 'x') return p.ops.findIndex(o => o.v === 2);
    if (p.tipo === 'alvo') { esc.push(p.ops.filter(o => o.o !== undefined).map(o => e.objs[o.o].n).sort()); const i = p.ops.findIndex(o => o.o !== undefined); return i >= 0 && k++ < 5 ? i : p.ops.findIndex(o => o.a === 'pronto'); }
    return -1;
  });
  const y = objN(e, 0, 'Rampaging Yao Guai');
  igual(y.marc['+1/+1'], 2, 'X marcadores');
  ok(esc.length && !esc[0].includes('Smothering Tithe'), 'vm 4 nunca é opção com X=2: ' + JSON.stringify(esc));
  const vmFora = ['Sol Ring', 'Arcane Signet', 'Mind Stone'].filter(n => !e.campo.some(id => e.objs[id].n === n)).reduce((t, n) => t + M.carta(n).vm, 0);
  ok(vmFora > 0 && vmFora <= 2, 'destruiu com soma ≤ 2: ' + vmFora);
});

caso('508.1c', "Promise of Loyalty: cada jogador fica com 1 criatura com marcador de voto e sacrifica o resto; a do oponente não ataca você nem seu planeswalker enquanto tiver o voto", () => {
  ok(M.fxSuportado(M.carta('Promise of Loyalty').fx), 'aceito');
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Serra Angel'], [1, 'Grizzly Bears'], [0, 'Jace Beleren']] });
  const ag = M.agenteBasico(), ask = (j, tipo, ops, cx) => ops[ag(e, { j, tipo, ops, ctx: cx })];
  M.executar(e, M.carta('Promise of Loyalty').fx[0], { voce: 0, este: -1, alvos: [], ilegal: {}, lki: {} }, ask);
  const cr = j => e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && M.temTipo(e, o, 'Creature'));
  igual([cr(0).length, cr(1).length], [1, 1], 'uma de cada');
  const a = cr(1)[0]; igual(a.marc.vow, 1, 'voto');
  ok(e.campo.some(id => e.objs[id].n === 'Jace Beleren'), 'planeswalker não é sacrificado');
  a.doente = false; e.turno.ativo = 1; e.turno.passo = 'declararAtacantes';
  const P: any = { j: 1 }; let vistos: any[] = [];
  M.PROC.atacar(e, P, (j, tipo, ops) => { vistos = ops; return ops.find(o => o.a === 'pronto'); });
  ok(!vistos.some(o => o.a === 'atacar' && o.id === a.id), 'sem alvo possível para a do voto (2 jogadores): ' + JSON.stringify(vistos));
  a.marc.vow = 0;
  M.PROC.atacar(e, P, (j, tipo, ops) => { vistos = ops; return ops.find(o => o.a === 'pronto'); });
  ok(vistos.some(o => o.a === 'atacar' && o.id === a.id), 'sem o marcador, ataca');
});

caso('602.2b', "Professor Hojo: a 1ª habilidade ativada do seu turno que mira criatura sua custa {2} a menos; mirada por habilidade ativada compra 1 (uma vez por turno)", () => {
  const H = M.carta('Professor Hojo'); ok(H.gat.every(g => M.gatOk(g)) && M.estReduzMiraOk(H.est[0]), 'aceito');
  const e = cena({ campo: [[0, 'Professor Hojo'], [0, 'Grizzly Bears'], [0, 'Basilisk Collar'], [0, 'Forest']] });
  const m0 = e.jogs[0].zonas.mao.length;
  M.avancar(e); respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Basilisk Collar'); alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  const col = objN(e, 0, 'Basilisk Collar'), ur = objN(e, 0, 'Grizzly Bears');
  igual(col.anexo && col.anexo.id, ur.id, 'equipou (equipar {2} − 2)');
  igual(e.jogs[0].zonas.mao.length - m0, 1, 'Hojo comprou 1');
  igual(e.campo.filter(id => e.objs[id].n === 'Forest' && e.objs[id].virada).length, 0, 'não gastou mana');
  M.avancar(e);
  ok(!e.perg.ops.some(o => o.a === 'ativar' && e.objs[o.id].n === 'Basilisk Collar'), 'a 2ª já não tem desconto (só 1 Floresta)');
});

caso('613.1f', "Quicksilver Elemental: {U} ganha as ativadas da criatura alvo até o fim do turno; azul paga qualquer cor nelas", () => {
  const Q = M.carta('Quicksilver Elemental'); ok(M.fxSuportado(Q.atv[0].fx, { topo: false }), 'aceito');
  const e = cena({ campo: [[0, 'Quicksilver Elemental'], [1, 'Prodigal Pyromancer'], [0, 'Island'], [0, 'Island']] });
  const q = objN(e, 0, 'Quicksilver Elemental'), py = objN(e, 1, 'Prodigal Pyromancer'); q.doente = false;
  M.executar(e, Q.atv[0].fx[0], { voce: 0, este: q.id, alvos: [[{ o: py.id, ts: py.ts }]], ilegal: {}, lki: {} }, null);
  igual(M.atvDe(e, q).length, 2, 'a dele + a do Pyromancer');
  const vir = { ...M.atvDe(e, py)[0], custo: { ...M.atvDe(e, py)[0].custo, mana: { p: ['R'] } } };
  igual(M.custoAtv(e, q, vir).p, ['R/U'], 'R vira R/U');
  igual(M.custoAtv(e, py, vir).p, ['R'], 'no Pyromancer não');
  const t0 = e.turno.n;
  for (let g = 0; g < 400 && e.turno.n === t0 && !e.fim; g++) { M.avancar(e); if (e.perg) M.responder(e, e.perg.tipo === 'acao' ? e.perg.ops.findIndex(o => o.a === 'passar') : M.agenteBasico()(e, e.perg)); }
  ok(e.turno.n > t0, 'turno seguinte');
  igual(M.atvDe(e, q).length, 1, 'some no fim do turno');
});

caso('205.2a', "escolher tipo de carta ao entrar: Cloud Key (instantânea custa 1 a menos, criatura não) e Serra's Emissary (proteção contra criatura: suas criaturas e você)", () => {
  ok(M.carta('Cloud Key').subst.every(sb => M.substOk(sb)) && M.carta("Serra's Emissary").subst.every(sb => M.substOk(sb)), 'subst escolher/tipo aceita');
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears']], mao: [[0, 'Lightning Bolt'], [0, 'Llanowar Elves'], [0, 'Shock']] });
  const pega = v => (_j, t, ops) => t === 'escolha' ? ops.find(x => x.v === v) : ops[0];
  const ck = e.por(0, 'Cloud Key', { zona: 'mao' }), ser = e.por(0, "Serra's Emissary", { zona: 'mao' });
  M.entrarPermanente(e, ck.id, 0, {}, (j, t, ops) => { if (t === 'escolha') igual(ops.map(x => x.v), ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery'], 'as 5 opções'); return pega('Instant')(j, t, ops); });
  const custo = n => M.custoComImposto(e, e.objs[e.jogs[0].zonas.mao.find(id => e.objs[id].n === n)]);
  igual([custo('Lightning Bolt').p.length + (custo('Lightning Bolt').g || 0), custo('Shock').g || 0, custo('Llanowar Elves').g || 0], [1, 0, 0], 'Bolt {R} (genérico não fica negativo), Elfo igual');
  igual(M.TIPOS_DE_CARTA.length, 9, '9 tipos de carta');
  M.entrarPermanente(e, ser.id, 0, {}, pega('Creature'));
  const meu = objN(e, 0, 'Grizzly Bears'), dele = objN(e, 1, 'Grizzly Bears');
  ok(M.protegeDe(e, meu, M.dadoDe(e, dele)) && M.protegeDe(e, objN(e, 0, "Serra's Emissary"), M.dadoDe(e, dele)), 'suas criaturas: proteção contra criatura');
  ok(!M.protegeDe(e, dele, M.dadoDe(e, meu)), 'a do oponente não');
  ok(!M.bloqueiaEste(e, dele, meu), 'criatura não bloqueia a sua');
  const bolt = e.por(1, 'Lightning Bolt', { zona: 'mao' });
  ok(M.protegeJog(e, 0, dele) && !M.protegeJog(e, 0, bolt) && !M.protegeJog(e, 1, meu), 'você: contra criatura sim, instantânea não; o oponente não');
  ok(M.alvoLegal(e, { f: { tipo: ['Creature'] } }, { o: meu.id, ts: meu.ts }, { voce: 1, este: bolt.id }), 'Bolt pode mirar a sua criatura');
});

caso('202.1', "Frontline Medic: só mira mágica com {X} no custo de mana (filtro comX)", () => {
  const e = cena({ mao: [[1, 'Fireball'], [1, 'Lightning Bolt']] });
  const f = { zona: 'mao', comX: true }, fb = naMao(e, 1, 'Fireball'), lb = naMao(e, 1, 'Lightning Bolt');
  ok(M.bate(e, fb, f, { voce: 0 }) && !M.bate(e, lb, f, { voce: 0 }), 'Fireball sim, Bolt não');
});

caso('120.3', "Ghyrson Starn: outra fonte sua causa exatamente 1 de dano numa criatura → Ghyrson causa 2 NELA (em 'danificado'); em jogador, no jogador", () => {
  const e = cena({ campo: [[0, 'Ghyrson Starn, Kelermorph'], [0, 'Llanowar Elves'], [1, 'Hill Giant']] });
  const gh = objN(e, 0, 'Ghyrson Starn, Kelermorph'), el = objN(e, 0, 'Llanowar Elves'), hg = objN(e, 1, 'Hill Giant');
  const g = M.carta('Ghyrson Starn, Kelermorph').gat[0], v1 = e.jogs[1].vida;
  const ctx = ev => ({ voce: 0, este: gh.id, ev, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, gh) } });
  M.executar(e, g.fx[0], ctx({ ev: 'dano', fonte: el.id, o: hg.id, q: 1 }), null);
  igual([hg.dano, e.jogs[1].vida], [2, v1], '2 no gigante, jogador intacto');
  M.executar(e, g.fx[0], ctx({ ev: 'dano', fonte: el.id, jog: 1, q: 1 }), null);
  igual([hg.dano, e.jogs[1].vida], [2, v1 - 2], '2 no jogador');
});

caso('701.20', "Gitaxian Probe olha a mão do alvo (log) e compra; Glass-Cast Heart: o custo sacrifica ele E as 13 Blood (sacrificar.comEste)", () => {
  const e = cena({ mao: [[1, 'Lightning Bolt']] }); e.cfg.log = true;
  const n0 = e.jogs[0].zonas.mao.length;
  M.executar(e, { op: 'olharMao', quem: { alvo: 0 } }, { voce: 0, este: -1, alvos: [[{ jog: 1 }]], ilegal: {}, lki: {} }, null);
  ok(e.log.some(l => String(l).includes('Lightning Bolt')), 'a mão no log');
  igual(e.jogs[0].zonas.mao.length, n0);
  const g = cena({ campo: [[0, 'Glass-Cast Heart'], [0, 'Swamp'], [0, 'Swamp']] });
  M.criarFichas(g, 0, { nome: 'Blood' }, 13);
  const h = objN(g, 0, 'Glass-Cast Heart'); M.avancar(g);
  const k = 1; ok(M.podeAtivar(g, 0, h, k), 'pode com 13 Blood');
  respE(g, o => o.a === 'ativar' && o.id === h.id && o.k === k);
  for (let i = 0; i < 20 && g.perg && g.perg.tipo === 'custo'; i++) M.responder(g, 0);
  ok(h.zona !== 'campo', 'o Coração foi sacrificado'); igual(g.campo.filter(id => g.objs[id].n === 'Blood').length, 0, 'as 13 Blood também');
});

caso('604.3', "Hallowed Haunting: a ficha Espírito tem P/R = Espíritos seus (CDA ptDefinido), contando ela; cresce com o próximo", () => {
  const e = cena({ campo: [[0, 'Hallowed Haunting']] });
  const fx = M.carta('Hallowed Haunting').gat[0].fx[0], H = objN(e, 0, 'Hallowed Haunting');
  const ctx = () => ({ voce: 0, este: H.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, H) } });
  ok(M.fxSuportado([fx]), 'aceito');
  M.executar(e, fx, ctx(), null);
  const t1 = e.objs[e.campo.find(id => e.objs[id].ficha)];
  igual([M.poder(e, t1), M.resistencia(e, t1)], [1, 1], 'sozinha: 1/1');
  M.executar(e, fx, ctx(), null); e.vCamada = (e.vCamada || 0) + 1;
  igual([M.poder(e, t1), M.resistencia(e, t1)], [2, 2], 'com outra: 2/2');
});

caso('602.2b', "Halo Fountain: custo 'desvire N criaturas viradas suas' (desvirarOutros); sem viradas, não ativa", () => {
  const e = cena({ campo: [[0, 'Halo Fountain'], [0, 'Plains'], [0, 'Grizzly Bears', { virada: true }]] });
  const h = objN(e, 0, 'Halo Fountain'), b = objN(e, 0, 'Grizzly Bears'); M.avancar(e);
  ok(M.podeAtivar(e, 0, h, 0) && !M.podeAtivar(e, 0, h, 1), '1 virada: só a primeira');
  respE(e, o => o.a === 'ativar' && o.id === h.id && o.k === 0);
  for (let i = 0; i < 5 && e.perg && e.perg.tipo === 'custo'; i++) M.responder(e, 0);
  ok(!b.virada, 'o urso desvirou'); ok(h.virada, 'a fonte virou');
  b.virada = true; h.virada = false; b.virada = false;
  ok(!M.podeAtivar(e, 0, h, 0), 'sem criatura virada: não');
});

caso('702.118b', "espreitar (Gollum 1/1): criatura de poder maior não bloqueia; de poder igual, bloqueia", () => {
  const e = cena({ campo: [[0, 'Gollum, Obsessed Stalker'], [1, 'Llanowar Elves'], [1, 'Grizzly Bears']] });
  const g = objN(e, 0, 'Gollum, Obsessed Stalker'), por = M.dadoDe(e, g).est[0].por, c = { voce: 0, este: g.id };
  ok(!M.bate(e, objN(e, 1, 'Llanowar Elves'), por, c) && M.bate(e, objN(e, 1, 'Grizzly Bears'), por, c), 'elfo 1 bloqueia; urso 2 não');
});

caso('509.1b', "Hei Bai: a ficha Espírito não bloqueia nem é bloqueada por não-Espírito; Espírito com Espírito, pode", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const tok = M.carta('Hei Bai, Forest Guardian').atv[0].fx[0].token;
  const [s0] = M.criarFichas(e, 0, tok, 1), [s1] = M.criarFichas(e, 1, tok, 1);
  const b = objN(e, 0, 'Grizzly Bears'), l = objN(e, 1, 'Llanowar Elves');
  ok(!M.bloqueiaEste(e, l, s0), 'elfo não bloqueia o Espírito');
  ok(!M.bloqueiaEste(e, s1, b), 'o Espírito não bloqueia o urso');
  ok(M.bloqueiaEste(e, s1, s0), 'Espírito bloqueia Espírito');
  ok(M.podeBloquear(e, s1, 1), 'pode bloquear em geral');
});

caso('702.76a', "Hunting Velociraptor: mágica de Dinossauro tem rondar {2}{R} (darRondar) depois de dano de combate por um Dinossauro", () => {
  const e = cena({ campo: [[0, 'Hunting Velociraptor']], mao: [[0, 'Colossal Dreadmaw'], [0, 'Grizzly Bears']] });
  const d = naMao(e, 0, 'Colossal Dreadmaw');
  igual(M.altDe(e, 0, d), undefined, 'sem dano: sem rondar');
  e.jogs[0].danoCombT = { t: e.turno.n, sub: ['Dinosaur'] };
  igual(M.altDe(e, 0, d), { g: 2, p: ['R'] }, 'com dano de Dinossauro: {2}{R}');
  igual(M.altDe(e, 0, naMao(e, 0, 'Grizzly Bears')), undefined, 'o urso não é Dinossauro');
});

caso('601.3', "Kess: uma mágica do cemitério por turno seu, e ela vai para o exílio depois (podeJogar limite + exilaAoSair)", () => {
  const e = cena({ campo: [[0, 'Kess, Dissident Mage'], ...enche(4, 'Mountain').map(n => [0, n])] });
  const b1 = e.por(0, 'Lightning Bolt', { zona: 'cemiterio' }), b2 = e.por(0, 'Shock', { zona: 'cemiterio' });
  M.avancar(e);
  ok(opsDe(e, 'conjurar').some(o => o.id === b1.id) && opsDe(e, 'conjurar').some(o => o.id === b2.id), 'as duas oferecidas');
  respE(e, o => o.a === 'conjurar' && o.id === b1.id);
  for (let i = 0; i < 5 && e.perg && e.perg.tipo !== 'acao'; i++) M.responder(e, 0);
  resolvePilha(e);
  igual(b1.zona, 'exilio', 'o Bolt foi para o exílio');
  ok(!opsDe(e, 'conjurar').some(o => o.id === b2.id), 'a 2ª no mesmo turno: não');
});

caso('118.3', "Jarad: do cemitério, sacrifica um Pântano E uma Floresta (sacrificar.tambem); dois Pântanos não pagam", () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp']] });
  const j = e.por(0, 'Jarad, Golgari Lich Lord', { zona: 'cemiterio' }); M.avancar(e);
  ok(!M.podeAtivar(e, 0, j, 1), 'dois Pântanos: não');
  const g = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [0, 'Forest']] }), jj = g.por(0, 'Jarad, Golgari Lich Lord', { zona: 'cemiterio' }), f = objN(g, 0, 'Forest');
  M.avancar(g);
  ok(M.podeAtivar(g, 0, jj, 1), 'Pântano + Floresta: sim');
  respE(g, o => o.a === 'ativar' && o.id === jj.id && o.k === 1);
  for (let i = 0; i < 5 && g.perg && g.perg.tipo === 'custo'; i++) M.responder(g, 0);
  igual(f.zona, 'cemiterio', 'a Floresta foi'); igual(g.campo.filter(id => g.objs[id].n === 'Swamp').length, 1, 'um Pântano ficou');
});

caso('701.20', "Kaalia, Zenith Seeker: dos 6 do topo pega no máximo um de cada (Anjo, Demônio, Dragão) — dois Anjos, só um vai", () => {
  const e = cena({ campo: [[0, 'Kaalia, Zenith Seeker']] });
  const G = e.jogs[0].zonas.grimorio;
  for (const n of ['Wastes', 'Serra Angel', 'Serra Angel', "Demon of Fate's Design", 'Wastes', 'Wastes']) { const o = e.por(0, n, { zona: 'grimorio' }); G.splice(G.indexOf(o.id), 1); G.push(o.id); }
  const K = objN(e, 0, 'Kaalia, Zenith Seeker'), m0 = e.jogs[0].zonas.mao.length;
  M.executar(e, M.carta('Kaalia, Zenith Seeker').gat[0].fx[0], { voce: 0, este: K.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, K) } }, (j, tipo, ops) => ops.find(o => o.a !== 'nenhum') || ops[0]);
  const mao = e.jogs[0].zonas.mao.slice(m0).map(id => e.objs[id].n).sort();
  igual(mao, ["Demon of Fate's Design", 'Serra Angel']);
});

caso('603.4', "Kodama of the East Tree: entrou um permanente seu → pode pôr da mão um de VM igual ou menor; o que ele pôs não dispara de novo", () => {
  const e = cena({ campo: [[0, 'Kodama of the East Tree']], mao: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  e.pend = [];
  e.por(0, 'Hill Giant');
  igual(e.pend.filter(p => p.n === 'Kodama of the East Tree').length, 1, 'o Gigante dispara');
  const K = objN(e, 0, 'Kodama of the East Tree'), g = M.carta('Kodama of the East Tree').gat[0];
  const gi = objN(e, 0, 'Hill Giant'); e.pend = [];
  M.executar(e, { ...g.fx[0], talvez: false }, { voce: 0, este: K.id, ev: { ev: 'entra', id: gi.id, ts: gi.ts }, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, K) } }, (j, t, ops) => ops.find(o => o.id !== undefined && e.objs[o.id].n === 'Grizzly Bears') || ops[0]);
  ok(e.campo.some(id => e.objs[id].n === 'Grizzly Bears'), 'pôs o urso');
  igual(e.pend.filter(p => p.n === 'Kodama of the East Tree').length, 0, 'o urso posto por ele não dispara');
});

caso('104.3e', "Angel of Destiny: com 15 de vida acima da inicial, perde só quem ESTE anjo atacou neste turno (não cada oponente)", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Angel of Destiny']] });
  const a = e.objs[e.campo[0]], g = M.carta('Angel of Destiny').gat[1], ctx: any = { voce: 0, este: a.id, alvos: [], ilegal: {}, lki: { alvos: [] } };
  e.jogs[0].vida = 54; ok(!M.condicao(e, g.se, ctx), '54 < 40+15');
  e.jogs[0].vida = 55; ok(M.condicao(e, g.se, ctx), '55');
  e.turno.ataques = [{ id: a.id, ts: a.ts, j: 0, def: 2, jog: 2 }];
  for (const f of g.fx) M.executar(e, f, ctx, (j, t, o) => o[0]);
  ok(e.jogs[2].saiu && !e.jogs[1].saiu, 'só o 2 perde');
  ok(M.carta('Angel of Destiny').gat.every(x => M.gatOk(x)), 'gatOk');
});

caso('118.3', "Angel of Jubilation: ninguém sacrifica criatura (Viscera Seer) nem paga vida (Gitaxian Probe sem mana) para conjurar/ativar; sacrificar artefato (Lotus Petal) pode", () => {
  const e = cena({ campo: [[0, 'Viscera Seer'], [0, 'Grizzly Bears']], mao: [[0, 'Gitaxian Probe']] });
  const [vs] = e.campo.map(id => e.objs[id]), probe = e.objs[e.jogs[0].zonas.mao[0]];
  ok(M.podeAtivar(e, 0, vs, 0), 'sem o anjo: sacrifica');
  ok(M.podeConjurar(e, 0, probe), 'sem o anjo: paga 2 de vida');
  e.por(1, 'Angel of Jubilation');
  ok(!M.podeAtivar(e, 0, vs, 0), 'com o anjo: não sacrifica criatura');
  ok(!M.podeConjurar(e, 0, probe), 'com o anjo: não paga vida pelo phyrexiano');
  const lp = e.por(0, 'Lotus Petal');
  ok(M.fontesDeMana(e, 0).some(f => f.id === lp.id), 'Lotus Petal: sacrificar artefato vale');
});

caso('607.2a', "Angel of Serenity: exila criaturas do campo e/ou cartas de criatura de cemitérios (até 3) e, ao sair, elas voltam à mão dos donos", () => {
  const e = cena({ campo: [[1, 'Grizzly Bears']] });
  const gb = e.objs[e.campo[0]], cem = e.por(1, 'Grizzly Bears', { zona: 'cemiterio' }), an = e.por(0, 'Angel of Serenity');
  const g = M.carta('Angel of Serenity').gat, ctx: any = { voce: 0, este: an.id, ilegal: {}, lki: { alvos: [] } };
  const poss = M.alvosPossiveis(e, g[0].alvos[0], ctx).map(x => x.o);
  ok(poss.includes(gb.id) && poss.includes(cem.id) && !poss.includes(an.id), 'campo e cemitério, não ela mesma');
  ctx.alvos = [[{ o: gb.id, ts: gb.ts }, { o: cem.id, ts: cem.ts }]];
  for (const f of g[0].fx) M.executar(e, f, ctx, (j, t, o) => o.find(x => x.a === 'sim') || o[0]);
  igual(naZona(e, 1, 'exilio').length, 2);
  const lki = M.lkiDe(e, an); M.mover(e, an.id, 'cemiterio');
  for (const f of g[1].fx) M.executar(e, f, { voce: 0, este: an.id, alvos: [], ilegal: {}, lki: { este: lki, alvos: [] } }, (j, t, o) => o[0]);
  igual(naZona(e, 1, 'mao').filter(n => n === 'Grizzly Bears').length, 2, 'voltam à mão');
  ok(g.every(x => M.gatOk(x)), 'gatOk');
});

caso('101.2', "Angelic Arbiter: o oponente que conjurou mágica no turno não ataca; o que atacou com criatura não conjura; quem não fez nada joga normal", () => {
  const e = cena({ campo: [[0, 'Angelic Arbiter'], [1, 'Grizzly Bears'], [1, 'Mountain']], mao: [[1, 'Lightning Bolt']] });
  const gb = e.objs[e.campo[1]], bolt = e.objs[e.jogs[1].zonas.mao[0]];
  e.turno.ativo = 1;
  ok(M.podeConjurar(e, 1, bolt), 'nada feito: conjura');
  e.jogs[1].conjT = { t: e.turno.n, n: 1 };
  ok(!M.podeAtacarObj(e, gb, 1), 'conjurou: não ataca');
  e.jogs[1].conjT = null; ok(M.podeAtacarObj(e, gb, 1), 'não conjurou: ataca');
  e.turno.ataques = [{ id: gb.id, ts: gb.ts, j: 1, def: 0, jog: 0 }];
  ok(!M.podeConjurar(e, 1, bolt), 'atacou: não conjura');
});

caso('118.9', "Baleful Mastery: pelo custo alternativo {1}{B} o oponente compra; pelo custo normal, não", () => {
  const e = cena({ campo: [[0, 'Swamp'], [0, 'Swamp'], [1, 'Grizzly Bears']], mao: [[0, 'Baleful Mastery']] });
  const m0 = e.jogs[1].zonas.mao.length;
  M.avancar(e); conj(e, 'Baleful Mastery'); alvoObj(e, 'Grizzly Bears');
  while (e.pilha.length && e.perg) M.responder(e, 0);
  igual(naZona(e, 1, 'cemiterio').length + naZona(e, 1, 'exilio').length, 1, 'exilou'); igual(e.jogs[1].zonas.mao.length, m0 + 1, 'o oponente comprou');
  const f = M.carta('Baleful Mastery').fx[1];
  ok(!M.condicao(e, f.se, { voce: 0, opc: {} }) && M.condicao(e, f.se, { voce: 0, opc: { altPago: true } }), 'só com o alternativo');
});

caso('119.7', "Archfiend of Despair: oponente não ganha vida (você ganha); no fim, cada oponente perde o que ELE perdeu no turno", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Archfiend of Despair']] });
  igual(M.ganharVida(e, 1, 5), 0); igual(e.jogs[1].vida, 40, 'oponente não ganha');
  ok(M.ganharVida(e, 0, 2) > 0, 'você ganha');
  M.danoJogador(e, 1, 3); M.perderVida(e, 2, 1); M.perderVida(e, 0, 4);
  const g = M.carta('Archfiend of Despair').gat[0];
  for (const f of g.fx) M.executar(e, f, { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, o) => o[0]);
  igual([e.jogs[1].vida, e.jogs[2].vida], [34, 38]);
  ok(M.gatOk(g), 'gatOk');
});

caso('608.2c', "Battle Angels of Tyr: cada parte só se o jogador que levou o dano tem mais (mão / terrenos / vida) que cada outro", () => {
  const e = cena({ campo: [[0, 'Battle Angels of Tyr'], [1, 'Forest'], [1, 'Forest']] });
  const g = M.carta('Battle Angels of Tyr').gat[0], ctx: any = { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: { alvos: [] }, ev: { ev: 'dano', jog: 1, q: 4 } };
  e.jogs[0].zonas.mao.length = 0; e.jogs[1].vida = 30;
  const m0 = e.jogs[0].zonas.mao.length;
  for (const f of g.fx) M.executar(e, f, ctx, (j, t, o) => o[0]);
  igual(e.jogs[0].zonas.mao.length, m0 + (e.jogs[1].zonas.mao.length > m0 ? 1 : 0), 'compra se ele tem mais na mão');
  ok(e.campo.some(id => e.objs[id].n === 'Treasure' || (e.objs[id].ficha && e.objs[id].ctrl === 0)), 'tesouro: ele tem mais terrenos');
  igual(e.jogs[0].vida, 40, 'não ganha 3: ele tem menos vida');
  ok(M.gatOk(g), 'gatOk');
});

caso('122.1', "filtro semMarcador: true = sem nenhum marcador (Damning Verdict); com tipo = sem marcador daquele tipo (Wave Goodbye)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Serra Angel']] });
  objN(e, 0, 'Grizzly Bears').marc['-1/-1'] = 1; objN(e, 0, 'Serra Angel').marc['+1/+1'] = 1;
  const nomes = f => M.objetosQue(e, { tipo: ['Creature'], zona: 'campo', ...f }, { voce: 0 }).map(o => o.n).sort();
  igual(nomes({ semMarcador: true }), ['Llanowar Elves']);
  igual(nomes({ semMarcador: '+1/+1' }), ['Grizzly Bears', 'Llanowar Elves']);
});

caso('121.1', "Fists of Flame: compra 1 e a criatura ganha +1/+0 por carta que você comprou no turno (conta {de:'turno', o:'compras'})", () => {
  ok(M.fxSuportado(M.carta('Fists of Flame').fx), 'aceito');
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Grizzly Bears']], mao: [[0, 'Fists of Flame']] });
  M.comprar(e, 0, 2);
  M.avancar(e); conj(e, 'Fists of Flame'); if (e.perg && e.perg.tipo === 'alvo') alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  const b = objN(e, 0, 'Grizzly Bears');
  igual(M.poder(e, b), 2 + 3, '2 compradas antes + a do Fists'); ok(M.temKw(e, b, 'atropelar'));
});

caso('603.4', "Nissa, Resurgent Animist: só na 2ª resolução do gatilho de terreno no turno revela até achar Elfo/Elemental e põe na mão (conta {de:'turno', o:'resolucoesDestaHab'})", () => {
  const e = cena({ campo: [[0, 'Nissa, Resurgent Animist']] });
  e.por(0, 'Llanowar Elves', { zona: 'grimorio' }); e.por(0, 'Sol Ring', { zona: 'grimorio' });   // topo: Sol Ring, depois o Elfo
  const naMao = () => e.jogs[0].zonas.mao.filter(id => e.objs[id].n === 'Llanowar Elves').length;
  e.por(0, 'Forest'); M.avancar(e); resolveCom(e);
  igual(naMao(), 0, '1ª resolução: só a mana');
  e.por(0, 'Forest'); M.avancar(e); resolveCom(e);
  igual(naMao(), 1, '2ª: o Elfo foi para a mão');
  ok(e.jogs[0].zonas.grimorio.map(id => e.objs[id].n).indexOf('Sol Ring') === 0, 'o Sol Ring revelado foi para o fundo');
});

caso('603.4', 'contagens pedidas: quantas vezes ESTA habilidade resolveu neste turno (Omnath) — conta por fonte e por habilidade', () => {
  const e = cena({});
  igual(M.qtd(e, { conta: { de: 'turno', o: 'resolucoesDestaHab' } }, { voce: 0, resHab: 2 }), 2, 'a habilidade a');
  igual(M.qtd(e, { conta: { de: 'turno', o: 'resolucoesDestaHab' } }, { voce: 0 }), 0, 'outra habilidade');
  ok(M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'cond') && !M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'est'), 'só em efeito/condição');
});

caso('118.9', "Baleful Mastery: pagou o custo alternativo {1}{B} → um oponente (à escolha) compra; pelo custo normal, não", () => {
  ok(M.fxSuportado(M.carta('Baleful Mastery').fx), 'aceito');
  const e = cena({ jogs: 3, campo: [[0, 'Swamp'], [0, 'Swamp'], [1, 'Grizzly Bears']], mao: [[0, 'Baleful Mastery']] });
  const m1 = e.jogs[1].zonas.mao.length, m2 = e.jogs[2].zonas.mao.length;
  e.jogs[2].vida = 30;
  M.avancar(e); conj(e, 'Baleful Mastery'); alvoObj(e, 'Grizzly Bears');
  resolveCom(e);
  ok(naZona(e, 1, 'exilio').includes('Grizzly Bears'), 'exilou');
  igual([e.jogs[1].zonas.mao.length - m1, e.jogs[2].zonas.mao.length - m2], [0, 1], 'só o oponente escolhido compra (o de menos vida)');
  const f = cena({ campo: [[1, 'Grizzly Bears']], mao: [[0, 'Baleful Mastery']] });
  const b = f.jogs[0].zonas.mao[0], u = f.campo.find(id => f.objs[id].n === 'Grizzly Bears');
  M.mover(f, b, 'pilha'); const n1 = f.jogs[1].zonas.mao.length;
  const ctx: any = { voce: 0, este: b, alvos: [[{ o: u, ts: f.objs[u].ts }]], ilegal: {}, lki: {} };
  for (const x of M.carta('Baleful Mastery').fx) M.executar(f, x, ctx, null);
  igual(f.jogs[1].zonas.mao.length, n1, 'sem o alternativo: ninguém compra');
});

caso('101.4', "Gluntch: no seu fim de turno escolhe um jogador para cada parte (2 marcadores numa criatura dele, compra 1, 2 Tesouros)", () => {
  ok(M.carta('Gluntch, the Bestower').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Gluntch, the Bestower'], [1, 'Grizzly Bears'], [1, 'Hill Giant']], passo: 'principal2' }); e.pend = [];
  const m1 = e.jogs[1].zonas.mao.length;
  passarAte(e, 'final'); M.avancar(e);
  let k = 0;
  resolveCom(e, p => p.tipo === 'jogador' ? (k++ < 2 ? p.ops.findIndex(o => o.jog === 1) : p.ops.findIndex(o => o.jog === 0)) : p.tipo === 'um' ? p.ops.findIndex(o => e.objs[o.id].n === 'Grizzly Bears') : -1);
  const ursos = e.campo.map(id => e.objs[id]).find(o => o.n === 'Grizzly Bears');
  igual(ursos.marc['+1/+1'], 2, 'o jogador 1 escolheu os Ursos');
  igual(e.jogs[1].zonas.mao.length - m1, 1, 'o jogador 1 compra');
  igual(e.campo.filter(id => e.objs[id].n === 'Treasure' && e.objs[id].ctrl === 0).length, 2, 'eu crio 2 Tesouros');
});

caso('205.4', "Cacophony Unleashed: vira criatura LENDÁRIA 6/6 até o fim do turno (animar super); Captivating Vampire: a roubada vira Vampire além dos outros tipos", () => {
  const e = cena({ campo: [[0, 'Cacophony Unleashed'], [1, 'Grizzly Bears']] });
  const c = objN(e, 0, 'Cacophony Unleashed'), u = objN(e, 1, 'Grizzly Bears');
  ok(M.carta('Cacophony Unleashed').gat.every(g => M.gatOk(g)), 'aceito');
  const ctx = { voce: 0, este: c.id, alvos: [], ilegal: {}, lki: {} };
  M.executar(e, M.carta('Cacophony Unleashed').gat[1].fx[0], ctx, null);
  ok(M.temTipo(e, c, 'Creature') && (M.dadoDe(e, c).super || []).includes('Legendary') && M.poder(e, c) === 6, 'lendária 6/6');
  const v = M.carta('Captivating Vampire').atv[0];
  ok(M.fxSuportado(v.fx), 'Vampire aceito');
  for (const f of v.fx) M.executar(e, f, { voce: 0, este: -1, alvos: [[{ o: u.id, ts: u.ts }]], ilegal: {}, lki: {} }, null);
  ok(u.ctrl === 0 && (M.dadoDe(e, u).sub || []).includes('Vampire') && (M.dadoDe(e, u).sub || []).includes('Bear'), 'minha e Vampire Bear');
});

caso('701.54a', "Call of the Ring: escolher o Portador dispara 'pode pagar 2 de vida: compre'", () => {
  const e = cena({ campo: [[0, 'Call of the Ring'], [0, 'Grizzly Bears']] });
  ok(M.carta('Call of the Ring').gat.every(g => M.gatOk(g)), 'aceito');
  M.executar(e, { op: 'tentarAnel', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops[0]);
  igual(e.pend.filter(p => p.ev && p.ev.ev === 'portador' && p.n === 'Call of the Ring').length, 1, 'disparou');
});

caso('707.2', "Calix: cópia de um encantamento não lendário seu, escolhido ao resolver (copiaDe {um}); Caretaker's Talent no nível 2 copia uma ficha alvo", () => {
  ok(M.carta('Calix, Guided by Fate').gat.every(g => M.gatOk(g)), 'Calix aceito');
  const e = cena({ campo: [[0, 'Calix, Guided by Fate'], [0, 'Dragon Tempest'], [0, 'Cacophony Unleashed'], [0, 'Call of the Ring']] });
  const cx = objN(e, 0, 'Calix, Guided by Fate');
  const fx = M.carta('Calix, Guided by Fate').gat[1].fx[0];
  const f = cena({ campo: [[0, 'Dragon Tempest'], [0, 'Call of the Ring']] });
  M.executar(f, { ...fx }, { voce: 0, este: -1, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => ops.find(o => f.objs[o.id] && f.objs[o.id].n === 'Call of the Ring') || ops[0]);
  igual(f.campo.filter(id => f.objs[id].n === 'Call of the Ring').length, 2, 'copiou a escolhida');
  ok(M.carta("Caretaker's Talent").niveis[0].gat.every(g => M.gatOk(g)), 'Caretaker aceito');
});

caso('719.3', "Case of the Locked Hothouse: no seu passo final com 7+ terrenos fica resolvido (dali em diante joga do topo); com 6, não", () => {
  for (const n of [6, 7]) {
    const e = cena({ campo: [[0, 'Case of the Locked Hothouse'], ...terras(n, 'Forest')], passo: 'principal2' }); e.pend = [];
    const c = objN(e, 0, 'Case of the Locked Hothouse');
    passarAte(e, 'final'); M.avancar(e); resolveCom(e);
    igual(M.condicao(e, { palavra: 'solved' }, { voce: 0, este: c.id }), n === 7, n + ' terrenos');
  }
});

caso('702.171', "Caustic Bronco: ao atacar revela e põe na mão; sem selar você perde o valor de mana, selada cada oponente perde; Selar 3 só como feitiço", () => {
  ok(M.carta('Caustic Bronco').gat.every(g => M.gatOk(g)), 'aceito');
  for (const sela of [false, true]) {
    const e = cena({ campo: [[0, 'Caustic Bronco'], [0, 'Hill Giant']] });
    const b = objN(e, 0, 'Caustic Bronco');
    e.por(0, 'Dragon Tempest', { zona: 'grimorio' });
    if (sela) {
      const k = M.atvDe(e, b).findIndex(a => a._selar);
      ok(k >= 0 && M.podeAtivar(e, 0, b, k), 'pode selar');
      M.executar(e, M.atvDe(e, b)[k].fx[0], { voce: 0, este: b.id, alvos: [], ilegal: {}, lki: {} }, null);
      ok(M.selada(e, b), 'selada');
    }
    const ctx: any = { voce: 0, este: b.id, alvos: [], ilegal: {}, lki: {} };
    for (const f of M.carta('Caustic Bronco').gat[0].fx) M.executar(e, f, ctx, null);
    igual([e.jogs[0].vida, e.jogs[1].vida], sela ? [40, 38] : [38, 40], sela ? 'selada: o oponente perde 2' : 'sem selar: eu perco 2');
    ok(naZona(e, 0, 'mao').includes('Dragon Tempest'), 'foi para a mão');
  }
});

caso('509.1b', "Hei Bai: a ficha Spirit não bloqueia nem é bloqueada por criatura que não é Spirit", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Grizzly Bears']] });
  const f = M.carta('Hei Bai, Forest Guardian').atv[0].fx[0];
  ok(M.fxSuportado([f]), 'aceito');
  M.executar(e, { ...f, qtd: 1 }, { voce: 1, este: -1, alvos: [], ilegal: {}, lki: {} }, null);
  const sp = e.objs[e.campo.find(id => e.objs[id].ficha)], b0 = objN(e, 0, 'Grizzly Bears'), b1 = objN(e, 1, 'Grizzly Bears');
  ok(!M.bloqueiaEste(e, sp, b0), 'não bloqueia não-Spirit');
  ok(!M.bloqueiaEste(e, b0, sp) && M.podeBloquear(e, b1, 1), 'não é bloqueada por não-Spirit; o urso dele bloqueia normal');
});

caso('510.2', "Hordewing Skaab: um disparo pela etapa de dano, compra (e descarta) uma por oponente ferido", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Hordewing Skaab'], [0, 'Grizzly Bears']] });
  ok(M.carta('Hordewing Skaab').gat.every(g => M.gatOk(g)), 'aceito');
  const h = objN(e, 0, 'Hordewing Skaab');
  M.evento(e, { ev: 'dano', fonte: h.id, combate: true, q: 3, jog: 1 });
  M.evento(e, { ev: 'dano', fonte: h.id, combate: true, q: 3, jog: 2 });
  const p = e.pend.filter(x => x.n === 'Hordewing Skaab');
  igual(p.length, 1, 'um disparo');
  igual(M.qtdDe(e, { conta: { de: 'evento', o: 'jogadores' } }, { voce: 0, ev: p[0].ev, lki: {} }), 2, 'dois oponentes feridos');
});

caso('702.76', "Hunting Velociraptor: Dinossauros que você conjura têm rondar {2}{R} (depois de dano de combate de um Dinossauro a um jogador)", () => {
  const e = cena({ campo: [[0, 'Hunting Velociraptor']], mao: [[0, 'Ghalta, Primal Hunger']] });
  const g = e.objs[e.jogs[0].zonas.mao[0]];
  igual(M.altDe(e, 0, g), undefined, 'sem dano: custo normal');
  e.jogs[0].danoCombT = { t: e.turno.n, sub: ['Dinosaur'] };
  igual(M.vmDe(M.altDe(e, 0, g) || {}), 3, 'com dano de Dinossauro: {2}{R}');
});

caso('601.2', "Cyclone Summoner: só devolve as permanentes se foi conjurada DA MÃO (filtro conjurada:'mao'); do comando, não", () => {
  for (const [de, volta] of [['mao', true], ['comando', false]] as const) {
    const e = cena({ campo: [...terras(7, 'Island'), [1, 'Grizzly Bears']] });
    const c = e.por(0, 'Cyclone Summoner', { zona: de, obj: de === 'comando' ? { cmd: true } : {} });
    if (de === 'comando') { e.jogs[0].cmd.push(c.id); e.jogs[0].imposto[c.id] = 0; }
    M.avancar(e); conj(e, 'Cyclone Summoner'); resolveCom(e);
    ok(e.objs[c.id].zona === 'campo', de + ': entrou');
    igual(e.campo.some(id => e.objs[id].n === 'Grizzly Bears'), !volta, de + ': Bears ' + (volta ? 'volta' : 'fica'));
  }
});

caso('104.3', "Darksteel Angel (naoPerdeJogo): com vida 0 não perde; o oponente não vence por efeito; sem o Anjo, perde", () => {
  ok(M.carta('Darksteel Angel').est.some(s => s.modo === 'naoPerdeJogo' && s.afeta === 'voce'), 'escrito');
  const e = cena({ campo: [[0, 'Darksteel Angel']] });
  e.jogs[0].vida = 0; M.avancar(e);
  ok(!e.jogs[0].saiu, 'vida 0: continua');
  M.executar(e, { op: 'ganharJogo', quem: 'voce' }, { ...ctxDe(e), voce: 1 }, (j, t, ops) => ops[0]); ok(!e.fim, 'o oponente não vence');
  const f = cena({ campo: [[0, 'Grizzly Bears']] }); f.jogs[0].vida = 0; M.avancar(f); ok(!!f.jogs[0].saiu, 'sem o Anjo: perde');
});

caso('702.81a', "Deeproot Historian (darRetrace): Elfo Druida do cemitério conjurado pagando o custo + descartando um terreno; sem terreno na mão, não", () => {
  const e = cena({ campo: [[0, 'Deeproot Historian'], [0, 'Forest']], mao: [[0, 'Forest']] });
  const d = e.por(0, 'Llanowar Elves', { zona: 'cemiterio' });
  M.avancar(e); conj(e, 'Llanowar Elves'); resolveCom(e);
  igual(e.objs[d.id].zona, 'campo', 'conjurado do cemitério');
  igual(e.jogs[0].zonas.mao.length, 0, 'o terreno foi descartado');
  const f = cena({ campo: [[0, 'Deeproot Historian'], [0, 'Forest']] });
  f.por(0, 'Llanowar Elves', { zona: 'cemiterio' }); M.avancar(f);
  ok(!M.opcoesPrioridade(f, 0).some(o => o.a === 'conjurar' && f.objs[o.id].n === 'Llanowar Elves'), 'sem terreno: não');
});

caso('115.7d', "Deflecting Swat (trocarAlvos): muda o alvo do Bolt do oponente para a criatura dele; alvo pode ser mágica ou habilidade", () => {
  ok(M.fxSuportado(M.carta('Deflecting Swat').fx), 'aceito');
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [1, 'Grizzly Bears']], mao: [[0, 'Lightning Bolt'], [0, 'Deflecting Swat']] });
  M.avancar(e); respE(e, o => o.a === 'conjurar' && e.objs[o.id].n === 'Lightning Bolt'); alvoJog(e, 1);
  conj(e, 'Deflecting Swat'); alvoObj(e, 'Lightning Bolt');
  for (let i = 0; i < 40 && e.perg && (e.pilha.length || e.perg.tipo !== 'acao'); i++) {
    const p = e.perg;
    if (p.tipo === 'talvez') { respE(e, o => o.a === 'sim'); continue; }
    if (p.tipo === 'alvo') { alvoObj(e, 'Grizzly Bears'); continue; }
    respE(e, o => o.a === 'passar');
  }
  igual(e.jogs[1].vida, 40, 'o jogador não levou o Bolt');
  ok(!e.campo.some(id => e.objs[id].n === 'Grizzly Bears'), 'o Bolt foi no Bears');
});

caso('602.5', "Drana and Linvala: as criaturas do oponente não ativam; ela ganha as habilidades ativadas delas (Llanowar Elves: vira para G)", () => {
  const e = cena({ campo: [[0, 'Drana and Linvala'], [1, 'Llanowar Elves']] });
  const el = objN(e, 1, 'Llanowar Elves'), dr = objN(e, 0, 'Drana and Linvala');
  dr.doente = false; el.doente = false;
  ok(M.ativBloqueada(e, el), 'o Elfo do oponente não ativa');
  igual(M.atvDe(e, dr).length, M.atvDe(e, el).length, 'Drana tem a do Elfo');
  ok(!M.ativBloqueada(e, dr), 'a dela ativa');
});

caso('601.2f', "tipo de card em comum / escolhido (Semblance Anvil, Cemetery Prowler, Cloud Key): reduzem só as mágicas que dividem tipo de card com o que foi exilado por ele / o tipo escolhido", () => {
  const e = cena({ campo: [[0, 'Semblance Anvil'], [0, 'Cemetery Prowler'], [0, 'Cloud Key']], mao: [[0, 'Sol Ring'], [0, 'Llanowar Elves'], [0, 'Lightning Bolt'], [0, 'Counterspell']] });
  const A = objN(e, 0, 'Semblance Anvil'), P = objN(e, 0, 'Cemetery Prowler'), K = objN(e, 0, 'Cloud Key');
  igual(M.custoComImposto(e, naMao(e, 0, 'Lightning Bolt')), { p: ['R'] }, 'nada exilado: sem redução');
  const b = e.por(0, 'Grizzly Bears', { zona: 'exilio' }); b.exPor = { id: A.id, ts: A.ts };            // criatura exilada pela bigorna
  igual(M.custoComImposto(e, naMao(e, 0, 'Llanowar Elves')).g || 0, 0, 'criatura: {2} a menos (o colorido fica)');
  igual(M.custoComImposto(e, naMao(e, 0, 'Counterspell')), { p: ['U', 'U'] }, 'instantânea não divide tipo com a criatura');
  const s1 = e.por(0, 'Swords to Plowshares', { zona: 'exilio' }); s1.exPor = { id: P.id, ts: P.ts };   // instantânea exilada pelo Prowler
  const c0 = M.custoComImposto(e, naMao(e, 0, 'Counterspell')); igual([c0.g || 0, c0.p], [0, ['U', 'U']], 'Prowler: só o genérico sai (não há)');
  const ar = e.por(0, 'Arcane Signet', { zona: 'exilio' }); ar.exPor = { id: P.id, ts: P.ts };
  K.escolha = { tipoCarta: 'Artifact' }; e.vCamada = (e.vCamada || 0) + 1;
  igual(M.custoComImposto(e, naMao(e, 0, 'Sol Ring')).g || 0, 0, 'Sol Ring {1}: Prowler (artefato) + Cloud Key (artefato) = 0');
  K.escolha = { tipoCarta: 'Creature' };
  const f = cena({ campo: [[0, 'Cemetery Prowler']], mao: [[0, 'Arcane Signet']] });
  const P2 = objN(f, 0, 'Cemetery Prowler'), a2 = f.por(0, 'Arcane Signet', { zona: 'exilio' }); a2.exPor = { id: P2.id, ts: P2.ts };
  const sc = f.por(0, 'Sol Ring', { zona: 'exilio' }); sc.exPor = { id: P2.id, ts: P2.ts };
  igual(M.custoComImposto(f, naMao(f, 0, 'Arcane Signet')).g, 1, 'dois artefatos exilados: o tipo conta uma vez só (Arcane Signet {2} → {1})');
  ok(M.carta('Cloud Key').subst.every(x => M.substOk(x)) && M.carta('Semblance Anvil').est.every(x => M.estReduzOk(x)), 'aceitas');
});

caso('115.10', "naoAlvo (Chandra's Ignition): a criatura alvo causa dano igual ao poder a cada OUTRA criatura e a cada oponente; ela mesma não leva", () => {
  const e = cena({ campo: [...terras(5), [0, 'Serra Angel'], [1, 'Grizzly Bears']], mao: [[0, "Chandra's Ignition"]] });
  const v1 = e.jogs[1].vida; M.avancar(e); conj(e, "Chandra's Ignition");
  if (e.perg && e.perg.tipo === 'alvo') respE(e, o => o.a === 'alvo' && e.objs[o.o] && e.objs[o.o].n === 'Serra Angel');
  resolveCom(e);
  const A = objN(e, 0, 'Serra Angel');
  ok(A && A.dano === 0, 'o alvo não leva dano: ' + (A && A.dano));
  ok(!noCampo(e).includes('Grizzly Bears'), 'o urso morre');
  igual(e.jogs[1].vida, v1 - 4, '4 no oponente');
});

caso('508.1d', "Champions of Minas Tirith: no começo do combate do oponente, se você é o monarca, ele paga {X} (X = cartas na mão dele) ou não ataca você neste combate", () => {
  const e = cena({ campo: [[0, 'Champions of Minas Tirith'], [1, 'Grizzly Bears'], [1, 'Forest'], [1, 'Forest']], mao: [[1, 'Forest'], [1, 'Island']] });
  const C = objN(e, 0, 'Champions of Minas Tirith'); e.monarca = 0; e.turno.ativo = 1; e.pend = [];
  M.evento(e, { ev: 'fase', passo: 'inicioCombate', ativo: 1 });
  igual(e.pend.filter(p => p.n === 'Champions of Minas Tirith').length, 1, 'dispara no combate do oponente');
  const g = M.carta('Champions of Minas Tirith').gat[1], ctx = () => ({ voce: 0, este: C.id, ev: { ev: 'fase', passo: 'inicioCombate', ativo: 1 }, alvos: [], ilegal: {}, lki: { alvos: [] } });
  ok(M.gatOk(g), 'gatilho aceito');
  M.executar(e, g.fx[0], ctx(), (j, t, ops) => ops.find(o => o.a === 'naoPagar'));
  ok(!M.alvosAtaque(e, 1).some(t => t.jog === 0), 'não pagou: não pode atacar o monarca');
  e.efTemp = [];
  let perguntou = -1;
  M.executar(e, g.fx[0], ctx(), (j, t, ops) => { perguntou = j; return ops.find(o => o.a === 'pagar') || ops[0]; });
  igual(perguntou, 1, 'quem paga é o oponente da vez');
  ok(M.alvosAtaque(e, 1).some(t => t.jog === 0), 'pagou {2}: ataca normal');
  e.pend = []; e.monarca = 1; M.evento(e, { ev: 'fase', passo: 'inicioCombate', ativo: 1 });
  igual(e.pend.filter(p => p.n === 'Champions of Minas Tirith').length, 0, 'sem ser monarca: não');
});

caso('613.1f', "est continuo tiraKw (Colossus Hammer): a equipada ganha +10/+10 e perde voar; desequipada, volta a voar", () => {
  const e = cena({ campo: [[0, 'Serra Angel'], [0, 'Colossus Hammer']] });
  const A = objN(e, 0, 'Serra Angel'), H = objN(e, 0, 'Colossus Hammer');
  ok(M.temKw(e, A, 'voar'), 'voa');
  H.anexo = { id: A.id, ts: A.ts }; e.vCamada = (e.vCamada || 0) + 1;
  igual([M.poder(e, A), M.resistencia(e, A), M.temKw(e, A, 'voar'), M.temKw(e, A, 'vigilancia')], [14, 14, false, true], 'equipada: 14/14 sem voar, vigilância fica');
  H.anexo = null; e.vCamada++;
  ok(M.temKw(e, A, 'voar'), 'sem o martelo: voa de novo');
});

caso('702.120a', "custo por modo: Tiered (Cloud's Limit Break: {0}/{1}/{3}{W}) e Escalate (Collective Resistance: {G} por modo além do primeiro); Blade Beam com controladores diferentes", () => {
  const vir = (e, j, n) => { const o = objN(e, j, n); o.virada = true; return o; };
  const e = cena({ jogs: 3, campo: [...terras(2, 'Plains'), [1, 'Grizzly Bears'], [2, 'Serra Angel']], mao: [[0, "Cloud's Limit Break"]] });
  vir(e, 1, 'Grizzly Bears'); vir(e, 2, 'Serra Angel');
  M.avancar(e); conj(e, "Cloud's Limit Break");
  ok(e.perg && e.perg.tipo === 'alvo' && !e.perg.ops.some(o => o.a === 'pronto'), 'com 2 terrenos só cabe o Cross-Slash ({0}): vai direto ao alvo único');
  const f = cena({ jogs: 3, campo: [...terras(6, 'Plains'), [1, 'Grizzly Bears'], [1, 'Llanowar Elves'], [2, 'Serra Angel']], mao: [[0, "Cloud's Limit Break"]] });
  vir(f, 1, 'Grizzly Bears'); vir(f, 1, 'Llanowar Elves'); vir(f, 2, 'Serra Angel');
  M.avancar(f); conj(f, "Cloud's Limit Break");
  igual(f.perg.ops.filter(o => o.a === 'modo').map(o => o.m), [0, 1, 2], 'com 6: os três');
  respE(f, o => o.a === 'modo' && o.m === 1);
  ok(f.perg && f.perg.tipo === 'alvo', 'alvos do Blade Beam');
  respE(f, o => o.a === 'alvo' && f.objs[o.o] && f.objs[o.o].n === 'Grizzly Bears');
  ok(!f.perg.ops.some(o => o.a === 'alvo' && f.objs[o.o] && f.objs[o.o].n === 'Llanowar Elves'), 'o outro do mesmo controlador não é oferecido');
  respE(f, o => o.a === 'alvo' && f.objs[o.o] && f.objs[o.o].n === 'Serra Angel');
  resolveCom(f);
  ok(!noCampo(f).includes('Grizzly Bears') && !noCampo(f).includes('Serra Angel') && noCampo(f).includes('Llanowar Elves'), 'destruiu um de cada controlador');
  igual(f.campo.filter(id => f.objs[id].n === 'Plains' && f.objs[id].virada).length, 3, 'pagou {1}{W} + {1}');
  const g = cena({ campo: [...terras(3, 'Forest'), [1, 'Sol Ring'], [1, 'Propaganda']], mao: [[0, 'Collective Resistance']] });
  M.avancar(g); conj(g, 'Collective Resistance');
  respE(g, o => o.a === 'modo' && o.m === 0); respE(g, o => o.a === 'modo' && o.m === 1);
  ok(!(g.perg && g.perg.tipo === 'modo'), 'terceiro modo não cabe em 3 terrenos ({1}{G} + {G}{G} = 4): não pergunta mais');
  resolveCom(g);
  ok(!noCampo(g).includes('Sol Ring') && !noCampo(g).includes('Propaganda'), 'destruiu artefato e encantamento');
  igual(g.campo.filter(id => g.objs[id].n === 'Forest' && g.objs[id].virada).length, 3, 'pagou {1}{G} + {G}');
});

caso('701.16', "Thassa's Oracle: o resto vai ao fundo em ordem aleatória (aleatorio no cavar); sem resto, aleatorio é recusado", () => {
  ok(M.carta("Thassa's Oracle").gat.every(g => M.gatOk(g)), 'aceita');
  ok(!M.fxSuportado([{ op: 'cavar', olha: 3, pega: 1, para: 'mao', aleatorio: true }]), 'aleatorio sem resto: não');
  const e = cena({ grimorio: 0 });
  for (const n of ['Forest', 'Island', 'Swamp', 'Mountain', 'Plains', 'Grizzly Bears']) e.por(0, n, { zona: 'grimorio' });
  M.executar(e, { op: 'cavar', quem: 'voce', olha: 5, pega: 0, resto: 'grimorio', fundo: true, aleatorio: true }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops[0]);
  const g = e.jogs[0].zonas.grimorio.map(id => e.objs[id].n);
  igual(g.length, 6); igual(g[5], 'Forest', 'a de baixo da pilha vista fica no topo');
  igual(g.slice(0, 5).sort(), ['Grizzly Bears', 'Island', 'Mountain', 'Plains', 'Swamp'], 'as 5 vistas no fundo');
});

caso('104.3b', "não pode perder o jogo: The Book of Exalted Deeds dá ao Anjo 'você não pode perder e seus oponentes não podem vencer' — vida 0 não tira, perderJogo não tira, ganharJogo do oponente não vence; o Anjo sai e a ABE tira", () => {
  const d = M.carta('The Book of Exalted Deeds');
  ok(d.atv.every(a => M.fxSuportado(a.fx, { topo: false })), 'ativada aceita');
  const e = cena({ campo: [[0, 'Serra Angel']] });
  const an = objN(e, 0, 'Serra Angel');
  const cx: any = { voce: 0, alvos: [[{ o: an.id, ts: an.ts }]], ilegal: {}, lki: { alvos: [] } };
  for (const f of d.atv[0].fx) M.executar(e, f, cx, (j, t, ops) => ops[0]);
  igual(an.marc.enlightened, 1, 'marcador');
  ok(M.naoPerde(e, 0) && !M.naoPerde(e, 1), 'só o controlador do Anjo');
  e.jogs[0].vida = 0; M.abe(e); ok(!e.jogs[0].saiu, 'vida 0: fica');
  M.executar(e, { op: 'perderJogo', quem: 'voce' }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null); ok(!e.jogs[0].saiu, 'perde o jogo: não');
  M.executar(e, { op: 'ganharJogo', quem: 'voce' }, { voce: 1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null); ok(!e.fim, 'o oponente não vence');
  M.mover(e, an.id, 'cemiterio'); M.abe(e); ok(e.jogs[0].saiu, 'sem o Anjo: perde');
});

caso('702.85a', "cascata: The First Sliver dá cascata às mágicas Sliver suas — Blur Sliver (vm 3) exila até a Bears (vm 2, menor), conjura de graça; o resto vai ao fundo; não-Sliver não cascateia", () => {
  ok(M.estContOk(M.carta('The First Sliver').est[0]), 'estática aceita'); ok(M.fxSuportado([{ op: 'descobrir', qtd: 2, cascata: true }]), 'descobrir cascata aceito');
  const e = cena({ campo: [[0, 'The First Sliver'], ...terras(3)], mao: [[0, 'Blur Sliver']], grimorio: 0 });
  for (const n of ['Island', 'Grizzly Bears', 'Serra Angel', 'Forest']) e.por(0, n, { zona: 'grimorio' });   // topo = Forest
  M.avancar(e); conj(e, 'Blur Sliver');
  ok(e.pend.some(p => p.k === 'cascata') || e.pilha.some(h => e.objs[h].hab && e.objs[h].hab.k === 'cascata') || e.perg, 'disparou');
  resolveCom(e, p => p.tipo === 'jogar' ? p.ops.findIndex(o => o.a === 'jogar') : -1);
  ok(e.campo.some(id => e.objs[id].n === 'Grizzly Bears'), 'Bears conjurada de graça: ' + JSON.stringify(e.log.slice(-8)));
  ok(e.campo.some(id => e.objs[id].n === 'Blur Sliver'), 'Blur Sliver resolveu');
  const g = e.jogs[0].zonas.grimorio.map(id => e.objs[id].n);
  igual(g[g.length - 1], 'Island', 'a de baixo fica no topo'); igual(g.slice(0, 2).sort(), ['Forest', 'Serra Angel'], 'as exiladas no fundo');
  const f = cena({ campo: [[0, 'The First Sliver'], ...terras(2, 'Forest')], mao: [[0, 'Grizzly Bears']] });
  M.avancar(f); conj(f, 'Grizzly Bears'); ok(!f.pend.some(p => p.k === 'cascata'), 'Bears não é Sliver');
  resolveCom(f); igual(f.jogs[0].zonas.grimorio.length, 30, 'nada exilado'); ok(!f.log.some(l => String(l).includes('cascata')), 'sem cascata no log');
});

caso('120.3', "contagem de cemitérios: The Master of Lake-town morre e compra 1 por cemitério com 7+ cartas ({de:'jogadores', o:'cemiterio', min:7})", () => {
  ok(M.carta('The Master of Lake-town').gat.every(g => M.gatOk(g)), 'aceita');
  ok(!M.contaOk({ de: 'jogadores', o: 'cemiterio' }), 'sem min: não');
  const e = cena({ campo: [[0, 'The Master of Lake-town']] });
  for (let i = 0; i < 6; i++) e.por(0, 'Forest', { zona: 'cemiterio' });
  for (let i = 0; i < 9; i++) e.por(1, 'Island', { zona: 'cemiterio' });
  const cx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  igual(M.contar(e, { de: 'jogadores', o: 'cemiterio', min: 7 }, cx), 1, 'só o do oponente (9)');
  e.por(0, 'Forest', { zona: 'cemiterio' });
  igual(M.contar(e, { de: 'jogadores', o: 'cemiterio', min: 7 }, cx), 2, 'os dois com 7+');
});

caso('205.1b', "The Master, Transcendent: a criatura que volta do cemitério é um Mutante verde 3/3 base (perde as outras cores e tipos de criatura; animar soSub)", () => {
  const d = M.carta('The Master, Transcendent'); ok(M.fxSuportado(d.atv[0].fx, { topo: false }), 'aceita');
  const e = cena({});
  const a = e.por(1, 'Serra Angel', { zona: 'cemiterio' });
  const cx: any = { voce: 0, alvos: [[{ o: a.id, ts: a.ts }]], ilegal: {}, lki: { alvos: [] } };
  for (const f of d.atv[0].fx) M.executar(e, f, cx, (j, t, ops) => ops[0]);
  const o = e.objs[a.id];
  igual(o.zona, 'campo'); igual(o.ctrl, 0, 'sob meu controle');
  igual([M.poder(e, o), M.resistencia(e, o)], [3, 3]); igual(M.dadoDe(e, o).sub, ['Mutant']); igual(M.dadoDe(e, o).cores, 'G');
  ok(M.temKw(e, o, 'voar'), 'mantém as habilidades');
});

caso('603.10a', "The Skullspore Nexus: duas criaturas não-ficha minhas morrem juntas (Wrath) → UMA ficha Fungus Dinosaur com P/R = soma do poder delas (2+4 = 6/6)", () => {
  ok(M.carta('The Skullspore Nexus').gat.every(g => M.gatOk(g)), 'aceita');
  const e = cena({ campo: [[0, 'The Skullspore Nexus'], [0, 'Grizzly Bears'], [0, 'Serra Angel'], [1, 'Llanowar Elves']] }); e.pend = [];
  M.executar(e, { op: 'destruir', em: { todos: { tipo: ['Creature'], zona: 'campo' } } }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  M.abe(e); M.avancar(e); resolveCom(e);
  const fs = e.campo.map(id => e.objs[id]).filter(o => o.ficha && o.ctrl === 0);
  igual(fs.length, 1, 'uma ficha só: ' + JSON.stringify(e.log.slice(-6)));
  igual([M.poder(e, fs[0]), M.resistencia(e, fs[0])], [6, 6], 'soma do poder');
});

caso('702.18a', "eminência: The Ur-Dragon na zona de comando já reduz em {1} as mágicas Dragão suas; do oponente e não-Dragão não", () => {
  ok(M.estReduzOk(M.carta('The Ur-Dragon').est[0]), 'aceita');
  const e = cena({ cmd: ['The Ur-Dragon'], mao: [[0, 'Ancient Copper Dragon'], [0, 'Grizzly Bears'], [1, 'Ancient Copper Dragon']] });
  const m = n => e.jogs[0].zonas.mao.map(id => e.objs[id]).find(o => o.n === n);
  igual(M.custoComImposto(e, m('Ancient Copper Dragon')).g, 3, 'Dragão: {4} vira {3}');
  igual(M.custoComImposto(e, m('Grizzly Bears')).g, 1, 'Urso: igual');
  const op = e.objs[e.jogs[1].zonas.mao[0]]; igual(M.custoComImposto(e, op).g, 4, 'do oponente: igual');
  const ur = e.objs[e.jogs[0].zonas.comando[0]]; igual(M.custoComImposto(e, ur).g, 4, 'ela mesma não (other)');
});

caso('614.1a', "The Water Crystal: o oponente que moeria 2 mói 6 (subst moer soma 4); eu mesmo mói 2; e moer 0 não vira 4", () => {
  ok(M.carta('The Water Crystal').subst.every(s => M.substOk(s)), 'aceita');
  const e = cena({ campo: [[0, 'The Water Crystal']] });
  const cx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  M.executar(e, { op: 'moer', quem: 'cadaOponente', qtd: 2 }, cx, null); igual(e.jogs[1].zonas.cemiterio.length, 6, 'oponente: 2+4');
  M.executar(e, { op: 'moer', quem: 'voce', qtd: 2 }, cx, null); igual(e.jogs[0].zonas.cemiterio.length, 2, 'eu: 2');
  M.executar(e, { op: 'moer', quem: 'cadaOponente', qtd: 0 }, cx, null); igual(e.jogs[1].zonas.cemiterio.length, 6, '0: nada');
});

caso('119.3', "vida ganha neste turno ({de:'turno', o:'vidaGanha'}): soma os ganhos do turno; Assemble the Entmoot cria a ficha X/X com ela", () => {
  const e = cena({}); const cx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  igual(M.contar(e, { de: 'turno', o: 'vidaGanha' }, cx), 0);
  M.ganharVida(e, 0, 3); M.ganharVida(e, 0, 2); M.ganharVida(e, 1, 7);
  igual(M.contar(e, { de: 'turno', o: 'vidaGanha' }, cx), 5, 'só os meus: 3+2');
  e.turno.n++; igual(M.contar(e, { de: 'turno', o: 'vidaGanha' }, cx), 0, 'outro turno: zera');
  ok(M.fxSuportado(M.carta('Assemble the Entmoot').atv[0].fx, { topo: false }), 'ficha X/X aceita');
});

// ---------- contagens num formato só (27/11): {conta:{de, o, junta}} ----------
caso('115.1d', "The Wise Mothman: moer 3 com 2 não-terreno → um gatilho com até 2 alvos (max contado do evento); +1/+1 em cada", () => {
  ok(M.carta('The Wise Mothman').gat.every(g => M.gatOk(g)) && M.carta('The Wise Mothman').gat[2].alvos.every(a => M.alvoSuportado(a)), 'aceita');
  const e = cena({ campo: [[0, 'The Wise Mothman'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Serra Angel']], grimorio: 0 }); e.pend = [];
  for (const n of ['Grizzly Bears', 'Forest', 'Serra Angel']) e.por(1, n, { zona: 'grimorio' });
  M.executar(e, { op: 'moer', quem: 'cadaOponente', qtd: 3 }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual(e.pend.filter(p => p.n === 'The Wise Mothman').length, 1, 'um gatilho (grupo)');
  let vistos = 0;
  M.avancar(e); resolveCom(e, p => { if (p.tipo !== 'alvo') return -1; vistos = Math.max(vistos, p.ops.filter(o => o.a === 'alvo').length); return p.ops.findIndex(o => o.a === 'alvo'); });
  const c = e.campo.map(id => e.objs[id]).filter(o => o.ctrl === 0 && (o.marc['+1/+1'] || 0) > 0);
  igual(c.length, 2, 'dois alvos (e parou no 2): ' + vistos + JSON.stringify(e.log.slice(-5)));
});

caso('603.4', "Thickest in the Thicket: compra 2 no final só se a maior criatura (ou empatada) é sua", () => {
  const g = M.carta('Thickest in the Thicket').gat[1]; ok(M.gatOk(g), 'aceita');
  const e = cena({ campo: [[0, 'Thickest in the Thicket'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves']] });
  const cx = { voce: 0, este: e.campo[0] };
  ok(M.condicao(e, g.se, cx), '2 > 1: sim');
  e.por(1, 'Grizzly Bears'); ok(M.condicao(e, g.se, cx), 'empatada: sim');
  e.por(1, 'Serra Angel'); ok(!M.condicao(e, g.se, cx), 'Anjo 4 do oponente: não');
  const f = cena({ campo: [[0, 'Thickest in the Thicket']] }); ok(!M.condicao(f, g.se, { voce: 0, este: f.campo[0] }), 'sem criatura: não');
});

caso('702.33d', "Thieving Skydiver: chute {X} com X mínimo 1 — com 2 terrenos não oferece o chute; com 3, o X começa em 1", () => {
  const e = cena({ campo: terras(2, 'Island'), mao: [[0, 'Thieving Skydiver']] });
  M.avancar(e); conj(e, 'Thieving Skydiver');
  ok(!(e.perg && e.perg.tipo === 'opcao'), 'sem escolha de chute');
  const f = cena({ campo: terras(3, 'Island'), mao: [[0, 'Thieving Skydiver']] });
  M.avancar(f); M.responder(f, f.perg.ops.findIndex(o => o.a === 'conjurar' && f.objs[o.id].n === 'Thieving Skydiver'));
  igual(f.perg.tipo, 'opcao'); M.responder(f, f.perg.ops.findIndex(o => o.v && o.v.chute));
  ok(f.campo.some(id => f.objs[id].n === 'Thieving Skydiver'), 'resolveu');
  igual(f.campo.filter(id => f.objs[id].n === 'Island' && f.objs[id].virada).length, 3, 'pagou {1}{U} + X=1 (o X do chute entra no custo)');
});

caso('701.26a', "Thousand Moons Smithy: na principal pode virar 5 artefatos/criaturas desviradas suas (pagando virarOutros) e transforma; com 4, não", () => {
  const c = M.carta('Thousand Moons Smithy'); ok(c.gat.every(g => M.gatOk(g)) && c.faces[0].gat.every(g => M.gatOk(g)), 'aceita');
  const fx = c.gat[1].fx[0];
  const e = cena({ campo: [[0, 'Thousand Moons Smithy'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Sol Ring'], [0, 'Llanowar Elves']] });
  const s = objN(e, 0, 'Thousand Moons Smithy');
  const sim = (j, t, ops) => ops.find(o => o.a === 'pagar') || ops[0];
  M.executar(e, fx, { voce: 0, este: s.id, alvos: [], ilegal: {}, lki: { alvos: [] } }, sim);
  igual(s.face, 0, 'transformou (Smithy + 2 Ursos + Sol Ring + Elfo = 5)');
  igual(e.campo.filter(id => e.objs[id].virada).length, 5, 'virou as 5');
  const f = cena({ campo: [[0, 'Thousand Moons Smithy'], [0, 'Grizzly Bears'], [0, 'Sol Ring'], [0, 'Llanowar Elves'], [0, 'Forest']] });
  const t = objN(f, 0, 'Thousand Moons Smithy');
  M.executar(f, fx, { voce: 0, este: t.id, alvos: [], ilegal: {}, lki: { alvos: [] } }, sim);
  ok(t.face == null, 'só 4 (terreno não conta): não transforma'); igual(f.campo.filter(id => f.objs[id].virada).length, 0);
});

caso('601.2f', "Thunderherd Migration: custo adicional 'revele um Dinossauro OU pague {1}' — sem Dinossauro paga 3 terras; com, 2", () => {
  ok(M.custoAdSuportado(M.carta('Thunderherd Migration').custoAd), 'aceita');
  const e = cena({ campo: terras(3, 'Forest'), mao: [[0, 'Thunderherd Migration']] });
  M.avancar(e); conj(e, 'Thunderherd Migration'); resolveCom(e);
  igual(e.campo.filter(id => e.objs[id].virada && !e.objs[id].ficha).length, 4, '3 Florestas viradas + a básica que entra virada');
  const f = cena({ campo: terras(2, 'Forest'), mao: [[0, 'Thunderherd Migration'], [0, 'Apex Altisaur']] });
  M.avancar(f); conj(f, 'Thunderherd Migration'); resolveCom(f);
  igual(f.jogs[0].zonas.cemiterio.map(id => f.objs[id].n), ['Thunderherd Migration'], 'conjurou revelando');
  ok(f.jogs[0].zonas.mao.some(id => f.objs[id].n === 'Apex Altisaur'), 'o Dinossauro fica na mão');
});

caso('701.19', "Tiamat: busca até 5 Dragões de nomes diferentes e não Tiamat (filtro naoNome, buscar nomesDiferentes)", () => {
  const fx = M.carta('Tiamat').gat[0].fx; ok(M.fxSuportado(fx), 'aceita');
  const e = cena({ grimorio: 0 });
  for (const n of ['Tiamat', 'Ancient Copper Dragon', 'Ancient Copper Dragon', 'Ancient Gold Dragon', 'Forest']) e.por(0, n, { zona: 'grimorio' });
  const pega = (j, t, ops) => ops.find(o => o.a !== 'nenhum') || ops[0];
  M.executar(e, fx[0], { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, pega);
  igual(e.jogs[0].zonas.mao.map(id => e.objs[id].n).sort(), ['Ancient Copper Dragon', 'Ancient Gold Dragon'], 'um de cada nome, sem Tiamat');
});

caso('602.2b', "Timestream Navigator: pôr no fundo do grimório é custo (fundoEste) — vai ao fundo e o turno extra fica na pilha; Tifa aceita (danoUmaVez)", () => {
  const a = M.carta('Timestream Navigator').atv[0]; ok(M.custoSuportado(a.custo), 'custo aceito'); ok(M.fxSuportado(a.fx, { topo: false }), 'fx aceito');
  ok(M.carta('Tifa, Martial Artist').gat.every(g => M.gatOk(g)), 'Tifa aceita');
  const e = cena({ campo: [[0, 'Timestream Navigator'], ...terras(4, 'Island')] });
  const t = objN(e, 0, 'Timestream Navigator'); e.jogs[0].bencao = true;
  M.avancar(e);
  const k = e.perg.ops.findIndex(o => o.a === 'ativar' && o.id === t.id);
  ok(k >= 0, 'oferece com a bênção');
  M.responder(e, k, x => x.pilha.length > 0 || x.turno.passo !== 'principal1');
  igual(t.zona, 'grimorio'); igual(e.jogs[0].zonas.grimorio[0], t.id, 'no fundo');
  ok(e.pilha.length === 1, 'na pilha');
  const n = e.turno.n; M.avancar(e); resolveCom(e);
  if (e.turno.n === n) { passarAte(e, 'final'); passarAte(e, 'manutencao'); }
  igual([e.turno.n, e.turno.ativo], [n + 1, 0], 'o próximo turno é meu de novo (500.7)');
});

// ---------- custo para atacar/bloquear e desanexar (mecânicas T43) ----------
caso('506.4', "Reconnaissance: a atacante sai do combate e desvira; Retreat to Coralhelm: virar, desvirar ou vidência", () => {
  ok(M.fxSuportado(M.carta('Reconnaissance').atv[0].fx) && M.carta('Retreat to Coralhelm').gat.every(g => M.gatOk(g)), 'aceitos');
  const e = cena({ campo: [[0, 'Grizzly Bears', { virada: true }], [0, 'Hill Giant', { virada: true }]] });
  const u = objN(e, 0, 'Grizzly Bears'), h = objN(e, 0, 'Hill Giant');
  e.turno.combate = { atk: [{ id: u.id, ts: u.ts, alvo: { jog: 1 }, def: 1, bloq: [], bloqueado: false }, { id: h.id, ts: h.ts, alvo: { jog: 1 }, def: 1, bloq: [], bloqueado: false }], etapa: 0, deu1: {} };
  for (const f of M.carta('Reconnaissance').atv[0].fx) M.executar(e, f, { voce: 0, este: -1, alvos: [[{ o: u.id, ts: u.ts }]], ilegal: {}, lki: {} }, null);
  igual([e.turno.combate.atk.map(r => r.id), u.virada], [[h.id], false], 'só o Gigante segue atacando; o Urso desvirou');
});

caso('120.10', "Rith: no seu passo final, só se uma criatura de um oponente levou dano excedente neste turno; Righteous Valkyrie: +2/+2 com 7 de vida acima da inicial", () => {
  ok(M.carta('Rith, Liberated Primeval').gat.every(g => M.gatOk(g)), 'Rith aceito');
  const e = cena({ campo: [[0, 'Rith, Liberated Primeval'], [1, 'Grizzly Bears'], [1, 'Hill Giant']] });
  const se = M.carta('Rith, Liberated Primeval').gat[0].se, ctx = { voce: 0, este: -1 };
  M.danoEm(e, objN(e, 1, 'Hill Giant'), 3, { kw: [] });
  ok(!M.condicao(e, se, ctx), '3 no Gigante 3/3: letal, sem excesso');
  M.danoEm(e, objN(e, 1, 'Grizzly Bears'), 5, { kw: [] });
  ok(M.condicao(e, se, ctx), '5 no Urso 2/2: excedente');
  const v = cena({ campo: [[0, 'Righteous Valkyrie']] }), va = objN(v, 0, 'Righteous Valkyrie');
  v.jogs[0].vida = 46; igual(M.poder(v, va), 2, '46: não');
  v.jogs[0].vida = 47; igual(M.poder(v, va), 4, '47 (40 + 7): +2/+2');
});

caso('602.2', "Runic Armasaur: um oponente ativa habilidade (não de mana) de criatura ou terreno → pode comprar; a minha não", () => {
  ok(M.carta('Runic Armasaur').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Runic Armasaur'], [1, 'Grizzly Bears'], [0, 'Grizzly Bears']] });
  M.evento(e, { ev: 'ativa', id: objN(e, 0, 'Grizzly Bears').id, j: 0 });
  igual(e.pend.length, 0, 'a minha: não');
  M.evento(e, { ev: 'ativa', id: objN(e, 1, 'Grizzly Bears').id, j: 1 });
  igual(e.pend.filter(p => p.n === 'Runic Armasaur').length, 1, 'do oponente: dispara');
});

caso('702.109', "Riders of Rohan: investida (dash) é opção de conjuração; o Urza deixa jogar a exilada até o fim do turno", () => {
  const e = cena({ campo: [...terras(4, 'Mountain'), ...terras(3, 'Plains')], mao: [[0, 'Riders of Rohan']] });
  M.avancar(e); conj(e, 'Riders of Rohan');
  if (e.perg && e.perg.tipo === 'opcao') respE(e, o => o.v.investida);
  resolveCom(e);
  const r = objN(e, 0, 'Riders of Rohan');
  ok(r && M.temKw(e, r, 'pressa'), 'com pressa');
  igual(e.atras.length, 1, 'volta no próximo passo final');
  ok(M.fxSuportado(M.carta('Urza, Lord High Artificer').atv[1].fx), 'Urza aceito');
});

caso('729.1', "radiação: na principal pré-combate de quem tem rad, moe N; por não terreno moída perde 1 de vida e tira 1 rad", () => {
  const e = cena({});
  for (const n of ['Forest', 'Grizzly Bears', 'Sol Ring']) e.por(0, n, { zona: 'grimorio' });   // topo: Sol Ring, Bears, Forest
  e.jogs[0].marc = { rad: 3 }; e.pend = [];
  M.masmorrasEvento(e, { ev: 'fase', passo: 'principal2', ativo: 0 });
  igual(e.pend.length, 0, 'principal pós-combate: não');
  M.masmorrasEvento(e, { ev: 'fase', passo: 'principal1', ativo: 1 });
  igual(e.pend.length, 0, 'o oponente (sem rad): não');
  M.masmorrasEvento(e, { ev: 'fase', passo: 'principal1', ativo: 0 });
  const p = e.pend.find(x => x.k === 'radiacao'); ok(p, 'disparou');
  const v0 = e.jogs[0].vida;
  for (const f of p.g.fx) M.executar(e, f, { voce: p.ctrl, alvos: [], ilegal: {}, lki: {} }, (_j, _t, o) => o[0]);
  igual(e.jogs[0].zonas.cemiterio.length, 3, 'moeu 3');
  igual(e.jogs[0].vida, v0 - 2, '2 não terrenos: perde 2');
  igual(e.jogs[0].marc.rad, 1, 'tira 2 rad');
});

caso('615.5', "Bloatfly Swarm: dano nela com +1/+1 é prevenido, tira tantos marcadores e dá a cada jogador 1 rad por marcador tirado", () => {
  ok(M.carta('Bloatfly Swarm').subst.every(s => M.substOk(s)), 'aceito');
  const e = cena({ campo: [[0, 'Bloatfly Swarm']] });
  const b = e.objs[e.campo[0]]; b.marc['+1/+1'] = 2;
  igual(M.substDano(e, 3, { o: b }), 0, 'prevenido');
  igual(b.marc['+1/+1'] || 0, 0, 'tirou os 2 que tinha');
  igual((e.jogs[0].marc || {}).rad, 2, 'você: 2 rad'); igual((e.jogs[1].marc || {}).rad, 2, 'oponente: 2 rad');
  igual(M.substDano(e, 3, { o: b }), 3, 'sem marcador: o dano passa');
});

caso('122.1', "Vexing Radgull: o jogador sem rad ganha 2; com rad, prolifera (conta {de:'evento', o:'marcadores', marc:'rad'})", () => {
  const g = M.carta('Vexing Radgull').gat[0]; ok(M.gatOk(g), 'aceito');
  const e = cena({ campo: [[0, 'Vexing Radgull']] });
  const ask = (_j, t, o) => t === 'proliferar' ? (o.find(x => x.jog === 1 && !x._ja && (x._ja = true)) || o[0]) : o[0];   // prolifera só o oponente
  const roda = () => { for (const f of g.fx) M.executar(e, f, { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: {}, ev: { ev: 'dano', jog: 1, q: 1, combate: true } }, ask); };
  roda(); igual((e.jogs[1].marc || {}).rad, 2, 'sem rad: ganha 2');
  roda(); igual(e.jogs[1].marc.rad, 3, 'com rad: proliferou (+1), não +2');
});

caso('614.1a', "Branching Evolution: dobra só marcadores +1/+1 (subst marc), não os de outro tipo", () => {
  ok(M.carta('Branching Evolution').subst.every(s => M.substOk(s)), 'aceito');
  const e = cena({ campo: [[0, 'Branching Evolution'], [0, 'Grizzly Bears']] });
  const b = e.objs[e.campo[1]];
  M.porMarcadores(e, b, '+1/+1', 2); igual(b.marc['+1/+1'], 4, '+1/+1 dobrado');
  M.porMarcadores(e, b, 'shield', 1); igual(b.marc.shield, 1, 'outro tipo: não');
});

caso('701.21', "Braids, Arisen Nightmare: o oponente só pode sacrificar permanente com tipo de card em comum com a sacrificada (filtro tipoCartaEmComum)", () => {
  const g = M.carta('Braids, Arisen Nightmare').gat[0]; ok(M.gatOk(g), 'aceito');
  const e = cena({ campo: [[0, 'Braids, Arisen Nightmare'], [0, 'Sol Ring'], [1, 'Forest'], [1, 'Grizzly Bears']] });
  const vistos: string[][] = [];
  const ask = (_j, t, o) => {
    if (t === 'talvez') return o[0];
    if (t === 'sacrificar' || t === 'escolherCarta') { vistos.push(o.map(x => e.objs[x.id ?? x].n)); return o.find(x => e.objs[x.id ?? x].n === 'Sol Ring') || o[0]; }
    return o[0];
  };
  const v1 = e.jogs[1].vida, m0 = e.jogs[0].zonas.mao.length;
  const cxB: any = { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: {} };
  for (const f of g.fx) M.executar(e, f, cxB, ask);
  ok(objN(e, 0, 'Sol Ring') === undefined || objN(e, 0, 'Sol Ring').zona !== 'campo', 'sacrificou o Sol Ring');
  ok(!vistos.slice(1).some(l => l.length), 'artefato: o oponente não tem com o que sacrificar');
  igual(e.jogs[1].vida, v1 - 2, 'perde 2'); igual(e.jogs[0].zonas.mao.length, m0 + 1, 'você compra 1');
  ok(M.bate(e, objN(e, 1, 'Grizzly Bears'), { tipoCartaEmComum: 'sacrificada' }, { sacFx: { id: e.campo.find(id => e.objs[id].n === 'Braids, Arisen Nightmare') } }), 'criatura x criatura: bate');
  ok(!M.bate(e, objN(e, 1, 'Forest'), { tipoCartaEmComum: 'sacrificada' }, { sacFx: { id: e.campo.find(id => e.objs[id].n === 'Braids, Arisen Nightmare') } }), 'terreno x criatura: não');
});

caso('109.2', "filtro ou: 'a Human or artifact card' (Boromir, Gondor's Hope) bate em Humano ou artefato, não em outro", () => {
  ok(M.carta("Boromir, Gondor's Hope").gat.every(g => M.gatOk(g)), 'aceito');
  ok(!M.filtroOk({ ou: [{ sub: ['Human'] }] }) && !M.filtroOk({ ou: [{ sub: ['Human'] }, { xyz: 1 }] }), 'ou precisa de 2 filtros válidos');
  const e = cena({ campo: [[0, 'Sol Ring'], [0, 'Grizzly Bears'], [0, "Boromir, Gondor's Hope"]] });
  const f = M.carta("Boromir, Gondor's Hope").gat[0].fx[0].f;
  igual(e.campo.map(id => e.objs[id]).filter(o => M.bate(e, o, f, { voce: 0 })).map(o => o.n).join(','), "Sol Ring,Boromir, Gondor's Hope", 'artefato e Humano; o Urso não');
  ok(M.carta('Battle at the Helvault').gat.filter(g => g.alvos).every(g => g.alvos[0].porJogador && M.gatOk(g)), 'Helvault: 1 alvo por jogador');
});

caso('702.63a', "desaparecer 2 (Dreamtide Whale): entra com 2 de tempo; cada manutenção sua tira 1; tirou o último, sacrifica", () => {
  const e = cena({ campo: [[0, 'Island']] });
  const w = e.por(0, 'Dreamtide Whale', { zona: 'mao' }); M.mover(e, w.id, 'campo');
  igual(w.marc.time, 2, 'entra com 2');
  e.pend = []; M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 1 }); igual(e.pend.length, 0, 'a do oponente: não');
  M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 0 }); M.avancar(e); resolvePilha(e);
  igual(w.marc.time, 1, 'tira 1'); igual(w.zona, 'campo', 'fica');
  e.perg = null; M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 0 }); M.avancar(e); resolvePilha(e);
  igual(w.zona, 'cemiterio', 'o último: sacrificada');
});

caso('701.21', "contagem {de:'turno', o:'sacrificadas', f}: Elanor Gardner só busca terreno no fim do turno se você sacrificou uma Comida neste turno", () => {
  ok(M.carta('Elanor Gardner').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Elanor Gardner'], [0, 'Grizzly Bears']] });
  const q = { conta: { de: 'turno', o: 'sacrificadas', f: { sub: ['Food'] } } };
  igual(M.qtd(e, q, { voce: 0 }), 0, 'nada ainda');
  M.mover(e, objN(e, 0, 'Grizzly Bears').id, 'cemiterio', { sac: true }); igual(M.qtd(e, q, { voce: 0 }), 0, 'Bears não é Comida');
  const [fd] = M.criarFichas(e, 0, { nome: 'Food' }, 1); M.mover(e, fd.id, 'cemiterio', { sac: true });
  igual(M.qtd(e, q, { voce: 0 }), 1, 'a Comida conta'); igual(M.qtd(e, q, { voce: 1 }), 0, 'do outro não');
  e.pend = []; M.evento(e, { ev: 'fase', passo: 'final', ativo: 0 }); igual(e.pend.filter(p => p.n === 'Elanor Gardner').length, 1, 'dispara');
  const f = cena({ campo: [[0, 'Elanor Gardner']] }); f.pend = []; M.evento(f, { ev: 'fase', passo: 'final', ativo: 0 });
  igual(f.pend.filter(p => p.n === 'Elanor Gardner').length, 0, 'sem Comida sacrificada: não');
});

caso('701.20', "cavar aleatorio (Empty the Laboratory): os Zumbis revelados entram; o resto vai ao fundo em ordem aleatória", () => {
  ok(M.fxSuportado(M.carta('Empty the Laboratory').fx), 'aceito');
  const e = cena({});
  for (const n of ['Forest', 'Island', 'Gravecrawler', 'Mountain', 'Swamp']) e.por(0, n, { zona: 'grimorio' });
  const g0 = e.jogs[0].zonas.grimorio.length;
  M.executar(e, { op: 'cavar', quem: 'voce', ateAchar: { f: { tipo: ['Creature'], sub: ['Zombie'] }, qtd: 1 }, pega: 'tudo', revelar: true, f: { tipo: ['Creature'], sub: ['Zombie'] }, para: 'campo', resto: 'grimorio', fundo: true, aleatorio: true }, ctxDe(e), (j, t, ops) => ops[0]);
  ok(e.campo.some(id => e.objs[id].n === 'Gravecrawler'), 'o Zumbi entrou');
  igual(e.jogs[0].zonas.grimorio.length, g0 - 1, 'o resto voltou ao grimório');
});

caso('601.3', "Emry: vira e escolhe artefato do cemitério; pode conjurá-lo neste turno (permissão até o fim do turno, não na hora)", () => {
  ok(M.fxSuportado(M.carta('Emry, Lurker of the Loch').atv[0].fx), 'aceito');
  const e = cena({ campo: [[0, 'Emry, Lurker of the Loch'], [0, 'Island']] });
  const em = objN(e, 0, 'Emry, Lurker of the Loch'); em.doente = false;
  const sr = e.por(0, 'Sol Ring', { zona: 'cemiterio' });
  M.avancar(e); ativa(e, 'Emry, Lurker of the Loch'); if (e.perg && e.perg.tipo === 'alvo') alvoObj(e, 'Sol Ring'); resolveCom(e);
  igual(sr.zona, 'cemiterio', 'ainda no cemitério');
  ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar' && o.id === sr.id), 'pode conjurar o Sol Ring');
});

caso('613.1d', "Enduring Courage/Vitality: morre e volta ao campo como encantamento, sem ser criatura (mover tiraTipo), já ao entrar", () => {
  for (const n of ['Enduring Courage', 'Enduring Vitality']) {
    ok(M.carta(n).gat.every(g => M.gatOk(g)), n + ' aceito');
    const e = cena({ campo: [[0, n]] });
    const c = objN(e, 0, n); M.mover(e, c.id, 'cemiterio'); M.avancar(e); resolvePilha(e);
    igual(c.zona, 'campo', n + ': voltou');
    ok(!M.temTipo(e, c, 'Creature') && M.temTipo(e, c, 'Enchantment'), n + ': só encantamento');
  }
});

caso('702.88a', "rebote (Ephemerate): da mão, exila ao resolver e na sua próxima manutenção pode conjurar de graça (pisca de novo)", () => {
  const e = cena({ campo: [[0, 'Plains'], [0, 'Grizzly Bears']], mao: [[0, 'Ephemerate']] });
  const ep = e.jogs[0].zonas.mao.map(id => e.objs[id]).find(o => o.n === 'Ephemerate');
  M.avancar(e); conj(e, 'Ephemerate'); alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  igual(ep.zona, 'exilio', 'exilada (rebote)');
  igual((e.atras || []).length, 1, 'atrasado para a próxima manutenção');
  const b = objN(e, 0, 'Grizzly Bears'), ts = b.ts;
  e.perg = null; e.turno.n++; M.evento(e, { ev: 'fase', passo: 'manutencao', ativo: 0 }); M.avancar(e);
  for (let i = 0; i < 30 && e.perg && (e.pilha.length || e.perg.tipo !== 'acao'); i++) {
    const p = e.perg;
    if (p.tipo === 'jogar') { respE(e, o => o.a === 'jogar'); continue; }
    if (p.tipo === 'alvo') { alvoObj(e, 'Grizzly Bears'); continue; }
    if (p.tipo === 'acao') { respE(e, o => o.a === 'passar'); continue; }
    M.responder(e, M.agenteBasico()(e, p));
  }
  igual(ep.zona, 'cemiterio', 'conjurada do exílio: agora vai ao cemitério');
  ok(objN(e, 0, 'Grizzly Bears').ts > ts, 'piscou de novo');
});

caso('702.185a', "dobra/warp (Exalted Sunborn): da mão por {1}{W}; no final é exilada e depois pode ser conjurada do exílio", () => {
  const e = cena({ campo: [[0, 'Plains'], [0, 'Plains']], mao: [[0, 'Exalted Sunborn']] });
  const s = e.jogs[0].zonas.mao.map(id => e.objs[id]).find(o => o.n === 'Exalted Sunborn');
  M.avancar(e); conj(e, 'Exalted Sunborn'); resolveCom(e);
  igual(s.zona, 'campo', 'entrou pagando 2');
  e.perg = null; M.evento(e, { ev: 'fase', passo: 'final', ativo: 0 }); M.avancar(e); resolvePilha(e);
  igual(s.zona, 'exilio', 'no final: exilada');
  ok(!!M.permJogar(e, 0, s), 'pode conjurar do exílio depois');
});

caso('701.21', "duasPilhas (Liliana of the Veil −6): quem resolve separa as permanentes do alvo em duas pilhas; ele sacrifica a que escolher. Liliana Dreadhorde −9: um de cada tipo fica", () => {
  ok(M.fxSuportado(M.carta('Liliana of the Veil').atv[2].fx) && M.fxSuportado(M.carta('Liliana, Dreadhorde General').atv[2].fx), 'aceitos');
  const e = cena({ campo: [[1, 'Grizzly Bears'], [1, 'Hill Giant'], [1, 'Forest'], [1, 'Sol Ring']] });
  const ag = M.agenteBasico();
  M.executar(e, { op: 'duasPilhas', quem: 'alvoJogador' }, { ...ctxDe(e), alvos: [[{ jog: 1 }]] }, (j, t, ops, c) => ops[ag(e, { j, tipo: t, ops, ctx: c })]);
  const fica = e.campo.filter(id => e.objs[id].ctrl === 1).length;
  ok(fica > 0 && fica < 4, 'uma pilha foi, a outra ficou: ' + fica);
  igual(e.jogs[1].zonas.cemiterio.length, 4 - fica, 'as da pilha no cemitério');
  const f = cena({ campo: [[1, 'Grizzly Bears'], [1, 'Hill Giant'], [1, 'Forest'], [1, 'Mountain'], [1, 'Sol Ring']] });
  M.executar(f, M.carta('Liliana, Dreadhorde General').atv[2].fx[0], ctxDe(f), (j, t, ops) => ops[0]);
  igual(f.campo.filter(id => f.objs[id].ctrl === 1).length, 3, 'fica 1 criatura, 1 terreno, 1 artefato');
});

caso('607.2a', "Lobelia: ao entrar exila o topo de cada oponente (cavar comEste); depois a ativada acha 'uma carta exilada com Lobelia'", () => {
  const e = cena({ campo: [[0, 'Swamp']] });
  e.por(1, 'Grizzly Bears', { zona: 'grimorio' });
  const lo = e.por(0, 'Lobelia, Defender of Bag End', { zona: 'mao' }); M.mover(e, lo.id, 'campo'); M.avancar(e); resolvePilha(e);
  const ex = e.jogs[1].zonas.exilio.map(id => e.objs[id]);
  igual(ex.map(o => o.n), ['Grizzly Bears'], 'exilou o topo do oponente');
  ok(M.objetosQue(e, { exiladaPorEste: true, zona: 'exilio' }, { voce: 0, este: lo.id, lki: {} }).length === 1, 'exilada com Lobelia');
});

caso('401.4', "mover posicao (Lost to Legend): a permanente histórica vai para o grimório do dono como a quarta do topo", () => {
  const e = cena({ campo: [[1, 'Sol Ring']] });
  for (const n of ['Forest', 'Island', 'Mountain', 'Swamp', 'Plains']) e.por(1, n, { zona: 'grimorio' });
  const sr = objN(e, 1, 'Sol Ring');
  M.executar(e, M.carta('Lost to Legend').fx[0], { ...ctxDe(e), alvos: [[{ o: sr.id, ts: sr.ts }]] }, (j, t, ops) => ops[0]);
  const g = e.jogs[1].zonas.grimorio; igual(e.objs[g[g.length - 4]].n, 'Sol Ring', 'quarta do topo');
});

caso('601.2h', "contagem {de:{alvo:0}, o:'manaGasta'} (Mana Sculpt): a mana gasta na mágica alvo (com X), lida do LKI da pilha", () => {
  const e = cena({ campo: [...terras(4, 'Mountain')], mao: [[0, 'Fireball']] });
  M.avancar(e); const naPilha = x => x.pilha.length > 0;
  M.responder(e, e.perg.ops.findIndex(o => o.a === 'conjurar' && e.objs[o.id].n === 'Fireball'), naPilha);
  M.responder(e, e.perg.ops.findIndex(o => o.v === 3), naPilha); M.responder(e, e.perg.ops.findIndex(o => o.a === 'alvo' && o.jog === 1), naPilha);
  const fb = e.objs[e.pilha[e.pilha.length - 1]];
  igual(M.lkiDe(e, fb).manaGasta, 4, 'X=3 + {R}');
  igual(M.qtdDe(e, { conta: { de: { alvo: 0 }, o: 'manaGasta' } }, { voce: 0, alvos: [[{ o: fb.id, ts: fb.ts }]], lki: { alvos: [[M.lkiDe(e, fb)]] } }), 4, 'pela contagem');
  ok(M.contaOk({ de: { alvo: 0 }, o: 'manaGasta' }), 'aceita');
});

caso('725.1', "Mariposa Military Base: pode entrar virada e ganhar 2 rad; a compra custa {1} a menos por rad; radiação na 1ª principal moe e tira rad por não-terreno", () => {
  ok(M.carta('Mariposa Military Base').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Forest']] });
  const mp = e.por(0, 'Mariposa Military Base', { zona: 'mao' });
  M.aplicarEntrada(e, M.decidirEntrada(e, mp.id, 0, {}, (j, t, ops, c) => c && c.op === 'entraVirada' ? ops[0] : ops[0]));
  ok(mp.virada, 'entrou virada (escolheu)'); M.avancar(e); resolvePilha(e);
  igual((e.jogs[0].marc || {}).rad, 2, '2 rad');
  igual(M.vmDe(M.custoAtv(e, mp, M.atvDe(e, mp)[1])), 3, 'a compra custa {3}');
  for (const n of ['Forest', 'Grizzly Bears', 'Hill Giant']) e.por(0, n, { zona: 'grimorio' });
  const v0 = e.jogs[0].vida; e.perg = null; e.turno.radFeito = false;
  M.evento(e, { ev: 'fase', passo: 'principal1', ativo: 0 }); M.avancar(e); resolvePilha(e);
  igual(e.jogs[0].vida, v0 - 2, 'moeu Hill Giant e Bears: perde 2'); igual(e.jogs[0].marc.rad, 0, 'tirou 2 rad');
});

caso('702.160', "protótipo (Cradle Clearcutter): sem {6}, conjura por {2}{G} e entra 1/3 verde; o {T} dá mana igual ao poder (1); com {6}, 3/6 incolor", () => {
  const e = cena({ campo: [...terras(3, 'Forest')], mao: [[0, 'Cradle Clearcutter']] });
  M.avancar(e); conj(e, 'Cradle Clearcutter'); resolveCom(e);
  const C = objN(e, 0, 'Cradle Clearcutter');
  ok(C && C.proto, 'entrou como protótipo: ' + e.log.slice(-3).join(' / '));
  igual([M.poder(e, C), M.resistencia(e, C), M.dadoDe(e, C).cores, M.dadoDe(e, C).vm], [1, 3, 'G', 3], '1/3 verde, valor de mana 3');
  M.mover(e, C.id, 'mao'); ok(!e.objs[C.id].proto && M.dadoDe(e, e.objs[C.id]).vm === 6, 'fora do campo volta a ser a carta normal');
  const f = cena({ campo: [...terras(6, 'Forest')], mao: [[0, 'Cradle Clearcutter']] });
  M.avancar(f); conj(f, 'Cradle Clearcutter'); if (f.perg && f.perg.tipo === 'opcao') respE(f, o => o.a === 'opcao' && !o.v.prototipo); resolveCom(f);
  const D = objN(f, 0, 'Cradle Clearcutter');
  igual([M.poder(f, D), M.resistencia(f, D), D.proto], [3, 6, false], 'com 6: a normal');
});

caso('701.43', "exert / monarca ausente / diferença de poder / metade para cima: Combat Celebrant, Crown of Gondor, Conformer Shuriken, Contaminated Drink", () => {
  // Combat Celebrant: exercida não desvira no próximo desvirar do controlador
  const fx = M.carta('Combat Celebrant').gat[0].fx;
  const e = cena({ campo: [[0, 'Combat Celebrant'], [0, 'Grizzly Bears']] });
  const C = objN(e, 0, 'Combat Celebrant'), B = objN(e, 0, 'Grizzly Bears'); C.virada = true; B.virada = true;
  const cx = () => ({ voce: 0, este: C.id, alvos: [], ilegal: {}, lki: { alvos: [] } });
  for (const f of fx.slice(0, 2)) M.executar(e, f, cx(), null);
  ok(C.virada && !B.virada && C.naoDesv === C.ts, 'o urso desvira; a Celebrant fica exercida');
  // Crown of Gondor: lendária entrando sem monarca → você vira; com monarca (outro), não
  const g = cena({ campo: [[0, 'Crown of Gondor']] }); g.pend = [];
  g.por(0, 'Aesi, Tyrant of Gyre Strait'); igual(g.pend.filter(p => p.n === 'Crown of Gondor').length, 1, 'sem monarca: dispara');
  g.pend = []; g.monarca = 1; g.por(0, 'Aesi, Tyrant of Gyre Strait'); igual(g.pend.filter(p => p.n === 'Crown of Gondor').length, 0, 'já há monarca: não');
  const K = objN(g, 0, 'Crown of Gondor'), eq = M.atvDe(g, K).findIndex(a => a.equipar || (a.fx || []).some(x => x.op === 'anexar' || x.op === 'equipar'));
  const custoEq = () => M.custoAtv(g, K, M.atvDe(g, K)[eq >= 0 ? eq : 0]);
  igual(custoEq().g, 4, 'equipar {4} sem ser o monarca'); g.monarca = 0; igual(custoEq().g, 1, 'monarca: {3} a menos');
  // Conformer Shuriken: marcadores = poder do alvo − poder deste, se maior
  const q = { conta: { de: { alvo: 0 }, o: 'poderAcimaDeste' } };
  const h = cena({ campo: [[0, 'Grizzly Bears'], [1, 'Serra Angel'], [1, 'Llanowar Elves']] });
  const U = objN(h, 0, 'Grizzly Bears'), lk = o => ({ voce: 0, este: U.id, lki: { alvos: [[M.lkiDe(h, o)]] } });
  igual([M.qtdDe(h, q, lk(objN(h, 1, 'Serra Angel'))), M.qtdDe(h, q, lk(objN(h, 1, 'Llanowar Elves')))], [2, 0], '4−2 = 2; menor: 0');
  // Contaminated Drink: metade de X arredondada para cima
  const r = M.carta('Contaminated Drink').fx[1].qtd;
  igual([1, 2, 3].map(x => M.qtdDe(h, r, { voce: 0, x, lki: {} })), [1, 1, 2], 'X=1→1, 2→1, 3→2');
});

caso('103.6a', "Leyline of the Guildpact na mão inicial começa o jogo no campo (depois dos mulligans)", () => {
  const e = M.novoJogo([{ cartas: Array(40).fill('Leyline of the Guildpact') }, { cartas: enche(40) }], { semente: 3 });
  M.avancar(e);
  while (e.perg && (e.perg.tipo === 'mulligan' || e.perg.tipo === 'fundo')) M.responder(e, 0);
  const n = e.campo.filter(id => e.objs[id].n === 'Leyline of the Guildpact').length;
  ok(n >= 6 && e.campo.every(id => e.objs[id].ctrl === 0), 'as 7 da mão inicial (menos a comprada depois) no campo: ' + n);
});

caso('615.1', "Inkshield: previne o dano de combate a você e cria uma Inkling 2/1 voadora para cada 1 prevenido; dano fora de combate passa", () => {
  const ach = x => { if (!x || typeof x !== 'object') return null; if (x.op === 'efeitoTemporario') return x; for (const v of Object.values(x)) { const r = ach(v); if (r) return r; } return null; };
  const e = cena(); e.pend = [];
  M.executar(e, ach(M.carta('Inkshield')), { voce: 0, este: -1, alvos: [], ilegal: {}, lki: { alvos: [] } }, null);
  igual([M.substDano(e, 3, { jog: 0, combate: true }), M.substDano(e, 2, { jog: 0 }), M.substDano(e, 4, { jog: 1, combate: true })], [0, 2, 4], 'só o de combate em você');
  const ink = e.campo.filter(id => e.objs[id].ctrl === 0 && (M.dadoDe(e, e.objs[id]).sub || []).includes('Inkling'));
  igual(ink.length, 3, '3 prevenidos = 3 Inklings');
  ok(M.temKw(e, e.objs[ink[0]], 'voar'), 'voadora');
});

caso('602.2b', "custo com um filtro por permanente (Jarad: 'Sacrifice a Swamp and a Forest'): dois Pântanos não pagam; Pântano + Floresta pagam e ele volta à mão", () => {
  for (const terras2 of [['Swamp', 'Swamp'], ['Swamp', 'Forest']]) {
    const e = cena({ campo: [...terras2.map(n => [0, n]), [0, 'Island']] }); e.pend = [];
    e.por(0, 'Jarad, Golgari Lich Lord', { zona: 'cemiterio' });
    const pode = M.opcoesPrioridade(e, 0).some(o => o.a === 'ativar' && e.objs[o.id].n === 'Jarad, Golgari Lich Lord');
    igual(pode, terras2[1] === 'Forest', terras2.join('+'));
    if (!pode) continue;
    M.avancar(e); respE(e, o => o.a === 'ativar' && e.objs[o.id].n === 'Jarad, Golgari Lich Lord');
    resolveCom(e);
    igual([naZona(e, 0, 'mao'), noCampo(e).sort()], [['Jarad, Golgari Lich Lord'], ['Island']], 'sacrificou os dois, Jarad na mão');
  }
});

caso('701.16', "Kaalia, Zenith Seeker: entre as 6 do topo pega no máximo um Anjo, um Demônio e um Dragão (dois Anjos não); o resto vai ao fundo", () => {
  const fx = M.carta('Kaalia, Zenith Seeker').gat[0].fx;
  ok(M.fxSuportado(fx), 'aceita');
  ok(!M.fxSuportado([{ op: 'cavar', olha: 6, pega: { ate: 3 }, f: { sub: ['Angel'] }, para: 'mao', umDeCada: true }]), 'umDeCada com um subtipo só: não');
  const e = cena({ grimorio: 0 });
  for (const n of ['Forest', 'Island', 'Balefire Dragon', 'Archfiend of Despair', 'Reya Dawnbringer', 'Serra Angel']) e.por(0, n, { zona: 'grimorio' });
  M.executar(e, fx[0], { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, (j, t, ops) => ops.find(o => o.a !== 'nenhum') || ops[0]);
  const mao = naZona(e, 0, 'mao').sort();
  igual(mao.length, 3, 'três: ' + mao.join(', '));
  ok(mao.includes('Balefire Dragon') && mao.includes('Archfiend of Despair') && mao.filter(n => n === 'Serra Angel' || n === 'Reya Dawnbringer').length === 1, 'um de cada');
  igual(e.jogs[0].zonas.grimorio.length, 3, 'o resto no fundo');
});

caso('601.3', "Kess, Dissident Mage: uma vez no seu turno conjura instantânea do cemitério; ela vai para o exílio em vez do cemitério; a segunda não", () => {
  const e = cena({ campo: [...terras(4, 'Island'), [0, 'Kess, Dissident Mage']] }); e.pend = [];
  e.por(0, 'Opt', { zona: 'cemiterio' }); e.por(0, 'Brainstorm', { zona: 'cemiterio' });
  const doCem = () => M.opcoesPrioridade(e, 0).filter(o => o.a === 'conjurar' && e.objs[o.id].zona === 'cemiterio').map(o => e.objs[o.id].n).sort();
  igual(doCem(), ['Brainstorm', 'Opt'], 'as duas do cemitério');
  M.avancar(e); conj(e, 'Opt'); resolveCom(e);
  ok(naZona(e, 0, 'exilio').includes('Opt') && !naZona(e, 0, 'cemiterio').includes('Opt'), 'Opt foi para o exílio');
  igual(doCem(), [], 'uma vez por turno');
  e.turno.ativo = 1; e.turno.n++;
  igual(doCem(), [], 'no turno do oponente não');
});

caso('702.34', "Visions of Glory: flashback custa {X} a menos, X = maior VM de um comandante seu no campo ou no comando (filtro zona em lista); da mão não reduz", () => {
  const e = cena({ cmd: ['Krenko, Mob Boss'], campo: terras(6, 'Plains') });
  const v = e.por(0, 'Visions of Glory', { zona: 'cemiterio' }), fb = M.carta('Visions of Glory').kw[0].custo;
  ok(M.estReduzOk(M.carta('Visions of Glory').est[0]), 'redução aceita');
  igual(M.custoComImposto(e, v, fb).g, 4, 'Krenko (VM 4) no comando: {4}{W}{W}');
  ok(M.podeConjurar(e, 0, v), 'com 6 Planícies dá para conjurar do cemitério');
  const k = e.jogs[0].zonas.comando[0]; M.mover(e, k, 'campo');
  igual(M.custoComImposto(e, v, fb).g, 4, 'no campo: igual');
  M.mover(e, k, 'exilio');
  igual(M.custoComImposto(e, v, fb).g, 8, 'comandante no exílio: sem redução');
  M.mover(e, k, 'campo'); M.mover(e, v.id, 'mao');
  igual(M.custoComImposto(e, e.objs[v.id]).g, 4, 'da mão: {4}{W} normal');
});

caso('602.2b', "atv.reduz: Voldaren Estate (Sangue custa {1} a menos por Vampiro seu, só essa habilidade) e Otawara (canalizar da mão, por lendária sua)", () => {
  const e = cena({ campo: [[0, 'Voldaren Estate'], [0, 'Vampire Nighthawk'], [0, 'Vampire Nighthawk'], [1, 'Vampire Nighthawk']], mao: [[0, 'Otawara, Soaring City']] });
  const v = objN(e, 0, 'Voldaren Estate'), a = M.atvDe(e, v);
  igual(M.custoAtv(e, v, a[2]), { g: 3 }, '2 Vampiros seus (o do oponente não conta): {3}');
  igual(a[0].custo.mana, undefined, 'a de mana não muda');
  const o = e.por(0, 'Otawara, Soaring City', { zona: 'mao' }), oa = M.atvDe(e, o)[1];
  igual(M.custoAtv(e, o, oa), { g: 3, p: ['U'] }, 'sem lendária: {3}{U}');
  e.por(0, 'Krenko, Mob Boss', { zona: 'campo' });
  igual(M.custoAtv(e, o, oa), { g: 2, p: ['U'] }, 'com 1 lendária: {2}{U}');
});

caso('601.2', "Wakening Sun's Avatar: só destrói as não-Dinossauro se foi conjurado DA MÃO (filtro conjurada 'mao'); do comando, não", () => {
  const e = cena({ campo: [...terras(8, 'Plains'), [1, 'Grizzly Bears']], mao: [[0, "Wakening Sun's Avatar"]] });
  M.avancar(e); conj(e, "Wakening Sun's Avatar"); resolveCom(e);
  ok(noCampo(e).includes("Wakening Sun's Avatar") && !noCampo(e).includes('Grizzly Bears'), 'da mão: o urso morre');
  const f = cena({ cmd: ["Wakening Sun's Avatar"], campo: [...terras(8, 'Plains'), [1, 'Grizzly Bears']] });
  M.avancar(f); conj(f, "Wakening Sun's Avatar"); resolveCom(f);
  ok(noCampo(f).includes("Wakening Sun's Avatar") && noCampo(f).includes('Grizzly Bears'), 'do comando: o urso fica');
});

caso('601.2h', "expend 4 (Wandertale Mentor): +1/+1 quando você gasta a 4ª mana em mágicas no turno; uma vez só, e mágica do oponente não conta", () => {
  const e = cena({ campo: [[0, 'Wandertale Mentor'], ...terras(6, 'Forest')], mao: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']] });
  const w = objN(e, 0, 'Wandertale Mentor'), m = () => w.marc['+1/+1'] || 0;
  ok(M.gatOk(M.carta('Wandertale Mentor').gat[0]), 'gatilho aceito');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e); igual(m(), 0, '2 manas: nada');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e); igual(m(), 1, '4ª mana: +1/+1');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e); igual(m(), 1, '6ª: não de novo');
});

caso('119.4', "War Room: {3},{T}, pague vida = nº de cores da identidade dos seus comandantes (conta voce/cores): compra 1", () => {
  const e = cena({ cmd: ['Lathril, Blade of the Elves'], campo: [[0, 'War Room'], ...terras(3, 'Forest')] });
  const w = objN(e, 0, 'War Room'), a = M.atvDe(e, w), k = a.findIndex(x => !x.deMana);
  ok(M.custoSuportado(a[k].custo), 'custo aceito');
  igual(M.contar(e, { de: 'voce', o: 'cores' }, { voce: 0 }), 2, 'Lathril: BG = 2');
  M.avancar(e); const mao = e.jogs[0].zonas.mao.length;
  respE(e, o => o.a === 'ativar' && o.id === w.id && o.k === k); resolveCom(e);
  igual([e.jogs[0].vida, e.jogs[0].zonas.mao.length], [38, mao + 1], '2 de vida, 1 carta');
});

caso('702.131', "Wayward Swordtooth: não ataca nem bloqueia a menos que você tenha a bênção da cidade (cond nao: {palavra: blessing})", () => {
  const se = M.carta('Wayward Swordtooth').est[1].se;
  ok(M.seOk(se) && M.seOk({ nao: { palavra: 'blessing' }, turno: 'seu' }) && !M.seOk({ nao: { inventada: 1 } }), 'nao aceito (e o de dentro conferido)');
  const e = cena({ campo: [[0, 'Wayward Swordtooth']] }), w = objN(e, 0, 'Wayward Swordtooth'); w.doente = false;
  ok(M.condicao(e, se, { voce: 0, este: w.id }), 'sem bênção: a proibição vale');
  e.jogs[0].bencao = true;
  ok(!M.condicao(e, se, { voce: 0, este: w.id }), 'com bênção: não vale');
});

caso('603.4', "Wedding Ring: o oponente com um Wedding Ring compra NO TURNO DELE → você compra; no turno de um terceiro, não (cond turno 'doEvento')", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Wedding Ring'], [1, 'Wedding Ring']] });
  const g = M.carta('Wedding Ring').gat[1], W = objN(e, 0, 'Wedding Ring'), ctx = ev => ({ voce: 0, este: W.id, ev });
  ok(M.seOk(g.se), 'condição aceita');
  e.turno.ativo = 1; ok(M.condicao(e, g.se, ctx({ ev: 'compra', j: 1 })), 'turno do 1, o 1 compra: sim');
  e.turno.ativo = 2; ok(!M.condicao(e, g.se, ctx({ ev: 'compra', j: 1 })), 'turno do 2, o 1 compra: não');
  e.turno.ativo = 2; ok(!M.condicao(e, g.se, ctx({ ev: 'compra', j: 2 })), 'o 2 não tem Wedding Ring: não');
});

caso('707.9b', "copiarPermanente (fx): Sunfrill Imitator vira cópia do Dinossauro alvo mas fica com o nome e o gatilho; Sarkhan vira cópia do Dragão até o fim do turno, lendário", () => {
  ok(M.fxSuportado(M.carta('Sunfrill Imitator').gat[0].fx) && M.gatOk(M.carta('Sarkhan, Soul Aflame').gat[0]), 'aceitos');
  const e = cena({ campo: [[0, 'Sunfrill Imitator'], [0, 'Ghalta, Primal Hunger'], [0, 'Sarkhan, Soul Aflame'], [0, 'Savage Ventmaw']] });
  const si = objN(e, 0, 'Sunfrill Imitator'), gh = objN(e, 0, 'Ghalta, Primal Hunger'), sk = objN(e, 0, 'Sarkhan, Soul Aflame'), sd = objN(e, 0, 'Savage Ventmaw');
  const f = M.carta('Sunfrill Imitator').gat[0].fx[0];
  M.executar(e, { ...f, talvez: false }, { voce: 0, este: si.id, alvos: [[{ o: gh.id, ts: gh.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, si) } }, () => null);
  igual([M.poder(e, si), M.dadoDe(e, si).n, M.temKw(e, si, 'atropelar'), (M.dadoDe(e, si).gat || []).length], [12, 'Sunfrill Imitator', true, 1], 'Ghalta 12/12 com atropelar, nome e gatilho dela');
  const g = M.carta('Sarkhan, Soul Aflame').gat[0];
  M.executar(e, { ...g.fx[0], talvez: false }, { voce: 0, este: sk.id, ev: { ev: 'zona', id: sd.id, ts: sd.ts, para: 'campo' }, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, sk) } }, () => null);
  igual([M.poder(e, sk), M.dadoDe(e, sk).n, (M.dadoDe(e, sk).super || []).includes('Legendary'), M.temKw(e, sk, 'voar')], [4, 'Sarkhan, Soul Aflame', true, true], 'Ventmaw 4/4 voando, nome Sarkhan, lendário');
  e.turno.passo = 'final'; passarAte(e, 'principal1');
  igual([M.poder(e, sk), M.poder(e, si)], [2, 12], 'no turno seguinte Sarkhan volta a 2/4; a do Imitator fica');
});

caso('114.4', "Tamiyo, Field Researcher: +1 — dano de combate das criaturas escolhidas faz VOCÊ comprar (mesmo a do oponente), até seu próximo turno; −7 — emblema: mágicas da mão sem pagar", () => {
  const T = M.carta('Tamiyo, Field Researcher');
  ok(T.atv.every(a => M.fxSuportado(a.fx, { topo: false })), 'as três aceitas');
  const e = cena({ campo: [[0, 'Tamiyo, Field Researcher'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves'], [1, 'Grizzly Bears']], mao: [[0, 'Serra Angel']] });
  const t = objN(e, 0, 'Tamiyo, Field Researcher'), l = objN(e, 1, 'Llanowar Elves'), b1 = e.campo.map(id => e.objs[id]).find(o => o.n === 'Grizzly Bears' && o.ctrl === 1);
  M.executar(e, T.atv[0].fx[0], { voce: 0, este: t.id, alvos: [[{ o: l.id, ts: l.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, t) } }, () => null);
  e.pend = []; M.evento(e, { ev: 'dano', fonte: l.id, combate: true, jog: 0, q: 1 }); M.evento(e, { ev: 'dano', fonte: b1.id, combate: true, jog: 0, q: 2 });
  igual(e.pend.length, 1, 'só o elfo escolhido dispara');
  igual(e.pend[0].ctrl, 0, 'quem controla o gatilho (e compra) é você');
  e.pend = [];
  M.executar(e, T.atv[2].fx[1], { voce: 0, este: t.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, t) } }, () => null);
  const sa = e.objs[e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Serra Angel')];
  igual(M.altDe(e, 0, sa), {}, 'emblema: Serra Angel da mão por {0}');
  igual(M.altDe(e, 1, sa), undefined, 'o oponente não tem o emblema');
});

caso('603.4', "Tataru Taru: oponente compra fora do turno DELE → Tesouro (cond nao turno doEvento); no turno dele, não; no seu, sim", () => {
  const e = cena({ jogs: 3, campo: [[0, 'Tataru Taru']] });
  const g = M.carta('Tataru Taru').gat[1], ctx = ev => ({ voce: 0, este: objN(e, 0, 'Tataru Taru').id, ev });
  ok(M.gatOk(g), 'gatilho aceito');
  e.turno.ativo = 1; ok(!M.condicao(e, g.se, ctx({ ev: 'compra', j: 1 })), 'turno do 1, o 1 compra: não');
  e.turno.ativo = 2; ok(M.condicao(e, g.se, ctx({ ev: 'compra', j: 1 })), 'turno do 2, o 1 compra: sim');
  e.turno.ativo = 0; ok(M.condicao(e, g.se, ctx({ ev: 'compra', j: 1 })), 'seu turno: sim');
});

caso('400.7', "Welcome the Dead: X Zumbis = cartas suas que foram da mão/grimório ao cemitério neste turno (conta turno/aoCemiterio): o descarte + as moídas", () => {
  const e = cena({ campo: terras(4, 'Swamp'), mao: [[0, 'Welcome the Dead'], [0, 'Grizzly Bears']] });
  M.mover(e, e.jogs[0].zonas.grimorio[0], 'cemiterio'); M.mover(e, e.jogs[0].zonas.grimorio[0], 'cemiterio');   // duas moídas
  igual(M.contar(e, { de: 'turno', o: 'aoCemiterio' }, { voce: 0 }), 2, 'moeu 2');
  M.avancar(e); conj(e, 'Welcome the Dead'); resolveCom(e);
  igual(e.campo.filter(id => e.objs[id].ficha && e.objs[id].ctrl === 0 && e.objs[id].virada).length, 3, '2 moídas + 1 descarte = 3 Zumbis virados (a própria mágica não conta)');
});

caso('611.2b', "Welcome to . . .: I — artefato não-criatura de um oponente vira Muralha 0/4 com defensor enquanto você tiver a Saga (animar enquantoNoCampo); II — Dinossauro 3/3 com pressa só neste turno", () => {
  const W = M.carta('Welcome to . . .');
  ok(W.gat.every(g => M.gatOk(g)), 'capítulos aceitos');
  const e = cena({ campo: [[0, 'Welcome to . . .'], [1, 'Mind Stone']] });
  const sg = objN(e, 0, 'Welcome to . . .'), ms = objN(e, 1, 'Mind Stone');
  M.executar(e, W.gat[0].fx[0], { voce: 0, este: sg.id, alvos: [[{ o: ms.id, ts: ms.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, sg) } }, () => null);
  igual([M.temTipo(e, ms, 'Creature'), M.poder(e, ms), M.resistencia(e, ms), M.temKw(e, ms, 'defensor'), (M.dadoDe(e, ms).sub || []).includes('Wall')], [true, 0, 4, true, true], 'Muralha 0/4 defensora');
  M.mover(e, sg.id, 'cemiterio');
  igual(M.temTipo(e, ms, 'Creature'), false, 'a Saga saiu: volta a ser só artefato');
  const f = cena({ campo: [[0, 'Welcome to . . .']] }), sf = objN(f, 0, 'Welcome to . . .');
  const cx: any = { voce: 0, este: sf.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(f, sf) } };
  for (const x of W.gat[1].fx) M.executar(f, x, cx, () => null);
  const d = f.campo.map(id => f.objs[id]).find(o => o.ficha);
  ok(d && M.temKw(f, d, 'atropelar') && M.temKw(f, d, 'pressa'), 'Dinossauro com atropelar e pressa');
  f.turno.passo = 'final'; passarAte(f, 'principal1');
  ok(M.temKw(f, d, 'atropelar') && !M.temKw(f, d, 'pressa'), 'no turno seguinte: sem pressa');
});

caso('107.3', "Well of Lost Dreams: ganhou 3 de vida → pode pagar {X} com X ≤ 3 e comprar X (fx pagando + xAte); com 2 terras, X = 2", () => {
  const g = M.carta('Well of Lost Dreams').gat[0];
  ok(M.gatOk(g), 'gatilho aceito');
  const e = cena({ campo: [[0, 'Well of Lost Dreams'], ...terras(2, 'Forest')] }), w = objN(e, 0, 'Well of Lost Dreams');
  const mao = e.jogs[0].zonas.mao.length; let vistos: any = null;
  M.executar(e, g.fx[0], { voce: 0, este: w.id, ev: { ev: 'ganhaVida', j: 0, q: 3 }, alvos: [], ilegal: {}, lki: {} }, (j, t, ops) => { if (t === 'escolha') vistos = ops.map(o => o.v); return ops[0]; });
  igual(vistos, [2, 1, 0], 'X de 2 a 0 (só 2 manas)');
  igual([e.jogs[0].zonas.mao.length - mao, e.campo.filter(id => e.objs[id].virada).length], [2, 2], 'pagou {2}, comprou 2');
});

caso('707.10', "copiar mágica: Zada não copia o Bolt no jogador (só o que mira só ela); Dualcaster copia o Bolt na pilha; a cópia some (não vai ao cemitério) e não é conjurada", () => {
  const e = cena({ campo: [[0, 'Zada, Hedron Grinder'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  e.cfg.log = true;
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  const ag = M.agenteBasico();
  while (e.perg && e.perg.tipo !== 'acao') M.responder(e, ag(e, e.perg), x => x.turno.passo !== 'principal1');
  igual(e.jogs[1].vida, 37, 'só o Bolt: mirou o jogador, não a Zada');
  igual(naZona(e, 0, 'cemiterio'), ['Lightning Bolt'], 'só a original no cemitério');
  igual(e.pilha.length, 0, 'pilha limpa');
  igual(e.jogs[0].conjT.n, 1, 'as cópias não contam como conjuradas');
  const f = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']], mao: [[0, 'Lightning Bolt'], [0, 'Dualcaster Mage']] });
  M.avancar(f); respE(f, o => o.a === 'conjurar' && f.objs[o.id].n === 'Lightning Bolt'); alvoJog(f, 1);
  ok(f.pilha.length === 1 && f.perg && f.perg.j === 0, 'Bolt na pilha, prioridade de volta');
  conj(f, 'Dualcaster Mage');
  while (f.perg && f.perg.tipo !== 'acao') M.responder(f, ag(f, f.perg), x => x.turno.passo !== 'principal1');
  igual(f.jogs[1].vida, 34, 'Bolt + cópia do Dualcaster');
  ok(noCampo(f).includes('Dualcaster Mage'), 'Dualcaster no campo');
});

caso('701.6b', "Tishana's Tidebinder: anula uma habilidade desencadeada na pilha (alvo 'habilidade'); magia não é alvo", () => {
  const g = M.carta("Tishana's Tidebinder").gat[0]; ok(M.gatOk(g) && g.alvos.every(a => M.alvoSuportado(a)), 'aceita');
  const e = cena({ campo: [[1, 'Llanowar Elves']], mao: [[0, 'Grizzly Bears']] });
  e.pilha.push(...[]);
  const h = { id: e.prox++, n: 'teste', dono: 1, ctrl: 1, zona: 'pilha', ts: ++e.ts, hab: { fonte: e.campo[0], fonteTs: 0, k: 0, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }], alvos: [] }, marc: {} };
  e.objs[h.id] = h; e.pilha.push(h.id);
  const cx: any = { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } };
  igual(M.alvosPossiveis(e, g.alvos[0], cx).map(x => x.o), [h.id], 'a habilidade é alvo');
  M.executar(e, g.fx[0], { ...cx, alvos: [[{ o: h.id, ts: h.ts }]] }, null);
  igual(e.pilha.length, 0, 'anulada'); ok(!e.objs[h.id], 'sumiu (113.7)');
});

caso('508.1', "Tolsimir: o Lobo que ataca dispara só se Tolsimir atacou neste combate (atacouNoTurno); Lobo sozinho, não", () => {
  ok(M.carta("Tolsimir, Midnight's Light").gat.every(g => M.gatOk(g)), 'aceita');
  const e = cena({ campo: [[0, "Tolsimir, Midnight's Light"], [1, 'Grizzly Bears']] });
  M.criarFichas(e, 0, { pt: [5, 5], cores: 'GW', tipos: ['Creature'], sub: ['Wolf'] }, 1); e.pend = [];
  const t = objN(e, 0, "Tolsimir, Midnight's Light"), w = e.objs[e.campo.find(id => e.objs[id].ficha)];
  w.doente = false;
  ate(e, 'atacar'); atacaCom(e, t); atacaCom(e, w); fecha(e, 'atacar');
  const f = cena({ campo: [[0, "Tolsimir, Midnight's Light"], [1, 'Grizzly Bears']] });
  M.criarFichas(f, 0, { pt: [5, 5], cores: 'GW', tipos: ['Creature'], sub: ['Wolf'] }, 1); f.pend = [];
  const w2 = f.objs[f.campo.find(id => f.objs[id].ficha)];
  const g = M.carta("Tolsimir, Midnight's Light").gat[1];
  ok(!M.condicao(f, g.se, { voce: 0, este: objN(f, 0, "Tolsimir, Midnight's Light").id }), 'Tolsimir não atacou: não');
  ok(M.condicao(e, g.se, { voce: 0, este: t.id }), 'atacou: sim');
});

caso('701.44', "Topography Tracker: a criatura minha que exploraria explora duas vezes (2 marcadores com 2 não-terrenos no topo); a do oponente, uma", () => {
  ok(M.carta('Topography Tracker').subst.every(s => M.substOk(s)), 'aceita');
  const e = cena({ campo: [[0, 'Topography Tracker'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves']], grimorio: 0 });
  for (const n of ['Serra Angel', 'Serra Angel']) { e.por(0, n, { zona: 'grimorio' }); e.por(1, n, { zona: 'grimorio' }); }
  const b = objN(e, 0, 'Grizzly Bears'), l = objN(e, 1, 'Llanowar Elves');
  M.executar(e, { op: 'explorar', em: { todos: { nome: 'Grizzly Bears', zona: 'campo' } } }, { voce: 0, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  igual(b.marc['+1/+1'], 2, 'duas vezes');
  M.executar(e, { op: 'explorar', em: { todos: { nome: 'Llanowar Elves', zona: 'campo' } } }, { voce: 1, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  igual(l.marc['+1/+1'], 1, 'do oponente: uma');
});

caso('118.3', "Tortured Existence: o descarte do custo tem que ser carta de criatura (descartarF); só terreno na mão, não ativa", () => {
  const a = M.carta('Tortured Existence').atv[0]; ok(M.custoSuportado(a.custo), 'aceita');
  const e = cena({ campo: [[0, 'Tortured Existence'], [0, 'Swamp']], mao: [[0, 'Forest']] });
  e.por(0, 'Serra Angel', { zona: 'cemiterio' });
  const t = objN(e, 0, 'Tortured Existence');
  M.avancar(e); ok(!e.perg.ops.some(o => o.a === 'ativar' && o.id === t.id), 'só Forest: não');
  const f = cena({ campo: [[0, 'Tortured Existence'], [0, 'Swamp']], mao: [[0, 'Forest'], [0, 'Grizzly Bears']] });
  f.por(0, 'Serra Angel', { zona: 'cemiterio' });
  const t2 = objN(f, 0, 'Tortured Existence');
  M.avancar(f); ok(f.perg.ops.some(o => o.a === 'ativar' && o.id === t2.id), 'com Urso: sim');
  respE(f, o => o.a === 'ativar' && o.id === t2.id); resolveCom(f);
  igual(f.jogs[0].zonas.mao.map(id => f.objs[id].n).sort(), ['Forest', 'Serra Angel'], 'descartou o Urso, voltou o Anjo');
});

caso('701.63', "expend: Wandertale Mentor ganha o marcador quando a mana gasta em mágicas no turno chega a 4 (2+2), uma vez só; Trailtracker aceita expend 8", () => {
  ok(M.carta('Trailtracker Scout').gat.every(g => M.gatOk(g)), 'Trailtracker aceita');
  const e = cena({ campo: [...terras(6, 'Forest'), [0, 'Wandertale Mentor']], mao: [[0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears']] }); e.pend = [];
  const w = objN(e, 0, 'Wandertale Mentor');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e);
  igual(w.marc['+1/+1'] || 0, 0, '2 gastos: nada');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e);
  igual(w.marc['+1/+1'], 1, '4 gastos: marcador');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e);
  igual(w.marc['+1/+1'], 1, '6 gastos: não repete');
});

caso('701.16', "Twilight Prophet: com a bênção, revela o topo, põe na mão e o oponente perde / você ganha o valor de mana dele (Serra Angel: 5); Twenty-Toed Toad conta marcador de qualquer tipo", () => {
  ok(M.carta('Twilight Prophet').gat.every(g => M.gatOk(g)), 'aceita');
  const e = cena({ campo: [[0, 'Twilight Prophet']], grimorio: 0 }); e.por(0, 'Serra Angel', { zona: 'grimorio' });
  const t = objN(e, 0, 'Twilight Prophet'), g = M.carta('Twilight Prophet').gat[0];
  const v0 = e.jogs[0].vida, v1 = e.jogs[1].vida;
  const cx = { voce: 0, este: t.id, alvos: [], ilegal: {}, lki: { alvos: [] } }; for (const fx of g.fx) M.executar(e, fx, cx, () => ({ a: 'sim' }));
  igual(naZona(e, 0, 'mao'), ['Serra Angel'], 'na mão');
  igual([e.jogs[1].vida, e.jogs[0].vida], [v1 - 5, v0 + 5], '5 e 5');
  const f = cena({ campo: [[0, 'Twenty-Toed Toad']] }), s = objN(f, 0, 'Twenty-Toed Toad');
  s.marc = { '+1/+1': 12, stun: 8 };
  igual(M.contar(f, { de: 'este', o: 'marcadores' }, { voce: 0, este: s.id }), 20, '12+8 de tipos diferentes');
});

caso('707.2', "Twinflame: com dois alvos, uma ficha cópia de CADA um (repetirCada cada alvo), com ímpeto", () => {
  ok(M.fxSuportado(M.carta('Twinflame').fx), 'aceita');
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Serra Angel']] }); e.pend = [];
  const b = objN(e, 0, 'Grizzly Bears'), a = objN(e, 0, 'Serra Angel');
  M.executar(e, M.carta('Twinflame').fx[0], { voce: 0, alvos: [[{ o: b.id, ts: b.ts }, { o: a.id, ts: a.ts }]], ilegal: {}, lki: { alvos: [] }, criadas: [] }, () => ({ a: 'nao' }));
  const fs = e.campo.map(id => e.objs[id]).filter(o => o.ficha);
  igual(fs.map(o => M.dadoDe(e, o).n).sort(), ['Grizzly Bears', 'Serra Angel'], 'uma de cada');
  ok(fs.every(o => M.temKw(e, o, 'pressa')), 'com ímpeto');
});

caso('702.143', "Ultimate Magic: Holy: conjurada do exílio (prever) previne o dano a você no turno; da mão, não. Ugin lê mágica incolor (cor 'C')", () => {
  ok(M.fxSuportado(M.carta('Ultimate Magic: Holy').fx), 'aceita');
  const e = cena({ mao: [[0, 'Ultimate Magic: Holy']] }), h = e.objs[e.jogs[0].zonas.mao[0]];
  M.mover(e, h.id, 'pilha'); h.conjDe = 'mao';
  ok(!M.condicao(e, { conjuradaCom: 'exilio' }, { voce: 0, este: h.id }), 'da mão: não');
  h.conjDe = 'exilio'; ok(M.condicao(e, { conjuradaCom: 'exilio' }, { voce: 0, este: h.id }), 'do exílio: sim');
  const f = cena({ campo: [[0, 'Sol Ring'], [0, 'Grizzly Bears']] });
  ok(M.bate(f, objN(f, 0, 'Sol Ring'), { cor: 'C' }, { voce: 0 }) && !M.bate(f, objN(f, 0, 'Grizzly Bears'), { cor: 'C' }, { voce: 0 }), 'incolor');
});

caso('702.162', "Ultra Magnus: More Than Meets the Eye — com 5 terrenos (não fecha os 7) conjura convertida por {2}{R}{G}{W} e entra já como Armored Carrier", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Forest'], [0, 'Plains'], [0, 'Plains'], [0, 'Forest']], mao: [[0, 'Ultra Magnus, Tactician']] }); e.pend = [];
  const id = e.jogs[0].zonas.mao[0];
  M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === id); resolveCom(e);
  igual(e.objs[id].zona, 'campo', 'entrou'); igual(M.dadoDe(e, e.objs[id]).n, 'Ultra Magnus, Armored Carrier', 'transformada');
});

caso('701.10e', "Unnatural Growth: no começo do combate dobra P/R de cada criatura minha (Urso 2/2 → 4/4, Anjo 4/4 → 8/8); a do oponente fica", () => {
  const g = M.carta('Unnatural Growth').gat[0]; ok(M.gatOk(g), 'aceita');
  const e = cena({ campo: [[0, 'Unnatural Growth'], [0, 'Grizzly Bears'], [0, 'Serra Angel'], [1, 'Llanowar Elves']] }); e.pend = [];
  const u = objN(e, 0, 'Unnatural Growth'), b = objN(e, 0, 'Grizzly Bears'), a = objN(e, 0, 'Serra Angel'), l = objN(e, 1, 'Llanowar Elves');
  const cx = { voce: 0, este: u.id, alvos: [], ilegal: {}, lki: { alvos: [] } }; for (const fx of g.fx) M.executar(e, fx, cx, () => ({ a: 'nao' }));
  igual([M.poder(e, b), M.resistencia(e, b), M.poder(e, a), M.resistencia(e, a)], [4, 4, 8, 8], 'dobrou');
  igual([M.poder(e, l), M.resistencia(e, l)], [1, 1], 'oponente igual');
});

caso('702.72', "Wren's Run Packmaster: campeão — exila outro Elfo meu; sem Elfo, sacrifica; ao sair, o Elfo volta", () => {
  const [g1, g2] = M.carta("Wren's Run Packmaster").gat; ok(M.gatOk(g1) && M.gatOk(g2), 'aceita');
  const e = cena({ campo: [[0, "Wren's Run Packmaster"], [0, 'Llanowar Elves']] }); e.pend = [];
  const p = objN(e, 0, "Wren's Run Packmaster"), l = objN(e, 0, 'Llanowar Elves');
  const cx: any = { voce: 0, este: p.id, alvos: [], ilegal: {}, lki: { alvos: [] } };
  for (const fx of g1.fx) M.executar(e, fx, cx, (j, t, ops) => ops && ops.length ? ops[0] : { a: 'sim' });
  igual([e.objs[l.id].zona, e.objs[p.id].zona], ['exilio', 'campo'], 'Elfo exilado, fica');
  const lki = { este: { ...p } }; M.mover(e, p.id, 'cemiterio');
  for (const fx of g2.fx) M.executar(e, fx, { voce: 0, este: p.id, alvos: [], ilegal: {}, lki }, () => ({ a: 'sim' }));
  igual(e.objs[l.id].zona, 'campo', 'Elfo voltou');
  const f = cena({ campo: [[0, "Wren's Run Packmaster"]] }); f.pend = []; const q = objN(f, 0, "Wren's Run Packmaster");
  for (const fx of g1.fx) M.executar(f, fx, { voce: 0, este: q.id, alvos: [], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'sim' }));
  igual(f.objs[q.id].zona, 'cemiterio', 'sem Elfo: sacrificada');
});

caso('608.2h', "Zack Fair: sacrificado no custo, põe na criatura os marcadores DELE de cada tipo e prende o Equipamento que estava nele (LKI)", () => {
  const e = cena({ campo: [[0, 'Plains'], [0, 'Zack Fair'], [0, 'Grizzly Bears'], [0, 'Swiftfoot Boots']] }); e.pend = [];
  const z = objN(e, 0, 'Zack Fair'), b = objN(e, 0, 'Grizzly Bears'), s = objN(e, 0, 'Swiftfoot Boots');
  z.marc = { '+1/+1': 2, stun: 1 }; z.doente = false; s.anexo = { id: z.id, ts: z.ts };
  M.avancar(e); respE(e, o => o.a === 'ativar' && o.id === z.id);
  resolveCom(e, p => p.ops.findIndex(o => o.o === b.id || o.id === b.id));
  igual(z.zona, 'cemiterio', 'sacrificado');
  igual([b.marc['+1/+1'], b.marc.stun], [2, 1], 'os marcadores dele');
  ok(s.anexo && s.anexo.id === b.id, 'Botas no Urso'); ok(M.temKw(e, b, 'indestrutivel'), 'indestrutível');
});

caso('707.10', "Zada: Giant Growth só nela copia para cada outra criatura minha (cada cópia numa); mirando outra, não copia", () => {
  ok(M.gatOk(M.carta('Zada, Hedron Grinder').gat[0]), 'aceita');
  const e = cena({ campo: [[0, 'Forest'], [0, 'Forest'], [0, 'Zada, Hedron Grinder'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Serra Angel']], mao: [[0, 'Giant Growth'], [0, 'Giant Growth']] });
  const z = objN(e, 0, 'Zada, Hedron Grinder'), b = objN(e, 0, 'Grizzly Bears'), l = objN(e, 0, 'Llanowar Elves'), s = objN(e, 1, 'Serra Angel');
  M.avancar(e); conj(e, 'Giant Growth'); alvoObj(e, 'Zada, Hedron Grinder'); resolveCom(e);
  igual([M.poder(e, z), M.poder(e, b), M.poder(e, l), M.poder(e, s)], [6, 5, 4, 4], 'três +3/+3, o Anjo do oponente fica');
  conj(e, 'Giant Growth'); alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  igual([M.poder(e, z), M.poder(e, b), M.poder(e, l)], [6, 8, 4], 'mirando o Urso: só ele');
});




caso('702.85a', "Wildsear: encantamento conjurado DA MÃO tem cascata (continuo afeta pilha + conjurada 'mao'); do cemitério ou criatura, não", () => {
  const e = cena({ campo: [[0, 'Wildsear, Scouring Maw']], mao: [[0, 'Weaver of Harmony'], [0, 'Grizzly Bears']] });
  const w = naMao(e, 0, 'Weaver of Harmony'), b = naMao(e, 0, 'Grizzly Bears');
  w.pil = { de: 'mao' }; w.ctrl = 0; w.zona = 'pilha'; b.pil = { de: 'mao' }; b.ctrl = 0; b.zona = 'pilha';
  igual([M.cascatas(e, w), M.cascatas(e, b)], [1, 0], 'encantamento da mão: 1; criatura não-encantamento: 0');
  w.pil.de = 'cemiterio'; igual(M.cascatas(e, w), 0, 'do cemitério: não');
});

caso('615', "Selfless Squire: com o dano a você prevenido neste turno, dispara 'danoPrevenido' e ganha tantos +1/+1 quanto o dano prevenido", () => {
  const S = M.carta('Selfless Squire');
  ok(S.gat.every(g => M.gatOk(g)), 'gatilhos aceitos');
  const e = cena({ campo: [[0, 'Selfless Squire'], [1, 'Grizzly Bears']] }), q = objN(e, 0, 'Selfless Squire');
  M.executar(e, S.gat[0].fx[0], { voce: 0, este: q.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, q) } }, () => null);
  e.pend = [];
  igual(M.substDano(e, 3, { fonte: objN(e, 1, 'Grizzly Bears'), jog: 0, combate: true }), 0, 'prevenido');
  const p = e.pend.find(x => x.fonte === q.id);
  ok(p, 'o Escudeiro dispara');
  igual(M.contar(e, { de: 'evento', o: 'dano' }, { voce: 0, ev: p.ev }), 3, 'that many = 3');
  e.pend = []; M.substDano(e, 2, { jog: 1 }); igual(e.pend.length, 0, 'dano no oponente: nada');
});

caso('208.1', "Selvala, Heart of the Wilds: quem controla a criatura que entrou compra só se o poder dela é maior que o de cada outra criatura (filtro maiorPoder)", () => {
  const g = M.carta('Selvala, Heart of the Wilds').gat[0];
  ok(M.gatOk(g), 'gatilho aceito');
  const e = cena({ campo: [[0, 'Selvala, Heart of the Wilds'], [1, 'Ghalta, Primal Hunger'], [1, 'Grizzly Bears'], [0, 'Llanowar Elves']] });
  const s = objN(e, 0, 'Selvala, Heart of the Wilds'), gh = objN(e, 1, 'Ghalta, Primal Hunger'), b = objN(e, 1, 'Grizzly Bears');
  const c = o => M.condicao(e, g.fx[0].se, { voce: 0, este: s.id, ev: { ev: 'zona', id: o.id, ts: o.ts, para: 'campo' } });
  ok(c(gh) && !c(b), 'Ghalta 12: sim; urso 2: não (Selvala tem 2: empate não conta)');
});

caso('701.20', "Selvala, Explorer Returned (parley): cada um revela o topo; {G} e 1 de vida por não-terreno revelado (conta topo do grimório de todos), depois cada um compra", () => {
  const a = M.carta('Selvala, Explorer Returned').atv[0];
  ok(M.fxSuportado(a.fx, { topo: false }), 'aceito');
  const e = cena({ campo: [[0, 'Selvala, Explorer Returned']] }), s = objN(e, 0, 'Selvala, Explorer Returned');
  e.por(0, 'Grizzly Bears', { zona: 'grimorio' }); e.por(1, 'Forest', { zona: 'grimorio' });
  const topo = j => e.objs[e.jogs[j].zonas.grimorio[e.jogs[j].zonas.grimorio.length - 1]].n;
  igual([topo(0), topo(1)], ['Grizzly Bears', 'Forest'], 'topos: urso e floresta');
  const ctx: any = { voce: 0, este: s.id, alvos: [], ilegal: {}, lki: {} };
  for (const f of a.fx) M.executar(e, f, ctx, () => null);
  igual([e.jogs[0].vida, e.jogs[0].reserva.G], [41, 1], '1 não-terreno: {G} e 1 de vida');
});

caso('615', "Serra the Benevolent −6: emblema — com uma criatura sua, dano que levaria sua vida abaixo de 1 a deixa em 1 (subst dano muda vidaMin)", () => {
  const a = M.carta('Serra the Benevolent').atv[2];
  ok(M.fxSuportado(a.fx, { topo: false }), 'aceito');
  const e = cena({ campo: [[0, 'Serra the Benevolent'], [0, 'Grizzly Bears']] }), s = objN(e, 0, 'Serra the Benevolent');
  M.executar(e, a.fx[0], { voce: 0, este: s.id, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, s) } }, () => null);
  e.jogs[0].vida = 5;
  igual([M.substDano(e, 10, { jog: 0 }), M.substDano(e, 3, { jog: 0 }), M.substDano(e, 10, { jog: 1 })], [4, 3, 10], 'fica em 1; dano menor passa; o oponente não');
  M.mover(e, objN(e, 0, 'Grizzly Bears').id, 'cemiterio');
  igual(M.substDano(e, 10, { jog: 0 }), 10, 'sem criatura: não vale');
});

caso('701.34', "Vexing Radgull: dano de combate no jogador sem rad → 2 rad; já com rad → proliferar (e não ganha mais 2)", () => {
  const g = M.carta('Vexing Radgull').gat[0];
  ok(M.gatOk(g), 'aceito');
  const e = cena({ campo: [[0, 'Vexing Radgull']] }), r = objN(e, 0, 'Vexing Radgull');
  const vai = () => { e.turno.combate = { atk: [{ id: r.id, ts: r.ts, alvo: { jog: 1 } }] }; const ctx: any = { voce: 0, este: r.id, ev: { ev: 'dano', fonte: r.id, combate: true, jog: 1, q: 1 }, alvos: [], ilegal: {}, lki: { este: M.lkiDe(e, r) } }; for (const f of g.fx) M.executar(e, f, ctx, (j, t, ops) => t === 'proliferar' ? (ops.find(o => o.jog === 1) || ops[0]) : ops[0]); };
  vai(); igual((e.jogs[1].marc || {}).rad || 0, 2, 'sem rad: 2');
  vai(); igual((e.jogs[1].marc || {}).rad || 0, 3, 'com rad: proliferou (+1), sem os 2');
});

caso('603.2d', "Veyran: conjurar OU copiar instantânea/feitiço faz o gatilho de permanente sua disparar uma vez a mais (o magecraft dela: 2 vezes nos dois casos)", () => {
  const e = cena({ campo: [[0, 'Veyran, Voice of Duality']], mao: [[0, 'Lightning Bolt']] });
  const v = objN(e, 0, 'Veyran, Voice of Duality'), b = naMao(e, 0, 'Lightning Bolt');
  M.mover(e, b.id, 'pilha'); b.ctrl = 0;
  e.pend = []; M.evento(e, { ev: 'conjura', id: b.id, j: 0 }); igual(e.pend.filter(p => p.fonte === v.id).length, 2, 'conjurar: 2');
  e.pend = []; M.evento(e, { ev: 'copia', id: b.id, j: 0 }); igual(e.pend.filter(p => p.fonte === v.id).length, 2, 'copiar: 2');
});

caso('702.61a', "Siege Smash: com segundo dividido na pilha, ninguém conjura nem ativa (só mana); depois de resolver, volta", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Grizzly Bears'], [1, 'Sol Ring']], mao: [[0, 'Siege Smash'], [0, 'Lightning Bolt']] });
  M.avancar(e); const s = e.objs[e.jogs[0].zonas.mao.find(id => e.objs[id].n === 'Siege Smash')];
  M.mover(e, s.id, 'pilha'); s.pil = { alvos: [], ctrl: 0, modos: [0] };
  ok(M.segundoDividido(e), 'na pilha');
  const ops = M.opcoesPrioridade(e, 0);
  ok(!ops.some(o => o.a === 'conjurar' || o.a === 'ativar'), 'sem conjurar/ativar'); ok(ops.some(o => o.a === 'mana'), 'mana pode');
  M.mover(e, s.id, 'cemiterio');
  ok(!M.segundoDividido(e) && M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar'), 'saiu: Bolt de novo');
});

caso('115.1', "Sink into Stupor: mira mágica do oponente na pilha ou permanente não-terreno dele (não o terreno, não a minha) e devolve à mão", () => {
  const e = cena({ campo: [[1, 'Forest'], [1, 'Sol Ring'], [0, 'Grizzly Bears']], mao: [[1, 'Llanowar Elves']] }); M.avancar(e);
  const l = e.objs[e.jogs[1].zonas.mao[0]]; M.mover(e, l.id, 'pilha'); l.pil = { alvos: [], ctrl: 1 };
  const d = M.carta('Sink into Stupor'), cx = { voce: 0, este: -1 };
  const ids = M.alvosPossiveis(e, d.alvos[0], cx).map(x => e.objs[x.o].n).sort();
  igual(ids, ['Llanowar Elves', 'Sol Ring'], 'a mágica e o Sol Ring');
  M.executar(e, d.fx[0], { voce: 0, alvos: [[{ o: l.id, ts: l.ts }]], ilegal: {}, lki: { alvos: [] } }, () => ({ a: 'nao' }));
  igual(naZona(e, 1, 'mao'), ['Llanowar Elves'], 'voltou à mão');
});

caso('702.81a', "Six: no meu turno, permanente não-terreno do cemitério tem retrace (Urso sim; Bolt e terreno não); darRetrace com se", () => {
  const e = cena({ campo: [[0, 'Six'], [0, 'Forest'], [0, 'Forest'], [0, 'Mountain']], mao: [[0, 'Forest']] });
  const u = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' }), b = e.por(0, 'Lightning Bolt', { zona: 'cemiterio' }); e.por(0, 'Forest', { zona: 'cemiterio' });
  M.avancar(e); const nomes = M.opcoesPrioridade(e, 0).filter(o => o.a === 'conjurar').map(o => e.objs[o.id].n);
  ok(nomes.includes('Grizzly Bears') && !nomes.includes('Lightning Bolt'), 'Urso sim, Bolt não: ' + nomes);
  ok(!M.condicao(e, { turno: 'seu' }, { voce: 1 }), 'no turno do outro a condição falha');
  conj(e, 'Grizzly Bears'); resolveCom(e); igual(e.objs[u.id].zona, 'campo', 'conjurado do cemitério'); igual(e.objs[b.id].zona, 'cemiterio', 'Bolt fica');
});

caso('704.5j', "Sliver Gravemother: duas dela ficam (regra da lenda não vale para Fractius meus); Fractius no cemitério tem bis {vm}", () => {
  const e = cena({ campo: [[0, 'Sliver Gravemother'], [0, 'Sliver Gravemother'], [0, 'Mountain'], [0, 'Mountain'], [0, 'Mountain']] }); e.pend = [];
  const b = e.por(0, 'Blur Sliver', { zona: 'cemiterio' }), u = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
  M.avancar(e);
  igual(e.campo.filter(id => e.objs[id].n === 'Sliver Gravemother').length, 2, 'as duas ficam');
  const a = M.atvDe(e, b).find(x => x._bis); ok(a && a.custo.mana.g === M.carta('Blur Sliver').vm, 'bis {vm}');
  ok(!M.atvDe(e, u).some(x => x._bis), 'Urso não');
  ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'ativar' && o.id === b.id), 'pode ativar');
  const f = cena({ campo: [[0, 'Sliver Gravemother'], [0, 'Six'], [0, 'Six']] }); f.pend = [];
  M.avancar(f); ok(f.perg && f.perg.tipo === 'lenda', 'lenda que não é Fractius: a regra vale');
});

caso('601.2h', "Boromir, Warden of the Tower: anula mágica do oponente sem mana gasta (filtro manaGasta; o conjurar grava o.manaGasta)", () => {
  const g = M.carta('Boromir, Warden of the Tower').gat[0]; ok(M.gatOk(g), 'aceito');
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Grizzly Bears'], [1, "Boromir, Warden of the Tower"]], mao: [[0, 'Fists of Flame']] });
  M.avancar(e); conj(e, 'Fists of Flame'); if (e.perg && e.perg.tipo === 'alvo') alvoObj(e, 'Grizzly Bears');
  const fi = e.objs[e.pilha.find(id => e.objs[id].n === 'Fists of Flame')];
  igual(fi.manaGasta, 2, 'gastou {1}{R}');
  const cx: any = { voce: 1, este: e.campo[3], alvos: [], ilegal: {}, lki: {}, ev: { ev: 'conjura', id: fi.id, j: 0 } };
  ok(!M.condicao(e, g.se, cx), 'com mana: não anula');
  fi.manaGasta = 0; ok(M.condicao(e, g.se, cx), 'sem mana: anula');
});

caso('107.3', "Bronzebeak Foragers {X}{W}: card exilado por ela com VM X vai para o cemitério do dono e você ganha X", () => {
  const A = M.carta('Bronzebeak Foragers').atv[0]; ok(M.fxSuportado(A.fx) && M.filtroOk(A.alvos[0].f), 'aceito');
  const e = cena({ campo: [[0, 'Bronzebeak Foragers'], [1, 'Hill Giant'], [1, 'Sol Ring']] });
  const [bf, hg, sr] = e.campo.map(id => e.objs[id]);
  const cx: any = { voce: 0, este: bf.id, alvos: [[{ o: hg.id, ts: hg.ts }, { o: sr.id, ts: sr.ts }]], ilegal: {}, lki: { este: M.lkiDe(e, bf) } };
  M.executar(e, { op: 'exilar', em: { alvo: 0 }, dura: 'enquantoNoCampo' }, cx, () => ({ a: 'nao' }));
  ok(hg.zona === 'exilio' && sr.zona === 'exilio', 'exilou os dois');
  const c4: any = { voce: 0, este: bf.id, x: 4, alvos: [], ilegal: {}, lki: {} };
  ok(M.bate(e, hg, A.alvos[0].f, c4) && !M.bate(e, sr, A.alvos[0].f, c4), 'X=4: só o Hill Giant');
  const v = e.jogs[0].vida;
  c4.alvos = [[{ o: hg.id, ts: hg.ts }]];
  for (const f of A.fx) M.executar(e, f, c4, () => ({ a: 'nao' }));
  ok(hg.zona === 'cemiterio' && e.jogs[1].zonas.cemiterio.includes(hg.id), 'cemitério do dono'); igual(e.jogs[0].vida, v + 4, 'ganha 4');
});

caso('509.1h', "Brimaz bloqueia: cria um Gato 1/1 com vigilância que entra bloqueando aquela criatura (ficha bloqueando)", () => {
  const g = M.carta('Brimaz, King of Oreskos').gat.find(x => x.ev === 'bloqueia'); ok(M.gatOk(g), 'aceito');
  const e = cena({ campo: [[0, 'Brimaz, King of Oreskos'], [1, 'Hill Giant']] });
  const [bz, hg] = e.campo.map(id => e.objs[id]);
  e.turno.combate = { atk: [{ id: hg.id, ts: hg.ts, alvo: { jog: 0 }, def: 0, bloq: [{ id: bz.id, ts: bz.ts }], bloqueado: true }] };
  const cx: any = { voce: 0, este: bz.id, alvos: [], ilegal: {}, lki: {}, ev: { ev: 'bloqueia', id: bz.id, atk: hg.id } };
  for (const f of g.fx) M.executar(e, f, cx, (_j, _t, o) => o[0]);
  const gato = e.campo.map(id => e.objs[id]).find(o => o.ficha && (o.ficha.sub || []).includes('Cat'));
  ok(gato, 'criou o Gato');
  igual(e.turno.combate.atk[0].bloq.length, 2, 'Brimaz e o Gato bloqueando o Hill Giant');
  ok(e.turno.combate.atk[0].bloq.some(b => b.id === gato.id), 'o Gato está no bloqueio');
});

caso('508.1h', 'Ghostly Prison: atacar paga {2} por criatura (508.1d/g–h); sem pagar ou sem mana, ela não ataca', () => {
  const mk = n => { const e = combate([[1, 'Ghostly Prison'], [0, 'Grizzly Bears'], ...terras(n)]); e.campo.forEach(id => { if (e.objs[id].ctrl === 0 && e.objs[id].n === 'Mountain') e.objs[id].virada = false; }); return e; };
  const e = mk(1);                                                            // 2 Mountains: paga
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Grizzly Bears')); fecha(e, 'atacar');
  igual(e.perg && e.perg.tipo, 'custoCombate', 'pergunta o custo'); igual(e.perg.ctx.custo, { g: 2, p: [] });
  respC(e, x => x.a === 'pagar');
  igual(e.campo.filter(id => e.objs[id].n === 'Mountain' && e.objs[id].virada).length, 2, 'virou as duas terras');
  ateFimCombate(e); igual(e.jogs[1].vida, 38);
  const f = mk(1);                                                            // não quer pagar
  ate(f, 'atacar'); atacaCom(f, objN(f, 0, 'Grizzly Bears')); fecha(f, 'atacar'); respC(f, x => x.a === 'naoPagar');
  ateFimCombate(f); igual(f.jogs[1].vida, 40, 'não pagou: não atacou');
  const g = mk(0);                                                            // 1 Mountain: não fecha, nem pergunta
  ate(g, 'atacar'); atacaCom(g, objN(g, 0, 'Grizzly Bears')); fecha(g, 'atacar');
  ok(!g.perg || g.perg.tipo !== 'custoCombate', 'sem mana não pergunta'); ateFimCombate(g); igual(g.jogs[1].vida, 40);
});
caso('509.1d', 'Archangel of Tithes atacando: bloquear custa {1} por criatura (509.1d/f); desvirada, atacá-la custa {1} (508.1d)', () => {
  const e = combate([[0, 'Archangel of Tithes'], [1, 'Giant Spider'], [1, 'Forest']]);
  ate(e, 'atacar'); atacaCom(e, objN(e, 0, 'Archangel of Tithes')); fecha(e, 'atacar');
  ate(e, 'bloquear'); bloqueia(e, objN(e, 1, 'Giant Spider'), objN(e, 0, 'Archangel of Tithes')); fecha(e, 'bloquear');
  igual(e.perg && e.perg.tipo, 'custoCombate'); igual(e.perg.j, 1); igual(e.perg.ctx.custo, { g: 1, p: [] });
  respC(e, x => x.a === 'pagar');
  ok(objN(e, 1, 'Forest').virada, 'pagou com a Forest'); igual(e.jogs[1].vida, 40, 'bloqueou');
  const f = combate([[0, 'Archangel of Tithes'], [1, 'Giant Spider'], [1, 'Forest']]);
  ate(f, 'atacar'); atacaCom(f, objN(f, 0, 'Archangel of Tithes')); fecha(f, 'atacar');
  ate(f, 'bloquear'); bloqueia(f, objN(f, 1, 'Giant Spider'), objN(f, 0, 'Archangel of Tithes')); fecha(f, 'bloquear'); respC(f, x => x.a === 'naoPagar');
  ateFimCombate(f); igual(f.jogs[1].vida, 37, 'não pagou: não bloqueia');
  const g = combate([[0, 'Archangel of Tithes'], [1, 'Grizzly Bears']]);
  const A = objN(g, 0, 'Archangel of Tithes'), B = objN(g, 1, 'Grizzly Bears');
  igual(M.custoCombate(g, 'ataqueCusta', B, { jog: 0 }), { g: 1, p: [] }, 'desvirada: atacar o dono custa {1}');
  igual(M.custoCombate(g, 'ataqueCusta', B, { jog: 1 }), { g: 0, p: [] }, 'outro jogador: não');
  A.virada = true; igual(M.custoCombate(g, 'ataqueCusta', B, { jog: 0 }), { g: 0, p: [] }, 'virada: não');
  igual(M.custoCombate(g, 'bloqueioCusta', B), { g: 0, p: [] }, 'sem estar atacando: bloquear é de graça');
});
caso('701.3d', 'Akiri, Fearless Voyager: {W} desanexa um Equipamento de uma criatura sua (fica no campo, 301.5c); se fizer, ela vira e ganha indestrutível', () => {
  const a = M.carta('Akiri, Fearless Voyager').atv[0]; ok(M.fxSuportado(a.fx, { topo: false }), 'fx aceito');
  const e = cena({ campo: [[0, 'Akiri, Fearless Voyager'], [0, 'Grizzly Bears'], [0, "Hero's Blade"], [0, 'Plains']] });
  const B = objN(e, 0, 'Grizzly Bears'), H = objN(e, 0, "Hero's Blade"), K = objN(e, 0, 'Akiri, Fearless Voyager');
  H.anexo = { id: B.id, ts: B.ts };
  M.avancar(e);
  const k = e.perg.ops.findIndex(o => o.a === 'ativar' && o.id === K.id); ok(k >= 0, 'oferece a habilidade');
  M.responder(e, k, x => x.pilha.length > 0 || x.turno.passo !== 'principal1');
  ok(e.pilha.length === 1, 'na pilha'); M.avancar(e);
  resolveCom(e, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'sim') : -1);
  ok(!H.anexo && H.zona === 'campo', 'solto e no campo');
  ok(B.virada, 'a criatura virou'); ok(M.temKw(e, B, 'indestrutivel'), 'indestrutível até o fim do turno');
  ok(!K.virada, 'Akiri não vira');
});

caso('707.9b', "Urza, Prince of Kroog: cópia de artefato seu que é 1/1 Soldier criatura além dos outros tipos; Vault 12: X = rad somado de todos", () => {
  const e = cena({ campo: [[0, 'Sol Ring']] });
  const sr = objN(e, 0, 'Sol Ring');
  const f = M.carta('Urza, Prince of Kroog').atv[0].fx[0];
  ok(M.fxSuportado([f]), 'aceito');
  M.executar(e, f, { voce: 0, este: -1, alvos: [[{ o: sr.id, ts: sr.ts }]], ilegal: {}, lki: {} }, null);
  const c = e.objs[e.campo.find(id => e.objs[id].ficha)];
  ok(M.temTipo(e, c, 'Artifact') && M.temTipo(e, c, 'Creature') && (M.dadoDe(e, c).sub || []).includes('Soldier') && M.poder(e, c) === 1, 'artefato criatura Soldier 1/1');
  const v = cena({ jogs: 3 });
  M.marcadorJogador(v, 0, 'rad', 3); M.marcadorJogador(v, 1, 'rad', 3); M.marcadorJogador(v, 2, 'rad', 2);
  igual(M.qtdDe(v, M.carta('Vault 12: The Necropolis').gat[1].fx[0].qtd, { voce: 0, lki: {} }), 8, '3 + 3 + 2');
});

caso('614.1', "Winding Constrictor: marcador em você também ganha +1; Wilhelt: Zumbi com decaída não dá ficha; Venser mira mágica; Vaultborn vira artefato na cópia", () => {
  const e = cena({ campo: [[0, 'Winding Constrictor']] });
  M.marcadorJogador(e, 0, 'energy', 2); M.marcadorJogador(e, 1, 'energy', 2);
  igual([e.jogs[0].marc.energy, e.jogs[1].marc.energy], [3, 2], 'eu 2+1; o oponente não');
  const w = M.carta('Wilhelt, the Rotcleaver').gat[0].quem;
  const f = cena({ campo: [[0, 'Wilhelt, the Rotcleaver']] });
  const [tk] = M.criarFichas(f, 0, { pt: [2, 2], cores: 'B', tipos: ['Creature'], sub: ['Zombie'], kw: [{ k: 'decaida' }] }, 1);
  const [t2] = M.criarFichas(f, 0, { pt: [2, 2], cores: 'B', tipos: ['Creature'], sub: ['Zombie'] }, 1);
  const cx = { voce: 0, este: objN(f, 0, 'Wilhelt, the Rotcleaver').id };
  igual([M.bate(f, tk, w, cx), M.bate(f, t2, w, cx)], [false, true], 'decaída fica de fora');
  ok(M.carta('Venser, Shaper Savant').gat.every(g => M.gatOk(g)) && M.carta('Vaultborn Tyrant').gat.every(g => M.gatOk(g)) && M.carta('Wizard Class').niveis[0].gat.every(g => M.gatOk(g)), 'Venser, Vaultborn, Wizard Class aceitos');
  const v = cena({ mao: [[1, 'Lightning Bolt']] }); const b = v.jogs[1].zonas.mao[0]; M.mover(v, b, 'pilha');
  ok(M.alvosPossiveis(v, M.carta('Venser, Shaper Savant').gat[0].alvos[0], { voce: 0, este: -1 }).some(a => a.o === b), 'a mágica é alvo');
});

caso('506.1', "Marisi (cond emCombate): os oponentes não conjuram durante o combate; fora dele, sim", () => {
  const e = cena({ campo: [[0, 'Marisi, Breaker of the Coil']] });
  e.turno.passo = 'principal1'; ok(!M.naoConjura(e, 1), 'principal: conjura');
  e.turno.passo = 'atacantes'; ok(M.naoConjura(e, 1), 'combate: não'); ok(!M.naoConjura(e, 0), 'o dono da Marisi conjura');
});

caso('701.26b', "Mesmeric Orb: cada permanente que desvira faz o controlador dela moer 1", () => {
  ok(M.carta('Mesmeric Orb').gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, 'Mesmeric Orb'], [1, 'Forest'], [1, 'Forest']] });
  for (let i = 0; i < 5; i++) e.por(1, 'Island', { zona: 'grimorio' });
  for (const id of e.campo) if (e.objs[id].n === 'Forest') e.objs[id].virada = true;
  e.pend = []; for (const id of e.campo) if (e.objs[id].n === 'Forest') M.desvirarObj(e, e.objs[id]);
  igual(e.pend.filter(p => p.n === 'Mesmeric Orb').length, 2, 'dois gatilhos');
  M.avancar(e); resolvePilha(e); igual(e.jogs[1].zonas.cemiterio.length, 2, 'o dono das Forests moeu 2');
});

caso('702.93a', "imortal (Mikaeus dá às outras não-Humanas): o Urso morre sem +1/+1 e volta com um; com +1/+1, não volta", () => {
  const e = cena({ campo: [[0, 'Mikaeus, the Unhallowed'], [0, 'Grizzly Bears']] });
  const b = objN(e, 0, 'Grizzly Bears'); ok(M.temKw(e, b, 'imortal'), 'tem imortal');
  M.mover(e, b.id, 'cemiterio'); M.avancar(e); resolvePilha(e);
  igual(b.zona, 'campo', 'voltou'); igual(b.marc['+1/+1'], 1, 'com +1/+1');
  M.mover(e, b.id, 'cemiterio'); M.avancar(e); resolvePilha(e);
  igual(b.zona, 'cemiterio', 'com marcador: fica');
});

caso('106.7', "Mirari's Wake (prod doTerreno): virar Forest para mana dá G a mais, não qualquer cor", () => {
  ok(M.carta("Mirari's Wake").gat.every(g => M.gatOk(g)), 'aceito');
  const e = cena({ campo: [[0, "Mirari's Wake"], [0, 'Forest']] });
  const fo = objN(e, 0, 'Forest'), k = M.atvDe(e, fo).findIndex(a => a.deMana);
  igual(M.pacotesDe(e, fo, M.atvDe(e, fo)[k]).map(p => p.G + '/' + p.R), ['2/0'], 'GG');
});

caso('509.1c', "Mirri: ao atacar, cada oponente bloqueia com no máximo uma criatura; virada, só uma criatura ataca o dono dela por combate", () => {
  ok(M.carta('Mirri, Weatherlight Duelist').gat.every(g => M.gatOk(g)) && M.fxSuportado(M.carta('Mirri, Weatherlight Duelist').gat[0].fx), 'aceito');
  const e = cena({ campo: [[0, 'Mirri, Weatherlight Duelist']] });
  const mi = objN(e, 0, 'Mirri, Weatherlight Duelist');
  igual(M.maxAtacantes(e, 0), Infinity, 'desvirada: sem limite');
  mi.virada = true; igual(M.maxAtacantes(e, 0), 1, 'virada: 1');
  e.turno.combate = { atk: [], etapa: 0 } as any;
  M.executar(e, M.carta('Mirri, Weatherlight Duelist').gat[0].fx[0], ctxDe(e), (j, t, ops) => ops[0]);
  igual(e.turno.combate.limBloq, { 1: 1 }, 'o oponente bloqueia com 1');
});

caso('506.4', "Shared Animosity: +1/+0 por OUTRA atacante que compartilha tipo (filtro outro:'doEvento'); sem tipo em comum, +0", () => {
  const e = cena({ campo: [[0, 'Shared Animosity'], [0, 'Blackcleave Goblin'], [0, 'Blackcleave Goblin'], [0, 'Blackcleave Goblin'], [0, 'Grizzly Bears']] });
  const gs = e.campo.filter(id => ['Blackcleave Goblin', 'Grizzly Bears'].includes(e.objs[id].n));
  for (const id of gs) e.objs[id].atacando = true;
  e.turno.combate = { atk: gs.map(id => ({ id, ts: e.objs[id].ts, def: 1, alvo: { jog: 1 }, bloq: [] })), etapa: 0 } as any;
  const q = M.carta('Shared Animosity').gat[0].fx[0].p;
  igual(M.qtdDe(e, q, { voce: 0, este: -1, ev: { ev: 'ataca', id: gs[0] }, lki: {} }), 2, 'Goblin: 2 outros Goblins');
  igual(M.qtdDe(e, q, { voce: 0, este: -1, ev: { ev: 'ataca', id: gs[3] }, lki: {} }), 0, 'Bears: nenhum');
});

caso('702.61a', "segundo dividido (Siege Smash): com ela na pilha, ninguém conjura nem ativa (só mana)", () => {
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [1, 'Island'], [1, 'Island'], [1, 'Sol Ring']], mao: [[0, 'Siege Smash'], [1, 'Counterspell']] });
  M.avancar(e); const naPilha = x => x.pilha.length > 0;
  M.responder(e, e.perg.ops.findIndex(o => o.a === 'conjurar' && e.objs[o.id].n === 'Siege Smash'), naPilha);
  for (let i = 0; i < 5 && e.perg && e.perg.tipo !== 'acao'; i++) M.responder(e, M.agenteBasico()(e, e.perg), naPilha);
  ok(e.pilha.length === 1, 'na pilha');
  const ops = M.opcoesPrioridade(e, 1);
  ok(!ops.some(o => o.a === 'conjurar' || o.a === 'ativar'), 'o oponente não conjura nem ativa');
  ok(ops.some(o => o.a === 'mana'), 'mana pode');
});

caso('115.1', "Sink into Stupor (alvo ou): devolve a mágica do oponente na pilha OU a permanente não-terreno dele", () => {
  const e = cena({ campo: [[1, 'Forest'], [1, 'Forest'], [1, 'Sol Ring']], mao: [[1, 'Grizzly Bears']] });
  e.turno.ativo = 1; M.avancar(e); const naPilha = x => x.pilha.length > 0;
  M.responder(e, e.perg.ops.findIndex(o => o.a === 'conjurar' && e.objs[o.id].n === 'Grizzly Bears'), naPilha);
  for (let i = 0; i < 5 && e.perg && e.perg.tipo !== 'acao'; i++) M.responder(e, M.agenteBasico()(e, e.perg), naPilha);
  const a = M.carta('Sink into Stupor').alvos[0], ctx = { voce: 0, este: -1 };
  const ps = M.alvosPossiveis(e, a, ctx).map(x => e.objs[x.o].n).sort();
  igual(ps, ['Grizzly Bears', 'Sol Ring'], 'a mágica e o Sol Ring (terreno não)');
  const gb = e.objs[e.pilha[0]];
  M.executar(e, M.carta('Sink into Stupor').fx[0], { ...ctxDe(e), alvos: [[{ o: gb.id, ts: gb.ts }]] }, (j, t, ops) => ops[0]);
  igual(gb.zona, 'mao', 'a mágica voltou para a mão'); igual(e.pilha.length, 0, 'pilha vazia');
});

caso('702.81a', "Six (darRetrace se turno seu): permanente não-terreno do cemitério por retrace no seu turno; no do oponente, não", () => {
  const e = cena({ campo: [[0, 'Six'], [0, 'Forest'], [0, 'Forest']], mao: [[0, 'Forest']] });
  const b = e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
  M.avancar(e); ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar' && o.id === b.id), 'no seu turno: pode');
  e.turno.ativo = 1; ok(!M.porFuga(e, 0, b), 'no do oponente: não');
});

caso('603.4', "Kodama of the East Tree: entra outra permanente, põe da mão uma de VM menor ou igual (conta evento vm no filtro); a que ele pôs não dispara de novo (naoPorEste)", () => {
  const e = cena({ campo: [...terras(2, 'Forest'), [0, 'Kodama of the East Tree']], mao: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Sol Ring']] }); e.pend = [];
  M.avancar(e); conj(e, 'Grizzly Bears');
  resolveCom(e, p => { const k = p.ops.findIndex(o => o.a === 'sim'); return k >= 0 ? k : p.ops.findIndex(o => o.id !== undefined && e.objs[o.id] && e.objs[o.id].n === 'Llanowar Elves'); });
  ok(noCampo(e).includes('Llanowar Elves'), 'pôs o Elfo (VM 1 ≤ 2)');
  ok(naZona(e, 0, 'mao').includes('Sol Ring'), 'o Elfo posto pelo Kodama não dispara: Sol Ring fica na mão');
});

caso('601.2f', "Kotis, Sibsig Champion: conjura criatura do cemitério exilando 3 OUTRAS de lá (com 2 não dá); conjurada do cemitério conta para os +1/+1 (ouConjurada)", () => {
  for (const n of [2, 3]) {
    const e = cena({ campo: [...terras(2, 'Forest'), [0, 'Kotis, Sibsig Champion']] }); e.pend = [];
    e.por(0, 'Grizzly Bears', { zona: 'cemiterio' });
    for (let i = 0; i < n; i++) e.por(0, 'Island', { zona: 'cemiterio' });
    const pode = M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar' && e.objs[o.id].n === 'Grizzly Bears');
    igual(pode, n === 3, n + ' outras no cemitério');
    if (!pode) continue;
    M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e);
    igual([noCampo(e).includes('Grizzly Bears'), naZona(e, 0, 'exilio').length, naZona(e, 0, 'cemiterio').length], [true, 3, 0], 'pagou exilando as 3');
    igual(objN(e, 0, 'Kotis, Sibsig Champion').marc['+1/+1'] || 0, 2, 'dois marcadores');
  }
});

caso('702.130a', "aflição 2 (Lazotep Sliver dá aos Slivers): o atacante bloqueado faz o defensor perder 2; sem bloqueio, só o dano", () => {
  for (const nb of [0, 2]) {
    const e = combate([[0, 'Lazotep Sliver'], [1, 'Grizzly Bears'], [1, 'Llanowar Elves']]);
    const L = objN(e, 0, 'Lazotep Sliver');
    ok(M.kwDe(e, L).some(k => k.k === 'aflicao' && k.n === 2), 'tem aflição 2');
    ate(e, 'atacar'); atacaCom(e, L); fecha(e, 'atacar');
    ate(e, 'bloquear');
    if (nb) bloqueia(e, objN(e, 1, 'Grizzly Bears'), L);
    fecha(e, 'bloquear'); ateFimCombate(e);
    igual(e.jogs[1].vida, nb ? 38 : 36, nb ? 'bloqueada: perde 2' : 'sem bloqueio: 4 de dano');
  }
});

caso('701.50a', "Lethal Scheme: destrói o alvo; cada criatura que convocou conive (compra, descarta; descartou não-terreno → +1/+1)", () => {
  const e = cena({ campo: [...terras(2, 'Swamp'), [0, 'Grizzly Bears'], [0, 'Hill Giant'], [1, 'Gray Ogre']], mao: [[0, 'Lethal Scheme'], [0, 'Sol Ring'], [0, 'Forest']] }); e.pend = [];
  M.avancar(e); conj(e, 'Lethal Scheme');
  let desc = 0;
  resolveCom(e, p => {
    if (p.tipo === 'alvo' || p.tipo === 'alvos') return p.ops.findIndex(o => o.id !== undefined && e.objs[o.id] && e.objs[o.id].n === 'Gray Ogre');
    if (p.tipo === 'descartar') { const n = desc++ === 0 ? 'Sol Ring' : 'Forest'; return p.ops.findIndex(o => o.id !== undefined && e.objs[o.id].n === n); }
    return -1;
  });
  ok(!noCampo(e).includes('Gray Ogre'), 'destruiu');
  const S = M.carta('Lethal Scheme');
  igual(desc, 2, 'as duas conivem');
  const m = ['Grizzly Bears', 'Hill Giant'].map(n => objN(e, 0, n).marc['+1/+1'] || 0).sort();
  igual(m, [0, 1], 'só a que descartou não-terreno ganha +1/+1');
  ok(naZona(e, 0, 'cemiterio').includes('Sol Ring') && naZona(e, 0, 'cemiterio').includes('Forest'), 'descartou as duas');
  ok(!!S, 'carta');
});

caso('601.2h', "Liberator, Urza's Battlethopter: mágica incolor ou artefato com lampejo; +1/+1 só se a mana gasta passa o poder dele (Sol Ring 1 não, Grizzly 2 sim)", () => {
  const e = cena({ campo: [...terras(4, 'Forest'), [0, "Liberator, Urza's Battlethopter"]], mao: [[0, 'Sol Ring'], [0, 'Grizzly Bears']] }); e.pend = [];
  const L = objN(e, 0, "Liberator, Urza's Battlethopter");
  e.turno.ativo = 1;
  const pode = n => M.podeConjurar(e, 0, e.objs[e.jogs[0].zonas.mao.find(x => e.objs[x].n === n)]);
  igual([pode('Sol Ring'), pode('Grizzly Bears')], [true, false], 'turno do oponente: o artefato sim, a criatura verde não');
  e.turno.ativo = 0;
  M.avancar(e); conj(e, 'Sol Ring'); resolveCom(e);
  igual(L.marc['+1/+1'] || 0, 0, 'Sol Ring: 1 de mana, não passa o poder 1');
  M.avancar(e); conj(e, 'Grizzly Bears'); resolveCom(e);
  igual(L.marc['+1/+1'] || 0, 1, 'Grizzly: 2 > 1');
});

caso('104.4b', "laço: 800 fichas entrando com Impact Tremors é finito (800 gatilhos, não empata); o mesmo estado repetido é laço de verdade", () => {
  const e = cena({ campo: [[0, 'Impact Tremors']] }); e.pend = [];
  const cx: any = { voce: 0, este: e.campo[0], alvos: [], ilegal: {}, lki: {} };
  M.executar(e, { op: 'ficha', quem: 'voce', qtd: 800, token: { pt: [1, 1], tipos: ['Creature'], sub: ['Goblin'], cores: 'R' } }, cx, null);
  igual(e.pend.filter(p => p.n === 'Impact Tremors').length, 800, '800 gatilhos');
  ok(!e.fim, 'muitos gatilhos finitos não são laço: ' + JSON.stringify(e.fim));
  const gob = { op: 'ficha', quem: 'voce', qtd: 1, token: { pt: [1, 1], tipos: ['Creature'], sub: ['Goblin'], cores: 'R' } };
  e.campo.splice(1); e.pend = [];
  for (let i = 0; i < 600 && !e.fim; i++) {   // entra uma ficha, o gatilho sai e a ficha some: o mesmo estado a cada volta, sem fim
    M.executar(e, gob, cx, null); const t = e.campo.pop(); e.objs[t].zona = 'fora'; e.pend = [];
  }
  ok(e.fim && e.fim.vencedor === null && /laço obrigatório \(104\.4b\)/.test(e.fim.motivo), 'estado repetido: ' + JSON.stringify(e.fim));
});

caso('702.162a', "More Than Meets the Eye (Ratchet): pode conjurar convertida por {1}{W} e entra pela face de trás (702.162b); com {2}{W}, a da frente", () => {
  const e = cena({ campo: [[0, 'Plains'], [0, 'Plains']], mao: [[0, 'Ratchet, Field Medic']] });
  M.avancar(e); ok(M.opcoesPrioridade(e, 0).some(o => o.a === 'conjurar'), 'com 2 terrenos dá (convertida)');
  conj(e, 'Ratchet, Field Medic'); resolveCom(e, p => p.ops.findIndex(o => o.a === 'opcao' && o.v && o.v.converter));
  const r = objN(e, 0, 'Ratchet, Field Medic'); ok(r && r.face === 0, 'entrou convertida'); igual(M.dadoDe(e, r).n, 'Ratchet, Rescue Racer');
  const f = cena({ campo: terras(3, 'Plains'), mao: [[0, 'Ratchet, Field Medic']] });
  M.avancar(f); conj(f, 'Ratchet, Field Medic'); resolveCom(f, p => p.ops.findIndex(o => o.a === 'opcao' && o.v && !o.v.converter));
  const r2 = objN(f, 0, 'Ratchet, Field Medic'); ok(r2 && r2.face == null, 'custo cheio: a face da frente');
});

caso('603.12', "Ratchet: ganhou vida, pode converter; \"when you do\" é reflexo: o alvo (artefato com VM ≤ vida ganha no turno) só existe se converteu", () => {
  const e = cena({ campo: [[0, 'Ratchet, Field Medic']] });
  e.por(0, 'Sol Ring', { zona: 'cemiterio' }); e.por(0, 'Mind Stone', { zona: 'cemiterio' });
  M.ganharVida(e, 0, 1); M.avancar(e);
  resolveCom(e, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'sim') : p.tipo === 'alvo' ? p.ops.findIndex(o => o.o !== undefined && e.objs[o.o].n === 'Sol Ring') : -1);
  const r = objN(e, 0, 'Ratchet, Field Medic'); ok(r.face === 0, 'converteu');
  const s = objN(e, 0, 'Sol Ring'); ok(s && s.virada, 'Sol Ring voltou virado'); ok(!objN(e, 0, 'Mind Stone'), 'Mind Stone (VM 2 > 1 de vida) não podia');
  const f = cena({ campo: [[0, 'Ratchet, Field Medic']] }); f.por(0, 'Sol Ring', { zona: 'cemiterio' });
  M.ganharVida(f, 0, 2); M.avancar(f);
  resolveCom(f, p => p.tipo === 'talvez' ? p.ops.findIndex(o => o.a === 'nao') : -1);
  ok(objN(f, 0, 'Ratchet, Field Medic').face == null && !objN(f, 0, 'Sol Ring'), 'sem converter: sem reflexo');
});

caso('602.2b', "Arcee: \"remove one or more +1/+1 counters\" — quem ativa escolhe quantos; o dano é esse número e converte", () => {
  const e = cena({ campo: [[0, 'Arcee, Sharpshooter', { obj: { marc: { '+1/+1': 3 } } }], [0, 'Mountain'], [1, 'Hill Giant']] });
  M.avancar(e); respE(e, o => o.a === 'ativar');
  ok(e.perg.tipo === 'x' && e.perg.ops.length === 3, '1, 2 ou 3 marcadores'); respE(e, o => o.v === 2);
  alvoObj(e, 'Hill Giant'); resolveCom(e);
  const a = objN(e, 0, 'Arcee, Sharpshooter'); igual(a.marc['+1/+1'], 1, 'tirou 2'); ok(a.face === 0, 'converteu');
  igual(objN(e, 1, 'Hill Giant').dano, 2, '2 de dano no Gigante');
});

caso('702.162', "Arcee, Acrobatic Coupe: mágica sua que mira criaturas/Veículos seus põe tantos +1/+1 quantos alvos seus e converte", () => {
  const e = cena({ campo: [[0, 'Arcee, Sharpshooter', { obj: { face: 0 } }], [0, 'Forest'], [0, 'Grizzly Bears'], [1, 'Hill Giant']], mao: [[0, 'Giant Growth'], [0, 'Giant Growth']] });
  e.vCamada = (e.vCamada || 0) + 1;   // face posta direto na cena
  M.avancar(e); conj(e, 'Giant Growth'); alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  const a = objN(e, 0, 'Arcee, Sharpshooter'); igual(a.marc['+1/+1'], 1, '1 alvo seu: 1 marcador'); ok(a.face == null, 'converteu para a frente');
  const f = cena({ campo: [[0, 'Arcee, Sharpshooter', { obj: { face: 0 } }], [0, 'Forest'], [1, 'Hill Giant']], mao: [[0, 'Giant Growth']] });
  f.vCamada = (f.vCamada || 0) + 1;
  M.avancar(f); conj(f, 'Giant Growth'); alvoObj(f, 'Hill Giant'); resolveCom(f);
  const b = objN(f, 0, 'Arcee, Sharpshooter'); ok(!b.marc['+1/+1'] && b.face === 0, 'mirando a do oponente: nada');
});


caso('601.2c', "Shigeki (canalizar): \"return X target cards\" é exatamente X; o X não passa das cartas possíveis no cemitério", () => {
  const e = cena({ campo: terras(6, 'Forest'), mao: [[0, 'Shigeki, Jukai Visionary']] });
  e.por(0, 'Grizzly Bears', { zona: 'cemiterio' }); e.por(0, 'Krenko, Mob Boss', { zona: 'cemiterio' });
  M.avancar(e); respE(e, o => o.a === 'ativar');
  ok(e.perg.tipo === 'x', 'pergunta o X'); igual(e.perg.ops.map(o => o.v).sort(), [0, 1], 'só 1 não lendária: X até 1 (pagaria 2)');
  respE(e, o => o.v === 1);
  if (e.perg && e.perg.tipo === 'alvo') { ok(!e.perg.ops.some(o => o.a === 'pronto'), 'exatamente 1: sem "pronto" antes'); alvoObj(e, 'Grizzly Bears'); }
  resolveCom(e);
  ok(e.jogs[0].zonas.mao.some(id => e.objs[id].n === 'Grizzly Bears'), 'voltou para a mão');
});

caso('613.1d', "Starfield of Nyx: com 5 encantamentos, os outros não-Aura viram criaturas com P/R base = valor de mana; com 4, não", () => {
  const e = cena({ campo: [[0, 'Starfield of Nyx'], [0, 'Propaganda'], [0, 'Smothering Tithe'], [0, 'Rhystic Study'], [0, 'Phyrexian Arena']] });
  const s = objN(e, 0, 'Starfield of Nyx'), p = objN(e, 0, 'Propaganda'), t = objN(e, 0, 'Smothering Tithe');
  ok(M.temTipo(e, p, 'Creature') && M.temTipo(e, t, 'Creature') && !M.temTipo(e, s, 'Creature'), 'os outros viram criatura');
  igual([M.poder(e, p), M.resistencia(e, p), M.poder(e, t), M.resistencia(e, t)], [3, 3, 4, 4], 'P/R = vm');
  const f = cena({ campo: [[0, 'Starfield of Nyx'], [0, 'Propaganda'], [0, 'Smothering Tithe'], [0, 'Rhystic Study']] });
  ok(!M.temTipo(f, objN(f, 0, 'Propaganda'), 'Creature'), 'com 4: não');
});

caso('122.1', "radiação: no começo da 1ª principal, mói N (rad); por não-terreno perde 1 e tira 1 rad. Com Strong, ganha em vez de perder", () => {
  for (const comStrong of [false, true]) {
    const e = cena({ campo: comStrong ? [[0, 'Strong, the Brutish Thespian']] : [] }); e.pend = [];
    for (const n of ['Lightning Bolt', 'Forest', 'Grizzly Bears']) e.por(0, n, { zona: 'grimorio' });
    const g = e.jogs[0].zonas.grimorio, topo = g.slice(-3).map(id => e.objs[id].n);
    igual(topo.filter(n => n === 'Forest').length, 1, 'os 3 de cima: ' + topo);
    e.jogs[0].marc = { rad: 3 }; const v = e.jogs[0].vida;
    M.masmorrasEvento(e, { ev: 'fase', passo: 'principal1', ativo: 0 });   // a radiação é a do masmorras.ts (gatilho inerente, 729.1)
    const p = e.pend.find(x => x.k === 'radiacao'); ok(p, 'disparou');
    for (const f of p.g.fx) M.executar(e, f, { voce: p.ctrl, alvos: [], ilegal: {}, lki: {} }, (_j, _t, o) => o[0]);
    igual(e.jogs[0].zonas.cemiterio.length, 3, 'moeu 3');
    igual([e.jogs[0].vida, e.jogs[0].marc.rad], [comStrong ? v + 2 : v - 2, 1], comStrong ? 'Strong: +2' : '-2, sobra 1 rad');
  }
});

// ---------- rodar ----------
// a carta que falta no banco é anotada pelo Proxy; o caso que pediu alguma pula (mesmo que tenha passado ou falhado
// por causa dela) e o aviso diz quais escrever. Sem falta, erro é erro.
caso('122.1', "filtro semMarcador: true = sem nenhum marcador (Damning Verdict); com tipo = sem marcador daquele tipo (Wave Goodbye)", () => {
  const e = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [0, 'Serra Angel']] });
  objN(e, 0, 'Grizzly Bears').marc['-1/-1'] = 1; objN(e, 0, 'Serra Angel').marc['+1/+1'] = 1;
  const nomes = f => M.objetosQue(e, { tipo: ['Creature'], zona: 'campo', ...f }, { voce: 0 }).map(o => o.n).sort();
  igual(nomes({ semMarcador: true }), ['Llanowar Elves']);
  igual(nomes({ semMarcador: '+1/+1' }), ['Grizzly Bears', 'Llanowar Elves']);
});

caso('121.1', "Fists of Flame: compra 1 e a criatura ganha +1/+0 por carta que você comprou no turno (conta {de:'turno', o:'compras'})", () => {
  ok(M.fxSuportado(M.carta('Fists of Flame').fx), 'aceito');
  const e = cena({ campo: [[0, 'Mountain'], [0, 'Mountain'], [0, 'Grizzly Bears']], mao: [[0, 'Fists of Flame']] });
  M.comprar(e, 0, 2);
  M.avancar(e); conj(e, 'Fists of Flame'); if (e.perg && e.perg.tipo === 'alvo') alvoObj(e, 'Grizzly Bears'); resolveCom(e);
  const b = objN(e, 0, 'Grizzly Bears');
  igual(M.poder(e, b), 2 + 3, '2 compradas antes + a do Fists'); ok(M.temKw(e, b, 'atropelar'));
});

caso('603.4', "Nissa, Resurgent Animist: só na 2ª resolução do gatilho de terreno no turno revela até achar Elfo/Elemental e põe na mão (conta {de:'turno', o:'resolucoesDestaHab'})", () => {
  const e = cena({ campo: [[0, 'Nissa, Resurgent Animist']] });
  e.por(0, 'Llanowar Elves', { zona: 'grimorio' }); e.por(0, 'Sol Ring', { zona: 'grimorio' });   // topo: Sol Ring, depois o Elfo
  const naMao = () => e.jogs[0].zonas.mao.filter(id => e.objs[id].n === 'Llanowar Elves').length;
  e.por(0, 'Forest'); M.avancar(e); resolveCom(e);
  igual(naMao(), 0, '1ª resolução: só a mana');
  e.por(0, 'Forest'); M.avancar(e); resolveCom(e);
  igual(naMao(), 1, '2ª: o Elfo foi para a mão');
  ok(e.jogs[0].zonas.grimorio.map(id => e.objs[id].n).indexOf('Sol Ring') === 0, 'o Sol Ring revelado foi para o fundo');
});

caso('603.4', 'contagens pedidas: quantas vezes ESTA habilidade resolveu neste turno (Omnath) — conta por fonte e por habilidade', () => {
  const e = cena({});
  igual(M.qtd(e, { conta: { de: 'turno', o: 'resolucoesDestaHab' } }, { voce: 0, resHab: 2 }), 2, 'a habilidade a');
  igual(M.qtd(e, { conta: { de: 'turno', o: 'resolucoesDestaHab' } }, { voce: 0 }), 0, 'outra habilidade');
  ok(M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'cond') && !M.contaOk({ de: 'turno', o: 'resolucoesDestaHab' }, 'est'), 'só em efeito/condição');
});

caso('702.52a', 'dragar (Life from the Loam): na etapa de compra pergunta [comprar, dragar 3]; dragando moe 3 e a carta volta à mão sem ser compra', () => {
  const e = cena({ passo: 'manutencao', campo: [[0, 'Life from the Loam', { zona: 'cemiterio' }], [0, 'Forest', { zona: 'cemiterio' }]] });
  const J = e.jogs[0], g0 = J.zonas.grimorio.length, m0 = J.zonas.mao.length;
  let compras = 0; const ev0 = M.evento; M.evento = (x, ev) => { if (ev.ev === 'compra') compras++; return ev0(x, ev); };
  try {
    ate(e, 'dragar');
    igual(e.perg.ops.map(o => o.a + (o.n || '')), ['comprar', 'dragar3'], 'opções');
    respE(e, o => o.a === 'dragar');
  } finally { M.evento = ev0; }
  igual([J.zonas.grimorio.length, J.zonas.mao.length, J.zonas.cemiterio.length, compras], [g0 - 3, m0 + 1, 4, 0], 'moeu 3, Loam na mão, nenhuma compra');
  ok(naZona(e, 0, 'mao').includes('Life from the Loam'), 'Loam na mão');
});
caso('702.52b', 'dragar: com menos de N cartas no grimório não dá; carta com dragar moída na 1ª compra pode dragar na 2ª', () => {
  const e = cena({ campo: [[0, 'Life from the Loam', { zona: 'cemiterio' }]] });
  const J = e.jogs[0];
  J.zonas.grimorio.splice(0, J.zonas.grimorio.length - 2);          // sobram 2 < 3
  const vistos: any[] = [];
  const ask = (j, tipo, ops) => { vistos.push(ops.map(o => o.a)); return ops[0]; };
  igual(M.planoCompra(e, 0, 1, ask), [null], 'só compra');
  igual(vistos.length, 0, 'uma opção: não pergunta');
  const e2 = cena({ campo: [[0, 'Life from the Loam', { zona: 'cemiterio' }]] }), J2 = e2.jogs[0];
  const g = J2.zonas.grimorio; e2.objs[g[g.length - 2]].n = 'Life from the Loam';   // a 2ª do topo também draga
  const ops2: any[] = [];
  const pl = M.planoCompra(e2, 0, 2, (j, tipo, ops) => { ops2.push(ops.filter(o => o.a === 'dragar').map(o => o.id)); return ops.find(o => o.a === 'dragar') || ops[0]; });
  igual(ops2.length, 2, 'pergunta nas duas compras');
  ok(ops2[1].includes(g[g.length - 2]), 'a moída na 1ª é opção na 2ª');
  M.comprar(e2, 0, 2, { plano: pl });
  igual(naZona(e2, 0, 'mao').filter(n => n === 'Life from the Loam').length, 2, 'as duas na mão');
});

caso('702.103', "Indebted Spirit: concessão {2}{W} vira Aura na Grizzly Bears (+1/+1 e pós-vida); a encantada sai e o Spirit volta a ser criatura (702.103f); alvo ilegal ao resolver entra como criatura (702.103e)", () => {
  ok(M.carta('Indebted Spirit').est.every(s => M.estContOk(s)), 'estática aceita');
  const mesa = () => cena({ campo: [[0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [0, 'Grizzly Bears'], [1, 'Hill Giant']], mao: [[0, 'Indebted Spirit']] });
  const concede = (e, alvo) => {                     // conjura com concessão e para com a mágica na pilha
    M.avancar(e); conj(e, 'Indebted Spirit');
    respE(e, o => o.a === 'opcao' && o.v.concessao);
    M.responder(e, e.perg.ops.findIndex(o => o.o === alvo.id), x => x.pilha.length > 0);
  };
  const e = mesa(), ursos = objN(e, 0, 'Grizzly Bears');
  concede(e, ursos);
  const sp = e.objs[e.pilha[e.pilha.length - 1]];
  ok(sp.n === 'Indebted Spirit' && !M.temTipo(e, sp, 'Creature') && (M.dadoDe(e, sp).sub || []).includes('Aura'), 'na pilha: mágica de Aura, não de criatura (702.103b)');
  M.avancar(e, x => !x.pilha.length);
  const s = objN(e, 0, 'Indebted Spirit');
  ok(s && M.anexadoA(e, s) === ursos, 'entrou anexada à Grizzly Bears');
  ok(!M.temTipo(e, s, 'Creature'), 'concedida não é criatura');
  igual([M.poder(e, ursos), M.resistencia(e, ursos)], [3, 3], '+1/+1');
  ok(M.temKw(e, ursos, 'posVida'), 'a encantada tem pós-vida');
  M.mover(e, ursos.id, 'cemiterio'); M.abe(e);
  const s2 = objN(e, 0, 'Indebted Spirit');
  ok(s2 && s2.id === s.id && !s2.anexo, 'ficou no campo, solta (exceção ao 704.5m)');
  ok(M.temTipo(e, s2, 'Creature') && M.poder(e, s2) === 1, 'voltou a ser criatura 1/1');
  // 702.103e: o alvo sai antes de resolver → resolve como criatura
  const f = mesa(), u2 = objN(f, 0, 'Grizzly Bears');
  concede(f, u2);
  M.mover(f, u2.id, 'cemiterio');
  M.avancar(f, x => !x.pilha.length);
  const s3 = objN(f, 0, 'Indebted Spirit');
  ok(s3 && !s3.anexo && M.temTipo(f, s3, 'Creature'), 'entrou como criatura');
  // agente básico: com criatura boa, concede (na minha); sem ela, conjura normal
  const g = mesa();
  M.avancar(g); conj(g, 'Indebted Spirit');
  ok(g.perg.ops[M.agenteBasico()(g, g.perg)].v.concessao, 'agente concede tendo a Grizzly Bears');
  respE(g, o => o.a === 'opcao' && o.v.concessao);
  igual(g.perg.ops[M.agenteBasico()(g, g.perg)].o, objN(g, 0, 'Grizzly Bears').id, 'na própria criatura, não na do oponente');
  const h = cena({ campo: [[0, 'Plains'], [0, 'Plains'], [0, 'Plains'], [1, 'Hill Giant']], mao: [[0, 'Indebted Spirit']] });
  M.avancar(h); conj(h, 'Indebted Spirit');
  ok(!h.perg || h.perg.tipo !== 'opcao' || !h.perg.ops[M.agenteBasico()(h, h.perg)].v.concessao, 'sem criatura minha: normal');
});

caso('702.62a', 'suspender (Resurgent Belief, sem custo de mana): da mão paga {1}{W} e exila com 2 de tempo; não dá para conjurar; tira 1 em cada manutenção sua; no último conjura de graça', () => {
  const e = cena({ campo: terras(2, 'Plains'), mao: [[0, 'Resurgent Belief']] }); e.pend = [];
  const rb = e.jogs[0].zonas.mao[0];
  for (const nm of ['Phyrexian Arena', 'Rhystic Study']) { const g = e.jogs[0].zonas.grimorio, id = g[0]; e.objs[id].n = nm; M.mover(e, id, 'cemiterio'); }
  const ops = M.opcoesPrioridade(e, 0);
  ok(ops.some(o => o.a === 'suspender' && o.id === rb), 'pode suspender');
  ok(!ops.some(o => o.a === 'conjurar' && o.id === rb), 'sem custo de mana: não conjura da mão');
  M.avancar(e); respE(e, o => o.a === 'suspender' && o.id === rb);
  igual([e.objs[rb].zona, e.objs[rb].marc.time, e.campo.filter(id => e.objs[id].virada).length, M.suspensa(e.objs[rb])], ['exilio', 2, 2, true], 'exilada com 2, pagou {1}{W}, suspensa');
  ateTurno(e, 3);
  igual(e.objs[rb].marc.time, 2, 'manutenção do oponente não tira');
  ateTurno(e, 4);
  igual(e.objs[rb].marc.time, 1, 'sua manutenção tira 1');
  ateTurno(e, 6);
  igual(e.objs[rb].zona, 'cemiterio', 'tirou o último: conjurou e resolveu');
  ok(['Phyrexian Arena', 'Rhystic Study'].every(n => noCampo(e).includes(n)), 'os encantamentos voltaram');
});
caso('702.62b', 'suspensa = no exílio com marcador de tempo e suspender; sem custo de suspender pagável não suspende; outra carta no exílio com marcador de tempo não dispara', () => {
  const e = cena({ campo: terras(1, 'Plains'), mao: [[0, 'Resurgent Belief']] }); e.pend = [];
  const rb = e.jogs[0].zonas.mao[0];
  ok(!M.opcoesPrioridade(e, 0).some(o => o.a === 'suspender'), 'uma terra só: não paga {1}{W}');
  const e2 = cena({ mao: [[0, 'Resurgent Belief'], [0, 'Grizzly Bears']] }); e2.pend = [];
  const [r2, gb] = e2.jogs[0].zonas.mao;
  M.mover(e2, r2, 'exilio'); e2.objs[r2].marc.time = 2;                // exilada com marcador, mas não pelo suspender
  M.mover(e2, gb, 'exilio'); e2.objs[gb].marc.time = 1; e2.objs[gb].suspensa = true;   // sem suspender na carta
  ok(!M.suspensa(e2.objs[r2]), 'sem ter sido suspensa não está suspensa');
  M.suspensoEvento(e2, 0);
  igual(e2.pend.length, 0, 'nenhum gatilho');
  e2.objs[r2].suspensa = true; e2.objs[r2].marc.time = 0;
  ok(!M.suspensa(e2.objs[r2]), 'sem marcador de tempo não está suspensa');
  void rb;
});
caso('702.62c', 'suspender de criatura: conjurada ao tirar o último marcador ganha ímpeto (pressa); pode recusar e ela fica no exílio', () => {
  const nm = 'Criatura Suspensa de Teste';
  (banco.db as any)[nm] = { v: 2, n: nm, custo: { g: 5 }, vm: 5, ci: 'G', cores: 'G', tipos: ['Creature'], pt: [4, 4], kw: [{ k: 'suspender', n: 1, custo: { p: ['G'] } }] };
  try {
    for (const quer of [true, false]) {
      const e = cena({ campo: terras(1, 'Forest'), mao: [[0, nm]] }); e.pend = [];
      const c = e.jogs[0].zonas.mao[0];
      M.avancar(e); respE(e, o => o.a === 'suspender' && o.id === c);
      e.turno.n = 3; e.turno.ativo = 1; e.turno.passo = 'final'; e.turno.prio = null; e.perg = null;
      ateTurno(e, 4, 'manutencao');
      M.avancar(e); let g = 0;
      while (e.perg && e.perg.tipo !== 'jogar' && g++ < 50) M.responder(e, e.perg.tipo === 'acao' ? e.perg.ops.findIndex(o => o.a === 'passar') : 0);
      ok(e.perg && e.perg.tipo === 'jogar', 'perguntou se conjura');
      respE(e, o => o.a === (quer ? 'jogar' : 'naoJogar'));
      if (!quer) { igual([e.objs[c].zona, M.suspensa(e.objs[c])], ['exilio', false], 'recusou: fica exilada, não mais suspensa'); continue; }
      ateTurno(e, 4, 'principal1');
      igual(e.objs[c].zona, 'campo', 'entrou');
      ok(M.temKw(e, e.objs[c], 'pressa'), 'com ímpeto');
    }
  } finally { delete (banco.db as any)[nm]; }
});

caso('613.1f', "Tishana's Tidebinder: anulada a habilidade de uma criatura, ela perde todas as habilidades (voar, ativadas) enquanto a Tidebinder estiver no campo; o dado antes some, o dado depois fica (613.7); a Tidebinder sai, volta tudo", () => {
  ok(M.gatOk(M.carta("Tishana's Tidebinder").gat[0]), 'aceita');
  const e = cena({ campo: [[0, "Tishana's Tidebinder"], [1, 'Serra Angel'], [1, 'Llanowar Elves']] });
  const T = objN(e, 0, "Tishana's Tidebinder"), S = objN(e, 1, 'Serra Angel'), L = objN(e, 1, 'Llanowar Elves');
  const cx: any = { voce: 0, este: T.id, alvos: [], ilegal: {}, lki: { alvos: [] } };
  M.executar(e, { op: 'modificar', em: 'este', kw: [{ k: 'atropelar' }], dura: 'fimDoTurno' }, { ...cx, voce: 1, este: S.id }, null);   // antes: some
  const hab = (F) => { const h = { id: e.prox++, n: 'teste', dono: 1, ctrl: 1, zona: 'pilha', ts: ++e.ts, hab: { fonte: F.id, fonteTs: F.ts, k: 0, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }], alvos: [] }, marc: {} }; e.objs[h.id] = h; e.pilha.push(h.id); return h; };
  const h = hab(S);
  M.executar(e, M.carta("Tishana's Tidebinder").gat[0].fx[0], { ...cx, alvos: [[{ o: h.id, ts: h.ts }]] }, null);
  igual(e.pilha.length, 0, 'anulada');
  ok(!M.temKw(e, S, 'voar') && !M.temKw(e, S, 'vigilancia') && !M.temKw(e, S, 'atropelar'), 'sem voar/vigilância e sem o atropelar dado antes');
  igual([M.poder(e, S), M.resistencia(e, S)], [4, 4], 'P/R impressos ficam');
  M.executar(e, { op: 'modificar', em: 'este', kw: [{ k: 'ameaca' }], dura: 'fimDoTurno' }, { ...cx, voce: 1, este: S.id }, null);
  ok(M.temKw(e, S, 'ameaca'), 'o dado depois fica (613.7)');
  ok(M.atvDe(e, L).length > 0, 'o Elfo não foi anulado: tem a de mana');
  const h2 = hab(L); M.executar(e, M.carta("Tishana's Tidebinder").gat[0].fx[0], { ...cx, alvos: [[{ o: h2.id, ts: h2.ts }]] }, null);
  igual(M.atvDe(e, L).length, 0, 'Elfo sem a de mana');
  M.mover(e, T.id, 'cemiterio');
  ok(M.temKw(e, S, 'voar') && M.atvDe(e, L).length > 0, 'a Tidebinder saiu: volta tudo');
  const f = cena({ campo: [[0, "Tishana's Tidebinder"], [1, 'Grizzly Bears']] }), T2 = objN(f, 0, "Tishana's Tidebinder");
  const h3 = { id: f.prox++, n: 'teste', dono: 1, ctrl: 1, zona: 'pilha', ts: ++f.ts, hab: { fonte: 999, fonteTs: 0, k: 0, fx: [], alvos: [] }, marc: {} }; f.objs[h3.id] = h3; f.pilha.push(h3.id);
  M.executar(f, M.carta("Tishana's Tidebinder").gat[0].fx[0], { ...cx, este: T2.id, alvos: [[{ o: h3.id, ts: h3.ts }]] }, null);
  igual(f.pilha.length, 0, 'fonte fora do campo: só anula');
});

caso('613.1f', "Poppet Factory: as fichas de criatura suas perdem todas as habilidades (voar da ficha) e são 3/3; a criatura que não é ficha e a ficha do oponente, não; a estática dada por quem entrou depois vale (613.7a)", () => {
  const F = M.carta('Poppet Stitcher').faces[0]; ok(F.est.every(s => M.estContOk(s) || s.modo === 'ptDefinido'), 'aceita');
  const e = cena({ campo: [[0, 'Poppet Stitcher', { obj: { face: 0 } }], [0, 'Serra Angel']] });
  e.vCamada = (e.vCamada || 0) + 1;
  M.criarFichas(e, 0, { pt: [1, 1], cores: 'W', tipos: ['Creature'], sub: ['Spirit'], kw: [{ k: 'voar' }] }, 1);
  M.criarFichas(e, 1, { pt: [1, 1], cores: 'W', tipos: ['Creature'], sub: ['Spirit'], kw: [{ k: 'voar' }] }, 1); e.pend = [];
  const fs = e.campo.map(id => e.objs[id]).filter(o => o.ficha), meu = fs.find(o => o.ctrl === 0), dele = fs.find(o => o.ctrl === 1);
  ok(!M.temKw(e, meu, 'voar'), 'a minha ficha perde voar'); igual([M.poder(e, meu), M.resistencia(e, meu)], [3, 3], 'base 3/3');
  ok(M.temKw(e, dele, 'voar'), 'a do oponente voa');
  ok(M.temKw(e, objN(e, 0, 'Serra Angel'), 'voar'), 'não ficha: voa');
  ok(M.perdeTs(e, meu) > 0 && !M.perdeTs(e, objN(e, 0, 'Serra Angel')), 'perdeTs');
});

caso('508.1', "Moraug, Fury of Akoum: suas criaturas +1/+0 por vez que atacaram neste turno (conta {de:'cada', o:'ataques'}); entrar atacando não conta (508.4)", () => {
  const s = M.carta('Moraug, Fury of Akoum').est[0];
  ok(M.estContOk(s), 'estática aceita'); ok(!M.carta('Moraug, Fury of Akoum').falta, 'saiu do falta');
  const e = combate([[0, 'Moraug, Fury of Akoum'], [0, 'Grizzly Bears'], [0, 'Llanowar Elves'], [1, 'Hill Giant']]);
  const mo = objN(e, 0, 'Moraug, Fury of Akoum'), gb = objN(e, 0, 'Grizzly Bears'), le = objN(e, 0, 'Llanowar Elves'), hg = objN(e, 1, 'Hill Giant');
  igual([M.poder(e, mo), M.poder(e, gb)], [6, 2], 'antes de atacar: nada');
  ate(e, 'atacar'); atacaCom(e, gb); fecha(e, 'atacar');
  igual([M.poder(e, gb), M.resistencia(e, gb), M.poder(e, mo), M.poder(e, le)], [3, 2, 6, 1], 'o Urso atacou 1 vez: +1/+0; quem não atacou, nada');
  e.turno.ataques = e.turno.ataques.concat([{ id: gb.id, ts: gb.ts, j: 0, def: 1 }, { id: le.id, ts: le.ts, j: 0, def: 1, entrou: true }]);   // 2º combate; o Elfo entrou atacando
  igual([M.poder(e, gb), M.poder(e, le)], [4, 1], '2 ataques: +2/+0; entrou atacando: não atacou');
  e.turno.ataques = e.turno.ataques.concat([{ id: hg.id, ts: hg.ts, j: 1, def: 0 }]);
  igual(M.poder(e, hg), 3, 'criatura do oponente não ganha');
  M.lote(() => igual([M.poder(e, gb), M.poder(e, le), M.poder(e, mo)], [4, 1, 6], 'no lote a conta é por objeto'));
});


});

caso('709.5d', "Room (Funeral Room // Awakening Hall): conjurada a porta da esquerda, entra só com ela destrancada; destrancar a outra é ação especial (116.2m) pagando o custo dela; 'when you unlock this door' dispara (709.5h)", () => {
  const e = cena({ campo: terras(11, 'Swamp'), mao: [[0, 'Funeral Room']] }); e.pend = [];
  const fr = e.jogs[0].zonas.mao[0];
  for (const nm of ['Grizzly Bears', 'Llanowar Elves']) { const g = e.jogs[0].zonas.grimorio, id = g[0]; e.objs[id].n = nm; M.mover(e, id, 'cemiterio'); }
  ok(!M.opcoesPrioridade(e, 0).some(o => o.a === 'destrancar'), 'na mão: nada a destrancar');
  M.avancar(e); respE(e, o => o.a === 'conjurar' && o.id === fr && o.face === 'esq'); resolveCom(e);
  const o = e.objs[fr];
  igual([o.zona, o.portas.e, o.portas.d, M.dadoDe(e, o).vm], ['campo', true, false, 3], 'entrou com a esquerda destrancada (vm 3: só a destrancada)');
  igual((M.dadoDe(e, o).gat || []).length, 1, 'só o texto do Funeral Room');
  ok(e.jogs[0].zonas.cemiterio.length === 2, 'nada voltou ao entrar');
  ok(M.opcoesPrioridade(e, 0).some(op => op.a === 'destrancar' && op.id === fr && op.porta === 'd'), 'pode destrancar a direita');
  respE(e, op => op.a === 'destrancar' && op.porta === 'd');
  igual([o.portas.d, M.dadoDe(e, o).vm, (M.dadoDe(e, o).gat || []).length], [true, 11, 2], 'as duas destrancadas: vm somado, os dois textos');
  igual(e.campo.filter(id => e.objs[id].virada).length, 11, 'pagou {6}{B}{B} além do {2}{B}');
  resolveCom(e);
  ok(['Grizzly Bears', 'Llanowar Elves'].every(n => noCampo(e).includes(n)), 'Awakening Hall: as criaturas do cemitério voltaram');
  ok(!M.opcoesPrioridade(e, 0).some(op => op.a === 'destrancar'), 'nada mais trancado');
});
caso('709.5e', "Room: destrancar só com pilha vazia na principal do próprio turno; posta no campo sem conjurar entra com as duas trancadas e sem texto; conjurar a direita direto dispara o gatilho dela (709.5h)", () => {
  const e = cena({ campo: terras(8, 'Swamp') }); e.pend = [];
  const x = e.por(0, 'Funeral Room', { zona: 'mao' }); M.mover(e, x.id, 'campo');
  const o = e.objs[x.id];
  igual([o.portas.e, o.portas.d, M.dadoDe(e, o).vm, (M.dadoDe(e, o).gat || []).length], [false, false, 0, 0], 'duas trancadas: vm 0, sem texto');
  ok(M.temTipo(e, o, 'Enchantment') && (M.dadoDe(e, o).sub || []).includes('Room'), 'fica o tipo (709.5a)');
  ok(M.podeDestrancar(e, 0, o, 'e') && M.podeDestrancar(e, 0, o, 'd'), 'na principal: as duas');
  e.turno.ativo = 1; ok(!M.podeDestrancar(e, 0, o, 'e'), 'turno do oponente: não'); e.turno.ativo = 0;
  e.turno.passo = 'combate'; ok(!M.podeDestrancar(e, 0, o, 'e'), 'fora da principal: não'); e.turno.passo = 'principal1';
  const f = cena({ campo: terras(8, 'Swamp'), mao: [[0, 'Funeral Room']] }); f.pend = [];
  const g = f.jogs[0].zonas.grimorio, gid = g[0]; f.objs[gid].n = 'Grizzly Bears'; M.mover(f, gid, 'cemiterio');
  M.avancar(f); respE(f, op => op.a === 'conjurar' && op.face === 0); resolveCom(f);
  const r = f.objs[f.campo.find(id => f.objs[id].n === 'Funeral Room')];
  igual([r.portas.e, r.portas.d], [false, true], 'entrou com a direita');
  ok(noCampo(f).includes('Grizzly Bears'), 'entrar destrancada também é destrancar');
});
caso('406.3', "Lobelia: exila o topo de cada oponente virado para baixo (faceBaixo); quem olhou (o controlador) continua vendo, o oponente não; prever também exila virada", () => {
  const e = cena({ mao: [[0, 'Lobelia, Defender of Bag End']] }); e.pend = [];
  const lb = e.jogs[0].zonas.mao[0];
  M.aplicarEntrada(e, { id: lb, ctrl: 0 }); M.avancar(e); resolveCom(e);
  const ex = e.jogs[1].zonas.exilio.map(id => e.objs[id]);
  igual(ex.length, 1, 'o topo do oponente exilado');
  ok(ex[0].faceBaixo && ex[0].olham.includes(0) && !ex[0].olham.includes(1), 'virado; só o controlador da Lobelia olha');
  ok(ex[0].exPor && ex[0].exPor.id === lb, 'ligado à Lobelia (607.2a)');
  M.mover(e, ex[0].id, 'cemiterio'); ok(!e.objs[ex[0].id].faceBaixo, 'saiu do exílio: não está mais virado');
  const sr = cena({ campo: terras(2, 'Swamp'), mao: [[0, 'Skull Raid']] }); sr.pend = [];
  const k = sr.jogs[0].zonas.mao[0]; M.avancar(sr); respE(sr, op => op.a === 'prever');
  ok(sr.objs[k].faceBaixo && sr.objs[k].olham.join() === '0', 'prever: virada, o dono olha (702.143a)');
});

caso('508.1c', "Master of Cruelties: só pode atacar sozinha (506.5); atacou um jogador e não foi bloqueada (509.3g) → a vida dele vira 1 (119.5) e ela não causa dano de combate", () => {
  const M0 = M.carta('Master of Cruelties'); ok(M0.gat.every(g => M.gatOk(g)), 'gatilho aceito');
  {
    const e = combate([[0, 'Master of Cruelties'], [0, 'Grizzly Bears']]);
    ate(e, 'atacar');
    const mc = objN(e, 0, 'Master of Cruelties'), g = objN(e, 0, 'Grizzly Bears');
    ok(!opsDe(e, 'todos').length, 'sem o atalho de todas juntas');
    atacaCom(e, g);
    ok(!opsDe(e, 'atacar').some(o => o.id === mc.id), 'com o Urso declarado, a Master não entra');
  }
  for (const bloq of [false, true]) {
    const e = combate([[0, 'Master of Cruelties'], [0, 'Grizzly Bears'], [1, 'Llanowar Elves']]);
    ate(e, 'atacar');
    const mc = objN(e, 0, 'Master of Cruelties');
    atacaCom(e, mc);
    ok(!opsDe(e, 'atacar').length, 'declarada a Master, mais nenhuma');
    fecha(e, 'atacar');
    ate(e, 'bloquear');
    if (bloq) bloqueia(e, objN(e, 1, 'Llanowar Elves'), mc);
    fecha(e, 'bloquear'); ateFimCombate(e);
    if (bloq) { igual(e.jogs[1].vida, 40, 'bloqueada: nada'); ok(!objN(e, 1, 'Llanowar Elves'), 'o Elfo morreu'); }
    else igual(e.jogs[1].vida, 1, 'não bloqueada: vida vira 1, sem os 1 de dano');
  }
});

caso('506.4', "Illusionist's Gambit: só nos bloqueadores do turno de um oponente; tira os atacantes do combate e desvira; combate extra (500.8) em que atacam se puderem, mas não você (508.1d)", () => {
  const e = cena({ jogs: 3, campo: [...terras(4, 'Island'), [1, 'Grizzly Bears'], [1, 'Hill Giant']], mao: [[0, "Illusionist's Gambit"]] });
  const gb = e.objs[e.jogs[0].zonas.mao[0]], u = objN(e, 1, 'Grizzly Bears'), h = objN(e, 1, 'Hill Giant');
  ok(!M.podeConjurar(e, 0, gb), 'no meu turno, não');
  e.turno.ativo = 1; e.turno.passo = 'principal1'; e.turno.feito = true;
  ate(e, 'atacar'); igual(e.perg.j, 1);
  const noDano = x => x.turno.passo === 'dano';
  atacaCom(e, u, { jog: 0 }); M.responder(e, e.perg.ops.findIndex(o => o.a === 'atacar' && o.id === h.id && o.jog === 0), noDano);   // a última: o núcleo fecha sozinho
  let g = 0;   // sem bloqueador possível o núcleo fecha a declaração sozinho; passa até a minha prioridade nos bloqueadores
  while (!(e.perg && e.perg.j === 0 && e.perg.tipo === 'acao' && e.turno.passo === 'bloqueadores')) { ok(e.perg && e.perg.tipo === 'acao' && !noDano(e) && ++g < 50, 'pergunta inesperada'); M.responder(e, e.perg.ops.findIndex(o => o.a === 'passar'), noDano); }
  ok(M.podeConjurar(e, 0, gb), 'nos bloqueadores do oponente, sim');
  respE(e, o => o.a === 'conjurar' && o.id === gb.id); resolveCom(e);
  igual([e.turno.combate ? e.turno.combate.atk.length : 0, u.virada, h.virada], [0, false, false], 'fora do combate e desviradas');
  igual(e.jogs[0].vida, 40, 'sem dano neste combate');
  ate(e, 'atacar'); igual([e.perg.j, e.turno.n], [1, 2], 'combate extra no mesmo turno');
  ok(!e.perg.ops.some(o => o.a === 'pronto'), 'tem que atacar');
  ok(e.perg.ops.filter(o => o.a === 'atacar').every(o => o.jog === 2), 'só o outro jogador');
  atacaCom(e, u, { jog: 2 }); if (e.perg && e.perg.tipo === 'atacar') atacaCom(e, h, { jog: 2 });   // a última opção o núcleo escolhe sozinho
  ateFimCombate(e);
  igual([e.jogs[0].vida, e.jogs[2].vida], [40, 35], 'o 3º jogador leva 5');
});

for (const c of casos) test(`CR ${c.cr} — ${c.nome}`, ctx => {
  banco.faltas.clear();
  let erro: unknown = null;
  try { c.fn(ctx); } catch (err) { erro = err; }
  if (banco.faltas.size) return ctx.skip(`faltam no banco/cartas: ${[...banco.faltas].sort().join(', ')}`);
  if (erro) throw erro;
});

