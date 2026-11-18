/* Mesa simulada e Mesa ao vivo do Raio-X.
   O motor de jogo é o do Grimório Arena (Edgar): motor/engine.js e motor/mesa.js, rodando num Worker.
   Aqui ficam só os dados (cartas e oponentes), a interface e a leitura dos resultados. */
(function () {
'use strict';
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
let WK = null, WID = 0; const WP = new Map();
function roda(tipo, msg, prog) {
  if (!WK) {
    WK = new Worker('motor/worker.js?v=' + (window.RAIOX_V || '1'));
    WK.onmessage = (e) => { const p = WP.get(e.data.id); if (!p) return; if (e.data.prog) { if (p.prog) p.prog(e.data.prog.fase, e.data.prog.p); return; } WP.delete(e.data.id); e.data.erro ? p.rej(new Error(e.data.erro)) : p.res(e.data.r); };
    WK.onerror = (e) => { for (const [id, p] of WP) { p.rej(new Error(e.message || 'o motor parou')); WP.delete(id); } WK = null; };
  }
  const id = ++WID; return new Promise((res, rej) => { WP.set(id, { res, rej, prog }); WK.postMessage(Object.assign({ id, tipo }, msg)); });
}
function para() { if (WK) { WK.terminate(); WK = null; } for (const [id, p] of WP) { p.rej(new Error('parado')); WP.delete(id); } }

// ---------- seu deck e os oponentes ----------
let A = null, EU = null, OPC = new Map();
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
  // por padrão, todos menos o deck que tem o mesmo comandante que o seu
  return all.filter(o => (sel ? sel.includes(o.id) : o.nome !== meuCmd()));
}

// ---------- tela: Mesa simulada ----------
let RES = null, RTROCAS = null, BUSY = false;
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
  <div id="m-out" class="tout">${RES ? resultado() : ''}${RTROCAS ? resTrocas() : ''}</div>`;
  $('#m-fmt').onchange = (e) => { store.set('formato', e.target.value); painel(); };
  $('#m-n').onchange = (e) => store.set('n', +e.target.value);
  $('#m-go').onclick = () => guard(jogar);
  $('#m-tro').onclick = () => guard(testarTrocas);
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
  const r = await roda('trocas', { Dv: limpo(D), Ops, pares, N, seed: 20261119, nOp: nOp() }, (fase, p) => prog(p, `${fase}: ${Math.round(p * pares.length)} de ${pares.length}`));
  RTROCAS = { r, N };
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
  const { r, N } = RTROCAS;
  if (!r.length) return `<section class="panel"><h2>Teste das trocas</h2><p>Nenhuma das trocas marcadas pôde ser testada (as cartas não foram achadas no deck montado).</p></section>`;
  const verd = (t) => t.ok ? ['ajuda', 'good'] : t.d < -1.5 * t.se ? ['piora', 'bad'] : ['empate', 'info'];
  return `<section class="panel answer"><h2>Teste das trocas</h2>
    <p class="lead">Cada troca jogou ${N.toLocaleString('pt-BR')} partidas com as mesmas cartas sorteadas que a lista atual, então a diferença vem da troca e não da sorte. "Ajuda" só quando o ganho passa de 1,5 vez o ruído.</p>
    <div class="tw"><table><thead><tr><th>Sai</th><th>Entra</th><th>Vitórias</th><th>Ruído</th><th>Resultado</th></tr></thead><tbody>${r.map(t => { const [v, k] = verd(t); return `<tr><td><button class="cn" data-card="${esc(t.nomeS)}">${esc(t.nomeS)}</button></td><td><button class="cn" data-card="${esc(t.nomeE)}">${esc(t.nomeE)}</button></td><td class="n"><b>${pts(t.d)}</b> ponto${Math.abs(t.d) >= 2 ? 's' : ''}</td><td class="n">±${fx(t.se)}</td><td><span class="sev s${k === 'good' ? 1 : k === 'bad' ? 3 : 2}" style="background:var(--${k})">${v}</span></td></tr>`; }).join('')}</tbody></table></div>
    <p class="note">Uma troca que empata pode valer pelo conceito do deck ou pelo preço; uma que piora merece outra opção para entrar.</p></section>`;
}

// ---------- tela: Mesa ao vivo ----------
let JOGO = null, PASSO = 0, TIMER = null, NOMES = [];
const TP = { turno: '', terreno: '🜨', magia: '✦', remo: '✕', wipe: '☄', resp: '⟲', ataque: '⚔', bloqueio: '⛨', dano: '♥', morte: '☠', compra: '+', tutor: '⌕', combo: '∞', fim: '★' };
function painelVivo() {
  const box = $('#aovivo'); if (!box) return;
  if (!A) { box.innerHTML = ''; return; }
  const ops = listaOps(); const esc0 = store.get('vivoOps', null);
  const fmt = store.get('vivoFmt', '4'), vida = store.get('vivoVida', 40), nO = fmt === '1' ? 1 : 3;
  const def = selecionados().slice(0, nO).map(o => o.id);
  const sel = (esc0 && esc0.length === nO) ? esc0 : def;
  box.innerHTML = `<section class="panel">
    <h2>Mesa ao vivo</h2>
    <p class="lead">Uma partida jogada lance a lance pelo mesmo motor da Mesa simulada. Avance passo a passo ou deixe rodar, e clique em qualquer carta para ler.</p>
    <div class="row" style="gap:12px">
      <label class="field">Formato <select id="v-fmt"><option value="4" ${fmt === '4' ? 'selected' : ''}>Mesa de 4</option><option value="1" ${fmt === '1' ? 'selected' : ''}>1 contra 1</option></select></label>
      <label class="field">Vida <select id="v-vida">${[40, 30, 20].map(v => `<option ${+vida === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${Array.from({ length: nO }, (_, k) => `<label class="field">Oponente ${k + 1} <select data-vop="${k}">${ops.map(o => `<option value="${esc(o.id)}" ${sel[k] === o.id ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>`).join('')}
      <button class="btn" id="v-sort">Sortear oponentes</button>
      <button class="btn primary" id="v-go">Jogar uma partida</button>
    </div>
  </section>
  <div id="v-mesa">${JOGO ? mesaHTML() : ''}</div>`;
  $('#v-fmt').onchange = (e) => { store.set('vivoFmt', e.target.value); store.set('vivoOps', null); painelVivo(); };
  $('#v-vida').onchange = (e) => store.set('vivoVida', +e.target.value);
  $$('[data-vop]').forEach(s => s.onchange = () => store.set('vivoOps', $$('[data-vop]').map(x => x.value)));
  $('#v-sort').onclick = () => { const ids = ops.map(o => o.id).filter(id => id !== 'ex:' + meuCmd()); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } store.set('vivoOps', ids.slice(0, nO)); painelVivo(); };
  $('#v-go').onclick = jogaPartida;
  if (JOGO) ligaControles();
}
async function jogaPartida() {
  await pronto;
  const ops = listaOps(); const ids = $$('[data-vop]').map(x => x.value); store.set('vivoOps', ids);
  const Ops = ids.map(id => opDe(ops.find(o => o.id === id)));
  NOMES = ['Você (' + meuCmd() + ')', ...ids.map(id => ops.find(o => o.id === id).nome)];
  const b = $('#v-go'); b.disabled = true; b.textContent = 'Jogando…';
  try {
    const seed = (Math.random() * 4294967296) >>> 0;
    JOGO = await roda('partida', { Dv: limpo(meuDeck()), Ops, seed, T: 20, vida: +store.get('vivoVida', 40), nomes: NOMES });
    JOGO.Ms = [limpo(meuDeck()).M, ...Ops.map(o => o.M)];
    PASSO = 0; parar();
    $('#v-mesa').innerHTML = mesaHTML(); ligaControles(); vaiPara(0);
  } catch (e) { $('#v-mesa').innerHTML = `<div class="verdict v-bad">O motor falhou: ${esc(e.message).slice(0, 300)}</div>`; }
  b.disabled = false; b.textContent = 'Jogar outra partida';
}
function mesaHTML() {
  const n = JOGO.quadros[0].j.length;
  return `<section class="panel vivo">
    <div class="vctl">
      <button class="btn small" data-v="ini" title="Começo">⏮</button><button class="btn small" data-v="vt" title="Turno anterior">⏪</button><button class="btn small" data-v="ant" title="Lance anterior">◀</button>
      <button class="btn small primary" id="v-play">▶ Rodar</button>
      <button class="btn small" data-v="prox" title="Próximo lance">▶|</button><button class="btn small" data-v="pt" title="Próximo turno">⏩</button><button class="btn small" data-v="fim" title="Fim">⏭</button>
      <label class="field" style="margin:0">Velocidade <select id="v-vel"><option value="1400">devagar</option><option value="700" selected>normal</option><option value="300">rápido</option><option value="90">turbo</option></select></label>
      <input type="range" id="v-bar" min="0" max="${JOGO.quadros.length - 1}" value="0" aria-label="Momento da partida">
      <span class="note num" id="v-pos"></span>
    </div>
    <div class="vlance" id="v-lance"></div>
    <div class="vgrid n${n}" id="v-jog"></div>
    <details class="vlog"><summary>O que aconteceu neste turno</summary><ol id="v-log"></ol></details>
  </section>`;
}
function ligaControles() {
  const q = JOGO.quadros;
  const turnoDe = (i) => q[i].t;
  $$('[data-v]').forEach(b => b.onclick = () => {
    parar(); const v = b.dataset.v;
    if (v === 'ini') vaiPara(0); else if (v === 'fim') vaiPara(q.length - 1);
    else if (v === 'ant') vaiPara(PASSO - 1); else if (v === 'prox') vaiPara(PASSO + 1);
    else if (v === 'pt') { const t = turnoDe(PASSO); let i = PASSO; while (i < q.length - 1 && turnoDe(i) <= t) i++; vaiPara(i); }
    else if (v === 'vt') { const t = turnoDe(PASSO); let i = PASSO; while (i > 0 && turnoDe(i) >= t) i--; const t2 = turnoDe(i); while (i > 0 && turnoDe(i - 1) === t2) i--; vaiPara(i); }
  });
  $('#v-play').onclick = () => (TIMER ? parar() : rodar());
  $('#v-bar').oninput = (e) => { parar(); vaiPara(+e.target.value); };
}
function parar() { if (TIMER) { clearTimeout(TIMER); TIMER = null; } const b = $('#v-play'); if (b) b.textContent = '▶ Rodar'; }
function rodar() {
  const b = $('#v-play'); if (b) b.textContent = '❚❚ Pausar';
  const passo = () => {
    if (PASSO >= JOGO.quadros.length - 1) { parar(); return; }
    vaiPara(PASSO + 1); const e = JOGO.log[JOGO.quadros[PASSO].log - 1];
    const v = +($('#v-vel') || { value: 700 }).value;
    TIMER = setTimeout(passo, e && /turno|combo|wipe|morte|fim/.test(e.tp) ? v * 1.6 : v);
  };
  TIMER = setTimeout(passo, 10);
}
function vaiPara(i) {
  const q = JOGO.quadros; PASSO = Math.max(0, Math.min(q.length - 1, i));
  const Q = q[PASSO], ev = JOGO.log[Q.log - 1];
  $('#v-bar').value = PASSO;
  $('#v-pos').textContent = `Turno ${Q.t} · lance ${PASSO + 1} de ${q.length}`;
  $('#v-lance').innerHTML = ev ? `<span class="vt ${esc(ev.tp)}">${TP[ev.tp] || '•'}</span><span><b>${esc(NOMES[ev.k] || '')}</b> · ${esc(ev.txt)}</span>` : '<span class="note">Mãos compradas. A partida vai começar.</span>';
  $('#v-jog').innerHTML = Q.j.map((p, k) => jogadorHTML(p, k, ev)).join('');
  const ini = JOGO.log.findIndex(l => l.t === Q.t);
  $('#v-log').innerHTML = JOGO.log.slice(Math.max(0, ini), Q.log).map(l => `<li class="${l.tp}"><span class="vt ${esc(l.tp)}">${TP[l.tp] || '•'}</span> ${esc(l.txt)}</li>`).join('');
}
function jogadorHTML(p, k, ev) {
  const M = JOGO.Ms[k]; const vez = ev && ev.k === k; const alvo = ev && ev.a === k;
  const nome = (i) => (M[i] ? (M[i].frente || M[i].nome) : '?');
  const perm = p.perm.slice().sort((a, b) => (b.c - a.c) || ((b.p != null) - (a.p != null)));
  const cart = (x) => `<button class="vc ${x.c ? 'cmd' : ''} ${x.tok ? 'tok' : ''} ${x.tap ? 'tap' : ''} ${x.atk ? 'atk' : ''}" ${x.tok ? '' : `data-card="${esc(x.n)}"`}>${esc(x.n)}${x.p != null ? `<span class="pt">${x.p}/${x.t}</span>` : ''}</button>`;
  const terr = {}; p.tl.forEach(l => { const n = l.i != null ? nome(l.i) : 'Terreno'; terr[n] = (terr[n] || 0) + 1; });
  const tap = p.tl.filter(l => l.tap).length;
  return `<div class="vj ${vez ? 'vez' : ''} ${alvo ? 'alvo' : ''} ${p.vivo ? '' : 'morto'}">
    <div class="vj-h"><b>${esc(NOMES[k])}</b><span class="vida num" title="Vida">♥ ${p.vida}</span></div>
    <div class="vj-s note">Mão ${p.mao.length} · grimório ${p.lib} · cemitério ${p.gy}${p.zona ? ` · comandante na zona${p.tax ? ` (+${p.tax})` : ''}` : ''}${p.cmdD.some(x => x) ? ` · dano de comandante sofrido ${Math.max(...p.cmdD)}` : ''}</div>
    <div class="vj-t note">${p.terr} terreno${p.terr === 1 ? '' : 's'}${tap ? ` (${tap} virado${tap === 1 ? '' : 's'})` : ''}: ${Object.entries(terr).map(([n, q]) => esc(n) + (q > 1 ? ' ×' + q : '')).join(', ') || '—'}</div>
    <div class="vj-p">${perm.length ? perm.map(cart).join('') : '<span class="note">Nada em campo.</span>'}</div>
    ${k === 0 && p.mao.length ? `<details class="vj-m"><summary>Sua mão</summary><div class="vj-p">${p.mao.map(i => `<button class="vc" data-card="${esc(nome(i))}">${esc(nome(i))}</button>`).join('')}</div></details>` : ''}
    ${!p.vivo ? '<div class="vj-x">fora da partida</div>' : ''}
  </div>`;
}

// ---------- liga com o resto do Raio-X ----------
document.addEventListener('raiox:deck', (e) => { A = e.detail; EU = null; RES = null; RTROCAS = null; JOGO = null; parar(); painel(); painelVivo(); });
if (window.RAIOX && window.RAIOX.last) { A = window.RAIOX.last; painel(); painelVivo(); }
window.addEventListener('hashchange', () => { if (location.hash !== '#aovivo') parar(); });
pronto.then(() => { painel(); painelVivo(); });
})();
