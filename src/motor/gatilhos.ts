// src/motor/gatilhos.ts (T43: migrado de motor2/gatilhos.js) — habilidades desencadeadas (CR 603): eventos do núcleo, disparo na hora do evento (603.2),
// olhar para trás de quem sai do campo (603.10a), condição de intervenção (603.4), pôr na pilha em APNAP quando
// alguém receberia prioridade (603.3b), alvo escolhido ao pôr; sem alvo legal a habilidade sai (603.3d).
// Gatilho com campo/efeito/filtro que o núcleo não lê NÃO dispara (nada joga errado em silêncio).
import { M } from './nucleo';

const EV_OK = new Set(['entra', 'morre', 'sai', 'vaiCemiterio', 'ataca', 'atacantesDeclarados', 'reflexo', 'bloqueia', 'dano',
  'conjura', 'fase', 'compra', 'ganhaVida', 'perdeVida', 'alvoDe', 'descarta', 'capitulo', 'nivel', 'sala', 'completaMasmorra', 'tomaIniciativa', 'danoUmaVez', 'cicla', 'desvira', 'jogaTerreno', 'prolifera', 'marcadorPosto', 'sacrificado', 'saiCemiterio', 'moe', 'fichaCriada', 'vira', 'ficaMonstruosa']);
const CAMPOS_OK = new Set(['comManaDe', 'ev', 'fx', 'quem', 'alvos', 'se', 'zonaAtiva', 'jog', 'passo', 'deQuem', 'aJogador', 'combate', 'por', 'grupo', 'n', 'talvez', 'limite', 'aOponente', 'de', 'naoDe', 'aJogadorOuPw', 'marc', 'recebe']);
const SAIDA = new Set(['morre', 'sai', 'vaiCemiterio', 'sacrificado']);   // sacrificado sai do campo: olha para trás (603.10a)
const LACO = 500;
const memoOk = new WeakMap();
// grupo ("uma ou mais"): só no descarte por ora
M.gatOk = g => {
  if (memoOk.has(g)) return memoOk.get(g);
  if (g.ev === 'viraParaMana') { const v = M.gatManaOk(g); memoOk.set(g, v); return v; }   // habilidade de mana desencadeada: mana.ts (605.1b)
  let ok = EV_OK.has(g.ev) && (g.ev === 'capitulo' || g.ev === 'nivel' ? Number.isInteger(g.n) && g.n > 0 : g.n === undefined) && Object.keys(g).every(k => CAMPOS_OK.has(k)) && (!g.grupo || g.ev === 'descarta' || g.ev === 'moe' || g.ev === 'entra' || g.ev === 'fichaCriada' || g.ev === 'vira' || g.ev === 'marcadorPosto' || g.ev === 'saiCemiterio' || SAIDA.has(g.ev)) && (!g.marc || g.ev === 'marcadorPosto') && ((!g.de && !g.naoDe) || g.ev === 'vaiCemiterio' || g.ev === 'entra' || g.ev === 'conjura' || g.ev === 'jogaTerreno') && (!g.aOponente || g.ev === 'dano') && (!g.aJogadorOuPw || g.ev === 'dano' || g.ev === 'danoUmaVez') && (!g.limite || g.limite === 'umaPorTurno') && M.fxSuportado(g.fx)   // modal: o modo é escolhido ao pôr na pilha (603.3c, PROC.gatilhos)
    && (g.alvos || []).every(M.alvoSuportado) && M.alvosUsados(g.fx).every(i => (g.alvos || [])[i])   // {alvo:N} sem o alvo N declarado: não joga
    && (!g.quem || M.filtroOk(g.quem)) && (!g.por || M.filtroOk(g.por)) && (!g.recebe || (g.ev === 'dano' && M.filtroOk(g.recebe)));
  if (ok && g.se) ok = Object.keys(g.se).every(k => ['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta', 'conjuradaCom', 'palavra', 'objBate', 'temIniciativa', 'monarca', 'completouMasmorra', 'desceu', 'maisTerrenosOponente', 'modoEscolhido', 'primeiroCombate', 'fasePrincipal'].includes(k)) && M.condValorOk(g.se) && (!g.se.objBate || M.seOk(g.se));
  memoOk.set(g, ok);
  return ok;
};
const relJog = (r, j, ctrl) => r === 'voce' ? j === ctrl : r === 'oponente' ? j !== ctrl : true;
const bate = (e, o, f, ctx) => { try { return M.bate(e, o, f, ctx); } catch (_) { return false; } };
const cond = (e, se, ctx) => { if (!se) return true; try { return M.condicao(e, se, ctx); } catch (_) { return false; } };

