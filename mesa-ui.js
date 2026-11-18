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
  const r = await roda('trocas', { Dv: limpo(D), Ops, pares, N, seed: 20261119, nOp: nOp() }, (fase, p) => prog(p, `${fase}: ${Math.round(100 * p)}%`));
  RTROCAS = { r, N };
  // a tela Trocas desenha os gráficos com este resultado (vale para este deck e estas trocas)
  window.RAIOX_TESTE = { deck: A, N, nOp: nOp(), base: r.base, todas: r.todas, pares: r.pares.map(t => ({ out: t.nomeS, inn: t.nomeE, d: t.d, se: t.se, ok: t.ok, wr: t.wr, cSai: t.cSai, cEntra: t.cEntra })), testadas: pares.map(p => p.nomeS + '→' + p.nomeE) };
  document.dispatchEvent(new CustomEvent('raiox:teste'));
  if (window.RAIOX_VOLTA === 'trocas') { window.RAIOX_VOLTA = null; setTimeout(() => { location.hash = 'trocas'; }, 400); }
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
let JOGO = null, PASSO = 0, TIMER = null, NOMES = [], PREV = null;
const TP = { turno: '⟳', terreno: '◆', magia: '✦', remo: '✕', wipe: '☄', resp: '⟲', ataque: '⚔', bloqueio: '⛨', dano: '♥', morte: '☠', compra: '+', tutor: '⌕', combo: '∞', fim: '★' };
const TPN = { turno: 'Novo turno', terreno: 'Terreno', magia: 'Mágica', remo: 'Remoção', wipe: 'Limpa-mesa', resp: 'Resposta', ataque: 'Ataque', bloqueio: 'Bloqueio', dano: 'Dano', morte: 'Morte', compra: 'Compra', tutor: 'Busca', combo: 'Combo', fim: 'Fim de jogo' };

