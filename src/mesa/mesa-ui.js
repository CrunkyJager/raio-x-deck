/* Mesa simulada e Mesa ao vivo do Raio-X.
   O motor de jogo é o do Grimório Arena (Edgar): motor/engine.js e motor/mesa.js, rodando num Worker.
   Aqui ficam só os dados (cartas e oponentes), a interface e a leitura dos resultados. */
// T43 (c): era o mesa-ui.js (script clássico dentro de uma função anônima); virou módulo ES, carregado pelo src/main.ts.
// Migração mecânica: só saiu o embrulho (o módulo já tem escopo próprio e modo estrito). Conversa com as outras
// partes pelos mesmos window.* de antes até as telas virarem Svelte (passo d). Fica em JS checado pelo TypeScript
// (checkJs, src/tsconfig.js.json); vira .ts quando for dividido em componentes no passo (d).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => (100 * x).toFixed(1).replace('.', ',') + '%';
const pts = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1).replace('.', ',');
const fx = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
const store = { get(k, d) { try { const v = localStorage.getItem('raiox:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('raiox:' + k, JSON.stringify(v)); } catch (e) {} } };

// ---------- dados: cartas no formato do motor ----------
// Se existir dados/cards.json (base do Grimório, com força e resistência), usa ela; senão monta a linha a partir da base do Raio-X.
const DB = window.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
let ROWS = null, DECKS = [];
const pronto = Promise.all([
  fetch('dados/cards.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
  fetch('dados/decks.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
]).then(([c, d]) => {
  if (Array.isArray(c)) { ROWS = new Map(); for (const r of c) { const k = norm(r[0]); if (!ROWS.has(k)) ROWS.set(k, r); const f = norm(r[0].split(' // ')[0]); if (!ROWS.has(f)) ROWS.set(f, r); } }
  if (Array.isArray(d)) DECKS = d;
});
function achar(nome) {
  if (ROWS) { const r = ROWS.get(norm(nome)); if (r) return r; }
  const k = window.RAIOX.lookupName(nome); if (!k) return null;
  if (ROWS) { const r = ROWS.get(norm(k)); if (r) return r; }
  const e = DB.cards[k]; const p = String(e[F.p] || '').split(' // ')[0];
  // a base do Raio-X não guarda a resistência: usa a força como aproximação
  return [k, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false];
}
const limpo = (D) => ({ M: D.M, base: D.base, cmd: D.cmd, nome: D.nome || '', cand: D.cand, vazio: D.vazio, extras: D.extras || [] });

// ---------- motor no Worker ----------
let WK = null, WID = 0, WV = 0; const WP = new Map();
function roda(tipo, msg, prog) {
  if (!WK) {
    WK = new Worker('motor/worker.js?v=' + (WV || window.RAIOX_V || '1'));
    WK.onmessage = (e) => { const p = WP.get(e.data.id); if (!p) return; if (e.data.prog) { if (p.prog) p.prog(e.data.prog.fase, e.data.prog.p); return; } WP.delete(e.data.id); e.data.erro ? p.rej(new Error(e.data.erro)) : p.res(e.data.r); };
    WK.onerror = (e) => { for (const [id, p] of WP) { p.rej(new Error(e.message || 'o motor parou')); WP.delete(id); } WK = null; };
  }
  const id = ++WID; return new Promise((res, rej) => { WP.set(id, { res, rej, prog }); WK.postMessage(Object.assign({ id, tipo }, msg)); });
}
function para() { if (WK) { WK.terminate(); WK = null; } if (WK2) { WK2.terminate(); WK2 = null; } for (const [id, p] of WP) { p.rej(new Error('parado')); WP.delete(id); } }
// T22 (beta): motor novo (src/motor, banco próprio) na Mesa ao vivo, pela chave "motor novo (beta)" — ligada por padrão desde 26/11
let WK2 = null;
const motorNovo = () => String(store.get('vivoMotor', '1')) === '1';   // 26/11: ligado por padrão (Felipe); desmarcar volta ao velho
// link com ?beta=1 liga a chave (e grava), ?beta=0 desliga; sem o parâmetro fica o que estava (Felipe 25/11: link para amigo)
try { const b = new URLSearchParams(location.search).get('beta'); if (b === '1' || b === '0') store.set('vivoMotor', b); } catch (e) {}
function rodaNovo(tipo, msg) {
  if (!WK2) {
    WK2 = new Worker(new URL('./worker-novo.ts', import.meta.url), { type: 'module' });
    WK2.onmessage = (e) => { const p = WP.get(e.data.id); if (!p) return; WP.delete(e.data.id); e.data.erro ? p.rej(new Error(e.data.erro)) : p.res(e.data.r); };
    WK2.onerror = (e) => { for (const [id, p] of WP) { p.rej(new Error(e.message || 'o motor novo parou')); WP.delete(id); } WK2 = null; };
  }
  const id = ++WID; return new Promise((res, rej) => { WP.set(id, { res, rej }); WK2.postMessage(Object.assign({ id, tipo }, msg)); });
}
const rodaVivo = (tipo, msg) => (motorNovo() ? rodaNovo(tipo, msg) : roda(tipo, msg));
// o motor novo diz carta a carta o que não joga (ou que veio da reserva, fora do banco): vira o selo ⓘ (m.lac)
const comLacs = (Ms, lacs) => (lacs ? Ms.map((M, k) => M.map((m, i) => ({ ...m, lac: (lacs[k] && lacs[k][i]) || null }))) : Ms);

// ---------- seu deck e os oponentes ----------
let A = null, EU = null, OPC = new Map();
/* o seu deck com as trocas marcadas na aba Trocas (sai → entra) */
function trocasOn() { return ((window.RAIOX && window.RAIOX.swaps && window.RAIOX.swaps()) || []).filter(s => s.on); }
function deckComTrocas() {
  const D = meuDeck(), M = D.M.slice(), base = D.base.slice(); let n = 0;
  for (const s of trocasOn()) {
    const iS = M.findIndex(m => m.nome === s.out); const pos = iS < 0 ? -1 : base.indexOf(iS); if (pos < 0) continue;
    let iE = M.findIndex(m => m.nome === s.inn);
    if (iE < 0) { const rec = achar(s.inn); if (!rec) continue; M.push(modelo(rec)); iE = M.length - 1; }
    base[pos] = iE; n++;
  }
  return { ...limpo(D), M, base, nome: 'Você (com ' + n + ' troca' + (n === 1 ? '' : 's') + ')' };
}
const vivoComTrocas = () => String(store.get('vivoTrocas', '0')) === '1' && trocasOn().length > 0;
const deckVivo = () => (vivoComTrocas() ? deckComTrocas() : limpo(meuDeck()));
function meuDeck() {
  if (EU) return EU;
  const itens = A.cmds.map(c => ({ q: 1, nome: c.name, cmd: true }));
  const k = {}; A.cards.forEach(c => (k[c.name] = (k[c.name] || 0) + 1));
  for (const [n, q] of Object.entries(k)) itens.push({ q, nome: n, cmd: false });
  const D = monta(itens, achar, A.cmds[0] ? A.cmds[0].name : null); D.nome = 'Você'; EU = D; return D;
}
function listaOps() {
  const out = [];
  for (const d of DECKS) out.push({ id: 'g:' + (d.id || d.nome), nome: d.nome, lista: d.lista, cmd: d.cmd || null, fonte: d.fonte || 'EDHREC / Archidekt' });
  for (const [n, l] of Object.entries(window.EXEMPLOS || {})) if (!DECKS.some(d => d.nome === n)) out.push({ id: 'ex:' + n, nome: n, lista: l, cmd: null, fonte: 'deck médio do EDHREC' });
  for (const [n, l] of Object.entries(window.OPONENTES_EDHREC || {})) if (!out.some(o => o.nome === n)) out.push({ id: 'ed:' + n, nome: n, lista: l, cmd: null, fonte: 'deck médio do EDHREC', extra: true });
  for (const a of store.get('amigos', [])) out.push({ id: 'am:' + a.nome, nome: a.nome, lista: a.lista, cmd: null, fonte: 'deck de amigo', amigo: true });
  return out;
}
function opDe(o) {
  if (OPC.has(o.id)) return OPC.get(o.id);
  const D = monta(parseLista(o.lista), achar, o.cmd); D.nome = o.nome; const L = limpo(D); OPC.set(o.id, L); return L;
}
const meuCmd = () => (A && A.cmds[0] ? A.cmds[0].name : '');
function selecionados() {
  const all = listaOps(); const sel = store.get('ops', null);
  // por padrão, os decks de sempre menos o que tem o mesmo comandante que o seu (os 30 do EDHREC ficam desmarcados)
  return all.filter(o => (sel ? sel.includes(o.id) : !o.extra && o.nome !== meuCmd()));
}

// ---------- tela: Mesa simulada ----------
let RES = null, RTROCAS = null, RTERRA = null, BUSY = false;
function painel() {
  const box = $('#mesa'); if (!box) return;
  if (!A) { box.innerHTML = ''; return; }
  const ops = listaOps(), sel = new Set(selecionados().map(o => o.id));
  const fmt = store.get('formato', '4'), n = store.get('n', 500);
  box.innerHTML = `
  <section class="panel">
    <h2>Mesa simulada</h2>
    <p class="lead">Seu deck joga partidas inteiras contra decks de verdade. Cada jogador joga o próprio deck, carta a carta: terreno, mana, criaturas, remoção, limpa-mesa, contramágica, combate e combos conhecidos. Vida 40, 21 de dano de comandante, até 20 rodadas. O motor é o do Grimório Arena, do Edgar.</p>
    ${ROWS ? '' : '<p class="note">Base de cartas reduzida: sem a resistência das criaturas (o motor usa a força no lugar). Com o arquivo dados/cards.json do Grimório o combate fica mais fiel.</p>'}
    <div class="row" style="gap:14px">
      <label class="field">Formato <select id="m-fmt"><option value="4" ${fmt === '4' ? 'selected' : ''}>Mesa de 4</option><option value="1" ${fmt === '1' ? 'selected' : ''}>1 contra 1</option></select></label>
      <label class="field">Partidas <select id="m-n">${[200, 500, 1000, 2000].map(v => `<option ${+n === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <button class="btn primary" id="m-go" ${BUSY ? 'disabled' : ''}>Jogar as partidas</button>
      <button class="btn" id="m-tro" ${BUSY ? 'disabled' : ''}>Testar as trocas marcadas</button>
      <button class="btn" id="m-ter" ${BUSY ? 'disabled' : ''} title="Joga a lista com a quantidade de terrenos da fórmula pura, da ajustada e dos decks médios do EDHREC, contra a lista atual">Comparar terrenos (fórmula)</button>
      <button class="btn" id="m-stop" ${BUSY ? '' : 'hidden'}>Parar</button>
    </div>
    <div class="prog" id="m-prog" hidden><div></div><span class="note" id="m-prog-l"></span></div>
  </section>
  <section class="panel">
    <h2>Contra quem</h2>
    <p class="lead">Marque quem pode cair na sua mesa. A cada partida, ${fmt === '1' ? '1 oponente é sorteado' : '3 oponentes são sorteados'} entre os marcados. ${DECKS.length ? '' : 'Por enquanto são os decks médios do EDHREC que vêm de exemplo; com o arquivo dados/decks.json entram os decks do Grimório.'}</p>
    <div class="ops">${ops.map(o => `<label class="op ${sel.has(o.id) ? 'on' : ''}"><input type="checkbox" data-op="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''}><span><b>${esc(o.nome)}</b><span class="note">${esc(o.fonte)}</span></span>${o.amigo ? `<button class="btn small" data-del="${esc(o.nome)}" title="Remover">✕</button>` : ''}</label>`).join('')}</div>
    <details style="margin-top:12px"><summary>Colocar o deck de um amigo</summary>
      <p class="note">Exporte do Moxfield, Archidekt ou LigaMagic e cole aqui. Fica salvo neste navegador.</p>
      <div class="row" style="margin-top:6px"><input id="am-nome" class="txt" placeholder="Nome (ex.: Krenko do Edgar)"></div>
      <textarea id="am-lista" rows="5" style="min-height:100px;margin-top:6px" placeholder="1 Krenko, Mob Boss&#10;1 Sol Ring&#10;…"></textarea>
      <div class="row"><button class="btn" id="am-add">Colocar na mesa</button><span class="note" id="am-msg"></span></div>
    </details>
  </section>
  <div id="m-out" class="tout">${RTERRA ? resTerrenos() : ''}${RES ? resultado() : ''}${RTROCAS ? resTrocas() : ''}</div>`;
  $('#m-fmt').onchange = (e) => { store.set('formato', e.target.value); painel(); };
  $('#m-n').onchange = (e) => store.set('n', +e.target.value);
  $('#m-go').onclick = () => guard(jogar);
  $('#m-tro').onclick = () => guard(testarTrocas);
  $('#m-ter').onclick = () => guard(testarTerrenos);
  $('#m-stop').onclick = () => para();
  $$('[data-op]').forEach(c => c.onchange = () => { const ids = $$('[data-op]').filter(x => x.checked).map(x => x.dataset.op); store.set('ops', ids); c.closest('.op').classList.toggle('on', c.checked); });
  $$('[data-del]').forEach(b => b.onclick = (e) => { e.preventDefault(); store.set('amigos', store.get('amigos', []).filter(a => a.nome !== b.dataset.del)); OPC.delete('am:' + b.dataset.del); painel(); });
  $('#am-add').onclick = () => {
    const nome = $('#am-nome').value.trim(), lista = $('#am-lista').value.trim();
    if (!nome || !lista) { $('#am-msg').textContent = 'Dê um nome e cole a lista.'; return; }
    const D = monta(parseLista(lista), achar, null);
    if (D.base.length < 40) { $('#am-msg').textContent = 'Reconheci poucas cartas nessa lista. Confira os nomes.'; return; }
    const am = store.get('amigos', []).filter(a => a.nome !== nome); am.push({ nome, lista }); store.set('amigos', am);
    const sel = store.get('ops', null); if (sel) { sel.push('am:' + nome); store.set('ops', sel); }
    painel();
  };
}
async function guard(fn) {
  if (BUSY || !A) return; BUSY = true; painel(); $('#m-prog').hidden = false;
  try { await pronto; await fn(); }
  catch (e) { if (e.message !== 'parado') { console.error(e); const o = $('#m-out'); if (o) o.insertAdjacentHTML('afterbegin', `<div class="verdict v-bad">O motor falhou: ${esc(e.message).slice(0, 300)}</div>`); } }
  BUSY = false; painel();
}
function prog(f, label) { const p = $('#m-prog'); if (!p) return; $('div', p).style.width = Math.round(100 * f) + '%'; $('#m-prog-l').textContent = label || ''; }
const nOp = () => (store.get('formato', '4') === '1' ? 1 : 3);
function opsEscolhidos() { const s = selecionados(); if (!s.length) throw new Error('Marque pelo menos um oponente.'); return s.map(opDe); }

async function jogar() {
  const Dv = limpo(meuDeck()), Ops = opsEscolhidos(), N = +store.get('n', 500);
  prog(0, 'Jogando partidas');
  const r = await roda('torneio', { Dv, Ops, N, seed: 20261118, nOp: nOp() }, (fase, p) => prog(p, `${fase}: ${Math.round(p * N)} de ${N}`));
  RES = { r, N, nOp: nOp(), M: Dv.M };
}

async function testarTrocas() {
  const sw = (window.RAIOX.swaps() || []).filter(s => s.on);
  if (!sw.length) throw new Error('Nenhuma troca marcada na aba Trocas.');
  const D = meuDeck(); const Dv = limpo(D);
  const pares = [];
  for (const s of sw) {
    const iS = D.M.findIndex(m => m.nome === s.out); if (iS < 0 || !D.base.includes(iS)) continue;
    let iE = D.M.findIndex(m => m.nome === s.inn);
    if (iE < 0) { const rec = achar(s.inn); if (!rec) continue; D.M.push(modelo(rec)); iE = D.M.length - 1; }
    pares.push({ sai: iS, entra: iE, nomeS: s.out, nomeE: s.inn });
  }
  const Ops = opsEscolhidos(), N = Math.max(500, +store.get('n', 500));
  prog(0, 'Testando trocas');
  const r = await roda('trocas', { Dv: limpo(D), Ops, pares, N, seed: 20261119, nOp: nOp() }, (fase, p) => prog(p, `${fase}: ${Math.round(100 * p)}%`));
  RTROCAS = { r, N };
  // a tela Trocas desenha os gráficos com este resultado (vale para este deck e estas trocas)
  window.RAIOX_TESTE = { deck: A, N, nOp: nOp(), base: r.base, todas: r.todas, pares: r.pares.map(t => ({ out: t.nomeS, inn: t.nomeE, d: t.d, se: t.se, ok: t.ok, wr: t.wr, cSai: t.cSai, cEntra: t.cEntra })), testadas: pares.map(p => p.nomeS + '→' + p.nomeE) };
  document.dispatchEvent(new CustomEvent('raiox:teste'));
  if (window.RAIOX_VOLTA === 'trocas') { window.RAIOX_VOLTA = null; setTimeout(() => { location.hash = 'trocas'; }, 400); }
}

// ---------- terrenos pela fórmula do Karsten: pura × ajustada × lista atual (19/11/2026) ----------

const BASICO = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
function idxDe(D, nome) { let i = D.M.findIndex(m => m.nome === nome); if (i < 0) { const rec = achar(nome); if (!rec) return -1; D.M.push(modelo(rec)); i = D.M.length - 1; } return i; }
// mais terrenos: saem as mágicas mais caras (não o comandante) e entram básicos da cor mais pedida;
// menos terrenos: saem básicos da cor que mais sobra e entram ramp/compra baratos da lista de apoio do motor
function variaTerrenos(D, alvo) {
  const b = D.base.slice(), M = D.M, ci = D.cmd ? D.cmd.i : -1, L = b.filter(i => M[i].land).length, mud = [];
  const cores = [...A.ident].filter(x => BASICO[x]);
  const pips = cores.map(x => [x, (A.pips && A.pips[x]) || 1]);
  const cont = {}; for (const i of b) { const n = M[i].nome; for (const x of cores) if (n === BASICO[x]) cont[x] = (cont[x] || 0) + 1; }
  if (alvo > L) {
    const caras = b.map((i, p) => [i, p]).filter(([i]) => !M[i].land && i !== ci).sort((x, y) => (M[y[0]].cmc || 0) - (M[x[0]].cmc || 0));
    for (let k = 0; k < alvo - L && k < caras.length; k++) {
      const x = cores.length ? pips.map(([c, q]) => [c, q / ((cont[c] || 0) + 1)]).sort((a, z) => z[1] - a[1])[0][0] : null;
      const ib = idxDe(D, x ? BASICO[x] : 'Wastes'); if (ib < 0) break;
      mud.push({ sai: M[caras[k][0]].nome, entra: M[ib].nome }); b[caras[k][1]] = ib; if (x) cont[x] = (cont[x] || 0) + 1;
    }
  } else if (alvo < L) {
    const naLista = new Set(b);
    const apoio = (D.cand || []).filter(i => !naLista.has(i) && !M[i].land).sort((x, y) => ((M[x].cmc || 0) <= 2 && (M[x].mana || M[x].ramp || M[x].dr) ? 0 : 1) - ((M[y].cmc || 0) <= 2 && (M[y].mana || M[y].ramp || M[y].dr) ? 0 : 1) || (M[x].cmc || 0) - (M[y].cmc || 0));
    for (let k = 0; k < L - alvo && k < apoio.length; k++) {
      const x = cores.length ? pips.map(([c, q]) => [c, (cont[c] || 0) / q]).sort((a, z) => z[1] - a[1])[0][0] : null;
      let p = x ? b.findIndex(i => M[i].nome === BASICO[x]) : -1;
      if (p < 0) p = b.findIndex(i => M[i].land && /Basic/.test(M[i].tl));
      if (p < 0) break;
      mud.push({ sai: M[b[p]].nome, entra: M[apoio[k]].nome }); b[p] = apoio[k]; if (x) cont[x]--;
    }
  }
  return { base: b, mud, L };
}
async function testarTerrenos() {
  const F = A.terrF; if (!F) throw new Error('Sem a conta de terrenos para este deck.');
  const D = meuDeck(), L = D.base.filter(i => D.M[i].land).length;
  const alvos = [['Fórmula pura', Math.round(F.pura)], ['Com os ajustes', Math.round(F.ajust)], ['Decks médios do EDHREC', Math.round(F.edh)]];
  const vs = alvos.map(([nome, alvo]) => ({ nome, alvo, ...variaTerrenos(D, alvo) }));
  const rodar = /** @type {any} */ (vs.filter(v => v.mud.length));
  const Ops = opsEscolhidos(), N = Math.max(500, +store.get('n', 500));
  prog(0, 'Comparando terrenos');
  const r = rodar.length ? await roda('variantes', { Dv: limpo(D), Ops, bases: rodar.map(v => v.base), N, seed: 20261120, nOp: nOp() }, (fase, p) => prog(p, `${fase}: ${Math.round(100 * p)}%`)) : null;
  rodar.forEach((v, k) => (v.r = r.out[k]));
  RTERRA = { N, L, vs, base: r ? r.base : null, deck: A };
}
function resTerrenos() {
  if (RTERRA.deck !== A) return '';
  const { N, L, vs, base } = RTERRA;
  const linha = (nome, n, x, d) => `<tr><td>${esc(nome)}</td><td class="n">${n}</td><td class="n">${x ? pct(x.wr) : '—'}</td><td class="n">${d ? `<b>${pts(d.d)}</b> ±${fx(d.se)}` : '—'}</td><td class="n">${x ? fx(x.t3) : '—'}</td><td class="n">${x ? fx(x.t5) : '—'}</td><td class="n">${x && x.cmdT ? fx(x.cmdT) : '—'}</td></tr>`;
  const ver = (v) => !v.r ? 'igual à lista atual' : v.r.d > 1.5 * v.r.se ? 'ganha da lista atual' : v.r.d < -1.5 * v.r.se ? 'perde da lista atual' : 'empate (dentro do ruído)';
  return `<section class="panel answer"><h2>Terrenos: fórmula pura × ajustada × decks do EDHREC</h2>
    <p class="lead">${N.toLocaleString('pt-BR')} partidas para cada lista, com as mesmas cartas sorteadas, então a diferença vem da quantidade de terrenos. "Ganha" ou "perde" só quando passa de 1,5 vez o ruído.</p>
    <div class="tw"><table><thead><tr><th>Lista</th><th>Terrenos</th><th>Vitórias</th><th>Diferença</th><th>Terrenos no T3</th><th>No T5</th><th>Comandante entra no turno</th></tr></thead><tbody>
      ${linha('Lista atual', L, base, null)}
      ${vs.map(v => linha(v.nome, v.alvo, v.r || base, v.r)).join('')}
    </tbody></table></div>
    ${vs.map(v => `<p class="note"><b>${esc(v.nome)}</b> (${v.alvo}): ${ver(v)}.${v.mud.length ? ' Para chegar nesse número: ' + v.mud.map(m => `${esc(m.sai)} → ${esc(m.entra)}`).join(', ') + '.' : ''}</p>`).join('')}
    <p class="note">Com mais terrenos saem as mágicas mais caras e entram básicos da cor mais pedida; com menos, saem básicos e entram ramp ou compra baratos da lista de apoio do motor. A conta das fórmulas está na aba Análise, em Mana e curva; a do EDHREC é a média dos decks médios com o mesmo custo médio (só para comparar).</p></section>`;
}

function resultado() {
  const { r, N } = RES; const par = RES.nOp === 1 ? 0.5 : 0.25;
  const tile = (v, l, k) => `<div class="tile ${k}"><b>${v}</b><span>${l}</span></div>`;
  const causas = Object.entries(r.causas).sort((a, b) => b[1] - a[1]);
  const totC = causas.reduce((s, x) => s + x[1], 0) || 1;
  const cartas = r.cartas.filter(c => c.viu >= N * 0.12 && !RES.M[c.i].land);
  const boas = cartas.slice().sort((a, b) => b.imp - a.imp).slice(0, 6), ruins = cartas.slice().sort((a, b) => a.imp - b.imp).slice(0, 6);
  const linhaC = (c) => `<tr><td><button class="cn" data-card="${esc(c.nome)}">${esc(c.nome)}</button></td><td class="n">${pct(c.gih)}</td><td class="n">${pct(c.nao)}</td><td class="n"><b>${pts(100 * c.imp)}</b></td><td class="n">${pct(c.presa)}</td></tr>`;
  const porT = Object.entries(r.porT || {}).map(([t, q]) => [+t, q]).sort((a, b) => a[0] - b[0]);
  const maxQ = Math.max(1, ...porT.map(x => x[1]));
  const W = 460, H = 130, bw = (W - 30) / 20;
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="Turno das vitórias">${porT.map(([t, q]) => { const h = (H - 10) * q / maxQ; return `<rect x="${20 + (t - 1) * bw}" y="${H - h}" width="${bw - 3}" height="${h}" rx="2" fill="var(--good)"><title>Turno ${t}: ${q} vitórias</title></rect>`; }).join('')}${[1, 5, 10, 15, 20].map(t => `<text x="${20 + (t - 1) * bw + bw / 2}" y="${H + 16}" fill="var(--ink-3)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">${t}</text>`).join('')}</svg>`;
  return `<section class="panel answer">
    <h2>Como o deck se saiu</h2>
    <p class="lead">${N.toLocaleString('pt-BR')} partidas ${RES.nOp === 1 ? 'em 1 contra 1' : 'em mesa de 4'}. Num grupo equilibrado, cada jogador ganha ${pct(par)}; acima disso, o deck está na frente da mesa.</p>
    <div class="tiles">
      ${tile(pct(r.wr), 'das partidas vencidas', r.wr >= par ? 'good' : r.wr >= par * 0.7 ? 'warn' : 'bad')}
      ${tile(r.tMed ? fx(r.tMed) : '—', 'turno médio das vitórias', 'info')}
      ${tile(r.cmdT ? fx(r.cmdT) : '—', 'turno em que o comandante entra', 'info')}
      ${tile(fx(r.t3), 'terrenos no turno 3', r.t3 >= 2.7 ? 'good' : 'warn')}
      ${tile(fx(r.t5), 'terrenos no turno 5', r.t5 >= 4.3 ? 'good' : 'warn')}
    </div>
    <div class="grid2">
      <div><h3>Contra cada oponente</h3><div class="tw"><table><thead><tr><th>Oponente</th><th>Partidas</th><th>Você vence</th><th>Ele te derruba</th></tr></thead><tbody>${r.vs.filter(v => v.j).sort((a, b) => a.wr - b.wr).map(v => `<tr><td>${esc(v.nome)}</td><td class="n">${v.j}</td><td class="n">${pct(v.wr)}</td><td class="n">${v.mat}</td></tr>`).join('')}</tbody></table></div></div>
      <div><h3>Como você perde</h3>${causas.length ? causas.map(([c, q]) => `<div class="crow2"><span>${esc(c)}</span><span class="cbar"><span style="width:${100 * q / totC}%;background:var(--bad)"></span></span><span class="num">${Math.round(100 * q / totC)}%</span></div>`).join('') : '<p class="note">Não perdeu nenhuma.</p>'}
        <h3>Em que turno vence</h3>${porT.length ? svg : '<p class="note">Sem vitórias para mostrar.</p>'}</div>
    </div>
  </section>
  <section class="panel">
    <h2>As cartas que mais pesam</h2>
    <p class="lead">Quanto o deck vence nas partidas em que a carta apareceu (comprou ou começou com ela) contra as partidas em que ela não apareceu. É correlação, não prova: carta que aparece em partida longa tende a parecer pior. Para medir troca por troca, use "Testar as trocas marcadas".</p>
    <div class="grid2">
      <div><h3>Ajudam mais</h3><div class="tw"><table><thead><tr><th>Carta</th><th>Com ela</th><th>Sem ela</th><th>Diferença</th><th>Presa na mão</th></tr></thead><tbody>${boas.map(linhaC).join('')}</tbody></table></div></div>
      <div><h3>Ajudam menos</h3><div class="tw"><table><thead><tr><th>Carta</th><th>Com ela</th><th>Sem ela</th><th>Diferença</th><th>Presa na mão</th></tr></thead><tbody>${ruins.map(linhaC).join('')}</tbody></table></div></div>
    </div>
    <p class="note">"Presa na mão": quantas vezes ela terminou a partida na sua mão sem ser jogada.</p>
  </section>`;
}
function resTrocas() {
  const { N } = RTROCAS; const r = RTROCAS.r.pares || RTROCAS.r;
  if (!r.length) return `<section class="panel"><h2>Teste das trocas</h2><p>Nenhuma das trocas marcadas pôde ser testada (as cartas não foram achadas no deck montado).</p></section>`;
  const verd = (t) => t.ok ? ['ajuda', 'good'] : t.d < -1.5 * t.se ? ['piora', 'bad'] : ['empate', 'info'];
  return `<section class="panel answer"><h2>Teste das trocas</h2>
    <p class="lead">Cada troca jogou ${N.toLocaleString('pt-BR')} partidas com as mesmas cartas sorteadas que a lista atual, então a diferença vem da troca e não da sorte. "Ajuda" só quando o ganho passa de 1,5 vez o ruído.</p>
    <div class="tw"><table><thead><tr><th>Sai</th><th>Entra</th><th>Vitórias</th><th>Ruído</th><th>Resultado</th></tr></thead><tbody>${r.map(t => { const [v, k] = verd(t); return `<tr><td><button class="cn" data-card="${esc(t.nomeS)}">${esc(t.nomeS)}</button></td><td><button class="cn" data-card="${esc(t.nomeE)}">${esc(t.nomeE)}</button></td><td class="n"><b>${pts(t.d)}</b> ponto${Math.abs(t.d) >= 2 ? 's' : ''}</td><td class="n">±${fx(t.se)}</td><td><span class="sev s${k === 'good' ? 1 : k === 'bad' ? 3 : 2}" style="background:var(--${k})">${v}</span></td></tr>`; }).join('')}</tbody></table></div>
    <p class="note">Uma troca que empata pode valer pelo conceito do deck ou pelo preço; uma que piora merece outra opção para entrar. Os gráficos de cada troca aparecem na <a href="#trocas">aba Trocas</a>.</p></section>`;
}

// ---------- tela: Mesa ao vivo ----------
let JOGO_TROCAS = 0, JOGO = null, PASSO = 0, TIMER = null, NOMES = [], PREV = null;
const TP = { gatilho: '⚡', efeito: '✧', camada: '▲', habil: '⚙', turno: '⟳', terreno: '◆', magia: '✦', remo: '✕', wipe: '☄', resp: '⟲', ataque: '⚔', bloqueio: '⛨', dano: '♥', morte: '☠', compra: '+', tutor: '⌕', combo: '∞', fim: '★' };
const TPN = { gatilho: 'Gatilho', efeito: 'Efeito', camada: 'Camadas (P/R e habilidades)', habil: 'Habilidade', turno: 'Novo turno', terreno: 'Terreno', magia: 'Mágica', remo: 'Remoção', wipe: 'Limpa-mesa', resp: 'Resposta', ataque: 'Ataque', bloqueio: 'Bloqueio', dano: 'Dano', morte: 'Morte', compra: 'Compra', tutor: 'Busca', combo: 'Combo', fim: 'Fim de jogo' };

// T22 parte 2 (Felipe 25/11), só no motor beta: filtro do registro por tipo (vários juntos; nenhum = todos) e pausa
// opcional em gatilho/efeito quando a partida anda sozinha. As duas escolhas ficam no localStorage (store tem try/catch).
const REG = [['gatilho', '⚡ gatilho'], ['efeito', '✧ efeito'], ['camada', '▲ camada'], ['habil', '⚙ habilidade']];
const PARA_EM = new Set(['gatilho', 'efeito']);
const regFiltro = () => { const f = store.get('vivoReg', []); return Array.isArray(f) ? f.filter(t => REG.some(r => r[0] === t)) : []; };
const regMostra = (tp) => { if (!motorNovo()) return true; const f = regFiltro(); return !f.length || f.includes(tp); };
const pausaOn = () => motorNovo() && store.get('vivoPausa', false) === true;
const paraAqui = (ev) => pausaOn() && !!ev && PARA_EM.has(ev.tp);
function pausaHTML() {
  return motorNovo() ? `<label class="vpausa" title="Com a partida andando sozinha, para a cada gatilho ou efeito até você clicar em continuar"><input type="checkbox" data-pausa ${pausaOn() ? 'checked' : ''}> parar em ⚡ gatilho / ✧ efeito</label>` : '';
}
function regCtlHTML() {
  if (!motorNovo()) return '';
  const f = regFiltro();
  return `<div class="vreg" id="v-reg" role="group" aria-label="Filtro do registro"><span class="vreg-k">Mostrar</span>
    <button class="vchip ${f.length ? '' : 'on'}" data-reg="todos" aria-pressed="${!f.length}">todos</button>${REG.map(([t, r]) => `<button class="vchip ${f.includes(t) ? 'on' : ''}" data-reg="${t}" aria-pressed="${f.includes(t)}">${r}</button>`).join('')}</div>`;
}
// liga os chips e a pausa que estiverem na tela; refaz = redesenha o que o filtro muda
function ligaReg(refaz) {
  $$('[data-reg]').forEach(b => b.onclick = () => {
    const t = b.dataset.reg; let f = regFiltro();
    f = t === 'todos' ? [] : f.includes(t) ? f.filter(x => x !== t) : [...f, t];
    if (f.length === REG.length) f = [];
    store.set('vivoReg', f);
    const r = $('#v-reg'); if (r) r.outerHTML = regCtlHTML();
    ligaReg(refaz); refaz();
  });
  $$('[data-pausa]').forEach(c => c.onchange = () => { store.set('vivoPausa', c.checked); $$('[data-pausa]').forEach(x => { x.checked = c.checked; }); });
}
const semTipo = '<li class="note">Nenhum lance destes tipos ainda.</li>';

// imagens do Scryfall: o carregador em lote e o cache ficam no analise.js (um só para a página)
const IMGS = window.RAIOX.imgCache;
const imgDe = (n) => IMGS.get(n) || IMGS.get(String(n).split(' // ')[0]) || null;
const buscaImagens = (nomes) => window.RAIOX.imgsDe(nomes.filter(n => n && !/\(carta vazia\)|não achada/.test(n)));

function painelVivo() {
  const box = $('#aovivo'); if (!box) return;
  if (!A) { box.innerHTML = ''; return; }
  const ops = listaOps(); const esc0 = store.get('vivoOps', null);
  const fmt = store.get('vivoFmt', '4'), vida = store.get('vivoVida', 40), nO = fmt === '1' ? 1 : 3;
  const def = selecionados().slice(0, nO).map(o => o.id);
  const sel = (esc0 && esc0.length === nO) ? esc0 : def;
  box.innerHTML = `<section class="panel">
    <span class="eyebrow">Jogo · uma partida</span>
    <h2>Mesa ao vivo</h2>
    <p class="lead">Uma partida jogada lance a lance pelo mesmo motor da Mesa simulada, com as cartas na mesa. Avance passo a passo ou deixe rodar; clique em qualquer carta para ler e na imagem para ampliar.</p>
    <div class="row" style="gap:12px">
      <label class="field">Formato <select id="v-fmt"><option value="4" ${fmt === '4' ? 'selected' : ''}>Mesa de 4</option><option value="1" ${fmt === '1' ? 'selected' : ''}>1 contra 1</option></select></label>
      <label class="field">Vida <select id="v-vida">${[40, 30, 20].map(v => `<option ${+vida === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${Array.from({ length: nO }, (_, k) => `<label class="field">Oponente ${k + 1} <select data-vop="${k}">${ops.map(o => `<option value="${esc(o.id)}" ${sel[k] === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>`).join('')}
      ${trocasOn().length ? `<label class="field">Seu deck <select id="v-tro"><option value="0" ${vivoComTrocas() ? '' : 'selected'}>Lista atual</option><option value="1" ${vivoComTrocas() ? 'selected' : ''}>Com as ${trocasOn().length} trocas marcadas</option></select></label>` : ''}
      <label class="field v-beta" title="Joga com o motor novo do Raio-X (regras do Magic, cartas do banco próprio): o registro mostra cada gatilho, efeito e P/R mudando pelas camadas. Carta com ⓘ: o motor novo ainda não a joga inteira.">
        <input type="checkbox" id="v-novo" ${motorNovo() ? 'checked' : ''}> Motor novo <small>(beta)</small></label>
      <button class="btn" id="v-sort">Sortear oponentes</button>
      <button class="btn" id="v-eu" title="Você decide mulligan, terreno, o que lançar, ataques, bloqueios e descartes; o resto o motor faz por você">${JG ? 'Recomeçar jogando' : 'Jogar você mesmo'}</button>
      <button class="btn primary" id="v-go">${JOGO ? 'Jogar outra partida' : 'Jogar uma partida'}</button>
    </div>
  </section>
  <div id="v-mesa">${JOGO ? mesaHTML() : ''}</div>`;
  $('#v-fmt').onchange = (e) => { store.set('vivoFmt', e.target.value); store.set('vivoOps', null); painelVivo(); };
  $('#v-vida').onchange = (e) => store.set('vivoVida', +e.target.value);
  $('#v-novo').onchange = (e) => { store.set('vivoMotor', e.target.checked ? '1' : '0'); JOGO = null; JG = null; parar(); painelVivo(); };
  $$('[data-vop]').forEach(s => s.onchange = () => store.set('vivoOps', $$('[data-vop]').map(x => x.value)));
  $('#v-sort').onclick = () => { const ids = ops.map(o => o.id).filter(id => id !== 'ex:' + meuCmd()); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } store.set('vivoOps', ids.slice(0, nO)); painelVivo(); };
  const vt = $('#v-tro'); if (vt) vt.onchange = () => store.set('vivoTrocas', vt.value);
  $('#v-go').onclick = () => { JG = null; jogaPartida(); };
  $('#v-eu').onclick = jogaEu;
  if (JG) { avancaEu(); return; }
  if (JOGO) { ligaControles(); vaiPara(PASSO); }
  if (window.RAIOX_VIVO_JA) { window.RAIOX_VIVO_JA = false; setTimeout(() => { const g = $('#v-go'); if (g && !g.disabled) g.click(); }, 60); }
}
async function jogaPartida() {
  await pronto;
  const ops = listaOps(); const ids = $$('[data-vop]').map(x => x.value); store.set('vivoOps', ids);
  const Ops = ids.map(id => opDe(ops.find(o => o.id === id)));
  NOMES = [meuCmd(), ...ids.map(id => ops.find(o => o.id === id).nome)];
  const b = $('#v-go'); b.disabled = true; b.textContent = 'Embaralhando…';
  try {
    const seed = (Math.random() * 4294967296) >>> 0;
    const Dv = deckVivo(); JOGO_TROCAS = vivoComTrocas() ? trocasOn().length : 0;
    const Ms = [Dv.M, ...Ops.map(o => o.M)];
    const jogo = rodaVivo('partida', { Dv, Ops, seed, T: 20, vida: +store.get('vivoVida', 40), nomes: ['Você', ...ids.map(id => ops.find(o => o.id === id).nome)] });
    b.textContent = 'Buscando as cartas…';
    const imgs = buscaImagens(Ms.flatMap(M => M.map(m => m.nome)));
    JOGO = await jogo; JOGO.Ms = comLacs(Ms, JOGO.lacs); JOGO.cmdNome = Ms.map((M, k) => { const D = k ? Ops[k - 1] : Dv; return D.cmd ? (M[D.cmd.i].frente || M[D.cmd.i].nome) : ''; });
    await Promise.race([imgs, new Promise(r => setTimeout(r, 6000))]);
    PASSO = 0; PREV = null; parar();
    $('#v-mesa').innerHTML = mesaHTML(); ligaControles(); vaiPara(0);
    $('#v-mesa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { $('#v-mesa').innerHTML = `<div class="verdict v-bad">O motor falhou: ${esc(e.message).slice(0, 300)}</div>`; }
  b.disabled = false; b.textContent = 'Jogar outra partida';
}
// ---------- T27: você joga (o motor pergunta, a tela responde e o motor refaz a partida do zero com a mesma semente) ----------
let JG = null;
async function jogaEu() {
  await pronto; parar(); JOGO = null;
  const ops = listaOps(); const ids = $$('[data-vop]').map(x => x.value); store.set('vivoOps', ids);
  const Ops = ids.map(id => opDe(ops.find(o => o.id === id)));
  NOMES = [meuCmd(), ...ids.map(id => ops.find(o => o.id === id).nome)];
  const Dv = deckVivo(); JOGO_TROCAS = vivoComTrocas() ? trocasOn().length : 0;
  const Ms = [Dv.M, ...Ops.map(o => o.M)];
  const cmdNome = Ms.map((M, k) => { const D = k ? Ops[k - 1] : Dv; return D.cmd ? (M[D.cmd.i].frente || M[D.cmd.i].nome) : ''; });
  JG = { msg: { Dv, Ops, seed: (Math.random() * 4294967296) >>> 0, T: 20, vida: +store.get('vivoVida', 40), nomes: ['Você', ...ids.map(id => ops.find(o => o.id === id).nome)] }, esc: [], Ms, cmdNome, q: null, visto: 0, sel: new Set(), alvo: null };
  const b = $('#v-eu'); if (b) { b.disabled = true; b.textContent = 'Buscando as cartas…'; }
  await Promise.race([buscaImagens(Ms.flatMap(M => M.map(m => m.nome))), new Promise(r => setTimeout(r, 6000))]);
  if (b) { b.disabled = false; b.textContent = 'Recomeçar jogando'; }
  avancaEu();
}
async function avancaEu() {
  const box = $('#v-mesa'); if (!JG || !box) return;
  let r;
  try { r = await rodaVivo('jogar', Object.assign({}, JG.msg, { esc: JG.esc, desde: JG.visto })); }
  catch (e) { box.innerHTML = `<div class="verdict v-bad">O motor falhou: ${esc(e.message).slice(0, 300)}</div>`; JG = null; return; }
  if (!JG) return;
  const lacsN = r.perg ? r.perg.lacs : r.fim && r.fim.lacs; if (lacsN && !JG.lacs) { JG.lacs = 1; JG.Ms = comLacs(JG.Ms, lacsN); }
  if (r.perg) {
    const q = r.perg; JG.q = q; JG.sel = new Set(); JG.alvo = q.alvos ? q.alvos[0].v : null;
    // os lances novos (sobretudo dos oponentes) aparecem um por vez antes da pergunta
    const ps = (q.passos || []).filter(p => p.ev && p.ev.tp !== 'compra');
    if (q.nq) JG.visto = q.nq;
    if (ps.length) { JG.resumo = ps.map(p => p.ev); await mostraPassos(ps); }
    if (!JG || JG.q !== q) return;
    desenhaEu(); rolaMesa(); JG.antes = contaPerm(q.quadro); return;
  }
  // acabou: vira a Mesa ao vivo normal, para rever a partida inteira lance a lance
  const G = JG; JG = null;
  JOGO = r.fim; JOGO.Ms = G.Ms; JOGO.cmdNome = G.cmdNome; PASSO = 0; PREV = null;
  const v = JOGO.venc, txt = v === 0 ? 'Você venceu!' : v >= 0 ? `Venceu ${NOMES[v]}.` : 'Ninguém venceu em 20 turnos.';
  box.innerHTML = `<div class="verdict ${v === 0 ? 'v-good' : 'v-bad'}">${esc(txt)} Reveja a partida abaixo, lance a lance.</div>` + mesaHTML();
  ligaControles(); vaiPara(JOGO.quadros.length - 1);
  const g = $('#v-eu'); if (g) g.textContent = 'Jogar você mesmo';
}
// ritmo: cada lance fica na mesa um tempo (lento/normal/rápido) e dá para pular
const JVEL = { clique: 0, lento: 3500, normal: 2200, rapido: 900 };
const JVN = { clique: 'passo a passo', lento: 'lento', normal: 'normal', rapido: 'rápido' };
const jVel = () => { const v = store.get('jVel2', 'clique'); return v in JVEL ? v : 'clique'; };
async function mostraPassos(ps) {
  const q = JG.q; JG.pula = false;
  for (let j = 0; j < ps.length; j++) {
    if (!JG || JG.q !== q || JG.pula) return;
    const { Q, ev } = ps[j];
    $('#v-mesa').innerHTML = mesaEuHTML(Q, { ev, fila: ps.length - j - 1 });
    ligaMesaEu();
    const ms = JVEL[jVel()], tm = paraAqui(ev) ? 0 : ev.tp === 'turno' ? Math.max(ms, 1200) : ms;   // pausa em ⚡/✧: espera o clique
    await new Promise(res => { JG.acorda = res; if (tm) setTimeout(res, tm); });
  }
}
// quantas cópias de cada permanente cada jogador tinha na sua última decisão (o que passou disso é "novo")
function contaPerm(Q) { return Q ? Q.j.map(p => { const m = {}; p.perm.forEach(x => { m[x.n] = (m[x.n] || 0) + 1; }); return m; }) : null; }
function marcaNovos(p, k) { const a = JG.antes && JG.antes[k]; if (!a) return () => false; const vist = {}; return (x) => { vist[x.n] = (vist[x.n] || 0) + 1; return vist[x.n] > (a[x.n] || 0); }; }
// placar do jogador: terrenos livres/total, criaturas e poder em mesa
function placar(p) { const cri = p.perm.filter(x => x.p != null), pod = cri.reduce((s, x) => s + (x.p || 0), 0), liv = p.tl.filter(l => !l.tap).length;
  return `<div class="ja-pl"><span title="Terrenos em campo (desvirados entre parênteses)">◆ <b>${p.terr}</b> terreno${p.terr === 1 ? '' : 's'} <i>(${liv} livre${liv === 1 ? '' : 's'})</i></span><span title="Criaturas em campo e poder somado">⚔ <b>${cri.length}</b> criatura${cri.length === 1 ? '' : 's'} <i>(poder ${pod})</i></span><span title="Cartas na mão"><b>${p.mao.length}</b> na mão</span></div>`; }
function resumoHTML() { const R0 = (JG.resumo || []).filter(e => e.tp !== 'turno'), R = R0.filter(e => regMostra(e.tp)); if (!R0.length) return '';
  if (!R.length) return `<div class="ja-res"><span class="c-k">Desde a sua última decisão</span><ul>${semTipo}</ul></div>`;
  const por = new Map(); R.forEach(e => { if (!por.has(e.k)) por.set(e.k, []); por.get(e.k).push(e); });
  return `<div class="ja-res"><span class="c-k">Desde a sua última decisão</span>${[...por].map(([k, es]) => `<div><b>${esc(k === 0 ? 'Você' : NOMES[k] || '')}</b><ul>${es.map(e => `<li><span class="vt ${esc(e.tp)}">${TP[e.tp] || '•'}</span>${esc(e.txt)}</li>`).join('')}</ul></div>`).join('')}</div>`; }
function desenhaEu() { $('#v-mesa').innerHTML = mesaEuHTML(JG.q.quadro, { q: JG.q }); ligaMesaEu(); }
// no começo da partida a mesa rola para a tela inteira, longe do cabeçalho
function rolaMesa() { const m = $('.ja'); if (m && !JG.rolou) { JG.rolou = true; const nav = document.querySelector('nav, .tabs'), h = nav ? nav.getBoundingClientRect().height : 0; window.scrollTo({ top: m.getBoundingClientRect().top + scrollY - h - 16, behavior: 'smooth' }); } }
function responde(v) { if (!JG) return; JG.esc.push(v); JG.q = null; $$('.ja button').forEach(b => b.disabled = true); avancaEu(); }

const PERG = {
  mulligan: (q) => `Sua mão inicial${q.nm ? ` (depois de ${q.nm} mulligan${q.nm > 1 ? 's' : ''})` : ''}. Fica com ela?`,
  fundo: (q) => `Clique na carta que vai para o fundo do grimório (falta${q.falta > 1 ? 'm' : ''} ${q.falta}).`,
  terreno: () => 'Clique no terreno que quer baixar.',
  lanca: (q) => (q.resp ? `Você tem prioridade${q.passo ? ' (' + (PASSO_NOME[q.passo] || q.passo) + ')' : ''} · ${q.mana} de mana. Use uma instantânea ou habilidade, gere mana, ou passe.` : `Sua fase principal · ${q.mana} de mana. Clique no que quer lançar.`) + (q.reserva ? ` Na reserva: ${q.reserva}.` : ''),
  ataque: () => 'Combate: escolha o oponente e clique nas criaturas que atacam.',
  equipar: (q) => `Clique na criatura que vai receber ${q.x.n}.`,
  escolha: (q) => q.x.n,
  alvo: (q) => `${q.x.n}: ${q.x.dano} de dano — escolha o alvo.`,
  sacrificar: (q) => `${q.x.n} pede um sacrifício: clique no que vai sacrificar.`,
  bloqueio: (q) => `${q.x.de} ataca você com ${q.x.n} (${q.x.p}/${q.x.t}). Clique na criatura que bloqueia.`,
  descarte: (q) => `Fim do turno: clique na carta para descartar (falta${q.falta > 1 ? 'm' : ''} ${q.falta}).`,
};
const PASSO_NOME = { manutencao: 'manutenção', compra: 'compra', principal1: '1ª fase principal', inicioCombate: 'início do combate', atacantes: 'declarar atacantes', bloqueadores: 'declarar bloqueadores', dano: 'dano de combate', fimCombate: 'fim do combate', principal2: '2ª fase principal', final: 'etapa final', limpeza: 'limpeza' };
const FASES = [['mulligan', 'Mão'], ['terreno', 'Terreno'], ['lanca', 'Principal'], ['ataque', 'Combate'], ['bloqueio', 'Bloqueio'], ['descarte', 'Fim']];
// carta da mesa jogável: botão próprio (data-h = o que o clique faz); botão direito ou a lupa ampliam
function jc(nome, o = {}) {
  const im = o.tok ? null : imgDe(nome);
  const cls = ['jc', o.tap ? 'tap' : '', o.atk ? 'atk' : '', o.cmd ? 'cmd' : '', o.ok ? 'ok' : '', o.sel ? 'sel' : '', o.cls || ''].join(' ');
  const face = im ? `<img src="${esc(im[0])}" alt="${esc(nome)}" data-zoom="${esc(im[1])}">` : `<span class="mtok"><b>${esc(nome)}</b>${o.tok ? '<i>ficha</i>' : ''}</span>`;
  const pt = o.p != null ? `<span class="mpt">${o.p}/${o.t}</span>` : '';
  const q = (o.q > 1 ? `<em class="jq">×${o.q}</em>` : '') + (o.lac ? `<em class="jlac" title="O motor ainda ignora parte do texto desta carta: ela pode gastar a mana sem fazer tudo">⚠</em>` : '');
  return `<button class="${cls}" ${o.h != null ? `data-h="${esc(String(o.h))}"` : ''} title="${esc(nome)}${o.ok ? ' — clique para escolher' : ''}">${face}${pt}${q}</button>`;
}
// terrenos viram fichas: "Mountain ×3 · 2 virados" (clique amplia a carta)
function gruposTerra(p, M) {
  const g = new Map();
  p.tl.forEach(l => { const n = l.i != null && M[l.i] ? (M[l.i].frente || M[l.i].nome) : 'Terreno'; const x = g.get(n) || { n, q: 0, tap: 0 }; x.q++; if (l.tap) x.tap++; g.set(n, x); });
  return [...g.values()];
}
function terrasHTML(p, M, pp) {
  const antes = pp ? new Map(gruposTerra(pp, M).map(x => [x.n, x.q])) : null;
  return gruposTerra(p, M).map(x => { const im = imgDe(x.n), nv = antes && x.q > (antes.get(x.n) || 0);
    return `<span class="ja-tc ${x.tap === x.q ? 'tap' : ''} ${nv ? 'entra' : ''}" ${im ? `data-zoom="${esc(im[1])}"` : ''} data-n="${esc(x.n)}" title="${esc(x.n)}: ${x.q} em campo, ${x.q - x.tap} livre${x.q - x.tap === 1 ? '' : 's'}">${esc(x.n)} <b>×${x.q}</b>${x.tap ? `<i>${x.tap} virado${x.tap > 1 ? 's' : ''}</i>` : ''}</span>`; }).join('') || '<span class="vazio">sem terrenos</span>';
}
// lugares na mesa: você embaixo à esquerda e a vez segue no sentido horário
// fundo de cada lugar (Felipe 26/11): o jogador escolhe a imagem; fica só neste navegador (localStorage)
const FUNDO_K = k => 'raiox_fundo_' + k;
const redesenha = () => { if (JG && JG.q) desenhaEu(); };   // fora de uma pergunta o fundo novo aparece no próximo quadro
function fundoDe(k) { try { return localStorage.getItem(FUNDO_K(k)) || ''; } catch (_) { return ''; } }
function escolheFundo(k) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { const L = 1400, r = Math.min(1, L / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      try { localStorage.setItem(FUNDO_K(k), cv.toDataURL('image/jpeg', .8)); } catch (_) { alert('Não coube no navegador: tente uma imagem menor.'); }
      redesenha(); };
    img.src = url; };
  inp.click();
}
// tapete (playmat): campo de batalha + terrenos + coluna de zonas. Cada lugar é espelhado para a coluna de zonas ficar
// do lado do centro da mesa e a zona de comando no canto mais perto do meio; os de cima têm o campo virado para o meio.
// orient[n][k] = [em cima?, zonas à direita?]
const ORIENT = { 2: [[0, 1], [1, 1]], 3: [[0, 1], [1, 1], [1, 0]], 4: [[0, 1], [1, 1], [1, 0], [0, 0]] };
const LUGAR = { 2: ['s0', 's1'], 3: ['s0', 's1', 's2'], 4: ['s0', 's1', 's2', 's3'] };
function jaLugarHTML(k, p, c) {
  const G = JG, M = G.Ms[k], eu = k === 0, cmd = G.cmdNome[k], ci = cmd ? imgDe(cmd) : null, q = c.q, ev = c.ev;
  const pp = c.prev ? c.prev.j[k] : null, d = pp ? p.vida - pp.vida : 0;
  const vez = ev ? ev.k === k : c.Q && c.Q.k === k, alvo = (ev && ev.a === k && ev.k !== k) || (!eu && c.alvoOk && G.alvo === k);
  const escolhe = !eu && c.alvoOk && q.alvos.some(a => a.v === k);
  const nv = marcaNovos(p, k), novo = new Set(p.perm.filter(x => nv(x)).map(x => x.pi));
  // o que entrou desde o quadro anterior ganha a animação de entrada
  const ant = pp ? contaPerm({ j: [pp] })[0] : null, vis = {};
  const entrou = (x) => { if (!ant) return false; vis[x.n] = (vis[x.n] || 0) + 1; return vis[x.n] > (ant[x.n] || 0); };
  const cls = (x, base) => [base, novo.has(x.pi) ? 'novo' : '', entrou(x) ? 'entra' : ''].join(' ');
  const cri = p.perm.filter(x => x.p != null), out = p.perm.filter(x => x.p == null);
  const criH = cri.map(x => { const ok = eu && c.okPi.has(x.pi), sel = eu && c.atkSel.has(x.pi);
    return jc(x.n, { tap: x.tap, atk: x.atk || sel, cmd: x.c, tok: x.tok && !(x.i >= 0), p: x.p, t: x.t, ok, sel, h: ok ? 'p' + x.pi : null, cls: cls(x, 'pq') }); }).join('');
  const outH = out.map(x => jc(x.n, { tap: x.tap, tok: x.tok, cls: cls(x, 'mini') })).join('');
  const av = eu ? `<button class="ja-av ${c.cmdOk ? 'ok' : ''}" ${c.cmdOk ? 'data-h="cmd"' : ''} style="${ci ? `background-image:url('${esc(ci[2])}')` : ''}" title="${esc(cmd)}${c.cmdOk ? ' — clique para lançar da zona de comando' : ''}"></button>`
    : `<span class="ja-av" style="${ci ? `background-image:url('${esc(ci[2])}')` : ''}" title="${esc(cmd)}"></span>`;
  const cmdD = Math.max(0, ...p.cmdD);
  const [cima, dir] = (ORIENT[G.Ms.length] || ORIENT[4])[k] || [0, 1];
  const fundo = fundoDe(k);
  const gyTop = p.gyL && p.gyL.length ? (G.Ms[k][p.gyL[p.gyL.length - 1]] || {}) : null, gyN = gyTop ? (gyTop.frente || gyTop.nome) : null, gyIm = gyN ? imgDe(gyN) : null;
  const zona = (cl, rot, n, extra = '', st = '') => `<div class="ja-z ${cl}" style="${st}"><span class="ja-zr">${rot}</span>${n !== null ? `<b>${n}</b>` : ''}${extra}</div>`;
  const cmdZ = `<div class="ja-z cmd ${p.zona && cmd ? '' : 'fora'}"><span class="ja-zr">Comando</span>${av}${p.tax ? `<small>imposto +${p.tax}</small>` : ''}${p.zona || !cmd ? '' : '<small>em campo</small>'}</div>`;
  return `<div class="ja-lug ${LUGAR[G.Ms.length][k]} ${cima ? 'cima' : 'baixo'} ${dir ? 'zdir' : 'zesq'} ${fundo ? 'comfundo' : ''} ${eu ? 'eu' : ''} ${vez ? 'vez' : ''} ${alvo ? 'alvo' : ''} ${escolhe ? 'escolhe' : ''} ${p.vivo ? '' : 'morto'}" ${eu ? '' : `data-alvo="${k}"`} ${fundo ? `style="--fundo:url('${fundo}')"` : ''}>
    <div class="ja-campo">
      ${placar(p)}
      <div class="ja-row cri">${criH}</div>
      ${outH ? `<div class="ja-row">${outH}</div>` : ''}
    </div>
    <div class="ja-terras">${terrasHTML(p, M, pp)}</div>
    <div class="ja-zonas">
      <div class="ja-z vid"><span class="ja-nm"><b>${esc(eu ? 'Você' : NOMES[k])}</b>${cmd && (eu || cmd !== NOMES[k]) ? `<small>${esc(cmd)}</small>` : ''}</span>
        <span class="ja-vida ${d ? 'bate' : ''}">${p.vida}${d ? `<i class="ja-flut ${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</i>` : ''}</span>
        ${cmdD ? `<small class="mau" title="Maior dano de um comandante">cmd ${cmdD}/21</small>` : ''}
        <button class="ja-fb" data-fundo="${k}" title="Escolher a imagem de fundo deste lugar${fundo ? ' (clique direito: tirar)' : ''}">fundo</button></div>
      ${cmdZ}
      ${zona('exi', 'Exílio', p.ex ?? 0)}
      ${zona('gri', 'Grimório', p.lib, p.topo != null && p.topo >= 0 && G.Ms[k][p.topo] ? `<small title="Você pode olhar a carta do topo do seu grimório a qualquer momento">topo: ${esc(G.Ms[k][p.topo].frente || G.Ms[k][p.topo].nome)}</small>` : '')}
      ${zona('cem', 'Cemitério', p.gy, '', gyIm ? `background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('${esc(gyIm[2] || gyIm[0])}')` : '')}
    </div>
    ${p.vivo ? '' : '<div class="s-x">fora</div>'}
  </div>`;
}
function mesaEuHTML(Q, o) {
  const q = o.q, ev = o.ev, G = JG, n = G.Ms.length;
  const nome = (k, i) => { const m = G.Ms[k][i]; return m ? (m.frente || m.nome) : '?'; };
  const okMao = new Set(), okPi = new Set(), alvoOk = q && q.tipo === 'ataque';
  if (q && ['terreno', 'lanca', 'descarte'].includes(q.tipo)) q.ops.forEach(x => { if (typeof x.v === 'number' && x.v >= 0) okMao.add(x.v); });
  if (q && (q.tipo === 'ataque' || q.tipo === 'bloqueio' || q.tipo === 'equipar' || q.tipo === 'sacrificar')) q.ops.forEach(x => { if (x.pi >= 0) okPi.add(x.pi); });
  const atkSel = new Set(q && q.tipo === 'ataque' ? [...G.sel].map(j => q.ops[j].pi) : []);
  const P = Q ? Q.j : null, me = P ? P[0] : null;
  const cmdOk = !!(q && q.tipo === 'lanca' && q.ops.some(x => x.v === 'cmd'));
  const prev = G.ultQ && G.ultQ !== Q ? G.ultQ : null; G.ultQ = Q;
  const c = { Q, q, ev, okPi, atkSel, alvoOk, cmdOk, prev };
  const lugares = P ? P.map((p, k) => jaLugarHTML(k, p, c)).join('') : '';
  // sua mão: leque fixo embaixo da mesa
  const maoIs = q && q.mao ? q.mao.map(c => c.v) : me ? me.mao : [];
  const lacs = new Set(q && q.tipo === 'lanca' ? q.ops.filter(x => x.lac).map(x => x.v) : []);
  const maoH = maoIs.map((i, j) => { const ok = okMao.has(i) || (q && q.tipo === 'fundo');
    return `<span class="ja-mc" style="--r:${(j - (maoIs.length - 1) / 2) * 3}deg">${jc(nome(0, i), { ok, h: ok ? 'm' + i : null, cls: 'mao', lac: lacs.has(i) })}</span>`; }).join('');
  const fase = q ? q.tipo : '';
  const fasesH = `<div class="ja-fases">${FASES.map(([t, r]) => `<span class="${fase === t ? 'on' : ''}">${r}</span>`).join('')}</div>`;
  // centro da mesa: a sua pergunta, ou o lance que está acontecendo com a carta grande
  let meio;
  if (q) {
    const bt = [];
    if (q.tipo === 'mulligan') bt.push(`<button class="btn primary" data-b="0">Ficar com a mão</button><button class="btn" data-b="1">Mulligan</button>`);
    if (q.tipo === 'terreno') bt.push(`<button class="btn" data-b="-1">Não baixar terreno</button>`);
    if (q.tipo === 'lanca') { q.ops.filter(x => typeof x.v === 'string' && x.v.slice(0, 2) === 'eq').forEach(x => bt.push(`<button class="btn small" data-b="${esc(x.v)}">🗡 ${esc(x.n)}</button>`));
      const mn = q.ops.filter(x => typeof x.v === 'string' && x.v.slice(0, 2) === 'mn');   // gerar mana quando quiser (indica, não limita)
      if (mn.length) bt.push(`<div class="ja-alvos"><span class="c-k">Gerar mana (fica na reserva até o fim da etapa):</span>${mn.map(x => `<button class="btn small" data-b="${esc(x.v)}" title="Vira a carta e põe a mana na sua reserva">⚡ ${esc(x.n)}</button>`).join('')}</div>`);
      bt.push(`<button class="btn primary" data-b="-1">Passar ▶</button>`); }
    if (q.tipo === 'equipar' || q.tipo === 'sacrificar') bt.push(`<button class="btn" data-b="-1">Cancelar</button>`);
    if (q.tipo === 'ataque') { const an = (q.alvos.find(a => a.v === G.alvo) || q.alvos[0] || {}).n || '';
      bt.push(`<div class="ja-alvos"><span class="c-k">Atacar quem?</span>${q.alvos.map(a => `<button class="btn small ${a.v === G.alvo ? 'primary' : ''}" data-alvo="${a.v}">${esc(a.n)} ♥${a.vida}</button>`).join('')}</div>`);
      bt.push(`<button class="btn small" data-b="todos">Todas as criaturas</button><button class="btn primary" data-b="atk" ${G.sel.size ? '' : 'disabled'}>⚔ Atacar ${esc(an)} com ${G.sel.size}</button><button class="btn" data-b="nao">Não atacar</button>`); }
    if (q.tipo === 'bloqueio') bt.push(`<button class="btn" data-b="-1">Não bloquear</button>`);
    if (q.tipo === 'escolha') q.ops.forEach(x => bt.push(`<button class="btn${x.v === -1 || x.sec ? '' : ' primary'}" data-b="${x.v}">${esc(x.n)}</button>`));
    if (q.tipo === 'alvo') q.ops.forEach(x => bt.push(`<button class="btn" data-b="${x.v}">🎯 ${esc(x.n)}</button>`));
    const atkIm = q.tipo === 'bloqueio' ? imgDe(q.x.n) : null;
    meio = `<div class="ja-meio perg"><span class="c-k">Sua vez de decidir · turno ${q.t}</span>
      ${atkIm ? `<img class="ja-evim" src="${esc(atkIm[1] || atkIm[0])}" alt="${esc(q.x.n)}" data-zoom="${esc(atkIm[1])}">` : ''}<p><b>${esc(PERG[q.tipo] ? PERG[q.tipo](q) : q.tipo)}</b></p>
      <div class="j-ops">${bt.join('')}</div>
      <div class="j-ops"><button class="btn small" data-b="desf" ${G.esc.length ? '' : 'disabled'}>↶ Desfazer</button><button class="btn small" ${/[?&]dev=1/.test(location.search) ? "" : "hidden"} data-b="motor" title="Lê de novo motor/*.js e forge-motor.js do servidor e refaz a partida com as mesmas escolhas, sem recarregar a página">↻ Recarregar motor</button><button class="btn small" data-b="sai">Desistir</button></div></div>`;
  } else if (ev) {
    const Mk = G.Ms[ev.k] || [], nc = ev.c >= 0 && Mk[ev.c] ? (Mk[ev.c].frente || Mk[ev.c].nome) : null, im = nc ? imgDe(nc) : null;
    const quem = ev.k === 0 ? 'Você' : NOMES[ev.k] || '';
    const pausado = paraAqui(ev) && jVel() !== 'clique';
    const ctl = `<div class="j-ops"><button class="btn primary" data-b="prox">${pausado ? 'Continuar ▶' : 'Próximo ▶'}${o.fila ? ` (faltam ${o.fila})` : ''}</button><select class="vsel" id="ja-vel" aria-label="Velocidade">${Object.keys(JVEL).map(k => `<option value="${k}" ${jVel() === k ? 'selected' : ''}>${JVN[k]}</option>`).join('')}</select>
      <button class="btn small" data-b="pula">Pular para minha vez ⏭</button>${pausaHTML()}</div>${pausado ? '<p class="vpausou">Parado neste lance (parar em gatilho/efeito ligado).</p>' : ''}`;
    meio = ev.tp === 'turno'
      ? `<div class="ja-meio ev turno"><div class="ja-ban"><b>Turno ${Q.t}</b><span>vez de ${esc(quem)}</span></div>${ctl}</div>`
      : `<div class="ja-meio ev ${esc(ev.tp)}"><span class="c-k"><span class="vt ${esc(ev.tp)}">${TP[ev.tp] || '•'}</span>${esc(TPN[ev.tp] || ev.tp)} · ${esc(quem)}</span>
      <div class="ja-palco">${im ? `<img class="ja-evim lanca" src="${esc(im[1] || im[0])}" alt="${esc(nc)}" data-zoom="${esc(im[1])}">` : ''}</div><p>${txtLance(ev, quem)}</p>${ctl}</div>`;
  } else meio = '<div class="ja-meio"><p>A partida vai começar.</p></div>';
  const logH = (q ? q.log : []).filter(l => regMostra(l.tp)).slice(-14).map(l => `<li><span class="vt ${esc(l.tp)}">${TP[l.tp] || '•'}</span><span>${esc(l.txt)}</span></li>`).join('');
  return `<section class="ja n${n}">
    <div class="ja-mesa">${lugares}<div class="ja-centro">${meio}</div></div>
    ${fasesH}
    <div class="ja-mao">${maoH}</div>
    ${q ? `${regCtlHTML()}<div class="ja-lado">${resumoHTML()}<details class="ja-hist"><summary>Histórico</summary><ol class="ja-log">${logH}</ol></details></div>` : ''}
  </section>`;
}
function ligaMesaEu() {
  const q = JG && JG.q; const box = $('.ja'); if (!box) return;
  box.oncontextmenu = (e) => { const fb = e.target.closest('[data-fundo]'); if (fb) { e.preventDefault(); try { localStorage.removeItem(FUNDO_K(+fb.dataset.fundo)); } catch (_) {} redesenha(); return; } const im = e.target.closest('[data-zoom]'); if (!im) return; e.preventDefault(); zoomCarta(im.dataset.zoom, im.alt || im.dataset.n); };
  box.onclick = (e) => {
    if (!JG) return;
    const fb = e.target.closest('[data-fundo]'); if (fb) { e.stopPropagation(); escolheFundo(+fb.dataset.fundo); return; }
    const b = e.target.closest('[data-b]'), h = e.target.closest('[data-h]'), al = e.target.closest('[data-alvo]');
    if (b) {
      const v = b.dataset.b;
      if (v === 'prox') { JG.acorda && JG.acorda(); return; }
      if (v === 'pula') { JG.pula = true; JG.acorda && JG.acorda(); return; }
      if (v === 'desf') { JG.esc.pop(); JG.visto = 1e9; JG.q = null; avancaEu(); return; }
      if (v === 'sai') { JG = null; painelVivo(); return; }
      // recarregar só o motor (23/11): worker novo com ?v= novo baixa engine/mesa/forge-motor de novo; a partida refaz com as mesmas escolhas
      if (v === 'motor') { para(); WV = Date.now(); JG.visto = 1e9; JG.q = null; avancaEu(); return; }
      if (!q) return;
      if (v === 'todos') { q.ops.forEach((_, j) => JG.sel.add(j)); desenhaEu(); return; }
      if (v === 'atk') { responde({ alvo: JG.alvo, at: [...JG.sel].map(j => q.ops[j].v) }); return; }
      if (v === 'nao') { responde({ alvo: q.alvos[0].v, at: [] }); return; }
      if (v.slice(0, 2) === 'eq') { responde(v); return; }
      responde(+v); return;
    }
    if (!q) { const im = e.target.closest('[data-zoom]'); if (im) zoomCarta(im.dataset.zoom, im.alt || im.dataset.n); return; }
    if (h) {
      const v = h.dataset.h;
      if (v === 'cmd') { responde('cmd'); return; }
      if (v[0] === 'm') { const i = +v.slice(1); responde(i); return; }
      if (v[0] === 'p') { const pi = +v.slice(1), j = q.ops.findIndex(x => x.pi === pi);
        if (q.tipo === 'bloqueio' || q.tipo === 'equipar' || q.tipo === 'sacrificar') { responde(q.ops[j].v); return; }
        if (JG.sel.has(j)) JG.sel.delete(j); else JG.sel.add(j); desenhaEu(); return; }
    }
    if (al && q.tipo === 'ataque' && q.alvos.some(a => a.v === +al.dataset.alvo)) { JG.alvo = +al.dataset.alvo; desenhaEu(); return; }
    const im = e.target.closest('[data-zoom]'); if (im) zoomCarta(im.dataset.zoom, im.alt || im.dataset.n);
  };
  const vel = $('#ja-vel'); if (vel) vel.onchange = () => store.set('jVel2', vel.value);
  ligaReg(() => { if (JG && JG.q) desenhaEu(); });
}
function zoomCarta(src, alt) {
  const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<div class="zoom-box solo"><button class="btn small zoom-x">Fechar ✕</button><div class="zoom-img"><img src="${esc(src)}" alt="${esc(alt || '')}"></div></div>`;
  z.onclick = () => z.remove(); document.body.appendChild(z);
}
function mesaHTML() {
  const n = JOGO.quadros[0].j.length;
  const lugares = n === 2 ? ['me', 'top'] : ['me', 'left', 'top', 'right'];
  return `<section class="arena n${n}">
    <div class="vctl">
      <button class="vb" data-v="ini" title="Começo">⏮</button><button class="vb" data-v="vt" title="Turno anterior">⏪</button><button class="vb" data-v="ant" title="Lance anterior">◀</button>
      <button class="vb play" id="v-play">▶ Rodar</button>
      <button class="vb" data-v="prox" title="Próximo lance">▶</button><button class="vb" data-v="pt" title="Próximo turno">⏩</button><button class="vb" data-v="fim" title="Fim">⏭</button>
      <select id="v-vel" class="vsel" aria-label="Velocidade"><option value="1500">devagar</option><option value="800" selected>normal</option><option value="350">rápido</option><option value="100">turbo</option></select>
      <input type="range" id="v-bar" min="0" max="${JOGO.quadros.length - 1}" value="0" aria-label="Momento da partida">
      <span class="vpos" id="v-pos"></span>${pausaHTML()}
    </div>
    <div class="vleg"><span><i class="lg vez"></i>de quem é a vez</span><span><i class="lg alvo"></i>alvo do lance</span><span><i class="lg atk"></i>criatura atacando</span><span><i class="lg cmd"></i>comandante</span><span><i class="lg tap"></i>carta virada (já usada no turno)</span><span><b class="lg-pt">3/3</b>força/resistência</span></div>
    <div class="feltro">
      ${lugares.map((l, k) => `<div class="seat ${l}" id="seat-${k}" style="grid-area:${l}"></div>`).join('')}
      <div class="centro" id="v-centro" style="grid-area:center"></div>
    </div>
    <section class="vlog2"><h3>Lances deste turno</h3>${regCtlHTML()}<ol id="v-log"></ol></section>
  </section>`;
}
function ligaControles() {
  const q = JOGO.quadros; const turnoDe = (i) => q[i].t;
  $$('[data-v]').forEach(b => b.onclick = () => {
    parar(); const v = b.dataset.v;
    if (v === 'ini') vaiPara(0); else if (v === 'fim') vaiPara(q.length - 1);
    else if (v === 'ant') vaiPara(PASSO - 1); else if (v === 'prox') vaiPara(PASSO + 1);
    else if (v === 'pt') { const t = turnoDe(PASSO); let i = PASSO; while (i < q.length - 1 && turnoDe(i) <= t) i++; vaiPara(i); }
    else if (v === 'vt') { const t = turnoDe(PASSO); let i = PASSO; while (i > 0 && turnoDe(i) >= t) i--; const t2 = turnoDe(i); while (i > 0 && turnoDe(i - 1) === t2) i--; vaiPara(i); }
  });
  $('#v-play').onclick = () => (TIMER ? parar() : rodar());
  $('#v-bar').oninput = (e) => { parar(); vaiPara(+e.target.value); };
  ligaReg(() => vaiPara(PASSO));
}
function parar() { if (TIMER) { clearTimeout(TIMER); TIMER = null; } const b = $('#v-play'); if (b) b.textContent = '▶ Rodar'; }
function rodar() {
  const b = $('#v-play'); if (b) b.textContent = '❚❚ Pausar';
  const passo = () => {
    if (PASSO >= JOGO.quadros.length - 1) { parar(); return; }
    vaiPara(PASSO + 1); const e = JOGO.log[JOGO.quadros[PASSO].log - 1];
    if (paraAqui(e)) { parar(); const b2 = $('#v-play'); if (b2) b2.textContent = '▶ Continuar'; return; }   // pausa em ⚡/✧ (beta)
    const v = +($('#v-vel') || { value: 800 }).value;
    TIMER = setTimeout(passo, e && /turno|combo|wipe|morte|fim|ataque/.test(e.tp) ? v * 1.7 : v);
  };
  TIMER = setTimeout(passo, 10);
}

// uma carta na mesa: imagem do Scryfall; ficha sem imagem vira um cartão desenhado
function carta(nome, o = {}) {
  const im = o.tok ? null : imgDe(nome);
  const cls = ['mc', o.tap ? 'tap' : '', o.atk ? 'atk' : '', o.cmd ? 'cmd' : '', o.tok ? 'tok' : '', o.novo ? 'novo' : '', o.cls || ''].join(' ');
  const pt = o.p != null ? `<span class="mpt ${o.bon ? 'buff' : ''}" ${o.buff ? `title="${esc(o.buff)}"` : ''}>${o.p}/${o.t}</span>` : '';
  const ct = (o.ct ? `<span class="mct" title="${o.ct} marcador${o.ct > 1 ? 'es' : ''} +1/+1 (conta para quem pede marcadores)">+${o.ct}</span>` : '')
    + (o.cm ? `<span class="mct mcm" title="${o.cm} marcador${o.cm > 1 ? 'es' : ''} -1/-1">−${o.cm}</span>` : '');
  const lac = o.lac && o.lac.length ? `<i class="mlac" title="${esc('O motor não simula esta parte da carta:\n• ' + o.lac.join('\n• '))}">ⓘ</i>` : '';
  const solto = o.solto ? '<em class="msolto">solto</em>' : '';
  // cartas anexadas: em leque atrás da criatura, só a ponta de cada uma aparece (clicável)
  const anx = (o.an || []).map((a, j) => { const n0 = a.n.replace(/ \(cópia\)$/, ''); const ia = a.i >= 0 ? imgDe(n0) : null;
    return `<button class="manx" style="--j:${j + 1}" data-card="${esc(n0)}" title="${esc(a.n)}">${ia ? `<img src="${esc(ia[0])}" alt="${esc(a.n)}" data-big="${esc(ia[1])}">` : `<span class="mtok"><b>${esc(a.n)}</b></span>`}</button>`; }).join('');
  const face = im ? `<img src="${esc(im[0])}" alt="${esc(nome)}" loading="lazy" data-big="${esc(im[1])}">` : `<span class="mtok"><b>${esc(nome)}</b>${o.tok ? '<i>ficha</i>' : ''}</span>`;
  const sob = o.an && o.an.length ? `<span class="mcom" title="${esc(o.an.map(a => a.n).join(', '))}">${o.an.length > 1 ? 'equipada/encantada com' : 'com'}: ${esc(o.an.map(a => a.n).join(', '))}</span>` : '';
  const kw = o.kw && o.kw.length ? `<span class="mkw">${esc(o.kw.map(k => KW_PT[k] || k).join(' · '))}</span>` : '';
  return `<span class="mcw ${o.tap ? 'tap' : ''} ${o.an && o.an.length ? 'com-anx' : ''}" style="${o.an && o.an.length ? `--n:${o.an.length}` : ''}">${anx}<button class="${cls}" ${o.tok ? '' : `data-card="${esc(nome)}"`} title="${esc(nome)}">${face}${pt}${ct}${lac}${solto}</button>${sob || kw ? `<span class="msub">${sob}${kw}</span>` : ''}</span>`;
}
const KW_PT = { flying: 'voar', haste: 'ímpeto', trample: 'atropelar', vigilance: 'vigilância', reach: 'alcance', lifelink: 'vínculo com a vida', deathtouch: 'toque mortífero', menace: 'ameaçar', 'first strike': 'iniciativa', 'double strike': 'golpe duplo', hexproof: 'resistência a magia', indestructible: 'indestrutível', ward: 'proteção (ward)', shroud: 'manto', mountainwalk: 'montanhismo', forestwalk: 'florestalismo' };
function lacDe(M, x) { const m = x.i >= 0 && !x.tok ? M[x.i] : null; return m && m.lac ? m.lac : null; }
function buffDe(x) {
  const sn = v => (v > 0 ? '+' : '') + v, p = [];
  if (x.bp || x.bt) p.push(`Bônus de outras cartas (lordes, anexos, efeitos): ${sn(x.bp || 0)}/${sn(x.bt || 0)}`);
  if (x.ct) p.push(`${x.ct} marcador${x.ct > 1 ? 'es' : ''} +1/+1`);
  if (x.cm) p.push(`${x.cm} marcador${x.cm > 1 ? 'es' : ''} -1/-1`);
  return p.join('\n');
}
function vaiPara(i) {
  const q = JOGO.quadros; PASSO = Math.max(0, Math.min(q.length - 1, i));
  const Q = q[PASSO], ev = JOGO.log[Q.log - 1];
  $('#v-bar').value = PASSO;
  $('#v-pos').textContent = `Turno ${Q.t} · ${PASSO + 1}/${q.length}`;
  Q.j.forEach((p, k) => { const el = $('#seat-' + k); if (el) el.innerHTML = lugarHTML(p, k, ev, PREV && PREV.j[k]); });
  $('#v-centro').innerHTML = centroHTML(Q, ev);
  const ini = JOGO.log.findIndex(l => l.t === Q.t);
  const lances = JOGO.log.slice(Math.max(0, ini), Q.log), ult = lances[lances.length - 1], vis = lances.filter(l => regMostra(l.tp));
  $('#v-log').innerHTML = vis.map(l => `<li class="${l === ult ? 'agora' : ''}"><span class="vt ${esc(l.tp)}">${TP[l.tp] || '•'}</span><span>${esc(l.txt)}</span></li>`).join('') || (lances.length ? semTipo : '<li class="note">Nada ainda neste turno.</li>');
  const ol = $('#v-log'); ol.scrollTop = ol.scrollHeight;
  PREV = Q;
}
function txtLance(ev, quem) {
  if (ev.tp === 'turno') return `Vez de <b>${esc(quem)}</b>`;
  const nm = ev.k === 0 ? 'Você' : NOMES[ev.k] || '';
  return nm && ev.txt.startsWith(nm) ? `<b>${esc(nm)}</b>${esc(ev.txt.slice(nm.length))}` : esc(ev.txt);
}
function centroHTML(Q, ev) {
  if (!ev) return `<div class="c-vazio"><span class="c-k">Turno 0</span><p>Mãos compradas.<br>A partida vai começar.</p></div>`;
  const M = JOGO.Ms[ev.k]; const nomeC = ev.c >= 0 && M[ev.c] ? (M[ev.c].frente || M[ev.c].nome) : null;
  const im = nomeC ? imgDe(nomeC) : null;
  const quem = ev.k >= 0 ? (ev.k === 0 ? 'Você' : NOMES[ev.k]) : '';
  return `<div class="c-ev ${esc(ev.tp)}">
    <span class="c-k"><span class="vt ${esc(ev.tp)}">${TP[ev.tp] || '•'}</span>${esc(TPN[ev.tp] || ev.tp)} · turno ${Q.t}</span>
    ${im ? `<button class="c-card" data-card="${esc(nomeC)}"><img src="${esc(im[1])}" alt="${esc(nomeC)}"></button>` : nomeC ? `<button class="c-card" data-card="${esc(nomeC)}"><span class="mtok big"><b>${esc(nomeC)}</b></span></button>` : ''}
    <p class="c-txt">${txtLance(ev, quem)}</p>
  </div>`;
}
function lugarHTML(p, k, ev, pv) {
  const G = JG || JOGO; const M = G.Ms[k]; const nome = (i) => (M[i] ? (M[i].frente || M[i].nome) : '?');
  const antes = new Set(pv ? pv.perm.map(x => x.n + '|' + x.i) : []);
  const cri = p.perm.filter(x => x.p != null).sort((a, b) => b.c - a.c || (b.p || 0) - (a.p || 0));
  const out = p.perm.filter(x => x.p == null);
  const novo = (x) => pv && !antes.has(x.n + '|' + x.i);
  const vez = ev && ev.k === k, alvo = ev && ev.a === k && ev.k !== k;
  const dv = pv ? p.vida - pv.vida : 0;
  const cmd = G.cmdNome[k]; const cmdIm = cmd ? imgDe(cmd) : null;
  const me = k === 0;
  // terrenos: as cartas de verdade, agrupadas por nome (×2, ×3…), com quantas estão viradas
  const pvT = pv ? pv.tl.length : p.tl.length;
  const grupos = new Map(); let tap = 0;
  p.tl.forEach(l => { if (l.tap) tap++; const n = l.i != null ? nome(l.i) : 'Terreno'; const g = grupos.get(n) || { n, q: 0, tap: 0 }; g.q++; if (l.tap) g.tap++; grupos.set(n, g); });
  const terrHTML = [...grupos.values()].sort((a, b) => b.q - a.q).map(g => `<span class="lgrp">${carta(g.n, { tap: g.tap === g.q, cls: 'terra' })}${g.q > 1 ? `<em class="lq">×${g.q}</em>` : ''}${g.tap && g.tap < g.q ? `<em class="lv">${g.tap} virado${g.tap > 1 ? 's' : ''}</em>` : ''}</span>`).join('');
  const zona = (rot, n, extra, corpo, cls) => `<div class="zn ${cls || ''}"><div class="zn-k"><span>${rot}</span>${n != null ? `<b>${n}</b>` : ''}${extra ? `<span class="zn-x">${extra}</span>` : ''}</div>${corpo}</div>`;
  const stat = (rot, v, t, cls) => `<span class="stt ${cls || ''}" title="${t}"><em>${rot}</em><b>${v}</b></span>`;
  const cmdTxt = !cmd ? '' : p.zona ? `na zona de comando${p.tax ? ` (custa +${p.tax})` : ''}` : p.perm.some(x => x.c) ? 'em jogo' : '—';
  const gyL = (p.gyL || []).slice().reverse();
  return `<div class="seat-in ${vez ? 'vez' : ''} ${alvo ? 'alvo' : ''} ${p.vivo ? '' : 'morto'}">
    <div class="s-h">
      <button class="s-av" ${cmd ? `data-card="${esc(cmd)}"` : ''} style="${cmdIm ? `background-image:url('${esc(cmdIm[2])}')` : ''}" title="${esc(cmd)}"></button>
      <div class="s-n"><b>${esc(me ? 'Você' : NOMES[k])}</b><span>${esc(me ? cmd + (JOGO_TROCAS ? ` · com as ${JOGO_TROCAS} trocas` : '') : (cmd && cmd !== NOMES[k] ? cmd : 'Oponente ' + k))}${vez ? ' · <i class="s-vez">jogando agora</i>' : alvo ? ' · <i class="s-alvo">é o alvo</i>' : ''}</span></div>
      <div class="s-v ${dv < 0 ? 'baixou' : dv > 0 ? 'subiu' : ''}" title="Pontos de vida"><small>vida</small><span>${p.vida}</span>${dv ? `<i>${dv > 0 ? '+' : ''}${dv}</i>` : ''}</div>
    </div>
    <div class="s-stats">${stat('Mão', p.mao.length, 'Cartas na mão')}${stat('Grimório', p.lib, 'Cartas que faltam comprar')}${stat('Cemitério', p.gy, 'Cartas no cemitério')}${cmd ? stat('Comandante', cmdTxt, 'Onde está o comandante', 'cmdz') : ''}${p.cmdD.some(x => x) ? stat('Dano de comandante', Math.max(...p.cmdD) + '/21', 'Maior dano de um mesmo comandante; 21 elimina', Math.max(...p.cmdD) >= 15 ? 'perigo' : '') : ''}</div>
    ${zona('Terrenos', p.terr, p.terr ? (tap ? `${tap} virado${tap > 1 ? 's' : ''} · ${p.terr - tap} para usar` : 'todos para usar') + (p.terr > pvT ? ' · <i class="novo-t">+1 agora</i>' : '') : '', terrHTML ? `<div class="s-lands2">${terrHTML}</div>` : '<span class="vazio">nenhum ainda</span>', 'zn-terra')}
    ${zona('Criaturas', cri.length || null, cri.some(x => x.atk) ? '<i class="atk-t">atacando</i>' : '', `<div class="s-bf cri">${cri.map(x => carta(x.n, { tap: x.tap, atk: x.atk, cmd: x.c, tok: x.tok && !(x.i >= 0), p: x.p, t: x.t, novo: novo(x), an: x.an, ct: x.ct, cm: x.cm, bon: x.bp || x.bt ? 1 : 0, kw: x.kw, buff: buffDe(x), lac: lacDe(M, x) })).join('') || '<span class="vazio">nenhuma</span>'}</div>`)}
    ${out.length ? zona('Outras permanentes', out.length, 'artefatos, encantamentos…', `<div class="s-bf out">${out.map(x => carta(x.n, { tap: x.tap, tok: x.tok, novo: novo(x), cls: 'mini', solto: x.solto, an: x.an, lac: lacDe(M, x) })).join('')}</div>`) : ''}
    ${me && p.mao.length ? zona('Sua mão', p.mao.length, '', `<div class="s-mao">${p.mao.map((i, j) => `<span style="--r:${(j - (p.mao.length - 1) / 2) * 4}deg">${carta(nome(i), { cls: 'mao' })}</span>`).join('')}</div>`, 'zn-mao') : !me && p.mao.length ? `<div class="s-dorso" title="${p.mao.length} cartas na mão">${Array.from({ length: Math.min(p.mao.length, 10) }, (_, j) => `<i style="--r:${(j - (Math.min(p.mao.length, 10) - 1) / 2) * 5}deg"></i>`).join('')}</div>` : ''}
    ${gyL.length ? `<div class="s-gy"><em>Cemitério, mais recentes:</em> ${gyL.slice(0, 5).map(i => `<button class="cn" data-card="${esc(nome(i))}">${esc(nome(i))}</button>`).join('')}${p.gy > 5 ? `<span class="note">e mais ${p.gy - 5}</span>` : ''}</div>` : ''}
    ${!p.vivo ? '<div class="s-x">fora da partida</div>' : ''}
  </div>`;
}
// clique na imagem da mesa: abre grande (mesmo visual de ampliar do resto do site)
document.addEventListener('click', (/** @type {any} */ e) => {
  const im = e.target.closest('.arena img[data-big], .c-card img'); if (!im) return;
  e.preventDefault(); e.stopPropagation();
  const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<div class="zoom-box solo"><button class="btn small zoom-x">Fechar ✕</button><div class="zoom-img"><img src="${esc(im.dataset.big || im.src)}" alt="${esc(im.alt)}"></div></div>`;
  z.onclick = () => z.remove(); document.body.appendChild(z);
}, true);

// ---------- liga com o resto do Raio-X ----------
document.addEventListener('raiox:deck', (/** @type {any} */ e) => { A = e.detail; EU = null; RES = null; RTROCAS = null; RTERRA = null; JOGO = null; JG = null; parar(); painel(); painelVivo(); });
if (window.RAIOX && window.RAIOX.last) { A = window.RAIOX.last; painel(); painelVivo(); }
window.addEventListener('hashchange', () => { if (location.hash !== '#aovivo') parar(); else if (A) painelVivo(); });
pronto.then(() => { painel(); painelVivo(); });
export {};   // é módulo (escopo próprio), não script global
