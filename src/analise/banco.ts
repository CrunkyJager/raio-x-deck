// src/analise/banco.ts — T44: o que cada carta FAZ, lido do banco próprio (banco/cartas/*.json), não do texto em inglês.
// Monta um perfil por carta: as funções do Raio-X (ramp, compra, remoção, limpa-mesa, proteção, contramágica, recursão,
// tutor, fichas…) e os detalhes que pesam no efetiv (repete? na hora? quantas cartas? só um lado da mesa? o oponente
// pode pagar?). A análise usa o perfil quando a carta está no banco; a regex e as etiquetas do Scryfall ficam de reserva
// para carta sem dado e para as frases que o banco ainda marca em `falta`.
import { bancoProprio } from '../dados/cartas';
import type { Carta as CartaB, RxFx, RxFiltro, RxAlvo, RxKw } from '../tipos/carta';

type F = RxFiltro;
/** Onde o efeito está: mágica ao resolver, gatilho, ativada, estática. */
interface Ctx { onde: 'mag' | 'gat' | 'atv' | 'est'; rep: boolean; alvos: RxAlvo[]; fase: boolean; atvMana: number; atvPede: boolean; modal: boolean }

export interface Perfil {
  /** funções (as chaves de ROLES) */
  f: Set<string>;
  /** funções que a carta faz mais de uma vez (gatilho que não é o dela entrar, ativada que não se sacrifica, estática) */
  rep: Set<string>;
  /** instantânea ou com lampejo */
  inst: boolean;
  /** o banco ainda não sabe todas as frases dela (cai na reserva) */
  falta: boolean;
  /** ramp: pedra, dork, terreno, tesouro, ritual, condicional, reduz (redutor de custo), altar */
  ramp: string | null;
  draw: { n: number; loot: boolean; todos: boolean; rec: boolean; fase: boolean; atv: boolean; atvMana: number; atvPede: boolean; topo: boolean };
  removal: { alcance: '' | 'permanente' | 'criaturaMais' | 'criatura' | 'artenc' | 'outro'; cor: string; restrito: boolean; soMao: boolean; edito: boolean; todosSacrificam: boolean; compensa: boolean; dano: number };
  wipe: { lado: boolean; dano: number; sobrecarga: boolean; naoSub: string[] };
  counter: { pagavel: boolean; restrito: boolean };
  protect: { todas: boolean; fica: boolean };
}

const NUM = (q: unknown, x = 3): number => typeof q === 'number' ? q : q === 'X' ? x : q == null ? 1 : 2;
const filtroDe = (em: unknown, alvos: RxAlvo[]): F | string | null => {
  if (em && typeof em === 'object') {
    if ('alvo' in (em as any)) { const a = alvos[(em as any).alvo]; return a ? a.f : null; }
    if ('todos' in (em as any)) return (em as any).todos;
  }
  return typeof em === 'string' ? em : null;
};
const tipos = (f: F | string | null) => (f && typeof f === 'object' ? f.tipo || [] : []);
const deMim = (f: F | string | null) => f === 'este' || f === 'equipada' || (!!f && typeof f === 'object' && (f.ctrl === 'voce' || f.este || f.equipada || f.dono === 'voce'));
const noCemiterio = (f: F | string | null) => !!f && typeof f === 'object' && f.zona === 'cemiterio';
const PROT = new Set(['antimagia', 'indestrutivel', 'manto', 'protecao', 'resguardo']);
const COMBATE = new Set(['atropelar', 'voar', 'ameaca', 'golpeDuplo', 'pressa', 'intimidar', 'caminhadaTerreno']);
const temKw = (kw: RxKw[] | undefined, s: Set<string>) => (kw || []).some(k => s.has(k.k));
const LAND = (f: F | undefined) => !!f && ((f.tipo || []).includes('Land') || (f.sub || []).some(s => /^(Forest|Plains|Island|Swamp|Mountain)$/.test(s)));

