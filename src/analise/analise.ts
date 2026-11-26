/* Raio-X do Deck: análise de qualquer deck de Commander a partir da lista colada. */
// T43 (c): era o analise.js (script clássico dentro de uma função anônima); virou módulo ES, carregado pelo src/main.ts.
// Migração mecânica: só saiu o embrulho (o módulo já tem escopo próprio e modo estrito). Conversa com as outras
// partes pelos mesmos window.* de antes até as telas virarem Svelte (passo d). Fica em JS checado pelo TypeScript
// (checkJs, src/tsconfig.js.json); vira .ts quando for dividido em componentes no passo (d).
// T43 (d): virou .ts (strict sem noImplicitAny, src/analise/tsconfig.json; como o motor). Só anotações de tipo: o JS que
// sai do TS minifica igual ao analise.js de antes.
/** Carta como a análise lê do cards-db.js (C). */
export interface Carta { name: string; m: string; v: number; t: string; o: string; ci: string; r: number; gc: boolean; pm: any; usd: any; ban: boolean; tags: string[]; p: string }
/** Resultado de analyze(): saco de campos montado aos poucos; os principais têm tipo, o resto fica aberto. */
export interface Analise {
  [k: string]: any; cmds: Carta[]; ident: Set<string>; cards: Carta[]; uniq: Carta[]; unknown: string[]; total: number; issues: any[];
  refs: Ref[]; themes: TemaDeck[]; byRole: Dic<[string, number][]>; curve: number[]; legendCandidates: string[]; cmdThemes: Set<string>;
  tribe: [string, number] | null; edh: Ideia | null; price: number; pricey: Carta[];
}
/** Faixa de uma função (terrenos, ramp, compra…): quanto o deck tem e quanto se recomenda. */
export interface Faixa { k: string; n: string; lo: number; hi: number; [k: string]: any }
export interface Ref extends Faixa { have: number; why: string }
/** Tema que aparece no deck (THEMES + as cartas e se o comandante puxa). */
export interface TemaDeck { k: string; n: string; rx: RegExp; cards: string[]; cmd: boolean; [k: string]: any }
/** Página do EDHREC já lida (edhLe). */
interface PaginaEdh { t: number; n: number; cards: Dic<{ inc: number; syn: number }>; tags: [string, number][] }
/** A ideia do deck medida no EDHREC: as páginas de tema já carregadas (edhIdeia). */
interface Ideia { pags: { k: string; cam: string; d: PaginaEdh }[]; cor: string; tribo: string | null | undefined; carrega: Promise<unknown> | null }
type Dic<T = any> = Record<string, T>;
/** Uma troca sugerida: sai `out`, entra `inn`, com o porquê de cada lado e as alternativas. */
export interface Troca { goal: string; out: string; inn: string; whyOut: string; whyIn: string; alts: string[]; altsOut: string[]; on?: boolean; [k: string]: any }
// o código sempre supôs que o elemento existe: o tipo segue a mesma suposição (HTMLElement, não null)
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => (<Dic<string>>{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

import { perfilBanco } from './banco';

// ---------- base de cartas ----------
const DB = window.CARD_DB;
const F: Dic<number> = Object.fromEntries(DB.fields.map((f: string, i: number) => [f, i]));
const TAGS: string[] = DB.tags;
const IDX: Dic<string> = {};
for (const n of Object.keys(DB.cards)) {
  IDX[norm(n)] = n;
  const front = n.split(' // ')[0]; if (!IDX[norm(front)]) IDX[norm(front)] = n;
}
for (const [fn, real] of Object.entries<string>(DB.alias || {})) { if (!IDX[norm(fn)]) IDX[norm(fn)] = real; }
function norm(s: string): string { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim(); }
function C(name: string): Carta | null {
  const e = DB.cards[name]; if (!e) return null;
  return { name, m: e[F.m], v: e[F.v], t: e[F.t], o: e[F.o], ci: e[F.ci], r: e[F.r], gc: !!e[F.gc], pm: e[F.pm], usd: e[F.usd], ban: !!e[F.ban], tags: e[F.tags].map((i: number) => TAGS[i]), p: F.p != null ? e[F.p] : '' };
}

// ---------- Claude dentro da página (opcional) ----------
let SAMPLE: any = null;
if (window.claude && window.claude.use) window.claude.use('sample').then((s: any) => { SAMPLE = s; $$('[data-claude]').forEach(b => { b.hidden = false; }); }).catch(() => {});

// ---------- leitura da lista ----------
const ANY_NUMBER = /A deck can have any number of cards named|A deck can have up to (seven|nine) cards named/;
// nomes em português: carregados de dados/nomes-pt.json quando existe ({"nome em português": "English name"})
const PTIDX: Dic<string> = {};
function addPtNames(map: Dic<string> | null) { for (const [pt, en] of Object.entries(map || {})) { const k = IDX[norm(en)] || (DB.cards[en] ? en : null); if (k && !PTIDX[norm(pt)]) PTIDX[norm(pt)] = k; } }
if (typeof fetch === 'function' && location.protocol !== 'file:') fetch('dados/nomes-pt.json').then(r => (r.ok ? r.json() : null)).then(m => { if (m) addPtNames(m); }).catch(() => {});
function lookupName(name: string): string | null {
  const tries = [name, name.split(' // ')[0], name.split(' / ')[0]];
  for (const t of tries) { const k = IDX[norm(t)] || PTIDX[norm(t)]; if (k) return k; }
  return null;
}
// seções que aparecem nas exportações (Moxfield, Archidekt, LigaMagic, MTGO, MTGA), em inglês e português
const SEC_CMD = /^(commanders?|comandantes?|cmdr)$/;
const SEC_MAIN = /^(deck|main|mainboard|lista|companion|companheiro|creatures?|criaturas?|lands?|terrenos?|artifacts?|artefatos?|enchantments?|encantamentos?|instants?|instant[aâ]neas?|m[aá]gicas instant[aâ]neas|sorcer(y|ies)|feiti[cç]os?|planeswalkers?|batalhas?|battles?|other|outros?)$/;
const SEC_OUT = /^(sideboard|maybeboard|maybe|considering|side|reserva|tokens?|fichas?)\b/;
function parseList(text: string) {
  const out = { cards: [] as string[], cmdHint: [] as string[], unknown: [] as string[] };
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
function canBeCommander(c: Carta) { return (/Legendary/.test(c.t.split(' // ')[0]) && /Creature/.test(c.t.split(' // ')[0])) || /can be your commander/.test(c.o); }
function guessCommanders(p: { cards: string[]; cmdHint: string[] }): string[] {
  if (p.cmdHint.length) return [...new Set(p.cmdHint)].slice(0, 2);
  const legends = ([...new Set(p.cards)].map(C) as Carta[]).filter(canBeCommander);
  const allCI = new Set(p.cards.map(n => C(n)!.ci).join('').split(''));
  // o comandante cobre toda a identidade de cor do deck
  const covers = legends.filter(l => [...allCI].every(c => l.ci.includes(c)));
  const first = C(p.cards[0]);
  if (first && canBeCommander(first) && covers.some(l => l.name === first.name)) return [first.name];
  if (covers.length) return [covers.sort((a, b) => (a.r || 1e6) - (b.r || 1e6))[0].name];
  return legends.length ? [legends[0].name] : [];
}

// ---------- temas ----------
const THEMES: { k: string; n: string; rx: RegExp; type?: RegExp; typeIfCmd?: RegExp }[] = [
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
function themesOf(c: Carta, cmdThemes?: Set<string> | null) {
  const out = new Set<string>();
  for (const th of THEMES) if (th.rx.test(c.o) || (th.type && th.type.test(c.t)) || (cmdThemes && th.typeIfCmd && cmdThemes.has(th.k) && th.typeIfCmd.test(c.t.split(' // ')[0]))) out.add(th.k);
  return out;
}
function subtypes(c: Carta): string[] { const right = (c.t.split(' // ')[0].split(' — ')[1] || ''); return /Creature|Kindred|Tribal/.test(c.t) ? right.split(' ').filter(Boolean) : []; }

// ---------- funções ----------
const ROLES: { k: string; n: string; tags: string[]; rx?: RegExp }[] = [
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
// T44: as funções vêm do banco próprio (src/analise/banco.ts: o que a carta faz, escrito do Oracle). Etiqueta do Scryfall e
// regex ficam de reserva: carta fora do banco, carta com frase em `falta`, e as funções de tema que o banco ainda não
// separa bem (SEMPRE_RESERVA: travar, multiplicar, combate, política, acelerar).
const SEMPRE_RESERVA = new Set(['stax', 'amplify', 'combat', 'politics', 'speed']);
let SEM_BANCO = false;   // para comparar com o de antes (ferramentas/calibra/t44_diff.py)
function rolesOf(c: Carta) {
  const s = new Set<string>(), pb = SEM_BANCO ? null : perfilBanco(c.name);
  for (const r of ROLES) if (!pb || pb.falta || SEMPRE_RESERVA.has(r.k)) { if (r.tags.some(t => c.tags.includes(t)) || (r.rx && r.rx.test(c.o))) s.add(r.k); }
  if (pb) for (const k of pb.f) s.add(k);
  if (s.has('wipe')) s.delete('removal');
  const ia = (typeof window !== 'undefined' && window.PAPEIS_IA) ? window.PAPEIS_IA[c.name] : null; if (ia) for (const k of ia.p) s.add(k);
  const front = c.t.split(' // ')[0], o = c.o.split('\n//\n')[0];
  if (!pb && /can't lose the game|win the game|opponents can't win|loses the game|Creatures can't attack you unless/.test(o)) s.add('wincon');
  if (!pb && /choose new targets? for target spell|change the target of target spell|Counter target (spell|activated|triggered)/i.test(o)) s.add(/Counter target/.test(o) ? 'counter' : 'protect');
  const pw = parseInt(String(c.p || '').split(' // ')[0]);
  if (/Planeswalker/.test(front) || (/Creature/.test(front) && ((pw >= 5) || (pw >= 3 && /Flying|Trample|Menace|Double strike|Infect|Indestructible/i.test(o)) || /power is equal to the number|\*/.test(String(c.p || ''))))) s.add('threat');
  return s;
}
const fmtD = (x: number | string, d = 1) => (+x).toFixed(d).replace('.', ',');
const isLand = (c: Carta) => /Land/.test(c.t.split(' // ')[0]);
const transforma = (c: Carta) => /\(Transforms from|transform (it|this|~)|, transform\b|then transform/i.test(c.o || '');
const isMdfcLand = (c: Carta) => !isLand(c) && /Land/.test(c.t.split(' // ')[1] || '') && !transforma(c);

// ---------- análise ----------
function analyze(text: string, forcedCmd?: string[] | null): Analise {
  const p = parseList(text);
  if (!p.cards.length) return { empty: true, unknown: p.unknown } as unknown as Analise;   // a tela olha A.empty antes de tudo
  const cmds = forcedCmd && forcedCmd.length ? forcedCmd : guessCommanders(p);
  const deck = p.cards.slice();
  // o comandante pode ou não estar na lista: tiramos uma cópia
  for (const c of cmds) { const i = deck.indexOf(c); if (i >= 0) deck.splice(i, 1); }
  const cmdCards = cmds.map(C) as Carta[];
  const ident = new Set(cmdCards.map(c => c.ci).join('').split('').filter(Boolean));
  const cards = deck.map(C) as Carta[];
  const uniq = [...new Set(deck)].map(C) as Carta[];
  const A = { cmds: cmdCards, ident, cards, uniq, unknown: p.unknown, total: deck.length + cmds.length, issues: [] as any[] } as Analise;   // o resto entra logo abaixo

  // regras
  const counts: Dic<number> = {}; deck.forEach(n => (counts[n] = (counts[n] || 0) + 1));
  A.dupes = Object.entries(counts).filter(([n, q]) => q > 1 && !/Basic Land/.test(C(n)!.t) && !ANY_NUMBER.test(C(n)!.o)).map(([n, q]) => [n, q]);
  A.offColor = uniq.filter(c => c.ci.split('').some(x => x && !ident.has(x)));
  A.banned = uniq.concat(cmdCards).filter(c => c.ban);
  A.legendCandidates = ([...new Set(p.cards)].map(C) as Carta[]).filter(canBeCommander).map(c => c.name);

  // funções e curva
  const nonland = cards.filter(c => !isLand(c));
  A.lands = cards.filter(isLand).length; A.mdfc = cards.filter(isMdfcLand).length;
  A.avgMV = nonland.length ? nonland.reduce((s, c) => s + c.v, 0) / nonland.length : 0;
  A.curve = Array(8).fill(0); nonland.forEach(c => A.curve[Math.min(7, Math.floor(c.v))]++);
  A.byRole = Object.fromEntries(ROLES.map(r => [r.k, []]));
  for (const c of cards) for (const r of rolesOf(c)) (A.byRole as Dic<any[]>)[r].push(c.name);   // nomes primeiro; viram [nome, qtd] na linha de baixo
  for (const r of ROLES) A.byRole[r.k] = [...new Set<string>(A.byRole[r.k] as any[])].map(n => [n, counts[n] || 1]);
  const cnt = (k: string) => A.byRole[k].reduce((s, [, q]) => s + q, 0);
  A.cheapRamp = cards.filter(c => !isLand(c) && c.v <= 2 && rolesOf(c).has('ramp')).length;
  A.terrF = terrenosFormula(cards, cmdCards);
  A.recLands = Math.max(30, Math.min(42, Math.round(A.terrF.ajust)));
  A.recEdh = Math.max(30, Math.min(42, Math.round(A.terrF.edh)));
  A.recPura = Math.max(30, Math.min(42, Math.round(A.terrF.pura)));
  const blue = ident.has('U');
  A.refs = [
    { k: 'lands', n: 'Terrenos', have: A.lands + A.mdfc * 0.5, lo: A.recLands - 1, hi: A.recLands + 2, why: `Pela fórmula do Frank Karsten (custo médio ${A.avgMV.toFixed(2).replace('.', ',')}, ${A.terrF.barato} cartas de compra ou ramp de custo até 2): ${fmtD(A.terrF.pura)} pura, ${fmtD(A.terrF.ajust)} com os ajustes. Para comparar, os decks médios do EDHREC com esse custo médio jogam ${fmtD(A.terrF.edh)} (${String(TERR_EDH.a).replace('.', ',')} + ${String(TERR_EDH.b).replace('.', ',')} × custo médio). A conta está em Mana e curva. Terreno de menos trava a mão; demais faz faltar ação no fim do jogo.` },
    { k: 'ramp', n: 'Ramp', have: cnt('ramp'), lo: 10, hi: 15, why: 'Mana extra cedo põe você um turno à frente da mesa. Ramp de 2 manas vale mais que o de 4.' },
    { k: 'draw', n: 'Compra de cartas', have: cnt('draw'), lo: 10, hi: 16, why: 'Em mesa de 4 jogadores, quem fica sem cartas na mão perde. Prefira fontes que compram mais de uma vez.' },
    { k: 'removal', n: 'Remoção pontual', have: cnt('removal'), lo: 8, hi: 12, why: 'Responde ao comandante dos outros e às peças que viram o jogo. Instantâneas e baratas valem mais.' },
    { k: 'wipe', n: 'Limpa-mesa', have: cnt('wipe'), lo: 2, hi: 4, why: 'Salva você quando alguém dispara na frente. Deck de criaturas usa menos; deck de controle usa mais.' },
    { k: 'protect', n: 'Proteção', have: cnt('protect'), lo: 3, hi: 8, why: 'Segura o plano quando a mesa tenta remover sua peça principal. Importa mais quanto mais o deck depende de uma criatura.' },
  ];
  A.plano = null; // precisa de cmdThemes: preenchido mais abaixo
  if (blue) A.refs.push({ k: 'counter', n: 'Contramágica', have: cnt('counter'), lo: 2, hi: 8, why: 'Com azul, guardar mana para anular a jogada que ganharia o jogo é a melhor interação.' });

  // cores
  const pips: Dic<number> = {}; for (const x of ident) pips[x] = 0;
  for (const c of nonland) (c.m.split(' // ')[0].match(/\{[^}]+\}/g) || []).forEach(s => { const parts = s.slice(1, -1).split('/'); const cols = parts.filter(x => /[WUBRG]/.test(x)); cols.forEach(x => { if (x in pips) pips[x] += 1 / cols.length; }); });
  const sources: Dic = {}; for (const x of ident) sources[x] = 0;
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
  const cmdThemes = new Set<string>(); cmdCards.forEach(c => themesOf(c).forEach(t => cmdThemes.add(t)));
  A.cmdThemes = cmdThemes;
  const themeCount: Dic<string[]> = Object.fromEntries(THEMES.map(t => [t.k, []]));
  for (const c of uniq) if (!isLand(c)) for (const t of themesOf(c, cmdThemes)) themeCount[t].push(c.name);
  // tribo
  const tribe: Dic = {}; cards.filter(c => /Creature/.test(c.t)).forEach(c => subtypes(c).forEach(s => (tribe[s] = (tribe[s] || 0) + 1)));
  const topTribe = Object.entries(tribe).sort((a, b) => b[1] - a[1])[0];
  A.tribe = topTribe && topTribe[1] >= 10 ? topTribe : null;
  // @ts-ignore T43 (c): ordena por booleano (true - false), de propósito
  A.themes = THEMES.map(t => ({ ...t, cards: themeCount[t.k], cmd: cmdThemes.has(t.k) })).filter(t => t.cards.length >= 6 || t.cmd).sort((a, b) => (b.cmd - a.cmd) || b.cards.length - a.cards.length);
  // plano do comandante: deck de voltron troca parte da remoção por proteção (guias pedem 8–12 proteções)
  A.plano = planoDe(A);
  if (A.plano.voltron) {
    const rp = A.refs.find(r => r.k === 'protect'); if (rp) Object.assign(rp, { lo: 7, hi: 14, why: `${A.plano.nome} carrega o deck: uma remoção nele leva junto as auras e equipamentos. Deck de voltron costuma ter 8–12 proteções.` });
    const rr = A.refs.find(r => r.k === 'removal'); if (rr) Object.assign(rr, { lo: 5, hi: 10, why: 'Deck que vence atacando com o comandante usa um pouco menos de remoção e mais proteção; prefira as baratas e instantâneas.' });
  }
  // teste (19/11/2026): faixas das funções pelas metas do Montar (decks médios do EDHREC) em vez das fixas
  let refsMeta = false; try { refsMeta = localStorage.getItem('raiox:refsMeta') === '1'; } catch (e) {}
  if (refsMeta && window.RAIOX_METAS) {
    const on = new Set(A.themes.filter(t => t.cmd).map(t => t.k)); if (A.tribe) on.add('tribe');
    const M = window.RAIOX_METAS(on, ident, { alvo: { br: '', teto: '', tetoCarta: '' } }, A.tribe ? A.tribe![0] : null);
    for (const r of A.refs) if (M[r.k] && M[r.k].alvo != null) { const larg = r.hi - r.lo; r.lo = M[r.k].alvo; r.hi = M[r.k].alvo + larg; r.why += ` (meta pelos ${M[r.k].conta})`; }
  }
  // dependência do comandante
  const supportsCmd = (c: Carta) => [...themesOf(c, cmdThemes)].some(t => cmdThemes.has(t)) || (A.tribe && cmdCards.some(k => subtypes(k).includes(A.tribe![0])) && subtypes(c).includes(A.tribe![0]));
  const singleTarget = (c: Carta) => /Aura/.test(c.t) && /Enchant creature/.test(c.o) || /Equipment/.test(c.t);
  A.cmdSupport = uniq.filter(c => !isLand(c) && supportsCmd(c)).map(c => c.name);
  A.voltronCards = uniq.filter(singleTarget).map(c => c.name);
  A.standalone = uniq.filter(c => !isLand(c) && !supportsCmd(c) && (rolesOf(c).size || themesOf(c, cmdThemes).size)).map(c => c.name);
  A.bodyOnly = uniq.filter(c => !isLand(c) && [...rolesOf(c)].every(k => k === 'body') && rolesOf(c).size && !themesOf(c, cmdThemes).size).map(c => c.name);
  A.noRole = uniq.filter(c => !isLand(c) && !rolesOf(c).size && !themesOf(c, cmdThemes).size && !(A.tribe && subtypes(c).includes(A.tribe![0]))).map(c => c.name);

  // nível de poder
  A.gc = uniq.filter(c => c.gc).map(c => c.name).concat(cmdCards.filter(c => c.gc).map(c => c.name));
  A.tutorCards = uniq.filter(isTutor); A.tutors = A.tutorCards.length;
  A.extraTurns = uniq.filter(c => c.tags.includes('extra-turn')).map(c => c.name);
  A.mld = uniq.filter(c => c.tags.includes('mass-land-denial')).map(c => c.name);
  let br = 2, why: string[] = [];
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
  if (A.dupes.length) I.push({ sev: 3, area: 'Regras', t: `Cartas repetidas (só pode 1 de cada, fora terrenos básicos): ${A.dupes.map(([n, q]: [string, number]) => `${n} ×${q}`).join(', ')}.` });
  if (A.offColor.length) I.push({ sev: 3, area: 'Regras', t: `Fora da identidade de cor do comandante: ${A.offColor.map((c: Carta) => c.name).join(', ')}.` });
  if (A.banned.length) I.push({ sev: 3, area: 'Regras', t: `Banida no Commander: ${A.banned.map((c: Carta) => c.name).join(', ')}.` });
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
const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));
// tutor para o bracket: procura carta no grimório que não seja só terreno (Rampant Growth não conta)
const isTutor = (c: Carta) => c.tags.includes('tutor') && /search(?:es)? your library for/i.test((c.o || '').split('\n//\n')[0]) && !/land|forest|plains|island|swamp|mountain/i.test(((c.o || '').match(/search(?:es)? (?:your|their) library for [^.]*/i) || [''])[0]);
// ---------- preços em reais ----------
// Fonte principal: menor anúncio no MYP Cards, em reais (precos-myp.js, API pública; ferramentas/precos/coleta_myp.py).
// Carta sem anúncio lá: preço do Scryfall em dólar convertido pela cotação do dia (AwesomeAPI), guardada por 12 h.
// Por dentro tudo continua em "dólar" (campo usd): a carta do MYP vira reais ÷ cotação (aplicaMyp), e brlTxt multiplica de volta.
// Condição da API do MYP: mostrar a fonte com link onde o preço aparece (fonteMyp / fontePrecos).
const MYP = (window.PRECOS_MYP && window.PRECOS_MYP.p) || {};
const MYP_DATA = window.PRECOS_MYP && window.PRECOS_MYP.data ? window.PRECOS_MYP.data.split('-').reverse().join('/') : '';
const temMyp = (n: string) => MYP[n] != null;
const fonteMyp = (txt = 'MYP Cards') => `<a class="fonte" href="https://mypcards.com" target="_blank" rel="noopener">${txt}</a>`;
// frase de fonte para um conjunto de cartas (nomes): quantas têm preço do MYP e o que vale para as outras
function fontePrecos(nomes: string[]) {
  const ns = [...new Set<string>(nomes)].filter(n => { const c = C(n); return c && !/Basic/.test(c.t || ''); });
  const fora = ns.filter(n => !temMyp(n)).length;
  return `Preços: menor anúncio no ${fonteMyp()}${MYP_DATA ? ` (${MYP_DATA})` : ''}` + (fora ? `; ${fora === ns.length ? 'todas' : fora} sem anúncio lá: Scryfall convertido, <span data-cotacao>${USD_BRL_INFO}</span>` : '');
}
let USD_BRL = 5.56, USD_BRL_INFO = 'cotação de 11/11/2026';
const aplicaMyp = () => { for (const n in MYP) { const e = DB.cards[n]; if (e) e[F.usd] = MYP[n] / USD_BRL; } };
const brlTxt = (usd: number, cents?: boolean | number) => 'R$ ' + ((usd || 0) * USD_BRL).toLocaleString('pt-BR', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const brl = (usd: number, cents?: boolean | number) => `<span data-usd="${usd || 0}"${cents ? ' data-cents="1"' : ''}>${brlTxt(usd, cents)}</span>`;
const toUsd = (reais: number) => (reais > 0 ? reais / USD_BRL : Infinity);
// A análise espera a cotação (COTA_OK): o preço do MYP vira dólar pela cotação na hora da soma (A.price), e uma
// cotação que chega depois corrige as cartas, mas não a soma já feita, e o pinta() multiplicava essa soma antiga pela
// nova (a 1ª análise saía ~6% acima quando não havia cotação guardada). Agora a soma espera até 2,5 s; se a cotação
// chega depois disso, a análise é refeita na mesma tela.
let COTA_OK = false;
let COTA_ESPERA: Promise<void> = Promise.resolve();
(function cotacao() {
  const pinta = () => { document.querySelectorAll('[data-usd]').forEach((el: any) => { el.textContent = brlTxt(+el.dataset.usd, !!el.dataset.cents); }); document.querySelectorAll('[data-cotacao]').forEach(el => { el.textContent = USD_BRL_INFO; }); };
  try { const c = JSON.parse(localStorage.getItem('raiox:usdbrl') || 'null'); if (c && Date.now() - c.t < 12 * 3600e3) { USD_BRL = c.v; USD_BRL_INFO = c.info; COTA_OK = true; } } catch (e) {}
  aplicaMyp();
  if (COTA_OK) return; // cotação guardada há menos de 12 h: fica ela (a página toda soma com a mesma)
  if (typeof fetch !== 'function') { COTA_OK = true; return; }
  const busca = fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL').then(r => r.json()).then(j => {
    const v = +(j.USDBRL && j.USDBRL.bid); if (!(v > 3 && v < 12)) return;
    const d = new Date((+j.USDBRL.timestamp || Date.now() / 1000) * 1000);
    USD_BRL = v; USD_BRL_INFO = `dólar a R$ ${v.toFixed(2).replace('.', ',')} em ${d.toLocaleDateString('pt-BR')}`;
    try { localStorage.setItem('raiox:usdbrl', JSON.stringify({ v, info: USD_BRL_INFO, t: Date.now() })); } catch (e) {}
    aplicaMyp(); // a carta do MYP continua com o mesmo preço em reais
    if (COTA_OK && LAST && !LAST.empty) run(LAST.cmds.map((c: Carta) => c.name), location.hash.slice(1) || 'resumo'); // chegou tarde: refaz a soma
    pinta();
  }).catch(() => {});
  COTA_ESPERA = Promise.race([busca, new Promise(r => setTimeout(r, 2500))]).then(() => { COTA_OK = true; });
})();
const COLORNAME: Dic<string> = { W: 'Branco', U: 'Azul', B: 'Preto', R: 'Vermelho', G: 'Verde' };
const COLORADJ: Dic<string> = { W: 'brancos', U: 'azuis', B: 'pretos', R: 'vermelhos', G: 'verdes' };

// sugestões: opções para estudar (nunca adiciona sozinho)
function suggestions(A: Analise, roleK: string, n = 8) {
  const role = ROLES.find(r => r.k === roleK); if (!role) return [];
  const inDeck = new Set(A.uniq.map((c: Carta) => c.name).concat(A.cmds.map((c: Carta) => c.name)));
  const out: any[] = [];
  for (const name of Object.keys(DB.cards)) {
    if (inDeck.has(name)) continue;
    const c = C(name)!;   // o nome veio do próprio DB.cards
    if (c.ban || !c.r) continue;
    if (!c.ci.split('').every(x => !x || A.ident.has(x))) continue;
    if (!role.tags.some(t => c.tags.includes(t))) continue;
    if (roleK === 'removal' && c.tags.includes('board-wipe')) continue;
    out.push(c);
  }
  return out.sort((a, b) => ((efetiv(A, b).v[roleK] || 0) - (efetiv(A, a).v[roleK] || 0)) || a.r - b.r).slice(0, n); // pela efetividade na função; popularidade só desempata
}

// ---------- desenho ----------
function manaHTML(m: string) { return (m || '').split(' // ')[0].replace(/\{([^}]+)\}/g, (_: string, s: string) => { const c = s.includes('/') ? s.split('/')[0] : s; return `<span class="ms ${/^[WUBRG]$/.test(c) ? c : ''}">${/^[WUBRG]$/.test(c) ? '' : esc(s)}</span>`; }); }
const cardLink = (n: string) => `<button class="cn" data-card="${esc(n)}">${esc(n)}</button>`;
const listLinks = (arr: string[], max = 40) => arr.slice(0, max).map(cardLink).join('') + (arr.length > max ? `<span class="note"> e mais ${arr.length - max}</span>` : '');

let LAST: Analise | null = null;
// T43 (d): o objeto ganha nome só para o tipo (RaioX) que o montar.ts importa; o window.RAIOX é o mesmo de antes
const API = { esc, fmt, suggestions: (A: Analise, k: string, n?: number) => suggestions(A, k, n), terrenosHTML: (A: Analise) => terrenosHTML(A), THEMES, themesOf, valorPlano: (A: Analise, c: Carta) => valorPlano(A, c), edhPagina: (c: string) => edhPagina(c), edhJa: (c: string) => edhJa(c), edhCmdCam: (n: string[]) => edhCmdCam(n), edhIdeia: (t: Iterable<string>, i: Set<string>, tb?: string | null) => edhIdeia(t, i, tb), edhCarta: (I: Ideia | null, c: Carta) => edhCarta(I, c), edhNota: (I: Ideia | null, c: Carta) => edhNota(I, c), edhPorque: (I: Ideia | null, c: Carta) => edhPorque(I, c), planoDe: (A: Analise) => planoDe(A), tipoRamp: (c: Carta) => tipoRamp(c), custoRamp: (c: Carta) => custoRamp(c), terrenosFormula: (cs: Carta[], cm: Carta[]) => terrenosFormula(cs, cm), isMdfcLand, get RAMP_N() { return RAMP_N; }, efeitos: (c: Carta) => efeitos(c), subtypes, CONCEITOS: null as typeof CONCEITOS | null, COLORNAME, parseList, guessCommanders, C, rolesOf, isLand, lookupName: (n: string) => lookupName(n), analyze, ROLES, canBeCommander, norm, brl, brlTxt, fonteMyp, fontePrecos, temMyp, manaHTML, cardLink, isTutor, semPreco: (c: Carta) => semPreco(c), ANY_NUMBER, DB, PTIDX, run: (cmds?: string[] | null, goTo?: string) => run(cmds, goTo), get usd() { return USD_BRL; }, swaps: () => SWAPS.map((s, i) => ({ out: s.out, inn: s.inn, on: !!SWAP_ON[i] })), swapsFull: () => SWAPS, efetiv: (A: Analise, c: Carta) => efetiv(A, c), sinergia: (A: Analise, c: Carta) => sinergia(A, c), temaSin: (A: Analise) => temaSin(A), sinTema: (c: Carta, T: Dic<number>) => sinTema(c, T), sinTexto: (A: Analise, c: Carta) => sinTexto(A, c), buildSwaps: (A: Analise) => buildSwaps(A), get TETO_EF() { return TETO_EF; }, get PORTA_EF() { return PORTA_EF; }, perfilDeck: (A: Analise) => perfilDeck(A), efPlano: (A: Analise, c: Carta) => efPlano(A, c), imgFor: (n: string, v?: string) => imgFor(n, v), SCRY: (n: string, v?: string) => SCRY(n, v), roleNames: (c: Carta) => roleNames(c), imgsDe: (l: string[]) => imgsDe(l), get imgCache() { return IMGC; }, get last() { return LAST; },
  /** o botão "Pedir a leitura do Claude" só aparece com o window.claude (sample) ligado */
  get temClaude() { return !!SAMPLE; }, perguntaClaude: (A: Analise, onText: (t: string) => void) => askClaude(A, onText) };
// tela Trocas (src/telas/Trocas.svelte): o estado das trocas (SWAPS, SWAP_ON) e a ideia (CONC) continuam aqui,
// porque o buildSwaps, o newList e a Mesa (RAIOX.swaps) leem deles; a tela pede e muda por estas funções.
const TROCAS = {
  get CONC() { return CONC; }, get CONCEITOS() { return CONCEITOS; }, get MODOS() { return MODOS; },
  concOn: (A: Analise) => concOn(A), concDetected: (A: Analise) => concDetected(A), salva: (A: Analise) => saveConcept(A),
  resolveNames: (t: string) => resolveNames(t),
  /** refaz as trocas (todas marcadas), como o renderSwaps fazia a cada desenho */
  novas: (A: Analise) => { SWAPS = buildSwaps(A); SWAP_ON = SWAPS.map(() => true); return SWAPS; },
  marca: (i: number, v: boolean) => { SWAP_ON[i] = v; },
  marcada: (i: number) => !!SWAP_ON[i],
  algumaMarcada: () => SWAP_ON.some(Boolean),
  nMarcadas: () => SWAP_ON.filter(Boolean).length,
  /** outra carta para entrar (lado 'in') ou para sair ('out') na troca i; false se ela já está em outra troca */
  alt: (A: Analise, i: number, lado: 'in' | 'out', n: string) => {
    const s = SWAPS[i];
    if (lado === 'in') { if (SWAPS.some((x, j) => j !== i && x.inn === n)) return false; s.alts = s.alts.map(x => (x === n ? s.inn : x)); s.inn = n; }
    else { if (SWAPS.some((x, j) => j !== i && x.out === n)) return false; s.altsOut = s.altsOut.map(x => (x === n ? s.out : x)); s.out = n; s.whyOut = whyCut(A, C(n)!); }
    return true;
  },
  listaNova: (A: Analise) => newList(A), imgs: (root: ParentNode) => swapImgs(root),
  soma: (A: Analise) => swapSum(A), graf: (A: Analise) => swapGraf(A), nums: (A: Analise, s: Troca) => swapNums(A, s),
  planoBox: (A: Analise) => planoBox(A), box: (n: string, tag: string) => swapBox(n, tag), compara: (A: Analise, s: Troca) => compareText(A, s),
  planoTroca: (A: Analise, s: Troca) => planoTroca(A, s), edhTroca: (A: Analise, s: Troca) => edhTroca(A, s),
};
(API as any).trocas = TROCAS;
/** T44: liga/desliga o banco na leitura das funções (para medir a diferença); limpa os caches */
(API as any).semBanco = (v: boolean) => { SEM_BANCO = v; for (const k in TIPO_RAMP) delete TIPO_RAMP[k]; for (const k in EF) delete EF[k]; };
window.RAIOX = API;
export type RaioX = typeof API & { trocas: typeof TROCAS };
function run(forcedCmd?: string[] | null, goTo?: string) {
  if (!COTA_OK) { const m = $('#go-msg'); if (m) m.textContent = 'Buscando a cotação do dólar…'; COTA_ESPERA.then(() => run(forcedCmd, goTo)); return; }
  const text = $<HTMLInputElement>('#deck-in').value;
  const A = analyze(text, forcedCmd);
  const out = $('#out');
  if (A.empty) { $('#go-msg').textContent = 'Não reconheci nenhuma carta.' + (A.unknown.length ? ' Exemplos do que não achei: ' + A.unknown.slice(0, 5).join(', ') : ''); return; }
  LAST = A;
  $('#go-msg').textContent = '';
  loadConcept(A);
  telas(out, A);
  document.dispatchEvent(new CustomEvent('raiox:deck', { detail: A }));
  // EDHREC ainda não veio para este comandante: busca e refaz a análise uma vez (fica guardado 7 dias)
  // página do comandante no EDHREC (só informação): busca uma vez e redesenha as trocas
  if (EDH_LIGADO && A.cmds.length && !edhJa(edhCmdCam(A.cmds.map(c => c.name)))) edhPagina(edhCmdCam(A.cmds.map(c => c.name))).then(e => { if (e && !e.erro && LAST === A) rerenderTrocas(A); });
  const dest = goTo || 'resumo';
  if (location.hash === '#' + dest) show(dest); else location.hash = dest;
}

// T43 (d): o #out inteiro é o componente src/telas/Saida.svelte (Resumo, Trocas e Análise), que o main.ts registra
// em window.RAIOX_TELAS.saida. Sem o gancho (no node, pelo mede.js) a tela só não aparece.
function telas(out: HTMLElement, A: Analise) {
  const f = window.RAIOX_TELAS && window.RAIOX_TELAS.saida;
  if (f) f(out, A); else out.innerHTML = '';
}

/** leitura do Claude (botão do Resumo): devolve o texto aos pedaços por onText; o erro vira texto também */
async function askClaude(A: Analise, onText: (t: string) => void) {
  onText('Lendo o deck…');
  const resumo = [
    `Comandante: ${A.cmds.map((c: Carta) => c.name).join(' + ')} (cores ${[...A.ident].join('') || 'incolor'}). ${A.total} cartas, custo médio ${A.avgMV.toFixed(2)}, ${A.lands} terrenos.`,
    'Funções: ' + A.refs.map(r => `${r.n} ${fmt(r.have)} (faixa ${r.lo}-${r.hi})`).join('; '),
    'Temas: ' + A.themes.slice(0, 4).map(t => `${t.n} ${t.cards.length}${t.cmd ? ' (do comandante)' : ''}`).join('; '),
    `Dependência do comandante: ${A.cmdSupport.length} cartas no tema dele. Auras/equipamentos: ${A.voltronCards.length}. Bracket estimado ${A.bracket}.`,
    'Problemas apontados: ' + A.issues.map(i => i.t).join(' | '),
    'Lista: ' + A.uniq.map((c: Carta) => c.name).join('; '),
  ].join('\n');
  try {
    await SAMPLE(`Você é um professor de Commander (Magic: The Gathering) ajudando um jogador brasileiro a APRENDER a montar decks. Ele não quer que você monte o deck por ele: quer entender o raciocínio.\n\nAnálise automática do deck dele:\n${resumo}\n\nEscreva em português do Brasil, em até 3 parágrafos curtos: 1) como esse deck ganha e se o plano está claro; 2) o ponto mais fraco e o raciocínio para corrigir, citando tipos de carta e não uma lista pronta; 3) um hábito de construção que ele deve treinar. Pode discordar da análise automática se a lista mostrar outra coisa. Não invente cartas que não estão na lista.`, { onText: ({ text }: { text: string }) => onText(text) });
  } catch (e: any) { onText(e && e.code === 'rate_limited' ? 'Muitas perguntas seguidas. Espere um pouco.' : 'Não deu para perguntar agora.'); }
}

// ---------- trocas: quem sai e quem entra ----------
const TAPPED_RX = (c: Carta) => /enters tapped\./.test(c.o) && !/unless|you may pay|If you don't/.test(c.o);
function deckCounts(A: Analise) { const k: Dic = {}; A.cards.forEach((c: Carta) => (k[c.name] = (k[c.name] || 0) + 1)); return k; }
function roleCount(A: Analise, k: string) { return (A.byRole[k] || []).reduce((s, [, q]) => s + q, 0); }
// ---------- conceito do deck: a ideia que as trocas seguem ----------
const CONCEITOS: { k: string; n: string; rx: RegExp; [k: string]: any }[] = [
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
/** A ideia do deck que a pessoa escreveu (Trocas): texto, ligados/desligados à mão, modo, travas, teste, bracket e tetos. */
interface Conceito { text: string; man: Dic<boolean>; mode: string; lock: string; test: string; br: string; teto: string; tetoCarta: string }
let CONC: Conceito = { text: '', man: {}, mode: 'seguir', lock: '', test: '', br: '', teto: '', tetoCarta: '' };
const concKey = (A: Analise) => 'raiox:conceito:' + A.cmds.map((c: Carta) => c.name).join('+');
function loadConcept(A: Analise) { CONC = { text: '', man: {}, mode: 'seguir', lock: '', test: '', br: '', teto: '', tetoCarta: '' }; try { const s = localStorage.getItem(concKey(A)); if (s) CONC = Object.assign(CONC, JSON.parse(s)); } catch (e) {} }
function saveConcept(A: Analise) { try { localStorage.setItem(concKey(A), JSON.stringify(CONC)); } catch (e) {} }
function concDetected(A: Analise) { const t = CONC.text || ''; const on = new Set(CONCEITOS.filter(x => x.rx.test(t)).map(x => x.k)); if (A.tribe && new RegExp('\\b' + A.tribe![0].toLowerCase().slice(0, 5), 'i').test(t)) on.add('tribe'); return on; }
function concOn(A: Analise) { const on = concDetected(A); for (const [k, v] of Object.entries(CONC.man || {})) v ? on.add(k) : on.delete(k); if (!A.tribe) on.delete('tribe'); return on; }
function fitsK(A: Analise, c: Carta, k: string) {
  if (k === 'tribe') return !!(A.tribe && subtypes(c).includes(A.tribe![0]));
  if (k === 'flying') return /Flying/.test(c.o);
  return themesOf(c, new Set([k])).has(k);
}
// null = sem ideia (não pesa); true/false = encaixa ou não
function conceptFit(A: Analise, c: Carta) { if (CONC.mode === 'livre' || isLand(c)) return null; const on = A._concOn || concOn(A); if (!on.size) return null; return [...on].some(k => fitsK(A, c, k)); }
const namesFrom = (txt: string) => String(txt || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
function resolveNames(txt: string) { const ok: any[] = [], bad: string[] = []; for (const n of namesFrom(txt)) { const k = lookupName(n.replace(/^\d+\s*x?\s+/i, '')); k ? ok.push(k) : bad.push(n); } return { ok, bad }; }

// painel "Quantos terrenos": a fórmula do Karsten pura e a ajustada lado a lado, com a conta
function terrenosHTML(A: Analise) {
  const F = A.terrF; if (!F) return '';
  const lst = (a: string[]) => a.length ? a.slice(0, 14).map(n => esc(n)).join(', ') + (a.length > 14 ? ` e mais ${a.length - 14}` : '') : 'nenhuma';
  const veredito = (tem: number, rec: number) => { const d = tem - rec; return Math.abs(d) < 1 ? ['na conta', 'good'] : d < 0 ? [`${fmtD(-d)} a menos`, d <= -2 ? 'bad' : 'warn'] : [`${fmtD(d)} a mais`, d >= 3 ? 'warn' : 'info']; };
  const col = (tit: string, rec: number, tem: number, linhas: (string | number)[][], nota: string) => { const [v, k] = veredito(tem, Math.round(rec)); return `<div class="tf-col"><h3>${tit}</h3>
    <div class="tiles"><div class="tile info"><b>${fmtD(rec)}</b><span>terrenos pela conta (≈ ${Math.round(rec)})</span></div><div class="tile ${k}"><b>${tem % 1 ? fmtD(tem) : tem}</b><span>no deck: ${v}</span></div></div>
    <table class="tf-conta"><tbody>${linhas.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join('')}</tbody></table><p class="note">${nota}</p></div>`; };
  const base = [['base', '31,42'], [`+ 3,13 × ${fmtD(F.media, 2)} (custo médio)`, '+' + fmtD(3.13 * F.media, 2)], [`− 0,28 × ${F.barato} (compra/ramp ≤ 2)`, '−' + fmtD(0.28 * F.barato, 2)]];
  const pura = col('Fórmula pura', F.pura, F.temPura, base.concat([['= terrenos', fmtD(F.pura, 2)]]), `No deck: ${F.lands} terrenos${F.mdfc ? ` + ${F.mdfc} de duas faces contadas inteiras` : ''}.`);
  const ajs = F.ajustes.length ? F.ajustes.map((a: { t: string; v: number }) => [a.t.replace(/: \+1.*/, ''), (a.v > 0 ? '+' : '−') + fmtD(Math.abs(a.v), 0)]) : [['nenhum ajuste se aplica', '+0']];
  const ajust = col('Com os ajustes', F.ajust, F.temAjust, base.concat(ajs, [['= terrenos', fmtD(F.ajust, 2)]]), `No deck: ${F.lands} terrenos${F.mdfc ? ` + ${F.mdfc} de duas faces valendo meio terreno cada` : ''}. Ajustes: +1 se o comandante custa 6 ou mais (a fórmula só olha as 99); carta de duas faces com terreno no verso vale meio terreno.`);
  return `<section class="panel"><h2>Quantos terrenos</h2>
    <p class="lead">Fórmula do Frank Karsten (ChannelFireball): terrenos = 31,42 + 3,13 × custo médio das cartas que não são terreno − 0,28 × cartas de compra ou ramp que custam até 2. As duas versões ficam lado a lado; a Mesa simulada joga as duas para comparar.</p>
    <p class="note">Conta: ${F.n} cartas que não são terreno somam ${fmtD(F.soma, 0)} manas, custo médio ${fmtD(F.media, 2)}. Ramp até 2 (${F.ramp2.length}): ${lst(F.ramp2)}. Compra até 2 (${F.compra2.length}): ${lst(F.compra2)}. Ramp que só vale uma vez ou depende de algo (rituais, Ragavan) e o que troca um terreno da mão (Mox Diamond) não entram; Everflowing Chalice conta pelo custo de um marcador (2).</p>
    <div class="grid2">${pura}${ajust}</div>
    <p class="note"><b>Para comparar com a prática:</b> os decks médios do EDHREC (382 decks, os comandantes mais jogados de cada tema, tribo, bracket e orçamento) com custo médio ${fmtD(F.media, 2)} jogam ${fmtD(F.edh)} terrenos (${String(TERR_EDH.a).replace('.', ',')} + ${String(TERR_EDH.b).replace('.', ',')} × custo médio; erro médio de 1,2 terreno). É só referência: a Mesa simulada joga essa quantidade ao lado das fórmulas para medir qual rende mais.</p>
    <p class="note">O Raio-X usa a ajustada nas faixas e no Montar até você escolher.</p></section>`;
}
// a tela Trocas (Trocas.svelte) escuta e se refaz: a ideia mudou, travou uma carta ou o EDHREC chegou
function rerenderTrocas(A: Analise) { document.dispatchEvent(new CustomEvent('raiox:trocas', { detail: A })); }


// ---------- plano do comandante: o que cada carta faz por ele, lendo o texto (19/11/2026) ----------
// Princípio: a carta vale pelo que adianta o plano (comandante cedo, atacando, forte e protegido), não por ser do tema.
const KWV = [['double strike', 2.5, 'golpe duplo'], ["can't be blocked except", 1.5, 'quase imbloqueável'], ["can't be blocked by more than one", 0.8, 'só um bloqueia'], ["can't be blocked", 2, 'imbloqueável'], ['flying', 1.5, 'voar'], ['trample', 1.2, 'atropelar'], ['menace', 1.2, 'ameaçar'], ['first strike', 0.6, 'iniciativa'], ['hexproof', 2, 'resistência a magia'], ["can't be the target of spells or abilities your opponents", 2, 'resistência a magia'], ['shroud', 1.6, 'manto'], ['indestructible', 1.6, 'indestrutível'], ['ward', 1, 'proteção (ward)'], ['protection from', 1.4, 'proteção contra cor'], ['lifelink', 0.5, 'vínculo com a vida'], ['vigilance', 0.3, 'vigilância']];
const EFX: Dic = {};
const custoN = (m: string) => (m.match(/\{[^}]+\}/g) || []).reduce((s, x) => s + (/^\{\d+\}$/.test(x) ? +x.slice(1, -1) : /X/.test(x) ? 0 : 1), 0);
function efeitos(c: Carta) {
  if (EFX[c.name]) return EFX[c.name];
  const o = c.o.split('\n//\n')[0], t = c.t.split(' // ')[0];
  const aura = /Aura/.test(t) && /Enchant (creature|permanent|modified creature|creature you control)/.test(o), equip = /Equipment/.test(t);
  const eqM = o.match(/\bEquip(?: [^{\n]*)? ((?:\{[^}]+\})+)/); const eq = eqM ? custoN(eqM[1]) : 0;
  const ln = o.split('\n').filter(l => /(Enchanted|Equipped) (creature|permanent)|attached to it|enchanted creature/i.test(l)).join('\n');
  const e: Dic = { aura, equip, anexo: aura || equip, eq, boost: 0, kv: 0, diz: [] as any[], haste: false, draw: false, volta: false, engine: false, reduz: false };
  const b = ln.match(/gets \+(\d+|X)\/\+(\d+|X)/); if (b) { const n = b[1] === 'X' ? 2 : +b[1], m = b[2] === 'X' ? 2 : +b[2]; e.boost = (n + m) / 2 * (/for each|where X/.test(ln) ? 2.5 : 1); e.diz.push(/for each|where X/.test(ln) ? 'força que cresce com o que está preso' : `+${b[1]}/+${b[2]}`); }
  else { const b0 = ln.match(/gets \+(\d+)\/\+0/); if (b0) { e.boost = +b0[1] / 2; e.diz.push(`+${b0[1]}/+0`); } }
  if (/\+1\/\+1 counter on (it|enchanted|equipped)/.test(ln)) { e.boost += 1; e.diz.push('marcadores ao atacar'); }
  const lnl = ln.toLowerCase(); const vistos = new Set();
  // @ts-ignore T43 (c): KWV é lista de [texto, peso, nome]: v é número
  for (const [k, v, n] of KWV) if (lnl.includes(k) && !vistos.has(n) && !(k === "can't be blocked" && /can't be blocked (except|by more)/.test(lnl))) { e.kv += v; vistos.add(n); e.diz.push(n); }
  if (/Umbra armor|Totem armor/.test(o)) { e.kv += 1.6; e.diz.push('salva a criatura de ser destruída'); }
  e.haste = /\bhaste\b/i.test(ln) || /creatures you control (have|gain) haste|creature spells you cast [^.]*haste|creatures you control [^.]*haste/i.test(o) || (/target creature (you control )?gains? haste/i.test(o) && c.v <= 1);
  if (e.haste && e.anexo) e.diz.push('ímpeto');
  e.draw = /draw (a|two|X) cards?/i.test(o); if (e.anexo && e.draw) e.diz.push('compra uma carta');
  e.volta = /return (it|this card) to its owner's hand/.test(o) && e.anexo;
  // efeitos de anexo que não são força nem palavra-chave
  if (e.anexo && /When(ever)? (enchanted|equipped) creature (or another [^,]*)?dies/.test(o)) { e.kv += 1.5; e.diz.push('devolve valor se a criatura morrer'); }
  if (e.anexo && /(enchanted|equipped) creature deals damage equal to its power|it deals damage equal to its power|deals that much damage to each opponent/i.test(o)) { e.kv += 1.6; e.diz.push('dano extra com a força da criatura'); }
  if (e.anexo && /untap all lands you control|create a Treasure|search your library for [^.]*land/.test(o)) { e.kv += 0.6; e.diz.push('gera mana'); }
  e.extra = /additional combat phase|extra combat/i.test(o);
  e.engine = !e.anexo && /Constellation|Whenever (an|another) (Aura|enchantment|Equipment)[^.]*(enters|you control)|Whenever you cast an? (Aura|enchantment|Equipment)|becomes attached|Whenever an? (Aura|Equipment) you control/i.test(o) && /draw|create|counter|Add |double [^.]*power|gets \+\d/.test(o); // Nylea's Colossus dobra a força
  e.reduz = /(Aura|Enchantment|Equipment)[^.]{0,30} spells?[^.]{0,30} cost \{\d\} less|Equip abilities[^.]* cost \{\d\} less|equip costs?[^.]* less/i.test(o);
  return (EFX[c.name] = e);
}
function planoDe(A: Analise) {
  const o = A.cmds.map((c: Carta) => c.o.split('\n//\n')[0]).join('\n');
  const nome = A.cmds.map((c: Carta) => c.name.split(',')[0]).join(' + ') || 'o comandante';
  const mv = A.cmds.length ? Math.max(...A.cmds.map((c: Carta) => c.v)) : 0;
  const atk = /Whenever [^.\n]{0,60}\b(attacks|deals combat damage)|attacking creature/i.test(o);
  const nAnexo = A.uniq.filter((c: Carta) => efeitos(c).anexo).length;
  const voltron = /Aura|Equipment|attached|equipped|enchanted creature/i.test(o) || (A.cmdThemes.has('voltron') && nAnexo >= 10) || (atk && nAnexo >= 12);
  const tribo = A.tribe && new RegExp('\\b' + A.tribe![0].slice(0, 3), 'i').test(o) ? A.tribe![0] : null;
  const goad = /\bgoad|attacks? each combat if able|can't block|Creatures your opponents control attack/i.test(o);
  const P: Dic = { nome, mv, atk, voltron, goad, ativo: atk || voltron, nAnexo, tribo };
  const quer: any[] = [];
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
const TIPO_RAMP: Dic = {};
const RAMP_N: Dic<string> = { pedra: 'pedra de mana', dork: 'criatura de mana', terreno: 'busca terreno', tesouro: 'tesouros de uma vez', ritual: 'mana só no turno', condicional: 'mana só se algo acontecer' };
function tipoRamp(c: Carta) {
  if (!c || isLand(c)) return null;
  if (c.name in TIPO_RAMP) return TIPO_RAMP[c.name];
  const pb = SEM_BANCO ? null : perfilBanco(c.name);
  if (pb && !pb.falta && pb.f.has('ramp')) return (TIPO_RAMP[c.name] = pb.ramp === 'reduz' ? null : pb.ramp);
  const o = c.o.split('\n//\n')[0].replace(/\([^)]*\)/g, ''), t = c.t.split(' // ')[0], tg = c.tags; // sem o texto de lembrete (o do tesouro tem "{T}: Add")
  const tapAdd = /(^|\n)[^\n]*\{T\}[^:\n]*: Add /.test(o) && !/\{T\}, Sacrifice (this|~|it)[^:\n]*: Add/.test(o);
  const cond = /\b(Whenever|When) [^\n]*?(deals (combat )?damage|attacks|dies|an opponent|a player|you cast|you copy)[^\n]*(Treasure|Add \{|search your library for [^.]*land)/.test(o);
  let r: string | null = null;
  const pede = /(^|\n)[^\n:]*(Collect evidence|Remove (an?|one|two|three|\w+) [^:\n]*counters?|Exert|Tap an untapped|Tap (two|three|\w+) untapped)[^:\n]*: Add/i.test(o) || /: Add [^\n]*Activate only if/i.test(o);
  if (pede || /sacrifice this Aura[^\n]*\n[^\n]*When you sacrifice this Aura, search/i.test(o)) r = 'condicional'; // Ordeal of Nylea: só depois de 3 ataques
  else if (/Whenever enchanted (land|Forest|[A-Z][a-z]+) is tapped for mana, its controller adds an additional/i.test(o)) r = 'pedra'; // Wild Growth, Utopia Sprawl: mana a mais todo turno
  else if (tg.includes('ritual')) r = 'ritual';
  else if (/Sacrifice (an?|another) (creature|artifact|permanent|[A-Z][a-z]+)\b[^:\n]*: Add/.test(o)) r = null; // altar: é peça de combo, não acelera
  else if (/Sacrifice (this|~|it)[^:\n]*: Add/.test(o) && !tapAdd) r = 'tesouro';
  else if (tg.includes('land-ramp') && /Its controller may search|that player may search|each player/i.test(o)) r = null; // Path to Exile: o terreno vai para o outro
  else if ((tg.includes('mana-rock') || (/Artifact/.test(t) && !/Creature/.test(t) && tapAdd)) && !cond) r = 'pedra';
  else if ((tg.includes('mana-dork') || (/Creature/.test(t) && tapAdd)) && !cond) r = 'dork';
  else if (tg.includes('land-ramp') && /(search your library for [^.]*(land|Forest|Plains|Island|Swamp|Mountain)[^.]*(put|onto the battlefield)|put (a|up to \w+|any number of) [^.]*land cards? [^.]*onto the battlefield)/i.test(o) && !cond) r = 'terreno';
  else if (/Enchantment/.test(t) && tapAdd) r = 'pedra';
  else if (tg.includes('ramp') || tg.includes('mana-doubler') || /Treasure|Add \{/.test(o)) {
    if (cond || /Whenever|At the beginning|unless/.test(o) && !/^When [^\n]*enters/m.test(o)) r = 'condicional';
    else if (/create (a|two|three|four|X|\w+) Treasure/i.test(o)) r = 'tesouro';
    else if (tg.includes('ramp')) r = 'condicional';
  }
  return (TIPO_RAMP[c.name] = r);
}
// custo real de um ramp (19/11/2026): Everflowing Chalice custa {0}, mas cada marcador custa {2}; X (Astral Cornucopia) idem;
// Mox Diamond custa 0, mas troca um terreno da mão: adianta uma vez, não soma um terreno — conta como ramp de 2
function custoRamp(c: Carta) {
  if (!c) return 99;
  const o = c.o.split('\n//\n')[0].replace(/\([^)]*\)/g, ''), m = c.m.split(' // ')[0]; // sem lembrete (o do tesouro tem "{T}, Sacrifice")
  const mk = o.match(/Multikicker \{(\d+)\}/); if (mk) return c.v + +mk[1];
  if (/\{X\}/.test(m)) return Math.max(2, c.v + (m.match(/\{X\}/g) || []).length); // Astral Cornucopia: X=1 custa 3
  if (trocaTerreno(c)) return Math.max(2, c.v);
  const sp = c.v === 0 && o.match(/Suspend (\d+)/); if (sp) return +sp[1] + 1;   // Sol Talisman: suspensa, só chega turnos depois
  // a mana vem de uma ativação que custa mana (Dungeoneer's Pack: {2}, {T}, sacrifica: um tesouro) ou a carta entra virada: soma no custo
  const lm = o.split('\n').find(l => /:/.test(l) && /Add \{|Treasure|Powerstone|mana of any|land card[^.]*onto the battlefield/i.test(l.split(':').slice(1).join(':')));
  const ca = lm ? custoN(lm.split(':')[0].replace(/\{[TQ]\}/g, '')) : 0;
  return c.v + ca + (/(artifact|this|~) enters tapped/i.test(o) && /Artifact/.test(c.t.split(' // ')[0]) ? 1 : 0);
}
const trocaTerreno = (c: Carta) => /discard a land card|return a land you control to its owner's hand/i.test(c.o.split('\n//\n')[0]);
// fórmula de terrenos do Frank Karsten (ChannelFireball, 2022), a que o amigo do usuário mandou:
// terrenos = 31,42 + 3,13 × custo médio das não-terrenos − 0,28 × (compra + ramp de custo ≤ 2)
// Ajustada (pedido do usuário, 19/11/2026): +1 com comandante de 6 ou mais (a fórmula só olha as 99) e
// carta de dupla face com terreno no verso vale meio terreno (na pura conta inteira).
// terrenos pelos decks médios do EDHREC (382 decks, ferramentas/calibra): só o custo médio das mágicas explica (erro médio 1,2;
// o Karsten erra 2,0 e dá ~1 a mais). Gerado por gera_meta.py.
const TERR_EDH = { a: 31.53, b: 1.28 };
function terrenosFormula(cards: Carta[], cmds: Carta[]) {
  const nonland = cards.filter((c: Carta) => !isLand(c));
  const soma = nonland.reduce((s, c: Carta) => s + c.v, 0), n = nonland.length, media = n ? soma / n : 3;
  const ramp2: any[] = [], compra2: string[] = [];
  for (const c of nonland) {
    if (['pedra', 'dork', 'terreno', 'tesouro'].includes(tipoRamp(c)) && custoRamp(c) <= 2 && !trocaTerreno(c)) ramp2.push(c.name);
    else if (c.v <= 2 && rolesOf(c).has('draw')) compra2.push(c.name);
  }
  const barato = ramp2.length + compra2.length;
  const pura = 31.42 + 3.13 * media - 0.28 * barato;
  const cmdMV = Math.max(0, ...cmds.map((c: Carta) => c.v));
  const ajustes: any[] = [];
  if (cmdMV >= 6) ajustes.push({ v: 1, t: `comandante de ${cmdMV} manas: +1 (a fórmula só olha as 99 cartas)` });
  const ajust = pura + ajustes.reduce((s, a) => s + a.v, 0);
  const lands = cards.filter(isLand).length, mdfc = cards.filter(isMdfcLand).length;
  const edh = TERR_EDH.a + TERR_EDH.b * media;
  return { soma, n, media, ramp2, compra2, barato, pura, ajust, edh, ajustes, cmdMV, lands, mdfc, temPura: lands + mdfc, temAjust: lands + mdfc * 0.5 };
}
// ---------- EDHREC: a LÓGICA da sinergia, aplicada à ideia de quem monta (19/11/2026) ----------
// No EDHREC, sinergia = % dos decks de um grupo que jogam a carta MENOS % dos decks das mesmas cores em geral.
// Usamos as páginas de TEMA por cor (json.edhrec.com/pages/tags/<tema>/<cores>.json, CORS liberado): o grupo é
// "decks <tema> nessas cores", escolhido pela pessoa no passo 2 (ou na ideia das trocas), não o jeito mais comum do comandante.
// De cada carta sai: syn (o quanto ela é DO TEMA) e base = inc − syn (o quanto ela é jogada nessas cores em geral: qualidade sem tema).
// A página do comandante (pages/commanders/<slug>) só serve de informação ("como costumam jogar"), sem peso.
// Tudo guardado 7 dias em localStorage ('raiox:edh:<caminho>').
const EDH: Dic = {};
// DESLIGADO em 19/11/2026 a pedido do usuário: nada de depender de dados de fora (tema pouco jogado não teria base).
// O código fica para consulta até a lógica própria (efetividade + triangulação) entrar; com false nada é buscado nem pesa.
const EDH_LIGADO = false;
const EDH_TEMA: Dic<string> = { voltron: 'voltron', tokens: 'tokens', counters: 'plus-1-plus-1-counters', graveyard: 'graveyard', artifacts: 'artifacts', enchant: 'enchantress', spells: 'spellslinger', sac: 'aristocrats', life: 'lifegain', lands: 'landfall', combat: 'aggro', draw: 'card-draw', flying: 'flying' };
const EDH_PLURAL: Dic<string> = { Elf: 'elves', Dwarf: 'dwarves', Wolf: 'wolves', Werewolf: 'werewolves', Fungus: 'fungi', Sphinx: 'sphinxes', Fox: 'foxes', Mouse: 'mice', Ox: 'oxen', Octopus: 'octopuses', Djinn: 'djinn', Phoenix: 'phoenixes' };
const EDH_COR: Dic<string> = { '': 'colorless', W: 'mono-white', U: 'mono-blue', B: 'mono-black', R: 'mono-red', G: 'mono-green', WU: 'azorius', UB: 'dimir', BR: 'rakdos', RG: 'gruul', GW: 'selesnya', WB: 'orzhov', UR: 'izzet', BG: 'golgari', RW: 'boros', GU: 'simic', WUB: 'esper', UBR: 'grixis', BRG: 'jund', RGW: 'naya', GWU: 'bant', WBG: 'abzan', URW: 'jeskai', BGU: 'sultai', RWB: 'mardu', GUR: 'temur', WUBR: 'yore-tiller', UBRG: 'glint-eye', BRGW: 'dune-brood', RGWU: 'ink-treader', GWUB: 'witch-maw', WUBRG: 'five-color' };
function edhCor(ident: Iterable<string>) { const ks = Object.keys(EDH_COR); const set = [...ident].sort().join(''); return EDH_COR[ks.find(k => [...k].sort().join('') === set)!] || ''; }
const edhSlug = (names: string[]) => [...names].map(n => n.split(' // ')[0]).sort().map(n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/[\s-]+/g, '-')).join('-');
function edhLe(d: any): PaginaEdh | null {
  const j = d && d.container && d.container.json_dict; if (!j) return null;
  const cards: Dic = {};
  for (const l of j.cardlists || []) for (const v of l.cardviews || []) {
    if (!v.potential_decks) continue;
    const inc = v.num_decks / v.potential_decks, syn = v.synergy || 0;
    if (!cards[v.name] || cards[v.name].inc < inc) cards[v.name] = { inc: +inc.toFixed(3), syn: +syn.toFixed(3) };
  }
  return { t: Date.now(), n: (j.card && j.card.num_decks) || 0, cards, tags: ((d.panels || {}).taglinks || []).slice(0, 5).map((x: any) => [x.value, x.count]) };
}
function edhPagina(cam: string) {
  if (!cam) return Promise.resolve(null);
  if (EDH[cam]) return EDH[cam] instanceof Promise ? EDH[cam] : Promise.resolve(EDH[cam]);
  try { const c = JSON.parse(localStorage.getItem('raiox:edh:' + cam) || 'null'); if (c && Date.now() - c.t < 7 * 864e5) return Promise.resolve(EDH[cam] = c); } catch (e) {}
  return (EDH[cam] = fetch('https://json.edhrec.com/pages/' + cam + '.json').then(r => r.ok ? r.json() : null).then(d => {
    const o = edhLe(d); if (!o) return (EDH[cam] = { erro: 1 });
    try { localStorage.setItem('raiox:edh:' + cam, JSON.stringify(o)); } catch (e) {}
    return (EDH[cam] = o);
  }).catch(() => (EDH[cam] = { erro: 1 })));
}
function edhJa(cam: string) { const v = EDH[cam]; if (v && !(v instanceof Promise)) return v.erro ? null : v; try { const c = JSON.parse(localStorage.getItem('raiox:edh:' + cam) || 'null'); if (c) return (EDH[cam] = c); } catch (e) {} return null; }
const edhCmdCam = (names: string[]) => names && names.length ? 'commanders/' + edhSlug(names) : '';
function edhTemaCam(k: string, ident: Set<string>, tribo?: string | null) {
  const t = k === 'tribe' ? (tribo ? (EDH_PLURAL[tribo] || tribo.toLowerCase() + 's') : '') : EDH_TEMA[k];
  if (!t) return ''; const cor = edhCor(ident); return 'tags/' + t + (cor ? '/' + cor : '');
}
const EDH_TEMA_N = (k: string, tribo?: string | null) => k === 'tribe' ? 'de ' + (tribo || 'tribo') : ({ voltron: 'Voltron', tokens: 'de fichas', counters: 'de marcadores +1/+1', graveyard: 'de cemitério', artifacts: 'de artefatos', enchant: 'de encantamentos', spells: 'de mágicas', sac: 'de sacrifício', life: 'de ganho de vida', lands: 'de landfall', combat: 'de ataque (aggro)', draw: 'de compra', flying: 'de voadores' })[k] || k;
// ideia = temas escolhidos; devolve as páginas que já chegaram e uma promessa das que faltam
function edhIdeia(temas: Iterable<string>, ident: Set<string>, tribo?: string | null): Ideia {
  if (!EDH_LIGADO) return { pags: [] as any[], cor: '', tribo, carrega: null };
  const cams = [...temas].map(k => [k, edhTemaCam(k, ident, tribo)]).filter(([, c]) => c);
  const pags = cams.map(([k, cam]) => ({ k, cam, d: edhJa(cam) })).filter(x => x.d);
  const falta = cams.filter(([, cam]) => !edhJa(cam) && !(EDH[cam] && EDH[cam].erro));
  return { pags, cor: edhCor(ident), tribo, carrega: falta.length ? Promise.all(falta.map(([, cam]) => edhPagina(cam))) : null };
}
// o que a comunidade diz da carta, medido contra a IDEIA: syn = maior sinergia entre os temas; base = inclusão nas cores sem o tema
function edhCarta(I: Ideia | null, c: Carta) {
  if (!I || !I.pags.length || !c) return null;
  let best: any = null;
  for (const p of I.pags) { const x = p.d.cards[c.name] || p.d.cards[c.name.split(' // ')[0]]; if (!x) continue; const r = { k: p.k, n: p.d.n, inc: x.inc, syn: x.syn, base: Math.max(0, x.inc - x.syn) }; if (!best || r.syn > best.syn) best = { ...r, base: Math.max(best ? best.base : 0, r.base) }; else best.base = Math.max(best.base, r.base); }
  return best;
}
// nota: sinergia com a ideia pesa mais que a qualidade geral; fora das listas = um pouco abaixo de zero (ninguém joga nesse tema)
const edhNota = (I: Ideia | null, c: Carta) => { if (!I || !I.pags.length) return 0; const x = edhCarta(I, c); return x ? 1.1 * Math.max(-0.25, x.syn) + 0.7 * x.base : -0.12; };
function edhPorque(I: Ideia | null, c: Carta) {
  const x = edhCarta(I, c); if (!I || !I.pags.length) return '';
  const temas = I.pags.map(p => EDH_TEMA_N(p.k, I.tribo)).join(' / ');
  if (!x) return `No EDHREC: não aparece nos decks ${temas} dessas cores`;
  const pi = Math.round(100 * x.inc), pb = Math.round(100 * x.base), sy = Math.round(100 * x.syn);
  return `Sinergia com a ideia (EDHREC): em ${pi}% dos decks ${EDH_TEMA_N(x.k, I.tribo)} dessas cores contra ${pb}% dos decks dessas cores em geral (${sy >= 0 ? '+' : ''}${sy}%: ${sy >= 15 ? 'é carta do tema' : sy <= -3 ? 'carta boa em geral, não do tema' : 'carta comum, pouco ligada ao tema'})`;
}
const rampFirme = (c: Carta) => ['pedra', 'dork', 'terreno'].includes(tipoRamp(c));
function valorPlano(A: Analise, c: Carta) {
  const P = A.plano; if (!P || !c || isLand(c)) return { v: 0, why: [] as any[] };
  const cache = (A._vp = A._vp || {}); if (cache[c.name]) return cache[c.name];
  const e = efeitos(c), why: string[] = [], rl = rolesOf(c); let v = 0;
  // ímpeto só antecipa o comandante se a fonte já está na mesa antes dele: planeswalker (habilidade de lealdade,
  // um turno por vez) ou carta mais cara que o comandante chegam depois e valem pouco por isso
  if (P.atk && e.haste) {
    if (/Planeswalker/.test(c.t.split(' // ')[0]) || c.v > P.mv) { v += 1; why.push(`dá ímpeto, mas ${/Planeswalker/.test(c.t) ? 'pela lealdade, com o planeswalker já na mesa' : `custa ${c.v}: chega depois de ${P.nome}`}`); }
    else { v += 3; why.push(`dá ímpeto: ${P.nome} ataca no turno em que entra, sem esperar uma rodada`); }
  }
  if (P.atk && e.extra) { v += 3; why.push(`combate extra: ${P.nome} ataca de novo (e o gatilho de ataque dispara de novo)`); }
  if (rl.has('ramp') && P.mv >= 3 && !e.anexo) {
    const tr = tipoRamp(c), cv = custoRamp(c);
    const so = semLembrete(c).match(/Spend this mana only to cast (an? )?(\w+)/i);
    if ((/Powerstone/.test(semLembrete(c)) && !/Artifact/.test(A.cmds.map(x => x.t).join(' '))) || (so && !/creature|commander/i.test(so[2]) && !A.cmds.some(x => x.t.includes(so[2])))) why.push(`a mana ${so ? 'tem restrição e' : 'de Powerstone'} não paga ${P.nome}`);
    else if (cv <= P.mv - 2 && (tr === 'condicional' || tr === 'ritual')) why.push(`a mana dele ${tr === 'ritual' ? 'some no fim do turno' : 'só vem se algo acontecer antes'}: não garante ${P.nome} um turno antes`);
    else if (cv <= P.mv - 2 && tr) { v += P.ativo ? 2 : 1; why.push(`ramp de ${cv} mana${cv > 1 ? 's' : ''}${cv !== c.v ? ' na prática' : ''}: põe ${P.nome} (custo ${P.mv}) na mesa um turno antes`); }
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
  if (P.ativo && !P.goad && c.v >= 5 && !rl.has('wipe') && !e.engine && !e.extra && !OVERRUN.test(semLembrete(c))) { v -= 0.6 * (c.v - 4); why.push(`custa ${c.v}: chega tarde para um deck que quer atacar cedo`); }
  return (cache[c.name] = { v, why });
}

// ---------- efetividade por função e trocas por triangulação (20/11/2026, pedido do usuário) ----------
// Sem dados de fora: a nota de cada carta em cada função sai do texto (custo, se repete ou é uma vez, se fica na mesa,
// velocidade, alcance, se é simétrica, se tem desvantagem) e a CONDIÇÃO é medida contra o deck
// (Ragavan num deck que bate cedo com ímpeto vale muito; num deck lento, pouco). Popularidade não entra.
const EF_K = ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter'];
const OVERRUN_RX = /[^.\n]*creatures you control (gain [^.]*and )?get \+(X|\d)\/\+(X|\d)[^.\n]*/i;
// finalizador de mesa larga (Craterhoof, Overrun): +N/+N até o fim do turno COM atropelar, ou +X/+X pelo número de criaturas/da tribo.
// +2/+2 ou +3/+3 sem atropelar (Invasion Tactics, Rydia's Return) e X por Food/artefato não fecham o jogo.
const OVERRUN = { test(o: string) {
  const o2 = o.split('\n').filter(l => !/^\s*[+−-]?\d+:|^\s*[+−-]X:/.test(l)).join('\n'); // habilidade de lealdade (ultimate de planeswalker) não conta
  const m = o2.match(OVERRUN_RX); if (!m || !/until end of turn/i.test(m[0] + o2)) return false; const f = m[0], pw = m[2];
  if (/trample/i.test(f)) return pw === 'X' || +pw >= 3; const x = f.match(/X is the number of (\w+) you control/i) || o2.match(/where X is the number of (\w+) you control/i);
  return pw === 'X' && !!x && !/^(Foods?|Clues?|Treasures?|artifacts?|lands?|enchantments?|permanents?|Forests?)$/i.test(x[1]); } };
const semLembrete = (c: Carta) => c.o.split('\n//\n')[0].replace(/\([^)]*\)/g, '');
function perfilDeck(A: Analise) {
  if (A._perfil) return A._perfil;
  const nl = A.cards.filter((c: Carta) => !isLand(c)), n = nl.length || 1;
  const front = (c: Carta) => c.t.split(' // ')[0];
  const cri = nl.filter((c: Carta) => /Creature/.test(front(c)));
  const cedo = cri.filter((c: Carta) => c.v <= 2).length, haste = nl.filter((c: Carta) => efeitos(c).haste).length;
  const evas = cri.filter((c: Carta) => /\b(Flying|Menace|Trample|Shadow|Horsemanship)\b|can't be blocked/i.test(c.o)).length;
  const P: Dic = {
    n, cri: cri.length / n,
    bate: Math.min(1, (cedo + 1.5 * haste + 0.4 * evas) / 16 + (A.plano && A.plano.atk ? 0.15 : 0)),
    feit: nl.filter((c: Carta) => /Instant|Sorcery/.test(front(c))).length / n,
    naoCri: (n - cri.length) / n,
    morre: Math.min(1, nl.filter((c: Carta) => /[Ss]acrifice (a|another) creature/.test(c.o)).length / 6 + cri.length / n * 0.5),
    fichas: Math.min(1, nl.filter((c: Carta) => /create[^.]*tokens?/i.test(c.o)).length / 12),
    nCri: cri.length,
    tri: A.tribe ? nl.filter((c: Carta) => subtypes(c).includes(A.tribe![0]) || /Changeling/.test(c.o)).length / n : 0,
  };
  P.txt = `${cri.length} criaturas, ${cedo} de até 2 manas, ${haste} fontes de ímpeto`;
  return (A._perfil = P);
}
// a condição de um gatilho, medida contra o deck: [multiplicador, porquê]
/** @returns {[number, string]} */
function condDeck(A: Analise, c: Carta, o: string): [number, string] {
  const P = perfilDeck(A), pc = (x: number) => Math.round(100 * x) + '%';
  const proprio = /\b(Haste|Dash|Flying|Menace|Trample)\b|can't be blocked/i.test(o);
  // gatilho de um tipo de criatura (Invasion Tactics: "one or more Allies"): mede quanto do deck é desse tipo
  const tp = o.match(/Whenever (?:a|an|another|one or more) (?:other )?(?:nontoken )?([A-Z][a-z]+)(?: creatures?)? you control/);
  if (tp && !/^(Creatures?|Tokens?|Artifacts?|Lands?|Equipment|Auras?|Enchantments?|Permanents?|Vehicles?)$/.test(tp[1])) {
    const w0 = tp[1], cand = [w0, w0.replace(/ies$/, 'y'), w0.replace(/ves$/, 'f'), w0.replace(/s$/, '')];
    const nl = A.cards.filter(x => !isLand(x)), f = nl.filter(x => cand.some(k => subtypes(x).includes(k)) || /Changeling/.test(x.o)).length / (nl.length || 1);
    if (!(A.tribe && cand.includes(A.tribe![0]))) return [Math.min(1, 0.1 + 1.5 * f), `só rende com ${w0}: ${pc(f)} do deck`];
  }
  if (/Equipped creature gets \+\d\/-1/.test(o) && /equipped creature dies/i.test(o)) return [1.1, 'ela mesma mata as criaturas de resistência 1'];
  if (/deals (combat )?damage to (a player|an opponent|one or more)|Whenever [^.\n]*attacks/i.test(o)) {
    const m = Math.min(1.1, 0.3 + 0.75 * P.bate + (proprio ? 0.15 : 0));
    return [m, `só rende atacando; o deck ${P.bate >= 0.6 ? 'bate cedo' : P.bate >= 0.35 ? 'bate às vezes' : 'demora a atacar'} (${P.txt})${proprio ? ' e ela mesma tem como chegar' : ''}`];
  }
  if (/Whenever an opponent|each opponent|opponents? (casts?|draws?)/i.test(o)) return [0.85, 'depende dos oponentes, que jogam todo turno: rende quase sempre'];
  if (/Whenever you cast (an? )?(instant|sorcery|noncreature)/i.test(o)) { const s = /noncreature/i.test(o) ? P.naoCri : P.feit; return [Math.min(1.1, 0.25 + 1.6 * s), `rende com ${/noncreature/i.test(o) ? 'mágicas que não são criatura' : 'instantâneas e feitiços'}: ${pc(s)} do deck`]; }
  if (/Whenever you cast (a|an) creature spell|Whenever (a|another) (nontoken )?creature (you control )?enters/i.test(o)) return [Math.min(1.1, 0.25 + 1.2 * P.cri), `rende com criaturas: ${pc(P.cri)} do deck`];
  if (/Whenever (a|another) creature (you control )?dies|Whenever you sacrifice/i.test(o)) return [Math.min(1.1, 0.25 + 0.9 * P.morre), `rende quando criatura morre; o deck ${P.morre >= 0.5 ? 'tem como sacrificar' : 'tem pouco sacrifício'}`];
  if (/Whenever (one or more )?tokens?|create one or more tokens/i.test(o)) return [Math.min(1.1, 0.25 + 0.9 * P.fichas), `rende com fichas; o deck ${P.fichas >= 0.5 ? 'faz muitas' : 'faz poucas'}`];
  if (A.tribe && new RegExp('Whenever (a|another) ' + A.tribe![0], 'i').test(o)) return [1, `rende com ${A.tribe![0]}, a tribo do deck`];
  return [0.6, 'depende de algo acontecer antes'];
}
// ---------- nota do ramp pelo modelo geral (19/11/2026, aprovado pelo usuário) ----------
// MEX = mana a mais × peso do turno (mana no T2 vale mais que no T6); permanente rende do turno seguinte até o T6;
// mana de uma vez só = melhor turno; × confiabilidade (criatura 0,85, ritual 0,9, condicional medida contra o deck).
// Nota = 1,15 × MEX / 2,6 (Arcane Signet = 1,15); acima de 1,3 cresce em raiz. +0,3 se põe o comandante um turno antes.
const RW = [0, 1.0, 1.0, 0.9, 0.75, 0.55, 0.4];
const rSoma = (de: number) => { let s = 0; for (let t = Math.max(1, de); t <= 6; t++) s += RW[t]; return s; };
const pT = (t: number) => RW[Math.max(1, Math.min(6, t))];
function manaDada(A: Analise, c: Carta, o: string) {
  const linha = o.split('\n').find(l => /:\s*Add/.test(l)) || '';
  const add = linha.match(/Add ((\{[^}]+\})+)/) || o.match(/Add ((\{[^}]+\})+)/);
  let g = add ? (add[1].match(/\{/g) || []).length : 0, w: string | null = null;
  if (/Add one mana/i.test(o)) g = 1; if (/Add two/i.test(o)) g = 2; if (/Add three/i.test(o)) g = 3;
  if (/adds an additional/i.test(o)) g = 1; // Wild Growth, Utopia Sprawl: o terreno dá uma a mais
  const fe = o.match(/Add [^\n]*for each ([A-Z][a-z]+|creature|artifact)/i);
  if (/for each charge counter/i.test(o)) { g = 1; w = 'um marcador de carga (pagando o reforço uma vez)'; }
  else if (fe) { const tri = A.tribe && fe[1].toLowerCase().startsWith(A.tribe![0].toLowerCase()); g = tri || /creature/i.test(fe[1]) ? 3 : 2; w = `a mana cresce com o que está na mesa (conta ${g})`; }
  else if (/Add an amount of|Add [^\n]*equal to|Add X mana/i.test(o)) { g = 2; w = 'a mana cresce com o tempo (conta 2)'; }
  const ca = linha ? custoN(linha.split(':')[0].replace(/\{[TQ]\}/g, '')) : 0;
  return { g, net: Math.max(0, g - ca), ca, w };
}
function mexRamp(A: Analise, c: Carta, tr: string | null, o: string) {
  const cv = c.v, cr = custoRamp(c), w = [`${RAMP_N[tr!]} de ${cr}${cr !== cv ? ' na prática' : ''}`];
  const cmd = (A.cmds || [])[0], C = cmd ? cmd.v : 0;
  const D = manaDada(A, c, o); if (D.w) w.push(D.w);
  let entra = Math.max(1, cv, /Multikicker/.test(o) || /\{X\}/.test(c.m) || tr === 'terreno' || tr === 'tesouro' ? cr : 0), mex = 0, conf = 1, g = 0, vez = false;
  const lAdd = o.split('\n').find(l => /:\s*Add/.test(l)) || '';
  if (/enters tapped/i.test(o) && /Artifact/.test(c.t)) entra += 1;
  const sp = cv === 0 && o.match(/Suspend (\d+)/); if (sp) entra = +sp[1] + 1;
  if (trocaTerreno(c)) { entra = Math.max(1, cr); w.push('troca um terreno da mão'); }
  if (tr === 'pedra' || tr === 'dork') {
    g = D.net; if (D.ca) w.push(`ativar custa ${D.ca}`);
    if (tr === 'dork') { conf = 0.85; w.push('é criatura: morre no primeiro limpa-mesa (×0,85)'); }
    if (trocaTerreno(c)) { g = Math.min(g, 1); vez = true; mex = pT(entra) * 1; }
    else if (/Sacrifice (this|~)/i.test(lAdd)) { g = D.g; vez = true; mex = g * pT(entra + 1); w.push('sacrifica para dar a mana: uma vez só'); }
    else if (/doesn't untap during your untap step/i.test(o)) { g = D.g; vez = true; mex = g * pT(entra) + 0.2 * g * rSoma(entra + 2); w.push('não desvira sozinha: é uma rajada de mana, desvirar custa caro'); }
    else mex = g * rSoma(entra + 1);
    if (/Discard your hand/i.test(lAdd)) { conf *= 0.35; w.push('descarta a mão inteira (×0,35)'); }
  } else if (tr === 'terreno') {
    const bf = /(two|up to two)[^.]*basic land cards?[^.]*(put them|onto the battlefield)|up to two[^.]*onto the battlefield/i.test(o) && !/put one onto the battlefield/i.test(o) ? 2 : 1;
    const mao = /into your hand/i.test(o) ? 1 : 0; g = bf;
    mex = bf * rSoma(entra + 1) + 0.5 * mao * rSoma(entra + 2); if (mao) w.push('+1 terreno na mão (vale meio)'); if (bf === 2) w.push('dois terrenos');
  } else if (tr === 'tesouro') {
    const m = o.match(/create (a|an|one|two|three|four|X|\d+)[^.]*Treasure/i);
    g = !m ? 1 : ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, x: 2 })[m[1].toLowerCase()] || +m[1] || 1; vez = true;
    mex = g * pT(entra + 1); w.push('a mana vem uma vez só');
  } else if (tr === 'ritual') {
    g = Math.max(0, D.g - cv); vez = true; conf = 0.9; mex = g * pT(Math.max(cv, C - g)); w.push('a mana some no fim do turno: conta só o melhor turno');
  } else { // condicional: a condição medida contra o deck
    const [m, ww] = condDeck(A, c, o); conf = Math.min(0.85, m); w.push(ww); // nunca mais firme que criatura de mana
    g = Math.max(1, D.net || (/two basic land/i.test(o) ? 2 : 1));
    if (/three or more [^.]*counters|sacrifice this Aura/i.test(o)) { entra += 3; w.push('a mana só chega depois de alguns turnos'); }
    mex = g * rSoma(entra + 1);
  }
  mex *= conf;
  let nota = 1.15 * mex / 2.6; if (nota > 1.3) nota = 1.3 + 0.25 * Math.sqrt(nota - 1.3);
  w.push(`rende ${fmtD(mex, 1)} manas pesadas até o T6`);
  let bonus = 0, bonusW = '';
  if (C >= 3 && g > 0 && tr !== 'condicional' && !/Powerstone|Spend this mana only/i.test(o)) {
    const t = vez ? Math.max(entra, C - g) : Math.max(entra + 1, C - g);
    if (t < C) { const P = A.plano; bonus = P && P.ativo ? 0.3 : 0.2; bonusW = `põe ${cmd.name.split(',')[0]} na mesa um turno antes (+${fmtD(bonus, 1)})`; }
  }
  return { nota, mex, bonus, bonusW, w };
}
const EF: Dic = {};
function efetiv(A: Analise, c: Carta | null): { v: Dic<number>; why: Dic<string> } {
  if (!c || isLand(c)) return { v: {}, why: {} };
  const key = A._efKey || (A._efKey = Math.random()); const cache = EF[key] || (EF[key] = {}); if (cache[c.name]) return cache[c.name];
  const o = semLembrete(c), t = c.t.split(' // ')[0], rl = rolesOf(c), cv = c.v, v: Dic<number> = {}, why: Dic<string> = {};
  const pb = SEM_BANCO ? null : perfilBanco(c.name), B = pb && !pb.falta ? pb : null;   // B: o banco responde pelos detalhes
  const inst = B ? B.inst : /Instant/.test(t) || /\bFlash\b/.test(o), cri = /Creature/.test(t);
  const autoSac = (l: string) => new RegExp('Sacrifice (this|~|' + c.name.split(',')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i').test(l);
  const repTxt = (rx: RegExp) => o.split('\n').some(l => rx.test(l) && !autoSac(l) && /^(Whenever|At the beginning|[^:]*\{T\}[^:]*:|[^:]*\{\d*[WUBRGC]*\}[^:]*:)/.test(l.trim()));
  const rep = (rx: RegExp, k: string) => B ? B.rep.has(k) : repTxt(rx);
  const custoAdj = (x: number, d: number) => x - d * Math.max(0, cv - 2);
  if (rl.has('ramp')) {
    const tr = tipoRamp(c), cr = custoRamp(c), w: string[] = [];
    if (!tr && /spells? you cast [^.]*cost \{1\} less/i.test(o)) { const P = perfilDeck(A), tipo = /chosen type/i.test(o), tk = (o.match(/(Creature|Enchantment|Artifact|Instant|Sorcery|Aura|Equipment)( and \w+)? spells/i) || [])[1], nl = A.cards.filter(x => !isLand(x)), d = tipo ? P.tri : tk ? nl.filter(x => new RegExp(tk, 'i').test(x.t.split(' // ')[0])).length / (nl.length || 1) : 0.5;
      v.ramp = 0.2 + 0.8 * d; w.push(`reduz em 1 o custo de ${tipo ? (A.tribe ? A.tribe![0] + ' (' + Math.round(100 * d) + '% do deck)' : 'um tipo escolhido, e o deck não é de tribo') : Math.round(100 * d) + '% do deck'}`); }
    else if (!tr) { v.ramp = 0.1; w.push('não dá mana de verdade (a etiqueta de ramp engana)'); }
    else {
      const M = mexRamp(A, c, tr, o); let x = M.nota; w.push(...M.w);
      if (/Powerstone/.test(o)) { x *= 0.5; w.push('Powerstone: a mana só paga artefato'); }
      const so = o.match(/Spend this mana only to cast (an? )?(\w+)/i); if (so && !/creature/i.test(so[2]) && !(A.tribe && so[2].startsWith(A.tribe![0]))) { x *= 0.3; w.push(`a mana só paga ${so[2]}`); }
      if (/gains control of this (artifact|permanent)/i.test(o)) { x *= 0.5; w.push('passa para outro jogador depois de usar'); }
      if (M.bonus) { x += M.bonus; w.push(M.bonusW); }
      v.ramp = x;
    }
    why.ramp = w.join('; ');
  }
  if (rl.has('draw')) {
    const w: any[] = []; let x;
    const NUM: Dic<number> = { a: 1, an: 1, one: 1, another: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, x: 3 };
    const nM = o.match(/draws? (two|three|four|five|seven|X|\d+) cards/i), N0 = B ? Math.max(1, B.draw.n) : nM ? NUM[nM[1].toLowerCase()] || +nM[1] || 3 : 1;
    // recursão (devolve do cemitério para a mão) conta como compra: é carta a mais na mão
    const recT = !/draws? /i.test(o) && o.match(/[Rr]eturn (up to )?(a|an|one|another|two|three|X|\d+)? ?(other )?target [^.]*cards? from your graveyard to your hand/);
    const rec = B ? B.draw.rec && !B.draw.fase && !B.draw.atv && !B.draw.topo && !B.rep.has('draw') : !!recT;
    const N = B ? N0 : recT ? NUM[(recT[2] || 'one').toLowerCase()] || +recT[2] || 1 : N0;
    // o topo do grimório que vira carta na mão ou mágica (Twilight Prophet, Herald's Horn, Realmwalker)
    const topo = B ? B.draw.topo : /(reveal|look at) the top card[^\n]*into your hand|cast [^.]*from the top of your library/i.test(o);
    const loot = B ? B.draw.loot : /draws? (a|one) card,? then (discard|exile|put) a card/i.test(o) && N === 1;
    if (loot) { x = rep(/draw/i, 'draw') ? 0.45 : 0.2; w.push('compra e descarta: só filtra, não dá carta a mais'); }
    else if (rep(/draw|exile the top|look at the top|reveal the top/i, 'draw') || (topo && (B ? B.rep.has('draw') : /from the top of your library/i.test(o)))) {
      const lDraw = o.split('\n').filter(l => /draw|the top card|from the top of your library/i.test(l));
      const up = B ? B.draw.fase : lDraw.some(l => /^At the beginning of (your|each)/i.test(l.trim())), tap = B ? B.draw.atv : lDraw.some(l => /^[^:\n]*(\{[^}]+\}|Pay \d+ life)[^:\n]*:/.test(l.trim()));
      const estat = !up && !tap && (B ? B.draw.topo : /from the top of your library/i.test(o));
      x = up || tap || estat ? 1.25 : 1.1; w.push(up ? 'compra todo turno' : tap ? 'compra toda vez que você ativa' : estat ? 'joga do topo do grimório o tempo todo' : 'compra mais de uma vez');
      if (/chosen type/i.test(o)) { const P = perfilDeck(A), m = Math.min(1.05, 0.2 + 1.5 * P.tri); x *= m; w.push(A.tribe ? `só pega ${A.tribe![0]}: ${Math.round(100 * P.tri)}% do deck` : 'só pega o tipo escolhido, e o deck não é de tribo'); }
      else if (/creature card/i.test(o) && topo) { const P = perfilDeck(A), m = Math.min(1, 0.2 + 1.2 * P.cri); x *= m; w.push(`só pega criatura: ${Math.round(100 * P.cri)}% do deck`); }
      if (/city's blessing/i.test(o)) { x *= 0.75; w.push('só com 10 permanentes na mesa (bênção da cidade)'); }
      const at = o.split('\n').find(l => /:/.test(l) && /draw/i.test(l.split(':').slice(1).join(':')));
      if (B && tap) { const ca = B.draw.atvMana; if (ca >= 2) { x -= 0.15 * (ca - 1); w.push(`cada ativação custa ${ca}`); } if (B.draw.atvPede) { x -= 0.25; w.push('a ativação pede algo em troca'); } }
      else if (tap && at) { const ca = custoN(at.split(':')[0]); if (ca >= 2) { x -= 0.15 * (ca - 1); w.push(`cada ativação custa ${ca}`); } if (/Activate only|discard|Sacrifice an?/i.test(at)) { x -= 0.25; w.push('a ativação pede algo em troca'); } }
      if (!up && !tap && !estat) { const [m, ww] = condDeck(A, c, o); x *= m; w.push(ww); }
      x = custoAdj(x, 0.08);
    } else {
      x = custoAdj(N === 1 ? 0.4 : Math.min(1.3, 0.25 + 0.3 * N), 0.07); w.push(rec ? `devolve ${N > 1 ? N + ' cartas' : 'uma carta'} do cemitério para a mão` : N > 1 ? `compra ${N} de uma vez` : 'compra uma (troca a si mesma, não dá vantagem)');
      if (rec && /When [^\n]*dies/i.test(o)) { x *= 0.8; w.push('só quando ela morre'); }
      if (inst) { x += 0.1; w.push('instantânea'); }
    }
    if (B ? B.draw.todos : /each player draws|Each player draws/.test(o)) { x *= 0.6; w.push('os oponentes compram também'); }
    if (/you lose \d+ life|pay \d+ life/i.test(o) && !/Whenever/.test(o)) w.push('custa vida');
    v.draw = Math.max(0.1, x); why.draw = w.join('; ');
  }
  if (rl.has('removal')) {
    const w: any[] = []; let x = 1;
    if (inst) { x += 0.2; w.push('instantânea'); } else if (!cri && !/Enchantment|Artifact/.test(t)) { x -= 0.1; w.push('só no seu turno'); }
    x += cv <= 1 ? 0.25 : cv === 2 ? 0.15 : cv >= 5 ? -0.3 : cv === 4 ? -0.15 : 0; w.push(`custa ${cv}`);
    // o alcance vem só das frases que removem de fato (não de "untap target permanent" num modo ao lado)
    const rem = (o.match(/[^.;\n•—]*(destroy|exile|damage to|gets -\d|-\d+\/-\d+|owner's hand|sacrifices?|fights?|shuffles it into)[^.;\n•—]*/gi) || []).join(' | ');
    const R = B && B.removal, COR: Dic<string> = { W: 'branco', U: 'azul', B: 'preto', R: 'vermelho', G: 'verde', white: 'branco', blue: 'azul', black: 'preto', red: 'vermelho', green: 'verde' };
    const cor = R ? (R.cor ? [R.cor, R.cor, R.cor[0]] : null) : rem.match(/if (it's|it is) (white|blue|black|red|green)|target (white|blue|black|red|green) (permanent|creature)/i);
    if (cor) { x -= 0.6; w.push(`só pega ${R ? COR[R.cor[0]] || R.cor : COR[(cor[2] || cor[3]).toLowerCase()]}`); }
    else if (R ? R.alcance === 'permanente' : /target (nonland )?permanent(?! with)/i.test(rem)) { x += 0.25; w.push('pega qualquer permanente'); }
    else if (R ? R.alcance === 'criaturaMais' : /target (creature or planeswalker|artifact, creature|creature, artifact|artifact or creature|creature or artifact)/i.test(rem)) x += 0.1;
    else if (R ? R.alcance === 'artenc' : !/target (\w+ )?creature|any target|each creature/i.test(rem) && /target (non-?\w+ )?(artifact|enchantment)/i.test(rem)) { x -= 0.55; w.push('só artefato ou encantamento'); }
    if (R ? R.compensa : /(its controller|its owner|they) [^\n]*reveal[^\n]*onto the battlefield/i.test(o)) { x -= 0.35; w.push('o dono pode ganhar outra permanente no lugar'); }
    const sacL = o.split('\n').find(l => autoSac(l) && /destroy|exile|damage/i.test(l)); if (sacL && /:/.test(sacL)) { const ca = custoN(sacL.split(':')[0]); if (ca + cv >= 4) { x -= 0.15; w.push(`no total custa ${ca + cv}`); } }
    if (R ? R.restrito : /with (power|mana value|toughness) \d+ or (less|greater)|tapped creature|attacking (creature|or blocking)|blocking creature|target non(black|white|artifact|Elf|[A-Z][a-z]+) creature/i.test(o)) { x -= 0.3; w.push('só pega alguns alvos'); }
    const dn = R ? (R.dano && R.dano < 99 ? [String(R.dano), String(R.dano)] : null) : o.match(/deals (\d+) damage to (any )?target/i); if (dn && (R || !/X damage/.test(o))) { const f = +dn[1] <= 1 ? 0.5 : +dn[1] === 2 ? 0.75 : +dn[1] === 3 ? 0.9 : 1; if (f < 1) { x *= f; w.push(`só ${dn[1]} de dano`); } }
    if (/if (another|a) [^.]*with the same name/i.test(o)) { x -= 1; w.push('só funciona com outra de mesmo nome na mesa (quase nunca)'); }
    if (R ? R.soMao : /[Rr]eturn target [^.]*to its owner's hand/.test(o) && !/[Dd]estroy|[Ee]xile target/.test(o)) { x -= 0.35; w.push('só devolve para a mão'); }
    if (R ? R.edito : /(each|target|that) (opponent|player) sacrifices/i.test(o) && !/target (creature|permanent)/i.test(o)) { x -= 0.25; w.push('o oponente escolhe o que perde'); }
    if (R ? R.todosSacrificam : /each player's upkeep|each player sacrifices/i.test(o)) { const nt = o.match(/sacrifices an? non-?(\w+) creature/i), poupa = nt && A.tribe && nt[1].toLowerCase().startsWith(A.tribe![0].toLowerCase().slice(0, 3));
      if (poupa) w.push(`só os oponentes perdem: o deck é ${A.tribe![0]}, a tribo poupada`); else { x -= 0.4; w.push('você também sacrifica'); } }
    const bl = /\bblights? \d/i.test(o); if (bl) w.push('põe −1/−1 numa criatura que o oponente escolhe');
    if (rep(/destroy|exile|damage|-\d+\/-\d+|sacrifices/i, 'removal') && (B || !/^When [^\n]*enters/m.test(o))) { x += 0.3; w.push('remove mais de uma vez'); }
    else if (cri && /When [^\n]*enters/.test(o)) { x += 0.1; w.push('deixa um corpo na mesa'); }
    const linR = o.split('\n').find(l => /destroy|exile target|damage to (any )?target/i.test(l)) || ''; if (/^Whenever/.test(linR.trim())) { const [m, ww] = condDeck(A, c, linR); x *= m; w.push(ww); }
    if (bl) x = Math.min(x, 0.7);
    v.removal = Math.max(0.2, Math.min(1.6, x)); why.removal = w.join('; ');
  }
  if (rl.has('wipe')) {
    const w: any[] = []; let x = 1; const P = perfilDeck(A);
    const fr = (o.match(/[^.\n]*(destroy all|exile all|damage to each|each creature|all creatures|sacrifices? (a|all|each)|-\d+\/-\d+|-X\/-X)[^.\n]*/i) || [o])[0];
    const lado = B ? B.wipe.lado || !!(A.tribe && B.wipe.naoSub.some(s => s.toLowerCase().startsWith(A.tribe![0].toLowerCase().slice(0, 4)))) : /(creatures?|nonland permanents|permanents) your opponents control|each creature you don't control|non-?(Vampire|Elf|Goblin|Zombie|Human|Dragon|Angel|[A-Z][a-z]+) creatures|each opponent sacrifices/i.test(fr) || (A.tribe && new RegExp('non-?' + A.tribe![0], 'i').test(fr));
    const ov = o.match(/Overload ((\{[^}]+\})+)/), cvW = ov ? custoN(ov[1]) : cv;
    if (ov) { x += 0.15; w.push(`com sobrecarga custa ${cvW} e pega todas; sem ela é remoção pontual de ${cv}`); }
    const tribo = /aren't of the chosen type|isn't of the chosen type/i.test(fr);
    if (tribo && A.tribe) { x += 0.5; w.push(`você escolhe ${A.tribe![0]}: poupa a sua tribo`); }
    const dano = B ? (B.wipe.dano ? [String(B.wipe.dano), String(B.wipe.dano)] : null) : fr.match(/deals (\d+) damage to each/i); if (dano && +dano[1] <= 2) { x *= 0.55; w.push(`só ${dano[1]} de dano: mata as pequenas`); }
    if (lado) { x += 0.5; w.push('só de um lado: poupa as suas'); }
    else if (!(tribo && A.tribe) && (ov || tribo || B || /all creatures|each creature|all nonland permanents|all permanents|each player sacrifices/i.test(fr))) { x *= Math.max(0.35, 1.25 - 1.1 * P.cri); w.push(`simétrico: leva junto as suas ${P.nCri} criaturas`); }
    x += cvW <= 4 ? 0.1 : cvW >= 6 ? -0.2 : 0; if (inst) { x += 0.15; w.push('instantânea'); }
    v.wipe = Math.max(0.2, x); why.wipe = w.join('; ');
  }
  if (rl.has('protect')) {
    const w: any[] = []; let x = 0.9;
    if (inst) { x += 0.15; w.push('responde na hora'); }
    x += cv <= 1 ? 0.2 : cv >= 4 ? -0.2 : 0;
    if (B ? B.protect.todas : /(creatures|permanents) you control (gain|have|get)|each creature you control/i.test(o)) { x += 0.25; w.push('protege todas as suas'); }
    if (B ? B.protect.fica || (/Equipment/.test(t)) : /Equipment/.test(t) || (!/Instant|Sorcery/.test(t) && !/until end of turn/.test(o))) { x += 0.25; w.push('fica na mesa e protege sempre'); }
    v.protect = Math.max(0.2, x); why.protect = w.join('; ') || 'proteção de uma vez';
  }
  if (rl.has('counter')) {
    const w: any[] = []; let x = 1;
    x += cv <= 2 ? 0.2 : cv >= 4 ? -0.25 : 0; w.push(`custa ${cv}`);
    if (B ? B.counter.pagavel : /unless its controller pays/i.test(o)) { x -= 0.35; w.push('o oponente pode pagar'); }
    if (B ? B.counter.restrito : /Counter target (noncreature|creature|instant|sorcery|artifact|enchantment|activated|triggered)/i.test(o)) { x -= 0.2; w.push('só alguns tipos'); }
    if (/rather than pay|without paying/i.test(o)) { x += 0.2; w.push('pode sair de graça'); }
    v.counter = Math.max(0.2, x); why.counter = w.join('; ');
  }
  // o texto tem que fazer a função de verdade (as etiquetas juntam muito engano)
  const FAZ: Dic<RegExp> = { ramp: /Add \{|Add an amount of|adds an additional|Add (one|two|three|X|that much) mana|mana of any|Treasure|Powerstone|search your library for [^.]*(land|Forest|Plains|Island|Swamp|Mountain)|lands? cards? [^.]*onto the battlefield|costs? \{\d\} less|play an additional land/i, draw: /draws? (a|an|two|three|four|five|seven|X|\d+) cards?|draw cards|exile the top [^.]*(you may (play|cast))|put (it|that card|them) into your hand|cast [^.]*from the top of your library|[Rr]eturn [^.]*from your graveyard to your hand/i, removal: /destroy target|exile target|shuffles it into|on the (top|bottom) of (its owner's|their) library|damage to (any )?target|damage to (each|up to)|target [^.]*gets -\d|fights?|return target [^.]*owner's hand|sacrifices? (a|an) (non-?[\w-]+ )?(creature|permanent)|counters? on target|\bblights? \d/i, protect: /hexproof|indestructible|shroud|protection from|phases? out|[Pp]revent all (combat )?damage|[Cc]ounter target|[Rr]egenerate|\bward\b|can't be the target/i, counter: /[Cc]ounter target/ };
  for (const k in FAZ) if (!B && v[k] != null && !FAZ[k].test(o)) { v[k] = 0.15; why[k] = 'a etiqueta diz que faz, mas o texto não mostra o efeito'; }
  const ks = Object.keys(v).sort((a, b) => v[b] - v[a]);
  const modal = /Choose one|choose one —/i.test(o) || o.split('\n').filter(l => autoSac(l) && /:/.test(l)).length >= 2;
  ks.slice(1).forEach(k => { v[k] = modal ? 0 : v[k] * 0.6; });
  return (cache[c.name] = { v, why });
}
const efMax = (A: Analise, c: Carta) => Math.max(0, ...Object.values<number>(efetiv(A, c).v));
// quanto vale a i-ésima carta de uma função (0 = a melhor): cheia até o mínimo da faixa, cai até 0,25 no máximo, quase nada acima
function precisa(r: { lo: number; hi: number }, i: number) { if (i < r.lo) return 1; if (i < r.hi) return 1 - 0.75 * (i - r.lo + 1) / (r.hi - r.lo + 1); return 0.08; }
const PESO_K: Dic<number> = { ramp: 1, draw: 1, removal: 1, wipe: 0.8, protect: 0.8, counter: 0.7, lands: 1.2, plano: 1, corpos: 0.8 };
// deck que ganha atacando precisa de criaturas na mesa: abaixo de 20 cada corpo pesa cheio
const USA_CORPOS = false;
const REF_CORPOS = { k: 'corpos', n: 'Criaturas (o deck ganha atacando)', lo: 20, hi: 28 };
// pares que fecham laço, lidos do texto: ganhar vida → oponente perde, e oponente perde → você ganha (Sanguine Bond + Exquisite Blood)
const COMBO_RX = [[/Whenever you gain life[^.]*(opponent|each opponent)[^.]*loses?/i, /Whenever an opponent loses life[^.]*you gain|Whenever an opponent loses life, you gain/i]];
function comboPar(A: Analise, c: Carta) {
  const o = semLembrete(c);
  for (const [a, b] of COMBO_RX) { const outro = a.test(o) ? b : b.test(o) ? a : null; if (!outro) continue; const p = A.uniq.concat(A.cmds).find(x => x.name !== c.name && !isLand(x) && outro.test(semLembrete(x))); if (p) return p.name; }
  return null;
}
// 'plano' = as vagas que sobram para o que faz o deck ganhar: ameaças, peças que o comandante usa, cartas do plano.
// Toda não-terreno entra nessa fila com a nota dela no plano; as 25 melhores contam cheio.
function efPlano(A: Analise, c: Carta) {
  if (!c || isLand(c)) return 0; const rl = rolesOf(c), vp = valorPlano(A, c).v;
  let x = 0.35 + 0.3 * vp + (A.cmdSupport.includes(c.name) ? 0.35 : 0) + (rl.has('wincon') ? 0.4 : rl.has('threat') ? (/Planeswalker/.test(c.t.split(' // ')[0]) ? 0.15 : 0.4) : 0) + (A.plano && A.plano.voltron && efeitos(c).anexo ? 0.3 : 0);
  const par = comboPar(A, c); if (par) x += 1.1; // metade de um laço que ganha o jogo (lido do texto das duas)
  if (isTutor(c)) x += c.v <= 2 ? 0.7 : 0.4; // tutor: vira a peça que falta
  // pagamento: o gatilho bate com o que o deck faz (fichas, criaturas entrando, ataques) e o efeito fecha o jogo
  const o = semLembrete(c);
  const hino = /(creatures|tokens|other [A-Z][a-z]+s?|[A-Z][a-z]+s) you control (get|have) \+|each (other )?creature (you control )?gets \+|shares a creature type|counter on each (other )?(attacking )?(creature|[A-Z][a-z]+) you control/i.test(o);
  const dreno = /Whenever[^\n]*(damage to (each opponent|the player|that player|target opponent|any target|defending player)|loses? \d+ life|each opponent loses)|double the damage|deals that much damage/i.test(o);
  // motor ou fim de jogo (o dreno lido do texto já paga abaixo: não conta duas vezes)
  if (['amplify', 'extra', 'wincon', 'copy'].some(k => rl.has(k)) || (rl.has('drain') && !dreno && !hino)) x += 0.3;
  if (hino || dreno) { const [m] = hino && !/Whenever/i.test(o) ? [Math.min(1, 0.4 + 1.2 * perfilDeck(A).cri)] : condDeck(A, c, o); x += 0.6 * Math.min(1, m); }
  if (A.noRole.includes(c.name) || A.bodyOnly.includes(c.name)) x -= 0.3;
  // deck de tribo: criatura de fora da tribo que não conversa com o comandante é só um corpo
  // (finalizador e quem dá força a todas, como Craterhoof, ficam fora do corte)
  const fim = ['wincon', 'amplify', 'extra'].some(k => rl.has(k)) || OVERRUN.test(o);
  if (OVERRUN.test(o)) x += 0.4 + 0.6 * Math.min(1, perfilDeck(A).cri * 2); // fecha o jogo com a mesa larga
  if (A.tribe && /Creature/.test(c.t.split(' // ')[0]) && !subtypes(c).includes(A.tribe![0]) && !/Changeling/.test(c.o || '') && vp < 0.5 && !A.cmdSupport.includes(c.name) && !fim) x *= 0.45;
  // planeswalker que não conversa com o deck: rende pouco numa mesa de criaturas
  // voltron: o deck ganha com o comandante armado; criatura que não arma, não protege nem conversa com ele é só mais um corpo
  if (A.plano && A.plano.voltron && /Creature/.test(c.t.split(' // ')[0]) && vp < 0.5 && !A.cmdSupport.includes(c.name) && !fim && !efeitos(c).anexo) x *= 0.6;
  if (/Planeswalker/.test(c.t.split(' // ')[0]) && vp < 0.5 && !A.cmdSupport.includes(c.name) && !fim) x *= 0.6;
  if (efMax(A, c) >= 0.6) x *= 0.4; // o valor desta já conta na função básica
  return Math.max(0, Math.min(1.6, x));
}
// ---------- sinergia com o tema (20/11/2026) ----------
// Sem comandante: só o TEMA do deck (a ideia escolhida; sem ideia, o tema que o próprio deck mostra).
// sinergia-db.js (gerada dos roteiros do Forge) diz o que cada carta ALIMENTA e CONSOME; a fórmula é uma só para todo tema.
// nota numa função = mín(efetividade; TETO_EF) + S_tema + S_deck. Acima do teto, ser mais rápida não soma (Signet = Sol Ring),
// então a carta que conversa com o tema ganha da pedra genérica. PORTA_EF: abaixo disso a carta não entra só pela sinergia.
const SIN = window.SINERGIA || {};
const TETO_EF = window.RAIOX_TETO ?? 1.0, PORTA_EF = window.RAIOX_PORTA ?? 0.5, PESO_SIN = window.RAIOX_PSIN ?? 0.4; // S vai de 0 a 2,5: a carta mais ligada ao tema vale até 2× na função
const SIN_TEMA: Dic<Dic<number>> = { tokens: { f: 1, e: 0.6 }, sac: { m: 1, f: 0.5 }, counters: { c: 1 }, life: { v: 1 }, artifacts: { a: 1 }, enchant: { n: 1 }, spells: { s: 1 }, graveyard: { g: 1 }, lands: { t: 1 }, combat: { k: 1 }, voltron: { x: 1, k: 0.4 }, draw: { d: 1 }, flying: { k: 1 } };
const SIN_NOME: Dic<string> = { f: 'fichas', e: 'criaturas entrando', m: 'criaturas morrendo', c: 'marcadores +1/+1', v: 'ganho de vida', a: 'artefatos', n: 'encantamentos', s: 'mágicas', g: 'cemitério', t: 'terrenos entrando', k: 'ataques', x: 'auras e equipamentos', d: 'compra de cartas' };
const sinNome = (r: string) => r.startsWith('T:') ? r.slice(2) : SIN_NOME[r] || r;
const sinDe = (n: string) => SIN[n] || SIN[(n || '').split(' // ')[0]] || [{}, {}];
// o tema: os conceitos marcados na ideia; sem ideia, os temas que mais aparecem nas cartas do deck (sem o comandante)
function temaSin(A: Analise) {
  if (A._temaSin) return A._temaSin;
  let ks = [...concOn(A)], origem = 'ideia';
  if (!ks.length) {
    origem = 'deck'; const cmd = new Set(A.cmds.map((c: Carta) => c.name)), nl = A.uniq.filter((c: Carta) => !isLand(c) && !cmd.has(c.name)), n: Dic = {};
    for (const c of nl) themesOf(c).forEach(t => (n[t] = (n[t] || 0) + 1));
    const top = Object.entries(n).filter(([k]) => SIN_TEMA[k]).sort((a, b) => b[1] - a[1]);
    if (top.length && top[0][1] >= 8) ks = top.filter(([, q], i) => i === 0 || q >= 0.7 * top[0][1]).slice(0, 2).map(([k]) => k);
    const nCri = A.uniq.filter((c: Carta) => /Creature/.test(c.t.split(' // ')[0])).length;
    if (A.tribe && (A.tribe[1] >= 18 || A.tribe[1] >= 0.5 * nCri)) ks.push('tribe'); // tribo de verdade, não 10 humanos por acaso
  }
  const T: Dic = {};
  for (const k of ks) { const w = k === 'tribe' && A.tribe ? { ['T:' + A.tribe![0]]: 1, f: 0.3 } : SIN_TEMA[k] || {}; for (const r in w) T[r] = Math.max(T[r] || 0, w[r]); }
  const nomes = ks.map(k => k === 'tribe' ? (A.tribe ? A.tribe![0] : '') : ((CONCEITOS.find(x => x.k === k) || THEMES.find(x => x.k === k) || {}).n || k).toLowerCase()).filter(Boolean);
  return (A._temaSin = { T, ks, nomes, origem });
}
// quanto a carta conversa com o tema: consome (paga por ele) vale 1, alimenta vale 0,7; as duas coisas = motor (+0,3)
function sinTema(c: Carta, T: Dic<number>) {
  const [p, u] = sinDe(c.name); let su = 0, sp = 0; const rU: any[] = [], rP: any[] = [];
  for (const r in T) { if (u[r]) { su += T[r] * u[r] / 10; rU.push(r); } if (p[r]) { sp += T[r] * p[r] / 10; rP.push(r); } }
  let s = su + 0.7 * sp; if (su > 0 && sp > 0) s += 0.3;
  return { s: Math.min(1.5, s), papel: su && sp ? 'motor' : su ? 'paga' : sp ? 'alimenta' : '', rU, rP };
}
// ligações com as outras cartas do deck: o que esta alimenta e outra consome, e o contrário (recurso do tema pesa cheio, os outros 0,3)
function sinDeck(c: Carta, nomes: string[], T: Dic<number>) {
  const [pc, uc] = sinDe(c.name); let L = 0; const quem: any[] = [];
  for (const d of nomes) {
    if (d === c.name) continue; const [pd, ud] = sinDe(d); let l = 0;
    for (const r in pc) if (ud[r]) l += (T[r] != null ? T[r] : r === 'e' ? 0.1 : 0.3) * pc[r] * ud[r] / 100;
    for (const r in uc) if (pd[r]) l += (T[r] != null ? T[r] : r === 'e' ? 0.1 : 0.3) * uc[r] * pd[r] / 100;
    if (l > 0.25) quem.push([l, d]); L += l;
  }
  quem.sort((a, b) => b[0] - a[0]);
  return { s: 1 - Math.exp(-L / 4), quem: quem.slice(0, 3).map(x => x[1]) };
}
// sinergia total da carta com o tema e com o deck (cache por deck)
function sinergia(A: Analise, c: Carta) {
  const k = A._sinC || (A._sinC = {}); if (k[c.name]) return k[c.name];
  if (isLand(c)) return (k[c.name] = { s: 0, t: { s: 0, papel: '', rU: [] as any[], rP: [] as any[] }, d: { s: 0, quem: [] as any[] } });
  const S = temaSin(A), cmd = new Set(A.cmds.map(x => x.name));
  const nomes = A._sinNomes || (A._sinNomes = A.uniq.filter(x => !isLand(x) && !cmd.has(x.name)).map(x => x.name));
  const t = sinTema(c, S.T), d = sinDeck(c, nomes, S.T);
  return (k[c.name] = { s: t.s + d.s, t, d });
}
function sinTexto(A: Analise, c: Carta) {
  const x = sinergia(A, c), S = temaSin(A); if (!S.ks.length) return '';
  const parte = x.t.papel ? `${x.t.papel === 'motor' ? 'alimenta e consome' : x.t.papel === 'paga' ? 'paga por' : 'alimenta'} ${listPt([...new Set<string>(x.t.rU.concat(x.t.rP))].map(sinNome))}` : 'não conversa com o tema';
  return `Sinergia com o tema (${listPt(S.nomes)}): ${parte}${x.d.quem.length ? '; liga com ' + listPt(x.d.quem) : ''} (${fmtD(x.s, 2)})`;
}
// fila do Plano pelo TEMA (opção 1, escolhida pelo usuário em 20/11): a nota não pergunta mais o que o comandante quer.
// base 0,3 + 0,5 × sinergia (0 a 2,5) + o que fecha o jogo (ameaça, finalizador, metade de combo, tutor) − corpo sem nada
function efPlanoTema(A: Analise, c: Carta) {
  if (!c || isLand(c)) return 0; const rl = rolesOf(c), o = semLembrete(c), S = sinergia(A, c).s;
  let x = 0.3 + 0.5 * S;
  if (rl.has('wincon')) x += 0.4; else if (rl.has('threat')) x += /Planeswalker/.test(c.t.split(' // ')[0]) ? 0.15 : 0.4;
  if (['amplify', 'extra', 'copy'].some(k => rl.has(k))) x += 0.2;
  if (OVERRUN.test(o)) x += 0.4;
  if (comboPar(A, c)) x += 1.1;
  if (isTutor(c)) x += c.v <= 2 ? 0.5 : 0.3;
  if (S === 0 && (A.noRole.includes(c.name) || A.bodyOnly.includes(c.name))) x -= 0.2;
  return Math.max(0, Math.min(1.6, x));
}
// valor do deck = soma, em cada função, da efetividade de cada carta × o quanto o deck ainda precisa dela (retorno decrescente)
// + sinergia de cada carta com o tema e o deck. A troca é o par (sai, entra) que mais sobe esse valor.
function triangula(A: Analise, ctx: Dic) {
  const refs = (A.refs as Faixa[]).filter(r => r.k === 'lands' || EF_K.includes(r.k)).concat([{ k: 'plano', n: 'Plano (cartas do tema e ameaças)', lo: 30, hi: 48 }]);
  const P = perfilDeck(A), ataca = (A.plano && A.plano.atk) || P.bate >= 0.35;
  if (ataca && USA_CORPOS) refs.push(REF_CORPOS);
  const listas: Dic = {}; for (const r of refs) listas[r.k] = [];
  const corpo = (c: Carta) => { const f = c.t.split(' // ')[0]; if (!/Creature/.test(f)) return null; const pw = parseInt(c.p) || 0; return Math.max(0.3, Math.min(1.3, 0.5 + 0.15 * pw + (efeitos(c).haste ? 0.2 : 0) - 0.05 * Math.max(0, c.v - 4))); };
  // efetividade com teto (acima dele, mais rápida não soma) × (1 + PESO_SIN × sinergia), só nas funções básicas: a sinergia escolhe
  // QUAL carta ocupa cada vaga (qual ramp, qual remoção), mas a vaga continua passando pela faixa da função. A fila do plano
  // (30–48 cartas com peso cheio) fica sem multiplicador: lá a sinergia engolia remoção e limpa-mesa.
  const sinM = (c: Carta) => 1 + PESO_SIN * sinergia(A, c).s;
  const teto = (c: Carta, v: Dic<number>) => { const m = sinM(c); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.min(x, TETO_EF) * m])); };
  const efDe = (c: Carta) => isLand(c) ? { lands: TAPPED_RX(c) ? 0.9 : 1 } : Object.assign(isMdfcLand(c) ? { lands: 0.5 } : {}, teto(c, efetiv(A, c).v), efMax(A, c) >= 0.6 ? {} : { plano: efPlanoTema(A, c) }, ataca && USA_CORPOS && corpo(c) != null ? { corpos: corpo(c) } : {});
  const conta = (c: Carta, q: number) => { const e = efDe(c); for (const k in e) if (listas[k]) for (let i = 0; i < q; i++) listas[k].push(e[k]); };
  const qtd = deckCounts(A);
  for (const c of A.uniq) conta(c, qtd[c.name] || 1);
  const valorK = (k: string, arr: number[]) => { const r = refs.find(x => x.k === k); const s = arr.filter(x => x > 0).sort((a, b) => b - a); return PESO_K[k] * s.reduce((t, x, i) => t + x * precisa(r!, i), 0); };
  const tira = <T,>(arr: T[], x: T) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
  const plano: (c?: any) => number = () => 0;
  // ganho de trocar sai → entra (só as funções que mudam)
  const ganho = (sai: Carta, entra: Carta | null) => {
    const es = efDe(sai), ee = entra ? efDe(entra) : {}; let g = (entra ? plano(entra) : 0) - plano(sai); const det: any[] = [];
    for (const k of new Set([...Object.keys(es), ...Object.keys(ee)])) {
      if (!listas[k]) continue; const a = listas[k], b = a.slice(); if (es[k] != null) tira(b, es[k]); if (ee[k] != null) b.push(ee[k]);
      const d = valorK(k, b) - valorK(k, a); g += d; det.push([k, d]);
    }
    return { g, det };
  };
  const aplica = (sai: Carta, entra: Carta | null) => { const es = efDe(sai), ee = efDe(entra!); for (const k in es) if (listas[k]) tira(listas[k], es[k]); for (const k in ee) if (listas[k]) listas[k].push(ee[k]); };
  // quem pode sair: não-terrenos (menos travadas e já usadas) e, se sobra terreno, o terreno que menos falta faz
  const saiC = () => {
    const nl = A.uniq.filter((c: Carta) => !isLand(c) && !ctx.usedOut.has(c.name) && !(ctx.LOCK && ctx.LOCK.has(c.name))).map((c: Carta) => ({ c, ...ganho(c, null) })).sort((a, b) => b.g - a.g).slice(0, 18);
    const lr = refs.find(r => r.k === 'lands');
    if (lr) { const terra = ctx.terraQueSai(); if (terra) nl.push({ c: terra, ...ganho(terra, null) }); }
    return nl;
  };
  // quem pode entrar: cartas das cores com efetividade em alguma função ou que servem ao plano
  const inDeck = new Set(A.uniq.map((c: Carta) => c.name).concat(A.cmds.map((c: Carta) => c.name)));
  const pool: any[] = [];
  for (const name of Object.keys(DB.cards)) {
    if (inDeck.has(name)) continue; const c = C(name)!; if (c.ban || !c.r || isLand(c)) continue;
    if (!c.ci.split('').every(x => !x || A.ident.has(x))) continue; if (!addOk(A, c)) continue;
    // porta: carta de função básica só entra se faz a função direito; sem função básica, só se conversa com o tema (ou com o plano)
    const rl = rolesOf(c), temF = EF_K.some(k => rl.has(k));
    if (temF ? efMax(A, c) < PORTA_EF : !(sinTema(c, temaSin(A).T).s >= 0.6 || rl.has('wincon') || OVERRUN.test(semLembrete(c)))) continue;
    pool.push(c);
  }
  const out: any[] = [];
  for (let n = 0; n < ctx.max; n++) {
    const sais = saiC(); if (!sais.length) break;
    // pré-seleção: as 80 que mais somem com o deck como está
    const ent = pool.filter(c => !ctx.usedIn.has(c.name)).map(c => { const e = efDe(c); let g = plano(c); for (const k in e) if (listas[k]) { const b = listas[k].concat([e[k]]); g += valorK(k, b) - valorK(k, listas[k]); } return { c, g }; }).sort((a, b) => b.g - a.g).slice(0, 80);
    let best: any = null;
    for (const s of sais) for (const e of ent) {
      if (!ctx.cabe(e.c, s.c)) continue;
      const r = ganho(s.c, e.c); const g = r.g - 0.04 * Math.log10(1 + (e.c.usd || 0));
      if (!best || g > best.g) best = { sai: s.c, entra: e.c, g, det: r.det, corpoV: { [s.c.name]: corpo(s.c) || 0, [e.c.name]: corpo(e.c) || 0 } };
    }
    if (!best || best.g < 0.12) break;
    best.alts = ent.filter(x => x.c.name !== best.entra.name && ctx.cabe(x.c, best.sai)).map(x => ({ c: x.c, g: ganho(best.sai, x.c).g })).sort((a, b) => b.g - a.g).slice(0, 5).map(x => x.c.name);
    best.altsOut = sais.filter(x => x.c.name !== best.sai.name && !isLand(x.c)).sort((a, b) => b.g - a.g).slice(0, 4).map(x => x.c.name);
    best.cnt = Object.fromEntries(refs.map(r => [r.k, listas[r.k].length]));
    aplica(best.sai, best.entra); ctx.usedOut.add(best.sai.name); ctx.usedIn.add(best.entra.name);
    if (!ctx.aceita(best)) { ctx.usedOut.delete(best.sai.name); aplica(best.entra, best.sai); ctx.usedIn.add(best.entra.name); continue; }
    out.push(best);
  }
  return out;
}
// texto das trocas da triangulação
function textoTri(A: Analise, b: Dic) {
  const refOf = (k: string): Omit<Faixa, 'k'> | undefined => k === 'plano' ? { n: 'O plano (cartas do tema e ameaças)', lo: 30, hi: 48 } : k === 'corpos' ? REF_CORPOS : A.refs.find(r => r.k === k);
  const pior = b.det.filter(([, d]: [string, number]) => d < 0).sort((x: [string, number], y: [string, number]) => x[1] - y[1])[0], melhor = b.det.filter(([, d]: [string, number]) => d > 0).sort((x: [string, number], y: [string, number]) => y[1] - x[1])[0];
  const efS = efetiv(A, b.sai), efE = efetiv(A, b.entra), vpS = valorPlano(A, b.sai), vpE = valorPlano(A, b.entra);
  const wP = (c: Carta) => { const x = sinergia(A, c); return x.t.papel ? `${x.t.papel === 'motor' ? 'alimenta e consome' : x.t.papel === 'paga' ? 'paga por' : 'alimenta'} ${listPt([...new Set<string>(x.t.rU.concat(x.t.rP))].map(sinNome))}` : rolesOf(c).has('threat') || rolesOf(c).has('wincon') ? 'é ameaça' : 'faz pouco pelo tema do deck'; };
  // @ts-ignore T43 (c): wP ignora o 2º argumento
  const ev = (k, c, e) => k === 'plano' ? efPlanoTema(A, c) : k === 'corpos' ? (b.corpoV || {})[c.name] || 0 : (e.v[k] || 0), ew = (k, c, e, vp) => k === 'plano' ? wP(c, vp) : k === 'corpos' ? `é criatura de poder ${c.p || 0}` : (e.why[k] || 'efeito fraco');
  const faixa = (k: string) => { const r = refOf(k); return r ? `${r.n} está em ${fmt(b.cnt[k])} (faixa ${r.lo}–${r.hi})` : ''; };
  let whyOut;
  if (isLand(b.sai)) whyOut = `${faixa('lands')}: um terreno a mais rende pouco; ${TAPPED_RX(b.sai) ? 'este entra virado' : 'é um básico de uma cor que tem fontes de sobra'}.`;
  else if (pior) whyOut = `${faixa(pior[0])}. Entre elas, esta é das que menos rendem: ${ew(pior[0], b.sai, efS, vpS)} (efetividade ${fmtD(ev(pior[0], b.sai, efS))}).`;
  else whyOut = `Não cumpre nenhuma função básica do deck.`;
  let whyIn = melhor ? `${faixa(melhor[0])}. Esta: ${ew(melhor[0], b.entra, efE, vpE)} (efetividade ${fmtD(ev(melhor[0], b.entra, efE))}).` : '';
  const outras = Object.keys(efE.v).filter(k => !melhor || k !== melhor[0]).map(k => (refOf(k) || <Partial<Faixa>>{}).n).filter(Boolean) as string[];
  if (outras.length) whyIn += ` Também conta como ${listPt(outras.map(x => x.toLowerCase()))}.`;
  whyIn += ` Ganho da troca: +${fmtD(b.g, 2)}.`;
  const goal = melhor ? (<Dic<string>>{ corpos: 'Criaturas', plano: 'Cartas do tema', ramp: 'Ramp', draw: 'Compra de cartas', removal: 'Remoção pontual', wipe: 'Limpa-mesa', protect: 'Proteção', counter: 'Contramágica' })[melhor[0]] || 'Efetividade' : 'Plano do comandante';
  // sinergia com o tema: entra no texto das duas cartas; se foi ela que mais pesou, vira o motivo da troca
  const sS = sinergia(A, b.sai), sE = sinergia(A, b.entra), dS = sE.s - sS.s;
  const goal2 = dS >= 1 && (!melhor || melhor[0] === 'plano' || pior && pior[0] === melhor[0]) ? 'Sinergia com o tema' : goal;
  const tS = sinTexto(A, b.sai), tE = sinTexto(A, b.entra);
  return { goal: goal2, whyOut: whyOut.replace(/\.$/, '') + (tS ? '. ' + tS : ''), whyIn: (whyIn.trim() + (tE ? ' ' + tE + '.' : '')).trim() };
}

function cutScore(A: Analise, c: Carta, needRoles: Set<string>) {
  if (isLand(c)) return -1e9;
  const roles = rolesOf(c); const real = [...roles].filter(k => k !== 'body');
  let s = 0;
  if (comboPar(A, c)) s -= 60; // metade de um laço que ganha o jogo: não sai
  if (isTutor(c)) s -= 25; // tutor vira a peça que falta
  if (A.noRole.includes(c.name)) s += 50;
  if (A.bodyOnly.includes(c.name)) s += 35;
  const fit = conceptFit(A, c);
  if (fit !== null) s += ({ seguir: fit ? -25 : 12, preferir: fit ? -12 : 6, so: fit ? -60 : 20 })[CONC.mode] || 0;
  if (!A.cmdSupport.includes(c.name)) s += 12;
  if (A.edh) s += 40 - 70 * edhNota(A.edh, c); // com o EDHREC: fica o que tem sinergia com a ideia ou é muito jogado nessas cores (antes: popularidade geral)
  else s += 25 - 22 * Math.max(efMax(A, c), efPlano(A, c)); // sem dados de fora: fica o que é efetivo na função (antes: popularidade)
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
function whyCut(A: Analise, c: Carta) {
  const bits: any[] = [];
  if (A.noRole.includes(c.name)) bits.push('não tem função clara nem conversa com os temas do deck');
  else if (A.bodyOnly.includes(c.name)) bits.push('é só um corpo, sem habilidade que importe para o plano');
  else if (!A.cmdSupport.includes(c.name)) bits.push('não puxa para o tema do comandante');
  if (!c.r || c.r > 12000) bits.push('quase ninguém joga com ela no Commander');
  if (A.avgMV > 3.6 && c.v >= 5) bits.push(`custa ${c.v} numa lista que já está pesada`);
  const vp = valorPlano(A, c); if (vp.v < 0) bits.unshift(...vp.why);
  if (!bits.length) bits.push('é das que menos contribuem entre as que sobram');
  return bits.join('; ');
}
// sem preço conhecido no Scryfall (nem na impressão mais barata): não pode passar por filtro de orçamento como se fosse de graça
const semPreco = (c: Carta) => !c.usd && !/Basic/.test(c.t || '');
// carta pode entrar? (bracket alvo e teto por carta)
function addOk(A: Analise, c: Carta) {
  if (!A._tgt) return true;
  if ((c.usd || 0) > A._capCard) return false;
  if (semPreco(c) && (A._capCard < Infinity || A._capDeck < Infinity)) return false; // com orçamento, carta sem preço não entra (não é de graça)
  if (c.gc && !A._gcOk) return false;
  if (A._tgt < 4 && c.tags.includes('mass-land-denial')) return false;
  if (A._tgt < 3 && c.tags.includes('extra-turn')) return false;
  if (A._tgt < 3 && isTutor(c)) return false;
  return true;
}
function rankAdds(A: Analise, list: Carta[]) {
  const cmdTh = A.cmdThemes;
  return list.filter((c: Carta) => addOk(A, c)).map((c: Carta) => { const th = [...themesOf(c, cmdTh)].some(t => cmdTh.has(t)); let s = (1 + (c.r || 1e5) / 1e5) * Math.exp(-2.5 * efMax(A, c)); if (th) s *= 0.45; if (c.v > Math.max(3, A.avgMV + 1)) s *= 1.6; const fit = conceptFit(A, c); if (fit) s *= ({ seguir: 0.4, preferir: 0.7, so: 0.4 })[CONC.mode] || 1; if (A._capDeck < Infinity && c.usd > 1) s *= 1 + Math.min(3, c.usd / 10); const vp = valorPlano(A, c).v; s *= Math.exp(-0.45 * vp); if (A.edh) s *= Math.exp(-2.5 * edhNota(A.edh, c)); return { c, s, th, fit, vp }; }).filter(x => !(A.plano && A.plano.ativo && x.vp <= -1.5)).filter(x => !(CONC.mode === 'so' && x.fit === false)).sort((a, b) => a.s - b.s);
}
function addPool(A: Analise, test: (c: Carta) => boolean, n = 30) {
  const inDeck = new Set(A.uniq.map((c: Carta) => c.name).concat(A.cmds.map((c: Carta) => c.name)));
  const out: any[] = [];
  for (const name of Object.keys(DB.cards)) {
    if (inDeck.has(name)) continue;
    const c = C(name)!; if (c.ban || !c.r) continue;
    if (!c.ci.split('').every(x => !x || A.ident.has(x))) continue;
    if (!test(c)) continue; out.push(c);
  }
  return out.sort((a, b) => a.r - b.r).slice(0, n);
}
// temas da ideia nas trocas: os chips/texto da ideia; sem ideia, os temas que o comandante pede (lidos do texto)
function temasTroca(A: Analise) { const on = new Set(concOn(A)); if (!on.size) for (const t of A.cmdThemes) if (EDH_TEMA[t]) on.add(t); if (A.tribe && (on.has('tribe') || A.plano && A.plano.tribo)) on.add('tribe'); return on; }
function buildSwaps(A: Analise) {
  A._concOn = null;
  A.edh = edhIdeia(temasTroca(A), A.ident, A.tribe && A.tribe![0]);
  if (A.edh.carrega) A.edh.carrega.then(() => { if (LAST === A) rerenderTrocas(A); });
  if (!A.edh.pags.length) A.edh = null;
  A._concOn = concOn(A); A._testBad = [];
  A._tgt = +CONC.br || A.bracket; A._gcMax = (<Dic<number>>{ 1: 0, 2: 0, 3: 3, 4: 99 })[A._tgt];
  A._gcOk = A.gc.length < A._gcMax; A._capCard = toUsd(+CONC.tetoCarta); A._capDeck = toUsd(+CONC.teto);
  let PRICE = A.price, GC = A.gc.length;
  const usd = (n: string) => (C(n) || <Partial<Carta>>{}).usd || 0;
  const cabe = (inC: Carta, outC: Carta | null) => (!inC.gc || A._gcOk || (outC && outC.gc)) && !(semPreco(inC) && (A._capDeck < Infinity || A._capCard < Infinity)) && (A._capDeck === Infinity || (inC.usd || 0) <= (outC ? outC.usd || 0 : 0) || PRICE + (inC.usd || 0) - (outC ? outC.usd || 0 : 0) <= A._capDeck);
  const LOCK = new Set(resolveNames(CONC.lock).ok);
  const swaps: any[] = []; const usedOut = new Set(LOCK), usedIn = new Set();
  const needRoles = new Set(A.refs.filter(r => r.k !== 'lands' && r.have < r.lo).map(r => r.k));
  const cutsAll = A.uniq.filter((c: Carta) => !isLand(c)).map((c: Carta) => ({ c, s: cutScore(A, c, needRoles) })).sort((a, b) => b.s - a.s);
  const nextCut = (avoid?: (c: Carta) => boolean) => cutsAll.find(x => !usedOut.has(x.c.name) && x.s > -20 && !(avoid && avoid(x.c)));
  const MAX = (CONC.br || CONC.teto || CONC.tetoCarta) ? 26 : 16;
  // juiz pela ideia (EDHREC, decks do tema nessas cores): troca por faixa de função (ramp alto, remoção baixa, terrenos, foco)
  // não tira carta claramente mais ligada à ideia (ou mais jogada nessas cores) do que a que entra. Regras duras (bracket, preço, cores, teste pedido) passam.
  const DURA = new Set(['Seu teste', 'Nível de poder', 'Preço', 'Base de mana']);
  const push = (sw: Troca) => { if (swaps.length >= MAX) return false;
    if (A.edh && !DURA.has(sw.goal) && edhNota(A.edh, C(sw.inn)!) < edhNota(A.edh, C(sw.out)!) - 0.2) { (A._vetoEdh = A._vetoEdh || []).push(sw.out + ' → ' + sw.inn); return false; } swaps.push(sw); usedOut.add(sw.out); usedIn.add(sw.inn); PRICE += usd(sw.inn) - usd(sw.out); const ci = C(sw.inn), co = C(sw.out); GC += (ci && ci.gc ? 1 : 0) - (co && co.gc ? 1 : 0); A._gcOk = GC < A._gcMax; return true; };
  const altsCut = (avoidFn?: (c: Carta) => boolean) => cutsAll.filter(x => !usedOut.has(x.c.name) && x.s > -20 && !(avoidFn && avoidFn(x.c))).slice(0, 4).map(x => x.c.name);
  const label: Dic<string> = { ramp: 'Ramp', draw: 'Compra de cartas', removal: 'Remoção pontual', wipe: 'Limpa-mesa', protect: 'Proteção', counter: 'Contramágica' };

  // 1) equilíbrio das funções: o que sobra (terrenos, ramp, proteção acima da faixa) paga o que falta
  const lr = A.refs.find(r => r.k === 'lands');
  const refOf = (k: string) => A.refs.find(r => r.k === k);
  const cnt = Object.fromEntries(A.refs.map(r => [r.k, r.have]));
  const realRoles = (c: Carta) => [...rolesOf(c)].filter(k => k !== 'lands' && refOf(k));
  const mid = (r: Ref) => (r.lo + r.hi) / 2;
  const pos = (r: Ref) => (cnt[r.k] - r.lo) / Math.max(1, r.hi - r.lo);
  const pools: Dic<ReturnType<typeof rankAdds>> = {};
  const poolFor = (k: string) => pools[k] || (pools[k] = rankAdds(A, suggestions(A, k, 40)));
  const demand = () => {
    const gaps = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] < r.lo).sort((a, b) => pos(a) - pos(b));
    if (gaps.length) return { r: gaps[0], gap: true };
    const low = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] < mid(r) - 0.5).sort((a, b) => pos(a) - pos(b));
    return low.length ? { r: low[0], gap: false } : null;
  };
  // tirar a carta não pode derrubar outra função para baixo da faixa
  const safeOut = (c: Carta) => realRoles(c).every(k => cnt[k] - 1 >= refOf(k)!.lo);
  const pickSurplus = () => {
    if (lr && cnt.lands > lr.hi) {
      const tapped = A.uniq.filter((c: Carta) => isLand(c) && !/Basic/.test(c.t) && TAPPED_RX(c) && !usedOut.has(c.name));
      const ident0 = [...A.ident]; const sur = (x: string) => A.sources[x] - A.colorNeed[x];
      const basics = A.uniq.filter((c: Carta) => /Basic Land/.test(c.t) && !usedOut.has(c.name)).sort((a, b) => sur(b.pm.replace(/[^WUBRG]/g, '')[0]) - sur(a.pm.replace(/[^WUBRG]/g, '')[0]));
      const c = tapped[0] || basics[0] || (ident0.length ? null : null);
      if (c) return { c, k: 'lands', why: `o deck tem ${fmt(cnt.lands)} terrenos e a curva pede ${lr.lo}–${lr.hi}${TAPPED_RX(c) ? '; este ainda entra virado' : '; é um básico de uma cor que já tem fontes de sobra'}` };
    }
    const sur = A.refs.filter(r => r.k !== 'lands' && cnt[r.k] > r.hi).sort((a, b) => (cnt[b.k] - b.hi) / (b.hi - b.lo) - (cnt[a.k] - a.hi) / (a.hi - a.lo));
    for (const r of sur) {
      const cands = ((A.byRole[r.k] || []).map(([n]) => C(n)) as Carta[]).filter((c: Carta) => c && !isLand(c) && !usedOut.has(c.name) && !c.gc && safeOut(c))
        .map((c: Carta) => ({ c, s: cutScore(A, c, new Set()) + (r.k === 'ramp' ? 6 * c.v : 0) + 6 * realRoles(c).filter(k => k === r.k).length })).sort((a, b) => b.s - a.s);
      if (cands.length) { const c = cands[0].c; return { c, k: r.k, why: `${r.n} está em ${fmt(cnt[r.k])}, acima da faixa ${r.lo}–${r.hi}; ${r.k === 'ramp' && c.v >= 3 ? `esta custa ${c.v}, e ramp barato rende mais` : 'esta é das que menos rendem entre elas'}` }; }
    }
    return null;
  };
  const pickGeneric = () => { const x = cutsAll.find(x => !usedOut.has(x.c.name) && x.s > -20 && safeOut(x.c)); return x ? { c: x.c, k: null, why: whyCut(A, x.c) } : null; };
  const thList = THEMES.filter(t => A.cmdThemes.has(t.k));
  const themePool = thList.length ? rankAdds(A, addPool(A, (c: Carta) => !isLand(c) && thList.some(t => t.rx.test(c.o) || (t.type && t.type.test(c.t))), 40)) : [];
  // cartas que você quer testar entrando: cada uma vira uma troca
  const inDeckN = new Set(A.uniq.map((c: Carta) => c.name).concat(A.cmds.map((c: Carta) => c.name)));
  for (const name of resolveNames(CONC.test).ok) {
    const n = C(name); if (!n || inDeckN.has(name) || usedIn.has(name)) continue;
    if (!n.ci.split('').every(x => !x || A.ident.has(x))) { (A._testBad = A._testBad || []).push(name); continue; }
    const cut = pickSurplus() || pickGeneric(); if (!cut) break;
    const rn = roleNames(n);
    push({ goal: 'Seu teste', out: cut.c.name, inn: name, whyOut: cut.why, whyIn: `Você pediu para testar. ${rn.length ? 'Ela traz ' + listPt(rn.map(x => x.toLowerCase())) + '.' : ''}${conceptFit(A, n) ? ' Encaixa na ideia do deck.' : ''}`, alts: [] as any[], altsOut: altsCut().filter(x => x !== cut.c.name).slice(0, 4) });
    if (cut.k === 'lands') cnt.lands--; else realRoles(cut.c).forEach(k => cnt[k]--);
    realRoles(n).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; });
  }
  // 0a) bracket alvo menor: sai o que o bracket não permite, entra carta da mesma função
  const subst = (c: Carta, extra?: (c: Carta) => boolean) => {
    const rs = realRoles(c);
    for (const k of rs) { const add = poolFor(k).find(x => !usedIn.has(x.c.name) && !(extra && !extra(x.c)) && cabe(x.c, c)); if (add) return { add, k }; }
    const add = themePool.find(x => !usedIn.has(x.c.name) && !isLand(x.c) && !(extra && !extra(x.c)) && cabe(x.c, c)); return add ? { add, k: null } : null;
  };
  const roleTxt = (k: string | null) => (k ? (label[k] || (ROLES.find(r => r.k === k) || {}).n || '').toLowerCase() : 'o tema do comandante');
  const nivel: any[] = [];
  const naoTrava = (c: Carta) => !LOCK.has(c.name) && !usedOut.has(c.name);
  if (A._tgt < A.bracket || A.gc.length > A._gcMax) {
    const gcs = A.uniq.filter((c: Carta) => c.gc && naoTrava(c)).sort((a, b) => cutScore(A, b, new Set()) - cutScore(A, a, new Set()));
    gcs.slice(0, Math.max(0, A.gc.length - A._gcMax)).forEach((c: Carta) => nivel.push([c, `é uma das "game changers"; o Bracket ${A._tgt} ${A._gcMax ? `aceita no máximo ${A._gcMax}` : 'não aceita nenhuma'} e o deck tem ${A.gc.length}`]));
  }
  if (A._tgt < 4) A.uniq.filter((c: Carta) => c.tags.includes('mass-land-denial') && naoTrava(c)).forEach((c: Carta) => nivel.push([c, `destrói terrenos em massa, o que só cabe no Bracket 4`]));
  if (A._tgt < 3) {
    A.uniq.filter((c: Carta) => c.tags.includes('extra-turn') && naoTrava(c)).slice(A.extraTurns.length >= 2 ? 0 : 99).forEach((c: Carta) => nivel.push([c, `turnos extras em sequência sobem o deck para o Bracket 3`]));
    const tut = A.tutorCards.filter((c: Carta) => naoTrava(c) && !c.gc).sort((a: Carta, b: Carta) => (b.r || 1e6) - (a.r || 1e6));
    tut.slice(0, Math.max(0, A.tutors - 3)).forEach((c: Carta) => nivel.push([c, `o deck tem ${A.tutors} tutores; no Bracket ${A._tgt} o comum é até 3`]));
  }
  for (const [c, why] of nivel) {
    if (usedOut.has(c.name)) continue;
    const r = subst(c, (x: Carta) => !isLand(x) && (!isTutor(x) || A._tgt >= 3)); if (!r) continue;
    push({ goal: 'Nível de poder', out: c.name, inn: r.add.c.name, whyOut: why, whyIn: `Cobre ${roleTxt(r.k)} sem passar do Bracket ${A._tgt}${r.add.c.usd ? `, por ${brlTxt(r.add.c.usd)}` : ''}.`, alts: (r.k ? poolFor(r.k) : themePool).filter(x => !usedIn.has(x.c.name) && x.c.name !== r.add.c.name && cabe(x.c, c)).slice(0, 5).map(x => x.c.name), altsOut: [] as any[] });
    realRoles(r.add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; }); realRoles(c).forEach(k => cnt[k]--);
  }
  // 0b) bracket alvo maior: entram game changers das suas cores, até o limite do bracket
  if (CONC.br && A._tgt > A.bracket && A._gcOk) {
    const quer = Math.min(A._gcMax - GC, A._tgt >= 4 ? 4 : 3);
    const gcPool = rankAdds(A, addPool(A, (c: Carta) => c.gc && !isLand(c), 40));
    for (let i = 0; i < quer; i++) {
      const cut = pickSurplus() || pickGeneric(); if (!cut) break;
      const add = gcPool.find(x => !usedIn.has(x.c.name) && cabe(x.c, cut.c)); if (!add) break;
      const rn = roleNames(add.c);
      push({ goal: 'Nível de poder', out: cut.c.name, inn: add.c.name, whyOut: cut.why, whyIn: `É uma das "game changers" mais jogadas nas suas cores${rn.length ? ` (${listPt(rn.map(x => x.toLowerCase()))})` : ''}: o tipo de carta que leva o deck ao Bracket ${A._tgt}.`, alts: gcPool.filter(x => !usedIn.has(x.c.name) && x.c.name !== add.c.name && cabe(x.c, cut.c)).slice(0, 5).map(x => x.c.name), altsOut: [] as any[] });
      if (cut.k === 'lands') cnt.lands--; else realRoles(cut.c).forEach(k => cnt[k]--);
      realRoles(add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; });
    }
  }
  // 0c) preço: carta acima do teto por carta sai; se o deck passa do orçamento, as mais caras saem por outras da mesma função
  if (A._capCard < Infinity || A._capDeck < Infinity) {
    const caras = A.uniq.filter((c: Carta) => (c.usd || 0) > 1 && naoTrava(c)).sort((a, b) => b.usd - a.usd);
    for (const c of caras) {
      if (usedOut.has(c.name)) continue;
      const acima = c.usd > A._capCard; if (!acima && PRICE <= A._capDeck) break;
      let r: any = null;
      if (isLand(c)) {
        const cores = c.pm.replace(/[^WUBRG]/g, '');
        const basicos: Dic<string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
        const terras = rankAdds(A, addPool(A, (l: Carta) => isLand(l) && !/Basic/.test(l.t) && (l.usd || 0) < c.usd * 0.5 && [...cores].every(x => l.pm.includes(x)), 30)).filter(x => !usedIn.has(x.c.name));
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
      if (!push({ goal: 'Preço', out: c.name, inn: r.add.c.name, whyOut: tetoTxt, whyIn: `Faz ${r.k === 'lands' ? 'o papel de terreno' : 'o mesmo papel (' + roleTxt(r.k) + ')'} por ${brlTxt(r.add.c.usd, 1)}, uma economia de ${brlTxt(c.usd - (r.add.c.usd || 0))}.`, alts: r.alts, altsOut: [] as any[] })) break;
      if (r.k !== 'lands') { realRoles(c).forEach(k => cnt[k]--); realRoles(r.add.c).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; }); }
    }
  }
  // 1b) triangulação (20/11/2026): falta × sobra, pela efetividade de cada carta em cada função; o par de maior ganho vira troca
  const terraQueSai = () => {
    if (!lr || cnt.lands <= lr.lo) return null;
    const tapped = A.uniq.filter((c: Carta) => isLand(c) && !/Basic/.test(c.t) && TAPPED_RX(c) && !usedOut.has(c.name) && !LOCK.has(c.name));
    const sur = (x: string) => (x in A.sources ? A.sources[x] - A.colorNeed[x] : -99);
    const basics = A.uniq.filter((c: Carta) => /Basic Land/.test(c.t) && !usedOut.has(c.name)).sort((a, b) => sur(b.pm.replace(/[^WUBRG]/g, '')[0]) - sur(a.pm.replace(/[^WUBRG]/g, '')[0]));
    return tapped[0] || basics[0] || null;
  };
  const tri = triangula(A, { max: 10, usedOut, usedIn, LOCK, cabe, terraQueSai, aceita: (b: Dic) => { const t = textoTri(A, b); return push({ goal: t.goal, out: b.sai.name, inn: b.entra.name, whyOut: t.whyOut, whyIn: t.whyIn, alts: b.alts, altsOut: b.altsOut, ganho: b.g }); } });
  for (const b of tri) { if (isLand(b.sai)) cnt.lands--; else realRoles(b.sai).forEach(k => cnt[k]--); realRoles(b.entra).forEach(k => { if (cnt[k] < 1e8) cnt[k]++; }); }
  A._tri = tri.length;

  // 2) cores com poucas fontes: um básico da cor que sobra sai, um terreno que faz a cor que falta entra
  const ident = [...A.ident]; const src = Object.assign({}, A.sources);
  if (ident.length >= 2) {
    const short = ident.filter(x => A.pips[x] >= 1 && src[x] < A.colorNeed[x]).sort((a, b) => (src[a] - A.colorNeed[a]) - (src[b] - A.colorNeed[b]));
    const surplus = (x: string) => (x in src ? src[x] - A.colorNeed[x] : -99);
    for (const x of short) {
      const k = Math.min(3, A.colorNeed[x] - src[x]);
      // @ts-ignore T43 (c): TAPPED_RX devolve booleano: ordena terreno desvirado primeiro
      const lands = rankAdds(A, addPool(A, c => isLand(c) && !/Basic/.test(c.t) && c.pm.includes(x) && c.pm.replace(/[^WUBRG]/g, '').length >= 2, 40)).sort((a, b) => (TAPPED_RX(a.c) - TAPPED_RX(b.c)) || a.s - b.s);
      for (let i = 0; i < k; i++) {
        const add = lands.find(l => !usedIn.has(l.c.name) && cabe(l.c, null)); if (!add) break;
        const basics = A.uniq.filter((c: Carta) => /Basic Land/.test(c.t) && !usedOut.has(c.name) && !c.pm.includes(x)).sort((a, b) => surplus(b.pm.replace(/[^WUBRG]/g, '')[0]) - surplus(a.pm.replace(/[^WUBRG]/g, '')[0]));
        const tappedL = A.uniq.filter((c: Carta) => isLand(c) && !/Basic/.test(c.t) && TAPPED_RX(c) && !c.pm.includes(x) && !usedOut.has(c.name));
        const cut = basics[0] || tappedL[0]; if (!cut) break;
        const alts = lands.filter(l => !usedIn.has(l.c.name) && l.c.name !== add.c.name).slice(0, 5).map(l => l.c.name);
        if (!push({ goal: 'Base de mana', out: cut.name, inn: add.c.name, whyOut: /Basic/.test(cut.t) ? `é um básico de uma cor que já tem fontes de sobra` : 'entra virado e não faz a cor que falta', whyIn: `${COLORNAME[x]}: ${src[x]} fontes para ${A.pips[x].toFixed(0)} símbolos; o recomendado é ${A.colorNeed[x]}. Este terreno faz ${COLORNAME[x].toLowerCase()} e mais uma cor${TAPPED_RX(add.c) ? '' : ', sem entrar virado'}.`, alts, altsOut: [] as any[] })) break;
        src[x]++; // conta a troca para não pedir a mesma cor de novo
      }
    }
  }

  // 3b) terrenos de menos
  if (lr && cnt.lands < lr.lo) {
    const k = Math.min(3, Math.ceil(lr.lo - lr.have));
    const lands = rankAdds(A, addPool(A, (c: Carta) => isLand(c) && !/Basic/.test(c.t) && !TAPPED_RX(c) && (ident.length < 2 ? true : c.pm.replace(/[^WUBRG]/g, '').length >= 2), 40));
    for (let i = 0; i < k; i++) {
      const cut = nextCut(); const add = cut && lands.find(l => !usedIn.has(l.c.name) && cabe(l.c, cut.c)); if (!add || !cut) break;
      push({ goal: 'Terrenos', out: cut.c.name, inn: add.c.name, whyOut: whyCut(A, cut.c), whyIn: `O deck tem ${fmt(lr.have)} terrenos e a curva pede ${lr.lo}–${lr.hi}. Com menos que isso a mão inicial trava com frequência.`, alts: lands.filter(l => !usedIn.has(l.c.name) && l.c.name !== add.c.name).slice(0, 5).map(l => l.c.name), altsOut: altsCut().filter(n => n !== cut.c.name).slice(0, 4) });
    }
  }

  return swaps;
}

let SWAPS: Troca[] = [], SWAP_ON: boolean[] = [];
function swapBox(name: string, tag: string) {
  const c = C(name); if (!c) return '';
  const ia = window.PAPEIS_IA && window.PAPEIS_IA[c.name];
  const roles = [...rolesOf(c)].filter(k => k !== 'body').map(k => ROLES.find(r => r.k === k)!.n).slice(0, 3);
  return `<div class="cbox"><span class="ctag ${tag === 'SAI' ? 'out' : 'in'}">${tag}</span><div class="cimg" data-swimg="${esc(name)}"><span class="note">…</span></div>
    <div><button class="cn" data-card="${esc(name)}"><b>${esc(name)}</b></button><div style="margin-top:4px">${manaHTML(c.m)} <span class="note">${esc(c.t)}</span></div>
    ${ia && ia.r ? `<p class="note" style="margin:6px 0 0">${esc(ia.r)}</p>` : ''}
    <div class="chips" style="margin-top:6px">${roles.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
    <p class="note" style="margin:6px 0 0">${c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas` : 'Quase não aparece em decks de Commander'}${c.usd ? ` · ${brl(c.usd, 1)} ${temMyp(c.name) ? `no ${fonteMyp()}` : '(Scryfall convertido)'}` : ''}</p></div></div>`;
}
// por que esta carta no lugar daquela: comparação direta das duas
function roleNames(c: Carta): string[] { return [...rolesOf(c)].filter(k => k !== 'body' && k !== 'enabler').map(k => (ROLES.find(r => r.k === k) || <Partial<typeof ROLES[number]>>{}).n).filter(Boolean) as string[]; }
function listPt(a: string[]) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
function compareText(A: Analise, s: Troca) {
  const o = C(s.out), n = C(s.inn); if (!o || !n) return '';
  const ia = window.PAPEIS_IA || {};
  const lo = roleNames(o).map(x => x.toLowerCase()), ln = roleNames(n).map(x => x.toLowerCase());
  const out: any[] = [];
  const front = (c: Carta) => c.o.split('\n//\n')[0];
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
  if (isLand(n)) { const cols = n.pm.replace(/[^WUBRG]/g, '').split('').filter((x: string) => A.ident.has(x)); if (cols.length) out.push(`Faz ${listPt(cols.map((x: string) => COLORNAME[x].toLowerCase()))}${TAPPED_RX(n) ? '' : ' e entra desvirado'}.`); }
  if (!isLand(n) && !isLand(o)) {
    if (n.v < o.v) out.push(`Custa ${o.v - n.v} a menos (${n.v} contra ${o.v}), então chega mais cedo na partida.`);
    else if (n.v > o.v + 1) out.push(`Custa ${n.v - o.v} a mais, mas cobre um buraco que a outra não cobre.`);
  }
  const th = [...themesOf(n, A.cmdThemes)].filter(t => A.cmdThemes.has(t)).map(t => THEMES.find(x => x.k === t)!.n.toLowerCase());
  if (th.length) out.push(`De quebra, conversa com ${listPt(th)}, o tema do comandante.`);
  // o que se perde
  if (isLand(o)) out.push(`Você perde um terreno ${/Basic/.test(o.t) ? 'básico' : ''} que estava sobrando.`.replace('  ', ' '));
  else if (lo.length) {
    const keep = [...rolesOf(o)].filter(k => k !== 'body' && k !== 'enabler').map(k => { const r = A.refs.find(x => x.k === k); const have = (A.byRole[k] || []).reduce((p, [, q]) => p + q, 0); return r ? `${r.n.toLowerCase()} fica em ${fmt(have - 1)}` : null; }).filter(Boolean) as string[];
    out.push(`Em troca, sai ${o.name}, que dava ${listPt(lo)}${keep.length ? `; mesmo sem ela, ${listPt(keep)}` : ''}.`);
  } else out.push(`Em troca, sai ${o.name}, que ${ia[o.name] && ia[o.name].r ? 'hoje ' + ia[o.name].r.replace(/\.$/, '').toLowerCase().replace(/^([a-zà-ú])/, (m: string) => m) : 'não cumpre nenhuma função clara no deck'}.`);
  if (n.r && (!o.r || n.r < o.r / 3)) out.push(`Ela também aparece em muito mais decks de Commander (nº ${n.r.toLocaleString('pt-BR')} entre as mais jogadas${o.r ? `, contra nº ${o.r.toLocaleString('pt-BR')}` : ''}), sinal de que a comunidade acha que rende mais.`);
  return out.join(' ');
}

// o que a troca faz pelo plano do comandante (lido do texto das duas cartas)
const USA_CMD = false; // 20/11: as trocas seguem só o tema; o plano do comandante sai da tela (volta pondo true)
function planoTroca(A: Analise, s: Troca) {
  if (!USA_CMD) return '';
  const P = A.plano; if (!P || !P.ativo) return '';
  const pi = valorPlano(A, C(s.inn)!), po = valorPlano(A, C(s.out)!);
  const bits: any[] = [];
  if (pi.why.length) bits.push(`${s.inn}: ${pi.why.join('; ')}`);
  if (po.why.length) bits.push(`${s.out}: ${po.why.join('; ')}`);
  if (!bits.length) return '';
  const d = pi.v - po.v, tom = d >= 1 ? 'adianta o plano' : d <= -1 ? 'atrasa o plano (só faça se a função que falta pesar mais)' : 'quase neutra para o plano';
  return `<dt>Pelo plano de ${esc(P.nome)}</dt><dd>${esc(bits.join('. '))}. <b>Troca ${tom}.</b></dd>`;
}
function edhTroca(A: Analise, s: Troca) {
  if (!A.edh) return '';
  const temas = A.edh!.pags.map(p => EDH_TEMA_N(p.k, A.edh!.tribo)).join(' / ');
  const f = (n: string) => { const x = edhCarta(A.edh, C(n)!); return x ? `${Math.round(100 * x.inc)}% dos decks do tema contra ${Math.round(100 * x.base)}% em geral (sinergia ${x.syn >= 0 ? '+' : ''}${Math.round(100 * x.syn)}%)` : 'não aparece nas listas do tema'; };
  const d = edhNota(A.edh, C(s.inn)!) - edhNota(A.edh, C(s.out)!);
  const tom = d >= 0.12 ? 'serve mais à ideia' : d <= -0.12 ? 'a que sai serve mais à ideia: só faça se a função que falta pesar mais' : 'empate para a ideia';
  return `<dt>Sinergia com a ideia (EDHREC, decks ${esc(temas)} ${esc(A.edh.cor)})</dt><dd>${esc(s.inn)}: ${f(s.inn)}. ${esc(s.out)}: ${f(s.out)}. <b>Troca ${tom}.</b></dd>`;
}
function edhBox(A: Analise) {
  const nome = A.plano ? A.plano.nome : 'o comandante';
  const cm = EDH_LIGADO && A.cmds.length ? edhJa(edhCmdCam(A.cmds.map((c: Carta) => c.name))) : null;
  const bits: any[] = [];
  if (A.edh) bits.push(`A sinergia de cada troca é medida contra a sua ideia: decks ${A.edh!.pags.map(p => EDH_TEMA_N(p.k, A.edh!.tribo)).join(', ')} ${A.edh.cor} no EDHREC (quanto a carta aparece neles a mais que nos decks dessas cores em geral).`);
  if (cm && cm.tags.length) bits.push(`Só para comparar, no EDHREC quem joga ${nome} costuma ir de: ${cm.tags.map(([t, n]: [string, number]) => `${t} (${n.toLocaleString('pt-BR')})`).join(', ')}. Isso não muda as trocas.`);
  return bits.length ? `<p class="note">${esc(bits.join(' '))}</p>` : '';
}
function planoBox(A: Analise) {
  if (!USA_CMD) return '';
  const P = A.plano; if (!P || !P.ativo || !P.quer.length) return edhBox(A);
  const o = P.goad ? `${P.nome} vence fazendo os oponentes se atacarem enquanto você fica protegido` : P.voltron ? `${P.nome} vence atacando e carregando auras e equipamentos` : `${P.nome} vence atacando`;
  return `<div class="plano-box"><b>O plano de ${esc(P.nome)}</b><p>${esc(o)}. Cada turno que ele demora a entrar ou a atacar armado custa a partida. As trocas abaixo protegem e procuram o que adianta isso:</p><ul>${P.quer.map((q: string) => `<li>${esc(q)}</li>`).join('')}</ul><p class="note">Cartas do tema não ficam só por serem do tema: uma aura cara que dá pouco pode sair, e uma barata com evasão ou proteção fica.</p>${edhBox(A)}</div>`;
}
// ---------- gráficos das trocas (linguagem do Grimório Arena: KPI, trilho com a média, colunas, réguas) ----------
const pctTxt = (v: number | null | undefined) => (v == null ? '—' : (100 * v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
const ptsTxt = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const swKey = (s: Troca) => s.out + '→' + s.inn;
function teste() { const T = window.RAIOX_TESTE; return T && T.deck === LAST ? T : null; }
function testeDe(s: Troca) { const T = teste(); return T ? T.pares.find((t: Troca) => t.out === s.out && t.inn === s.inn) || null : null; }
function onKeys() { return SWAPS.filter((s, i) => SWAP_ON[i]).map(swKey).sort().join('|'); }
function kpi(rot: string, antes: any, depois: any, nota?: string, tom?: string) {
  const mudou = depois != null && depois !== antes;
  return `<div class="kpi${tom ? ' destaque ' + tom : ''}"><span class="k">${rot}</span><b>${mudou ? `<span class="de">${antes}</span><span class="seta">→</span>${depois}` : antes}</b><small>${nota}</small></div>`;
}
function swapSum(A: Analise) {
  let p = A.price, gc = A.gc.length;
  SWAPS.forEach((s, i) => { if (!SWAP_ON[i]) return; const a: any = C(s.inn) || {}, b: any = C(s.out) || {}; p += (a.usd || 0) - (b.usd || 0); gc += (a.gc ? 1 : 0) - (b.gc ? 1 : 0); });
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
    + kpi('Preço do deck', brlTxt(A.price), Math.abs(dP) >= 1 ? brlTxt(p) : null, precoNota + ` · preços do ${fonteMyp()}`, precoTom)
    + kpi('Bracket', String(A.bracket), tgt && tgt !== A.bracket ? String(tgt) : null, tgt ? 'alvo que você escolheu' : 'estimado pela lista', brTom)
    + kpi('Game changers', String(A.gc.length), gc !== A.gc.length ? String(gc) : null, A._gcMax === 0 ? `o Bracket ${A._tgt} não aceita nenhuma` : A._gcMax === 3 ? 'o Bracket 3 aceita até 3' : 'o Bracket 4 não tem limite', gcTom);
}
// funções e curva: hoje × com as trocas marcadas
function swapGraf(A: Analise) {
  const n = SWAP_ON.filter(Boolean).length;
  const B = n ? analyze(newList(A), A.cmds.map((c: Carta) => c.name)) : A;
  const reguas = A.refs.map(r => {
    const r2 = (B.refs || []).find(x => x.k === r.k) || r;
    const max = Math.max(r.hi * 1.35, r.have, r2.have) + 1, x = (v: number) => (100 * v / max).toFixed(1) + '%';
    const mudou = r2.have !== r.have, dentro = (v: number) => v >= r.lo && v <= r.hi;
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
function swapNums(A: Analise, s: Troca) {
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
  const ks = new Set<string>(A.refs.map(r => r.k)), ro = rolesOf(o), rn = rolesOf(n);
  const fun = [...ks].map(k => { const d = (rn.has(k) ? 1 : 0) - (ro.has(k) ? 1 : 0) + (k === 'lands' ? (isLand(n) ? 1 : 0) - (isLand(o) ? 1 : 0) : 0); return d ? `<span class="fx ${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : '−'}1 ${esc(A.refs.find(r => r.k === k)!.n.toLowerCase())}</span>` : ''; }).join('');
  const mv = !isLand(n) && !isLand(o) && n.v !== o.v ? `<span class="fx ${n.v < o.v ? 'mais' : 'menos'}">custo ${o.v} → ${n.v}</span>` : '';
  return `<div class="sw-num">
    <div><span class="eyebrow">Na mesa simulada</span>${mesa}</div>
    <div><span class="eyebrow">No bolso</span>${bolso}</div>
    <div><span class="eyebrow">Nas funções</span><div class="fxs">${fun + mv || '<span class="note">Mesmas funções medidas.</span>'}</div></div>
  </div>`;
}
function swapImgs(root: ParentNode) { $$('[data-swimg]', root).forEach(el => imgFor(el.dataset.swimg!).then(src => { el.innerHTML = src ? `<img src="${src}" alt="${esc(el.dataset.swimg)}">` : '<span class="note" style="padding:8px;text-align:center">sem imagem</span>'; })); }
function newList(A: Analise) {
  const swapped: Dic = {}; SWAPS.forEach((s, i) => { if (SWAP_ON[i]) swapped[s.out] = s.inn; });
  const names = A.cards.map((c: Carta) => c.name); const done = new Set();
  const out = names.map(n => { if (swapped[n] && !done.has(n)) { done.add(n); return swapped[n]; } return n; });
  const k: Dic = {}; out.forEach(n => (k[n] = (k[n] || 0) + 1));
  return `// Commander\n${A.cmds.map((c: Carta) => '1 ' + c.name).join('\n')}\n// Deck\n${Object.entries(k).map(([n, q]) => `${q} ${n}`).join('\n')}`;
}
// ---------- telas ----------
const SCREENS = ['montar', 'lista', 'resumo', 'trocas', 'funcoes', 'mesa', 'aovivo'];
const SUBS: Dic<string> = { mana: 'funcoes', plano: 'funcoes' }; // Funções, Mana e Plano viraram uma aba só (Análise)
function show(name: string) {
  const sub = SUBS[name] ? name : name === 'funcoes' ? 'funcoes' : null; if (SUBS[name]) name = SUBS[name];
  if (!SCREENS.includes(name)) name = LAST && !LAST.empty ? 'resumo' : 'lista';
  $$('[data-s]').forEach(el => { el.hidden = el.dataset.s !== name; });
  $$('#tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + name ? 'page' : 'false'));
  const noDeck = !LAST || LAST.empty; const em = $('#nodeck'); if (em) em.hidden = !(noDeck && name !== 'lista' && name !== 'montar');
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
const SCRY = (name: string, v?: string) => 'https://api.scryfall.com/cards/named?format=image&version=' + (v || 'normal') + '&exact=' + encodeURIComponent(String(name).split(' // ')[0]);
const IMG_V: Dic<number> = { small: 0, normal: 1, art_crop: 2 };
const IMGC = new Map();
try { for (const [n, v] of Object.entries(JSON.parse(localStorage.getItem('raiox:img') || '{}'))) IMGC.set(n, v); } catch (e) {}
const IMG_NAO = new Set();
const imgKey = (n: string) => String(n).split(' // ')[0];
const IMG_FILA = new Map();
let IMG_T: ReturnType<typeof setTimeout> | null = null, IMG_ULT = 0, IMG_SV: any = null;
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
  nomes.forEach((n, i) => { if (!IMG_FILA.has(n)) cbs[i].forEach((f: () => void) => f()); });
  if (IMG_FILA.size && !IMG_T) IMG_T = setTimeout(imgLote, 550);
}
function imgFor(name: string, v?: string) {
  if (!name) return Promise.resolve(null);
  const k = imgKey(name), i = IMG_V[v!] != null ? IMG_V[v!] : 1;
  const pega = () => { const t = IMGC.get(name) || IMGC.get(k); return t ? (t[i] || t[1]) : null; };
  if (pega() || IMG_NAO.has(k)) return Promise.resolve(pega());
  return new Promise(res => {
    IMG_FILA.set(k, (IMG_FILA.get(k) || []).concat(() => res(pega())));
    if (!IMG_T) IMG_T = setTimeout(imgLote, 40);   // junta os pedidos da mesma tela num lote só
  });
}
const imgsDe = (nomes: string[]) => Promise.all([...new Set(nomes)].map(n => imgFor(n)));

// imagem que não carregou (sem internet ou carta sem foto): mostra o nome no lugar do ícone quebrado
document.addEventListener('error', (e: any) => {
  const im = e.target; if (!im || im.tagName !== 'IMG') return;
  const box = im.parentElement; if (!box || box.closest('#hov,#pop,#zoom')) return;   // as janelas (src/telas/Janelas.svelte) cuidam das suas
  box.innerHTML = `<span class="noimg">${esc(im.alt || 'sem imagem')}</span>`;
}, true);

// a aba Lista (caixa, Analisar e exemplos) é o src/telas/Lista.svelte; chama RAIOX.run
show(location.hash.slice(1));
export {};   // é módulo (escopo próprio), não script global
