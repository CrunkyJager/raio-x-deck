// ferramentas/partida-deck.mjs — joga partidas do motor novo (src/motor) com UM deck de lista (planejamento/decks/*.txt)
// contra 3 decks de exemplo, no node, e conta no registro as mecânicas pedidas. Serve para a regra "carta no banco ≠
// carta funcionando": mostra a mecânica acontecendo numa partida de verdade, não só no caso de teste.
// Cartas: banco próprio (banco/cartas) + cartas-rx.js como reserva para os oponentes (sem ele, só o banco).
// Uso: node ferramentas/partida-deck.mjs planejamento/decks/ivora.txt [--comandante "Ivora, Insatiable Heir"]
//        [--basico Mountain] [--partidas 20] [--semente 1] [--procura "recapitular,cicla,Blood"] [--log]
import { createServer } from 'vite';
import fs from 'node:fs';
import vm from 'node:vm';
const arg = process.argv.slice(2);
const opt = (k, d) => { const i = arg.indexOf('--' + k); return i >= 0 ? arg[i + 1] : d; };
const arquivo = arg.find(a => !a.startsWith('--') && a.endsWith('.txt'));
if (!arquivo) { console.error('uso: node ferramentas/partida-deck.mjs planejamento/decks/<deck>.txt [--comandante X] [--basico Mountain] [--partidas N] [--semente S] [--procura a,b] [--log]'); process.exit(1); }
const N = +opt('partidas', 20), S0 = +opt('semente', 1), basico = opt('basico', 'Mountain');
const procura = opt('procura', '').split(',').map(s => s.trim()).filter(Boolean);
const srv = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { M } = await srv.ssrLoadModule('/src/motor/index.ts');
  const { bancoProprio, comReserva } = await srv.ssrLoadModule('/src/dados/cartas.ts');
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  let reserva = null;
  if (fs.existsSync('cartas-rx.js')) { vm.runInContext(fs.readFileSync('cartas-rx.js', 'utf8'), ctx); reserva = ctx.CARTAS_RX; }
  vm.runInContext(fs.readFileSync('exemplos.js', 'utf8'), ctx);
  M.usarCartas(reserva ? comReserva(reserva) : bancoProprio());
  const d = M.lerLista(fs.readFileSync(arquivo, 'utf8'));
  const cmd = opt('comandante', d.comandante[0] || d.cartas[0]);
  d.comandante = [cmd]; d.cartas = d.cartas.filter(n => n !== cmd);
  while (d.comandante.length + d.cartas.length < 100) d.cartas.push(basico);
  const ops = Object.values(ctx.EXEMPLOS).slice(0, 3).map(t => M.lerLista(t));
  const conta = Object.fromEntries(procura.map(p => [p, 0])), exemplo = {}, fins = {};
  let erros = 0, venceu = 0;
  for (let s = S0; s < S0 + N; s++) {
    const e = M.novoJogo([d, ...ops], { semente: s, log: true });
    e.cfg.log = true;
    try { M.rodar(e, [0, 1, 2, 3].map(() => M.agenteBasico())); }
    catch (err) { erros++; console.log(`semente ${s}: ERRO ${err.message}`); if (arg.includes("--pilha")) console.log(String(err.stack).split("\n").slice(1, 7).join("\n") + "\n--- registro:\n" + e.log.slice(-12).join("\n")); continue; }
    const f = e.fim || {}; fins[f.motivo || '?'] = (fins[f.motivo || '?'] || 0) + 1; if (f.vencedor === 0) venceu++;
    for (const l of e.log) for (const p of procura) if (l.includes(p)) { conta[p]++; exemplo[p] = exemplo[p] || `semente ${s} · ${l}`; }
    if (arg.includes('--log') && s === S0) console.log(e.log.join('\n'));
  }
  console.log(`${arquivo} (${cmd}) × 3 exemplos · ${N} partidas · erros ${erros} · venceu ${venceu} · fins ${JSON.stringify(fins)}`);
  for (const p of procura) console.log(`  "${p}": ${conta[p]} linhas${exemplo[p] ? ' — ex.: ' + exemplo[p] : ''}`);
} finally { await srv.close(); }