// o gatilho g da fonte F bate no evento ev?
function bateEv(e, g, ev, F) {
  const ctx = { voce: F.ctrl, este: F.id }, q = o => !g.quem || (o && bate(e, o, g.quem, ctx));
  switch (g.ev) {
    case 'entra': return ev.ev === 'zona' && ev.para === 'campo' && (!g.de || ev.de === g.de) && (!g.naoDe || ev.de !== g.naoDe) && q(e.objs[ev.id]);   // de: "enters from a graveyard" (River Kelpie, Kotis)
    case 'ficaMonstruosa': return ev.ev === 'ficaMonstruosa' && !!e.objs[ev.id] && e.objs[ev.id].ts === ev.ts && q(e.objs[ev.id]);   // 701.37b
    case 'vira': return ev.ev === 'vira' && !!e.objs[ev.id] && e.objs[ev.id].ts === ev.ts && q(e.objs[ev.id]);   // 701.26a
    case 'fichaCriada': return ev.ev === 'fichaCriada' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && !!e.objs[ev.id] && e.objs[ev.id].ts === ev.ts && q(e.objs[ev.id]);   // 111.2: quem cria = ev.j
    case 'morre': return ev.ev === 'zona' && ev.de === 'campo' && ev.para === 'cemiterio' && M.temTipo(e, ev.snap, 'Creature') && q(ev.snap);   // 700.4
    case 'sai': return ev.ev === 'zona' && ev.de === 'campo' && q(ev.snap);
    case 'saiCemiterio': return ev.ev === 'zona' && ev.de === 'cemiterio' && q(ev.snapCem || e.objs[ev.id]);   // "one or more cards leave your graveyard" (Syr Konrad, Teval)
    case 'sacrificado': return ev.ev === 'zona' && ev.de === 'campo' && !!ev.sac && q(ev.snap);   // 701.21: quem sacrifica é o controlador (snap.ctrl)
    case 'vaiCemiterio': return ev.ev === 'zona' && ev.para === 'cemiterio' && (!g.de || ev.de === g.de) && (!g.naoDe || ev.de !== g.naoDe) && q(ev.snap || e.objs[ev.id]);
    case 'ataca': return ev.ev === 'ataca' && q(e.objs[ev.id]);
    case 'atacantesDeclarados': return ev.ev === 'atacantesDeclarados' && !g.quem && (!g.jog || relJog(g.jog, ev.j, F.ctrl));
    case 'bloqueia': return ev.ev === 'bloqueia' && q(e.objs[ev.id]);
    case 'dano': return ev.ev === 'dano' && (!g.combate || ev.combate) && (!g.recebe || (ev.o !== undefined && !!e.objs[ev.o] && bate(e, e.objs[ev.o], g.recebe, ctx))) && (!g.aJogador || ev.jog !== undefined) && (!g.aJogadorOuPw || ev.jog !== undefined || (ev.o !== undefined && !!e.objs[ev.o] && M.temTipo(e, e.objs[ev.o], 'Planeswalker'))) && (!g.aOponente || (ev.jog !== undefined && ev.jog !== F.ctrl)) && q(ev.snap || e.objs[ev.fonte]);
    // "uma ou mais … causam dano de combate a um jogador" (Prosperous Thief): o mesmo teste do dano, uma vez só por lote (abaixo)
    // recebe: quem levou o dano é um objeto que bate (enrage: {este: true}; Wrathful Raptors: Dinossauro seu)
    case 'danoUmaVez': return bateEv(e, { ...g, ev: 'dano' }, ev, F);
    case 'conjura': return ev.ev === 'conjura' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && (!g.de || ev.de === g.de) && (!g.naoDe || ev.de !== g.naoDe) && (!g.comManaDe || (ev.fontes || []).includes(F.id)) && q(e.objs[ev.id]);   // comManaDe 'este': a mana desta pagou (Tecutlan; só a do plano de pagamento, não a que já estava na reserva)   // de/naoDe: de onde foi conjurada
    case 'cicla': return ev.ev === 'cicla' && relJog(g.jog || 'voce', ev.j, F.ctrl) && q(e.objs[ev.id]);          // 702.29
    case 'desvira': return ev.ev === 'desvira' && q(e.objs[ev.id]);                                                 // 701.26b
    case 'jogaTerreno': return ev.ev === 'jogaTerreno' && relJog(g.jog || 'voce', ev.j, F.ctrl) && (!g.de || ev.de === g.de) && (!g.naoDe || ev.de !== g.naoDe) && q(e.objs[ev.id]);
    case 'marcadorPosto': return ev.ev === 'marcadorPosto' && (!g.marc || g.marc === ev.t) && (!g.jog || relJog(g.jog, ev.j, F.ctrl))   // jog: quem pôs ("whenever you put", All Will Be One)
      && (ev.jog !== undefined ? !g.quem : !!e.objs[ev.id] && e.objs[ev.id].ts === ev.ts && q(e.objs[ev.id]));   // 122.6: o evento já é o lote (grupo); em jogador (122.1) só sem 'quem' ("on a permanent or player")
    case 'prolifera': return ev.ev === 'prolifera' && relJog(g.jog || 'voce', ev.j, F.ctrl);                       // 701.34
    case 'capitulo': return ev.ev === 'capitulo' && ev.id === F.id && ev.ts === F.ts && ev.de < g.n && ev.para >= g.n;   // CR 714.2b
    // masmorras.ts: entrar numa sala (309.4c), completar (309.7), tomar a iniciativa (727.2); jog: de quem (padrão: você)
    case 'sala': case 'completaMasmorra': case 'tomaIniciativa': return ev.ev === g.ev && relJog(g.jog || 'voce', ev.j, F.ctrl);
    case 'nivel': return ev.ev === 'nivel' && ev.id === F.id && ev.ts === F.ts && ev.n === g.n;   // CR 716.2b: "quando esta Classe vira nível N"
    case 'fase': return ev.ev === 'fase' && ev.passo === g.passo && relJog(g.deQuem || 'voce', ev.ativo, F.ctrl);
    case 'compra': return ev.ev === 'compra' && (!g.quem || relJog(g.quem.ctrl || 'qualquer', ev.j, F.ctrl)) && (!g.jog || relJog(g.jog, ev.j, F.ctrl));
    case 'descarta': return g.grupo                    // CR 701.9: uma vez por carta, ou uma vez pelo lote ("one or more")
      ? ev.ev === 'descartaGrupo' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && (!g.quem || ev.ids.some(id => bate(e, e.objs[id], g.quem, ctx)))
      : ev.ev === 'descarta' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && q(e.objs[ev.id]);
    case 'moe': return g.grupo                         // CR 701.13: "whenever a player mills a nonland card" (uma por carta) ou "one or more" (o lote)
      ? ev.ev === 'moeGrupo' && ev.ids.some(id => relJog(g.jog || 'qualquer', e.objs[id].dono, F.ctrl) && q(e.objs[id]))
      : ev.ev === 'moe' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && q(e.objs[ev.id]);
    case 'ganhaVida': case 'perdeVida': return ev.ev === g.ev && relJog(g.jog || 'voce', ev.j, F.ctrl);   // 119.9/119.10: um disparo por evento
    case 'alvoDe': {                                   // CR 115.1, 603.2: "becomes the target of" (ao conjurar/ativar/pôr na pilha)
      if (ev.ev !== 'alvoDe' || !q(e.objs[ev.id])) return false;
      if (!g.por) return true;
      const P = e.objs[ev.por];                        // habilidade na pilha não tem tipo (CR 113.1): filtro de tipo não pega
      return !!P && !(P.hab && g.por.tipo) && bate(e, P, g.por, ctx);
    }
  }
  return false;
}
// "é posto num cemitério de qualquer lugar" (Kozilek, Blightsteel, Ulamog): vindo da mão ou do grimório a carta já
// está no cemitério e o gatilho é dela lá; vindo do campo vale o olhar para trás (603.10a) e o cemitério não conta de novo
const deQualquerLugar = g => g.ev === 'vaiCemiterio' && !!g.quem && g.quem.este === true && !g.de && !g.zonaAtiva;
const zonas = g => g.zonaAtiva || (deQualquerLugar(g) ? ['campo', 'cemiterio'] : ['campo']);

