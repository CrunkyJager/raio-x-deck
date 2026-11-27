// src/motor/efeitos.ts (T43: migrado de motor2/efeitos.js) — efeitos do formato RX que o núcleo já executa na resolução (CR 608.2c–h) e o teste de suporte.
// O que não está aqui (ou tem campo que o handler não conhece) faz a carta/habilidade NÃO ser oferecida: melhor
// não jogar do que jogar errado em silêncio. Regra de cada handler: perguntar tudo antes de mexer no estado.
import { M } from './nucleo';

const BASE = new Set(['op', 'em', 'quem', 'qtd', 'se', 'talvez', 'aMenosQue', 'pagando']);
const QUEM_OK = new Set(['cadaOutroOponente', 'voce', 'cadaOponente', 'cadaJogador', 'alvoJogador', 'controlador', 'dono', 'doEvento', 'atacado', 'cadaAtual']);
// cadaAtual (o jogador da vez) só vale dentro de um repetirCada: fora dele seria um jogador que não existe
let dentroCada = 0, dentroObj = 0;
const comCada = fn => { dentroCada++; try { return fn(); } finally { dentroCada--; } };
// dentro de um repetirCada com filtro de objetos (Kalonian Hydra): em/copiaDe 'cadaAtual' = o objeto da vez
const comObj = fn => { dentroObj++; try { return fn(); } finally { dentroObj--; } };
const CONTA_OK = new Set(['poderDoAlvo', 'resistDoAlvo', 'vmDoAlvo', 'poderDoEste', 'resistDoEste', 'marcadoresNoEste',
  'cartasNaMao', 'cartasNoGrimorio', 'magiasNoTurno', 'oponentes', 'jogadores', 'suaVida', 'devocao', 'X', 'resultado', 'lembrados', 'evento', 'atacantes', 'atacantesEmVoce', 'ataquesNoTurno', 'danoCausado', 'vidaGanha', 'poderDoSacrificado', 'vmDoSacrificado', 'marcadoresNoCada', 'descartadasNoTurno', 'vidaDoAtual', 'coresDoEvento', 'vmDoEvento', 'marcadoresNoEvento', 'maiorDescarte', 'grimorioDoAlvo', 'vidaDoAlvo']);   // lembrados: as cartas descartadas pelo efeito anterior; evento: quantas o evento do gatilho juntou (descarta em grupo)   // resultado: quantos o efeito anterior moveu (Valakut Awakening)
const vidaEv = ev => ev.ev === 'ganhaVida' || ev.ev === 'perdeVida';
const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta', 'conjuradaCom', 'palavra', 'pagou', 'objBate', 'esteEm', 'temIniciativa', 'monarca', 'completouMasmorra', 'maisTerrenosOponente', 'modoEscolhido', 'primeiroCombate', 'fasePrincipal']);

// ---------- suporte (estático, olhando só o dado) ----------
// quem: {alvo: N} = o jogador escolhido no alvo N ("target player discards", Kolaghan's Command)
const quemAlvo = q => !!q && typeof q === 'object' && typeof q.alvo === 'number' && Object.keys(q).length === 1;
// {dado:N}: rola um dado de N lados (CR 706) com o RNG da partida; {ate:N|'X'|'qualquer'} ("up to") só onde o handler aceita
const dadoOk = q => !!q && typeof q === 'object' && Number.isInteger(q.dado) && q.dado >= 2 && Object.keys(q).length === 1;
const ateOk = q => !!q && typeof q === 'object' && Object.keys(q).length === 1 && (Number.isInteger(q.ate) || q.ate === 'X' || q.ate === 'qualquer');
const qtdOk = q => q === undefined || typeof q === 'number' || q === 'X' || dadoOk(q)
  || (q && typeof q === 'object' && (typeof q.conta === 'string' ? CONTA_OK.has(q.conta) : M.filtroOk(q.conta))
    && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'alvo', 'prop', 'de', 'divCima'].includes(k)) && (q.divCima === undefined || (Number.isInteger(q.divCima) && q.divCima > 1)) && (q.conta !== 'vidaDoAtual' || dentroCada > 0) && (q.de === undefined || ((q.conta === 'marcadoresNoEste' || q.conta === 'marcadoresNoCada' || q.conta === 'devocao') && typeof q.de === 'string')) && (q.conta !== 'marcadoresNoCada' || dentroObj > 0) && (q.conta !== 'devocao' || /^[WUBRG]+$/.test(q.de || '')) && (q.prop === undefined || (M.PROP_EST.has(q.prop) && typeof q.conta === 'object')));
const emOk = v => v === undefined || v === 'este' || v === 'descartadaCusto' || (v === 'cadaAtual' && dentroObj > 0) || v === 'equipada' || v === 'doEvento' || v === 'criadas' || v === 'anterior' || (v && typeof v === 'object' && (typeof v.alvo === 'number' || (v.todos && M.filtroOk(v.todos))));
const seOk = se => !se || (Object.keys(se).every(k => COND_OK.has(k))
  && M.condValorOk(se) && (!se.objBate || (Object.keys(se.objBate).every(k => ['em', 'f', 'nao'].includes(k)) && se.objBate.em !== undefined && emOk(se.objBate.em) && M.filtroOk(se.objBate.f || {}))) && (!se.existe || M.filtroOk(se.existe.f)) && (!se.controla || M.filtroOk(se.controla.f)) && (!se.conta || (qtdOk(se.conta.q) && ['min', 'max', 'igual'].every(k => se.conta[k] === undefined || typeof se.conta[k] === 'number' || qtdOk(se.conta[k]))))
  && (!se.esteEm || (Array.isArray(se.esteEm) && se.esteEm.length > 0 && se.esteEm.every(z => ['campo', 'cemiterio', 'exilio', 'mao', 'comando', 'grimorio'].includes(z)))));
