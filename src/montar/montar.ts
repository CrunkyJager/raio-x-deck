/* Raio-X do Deck: aba Montar — construtor de decks com busca na base, análise ao vivo e ida e volta com o Moxfield. */
// T43 (c): era o montar.js (script clássico dentro de uma função anônima); virou módulo ES, carregado pelo src/main.ts.
// T43 (d): virou montar.ts estrito, só com anotações de tipo (o JS que sai é o mesmo). Conversa com as outras partes
// pelos mesmos window.* de antes até as telas virarem Svelte; o tipo do window.RAIOX vem do analise.ts (RaioX).
import type { RaioX, Carta, Analise } from '../analise/analise';
import { mount, flushSync } from 'svelte';
import Montar from '../telas/montar/Montar.svelte';
type Dic<T = any> = Record<string, T>;
type Campo = HTMLInputElement;   // input, select ou textarea: aqui só se lê e escreve o value
/** um deck salvo: comandantes, cartas (nome → cópias), alvo (bracket e orçamento) e o estado da montagem guiada */
interface Deck { nome: string; cmds: string[]; cartas: Dic<number>; alvo: { br: string; teto: string; tetoCarta?: string }; t: number; passo?: number; ideia?: { texto: string; man: Dic<boolean> | null }; recusadas?: Dic<number> }
/** D() sempre devolve o deck com passo, ideia e recusadas preenchidos */
type DeckPronto = Deck & Required<Pick<Deck, 'passo' | 'ideia' | 'recusadas'>>;
interface Salvos { atual: string | null; decks: Dic<Deck> }
/** linha do índice da busca: nome, nome normalizado, nomes em português, tipo, identidade, valor de mana, posição, banida */
interface Item { n: string; k: string; pt: string; t: string; ci: string; v: number; r: number; ban: boolean }
const R: RaioX = window.RAIOX;   // o src/main.ts só carrega o Montar se a Análise subiu (antes: if (!R) return)
// o código sempre supôs que o elemento existe: o tipo segue a mesma suposição (como no analise.ts)
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => (<Dic<string>>{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// C(n) devolve null para nome fora da base; o Montar quase sempre pergunta por nome que veio da própria base, então o
// tipo aqui é Carta (o código que já testava o null continua testando)
const { C, norm, rolesOf, isLand, canBeCommander, brl, manaHTML, ROLES, DB } = R as Omit<RaioX, 'C'> & { C: (n: string) => Carta };

// ---------- decks salvos (localStorage) ----------
const KEY = 'raiox:montar';
let S: Salvos = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })() || { atual: null, decks: {} };
const salva = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const novoId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function novoDeck(nome?: string) { const id = novoId(); S.decks[id] = { nome: nome || 'Deck novo', cmds: [], cartas: {}, alvo: { br: '', teto: '' }, t: Date.now() }; S.atual = id; salva(); return S.decks[id]; }
const D = (): DeckPronto => { const d = S.decks[S.atual!] || novoDeck(); if (!d.passo) d.passo = d.cmds.length ? (Object.keys(d.cartas).length ? 4 : 2) : 1; if (!d.ideia) d.ideia = { texto: '', man: null }; if (!d.recusadas) d.recusadas = {}; if (!d.alvo) d.alvo = { br: '', teto: '' }; return d as DeckPronto; };
const toque = () => { D().t = Date.now(); salva(); };

// ---------- regras de cópia e identidade ----------
const isBasic = (c: Carta) => /Basic/.test(c.t) && isLand(c);
const multiOk = (c: Carta) => isBasic(c) || R.ANY_NUMBER.test(c.o || '');
const ident = () => new Set(D().cmds.map(n => (C(n) || {}).ci || '').join('').split('').filter(Boolean));
const cabeCor = (c: Carta, I: Set<string>) => (c.ci || '').split('').every(x => !x || I.has(x));
const temPar = (c: Carta) => /Partner|Choose a Background|Friends forever|Doctor's companion/.test(c.o || '') || /Background/.test(c.t);
const total = () => D().cmds.length + Object.values(D().cartas).reduce((s, q) => s + q, 0);

// ---------- índice leve para a busca ----------
let IX: Item[] | null = null;
function indice() {
  if (IX) return IX;
  const F: Dic<number> = Object.fromEntries(DB.fields.map((f: string, i: number) => [f, i]));
  const pt: Dic<string[]> = {}; for (const [k, en] of Object.entries<string>(R.PTIDX || {})) (pt[en] = pt[en] || []).push(k);
  IX = Object.keys(DB.cards).map(n => { const e = DB.cards[n]; return { n, k: norm(n), pt: (pt[n] || []).join(' '), t: e[F.t], ci: e[F.ci], v: e[F.v], r: e[F.r] || 1e6, ban: !!e[F.ban] }; });
  return IX;
}
const ROLEC = new Map<string, Set<string>>();
const papeis = (n: string) => { if (!ROLEC.has(n)) ROLEC.set(n, rolesOf(C(n))); return ROLEC.get(n)!; };
const TIPOS = [['', 'Todos os tipos'], ['Creature', 'Criatura'], ['Instant', 'Instantânea'], ['Sorcery', 'Feitiço'], ['Artifact', 'Artefato'], ['Enchantment', 'Encantamento'], ['Planeswalker', 'Planeswalker'], ['Land', 'Terreno'], ['Battle', 'Batalha']];
const GRUPOS = [['Creature', 'Criaturas'], ['Planeswalker', 'Planeswalkers'], ['Instant', 'Instantâneas'], ['Sorcery', 'Feitiços'], ['Artifact', 'Artefatos'], ['Enchantment', 'Encantamentos'], ['Battle', 'Batalhas'], ['Land', 'Terrenos']];
const grupoDe = (c: Carta) => { const f = c.t.split(' // ')[0]; if (/Land/.test(f)) return 'Land'; for (const [k] of GRUPOS) if (new RegExp(k).test(f)) return k; return 'Artifact'; };
let Q: { txt: string; tipo: string; papel: string; cmc: string; cor: string; cmd: boolean; pag: number; [k: string]: any } = { txt: '', tipo: '', papel: '', cmc: '', cor: '', cmd: false, pag: 40 };

