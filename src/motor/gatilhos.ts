// src/motor/gatilhos.ts (T43: migrado de motor2/gatilhos.js) — habilidades desencadeadas (CR 603): eventos do núcleo, disparo na hora do evento (603.2),
// olhar para trás de quem sai do campo (603.10a), condição de intervenção (603.4), pôr na pilha em APNAP quando
// alguém receberia prioridade (603.3b), alvo escolhido ao pôr; sem alvo legal a habilidade sai (603.3d).
// Gatilho com campo/efeito/filtro que o núcleo não lê NÃO dispara (nada joga errado em silêncio).
import { M } from './nucleo';

const EV_OK = new Set(['entra', 'morre', 'sai', 'vaiCemiterio', 'ataca', 'atacantesDeclarados', 'bloqueia', 'dano',
  'conjura', 'fase', 'compra', 'ganhaVida', 'alvoDe']);
const CAMPOS_OK = new Set(['ev', 'fx', 'quem', 'alvos', 'se', 'zonaAtiva', 'jog', 'passo', 'deQuem', 'aJogador', 'combate', 'por']);
const SAIDA = new Set(['morre', 'sai', 'vaiCemiterio']);
const memoOk = new WeakMap();
M.gatOk = g => {
  if (memoOk.has(g)) return memoOk.get(g);
  let ok = EV_OK.has(g.ev) && Object.keys(g).every(k => CAMPOS_OK.has(k)) && M.fxSuportado(g.fx) && !g.fx.some(f => f.op === 'modal')   // modo do gatilho (603.3c) = depois
    && (g.alvos || []).every(M.alvoSuportado) && (!g.quem || M.filtroOk(g.quem)) && (!g.por || M.filtroOk(g.por));
  if (ok && g.se) ok = Object.keys(g.se).every(k => ['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta'].includes(k));
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
    case 'entra': return ev.ev === 'zona' && ev.para === 'campo' && q(e.objs[ev.id]);
    case 'morre': return ev.ev === 'zona' && ev.de === 'campo' && ev.para === 'cemiterio' && M.temTipo(e, ev.snap, 'Creature') && q(ev.snap);   // 700.4
    case 'sai': return ev.ev === 'zona' && ev.de === 'campo' && q(ev.snap);
    case 'vaiCemiterio': return ev.ev === 'zona' && ev.para === 'cemiterio' && q(ev.snap || e.objs[ev.id]);
    case 'ataca': return ev.ev === 'ataca' && q(e.objs[ev.id]);
    case 'atacantesDeclarados': return ev.ev === 'atacantesDeclarados' && !g.quem && (!g.jog || relJog(g.jog, ev.j, F.ctrl));
    case 'bloqueia': return ev.ev === 'bloqueia' && q(e.objs[ev.id]);
    case 'dano': return ev.ev === 'dano' && (!g.combate || ev.combate) && (!g.aJogador || ev.jog !== undefined) && q(ev.snap || e.objs[ev.fonte]);
    case 'conjura': return ev.ev === 'conjura' && relJog(g.jog || 'qualquer', ev.j, F.ctrl) && q(e.objs[ev.id]);
    case 'fase': return ev.ev === 'fase' && ev.passo === g.passo && relJog(g.deQuem || 'voce', ev.ativo, F.ctrl);
    case 'compra': return ev.ev === 'compra' && (!g.quem || relJog(g.quem.ctrl || 'qualquer', ev.j, F.ctrl)) && (!g.jog || relJog(g.jog, ev.j, F.ctrl));
    case 'ganhaVida': return ev.ev === 'ganhaVida' && relJog(g.jog || 'voce', ev.j, F.ctrl);
    case 'alvoDe': {                                   // CR 115.1, 603.2: "becomes the target of" (ao conjurar/ativar/pôr na pilha)
      if (ev.ev !== 'alvoDe' || !q(e.objs[ev.id])) return false;
      if (!g.por) return true;
      const P = e.objs[ev.por];                        // habilidade na pilha não tem tipo (CR 113.1): filtro de tipo não pega
      return !!P && !(P.hab && g.por.tipo) && bate(e, P, g.por, ctx);
    }
  }
  return false;
}
const zonas = g => g.zonaAtiva || ['campo'];

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
  for (const id of e.campo) {
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
const fabricarDe = d => { const k = (d.kw || []).find(x => x.k === 'fabricar'); return k ? { ev: 'entra', quem: { este: true }, fx: [{ op: 'fabricar', qtd: k.n || 1 }] } : null; };
// p.face: a face que estava para cima quando disparou (dupla face transformada tem outros gatilhos, 712.6d)
M.gatilhoDe = (p) => p.g || (p.ficha || M.dadoFace(M.carta(p.n), p.face)).gat[p.k];

// ---------- evento: dispara na hora (603.2) ----------
M.evento = (e, ev) => {
  if (!e.pend || (e.turno.passo === 'mulligan')) return;
  const saida = ev.ev === 'zona' && ev.de === 'campo';
  if (saida) (e.lote = e.lote || []).push(ev.snap);
  const fontes: any[] = [];
  for (const id of e.campo) { const o = e.objs[id]; if (M.dadoDe(e, o).gat) fontes.push(o); }
  if (saida) for (const s of e.lote) if (M.dadoDe(e, s).gat) fontes.push(s);             // 603.10a: olha para trás
  if (ev.ev === 'conjura' && e.objs[ev.id]) fontes.push(e.objs[ev.id]);                 // "quando você conjura este"
  for (const J of e.jogs) for (const id of J.zonas.cemiterio) {                         // gatilhos que valem no cemitério
    const o = e.objs[id], gs = M.dadoDe(e, o).gat;
    if (gs && gs.some(g => zonas(g).includes('cemiterio'))) fontes.push(o);
  }
  for (const F of fontes) {
    const gs = M.dadoDe(e, F).gat || [], lki = e.lote && e.lote.includes(F);
    for (let k = 0; k < gs.length; k++) {
      const g = gs[k];
      if (!M.gatOk(g)) continue;
      const onde = lki ? 'campo' : F.zona;
      if (lki && !SAIDA.has(g.ev)) continue;
      if (!zonas(g).includes(onde) && !(onde === 'pilha' && g.ev === 'conjura' && g.quem && g.quem.este)) continue;
      if (onde === 'pilha' && !(g.quem && g.quem.este)) continue;
      if (!bateEv(e, g, ev, F)) continue;
      if (!cond(e, g.se, { voce: F.ctrl, este: F.id })) continue;                          // 603.4
      const vezes = 1 + extras(e, F, g, ev);
      for (let v = 0; v < vezes; v++) e.pend.push({ fonte: F.id, ts: F.ts, ctrl: F.ctrl, k, n: F.n, face: F.face ?? null, ficha: F.ficha || null, lki: M.lkiDe(e, F), ev: { ...ev, snap: undefined } });
    }
  }
  if (ev.ev === 'zona' && ev.para === 'campo' && e.objs[ev.id]) {                      // fabricar
    const F = e.objs[ev.id], g = fabricarDe(M.dadoDe(e, F));
    if (g) {
      const vezes = 1 + extras(e, F, g, ev);
      for (let v = 0; v < vezes; v++) e.pend.push({ fonte: F.id, ts: F.ts, ctrl: F.ctrl, k: 'fabricar', g, n: F.n, ficha: F.ficha || null, lki: M.lkiDe(e, F), ev: { ...ev, snap: undefined } });
    }
  }
};

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
      const ops = [...tipos.values()].map(i => ({ a: 'gatilho', i, id: e.pend[i].fonte, k: e.pend[i].k }));
      const op = ask(j, 'ordemGatilho', ops);
      const p = e.pend[op.i], g = M.gatilhoDe(p);
      const ctx = { voce: j, este: p.fonte };
      const alvos = M.escolherAlvos(e, j, { alvos: g.alvos || [] }, g.fx, ctx, ask);
      e.pend.splice(op.i, 1);
      const falta = M.alvosUsados(g.fx).some(i => (alvos[i] || []).length < ((g.alvos[i].min ?? 1)));
      if (falta) { M.log(e, p.n, 'gatilho sem alvo legal: sai (603.3d)'); ask.etapa(); continue; }
      const id = e.prox++;
      e.objs[id] = { id, n: p.n, dono: j, ctrl: j, zona: 'pilha', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false,
        hab: { fonte: p.fonte, fonteTs: p.ts, gat: p.k, fx: g.fx, alvos: g.alvos || [], ficha: p.ficha, se: g.se || null },
        pil: { x: 0, alvos, ctrl: j, lki: { este: p.lki }, ev: p.ev } };
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
