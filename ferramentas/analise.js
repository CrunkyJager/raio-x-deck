// T09 (cópia do começo do jogavel.js): joga uma partida com o humano robô e roda a análise. Uso: node ferramentas/analise.js [Deck] [N] [semente]
// T08: testa o modo jogável fora do navegador. Um "humano robô" responde cada pergunta do motor
// (mulligan, terreno, lançar, ataque, bloqueio, descarte) e a partida tem que chegar ao fim sem erro.
// Uso: node ferramentas/jogavel.js [Deck] [partidas] [semente]
const fs = require('fs'), path = require('path'), vm = require('vm'), raiz = path.join(__dirname, '..');
const ctx = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
const DB = ctx.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const IDX = {}; for (const k of Object.keys(DB.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
const achar = n => { const k = IDX[norm(n)]; if (!k) return null; const e = DB.cards[k]; const p = String(e[F.p] || '').split(' // ')[0]; return [k, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
// MAIS="4 Fling" acrescenta cartas ao deck do humano (testar uma carta nova)
const decks = Object.entries(ctx.EXEMPLOS).map(([nome, lista]) => { if (process.env.MAIS && nome.startsWith(process.argv[2] || 'Stangg')) lista = process.env.MAIS.replace(/;/g, '\n') + '\n' + lista; const D = ctx.monta(ctx.parseLista(lista), achar, null); D.nome = nome; return D; });
const eu = decks.findIndex(d => d.nome.startsWith(process.argv[2] || 'Stangg')); const ordem = [decks[eu], ...decks.filter((_, j) => j !== eu)];
const N = +(process.argv[3] || 20), seed0 = +(process.argv[4] || 1);
// política simples e com sorteio, para passar por todos os caminhos
const responde = (q, R) => {
  const pega = () => q.ops[Math.floor(R() * q.ops.length)].v;
  switch (q.tipo) {
    case 'mulligan': return q.nm < 1 && R() < .3 ? 1 : 0;
    case 'fundo': case 'descarte': case 'terreno': case 'lanca': case 'bloqueio': case 'sacrificar': case 'equipar': case 'alvo': case 'escolha': return pega();
    case 'ataque': return { alvo: q.alvos[Math.floor(R() * q.alvos.length)].v, at: q.ops.filter(() => R() < .6).map(o => o.v) };
  }
  throw new Error('pergunta desconhecida ' + q.tipo);
};
const seed = seed0 * 1000, R = ctx.rngDe(seed + 7), esc = []; let r = null;
for (let volta = 0; volta < 3000 && !r; volta++) {
  try { r = ctx.arena(ordem, seed, { T: 20, humano: { k: 0, esc } }); }
  catch (e) { if (!e.raioxPergunta) throw e; esc.push(responde(e.raioxPergunta, R)); }
}
console.log(`partida: ${esc.length} respostas, vencedor ${r.venc}, turno ${r.turno}`);
const t0 = Date.now(); const A = ctx.analisa(ordem[0], ordem.slice(1), seed, esc, { N });
const ms = Date.now() - t0, cont = {};
for (const d of A.dec) cont[d.igual ? 'sem diferença' : d.classe] = (cont[d.classe] || 0) + 1;
console.log(`análise N=${N}: ${A.dec.length} escolhas com opção de ${A.total}, ${(ms / 1000).toFixed(1)} s, ${JSON.stringify(cont)}`);
for (const d of A.dec.filter(d => d.classe !== 'melhor').slice(0, 8)) console.log(`  T${d.t} ${d.tipo}${d.x ? " [" + d.x.n + "]" : ""}: você "${d.sua}" · melhor "${d.mel}" −${d.perda.toFixed(0)}% ±${d.se.toFixed(0)} → ${d.classe}\n      por quê: ${(d.porque||[]).join(' / ')}\n      princípio: ${d.principio||''}`);