M.seOk = seOk;
// modos que a carta oferece ao entrar = os valores de se.modoEscolhido nas habilidades dela, na ordem em que aparecem
M.modosDe = d => { const l: string[] = []; const ver = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(ver); return; } for (const [k, v] of Object.entries<any>(x)) { if (k === 'modoEscolhido' && typeof v === 'string' && !l.includes(v)) l.push(v); else ver(v); } }; ver([d.gat, d.est, d.atv]); return l; };
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
    || (!!s.emVez && s.emVez.every(f => f.op === 'escolher' && (f.o === 'cor' || f.o === 'tipoCriatura' || f.o === 'modo'))),
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
    && Object.keys(s).every(k => ['ev', 'quem', 'jog', 'por', 'combate', 'muda', 'se'].includes(k)) && (!s.por || M.filtroOk(s.por)) && (!s.jog || s.jog === 'voce' || s.jog === 'oponente' || s.jog === 'doEvento'),
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
  // efeitoTemporario com substituição (Spore Frog, Riot Control, Selfless Squire): vale mesmo que a fonte já tenha saído
  // (611.2b); o "você" é quem resolveu o efeito
  for (const t of e.efTemp || []) for (const s of t.subst || []) if (tipoSubst(s) === tipo) r.push({ F: { id: t.este ? t.este.id : -1, ctrl: t.ctrl }, s });
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
  if (M.evento) M.evento(e, { ev: 'marcadorPosto', id: o.id, ts: o.ts, t, n: q });   // "sempre que um ou mais marcadores forem postos" (122.6; um evento por objeto)
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
M.danoNaoPrevenivel = e => !!(e.efTemp && e.efTemp.length) && e.efTemp.some(t => t.est.some(s => s.modo === 'danoNaoPrevenivel'));
M.substDano = (e, q, { fonte, combate = false, jog, o }: any) => {
  if (!(q > 0)) return 0;
  const lista = substsDe(e, 'dano').filter(({ F, s }) => {
    if (s.combate !== undefined && !!s.combate !== !!combate) return false;
    if (s._j !== undefined) {                                          // "esse jogador ou permanente que ele controla" (Lightning, Army of One)
      if (jog !== undefined ? jog !== s._j : !(o && o.ctrl === s._j)) return false;
    } else if (s.jog === 'doEvento') return false;                     // sem o jogador do evento fixado: não vale
    else if (s.jog !== undefined || s.quem !== undefined) {
      const okJ = s.jog !== undefined && jog !== undefined && (s.jog === 'voce' ? jog === F.ctrl : jog !== F.ctrl);
      const okO = s.quem !== undefined && o !== undefined && substQuem(e, F, s, o);
      if (!okJ && !okO) return false;
    }
    if (s.por && !(fonte && M.bate(e, fonte, s.por, { voce: F.ctrl, este: F.id }))) return false;
    return substSe(e, F, s);
  });
  if (lista.some(r => r.s.muda.prevenir) && !M.danoNaoPrevenivel(e)) return 0;   // Bonecrusher Giant: prevenir não vale (615.12)
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
  if (v === 'descartadaCusto') { const S = e.objs[ctx.este]; return ((S && S.descCusto) || []).map(c => e.objs[c.id]).filter((o, k) => o && o.ts === S.descCusto[k].ts); }   // a carta descartada para pagar o custo desta ("if the discarded card wasn't a land")
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
    case 'cadaOutroOponente': { const d = ctx.ev && ctx.ev.jog; return vivos.filter(j => j !== ctx.voce && j !== d); }   // "each other opponent": menos o que levou o dano (Kediss)
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
      case 'vidaDoAtual': v = ctx.cadaAtual !== undefined ? e.jogs[ctx.cadaAtual].vida : 0; break;   // repetirCada: a vida do jogador da vez (Dire Fleet Ravager)
      case 'cartasNaMao': v = e.jogs[ctx.voce].zonas.mao.length; break;
      case 'cartasNoGrimorio': v = e.jogs[ctx.voce].zonas.grimorio.length; break;
      case 'magiasNoTurno': v = M.magiasT(e, ctx); break;
      case 'oponentes': v = M.vivos(e).filter(j => j !== ctx.voce).length; break;
      case 'jogadores': v = M.vivos(e).length; break;
      case 'suaVida': v = e.jogs[ctx.voce].vida; break;
      case 'X': v = ctx.x || 0; break;
      case 'resultado': v = ctx.resultado || 0; break;
      case 'lembrados': v = (ctx.lembrados || []).length; break;
      // "the greatest number of cards a player discarded this way" (Windfall): das lembradas pelo descartar anterior, por dono
      case 'maiorDescarte': { const n = {}; for (const id of ctx.lembrados || []) { const o = e.objs[id]; if (o) n[o.dono] = (n[o.dono] || 0) + 1; } v = Math.max(0, ...Object.values<number>(n)); break; }
      // do jogador alvo N (Peer into the Abyss: "half the cards in their library / half their life, rounded up" com divCima 2)
      case 'grimorioDoAlvo': case 'vidaDoAlvo': { const jj = jogsAlvo(e, q.alvo || 0, ctx)[0];
        v = jj === undefined ? 0 : q.conta === 'vidaDoAlvo' ? e.jogs[jj].vida : e.jogs[jj].zonas.grimorio.length; break; }
      case 'marcadoresNoEvento': v = ctx.ev && ctx.ev.ev === 'marcadorPosto' ? ctx.ev.n || 0 : 0; break;   // "that many" (Shalai and Hallar)
      case 'evento': v = !ctx.ev ? 0 : vidaEv(ctx.ev) ? ctx.ev.q || 0 : ctx.ev.n ?? 1; break;   // no evento de vida: "that much" (Exquisite Blood, Prize Pig)
      case 'vidaGanha': v = ctx.ev && vidaEv(ctx.ev) ? ctx.ev.q || 0 : 0; break;               // "that much life" (Sanguine Bond, Vito)
      case 'danoCausado': v = ctx.ev && ctx.ev.ev === 'dano' ? ctx.ev.q || 0 : 0; break;   // "that much damage" (o dano do evento)
      case 'vmDoEvento': { const o = ctx.ev && e.objs[ctx.ev.id]; v = o ? M.dadoDe(e, o).vm || 0 : 0; break; }   // "that spell's mana value"
      case 'coresDoEvento': { const o = ctx.ev && e.objs[ctx.ev.id]; v = o ? new Set((M.dadoDe(e, o).cores || '').replace(/[^WUBRG]/g, '')).size : 0; break; }   // "for each of that spell's colors" (Ramos; 105.2)
      case 'poderDoSacrificado': v = (ctx.sac || []).reduce((s, l) => s + Math.max(0, l.poder), 0); break;   // custo adicional sacrificar (LKI, 608.2h)
      case 'vmDoSacrificado': v = (ctx.sac || []).reduce((s, l) => s + (l.vm || 0), 0); break;
      case 'atacantes': case 'atacantesEmVoce': case 'ataquesNoTurno': v = M.contaAtaque(e, q.conta, ctx.voce); break;
      default: throw new Error('conta sem suporte: ' + q.conta);
    }
    if (q.divCima) v = Math.ceil(v / q.divCima);                    // "a third of their life, rounded up"
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
const gatSempre = f => f.dura === 'sempre' && !!f.habil && Array.isArray(f.habil.gat);
// tipo/cor "além dos outros" e/ou disparada ganha para sempre; P/R e kw juntos só se a parte de P/R/kw sozinha passa
const modTipoOk = f => f.dura === 'sempre' && f.em !== undefined && f.gat === undefined && !(f.est || []).length
  && (f.sub === undefined || (Array.isArray(f.sub) && f.sub.length > 0 && f.sub.every(x => typeof x === 'string' && x !== 'escolhido')))
  && (f.cores === undefined || (typeof f.cores === 'string' && /^[WUBRG]+$/.test(f.cores)))
  && (f.habil === undefined || (gatSempre(f) && Object.keys(f.habil).length === 1 && f.habil.gat.length > 0 && f.habil.gat.every(g => M.gatOk(g))))
  && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw);
