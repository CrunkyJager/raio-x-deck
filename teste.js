/* Teste em mesa: gera o relatório (mesas, diagnóstico, mãos, valor de cada carta, trocas) para o deck colado no Raio-X. */
(function () {
'use strict';
const S = window.SIM;
S.init(window.CARD_DB, window.FORGE_MODELS);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x, d = 1) => (100 * x).toFixed(d).replace('.', ',') + '%';
const fx = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
const pts = (x) => (x >= 0 ? '+' : '−') + Math.abs(100 * x).toFixed(1).replace('.', ',');
const TABS = ['tipica', 'agressiva', 'controle', 'combo'];
const TABN = { tipica: 'Mesa típica', agressiva: 'Mesa agressiva', controle: 'Mesa de controle', combo: 'Mesa com combo' };
const ARCHN = { aggro: 'Agressivo (fichas, bate cedo)', midrange: 'Midrange (bichos grandes)', control: 'Controle (remoção e wipe)', combo: 'Combo / valor' };
const RIGOR = { rapido: { n: 1000, nv: 400, ns: 500, n2: 'rápido' }, normal: { n: 4000, nv: 1000, ns: 1500, n2: 'normal' }, fundo: { n: 10000, nv: 2500, ns: 4000, n2: 'a fundo' } };
const BLANK = '(carta vazia)';

let RIG = 'normal', DECK = null, A = null, LOCK = new Set(), RES = {}, STOP = false, BUSY = false;
function setDeck(a) {
  A = a; if (!A || !A.cmds || !A.cmds.length) return; DECK = { cmd: A.cmds[0].name, cards: A.cards.map(c => c.name) }; RES = {}; LOCK = new Set();
  STOP = true; // interrompe um teste anterior
  setTimeout(async () => { while (BUSY) await new Promise(r => setTimeout(r, 100)); STOP = false; panel(); const keep = RIG; RIG = 'rapido'; await guard(runMain); RIG = keep; panel(); }, 50);
}
document.addEventListener('raiox:deck', (e) => setDeck(e.detail));
if (window.RAIOX && window.RAIOX.last) setTimeout(() => setDeck(window.RAIOX.last), 0);

const sleep0 = () => new Promise(r => setTimeout(r, 0));
async function batch(deck, opts, n, prog) {
  const out = []; let t0 = performance.now();
  for (let k = 0; k < n; k++) {
    if (STOP) throw new Error('parado');
    out.push(S.play(deck, Object.assign({}, opts, { seed: (opts.seed0 || 1) * 1000003 + k * 7919 })));
    if (performance.now() - t0 > 40) { if (prog) prog(k / n); await sleep0(); t0 = performance.now(); }
  }
  return out;
}
const win = (recs) => recs.filter(r => r.result === 'vence').length / recs.length;
// ruído da diferença entre duas listas nas mesmas partidas (pares)
function pairDiff(a, b) {
  const n = Math.min(a.length, b.length); let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const d = (b[i].result === 'vence') - (a[i].result === 'vence'); s += d; s2 += d * d; }
  const m = s / n; return { d: m, se: Math.sqrt(Math.max(0, s2 / n - m * m) / n) };
}
const swapDeck = (deck, out, inn) => ({ cmd: deck.cmd, cards: deck.cards.map(c => (c === out ? inn : c)) });