function busca() {
  const I = ident(), modoCmd = !D().cmds.length || Q.cmd;
  const q = norm(Q.txt), deck = D();
  const out: Item[] = [];
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
  out.sort((a, b) => (q ? (<number><unknown>b.k.startsWith(q) - <number><unknown>a.k.startsWith(q)) : 0) || a.r - b.r);
  let res = out;
  if (!modoCmd && Q.papel) { res = []; for (const x of out) { if (papeis(x.n).has(Q.papel)) res.push(x); if (res.length >= Q.pag + 1) break; } }
  return { lista: res.slice(0, Q.pag), mais: res.length > Q.pag, modoCmd };
}

// ---------- texto do deck (formato que o Moxfield, o Archidekt e a aba Lista entendem) ----------
function texto(d = D()) {
  const linhas: string[] = [];
  if (d.cmds.length) linhas.push('Commander', ...d.cmds.map(n => '1 ' + n), '', 'Deck');
  for (const [n, q] of Object.entries(d.cartas).sort((a, b) => a[0].localeCompare(b[0]))) linhas.push(q + ' ' + n);
  return linhas.join('\n');
}
function deTexto(txt: string, nome?: string): { erro: string; d?: undefined; unknown?: undefined } | { erro?: undefined; d: Deck; unknown: string[] } {
  const p = R.parseList(txt); if (!p.cards.length) return { erro: 'Não reconheci nenhuma carta.' + (p.unknown.length ? ' Exemplos do que não achei: ' + p.unknown.slice(0, 5).join(', ') : '') };
  const cmds = R.guessCommanders(p);
  const cartas: Dic<number> = {}; const resto = p.cards.slice(); for (const c of cmds) { const i = resto.indexOf(c); if (i >= 0) resto.splice(i, 1); }
  for (const n of resto) cartas[n] = (cartas[n] || 0) + 1;
  const d = novoDeck(nome || (cmds[0] ? cmds[0].split(',')[0] : 'Deck importado')); d.cmds = cmds; d.cartas = cartas; salva();
  return { d, unknown: p.unknown };
}

// ---------- análise ao vivo ----------
let A: Analise | null = null;
function analisa() { const d = D(); A = (d.cmds.length && total() > d.cmds.length) ? R.analyze(texto(d), d.cmds) : null; if (A && A.empty) A = null; }
const LIM_GC: Dic<number> = { 2: 0, 3: 3 };

// ---------- desenho ----------
// T43 (d): o HTML da tela está nos componentes de src/telas/montar (Montar.svelte e um por painel). Aqui fica o estado
// (decks salvos, busca, passos) e as ações; cada ação muda o estado e chama desenha(), que refaz a tela inteira, como
// o innerHTML de antes (o Montar.svelte troca o {#key}), ou só o painel da busca enquanto se digita.
const ROOT = () => $('#montar');
const contar = (d: Deck) => d.cmds.length + Object.values(d.cartas).reduce((s, q) => s + q, 0);
let TELA: { tudo: () => void; busca: () => void } | null = null;
let VIVA: ReturnType<typeof mount> | null = null;
function desenha(soBusca?: boolean) {
  const root = ROOT(); if (!root) return;
  if (soBusca && TELA && $('.mt-busca', root)) {
    const y = window.scrollY; const foco = document.activeElement && document.activeElement.id; const pos = foco === 'mt-q' ? (document.activeElement as HTMLInputElement).selectionStart : null;
    TELA.busca(); flushSync();
    if (foco) { const el = $<HTMLInputElement>('#' + foco); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } }
    window.scrollTo(0, y); return;
  }
  // tirar da tela o campo com foco dispara o change dele de novo, no meio do flushSync: essa ação entra na fila e a
  // tela é refeita mais uma vez depois (com o innerHTML de antes o desenho aninhado não fazia mal)
  if (PINTANDO) { DE_NOVO = true; return; }
  PINTANDO = true;
  try {
    do {
      DE_NOVO = false;
      const d = D(); if (!d.cmds.length && d.passo > 1) d.passo = 1;
      analisa();
      if (TELA) TELA.tudo(); else VIVA = mount(Montar, { target: root, props: { mt: API } });
      flushSync();
    } while (DE_NOVO);
  } finally { PINTANDO = false; }
  G.imagens(root);
}
let PINTANDO = false, DE_NOVO = false;
// redesenha tudo, sem perder o lugar da tela nem o campo de busca
function atualiza() { const y = window.scrollY; const lista = $('#mt-lista'); const ly = lista ? lista.scrollTop : 0; const foco = document.activeElement && document.activeElement.id; desenha(); window.scrollTo(0, y); const l2 = $('#mt-lista'); if (l2) l2.scrollTop = ly; if (foco === 'mt-q') $('#mt-q').focus(); }
const rolaPara = (s: string, folga: number) => { const t = $(s); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - folga); };