// ---------- gatilho atrasado (CR 603.7) ----------
// e.atras = [{g, ctrl, fonte, n, t (turno em que nasceu), lki, mem, ts}]. g é um gatilho comum com nesteTurno/proximoTurno.
const memoAtr = new WeakMap();
M.atrasadoOk = g => {
  if (!g || typeof g !== 'object') return false;
  if (memoAtr.has(g)) return memoAtr.get(g);
  const { nesteTurno, proximoTurno, ...resto } = g;
  // {alvo:N} dentro do atrasado = o alvo N de quem o criou (Alora: "devolva aquela criatura"), herdado no mem; o ts diz se ainda é o mesmo (400.7)
  const us = M.alvosUsados(g.fx), comAlvos = us.length ? { ...resto, alvos: Array.from({ length: Math.max(...us) + 1 }, () => ({ f: {} })) } : resto;
  const ok = ['fase', 'conjura'].includes(g.ev) && !g.alvos && !g.zonaAtiva && M.gatOk(comAlvos);   // "anterior" = o que o efeito antes dele moveu (Hellkite Courser), guardado no mem com o ts
  memoAtr.set(g, ok);
  return ok;
};
function atrasados(e, ev) {
  if (!e.atras || !e.atras.length) return;
  for (const A of e.atras) {
    if (A.feito) continue;
    if (A.g.proximoTurno && e.turno.n <= A.t) continue;
    if (A.g.nesteTurno && e.turno.n !== A.t) { A.feito = true; continue; }
    const F = { id: A.fonte, ctrl: A.ctrl, ts: A.lki ? A.lki.ts : -1 };
    if (!bateEv(e, A.g, ev, F) || !cond(e, A.g.se, { voce: A.ctrl, este: A.fonte })) continue;
    A.feito = true;                                                                       // 603.7c: uma vez só
    e.pend.push({ fonte: A.fonte, ts: F.ts, ctrl: A.ctrl, k: 'atrasado', g: A.g, n: A.n, face: null, ficha: null, lki: A.lki, mem: A.mem, ev: { ...ev, snap: undefined } });
  }
  e.atras = e.atras.filter(A => !A.feito);
}
// gatilho de emblema (114.4) e de efeito temporário (603.7a: "neste turno, sempre que…"): vive em e.efTemp, sem objeto
// no campo; dispara toda vez (não é o atrasado de uma vez só) enquanto o efeito durar. A fonte é o emblema: fonte -1.
function temporarios(e, ev) {
  if (!e.efTemp || !e.efTemp.length) return;
  for (const t of e.efTemp) {
    if (!t.gat || !t.gat.length) continue;
    const F = { id: -1, ctrl: t.ctrl, ts: t.ts };
    for (const g of t.gat) {
      if (!bateEv(e, g, ev, F) || !cond(e, g.se, { voce: t.ctrl, este: -1, ev })) continue;
      e.pend.push({ fonte: -1, ts: t.ts, ctrl: t.ctrl, k: 'atrasado', g, n: t.n, face: null, ficha: null, lki: null, ev: { ...ev, snap: undefined } });
    }
  }
}
// resguardo (CR 702.21): quando vira alvo de mágica/habilidade de um oponente, anula a menos que ele pague. Cada
// instância dispara à parte (702.21b); a dada pelas camadas também (kwDe). custo = mana; pagar = vida ou sacrificar.
const custoResg = k => k.custo ? { mana: k.custo } : k.pagar && Object.keys(k.pagar).length === 1 && (k.pagar.vida || k.pagar.sacrificar) ? k.pagar : null;
function resguardo(e, ev) {
  const o = e.objs[ev.id], P = e.objs[ev.por];
  if (!o || o.zona !== 'campo' || !P || P.zona !== 'pilha') return;
  const quem = P.pil ? P.pil.ctrl : P.ctrl;
  if (quem === o.ctrl) return;
  for (const k of M.kwDe(e, o)) {
    if (k.k !== 'resguardo') continue;
    const custo = custoResg(k); if (!custo) continue;
    e.pend.push({ fonte: o.id, ts: o.ts, ctrl: o.ctrl, k: 'resguardo', g: { ev: 'alvoDe', fx: [{ op: 'resguardo', custo }] }, n: o.n, face: o.face ?? null, ficha: o.ficha || null, lki: M.lkiDe(e, o), ev: { ...ev, j: quem } });
  }
}
M.custoResg = custoResg;
// proeza (CR 702.108a): "sempre que você conjura uma mágica que não é de criatura, esta recebe +1/+1 até o fim do
// turno". Cada instância dispara à parte (702.108b). Lida no dado da carta e nas palavras-chave dadas (kwDe), só de
// quem tem proeza no dado base ou no índice de quem recebe habilidade: varrer kwDe do campo a cada mágica custaria O(campo).
const PROEZA = { ev: 'conjura', fx: [{ op: 'modificar', em: 'este', p: 1, r: 1, dura: 'fimDoTurno' }] };
function proeza(e, ev) {
  const sp = e.objs[ev.id]; if (!sp || M.temTipo(e, sp, 'Creature')) return;
  for (const id of e.campo) {
    const o = e.objs[id]; if (o.ctrl !== ev.j) continue;
    const base = M.dadoBase(e, o).kw; if (!(base && base.some(k => k.k === 'proeza')) && !M.temHabil(e)) continue;
    const n = M.kwDe(e, o).filter(k => k.k === 'proeza').length;
    for (let i = 0; i < n; i++) e.pend.push({ fonte: o.id, ts: o.ts, ctrl: o.ctrl, k: 'proeza', g: PROEZA, n: o.n, face: o.face ?? null, ficha: o.ficha || null, lki: M.lkiDe(e, o), ev: { ...ev, snap: undefined } });
  }
}
M.fimAtrasados = e => { if (e.atras && e.atras.length) e.atras = e.atras.filter(A => !(A.g.nesteTurno && A.t !== e.turno.n)); };

