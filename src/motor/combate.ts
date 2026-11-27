// src/motor/combate.ts (T43: migrado de motor2/combate.js) — fase de combate (CR 506–511): declarar atacantes (508) e bloqueadores (509), dano de combate
// (510) com primeiro ataque/golpe duplo em duas etapas (510.4), atropelar (702.19), toque mortífero (702.2), vínculo
// (702.15), voar/alcance (702.9/702.17), ameaça (702.110), vigilância (702.20), defensor (702.3), pressa (702.10),
// proteção de cor no bloqueio e no dano (702.16b/e) e dano de comandante (903.10a).
// As declarações são processos com perguntas (e.proc, pilha.js): nada muda no estado até o "pronto".
// Estado: e.turno.combate = { atk: [{id, ts, alvo:{jog}|{o}, def, bloq:[{id, ts}], bloqueado}], etapa, duas, deu1:{} }.
import { M } from './nucleo';

const kw = (e, o, k) => M.temKw(e, o, k);
// estática "este" com condição: condição que o núcleo não lê → restrição vale (não ataca/bloqueia),
// liberação não vale (pode ser bloqueada). Nunca dá vantagem sem ler a regra.
function estEste(e, o, modo, seNaoLe) {
  for (const s of M.dadoDe(e, o).est || []) {
    if (s.modo !== modo || s.afeta !== 'este') continue;
    if (!s.se) return true;
    try { if (M.condicao(e, s.se, { voce: o.ctrl, este: o.id })) return true; } catch (_) { if (seNaoLe) return true; }
  }
  for (const [F, s] of M.estDaEquipada(e, o, modo)) {                                       // dada por Equipamento/Aura presa a ela
    if (!s.se) return true;
    try { if (M.condicao(e, s.se, { voce: F.ctrl, este: F.id })) return true; } catch (_) { if (seNaoLe) return true; }
  }
  return M.tempNoObj(e, o, modo);                                                           // efeitoTemporario (Taunt from the Rampart, Bident)
}
// continua em combate? (CR 506.4: sai do campo ou muda de controle → sai do combate)
const emCombate = (e, r, ctrl?) => { const o = e.objs[r.id]; return o && o.zona === 'campo' && o.ts === r.ts && (ctrl === undefined || o.ctrl === ctrl); };
M.emCombate = emCombate;

// proteção (CR 702.16): cor da fonte bate com "de"? 'tudo'/'everything' pega qualquer fonte; o resto (texto que o
// conversor não separou) ainda não é lido — fica anotado em NOTAS.md.
function protegeDe(e, alvo, fonteDado) {
  const cores = fonteDado.cores || '';
  for (const x of M.kwDe(e, alvo)) {
    if (x.k !== 'protecao') continue;
    if (x.de === 'tudo' || x.de === 'everything') return true;
    if ((x.de === 'cadaCor' || x.de === 'each color') && cores) return true;
    if (x.de && x.de.length === 1 && cores.includes(x.de)) return true;
  }
  return false;
}
M.protegeDe = protegeDe;