// imagens do Scryfall: pede em lotes de 75 (endpoint /cards/collection) e guarda no navegador
const IMGS = new Map(Object.entries(store.get('img', {})));
const imgDe = (n) => IMGS.get(n) || IMGS.get(String(n).split(' // ')[0]) || null;
async function buscaImagens(nomes) {
  const falta = [...new Set(nomes)].filter(n => n && !imgDe(n) && !/\(carta vazia\)|não achada/.test(n));
  for (let i = 0; i < falta.length; i += 75) {
    const lote = falta.slice(i, i + 75);
    try {
      const r = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ identifiers: lote.map(n => ({ name: n.split(' // ')[0] })) }) });
      if (!r.ok) break;
      const j = await r.json();
      for (const c of j.data || []) {
        const iu = c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris); if (!iu) continue;
        const v = [iu.small, iu.normal, iu.art_crop]; IMGS.set(c.name, v); IMGS.set(c.name.split(' // ')[0], v);
      }
    } catch (e) { break; }
    await new Promise(r => setTimeout(r, 120));
  }
  try { const o = {}; let k = 0; for (const [n, v] of IMGS) { o[n] = v; if (++k > 4000) break; } store.set('img', o); } catch (e) {}
}

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
      <button class="btn" id="v-sort">Sortear oponentes</button>
      <button class="btn primary" id="v-go">${JOGO ? 'Jogar outra partida' : 'Jogar uma partida'}</button>
    </div>
  </section>
  <div id="v-mesa">${JOGO ? mesaHTML() : ''}</div>`;
  $('#v-fmt').onchange = (e) => { store.set('vivoFmt', e.target.value); store.set('vivoOps', null); painelVivo(); };
  $('#v-vida').onchange = (e) => store.set('vivoVida', +e.target.value);
  $$('[data-vop]').forEach(s => s.onchange = () => store.set('vivoOps', $$('[data-vop]').map(x => x.value)));
  $('#v-sort').onclick = () => { const ids = ops.map(o => o.id).filter(id => id !== 'ex:' + meuCmd()); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } store.set('vivoOps', ids.slice(0, nO)); painelVivo(); };
  $('#v-go').onclick = jogaPartida;
  if (JOGO) { ligaControles(); vaiPara(PASSO); }
}
async function jogaPartida() {
  await pronto;
  const ops = listaOps(); const ids = $$('[data-vop]').map(x => x.value); store.set('vivoOps', ids);
  const Ops = ids.map(id => opDe(ops.find(o => o.id === id)));
  NOMES = [meuCmd(), ...ids.map(id => ops.find(o => o.id === id).nome)];
  const b = $('#v-go'); b.disabled = true; b.textContent = 'Embaralhando…';
  try {
    const seed = (Math.random() * 4294967296) >>> 0;
    const Ms = [limpo(meuDeck()).M, ...Ops.map(o => o.M)];
    const jogo = roda('partida', { Dv: limpo(meuDeck()), Ops, seed, T: 20, vida: +store.get('vivoVida', 40), nomes: ['Você', ...ids.map(id => ops.find(o => o.id === id).nome)] });
    b.textContent = 'Buscando as cartas…';
    const imgs = buscaImagens(Ms.flatMap(M => M.map(m => m.nome)));
    JOGO = await jogo; JOGO.Ms = Ms; JOGO.cmdNome = Ms.map((M, k) => { const D = k ? Ops[k - 1] : limpo(meuDeck()); return D.cmd ? (M[D.cmd.i].frente || M[D.cmd.i].nome) : ''; });
    await Promise.race([imgs, new Promise(r => setTimeout(r, 6000))]);
    PASSO = 0; PREV = null; parar();
    $('#v-mesa').innerHTML = mesaHTML(); ligaControles(); vaiPara(0);
    $('#v-mesa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { $('#v-mesa').innerHTML = `<div class="verdict v-bad">O motor falhou: ${esc(e.message).slice(0, 300)}</div>`; }
  b.disabled = false; b.textContent = 'Jogar outra partida';
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
      <span class="vpos" id="v-pos"></span>
    </div>
    <div class="feltro">
      ${lugares.map((l, k) => `<div class="seat ${l}" id="seat-${k}" style="grid-area:${l}"></div>`).join('')}
      <div class="centro" id="v-centro" style="grid-area:center"></div>
    </div>
    <details class="vlog"><summary>O que aconteceu neste turno</summary><ol id="v-log"></ol></details>
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
}
function parar() { if (TIMER) { clearTimeout(TIMER); TIMER = null; } const b = $('#v-play'); if (b) b.textContent = '▶ Rodar'; }
function rodar() {
  const b = $('#v-play'); if (b) b.textContent = '❚❚ Pausar';
  const passo = () => {
    if (PASSO >= JOGO.quadros.length - 1) { parar(); return; }
    vaiPara(PASSO + 1); const e = JOGO.log[JOGO.quadros[PASSO].log - 1];
    const v = +($('#v-vel') || { value: 800 }).value;
    TIMER = setTimeout(passo, e && /turno|combo|wipe|morte|fim|ataque/.test(e.tp) ? v * 1.7 : v);
  };
  TIMER = setTimeout(passo, 10);
}

// uma carta na mesa: imagem do Scryfall; ficha sem imagem vira um cartão desenhado
function carta(nome, o = {}) {
  const im = o.tok ? null : imgDe(nome);
  const cls = ['mc', o.tap ? 'tap' : '', o.atk ? 'atk' : '', o.cmd ? 'cmd' : '', o.tok ? 'tok' : '', o.novo ? 'novo' : '', o.cls || ''].join(' ');
  const pt = o.p != null ? `<span class="mpt">${o.p}/${o.t}</span>` : '';
  const face = im ? `<img src="${esc(im[0])}" alt="${esc(nome)}" loading="lazy" data-big="${esc(im[1])}">` : `<span class="mtok"><b>${esc(nome)}</b>${o.tok ? '<i>ficha</i>' : ''}</span>`;
  return `<span class="mcw ${o.tap ? 'tap' : ''}"><button class="${cls}" ${o.tok ? '' : `data-card="${esc(nome)}"`} title="${esc(nome)}">${face}${pt}</button></span>`;
}
function vaiPara(i) {
  const q = JOGO.quadros; PASSO = Math.max(0, Math.min(q.length - 1, i));
  const Q = q[PASSO], ev = JOGO.log[Q.log - 1];
  $('#v-bar').value = PASSO;
  $('#v-pos').textContent = `Turno ${Q.t} · ${PASSO + 1}/${q.length}`;
  Q.j.forEach((p, k) => { const el = $('#seat-' + k); if (el) el.innerHTML = lugarHTML(p, k, ev, PREV && PREV.j[k]); });
  $('#v-centro').innerHTML = centroHTML(Q, ev);
  const ini = JOGO.log.findIndex(l => l.t === Q.t);
  $('#v-log').innerHTML = JOGO.log.slice(Math.max(0, ini), Q.log).map(l => `<li><span class="vt ${esc(l.tp)}">${TP[l.tp] || '•'}</span> ${esc(l.txt)}</li>`).join('');
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
  const M = JOGO.Ms[k]; const nome = (i) => (M[i] ? (M[i].frente || M[i].nome) : '?');
  const antes = new Set(pv ? pv.perm.map(x => x.n + '|' + x.i) : []);
  const cri = p.perm.filter(x => x.p != null).sort((a, b) => b.c - a.c || (b.p || 0) - (a.p || 0));
  const out = p.perm.filter(x => x.p == null);
  const novo = (x) => pv && !antes.has(x.n + '|' + x.i);
  const vez = ev && ev.k === k, alvo = ev && ev.a === k && ev.k !== k;
  const dv = pv ? p.vida - pv.vida : 0;
  const cmd = JOGO.cmdNome[k]; const cmdIm = cmd ? imgDe(cmd) : null;
  // terrenos por cor, com quantos estão virados
  const cores = {}; let tap = 0;
  p.tl.forEach(l => { if (l.tap) tap++; const m = l.i != null ? M[l.i] : null; const c = (m && m.cor) || ''; const key = c.length > 1 ? 'multi' : c || 'C'; cores[key] = (cores[key] || 0) + 1; });
  const pip = (c) => c === 'multi' ? '<span class="ms multi"></span>' : `<span class="ms ${c === 'C' ? '' : c}">${c === 'C' ? '◇' : ''}</span>`;
  const me = k === 0;
  return `<div class="seat-in ${vez ? 'vez' : ''} ${alvo ? 'alvo' : ''} ${p.vivo ? '' : 'morto'}">
    <div class="s-h">
      <button class="s-av" ${cmd ? `data-card="${esc(cmd)}"` : ''} style="${cmdIm ? `background-image:url('${esc(cmdIm[2])}')` : ''}" title="${esc(cmd)}"></button>
      <div class="s-n"><b>${esc(me ? 'Você' : NOMES[k])}</b><span>${esc(me ? cmd : (cmd && cmd !== NOMES[k] ? cmd : 'Oponente ' + k))}</span></div>
      <div class="s-v ${dv < 0 ? 'baixou' : dv > 0 ? 'subiu' : ''}"><span>${p.vida}</span>${dv ? `<i>${dv > 0 ? '+' : ''}${dv}</i>` : ''}</div>
    </div>
    <div class="s-st"><span title="Cartas na mão">✋ ${p.mao.length}</span><span title="Grimório">▤ ${p.lib}</span><span title="Cemitério">⚰ ${p.gy}</span>${p.zona ? `<span class="z" title="Comandante na zona de comando">⬢ comandante na zona${p.tax ? ' +' + p.tax : ''}</span>` : ''}${p.cmdD.some(x => x) ? `<span title="Maior dano de comandante sofrido">⚔ ${Math.max(...p.cmdD)}/21</span>` : ''}</div>
    <div class="s-lands" title="${tap} de ${p.terr} terrenos virados">${Object.entries(cores).map(([c, q]) => `<span class="lp">${pip(c)}<b>${q}</b></span>`).join('') || '<span class="note">sem terrenos</span>'}${p.terr ? `<span class="note">${tap ? tap + ' virado' + (tap > 1 ? 's' : '') : 'todos desvirados'}</span>` : ''}</div>
    <div class="s-bf cri">${cri.map(x => carta(x.n, { tap: x.tap, atk: x.atk, cmd: x.c, tok: x.tok, p: x.p, t: x.t, novo: novo(x) })).join('') || '<span class="vazio">sem criaturas</span>'}</div>
    ${out.length ? `<div class="s-bf out">${out.map(x => carta(x.n, { tap: x.tap, tok: x.tok, novo: novo(x), cls: 'mini' })).join('')}</div>` : ''}
    ${me && p.mao.length ? `<div class="s-mao">${p.mao.map((i, j) => `<span style="--r:${(j - (p.mao.length - 1) / 2) * 4}deg">${carta(nome(i), { cls: 'mao' })}</span>`).join('')}</div>` : !me && p.mao.length ? `<div class="s-dorso">${Array.from({ length: Math.min(p.mao.length, 10) }, (_, j) => `<i style="--r:${(j - (Math.min(p.mao.length, 10) - 1) / 2) * 5}deg"></i>`).join('')}</div>` : ''}
    ${!p.vivo ? '<div class="s-x">fora da partida</div>' : ''}
  </div>`;
}
// clique na imagem da mesa: abre grande (mesmo visual de ampliar do resto do site)
document.addEventListener('click', (e) => {
  const im = e.target.closest('.arena img[data-big], .c-card img'); if (!im) return;
  e.preventDefault(); e.stopPropagation();
  const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<div class="zoom-box solo"><button class="btn small zoom-x">Fechar ✕</button><div class="zoom-img"><img src="${esc(im.dataset.big || im.src)}" alt="${esc(im.alt)}"></div></div>`;
  z.onclick = () => z.remove(); document.body.appendChild(z);
}, true);

// ---------- liga com o resto do Raio-X ----------
document.addEventListener('raiox:deck', (e) => { A = e.detail; EU = null; RES = null; RTROCAS = null; JOGO = null; parar(); painel(); painelVivo(); });
if (window.RAIOX && window.RAIOX.last) { A = window.RAIOX.last; painel(); painelVivo(); }
window.addEventListener('hashchange', () => { if (location.hash !== '#aovivo') parar(); });
pronto.then(() => { painel(); painelVivo(); });
})();
