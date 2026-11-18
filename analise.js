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
function parseList(text) {
  const out = { cards: [], cmdHint: [], unknown: [] };
  let section = '';
  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim(); if (!line) continue;
    if (/^\/\//.test(line)) { section = line.replace(/^\/\/\s*/, '').toLowerCase(); continue; }
    if (/^(commander|comandante|deck|mainboard|main|sideboard|maybeboard|considering|companion|tokens?)\s*:?\s*(\(\d+\))?$/i.test(line)) { section = line.toLowerCase(); continue; }
    if (/^(sideboard|maybeboard|considering|tokens?)/.test(section)) continue;
    let m = line.match(/^(\d+)\s*x?\s+(.+)$/i); let q = 1, name = line;
    if (m) { q = +m[1]; name = m[2]; }
    const isCmdTag = /\*CMDR\*|\[commander\]/i.test(name);
    name = name.replace(/\s+\*[A-Z]+\*/g, '').replace(/\s+\[[^\]]*\]/g, '').replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w★-]+)?\s*$/, '').replace(/\s+#.*$/, '').trim();
    const key = IDX[norm(name)] || IDX[norm(name.split(' / ')[0])] || IDX[norm(name.split(' // ')[0])];
    if (!key) { out.unknown.push(name); continue; }
    if (/^commander|^comandante/.test(section) || isCmdTag) out.cmdHint.push(key);
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
  A.tutors = cnt('tutor');
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
window.RAIOX = { parseList, guessCommanders, C, rolesOf, isLand, imgFor: (n) => imgFor(n), get last() { return LAST; } };
function run(forcedCmd, goTo) {
  const text = $('#deck-in').value;
  const A = analyze(text, forcedCmd);
  const out = $('#out');
  if (A.empty) { $('#go-msg').textContent = 'Não reconheci nenhuma carta.' + (A.unknown.length ? ' Exemplos do que não achei: ' + A.unknown.slice(0, 5).join(', ') : ''); return; }
  LAST = A;
  $('#go-msg').textContent = '';
  out.innerHTML = render(A);
  wire(A); wireSwaps(A);
  window.RAIOX_CANDS = null;
  document.dispatchEvent(new CustomEvent('raiox:deck', { detail: A }));
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
    <div class="who"><div class="cmdname">${cmdNames.map(esc).join(' + ') || 'Comandante não encontrado'}</div><div class="ident">${identHTML}<span class="note">${A.total} cartas · custo médio <span class="num">${A.avgMV.toFixed(2)}</span> · ${A.lands} terrenos${A.mdfc ? ` + ${A.mdfc} de duas faces` : ''} · cerca de US$ <span class="num">${Math.round(A.price)}</span></span></div>
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
  <div class="screen" data-s="trocas">${renderSwaps(A)}</div>
  <div class="screen" data-s="funcoes">
  <section class="panel">
    <h2>Funções do deck</h2>
    <p class="lead">Todo deck de Commander precisa cobrir algumas funções básicas, não importa o comandante. As faixas são o que decks que funcionam costumam ter. Uma carta pode contar em mais de uma função.</p>
    <div class="refs">${refRows}</div>
  </section>
  </div>
  <div class="screen" data-s="mana">
  <div class="grid2">
    <section class="panel"><h2>Curva de mana</h2><p class="lead">Quantas cartas (sem contar terrenos) custam 0, 1, 2… manas. Muitas cartas caras deixam os primeiros turnos vazios.</p>${curveSvg}</section>
    <section class="panel"><h2>Base de mana</h2><p class="lead">Fontes de cada cor (terrenos, pedras e criaturas de mana) contra o quanto as suas cartas pedem daquela cor. A linha clara marca o recomendado.</p>${colorRows || '<p class="note">Deck incolor.</p>'}<p class="note" style="margin-top:8px">${A.tapped} terreno(s) sempre entram virados.</p></section>
  </div>
  </div>
  <div class="screen" data-s="plano">
  <section class="panel">
    <h2>Plano de jogo</h2>
    <p class="lead">Os temas que mais aparecem nas cartas. Um deck forte tem 1 ou 2 temas claros e quase todas as cartas puxando para eles.${A.tribe ? ` Tribo principal: <b>${esc(A.tribe[0])}</b> (${A.tribe[1]} criaturas).` : ''}</p>
    <div class="themes">${themeRows}</div>
  </section>
  <div class="grid2">
    <section class="panel"><h2>Cartas sem papel claro</h2><p class="lead">Todas as cartas são lidas: pelas etiquetas da comunidade, pelas regras de texto e, nas que sobram, pela leitura do texto da carta. Aqui ficam as que não têm função nem conversam com os temas do deck. Clique para ver o que cada uma faz e decida.</p>${A.noRole.length ? `<div class="links">${listLinks(A.noRole)}</div>` : '<p class="note">Nenhuma. Todas as cartas têm alguma função ou tema.</p>'}${A.bodyOnly.length ? `<h3 style="margin-top:12px">Só corpo</h3><p class="note">Criaturas sem habilidade que importe para o plano. Às vezes valem pelo tipo (tribo, artefato); senão, são as primeiras candidatas a corte.</p><div class="links">${listLinks(A.bodyOnly)}</div>` : ''}</section>
    <section class="panel"><h2>Pouco jogadas</h2><p class="lead">Cartas que quase ninguém usa no Commander. Às vezes são achados; muitas vezes existe opção melhor para a mesma função.</p>${A.obscure.length ? `<div class="links">${listLinks(A.obscure)}</div>` : '<p class="note">Nenhuma.</p>'}${A.pricey.length ? `<p class="note" style="margin-top:10px">Mais caras: ${A.pricey.map(c => `${esc(c.name)} (US$ ${c.usd.toFixed(0)})`).join(', ')}.</p>` : ''}</section>
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
function cutScore(A, c, needRoles) {
  if (isLand(c)) return -1e9;
  const roles = rolesOf(c); const real = [...roles].filter(k => k !== 'body');
  let s = 0;
  if (A.noRole.includes(c.name)) s += 50;
  if (A.bodyOnly.includes(c.name)) s += 35;
  if (!A.cmdSupport.includes(c.name)) s += 12;
  s += c.r ? 30 * Math.min(c.r, 20000) / 20000 : 30;
  s -= 7 * real.length;
  if (c.gc) s -= 30;
  if (A.avgMV > 3.6 && c.v >= 5) s += 4 * (c.v - 4);
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
  if (!bits.length) bits.push('é das que menos contribuem entre as que sobram');
  return bits.join('; ');
}
function rankAdds(A, list) {
  const cmdTh = A.cmdThemes;
  return list.map(c => { const th = [...themesOf(c, cmdTh)].some(t => cmdTh.has(t)); let s = c.r || 1e6; if (th) s *= 0.45; if (c.v > Math.max(3, A.avgMV + 1)) s *= 1.6; return { c, s, th }; }).sort((a, b) => a.s - b.s);
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
function buildSwaps(A) {
  const swaps = []; const usedOut = new Set(), usedIn = new Set();
  const needRoles = new Set(A.refs.filter(r => r.k !== 'lands' && r.have < r.lo).map(r => r.k));
  const cutsAll = A.uniq.filter(c => !isLand(c)).map(c => ({ c, s: cutScore(A, c, needRoles) })).sort((a, b) => b.s - a.s);
  const nextCut = (avoid) => cutsAll.find(x => !usedOut.has(x.c.name) && x.s > -20 && !(avoid && avoid(x.c)));
  const MAX = 12;
  const push = (sw) => { if (swaps.length >= MAX) return false; swaps.push(sw); usedOut.add(sw.out); usedIn.add(sw.inn); return true; };
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
  for (let guard = 0; guard < 14 && swaps.length < 10; guard++) {
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
    const add = pool.find(x => !usedIn.has(x.c.name));
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
        const add = lands.find(l => !usedIn.has(l.c.name)); if (!add) break;
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
      const add = lands.find(l => !usedIn.has(l.c.name)); const cut = nextCut(); if (!add || !cut) break;
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
      const add = pool.find(x => !usedIn.has(x.c.name)); if (!add) break;
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
    <p class="note" style="margin:6px 0 0">${c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas` : 'Quase não aparece em decks de Commander'}${c.usd ? ` · US$ ${c.usd.toFixed(2).replace('.', ',')}` : ''}</p></div></div>`;
}
function renderSwapCard(s, i) {
  return `<div class="swapcard${SWAP_ON[i] ? '' : ' off'}" data-sw="${i}">
    <div class="sw-h"><span class="tag">${esc(s.goal)}</span><h3>Troca ${i + 1}: ${esc(s.out)} → ${esc(s.inn)}</h3><label class="field" style="margin:0 0 0 auto"><input type="checkbox" data-swon="${i}" ${SWAP_ON[i] ? 'checked' : ''}> fazer esta troca</label></div>
    <div class="pair">${swapBox(s.out, 'SAI')}${swapBox(s.inn, 'ENTRA')}</div>
    <p class="why"><b>Por que sai:</b> ${esc(s.whyOut)}.<br><b>Por que entra:</b> ${esc(s.whyIn)}</p>
    ${s.alts.length ? `<div class="alt"><span class="note">Prefere outra para entrar?</span><div class="links">${s.alts.map(n => `<button class="cn" data-altin="${i}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
    ${s.altsOut.length ? `<div class="alt"><span class="note">Ou tirar outra no lugar:</span><div class="links">${s.altsOut.map(n => `<button class="cn" data-altout="${i}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
  </div>`;
}
function renderSwaps(A) {
  SWAPS = buildSwaps(A); SWAP_ON = SWAPS.map(() => true);
  if (!SWAPS.length) return `<section class="panel"><h2>Trocas sugeridas</h2><p>Nenhuma troca óbvia pela lista: as funções estão nas faixas, a base de mana cobre as cores e não sobraram cartas sem papel. Para afinar daqui, use a <a href="#mesa">mesa simulada</a>, que mede carta por carta.</p></section>`;
  return `<section class="panel"><h2>Trocas sugeridas</h2>
    <p class="lead">Cada troca é um par: a carta que menos contribui sai, e entra uma das mais jogadas nas suas cores para o buraco apontado no resumo. A lista final continua com 100 cartas. Desmarque o que não quiser, troque a carta que entra pelas outras opções e clique em qualquer nome para ler a carta.</p>
    <div id="sw-list">${SWAPS.map(renderSwapCard).join('')}</div>
    <div class="row" style="margin-top:16px"><button class="btn primary" id="sw-apply">Aplicar as trocas marcadas e analisar de novo</button><button class="btn" id="sw-copy">Copiar a lista nova</button><button class="btn" id="sw-test">Testar na mesa simulada</button><span class="note" id="sw-msg"></span></div>
  </section>`;
}
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
  const redraw = (i) => { const el = $(`[data-sw="${i}"]`); el.outerHTML = renderSwapCard(SWAPS[i], i); swapImgs($(`[data-sw="${i}"]`)); };
  box.addEventListener('change', (e) => { const i = e.target.dataset.swon; if (i == null) return; SWAP_ON[+i] = e.target.checked; e.target.closest('.swapcard').classList.toggle('off', !e.target.checked); });
  box.addEventListener('click', (e) => {
    const bi = e.target.closest('[data-altin]'), bo = e.target.closest('[data-altout]');
    if (bi) { e.stopPropagation(); const i = +bi.dataset.altin, s = SWAPS[i], n = bi.dataset.n; if (SWAPS.some((x, j) => j !== i && x.inn === n)) return; s.alts = s.alts.map(x => (x === n ? s.inn : x)); s.inn = n; redraw(i); }
    if (bo) { e.stopPropagation(); const i = +bo.dataset.altout, s = SWAPS[i], n = bo.dataset.n; if (SWAPS.some((x, j) => j !== i && x.out === n)) return; s.altsOut = s.altsOut.map(x => (x === n ? s.out : x)); s.out = n; s.whyOut = whyCut(A, C(n)); redraw(i); }
  }, true);
  const msg = (t) => { $('#sw-msg').textContent = t; };
  $('#sw-copy').onclick = async () => { try { await navigator.clipboard.writeText(newList(A)); msg('Lista copiada. Cole no Moxfield ou no Archidekt.'); } catch (e) { $('#deck-in').value = newList(A); msg('Não deu para copiar daqui; a lista nova foi para a caixa da aba Lista.'); } };
  $('#sw-apply').onclick = () => { const n = SWAP_ON.filter(Boolean).length; if (!n) { msg('Nenhuma troca marcada.'); return; } $('#deck-in').value = newList(A); run(A.cmds.map(c => c.name), 'resumo'); };
  $('#sw-test').onclick = () => { const t = $('#t-cands'); const ins = SWAPS.filter((s, i) => SWAP_ON[i]).map(s => s.inn); window.RAIOX_CANDS = ins; if (t) t.value = ins.join('\n'); location.hash = 'mesa'; };
}

// ---------- telas ----------
const SCREENS = ['lista', 'resumo', 'trocas', 'funcoes', 'mana', 'plano', 'mesa'];
function show(name) {
  if (!SCREENS.includes(name)) name = LAST && !LAST.empty ? 'resumo' : 'lista';
  $$('[data-s]').forEach(el => { el.hidden = el.dataset.s !== name; });
  $$('#tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + name ? 'page' : 'false'));
  const noDeck = !LAST || LAST.empty; const em = $('#nodeck'); if (em) em.hidden = !(noDeck && name !== 'lista');
  $('#pop').hidden = true;
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

// imagens: vêm do Scryfall na hora em que a carta aparece (fila de ~110 ms entre pedidos, como o Scryfall pede)
const SCRY = (name, v) => 'https://api.scryfall.com/cards/named?format=image&version=' + (v || 'normal') + '&exact=' + encodeURIComponent(String(name).split(' // ')[0]);
let QT = 0;
function imgFor(name, v) {
  if (!name) return Promise.resolve(null);
  const now = Date.now(); QT = Math.max(QT + 110, now); const wait = QT - now;
  return new Promise(res => setTimeout(() => res(SCRY(name, v)), wait));
}

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
    <p class="note">${c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas no Commander` : 'Quase não aparece em decks de Commander'}${c.usd ? ` · US$ ${c.usd.toFixed(2)}` : ''}</p></div>`;
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

// exemplos e entrada
const ex = window.EXEMPLOS || {};
$('#examples').innerHTML = Object.keys(ex).map(k => `<button class="btn small" data-ex="${esc(k)}">${esc(k)}</button>`).join('');
$$('[data-ex]').forEach(b => b.onclick = () => { $('#deck-in').value = ex[b.dataset.ex]; run(); });
$('#go').onclick = () => run();
// a página abre sem deck: só analisa quando você cola uma lista ou escolhe um exemplo
$('#deck-in').placeholder = 'Cole aqui a lista do deck (uma carta por linha, ex.: 1 Sol Ring).';
show(location.hash.slice(1));
})();