// ---------- painel ----------
function panel() {
  const box = $('#teste');
  const uniq = [...new Set(DECK.cards)].filter(n => !S.model(n).land);
  const combos = S.deckCombos(DECK);
  box.innerHTML = `
  <section class="panel">
    <h2>Teste em mesa simulada</h2>
    <p class="lead">O deck joga milhares de partidas de Commander contra 3 oponentes de 4 tipos (agressivo, midrange, controle e combo), 40 de vida, até o turno 14. Seu lado é jogado carta a carta; os oponentes são curvas de força com chance de remover, dar wipe e comboar. A régua: um deck médio do EDHREC ganha uns 25% na mesa típica.</p>
    <div class="row" style="gap:14px">
      <label class="field">Rigor <select id="t-rigor">${[['rapido', 'Rápido (1.000 partidas por mesa)'], ['normal', 'Normal (4.000)'], ['fundo', 'A fundo (10.000)']].map(([v, l]) => `<option value="${v}" ${RIG === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn primary" id="t-run" ${BUSY ? 'disabled' : ''}>Rodar teste</button>
      <button class="btn" id="t-val" ${BUSY ? 'disabled' : ''}>Medir valor de cada carta</button>
      <button class="btn" id="t-swap" ${BUSY ? 'disabled' : ''}>Testar trocas</button>
      <button class="btn" id="t-stop" ${BUSY ? '' : 'hidden'}>Parar</button>
    </div>
    <div class="prog" id="t-prog" hidden><div></div><span class="note" id="t-prog-l"></span></div>
    <details style="margin-top:10px"><summary>Cartas travadas (o teste mede, mas não sugere tirar) · ${LOCK.size}</summary>
      <p class="note">Clique para travar ou destravar.</p><div class="links">${uniq.map(n => `<button class="cn lock ${LOCK.has(n) ? 'on' : ''}" data-lock="${esc(n)}">${esc(n)}</button>`).join('')}</div></details>
    <details><summary>Candidatas para as trocas</summary><p class="note">Escolhidas sozinhas pelas funções que faltam e pela popularidade nas suas cores. Uma por linha; você pode editar.</p><textarea id="t-cands" rows="6" style="min-height:110px">${esc(candidates().join('\n'))}</textarea></details>
    ${combos.length ? `<p class="note" style="margin-top:8px">Combos de 2 cartas encontrados no deck (Commander Spellbook): ${combos.map(c => esc(c[0] + ' + ' + c[1])).join(' · ')}</p>` : ''}
  </section>
  <div id="t-out" class="tout">${renderSummary()}${RES.main ? renderMain() : ''}${RES.value ? renderValue() : ''}${RES.swap ? renderSwap() : ''}${RES.main ? renderModels() : ''}</div>`;
  $('#t-rigor').onchange = (e) => { RIG = e.target.value; };
  $('#t-run').onclick = () => guard(runMain);
  $('#t-val').onclick = () => guard(runValue);
  $('#t-swap').onclick = () => guard(runSwap);
  $('#t-stop').onclick = () => { STOP = true; };
  loadImgs($('#t-out'));
  $$('[data-lock]').forEach(b => b.onclick = () => { const n = b.dataset.lock; LOCK.has(n) ? LOCK.delete(n) : LOCK.add(n); b.classList.toggle('on'); b.closest('details').querySelector('summary').lastChild.textContent = ' · ' + LOCK.size; });
}
async function guard(fn) {
  if (BUSY || !DECK) return; BUSY = true; STOP = false; panel(); $('#t-prog').hidden = false;
  try { await fn(); } catch (e) { if (e.message !== 'parado') { console.error(e); alertBox('Algo falhou no teste: ' + e.message); } }
  BUSY = false; STOP = false; panel();
}
function alertBox(t) { const o = $('#t-out'); if (o) o.insertAdjacentHTML('afterbegin', `<div class="verdict v-bad">${esc(t)}</div>`); }
function progress(f, label) { const p = $('#t-prog'); if (!p) return; $('div', p).style.width = Math.round(100 * f) + '%'; $('#t-prog-l').textContent = label || ''; }
const rigor = () => RIGOR[RIG];

// ---------- candidatas ----------
function candidates() {
  if (window.RAIOX_CANDS && window.RAIOX_CANDS.length) return window.RAIOX_CANDS.slice();
  const DB = window.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
  const ident = new Set(DECK.cmd ? (DB.cards[DECK.cmd][F.ci] || '').split('') : []);
  const inDeck = new Set([DECK.cmd, ...DECK.cards]);
  const fams = [
    ['compra', (m, c) => m.engine && !m.creature],
    ['compra', (m, c) => (m.draw >= 3) && (m.instant || m.sorcery)],
    ['ramp', (m, c) => m.mana && !m.creature && c[F.v] <= 3],
    ['ramp', (m, c) => m.rampLands && c[F.v] <= 3],
    ['tutor', (m) => m.tutor],
    ['proteção', (m) => m.protect],
    ['remoção', (m, c) => m.removal >= 1 && c[F.v] <= 3],
    ['wipe', (m) => m.wipe],
  ];
  const all = Object.entries(DB.cards).filter(([n, c]) => !inDeck.has(n) && !c[F.ban] && c[F.r] && c[F.r] < 3000 && (c[F.ci] || '').split('').every(x => !x || ident.has(x)) && !/Land/.test(c[F.t].split(' // ')[0])).sort((a, b) => a[1][F.r] - b[1][F.r]);
  const out = [];
  for (const [fam, test] of fams) {
    let k = 0;
    for (const [n, c] of all) { if (k >= 2) break; if (out.includes(n)) continue; const m = S.model(n); if (!m.ok) continue; if (test(m, c)) { out.push(n); k++; } }
  }
  return out.slice(0, 14);
}

// ---------- teste principal ----------
async function runMain() {
  const R = rigor(); const n = R.n; const res = { n, tables: {}, fixed: {}, recs: null };
  const steps = TABS.length + 4 + 1; let step = 0;
  for (const t of TABS) {
    const recs = await batch(DECK, { table: t, seed0: 11 }, n, f => progress((step + f) / steps, `${TABN[t]}: partidas`));
    res.tables[t] = S.summarize(recs); res.tables[t].recs = t === 'tipica' ? recs : null; step++;
  }
  for (const k of ['aggro', 'midrange', 'control', 'combo']) {
    const recs = await batch(DECK, { table: 'tipica', fixed: k, seed0: 23 }, Math.round(n / 2), f => progress((step + f) / steps, `contra ${ARCHN[k]}`));
    res.fixed[k] = S.summarize(recs); step++;
  }
  progress(step / steps, 'régua dos arquétipos'); await sleep0();
  res.calib = S.calibrate(Math.min(3000, n));
  res.recs = res.tables.tipica.recs;
  RES = { main: res };
}

// ---------- valor de cada carta ----------
async function runValue() {
  if (!RES.main) await runMain();
  const R = rigor(); const n = R.nv;
  const uniq = [...new Set(DECK.cards)].filter(c => !S.model(c).land);
  const base = {}; for (const t of TABS) base[t] = await batch(DECK, { table: t, seed0: 37 }, n);
  const rows = []; let i = 0;
  for (const c of uniq) {
    const d = swapDeck(DECK, c, BLANK); const row = { name: c, by: {} };
    for (const t of TABS) { const recs = await batch(d, { table: t, seed0: 37 }, n, f => progress((i + (TABS.indexOf(t) + f) / 4) / uniq.length, `Valor de ${c}`)); const pd = pairDiff(recs, base[t]); row.by[t] = pd.d; row.se = Math.max(row.se || 0, pd.se); }
    row.v = TABS.reduce((s, t) => s + row.by[t], 0) / 4; rows.push(row); i++;
  }
  rows.sort((a, b) => b.v - a.v);
  RES.value = { n, rows };
}

// ---------- trocas ----------
async function runSwap() {
  if (!RES.value) await runValue();
  const R = rigor(); const n = R.ns;
  const cands = ($('#t-cands') ? $('#t-cands').value : candidates().join('\n')).split('\n').map(x => x.trim()).filter(Boolean).filter(x => window.CARD_DB.cards[x]);
  const weak = RES.value.rows.filter(r => !LOCK.has(r.name) && r.name !== DECK.cmd).slice(-8).reverse();
  const base = await batch(DECK, { table: 'tipica', seed0: 53 }, n);
  const grid = {}; let k = 0; const total = weak.length * cands.length;
  for (const w of weak) for (const c of cands) {
    const recs = await batch(swapDeck(DECK, w.name, c), { table: 'tipica', seed0: 53 }, n, f => progress((k + f) / (total + 30), `Trocas: ${w.name} → ${c}`));
    grid[w.name + '|' + c] = pairDiff(base, recs); k++;
  }
  // soma gulosa: cada troca só entra se a lista inteira melhorar nas 4 mesas (ou em 3 com folga)
  const pairs = Object.entries(grid).map(([key, v]) => ({ out: key.split('|')[0], inn: key.split('|')[1], d: v.d, se: v.se })).sort((a, b) => b.d - a.d);
  let cur = DECK; const used = new Set(), added = new Set(), accepted = [], tested = [];
  for (const p of pairs) {
    if (accepted.length >= 10 || p.d <= 0) break;
    if (used.has(p.out) || added.has(p.inn)) continue;
    const next = swapDeck(cur, p.out, p.inn); const by = {}; let good = 0, sum = 0, se = 0;
    for (const t of TABS) { const a = await batch(cur, { table: t, seed0: 71 }, n); const b = await batch(next, { table: t, seed0: 71 }, n); const pd = pairDiff(a, b); by[t] = pd.d; sum += pd.d; se = Math.max(se, pd.se); if (pd.d > 0) good++; progress((k + tested.length) / (total + 30), `Confirmando ${p.out} → ${p.inn}`); }
    const ok = (good === 4 || (good === 3 && sum / 4 > 3 * se)) && sum / 4 > 1.5 * se;
    tested.push({ ...p, by, mean: sum / 4, se, ok });
    if (ok) { accepted.push({ ...p, by, mean: sum / 4, se }); cur = next; used.add(p.out); added.add(p.inn); }
  }
  // confirmação final: lista atual x lista com as trocas, 3 sementes
  const final = {};
  for (const t of TABS) { const r0 = [], r1 = []; for (const sd of [101, 202, 303]) { r0.push(win(await batch(DECK, { table: t, seed0: sd }, n))); r1.push(win(await batch(cur, { table: t, seed0: sd }, n))); } final[t] = { a: r0, b: r1 }; }
  RES.swap = { n, weak: weak.map(w => w.name), cands, grid, accepted, tested, final, deck: cur };
}

// ---------- gráficos ----------
const COL = { vence: 'var(--good)', morre: 'var(--bad)', combo: 'var(--warn)', tarde: 'var(--ink-3)' };
function stacked(rows) {
  const W = 640, rowH = 34, H = rows.length * rowH + 30, L = 150;
  let g = '';
  rows.forEach((r, i) => {
    let x = L; const y = 6 + i * rowH;
    g += `<text x="${L - 8}" y="${y + 18}" fill="var(--ink-2)" font-size="14" text-anchor="end">${esc(r.label)}</text>`;
    for (const p of r.parts) { const w = (W - L - 10) * p.v; if (w > 0.5) { g += `<rect x="${x}" y="${y}" width="${w}" height="24" fill="${p.c}"/>`; if (w > 30) g += `<text x="${x + w / 2}" y="${y + 16}" fill="#14110d" font-size="11" font-weight="700" text-anchor="middle">${Math.round(100 * p.v)}</text>`; } x += w; }
  });
  const x25 = L + (W - L - 10) * 0.25; g += `<line x1="${x25}" x2="${x25}" y1="0" y2="${H - 24}" stroke="var(--ink)" stroke-dasharray="4 3"/><text x="${x25 + 4}" y="${H - 10}" fill="var(--ink-2)" font-size="11">25% = mesa justa</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Como as partidas terminam">${g}</svg><div class="legend"><span><i style="background:var(--good)"></i>vence</span><span><i style="background:var(--warn)"></i>perde para combo</span><span><i style="background:var(--ink-3)"></i>perde tarde (T14)</span><span><i style="background:var(--bad)"></i>morre</span></div>`;
}
function lines(series, labels, title) {
  const W = 640, H = 230, L = 40, R = 110, T = 14, B = 30;
  const maxY = Math.max(1, ...series.flatMap(s => s.v)) * 1.08;
  const x = (i) => L + (W - L - R) * i / (labels.length - 1); const y = (v) => T + (H - T - B) * (1 - v / maxY);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = maxY * k / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" fill="var(--ink-3)" font-size="12" text-anchor="end" font-family="JetBrains Mono, monospace">${Math.round(v)}</text>`; }
  labels.forEach((l, i) => { if (labels.length <= 14) g += `<text x="${x(i)}" y="${H - 10}" fill="var(--ink-3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">${l}</text>`; });
  for (const s of series) {
    g += `<polyline points="${s.v.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2.2}" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    const lv = s.v[s.v.length - 1]; g += `<text x="${W - R + 6}" y="${y(lv) + 4}" fill="${s.c}" font-size="13">${esc(s.n)}: ${Math.round(lv)}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || '')}">${g}</svg>`;
}
function hist(values, title) {
  const max = Math.min(80, Math.max(...values)); const bins = Array(Math.ceil(max / 2) + 1).fill(0); values.forEach(v => bins[Math.min(bins.length - 1, Math.floor(v / 2))]++);
  const W = 640, H = 200, L = 40, B = 28, T = 10; const bw = (W - L - 10) / bins.length; const mx = Math.max(...bins);
  let g = '';
  bins.forEach((b, i) => { const h = (H - T - B) * b / mx; g += `<rect x="${L + i * bw}" y="${H - B - h}" width="${Math.max(1, bw - 1)}" height="${h}" fill="var(--info)"/>`; if (i % 5 === 0) g += `<text x="${L + i * bw}" y="${H - 10}" fill="var(--ink-3)" font-size="11" font-family="JetBrains Mono, monospace">${i * 2}</text>`; });
  const sorted = values.slice().sort((a, b) => a - b); const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  for (const [p, l] of [[0.1, '10% piores'], [0.5, 'mediana'], [0.9, '10% melhores']]) { const v = q(p); const xx = L + (v / 2) * bw; g += `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-dasharray="4 3"/><text x="${xx + 4}" y="${T + 12}" fill="var(--ink)" font-size="11">${l}: ${v}</text>`; }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || '')}">${g}</svg>`;
}
function hbars(rows, key, noise) {
  const W = 640, rowH = 18, L = 230, H = rows.length * rowH + 30;
  const min = Math.min(0, ...rows.map(r => r[key])), max = Math.max(0, ...rows.map(r => r[key]));
  const sc = (v) => L + (W - L - 50) * (v - min) / Math.max(1e-9, max - min); const z = sc(0);
  let g = '';
  rows.forEach((r, i) => { const y = 4 + i * rowH; const v = r[key]; const x1 = Math.min(z, sc(v)), x2 = Math.max(z, sc(v)); g += `<text x="${L - 6}" y="${y + 12}" fill="${r.locked ? 'var(--info)' : 'var(--ink-2)'}" font-size="11" text-anchor="end">${esc(r.name.length > 34 ? r.name.slice(0, 33) + '…' : r.name)}</text><rect x="${x1}" y="${y + 2}" width="${Math.max(1, x2 - x1)}" height="12" fill="${v < 0 ? 'var(--bad)' : r.out ? 'var(--warn)' : r.locked ? 'var(--info)' : 'var(--good)'}"/><text x="${x2 + 4}" y="${y + 12}" fill="var(--ink-3)" font-size="10.5" font-family="JetBrains Mono, monospace">${pts(v)}</text>`; });
  if (noise) g = `<rect x="${sc(-noise)}" y="0" width="${sc(noise) - sc(-noise)}" height="${H - 22}" fill="var(--ink-3)" opacity=".18"/>` + g;
  g += `<line x1="${z}" x2="${z}" y1="0" y2="${H - 22}" stroke="var(--ink-2)"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Valor de cada carta">${g}</svg><div class="legend"><span><i style="background:var(--good)"></i>demais</span><span><i style="background:var(--info)"></i>travada por você</span><span><i style="background:var(--warn)"></i>sai nas trocas</span><span><i style="background:var(--bad)"></i>negativa</span><span><i style="background:var(--ink-3);opacity:.5"></i>faixa de sorteio</span></div>`;
}


