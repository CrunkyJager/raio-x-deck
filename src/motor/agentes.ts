// src/motor/agentes.ts (T43: migrado de motor2/agentes.js) — agentes simples que respondem às perguntas do núcleo (a IA de verdade é a T21).
import { M } from './nucleo';

// aleatório (fuzz): sorteia com a semente do próprio estado
// dragar (702.52a): troca a compra quando a carta de volta vale mais que uma compra às cegas e o grimório aguenta
// (sobram 10+ depois de moer). Vale mais: ela devolve terrenos do cemitério e há 2+ lá (Life from the Loam); você tem
// gatilho de moer/cemitério no campo; ou é mágica cara (vm 3+). Senão compra.
const escolheDragar = (e, p) => {
  const J = e.jogs[p.j], o = id => e.objs[id];
  const terrasCem = J.zonas.cemiterio.filter(id => M.temTipo(e, o(id), 'Land')).length;
  const plano = e.campo.some(id => o(id).ctrl === p.j && (M.dadoDe(e, o(id)).gat || []).some(g => g.ev === 'moe' || g.ev === 'moeGrupo'));
  const devolveTerra = d => (d.fx || []).some(f => f.op === 'mover' && f.para === 'mao' && f.de === 'cemiterio')
    && (d.alvos || []).some(a => a.f && a.f.zona === 'cemiterio' && (a.f.tipo || []).includes('Land'));
  let b = 0, bv = 0;
  p.ops.forEach((op, k) => {
    if (op.a !== 'dragar' || J.zonas.grimorio.length - op.n < 10) return;
    const d = M.dadoDe(e, o(op.id));
    const v = (devolveTerra(d) && terrasCem >= 2 ? 3 : 0) + (plano ? 2 : 0) + ((d.vm || 0) >= 3 ? 1.5 : 0);
    if (v > bv) { bv = v; b = k; }
  });
  return b;
};
M.agenteAleatorio = () => (e, p) => Math.floor(M.aleat(e) * p.ops.length);
// básico: mantém mão com 2–5 terrenos, joga terreno (desvirado primeiro), não gasta mana à toa,
// descarta/põe no fundo a carta de maior valor de mana, comandante sempre volta ao comando
const basico = (e, p) => {
  const J = e.jogs[p.j], o = id => e.objs[id];
  const terra = id => M.temTipo(e, o(id), 'Land');
  switch (p.tipo) {
    case 'mulligan': {
      const t = J.zonas.mao.filter(terra).length;
      return J.mulls < 2 && (t < 2 || t > 5) ? 1 : 0;
    }
    case 'vigiar': {                  // vigiar: terreno com 5+ no campo vai ao cemitério; o resto fica
      const id = p.ops[0].id, nT = e.campo.filter(x => o(x).ctrl === p.j && terra(x)).length;
      return terra(id) && nT >= 5 ? 1 : 0;
    }
    case 'descartar': {               // filtrar: loucura e terreno sobrando primeiro; descarte opcional só com ganho
      const k = escolheDescarte(e, p);
      if (k >= 0) return k;
      let b = 0, bv = -1;
      p.ops.forEach((op, k2) => { if (op.a !== 'descartar') return; const v = terra(op.id) ? 0.5 : (M.dadoDe(e, o(op.id)).vm || 0); if (v > bv) { bv = v; b = k2; } });
      return b;
    }
    case 'pilha': { const S = (p.ctx && p.ctx.somas) || [0, 0]; return S[0] <= S[1] ? 0 : 1; }   // separar: na pilha mais leve; escolher a sacrificada: a mais leve (Liliana of the Veil)
    case 'dragar': return escolheDragar(e, p);
    case 'talvez': {                  // "pode descartar": sim quando há o que filtrar ou gatilho de descarte
      if (p.ctx && p.ctx.op === 'entraVirada') return 1;   // "you may have this enter tapped": desvirada (o "se fizer" é o preço, Mariposa)
      if (p.ctx && p.ctx.op === 'descartar') return querDescartar(e, p.j) ? 0 : 1;
      if (p.ctx && p.ctx.op === 'subst' && p.ctx.para === 'grimorio') return terra(p.ctx.id) || !!M.loucuraDe(e, o(p.ctx.id)) ? 1 : 0;   // Leng: carta boa volta ao topo; terreno/loucura não
      return 0;
    }
    case 'fundo': {
      let b = 0, bv = -1;
      p.ops.forEach((op, k) => { const v = terra(op.id) ? 0.5 : (M.dadoDe(e, o(op.id)).vm || 0); if (v > bv) { bv = v; b = k; } });
      return b;
    }
    case 'acao': {                    // terreno (desvirado primeiro) → a mágica mais cara → habilidade de {T}/lealdade → passa
      const dOp = op => op.face === undefined ? M.dadoDe(e, o(op.id)) : M.dadoFace(M.carta(o(op.id).n), op.face);   // a face da opção
      const k = p.ops.findIndex(op => op.a === 'terreno' && !(dOp(op).subst || []).length);
      if (k >= 0) return k;
      const k2 = p.ops.findIndex(op => op.a === 'terreno');
      if (k2 >= 0) return k2;
      const meu = e.turno.ativo === p.j;
      let b = -1, bv = -1;
      p.ops.forEach((op, i) => {
        if (op.a !== 'conjurar') return;
        if (op.baixo) { if (meu && !p.ops.some(x => x.a === 'conjurar' && x.id === op.id && !x.baixo) && 3 > bv) { bv = 3; b = i; } return; }   // 702.37c: virada por {3} só quando não dá para conjurar normal
        const d = dOp(op), inst = (d.tipos || []).includes('Instant');
        if (!meu && !inst) return;
        if (inst && !d.alvos && !meu) return;            // instantânea sem alvo: no próprio turno
        if ((d.vm || 0) > bv) { bv = d.vm || 0; b = i; }
      });
      if (b >= 0) return b;
      // suspender (702.62a): com a mana que sobrou das mágicas, a carta que não dá para conjurar agora (sem custo de mana ou cara demais)
      const kss = p.ops.findIndex(op => op.a === 'suspender' && !p.ops.some(x => x.a === 'conjurar' && x.id === op.id));
      if (kss >= 0) return kss;
      if (meu) {                      // equipar (CR 702.6): o Equipamento que não está preso a ninguém
        const ke = p.ops.findIndex(op => op.a === 'ativar' && M.atvDe(e, o(op.id))[op.k]._equipar && !M.anexadoA(e, o(op.id))
          && !e.pilha.some(h => e.objs[h].hab && e.objs[h].hab.fonte === op.id));   // já na pilha: espera resolver
        if (ke >= 0) return ke;
        // selar (702.171a): antes do combate, se ainda não está selada
        const ks = e.turno.passo === 'principal1' ? p.ops.findIndex(op => op.a === 'ativar' && M.atvDe(e, o(op.id))[op.k]._selar && !M.selada(e, o(op.id))) : -1;
        if (ks >= 0) return ks;
        // Classe (716.2a): sobe de nível com a mana que sobrou depois das mágicas (o nível só soma habilidade)
        const kn = p.ops.findIndex(op => op.a === 'ativar' && M.atvDe(e, o(op.id))[op.k]._nivel
          && !e.pilha.some(h => e.objs[h].hab && e.objs[h].hab.fonte === op.id));
        if (kn >= 0) return kn;
        // Room (709.5e): destranca a outra porta com a mana que sobrou das mágicas
        const kd = p.ops.findIndex(op => op.a === 'destrancar');
        if (kd >= 0) return kd;
        // desvirar (116.2b): com a mana que sobrou das mágicas
        const kv = p.ops.findIndex(op => op.a === 'virarParaCima');
        if (kv >= 0) return kv;
      }
      if (meu) {
        const k3 = p.ops.findIndex(op => op.a === 'ativar' && (() => { const a = M.atvDe(e, o(op.id))[op.k]; return a.lealdade !== undefined || (a.custo.virar && !(o(op.id).ficha && a.custo.sacrificar === 'este')); })());
        if (k3 >= 0) return k3;
        // ficha de sacrificar (Clue, Food, Blood, Shard, Lander): com a mana que sobrou; Blood só descartando terreno de sobra
        const k4 = p.ops.findIndex(op => op.a === 'ativar' && o(op.id).ficha && (() => { const c = M.atvDe(e, o(op.id))[op.k].custo; return c.sacrificar === 'este' && (!c.descartar || querDescartar(e, p.j)); })());
        if (k4 >= 0) return k4;
        // ciclar (702.29) com a mana que sobrou: com gatilho de descarte, ou a carta que não dá para conjurar agora
        const k5 = p.ops.findIndex(op => op.a === 'ativar' && M.atvDe(e, o(op.id))[op.k]._ciclar
          && (gatilhoDescarte(e, p.j) || !p.ops.some(x => x.a === 'conjurar' && x.id === op.id)));
        if (k5 >= 0) return k5;
      }
      return 0;
    }
    case 'alvo': {                    // jogador: o oponente com menos vida; objeto: o mais caro de um oponente
      if (p.ctx && p.ctx.de < 0) { const k = alvoSala(e, p); if (k >= 0) return k; }   // sala de masmorra (fonte = a masmorra)
      let b = 0, bv = -Infinity;
      p.ops.forEach((op, i) => {
        let v;
        if (op.a === 'pronto') v = -1;
        else if (op.jog !== undefined) v = p.ctx && p.ctx.paraSi ? (op.jog === p.j ? 1000 : 0) : op.jog === p.j ? -5 : 100 - e.jogs[op.jog].vida;   // paraSi: virar monarca (Éomer)
        else { const x = o(op.o); v = (x.ctrl === p.j ? -10 : 10) + (M.dadoDe(e, x).vm || 0); }
        if (v > bv) { bv = v; b = i; }
      });
      return b;
    }
    // concessão (702.103): vira Aura só se já tenho criatura boa (poder ≥ 2) e a carta dá bônus à encantada; senão conjura normal
    case 'opcao': {
      const k = p.ops.findIndex(op => op.v && op.v.concessao); if (k < 0) return 0;
      const F = p.ctx && o(p.ctx.id), da = !!F && (M.dadoDe(e, F).est || []).some(s => s.afeta === 'equipada');
      const boa = e.campo.some(id => { const x = o(id); return x.ctrl === p.j && x.id !== p.ctx.id && M.temTipo(e, x, 'Creature') && M.poder(e, x) >= 2; });
      return da && boa ? k : k === 0 ? 1 : 0;
    }
    case 'concessao': return melhorOp(p.ops, op => { const x = o(op.o); return (x.ctrl === p.j ? 100 : -100) + M.poder(e, x) + M.resistencia(e, x); });   // a minha maior
    // "choose a player"/"an opponent" sem alvo (Gluntch, Baleful Mastery): o que é bom fica comigo; entre oponentes, o de menos vida
    case 'jogador': { const k = p.ops.findIndex(op => op.jog === p.j); return k >= 0 ? k : melhorOp(p.ops, op => -e.jogs[op.jog].vida); }
    case 'modo': if (p.ctx && p.ctx.pontos) return melhorOp(p.ops, op => op.a === 'modo' ? p.ctx.pontos[op.m] ?? 1 : 0); return 0;   // {P}: o modo mais caro que ainda cabe (pronto quando não cabe nada)
    case 'parear': return melhorOp(p.ops, op => op.a !== 'parear' ? -1 : 100 + M.poder(e, o(op.id)));   // 702.95a: parear sempre (o par só dá), com a mais forte
    case 'cifrar': return melhorOp(p.ops, op => op.a !== 'cifrar' ? -1 : 100 + (M.temKw(e, o(op.id), 'voar') ? 10 : 0) + M.poder(e, o(op.id)));   // 702.99a: codifica na que mais passa (voa) e bate
    case 'um': return melhorOp(p.ops, op => M.poder(e, o(op.id)));   // "a creature you control" sem alvo: a de mais poder
    case 'buscar': case 'cavar': case 'destino': return p.ops.length > 1 && p.ops[0].a === 'nenhum' ? 1 : 0;
    case 'manter': {                  // a que fica: a de mais valor (não ficha, maior valor de mana)
      let b = 0, bv = -Infinity;
      p.ops.forEach((op, i) => { const v = op.id ? (o(op.id).ficha ? -1 : (M.dadoDe(e, o(op.id)).vm || 0)) : -9; if (v > bv) { bv = v; b = i; } });
      return b;
    }
    case 'sacrificar': if (p.ctx && p.ctx.entra) { const k = p.ops.findIndex(op => op.a === 'sacrificar'); return k >= 0 ? k : 0; }   // Feasting Hobbit: todas as Comidas
    // falls through
    case 'custo': {
      let b = 0, bv = Infinity;
      p.ops.forEach((op, i) => { const v = op.id ? (o(op.id).ficha ? -1 : op.a === 'descartar' && terra(op.id) ? -2 : (M.dadoDe(e, o(op.id)).vm || 0)) : 0; if (v < bv) { bv = v; b = i; } });
      return b;
    }
    case 'virar': {                   // "vire até N" (Myr Battlesphere): todas as que der
      const k = p.ops.findIndex(op => op.a === p.tipo); return k >= 0 ? k : 0;
    }
    case 'escolherCarta': {           // marcadores numa criatura escolhida (Finality): a de maior resistência
      if (!(p.ctx && p.ctx.op === 'marcador')) return 0;
      return melhorOp(p.ops, op => op.id === undefined ? -99 : M.resistencia(e, o(op.id)));
    }
    case 'desvirar': {                // "desvire até N": as suas primeiro (o núcleo já põe as suas na frente)
      const k = p.ops.findIndex(op => op.id !== undefined && o(op.id).ctrl === p.j);
      return k >= 0 ? k : 0;
    }
    case 'tumulto': {                 // 702.136a: pressa se ainda dá para atacar neste turno; senão o marcador (fica para sempre)
      const atacaJa = e.turno.ativo === p.j && ['principal1', 'inicioCombate'].includes(e.turno.passo);
      return p.ops.findIndex(op => op.a === (atacaJa ? 'pressa' : 'marcador'));
    }
    case 'x': {                       // X de vida (Toxic Deluge): o menor que mata a maior criatura do oponente, sem morrer
      if (!(p.ctx && p.ctx.vida)) return 0;
      const r = Math.max(0, ...e.campo.map(o).filter(x => x.ctrl !== p.j && M.temTipo(e, x, 'Creature')).map(x => M.resistencia(e, x)));
      const v = Math.min(r, J.vida - 1);
      return Math.max(0, p.ops.findIndex(op => op.v === v));
    }
    case 'custoOu': {                 // custo adicional com "ou": a opção que perde menos (ficha < descartar o que sobra < o resto)
      const perda = c => {
        let v = 0;
        if (c.sacrificar && c.sacrificar !== 'este') {
          const l = e.campo.map(o).filter(x => x.ctrl === p.j && x.id !== p.ctx.id && M.bate(e, x, { ...(c.sacrificar.f || {}), zona: 'campo' }, { voce: p.j }));
          v += Math.min(...l.map(x => x.ficha ? -1 : (M.dadoDe(e, x).vm || 0) + 1));
        }
        if (c.descartar) v += Math.min(...J.zonas.mao.filter(id => id !== p.ctx.id).map(id => valorDescarte(e, p.j, id))) + 0.5;
        if (c.vida) v += c.vida / 3;
        if (c.mana) v += (c.mana.g || 0) + (c.mana.p || []).length;   // "ou pague {1}": revelar sai de graça
        return v;
      };
      return melhorOp(p.ops, op => -perda(op.v));
    }
    case 'aMenosQue': return p.ops.length > 1 && J.vida > 10 ? 1 : 0;
    case 'aMenosQuePagar': {          // pagar para impedir: anular a minha mágica, sempre; mana no turno dos outros (sobraria);
      const k = p.ops.findIndex(op => op.a === 'pagar'); if (k < 0) return 0;   // vida com folga; sacrifício só quando o efeito é contra mim
      const c = p.ctx.custo, meu = p.ctx.de === p.j;
      if (p.ctx.op === 'anular' || p.ctx.op === 'resguardo') return k;   // a minha mágica/habilidade seria anulada
      if (p.ctx.op === 'pagando') return c.vida ? (e.jogs[p.j].vida > c.vida + 10 ? k : 0) : c.mana || c.exilarDe ? k : 0;   // com vida (mesmo junto de mana): com folga; mana e exilar do cemitério sim
      if (p.ctx.op === 'efeitoTemporario' && c.mana && e.turno.ativo === p.j)   // "pague {X} ou não ataca você" (Champions of Minas Tirith): paga se tem quem atacar
        return (c.mana.g || 0) + (p.ctx.x || 0) <= 4 && e.campo.some(id => { const x = o(id); return x.ctrl === p.j && !x.virada && M.temTipo(e, x, 'Creature'); }) ? k : 0;
      if (c.mana) return e.turno.ativo !== p.j || (c.mana.g || 0) + (p.ctx.x || 0) <= 1 ? k : 0;
      if (c.vida) return J.vida - c.vida > 10 ? k : 0;
      if (c.sacrificar === 'este' && p.ctx.op === 'perderVida') return J.vida <= 3 ? k : 0;   // Withercrown: 1 de vida vale menos que a criatura
      return meu ? k : 0;
    }
    // custo para atacar/bloquear (Ghostly Prison, Archangel of Tithes): já escolheu atacar/bloquear, paga. Só não paga
    // o de atacar quando a mana é a de uma mágica da mão que ainda cabe na principal 2 e deixaria de caber (ataque
    // letal paga sempre). Bloquear: é no turno do outro, a mana sobraria.
    case 'custoCombate': {
      const pg = p.ops.findIndex(op => op.a === 'pagar'), np = p.ops.findIndex(op => op.a === 'naoPagar');
      if (pg < 0 || np < 0 || !p.ctx || p.ctx.tipo !== 'atacar') return Math.max(0, pg);
      const dano = (p.ctx.ids || []).reduce((s, id) => s + Math.max(0, e.objs[id] ? M.poder(e, o(id)) : 0), 0);
      if (M.vivos(e).some(x => x !== p.j && e.jogs[x].vida <= dano)) return pg;
      const mata = J.zonas.mao.some(id => { const d = M.dadoDe(e, o(id)); return !terra(id) && d.custo && M.planoMana(e, p.j, d.custo) && !M.planoMana(e, p.j, M.somaCusto(d.custo, p.ctx.custo)); });
      return mata ? np : pg;
    }
    case 'atacar': return atacarBasico(e, p);
    case 'bloquear': return bloquearBasico(e, p);
    case 'ordemDano': {               // o mais caro leva o letal primeiro
      let b = 0, bv = -1;
      p.ops.forEach((op, i) => { const v = M.dadoDe(e, o(op.id)).vm || 0; if (v > bv) { bv = v; b = i; } });
      return b;
    }
    case 'cmdZona': return 0;
    case 'masmorra': return melhorOp(p.ops, op => taxaCaminho(e, p.j, op.nome, 0));             // 701.49a
    case 'sala': return melhorOp(p.ops, op => taxaCaminho(e, p.j, p.ctx.nome, op.i));           // 701.49b
    case 'evitarPerda': return evitarPerda(e, p);
    case 'proliferar': {              // o que é meu e não tem −1/−1; do oponente, veneno ou −1/−1
      const k = p.ops.findIndex(op => op.a === 'proliferar' && (op.jog !== undefined ? op.jog !== p.j
        : (o(op.id).ctrl === p.j) === !((o(op.id).marc['-1/-1'] || 0) > 0)));
      return k >= 0 ? k : 0;
    }
    case 'escolha': {
      if (p.ops.some(op => op.a === 'tipoCarta')) {   // "choose a card type": redução (Cloud Key) → o tipo mais comum nas suas mágicas; proteção (Serra's Emissary) → o mais comum nos oponentes
        const F = p.ctx && o(p.ctx.id), red = !!F && (M.dadoDe(e, F).est || []).some(s => s.modo === 'reduzCusto');
        return melhorOp(p.ops, op => Object.values<any>(e.objs).reduce((s, x) => s + (!x.hab && (red ? x.dono === p.j && x.zona !== 'campo' : x.dono !== p.j) && M.temTipo(e, x, op.v) ? (x.zona === 'campo' ? 2 : 1) : 0), 0));
      }
      if (p.ops.some(op => op.a === 'tipo')) return melhorOp(p.ops, op => Object.values<any>(e.objs).reduce((s, x) => s + (x.dono === p.j && !x.hab && M.temTipo(e, x, 'Creature') && (M.dadoDe(e, x).sub || []).includes(op.v) ? (x.zona === 'campo' ? 2 : 1) : 0), 0));
      const k = p.ops.findIndex(op => op.a === 'cor' && J.ci.includes(op.v)); return k >= 0 ? k : 0;
    }
    default: return 0;
  }
};
// a decisão só lê o estado: lê em lote (contagens das estáticas valem para a pergunta inteira)
M.agenteBasico = () => (e, p) => M.lote(() => basico(e, p));

