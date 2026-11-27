// ferramentas/motor-cobertura.mjs — o que o motor (src/motor) ainda não joga das cartas do banco próprio (banco/cartas).
// Pergunta ao próprio motor (M.fxSuportado, M.gatOk, M.custoSuportado, M.alvoSuportado, M.filtroOk) bloco a bloco; para
// achar o motivo, tira um campo de cada vez: o campo cuja falta faz o bloco passar é o que o motor não lê.
// Estáticas, palavras-chave e substituições: o motor lê por nome solto no código, então conta como lido o modo/kw
// que aparece entre aspas em src/motor (aproximação: aparecer não quer dizer que todo parâmetro é lido).
// Uso: node ferramentas/motor-cobertura.mjs [--cartas] [--json saida.json] [--por-carta src/mesa/motor-novo-cobertura.json]
//   sai a fila: cada motivo com quantas cartas do banco ele trava (e as cartas), do mais para o menos.
import { createServer } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.slice(2);
const srv = await createServer({ root: raiz, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { M } = await srv.ssrLoadModule('/src/motor/index.ts');
  const { bancoProprio } = await srv.ssrLoadModule('/src/dados/cartas.ts');
  const codigo = readdirSync(path.join(raiz, 'src/motor')).filter(f => f.endsWith('.ts')).map(f => readFileSync(path.join(raiz, 'src/motor', f), 'utf8')).join('\n');
  const citado = new Set([...codigo.matchAll(/'([a-zA-Z][a-zA-Z-]*)'/g)].map(m => m[1]));

  const motivos = new Map();          // motivo → Set(cartas)
  const anota = (m, n) => { if (!motivos.has(m)) motivos.set(m, new Set()); motivos.get(m).add(n); };
  const sem = (o, k) => { const c = { ...o }; delete c[k]; return c; };
  // por que o teste ok(o) falha? campo a campo; se nenhum sozinho resolve, o motivo é o próprio op/ev
  const porque = (o, ok, nome, rotulo) => {
    const achados = [];
    for (const k of Object.keys(o)) {
      if (k === 'op' || k === 'ev' || k.startsWith('_')) continue;
      if (ok(sem(o, k))) achados.push(k);
    }
    if (achados.length) return achados.map(k => `${rotulo}.${k}`);
    return [rotulo];
  };
  const fxMotivos = (fx, topo, n, onde) => {
    for (const f of fx || []) {
      if (M.fxSuportado([f], { topo })) continue;
      if (f.op === 'modal') { for (const m of f.modos || []) fxMotivos(m, false, n, onde); continue; }
      const rot = `op ${f.op}`;
      const ok = x => M.fxSuportado([{ op: f.op, ...x }], { topo });
      const ms = porque(f, ok, n, rot);
      for (const m of ms) anota(m, n);
    }
  };
  const BASE_CARTA = new Set(['v', 'n', 'id', 'oracleHash', 'vm', 'ci', 'cores', 'tipos', 'rev', 'custo', 'sub', 'pt', 'super', 'fx', 'alvos', 'gat', 'atv', 'kw', 'est', 'subst', 'falta', 'faces', 'forma', 'custoAd', 'leal', 'niveis']);
  const cartas = Object.values(bancoProprio());
  const travadas = new Set();
  for (const c of cartas) {
    const n = c.n, antes = [...motivos.values()].reduce((s, v) => s + (v.has(n) ? 1 : 0), 0);
    const ve = d => {
      for (const k of Object.keys(d)) if (!BASE_CARTA.has(k) && !(M.CARTA_OK && M.CARTA_OK.has(k))) anota(`carta.${k}`, n);
      fxMotivos(d.fx, true, n, 'fx');
      for (const a of d.alvos || []) if (!M.alvoSuportado(a)) anota(`alvo ${typeof a.f === 'string' ? a.f : Object.keys(a.f || {}).filter(k => !M.filtroOk({ [k]: 1 })).map(k => 'f.' + k).join(',') || Object.keys(a).filter(k => !['f', 'min', 'max'].includes(k)).join(',') || '?'}`, n);
      if (d.custoAd && !M.custoAdSuportado(d.custoAd)) for (const k of Object.keys(d.custoAd).filter(k => k !== 'ou')) if (!M.custoSuportado({ [k]: d.custoAd[k] })) anota(`custoAd.${k}`, n);
      for (const g of d.gat || []) {
        if (M.gatOk(g)) continue;
        const okSem = k => M.gatOk(sem(g, k));
        if (!M.gatOk({ ev: g.ev, fx: [] })) anota(`gat ev ${g.ev}`, n);
        else {
          let achou = false;
          for (const k of Object.keys(g)) if (k !== 'ev' && k !== 'fx' && okSem(k)) { anota(`gat.${k}`, n); achou = true; }
          if (!M.fxSuportado(g.fx)) { fxMotivos(g.fx, true, n, 'gat'); achou = true; }
          if (g.se && !achou) for (const k of Object.keys(g.se)) if (!M.gatOk({ ev: g.ev, fx: [], se: { [k]: g.se[k] } })) { anota(`gat.se.${k}`, n); achou = true; }
          if (!achou) anota(`gat ${g.ev} (vários campos)`, n);
        }
      }
      for (const a of d.atv || []) {
        if (a.se && !M.seOk(a.se)) anota('atv.se', n);
        if (a.reduz !== undefined && !M.qtdEstOk(a.reduz)) anota('atv.reduz', n);   // "costs {1} less to activate for each …" (mana.ts custoAtv)              // "ative só se …" que o motor não lê: não ativa
        if (a.deMana) { if (a.custo && !M.custoManaOk(a.custo) && !M.manaEscSuportada(a)) for (const k of Object.keys(a.custo)) if (!M.custoManaOk({ [k]: a.custo[k] })) anota(`custoMana.${k}`, n); continue; }   // mana.ts: o que a habilidade de mana sabe pagar
        if (a.custo && !M.custoSuportado(a.custo)) for (const k of Object.keys(a.custo)) if (!M.custoSuportado({ [k]: a.custo[k] })) anota(`custoAtv.${k}`, n);
        if (!M.fxSuportado(a.fx, { topo: false })) fxMotivos(a.fx, false, n, 'atv');
      }
      for (const s of d.est || []) {
        if (s.modo === 'continuo' && M.estContOk) {     // camadas (estado.ts): o motor diz o que lê
          if (M.estContOk(s)) { for (const x of s.kw || []) if (!citado.has(x.k)) anota(`kw dada ${x.k}`, n); if (s.habil) ve(s.habil); continue; }   // habil: a habilidade dada passa pelo mesmo teste
          const ms = porque(s, x => M.estContOk({ modo: 'continuo', ...x }), n, 'est continuo');
          const extra = Object.keys(s).filter(k => !['modo', 'afeta', 'p', 'r', 'kw', 'se'].includes(k) && !k.startsWith('_'));
          for (const m of ms) anota(m !== 'est continuo' ? m : s.afeta && typeof s.afeta !== 'object' && s.afeta !== 'este' ? `est continuo afeta ${s.afeta}` : extra.length ? `est continuo ${extra.join('+')}` : m, n);
        } else if (s.modo === 'reduzCusto' && M.estReduzOk) {   // mana.ts: o motor diz o que lê
          if (M.estReduzOk(s) || (M.estReduzMiraOk && M.estReduzMiraOk(s))) continue;   // aoMirar: pilha.ts (Professor Hojo)
          const q = s.qtd && typeof s.qtd === 'object' && !M.qtdEstOk(s.qtd) ? s.qtd : null;
          const det = q ? Object.keys(q).filter(k => !['conta', 'mult', 'soma'].includes(k)).concat(q.conta && typeof q.conta === 'object' ? Object.keys(q.conta).filter(k => !M.filtroOk({ [k]: 1 })) : []) : [];
          anota(`est reduzCusto${det.length ? ' qtd ' + det.join('+') : ''}`, n);
        } else if (s.modo === 'custoAlternativo' && M.estAltOk) {   // pilha.ts: o motor diz o que lê
          if (!M.estAltOk(s)) anota(`est custoAlternativo ${typeof s.afeta === 'object' ? 'afeta filtro' : Object.keys(s.pagar || {}).join('+') || '?'}`, n);
        } else if (!citado.has(s.modo)) anota(`est ${s.modo}`, n);
      }
      for (const x of d.kw || []) if (!citado.has(x.k)) anota(`kw ${x.k}`, n);
      for (const s of d.subst || []) { if (!M.substOk(s)) anota(`subst ${s.ev} ${[...Object.keys(s.muda || {}), ...(s.emVez || []).map(f => f.op + (f.o ? '/' + f.o : ''))].join('+')}`, n); }   // o motor diz o que aplica (efeitos.ts SUBST)
      for (const f of d.faces || []) ve(f);
      for (const l of d.niveis || []) ve(l);   // Classe: cada nível (n, custo, gat/est/atv)
    };
    ve(c);
    const depois = [...motivos.values()].reduce((s, v) => s + (v.has(n) ? 1 : 0), 0);
    if (depois > antes) travadas.add(n);
  }
  const fila = [...motivos].map(([m, s]) => ({ motivo: m, cartas: [...s].sort() })).sort((a, b) => b.cartas.length - a.cartas.length || a.motivo.localeCompare(b.motivo));
  // cartas que só têm UM motivo: consertar ele libera a carta inteira
  const porCarta = new Map();
  for (const { motivo, cartas: cs } of fila) for (const n of cs) porCarta.set(n, (porCarta.get(n) || []).concat(motivo));
  for (const it of fila) it.liberaSozinho = it.cartas.filter(n => porCarta.get(n).length === 1).length;
  console.log(`banco: ${cartas.length} cartas; o motor joga inteiras ${cartas.length - travadas.size}; travadas ${travadas.size}; ${fila.length} motivos`);
  console.log('cartas  só-ele  motivo');
  for (const it of fila) console.log(`${String(it.cartas.length).padStart(6)}  ${String(it.liberaSozinho).padStart(6)}  ${it.motivo}${arg.includes('--cartas') ? '  — ' + it.cartas.slice(0, 8).join('; ') + (it.cartas.length > 8 ? ' …' : '') : ''}`);
  // --por-carta f: {carta: [motivos]} só das travadas (a Mesa ao vivo com o motor novo mostra o selo ⓘ com isso)
  const pc = arg.indexOf('--por-carta');
  if (pc >= 0) { const o = {}; for (const [n, ms] of [...porCarta].sort((a, b) => a[0].localeCompare(b[0]))) o[n] = ms; writeFileSync(arg[pc + 1], JSON.stringify(o, null, 0).replace(/\],"/g, '],\n"') + '\n'); }
  const j = arg.indexOf('--json'); if (j >= 0) writeFileSync(arg[j + 1], JSON.stringify({ total: cartas.length, inteiras: cartas.length - travadas.size, fila }, null, 1));
} finally { await srv.close(); }
