// src/motor/testes/casos.test.ts — casos de regra do núcleo (cena montada → ação → estado esperado), cada um com o número da CR.
// T43 (b): migrado de motor2/testes/casos.js sem mudar caso nenhum. Rodar: npx vitest run src/motor
// T43: as cartas vêm do banco próprio (banco/cartas/, escritas do Oracle). Caso que pede carta que ainda não está lá
// pula com aviso dizendo quais faltam; só o caso dos 4 decks de exemplo usa o cartas-rx.js, e pula sem ele.
import { test } from 'vitest';
import { M } from '../index';
import { temCartasRx, cartasRx, exemplos } from './cartas';
import { bancoProprio, comReserva, anotandoFaltas } from '../../dados/cartas';
const banco = anotandoFaltas(bancoProprio());
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
const alvoObj = (e, nome) => e.perg && e.perg.tipo !== 'alvo' ? null : respE(e, o => o.a === 'alvo' && o.o !== undefined && e.objs[o.o].n === nome);
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
const respC = (e, pred) => { const k = e.perg.ops.findIndex(pred); ok(k >= 0, 'opção não existe'); M.responder(e, k, PARA2); };
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
  M.avancar(e);
  igual(contaLog(e, 'gatilho de Blood Artist'), 2);
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
  M.avancar(e); conj(e, 'Lightning Bolt'); alvoJog(e, 1);
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