const msg = (t: string, id = 'mt-msg') => { const el = $('#' + id); if (el) el.textContent = t; };
function poe(n: string) {
  const c = C(n); if (!c) return; const d = D();
  if (d.cartas[n] && !multiOk(c)) return;
  d.cartas[n] = (d.cartas[n] || 0) + 1; toque(); atualiza();
}
let BT: any = null;
const abreImp = () => { $<HTMLDetailsElement>('#mt-imp').open = true; };
// ações dos painéis do passo 4 e do topo (antes: liga(), que punha onclick/onchange depois de cada innerHTML)
const acoes = {
  selDeck(id: string) { S.atual = id; salva(); Q.cmd = false; desenha(); },
  nome(v: string) { D().nome = v.trim() || 'Deck sem nome'; toque(); desenha(); },
  novo() { novoDeck(); Q = { ...Q, txt: '', cmd: false }; desenha(); $('#mt-q') && $('#mt-q').focus(); },
  dup() { const o = D(); const n = novoDeck(o.nome + ' (cópia)'); n.cmds = o.cmds.slice(); n.cartas = { ...o.cartas }; n.alvo = { ...o.alvo }; salva(); desenha(); },
  apaga() { const d = D(); if (!confirmar('Apagar o deck "' + d.nome + '"?')) return; delete S.decks[S.atual!]; S.atual = Object.keys(S.decks).sort((a, b) => S.decks[b].t - S.decks[a].t)[0] || null; if (!S.atual) novoDeck(); salva(); desenha(); },
  impTexto(t: string) { const r = deTexto(t); if (r.erro) { msg(r.erro, 'mt-imp-msg'); return; } desenha(); msg(`Importado: ${contar(r.d!)} cartas${r.unknown!.length ? `. Não reconheci ${r.unknown!.length}: ${r.unknown!.slice(0, 6).join(', ')}` : ''}.`, 'mt-imp-msg'); abreImp(); },
  impLista() { const t = ($<Campo>('#deck-in') || <Campo>{}).value || ''; const r = deTexto(t, 'Da aba Lista'); if (r.erro) { msg('A aba Lista está vazia. ' + r.erro, 'mt-imp-msg'); return; } desenha(); msg(`Trazido da Lista: ${contar(r.d!)} cartas.`, 'mt-imp-msg'); abreImp(); },
  impArch: (url: string) => archidekt(url),
  // busca
  buscaTxt(v: string) { Q.txt = v; Q.pag = 40; clearTimeout(BT); BT = setTimeout(() => desenha(true), 140); },
  filtro(k: 'tipo' | 'papel' | 'cmc', v: string) { Q[k] = v; Q.pag = 40; desenha(true); },
  cor(x: string) { Q.cor = x; Q.pag = 40; desenha(true); },
  mais() { Q.pag += 40; desenha(true); },
  cmdX() { Q.cmd = false; Q.txt = ''; desenha(); },
  cmd2() { Q.cmd = true; Q.txt = ''; desenha(); $('#mt-q').focus(); },
  limpa() { if (!confirmar('Tirar todas as cartas (o comandante fica)?')) return; D().cartas = {}; toque(); atualiza(); },
  // análise
  alvo(k: 'br' | 'teto', v: string) { D().alvo[k] = k === 'teto' ? v.trim() : v; toque(); atualiza(); },
  buscarPapel(papel: string, tipo: string) { Q = { ...Q, txt: '', papel, tipo, cmc: '', cor: '', cmd: false, pag: 40 }; desenha(); rolaPara('.mt-busca', 90); },
  // saída
  async copia() { try { await navigator.clipboard.writeText(texto()); msg('Lista copiada. No Moxfield: Create Deck → Import → colar.'); } catch (e) { msg('Não deu para copiar daqui. Use "Baixar .txt".'); } },
  baixa() { const d = D(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto()], { type: 'text/plain' })); a.download = (d.nome || 'deck').replace(/[^\w\- ]+/g, '').trim() + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  analisar() { $<Campo>('#deck-in').value = texto(); R.run(D().cmds.slice(), 'resumo'); },
  mesa() {
    const d = D();
    try { const k = 'raiox:amigos'; const am = JSON.parse(localStorage.getItem(k) || '[]').filter((a: { nome: string }) => a.nome !== d.nome); am.push({ nome: d.nome, lista: texto() }); localStorage.setItem(k, JSON.stringify(am)); } catch (e) {}
    msg(`"${d.nome}" entrou na Mesa simulada como deck de amigo. Para ele jogar como o seu deck, use "Analisar no Raio-X".`);
    document.dispatchEvent(new CustomEvent('raiox:amigos'));
  },
};
const confirmar = (t: string) => { try { return window.confirm(t); } catch (e) { return true; } };

