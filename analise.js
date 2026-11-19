/* Raio-X do Deck: análise de qualquer deck de Commander a partir da lista colada. */
(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- base de cartas ----------
const DB = window.CARD_DB;
const F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const TAGS = DB.tags;
const IDX = {};
for (const n of Object.keys(DB.cards)) {
  IDX[norm(n)] = n;
  const front = n.split(' // ')[0]; if (!IDX[norm(front)]) IDX[norm(front)] = n;
}
for (const [fn, real] of Object.entries(DB.alias || {})) { if (!IDX[norm(fn)]) IDX[norm(fn)] = real; }
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim(); }
function C(name) {
  const e = DB.cards[name]; if (!e) return null;
  return { name, m: e[F.m], v: e[F.v], t: e[F.t], o: e[F.o], ci: e[F.ci], r: e[F.r], gc: !!e[F.gc], pm: e[F.pm], usd: e[F.usd], ban: !!e[F.ban], tags: e[F.tags].map(i => TAGS[i]), p: F.p != null ? e[F.p] : '' };
}

// ---------- Claude dentro da página (opcional) ----------
let SAMPLE = null;
if (window.claude && window.claude.use) window.claude.use('sample').then(s => { SAMPLE = s; $$('[data-claude]').forEach(b => { b.hidden = false; }); }).catch(() => {});

// ---------- leitura da lista ----------
const ANY_NUMBER = /A deck can have any number of cards named|A deck can have up to (seven|nine) cards named/;
// nomes em português: carregados de dados/nomes-pt.json quando existe ({"nome em português": "English name"})
const PTIDX = {};
function addPtNames(map) { for (const [pt, en] of Object.entries(map || {})) { const k = IDX[norm(en)] || (DB.cards[en] ? en : null); if (k && !PTIDX[norm(pt)]) PTIDX[norm(pt)] = k; } }
if (typeof fetch === 'function' && location.protocol !== 'file:') fetch('dados/nomes-pt.json').then(r => (r.ok ? r.json() : null)).then(m => { if (m) addPtNames(m); }).catch(() => {});
function lookupName(name) {
  const tries = [name, name.split(' // ')[0], name.split(' / ')[0]];
  for (const t of tries) { const k = IDX[norm(t)] || PTIDX[norm(t)]; if (k) return k; }
  return null;
}
// seções que aparecem nas exportações (Moxfield, Archidekt, LigaMagic, MTGO, MTGA), em inglês e português
const SEC_CMD = /^(commanders?|comandantes?|cmdr)$/;
const SEC_MAIN = /^(deck|main|mainboard|lista|companion|companheiro|creatures?|criaturas?|lands?|terrenos?|artifacts?|artefatos?|enchantments?|encantamentos?|instants?|instant[aâ]neas?|m[aá]gicas instant[aâ]neas|sorcer(y|ies)|feiti[cç]os?|planeswalkers?|batalhas?|battles?|other|outros?)$/;
const SEC_OUT = /^(sideboard|maybeboard|maybe|considering|side|reserva|tokens?|fichas?)\b/;
function parseList(text) {
  const out = { cards: [], cmdHint: [], unknown: [] };
  let section = 'main';
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim(); if (!line) continue;
    const head = line.replace(/^(\/\/|#)\s*/, '').replace(/:$/, '').replace(/\s*\(\d+\)$/, '').trim().toLowerCase();
    if (SEC_CMD.test(head)) { section = 'cmd'; continue; }
    if (SEC_MAIN.test(head)) { section = 'main'; continue; }
    if (SEC_OUT.test(head)) { section = 'out'; continue; }
    if (/^(\/\/|#)/.test(line) || section === 'out') continue;
    const isCmdTag = /\*CMDR\*|\[commander\]|\(commander\)/i.test(line);
    line = line.replace(/\*[A-Za-z]+\*/g, '').replace(/\[commander\]|\(commander\)/ig, '').replace(/\s+#.*$/, '').trim();
    // quantidade: "1 ", "1x ", "x1 "
    let q = 1; let m = line.match(/^(\d+)\s*x?\s+(.+)$/i) || line.match(/^x(\d+)\s+(.+)$/i);
    if (m) { q = +m[1]; line = m[2]; }
    // edição e número: "[SET]", "[SET:123]", "(SET) 123", " - SET", foil " F" / "*F*"
    let name = line.replace(/\s+\[[^\]]*\]\s*(\d+\S*)?$/, '').replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w★-]+)?$/, '').replace(/\s+[fF]$/, '').trim();
    const key = lookupName(name) || lookupName(line);
    if (!key) { out.unknown.push(name); continue; }
    if (section === 'cmd' || isCmdTag) out.cmdHint.push(key);
    for (let i = 0; i < q; i++) out.cards.push(key);
  }
  return out;
}
function canBeCommander(c) { return (/Legendary/.test(c.t.split(' // ')[0]) && /Creature/.test(c.t.split(' // ')[0])) || /can be your commander/.test(c.o); }
function guessCommanders(p) {
  if (p.cmdHint.length) return [...new Set(p.cmdHint)].slice(0, 2);
  const legends = [...new Set(p.cards)].map(C).filter(canBeCommander);
  const allCI = new Set(p.cards.map(n => C(n).ci).join('').split(''));
  // o comandante cobre toda a identidade de cor do deck
  const covers = legends.filter(l => [...allCI].every(c => l.ci.includes(c)));
  const first = C(p.cards[0]);
  if (first && canBeCommander(first) && covers.some(l => l.name === first.name)) return [first.name];
  if (covers.length) return [covers.sort((a, b) => (a.r || 1e6) - (b.r || 1e6))[0].name];
  return legends.length ? [legends[0].name] : [];
}

// ---------- temas ----------
const THEMES = [
  { k: 'voltron', n: 'Auras e equipamentos', rx: /Equipped creature|Enchanted creature|\bEquip\b|Aura spell|Equipment you control|Aura you control|attached to/, type: /Aura|Equipment/ },
  { k: 'tokens', n: 'Fichas', rx: /create[^.]*tokens?|tokens? you control/i },
  { k: 'counters', n: 'Marcadores +1/+1', rx: /\+1\/\+1 counter/ },
  { k: 'graveyard', n: 'Cemitério', rx: /from (your|a) graveyard|graveyard to|mill|in your graveyard|dredge|flashback|escape|unearth/i },
  { k: 'artifacts', n: 'Artefatos', rx: /artifacts? you control|artifact spell|artifact enters|artifact creature|artifact card|Treasure|for each artifact|Metalcraft|Affinity for artifacts|Improvise/i, typeIfCmd: /Artifact/ },
  { k: 'enchant', n: 'Encantamentos', rx: /enchantments? you control|enchantment spell|Constellation|enchantment enters/i, typeIfCmd: /Enchantment/ },
  { k: 'spells', n: 'Mágicas (instantâneas e feitiços)', rx: /instant or sorcery|noncreature spell|Magecraft|Prowess|copy (target|that) (instant|spell)/i },
  { k: 'sac', n: 'Sacrifício e morte', rx: /Sacrifice (a|another) (creature|permanent|artifact)|whenever (a|another) (creature|nontoken creature) (you control )?dies|whenever .* dies/i },
  { k: 'life', n: 'Ganho de vida', rx: /whenever you gain life|gain \d+ life|lifelink/i },
  { k: 'lands', n: 'Terrenos (landfall)', rx: /Landfall|whenever a land enters|additional land|play lands from/i },
  { k: 'combat', n: 'Ataque e combate', rx: /whenever [^.]* attacks|additional combat|extra combat|attacking creatures|haste|double strike|deals combat damage to a player/i },
  { k: 'draw', n: 'Comprar muitas cartas', rx: /whenever you draw|second card each turn|draw (two|three|an additional)/i },
];
function themesOf(c, cmdThemes) {
  const out = new Set();
  for (const th of THEMES) if (th.rx.test(c.o) || (th.type && th.type.test(c.t)) || (cmdThemes && th.typeIfCmd && cmdThemes.has(th.k) && th.typeIfCmd.test(c.t.split(' // ')[0]))) out.add(th.k);
  return out;
}
function subtypes(c) { const right = (c.t.split(' // ')[0].split(' — ')[1] || ''); return /Creature|Kindred|Tribal/.test(c.t) ? right.split(' ').filter(Boolean) : []; }

