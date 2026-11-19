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
const D = () => { const d = S.decks[S.atual] || novoDeck(); if (!d.passo) d.passo = d.cmds.length ? (Object.keys(d.cartas).length ? 4 : 2) : 1; if (!d.ideia) d.ideia = { texto: '', man: null }; if (!d.recusadas) d.recusadas = {}; if (!d.alvo) d.alvo = { br: '', teto: '' }; return d; };
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
    <p class="lead">Monte em quatro passos: escolha as cores e o comandante, conte a ideia do deck, monte junto com as sugestões e faça o ajuste fino. Os decks ficam salvos neste navegador; para levar ao Moxfield, use <b>Copiar para o Moxfield</b> no passo 4.</p>
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
  if (soBusca) { const y = window.scrollY; const b = $('.mt-busca', root); if (b) { const foco = document.activeElement && document.activeElement.id; const pos = foco === 'mt-q' ? document.activeElement.selectionStart : null; b.outerHTML = painelBusca(); liga(); G.liga(); if (foco) { const el = $('#' + foco); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } } window.scrollTo(0, y); return; } }
  const d = D(); if (!d.cmds.length && d.passo > 1) d.passo = 1;
  analisa();
  let corpo;
  if (d.passo === 1) corpo = G.painelCores();
  else if (d.passo === 2) corpo = G.painelIdeia();
  else if (d.passo === 3) corpo = `<div class="mt-grade mt-g3">${G.painelJunto()}${painelDeck()}</div>`;
  else corpo = `<div class="mt-grade">${painelBusca()}${painelDeck()}</div>` + painelAnalise() + painelSaida();
  root.innerHTML = painelTopo() + G.passos() + corpo;
  liga(); G.liga(); G.imagens(root);
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

