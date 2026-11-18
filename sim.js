/* Teste em mesa: simulação de Commander (seu deck carta a carta contra 3 arquétipos).
   Funciona no navegador (window.SIM) e no Node. Depende de window.CARD_DB. */
(function (root) {
'use strict';

// ---------- sorteio com semente ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R()); }

// ---------- base ----------
let DB, F, TAGS;
let FORGE = {}, COMBO_IDX = {};
function init(db, forge) { DB = db; F = Object.fromEntries(db.fields.map((f, i) => [f, i])); TAGS = db.tags; FORGE = forge || (typeof window !== 'undefined' && window.FORGE_MODELS) || {}; for (const k in MODELS) delete MODELS[k];
  const list = (typeof window !== 'undefined' && window.COMBOS) || [];
  COMBO_IDX = {}; for (const [a, b, f] of list) { (COMBO_IDX[a] = COMBO_IDX[a] || []).push([b, f]); (COMBO_IDX[b] = COMBO_IDX[b] || []).push([a, f]); }
}
// combos de 2 cartas presentes no deck
function deckCombos(deck) {
  const set = new Set([deck.cmd, ...deck.cards]); const out = []; const seen = new Set();
  for (const a of set) for (const [b, f] of COMBO_IDX[a] || []) if (set.has(b)) { const k = [a, b].sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push([a, b, f]); } }
  return out;
}
const FORGE_KEYS = ['buffScale', 'buffDouble', 'buffEvasive', 'power', 'evasive', 'infect', 'haste', 'ward', 'affinity', 'improvise', 'counter', 'freeCounter', 'draw', 'engine', 'removal', 'wipe', 'tutor', 'rampLands', 'recur', 'tokenPerTurn', 'tribeWord', 'tokenPower', 'protect', 'reduce', 'anthem', 'anthemTribe', 'clock', 'fort', 'cantLose', 'doubler', 'pinger', 'etbRemoval', 'removalEngine', 'cheat', 'attackRemoval', 'anthemAttack', 'metalwork', 'blasph', 'idol', 'ritual', 'deathDraw', 'treasureOnce', 'buffOne', 'powerArtifacts', 'protoPower'];
// Junta o modelo do Forge (preciso) com o das regras de texto (sobra): o Forge manda onde tem informação.
function withForge(M, name) {
  const f = FORGE[name] || FORGE[name.split(' // ')[0]];
  if (!f || M.land) return M;
  for (const k of FORGE_KEYS) if (f[k] !== undefined) M[k] = f[k];
  if (f.mana) M.mana = Object.assign({}, f.mana);
  if (f.altCost) { const alt = parseCost(f.altCost.split(' ').map(x => '{' + x + '}').join('')); if (total(alt) < total(M.cost)) M.cost = alt; }
  const fd = f.desc || []; const has = (re) => fd.some(x => re.test(x));
  M.desc = [...new Set([...fd, ...M.desc.filter(x => x !== '—' && !/^força/.test(x) && !(has(/criatura/) && /criatura/.test(x)) && !(has(/protege/) && /protege/.test(x)))])];
  if (!M.desc.length && f.deathDraw) M.desc.push('compra ao morrer');
  if (M.power && f.powerArtifacts) M.desc.unshift('força = nº de artefatos');
  else if (M.creature && M.desc[0] && !/^força/.test(M.desc[0])) M.desc.unshift('força ' + (M.power || 0));
  M.ok = true; M.src = 'forge';
  return M;
}
function raw(name) { const e = DB.cards[name]; if (!e) return null; return { name, p: F.p != null ? e[F.p] : '', m: e[F.m], v: e[F.v], t: e[F.t], o: e[F.o], ci: e[F.ci], pm: e[F.pm], tags: new Set(e[F.tags].map(i => TAGS[i])), r: e[F.r], usd: e[F.usd] }; }
const COLORS = ['W', 'U', 'B', 'R', 'G'];
function parseCost(m) {
  const c = { gen: 0, W: 0, U: 0, B: 0, R: 0, G: 0, X: 0 };
  (m || '').split(' // ')[0].replace(/\{([^}]+)\}/g, (_, s) => {
    if (/^\d+$/.test(s)) c.gen += +s; else if (s === 'X') c.X++; else if (s === 'C') c.gen++;
    else if (s.includes('/')) { const k = s.split('/').find(x => COLORS.includes(x)); if (k) c[k]++; else c.gen++; }
    else if (c[s] !== undefined) c[s]++;
  });
  return c;
}
const pips = (c) => c.W + c.U + c.B + c.R + c.G;
const total = (c) => c.gen + pips(c);

