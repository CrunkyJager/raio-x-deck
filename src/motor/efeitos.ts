// src/motor/efeitos.ts (T43: migrado de motor2/efeitos.js) — efeitos do formato RX que o núcleo já executa na resolução (CR 608.2c–h) e o teste de suporte.
// O que não está aqui (ou tem campo que o handler não conhece) faz a carta/habilidade NÃO ser oferecida: melhor
// não jogar do que jogar errado em silêncio. Regra de cada handler: perguntar tudo antes de mexer no estado.
import { M } from './nucleo';

const BASE = new Set(['op', 'em', 'quem', 'qtd', 'se', 'talvez']);
const QUEM_OK = new Set(['voce', 'cadaOponente', 'cadaJogador', 'alvoJogador', 'controlador', 'dono', 'doEvento']);
const CONTA_OK = new Set(['poderDoAlvo', 'resistDoAlvo', 'vmDoAlvo', 'poderDoEste', 'resistDoEste', 'marcadoresNoEste',
  'cartasNaMao', 'oponentes', 'jogadores', 'suaVida', 'X', 'resultado', 'lembrados', 'evento']);   // lembrados: as cartas descartadas pelo efeito anterior; evento: quantas o evento do gatilho juntou (descarta em grupo)   // resultado: quantos o efeito anterior moveu (Valakut Awakening)
const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta', 'conjuradaCom', 'palavra', 'pagou']);

// ---------- suporte (estático, olhando só o dado) ----------
// quem: {alvo: N} = o jogador escolhido no alvo N ("target player discards", Kolaghan's Command)
const quemAlvo = q => !!q && typeof q === 'object' && typeof q.alvo === 'number' && Object.keys(q).length === 1;
// {dado:N}: rola um dado de N lados (CR 706) com o RNG da partida; {ate:N|'X'|'qualquer'} ("up to") só onde o handler aceita
const dadoOk = q => !!q && typeof q === 'object' && Number.isInteger(q.dado) && q.dado >= 2 && Object.keys(q).length === 1;
const ateOk = q => !!q && typeof q === 'object' && Object.keys(q).length === 1 && (Number.isInteger(q.ate) || q.ate === 'X' || q.ate === 'qualquer');
const qtdOk = q => q === undefined || typeof q === 'number' || q === 'X' || dadoOk(q)
  || (q && typeof q === 'object' && (typeof q.conta === 'string' ? CONTA_OK.has(q.conta) : M.filtroOk(q.conta))
    && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'alvo'].includes(k)));
const emOk = v => v === undefined || v === 'este' || v === 'equipada' || v === 'doEvento' || (v && typeof v === 'object' && (typeof v.alvo === 'number' || (v.todos && M.filtroOk(v.todos))));
const seOk = se => !se || (Object.keys(se).every(k => COND_OK.has(k))
  && M.condValorOk(se) && (!se.existe || M.filtroOk(se.existe.f)) && (!se.controla || M.filtroOk(se.controla.f)) && (!se.conta || qtdOk(se.conta.q)));
M.seOk = seOk;
M.fxSuportado = (fx, { topo = true }: any = {}) => (fx || []).every(f => {
  if (f.op === 'modal') return topo && fx.length === 1 && f.modos.some(m => M.fxSuportado(m, { topo: false }));
  const h = H[f.op];
  if (!h) return false;
  for (const k in f) if (!BASE.has(k) && !(h.campos || []).includes(k)) return false;
  if (f.quem !== undefined && !QUEM_OK.has(f.quem) && !quemAlvo(f.quem)) return false;
  if (!emOk(f.em) || !seOk(f.se)) return false;
  if (!(h.qtd ? h.qtd(f.qtd) : qtdOk(f.qtd))) return false;
  if (f.f && !M.filtroOk(f.f)) return false;
  return h.ok ? h.ok(f) : true;
});

