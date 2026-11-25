// src/motor/agentes.ts (T43: migrado de motor2/agentes.js) — agentes simples que respondem às perguntas do núcleo (a IA de verdade é a T21).
import { M } from './nucleo';

// aleatório (fuzz): sorteia com a semente do próprio estado
M.agenteAleatorio = () => (e, p) => Math.floor(M.aleat(e) * p.ops.length);

// básico: mantém mão com 2–5 terrenos, joga terreno (desvirado primeiro), não gasta mana à toa,
// descarta/põe no fundo a carta de maior valor de mana, comandante sempre volta ao comando
M.agenteBasico = () => (e, p) => {
  const J = e.jogs[p.j], o = id => e.objs[id];
  const terra = id => M.temTipo(e, o(id), 'Land');
  switch (p.tipo) {
    case 'mulligan': {
      const t = J.zonas.mao.filter(terra).length;
      return J.mulls < 2 && (t < 2 || t > 5) ? 1 : 0;
    }
    case 'fundo': case 'descartar': {
      let b = 0, bv = -1;
      p.ops.forEach((op, k) => { const v = terra(op.id) ? 0.5 : (M.dadoDe(e, o(op.id)).vm || 0); if (v > bv) { bv = v; b = k; } });
      return b;
    }
    case 'acao': {                    // terreno (desvirado primeiro) → a mágica mais cara → habilidade de {T}/lealdade → passa
      const k = p.ops.findIndex(op => op.a === 'terreno' && !(M.dadoDe(e, o(op.id)).subst || []).length);
      if (k >= 0) return k;
      const k2 = p.ops.findIndex(op => op.a === 'terreno');
      if (k2 >= 0) return k2;
      const meu = e.turno.ativo === p.j;
      let b = -1, bv = -1;
      p.ops.forEach((op, i) => {
        if (op.a !== 'conjurar') return;
        const d = M.dadoDe(e, o(op.id)), inst = (d.tipos || []).includes('Instant');
        if (!meu && !inst) return;
        if (inst && !d.alvos && !meu) return;            // instantânea sem alvo: no próprio turno
        if ((d.vm || 0) > bv) { bv = d.vm || 0; b = i; }
      });
      if (b >= 0) return b;
      if (meu) {
        const k3 = p.ops.findIndex(op => op.a === 'ativar' && (() => { const a = M.dadoDe(e, o(op.id)).atv[op.k]; return a.lealdade !== undefined || a.custo.virar; })());
        if (k3 >= 0) return k3;
      }
      return 0;
    }
    case 'alvo': {                    // jogador: o oponente com menos vida; objeto: o mais caro de um oponente
      let b = 0, bv = -Infinity;
      p.ops.forEach((op, i) => {
        let v;
        if (op.a === 'pronto') v = -1;
        else if (op.jog !== undefined) v = op.jog === p.j ? -5 : 100 - e.jogs[op.jog].vida;
        else { const x = o(op.o); v = (x.ctrl === p.j ? -10 : 10) + (M.dadoDe(e, x).vm || 0); }
        if (v > bv) { bv = v; b = i; }
      });
      return b;
    }
    case 'buscar': return p.ops.length > 1 && p.ops[0].a === 'nenhum' ? 1 : 0;
    case 'sacrificar': case 'custo': {
      let b = 0, bv = Infinity;
      p.ops.forEach((op, i) => { const v = op.id ? (o(op.id).ficha ? -1 : (M.dadoDe(e, o(op.id)).vm || 0)) : 0; if (v < bv) { bv = v; b = i; } });
      return b;
    }
    case 'aMenosQue': return p.ops.length > 1 && J.vida > 10 ? 1 : 0;
    case 'atacar': return atacarBasico(e, p);
    case 'bloquear': return bloquearBasico(e, p);
    case 'ordemDano': {               // o mais caro leva o letal primeiro
      let b = 0, bv = -1;
      p.ops.forEach((op, i) => { const v = M.dadoDe(e, o(op.id)).vm || 0; if (v > bv) { bv = v; b = i; } });
      return b;
    }
    case 'cmdZona': return 0;
    case 'proliferar': {              // o que é meu e não tem −1/−1; do oponente, veneno ou −1/−1
      const k = p.ops.findIndex(op => op.a === 'proliferar' && (op.jog !== undefined ? op.jog !== p.j
        : (o(op.id).ctrl === p.j) === !((o(op.id).marc['-1/-1'] || 0) > 0)));
      return k >= 0 ? k : 0;
    }
    case 'escolha': { const k = p.ops.findIndex(op => op.a === 'cor' && J.ci.includes(op.v)); return k >= 0 ? k : 0; }
    default: return 0;
  }
};

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
  if (bons.length) return p.ops.indexOf(bons[0]);
  if (pronto >= 0) return pronto;
  return Math.max(0, p.ops.findIndex(op => op.a === 'atacar'));                  // tem que atacar (508.1d)
}
// bloqueio: bloqueia quando o bloqueador sobrevive ou troca por algo que vale mais; bloqueia "de sacrifício" quando
// o dano que passa mata
function bloquearBasico(e, p) {
  const d = p.j, o = id => e.objs[id], vm = x => M.dadoDe(e, x).vm || 0;
  const ja = new Set(p.ctx.bl.map(x => x[1]));
  const pronto = p.ops.findIndex(op => op.a === 'pronto');
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
