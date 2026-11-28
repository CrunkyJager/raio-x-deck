// src/motor/efeitos.ts (T43: migrado de motor2/efeitos.js) — efeitos do formato RX que o núcleo já executa na resolução (CR 608.2c–h) e o teste de suporte.
// O que não está aqui (ou tem campo que o handler não conhece) faz a carta/habilidade NÃO ser oferecida: melhor
// não jogar do que jogar errado em silêncio. Regra de cada handler: perguntar tudo antes de mexer no estado.
import { M } from './nucleo';

const BASE = new Set(['op', 'em', 'quem', 'qtd', 'se', 'talvez', 'aMenosQue', 'pagando', 'xAte']);
const QUEM_OK = new Set(['cadaOutroOponente', 'voce', 'cadaOponente', 'cadaJogador', 'alvoJogador', 'controlador', 'dono', 'doEvento', 'atacado', 'cadaAtual', 'atacadosPorEste', 'oponente', 'umJogador', 'feridosPorEsteNome']);
// oponente/umJogador: "an opponent" / "choose a player" sem alvo — quem controla escolhe ao resolver (askAtual)
let askAtual: any = null;
// cadaAtual (o jogador da vez) só vale dentro de um repetirCada: fora dele seria um jogador que não existe
let dentroCada = 0, dentroObj = 0;
const comCada = fn => { dentroCada++; try { return fn(); } finally { dentroCada--; } };
// dentro de um repetirCada com filtro de objetos (Kalonian Hydra): em/copiaDe 'cadaAtual' = o objeto da vez
const comObj = fn => { dentroObj++; try { return fn(); } finally { dentroObj--; } };
// contagens: formato único em contagem.ts (M.contaOk / M.contar); nome velho entra traduzido por M.qn
const vidaEv = ev => ev.ev === 'ganhaVida' || ev.ev === 'perdeVida';
const COND_OK = new Set(['eventoMais', 'contra', 'existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'vidaOponenteMax', 'conta', 'conjuradaCom', 'palavra', 'pagou', 'objBate', 'esteEm', 'temIniciativa', 'monarca', 'haMonarca', 'completouMasmorra', 'maisTerrenosOponente', 'modoEscolhido', 'primeiroCombate', 'fasePrincipal', 'emCombate', 'conjuradaNaPrincipal', 'portadorDoAnel']);

// ---------- suporte (estático, olhando só o dado) ----------
// quem: {alvo: N} = o jogador escolhido no alvo N ("target player discards", Kolaghan's Command)
const quemAlvo = q => !!q && typeof q === 'object' && typeof q.alvo === 'number' && Object.keys(q).length === 1;
// {dado:N}: rola um dado de N lados (CR 706) com o RNG da partida; {ate:N|'X'|'qualquer'} ("up to") só onde o handler aceita
const dadoOk = q => !!q && typeof q === 'object' && Number.isInteger(q.dado) && q.dado >= 2 && Object.keys(q).length === 1;
const ateOk = q => !!q && typeof q === 'object' && Object.keys(q).length === 1 && (Number.isInteger(q.ate) || q.ate === 'X' || q.ate === 'qualquer');
// {ate: conta}: "up to that many / up to X onde X é uma contagem" (Scapeshift, Kyoshi Island Plaza) — só onde o handler aceita
const ateContaOk = q => !!q && typeof q === 'object' && Object.keys(q).length === 1 && !!q.ate && typeof q.ate === 'object' && qtdOk(q.ate);
const ehConj = c => !!c.de && typeof c.de === 'object' && 'f' in c.de;
const qtdOk = q0 => { const q = M.qn(q0); return q === undefined || typeof q === 'number' || q === 'X' || dadoOk(q)
  || (!!q && typeof q === 'object' && M.contaOk(q.conta, 'efeito') && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'divCima', 'metade'].includes(k))
    && (q.metade === undefined || (q.metade === true && !(ehConj(q.conta) && q.conta.junta))) && (q.divCima === undefined || (Number.isInteger(q.divCima) && q.divCima > 1))
    && !(q.conta.de === 'cada' && q.conta.o === 'vida' && !(dentroCada > 0)) && !(q.conta.de === 'cada' && q.conta.o === 'marcadores' && !(dentroObj > 0))); };
const emOk = v => v === undefined || v === 'este' || v === 'descartadaCusto' || (v === 'cadaAtual' && dentroObj > 0) || v === 'equipada' || v === 'doEvento' || v === 'danificado' || v === 'criadas' || v === 'anterior' || (v && typeof v === 'object' && (typeof v.alvo === 'number' || (v.todos && M.filtroOk(v.todos)) || (v.um && M.filtroOk(v.um))));
const seOk = se => !se || (se.nao !== undefined ? !!se.nao && typeof se.nao === 'object' && seOk(se.nao) && seOk((({ nao, ...r }) => r)(se)) : Object.keys(se).every(k => COND_OK.has(k)) && (se.portadorDoAnel === undefined || se.portadorDoAnel === true || se.portadorDoAnel === 'este')
  && M.condValorOk(se) && (!se.objBate || (Object.keys(se.objBate).every(k => ['em', 'f', 'nao'].includes(k)) && se.objBate.em !== undefined && emOk(se.objBate.em) && M.filtroOk(se.objBate.f || {}))) && (!se.existe || M.filtroOk(se.existe.f)) && (!se.controla || M.filtroOk(se.controla.f)) && (!se.conta || (qtdOk(se.conta.q) && ['min', 'max', 'igual'].every(k => se.conta[k] === undefined || typeof se.conta[k] === 'number' || qtdOk(se.conta[k]))))
  && (!se.esteEm || (Array.isArray(se.esteEm) && se.esteEm.length > 0 && se.esteEm.every(z => ['campo', 'cemiterio', 'exilio', 'mao', 'comando', 'grimorio'].includes(z)))));
M.seOk = seOk;
// modos que a carta oferece ao entrar = os valores de se.modoEscolhido nas habilidades dela, na ordem em que aparecem
M.modosDe = d => { const l: string[] = []; const ver = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(ver); return; } for (const [k, v] of Object.entries<any>(x)) { if (k === 'modoEscolhido' && typeof v === 'string' && !l.includes(v)) l.push(v); else ver(v); } }; ver([d.gat, d.est, d.atv]); return l; };
// aMenosQue (CR 118.12): "X unless [quem] pays [custo]". Custo: mana fixa, {x:1} com qtd (Esper Sentinel), vida, sacrificar {f, qtd}
const amqOk = a => !!a && typeof a === 'object' && Object.keys(a).every(k => ['quem', 'custo', 'qtd'].includes(k))
  && (QUEM_OK.has(a.quem) || quemAlvo(a.quem)) && (a.quem !== 'cadaAtual' || dentroCada > 0) && !!a.custo && typeof a.custo === 'object'
  // mana + vida juntos ("pay {1} and 3 life", Ripples of Undeath); fora isso, um custo só
  && (Object.keys(a.custo).length === 1 || (Object.keys(a.custo).length === 2 && !!a.custo.mana && Number.isInteger(a.custo.vida)))
  && (a.custo.mana ? Object.keys(a.custo.mana).every(k => k === 'g' || k === 'x' || /^[WUBRGC]$/.test(k) || k === 'p') && (!a.custo.mana.x || (a.qtd !== undefined && qtdOk(a.qtd)))
    : a.custo.vida ? Number.isInteger(a.custo.vida)
    : a.custo.descartar ? Number.isInteger(a.custo.descartar) && a.custo.descartar > 0   // "you may discard a card. When you do…" (Awaken the Honored Dead)
    : a.custo.virarOutros ? typeof a.custo.virarOutros === 'object' && M.filtroOk(a.custo.virarOutros.f || {}) && Object.keys(a.custo.virarOutros).every(k => k === 'f' || k === 'qtd') && Number.isInteger(a.custo.virarOutros.qtd) && a.custo.virarOutros.qtd > 0   // "you may tap five untapped artifacts… If you do" (Thousand Moons Smithy)
    : a.custo.sacrificar === 'este' ? true                                         // "unless you sacrifice this" (Withercrown dá à encantada)
    : a.custo.sacrificar ? typeof a.custo.sacrificar === 'object' && M.filtroOk(a.custo.sacrificar.f || {}) && Object.keys(a.custo.sacrificar).every(k => k === 'f' || k === 'qtd') && (a.custo.sacrificar.qtd === undefined || Number.isInteger(a.custo.sacrificar.qtd))
    : a.custo.exilarDe ? M.custoSuportado({ exilarDe: a.custo.exilarDe })            // "você pode exilar um card de criatura do seu cemitério" (Masked Vandal)
    : false)
  && (a.qtd === undefined || !!a.custo.mana);
M.fxSuportado = (fx, { topo = true }: any = {}) => (fx || []).every(f => {
  if (f.op === 'modal') return topo && fx.length === 1 && f.modos.some(m => M.fxSuportado(m, { topo: false }));
  const h = H[f.op];
  if (!h) return false;
  for (const k in f) if (!BASE.has(k) && !(h.campos || []).includes(k)) return false;
  if (f.quem !== undefined && !QUEM_OK.has(f.quem) && !quemAlvo(f.quem)) return false;
  if (f.quem === 'cadaAtual' && !dentroCada) return false;
  if (!(f.op === 'jogar' && f.em === 'cifrada' && f.cifra) && !emOk(f.em) || !seOk(f.se)) return false;   // 'cifrada': só o jogar do cifrar (702.99a, pilha.ts)
  if (!(h.qtd ? h.qtd(f.qtd) : qtdOk(f.qtd))) return false;
  if (f.f && !M.filtroOk(f.f)) return false;
  if (f.aMenosQue !== undefined && !amqOk(f.aMenosQue)) return false;
  if (f.pagando !== undefined && f.xAte !== undefined) { if (!(f.pagando.mana && f.pagando.mana.x === 1 && Object.keys(f.pagando).length === 1 && qtdOk(f.xAte))) return false; }   // pagar {X} escolhido até xAte
  else if (f.pagando !== undefined && !amqOk({ quem: 'voce', custo: f.pagando })) return false;   // "você pode pagar…; se pagar"
  return h.ok ? h.ok(f) : true;
});