// ---- descarte (filtrar a mão) ----
// valor de descartar a carta (menor = melhor descartar): loucura que dá para pagar depois (−3), terreno que sobra (−2),
// o resto pelo valor de mana. Terreno sobra quando a mão já tem o da jogada deste turno e o campo tem 5 ou mais.
function valorDescarte(e, j, id) {
  const o = e.objs[id], d = M.dadoDe(e, o);
  if (M.loucuraDe(e, o)) return -3;
  if (M.temTipo(e, o, 'Land')) {
    const J = e.jogs[j], naMao = J.zonas.mao.filter(x => M.temTipo(e, e.objs[x], 'Land')).length;
    const noCampo = e.campo.filter(x => e.objs[x].ctrl === j && M.temTipo(e, e.objs[x], 'Land')).length;
    const precisa = J.terrenos < M.terrenosPorTurno(e, j) ? 1 : 0;
    return naMao > precisa && noCampo >= 5 ? -2 : naMao > precisa + 1 ? -1 : naMao > precisa ? 1 : 3;   // 3: é a jogada do turno
  }
  return d.vm || 0;
}
// tem permanente com gatilho de descarte seu (Ivora, Glint-Horn, Brallin, Marauding Mako…)?
function gatilhoDescarte(e, j) {
  return e.campo.some(id => { const x = e.objs[id]; return x.ctrl === j && M.gatDe(e, x).some(g => g.ev === 'descarta' && (g.jog || 'qualquer') !== 'oponente' && M.gatOk(g)); });
}
function querDescartar(e, j) {
  const mao = e.jogs[j].zonas.mao; if (!mao.length) return false;
  const melhor = Math.min(...mao.map(id => valorDescarte(e, j, id)));
  return melhor < 0 || (gatilhoDescarte(e, j) && melhor <= 1);
}
// índice da opção de descarte; −1 = deixa para a regra antiga (descarte obrigatório sem carta boa de descartar)
function escolheDescarte(e, p) {
  const ops = p.ops.map((op, i) => [op, i]).filter(([op]) => op.a === 'descartar');
  const nenhum = p.ops.findIndex(op => op.a === 'nenhum');
  if (!ops.length) return Math.max(0, nenhum);
  let b = -1, bv = Infinity;
  for (const [op, i] of ops) { const v = valorDescarte(e, p.j, op.id); if (v < bv) { bv = v; b = i; } }
  if (nenhum >= 0) return bv < 0 || (gatilhoDescarte(e, p.j) && bv <= 1) ? b : nenhum;   // "quantas quiser": só as que ganham
  return bv < 0 ? b : -1;
}