// ---------- atacantes (CR 508.1) ----------
// "[criaturas que batem] não podem atacar", de outra permanente (est naoPodeAtacar com afeta filtro; seJog: o controlador
// da atacante fez algo no turno — Angelic Arbiter: quem conjurou mágica neste turno não ataca)
const proibidaDeAtacar = (e, o) => e.campo.some(id => {
  const F = e.objs[id];
  return (M.dadoDe(e, F).est || []).some(s => s.modo === 'naoPodeAtacar' && s.afeta && typeof s.afeta === 'object' && (!s.seJog || M.jogFez(e, o.ctrl, s.seJog))
    && bateF(e, o, s.afeta, { voce: F.ctrl, este: F.id }));
});
const bateF = (e, o, f, ctx) => { try { return M.bate(e, o, { ...f, zona: 'campo' }, ctx); } catch (_) { return false; } };
M.podeAtacarObj = (e, o, a) => podeAtacar(e, o, a);
function podeAtacar(e, o, a) {
  if (o.ctrl !== a || !M.temTipo(e, o, 'Creature') || o.virada) return false;           // 508.1a
  if (o.doente && !kw(e, o, 'pressa')) return false;                                       // 302.6
  if (kw(e, o, 'defensor') || estEste(e, o, 'naoPodeAtacar', true)) return false;          // 702.3b, 508.1c
  if (proibidaDeAtacar(e, o)) return false;
  return true;
}
// quem pode ser atacado: oponentes vivos e seus planeswalkers (506.2, 508.1b). Batalha precisa do protetor
// (CR 310.8), que só existe quando a batalha entra pelo motor (T18): por ora não é atacada.
// Custo de atacar (Ghostly Prison, 508.1g–h) ainda não é pago: quem tem essa estática não é atacado (anotado).
function alvosAtaque(e, a) {
  const cobra = new Set<any>();
  for (const id of e.campo) { const o = e.objs[id]; if ((M.dadoDe(e, o).est || []).some(s => s.modo === 'ataqueCusta')) cobra.add(o.ctrl); }
  const r: any[] = [];
  for (const j of M.vivos(e)) {
    if (j === a || cobra.has(j)) continue;
    r.push({ jog: j });
    for (const id of e.campo) { const o = e.objs[id]; if (o.ctrl === j && M.temTipo(e, o, 'Planeswalker')) r.push({ o: id }); }
  }
  return r;
}
const defDe = (e, alvo) => alvo.jog !== undefined ? alvo.jog : e.objs[alvo.o].ctrl;
// CR 508.4: permanente que entra atacando. Quem a controla escolhe um jogador ou planeswalker que ela poderia atacar
// (508.4a); primeiro o mais atacado agora (o agente básico pega o primeiro). Não foi declarada: não dispara "ataca".
// soDe: só aquele jogador ou um planeswalker/batalha dele ("attacking that player", Adeline e Ainok no repetirCada)
M.escolherAtacado = (e, j, ask, soDe = undefined) => {
  const C = e.turno.combate, alvos = alvosAtaque(e, j).filter(t => soDe === undefined || defDe(e, t) === soDe);
  if (!C || !alvos.length) return null;
  const n = t => C.atk.filter(r => t.jog !== undefined ? r.alvo.jog === t.jog : r.alvo.o === t.o).length;
  alvos.sort((a, b) => n(b) - n(a));
  const op = ask(j, 'atacado', alvos.map(t => ({ a: 'atacado', ...t })), {});
  return op.jog !== undefined ? { jog: op.jog } : { o: op.o };
};
M.porAtacando = (e, o, alvo) => {
  const C = e.turno.combate; if (!C || !o || o.zona !== 'campo' || !M.temTipo(e, o, 'Creature')) return;   // 506.3: só criatura ataca
  if (alvo.o !== undefined && (!e.objs[alvo.o] || e.objs[alvo.o].zona !== 'campo')) return;
  C.atk.push({ id: o.id, ts: o.ts, alvo, def: defDe(e, alvo), bloq: [] as any[], bloqueado: false });
  e.turno.ataques = (e.turno.ataques || []).concat([{ id: o.id, ts: o.ts, j: o.ctrl, def: defDe(e, alvo), entrou: true }]);
  M.log(e, o.n, 'entra atacando', alvo.jog !== undefined ? e.jogs[alvo.jog].nome : e.objs[alvo.o].n);
};