// estáticas de regra que o modificar entrega ao e.efTemp (lidas por M.tempNoObj em combate.ts)
const EST_REGRA = ['naoPodeSerBloqueada', 'naoPodeBloquear', 'deveAtacar'];
// estática dada por efeitoTemporario que algum leitor conhece (estado.ts: M.tempNoObj, M.vidaFixa, M.protegeJog)
function tempEstOk(s, f) {
  const ks = Object.keys(s), so = (...a) => ks.every(k => ['modo', 'afeta', ...a].includes(k));
  const objOk = s.afeta === 'este' || (s.afeta === undefined && f.em !== undefined) || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta));
  switch (s.modo) {
    case 'vidaNaoMuda': return s.afeta === 'voce' && so();
    case 'protecaoJogador': return s.afeta === 'voce' && so('kw', 'de') && (s.de === 'tudo' || (s.kw || []).length === 1 && ((s.kw[0].k === 'protecao' && s.kw[0].de === 'tudo' && Object.keys(s.kw[0]).length === 2) || (s.kw[0].k === 'antimagia' && Object.keys(s.kw[0]).length === 1)));
    case 'naoPodeSerBloqueada': case 'naoPodeBloquear': case 'deveAtacar': return objOk && so();
    case 'terraExtra': return s.afeta === 'voce' && so('qtd') && Number.isInteger(s.qtd) && s.qtd > 0;               // lido em turno.ts
    case 'maoMax': return s.afeta === 'voce' && so('qtd') && (s.qtd === 'tudo' || Number.isInteger(s.qtd));
    case 'danoNaoPrevenivel': return s.afeta === 'cadaJogador' && so();                                             // efeitos.ts M.substDano
    case 'ptDefinido': return f.em === undefined && !!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta) && so('pBase', 'rBase')   // 7b (Sephiroth): e.temp.base
      && Number.isInteger(s.pBase) && Number.isInteger(s.rBase) && f.dura === 'fimDoTurno';
    case 'naoPodeConjurar': return s.afeta === 'voce' && so();                                                         // lido em pilha.ts (M.naoConjura)
    case 'conjurarComLampejo': return s.afeta === 'voce' && so('f') && (!s.f || M.filtroOk(s.f));                   // lido em pilha.ts (M.lampejoDado)
    case 'continuo': return f.em === undefined && !!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)        // emblema do Sorin: lido nas camadas (estado.ts)
      && (((s.afeta.zona === undefined || s.afeta.zona === 'campo') && M.estContOk(s) && !s.habil)
        || (s.afeta.zona === 'cemiterio' && so('kw') && (s.kw || []).length === 1 && s.kw[0].k === 'flashback'));   // Past in Flames: lido no flashDe (pilha.ts)
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
    else if (c.vida) M.perderVida(e, j, c.vida);                                                      // CR 119.4
    else if (c.sacrificar === 'este') M.mover(e, ctx.este, 'cemiterio', { sac: true });
    else {
      const sac: any[] = [];
      for (let i = 0; i < (c.sacrificar.qtd || 1); i++) {
        const cand = M.objetosQue(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: ctx.este }).filter(o => !sac.includes(o.id));
        sac.push(ask(j, 'custo', cand.map(o => ({ a: 'sacrificar', id: o.id })), { o: 'sacrificar' }).id);
      }
      for (const id of sac) M.mover(e, id, 'cemiterio', { sac: true });
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
        } else if (fz.o === 'modo') {             // "As this enters, choose X or Y" (Mirrodin Besieged, Sieges): os modos são os nomes que as habilidades leem
          ops = M.modosDe(d).map(v => ({ a: 'modo', v }));
          if (!ops.length) continue;
        } else continue;
        const r = ask(ctrl, 'escolha', ops, { id, o: fz.o });
        escolha = fz.o === 'cor' ? { cor: r.v } : fz.o === 'modo' ? { modo: r.v } : { tipo: r.v };
        break;
      }
    }
  }
  return { id, ctrl, vir, pagaVida, escolha, face };
};
M.aplicarEntrada = (e, { id, ctrl, vir, pagaVida, escolha, face, conj = null, x = 0 }) => {
  if (pagaVida) M.perderVida(e, ctrl, pagaVida);
  const o = M.mover(e, id, 'campo', { virada: vir, face, conj });
  o.ctrl = ctrl; o.escolha = escolha; e.vCamada = (e.vCamada || 0) + 1;   // camadas: refaz as fontes (estado.ts)
  entraComMarcadores(e, o, x);                                       // 614.1c: já entra com eles (antes das ABE)
  M.log(e, e.jogs[ctrl].nome, 'põe no campo', o.n, vir ? '(virado)' : '');
  return o;
};

