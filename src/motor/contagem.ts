// src/motor/contagem.ts — UMA forma de contar (Felipe 27/11: "reestruturar as contagens numa só").
// Antes: um nome por combinação (poderDoAlvo, vmDoEvento, maiorDescarte, somaPoder…), cada carta nova criava outro.
// Agora a quantidade é  {conta: {de, o, junta?, marc?, cores?}, mult?, soma?, divCima?, metade?}:
//   de    = DE QUEM/ONDE se conta: 'este' | {alvo:N} | 'evento' | 'sacrificadas' | 'lembradas' | 'cada' | {f: filtro}
//           | 'voce' | 'oponentes' | 'jogadores' | 'turno' | 'combate' | 'X' | 'resultado' | 'se' | 'escolhido'
//   o     = O QUE se lê: 'quantos' | 'poder' | 'resist' | 'vm' | 'cores' | 'marcadores' (marc = tipo) | 'vida' | 'mao'
//           | 'grimorio' | 'devocao' (cores) | 'magias' | 'descartes' | 'ataques' | 'atacantes' | 'atacantesEmVoce' | 'dano'
//           | 'tipos' (tipos de card, com junta 'diferentes': delirium) | 'resolucoesDestaHab' (de 'turno': Omnath) …
//   junta = como junta vários: 'soma' | 'maior' | 'diferentes' | 'maiorPorDono' (sem junta = quantos / o valor do único)
// Os nomes velhos continuam entrando por traduzQtd() (o cartas-rx.js de reserva, até a T45, usa os nomes velhos);
// o banco próprio (banco/cartas) já é escrito no formato novo e o esquema não aceita mais nome velho.
import { M } from './nucleo';
import { traduzQtd, nova, NOMES_VELHOS, PROPS_VELHOS } from './contagem-trad';
export { traduzQtd, NOMES_VELHOS, PROPS_VELHOS } from './contagem-trad';

// o motor recebe a mesma qtd milhares de vezes: traduz uma vez só por objeto
const CACHE = new WeakMap();
M.qn = q => {
  if (!q || typeof q !== 'object' || !('conta' in q || 'ate' in q) || nova(q.conta)) return q;
  let v = CACHE.get(q); if (v === undefined) { try { v = traduzQtd(q); } catch (_) { v = q; } CACHE.set(q, v); }
  return v;
};
M.traduzQtd = traduzQtd;
M.NOMES_VELHOS = NOMES_VELHOS;
M.PROPS_VELHOS = PROPS_VELHOS;