M.PROC.atacar = (e, P, ask) => {
  const a = P.j, alvos = alvosAtaque(e, a);
  const aptos = alvos.length ? M.lote(() => e.campo.filter(id => podeAtacar(e, e.objs[id], a))) : [];
  // declarações ficam no próprio processo (P.decl) e cada resposta fecha uma etapa: com centenas de fichas, refazer
  // tudo a cada resposta ficaria cúbico. Nada muda no estado até o "pronto".
  const decl = P.decl = P.decl || {};                                                     // id → alvo
  // incitada (701.38b): ataca quem não a incitou, se puder (só sobra o incitador se não houver outro alvo)
  const alvosDe = id => {
    const inc = M.tempDe(e, 'incitado').filter(({ s, t }) => M.tempAfeta(e, e.objs[id], s, t)).map(({ t }) => t.ctrl);
    if (!inc.length) return alvos;
    const fora = alvos.filter(t => !inc.includes(defDe(e, t)));
    return fora.length ? fora : alvos;
  };
  for (;;) {
    const livres = aptos.filter(id => !decl[id]);
    // 508.1d: quem "ataca se puder" tem que atacar (qualquer alvo cumpre); só então dá para fechar
    const devem = livres.filter(id => estEste(e, e.objs[id], 'deveAtacar', false));
    const ops = devem.length ? [] : [{ a: 'pronto' }];
    if (livres.length > 1) for (const t of alvos) ops.push({ a: 'todos', ...t });         // atalho: todas as livres no mesmo alvo
    for (const id of livres) for (const t of alvosDe(id)) ops.push({ a: 'atacar', id, ...t });
    if (!ops.length) break;
    const op = ask(a, 'atacar', ops, { declarados: Object.keys(decl).length });
    if (op.a === 'pronto') break;
    const t = op.jog !== undefined ? { jog: op.jog } : { o: op.o };
    if (op.a === 'todos') { for (const id of livres) if (alvosDe(id).some(x => x.jog === t.jog && x.o === t.o)) decl[id] = t; } else decl[op.id] = t;
    ask.etapa();
  }
  e.proc = null;
  const C = e.turno.combate = { atk: [] as any[], etapa: 0, duas: false, deu1: {} as any };
  for (const k of aptos) {
    const alvo = decl[k]; if (!alvo) continue;
    const id = k, o = e.objs[id];
    if (!kw(e, o, 'vigilancia')) M.virarObj(e, o);                                          // 508.1f
    C.atk.push({ id, ts: o.ts, alvo, def: defDe(e, alvo), bloq: [] as any[], bloqueado: false });
  }
  // quem atacou quem neste turno (contas ataquesNoTurno/atacantesEmVoce; o combate some no fim do combate)
  e.turno.ataques = (e.turno.ataques || []).concat(C.atk.map(r => ({ id: r.id, ts: r.ts, j: a, def: r.def, jog: r.alvo.jog })));
  for (const r of C.atk) M.evento(e, { ev: 'ataca', id: r.id, def: r.def });          // 508.3a
  if (C.atk.length) M.evento(e, { ev: 'atacantesDeclarados', j: a, n: C.atk.length });
  if (C.atk.length) M.log(e, e.jogs[a].nome, 'ataca com', C.atk.map(r => e.objs[r.id].n + '→' + (r.alvo.jog !== undefined ? e.jogs[r.alvo.jog].nome : e.objs[r.alvo.o].n)).join(', '));
};