// ---------- leitura no meio da resolução ----------
// objetos que o efeito afeta (alvo ilegal fica de fora, CR 608.2b)
function objsDe(e, f, ctx) {
  const v = f.em;
  if (v === undefined) return [];
  if (v === 'este') { const o = e.objs[ctx.este]; return o && o.zona === 'campo' && (!ctx.lki.este || o.ts === ctx.lki.este.ts) ? [o] : []; }
  if (typeof v.alvo === 'number') {
    return (ctx.alvos[v.alvo] || []).map((a, k) => ctx.ilegal[v.alvo + ':' + k] || a.o === undefined ? null : e.objs[a.o])
      .filter(o => o && (ctx.alvos[v.alvo].find(a => a.o === o.id) || {}).ts === o.ts);
  }
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
    case 'cadaJogador': return vivos;
    case 'alvoJogador': { for (let i = 0; i < ctx.alvos.length; i++) { const js = jogsAlvo(e, i, ctx); if (js.length) return js; } return []; }
    case 'controlador': return [...new Set(lkisDe(e, f, ctx).map(l => l.ctrl))].filter(j => vivos.includes(j));
    case 'dono': return [...new Set(lkisDe(e, f, ctx).map(l => l.dono))].filter(j => vivos.includes(j));
    case 'doEvento': return ctx.ev && ctx.ev.j !== undefined && vivos.includes(ctx.ev.j) ? [ctx.ev.j] : [];   // quem descartou (Megrim)
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
      case 'marcadoresNoEste': v = este ? Object.values<any>(este.marc).reduce((s, n) => s + n, 0) : 0; break;
      case 'cartasNaMao': v = e.jogs[ctx.voce].zonas.mao.length; break;
      case 'oponentes': v = M.vivos(e).filter(j => j !== ctx.voce).length; break;
      case 'jogadores': v = M.vivos(e).length; break;
      case 'suaVida': v = e.jogs[ctx.voce].vida; break;
      case 'X': v = ctx.x || 0; break;
      case 'resultado': v = ctx.resultado || 0; break;
      case 'lembrados': v = (ctx.lembrados || []).length; break;
      case 'evento': v = ctx.ev ? ctx.ev.n ?? 1 : 0; break;
      default: throw new Error('conta sem suporte: ' + q.conta);
    }
    return Math.max(0, v * (q.mult || 1) + (q.soma || 0));
  }
  const v = M.qtd(e, q, ctx);
  if (v === null) throw new Error('qtd sem suporte: ' + JSON.stringify(q));
  return Math.max(0, v);
}
M.qtdDe = qtdDe;
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
  if (fo === 'doEvento') { const ev = ctx.ev; o = ev ? e.objs[ev.ev === 'dano' ? ev.o : ev.id] : null; }
  else {
    const a = (ctx.alvos[fo.alvo] || [])[0];
    if (!a || a.o === undefined || ctx.ilegal[fo.alvo + ':0']) return null;
    o = e.objs[a.o]; l = ctx.lki.alvos && (ctx.lki.alvos[fo.alvo] || [])[0];
    if (o && l && o.ts !== l.ts) o = null;                           // mudou de zona: virou outro objeto (400.7)
  }
  if (o && o.zona === 'campo') return { kw: M.kwDe(e, o), ctrl: o.ctrl };
  if (o) return { kw: M.dadoDe(e, o).kw || [], ctrl: o.ctrl };
  if (l) return { kw: M.dadoFace(M.carta(l.n), l.face).kw || [], ctrl: l.ctrl };
  return null;
}

