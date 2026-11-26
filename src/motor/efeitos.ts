// src/motor/efeitos.ts (T43: migrado de motor2/efeitos.js) — efeitos do formato RX que o núcleo já executa na resolução (CR 608.2c–h) e o teste de suporte.
// O que não está aqui (ou tem campo que o handler não conhece) faz a carta/habilidade NÃO ser oferecida: melhor
// não jogar do que jogar errado em silêncio. Regra de cada handler: perguntar tudo antes de mexer no estado.
import { M } from './nucleo';

const BASE = new Set(['op', 'em', 'quem', 'qtd', 'se', 'talvez', 'aMenosQue', 'pagando']);
const QUEM_OK = new Set(['voce', 'cadaOponente', 'cadaJogador', 'alvoJogador', 'controlador', 'dono', 'doEvento', 'atacado', 'cadaAtual']);
// cadaAtual (o jogador da vez) só vale dentro de um repetirCada: fora dele seria um jogador que não existe
let dentroCada = 0, dentroObj = 0;
const comCada = fn => { dentroCada++; try { return fn(); } finally { dentroCada--; } };
// dentro de um repetirCada com filtro de objetos (Kalonian Hydra): em/copiaDe 'cadaAtual' = o objeto da vez
const comObj = fn => { dentroObj++; try { return fn(); } finally { dentroObj--; } };
const CONTA_OK = new Set(['poderDoAlvo', 'resistDoAlvo', 'vmDoAlvo', 'poderDoEste', 'resistDoEste', 'marcadoresNoEste',
  'cartasNaMao', 'oponentes', 'jogadores', 'suaVida', 'devocao', 'X', 'resultado', 'lembrados', 'evento', 'atacantes', 'atacantesEmVoce', 'ataquesNoTurno', 'danoCausado', 'poderDoSacrificado', 'vmDoSacrificado', 'marcadoresNoCada', 'descartadasNoTurno']);   // lembrados: as cartas descartadas pelo efeito anterior; evento: quantas o evento do gatilho juntou (descarta em grupo)   // resultado: quantos o efeito anterior moveu (Valakut Awakening)
const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta', 'conjuradaCom', 'palavra', 'pagou', 'objBate', 'esteEm', 'temIniciativa', 'completouMasmorra']);

// ---------- suporte (estático, olhando só o dado) ----------
// quem: {alvo: N} = o jogador escolhido no alvo N ("target player discards", Kolaghan's Command)
const quemAlvo = q => !!q && typeof q === 'object' && typeof q.alvo === 'number' && Object.keys(q).length === 1;
// {dado:N}: rola um dado de N lados (CR 706) com o RNG da partida; {ate:N|'X'|'qualquer'} ("up to") só onde o handler aceita
const dadoOk = q => !!q && typeof q === 'object' && Number.isInteger(q.dado) && q.dado >= 2 && Object.keys(q).length === 1;
const ateOk = q => !!q && typeof q === 'object' && Object.keys(q).length === 1 && (Number.isInteger(q.ate) || q.ate === 'X' || q.ate === 'qualquer');
const qtdOk = q => q === undefined || typeof q === 'number' || q === 'X' || dadoOk(q)
  || (q && typeof q === 'object' && (typeof q.conta === 'string' ? CONTA_OK.has(q.conta) : M.filtroOk(q.conta))
    && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'alvo', 'prop', 'de'].includes(k)) && (q.de === undefined || ((q.conta === 'marcadoresNoEste' || q.conta === 'marcadoresNoCada' || q.conta === 'devocao') && typeof q.de === 'string')) && (q.conta !== 'marcadoresNoCada' || dentroObj > 0) && (q.conta !== 'devocao' || /^[WUBRG]+$/.test(q.de || '')) && (q.prop === undefined || (M.PROP_EST.has(q.prop) && typeof q.conta === 'object')));
const emOk = v => v === undefined || v === 'este' || (v === 'cadaAtual' && dentroObj > 0) || v === 'equipada' || v === 'doEvento' || v === 'criadas' || v === 'anterior' || (v && typeof v === 'object' && (typeof v.alvo === 'number' || (v.todos && M.filtroOk(v.todos))));
const seOk = se => !se || (Object.keys(se).every(k => COND_OK.has(k))
  && M.condValorOk(se) && (!se.objBate || (Object.keys(se.objBate).every(k => ['em', 'f', 'nao'].includes(k)) && se.objBate.em !== undefined && emOk(se.objBate.em) && M.filtroOk(se.objBate.f || {}))) && (!se.existe || M.filtroOk(se.existe.f)) && (!se.controla || M.filtroOk(se.controla.f)) && (!se.conta || qtdOk(se.conta.q))
  && (!se.esteEm || (Array.isArray(se.esteEm) && se.esteEm.length > 0 && se.esteEm.every(z => ['campo', 'cemiterio', 'exilio', 'mao', 'comando', 'grimorio'].includes(z)))));
M.seOk = seOk;
// aMenosQue (CR 118.12): "X unless [quem] pays [custo]". Custo: mana fixa, {x:1} com qtd (Esper Sentinel), vida, sacrificar {f, qtd}
const amqOk = a => !!a && typeof a === 'object' && Object.keys(a).every(k => ['quem', 'custo', 'qtd'].includes(k))
  && (QUEM_OK.has(a.quem) || quemAlvo(a.quem)) && (a.quem !== 'cadaAtual' || dentroCada > 0) && !!a.custo && typeof a.custo === 'object' && Object.keys(a.custo).length === 1
  && (a.custo.mana ? Object.keys(a.custo.mana).every(k => k === 'g' || k === 'x' || /^[WUBRGC]$/.test(k) || k === 'p') && (!a.custo.mana.x || (a.qtd !== undefined && qtdOk(a.qtd)))
    : a.custo.vida ? Number.isInteger(a.custo.vida)
    : a.custo.sacrificar === 'este' ? true                                         // "unless you sacrifice this" (Withercrown dá à encantada)
    : a.custo.sacrificar ? typeof a.custo.sacrificar === 'object' && M.filtroOk(a.custo.sacrificar.f || {}) && Object.keys(a.custo.sacrificar).every(k => k === 'f' || k === 'qtd') && (a.custo.sacrificar.qtd === undefined || Number.isInteger(a.custo.sacrificar.qtd))
    : false)
  && (a.qtd === undefined || !!a.custo.mana);
M.fxSuportado = (fx, { topo = true }: any = {}) => (fx || []).every(f => {
  if (f.op === 'modal') return topo && fx.length === 1 && f.modos.some(m => M.fxSuportado(m, { topo: false }));
  const h = H[f.op];
  if (!h) return false;
  for (const k in f) if (!BASE.has(k) && !(h.campos || []).includes(k)) return false;
  if (f.quem !== undefined && !QUEM_OK.has(f.quem) && !quemAlvo(f.quem)) return false;
  if (f.quem === 'cadaAtual' && !dentroCada) return false;
  if (!emOk(f.em) || !seOk(f.se)) return false;
  if (!(h.qtd ? h.qtd(f.qtd) : qtdOk(f.qtd))) return false;
  if (f.f && !M.filtroOk(f.f)) return false;
  if (f.aMenosQue !== undefined && !amqOk(f.aMenosQue)) return false;
  if (f.pagando !== undefined && !amqOk({ quem: 'voce', custo: f.pagando })) return false;   // "você pode pagar…; se pagar"
  return h.ok ? h.ok(f) : true;
});

