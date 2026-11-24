// motor2/agentes.js — agentes simples que respondem às perguntas do núcleo (a IA de verdade é a T21).
(function (M) {
  'use strict';
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
      case 'acao': {
        const k = p.ops.findIndex(op => op.a === 'terreno' && !(M.dadoDe(e, o(op.id)).subst || []).length);
        if (k >= 0) return k;
        const k2 = p.ops.findIndex(op => op.a === 'terreno');
        return k2 >= 0 ? k2 : 0;
      }
      case 'aMenosQue': return p.ops.length > 1 && J.vida > 10 ? 1 : 0;
      case 'cmdZona': return 0;
      default: return 0;
    }
  };

  // lista no formato Moxfield/Arena: "Commander\n1 X\n\nDeck\n1 Y..."
  M.lerLista = texto => {
    const d = { comandante: [], cartas: [] };
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
})(globalThis.MOTOR2 = globalThis.MOTOR2 || {});