// substituições (CR 614) que o motor aplica de verdade; o resto é recusado (a cobertura conta como trava). Lidas em:
// entra (decidirEntrada/aplicarEntrada), ganhaVida (estado.ts), ficha (criarFichas), marcador (porMarcadores),
// dano (substDano), anulada (pilha.ts), morre/vaiCemiterio (estado.ts, M.destinoSaida).
const SUBST: Record<string, (s) => boolean> = {
  entra: s => (!!s.muda && Object.keys(s.muda).length === 1 && s.muda.virada === true && !!s.quem && s.quem.este)
    // "as criaturas dos oponentes entram viradas" (Authority of the Consuls) / "seus terrenos entram desvirados" (Spelunking)
    || (!!s.muda && Object.keys(s.muda).length === 1 && typeof s.muda.virada === 'boolean' && !!s.quem && typeof s.quem === 'object' && !s.quem.este && Object.keys(s).every(k => ['ev', 'quem', 'muda', 'se'].includes(k)))
    || (!!s.emVez && s.emVez.every(f => f.op === 'escolher' && (f.o === 'cor' || f.o === 'tipoCriatura' || f.o === 'modo' || (f.o === 'tipo' && (f.tipos === undefined || (Array.isArray(f.tipos) && f.tipos.length > 0 && f.tipos.every(t => TIPOS_DE_CARTA.includes(t))))))))
    // "você pode fazer esta entrar como cópia de [f] no campo (exceto que é [tipos] além dos outros)" (CR 707.5, 614.1c)
    || (!!s.emVez && s.emVez.length === 1 && s.emVez[0].op === 'copiarPermanente' && !!s.quem && s.quem.este && M.filtroOk(s.emVez[0].f || {})
      && Object.keys(s.emVez[0]).every(k => ['op', 'f', 'tipos'].includes(k)) && (s.emVez[0].tipos === undefined || Array.isArray(s.emVez[0].tipos)))
    || sacEntraOk(s),
  ganhaVida: s => !!s.muda && Object.keys(s.muda).every(k => k === 'soma' || k === 'mult'),
  explorar: s => !!s.muda && Object.keys(s.muda).length === 1 && Number.isInteger(s.muda.mult) && s.muda.mult > 1 && Object.keys(s).every(k => ['ev', 'quem', 'muda'].includes(k)),   // efeitos.ts explorar
  moer: s => !!s.muda && Object.keys(s.muda).length === 1 && Number.isInteger(s.muda.soma) && Object.keys(s).every(k => ['ev', 'jog', 'muda'].includes(k)) && [undefined, 'voce', 'oponente', 'qualquer'].includes(s.jog),   // efeitos.ts moer (The Water Crystal)
  compra: s => !!s.muda && Object.keys(s.muda).length === 1 && Number.isInteger(s.muda.mult) && Object.keys(s).every(k => ['ev', 'jog', 'muda', 'naoPrimeira'].includes(k)),   // estado.ts M.comprar (Bard)
  // "entra com N marcadores" (614.1c): a própria (quem.este) ou outras que entram (quem filtro); N = número, X pago, conta
  entraMarc: s => !!s.muda && Object.keys(s.muda).length === 1 && !!s.muda.marcadores && typeof s.muda.marcadores === 'object'
    && Object.values<any>(s.muda.marcadores).every((q: any) => qtdOk(q === 'X' ? q : M.qn(q) && typeof q === 'object' && M.qn(q).conta && M.qn(q).conta.de === 'X' ? 'X' : q)),
  ficha: s => !!s.muda && Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || (!!s.muda.maisFicha && typeof s.muda.maisFicha === 'object')
    || (Array.isArray(s.muda.trocaPor) && s.muda.trocaPor.length > 0 && s.muda.trocaPor.every(t => !!t && typeof t === 'object')))
    && (s.talvez === undefined || (s.talvez === true && !!s.muda.trocaPor)),
  marcador: s => !!s.muda && Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || Number.isInteger(s.muda.soma) || s.muda.impedir === true)
    && Object.keys(s).every(k => ['ev', 'quem', 'marc', 'muda', 'se', 'jog'].includes(k)) && (s.jog === undefined || ((s.jog === 'voce' || s.jog === 'oponente') && !s.quem)),   // jog: no jogador (Winding Constrictor)
  // morre / vaiCemiterio (CR 614.1a, lido no M.mover): muda.para (Liesa), "exile com marcador" (Ravenloft), "embaralhe no grimório" (Blightsteel)
  morre: s => saidaOk(s),
  vaiCemiterio: s => saidaOk(s),
  anulada: s => !!s.muda && Object.keys(s.muda).length === 1 && s.muda.impedir === true && Object.keys(s).every(k => ['ev', 'quem', 'muda', 'se'].includes(k))
    && !!s.quem && s.quem.zona === 'pilha',   // "não pode ser anulada" (M.anular, pilha.ts)
  dano: s => !!s.muda && ((Object.keys(s.muda).length === 1 && (Number.isInteger(s.muda.mult) || s.muda.metade === true || s.muda.prevenir === true || Number.isInteger(s.muda.teto) || (s.muda.vidaMin === 1 && s.jog === 'voce' && s.quem === undefined)))
    || (Object.keys(s.muda).length === 2 && s.muda.prevenir === true && !!s.muda.fichaPorDano && typeof s.muda.fichaPorDano === 'object'))
    && Object.keys(s).every(k => ['ev', 'quem', 'jog', 'por', 'combate', 'muda', 'se', 'depois'].includes(k)) && (!s.por || M.filtroOk(s.por)) && (!s.jog || s.jog === 'voce' || s.jog === 'oponente' || s.jog === 'doEvento')
    && (s.depois === undefined || (s.muda.prevenir === true && Array.isArray(s.depois) && s.depois.every(f => f.op === 'marcador') && M.fxSuportado(s.depois))),
};
// "As this enters, you may sacrifice any number of Foods. It enters with three +1/+1 counters for each" (Feasting
// Hobbit, 614.1c): emVez [sacrificar {f, qtd ate qualquer}, marcador {em este, qtd {conta resultado, mult}}]
// tipos de carta (CR 205.2a; Kindred = o antigo Tribal) — as opções de "choose a card type"
const TIPOS_DE_CARTA = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery'];
M.TIPOS_DE_CARTA = TIPOS_DE_CARTA;
function sacEntraOk(s) {
  if (!s.emVez || s.emVez.length !== 2 || !s.quem || !s.quem.este) return false;
  const [a, b] = s.emVez;
  return a.op === 'sacrificar' && (a.quem === undefined || a.quem === 'voce') && !!a.f && M.filtroOk(a.f) && !!a.qtd && a.qtd.ate === 'qualquer' && Object.keys(a).every(k => ['op', 'quem', 'f', 'qtd'].includes(k))
    && b.op === 'marcador' && b.em === 'este' && typeof b.tipoMarc === 'string' && !!b.qtd && (q => !!q && !!q.conta && q.conta.de === 'resultado' && Object.keys(q.conta).length === 1 && Object.keys(q).every(k => k === 'conta' || k === 'mult'))(M.qn(b.qtd)) && Object.keys(b).every(k => ['op', 'em', 'tipoMarc', 'qtd'].includes(k));
}
function saidaOk(s) {
  if (!Object.keys(s).every(k => ['ev', 'quem', 'muda', 'emVez', 'se', 'talvez'].includes(k)) || !!s.muda === !!s.emVez) return false;
  if (s.talvez !== undefined && (s.talvez !== true || s.ev !== 'vaiCemiterio' || !s.quem || s.quem.zona !== 'mao')) return false;   // só "descartada por efeito" (Leng)
  if (s.muda) return Object.keys(s.muda).length === 1 && ['exilio', 'grimorio', 'mao'].includes(s.muda.para);
  const [a, b, ...r] = s.emVez; if (r.length || !a) return false;
  if (a.op === 'exilar' && a.em === 'doEvento' && Object.keys(a).every(k => ['op', 'em', 'comEste'].includes(k)) && (a.comEste === undefined || a.comEste === true)) return !b || (b.op === 'marcador' && b.em === 'doEvento' && typeof b.tipoMarc === 'string' && Number.isInteger(b.qtd) && Object.keys(b).length === 4);
  if (a.op === 'mover' && a.em === 'este' && a.para === 'grimorio' && Object.keys(a).length === 3) return !!b && b.op === 'embaralhar' && b.quem === 'dono' && Object.keys(b).length === 2 && !!s.quem && s.quem.este;
  return false;
}
const tipoSubst = s => s.ev === 'entra' && s.muda && s.muda.marcadores ? 'entraMarc' : s.ev;
M.substOk = s => !!s && !!SUBST[tipoSubst(s)] && SUBST[tipoSubst(s)](s) && (!s.se || seOk(s.se)) && (!s.quem || typeof s.quem !== 'object' || M.filtroOk(s.quem));
M.SUBST = SUBST;
// as substituições de um tipo que estão no campo, com a permanente que as tem (F)
function substsDe(e, tipo) {
  const r: any[] = [];
  for (const id of M.indiceCampo(e).sb) { const F = e.objs[id]; if (!F) continue; for (const s of M.dadoDe(e, F).subst || []) if (tipoSubst(s) === tipo && M.substOk(s)) r.push({ F, s }); }   // índice: só quem tem substituição
  // efeitoTemporario com substituição (Spore Frog, Riot Control, Selfless Squire): vale mesmo que a fonte já tenha saído
  // (611.2b); o "você" é quem resolveu o efeito
  for (const t of e.efTemp || []) if (!t.proxMag) for (const s of t.subst || []) if (tipoSubst(s) === tipo) r.push({ F: { id: t.este ? t.este.id : -1, ctrl: t.ctrl }, s });
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
    if ((s.marc && s.marc !== t) || s.jog) continue;
    if (!substQuem(e, F, s, o) || !substSe(e, F, s)) continue;
    if (s.muda.impedir) return 0;
    if (s.muda.soma) soma += s.muda.soma; if (s.muda.mult) mult *= s.muda.mult;
  }
  q = (q + soma) * mult;
  if (t === 'lore') M.porHistoria(e, o, q); else o.marc[t] = (o.marc[t] || 0) + q;
  if (M.evento) M.evento(e, { ev: 'marcadorPosto', id: o.id, ts: o.ts, t, n: q, j: e.agente ?? o.ctrl });   // "sempre que um ou mais marcadores forem postos" (122.6; um evento por objeto); j = quem pôs (quem resolve o efeito; no custo/entrada, o controlador)
  return q;
};
// marcador num jogador (122.1): as substituições 'marcador' com jog ("if you would get one or more counters", Winding Constrictor)
M.qtdMarcadorJogador = (e, j, t, q) => {
  let soma = 0, mult = 1;
  for (const { F, s } of substsDe(e, 'marcador')) {
    if (!s.jog || (s.marc && s.marc !== t) || (s.jog === 'voce') !== (F.ctrl === j) || !substSe(e, F, s)) continue;
    if (s.muda.impedir) return 0;
    if (s.muda.soma) soma += s.muda.soma; if (s.muda.mult) mult *= s.muda.mult;
  }
  return (q + soma) * mult;
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
      if (v && typeof v === 'object' && M.qn(v).conta && M.qn(v).conta.de === 'X') v = (cx.x) * (v.mult || 1) + (v.soma || 0);
      const q = qtdDe(e, v, cx);
      if (q > 0) M.porMarcadores(e, o, t, q);
    }
  }
}
// criar fichas (CR 111) com as substituições 'ficha' (Parallel Lives, Doubling Season, Queen Allenal, Bilbo, Academy
// Manufactor, Jinnie Fay). Primeiro as trocas ("instead create", 614.1a: cada molde que bate vira os de trocaPor; cada fonte
// vale uma vez por ficha, 614.5), depois "mais uma" e multiplicar (a ordem boa para o controlador, 616.1). O filtro de
// cada substituição olha uma amostra do molde (sem entrar no campo).
const amostraFicha = (j, tok0) => { const tok = M.fichaDe(tok0), n = tok.n || ((tok.sub || []).join(' ') + ' Token').trim(); return { id: -1, n, dono: j, ctrl: j, zona: 'pilha', ts: 0, dano: 0, marc: {}, ficha: { ...tok, n } }; };
// "you may instead" (Jinnie Fay): a IA troca só ficha de criatura por uma criatura maior (P+R, depois nº de palavras-chave);
// Tesouro/Pista/Comida ficam (simplificação da escolha, não da regra)
const valorFicha = t => { const x = M.fichaDe(t) || {}; return (x.tipos || []).includes('Creature') && x.pt ? (+x.pt[0] || 0) + (+x.pt[1] || 0) + (x.kw || []).length / 10 : -1; };
M.criarFichas = (e, j, tok, q, opc: any = {}) => {
  const out: any[] = [];
  if (!(q > 0)) return out;
  const lista = substsDe(e, 'ficha').filter(({ F, s }) => substSe(e, F, s));
  const bateM = ({ F, s }, t) => { try { return substQuem(e, F, s, amostraFicha(j, t)); } catch (_) { return false; } };
  let moldes = [tok];
  const fontes = [...new Set(lista.filter(r => r.s.muda.trocaPor).map(r => r.F.id))];
  for (const fid of fontes) {
    const grupo = lista.filter(r => r.F.id === fid && r.s.muda.trocaPor);
    moldes = moldes.flatMap(t => {
      const ok = grupo.filter(r => bateM(r, t));
      const obrig = ok.find(r => !r.s.talvez);
      if (obrig) return obrig.s.muda.trocaPor;
      let melhor: any = null, v = valorFicha(t);
      for (const r of ok) { const w = Math.min(...r.s.muda.trocaPor.map(valorFicha)); if (v >= 0 && w > v) { v = w; melhor = r; } }
      return melhor ? melhor.s.muda.trocaPor : [t];
    });
  }
  const multDe = t => lista.reduce((m, r) => r.s.muda.mult && bateM(r, t) ? m * r.s.muda.mult : m, 1);
  for (const t of moldes) { const m = multDe(t); for (let i = 0; i < q * m; i++) out.push(criarFicha(e, j, t, opc)); }
  // "those tokens plus an additional" (Queen Allenal, Bilbo): uma a mais por evento, multiplicada pelo dobro do primeiro molde
  const extras = lista.filter(r => r.s.muda.maisFicha && moldes.some(t => bateM(r, t))).map(r => r.s.muda.maisFicha);
  for (const x of extras) for (let i = 0; i < multDe(moldes[0]); i++) out.push(criarFicha(e, j, x, {}));
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
  if (lista.some(r => r.s.muda.prevenir) && !M.danoNaoPrevenivel(e)) {   // Bonecrusher Giant: prevenir não vale (615.12)
    if (jog !== undefined && M.evento) M.evento(e, { ev: 'danoPrevenido', jog, q, combate });   // "whenever damage that would be dealt to you is prevented" (Selfless Squire)
    const r = lista.find(r => r.s.muda.prevenir && r.s.muda.fichaPorDano);   // "for each 1 damage prevented this way, create…" (Inkshield): um escudo só leva o crédito
    if (r) M.criarFichas(e, r.F.ctrl, r.s.muda.fichaPorDano, q);
    // "prevent that damage, remove that many +1/+1 counters…, then give each player a rad counter for each removed" (Bloatfly
    // Swarm, 615.5): depois = efeitos da própria substituição; resultado = o dano prevenido (e depois, quantos tirou)
    for (const { F, s } of lista) if (s.muda.prevenir && s.depois) { const ctx: any = { voce: F.ctrl, este: F.id, resultado: q, alvos: [], ilegal: {}, lki: {} }; for (const f of s.depois) M.executar(e, f, ctx, (_j, _t, ops) => ops[0]); }
    return 0;
  }
  for (const r of lista) if (r.s.muda.teto !== undefined) q = Math.min(q, r.s.muda.teto);
  for (const r of lista) if (r.s.muda.mult) q *= r.s.muda.mult;
  for (const r of lista) if (r.s.muda.metade) q = Math.ceil(q / 2);
  if (jog !== undefined && lista.some(r => r.s.muda.vidaMin === 1)) q = Math.max(0, Math.min(q, e.jogs[jog].vida - 1));   // "damage that would reduce your life total to less than 1 reduces it to 1 instead" (Serra the Benevolent, Worship)
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
  if (v && typeof v === 'object' && v.um) {   // "a creature you control" sem alvo: quem faz (quem, padrão você) escolhe uma ao resolver
    const ids = M.objetosQue(e, v.um.zona ? v.um : { ...v.um, zona: 'campo' }, ctx).map(o => o.id), j = f.quem === 'cadaAtual' ? ctx.cadaAtual : ctx.voce;
    if (ids.length <= 1 || !askAtual) return ids.slice(0, 1).map(id => e.objs[id]);
    return [e.objs[askAtual(j, 'um', ids.map(id => ({ a: 'um', id })), { op: f.op }).id]];
  }
  if (v === 'cadaAtual') { const c = ctx.cadaObj, o = c && e.objs[c.id]; return o && o.ts === c.ts && o.zona === 'campo' ? [o] : []; }   // repetirCada de objetos
  if (v === 'este') {
    const o = e.objs[ctx.este];
    if (o && o.zona === 'pilha' && !o.hab && ctx.item === o.id && (f.op === 'exilar' || f.op === 'mover')) return [o];   // "Exile Mizzix's Mastery" / Teferi's Protection: a mágica que resolve (608.2n)
    return o && o.zona === 'campo' && (!ctx.lki.este || o.ts === ctx.lki.este.ts) ? [o] : [];
  }
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
  if (v === 'danificado') {                                          // no gatilho de dano: a permanente que LEVOU o dano (Ghyrson Starn: "that permanent or player")
    const ev = ctx.ev, o = ev && ev.ev === 'dano' && ev.o !== undefined ? e.objs[ev.o] : null;
    return o && o.zona === 'campo' ? [o] : [];
  }
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
    case 'atacadosPorEste': { const F = e.objs[ctx.este]; return F ? vivos.filter(j => (e.turno.ataques || []).some(r => r.id === F.id && r.ts === F.ts && r.jog === j)) : []; }   // "each player this creature attacked this turn" (Angel of Destiny; o jogador, não o planeswalker dele)
    case 'atacado': return ctx.ev && ctx.ev.def !== undefined && vivos.includes(ctx.ev.def) ? [ctx.ev.def] : [];   // o jogador defensor do ataque (Kozilek, Ulamog: 508.5)
    case 'cadaJogador': return vivos;
    case 'feridosPorEsteNome': { const F = e.objs[ctx.este] || ctx.lki.este; return F ? vivos.filter(j => j !== ctx.voce && !!(e.jogs[j].feridoPorNome || {})[F.n]) : []; }   // "each opponent dealt combat damage this game by a creature named [este]" (Gollum)
    case 'oponente': case 'umJogador': {   // "an opponent draws" (Baleful Mastery), "choose a player" (Gluntch): sem alvo, escolhe ao resolver
      const ops = f.quem === 'oponente' ? vivos.filter(j => j !== ctx.voce) : vivos;
      if (ops.length <= 1 || !askAtual) return ops.slice(0, 1);
      const r = askAtual(ctx.voce, 'jogador', ops.map(j => ({ a: 'jogador', jog: j })), { op: f.op });
      M.log(e, e.jogs[ctx.voce].nome, 'escolhe', e.jogs[r.jog].nome); return [r.jog];
    }
    case 'alvoJogador': { for (let i = 0; i < ctx.alvos.length; i++) { const js = jogsAlvo(e, i, ctx); if (js.length) return js; } return []; }
    case 'controlador': return [...new Set(lkisDe(e, f, ctx).map(l => l.ctrl))].filter(j => vivos.includes(j));
    case 'dono': return [...new Set(lkisDe(e, f, ctx).map(l => l.dono))].filter(j => vivos.includes(j));
    case 'cadaAtual': return ctx.cadaAtual !== undefined && vivos.includes(ctx.cadaAtual) ? [ctx.cadaAtual] : [];
    case 'doEvento': { const jj = ctx.ev ? (ctx.ev.ev === 'dano' ? ctx.ev.jog : ctx.ev.j ?? ctx.ev.ativo) : undefined; return jj !== undefined && vivos.includes(jj) ? [jj] : []; }   // quem descartou (Megrim); no dano, o jogador que recebeu (Blightbelly Rat)
  }
  throw new Error('quem sem suporte: ' + f.quem);
}
function qtdDe(e, q0, ctx) {
  if (q0 === undefined) return 1;
  const q = M.qn(q0);
  if (dadoOk(q)) { const v = 1 + Math.floor(M.aleat(e) * q.dado); M.log(e, 'd' + q.dado, 'deu', v); return v; }   // CR 706
  if (ateContaOk(q)) return qtdDe(e, q.ate, ctx);
  if (ateOk(q)) return q.ate === 'qualquer' ? Infinity : q.ate === 'X' ? ctx.x || 0 : q.ate;   // o máximo; quem escolhe para antes
  if (q && typeof q === 'object' && q.conta && typeof q.conta === 'object' && 'de' in q.conta) return Math.max(0, M.qtdConta(e, q, ctx));
  const v = M.qtd(e, q, ctx);
  if (v === null) throw new Error('qtd sem suporte: ' + JSON.stringify(q));
  return Math.max(0, v);
}
M.qtdDe = qtdDe;
M.jogsAlvo = jogsAlvo;
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
const habilDeOk = f => f.dura === 'fimDoTurno' && f.em === 'este' && !!f.habilDe && typeof f.habilDe === 'object' && Number.isInteger(f.habilDe.alvo) && Object.keys(f.habilDe).length === 1
  && ['p', 'r', 'kw', 'est', 'habil', 'gat', 'sub', 'cores', 'trocaCor'].every(k => f[k] === undefined);
const ganhoOk = f => f.em === 'este' && f.p === undefined && f.r === undefined && !(f.kw || []).length && !(f.est || []).length
  && !!f.habil && Object.keys(f.habil).length === 1 && Array.isArray(f.habil.atv) && f.habil.atv.length > 0 && f.habil.atv.every(a => !!a && M.custoSuportado(a.custo || {}) && M.fxSuportado(a.fx, { topo: false }));
const gatSempre = f => f.dura === 'sempre' && !!f.habil && Array.isArray(f.habil.gat);
// tipo/cor "além dos outros" e/ou disparada ganha para sempre; P/R e kw juntos só se a parte de P/R/kw sozinha passa
// trocaCor: "vira [cor]" (105.3: perde as outras), também até o fim do turno (Crimson Wisps); sem ele, cores é "além das outras"
const modTipoOk = f => (f.dura === 'sempre' || (f.trocaCor === true && f.dura === 'fimDoTurno' && f.sub === undefined)) && (f.trocaCor === undefined || (f.trocaCor === true && f.cores !== undefined)) && f.em !== undefined && f.gat === undefined && !(f.est || []).length
  && (f.sub === undefined || (Array.isArray(f.sub) && f.sub.length > 0 && f.sub.every(x => typeof x === 'string' && x !== 'escolhido')))
  && (f.cores === undefined || (typeof f.cores === 'string' && /^[WUBRG]+$/.test(f.cores)))
  && (f.habil === undefined || (gatSempre(f) && Object.keys(f.habil).length === 1 && f.habil.gat.length > 0 && f.habil.gat.every(g => M.gatOk(g))))
  && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw);