// ---------- dobraGatilho (CR 603.2d): "dispara uma vez a mais" ----------
// est {modo:'dobraGatilho', afeta: filtro da FONTE do gatilho, evs?: só esses eventos, causa?: filtro do objeto que
// causa o evento}. Cada estática que vale soma 1 (duas Harmonic Prodigy = 3 vezes). Afeta só gatilho de permanente.
const causasDe = (e, ev) => {
  if (ev.ev === 'atacantesDeclarados') return ((e.turno.combate || {}).atk || []).map(r => e.objs[r.id]).filter(Boolean);
  const o = ev.snap || e.objs[ev.id];
  return o ? [o] : [];
};
function extras(e, F, g, ev) {
  let n = 0;
  for (const id of M.indiceCampo(e).est) {                                               // só quem tem estática
    const S = e.objs[id];
    for (const s of M.dadoDe(e, S).est || []) {
      if (s.modo !== 'dobraGatilho' || !s.afeta || typeof s.afeta !== 'object') continue;
      if (s.evs && !s.evs.includes(g.ev)) continue;
      const ctx = { voce: S.ctrl, este: S.id };
      const Fz = F.zona === 'campo' ? F : { ...F, zona: 'campo' };   // olhou para trás (603.10a): era permanente
      if (!M.filtroOk(s.afeta) || !bate(e, Fz, s.afeta, ctx)) continue;
      if (s.causa && (!M.filtroOk(s.causa) || !causasDe(e, ev).some(c => bate(e, c, s.causa, ctx)))) continue;
      n++;
    }
  }
  return n;
}
// fabricar N (CR 702.123a): gatilho de entrar implícito da palavra-chave
const GAT_PERSISTIR = { ev: 'morre', fx: [{ op: 'persistir' }] };
const GAT_MIRIADE = { ev: 'ataca', quem: { este: true }, fx: [{ op: 'miriade' }] };
const ESPIRITO = { pt: [1, 1], cores: 'WB', tipos: ['Creature'], sub: ['Spirit'], kw: [{ k: 'voar' }] };
// esconderijo N (CR 702.75a): idem, um gatilho por instância (702.75b não junta)
const KW_ENTRA = new WeakMap<object, any[]>();
const kwEntraDe = d => {
  let l = KW_ENTRA.get(d);
  if (!l) KW_ENTRA.set(d, (l = (d.kw || []).flatMap(x => x.k === 'fabricar' ? [{ ev: 'entra', quem: { este: true }, fx: [{ op: 'fabricar', qtd: x.n || 1 }], _k: 'fabricar' }]
    : x.k === 'esconderijo' && Number.isInteger(x.n) ? [{ ev: 'entra', quem: { este: true }, fx: [{ op: 'esconder', qtd: x.n }], _k: 'esconderijo' }] : [])));
  return l as any[];
};
// p.face: a face que estava para cima quando disparou (dupla face transformada tem outros gatilhos, 712.6d)
M.gatilhoDe = (p) => p.g || (p.ficha || M.dadoFace(M.carta(p.n), p.face)).gat[p.k];