// ---------- o que o motor sabe contar, por lugar ----------
// 'est' = habilidade estática/CDA/mana (sem evento nem alvo); 'cond' = condição e as leituras de M.qtd; 'efeito' = tudo
const temF = c => !!c.de && typeof c.de === 'object' && 'f' in c.de && Object.keys(c.de).length === 1;
const temAlvo = c => !!c.de && typeof c.de === 'object' && Number.isInteger(c.de.alvo) && Object.keys(c.de).length === 1;
const chaves = (c, ks) => Object.keys(c).every(k => ['de', 'o', ...ks].includes(k));
const DO_CONJ = { quantos: [undefined], poder: ['soma', 'maior'], resist: ['soma'], vm: ['soma', 'maior'], cores: ['diferentes'], tipos: ['diferentes'], nome: ['diferentes'] };
function base(c) {   // o que existe hoje no motor, sem olhar o lugar
  const o = c.o, j = c.junta;
  if (temF(c)) return M.filtroOk(c.de.f) && !!DO_CONJ[o] && DO_CONJ[o].includes(j) && chaves(c, ['junta']);
  if (temAlvo(c)) return ['poder', 'resist', 'vm', 'grimorio', 'vida'].includes(o) && chaves(c, []);
  switch (c.de) {
    case 'este': return o === 'marcadores' ? chaves(c, ['marc']) && (c.marc === undefined || typeof c.marc === 'string') : ['poder', 'resist'].includes(o) && chaves(c, []);
    case 'voce': return o === 'devocao' ? chaves(c, ['cores']) && /^[WUBRG]+$/.test(c.cores || '')
      : o === 'marcadores' ? chaves(c, ['marc']) && typeof c.marc === 'string' && !!c.marc : ['mao', 'grimorio', 'vida'].includes(o) && chaves(c, []);
    case 'turno': return ['vidaPerdida', 'compras'].includes(o) ? chaves(c, ['quem', 'junta']) && (c.quem === undefined || c.quem === 'cadaAtual' ? j === undefined : c.quem === 'oponentes' && (j === 'soma' || j === 'maior'))
      : ['magias', 'descartes', 'ataques', 'vidaGanha', 'resolucoesDestaHab', 'oponentesAtacados'].includes(o) && chaves(c, []);
    case 'combate': return ['atacantes', 'atacantesEmVoce'].includes(o) && chaves(c, []);
    case 'oponentes': case 'jogadores': return o === 'quantos' && chaves(c, []);
    case 'X': case 'resultado': return chaves(c, []) && o === undefined;
    case 'lembradas': return o === 'quantos' && (j === undefined || j === 'maiorPorDono') && chaves(c, ['junta']);
    case 'evento': return ['quantos', 'vida', 'dano', 'marcadores', 'poder', 'resist', 'vm', 'cores', 'mao'].includes(o) && chaves(c, []);
    case 'tipoMaisComum': return chaves(c, []) && o === undefined;
    case 'sacrificadas': return ['poder', 'vm'].includes(o) && j === 'soma' && chaves(c, ['junta']);
    case 'cada': return o === 'marcadores' ? chaves(c, ['marc']) && typeof c.marc === 'string' : o === 'vida' && chaves(c, []);
  }
  return false;
}
// estática: só o que não depende de evento/alvo/efeito anterior (é o CONTA_EST + PROP_EST de antes)
function estOk(c) {
  if (temF(c)) return true;
  if (c.de === 'voce') return ['mao', 'grimorio', 'vida', 'devocao'].includes(c.o);
  if (c.de === 'turno') return ['magias', 'compras', 'vidaGanha'].includes(c.o);
  if (c.de === 'este') return c.o === 'marcadores';
  return c.de === 'oponentes' || c.de === 'jogadores';
}
/** a conta (já nova) é jogável neste lugar? */
M.contaOk = (c, onde: 'efeito' | 'est' | 'cond' = 'efeito') => {
  if (!nova(c) || !base(c)) return false;
  if (onde === 'efeito') return true;
  if (estOk(c)) return true;
  return onde === 'cond' && ((c.de === 'lembradas' && c.junta === undefined) || (c.de === 'evento' && (c.o === 'quantos' || c.o === 'mao')) || c.de === 'combate' || (c.de === 'turno' && (c.o === 'ataques' || c.o === 'resolucoesDestaHab')));
};
M.contaEstOk = c => M.contaOk(c, 'est');

