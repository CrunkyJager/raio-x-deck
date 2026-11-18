/* Raio-X do Deck: aba Montar — construtor de decks com busca na base, análise ao vivo e ida e volta com o Moxfield. */
(function () {
'use strict';
const R = window.RAIOX; if (!R) return;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { C, norm, rolesOf, isLand, canBeCommander, brl, manaHTML, ROLES, DB } = R;

// ---------- decks salvos (localStorage) ----------
const KEY = 'raiox:montar';
let S = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })() || { atual: null, decks: {} };
const salva = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const novoId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function novoDeck(nome) { const id = novoId(); S.decks[id] = { nome: nome || 'Deck novo', cmds: [], cartas: {}, alvo: { br: '', teto: '' }, t: Date.now() }; S.atual = id; salva(); return S.decks[id]; }
const D = () => S.decks[S.atual] || novoDeck();
const toque = () => { D().t = Date.now(); salva(); };

// ---------- regras de cópia e identidade ----------
const isBasic = (c) => /Basic/.test(c.t) && isLand(c);
const multiOk = (c) => isBasic(c) || R.ANY_NUMBER.test(c.o || '');
const ident = () => new Set(D().cmds.map(n => (C(n) || {}).ci || '').join('').split('').filter(Boolean));
const cabeCor = (c, I) => (c.ci || '').split('').every(x => !x || I.has(x));
const temPar = (c) => /Partner|Choose a Background|Friends forever|Doctor's companion/.test(c.o || '') || /Background/.test(c.t);
const total = () => D().cmds.length + Object.values(D().cartas).reduce((s, q) => s + q, 0);

// ---------- índice leve para a busca ----------
let IX = null;
function indice() {
  if (IX) return IX;
  const F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
  const pt = {}; for (const [k, en] of Object.entries(R.PTIDX || {})) (pt[en] = pt[en] || []).push(k);
  IX = Object.keys(DB.cards).map(n => { const e = DB.cards[n]; return { n, k: norm(n), pt: (pt[n] || []).join(' '), t: e[F.t], ci: e[F.ci], v: e[F.v], r: e[F.r] || 1e6, ban: !!e[F.ban] }; });
  return IX;
}
const ROLEC = new Map();
const papeis = (n) => { if (!ROLEC.has(n)) ROLEC.set(n, rolesOf(C(n))); return ROLEC.get(n); };
const TIPOS = [['', 'Todos os tipos'], ['Creature', 'Criatura'], ['Instant', 'Instantânea'], ['Sorcery', 'Feitiço'], ['Artifact', 'Artefato'], ['Enchantment', 'Encantamento'], ['Planeswalker', 'Planeswalker'], ['Land', 'Terreno'], ['Battle', 'Batalha']];
const GRUPOS = [['Creature', 'Criaturas'], ['Planeswalker', 'Planeswalkers'], ['Instant', 'Instantâneas'], ['Sorcery', 'Feitiços'], ['Artifact', 'Artefatos'], ['Enchantment', 'Encantamentos'], ['Battle', 'Batalhas'], ['Land', 'Terrenos']];
const grupoDe = (c) => { const f = c.t.split(' // ')[0]; if (/Land/.test(f)) return 'Land'; for (const [k] of GRUPOS) if (new RegExp(k).test(f)) return k; return 'Artifact'; };
let Q = { txt: '', tipo: '', papel: '', cmc: '', cor: '', cmd: false, pag: 40 };