// ---------- evento: dispara na hora (603.2) ----------
// quem tem gatilho que vale no cemitério: candidatos guardados por id (todo objeto nasce com e.prox++ e o dado de
// fora do campo é sempre a frente, que não muda); a cada evento só os novos ids são olhados. Varrer os cemitérios a
// cada evento era O(n²) numa limpeza de milhares de fichas (elas ficam no cemitério até as ABE).
const CEM = new WeakMap<any, { p: number; ids: number[] }>();
const temGatCem = d => !!d.gat && d.gat.some(g => zonas(g).includes('cemiterio'));
function noCemiterio(e) {
  let C = CEM.get(e);
  if (!C) { C = { p: 0, ids: [] }; CEM.set(e, C); }
  if (C.p !== e.prox) {
    const ini = C.p > e.prox ? 0 : C.p; if (!ini) C.ids = [];
    for (let id = ini; id < e.prox; id++) { const o = e.objs[id]; if (o && !o.hab && temGatCem(o.ficha || M.carta(o.n))) C.ids.push(id); }
    C.p = e.prox;
  }
  const r: any[] = [];
  for (let j = 0; j < e.jogs.length; j++) {                                            // na ordem de antes: jogador, posição
    const cem = e.jogs[j].zonas.cemiterio;
    const l = C.ids.map(id => e.objs[id]).filter(o => o && o.zona === 'cemiterio' && o.dono === j && temGatCem(M.dadoDe(e, o)));
    if (l.length > 1) l.sort((a, b) => cem.indexOf(a.id) - cem.indexOf(b.id));
    r.push(...l);
  }
  return r;
}
// lote (quem saiu desde o último pôr gatilhos): quem tem gatilho, quem dá habilidade (= M.loteHabil) e o conjunto,
// mantidos a cada saída — varrer o lote inteiro a cada morte era O(n²) numa limpeza de milhares de fichas
const LOTE = new WeakMap<any[], { n: number; gat: any[]; hab: any[]; set: Set<any> }>();
const daHabil = (e, S) => (M.dadoDe(e, S).est || []).some(s => s.modo === 'continuo' && s.habil);
function loteInfo(e, lote) {
  let I = LOTE.get(lote);
  if (!I || I.n > lote.length) { I = { n: 0, gat: [], hab: [], set: new Set() }; LOTE.set(lote, I); }
  for (; I.n < lote.length; I.n++) {
    const S = lote[I.n]; I.set.add(S);
    if (M.dadoDe(e, S).gat || (S.ganhos && (S.ganhos.gat || S.ganhos.gatS)) || M.ehPortador(e, S)) I.gat.push(S);
    if (daHabil(e, S)) I.hab.push(S);
  }
  return I;
}
M.evento = (e, ev) => {
  if (!e.pend || (e.turno.passo === 'mulligan')) return;
  const saida = ev.ev === 'zona' && ev.de === 'campo';
  if (saida) (e.lote = e.lote || []).push(ev.snap);
  const fontes: any[] = [];
  const hab = M.temHabil(e);                                                            // caminho comum: sem habilidade dada
  if (hab) { for (const id of e.campo) { const o = e.objs[id]; if (M.gatDe(e, o).length) fontes.push(o); } }
  else for (const id of M.indiceCampo(e).gat) fontes.push(e.objs[id]);                  // índice: só quem tem gatilho
  const L = saida ? loteInfo(e, e.lote) : null, lhab = L && L.hab.length ? L.hab : undefined;
  if (L) {                                                                              // 603.10a: olha para trás (habilidade dada também)
    if (hab || lhab) { for (const s of e.lote) if (M.gatDe(e, s, lhab).length) fontes.push(s); }
    else for (const s of L.gat) fontes.push(s);
  }
  if (ev.ev === 'conjura' && e.objs[ev.id]) fontes.push(e.objs[ev.id]);                 // "quando você conjura este"
  for (const o of noCemiterio(e)) fontes.push(o);                                       // gatilhos que valem no cemitério
  for (const F of fontes) {
    const lki = !!L && L.set.has(F), gs = M.gatDe(e, F, lki ? lhab : undefined), dgat = M.dadoDe(e, F).gat || [], nb = dgat.length;
    // o pendente guarda só o índice quando o gatilho é o impresso (M.gatilhoDe relê a carta); o dado mudado no campo
    // (nível de Classe, animar, tipo dado) leva o texto, senão o índice apontaria para outra habilidade
    const mudado = dgat !== ((F.ficha || M.dadoFace(M.carta(F.n), F.face ?? null)).gat || dgat);
    for (let k = 0; k < gs.length; k++) {
      const g = gs[k];
      if (!M.gatOk(g)) continue;
      const onde = lki ? 'campo' : F.zona;
      if (lki && !SAIDA.has(g.ev)) continue;
      if (!zonas(g).includes(onde) && !(onde === 'pilha' && g.ev === 'conjura' && g.quem && g.quem.este)) continue;
      if (onde === 'cemiterio' && deQualquerLugar(g) && (ev.de === 'campo' || ev.id !== F.id)) continue;
      if (onde === 'pilha' && !(g.quem && g.quem.este)) continue;
      if (!bateEv(e, g, ev, F)) continue;
      if (!cond(e, g.se, { voce: F.ctrl, este: F.id, ev })) continue;                      // 603.4 (com o evento: objBate doEvento lê quem morreu)
      // "uma ou mais entram" (grupo): uma vez pelo que entra junto. Simplificação: o lote = o que ainda não foi para a
      // pilha (e.pend esvazia antes de cada prioridade), então duas entradas na mesma resolução contam como uma.
      if (g.grupo && (g.ev === 'entra' || g.ev === 'fichaCriada' || g.ev === 'vira' || g.ev === 'saiCemiterio' || SAIDA.has(g.ev)) && e.pend.some(p => p.fonte === F.id && p.ts === F.ts && p.k === k)) continue;   // "uma ou mais vão ao cemitério" (Ratchet)
      if (g.recebe && ev.combate && e.pend.some(p => p.fonte === F.id && p.ts === F.ts && p.k === k && p.ev.combate && p.ev.o === ev.o)) continue;   // várias fontes ao mesmo tempo: o enrage dispara uma vez (510.2)
      if (g.ev === 'danoUmaVez' && e.pend.some(p => p.fonte === F.id && p.ts === F.ts && p.k === k)) continue;   // o dano de combate é simultâneo (510.2): um disparo pela etapa
      if (g.limite) { const T = e.turno, ch = F.id + ':' + F.ts + ':' + k; T.lim = T.lim || {}; if (T.lim[ch]) continue; T.lim[ch] = true; }   // "só uma vez a cada turno"

      // CR 104.4b: laço que ninguém pode parar = empate. Mais de LACO disparos da mesma habilidade num turno só acontece
      // com dado errado (ex.: o "uma vez por turno" faltando) ou laço de verdade; a partida acaba em vez de travar.
      { const T = e.turno, ch = F.id + ':' + k; T.disp = T.disp || {}; if ((T.disp[ch] = (T.disp[ch] || 0) + 1) > LACO) { e.fim = e.fim || { vencedor: null, motivo: 'laço obrigatório (104.4b): ' + F.n }; M.log(e, 'laço obrigatório:', F.n); return; } }
      const vezes = 1 + extras(e, F, g, ev);
      const dada = k >= nb || mudado ? { g } : {};                                                // habilidade dada (camadas): leva o texto
      for (let v = 0; v < vezes; v++) e.pend.push({ fonte: F.id, ts: F.ts, ctrl: F.ctrl, k, ...dada, n: F.n, face: F.face ?? null, ficha: F.ficha || null, lki: M.lkiDe(e, F), ev: { ...ev, snap: undefined, ...(ev.ev === 'moeGrupo' ? { n: ev.ids.filter(id => relJog(g.jog || 'qualquer', e.objs[id].dono, F.ctrl) && (!g.quem || bate(e, e.objs[id], g.quem, { voce: F.ctrl, este: F.id }))).length } : {}) } });   // "that many": só as do lote que batem
    }
  }
  atrasados(e, ev);
  temporarios(e, ev);
  M.masmorrasEvento(e, ev);                                                             // iniciativa, morbid, "até o seu próximo turno" (masmorras.ts)
  if (ev.ev === 'alvoDe') resguardo(e, ev);
  if (ev.ev === 'conjura') proeza(e, ev);
  if (ev.ev === 'ataca' && e.objs[ev.id]) {   // miríade (702.116a): um gatilho por instância
    const F = e.objs[ev.id];
    for (const x of M.kwDe(e, F)) if (x.k === 'miriade') e.pend.push({ fonte: F.id, ts: F.ts, ctrl: F.ctrl, k: 'miriade', g: GAT_MIRIADE, n: F.n, face: F.face ?? null, ficha: F.ficha || null, lki: M.lkiDe(e, F), ev: { ...ev } });
  }
  // pós-vida N (CR 702.135a): "quando vai do campo para o cemitério, crie N Espíritos 1/1 brancos e pretos voadores";
  // a palavra-chave é lida como estava no campo (603.10a: snap); quem controla o gatilho = quem a controlava
  if (ev.ev === 'zona' && ev.de === 'campo' && ev.para === 'cemiterio' && ev.snap) {
    const S = ev.snap;
    // persistir (702.79a): "quando morre, se não tinha marcador -1/-1, volta ao campo do dono com um -1/-1" (603.4: olha o snap)
    if (M.temTipo(e, S, 'Creature') && !(S.marc && S.marc['-1/-1'] > 0) && e.objs[S.id]) for (const x of M.kwDe(e, S)) if (x.k === 'persistir')
      e.pend.push({ fonte: S.id, ts: S.ts, ctrl: S.ctrl, k: 'persistir', g: GAT_PERSISTIR, n: S.n, face: S.face ?? null, ficha: S.ficha || null, lki: M.lkiDe(e, S), ev: { ...ev, snap: undefined, tsCem: e.objs[S.id].ts } });
    for (const x of M.kwDe(e, S)) if (x.k === 'posVida' && Number.isInteger(x.n) && x.n > 0)
      e.pend.push({ fonte: S.id, ts: S.ts, ctrl: S.ctrl, k: 'posVida', g: { ev: 'vaiCemiterio', fx: [{ op: 'ficha', quem: 'voce', qtd: x.n, token: ESPIRITO }] }, n: S.n, face: S.face ?? null, ficha: S.ficha || null, lki: M.lkiDe(e, S), ev: { ...ev, snap: undefined } });
  }
  if (ev.ev === 'zona' && ev.para === 'campo' && e.objs[ev.id]) {                      // fabricar, esconderijo
    const F = e.objs[ev.id];
    for (const g of kwEntraDe(M.dadoDe(e, F))) {
      const vezes = 1 + extras(e, F, g, ev);
      for (let v = 0; v < vezes; v++) e.pend.push({ fonte: F.id, ts: F.ts, ctrl: F.ctrl, k: g._k, g, n: F.n, ficha: F.ficha || null, lki: M.lkiDe(e, F), ev: { ...ev, snap: undefined } });
    }
  }
};