function novo(c: CartaB): Perfil {
  return {
    f: new Set(), rep: new Set(), falta: !!(c.falta && c.falta.length),
    inst: c.tipos.includes('Instant') || (c.kw || []).some(k => k.k === 'lampejo'), ramp: null,
    draw: { n: 0, loot: false, todos: false, rec: false, fase: false, atv: false, atvMana: 0, atvPede: false, topo: false },
    removal: { alcance: '', cor: '', restrito: false, soMao: false, edito: false, todosSacrificam: false, compensa: false, dano: 0 },
    wipe: { lado: false, dano: 0, sobrecarga: (c.kw || []).some(k => k.k === 'sobrecarga'), naoSub: [] },
    counter: { pagavel: false, restrito: false }, protect: { todas: false, fica: false },
  };
}
const manaN = (m: any) => m ? (m.g || 0) + (m.p || []).length : 0;
const RAMP_ORDEM = ['pedra', 'dork', 'terreno', 'reduz', 'tesouro', 'ritual', 'condicional'];
function poeRamp(P: Perfil, t: string) { if ((P as any).terreno) return; P.f.add('ramp'); if (P.ramp == null || RAMP_ORDEM.indexOf(t) < RAMP_ORDEM.indexOf(P.ramp)) P.ramp = t; }
function poe(P: Perfil, k: string, x: Ctx) { P.f.add(k); if (x.rep) P.rep.add(k); }

function alcance(f: F | string | null): Perfil['removal']['alcance'] {
  if (f === 'qualquerAlvo') return 'criaturaMais';
  if (!f || typeof f !== 'object') return 'outro';
  const t = f.tipo || [];
  if (t.includes('Permanent') || t.length >= 3) return 'permanente';
  if (t.includes('Creature') && t.length > 1) return 'criaturaMais';
  if (t.includes('Creature')) return 'criatura';
  if (t.every(x => x === 'Artifact' || x === 'Enchantment') && t.length) return 'artenc';
  return 'outro';
}
const restrito = (f: F | string | null) => !!f && typeof f === 'object' && !!(f.vm || f.poder || f.resist || f.virada === true || f.atacando || f.sub || f.kw || f.ficha || f.comMarcador || (f.nao || []).some(x => x !== 'Land' && x !== 'Token'));
const MELHOR: Perfil['removal']['alcance'][] = ['permanente', 'criaturaMais', 'criatura', 'artenc', 'outro', ''];

function remove(P: Perfil, f: F | string | null, x: Ctx, como: 'sai' | 'mao' | 'dano' | 'edito', qtd?: unknown) {
  if (noCemiterio(f)) { poe(P, 'gyhate', x); return; }
  if (deMim(f)) return;
  if (f && typeof f === 'object' && !(f.tipo || []).length && !f.sub && f.zona !== 'campo') return;
  const R = P.removal, a = alcance(f);
  if (MELHOR.indexOf(a) < MELHOR.indexOf(R.alcance)) R.alcance = a;
  if (f && typeof f === 'object' && f.cor) R.cor = String(f.cor);
  if (restrito(f)) R.restrito = true;
  if (como === 'mao') R.soMao = R.soMao || !P.f.has('removal'); else R.soMao = false;
  if (como === 'dano' && typeof qtd === 'number') R.dano = Math.max(R.dano, qtd);
  else if (como === 'dano') R.dano = 99;
  poe(P, 'removal', x);
}
function limpa(P: Perfil, f: F, x: Ctx, qtd?: unknown) {
  if (noCemiterio(f) || f.zona === 'grimorio' || f.zona === 'mao') { if (noCemiterio(f)) poe(P, 'gyhate', x); return; }
  if (deMim(f)) return;
  const t = f.tipo || [];
  if (t.length && !t.some(y => y === 'Creature' || y === 'Permanent' || y === 'Artifact' || y === 'Enchantment' || y === 'Planeswalker')) return;
  if (f.ctrl === 'oponente') P.wipe.lado = true;
  for (const s of f.nao || []) if (!['Land', 'Token', 'Creature', 'Artifact', 'Enchantment', 'Legendary', 'Basic'].includes(s)) P.wipe.naoSub.push(s);
  if (typeof qtd === 'number') P.wipe.dano = P.wipe.dano ? Math.min(P.wipe.dano, qtd) : qtd;
  poe(P, 'wipe', x);
}