// ---------- bloqueadores (CR 509.1), um defensor de cada vez na ordem do turno ----------
function podeBloquear(e, b, d) {
  return b.ctrl === d && M.temTipo(e, b, 'Creature') && !b.virada && !estEste(e, b, 'naoPodeBloquear', true);
}
function bloqueiaEste(e, b, at) {                                                          // 509.1b: restrições do atacante
  for (const s of M.dadoDe(e, at).est || []) {                                             // "não pode ser bloqueada (por X)"
    if (s.modo !== 'naoPodeSerBloqueada' || s.afeta !== 'este') continue;
    let vale = !s.se; if (s.se) try { vale = M.condicao(e, s.se, { voce: at.ctrl, este: at.id }); } catch (_) { vale = false; }
    if (vale && (!s.por || (M.filtroOk(s.por) && M.bate(e, b, s.por, { voce: at.ctrl, este: at.id })))) return false;
  }
  for (const [F, s] of M.estDaEquipada(e, at, 'naoPodeSerBloqueada')) {                   // Equipamento/Aura (Brotherhood Regalia)
    const c = { voce: F.ctrl, este: F.id };
    let vale = !s.se; if (s.se) try { vale = M.condicao(e, s.se, c); } catch (_) { vale = false; }
    if (vale && (!s.por || (M.filtroOk(s.por) && M.bate(e, b, s.por, c)))) return false;
  }
  if (M.tempNoObj(e, at, 'naoPodeSerBloqueada')) return false;                            // efeitoTemporario (Rogue's Passage)
  if (kw(e, at, 'voar') && !kw(e, b, 'voar') && !kw(e, b, 'alcance')) return false;      // 702.9b, 702.17b
  if (M.ehPortador(e, at) && M.poder(e, b) > M.poder(e, at)) return false;               // 701.54c: Portador não é bloqueado por poder maior
  // caminhada de terreno (702.14c): não pode ser bloqueada enquanto o defensor controla terreno daquele tipo
  for (const x of M.kwDe(e, at)) if (x.k === 'caminhadaTerreno' && typeof x.tipo === 'string'
    && M.objetosQue(e, { tipo: ['Land'], sub: [x.tipo], ctrl: 'voce', zona: 'campo' }, { voce: b.ctrl }).length) return false;
  if (protegeDe(e, at, M.dadoDe(e, b))) return false;                                     // 702.16b
  return true;
}
M.podeBloquear = podeBloquear; M.bloqueiaEste = bloqueiaEste;
// 509.1c: requisitos de bloqueio ("bloqueia neste turno se puder", "bloqueia aquela criatura se puder"). Fontes: est
// deveBloquear afeta 'este' da carta e as do modificar até o fim do turno (e.temp: atk = o atacante preso na resolução).
// Devolve null (sem requisito), 'qualquer' ou a lista de atacantes (índices em meus) que cumprem.
// Simplificação: atacante com ameaça não força (bloqueá-lo sozinho é ilegal e o máximo de requisitos pediria
// escolher outro bloqueador junto, 509.1c); o defensor ainda pode bloqueá-lo.
function requisitoBloqueio(e, b, meus, C) {
  let geral = estEste(e, b, 'deveBloquear', false);
  const atks: any[] = [];
  for (const t of e.temp || []) {
    if (!t.est || !M.tempTem(t, b)) continue;
    for (const s of t.est) if (s.modo === 'deveBloquear') { if (s.atk) atks.push(s.atk); else geral = true; }
  }
  if (!geral && !atks.length) return null;
  const pode = i => { const at = e.objs[C.atk[i].id]; return !kw(e, at, 'ameaca') && bloqueiaEste(e, b, at); };
  const esp = meus.filter(i => atks.some(a => a.id === C.atk[i].id && a.ts === C.atk[i].ts) && pode(i));
  if (esp.length) return esp;                                      // aquele atacante, se der; senão o "se puder" geral
  if (geral && meus.some(pode)) return 'qualquer';
  return null;
}
M.requisitoBloqueio = requisitoBloqueio;
M.PROC.bloquear = (e, P, ask) => {
  const d = P.j, C = e.turno.combate;
  const meus = C.atk.map((r, i) => i).filter(i => C.atk[i].def === d && emCombate(e, C.atk[i]));
  const cands = M.lote(() => e.campo.filter(id => podeBloquear(e, e.objs[id], d)));
  const bl = P.bl = P.bl || {};                                                           // bloqueador → índice do atacante
  for (;;) {
    const conta: any = {}; for (const k in bl) conta[bl[k]] = (conta[bl[k]] || 0) + 1;
    // 702.110b: ameaça precisa de dois ou mais; fechar só quando nenhuma está com um só
    const presa = meus.filter(i => conta[i] === 1 && kw(e, e.objs[C.atk[i].id], 'ameaca'));
    const devem: any[] = [], ops: any[] = [];
    M.lote(() => { for (const id of cands) {
      if (bl[id] !== undefined) continue;
      const rq = requisitoBloqueio(e, e.objs[id], meus, C);
      if (rq) devem.push(id);
      for (const i of meus) if ((!Array.isArray(rq) || rq.includes(i)) && bloqueiaEste(e, e.objs[id], e.objs[C.atk[i].id])) ops.push({ a: 'bloquear', id, atk: C.atk[i].id });
    } });
    if (!presa.length && !devem.length) ops.unshift({ a: 'pronto' });
    if (presa.length) for (const k in bl) if (presa.includes(bl[k])) ops.push({ a: 'desfazer', id: +k });
    const op = ask(d, 'bloquear', ops, { atacantes: meus.map(i => C.atk[i].id), bl: Object.keys(bl).map(k => [+k, C.atk[bl[k]].id]), devem });
    if (op.a === 'pronto') break;
    if (op.a === 'desfazer') delete bl[op.id];
    else bl[op.id] = meus.find(i => C.atk[i].id === op.atk);
    ask.etapa();
  }
  e.proc = null;
  const pares = cands.filter(id => bl[id] !== undefined).map(id => [id, bl[id]]);
  for (const [id, i] of pares) M.evento(e, { ev: 'bloqueia', id, atk: C.atk[i].id });   // 509.3
  for (const [id, i] of pares) { C.atk[i].bloq.push({ id, ts: e.objs[id].ts }); C.atk[i].bloqueado = true; }   // 509.1h
  C.bloqueou = C.bloqueou || {}; C.bloqueou[d] = true;
  if (pares.length) M.log(e, e.jogs[d].nome, 'bloqueia:', pares.map(([id, i]) => e.objs[id].n + '×' + e.objs[C.atk[i].id].n).join(', '));
};
// próximo defensor que ainda não declarou (ordem do turno a partir do ativo)
M.proximoDefensor = e => {
  const C = e.turno.combate, n = e.jogs.length;
  for (let k = 1; k < n; k++) {
    const d = (e.turno.ativo + k) % n;
    if (e.jogs[d].saiu || (C.bloqueou && C.bloqueou[d])) continue;
    if (C.atk.some(r => r.def === d && emCombate(e, r))) return d;
  }
  return -1;
};