// Ordem que não muda nada (Edigar 26/11, Ivora + Bag of Holding no mesmo descarte): pela regra a ordem é do jogador
// (603.3b), mas se cada gatilho só soma algo que nenhum outro lê, qualquer ordem dá o mesmo jogo e a Mesa não pergunta.
// Conservador: só gatilhos sem alvo, sem condição (603.4), sem "pode" e não modais, com efeitos da lista abaixo; o
// "mover a carta do evento" (Bag) entra se a carta não é fonte de outro gatilho do lote. Qualquer outro (ex.: Kozilek,
// que embaralha o cemitério) faz perguntar.
const ADITIVO = fx => (fx.op === 'marcador' && fx.em === 'este' && !fx.x) || (fx.op === 'ficha' && fx.quem === 'voce') || (fx.op === 'ganharVida' && fx.quem === 'voce' && Number.isInteger(fx.qtd));
const MOVE_EV = fx => fx.op === 'mover' && fx.em === 'doEvento' && (fx.de === 'cemiterio' || fx.de === 'mao') && fx.para === 'exilio';
function ordemIndiferente(e, ps) {
  const fontes = new Set(ps.map(p => p.fonte));
  return ps.every(p => {
    const g = M.gatilhoDe(p);
    if (!g || !Array.isArray(g.fx) || !g.fx.length || (g.alvos && g.alvos.length) || g.se || g.talvez) return false;
    return g.fx.every(fx => ADITIVO(fx) || (MOVE_EV(fx) && p.ev && !fontes.has(p.ev.id)));
  });
}

