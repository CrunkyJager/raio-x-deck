// ferramentas/mesa-nova.mjs — T22: joga uma partida da Mesa ao vivo com o motor novo (src/mesa/arena-nova.ts) no node,
// com os 4 decks de exemplo montados como a página monta (engine.js), e compara com o motor velho (motor/mesa.js).
// Uso: node ferramentas/mesa-nova.mjs [semente] [--log] [--humano]
import { createServer } from 'vite';
import fs from 'node:fs';
import vm from 'node:vm';
const arg = process.argv.slice(2), seed = +(arg.find(a => /^\d+$/.test(a)) || 7);
// motor velho e base da página como o ferramentas/partida.js carrega (scripts globais num contexto só)
const ctx = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const DB = ctx.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const IDX = {}; for (const k of Object.keys(DB.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
const achar = n => { const k = IDX[norm(n)]; if (!k) return null; const e = DB.cards[k]; const p = String(e[F.p] || '').split(' // ')[0]; return [k, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
const nomes = Object.keys(ctx.EXEMPLOS);
// os decks passam por JSON, como na mensagem para o Worker
const Ds = JSON.parse(JSON.stringify(nomes.map(n => ctx.monta(ctx.parseLista(ctx.EXEMPLOS[n]), achar, null))));
const mesa = { arena: (D, s, c) => ctx.arena(D, s, c) };
const srv = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { arenaNova, novaSessao } = await srv.ssrLoadModule('/src/mesa/arena-nova.ts');
  const cfg = { log: true, T: 20, vida: 40, nomes: ['Você', ...nomes.slice(1)] };
  let t = Date.now();
  const v = mesa.arena(Ds, seed, cfg); const tv = Date.now() - t; t = Date.now();
  const r = arenaNova(Ds, seed, cfg); const tn = Date.now() - t;
  const conta = R => { const c = {}; for (const l of R.log) c[l.tp] = (c[l.tp] || 0) + 1; return JSON.stringify(c); };
  console.log(`velho: venc ${cfg.nomes[v.venc]} rodada ${v.turno} · ${v.quadros.length} quadros · ${tv} ms · ${conta(v)}`);
  console.log(`novo:  venc ${cfg.nomes[r.venc]} rodada ${r.turno} (${r.fim}) · ${r.quadros.length} quadros · ${tn} ms · ${conta(r)}`);
  const sem = r.lacs.map((L, k) => L.filter((x, i) => x && x[0].startsWith('fora') && Ds[k].base.includes(i)).length);
  console.log('cartas pela reserva (fora do banco):', sem.join(' / '), '· com ⓘ de motivo:', r.lacs.map((L, k) => L.filter((x, i) => x && !x[0].startsWith('fora') && Ds[k].base.includes(i)).length).join(' / '));
  if (arg.includes('--log')) for (const l of r.log.slice(0, 160)) console.log(`R${l.t} [${l.tp}] ${l.txt}`);
  if (arg.includes('--humano')) {          // humano escolhe sempre a 1ª opção; confere que continuar = refazer do zero
    const S = novaSessao(Ds, seed, { ...cfg, humano: { k: 0, esc: [] } }); const esc = []; let q, nP = 0, t2 = Date.now();
    for (;;) { try { const fim = S.rodar(); console.log(`humano: fim, venc ${cfg.nomes[fim.venc]}, ${fim.quadros.length} quadros, ${JSON.stringify(fim.log)===JSON.stringify(fim.log)?"":""}${nP} perguntas, ${Date.now() - t2} ms`); break; } catch (x) { if (!x.raioxPergunta) throw x; q = x.raioxPergunta; nP++;
      const v = q.tipo === 'mulligan' ? 0 : q.tipo === 'lanca' ? (q.ops[0] ? q.ops[0].v : -1) : q.tipo === 'ataque' ? { alvo: q.alvos[0].v, at: q.ops.map(o => o.v) } : q.ops && q.ops[0] ? q.ops[0].v : 0;
      esc.push(v); S.continua(esc.slice(), q.nq); if (nP > 3000) { console.log('humano: perguntas demais'); break; } } }
    const S2 = novaSessao(Ds, seed, { ...cfg, humano: { k: 0, esc } }); const f2 = S2.rodar();
    console.log('refeito do zero com as mesmas respostas:', f2.quadros.length, 'quadros, venc', cfg.nomes[f2.venc]);
  }
} finally { await srv.close(); }