// ---------- funções ----------
const ROLES = [
  { k: 'ramp', n: 'Ramp', tags: ['ramp', 'mana-rock', 'mana-dork', 'land-ramp', 'ritual', 'cost-reducer'] },
  { k: 'draw', n: 'Compra de cartas', tags: ['draw', 'card-advantage', 'impulse-draw'] },
  { k: 'removal', n: 'Remoção pontual', tags: ['spot-removal', 'creature-removal', 'artifact-removal', 'enchantment-removal'] },
  { k: 'wipe', n: 'Limpa-mesa', tags: ['board-wipe'] },
  { k: 'protect', n: 'Proteção', tags: ['protection', 'gives-hexproof', 'gives-indestructible'] },
  { k: 'counter', n: 'Contramágica', tags: ['counterspell'] },
  { k: 'recursion', n: 'Recursão', tags: ['recursion', 'reanimate'] },
  { k: 'tutor', n: 'Tutores', tags: ['tutor'] },
  { k: 'threat', n: 'Ameaça / finalizador', tags: [] },
  { k: 'drain', n: 'Dreno e dano aos oponentes', tags: ['lifedrain', 'group-slug', 'burn-player'], rx: /each opponent loses|deals? \d+ damage to each opponent|loses life equal|Extort/ },
  { k: 'tokens', n: 'Fichas', tags: [], rx: /create[^.]*tokens?/i },
  { k: 'copy', n: 'Cópia e clone', tags: ['clone', 'copy-permanent', 'copy-spell'], rx: /enter as a copy|Copy target|create a token that's a copy/ },
  { k: 'blink', n: 'Sumir e voltar (blink)', tags: ['flicker'], rx: /exile [^.]*then return (it|that card|those cards) to the battlefield/ },
  { k: 'stax', n: 'Travar os oponentes', tags: ['tax', 'hatebear', 'lockdown', 'cost-increaser'], rx: /opponents? can't (cast|activate|search|draw)|can't cast spells|cost \{\d\} more|No more than (one|two) creatures? can|Nonbasic lands are|opponents control enter tapped|If an opponent would search/ },
  { k: 'amplify', n: 'Multiplicadores (gatilho, mana, desvirar)', tags: ['trigger-doubler', 'mana-doubler', 'untapper'], rx: /triggers? an additional time|Untap all|twice that many|double the (power|number|amount)|deals? (double|triple|twice|three times) that damage|lose twice that much|that much damage plus|put that many plus/i },
  { k: 'combat', n: 'Bônus de combate e evasão', tags: ['gives-unblockable', 'gives-evasion', 'anthem', 'combat-trick', 'gives-trample', 'gives-haste'], rx: /creatures you control get \+|can't be blocked|gain trample|double strike/ },
  { k: 'gyhate', n: 'Contra cemitério', tags: ['graveyard-hate'] },
  { k: 'sac', n: 'Sacrifício', tags: ['sacrifice-outlet', 'edict'] },
  { k: 'steal', n: 'Roubar permanentes', tags: ['theft', 'threaten'] },
  { k: 'cardflow', n: 'Filtrar a mão (descartar e comprar)', tags: ['discard-outlet', 'wheel', 'cantrip'] },
  { k: 'lifegain', n: 'Ganho de vida', tags: ['lifegain'] },
  { k: 'counters', n: 'Marcadores +1/+1', tags: ['counters-matter'] },
  { k: 'animate', n: 'Animar permanentes', tags: ['animate'] },
  { k: 'extra', n: 'Turno ou combate extra', tags: ['extra-turn', 'extra-combat'] },
  { k: 'politics', n: 'Política (goad, monarca, acordos)', tags: [], rx: /\bGoad|goaded|become the monarch|the monarch|Council's dilemma|Will of the council|each player may/ },
  { k: 'speed', n: 'Acelerar o jogo (flash, de graça)', tags: [], rx: /as though (it|they) had flash|without paying (its|their) mana costs?|begin the game with it on the battlefield/ },
  { k: 'body', n: 'Corpo (criatura sem habilidade relevante)', tags: [] },
  { k: 'enabler', n: 'Habilitador de sinergia', tags: [] },
  { k: 'wincon', n: 'Plano de vitória ou defesa', tags: [] },
];
function rolesOf(c) {
  const s = new Set(); for (const r of ROLES) if (r.tags.some(t => c.tags.includes(t)) || (r.rx && r.rx.test(c.o))) s.add(r.k); if (s.has('wipe')) s.delete('removal');
  const ia = (typeof window !== 'undefined' && window.PAPEIS_IA) ? window.PAPEIS_IA[c.name] : null; if (ia) for (const k of ia.p) s.add(k);
  const front = c.t.split(' // ')[0], o = c.o.split('\n//\n')[0];
  if (/can't lose the game|win the game|opponents can't win|loses the game|Creatures can't attack you unless/.test(o)) s.add('wincon');
  if (/choose new targets? for target spell|change the target of target spell|Counter target (spell|activated|triggered)/i.test(o)) s.add(/Counter target/.test(o) ? 'counter' : 'protect');
  const pw = parseInt(String(c.p || '').split(' // ')[0]);
  if (/Planeswalker/.test(front) || (/Creature/.test(front) && ((pw >= 5) || (pw >= 3 && /Flying|Trample|Menace|Double strike|Infect|Indestructible/i.test(o)) || /power is equal to the number|\*/.test(String(c.p || ''))))) s.add('threat');
  return s;
}
const isLand = (c) => /Land/.test(c.t.split(' // ')[0]);
const isMdfcLand = (c) => !isLand(c) && /Land/.test(c.t.split(' // ')[1] || '');

// ---------- análise ----------
function analyze(text, forcedCmd) {
  const p = parseList(text);
  if (!p.cards.length) return { empty: true, unknown: p.unknown };
  const cmds = forcedCmd && forcedCmd.length ? forcedCmd : guessCommanders(p);
  const deck = p.cards.slice();
  // o comandante pode ou não estar na lista: tiramos uma cópia
  for (const c of cmds) { const i = deck.indexOf(c); if (i >= 0) deck.splice(i, 1); }
  const cmdCards = cmds.map(C);
  const ident = new Set(cmdCards.map(c => c.ci).join('').split('').filter(Boolean));
  const cards = deck.map(C);
  const uniq = [...new Set(deck)].map(C);
  const A = { cmds: cmdCards, ident, cards, uniq, unknown: p.unknown, total: deck.length + cmds.length, issues: [] };

  // regras
  const counts = {}; deck.forEach(n => (counts[n] = (counts[n] || 0) + 1));
  A.dupes = Object.entries(counts).filter(([n, q]) => q > 1 && !/Basic Land/.test(C(n).t) && !ANY_NUMBER.test(C(n).o)).map(([n, q]) => [n, q]);
  A.offColor = uniq.filter(c => c.ci.split('').some(x => x && !ident.has(x)));
  A.banned = uniq.concat(cmdCards).filter(c => c.ban);
  A.legendCandidates = [...new Set(p.cards)].map(C).filter(canBeCommander).map(c => c.name);

  // funções e curva
  const nonland = cards.filter(c => !isLand(c));
  A.lands = cards.filter(isLand).length; A.mdfc = cards.filter(isMdfcLand).length;
  A.avgMV = nonland.length ? nonland.reduce((s, c) => s + c.v, 0) / nonland.length : 0;
  A.curve = Array(8).fill(0); nonland.forEach(c => A.curve[Math.min(7, Math.floor(c.v))]++);
  A.byRole = Object.fromEntries(ROLES.map(r => [r.k, []]));
  for (const c of cards) for (const r of rolesOf(c)) A.byRole[r].push(c.name);
  for (const r of ROLES) A.byRole[r.k] = [...new Set(A.byRole[r.k])].map(n => [n, counts[n] || 1]);
  const cnt = (k) => A.byRole[k].reduce((s, [, q]) => s + q, 0);
  A.cheapRamp = cards.filter(c => !isLand(c) && c.v <= 2 && rolesOf(c).has('ramp')).length;
  A.recLands = Math.max(31, Math.min(40, Math.round(31 + 2 * A.avgMV - 0.3 * Math.max(0, A.cheapRamp - 6))));
  const blue = ident.has('U');
  A.refs = [
    { k: 'lands', n: 'Terrenos', have: A.lands + A.mdfc * 0.5, lo: A.recLands - 1, hi: A.recLands + 2, why: `Com custo médio ${A.avgMV.toFixed(2)} e ${A.cheapRamp} ramps baratos, o recomendado é por volta de ${A.recLands}. Terreno de menos trava a mão; demais faz faltar ação no fim do jogo.` },
    { k: 'ramp', n: 'Ramp', have: cnt('ramp'), lo: 10, hi: 15, why: 'Mana extra cedo põe você um turno à frente da mesa. Ramp de 2 manas vale mais que o de 4.' },
    { k: 'draw', n: 'Compra de cartas', have: cnt('draw'), lo: 10, hi: 16, why: 'Em mesa de 4 jogadores, quem fica sem cartas na mão perde. Prefira fontes que compram mais de uma vez.' },
    { k: 'removal', n: 'Remoção pontual', have: cnt('removal'), lo: 8, hi: 12, why: 'Responde ao comandante dos outros e às peças que viram o jogo. Instantâneas e baratas valem mais.' },
    { k: 'wipe', n: 'Limpa-mesa', have: cnt('wipe'), lo: 2, hi: 4, why: 'Salva você quando alguém dispara na frente. Deck de criaturas usa menos; deck de controle usa mais.' },
    { k: 'protect', n: 'Proteção', have: cnt('protect'), lo: 3, hi: 8, why: 'Segura o plano quando a mesa tenta remover sua peça principal. Importa mais quanto mais o deck depende de uma criatura.' },
  ];
  A.plano = null; // precisa de cmdThemes: preenchido mais abaixo
  if (blue) A.refs.push({ k: 'counter', n: 'Contramágica', have: cnt('counter'), lo: 2, hi: 8, why: 'Com azul, guardar mana para anular a jogada que ganharia o jogo é a melhor interação.' });

  // cores
  const pips = {}; for (const x of ident) pips[x] = 0;
  for (const c of nonland) (c.m.split(' // ')[0].match(/\{[^}]+\}/g) || []).forEach(s => { const parts = s.slice(1, -1).split('/'); const cols = parts.filter(x => /[WUBRG]/.test(x)); cols.forEach(x => { if (x in pips) pips[x] += 1 / cols.length; }); });
  const sources = {}; for (const x of ident) sources[x] = 0;
  let tapped = 0;
  for (const c of cards) {
    const mana = isLand(c) || c.tags.includes('mana-rock') || c.tags.includes('mana-dork');
    if (!mana) continue;
    const any = /any color|one mana of any color|in your commander's color identity/.test(c.o);
    for (const x of ident) if (any || c.pm.includes(x)) sources[x]++;
    if (isLand(c) && /enters tapped\./.test(c.o) && !/unless|you may pay|If you don't/.test(c.o)) tapped++;
  }
  A.pips = pips; A.sources = sources; A.tapped = tapped;
  const totalPips = Object.values(pips).reduce((a, b) => a + b, 0) || 1;
  A.colorNeed = Object.fromEntries([...ident].map(x => { const share = pips[x] / totalPips; return [x, share >= 0.3 ? 16 : share >= 0.12 ? 12 : 8]; }));

  // temas e plano
  const cmdThemes = new Set(); cmdCards.forEach(c => themesOf(c).forEach(t => cmdThemes.add(t)));
  A.cmdThemes = cmdThemes;
  const themeCount = Object.fromEntries(THEMES.map(t => [t.k, []]));
  for (const c of uniq) if (!isLand(c)) for (const t of themesOf(c, cmdThemes)) themeCount[t].push(c.name);
  // tribo
  const tribe = {}; cards.filter(c => /Creature/.test(c.t)).forEach(c => subtypes(c).forEach(s => (tribe[s] = (tribe[s] || 0) + 1)));
  const topTribe = Object.entries(tribe).sort((a, b) => b[1] - a[1])[0];
  A.tribe = topTribe && topTribe[1] >= 10 ? topTribe : null;
  A.themes = THEMES.map(t => ({ ...t, cards: themeCount[t.k], cmd: cmdThemes.has(t.k) })).filter(t => t.cards.length >= 6 || t.cmd).sort((a, b) => (b.cmd - a.cmd) || b.cards.length - a.cards.length);
  // plano do comandante: deck de voltron troca parte da remoção por proteção (guias pedem 8–12 proteções)
  A.plano = planoDe(A);
  if (A.plano.voltron) {
    const rp = A.refs.find(r => r.k === 'protect'); if (rp) Object.assign(rp, { lo: 7, hi: 14, why: `${A.plano.nome} carrega o deck: uma remoção nele leva junto as auras e equipamentos. Deck de voltron costuma ter 8–12 proteções.` });
    const rr = A.refs.find(r => r.k === 'removal'); if (rr) Object.assign(rr, { lo: 5, hi: 10, why: 'Deck que vence atacando com o comandante usa um pouco menos de remoção e mais proteção; prefira as baratas e instantâneas.' });
  }
  // dependência do comandante
  const supportsCmd = (c) => [...themesOf(c, cmdThemes)].some(t => cmdThemes.has(t)) || (A.tribe && cmdCards.some(k => subtypes(k).includes(A.tribe[0])) && subtypes(c).includes(A.tribe[0]));
  const singleTarget = (c) => /Aura/.test(c.t) && /Enchant creature/.test(c.o) || /Equipment/.test(c.t);
  A.cmdSupport = uniq.filter(c => !isLand(c) && supportsCmd(c)).map(c => c.name);
  A.voltronCards = uniq.filter(singleTarget).map(c => c.name);
  A.standalone = uniq.filter(c => !isLand(c) && !supportsCmd(c) && (rolesOf(c).size || themesOf(c, cmdThemes).size)).map(c => c.name);
  A.bodyOnly = uniq.filter(c => !isLand(c) && [...rolesOf(c)].every(k => k === 'body') && rolesOf(c).size && !themesOf(c, cmdThemes).size).map(c => c.name);
  A.noRole = uniq.filter(c => !isLand(c) && !rolesOf(c).size && !themesOf(c, cmdThemes).size && !(A.tribe && subtypes(c).includes(A.tribe[0]))).map(c => c.name);

  // nível de poder
  A.gc = uniq.filter(c => c.gc).map(c => c.name).concat(cmdCards.filter(c => c.gc).map(c => c.name));
  A.tutorCards = uniq.filter(isTutor); A.tutors = A.tutorCards.length;
  A.extraTurns = uniq.filter(c => c.tags.includes('extra-turn')).map(c => c.name);
  A.mld = uniq.filter(c => c.tags.includes('mass-land-denial')).map(c => c.name);
  let br = 2, why = [];
  if (A.gc.length) { br = 3; why.push(`${A.gc.length} carta(s) da lista de "game changers"`); }
  if (A.gc.length > 3) { br = 4; }
  if (A.mld.length) { br = 4; why.push('destruição de terrenos em massa'); }
  if (A.extraTurns.length >= 2) { br = Math.max(br, 3); why.push(`${A.extraTurns.length} cartas de turno extra`); }
  if (A.tutors >= 4) { br = Math.max(br, 3); why.push(`${A.tutors} tutores`); }
  if (br === 2 && A.avgMV < 2.6 && cnt('ramp') >= 12 && A.tutors >= 2) { br = 3; why.push('curva baixa com muito ramp'); }
  A.bracket = br; A.bracketWhy = why;

  // preço e popularidade
  A.price = cards.concat(cmdCards).reduce((s, c) => s + (c.usd || 0), 0);
  A.pricey = uniq.concat(cmdCards).filter(c => c.usd >= 15).sort((a, b) => b.usd - a.usd).slice(0, 6);
  A.obscure = uniq.filter(c => !isLand(c) && (!c.r || c.r > 12000)).map(c => c.name);

  // problemas e prioridades
  const I = A.issues;
  if (A.total !== 100) I.push({ sev: 3, area: 'Regras', t: `O deck tem ${A.total} cartas contando o comandante; Commander pede exatamente 100.` });
  if (A.dupes.length) I.push({ sev: 3, area: 'Regras', t: `Cartas repetidas (só pode 1 de cada, fora terrenos básicos): ${A.dupes.map(([n, q]) => `${n} ×${q}`).join(', ')}.` });
  if (A.offColor.length) I.push({ sev: 3, area: 'Regras', t: `Fora da identidade de cor do comandante: ${A.offColor.map(c => c.name).join(', ')}.` });
  if (A.banned.length) I.push({ sev: 3, area: 'Regras', t: `Banida no Commander: ${A.banned.map(c => c.name).join(', ')}.` });
  for (const r of A.refs) {
    if (r.have < r.lo) I.push({ sev: r.have < r.lo - 3 ? 2 : 1, area: 'Funções', t: `${r.n}: ${fmt(r.have)} (o normal é ${r.lo}–${r.hi}). ${r.why}`, role: r.k, gap: r.lo - r.have });
    else if (r.have > r.hi && r.k === 'lands') I.push({ sev: 1, area: 'Funções', t: `Terrenos: ${fmt(r.have)}, acima do necessário para a sua curva (${r.lo}–${r.hi}). O excedente pode virar ação: veja a aba Trocas.` });
    else if (r.have > r.hi) I.push({ sev: 1, area: 'Funções', t: `${r.n}: ${fmt(r.have)}, acima da faixa comum (${r.lo}–${r.hi}). As que sobram podem pagar as funções que faltam: veja a aba Trocas.` });
  }
  if (A.avgMV > 3.6) I.push({ sev: A.avgMV > 4 ? 2 : 1, area: 'Curva', t: `Custo médio ${A.avgMV.toFixed(2)} é alto. Você vai passar os primeiros turnos sem jogar nada se não tiver ramp de sobra.` });
  for (const x of ident) if (A.pips[x] >= 1 && A.sources[x] < A.colorNeed[x]) I.push({ sev: A.sources[x] < A.colorNeed[x] - 4 ? 2 : 1, area: 'Cores', t: `${COLORNAME[x]}: ${A.sources[x]} fontes de mana para ${A.pips[x].toFixed(0)} símbolos ${COLORADJ[x]} nas cartas. Recomendado: ${A.colorNeed[x]} ou mais.` });
  if (A.tapped > 6) I.push({ sev: 1, area: 'Cores', t: `${A.tapped} terrenos sempre entram virados. Cada um atrasa uma jogada; acima de 6 começa a pesar.` });
  if (A.noRole.length > 8) I.push({ sev: 1, area: 'Foco', t: `${A.noRole.length} cartas não têm função clara nem conversam com os temas do deck. São as primeiras candidatas a corte.` });
  if (A.voltronCards.length >= 15 && cnt('protect') < 6) I.push({ sev: 2, area: 'Foco', t: `${A.voltronCards.length} auras e equipamentos com só ${cnt('protect')} proteções: uma remoção na criatura certa leva várias cartas junto.` });
  I.sort((a, b) => b.sev - a.sev || (b.gap || 0) - (a.gap || 0));
  A.verdict = I.some(i => i.sev === 3) ? { k: 'bad', t: 'O deck tem problemas de regra para resolver antes de jogar.' } : I.filter(i => i.sev >= 2).length >= 2 ? { k: 'warn', t: 'O deck tem buracos importantes. Comece pelas prioridades abaixo.' } : I.length ? { k: 'ok', t: 'O deck é sólido, com ajustes finos para fazer.' } : { k: 'good', t: 'O deck está bem montado nos pontos que dá para medir pela lista.' };
  return A;
}
const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(1));
// tutor para o bracket: procura carta no grimório que não seja só terreno (Rampant Growth não conta)
const isTutor = (c) => c.tags.includes('tutor') && !/land|forest|plains|island|swamp|mountain/i.test(((c.o || '').match(/search(?:es)? (?:your|their) library for [^.]*/i) || [''])[0]);
// ---------- preços em reais ----------
// Os preços da base vêm do Scryfall em dólar; aqui viram reais pela cotação do dia (AwesomeAPI), guardada por 12 h.
// Sem internet para a cotação, usa a reserva abaixo.
let USD_BRL = 5.56, USD_BRL_INFO = 'cotação de 11/11/2026';
const brlTxt = (usd, cents) => 'R$ ' + ((usd || 0) * USD_BRL).toLocaleString('pt-BR', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const brl = (usd, cents) => `<span data-usd="${usd || 0}"${cents ? ' data-cents="1"' : ''}>${brlTxt(usd, cents)}</span>`;
const toUsd = (reais) => (reais > 0 ? reais / USD_BRL : Infinity);
(function cotacao() {
  const pinta = () => { document.querySelectorAll('[data-usd]').forEach(el => { el.textContent = brlTxt(+el.dataset.usd, !!el.dataset.cents); }); document.querySelectorAll('[data-cotacao]').forEach(el => { el.textContent = USD_BRL_INFO; }); };
  try { const c = JSON.parse(localStorage.getItem('raiox:usdbrl') || 'null'); if (c && Date.now() - c.t < 12 * 3600e3) { USD_BRL = c.v; USD_BRL_INFO = c.info; } } catch (e) {}
  fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL').then(r => r.json()).then(j => {
    const v = +(j.USDBRL && j.USDBRL.bid); if (!(v > 3 && v < 12)) return;
    const d = new Date((+j.USDBRL.timestamp || Date.now() / 1000) * 1000);
    USD_BRL = v; USD_BRL_INFO = `dólar a R$ ${v.toFixed(2).replace('.', ',')} em ${d.toLocaleDateString('pt-BR')}`;
    try { localStorage.setItem('raiox:usdbrl', JSON.stringify({ v, info: USD_BRL_INFO, t: Date.now() })); } catch (e) {}
    pinta();
  }).catch(() => {});
})();
const COLORNAME = { W: 'Branco', U: 'Azul', B: 'Preto', R: 'Vermelho', G: 'Verde' };
const COLORADJ = { W: 'brancos', U: 'azuis', B: 'pretos', R: 'vermelhos', G: 'verdes' };

// sugestões: opções para estudar (nunca adiciona sozinho)
function suggestions(A, roleK, n = 8) {
  const role = ROLES.find(r => r.k === roleK); if (!role) return [];
  const inDeck = new Set(A.uniq.map(c => c.name).concat(A.cmds.map(c => c.name)));
  const out = [];
  for (const name of Object.keys(DB.cards)) {
    if (inDeck.has(name)) continue;
    const c = C(name);
    if (c.ban || !c.r) continue;
    if (!c.ci.split('').every(x => !x || A.ident.has(x))) continue;
    if (!role.tags.some(t => c.tags.includes(t))) continue;
    if (roleK === 'removal' && c.tags.includes('board-wipe')) continue;
    out.push(c);
  }
  return out.sort((a, b) => a.r - b.r).slice(0, n);
}

// ---------- desenho ----------
function manaHTML(m) { return (m || '').split(' // ')[0].replace(/\{([^}]+)\}/g, (_, s) => { const c = s.includes('/') ? s.split('/')[0] : s; return `<span class="ms ${/^[WUBRG]$/.test(c) ? c : ''}">${/^[WUBRG]$/.test(c) ? '' : esc(s)}</span>`; }); }
const cardLink = (n) => `<button class="cn" data-card="${esc(n)}">${esc(n)}</button>`;
const listLinks = (arr, max = 40) => arr.slice(0, max).map(cardLink).join('') + (arr.length > max ? `<span class="note"> e mais ${arr.length - max}</span>` : '');

let LAST = null;
window.RAIOX = { THEMES, themesOf, valorPlano: (A, c) => valorPlano(A, c), edhPagina: (c) => edhPagina(c), edhJa: (c) => edhJa(c), edhCmdCam: (n) => edhCmdCam(n), edhIdeia: (t, i, tb) => edhIdeia(t, i, tb), edhCarta: (I, c) => edhCarta(I, c), edhNota: (I, c) => edhNota(I, c), edhPorque: (I, c) => edhPorque(I, c), planoDe: (A) => planoDe(A), tipoRamp: (c) => tipoRamp(c), get RAMP_N() { return RAMP_N; }, efeitos: (c) => efeitos(c), subtypes, CONCEITOS: null, COLORNAME, parseList, guessCommanders, C, rolesOf, isLand, lookupName: (n) => lookupName(n), analyze, ROLES, canBeCommander, norm, brl, brlTxt, manaHTML, cardLink, isTutor, ANY_NUMBER, DB, PTIDX, run: (cmds, goTo) => run(cmds, goTo), get usd() { return USD_BRL; }, swaps: () => SWAPS.map((s, i) => ({ out: s.out, inn: s.inn, on: !!SWAP_ON[i] })), imgFor: (n, v) => imgFor(n, v), imgsDe: (l) => imgsDe(l), get imgCache() { return IMGC; }, get last() { return LAST; } };
function run(forcedCmd, goTo) {
  const text = $('#deck-in').value;
  const A = analyze(text, forcedCmd);
  const out = $('#out');
  if (A.empty) { $('#go-msg').textContent = 'Não reconheci nenhuma carta.' + (A.unknown.length ? ' Exemplos do que não achei: ' + A.unknown.slice(0, 5).join(', ') : ''); return; }
  LAST = A;
  $('#go-msg').textContent = '';
  loadConcept(A);
  out.innerHTML = render(A);
  wire(A); wireConcept(A); wireSwaps(A);
  document.dispatchEvent(new CustomEvent('raiox:deck', { detail: A }));
  // EDHREC ainda não veio para este comandante: busca e refaz a análise uma vez (fica guardado 7 dias)
  // página do comandante no EDHREC (só informação): busca uma vez e redesenha as trocas
  if (A.cmds.length && !edhJa(edhCmdCam(A.cmds.map(c => c.name)))) edhPagina(edhCmdCam(A.cmds.map(c => c.name))).then(e => { if (e && !e.erro && LAST === A) rerenderTrocas(A); });
  const dest = goTo || 'resumo';
  if (location.hash === '#' + dest) show(dest); else location.hash = dest;
}

function render(A) {
  const cmdNames = A.cmds.map(c => c.name);
  const ident = [...A.ident];
  const identHTML = ident.length ? ident.map(x => `<span class="ms ${x}"></span>`).join('') : '<span class="ms">C</span>';
  const pri = A.issues.slice(0, 3);
  const sevName = ['', 'ajuste', 'importante', 'regra'];
  const refRows = A.refs.map(r => { const st = r.have < r.lo ? 'low' : r.have > r.hi ? 'high' : 'ok'; const max = Math.max(r.hi + 4, r.have + 1); return `<div class="ref">
      <div class="ref-h"><b>${r.n}</b><span class="num st-${st}">${fmt(r.have)}</span></div>
      <div class="gauge" role="img" aria-label="${r.n}: ${fmt(r.have)}, faixa ${r.lo} a ${r.hi}"><span class="band" style="left:${100 * r.lo / max}%;width:${100 * (r.hi - r.lo) / max}%"></span><span class="mark st-${st}" style="left:${Math.min(100, 100 * r.have / max)}%"></span></div>
      <div class="note">faixa comum ${r.lo}–${r.hi}</div>
      <p>${r.why}</p>
      ${r.k !== 'lands' && A.byRole[r.k] ? `<details><summary>Cartas que contam (${A.byRole[r.k].length})</summary><div class="links">${listLinks(A.byRole[r.k].map(([n]) => n))}</div></details>` : ''}
      ${r.have < r.lo && r.k !== 'lands' ? `<details class="sug"><summary>Opções para estudar</summary><p class="note">As mais jogadas nas suas cores que você ainda não tem. Quem escolhe é você.</p><div class="links">${suggestions(A, r.k).map(c => cardLink(c.name)).join('')}</div></details>` : ''}
    </div>`; }).join('');
  const maxC = Math.max(...A.curve, 1);
  const W = 460, H = 170, bw = (W - 40) / 8;
  const curveSvg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de mana">${[0, .5, 1].map(f => `<line x1="34" x2="${W}" y1="${12 + (H - 40) * (1 - f)}" y2="${12 + (H - 40) * (1 - f)}" stroke="var(--line)"/><text x="28" y="${16 + (H - 40) * (1 - f)}" fill="var(--ink-3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">${Math.round(maxC * f)}</text>`).join('')}${A.curve.map((c, i) => { const h = (H - 40) * c / maxC; const x = 38 + i * bw; return `<rect x="${x}" y="${12 + (H - 40) - h}" width="${bw - 8}" height="${Math.max(0, h)}" rx="3" fill="var(--accent)"/><text x="${x + (bw - 8) / 2}" y="${H - 12}" fill="var(--ink-2)" font-size="12" text-anchor="middle" font-family="JetBrains Mono, monospace">${i === 7 ? '7+' : i}</text>${c ? `<text x="${x + (bw - 8) / 2}" y="${8 + (H - 40) - h}" fill="var(--ink)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">${c}</text>` : ''}`; }).join('')}</svg>`;
  const colorRows = ident.map(x => { const need = A.colorNeed[x], have = A.sources[x]; const max = Math.max(need, have, 20); return `<div class="crow"><span class="ms ${x}"></span><span>${COLORNAME[x]}</span><span class="track"><span class="fill ${have < need ? 'short' : ''}" style="width:${100 * have / max}%"></span><span class="need" style="left:${100 * need / max}%"></span></span><span class="num">${have}/${need}</span><span class="note num">${A.pips[x].toFixed(0)} símbolos</span></div>`; }).join('');
  const themeRows = A.themes.slice(0, 6).map(t => `<div class="theme"><div class="theme-h"><b>${t.n}</b>${t.cmd ? '<span class="tag cmd">o comandante pede</span>' : ''}<span class="num">${t.cards.length}</span></div><div class="links">${listLinks(t.cards, 24)}</div></div>`).join('') || '<p class="note">Nenhum tema forte apareceu. O deck pode ser uma pilha de cartas boas sem um plano em comum, o que costuma ser mais fraco que um deck focado.</p>';
  const nonlandU = A.uniq.filter(c => !isLand(c)).length || 1;
  const depPct = Math.round(100 * A.cmdSupport.length / nonlandU);
  const bracketTxt = { 2: 'Bracket 2 (núcleo): o nível de um deck pré-montado bem ajustado.', 3: 'Bracket 3 (melhorado): cartas fortes, mas sem combos rápidos nem trava de terrenos.', 4: 'Bracket 4 (otimizado): sem restrições, pensado para ganhar rápido.' }[A.bracket];
  return `
  <div class="screen" data-s="resumo">
  <section class="head panel">
    <div class="who"><div class="cmdname">${cmdNames.map(esc).join(' + ') || 'Comandante não encontrado'}</div><div class="ident">${identHTML}</div>
      <div class="stats">
        <div class="stat price"><span class="k">Preço do deck</span><b>${brl(A.price)}</b>${A.pricey && A.pricey.length ? `<small>Mais caras: ${A.pricey.slice(0, 3).map(c => `${esc(c.name)} (${brl(c.usd)})`).join(' · ')}</small>` : ''}<small class="cot">Preços do Scryfall convertidos: <span data-cotacao>${USD_BRL_INFO}</span></small>${''}</div>
        <div class="stat"><span class="k">Cartas</span><b>${A.total}</b></div>
        <div class="stat"><span class="k">Custo médio</span><b>${A.avgMV.toFixed(2)}</b></div>
        <div class="stat"><span class="k">Terrenos</span><b>${A.lands}</b>${A.mdfc ? `<small>+ ${A.mdfc} de duas faces</small>` : ''}</div>
      </div>
      ${A.legendCandidates.length > 1 ? `<label class="field">Trocar comandante <select id="cmd-pick">${A.legendCandidates.map(n => `<option ${cmdNames.includes(n) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}</div>
    <div class="verdict v-${A.verdict.k}">${A.verdict.t}</div>
    ${A.unknown.length ? `<p class="note">Não reconheci ${A.unknown.length} linha(s): ${esc(A.unknown.slice(0, 6).join(', '))}${A.unknown.length > 6 ? '…' : ''}. Confira a grafia em inglês.</p>` : ''}
  </section>
  <section class="panel">
    <h2>O que melhorar primeiro</h2>
    ${pri.length ? `<ol class="pri">${pri.map(i => `<li><span class="sev s${i.sev}">${sevName[i.sev]}</span> <span class="area">${i.area}</span> ${esc(i.t)}</li>`).join('')}</ol>` : '<p>Nada urgente. Os detalhes abaixo mostram onde ainda dá para afinar.</p>'}
    ${A.issues.length > 3 ? `<details><summary>Outros pontos (${A.issues.length - 3})</summary><ul class="pri">${A.issues.slice(3).map(i => `<li><span class="sev s${i.sev}">${sevName[i.sev]}</span> <span class="area">${i.area}</span> ${esc(i.t)}</li>`).join('')}</ul></details>` : ''}
    <div class="ask"><button class="btn" data-claude hidden id="ask-all">Pedir a leitura do Claude</button><div class="ai-ans" id="ans-all" hidden></div></div>
    <div class="row"><a class="btn primary" href="#trocas">Ver as trocas sugeridas, carta por carta</a></div>
  </section>
  <div class="grid2">
    <section class="panel"><h2>Quanto o deck depende do comandante</h2>
      <div class="big num">${depPct}%</div>
      <p>${A.cmdSupport.length} das ${nonlandU} cartas que não são terreno puxam para o mesmo tema do comandante. ${depPct >= 60 ? 'O deck é construído em volta dele: se ele cair, boa parte das cartas perde força. Proteção e um plano B importam muito.' : depPct >= 35 ? 'Equilibrado: o comandante ajuda, mas o deck tem jogo sem ele.' : 'O deck joga sozinho; o comandante é um bônus. Vale treinar a ganhar sem ele na mesa.'}</p>
      ${A.voltronCards.length ? `<p class="note">${A.voltronCards.length} auras e equipamentos: cartas que pedem uma criatura para carregar.</p>` : ''}
      <details><summary>Cartas que funcionam sem ele (${A.standalone.length})</summary><div class="links">${listLinks(A.standalone)}</div></details>
    </section>
    <section class="panel"><h2>Nível de poder</h2>
      <div class="big num">Bracket ${A.bracket}</div><p>${bracketTxt}</p>
      ${A.bracketWhy.length ? `<p class="note">Por causa de: ${A.bracketWhy.join('; ')}.</p>` : '<p class="note">Nenhuma carta da lista oficial de "game changers", sem turnos extras em série e sem destruição de terrenos em massa.</p>'}
      ${A.gc.length ? `<div class="links">${listLinks(A.gc)}</div>` : ''}
      <p class="note">Estimativa pela lista. Combos de 2 cartas não são detectados; se o deck tiver um, o nível sobe.</p>
    </section>
  </div>
  </div>
  <div class="screen" data-s="trocas">${renderConcept(A)}${renderSwaps(A)}</div>
  <div class="screen" data-s="funcoes">
  <nav class="subnav" aria-label="Partes da análise"><a href="#funcoes" data-sub="funcoes" style="--h:142"><b>1</b>Funções</a><a href="#mana" data-sub="mana" style="--h:186"><b>2</b>Mana e curva</a><a href="#plano" data-sub="plano" style="--h:268"><b>3</b>Plano e cortes</a></nav>
  <div class="sub" id="sub-funcoes" style="--h:142">
  <section class="panel">
    <h2>Funções do deck</h2>
    <p class="lead">Todo deck de Commander precisa cobrir algumas funções básicas, não importa o comandante. As faixas são o que decks que funcionam costumam ter. Uma carta pode contar em mais de uma função.</p>
    <div class="refs">${refRows}</div>
  </section>
  </div>
  <div class="sub" id="sub-mana" style="--h:186">
  <div class="grid2">
    <section class="panel"><h2>Curva de mana</h2><p class="lead">Quantas cartas (sem contar terrenos) custam 0, 1, 2… manas. Muitas cartas caras deixam os primeiros turnos vazios.</p>${curveSvg}</section>
    <section class="panel"><h2>Base de mana</h2><p class="lead">Fontes de cada cor (terrenos, pedras e criaturas de mana) contra o quanto as suas cartas pedem daquela cor. A linha clara marca o recomendado.</p>${colorRows || '<p class="note">Deck incolor.</p>'}<p class="note" style="margin-top:8px">${A.tapped} terreno(s) sempre entram virados.</p></section>
  </div>
  </div>
  <div class="sub" id="sub-plano" style="--h:268">
  <section class="panel">
    <h2>Plano de jogo</h2>
    <p class="lead">Os temas que mais aparecem nas cartas. Um deck forte tem 1 ou 2 temas claros e quase todas as cartas puxando para eles.${A.tribe ? ` Tribo principal: <b>${esc(A.tribe[0])}</b> (${A.tribe[1]} criaturas).` : ''}</p>
    <div class="themes">${themeRows}</div>
  </section>
  <div class="grid2">
    <section class="panel"><h2>Cartas sem papel claro</h2><p class="lead">Todas as cartas são lidas: pelas etiquetas da comunidade, pelas regras de texto e, nas que sobram, pela leitura do texto da carta. Aqui ficam as que não têm função nem conversam com os temas do deck. Clique para ver o que cada uma faz e decida.</p>${A.noRole.length ? `<div class="links">${listLinks(A.noRole)}</div>` : '<p class="note">Nenhuma. Todas as cartas têm alguma função ou tema.</p>'}${A.bodyOnly.length ? `<h3 style="margin-top:12px">Só corpo</h3><p class="note">Criaturas sem habilidade que importe para o plano. Às vezes valem pelo tipo (tribo, artefato); senão, são as primeiras candidatas a corte.</p><div class="links">${listLinks(A.bodyOnly)}</div>` : ''}</section>
    <section class="panel"><h2>Pouco jogadas</h2><p class="lead">Cartas que quase ninguém usa no Commander. Às vezes são achados; muitas vezes existe opção melhor para a mesma função.</p>${A.obscure.length ? `<div class="links">${listLinks(A.obscure)}</div>` : '<p class="note">Nenhuma.</p>'}${A.pricey.length ? `<p class="note" style="margin-top:10px">Mais caras: ${A.pricey.map(c => `${esc(c.name)} (${brl(c.usd)})`).join(', ')}.</p>` : ''}</section>
  </div>
  </div>
  </div>`;
}

function wire(A) {
  const pick = $('#cmd-pick'); if (pick) pick.onchange = () => run([pick.value], 'resumo');
  const ask = $('#ask-all');
  if (ask) { ask.hidden = !SAMPLE; ask.onclick = () => askClaude(A); }
}
async function askClaude(A) {
  const box = $('#ans-all'); box.hidden = false; box.textContent = 'Lendo o deck…';
  const resumo = [
    `Comandante: ${A.cmds.map(c => c.name).join(' + ')} (cores ${[...A.ident].join('') || 'incolor'}). ${A.total} cartas, custo médio ${A.avgMV.toFixed(2)}, ${A.lands} terrenos.`,
    'Funções: ' + A.refs.map(r => `${r.n} ${fmt(r.have)} (faixa ${r.lo}-${r.hi})`).join('; '),
    'Temas: ' + A.themes.slice(0, 4).map(t => `${t.n} ${t.cards.length}${t.cmd ? ' (do comandante)' : ''}`).join('; '),
    `Dependência do comandante: ${A.cmdSupport.length} cartas no tema dele. Auras/equipamentos: ${A.voltronCards.length}. Bracket estimado ${A.bracket}.`,
    'Problemas apontados: ' + A.issues.map(i => i.t).join(' | '),
    'Lista: ' + A.uniq.map(c => c.name).join('; '),
  ].join('\n');
  try {
    await SAMPLE(`Você é um professor de Commander (Magic: The Gathering) ajudando um jogador brasileiro a APRENDER a montar decks. Ele não quer que você monte o deck por ele: quer entender o raciocínio.\n\nAnálise automática do deck dele:\n${resumo}\n\nEscreva em português do Brasil, em até 3 parágrafos curtos: 1) como esse deck ganha e se o plano está claro; 2) o ponto mais fraco e o raciocínio para corrigir, citando tipos de carta e não uma lista pronta; 3) um hábito de construção que ele deve treinar. Pode discordar da análise automática se a lista mostrar outra coisa. Não invente cartas que não estão na lista.`, { onText: ({ text }) => { box.textContent = text; } });
  } catch (e) { box.textContent = e && e.code === 'rate_limited' ? 'Muitas perguntas seguidas. Espere um pouco.' : 'Não deu para perguntar agora.'; }
}

// ---------- trocas: quem sai e quem entra ----------
const TAPPED_RX = (c) => /enters tapped\./.test(c.o) && !/unless|you may pay|If you don't/.test(c.o);
function deckCounts(A) { const k = {}; A.cards.forEach(c => (k[c.name] = (k[c.name] || 0) + 1)); return k; }
function roleCount(A, k) { return (A.byRole[k] || []).reduce((s, [, q]) => s + q, 0); }
// ---------- conceito do deck: a ideia que as trocas seguem ----------
const CONCEITOS = [
  { k: 'voltron', n: 'Auras e equipamentos', rx: /aura|equipamento|equip|voltron/i },
  { k: 'tokens', n: 'Fichas', rx: /ficha|tokens?\b/i },
  { k: 'counters', n: 'Marcadores +1/+1', rx: /marcador|\+1\/\+1|counters?\b/i },
  { k: 'graveyard', n: 'Cemitério', rx: /cemit[eé]rio|graveyard|reanima|recurs/i },
  { k: 'artifacts', n: 'Artefatos', rx: /artefato|artifact/i },
  { k: 'enchant', n: 'Encantamentos', rx: /encantamento|enchant/i },
  { k: 'spells', n: 'Mágicas', rx: /m[aá]gicas?|instant[aâ]ne|feiti[cç]o|spellslinger/i },
  { k: 'sac', n: 'Sacrifício e morte', rx: /sacrif|aristocrat|morre|morte/i },
  { k: 'life', n: 'Ganho de vida', rx: /ganh\w* (de )?vida|lifegain|life ?gain/i },
  { k: 'lands', n: 'Terrenos (landfall)', rx: /landfall|terrenos? extras?/i },
  { k: 'combat', n: 'Ataque e combate', rx: /ataqu|atacar|combate|aggro|agressiv|bater/i },
  { k: 'draw', n: 'Comprar muitas cartas', rx: /comprar muit|card draw|compra/i },
  { k: 'flying', n: 'Voar', rx: /\bvoa|voador|flying/i },
  { k: 'tribe', n: 'Tribo', rx: /tribal|tribo/i },
];
if (window.RAIOX) window.RAIOX.CONCEITOS = CONCEITOS;
const MODOS = [['seguir', 'Seguir a ideia'], ['preferir', 'Preferir a ideia (aceita fora se for bem melhor)'], ['so', 'Só dentro da ideia'], ['livre', 'Livre (ignorar a ideia)']];
let CONC = { text: '', man: {}, mode: 'seguir', lock: '', test: '', br: '', teto: '', tetoCarta: '' };
const concKey = (A) => 'raiox:conceito:' + A.cmds.map(c => c.name).join('+');
function loadConcept(A) { CONC = { text: '', man: {}, mode: 'seguir', lock: '', test: '', br: '', teto: '', tetoCarta: '' }; try { const s = localStorage.getItem(concKey(A)); if (s) CONC = Object.assign(CONC, JSON.parse(s)); } catch (e) {} }
function saveConcept(A) { try { localStorage.setItem(concKey(A), JSON.stringify(CONC)); } catch (e) {} }
function concDetected(A) { const t = CONC.text || ''; const on = new Set(CONCEITOS.filter(x => x.rx.test(t)).map(x => x.k)); if (A.tribe && new RegExp('\\b' + A.tribe[0].toLowerCase().slice(0, 5), 'i').test(t)) on.add('tribe'); return on; }
function concOn(A) { const on = concDetected(A); for (const [k, v] of Object.entries(CONC.man || {})) v ? on.add(k) : on.delete(k); if (!A.tribe) on.delete('tribe'); return on; }
function fitsK(A, c, k) {
  if (k === 'tribe') return !!(A.tribe && subtypes(c).includes(A.tribe[0]));
  if (k === 'flying') return /Flying/.test(c.o);
  return themesOf(c, new Set([k])).has(k);
}
// null = sem ideia (não pesa); true/false = encaixa ou não
function conceptFit(A, c) { if (CONC.mode === 'livre' || isLand(c)) return null; const on = A._concOn || concOn(A); if (!on.size) return null; return [...on].some(k => fitsK(A, c, k)); }
const namesFrom = (txt) => String(txt || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
function resolveNames(txt) { const ok = [], bad = []; for (const n of namesFrom(txt)) { const k = lookupName(n.replace(/^\d+\s*x?\s+/i, '')); k ? ok.push(k) : bad.push(n); } return { ok, bad }; }

function renderConcept(A) {
  const on = concOn(A);
  const chips = CONCEITOS.filter(x => x.k !== 'tribe' || A.tribe).map(x => `<button class="cn lock ${on.has(x.k) ? 'on' : ''}" data-cc="${x.k}" aria-pressed="${on.has(x.k)}">${esc(x.k === 'tribe' ? 'Tribo: ' + A.tribe[0] : x.n)}</button>`).join('');
  const lockR = resolveNames(CONC.lock), testR = resolveNames(CONC.test);
  const bad = lockR.bad.concat(testR.bad);
  return `<section class="panel conc"><h2>A ideia do deck</h2>
    <p class="lead">Conte em poucas palavras como o deck quer ganhar. As trocas passam a seguir isso: carta que encaixa na ideia pesa mais para ficar e para entrar. Fica salvo neste navegador para este comandante.</p>
    <textarea id="cc-text" rows="2" style="min-height:60px;font-family:var(--body);font-size:1rem" placeholder="Ex.: equipar o comandante e bater com ele; fichas para segurar a mesa">${esc(CONC.text)}</textarea>
    <div class="cc-row"><span class="note">Temas que li na ideia (clique para ligar ou desligar):</span><div class="links">${chips}</div></div>
    <label class="field">Como seguir <select id="cc-mode">${MODOS.map(([v, l]) => `<option value="${v}" ${CONC.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="grid2" style="margin-top:12px">
      <label class="cc-box"><b>Cartas que não saem</b><span class="note">Uma por linha ou separadas por vírgula. Vale nome em português.</span><textarea id="cc-lock" rows="3" style="min-height:70px">${esc(CONC.lock)}</textarea></label>
      <label class="cc-box"><b>Cartas que quero testar entrando</b><span class="note">Cada uma vira uma troca, no lugar da carta que menos faz falta.</span><textarea id="cc-test" rows="3" style="min-height:70px">${esc(CONC.test)}</textarea></label>
    </div>
    <div class="nivel">
      <h3>Nível e orçamento</h3>
      <p class="note">As trocas mudam bastante com isso: num bracket menor saem os game changers, a destruição de terrenos e o excesso de tutores; num maior entram cartas mais fortes. Com teto de preço, nenhuma carta que entra passa dele e as caras demais saem por outras da mesma função. Deixe em branco para não limitar.</p>
      <div class="nivel-campos">
        <label class="cc-box"><b>Bracket que você quer</b><select id="cc-br">${[['', `Manter o estimado (Bracket ${A.bracket})`], ['2', 'Bracket 2 · núcleo, nível de pré-montado'], ['3', 'Bracket 3 · melhorado, até 3 game changers'], ['4', 'Bracket 4 · otimizado, sem limites']].map(([v, l]) => `<option value="${v}" ${String(CONC.br || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="cc-box"><b>Preço máximo do deck</b><span class="reais"><i>R$</i><input id="cc-teto" class="txt" type="number" min="0" step="50" inputmode="numeric" placeholder="sem limite" value="${esc(String(CONC.teto || ''))}"></span><span class="note">Hoje: ${brl(A.price)}</span></label>
        <label class="cc-box"><b>Preço máximo por carta</b><span class="reais"><i>R$</i><input id="cc-tetoc" class="txt" type="number" min="0" step="5" inputmode="numeric" placeholder="sem limite" value="${esc(String(CONC.tetoCarta || ''))}"></span><span class="note">${A.pricey && A.pricey[0] ? `A mais cara hoje: ${esc(A.pricey[0].name)}, ${brl(A.pricey[0].usd)}` : 'Nenhuma carta cara no deck'}</span></label>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="cc-go">Refazer as trocas com esta ideia</button>${bad.length ? `<span class="note" style="color:var(--warn)">Não reconheci: ${esc(bad.join(', '))}</span>` : ''}${on.size && CONC.mode !== 'livre' ? `<span class="note">Seguindo: ${esc([...on].map(k => k === 'tribe' ? A.tribe[0] : CONCEITOS.find(x => x.k === k).n.toLowerCase()).join(', '))}</span>` : ''}</div>
  </section>`;
}
function rerenderTrocas(A) { const box = $('[data-s="trocas"]'); if (!box) return; box.innerHTML = renderConcept(A) + renderSwaps(A); wireConcept(A); wireSwaps(A); }
function wireConcept(A) {
  const t = $('#cc-text'); if (!t) return;
  const sync = () => { CONC.text = t.value; CONC.mode = $('#cc-mode').value; CONC.lock = $('#cc-lock').value; CONC.test = $('#cc-test').value; CONC.br = $('#cc-br').value; CONC.teto = $('#cc-teto').value; CONC.tetoCarta = $('#cc-tetoc').value; saveConcept(A); };
  t.addEventListener('input', () => { sync(); const on = concOn(A); $$('[data-cc]').forEach(b => { b.classList.toggle('on', on.has(b.dataset.cc)); b.setAttribute('aria-pressed', on.has(b.dataset.cc)); }); });
  $$('[data-cc]').forEach(b => b.onclick = (e) => { e.stopPropagation(); sync(); const k = b.dataset.cc; const det = concDetected(A).has(k); const now = !b.classList.contains('on'); CONC.man = CONC.man || {}; if (now === det) delete CONC.man[k]; else CONC.man[k] = now; saveConcept(A); b.classList.toggle('on', now); b.setAttribute('aria-pressed', now); });
  ['#cc-mode', '#cc-lock', '#cc-test', '#cc-br', '#cc-teto', '#cc-tetoc'].forEach(s => $(s).addEventListener('change', sync));
  $('#cc-go').onclick = () => { sync(); rerenderTrocas(A); };
}


// ---------- plano do comandante: o que cada carta faz por ele, lendo o texto (19/11/2026) ----------
// Princípio: a carta vale pelo que adianta o plano (comandante cedo, atacando, forte e protegido), não por ser do tema.
const KWV = [['double strike', 2.5, 'golpe duplo'], ["can't be blocked except", 1.5, 'quase imbloqueável'], ["can't be blocked by more than one", 0.8, 'só um bloqueia'], ["can't be blocked", 2, 'imbloqueável'], ['flying', 1.5, 'voar'], ['trample', 1.2, 'atropelar'], ['menace', 1.2, 'ameaçar'], ['first strike', 0.6, 'iniciativa'], ['hexproof', 2, 'resistência a magia'], ["can't be the target of spells or abilities your opponents", 2, 'resistência a magia'], ['shroud', 1.6, 'manto'], ['indestructible', 1.6, 'indestrutível'], ['ward', 1, 'proteção (ward)'], ['protection from', 1.4, 'proteção contra cor'], ['lifelink', 0.5, 'vínculo com a vida'], ['vigilance', 0.3, 'vigilância']];
const EFX = {};
const custoN = (m) => (m.match(/\{[^}]+\}/g) || []).reduce((s, x) => s + (/^\{\d+\}$/.test(x) ? +x.slice(1, -1) : /X/.test(x) ? 0 : 1), 0);
function efeitos(c) {
  if (EFX[c.name]) return EFX[c.name];
  const o = c.o.split('\n//\n')[0], t = c.t.split(' // ')[0];
  const aura = /Aura/.test(t) && /Enchant (creature|permanent|modified creature|creature you control)/.test(o), equip = /Equipment/.test(t);
  const eqM = o.match(/\bEquip(?: [^{\n]*)? ((?:\{[^}]+\})+)/); const eq = eqM ? custoN(eqM[1]) : 0;
  const ln = o.split('\n').filter(l => /(Enchanted|Equipped) (creature|permanent)|attached to it|enchanted creature/i.test(l)).join('\n');
  const e = { aura, equip, anexo: aura || equip, eq, boost: 0, kv: 0, diz: [], haste: false, draw: false, volta: false, engine: false, reduz: false };
  const b = ln.match(/gets \+(\d+|X)\/\+(\d+|X)/); if (b) { const n = b[1] === 'X' ? 2 : +b[1], m = b[2] === 'X' ? 2 : +b[2]; e.boost = (n + m) / 2 * (/for each|where X/.test(ln) ? 2.5 : 1); e.diz.push(/for each|where X/.test(ln) ? 'força que cresce com o que está preso' : `+${b[1]}/+${b[2]}`); }
  else { const b0 = ln.match(/gets \+(\d+)\/\+0/); if (b0) { e.boost = +b0[1] / 2; e.diz.push(`+${b0[1]}/+0`); } }
  if (/\+1\/\+1 counter on (it|enchanted|equipped)/.test(ln)) { e.boost += 1; e.diz.push('marcadores ao atacar'); }
  const lnl = ln.toLowerCase(); const vistos = new Set();
  for (const [k, v, n] of KWV) if (lnl.includes(k) && !vistos.has(n) && !(k === "can't be blocked" && /can't be blocked (except|by more)/.test(lnl))) { e.kv += v; vistos.add(n); e.diz.push(n); }
  if (/Umbra armor|Totem armor/.test(o)) { e.kv += 1.6; e.diz.push('salva a criatura de ser destruída'); }
  e.haste = /\bhaste\b/i.test(ln) || /creatures you control (have|gain) haste|creature spells you cast [^.]*haste|\briot\b|creatures you control [^.]*haste/i.test(o) || (/target creature (you control )?gains? haste/i.test(o) && c.v <= 1);
  if (e.haste && e.anexo) e.diz.push('ímpeto');
  e.draw = /draw (a|two|X) cards?/i.test(o); if (e.anexo && e.draw) e.diz.push('compra uma carta');
  e.volta = /return (it|this card) to its owner's hand/.test(o) && e.anexo;
  // efeitos de anexo que não são força nem palavra-chave
  if (e.anexo && /When(ever)? (enchanted|equipped) creature (or another [^,]*)?dies/.test(o)) { e.kv += 1.5; e.diz.push('devolve valor se a criatura morrer'); }
  if (e.anexo && /(enchanted|equipped) creature deals damage equal to its power|it deals damage equal to its power|deals that much damage to each opponent/i.test(o)) { e.kv += 1.6; e.diz.push('dano extra com a força da criatura'); }
  if (e.anexo && /untap all lands you control|create a Treasure|search your library for [^.]*land/.test(o)) { e.kv += 0.6; e.diz.push('gera mana'); }
  e.extra = /additional combat phase|extra combat/i.test(o);
  e.engine = !e.anexo && /Constellation|Whenever (an|another) (Aura|enchantment|Equipment)[^.]*(enters|you control)|Whenever you cast an? (Aura|enchantment|Equipment)|becomes attached|Whenever an? (Aura|Equipment) you control/i.test(o) && /draw|create|counter|Add /.test(o);
  e.reduz = /(Aura|Enchantment|Equipment)[^.]{0,30} spells?[^.]{0,30} cost \{\d\} less|Equip abilities[^.]* cost \{\d\} less|equip costs?[^.]* less/i.test(o);
  return (EFX[c.name] = e);
}
function planoDe(A) {
  const o = A.cmds.map(c => c.o.split('\n//\n')[0]).join('\n');
  const nome = A.cmds.map(c => c.name.split(',')[0]).join(' + ') || 'o comandante';
  const mv = A.cmds.length ? Math.max(...A.cmds.map(c => c.v)) : 0;
  const atk = /Whenever [^.\n]{0,60}\b(attacks|deals combat damage)|attacking creature/i.test(o);
  const nAnexo = A.uniq.filter(c => efeitos(c).anexo).length;
  const voltron = /Aura|Equipment|attached|equipped|enchanted creature/i.test(o) || (A.cmdThemes.has('voltron') && nAnexo >= 10) || (atk && nAnexo >= 12);
  const tribo = A.tribe && new RegExp('\\b' + A.tribe[0].slice(0, 3), 'i').test(o) ? A.tribe[0] : null;
  const goad = /\bgoad|attacks? each combat if able|can't block|Creatures your opponents control attack/i.test(o);
  const P = { nome, mv, atk, voltron, goad, ativo: atk || voltron, nAnexo, tribo };
  const quer = [];
  if (goad) quer.push('cartas que forçam os oponentes a se atacarem (goad) e que protegem você do ataque (pillow fort)');
  if (atk) quer.push('ímpeto (atacar no turno em que entra)');
  if (mv >= 3) quer.push(`ramp de até ${Math.max(1, mv - 2)} mana${mv - 2 > 1 ? 's' : ''}, que põe ${nome} na mesa um turno antes`);
  if (tribo) quer.push(`criaturas ${tribo} (o comandante conta com elas)`);
  if (voltron) quer.push('auras e equipamentos baratos que dão evasão, força ou proteção', 'cartas que barateiam auras/equipamentos ou compram quando eles entram', 'proteção para o comandante');
  P.quer = quer;
  return P;
}
// que tipo de ramp a carta é, pelo texto (a etiqueta "ramp" do Scryfall junta Path to Exile, rituais, Ragavan…)
// pedra/dork/terreno: mana a mais todo turno, desde cedo; tesouro: mana guardada de uma vez; ritual: só no turno;
// condicional: depende de causar dano, de o oponente fazer algo etc.; null: não é ramp
const TIPO_RAMP = {};
const RAMP_N = { pedra: 'pedra de mana', dork: 'criatura de mana', terreno: 'busca terreno', tesouro: 'tesouros de uma vez', ritual: 'mana só no turno', condicional: 'mana só se algo acontecer' };
function tipoRamp(c) {
  if (!c || isLand(c)) return null;
  if (c.name in TIPO_RAMP) return TIPO_RAMP[c.name];
  const o = c.o.split('\n//\n')[0].replace(/\([^)]*\)/g, ''), t = c.t.split(' // ')[0], tg = c.tags; // sem o texto de lembrete (o do tesouro tem "{T}: Add")
  const tapAdd = /(^|\n)[^\n]*\{T\}[^:\n]*: Add /.test(o) && !/\{T\}, Sacrifice (this|~|it)[^:\n]*: Add/.test(o);
  const cond = /\b(Whenever|When) [^\n]*?(deals (combat )?damage|attacks|dies|an opponent|a player|you cast|you copy)[^\n]*(Treasure|Add \{|search your library for [^.]*land)/.test(o);
  let r = null;
  if (tg.includes('ritual')) r = 'ritual';
  else if (/Sacrifice an? (creature|artifact|permanent)[^:\n]*: Add/.test(o)) r = null; // altar: é peça de combo, não acelera
  else if (/Sacrifice (this|~|it)[^:\n]*: Add/.test(o) && !tapAdd) r = 'tesouro';
  else if (tg.includes('land-ramp') && /Its controller may search|that player may search|each player/i.test(o)) r = null; // Path to Exile: o terreno vai para o outro
  else if ((tg.includes('mana-rock') || (/Artifact/.test(t) && !/Creature/.test(t) && tapAdd)) && !cond) r = 'pedra';
  else if ((tg.includes('mana-dork') || (/Creature/.test(t) && tapAdd)) && !cond) r = 'dork';
  else if (tg.includes('land-ramp') && /(search your library for [^.]*land[^.]*(put|onto the battlefield)|put (a|up to \w+|any number of) [^.]*land cards? [^.]*onto the battlefield)/i.test(o) && !cond) r = 'terreno';
  else if (/Enchantment/.test(t) && tapAdd) r = 'pedra';
  else if (tg.includes('ramp') || tg.includes('mana-doubler') || /Treasure|Add \{/.test(o)) {
    if (cond || /Whenever|At the beginning|unless/.test(o) && !/^When [^\n]*enters/m.test(o)) r = 'condicional';
    else if (/create (a|two|three|four|X|\w+) Treasure/i.test(o)) r = 'tesouro';
    else if (tg.includes('ramp')) r = 'condicional';
  }
  return (TIPO_RAMP[c.name] = r);
}
// ---------- EDHREC: a LÓGICA da sinergia, aplicada à ideia de quem monta (19/11/2026) ----------
// No EDHREC, sinergia = % dos decks de um grupo que jogam a carta MENOS % dos decks das mesmas cores em geral.
// Usamos as páginas de TEMA por cor (json.edhrec.com/pages/tags/<tema>/<cores>.json, CORS liberado): o grupo é
// "decks <tema> nessas cores", escolhido pela pessoa no passo 2 (ou na ideia das trocas), não o jeito mais comum do comandante.
// De cada carta sai: syn (o quanto ela é DO TEMA) e base = inc − syn (o quanto ela é jogada nessas cores em geral: qualidade sem tema).
// A página do comandante (pages/commanders/<slug>) só serve de informação ("como costumam jogar"), sem peso.
// Tudo guardado 7 dias em localStorage ('raiox:edh:<caminho>').
const EDH = {};
const EDH_TEMA = { voltron: 'voltron', tokens: 'tokens', counters: 'plus-1-plus-1-counters', graveyard: 'graveyard', artifacts: 'artifacts', enchant: 'enchantress', spells: 'spellslinger', sac: 'aristocrats', life: 'lifegain', lands: 'landfall', combat: 'aggro', draw: 'card-draw', flying: 'flying' };
const EDH_PLURAL = { Elf: 'elves', Dwarf: 'dwarves', Wolf: 'wolves', Werewolf: 'werewolves', Fungus: 'fungi', Sphinx: 'sphinxes', Fox: 'foxes', Mouse: 'mice', Ox: 'oxen', Octopus: 'octopuses', Djinn: 'djinn', Phoenix: 'phoenixes' };
const EDH_COR = { '': 'colorless', W: 'mono-white', U: 'mono-blue', B: 'mono-black', R: 'mono-red', G: 'mono-green', WU: 'azorius', UB: 'dimir', BR: 'rakdos', RG: 'gruul', GW: 'selesnya', WB: 'orzhov', UR: 'izzet', BG: 'golgari', RW: 'boros', GU: 'simic', WUB: 'esper', UBR: 'grixis', BRG: 'jund', RGW: 'naya', GWU: 'bant', WBG: 'abzan', URW: 'jeskai', BGU: 'sultai', RWB: 'mardu', GUR: 'temur', WUBR: 'yore-tiller', UBRG: 'glint-eye', BRGW: 'dune-brood', RGWU: 'ink-treader', GWUB: 'witch-maw', WUBRG: 'five-color' };
function edhCor(ident) { const ks = Object.keys(EDH_COR); const set = [...ident].sort().join(''); return EDH_COR[ks.find(k => [...k].sort().join('') === set)] || ''; }
const edhSlug = (names) => [...names].map(n => n.split(' // ')[0]).sort().map(n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/[\s-]+/g, '-')).join('-');
function edhLe(d) {
  const j = d && d.container && d.container.json_dict; if (!j) return null;
  const cards = {};
  for (const l of j.cardlists || []) for (const v of l.cardviews || []) {
    if (!v.potential_decks) continue;
    const inc = v.num_decks / v.potential_decks, syn = v.synergy || 0;
    if (!cards[v.name] || cards[v.name].inc < inc) cards[v.name] = { inc: +inc.toFixed(3), syn: +syn.toFixed(3) };
  }
  return { t: Date.now(), n: (j.card && j.card.num_decks) || 0, cards, tags: ((d.panels || {}).taglinks || []).slice(0, 5).map(x => [x.value, x.count]) };
}
function edhPagina(cam) {
  if (!cam) return Promise.resolve(null);
  if (EDH[cam]) return EDH[cam] instanceof Promise ? EDH[cam] : Promise.resolve(EDH[cam]);
  try { const c = JSON.parse(localStorage.getItem('raiox:edh:' + cam) || 'null'); if (c && Date.now() - c.t < 7 * 864e5) return Promise.resolve(EDH[cam] = c); } catch (e) {}
  return (EDH[cam] = fetch('https://json.edhrec.com/pages/' + cam + '.json').then(r => r.ok ? r.json() : null).then(d => {
    const o = edhLe(d); if (!o) return (EDH[cam] = { erro: 1 });
    try { localStorage.setItem('raiox:edh:' + cam, JSON.stringify(o)); } catch (e) {}
    return (EDH[cam] = o);
  }).catch(() => (EDH[cam] = { erro: 1 })));
}
function edhJa(cam) { const v = EDH[cam]; if (v && !(v instanceof Promise)) return v.erro ? null : v; try { const c = JSON.parse(localStorage.getItem('raiox:edh:' + cam) || 'null'); if (c) return (EDH[cam] = c); } catch (e) {} return null; }
const edhCmdCam = (names) => names && names.length ? 'commanders/' + edhSlug(names) : '';
function edhTemaCam(k, ident, tribo) {
  const t = k === 'tribe' ? (tribo ? (EDH_PLURAL[tribo] || tribo.toLowerCase() + 's') : '') : EDH_TEMA[k];
  if (!t) return ''; const cor = edhCor(ident); return 'tags/' + t + (cor ? '/' + cor : '');
}
const EDH_TEMA_N = (k, tribo) => k === 'tribe' ? 'de ' + (tribo || 'tribo') : ({ voltron: 'Voltron', tokens: 'de fichas', counters: 'de marcadores +1/+1', graveyard: 'de cemitério', artifacts: 'de artefatos', enchant: 'de encantamentos', spells: 'de mágicas', sac: 'de sacrifício', life: 'de ganho de vida', lands: 'de landfall', combat: 'de ataque (aggro)', draw: 'de compra', flying: 'de voadores' })[k] || k;
// ideia = temas escolhidos; devolve as páginas que já chegaram e uma promessa das que faltam
function edhIdeia(temas, ident, tribo) {
  const cams = [...temas].map(k => [k, edhTemaCam(k, ident, tribo)]).filter(([, c]) => c);
  const pags = cams.map(([k, cam]) => ({ k, cam, d: edhJa(cam) })).filter(x => x.d);
  const falta = cams.filter(([, cam]) => !edhJa(cam) && !(EDH[cam] && EDH[cam].erro));
  return { pags, cor: edhCor(ident), tribo, carrega: falta.length ? Promise.all(falta.map(([, cam]) => edhPagina(cam))) : null };
}
// o que a comunidade diz da carta, medido contra a IDEIA: syn = maior sinergia entre os temas; base = inclusão nas cores sem o tema
function edhCarta(I, c) {
  if (!I || !I.pags.length || !c) return null;
  let best = null;
  for (const p of I.pags) { const x = p.d.cards[c.name] || p.d.cards[c.name.split(' // ')[0]]; if (!x) continue; const r = { k: p.k, n: p.d.n, inc: x.inc, syn: x.syn, base: Math.max(0, x.inc - x.syn) }; if (!best || r.syn > best.syn) best = { ...r, base: Math.max(best ? best.base : 0, r.base) }; else best.base = Math.max(best.base, r.base); }
  return best;
}
// nota: sinergia com a ideia pesa mais que a qualidade geral; fora das listas = um pouco abaixo de zero (ninguém joga nesse tema)
const edhNota = (I, c) => { if (!I || !I.pags.length) return 0; const x = edhCarta(I, c); return x ? 1.1 * Math.max(-0.25, x.syn) + 0.7 * x.base : -0.12; };
function edhPorque(I, c) {
  const x = edhCarta(I, c); if (!I || !I.pags.length) return '';
  const temas = I.pags.map(p => EDH_TEMA_N(p.k, I.tribo)).join(' / ');
  if (!x) return `No EDHREC: não aparece nos decks ${temas} dessas cores`;
  const pi = Math.round(100 * x.inc), pb = Math.round(100 * x.base), sy = Math.round(100 * x.syn);
  return `Sinergia com a ideia (EDHREC): em ${pi}% dos decks ${EDH_TEMA_N(x.k, I.tribo)} dessas cores contra ${pb}% dos decks dessas cores em geral (${sy >= 0 ? '+' : ''}${sy}%: ${sy >= 15 ? 'é carta do tema' : sy <= -3 ? 'carta boa em geral, não do tema' : 'carta comum, pouco ligada ao tema'})`;
}
const rampFirme = (c) => ['pedra', 'dork', 'terreno'].includes(tipoRamp(c));
function valorPlano(A, c) {
  const P = A.plano; if (!P || !c || isLand(c)) return { v: 0, why: [] };
  const cache = (A._vp = A._vp || {}); if (cache[c.name]) return cache[c.name];
  const e = efeitos(c), why = [], rl = rolesOf(c); let v = 0;
  if (P.atk && e.haste) { v += 3; why.push(`dá ímpeto: ${P.nome} ataca no turno em que entra, sem esperar uma rodada`); }
  if (P.atk && e.extra) { v += 3; why.push(`combate extra: ${P.nome} ataca de novo (e o gatilho de ataque dispara de novo)`); }
  if (rl.has('ramp') && P.mv >= 3 && !e.anexo) {
    const tr = tipoRamp(c);
    if (c.v <= P.mv - 2 && (tr === 'condicional' || tr === 'ritual')) why.push(`a mana dele ${tr === 'ritual' ? 'some no fim do turno' : 'só vem se algo acontecer antes'}: não garante ${P.nome} um turno antes`);
    else if (c.v <= P.mv - 2 && tr) { v += P.ativo ? 2 : 1; why.push(`ramp de ${c.v} mana${c.v > 1 ? 's' : ''}: põe ${P.nome} (custo ${P.mv}) na mesa um turno antes`); }
    else if (c.v >= P.mv && !/Creature/.test(c.t)) { v -= 1.5; why.push(`ramp de ${c.v} manas chega junto com ${P.nome} e não o acelera`); }
  }
  if (P.voltron && e.anexo) {
    const custo = c.v + (e.equip ? e.eq * 0.7 : 0);
    const imp = e.boost * 0.6 + e.kv + (e.draw ? 1 : 0) + (e.volta ? 1 : 0) + (e.haste && P.atk ? 0 : 0);
    const x = Math.max(-2, Math.min(3.5, imp - 0.8 * custo + 1));
    v += x;
    if (x >= 1 && e.diz.length) why.push(`${listPt(e.diz)} por ${fmt(custo)} de mana${e.equip ? ' (contando o equipar)' : ''}: bom retorno para ${P.nome}`);
    else if (x < 0) why.push(`custa ${fmt(custo)} de mana${e.equip ? ' com o equipar' : ''} e dá pouco a ${P.nome}`);
  }
  if (P.goad && /\bgoad|attacks? each combat if able|can't attack you|attacks you, |for each creature they control that's attacking you/i.test(c.o)) { v += 1.5; why.push(/\bgoad|each combat if able/i.test(c.o) ? `força os outros a atacar entre si, como ${P.nome}` : `segura o ataque contra você enquanto os outros brigam`); }
  if (P.tribo && subtypes(c).includes(P.tribo)) { v += 1; why.push(`é ${P.tribo}: conta para ${P.nome}`); }
  if (isTutor(c) && c.v <= 3) { v += 1.5; why.push(`tutor barato: busca a peça que ${P.nome} precisa na hora certa`); }
  if (rl.has('wipe') && (/\bnon-?(Vampire|Elf|Goblin|Zombie|[A-Z][a-z]+) creatures?|creatures your opponents control|each creature you don't control/.test(c.o) || (P.tribo && new RegExp('non-?' + P.tribo, 'i').test(c.o)))) { v += 2; why.push('limpa-mesa de um lado só: tira as criaturas dos outros e poupa as suas'); }
  if (P.voltron && e.reduz) { v += 2.5; why.push(`barateia auras/equipamentos: ${P.nome} fica armado mais cedo`); }
  if (P.voltron && e.engine) { v += 2.5; why.push('compra ou cresce a cada aura/encantamento que entra: o plano vira vantagem de cartas'); }
  if (P.voltron && rl.has('protect') && !e.anexo) { v += 1.5; why.push(`protege ${P.nome}, que carrega o deck`); }
  if (P.ativo && !P.goad && c.v >= 5 && !rl.has('wipe') && !e.engine && !e.extra) { v -= 0.6 * (c.v - 4); why.push(`custa ${c.v}: chega tarde para um deck que quer atacar cedo`); }
  return (cache[c.name] = { v, why });
}

function cutScore(A, c, needRoles) {
  if (isLand(c)) return -1e9;
  const roles = rolesOf(c); const real = [...roles].filter(k => k !== 'body');
  let s = 0;
  if (A.noRole.includes(c.name)) s += 50;
  if (A.bodyOnly.includes(c.name)) s += 35;
  const fit = conceptFit(A, c);
  if (fit !== null) s += ({ seguir: fit ? -25 : 12, preferir: fit ? -12 : 6, so: fit ? -60 : 20 })[CONC.mode] || 0;
  if (!A.cmdSupport.includes(c.name)) s += 12;
  if (A.edh) s += 40 - 70 * edhNota(A.edh, c); // com o EDHREC: fica o que tem sinergia com a ideia ou é muito jogado nessas cores (antes: popularidade geral)
  else {
    s += c.r ? 30 * Math.min(c.r, 20000) / 20000 : 30;
    if (c.r && c.r < 4000) s -= 45 * (1 - c.r / 4000); // muito jogada no Commander: só sai com motivo forte
  }
  s -= 7 * real.length;
  if (c.gc) s += A._gcOk ? -30 : 40;
  if (A._capCard < Infinity && (c.usd || 0) > A._capCard) s += 40; // acima do teto por carta: candidata a sair
  if (A.avgMV > 3.6 && c.v >= 5) s += 4 * (c.v - 4);
  s -= 18 * valorPlano(A, c).v; // serve ao plano do comandante: fica
  for (const k of real) {
    if (needRoles.has(k)) s -= 60; // já falta: não tira
    const ref = A.refs.find(r => r.k === k); if (ref && roleCount(A, k) <= ref.lo) s -= 60; // tirar deixaria abaixo do mínimo
  }
  return s;
}
function whyCut(A, c) {
  const bits = [];
  if (A.noRole.includes(c.name)) bits.push('não tem função clara nem conversa com os temas do deck');
  else if (A.bodyOnly.includes(c.name)) bits.push('é só um corpo, sem habilidade que importe para o plano');
  else if (!A.cmdSupport.includes(c.name)) bits.push('não puxa para o tema do comandante');
  if (!c.r || c.r > 12000) bits.push('quase ninguém joga com ela no Commander');
  if (A.avgMV > 3.6 && c.v >= 5) bits.push(`custa ${c.v} numa lista que já está pesada`);
  const vp = valorPlano(A, c); if (vp.v < 0) bits.unshift(...vp.why);
  if (!bits.length) bits.push('é das que menos contribuem entre as que sobram');
  return bits.join('; ');
}
// carta pode entrar? (bracket alvo e teto por carta)
function addOk(A, c) {
  if (!A._tgt) return true;
  if ((c.usd || 0) > A._capCard) return false;
  if (c.gc && !A._gcOk) return false;
  if (A._tgt < 4 && c.tags.includes('mass-land-denial')) return false;
  if (A._tgt < 3 && c.tags.includes('extra-turn')) return false;
  if (A._tgt < 3 && isTutor(c)) return false;
  return true;
}
function rankAdds(A, list) {
  const cmdTh = A.cmdThemes;
  return list.filter(c => addOk(A, c)).map(c => { const th = [...themesOf(c, cmdTh)].some(t => cmdTh.has(t)); let s = c.r || 1e6; if (th) s *= 0.45; if (c.v > Math.max(3, A.avgMV + 1)) s *= 1.6; const fit = conceptFit(A, c); if (fit) s *= ({ seguir: 0.4, preferir: 0.7, so: 0.4 })[CONC.mode] || 1; if (A._capDeck < Infinity && c.usd > 1) s *= 1 + Math.min(3, c.usd / 10); const vp = valorPlano(A, c).v; s *= Math.exp(-0.45 * vp); if (A.edh) s *= Math.exp(-2.5 * edhNota(A.edh, c)); return { c, s, th, fit, vp }; }).filter(x => !(A.plano && A.plano.ativo && x.vp <= -1.5)).filter(x => !(CONC.mode === 'so' && x.fit === false)).sort((a, b) => a.s - b.s);
}
function addPool(A, test, n = 30) {
  const inDeck = new Set(A.uniq.map(c => c.name).concat(A.cmds.map(c => c.name)));
  const out = [];
  for (const name of Object.keys(DB.cards)) {
    if (inDeck.has(name)) continue;
    const c = C(name); if (c.ban || !c.r) continue;
    if (!c.ci.split('').every(x => !x || A.ident.has(x))) continue;
    if (!test(c)) continue; out.push(c);
  }
  return out.sort((a, b) => a.r - b.r).slice(0, n);
}
// temas da ideia nas trocas: os chips/texto da ideia; sem ideia, os temas que o comandante pede (lidos do texto)
function temasTroca(A) { const on = new Set(concOn(A)); if (!on.size) for (const t of A.cmdThemes) if (EDH_TEMA[t]) on.add(t); if (A.tribe && (on.has('tribe') || A.plano && A.plano.tribo)) on.add('tribe'); return on; }
function buildSwaps(A) {
  A._concOn = null;
  A.edh = edhIdeia(temasTroca(A), A.ident, A.tribe && A.tribe[0]);
  if (A.edh.carrega) A.edh.carrega.then(() => { if (LAST === A) rerenderTrocas(A); });
  if (!A.edh.pags.length) A.edh = null;
  A._concOn = concOn(A); A._testBad = [];
  A._tgt = +CONC.br || A.bracket; A._gcMax = { 1: 0, 2: 0, 3: 3, 4: 99 }[A._tgt];
  A._gcOk = A.gc.length < A._gcMax; A._capCard = toUsd(+CONC.tetoCarta); A._capDeck = toUsd(+CONC.teto);
  let PRICE = A.price, GC = A.gc.length;
  const usd = (n) => (C(n) || {}).usd || 0;
  const cabe = (inC, outC) => (!inC.gc || A._gcOk || (outC && outC.gc)) && (A._capDeck === Infinity || (inC.usd || 0) <= (outC ? outC.usd || 0 : 0) || PRICE + (inC.usd || 0) - (outC ? outC.usd || 0 : 0) <= A._capDeck);
  const LOCK = new Set(resolveNames(CONC.lock).ok);
  const swaps = []; const usedOut = new Set(LOCK), usedIn = new Set();
  const needRoles = new Set(A.refs.filter(r => r.k !== 'lands' && r.have < r.lo).map(r => r.k));
  const cutsAll = A.uniq.filter(c => !isLand(c)).map(c => ({ c, s: cutScore(A, c, needRoles) })).sort((a, b) => b.s - a.s);
  const nextCut = (avoid) => cutsAll.find(x => !usedOut.has(x.c.name) && x.s > -20 && !(avoid && avoid(x.c)));
  const MAX = (CONC.br || CONC.teto || CONC.tetoCarta) ? 26 : 16;
  // juiz pela ideia (EDHREC, decks do tema nessas cores): troca por faixa de função (ramp alto, remoção baixa, terrenos, foco)
  // não tira carta claramente mais ligada à ideia (ou mais jogada nessas cores) do que a que entra. Regras duras (bracket, preço, cores, teste pedido) passam.
  const DURA = new Set(['Seu teste', 'Nível de poder', 'Preço', 'Base de mana']);
  const push = (sw) => { if (swaps.length >= MAX) return false;
    if (A.edh && !DURA.has(sw.goal) && edhNota(A.edh, C(sw.inn)) < edhNota(A.edh, C(sw.out)) - 0.2) { (A._vetoEdh = A._vetoEdh || []).push(sw.out + ' → ' + sw.inn); return false; } swaps.push(sw); usedOut.add(sw.out); usedIn.add(sw.inn); PRICE += usd(sw.inn) - usd(sw.out); const ci = C(sw.inn), co = C(sw.out); GC += (ci && ci.gc ? 1 : 0) - (co && co.gc ? 1 : 0); A._gcOk = GC < A._gcMax; return true; };
  const altsCut = (avoidFn) => cutsAll.filter(x => !usedOut.has(x.c.name) && x.s > -20 && !(avoidFn && avoidFn(x.c))).slice(0, 4).map(x => x.c.name);
  const label = { ramp: 'Ramp', draw: 'Compra de cartas', removal: 'Remoção pontual', wipe: 'Limpa-mesa', protect: 'Proteção', counter: 'Contramágica' };

  // 1) equilíbrio das funções: o que sobra (terrenos, ramp, proteção acima da faixa) paga o que falta
  const lr = A.refs.find(r => r.k === 'lands');
  const refOf = (k) => A.refs.find(r => r.k === k);
  const cnt = Object.fromEntries(A.refs.map(r => [r.k, r.have]));
  const realRoles = (c) => [...rolesOf(c)].filter(k => k !== 'lands' && refOf(k));
  const mid = (r) => (r.lo + r.hi) / 2;
  const pos = (r) => (cnt[r.k] - r.lo) / Math.max(1, r.hi - r.lo);
  const pools = {};
  const poolFor = (k) => pools[k] || (pools[k] = rankAdds(A, suggestions(A, k, 40)));
  const demand = () => {
    const gaps = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] < r.lo).sort((a, b) => pos(a) - pos(b));
    if (gaps.length) return { r: gaps[0], gap: true };
    const low = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] < mid(r) - 0.5).sort((a, b) => pos(a) - pos(b));
    return low.length ? { r: low[0], gap: false } : null;
  };
  // tirar a carta não pode derrubar outra função para baixo da faixa
  const safeOut = (c) => realRoles(c).every(k => cnt[k] - 1 >= refOf(k).lo);
  const pickSurplus = () => {
    if (lr && cnt.lands > lr.hi) {
      const tapped = A.uniq.filter(c => isLand(c) && !/Basic/.test(c.t) && TAPPED_RX(c) && !usedOut.has(c.name));
      const ident0 = [...A.ident]; const sur = (x) => A.sources[x] - A.colorNeed[x];
      const basics = A.uniq.filter(c => /Basic Land/.test(c.t) && !usedOut.has(c.name)).sort((a, b) => sur(b.pm.replace(/[^WUBRG]/g, '')[0]) - sur(a.pm.replace(/[^WUBRG]/g, '')[0]));
      const c = tapped[0] || basics[0] || (ident0.length ? null : null);
      if (c) return { c, k: 'lands', why: `o deck tem ${fmt(cnt.lands)} terrenos e a curva pede ${lr.lo}–${lr.hi}${TAPPED_RX(c) ? '; este ainda entra virado' : '; é um básico de uma cor que já tem fontes de sobra'}` };
    }
    const sur = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] > r.hi).sort((a, b) => (cnt[b.k] - b.hi) / (b.hi - b.lo) - (cnt[a.k] - a.hi) / (a.hi - a.lo));
    for (const r of sur) {
      const cands = (A.byRole[r.k] || []).map(([n]) => C(n)).filter(c => c && !isLand(c) && !usedOut.has(c.name) && !c.gc && safeOut(c))
        .map(c => ({ c, s: cutScore(A, c, new Set()) + (r.k === 'ramp' ? 6 * c.v : 0) + 6 * realRoles(c).filter(k => k === r.k).length })).sort((a, b) => b.s - a.s);
      if (cands.length) { const c = cands[0].c; return { c, k: r.k, why: `${r.n} está em ${fmt(cnt[r.k])}, acima da faixa ${r.lo}–${r.hi}; ${r.k === 'ramp' && c.v >= 3 ? `esta custa ${c.v}, e ramp barato rende mais` : 'esta é das que menos rendem entre elas'}` }; }
    }
    return null;
  };
  const pickGeneric = () => { const x = cutsAll.find(x => !usedOut.has(x.c.name) && x.s > -20 && safeOut(x.c)); return x ? { c: x.c, k: null, why: whyCut(A, x.c) } : null; };
  const thList = THEMES.filter(t => A.cmdThemes.has(t.k));
  const themePool = thList.length ? rankAdds(A, addPool(A, c => !isLand(c) && thList.some(t => t.rx.test(c.o) || (t.type && t.type.test(c.t))), 40)) : [];
  // cartas que você quer testar entrando: cada uma vira uma troca
  const inDeckN = new Set(A.uniq.map(c => c.name).concat(A.cmds.map(c => c.name)));
  for (const name of resolveNames(CONC.test).ok) {
    const n = C(name); if (!n || inDeckN.has(name) || usedIn.has(name)) continue;
    if (!n.ci.split('').every(x => !x || A.ident.has(x))) { (A._testBad = A._testBad || []).push(name); continue; }
    const cut = pickSurplus() || pickGeneric(); if (!cut) break;
    const rn = roleNames(n);
    push({ goal: 'Seu teste', out: cut.c.name, inn: name, whyOut: cut.why, whyIn: `Você pediu para testar. ${rn.length ? 'Ela traz ' + listPt(rn.map(x => x.toLowerCase())) + '.' : ''}${conceptFit(A, n) ? ' Encaixa na ideia do deck.' : ''}`, alts: [], altsOut: altsCut().filter(x => x !== cut.c.name).slice(0, 4) });
    if (cut.k === 'lands') cnt.lands--; else realRoles(cut.c).forEach(k => cnt[k]--);
    realRoles(n).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; });
  }
  // 0a) bracket alvo menor: sai o que o bracket não permite, entra carta da mesma função
  const subst = (c, extra) => {
    const rs = realRoles(c);
    for (const k of rs) { const add = poolFor(k).find(x => !usedIn.has(x.c.name) && !(extra && !extra(x.c)) && cabe(x.c, c)); if (add) return { add, k }; }
    const add = themePool.find(x => !usedIn.has(x.c.name) && !isLand(x.c) && !(extra && !extra(x.c)) && cabe(x.c, c)); return add ? { add, k: null } : null;
  };
  const roleTxt = (k) => (k ? (label[k] || (ROLES.find(r => r.k === k) || {}).n || '').toLowerCase() : 'o tema do comandante');
  const nivel = [];
  const naoTrava = (c) => !LOCK.has(c.name) && !usedOut.has(c.name);
  if (A._tgt < A.bracket || A.gc.length > A._gcMax) {
    const gcs = A.uniq.filter(c => c.gc && naoTrava(c)).sort((a, b) => cutScore(A, b, new Set()) - cutScore(A, a, new Set()));
    gcs.slice(0, Math.max(0, A.gc.length - A._gcMax)).forEach(c => nivel.push([c, `é uma das "game changers"; o Bracket ${A._tgt} ${A._gcMax ? `aceita no máximo ${A._gcMax}` : 'não aceita nenhuma'} e o deck tem ${A.gc.length}`]));
  }
  if (A._tgt < 4) A.uniq.filter(c => c.tags.includes('mass-land-denial') && naoTrava(c)).forEach(c => nivel.push([c, `destrói terrenos em massa, o que só cabe no Bracket 4`]));
  if (A._tgt < 3) {
    A.uniq.filter(c => c.tags.includes('extra-turn') && naoTrava(c)).slice(A.extraTurns.length >= 2 ? 0 : 99).forEach(c => nivel.push([c, `turnos extras em sequência sobem o deck para o Bracket 3`]));
    const tut = A.tutorCards.filter(c => naoTrava(c) && !c.gc).sort((a, b) => (b.r || 1e6) - (a.r || 1e6));
    tut.slice(0, Math.max(0, A.tutors - 3)).forEach(c => nivel.push([c, `o deck tem ${A.tutors} tutores; no Bracket ${A._tgt} o comum é até 3`]));
  }
  for (const [c, why] of nivel) {
    if (usedOut.has(c.name)) continue;
    const r = subst(c, (x) => !isLand(x) && (!isTutor(x) || A._tgt >= 3)); if (!r) continue;
    push({ goal: 'Nível de poder', out: c.name, inn: r.add.c.name, whyOut: why, whyIn: `Cobre ${roleTxt(r.k)} sem passar do Bracket ${A._tgt}${r.add.c.usd ? `, por ${brlTxt(r.add.c.usd)}` : ''}.`, alts: (r.k ? poolFor(r.k) : themePool).filter(x => !usedIn.has(x.c.name) && x.c.name !== r.add.c.name && cabe(x.c, c)).slice(0, 5).map(x => x.c.name), altsOut: [] });
    realRoles(r.add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; }); realRoles(c).forEach(k => cnt[k]--);
  }
  // 0b) bracket alvo maior: entram game changers das suas cores, até o limite do bracket
  if (CONC.br && A._tgt > A.bracket && A._gcOk) {
    const quer = Math.min(A._gcMax - GC, A._tgt >= 4 ? 4 : 3);
    const gcPool = rankAdds(A, addPool(A, c => c.gc && !isLand(c), 40));
    for (let i = 0; i < quer; i++) {
      const cut = pickSurplus() || pickGeneric(); if (!cut) break;
      const add = gcPool.find(x => !usedIn.has(x.c.name) && cabe(x.c, cut.c)); if (!add) break;
      const rn = roleNames(add.c);
      push({ goal: 'Nível de poder', out: cut.c.name, inn: add.c.name, whyOut: cut.why, whyIn: `É uma das "game changers" mais jogadas nas suas cores${rn.length ? ` (${listPt(rn.map(x => x.toLowerCase()))})` : ''}: o tipo de carta que leva o deck ao Bracket ${A._tgt}.`, alts: gcPool.filter(x => !usedIn.has(x.c.name) && x.c.name !== add.c.name && cabe(x.c, cut.c)).slice(0, 5).map(x => x.c.name), altsOut: [] });
      if (cut.k === 'lands') cnt.lands--; else realRoles(cut.c).forEach(k => cnt[k]--);
      realRoles(add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; });
    }
  }
  // 0c) preço: carta acima do teto por carta sai; se o deck passa do orçamento, as mais caras saem por outras da mesma função
  if (A._capCard < Infinity || A._capDeck < Infinity) {
    const caras = A.uniq.filter(c => (c.usd || 0) > 1 && naoTrava(c)).sort((a, b) => b.usd - a.usd);
    for (const c of caras) {
      if (usedOut.has(c.name)) continue;
      const acima = c.usd > A._capCard; if (!acima && PRICE <= A._capDeck) break;
      let r = null;
      if (isLand(c)) {
        const cores = c.pm.replace(/[^WUBRG]/g, '');
        const basicos = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
        const terras = rankAdds(A, addPool(A, l => isLand(l) && !/Basic/.test(l.t) && (l.usd || 0) < c.usd * 0.5 && [...cores].every(x => l.pm.includes(x)), 30)).filter(x => !usedIn.has(x.c.name));
        const ide = [...A.ident].sort((a, b) => (A.sources[a] - A.colorNeed[a]) - (A.sources[b] - A.colorNeed[b]));
        const b0 = ide.length ? C(basicos[ide[0]]) : null;
        const add = terras.find(x => cabe(x.c, c)) || (b0 ? { c: b0 } : null);
        if (add) r = { add, k: 'lands', alts: terras.filter(x => x.c.name !== add.c.name).slice(0, 5).map(x => x.c.name) };
      } else {
        const rs = realRoles(c);
        for (const k of rs) { const pool = poolFor(k).filter(x => !usedIn.has(x.c.name) && !isLand(x.c) && (x.c.usd || 0) < c.usd * 0.5 && cabe(x.c, c)); if (pool.length) { r = { add: pool[0], k, alts: pool.slice(1, 6).map(x => x.c.name) }; break; } }
        if (!r) { const pool = themePool.filter(x => !usedIn.has(x.c.name) && (x.c.usd || 0) < c.usd * 0.5 && cabe(x.c, c)); if (pool.length) r = { add: pool[0], k: null, alts: pool.slice(1, 6).map(x => x.c.name) }; }
      }
      if (!r) continue;
      const tetoTxt = acima ? `custa ${brlTxt(c.usd)}, acima do seu teto de ${brlTxt(A._capCard)} por carta` : `é das mais caras do deck (${brlTxt(c.usd)}) e o deck está ${brlTxt(PRICE - A._capDeck)} acima do orçamento de ${brlTxt(A._capDeck)}`;
      if (!push({ goal: 'Preço', out: c.name, inn: r.add.c.name, whyOut: tetoTxt, whyIn: `Faz ${r.k === 'lands' ? 'o papel de terreno' : 'o mesmo papel (' + roleTxt(r.k) + ')'} por ${brlTxt(r.add.c.usd, 1)}, uma economia de ${brlTxt(c.usd - (r.add.c.usd || 0))}.`, alts: r.alts, altsOut: [] })) break;
      if (r.k !== 'lands') { realRoles(c).forEach(k => cnt[k]--); realRoles(r.add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; }); }
    }
  }
  const maxN = swaps.length + 10;
  for (let guard = 0; guard < 14 && swaps.length < maxN; guard++) {
    const d = demand();
    let cut = pickSurplus();
    if (!cut && d && d.gap) cut = pickGeneric();
    if (!cut) break;
    let pool, goal, whyIn;
    if (d) {
      pool = poolFor(d.r.k); goal = label[d.r.k] || d.r.n;
      whyIn = d.gap ? `${d.r.n} está em ${fmt(cnt[d.r.k])}; o normal é ${d.r.lo}–${d.r.hi}. ${d.r.why}` : `${d.r.n} está em ${fmt(cnt[d.r.k])}, na parte de baixo da faixa ${d.r.lo}–${d.r.hi}. Com a folga que sobra em outra função, vale reforçar. ${d.r.why}`;
    } else {
      pool = themePool; goal = 'Foco no plano';
      whyIn = `As funções básicas já estão nas faixas; esta puxa para ${thList.map(t => t.n.toLowerCase()).join(' e ')}, o que o comandante pede.`;
    }
    const add = pool.find(x => !usedIn.has(x.c.name) && cabe(x.c, cut.c) && !realRoles(x.c).some(k => k !== (d && d.r.k) && cnt[k] >= refOf(k).hi));
    if (!add) { if (d) { cnt[d.r.k] = 1e9; continue; } break; }
    const alts = pool.filter(x => !usedIn.has(x.c.name) && x.c.name !== add.c.name).slice(0, 5).map(x => x.c.name);
    push({ goal, out: cut.c.name, inn: add.c.name, whyOut: cut.why, whyIn: add.th && d ? whyIn + ' Esta também conversa com o tema do comandante.' : whyIn, alts, altsOut: [] });
    if (!cut.k) swaps[swaps.length - 1].altsOut = altsCut().filter(n => n !== cut.c.name).slice(0, 4);
    if (cut.k === 'lands') cnt.lands--; else realRoles(cut.c).forEach(k => cnt[k]--);
    realRoles(add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; });
  }

  // 2) cores com poucas fontes: um básico da cor que sobra sai, um terreno que faz a cor que falta entra
  const ident = [...A.ident]; const src = Object.assign({}, A.sources);
  if (ident.length >= 2) {
    const short = ident.filter(x => A.pips[x] >= 1 && src[x] < A.colorNeed[x]).sort((a, b) => (src[a] - A.colorNeed[a]) - (src[b] - A.colorNeed[b]));
    const surplus = (x) => (x in src ? src[x] - A.colorNeed[x] : -99);
    for (const x of short) {
      const k = Math.min(3, A.colorNeed[x] - src[x]);
      const lands = rankAdds(A, addPool(A, c => isLand(c) && !/Basic/.test(c.t) && c.pm.includes(x) && c.pm.replace(/[^WUBRG]/g, '').length >= 2, 40)).sort((a, b) => (TAPPED_RX(a.c) - TAPPED_RX(b.c)) || a.s - b.s);
      for (let i = 0; i < k; i++) {
        const add = lands.find(l => !usedIn.has(l.c.name) && cabe(l.c, null)); if (!add) break;
        const basics = A.uniq.filter(c => /Basic Land/.test(c.t) && !usedOut.has(c.name) && !c.pm.includes(x)).sort((a, b) => surplus(b.pm.replace(/[^WUBRG]/g, '')[0]) - surplus(a.pm.replace(/[^WUBRG]/g, '')[0]));
        const tappedL = A.uniq.filter(c => isLand(c) && !/Basic/.test(c.t) && TAPPED_RX(c) && !c.pm.includes(x) && !usedOut.has(c.name));
        const cut = basics[0] || tappedL[0]; if (!cut) break;
        const alts = lands.filter(l => !usedIn.has(l.c.name) && l.c.name !== add.c.name).slice(0, 5).map(l => l.c.name);
        if (!push({ goal: 'Base de mana', out: cut.name, inn: add.c.name, whyOut: /Basic/.test(cut.t) ? `é um básico de uma cor que já tem fontes de sobra` : 'entra virado e não faz a cor que falta', whyIn: `${COLORNAME[x]}: ${src[x]} fontes para ${A.pips[x].toFixed(0)} símbolos; o recomendado é ${A.colorNeed[x]}. Este terreno faz ${COLORNAME[x].toLowerCase()} e mais uma cor${TAPPED_RX(add.c) ? '' : ', sem entrar virado'}.`, alts, altsOut: [] })) break;
        src[x]++; // conta a troca para não pedir a mesma cor de novo
      }
    }
  }

  // 3b) terrenos de menos
  if (lr && cnt.lands < lr.lo) {
    const k = Math.min(3, Math.ceil(lr.lo - lr.have));
    const lands = rankAdds(A, addPool(A, c => isLand(c) && !/Basic/.test(c.t) && !TAPPED_RX(c) && (ident.length < 2 ? true : c.pm.replace(/[^WUBRG]/g, '').length >= 2), 40));
    for (let i = 0; i < k; i++) {
      const cut = nextCut(); const add = cut && lands.find(l => !usedIn.has(l.c.name) && cabe(l.c, cut.c)); if (!add || !cut) break;
      push({ goal: 'Terrenos', out: cut.c.name, inn: add.c.name, whyOut: whyCut(A, cut.c), whyIn: `O deck tem ${fmt(lr.have)} terrenos e a curva pede ${lr.lo}–${lr.hi}. Com menos que isso a mão inicial trava com frequência.`, alts: lands.filter(l => !usedIn.has(l.c.name) && l.c.name !== add.c.name).slice(0, 5).map(l => l.c.name), altsOut: altsCut().filter(n => n !== cut.c.name).slice(0, 4) });
    }
  }

  // 4) sobrou carta sem papel: troca por carta do tema do comandante
  const cmdTh = [...A.cmdThemes];
  if (cmdTh.length) {
    const th = THEMES.filter(t => A.cmdThemes.has(t.k));
    const pool = rankAdds(A, addPool(A, c => !isLand(c) && th.some(t => t.rx.test(c.o) || (t.type && t.type.test(c.t))), 40));
    const leftovers = cutsAll.filter(x => !usedOut.has(x.c.name) && (A.noRole.includes(x.c.name) || A.bodyOnly.includes(x.c.name)));
    for (const cut of leftovers.slice(0, Math.max(0, 12 - swaps.length))) {
      const add = pool.find(x => !usedIn.has(x.c.name) && cabe(x.c, cut.c)); if (!add) break;
      if (!push({ goal: 'Foco no plano', out: cut.c.name, inn: add.c.name, whyOut: whyCut(A, cut.c), whyIn: `Puxa para ${th.map(t => t.n.toLowerCase()).join(' e ')}, o que o comandante pede. Entre as mais jogadas nas suas cores com esse tema.`, alts: pool.filter(x => !usedIn.has(x.c.name) && x.c.name !== add.c.name).slice(0, 5).map(x => x.c.name), altsOut: [] })) break;
    }
  }
  return swaps;
}

