// motor2/turno.js — começo do jogo e mulligan (CR 103), turno: fases e etapas (CR 500–514), jogar terreno (CR 305),
// ações baseadas em estado (CR 704 + Commander 903.9a/903.10a), jogador que sai (CR 800.4) e o ponto único de pergunta.
// O núcleo nunca decide: toda escolha vira e.perg = {j, tipo, ops, ctx}; M.responder(e, k) continua de onde parou.
(function (M) {
  'use strict';
  // CR 500.1: inicial (desvirar, manutenção, compra), principal, combate (CR 506.1), principal, final (CR 512–514)
  const PASSOS = ['desvirar', 'manutencao', 'compra', 'principal1', 'inicioCombate', 'atacantes', 'bloqueadores',
    'dano', 'fimCombate', 'principal2', 'final', 'limpeza'];
  M.PASSOS = PASSOS;
  const PRINCIPAL = new Set(['principal1', 'principal2']);

  // ---------- laço ----------
  // parar(e) opcional: para antes de cada volta do laço quando der verdadeiro (testes, "jogar até a etapa X")
  M.avancar = (e, parar) => {
    while (!e.perg && !e.fim) {
      if (parar && parar(e)) break;
      const T = e.turno;
      if (T.passo === 'mulligan') { passoMulligan(e); continue; }
      if (!T.feito) { T.feito = true; T.prio = null; acaoDoTurno(e); if (e.perg || e.fim) break; }
      M.abe(e); if (e.perg || e.fim) break;                            // CR 117.5: ações de estado antes da prioridade
      if (M.temPrioridadeNoPasso(T.passo) && !(T.prio && T.prio.acabou)) {
        const r = M.passoPrioridade(e);
        if (r === 'fim') T.prio.acabou = true;
        if (r !== 'fim') continue;
      }
      proximoPasso(e);
    }
    return e;
  };

  M.responder = (e, k, parar) => {
    const p = e.perg;
    if (!p) throw new Error('não há pergunta');
    if (!(k >= 0 && k < p.ops.length)) throw new Error(`resposta fora das opções (${p.tipo}): ${k}`);
    e.perg = null;
    if (p.proc) M.continuarProc(e, k);
    else RESP[p.tipo](e, p, p.ops[k]);
    return M.avancar(e, parar);
  };

  // joga até o fim com agentes {j: (e, perg) => índice}
  M.rodar = (e, agentes, { maxPerguntas = 200000 } = {}) => {
    M.avancar(e);
    let n = 0;
    while (e.perg && !e.fim) {
      if (++n > maxPerguntas) throw new Error('partida não termina (perguntas demais)');
      const ag = agentes[e.perg.j] || agentes[0];
      M.responder(e, ag(e, e.perg));
    }
    return e;
  };

  // ---------- mulligan (CR 103.5, London; 103.5c: em multijogador o 1º é grátis) ----------
  function passoMulligan(e) {
    const vivos = e.jogs.map(j => j.i), n = e.jogs.length;
    if (!e.mull) {
      for (const j of vivos) M.comprar(e, j, 7);
      const ordem = []; for (let i = 0; i < n; i++) ordem.push((e.turno.primeiro + i) % n);
      e.mull = { decidindo: ordem, i: 0, querem: [], fundo: null };
    }
    const m = e.mull;
    if (m.fundo === null && m.i < m.decidindo.length) {
      const j = m.decidindo[m.i];
      if (e.jogs[j].mulls >= 7) { m.i++; return; }                    // mão vazia: não há o que tentar
      e.perg = { j, tipo: 'mulligan', ops: [{ a: 'manter' }, { a: 'mulligan' }] };
      return;
    }
    if (m.fundo === null && m.querem.length) {                        // todos declararam: quem pediu troca a mão
      for (const j of m.querem) {
        const J = e.jogs[j];
        for (const id of J.zonas.mao.slice()) M.mover(e, id, 'grimorio');
        M.embaralhar(e, J.zonas.grimorio); M.comprar(e, j, 7); J.mulls++;
      }
      m.decidindo = m.querem; m.querem = []; m.i = 0;
      return;
    }
    if (m.fundo === null) m.fundo = e.jogs.map(J => Math.max(0, J.mulls - (n > 2 ? 1 : 0)));
    const j = m.fundo.findIndex(x => x > 0);
    if (j >= 0) {
      e.perg = { j, tipo: 'fundo', ops: e.jogs[j].zonas.mao.map(id => ({ a: 'fundo', id })) };
      return;
    }
    e.mull = null;
    Object.assign(e.turno, { n: 1, passo: 'desvirar', feito: false, passar: false });
  }

  // ---------- ações do turno (não usam a pilha) ----------
  function acaoDoTurno(e) {
    const T = e.turno, a = T.ativo, J = e.jogs[a];
    if (J.saiu) return;                                               // CR 800.4j: turno segue sem jogador ativo
    switch (T.passo) {
      case 'atacantes': case 'bloqueadores': case 'dano': M.acaoCombate(e); break;   // combate.js (CR 508–510)
      case 'desvirar':                                                // CR 502.2–502.3
        J.terrenos = 0;
        for (const id of e.campo) { const o = e.objs[id]; if (o.ctrl === a) { o.virada = false; o.doente = false; } }
        break;
      case 'compra':                                                  // CR 504.1; 103.8a só em 2 jogadores
        if (!(T.n === 1 && e.jogs.length === 2)) M.comprar(e, a, 1);
        break;
      case 'limpeza': {                                               // CR 514.1 descarte até o máximo
        const sobra = J.zonas.mao.length - maoMax(e, a);
        if (sobra > 0) { e.perg = { j: a, tipo: 'descartar', ops: J.zonas.mao.map(id => ({ a: 'descartar', id })), ctx: { faltam: sobra } }; return; }
        limpar(e);
        break;
      }
    }
  }
  function limpar(e) {                                                // CR 514.2: dano sai, "até o fim do turno" acaba
    for (const id of e.campo) { e.objs[id].dano = 0; e.objs[id].mortal = false; }
  }
  // tamanho máximo de mão (CR 402.2: 7) — Reliquary Tower e cia. (est maoMax) lidos aqui até as camadas da T18
  function maoMax(e, j) {
    let m = 7;
    for (const id of e.campo) {
      const o = e.objs[id]; if (o.ctrl !== j) continue;
      for (const s of M.dadoDe(e, o).est || []) if (s.modo === 'maoMax' && s.afeta === 'voce') m = s.qtd === 'tudo' ? Infinity : Math.max(m, s.qtd);
    }
    return m;
  }
  M.maoMax = maoMax;

  function proximoPasso(e) {
    const T = e.turno;
    M.esvaziarReservas(e);                                            // CR 106.4
    const pula = M.depoisDoPasso(e, T.passo);                         // 508.8 sem atacantes → fim do combate; 510.4 2ª etapa
    let i = pula ? PASSOS.indexOf(pula) : PASSOS.indexOf(T.passo) + 1;
    T.feito = false; T.prio = null;
    if (i < PASSOS.length) { T.passo = PASSOS[i]; return; }
    // próximo turno: próximo jogador na ordem que ainda está no jogo (CR 800.4k)
    const n = e.jogs.length;
    let p = T.ativo;
    do p = (p + 1) % n; while (e.jogs[p].saiu);
    T.ativo = p; T.n++; T.passo = 'desvirar';
    if (T.n > e.cfg.maxTurnos) e.fim = { vencedor: null, motivo: 'limite de turnos' };
  }

  // ---------- ações de quem tem prioridade: M.opcoesPrioridade (pilha.js) ----------
  M.acoesPrincipais = (e, j) => M.opcoesPrioridade(e, j);
  // terrenos por turno: 1 + estáticas terraExtra de quem controla (lidas aqui até as camadas da T18)
  function terrenosPorTurno(e, j) {
    let n = 1;
    for (const id of e.campo) {
      const o = e.objs[id]; if (o.ctrl !== j) continue;
      for (const s of M.dadoDe(e, o).est || []) if (s.modo === 'terraExtra' && s.afeta === 'voce' && typeof s.qtd === 'number') n += s.qtd;
    }
    return n;
  }
  M.terrenosPorTurno = terrenosPorTurno;

  // jogar terreno (CR 305.1: ação especial, não usa a pilha). "Entra virado" (CR 614.1c) e escolha ao entrar em
  // M.decidirEntrada (efeitos.js), que pergunta pelo processo.
  M.PROC.terreno = (e, P, ask) => {
    const j = P.j, o = e.objs[P.id];
    if (o.zona !== 'mao' || o.dono !== j || !M.temTipo(e, o, 'Land')) throw new Error('terreno ilegal');
    const plano = M.decidirEntrada(e, P.id, j, {}, ask);
    e.proc = null;
    e.jogs[j].terrenos++;
    M.aplicarEntrada(e, plano);
    M.agiu(e, j);                                                     // CR 117.3c
  };
  const jogarTerreno = (e, j, id) => M.iniciarProc(e, { tp: 'terreno', j, id });
  M.jogarTerreno = jogarTerreno;

  // ---------- respostas ----------
  const RESP = {
    mulligan(e, p, op) { const m = e.mull; if (op.a === 'mulligan') m.querem.push(p.j); m.i++; },
    fundo(e, p, op) { M.mover(e, op.id, 'grimorio', { topo: false }); e.mull.fundo[p.j]--; },
    acao(e, p, op) {
      if (op.a === 'passar') M.passar(e);
      else if (op.a === 'terreno') jogarTerreno(e, p.j, op.id);
      else if (op.a === 'mana') { M.ativarMana(e, p.j, op.id, op.k, op.escolha); M.agiu(e, p.j); }   // CR 605.3a
      else if (op.a === 'conjurar') M.conjurar(e, p.j, op.id);
      else if (op.a === 'ativar') M.ativar(e, p.j, op.id, op.k);
    },
    descartar(e, p, op) {
      M.mover(e, op.id, 'cemiterio');
      const f = p.ctx.faltam - 1;
      if (f > 0) e.perg = { j: p.j, tipo: 'descartar', ops: e.jogs[p.j].zonas.mao.map(id => ({ a: 'descartar', id })), ctx: { faltam: f } };
      else limpar(e);
    },
    lenda(e, p, op) { for (const id of p.ctx.ids) if (id !== op.id) M.mover(e, id, 'cemiterio'); },
    cmdZona(e, p, op) { if (op.a === 'comando') M.mover(e, p.ctx.id, 'comando'); },
  };

  // ---------- ações baseadas em estado (CR 704.3: todas de uma vez, repete até nada mudar) ----------
  M.abe = e => {
    for (let volta = 0; volta < 100; volta++) {
      let mudou = false;
      // jogadores (CR 704.5a–c, 903.10a): perdem todos juntos
      const perdem = [];
      for (const J of e.jogs) {
        if (J.saiu) continue;
        if (J.vida <= 0 || J.comprouVazio || J.veneno >= 10 || Object.values(J.danoCmd).some(d => d >= 21)) perdem.push(J.i);
        J.comprouVazio = false;
      }
      // permanentes (CR 704.5f, g, i) e fichas fora do campo (704.5d)
      const morrem = [];
      for (const id of e.campo) {
        const o = e.objs[id];
        if (M.temTipo(e, o, 'Creature')) {
          const r = M.resistencia(e, o);
          if (r <= 0) morrem.push(id);                                   // CR 704.5f
          else if ((o.dano >= r || (o.mortal && o.dano > 0)) && !M.temKw(e, o, 'indestrutivel')) morrem.push(id);   // 704.5g–h; regenerar = T19
        }
        if (M.temTipo(e, o, 'Planeswalker') && (o.marc.lealdade || 0) <= 0) morrem.push(id);
      }
      for (const id of [...new Set(morrem)]) { M.mover(e, id, 'cemiterio'); mudou = true; }
      // CR 704.5q: marcadores +1/+1 e −1/−1 se anulam
      for (const id of e.campo) { const m = e.objs[id].marc, a = Math.min(m['+1/+1'] || 0, m['-1/-1'] || 0); if (a) { m['+1/+1'] -= a; m['-1/-1'] -= a; mudou = true; } }
      while (e.fichasFora && e.fichasFora.length) {
        const o = e.objs[e.fichasFora.pop()];
        if (o && o.ficha && o.zona !== 'campo') { const l = M.listaDe(e, o), k = l.indexOf(o.id); if (k >= 0) l.splice(k, 1); delete e.objs[o.id]; mudou = true; }
      }
      for (const j of perdem) { M.sair(e, j, 'perdeu'); mudou = true; }
      if (e.fim) return;
      // regra da lenda (CR 704.5j): o controlador escolhe qual fica
      const lend = {};
      for (const id of e.campo) {
        const o = e.objs[id];
        if ((M.dadoDe(e, o).super || []).includes('Legendary')) (lend[o.ctrl + '|' + o.n] = lend[o.ctrl + '|' + o.n] || []).push(id);
      }
      const dup = Object.values(lend).find(l => l.length > 1);
      if (dup) { e.perg = { j: e.objs[dup[0]].ctrl, tipo: 'lenda', ops: dup.map(id => ({ a: 'fica', id })), ctx: { ids: dup } }; return; }
      // comandante no cemitério/exílio desde a última checagem (CR 903.9a): o dono pode mandar ao comando
      while (e.abeNovo.length) {
        const id = e.abeNovo.shift(), o = e.objs[id];
        if (o && o.cmd && (o.zona === 'cemiterio' || o.zona === 'exilio') && !e.jogs[o.dono].saiu) {
          e.perg = { j: o.dono, tipo: 'cmdZona', ops: [{ a: 'comando' }, { a: 'ficar' }], ctx: { id } };
          return;
        }
      }
      if (!mudou) return;
    }
    throw new Error('ações de estado em laço');
  };

  // jogador sai do jogo (CR 800.4a): tudo que é dele sai; o que ele controla e não é dele vai ao exílio
  M.sair = (e, j, motivo) => {
    const J = e.jogs[j];
    if (J.saiu) return;
    J.saiu = motivo || true; J.reserva = M.zeroMana();
    for (const id in e.objs) {
      const o = e.objs[id];
      if (o.dono === j) { const l = M.listaDe(e, o), k = l.indexOf(o.id); if (k >= 0) l.splice(k, 1); delete e.objs[id]; }
      else if (o.ctrl === j && o.zona === 'campo') M.mover(e, o.id, 'exilio');
    }
    if (e.perg && e.perg.j === j) e.perg = null;
    M.log(e, J.nome, 'sai do jogo:', motivo);
    const v = M.vivos(e);
    if (v.length <= 1) e.fim = { vencedor: v.length ? v[0] : null, motivo: 'último na mesa', turno: e.turno.n };   // CR 104.2a
  };
})(globalThis.MOTOR2 = globalThis.MOTOR2 || {});