// "protection from each of that creature's colors" (Éowyn, Fearless Knight): as cores do que o efeito anterior moveu, na resolução
const coresDoAnterior = (e, ctx) => [...new Set((ctx.movidos || []).flatMap(m => e.objs[m.id] ? [...(M.dadoDe(e, e.objs[m.id]).cores || '')] : []))].join('');
// "ganha 'você não pode perder o jogo e seus oponentes não podem vencer'" para sempre (lido por M.naoPerde em estado.ts)
const naoPerdeGanho = f => f.dura === 'sempre' && Array.isArray(f.est) && f.est.length === 1 && f.est[0].modo === 'naoPerdeJogo' && f.est[0].afeta === 'voce' && Object.keys(f.est[0]).length === 2;
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
    case 'naoPodeAtacar': return s.afeta === undefined && so('contra') && !!s.contra && Object.keys(s.contra).length === 1 && s.contra.jog === 'voce';   // "não podem atacar você neste turno" (Champions of Minas Tirith): combate.ts alvosAtaque
    case 'custoAlternativo': return f.em === undefined && !!s.afeta && typeof s.afeta === 'object' && s.gratis === true && !s.limite && M.estAltOk(s);   // emblema da Tamiyo: lido no altDados (pilha.ts)
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
const desviradas = (e, v, j, ctx) => M.objetosQue(e, { ...(v.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: ctx.este }).filter(o => !o.virada);
function pagouParaImpedir(e, f, ctx, ask) {
  const a = f.aMenosQue, c = a.custo;
  for (const j of jogsDe(e, { ...f, quem: a.quem }, ctx)) {
    const J = e.jogs[j], ops: any[] = [{ a: 'naoPagar' }];
    let mana: any = null, x = 0;
    if (c.mana) { mana = { ...c.mana }; if (mana.x) { x = qtdDe(e, a.qtd, ctx); } if (M.planoMana(e, j, mana, { x }) && (!c.vida || (J.vida >= c.vida && !M.vidaFixa(e, j)))) ops.push({ a: 'pagar' }); }
    else if (c.vida) { if (J.vida >= c.vida && !M.vidaFixa(e, j)) ops.push({ a: 'pagar' }); }   // CR 119.4, 119.8
    else if (c.sacrificar === 'este') { const o = e.objs[ctx.este]; if (o && o.zona === 'campo' && o.ctrl === j) ops.push({ a: 'pagar' }); }
    else if (c.virarOutros) { if (desviradas(e, c.virarOutros, j, ctx).length >= c.virarOutros.qtd) ops.push({ a: 'pagar' }); }
    else if (c.descartar) { if (J.zonas.mao.length >= c.descartar) ops.push({ a: 'pagar' }); }
    else if (c.sacrificar) { if (M.temPeloMenos(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: ctx.este }, c.sacrificar.qtd || 1)) ops.push({ a: 'pagar' }); }
    const candEx = () => c.exilarDe ? M.objetosQue(e, { ...(c.exilarDe.f || {}), zona: c.exilarDe.zona }, { voce: j }).filter(o => J.zonas[c.exilarDe.zona].includes(o.id) && o.id !== ctx.este) : [];
    if (c.exilarDe && candEx().length >= (c.exilarDe.qtd || 1)) ops.push({ a: 'pagar' });
    const fo = e.objs[ctx.item] || e.objs[ctx.este];
    const r = ask(j, 'aMenosQuePagar', ops, { op: f.op, fonte: fo ? fo.n : '?', de: ctx.voce, custo: c, x });
    if (r.a !== 'pagar') continue;
    if (mana) { M.pagarComPlano(e, j, mana, { x }); if (c.vida) M.perderVida(e, j, c.vida); }
    else if (c.vida) M.perderVida(e, j, c.vida);                                                      // CR 119.4
    else if (c.sacrificar === 'este') M.mover(e, ctx.este, 'cemiterio', { sac: true });
    else if (c.virarOutros) {                                                                        // CR 701.26a: vira as escolhidas (dispara 'vira')
      const ids = escolherN(ask, j, 'virar', desviradas(e, c.virarOutros, j, ctx).map(o => o.id), c.virarOutros.qtd, { ctx: { op: 'virar' } });
      for (const id of ids) M.virarObj(e, e.objs[id]);
    }
    else if (c.descartar) {                                                                           // CR 701.9: quem descarta escolhe
      const ids = escolherN(ask, j, 'descartar', J.zonas.mao.slice(), c.descartar, { ctx: { op: 'descartar' } });
      M.descartar(e, j, ids, { ask, efeito: true });
    }
    else if (c.exilarDe) {
      const ex: any[] = [];
      for (let i = 0; i < (c.exilarDe.qtd || 1); i++) ex.push(ask(j, 'custo', candEx().filter(o => !ex.includes(o.id)).map(o => ({ a: 'exilar', id: o.id })), { o: 'exilar' }).id);
      for (const id of ex) M.mover(e, id, 'exilio');
    } else {
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
  if (f.pagando && f.xAte !== undefined) {                           // "you may pay {X}, where X ≤ N. If you do, … X" (Well of Lost Dreams): escolhe o X
    const cap = Math.max(0, qtdDe(e, f.xAte, ctx)), mana = f.pagando.mana; let max = 0;
    for (let k = cap; k > 0; k--) if (M.planoMana(e, ctx.voce, mana, { x: k })) { max = k; break; }
    const ops = Array.from({ length: max + 1 }, (_, i) => ({ a: 'escolha', v: max - i }));   // do maior ao 0 (o agente básico pega o primeiro)
    const X = max ? ask(ctx.voce, 'escolha', ops, { op: 'pagarX', id: ctx.este }).v : 0;
    if (!X) { ctx.pagou = false; return; }
    M.pagarComPlano(e, ctx.voce, mana, { x: X }); ctx.x = X; ctx.pagou = true;
  } else if (f.pagando) {                                            // "você pode pagar X. Se pagar, …" (pergunta e paga antes do efeito)
    const pagou = pagouParaImpedir(e, { op: 'pagando', aMenosQue: { quem: 'voce', custo: f.pagando } }, ctx, ask);
    ctx.pagou = pagou; if (!pagou) return;
  }
  const h = H[f.op];
  if (!h) throw new Error('efeito sem suporte no motor2: ' + f.op + ' (' + ((e.objs[ctx.item] || {}).n || '?') + ')');
  if (f.talvez) ctx.pagou = true;                                    // "se fizer" (se.pagou) do efeito seguinte
  const ag = e.agente; e.agente = ctx.voce;                          // quem faz o efeito (o "you put counters" de All Will Be One)
  const a0 = askAtual; askAtual = ask;
  const ff = e.fxFonte; e.fxFonte = ctx.este;                        // de quem é o efeito que move ("put onto the battlefield with this ability", Kodama)
  try { h.fx(e, f, ctx, ask); } finally { e.agente = ag; askAtual = a0; e.fxFonte = ff; }
};

// entrar no campo (CR 110.2: sob o controle de quem conjurou/pôs; 614.1c "entra virado"; 614.12 escolha ao entrar)
// Em duas metades: decidirEntrada só pergunta (pode rodar de novo), aplicarEntrada mexe no estado.
M.entrarPermanente = (e, id, ctrl, opc, ask) => M.aplicarEntrada(e, M.decidirEntrada(e, id, ctrl, opc, ask));
// face: a face que vai entrar para cima quando não é a de agora (terreno modal, 712.9); sem ela, a do objeto
// entra virada/desvirada pelas substituições de outras permanentes: true, false (desvirada ganha: 616.1) ou null
function viradaPorOutras(e, ob) {
  const fora = substsDe(e, 'entra').filter(({ F, s: x }) => x.quem && !x.quem.este && x.muda && typeof x.muda.virada === 'boolean' && F.id !== ob.id && substQuem(e, F, x, ob) && substSe(e, F, x));
  return fora.some(r => r.s.muda.virada === false) ? false : fora.length ? true : null;
}
M.decidirEntrada = (e, id, ctrl, { virada = false, face = undefined }: any = {}, ask) => {
  const o = e.objs[id], d = face === undefined ? M.dadoDe(e, o) : M.dadoFace(M.carta(o.n), face), ctx = { voce: ctrl, este: id };
  let vir = virada, pagaVida = 0;
  // as de outras permanentes (614.12: vê a permanente como vai entrar, sob ctrl). Desvirada e virada juntas: quem controla
  // a que entra escolhe a ordem (616.1) e aplica a desvirada por último → entra desvirada (e nem paga o "a menos que").
  const vo = viradaPorOutras(e, { ...o, ctrl }), desv = vo === false;
  if (vo === true) vir = true;
  const s = desv ? null : (d.subst || []).find(x => x.ev === 'entra' && x.muda && x.muda.virada && x.quem && x.quem.este);
  if (desv) vir = false;
  if (s && M.condicao(e, s.se, ctx)) {
    if (s.aMenosQue && ask) {
      const ops: any[] = [{ a: 'naoPagar' }], c = s.aMenosQue.custo;
      if (c.vida && e.jogs[ctrl].vida >= c.vida && !M.vidaFixa(e, ctrl)) ops.push({ a: 'pagar' });   // CR 119.4, 119.8
      if (c.revelar) for (const r of M.objetosQue(e, { ...c.revelar.f, dono: 'voce', zona: 'mao' }, ctx)) if (r.id !== id) ops.push({ a: 'revelar', rid: r.id });
      const r = ask(ctrl, 'aMenosQue', ops, { id, vida: c.vida || 0 });
      if (r.a === 'naoPagar') vir = true; else if (r.a === 'pagar') pagaVida = c.vida;
    } else if (s.talvez) { if (ask && ask(ctrl, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'entraVirada', id }).a === 'sim') vir = true; }   // "you may have this land enter tapped" (Mariposa Military Base)
    else vir = true;
  }
  let escolha: any = null, clone: any = null;
  const cp = ask && (d.subst || []).find(x => x.ev === 'entra' && x.emVez && x.emVez[0] && x.emVez[0].op === 'copiarPermanente');
  if (cp) {                                                          // clone (707.5): escolhe ao entrar; a cópia são os valores copiáveis (707.2)
    const fz = cp.emVez[0], cand = M.objetosQue(e, { ...(fz.f || {}), zona: 'campo' }, ctx).filter(x => x.id !== id);
    if (cand.length) {
      const r = ask(ctrl, 'escolherCarta', [...cand.map(x => ({ a: 'escolherCarta', id: x.id })), { a: 'nenhum' }], { id, op: 'copiarPermanente' });
      if (r.a !== 'nenhum' && e.objs[r.id]) {
        const S = e.objs[r.id], { faces, forma, ...base } = M.dadoBase(e, S);
        clone = { ...base, n: base.n || S.n, ...(fz.tipos ? { tipos: [...new Set([...(base.tipos || []), ...fz.tipos])] } : {}) };
      }
    }
  }
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
        } else if (fz.o === 'tipoCarta') {        // "choose a card type" (Cloud Key: artifact, creature, enchantment, instant ou sorcery)
          ops = (fz.tipos || ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery']).map(v => ({ a: 'tipoCarta', v }));
        } else if (fz.o === 'modo') {             // "As this enters, choose X or Y" (Mirrodin Besieged, Sieges): os modos são os nomes que as habilidades leem
          ops = M.modosDe(d).map(v => ({ a: 'modo', v }));
          if (!ops.length) continue;
        } else if (fz.o === 'tipo') ops = (fz.tipos || TIPOS_DE_CARTA).map(v => ({ a: 'tipoCarta', v }));   // "choose a card type" (205.2a); Cloud Key dá a lista
        else continue;
        const r = ask(ctrl, 'escolha', ops, { id, o: fz.o });
        escolha = fz.o === 'cor' ? { cor: r.v } : fz.o === 'modo' ? { modo: r.v } : fz.o === 'tipo' ? { tipoCarta: r.v } : { tipo: r.v };
        break;
      }
    }
  }
  let sacEntra: any = null;                                          // Feasting Hobbit: as Comidas escolhidas e os marcadores
  if (ask) for (const sb of d.subst || []) if (sb.ev === 'entra' && sacEntraOk(sb)) {
    const [a, b] = sb.emVez, cand = M.objetosQue(e, { ...a.f, ctrl: 'voce', zona: 'campo' }, { voce: ctrl, este: id }).filter(x => x.id !== id).map(x => x.id);
    const ids = cand.length ? escolherN(ask, ctrl, 'sacrificar', cand, cand.length, { podeMenos: true, ctx: { id, entra: true } }) : [];
    if (ids.length) sacEntra = { ids, t: b.tipoMarc, q: ids.length * (b.qtd.mult || 1) };
  }
  // tumulto (702.136a): entra com um marcador +1/+1 a mais OU ganha pressa. Vale a dela e a dada por permanente sua (Rhythm
  // of the Wild: "criaturas não-ficha que você controla têm tumulto"), olhando-a como vai estar no campo (614.12)
  const tumulto = ask && temTumulto(e, o, d, ctrl) ? ask(ctrl, 'tumulto', [{ a: 'marcador' }, { a: 'pressa' }], { id }).a : null;
  return { id, ctrl, vir, pagaVida, escolha, face, clone, tumulto, ...(sacEntra ? { sacEntra } : {}) };
};
function temTumulto(e, o, d, ctrl) {
  if (!(d.tipos || []).includes('Creature')) return false;
  if ((d.kw || []).some(x => x.k === 'tumulto')) return true;
  for (const id of e.campo) {
    const F = e.objs[id]; if (F.ctrl !== ctrl) continue;
    for (const s of M.dadoDe(e, F).est || []) if (s.modo === 'continuo' && (s.kw || []).some(x => x.k === 'tumulto') && s.afeta && typeof s.afeta === 'object'
      && M.bate(e, { ...o, ctrl }, { ...s.afeta, zona: o.zona }, { voce: F.ctrl, este: F.id })) return true;
  }
  return false;
}
M.aplicarEntrada = (e, { id, ctrl, vir, pagaVida, escolha, face, conj = null, conjDe = null, anim = null, x = 0, marc = null, clone = null, sacEntra = null, tumulto = null, conjurada = false, conc = null, baixo = null }: any) => {
  if (pagaVida) M.perderVida(e, ctrl, pagaVida);
  if (sacEntra) for (const sid of sacEntra.ids) if (e.objs[sid] && e.objs[sid].zona === 'campo') M.mover(e, sid, 'cemiterio', { sac: true });   // 701.21, antes de entrar
  const o = M.mover(e, id, 'campo', { virada: vir, face, conj, conjDe, anim, clone, conjurada, conc, baixo });   // conjurada: marcada ANTES do evento (603.4: "if you cast it" é visto ao disparar)   // conc: entra já anexada como Aura (702.103b)
  o.ctrl = ctrl; o.escolha = escolha; e.vCamada = (e.vCamada || 0) + 1;   // camadas: refaz as fontes (estado.ts)
  entraComMarcadores(e, o, x);                                       // 614.1c: já entra com eles (antes das ABE)
  if (marc) for (const t in marc) M.porMarcadores(e, o, t, marc[t]);   // "volta com um marcador -1/-1" (persistir)
  if (sacEntra && sacEntra.q > 0) M.porMarcadores(e, o, sacEntra.t, sacEntra.q);
  if (tumulto === 'marcador') M.porMarcadores(e, o, '+1/+1', 1);
  else if (tumulto === 'pressa') (o.anim || (o.anim = [])).push({ ts: o.ts, kw: [{ k: 'pressa' }], fim: null });   // 702.136a: pressa enquanto estiver no campo
  M.log(e, e.jogs[ctrl].nome, 'põe no campo', baixo ? 'uma criatura virada para baixo' : o.n, vir ? '(virado)' : '', conc && e.objs[conc.o] ? '(Aura em ' + e.objs[conc.o].n + ')' : '');
  return o;
};