function fxs(P: Perfil, lista: RxFx[] | undefined, x: Ctx, c: CartaB) {
  if (!lista) return;
  const ops = lista.map(e => e.op);
  // compra e descarta o mesmo tanto (ou mais): só filtra a mão
  const nC = lista.filter(e => e.op === 'comprar' && (e.quem == null || e.quem === 'voce')).reduce((s, e) => s + NUM(e.qtd), 0);
  const nD = lista.filter(e => e.op === 'descartar' && (e.quem == null || e.quem === 'voce')).reduce((s, e) => s + NUM(e.qtd, 1), 0);
  if (nC && nD) { poe(P, 'cardflow', x); if (nD >= nC) P.draw.loot = true; }
  // exilar e devolver ao campo na mesma resolução: blink
  if (ops.includes('exilar') && lista.some(e => e.op === 'mover' && e.para === 'campo' && (e.de === 'exilio' || e.em === 'anterior' || !e.de))) {
    const ex = lista.find(e => e.op === 'exilar')!, fl = filtroDe(ex.em, x.alvos);
    if (deMim(fl) || fl === 'este' || (fl && typeof fl === 'object' && fl.ctrl !== 'oponente')) poe(P, 'blink', x);
  }
  for (const e of lista) {
    const fl = filtroDe(e.em, x.alvos);
    const quemEu = e.quem == null || e.quem === 'voce' || e.quem === 'controlador' && x.onde !== 'mag';
    switch (e.op) {
      case 'mana': {
        if (c.tipos.includes('Land')) break;
        if (x.onde === 'mag') { poeRamp(P, 'ritual'); break; }
        if (x.onde === 'atv' && x.atvPede) { P.f.add('sac'); break; }   // altar: peça de combo, não acelera
        if (x.onde === 'gat' && !x.fase) { poeRamp(P, 'condicional'); break; }
        poeRamp(P, c.tipos.includes('Creature') ? 'dork' : 'pedra'); break;
      }
      case 'ficha': {
        const nome = e.token && (e.token as any).nome;
        if (e.quem === 'controlador' && x.onde === 'mag') { P.removal.compensa = true; break; }
        if (nome === 'Treasure' && quemEu) poeRamp(P, x.onde === 'gat' && !x.fase ? 'condicional' : 'tesouro');
        else if (nome === 'Powerstone' && quemEu) poeRamp(P, 'condicional');
        // fichas nomeadas: a habilidade está no nome (Clue {2}: compra; Food {2}: 3 de vida; Blood {1}: descarta e compra)
        if (quemEu && nome === 'Clue') { poe(P, 'draw', x); P.draw.n = Math.max(P.draw.n, 1); P.draw.atv = true; P.draw.atvMana = Math.max(P.draw.atvMana || 0, 2); }
        if (quemEu && nome === 'Food') poe(P, 'lifegain', x);
        if (quemEu && nome === 'Blood') poe(P, 'cardflow', x);
        if (quemEu) poe(P, 'tokens', x);
        if (e.token && (e.token as any).copiaDe) poe(P, 'copy', x);
        break;
      }
      case 'buscar': {
        if (e.quem === 'controlador' || e.quem === 'dono' || e.quem === 'cadaJogador') break;   // Path to Exile: o terreno é do outro
        const para = e.para || (e.destinos && e.destinos.some(d => d.para === 'campo') ? 'campo' : e.destinos?.[0]?.para);
        if (LAND(e.f)) { if (para === 'campo') poeRamp(P, x.onde === 'gat' && !x.fase && !(x as any).etb ? 'condicional' : 'terreno'); }
        else poe(P, 'tutor', x);
        break;
      }
      case 'comprar': {
        if (e.quem === 'cadaJogador' || (e.quem === 'doEvento' && (x as any).todosJog)) P.draw.todos = true;   // Howling Mine: o jogador da vez
        else if (!quemEu) break;
        const n = NUM(e.qtd); P.draw.n = Math.max(P.draw.n, n);
        if (x.fase) P.draw.fase = true; if (x.onde === 'atv') { P.draw.atv = true; P.draw.atvMana = x.atvMana; P.draw.atvPede = P.draw.atvPede || x.atvPede; }
        poe(P, 'draw', x);
        if (e.quem === 'cadaJogador' && lista.some(y => y.op === 'descartar' && (y.qtd === 'tudo' || (y as any).todos))) P.f.add('cardflow');
        break;
      }
      case 'cavar': case 'revelarTopo': {
        if (!quemEu && e.quem !== 'voce') { if (e.quem === 'dono' && e.para === 'campo') P.removal.compensa = true; break; }
        const vai = e.para || (e.destinos || []).map(d => d.para).find(Boolean);
        if (vai === 'mao' || (vai === 'exilio' && ops.includes('jogar')) || ops.includes('jogar')) {
          P.draw.n = Math.max(P.draw.n, NUM(e.pega, 1)); P.draw.topo = true; if (x.fase) P.draw.fase = true; if (x.onde === 'atv') P.draw.atv = true; poe(P, 'draw', x);
        } else if (vai === 'campo') { if (LAND(e.f)) poeRamp(P, 'terreno'); else poe(P, 'speed', x); }
        break;
      }
      case 'mover': {
        if (!e.em && e.f) {   // escolhe da zona pelo filtro (Brainstorm devolve da mão; Whitemane Lion devolve a sua; Growth Spiral põe terreno da mão)
          const ff = e.f as F, de = ff.zona;
          if (de === 'mao' || de === 'grimorio') { if (e.para === 'campo') { if (LAND(ff)) poeRamp(P, x.onde === 'gat' && !x.fase && !(x as any).etb ? 'condicional' : 'terreno'); else poe(P, 'speed', x); } break; }
          if (deMim(ff) || ff.ctrl == null && ff.dono == null && de !== 'campo') { if (de === 'cemiterio' && e.para === 'mao') { poe(P, 'recursion', x); poe(P, 'draw', x); P.draw.rec = true; P.draw.n = Math.max(P.draw.n, NUM(e.qtd, 1)); } else if (de === 'cemiterio' && e.para === 'campo') poe(P, 'recursion', x); break; }
        }
        const de = e.de || (fl && typeof fl === 'object' ? fl.zona : undefined), para = e.para;
        if (de === 'cemiterio') {
          const meu = !fl || typeof fl !== 'object' || fl.dono === 'voce' || fl.ctrl === 'voce' || (fl.dono == null && fl.ctrl == null && para !== 'grimorio');
          if (para === 'exilio' || (para === 'grimorio' && !meu)) { poe(P, 'gyhate', x); break; }
          if (para === 'mao' && meu) { poe(P, 'recursion', x); poe(P, 'draw', x); P.draw.rec = true; P.draw.n = Math.max(P.draw.n, NUM(e.qtd, 1)); }
          else if (para === 'campo') poe(P, 'recursion', x);
          break;
        }
        if (de === 'grimorio' || de === 'mao' || de === 'exilio') { if (para === 'campo' && de !== 'exilio') { if (fl && typeof fl === 'object' && LAND(fl)) poeRamp(P, 'terreno'); else poe(P, 'speed', x); } break; }
        if (fl === 'este' || fl === 'anterior' || fl === 'criadas' || fl === 'doEvento' && x.onde === 'gat') break;
        if (para === 'mao') { e.em && typeof e.em === 'object' && 'todos' in e.em ? limpa(P, fl as F, x) : remove(P, fl, x, 'mao'); }
        else if (para === 'grimorio' || para === 'exilio') { e.em && typeof e.em === 'object' && 'todos' in e.em ? limpa(P, fl as F, x) : remove(P, fl, x, 'sai'); }
        break;
      }
      case 'destruir': case 'exilar': {
        if (fl === 'este' || fl === 'anterior' || fl === 'criadas' || fl === 'escolhida' && x.onde !== 'mag') break;
        if (e.em && typeof e.em === 'object' && 'todos' in e.em) limpa(P, fl as F, x); else remove(P, fl, x, 'sai');
        break;
      }
      case 'dano': {
        if (e.quem === 'cadaOponente' || e.quem === 'atacado' || e.quem === 'alvoJogador' || (e.quem && typeof e.quem === 'object')) { poe(P, 'drain', x); break; }
        if (e.quem) break;
        if (fl === 'qualquerAlvo') poe(P, 'drain', x);
        const al = e.em && typeof e.em === 'object' && 'alvo' in e.em ? x.alvos[(e.em as any).alvo] : null;
        if (al && al.jog) poe(P, 'drain', x);
        if (fl && typeof fl === 'object' && fl.tipo && fl.tipo.length === 1 && fl.tipo[0] === 'Planeswalker') break;   // Boros Charm: jogador ou planeswalker
        if (e.em && typeof e.em === 'object' && 'todos' in e.em) limpa(P, fl as F, x, typeof e.qtd === 'number' ? e.qtd : undefined); else if (fl && fl !== 'jogador' && fl !== 'oponente') remove(P, fl, x, 'dano', e.qtd);
        break;
      }
      case 'perderVida': {
        if (e.quem !== 'voce' && e.quem !== 'controlador') poe(P, 'drain', x); break;
      }
      case 'ganharVida': { if (quemEu) poe(P, 'lifegain', x); break; }
      case 'sacrificar': {
        const q = e.quem;
        if (q === 'voce' || q == null) break;
        const todos = !!(e.exceto || (e.em && typeof e.em === 'object' && 'todos' in e.em) || e.qtd === 'tudo');
        if (todos) limpa(P, (fl && typeof fl === 'object' ? fl : (e.f || {})) as F, x);
        else { const ff = (e.f || (fl && typeof fl === 'object' ? fl : null)) as F | null; remove(P, ff || { tipo: ['Creature'], zona: 'campo' }, x, 'edito'); P.removal.edito = true; if (q === 'cadaJogador') P.removal.todosSacrificam = true; poe(P, 'sac', x); }
        break;
      }
      case 'modificar': {
        const neg = (q: unknown) => typeof q === 'number' ? q < 0 : !!q && typeof q === 'object' && (q as any).mult < 0;
        if (neg(e.r)) { if (e.em && typeof e.em === 'object' && 'todos' in e.em) limpa(P, fl as F, x); else remove(P, fl, x, 'sai'); break; }
        if (deMim(fl) || fl === 'este' || (fl && typeof fl === 'object' && !fl.ctrl && x.alvos.length)) {
          const todas = e.em && typeof e.em === 'object' && 'todos' in e.em;
          if (temKw(e.kw, PROT)) { poe(P, 'protect', x); if (todas) P.protect.todas = true; if (e.dura && e.dura !== 'fimDoTurno') P.protect.fica = true; }
          if (todas && ((typeof e.p === 'number' && e.p > 0) || temKw(e.kw, COMBATE))) poe(P, 'combat', x);
          else if (temKw(e.kw, COMBATE) && !temKw(e.kw, PROT)) poe(P, 'combat', x);
        }
        break;
      }
      case 'efeitoTemporario': {
        for (const s of e.est || []) est(P, s as any, x, c, true);
        for (const g of e.gat || []) gat(P, g as any, { ...x, rep: true }, c);
        break;
      }
      case 'fasear': case 'regenerar': { if (deMim(fl) || fl === 'este' || fl === 'equipada' || x.alvos.length && fl && typeof fl === 'object' && !fl.ctrl) { poe(P, 'protect', x); if (e.em && typeof e.em === 'object' && 'todos' in e.em) P.protect.todas = true; } break; }
      case 'anular': {
        const f0 = fl; poe(P, 'counter', x);
        if (e.aMenosQue) P.counter.pagavel = true;
        if (f0 && f0 !== 'magica' && typeof f0 === 'object' && ((f0.tipo || []).length || f0.nao || f0.vm)) P.counter.restrito = true;
        break;
      }
      case 'ganharControle': poe(P, 'steal', x); break;
      case 'copiarPermanente': case 'copiarMagica': poe(P, 'copy', x); break;
      case 'faseExtra': case 'turnoExtra': poe(P, 'extra', x); break;
      case 'virarMonarca': case 'incitar': poe(P, 'politics', x); break;
      case 'marcador': if (!e.tirar && e.tipoMarc === '+1/+1') poe(P, 'counters', x); break;
      case 'proliferar': poe(P, 'counters', x); break;
      case 'animar': poe(P, 'animate', x); break;
      case 'lutar': remove(P, filtroDe(e.com, x.alvos) || fl, x, 'dano'); break;
      case 'ganharJogo': P.f.add('wincon'); break;
      case 'perderJogo': if (e.quem !== 'voce') P.f.add('wincon'); break;
      case 'desvirar': if (e.em && typeof e.em === 'object' && 'todos' in e.em && deMim(fl)) poe(P, 'amplify', x); break;
      case 'jogar': {
        if (e.gratis) poe(P, 'speed', x);
        if (fl && typeof fl === 'object' && fl.zona === 'cemiterio') poe(P, 'recursion', x);
        break;
      }
      case 'descartar': if (e.quem && e.quem !== 'voce' && e.quem !== 'cadaJogador') P.f.add('stax'); break;
    }
    if (e.op === 'modal') for (const m of e.modos || []) fxs(P, m, { ...x, modal: true }, c);
    else if (e.fx) fxs(P, e.fx, x, c);
    if (e.op === 'gatilhoAtrasado' && e.quando) gat(P, e.quando as any, x, c);
  }
}
function est(P: Perfil, s: any, x: Ctx, c: CartaB, temporario = false) {
  const af = s.afeta, xx: Ctx = { ...x, onde: 'est', rep: !temporario };
  switch (s.modo) {
    case 'continuo': {
      const meu = af === 'equipada' || af === 'este' || deMim(af);
      if (meu && temKw(s.kw, PROT)) { poe(P, 'protect', xx); if (af !== 'este' && af !== 'equipada') P.protect.todas = true; if (!temporario) P.protect.fica = true; }
      if (meu && af !== 'este' && ((typeof s.p === 'number' && s.p > 0 && af !== 'equipada' || (s.p && typeof s.p === 'object')) || temKw(s.kw, COMBATE))) poe(P, 'combat', xx);
      if (af && typeof af === 'object' && af.ctrl === 'oponente' && typeof s.r === 'number' && s.r < 0) limpa(P, af, xx);
      // dá habilidade de mana às suas (Cryptolith Rite, Insidious Roots): ramp
      if (meu && af !== 'este' && s.habil && (s.habil.atv || []).some((a: any) => (a.fx || []).some((f: any) => f.op === 'mana'))) poeRamp(P, 'dork');
      break;
    }
    case 'reduzCusto': if (!s.deHabil && (s.quem == null || s.quem === 'voce')) poeRamp(P, 'reduz'); break;
    case 'terraExtra': P.f.add('ramp'); if (P.ramp == null) P.ramp = 'condicional'; break;
    case 'aumentaCusto': case 'naoPodeConjurar': case 'naoPodeAtacar': case 'maoMax': if (s.quem !== 'voce') P.f.add('stax'); break;
    case 'dobraGatilhoEntrar': P.f.add('amplify'); break;
    case 'protecaoJogador': case 'vidaNaoMuda': poe(P, 'protect', xx); break;
    case 'conjurarComLampejo': case 'custoAlternativo': P.f.add('speed'); break;
    case 'naoPodeSerBloqueada': if (af !== 'este') P.f.add('combat'); break;
    case 'podeJogar': {
      if (s.de === 'grimorio' || (s.f && s.f.topo)) { P.f.add('draw'); P.rep.add('draw'); P.draw.topo = true; P.draw.n = Math.max(P.draw.n, 1); }
      if (s.de === 'cemiterio') { P.f.add('recursion'); P.rep.add('recursion'); }
      break;
    }
  }
}
function gat(P: Perfil, g: any, x: Ctx, c: CartaB) {
  const proprio = g.quem && g.quem.este && !g.quem.ouEste;
  const unico = (proprio && ['entra', 'morre', 'sai', 'conjura', 'vaiCemiterio'].includes(g.ev)) || g.ev === 'capitulo';
  const xx: Ctx = { ...x, onde: 'gat', rep: !unico, alvos: g.alvos || x.alvos, fase: g.ev === 'fase' && (g.deQuem == null || g.deQuem === 'voce' || g.deQuem === 'cadaJogador') };
  (xx as any).etb = proprio && g.ev === 'entra';
  (xx as any).todosJog = g.ev === 'fase' && g.deQuem === 'cadaJogador';
  fxs(P, g.fx, xx, c);
}