function busca() {
  const I = ident(), modoCmd = !D().cmds.length || Q.cmd;
  const q = norm(Q.txt), deck = D();
  const out = [];
  for (const x of indice()) {
    if (x.ban) continue;
    if (q && !x.k.includes(q) && !(x.pt && x.pt.includes(q))) continue;
    const f = x.t.split(' // ')[0];
    if (modoCmd) { const c = C(x.n); if (!canBeCommander(c)) continue; if (Q.cmd && deck.cmds.length && !(temPar(c) || /Background/.test(c.t))) continue; if (deck.cmds.includes(x.n)) continue; }
    else {
      if (!(x.ci || '').split('').every(c => !c || I.has(c))) continue;
      if (Q.tipo && !new RegExp(Q.tipo).test(f)) continue;
      if (Q.cmc !== '' && (Q.cmc === '7' ? x.v < 7 : Math.floor(x.v) !== +Q.cmc)) continue;
      if (Q.cor && (Q.cor === 'C' ? x.ci : !x.ci.includes(Q.cor))) continue;
      if (deck.cmds.includes(x.n)) continue;
    }
    out.push(x);
  }
  out.sort((a, b) => (q ? (b.k.startsWith(q) - a.k.startsWith(q)) : 0) || a.r - b.r);
  let res = out;
  if (!modoCmd && Q.papel) { res = []; for (const x of out) { if (papeis(x.n).has(Q.papel)) res.push(x); if (res.length >= Q.pag + 1) break; } }
  return { lista: res.slice(0, Q.pag), mais: res.length > Q.pag, modoCmd };
}

// ---------- texto do deck (formato que o Moxfield, o Archidekt e a aba Lista entendem) ----------
function texto(d = D()) {
  const linhas = [];
  if (d.cmds.length) linhas.push('Commander', ...d.cmds.map(n => '1 ' + n), '', 'Deck');
  for (const [n, q] of Object.entries(d.cartas).sort((a, b) => a[0].localeCompare(b[0]))) linhas.push(q + ' ' + n);
  return linhas.join('\n');
}
function deTexto(txt, nome) {
  const p = R.parseList(txt); if (!p.cards.length) return { erro: 'Não reconheci nenhuma carta.' + (p.unknown.length ? ' Exemplos do que não achei: ' + p.unknown.slice(0, 5).join(', ') : '') };
  const cmds = R.guessCommanders(p);
  const cartas = {}; const resto = p.cards.slice(); for (const c of cmds) { const i = resto.indexOf(c); if (i >= 0) resto.splice(i, 1); }
  for (const n of resto) cartas[n] = (cartas[n] || 0) + 1;
  const d = novoDeck(nome || (cmds[0] ? cmds[0].split(',')[0] : 'Deck importado')); d.cmds = cmds; d.cartas = cartas; salva();
  return { d, unknown: p.unknown };
}

// ---------- análise ao vivo ----------
let A = null;
function analisa() { const d = D(); A = (d.cmds.length && total() > d.cmds.length) ? R.analyze(texto(d), d.cmds) : null; if (A && A.empty) A = null; }
const LIM_GC = { 2: 0, 3: 3 };

// ---------- desenho ----------
const ROOT = () => $('#montar');
const cardBtn = (n) => `<button class="cn" data-card="${esc(n)}">${esc(n)}</button>`;
function painelTopo() {
  const ids = Object.keys(S.decks).sort((a, b) => S.decks[b].t - S.decks[a].t);
  return `<section class="panel mt-topo"><h2>Montar deck</h2>
    <p class="lead">Escolha o comandante, busque as cartas e acompanhe a curva, as funções, o bracket e o preço enquanto monta. Os decks ficam salvos neste navegador. Para levar ao Moxfield, use <b>Copiar para o Moxfield</b>.</p>
    <div class="mt-decks">
      <label class="mt-campo"><span>Deck</span><select id="mt-sel">${ids.map(id => `<option value="${id}" ${id === S.atual ? 'selected' : ''}>${esc(S.decks[id].nome)} · ${contar(S.decks[id])}/100</option>`).join('')}</select></label>
      <label class="mt-campo mt-nome"><span>Nome</span><input class="txt" id="mt-nome" value="${esc(D().nome)}" maxlength="60"></label>
      <div class="row mt-acoes"><button class="btn" id="mt-novo">Novo deck</button><button class="btn" id="mt-dup">Duplicar</button><button class="btn" id="mt-del">Apagar</button></div>
    </div>
    <details class="mt-imp" id="mt-imp"><summary>Importar um deck (Moxfield, Archidekt, aba Lista)</summary>
      <div class="mt-imp-g">
        <div><h3>Do Moxfield (ou qualquer site)</h3><p class="note">No Moxfield: abra o deck → <b>More</b> → <b>Export</b> → copie o texto (Plain Text ou MTGO) e cole aqui.</p>
          <textarea id="mt-imp-txt" spellcheck="false" placeholder="1 Sol Ring&#10;1 Command Tower&#10;…"></textarea>
          <div class="row"><button class="btn primary" id="mt-imp-ok">Importar texto</button></div></div>
        <div><h3>Por link do Archidekt</h3><p class="note">Cole o endereço do deck (archidekt.com/decks/123456/…). O deck precisa ser público. Link do Moxfield não funciona fora do site deles: use o texto ao lado.</p>
          <input class="txt" id="mt-imp-url" placeholder="https://archidekt.com/decks/…" style="width:100%">
          <div class="row"><button class="btn" id="mt-imp-arch">Importar do Archidekt</button></div>
          <h3 style="margin-top:18px">Da aba Lista</h3><p class="note">Traz o deck que está na aba Lista agora.</p>
          <div class="row"><button class="btn" id="mt-imp-lista">Trazer da Lista</button></div></div>
      </div>
      <p class="note" id="mt-imp-msg" role="status"></p>
    </details>
  </section>`;
}
const contar = (d) => d.cmds.length + Object.values(d.cartas).reduce((s, q) => s + q, 0);