// =====================================================================
// Construção guiada: 1 cores e comandante → 2 a ideia → 3 montar junto → 4 ajuste fino
// =====================================================================
const G = (() => {
  const ORDEM = 'WUBRG';
  const ordena = (s: string) => [...new Set(String(s).split(''))].filter(x => ORDEM.includes(x)).sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b)).join('');
  const NOMES: Dic<string> = {
    '': 'Incolor', W: 'Branco', U: 'Azul', B: 'Preto', R: 'Vermelho', G: 'Verde',
    WU: 'Azorius', UB: 'Dimir', BR: 'Rakdos', RG: 'Gruul', WG: 'Selesnya', WB: 'Orzhov', UR: 'Izzet', BG: 'Golgari', WR: 'Boros', UG: 'Simic',
    WUB: 'Esper', UBR: 'Grixis', BRG: 'Jund', WRG: 'Naya', WUG: 'Bant', WBG: 'Abzan', WUR: 'Jeskai', UBG: 'Sultai', WBR: 'Mardu', URG: 'Temur',
    WUBR: 'Sem verde (Yore-Tiller)', UBRG: 'Sem branco (Glint-Eye)', WBRG: 'Sem azul (Dune-Brood)', WURG: 'Sem preto (Ink-Treader)', WUBG: 'Sem vermelho (Witch-Maw)', WUBRG: 'Cinco cores',
  };
  const nomeCores = (k: string | null) => k == null ? 'todas as cores' : (NOMES[ordena(k)] || ordena(k));
  const pipsHTML = (k: string | null) => k == null ? ORDEM.split('').map(x => `<span class="ms ${x}"></span>`).join('') : k ? k.split('').map(x => `<span class="ms ${x}"></span>`).join('') : '<span class="ms">C</span>';
  const temaNome = (k: string) => (R.THEMES.find(t => t.k === k) || {}).n || k;

  // ---------- comandantes: perfil (temas e tribo) ----------
  let TIPOS_CRI: Set<string> | null = null;
  function tiposCriatura() {
    if (TIPOS_CRI) return TIPOS_CRI;
    const s = new Set<string>();
    for (const x of indice()) if (/Creature/.test(x.t)) for (const t of R.subtypes(C(x.n))) if (t.length > 2) s.add(t);
    TIPOS_CRI = s; return s;
  }
  const PLURAL: Dic<string> = { Elf: 'Elves', Dwarf: 'Dwarves', Wolf: 'Wolves', Werewolf: 'Werewolves', Fungus: 'Fungi', Sphinx: 'Sphinxes', Fox: 'Foxes', Ox: 'Oxen', Mouse: 'Mice', Octopus: 'Octopuses', Djinn: 'Djinn', Leech: 'Leeches', Witch: 'Witches', Lynx: 'Lynxes', Phoenix: 'Phoenixes', Thief: 'Thieves' };
  function triboDe(c: Carta) {
    const o = (c.o || '').split('\n//\n')[0];
    const tipos = tiposCriatura();
    const achou: string[] = [];
    for (const t of tipos) {
      const pl = PLURAL[t] || t + 's';
      const rx = new RegExp(`\\b${pl}\\b|\\b(?:other|another) ${t}\\b|\\b${t} (?:spells?|cards?|creatures? you control|you control)\\b|\\bnon-?${t}\\b`);
      if (rx.test(o)) achou.push(t);
    }
    if (!achou.length) return '';
    const proprios = R.subtypes(c);
    return achou.find(t => proprios.includes(t)) || achou[0];
  }
  const PERF = new Map<string, { temas: string[]; tribo: string }>();
  function perfil(n: string) {
    if (PERF.has(n)) return PERF.get(n)!;
    const c = C(n);
    const p = { temas: [...R.themesOf(c)], tribo: triboDe(c) };
    PERF.set(n, p); return p;
  }
  let CMDS: { n: string; k: string; pt: string; ci: string; r: number; usd: number }[] | null = null;
  function comandantes() {
    if (CMDS) return CMDS;
    CMDS = indice().filter(x => !x.ban && canBeCommander(C(x.n))).map(x => ({ n: x.n, k: x.k, pt: x.pt, ci: ordena(x.ci || ''), r: x.r, usd: C(x.n).usd || 0 }));
    return CMDS;
  }

  // ---------- passo 1: cores e comandante ----------
  let P1: { cores: string | null; modo: string; tema: string; txt: string; ord: string; pag: number } = { cores: null, modo: 'exato', tema: '', txt: '', ord: 'pop', pag: 24 };
  function listaCmds() {
    const q = norm(P1.txt);
    let l = comandantes();
    if (q) l = l.filter(x => x.k.includes(q) || (x.pt && x.pt.includes(q)));
    else if (P1.cores !== null) {
      const alvo: string = P1.cores;
      if (P1.modo === 'exato') l = l.filter(x => x.ci === alvo);
      else l = l.filter(x => x.ci.split('').every(c => alvo.includes(c)));
    }
    if (P1.tema) l = l.filter(x => { const p = perfil(x.n); return P1.tema === 'tribo' ? !!p.tribo : p.temas.includes(P1.tema); });
    l = l.slice().sort(P1.ord === 'preco' ? (a, b) => a.usd - b.usd || a.r - b.r : (a, b) => a.r - b.r);
    return l;
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
    const on = temasIdeia(); const man: Dic<boolean> = {}; for (const x of CONC()) man[x.k] = on.has(x.k);
    try {
      const k = 'raiox:conceito:' + d.cmds.join('+');
      const old = JSON.parse(localStorage.getItem(k) || '{}');
      localStorage.setItem(k, JSON.stringify(Object.assign(old, { text: d.ideia.texto || '', man, mode: old.mode || 'seguir', br: d.alvo.br || '', teto: d.alvo.teto || '', tetoCarta: d.alvo.tetoCarta || '' })));
    } catch (e) {}
  }
  const BR_TX: Dic<string> = { '': 'Sem limite: a ferramenta só sugere, não barra nada.', 2: 'Bracket 2 (casual): sem game changers, sem destruir terrenos em massa, sem turnos extras em sequência, poucos tutores.', 3: 'Bracket 3 (otimizado): até 3 game changers, sem destruir terrenos em massa, sem turnos extras em sequência.', 4: 'Bracket 4 (alto poder): vale tudo que não é banido.' };

  // ---------- passo 3: montar junto ----------
  const num = (v: unknown) => parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')) || 0;
  let POOL: Carta[] | null = null, POOLK = '';
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
  const canBeCommanderOnly = (c: Carta) => /Background/.test(c.t) && !/Creature/.test(c.t); // antecedentes só como segundo comandante
  const isLandC = (c: Carta) => isLand(c);
  function encaixa(c: Carta, on: Set<string>, tb: string) {
    if (isLandC(c)) return [];
    const out: string[] = [];
    for (const k of on) {
      if (k === 'tribe') { if (tb && (R.subtypes(c).includes(tb) || /Changeling/.test(c.o) || new RegExp('\\b' + tb + '|' + (PLURAL[tb] || tb + 's') + '\\b').test(c.o))) out.push(k); }
      else if (k === 'flying') { if (/Flying/.test(c.o)) out.push(k); }
      else if (R.themesOf(c, new Set([k])).has(k)) out.push(k);
    }
    return out;
  }
  interface Meta { base: number[]; contraAzul: number; verde: number; azulCompra: number; tema: Dic<number[]>; tribo: Dic<number[]>; bracket: Dic<number[]>; barato: number[]; terrenos: { a: number; b: number; tema: Dic<number>; bracket: Dic<number>; barato: number } }
  // metas do Passo 3 calibradas nos decks médios do EDHREC (ferramentas/calibra, 382 decks: os 10 comandantes mais jogados de cada tema,
  // 3 de cada tribo, e 36 comandantes em cada bracket e no orçamento baixo). Ordem: ramp, compra, remoção, limpa-mesa, proteção, contramágica.
  // Tema/tribo/bracket/orçamento = diferença para a média geral (tema já sem o efeito da cor). Gerado por ferramentas/calibra/gera_meta.py.
  const META: Meta = { base: [10,13.6,7.3,2.5,5.2,1.8], contraAzul: 3.7, verde: 2.1, azulCompra: 0.5,
    tema: { voltron: [-2,-3.6,-2.1,-0.6,9,-0.1], tokens: [-0.7,-2.6,0.5,-0.2,-1,0.5], counters: [-0.4,-0.7,-0.7,-0.3,1,-0.5], graveyard: [0.1,2,0.3,-0.2,-2.6,-0.4], artifacts: [2.4,1.6,-1.7,-0.6,-0.1,-0.1], enchant: [-0.9,0.8,1.2,-0.5,1.4,-1.5], spells: [1.1,7.3,1.8,-0.1,-2,1], sac: [-0.3,-3.2,1.9,1.3,-2.7,-0.3], life: [-0.9,-1.8,0.5,0.5,-2.1,0.1], lands: [2.8,-1.5,-2.4,-1.3,-2.2,-0.8], combat: [0.2,-4,0.9,0.1,2,0], draw: [0.1,10.9,-0.6,-0.3,-1.9,0.7], flying: [0.5,-2.2,-0,0.4,0.8,0.5], tribe: [-0.5,-1.1,0.5,0.3,0.3,0.2] },
    tribo: { Elf: [1.7,-1.1,0.7,-0.1,1.4,-0.9], Goblin: [-1.2,-0.7,1.4,-0.1,-1,-0.9], Zombie: [-1.2,-2.6,-0.8,1.4,-0.6,0.3], Dragon: [0.9,-2.1,1.2,0.3,-0.6,-0.4], Vampire: [-1,0.4,0.4,0.6,-1.1,-0.9], Merfolk: [-1.8,1.9,-1.3,0.8,0.4,2.6], Angel: [-0.7,-2.2,0.6,1.1,3.2,-0.9], Dinosaur: [-0.3,-0.1,1.7,0.1,0.4,-0.9], Wizard: [-0.3,0.4,1.4,0.6,-1.1,2.9], Human: [0.3,-0.4,1.4,-0.1,1.2,0.1], Sliver: [-0.8,-4.3,-1.1,-0.6,0.9,-0.4], Cat: [-1.6,-2.4,-0.1,-0.4,0.5,-0.9] },
    bracket: { 1: [-0.3,0.9,1.1,-0.2,-0.9,-0.5], 2: [-0.2,1.1,1,0.2,-0.6,-0.6], 3: [-0.1,0.1,0,0,0.1,-0.1], 4: [-1.1,-1.2,-1.2,0.1,0.8,0.6] },
    barato: [-0.1,2.2,2.4,-0,-1.7,-0.6],
    // terrenos = a + b × custo médio das mágicas (regressão nos decks médios) + a mais/a menos por tema, bracket e orçamento
    terrenos: { a: 31.53, b: 1.28, tema: { voltron: 0.1, tokens: -0.4, counters: 0.3, graveyard: 0.4, artifacts: -1, enchant: -0.2, spells: -0.7, sac: -0.6, life: -0.3, lands: 1.9, combat: -0.5, draw: 0.1, flying: -0.5, tribe: -0.2 }, bracket: { 1: 1, 2: 0.5, 3: 0.2, 4: -0.5 }, barato: 1 } };
  window.RAIOX_METAS = (on: Set<string>, I: Set<string>, d: Deck, tb: string) => metas(on, I, d, tb); // para a análise usar as mesmas metas (teste: raiox:refsMeta)
  const META_N: Dic<string> = { voltron: 'Auras e equipamentos', tokens: 'Fichas', counters: 'Marcadores', graveyard: 'Cemitério', artifacts: 'Artefatos', enchant: 'Encantamentos', spells: 'Mágicas', sac: 'Sacrifício', life: 'Ganho de vida', lands: 'Landfall', combat: 'Ataque', draw: 'Comprar muitas', flying: 'Voar', tribe: 'Tribo' };
  // vários temas: média das diferenças dos temas marcados. Cada meta vem com a conta, para a tela mostrar.
  function metas(on: Set<string>, I: Set<string>, d: Deck, tb: string) {
    const ts = [...on].filter(t => META.tema[t]);
    const dif = (t: string, i: number) => t === 'tribe' && META.tribo[tb] ? META.tribo[tb][i] : META.tema[t][i];
    const nomeT = (t: string) => t === 'tribe' && tb ? 'tribo ' + tb + (META.tribo[tb] ? '' : ' (média das tribos)') : META_N[t];
    const br = +d.alvo.br || 0, teto = num(d.alvo.teto), tetoC = num(d.alvo.tetoCarta);
    const barato = (teto && teto <= 1000) || (tetoC && tetoC <= 15) ? 1 : (teto && teto <= 2500) || (tetoC && tetoC <= 30) ? 0.5 : 0;
    const out: Dic<{ alvo: number; conta: string }> & { lands?: { adj: number; conta: string } } = {};
    ['ramp', 'draw', 'removal', 'wipe', 'protect', 'counter'].forEach((k, i) => {
      if (k === 'counter' && !I.has('U')) return;
      const partes: [string, number][] = [];
      let x = k === 'counter' ? META.contraAzul : META.base[i];
      partes.push(['média geral', x]);
      if (ts.length) { const v = ts.reduce((s, t) => s + dif(t, i), 0) / ts.length; partes.push([ts.length > 1 ? 'temas ' + ts.map(nomeT).join(' + ') + ' (média)' : (ts[0] === 'tribe' ? '' : 'tema ') + nomeT(ts[0]), v]); }
      if (k === 'ramp') partes.push([I.has('G') ? 'tem verde' : 'sem verde', I.has('G') ? META.verde : -META.verde]);
      if (k === 'draw') partes.push([I.has('U') ? 'tem azul' : 'sem azul', I.has('U') ? META.azulCompra : -META.azulCompra]);
      if (META.bracket[br]) partes.push(['bracket ' + br, META.bracket[br][i]]);
      if (barato) partes.push([barato === 1 ? 'orçamento baixo' : 'orçamento médio', META.barato[i] * barato]);
      const tot = partes.reduce((s, p) => s + p[1], 0);
      const min = (<Dic<number>>{ ramp: 6, draw: 6, removal: 4, wipe: 1, protect: 2, counter: 1 })[k];
      const alvo = Math.max(min, Math.round(tot));
      const f = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1).replace('.', ',').replace(',0', '');
      const conta = partes.filter((p, j) => j === 0 || Math.abs(p[1]) >= 0.05).map((p, j) => j === 0 ? `${p[0]} ${p[1].toFixed(1).replace('.', ',')}` : `${p[0]} ${f(p[1])}`).join(', ');
      out[k] = { alvo, conta: `decks médios do EDHREC: ${conta} = ${alvo}` };
    });
    // terrenos: a + b × custo médio (no estado()) + a mais/a menos por tema, bracket e orçamento
    const TT = META.terrenos, pl: [string, number][] = [];
    if (ts.length) { const v = ts.reduce((s, t) => s + (TT.tema[t] || 0), 0) / ts.length; if (Math.abs(v) >= 0.05) pl.push([ts.length > 1 ? 'temas ' + ts.map(nomeT).join(' + ') : (ts[0] === 'tribe' ? 'tribo' : 'tema ' + nomeT(ts[0])), v]); }
    if (TT.bracket[br]) pl.push(['bracket ' + br, TT.bracket[br]]);
    if (barato) pl.push([barato === 1 ? 'orçamento baixo' : 'orçamento médio', TT.barato * barato]);
    const fT = (v: number) => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',').replace(',0', '');
    out.lands = { adj: pl.reduce((s, p) => s + p[1], 0), conta: pl.map(p => `${p[0]} ${fT(p[1])}`).join(', ') };
    return out;
  }
  function estado() {
    const d = D(), I = ident();
    const cartas = Object.entries(d.cartas).map(([n, q]) => <[Carta, number]>[C(n), q]).filter(([c]) => c);
    const on = temasIdeia(), tb = triboDeck();
    const cnt: Dic<number> = {}; let lands = 0, spells = 0, sv = 0, tema = 0, gc = d.cmds.filter(n => C(n).gc).length, tut = 0, usd = d.cmds.reduce((s, n) => s + (C(n).usd || 0), 0);
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
    const AP = <Analise>{ cmds: cmdC, uniq: cartas.map(([c]) => c), cmdThemes: cth, tribe: tb ? [tb, 10] : null };
    AP.plano = R.planoDe ? R.planoDe(AP) : null;
    // terrenos pela fórmula do Karsten (pura e ajustada, lado a lado); com poucas mágicas ainda, a média fica em 3
    const lista: Carta[] = []; for (const [c, q] of cartas) for (let j = 0; j < q; j++) lista.push(c);
    const TF: ReturnType<RaioX['terrenosFormula']> & { cedo?: boolean } = R.terrenosFormula(lista, cmdC);
    // no começo: média 3 e pelo menos 8 de compra/ramp baratos (as metas de 10 ramp e 10 compra ainda vão entrar)
    if (spells < 15) { TF.media = 3; TF.barato = Math.max(TF.barato, 8); TF.pura = 31.42 + 3.13 * 3 - 0.28 * TF.barato; TF.ajust = TF.pura + TF.ajustes.reduce((s, a) => s + a.v, 0); TF.cedo = true; }
    const M = metas(on, I, d, tb);
    const landsK = Math.max(30, Math.min(42, Math.round(TF.ajust))), landsPura = Math.max(30, Math.min(42, Math.round(TF.pura)));
    // meta = Karsten ajustada; o EDHREC (decks médios, com tema/bracket/orçamento) fica só para comparar
    const landsT = landsK, baseT = META.terrenos.a + META.terrenos.b * TF.media, landsE = Math.max(30, Math.min(42, Math.round(baseT + M.lands!.adj)));
    const fD = (v: number) => v.toFixed(1).replace('.', ',').replace(',0', '');
    const slots = <Slot[]>[
      { k: 'ramp', n: 'Ramp', why: 'mana extra cedo põe você um turno à frente da mesa' },
      { k: 'draw', n: 'Compra de cartas', why: 'em mesa de 4, quem fica sem cartas na mão perde' },
      { k: 'removal', n: 'Remoção pontual', why: 'responde ao comandante dos outros e às peças que viram o jogo' },
      { k: 'wipe', n: 'Limpa-mesa', why: 'salva você quando alguém dispara na frente' },
      { k: 'protect', n: 'Proteção', why: 'segura o plano quando tentam remover a peça principal' },
    ];
    if (M.counter) slots.push(<Slot>{ k: 'counter', n: 'Contramágica', why: 'anula a jogada que ganharia o jogo' });
    for (const x of slots) { x.alvo = M[x.k].alvo; x.why += ` (meta pelos ${M[x.k].conta})`; }
    const soma = slots.reduce((s, x) => s + x.alvo, 0);
    const temaAlvo = on.size ? Math.max(12, 99 - (d.cmds.length - 1) - landsT - soma) : 0;
    if (on.size) slots.push(<Slot>{ k: 'tema', n: 'Cartas da ideia', alvo: temaAlvo, why: 'é o que faz o deck ser o seu deck' });
    slots.push(<Slot>{ k: 'lands', n: 'Terrenos', alvo: landsT, why: `pela fórmula do Frank Karsten (custo médio ${TF.media.toFixed(2).replace('.', ',')}${TF.cedo ? ', estimado até haver 15 mágicas' : ''}, ${TF.barato} de compra ou ramp até 2): ${landsPura} pura, ${landsK} com os ajustes${TF.ajustes.length ? '; ' + TF.ajustes.map(a => a.t).join('; ') : ''}. O Montar segue a ajustada. Para comparar, os decks médios do EDHREC jogam ${landsE} (${fD(META.terrenos.a)} + ${fD(META.terrenos.b)} × custo médio = ${fD(baseT)}${M.lands!.conta ? `; ${M.lands!.conta}` : ''})` });
    for (const x of slots) x.tem = x.k === 'lands' ? lands : x.k === 'tema' ? tema : (cnt[x.k] || 0);
    const total = d.cmds.length + lands + spells;
    const vagasSpells = Math.max(0, 100 - d.cmds.length - landsT - spells);
    // sinergia com a IDEIA escolhida no passo 2 (páginas de tema do EDHREC nessas cores), não com o jeito comum do comandante
    let edh = R.edhIdeia ? R.edhIdeia(on, I, tb) : null;
    if (edh && edh.carrega) edh.carrega.then(() => { if (D() === d && d.passo === 3) atualiza(); });
    if (edh && !edh.pags.length) edh = null;
    return { d, I, on, tb, AP, edh, slots, lands, spells, total, usd, gc, tut, landsT, landsPura, TF, vagasSpells, media };
  }
  type Estado = ReturnType<typeof estado>;
  /** uma etapa do trilho do passo 3: meta (alvo) e quanto o deck já tem */
  interface Slot { k: string; n: string; why: string; alvo: number; tem: number }
  interface Sug { c: Carta; nota: number; fit: string[]; ps: Set<string> }
  let P3 = { slot: '', pag: 6 };
  const RAMP_OK = new Set(['pedra', 'dork', 'terreno', 'tesouro']);
  const RAMP_BASE: Dic<number> = { pedra: 1, terreno: 0.95, dork: 0.85, tesouro: 0.45 };
  // preço pesa sempre (a mesma função existe barata); com orçamento definido pesa o dobro
  function pesoPreco(c: Carta, E: Estado) {
    const brlC = (c.usd || 0) * (R.usd || 5.56); if (brlC < 3) return 0;
    const capC = num(E.d.alvo.tetoCarta), teto = num(E.d.alvo.teto);
    const ref = capC || (teto ? Math.max(5, teto / 60) : 25);
    return (capC || teto ? 0.4 : 0.22) * Math.log2(1 + brlC / ref);
  }
  function proximo(E: Estado) {
    if (E.total >= 100) return null;
    const falta = E.slots.filter(x => x.tem < x.alvo);
    // feitiços primeiro (a curva decide os terrenos); terreno quando as mágicas já ocupam a vaga delas
    const naoTerra = falta.find(x => x.k !== 'lands' && E.vagasSpells > 0);
    if (naoTerra) return naoTerra.k;
    if (E.vagasSpells > 0) return E.on.size ? 'tema' : 'mais';   // esqueleto pronto, mas ainda há vaga de mágica
    if (E.lands < E.landsT) return 'lands';
    return E.on.size ? 'tema' : 'mais';
  }
  function cabeNivel(c: Carta, E: Estado) {
    const br = +E.d.alvo.br || 0;
    if (br) {
      if (br < 4 && c.tags.includes('mass-land-denial')) return false;
      if (br < 3 && c.tags.includes('extra-turn')) return false;
      if (c.gc && br < 4 && E.gc >= LIM_GC[br]) return false;
      if (br < 4 && R.isTutor(c) && E.tut >= 3) return false;
    }
    const usdBrl = R.usd || 5.56;
    const capC = num(E.d.alvo.tetoCarta), teto = num(E.d.alvo.teto);
    if ((capC || teto) && !c.usd && !/Basic/.test(c.t || '')) return false; // sem preço conhecido: não entra como se fosse de graça
    if (capC && (c.usd || 0) * usdBrl > capC) return false;
    if (teto) { const resto = Math.max(0, 100 - E.total - 1); if ((E.usd + (c.usd || 0) + resto * 0.25) * usdBrl > teto) return false; }
    return true;
  }
  function sugestoes(k: string, E: Estado, n: number) {
    const d = E.d, out: Sug[] = [];
    const FUN: Dic<Slot> = {}; for (const x of E.slots) if (x.k !== 'tema' && x.k !== 'lands') FUN[x.k] = x;
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
  function porque(s: Sug, k: string, E: Estado) {
    const c = s.c, r: string[] = [];
    const roleN = (x: string) => (ROLES.find(o => o.k === x) || {}).n;
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
  function pipsDeck(d: Deck) {
    const p: Dic<number> = {}; for (const x of ident()) p[x] = 0;
    for (const [n, q] of Object.entries(d.cartas)) { const c = C(n); if (!c || isLandC(c)) continue; ((c.m || '').split(' // ')[0].match(/\{[^}]+\}/g) || []).forEach(s => s.slice(1, -1).split('/').forEach(x => { if (x in p) p[x] += q; })); }
    for (const n of d.cmds) ((C(n).m || '').match(/\{[^}]+\}/g) || []).forEach(s => s.slice(1, -1).split('/').forEach(x => { if (x in p) p[x] += 2; }));
    return p;
  }
  const BASICO: Dic<string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
  function planoBasicos(E: Estado): [string, number][] {
    const falta = Math.min(E.landsT - E.lands, 100 - E.total); if (falta <= 0) return [];
    const cores = [...E.I]; if (!cores.length) return [['Wastes', falta]];
    const p = pipsDeck(E.d); const tot = cores.reduce((s, x) => s + p[x], 0) || cores.length;
    const q = cores.map(x => <[string, number]>[x, (p[x] || (tot === cores.length ? 1 : 0)) / tot * falta]);
    const base = q.map(([x, v]) => <[string, number]>[x, Math.floor(v)]); let sobra = falta - base.reduce((s, [, v]) => s + v, 0);
    q.map(([x, v], i) => [i, v - Math.floor(v)]).sort((a, b) => b[1] - a[1]).forEach(([i]) => { if (sobra > 0) { base[i][1]++; sobra--; } });
    return base.filter(([, v]) => v > 0).map(([x, v]) => [BASICO[x], v]);
  }
  // ---------- passo 3: o que a tela mostra (Junto.svelte) ----------
  function junto() {
    const E = estado();
    const auto = proximo(E);
    const k = P3.slot && (P3.slot !== 'tema' || E.on.size) ? P3.slot : auto;
    if (!k) return { E, auto, k };
    const slot = <Slot>(E.slots.find(x => x.k === k) || { n: 'Mais cartas', alvo: 0, tem: 0, why: 'o deck ainda tem vagas' });
    let falta = Math.max(0, slot.alvo - slot.tem);
    const extra = !falta && k !== 'lands' && E.vagasSpells > 0; if (extra) falta = E.vagasSpells;
    const lista = sugestoes(k, E, P3.pag);
    const bas = k === 'lands' ? planoBasicos(E) : [];
    const sugs = lista.map(s => ({ ...s, ia: window.PAPEIS_IA && window.PAPEIS_IA[s.c.name], pq: porque(s, k, E) }));
    const filtros = [E.d.alvo.br ? 'bracket ' + E.d.alvo.br : '', num(E.d.alvo.tetoCarta) ? 'até R$ ' + num(E.d.alvo.tetoCarta) + ' por carta' : '', num(E.d.alvo.teto) ? 'orçamento de R$ ' + num(E.d.alvo.teto) : ''].filter(Boolean);
    return { E, auto, k, slot, falta, extra, sugs, bas, filtros };
  }

  // ---------- trilho dos passos ----------
  const PASSOS = <[number, string, string][]>[[1, 'Cores e comandante', 'palette'], [2, 'A ideia', 'lightbulb'], [3, 'Montar junto', 'handshake'], [4, 'Ajuste fino', 'tune']];

  // ---------- imagens (fila do analise.js; a mesma carta não espera de novo) ----------
  const JA = new Map();
  function imagens(root: ParentNode) {
    $$('[data-img]', root).forEach(el => {
      const n = el.dataset.img;
      const pinta = (src: string | null) => { if (el.dataset.img === n) el.innerHTML = src ? `<img src="${src}" alt="${esc(n)}" loading="lazy">` : '<span class="note">sem imagem</span>'; };
      if (JA.has(n)) { pinta(JA.get(n)); return; }
      R.imgFor(n!).then(src => { JA.set(n, src); pinta(src); });
    });
  }

  // ações dos passos 1 a 3 (antes: liga())
  const acoes = {
    passo(n: number) { const d = D(); if (n > 1 && !d.cmds.length) return; if (d.passo === 2) salvaConceito(); d.passo = n; P3.slot = ''; P3.pag = 6; toque(); desenha(); rolaPara('.g-passos', 80); },
    // passo 1
    c1(x: string) { if (x === 'C') { P1.cores = ''; P1.modo = 'exato'; } else { const b0 = P1.cores || ''; P1.cores = ordena(b0.includes(x) ? b0.replace(x, '') : b0 + x) || null; } P1.txt = ''; P1.pag = 24; desenha(); },
    modo(v: string) { P1.modo = v; P1.pag = 24; desenha(); },
    tema(v: string) { P1.tema = v; P1.pag = 24; desenha(); },
    ord(v: string) { P1.ord = v; desenha(); },
    q1(v: string) { P1.txt = v; P1.pag = 24; clearTimeout(BT); BT = setTimeout(() => { desenha(); const e = $<Campo>('#g-q1'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 220); },
    mais1() { P1.pag += 24; atualiza(); },
    // passo 2 (sem redesenhar: a tela só acende os temas)
    ideiaTexto(v: string) { D().ideia.texto = v; toque(); const on = temasIdeia(); salvaConceito(); return on; },
    chip(k: string, agora: boolean) { D().ideia.man![k] = agora; toque(); salvaConceito(); },
    br(v: string) { D().alvo.br = v; toque(); salvaConceito(); return BR_TX[v || '']; },
    teto(k: 'teto' | 'tetoCarta', v: string) { D().alvo[k] = v.trim(); toque(); salvaConceito(); },
    par() { const d = D(); d.passo = 4; Q.cmd = true; Q.txt = ''; toque(); desenha(); },
    troca() { const d = D(); if (Object.keys(d.cartas).length && !confirmar('Trocar de comandante? As cartas que não couberem nas cores novas vão ficar marcadas.')) return; d.cmds = []; d.passo = 1; d.ideia = { texto: '', man: null }; toque(); desenha(); },
    // passo 3
    slot(k: string) { P3.slot = k; P3.pag = 6; desenha(); },
    todas(ns: string[]) { const d = D(); const E = estado(); const kk = P3.slot || proximo(E); const slot = E.slots.find(x => x.k === kk); const falta = (slot ? Math.max(0, slot.alvo - slot.tem) : 0) || (kk !== 'lands' ? E.vagasSpells : 0) || ns.length; ns.slice(0, falta || ns.length).forEach(n => { if (!d.cartas[n]) d.cartas[n] = 1; }); toque(); atualiza(); },
    mais3() { P3.pag += 6; atualiza(); },
    desrec() { D().recusadas = {}; toque(); atualiza(); },
    auto() { P3.slot = ''; P3.pag = 6; atualiza(); },
    bas() { const d = D(); for (const [n, q] of planoBasicos(estado())) d.cartas[n] = (d.cartas[n] || 0) + q; toque(); atualiza(); },
    aceita(n: string) { const d = D(); if (!d.cartas[n]) d.cartas[n] = 1; toque(); atualiza(); },
    nao(n: string) { D().recusadas[n] = 1; toque(); atualiza(); },
  };
  const P = () => ({ P1, P3 });
  return { acoes, P, listaCmds, perfil, temaNome, nomeCores, pipsHTML, ordena, ORDEM, temasIdeia, triboDeck, CONC, BR_TX, junto, PASSOS, imagens, estado, sugestoes, porque, salvaConceito };
})();
window.RAIOX_GUIADO = G;