function perfilDe(c: CartaB): Perfil {
  const P = novo(c); (P as any).terreno = c.tipos.includes('Land');   // terreno que busca terreno (Evolving Wilds) não é ramp
  const base: Ctx = { onde: 'mag', rep: false, alvos: c.alvos || [], fase: false, atvMana: 0, atvPede: false, modal: false };
  const um = (cc: CartaB) => {
    fxs(P, cc.fx, { ...base, alvos: cc.alvos || [] }, c);
    for (const g of cc.gat || []) gat(P, g, base, c);
    for (const a of cc.atv || []) {
      const ct: any = a.custo || {}, soEste = ct.sacrificar === 'este' || ct.exilarEste || ct.descartarEste;
      const pede = !!(ct.sacrificar && ct.sacrificar !== 'este') || !!ct.descartar || !!ct.exilarDe || !!ct.devolver;
      fxs(P, a.fx, { ...base, onde: 'atv', rep: !soEste, alvos: a.alvos || [], atvMana: manaN(ct.mana), atvPede: pede }, c);
      if (pede && ct.sacrificar && a.deMana !== true) P.f.add('sac');
    }
    for (const s of cc.est || []) est(P, s, base, c);
    for (const s of cc.subst || []) {
      const m: any = s.muda || {};
      if ((s.ev === 'ficha' || s.ev === 'marcador' || s.ev === 'dano') && (m.mult >= 2 || m.maisQtd)) P.f.add('amplify');
      if (s.ev === 'ficha') P.f.add('tokens');
      if (s.ev === 'marcador' && m.marcadores && '+1/+1' in m.marcadores) P.f.add('counters');
      if (s.ev === 'entra' && m.marcadores && '+1/+1' in m.marcadores && !(s.quem && (s.quem as any).este)) P.f.add('counters');
      if (s.ev === 'ganhaVida') P.f.add('lifegain');
      if ((s.ev === 'morre' || s.ev === 'vaiCemiterio' as any) && m.para === 'exilio') P.f.add('gyhate');
      if (s.ev === 'dano' && (m.prevenir || m.impedir) && s.quem && deMim(s.quem as any)) { P.f.add('protect'); P.rep.add('protect'); P.protect.fica = true; }
    }
    for (const k of cc.kw || []) {
      if (k.k === 'ciclar' || k.k === 'cicloTipo') P.f.add('cardflow');
      if (k.k === 'flashback' || k.k === 'eternizar' || k.k === 'persistir') P.f.add('recursion');
    }
  };
  um(c);
  for (const fc of c.faces || []) um(fc as any);
  // sobrecarga: o mesmo efeito em todas (Cyclonic Rift); o banco escreve a versão de um alvo e marca a palavra-chave
  if (P.wipe.sobrecarga && P.f.has('removal')) { P.f.add('wipe'); const a = (c.alvos || [])[0]; if (a && typeof a.f === 'object' && a.f.ctrl === 'oponente') P.wipe.lado = true; }
  if (P.f.has('wipe')) P.f.delete('removal');   // como no rolesOf de antes: limpa-mesa não conta também como pontual
  return P;
}

const CACHE = new Map<string, Perfil | null>();
/** Perfil da carta pelo nome (o da análise: "Frente // Trás" ou só a frente); null se o banco não tem a carta. */
export function perfilBanco(nome: string): Perfil | null {
  if (CACHE.has(nome)) return CACHE.get(nome)!;
  const B = bancoProprio(), c = B[nome] || B[nome.split(' // ')[0]];
  const p = c ? perfilDe(c) : null;
  CACHE.set(nome, p);
  return p;
}