// ---------- executar um efeito ----------
M.executar = (e, f, ctx, ask) => {
  if (f.se && !M.condicao(e, f.se, ctx)) return;                     // CR 608.2c: condição lida na hora
  const h0 = H[f.op];
  if (f.talvez && !(h0 && h0.talvezDentro) && ask(ctx.voce, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: f.op }).a === 'nao') { ctx.pagou = false; return; }   // "pode"
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
      if (c.vida && e.jogs[ctrl].vida >= c.vida) ops.push({ a: 'pagar' });                         // CR 119.4
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
M.aplicarEntrada = (e, { id, ctrl, vir, pagaVida, escolha, face, conj = null }) => {
  if (pagaVida) e.jogs[ctrl].vida -= pagaVida;
  const o = M.mover(e, id, 'campo', { virada: vir, face, conj });
  o.ctrl = ctrl; o.escolha = escolha; e.vCamada = (e.vCamada || 0) + 1;   // camadas: refaz as fontes (estado.ts)
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
  const o = { id, n, dono: j, ctrl: j, zona: 'campo', ts: ++e.ts, virada, dano: 0, marc: {} as any, doente: true, cmd: false, ficha: { ...tok, n } };
  e.objs[id] = o; e.campo.push(id);
  M.campoEntra(e, id);
  if (tok.leal) o.marc.lealdade = tok.leal;
  if (M.evento) M.evento(e, { ev: 'zona', id, de: null, para: 'campo' });
  return o;
}
M.criarFicha = criarFicha;
M.danoEm = (e, o, q, fd) => danoEm(e, o, q, fd);
function danoEm(e, alvoObj, q, fonte) {
  if (M.temTipo(e, alvoObj, 'Planeswalker')) alvoObj.marc.lealdade = (alvoObj.marc.lealdade || 0) - q;   // CR 120.3c
  if (M.temTipo(e, alvoObj, 'Creature')) { alvoObj.dano += q; if ((fonte.kw || []).some(k => k.k === 'toqueMortifero')) alvoObj.mortal = true; }   // 120.3e, 702.2b
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
      const fonte = f.fonte === undefined ? { kw: fonteDado(e, ctx).kw, ctrl: ctx.voce } : fonteOutra(e, f.fonte, ctx);
      if (!fonte) return;
      let total = 0;
      for (const o of objsDe(e, f, ctx)) { danoEm(e, o, q, fonte); total += q; }
      const js = f.em && typeof f.em.alvo === 'number' ? jogsAlvo(e, f.em.alvo, ctx) : [];
      const jq = f.quem ? jogsDe(e, f, ctx) : [];
      for (const j of [...new Set([...js, ...jq])]) { e.jogs[j].vida -= q; total += q; }   // CR 120.3a
      if (total && (fonte.kw || []).some(k => k.k === 'vinculoVida')) M.ganharVida(e, fonte.ctrl, total);   // CR 702.15b: quem controla a fonte
    },
  },
  // "X ganha +N/+N e/ou palavra-chave até o fim do turno" (CR 611.2): números e conjunto afetado presos na resolução
  // (611.2c: quem entrar depois não ganha); vale enquanto o mesmo objeto estiver no campo; a limpeza tira (514.2).
  // Por ora só 'fimDoTurno' e P/R/palavra-chave sem parâmetro; habilidade, tipo e estática dadas = próxima volta.
  modificar: {
    campos: ['p', 'r', 'kw', 'dura'],
    qtd: q => q === undefined,
    ok: f => f.dura === 'fimDoTurno' && f.em !== undefined && (f.p !== undefined || f.r !== undefined || (f.kw || []).length > 0)
      && [f.p, f.r].every(q => q === undefined || (qtdOk(q) && !dadoOk(q))) && M.kwListaOk(f.kw),
    fx(e, f, ctx) {
      const os = objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
      const n = q => q === undefined ? 0 : typeof q === 'number' ? q : qtdDe(e, q, ctx);   // número direto: −4/−4 não vira 0
      const p = n(f.p), r = n(f.r);
      (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p, r, kw: f.kw || [], ts: ++e.ts });
    },
  },
  destruir: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (!M.temKw(e, o, 'indestrutivel')) M.mover(e, o.id, 'cemiterio'); } },   // CR 701.8, 702.12b
  exilar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) M.mover(e, o.id, 'exilio'); } },
  mover: {
    campos: ['para', 'de', 'virada', 'f', 'fundo', 'sobControle'],
    qtd: q => qtdOk(q) || ateOk(q),
    ok: f => ['mao', 'campo', 'cemiterio', 'exilio', 'grimorio'].includes(f.para) && (f.em !== undefined || (f.f && (typeof f.qtd === 'number' || ateOk(f.qtd)))),
    fx(e, f, ctx, ask) {
      let ids;
      if (f.em !== undefined) ids = objsDe(e, f, ctx).map(o => o.id);
      else {                                                        // "ponha N cartas da sua mão…" (Brainstorm)
        const j = jogsDe(e, f, ctx)[0]; if (j === undefined) return;
        const z = f.de || f.f.zona || 'mao';
        const cand = M.objetosQue(e, { ...f.f, zona: z, dono: f.f.dono || 'voce' }, { ...ctx, voce: j }).map(o => o.id);
        ids = escolherN(ask, j, 'escolherCarta', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length), { podeMenos: ateOk(f.qtd), ctx: { op: 'mover', para: f.para } });
      }
      ctx.resultado = ids.length;                                   // "then draw that many" (Valakut Awakening)
      const ent = f.para === 'campo' ? ids.map(id => M.decidirEntrada(e, id, f.sobControle === 'voce' ? ctx.voce : e.objs[id].dono, { virada: !!f.virada }, ask)) : [];
      if (f.para === 'campo') ent.forEach(p => M.aplicarEntrada(e, p));
      else for (const id of ids) M.mover(e, id, f.para, { topo: !f.fundo });
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
  perderVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) e.jogs[j].vida -= q; } },
  anular: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (o.zona === 'pilha') M.anular(e, o.id); } },   // CR 701.6
  ficha: {                                                          // CR 111
    campos: ['token', 'virada'],
    fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) for (let i = 0; i < q; i++) criarFicha(e, j, f.token, { virada: !!f.virada }); },
  },
  marcador: {                                                       // CR 122
    campos: ['tipoMarc', 'tirar'],
    fx(e, f, ctx) {
      const q = qtdDe(e, f.qtd, ctx);
      for (const o of objsDe(e, f, ctx)) { const t = f.tipoMarc; o.marc[t] = Math.max(0, (o.marc[t] || 0) + (f.tirar ? -q : q)); }
    },
  },
  virar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) o.virada = true; } },
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
    qtd: q => q === undefined || typeof q === 'number' || q === 'maoInteira' || (ateOk(q) && q.ate !== 'X'),
    fx(e, f, ctx, ask) {
      const por: any[] = [];
      for (const j of jogsDe(e, f, ctx)) {
        const mao = e.jogs[j].zonas.mao;
        if (f.qtd === 'maoInteira') { por.push([j, mao.slice()]); continue; }
        const ate = ateOk(f.qtd);
        por.push([j, escolherN(ask, j, 'descartar', mao, Math.min(ate ? qtdDe(e, f.qtd, ctx) : qtdDe(e, f.qtd, ctx), mao.length), { podeMenos: ate, ctx: { op: 'descartar' } })]);
      }
      const feitas: any[] = [];
      for (const [j, ids] of por) feitas.push(...M.descartar(e, j, ids));
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
    ok: f => ['mao', 'campo', 'cemiterio', 'grimorio', undefined].includes(f.para) && (!f.destinos || f.destinos.every(d => ['mao', 'campo', 'cemiterio', 'grimorio'].includes(d.para))),
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
          for (const t in o.marc) if (o.marc[t] > 0) o.marc[t]++;
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
      if (r.a === 'marcadores') { o.marc['+1/+1'] = (o.marc['+1/+1'] || 0) + q; return; }
      for (let i = 0; i < q; i++) criarFicha(e, ctx.voce, SERVO);
    },
  },
};
const SERVO = { n: 'Servo', tipos: ['Artifact', 'Creature'], sub: ['Servo'], pt: [1, 1], cores: '', vm: 0 };
M.EFEITOS = H;