// ataque: no oponente com menos vida, com quem não morre de graça num bloqueio (sem troca) e tem poder > 0
function atacarBasico(e, p) {
  const a = p.j, vit = M.vivos(e).filter(j => j !== a && p.ops.some(op => op.jog === j)).sort((x, y) => e.jogs[x].vida - e.jogs[y].vida)[0];
  const pronto = p.ops.findIndex(op => op.a === 'pronto');
  if (vit === undefined) return Math.max(0, pronto);
  const bloqs = e.campo.map(id => e.objs[id]).filter(b => M.podeBloquear(e, b, vit));
  const seguro = id => {
    const at = e.objs[id], pa = M.poder(e, at), ra = M.resistencia(e, at);
    if (pa <= 0) return false;
    return !bloqs.some(b => M.bloqueiaEste(e, b, at) && M.poder(e, b) >= ra && !(pa >= M.resistencia(e, b) || M.temKw(e, at, 'toqueMortifero')));
  };
  const meus = p.ops.filter(op => op.a === 'atacar' && op.jog === vit);
  const bons = meus.filter(op => seguro(op.id));
  const todos = p.ops.findIndex(op => op.a === 'todos' && op.jog === vit);
  if (todos >= 0 && bons.length && bons.length === meus.length) return todos;
  // ataque em massa: cada bloqueador para um atacante (o mais forte); se o que passa mata, vão todos. Sem isso, mesa
  // empatada em P/R (Coat of Arms dos dois lados) travava e o Krenko dobrava as fichas até a partida não acabar
  // (fuzz semente 1022: 67 mil Goblins no turno 48).
  if (todos >= 0 && meus.length > bloqs.length) {
    const pw = meus.map(op => Math.max(0, M.poder(e, e.objs[op.id]))).sort((x, y) => x - y);
    let passa = 0; for (let i = 0; i < pw.length - bloqs.length; i++) passa += pw[i];
    if (passa >= e.jogs[vit].vida) return todos;
  }
  if (bons.length) return p.ops.indexOf(bons[0]);
  if (pronto >= 0) return pronto;
  return Math.max(0, p.ops.findIndex(op => op.a === 'atacar'));                  // tem que atacar (508.1d)
}
// bloqueio: bloqueia quando o bloqueador sobrevive ou troca por algo que vale mais; bloqueia "de sacrifício" quando
// o dano que passa mata
function bloquearBasico(e, p) {
  const d = p.ctx.def ?? p.j, o = id => e.objs[id], vm = x => M.dadoDe(e, x).vm || 0;
  const ja = new Set(p.ctx.bl.map(x => x[1]));
  const pronto = p.ops.findIndex(op => op.a === 'pronto');
  if (d !== p.j) {                                                                // quem escolhe é o atacante (Brutal Hordechief): o pior bloqueio para o defensor
    if (pronto >= 0) return pronto;
    let k = -1, kv = -Infinity;
    p.ops.forEach((op, i) => {
      if (op.a !== 'bloquear') return;
      const b = o(op.id), at = o(op.atk), pa = M.poder(e, at), pb = M.poder(e, b);
      const mata = pa >= M.resistencia(e, b) || (M.temKw(e, at, 'toqueMortifero') && pa > 0), troca = pb >= M.resistencia(e, at) || (M.temKw(e, b, 'toqueMortifero') && pb > 0);
      const v = (mata ? 3 + vm(b) / 10 : 0) - (troca ? 4 + vm(at) / 10 : 0) - (p.ctx.devem.includes(op.id) ? 0 : 10);
      if (v > kv) { kv = v; k = i; }
    });
    return k >= 0 ? k : Math.max(0, p.ops.findIndex(op => op.a === 'desfazer'));
  }
  if (pronto < 0 && (p.ctx.devem || []).length) {                                // bloqueio obrigatório (509.1c)
    const k = p.ops.findIndex(op => op.a === 'bloquear' && p.ctx.devem.includes(op.id));
    if (k >= 0) return k;
  }
  if (pronto < 0) {                                                               // ameaça com um só: põe outro ou desfaz
    const k = p.ops.findIndex(op => op.a === 'bloquear' && p.ctx.bl.some(x => x[1] === op.atk));
    return k >= 0 ? k : Math.max(0, p.ops.findIndex(op => op.a === 'desfazer'));
  }
  let melhor = -1, mv = 0;
  p.ops.forEach((op, i) => {
    if (op.a !== 'bloquear' || ja.has(op.atk)) return;
    const b = o(op.id), at = o(op.atk);
    if (M.temKw(e, at, 'ameaca')) return;
    const pa = M.poder(e, at), mata = pa >= M.resistencia(e, b) || (M.temKw(e, at, 'toqueMortifero') && pa > 0);
    const troca = M.poder(e, b) >= M.resistencia(e, at) || (M.temKw(e, b, 'toqueMortifero') && M.poder(e, b) > 0);
    const v = !mata ? 3 + (troca ? 2 : 0) : troca && vm(at) >= vm(b) ? 1 + (vm(at) - vm(b)) / 10 : 0;
    if (v > mv) { mv = v; melhor = i; }
  });
  if (melhor >= 0) return melhor;
  const passa = p.ctx.atacantes.filter(id => !ja.has(id)).reduce((s, id) => s + Math.max(0, M.poder(e, o(id))), 0);
  if (passa >= e.jogs[d].vida) {                                                  // vai morrer: para o maior
    let k = -1, kv = -1;
    p.ops.forEach((op, i) => { if (op.a === 'bloquear' && !ja.has(op.atk) && !M.temKw(e, o(op.atk), 'ameaca') && M.poder(e, o(op.atk)) > kv) { kv = M.poder(e, o(op.atk)); k = i; } });
    if (k >= 0) return k;
  }
  return pronto;
}