// ---------- modelo de cada carta ----------
// Cada carta vira um objeto simples com o que a simulação usa. "desc" explica o modelo (como a coluna "Modelo" do PDF).
const MODELS = {};
function model(name) {
  if (MODELS[name]) return MODELS[name];
  const c = raw(name);
  if (!c) return (MODELS[name] = blank(name));
  const front = c.t.split(' // ')[0];
  const o = c.o.split('\n//\n')[0];
  const M = {
    name, cost: parseCost(c.m), cmc: c.v, land: /Land/.test(front), creature: /Creature/.test(front), artifact: /Artifact/.test(front),
    enchant: /Enchantment/.test(front), legendary: /Legendary/.test(front), instant: /Instant/.test(front), sorcery: /Sorcery/.test(front),
    sub: (front.split(' — ')[1] || '').split(' ').filter(Boolean), pw: /Planeswalker/.test(front), colorless: !/[WUBRG]/.test((c.m || '').split(' // ')[0]), power: 0, evasive: 0,
    mana: null, reduce: [], draw: 0, engine: null, protect: null, removal: 0, wipe: null, tutor: false, recur: null, tokens: 0,
    cheat: false, cantLose: false, infect: false, desc: [], ok: true, tags: c.tags, raw: c
  };
  const d = M.desc;
  // custo alternativo (More Than Meets the Eye, Prototype)
  let m = o.match(/More Than Meets the Eye (\{[^—(]+\})/); if (m) { const alt = parseCost(m[1]); if (total(alt) < total(M.cost)) M.cost = alt; }
  m = o.match(/Prototype (\{[^—]+\}) — (\d+)\/(\d+)/); if (m) { M.cost = parseCost(m[1]); M.protoPower = +m[2]; }
  // terreno
  if (M.land) {
    const any = /any color|commander's color identity|Exotic Orchard|one mana of any type/.test(o) || c.pm.length >= 4;
    M.mana = { n: 1, colors: any ? 'WUBRG' : (c.pm.replace('C', '') || ''), tapped: /enters tapped\.|enters the battlefield tapped\./.test(o) && !/unless|you may pay|If you don't/.test(o) };
    if (/Saga/.test(front)) { M.mana.colors = ''; }
    d.push('terreno' + (M.mana.colors ? ' ' + M.mana.colors : ' incolor') + (M.mana.tapped ? ', entra virado' : ''));
    return (MODELS[name] = M);
  }
  // força
  if (M.creature) {
    const p = parseInt(String(c.p).split(' // ')[0]);
    M.power = isNaN(p) ? 2 : p;
    if (M.protoPower != null) M.power = M.protoPower;
    if (/power is equal to the number of artifacts you control|equal to the number of artifacts you control/.test(o)) M.powerArtifacts = true;
    if (/Double strike|double strike/.test(o.split('\n')[0]) || /^Double strike/m.test(o)) M.power *= 2;
    if (/\bInfect\b|\binfect\b/.test(o)) { M.infect = true; }
    if (/^(Flying|Trample|Menace|.*\bflying\b|.*\btrample\b|.*\bmenace\b)/m.test(o)) M.evasive = 1;
    const ctr = o.match(/distribute (\w+) \+1\/\+1 counters/); if (ctr) M.power += NUM[ctr[1]] || 2;
    if (/haste/i.test(o.split('\n')[0])) M.haste = true;
    d.push('força ' + (M.powerArtifacts ? '= nº de artefatos' : M.power) + (M.infect ? ' (infecção)' : ''));
  }
  // mana (pedras, criaturas de mana)
  m = o.match(/(?:^|\n)(?:[A-Z][a-z]+ — )?(\{\d\}, )?\{T\}(?:, [^:]+)?: Add ([^.]+)\./);
  if (m && !M.land) {
    const s = m[2]; let n = (s.match(/\{[WUBRGC]\}/g) || []).length || 1;
    if (/two mana/.test(s)) n = 2; if (/three mana/.test(s)) n = 3;
    if (/amount of \{G\} equal to this creature's power/.test(s)) n = M.protoPower || 1;
    let colors = /any color|commander's color identity/.test(s) ? 'WUBRG' : COLORS.filter(x => s.includes('{' + x + '}')).join('');
    const tal = o.match(/\{T\}: Add \{([WUBRG])\} or \{([WUBRG])\}/); if (tal) colors = tal[1] + tal[2];
    M.mana = { n: m[1] ? Math.max(1, n - 1) : n, colors, dork: M.creature };
    if (/Metalcraft/.test(o)) M.mana.metalcraft = true;
    if (/among legendary creatures/.test(o)) M.mana.needsLegend = true;
    if (/Lands you control have "\{T\}: Add one mana of any color/.test(o)) M.fixLands = true;
    d.push('+' + M.mana.n + ' mana' + (colors.length >= 3 ? ' (qualquer cor)' : colors ? ' (' + colors + ')' : '') + (M.mana.metalcraft ? ' com 3 artefatos' : '') + (M.mana.needsLegend ? ' com lendário' : ''));
  }
  // ramp de terreno
  if (c.tags.has('land-ramp') && !M.land) {
    const n = /two basic land|up to two/.test(o) ? 2 : 1;
    M.rampLands = /put one onto the battlefield/.test(o) ? 1 : n; if (/other into your hand/.test(o)) M.draw += 1;
    if (!M.creature || /When this creature enters, you may search your library for a basic land/.test(o)) d.push('+' + M.rampLands + ' terreno do grimório');
  }
  // tesouro por compra dos oponentes (Smothering Tithe)
  if (/Whenever an opponent draws a card, that player may pay \{2\}/.test(o)) { M.engine = { kind: 'tithe' }; d.push('gera tesouros'); }
  if (/Untap all artifacts you control during each other player's untap step/.test(o)) { M.clock = true; d.push('desvira artefatos (mana guardada de graça)'); }
  // redutores
  const red = [...o.matchAll(/(Artifact|Historic|Colorless|Creature|Enchantment|Artifact creature)? ?spells you cast(?: that [^.]+)? cost \{(\d)\} less/gi)];
  if (!/Imprint/.test(o)) for (const r of red) { const f = (r[1] || 'all').toLowerCase(); M.reduce.push({ filter: f, n: +r[2] }); }
  if (/^Spells cost \{1\} less to cast\./m.test(o)) M.reduce.push({ filter: 'all', n: 1 });
  if (/As this artifact enters, choose artifact, creature/.test(o)) M.reduce.push({ filter: 'artifact', n: 1 });
  if (/Imprint — When this artifact enters, you may exile a nonland card from your hand\.\s+Spells you cast that share a card type/.test(o)) M.reduce.push({ filter: 'imprint', n: 2 });
  if (/Artifact creature spells you cast have affinity for artifacts/.test(o)) M.reduce.push({ filter: 'affinity', n: 0 });
  if (M.reduce.length) d.push('abate ' + M.reduce.map(r => r.filter === 'affinity' ? 'afinidade em criatura artefato' : r.filter === 'imprint' ? '2 no tipo impresso' : r.n + ' em ' + ({ all: 'tudo', artifact: 'artefatos', historic: 'históricos', colorless: 'incolores', creature: 'criaturas', enchantment: 'encantamentos', 'artifact creature': 'criaturas artefato' }[r.filter] || r.filter)).join(', '));
  // custos que diminuem
  if (/Affinity for artifacts/.test(o)) { M.affinity = true; d.push('desconto por artefato'); }
  if (/costs \{X\} less to cast, where X is the total mana value of noncreature artifacts/.test(o)) { M.metalwork = true; d.push('desconto pelo valor dos artefatos'); }
  if (/This spell costs \{1\} less to cast for each attacking creature/.test(o)) { M.idol = true; d.push('desconto por atacante'); }
  if (/This spell costs \{1\} less to cast for each creature on the battlefield/.test(o)) { M.blasph = true; }
  if (/Improvise/.test(o)) { M.improvise = true; d.push('improvisar'); }
  // compra
  m = o.match(/(?:^|\n|\. )(?:When [^,]+ enters, )?(?:you )?[Dd]raw (a|two|three|four) cards?/); if (m && (M.instant || M.sorcery || /enters/.test(m[0]))) { M.draw += NUM[m[1]]; }
  if (/Draw a card for each creature you control/.test(o)) { M.drawCreatures = true; d.push('compra por criatura'); }
  if (/Draw cards equal to the greatest power among non-Human creatures you control/.test(o)) { M.drawPower = true; M.pump = 3; d.push('compra pela maior força'); }
  if (M.drawCreatures) M.draw = 0;
  if (M.draw) d.push('compra ' + M.draw);
  if (/Whenever another nontoken artifact creature or Vehicle you control enters, draw a card/.test(o)) { M.engine = { kind: 'artCreatureEnter' }; d.push('motor de compra'); }
  if (/Whenever one or more artifact creatures you control enter, draw a card/.test(o)) { M.engine = { kind: 'artCreatureEnterOnce' }; d.push('motor de compra'); }
  if (/Whenever you cast a creature spell, draw a card/.test(o)) { M.engine = { kind: 'creatureCast' }; d.push('motor de compra'); }
  if (/Whenever an opponent draws a card, you may pay \{1\}\. If you do, draw a card/.test(o)) { M.engine = { kind: 'mindseye' }; d.push('compra quando oponente compra'); }
  if (/Whenever equipped creature dies, draw two cards/.test(o)) { M.engine = { kind: 'clamp' }; d.push('2 cartas por criatura que morre'); }
  if (/\{2\}, \{T\}, Put a page counter on this artifact: Draw a card/.test(o)) { M.engine = { kind: 'tome' }; d.push('4 usos: compra'); }
  if (/\+2: You gain 3 life and draw a card/.test(o)) { M.engine = { kind: 'pwdraw' }; d.push('motor de compra'); }
  if (/\+1: Exile the top card of your library face down and look at it\. Create a 2\/2/.test(o)) { M.engine = { kind: 'ugintoken' }; d.push('ficha 2/2 por turno, vira carta'); }
  if (/When this creature dies, you may draw a card/.test(o)) M.deathDraw = 1;
  // proteção
  if (/Artifacts you control have hexproof|Other artifact creatures you control have hexproof/.test(o)) { M.protect = { kind: 'hexArtifacts' }; d.push('artefatos com hexproof'); }
  if (/Artifacts you control have indestructible/.test(o)) { M.protect = { kind: 'forge' }; d.push('artefatos indestrutíveis'); }
  if (/Equipped creature has hexproof|Equipped creature has shroud/.test(o)) { M.protect = { kind: 'boots' }; d.push('protege o comandante'); }
  if (/gain protection from everything|Permanents you control gain hexproof and indestructible/.test(o)) { M.protect = { kind: 'saveAll' }; d.push('salva a mesa de um wipe'); }
  if (/If you control a commander, you may cast this spell without paying its mana cost\.\s+You may choose new targets/.test(o)) { M.protect = { kind: 'swat' }; d.push('desvia uma remoção'); }
  if (!M.protect && (M.instant) && (c.tags.has('gives-hexproof') || c.tags.has('gives-indestructible') || c.tags.has('protection'))) { M.protect = { kind: 'single' }; d.push('protege 1 criatura'); }
  if (/You can't lose the game and your opponents can't win the game/.test(o)) { M.cantLose = true; d.push('você não perde'); }
  if (/Ward \{(\d)\}/.test(o)) M.ward = true;
  // remoção e wipes
  if (c.tags.has('board-wipe') || /Destroy all|deals \d+ damage to each creature/.test(o)) {
    M.wipe = { nonartifact: /nonartifact creatures/.test(o), artifactsToo: /Destroy all artifacts|each artifact/.test(o) };
    d.push('wipe' + (M.wipe.nonartifact ? ' (poupa artefatos)' : ''));
  } else if ((c.tags.has('spot-removal') || c.tags.has('creature-removal')) && (M.instant || M.sorcery)) { M.removal = 1; d.push('remoção'); }
  if (/Whenever you cast a colorless spell, exile up to one target permanent that's one or more colors/.test(o)) { M.uginEye = true; d.push('remove 1 por mágica incolor'); }
  if (/Whenever .* attacks, exile up to one other target tapped creature/.test(o)) { M.attackRemoval = true; d.push('remove ao atacar'); }
  if (/−3: Destroy target permanent that's one or more colors/.test(o)) M.removal = Math.max(M.removal, 1);
  if (!M.removal && !M.wipe && (M.instant || M.sorcery) && c.tags.has('artifact-removal')) { M.removal = 0.12; d.push('remoção de artefato/encantamento'); }
  if (M.removal && (M.instant || M.sorcery)) { if (M.rampLands) { M.rampLands = 0; d.splice(d.findIndex(x => /terreno do grimório/.test(x)), 1); } }
  // tutores
  if (c.tags.has('tutor') && (M.instant || M.sorcery) && !M.rampLands && !M.removal) { M.tutor = true; d.push('busca carta'); }
  // recursão
  if (/Return all artifact (and enchantment )?cards from your graveyard to the battlefield/.test(o)) { M.recur = { kind: 'all' }; d.push('volta todos os artefatos'); }
  if (/return target artifact card from your graveyard to the battlefield/.test(o)) { M.recur = { kind: 'onePerTurn' }; d.push('volta 1 artefato por turno'); }
  // trapaça do comandante (Ultra Magnus e parecidos)
  if (/attacks, you may put an? (artifact )?creature card from your hand onto the battlefield/.test(o)) { M.cheat = /artifact creature/.test(o) ? 'artifact' : 'creature'; d.push('põe criatura da mão em campo ao atacar'); }
  if (/cast your commander from the command zone without paying its mana cost/.test(o)) { M.freeCmd = true; d.push('lança o comandante de graça'); }
  // fichas e bônus
  if (/Whenever you attack, other creatures you control get \+2\/\+2/.test(o)) { M.anthemAttack = 2; d.push('+2 nos outros ao atacar'); }
  m = o.match(/(?:^|\n)When [^,]+ enters, create (a|two|three|four|X) (\d+)\/(\d+)/); if (m) { M.tokenPower = (NUM[m[1]] || 1) * +m[2]; d.push('fichas ' + M.tokenPower); }
  if (/Other artifact creatures you control have haste/.test(o)) { M.hasteArtifacts = true; d.push('dá ímpeto a artefatos'); }
  // anulações
  if (c.tags.has('counterspell') && (M.instant || /Flash/.test(o))) { M.counter = true; M.freeCounter = /If you control a commander, you may cast this spell without paying|rather than pay this spell's mana cost/.test(o); d.push('anulação' + (M.freeCounter ? ' (grátis)' : '')); }
  // compra pelas jogadas dos oponentes
  if (/Whenever an opponent casts a spell, (?:you may )?draw a card unless that player pays/.test(o)) { M.engine = { kind: 'rhystic' }; d.push('compra quando oponente joga'); }
  if (/Whenever an opponent casts a noncreature spell, you may draw a card/.test(o)) { M.engine = { kind: 'remora' }; d.push('compra quando oponente joga (temporário)'); }
  if (/Whenever a creature you control deals combat damage to a player, (?:you may )?draw a card/.test(o)) { M.engine = { kind: 'bident' }; d.push('compra ao causar dano'); }
  if (!M.engine && /At the beginning of your upkeep, (?:you )?(?:may )?draw a card|draw an additional card/.test(o)) { M.engine = { kind: 'upkeepDraw' }; d.push('compra 1 por turno'); }
  // fichas
  let tm;
  if ((tm = o.match(/(?:At the beginning of (?:your upkeep|your end step|each combat|combat on your turn)|Whenever you cast [^,]+|Whenever [^,]*attacks)[^.]*create (a|an|one|two|three|X) (\d+)\/(\d+)/))) { M.tokenPerTurn = (NUM[tm[1]] || 1) * (+tm[2] || 1); d.push('fichas por turno ' + M.tokenPerTurn); }
  if ((tm = o.match(/\{T\}: Create X (\d+)\/(\d+)[^.]*where X is the number of (\w+)/))) { M.tokenPerTurn = 'tribe'; M.tribeWord = tm[3].replace(/s$/, ''); d.push('fichas = nº de ' + tm[3]); }
  if (!M.tokenPower && !M.tokenPerTurn && (tm = o.match(/create (a|an|one|two|three|four|five|X) (\d+)\/(\d+)[^.]*tokens?/))) { M.tokenPower = (NUM[tm[1]] || 1) * Math.max(1, +tm[2]); d.push('fichas ' + M.tokenPower); }
  if (/If an effect would create one or more tokens under your control, it creates twice that many/.test(o)) { M.doubler = true; d.push('dobra fichas'); }
  // bônus para o time
  if ((tm = o.match(/(?:Other )?(?:(\w+) )?creatures you control get \+(\d+)\/\+(\d+)/)) && !/until end of turn/.test(tm[0] + o.slice(o.indexOf(tm[0]), o.indexOf(tm[0]) + tm[0].length + 20))) { M.anthem = +tm[2]; d.push('+' + tm[2] + ' em cada criatura'); }
  else if ((tm = o.match(/Other (\w+?)s? (?:creatures )?you control get \+(\d+)\/\+(\d+)/))) { M.anthem = +tm[2]; M.anthemTribe = tm[1]; d.push('+' + tm[2] + ' na tribo'); }
  // redutor de tribo
  if (/Creature spells (?:you cast )?of the chosen type cost \{(\d)\} less/.test(o)) { const n = +o.match(/cost \{(\d)\} less/)[1]; M.reduce.push({ filter: 'creature', n }); d.push('abate ' + n + ' na tribo'); }
  // forte contra ataque
  if (/Creatures can't attack you unless their controller pays/.test(o)) { M.fort = true; d.push('dificulta ataques em você'); }
  // ritual
  if (M.instant && (tm = o.match(/^Add (\{[WUBRGC]\}+)\.?$/m))) { M.ritual = (tm[1].match(/\{/g) || []).length; d.push('ritual +' + M.ritual); }
  // dano quando criatura entra
  if (/Whenever (?:a|another) creature (?:you control )?enters[^.]*deals (\d+) damage to each opponent/.test(o)) { M.pinger = true; d.push('dano a cada oponente por criatura'); }
  if (/Equipped creature has [^.]*(hexproof|shroud)/.test(o) && !M.protect) { M.protect = { kind: 'boots' }; d.push('protege o comandante'); }
  if (/You may cast spells as though they had flash|cast .* from the top of your library/.test(o) && !d.length) { M.engine = { kind: 'upkeepDraw' }; d.push('vantagem de cartas'); }
  // bônus numa criatura (equipamento / aura), pelo texto
  let bm;
  if ((bm = o.match(/(?:Equipped|Enchanted) creature gets \+(\d+|X)\/\+(\d+|X)(?: for each ([^.]+))?/))) {
    if (bm[3]) { M.buffScale = /Aura|Equipment attached/.test(bm[3]) ? 'attached' : /artifact/.test(bm[3]) ? 'artifacts' : /enchantment/.test(bm[3]) ? 'enchantments' : null; if (!M.buffScale) M.buffOne = 2; d.push('+' + bm[1] + ' na criatura por ' + bm[3]); }
    else if (/^\d+$/.test(bm[1])) { M.buffOne = +bm[1]; d.push('+' + bm[1] + ' numa criatura'); }
  }
  if (/(?:Equipped|Enchanted) creature (?:gets [^.]*and )?has [^.]*double strike/i.test(o)) { M.buffDouble = true; d.push('golpe duplo numa criatura'); }
  if (/(?:Equipped|Enchanted) creature (?:gets [^.]*and )?has [^.]*(flying|trample|menace)/i.test(o)) { M.buffEvasive = true; }
  if (/(?:Equipped|Enchanted) creature (?:gets [^.]*and )?has [^.]*(ward|hexproof|shroud)/i.test(o) && !M.protect) { M.protect = { kind: 'boots' }; d.push('protege a criatura equipada'); }
  if (!d.length) { d.push('—'); M.ok = false; }
  return (MODELS[name] = withForge(M, name));
}
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, X: 2 };
function rawPT(name) { const e = DB.cards[name]; if (!e) return 0; const o = e[F.o]; const t = e[F.t]; const m = (t + '').match(/Creature/); if (!m) return 0; return (DB.pt && DB.pt[name]) || guessPT(name); }
function guessPT(name) { const p = POWER[name]; if (p != null) return p; return 2; }
function blank(name) { return { name: name || '(vazia)', blank: true, cost: parseCost(''), cmc: 0, power: 0, reduce: [], desc: ['carta vazia'], ok: false, tags: new Set(), raw: { o: '' } }; }
const POWER = {}; // preenchido por setPowers()
function setPowers(map) { Object.assign(POWER, map); for (const k in MODELS) delete MODELS[k]; }

// ---------- arquétipos dos oponentes ----------
// Força em campo esperada por turno (1..14), evasão, chance por turno de remover, de dar wipe e de comboar.
const ARCH = {
  aggro: { n: 'Agressivo', curve: [2, 7, 13, 18, 23, 27, 29, 31, 33, 34, 35, 36, 37, 38], evasion: 0.55, removal: 0.10, wipe: 0.02, combo: 0, draw: 1.2 },
  midrange: { n: 'Midrange', curve: [0, 1, 3, 5, 8, 11, 15, 19, 23, 27, 31, 34, 37, 40], evasion: 0.20, removal: 0.30, wipe: 0.05, combo: 0, draw: 1.4 },
  control: { n: 'Controle', curve: [0, 0, 0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9], evasion: 0.30, removal: 0.45, wipe: 0.09, combo: 0, draw: 2.0 },
  combo: { n: 'Combo', curve: [0, 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15], evasion: 0.15, removal: 0.25, wipe: 0.04, combo: 0.035, comboFrom: 7, draw: 1.8 },
};
// OPP_SCALE — força geral dos oponentes: calibrada para um deck médio do EDHREC ganhar ~25% na mesa típica.
const OPP = { scale: 1.92 };
const TABLES = {
  tipica: { n: 'Mesa típica', pick: (R) => [0, 1, 2].map(() => ['aggro', 'midrange', 'control', 'combo'][Math.floor(R() * 4)]) },
  agressiva: { n: 'Mesa agressiva', pick: () => ['aggro', 'aggro', 'midrange'] },
  controle: { n: 'Mesa de controle', pick: () => ['control', 'control', 'midrange'] },
  combo: { n: 'Mesa com combo', pick: () => ['combo', 'control', 'midrange'] },
};

// ---------- uma partida ----------
// deck: { cmd: nome, cards: [nomes] } ; opts: { table, seed, color: true, record: bool }
function play(deck, opts) {
  const R = rng(opts.seed);
  const T = TABLES[opts.table || 'tipica'];
  const ARCHK = ['aggro', 'midrange', 'control', 'combo'];
  const keys0 = opts.opps || (opts.fixed ? [opts.fixed, ARCHK[Math.floor(R() * 4)], ARCHK[Math.floor(R() * 4)]] : T.pick(R));
  const opp = keys0.map((k, i) => ({ i: i + 1, k, A: ARCH[k], life: 40, power: 0, prev: 0, luck: Math.max(0.35, 1 + 0.28 * gauss(R)), alive: true, grow: 0 }));
  const lib = shuffle(deck.cards.map(model), R);
  const cmdM = model(deck.cmd);
  const me = { misc: [], life: 40, alive: true, hand: [], lib, gy: [], bf: [], lands: [], rocks: [], mana: 0, tax: 0, cmdOnBf: null, cmdDeaths: 0, treasures: 0, poisonOut: 0, prevPower: 0, tome: 0, landsPlayed: 0 };
  const rec = { opening: null, mull: 0, power: [], manaT: [], handT6: null, uncastT6: 0, landsT6: 0, rocksT6: 0, seenT8: 0, cmdTurn: 0, wipes: 0, result: '', turn: 0, castCount: 0 };
  const color = opts.color !== false;
  const combos = deckCombos(deck);
  // mão inicial: 1 mulligan se <2 ou >5 terrenos (o primeiro é grátis), depois mantém
  draw(me, 7);
  let L = me.hand.filter(c => c.land).length;
  if (L < 2 || L > 5) { me.lib.push(...me.hand); me.hand = []; shuffle(me.lib, R); draw(me, 7); rec.mull = 1; }
  rec.opening = me.hand.map(c => c.name);
  rec.openLands = me.hand.filter(c => c.land).length;
  rec.openSources = me.hand.filter(c => !c.land && (c.mana || c.rampLands)).length;
  rec.openBig = me.hand.filter(c => !c.land && total(c.cost) >= 7).length;
  let seen = 7;
  const order = shuffle([0, 1, 2, 3], R);
  const players = () => [me, ...opp];
  for (let turn = 1; turn <= 14; turn++) {
    for (const who of order) {
      if (!me.alive) break;
      if (who === 0) { if (turn > 1 || order[0] !== 0) { draw(me, 1); seen++; } myTurn(turn); }
      else { const o = opp[who - 1]; if (o.alive) oppTurn(o, turn); }
      if (rec.result) break;
      if (opp.every(o => !o.alive)) { rec.result = 'vence'; rec.turn = turn; break; }
    }
    if (turn === 8) rec.seenT8 = seen;
    rec.power.push(myPower());
    if (rec.result) break;
  }
  if (!rec.result) {
    const score = me.life + 2 * myPower(); const best = Math.max(...opp.filter(o => o.alive).map(o => o.life + 2 * o.power));
    rec.result = score > best ? 'vence' : 'tarde'; rec.turn = 14;
  }
  while (rec.power.length < 14) rec.power.push(rec.power[rec.power.length - 1] || 0);
  rec.cmdDeaths = me.cmdDeaths;
  while (rec.manaT.length < 14) rec.manaT.push(rec.manaT[rec.manaT.length - 1] || 0);
  return rec;

  // ----- funções da partida -----
  function draw(p, n) { for (let k = 0; k < n; k++) { if (!p.lib.length) return; p.hand.push(p.lib.shift()); } }
  function artifactsOnBf() { return me.bf.filter(c => c.artifact).length + me.rocks.filter(c => c.artifact).length + me.misc.filter(c => c.artifact).length + me.treasures; }
  function myPower() {
    let p = 0; const arts = artifactsOnBf();
    for (const c of me.bf) { let x = c.powerArtifacts ? Math.min(8, arts) : c.power; p += x + (c.ctr || 0); }
    p += me.tokens || 0;
    if (me.bf.length) {
      const atts = [...me.misc, ...me.bf].filter(c => c.buffOne || c.buffScale || c.buffDouble);
      const nAtt = atts.length; const nEnch = me.misc.filter(c => c.enchant).length;
      let host = Math.max(...me.bf.map(c => c.powerArtifacts ? Math.min(8, arts) : c.power));
      for (const c of atts) {
        let b = c.buffOne || 0;
        if (c.buffScale === 'attached') b += nAtt; else if (c.buffScale === 'artifacts') b += arts; else if (c.buffScale === 'enchantments') b += nEnch;
        p += b; host += b;
      }
      if (atts.some(c => c.buffDouble)) p += host;
    }
    for (const a of [...me.bf, ...me.misc]) if (a.anthem) {
      const n = me.bf.filter(c => c !== a && (!a.anthemTribe || c.sub.includes(a.anthemTribe))).length + (a.anthemTribe ? 0 : (me.tokenCount || 0));
      p += a.anthem * n;
    }
    return p;
  }
  function addTokens(power, count) {
    const mult = [...me.bf, ...me.misc].some(c => c.doubler) ? 2 : 1;
    me.tokens = Math.min(60, (me.tokens || 0) + power * mult); me.tokenCount = Math.min(60, (me.tokenCount || 0) + (count || power) * mult);
    for (const x of [...me.bf, ...me.misc]) if (x.pinger) for (const o of opp) if (o.alive) { o.life -= (count || power) * mult; if (o.life <= 0) o.alive = false; }
  }
  function cmdPowerish() { return me.cmdOnBf ? cmdM.power : 0; }
  function sources() {
    // lista de fontes disponíveis {n, colors}
    const s = [];
    const fixAll = me.misc.some(c => c.fixLands) || me.rocks.some(c => c.fixLands);
    for (const l of me.lands) if (!l.tappedNow) s.push({ n: 1, colors: fixAll ? 'WUBRG' : l.mana.colors });
    const arts = artifactsOnBf(); const hasLegend = me.bf.some(c => c.legendary) || !!me.cmdOnBf;
    for (const r of me.rocks) {
      if (r.sick) continue;
      if (r.mana.metalcraft && arts < 3) continue;
      if (r.mana.needsLegend && !hasLegend) continue;
      let n = r.mana.n; if (r.protoPower) n = r.protoPower;
      s.push({ n, colors: r.mana.colors || '' });
    }
    for (let k = 0; k < me.treasures; k++) s.push({ n: 1, colors: 'WUBRG', treasure: true });
    return s;
  }
  function costOf(c) {
    const cost = Object.assign({}, c.cost);
    if (c === cmdM) cost.gen += me.tax;
    let red = 0;
    for (const r of [...me.rocks, ...me.bf, ...me.misc]) for (const x of r.reduce || []) {
      if (x.filter === 'all') red += x.n;
      else if (x.filter === 'artifact' && c.artifact) red += x.n;
      else if (x.filter === 'historic' && (c.artifact || c.legendary)) red += x.n;
      else if (x.filter === 'colorless' && c.colorless) red += x.n;
      else if (x.filter === 'creature' && c.creature) red += x.n;
      else if (x.filter === 'artifact creature' && c.artifact && c.creature) red += x.n;
      else if (x.filter === 'imprint' && c.artifact) red += x.n;
      else if (x.filter === 'affinity' && c.artifact && c.creature) red += artifactsOnBf();
    }
    if (c.affinity) red += artifactsOnBf();
    if (c.metalwork) red += [...me.rocks, ...me.misc].filter(x => x.artifact && !x.creature).reduce((s, x) => s + x.cmc, 0);
    if (c.idol) red += me.bf.length;
    if (c.blasph) red += me.bf.length + Math.round(opp.reduce((s, o) => s + o.power, 0) / 3);
    if (c.improvise) red += artifactsOnBf();
    cost.gen = Math.max(0, cost.gen - red);
    return cost;
  }
  // paga com cor: devolve true e consome fontes, ou false
  function pay(cost, dry) {
    const src = sources().map(x => Object.assign({}, x, { left: x.n }));
    if (color) {
      for (const col of COLORS) for (let k = 0; k < cost[col]; k++) {
        const s = src.filter(x => x.left > 0 && x.colors.includes(col)).sort((a, b) => (a.treasure - b.treasure) || a.colors.length - b.colors.length)[0];
        if (!s) return false; s.left--;
      }
    } else { let need = pips(cost); for (const s of src) { const t = Math.min(need, s.left); s.left -= t; need -= t; } if (need > 0) return false; }
    let g = cost.gen;
    for (const s of src.sort((a, b) => (a.treasure - b.treasure) || a.colors.length - b.colors.length)) { const t = Math.min(g, s.left); s.left -= t; g -= t; }
    if (g > 0) return false;
    if (dry) return true;
    // marca o que foi usado: terrenos e pedras (aproximação: usa na ordem)
    let used = src.reduce((s, x) => s + (x.n - x.left), 0);
    for (const l of me.lands) { if (used <= 0) break; if (!l.tappedNow) { l.tappedNow = true; used--; } }
    for (const r of me.rocks) { if (used <= 0) break; if (!r.usedNow && !r.sick) { r.usedNow = true; used -= r.mana.n; } }
    while (used > 0 && me.treasures > 0) { me.treasures--; used--; }
    return true;
  }
  function manaPotential() { const saved = me.lands.map(l => l.tappedNow), savedR = me.rocks.map(r => r.usedNow); me.lands.forEach(l => (l.tappedNow = false)); me.rocks.forEach(r => (r.usedNow = false)); const v = available(); me.lands.forEach((l, i) => (l.tappedNow = saved[i])); me.rocks.forEach((r, i) => (r.usedNow = savedR[i])); return v; }
  function available() { return sources().reduce((s, x) => s + x.n, 0); }
  function myTurn(turn) {
    for (const l of me.lands) { l.tappedNow = l.entersTapped && l.turnIn === turn ? true : false; }
    for (const r of me.rocks) { r.usedNow = false; if (r.sick && r.turnIn < turn) r.sick = false; }
    // motores do começo do turno
    for (const c of me.misc) {
      if (c.engine && c.engine.kind === 'tithe') me.treasures += opp.filter(o => o.alive).length > 0 ? 1 : 0;
      if (c.engine && c.engine.kind === 'pwdraw') draw(me, 1);
      if (c.engine && c.engine.kind === 'ugintoken') { me.tokens = (me.tokens || 0) + 2; me.uginCards = (me.uginCards || 0) + 1; }
      if (c.engine && c.engine.kind === 'upkeepDraw') draw(me, 1);
      if (c.removalEngine && c.turnIn < turn) removeFromOpp(0.2);
      if (c.tokenPerTurn && c.turnIn < turn) addTokens(c.tokenPerTurn === 'tribe' ? me.bf.filter(x => x.sub.includes(c.tribeWord)).length + (me.tokenCount || 0) : c.tokenPerTurn);
    }
    for (const c of me.bf) {
      if (c.engine && c.engine.kind === 'upkeepDraw') draw(me, 1);
      if (c.tokenPerTurn && c.turnIn < turn) addTokens(c.tokenPerTurn === 'tribe' ? me.bf.filter(x => x.sub.includes(c.tribeWord)).length + (me.tokenCount || 0) : c.tokenPerTurn);
    }
    if (cmdM.tokenPerTurn && me.cmdOnBf && me.cmdTurnIn < turn) addTokens(cmdM.tokenPerTurn === 'tribe' ? me.bf.filter(x => x.sub.includes(cmdM.tribeWord)).length + (me.tokenCount || 0) + 1 : cmdM.tokenPerTurn);
    // terreno
    const lands = me.hand.filter(c => c.land);
    if (lands.length) {
      const need = neededColors();
      lands.sort((a, b) => score(b) - score(a));
      function score(l) { return (l.mana.tapped ? 0 : 2) + [...need].filter(x => l.mana.colors.includes(x)).length; }
      const l = lands[0]; me.hand.splice(me.hand.indexOf(l), 1);
      me.lands.push({ name: l.name, mana: l.mana, entersTapped: l.mana.tapped, turnIn: turn, tappedNow: !!l.mana.tapped, card: l });
    }
    // reserva para proteção (a partir do T5; com Unwinding Clock não precisa)
    const holdCard = me.hand.find(c => (c.protect && (c.protect.kind === 'saveAll' || c.protect.kind === 'single')) || (c.counter && !c.freeCounter));
    const clock = me.misc.some(c => c.clock);
    const reserve = turn >= (holdCard && holdCard.counter ? 4 : 5) && holdCard && !clock ? total(costOf(holdCard)) : 0;
    // lança: mana e redutores, compra, comandante, ameaças, resto
    for (let guard = 0; guard < 30; guard++) {
      const can = castables(turn, reserve);
      if (!can.length) break;
      const c = can[0];
      cast(c, turn);
    }
    // Mazemind Tome e Mind's Eye usam a mana que sobrar
    for (const c of [...me.misc, ...me.bf]) if (c.engine && c.engine.kind === 'activatedDraw' && pay({ gen: c.engine.cost || 2, W: 0, U: 0, B: 0, R: 0, G: 0, X: 0 })) draw(me, 1);
    for (const c of me.misc) if (c.engine && c.engine.kind === 'tome' && (c.uses || 0) < 4 && pay({ gen: 2, W: 0, U: 0, B: 0, R: 0, G: 0, X: 0 })) { c.uses = (c.uses || 0) + 1; draw(me, 1); if (c.uses === 4) me.life += 4; }
    me.eyeMana = available();
    // ataque com a força do turno anterior
    let atk = me.prevPower;
    const anth = me.bf.find(c => c.anthemAttack); if (anth && atk > 0) atk += anth.anthemAttack * Math.max(0, me.bf.length - 1);
    if (atk > 0) {
      attack(me, atk, turn);
      // trapaça do comandante ao atacar
      if (me.cmdOnBf && cmdM.cheat) {
        const pool = me.hand.filter(c => c.creature && (cmdM.cheat === 'creature' || c.artifact)).sort((a, b) => b.power - a.power);
        if (pool.length) { const c = pool[0]; me.hand.splice(me.hand.indexOf(c), 1); enter(c, turn, true); }
      }
      // Ironsoul: volta 1 artefato por turno
      for (const c of me.bf) if (c.recur && c.recur.kind === 'onePerTurn') { const g = me.gy.filter(x => x.artifact).sort((a, b) => b.cmc - a.cmc)[0]; if (g) { me.gy.splice(me.gy.indexOf(g), 1); enter(g, turn); } }
      // remoção ao atacar (Prowl)
      if (me.bf.some(c => c.attackRemoval)) removeFromOpp(0.35);
    }
    // combo próprio: as duas peças em campo, ou uma em campo e a outra na mão com mana para lançar
    if (combos.length && !rec.result) for (const [a, b] of combos) {
      const onBf = (n) => n === deck.cmd ? !!me.cmdOnBf : [...me.bf, ...me.misc, ...me.rocks].some(c => c.name === n);
      const inHand = (n) => me.hand.find(c => c.name === n) || (n === deck.cmd && !me.cmdOnBf ? cmdM : null);
      let ok = onBf(a) && onBf(b);
      if (!ok) { const miss = onBf(a) ? b : onBf(b) ? a : null; const c = miss && inHand(miss); if (c && pay(costOf(c), true)) ok = true; }
      if (ok) {
        const stop = opp.filter(o => o.alive).reduce((s, o) => s + (o.k === 'control' ? 0.35 : o.k === 'combo' ? 0.15 : 0.05), 0);
        if (R() < stop) { rec.comboStopped = (rec.comboStopped || 0) + 1; break; }
        rec.result = 'vence'; rec.how = 'combo'; rec.turn = turn; rec.combo = a + ' + ' + b; return;
      }
    }
    if (turn === 6) { rec.handT6 = me.hand.map(c => c.name); rec.landsT6 = me.lands.length; rec.rocksT6 = me.rocks.length; rec.manaT6 = manaPotential(); rec.uncastT6 = me.hand.filter(c => !c.land && total(costOf(c)) > rec.manaT6).length; }
    rec.manaT.push(manaPotential());
    // descarte até 7
    while (me.hand.length > 7) { me.hand.sort((a, b) => a.cmc - b.cmc); me.gy.push(me.hand.pop()); }
    me.prevPower = myPower();
    if (opts.trace) opts.trace.push(`T${turn} fim: terrenos ${me.lands.length} pedras ${me.rocks.length} campo ${me.bf.length} força ${myPower()} vida ${Math.round(me.life)} | mão: ${me.hand.map(c => c.name.split(",")[0] + (c.land ? "*" : "") + "(" + total(costOf(c)) + ")").join(", ")}`);
  }
  function neededColors() { const s = new Set(); for (const c of me.hand) for (const x of COLORS) if (c.cost && c.cost[x]) s.add(x); return s; }
  function prio(c, turn) {
    if (c === cmdM) return 70;
    if (c.mana && !c.land) return 100 - c.cmc;
    if (c.rampLands) return 95 - c.cmc;
    if (c.reduce && c.reduce.length) return 90 - c.cmc;
    if (c.engine) return 80;
    if (c.draw && !c.creature) return 60 + c.draw;
    if (c.creature) return 40 + c.power;
    if (c.protect && (c.protect.kind === 'forge' || c.protect.kind === 'hexArtifacts' || c.protect.kind === 'boots')) return 50;
    if (c.recur && c.recur.kind === 'all') return me.gy.filter(x => x.artifact).length >= 3 ? 65 : -1;
    if (c.wipe) return wipeWorth() ? 75 : -1;
    if (c.removal) return threatOpp() ? 55 : -1;
    if (c.tutor) return 45;
    if (c.pw) return 50;
    if (c.protect || c.counter) return -1; // fica na mão para responder
    if (c.ritual) return me.hand.some(x => !x.land && x !== c && total(costOf(x)) > available() && total(costOf(x)) <= available() + c.ritual - total(c.cost)) ? 85 : -1;
    if (c.fort) return 48;
    if (c.anthem) return 47;
    if (c.blank || !c.ok) return 5;
    return 20;
  }
  function castables(turn, reserve) {
    const list = me.hand.filter(c => !c.land);
    if (!me.cmdOnBf && !me.cmdInGy) list.push(cmdM);
    const avail = available();
    const out = [];
    for (const c of list) {
      const p = prio(c, turn); if (p < 0) continue;
      const cost = costOf(c);
      const keep = (c.mana || c.reduce.length) ? 0 : reserve;
      if (total(cost) > avail - keep) continue;
      if (!pay(cost, true)) continue;
      out.push([p, c]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.map(x => x[1]);
  }
  function cast(c, turn) {
    const cost = costOf(c);
    if (opts.trace) opts.trace.push(`T${turn} lança ${c.name} (${total(cost)}) disp ${available()}`);
    if (!pay(cost)) { me.hand.splice(me.hand.indexOf(c), 1); me.gy.push(c); return; }
    rec.castCount++;
    if (c === cmdM) { me.cmdOnBf = c; me.cmdTurnIn = turn; if (!rec.cmdTurn) rec.cmdTurn = turn; }
    else me.hand.splice(me.hand.indexOf(c), 1);
    // gatilhos de mágica
    if (c.colorless) for (const x of me.misc) if (x.uginEye) removeFromOpp(0.3);
    for (const x of [...me.bf, ...me.misc]) if (x.engine && x.engine.kind === 'creatureCast' && c.creature) draw(me, 1);
    if (c.uginEye) removeFromOpp(0.3);
    if (c.instant || c.sorcery) {
      if (c.ritual) me.treasures += c.ritual;
      if (c.tokenPower) addTokens(c.tokenPower);
      if (c.draw) draw(me, c.draw);
      if (c.drawCreatures) draw(me, me.bf.length);
      if (c.drawPower) draw(me, Math.max(0, ...me.bf.map(x => x.power)));
      if (c.rampLands) rampLand(c.rampLands, turn);
      if (c.removal) removeFromOpp(c.removal >= 1 ? 0.4 : c.removal);
      if (c.wipe) myWipe(c);
      if (c.recur && c.recur.kind === 'all') { const back = me.gy.filter(x => x.artifact); me.gy = me.gy.filter(x => !x.artifact); for (const x of back) enter(x, turn); }
      if (c.tutor) tutor();
      me.gy.push(c);
      return;
    }
    enter(c, turn);
  }
  function enter(c, turn, attacking) {
    const isRock = c.mana && !c.land;
    c.turnIn = turn;
    if (c.creature) { me.bf.push(c); c.ctr = 0; if (c.tokenPower) addTokens(c.tokenPower); if (c.rampLands) rampLand(c.rampLands, turn); for (const x of [...me.bf, ...me.misc]) if (x !== c && x.pinger) for (const o of opp) if (o.alive) { o.life -= 1; if (o.life <= 0) o.alive = false; } }
    else if (isRock) { me.rocks.push(c); c.turnIn = turn; c.sick = !!c.mana.dork; }
    else me.misc.push(c);
    if (isRock && c.creature) { me.rocks.push(c); c.turnIn = turn; c.sick = true; }
    if (!c.instant && !c.sorcery && c.draw) draw(me, c.draw);
    if (!c.creature && c.tokenPower) addTokens(c.tokenPower);
    if (c.treasureOnce) me.treasures += c.treasureOnce;
    if (c.etbRemoval) removeFromOpp(0.35);
    if (!c.creature && c.rampLands) rampLand(c.rampLands, turn);
    if (c.creature && c.artifact) {
      let once = false;
      for (const x of [...me.bf, ...me.misc]) if (x !== c && x.engine) {
        if (x.engine.kind === 'artCreatureEnter') draw(me, 1);
        if (x.engine.kind === 'artCreatureEnterOnce' && !once) { draw(me, 1); once = true; }
      }
    }
    if (attacking && c.creature) { /* entra atacando: o dano vai no próximo ataque */ }
  }
  function rampLand(n, turn) {
    for (let k = 0; k < n; k++) {
      const i = me.lib.findIndex(x => x.land && /Basic|Forest|Plains|Mountain|Island|Swamp/.test(x.raw && x.raw.t || ''));
      if (i < 0) return; const l = me.lib.splice(i, 1)[0];
      me.lands.push({ name: l.name, mana: l.mana, entersTapped: true, turnIn: turn, tappedNow: true, card: l });
    }
  }
  function tutor() {
    const avail = available() + 2;
    const best = me.lib.filter(x => !x.land && !x.blank).sort((a, b) => tutorScore(b, avail) - tutorScore(a, avail))[0];
    if (best) { me.lib.splice(me.lib.indexOf(best), 1); me.hand.push(best); }
  }
  function tutorScore(c, avail) { const cost = total(costOf(c)); let s = (c.power || 0) + (c.engine ? 6 : 0) + (c.cantLose ? 8 : 0) + (c.mana ? 3 : 0); if (cost > avail) s -= 6; return s; }
  function threatOpp() { return opp.some(o => o.alive && (o.power >= 10 || (o.k === 'combo' && o.power >= 6))); }
  function wipeWorth() { const theirs = Math.max(0, ...opp.filter(o => o.alive).map(o => o.power)); return theirs >= 15 && theirs > myPower() * 1.3; }
  function removeFromOpp(frac) { const t = opp.filter(o => o.alive).sort((a, b) => b.power - a.power)[0]; if (t && t.power > 0) t.power = Math.max(0, t.power - Math.max(2, Math.round(t.power * frac))); }
  function myWipe(c) {
    rec.wipes++;
    for (const o of opp) if (o.alive) o.power = Math.round(o.power * 0.15);
    const keep = me.bf.filter(x => (c.wipe.nonartifact && x.artifact) || (me.misc.some(m => m.protect && m.protect.kind === 'forge') && x.artifact));
    for (const x of me.bf) if (!keep.includes(x)) die(x);
    me.bf = keep; me.tokens = 0;
  }
  function die(x) {
    if (x === cmdM || x === me.cmdOnBf) { me.cmdOnBf = null; me.tax += 2; me.cmdDeaths++; return; }
    me.gy.push(x);
    if (x.deathDraw) draw(me, 1);
    if (me.misc.some(m => m.engine && m.engine.kind === 'clamp')) draw(me, 2 * (me.clampUsed ? 0 : 1));
  }
  // ----- oponentes -----
  function oppTurn(o, turn) {
    o.prev = o.power;
    const A = o.A;
    const step = A.curve[Math.min(13, turn - 1)] - (turn > 1 ? A.curve[Math.min(13, turn - 2)] : 0);
    o.power = Math.max(0, o.power + Math.max(0, step) * o.luck * OPP.scale);
    // compra do oponente (Mind's Eye e Smothering Tithe ouvem)
    for (const c of me.misc) {
      if (c.engine && c.engine.kind === 'mindseye' && (me.eyeMana || 0) > 0) { draw(me, 1); me.eyeMana--; }
      if (c.engine && c.engine.kind === 'rhystic' && R() < 0.6) draw(me, 1);
      if (c.engine && c.engine.kind === 'remora' && turn <= 4 && R() < 0.5) draw(me, 1);
    }
    // remoção (a partir do T3)
    if (turn >= 3 && R() < A.removal * (opts.interaction == null ? 1 : opts.interaction)) {
      // a remoção vai no jogador mais forte da mesa (pode ser você ou outro oponente)
      const cands = [me, ...opp.filter(x => x.alive && x !== o)].map(x => [pw(x) + R() * 0.01, x]).sort((a, b) => b[0] - a[0]);
      const t = cands[0][1];
      if (t === me) oppRemoval(); else t.power = Math.max(0, t.power - Math.max(2, t.power * 0.3));
    }
    // wipe (T5+), mais provável quando você está ganhando
    let wr = A.wipe * (opts.interaction == null ? 1 : opts.interaction) * (myPower() > 25 ? 1.5 : 1);
    if (turn >= 5 && R() < wr) { if (!tryCounter()) oppWipe(o); }
    // combo
    if (A.combo && turn >= (A.comboFrom || 7) && R() < A.combo) { if (tryCounter()) return; if (!me.misc.some(c => c.cantLose) && !me.bf.some(c => c.cantLose)) { rec.result = 'combo'; rec.turn = turn; } return; }
    // ataque
    if (o.prev > 0) attack(o, o.prev, turn);
  }
  function tryCounter() {
    const cs = me.hand.filter(c => c.counter).sort((a, b) => (b.freeCounter - a.freeCounter));
    for (const c of cs) {
      if (c.freeCounter && (me.cmdOnBf || /exile a blue card/.test(c.raw.o)) ) { me.hand.splice(me.hand.indexOf(c), 1); me.gy.push(c); rec.counters = (rec.counters || 0) + 1; return true; }
      if (pay(costOf(c))) { me.hand.splice(me.hand.indexOf(c), 1); me.gy.push(c); rec.counters = (rec.counters || 0) + 1; return true; }
    }
    return false;
  }
  function protectedFrom(target, exile) {
    if (target === me.cmdOnBf && me.misc.some(c => c.protect && c.protect.kind === 'boots')) return true;
    if (target.artifact && [...me.bf, ...me.misc].some(c => c !== target && c.protect && c.protect.kind === 'hexArtifacts')) return true;
    if (target.ward && R() < 0.5) return true;
    if (target.artifact && !exile && me.misc.some(c => c.protect && c.protect.kind === 'forge')) return true;
    // Deflecting Swat (grátis com comandante em campo)
    const swat = me.hand.find(c => c.protect && c.protect.kind === 'swat');
    if (swat && me.cmdOnBf) { me.hand.splice(me.hand.indexOf(swat), 1); me.gy.push(swat); return true; }
    const single = me.hand.find(c => c.protect && (c.protect.kind === 'single' || c.protect.kind === 'saveAll'));
    if (single && (target === me.cmdOnBf || target.power >= 6) && pay(costOf(single))) { me.hand.splice(me.hand.indexOf(single), 1); me.gy.push(single); return true; }
    if ((target === me.cmdOnBf || target.power >= 6) && tryCounter()) return true;
    return false;
  }
  function oppRemoval() {
    if (opts.trace) opts.trace.push('   remoção em você');
    const exile = R() < 0.3;
    let target = me.cmdOnBf || me.bf.slice().sort((a, b) => b.power - a.power)[0];
    if (!target) return;
    if (protectedFrom(target, exile)) return;
    if (target === me.cmdOnBf) { me.cmdOnBf = null; me.tax += 2; me.cmdDeaths++; return; }
    me.bf.splice(me.bf.indexOf(target), 1);
    if (exile) return; die(target);
  }
  function oppWipe(o) {
    if (opts.trace) opts.trace.push('   WIPE de ' + o.k);
    rec.wipes++;
    for (const x of opp) if (x.alive) x.power = Math.round(x.power * 0.15);
    const save = me.hand.find(c => c.protect && c.protect.kind === 'saveAll');
    if (save && (me.misc.some(c => c.clock) || pay(costOf(save)))) { me.hand.splice(me.hand.indexOf(save), 1); me.gy.push(save); return; }
    const forge = me.misc.some(c => c.protect && c.protect.kind === 'forge');
    const keep = forge ? me.bf.filter(x => x.artifact) : [];
    if (me.cmdOnBf && !(forge && cmdM.artifact)) { me.cmdOnBf = null; me.tax += 2; me.cmdDeaths++; }
    for (const x of me.bf) if (!keep.includes(x)) die(x);
    me.bf = keep; me.tokens = 0; me.tokenCount = 0;
  }
  function attack(src, power, turn) {
    const alive = (src === me ? opp.filter(o => o.alive) : [me, ...opp.filter(o => o.alive && o !== src)]);
    if (!alive.length) return;
    let target;
    if (R() < 0.5) target = alive.map(x => [pw(x) + R() * 0.01, x]).sort((a, b) => b[0] - a[0])[0][1]; else target = alive[Math.floor(R() * alive.length)];
    const evasion = src === me ? (me.bf.filter(c => c.evasive).length / Math.max(1, me.bf.length)) * 0.5 : src.A.evasion;
    const blocked = Math.min(power, 0.5 * pw(target)) * (1 - evasion);
    const dmg = Math.max(0, power - blocked) + (src === me && me.cmdOnBf && cmdM.power ? 0 : 0);
    const fort = target === me && [...me.misc, ...me.bf].some(c => c.fort);
    const realDmg = fort ? dmg * 0.6 : dmg;
    target.life -= realDmg;
    if (src === me && realDmg > 0) for (const c of [...me.misc, ...me.bf]) if (c.engine && c.engine.kind === 'bident') draw(me, 1);
    if (target.life <= 0) {
      if (target === me) {
        if (me.misc.some(c => c.cantLose) || me.bf.some(c => c.cantLose)) { me.life = 1; return; }
        me.alive = false; rec.result = 'morre'; rec.turn = turn;
      } else { target.alive = false; }
    }
  }
  function pw(p) { return p === me ? myPower() : p.power; }
}

// Para criaturas, a força vem do Scryfall; a base compacta não guarda, então o índice é montado de fora (setPowers).

// ---------- rodar muitas partidas ----------
function runMany(deck, opts) {
  const n = opts.n || 2000; const out = [];
  for (let k = 0; k < n; k++) out.push(play(deck, Object.assign({}, opts, { seed: (opts.seed0 || 1) * 1000003 + k * 7919 })));
  return out;
}
function summarize(recs) {
  const n = recs.length; const c = (f) => recs.filter(f).length / n;
  const wins = recs.filter(r => r.result === 'vence');
  return {
    n, win: c(r => r.result === 'vence'), die: c(r => r.result === 'morre'), combo: c(r => r.result === 'combo'), late: c(r => r.result === 'tarde'),
    winTurn: wins.length ? wins.reduce((s, r) => s + r.turn, 0) / wins.length : 0,
    powerT8: recs.reduce((s, r) => s + r.power[7], 0) / n,
    stuckT7: c(r => r.power[6] < 8),
    cmdDeaths: recs.reduce((s, r) => s + r.cmdDeaths, 0) / n,
    se: Math.sqrt(c(r => r.result === 'vence') * (1 - c(r => r.result === 'vence')) / n),
  };
}

// ---------- calibração: 4 arquétipos na mesa, sem deck ----------
function playArch(keys, seed, interaction) {
  const R = rng(seed);
  const P = keys.map((k, i) => ({ i, k, A: ARCH[k], life: 40, power: 0, prev: 0, luck: Math.max(0.35, 1 + 0.28 * gauss(R)), alive: true }));
  const order = shuffle([0, 1, 2, 3], R);
  const inter = interaction == null ? 1 : interaction;
  for (let turn = 1; turn <= 14; turn++) {
    for (const w of order) {
      const o = P[w]; if (!o.alive) continue;
      o.prev = o.power;
      const A = o.A; const step = A.curve[Math.min(13, turn - 1)] - (turn > 1 ? A.curve[Math.min(13, turn - 2)] : 0);
      o.power = Math.max(0, o.power + Math.max(0, step) * o.luck);
      const others = P.filter(x => x.alive && x !== o);
      if (turn >= 3 && R() < A.removal * inter) { const t = others.map(x => [x.power + R() * 0.01, x]).sort((a, b) => b[0] - a[0])[0][1]; if (t) t.power = Math.max(0, t.power - Math.max(2, t.power * 0.3)); }
      const lead = Math.max(...others.map(x => x.power));
      if (turn >= 5 && R() < A.wipe * inter * (lead > 25 ? 1.5 : 1)) for (const x of P) if (x.alive) x.power = Math.round(x.power * 0.15);
      if (A.combo && turn >= (A.comboFrom || 7) && R() < A.combo) return { winner: w, how: 'combo', turn };
      if (o.prev > 0 && others.length) {
        const t = R() < 0.5 ? others.map(x => [x.power + R() * 0.01, x]).sort((a, b) => b[0] - a[0])[0][1] : others[Math.floor(R() * others.length)];
        const blocked = Math.min(o.prev, 0.5 * t.power) * (1 - A.evasion);
        t.life -= Math.max(0, o.prev - blocked); if (t.life <= 0) t.alive = false;
      }
      const alive = P.filter(x => x.alive); if (alive.length === 1) return { winner: alive[0].i, how: 'last', turn };
    }
  }
  const alive = P.filter(x => x.alive).map(x => [x.life + 2 * x.power + R() * 0.01, x]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  return { winner: alive[0].i, how: 'late', turn: 14 };
}
function calibrate(n = 20000) {
  const ks = ['aggro', 'midrange', 'control', 'combo']; const out = {};
  for (const k of ks) { let w = 0; for (let s = 0; s < n; s++) { const R = rng(s * 31 + 7); const keys = [k, ks[Math.floor(R() * 4)], ks[Math.floor(R() * 4)], ks[Math.floor(R() * 4)]]; if (playArch(keys, s * 131 + 3).winner === 0) w++; } out[k] = w / n; }
  out.media = (out.aggro + out.midrange + out.control + out.combo) / 4; return out;
}
const API = { deckCombos, OPP, playArch, calibrate, init, model, play, runMany, summarize, ARCH, TABLES, setPowers, parseCost, total, MODELS };
root.SIM = API;
if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
