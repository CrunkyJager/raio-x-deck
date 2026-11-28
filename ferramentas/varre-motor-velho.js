// ferramentas/varre-motor-velho.js — passa cada carta do banco próprio (banco/cartas, as cartas dos 30 decks) pelo leitor do
// motor velho (motor/engine.js modelo()) e lista onde ele lê diferente do banco: palavras-chave, fichas (tipo/P-R/quantidade),
// "for each" (quantidade por contagem lida como número fixo), custo de virar N criaturas.
// Uso: node ferramentas/varre-motor-velho.js [família]   → linhas "família | carta | motor velho | banco"
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, '..');
const ctx = { console, window: {} }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-motor.js', 'exemplos.js', 'motor/engine.js', 'motor/mesa.js'])
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
const DB = ctx.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const rec = n => { const e = DB.cards[n]; if (!e) return null; const p = String(e[F.p] || '').split(' // ')[0]; return [n, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
const KW = { voar: 'flying', atropelar: 'trample', vigilancia: 'vigilance', vinculoVida: 'lifelink', pressa: 'haste', indestrutivel: 'indestructible',
  primeiroAtaque: 'first strike', ameaca: 'menace', toqueMortifero: 'deathtouch', resguardo: 'ward', alcance: 'reach', infectar: 'infect', golpeDuplo: 'double strike', defensor: 'defender', lampejo: 'flash' };
const so = process.argv[2];
const out = [];
const diz = (fam, n, velho, certo) => { if (!so || so === fam) out.push(`${fam} | ${n} | ${velho} | ${certo}`); };
const fxs = (o, acc = []) => { if (Array.isArray(o)) o.forEach(x => fxs(x, acc)); else if (o && typeof o === 'object') { if (o.op) acc.push(o); for (const k in o) fxs(o[k], acc); } return acc; };
const habs = m => [...(m.hab || []), ...(m.daHab || [])];
const fics = m => { const o = habs(m).map(h => h.e && h.e.fic).filter(Boolean); if (m.tok) o.push({ n: m.tokN, p: m.tokP, t: m.tokT, tipos: m.tokTipos || [], top: 1, por: m.tokPor }); if (m.tokR) o.push({ ...m.tokR, tipos: m.tokR.tipos || [], tokR: 1 }); return o; };
let n = 0;
for (const arq of fs.readdirSync(path.join(raiz, 'banco/cartas')).sort()) {
  const b = JSON.parse(fs.readFileSync(path.join(raiz, 'banco/cartas', arq), 'utf8'));
  const r = rec(b.n); if (!r) { diz('semDB', b.n, '-', '-'); continue; }
  let m; try { m = ctx.modelo(r); } catch (e) { diz('erro', b.n, e.message, '-'); continue; }
  if (m.land) continue; n++;
  const nome = arq.replace(/\.json$/, '');
  // 1. palavras-chave do próprio corpo (702)
  const kb = (b.kw || []).map(k => KW[k.k]).filter(Boolean), km = new Set(m.kws || []);
  if (m.has || m.haste) km.add('haste'); if (/\bflash\b/i.test(m.txt.split('\n')[0] || '')) km.add('flash');
  const falta = kb.filter(k => !km.has(k) && k !== 'flash');
  if (falta.length) diz('kw', nome, `kws=[${[...(m.kws || [])]}]`, `falta ${falta.join(', ')}`);
  // 2. fichas de criatura (111.4)
  const fb = fxs(b).filter(f => f.op === 'ficha' && f.token && (f.token.tipos || []).includes('Creature'));
  const fm = fics(m);
  for (const f of fm) {
    if (!f.tipos || !f.tipos.length) { const t = fb[0] && fb[0].token; diz('fichaTipo', nome, `ficha ${f.p}/${f.t} sem tipo`, t ? (t.sub || []).join(' ') || '(sem subtipo)' : '?'); }
  }
  if (fb.length && fm.length) for (const f of fm) {
    const t = fb.find(x => Array.isArray(x.token.pt) && x.token.pt[0] === f.p && x.token.pt[1] === f.t);
    if (!t && fb.every(x => Array.isArray(x.token.pt) && typeof x.token.pt[0] === 'number')) diz('fichaPT', nome, `${f.p}/${f.t}`, fb.map(x => x.token.pt.join('/')).join(' ou '));
    if (t && typeof f.n === 'number' && !f.por && t.qtd && typeof t.qtd === 'object' && t.qtd.conta) diz('porCada', nome, `ficha ×${f.n} fixo`, 'ficha × ' + JSON.stringify(t.qtd.conta.de).slice(0, 80));
  }
  // 3. "for each": quantidade por contagem que o motor lê como número fixo
  const MAP = { comprar: ['dr'], ganharVida: ['vida', 'lifeETB'], perderVida: ['dren'], dano: ['danoOp', 'danoAlvo', 'danoCri'], marcador: ['cont'] };
  for (const f of fxs(b)) {
    const ks = MAP[f.op]; if (!ks || !f.qtd || typeof f.qtd !== 'object' || !f.qtd.conta) continue;
    const vals = [];
    for (const h of habs(m)) for (const k of ks) if (h.e && h.e[k] != null) vals.push(k === 'cont' ? h.e[k].n : h.e[k]);
    for (const k of ks) if (m[k] != null && k !== 'cont') vals.push(k === 'dr' && (m.drPor || m.sham) ? String(m.drPor || 'cri') : m[k]);
    const fix = vals.filter(v => typeof v === 'number');
    if (fix.length && !vals.some(v => typeof v === 'string')) diz('porCada', nome, `${f.op} ${fix.join(',')} fixo`, `${f.op} × ` + JSON.stringify(f.qtd.conta.de).slice(0, 90));
  }
  // 4. mana por contagem
  for (const f of fxs(b)) if (f.op === 'mana' && f.qtd && typeof f.qtd === 'object' && f.qtd.conta && !m.manaX && m.mana) diz('porCada', nome, `mana ${m.mana} fixa`, 'mana × ' + JSON.stringify(f.qtd.conta.de).slice(0, 90));
  // 5. custo de virar N outras criaturas
  for (const a of b.atv || []) if (a.custo && a.custo.virarOutros) { const lido = habs(m).some(h => h.dez) || m.lido.size >= 0 && [...m.lido].some(fr => /^\{T\}, Tap|untapped/i.test(fr) && /Tap/.test(fr) && /untapped/.test(fr));
    diz('virarN', nome, lido ? 'lido' : 'não lido (lacuna)', `virar ${a.custo.virarOutros.qtd} ${JSON.stringify(a.custo.virarOutros.f.sub || a.custo.virarOutros.f.tipo || (a.custo.virarOutros.f.ficha ? 'fichas' : '*'))}`); }
}
console.log(out.join('\n'));
console.error(`${n} cartas não-terreno, ${out.length} linhas`);