// "até N" dos objetos do em que passam no teste: quem resolve escolhe (sem ask, todos até N)
function escolherAte(e, f, ctx, ask, tipo, ok) {
  const ids = objsDe(e, f, ctx).filter(o => o.zona === 'campo' && ok(o)).map(o => o.id), n = qtdDe(e, f.qtd, ctx);
  const esc = ask ? escolherN(ask, ctx.voce, tipo, ids, n, { podeMenos: true }) : ids.slice(0, n);
  return esc.map(id => e.objs[id]);
}
// escolher n objetos de uma lista, um por pergunta (pode parar antes se 'podeMenos')
M.escolherN = (...a) => (escolherN as any)(...a);
const SUB_TERRENO = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Desert', 'Gate', 'Lair', 'Locus', 'Mine', 'Power-Plant', 'Tower', 'Urza\'s', 'Cave', 'Sphere', 'Town']);   // CR 205.3i
// "an Angel card, a Demon card, and/or a Dragon card" (Kaalia): cada carta pega ocupa uma vaga diferente (categorias(id) = as vagas que ela preenche)
const cabemVagas = (ids, cat, usadas: any[] = []) => !ids.length || cat(ids[0]).some(v => !usadas.includes(v) && cabemVagas(ids.slice(1), cat, [...usadas, v]));
function escolherN(ask, j, tipo, ids, n, { podeMenos = false, ctx = {}, distinto, vagas }: any = {}) {
  const r: any[] = [];
  while (r.length < n) {
    const ops = ids.filter(id => !r.includes(id) && (!distinto || !r.some(x => distinto(x) === distinto(id))) && (!vagas || cabemVagas([...r, id], vagas))).map(id => ({ a: tipo, id }));   // distinto: "each have different names" (Tiamat)
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
// Junk (exila o topo e pode jogar) usa op que o motor não tem: a ficha existe, a habilidade não é ativada.
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
  { const vo = viradaPorOutras(e, o); if (vo !== null) o.virada = vo; }   // 614.12: Authority of the Consuls vale para ficha
  e.objs[id] = o; e.campo.push(id);
  M.campoEntra(e, id); M.registraEntrada(e, o);
  if (tok.leal) o.marc.lealdade = tok.leal;
  if (M.evento) { M.evento(e, { ev: 'zona', id, de: null, para: 'campo' }); M.evento(e, { ev: 'fichaCriada', id, j, ts: o.ts }); }   // CR 111.2: "whenever you create a token"
  return o;
}
M.criarFicha = criarFicha;
// ficha cópia (CR 707.2, 111.4): os valores copiáveis = o dado impresso (a face de cima), sem marcadores nem camadas;
// o que o token trouxer além do copiaDe vale por cima (707.9b). Fonte que saiu: o objeto guarda o nome e a face.
function copiaDe(e, token, ctx) {
  const { copiaDe: de, ...resto } = token;
  // sacrificada: a sacrificada no custo (Cleaver Skaab), como estava ao sair (LKI: a face; 707.2 valores copiáveis)
  const sac = de === 'sacrificada' && ctx.sac && ctx.sac[0] && e.objs[ctx.sac[0].id] ? { ...e.objs[ctx.sac[0].id], face: ctx.sac[0].face } : null;
  const src = de === 'sacrificada' ? sac : de === 'doEvento' ? ctx.ev && e.objs[ctx.ev.id] : de === 'este' ? e.objs[ctx.este] : objsDe(e, { em: de }, ctx)[0];
  if (!src || src.hab) return null;
  const { faces, forma, ...base } = M.dadoBase(e, src);
  const { maisSub, maisTipos, semCusto, ...over } = resto;          // "é Zombie além dos outros tipos", "não tem custo de mana" (707.9b, eternizar)
  const r: any = { ...base, ...over, n: base.n || src.n };
  if (maisSub) r.sub = [...new Set([...(base.sub || []), ...maisSub])];
  if (maisTipos) r.tipos = [...new Set([...(base.tipos || []), ...maisTipos])];   // "a 1/1 Soldier creature in addition to its other types" (Urza, Prince of Kroog)
  if (semCusto) { delete r.custo; r.vm = 0; }
  return r;
}
// est oponentesNaoProcuram (Ashiok, Dream Render): mágica/habilidade de um oponente de quem controla não faz o próprio controlador procurar
M.procuraBloqueada = (e, j) => e.campo.some(id => { const F = e.objs[id]; return F.ctrl !== j && (M.dadoDe(e, F).est || []).some(s => s.modo === 'oponentesNaoProcuram'); });
M.danoEm = (e, o, q, fd) => danoEm(e, o, q, fd);
function danoEm(e, alvoObj, q, fonte) {
  // dano excedente (120.10): mais do que o letal (criatura: resistência − dano marcado, ou 1 com toque mortífero; planeswalker: a lealdade)
  { const cr = M.temTipo(e, alvoObj, 'Creature'), pw = M.temTipo(e, alvoObj, 'Planeswalker');
    const let0 = cr ? ((fonte.kw || []).some(k => k.k === 'toqueMortifero') ? (alvoObj.dano > 0 ? 0 : 1) : Math.max(0, M.resistencia(e, alvoObj) - alvoObj.dano)) : pw ? Math.max(0, alvoObj.marc.lealdade || 0) : Infinity;
    if ((cr || pw) && q > let0) { const J = e.jogs[alvoObj.ctrl]; J.excT = { t: e.turno.n, n: (J.excT && J.excT.t === e.turno.n ? J.excT.n : 0) + 1 }; } }
  if (M.temTipo(e, alvoObj, 'Planeswalker')) alvoObj.marc.lealdade = (alvoObj.marc.lealdade || 0) - q;   // CR 120.3c
  if (M.temTipo(e, alvoObj, 'Creature')) { if (M.temInfectar(fonte.kw)) alvoObj.marc['-1/-1'] = (alvoObj.marc['-1/-1'] || 0) + q; else alvoObj.dano += q; if ((fonte.kw || []).some(k => k.k === 'toqueMortifero')) alvoObj.mortal = true; }   // 120.3e (infectar: −1/−1, 702.90c), 702.2b
  if (M.temTipo(e, alvoObj, 'Battle')) alvoObj.marc.defesa = (alvoObj.marc.defesa || 0) - q;                // CR 120.3h
  if (fonte.o && q > 0) (alvoObj.feridaPor || (alvoObj.feridaPor = [])).push({ id: fonte.o.id, ts: fonte.o.ts, t: e.turno.n });   // "dealt damage by this creature this turn" (Markov Enforcer)
}

// ---------- os efeitos ----------
// emparelhamento máximo cor → objeto distinto (Kuhn): l[i] = ids que têm a cor i; devolve o id sugerido por cor
const CORES_WUBRG = ['W', 'U', 'B', 'R', 'G'];
function emparelhaCores(l: number[][]) {
  const dono = new Map<number, number>();
  const tenta = (i, visto) => { for (const id of l[i]) { if (visto.has(id)) continue; visto.add(id); const k = dono.get(id); if (k === undefined || tenta(k, visto)) { dono.set(id, i); return true; } } return false; };
  l.forEach((_, i) => tenta(i, new Set()));
  const r: (number | undefined)[] = l.map(() => undefined); for (const [id, i] of dono) r[i] = id; return r;
}
const H = {
  // "may draw up to N" (Arcane Denial): cada jogador escolhe quantas, de 0 a N; pergunta a todos antes de comprar
  comprar: {
    qtd: q => qtdOk(q) || (ateOk(q) && Number.isInteger(q.ate)),
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx), js = jogsDe(e, f, ctx);
      const n = ateOk(f.qtd) ? js.map(j => ask(j, 'x', Array.from({ length: q + 1 }, (_, v) => ({ a: 'x', v })).reverse(), { op: 'comprar' }).v) : js.map(() => q);
      const pl = js.map((j, i) => n[i] > 0 ? M.planoCompra(e, j, n[i], ask) : null);   // dragar (702.52a): pergunta a todos antes de comprar
      js.forEach((j, i) => { if (n[i] > 0) M.comprar(e, j, n[i], { plano: pl[i] }); });
    },
  },
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
      for (const j of [...new Set([...js, ...jq])]) { const v = M.substDano(e, js.includes(j) ? parte(null, j) : q, { fonte: fonte.o, jog: j }); if (v <= 0 || M.protegeJog(e, j, fonte.o)) continue; M.danoJogador(e, j, v, fonte.kw); total += v; evs.push({ jog: j, q: v }); }   // CR 120.3a (infectar: veneno, 702.90b); 702.16j; 119.7
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
    campos: ['p', 'r', 'kw', 'dura', 'est', 'habil', 'gat', 'sub', 'cores', 'trocaCor', 'habilDe'],
    qtd: q => q === undefined,
    ok: f => f.habilDe !== undefined ? habilDeOk(f) : naoPerdeGanho(f) ? f.em !== undefined && Object.keys(f).every(k => ['op', 'em', 'dura', 'est'].includes(k))
      : f.sub !== undefined || f.cores !== undefined || gatSempre(f) ? modTipoOk(f) : (f.dura === 'enquantoNoCampo' && f.habil !== undefined ? ganhoOk(f) && f.gat === undefined : f.habil === undefined && (f.dura === 'fimDoTurno' || (['sempre', 'proximoTurnoSeu', 'enquantoNoCampo'].includes(f.dura) && !(f.est || []).length && f.gat === undefined)) && f.em !== undefined && (f.p !== undefined || f.r !== undefined || (f.kw || []).length > 0 || (f.est || []).length > 0 || (f.gat || []).length > 0)
      && (f.gat === undefined || (Array.isArray(f.gat) && f.gat.every(g => M.gatOk(g))))   // "ganha 'quando morrer, …'" até o fim do turno (Demonic Gifts)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw)
      && (f.est || []).every(s => s.afeta === 'este' && (s.modo === 'deveBloquear' ? Object.keys(s).every(k => ['modo', 'afeta', 'atacante', 'voceEscolhe'].includes(k)) && (s.atacante === undefined || s.atacante === 'doEvento')
        : EST_REGRA.includes(s.modo) && Object.keys(s).every(k => ['modo', 'afeta'].includes(k))))),
    fx(e, f, ctx) {
      if (f.habilDe !== undefined) {   // "gains all activated abilities of target creature until end of turn" (Quicksilver Elemental): as que o alvo tem agora
        const ia = f.habilDe.alvo, a = (ctx.alvos[ia] || [])[0], T = a && !(ctx.ilegal && ctx.ilegal[ia + ':0']) ? e.objs[a.o] : null, F = e.objs[ctx.este];
        if (!T || T.zona !== 'campo' || !F || F.zona !== 'campo') return;
        const atv = M.atvDe(e, T);
        if (atv.length) F.ganhos = { ...(F.ganhos || {}), atvT: [...((F.ganhos && F.ganhos.atvT) || []), ...atv] };   // sai na limpeza (514.2) ou ao mudar de zona
        return;
      }
      if (naoPerdeGanho(f)) {                                       // "It gains 'You can't lose the game…'" (Book of Exalted Deeds): sem prazo, o mover zera
        for (const o of objsDe(e, f, ctx).filter(o => o.zona === 'campo')) o.ganhos = { ...(o.ganhos || {}), est: [...((o.ganhos && o.ganhos.est) || []), ...f.est] };
        return;
      }
      if (gatSempre(f) && f.em === 'doEvento' && ctx.ev) for (const o of [e.objs[ctx.ev.id]]) if (o && o.zona === 'pilha' && !o.hab && (ctx.ev.ts === undefined || o.ts === ctx.ev.ts)) o.gatPilha = [...(o.gatPilha || []), ...f.habil.gat];   // a mágica: a permanente que ela vira tem (Rivaz)
      // "target instant or sorcery card in your graveyard gains flashback until end of turn" (Flashback, Snapcaster Mage):
      // a carta no cemitério, presa por id+ts no e.efTemp; custo = o custo de mana dela (lido no flashDe, pilha.ts)
      const noCem = objsDe(e, f, ctx).filter(o => o.zona === 'cemiterio');
      if (noCem.length && (f.kw || []).length === 1 && f.kw[0].k === 'flashback' && !f.kw[0].custo && f.dura === 'fimDoTurno')
        (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: [{ modo: 'darFlashback' }], este: null, ids: noCem.map(o => ({ id: o.id, ts: o.ts })), fim: 'turno', ts: ++e.ts });
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      if (f.sub !== undefined || f.cores !== undefined || gatSempre(f)) {
        for (const o of os) {
          if (f.sub || f.cores) (o.anim || (o.anim = [])).push({ ts: o.ts, sub: f.sub, ...(f.trocaCor ? { cores: f.cores } : { maisCores: f.cores }), fim: f.dura === 'fimDoTurno' ? 'turno' : null });
          if (gatSempre(f)) o.ganhos = { ...(o.ganhos || {}), gatS: [...((o.ganhos && o.ganhos.gatS) || []), ...f.habil.gat] };
        }
        e.vCamada = (e.vCamada || 0) + 1;
        if (f.p === undefined && f.r === undefined && !(f.kw || []).length) return;
      }
      if (f.dura === 'enquantoNoCampo' && f.habil) {                            // habilidade ganha enquanto no campo (o mover zera o.ganhos)
        for (const o of os) o.ganhos = { atv: [...((o.ganhos && o.ganhos.atv) || []), ...f.habil.atv] };
        return;
      }
      // número direto: −4/−4 não vira 0; {conta, mult:-1} = −X/−X (Toxic Deluge, Olivia's Wrath): conta positiva, sinal depois
      const n = q => q === undefined ? 0 : typeof q === 'number' ? q : q && q.mult < 0 && !q.soma ? -qtdDe(e, { ...q, mult: -q.mult }, ctx) : qtdDe(e, q, ctx);
      const p = n(f.p), r = n(f.r);
      const ev = ctx.ev, at = ev && e.objs[ev.id];
      if ((f.gat || []).length) { for (const o of os) o.ganhos = { ...(o.ganhos || {}), gat: [...((o.ganhos && o.ganhos.gat) || []), ...f.gat] }; e.vCamada = (e.vCamada || 0) + 1; }   // sai na limpeza (514.2) ou ao mudar de zona
      const regra = (f.est || []).filter(s => EST_REGRA.includes(s.modo));   // "não pode ser bloqueada até o fim do turno": e.efTemp com os objetos presos (611.2c)
      if (regra.length) (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: regra.map(s => ({ modo: s.modo })), este: null, ids: os.map(o => ({ id: o.id, ts: o.ts })), fim: 'turno', ts: ++e.ts });
      const est = (f.est || []).filter(s => s.modo === 'deveBloquear').map(s => ({ modo: s.modo, atk: s.atacante === 'doEvento' ? (at && at.zona === 'campo' ? { id: at.id, ts: at.ts } : { id: -1, ts: -1 }) : null, ...(s.voceEscolhe ? { escolhe: ctx.voce } : {}) }));
      if (f.p === undefined && f.r === undefined && !(f.kw || []).length && !est.length) return;
      (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p, r, kw: (f.kw || []).map(k => k.de === 'escolhido' && ctx.escolha && ctx.escolha.cor ? { ...k, de: ctx.escolha.cor } : k.de === 'coresDoAnterior' ? { ...k, de: coresDoAnterior(e, ctx) } : k).filter(k => k.de !== ''), ...(est.length ? { est } : {}), ...(f.dura !== 'fimDoTurno' ? { sempre: true } : {}), ...(f.dura === 'proximoTurnoSeu' ? { ate: ctx.voce } : {}), ts: ++e.ts });   // sempre/enquantoNoCampo: preso ao objeto (ts); até o seu próximo turno: sai no desvirar (masmorras.ts)
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
  // "change the text of that creature by replacing all instances of one creature type with Vampire" (New Blood; CR 612.1, 612.2):
  // camada 3 (613.1c), preso ao objeto (o.texto, mesmo ts) e sem duração. Quem resolve escolhe o tipo trocado (as opções são
  // os tipos de criatura que aparecem no texto/linha de tipo dele); o M.dadoDe troca a palavra em tudo (sub, filtros, fichas)
  trocarTexto: {
    campos: ['novoTipo'],
    qtd: q => q === undefined,
    ok: f => typeof f.novoTipo === 'string' && !!f.em && typeof f.em.alvo === 'number' && (f.quem === undefined || f.quem === 'voce'),
    fx(e, f, ctx, ask) {
      for (const o of objsDe(e, f, ctx).filter(x => x.zona === 'campo')) {
        const ops = M.tiposNoTexto(e, o).filter(t => t !== f.novoTipo).map(v => ({ a: 'tipo', v }));
        if (!ops.length) continue;                                     // nenhuma palavra de tipo de criatura: trocar não muda nada
        const r = ask(ctx.voce, 'escolha', ops, { o: 'trocaTexto', id: o.id, para: f.novoTipo, fonte: (e.objs[ctx.este] || {}).n });
        (o.texto || (o.texto = [])).push({ ts: o.ts, de: r.v, para: f.novoTipo });
        M.log(e, e.jogs[ctx.voce].nome, 'troca o texto de', o.n + ':', r.v, '→', f.novoTipo);
      }
    },
  },
  // estáticas de regra que valem até o fim do turno ou até o próximo turno de quem fez (CR 611.2b): e.efTemp (estado.ts)
  efeitoTemporario: {
    campos: ['dura', 'est', 'subst', 'emblema', 'gat', 'proximaMagica'],
    qtd: q => q === undefined,
    ok: f => (f.quem === undefined || f.quem === 'voce') && (f.dura === 'fimDoTurno' || f.dura === 'proximoTurnoSeu' || f.dura === 'sempre')
      && (f.em === undefined || f.em === 'este' || f.em === 'anterior' || (f.em && typeof f.em.alvo === 'number')) && ((f.est || []).length + (f.subst || []).length + (f.gat || []).length) > 0
      && (f.est || []).every(s => tempEstOk(s, f)) && (f.subst || []).every(s => f.proximaMagica ? s.ev === 'anulada' && M.substOk(s) && Object.keys(s.quem).length === 1 : tipoSubst(s) === 'dano' && M.substOk(s) && !(s.quem && s.quem.este))
      && (!f.proximaMagica || (f.em === undefined && !(f.gat || []).length && f.dura === 'fimDoTurno'
        && (!(f.est || []).length || (!(f.subst || []).length && f.est.every(s => s.modo === 'conjurarComLampejo')))))   // "the next spell of the chosen type … as though it had flash" (Progenitor's Icon)
      && (f.gat || []).every(g => (f.em === undefined || (typeof f.em === 'object' && !!g.quem && g.quem.lembrada === true)) && M.gatOk(g) && !(g.quem && g.quem.este)),   // em alvo + quem lembrada: "sempre que uma delas…" (Tamiyo +1)
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
      (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: (f.est || []).filter(x => x.modo !== 'ptDefinido'), subst, gat: f.gat || [], n, este, ids, ...(f.proximaMagica ? { proxMag: true, mag: null } : {}), fim: f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'sempre' ? 'nunca' : ctx.voce, ts: ++e.ts });   // 'sempre': resto da partida / emblema (114)
    },
  },
  // CR 613.1d/613.4b: vira um P/R com tipos (camada 4 e 7b), "além dos outros tipos". Preso ao objeto (o.anim, mesmo ts);
  // fimDoTurno sai na limpeza (514.2). Os números são lidos na resolução (611.2c). Lido no M.dadoDe (estado.ts).
  animar: {
    campos: ['p', 'r', 'tipos', 'sub', 'kw', 'cores', 'dura', 'todosTipos', 'tiraKw', 'habil', 'soSub', 'super'],   // super: "becomes a legendary …" (Cacophony Unleashed)
    qtd: q => q === undefined,
    // habil: só gatilhos, só até o fim do turno (Den of the Bugbear: "e ganha 'sempre que ataca, …'"): vão para o.ganhos.gat, que a limpeza zera (514.2)
    ok: f => f.em !== undefined && (f.soSub === undefined || (f.soSub === true && (f.sub || []).length > 0)) && (f.habil === undefined || (f.dura === 'fimDoTurno' && !!f.habil && Object.keys(f.habil).every(k => k === 'gat') && Array.isArray(f.habil.gat) && f.habil.gat.every(g => M.gatOk(g)))) && (f.dura === 'fimDoTurno' || f.dura === 'sempre' || (f.dura === 'enquantoNoCampo' && !f.habil)) && (f.p === undefined) === (f.r === undefined)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw) && M.kwListaOk(f.tiraKw) && (f.todosTipos === undefined || f.todosTipos === true)
      && (f.p !== undefined || (f.tipos || []).length > 0 || (f.sub || []).length > 0 || (f.kw || []).length > 0 || (f.tiraKw || []).length > 0),
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      const F0 = e.objs[ctx.este] && e.objs[ctx.este].zona === 'campo' ? e.objs[ctx.este] : null;
      if (f.dura === 'enquantoNoCampo' && !F0) return;                  // a fonte já saiu: a duração acabou antes de começar (611.2b)
      const n = q => typeof q === 'number' ? q : qtdDe(e, q, ctx);
      const pt = f.p !== undefined ? [n(f.p), n(f.r)] : undefined;
      for (const o of os) {
        // todosTipos (Mirror Entity, 205.3m): "ganha todos os tipos de criatura" = metamorfo dado (lido em tiposCriatura)
        const kw = f.todosTipos ? [...(f.kw || []), { k: 'metamorfo' }] : f.kw;
        (o.anim || (o.anim = [])).push({ ts: o.ts, tipos: f.tipos, sub: f.sub, soSub: !!f.soSub, ...(f.super ? { super: f.super } : {}), pt, kw, cores: f.cores, ...(f.tiraKw ? { tiraKw: f.tiraKw.map(x => x.k) } : {}), fim: f.dura === 'fimDoTurno' ? 'turno' : null, tE: e.ts, ...(f.dura === 'enquantoNoCampo' && F0 ? { src: { id: F0.id, ts: F0.ts, ctrl: ctx.voce } } : {}) });   // src: "for as long as you control [fonte]" (Welcome to . . . I)
        if (f.habil) o.ganhos = { ...(o.ganhos || {}), gat: [...((o.ganhos && o.ganhos.gat) || []), ...f.habil.gat] };   // 613.1f
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
    campos: ['dura', 'soConjurar', 'gratis', 'f', 'copia', 'cifra'],
    qtd: q => q === undefined || typeof q === 'number',
    ok: f => (f.em !== undefined) !== (f.f !== undefined) && [undefined, 'fimDoTurno', 'proximoTurnoSeu', 'proximoFinalSeu', 'sempre'].includes(f.dura)
      && (f.em === undefined || f.em === 'anterior' || (f.em === 'cifrada' && !!f.cifra && f.copia) || (f.em.todos && M.filtroOk(f.em.todos)) || typeof f.em.alvo === 'number') && !(f.f && f.dura) && !(f.copia && f.dura),
    fx(e, f, ctx, ask) {
      const j = ctx.voce;
      const cand = () => f.em === 'cifrada' ? [e.objs[f.cifra.id]].filter(o => o && o.ts === f.cifra.ts && o.zona === 'exilio')   // 702.99c: ainda codificada
        : f.f ? M.objetosQue(e, { ...f.f, zona: f.f.zona || 'mao' }, ctx) : objsDeQualquer(e, f, ctx);
      if (f.dura) {
        const fim = f.dura === 'fimDoTurno' ? 'turno' : f.dura === 'proximoTurnoSeu' ? j : f.dura === 'proximoFinalSeu' ? { final: j } : null;   // Inti: "until your next end step"
        for (const o of cand()) (e.permJogar || (e.permJogar = [])).push({ j, id: o.id, ts: o.ts, gratis: !!f.gratis, soConjurar: !!f.soConjurar, fim });
        return;
      }
      if (f.talvez) ctx.pagou = false;                              // "if you don't cast it" (Descendants' Path): {se:{pagou:false}} no efeito seguinte
      const feitos = ctx.jogo || (ctx.jogo = new Map()), max = typeof f.qtd === 'number' ? f.qtd : f.f ? 1 : Infinity;
      for (;;) {
        const n = feitos.get(f) || 0; if (n >= max) return;
        const ops: any[] = cand().filter(o => !(f.copia && ctx.copiasFeitas && ctx.copiasFeitas.has(o.id)) && !M.temTipo(e, o, 'Land') && M.podeConjurar(e, j, o, undefined, { agora: true, gratis: !!f.gratis })).map(o => ({ a: 'jogar', id: o.id }));
        if (!ops.length) return;
        if (f.talvez || ops.length > 1 || f.f) ops.push({ a: 'nenhum' });
        const r = ask(j, 'jogar', ops, { gratis: !!f.gratis });
        if (r.a === 'nenhum') return;
        const P0 = e.proc;
        let id = r.id;
        if (f.copia) {                                              // CR 707.12: "copy it, and you may cast the copy" (Mizzix's Mastery): a cópia
          const cps = ctx.copiasJogo || (ctx.copiasJogo = new Map());   // nasce na zona da carta e é ela que vai à pilha; fora da pilha deixa de existir
          if (!cps.has(r.id)) {                                     // (704.5e, M.mover); a original fica onde está. Memo: a pergunta repetida não copia de novo
            const o = e.objs[r.id], c = e.prox++;
            e.objs[c] = { id: c, n: o.n, dono: j, ctrl: j, zona: o.zona, ts: ++e.ts, virada: false, dano: 0, marc: {}, doente: false, cmd: false, face: null, copia: true };
            M.listaDe(e, e.objs[c]).push(c);
            cps.set(r.id, c);
          }
          id = cps.get(r.id);
        }
        M.PROC.conjurar(e, { j, id, agora: true, gratis: !!f.gratis, resp: [] }, ask);
        e.proc = P0;
        if (f.copia) { (ctx.copiasFeitas || (ctx.copiasFeitas = new Set())).add(r.id); if (e.objs[id].zona !== 'pilha') M.mover(e, id, 'fora'); }   // desistiu: a cópia some
        feitos.set(f, n + 1); if (f.talvez) ctx.pagou = true;
        ask.etapa();                                                // o conjurar mexeu no estado: a próxima pergunta começa do zero
      }
    },
    talvezDentro: true,
  },
  // CR 701.57a descobrir N: exila do topo até uma não-terreno com valor de mana ≤ N; conjura de graça ou põe na mão
  // (701.57b: se não conjurar); as outras exiladas vão para o fundo em ordem aleatória. qtd: número ou conta.
  // cascata: exila até uma não-terreno de valor MENOR (qtd = vm − 1); a não conjurada vai ao fundo com as outras (702.85a)
  descobrir: {
    campos: ['cascata'],
    ok: f => f.cascata === undefined || f.cascata === true,
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
        if (!f.cascata) { M.embaralhar(e, ex); for (const id of ex) if (e.objs[id].zona === 'exilio') M.mover(e, id, 'grimorio', { topo: false }); }
        else (ctx.cascEx || (ctx.cascEx = new Map())).set(f, ex);
        M.log(e, J.nome, f.cascata ? 'cascata' : 'descobre', n, ach ? '→ ' + ach.n : '(nada)', ex.length ? `(${ex.length} para o fundo)` : '');
        feitos.set(f, ach ? { id: ach.id, ts: ach.ts } : null);
      }
      const F0 = feitos.get(f), achou = F0 && e.objs[F0.id];
      const fundo = (ids: number[]) => { const r = ids.filter(id => e.objs[id] && e.objs[id].zona === 'exilio'); M.embaralhar(e, r); for (const id of r) M.mover(e, id, 'grimorio', { topo: false }); };
      if (!achou || achou.ts !== F0.ts || achou.zona !== 'exilio') { if (f.cascata) fundo((ctx.cascEx && ctx.cascEx.get(f)) || []); return; }
      const pode = M.podeConjurar(e, j, achou, undefined, { agora: true, gratis: true });
      const nao = f.cascata ? 'fundo' : 'mao';
      const r = pode ? ask(j, 'jogar', [{ a: 'jogar', id: achou.id }, { a: nao, id: achou.id }], { gratis: true }) : { a: nao };
      if (f.cascata) fundo([...((ctx.cascEx && ctx.cascEx.get(f)) || []), ...(r.a === 'jogar' ? [] : [achou.id])]);   // 702.85a: o resto (e a não conjurada) ao fundo, ordem aleatória
      if (r.a === 'jogar') { const P0 = e.proc; M.PROC.conjurar(e, { j, id: achou.id, agora: true, gratis: true, resp: [] }, ask); e.proc = P0; ask.etapa(); }
      else if (!f.cascata) M.mover(e, achou.id, 'mao');
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
    fx(e, f, ctx, ask?) {
      // deQuem 'oponenteEscolhido' (Faramir: "choose an opponent. At the beginning of that player's next end step"): escolhe agora
      let jog;
      if (f.quando.deQuem === 'oponenteEscolhido') {
        const ops = M.vivos(e).filter(x => x !== ctx.voce); if (!ops.length) return;
        jog = ops.length === 1 || !ask ? ops[0] : ask(ctx.voce, 'escolha', ops.map(x => ({ a: 'jogador', jog: x })), { o: 'oponente', fonte: (e.objs[ctx.este] || {}).n }).jog;
      }
      (e.atras || (e.atras = [])).push({ g: f.quando, ctrl: ctx.voce, fonte: ctx.este, n: (e.objs[ctx.este] || e.objs[ctx.item] || {}).n, t: e.turno.n,
        lki: (ctx.lki && ctx.lki.este) || (e.objs[ctx.este] && e.objs[ctx.este].zona === 'campo' ? M.lkiDe(e, e.objs[ctx.este]) : null), mem: { criadas: ctx.criadas || [], ...(jog !== undefined ? { jog } : {}), ...(M.alvosUsados(f.quando.fx).length ? { alvos: ctx.alvos, ilegal: ctx.ilegal, lkiAlvos: ctx.lki && ctx.lki.alvos } : {}), ...(JSON.stringify(f.quando.fx).includes('"anterior"') ? { movidos: (ctx.movidos || []).slice() } : {}) }, ts: ++e.ts });
    },
  },
  // miríade (CR 702.116a): para cada oponente que não é o defensor, pode criar uma ficha cópia desta, virada e atacando
  // esse jogador; as fichas são exiladas no fim do combate (gatilho atrasado). Simplificação: ataca o jogador, nunca
  // um planeswalker dele. Pergunta tudo antes de mexer (o processo roda de novo a cada pergunta).
  miriade: {
    ok: () => false,                                                // só o gatilho da palavra-chave (gatilhos.ts)
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este], C = e.turno.combate; if (!o || o.zona !== 'campo' || !C) return;
      const a = C.atk.find(x => x.id === o.id), def = a ? a.def : undefined;
      const quem = M.vivos(e).filter(j => j !== ctx.voce && j !== def)
        .filter(j => ask(ctx.voce, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'miriade', jog: j }).a === 'sim');
      if (!quem.length) return;
      const tok = copiaDe(e, { copiaDe: 'este' }, ctx); if (!tok) return;
      const criadas: any[] = [];
      for (const j of quem) for (const t of M.criarFichas(e, ctx.voce, tok, 1, { virada: true })) { M.porAtacando(e, t, { jog: j }); criadas.push({ id: t.id, ts: t.ts }); }
      H.gatilhoAtrasado.fx(e, { quando: { ev: 'fase', passo: 'fimCombate', deQuem: 'voce', nesteTurno: true, fx: [{ op: 'exilar', em: 'criadas' }] } }, { ...ctx, criadas });
    },
  },
  // persistir (CR 702.79a): a carta que morreu (mesmo objeto no cemitério: ev.tsCem) volta ao campo do dono com um -1/-1
  desaparecer: {                                                    // 702.63a (vanishing), só do gatilho da palavra-chave: tira um marcador de tempo; tirou o último, sacrifica
    ok: () => false,
    fx(e, f, ctx) {
      const o = e.objs[ctx.este]; if (!o || o.zona !== 'campo' || (ctx.lki.este && o.ts !== ctx.lki.este.ts) || !(o.marc.time > 0)) return;
      o.marc.time--; M.log(e, o.n, 'perde um marcador de tempo (' + o.marc.time + ')');
      if (o.marc.time === 0) M.mover(e, o.id, 'cemiterio', { sac: true });   // 701.21
    },
  },
  persistir: {
    ok: () => false,
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este]; if (!o || o.zona !== 'cemiterio' || !ctx.ev || o.ts !== ctx.ev.tsCem) return;
      M.aplicarEntrada(e, { ...M.decidirEntrada(e, o.id, o.dono, {}, ask), marc: { [f.marc || '-1/-1']: 1 } });   // imortal: marc '+1/+1'
    },
  },
  // explorar (CR 701.44a): revela o topo; terreno vai para a mão; senão, +1/+1 na criatura e o controlador pode pôr a
  // revelada no cemitério (senão fica no topo). A que saiu do campo ainda explora, sem marcador (701.44b). Uma por vez (701.44c).
  explorar: {
    fx(e, f, ctx, ask) {
      const feitos = ctx.expl || (ctx.expl = new Map());           // o processo roda de novo a cada pergunta: quem já explorou não repete
      const vezes = o => substsDe(e, 'explorar').reduce((m, { F, s }) => substSe(e, F, s) && substQuem(e, F, s, o) ? m * s.muda.mult : m, 1);   // 614.1a: "instead it explores, then it explores again" (Topography Tracker)
      const lista = feitos.get(f) || (feitos.set(f, { ids: objsDe(e, f, ctx).flatMap(o => Array(vezes(o)).fill(o.id)), n: 0 }), feitos.get(f));
      for (; lista.n < lista.ids.length; lista.n++) {
        const o = e.objs[lista.ids[lista.n]], j = o.ctrl, g = e.jogs[j].zonas.grimorio, top = g[g.length - 1];
        if (top === undefined) { if (o.zona === 'campo') M.porMarcadores(e, o, '+1/+1', 1); M.evento(e, { ev: 'explora', id: o.id, j }); continue; }   // grimório vazio: nada revelado, não é terreno
        const t = e.objs[top];
        if (M.temTipo(e, t, 'Land')) { M.mover(e, top, 'mao'); M.log(e, o.n, 'explora: terreno', t.n); M.evento(e, { ev: 'explora', id: o.id, j, terreno: true }); continue; }
        const r = ask(j, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'explorarCemiterio', id: top });   // pergunta antes de mexer
        if (o.zona === 'campo') M.porMarcadores(e, o, '+1/+1', 1);
        if (r.a === 'sim') M.mover(e, top, 'cemiterio');
        M.log(e, o.n, 'explora:', t.n, r.a === 'sim' ? '→ cemitério' : '(fica no topo)');
        M.evento(e, { ev: 'explora', id: o.id, j, terreno: false });   // gatilho "sempre que uma criatura sua explora" (lote B); terreno: o que revelou (Nicanzil)
      }
    },
  },
  // incitar (CR 701.38a): até o próximo turno de quem incitou, a criatura ataca em cada combate se puder e ataca um
  // jogador que não seja quem a incitou, se puder (701.38b; combate.ts PROC.atacar). Vários incitadores somam (701.38c).
  incitar: {
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo' && M.temTipo(e, o, 'Creature')); if (!os.length) return;
      (e.efTemp || (e.efTemp = [])).push({ ctrl: ctx.voce, est: [{ modo: 'deveAtacar' }, { modo: 'incitado' }], este: null, ids: os.map(o => ({ id: o.id, ts: o.ts })), fim: ctx.voce, ts: ++e.ts });
      M.log(e, e.jogs[ctx.voce].nome, 'incita', os.map(o => o.n).join(', '));
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
  // do campo no meio fica de fora (400.7). cada {alvo:N}: cada alvo legal daquele grupo (Twinflame). repetirCada dentro de outro: ainda não.
  repetirCada: {
    campos: ['cada', 'fx'],
    ok: f => !dentroCada && !dentroObj && Array.isArray(f.fx) && f.fx.length > 0 && f.fx.every(x => x.op !== 'modal')
      && ((f.cada === 'cadaOponente' || f.cada === 'cadaJogador' || f.cada === 'umJogador' || f.cada === 'oponente') ? comCada(() => M.fxSuportado(f.fx, { topo: false }))
        : !!f.cada && typeof f.cada === 'object' && (Number.isInteger(f.cada.alvo) && Object.keys(f.cada).length === 1 || M.filtroOk(f.cada)) && comObj(() => M.fxSuportado(f.fx, { topo: false }))),
    fx(e, f, ctx, ask) {
      const obj = typeof f.cada === 'object';
      let R = ctx.rep;
      if (!R) {   // a lista sai antes de tudo; se perguntou (cada 'umJogador'), a resposta já ficou na lista: zera para os efeitos de dentro
        R = ctx.rep = { f, js: obj ? (Number.isInteger(f.cada.alvo) ? objsDe(e, { em: f.cada }, ctx) : M.objetosQue(e, f.cada.zona ? f.cada : { ...f.cada, zona: 'campo' }, ctx)).map(o => ({ id: o.id, ts: o.ts })) : jogsDe(e, { quem: f.cada, op: 'repetirCada' }, ctx), k: 0, i: 0 };
        if (ask && ask.etapa) ask.etapa();
      }
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
  // CR 701.37: monstruosidade N — se não é monstruosa, põe N marcadores +1/+1 e fica monstruosa (o.monstro = ts do objeto:
  // mudou de zona, é objeto novo e não é mais, 400.7). Ativar de novo não faz nada; "quando fica monstruosa" (701.37b).
  monstruosidade: {
    qtd: q => typeof q === 'number' || qtdOk(q),
    fx(e, f, ctx) {
      for (const o of objsDe(e, f.em === undefined ? { em: 'este' } : f, ctx)) {
        if (o.zona !== 'campo' || o.monstro === o.ts) continue;
        M.porMarcadores(e, o, '+1/+1', qtdDe(e, f.qtd, ctx)); o.monstro = o.ts;
        M.log(e, o.n, 'fica monstruosa'); M.evento(e, { ev: 'ficaMonstruosa', id: o.id, ts: o.ts });
      }
    },
  },
  regenerar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (o.zona === 'campo') M.porRegen(e, o); } },   // CR 701.15a
  // dura 'enquantoNoCampo' (CR 610.3): "exile … until [esta] leaves the battlefield" — volta ao campo do dono quando a
  // fonte sai (estado.ts M.mover, e.volta); se a fonte já saiu antes de resolver, não exila (610.3c)
  exilar: {
    campos: ['dura'],
    ok: f => f.dura === undefined || f.dura === 'enquantoNoCampo',
    fx(e, f, ctx) {
      let F: any = null;
      if (f.dura) { F = e.objs[ctx.este]; if (!F || F.zona !== 'campo' || (ctx.lki.este && ctx.lki.este.ts !== F.ts)) return; }
      const os = objsDe(e, f, ctx); for (const o of os) M.mover(e, o.id, 'exilio'); ctx.movidos = movidos(e, os.map(o => o.id));
      if (F && os.length) (e.volta || (e.volta = [])).push({ id: F.id, ts: F.ts, ids: ctx.movidos.map(m => ({ id: m.id, ts: m.ts })) });
      if (F) for (const m of ctx.movidos) if (e.objs[m.id].zona === 'exilio') e.objs[m.id].exPor = { id: F.id, ts: F.ts };   // "exiled with this" (607.2a: Bronzebeak Foragers {X}{W})
    },
  },
  mover: {
    campos: ['para', 'de', 'virada', 'f', 'fundo', 'sobControle', 'transformada', 'atacando', 'comEste', 'faceBaixo', 'aleatorio', 'exilaAoSair', 'tiraTipo', 'posicao'],
    qtd: q => qtdOk(q) || ateOk(q),
    ok: f => (['mao', 'campo', 'cemiterio', 'exilio', 'grimorio'].includes(f.para) || (f.para === 'comando' && f.em !== undefined)) && (f.em !== undefined || (f.f && (typeof f.qtd === 'number' || ateOk(f.qtd)))),
    fx(e, f, ctx, ask) {
      let ids;
      // em 'este' com de: a carta que acabou de ir para lá (o gatilho de mudar de zona acha o objeto novo, CR 603.6/400.7)
      if (f.em === 'este' && f.de) { const o = e.objs[ctx.este]; ids = o && o.zona === f.de && !o.hab ? [o.id] : []; }
      // em alvo com de: o alvo que o efeito anterior acabou de mover para lá ("exile target creature, then return it", Ephemerate; 400.7: objeto novo, achado por ctx.movidos)
      else if (f.de && f.em && typeof f.em === 'object' && Number.isInteger(f.em.alvo)) { const v = objsDe(e, f, ctx).map(o => o.id); ids = [...v, ...((ctx.alvos || [])[f.em.alvo] || []).map(a => a.o).filter(id => { const o = e.objs[id]; return o && !v.includes(id) && o.zona === f.de && (ctx.movidos || []).some(m => m.id === id && m.ts === o.ts); })]; }
      else if (f.em !== undefined) ids = objsDe(e, f, ctx).map(o => o.id);
      else {                                                        // "ponha N cartas da sua mão…" (Brainstorm)
        const j = jogsDe(e, f, ctx)[0]; if (j === undefined) return;
        const z = f.de || f.f.zona || 'mao';
        const cand = M.objetosQue(e, { ...f.f, zona: z, dono: f.f.dono || 'voce' }, { ...ctx, voce: j }).map(o => o.id);
        const nq = Math.min(qtdDe(e, f.qtd, ctx), cand.length);
        if (f.aleatorio) { const c = [...cand]; ids = []; for (let i = 0; i < nq; i++) ids.push(c.splice(Math.floor(M.aleat(e) * c.length), 1)[0]); }   // "at random" (Tomb Tyrant): ninguém escolhe
        else ids = escolherN(ask, j, 'escolherCarta', cand, nq, { podeMenos: ateOk(f.qtd), ctx: { op: 'mover', para: f.para } });
      }
      if (f.para === 'comando') ids = ids.filter(id => e.objs[id].cmd);   // só comandante vai para a zona de comando (Hellkite Courser, 903)
      // transformada (CR 712.14a): entra com a face de trás; carta que não é de transformar fica onde está
      if (f.transformada) ids = ids.filter(id => { const c = e.objs[id].ficha ? null : M.carta(e.objs[id].n); return f.para === 'campo' && c && c.forma === 'duplaFace' && c.faces; });
      ctx.resultado = ids.length;                                   // "then draw that many" (Valakut Awakening)
      if (f.talvez) ctx.pagou = ids.length > 0;                     // "se fizer": pôr ao menos uma
      const ent = f.para === 'campo' ? ids.map(id => M.decidirEntrada(e, id, f.sobControle === 'voce' ? ctx.voce : e.objs[id].dono, { virada: !!f.virada, ...(f.transformada ? { face: 0 } : {}) }, ask)) : [];
      // CR 508.4: entra atacando (sem declarar: não dispara "ataca"); quem controla escolhe quem ela ataca, entre os que poderia atacar
      const atk = f.atacando && e.turno.combate ? ent.map(p => M.escolherAtacado(e, p.ctrl, ask)) : [];
      // posta no campo por esta habilidade (Kodama: "if it wasn't put onto the battlefield with this ability"): e.postoAgora
      // vale durante a entrada (o gatilho de entrar olha na hora, 603.4); depois fica no objeto (id+ts)
      if (f.para === 'campo') ent.forEach((p, k) => { e.postoAgora = { fonte: ctx.este, id: p.id }; let o; try { o = M.aplicarEntrada(e, f.tiraTipo ? { ...p, anim: [{ tiraTipo: f.tiraTipo }] } : p); } finally { e.postoAgora = null; } if (o) o.postoPor = { fonte: ctx.este, ts: o.ts }; if (atk[k]) M.porAtacando(e, o, atk[k]); if (f.exilaAoSair && o && o.zona === 'campo') o.exilaAoSair = true; });   // desenterrar (702.84a)
      else for (const id of ids) M.mover(e, id, f.para, { topo: !f.fundo, pos: f.posicao });
      if (f.faceBaixo && f.para === 'exilio') for (const id of ids) { const X = e.objs[id]; if (X.zona === 'exilio') { X.faceBaixo = true; X.olham = []; } }   // 406.3: exilada virada para baixo, ninguém vê
      if (f.comEste && f.para === 'exilio') { const F = e.objs[ctx.este]; if (F) for (const id of ids) if (e.objs[id].zona === 'exilio') e.objs[id].exPor = { id: F.id, ts: (ctx.lki && ctx.lki.este && ctx.lki.este.ts) ?? F.ts }; }   // "exiled with this" (607.2a)
      ctx.movidos = movidos(e, ids);
    },
  },
  // mana na resolução (CR 106.3, fora de habilidade de mana: Path of the Pyromancer, Neheb, Birgi). prod com várias
  // cores = uma delas, à escolha; ficaNoTurno: não esvazia entre etapas e fases até o fim do turno (Neheb, Birgi)
  mana: {
    campos: ['prod', 'ficaNoTurno', 'ficaNoCombate', 'so'],
    ok: f => f.prod !== undefined && !['refletida', 'deSeusTerrenos'].includes(f.prod) && (f.so === undefined || !!M.filtroSo({}, f.so)),
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx); if (q <= 0) return;
      const F = e.objs[ctx.este] || { ctrl: ctx.voce, escolha: null };
      const cs = M.coresDeProd(e, { ...F, ctrl: ctx.voce }, f.prod); if (!cs || !cs.length) return;
      const J = e.jogs[ctx.voce];
      if (f.prod.cadaCor) { for (const c of cs) J.reserva[c] += q; M.log(e, J.nome, 'recebe', cs.map(c => c.repeat(q)).join('')); return; }   // uma de cada cor
      const c = cs.length === 1 ? cs[0] : ask(ctx.voce, 'escolha', cs.map(v => ({ a: 'cor', v })), { o: 'cor' }).v;
      // restrita (CR 106.6, Klauth: "spend this mana only to cast spells"): vai para J.restrita; com ficaNoTurno fica até o fim do turno
      if (f.so) { const m = M.zeroMana(); m[c] = q; (J.restrita || (J.restrita = [])).push({ m, f: M.filtroSo(F, f.so), ...(f.ficaNoTurno ? { fica: e.turno.n } : {}) }); M.log(e, J.nome, 'recebe', c.repeat(q), '(só para ' + (M.fmtFiltroSo(M.filtroSo(F, f.so)) || 'mágicas') + ')'); return; }
      J.reserva[c] += q;
      if (f.ficaNoTurno) { if (!J.fica || J.fica.t !== e.turno.n) J.fica = { t: e.turno.n, m: M.zeroMana() }; J.fica.m[c] += q; }
      else if (f.ficaNoCombate) { if (!J.ficaC || J.ficaC.t !== e.turno.n) J.ficaC = { t: e.turno.n, m: M.zeroMana() }; J.ficaC.m[c] += q; }   // firebending: "until end of combat"
      M.log(e, J.nome, 'recebe', c.repeat(q));
    },
  },
  ganharVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) M.ganharVida(e, j, q); } },   // CR 119.3
  ganharJogo: { fx(e, f, ctx) {                                     // CR 104.2b: o efeito diz que ele vence; no multijogador os outros perdem juntos (104.3h)
    if (e.fim) return;
    const j = jogsDe(e, f, ctx).find(x => !e.jogs[x].saiu);
    if (j === undefined || M.naoVence(e, j)) return;   // um oponente com "your opponents can't win" (104.2)
    M.log(e, e.jogs[j].nome, 'vence o jogo por efeito');
    e.fim = { vencedor: j, motivo: 'efeito: vence o jogo', turno: e.turno.n };
  } },
  perderJogo: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) if (!e.jogs[j].saiu && !M.naoPerde(e, j)) M.sair(e, j, 'efeito: perde o jogo'); } },   // CR 104.3e/800.4a
  // CR 119.5: "X's life total becomes N" = ganha ou perde a diferença (vida fixa, 119.8: não muda)
  vidaVira: { fx(e, f, ctx) {
    const q = qtdDe(e, f.qtd, ctx);
    for (const j of jogsDe(e, f, ctx)) { const d = q - e.jogs[j].vida; if (d > 0) M.ganharVida(e, j, d); else if (d < 0 && !M.vidaFixa(e, j)) M.perderVida(e, j, -d); M.log(e, e.jogs[j].nome, 'fica com', e.jogs[j].vida, 'de vida'); }
  } },
  perderVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) if (!M.vidaFixa(e, j)) M.perderVida(e, j, q); } },   // 119.7
  copiarMagica: {                                                   // CR 707.10: "copy that spell" (pilha.ts: M.alvosDaCopia/M.criarCopia)
    campos: ['novoAlvo', 'cadaOutroAlvo', 'miraCriada'],
    ok: f => (!f.cadaOutroAlvo || (f.em === 'doEvento' && f.qtd === undefined && !f.novoAlvo)) && (!f.miraCriada || (f.em === 'doEvento' && f.qtd === undefined && !f.novoAlvo && !f.cadaOutroAlvo)),
    fx(e, f, ctx, ask) {
      let o: any = null;
      if (f.em === 'doEvento') o = objsDe(e, { em: 'doEvento', de: 'pilha' }, ctx)[0];          // a mágica conjurada (Archmage, Zada)
      else if (f.em === 'este') { const S = e.objs[ctx.este]; o = S && S.zona === 'pilha' && !S.hab && (!ctx.lki.este || S.ts === ctx.lki.este.ts) ? S : null; }   // ela mesma na pilha (Bygone Marvels)
      else o = objsDe(e, f, ctx).find(x => x.zona === 'pilha') || null;                      // a mágica alvo (Dualcaster)
      if (!o || o.zona !== 'pilha' || o.hab || !o.pil) return;
      if (f.cadaOutroAlvo) {                                         // "copy that spell for each other creature you control that the spell could target" (Zada): cada cópia mira uma delas
        const d = M.dadoDe(e, o), F = e.objs[ctx.este], i = (o.pil.alvos || []).findIndex(l => l && l.length === 1 && F && l[0].o === F.id);
        const a = i >= 0 && (d.alvos || [])[i]; if (!a) return;
        const cx = { voce: o.pil.ctrl ?? o.ctrl, este: o.id, x: o.pil.x };
        for (const id of [...e.campo]) {
          const x = e.objs[id]; if (id === F.id || x.ctrl !== ctx.voce || !M.temTipo(e, x, 'Creature') || !M.alvoLegal(e, a, { o: x.id, ts: x.ts }, cx)) continue;
          M.criarCopia(e, o, ctx.voce, { alvos: o.pil.alvos.map((l, k) => k === i ? [{ o: x.id, ts: x.ts }] : (l || []).map(y => ({ ...y }))), novos: true });
        }
        return;
      }
      if (f.miraCriada) {                                            // "then copy that spell. The copy targets that token" (Frontline Heroism): o único alvo vira a ficha criada
        const t = objsDe(e, { em: 'criadas' }, ctx)[0]; if (!t) return;
        M.criarCopia(e, o, ctx.voce, { alvos: (o.pil.alvos || []).map(l => (l || []).map(y => y && y.o !== undefined ? { o: t.id, ts: t.ts } : { ...y })), novos: true });
        return;
      }
      const n = f.qtd === undefined ? 1 : Math.max(0, qtdDe(e, f.qtd, ctx));
      const planos: any[] = [];
      for (let k = 0; k < n; k++) planos.push(M.alvosDaCopia(e, o, ctx.voce, !!f.novoAlvo, ask));   // pergunta tudo antes de mexer
      for (const pl of planos) M.criarCopia(e, o, ctx.voce, pl);
    },
  },
  // soulbond (CR 702.95a): "you may pair this creature with another unpaired creature" — ao resolver, esta (a fonte) e a
  // outra têm de estar no campo, ser criaturas suas e sem par (702.95b: senão nada); em 'doEvento' = a que entrou, senão escolhe.
  parear: {
    ok: f => f.em === undefined || f.em === 'doEvento',
    fx(e, f, ctx, ask) {
      const F = e.objs[ctx.este], j = ctx.voce;
      const livre = o => !!o && o.zona === 'campo' && o.ctrl === j && M.temTipo(e, o, 'Creature') && !M.parDe(e, o);
      if (!livre(F) || (ctx.lki && ctx.lki.este && F.ts !== ctx.lki.este.ts)) return;
      const cand = f.em === 'doEvento' ? objsDe(e, f, ctx).filter(o => o.id !== F.id && livre(o))
        : e.campo.map(id => e.objs[id]).filter(o => o.id !== F.id && livre(o));
      if (!cand.length) return;
      const r = ask(j, 'parear', [...cand.map(o => ({ a: 'parear', id: o.id })), { a: 'nenhum' }], { id: F.id });
      if (r.a !== 'parear') return;
      M.parear(e, F, e.objs[r.id]);
    },
  },
  // CR 707.10: "copy target activated or triggered ability [you control]" (Weaver of Harmony): a cópia vai para a pilha
  // controlada por quem copiou, com os mesmos alvos/modos/X; novoAlvo = "you may choose new targets for the copy".
  // Copiar não é ativar (602.1): não dispara "whenever you activate", não paga custo de novo.
  copiarHabilidade: {
    campos: ['novoAlvo'],
    fx(e, f, ctx, ask) {
      const n = f.qtd === undefined ? 1 : Math.max(0, qtdDe(e, f.qtd, ctx));
      for (const o of objsDe(e, f, ctx)) {
        if (o.zona !== 'pilha' || !o.hab || !o.pil || o.id === ctx.item) continue;
        const planos: any[] = [];
        for (let k = 0; k < n; k++) planos.push(M.alvosDaCopia(e, o, ctx.voce, !!f.novoAlvo, ask));
        for (const pl of planos) M.criarCopia(e, o, ctx.voce, pl);
      }
    },
  },
  trocarAlvos: { fx(e, f, ctx, ask) {                                // "you may choose new targets for target spell or ability" (115.7d): mesmo número, alvos legais
    for (const o of objsDe(e, f, ctx)) {
      if (o.zona !== 'pilha' || !o.pil || o.id === ctx.item) continue;
      const pl = M.alvosDaCopia(e, o, ctx.voce, true, ask);
      if (!pl.novos) continue;
      o.pil.alvos = pl.alvos; M.eventosAlvo(e, pl.alvos, o.id);
      M.log(e, o.n, 'muda de alvo');
    }
  } },
  // "you may have this become a copy of [fonte] (until end of turn), except its name is … (and it has this ability)"
  // CR 707.2/707.9b: o objeto passa a ter os valores copiáveis da fonte (camada 1, o.clone); dura fimDoTurno volta ao
  // que era (o.clone0) na limpeza (turno.ts). Só 'em: este' no campo, a fonte no campo (Sunfrill Imitator, Sarkhan).
  copiarPermanente: {
    campos: ['fonte', 'mantemNome', 'mantemGat', 'super', 'dura'],
    ok: f => f.em === 'este' && f.fonte !== undefined && emOk(f.fonte) && (f.dura === undefined || f.dura === 'fimDoTurno')
      && (f.super === undefined || (Array.isArray(f.super) && f.super.every(x => typeof x === 'string'))),
    fx(e, f, ctx) {
      const O = e.objs[ctx.este];
      if (!O || O.zona !== 'campo' || (ctx.lki && ctx.lki.este && O.ts !== ctx.lki.este.ts)) return;
      const S = objsDe(e, { em: f.fonte }, ctx).find(x => x.zona === 'campo' && x.id !== O.id);
      if (!S) return;
      const { faces, forma, ...base } = M.dadoBase(e, S), meu = O.ficha || M.carta(O.n);
      const clone = { ...base, n: f.mantemNome ? O.n : base.n || S.n,
        ...(f.super ? { super: [...new Set([...(base.super || []), ...f.super])] } : {}),
        ...(f.mantemGat ? { gat: [...(base.gat || []), ...(meu.gat || [])] } : {}) };
      if (f.dura === 'fimDoTurno') { if (O.cloneFim !== 'turno') O.clone0 = O.clone || null; O.cloneFim = 'turno'; } else { O.clone0 = null; O.cloneFim = null; }
      O.clone = clone; e.vCamada = (e.vCamada || 0) + 1;
      M.log(e, e.jogs[O.ctrl].nome, O.n, 'vira cópia de', S.n, f.dura === 'fimDoTurno' ? '(até o fim do turno)' : '');
    },
  },
  // perdeFonte (Tishana's Tidebinder): anulada uma habilidade de [f], a fonte perde todas as habilidades enquanto esta
  // estiver no campo (613.1f; o.anim semHab com src, lido no M.dadoDe). Fonte que já saiu, ou esta que já saiu: nada.
  anular: {
    campos: ['perdeFonte'],
    ok: f => f.perdeFonte === undefined || (!!f.perdeFonte && Object.keys(f.perdeFonte).every(k => k === 'f') && M.filtroOk(f.perdeFonte.f || {})),
    fx(e, f, ctx) {
      for (const o of objsDe(e, f, ctx)) {
        if (o.zona !== 'pilha') continue;
        const h = o.hab, foi = M.anular(e, o.id);
        if (!foi || !f.perdeFonte || !h) continue;
        const S = e.objs[h.fonte], F0 = e.objs[ctx.este];
        if (!S || S.zona !== 'campo' || S.ts !== h.fonteTs || !F0 || F0.zona !== 'campo' || !M.bate(e, S, { ...(f.perdeFonte.f || {}), zona: 'campo' }, ctx)) continue;
        (S.anim || (S.anim = [])).push({ ts: S.ts, semHab: true, tE: ++e.ts, fim: null, src: { id: F0.id, ts: F0.ts } });
        e.vCamada = (e.vCamada || 0) + 1;
        M.log(e, S.n, 'perde todas as habilidades');
      }
    },
  },   // CR 701.6
  ficha: {                                                          // CR 111
    campos: ['token', 'virada', 'atacando', 'porJogadorAtacado', 'bloqueando'],
    ok: f => (!f.token || !Array.isArray(f.token.pt) || f.token.pt.every(x => typeof x === 'number' || qtdOk(x))) && ((f.porJogadorAtacado === undefined || (f.porJogadorAtacado === true && f.atacando === true)) && (f.atacando === undefined || (f.atacando === true && f.virada === true)) && !f.token || f.token.copiaDe === undefined || f.token.copiaDe === 'doEvento' || f.token.copiaDe === 'este' || f.token.copiaDe === 'sacrificada' || f.token.copiaDe === 'equipada' || (f.token.copiaDe === 'cadaAtual' && dentroObj > 0) || (typeof f.token.copiaDe === 'object' && (typeof f.token.copiaDe.alvo === 'number' || (!!f.token.copiaDe.um && Object.keys(f.token.copiaDe).length === 1 && M.filtroOk(f.token.copiaDe.um)))))
      && (!f.token || !f.token.gat || f.token.gat.every(g => M.gatOk(g))),   // a habilidade desencadeada da ficha também tem que ser lida (Munitions, Elemental do Wildfire Awakener)
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx); ctx.criadas = [];
      let tok = f.token && f.token.copiaDe !== undefined ? copiaDe(e, f.token, ctx) : f.token;
      if (!tok) return;
      if (Array.isArray(tok.pt) && tok.pt.some(x => typeof x !== 'number')) tok = { ...tok, pt: tok.pt.map(x => typeof x === 'number' ? x : Math.max(0, qtdDe(e, x, ctx))) };   // "X/X", "P/R igual a…": vale ao criar (Skullspore Nexus, Assemble the Entmoot)
      // "para cada jogador que você está atacando, crie … virada e atacando aquele jogador" (Soaring Lightbringer, 506.2)
      if (f.porJogadorAtacado) {
        const C = e.turno.combate; if (!C) return;
        const defs = [...new Set(C.atk.filter(r => r.alvo && r.alvo.jog !== undefined && e.objs[r.id] && e.objs[r.id].ctrl === ctx.voce).map(r => r.alvo.jog))];
        for (const d of defs) for (const j of jogsDe(e, f, ctx)) for (const o of M.criarFichas(e, j, tok, q, { virada: true })) { ctx.criadas.push({ id: o.id, ts: o.ts }); M.porAtacando(e, o, { jog: d }); }
        return;
      }
      for (const j of jogsDe(e, f, ctx)) for (const o of M.criarFichas(e, j, tok, q, { virada: !!f.virada })) {
        ctx.criadas.push({ id: o.id, ts: o.ts });
        // CR 508.4: "virada e atacando" — fora do combate só entra virada; no "para cada oponente", ataca aquele jogador
        if (f.atacando && e.turno.combate) { const t = M.escolherAtacado(e, o.ctrl, ask || ((_j, _t, ops) => ops[0]), ctx.cadaAtual); if (t) M.porAtacando(e, o, t); }
        // "that's blocking that creature" (Brimaz, 506.3/509.1h): entra bloqueando o atacante do evento 'bloqueia' (não foi declarada: não dispara "bloqueia")
        if (f.bloqueando && e.turno.combate && ctx.ev && ctx.ev.atk !== undefined) { const r = e.turno.combate.atk.find(x => x.id === ctx.ev.atk && e.objs[x.id] && e.objs[x.id].ts === x.ts && e.objs[x.id].zona === 'campo'); if (r) { r.bloq.push({ id: o.id, ts: o.ts }); r.bloqueado = true; } }
      }
    },
  },
  // o Anel te tenta (CR 701.54a): o emblema ganha a próxima habilidade (até 4) e você escolhe uma criatura sua como
  // Portador (pode ser a mesma; sem criatura, só o emblema). O Portador é lendário etc. (estado.ts M.ehPortador/gatAnel)
  // selar (702.171a): esta Montaria fica selada até o fim do turno (lida no filtro 'selada')
  // 702.122c: "a Vehicle becomes crewed" quando a tripular resolve (só a do próprio tripular: op interna, não vem do banco)
  tripulada: {
    ok: f => Object.keys(f).length === 1,
    fx(e, f, ctx) { const o = e.objs[ctx.este]; if (!o || o.zona !== 'campo') return; M.evento(e, { ev: 'tripulada', id: o.id, ts: o.ts }); },
  },
  selar: {
    ok: f => f.em === undefined && f.quem === undefined,
    fx(e, f, ctx) { const o = e.objs[ctx.este]; if (!o || o.zona !== 'campo') return; o.selada = { ts: o.ts, t: e.turno.n }; M.log(e, o.n, 'fica selada'); },
  },
  // CR 719.3: "To solve — [condição]" = no começo do seu passo final, se a condição vale, este Caso fica resolvido
  resolverCaso: {
    ok: f => f.em === undefined && f.quem === undefined,
    fx(e, f, ctx) { const o = e.objs[ctx.este]; if (!o || o.zona !== 'campo' || o.solved === o.ts) return; o.solved = o.ts; e.vCamada = (e.vCamada || 0) + 1; M.log(e, o.n, 'resolvido'); },
  },
  tentarAnel: {
    fx(e, f, ctx, ask) {
      for (const j of jogsDe(e, f, ctx)) {
        const J = e.jogs[j], A = J.anel = { n: ((J.anel && J.anel.n) || 0) + 1, p: J.anel ? J.anel.p : null };
        const cand = M.objetosQue(e, { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
        if (cand.length) { const [id] = escolherN(ask, j, 'escolherCarta', cand, 1, { ctx: { op: 'portador' } }); A.p = { id, ts: e.objs[id].ts }; }
        e.vCamada = (e.vCamada || 0) + 1;
        M.log(e, J.nome, 'é tentado pelo Anel (' + A.n + ')', A.p ? '→ ' + e.objs[A.p.id].n : '');
        if (A.p && M.evento && cand.length) M.evento(e, { ev: 'portador', j, id: A.p.id });   // 701.54a (Call of the Ring)
      }
    },
  },
  // CR 701.47: amassar [tipo] N. Sem Armada (criatura Army) sua, cria uma ficha 0/0 preta [tipo] Army; depois escolhe
  // uma Armada sua (a maior), põe N marcadores +1/+1 e, se não for do [tipo], ela passa a ser também (701.47a).
  // Simplificação: o tipo a mais vai para os valores da ficha (fica numa cópia dela); Armada que não é ficha não ganha o tipo.
  amassar: {
    campos: ['sub'],
    ok: f => (f.quem === undefined || f.quem === 'voce') && Array.isArray(f.sub) && f.sub.length <= 1 && f.sub.every(x => typeof x === 'string') && f.em === undefined,
    fx(e, f, ctx) {
      const q = qtdDe(e, f.qtd, ctx), j = ctx.voce, sub = (f.sub || [])[0];
      const armadas = () => e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && M.temTipo(e, o, 'Creature') && (t => t === 'todos' || t.includes('Army'))(M.tiposCriatura(e, o)));
      if (!armadas().length) M.criarFichas(e, j, { tipos: ['Creature'], sub: sub ? [sub, 'Army'] : ['Army'], cores: 'B', pt: [0, 0] }, 1);
      const a = armadas().sort((x, y) => M.poder(e, y) + M.resistencia(e, y) - M.poder(e, x) - M.resistencia(e, x))[0];
      if (!a) return;                                               // a ficha pode ter sido trocada (substituição) ou morrido antes: nada a escolher
      if (q > 0) M.porMarcadores(e, a, '+1/+1', q);
      if (sub && a.ficha && !(a.ficha.sub || []).includes(sub)) a.ficha.sub = [...(a.ficha.sub || []), sub];
      M.log(e, 'amassar', sub || '', q, '→', a.n);
    },
  },
  // CR 122.5: mover marcadores = tirar de um e pôr no outro (o pôr passa pelas substituições, 614.1). De quem já saiu do
  // campo (Zack Fair sacrificado) não tira nada: põe o que ele tinha (LKI, qtd). Sem tipoMarc (Nesting Grounds): o tipo
  // que houver (o primeiro). paraObj 'escolhida' (Forgotten Ancient): um a um, em outras criaturas, até o jogador parar.
  moverMarcador: {
    campos: ['paraObj', 'tipoMarc'],
    qtd: q => qtdOk(q) || ateOk(q) || q === 'tudo',                 // "any number of" = {ate: 'qualquer'}; 'tudo' sem tipoMarc = todos os de cada tipo (do LKI)
    ok: f => f.em !== undefined && (f.qtd !== 'tudo' || (f.em === 'este' && !f.tipoMarc && f.paraObj !== 'escolhida')) && (f.paraObj === 'escolhida' ? f.tipoMarc !== undefined : f.paraObj !== undefined && f.paraObj !== 'escolhida' && emOk(f.paraObj)),
    fx(e, f, ctx, ask) {
      const de = objsDe(e, f, ctx)[0];
      let q = f.qtd === 'tudo' ? 0 : qtdDe(e, f.qtd, ctx);
      if (f.paraObj === 'escolhida') {
        if (!de || de.zona !== 'campo') return;
        const t = f.tipoMarc;
        for (let n = 0; n < q && (de.marc[t] || 0) > 0; n++) {
          const ops = [{ a: 'pronto' }, ...e.campo.filter(id => id !== de.id && M.temTipo(e, e.objs[id], 'Creature')).map(id => ({ a: 'objeto', id }))];
          const x = ask(ctx.voce, 'moverMarcador', ops, { o: t }); if (x.a === 'pronto') break;
          de.marc[t]--; M.porMarcadores(e, e.objs[x.id], t, 1);
        }
        return;
      }
      const para = objsDe(e, { em: f.paraObj }, ctx).find(o => o.zona === 'campo'); if (!para) return;
      if (de && de.zona === 'campo' && de.id !== para.id) {
        const t = f.tipoMarc || Object.keys(de.marc).find(k => de.marc[k] > 0); if (!t) return;
        q = Math.min(q, de.marc[t] || 0); if (q <= 0) return;
        de.marc[t] -= q; M.porMarcadores(e, para, t, q);
      } else if (f.tipoMarc && (!de || de.zona !== 'campo') && q > 0) M.porMarcadores(e, para, f.tipoMarc, q);   // "move its counters" de quem saiu: os do LKI
      else if (!f.tipoMarc && f.qtd === 'tudo' && f.em === 'este' && (!de || de.zona !== 'campo') && ctx.lki && ctx.lki.este)   // "put [its] counters on" (Zack Fair): cada tipo do LKI
        for (const [t, n] of Object.entries<any>(ctx.lki.este.marc || {})) if (n > 0) M.porMarcadores(e, para, t, n);
    },
  },
  // bis (CR 702.141a): uma ficha cópia por oponente, com ímpeto e "ataca se puder" (simplificação: ataca qualquer um,
  // não necessariamente aquele oponente); todas sacrificadas no começo da próxima etapa final (gatilho atrasado)
  bis: {
    fx(e, f, ctx) {
      const base = copiaDe(e, { copiaDe: 'este' }, ctx); if (!base) return;
      const tok = { ...base, kw: [...(base.kw || []).filter(x => x.k !== 'bis'), { k: 'pressa' }], est: [...(base.est || []), { modo: 'deveAtacar', afeta: 'este' }] };
      ctx.criadas = [];
      for (const j of M.vivos(e)) if (j !== ctx.voce) for (const o of M.criarFichas(e, ctx.voce, tok, 1)) ctx.criadas.push({ id: o.id, ts: o.ts });
      H.gatilhoAtrasado.fx(e, { op: 'gatilhoAtrasado', quando: { ev: 'fase', passo: 'final', deQuem: 'cadaJogador', fx: [{ op: 'sacrificar', em: 'criadas' }] } }, ctx);
    },
  },
  // fundir (CR 701.42, 712.4): se você é dono e controla as duas, exila esta e a parceira (f) e põe no campo a carta
  // fundida (faces[0] desta). A parceira fica no exílio ligada a ela (o.fundidaCom); quando a fundida sai do campo, as
  // duas vão juntas (712.4c). Valor de mana da fundida = soma das frentes das duas (712.8g, M.dadoBase).
  fundir: {
    campos: ['f', 'virada', 'atacando'],
    ok: f => !!f.f && M.filtroOk(f.f) && f.em === undefined,
    fx(e, f, ctx, ask) {
      const F = e.objs[ctx.este], j = ctx.voce;
      if (!F || F.zona !== 'campo' || F.ctrl !== j || F.dono !== j || M.formaDe(e, F) !== 'fundir' || F.ficha) return;
      const P = M.objetosQue(e, f.f, ctx).find(o => o.id !== F.id && o.ctrl === j && o.dono === j && !o.ficha); if (!P) return;
      M.mover(e, F.id, 'exilio'); M.mover(e, P.id, 'exilio');
      const o = M.mover(e, F.id, 'campo', { face: 0, virada: !!f.virada });
      o.fundidaCom = { id: P.id, ts: P.ts };
      M.log(e, F.n, 'e', P.n, 'se fundem em', M.dadoDe(e, o).n);
      if (f.atacando && e.turno.combate) { const t = M.escolherAtacado(e, j, ask || ((_j, _t, ops) => ops[0])); if (t) M.porAtacando(e, o, t); }   // 508.4
    },
  },
  // popular (CR 701.36a): escolha uma ficha de criatura que você controla e crie uma ficha que é cópia dela (sem ficha: nada, 701.36b)
  popular: {
    fx(e, f, ctx, ask) {
      for (const j of jogsDe(e, f, ctx)) {
        const cand = M.objetosQue(e, { tipo: ['Creature'], ficha: true, ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
        if (!cand.length) continue;
        const [id] = escolherN(ask, j, 'escolherCarta', cand, 1, { ctx: { op: 'popular' } });
        const tok = copiaDe(e, { copiaDe: 'este' }, { ...ctx, este: id }); if (!tok) continue;
        ctx.criadas = M.criarFichas(e, j, tok, 1).map(o => ({ id: o.id, ts: o.ts }));
      }
    },
  },
  // f (sem em): "ponha N marcadores numa criatura que você controla" — escolhida na resolução, sem alvo (Finality), como o sacrificar
  marcador: {                                                       // CR 122
    campos: ['tipoMarc', 'tirar', 'f', 'cadaCor'],
    ok: f => (f.cadaCor === undefined || (f.cadaCor === true && !!f.f && !f.tirar)) && (f.f === undefined || (f.em === undefined && f.quem === undefined && M.filtroOk(f.f))),
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx);
      if (f.cadaCor) {   // "for each color, put a +1/+1 counter on a Dragon you control of that color" (Call the Spirit Dragons; 105.1): uma escolha por cor
        const cand = M.objetosQue(e, { ...f.f, zona: f.f.zona || 'campo' }, ctx), deCor = c => cand.filter(o => M.bate(e, o, { cor: c }, ctx)).map(o => o.id);
        const sug = emparelhaCores(CORES_WUBRG.map(deCor)), esc: number[] = [];   // a 1ª opção de cada cor = um emparelhamento máximo (o "cinco Dragões" quando dá)
        CORES_WUBRG.forEach((c, i) => {   // todas as escolhas antes de pôr (a pergunta repete o passo: nada muda até a última resposta)
          const l = deCor(c); if (!l.length) return;
          const ord = sug[i] !== undefined ? [sug[i], ...l.filter(id => id !== sug[i])] : l;
          const [id] = escolherN(ask || ((_j, _t, ops) => ops[0]), ctx.voce, 'escolherCarta', ord, 1, { ctx: { op: 'marcador', cor: c } });
          if (id !== undefined) esc.push(id);
        });
        for (const id of esc) M.porMarcadores(e, e.objs[id], f.tipoMarc, q);
        const rec = new Set(esc);
        ctx.resultado = rec.size;                                        // "if you put +1/+1 counters on five Dragons this way": quantos receberam
        return;
      }
      if (f.f) {
        const cand = M.objetosQue(e, { ...f.f, zona: f.f.zona || 'campo' }, ctx).map(o => o.id);
        const [id] = escolherN(ask || ((_j, _t, ops) => ops[0]), ctx.voce, 'escolherCarta', cand, Math.min(1, cand.length), { ctx: { op: 'marcador' } });
        if (id !== undefined) { if (f.tirar) e.objs[id].marc[f.tipoMarc] = Math.max(0, (e.objs[id].marc[f.tipoMarc] || 0) - q); else M.porMarcadores(e, e.objs[id], f.tipoMarc, q); }
        return;
      }
      if (f.em === undefined && f.quem !== undefined) { for (const j of jogsDe(e, f, ctx)) M.marcadorJogador(e, j, f.tipoMarc, q, !!f.tirar); return; }   // no jogador (122.1: poison, rad, experience)
      let tirou = 0;
      for (const o of objsDe(e, f, ctx)) { const pd = M.parteDividida(ctx, f, o), q1 = pd === null ? q : pd; const t = f.tipoMarc; if (!f.tirar) { M.porMarcadores(e, o, t, q1); continue; } const antes = o.marc[t] || 0; o.marc[t] = Math.max(0, antes - q1); tirou += antes - o.marc[t]; }
      if (f.tirar) ctx.resultado = tirou;                            // "for each counter removed this way" (Bloatfly Swarm)
    },
  },
  // "look at target player's hand" (Gitaxian Probe, Peek): só informação; o log da Mesa mostra as cartas a quem olhou
  olharMao: {
    fx(e, f, ctx) {
      for (const j of jogsDe(e, f, ctx)) { const J = e.jogs[j]; M.log(e, e.jogs[ctx.voce].nome, 'olha a mão de', J.nome + ':', J.zonas.mao.map(id => e.objs[id].n).join(', ') || '(vazia)'); }
    },
  },
  // naoDesvira: não desvira no próximo desvirar do controlador (Junk Winder); soNaoDesvira: só isso, sem virar (Fifty Feet of Rope)
  // qtd {ate: N|'qualquer'} ("tap X untapped Myr you control", Myr Battlesphere): quem resolve escolhe quantas, entre as
  // desviradas do em; resultado = quantas virou (o "se fizer" lê ctx.pagou do talvez)
  virar: {
    // qtd {ate: N | 'qualquer'}: "tap X untapped Myr you control" (Myr Battlesphere): escolhe quais entre as desviradas
    // que batem; ctx.resultado = quantas virou (o "+X/+0" e o "X de dano" do efeito seguinte)
    campos: ['naoDesvira', 'soNaoDesvira'],
    qtd: q => q === undefined || (ateOk(q) && q.ate !== 'X'),
    ok: f => (!f.soNaoDesvira || f.naoDesvira === true) && (f.qtd === undefined || !f.naoDesvira),
    fx(e, f, ctx, ask) {
      if (f.qtd !== undefined) { const os = escolherAte(e, f, ctx, ask, 'virar', o => !o.virada); for (const o of os) M.virarObj(e, o); ctx.resultado = os.length; return; }
      for (const o of objsDe(e, f, ctx)) { if (!f.soNaoDesvira) M.virarObj(e, o); if (f.naoDesvira) o.naoDesv = o.ts; }
    },
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
  // qtd {ate: N} ("desvire até três terrenos", Frantic Search): quem resolve escolhe até N dos que batem (só os virados importam)
  // CR 506.4: tira do combate (Reconnaissance): deixa de ser atacante/bloqueadora; quem ela bloqueava continua bloqueado (509.1h)
  tirarDoCombate: {
    ok: f => f.em !== undefined && f.quem === undefined,
    fx(e, f, ctx) {
      const C = e.turno.combate; if (!C) return;
      const os = objsDe(e, f, ctx).filter(o => C.atk.some(r => r.id === o.id) || C.atk.some(r => r.bloq.some(b => b.id === o.id)));
      ctx.movidos = movidos(e, os.map(o => o.id));                  // em 'anterior': as que saíram do combate ("and untap them", Illusionist's Gambit)
      for (const o of os) {
        C.atk = C.atk.filter(r => r.id !== o.id);
        for (const r of C.atk) r.bloq = r.bloq.filter(b => b.id !== o.id);
        M.log(e, o.n, 'sai do combate');
      }
    },
  },
  // "this creature assigns no combat damage this combat" (Master of Cruelties): combate.ts pula o atacante no dano (C.semDano)
  semDanoCombate: {
    ok: f => f.quem === undefined,
    fx(e, f, ctx) {
      const C = e.turno.combate; if (!C) return;
      for (const o of objsDe(e, f, ctx)) { C.semDano = C.semDano || {}; C.semDano[o.id] = o.ts; }
    },
  },
  desvirar: {
    qtd: q => q === undefined || ateOk(q),
    fx(e, f, ctx, ask) {
      let os = objsDe(e, f, ctx);
      if (f.qtd !== undefined) {
        const cand = os.filter(o => o.virada).sort((a, b) => (a.ctrl === ctx.voce ? 0 : 1) - (b.ctrl === ctx.voce ? 0 : 1)).map(o => o.id);
        const ids = escolherN(ask || ((_j, _t, ops) => ops[0]), ctx.voce, 'desvirar', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length), { podeMenos: true, ctx: { op: 'desvirar' } });
        os = ids.map(id => e.objs[id]);
      }
      for (const o of os) M.desvirarObj(e, o);
      if (f.qtd !== undefined) ctx.resultado = os.length;           // quantas desvirou (o "se fizer")
    },
  },
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
  // CR 701.3d: desanexar ("unattach") — o Equipamento/Aura fica no campo, solto de quem o levava (301.5c: Equipamento
  // solto continua no campo). em: os anexos a soltar; ou f (o que solta, padrão Equipamento) + presaA (filtro de quem
  // o leva), e quem faz escolhe um ao resolver, sem alvo (Akiri, Fearless Voyager). Depois: em 'anterior' = as
  // permanentes de que soltou ("tap that creature"); com talvez, se.pagou = soltou algum ("if you do").
  desanexar: {
    campos: ['f', 'presaA'],
    ok: f => f.em !== undefined ? f.f === undefined && f.presaA === undefined
      : !!f.presaA && typeof f.presaA === 'object' && M.filtroOk(f.presaA) && (f.qtd === undefined || f.qtd === 1),
    fx(e, f, ctx, ask) {
      const preso = o => o.zona === 'campo' && !!M.anexadoA(e, o);
      let os = f.em !== undefined ? objsDe(e, f, ctx).filter(preso)
        : M.objetosQue(e, { ...(f.f || { sub: ['Equipment'] }), zona: 'campo' }, ctx).filter(o => preso(o) && M.bate(e, M.anexadoA(e, o), { ...f.presaA, zona: 'campo' }, ctx));
      if (f.em === undefined && os.length > 1) { const id = ask(ctx.voce, 'um', os.map(o => ({ a: 'um', id: o.id })), { op: 'desanexar' }).id; os = os.filter(o => o.id === id); }
      else if (f.em === undefined) os = os.slice(0, 1);
      const de: any[] = [];
      for (const o of os) { const t = M.anexadoA(e, o); o.anexo = null; de.push(t.id); e.vCamada = (e.vCamada || 0) + 1; M.log(e, o.n, 'desanexado de', t.n); }
      ctx.movidos = movidos(e, [...new Set(de)]);
      if (!de.length && f.talvez) ctx.pagou = false;
    },
  },
  anexar: {
    campos: ['a', 'reconf'],
    ok: f => f.em !== undefined && emOk(f.a) && f.a !== undefined && (f.a === 'este' || f.a === 'criadas' || f.a === 'doEvento' || typeof f.a.alvo === 'number'),   // criadas: arma viva (702.92a); doEvento: a criatura que entrou/voltou (Hero's Blade, Nim Deathmantle)
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
    qtd: q => q === undefined || typeof q === 'number' || q === 'maoInteira' || (ateOk(q) && q.ate !== 'X') || (!ateOk(q) && qtdOk(q) && !dadoOk(q)),   // contagem (Honden: uma por Santuário seu)
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
      ctx.lembrados = feitas; ctx.pagou = feitas.length > 0; ctx.movidos = movidos(e, feitas);   // em 'anterior': as descartadas ("if you discarded a nonland card", conivir 701.50a)
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
  // radiação (CR 729.1): gatilho inerente (masmorras.ts). Moe tantas quantos rad tem; por carta não terreno moída perde 1 de
  // vida e tira 1 rad. "if that player has one or more rad counters" é 603.4: sem rad na resolução, não faz nada.
  radiacao: {
    fx(e, f, ctx) {
      const j = ctx.voce, J = e.jogs[j], n = (J.marc || {}).rad || 0;
      if (!n || J.saiu) return;
      H.moer.fx(e, { op: 'moer', quem: 'voce', qtd: n }, ctx);
      const k = (ctx.movidos || []).filter(x => !M.temTipo(e, e.objs[x.id], 'Land')).length;
      M.log(e, J.nome, 'radiação: moe', n, '—', k, 'não terreno');
      // "you gain life rather than lose life from radiation" (Strong, the Brutish Thespian): estática radiacaoGanhaVida
      const ganha = k && M.indiceCampo(e).est.some(id => { const F = e.objs[id]; return F.ctrl === j && (M.dadoDe(e, F).est || []).some(s => s.modo === 'radiacaoGanhaVida'); });
      if (k) { if (ganha) M.ganharVida(e, j, k); else M.perderVida(e, j, k); M.marcadorJogador(e, j, 'rad', k, true); }
    },
  },
  // suspender (CR 702.62a): tira um marcador de tempo da carta suspensa; ao tirar o último, dispara "você pode conjurá-la
  // sem pagar o custo de mana (se puder); se não, fica exilada"
  suspensoTira: {
    fx(e, f, ctx) {
      const o = e.objs[ctx.este], L = ctx.lki && ctx.lki.este;
      if (!M.suspensa(o) || (L && L.ts !== o.ts)) return;
      o.marc.time--;
      M.log(e, o.n, 'perde um marcador de tempo', `(${o.marc.time})`);
      if (o.marc.time === 0) e.pend.push({ fonte: o.id, ts: o.ts, ctrl: o.dono, k: 'suspender:conjura', g: { ev: 'fase', fx: [{ op: 'suspensoConjura' }] }, n: o.n, face: null, ficha: null, lki: M.lkiDe(e, o), ev: { ev: 'tiraMarcador', id: o.id, j: o.dono } });
    },
  },
  suspensoConjura: {
    fx(e, f, ctx, ask) {
      const o = e.objs[ctx.este], L = ctx.lki && ctx.lki.este;
      if (!o || o.zona !== 'exilio' || (L && L.ts !== o.ts)) return;   // "if it's exiled"
      o.suspensa = false;
      if (M.podeConjurar(e, o.dono, o, undefined, { agora: true, gratis: true }) && ask(o.dono, 'jogar', [{ a: 'jogar', id: o.id }, { a: 'naoJogar', id: o.id }], { gratis: true, suspender: true }).a === 'jogar') {
        const P0 = e.proc;
        M.PROC.conjurar(e, { j: o.dono, id: o.id, agora: true, gratis: true, suspensa: true, resp: [] }, ask);
        e.proc = P0; ask.etapa();
        if (o.zona === 'pilha') M.log(e, e.jogs[o.dono].nome, 'conjura', o.n, 'pelo suspender');
        return;
      }
      M.log(e, o.n, 'fica no exílio (não conjurada pelo suspender)');
    },
  },
  turnoExtra: {                                                     // CR 500.7: "take an extra turn after this one" (Timestream Navigator, Time Sieve)
    qtd: q => q === undefined || Number.isInteger(q),
    fx(e, f, ctx) { const q = f.qtd === undefined ? 1 : f.qtd; for (const j of jogsDe(e, f, ctx)) for (let i = 0; i < q; i++) { (e.turnosExtra || (e.turnosExtra = [])).push(j); M.log(e, e.jogs[j].nome, 'terá um turno extra'); } },
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
    ok: f => (f.o === 'tipoCriatura' || f.o === 'cor') && (f.quem === undefined || f.quem === 'voce' || (f.quem === 'cadaAtual' && f.o === 'tipoCriatura' && dentroCada > 0)),
    fx(e, f, ctx, ask) {
      let ops;
      if (f.o === 'cor') ops = 'WUBRG'.split('').map(v => ({ a: 'cor', v }));
      else {                                                         // 205.3m: qualquer tipo; as opções são os tipos que existem na partida
        const t = new Set<any>();
        for (const x of Object.values<any>(e.objs)) if (!x.hab && x.zona !== 'fora' && M.temTipo(e, x, 'Creature')) (M.dadoDe(e, x).sub || []).forEach(s => t.add(s));
        ops = [...(t.size ? t : new Set(['Human']))].sort().map(v => ({ a: 'tipo', v }));
      }
      const quem = f.quem === 'cadaAtual' ? ctx.cadaAtual : ctx.voce;  // cadaAtual (repetirCada): cada jogador escolhe; os tipos se juntam em escolha.tipos
      const r = ask(quem, 'escolha', ops, { o: f.o, fonte: (e.objs[ctx.este] || {}).n });
      ctx.escolha = f.quem === 'cadaAtual' ? { ...(ctx.escolha || {}), tipos: [...((ctx.escolha && ctx.escolha.tipos) || []), r.v] } : { ...(ctx.escolha || {}), ...(f.o === 'cor' ? { cor: r.v } : { tipo: r.v }) };
      M.log(e, e.jogs[quem].nome, 'escolhe', r.v);
    },
  },
  revelarTopo: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) { const g = e.jogs[j].zonas.grimorio; const ids = g.slice(-q).reverse(); if (ids.length) M.log(e, e.jogs[j].nome, 'revela do topo', ids.map(id => e.objs[id].n).join(', ')); } } },   // CR 701.20: só mostra; quem pega é o efeito seguinte (topo: true)
  moer: { fx(e, f, ctx) {   // CR 701.13. Depois de mover: 'moe' por carta {id, j} e o lote 'moeGrupo' {ids, n} ("uma ou mais", Scorchbeast)
    const q = qtdDe(e, f.qtd, ctx), ids: any[] = [];
    const mais = j => q > 0 ? substsDe(e, 'moer').reduce((n, { F, s }) => (s.jog === 'voce' ? j === F.ctrl : s.jog === 'oponente' ? j !== F.ctrl : true) ? n + s.muda.soma : n, 0) : 0;   // 614.1a: "mill that many plus four instead"
    for (const j of jogsDe(e, f, ctx)) { const g = e.jogs[j].zonas.grimorio, qj = q + mais(j); for (let i = 0; i < qj && g.length; i++) { const id = g[g.length - 1]; M.mover(e, id, 'cemiterio'); if (e.objs[id].zona === 'cemiterio') ids.push(id); } }   // substituída para outra zona (Rest in Peace): não foi moída
    ctx.movidos = movidos(e, ids);                                   // "put a card from among them" (Ripples of Undeath: f.lembrada)
    if (M.evento && ids.length) { for (const id of ids) M.evento(e, { ev: 'moe', id, j: e.objs[id].dono }); M.evento(e, { ev: 'moeGrupo', ids, n: ids.length }); }
  } },

  // "each opponent can't block with more than one creature this combat" (Mirri, Weatherlight Duelist; 509.1c): no combate atual
  limitarBloqueio: { fx(e, f, ctx) {
    const C = e.turno.combate; if (!C) return;
    const q = qtdDe(e, f.qtd, ctx); C.limBloq = C.limBloq || {};
    for (const j of jogsDe(e, f, ctx)) C.limBloq[j] = Math.min(C.limBloq[j] ?? Infinity, q);
  } },
  // "separate all permanents target player controls into two piles; that player sacrifices all permanents in the pile of
  // their choice" (Liliana of the Veil −6): quem resolve separa (uma pergunta por permanente), o jogador escolhe a pilha
  duasPilhas: { fx(e, f, ctx, ask) {
    for (const j of jogsDe(e, f, ctx)) {
      const P: number[][] = [[], []], soma = [0, 0], val = id => M.dadoDe(e, e.objs[id]).vm || 0.5;
      for (const id of e.campo.filter(id => e.objs[id].ctrl === j)) {
        const k = ask(ctx.voce, 'pilha', [0, 1].map(v => ({ a: 'pilha', v, id })), { id, somas: [...soma] }).v;
        P[k].push(id); soma[k] += val(id);
      }
      const sac = ask(j, 'pilha', [0, 1].map(v => ({ a: 'pilha', v })), { somas: [...soma], sacrifica: true }).v;
      M.log(e, e.jogs[j].nome, 'sacrifica a pilha', sac + 1, '(' + P[sac].length + ' permanentes)');
      for (const id of P[sac]) if (e.objs[id] && e.objs[id].zona === 'campo' && e.objs[id].ctrl === j) M.mover(e, id, 'cemiterio', { sac: true });   // 701.21
    }
  } },
  // qtd 'tudo' = "sacrifica todas" (Living Death, sem escolha); {ate:N|'qualquer'} = "quantas quiser" (Scapeshift)
  sacrificar: {                                                     // CR 701.21: quem sacrifica escolhe
    campos: ['f', 'exceto'],
    qtd: q => qtdOk(q) || q === 'tudo' || (ateOk(q) && q.ate !== 'X'),
    // exceto: "sacrifica todas menos N" (Promise of Loyalty, Archfiend) ou "escolhe uma de cada tipo e sacrifica o resto"
    // (porTipo: Ajani; cada escolhida vale para um tipo só). Quem sacrifica escolhe as que ficam (o agente: as de menos valor vão).
    ok: f => f.exceto === undefined || (!!f.exceto && typeof f.exceto === 'object' && Object.keys(f.exceto).every(k => ['qtd', 'porTipo', 'marcaFicam', 'votoContra'].includes(k)) && (!f.exceto.votoContra || typeof f.exceto.marcaFicam === 'string') && Number.isInteger(f.exceto.qtd) && f.qtd === undefined
      && (f.exceto.porTipo === undefined || (Array.isArray(f.exceto.porTipo) && f.exceto.porTipo.every(t => typeof t === 'string')))),
    fx(e, f, ctx, ask) {
      const esc: any[] = [];
      if (f.em !== undefined) {                                     // "sacrifique-o(s)": os objetos ditos, se ainda estão no campo sob o controle de quem resolve (701.21a)
        for (const o of objsDe(e, f, ctx)) if (o.zona === 'campo' && o.ctrl === ctx.voce) esc.push(o.id);
        ctx.resultado = esc.length; for (const id of esc) M.mover(e, id, 'cemiterio', { sac: true }); return;
      }
      const ficam: number[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const cand = M.objetosQue(e, { ...(f.f || {}), ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
        if (f.exceto && f.exceto.porTipo) {
          const fica = new Set<number>();
          for (const t of f.exceto.porTipo) {
            const ops = cand.filter(id => !fica.has(id) && M.temTipo(e, e.objs[id], t));
            for (let n = 0; n < f.exceto.qtd && ops.length; n++) { const v = ops.filter(id => !fica.has(id)); if (!v.length) break; fica.add(escolherN(ask, j, 'manter', v, 1)[0]); }
          }
          esc.push(...cand.filter(id => !fica.has(id))); ficam.push(...fica);
          continue;
        }
        if (f.exceto) { esc.push(...escolherN(ask, j, 'sacrificar', cand, Math.max(0, cand.length - f.exceto.qtd))); { const sai = new Set(esc); ficam.push(...cand.filter(id => !sai.has(id))); } continue; }
        if (f.qtd === 'tudo') { esc.push(...cand); continue; }
        esc.push(...escolherN(ask, j, 'sacrificar', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length), { podeMenos: ateOk(f.qtd) }));
      }
      // marcaFicam/votoContra (Promise of Loyalty): o marcador vai antes do sacrifício (é a mesma ação, mas a ordem não muda nada);
      // "can't attack you … for as long as it has a vow counter": preso ao objeto (o mover zera o.voto), lido em combate.ts
      if (f.exceto && f.exceto.marcaFicam) for (const id of ficam) { const o = e.objs[id]; M.porMarcadores(e, o, f.exceto.marcaFicam, 1); if (f.exceto.votoContra) o.voto = { marc: f.exceto.marcaFicam, js: [...((o.voto && o.voto.js) || []), ctx.voce] }; }
      ctx.resultado = esc.length;                                   // "reveal … until X Zombies" (Empty the Laboratory)
      if (f.talvez && !esc.length) ctx.pagou = false;               // "pode sacrificar" sem nada para sacrificar: não fez (Braids: perde 2)
      if (esc.length && !ctx.sacFx) ctx.sacFx = { id: esc[0], ts: e.objs[esc[0]].ts };   // a 1ª sacrificada do efeito (filtro tipoCartaEmComum, Braids)
      for (const id of esc) M.mover(e, id, 'cemiterio', { sac: true });
    },
  },
  embaralhar: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) M.embaralhar(e, e.jogs[j].zonas.grimorio); } },
  buscar: {                                                         // CR 701.19 (pode não achar: 701.19b)
    campos: ['f', 'para', 'revelar', 'virada', 'destinos', 'noDe', 'tipoTerrenoComum', 'nomesDiferentes', 'ouCemiterio'],
    qtd: q => qtdOk(q) || (ateOk(q) && q.ate !== 'X') || ateContaOk(q),   // "any number of" (Ugin −11): {ate:'qualquer'}
    ok: f => (f.nomesDiferentes === undefined || f.nomesDiferentes === true) && ['mao', 'campo', 'cemiterio', 'grimorio', 'exilio', undefined].includes(f.para) && (!f.destinos || f.destinos.every(d => ['mao', 'campo', 'cemiterio', 'grimorio'].includes(d.para))),
    fx(e, f, ctx, ask) {
      const plano: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const bloq = j === ctx.voce && M.procuraBloqueada(e, j);
        if (bloq && !f.ouCemiterio) { M.log(e, e.jogs[j].nome, 'não pode procurar no grimório'); continue; }   // Ashiok, Dream Render
        // noDe {alvo:N}: procura no grimório do jogador alvo (Knowledge Exploitation); quem escolhe é j
        const dono = f.noDe ? ((ctx.alvos[f.noDe.alvo] || [])[0] || {}).jog : j; if (dono === undefined || (f.noDe && ctx.ilegal && ctx.ilegal[f.noDe.alvo + ':0'])) continue;
        // ouCemiterio: "search your library and/or graveyard" (Sanctum of All): as do cemitério do dono também valem
        const cand = [...(bloq ? [] : M.objetosQue(e, { ...f.f, zona: 'grimorio', dono: 'voce' }, { ...ctx, voce: dono })),
          ...(f.ouCemiterio ? M.objetosQue(e, { ...f.f, zona: 'cemiterio', dono: 'voce' }, { ...ctx, voce: dono }) : [])].map(o => o.id);
        let pegou;
        if (f.tipoTerrenoComum) {                                   // "that share a land type" (Myriad Landscape): as seguintes têm um tipo de terreno da 1ª
          const n = qtdDe(e, f.qtd, ctx), p1 = escolherN(ask, j, 'buscar', cand, Math.min(1, n), { podeMenos: true });
          const tt = p1.length ? (M.dadoDe(e, e.objs[p1[0]]).sub || []).filter(x => SUB_TERRENO.has(x)) : [];
          pegou = p1.concat(p1.length ? escolherN(ask, j, 'buscar', cand.filter(id => id !== p1[0] && (M.dadoDe(e, e.objs[id]).sub || []).some(x => tt.includes(x))), n - 1, { podeMenos: true }) : []);
        } else pegou = escolherN(ask, j, 'buscar', cand, qtdDe(e, f.qtd, ctx), { podeMenos: true, ...(f.nomesDiferentes ? { distinto: id => e.objs[id].n } : {}) });
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
    campos: ['olha', 'pega', 'f', 'para', 'resto', 'revelar', 'virada', 'fundo', 'destinos', 'ateAchar', 'sobControle', 'aleatorio', 'comEste', 'umDeCada', 'faceBaixo'],
    talvezDentro: true,                                             // "you may put…": o resto vai para a zona dele mesmo se não pegar nada
    ok: f => {
      const Z = ['mao', 'campo', 'cemiterio', 'exilio'];
      if (f.aleatorio !== undefined && (f.aleatorio !== true || !f.resto)) return false;
      if (f.umDeCada !== undefined && !(f.umDeCada === true && f.f && Array.isArray(f.f.sub) && f.f.sub.length > 1 && f.pega && ateOk(f.pega))) return false;
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
          else { const n = typeof f.pega === 'number' ? f.pega : f.pega.ate; vai = escolherN(ask, j, 'cavar', cand, Math.min(n, cand.length), { podeMenos: !!f.talvez || typeof f.pega !== 'number', ctx: { para: f.para }, ...(f.umDeCada ? { vagas: id => f.f.sub.filter(t => (M.dadoDe(e, e.objs[id]).sub || []).includes(t)) } : {}) }); }
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
      if (f.faceBaixo && f.para === 'exilio') for (const p of plano) { const X = e.objs[p.id]; if (X.zona === 'exilio') { X.faceBaixo = true; X.olham = [ctx.voce]; } }   // 406.3: olhou e exilou virada: só quem olhou continua vendo
      if (f.comEste && f.para === 'exilio') { const F = e.objs[ctx.este]; if (F) for (const p of plano) if (e.objs[p.id].zona === 'exilio') e.objs[p.id].exPor = { id: F.id, ts: (ctx.lki && ctx.lki.este && ctx.lki.este.ts) ?? F.ts }; }   // "exile those cards" ... "a card exiled with Lobelia" (607.2a)
      if (f.resto) {                                                // de volta ao topo: na mesma ordem (uma das ordens que a regra deixa)
        const r = f.resto === 'grimorio' && !f.fundo ? resto.slice().reverse() : resto;
        if (f.aleatorio) M.embaralhar(e, r);                        // "in a random order" (Thassa's Oracle)
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
  vigiar: {                                                         // CR 701.25: olha N, põe qualquer número no cemitério e o resto de volta no topo
    fx(e, f, ctx, ask) {
      const q = qtdDe(e, f.qtd, ctx);
      for (const j of jogsDe(e, f, ctx)) {
        const g = e.jogs[j].zonas.grimorio, topo = g.slice(-q).reverse();
        const cem = topo.filter(id => ask(j, 'vigiar', [{ a: 'topo', id }, { a: 'cemiterio', id }], {}).a === 'cemiterio');
        for (const id of cem) M.mover(e, id, 'cemiterio');            // o resto fica no topo, na mesma ordem (uma das que a regra deixa)
        M.log(e, e.jogs[j].nome, 'vigia', q, cem.length ? '(' + cem.length + ' ao cemitério)' : '');
      }
    },
  },
  proliferar: {                                                     // CR 701.34: escolhe quantos quiser (permanentes e
    fx(e, f, ctx, ask) {                                            // jogadores com marcador); +1 de cada tipo que já tem
      for (const j of jogsDe(e, f, ctx)) {
        const temMarc = o => Object.values<any>(o.marc).some(n => n > 0);
        const cand: any[] = e.campo.filter(id => temMarc(e.objs[id])).map(id => ({ a: 'proliferar', id }));
        for (const J of e.jogs) if (!J.saiu && (J.veneno > 0 || Object.values<any>(J.marc || {}).some(n => n > 0))) cand.push({ a: 'proliferar', jog: J.i });   // jogador com qualquer marcador (veneno, rad, experiência: 701.34a)
        const esc: any[] = [];
        while (cand.length) {
          const x = ask(j, 'proliferar', [{ a: 'pronto' }, ...cand], {});
          if (x.a === 'pronto') break;
          esc.push(x); cand.splice(cand.indexOf(x), 1);
        }
        for (const x of esc) {
          if (x.jog !== undefined) { const ag = e.agente, J = e.jogs[x.jog]; e.agente = j; if (J.veneno > 0) M.marcadorJogador(e, x.jog, 'poison', 1, false); for (const t of Object.keys(J.marc || {})) if (J.marc[t] > 0) M.marcadorJogador(e, x.jog, t, 1, false); e.agente = ag; continue; }
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
      const x = M.mover(e, esc, 'exilio'); x.exPor = { id: ctx.este, ts }; x.faceBaixo = true; x.olham = [ctx.voce];   // 702.75a: você pode olhar
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