// escolher n objetos de uma lista, um por pergunta (pode parar antes se 'podeMenos')
M.escolherN = (...a) => (escolherN as any)(...a);
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
// est oponentesNaoProcuram (Ashiok, Dream Render): mágica/habilidade de um oponente de quem controla não faz o próprio controlador procurar
M.procuraBloqueada = (e, j) => e.campo.some(id => { const F = e.objs[id]; return F.ctrl !== j && (M.dadoDe(e, F).est || []).some(s => s.modo === 'oponentesNaoProcuram'); });
M.danoEm = (e, o, q, fd) => danoEm(e, o, q, fd);
function danoEm(e, alvoObj, q, fonte) {
  if (M.temTipo(e, alvoObj, 'Planeswalker')) alvoObj.marc.lealdade = (alvoObj.marc.lealdade || 0) - q;   // CR 120.3c
  if (M.temTipo(e, alvoObj, 'Creature')) { if (M.temInfectar(fonte.kw)) alvoObj.marc['-1/-1'] = (alvoObj.marc['-1/-1'] || 0) + q; else alvoObj.dano += q; if ((fonte.kw || []).some(k => k.k === 'toqueMortifero')) alvoObj.mortal = true; }   // 120.3e (infectar: −1/−1, 702.90c), 702.2b
  if (M.temTipo(e, alvoObj, 'Battle')) alvoObj.marc.defesa = (alvoObj.marc.defesa || 0) - q;                // CR 120.3h
  if (fonte.o && q > 0) (alvoObj.feridaPor || (alvoObj.feridaPor = [])).push({ id: fonte.o.id, ts: fonte.o.ts, t: e.turno.n });   // "dealt damage by this creature this turn" (Markov Enforcer)
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
      let total = 0; const evs: any[] = [];
      const parte = (o, jg?) => { const v = M.parteDividida(ctx, f, o, jg); return v === null ? q : v; };   // dividir à escolha (601.2d)
      for (const o of objsDe(e, f, ctx)) { const v = M.substDano(e, parte(o), { fonte: fonte.o, o }); if (v > 0) { danoEm(e, o, v, fonte); total += v; evs.push({ o: o.id, q: v }); } }   // 615, 614.1a
      const js = f.em && typeof f.em.alvo === 'number' ? jogsAlvo(e, f.em.alvo, ctx) : [];
      const jq = f.quem ? jogsDe(e, f, ctx) : [];
      for (const j of [...new Set([...js, ...jq])]) { const v = M.substDano(e, js.includes(j) ? parte(null, j) : q, { fonte: fonte.o, jog: j }); if (v <= 0 || M.protegeJog(e, j)) continue; M.danoJogador(e, j, v, fonte.kw); total += v; evs.push({ jog: j, q: v }); }   // CR 120.3a (infectar: veneno, 702.90b); 702.16j; 119.7
      if (total && (fonte.kw || []).some(k => k.k === 'vinculoVida')) M.ganharVida(e, fonte.ctrl, total);   // CR 702.15b: quem controla a fonte
      if (M.evento) for (const x of evs) M.evento(e, { ev: 'dano', fonte: fonte.o ? fonte.o.id : -1, combate: false, ...x });   // 120.3: dano fora do combate também é evento (enrage, Sanguine Bond é perda de vida)
    },
  },
  // "X ganha +N/+N e/ou palavra-chave até o fim do turno" (CR 611.2): números e conjunto afetado presos na resolução
  // (611.2c: quem entrar depois não ganha); vale enquanto o mesmo objeto estiver no campo; a limpeza tira (514.2).
  // Por ora só 'fimDoTurno' e P/R/palavra-chave sem parâmetro; habilidade, tipo e estática dadas = próxima volta.
  // est: estáticas dadas até o fim do turno; por ora só deveBloquear afeta 'este' (509.1c), com atacante 'doEvento' =
  // bloqueia aquela criatura (presa na resolução: Fighter Class, Tolsimir); sem ele, bloqueia se puder (Brutal Hordechief)
  // sub/cores: "it's a black Zombie / becomes a Demon in addition to its other colors and types" (camadas 4 e 5,
  // o.anim preso ao objeto, sem prazo: 611.2a). habil.gat com dura 'sempre': habilidade disparada ganha enquanto o
  // objeto estiver no campo (o.ganhos.gatS; o mover zera) — Rivaz, Clavileño.
  modificar: {
    campos: ['p', 'r', 'kw', 'dura', 'est', 'habil', 'gat', 'sub', 'cores'],
    qtd: q => q === undefined,
    ok: f => f.sub !== undefined || f.cores !== undefined || gatSempre(f) ? modTipoOk(f) : (f.dura === 'enquantoNoCampo' && f.habil !== undefined ? ganhoOk(f) && f.gat === undefined : f.habil === undefined && (f.dura === 'fimDoTurno' || (['sempre', 'proximoTurnoSeu', 'enquantoNoCampo'].includes(f.dura) && !(f.est || []).length && f.gat === undefined)) && f.em !== undefined && (f.p !== undefined || f.r !== undefined || (f.kw || []).length > 0 || (f.est || []).length > 0 || (f.gat || []).length > 0)
      && (f.gat === undefined || (Array.isArray(f.gat) && f.gat.every(g => M.gatOk(g))))   // "ganha 'quando morrer, …'" até o fim do turno (Demonic Gifts)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw)
      && (f.est || []).every(s => s.afeta === 'este' && (s.modo === 'deveBloquear' ? Object.keys(s).every(k => ['modo', 'afeta', 'atacante'].includes(k)) && (s.atacante === undefined || s.atacante === 'doEvento')
        : EST_REGRA.includes(s.modo) && Object.keys(s).every(k => ['modo', 'afeta'].includes(k))))),
    fx(e, f, ctx) {
      if (gatSempre(f) && f.em === 'doEvento' && ctx.ev) for (const o of [e.objs[ctx.ev.id]]) if (o && o.zona === 'pilha' && !o.hab && (ctx.ev.ts === undefined || o.ts === ctx.ev.ts)) o.gatPilha = [...(o.gatPilha || []), ...f.habil.gat];   // a mágica: a permanente que ela vira tem (Rivaz)
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      if (f.sub !== undefined || f.cores !== undefined || gatSempre(f)) {
        for (const o of os) {
          if (f.sub || f.cores) (o.anim || (o.anim = [])).push({ ts: o.ts, sub: f.sub, maisCores: f.cores, fim: null });
          if (gatSempre(f)) o.ganhos = { ...(o.ganhos || {}), gatS: [...((o.ganhos && o.ganhos.gatS) || []), ...f.habil.gat] };
        }
        e.vCamada = (e.vCamada || 0) + 1;
        if (f.p === undefined && f.r === undefined && !(f.kw || []).length) return;
      }
      if (f.dura === 'enquantoNoCampo' && f.habil) {                            // habilidade ganha enquanto no campo (o mover zera o.ganhos)
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
      (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p, r, kw: (f.kw || []).map(k => k.de === 'escolhido' && ctx.escolha && ctx.escolha.cor ? { ...k, de: ctx.escolha.cor } : k), ...(est.length ? { est } : {}), ...(f.dura !== 'fimDoTurno' ? { sempre: true } : {}), ...(f.dura === 'proximoTurnoSeu' ? { ate: ctx.voce } : {}), ts: ++e.ts });   // sempre/enquantoNoCampo: preso ao objeto (ts); até o seu próximo turno: sai no desvirar (masmorras.ts)
    },
  },
  // CR 613.1b / 800.4: ganhar o controle (camada 2, M.recalcCtrl em estado.ts). Sem dura = para sempre (611.2a).
  // enquantoNoCampo = "enquanto você controlar [a fonte]": se a fonte já saiu, não faz nada (611.2b).
  ganharControle: {
    campos: ['dura'],
    qtd: q => q === undefined,
    ok: f => (f.quem === undefined || f.quem === 'voce') && [undefined, 'sempre', 'fimDoTurno', 'enquantoNoCampo'].includes(f.dura)
      && !!f.em && (typeof f.em.alvo === 'number' || (!!f.em.todos && M.filtroOk(f.em.todos))),
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'), F = e.objs[ctx.este];
      const fonte = F && F.zona === 'campo' && F.ctrl === ctx.voce ? { id: F.id, ts: F.ts, j: ctx.voce } : null;
      if (!os.length || (f.dura === 'enquantoNoCampo' && !fonte)) return;
      for (const o of os) { if (o.ctrl0 === undefined) o.ctrl0 = o.ctrl; (e.ctrlEf || (e.ctrlEf = [])).push({ id: o.id, ts: o.ts, j: ctx.voce, fim: f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'enquantoNoCampo' ? fonte : 'nunca' }); }
      M.recalcCtrl(e);
    },
  },
  // estáticas de regra que valem até o fim do turno ou até o próximo turno de quem fez (CR 611.2b): e.efTemp (estado.ts)
  efeitoTemporario: {
    campos: ['dura', 'est', 'subst', 'emblema', 'gat'],
    qtd: q => q === undefined,
    ok: f => (f.quem === undefined || f.quem === 'voce') && (f.dura === 'fimDoTurno' || f.dura === 'proximoTurnoSeu' || f.dura === 'sempre')
      && (f.em === undefined || f.em === 'este' || (f.em && typeof f.em.alvo === 'number')) && ((f.est || []).length + (f.subst || []).length + (f.gat || []).length) > 0
      && (f.est || []).every(s => tempEstOk(s, f)) && (f.subst || []).every(s => tipoSubst(s) === 'dano' && M.substOk(s) && !(s.quem && s.quem.este))
      && (f.gat || []).every(g => f.em === undefined && M.gatOk(g) && !(g.quem && g.quem.este)),
    fx(e, f, ctx) {
      const F = e.objs[ctx.este], este = F && F.zona === 'campo' && (!ctx.lki.este || F.ts === ctx.lki.este.ts) ? { id: F.id, ts: F.ts } : null;
      const ids = f.em === undefined ? null : objsDe(e, f, ctx).map(o => ({ id: o.id, ts: o.ts }));
      if (ids && !ids.length) return;                                // alvo ilegal: nada a afetar (608.2b)
      // gat: habilidade disparada do emblema (114.4) ou "neste turno, sempre que…" (603.7a, Forth Eorlingas): M.evento (gatilhos.ts) a dispara sem objeto
      const D = F || e.objs[ctx.item], n = f.emblema ? 'Emblema (' + (D ? D.n : '?') + ')' : D ? D.n : '?';
      const subst = (f.subst || []).map(x => x.jog === 'doEvento' ? { ...x, _j: ctx.ev && ctx.ev.jog } : x).filter(x => !(x.jog === 'doEvento' && x._j === undefined));
      for (const s of (f.est || []).filter(x => x.modo === 'ptDefinido')) {   // 611.2c: o conjunto fica preso na resolução
        const os = M.objetosQue(e, { zona: 'campo', ...s.afeta }, ctx).filter(o => o.zona === 'campo');
        if (os.length) (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p: 0, r: 0, kw: [], base: [s.pBase, s.rBase], ts: ++e.ts });
      }
      if (!(f.est || []).some(x => x.modo !== 'ptDefinido') && !subst.length && !(f.gat || []).length) return;
      (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: (f.est || []).filter(x => x.modo !== 'ptDefinido'), subst, gat: f.gat || [], n, este, ids, fim: f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'sempre' ? 'nunca' : ctx.voce, ts: ++e.ts });   // 'sempre': resto da partida / emblema (114)
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
    ok: f => (f.em !== undefined) !== (f.f !== undefined) && [undefined, 'fimDoTurno', 'proximoTurnoSeu', 'proximoFinalSeu', 'sempre'].includes(f.dura)
      && (f.em === undefined || f.em === 'anterior' || (f.em.todos && M.filtroOk(f.em.todos)) || typeof f.em.alvo === 'number') && !(f.f && f.dura),
    fx(e, f, ctx, ask) {
      const j = ctx.voce;
      const cand = () => f.f ? M.objetosQue(e, { ...f.f, zona: f.f.zona || 'mao' }, ctx) : objsDeQualquer(e, f, ctx);
      if (f.dura) {
        const fim = f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'proximoTurnoSeu' ? j : f.dura === 'proximoFinalSeu' ? { final: j } : null;   // Inti: "until your next end step"
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
  // CR 701.57a descobrir N: exila do topo até uma não-terreno com valor de mana ≤ N; conjura de graça ou põe na mão
  // (701.57b: se não conjurar); as outras exiladas vão para o fundo em ordem aleatória. qtd: número ou conta.
  descobrir: {
    fx(e, f, ctx, ask) {
      const j = ctx.voce, J = e.jogs[j];
      // o exílio mexe no estado antes da pergunta: guarda o achado em ctx para a pergunta repetida não exilar de novo
      const feitos = ctx.desc || (ctx.desc = new Map());
      if (!feitos.has(f)) {
        const n = qtdDe(e, f.qtd, ctx), ex: number[] = [];
        let ach: any = null;
        while (J.zonas.grimorio.length) {
          const id = J.zonas.grimorio[J.zonas.grimorio.length - 1], o = e.objs[id];
          M.mover(e, id, 'exilio');
          if (!M.temTipo(e, o, 'Land') && (M.dadoDe(e, o).vm || 0) <= n) { ach = o; break; }
          ex.push(id);
        }
        M.embaralhar(e, ex);
        for (const id of ex) if (e.objs[id].zona === 'exilio') M.mover(e, id, 'grimorio', { topo: false });
        M.log(e, J.nome, 'descobre', n, ach ? '→ ' + ach.n : '(nada)', ex.length ? `(${ex.length} para o fundo)` : '');
        feitos.set(f, ach ? { id: ach.id, ts: ach.ts } : null);
      }
      const F0 = feitos.get(f), achou = F0 && e.objs[F0.id];
      if (!achou || achou.ts !== F0.ts || achou.zona !== 'exilio') return;
      const pode = M.podeConjurar(e, j, achou, undefined, { agora: true, gratis: true });
      const r = pode ? ask(j, 'jogar', [{ a: 'jogar', id: achou.id }, { a: 'mao', id: achou.id }], { gratis: true }) : { a: 'mao' };
      if (r.a === 'jogar') { const P0 = e.proc; M.PROC.conjurar(e, { j, id: achou.id, agora: true, gratis: true, resp: [] }, ask); e.proc = P0; ask.etapa(); }
      else M.mover(e, achou.id, 'mao');
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
      const fa = { kw: M.kwDe(e, A), ctrl: A.ctrl, o: A }, fb = { kw: M.kwDe(e, B), ctrl: B.ctrl, o: B };
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
        lki: (ctx.lki && ctx.lki.este) || (e.objs[ctx.este] && e.objs[ctx.este].zona === 'campo' ? M.lkiDe(e, e.objs[ctx.este]) : null), mem: { criadas: ctx.criadas || [], ...(M.alvosUsados(f.quando.fx).length ? { alvos: ctx.alvos, ilegal: ctx.ilegal } : {}), ...(JSON.stringify(f.quando.fx).includes('"anterior"') ? { movidos: (ctx.movidos || []).slice() } : {}) }, ts: ++e.ts });
    },
  },
  // CR 603.12: gatilho reflexo ("when you do, …"): criado na resolução, dispara na hora; vai à pilha da próxima vez que
  // alguém receberia prioridade, e os alvos dele são escolhidos só então (Inti: o alvo vem depois do descarte)
  reflexo: {
    campos: ['quando'],
    ok: f => !!f.quando && f.quando.ev === 'reflexo' && M.gatOk(f.quando),
    fx(e, f, ctx) {
      const F = e.objs[ctx.este] || {};
      e.pend.push({ fonte: ctx.este, ts: F.ts, ctrl: ctx.voce, k: 'reflexo', g: f.quando, n: F.n, face: F.face ?? null, ficha: F.ficha || null,
        lki: (ctx.lki && ctx.lki.este) || (F.zona === 'campo' ? M.lkiDe(e, F) : null), ev: { ev: 'reflexo', j: ctx.voce } });
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
  // semRegenerar ("can't be regenerated", 701.15c: Terminate, Putrefy): o escudo de regeneração não vale
  destruir: { campos: ['semRegenerar'], fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (!M.temKw(e, o, 'indestrutivel') && (f.semRegenerar || !M.regenera(e, o))) M.mover(e, o.id, 'cemiterio'); } },   // CR 701.8, 702.12b
  regenerar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (o.zona === 'campo') M.porRegen(e, o); } },   // CR 701.15a
  exilar: { fx(e, f, ctx) { const os = objsDe(e, f, ctx); for (const o of os) M.mover(e, o.id, 'exilio'); ctx.movidos = movidos(e, os.map(o => o.id)); } },
  mover: {
    campos: ['para', 'de', 'virada', 'f', 'fundo', 'sobControle', 'transformada', 'atacando', 'comEste'],
    qtd: q => qtdOk(q) || ateOk(q),
    ok: f => (['mao', 'campo', 'cemiterio', 'exilio', 'grimorio'].includes(f.para) || (f.para === 'comando' && f.em !== undefined)) && (f.em !== undefined || (f.f && (typeof f.qtd === 'number' || ateOk(f.qtd)))),
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
      if (f.para === 'comando') ids = ids.filter(id => e.objs[id].cmd);   // só comandante vai para a zona de comando (Hellkite Courser, 903)
      // transformada (CR 712.14a): entra com a face de trás; carta que não é de transformar fica onde está
      if (f.transformada) ids = ids.filter(id => { const c = e.objs[id].ficha ? null : M.carta(e.objs[id].n); return f.para === 'campo' && c && c.forma === 'duplaFace' && c.faces; });
      ctx.resultado = ids.length;                                   // "then draw that many" (Valakut Awakening)
      if (f.talvez) ctx.pagou = ids.length > 0;                     // "se fizer": pôr ao menos uma
      const ent = f.para === 'campo' ? ids.map(id => M.decidirEntrada(e, id, f.sobControle === 'voce' ? ctx.voce : e.objs[id].dono, { virada: !!f.virada, ...(f.transformada ? { face: 0 } : {}) }, ask)) : [];
      // CR 508.4: entra atacando (sem declarar: não dispara "ataca"); quem controla escolhe quem ela ataca, entre os que poderia atacar
      const atk = f.atacando && e.turno.combate ? ent.map(p => M.escolherAtacado(e, p.ctrl, ask)) : [];
      if (f.para === 'campo') ent.forEach((p, k) => { const o = M.aplicarEntrada(e, p); if (atk[k]) M.porAtacando(e, o, atk[k]); });
      else for (const id of ids) M.mover(e, id, f.para, { topo: !f.fundo });
      if (f.comEste && f.para === 'exilio') { const F = e.objs[ctx.este]; if (F) for (const id of ids) if (e.objs[id].zona === 'exilio') e.objs[id].exPor = { id: F.id, ts: (ctx.lki && ctx.lki.este && ctx.lki.este.ts) ?? F.ts }; }   // "exiled with this" (607.2a)
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
  ganharJogo: { fx(e, f, ctx) {                                     // CR 104.2b: o efeito diz que ele vence; no multijogador os outros perdem juntos (104.3h)
    if (e.fim) return;
    const j = jogsDe(e, f, ctx).find(x => !e.jogs[x].saiu);
    if (j === undefined) return;
    M.log(e, e.jogs[j].nome, 'vence o jogo por efeito');
    e.fim = { vencedor: j, motivo: 'efeito: vence o jogo', turno: e.turno.n };
  } },
  perderJogo: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) if (!e.jogs[j].saiu) M.sair(e, j, 'efeito: perde o jogo'); } },   // CR 104.3e/800.4a
  perderVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) if (!M.vidaFixa(e, j)) M.perderVida(e, j, q); } },   // 119.7
  copiarMagica: {                                                   // CR 707.10: "copy that spell" (pilha.ts: M.alvosDaCopia/M.criarCopia)
    campos: ['novoAlvo'],
    fx(e, f, ctx, ask) {
      let o: any = null;
      if (f.em === 'doEvento') o = objsDe(e, { em: 'doEvento', de: 'pilha' }, ctx)[0];          // a mágica conjurada (Archmage, Zada)
      else if (f.em === 'este') { const S = e.objs[ctx.este]; o = S && S.zona === 'pilha' && !S.hab && (!ctx.lki.este || S.ts === ctx.lki.este.ts) ? S : null; }   // ela mesma na pilha (Bygone Marvels)
      else o = objsDe(e, f, ctx).find(x => x.zona === 'pilha') || null;                      // a mágica alvo (Dualcaster)
      if (!o || o.zona !== 'pilha' || o.hab || !o.pil) return;
      const n = f.qtd === undefined ? 1 : Math.max(0, qtdDe(e, f.qtd, ctx));
      const planos: any[] = [];
      for (let k = 0; k < n; k++) planos.push(M.alvosDaCopia(e, o, ctx.voce, !!f.novoAlvo, ask));   // pergunta tudo antes de mexer
      for (const pl of planos) M.criarCopia(e, o, ctx.voce, pl);
    },
  },
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
  desvirar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) M.desvirarObj(e, o); } },
  // CR 701.3: prende o Equipamento/Aura (em) ao objeto a. Equipamento só em criatura e nunca em si mesmo (301.5c);
  // Aura só no que o encantar permite (303.4a); preso ao mesmo objeto = nada acontece (701.3b).
  // ninjutsu (702.49c): a carta, se ainda estiver na mão, entra virada e atacando quem o devolvido atacava (sem declarar: não dispara "ataca")
  ninjutsu: {
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este], it = e.objs[ctx.item], alvo = it && it.pil && it.pil.ninja;
      if (!o || o.zona !== 'mao' || !alvo) return;
      const p = M.decidirEntrada(e, o.id, ctx.voce, { virada: true }, ask);
      const n = M.aplicarEntrada(e, p);
      if (n && n.zona === 'campo') M.porAtacando(e, n, alvo);
    },
  },
  soltar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (o.anexo) { o.anexo = null; e.vCamada = (e.vCamada || 0) + 1; M.log(e, o.n, 'solta (volta a ser criatura)'); } } },   // reconfigurar (702.151a)
  anexar: {
    campos: ['a', 'reconf'],
    ok: f => f.em !== undefined && emOk(f.a) && f.a !== undefined && (f.a === 'este' || f.a === 'criadas' || typeof f.a.alvo === 'number'),   // criadas: arma viva (702.92a)
    fx(e, f, ctx) {
      const t = objsDe(e, { em: f.a }, ctx).find(o => o.zona === 'campo'); if (!t) return;
      for (const o of objsDe(e, f, ctx)) {
        if (o.zona !== 'campo' || o.id === t.id) continue;
        const d = M.dadoDe(e, o), sub = d.sub || [];
        if (sub.includes('Equipment')) { if (!M.temTipo(e, t, 'Creature') || (M.temTipo(e, o, 'Creature') && !f.reconf)) continue; }   // reconfigurar: anexa mesmo sendo criatura (702.151a)
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
  // milagre (CR 702.94): o gatilho da primeira carta comprada no turno. Se ela ainda está na mão, o dono pode conjurá-la
  // pagando o custo de milagre (na resolução, sem olhar a velocidade: 608.2g).
  milagre: {
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este], L = ctx.lki && ctx.lki.este;
      if (!o || o.zona !== 'mao' || (L && L.ts !== o.ts)) return;
      if (M.podeConjurar(e, o.dono, o, undefined, { milagre: true }) && ask(o.dono, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'milagre', id: o.id }).a === 'sim') {
        const P0 = e.proc;
        M.PROC.conjurar(e, { j: o.dono, id: o.id, milagre: true, resp: [] }, ask);
        e.proc = P0;
        if (o.zona === 'pilha') M.log(e, e.jogs[o.dono].nome, 'conjura', o.n, 'pelo milagre');
      }
    },
  },
  faseExtra: {                                                      // CR 500.8: "after this phase, there is an additional combat phase [followed by an additional main phase]"
    campos: ['fase'],
    qtd: q => q === undefined,
    ok: f => f.fase === 'combate' || f.fase === 'principal',
    fx(e, f, ctx) {
      ctx._faseX = ctx._faseX || ++e.ts;                              // o mesmo efeito põe as fases em ordem (combate, depois principal)
      M.faseExtra(e, f.fase, ctx._faseX);
      M.log(e, 'fase extra depois desta:', f.fase);
    },
  },
  escolher: {                                                       // "choose a creature type / a color" na resolução: vale para os efeitos seguintes (ctx.escolha)
    campos: ['o'],
    qtd: q => q === undefined,
    ok: f => (f.o === 'tipoCriatura' || f.o === 'cor') && (f.quem === undefined || f.quem === 'voce'),
    fx(e, f, ctx, ask) {
      let ops;
      if (f.o === 'cor') ops = 'WUBRG'.split('').map(v => ({ a: 'cor', v }));
      else {                                                         // 205.3m: qualquer tipo; as opções são os tipos que existem na partida
        const t = new Set<any>();
        for (const x of Object.values<any>(e.objs)) if (!x.hab && x.zona !== 'fora' && M.temTipo(e, x, 'Creature')) (M.dadoDe(e, x).sub || []).forEach(s => t.add(s));
        ops = [...(t.size ? t : new Set(['Human']))].sort().map(v => ({ a: 'tipo', v }));
      }
      const r = ask(ctx.voce, 'escolha', ops, { o: f.o, fonte: (e.objs[ctx.este] || {}).n });
      ctx.escolha = { ...(ctx.escolha || {}), ...(f.o === 'cor' ? { cor: r.v } : { tipo: r.v }) };
      M.log(e, e.jogs[ctx.voce].nome, 'escolhe', r.v);
    },
  },
  moer: { fx(e, f, ctx) {   // CR 701.13. Depois de mover: 'moe' por carta {id, j} e o lote 'moeGrupo' {ids, n} ("uma ou mais", Scorchbeast)
    const q = qtdDe(e, f.qtd, ctx), ids: any[] = [];
    for (const j of jogsDe(e, f, ctx)) { const g = e.jogs[j].zonas.grimorio; for (let i = 0; i < q && g.length; i++) { const id = g[g.length - 1]; M.mover(e, id, 'cemiterio'); if (e.objs[id].zona === 'cemiterio') ids.push(id); } }   // substituída para outra zona (Rest in Peace): não foi moída
    if (M.evento && ids.length) { for (const id of ids) M.evento(e, { ev: 'moe', id, j: e.objs[id].dono }); M.evento(e, { ev: 'moeGrupo', ids, n: ids.length }); }
  } },
  sacrificar: {                                                     // CR 701.21: quem sacrifica escolhe
    campos: ['f'],
    fx(e, f, ctx, ask) {
      const esc: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const cand = M.objetosQue(e, { ...(f.f || {}), ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
        esc.push(...escolherN(ask, j, 'sacrificar', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length)));
      }
      ctx.resultado = esc.length;                                   // "reveal … until X Zombies" (Empty the Laboratory)
      for (const id of esc) M.mover(e, id, 'cemiterio', { sac: true });
    },
  },
  embaralhar: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) M.embaralhar(e, e.jogs[j].zonas.grimorio); } },
  buscar: {                                                         // CR 701.19 (pode não achar: 701.19b)
    campos: ['f', 'para', 'revelar', 'virada', 'destinos', 'noDe'],
    qtd: q => qtdOk(q) || (ateOk(q) && q.ate !== 'X'),          // "any number of" (Ugin −11): {ate:'qualquer'}
    ok: f => ['mao', 'campo', 'cemiterio', 'grimorio', 'exilio', undefined].includes(f.para) && (!f.destinos || f.destinos.every(d => ['mao', 'campo', 'cemiterio', 'grimorio'].includes(d.para))),
    fx(e, f, ctx, ask) {
      const plano: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        if (j === ctx.voce && M.procuraBloqueada(e, j)) { M.log(e, e.jogs[j].nome, 'não pode procurar no grimório'); continue; }   // Ashiok, Dream Render
        // noDe {alvo:N}: procura no grimório do jogador alvo (Knowledge Exploitation); quem escolhe é j
        const dono = f.noDe ? ((ctx.alvos[f.noDe.alvo] || [])[0] || {}).jog : j; if (dono === undefined || (f.noDe && ctx.ilegal && ctx.ilegal[f.noDe.alvo + ':0'])) continue;
        const cand = M.objetosQue(e, { ...f.f, zona: 'grimorio', dono: 'voce' }, { ...ctx, voce: dono }).map(o => o.id);
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
      if (f.destinos ? !f.destinos.every(d => (Z.includes(d.para) || d.para === 'grimorio') && Object.keys(d).every(k => ['para', 'qtd', 'virada'].includes(k))) || f.para !== undefined : f.pega !== 0 && !Z.includes(f.para)) return false;
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
      plano.forEach((p, k) => { if (p.para === 'grimorio') return; if (ent[k]) M.aplicarEntrada(e, ent[k]); else M.mover(e, p.id, p.para); });
      ctx.movidos = movidos(e, plano.map(p => p.id));
      if (f.resto) {                                                // de volta ao topo: na mesma ordem (uma das ordens que a regra deixa)
        const r = f.resto === 'grimorio' && !f.fundo ? resto.slice().reverse() : resto;
        for (const id of r) M.mover(e, id, f.resto, { topo: !f.fundo });
      }
      for (const p of plano) if (p.para === 'grimorio') { const g = e.jogs[p.j].zonas.grimorio, k = g.indexOf(p.id); if (k >= 0) { g.splice(k, 1); g.push(p.id); } }   // destino grimório = fica no topo (fim da lista), depois do resto ir ao fundo
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
          for (const t of Object.keys(o.marc)) if (o.marc[t] > 0) M.porMarcadores(e, o, t, 1);   // 701.34a: põe (as substituições valem, 614.1)
        }
        if (esc.length) M.log(e, e.jogs[j].nome, 'prolifera', esc.length);
        M.evento(e, { ev: 'prolifera', j });                          // "quando você proliferar" (mesmo sem escolher nada, 701.34a)
      }
    },
  },
  // esconderijo N (CR 702.75a): gatilho de entrar da palavra-chave (gatilhos.ts). Olha os N do topo, exila um virado
  // para baixo ligado a esta permanente (exPor: "the exiled card" das outras habilidades dela, 607.2a → filtro
  // exiladaPorEste) e o resto vai para o fundo em ordem aleatória. Só o gatilho que o motor cria.
  esconder: {
    ok: () => false,
    fx(e, f, ctx, ask) {
      const J = e.jogs[ctx.voce], g = J.zonas.grimorio, top = g.slice(Math.max(0, g.length - (f.qtd || 0))).reverse();
      if (!top.length) return;
      const [esc] = escolherN(ask, ctx.voce, 'escolherCarta', top, 1, { ctx: { op: 'esconder' } });   // pergunta antes de mexer
      const F = e.objs[ctx.este], ts = (ctx.lki && ctx.lki.este && ctx.lki.este.ts) ?? (F && F.ts);
      const x = M.mover(e, esc, 'exilio'); x.exPor = { id: ctx.este, ts }; x.faceBaixo = true;
      const resto = top.filter(id => id !== esc); M.embaralhar(e, resto);
      for (const id of resto) M.mover(e, id, 'grimorio', { topo: false });
      M.log(e, J.nome, 'esconde 1 de', top.length);
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