// ---------- dano (CR 510) ----------
const temPrimeiro = (e, o) => kw(e, o, 'primeiroAtaque') || kw(e, o, 'golpeDuplo');
// quem causa dano nesta etapa (510.4): na 1ª só primeiro ataque/golpe duplo; na 2ª quem não causou na 1ª + golpe duplo
function causaAgora(e, o, C) {
  if (!C.duas) return true;
  if (C.etapa === 1) return temPrimeiro(e, o);
  return !C.deu1[o.id] || kw(e, o, 'golpeDuplo');
}
// início do passo de dano: decide se há duas etapas (510.4)
M.prepararDano = e => {
  const C = e.turno.combate;
  const todos: any[] = [];
  for (const r of C.atk) { if (emCombate(e, r)) todos.push(r.id); for (const b of r.bloq) if (emCombate(e, b)) todos.push(b.id); }
  C.duas = todos.some(id => temPrimeiro(e, e.objs[id]));
  C.etapa = C.duas ? 1 : 2;
};

// 510.1c–d: dano letal considerando o dano já marcado; toque mortífero → 1 basta (702.2c)
const letal = (e, b, fonte) => kw(e, fonte, 'toqueMortifero') ? 1 : Math.max(0, M.resistencia(e, b) - b.dano);

M.PROC.dano = (e, P, ask) => {
  const C = e.turno.combate, a = e.turno.ativo, golpes: any[] = [];   // {fonte, alvo:{o}|{jog}, q}
  for (const r of C.atk) {
    if (!emCombate(e, r, a)) continue;
    const at = e.objs[r.id];
    if (!causaAgora(e, at, C)) continue;
    let q = M.poder(e, at); if (q <= 0) continue;
    const alvoDef = r.alvo.jog !== undefined ? (e.jogs[r.alvo.jog].saiu ? null : { jog: r.alvo.jog })
      : (e.objs[r.alvo.o] && e.objs[r.alvo.o].zona === 'campo' ? { o: r.alvo.o } : null);
    if (!r.bloqueado) { if (alvoDef) golpes.push({ fonte: at, alvo: alvoDef, q }); continue; }   // 510.1a
    const vivos = r.bloq.filter(b => emCombate(e, b)).map(b => e.objs[b.id]);
    const pisa = kw(e, at, 'atropelar');
    if (!vivos.length) { if (pisa && alvoDef) golpes.push({ fonte: at, alvo: alvoDef, q }); continue; }   // 509.1h, 702.19e
    // ordem de quem leva o letal primeiro: pergunta ao atacante (510.1c; cada ordem dá uma divisão legal)
    const ordem: any[] = [], resta = vivos.slice();
    while (resta.length > 1) {
      const op = ask(a, 'ordemDano', resta.map(b => ({ a: 'primeiro', id: b.id })), { atacante: at.id });
      ordem.push(resta.splice(resta.findIndex(b => b.id === op.id), 1)[0]);
    }
    ordem.push(resta[0]);
    ordem.forEach((b, k) => {
      if (q <= 0) return;
      const ultimo = k === ordem.length - 1;
      const v = ultimo && !(pisa && alvoDef) ? q : Math.min(q, letal(e, b, at));
      if (v > 0) golpes.push({ fonte: at, alvo: { o: b.id }, q: v });
      q -= v;
    });
    if (q > 0 && pisa && alvoDef) golpes.push({ fonte: at, alvo: alvoDef, q });            // 702.19c: o resto no jogador
  }
  for (const r of C.atk) {                                                                  // 510.1d: bloqueador no atacante
    if (!r.bloqueado || !emCombate(e, r, a)) continue;
    for (const b of r.bloq) {
      if (!emCombate(e, b)) continue;
      const bo = e.objs[b.id];
      if (!causaAgora(e, bo, C)) continue;
      const q = M.poder(e, bo); if (q > 0) golpes.push({ fonte: bo, alvo: { o: r.id }, q });
    }
  }
  e.proc = null;
  aplicarGolpes(e, golpes);
  // 510.4: na 2ª etapa só causa quem não tinha primeiro ataque/golpe duplo quando a 1ª começou (+ golpe duplo)
  if (C.etapa === 1) for (const r of C.atk) for (const x of [r, ...r.bloq]) if (emCombate(e, x) && temPrimeiro(e, e.objs[x.id])) C.deu1[x.id] = true;
};