function painelBusca() {
  const d = D(), I = ident(), r = busca();
  const cores = [...I];
  const titulo = r.modoCmd ? (d.cmds.length ? 'Segundo comandante (parceiro ou antecedente)' : '1. Escolha o comandante') : 'Buscar cartas';
  const filtros = r.modoCmd ? '' : `<div class="mt-filtros">
      <select id="mt-tipo" aria-label="Tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${Q.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="mt-papel" aria-label="Função"><option value="">Todas as funções</option>${ROLES.filter(x => x.k !== 'body' && x.k !== 'enabler').map(x => `<option value="${x.k}" ${Q.papel === x.k ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select>
      <select id="mt-cmc" aria-label="Custo"><option value="">Qualquer custo</option>${[0, 1, 2, 3, 4, 5, 6, 7].map(v => `<option value="${v}" ${Q.cmc === String(v) ? 'selected' : ''}>Custo ${v}${v === 7 ? '+' : ''}</option>`).join('')}</select>
      <span class="mt-cores">${['', ...cores, 'C'].map(x => `<button class="mt-cor ${Q.cor === x ? 'on' : ''}" data-cor="${x}" title="${x === '' ? 'Todas as cores' : x === 'C' ? 'Incolor' : 'Tem ' + x}">${x === '' ? 'todas' : x === 'C' ? '<span class="ms">C</span>' : `<span class="ms ${x}"></span>`}</button>`).join('')}</span>
    </div>`;
  const linhas = r.lista.map(x => {
    const c = C(x.n); const q = d.cartas[x.n] || 0;
    const ps = r.modoCmd ? [] : [...papeis(x.n)].filter(k => k !== 'body' && k !== 'enabler').slice(0, 2).map(k => (ROLES.find(o => o.k === k) || {}).n).filter(Boolean);
    const bloq = !r.modoCmd && q && !multiOk(c);
    return `<div class="mt-res ${q ? 'tem' : ''}"><span class="mt-mana">${manaHTML(c.m)}</span><span class="mt-rn">${cardBtn(x.n)}<small>${esc(c.t.split(' // ')[0])}${ps.length ? ' · ' + ps.map(esc).join(', ') : ''}${c.gc ? ' · <b class="mt-gc">game changer</b>' : ''}</small></span><span class="mt-pr">${c.usd ? brl(c.usd, c.usd < 10) : '—'}</span>
      ${r.modoCmd ? `<button class="btn small primary" data-cmd="${esc(x.n)}">Escolher</button>` : `<button class="btn small ${bloq ? '' : 'primary'}" data-add="${esc(x.n)}" ${bloq ? 'disabled title="Já está no deck (só 1 de cada)"' : ''}>${q ? (bloq ? 'no deck' : '+1 (' + q + ')') : '+ pôr'}</button>`}</div>`;
  }).join('');
  const basicos = r.modoCmd ? '' : `<div class="mt-bas"><span class="note">Terrenos básicos:</span>${(cores.length ? cores : ['C']).map(x => { const n = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest', C: 'Wastes' }[x]; return `<button class="btn small" data-add="${n}"><span class="ms ${x === 'C' ? '' : x}">${x === 'C' ? 'C' : ''}</span> +1 ${n}${d.cartas[n] ? ` (${d.cartas[n]})` : ''}</button>`; }).join('')}</div>`;
  return `<section class="panel mt-busca"><h2>${titulo}</h2>
    ${d.cmds.length && !Q.cmd ? `<p class="note">Só aparecem cartas dentro da identidade de cor do comandante e fora da lista de banidas. Clique no nome para ver a carta.</p>` : `<p class="note">${d.cmds.length ? 'Só comandantes que aceitam parceiro.' : 'O comandante trava as cores do deck: depois só aparecem cartas que cabem nele.'} Busque em inglês${Object.keys(R.PTIDX || {}).length ? ' ou português' : ''}.</p>`}
    <input class="txt mt-q" id="mt-q" type="search" placeholder="${r.modoCmd ? 'Nome do comandante…' : 'Nome da carta…'}" value="${esc(Q.txt)}" autocomplete="off">
    ${filtros}${basicos}
    <div class="mt-lista" id="mt-lista">${linhas || '<p class="note">Nada encontrado com esses filtros.</p>'}</div>
    ${r.mais ? '<div class="row"><button class="btn" id="mt-mais">Mostrar mais</button></div>' : ''}
    ${Q.cmd ? '<div class="row"><button class="btn" id="mt-cmd-x">Voltar para as cartas</button></div>' : ''}
  </section>`;
}

function painelDeck() {
  const d = D(), n = total();
  if (!d.cmds.length) return `<section class="panel mt-deck"><h2>O deck</h2><p class="note">Escolha o comandante ao lado para começar. Ou importe um deck pronto em <b>Importar um deck</b>, acima.</p></section>`;
  const grupos = {}; for (const [nm, q] of Object.entries(d.cartas)) { const c = C(nm); if (!c) continue; (grupos[grupoDe(c)] = grupos[grupoDe(c)] || []).push([c, q]); }
  const linha = (c, q) => `<div class="mt-li"><span class="mt-q2">${q}</span><span class="mt-mana">${manaHTML(c.m)}</span>${cardBtn(c.name)}<span class="mt-pr">${c.usd ? brl(c.usd * q, c.usd * q < 10) : ''}</span><span class="mt-bt"><button class="mt-mm" data-sub="${esc(c.name)}" aria-label="Tirar uma">−</button>${multiOk(c) ? `<button class="mt-mm" data-add="${esc(c.name)}" aria-label="Pôr mais uma">+</button>` : ''}</span></div>`;
  const cor = n === 100 ? 'ok' : n > 100 ? 'mais' : '';
  return `<section class="panel mt-deck"><h2>O deck</h2>
    <div class="mt-cont ${cor}"><b>${n}</b><span>/100 cartas</span><div class="prog"><div style="width:${Math.min(100, n)}%"></div></div><small>${n === 100 ? 'Completo.' : n < 100 ? `Faltam ${100 - n}.` : `Sobram ${n - 100}: tire ${n - 100}.`}</small></div>
    <div class="mt-cmds"><span class="k">Comandante${d.cmds.length > 1 ? 's' : ''}</span>${d.cmds.map(x => `<div class="mt-li mt-cmd"><span class="mt-mana">${manaHTML(C(x).m)}</span>${cardBtn(x)}<span class="mt-bt"><button class="mt-mm" data-uncmd="${esc(x)}" aria-label="Trocar comandante">✕</button></span></div>`).join('')}
      ${d.cmds.length === 1 && temPar(C(d.cmds[0])) ? '<button class="btn small" id="mt-cmd2">+ segundo comandante</button>' : ''}</div>
    ${GRUPOS.filter(([k]) => grupos[k]).map(([k, nome]) => { const g = grupos[k].sort((a, b) => a[0].v - b[0].v || a[0].name.localeCompare(b[0].name)); return `<div class="mt-g"><h3>${nome} <span class="note">${g.reduce((s, [, q]) => s + q, 0)}</span></h3>${g.map(([c, q]) => linha(c, q)).join('')}</div>`; }).join('')}
    <div class="row mt-fim">${n > d.cmds.length ? '<button class="btn small" id="mt-limpa">Esvaziar o deck</button>' : ''}</div>
  </section>`;
}

function painelAnalise() {
  const d = D(); if (!A) return '';
  const alvoBr = +d.alvo.br || 0, teto = parseFloat(String(d.alvo.teto || '').replace(',', '.')) || 0;
  const usdBrl = R.usd || 5.56;
  const reais = A.price * usdBrl;
  const gcLim = LIM_GC[alvoBr];
  const avisos = [];
  if (alvoBr && A.bracket > alvoBr) avisos.push(`O deck está no bracket ${A.bracket}, acima do ${alvoBr} que você quer${A.bracketWhy.length ? ': ' + A.bracketWhy.join(', ') : ''}.`);
  if (gcLim != null && A.gc.length > gcLim) avisos.push(`${A.gc.length} game changer${A.gc.length > 1 ? 's' : ''} (${A.gc.join(', ')}); o bracket ${alvoBr} aceita ${gcLim}.`);
  if (teto && reais > teto) avisos.push(`Passou do orçamento: ${R.brlTxt(A.price)} de ${R.brlTxt(teto / usdBrl)}.`);
  const regra = A.issues.filter(i => i.sev === 3 && !/exatamente 100/.test(i.t));
  const reguas = A.refs.map(r => {
    const max = Math.max(r.hi * 1.35, r.have) + 1, x = (v) => (100 * v / max).toFixed(1) + '%';
    const dentro = r.have >= r.lo && r.have <= r.hi, falta = r.have < r.lo;
    const papel = r.k === 'lands' ? '' : r.k;
    return `<div class="rg"><span class="rg-n">${esc(r.n)}</span><span class="rg-t" title="Faixa comum: ${r.lo}–${r.hi}"><span class="rg-band" style="left:${x(r.lo)};width:calc(${x(r.hi)} - ${x(r.lo)})"></span><i class="rg-dep ${dentro ? '' : 'ruim'}" style="left:${x(r.have)}"></i></span><span class="rg-v">${r.have % 1 ? r.have.toFixed(1) : r.have} <small>/ ${r.lo}–${r.hi}</small>${falta ? ` <button class="btn small" data-papel="${papel}" data-tipo="${r.k === 'lands' ? 'Land' : ''}">buscar</button>` : ''}</span></div>`;
  }).join('');
  const cmax = Math.max(1, ...A.curve);
  const curva = A.curve.map((q, v) => `<div class="col" title="Custo ${v}${v === 7 ? '+' : ''}: ${q}"><span class="col-q">${q}</span><span class="col-b"><i class="dep" style="height:${(100 * q / cmax).toFixed(1)}%"></i></span><span class="col-l">${v}${v === 7 ? '+' : ''}</span></div>`).join('');
  return `<section class="panel mt-ana"><h2>Como o deck está</h2>
    <div class="stats mt-stats">
      <div class="stat price"><span class="k">Preço do deck</span><b>${brl(A.price)}</b><small>${teto ? `orçamento ${R.brlTxt(teto / usdBrl)}` : 'sem orçamento definido'}</small></div>
      <div class="stat"><span class="k">Bracket</span><b>${A.bracket}</b><small>${alvoBr ? 'quer ' + alvoBr : 'estimado'}</small></div>
      <div class="stat"><span class="k">Game changers</span><b>${A.gc.length}</b><small>${gcLim != null ? 'limite ' + gcLim : '—'}</small></div>
      <div class="stat"><span class="k">Custo médio</span><b>${A.avgMV.toFixed(2).replace('.', ',')}</b><small>${A.lands} terrenos</small></div>
    </div>
    <div class="mt-alvo"><label class="mt-campo"><span>Bracket que você quer</span><select id="mt-br"><option value="">Qualquer</option>${[2, 3, 4].map(b => `<option value="${b}" ${alvoBr === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="mt-campo"><span>Orçamento do deck (R$)</span><input class="txt" id="mt-teto" inputmode="decimal" value="${esc(d.alvo.teto || '')}" placeholder="ex.: 800"></label></div>
    ${avisos.length || regra.length ? `<ul class="mt-av">${regra.map(i => `<li class="ruim">${esc(i.t)}</li>`).join('')}${avisos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="graf2">
      <div class="gbox"><h3>Funções</h3><p class="note">A faixa clara é o normal para Commander. <b>buscar</b> filtra a busca pela função que falta.</p><div class="reguas">${reguas}</div></div>
      <div class="gbox"><h3>Curva de mana</h3><p class="note">Cartas que não são terreno, por custo.</p><div class="curva2">${curva}</div></div>
    </div>
  </section>`;
}

function painelSaida() {
  const d = D(); if (!d.cmds.length) return '';
  return `<section class="panel mt-saida"><h2>Levar o deck</h2>
    <div class="mt-sai-g">
      <div><h3>Moxfield</h3><p class="note">Copia a lista no formato que o Moxfield importa (comandante em cima). Lá: <b>Create Deck</b> → <b>Import</b> → colar.</p>
        <div class="row"><button class="btn primary" id="mt-copia">Copiar para o Moxfield</button><a class="btn" href="https://moxfield.com/decks/personal" target="_blank" rel="noopener">Abrir o Moxfield</a><button class="btn" id="mt-baixa">Baixar .txt</button></div></div>
      <div><h3>Aqui no Raio-X</h3><p class="note">Manda o deck para a análise completa (trocas sugeridas, plano) ou para a mesa, como deck de amigo.</p>
        <div class="row"><button class="btn primary" id="mt-analisa">Analisar no Raio-X</button><button class="btn" id="mt-mesa">Jogar na Mesa</button></div></div>
    </div>
    <p class="note" id="mt-msg" role="status"></p>
  </section>`;
}

function desenha(soBusca) {
  const root = ROOT(); if (!root) return;
  if (soBusca) { const y = window.scrollY; const b = $('.mt-busca', root); if (b) { const foco = document.activeElement && document.activeElement.id; const pos = foco === 'mt-q' ? document.activeElement.selectionStart : null; b.outerHTML = painelBusca(); liga(); if (foco) { const el = $('#' + foco); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } } window.scrollTo(0, y); return; } }
  analisa();
  root.innerHTML = painelTopo() + `<div class="mt-grade">${painelBusca()}${painelDeck()}</div>` + painelAnalise() + painelSaida();
  liga();
}
// redesenha tudo, sem perder o lugar da tela nem o campo de busca
function atualiza() { const y = window.scrollY; const lista = $('#mt-lista'); const ly = lista ? lista.scrollTop : 0; const foco = document.activeElement && document.activeElement.id; desenha(); window.scrollTo(0, y); const l2 = $('#mt-lista'); if (l2) l2.scrollTop = ly; if (foco === 'mt-q') $('#mt-q').focus(); }

const msg = (t, id = 'mt-msg') => { const el = $('#' + id); if (el) el.textContent = t; };
function poe(n) {
  const c = C(n); if (!c) return; const d = D();
  if (d.cartas[n] && !multiOk(c)) return;
  d.cartas[n] = (d.cartas[n] || 0) + 1; toque(); atualiza();
}
let BT = null;
function liga() {
  const root = ROOT(), d = D();
  $('#mt-sel').onchange = (e) => { S.atual = e.target.value; salva(); Q.cmd = false; desenha(); };
  $('#mt-nome').onchange = (e) => { d.nome = e.target.value.trim() || 'Deck sem nome'; toque(); desenha(); };
  $('#mt-novo').onclick = () => { novoDeck(); Q = { ...Q, txt: '', cmd: false }; desenha(); $('#mt-q') && $('#mt-q').focus(); };
  $('#mt-dup').onclick = () => { const o = D(); const n = novoDeck(o.nome + ' (cópia)'); n.cmds = o.cmds.slice(); n.cartas = { ...o.cartas }; n.alvo = { ...o.alvo }; salva(); desenha(); };
  $('#mt-del').onclick = () => { if (!confirmar('Apagar o deck "' + d.nome + '"?')) return; delete S.decks[S.atual]; S.atual = Object.keys(S.decks).sort((a, b) => S.decks[b].t - S.decks[a].t)[0] || null; if (!S.atual) novoDeck(); salva(); desenha(); };
  // importar
  $('#mt-imp-ok').onclick = () => { const r = deTexto($('#mt-imp-txt').value); if (r.erro) { msg(r.erro, 'mt-imp-msg'); return; } desenha(); msg(`Importado: ${contar(r.d)} cartas${r.unknown.length ? `. Não reconheci ${r.unknown.length}: ${r.unknown.slice(0, 6).join(', ')}` : ''}.`, 'mt-imp-msg'); $('#mt-imp').open = true; };
  $('#mt-imp-lista').onclick = () => { const t = ($('#deck-in') || {}).value || ''; const r = deTexto(t, 'Da aba Lista'); if (r.erro) { msg('A aba Lista está vazia. ' + r.erro, 'mt-imp-msg'); return; } desenha(); msg(`Trazido da Lista: ${contar(r.d)} cartas.`, 'mt-imp-msg'); $('#mt-imp').open = true; };
  $('#mt-imp-arch').onclick = () => archidekt($('#mt-imp-url').value);
  // busca
  const q = $('#mt-q'); if (q) q.oninput = () => { Q.txt = q.value; Q.pag = 40; clearTimeout(BT); BT = setTimeout(() => desenha(true), 140); };
  [['#mt-tipo', 'tipo'], ['#mt-papel', 'papel'], ['#mt-cmc', 'cmc']].forEach(([s, k]) => { const el = $(s); if (el) el.onchange = () => { Q[k] = el.value; Q.pag = 40; desenha(true); }; });
  $$('[data-cor]', root).forEach(b => b.onclick = () => { Q.cor = b.dataset.cor; Q.pag = 40; desenha(true); });
  const mais = $('#mt-mais'); if (mais) mais.onclick = () => { Q.pag += 40; desenha(true); };
  const cx = $('#mt-cmd-x'); if (cx) cx.onclick = () => { Q.cmd = false; Q.txt = ''; desenha(); };
  const c2 = $('#mt-cmd2'); if (c2) c2.onclick = () => { Q.cmd = true; Q.txt = ''; desenha(); $('#mt-q').focus(); };
  const lp = $('#mt-limpa'); if (lp) lp.onclick = () => { if (!confirmar('Tirar todas as cartas (o comandante fica)?')) return; d.cartas = {}; toque(); atualiza(); };
  // análise
  const br = $('#mt-br'); if (br) br.onchange = () => { d.alvo.br = br.value; toque(); atualiza(); };
  const tt = $('#mt-teto'); if (tt) tt.onchange = () => { d.alvo.teto = tt.value.trim(); toque(); atualiza(); };
  $$('[data-papel]', root).forEach(b => b.onclick = () => { Q = { ...Q, txt: '', papel: b.dataset.papel, tipo: b.dataset.tipo, cmc: '', cor: '', cmd: false, pag: 40 }; desenha(); const s = $('.mt-busca'); if (s) window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 90); });
  // saída
  const cp = $('#mt-copia'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(texto()); msg('Lista copiada. No Moxfield: Create Deck → Import → colar.'); } catch (e) { msg('Não deu para copiar daqui. Use "Baixar .txt".'); } };
  const bx = $('#mt-baixa'); if (bx) bx.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto()], { type: 'text/plain' })); a.download = (d.nome || 'deck').replace(/[^\w\- ]+/g, '').trim() + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const an = $('#mt-analisa'); if (an) an.onclick = () => { $('#deck-in').value = texto(); R.run(d.cmds.slice(), 'resumo'); };
  const ms = $('#mt-mesa'); if (ms) ms.onclick = () => {
    try { const k = 'raiox:amigos'; const am = JSON.parse(localStorage.getItem(k) || '[]').filter(a => a.nome !== d.nome); am.push({ nome: d.nome, lista: texto() }); localStorage.setItem(k, JSON.stringify(am)); } catch (e) {}
    msg(`"${d.nome}" entrou na Mesa simulada como deck de amigo. Para ele jogar como o seu deck, use "Analisar no Raio-X".`);
    document.dispatchEvent(new CustomEvent('raiox:amigos'));
  };
}
const confirmar = (t) => { try { return window.confirm(t); } catch (e) { return true; } };