let SWAPS = [], SWAP_ON = [];
function swapBox(name, tag) {
  const c = C(name); if (!c) return '';
  const ia = window.PAPEIS_IA && window.PAPEIS_IA[c.name];
  const roles = [...rolesOf(c)].filter(k => k !== 'body').map(k => ROLES.find(r => r.k === k).n).slice(0, 3);
  return `<div class="cbox"><span class="ctag ${tag === 'SAI' ? 'out' : 'in'}">${tag}</span><div class="cimg" data-swimg="${esc(name)}"><span class="note">…</span></div>
    <div><button class="cn" data-card="${esc(name)}"><b>${esc(name)}</b></button><div style="margin-top:4px">${manaHTML(c.m)} <span class="note">${esc(c.t)}</span></div>
    ${ia && ia.r ? `<p class="note" style="margin:6px 0 0">${esc(ia.r)}</p>` : ''}
    <div class="chips" style="margin-top:6px">${roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
    <p class="note" style="margin:6px 0 0">${c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas` : 'Quase não aparece em decks de Commander'}${c.usd ? ` · ${brl(c.usd, 1)}` : ''}</p></div></div>`;
}
// por que esta carta no lugar daquela: comparação direta das duas
function roleNames(c) { return [...rolesOf(c)].filter(k => k !== 'body' && k !== 'enabler').map(k => (ROLES.find(r => r.k === k) || {}).n).filter(Boolean); }
function listPt(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
function compareText(A, s) {
  const o = C(s.out), n = C(s.inn); if (!o || !n) return '';
  const ia = window.PAPEIS_IA || {};
  const lo = roleNames(o).map(x => x.toLowerCase()), ln = roleNames(n).map(x => x.toLowerCase());
  const out = [];
  const front = (c) => c.o.split('\n//\n')[0];
  // o que a nova faz
  let gain = ln.length ? `${n.name} traz ${listPt(ln)}` : `${n.name} reforça o plano do deck`;
  if (ia[n.name] && ia[n.name].r) gain += ` (${ia[n.name].r.replace(/\.$/, '').toLowerCase()})`;
  out.push(gain + '.');
  // detalhes que fazem diferença
  const no = front(n);
  if (/target (nonland )?permanent|target artifact, creature, enchantment|nonland permanent/i.test(no) && /Destroy|Exile|Return|shuffles/i.test(no)) out.push('Responde a qualquer tipo de ameaça, não só a criaturas.');
  else if (/artifact or enchantment|artifact and enchantment/i.test(no)) out.push('Serve contra artefatos e encantamentos, que costumam ser as peças que travam a mesa.');
  if (/Destroy all|Exile all|each creature|All creatures get -/i.test(no)) out.push('Zera a mesa quando alguém dispara na frente.');
  if ((/Instant/.test(n.t) || /\bFlash\b/.test(no)) && !isLand(n)) out.push('Pode ser usada no turno dos outros, na hora em que a ameaça aparece.');
  if (/Whenever[^.]*draw a card|At the beginning of[^.]*draw/i.test(no)) out.push('Compra mais de uma vez, então rende mais quanto mais tempo fica na mesa.');
  if (isLand(n) && ln.length) out.push('E ainda é um terreno: dá para jogar como terreno quando a remoção não for necessária.');
  if (isLand(n)) { const cols = n.pm.replace(/[^WUBRG]/g, '').split('').filter(x => A.ident.has(x)); if (cols.length) out.push(`Faz ${listPt(cols.map(x => COLORNAME[x].toLowerCase()))}${TAPPED_RX(n) ? '' : ' e entra desvirado'}.`); }
  if (!isLand(n) && !isLand(o)) {
    if (n.v < o.v) out.push(`Custa ${o.v - n.v} a menos (${n.v} contra ${o.v}), então chega mais cedo na partida.`);
    else if (n.v > o.v + 1) out.push(`Custa ${n.v - o.v} a mais, mas cobre um buraco que a outra não cobre.`);
  }
  const th = [...themesOf(n, A.cmdThemes)].filter(t => A.cmdThemes.has(t)).map(t => THEMES.find(x => x.k === t).n.toLowerCase());
  if (th.length) out.push(`De quebra, conversa com ${listPt(th)}, o tema do comandante.`);
  // o que se perde
  if (isLand(o)) out.push(`Você perde um terreno ${/Basic/.test(o.t) ? 'básico' : ''} que estava sobrando.`.replace('  ', ' '));
  else if (lo.length) {
    const keep = [...rolesOf(o)].filter(k => k !== 'body' && k !== 'enabler').map(k => { const r = A.refs.find(x => x.k === k); const have = (A.byRole[k] || []).reduce((p, [, q]) => p + q, 0); return r ? `${r.n.toLowerCase()} fica em ${fmt(have - 1)}` : null; }).filter(Boolean);
    out.push(`Em troca, sai ${o.name}, que dava ${listPt(lo)}${keep.length ? `; mesmo sem ela, ${listPt(keep)}` : ''}.`);
  } else out.push(`Em troca, sai ${o.name}, que ${ia[o.name] && ia[o.name].r ? 'hoje ' + ia[o.name].r.replace(/\.$/, '').toLowerCase().replace(/^([a-zà-ú])/, m => m) : 'não cumpre nenhuma função clara no deck'}.`);
  if (n.r && (!o.r || n.r < o.r / 3)) out.push(`Ela também aparece em muito mais decks de Commander (nº ${n.r.toLocaleString('pt-BR')} entre as mais jogadas${o.r ? `, contra nº ${o.r.toLocaleString('pt-BR')}` : ''}), sinal de que a comunidade acha que rende mais.`);
  return out.join(' ');
}

// prévia ao passar o mouse nas outras opções
let HOVT = null;
function hoverBox() { let h = $('#hov'); if (!h) { h = document.createElement('div'); h.id = 'hov'; h.className = 'hov'; h.hidden = true; document.body.appendChild(h); } return h; }
document.addEventListener('mouseover', (e) => {
  const b = e.target.closest && e.target.closest('[data-altin],[data-altout],.cn[data-card]'); if (!b || b.closest('#pop')) return;
  clearTimeout(HOVT);
  HOVT = setTimeout(() => {
    const c = C(b.dataset.n || b.dataset.card); if (!c) return;
    const h = hoverBox(); const ia = window.PAPEIS_IA && window.PAPEIS_IA[c.name];
    const roles = roleNames(c);
    h.innerHTML = `<div class="hov-img" data-hovimg="${esc(c.name)}"><span class="note">…</span></div><div><b>${esc(c.name)}</b><div style="margin:2px 0 4px">${manaHTML(c.m)} <span class="note">${esc(c.t)}</span></div>${ia && ia.r ? `<p class="note" style="margin:0 0 4px">${esc(ia.r)}</p>` : `<p class="note hov-o" style="margin:0 0 4px">${esc(c.o.split('\n//\n')[0].slice(0, 260))}${c.o.length > 260 ? '…' : ''}</p>`}<div class="chips">${roles.slice(0, 3).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div><p class="note" style="margin:6px 0 0">${b.dataset.altin != null ? 'Clique para colocar esta no lugar.' : b.dataset.altout != null ? 'Clique para tirar esta no lugar.' : 'Clique para ver os detalhes.'}</p></div>`;
    const r = b.getBoundingClientRect(); const w = 360;
    h.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    const below = r.bottom + 8, hgt = 210;
    h.style.top = (below + hgt < window.innerHeight ? below : Math.max(8, r.top - hgt - 8)) + 'px';
    h.hidden = false;
    imgFor(c.name).then(src => { const el = h.querySelector('[data-hovimg]'); if (el && el.dataset.hovimg === c.name) el.innerHTML = src ? `<img src="${src}" alt="">` : '<span class="note">sem imagem</span>'; });
  }, 120);
});
document.addEventListener('mouseout', (e) => { const b = e.target.closest && e.target.closest('[data-altin],[data-altout],.cn[data-card]'); if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return; clearTimeout(HOVT); const h = $('#hov'); if (h) h.hidden = true; });
document.addEventListener('click', () => { clearTimeout(HOVT); const h = $('#hov'); if (h) h.hidden = true; }, true);

// o que a troca faz pelo plano do comandante (lido do texto das duas cartas)
function planoTroca(A, s) {
  const P = A.plano; if (!P || !P.ativo) return '';
  const pi = valorPlano(A, C(s.inn)), po = valorPlano(A, C(s.out));
  const bits = [];
  if (pi.why.length) bits.push(`${s.inn}: ${pi.why.join('; ')}`);
  if (po.why.length) bits.push(`${s.out}: ${po.why.join('; ')}`);
  if (!bits.length) return '';
  const d = pi.v - po.v, tom = d >= 1 ? 'adianta o plano' : d <= -1 ? 'atrasa o plano (só faça se a função que falta pesar mais)' : 'quase neutra para o plano';
  return `<dt>Pelo plano de ${esc(P.nome)}</dt><dd>${esc(bits.join('. '))}. <b>Troca ${tom}.</b></dd>`;
}
function edhTroca(A, s) {
  if (!A.edh) return '';
  const temas = A.edh.pags.map(p => EDH_TEMA_N(p.k, A.edh.tribo)).join(' / ');
  const f = (n) => { const x = edhCarta(A.edh, C(n)); return x ? `${Math.round(100 * x.inc)}% dos decks do tema contra ${Math.round(100 * x.base)}% em geral (sinergia ${x.syn >= 0 ? '+' : ''}${Math.round(100 * x.syn)}%)` : 'não aparece nas listas do tema'; };
  const d = edhNota(A.edh, C(s.inn)) - edhNota(A.edh, C(s.out));
  const tom = d >= 0.12 ? 'serve mais à ideia' : d <= -0.12 ? 'a que sai serve mais à ideia: só faça se a função que falta pesar mais' : 'empate para a ideia';
  return `<dt>Sinergia com a ideia (EDHREC, decks ${esc(temas)} ${esc(A.edh.cor)})</dt><dd>${esc(s.inn)}: ${f(s.inn)}. ${esc(s.out)}: ${f(s.out)}. <b>Troca ${tom}.</b></dd>`;
}
function edhBox(A) {
  const nome = A.plano ? A.plano.nome : 'o comandante';
  const cm = A.cmds.length ? edhJa(edhCmdCam(A.cmds.map(c => c.name))) : null;
  const bits = [];
  if (A.edh) bits.push(`A sinergia de cada troca é medida contra a sua ideia: decks ${A.edh.pags.map(p => EDH_TEMA_N(p.k, A.edh.tribo)).join(', ')} ${A.edh.cor} no EDHREC (quanto a carta aparece neles a mais que nos decks dessas cores em geral).`);
  if (cm && cm.tags.length) bits.push(`Só para comparar, no EDHREC quem joga ${nome} costuma ir de: ${cm.tags.map(([t, n]) => `${t} (${n.toLocaleString('pt-BR')})`).join(', ')}. Isso não muda as trocas.`);
  return bits.length ? `<p class="note">${esc(bits.join(' '))}</p>` : '';
}
function planoBox(A) {
  const P = A.plano; if (!P || !P.ativo || !P.quer.length) return edhBox(A);
  const o = P.goad ? `${P.nome} vence fazendo os oponentes se atacarem enquanto você fica protegido` : P.voltron ? `${P.nome} vence atacando e carregando auras e equipamentos` : `${P.nome} vence atacando`;
  return `<div class="plano-box"><b>O plano de ${esc(P.nome)}</b><p>${esc(o)}. Cada turno que ele demora a entrar ou a atacar armado custa a partida. As trocas abaixo protegem e procuram o que adianta isso:</p><ul>${P.quer.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p class="note">Cartas do tema não ficam só por serem do tema: uma aura cara que dá pouco pode sair, e uma barata com evasão ou proteção fica.</p>${edhBox(A)}</div>`;
}
function renderSwapCard(s, i) {
  return `<div class="swapcard${SWAP_ON[i] ? '' : ' off'}" data-sw="${i}">
    <div class="sw-h"><span class="tag">${esc(s.goal)}</span><h3>Troca ${i + 1}: ${esc(s.out)} → ${esc(s.inn)}</h3><button class="btn small" style="margin-left:auto" data-lockout="${esc(s.out)}" title="Trava a carta que sai e refaz as trocas">Não tirar ${esc(s.out)}</button><label class="field" style="margin:0"><input type="checkbox" data-swon="${i}" ${SWAP_ON[i] ? 'checked' : ''}> fazer esta troca</label></div>
    <div class="pair">${swapBox(s.out, 'SAI')}${swapBox(s.inn, 'ENTRA')}</div>
    ${swapNums(LAST, s)}
    <dl class="sw-why"><dt>Por que sai</dt><dd>${esc(s.whyOut)}.</dd><dt>Por que entra</dt><dd>${esc(s.whyIn)}</dd><dt>Na prática</dt><dd class="cmp">${esc(compareText(LAST, s))}</dd>${planoTroca(LAST, s)}${edhTroca(LAST, s)}</dl>
    ${s.alts.length ? `<div class="alt"><span class="note">Prefere outra para entrar?</span><div class="links">${s.alts.map(n => `<button class="cn" data-altin="${i}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
    ${s.altsOut.length ? `<div class="alt"><span class="note">Ou tirar outra no lugar:</span><div class="links">${s.altsOut.map(n => `<button class="cn" data-altout="${i}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
  </div>`;
}
// ---------- gráficos das trocas (linguagem do Grimório Arena: KPI, trilho com a média, colunas, réguas) ----------
const pctTxt = (v) => (v == null ? '—' : (100 * v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
const ptsTxt = (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const swKey = (s) => s.out + '→' + s.inn;
function teste() { const T = window.RAIOX_TESTE; return T && T.deck === LAST ? T : null; }
function testeDe(s) { const T = teste(); return T ? T.pares.find(t => t.out === s.out && t.inn === s.inn) || null : null; }
function onKeys() { return SWAPS.filter((s, i) => SWAP_ON[i]).map(swKey).sort().join('|'); }
function kpi(rot, antes, depois, nota, tom) {
  const mudou = depois != null && depois !== antes;
  return `<div class="kpi${tom ? ' destaque ' + tom : ''}"><span class="k">${rot}</span><b>${mudou ? `<span class="de">${antes}</span><span class="seta">→</span>${depois}` : antes}</b><small>${nota}</small></div>`;
}
function swapSum(A) {
  let p = A.price, gc = A.gc.length;
  SWAPS.forEach((s, i) => { if (!SWAP_ON[i]) return; const a = C(s.inn) || {}, b = C(s.out) || {}; p += (a.usd || 0) - (b.usd || 0); gc += (a.gc ? 1 : 0) - (b.gc ? 1 : 0); });
  const tgt = +CONC.br, teto = +CONC.teto;
  const passou = teto > 0 && p * USD_BRL > teto + 0.5;
  const dP = (p - A.price) * USD_BRL;
  const precoNota = teto > 0 ? (passou ? `ainda acima do teto de R$ ${teto.toLocaleString('pt-BR')}` : `dentro do teto de R$ ${teto.toLocaleString('pt-BR')}`) : Math.abs(dP) < 1 ? 'as trocas quase não mudam o preço' : dP < 0 ? `economiza R$ ${Math.round(-dP).toLocaleString('pt-BR')}` : `soma R$ ${Math.round(dP).toLocaleString('pt-BR')}`;
  const precoTom = passou ? 'ruim' : Math.abs(dP) < 1 ? '' : dP < 0 ? 'bom' : (teto > 0 ? '' : 'ruim');
  // vitórias: do teste pareado da Mesa simulada, se ele foi feito com as trocas marcadas agora
  const T = teste(); let vit;
  if (!T) vit = `<div class="kpi vazio"><span class="k">Vitórias na mesa simulada</span><b>—</b><small>Ainda sem teste. <button class="btn small" data-swtest>Testar as trocas marcadas</button></small></div>`;
  else {
    const igual = T.testadas.slice().sort().join('|') === onKeys();
    if (T.todas && igual) { const t = T.todas, sig = Math.abs(t.d) > 1.5 * t.se; vit = kpi('Vitórias na mesa simulada', pctTxt(T.base), pctTxt(t.wr), `${ptsTxt(t.d)} pontos (ruído ±${t.se.toFixed(1).replace('.', ',')}) em ${T.N.toLocaleString('pt-BR')} partidas`, sig ? (t.d > 0 ? 'bom' : 'ruim') : ''); }
    else vit = kpi('Vitórias na mesa simulada', pctTxt(T.base), null, `com a lista atual. O teste foi feito com outras trocas marcadas: <button class="btn small" data-swtest>Testar de novo</button>`, '');
  }
  const brTom = tgt && tgt !== A.bracket ? 'bom' : '';
  const gcTom = gc > A._gcMax ? 'ruim' : gc !== A.gc.length ? 'bom' : '';
  return vit
    + kpi('Preço do deck', brlTxt(A.price), Math.abs(dP) >= 1 ? brlTxt(p) : null, precoNota, precoTom)
    + kpi('Bracket', String(A.bracket), tgt && tgt !== A.bracket ? String(tgt) : null, tgt ? 'alvo que você escolheu' : 'estimado pela lista', brTom)
    + kpi('Game changers', String(A.gc.length), gc !== A.gc.length ? String(gc) : null, A._gcMax === 0 ? `o Bracket ${A._tgt} não aceita nenhuma` : A._gcMax === 3 ? 'o Bracket 3 aceita até 3' : 'o Bracket 4 não tem limite', gcTom);
}
// funções e curva: hoje × com as trocas marcadas
function swapGraf(A) {
  const n = SWAP_ON.filter(Boolean).length;
  const B = n ? analyze(newList(A), A.cmds.map(c => c.name)) : A;
  const reguas = A.refs.map(r => {
    const r2 = (B.refs || []).find(x => x.k === r.k) || r;
    const max = Math.max(r.hi * 1.35, r.have, r2.have) + 1, x = (v) => (100 * v / max).toFixed(1) + '%';
    const mudou = r2.have !== r.have, dentro = (v) => v >= r.lo && v <= r.hi;
    const tom = !mudou ? '' : dentro(r2.have) && !dentro(r.have) ? 'bom' : !dentro(r2.have) && dentro(r.have) ? 'ruim' : Math.abs(r2.have - (r.lo + r.hi) / 2) < Math.abs(r.have - (r.lo + r.hi) / 2) ? 'bom' : 'ruim';
    return `<div class="rg${mudou ? '' : ' igual'}"><span class="rg-n">${esc(r.n)}</span>
      <span class="rg-t" title="Faixa comum: ${r.lo}–${r.hi}"><span class="rg-band" style="left:${x(r.lo)};width:calc(${x(r.hi)} - ${x(r.lo)})"></span><i class="rg-hoje" style="left:${x(r.have)}"></i>${mudou ? `<i class="rg-dep ${tom}" style="left:${x(r2.have)}"></i>` : ''}</span>
      <span class="rg-v">${fmt(r.have)}${mudou ? ` <span class="seta">→</span> <b class="${tom}">${fmt(r2.have)}</b>` : ''}</span></div>`;
  }).join('');
  const cmax = Math.max(1, ...A.curve, ...B.curve);
  const curva = A.curve.map((q, v) => { const q2 = B.curve[v], d = q2 - q; return `<div class="col" title="Custo ${v}${v === 7 ? '+' : ''}: ${q} hoje${d ? `, ${q2} com as trocas` : ''}"><span class="col-q">${q2}${d ? `<small class="${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</small>` : ''}</span><span class="col-b"><i class="antes" style="height:${(100 * q / cmax).toFixed(1)}%"></i><i class="dep" style="height:${(100 * q2 / cmax).toFixed(1)}%"></i></span><span class="col-l">${v}${v === 7 ? '+' : ''}</span></div>`; }).join('');
  const mv = B.avgMV - A.avgMV;
  return `<div class="graf2">
    <div class="gbox"><h3>Funções: hoje × com as trocas</h3><p class="note">A faixa clara é o normal para Commander. <span class="lg-hoje"></span> hoje · <span class="lg-dep"></span> com as ${n} troca${n === 1 ? '' : 's'} marcada${n === 1 ? '' : 's'}.</p><div class="reguas">${reguas}</div></div>
    <div class="gbox"><h3>Curva de mana</h3><p class="note"><span class="lg-antes"></span> hoje · <span class="lg-dep"></span> com as trocas. Custo médio ${A.avgMV.toFixed(2).replace('.', ',')}${Math.abs(mv) >= 0.005 ? ` <span class="seta">→</span> <b>${B.avgMV.toFixed(2).replace('.', ',')}</b>` : ''}.</p><div class="curva2">${curva}</div></div>
  </div>`;
}
// em cada troca: sai × entra na mesa, no bolso e nas funções
function swapNums(A, s) {
  const o = C(s.out), n = C(s.inn); if (!o || !n) return '';
  const t = testeDe(s), T = teste();
  let mesa;
  if (t && T) {
    const ref = T.base, linhas = [[s.out, t.cSai, 'sai'], [s.inn, t.cEntra, 'entra']];
    const max = Math.max(0.05, ref * 2, ...linhas.map(l => (l[1].wr || 0) * 1.15));
    mesa = linhas.map(([nm, c, k]) => `<div class="vs-l"><span class="vs-n ${k}">${esc(nm)}</span><span class="trilho">${c.wr != null ? `<i class="${c.wr >= ref ? 'bom' : 'ruim'}" style="width:${(100 * c.wr / max).toFixed(1)}%"></i>` : ''}<span class="ref" style="left:${(100 * ref / max).toFixed(1)}%" title="Média do deck: ${pctTxt(ref)}"></span></span><span class="vs-p">${pctTxt(c.wr)}</span><span class="vs-j" title="partidas em que a carta apareceu">${c.j}</span></div>`).join('')
      + `<p class="note vs-r">Vence quando a carta aparece; o tracinho dourado é a média do deck (${pctTxt(ref)}). A troca: <b class="${t.ok ? 'bom' : t.d < -1.5 * t.se ? 'ruim' : ''}">${ptsTxt(t.d)} pontos</b> (±${t.se.toFixed(1).replace('.', ',')}).</p>`;
  } else mesa = `<p class="note">${T ? 'Esta troca não estava marcada (ou mudou de carta) no último teste.' : 'Ainda sem teste.'} <button class="btn small" data-swtest>Testar na mesa simulada</button></p>`;
  // preço: barra que vai para a esquerda (economiza) ou para a direita (soma), na escala da maior troca
  const dv = ((n.usd || 0) - (o.usd || 0)) * USD_BRL;
  const escala = Math.max(5, ...SWAPS.map(x => Math.abs(((C(x.inn) || {}).usd || 0) - ((C(x.out) || {}).usd || 0)) * USD_BRL));
  const w = Math.min(50, 50 * Math.abs(dv) / escala).toFixed(1);
  const bolso = `<div class="pbar"><span class="pb-t"><i class="${dv < 0 ? 'eco' : 'soma'}" style="${dv < 0 ? `right:50%` : `left:50%`};width:${w}%"></i><span class="pb-0"></span></span><span class="pb-v ${Math.abs(dv) < 0.5 ? '' : dv < 0 ? 'bom' : 'ruim'}">${Math.abs(dv) < 0.5 ? 'mesmo preço' : (dv < 0 ? 'economiza ' : 'soma ') + 'R$ ' + Math.abs(dv).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div><p class="note">${brlTxt(o.usd, 1)} <span class="seta">→</span> ${brlTxt(n.usd, 1)}</p>`;
  // funções: o que ganha e o que perde
  const ks = new Set(A.refs.map(r => r.k)), ro = rolesOf(o), rn = rolesOf(n);
  const fun = [...ks].map(k => { const d = (rn.has(k) ? 1 : 0) - (ro.has(k) ? 1 : 0) + (k === 'lands' ? (isLand(n) ? 1 : 0) - (isLand(o) ? 1 : 0) : 0); return d ? `<span class="fx ${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : '−'}1 ${esc(A.refs.find(r => r.k === k).n.toLowerCase())}</span>` : ''; }).join('');
  const mv = !isLand(n) && !isLand(o) && n.v !== o.v ? `<span class="fx ${n.v < o.v ? 'mais' : 'menos'}">custo ${o.v} → ${n.v}</span>` : '';
  return `<div class="sw-num">
    <div><span class="eyebrow">Na mesa simulada</span>${mesa}</div>
    <div><span class="eyebrow">No bolso</span>${bolso}</div>
    <div><span class="eyebrow">Nas funções</span><div class="fxs">${fun + mv || '<span class="note">Mesmas funções medidas.</span>'}</div></div>
  </div>`;
}
function renderSwaps(A) {
  SWAPS = buildSwaps(A); SWAP_ON = SWAPS.map(() => true);
  if (!SWAPS.length) return `<section class="panel"><h2>Trocas sugeridas</h2><p>Nenhuma troca óbvia pela lista: as funções estão nas faixas, a base de mana cobre as cores e não sobraram cartas sem papel. Para afinar daqui, use a <a href="#mesa">mesa simulada</a>, que mede carta por carta.</p></section>`;
  return `<section class="panel"><h2>Trocas sugeridas</h2>
    <p class="lead">Cada troca é um par: a carta que menos contribui sai, e entra uma das mais jogadas nas suas cores para o buraco apontado no resumo. A lista final continua com 100 cartas. Desmarque o que não quiser, troque a carta que entra pelas outras opções e clique em qualquer nome para ler a carta.</p>
    ${planoBox(A)}
    <div class="kpis sw-sum" id="sw-sum">${swapSum(A)}</div>
    <div id="sw-graf">${swapGraf(A)}</div>
    ${A._testBad && A._testBad.length ? `<p class="note" style="color:var(--warn)">Fora das cores do comandante, não dá para testar: ${esc(A._testBad.join(', '))}.</p>` : ''}
    <div id="sw-list">${SWAPS.map(renderSwapCard).join('')}</div>
    <div class="row" style="margin-top:16px"><button class="btn primary" id="sw-apply">Aplicar as trocas marcadas e analisar de novo</button><button class="btn" id="sw-copy">Copiar a lista nova</button><button class="btn" id="sw-test">Testar na mesa simulada</button><button class="btn" id="sw-vivo">Jogar ao vivo com as trocas</button><span class="note" id="sw-msg"></span></div>
  </section>`;
}
function refreshSum(A) { const sm = $('#sw-sum'); if (sm) sm.innerHTML = swapSum(A); const g = $('#sw-graf'); if (g) g.innerHTML = swapGraf(A); }
document.addEventListener('raiox:teste', () => {
  const A = LAST; if (!A || !$('#sw-list')) return; refreshSum(A);
  SWAPS.forEach((s, i) => { const el = $(`[data-sw="${i}"] .sw-num`); if (el) el.outerHTML = swapNums(A, s); });
});
function swapImgs(root) { $$('[data-swimg]', root).forEach(el => imgFor(el.dataset.swimg).then(src => { el.innerHTML = src ? `<img src="${src}" alt="${esc(el.dataset.swimg)}">` : '<span class="note" style="padding:8px;text-align:center">sem imagem</span>'; })); }
function newList(A) {
  const swapped = {}; SWAPS.forEach((s, i) => { if (SWAP_ON[i]) swapped[s.out] = s.inn; });
  const names = A.cards.map(c => c.name); const done = new Set();
  const out = names.map(n => { if (swapped[n] && !done.has(n)) { done.add(n); return swapped[n]; } return n; });
  const k = {}; out.forEach(n => (k[n] = (k[n] || 0) + 1));
  return `// Commander\n${A.cmds.map(c => '1 ' + c.name).join('\n')}\n// Deck\n${Object.entries(k).map(([n, q]) => `${q} ${n}`).join('\n')}`;
}
function wireSwaps(A) {
  const box = $('#sw-list'); if (!box) return;
  swapImgs(box);
  const redraw = (i) => { const el = $(`[data-sw="${i}"]`); el.outerHTML = renderSwapCard(SWAPS[i], i); swapImgs($(`[data-sw="${i}"]`)); refreshSum(A); };
  box.addEventListener('change', (e) => { const i = e.target.dataset.swon; if (i == null) return; SWAP_ON[+i] = e.target.checked; e.target.closest('.swapcard').classList.toggle('off', !e.target.checked); refreshSum(A); });
  box.addEventListener('click', (e) => {
    const lk = e.target.closest('[data-lockout]');
    if (lk) { e.stopPropagation(); CONC.lock = (CONC.lock ? CONC.lock.replace(/\s+$/, '') + '\n' : '') + lk.dataset.lockout; saveConcept(A); rerenderTrocas(A); return; }
    const bi = e.target.closest('[data-altin]'), bo = e.target.closest('[data-altout]');
    if (bi) { e.stopPropagation(); const i = +bi.dataset.altin, s = SWAPS[i], n = bi.dataset.n; if (SWAPS.some((x, j) => j !== i && x.inn === n)) return; s.alts = s.alts.map(x => (x === n ? s.inn : x)); s.inn = n; redraw(i); }
    if (bo) { e.stopPropagation(); const i = +bo.dataset.altout, s = SWAPS[i], n = bo.dataset.n; if (SWAPS.some((x, j) => j !== i && x.out === n)) return; s.altsOut = s.altsOut.map(x => (x === n ? s.out : x)); s.out = n; s.whyOut = whyCut(A, C(n)); redraw(i); }
  }, true);
  const msg = (t) => { $('#sw-msg').textContent = t; };
  $('#sw-copy').onclick = async () => { try { await navigator.clipboard.writeText(newList(A)); msg('Lista copiada. Cole no Moxfield ou no Archidekt.'); } catch (e) { $('#deck-in').value = newList(A); msg('Não deu para copiar daqui; a lista nova foi para a caixa da aba Lista.'); } };
  $('#sw-apply').onclick = () => { const n = SWAP_ON.filter(Boolean).length; if (!n) { msg('Nenhuma troca marcada.'); return; } $('#deck-in').value = newList(A); run(A.cmds.map(c => c.name), 'resumo'); };
  const sec = box.closest('.panel');
  sec.addEventListener('click', (e) => { if (e.target.closest('[data-swtest]')) $('#sw-test').click(); });
  $('#sw-vivo').onclick = () => { if (!SWAP_ON.some(Boolean)) { msg('Nenhuma troca marcada.'); return; } try { localStorage.setItem('raiox:vivoTrocas', '1'); } catch (e) {} window.RAIOX_VIVO_JA = true; location.hash = 'aovivo'; };
  $('#sw-test').onclick = () => { window.RAIOX_VOLTA = 'trocas'; location.hash = 'mesa'; setTimeout(() => { const b = $('#m-tro'); if (b && !b.disabled) b.click(); }, 60); };
}

// ---------- telas ----------
const SCREENS = ['montar', 'lista', 'resumo', 'trocas', 'funcoes', 'mesa', 'aovivo'];
const SUBS = { mana: 'funcoes', plano: 'funcoes' }; // Funções, Mana e Plano viraram uma aba só (Análise)
function show(name) {
  const sub = SUBS[name] ? name : name === 'funcoes' ? 'funcoes' : null; if (SUBS[name]) name = SUBS[name];
  if (!SCREENS.includes(name)) name = LAST && !LAST.empty ? 'resumo' : 'lista';
  $$('[data-s]').forEach(el => { el.hidden = el.dataset.s !== name; });
  $$('#tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + name ? 'page' : 'false'));
  const noDeck = !LAST || LAST.empty; const em = $('#nodeck'); if (em) em.hidden = !(noDeck && name !== 'lista' && name !== 'montar');
  $('#pop').hidden = true;
  document.dispatchEvent(new CustomEvent('raiox:tela', { detail: name }));
  $$('.subnav a').forEach(a => a.setAttribute('aria-current', a.dataset.sub === sub ? 'true' : 'false'));
  const alvo = sub && sub !== 'funcoes' && $('#sub-' + sub);
  if (alvo) requestAnimationFrame(() => window.scrollTo(0, alvo.getBoundingClientRect().top + window.scrollY - 90)); else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

// imagens: endereço direto do CDN do Scryfall (cards.scryfall.io, sem limite), descoberto em lotes de até 75 cartas
// pelo /cards/collection. Antes cada imagem era um pedido ao /cards/named, que só aceita ~2 por segundo: com a fila
// de 110 ms, metade voltava barrada (ERR_BLOCKED_BY_ORB) e a carta ficava só com o nome.
// Cache único da página (a Mesa ao vivo usa o mesmo), guardado no navegador em raiox:img como [small, normal, art_crop].
// ampliar carta: um pedido só, na versão grande
const SCRY = (name, v) => 'https://api.scryfall.com/cards/named?format=image&version=' + (v || 'normal') + '&exact=' + encodeURIComponent(String(name).split(' // ')[0]);
const IMG_V = { small: 0, normal: 1, art_crop: 2 };
const IMGC = new Map();
try { for (const [n, v] of Object.entries(JSON.parse(localStorage.getItem('raiox:img') || '{}'))) IMGC.set(n, v); } catch (e) {}
const IMG_NAO = new Set();
const imgKey = (n) => String(n).split(' // ')[0];
const IMG_FILA = new Map();
let IMG_T = null, IMG_ULT = 0, IMG_SV = null;
function imgGuarda() {
  clearTimeout(IMG_SV);
  IMG_SV = setTimeout(() => { try { localStorage.setItem('raiox:img', JSON.stringify(Object.fromEntries([...IMGC].slice(-4000)))); } catch (e) {} }, 1000);
}
async function imgLote() {
  IMG_T = null;
  const espera = IMG_ULT + 550 - Date.now();
  if (espera > 0) { IMG_T = setTimeout(imgLote, espera); return; }
  const nomes = [...IMG_FILA.keys()].slice(0, 75); if (!nomes.length) return;
  const cbs = nomes.map(n => { const l = IMG_FILA.get(n); IMG_FILA.delete(n); return l; });
  IMG_ULT = Date.now();
  try {
    const r = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ identifiers: nomes.map(name => ({ name })) }) });
    if (r.status === 429) { nomes.forEach((n, i) => IMG_FILA.set(n, (IMG_FILA.get(n) || []).concat(cbs[i]))); IMG_ULT = Date.now() + 1500; }
    else if (r.ok) {
      const j = await r.json();
      for (const c of j.data || []) {
        const iu = c.image_uris || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris); if (!iu) continue;
        const v = [iu.small, iu.normal, iu.art_crop]; IMGC.set(c.name, v); IMGC.set(imgKey(c.name), v);
      }
      for (const x of j.not_found || []) if (x.name) IMG_NAO.add(x.name);
      imgGuarda();
    }
  } catch (e) {}
  nomes.forEach((n, i) => { if (!IMG_FILA.has(n)) cbs[i].forEach(f => f()); });
  if (IMG_FILA.size && !IMG_T) IMG_T = setTimeout(imgLote, 550);
}
function imgFor(name, v) {
  if (!name) return Promise.resolve(null);
  const k = imgKey(name), i = IMG_V[v] != null ? IMG_V[v] : 1;
  const pega = () => { const t = IMGC.get(name) || IMGC.get(k); return t ? (t[i] || t[1]) : null; };
  if (pega() || IMG_NAO.has(k)) return Promise.resolve(pega());
  return new Promise(res => {
    IMG_FILA.set(k, (IMG_FILA.get(k) || []).concat(() => res(pega())));
    if (!IMG_T) IMG_T = setTimeout(imgLote, 40);   // junta os pedidos da mesma tela num lote só
  });
}
const imgsDe = (nomes) => Promise.all([...new Set(nomes)].map(n => imgFor(n)));

// detalhe da carta
document.addEventListener('click', (e) => {
  const pop = $('#pop');
  const b = e.target.closest('[data-card]');
  if (!b) { if (!e.target.closest('#pop')) pop.hidden = true; return; }
  const c = C(b.dataset.card); if (!c) return;
  const roles = [...rolesOf(c)].map(k => ROLES.find(r => r.k === k).n);
  const th = [...themesOf(c, LAST && LAST.cmdThemes)].map(k => THEMES.find(t => t.k === k).n);
  const ia = window.PAPEIS_IA && window.PAPEIS_IA[c.name];
  pop.innerHTML = `<div class="pimg" id="pimg"><span class="note">carregando imagem…</span></div><div class="ptxt"><h3>${esc(c.name)}</h3><div>${manaHTML(c.m)} <span class="note">${esc(c.t)}</span></div><div class="oracle">${esc(c.o)}</div>${ia && ia.r ? `<p class="note"><b>O que faz:</b> ${esc(ia.r)}</p>` : ''}
    <div class="chips">${roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}${th.map(t => `<span class="tag th">${esc(t)}</span>`).join('')}${c.gc ? '<span class="tag cmd">game changer</span>' : ''}</div>
    <p class="note">${c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas no Commander` : 'Quase não aparece em decks de Commander'}${c.usd ? ` · ${brl(c.usd, 1)}` : ''}</p></div>`;
  pop.hidden = false;
  imgFor(c.name).then(src => { const box = $('#pimg'); if (!box || pop.hidden) return; box.innerHTML = src ? `<img src="${src}" alt="${esc(c.name)}">` : '<span class="note">Não deu para carregar a imagem.</span>'; });
  const r = b.getBoundingClientRect(); const pw = Math.min(620, window.innerWidth - 32);
  pop.style.left = Math.max(16, Math.min(window.innerWidth - pw - 16, r.left)) + 'px';
  pop.style.top = Math.max(16, Math.min(window.innerHeight - 320, r.bottom + 8)) + 'px';
});


// ampliar a carta: clique em qualquer imagem
function openZoom(name, src) {
  let z = $('#zoom');
  if (!z) { z = document.createElement('div'); z.id = 'zoom'; z.className = 'zoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); document.body.appendChild(z); }
  const c = C(name);
  const ia = window.PAPEIS_IA && c && window.PAPEIS_IA[c.name];
  z.innerHTML = `<div class="zoom-box"><button class="btn small zoom-x" aria-label="Fechar">Fechar ✕</button>
    <div class="zoom-img">${src ? `<img src="${src}" alt="${esc(name)}">` : '<span class="note">sem imagem</span>'}</div>
    ${c ? `<div class="zoom-txt"><h3>${esc(c.name)}</h3><div>${manaHTML(c.m)} <span class="note">${esc(c.t)}</span></div><div class="oracle zoom-oracle">${esc(c.o)}</div>${c.p ? `<p class="note">Força/resistência: ${esc(c.p)}</p>` : ''}${ia && ia.r ? `<p><b>O que faz:</b> ${esc(ia.r)}</p>` : ''}</div>` : ''}</div>`;
  z.hidden = false;
  $('.zoom-x', z).focus();
}
document.addEventListener('click', (e) => {
  const z = $('#zoom');
  if (z && !z.hidden) { if (e.target.closest('.zoom-x') || !e.target.closest('.zoom-box')) { z.hidden = true; } e.stopPropagation(); return; }
  const img = e.target.closest('.cimg img, .pimg img');
  if (!img) return;
  e.stopPropagation(); e.preventDefault();
  const holder = img.closest('[data-swimg],[data-img]');
  const name = holder ? (holder.dataset.swimg || holder.dataset.img) : img.alt;
  openZoom(name, SCRY(name, 'large'));
}, true);
document.addEventListener('keydown', (e) => { const z = $('#zoom'); if (e.key === 'Escape' && z && !z.hidden) z.hidden = true; });


// imagem que não carregou (sem internet ou carta sem foto): mostra o nome no lugar do ícone quebrado
document.addEventListener('error', (e) => {
  const im = e.target; if (!im || im.tagName !== 'IMG') return;
  const box = im.parentElement; if (!box) return;
  box.innerHTML = `<span class="noimg">${esc(im.alt || 'sem imagem')}</span>`;
}, true);

// exemplos e entrada
const ex = window.EXEMPLOS || {};
$('#examples').innerHTML = Object.keys(ex).map(k => `<button class="btn small" data-ex="${esc(k)}">${esc(k)}</button>`).join('');
$$('[data-ex]').forEach(b => b.onclick = () => { $('#deck-in').value = ex[b.dataset.ex]; run(); });
$('#go').onclick = () => run();
// a página abre sem deck: só analisa quando você cola uma lista ou escolhe um exemplo
$('#deck-in').placeholder = 'Cole aqui a lista do deck (uma carta por linha, ex.: 1 Sol Ring).';
show(location.hash.slice(1));
})();
