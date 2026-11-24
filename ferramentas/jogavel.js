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
let ok = 0, err = 0, perg = 0, tipos = {}, ms = 0, vit = 0;
for (let g = 0; g < N; g++) {
  const seed = seed0 * 1000 + g, R = ctx.rngDe(seed + 7), esc = []; let r = null;
  try {
    for (let volta = 0; volta < 3000 && !r; volta++) {
      const t0 = Date.now();
      try { r = ctx.arena(ordem, seed, { log: true, T: 20, humano: { k: 0, esc } }); }
      catch (e) { if (!e.raioxPergunta) throw e; const q = e.raioxPergunta; tipos[q.tipo] = (tipos[q.tipo] || 0) + 1; perg++; esc.push(responde(q, R)); }
      ms += Date.now() - t0;
    }
    if (!r) throw new Error('não terminou'); ok++; if (r.venc === 0) vit++;
  } catch (e) { err++; if (err < 3) console.log(e.stack); }
}
console.log(`${ok}/${N} partidas até o fim, erros ${err}, vitórias do humano ${vit}, perguntas ${perg} (${JSON.stringify(tipos)}), média ${(ms / Math.max(1, perg)).toFixed(1)} ms por pergunta`);