// cliques nas listas (um só ouvinte para a tela toda)
document.addEventListener('click', (e) => {
  const root = ROOT(); if (!root || !root.contains(e.target)) return;
  const b = e.target.closest('[data-add],[data-sub],[data-cmd],[data-uncmd]'); if (!b || b.disabled) return;
  const d = D();
  if (b.dataset.add) poe(b.dataset.add);
  else if (b.dataset.sub) { const n = b.dataset.sub; if (d.cartas[n] > 1) d.cartas[n]--; else delete d.cartas[n]; toque(); atualiza(); }
  else if (b.dataset.cmd) {
    const n = b.dataset.cmd; d.cmds.push(n); delete d.cartas[n];
    if (!d.nome || d.nome === 'Deck novo') d.nome = n.split(',')[0];
    const I = ident(); const fora = Object.keys(d.cartas).filter(x => !cabeCor(C(x), I));
    Q = { ...Q, txt: '', cmd: false, cor: '', pag: 40 }; toque(); desenha();
    if (fora.length) msg(`Atenção: ${fora.length} carta(s) fora das cores do comandante: ${fora.slice(0, 5).join(', ')}.`);
  } else if (b.dataset.uncmd) { d.cmds = d.cmds.filter(x => x !== b.dataset.uncmd); Q.cmd = false; toque(); desenha(); }
});