// ---------- contar ----------
const TIPOS_CARTA = new Set(['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Tribal', 'Land', 'Planeswalker', 'Sorcery']);
const coresN = s => new Set((s || '').replace(/[^WUBRG]/g, '')).size;
const vidaEv = ev => ev.ev === 'ganhaVida' || ev.ev === 'perdeVida';
/** valor cru da conta (sem mult/soma). ctx.lki presente = dentro de um efeito (alvos e 'este' pelo LKI, CR 608.2h) */
M.contar = (e, c, ctx: any = {}) => {
  const o = c.o, L = ctx.lki;
  if (temF(c)) {
    const os = M.objetosQue(e, c.de.f, ctx);
    if (o === 'quantos') return os.length;
    if (o === 'tipos') return new Set(os.flatMap(x => (M.dadoDe(e, x).tipos || []).filter(t => TIPOS_CARTA.has(t)))).size;   // delirium (CR 700.x: tipos de card)
    if (o === 'nome') return new Set(os.map(x => M.dadoDe(e, x).n || x.n)).size;
    if (o === 'resist') return os.reduce((s, x) => s + Math.max(0, M.resistencia(e, x)), 0);
    if (o === 'cores') return new Set(os.flatMap(x => (M.dadoDe(e, x).cores || '').replace(/[^WUBRG]/g, '').split('')).filter(Boolean)).size;
    if (o === 'vm') return c.junta === 'soma' ? os.reduce((s, x) => s + (M.dadoDe(e, x).vm || 0), 0) : os.reduce((m, x) => Math.max(m, M.dadoDe(e, x).vm || 0), 0);
    return c.junta === 'soma' ? os.reduce((s, x) => s + Math.max(0, M.poder(e, x)), 0) : os.reduce((m, x) => Math.max(m, M.poder(e, x)), 0);
  }
  if (temAlvo(c)) {
    const i = c.de.alvo;
    if (o === 'vida' || o === 'grimorio') { const jj = M.jogsAlvo(e, i, ctx)[0]; return jj === undefined ? 0 : o === 'vida' ? e.jogs[jj].vida : e.jogs[jj].zonas.grimorio.length; }
    const a = L && L.alvos && L.alvos[i] && L.alvos[i][0];
    return a ? a[o] : 0;
  }
  const J = e.jogs[ctx.voce];
  switch (c.de) {
    case 'este': {
      const ob = e.objs[ctx.este];
      const este = !L ? ob : ob && ob.zona === 'campo' ? M.lkiDe(e, ob) : L.este;
      if (!este) return 0;
      if (o === 'marcadores') return c.marc ? este.marc[c.marc] || 0 : Object.values<any>(este.marc).reduce((s, n) => s + n, 0);
      return este[o];
    }
    case 'voce':
      if (o === 'mao') return J.zonas.mao.length;
      if (o === 'grimorio') return J.zonas.grimorio.length;
      if (o === 'vida') return J.vida;
      if (o === 'devocao') return M.devocao(e, ctx.voce, c.cores);
      return c.marc === 'poison' ? J.veneno || 0 : (J.marc || {})[c.marc] || 0;   // "for each experience counter you have" (122.1)
    case 'turno':
      if (o === 'magias') return M.magiasT(e, ctx);
      if (o === 'descartes') { const D = J.descT; return D && D.t === e.turno.n ? D.n : 0; }
      if (o === 'vidaGanha') { const D = J.vgT; return D && D.t === e.turno.n ? D.n : 0; }     // "life you gained this turn" (Gwaihir, Gollum)
      if (o === 'resolucoesDestaHab') return ctx.resHab || 0;
      if (o === 'vidaPerdida' || o === 'compras') {   // de você, do jogador da vez (cadaAtual, no repetirCada) ou dos oponentes (soma/maior)
        const de = jj => { const T = o === 'vidaPerdida' ? e.jogs[jj].perdT : e.jogs[jj].compT; return T && T.t === e.turno.n ? T.n : 0; };
        if (c.quem === 'oponentes') { const v = M.vivos(e).filter(x => x !== ctx.voce).map(de); return c.junta === 'soma' ? v.reduce((a, b) => a + b, 0) : Math.max(0, ...v); }
        return de(c.quem === 'cadaAtual' ? ctx.cadaAtual ?? ctx.voce : ctx.voce);
      }
      if (o === 'vidaGanha') { const D = J.vgT; return D && D.t === e.turno.n ? D.n : 0; }     // "life you gained this turn" (Gwaihir, Gollum)
      // corpo-a-corpo (702.121a): os oponentes que você atacou com criatura neste combate (jogador, não planeswalker), na resolução
      if (o === 'oponentesAtacados') return new Set(((e.turno.combate || {}).atk || []).filter(r => r.alvo && r.alvo.jog !== undefined && r.alvo.jog !== ctx.voce && e.objs[r.id] && e.objs[r.id].ctrl === ctx.voce).map(r => r.alvo.jog)).size;   // "the second time this ability has resolved this turn" (contando esta)
      return M.contaAtaque(e, 'ataquesNoTurno', ctx.voce);
    case 'combate': return M.contaAtaque(e, o, ctx.voce);   // oponentesAtacados: corpo-a-corpo (702.121a)
    case 'oponentes': return M.vivos(e).filter(j => j !== ctx.voce).length;
    case 'jogadores': return M.vivos(e).length;
    case 'X': return ctx.x || 0;
    case 'resultado': return ctx.resultado || 0;
    case 'lembradas': {
      if (c.junta !== 'maiorPorDono') return (ctx.lembrados || []).length;
      // "the greatest number of cards a player discarded this way" (Windfall): das lembradas, por dono
      const n = {}; for (const id of ctx.lembrados || []) { const ob = e.objs[id]; if (ob) n[ob.dono] = (n[ob.dono] || 0) + 1; }
      return Math.max(0, ...Object.values<number>(n));
    }
    case 'evento': {
      const ev = ctx.ev; if (!ev) return 0;
      if (o === 'quantos') return vidaEv(ev) ? ev.q || 0 : ev.n ?? 1;        // no evento de vida: "that much" (Exquisite Blood)
      if (o === 'vida') return vidaEv(ev) ? ev.q || 0 : 0;                    // "that much life" (Sanguine Bond)
      if (o === 'dano') return ev.ev === 'dano' ? ev.q || 0 : 0;              // "that much damage"
      if (o === 'marcadores') return ev.ev === 'marcadorPosto' ? ev.n || 0 : 0;   // "that many" (Shalai and Hallar)
      if (o === 'mao') { const jj = ev.ev === 'dano' ? ev.jog : ev.j ?? ev.ativo; return jj !== undefined && e.jogs[jj] ? e.jogs[jj].zonas.mao.length : 0; }   // "if that player has four or more cards in hand" (Fevered Visions)
      const ob = e.objs[ev.id];
      if (o === 'poder') return !ob ? 0 : ob.zona === 'campo' || !ev.snap ? M.poder(e, ob) : M.poder(e, ev.snap);   // "that creature's power" (Terror of the Peaks); saiu: a de quando estava no campo (608.2h)
      if (o === 'resist') return ob && ob.zona === 'campo' ? M.resistencia(e, ob) : ev.snap ? M.resistencia(e, ev.snap) : 0;   // Verdant Sun's Avatar
      if (o === 'poder') return ob && ob.zona === 'campo' ? M.poder(e, ob) : ev.snap ? M.poder(e, ev.snap) : ob ? M.poder(e, ob) : 0;   // "that creature's power" (Terror of the Peaks)
      if (!ob) return 0;
      return o === 'vm' ? M.dadoDe(e, ob).vm || 0 : coresN(M.dadoDe(e, ob).cores);   // "that spell's mana value / colors" (Ramos, 105.2)
    }
    case 'tipoMaisComum': {   // "the greatest number of creatures you control that have a creature type in common" (Basalt Ravager)
      const cs = e.campo.map(id => e.objs[id]).filter(x => x.ctrl === ctx.voce && M.temTipo(e, x, 'Creature')).map(x => M.tiposCriatura(e, x));
      const todos = cs.filter(t => t === 'todos').length, n: Record<string, number> = {};
      for (const t of cs) if (t !== 'todos') for (const s of new Set<string>(t)) n[s] = (n[s] || 0) + 1;
      return Math.max(0, ...Object.values(n)) + todos;   // metamorfo é de todos os tipos (702.73a)
    }
    case 'sacrificadas': return (ctx.sac || []).reduce((s, l) => s + (o === 'poder' ? Math.max(0, l.poder) : l.vm || 0), 0);   // LKI, 608.2h
    case 'cada':
      if (o === 'vida') return ctx.cadaAtual !== undefined ? e.jogs[ctx.cadaAtual].vida : 0;   // o jogador da vez (Dire Fleet Ravager)
      { const cc = ctx.cadaObj, ob = cc && e.objs[cc.id]; return !ob || ob.ts !== cc.ts ? 0 : ob.marc[c.marc] || 0; }   // o objeto da vez
  }
  throw new Error('conta sem suporte: ' + JSON.stringify(c));
};
/** qtd nova inteira: conta + divCima/metade + mult/soma (sem o piso 0: quem chama decide) */
M.qtdConta = (e, q, ctx) => {
  let v = M.contar(e, q.conta, ctx);
  if (q.divCima) v = Math.ceil(v / q.divCima);
  if (q.metade) v = Math.floor(v / 2);             // "half …, rounded down" (Endless Ranks of the Dead)
  return v * (q.mult || 1) + (q.soma || 0);
};
