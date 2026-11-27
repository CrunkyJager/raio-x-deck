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
  ok(M.gatOk(db['Cena Emboscador'].gat[0]) && !M.gatOk({ ...db['Cena Emboscador'].gat[0], se: { palavra: 'solved' } }));
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
  igual(M.bate(e, gb, { tipoEmComum: { sub: ['Elf'] } }, { voce: 0, este: gb.id }), false);
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
caso('111.10d', 'Powerstone: {C} só para mágica de artefato; Map/Junk existem mas não ativam; nome fora da tabela fica só com o nome', () => {
  const p = cena({ mao: [[0, 'Sol Ring']] }); ficha(p, 0, 'Powerstone');
  ok(M.opcoesPrioridade(p, 0).some(o => o.a === 'conjurar' && p.objs[o.id].n === 'Sol Ring'), 'Sol Ring sim');
  const q = cena({ mao: [[0, 'Grizzly Bears']], campo: [[0, 'Forest']] }); ficha(q, 0, 'Powerstone');
  ok(!M.opcoesPrioridade(q, 0).some(o => o.a === 'conjurar'), 'criatura não-artefato não');
  const r = cena({ campo: [[0, 'Grizzly Bears'], [0, 'Wastes']] }); const mp = ficha(r, 0, 'Map'); ficha(r, 0, 'Junk');
  igual(M.dadoDe(r, mp).sub, ['Map']);
  ok(!M.opcoesPrioridade(r, 0).some(o => o.a === 'ativar'), 'explorar/jogar do exílio ainda não');
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

caso('207.2c', 'palavras de habilidade lidas do estado: metalcraft (Dispatch), coven e bênção da cidade; solved continua recusada', () => {
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
  ok(!M.condValorOk({ palavra: 'solved' }));
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
  ok(!M.estAltOk({ modo: 'custoAlternativo', afeta: 'este', pagar: { vida: 1 } }), 'pagar vida: ainda não');
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

caso('707.10', "copiar mágica: Zada copia o Bolt por criatura; Dualcaster copia o Bolt na pilha; a cópia some (não vai ao cemitério) e não é conjurada", () => {
  const e = cena({ campo: [[0, 'Zada, Hedron Grinder'], [0, 'Grizzly Bears'], [0, 'Grizzly Bears'], [0, 'Mountain']], mao: [[0, 'Lightning Bolt']] });
  e.cfg.log = true;
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
  const ag = M.agenteBasico();
  while (e.perg && e.perg.tipo !== 'acao') M.responder(e, ag(e, e.perg), x => x.turno.passo !== 'principal1');
  igual(e.jogs[1].vida, 31, 'Bolt + 2 cópias (2 outras criaturas)');
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
  igual(M.qtdDe(e, { conta: 'marcadoresSeus', de: 'experience' }, cx()), 3, '3 de experiência');
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
  igual(M.qtdDe(e, { conta: 'tipoMaisComum' }, cx()), 2, 'dois Elfos');
  const hg = e.campo.map(id => e.objs[id]).find(o => o.n === 'Hill Giant');
  igual(M.qtdDe(e, { conta: 'poderDoEvento' }, cx({ ev: 'zona', id: hg.id, para: 'campo' })), 3, 'Hill Giant 3/3');
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

// ---------- rodar ----------
// a carta que falta no banco é anotada pelo Proxy; o caso que pediu alguma pula (mesmo que tenha passado ou falhado
// por causa dela) e o aviso diz quais escrever. Sem falta, erro é erro.
for (const c of casos) test(`CR ${c.cr} — ${c.nome}`, ctx => {
  banco.faltas.clear();
  let erro: unknown = null;
  try { c.fn(ctx); } catch (err) { erro = err; }
  if (banco.faltas.size) return ctx.skip(`faltam no banco/cartas: ${[...banco.faltas].sort().join(', ')}`);
  if (erro) throw erro;
});