// Archidekt: API pública de leitura (archidekt.com/api/decks/ID/)
async function archidekt(url) {
  const m = String(url || '').match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i) || String(url || '').match(/^\s*(\d{3,})\s*$/);
  if (!m) { msg('Não achei o número do deck no link. Exemplo: https://archidekt.com/decks/123456/meu_deck', 'mt-imp-msg'); return; }
  msg('Buscando no Archidekt…', 'mt-imp-msg');
  try {
    const r = await fetch(`https://archidekt.com/api/decks/${m[1]}/`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status === 404 ? 'deck não encontrado (é público?)' : 'resposta ' + r.status);
    const j = await r.json();
    const fora = new Set((j.categories || []).filter(c => c.includedInDeck === false).map(c => c.name));
    const cmds = [], linhas = [];
    for (const it of j.cards || []) {
      const cats = it.categories || []; const nome = it.card && (it.card.oracleCard && it.card.oracleCard.name || it.card.name); if (!nome) continue;
      if (cats.length && fora.has(cats[0])) continue;
      if (cats.includes('Commander')) cmds.push('1 ' + nome); else linhas.push((it.quantity || 1) + ' ' + nome);
    }
    const t = (cmds.length ? 'Commander\n' + cmds.join('\n') + '\n\nDeck\n' : '') + linhas.join('\n');
    const res = deTexto(t, j.name);
    if (res.erro) { msg(res.erro, 'mt-imp-msg'); return; }
    desenha(); msg(`Importado do Archidekt: "${res.d.nome}", ${contar(res.d)} cartas${res.unknown.length ? `. Não reconheci ${res.unknown.length}: ${res.unknown.slice(0, 6).join(', ')}` : ''}.`, 'mt-imp-msg'); $('#mt-imp').open = true;
  } catch (e) {
    msg(`Não deu para ler o Archidekt daqui (${e.message || 'o site bloqueou o pedido'}). No Archidekt: Export → copie o texto e use "Importar texto".`, 'mt-imp-msg');
  }
}

// a tela só é desenhada quando aberta (a base de cartas é grande)
function abre(t) { if (t !== 'montar') return; if (!S.atual || !S.decks[S.atual]) { const ids = Object.keys(S.decks); S.atual = ids[0] || null; if (!S.atual) novoDeck(); } desenha(); }
document.addEventListener('raiox:tela', (e) => abre(e.detail));
if (location.hash === '#montar') { ROOT() && (ROOT().hidden = false); abre('montar'); }
window.RAIOX_MONTAR = { texto: () => texto(), get deck() { return D(); }, deTexto };
})();
