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
M.dadoDe = (e, o) => o.ficha ? o.ficha : M.carta(o.n);   // ficha leva o próprio dado

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
M.listaDe = (e, o) => o.zona === 'campo' ? e.campo : o.zona === 'pilha' ? e.pilha : e.jogs[o.dono].zonas[o.zona];

// Mover de zona. CR 400.7: vira objeto novo — o id fica (é a carta física, a designação de comandante vai junto,
// CR 903.3), mas timestamp novo e o estado do campo zera. Ficha fora do campo deixa de existir (CR 704.5d, nas ABE).
// CR 903.9b (comandante iria para mão/grimório → pode ir ao comando): escolha do dono; por ora sempre aceita
// (pergunta de substituição entra na T19).
M.mover = (e, id, zona, { topo = true, virada = false }: any = {}) => {
  const o = e.objs[id];
  if (o.cmd && (zona === 'mao' || zona === 'grimorio')) zona = 'comando';
  const zDe = o.zona, snap = zDe === 'campo' ? { ...o, marc: { ...o.marc } } : null;   // LKI de quem sai (603.10a)
  const de = M.listaDe(e, o), k = de.indexOf(id);
  if (k >= 0) de.splice(k, 1);
  Object.assign(o, { zona, ts: ++e.ts, virada: zona === 'campo' && virada, dano: 0, marc: {} as any, doente: true, ctrl: o.dono, escolha: null, mortal: false, lealTurno: 0, usos: null });
  if (zona === 'campo' && M.dadoDe(e, o).leal) o.marc.lealdade = M.dadoDe(e, o).leal;   // CR 306.5b: entra com a lealdade impressa
  const para = M.listaDe(e, o);
  if (zona === 'grimorio' && !topo) para.unshift(id); else para.push(id);   // grimório: fim do array = topo
  if (zona === 'cemiterio' || zona === 'exilio') e.abeNovo.push(id);
  if (M.evento && (zDe === 'campo' || zona === 'campo' || zona === 'cemiterio')) M.evento(e, { ev: 'zona', id, de: zDe, para: zona, snap });   // gatilhos.js
  if (o.ficha && zona !== 'campo') (e.fichasFora = e.fichasFora || []).push(id);   // CR 704.5d: some nas ABE        // CR 903.9a olha "desde a última checagem"
  return o;
};

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
M.resistencia = (e, o) => {      // sem camadas ainda (T18): base + marcadores +1/+1 e −1/−1
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const b = typeof pt[1] === 'number' ? pt[1] : 0;
  return b + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
};
M.poder = (e, o) => {
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const b = typeof pt[0] === 'number' ? pt[0] : 0;
  return b + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
};

// ---- filtro RX (campos somam em E; listas dentro de um campo são OU) — o que ainda não existe falha alto ----
const FILTRO_OK = new Set(['este', 'outro', 'ouEste', 'tipo', 'nao', 'sub', 'super', 'ctrl', 'dono', 'cor', 'zona', 'virada', 'comandante', 'ficha', 'vm', 'poder', 'atacando']);
M.filtroOk = f => Object.keys(f || {}).every(k => FILTRO_OK.has(k));
const COR_NOME = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' };
M.bate = (e, o, f, ctx: any = {}) => {
  for (const k in f) if (!FILTRO_OK.has(k)) throw new Error('filtro sem suporte no motor2: ' + k);
  const d = M.dadoDe(e, o), voce = ctx.voce;
  if (f.este && o.id !== ctx.este) return false;
  if (f.outro && o.id === ctx.este) return false;
  if (f.zona && f.zona !== 'qualquer' && o.zona !== f.zona) return false;
  if (f.tipo && !f.tipo.some(t => t === 'Card' || (t === 'Permanent' ? M.ehPermanente(e, o) : t === 'Token' ? !!o.ficha : (d.tipos || []).includes(t)))) return false;
  if (f.nao && f.nao.some(t => (COR_NOME[t] ? (d.cores || '').includes(COR_NOME[t]) : t === 'Colorless' ? !(d.cores || '') : false) || (d.tipos || []).includes(t) || (d.sub || []).includes(t) || (d.super || []).includes(t) || (t === 'Token' && o.ficha))) return false;
  if (f.sub && !f.sub.some(s => (d.sub || []).includes(s))) return false;
  if (f.super && !f.super.every(s => (d.super || []).includes(s))) return false;
  if (f.ctrl && !quemBate(e, o.ctrl, f.ctrl, voce)) return false;
  if (f.dono && !quemBate(e, o.dono, f.dono, voce)) return false;
  if (f.cor && !(Array.isArray(f.cor) ? f.cor : [f.cor]).some(c => (d.cores || '').includes(COR_NOME[c] || c))) return false;
  if (f.virada !== undefined && !!o.virada !== !!f.virada) return false;
  if (f.comandante !== undefined && !!o.cmd !== !!f.comandante) return false;
  if (f.ficha !== undefined && !!o.ficha !== !!f.ficha) return false;
  if (f.vm && !compara(d.vm || 0, f.vm)) return false;
  if (f.poder && !compara(M.poder(e, o), f.poder)) return false;
  if (f.atacando !== undefined && M.atacando(e, o) !== !!f.atacando) return false;   // CR 506.4: atacando até o fim do combate
  return true;
};
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

// ---- quantidade RX (número, X, {conta:filtro}) ----
M.qtd = (e, q, ctx: any = {}) => {
  if (typeof q === 'number') return q;
  if (q === 'X') return ctx.x || 0;
  if (q && typeof q.conta === 'object') return M.objetosQue(e, q.conta, ctx).length * (q.mult || 1) + (q.soma || 0);
  return null;      // contagem que o núcleo ainda não sabe → quem chama não oferece a habilidade
};

// ---- condição RX ('se') — só o que já existe; o resto falha alto para não jogar errado em silêncio ----
const COND_OK = new Set(['existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'conta']);
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
  const vida = e.jogs[ctx.voce].vida;
  if (se.vidaMin !== undefined && vida < se.vidaMin) return false;
  if (se.vidaMax !== undefined && vida > se.vidaMax) return false;
  if (se.conta) { const v = M.qtd(e, se.conta.q, ctx); if (v === null || !compara(v, se.conta)) return false; }
  return true;
};
