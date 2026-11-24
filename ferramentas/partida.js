// Joga partidas com os decks de exemplo no motor (o mesmo da Mesa simulada/ao vivo), fora do navegador.
// Uso, na pasta do projeto:  node ferramentas/partida.js Stangg            (uma partida com log, Stangg contra os outros 3)
//                            node ferramentas/partida.js Stangg 200        (200 partidas: taxa de vitória e erros)
//                            node ferramentas/partida.js Stangg 1 7        (semente 7)
const fs = require('fs'), path = require('path'), vm = require('vm'), raiz = path.join(__dirname, '..');
const ctx = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
const DB = ctx.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const IDX = {}; for (const k of Object.keys(DB.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
const achar = n => { const k = IDX[norm(n)]; if (!k) return null; const e = DB.cards[k]; const p = String(e[F.p] || '').split(' // ')[0]; return [k, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
const decks = Object.entries(ctx.EXEMPLOS).map(([nome, lista]) => { const D = ctx.monta(ctx.parseLista(lista), achar, null); D.nome = nome; return D; });
const eu = decks.findIndex(d => d.nome.startsWith(process.argv[2] || 'Stangg')); const ordem = [decks[eu], ...decks.filter((_, j) => j !== eu)];
const N = +(process.argv[3] || 1), seed = +(process.argv[4] || 1);
if (N === 1) {
  const r = ctx.arena(ordem, seed, { log: true, T: 20, nomes: ordem.map(d => d.nome.split(',')[0]) });
  for (const l of r.log) console.log(`T${l.t} [${ordem[l.k] ? ordem[l.k].nome.split(',')[0] : '-'}] ${l.txt}`);
  console.log('vencedor:', ordem[r.venc] ? ordem[r.venc].nome : '—', r.fim, 'turno', r.turno);
} else {
  const v = [0, 0, 0, 0]; let t = 0, err = 0; const t0 = Date.now();
  for (let g = 0; g < N; g++) { try { const r = ctx.arena(ordem, seed * 1000 + g, { T: 20 }); if (r.venc >= 0) v[r.venc]++; t += r.turno; } catch (e) { err++; if (err < 3) console.log(e.stack); } }
  console.log(ordem.map((d, k) => `${d.nome.split(',')[0]}: ${(100 * v[k] / N).toFixed(1)}%`).join(' | '), `| turno médio ${(t / N).toFixed(1)} | erros ${err} | ${Date.now() - t0} ms`);
}