// substituições (CR 614) que o motor aplica de verdade; o resto é recusado (a cobertura conta como trava). Lidas em:
// entra (decidirEntrada/aplicarEntrada), ganhaVida (estado.ts), ficha (criarFichas), marcador (porMarcadores),
// dano (substDano), anulada (pilha.ts), morre/vaiCemiterio (estado.ts, M.destinoSaida).
const SUBST: Record<string, (s) => boolean> = {
  entra: s => (!!s.muda && Object.keys(s.muda).length === 1 && s.muda.virada === true && !!s.quem && s.quem.este)
    || (!!s.emVez && s.emVez.every(f => f.op === 'escolher' && (f.o === 'cor' || f.o === 'tipoCriatura'))),
  ganhaVida: s => !!s.muda && Object.keys(s.muda).every(k => k === 'soma' || k === 'mult'),
  // "entra com N marcadores" (614.1c): a própria (quem.este) ou outras que entram (quem filtro); N = número, X pago, conta
  entraMarc: s => !!s.muda && Object.keys(s.muda).length === 1 && !!s.muda.marcadores && typeof s.muda.marcadores === 'object'
    && Object.values<any>(s.muda.marcadores).every((q: any) => qtdOk(q === 'X' ? q : q && typeof q === 'object' && q.conta === 'X' ? 'X' : q)),
  ficha: s => !!s.muda && Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || (!!s.muda.maisFicha && typeof s.muda.maisFicha === 'object')),
  marcador: s => !!s.muda && Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || Number.isInteger(s.muda.soma) || s.muda.impedir === true)
    && Object.keys(s).every(k => ['ev', 'quem', 'marc', 'muda', 'se'].includes(k)),
  // morre / vaiCemiterio (CR 614.1a, lido no M.mover): muda.para (Liesa), "exile com marcador" (Ravenloft), "embaralhe no grimório" (Blightsteel)
  morre: s => saidaOk(s),
  vaiCemiterio: s => saidaOk(s),
  anulada: s => !!s.muda && Object.keys(s.muda).length === 1 && s.muda.impedir === true && Object.keys(s).every(k => ['ev', 'quem', 'muda', 'se'].includes(k))
    && !!s.quem && s.quem.zona === 'pilha',   // "não pode ser anulada" (M.anular, pilha.ts)
  dano: s => !!s.muda && Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || s.muda.metade === true || s.muda.prevenir === true || Number.isInteger(s.muda.teto))
    && Object.keys(s).every(k => ['ev', 'quem', 'jog', 'por', 'combate', 'muda', 'se'].includes(k)) && (!s.por || M.filtroOk(s.por)) && (!s.jog || s.jog === 'voce' || s.jog === 'oponente'),
};
function saidaOk(s) {
  if (!Object.keys(s).every(k => ['ev', 'quem', 'muda', 'emVez', 'se', 'talvez'].includes(k)) || !!s.muda === !!s.emVez) return false;
  if (s.talvez !== undefined && (s.talvez !== true || s.ev !== 'vaiCemiterio' || !s.quem || s.quem.zona !== 'mao')) return false;   // só "descartada por efeito" (Leng)
  if (s.muda) return Object.keys(s.muda).length === 1 && ['exilio', 'grimorio', 'mao'].includes(s.muda.para);
  const [a, b, ...r] = s.emVez; if (r.length || !a) return false;
  if (a.op === 'exilar' && a.em === 'doEvento' && Object.keys(a).length === 2) return !b || (b.op === 'marcador' && b.em === 'doEvento' && typeof b.tipoMarc === 'string' && Number.isInteger(b.qtd) && Object.keys(b).length === 4);
  if (a.op === 'mover' && a.em === 'este' && a.para === 'grimorio' && Object.keys(a).length === 3) return !!b && b.op === 'embaralhar' && b.quem === 'dono' && Object.keys(b).length === 2 && !!s.quem && s.quem.este;
  return false;
}
const tipoSubst = s => s.ev === 'entra' && s.muda && s.muda.marcadores ? 'entraMarc' : s.ev;
M.substOk = s => !!s && !!SUBST[tipoSubst(s)] && SUBST[tipoSubst(s)](s) && (!s.se || seOk(s.se)) && (!s.quem || typeof s.quem !== 'object' || M.filtroOk(s.quem));
M.SUBST = SUBST;
// as substituições de um tipo que estão no campo, com a permanente que as tem (F)
function substsDe(e, tipo) {
  const r: any[] = [];
  for (const id of e.campo) { const F = e.objs[id]; if (!F) continue; for (const s of M.dadoDe(e, F).subst || []) if (tipoSubst(s) === tipo && M.substOk(s)) r.push({ F, s }); }
  return r;
}
const substSe = (e, F, s) => { if (!s.se) return true; try { return M.condicao(e, s.se, { voce: F.ctrl, este: F.id }); } catch (_) { return false; } };
const substQuem = (e, F, s, o) => !s.quem || (s.quem.este ? !!o && o.id === F.id : !!o && M.bate(e, o, s.quem, { voce: F.ctrl, este: F.id }));
// pôr marcadores num objeto (CR 122.6) com as substituições 'marcador' (614.1, 616.1: o controlador escolhe a ordem —
// aqui a melhor para ele: impedir, depois somas, depois multiplicações). Devolve quantos pôs.
M.porMarcadores = (e, o, t, q) => {
  if (!(q > 0)) return 0;
  let soma = 0, mult = 1;
  for (const { F, s } of substsDe(e, 'marcador')) {
    if (s.marc && s.marc !== t) continue;
    if (!substQuem(e, F, s, o) || !substSe(e, F, s)) continue;
    if (s.muda.impedir) return 0;
    if (s.muda.soma) soma += s.muda.soma; if (s.muda.mult) mult *= s.muda.mult;
  }
  q = (q + soma) * mult;
  if (t === 'lore') M.porHistoria(e, o, q); else o.marc[t] = (o.marc[t] || 0) + q;
  return q;
};
// "entra com marcadores" (614.1c, 614.12): os da própria carta e os dados por outras permanentes (Arwen, Bramblewood)
function entraComMarcadores(e, o, x) {
  const d = M.dadoDe(e, o), lista: any[] = (d.subst || []).filter(s => tipoSubst(s) === 'entraMarc' && s.quem && s.quem.este && M.substOk(s)).map(s => ({ F: o, s }));
  for (const r of substsDe(e, 'entraMarc')) if (r.F.id !== o.id && !(r.s.quem && r.s.quem.este)) lista.push(r);
  for (const { F, s } of lista) {
    if (!substQuem(e, F, s, o) || !substSe(e, F, s)) continue;
    for (const t in s.muda.marcadores) {
      let v = s.muda.marcadores[t];
      const cx = { voce: F.ctrl, este: F.id, x: F.id === o.id ? x || 0 : 0, lki: {}, alvos: [], ilegal: {} };
      if (v && typeof v === 'object' && v.conta === 'X') v = (cx.x) * (v.mult || 1) + (v.soma || 0);
      const q = qtdDe(e, v, cx);
      if (q > 0) M.porMarcadores(e, o, t, q);
    }
  }
}
// criar fichas (CR 111) com as substituições 'ficha' (Parallel Lives, Doubling Season, Queen Allenal, Bilbo): a 1ª ficha
// serve de amostra para o filtro; "mais uma" antes de multiplicar (a ordem boa para o controlador, 616.1).
M.criarFichas = (e, j, tok, q, opc: any = {}) => {
  const out: any[] = [];
  if (!(q > 0)) return out;
  out.push(criarFicha(e, j, tok, opc));
  let mult = 1; const extras: any[] = [];
  for (const { F, s } of substsDe(e, 'ficha')) {
    if (!substQuem(e, F, s, out[0]) || !substSe(e, F, s)) continue;
    if (s.muda.mult) mult *= s.muda.mult; else extras.push(s.muda.maisFicha);
  }
  for (let i = 1; i < q * mult; i++) out.push(criarFicha(e, j, tok, opc));
  for (const x of extras) for (let i = 0; i < mult; i++) out.push(criarFicha(e, j, x, {}));
  return out;
};
// dano (CR 615, 614.1a): dobrar (mult), metade arredondada para cima, prevenir, "todo menos N" (teto). jog = o jogador
// que recebe (relativo a quem tem a substituição); quem = a permanente que recebe; por = a fonte. Prevenir antes de dobrar.
M.substDano = (e, q, { fonte, combate = false, jog, o }: any) => {
  if (!(q > 0)) return 0;
  const lista = substsDe(e, 'dano').filter(({ F, s }) => {
    if (s.combate !== undefined && !!s.combate !== !!combate) return false;
    if (s.jog !== undefined || s.quem !== undefined) {
      const okJ = s.jog !== undefined && jog !== undefined && (s.jog === 'voce' ? jog === F.ctrl : jog !== F.ctrl);
      const okO = s.quem !== undefined && o !== undefined && substQuem(e, F, s, o);
      if (!okJ && !okO) return false;
    }
    if (s.por && !(fonte && M.bate(e, fonte, s.por, { voce: F.ctrl, este: F.id }))) return false;
    return substSe(e, F, s);
  });
  if (lista.some(r => r.s.muda.prevenir)) return 0;
  for (const r of lista) if (r.s.muda.teto !== undefined) q = Math.min(q, r.s.muda.teto);
  for (const r of lista) if (r.s.muda.mult) q *= r.s.muda.mult;
  for (const r of lista) if (r.s.muda.metade) q = Math.ceil(q / 2);
  return q;
};

// ---------- leitura no meio da resolução ----------
const objsDeQualquer = (e, f, ctx) => objsDe(e, f, ctx);
const movidos = (e, ids) => ids.map(id => ({ id, ts: e.objs[id].ts }));

