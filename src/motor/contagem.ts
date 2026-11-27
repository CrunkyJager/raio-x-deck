// src/motor/contagem.ts — UMA forma de contar (Felipe 27/11: "reestruturar as contagens numa só").
// Antes: um nome por combinação (poderDoAlvo, vmDoEvento, maiorDescarte, somaPoder…), cada carta nova criava outro.
// Agora a quantidade é  {conta: {de, o, junta?, marc?, cores?}, mult?, soma?, divCima?, metade?}:
//   de    = DE QUEM/ONDE se conta: 'este' | {alvo:N} | 'evento' | 'sacrificadas' | 'lembradas' | 'cada' | {f: filtro} | 'atacado'
//           | 'voce' | 'oponentes' | 'jogadores' | 'turno' | 'combate' | 'X' | 'resultado' | 'se' | 'escolhido'
//   o     = O QUE se lê: 'quantos' | 'poder' | 'resist' | 'vm' | 'cores' | 'marcadores' (marc = tipo) | 'vida' | 'mao'
//           | 'grimorio' | 'devocao' (cores) | 'magias' | 'descartes' | 'ataques' | 'atacantes' | 'atacantesEmVoce' | 'dano'
//           | 'tipos' (tipos de card, com junta 'diferentes': delirium) | 'resolucoesDestaHab' (de 'turno': Omnath)
//           | 'poderAcimaDeste' (de {alvo:N}: quanto o poder do alvo passa o deste, 0 se não passa: Conformer Shuriken) …
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
  if (temAlvo(c)) return ['poder', 'resist', 'vm', 'grimorio', 'vida', 'manaGasta', 'poderAcimaDeste'].includes(o) && chaves(c, []);
  switch (c.de) {
    case 'este': return o === 'marcadores' ? chaves(c, ['marc']) && (c.marc === undefined || typeof c.marc === 'string') : ['poder', 'resist', 'kicker'].includes(o) && chaves(c, []);   // kicker: quantas vezes pagou o chute (multikicker, 702.33c)
    case 'voce': return o === 'devocao' ? chaves(c, ['cores']) && /^[WUBRG]+$/.test(c.cores || '')
      : o === 'marcadores' ? chaves(c, ['marc']) && typeof c.marc === 'string' && !!c.marc : ['mao', 'grimorio', 'vida', 'vidaInicial', 'tentacoes', 'cores'].includes(o) && chaves(c, []);   // cores: da identidade dos seus comandantes (903.4; War Room)
    case 'turno': if (o === 'entraram' || o === 'sacrificadas') return chaves(c, ['f']) && (c.f === undefined || M.filtroOk(c.f));   // os que entraram no campo neste turno (filtro f)
      if (o === 'excesso') return chaves(c, ['quem']) && (c.quem === undefined || c.quem === 'oponentes');   // objetos (criatura/planeswalker) que levaram dano excedente (120.10)
      return ['vidaPerdida', 'compras'].includes(o) ? chaves(c, ['quem', 'junta']) && (c.quem === undefined || c.quem === 'cadaAtual' ? j === undefined : c.quem === 'oponentes' && (j === 'soma' || j === 'maior'))
      : ['magias', 'descartes', 'ataques', 'vidaGanha', 'resolucoesDestaHab', 'oponentesAtacados', 'aoCemiterio'].includes(o) && chaves(c, []);   // aoCemiterio: cartas suas que foram da mão/grimório ao cemitério (Welcome the Dead)
    case 'combate': return ['atacantes', 'atacantesEmVoce'].includes(o) && chaves(c, []);
    case 'atacado': return o === 'marcadores' ? chaves(c, ['marc']) && typeof c.marc === 'string' && !!c.marc : o === 'vida' && chaves(c, []);   // o jogador defensor (Nightkin Ambusher: rad; Preacher: vida)
    case 'oponentes': return o === 'quantos' && chaves(c, []);
    case 'jogadores': return o === 'quantos' ? chaves(c, []) : o === 'marcadores' ? chaves(c, ['marc', 'junta']) && typeof c.marc === 'string' && !!c.marc && c.junta === 'soma' : o === 'cemiterio' ? chaves(c, ['min']) && Number.isInteger(c.min)   // "each graveyard with seven or more cards" (Master of Lake-town)
      : o === 'vida' && j === 'maior' && chaves(c, ['junta']);   // a maior vida da mesa (Preacher of the Schism)
    case 'X': case 'resultado': return chaves(c, []) && o === undefined;
    case 'custo': return o === 'marcadores' && chaves(c, []);   // os marcadores tirados no custo ("that much damage", Arcee)
    case 'lembradas': return (o === 'quantos' && (j === undefined || j === 'maiorPorDono') || (o === 'vm' && j === 'soma')) && chaves(c, ['junta']);
    case 'evento': if (o === 'alvos') return chaves(c, ['f']) && !!c.f && M.filtroOk(c.f);   // "that many": quantos alvos da mágica do evento batem no filtro (Arcee)
      return o === 'poder' && j === 'soma' ? chaves(c, ['junta']) : o === 'marcadores' ? chaves(c, ['marc']) && (c.marc === undefined || (typeof c.marc === 'string' && !!c.marc))
      : ['quantos', 'vida', 'dano', 'poder', 'resist', 'vm', 'cores', 'mao', 'jogadores', 'manaGasta'].includes(o) && chaves(c, []);   // poder+soma: o lote do "uma ou mais morrem" (Skullspore Nexus)
    case 'tipoMaisComum': return chaves(c, []) && o === undefined;
    case 'sacrificadas': return ['poder', 'vm'].includes(o) && j === 'soma' && chaves(c, ['junta']);
    case 'viradas': return o === 'poder' && j === 'soma' && chaves(c, ['junta']);   // as viradas para pagar o custo (estação, 702.184a)
    case 'cada': return o === 'marcadores' ? chaves(c, ['marc']) && typeof c.marc === 'string' : ['vida', 'poder', 'resist', 'ataques', 'tipoEmComum'].includes(o) && chaves(c, []);   // ataques: quantas vezes o objeto da vez atacou neste turno (Moraug)   // poder/resist: o objeto da vez (Unnatural Growth)
  }
  return false;
}
// estática: só o que não depende de evento/alvo/efeito anterior (é o CONTA_EST + PROP_EST de antes)
function estOk(c) {
  if (temF(c)) return true;
  if (c.de === 'voce') return ['mao', 'grimorio', 'vida', 'vidaInicial', 'devocao', 'tentacoes', 'marcadores', 'cores'].includes(c.o);   // marcadores: os do jogador (rad, energia…)
  if (c.de === 'turno') return ['magias', 'compras', 'vidaGanha', 'excesso', 'aoCemiterio'].includes(c.o);
  if (c.de === 'este') return c.o === 'marcadores';
  if (c.de === 'cada') return c.o === 'ataques' || c.o === 'tipoEmComum';   // tipoEmComum: Coat of Arms   // na estática, 'cada' = o objeto afetado (camadas põem ctx.cadaObj)
  return c.de === 'oponentes' || c.de === 'jogadores';
}
/** a conta (já nova) é jogável neste lugar? */
M.contaOk = (c, onde: 'efeito' | 'est' | 'cond' = 'efeito') => {
  if (!nova(c) || !base(c)) return false;
  if (onde === 'efeito') return true;
  if (estOk(c)) return true;
  return onde === 'cond' && (c.de === 'atacado' || c.de === 'X' || c.de === 'resultado' || (c.de === 'este' && (c.o === 'poder' || c.o === 'resist' || c.o === 'kicker')) || (c.de === 'lembradas' && c.junta === undefined) || (c.de === 'evento' && (c.o === 'quantos' || c.o === 'mao' || (c.o === 'marcadores' && !!c.marc) || c.o === 'vm' || c.o === 'manaGasta')) || c.de === 'combate' || (c.de === 'turno' && (c.o === 'ataques' || c.o === 'sacrificadas' || c.o === 'resolucoesDestaHab' || c.o === 'entraram' || c.o === 'vidaGanha')));
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
    if (o === 'poderAcimaDeste') {                  // "If that creature has greater power than this creature, … equal to the difference" (Conformer Shuriken); 0 se não for maior
      const ob = e.objs[ctx.este], este = ob && ob.zona === 'campo' ? M.lkiDe(e, ob) : L && L.este;
      return a && este ? Math.max(0, a.poder - este.poder) : 0;
    }
    return a ? a[o] || 0 : 0;   // manaGasta: a mana gasta para conjurar a mágica alvo (LKI na pilha, Mana Sculpt)
  }
  const J = e.jogs[ctx.voce];
  switch (c.de) {
    case 'este': {
      const ob = e.objs[ctx.este];
      const este = !L ? ob : ob && ob.zona === 'campo' ? M.lkiDe(e, ob) : L.este;
      if (o === 'kicker') {                       // vezes que o chute foi pago: na pilha o.pil.opc / ctx.opc; no campo o conjCom guardado ao entrar
        const q = ctx.opc && ctx.opc.chute !== undefined ? ctx.opc.chute : ob && ob.zona === 'pilha' && ob.pil && ob.pil.opc ? ob.pil.opc.chute : ob && ob.conjCom ? ob.conjCom.kicker : 0;
        return q === true ? 1 : typeof q === 'number' ? q : 0;
      }
      if (!este) return 0;
      if (o === 'marcadores') return c.marc ? este.marc[c.marc] || 0 : Object.values<any>(este.marc).reduce((s, n) => s + n, 0);
      if (!L && (o === 'poder' || o === 'resist')) return o === 'poder' ? M.poder(e, ob) : M.resistencia(e, ob);   // fora da resolução (condição do gatilho): o de agora
      return este[o];
    }
    case 'voce':
      if (o === 'mao') return J.zonas.mao.length;
      if (o === 'grimorio') return J.zonas.grimorio.length;
      if (o === 'vida') return J.vida;
      if (o === 'vidaInicial') return J.vidaInicial ?? 40;   // 103.4: a vida com que começou (Angel of Destiny)
      if (o === 'devocao') return M.devocao(e, ctx.voce, c.cores);
      if (o === 'tentacoes') return (J.anel && J.anel.n) || 0;
      if (o === 'cores') return coresN(J.ci);   // "the number of colors in your commanders' color identity" (903.4)   // "the Ring has tempted you N or more times this game" (701.54d)
      return c.marc === 'poison' ? J.veneno || 0 : (J.marc || {})[c.marc] || 0;   // "for each experience counter you have" (122.1)
    case 'turno':
      if (o === 'magias') return M.magiasT(e, ctx);
      if (o === 'entraram') { const R = e.turno.entraram; if (!R || R.t !== e.turno.n) return 0; const { zona, ...f } = c.f || {}; return R.l.filter(x => M.bate(e, x, f, ctx)).length; }   // como era ao entrar (Éowyn, Shieldmaiden)
      if (o === 'descartes') { const D = J.descT; return D && D.t === e.turno.n ? D.n : 0; }
      if (o === 'aoCemiterio') { const D = J.cemT; return D && D.t === e.turno.n ? D.n : 0; }   // da mão ou do grimório (estado.ts M.mover)
      if (o === 'vidaGanha') { const D = J.vgT; return D && D.t === e.turno.n ? D.n : 0; }     // "life you gained this turn" (Gwaihir, Gollum)
      if (o === 'resolucoesDestaHab') return ctx.resHab || 0;
      if (o === 'excesso') {   // "if a creature or planeswalker an opponent controlled was dealt excess damage this turn" (Rith)
        const de = jj => { const T = e.jogs[jj].excT; return T && T.t === e.turno.n ? T.n : 0; };
        return c.quem === 'oponentes' ? e.jogs.map((_, jj) => jj).filter(jj => jj !== ctx.voce).reduce((t, jj) => t + de(jj), 0) : de(ctx.voce);
      }
      if (o === 'vidaPerdida' || o === 'compras') {   // de você, do jogador da vez (cadaAtual, no repetirCada) ou dos oponentes (soma/maior)
        const de = jj => { const T = o === 'vidaPerdida' ? e.jogs[jj].perdT : e.jogs[jj].compT; return T && T.t === e.turno.n ? T.n : 0; };
        if (c.quem === 'oponentes') { const v = M.vivos(e).filter(x => x !== ctx.voce).map(de); return c.junta === 'soma' ? v.reduce((a, b) => a + b, 0) : Math.max(0, ...v); }
        return de(c.quem === 'cadaAtual' ? ctx.cadaAtual ?? ctx.voce : ctx.voce);
      }
      if (o === 'sacrificadas') { const S = J.sacT; return S && S.t === e.turno.n ? S.l.filter(x => !c.f || M.bate(e, x, { ...c.f, zona: 'campo' }, ctx)).length : 0; }   // as que você sacrificou neste turno (LKI; Elanor Gardner)
      if (o === 'vidaGanha') { const D = J.vgT; return D && D.t === e.turno.n ? D.n : 0; }     // "life you gained this turn" (Gwaihir, Gollum)
      // corpo-a-corpo (702.121a): os oponentes que você atacou com criatura neste combate (jogador, não planeswalker), na resolução
      if (o === 'oponentesAtacados') return new Set(((e.turno.combate || {}).atk || []).filter(r => r.alvo && r.alvo.jog !== undefined && r.alvo.jog !== ctx.voce && e.objs[r.id] && e.objs[r.id].ctrl === ctx.voce).map(r => r.alvo.jog)).size;   // "the second time this ability has resolved this turn" (contando esta)
      return M.contaAtaque(e, 'ataquesNoTurno', ctx.voce);
    case 'combate': return M.contaAtaque(e, o, ctx.voce);   // oponentesAtacados: corpo-a-corpo (702.121a)
    case 'atacado': {                                                       // o jogador defensor: do evento (ataca) ou de quem bloqueia (combate.ts)
      const dj = ctx.ev ? ctx.ev.def ?? (ctx.ev.ev === 'dano' ? ctx.ev.jog : undefined) : undefined;   // no dano a jogador: quem levou (Vexing Radgull: "that player")
      const D = dj !== undefined ? e.jogs[dj] : null; if (!D) return 0;
      if (o === 'vida') return D.vida;
      return c.marc === 'poison' ? D.veneno || 0 : (D.marc || {})[c.marc] || 0;
    }
    case 'oponentes': return M.vivos(e).filter(j => j !== ctx.voce).length;
    case 'jogadores': if (o === 'marcadores') return M.vivos(e).reduce((t, jj) => { const J = e.jogs[jj]; return t + (c.marc === 'poison' ? J.veneno || 0 : (J.marc || {})[c.marc] || 0); }, 0);   // "the total number of rad counters among players" (Vault 12)
      return o === 'vida' ? Math.max(...M.vivos(e).map(j => e.jogs[j].vida)) : o === 'cemiterio' ? M.vivos(e).filter(j => e.jogs[j].zonas.cemiterio.length >= c.min).length : M.vivos(e).length;
    case 'X': return ctx.x || 0;
    case 'custo': return ctx.tirados || 0;
    case 'resultado': return ctx.resultado || 0;
    case 'lembradas': {
      // "lose life equal to that card's mana value" (Caustic Bronco): as do efeito anterior (descartadas, ou as que ele moveu)
      if (o === 'vm') return (ctx.lembrados || (ctx.movidos || []).map(m => m.id)).reduce((t, id) => t + ((e.objs[id] && M.dadoDe(e, e.objs[id]).vm) || 0), 0);
      if (c.junta !== 'maiorPorDono') return (ctx.lembrados || []).length;
      // "the greatest number of cards a player discarded this way" (Windfall): das lembradas, por dono
      const n = {}; for (const id of ctx.lembrados || []) { const ob = e.objs[id]; if (ob) n[ob.dono] = (n[ob.dono] || 0) + 1; }
      return Math.max(0, ...Object.values<number>(n));
    }
    case 'evento': {
      const ev = ctx.ev; if (!ev) return 0;
      if (o === 'quantos') return vidaEv(ev) ? ev.q || 0 : ev.n ?? 1;        // no evento de vida: "that much" (Exquisite Blood)
      if (o === 'vida') return vidaEv(ev) ? ev.q || 0 : 0;                    // "that much life" (Sanguine Bond)
      if (o === 'jogadores') return ev.jogs ? ev.jogs.length : ev.jog !== undefined ? 1 : 0;   // danoUmaVez: os jogadores feridos na etapa (Hordewing Skaab)
      if (o === 'dano') return ev.ev === 'dano' || ev.ev === 'danoPrevenido' ? ev.q || 0 : 0;   // danoPrevenido: "that many" (Selfless Squire)
      if (o === 'alvos') { const S = e.objs[ev.id], l = S && S.pil ? (S.pil.alvos || []).flat().filter(a => a && a.o !== undefined) : [];
        return new Set(l.filter(a => { const x = e.objs[a.o]; return x && x.ts === a.ts && M.bate(e, x, c.f, ctx); }).map(a => a.o)).size; }              // "that much damage"
      const jj = ev.ev === 'dano' ? ev.jog : ev.j ?? ev.ativo, JJ = jj !== undefined ? e.jogs[jj] : undefined;   // o jogador do evento
      if (o === 'marcadores' && c.marc) return !JJ ? 0 : c.marc === 'poison' ? JJ.veneno || 0 : (JJ.marc || {})[c.marc] || 0;   // "if they don't have any rad counters" (Vexing Radgull, 122.1)
      if (o === 'marcadores') return ev.ev === 'marcadorPosto' ? ev.n || 0 : 0;
      if (o === 'manaGasta') return ev.ev === 'conjura' ? (e.objs[ev.id] || {}).manaGasta || 0 : 0;   // "the amount of mana spent to cast that spell" (Liberator): o pagarMana grava na mágica (paga depois do evento, 601.2h)   // "that many" (Shalai and Hallar)
      if (o === 'poder' && c.junta === 'soma') return (ev.loteP || []).reduce((s, n) => s + Math.max(0, n), 0);   // "the total power of those creatures" (LKI, 603.10a)
      if (o === 'mao') return JJ ? JJ.zonas.mao.length : 0;   // "if that player has four or more cards in hand" (Fevered Visions)
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
    case 'viradas': return (ctx.vir || []).reduce((s, l) => { const x = e.objs[l.id]; return s + Math.max(0, x && x.zona === 'campo' && x.ts === l.ts ? M.poder(e, x) : l.poder); }, 0);   // ainda no campo: o poder de agora; senão LKI (608.2h)
    case 'sacrificadas': return (ctx.sac || []).reduce((s, l) => s + (o === 'poder' ? Math.max(0, l.poder) : l.vm || 0), 0);   // LKI, 608.2h
    case 'cada':
      if (o === 'vida') return ctx.cadaAtual !== undefined ? e.jogs[ctx.cadaAtual].vida : 0;   // o jogador da vez (Dire Fleet Ravager)
      { const cc = ctx.cadaObj, ob = cc && e.objs[cc.id]; if (!ob || ob.ts !== cc.ts) return 0;
        if (o === 'tipoEmComum') return M.comTipoEmComum(e, ob);   // as outras criaturas que dividem tipo com ela (Coat of Arms)
        if (o === 'ataques') return (e.turno.ataques || []).filter(r => r.id === ob.id && r.ts === ob.ts && !r.entrou).length;   // "each time it has attacked this turn" (508.1; entrar atacando não é atacar, 508.4)
        return o === 'poder' ? M.poder(e, ob) : o === 'resist' ? M.resistencia(e, ob) : ob.marc[c.marc] || 0; }   // o objeto da vez; poder pode ser negativo (dobrar, 701.10e)
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