// cliques nas listas (um só ouvinte para a tela toda)
document.addEventListener('click', (e: any) => {
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
async function archidekt(url: string) {
  const m = String(url || '').match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i) || String(url || '').match(/^\s*(\d{3,})\s*$/);
  if (!m) { msg('Não achei o número do deck no link. Exemplo: https://archidekt.com/decks/123456/meu_deck', 'mt-imp-msg'); return; }
  msg('Buscando no Archidekt…', 'mt-imp-msg');
  try {
    const r = await fetch(`https://archidekt.com/api/decks/${m[1]}/`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status === 404 ? 'deck não encontrado (é público?)' : 'resposta ' + r.status);
    const j = await r.json();
    const fora = new Set((j.categories || []).filter((c: any) => c.includedInDeck === false).map((c: any) => c.name));
    const cmds = [], linhas = [];
    for (const it of j.cards || []) {
      const cats = it.categories || []; const nome = it.card && (it.card.oracleCard && it.card.oracleCard.name || it.card.name); if (!nome) continue;
      if (cats.length && fora.has(cats[0])) continue;
      if (cats.includes('Commander')) cmds.push('1 ' + nome); else linhas.push((it.quantity || 1) + ' ' + nome);
    }
    const t = (cmds.length ? 'Commander\n' + cmds.join('\n') + '\n\nDeck\n' : '') + linhas.join('\n');
    const res = deTexto(t, j.name);
    if (res.erro) { msg(res.erro, 'mt-imp-msg'); return; }
    desenha(); msg(`Importado do Archidekt: "${res.d!.nome}", ${contar(res.d!)} cartas${res.unknown!.length ? `. Não reconheci ${res.unknown!.length}: ${res.unknown!.slice(0, 6).join(', ')}` : ''}.`, 'mt-imp-msg'); $<HTMLDetailsElement>('#mt-imp').open = true;
  } catch (e) {
    // o Archidekt só libera a API para o site dele (CORS; conferido em 19/11/2026): de uma página estática não dá
    const el = $('#mt-imp-msg');
    if (el) el.innerHTML = `O Archidekt não deixa outros sites lerem os decks dele direto. Faça assim: <a href="https://archidekt.com/decks/${esc(m[1])}" target="_blank" rel="noopener">abra o deck no Archidekt</a> → menu <b>Export</b> (ou <b>Exportar</b>) → <b>Copy</b>, e cole o texto em "Importar texto" aqui.`;
  }
}

// o que os componentes da tela (src/telas/montar) leem e chamam; o Montar.svelte põe no contexto ('mt')
const API = {
  S: () => S, D, Q: () => Q, A: () => A, R, C, esc, brl, manaHTML, ROLES, TIPOS, GRUPOS, LIM_GC,
  contar, total, ident, busca, papeis, multiOk, temPar, grupoDe, acoes, G,
  ligaTela(t: { tudo: () => void; busca: () => void }) { TELA = t; },
};
export type MontarAPI = typeof API;
export type { Deck, Item };

// a tela só é desenhada quando aberta (a base de cartas é grande)
function abre(t: string) { if (t !== 'montar') return; if (!S.atual || !S.decks[S.atual]) { const ids = Object.keys(S.decks); S.atual = ids[0] || null; if (!S.atual) novoDeck(); } desenha(); }
document.addEventListener('raiox:tela', (e: any) => abre(e.detail));
if (location.hash === '#montar') { ROOT() && (ROOT().hidden = false); abre('montar'); }
window.RAIOX_MONTAR = { texto: () => texto(), get deck() { return D(); }, deTexto };