const c0ts = (ctx, id) => (ctx.criadas.find(c => c.id === id) || {}).ts;
// objetos que o efeito afeta (alvo ilegal fica de fora, CR 608.2b)
function objsDe(e, f, ctx) {
  const v = f.em;
  if (v === undefined) return [];
  if (v === 'cadaAtual') { const c = ctx.cadaObj, o = c && e.objs[c.id]; return o && o.ts === c.ts && o.zona === 'campo' ? [o] : []; }   // repetirCada de objetos
  if (v === 'este') { const o = e.objs[ctx.este]; return o && o.zona === 'campo' && (!ctx.lki.este || o.ts === ctx.lki.este.ts) ? [o] : []; }
  if (typeof v.alvo === 'number') {
    return (ctx.alvos[v.alvo] || []).map((a, k) => ctx.ilegal[v.alvo + ':' + k] || a.o === undefined ? null : e.objs[a.o])
      .filter(o => o && (ctx.alvos[v.alvo].find(a => a.o === o.id) || {}).ts === o.ts);
  }
  if (v === 'anterior') return (ctx.movidos || []).map(m => e.objs[m.id]).filter(o => o && (ctx.movidos.find(m => m.id === o.id) || {}).ts === o.ts);   // o que o efeito anterior moveu
  if (v === 'criadas') return (ctx.criadas || []).map(c => e.objs[c.id]).filter(o => o && o.zona === 'campo' && o.ts === c0ts(ctx, o.id));   // as fichas que este efeito criou
  if (v === 'equipada') {                                            // o objeto a que a fonte está presa (CR 301.5a, 303.4a)
    const F = e.objs[ctx.este], t = F && F.zona === 'campo' && (!ctx.lki.este || F.ts === ctx.lki.este.ts) ? M.anexadoA(e, F) : null;
    return t ? [t] : [];
  }
  if (v.todos) return M.objetosQue(e, v.todos.zona ? v.todos : { ...v.todos, zona: 'campo' }, ctx);
  if (v === 'doEvento') {                                            // o objeto do evento do gatilho (no dano, a fonte)
    const ev = ctx.ev, o = ev ? e.objs[ev.ev === 'dano' ? ev.fonte : ev.id] : null;
    if (!o || (ev.ts !== undefined && o.ts !== ev.ts)) return [];   // mudou de zona depois do evento: outro objeto (400.7)
    return o.zona === (f.de || 'campo') ? [o] : [];
  }
  throw new Error('em sem suporte: ' + JSON.stringify(v));
}
// jogadores-alvo legais de um efeito com em:{alvo}
function jogsAlvo(e, i, ctx) { return (ctx.alvos[i] || []).filter((a, k) => a.jog !== undefined && !ctx.ilegal[i + ':' + k] && !e.jogs[a.jog].saiu).map(a => a.jog); }
// LKI dos objetos afetados (para "controlador/dono" depois que o objeto saiu do campo)
function lkisDe(e, f, ctx) {
  const v = f.em;
  if (v && typeof v.alvo === 'number') return (ctx.lki.alvos[v.alvo] || []).filter((l, k) => l && !ctx.ilegal[v.alvo + ':' + k]);
  if (v === 'este' && ctx.lki.este) return [ctx.lki.este];
  return objsDe(e, f, ctx).map(o => M.lkiDe(e, o));
}
function jogsDe(e, f, ctx) {
  const vivos = M.vivos(e);
  if (f.em && typeof f.em.alvo === 'number' && !f.quem) { const js = jogsAlvo(e, f.em.alvo, ctx); if (js.length) return js; }
  if (quemAlvo(f.quem)) return jogsAlvo(e, f.quem.alvo, ctx);
  switch (f.quem) {
    case undefined: case 'voce': return vivos.includes(ctx.voce) ? [ctx.voce] : [];
    case 'cadaOponente': return vivos.filter(j => j !== ctx.voce);
    case 'atacado': return ctx.ev && ctx.ev.def !== undefined && vivos.includes(ctx.ev.def) ? [ctx.ev.def] : [];   // o jogador defensor do ataque (Kozilek, Ulamog: 508.5)
    case 'cadaJogador': return vivos;
    case 'alvoJogador': { for (let i = 0; i < ctx.alvos.length; i++) { const js = jogsAlvo(e, i, ctx); if (js.length) return js; } return []; }
    case 'controlador': return [...new Set(lkisDe(e, f, ctx).map(l => l.ctrl))].filter(j => vivos.includes(j));
    case 'dono': return [...new Set(lkisDe(e, f, ctx).map(l => l.dono))].filter(j => vivos.includes(j));
    case 'cadaAtual': return ctx.cadaAtual !== undefined && vivos.includes(ctx.cadaAtual) ? [ctx.cadaAtual] : [];
    case 'doEvento': { const jj = ctx.ev ? (ctx.ev.ev === 'dano' ? ctx.ev.jog : ctx.ev.j) : undefined; return jj !== undefined && vivos.includes(jj) ? [jj] : []; }   // quem descartou (Megrim); no dano, o jogador que recebeu (Blightbelly Rat)
  }
  throw new Error('quem sem suporte: ' + f.quem);
}
function qtdDe(e, q, ctx) {
  if (q === undefined) return 1;
  if (dadoOk(q)) { const v = 1 + Math.floor(M.aleat(e) * q.dado); M.log(e, 'd' + q.dado, 'deu', v); return v; }   // CR 706
  if (ateOk(q)) return q.ate === 'qualquer' ? Infinity : q.ate === 'X' ? ctx.x || 0 : q.ate;   // o máximo; quem escolhe para antes
  if (q && typeof q === 'object' && typeof q.conta === 'string') {
    const L = ctx.lki, a = L.alvos && L.alvos[q.alvo || 0] && L.alvos[q.alvo || 0][0];
    const este = e.objs[ctx.este] && e.objs[ctx.este].zona === 'campo' ? M.lkiDe(e, e.objs[ctx.este]) : L.este;
    let v;
    switch (q.conta) {
      case 'poderDoAlvo': v = a ? a.poder : 0; break;
      case 'resistDoAlvo': v = a ? a.resist : 0; break;
      case 'vmDoAlvo': v = a ? a.vm : 0; break;
      case 'poderDoEste': v = este ? este.poder : 0; break;
      case 'resistDoEste': v = este ? este.resist : 0; break;
      case 'descartadasNoTurno': { const D = e.jogs[ctx.voce].descT; v = D && D.t === e.turno.n ? D.n : 0; break; }   // "for each card you've discarded this turn"
      case 'marcadoresNoCada': { const c = ctx.cadaObj, o = c && e.objs[c.id]; v = !o || o.ts !== c.ts ? 0 : o.marc[q.de] || 0; break; }   // o objeto da vez do repetirCada
      case 'marcadoresNoEste': v = !este ? 0 : q.de ? este.marc[q.de] || 0 : Object.values<any>(este.marc).reduce((s, n) => s + n, 0); break;   // de: um tipo de marcador ('lore')
      case 'devocao': v = M.devocao(e, ctx.voce, q.de); break;
      case 'cartasNaMao': v = e.jogs[ctx.voce].zonas.mao.length; break;
      case 'oponentes': v = M.vivos(e).filter(j => j !== ctx.voce).length; break;
      case 'jogadores': v = M.vivos(e).length; break;
      case 'suaVida': v = e.jogs[ctx.voce].vida; break;
      case 'X': v = ctx.x || 0; break;
      case 'resultado': v = ctx.resultado || 0; break;
      case 'lembrados': v = (ctx.lembrados || []).length; break;
      case 'evento': v = ctx.ev ? ctx.ev.n ?? 1 : 0; break;
      case 'danoCausado': v = ctx.ev && ctx.ev.ev === 'dano' ? ctx.ev.q || 0 : 0; break;   // "that much damage" (o dano do evento)
      case 'poderDoSacrificado': v = (ctx.sac || []).reduce((s, l) => s + Math.max(0, l.poder), 0); break;   // custo adicional sacrificar (LKI, 608.2h)
      case 'vmDoSacrificado': v = (ctx.sac || []).reduce((s, l) => s + (l.vm || 0), 0); break;
      case 'atacantes': case 'atacantesEmVoce': case 'ataquesNoTurno': v = M.contaAtaque(e, q.conta, ctx.voce); break;
      default: throw new Error('conta sem suporte: ' + q.conta);
    }
    return Math.max(0, v * (q.mult || 1) + (q.soma || 0));
  }
  const v = M.qtd(e, q, ctx);
  if (v === null) throw new Error('qtd sem suporte: ' + JSON.stringify(q));
  return Math.max(0, v);
}
M.qtdDe = qtdDe;
M.objsDe = (e, f, ctx) => objsDe(e, f, { lki: {}, alvos: [], ilegal: {}, ...ctx });
const fonteDado = (e, ctx) => {
  const it = e.objs[ctx.item];
  if (it && !it.hab) return M.dadoDe(e, it);
  if (it && it.hab && it.hab.ficha) return it.hab.ficha;
  return ctx.lki.este ? M.dadoFace(M.carta(ctx.lki.este.n), ctx.lki.este.face) : {};
};

// fonte do dano que não é esta carta (CR 120.3, 609.7): {alvo:N} = o objeto alvo (Chandra's Ignition); 'doEvento' = o
// objeto do evento do gatilho (a que entrou/atacou: Warstorm Surge, Ingris; no ev dano, a que recebeu). No campo, com
// as camadas (palavra-chave dada vale); fora dele, a última informação (LKI do alvo, ou a carta). null = não há fonte.
function fonteOutra(e, fo, ctx) {
  let o: any = null, l: any = null;
  if (fo === 'doEvento') { const ev = ctx.ev; o = ev ? e.objs[ev.ev === 'dano' ? (ev.o ?? ev.fonte) : ev.id] : null; }   // dano em jogador: a fonte (Kediss)
  else {
    const a = (ctx.alvos[fo.alvo] || [])[0];
    if (!a || a.o === undefined || ctx.ilegal[fo.alvo + ':0']) return null;
    o = e.objs[a.o]; l = ctx.lki.alvos && (ctx.lki.alvos[fo.alvo] || [])[0];
    if (o && l && o.ts !== l.ts) o = null;                           // mudou de zona: virou outro objeto (400.7)
  }
  if (o && o.zona === 'campo') return { kw: M.kwDe(e, o), ctrl: o.ctrl, o };
  if (o) return { kw: M.dadoDe(e, o).kw || [], ctrl: o.ctrl };
  if (l) return { kw: M.dadoFace(M.carta(l.n), l.face).kw || [], ctrl: l.ctrl };
  return null;
}

// modificar 'enquantoNoCampo' (Urza's Saga): só 'este' ganhando habilidade ativada que o motor ativa
const ganhoOk = f => f.em === 'este' && f.p === undefined && f.r === undefined && !(f.kw || []).length && !(f.est || []).length
  && !!f.habil && Object.keys(f.habil).length === 1 && Array.isArray(f.habil.atv) && f.habil.atv.length > 0 && f.habil.atv.every(a => !!a && M.custoSuportado(a.custo || {}) && M.fxSuportado(a.fx, { topo: false }));
// estáticas de regra que o modificar entrega ao e.efTemp (lidas por M.tempNoObj em combate.ts)
const EST_REGRA = ['naoPodeSerBloqueada', 'naoPodeBloquear', 'deveAtacar'];
// estática dada por efeitoTemporario que algum leitor conhece (estado.ts: M.tempNoObj, M.vidaFixa, M.protegeJog)
function tempEstOk(s, f) {
  const ks = Object.keys(s), so = (...a) => ks.every(k => ['modo', 'afeta', ...a].includes(k));
  const objOk = s.afeta === 'este' || (s.afeta === undefined && f.em !== undefined) || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta));
  switch (s.modo) {
    case 'vidaNaoMuda': return s.afeta === 'voce' && so();
    case 'protecaoJogador': return s.afeta === 'voce' && so('kw', 'de') && (s.de === 'tudo' || (s.kw || []).length === 1 && s.kw[0].k === 'protecao' && s.kw[0].de === 'tudo' && Object.keys(s.kw[0]).length === 2);
    case 'naoPodeSerBloqueada': case 'naoPodeBloquear': case 'deveAtacar': return objOk && so();
  }
  return false;
}
// "a menos que [quem] pague": cada jogador de quem (em geral um só), na ordem do turno, escolhe pagar ou não; o primeiro
// que paga impede o efeito. Mana paga na hora (pode ativar habilidade de mana, 608.2g); X da conta qtd (Esper Sentinel).
function pagouParaImpedir(e, f, ctx, ask) {
  const a = f.aMenosQue, c = a.custo;
  for (const j of jogsDe(e, { ...f, quem: a.quem }, ctx)) {
    const J = e.jogs[j], ops: any[] = [{ a: 'naoPagar' }];
    let mana: any = null, x = 0;
    if (c.mana) { mana = { ...c.mana }; if (mana.x) { x = qtdDe(e, a.qtd, ctx); } if (M.planoMana(e, j, mana, { x })) ops.push({ a: 'pagar' }); }
    else if (c.vida) { if (J.vida >= c.vida && !M.vidaFixa(e, j)) ops.push({ a: 'pagar' }); }   // CR 119.4, 119.8
    else if (c.sacrificar === 'este') { const o = e.objs[ctx.este]; if (o && o.zona === 'campo' && o.ctrl === j) ops.push({ a: 'pagar' }); }
    else if (c.sacrificar) { if (M.temPeloMenos(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: ctx.este }, c.sacrificar.qtd || 1)) ops.push({ a: 'pagar' }); }
    const fo = e.objs[ctx.item] || e.objs[ctx.este];
    const r = ask(j, 'aMenosQuePagar', ops, { op: f.op, fonte: fo ? fo.n : '?', de: ctx.voce, custo: c, x });
    if (r.a !== 'pagar') continue;
    if (mana) M.pagarComPlano(e, j, mana, { x });
    else if (c.vida) J.vida -= c.vida;                                                        // CR 119.4
    else if (c.sacrificar === 'este') M.mover(e, ctx.este, 'cemiterio');
    else {
      const sac: any[] = [];
      for (let i = 0; i < (c.sacrificar.qtd || 1); i++) {
        const cand = M.objetosQue(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: ctx.este }).filter(o => !sac.includes(o.id));
        sac.push(ask(j, 'custo', cand.map(o => ({ a: 'sacrificar', id: o.id })), { o: 'sacrificar' }).id);
      }
      for (const id of sac) M.mover(e, id, 'cemiterio');
    }
    M.log(e, J.nome, 'paga para impedir', fo ? fo.n : '');
    return true;
  }
  return false;
}

