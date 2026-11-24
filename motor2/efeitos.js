// motor2/efeitos.js — efeitos do formato RX que o núcleo já executa na resolução (CR 608.2c–h) e o teste de suporte.
// O que não está aqui (ou tem campo que o handler não conhece) faz a carta/habilidade NÃO ser oferecida: melhor
// não jogar do que jogar errado em silêncio. Regra de cada handler: perguntar tudo antes de mexer no estado.
(function (M) {
  'use strict';
  const BASE = new Set(['op', 'em', 'quem', 'qtd', 'se', 'talvez']);
  const QUEM_OK = new Set(['voce', 'cadaOponente', 'cadaJogador', 'alvoJogador', 'controlador', 'dono']);
  const CONTA_OK = new Set(['poderDoAlvo', 'resistDoAlvo', 'vmDoAlvo', 'poderDoEste', 'resistDoEste', 'marcadoresNoEste',
    'cartasNaMao', 'oponentes', 'jogadores', 'suaVida', 'X']);
  const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta']);

  // ---------- suporte (estático, olhando só o dado) ----------
  const qtdOk = q => q === undefined || typeof q === 'number' || q === 'X'
    || (q && typeof q === 'object' && (typeof q.conta === 'string' ? CONTA_OK.has(q.conta) : M.filtroOk(q.conta))
      && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'alvo'].includes(k)));
  const emOk = v => v === undefined || v === 'este' || (v && typeof v === 'object' && (typeof v.alvo === 'number' || (v.todos && M.filtroOk(v.todos))));
  const seOk = se => !se || (Object.keys(se).every(k => COND_OK.has(k))
    && (!se.existe || M.filtroOk(se.existe.f)) && (!se.controla || M.filtroOk(se.controla.f)) && (!se.conta || qtdOk(se.conta.q)));
  M.fxSuportado = (fx, { topo = true } = {}) => (fx || []).every(f => {
    if (f.op === 'modal') return topo && fx.length === 1 && f.modos.some(m => M.fxSuportado(m, { topo: false }));
    const h = H[f.op];
    if (!h) return false;
    for (const k in f) if (!BASE.has(k) && !(h.campos || []).includes(k)) return false;
    if (f.quem !== undefined && !QUEM_OK.has(f.quem)) return false;
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
    if (v.todos) return M.objetosQue(e, v.todos.zona ? v.todos : { ...v.todos, zona: 'campo' }, ctx);
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
    switch (f.quem) {
      case undefined: case 'voce': return vivos.includes(ctx.voce) ? [ctx.voce] : [];
      case 'cadaOponente': return vivos.filter(j => j !== ctx.voce);
      case 'cadaJogador': return vivos;
      case 'alvoJogador': { for (let i = 0; i < ctx.alvos.length; i++) { const js = jogsAlvo(e, i, ctx); if (js.length) return js; } return []; }
      case 'controlador': return [...new Set(lkisDe(e, f, ctx).map(l => l.ctrl))].filter(j => vivos.includes(j));
      case 'dono': return [...new Set(lkisDe(e, f, ctx).map(l => l.dono))].filter(j => vivos.includes(j));
    }
    throw new Error('quem sem suporte: ' + f.quem);
  }
  function qtdDe(e, q, ctx) {
    if (q === undefined) return 1;
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
        case 'marcadoresNoEste': v = este ? Object.values(este.marc).reduce((s, n) => s + n, 0) : 0; break;
        case 'cartasNaMao': v = e.jogs[ctx.voce].zonas.mao.length; break;
        case 'oponentes': v = M.vivos(e).filter(j => j !== ctx.voce).length; break;
        case 'jogadores': v = M.vivos(e).length; break;
        case 'suaVida': v = e.jogs[ctx.voce].vida; break;
        case 'X': v = ctx.x || 0; break;
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
    return ctx.lki.este ? M.carta(ctx.lki.este.n) : {};
  };

  // ---------- executar um efeito ----------
  M.executar = (e, f, ctx, ask) => {
    if (f.se && !M.condicao(e, f.se, ctx)) return;                     // CR 608.2c: condição lida na hora
    if (f.talvez && ask(ctx.voce, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: f.op }).a === 'nao') return;   // "pode"
    const h = H[f.op];
    if (!h) throw new Error('efeito sem suporte no motor2: ' + f.op);
    h.fx(e, f, ctx, ask);
  };

  // entrar no campo (CR 110.2: sob o controle de quem conjurou/pôs; 614.1c "entra virado"; 614.12 escolha ao entrar)
  // Em duas metades: decidirEntrada só pergunta (pode rodar de novo), aplicarEntrada mexe no estado.
  M.entrarPermanente = (e, id, ctrl, opc, ask) => M.aplicarEntrada(e, M.decidirEntrada(e, id, ctrl, opc, ask));
  M.decidirEntrada = (e, id, ctrl, { virada = false } = {}, ask) => {
    const o = e.objs[id], d = M.dadoDe(e, o), ctx = { voce: ctrl, este: id };
    let vir = virada, pagaVida = 0;
    const s = (d.subst || []).find(x => x.ev === 'entra' && x.muda && x.muda.virada && x.quem && x.quem.este);
    if (s && M.condicao(e, s.se, ctx)) {
      if (s.aMenosQue && ask) {
        const ops = [{ a: 'naoPagar' }], c = s.aMenosQue.custo;
        if (c.vida && e.jogs[ctrl].vida >= c.vida) ops.push({ a: 'pagar' });                         // CR 119.4
        if (c.revelar) for (const r of M.objetosQue(e, { ...c.revelar.f, dono: 'voce', zona: 'mao' }, ctx)) if (r.id !== id) ops.push({ a: 'revelar', rid: r.id });
        const r = ask(ctrl, 'aMenosQue', ops, { id, vida: c.vida || 0 });
        if (r.a === 'naoPagar') vir = true; else if (r.a === 'pagar') pagaVida = c.vida;
      } else vir = true;
    }
    let escolha = null;
    if (ask) {
      for (const sb of d.subst || []) {
        if (sb.ev !== 'entra' || !sb.emVez || escolha) continue;
        for (const fz of sb.emVez) {
          if (fz.op !== 'escolher') continue;
          let ops;
          if (fz.o === 'cor') ops = (fz.cores || 'WUBRG').split('').map(c => ({ a: 'cor', v: c }));
          else if (fz.o === 'tipoCriatura') {      // opções = tipos das criaturas do próprio deck (lista finita e útil)
            const t = new Set();
            for (const x of Object.values(e.objs)) if (x.dono === o.dono && !x.hab && M.temTipo(e, x, 'Creature')) (M.dadoDe(e, x).sub || []).forEach(s2 => t.add(s2));
            ops = [...t].sort().map(v => ({ a: 'tipo', v }));
            if (!ops.length) continue;
          } else continue;
          const r = ask(ctrl, 'escolha', ops, { id, o: fz.o });
          escolha = fz.o === 'cor' ? { cor: r.v } : { tipo: r.v };
          break;
        }
      }
    }
    return { id, ctrl, vir, pagaVida, escolha };
  };
  M.aplicarEntrada = (e, { id, ctrl, vir, pagaVida, escolha }) => {
    if (pagaVida) e.jogs[ctrl].vida -= pagaVida;
    const o = M.mover(e, id, 'campo', { virada: vir });
    o.ctrl = ctrl; o.escolha = escolha;
    M.log(e, e.jogs[ctrl].nome, 'põe no campo', o.n, vir ? '(virado)' : '');
    return o;
  };

  // escolher n objetos de uma lista, um por pergunta (pode parar antes se 'podeMenos')
  function escolherN(ask, j, tipo, ids, n, { podeMenos = false, ctx = {} } = {}) {
    const r = [];
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
  function criarFicha(e, j, tok, { virada = false } = {}) {
    const id = e.prox++;
    const n = tok.n || ((tok.sub || []).join(' ') + ' Token').trim();
    const o = { id, n, dono: j, ctrl: j, zona: 'campo', ts: ++e.ts, virada, dano: 0, marc: {}, doente: true, cmd: false, ficha: { ...tok, n } };
    e.objs[id] = o; e.campo.push(id);
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
      fx(e, f, ctx) {                                                 // CR 120
        const q = qtdDe(e, f.qtd, ctx); if (q <= 0) return;
        const fonte = fonteDado(e, ctx);
        let total = 0;
        for (const o of objsDe(e, f, ctx)) { danoEm(e, o, q, fonte); total += q; }
        const js = f.em && typeof f.em.alvo === 'number' ? jogsAlvo(e, f.em.alvo, ctx) : [];
        const jq = f.quem ? jogsDe(e, f, ctx) : [];
        for (const j of [...new Set([...js, ...jq])]) { e.jogs[j].vida -= q; total += q; }   // CR 120.3a
        if (total && (fonte.kw || []).some(k => k.k === 'vinculoVida')) e.jogs[ctx.voce].vida += total;   // CR 702.15b
      },
    },
    destruir: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) if (!M.temKw(e, o, 'indestrutivel')) M.mover(e, o.id, 'cemiterio'); } },   // CR 701.8, 702.12b
    exilar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) M.mover(e, o.id, 'exilio'); } },
    mover: {
      campos: ['para', 'de', 'virada', 'f', 'fundo', 'sobControle'],
      ok: f => ['mao', 'campo', 'cemiterio', 'exilio', 'grimorio'].includes(f.para) && (f.em !== undefined || (f.f && typeof f.qtd === 'number')),
      fx(e, f, ctx, ask) {
        let ids;
        if (f.em !== undefined) ids = objsDe(e, f, ctx).map(o => o.id);
        else {                                                        // "ponha N cartas da sua mão…" (Brainstorm)
          const j = jogsDe(e, f, ctx)[0]; if (j === undefined) return;
          const z = f.de || f.f.zona || 'mao';
          const cand = M.objetosQue(e, { ...f.f, zona: z, dono: f.f.dono || 'voce' }, { ...ctx, voce: j }).map(o => o.id);
          ids = escolherN(ask, j, 'escolherCarta', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length), { ctx: { op: 'mover', para: f.para } });
        }
        const ent = f.para === 'campo' ? ids.map(id => M.decidirEntrada(e, id, f.sobControle === 'voce' ? ctx.voce : e.objs[id].dono, { virada: !!f.virada }, ask)) : [];
        if (f.para === 'campo') ent.forEach(p => M.aplicarEntrada(e, p));
        else for (const id of ids) M.mover(e, id, f.para, { topo: !f.fundo });
      },
    },
    ganharVida: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) { e.jogs[j].vida += q; if (q > 0) M.evento(e, { ev: 'ganhaVida', j, q }); } } },   // CR 119.3
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
    desvirar: { fx(e, f, ctx) { for (const o of objsDe(e, f, ctx)) o.virada = false; } },
    descartar: {                                                      // CR 701.9: quem descarta escolhe
      qtd: q => q === undefined || typeof q === 'number' || q === 'maoInteira',
      fx(e, f, ctx, ask) {
        const esc = [];
        for (const j of jogsDe(e, f, ctx)) {
          const mao = e.jogs[j].zonas.mao;
          if (f.qtd === 'maoInteira') { esc.push(...mao); continue; }
          esc.push(...escolherN(ask, j, 'descartar', mao, Math.min(qtdDe(e, f.qtd, ctx), mao.length)));
        }
        for (const id of esc) M.mover(e, id, 'cemiterio');
      },
    },
    moer: { fx(e, f, ctx) { const q = qtdDe(e, f.qtd, ctx); for (const j of jogsDe(e, f, ctx)) { const g = e.jogs[j].zonas.grimorio; for (let i = 0; i < q && g.length; i++) M.mover(e, g[g.length - 1], 'cemiterio'); } } },   // CR 701.13
    sacrificar: {                                                     // CR 701.21: quem sacrifica escolhe
      campos: ['f'],
      fx(e, f, ctx, ask) {
        const esc = [];
        for (const j of jogsDe(e, f, ctx)) {
          const cand = M.objetosQue(e, { ...(f.f || {}), ctrl: 'voce', zona: 'campo' }, { ...ctx, voce: j }).map(o => o.id);
          esc.push(...escolherN(ask, j, 'sacrificar', cand, Math.min(qtdDe(e, f.qtd, ctx), cand.length)));
        }
        for (const id of esc) M.mover(e, id, 'cemiterio');
      },
    },
    embaralhar: { fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) M.embaralhar(e, e.jogs[j].zonas.grimorio); } },
    buscar: {                                                         // CR 701.19 (pode não achar: 701.19b)
      campos: ['f', 'para', 'revelar', 'virada', 'destinos'],
      ok: f => ['mao', 'campo', 'cemiterio', 'grimorio', undefined].includes(f.para) && (!f.destinos || f.destinos.every(d => ['mao', 'campo', 'cemiterio', 'grimorio'].includes(d.para))),
      fx(e, f, ctx, ask) {
        const plano = [];
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
    videncia: {                                                       // CR 701.22: olha N, põe qualquer número no fundo
      fx(e, f, ctx, ask) {
        const q = qtdDe(e, f.qtd, ctx);
        const fundo = [];
        for (const j of jogsDe(e, f, ctx)) {
          const g = e.jogs[j].zonas.grimorio, topo = g.slice(-q).reverse();
          fundo.push(...topo.filter(id => ask(j, 'videncia', [{ a: 'topo', id }, { a: 'fundo', id }], {}).a === 'fundo'));
        }
        for (const id of fundo) M.mover(e, id, 'grimorio', { topo: false });
      },
    },
  };
  M.EFEITOS = H;
})(globalThis.MOTOR2 = globalThis.MOTOR2 || {});
