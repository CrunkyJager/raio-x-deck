// src/motor/estado.ts (T43: migrado de motor2/estado.js) — estado do jogo (serializável e clonável), zonas, objetos, filtros e condições do formato RX.
// Motor próprio do Raio-X (T14). Roda no node, na página e no Worker: tudo pendura no objeto M (src/motor/nucleo.ts).
// Regras citadas pelo número da CR (comando `regra <número>`).
import { M } from './nucleo';

const CORES = ['W', 'U', 'B', 'R', 'G'];
const ZONAS_JOG = ['grimorio', 'mao', 'cemiterio', 'exilio', 'comando'];
M.CORES = CORES; M.ZONAS_JOG = ZONAS_JOG;

// ---- base de cartas (fora do estado: o estado guarda só o nome) ----
let DB = null;
M.usarCartas = db => { DB = db; };
M.carta = n => {
  const c = DB && DB[n];
  if (!c) throw new Error('carta fora da base RX: ' + n);
  return c;
};
// ficha leva o próprio dado; carta de mais de uma face devolve a face que está para cima (o.face)
// palavras-chave que só valem na montagem do deck/zona de comando (CR 702.124 parceiro, 'parceiroCom' = parceiro com
// <nome>, 702.124c): na partida não mudam nada. O carregamento do deck aceita os dois comandantes.
M.KW_SO_DECK = new Set(['parceiro', 'parceiroCom']);
M.dadoBase = (e, o) => o.ficha ? o.ficha : o.face == null ? M.carta(o.n) : M.dadoFace(M.carta(o.n), o.face);
// camada 4 (tipo) e 7b (P/R fixado), só no campo: o.anim (op animar, preso ao objeto: mesmo ts) e a estática
// 'continuo' com tipo/sub que afeta 'este' (Ultra Magnus, Arcee, Ratchet: criatura no seu turno). O dado com o
// que muda é guardado por dado base + mudança (WeakMap), então ler continua sem alocar.
const TIPO_ESTE = new WeakMap<object, any[]>();
const tipoEste = (d): any[] => { let l: any[] | undefined = TIPO_ESTE.get(d); if (!l) TIPO_ESTE.set(d, (l = (d.est || []).filter(s => s.modo === 'continuo' && s.afeta === 'este' && (s.tipo || s.sub) && !s.p && !s.r && !s.kw && !s.habil))); return l as any[]; };
// a parte de tipo das estáticas que dão tipo/sub à 'equipada' (só {tipo, sub, se}: a kw vai pelas camadas)
const TIPO_EQUIP = new WeakMap<object, any[]>();
const tipoEquip = (d): any[] => { let l: any[] | undefined = TIPO_EQUIP.get(d); if (!l) TIPO_EQUIP.set(d, (l = (d.est || []).filter(s => M.estTipoEquipOk(s)).map(s => ({ tipo: s.tipo, sub: s.sub, se: s.se })))); return l as any[]; };
const MISTO = new WeakMap<object, Map<any, any>>();
const misto = (d, m) => {
  let c = MISTO.get(d); if (!c) MISTO.set(d, (c = new Map()));
  let r = c.get(m); if (r) return r;
  const un = (a, b) => b && b.length ? [...new Set([...(a || []), ...b])] : a;
  r = { ...d, tipos: un(d.tipos, m.tipos || m.tipo), sub: un(d.sub, m.sub) };   // animar escreve tipos; a estática, tipo
  if (m.pt) r.pt = m.pt;
  if (m.kw && m.kw.length) r.kw = [...(d.kw || []), ...m.kw];
  if (m.cores !== undefined) r.cores = m.cores;
  c.set(m, r);
  return r;
};
let lendoTipo = 0;
// Classe (CR 716): no campo, o dado soma as habilidades dos níveis atingidos (716.2b/c; niveis[] do banco, n ≥ 2).
// Guardado por dado + nível: ler continua sem alocar.
const NIVEL = new WeakMap<object, Map<number, any>>();
const comNivel = (d, nv) => {
  let m = NIVEL.get(d); if (!m) NIVEL.set(d, (m = new Map()));
  let r = m.get(nv); if (r) return r;
  r = { ...d };
  for (const l of d.niveis) if (l.n <= nv) for (const k of ['gat', 'est', 'atv']) if (l[k] && l[k].length) r[k] = [...(r[k] || []), ...l[k]];
  m.set(nv, r);
  return r;
};
M.ehClasse = d => (d.kw || []).some(x => x.k === 'classe');
M.dadoDe = (e, o) => {
  let d = M.dadoBase(e, o);
  if (o.zona !== 'campo') return d;
  if (o.nivel > 1 && d.niveis) d = comNivel(d, o.nivel);
  const A = o.anim;
  if (A && A.length) for (const a of A) if (a.ts === o.ts) d = misto(d, a);
  const st = tipoEste(d);
  if (st.length && !lendoTipo) {
    lendoTipo++;
    try { for (const s of st) { let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, { voce: o.ctrl, este: o.id }); } catch (_) { ok = false; } } if (ok) d = misto(d, s); } }
    finally { lendoTipo--; }
  }
  if (!lendoTipo) {
    lendoTipo++;
    try {
      const tp = indice(e).tp;
      for (const id of tp) {
        const F = e.objs[id]; if (!F || !presoA(e, F, o)) continue;
        for (const s of tipoEquip(M.dadoDe(e, F))) { let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, { voce: F.ctrl, este: F.id }); } catch (_) { ok = false; } } if (ok) d = misto(d, s); }
      }
    } finally { lendoTipo--; }
  }
  return d;
};

// ---- faces (CR 709 split, 712 dupla face e modal, 716 aventura) ----
// No banco: os campos de cima são a frente (ou a metade esquerda / a criatura da aventura) e faces[0] é a outra.
// o.face: undefined/null = frente; 0 = faces[0]; na pilha um split pode estar 'esq' (só a metade esquerda, 709.3b)
// ou 'fundida' (as duas, 702.102b). Fora da pilha e do campo a carta tem só a frente (712.6a, 716.4) — o mover zera.
const coresDoCusto = custo => CORES.filter(c => JSON.stringify((custo && custo.p) || []).includes(c)).join('');
// os alvos da metade direita vêm depois dos da esquerda na mágica fundida: {alvo: N} anda N + deslocamento
const deslocaAlvos = (v, d) => Array.isArray(v) ? v.map(x => deslocaAlvos(x, d))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'alvo' && typeof x === 'number' ? x + d : deslocaAlvos(x, d)])) : v;
const FACES = new WeakMap<object, Map<any, any>>();
M.dadoFace = (c, face) => {
  if (face == null || !c.faces) return c;
  let m = FACES.get(c); if (!m) FACES.set(c, (m = new Map()));
  if (m.has(face)) return m.get(face);
  const { faces, ...frente } = c, f = faces[0] || {};
  let d;
  if (face === 'esq') d = { ...frente, vm: M.vmDe(c.custo || {}), cores: coresDoCusto(c.custo) };   // 709.3b
  else if (face === 'fundida') {                                                                   // 702.102b–d
    const n = (c.alvos || []).length;
    d = { ...frente, custo: M.somaCusto(c.custo || {}, f.custo || {}), alvos: [...(c.alvos || []), ...(f.alvos || [])],
      fx: [...(c.fx || []), ...deslocaAlvos(f.fx || [], n)], vm: c.vm };
  } else {
    // 712.6d: dupla face que transforma tem o valor de mana da frente; modal, aventura e split, o da própria face
    const vm = c.forma === 'duplaFace' ? (c.vm || 0) : f.vm ?? (f.custo ? M.vmDe(f.custo) : 0);
    d = { ...f, ci: c.ci, vm, ...(c.forma === 'split' ? { cores: coresDoCusto(f.custo) } : {}) };
  }
  m.set(face, d);
  return d;
};
M.formaDe = (e, o) => (o.ficha ? null : M.carta(o.n).forma) || null;