// barras agrupadas (ex.: seu deck x genérico; lista atual x com trocas)
function groupBars(groups, series, opts = {}) {
  const W = 640, H = 250, L = 40, B = 44, T = 22;
  const maxY = Math.max(0.3, ...groups.flatMap(g => g.v)) * 1.15;
  const gw = (W - L - 10) / groups.length, bw = Math.min(46, (gw - 20) / series.length);
  const y = (v) => T + (H - T - B) * (1 - v / maxY);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = maxY * k / 4; g += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" fill="var(--ink-3)" font-size="12" text-anchor="end" font-family="JetBrains Mono, monospace">${Math.round(100 * v)}</text>`; }
  if (opts.ref != null) g += `<line x1="${L}" x2="${W - 10}" y1="${y(opts.ref)}" y2="${y(opts.ref)}" stroke="var(--crit)" stroke-dasharray="6 4"/><text x="${W - 12}" y="${y(opts.ref) - 5}" fill="var(--crit)" font-size="12" text-anchor="end">${Math.round(100 * opts.ref)}% = sorte</text>`;
  groups.forEach((gr, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2;
    gr.v.forEach((v, j) => { const x = x0 + j * bw; g += `<rect x="${x + 2}" y="${y(v)}" width="${bw - 4}" height="${H - B - y(v)}" rx="2" fill="${series[j].c}"/><text x="${x + bw / 2}" y="${y(v) - 5}" fill="${j === series.length - 1 ? 'var(--ink)' : 'var(--ink-2)'}" font-size="12" text-anchor="middle" font-family="JetBrains Mono, monospace">${Math.round(100 * v)}%</text>`; });
    g += `<text x="${L + i * gw + gw / 2}" y="${H - 18}" fill="var(--ink-2)" font-size="13" text-anchor="middle">${esc(gr.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || '')}">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`;
}
// barra dentro da célula de tabela
const cellBar = (v, max, c) => `<span class="cbar"><span style="width:${Math.max(0, Math.min(100, 100 * v / max)).toFixed(0)}%;background:${c || 'var(--good)'}"></span></span>`;
// pontos: ganho de cada troca em cada mesa
function dotPlot(rows) {
  const W = 640, rowH = 34, L = 240, H = rows.length * rowH + 40;
  const vals = rows.flatMap(r => TABS.map(t => r.by[t])); const min = Math.min(-0.005, ...vals), max = Math.max(0.01, ...vals);
  const x = (v) => L + (W - L - 20) * (v - min) / (max - min);
  const shapes = { tipica: ['circle', 'var(--info)'], agressiva: ['rect', 'var(--accent)'], controle: ['tri', 'var(--good)'], combo: ['diam', 'var(--crit)'] };
  let g = `<line x1="${x(0)}" x2="${x(0)}" y1="0" y2="${H - 30}" stroke="var(--ink-2)"/>`;
  for (let k = Math.ceil(min * 100); k <= Math.floor(max * 100); k++) g += `<text x="${x(k / 100)}" y="${H - 10}" fill="var(--ink-3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">${k}</text>`;
  rows.forEach((r, i) => {
    const yy = 14 + i * rowH; g += `<text x="${L - 8}" y="${yy + 4}" fill="var(--ink-2)" font-size="12" text-anchor="end">${esc(r.label.length > 36 ? r.label.slice(0, 35) + '…' : r.label)}</text><line x1="${L}" x2="${W - 20}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>`;
    for (const t of TABS) { const [sh, c] = shapes[t]; const cx = x(r.by[t]);
      g += sh === 'circle' ? `<circle cx="${cx}" cy="${yy}" r="5" fill="${c}"/>` : sh === 'rect' ? `<rect x="${cx - 5}" y="${yy - 5}" width="10" height="10" fill="${c}"/>` : sh === 'tri' ? `<polygon points="${cx},${yy - 6} ${cx + 6},${yy + 5} ${cx - 6},${yy + 5}" fill="${c}"/>` : `<polygon points="${cx},${yy - 6} ${cx + 6},${yy} ${cx},${yy + 6} ${cx - 6},${yy}" fill="${c}"/>`; }
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pontos de vitória a mais por mesa">${g}</svg><div class="legend">${TABS.map(t => `<span><i style="background:${shapes[t][1]}"></i>${TABN[t]}</span>`).join('')}</div>`;
}
// cartão SAI / ENTRA com imagem
function cardBox(name, tag) {
  const C = window.RAIOX && window.RAIOX.C ? window.RAIOX.C(name) : null;
  const m = S.model(name);
  return `<div class="cbox"><span class="ctag ${tag === 'SAI' ? 'out' : 'in'}">${tag}</span><div class="cimg" data-img="${esc(name)}"><span class="note">carregando…</span></div>
    <div><b>${esc(name)}</b>${C && C.usd ? ` <span class="note">US$ ${C.usd.toFixed(2).replace('.', ',')}</span>` : ''}<div class="note">${esc(C ? C.t : '')}</div><div class="note" style="margin-top:4px">Modelo: ${esc(m.desc.join('; '))}</div></div></div>`;
}
function loadImgs(root) {
  if (!window.RAIOX || !window.RAIOX.imgFor) return;
  $$('[data-img]', root).forEach(el => { window.RAIOX.imgFor(el.dataset.img).then(src => { el.innerHTML = src ? `<img src="${src}" alt="${esc(el.dataset.img)}">` : `<span class="note">sem imagem</span>`; }); });
}
// resposta curta
function renderSummary() {
  const r = RES.main; if (!r) return '';
  const T = r.tables; const worstT = TABS.slice(1).sort((a, b) => T[a].win - T[b].win)[0], bestT = TABS.slice(1).sort((a, b) => T[b].win - T[a].win)[0];
  const tiles = [[pct(T.tipica.win), 'vence na mesa típica', T.tipica.win >= 0.25 ? 'good' : 'warn'], [pct(T[worstT].win), 'pior mesa: ' + TABN[worstT].replace('Mesa ', ''), 'bad'], [pct(T[bestT].win), 'melhor mesa: ' + TABN[bestT].replace('Mesa ', ''), 'good'], [pct(T.tipica.stuckT7), 'parado no turno 7', 'warn'], [fx(T.tipica.cmdDeaths, 2), 'mortes do comandante por partida', 'info']];
  const sw = RES.swap && RES.swap.accepted.length ? `<h3>Trocas sugeridas</h3><ol class="sw">${RES.swap.accepted.map(a => `<li><b>${esc(a.out)}</b> → <b>${esc(a.inn)}</b> <span class="note">${pts(a.mean)} ponto na média das 4 mesas</span></li>`).join('')}</ol>${(() => { const f = RES.swap.final.tipica; const m = (x) => x.reduce((p, q) => p + q, 0) / x.length; return `<p>Com as trocas, a mesa típica vai de <b>${pct(m(f.a))}</b> para <b>${pct(m(f.b))}</b>.</p>`; })()}` : RES.swap ? '<p>Nenhuma troca passou no critério com as candidatas testadas.</p>' : '';
  const val = RES.value ? `<p class="note">Cartas que mais seguram o deck: ${RES.value.rows.slice(0, 3).map(x => esc(x.name)).join(', ')}. Mais fracas: ${RES.value.rows.slice(-3).reverse().map(x => esc(x.name)).join(', ')}.</p>` : '';
  return `<section class="panel answer"><h2>Resposta curta</h2>
    <div class="tiles">${tiles.map(([v, l, c]) => `<div class="tile ${c}"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div>
    <p>Na mesa típica o deck vence <b>${pct(T.tipica.win)}</b>; o justo numa mesa de 4 é 25%. ${T[worstT].win < 0.2 ? `O ponto fraco é a ${TABN[worstT].toLowerCase()}: morre em ${pct(T[worstT].die, 0)} das partidas.` : ''} ${T[bestT].win > 0.3 ? `Brilha na ${TABN[bestT].toLowerCase()} (${pct(T[bestT].win)}).` : ''}</p>${sw}${val}
    <p class="note">${!RES.value ? 'Próximo passo: “Medir valor de cada carta”. ' : !RES.swap ? 'Próximo passo: “Testar trocas”. ' : ''}${DECK.cmd}: ${DECK.cards.length + 1} cartas.</p></section>`;
}

// ---------- relatório ----------
function renderMain() {
  const r = RES.main; const T = r.tables; const recs = r.recs; const N = recs.length;
  const tRows = TABS.map(t => `<tr><td>${TABN[t]}</td><td class="n"><b>${pct(T[t].win)}</b></td><td class="n">${pct(T[t].die)}</td><td class="n">${pct(T[t].combo)}</td><td class="n">${pct(T[t].late)}</td><td class="n">${fx(T[t].winTurn)}</td><td class="n">${fx(T[t].powerT8)}</td><td class="n">${pct(T[t].stuckT7)}</td><td class="n">${fx(T[t].cmdDeaths, 2)}</td><td class="n">±${fx(100 * T[t].se)}</td></tr>`).join('');
  const bars = stacked(TABS.map(t => ({ label: TABN[t], parts: [{ v: T[t].win, c: COL.vence }, { v: T[t].combo, c: COL.combo }, { v: T[t].late, c: COL.tarde }, { v: T[t].die, c: COL.morre }] })));
  const verdict = T.tipica.win >= 0.3 ? 'roda bem acima de um deck genérico' : T.tipica.win >= 0.24 ? 'roda na média de um deck genérico' : 'roda abaixo de um deck genérico';
  const worstT = TABS.slice(1).sort((a, b) => T[a].win - T[b].win)[0], bestT = TABS.slice(1).sort((a, b) => T[b].win - T[a].win)[0];
  // contra cada tipo
  const fx1 = Object.entries(r.fixed).map(([k, s]) => `<tr><td>${ARCHN[k]}</td><td class="n">${pct(s.win)}</td><td class="n">${pct(s.die)}</td><td class="n">${pct(r.calib[k])}</td></tr>`).join('');
  // curvas por resultado
  const avgBy = (f) => { const g = recs.filter(f); return g.length ? Array.from({ length: 14 }, (_, i) => g.reduce((s, x) => s + x.power[i], 0) / g.length) : Array(14).fill(0); };
  const curve = lines([{ n: 'venceu', c: 'var(--good)', v: avgBy(x => x.result === 'vence') }, { n: 'morreu', c: 'var(--bad)', v: avgBy(x => x.result === 'morre') }, { n: 'combo', c: 'var(--warn)', v: avgBy(x => x.result === 'combo') }, { n: 'todas', c: 'var(--ink)', v: avgBy(() => true), dash: true, w: 1.6 }], Array.from({ length: 14 }, (_, i) => i + 1), 'Força em campo por turno');
  // splits
  const split = (label, f) => { const g = recs.filter(f); return g.length < N * 0.005 ? '' : `<tr><td>${label}</td><td class="n">${pct(g.length / N)}</td><td class="n">${pct(win(g))} ${cellBar(win(g), 0.6)}</td><td class="n">${pct(g.filter(x => x.result === 'morre').length / g.length)} ${cellBar(g.filter(x => x.result === 'morre').length / g.length, 1, 'var(--bad)')}</td></tr>`; };
  const splits = [
    split('Parado no T7 (menos de 8 de força)', x => x.power[6] < 8), split('Não parado no T7', x => x.power[6] >= 8),
    split('2 ou + cartas impagáveis no T6', x => x.uncastT6 >= 2), split('Sem travar no T6', x => x.uncastT6 < 2),
    split('Mão inicial sem carta de custo 7+', x => x.openBig === 0), split('1 carta de custo 7+', x => x.openBig === 1), split('2 ou + cartas de custo 7+', x => x.openBig >= 2),
    split('2 terrenos na mão inicial', x => x.openLands === 2), split('3 terrenos', x => x.openLands === 3), split('4 terrenos', x => x.openLands === 4), split('5 ou mais terrenos', x => x.openLands >= 5),
    split('Nenhum wipe na mesa', x => x.wipes === 0), split('1 wipe', x => x.wipes === 1), split('2 ou mais wipes', x => x.wipes >= 2),
    split('Comandante nunca morreu', x => x.cmdDeaths === 0), split('Comandante morreu 1 vez', x => x.cmdDeaths === 1), split('Comandante morreu 2 ou + vezes', x => x.cmdDeaths >= 2),
    split('Venceu com combo próprio', x => x.how === 'combo'),
  ].join('');
  // distribuição
  const pT8 = recs.map(x => Math.round(x.power[7]));
  const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  const perTurn = (key) => [0.1, 0.5, 0.9].map(p => Array.from({ length: 8 }, (_, i) => q(recs.map(x => x[key][i]), p)));
  const [pw10, pw50, pw90] = perTurn('power'), [mn10, mn50, mn90] = perTurn('manaT');
  // piores x melhores
  const byP = recs.slice().sort((a, b) => a.power[7] - b.power[7]); const k10 = Math.max(1, Math.floor(N / 10));
  const worst = byP.slice(0, k10), best = byP.slice(-k10);
  const av = (g, f) => g.reduce((s, x) => s + f(x), 0) / g.length;
  const cmp = [['Terrenos na mão inicial', x => x.openLands], ['Fontes de mana na mão inicial', x => x.openSources], ['Cartas de custo 7+ na mão inicial', x => x.openBig], ['Terrenos no turno 6', x => x.landsT6 || 0], ['Mana disponível no turno 6', x => x.manaT6 || 0], ['Pedras de mana em campo no turno 6', x => x.rocksT6 || 0], ['Turno em que o comandante desce', x => x.cmdTurn || 15], ['Cartas que não dá para pagar no turno 6', x => x.uncastT6 || 0], ['Cartas vistas até o turno 8', x => x.seenT8 || 0], ['Força em campo no turno 7', x => x.power[6]]]
    .map(([l, f]) => { const a = av(worst, f), b = av(best, f); return `<tr><td>${l}</td><td class="n">${fx(a, 2)}</td><td class="n">${fx(b, 2)}</td><td class="n">${(b - a >= 0 ? '+' : '') + fx(b - a, 2)}</td></tr>`; }).join('');
  // tabelas de mão
  const handTable = (title, f, cats) => `<h3>${title}</h3><div class="tw"><table><thead><tr><th></th><th>Partidas</th><th>% das mãos</th><th>Força T8: 10% / mediana / 90%</th><th>Comandante até T6</th><th>Parado</th><th>Vence</th></tr></thead><tbody>${cats.map(([l, t]) => { const g = recs.filter(x => t(f(x))); if (!g.length) return ''; const p = g.map(x => x.power[7]); return `<tr><td>${l}</td><td class="n">${g.length.toLocaleString('pt-BR')}</td><td class="n">${pct(g.length / N)}</td><td class="n">${Math.round(q(p, 0.1))} / ${Math.round(q(p, 0.5))} / ${Math.round(q(p, 0.9))}</td><td class="n">${pct(g.filter(x => x.cmdTurn && x.cmdTurn <= 6).length / g.length)}</td><td class="n">${pct(g.filter(x => x.power[6] < 8).length / g.length)} ${cellBar(g.filter(x => x.power[6] < 8).length / g.length, 1, 'var(--warn)')}</td><td class="n">${pct(win(g))} ${cellBar(win(g), 0.6)}</td></tr>`; }).join('')}</tbody></table></div>`;
  const cross = (() => {
    const rowsL = [['2 ou menos terrenos', x => x <= 2], ['3 terrenos', x => x === 3], ['4 terrenos', x => x === 4], ['5 ou mais', x => x >= 5]];
    const colsS = [['0 fontes', x => x === 0], ['1 fonte', x => x === 1], ['2 fontes', x => x === 2], ['3+ fontes', x => x >= 3]];
    return `<h3>Cruzamento terrenos × fontes: % de partidas paradas</h3><div class="tw"><table class="heat"><thead><tr><th>Terrenos \\ Fontes</th>${colsS.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rowsL.map(([l, fl]) => `<tr><td>${l}</td>${colsS.map(([, fs]) => { const g = recs.filter(x => fl(x.openLands) && fs(x.openSources)); if (g.length < 40) return `<td class="note">poucas (${g.length})</td>`; const st = g.filter(x => x.power[6] < 8).length / g.length; return `<td style="background:rgba(224,122,79,${Math.min(0.85, st * 1.8).toFixed(2)})"><b>${pct(st, 0)}</b> parado<br><span class="note">med. ${Math.round(q(g.map(x => x.power[7]), 0.5))}, ${pct(g.length / N)} das mãos</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  })();
  const ex = (g) => g.slice(0, 8).map(x => `<tr><td>${x.opening.map(n => /Land/.test((window.CARD_DB.cards[n] || [])[2] || '') ? 'Terra' : esc(n)).join(', ')}</td><td class="n">${x.cmdTurn || 'não'}</td><td class="n">${Math.round(x.power[7])}</td><td class="n">${x.landsT6 || 0}</td><td class="n">${x.uncastT6 || 0}</td><td>${(x.handT6 || []).map(esc).join(', ')}</td></tr>`).join('');
  const exHead = '<thead><tr><th>Mão inicial</th><th>Comandante</th><th>Força T8</th><th>Terrenos T6</th><th>Impag. T6</th><th>Na mão no turno 6</th></tr></thead>';
  const stuck = recs.filter(x => x.power[6] < 8), notStuck = recs.filter(x => x.power[6] >= 8);
  return `
  <section class="panel"><h2>Está rodando bem na mesa?</h2>
    <p>Na mesa típica o deck vence <b>${pct(T.tipica.win)}</b> das partidas: ${verdict} (justo numa mesa de 4 = 25%). O pior cenário é a <b>${TABN[worstT].toLowerCase()}</b> (${pct(T[worstT].win)}); o melhor, a <b>${TABN[bestT].toLowerCase()}</b> (${pct(T[bestT].win)}).</p>
    ${bars}
    <div class="tw"><table><thead><tr><th>Mesa</th><th>Vence</th><th>Morre</th><th>Combo</th><th>Perde tarde</th><th>Turno da vitória</th><th>Força T8</th><th>Parado no T7</th><th>Mortes do comandante</th><th>Ruído</th></tr></thead><tbody>${tRows}</tbody></table></div>
    <p class="note">${r.n.toLocaleString('pt-BR')} partidas por mesa. Típica = 3 oponentes sorteados entre os 4 tipos; agressiva = 2 agressivos + 1 midrange; controle = 2 controles + 1 midrange; combo = combo + controle + midrange. Ruído = 1 erro-padrão.</p>
  </section>
  <div class="grid2">
    <section class="panel"><h2>Contra cada tipo de deck</h2><p class="lead">1 oponente fixo do tipo e 2 sorteados. A última coluna é o que um deck genérico daquele tipo faz no seu lugar (a régua).</p>
      ${groupBars(Object.keys(r.fixed).map(k => ({ label: ARCHN[k].split(' (')[0], v: [r.calib[k], r.fixed[k].win] })), [{ n: 'deck genérico do tipo no seu lugar', c: 'var(--ink-3)' }, { n: 'seu deck', c: 'var(--accent)' }], { ref: 0.25, title: 'Seu deck contra cada tipo' })}
      <div class="tw"><table><thead><tr><th>Oponente fixo</th><th>Vence</th><th>Morre</th><th>Genérico desse tipo vence</th></tr></thead><tbody>${fx1}</tbody></table></div></section>
    <section class="panel"><h2>Como a força cresce</h2><p class="lead">Força média em campo por turno, separando as partidas pelo resultado.</p>${curve}</section>
  </div>
  <section class="panel"><h2>Por que ganha e por que perde</h2><p class="lead">Mesa típica, ${N.toLocaleString('pt-BR')} partidas. Cada linha separa as partidas por uma característica.</p>
    <div class="tw"><table><thead><tr><th>O que aconteceu</th><th>% das partidas</th><th>Vence</th><th>Morre</th></tr></thead><tbody>${splits}</tbody></table></div>
    <p style="margin-top:10px">Parado no T7 em <b>${pct(stuck.length / N)}</b> das partidas: nessas vence ${pct(stuck.length ? win(stuck) : 0)}; quando não está parado, vence ${pct(notStuck.length ? win(notStuck) : 0)}.</p></section>
  <section class="panel"><h2>O 8 ou 80 em números</h2><p class="lead">Distribuição da força em campo no turno 8, e força e mana por turno nos 10% piores, na mediana e nos 10% melhores.</p>
    ${hist(pT8, 'Força em campo no turno 8')}
    <div class="grid2"><div><h3>Força em campo por turno</h3>${lines([{ n: '10% piores', c: 'var(--info)', v: pw10 }, { n: 'mediana', c: 'var(--accent)', v: pw50 }, { n: '10% melhores', c: 'var(--good)', v: pw90 }], [1, 2, 3, 4, 5, 6, 7, 8], 'Força por turno')}</div>
    <div><h3>Mana disponível por turno</h3>${lines([{ n: '10% piores', c: 'var(--info)', v: mn10 }, { n: 'mediana', c: 'var(--accent)', v: mn50 }, { n: '10% melhores', c: 'var(--good)', v: mn90 }], [1, 2, 3, 4, 5, 6, 7, 8], 'Mana por turno')}</div></div></section>
  <section class="panel"><h2>O que separa partida ruim de partida boa</h2><p class="lead">Médias dos 10% piores e dos 10% melhores jogos (pela força no turno 8).</p>
    <div class="tw"><table><thead><tr><th></th><th>10% piores</th><th>10% melhores</th><th>Diferença</th></tr></thead><tbody>${cmp}</tbody></table></div></section>
  <section class="panel"><h2>Tabelas de mão</h2><p class="lead">Mão inicial que ficou depois do mulligan (1 mulligan se tiver menos de 2 ou mais de 5 terrenos).</p>
    ${handTable('Terrenos na mão inicial', x => x.openLands, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], ['6 ou mais', 6]].map(([l, v]) => [typeof l === 'number' ? l + ' terrenos' : l, x => (v === 6 ? x >= 6 : x === v)]))}
    ${handTable('Fontes de mana na mão (pedras, criaturas de mana, ramp)', x => x.openSources, [['0 fontes', x => x === 0], ['1 fonte', x => x === 1], ['2 fontes', x => x === 2], ['3+ fontes', x => x >= 3]])}
    ${handTable('Cartas de custo 7 ou mais na mão', x => x.openBig, [['0 caras', x => x === 0], ['1 cara', x => x === 1], ['2 caras', x => x === 2], ['3+ caras', x => x >= 3]])}
    ${cross}</section>
  <section class="panel"><h2>Mãos de exemplo</h2><p class="lead">8 das piores e 8 das melhores partidas sorteadas.</p>
    <h3>Ruins</h3><div class="tw"><table>${exHead}<tbody>${ex(worst)}</tbody></table></div>
    <h3>Boas</h3><div class="tw"><table>${exHead}<tbody>${ex(best.slice().reverse())}</tbody></table></div></section>`;
}
function renderValue() {
  const v = RES.value; const outs = new Set(RES.swap ? RES.swap.accepted.map(a => a.out) : []); const rows = v.rows.map(r => Object.assign({}, r, { locked: LOCK.has(r.name), out: outs.has(r.name) }));
  const tbl = (list) => `<div class="tw"><table><thead><tr><th>Carta</th><th>Vale</th><th>Típ.</th><th>Agr.</th><th>Ctrl</th><th>Combo</th></tr></thead><tbody>${list.map(r => `<tr><td>${esc(r.name)}${r.locked ? ' <span class="note">(travada)</span>' : ''}</td><td class="n"><b>${pts(r.v)}</b></td>${TABS.map(t => `<td class="n">${pts(r.by[t])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const noise = Math.max(...rows.map(r => r.se || 0));
  return `<section class="panel"><h2>Quanto cada carta vale</h2><p class="lead">Cada carta trocada por uma carta vazia: quantas vitórias a lista perde sem ela (média das 4 mesas, ${v.n.toLocaleString('pt-BR')} partidas por mesa, as mesmas partidas sorteadas para as duas listas). Positivo = a carta ajuda; perto de zero = quase não muda a partida. Ruído de cada medida: até ±${fx(100 * noise)} ponto.</p>
    ${hbars(rows, 'v', noise)}
    <div class="grid2"><div><h3>As que mais seguram o deck</h3>${tbl(rows.slice(0, 12))}</div><div><h3>As mais fracas</h3>${tbl(rows.slice(-12).reverse())}</div></div></section>`;
}
function renderSwap() {
  const s = RES.swap;
  const maxAbs = Math.max(0.005, ...Object.values(s.grid).map(x => Math.abs(x.d)));
  const heat = `<div class="tw"><table class="heat"><thead><tr><th></th>${s.cands.map(c => `<th class="rot"><span>${esc(c)}</span></th>`).join('')}</tr></thead><tbody>${s.weak.map(w => `<tr><td>sai ${esc(w)}</td>${s.cands.map(c => { const g = s.grid[w + '|' + c]; if (!g) return '<td></td>'; const a = Math.min(1, Math.abs(g.d) / maxAbs); return `<td class="n" style="background:${g.d >= 0 ? `rgba(127,200,142,${(a * 0.85).toFixed(2)})` : `rgba(224,122,79,${(a * 0.85).toFixed(2)})`};${a > 0.6 ? 'color:#14110d;font-weight:700' : ''}">${fx(100 * g.d)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><div class="legend"><span><i style="background:rgba(224,122,79,.85)"></i>piora</span><span><i style="background:var(--felt-3)"></i>igual</span><span><i style="background:rgba(127,200,142,.85)"></i>melhora</span><span class="note">coluna inteira verde = a carta entra bem em qualquer lugar</span></div>`;
  const acc = s.accepted.length ? `<div class="tw"><table><thead><tr><th>Sai</th><th>Entra</th><th>Típ.</th><th>Agr.</th><th>Ctrl</th><th>Combo</th><th>Média</th></tr></thead><tbody>${s.accepted.map(a => `<tr><td>${esc(a.out)}</td><td><b>${esc(a.inn)}</b></td>${TABS.map(t => `<td class="n">${pts(a.by[t])}</td>`).join('')}<td class="n"><b>${pts(a.mean)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p>Nenhuma troca passou no critério. A lista já está no ponto para este conjunto de candidatas.</p>';
  const rej = s.tested.filter(t => !t.ok).map(t => `${esc(t.out)} → ${esc(t.inn)}`);
  const fin = TABS.map(t => { const a = s.final[t].a, b = s.final[t].b; const m = (x) => x.reduce((p, q) => p + q, 0) / x.length; const sd = (x) => Math.sqrt(x.reduce((p, q) => p + (q - m(x)) ** 2, 0) / Math.max(1, x.length - 1)); return `<tr><td>${TABN[t]}</td><td class="n">${pct(m(a))} <span class="note">±${fx(100 * sd(a))}</span></td><td class="n"><b>${pct(m(b))}</b> <span class="note">±${fx(100 * sd(b))}</span></td><td class="n">${pts(m(b) - m(a))}</td></tr>`; }).join('');
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length;
  const finalBars = groupBars(TABS.map(t => ({ label: TABN[t].replace('Mesa ', ''), v: [m(s.final[t].a), m(s.final[t].b)] })), [{ n: 'lista atual', c: 'var(--ink-3)' }, { n: 'com as trocas', c: 'var(--good)' }], { ref: 0.25, title: 'Lista atual x com as trocas' });
  const dots = s.accepted.length ? dotPlot(s.accepted.map(a => ({ label: a.out + ' → ' + a.inn, by: a.by }))) : '';
  const cards = s.accepted.map((a, i) => `<div class="swapcard"><h3>Troca ${i + 1}: ${esc(a.out)} → ${esc(a.inn)}</h3><div class="pair">${cardBox(a.out, 'SAI')}${cardBox(a.inn, 'ENTRA')}</div><p class="note">Por quê: sem ${esc(a.out)} a lista perde ${pts(-(RES.value.rows.find(r => r.name === a.out) || { v: 0 }).v)} ponto (valor medido). Com ${esc(a.inn)} no lugar, o ganho médio nas 4 mesas é ${pts(a.mean)} (típica ${pts(a.by.tipica)}, agressiva ${pts(a.by.agressiva)}, controle ${pts(a.by.controle)}, combo ${pts(a.by.combo)}).</p></div>`).join('');
  return `<section class="panel"><h2>Trocas testadas</h2><p class="lead">As ${s.weak.length} cartas mais fracas (fora as travadas) contra ${s.cands.length} candidatas. Número = pontos de vitória a mais que a lista atual na mesa típica (${s.n.toLocaleString('pt-BR')} partidas, as mesmas para os dois lados).</p>${heat}</section>
  <section class="panel"><h2>As trocas que passaram</h2><p class="lead">Somadas uma por vez: cada nova só entrou se a lista inteira, já com as anteriores, melhorasse nas 4 mesas (ou em 3, com folga) e com ganho maior que 1,5 vez o ruído.</p>${acc}
    ${rej.length ? `<p class="note">Testadas e reprovadas: ${rej.join(' · ')}.</p>` : ''}
    <h3>Confirmação nas 4 mesas (3 sementes)</h3>${finalBars}${dots}<div class="tw"><table><thead><tr><th>Mesa</th><th>Lista atual</th><th>Com as trocas</th><th>Diferença</th></tr></thead><tbody>${fin}</tbody></table></div></section>
  ${cards ? `<section class="panel"><h2>As trocas, carta por carta</h2>${cards}</section>` : ''}`;
}
function renderModels() {
  const uniq = [...new Set([DECK.cmd, ...DECK.cards])].filter(n => !S.model(n).land);
  const rows = uniq.map(n => { const m = S.model(n); return `<tr><td>${esc(n)}</td><td class="n">${S.total(m.cost)}</td><td>${esc((window.CARD_DB.cards[n] || [])[2] || '')}</td><td>${esc(m.desc.join('; '))}</td><td class="note">${m.src === 'forge' ? 'Forge' : m.ok ? 'texto' : '—'}</td></tr>`; }).join('');
  const nOk = uniq.filter(n => S.model(n).ok).length;
  return `<section class="panel"><h2>Como a simulação trata cada carta</h2><p class="lead">${nOk} de ${uniq.length} cartas têm efeito modelado. "Forge" = lido dos scripts de carta do Forge (GPL-3.0); "texto" = regra pelo texto da carta; "—" = só o corpo (custo e força).</p>
    <details><summary>Ver as ${uniq.length} cartas</summary><div class="tw"><table><thead><tr><th>Carta</th><th>Custo</th><th>Tipo</th><th>Modelo</th><th>Fonte</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <p class="note" style="margin-top:10px">Limites: os oponentes são tipos de deck, não decks reais; o motor não blefa nem negocia; cartas muito específicas ficam simplificadas. Os números servem para comparar versões do deck entre si, não como previsão exata da sua mesa.</p></section>`;
}
})();