// =====================================================================
// Construção guiada: 1 cores e comandante → 2 a ideia → 3 montar junto → 4 ajuste fino
// =====================================================================
const G = (() => {
  const ORDEM = 'WUBRG';
  const ordena = (s) => [...new Set(String(s).split(''))].filter(x => ORDEM.includes(x)).sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b)).join('');
  const NOMES = {
    '': 'Incolor', W: 'Branco', U: 'Azul', B: 'Preto', R: 'Vermelho', G: 'Verde',
    WU: 'Azorius', UB: 'Dimir', BR: 'Rakdos', RG: 'Gruul', WG: 'Selesnya', WB: 'Orzhov', UR: 'Izzet', BG: 'Golgari', WR: 'Boros', UG: 'Simic',
    WUB: 'Esper', UBR: 'Grixis', BRG: 'Jund', WRG: 'Naya', WUG: 'Bant', WBG: 'Abzan', WUR: 'Jeskai', UBG: 'Sultai', WBR: 'Mardu', URG: 'Temur',
    WUBR: 'Sem verde (Yore-Tiller)', UBRG: 'Sem branco (Glint-Eye)', WBRG: 'Sem azul (Dune-Brood)', WURG: 'Sem preto (Ink-Treader)', WUBG: 'Sem vermelho (Witch-Maw)', WUBRG: 'Cinco cores',
  };
  const nomeCores = (k) => k == null ? 'todas as cores' : (NOMES[ordena(k)] || ordena(k));
  const pipsHTML = (k) => k == null ? ORDEM.split('').map(x => `<span class="ms ${x}"></span>`).join('') : k ? k.split('').map(x => `<span class="ms ${x}"></span>`).join('') : '<span class="ms">C</span>';
  const temaNome = (k) => (R.THEMES.find(t => t.k === k) || {}).n || k;

  // ---------- comandantes: perfil (temas e tribo) ----------
  let TIPOS_CRI = null;
  function tiposCriatura() {
    if (TIPOS_CRI) return TIPOS_CRI;
    const s = new Set();
    for (const x of indice()) if (/Creature/.test(x.t)) for (const t of R.subtypes(C(x.n))) if (t.length > 2) s.add(t);
    TIPOS_CRI = s; return s;
  }
  const PLURAL = { Elf: 'Elves', Dwarf: 'Dwarves', Wolf: 'Wolves', Werewolf: 'Werewolves', Fungus: 'Fungi', Sphinx: 'Sphinxes', Fox: 'Foxes', Ox: 'Oxen', Mouse: 'Mice', Octopus: 'Octopuses', Djinn: 'Djinn', Leech: 'Leeches', Witch: 'Witches', Lynx: 'Lynxes', Phoenix: 'Phoenixes', Thief: 'Thieves' };
  function triboDe(c) {
    const o = (c.o || '').split('\n//\n')[0];
    const tipos = tiposCriatura();
    const achou = [];
    for (const t of tipos) {
      const pl = PLURAL[t] || t + 's';
      const rx = new RegExp(`\\b${pl}\\b|\\b(?:other|another) ${t}\\b|\\b${t} (?:spells?|cards?|creatures? you control|you control)\\b|\\bnon-?${t}\\b`);
      if (rx.test(o)) achou.push(t);
    }
    if (!achou.length) return '';
    const proprios = R.subtypes(c);
    return achou.find(t => proprios.includes(t)) || achou[0];
  }
  const PERF = new Map();
  function perfil(n) {
    if (PERF.has(n)) return PERF.get(n);
    const c = C(n);
    const p = { temas: [...R.themesOf(c)], tribo: triboDe(c) };
    PERF.set(n, p); return p;
  }
  let CMDS = null;
  function comandantes() {
    if (CMDS) return CMDS;
    CMDS = indice().filter(x => !x.ban && canBeCommander(C(x.n))).map(x => ({ n: x.n, k: x.k, pt: x.pt, ci: ordena(x.ci || ''), r: x.r, usd: C(x.n).usd || 0 }));
    return CMDS;
  }

  // ---------- passo 1: cores e comandante ----------
  let P1 = { cores: null, modo: 'exato', tema: '', txt: '', ord: 'pop', pag: 24 };
  function listaCmds() {
    const q = norm(P1.txt);
    let l = comandantes();
    if (q) l = l.filter(x => x.k.includes(q) || (x.pt && x.pt.includes(q)));
    else if (P1.cores !== null) {
      const alvo = P1.cores;
      if (P1.modo === 'exato') l = l.filter(x => x.ci === alvo);
      else l = l.filter(x => x.ci.split('').every(c => alvo.includes(c)));
    }
    if (P1.tema) l = l.filter(x => { const p = perfil(x.n); return P1.tema === 'tribo' ? !!p.tribo : p.temas.includes(P1.tema); });
    l = l.slice().sort(P1.ord === 'preco' ? (a, b) => a.usd - b.usd || a.r - b.r : (a, b) => a.r - b.r);
    return l;
  }
  function painelCores() {
    const l = listaCmds(), mostra = l.slice(0, P1.pag);
    const sel = P1.cores, sl = sel || '';
    const botoes = ORDEM.split('').map(x => `<button class="g-cor ${sl.includes(x) ? 'on' : ''}" data-c1="${x}" aria-pressed="${sl.includes(x)}" title="${R.COLORNAME[x]}"><span class="ms ${x}"></span><small>${R.COLORNAME[x]}</small></button>`).join('');
    const temas = [['', 'Todos os temas'], ...R.THEMES.map(t => [t.k, t.n]), ['tribo', 'Tribo (um tipo de criatura)']];
    const cartoes = mostra.map(x => {
      const c = C(x.n), p = perfil(x.n);
      const tags = [p.tribo ? `<span class="tag th">Tribo: ${esc(p.tribo)}</span>` : '', ...p.temas.slice(0, 3).map(k => `<span class="tag th">${esc(temaNome(k))}</span>`)].join('');
      const ia = window.PAPEIS_IA && window.PAPEIS_IA[x.n];
      return `<article class="g-cmd"><button class="g-img" data-card="${esc(x.n)}" data-img="${esc(x.n)}" aria-label="Ver ${esc(x.n)}"><span class="note">carregando…</span></button>
        <div class="g-cmd-tx"><b>${esc(x.n)}</b><span class="g-sub"><span class="mt-mana">${manaHTML(c.m)}</span> <span class="note">${esc(nomeCores(x.ci))}</span></span>
        ${ia && ia.r ? `<p class="g-ia">${esc(ia.r)}</p>` : ''}
        <div class="chips">${tags || '<span class="tag">sem tema claro</span>'}</div>
        <span class="g-meta"><span title="Posição entre os comandantes e cartas mais jogadas">Nº ${x.r < 1e6 ? x.r.toLocaleString('pt-BR') : '—'}</span><span>${x.usd ? brl(x.usd, x.usd < 10) : '—'}</span></span>
        <button class="btn primary small" data-cmd="${esc(x.n)}">Escolher este</button></div></article>`;
    }).join('');
    return `<section class="panel g-p1"><h2>Passo 1 · Cores e comandante</h2>
      <p class="lead">Não precisa saber o nome do comandante. Escolha as cores que você quer jogar e veja quem comanda essa combinação.</p>
      <div class="g-cores">${botoes}<button class="g-cor g-inc ${sel === '' && P1.modo === 'exato' ? 'on' : ''}" data-c1="C" title="Sem cor"><span class="ms">C</span><small>Incolor</small></button></div>
      <div class="g-comb"><span class="g-comb-n">${pipsHTML(sel)} <b>${esc(nomeCores(sel))}</b></span>
        <label class="g-modo"><input type="radio" name="g-modo" value="exato" ${P1.modo === 'exato' ? 'checked' : ''}> exatamente essas cores</label>
        <label class="g-modo"><input type="radio" name="g-modo" value="cabe" ${P1.modo === 'cabe' ? 'checked' : ''}> estas cores ou menos</label></div>
      <div class="mt-filtros g-f1">
        <label class="mt-campo"><span>Tema</span><select id="g-tema">${temas.map(([k, n]) => `<option value="${k}" ${P1.tema === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="mt-campo"><span>Ordem</span><select id="g-ord"><option value="pop" ${P1.ord === 'pop' ? 'selected' : ''}>Mais jogados primeiro</option><option value="preco" ${P1.ord === 'preco' ? 'selected' : ''}>Mais baratos primeiro</option></select></label>
        <label class="mt-campo g-busca1"><span>Já sabe o nome? (atalho)</span><input class="txt" id="g-q1" type="search" placeholder="Nome do comandante…" value="${esc(P1.txt)}" autocomplete="off"></label>
      </div>
      <p class="note">${P1.txt ? `Busca por nome: ${l.length} comandante(s), em qualquer cor.` : `${l.length.toLocaleString('pt-BR')} comandante(s) em ${esc(nomeCores(sel))}${P1.modo === 'cabe' && sel ? ' ou menos cores' : ''}${sel == null ? ' (escolha as cores acima para filtrar)' : ''}${P1.tema ? ' com o tema escolhido' : ''}.`} Clique na imagem para ler a carta.</p>
      <div class="g-grade" id="g-grade">${cartoes || '<p class="note">Nenhum comandante com esses filtros. Tente outra combinação ou tire o tema.</p>'}</div>
      ${l.length > P1.pag ? '<div class="row"><button class="btn" id="g-mais1">Mostrar mais comandantes</button></div>' : ''}
    </section>`;
  }

  // ---------- passo 2: a ideia ----------
  const CONC = () => R.CONCEITOS || [];
  function triboDeck() { const d = D(); for (const n of d.cmds) { const t = perfil(n).tribo; if (t) return t; } return ''; }
  function temasIdeia() {
    const d = D(), t = d.ideia.texto || '';
    if (!d.ideia.man) { d.ideia.man = {}; for (const n of d.cmds) for (const k of perfil(n).temas) d.ideia.man[k] = true; if (triboDeck()) d.ideia.man.tribe = true; }
    const on = new Set(CONC().filter(x => x.rx.test(t)).map(x => x.k));
    const tb = triboDeck(); if (tb && new RegExp('\\b' + tb.toLowerCase().slice(0, 5), 'i').test(t)) on.add('tribe');
    for (const [k, v] of Object.entries(d.ideia.man)) v ? on.add(k) : on.delete(k);
    if (!tb) on.delete('tribe');
    return on;
  }
  // a ideia também vale para a aba Trocas (mesma chave que a análise usa)
  function salvaConceito() {
    const d = D(); if (!d.cmds.length) return;
    const on = temasIdeia(); const man = {}; for (const x of CONC()) man[x.k] = on.has(x.k);
    try {
      const k = 'raiox:conceito:' + d.cmds.join('+');
      const old = JSON.parse(localStorage.getItem(k) || '{}');
      localStorage.setItem(k, JSON.stringify(Object.assign(old, { text: d.ideia.texto || '', man, mode: old.mode || 'seguir', br: d.alvo.br || '', teto: d.alvo.teto || '', tetoCarta: d.alvo.tetoCarta || '' })));
    } catch (e) {}
  }
  const BR_TX = { '': 'Sem limite: a ferramenta só sugere, não barra nada.', 2: 'Bracket 2 (casual): sem game changers, sem destruir terrenos em massa, sem turnos extras em sequência, poucos tutores.', 3: 'Bracket 3 (otimizado): até 3 game changers, sem destruir terrenos em massa, sem turnos extras em sequência.', 4: 'Bracket 4 (alto poder): vale tudo que não é banido.' };
  function painelIdeia() {
    const d = D(), on = temasIdeia(), tb = triboDeck();
    const cmd = d.cmds[0], ia = window.PAPEIS_IA && window.PAPEIS_IA[cmd];
    const p = perfil(cmd);
    const chips = CONC().filter(x => x.k !== 'tribe' || tb).map(x => `<button class="cn lock ${on.has(x.k) ? 'on' : ''}" data-g2="${x.k}" aria-pressed="${on.has(x.k)}">${esc(x.k === 'tribe' ? 'Tribo: ' + tb : x.n)}</button>`).join('');
    return `<section class="panel g-p2"><h2>Passo 2 · A ideia do deck</h2>
      <div class="g-ideia">
        <div class="g-cmdbox">${d.cmds.map(n => `<button class="g-img" data-card="${esc(n)}" data-img="${esc(n)}"><span class="note">carregando…</span></button>`).join('')}
          ${ia && ia.r ? `<p class="g-ia"><b>O que ele faz:</b> ${esc(ia.r)}</p>` : ''}
          <p class="note">${p.temas.length || p.tribo ? 'Pelo texto, ele puxa para: ' + esc([p.tribo ? 'tribo ' + p.tribo : '', ...p.temas.map(temaNome)].filter(Boolean).join(', ')) + '.' : 'O texto dele não aponta um tema claro: a ideia fica por sua conta.'}</p>
          <div class="row">${d.cmds.length === 1 && temPar(C(cmd)) ? '<button class="btn small" id="g-par">+ segundo comandante</button>' : ''}<button class="btn small" id="g-troca">Trocar de comandante</button></div>
        </div>
        <div class="g-ideia-f">
          <label class="mt-campo"><span>Como o deck ganha? Escreva do seu jeito</span><textarea id="g-txt" spellcheck="false" placeholder="ex.: encher a mesa de goblins e atacar com todos; ou: equipar o comandante e bater com ele">${esc(d.ideia.texto || '')}</textarea></label>
          <div><span class="g-rot">O plano (marque o que vale)</span><div class="chips g-chips">${chips}</div>
          <p class="note">Já vem marcado o que o comandante pede. O que você escrever acende os temas sozinho; clique para ligar ou desligar.</p></div>
          <div class="g-nivel">
            <label class="mt-campo"><span>Bracket que você quer</span><select id="g-br">${['', 2, 3, 4].map(b => `<option value="${b}" ${String(d.alvo.br || '') === String(b) ? 'selected' : ''}>${b || 'Qualquer'}</option>`).join('')}</select></label>
            <label class="mt-campo"><span>Orçamento do deck (R$)</span><input class="txt" id="g-teto" inputmode="decimal" value="${esc(d.alvo.teto || '')}" placeholder="ex.: 800"></label>
            <label class="mt-campo"><span>Máximo por carta (R$)</span><input class="txt" id="g-tetoc" inputmode="decimal" value="${esc(d.alvo.tetoCarta || '')}" placeholder="ex.: 40"></label>
          </div>
          <p class="note" id="g-brtx">${esc(BR_TX[d.alvo.br || ''])}</p>
        </div>
      </div>
      <div class="row g-nav"><button class="btn" data-passo="1">← Voltar às cores</button><button class="btn primary" data-passo="3">Próximo: montar junto →</button></div>
    </section>`;
  }

  // ---------- passo 3: montar junto ----------
  const num = (v) => parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')) || 0;
  let POOL = null, POOLK = '';
  function pool() {
    const I = ident(), k = [...I].sort().join('');
    if (POOL && POOLK === k) return POOL;
    POOL = []; POOLK = k;
    for (const x of indice()) {
      if (x.ban || x.r >= 1e6) continue;
      if (!(x.ci || '').split('').every(c => !c || I.has(c))) continue;
      const c = C(x.n); if (!c || canBeCommanderOnly(c)) continue;
      POOL.push(c);
    }
    POOL.sort((a, b) => a.r - b.r);
    return POOL;
  }
  const canBeCommanderOnly = (c) => /Background/.test(c.t) && !/Creature/.test(c.t); // antecedentes só como segundo comandante
  const isLandC = (c) => isLand(c);
  function encaixa(c, on, tb) {
    if (isLandC(c)) return [];
    const out = [];
    for (const k of on) {
      if (k === 'tribe') { if (tb && (R.subtypes(c).includes(tb) || /Changeling/.test(c.o) || new RegExp('\\b' + tb + '|' + (PLURAL[tb] || tb + 's') + '\\b').test(c.o))) out.push(k); }
      else if (k === 'flying') { if (/Flying/.test(c.o)) out.push(k); }
      else if (R.themesOf(c, new Set([k])).has(k)) out.push(k);
    }
    return out;
  }
  // metas do Passo 3 calibradas nos decks médios do EDHREC (ferramentas/calibra, 382 decks: os 10 comandantes mais jogados de cada tema,
  // 3 de cada tribo, e 36 comandantes em cada bracket e no orçamento baixo). Ordem: ramp, compra, remoção, limpa-mesa, proteção, contramágica.
  // Tema/tribo/bracket/orçamento = diferença para a média geral (tema já sem o efeito da cor). Gerado por ferramentas/calibra/gera_meta.py.
  const META = { base: [10,13.6,7.3,2.5,5.2,1.8], contraAzul: 3.7, verde: 2.1, azulCompra: 0.5,
    tema: { voltron: [-2,-3.6,-2.1,-0.6,9,-0.1], tokens: [-0.7,-2.6,0.5,-0.2,-1,0.5], counters: [-0.4,-0.7,-0.7,-0.3,1,-0.5], graveyard: [0.1,2,0.3,-0.2,-2.6,-0.4], artifacts: [2.4,1.6,-1.7,-0.6,-0.1,-0.1], enchant: [-0.9,0.8,1.2,-0.5,1.4,-1.5], spells: [1.1,7.3,1.8,-0.1,-2,1], sac: [-0.3,-3.2,1.9,1.3,-2.7,-0.3], life: [-0.9,-1.8,0.5,0.5,-2.1,0.1], lands: [2.8,-1.5,-2.4,-1.3,-2.2,-0.8], combat: [0.2,-4,0.9,0.1,2,0], draw: [0.1,10.9,-0.6,-0.3,-1.9,0.7], flying: [0.5,-2.2,-0,0.4,0.8,0.5], tribe: [-0.5,-1.1,0.5,0.3,0.3,0.2] },
    tribo: { Elf: [1.7,-1.1,0.7,-0.1,1.4,-0.9], Goblin: [-1.2,-0.7,1.4,-0.1,-1,-0.9], Zombie: [-1.2,-2.6,-0.8,1.4,-0.6,0.3], Dragon: [0.9,-2.1,1.2,0.3,-0.6,-0.4], Vampire: [-1,0.4,0.4,0.6,-1.1,-0.9], Merfolk: [-1.8,1.9,-1.3,0.8,0.4,2.6], Angel: [-0.7,-2.2,0.6,1.1,3.2,-0.9], Dinosaur: [-0.3,-0.1,1.7,0.1,0.4,-0.9], Wizard: [-0.3,0.4,1.4,0.6,-1.1,2.9], Human: [0.3,-0.4,1.4,-0.1,1.2,0.1], Sliver: [-0.8,-4.3,-1.1,-0.6,0.9,-0.4], Cat: [-1.6,-2.4,-0.1,-0.4,0.5,-0.9] },
    bracket: { 1: [-0.3,0.9,1.1,-0.2,-0.9,-0.5], 2: [-0.2,1.1,1,0.2,-0.6,-0.6], 3: [-0.1,0.1,0,0,0.1,-0.1], 4: [-1.1,-1.2,-1.2,0.1,0.8,0.6] },
    barato: [-0.1,2.2,2.4,-0,-1.7,-0.6],
    // terrenos = a + b × custo médio das mágicas (regressão nos decks médios) + a mais/a menos por tema, bracket e orçamento
    terrenos: { a: 31.53, b: 1.28, tema: { voltron: 0.1, tokens: -0.4, counters: 0.3, graveyard: 0.4, artifacts: -1, enchant: -0.2, spells: -0.7, sac: -0.6, life: -0.3, lands: 1.9, combat: -0.5, draw: 0.1, flying: -0.5, tribe: -0.2 }, bracket: { 1: 1, 2: 0.5, 3: 0.2, 4: -0.5 }, barato: 1 } };
  window.RAIOX_METAS = (on, I, d, tb) => metas(on, I, d, tb); // para a análise usar as mesmas metas (teste: raiox:refsMeta)
  const META_N = { voltron: 'Auras e equipamentos', tokens: 'Fichas', counters: 'Marcadores', graveyard: 'Cemitério', artifacts: 'Artefatos', enchant: 'Encantamentos', spells: 'Mágicas', sac: 'Sacrifício', life: 'Ganho de vida', lands: 'Landfall', combat: 'Ataque', draw: 'Comprar muitas', flying: 'Voar', tribe: 'Tribo' };
  // vários temas: média das diferenças dos temas marcados. Cada meta vem com a conta, para a tela mostrar.
  function metas(on, I, d, tb) {
    const ts = [...on].filter(t => META.tema[t]);
    const dif = (t, i) => t === 'tribe' && META.tribo[tb] ? META.tribo[tb][i] : META.tema[t][i];
    const nomeT = (t) => t === 'tribe' && tb ? 'tribo ' + tb + (META.tribo[tb] ? '' : ' (média das tribos)') : META_N[t];
    const br = +d.alvo.br || 0, teto = num(d.alvo.teto), tetoC = num(d.alvo.tetoCarta);
    const barato = (teto && teto <= 1000) || (tetoC && tetoC <= 15) ? 1 : (teto && teto <= 2500) || (tetoC && tetoC <= 30) ? 0.5 : 0;
    const out = {};
    ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter'].forEach((k, i) => {
      if (k === 'counter' && !I.has('U')) return;
      const partes = [];
      let x = k === 'counter' ? META.contraAzul : META.base[i];
      partes.push(['média geral', x]);
      if (ts.length) { const v = ts.reduce((s, t) => s + dif(t, i), 0) / ts.length; partes.push([ts.length > 1 ? 'temas ' + ts.map(nomeT).join(' + ') + ' (média)' : (ts[0] === 'tribe' ? '' : 'tema ') + nomeT(ts[0]), v]); }
      if (k === 'ramp') partes.push([I.has('G') ? 'tem verde' : 'sem verde', I.has('G') ? META.verde : -META.verde]);
      if (k === 'draw') partes.push([I.has('U') ? 'tem azul' : 'sem azul', I.has('U') ? META.azulCompra : -META.azulCompra]);
      if (META.bracket[br]) partes.push(['bracket ' + br, META.bracket[br][i]]);
      if (barato) partes.push([barato === 1 ? 'orçamento baixo' : 'orçamento médio', META.barato[i] * barato]);
      const tot = partes.reduce((s, p) => s + p[1], 0);
      const min = { ramp: 6, draw: 6, removal: 4, wipe: 1, protect: 2, counter: 1 }[k];
      const alvo = Math.max(min, Math.round(tot));
      const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1).replace('.', ',').replace(',0', '');
      const conta = partes.filter((p, j) => j === 0 || Math.abs(p[1]) >= 0.05).map((p, j) => j === 0 ? `${p[0]} ${p[1].toFixed(1).replace('.', ',')}` : `${p[0]} ${f(p[1])}`).join(', ');
      out[k] = { alvo, conta: `decks médios do EDHREC: ${conta} = ${alvo}` };
    });
    // terrenos: a + b × custo médio (no estado()) + a mais/a menos por tema, bracket e orçamento
    const TT = META.terrenos, pl = [];
    if (ts.length) { const v = ts.reduce((s, t) => s + (TT.tema[t] || 0), 0) / ts.length; if (Math.abs(v) >= 0.05) pl.push([ts.length > 1 ? 'temas ' + ts.map(nomeT).join(' + ') : (ts[0] === 'tribe' ? 'tribo' : 'tema ' + nomeT(ts[0])), v]); }
    if (TT.bracket[br]) pl.push(['bracket ' + br, TT.bracket[br]]);
    if (barato) pl.push([barato === 1 ? 'orçamento baixo' : 'orçamento médio', TT.barato * barato]);
    const fT = (v) => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',').replace(',0', '');
    out.lands = { adj: pl.reduce((s, p) => s + p[1], 0), conta: pl.map(p => `${p[0]} ${fT(p[1])}`).join(', ') };
    return out;
  }
  function estado() {
    const d = D(), I = ident();
    const cartas = Object.entries(d.cartas).map(([n, q]) => [C(n), q]).filter(([c]) => c);
    const on = temasIdeia(), tb = triboDeck();
    const cnt = {}; let lands = 0, spells = 0, sv = 0, tema = 0, gc = d.cmds.filter(n => C(n).gc).length, tut = 0, usd = d.cmds.reduce((s, n) => s + (C(n).usd || 0), 0);
    for (const [c, q] of cartas) {
      usd += (c.usd || 0) * q;
      if (c.gc) gc++; if (R.isTutor(c)) tut++;
      if (isLandC(c)) { lands += q; continue; }
      spells += q; sv += c.v * q;
      // ramp só conta se for de verdade (pedra, criatura de mana, busca de terreno, tesouros): Ragavan e rituais não aceleram o comandante
      for (const k of papeis(c.name)) if (k !== 'ramp' || RAMP_OK.has(R.tipoRamp(c))) cnt[k] = (cnt[k] || 0) + q;
      if (on.size && encaixa(c, on, tb).length) tema += q;
    }
    const media = spells ? sv / spells : 3;
    // plano do comandante (o mesmo das trocas): o que adianta Nelly/Stangg/… entrar e atacar
    const cmdC = d.cmds.map(C).filter(Boolean), cth = new Set(on); cmdC.forEach(c => R.themesOf(c).forEach(t => cth.add(t)));
    const AP = { cmds: cmdC, uniq: cartas.map(([c]) => c), cmdThemes: cth, tribe: tb ? [tb, 10] : null };
    AP.plano = R.planoDe ? R.planoDe(AP) : null;
    // terrenos pela fórmula do Karsten (pura e ajustada, lado a lado); com poucas mágicas ainda, a média fica em 3
    const lista = []; for (const [c, q] of cartas) for (let j = 0; j < q; j++) lista.push(c);
    const TF = R.terrenosFormula(lista, cmdC);
    // no começo: média 3 e pelo menos 8 de compra/ramp baratos (as metas de 10 ramp e 10 compra ainda vão entrar)
    if (spells < 15) { TF.media = 3; TF.barato = Math.max(TF.barato, 8); TF.pura = 31.42 + 3.13 * 3 - 0.28 * TF.barato; TF.ajust = TF.pura + TF.ajustes.reduce((s, a) => s + a.v, 0); TF.cedo = true; }
    const M = metas(on, I, d, tb);
    const landsK = Math.max(30, Math.min(42, Math.round(TF.ajust))), landsPura = Math.max(30, Math.min(42, Math.round(TF.pura)));
    // meta = Karsten ajustada; o EDHREC (decks médios, com tema/bracket/orçamento) fica só para comparar
    const landsT = landsK, baseT = META.terrenos.a + META.terrenos.b * TF.media, landsE = Math.max(30, Math.min(42, Math.round(baseT + M.lands.adj)));
    const fD = (v) => v.toFixed(1).replace('.', ',').replace(',0', '');
    const slots = [
      { k: 'ramp', n: 'Ramp', why: 'mana extra cedo põe você um turno à frente da mesa' },
      { k: 'draw', n: 'Compra de cartas', why: 'em mesa de 4, quem fica sem cartas na mão perde' },
      { k: 'removal', n: 'Remoção pontual', why: 'responde ao comandante dos outros e às peças que viram o jogo' },
      { k: 'wipe', n: 'Limpa-mesa', why: 'salva você quando alguém dispara na frente' },
      { k: 'protect', n: 'Proteção', why: 'segura o plano quando tentam remover a peça principal' },
    ];
    if (M.counter) slots.push({ k: 'counter', n: 'Contramágica', why: 'anula a jogada que ganharia o jogo' });
    for (const x of slots) { x.alvo = M[x.k].alvo; x.why += ` (meta pelos ${M[x.k].conta})`; }
    const soma = slots.reduce((s, x) => s + x.alvo, 0);
    const temaAlvo = on.size ? Math.max(12, 99 - (d.cmds.length - 1) - landsT - soma) : 0;
    if (on.size) slots.push({ k: 'tema', n: 'Cartas da ideia', alvo: temaAlvo, why: 'é o que faz o deck ser o seu deck' });
    slots.push({ k: 'lands', n: 'Terrenos', alvo: landsT, why: `pela fórmula do Frank Karsten (custo médio ${TF.media.toFixed(2).replace('.', ',')}${TF.cedo ? ', estimado até haver 15 mágicas' : ''}, ${TF.barato} de compra ou ramp até 2): ${landsPura} pura, ${landsK} com os ajustes${TF.ajustes.length ? '; ' + TF.ajustes.map(a => a.t).join('; ') : ''}. O Montar segue a ajustada. Para comparar, os decks médios do EDHREC jogam ${landsE} (${fD(META.terrenos.a)} + ${fD(META.terrenos.b)} × custo médio = ${fD(baseT)}${M.lands.conta ? `; ${M.lands.conta}` : ''})` });
    for (const x of slots) x.tem = x.k === 'lands' ? lands : x.k === 'tema' ? tema : (cnt[x.k] || 0);
    const total = d.cmds.length + lands + spells;
    const vagasSpells = Math.max(0, 100 - d.cmds.length - landsT - spells);
    // sinergia com a IDEIA escolhida no passo 2 (páginas de tema do EDHREC nessas cores), não com o jeito comum do comandante
    let edh = R.edhIdeia ? R.edhIdeia(on, I, tb) : null;
    if (edh && edh.carrega) edh.carrega.then(() => { if (D() === d && d.passo === 3) atualiza(); });
    if (edh && !edh.pags.length) edh = null;
    return { d, I, on, tb, AP, edh, slots, lands, spells, total, usd, gc, tut, landsT, landsPura, TF, vagasSpells, media };
  }
  let P3 = { slot: '', pag: 6 };
  const RAMP_OK = new Set(['pedra', 'dork', 'terreno', 'tesouro']);
  const RAMP_BASE = { pedra: 1, terreno: 0.95, dork: 0.85, tesouro: 0.45 };
  // preço pesa sempre (a mesma função existe barata); com orçamento definido pesa o dobro
  function pesoPreco(c, E) {
    const brlC = (c.usd || 0) * (R.usd || 5.56); if (brlC < 3) return 0;
    const capC = num(E.d.alvo.tetoCarta), teto = num(E.d.alvo.teto);
    const ref = capC || (teto ? Math.max(5, teto / 60) : 25);
    return (capC || teto ? 0.4 : 0.22) * Math.log2(1 + brlC / ref);
  }
  function proximo(E) {
    if (E.total >= 100) return null;
    const falta = E.slots.filter(x => x.tem < x.alvo);
    // feitiços primeiro (a curva decide os terrenos); terreno quando as mágicas já ocupam a vaga delas
    const naoTerra = falta.find(x => x.k !== 'lands' && E.vagasSpells > 0);
    if (naoTerra) return naoTerra.k;
    if (E.vagasSpells > 0) return E.on.size ? 'tema' : 'mais';   // esqueleto pronto, mas ainda há vaga de mágica
    if (E.lands < E.landsT) return 'lands';
    return E.on.size ? 'tema' : 'mais';
  }
  function cabeNivel(c, E) {
    const br = +E.d.alvo.br || 0;
    if (br) {
      if (br < 4 && c.tags.includes('mass-land-denial')) return false;
      if (br < 3 && c.tags.includes('extra-turn')) return false;
      if (c.gc && br < 4 && E.gc >= LIM_GC[br]) return false;
      if (br < 4 && R.isTutor(c) && E.tut >= 3) return false;
    }
    const usdBrl = R.usd || 5.56;
    const capC = num(E.d.alvo.tetoCarta), teto = num(E.d.alvo.teto);
    if (capC && (c.usd || 0) * usdBrl > capC) return false;
    if (teto) { const resto = Math.max(0, 100 - E.total - 1); if ((E.usd + (c.usd || 0) + resto * 0.25) * usdBrl > teto) return false; }
    return true;
  }
  function sugestoes(k, E, n) {
    const d = E.d, out = [];
    const FUN = {}; for (const x of E.slots) if (x.k !== 'tema' && x.k !== 'lands') FUN[x.k] = x;
    for (const c of pool()) {
      if (d.cartas[c.name] || d.cmds.includes(c.name) || d.recusadas[c.name]) continue;
      const land = isLandC(c);
      if (k === 'lands') { if (!land || isBasic(c)) continue; }
      else if (land) continue;
      const ps = papeis(c.name);
      const fit = encaixa(c, E.on, E.tb);
      const ed = E.edh ? R.edhCarta(E.edh, c) : null, en = E.edh ? R.edhNota(E.edh, c) : 0;
      if (k === 'tema') { if (!fit.length && !(ed && ed.syn >= 0.15)) continue; }   // sinergia alta com o tema escolhido também conta como da ideia
      else if (k !== 'lands' && k !== 'mais' && !ps.has(k)) continue;
      if (!cabeNivel(c, E)) continue;
      // nota (desde 19/11 à noite): o que a carta faz pelo plano do comandante vem antes da popularidade.
      // Antes a popularidade mandava e o Ragavan (R$ 234, só faz tesouro se causar dano) era o 1º ramp da Nelly Borca.
      const pop = Math.max(0, 1 - Math.log10(c.r) / 5);
      const P = E.AP.plano, vp = P && R.valorPlano ? R.valorPlano(E.AP, c).v : 0;
      let nota;
      if (k === 'ramp') {
        const tr = R.tipoRamp(c); if (!RAMP_OK.has(tr)) continue;
        const mv = P ? P.mv : 4, alvoMv = Math.max(1, mv - 2);
        const cv = R.custoRamp(c);   // custo real: X e multikicker (Astral Cornucopia, Everflowing Chalice) e Mox Diamond contam como 2
        if (c.v >= mv && mv >= 3) continue;                       // chega junto com o comandante: não acelera
        nota = RAMP_BASE[tr] + (cv <= alvoMv ? 0.35 + 0.08 * (alvoMv - cv) : -0.25) + (E.edh ? 0.5 * en : 0.2 * pop);
        if (/enters tapped|enters the battlefield tapped/.test(c.o) && tr !== 'terreno') nota -= 0.1;
      } else {
        // com o EDHREC do comandante: inclusão + sinergia nos decks dele mandam; sem ele, popularidade geral e encaixe por palavra
        nota = E.edh ? 1.2 * en + 0.1 * pop + (fit.length ? 0.12 : 0) : 0.45 * pop + (fit.length ? 0.35 + 0.1 * Math.min(2, fit.length - 1) : 0);
        if (['removal', 'protect', 'counter'].includes(k) && c.v <= 2) nota += 0.12;
      }
      if (k !== 'lands') nota += 0.12 * Math.max(-2, Math.min(3, vp));
      nota -= pesoPreco(c, E);
      // função que já passou da meta perde peso (no Krenko as vagas da ideia puxavam goblins de mana e o ramp ia a 25/10);
      // carta que cobre outra função ainda faltando ganha um pouco
      if (k !== 'lands') for (const r of ps) {
        if (r === k) continue;
        const sl = FUN[r]; if (!sl) continue;
        if (sl.tem >= sl.alvo) nota -= 0.18 + 0.04 * Math.min(5, sl.tem - sl.alvo);
        else nota += 0.08;
      }
      if (k === 'lands') { const fora = [...E.I].filter(x => (c.pm || '').includes(x)).length; nota += fora >= 2 ? 0.2 : 0; if (/enters tapped\./.test(c.o) && !/unless|you may pay|If you don't/.test(c.o)) nota -= 0.15; }
      if (out.length > 600 && !ed) { if (!E.edh) break; continue; }   // com o EDHREC, cartas pouco jogadas no geral mas deste comandante ainda entram
      out.push({ c, nota, fit, ps });
    }
    return out.sort((a, b) => b.nota - a.nota).slice(0, n);
  }
  function porque(s, k, E) {
    const c = s.c, r = [];
    const roleN = (x) => (ROLES.find(o => o.k === x) || {}).n;
    const fun = [...s.ps].filter(x => x !== 'body' && x !== 'enabler').map(roleN).filter(Boolean);
    if (fun.length && k !== 'lands') r.push('Faz: ' + fun.slice(0, 3).join(', ').toLowerCase());
    const P = E.AP.plano;
    if (k === 'ramp') {
      const tr = R.tipoRamp(c), mv = P ? P.mv : 0;
      const quando = mv >= 3 && R.custoRamp(c) <= mv - 2 ? `: jogada no turno ${Math.max(1, R.custoRamp(c))}, põe ${P.nome} (custo ${mv}) na mesa no turno ${mv - 1} em vez do ${mv}` : mv >= 3 ? `: custa ${R.custoRamp(c)} na prática, adianta pouco ${P.nome} (custo ${mv})` : '';
      r.push((R.RAMP_N[tr] || 'ramp').replace(/^./, x => x.toUpperCase()) + (tr === 'tesouro' ? ' (ajuda uma vez, não todo turno)' : '') + quando);
    }
    if (P && R.valorPlano && k !== 'lands') for (const w of R.valorPlano(E.AP, c).why) if (!(k === 'ramp' && /^ramp de/.test(w))) r.push('Pelo plano de ' + P.nome + ': ' + w);
    if (s.fit.length) r.push('Cabe na ideia: ' + s.fit.map(x => x === 'tribe' ? 'tribo ' + E.tb : (CONC().find(o => o.k === x) || {}).n || x).join(', ').toLowerCase());
    if (k !== 'lands' && c.v <= 2 && ['removal', 'protect', 'counter', 'draw'].includes(k)) r.push(`custa ${c.v}: dá para jogar cedo ou junto com outra coisa`);
    if (k === 'lands') { const cs = [...E.I].filter(x => (c.pm || '').includes(x)); if (cs.length) r.push('Dá mana ' + cs.map(x => R.COLORNAME[x].toLowerCase()).join(' e ')); if (/enters tapped\./.test(c.o) && !/unless|you may pay|If you don't/.test(c.o)) r.push('entra virado'); }
    if (E.edh) { const t = R.edhPorque(E.edh, c); if (t && (k !== 'lands' || R.edhCarta(E.edh, c))) r.push(t); }
    const brlC = (c.usd || 0) * (R.usd || 5.56); if (brlC >= 50) r.push(`cara (${R.brlTxt ? R.brlTxt(c.usd) : 'R$ ' + Math.round(brlC)}): só vale se couber no seu orçamento`);
    r.push(`Popularidade: nº ${c.r.toLocaleString('pt-BR')} no Commander`);
    return r;
  }
  function pipsDeck(d) {
    const p = {}; for (const x of ident()) p[x] = 0;
    for (const [n, q] of Object.entries(d.cartas)) { const c = C(n); if (!c || isLandC(c)) continue; ((c.m || '').split(' // ')[0].match(/\{[^}]+\}/g) || []).forEach(s => s.slice(1, -1).split('/').forEach(x => { if (x in p) p[x] += q; })); }
    for (const n of d.cmds) ((C(n).m || '').match(/\{[^}]+\}/g) || []).forEach(s => s.slice(1, -1).split('/').forEach(x => { if (x in p) p[x] += 2; }));
    return p;
  }
  const BASICO = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
  function planoBasicos(E) {
    const falta = Math.min(E.landsT - E.lands, 100 - E.total); if (falta <= 0) return [];
    const cores = [...E.I]; if (!cores.length) return [['Wastes', falta]];
    const p = pipsDeck(E.d); const tot = cores.reduce((s, x) => s + p[x], 0) || cores.length;
    const q = cores.map(x => [x, (p[x] || (tot === cores.length ? 1 : 0)) / tot * falta]);
    const base = q.map(([x, v]) => [x, Math.floor(v)]); let sobra = falta - base.reduce((s, [, v]) => s + v, 0);
    q.map(([x, v], i) => [i, v - Math.floor(v)]).sort((a, b) => b[1] - a[1]).forEach(([i]) => { if (sobra > 0) { base[i][1]++; sobra--; } });
    return base.filter(([, v]) => v > 0).map(([x, v]) => [BASICO[x], v]);
  }
  function painelJunto() {
    const E = estado();
    const auto = proximo(E);
    const k = P3.slot && (P3.slot !== 'tema' || E.on.size) ? P3.slot : auto;
    const trilho = E.slots.map(x => {
      const pct = Math.min(100, 100 * x.tem / Math.max(1, x.alvo)), ok = x.tem >= x.alvo;
      return `<button class="g-slot ${ok ? 'ok' : ''} ${x.k === k ? 'on' : ''}" data-slot="${x.k}" title="${esc(x.n)}: ${x.tem} de ${x.alvo}"><span class="g-slot-n">${esc(x.n)}</span><span class="g-slot-v"><b>${x.tem}</b>/${x.alvo}${ok ? ' ✓' : ''}</span><span class="g-slot-b"><i style="width:${pct}%"></i></span></button>`;
    }).join('');
    let corpo;
    if (!k) {
      corpo = `<div class="g-fim"><h3>O deck chegou a ${E.total} cartas.</h3><p>${E.total > 100 ? `Passou ${E.total - 100}: no ajuste fino dá para ver o que tirar.` : 'Esqueleto completo. Agora é o ajuste fino: ver a análise, trocar uma ou outra carta e levar para o Moxfield ou para a mesa.'}</p><div class="row"><button class="btn primary" data-passo="4">Ir para o ajuste fino →</button></div></div>`;
    } else {
      const slot = E.slots.find(x => x.k === k) || { n: 'Mais cartas', alvo: 0, tem: 0, why: 'o deck ainda tem vagas' };
      let falta = Math.max(0, slot.alvo - slot.tem);
      const extra = !falta && k !== 'lands' && E.vagasSpells > 0; if (extra) falta = E.vagasSpells;
      const lista = sugestoes(k, E, P3.pag);
      const bas = k === 'lands' ? planoBasicos(E) : [];
      const cartas = lista.map(s => {
        const c = s.c, ia = window.PAPEIS_IA && window.PAPEIS_IA[c.name];
        return `<article class="g-sug"><button class="g-img g-img-s" data-card="${esc(c.name)}" data-img="${esc(c.name)}"><span class="note">…</span></button>
          <div class="g-sug-tx"><div class="g-sug-h"><b>${esc(c.name)}</b><span class="mt-mana">${manaHTML(c.m)}</span></div>
          <span class="note">${esc(c.t.split(' // ')[0])} · ${c.usd ? brl(c.usd, c.usd < 10) : 'sem preço'}${c.gc ? ' · <b class="mt-gc">game changer</b>' : ''}</span>
          ${ia && ia.r ? `<p class="g-ia">${esc(ia.r)}</p>` : ''}
          <ul class="g-pq">${porque(s, k, E).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          <div class="row"><button class="btn primary small" data-aceita="${esc(c.name)}">Pôr no deck</button><button class="btn small" data-nao="${esc(c.name)}">Agora não</button></div></div></article>`;
      }).join('');
      const filtros = [E.d.alvo.br ? 'bracket ' + E.d.alvo.br : '', num(E.d.alvo.tetoCarta) ? 'até R$ ' + num(E.d.alvo.tetoCarta) + ' por carta' : '', num(E.d.alvo.teto) ? 'orçamento de R$ ' + num(E.d.alvo.teto) : ''].filter(Boolean);
      corpo = `<div class="g-prox"><span class="g-rot">${k === auto ? 'Próximo passo' : 'Você escolheu'}</span>
        <h3>${esc(slot.n)}${extra ? `: ainda cabem ${falta} mágica${falta > 1 ? 's' : ''}` : slot.alvo ? `: ${falta ? `faltam ${falta} de ${slot.alvo}` : `já tem ${slot.tem} (o normal é ${slot.alvo})`}` : ''}</h3>
        ${extra ? `<p class="note">O esqueleto de funções já está completo; as vagas que sobram (100 menos os ${E.landsT} terrenos) vão para ${E.on.size ? 'mais cartas da ideia' : 'as cartas mais jogadas nas suas cores'}.</p>` : ''}
        <p class="note">Por que importa: ${esc(slot.why)}. Sugestões nas cores do comandante${E.edh ? `, pela sinergia com a sua ideia (no EDHREC: quanto a carta aparece nos decks do${E.edh.pags.length > 1 ? "s temas escolhidos" : " tema escolhido"} nessas cores a mais que nos decks dessas cores em geral)` : E.on.size ? ', pela popularidade geral' : ', pela popularidade geral (escolha temas no passo 2 para puxar para a ideia)'}${E.on.size && k !== 'lands' ? ', puxando para a ideia' : ''}${filtros.length ? ', dentro de ' + esc(filtros.join(', ')) : ''}.</p>
        ${bas.length ? `<div class="g-bas"><span>Completar com básicos pela cor das cartas: <b>${bas.map(([n, q]) => q + ' ' + n).join(', ')}</b></span><button class="btn small primary" id="g-bas">Pôr os ${bas.reduce((s, [, q]) => s + q, 0)} básicos</button></div><p class="note">Ou escolha terrenos especiais abaixo antes (eles dão mais de uma cor).</p>` : ''}
        <div class="g-sugs">${cartas || '<p class="note">Nenhuma sugestão cabe nos filtros (bracket, orçamento, cartas recusadas). Escolha outra etapa no trilho acima, mude o orçamento no passo 2 ou busque livre no passo 4.</p>'}</div>
        <div class="row">${lista.length ? `<button class="btn" id="g-todas">Pôr ${Math.min(lista.length, falta || lista.length) === 1 ? 'a primeira' : 'as ' + Math.min(lista.length, falta || lista.length) + ' primeiras'}</button>` : ''}<button class="btn" id="g-mais3">Ver mais sugestões</button>${Object.keys(E.d.recusadas).length ? `<button class="btn" id="g-desrec">Rever as ${Object.keys(E.d.recusadas).length} recusadas</button>` : ''}${P3.slot ? '<button class="btn" id="g-auto">Seguir a ordem sugerida</button>' : ''}</div>
      </div>`;
    }
    return `<section class="panel g-p3"><h2>Passo 3 · Montar junto</h2>
      <p class="lead">O esqueleto de um deck de Commander, etapa por etapa. Aceite ou recuse cada sugestão; clique numa etapa do trilho para pular para ela.</p>
      <div class="g-trilho">${trilho}</div>
      ${corpo}
      <div class="row g-nav"><button class="btn" data-passo="2">← A ideia</button><button class="btn" data-passo="4">Ajuste fino →</button></div>
    </section>`;
  }

  // ---------- trilho dos passos ----------
  function passos() {
    const d = D(), tem = d.cmds.length > 0;
    const P = [[1, 'Cores e comandante', 'palette'], [2, 'A ideia', 'lightbulb'], [3, 'Montar junto', 'handshake'], [4, 'Ajuste fino', 'tune']];
    return `<nav class="g-passos" aria-label="Passos da montagem">${P.map(([n, t]) => `<button class="g-passo ${d.passo === n ? 'on' : ''} ${d.passo > n ? 'feito' : ''}" data-passo="${n}" ${n > 1 && !tem ? 'disabled title="Escolha o comandante primeiro"' : ''} aria-current="${d.passo === n ? 'step' : 'false'}"><b>${n}</b><span>${t}</span></button>`).join('<i class="g-seta" aria-hidden="true"></i>')}</nav>`;
  }

  // ---------- imagens (fila do analise.js; a mesma carta não espera de novo) ----------
  const JA = new Map();
  function imagens(root) {
    $$('[data-img]', root).forEach(el => {
      const n = el.dataset.img;
      const pinta = (src) => { if (el.dataset.img === n) el.innerHTML = src ? `<img src="${src}" alt="${esc(n)}" loading="lazy">` : '<span class="note">sem imagem</span>'; };
      if (JA.has(n)) { pinta(JA.get(n)); return; }
      R.imgFor(n).then(src => { JA.set(n, src); pinta(src); });
    });
  }

  function liga() {
    const root = ROOT(), d = D();
    $$('[data-passo]', root).forEach(b => b.onclick = () => { const n = +b.dataset.passo; if (n > 1 && !d.cmds.length) return; if (d.passo === 2) salvaConceito(); d.passo = n; P3.slot = ''; P3.pag = 6; toque(); desenha(); const t = $('.g-passos'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 80); });
    // passo 1
    $$('[data-c1]', root).forEach(b => b.onclick = () => { const x = b.dataset.c1; if (x === 'C') { P1.cores = ''; P1.modo = 'exato'; } else { const b0 = P1.cores || ''; P1.cores = ordena(b0.includes(x) ? b0.replace(x, '') : b0 + x) || null; } P1.txt = ''; P1.pag = 24; desenha(); });
    $$('input[name="g-modo"]', root).forEach(r => r.onchange = () => { P1.modo = r.value; P1.pag = 24; desenha(); });
    const tm = $('#g-tema'); if (tm) tm.onchange = () => { P1.tema = tm.value; P1.pag = 24; desenha(); };
    const od = $('#g-ord'); if (od) od.onchange = () => { P1.ord = od.value; desenha(); };
    const q1 = $('#g-q1'); if (q1) q1.oninput = () => { P1.txt = q1.value; P1.pag = 24; clearTimeout(BT); BT = setTimeout(() => { desenha(); const e = $('#g-q1'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 220); };
    const m1 = $('#g-mais1'); if (m1) m1.onclick = () => { P1.pag += 24; atualiza(); };
    // passo 2
    const tx = $('#g-txt'); if (tx) tx.oninput = () => { d.ideia.texto = tx.value; toque(); const on = temasIdeia(); $$('[data-g2]', root).forEach(b => { b.classList.toggle('on', on.has(b.dataset.g2)); b.setAttribute('aria-pressed', on.has(b.dataset.g2)); }); salvaConceito(); };
    $$('[data-g2]', root).forEach(b => b.onclick = () => { const k = b.dataset.g2; const agora = !b.classList.contains('on'); d.ideia.man[k] = agora; toque(); salvaConceito(); b.classList.toggle('on', agora); b.setAttribute('aria-pressed', agora); });
    const br = $('#g-br'); if (br) br.onchange = () => { d.alvo.br = br.value; toque(); salvaConceito(); $('#g-brtx').textContent = BR_TX[br.value || '']; };
    [['#g-teto', 'teto'], ['#g-tetoc', 'tetoCarta']].forEach(([s, k]) => { const el = $(s); if (el) el.onchange = () => { d.alvo[k] = el.value.trim(); toque(); salvaConceito(); }; });
    const pr = $('#g-par'); if (pr) pr.onclick = () => { d.passo = 4; Q.cmd = true; Q.txt = ''; toque(); desenha(); };
    const tc = $('#g-troca'); if (tc) tc.onclick = () => { if (Object.keys(d.cartas).length && !confirmar('Trocar de comandante? As cartas que não couberem nas cores novas vão ficar marcadas.')) return; d.cmds = []; d.passo = 1; d.ideia = { texto: '', man: null }; toque(); desenha(); };
    // passo 3
    $$('[data-slot]', root).forEach(b => b.onclick = () => { P3.slot = b.dataset.slot; P3.pag = 6; desenha(); });
    const todas = $('#g-todas'); if (todas) todas.onclick = () => { const ns = $$('[data-aceita]', root).map(b => b.dataset.aceita); const E = estado(); const kk = P3.slot || proximo(E); const slot = E.slots.find(x => x.k === kk); const falta = (slot ? Math.max(0, slot.alvo - slot.tem) : 0) || (kk !== 'lands' ? E.vagasSpells : 0) || ns.length; ns.slice(0, falta || ns.length).forEach(n => { if (!d.cartas[n]) d.cartas[n] = 1; }); toque(); atualiza(); };
    const m3 = $('#g-mais3'); if (m3) m3.onclick = () => { P3.pag += 6; atualiza(); };
    const dr = $('#g-desrec'); if (dr) dr.onclick = () => { d.recusadas = {}; toque(); atualiza(); };
    const au = $('#g-auto'); if (au) au.onclick = () => { P3.slot = ''; P3.pag = 6; atualiza(); };
    const gb = $('#g-bas'); if (gb) gb.onclick = () => { for (const [n, q] of planoBasicos(estado())) d.cartas[n] = (d.cartas[n] || 0) + q; toque(); atualiza(); };
    $$('[data-aceita]', root).forEach(b => b.onclick = () => { const n = b.dataset.aceita; if (!d.cartas[n]) d.cartas[n] = 1; toque(); atualiza(); });
    $$('[data-nao]', root).forEach(b => b.onclick = () => { d.recusadas[b.dataset.nao] = 1; toque(); atualiza(); });
  }
  return { painelCores, painelIdeia, painelJunto, passos, liga, imagens, perfil, estado, sugestoes, porque, nomeCores, salvaConceito };
})();
window.RAIOX_GUIADO = G;

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
    Q = { ...Q, txt: '', cmd: false, cor: '', pag: 40 }; if (d.cmds.length === 1 && d.passo < 2) { d.passo = 2; d.ideia = { texto: '', man: null }; } toque(); desenha(); { const t = $('.g-passos'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 80); }
    if (fora.length) msg(`Atenção: ${fora.length} carta(s) fora das cores do comandante: ${fora.slice(0, 5).join(', ')}.`);
  } else if (b.dataset.uncmd) { d.cmds = d.cmds.filter(x => x !== b.dataset.uncmd); Q.cmd = false; if (!d.cmds.length) d.passo = 1; toque(); desenha(); }
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
    // o Archidekt só libera a API para o site dele (CORS; conferido em 19/11/2026): de uma página estática não dá
    const el = $('#mt-imp-msg');
    if (el) el.innerHTML = `O Archidekt não deixa outros sites lerem os decks dele direto. Faça assim: <a href="https://archidekt.com/decks/${esc(m[1])}" target="_blank" rel="noopener">abra o deck no Archidekt</a> → menu <b>Export</b> (ou <b>Exportar</b>) → <b>Copy</b>, e cole o texto em "Importar texto" aqui.`;
  }
}

// a tela só é desenhada quando aberta (a base de cartas é grande)
function abre(t) { if (t !== 'montar') return; if (!S.atual || !S.decks[S.atual]) { const ids = Object.keys(S.decks); S.atual = ids[0] || null; if (!S.atual) novoDeck(); } desenha(); }
document.addEventListener('raiox:tela', (e) => abre(e.detail));
if (location.hash === '#montar') { ROOT() && (ROOT().hidden = false); abre('montar'); }
window.RAIOX_MONTAR = { texto: () => texto(), get deck() { return D(); }, deTexto };
})();