// ---- sorteio determinístico (mulberry32; o estado guarda a semente, clone repete a sorte) ----
M.aleat = e => {
  let t = (e.rng = (e.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
M.embaralhar = (e, arr) => {
  for (let i = arr.length - 1; i > 0; i--) { const k = Math.floor(M.aleat(e) * (i + 1)); [arr[i], arr[k]] = [arr[k], arr[i]]; }
  return arr;
};

// ---- clonar (base da IA e da análise: continuar de onde parou) ----
M.clonar = typeof structuredClone === 'function' ? e => structuredClone(e) : e => JSON.parse(JSON.stringify(e));

M.log = (e, ...p) => { if (e.cfg.log) e.log.push(`T${e.turno.n} ${e.turno.passo}: ` + p.join(' ')); };

// ---- novo jogo (CR 103; Commander CR 903) ----
// decks: [{nome, comandante:[nomes], cartas:[nomes]}]
M.novoJogo = (decks, cfg: any = {}) => {
  const e: any = {
    v: 1, ts: 0, prox: 1, rng: (cfg.semente ?? 1) >>> 0,
    cfg: { log: !!cfg.log, maxTurnos: cfg.maxTurnos || 400 },
    turno: { n: 0, ativo: 0, passo: 'mulligan', feito: false, primeiro: 0 },
    jogs: [] as any[], objs: {} as any, campo: [] as any[], pilha: [] as any[], perg: null, fim: null, log: [] as any[], mull: null, abeNovo: [] as any[], pend: [] as any[], lote: [] as any[],
  };
  decks.forEach((d, i) => {
    const j = {
      i, nome: d.nome || 'J' + (i + 1), vida: 40, veneno: 0,                // CR 103.4c
      danoCmd: {} as any, reserva: zeroMana(), terrenos: 0, comprouVazio: false, saiu: false,
      ci: '', cmd: [] as any[], imposto: {} as any, zonas: {} as any, mulls: 0,
    };
    ZONAS_JOG.forEach(z => { j.zonas[z] = []; });
    e.jogs.push(j);
    for (const n of d.comandante || []) {
      const o = novoObj(e, n, i, 'comando'); o.cmd = true;             // CR 903.6: começa na zona de comando
      j.cmd.push(o.id); j.imposto[o.id] = 0; j.zonas.comando.push(o.id);
      j.ci = uneCores(j.ci, M.carta(n).ci || '');                       // CR 903.4: identidade de cor
    }
    for (const n of d.cartas) { const o = novoObj(e, n, i, 'grimorio'); j.zonas.grimorio.push(o.id); }
    M.embaralhar(e, j.zonas.grimorio);                                  // CR 103.3
  });
  e.turno.primeiro = e.turno.ativo = Math.floor(M.aleat(e) * decks.length);   // CR 103.1
  return e;
};

const zeroMana = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
M.zeroMana = zeroMana;
const uneCores = (a, b) => CORES.filter(c => a.includes(c) || b.includes(c)).join('');

function novoObj(e, n, dono, zona) {
  const o = { id: e.prox++, n, dono, ctrl: dono, zona, ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: true, cmd: false };
  e.objs[o.id] = o;
  return o;
}

// ---- zonas ----
M.listaDe = (e, o) => o.zona === 'campo' ? e.campo : o.zona === 'pilha' ? e.pilha : o.zona === 'faseado' ? (e.faseados || (e.faseados = [])) : e.jogs[o.dono].zonas[o.zona];

// ---------- sagas (CR 714) ----------
// capítulo final = kw capitulo n; marcadores de história (lore) em marc.lore. Pôr marcador dispara 'capitulo' {de, para}:
// o capítulo N desencadeia quando a contagem passa de < N para ≥ N (714.2b). Entrar (714.3a), a 1ª principal do
// controlador (714.3b, turno.ts) e marcador/proliferar com 'lore' passam por aqui. Sacrifício nas ABE (714.4).
M.capitulos = d => { const k = (d.kw || []).find(x => x.k === 'capitulo'); return k ? k.n || 0 : 0; };
M.porHistoria = (e, o, n) => {
  const de = o.marc.lore || 0; o.marc.lore = de + n;
  M.evento(e, { ev: 'capitulo', id: o.id, ts: o.ts, de, para: de + n });
};

// ---------- fases (CR 702.26) ----------
// Faseada = como se não existisse (702.26b), mas é o mesmo objeto (702.26d: sem mudar de zona, sem evento, ts igual).
// Fica na lista e.faseados com zona 'faseado'; o que está preso a ela fase junto (702.26g, indireto). Volta no
// desvirar de quem a controlava (702.26c, 502.1), antes de desvirar; quem estava em combate já saiu (emCombate olha a zona).
M.fasearFora = (e, id, quando?) => {
  const o = e.objs[id]; if (!o || o.zona !== 'campo') return;
  const k = e.campo.lastIndexOf(id); if (k < 0) return;
  const presos = e.campo.filter(x => { const a = e.objs[x].anexo; return x !== id && a && a.id === id && a.ts === o.ts; });
  e.campo.splice(k, 1); M.campoSai(e, id);
  o.zona = 'faseado'; o.faseVolta = quando === undefined ? o.ctrl : quando;
  (e.faseados || (e.faseados = [])).push(id);
  for (const x of presos) M.fasearFora(e, x, o.faseVolta);
};
M.fasearDentro = (e, j) => {
  for (const id of (e.faseados || []).filter(x => e.objs[x].faseVolta === j)) {
    const o = e.objs[id];
    e.faseados.splice(e.faseados.indexOf(id), 1);
    o.zona = 'campo'; o.faseVolta = null; e.campo.push(id); M.campoEntra(e, id);
    M.log(e, o.n, 'volta (fase)');
  }
};

// ---------- efeitos temporários de regra (op efeitoTemporario, CR 611.2b) ----------
// e.efTemp = [{ctrl, est, este:{id,ts}|null, ids:[{id,ts}]|null, fim:'turno'|j, ts}]: estáticas que valem até o fim
// do turno (limpeza, 514.2) ou até o próximo turno de j ("until your next turn": acaba quando ele começa).
// afeta: 'voce' (o jogador ctrl), 'este' (a fonte presa por id+ts), filtro (lido na hora: regra, não característica,
// então o conjunto não fica preso, 611.2c) ou nada (os objetos do em, presos na resolução).
M.tempDe = (e, modo) => { const r: any[] = []; for (const t of e.efTemp || []) for (const s of t.est) if (s.modo === modo) r.push({ s, t }); return r; };
M.tempAfeta = (e, o, s, t) => {
  if (s.afeta === 'este') return !!t.este && o.id === t.este.id && o.ts === t.este.ts;
  if (s.afeta === undefined) return M.tempTem(t, o);
  if (s.afeta && typeof s.afeta === 'object') { try { return M.bate(e, o, s.afeta, { voce: t.ctrl, este: t.este ? t.este.id : undefined }); } catch (_) { return false; } }
  return false;
};
M.tempNoObj = (e, o, modo) => !!(e.efTemp && e.efTemp.length) && M.tempDe(e, modo).some(({ s, t }) => M.tempAfeta(e, o, s, t));
const protTudo = s => s.de === 'tudo' || s.de === 'everything' || (s.kw || []).some(k => k.k === 'protecao' && (k.de === 'tudo' || k.de === 'everything'));
function estJog(e, j, ok) {
  for (const t of e.efTemp || []) if (t.ctrl === j && t.est.some(s => s.afeta === 'voce' && ok(s))) return true;
  for (const id of indice(e).est) {
    const o = e.objs[id]; if (o.ctrl !== j) continue;
    for (const s of M.dadoDe(e, o).est || []) if (s.afeta === 'voce' && !s.se && ok(s)) return true;
  }
  return false;
}
// "sua vida não pode mudar" (Teferi's Protection, Flare of Fortitude, Platinum Emperion): sem ganho, perda nem pagar vida (119.8)
M.vidaFixa = (e, j) => estJog(e, j, s => s.modo === 'vidaNaoMuda');
// "você tem proteção contra tudo" (702.16j, 702.16b): não é alvo, dano a você é prevenido. Só 'tudo' por ora.
M.protegeJog = (e, j) => estJog(e, j, s => s.modo === 'protecaoJogador' && protTudo(s));

// Mover de zona. CR 400.7: vira objeto novo — o id fica (é a carta física, a designação de comandante vai junto,
// CR 903.3), mas timestamp novo e o estado do campo zera. Ficha fora do campo deixa de existir (CR 704.5d, nas ABE).
// CR 903.9b (comandante iria para mão/grimório → pode ir ao comando): escolha do dono; por ora sempre aceita
// (pergunta de substituição entra na T19).
// Face: entra no campo com a face que estava na pilha (712.10) ou a pedida (terreno modal, 712.9); de outra zona,
// com a frente (712.11). Em qualquer outra zona volta à frente (712.6a, 716.4) e perde a permissão da aventura.
M.mover = (e, id, zona, { topo = true, virada = false, face = undefined, conj = null }: any = {}) => {
  const o = e.objs[id];
  if (o.cmd && (zona === 'mao' || zona === 'grimorio')) zona = 'comando';
  const zDe = o.zona, snap = zDe === 'campo' ? { ...o, marc: { ...o.marc } } : null;   // LKI de quem sai (603.10a)
  const de = M.listaDe(e, o), k = de.lastIndexOf(id);   // id único na lista; o fim (topo, ficha nova) é o mais comum
  if (k >= 0) de.splice(k, 1);
  if (zDe === 'campo' && k >= 0) M.campoSai(e, id);
  const faceNova = zona !== 'campo' ? null : face !== undefined ? face : zDe === 'pilha' ? o.face ?? null : null;
  Object.assign(o, { zona, ts: ++e.ts, virada: zona === 'campo' && virada, dano: 0, marc: {} as any, doente: true, ctrl: o.dono, escolha: null, mortal: false, lealTurno: 0, usos: null, face: faceNova, aventura: null, anexo: null, loucura: false, ganhos: null, nivel: null,
    conjCom: zona === 'campo' && conj && (conj.chute || conj.presente) ? { kicker: !!conj.chute, presente: !!conj.presente } : null });   // como foi conjurada (702.33d)
  if (zona === 'campo' && M.dadoDe(e, o).leal) o.marc.lealdade = M.dadoDe(e, o).leal;   // CR 306.5b: entra com a lealdade impressa
  if (zona === 'campo' && M.ehClasse(M.dadoBase(e, o))) o.nivel = 1;                       // CR 716.2c: a Classe entra no nível 1
  const para = M.listaDe(e, o);
  if (zona === 'grimorio' && !topo) para.unshift(id); else para.push(id);   // grimório: fim do array = topo
  if (zona === 'campo') M.campoEntra(e, id);
  if (zona === 'cemiterio' || zona === 'exilio') e.abeNovo.push(id);
  if (M.evento && (zDe === 'campo' || zona === 'campo' || zona === 'cemiterio')) M.evento(e, { ev: 'zona', id, de: zDe, para: zona, snap });   // gatilhos.js
  if (zona === 'campo' && M.capitulos(M.dadoDe(e, o))) M.porHistoria(e, o, 1);   // CR 714.3a: a saga entra com 1 marcador de história
  if (o.ficha && zona !== 'campo') (e.fichasFora = e.fichasFora || []).push(id);   // CR 704.5d: some nas ABE        // CR 903.9a olha "desde a última checagem"
  return o;
};

// descartar (CR 701.9): o único caminho do descarte (efeito, custo, limpeza). Cada carta dispara 'descarta' {id, j, ts}
// e o lote todo 'descartaGrupo' {j, n, ids} (gatilho com grupo: "uma ou mais cartas", Marauding Mako).
// Loucura (702.35a): a carta vai para o exílio em vez do cemitério e o gatilho da loucura vai para a pilha.
// Simplificação: o exílio da loucura é sempre escolhido; quem não quer conjurar recusa no gatilho e ela vai ao cemitério.
M.descartar = (e, j, ids) => {
  const feitas: any[] = [];
  for (const id of ids) {
    const o = e.objs[id]; if (!o || o.zona !== 'mao') continue;
    const lk = (M.dadoDe(e, o).kw || []).find(x => x.k === 'loucura' && x.custo);
    if (lk) {
      M.mover(e, id, 'exilio'); o.loucura = true;
      if (e.pend && e.turno.passo !== 'mulligan') e.pend.push({ fonte: id, ts: o.ts, ctrl: o.dono, k: 'loucura', g: GAT_LOUCURA, n: o.n, face: null, ficha: null, lki: M.lkiDe(e, o), ev: { ev: 'descarta', id, j, ts: o.ts } });
    } else M.mover(e, id, 'cemiterio');
    feitas.push(id);
    M.evento(e, { ev: 'descarta', id, j, ts: o.ts });
  }
  if (feitas.length) M.evento(e, { ev: 'descartaGrupo', j, n: feitas.length, ids: feitas });
  if (feitas.length) M.log(e, e.jogs[j].nome, 'descarta', feitas.map(id => e.objs[id].n).join(', '));
  return feitas;
};
const GAT_LOUCURA = { ev: 'descarta', fx: [{ op: 'loucura' }] };

// comprar (CR 121; grimório vazio → perde nas ABE, CR 704.5b)
M.comprar = (e, j, qtd = 1) => {
  const J = e.jogs[j];
  for (let i = 0; i < qtd; i++) {
    const g = J.zonas.grimorio;
    if (!g.length) { J.comprouVazio = true; continue; }
    M.mover(e, g[g.length - 1], 'mao');
    if (M.evento) M.evento(e, { ev: 'compra', j });
  }
};

M.vivos = e => e.jogs.filter(j => !j.saiu).map(j => j.i);

// ---- leitura de cartas ----
M.temTipo = (e, o, t) => (M.dadoDe(e, o).tipos || []).includes(t);
M.ehPermanente = (e, o) => ['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].some(t => M.temTipo(e, o, t));
// est ptDefinido (CDA, CR 604.3 e camada 7a): P/R '*' definido por uma contagem; vale em todas as zonas (Beanstalk Giant,
// Adeline, Psychosis Crawler). Quem conta é o controlador (fora do campo, o dono).
const ptCda = (e, o, i) => {
  const s = (M.dadoDe(e, o).est || []).find(x => x.modo === 'ptDefinido' && x.afeta === 'este' && x[i ? 'rBase' : 'pBase'] !== undefined);
  if (!s) return null;
  const q = s[i ? 'rBase' : 'pBase'], voce = o.ctrl ?? o.dono;
  if (q && q.conta === 'cartasNaMao') return e.jogs[voce].zonas.mao.length * (q.mult || 1) + (q.soma || 0);
  return M.qtd(e, q, { voce, este: o.id });
};
M.ptCda = ptCda;
// P/R (CR 613.4): 7a base ou CDA, 7c somas das camadas (estáticas 'continuo' e 'modificar' até o fim do turno), 7d marcadores.
// A CDA vale mesmo com P/R numérico no dado: a ficha do banco escreve pt [0,0] + est ptDefinido (Gnome Soldier, token.est).
// 7b (P/R fixado) ainda não existe: carta com ele não é lida (estContOk).
M.resistencia = (e, o) => {
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const b = ptCda(e, o, 1) ?? (typeof pt[1] === 'number' ? pt[1] : 0);
  return b + camadas(e, o).r + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
};
M.poder = (e, o) => {
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const b = ptCda(e, o, 0) ?? (typeof pt[0] === 'number' ? pt[0] : 0);
  return b + camadas(e, o).p + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
};

// ---- anexar (CR 301.5 Equipamento, 303.4 Aura, 701.3): o.anexo = {id, ts} do objeto a que está preso ----
// Vale só enquanto aquele objeto (mesmo id e ts, CR 400.7) estiver no campo; o mover zera o anexo de quem muda de
// zona e as ABE (704.5m/n, turno.ts) soltam o que ficou preso a nada.
M.anexadoA = (e, o) => {
  const a = o && o.anexo; if (!a) return null;
  const t = e.objs[a.id];
  return t && t.ts === a.ts && t.zona === 'campo' ? t : null;
};
const presoA = (e, x, o) => { const a = x.anexo; return !!a && a.id === o.id && a.ts === o.ts && x.zona === 'campo'; };
M.anexosDe = (e, o) => e.campo.map(id => e.objs[id]).filter(x => presoA(e, x, o));
// estáticas de regra de quem está preso a o ("equipped creature can't be blocked", Brotherhood Regalia; "enchanted
// creature can't block"): [fonte, est] com afeta 'equipada' e o modo pedido. Pelo índice das estáticas (I.est), não
// pelo campo inteiro: o combate pergunta isto por par bloqueador × atacante.
M.estDaEquipada = (e, o, modo) => {
  const r: [any, any][] = [];
  for (const id of indice(e).est) {
    const F = e.objs[id]; if (!F || !F.anexo || !presoA(e, F, o)) continue;
    for (const s of M.dadoDe(e, F).est || []) if (s.modo === modo && s.afeta === 'equipada') r.push([F, s]);
  }
  return r;
};
// equipar N (CR 702.6a): "{N}: anexe a uma criatura alvo que você controla; só como feitiço". A palavra-chave vira
// uma habilidade ativada como as do banco (atv), depois das da carta: o índice k delas não muda.
const EQUIPAR = new WeakMap<object, any>();
const equiparDe = kw => {
  let a = EQUIPAR.get(kw);
  if (!a) EQUIPAR.set(kw, (a = { custo: { mana: kw.custo || {} }, vel: 'feitico', _equipar: true,
    alvos: [{ f: { ...(kw.f || {}), tipo: ['Creature'], ctrl: 'voce', zona: 'campo' } }], fx: [{ op: 'anexar', em: 'este', a: { alvo: 0 } }] }));
  return a;
};

// ---- camadas (CR 613), primeira volta: 6 (palavras-chave dadas) e 7c (somar P/R) ----
// Fontes: est {modo:'continuo'} dos permanentes no campo (CR 611.3: vale enquanto a fonte está lá, a condição 'se'
// conferida a cada leitura) e e.temp, os efeitos de resolução 'modificar' até o fim do turno (CR 611.2c: o conjunto
// afetado e os números ficam presos na resolução; saem na limpeza, CR 514.2). Tipo (camada 4), habilidade dada
// (habil), P/R fixado (7b) e perder habilidade ficam para a próxima volta: a estática com eles não é lida.
// Dependência (CR 613.8) simplificada: enquanto uma estática decide quem afeta (filtro, condição, contagem), as
// leituras de P/R e palavra-chave usam só a carta (sem camadas). Nenhum filtro do banco hoje depende de outra camada.
const CONT_OK = new Set(['modo', 'afeta', 'p', 'r', 'kw', 'se', 'habil']);
const TIPOS_CARTA = new Set(['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle']);
// tipo/sub dado a 'este' (camada 4): lido no M.dadoDe; com filtro (Ashaya, Bello, Dryad, Leyline) ainda não
M.estTipoOk = s => !!s && s.modo === 'continuo' && s.afeta === 'este' && (s.tipo || s.sub) && Object.keys(s).every(k => ['modo', 'afeta', 'tipo', 'sub', 'se'].includes(k))
  && (s.tipo || []).every(t => TIPOS_CARTA.has(t)) && !(s.sub || []).includes('escolhido') && (!s.se || M.seOk(s.se));
const CONTA_EST = new Set(['cartasNaMao', 'oponentes', 'jogadores', 'suaVida', 'marcadoresNoEste', 'devocao']);
// prop: em vez de quantos, soma/maior de uma característica dos que batem (Ghalta, The Great Henge, Metalwork Colossus, Excalibur)
const PROP_EST = new Set(['somaPoder', 'maiorPoder', 'somaVm']);
M.PROP_EST = PROP_EST;
const qtdEstOk = q => q === undefined || typeof q === 'number'
  || (q && typeof q === 'object' && Object.keys(q).every(k => ['conta', 'mult', 'soma', 'de', 'prop'].includes(k)) && (q.de === undefined || q.conta === 'marcadoresNoEste' || (q.conta === 'devocao' && /^[WUBRG]+$/.test(q.de)))
    && (q.prop === undefined || (PROP_EST.has(q.prop) && typeof q.conta === 'object'))
    && (typeof q.conta === 'string' ? CONTA_EST.has(q.conta) : !!q.conta && typeof q.conta === 'object' && M.filtroOk(q.conta)));
M.qtdEstOk = qtdEstOk;
M.kwListaOk = kw => (kw || []).every(x => x && typeof x.k === 'string');   // palavra-chave dada = mesmo formato da kw da carta
// habil (CR 613.1f): habilidades dadas, no formato da carta (gat/atv); quem lê cada uma decide se joga (gatOk, podeAtivar)
const habilOk = h => h === undefined || (!!h && typeof h === 'object' && Object.keys(h).length > 0
  && Object.keys(h).every(k => (k === 'gat' || k === 'atv') && Array.isArray(h[k])));
// tipo/sub dado à 'equipada' (Brotherhood Regalia: "equipped creature has ward {2} and is an Assassin"): a parte de
// tipo é lida no M.dadoDe (camada 4, pelo índice I.tp); a de kw/P/R/habil, nas camadas como as outras. Subtipo de
// terreno básico fica de fora (dá mana, CR 305.6/305.7: precisaria tirar as habilidades de mana de antes).
const TERRA_BASICA = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
M.estTipoEquipOk = s => !!s && s.modo === 'continuo' && s.afeta === 'equipada' && !!(s.tipo || s.sub)
  && (s.tipo || []).every(t => TIPOS_CARTA.has(t)) && !(s.sub || []).some(x => x === 'escolhido' || TERRA_BASICA.has(x))
  && Object.keys(s).every(k => CONT_OK.has(k) || k === 'tipo' || k === 'sub' || k.startsWith('_')) && (!s.se || M.seOk(s.se));
const SEM_TIPO = new WeakMap<object, any>();
const semTipo = s => { let r = SEM_TIPO.get(s); if (!r) { const { tipo, sub, ...x } = s; SEM_TIPO.set(s, (r = x)); } return r; };
M.estContOk = s => M.estTipoOk(s) || (!!s && s.afeta === 'equipada' && !!(s.tipo || s.sub)
  ? M.estTipoEquipOk(s) && (!(s.p !== undefined || s.r !== undefined || (s.kw || []).length || s.habil) || contOk(semTipo(s)))
  : contOk(s));
const contOk = s => !!s && s.modo === 'continuo' && Object.keys(s).every(k => CONT_OK.has(k) || k.startsWith('_'))
  && (s.afeta === 'este' || s.afeta === 'equipada' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && qtdEstOk(s.p) && qtdEstOk(s.r) && M.kwListaOk(s.kw) && habilOk(s.habil)
  && (s.p !== undefined || s.r !== undefined || (s.kw || []).length > 0 || s.habil !== undefined)
  && (!s.se || M.seOk(s.se));
const NADA = { p: 0, r: 0, kw: [] as any[], gat: [] as any[], atv: [] as any[] };
let lendoCamada = 0;
// Índice do campo (por partida): quem tem gatilho (dadoDe.gat) e quem tem estática (dadoDe.est), na ordem do campo.
// O mover e o criarFicha avisam quem entra e sai (M.campoEntra/M.campoSai); e.vCamada (transformar, trocar de
// controle, anexar) ou o tamanho do campo fora do esperado refazem tudo. Antes a chave era e.ts: cada ficha nova
// refazia a varredura, e com milhares de Goblins do Krenko cada evento era O(campo) — O(n²) na partida.
type Idx = { v: number; n: number; gat: number[]; est: number[]; sb: number[]; tp: number[]; l: [any, any][] | null; hab: boolean };
const IDX = new WeakMap<any, Idx>();
function indice(e): Idx {
  let I = IDX.get(e);
  if (I && I.v === (e.vCamada || 0) && I.n === e.campo.length) return I;
  I = { v: e.vCamada || 0, n: e.campo.length, gat: [], est: [], sb: [], tp: [], l: null, hab: false };
  lendoTipo++;   // o dadoDe daqui não lê o tipo dado pela equipada (é o próprio índice que ele usa)
  try { for (const id of e.campo) { const d = M.dadoDe(e, e.objs[id]); if (d.gat) I.gat.push(id); if (d.est) I.est.push(id); if (d.subst) I.sb.push(id); if (tipoEquip(d).length) I.tp.push(id); } }
  finally { lendoTipo--; }
  IDX.set(e, I);
  return I;
}
M.indiceCampo = indice;
/** chamados depois de o id entrar em / sair de e.campo (o objeto já com a face nova) */
M.campoEntra = (e, id) => {
  const I = IDX.get(e); if (!I) return;
  if (I.v !== (e.vCamada || 0) || I.n + 1 !== e.campo.length) { IDX.delete(e); return; }
  let d; lendoTipo++; try { d = M.dadoDe(e, e.objs[id]); } finally { lendoTipo--; }
  if (tipoEquip(d).length) { IDX.delete(e); return; }   // raro (Equipamento que dá tipo): refaz tudo, a equipada pode mudar de tipo
  I.n++;
  if (d.gat) I.gat.push(id);
  if (d.est) { I.est.push(id); I.l = null; }
  if (d.subst) I.sb.push(id);
};
M.campoSai = (e, id) => {
  const I = IDX.get(e); if (!I) return;
  if (I.v !== (e.vCamada || 0) || I.n - 1 !== e.campo.length) { IDX.delete(e); return; }
  I.n--;
  let k = I.gat.indexOf(id); if (k >= 0) I.gat.splice(k, 1);
  k = I.est.indexOf(id); if (k >= 0) { I.est.splice(k, 1); I.l = null; }
  k = I.sb.indexOf(id); if (k >= 0) I.sb.splice(k, 1);
  k = I.tp.indexOf(id); if (k >= 0) I.tp.splice(k, 1);
};
// ganho de vida (CR 119.3) com as substituições 'ganhaVida' do campo (CR 614.1a): Angel of Vitality/Bilbo (soma),
// The Wind Crystal (mult). Cada uma vale uma vez por evento (616.5); a ordem é de quem ganha (616.1): somas antes
// dos dobros, que é a que dá mais. jog: de quem é o ganho, visto do controlador da fonte. Devolve o que ganhou.
M.ganharVida = (e, j, q) => {
  if (!(q > 0) || e.jogs[j].saiu || M.vidaFixa(e, j)) return 0;
  let soma = 0, mult = 1;
  for (const id of indice(e).sb) {
    const F = e.objs[id];
    for (const sb of M.dadoDe(e, F).subst || []) {
      if (sb.ev !== 'ganhaVida' || !sb.muda) continue;
      if (sb.jog === 'voce' ? j !== F.ctrl : sb.jog === 'oponente' ? j === F.ctrl : sb.jog !== undefined && sb.jog !== 'qualquer') continue;
      if (sb.se) { let ok = false; try { ok = M.condicao(e, sb.se, { voce: F.ctrl, este: F.id }); } catch (_) { ok = false; } if (!ok) continue; }
      if (sb.muda.soma) soma += sb.muda.soma;
      if (sb.muda.mult) mult *= sb.muda.mult;
    }
  }
  q = (q + soma) * mult;
  e.jogs[j].vida += q;
  M.evento(e, { ev: 'ganhaVida', j, q });
  return q;
};
// quem no campo tem estática 'continuo' lida (sem isso, cada leitura de P/R ou palavra-chave varria o campo inteiro)
function fontesCont(e): Idx & { l: [any, any][] } {
  const I = indice(e);
  if (I.l) return I as Idx & { l: [any, any][] };
  const l: [any, any][] = [];
  for (const id of I.est) for (const s of M.dadoDe(e, e.objs[id]).est || []) if (s.modo === 'continuo' && M.estContOk(s)) l.push([id, s]);
  I.l = l; I.hab = l.some(([, s]) => s.habil);
  return I as Idx & { l: [any, any][] };
}
// Estática que vale de fora do campo (se.esteEm: Anger, Wonder, Filth, Brawn no cemitério — CR 113.6, 604.1):
// o dado de uma carta não muda na partida, então a lista de quem TEM essa estática é feita uma vez por partida e só
// cresce pelos ids novos (e.prox); a cada leitura vale só quem está agora numa das zonas pedidas. Quem está no campo
// já entra pelo fontesCont (e a condição esteEm o recusa lá).
type Fora = { k: number; l: [number, any][] };
const FORA = new WeakMap<any, Fora>();
function fontesFora(e): [any, any][] {
  let F = FORA.get(e); if (!F) FORA.set(e, F = { k: 0, l: [] });
  for (; F.k < e.prox; F.k++) {
    const o = e.objs[F.k]; if (!o || o.hab) continue;
    for (const s of M.dadoDe(e, o).est || []) if (s.modo === 'continuo' && s.se && Array.isArray(s.se.esteEm) && s.se.esteEm.some(z => z !== 'campo') && M.estContOk(s)) F.l.push([F.k, s]);
  }
  if (!F.l.length) return F.l;
  return F.l.filter(([id, s]) => { const o = e.objs[id]; return o && o.zona !== 'campo' && s.se.esteEm.includes(o.zona); });
}
M.fontesFora = fontesFora;
// a estática s da fonte F afeta o? 'equipada' = o objeto a que F está anexada (Equipamento ou Aura, CR 301.5a/303.4a)
function afeta(e, F, s, o, ctx) {
  if (s.afeta === 'este') return o.id === F.id && o.ts === F.ts;
  if (s.afeta === 'equipada') return !!F.anexo && F.anexo.id === o.id && F.anexo.ts === o.ts;
  return M.bate(e, o, { zona: 'campo', ...s.afeta }, ctx);
}
// o efeito temporário t (e.temp, e.efTemp) vale para o? t.ids não muda depois de criado: o conjunto fica guardado.
// Antes era t.ids.some a cada leitura: 74 efeitos de +1/+0 num turno, 319 Goblins cada, e cada P/R lido varria 23 mil
// ids (fuzz semente 1039, 34 s).
const IDS_T = new WeakMap<any, Set<string>>();
M.tempTem = (t, o) => {
  if (!t.ids) return false;
  let S = IDS_T.get(t.ids); if (!S) IDS_T.set(t.ids, S = new Set(t.ids.map(x => x.id + ':' + x.ts)));
  return S.has(o.id + ':' + o.ts);
};
// soma dos 'modificar' até o fim do turno por objeto (id:ts). e.temp só cresce no turno (e vira [] novo na virada),
// então o índice só acrescenta as entradas novas.
const SOMA_T = new WeakMap<any[], { n: number; m: Map<string, { p: number; r: number; kw: any[] }> }>();
function somaTemp(temp: any[]) {
  let I = SOMA_T.get(temp);
  if (!I || I.n > temp.length) SOMA_T.set(temp, I = { n: 0, m: new Map() });
  for (; I.n < temp.length; I.n++) {
    const t = temp[I.n];
    for (const x of t.ids) {
      const k = x.id + ':' + x.ts; let v = I.m.get(k); if (!v) I.m.set(k, v = { p: 0, r: 0, kw: [] });
      v.p += t.p || 0; v.r += t.r || 0; for (const w of t.kw || []) v.kw.push(w);
    }
  }
  return I.m;
}
// Leitura em lote (M.lote): enquanto o estado não muda (ABE olhando o campo, opções de prioridade/ataque/bloqueio,
// agente decidindo), a contagem de uma estática ('conta', ex. Coat of Arms) é a mesma para todo objeto afetado: ela
// só depende da fonte (ctx = controlador e a própria fonte, lida sem camadas). Sem isso, mil fichas de Goblin com o
// Coat of Arms custavam mil contagens de mil a cada leitura do campo — O(n²) por passo (fuzz semente 1022, Krenko +
// Staff of Domination). Fora do lote nada é guardado.
let LOTE: Map<any, Map<string, number>> | null = null;
M.lote = fn => { if (LOTE) return fn(); LOTE = new Map(); try { return fn(); } finally { LOTE = null; } };
function qtdCamada(e, s, q, F, ctx) {
  if (!LOTE || typeof q === 'number') return M.qtdEst(e, q, ctx);
  let m = LOTE.get(q); if (!m) LOTE.set(q, m = new Map());
  const k = F.id + ':' + F.ts + ':' + F.ctrl;
  let v = m.get(k); if (v === undefined) m.set(k, v = M.qtdEst(e, q, ctx));
  return v;
}
// lote: objetos que acabaram de sair do campo (LKI, CR 603.10a) — continuam valendo como fonte para quem olha para trás
function camadas(e, o, lote?: any[]) {
  if (lendoCamada || o.zona !== 'campo') return NADA;
  const FC = fontesCont(e), temp = e.temp || [];
  let fontes: [any, any][] = FC.l;
  const fora = fontesFora(e);
  if (fora.length) fontes = fontes.concat(fora);
  if (lote && lote.length) { fontes = fontes.slice(); for (const S of lote) for (const s of M.dadoDe(e, S).est || []) if (s.modo === 'continuo' && M.estContOk(s)) fontes.push([S, s]); }
  if (!fontes.length && !temp.length) return NADA;
  lendoCamada++;
  try {
    let p = 0, r = 0; const kw: any[] = [], gat: any[] = [], atv: any[] = [];
    for (const [x, s] of fontes) {
      const F = typeof x === 'object' ? x : e.objs[x];
      const ctx = { voce: F.ctrl, este: F.id };
      if (!afeta(e, F, s, o, ctx)) continue;
      if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } if (!ok) continue; }
      if (s.p !== undefined) p += qtdCamada(e, s, s.p, F, ctx);
      if (s.r !== undefined) r += qtdCamada(e, s, s.r, F, ctx);
      for (const x of s.kw || []) kw.push(x);
      if (s.habil) { for (const g of s.habil.gat || []) gat.push(g); for (const a of s.habil.atv || []) atv.push(a); }
    }
    const T = temp.length ? somaTemp(temp).get(o.id + ':' + o.ts) : undefined;
    if (T) { p += T.p; r += T.r; for (const x of T.kw) kw.push(x); }
    return { p, r, kw, gat, atv };
  } finally { lendoCamada--; }
}
M.camadas = camadas;
M.qtdEst = (e, q, ctx) => {
  if (typeof q === 'number') return q;
  if (typeof q.conta === 'object' && q.prop) {
    const os = M.objetosQue(e, q.conta, ctx);
    const v = q.prop === 'somaVm' ? os.reduce((s, o) => s + (M.dadoDe(e, o).vm || 0), 0)
      : q.prop === 'somaPoder' ? os.reduce((s, o) => s + Math.max(0, M.poder(e, o)), 0)
      : os.reduce((m, o) => Math.max(m, M.poder(e, o)), 0);      // maiorPoder (sem criatura: 0)
    return v * (q.mult || 1) + (q.soma || 0);
  }
  if (typeof q.conta === 'object') return M.objetosQue(e, q.conta, ctx).length * (q.mult || 1) + (q.soma || 0);
  const J = e.jogs[ctx.voce], este = e.objs[ctx.este];
  const v = q.conta === 'cartasNaMao' ? J.zonas.mao.length : q.conta === 'suaVida' ? J.vida
    : q.conta === 'oponentes' ? M.vivos(e).filter(j => j !== ctx.voce).length : q.conta === 'jogadores' ? M.vivos(e).length
    : q.conta === 'devocao' ? M.devocao(e, ctx.voce, q.de)
    : q.conta === 'marcadoresNoEste' ? (!este ? 0 : q.de ? este.marc[q.de] || 0 : Object.values<any>(este.marc).reduce((s, n) => s + n, 0)) : 0;   // de: um tipo de marcador
  return v * (q.mult || 1) + (q.soma || 0);
};
/** palavras-chave do objeto: as da carta (ou face/ficha) e as dadas pelas camadas (CR 613.1f) */
M.kwDe = (e, o) => { const b = M.dadoDe(e, o).kw || []; const c = camadas(e, o).kw; return c.length ? b.concat(c) : b; };
/** habilidades ativadas: as da carta, as de equipar (palavra-chave) e as dadas pelas camadas, nessa ordem (k estável) */
const ATV_CARTA = new WeakMap<object, any[]>();   // atv da carta + equipar, por dado (não muda na partida)
// ciclar N (CR 702.29a): "[custo], descarte esta carta: compre um card", ativada da mão. O descarte dispara 'descarta'.
const CICLAR = new WeakMap<object, any>();
const ciclarDe = kw => {
  let a = CICLAR.get(kw);
  if (!a) CICLAR.set(kw, (a = { custo: { mana: kw.custo || {}, descartarEste: true }, zona: 'mao', _ciclar: true, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }));
  return a;
};
// subir de nível (CR 716.2a): "[custo]: Nível N" — ativada como feitiço, só com a Classe no nível N−1 (pilha.ts podeAtivar)
const SUBIR = new WeakMap<object, any>();
const subirDe = l => {
  let a = SUBIR.get(l);
  if (!a) SUBIR.set(l, (a = { custo: { mana: l.custo || {} }, vel: 'feitico', _nivel: l.n, fx: [{ op: 'subirNivel', n: l.n }] }));
  return a;
};
const atvCarta = d => {
  let l = ATV_CARTA.get(d);
  if (!l) {
    const eq = (d.kw || []).filter(x => x.k === 'equipar'), ci = (d.kw || []).filter(x => x.k === 'ciclar' && x.custo && Object.keys(x).length === 2);
    const nv = M.ehClasse(d) && Array.isArray(d.niveis) ? d.niveis.filter(x => Number.isInteger(x.n) && x.n >= 2) : [];
    ATV_CARTA.set(d, (l = eq.length || ci.length || nv.length ? [...(d.atv || []), ...eq.map(equiparDe), ...ci.map(ciclarDe), ...nv.map(subirDe)] : d.atv || NADA.atv));
  }
  return l as any[];
};
// ganhas por efeito de resolução enquanto no campo (o.ganhos.atv: Urza's Saga) vêm logo depois das da carta: só crescem, k estável
M.atvDe = (e, o) => {
  let b = atvCarta(M.dadoDe(e, o));
  if (o.ganhos && o.ganhos.atv) b = b.concat(o.ganhos.atv);
  const h = fontesCont(e).hab ? camadas(e, o).atv : NADA.atv;
  return h.length ? b.concat(h) : b;
};
/** alguém no campo dá habilidade (habil)? sem isso gatDe/atvDe são só os da carta */
M.temHabil = e => fontesCont(e).hab;
/** habilidades desencadeadas: as da carta e as dadas pelas camadas; quantas são da carta = (dadoDe.gat || []).length.
 *  lote: só os que saíram do campo E dão habilidade (M.loteHabil) — o lote inteiro aqui ficava O(n²) num Blasphemous Act */
M.loteHabil = (e, lote) => (lote || []).filter(S => (M.dadoDe(e, S).est || []).some(s => s.modo === 'continuo' && s.habil));
M.gatDe = (e, o, lote?) => {
  const b = M.dadoDe(e, o).gat || [];
  if (!fontesCont(e).hab && !(lote && lote.length)) return b;
  const h = camadas(e, o, lote).gat;
  return h.length ? b.concat(h) : b;
};

// ---- filtro RX (campos somam em E; listas dentro de um campo são OU) — o que ainda não existe falha alto ----
const FILTRO_OK = new Set(['este', 'outro', 'ouEste', 'tipo', 'nao', 'sub', 'super', 'ctrl', 'dono', 'cor', 'zona', 'virada', 'comandante', 'ficha', 'vm', 'poder', 'atacando',
  'equipada', 'anexadoA', 'encantada', 'comEquipamento', 'nome', 'tipoEmComum', 'tipoTodos', 'historico', 'lembrada']);
M.filtroOk = f => Object.keys(f || {}).every(k => FILTRO_OK.has(k));
const COR_NOME = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' };
M.bate = (e, o, f, ctx: any = {}) => {
  for (const k in f) if (!FILTRO_OK.has(k)) throw new Error('filtro sem suporte no motor2: ' + k);
  const d = M.dadoDe(e, o), voce = ctx.voce;
  if (f.este && o.id !== ctx.este) return false;
  if (f.nome !== undefined && o.n !== f.nome && d.n !== f.nome) return false;   // nome exato (Ancestral Anger, Wedding Ring)
  if (f.outro && o.id === ctx.este) return false;
  if (f.lembrada && !(ctx.movidos || []).some(m => m.id === o.id && m.ts === o.ts)) return false;   // o que o efeito anterior moveu (cavar, mover, exilar)
  if (f.zona && f.zona !== 'qualquer' && o.zona !== f.zona) return false;
  if (f.tipo && !f.tipo.some(t => t === 'Card' || (t === 'Permanent' ? M.ehPermanente(e, o) : t === 'Token' ? !!o.ficha : (d.tipos || []).includes(t)))) return false;
  if (f.nao && f.nao.some(t => (COR_NOME[t] ? (d.cores || '').includes(COR_NOME[t]) : t === 'Colorless' ? !(d.cores || '') : false) || (d.tipos || []).includes(t) || (d.sub || []).includes(t) || (d.super || []).includes(t) || (t === 'Token' && o.ficha))) return false;
  if (f.sub && !f.sub.some(s => (d.sub || []).includes(s === 'escolhido' ? escolhidoDe(e, ctx) : s))) return false;   // tipo escolhido pela fonte ao entrar (Morophon, Herald's Horn)
  if (f.super && !f.super.every(s => (d.super || []).includes(s))) return false;
  if (f.tipoTodos && !f.tipoTodos.every(t => (d.tipos || []).includes(t))) return false;            // criatura artefato (Mycosynth Golem)
  if (f.historico && !((d.tipos || []).includes('Artifact') || (d.super || []).includes('Legendary') || (d.sub || []).includes('Saga'))) return false;   // CR 700.6
  if (f.ctrl && !quemBate(e, o.ctrl, f.ctrl, voce)) return false;
  if (f.dono && !quemBate(e, o.dono, f.dono, voce)) return false;
  // 'C'/'Colorless' = incolor (CR 105.2c: sem cor nenhuma; Mystic Forge, Ugin): includes('C') nunca casava
  if (f.cor && !(Array.isArray(f.cor) ? f.cor : [f.cor]).some(c => c === 'C' || c === 'Colorless' ? !(d.cores || '') : (d.cores || '').includes(COR_NOME[c] || c))) return false;
  if (f.virada !== undefined && !!o.virada !== !!f.virada) return false;
  if (f.comandante !== undefined && !!o.cmd !== !!f.comandante) return false;
  if (f.ficha !== undefined && !!o.ficha !== !!f.ficha) return false;
  if (f.vm && !compara(d.vm || 0, f.vm)) return false;
  if (f.poder && !compara(M.poder(e, o), f.poder)) return false;
  if (f.atacando !== undefined && M.atacando(e, o) !== !!f.atacando) return false;   // CR 506.4: atacando até o fim do combate
  // anexos: equipada = o objeto a que a fonte (ctx.este) está presa; anexadoA 'este' = preso à fonte;
  // encantada / comEquipamento = com pelo menos uma Aura / um Equipamento preso a ele
  if (f.equipada !== undefined) { const F = e.objs[ctx.este], A = F && F.anexo; if ((!!A && A.id === o.id && A.ts === o.ts) !== !!f.equipada) return false; }
  if (f.anexadoA === 'este') { const F = e.objs[ctx.este]; if (!F || !o.anexo || o.anexo.id !== F.id || o.anexo.ts !== F.ts) return false; }
  if (f.encantada !== undefined && M.anexosDe(e, o).some(x => M.temTipo(e, x, 'Enchantment') && (M.dadoDe(e, x).sub || []).includes('Aura')) !== !!f.encantada) return false;
  if (f.comEquipamento !== undefined && M.anexosDe(e, o).some(x => (M.dadoDe(e, x).sub || []).includes('Equipment')) !== !!f.comEquipamento) return false;
  if (f.tipoEmComum !== undefined && !tipoEmComum(e, o, f.tipoEmComum, ctx)) return false;
  return true;
};
// tipos de criatura (CR 205.3m: subtipos de criatura e de Kindred); metamorfo (702.73a) = todos → 'todos'
const tiposCriatura = (e, o) => {
  const d = M.dadoDe(e, o);
  if ((d.kw || []).some(x => x.k === 'metamorfo')) return 'todos';
  return (d.tipos || []).some(t => t === 'Creature' || t === 'Kindred' || t === 'Tribal') ? d.sub || [] : [];
};
const comumCom = (a, b) => a === 'todos' ? (b === 'todos' || b.length > 0) : b === 'todos' ? a.length > 0 : a.some(t => b.includes(t));
// tipoEmComum: 'este' (a fonte), 'doEvento' (o objeto do evento: ctx.ev), 'comandante' (os seus) ou um filtro (alguma que bate)
function tipoEmComum(e, o, ref, ctx) {
  const t = tiposCriatura(e, o); if (t !== 'todos' && !t.length) return false;
  let outros: any[];
  if (ref === 'este') outros = [e.objs[ctx.este]];
  else if (ref === 'doEvento') outros = [ctx.ev && e.objs[ctx.ev.ev === 'dano' ? ctx.ev.fonte : ctx.ev.id]];
  else if (ref === 'comandante') outros = Object.values<any>(e.objs).filter(x => x.cmd && !x.hab && x.dono === ctx.voce);
  else if (ref && typeof ref === 'object' && M.filtroOk(ref)) outros = M.objetosQue(e, ref, ctx).filter(x => x.id !== o.id);
  else throw new Error('tipoEmComum sem suporte: ' + JSON.stringify(ref));
  return outros.some(x => x && comumCom(t, tiposCriatura(e, x)));
}
const escolhidoDe = (e, ctx) => { const F = e.objs[ctx.este]; return F && F.escolha && F.escolha.tipo || '\u0000'; };
M.atacando = (e, o) => !!(e.turno.combate && (e.turno.combate.atk || []).some(r => r.id === o.id && r.ts === o.ts));
const quemBate = (e, j, q, voce) => q === 'qualquer' ? true : q === 'voce' ? j === voce : q === 'oponente' ? j !== voce : true;
const compara = (v, c) => typeof c === 'number' ? v === c
  : (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max) && (c.igual === undefined || v === c.igual);
M.compara = compara;

// objetos que batem num filtro (zona padrão: campo)
M.objetosQue = (e, f, ctx) => {
  const z = f.zona || 'campo';
  let ids;
  if (z === 'campo') ids = e.campo;
  else if (z === 'pilha') ids = e.pilha;
  else ids = e.jogs.flatMap(j => z === 'qualquer' ? ZONAS_JOG.flatMap(k => j.zonas[k]) : j.zonas[z]);
  const ff = z === 'campo' && !f.zona ? { ...f, zona: 'campo' } : f;
  return ids.map(id => e.objs[id]).filter(o => M.bate(e, o, ff, ctx));
};

// há pelo menos n objetos no campo que batem? (para no n-ésimo: campo com mil fichas não custa mil)
M.temPeloMenos = (e, f, ctx, n) => {
  let c = 0;
  for (const id of e.campo) if (M.bate(e, e.objs[id], f, ctx) && ++c >= n) return true;
  return false;
};

// contas de ataque: atacantes = as que estão atacando neste combate (Jazal, Firemane Commando); atacantesEmVoce = as
// que atacam você ou um planeswalker seu (no combate de agora; fora dele, as deste turno: Faramir); ataquesNoTurno = as
// que você pôs para atacar neste turno (Alesha, Windbrisk Heights). e.turno.ataques guarda o turno (combate.ts).
const CONTA_ATK = new Set(['atacantes', 'atacantesEmVoce', 'ataquesNoTurno']);
M.contaAtaque = (e, conta, voce) => {
  const C = e.turno.combate, hist = (e.turno.ataques || []).filter(r => !r.entrou);   // quem entrou atacando não "atacou" (508.4)
  if (conta === 'atacantes') return C ? C.atk.filter(r => M.emCombate(e, r)).length : 0;
  if (conta === 'atacantesEmVoce') return (C ? C.atk : hist).filter(r => r.def === voce).length;
  return hist.filter(r => r.j === voce).length;
};

// ---- quantidade RX (número, X, {conta:filtro}) ----
M.qtd = (e, q, ctx: any = {}) => {
  if (typeof q === 'number') return q;
  if (q === 'X') return ctx.x || 0;
  if (q && typeof q.conta === 'object') return q.prop ? M.qtdEst(e, q, ctx) : M.objetosQue(e, q.conta, ctx).length * (q.mult || 1) + (q.soma || 0);
  if (q && (q.conta === 'lembrados' || q.conta === 'evento')) return M.qtdDe(e, q, { lki: {}, ...ctx });
  if (q && CONTA_ATK.has(q.conta)) return M.contaAtaque(e, q.conta, ctx.voce) * (q.mult || 1) + (q.soma || 0);
  if (q && CONTA_EST.has(q.conta) && qtdEstOk(q)) return M.qtdEst(e, q, ctx);   // marcadoresNoEste (de), mão, vida, devoção…
  return null;      // contagem que o núcleo ainda não sabe → quem chama não oferece a habilidade
};

// devoção (CR 700.5): símbolos de mana das cores pedidas nos custos dos permanentes que j controla; símbolo híbrido
// conta uma vez se tiver qualquer uma delas (700.5a); genérico e {C} não contam
M.devocao = (e, j, cores) => {
  let n = 0;
  for (const id of e.campo) {
    const o = e.objs[id]; if (o.ctrl !== j) continue;
    const c = M.dadoDe(e, o).custo; if (!c || !c.p) continue;
    for (const s of c.p) if (typeof s === 'string' && [...cores].some(x => s.includes(x))) n++;
  }
  return n;
};
// ---- condição RX ('se') — só o que já existe; o resto falha alto para não jogar errado em silêncio ----
const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta', 'conjuradaCom', 'palavra', 'pagou', 'objBate', 'esteEm']);
// conjuradaCom 'kicker' e palavra 'promisedgift' (chute/presente pagos); palavras de habilidade lidas do estado agora
// (PALAVRA): metalcraft (3+ artefatos), coven (3+ poderes diferentes), blessing (bênção da cidade, 702.131: 10+
// permanentes uma vez = para sempre). Fora daqui (solved, morbid…) a condição é recusada.
const PALAVRA: Record<string, (e, ctx) => boolean> = {
  metalcraft: (e, ctx) => M.objetosQue(e, { tipo: ['Artifact'], ctrl: 'voce', zona: 'campo' }, ctx).length >= 3,
  coven: (e, ctx) => new Set(M.objetosQue(e, { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' }, ctx).map(o => M.poder(e, o))).size >= 3,
  blessing: (e, ctx) => { const J = e.jogs[ctx.voce]; if (!J.bencao && e.campo.filter(id => e.objs[id].ctrl === ctx.voce).length >= 10) J.bencao = true; return !!J.bencao; },
};
M.condValorOk = se => (se.conjuradaCom === undefined || se.conjuradaCom === 'kicker') && (se.palavra === undefined || se.palavra === 'promisedgift' || !!PALAVRA[se.palavra]);
M.condicao = (e, se, ctx) => {
  if (!se) return true;
  for (const k in se) if (!COND_OK.has(k)) throw new Error('condição sem suporte no motor2: ' + k);
  if (se.existe) {
    const f = { ...se.existe.f }; if (!f.ctrl && (f.zona || 'campo') === 'campo') f.ctrl = 'qualquer';
    const n = M.objetosQue(e, f, ctx).length;
    const c = se.existe;
    if (c.min === undefined && c.max === undefined && c.igual === undefined ? n < 1 : !compara(n, c)) return false;
  }
  if (se.controla && M.objetosQue(e, { ...se.controla.f, ctrl: 'voce' }, ctx).length < (se.controla.min || 1)) return false;
  if (se.turno && (se.turno === 'seu') !== (e.turno.ativo === ctx.voce)) return false;
  if (se.conjuradaCom !== undefined || se.palavra !== undefined) {   // a mágica resolvendo (ctx.opc) ou a permanente que ela virou
    if (!M.condValorOk(se)) throw new Error('condição sem suporte no motor2: ' + (se.conjuradaCom || se.palavra));
    const E = e.objs[ctx.este], cc = E && E.zona === 'campo' ? E.conjCom : null, op = ctx.opc;
    if (se.conjuradaCom === 'kicker' && !((op && op.chute) || (cc && cc.kicker))) return false;
    if (se.palavra === 'promisedgift' && !((op && op.presente) || (cc && cc.presente))) return false;
    if (se.palavra && PALAVRA[se.palavra] && !PALAVRA[se.palavra](e, ctx)) return false;
  }
  if (se.pagou !== undefined && !!ctx.pagou !== !!se.pagou) return false;
  if (se.esteEm) { const E = e.objs[ctx.este]; if (!E || !se.esteEm.includes(E.zona)) return false; }   // "as long as this is in your graveyard" (Anger, Wonder)
  if (se.objBate) {                                                 // o objeto (este, doEvento, equipada, criadas, alvo) bate no filtro? nao: o contrário
    const b = M.objsDe(e, { em: se.objBate.em }, ctx).some(o => M.bate(e, o, se.objBate.f || {}, ctx));
    if (b === !!se.objBate.nao) return false;
  }   // "se fizer" do efeito anterior (ctx da resolução)
  const vida = e.jogs[ctx.voce].vida;
  if (se.vidaMin !== undefined && vida < se.vidaMin) return false;
  if (se.vidaMax !== undefined && vida > se.vidaMax) return false;
  if (se.conta) { const v = M.qtd(e, se.conta.q, ctx); if (v === null || !compara(v, se.conta)) return false; }
  return true;
};