// ---------- executar um efeito ----------
M.executar = (e, f, ctx, ask) => {
  if (ctx.rep && ctx.rep.f === f) { H.repetirCada.fx(e, f, ctx, ask); return; }   // repetirCada no meio (voltou de uma pergunta): condição já lida
  if (f.se && !M.condicao(e, f.se, ctx)) return;                     // CR 608.2c: condição lida na hora
  // "pode" ANTES de qualquer pagamento: o processo repete o passo a cada resposta, e uma pergunta depois de pagar via
  // o estado já pago (a opção 'pagar' sumia na repetição e a resposta gravada apontava para nada — Leaf-Crowned
  // Visionary). Com 'pagando', o próprio pagar é o "pode": não pergunta duas vezes.
  const h0 = H[f.op];
  if (f.talvez && !f.pagando && !(h0 && h0.talvezDentro) && ask(f.quem === 'cadaAtual' ? ctx.cadaAtual : ctx.voce, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: f.op }).a === 'nao') { ctx.pagou = false; return; }   // "pode"
  if (f.aMenosQue && pagouParaImpedir(e, f, ctx, ask)) { ctx.pagou = false; return; }   // CR 118.12: alguém pagou, o efeito não acontece
  if (f.pagando) {                                                   // "você pode pagar X. Se pagar, …" (pergunta e paga antes do efeito)
    const pagou = pagouParaImpedir(e, { op: 'pagando', aMenosQue: { quem: 'voce', custo: f.pagando } }, ctx, ask);
    ctx.pagou = pagou; if (!pagou) return;
  }
  const h = H[f.op];
  if (!h) throw new Error('efeito sem suporte no motor2: ' + f.op + ' (' + ((e.objs[ctx.item] || {}).n || '?') + ')');
  if (f.talvez) ctx.pagou = true;                                    // "se fizer" (se.pagou) do efeito seguinte
  h.fx(e, f, ctx, ask);
};

// entrar no campo (CR 110.2: sob o controle de quem conjurou/pôs; 614.1c "entra virado"; 614.12 escolha ao entrar)
// Em duas metades: decidirEntrada só pergunta (pode rodar de novo), aplicarEntrada mexe no estado.
M.entrarPermanente = (e, id, ctrl, opc, ask) => M.aplicarEntrada(e, M.decidirEntrada(e, id, ctrl, opc, ask));
// face: a face que vai entrar para cima quando não é a de agora (terreno modal, 712.9); sem ela, a do objeto
M.decidirEntrada = (e, id, ctrl, { virada = false, face = undefined }: any = {}, ask) => {
  const o = e.objs[id], d = face === undefined ? M.dadoDe(e, o) : M.dadoFace(M.carta(o.n), face), ctx = { voce: ctrl, este: id };
  let vir = virada, pagaVida = 0;
  const s = (d.subst || []).find(x => x.ev === 'entra' && x.muda && x.muda.virada && x.quem && x.quem.este);
  if (s && M.condicao(e, s.se, ctx)) {
    if (s.aMenosQue && ask) {
      const ops: any[] = [{ a: 'naoPagar' }], c = s.aMenosQue.custo;
      if (c.vida && e.jogs[ctrl].vida >= c.vida && !M.vidaFixa(e, ctrl)) ops.push({ a: 'pagar' });   // CR 119.4, 119.8
      if (c.revelar) for (const r of M.objetosQue(e, { ...c.revelar.f, dono: 'voce', zona: 'mao' }, ctx)) if (r.id !== id) ops.push({ a: 'revelar', rid: r.id });
      const r = ask(ctrl, 'aMenosQue', ops, { id, vida: c.vida || 0 });
      if (r.a === 'naoPagar') vir = true; else if (r.a === 'pagar') pagaVida = c.vida;
    } else vir = true;
  }
  let escolha: any = null;
  if (ask) {
    for (const sb of d.subst || []) {
      if (sb.ev !== 'entra' || !sb.emVez || escolha) continue;
      for (const fz of sb.emVez) {
        if (fz.op !== 'escolher') continue;
        let ops;
        if (fz.o === 'cor') ops = (fz.cores || 'WUBRG').split('').map(c => ({ a: 'cor', v: c }));
        else if (fz.o === 'tipoCriatura') {      // opções = tipos das criaturas do próprio deck (lista finita e útil)
          const t = new Set<any>();
          for (const x of Object.values<any>(e.objs)) if (x.dono === o.dono && !x.hab && M.temTipo(e, x, 'Creature')) (M.dadoDe(e, x).sub || []).forEach(s2 => t.add(s2));
          ops = [...t].sort().map(v => ({ a: 'tipo', v }));
          if (!ops.length) continue;
        } else continue;
        const r = ask(ctrl, 'escolha', ops, { id, o: fz.o });
        escolha = fz.o === 'cor' ? { cor: r.v } : { tipo: r.v };
        break;
      }
    }
  }
  return { id, ctrl, vir, pagaVida, escolha, face };
};
M.aplicarEntrada = (e, { id, ctrl, vir, pagaVida, escolha, face, conj = null, x = 0 }) => {
  if (pagaVida) e.jogs[ctrl].vida -= pagaVida;
  const o = M.mover(e, id, 'campo', { virada: vir, face, conj });
  o.ctrl = ctrl; o.escolha = escolha; e.vCamada = (e.vCamada || 0) + 1;   // camadas: refaz as fontes (estado.ts)
  entraComMarcadores(e, o, x);                                       // 614.1c: já entra com eles (antes das ABE)
  M.log(e, e.jogs[ctrl].nome, 'põe no campo', o.n, vir ? '(virado)' : '');
  return o;
};