// 510.2: todo o dano da etapa ao mesmo tempo
function aplicarGolpes(e, golpes) {
  const vida: any = {};
  for (let g of golpes) {
    g = { ...g, q: M.substDano(e, g.q, { fonte: g.fonte, combate: true, ...(g.alvo.jog !== undefined ? { jog: g.alvo.jog } : { o: e.objs[g.alvo.o] }) }) };   // 615, 614.1a
    if (!(g.q > 0)) continue;
    const fd = M.dadoDe(e, g.fonte);
    if (g.alvo.jog !== undefined) {
      if (M.protegeJog(e, g.alvo.jog)) continue;                                           // 702.16j: prevenido
      const J = e.jogs[g.alvo.jog];
      M.danoJogador(e, g.alvo.jog, g.q, M.kwDe(e, g.fonte));                               // 120.3a (infectar: veneno, 702.90b); 119.7
      if (g.fonte.cmd) J.danoCmd[g.fonte.id] = (J.danoCmd[g.fonte.id] || 0) + g.q;          // 903.10a
      { const C = e.jogs[g.fonte.ctrl], s = M.dadoDe(e, g.fonte).sub || []; C.danoCombT = { t: e.turno.n, sub: [...new Set([...(C.danoCombT && C.danoCombT.t === e.turno.n ? C.danoCombT.sub : []), ...s])] }; }   // rondar (702.76): tipos de quem causou dano de combate a um jogador
    } else {
      const o = e.objs[g.alvo.o];
      if (protegeDe(e, o, fd)) continue;                                                   // 702.16e
      M.danoEm(e, o, g.q, { ...fd, kw: M.kwDe(e, g.fonte), o: g.fonte });   // toque mortífero dado por camada conta
    }
    M.evento(e, { ev: 'dano', fonte: g.fonte.id, combate: true, q: g.q, ...(g.alvo.jog !== undefined ? { jog: g.alvo.jog } : { o: g.alvo.o }) });   // 510.3a
    if (kw(e, g.fonte, 'vinculoVida')) vida[g.fonte.ctrl] = (vida[g.fonte.ctrl] || 0) + g.q;   // 702.15b
  }
  for (const j in vida) M.ganharVida(e, +j, vida[j]);
  if (golpes.length) M.log(e, 'dano de combate:', golpes.map(g => g.fonte.n + '→' + (g.alvo.jog !== undefined ? e.jogs[g.alvo.jog].nome : e.objs[g.alvo.o].n) + ' ' + g.q).join(', '));
}
// ---------- ligação com o turno (turno.js chama) ----------
M.acaoCombate = e => {
  const T = e.turno, a = T.ativo;
  switch (T.passo) {
    case 'atacantes': M.iniciarProc(e, { tp: 'atacar', j: a }); return;                    // 508.1
    case 'bloqueadores': {                                                                 // 509.1
      const d = M.proximoDefensor(e);
      if (d >= 0) { M.iniciarProc(e, { tp: 'bloquear', j: d }); T.feito = false; }        // volta aqui até todos declararem
      return;
    }
    case 'dano':
      if (!T.combate.etapa) M.prepararDano(e);
      M.iniciarProc(e, { tp: 'dano', j: a });
      return;
  }
};
// depois do passo: há atacantes? (508.8) Segunda etapa de dano? (510.4) Fim do combate limpa (511.3)
M.depoisDoPasso = (e, passo) => {
  const C = e.turno.combate;
  if (passo === 'atacantes' && !(C && C.atk.length)) return 'fimCombate';
  if (passo === 'dano' && C && C.etapa === 1) { C.etapa = 2; return 'dano'; }
  if (passo === 'fimCombate') e.turno.combate = null;
  return null;
};