// ---- masmorras (CR 309, 701.49): qual masmorra e qual seta ----
// Critério: valor por aventura. Cada sala vale o que o efeito dela rende agora para quem aventura (compra 1,5 por carta;
// ficha de criatura (P+R)/2 e Tesouro 1; vidência 0,25 por carta; perda de vida dos oponentes 0,35 por ponto e por
// oponente; a própria, 0,2 por ponto, 1 se a vida está baixa; +1/+1 só vale com criatura sua no campo; −4/−0,
// "não ataca" e incitar só com criatura de oponente; descarte −0,7; sacrifício −0,3 de ficha, −1,5 do resto). Um
// caminho = da sala até a última; a taxa dele = (soma das salas + bônus de completar) ÷ número de salas, porque cada
// sala custa uma aventura. A sala escolhida é a que começa o caminho de maior taxa; a masmorra, a de maior taxa desde
// a 1ª sala. Bônus de completar: 2 + 1 por carta sua (qualquer zona) que lê completouMasmorra/completaMasmorra (até 6),
// +3 para a masmorra que uma delas nomeia (Acererak: Tomb of Annihilation). Sem bônus a Dungeon of the Mad Mage ganha
// (mais compra); com bônus o caminho curto da Tomb (Oubliette) sobe — ela completa em 3 aventuras.
const melhorOp = (ops, v) => { let b = 0, bv = -Infinity; ops.forEach((op, i) => { const x = v(op); if (x > bv) { bv = x; b = i; } }); return b; };
const temCriatura = (e, j, dele) => e.campo.some(id => { const o = e.objs[id]; return (dele ? o.ctrl === j : o.ctrl !== j) && M.temTipo(e, o, 'Creature') && (dele || M.poder(e, o) > 0); });
function valorFx(e, j, f) {
  const J = e.jogs[j], q = typeof f.qtd === 'number' ? f.qtd : 1, nOp = M.vivos(e).filter(x => x !== j).length;
  const meuPonto = J.vida <= 10 ? 1 : 0.2;
  switch (f.op) {
    case 'comprar': return 1.5 * q;
    case '_comprarLembra': return 1.5 * q + 2;                       // e conjura uma de graça
    case 'ficha': { const t = f.token || {}; return q * (t.nome === 'Treasure' ? 1 : t.pt ? (t.pt[0] + t.pt[1]) / 2 + 0.5 * (t.kw || []).length : 0.5); }
    case 'videncia': return 0.25 * q;
    case 'vigiar': return 0.25 * q;
    case 'explorar': return 0.7;
    case 'bis': return 1.5 * Math.max(1, nOp);
    case 'ganharVida': return (J.vida <= 15 ? 0.3 : 0.15) * q;
    case 'perderVida': return f.quem === 'cadaOponente' ? 0.35 * q * nOp : f.quem === 'cadaJogador' ? 0.35 * q * nOp - meuPonto * q : 0.5 * q;
    case 'marcador': return f.em && f.em.alvo !== undefined ? (temCriatura(e, j, true) ? 0.8 * q : 0) : 0;
    case '_ateSeuTurno': return (f.p || 0) < 0 ? (temCriatura(e, j, false) ? 0.7 : 0) : 0;
    case 'efeitoTemporario': return temCriatura(e, j, false) ? 0.6 : 0;
    case 'buscar': return 0.8;
    case 'cavar': return f.para === 'campo' ? 4 : 0.8 * (f.olha || 1);
    case 'descartar': return J.zonas.mao.length ? -0.7 : 0;
    case 'sacrificar': { const l = e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && M.bate(e, o, { ...(f.f || {}), zona: 'campo' }, { voce: j })); return !l.length ? 0 : l.some(o => o.ficha) ? -0.3 : -1.5; }
    case '_perdeAMenosQue': return 0.4 * nOp - 0.5;
  }
  return 0;
}
const valorSala = (e, j, nome, i) => M.MASMORRAS[nome].salas[i].fx.reduce((s, f) => s + valorFx(e, j, f), 0);
// bônus de completar: cartas de j (qualquer zona) que leem completouMasmorra/completaMasmorra; o nome que elas citam
const PAGA = new Map<string, { sim: boolean; nomes: string[] }>();
function pagaCompletar(e, j) {
  let n = 0; const nomes = new Set<string>();
  for (const id in e.objs) {
    const o = e.objs[id]; if (o.dono !== j || o.hab || o.ficha) continue;
    let p = PAGA.get(o.n);
    if (!p) { const t = JSON.stringify(M.carta(o.n)); p = { sim: /completouMasmorra|completaMasmorra/.test(t), nomes: [...t.matchAll(/"completouMasmorra":\{"nome":"([^"]+)"/g)].map(m => m[1]) }; PAGA.set(o.n, p); }
    if (p.sim) { n++; p.nomes.forEach(x => nomes.add(x)); }
  }
  return { geral: n ? Math.min(6, 2 + n) : 0, nomes };
}
function taxaCaminho(e, j, nome, i) {
  const P = pagaCompletar(e, j), bonus = P.geral + (P.nomes.has(nome) ? 3 : 0), S = M.MASMORRAS[nome].salas;
  let melhor = -Infinity;
  const anda = (k, soma, n) => { const s = soma + valorSala(e, j, nome, k); if (!S[k].vai.length) { melhor = Math.max(melhor, (s + bonus) / (n + 1)); return; } for (const x of S[k].vai) anda(x, s, n + 1); };
  anda(i, 0, 0);
  return melhor;
}
// alvo de sala: +1/+1 na sua criatura de maior poder; −4/−0, "não ataca" e incitar na do oponente de maior poder
function alvoSala(e, p) {
  const A = e.jogs[p.j].masm; if (!A) return -1;
  const fx = M.MASMORRAS[A.nome].salas[A.sala].fx, bom = fx.some(f => f.op === 'marcador');
  let b = -1, bv = -Infinity;
  p.ops.forEach((op, i) => {
    if (op.o === undefined) return;
    const o = e.objs[op.o], meu = o.ctrl === p.j, v = (bom === meu ? 100 : 0) + M.poder(e, o);
    if (v > bv) { bv = v; b = i; }
  });
  return b;
}
// "perde N a menos que descarte/sacrifique" (Veils of Fear, Sandfall Cell): paga com o que sobra (terreno de sobra,
// ficha); com a vida baixa paga com o mais barato; senão perde a vida
function evitarPerda(e, p) {
  const J = e.jogs[p.j], baixa = J.vida - p.ctx.q <= 6;
  let b = 0, bv = baixa ? Infinity : 0.5;
  p.ops.forEach((op, i) => {
    if (op.a === 'perder') return;
    const o = e.objs[op.id];
    const v = op.a === 'descartar' ? valorDescarte(e, p.j, op.id) : o.ficha ? 0 : M.temTipo(e, o, 'Land') ? 2 : 3 + (M.dadoDe(e, o).vm || 0);
    if (v < bv) { bv = v; b = i; }
  });
  return b;
}

// lista no formato Moxfield/Arena: "Commander\n1 X\n\nDeck\n1 Y..."
M.lerLista = texto => {
  const d = { comandante: [] as any[], cartas: [] as any[] };
  let sec = 'cartas';
  for (const l of texto.split('\n').map(s => s.trim())) {
    if (!l) continue;
    if (/^commander$/i.test(l)) { sec = 'comandante'; continue; }
    if (/^(deck|mainboard|sideboard)$/i.test(l)) { sec = 'cartas'; continue; }
    const m = l.match(/^(\d+)x?\s+(.+?)(\s+\([A-Z0-9]+\).*)?$/);
    if (!m) continue;
    for (let i = 0; i < +m[1]; i++) d[sec].push(m[2]);
  }
  return d;
};