// escolher n objetos de uma lista, um por pergunta (pode parar antes se 'podeMenos')
function escolherN(ask, j, tipo, ids, n, { podeMenos = false, ctx = {} }: any = {}) {
  const r: any[] = [];
  while (r.length < n) {
    const ops = ids.filter(id => !r.includes(id)).map(id => ({ a: tipo, id }));
    if (podeMenos) ops.unshift({ a: 'nenhum' });
    if (!ops.length) break;
    const x = ask(j, tipo, ops, ctx);
    if (x.a === 'nenhum') break;
    r.push(x.id);
  }
  return r;
}
// Fichas predefinidas (CR 111.10): o banco escreve só {nome:'Treasure'}; o tipo e as habilidades vêm daqui,
// escritos a partir do texto Oracle da ficha. O que o token trouxer além do nome vale por cima.
// Powerstone: a restrição vira so {tipo:Artifact} (paga mágica de artefato; ainda não paga habilidade).
// Map (explorar) e Junk (exila o topo e pode jogar) usam ops que o motor não tem: a ficha existe, a habilidade não é ativada.
const art = (sub, atv) => ({ tipos: ['Artifact'], sub: [sub], cores: '', vm: 0, atv });
const sacE = (c: any = {}) => ({ ...c, sacrificar: 'este' });
M.FICHAS = {
  Treasure: art('Treasure', [{ custo: sacE({ virar: true }), deMana: true, fx: [{ op: 'mana', prod: 'qualquer', qtd: 1 }] }]),
  Gold: art('Gold', [{ custo: sacE(), deMana: true, fx: [{ op: 'mana', prod: 'qualquer', qtd: 1 }] }]),
  Clue: art('Clue', [{ custo: sacE({ mana: { g: 2 } }), fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }]),
  Food: art('Food', [{ custo: sacE({ mana: { g: 2 }, virar: true }), fx: [{ op: 'ganharVida', quem: 'voce', qtd: 3 }] }]),
  Blood: art('Blood', [{ custo: sacE({ mana: { g: 1 }, virar: true, descartar: 1 }), fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }]),
  Powerstone: art('Powerstone', [{ custo: { virar: true }, deMana: true, fx: [{ op: 'mana', prod: ['C'], qtd: 1, so: { tipo: ['Artifact'] } }] }]),
  Map: art('Map', [{ custo: sacE({ mana: { g: 1 }, virar: true }), vel: 'feitico', alvos: [{ f: { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }], fx: [{ op: 'explorar', em: { alvo: 0 } }] }]),
  Junk: art('Junk', [{ custo: sacE({ virar: true }), vel: 'feitico', fx: [{ op: 'exilarTopoJogar', quem: 'voce', qtd: 1 }] }]),
  Lander: art('Lander', [{ custo: sacE({ mana: { g: 2 }, virar: true }), fx: [{ op: 'buscar', f: { tipo: ['Land'], super: ['Basic'] }, para: 'campo', virada: true }, { op: 'embaralhar', quem: 'voce' }] }]),
  Shard: { tipos: ['Enchantment'], sub: ['Shard'], cores: '', vm: 0, atv: [{ custo: sacE({ mana: { g: 2 } }), fx: [{ op: 'videncia', quem: 'voce', qtd: 1 }, { op: 'comprar', quem: 'voce', qtd: 1 }] }] },
};
M.fichaDe = tok => {
  if (!tok || !tok.nome) return tok;
  const { nome, ...resto } = tok, pre = M.FICHAS[nome];
  return pre ? { ...pre, ...resto, n: nome } : { ...resto, n: nome };
};
function criarFicha(e, j, tok0, { virada = false }: any = {}) {
  const id = e.prox++, tok = M.fichaDe(tok0);
  const n = tok.n || ((tok.sub || []).join(' ') + ' Token').trim();
  const o = { id, n, dono: j, ctrl: j, zona: 'campo', ts: ++e.ts, tEntrou: e.turno.n, virada, dano: 0, marc: {} as any, doente: true, cmd: false, ficha: { ...tok, n } };
  e.objs[id] = o; e.campo.push(id);
  M.campoEntra(e, id);
  if (tok.leal) o.marc.lealdade = tok.leal;
  if (M.evento) M.evento(e, { ev: 'zona', id, de: null, para: 'campo' });
  return o;
}
M.criarFicha = criarFicha;
// ficha cópia (CR 707.2, 111.4): os valores copiáveis = o dado impresso (a face de cima), sem marcadores nem camadas;
// o que o token trouxer além do copiaDe vale por cima (707.9b). Fonte que saiu: o objeto guarda o nome e a face.
function copiaDe(e, token, ctx) {
  const { copiaDe: de, ...resto } = token;
  const src = de === 'doEvento' ? ctx.ev && e.objs[ctx.ev.id] : de === 'este' ? e.objs[ctx.este] : objsDe(e, { em: de }, ctx)[0];
  if (!src || src.hab) return null;
  const { faces, forma, ...base } = M.dadoBase(e, src);
  return { ...base, ...resto, n: src.n };
}
M.danoEm = (e, o, q, fd) => danoEm(e, o, q, fd);
function danoEm(e, alvoObj, q, fonte) {
  if (M.temTipo(e, alvoObj, 'Planeswalker')) alvoObj.marc.lealdade = (alvoObj.marc.lealdade || 0) - q;   // CR 120.3c
  if (M.temTipo(e, alvoObj, 'Creature')) { if (M.temInfectar(fonte.kw)) alvoObj.marc['-1/-1'] = (alvoObj.marc['-1/-1'] || 0) + q; else alvoObj.dano += q; if ((fonte.kw || []).some(k => k.k === 'toqueMortifero')) alvoObj.mortal = true; }   // 120.3e (infectar: −1/−1, 702.90c), 702.2b
  if (M.temTipo(e, alvoObj, 'Battle')) alvoObj.marc.defesa = (alvoObj.marc.defesa || 0) - q;                // CR 120.3h
}

// ---------- os efeitos ----------
const H = {
  comprar: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) M.comprar(e, j, q); } },
  dano: {
    campos: ['fonte'],
    ok: f => f.fonte === undefined || f.fonte === 'doEvento' || (!!f.fonte && typeof f.fonte === 'object' && Number.isInteger(f.fonte.alvo) && Object.keys(f.fonte).length === 1),
    fx(e, f, ctx) {                                                 // CR 120
      let q = qtdDe(e, f.qtd, ctx); if (q <= 0) return;
      // dividir 'igual' (Fireball): cada alvo leva o piso de X ÷ alvos escolhidos ao conjurar (CR 601.2d); o que
      // ficou ilegal não devolve a parte aos outros (CR 608.2b)
      const ia = f.em && typeof f.em.alvo === 'number' ? f.em.alvo : -1, def = ia >= 0 && (ctx.defAlvos || [])[ia];
      if (def && def.dividir === 'igual') q = Math.floor(q / Math.max(1, (ctx.alvos[ia] || []).length));
      if (q <= 0) return;
      const it = e.objs[ctx.item];
      const fonte = f.fonte === undefined ? { kw: fonteDado(e, ctx).kw, ctrl: ctx.voce, o: it && !it.hab ? it : e.objs[ctx.este] } : fonteOutra(e, f.fonte, ctx);
      if (!fonte) return;
      let total = 0;
      const parte = (o, jg?) => { const v = M.parteDividida(ctx, f, o, jg); return v === null ? q : v; };   // dividir à escolha (601.2d)
      for (const o of objsDe(e, f, ctx)) { const v = M.substDano(e, parte(o), { fonte: fonte.o, o }); if (v > 0) { danoEm(e, o, v, fonte); total += v; } }   // 615, 614.1a
      const js = f.em && typeof f.em.alvo === 'number' ? jogsAlvo(e, f.em.alvo, ctx) : [];
      const jq = f.quem ? jogsDe(e, f, ctx) : [];
      for (const j of [...new Set([...js, ...jq])]) { const v = M.substDano(e, js.includes(j) ? parte(null, j) : q, { fonte: fonte.o, jog: j }); if (v <= 0 || M.protegeJog(e, j)) continue; M.danoJogador(e, j, v, fonte.kw); total += v; }   // CR 120.3a (infectar: veneno, 702.90b); 702.16j; 119.7
      if (total && (fonte.kw || []).some(k => k.k === 'vinculoVida')) M.ganharVida(e, fonte.ctrl, total);   // CR 702.15b: quem controla a fonte
    },
  },
  // "X ganha +N/+N e/ou palavra-chave até o fim do turno" (CR 611.2): números e conjunto afetado presos na resolução
  // (611.2c: quem entrar depois não ganha); vale enquanto o mesmo objeto estiver no campo; a limpeza tira (514.2).
  // Por ora só 'fimDoTurno' e P/R/palavra-chave sem parâmetro; habilidade, tipo e estática dadas = próxima volta.
  // est: estáticas dadas até o fim do turno; por ora só deveBloquear afeta 'este' (509.1c), com atacante 'doEvento' =
  // bloqueia aquela criatura (presa na resolução: Fighter Class, Tolsimir); sem ele, bloqueia se puder (Brutal Hordechief)
  modificar: {
    campos: ['p', 'r', 'kw', 'dura', 'est', 'habil', 'gat'],
    qtd: q => q === undefined,
    ok: f => f.dura === 'enquantoNoCampo' ? ganhoOk(f) && f.gat === undefined : f.habil === undefined && (f.dura === 'fimDoTurno' || (f.dura === 'sempre' && !(f.est || []).length && f.gat === undefined)) && f.em !== undefined && (f.p !== undefined || f.r !== undefined || (f.kw || []).length > 0 || (f.est || []).length > 0 || (f.gat || []).length > 0)
      && (f.gat === undefined || (Array.isArray(f.gat) && f.gat.every(g => M.gatOk(g))))   // "ganha 'quando morrer, …'" até o fim do turno (Demonic Gifts)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw)
      && (f.est || []).every(s => s.afeta === 'este' && (s.modo === 'deveBloquear' ? Object.keys(s).every(k => ['modo', 'afeta', 'atacante'].includes(k)) && (s.atacante === undefined || s.atacante === 'doEvento')
        : EST_REGRA.includes(s.modo) && Object.keys(s).every(k => ['modo', 'afeta'].includes(k)))),
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      if (f.dura === 'enquantoNoCampo') {                            // habilidade ganha enquanto no campo (o mover zera o.ganhos)
        for (const o of os) o.ganhos = { atv: [...((o.ganhos && o.ganhos.atv) || []), ...f.habil.atv] };
        return;
      }
      const n = q => q === undefined ? 0 : typeof q === 'number' ? q : qtdDe(e, q, ctx);   // número direto: −4/−4 não vira 0
      const p = n(f.p), r = n(f.r);
      const ev = ctx.ev, at = ev && e.objs[ev.id];
      if ((f.gat || []).length) { for (const o of os) o.ganhos = { ...(o.ganhos || {}), gat: [...((o.ganhos && o.ganhos.gat) || []), ...f.gat] }; e.vCamada = (e.vCamada || 0) + 1; }   // sai na limpeza (514.2) ou ao mudar de zona
      const regra = (f.est || []).filter(s => EST_REGRA.includes(s.modo));   // "não pode ser bloqueada até o fim do turno": e.efTemp com os objetos presos (611.2c)
      if (regra.length) (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: regra.map(s => ({ modo: s.modo })), este: null, ids: os.map(o => ({ id: o.id, ts: o.ts })), fim: 'turno', ts: ++e.ts });
      const est = (f.est || []).filter(s => s.modo === 'deveBloquear').map(s => ({ modo: s.modo, atk: s.atacante === 'doEvento' ? (at && at.zona === 'campo' ? { id: at.id, ts: at.ts } : { id: -1, ts: -1 }) : null }));
      if (f.p === undefined && f.r === undefined && !(f.kw || []).length && !est.length) return;
      (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p, r, kw: f.kw || [], ...(est.length ? { est } : {}), ...(f.dura === 'sempre' ? { sempre: true } : {}), ts: ++e.ts });
    },
  },
  // estáticas de regra que valem até o fim do turno ou até o próximo turno de quem fez (CR 611.2b): e.efTemp (estado.ts)
  efeitoTemporario: {
    campos: ['dura', 'est'],
    qtd: q => q === undefined,
    ok: f => (f.quem === undefined || f.quem === 'voce') && (f.dura === 'fimDoTurno' || f.dura === 'proximoTurnoSeu')
      && (f.em === undefined || f.em === 'este' || (f.em && typeof f.em.alvo === 'number')) && (f.est || []).length > 0 && f.est.every(s => tempEstOk(s, f)),
    fx(e, f, ctx) {
      const F = e.objs[ctx.este], este = F && F.zona === 'campo' && (!ctx.lki.este || F.ts === ctx.lki.este.ts) ? { id: F.id, ts: F.ts } : null;
      const ids = f.em === undefined ? null : objsDe(e, f, ctx).map(o => ({ id: o.id, ts: o.ts }));
      if (ids && !ids.length) return;                                // alvo ilegal: nada a afetar (608.2b)
      (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: f.est, este, ids, fim: f.dura === 'fimDoTurno' ? 'turno' : ctx.voce, ts: ++e.ts });
    },
  },
  // CR 613.1d/613.4b: vira um P/R com tipos (camada 4 e 7b), "além dos outros tipos". Preso ao objeto (o.anim, mesmo ts);
  // fimDoTurno sai na limpeza (514.2). Os números são lidos na resolução (611.2c). Lido no M.dadoDe (estado.ts).
  animar: {
    campos: ['p', 'r', 'tipos', 'sub', 'kw', 'cores', 'dura'],
    qtd: q => q === undefined,
    ok: f => f.em !== undefined && (f.dura === 'fimDoTurno' || f.dura === 'sempre') && (f.p === undefined) === (f.r === undefined)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw)
      && (f.p !== undefined || (f.tipos || []).length > 0 || (f.kw || []).length > 0),
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      const n = q => typeof q === 'number' ? q : qtdDe(e, q, ctx);
      const pt = f.p !== undefined ? [n(f.p), n(f.r)] : undefined;
      for (const o of os) {
        (o.anim || (o.anim = [])).push({ ts: o.ts, tipos: f.tipos, sub: f.sub, pt, kw: f.kw, cores: f.cores, fim: f.dura === 'fimDoTurno' ? 'turno' : null });
        M.log(e, o.n, 'vira', [pt ? pt.join('/') : '', ...(f.sub || []), ...(f.tipos || [])].filter(Boolean).join(' '));
      }
      e.vCamada = (e.vCamada || 0) + 1;
    },
  },
  // jogar/conjurar uma carta de outra zona (CR 601.2, 305.1). Com dura: permissão (e.permJogar, por objeto e ts) que
  // vale com a velocidade normal até o fim do turno / até o seu próximo turno / enquanto estiver lá; o mover acaba com
  // ela (ts novo). Sem dura: conjura agora, no meio da resolução, sem olhar a velocidade (608.2g; como a loucura),
  // uma carta por vez e na ordem que escolher; terreno "agora" fica de fora. gratis: sem pagar o custo de mana (o
  // imposto do comandante é custo adicional e continua, 903.8; X = 0, 107.3b).
  jogar: {
    campos: ['dura', 'soConjurar', 'gratis', 'f'],
    qtd: q => q === undefined || typeof q === 'number',
    ok: f => (f.em !== undefined) !== (f.f !== undefined) && [undefined, 'fimDoTurno', 'proximoTurnoSeu', 'sempre'].includes(f.dura)
      && (f.em === undefined || f.em === 'anterior' || (f.em.todos && M.filtroOk(f.em.todos)) || typeof f.em.alvo === 'number') && !(f.f && f.dura),
    fx(e, f, ctx, ask) {
      const j = ctx.voce;
      const cand = () => f.f ? M.objetosQue(e, { ...f.f, zona: f.f.zona || 'mao' }, ctx) : objsDeQualquer(e, f, ctx);
      if (f.dura) {
        const fim = f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'proximoTurnoSeu' ? j : null;
        for (const o of cand()) (e.permJogar || (e.permJogar = [])).push({ j, id: o.id, ts: o.ts, gratis: !!f.gratis, soConjurar: !!f.soConjurar, fim });
        return;
      }
      const feitos = ctx.jogo || (ctx.jogo = new Map()), max = typeof f.qtd === 'number' ? f.qtd : f.f ? 1 : Infinity;
      for (;;) {
        const n = feitos.get(f) || 0; if (n >= max) return;
        const ops: any[] = cand().filter(o => !M.temTipo(e, o, 'Land') && M.podeConjurar(e, j, o, undefined, { agora: true, gratis: !!f.gratis })).map(o => ({ a: 'jogar', id: o.id }));
        if (!ops.length) return;
        if (f.talvez || ops.length > 1 || f.f) ops.push({ a: 'nenhum' });
        const r = ask(j, 'jogar', ops, { gratis: !!f.gratis });
        if (r.a === 'nenhum') return;
        const P0 = e.proc;
        M.PROC.conjurar(e, { j, id: r.id, agora: true, gratis: !!f.gratis, resp: [] }, ask);
        e.proc = P0;
        feitos.set(f, n + 1);
        ask.etapa();                                                // o conjurar mexeu no estado: a próxima pergunta começa do zero
      }
    },
    talvezDentro: true,
  },
  // CR 716.2a: a Classe sobe para o nível n (a habilidade de nível resolveu). O dado passa a ter as habilidades do
  // nível (estado.ts comNivel); vCamada refaz os índices de gatilho/estática; ev 'nivel' = "quando vira nível N".
  subirNivel: {
    campos: ['n'],
    ok: f => Number.isInteger(f.n) && f.n >= 2 && f.em === undefined,
    fx(e, f, ctx) {
      const E = e.objs[ctx.este]; if (!E || E.zona !== 'campo' || (E.nivel || 1) >= f.n) return;
      E.nivel = f.n; e.vCamada = (e.vCamada || 0) + 1;
      M.log(e, E.n, 'sobe para o nível', f.n);
      M.evento(e, { ev: 'nivel', id: E.id, ts: E.ts, n: f.n });
    },
  },
  // CR 701.14: lutar. Cada uma causa dano igual ao seu poder na outra, ao mesmo tempo; se uma não está no campo
  // ou não é criatura, ninguém causa dano (701.14b). Toque mortífero e vínculo vêm de cada uma (702.2b, 702.15b).
  lutar: {
    campos: ['com'],
    ok: f => f.em !== undefined && f.com !== undefined && emOk(f.com),
    fx(e, f, ctx) {
      const A = objsDe(e, f, ctx)[0], B = objsDe(e, { em: f.com }, ctx)[0];
      if (!A || !B || A.zona !== 'campo' || B.zona !== 'campo' || !M.temTipo(e, A, 'Creature') || !M.temTipo(e, B, 'Creature')) return;
      const pa = Math.max(0, M.poder(e, A)), pb = Math.max(0, M.poder(e, B));
      const fa = { kw: M.kwDe(e, A), ctrl: A.ctrl }, fb = { kw: M.kwDe(e, B), ctrl: B.ctrl };
      if (pa) danoEm(e, B, pa, fa);
      if (pb) danoEm(e, A, pb, fb);
      M.log(e, A.n, 'luta com', B.n, `(${pa} e ${pb})`);
      if (pa && fa.kw.some(k => k.k === 'vinculoVida')) M.ganharVida(e, A.ctrl, pa);
      if (pb && fb.kw.some(k => k.k === 'vinculoVida')) M.ganharVida(e, B.ctrl, pb);
    },
  },
  // CR 603.7: gatilho atrasado. Criado na resolução, dispara uma vez só (603.7c) na próxima vez que o evento acontecer
  // (nesteTurno: só neste turno; proximoTurno: só depois deste). Leva o que o efeito sabe: a fonte (este), as fichas
  // criadas e o lki; quem controla é quem o criou (603.7d). Disparo e fim: gatilhos.ts (M.evento) e turno.ts.
  gatilhoAtrasado: {
    campos: ['quando'],
    ok: f => M.atrasadoOk(f.quando),
    fx(e, f, ctx) {
      (e.atras || (e.atras = [])).push({ g: f.quando, ctrl: ctx.voce, fonte: ctx.este, n: (e.objs[ctx.este] || e.objs[ctx.item] || {}).n, t: e.turno.n,
        lki: (ctx.lki && ctx.lki.este) || (e.objs[ctx.este] && e.objs[ctx.este].zona === 'campo' ? M.lkiDe(e, e.objs[ctx.este]) : null), mem: { criadas: ctx.criadas || [], ...(M.alvosUsados(f.quando.fx).length ? { alvos: ctx.alvos, ilegal: ctx.ilegal } : {}) }, ts: ++e.ts });
    },
  },
  // "para cada oponente/jogador, …" (Acererak, Tempt with…): os efeitos de dentro valem para o jogador da vez (quem/ctrl/dono
  // 'cadaAtual'), na ordem do turno (101.4). Cada efeito de dentro é uma etapa: o progresso fica no ctx (ctx.rep) porque o
  // processo roda de novo a cada pergunta. Com filtro de objetos ("para cada criatura sua com marcador +1/+1", Kalonian Hydra,
  // Second Harvest): a lista é tirada ao começar a resolver (608.2h) e em/copiaDe 'cadaAtual' é o objeto da vez; o que saiu
  // do campo no meio fica de fora (400.7). repetirCada dentro de outro: ainda não.
  repetirCada: {
    campos: ['cada', 'fx'],
    ok: f => !dentroCada && !dentroObj && Array.isArray(f.fx) && f.fx.length > 0 && f.fx.every(x => x.op !== 'modal')
      && ((f.cada === 'cadaOponente' || f.cada === 'cadaJogador') ? comCada(() => M.fxSuportado(f.fx, { topo: false }))
        : !!f.cada && typeof f.cada === 'object' && M.filtroOk(f.cada) && comObj(() => M.fxSuportado(f.fx, { topo: false }))),
    fx(e, f, ctx, ask) {
      const obj = typeof f.cada === 'object';
      const R = ctx.rep || (ctx.rep = { f, js: obj ? M.objetosQue(e, f.cada.zona ? f.cada : { ...f.cada, zona: 'campo' }, ctx).map(o => ({ id: o.id, ts: o.ts })) : jogsDe(e, { quem: f.cada }, ctx), k: 0, i: 0 });
      while (R.k < R.js.length) {
        if (obj) ctx.cadaObj = R.js[R.k]; else ctx.cadaAtual = R.js[R.k];
        while (R.i < f.fx.length) {
          if (obj || !e.jogs[ctx.cadaAtual].saiu) M.executar(e, f.fx[R.i], ctx, ask);
          R.i++; if (ask && ask.etapa) ask.etapa();
          if (e.fim) break;
        }
        R.i = 0; R.k++;
        if (e.fim) break;
      }
      delete ctx.rep; delete ctx.cadaAtual; delete ctx.cadaObj;
    },
  },
  // resguardo (702.21a): o gatilho anula a mágica/habilidade que mirou, a menos que quem a controla pague
  resguardo: {
    campos: ['custo'],
    ok: () => false,                                                // só o gatilho que o motor cria (gatilhos.ts)
    fx(e, f, ctx, ask) {
      const P = ctx.ev && e.objs[ctx.ev.por]; if (!P || P.zona !== 'pilha') return;
      if (pagouParaImpedir(e, { op: 'resguardo', aMenosQue: { quem: 'doEvento', custo: f.custo } }, ctx, ask)) return;
      M.log(e, P.n, 'anulada pelo resguardo'); M.anular(e, P.id);
    },
  },
  fasear: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) M.fasearFora(e, o.id); } },   // CR 702.26
  destruir: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (!M.temKw(e, o, 'indestrutivel')) M.mover(e, o.id, 'cemiterio'); } },   // CR 701.8, 702.12b
  exilar: { fx(e, f, ctx) { const os = objsDe(e, f, ctx); for (const o of os) M.mover(e, o.id, 'exilio'); ctx.movidos = movidos(e, os.map(o => o.id)); } },
  mover: {
    campos: ['para', 'de', 'virada', 'f', 'fundo', 'sobControle', 'transformada', 'atacando'],
    qtd: q => qtdOk(q) || ateOk(q),
    ok: f => ['mao', 'campo', 'cemiterio', 'exilio', 'grimorio'].includes(f.para) && (f.em !== undefined || (f.f && (typeof f.qtd === 'number' || ateOk(f.qtd)))),
    fx(e, f, ctx, ask) {
      let ids;
      // em 'este' com de: a carta que acabou de ir para lá (o gatilho de mudar de zona acha o objeto novo, CR 603.6/400.7)
      if (f.em === 'este' && f.de) { const o = e.objs[ctx.este]; ids = o && o.zona === f.de && !o.hab ? [o.id] : []; }
      else if (f.em !== undefined) ids = objsDe(e, f, ctx).map(o => o.id);
      else {                                                        // "ponha N cartas da sua mão…" (Brainstorm)
        const j = jogsDe(e, f, ctx)[0]; if (j === undefined) return;
        const z = f.de || f.f.zona || 'mao';
        const cand = M.objetosQue(e, { ...f.f, zona: z, dono: f.f.dono || 'voce' }, { ...ctx, voce: j }).map(o => o.id);
        ids = escolherN(ask, j, 'escolherCarta', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length), { podeMenos: ateOk(f.qtd), ctx: { op: 'mover', para: f.para } });
      }
      // transformada (CR 712.14a): entra com a face de trás; carta que não é de transformar fica onde está
      if (f.transformada) ids = ids.filter(id => { const c = e.objs[id].ficha ? null : M.carta(e.objs[id].n); return f.para === 'campo' && c && c.forma === 'duplaFace' && c.faces; });
      ctx.resultado = ids.length;                                   // "then draw that many" (Valakut Awakening)
      if (f.talvez) ctx.pagou = ids.length > 0;                     // "se fizer": pôr ao menos uma
      const ent = f.para === 'campo' ? ids.map(id => M.decidirEntrada(e, id, f.sobControle === 'voce' ? ctx.voce : e.objs[id].dono, { virada: !!f.virada, ...(f.transformada ? { face: 0 } : {}) }, ask)) : [];
      // CR 508.4: entra atacando (sem declarar: não dispara "ataca"); quem controla escolhe quem ela ataca, entre os que poderia atacar
      const atk = f.atacando && e.turno.combate ? ent.map(p => M.escolherAtacado(e, p.ctrl, ask)) : [];
      if (f.para === 'campo') ent.forEach((p, k) => { const o = M.aplicarEntrada(e, p); if (atk[k]) M.porAtacando(e, o, atk[k]); });
      else for (const id of ids) M.mover(e, id, f.para, { topo: !f.fundo });
      ctx.movidos = movidos(e, ids);
    },
  },
  // mana na resolução (CR 106.3, fora de habilidade de mana: Path of the Pyromancer, Neheb, Birgi). prod com várias
  // cores = uma delas, à escolha; ficaNoTurno: não esvazia entre etapas e fases até o fim do turno (Neheb, Birgi)
  mana: {
    campos: ['prod', 'ficaNoTurno'],
    ok: f => f.prod !== undefined && !['refletida', 'deSeusTerrenos'].includes(f.prod),
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx); if (q <= 0) return;
      const F = e.objs[ctx.este] || { ctrl: ctx.voce, escolha: null };
      const cs = M.coresDeProd(e, { ...F, ctrl: ctx.voce }, f.prod); if (!cs || !cs.length) return;
      const c = cs.length === 1 ? cs[0] : ask(ctx.voce, 'escolha', cs.map(v => ({ a: 'cor', v })), { o: 'cor' }).v;
      const J = e.jogs[ctx.voce];
      J.reserva[c] += q;
      if (f.ficaNoTurno) { if (!J.fica || J.fica.t !== e.turno.n) J.fica = { t: e.turno.n, m: M.zeroMana() }; J.fica.m[c] += q; }
      M.log(e, J.nome, 'recebe', c.repeat(q));
    },
  },
  ganharVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) M.ganharVida(e, j, q); } },   // CR 119.3
  perderVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) if (!M.vidaFixa(e, j)) e.jogs[j].vida -= q; } },   // 119.7
  anular: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (o.zona === 'pilha') M.anular(e, o.id); } },   // CR 701.6
  ficha: {                                                          // CR 111
    campos: ['token', 'virada', 'atacando'],
    ok: f => (f.atacando === undefined || (f.atacando === true && f.virada === true)) && !f.token || f.token.copiaDe === undefined || f.token.copiaDe === 'doEvento' || f.token.copiaDe === 'este' || (f.token.copiaDe === 'cadaAtual' && dentroObj > 0) || (typeof f.token.copiaDe === 'object' && typeof f.token.copiaDe.alvo === 'number'),
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx); ctx.criadas = [];
      const tok = f.token && f.token.copiaDe !== undefined ? copiaDe(e, f.token, ctx) : f.token;
      if (!tok) return;
      for (const j of jogsDe(e, f, ctx)) for (const o of M.criarFichas(e, j, tok, q, { virada: !!f.virada })) {
        ctx.criadas.push({ id: o.id, ts: o.ts });
        // CR 508.4: "virada e atacando" — fora do combate só entra virada; no "para cada oponente", ataca aquele jogador
        if (f.atacando && e.turno.combate) { const t = M.escolherAtacado(e, o.ctrl, ask || ((_j, _t, ops) => ops[0]), ctx.cadaAtual); if (t) M.porAtacando(e, o, t); }
      }
    },
  },
  marcador: {                                                       // CR 122
    campos: ['tipoMarc', 'tirar'],
    fx(e, f, ctx) {
      const q = qtdDe(e, f.qtd, ctx);
      if (f.em === undefined && f.quem !== undefined) { for (const j of jogsDe(e, f, ctx)) M.marcadorJogador(e, j, f.tipoMarc, q, !!f.tirar); return; }   // no jogador (122.1: poison, rad, experience)
      for (const o of objsDe(e, f, ctx)) { const pd = M.parteDividida(ctx, f, o), q1 = pd === null ? q : pd; const t = f.tipoMarc; if (!f.tirar) { M.porMarcadores(e, o, t, q1); continue; } o.marc[t] = Math.max(0, (o.marc[t] || 0) - q1); }
    },
  },
  // naoDesvira: não desvira no próximo desvirar do controlador (Junk Winder); soNaoDesvira: só isso, sem virar (Fifty Feet of Rope)
  virar: {
    campos: ['naoDesvira', 'soNaoDesvira'],
    ok: f => !f.soNaoDesvira || f.naoDesvira === true,
    fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) { if (!f.soNaoDesvira) o.virada = true; if (f.naoDesvira) o.naoDesv = o.ts; } },
  },
  // CR 701.27: vira para a outra face. Não é objeto novo (701.27c): ts, marcadores, dano e virada ficam.
  // Só carta de dupla face (701.27d), nunca para uma face de instantânea/feitiço (701.27e), e a habilidade da própria
  // permanente só transforma se ela não transformou desde que a habilidade foi para a pilha (701.27g).
  transformar: {
    fx(e, f, ctx) {
      for (const o of objsDe(e, f, ctx)) {
        const c = o.ficha ? null : M.carta(o.n);
        if (!c || c.forma !== 'duplaFace' || !c.faces) continue;
        const nova = o.face == null ? 0 : null, dn = M.dadoFace(c, nova);
        if ((dn.tipos || []).some(t => t === 'Instant' || t === 'Sorcery')) continue;
        const L = ctx.lki && ctx.lki.este;
        if (f.em === 'este' && L && L.id === o.id && (L.transf || 0) !== (o.transf || 0)) continue;
        o.face = nova; o.transf = (o.transf || 0) + 1; e.vCamada = (e.vCamada || 0) + 1;
        M.log(e, o.n, 'transforma em', dn.n);
        M.evento(e, { ev: 'transforma', id: o.id });
      }
    },
  },
  desvirar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) o.virada = false; } },
  // CR 701.3: prende o Equipamento/Aura (em) ao objeto a. Equipamento só em criatura e nunca em si mesmo (301.5c);
  // Aura só no que o encantar permite (303.4a); preso ao mesmo objeto = nada acontece (701.3b).
  anexar: {
    campos: ['a'],
    ok: f => f.em !== undefined && emOk(f.a) && f.a !== undefined && (f.a === 'este' || typeof f.a.alvo === 'number'),
    fx(e, f, ctx) {
      const t = objsDe(e, { em: f.a }, ctx).find(o => o.zona === 'campo'); if (!t) return;
      for (const o of objsDe(e, f, ctx)) {
        if (o.zona !== 'campo' || o.id === t.id) continue;
        const d = M.dadoDe(e, o), sub = d.sub || [];
        if (sub.includes('Equipment')) { if (!M.temTipo(e, t, 'Creature') || M.temTipo(e, o, 'Creature')) continue; }
        else if (sub.includes('Aura')) { const k = (d.kw || []).find(x => x.k === 'encantar'); if (!k || !k.f || !M.bate(e, t, { ...k.f, zona: 'campo' }, ctx)) continue; }
        else continue;
        if (o.anexo && o.anexo.id === t.id && o.anexo.ts === t.ts) continue;
        o.anexo = { id: t.id, ts: t.ts }; e.vCamada = (e.vCamada || 0) + 1;
        M.log(e, o.n, 'anexado a', t.n);
      }
    },
  },
  // CR 701.9: quem descarta escolhe; {ate:N|'qualquer'} = "descarte quantas quiser". As descartadas ficam lembradas
  // (conta 'lembrados': "draw that many", Neheb, Path of the Pyromancer) e "se descartar" (se.pagou) = ao menos uma.
  descartar: {
    campos: ['aleatorio'],
    ok: f => f.aleatorio === undefined || (f.aleatorio === true && !ateOk(f.qtd)),
    qtd: q => q === undefined || typeof q === 'number' || q === 'maoInteira' || (ateOk(q) && q.ate !== 'X'),
    fx(e, f, ctx, ask) {
      const por: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const mao = e.jogs[j].zonas.mao;
        if (f.qtd === 'maoInteira') { por.push([j, mao.slice()]); continue; }
        if (f.aleatorio) {                                          // CR 701.9b: ao acaso, com o RNG da partida
          const l = mao.slice(); M.embaralhar(e, l); por.push([j, l.slice(0, Math.min(qtdDe(e, f.qtd, ctx), l.length))]); continue;
        }
        const ate = ateOk(f.qtd);
        por.push([j, escolherN(ask, j, 'descartar', mao, Math.min(ate ? qtdDe(e, f.qtd, ctx) : qtdDe(e, f.qtd, ctx), mao.length), { podeMenos: ate, ctx: { op: 'descartar' } })]);
      }
      const feitas: any[] = [];
      for (const [j, ids] of por) feitas.push(...M.descartar(e, j, ids, { ask, efeito: true }));
      ctx.lembrados = feitas; ctx.pagou = feitas.length > 0;
    },
  },
  // loucura (CR 702.35): o gatilho da carta exilada pela loucura. O dono pode conjurá-la pagando o custo de loucura
  // (na resolução, sem olhar a velocidade: 608.2g); se não conjurar, ela vai para o cemitério.
  loucura: {
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este], L = ctx.lki && ctx.lki.este;
      if (!o || o.zona !== 'exilio' || !o.loucura || (L && L.ts !== o.ts)) return;
      if (M.podeConjurar(e, o.dono, o, undefined, { loucura: true }) && ask(o.dono, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'loucura', id: o.id }).a === 'sim') {
        const P0 = e.proc;
        M.PROC.conjurar(e, { j: o.dono, id: o.id, loucura: true, resp: [] }, ask);   // as perguntas do conjurar entram nesta resolução
        e.proc = P0;
      }
      if (o.zona === 'exilio' && o.loucura) M.mover(e, o.id, 'cemiterio');
    },
  },
  moer: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) { const g = e.jogs[j].zonas.grimorio; for (let i = 0; i < q && g.length; i++) M.mover(e, g[g.length - 1], 'cemiterio'); } } },   // CR 701.13
  sacrificar: {                                                     // CR 701.21: quem sacrifica escolhe
    campos: ['f'],
    fx(e, f, ctx, ask) {
      const esc: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const cand = M.objetosQue(e, { ...(f.f || {}), ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
        esc.push(...escolherN(ask, j, 'sacrificar', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length)));
      }
      ctx.resultado = esc.length;                                   // "reveal … until X Zombies" (Empty the Laboratory)
      for (const id of esc) M.mover(e, id, 'cemiterio');
    },
  },
  embaralhar: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) M.embaralhar(e, e.jogs[j].zonas.grimorio); } },
  buscar: {                                                         // CR 701.19 (pode não achar: 701.19b)
    campos: ['f', 'para', 'revelar', 'virada', 'destinos'],
    qtd: q => qtdOk(q) || (ateOk(q) && q.ate !== 'X'),          // "any number of" (Ugin −11): {ate:'qualquer'}
    ok: f => ['mao', 'campo', 'cemiterio', 'grimorio', 'exilio', undefined].includes(f.para) && (!f.destinos || f.destinos.every(d => ['mao', 'campo', 'cemiterio', 'grimorio'].includes(d.para))),
    fx(e, f, ctx, ask) {
      const plano: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const cand = M.objetosQue(e, { ...f.f, zona: 'grimorio', dono: 'voce' }, { ...ctx, voce: j }).map(o => o.id);
        const pegou = escolherN(ask, j, 'buscar', cand, qtdDe(e, f.qtd, ctx), { podeMenos: true });
        if (f.destinos) {                                           // Cultivate: separa entre os destinos
          let resto = pegou.slice();
          for (const d of f.destinos) {
            const vai = resto.length <= (d.qtd || 1) ? resto.slice() : escolherN(ask, j, 'destino', resto, d.qtd || 1, { ctx: { para: d.para } });
            resto = resto.filter(id => !vai.includes(id));
            for (const id of vai) plano.push({ id, j, para: d.para, virada: !!d.virada });
          }
        } else for (const id of pegou) plano.push({ id, j, para: f.para || 'mao', virada: !!f.virada });
      }
      const ent = plano.map(p => p.para === 'campo' ? M.decidirEntrada(e, p.id, p.j, { virada: p.virada }, ask) : null);
      plano.forEach((p, k) => { if (ent[k]) M.aplicarEntrada(e, ent[k]); else M.mover(e, p.id, p.para); });
      ctx.movidos = movidos(e, plano.map(p => p.id));
    },
  },
  cavar: {                                                          // olhar/revelar do topo (CR 701.16 revelar), pegar o que bate, o resto vai para outra zona
    campos: ['olha', 'pega', 'f', 'para', 'resto', 'revelar', 'virada', 'fundo', 'destinos', 'ateAchar', 'sobControle'],
    talvezDentro: true,                                             // "you may put…": o resto vai para a zona dele mesmo se não pegar nada
    ok: f => {
      const Z = ['mao', 'campo', 'cemiterio', 'exilio'];
      if (f.ateAchar ? f.olha !== undefined || !M.filtroOk(f.ateAchar.f) || !qtdOk(f.ateAchar.qtd) || Object.keys(f.ateAchar).some(k => k !== 'f' && k !== 'qtd') : !qtdOk(f.olha) || f.olha === undefined) return false;
      if (!(f.pega === 'tudo' || Number.isInteger(f.pega) || (ateOk(f.pega) && Number.isInteger(f.pega.ate)))) return false;
      if (f.destinos ? !f.destinos.every(d => Z.includes(d.para) && Object.keys(d).every(k => ['para', 'qtd', 'virada'].includes(k))) || f.para !== undefined : f.pega !== 0 && !Z.includes(f.para)) return false;
      if (f.resto !== undefined && ![...Z, 'grimorio'].includes(f.resto)) return false;
      return f.sobControle === undefined || f.sobControle === 'voce';
    },
    fx(e, f, ctx, ask) {
      const plano: any[] = [], resto: any[] = [];
      let pegos = 0;
      for (const j of jogsDe(e, f, ctx)) {
        const g = e.jogs[j].zonas.grimorio, c2 = { ...ctx, voce: j };
        const bateEm = filt => new Set(M.objetosQue(e, { ...filt, zona: 'grimorio', dono: 'voce' }, c2).map(o => o.id));
        let vistos;                                                 // do topo para baixo
        if (f.ateAchar) {                                           // revela até achar qtd que batem (o grimório pode acabar antes)
          const q = qtdDe(e, f.ateAchar.qtd, ctx), b = bateEm(f.ateAchar.f);
          vistos = []; let ach = 0;
          for (let i = g.length - 1; i >= 0 && ach < q; i--) { vistos.push(g[i]); if (b.has(g[i])) ach++; }
        } else vistos = g.slice(-qtdDe(e, f.olha, ctx)).reverse();
        if (!vistos.length) continue;
        if (f.revelar) M.log(e, e.jogs[j].nome, 'revela', vistos.map(id => e.objs[id].n).join(', '));
        const b = f.f ? bateEm(f.f) : null;
        const cand = vistos.filter(id => !b || b.has(id));
        let sobra = cand.slice();
        const tira = ids => { sobra = sobra.filter(id => !ids.includes(id)); };
        if (f.destinos) {                                           // Expressive Iteration: 1 na mão, 1 no exílio, o resto no fundo
          for (const d of f.destinos) {
            const vai = escolherN(ask, j, 'destino', sobra, Math.min(d.qtd || 1, sobra.length), { podeMenos: !!f.talvez, ctx: { para: d.para } });
            tira(vai);
            for (const id of vai) plano.push({ id, j, para: d.para, virada: !!d.virada });
          }
        } else if (f.pega !== 0) {
          let vai;
          if (f.pega === 'tudo') vai = f.talvez && cand.length && ask(j, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'cavar' }).a === 'nao' ? [] : cand.slice();
          else { const n = typeof f.pega === 'number' ? f.pega : f.pega.ate; vai = escolherN(ask, j, 'cavar', cand, Math.min(n, cand.length), { podeMenos: !!f.talvez || typeof f.pega !== 'number', ctx: { para: f.para } }); }
          tira(vai);
          for (const id of vai) plano.push({ id, j, para: f.para, virada: !!f.virada });
        }
        const pegou = new Set(plano.filter(p => p.j === j).map(p => p.id));
        resto.push(...vistos.filter(id => !pegou.has(id)));
      }
      pegos = plano.length;
      const ent = plano.map(p => p.para === 'campo' ? M.decidirEntrada(e, p.id, f.sobControle === 'voce' ? ctx.voce : p.j, { virada: p.virada }, ask) : null);
      plano.forEach((p, k) => { if (ent[k]) M.aplicarEntrada(e, ent[k]); else M.mover(e, p.id, p.para); });
      ctx.movidos = movidos(e, plano.map(p => p.id));
      if (f.resto) {                                                // de volta ao topo: na mesma ordem (uma das ordens que a regra deixa)
        const r = f.resto === 'grimorio' && !f.fundo ? resto.slice().reverse() : resto;
        for (const id of r) M.mover(e, id, f.resto, { topo: !f.fundo });
      }
      ctx.resultado = pegos;
    },
  },
  videncia: {                                                       // CR 701.22: olha N, põe qualquer número no fundo
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx);
      const fundo: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const g = e.jogs[j].zonas.grimorio, topo = g.slice(-q).reverse();
        fundo.push(...topo.filter(id => ask(j, 'videncia', [{ a: 'topo', id }, { a: 'fundo', id }], {}).a === 'fundo'));
      }
      for (const id of fundo) M.mover(e, id, 'grimorio', { topo: false });
    },
  },
  proliferar: {                                                     // CR 701.34: escolhe quantos quiser (permanentes e
    fx(e, f, ctx, ask) {                                            // jogadores com marcador); +1 de cada tipo que já tem
      for (const j of jogsDe(e, f, ctx)) {
        const temMarc = o => Object.values<any>(o.marc).some(n => n > 0);
        const cand: any[] = e.campo.filter(id => temMarc(e.objs[id])).map(id => ({ a: 'proliferar', id }));
        for (const J of e.jogs) if (!J.saiu && J.veneno > 0) cand.push({ a: 'proliferar', jog: J.i });
        const esc: any[] = [];
        while (cand.length) {
          const x = ask(j, 'proliferar', [{ a: 'pronto' }, ...cand], {});
          if (x.a === 'pronto') break;
          esc.push(x); cand.splice(cand.indexOf(x), 1);
        }
        for (const x of esc) {
          if (x.jog !== undefined) { e.jogs[x.jog].veneno++; continue; }
          const o = e.objs[x.id];
          for (const t in o.marc) if (o.marc[t] > 0) { if (t === 'lore') M.porHistoria(e, o, 1); else o.marc[t]++; }
        }
        if (esc.length) M.log(e, e.jogs[j].nome, 'prolifera', esc.length);
      }
    },
  },
  fabricar: {                                                       // CR 702.123a: N marcadores +1/+1 nela, ou N Servos 1/1
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx), o = e.objs[ctx.este];
      const nela = o && o.zona === 'campo' && (!ctx.lki.este || o.ts === ctx.lki.este.ts);   // saiu: só as fichas
      const r = nela ? ask(ctx.voce, 'fabricar', [{ a: 'marcadores', q }, { a: 'fichas', q }], {}) : { a: 'fichas' };
      if (r.a === 'marcadores') { M.porMarcadores(e, o, '+1/+1', q); return; }
      M.criarFichas(e, ctx.voce, SERVO, q);
    },
  },
};
const SERVO = { n: 'Servo', tipos: ['Artifact', 'Creature'], sub: ['Servo'], pt: [1, 1], cores: '', vm: 0 };
M.EFEITOS = H;