// ---------- pôr na pilha (603.3b): ativo primeiro, cada um na ordem que escolher ----------
M.PROC.gatilhos = (e, P, ask) => {
  const ordem: any[] = []; const n = e.jogs.length;
  for (let i = 0; i < n; i++) ordem.push((e.turno.ativo + i) % n);
  for (const j of ordem) {
    for (;;) {
      const meus = e.pend.map((p, i) => i).filter(i => e.pend[i].ctrl === j);
      if (!meus.length) break;
      if (e.jogs[j].saiu) { e.pend = e.pend.filter(p => p.ctrl !== j); break; }
      // ordem (603.3b): pergunta só quando há gatilhos diferentes (mesma fonte e mesmo texto = tanto faz)
      const tipos = new Map(); for (const i of meus) { const p = e.pend[i], c = p.n + '|' + p.k; if (!tipos.has(c)) tipos.set(c, i); }
      let ops = [...tipos.values()].map(i => ({ a: 'gatilho', i, id: e.pend[i].fonte, k: e.pend[i].k }));
      if (ops.length > 1 && ordemIndiferente(e, ops.map(o => e.pend[o.i]))) ops = ops.slice(0, 1);   // ordem não muda o resultado: não pergunta
      const op = ask(j, 'ordemGatilho', ops);
      const p = e.pend[op.i], g = M.gatilhoDe(p);
      const ctx = { voce: j, este: p.fonte };
      const dg = { alvos: g.alvos || [], fx: g.fx };
      const modal = g.fx.length === 1 && g.fx[0].op === 'modal';
      const modos = modal ? M.escolherModos(e, j, dg, g.fx[0], ask, p.fonte) : null;              // 603.3c
      if (modal && !modos.length) { e.pend.splice(op.i, 1); M.log(e, p.n, 'gatilho modal sem modo possível: sai (603.3c)'); ask.etapa(); continue; }
      const fxE = M.fxEfetivo(dg, g.fx, modos);
      const herda = p.k === 'atrasado' && !!p.mem && !!p.mem.alvos;     // atrasado com alvo herdado: já escolhido por quem o criou
      const alvos = herda ? [] : M.escolherAlvos(e, j, dg, fxE, ctx, ask);
      e.pend.splice(op.i, 1);
      const falta = !herda && M.alvosUsados(fxE).some(i => (alvos[i] || []).length < ((g.alvos[i].min ?? 1)));
      if (falta) { M.log(e, p.n, 'gatilho sem alvo legal: sai (603.3d)'); ask.etapa(); continue; }
      const id = e.prox++;
      e.objs[id] = { id, n: p.n, dono: j, ctrl: j, zona: 'pilha', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false,
        hab: { fonte: p.fonte, fonteTs: p.ts, gat: p.k, fx: g.fx, alvos: g.alvos || [], ficha: p.ficha, se: g.se || null, talvez: !!g.talvez },
        pil: { x: 0, alvos, modos, ctrl: j, lki: { este: p.lki }, ev: p.ev, mem: p.mem || null } };
      e.pilha.push(id);
      M.eventosAlvo(e, alvos, id);
      M.log(e, e.jogs[j].nome, 'gatilho de', p.n, '(' + g.ev + ')');
      ask.etapa();
    }
  }
  e.proc = null;
  const T = e.turno; if (T.prio) { T.prio.j = T.ativo; T.prio.n = 0; T.prio.acabou = false; }   // 117.3b
};
// chamado no laço antes da prioridade; no desvirar espera (502.4: ninguém recebe prioridade)
M.porGatilhos = e => {
  e.lote = [];
  if (!e.pend || !e.pend.length || e.turno.passo === 'desvirar' || e.turno.passo === 'mulligan') return false;
  M.iniciarProc(e, { tp: 'gatilhos' });
  return true;
};
// 603.4: condição de intervenção checada de novo ao resolver
M.gatilhoAindaVale = (e, o) => !o.hab || !o.hab.se || cond(e, o.hab.se, { voce: o.ctrl, este: o.hab.fonte });
