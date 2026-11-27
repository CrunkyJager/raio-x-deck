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
// lista colada do Moxfield/EDHREC traz carta de duas faces/portas como "A // B" (Dazzling Theater // Prop Room, Find // Finality);
// o banco guarda pelo nome da 1ª face (CR 709.3/712: o nome é o da face de cima). Sem isso a partida parava: "carta fora da base".
M.nomeBase = n => !DB || DB[n] || typeof n !== 'string' || !n.includes(' // ') ? n : DB[n.split(' // ')[0]] ? n.split(' // ')[0] : n;
M.carta = n => {
  const c = DB && (DB[n] || DB[M.nomeBase(n)]);
  if (!c) throw new Error('carta fora da base RX: ' + n);
  return c;
};
// ficha leva o próprio dado; carta de mais de uma face devolve a face que está para cima (o.face)
// palavras-chave que só valem na montagem do deck/zona de comando (CR 702.124 parceiro, 'parceiroCom' = parceiro com
// <nome>, 702.124c): na partida não mudam nada. O carregamento do deck aceita os dois comandantes.
// Escolha um Antecedente (702.124k): o comandante e o antecedente (Background lendário) começam os dois no comando
// (702.124b) e cada um tem o próprio imposto (903.8, 702.124d: j.imposto por id) — o novoJogo já faz isso.
M.KW_SO_DECK = new Set(['parceiro', 'parceiroCom', 'escolhaAntecedente']);
M.dadoBase = (e, o) => o.ficha ? o.ficha : o.clone ? o.clone : o.face == null ? M.carta(o.n) : M.dadoFace(M.carta(o.n), o.face);
// camada 4 (tipo) e 7b (P/R fixado), só no campo: o.anim (op animar, preso ao objeto: mesmo ts) e a estática
// 'continuo' com tipo/sub que afeta 'este' (Ultra Magnus, Arcee, Ratchet: criatura no seu turno). O dado com o
// que muda é guardado por dado base + mudança (WeakMap), então ler continua sem alocar.
const TIPO_ESTE = new WeakMap<object, any[]>();
// (com kw/P/R junto — Skyknight Squire "has flying and is a Knight" — fica só a parte de tipo; o resto vai pelas camadas)
const tipoEste = (d): any[] => { let l: any[] | undefined = TIPO_ESTE.get(d); if (!l) TIPO_ESTE.set(d, (l = (d.est || []).filter(s => s.modo === 'continuo' && s.afeta === 'este' && (s.tipo || s.sub || s.tiraTipo))
  .map(s => !s.p && !s.r && !s.kw && !s.habil ? s : { modo: s.modo, afeta: s.afeta, tipo: s.tipo, sub: s.sub, tiraTipo: s.tiraTipo, se: s.se }))); return l as any[]; };
// a parte de tipo das estáticas que dão tipo/sub à 'equipada' (só {tipo, sub, se}: a kw vai pelas camadas)
const TIPO_EQUIP = new WeakMap<object, any[]>();
const tipoEquip = (d): any[] => { let l: any[] | undefined = TIPO_EQUIP.get(d); if (!l) TIPO_EQUIP.set(d, (l = (d.est || []).filter(s => M.estTipoEquipOk(s)).map(s => ({ tipo: s.tipo, sub: s.sub, se: s.se, trocaSub: s.trocaSub })))); return l as any[]; };
const SUB_NAO_CRIATURA = new Set(['Equipment', 'Aura', 'Vehicle', 'Saga', 'Class', 'Shrine', 'Cartouche', 'Curse', 'Role', 'Fortification']);
// subtipos que não são de criatura (205.3g-j: terreno, artefato, mágica): metamorfo não os tem
const SUB_NAO_CRIAT_TODOS = new Set([...SUB_NAO_CRIATURA, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Gate', 'Desert', 'Cave', 'Town', 'Sphere', 'Lair', 'Locus', 'Mine', 'Tower', 'Power-Plant', "Urza's",
  'Food', 'Treasure', 'Clue', 'Blood', 'Map', 'Gold', 'Incubator', 'Powerstone', 'Junk', 'Attraction', 'Contraption', 'Bobblehead', 'Arcane', 'Trap', 'Lesson', 'Adventure', 'Omen', 'Room', 'Case', 'Background']);
// a parte de tipo das estáticas que dão tipo/sub a quem bate um filtro (Ashaya: "nontoken creatures you control are
// Forest lands"; Dryad: "lands you control are every basic land type", CR 613.1d, 305.7 "in addition")
const TIPO_FILTRO = new WeakMap<object, any[]>();
const tipoFiltro = (d): any[] => { let l: any[] | undefined = TIPO_FILTRO.get(d); if (!l) TIPO_FILTRO.set(d, (l = (d.est || []).filter(s => M.estTipoFiltroOk(s)))); return l as any[]; };
// tipo básico de terreno ganho (CR 305.6): "{T}: Add [cor]" intrínseca; objetos fixos para o cache de atv
const MANA_BASICA = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
const ATV_BASICA = Object.fromEntries(Object.entries(MANA_BASICA).map(([t, c]) => [t, { custo: { virar: true }, deMana: true, fx: [{ op: 'mana', prod: [c], qtd: 1 }] }]));
// 'escolhido' no sub da estática de tipo (Metallic Mimic, Roaming Throne): o tipo escolhido ao entrar (o.escolha.tipo)
const ESCOLHIDO = new WeakMap<object, Map<string, any>>();
const comEscolhido = (s, t) => { let c = ESCOLHIDO.get(s); if (!c) ESCOLHIDO.set(s, (c = new Map())); let r = c.get(t); if (!r) c.set(t, (r = { ...s, sub: s.sub.map(x => x === 'escolhido' ? t : x) })); return r; };
const KW_ESC = new WeakMap<object, Map<string, any>>();
const kwEscolhido = (k, v) => { let c = KW_ESC.get(k); if (!c) KW_ESC.set(k, (c = new Map())); let r = c.get(v); if (!r) c.set(v, (r = { ...k, de: v })); return r; };
// camada 5 (cor, CR 613.1e): estática 'continuo' com cores ("é preto", Nim Deathmantle; "são de todas as cores",
// Leyline of the Guildpact) e camadas 4/7b com filtro (Bello: "cada artefato … é uma criatura 4/4"). Lidas no M.dadoDe
// pelo índice I.cor; quem ela afeta é decidido sem o que ela dá (613.8 simplificado: o filtro lê o tipo/cor de antes).
const COR_EST = new WeakMap<object, any[]>();
const corEst = (d): any[] => { let l: any[] | undefined = COR_EST.get(d); if (!l) COR_EST.set(d, (l = (d.est || []).filter(s => s.modo === 'continuo' && (typeof s.cores === 'string' || (estTipoFiltro(s) && !M.estTipoFiltroOk(s))) && M.estContOk(s)))); return l as any[]; };
const COR_M = new WeakMap<object, any>();
const corM = s => { let m = COR_M.get(s); if (!m) COR_M.set(s, (m = estTipoFiltro(s) ? { tipo: s.tipo, sub: s.sub, pt: s.pt, cores: s.cores } : { cores: s.cores })); return m; };
const estTipoFiltro = s => !!s && !!s.afeta && typeof s.afeta === 'object' && !!(s.tipo || s.sub || s.pt);
// protótipo (CR 702.160b): custo, cor e P/R do protótipo valem como os valores copiáveis da permanente
const PROTO = new WeakMap<object, any>();
M.prototipoDe = d => (d.kw || []).find(x => x.k === 'prototipo' && x.custo && Array.isArray(x.pt));
const comProto = d => { let r = PROTO.get(d); if (r) return r; const k = M.prototipoDe(d); if (!k) return d;
  const c = k.custo, vm = (c.g || 0) + (c.p || []).length;
  PROTO.set(d, (r = { ...d, custo: c, vm, pt: k.pt, cores: k.cores ?? (c.p || []).filter(x => /^[WUBRG]$/.test(x)).filter((x, i, a) => a.indexOf(x) === i).join('') })); return r; };
const MISTO = new WeakMap<object, Map<any, any>>();
const misto = (d, m) => {
  let c = MISTO.get(d); if (!c) MISTO.set(d, (c = new Map()));
  let r = c.get(m); if (r) return r;
  const un = (a, b) => b && b.length ? [...new Set([...(a || []), ...b])] : a;
  r = { ...d, tipos: un(d.tipos, m.tipos || m.tipo), sub: m.trocaSub ? [...(d.sub || []).filter(x => SUB_NAO_CRIATURA.has(x)), ...(m.sub || [])] : un(d.sub, m.sub) };   // animar escreve tipos; a estática, tipo
  // trocaSub: "is a black Zombie" (Nim Deathmantle, 205.1b): os tipos de criatura viram só estes (os de outro tipo ficam)
  // tiraTipo (camada 4): "isn't a creature" (deuses de Theros com pouca devoção). Sem o tipo Criatura, perde os
  // subtipos de criatura (205.1b; fica o de Equipamento/Aura etc. que é de outro tipo) e o P/R
  if (m.soSub) r.sub = [...(d.sub || []).filter(x => SUB_NAO_CRIATURA.has(x)), ...m.sub];   // "loses its other creature types" (205.1b; The Master, Transcendent)
  if (m.tiraTipo) { r.tipos = (r.tipos || []).filter(t => !m.tiraTipo.includes(t)); if (m.tiraTipo.includes('Creature')) { r.sub = (r.sub || []).filter(x => SUB_NAO_CRIATURA.has(x)); r.pt = undefined; } }
  if (m.super) r.super = un(d.super, m.super);
  const novas = (m.sub || []).filter(t => ATV_BASICA[t] && !(d.sub || []).includes(t));
  if (novas.length && (r.tipos || []).includes('Land')) r.atv = [...(d.atv || []), ...novas.map(t => ATV_BASICA[t])];
  if (m.pt) r.pt = m.pt === 'vm' ? [d.vm || 0, d.vm || 0] : m.pt;   // 'vm': P/R base = o valor de mana dele (Starfield of Nyx)
  if (m.kw && m.kw.length) r.kw = [...(d.kw || []), ...m.kw];
  if (m.cores !== undefined) r.cores = m.cores;
  if (m.maisCores) r.cores = [...new Set([...(r.cores || ''), ...m.maisCores])].join('');   // "in addition to its other colors" (105.3)
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
// O Anel te tenta (CR 701.54): J.anel = {n: vezes (o emblema tem as habilidades 1..min(n,4)), p: {id, ts} do Portador}
const ANEL_LEND = { super: ['Legendary'] };
M.ehPortador = (e, o) => { const A = e.jogs[o.ctrl] && e.jogs[o.ctrl].anel; return !!A && !!A.p && A.p.id === o.id && A.p.ts === o.ts && o.zona === 'campo'; };
// 2: "sempre que atacar, compre e depois descarte"; 4: "sempre que causar dano de combate a um jogador, cada oponente perde 3"
// (3: "quando for bloqueado por uma criatura, o controlador dela a sacrifica no fim do combate" ainda não)
const ANEL_GAT = [
  { ev: 'ataca', quem: { este: true }, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }, { op: 'descartar', quem: 'voce', qtd: 1 }], _anel: 2 },
  { ev: 'dano', combate: true, aJogador: true, quem: { este: true }, fx: [{ op: 'perderVida', quem: 'cadaOponente', qtd: 3 }], _anel: 4 }];
const ANEL_GATS = [0, 1, 2, 3, 4].map(n => ANEL_GAT.filter(g => g._anel <= n));
M.gatAnel = (e, o) => M.ehPortador(e, o) ? ANEL_GATS[Math.min(4, e.jogs[o.ctrl].anel.n)] : NADA.atv;
M.ehClasse = d => (d.kw || []).some(x => x.k === 'classe');
// animar enquantoNoCampo: vale enquanto a fonte (mesmo objeto, ts) está no campo sob o mesmo controlador (611.2b)
const animFonteOk = (e, s) => { const F = e.objs[s.id]; return !!F && F.zona === 'campo' && F.ts === s.ts && (s.ctrl === undefined || F.ctrl === s.ctrl); };   // sem ctrl: "enquanto esta permanecer no campo" (Tidebinder)
M.dadoDe = (e, o) => {
  let d = M.dadoBase(e, o);
  if (o.zona !== 'campo') return o.zona === 'pilha' && o.pil && o.pil.conc ? comoAura(d) : d;
  if (o.proto) d = comProto(d);   // 702.103b: mágica concedida é de Aura
  if (o.nivel > 1 && d.niveis) d = comNivel(d, o.nivel);
  const A = o.anim;
  if (A && A.length) for (const a of A) if (a.ts === o.ts && !a.semHab && (!a.src || animFonteOk(e, a.src))) d = misto(d, a);
  const st = tipoEste(d);
  if (st.length && !lendoTipo) {
    lendoTipo++;
    try { for (let s of st) { let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, { voce: o.ctrl, este: o.id }); } catch (_) { ok = false; } } if ((s.sub || []).includes('escolhido')) { const t = o.escolha && o.escolha.tipo; if (!t) ok = false; else s = comEscolhido(s, t); } if (ok) d = misto(d, s); } }
    finally { lendoTipo--; }
  }
  if (!lendoTipo) {
    lendoTipo++;
    try {
      const I = indice(e), tp = I.tp;
      for (const id of tp) {
        const F = e.objs[id]; if (!F || !presoA(e, F, o)) continue;
        for (const s of tipoEquip(M.dadoDe(e, F))) { let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, { voce: F.ctrl, este: F.id }); } catch (_) { ok = false; } } if (ok) d = misto(d, s); }
      }
      for (const id of I.cor) {                                   // camada 5, em ordem de campo (≈ timestamp, 613.7)
        const F = e.objs[id]; if (!F || F.zona !== 'campo') continue;
        const ctx = { voce: F.ctrl, este: F.id };
        for (const s of corEst(M.dadoDe(e, F))) {
          if (!afeta(e, F, s, o, ctx)) continue;
          let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } }
          if (ok) d = misto(d, corM(s));
        }
      }
      // com filtro: o filtro lê o objeto sem as mudanças de tipo (dependência 613.8 não tratada: Dryad não vê as
      // criaturas que a Ashaya fez terreno — simplificação)
      for (const id of indice(e).tf) {
        const F = e.objs[id]; if (!F) continue;
        for (const s of tipoFiltro(M.dadoDe(e, F))) {
          const cx = { voce: F.ctrl, este: F.id };
          let ok = false; try { ok = M.bate(e, o, s.afeta, cx) && (!s.se || M.condicao(e, s.se, cx)); } catch (_) { ok = false; }
          if (ok) d = misto(d, s);
        }
      }
      // perder todas as habilidades (camada 6, CR 613.1f): depois dos tipos e cores (as camadas 4/5 das próprias
      // estáticas já valeram, 613.6); o que foi dado depois (timestamp maior, 613.7) volta
      const P = perdeTs(e, o, I);
      if (P) { d = semHab(d); if (A) for (const a of A) if (a.ts === o.ts && !a.semHab && a.kw && a.kw.length && (a.tE || 0) >= P && (!a.src || animFonteOk(e, a.src))) d = comKw(d, a.kw); }
    } finally { lendoTipo--; }
  }
  if (o.anexo && (d.kw || []).some(x => x.k === 'reconfigurar')) d = semCriatura(d);   // 702.151b: anexada, não é criatura
  if (o.concedida && o.anexo) d = comoAura(d);   // 702.103b: concedida = Aura, não criatura
  if (e.jogs[o.ctrl] && e.jogs[o.ctrl].anel && M.ehPortador(e, o)) d = misto(d, ANEL_LEND);   // 701.54c: o Portador do Anel é lendário
  return d;
};
// ---- perder todas as habilidades (CR 613.1f, camada 6) ----
// Fontes: o.anim {semHab, tE, src} (efeito de resolução preso ao objeto: Tishana's Tidebinder "enquanto esta criatura
// estiver no campo") e a estática 'continuo' {tiraTudo} (Poppet Factory: "fichas de criatura suas perdem todas as
// habilidades"; timestamp = o da fonte, 613.7a). Devolve o timestamp mais novo que vale (0 = não perde). Quem decide
// se a estática afeta lê o objeto sem a perda (613.8 simplificado). Estática de fonte que também perdeu tudo não vale.
let perdendo = 0;
const PERDE_OK = s => s.modo === 'continuo' && s.tiraTudo === true;
const temPerde = d => (d.est || []).some(PERDE_OK);
function perdeTs(e, o, I): number {
  let P = 0;
  const A = o.anim;
  if (A) for (const a of A) if (a.semHab && a.ts === o.ts && (!a.src || animFonteOk(e, a.src)) && (a.tE || 0) > P) P = a.tE || 1;
  if (!I.ph.length || perdendo) return P;
  perdendo++;
  try {
    for (const id of I.ph) {
      const F = e.objs[id]; if (!F || F.zona !== 'campo' || F.ts <= P) continue;
      const ctx = { voce: F.ctrl, este: F.id };
      for (const s of M.dadoBase(e, F).est || []) {
        if (!PERDE_OK(s) || !afeta(e, F, s, o, ctx)) continue;
        let ok = true; if (s.se) { try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } }
        if (ok && !(F.id !== o.id && perdeTs(e, F, I))) { P = F.ts; break; }
      }
    }
  } finally { perdendo--; }
  return P;
}
M.perdeTs = (e, o) => o.zona === 'campo' ? perdeTs(e, o, indice(e)) : 0;
// rápido: sem nenhuma fonte de perda no campo nem o.anim, nem olha
const perdeu = (e, o) => o.zona === 'campo' && (!!o.anim || indice(e).ph.length > 0) && perdeTs(e, o, indice(e)) > 0;
M.perdeuTudo = perdeu;
// sem palavras-chave, estáticas, gatilhos, ativadas e substituições (a de mana também, 605); tipos, cores e P/R impressos ficam
const SEM_HAB = new WeakMap<object, any>();
const semHab = d => { let r = SEM_HAB.get(d); if (!r) { r = { ...d }; for (const k of ['kw', 'est', 'gat', 'atv', 'subst', 'niveis']) delete r[k]; SEM_HAB.set(d, r); } return r; };
const COM_KW = new WeakMap<object, Map<any, any>>();
const comKw = (d, kw) => { let c = COM_KW.get(d); if (!c) COM_KW.set(d, (c = new Map())); let r = c.get(kw); if (!r) c.set(kw, (r = { ...d, kw: [...(d.kw || []), ...kw] })); return r; };
// reconfigurar (702.151b): enquanto anexada, perde o tipo Criatura e os subtipos de criatura (fica o Equipamento)
const SEM_CRIATURA = new WeakMap<object, any>();
const semCriatura = d => {
  let r = SEM_CRIATURA.get(d);
  if (!r) SEM_CRIATURA.set(d, (r = { ...d, tipos: (d.tipos || []).filter(t => t !== 'Creature'), sub: (d.sub || []).filter(s => s === 'Equipment'), pt: undefined }));
  return r;
};

// concessão (702.103b): mágica/permanente de Aura com "encantar criatura"; perde o tipo Criatura e os subtipos de criatura
const COMO_AURA = new WeakMap<object, any>();
const comoAura = d => {
  let r = COMO_AURA.get(d);
  if (!r) COMO_AURA.set(d, (r = { ...d, tipos: (d.tipos || []).filter(t => t !== 'Creature'), sub: ['Aura'], pt: undefined, kw: [...(d.kw || []), { k: 'encantar', f: { tipo: ['Creature'] } }] }));
  return r;
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
  else if (face === 'portas') {                                                                     // Room com as duas portas destrancadas (709.5): o texto das duas
    const jun = k => [...(c[k] || []), ...(f[k] || [])];
    d = { ...frente, custo: M.somaCusto(c.custo || {}, f.custo || {}), vm: M.vmDe(c.custo || {}) + M.vmDe(f.custo || {}), cores: coresDoCusto(M.somaCusto(c.custo || {}, f.custo || {})),
      est: jun('est'), gat: jun('gat'), atv: jun('atv'), subst: jun('subst'), kw: jun('kw') };
    for (const k of ['est', 'gat', 'atv', 'subst', 'kw']) if (!d[k].length) delete d[k];
  } else if (face === 'trancada') {                                                                 // Room com as duas trancadas: sem nome, custo nem texto (709.5); fica o tipo
    const { est, gat, atv, subst, kw, fx, alvos, ...resto } = frente;
    d = { ...resto, custo: {}, vm: 0, cores: '' };
  }
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
// Room (709.5): carta dividida com uma linha de tipo só (subtipo Room). No campo cada metade (porta) está trancada ou
// destrancada (o.portas {e, d}); a face lida é a das portas destrancadas: 'esq', 0 (direita), 'portas' (as duas) ou 'trancada'.
M.ehRoom = c => !!c && c.forma === 'split' && !!c.faces && (c.sub || []).includes('Room');
M.facePortas = P => P.e && P.d ? 'portas' : P.e ? 'esq' : P.d ? 0 : 'trancada';

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
      i, nome: d.nome || 'J' + (i + 1), vida: 40, vidaInicial: 40, veneno: 0,  // CR 103.4c
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
  n = M.nomeBase(n);
  const o = { id: e.prox++, n, dono, ctrl: dono, zona, ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: true, cmd: false };
  e.objs[o.id] = o;
  return o;
}

// ---- zonas ----
M.listaDe = (e, o) => o.zona === 'campo' ? e.campo : o.zona === 'pilha' ? e.pilha : o.zona === 'faseado' ? (e.faseados || (e.faseados = [])) : o.zona === 'fora' ? [] : e.jogs[o.dono].zonas[o.zona];   // 'fora': deixou de existir (cópia preparada)

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
  for (const id of e.campo) { const o = e.objs[id]; if (o.ctrl === j && o.ganhos && o.ganhos.est && o.ganhos.est.some(s => s.afeta === 'voce' && ok(s))) return true; }   // ganhas por efeito (modificar dura sempre)
  return false;
}
// virar (CR 701.26a): dispara 'vira' ("whenever … becomes tapped": Dionus, Deeproot Pilgrimage). Entrar virado não é virar.
M.virarObj = (e, o) => { if (!o || o.virada) return; o.virada = true; if (M.evento) M.evento(e, { ev: 'vira', id: o.id, ts: o.ts, j: o.ctrl }); };
// desvirar um permanente (CR 701.26b): dispara 'desvira' ("whenever this becomes untapped", Key to the City)
M.desvirarObj = (e, o) => { if (!o || !o.virada) return; o.virada = false; if (M.evento) M.evento(e, { ev: 'desvira', id: o.id, ts: o.ts, j: o.ctrl }); };   // j: "that permanent's controller" (Mesmeric Orb)
// "sua vida não pode mudar" (Teferi's Protection, Flare of Fortitude, Platinum Emperion): sem ganho, perda nem pagar vida (119.8)
M.vidaFixa = (e, j) => estJog(e, j, s => s.modo === 'vidaNaoMuda');
// "you can't lose the game and your opponents can't win the game" (Darksteel/Platinum Angel, CR 104.3 / 104.2)
M.naoPerde = (e, j) => estJog(e, j, s => s.modo === 'naoPerdeJogo');
M.naoVence = (e, j) => e.jogs.some(J => J.i !== j && !J.saiu && M.naoPerde(e, J.i));
// "você tem proteção contra tudo" (702.16j, 702.16b): não é alvo, dano a você é prevenido. Só 'tudo' por ora.
M.protegeJog = (e, j, fonte?) => estJog(e, j, s => s.modo === 'protecaoJogador' && protTudo(s)) || (!!fonte && protJogDe(e, j, fonte));
// "you have protection from the chosen card type" (Serra's Emissary, 702.16j): da fonte (objeto) com esse tipo/cor
function protJogDe(e, j, fonte) {
  const ks = (F, s) => s.modo === 'protecaoJogador' && s.afeta === 'voce' && !s.se ? (s.kw || []).filter(k => k.k === 'protecao' && k.de !== 'tudo').map(k => k.de === 'escolhido' ? (F.escolha && (F.escolha.tipoCarta || F.escolha.cor)) : k.de) : [];
  for (const id of indice(e).est) { const F = e.objs[id]; if (F.ctrl !== j) continue; for (const s of M.dadoDe(e, F).est || []) for (const de of ks(F, s)) if (de && M.protKwBate(de, M.dadoDe(e, fonte))) return true; }
  return false;
}
// "você tem antimagia" (702.11c): oponente não mira você (Dawn's Truce, Lazotep Plating, Metropolis Reformer)
// "você não pode conjurar mágicas neste turno" (Conduit of Worlds, 101.2: o "não pode" vence)
// seJog (Angelic Arbiter): a condição é do jogador afetado — 'atacouNoTurno' (atacou com criatura, 508.1) ou 'conjurouNoTurno'
M.jogFez = (e, j, k) => k === 'atacouNoTurno' ? (e.turno.ataques || []).some(r => r.j === j && !r.entrou)
  : k === 'conjurouNoTurno' ? !!(e.jogs[j].conjT && e.jogs[j].conjT.t === e.turno.n && e.jogs[j].conjT.n > 0) : false;
// "seus oponentes não podem conjurar…" de uma permanente de outro jogador (Myrel e Voice of Victory no seu turno, Angelic Arbiter)
const naoConjOp = (e, j) => indice(e).est.some(id => {
  const F = e.objs[id]; if (F.ctrl === j) return false;
  return (M.dadoDe(e, F).est || []).some(s => s.modo === 'naoPodeConjurar' && (s.afeta === 'cadaOponente' || s.afeta === 'oponente') && !s.f
    && (!s.seJog || M.jogFez(e, j, s.seJog)) && (() => { try { return M.condicao(e, s.se, { voce: F.ctrl, este: F.id }); } catch (_) { return false; } })());
});
M.naoConjura = (e, j) => estJog(e, j, s => s.modo === 'naoPodeConjurar' && !s.f) || naoConjOp(e, j);
// "[objetos] não podem ter as habilidades ativadas ativadas" (Linvala, Keeper of Silence; Myrel no seu turno): CR 602.5,
// 101.2 (o "não pode" vence). Vale para as de mana também (605.1a são ativadas). afeta é filtro lido do lado da fonte.
M.ativBloqueada = (e, o) => {
  for (const id of indice(e).est) {
    const F = e.objs[id];
    for (const s of M.dadoDe(e, F).est || []) {
      if (s.modo !== 'naoPodeAtivar' || !s.afeta || typeof s.afeta !== 'object') continue;
      const c = { voce: F.ctrl, este: F.id };
      if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, c); } catch (_) { ok = false; } if (!ok) continue; }
      if (M.bate(e, o, { zona: 'campo', ...s.afeta }, c)) return true;
    }
  }
  return false;
};
M.antimagiaJog = (e, j) => estJog(e, j, s => s.modo === 'protecaoJogador' && (s.kw || []).some(k => k.k === 'antimagia'));

// Mover de zona. CR 400.7: vira objeto novo — o id fica (é a carta física, a designação de comandante vai junto,
// CR 903.3), mas timestamp novo e o estado do campo zera. Ficha fora do campo deixa de existir (CR 704.5d, nas ABE).
// CR 903.9b (comandante iria para mão/grimório → pode ir ao comando): escolha do dono; por ora sempre aceita
// (pergunta de substituição entra na T19).
// Face: entra no campo com a face que estava na pilha (712.10) ou a pedida (terreno modal, 712.9); de outra zona,
// com a frente (712.11). Em qualquer outra zona volta à frente (712.6a, 716.4) e perde a permissão da aventura.
// CR 614.1a: "se iria morrer / ir ao cemitério, em vez disso…" — a fonte no campo (ou a própria carta, de qualquer zona:
// Blightsteel). Várias: a primeira (616.1, a escolha do afetado fica para depois). Retorna {zona, marc?, embaralhar?}.
// talvez ("you may put it on top… instead", Library of Leng): só com quem decide (opc.ask) e só em descarte por EFEITO
// (custo e limpeza não são efeito; ruling de Leng). Quem escolhe é o controlador da fonte, carta a carta.
function substCemiterio(e, o, opc: any = {}) {
  const fontes = M.indiceCampo(e).sb.map(i => e.objs[i]);
  if (o.zona !== 'campo' && (M.dadoDe(e, o).subst || []).length) fontes.push(o);
  for (const F of fontes) for (const sb of M.dadoDe(e, F).subst || []) {
    if (sb.ev !== 'vaiCemiterio' && !(sb.ev === 'morre' && o.zona === 'campo' && M.temTipo(e, o, 'Creature'))) continue;
    if (!M.substOk(sb)) continue;
    const ctx = { voce: F.ctrl ?? F.dono, este: F.id };
    if (sb.quem && (sb.quem.este ? o.id !== F.id : !M.bate(e, o, sb.quem, ctx))) continue;
    if (sb.se) { let ok = false; try { ok = M.condicao(e, sb.se, ctx); } catch (_) { ok = false; } if (!ok) continue; }
    if (sb.talvez) {
      if (!opc.ask || !opc.efeito) continue;
      if (opc.ask(ctx.voce, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'subst', fonte: F.id, id: o.id, para: sb.muda && sb.muda.para }).a === 'nao') continue;
    }
    if (sb.muda) return { zona: sb.muda.para, n: F.n };
    const [a, b] = sb.emVez;
    if (a.op === 'exilar') return { zona: 'exilio', marc: b ? { [b.tipoMarc]: b.qtd } : null, n: F.n };
    return { zona: 'grimorio', embaralhar: true, n: F.n };
  }
  return null;
}
M.mover = (e, id, zona, { topo = true, virada = false, face = undefined, conj = null, conjDe = null, anim = null, pos = null, ask = null, efeito = false, sac = false, clone = null, conjurada = false, conc = null }: any = {}) => {   // sac: sacrifício (701.21), vai no evento
  const o = e.objs[id];
  if (o.copia && zona !== 'pilha') {                                // cópia de mágica fora da pilha deixa de existir (704.5e)
    const l = M.listaDe(e, o), k = l.lastIndexOf(id); if (k >= 0) l.splice(k, 1);
    o.zona = 'fora'; o.pil = null; return o;
  }
  if (o.copiaPrep && zona !== 'pilha' && zona !== 'exilio') {        // cópia da mágica preparada: fora da pilha e do exílio deixa de existir (707.10a)
    const l = M.listaDe(e, o), k = l.lastIndexOf(id); if (k >= 0) l.splice(k, 1);
    o.zona = 'fora'; return o;
  }
  if (o.zona === 'campo' && o.exilaAoSair && zona !== 'exilio' && zona !== 'campo') { zona = 'exilio'; M.log(e, o.n, 'vai para o exílio em vez de sair (desenterrar)'); }   // 702.84a: "se fosse sair do campo, exile-a"
  const sub = zona === 'cemiterio' ? substCemiterio(e, o, { ask, efeito }) : null;
  if (sub) { zona = sub.zona; M.log(e, o.n, 'vai para', zona, 'em vez do cemitério (' + sub.n + ')'); }
  if (o.cmd && (zona === 'mao' || zona === 'grimorio')) zona = 'comando';
  const zDe = o.zona, snap = zDe === 'campo' ? { ...o, marc: { ...o.marc } } : null;   // LKI de quem sai (603.10a)
  const snapCem = zDe === 'cemiterio' ? { ...o } : null;
  if (sac && snap) { const J = e.jogs[snap.ctrl]; if (J) J.sacT = { t: e.turno.n, l: [...(J.sacT && J.sacT.t === e.turno.n ? J.sacT.l : []), snap] }; }   // "if you sacrificed a Food this turn" (Elanor Gardner): o LKI das sacrificadas no turno
  const de = M.listaDe(e, o), k = de.lastIndexOf(id);   // id único na lista; o fim (topo, ficha nova) é o mais comum
  if (k >= 0) de.splice(k, 1);
  if (zDe === 'campo' && k >= 0) M.campoSai(e, id);
  if (zona === 'cemiterio' && (zDe === 'mao' || zDe === 'grimorio') && !o.ficha) { const J = e.jogs[o.dono]; J.cemT = { t: e.turno.n, n: (J.cemT && J.cemT.t === e.turno.n ? J.cemT.n : 0) + 1 }; }   // "cards put into your graveyard from your hand or library this turn" (Welcome the Dead)
  let faceNova = zona !== 'campo' ? null : face !== undefined ? face : zDe === 'pilha' ? o.face ?? null : null;
  // 709.5d: a Room entra com a porta conjurada destrancada; posta no campo sem ser conjurada, com as duas trancadas
  const portas = zona === 'campo' && !o.ficha && !clone && M.ehRoom(M.carta(o.n)) ? { e: zDe === 'pilha' && faceNova === 'esq', d: zDe === 'pilha' && faceNova === 0 } : null;
  if (portas) faceNova = M.facePortas(portas);
  Object.assign(o, { clone: zona === 'campo' ? clone : null, clone0: null, cloneFim: null, zona, ts: ++e.ts, virada: zona === 'campo' && virada, dano: 0, marc: {} as any, doente: true, ctrl: o.dono, ctrl0: undefined, escolha: null, mortal: false, conjurada: zona === 'campo' && (!!conjDe || !!conjurada), conjDe: zona === 'campo' ? conjDe : null, xConj: 0, voto: null, lealTurno: 0, usos: null, face: faceNova, aventura: null, anexo: zona === 'campo' && conc ? { id: conc.o, ts: conc.ts } : null, concedida: zona === 'campo' && !!conc, exPor: null, feridaPor: null, fundidaCom: null, preparada: false, previsto: null, suspensa: false, faceBaixo: false, olham: null, portas, loucura: false, ganhos: zDe === 'pilha' && zona === 'campo' && o.gatPilha ? { gatS: o.gatPilha } : null, gatPilha: null, nivel: null, tEntrou: zona === 'campo' ? e.turno.n : null,
    conjCom: zona === 'campo' && conj && (conj.chute || conj.presente || conj.prole || conj.iminente) ? { kicker: !!conj.chute, presente: !!conj.presente, prole: !!conj.prole, iminente: !!conj.iminente } : null,
    proto: zona === 'campo' && !!conj && !!conj.prototipo });   // 702.160: conjurada como protótipo, entra com o custo/cor/P-R dele   // como foi conjurada (702.33d)
  if (zona === 'campo' && anim) o.anim = anim.map(a => ({ ...a, ts: o.ts, fim: null }));   // entra já mudada ("It's an enchantment. It's not a creature", Enduring Courage): antes dos gatilhos de entrar
  if (zona === 'campo' && M.dadoDe(e, o).leal) o.marc.lealdade = M.dadoDe(e, o).leal;   // CR 306.5b: entra com a lealdade impressa
  if (zona === 'campo') for (const x of M.dadoDe(e, o).kw || []) if (x.k === 'desaparecer' && Number.isInteger(x.n)) o.marc.time = (o.marc.time || 0) + x.n;   // 702.63a: entra com N marcadores de tempo   // CR 306.5b: entra com a lealdade impressa
  if (zona === 'campo' && M.ehClasse(M.dadoBase(e, o))) o.nivel = 1;                       // CR 716.2c: a Classe entra no nível 1
  const para = M.listaDe(e, o);
  if (zona === 'grimorio' && Number.isInteger(pos) && pos > 1) para.splice(Math.max(0, para.length - (pos - 1)), 0, id);   // "fourth from the top" (Lost to Legend): pos 4 = 3 cartas por cima
  else if (zona === 'grimorio' && !topo) para.unshift(id); else para.push(id);   // grimório: fim do array = topo
  if (sub && sub.marc) for (const m in sub.marc) o.marc[m] = (o.marc[m] || 0) + sub.marc[m];   // "exile-a com um marcador hit" (fica no exílio)
  if (sub && sub.embaralhar) M.embaralhar(e, para);
  if (zona === 'campo') { M.campoEntra(e, id); M.registraEntrada(e, o); }
  if (zona === 'campo' && (M.dadoBase(e, o).kw || []).some(x => x.k === 'entraPreparada')) M.preparar(e, o);   // "enters prepared"
  if (zona === 'cemiterio' || zona === 'exilio') e.abeNovo.push(id);
  if (zDe === 'campo' && e.ctrlEf && e.ctrlEf.length) M.recalcCtrl(e);   // a fonte do "enquanto você controlar" saiu (Roil Elemental)
  if (M.evento && (zDe === 'campo' || zona === 'campo' || zona === 'cemiterio' || zDe === 'cemiterio')) M.evento(e, { ev: 'zona', id, de: zDe, para: zona, snap, ...(sac && zDe === 'campo' ? { sac: true } : {}), ...(snapCem ? { snapCem } : {}), ...(zona === 'campo' && e.fxFonte !== undefined ? { porFx: e.fxFonte } : {}) });   // snapCem: a carta como era no cemitério (saiCemiterio)   // gatilhos.js
  if (portas && M.evento) for (const k of ['e', 'd']) if (portas[k]) M.evento(e, { ev: 'destranca', id, ts: o.ts, porta: k, j: o.ctrl });   // 709.5h: entrar destrancada também é destrancar
  if (zona === 'campo' && M.capitulos(M.dadoDe(e, o))) M.porHistoria(e, o, 1);   // CR 714.3a: a saga entra com 1 marcador de história
  if (zDe === 'campo' && e.volta && e.volta.length && snap) {        // CR 610.3: o exilado "até esta sair" volta agora (sob o dono, 610.3c)
    const vai = e.volta.filter(v => v.id === id && v.ts === snap.ts); e.volta = e.volta.filter(v => !vai.includes(v));
    for (const v of vai) for (const x of v.ids) { const X = e.objs[x.id]; if (X && X.zona === 'exilio' && X.ts === x.ts) M.aplicarEntrada(e, M.decidirEntrada(e, x.id, X.dono, {}, (_j, _t, ops) => ops[0])); }
  }
  if (o.ficha && zona !== 'campo') (e.fichasFora = e.fichasFora || []).push(id);   // CR 704.5d: some nas ABE        // CR 903.9a olha "desde a última checagem"
  if (zDe === 'campo' && snap && snap.fundidaCom) { const P = e.objs[snap.fundidaCom.id]; if (P && P.zona === 'exilio' && P.ts === snap.fundidaCom.ts && zona !== 'exilio') M.mover(e, P.id, zona); }   // 712.4c: a fundida sai, as duas cartas vão
  return o;
};

// regenerar (CR 701.15): escudo "a próxima vez que seria destruída neste turno, em vez disso vire-a, tire todo o dano
// dela e tire-a do combate" (614.8). o.regen = {ts, t, n}: vale para este objeto (ts), neste turno (t), n escudos.
// Destruir (701.8) e dano letal/toque mortífero (704.5g–h) olham o escudo; resistência 0 (704.5f) e sacrificar não.
M.porRegen = (e, o) => { const R = o.regen && o.regen.ts === o.ts && o.regen.t === e.turno.n ? o.regen.n : 0; o.regen = { ts: o.ts, t: e.turno.n, n: R + 1 }; };
M.regenera = (e, o) => {
  if (!o.regen || o.regen.ts !== o.ts || o.regen.t !== e.turno.n || o.regen.n <= 0) return false;
  o.regen = { ...o.regen, n: o.regen.n - 1 };
  M.virarObj(e, o); o.dano = 0; o.mortal = false;
  const C = e.turno.combate;                                        // CR 506.4: o atacante que já foi bloqueado continua bloqueado
  if (C) { C.atk = C.atk.filter(a => a.id !== o.id); for (const a of C.atk) if (a.bloq) a.bloq = a.bloq.filter(b => b.id !== o.id); }
  M.log(e, o.n, 'regenera');
  return true;
};
// descartar (CR 701.9): o único caminho do descarte (efeito, custo, limpeza). Cada carta dispara 'descarta' {id, j, ts}
// e o lote todo 'descartaGrupo' {j, n, ids} (gatilho com grupo: "uma ou mais cartas", Marauding Mako).
// Loucura (702.35a): a carta vai para o exílio em vez do cemitério e o gatilho da loucura vai para a pilha.
// Simplificação: o exílio da loucura é sempre escolhido; quem não quer conjurar recusa no gatilho e ela vai ao cemitério.
M.descartar = (e, j, ids, opc: any = {}) => {   // opc {ask, efeito}: descarte por efeito (substituição com talvez)
  const feitas: any[] = [];
  for (const id of ids) {
    const o = e.objs[id]; if (!o || o.zona !== 'mao') continue;
    const lk = M.loucuraDe(e, o);                                    // da carta ou dada (Falkenrath Gorger)
    if (lk) {
      M.mover(e, id, 'exilio'); o.loucura = true;
      if (e.pend && e.turno.passo !== 'mulligan') e.pend.push({ fonte: id, ts: o.ts, ctrl: o.dono, k: 'loucura', g: GAT_LOUCURA, n: o.n, face: null, ficha: null, lki: M.lkiDe(e, o), ev: { ev: 'descarta', id, j, ts: o.ts } });
    } else M.mover(e, id, 'cemiterio', { ask: opc.ask, efeito: opc.efeito });
    feitas.push(id);
    M.evento(e, { ev: 'descarta', id, j, ts: o.ts });
  }
  if (feitas.length) { const J = e.jogs[j]; J.descT = { t: e.turno.n, n: (J.descT && J.descT.t === e.turno.n ? J.descT.n : 0) + feitas.length }; }   // conta descartadasNoTurno
  if (feitas.length) M.evento(e, { ev: 'descartaGrupo', j, n: feitas.length, ids: feitas });
  if (feitas.length) M.log(e, e.jogs[j].nome, 'descarta', feitas.map(id => e.objs[id].n).join(', '));
  return feitas;
};
const GAT_LOUCURA = { ev: 'descarta', fx: [{ op: 'loucura' }] };
// preparar (Secrets of Strixhaven): ficar preparada cria no exílio uma cópia da mágica de preparo (faces[0]) que o controlador
// pode conjurar enquanto a criatura estiver no campo e preparada; conjurar a desprepara. Já preparada: nada (não dobra).
M.preparar = (e, o) => {
  const c = o.ficha ? null : M.carta(o.n);
  if (o.preparada || o.zona !== 'campo' || !c || c.forma !== 'preparar' || !c.faces) return;
  o.preparada = true;
  const id = e.prox++;
  e.objs[id] = { id, n: o.n, dono: o.ctrl, ctrl: o.ctrl, zona: 'exilio', ts: ++e.ts, virada: false, dano: 0, marc: {}, doente: false, cmd: false, face: null, copiaPrep: { id: o.id, ts: o.ts } };
  e.jogs[o.ctrl].zonas.exilio.push(id);
  M.log(e, o.n, 'fica preparada');
};
// soulbond (CR 702.95): o.par = {id, ts, ctrl} dos dois lados. Pareadas enquanto as duas estiverem no campo, forem
// criaturas e o mesmo jogador (o que pareou) controlar as duas (702.95c/e); o turno.ts desfaz o par que quebrou (de vez).
M.parDe = (e, o) => {
  const p = o && o.zona === 'campo' && o.par; if (!p) return null;
  const q = e.objs[p.id];
  if (!q || q.zona !== 'campo' || q.ts !== p.ts || !q.par || q.par.id !== o.id || q.par.ts !== o.ts) return null;
  if (o.ctrl !== p.ctrl || q.ctrl !== p.ctrl || !M.temTipo(e, o, 'Creature') || !M.temTipo(e, q, 'Creature')) return null;
  return q;
};
M.parear = (e, a, b) => { a.par = { id: b.id, ts: b.ts, ctrl: a.ctrl }; b.par = { id: a.id, ts: a.ts, ctrl: a.ctrl }; e.vCamada = (e.vCamada || 0) + 1; M.log(e, a.n, 'pareada com', b.n); };
M.prepValida = (e, c) => { const o = c && c.copiaPrep && e.objs[c.copiaPrep.id]; return !!o && o.zona === 'campo' && o.ts === c.copiaPrep.ts && !!o.preparada; };
const GAT_MILAGRE = { ev: 'compra', fx: [{ op: 'milagre' }] };
M.milagreDe = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'milagre' && x.custo); return k ? k.custo : null; };

// comprar (CR 121; grimório vazio → perde nas ABE, CR 704.5b)
// Quantas compras de fato (CR 614.1a/614.5: "if you would draw a card, draw two instead", Bard, King of Dale) vale uma vez
// por compra; naoPrimeira: fora a 1ª da sua etapa de compra (504.1). As compras a mais não são substituídas de novo.
// Não mexe no estado (o processo com perguntas roda de novo): prim diz se a 1ª da etapa foi usada agora.
const contarCompras = (e, j, qtd) => {
  const J = e.jogs[j];
  let brutas = 0, usou = false;
  for (let i = 0; i < qtd; i++) {
    const prim = !usou && e.turno.passo === 'compra' && e.turno.ativo === j && J.primPasso !== e.turno.n;
    if (prim) usou = true;
    let mult = 1;
    if (e.turno.passo !== 'mulligan') for (const id of indice(e).sb) {
      const F = e.objs[id];
      for (const sb of M.dadoDe(e, F).subst || []) {
        if (sb.ev !== 'compra' || !sb.muda || !Number.isInteger(sb.muda.mult)) continue;
        if (sb.jog === 'voce' ? j !== F.ctrl : sb.jog === 'oponente' ? j === F.ctrl : sb.jog !== undefined && sb.jog !== 'qualquer') continue;
        if (sb.naoPrimeira && prim) continue;
        mult *= sb.muda.mult;
      }
    }
    brutas += mult;
  }
  return { brutas, usou };
};

// dragar (CR 702.52a): "se você fosse comprar uma carta, pode moer N cartas e devolver esta carta do cemitério à mão";
// 702.52b: não dá com menos de N cartas no grimório. Cada compra (já multiplicada) é uma pergunta 'dragar'
// ([comprar, dragar X…]). M.planoDragar pergunta TODAS antes de mexer no estado (regra do processo, pilha.ts): simula o
// grimório e o cemitério (a carta com dragar moída agora pode dragar na compra seguinte). Sem ask (mulligan, presente,
// masmorra): compra normal. Na execução a escolha é conferida de novo (moeu menos/outra zona: compra).
M.dragarDe = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'dragar' && Number.isInteger(x.n) && x.n > 0); return k ? k.n : 0; };
M.temDragar = (e, j) => e.jogs[j].zonas.cemiterio.some(id => M.dragarDe(e, e.objs[id]) > 0);
M.planoDragar = (e, j, brutas, ask) => {
  if (!ask || !brutas || e.turno.passo === 'mulligan' || !M.temDragar(e, j)) return null;
  const J = e.jogs[j], g = J.zonas.grimorio, cem = J.zonas.cemiterio.filter(id => M.dragarDe(e, e.objs[id]) > 0), esc: any[] = [];
  let topo = g.length;                                              // g[topo-1] = a carta de cima que sobra na simulação
  for (let i = 0; i < brutas; i++) {
    const ops: any[] = [{ a: 'comprar' }];
    for (const id of cem) { const n = M.dragarDe(e, e.objs[id]); if (n <= topo) ops.push({ a: 'dragar', id, n }); }
    const r = ops.length > 1 ? ask(j, 'dragar', ops, { i }) : ops[0];
    if (r.a !== 'dragar') { esc.push(null); if (topo > 0) topo--; continue; }
    esc.push(r.id); cem.splice(cem.indexOf(r.id), 1);
    for (let k = 0; k < r.n; k++) { const id = g[topo - 1 - k]; if (M.dragarDe(e, e.objs[id]) > 0) cem.push(id); }
    topo -= r.n;
  }
  return esc;
};
M.planoCompra = (e, j, qtd, ask) => M.planoDragar(e, j, contarCompras(e, j, qtd).brutas, ask);

// opc.plano (M.planoCompra) ou opc.ask (pergunta aqui; opc.antes() roda depois das perguntas, antes de mexer: e.proc = null)
M.comprar = (e, j, qtd = 1, opc: any = {}) => {
  const J = e.jogs[j];
  const { brutas, usou } = contarCompras(e, j, qtd);
  const plano = opc.plano !== undefined ? opc.plano : M.planoDragar(e, j, brutas, opc.ask);
  if (opc.antes) opc.antes();
  if (usou) J.primPasso = e.turno.n;
  for (let i = 0; i < brutas; i++) {
    const g = J.zonas.grimorio, dr = plano && plano[i] !== null && plano[i] !== undefined ? e.objs[plano[i]] : null;
    if (dr && dr.zona === 'cemiterio' && dr.dono === j && M.dragarDe(e, dr) > 0 && g.length >= M.dragarDe(e, dr)) {   // 702.52a/b
      const n = M.dragarDe(e, dr);
      M.log(e, J.nome, 'draga', dr.n, '(moe ' + n + ')');
      M.EFEITOS.moer.fx(e, { op: 'moer', quem: 'voce', qtd: n }, { voce: j, este: dr.id });
      if (dr.zona === 'cemiterio') M.mover(e, dr.id, 'mao');       // não é compra: não dispara 'compra' (702.52a)
      continue;
    }
    if (!g.length) { J.comprouVazio = true; continue; }
    const id = g[g.length - 1];
    M.mover(e, id, 'mao');
    J.compT = { t: e.turno.n, n: (J.compT && J.compT.t === e.turno.n ? J.compT.n : 0) + 1 };
    // milagre (702.94): a primeira compra do turno com milagre é revelada (simplificação: sempre) e o gatilho vai para a pilha
    if (J.compT.n === 1 && e.pend && e.turno.passo !== 'mulligan' && M.milagreDe(e, e.objs[id])) { const o = e.objs[id]; e.pend.push({ fonte: id, ts: o.ts, ctrl: j, k: 'milagre', g: GAT_MILAGRE, n: o.n, face: null, ficha: null, lki: M.lkiDe(e, o), ev: { ev: 'compra', j } }); M.log(e, J.nome, 'revela', o.n, '(milagre)'); }
    // a 1ª compra na própria etapa de compra (Xyris: "except the first one they draw in each of their draw steps", 504.1)
    const etapa = e.turno.passo === 'compra' && e.turno.ativo === j;
    if (etapa) J.compEt = { t: e.turno.n, n: (J.compEt && J.compEt.t === e.turno.n ? J.compEt.n : 0) + 1 };
    if (M.evento) M.evento(e, { ev: 'compra', j, ...(etapa && J.compEt.n === 1 ? { primeiraEtapa: true } : {}) });
  }
};
M.vivos = e => e.jogs.filter(j => !j.saiu).map(j => j.i);

// ---------- controle (CR 613.1b, camada 2; 800.4) ----------
// e.ctrlEf: [{id, ts, j, fim}] na ordem em que foram criados (o mais novo vale, 613.7). fim: 'turno' (sai na limpeza),
// 'nunca' ou {id, ts, j} = "enquanto você controlar [a fonte]". o.ctrl0 = quem controlava antes do primeiro efeito
// (o mover zera). Mudou de controlador: enjoo (302.6) e sai do combate (506.4).
M.recalcCtrl = e => {
  for (let volta = 0; volta < 4 && e.ctrlEf; volta++) {
    const vivo = c => { const o = e.objs[c.id]; if (!o || o.ts !== c.ts || o.zona !== 'campo') return false;
      if (c.fim && typeof c.fim === 'object') { const F = e.objs[c.fim.id]; if (!F || F.ts !== c.fim.ts || F.zona !== 'campo' || F.ctrl !== c.fim.j) return false; }
      return true; };
    const antes = e.ctrlEf, ids = e.campo.filter(id => e.objs[id].ctrl0 !== undefined);   // quem já trocou de controlador (o efeito pode ter saído antes)
    e.ctrlEf = antes.filter(vivo);
    let mudou = false;
    for (const id of ids) {
      const o = e.objs[id]; if (!o || o.zona !== 'campo' || o.ctrl0 === undefined) continue;
      const ult = e.ctrlEf.filter(c => c.id === id && c.ts === o.ts).pop(), novo = ult ? ult.j : o.ctrl0;
      if (novo === o.ctrl || e.jogs[novo].saiu) continue;
      o.ctrl = novo; o.doente = true; mudou = true;
      const C = e.turno.combate;
      if (C) { C.atk = C.atk.filter(a => a.id !== id); for (const a of C.atk) if (a.bloq) a.bloq = a.bloq.filter(b => b.id !== id); }
      M.log(e, e.jogs[novo].nome, 'ganha o controle de', o.n);
    }
    if (!mudou && e.ctrlEf.length === antes.length) break;
    e.vCamada = (e.vCamada || 0) + 1; if (M.memo) M.memo = {};
  }
};
// ---- leitura de cartas ----
M.temTipo = (e, o, t) => (M.dadoDe(e, o).tipos || []).includes(t);
M.ehPermanente = (e, o) => ['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].some(t => M.temTipo(e, o, t));
// est ptDefinido (CDA, CR 604.3 e camada 7a): P/R '*' definido por uma contagem; vale em todas as zonas (Beanstalk Giant,
// Adeline, Psychosis Crawler). Quem conta é o controlador (fora do campo, o dono).
const ptCda = (e, o, i) => {
  const s = (M.dadoDe(e, o).est || []).find(x => x.modo === 'ptDefinido' && x.afeta === 'este' && x[i ? 'rBase' : 'pBase'] !== undefined);
  if (!s) return null;
  const q = s[i ? 'rBase' : 'pBase'], voce = o.ctrl ?? o.dono;
  return M.qtd(e, q, { voce, este: o.id });
};
M.ptCda = ptCda;
// P/R (CR 613.4): 7a base ou CDA, 7c somas das camadas (estáticas 'continuo' e 'modificar' até o fim do turno), 7d marcadores.
// A CDA vale mesmo com P/R numérico no dado: a ficha do banco escreve pt [0,0] + est ptDefinido (Gnome Soldier, token.est).
// 7b: P/R base fixado até o fim do turno (efeitoTemporario ptDefinido, Sephiroth) vence a 7a (camadas().base).
M.resistencia = (e, o) => {
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const C: any = camadas(e, o);
  const b = C.base ? C.base[1] : ptCda(e, o, 1) ?? (typeof pt[1] === 'number' ? pt[1] : 0);
  return b + C.r + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
};
M.poder = (e, o) => {
  const pt = M.dadoDe(e, o).pt; if (!pt) return 0;
  const C: any = camadas(e, o);
  const b = C.base ? C.base[0] : ptCda(e, o, 0) ?? (typeof pt[0] === 'number' ? pt[0] : 0);
  return b + C.p + (o.marc['+1/+1'] || 0) - (o.marc['-1/-1'] || 0);
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
const CONT_OK = new Set(['modo', 'afeta', 'p', 'r', 'kw', 'se', 'habil', 'cores', 'tiraKw', 'tiraTudo']);   // tiraTudo: "perdem todas as habilidades" (Poppet Factory, 613.1f; lido no M.dadoDe)   // tiraKw: "e perde voar" (Colossus Hammer, 613.1f)
const TIPOS_CARTA = new Set(['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle']);
// tipo/sub dado a 'este' (camada 4): lido no M.dadoDe; com filtro (Ashaya, Bello, Dryad, Leyline) ainda não
M.estTipoOk = s => !!s && s.modo === 'continuo' && s.afeta === 'este' && (s.tipo || s.sub || s.tiraTipo) && Object.keys(s).every(k => ['modo', 'afeta', 'tipo', 'sub', 'tiraTipo', 'se'].includes(k))
  && (s.tiraTipo === undefined || (Array.isArray(s.tiraTipo) && s.tiraTipo.every(t => TIPOS_CARTA.has(t))))
  && (s.tipo || []).every(t => TIPOS_CARTA.has(t)) && (s.sub || []).every(x => typeof x === 'string') && (!s.se || M.seOk(s.se));
// contagens da estática (sem evento/alvo): M.contaOk(c, 'est') em contagem.ts — antes CONTA_EST + PROP_EST
const qtdEstOk = q0 => { const q = M.qn(q0); return q === undefined || typeof q === 'number'
  || (!!q && typeof q === 'object' && Object.keys(q).every(k => ['conta', 'mult', 'soma'].includes(k)) && M.contaOk(q.conta, 'est')); };
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
  && Object.keys(s).every(k => CONT_OK.has(k) || k === 'tipo' || k === 'sub' || k === 'trocaSub' || k.startsWith('_')) && (!s.se || M.seOk(s.se));
// tipo/sub/P-R base dados a quem bate um filtro (Bello, Bard of the Brambles): a parte de tipo e P/R no M.dadoDe
// (camadas 4 e 7b), a de kw/habil nas camadas. Subtipo de terreno básico fica de fora (como na equipada).
const estAnimFiltroOk = s => s.modo === 'continuo' && estTipoFiltro(s) && M.filtroOk(s.afeta)
  && (s.tipo || []).every(t => TIPOS_CARTA.has(t)) && !(s.sub || []).some(x => x === 'escolhido' || TERRA_BASICA.has(x))
  && (s.pt === undefined || s.pt === 'vm' || (Array.isArray(s.pt) && s.pt.length === 2 && s.pt.every(n => Number.isInteger(n))))
  && Object.keys(s).every(k => CONT_OK.has(k) || k === 'tipo' || k === 'sub' || k === 'pt' || k.startsWith('_')) && (!s.se || M.seOk(s.se))
M.estTipoFiltroOk = s => !!s && s.modo === 'continuo' && !!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta) && !!(s.tipo || s.sub)
  && Object.keys(s).every(k => ['modo', 'afeta', 'tipo', 'sub', 'se'].includes(k)) && (s.tipo || []).every(t => TIPOS_CARTA.has(t))
  && !(s.sub || []).includes('escolhido') && (!s.se || M.seOk(s.se));
const SEM_TIPO = new WeakMap<object, any>();
const semTipo = s => { let r = SEM_TIPO.get(s); if (!r) { const { tipo, sub, trocaSub, ...x } = s; SEM_TIPO.set(s, (r = x)); } return r; };
const soTipo = s => { const r: any = { modo: s.modo, afeta: s.afeta }; for (const k of ['tipo', 'sub', 'se']) if (s[k] !== undefined) r[k] = s[k]; return r; };
M.estContOk = s => M.estTipoOk(s) || M.estTipoFiltroOk(s) || (!!s && estTipoFiltro(s) && estAnimFiltroOk(s))
  || (!!s && s.afeta === 'este' && !!(s.tipo || s.sub) && (s.p !== undefined || s.r !== undefined || (s.kw || []).length > 0 || s.habil !== undefined) && M.estTipoOk(soTipo(s)) && contOk(semTipo(s))) || (!!s && s.afeta === 'equipada' && !!(s.tipo || s.sub)
  ? M.estTipoEquipOk(s) && (!(s.p !== undefined || s.r !== undefined || (s.kw || []).length || s.habil) || contOk(semTipo(s)))
  : contOk(s));
const contOk = s => !!s && s.modo === 'continuo' && Object.keys(s).every(k => CONT_OK.has(k) || k.startsWith('_'))
  && (s.afeta === 'este' || s.afeta === 'equipada' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && qtdEstOk(s.p) && qtdEstOk(s.r) && M.kwListaOk(s.kw) && M.kwListaOk(s.tiraKw) && habilOk(s.habil)
  && (s.p !== undefined || s.r !== undefined || (s.kw || []).length > 0 || (s.tiraKw || []).length > 0 || s.habil !== undefined || s.cores !== undefined || s.tiraTudo === true)
  && (s.tiraTudo === undefined || s.tiraTudo === true)
  && (s.cores === undefined || (typeof s.cores === 'string' && /^[WUBRG]*$/.test(s.cores)))
  && (!s.se || M.seOk(s.se));
const NADA = { p: 0, r: 0, kw: [] as any[], gat: [] as any[], atv: [] as any[] };
let lendoCamada = 0;
// Índice do campo (por partida): quem tem gatilho (dadoDe.gat) e quem tem estática (dadoDe.est), na ordem do campo.
// O mover e o criarFicha avisam quem entra e sai (M.campoEntra/M.campoSai); e.vCamada (transformar, trocar de
// controle, anexar) ou o tamanho do campo fora do esperado refazem tudo. Antes a chave era e.ts: cada ficha nova
// refazia a varredura, e com milhares de Goblins do Krenko cada evento era O(campo) — O(n²) na partida.
type Idx = { v: number; n: number; gat: number[]; est: number[]; sb: number[]; tp: number[]; tf: number[]; cor: number[]; ph: number[]; l: [any, any][] | null; hab: boolean };
const IDX = new WeakMap<any, Idx>();
function indice(e): Idx {
  let I = IDX.get(e);
  if (I && I.v === (e.vCamada || 0) && I.n === e.campo.length) return I;
  I = { v: e.vCamada || 0, n: e.campo.length, gat: [], est: [], sb: [], tp: [], tf: [], cor: [], ph: [], l: null, hab: false };
  lendoTipo++;   // o dadoDe daqui não lê o tipo dado pela equipada (é o próprio índice que ele usa)
  try { for (const id of e.campo) { const o = e.objs[id], d = M.dadoDe(e, o); if (d.gat || (o.ganhos && (o.ganhos.gat || o.ganhos.gatS)) || M.ehPortador(e, o)) I.gat.push(id); if (d.est) I.est.push(id); if (d.subst) I.sb.push(id); if (tipoEquip(d).length) I.tp.push(id); if (tipoFiltro(d).length) I.tf.push(id); if (corEst(d).length) I.cor.push(id); if (temPerde(d)) I.ph.push(id); } }
  finally { lendoTipo--; }
  IDX.set(e, I);
  return I;
}
M.indiceCampo = indice;
/** chamados depois de o id entrar em / sair de e.campo (o objeto já com a face nova) */
// quem entrou no campo neste turno, como era ao entrar (\"if another Human entered the battlefield under your control this turn\":
// Éowyn, Shieldmaiden — vale mesmo se já saiu). Zera na virada do turno (turno.ts).
M.registraEntrada = (e, o) => { const T = e.turno; if (!T.entraram || T.entraram.t !== T.n) T.entraram = { t: T.n, l: [] }; T.entraram.l.push({ ...o, marc: { ...o.marc } }); };
M.campoEntra = (e, id) => {
  const I = IDX.get(e); if (!I) return;
  if (I.v !== (e.vCamada || 0) || I.n + 1 !== e.campo.length) { IDX.delete(e); return; }
  let d; lendoTipo++; try { d = M.dadoDe(e, e.objs[id]); } finally { lendoTipo--; }
  if (tipoEquip(d).length || tipoFiltro(d).length || corEst(d).length || temPerde(d)) { IDX.delete(e); return; }   // raro (Equipamento que dá tipo): refaz tudo, a equipada pode mudar de tipo
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
  k = I.tf.indexOf(id); if (k >= 0) I.tf.splice(k, 1);
  k = I.ph.indexOf(id); if (k >= 0) I.ph.splice(k, 1);
};
// ganho de vida (CR 119.3) com as substituições 'ganhaVida' do campo (CR 614.1a): Angel of Vitality/Bilbo (soma),
// The Wind Crystal (mult). Cada uma vale uma vez por evento (616.5); a ordem é de quem ganha (616.1): somas antes
// dos dobros, que é a que dá mais. jog: de quem é o ganho, visto do controlador da fonte. Devolve o que ganhou.
// "your opponents can't gain life" (est naoGanhaVida afeta cadaOponente: Archfiend of Despair; afeta voce: o próprio)
M.semGanhoVida = (e, j) => indice(e).est.some(id => { const F = e.objs[id]; return (M.dadoDe(e, F).est || []).some(s => s.modo === 'naoGanhaVida' && (s.afeta === 'cadaOponente' ? F.ctrl !== j : s.afeta === 'voce' ? F.ctrl === j : s.afeta === 'cadaJogador')); });
M.ganharVida = (e, j, q) => {
  if (!(q > 0) || e.jogs[j].saiu || M.vidaFixa(e, j) || M.semGanhoVida(e, j)) return 0;
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
  { const J = e.jogs[j]; if (q > 0) J.vgT = { t: e.turno.n, n: (J.vgT && J.vgT.t === e.turno.n ? J.vgT.n : 0) + q }; }   // "life you gained this turn"
  M.evento(e, { ev: 'ganhaVida', j, q });
  return q;
};
// perda de vida (CR 119.3): dano em jogador (120.3a), perder vida (119.7) e pagar vida (119.4: quem paga perde) passam
// por aqui e soltam o evento 'perdeVida' (Mindcrank, Exquisite Blood, Vilis). Quem chama já olhou a vida fixa (119.8).
M.perderVida = (e, j, q) => {
  if (!(q > 0)) return 0;
  const J = e.jogs[j]; J.vida -= q;
  J.perdT = { t: e.turno.n, n: (J.perdT && J.perdT.t === e.turno.n ? J.perdT.n : 0) + q };   // "the life that player lost this turn"
  M.evento(e, { ev: 'perdeVida', j, q });
  M.subirVelocidade(e, j);
  return q;
};
// est ptDefinido com filtro e números (camada 7b, 613.4b): "fichas de criatura suas têm P/R base 3/3" (Poppet Factory)
const ptFiltroOk = s => s.modo === 'ptDefinido' && !!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta) && Number.isInteger(s.pBase) && Number.isInteger(s.rBase) && Object.keys(s).every(k => ['modo', 'afeta', 'pBase', 'rBase', 'se'].includes(k));
// velocidade (CR 702.179d): o jogador com velocidade tem "sempre que um ou mais oponentes perdem vida durante o seu turno,
// se sua velocidade for menor que 4, ela sobe 1; só dispara uma vez por turno". Sobe na hora (gatilho sem fonte; sem pilha:
// simplificação). Nada tira a velocidade quando a permanente sai; "Max speed" = velocidade 4 (702.179e, 702.178a: 'maxspeed').
M.subirVelocidade = (e, j) => {
  const a = e.turno && e.turno.ativo, P = e.jogs[a];
  if (a === undefined || a === j || !P || !P.vel || P.vel >= 4 || P.velT === e.turno.n) return;
  P.velT = e.turno.n; P.vel++; M.log(e, P.nome, 'velocidade', P.vel);
};
// Start your engines! (702.179a): quem controla uma permanente com ela e não tem velocidade passa a ter 1 (é ABE, 704)
M.ligarMotores = e => {
  for (const J of e.jogs) if (!J.saiu && !J.vel && e.campo.some(id => e.objs[id].ctrl === J.i && M.temKw(e, e.objs[id], 'ligarMotores'))) { J.vel = 1; M.log(e, J.nome, 'velocidade', 1); }
};
// quem no campo tem estática 'continuo' lida (sem isso, cada leitura de P/R ou palavra-chave varria o campo inteiro)
function fontesCont(e): Idx & { l: [any, any][] } {
  const I = indice(e);
  if (I.l) return I as Idx & { l: [any, any][] };
  const l: [any, any][] = [];
  lendoTipo++;   // as estáticas de quem perdeu tudo ficam na lista (a perda é conferida a cada leitura, camadas)
  try { for (const id of I.est) for (const s of M.dadoDe(e, e.objs[id]).est || []) if (s.modo === 'continuo' && M.estContOk(s) && !M.estTipoFiltroOk(s) || ptFiltroOk(s)) l.push([id, s]); } finally { lendoTipo--; }   // tipo com filtro: no dadoDe
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
const SOMA_T = new WeakMap<any[], { n: number; m: Map<string, { p: number; r: number; kw: any[]; kts: number[]; base?: number[] }> }>();
function somaTemp(temp: any[]) {
  let I = SOMA_T.get(temp);
  if (!I || I.n > temp.length) SOMA_T.set(temp, I = { n: 0, m: new Map() });
  for (; I.n < temp.length; I.n++) {
    const t = temp[I.n];
    for (const x of t.ids) {
      const k = x.id + ':' + x.ts; let v = I.m.get(k); if (!v) I.m.set(k, v = { p: 0, r: 0, kw: [], kts: [] });
      v.p += t.p || 0; v.r += t.r || 0; for (const w of t.kw || []) { v.kw.push(w); v.kts.push(t.ts || 0); }
      if (t.base) v.base = t.base;   // 7b: o mais novo vale (613.7, ordem de ts = ordem do e.temp)
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
// conta de 'cada' (o objeto afetado: Moraug) muda por objeto: a chave do lote leva o afetado
const porObj = q => { const c = q && typeof q === 'object' && M.qn(q).conta; return !!c && c.de === 'cada'; };
function qtdCamada(e, s, q, F, ctx, o) {
  if (porObj(q)) ctx = { ...ctx, cadaObj: { id: o.id, ts: o.ts } };
  if (!LOTE || typeof q === 'number') return M.qtdEst(e, q, ctx);
  let m = LOTE.get(q); if (!m) LOTE.set(q, m = new Map());
  const k = F.id + ':' + F.ts + ':' + F.ctrl + (ctx.cadaObj ? ':' + o.id + ':' + o.ts : '');
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
  if (e.efTemp && e.efTemp.length) for (const t of e.efTemp) for (const s of t.est) if (s.modo === 'continuo') {   // emblema / "neste turno" (114.4, 611.2): a fonte é o efeito
    if (fontes === FC.l) fontes = fontes.slice();
    fontes.push([t._F || (t._F = { id: -1, ctrl: t.ctrl, ts: t.ts, n: t.n }), s]);
  }
  if (lote && lote.length) { fontes = fontes.slice(); for (const S of lote) for (const s of M.dadoDe(e, S).est || []) if (s.modo === 'continuo' && M.estContOk(s)) fontes.push([S, s]); }
  if (!fontes.length && !temp.length) return NADA;
  lendoCamada++;
  try {
    let p = 0, r = 0, base: number[] | undefined; const kw: any[] = [], gat: any[] = [], atv: any[] = [], tira: string[] = [];
    const P = FC.ph.length || o.anim ? perdeTs(e, o, FC) : 0;   // perdeu tudo (613.1f): o dado antes disso não vale (613.7)
    for (const [x, s] of fontes) {
      const F = typeof x === 'object' ? x : e.objs[x];
      if (s.tiraTudo) continue;
      if (typeof x !== 'object' && F.zona === 'campo' && (FC.ph.length || F.anim) && perdeTs(e, F, FC)) continue;   // a fonte perdeu as próprias estáticas
      const ctx = { voce: F.ctrl, este: F.id };
      if (!afeta(e, F, s, o, ctx)) continue;
      if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } if (!ok) continue; }
      if (s.modo === 'ptDefinido') { base = [s.pBase, s.rBase]; continue; }   // 7b: em ordem de campo, o mais novo vale (613.7)
      if (s.p !== undefined) p += qtdCamada(e, s, s.p, F, ctx, o);
      if (s.r !== undefined) r += qtdCamada(e, s, s.r, F, ctx, o);
      if (P && (F.ts || 0) < P) continue;   // camada 6 mais velha que a perda
      for (const x of s.kw || []) { if (x.de !== 'escolhido') { kw.push(x); continue; } const v = F.escolha && (F.escolha.tipoCarta || F.escolha.cor); if (v) kw.push(kwEscolhido(x, v)); }   // "protection from the chosen card type/color" (Serra's Emissary): o que a fonte escolheu ao entrar
      for (const x of s.tiraKw || []) tira.push(x.k);
      if (s.habil) { for (const g of s.habil.gat || []) gat.push(g); for (const a of s.habil.atv || []) atv.push(a); }
    }
    const T = temp.length ? somaTemp(temp).get(o.id + ':' + o.ts) : undefined;
    if (T) { p += T.p; r += T.r; T.kw.forEach((x, k) => { if (!P || T.kts[k] >= P) kw.push(x); }); }
    return { p, r, kw, gat, atv, ...(tira.length ? { tira } : {}), ...(T && T.base ? { base: T.base } : base ? { base } : {}) };   // o de resolução (Sephiroth) é o mais novo
  } finally { lendoCamada--; }
}
M.camadas = camadas;
const magiasT = (e, ctx) => { const j = ctx.ev && ctx.ev.ev === 'conjura' ? ctx.ev.j : ctx.voce, C = e.jogs[j] && e.jogs[j].conjT; return C && C.t === e.turno.n ? C.n : 0; };   // de quem conjurou (gatilho de conjura) ou de você
M.magiasT = magiasT;
// cores entre os objetos (CR 105.2: incolor não é cor)
M.coresEntre = (e, os) => CORES.filter(c => os.some(o => (M.dadoDe(e, o).cores || '').includes(c)));
M.qtdEst = (e, q0, ctx) => {
  const q = M.qn(q0);
  if (typeof q === 'number') return q;
  return M.contaOk(q.conta, 'efeito') ? M.qtdConta(e, q, ctx) : (q.soma || 0);
};
/** palavras-chave do objeto: as da carta (ou face/ficha) e as dadas pelas camadas (CR 613.1f) */
// CR 122.1b: marcador de palavra-chave dá a palavra-chave (Luminous Broodmoth põe "flying"; sem isso a que voltou voltava de novo)
const MARC_KW = { flying: 'voar', 'first strike': 'primeiroAtaque', 'double strike': 'golpeDuplo', deathtouch: 'toqueMortifero', haste: 'pressa', hexproof: 'antimagia',
  indestructible: 'indestrutivel', lifelink: 'vinculoVida', menace: 'ameaca', reach: 'alcance', trample: 'atropelar', vigilance: 'vigilancia' };
M.MARC_KW = MARC_KW;
M.kwDe = (e, o) => {
  let b = M.dadoDe(e, o).kw || []; const C = camadas(e, o), c = C.kw;
  if (c.length) b = b.concat(c);
  if ((C as any).tira) b = b.filter(x => !(C as any).tira.includes(x.k));   // perde (613.1f; simplificação: também a ganha depois, como o tiraKw do animar)
  if (o.zona === 'campo' && o.marc && !perdeu(e, o)) for (const m in o.marc) if (o.marc[m] > 0 && MARC_KW[m]) b = b.concat([{ k: MARC_KW[m] }]);   // perdeu tudo: o marcador ficou, a palavra-chave não (simplificação: marcador posto antes)
  // "perde antimagia e indestrutível até o fim do turno" (Shadowspear, 613.1f): o.anim.tiraKw. Simplificação: tira também a
  // palavra-chave ganha depois (613.7 diria que a mais nova vale)
  if (o.anim && o.zona === 'campo') for (const a of o.anim) if (a.ts === o.ts && a.tiraKw) b = b.filter(x => !a.tiraKw.includes(x.k));
  return b;
};
// "cada card de Sliver na sua mão tem ciclo de Sliver {3}" (Homing Sliver): as camadas só olham o campo, então a
// palavra-chave de ciclo dada à mão (afeta.zona 'mao') vira a ativada aqui, só para os cards do controlador da fonte
const cicloNaMao = (e, o) => {
  const r: any[] = [];
  for (const [id, s] of fontesCont(e).l) {
    if (!s.afeta || typeof s.afeta !== 'object' || s.afeta.zona !== 'mao' || !(s.kw || []).some(ehCiclo)) continue;
    const F = e.objs[id]; if (!F || F.ctrl !== o.dono || !M.bate(e, o, s.afeta, { voce: F.ctrl, este: id })) continue;
    for (const x of s.kw) if (ehCiclo(x)) r.push(cicloDe(x));
  }
  return r;
};
/** habilidades ativadas: as da carta, as de equipar (palavra-chave) e as dadas pelas camadas, nessa ordem (k estável) */
const ATV_CARTA = new WeakMap<object, any[]>();   // atv da carta + equipar, por dado (não muda na partida)
// ciclar N (CR 702.29a): "[custo], descarte esta carta: compre um card", ativada da mão. O descarte dispara 'descarta'.
const CICLAR = new WeakMap<object, any>();
const ciclarDe = kw => {
  let a = CICLAR.get(kw);
  if (!a) CICLAR.set(kw, (a = { custo: { mana: kw.custo || {}, descartarEste: true }, zona: 'mao', _ciclar: true, fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }] }));
  return a;
};
// ciclo de tipo (CR 702.29e/f): "[custo], descarte esta carta: procure no grimório um card [tipo], revele, ponha na mão,
// embaralhe". É ciclar (dispara 'cicla'). tipo é tipo de card (Creature…) ou subtipo (Plains, Wizard, Sliver).
const TIPO_DE_CARD = new Set(['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle', 'Instant', 'Sorcery']);
const cicloTipoDe = kw => {
  let a = CICLAR.get(kw);
  if (!a) CICLAR.set(kw, (a = { custo: { mana: kw.custo || {}, descartarEste: true }, zona: 'mao', _ciclar: true,
    fx: [{ op: 'buscar', f: TIPO_DE_CARD.has(kw.tipo) ? { tipo: [kw.tipo] } : kw.tipo === 'Basic' ? { tipo: ['Land'], super: ['Basic'] } : { sub: [kw.tipo] }, qtd: 1, para: 'mao', revelar: true }, { op: 'embaralhar', quem: 'voce' }] }));
  return a;
};
// tripular N (CR 702.122a): "vire criaturas desviradas que você controla com poder total N ou mais: este Veículo vira
// criatura artefato até o fim do turno" (velocidade de instantâneo)
const TRIP = new WeakMap<object, any>();
const tripularDe = kw => {
  let a = TRIP.get(kw);
  if (!a) TRIP.set(kw, (a = { custo: { virarOutros: { f: { tipo: ['Creature'] }, poder: kw.n } }, _tripular: true, fx: [{ op: 'animar', em: 'este', tipos: ['Artifact', 'Creature'], dura: 'fimDoTurno' }] }));
  return a;
};
// selar N (CR 702.171a): "vire outras criaturas desviradas suas com poder total N ou mais: esta Montaria fica selada até o
// fim do turno. Só como feitiço." (o.selada {ts, t}: mudou de zona ou passou o turno, não está mais)
const SELA = new WeakMap<object, any>();
const selarDe = kw => {
  let a = SELA.get(kw);
  if (!a) SELA.set(kw, (a = { custo: { virarOutros: { f: { tipo: ['Creature'] }, poder: kw.n } }, vel: 'feitico', _selar: true, fx: [{ op: 'selar' }] }));
  return a;
};
// estação (CR 702.184a): "vire outra criatura desvirada sua: ponha neste marcadores de carga iguais ao poder da virada.
// Só como feitiço." Os símbolos 'N+' (722.2a: com N ou mais marcadores de carga, tem as habilidades) são atv/est com
// se {conta: {q: {conta: {de:'este', o:'marcadores', marc:'charge'}}, min: N}}; 'N+' com P/R (722.2b, Spacecraft) ainda não.
const ESTACAO = { custo: { virarOutros: { f: { tipo: ['Creature'] }, qtd: 1 } }, vel: 'feitico', _estacao: true,
  fx: [{ op: 'marcador', em: 'este', tipoMarc: 'charge', qtd: { conta: { de: 'viradas', o: 'poder', junta: 'soma' } } }] };
M.selada = (e, o) => !!o.selada && o.selada.ts === o.ts && o.selada.t === e.turno.n && o.zona === 'campo';
// eternizar (CR 702.129a): "[custo], exile esta carta do cemitério: crie uma ficha cópia dela, exceto que é uma Zombie
// 4/4 preta além dos outros tipos e não tem custo de mana. Ative só como feitiço."
const ETERN = new WeakMap<object, any>();
const eternizarDe = kw => {
  let a = ETERN.get(kw);
  if (!a) ETERN.set(kw, (a = { custo: { mana: kw.custo || {}, exilarEste: true }, zona: 'cemiterio', vel: 'feitico', _eternizar: true,
    fx: [{ op: 'ficha', quem: 'voce', qtd: 1, token: { copiaDe: 'este', pt: [4, 4], cores: 'B', maisSub: ['Zombie'], semCusto: true } }] }));
  return a;
};
const ehCiclo = x => (x.k === 'ciclar' && x.custo && Object.keys(x).length === 2) || (x.k === 'cicloTipo' && x.custo && typeof x.tipo === 'string' && Object.keys(x).length === 3);
const cicloDe = x => x.k === 'ciclar' ? ciclarDe(x) : cicloTipoDe(x);
// subir de nível (CR 716.2a): "[custo]: Nível N" — ativada como feitiço, só com a Classe no nível N−1 (pilha.ts podeAtivar)
const SUBIR = new WeakMap<object, any>();
const subirDe = l => {
  let a = SUBIR.get(l);
  if (!a) SUBIR.set(l, (a = { custo: { mana: l.custo || {} }, vel: 'feitico', _nivel: l.n, fx: [{ op: 'subirNivel', n: l.n }] }));
  return a;
};
// reconfigurar (702.151a): "[custo]: anexe a uma criatura alvo sua (outra)" e "[custo]: solte; só se anexada" — como feitiço
// atacante não bloqueado (509.1h): só existe depois da declaração de bloqueadores, até o fim do combate
M.naoBloqueada = (e, o) => {
  const C = e.turno.combate, p = e.turno.passo;
  if (!C || (p !== 'bloqueadores' && p !== 'dano')) return false;
  return C.atk.some(a => a.id === o.id && a.ts === o.ts && !a.bloqueado);
};
// ninjutsu (702.49a): "[custo], devolva à mão um atacante seu não bloqueado: ponha esta carta da mão no campo virada e atacando"
const NINJA = new WeakMap<object, any>();
const ninjutsuDe = kw => {
  let a = NINJA.get(kw);
  if (!a) NINJA.set(kw, (a = { zona: 'mao', custo: { mana: kw.custo || {}, devolver: { f: { tipo: ['Creature'], naoBloqueada: true } } }, _ninjutsu: true, fx: [{ op: 'ninjutsu' }] }));
  return a;
};
// bis (CR 702.141a): "[custo], exile esta carta do seu cemitério: para cada oponente, uma ficha cópia que ataca esse
// oponente neste turno se puder; ganham ímpeto; sacrifique-as no começo da próxima etapa final" — só como feitiço
const BIS = new WeakMap<object, any>();
const bisDe = kw => {
  let a = BIS.get(kw);
  if (!a) BIS.set(kw, (a = { zona: 'cemiterio', custo: { mana: kw.custo || {}, exilarEste: true }, vel: 'feitico', _bis: true, fx: [{ op: 'bis' }] }));
  return a;
};
const RECONF = new WeakMap<object, any>();
const reconfDe = kw => {
  let a = RECONF.get(kw);
  if (!a) RECONF.set(kw, (a = [
    { custo: { mana: kw.custo || {} }, vel: 'feitico', _equipar: true, alvos: [{ f: { tipo: ['Creature'], ctrl: 'voce', outro: true, zona: 'campo' } }], fx: [{ op: 'anexar', em: 'este', a: { alvo: 0 }, reconf: true }] },
    { custo: { mana: kw.custo || {} }, vel: 'feitico', _soltar: true, fx: [{ op: 'soltar', em: 'este' }] }]));
  return a;
};
const atvCarta = d => {
  let l = ATV_CARTA.get(d);
  if (!l) {
    const rc = (d.kw || []).filter(x => x.k === 'reconfigurar' && x.custo).flatMap(reconfDe);
    const nj = (d.kw || []).filter(x => x.k === 'ninjutsu' && x.custo).map(ninjutsuDe);
    const eq = (d.kw || []).filter(x => x.k === 'equipar'), ci = (d.kw || []).filter(ehCiclo);
    const tp = [...(d.kw || []).filter(x => x.k === 'tripular' && Number.isInteger(x.n)).map(tripularDe), ...(d.kw || []).filter(x => x.k === 'eternizar' && x.custo).map(eternizarDe), ...(d.kw || []).filter(x => x.k === 'bis' && x.custo).map(bisDe), ...(d.kw || []).filter(x => x.k === 'selar' && Number.isInteger(x.n)).map(selarDe), ...(d.kw || []).filter(x => x.k === 'estacao').map(() => ESTACAO)];
    const nv = M.ehClasse(d) && Array.isArray(d.niveis) ? d.niveis.filter(x => Number.isInteger(x.n) && x.n >= 2) : [];
    ATV_CARTA.set(d, (l = eq.length || ci.length || nv.length || rc.length || nj.length || tp.length ? [...(d.atv || []), ...eq.map(equiparDe), ...ci.map(cicloDe), ...nv.map(subirDe), ...rc, ...nj, ...tp] : d.atv || NADA.atv));
  }
  return l as any[];
};
// ganhas por efeito de resolução enquanto no campo (o.ganhos.atv: Urza's Saga) vêm logo depois das da carta: só crescem, k estável
// darBis (Sliver Gravemother): "each [card] in your graveyard has encore {X}, where X is its mana value" — atv de bis com {vm}
const BIS_VM = new Map<number, any>();
const bisDado = (e, o) => {
  if (o.zona !== 'cemiterio') return null;
  for (const id of M.indiceCampo(e).est) { const F = e.objs[id]; if (F.ctrl !== o.dono) continue;
    for (const s of M.dadoDe(e, F).est || []) if (s.modo === 'darBis' && s.afeta && M.bate(e, o, { ...s.afeta, zona: 'cemiterio' }, { voce: F.ctrl, este: F.id })) {
      const vm = M.dadoDe(e, o).vm || 0; let k = BIS_VM.get(vm); if (!k) BIS_VM.set(vm, (k = { k: 'bis', custo: { g: vm } })); return bisDe(k);
    } }
  return null;
};
// Drana and Linvala (609.4b): a habilidade ganha com _qualquerCor paga cor com qualquer mana (M.custoAtv); cópia guardada (k estável)
const QQ_COR = new WeakMap<any, any>();
const qualquerCorDe = a => { let c = QQ_COR.get(a); if (!c) QQ_COR.set(a, (c = { ...a, _qualquerCor: true })); return c; };
M.atvDe = (e, o) => {
  let b = atvCarta(M.dadoDe(e, o));
  const sem = !!o.ganhos && perdeu(e, o);   // perdeu tudo: o ganho por resolução (sem timestamp) conta como mais velho
  if (o.zona === 'cemiterio') { const x = bisDado(e, o); if (x && !b.some(a => a._bis)) b = b.concat([x]); }
  if (o.ganhos && o.ganhos.atv && !sem) b = b.concat(o.ganhos.atv);
  if (o.ganhos && o.ganhos.atvT && !sem) b = b.concat(o.ganhos.atvT);   // até o fim do turno (Quicksilver Elemental)
  const h = fontesCont(e).hab ? camadas(e, o).atv : NADA.atv;
  if (o.zona === 'mao') b = b.concat(cicloNaMao(e, o));
  if (o.zona === 'campo') for (const s of M.dadoDe(e, o).est || []) if (s.modo === 'ganhaAtivadas' && s.afeta === 'este' && s.f)   // "has all activated abilities of all creatures your opponents control" (Drana and Linvala): as impressas (sem as ganhas, 613.8 sem laço)
    for (const x of M.objetosQue(e, { zona: 'campo', ...s.f }, { voce: o.ctrl, este: o.id })) if (x.id !== o.id) b = b.concat(s.qualquerCor ? atvCarta(M.dadoDe(e, x)).map(qualquerCorDe) : atvCarta(M.dadoDe(e, x)));
  return h.length ? b.concat(h) : b;
};
/** alguém no campo dá habilidade (habil)? sem isso gatDe/atvDe são só os da carta */
M.temHabil = e => fontesCont(e).hab;
/** habilidades desencadeadas: as da carta e as dadas pelas camadas; quantas são da carta = (dadoDe.gat || []).length.
 *  lote: só os que saíram do campo E dão habilidade (M.loteHabil) — o lote inteiro aqui ficava O(n²) num Blasphemous Act */
M.loteHabil = (e, lote) => (lote || []).filter(S => (M.dadoDe(e, S).est || []).some(s => s.modo === 'continuo' && s.habil));
M.gatDe = (e, o, lote?) => {
  let b = M.dadoDe(e, o).gat || [];
  const sem = (!!o.ganhos || (!!e.jogs[o.ctrl] && !!e.jogs[o.ctrl].anel)) && perdeu(e, o);   // perdeu tudo: ganhos e o Anel contam como mais velhos
  if (o.ganhos && o.ganhos.gatS && !sem) b = b.concat(o.ganhos.gatS);
  if (o.zona === 'campo' && e.jogs[o.ctrl] && e.jogs[o.ctrl].anel && !sem) { const ga = M.gatAnel(e, o); if (ga.length) b = b.concat(ga); }   // ganho sem prazo (Rivaz): antes do de fim de turno, que sai na limpeza
  if (o.ganhos && o.ganhos.gat && !sem) b = b.concat(o.ganhos.gat);   // ganho por resolução até o fim do turno (Demonic Gifts); o mover zera
  if (!fontesCont(e).hab && !(lote && lote.length)) return b;
  const h = camadas(e, o, lote).gat;
  return h.length ? b.concat(h) : b;
};

// ---- filtro RX (campos somam em E; listas dentro de um campo são OU) — o que ainda não existe falha alto ----
const FILTRO_OK = new Set(['convocou', 'comX', 'postaPorEste', 'entrouNoTurno', 'conjurada', 'atacouNoTurno', 'este', 'outro', 'ouEste', 'tipo', 'nao', 'sub', 'super', 'ctrl', 'dono', 'cor', 'zona', 'virada', 'comandante', 'ficha', 'vm', 'poder', 'atacando',
  'equipada', 'anexadoA', 'encantada', 'comEquipamento', 'nome', 'ou', 'manaGasta', 'tipoEmComum', 'tipoCartaEmComum', 'tipoTodos', 'historico', 'lembrada', 'kw', 'comMarcador', 'semMarcador', 'exiladaPorEste', 'feridaPorEsteNoTurno', 'naoBloqueada', 'modificada', 'topo', 'nomeUnico', 'maiorPoder', 'poderAcimaBase', 'resist', 'tipoCartaEmComum', 'naoAlvo', 'naoNome', 'selada', 'soMiraEste', 'semKw', 'pareadaComEste', 'miraUm']);
M.filtroOk = f => Object.keys(f || {}).every(k => FILTRO_OK.has(k)) && (!f || f.ou === undefined || (Array.isArray(f.ou) && f.ou.length > 1 && f.ou.every(g => !!g && typeof g === 'object' && M.filtroOk(g))));
const COR_NOME = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' };
M.bate = (e, o, f, ctx: any = {}) => {
  for (const k in f) if (!FILTRO_OK.has(k)) throw new Error('filtro sem suporte no motor2: ' + k);
  const d = M.dadoDe(e, o), voce = ctx.voce;
  if (f.este && o.id !== ctx.este) return false;
  if (f.nome !== undefined && o.n !== f.nome && d.n !== f.nome) return false;   // nome exato (Ancestral Anger, Wedding Ring)
  if (f.naoNome !== undefined && (o.n === f.naoNome || d.n === f.naoNome)) return false;   // "not named Tiamat"
  if (f.miraUm) {   // "a spell that targets one or more creatures or Vehicles you control" (Arcee): ao menos um alvo bate no filtro
    const l = o.zona === 'pilha' && o.pil ? (o.pil.alvos || []).flat().filter(a => a && a.o !== undefined) : [];
    if (!l.some(a => { const x = e.objs[a.o]; return x && x.ts === a.ts && M.bate(e, x, f.miraUm, ctx); })) return false; }
  if (f.soMiraEste) { const F = e.objs[ctx.este], l = o.zona === 'pilha' && o.pil ? (o.pil.alvos || []).flat().filter(Boolean) : [];   // "a spell that targets only Zada"
    if (!F || !l.length || !l.every(a => a.o === F.id && a.ts === F.ts)) return false; }
  if (f.outro === 'doEvento' ? !!ctx.ev && o.id === ctx.ev.id : f.outro && o.id === ctx.este) return false;   // 'doEvento': "each OTHER attacking creature" (Shared Animosity)
  if (f.naoAlvo !== undefined && ((ctx.alvos || [])[f.naoAlvo] || []).some(x => x && x.o === o.id)) return false;   // "each other creature" = menos o alvo N (Chandra's Ignition)
  if (f.ou && !f.ou.some(g => M.bate(e, o, g, ctx))) return false;   // "a Human or artifact card" (Boromir): bate em ao menos um
  if (f.lembrada && !(ctx.movidos || []).some(m => m.id === o.id && m.ts === o.ts)) return false;
  if (f.pareadaComEste) { const F = e.objs[ctx.este], q = F && M.parDe(e, F); if (!q || (o.id !== F.id && o.id !== q.id)) return false; }   // "each of those creatures" (soulbond, 702.95): esta e a do par, se pareadas
  if (f.convocou && !(((ctx && e.objs[ctx.este]) || {}).convocou || []).some(m => m.id === o.id && m.ts === o.ts)) return false;   // convocou a mágica que resolve (702.51c)
  // "a creature dealt damage by this creature this turn" (Markov Enforcer): o.feridaPor guarda {id, ts, t} da fonte; no 'morre' vale o lki (snap)
  if (f.feridaPorEsteNoTurno && !(o.feridaPor || []).some(x => x.id === ctx.este && x.t === e.turno.n && (!e.objs[ctx.este] || x.ts === e.objs[ctx.este].ts || e.objs[ctx.este].zona !== 'campo'))) return false;
  // "exiled with this" (406.6, 607.2a): o exílio guarda quem exilou (o.exPor {id, ts}); vale para este objeto (mesmo ts, ou o lki se já saiu)
  if (f.exiladaPorEste && !(o.zona === 'exilio' && o.exPor && o.exPor.id === ctx.este && o.exPor.ts === ((ctx.lki && ctx.lki.este && ctx.lki.este.ts) ?? (e.objs[ctx.este] || {}).ts))) return false;   // o que o efeito anterior moveu (cavar, mover, exilar)
  if (f.zona && f.zona !== 'qualquer' && (Array.isArray(f.zona) ? !f.zona.includes(o.zona) : o.zona !== f.zona)) return false;
  if (f.tipo && !f.tipo.some(t => t === 'Card' || (t === 'Permanent' ? M.ehPermanente(e, o) : t === 'Token' ? !!o.ficha : (d.tipos || []).includes(t === 'escolhido' ? tipoCartaEscolhido(e, ctx) : t)))) return false;   // escolhido: o tipo de carta escolhido pela fonte ao entrar (Cloud Key)
  if (f.tipoCartaEmComum !== undefined && f.tipoCartaEmComum !== 'sacrificada' && !tipoCartaEmComum(e, o, f.tipoCartaEmComum, ctx)) return false;
  if (f.nao && f.nao.some(t => (COR_NOME[t] ? (d.cores || '').includes(COR_NOME[t]) : t === 'Colorless' ? !(d.cores || '') : false) || (d.tipos || []).includes(t) || (d.sub || []).includes(t) || (d.super || []).includes(t) || (t === 'Token' && o.ficha) || (t === 'escolhido' && ehEscolhido(e, o, ctx)))) return false;
  if (f.sub && !f.sub.some(s => s === 'escolhido' ? ehEscolhido(e, o, ctx) : (d.sub || []).includes(s) || (!SUB_NAO_CRIAT_TODOS.has(s) && tiposCriatura(e, o) === 'todos'))) return false;   // metamorfo/todosTipos: é de todo tipo de criatura (702.73a, 205.3m)   // tipo escolhido pela fonte ao entrar (Morophon, Herald's Horn)
  if (f.super && !f.super.every(s => (d.super || []).includes(s))) return false;
  if (f.tipoTodos && !f.tipoTodos.every(t => (d.tipos || []).includes(t))) return false;            // criatura artefato (Mycosynth Golem)
  if (f.historico && !((d.tipos || []).includes('Artifact') || (d.super || []).includes('Legendary') || (d.sub || []).includes('Saga'))) return false;   // CR 700.6
  if (f.ctrl && !quemBate(e, o.ctrl, f.ctrl, voce, ctx)) return false;
  if (f.dono && !quemBate(e, o.dono, f.dono, voce, ctx)) return false;
  // 'C'/'Colorless' = incolor (CR 105.2c: sem cor nenhuma; Mystic Forge, Ugin): includes('C') nunca casava
  if (f.cor && !(Array.isArray(f.cor) ? f.cor : [f.cor]).some(c => c === 'C' || c === 'Colorless' ? !(d.cores || '') : (d.cores || '').includes(COR_NOME[c] || c))) return false;
  if (f.kw && !f.kw.every(k => M.temKw(e, o, k))) return false;
  if (f.semKw && f.semKw.some(k => M.temKw(e, o, k))) return false;   // "if it didn't have decayed" (Wilhelt)
  if (f.semMarcador && (f.semMarcador === true ? Object.values<any>(o.marc || {}).some(n => n > 0) : (o.marc || {})[f.semMarcador] > 0)) return false;   // true: sem marcador nenhum (Damning Verdict); tipo: "without a +1/+1 counter on it" (Wave Goodbye)
  if (f.comMarcador && !(f.comMarcador === true ? Object.values<any>(o.marc || {}).some(n => n > 0) : (o.marc || {})[f.comMarcador] > 0)) return false;   // true: "with counters on them" (Mutational Advantage)   // "com um marcador hit" (Ravenloft Adventurer)   // "com infectar" (Corpse Cur): palavras-chave dela, com as camadas
  if (f.virada !== undefined && !!o.virada !== !!f.virada) return false;
  if (f.entrouNoTurno !== undefined && (o.zona === 'campo' && o.tEntrou === e.turno.n) !== !!f.entrouNoTurno) return false;   // "que entrou neste turno" (Ocelot Pride)
  if (f.comandante !== undefined && !!o.cmd !== !!f.comandante) return false;
  if (f.ficha !== undefined && !!o.ficha !== !!f.ficha) return false;
  if (f.vm && !compara(d.vm || 0, limites(e, f.vm, ctx))) return false;
  if (f.poder && !compara(M.poder(e, o), limites(e, f.poder, ctx))) return false;
  if (f.manaGasta && !compara(o.zona === 'pilha' ? o.manaGasta || 0 : 0, limites(e, f.manaGasta, ctx))) return false;   // mana gasta para conjurar (a mágica na pilha; fora dela, 0)
  if (f.resist && !compara(M.resistencia(e, o), limites(e, f.resist, ctx))) return false;
  if (f.postaPorEste !== undefined && ((!!e.postoAgora && e.postoAgora.fonte === ctx.este && e.postoAgora.id === o.id) || (!!o.postoPor && o.postoPor.fonte === ctx.este && o.postoPor.ts === o.ts)) !== !!f.postaPorEste) return false;   // Kodama of the East Tree
  if (f.comX !== undefined && ((d.custo && d.custo.x) > 0) !== !!f.comX) return false;   // "with {X} in its mana cost" (202.1, Frontline Medic)
  if (f.atacando === 'oponente') { const C = e.turno.combate, r = C && (C.atk || []).find(r => r.id === o.id && r.ts === o.ts); if (!r || r.alvo.jog === undefined || r.alvo.jog === voce) return false; }   // "attacking one of your opponents" (o jogador; Frontier Warmonger)
  else if (f.atacando !== undefined && M.atacando(e, o) !== !!f.atacando) return false;
  if (f.conjurada !== undefined && (o.zona === 'pilha' ? !!o.pil : !!o.conjurada) !== !!f.conjurada) return false;
  if (typeof f.conjurada === 'string' && (o.zona === 'pilha' ? o.pil && o.pil.de : o.conjDe) !== f.conjurada) return false;   // "if you cast it from your hand" (Cyclone Summoner): a zona de onde foi conjurada   // "if you cast it" (601.2): a mágica na pilha ou a permanente que veio dela
  if (f.atacouNoTurno !== undefined && (e.turno.ataques || []).some(r => r.id === o.id && r.ts === o.ts) !== !!f.atacouNoTurno) return false;   // "attacked this turn" (508.1)
  if (f.naoBloqueada !== undefined && M.naoBloqueada(e, o) !== !!f.naoBloqueada) return false;   // 509.1h: depois de declarar bloqueadores (ninjutsu)   // CR 506.4: atacando até o fim do combate
  // anexos: equipada = o objeto a que a fonte (ctx.este) está presa; anexadoA 'este' = preso à fonte;
  // encantada / comEquipamento = com pelo menos uma Aura / um Equipamento preso a ele
  if (f.equipada !== undefined) { const F = e.objs[ctx.este], A = F && F.anexo; if ((!!A && A.id === o.id && A.ts === o.ts) !== !!f.equipada) return false; }
  if (f.anexadoA === 'este') { const F = e.objs[ctx.este], L = ctx.lki && ctx.lki.este;
    if (F && F.zona !== 'campo' && L && L.id === F.id && L.anexos) { if (o.zona !== 'campo' || !L.anexos.some(x => x.id === o.id && x.ts === o.ts)) return false; }   // "an Equipment that WAS attached to" (Zack Fair): o LKI da fonte que saiu
    else if (!F || !o.anexo || o.anexo.id !== F.id || o.anexo.ts !== F.ts) return false; }
  if (f.selada !== undefined && M.selada(e, o) !== !!f.selada) return false;   // 702.171b
  if (f.encantada !== undefined && M.anexosDe(e, o).some(x => M.temTipo(e, x, 'Enchantment') && (M.dadoDe(e, x).sub || []).includes('Aura')) !== !!f.encantada) return false;
  if (f.topo !== undefined) { const g = e.jogs[o.dono].zonas.grimorio; if ((o.zona === 'grimorio' && g[g.length - 1] === o.id) !== !!f.topo) return false; }   // a carta do topo do grimório (o fim da lista)
  // CR 700.9: modificada = com marcador, equipada, ou encantada por Aura que o controlador dela controla
  // "power greater than its base power" (Kutzil): base = o P do dado (impresso ou fixado na 7b), sem 7c–d
  if (f.maiorPoder && !(M.temTipo(e, o, 'Creature') && e.campo.every(id => id === o.id || !M.temTipo(e, e.objs[id], 'Creature') || M.poder(e, e.objs[id]) < M.poder(e, o)))) return false;   // "its power is greater than each other creature's power" (Selvala, Heart of the Wilds)
  if (f.poderAcimaBase && !(M.temTipo(e, o, 'Creature') && M.poder(e, o) > ((d.pt || [0])[0] || 0))) return false;
  // nome único: true = "doesn't have the same name as another permanent you control" (Yenna); 'criaturaOuCemiterio' =
  // "… as another creature you control or a creature card in your graveyard" (Guardian Project)
  if (f.nomeUnico) {
    const nm = o.n, J = e.jogs[voce], cr = f.nomeUnico === 'criaturaOuCemiterio';
    if (e.campo.some(id => id !== o.id && e.objs[id].ctrl === voce && e.objs[id].n === nm && (!cr || M.temTipo(e, e.objs[id], 'Creature')))) return false;
    if (cr && J && J.zonas.cemiterio.some(id => id !== o.id && e.objs[id].n === nm && M.temTipo(e, e.objs[id], 'Creature'))) return false;
  }
  if (f.modificada !== undefined && (Object.values(o.marc || {}).some((n: any) => n > 0) || M.anexosDe(e, o).some(x => (M.dadoDe(e, x).sub || []).includes('Equipment')
    || (M.temTipo(e, x, 'Enchantment') && (M.dadoDe(e, x).sub || []).includes('Aura') && x.ctrl === o.ctrl))) !== !!f.modificada) return false;
  if (f.comEquipamento !== undefined && M.anexosDe(e, o).some(x => (M.dadoDe(e, x).sub || []).includes('Equipment')) !== !!f.comEquipamento) return false;
  if (f.tipoEmComum !== undefined && !tipoEmComum(e, o, f.tipoEmComum, ctx)) return false;
  if (f.tipoCartaEmComum === 'sacrificada') {   // "a permanent that shares a card type with it" (Braids): a 1ª sacrificada pelo efeito (o card no cemitério)
    const S = ctx.sacFx && e.objs[ctx.sacFx.id], ts = S ? (M.dadoBase(e, S).tipos || []).filter(t => t !== 'Kindred' && t !== 'Tribal') : [];
    if (!ts.some(t => M.temTipo(e, o, t))) return false;
  }
  return true;
};
// tipos de criatura (CR 205.3m: subtipos de criatura e de Kindred); metamorfo (702.73a) = todos → 'todos'
const tiposCriatura = (e, o) => {
  const d = M.dadoDe(e, o);
  if ((d.kw || []).some(x => x.k === 'metamorfo')) return 'todos';
  return (d.tipos || []).some(t => t === 'Creature' || t === 'Kindred' || t === 'Tribal') ? d.sub || [] : [];
};
M.tiposCriatura = tiposCriatura;
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
// tipo de card em comum (CR 205.2a: Artifact, Creature…; supertipo e subtipo não): 'este' ou um filtro (alguma que bate).
// Semblance Anvil: "Spells you cast that share a card type with the exiled card"
const TIPOS_DE_CARD = new Set(['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Tribal', 'Land', 'Planeswalker', 'Sorcery']);
const tiposCard = (e, x) => (M.dadoDe(e, x).tipos || []).filter(t => TIPOS_DE_CARD.has(t));
function tipoCartaEmComum(e, o, ref, ctx) {
  const t = tiposCard(e, o); if (!t.length) return false;
  const outros = ref === 'este' ? [e.objs[ctx.este]] : ref && typeof ref === 'object' && M.filtroOk(ref) ? M.objetosQue(e, ref, ctx).filter(x => x.id !== o.id) : null;
  if (!outros) throw new Error('tipoCartaEmComum sem suporte: ' + JSON.stringify(ref));
  return outros.some(x => x && tiposCard(e, x).some(k => t.includes(k)));
}
// o tipo de card escolhido ao entrar ("choose a card type", Cloud Key: o.escolha.tipoCarta) ou na resolução (ctx.escolha)
const tipoCartaEscolhido = (e, ctx) => (ctx.escolha && ctx.escolha.tipoCarta) || ((e.objs[ctx.este] || {}).escolha || {}).tipoCarta || '\u0000';
const escolhidoDe = (e, ctx) => { if (ctx.escolha && ctx.escolha.tipo) return ctx.escolha.tipo; const F = e.objs[ctx.este]; return F && F.escolha && F.escolha.tipo || '\u0000'; };   // op escolher na resolução (ctx.escolha) antes da escolha ao entrar
const ehEscolhido = (e, o, ctx) => {
  const t = tiposCriatura(e, o);
  if (ctx.escolha && ctx.escolha.tipos) return t === 'todos' || ctx.escolha.tipos.some(v => t.includes(v));   // "a type chosen this way" (Patriarch's Bidding: cada jogador escolhe um)
  const v = escolhidoDe(e, ctx); return v !== '\u0000' && (t === 'todos' || t.includes(v));
};   // changeling é de todos os tipos (702.73a)
M.atacando = (e, o) => !!(e.turno.combate && (e.turno.combate.atk || []).some(r => r.id === o.id && r.ts === o.ts));
const quemBate = (e, j, q, voce, ctx: any = {}) => q === 'qualquer' ? true : q === 'voce' ? j === voce : q === 'oponente' ? j !== voce : q === 'cadaAtual' ? j === ctx.cadaAtual : q === 'atacado' ? !!ctx.ev && ctx.ev.def !== undefined && j === ctx.ev.def
  : q === 'doEvento' ? !!ctx.ev && j === (ctx.ev.ev === 'dano' ? ctx.ev.jog : ctx.ev.j ?? ctx.ev.jog) : true;   // doEvento: o jogador do evento (Hellkite Tyrant: quem levou o dano)   // cadaAtual: o jogador da vez no repetirCada
const compara = (v, c) => typeof c === 'number' ? v === c
  : (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max) && (c.igual === undefined || v === c.igual);
M.compara = compara;
// limite que é contagem: {conta:{de:'este', o:'poder'}} = o poder atual da fonte ("power less than this creature's power",
// Feasting Hobbit: {max: poder do este, soma -1}); outra contagem vai por M.qtd; não sabe → NaN (o filtro não bate)
const limite = (e, q, ctx) => {
  if (typeof q === 'number' || q === undefined) return q;
  const c = M.qn(q).conta, F = ctx && e.objs[ctx.este];
  if (c && c.de === 'este' && (c.o === 'poder' || c.o === 'resist') && Object.keys(c).length === 2)
    return F ? (c.o === 'poder' ? M.poder(e, F) : M.resistencia(e, F)) * (q.mult ?? 1) + (q.soma || 0) : NaN;
  const v = ctx && ctx.lki && M.qtdDe ? M.qtdDe(e, q, ctx) : M.qtd(e, q, ctx); return v === null || v === undefined ? NaN : v;   // dentro de um efeito (lki): qualquer contagem (Kodama: VM do evento)
};
const limites = (e, c, ctx) => typeof c === 'number' || (typeof c.min !== 'object' && typeof c.max !== 'object' && typeof c.igual !== 'object') ? c
  : { min: limite(e, c.min, ctx), max: limite(e, c.max, ctx), igual: limite(e, c.igual, ctx) };

// objetos que batem num filtro (zona padrão: campo)
M.objetosQue = (e, f, ctx) => {
  const z = f.zona || 'campo';
  let ids;
  if (Array.isArray(z)) return [...new Set(z.flatMap(k => M.objetosQue(e, { ...f, zona: k }, ctx)))];   // zona em lista: em alguma destas (Visions of Glory)
  if (z === 'campo') ids = e.campo;
  else if (z === 'pilha') ids = e.pilha.filter(id => !e.objs[id].hab);   // filtro de objeto na pilha = mágica: habilidade não tem tipo (113.1) nem carta
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
M.contaAtaque = (e, conta, voce) => {
  const C = e.turno.combate, hist = (e.turno.ataques || []).filter(r => !r.entrou);   // quem entrou atacando não "atacou" (508.4)
  if (conta === 'atacantes') return C ? C.atk.filter(r => M.emCombate(e, r)).length : 0;
  if (conta === 'atacantesEmVoce') return (C ? C.atk : hist).filter(r => r.def === voce).length;
  // os oponentes que você atacou neste combate (jogador, não planeswalker): corpo-a-corpo (702.121a), lido na resolução
  if (conta === 'oponentesAtacados') return new Set((C ? C.atk : []).filter(r => r.alvo && r.alvo.jog !== undefined && r.alvo.jog !== voce && e.objs[r.id] && e.objs[r.id].ctrl === voce).map(r => r.alvo.jog)).size;
  return hist.filter(r => r.j === voce).length;
};

// ---- quantidade RX (número, X, {conta:filtro}) ----
M.qtd = (e, q0, ctx: any = {}) => {
  const q = M.qn(q0);
  if (typeof q === 'number') return q;
  if (q === 'X') return ctx.x || 0;
  if (!q || typeof q !== 'object' || !q.conta || typeof q.conta !== 'object' || !('de' in q.conta) || !M.contaOk(q.conta, 'cond')) return null;   // o núcleo ainda não sabe → quem chama não oferece
  if (q.conta.de === 'lembradas' || q.conta.de === 'evento') return M.qtdDe(e, q, { lki: {}, ...ctx });
  return M.qtdConta(e, q, ctx);
}

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
const COND_OK = new Set(['eventoMais', 'existe', 'controla', 'turno', 'vidaMin', 'vidaMax', 'vidaOponenteMax', 'conta', 'conjuradaCom', 'palavra', 'pagou', 'objBate', 'esteEm', 'temIniciativa', 'monarca', 'haMonarca', 'completouMasmorra', 'desceu', 'maisTerrenosOponente', 'modoEscolhido', 'primeiroCombate', 'fasePrincipal', 'emCombate', 'conjuradaNaPrincipal', 'portadorDoAnel']);
// conjuradaCom 'kicker' e palavra 'promisedgift' (chute/presente pagos); palavras de habilidade lidas do estado agora
// (PALAVRA): metalcraft (3+ artefatos), coven (3+ poderes diferentes), blessing (bênção da cidade, 702.131: 10+
// permanentes uma vez = para sempre), morbid (criatura morreu neste turno, masmorras.ts). Fora daqui a condição é recusada.
// temIniciativa/completouMasmorra: valores conferidos em masmorras.ts (CR 727, 309.7)
// ascender (CR 702.131): com uma permanente com ascender (ou a mágica com ascender resolvendo, 702.131a) e 10+ permanentes,
// o jogador ganha a bênção da cidade e fica com ela para o resto da partida (702.131c). Checado nas ABE e ao ler a condição.
M.bencao = (e, j, este?) => {
  const J = e.jogs[j]; if (!J || J.bencao) return !!(J && J.bencao);
  const meus = e.campo.filter(id => e.objs[id].ctrl === j);
  if (meus.length < 10) return false;
  const x = este !== undefined && e.objs[este];
  if (meus.some(id => M.temKw(e, e.objs[id], 'ascender')) || (x && x.zona === 'pilha' && x.ctrl === j && M.temKw(e, x, 'ascender'))) { J.bencao = true; M.log(e, J.nome, 'ganha a bênção da cidade'); }
  return !!J.bencao;
};
const PALAVRA: Record<string, (e, ctx) => boolean> = {
  metalcraft: (e, ctx) => M.objetosQue(e, { tipo: ['Artifact'], ctrl: 'voce', zona: 'campo' }, ctx).length >= 3,
  coven: (e, ctx) => new Set(M.objetosQue(e, { tipo: ['Creature'], ctrl: 'voce', zona: 'campo' }, ctx).map(o => M.poder(e, o))).size >= 3,
  blessing: (e, ctx) => M.bencao(e, ctx.voce, ctx.este),
  morbid: e => M.morbido(e),
  maxspeed: (e, ctx) => (e.jogs[ctx.voce] && e.jogs[ctx.voce].vel || 0) >= 4,   // Max speed (702.178a)
  solved: (e, ctx) => { const o = e.objs[ctx.este]; return !!o && o.zona === 'campo' && o.solved === o.ts; },   // Caso resolvido (719.3b; mudou de zona: objeto novo)
};
M.condValorOk = se => (se.conjuradaCom === undefined || ['kicker', 'flashback', 'cemiterio', 'exilio', 'alternativo', 'impending'].includes(se.conjuradaCom)) && (se.palavra === undefined || se.palavra === 'promisedgift' || !!PALAVRA[se.palavra]) && M.condMasmorraOk(se);
M.condicao = (e, se, ctx) => {
  if (!se) return true;
  if (se.nao !== undefined) { const { nao, ...resto } = se; return !M.condicao(e, nao, ctx) && M.condicao(e, resto, ctx); }   // "unless …" (Wayward Swordtooth: sem a bênção da cidade)
  for (const k in se) if (!COND_OK.has(k)) throw new Error('condição sem suporte no motor2: ' + k);
  if (se.existe) {
    const f = { ...se.existe.f }; if (!f.ctrl && (f.zona || 'campo') === 'campo') f.ctrl = 'qualquer';
    const n = M.objetosQue(e, f, ctx).length;
    const c = se.existe;
    if (c.min === undefined && c.max === undefined && c.igual === undefined ? n < 1 : !compara(n, c)) return false;
  }
  if (se.controla && M.objetosQue(e, { ...se.controla.f, ctrl: 'voce' }, ctx).length < (se.controla.min || 1)) return false;
  if (se.turno === 'doEvento') { if (!ctx.ev || ctx.ev.j === undefined || e.turno.ativo !== ctx.ev.j) return false; }   // "during their turn" (Wedding Ring): o turno de quem compra/ganha
  else if (se.turno && (se.turno === 'seu') !== (e.turno.ativo === ctx.voce)) return false;
  if (se.portadorDoAnel !== undefined) {   // 701.54: true = você tem um Portador do Anel; 'este' = esta é o seu Portador (Frodo)
    const A = e.jogs[ctx.voce] && e.jogs[ctx.voce].anel, E = e.objs[ctx.este];
    const tem = se.portadorDoAnel === 'este' ? !!E && M.ehPortador(e, E) && E.ctrl === ctx.voce : !!A && !!A.p && !!e.objs[A.p.id] && M.ehPortador(e, e.objs[A.p.id]);
    if (!tem) return false;
  }
  if (se.primeiroCombate !== undefined && ((e.turno.combates || 0) <= 1) !== !!se.primeiroCombate) return false;   // "if it's the first combat phase of the turn"
  if (se.emCombate !== undefined && ['inicioCombate', 'atacantes', 'bloqueadores', 'dano', 'fimCombate'].includes(e.turno.passo) !== !!se.emCombate) return false;   // "during combat" (Marisi, 506.1)
  if (se.fasePrincipal !== undefined && (['principal1', 'principal2'].includes(e.turno.passo) && e.turno.ativo === ctx.voce) !== !!se.fasePrincipal) return false;   // "if it's your main phase" (Moraug)
  if (se.conjuradaNaPrincipal !== undefined) { const E = e.objs[ctx.este]; if (!!(E && E.zona === 'pilha' && E.conjPrinc) !== !!se.conjuradaNaPrincipal) return false; }   // Addendum: esta mágica foi conjurada na sua fase principal
  if (se.conjuradaCom !== undefined || se.palavra !== undefined) {   // a mágica resolvendo (ctx.opc) ou a permanente que ela virou
    if (!M.condValorOk(se)) throw new Error('condição sem suporte no motor2: ' + (se.conjuradaCom || se.palavra));
    const E = e.objs[ctx.este], cc = E && E.zona === 'campo' ? E.conjCom : null, op = ctx.opc;
    if (se.conjuradaCom === 'kicker' && !((op && op.chute) || (cc && cc.kicker))) return false;
    if (se.conjuradaCom === 'alternativo' && !(op && (op.altPago || op.alt !== undefined))) return false;   // CR 118.9: o custo alternativo foi pago
    if (se.conjuradaCom === 'impending' && !((op && op.iminente) || (cc && cc.iminente))) return false;   // 702.176a: pago o custo iminente
    if (se.conjuradaCom === 'flashback' && !(E && E.zona === 'pilha' && E.flash)) return false;   // "if this spell was cast with flashback" (702.34a: o.flash na pilha)
    if (se.conjuradaCom === 'cemiterio' && !(E && E.zona === 'pilha' && E.conjDe === 'cemiterio')) return false;
    if (se.conjuradaCom === 'exilio' && !(E && E.zona === 'pilha' && E.conjDe === 'exilio')) return false;   // "if this spell was cast from exile" (Ultimate Magic: Holy, prever)   // "if this spell was cast from a graveyard" (cópia não foi conjurada, 707.10)
    if (se.palavra === 'promisedgift' && !((op && op.presente) || (cc && cc.presente))) return false;
    if (se.palavra && PALAVRA[se.palavra] && !PALAVRA[se.palavra](e, ctx)) return false;
  }
  if ((se.temIniciativa !== undefined || se.monarca !== undefined || se.haMonarca !== undefined || se.completouMasmorra !== undefined || se.desceu !== undefined) && !M.condMasmorra(e, se, ctx)) return false;
  if (se.eventoMais !== undefined) {   // "if that player has more cards in hand / lands / life than each other player" (Battle Angels of Tyr): o jogador do evento
    const jj = ctx.ev ? (ctx.ev.jog !== undefined ? ctx.ev.jog : ctx.ev.j) : undefined; if (jj === undefined) return false;
    const v = j => se.eventoMais === 'mao' ? e.jogs[j].zonas.mao.length : se.eventoMais === 'vida' ? e.jogs[j].vida : e.campo.filter(id => e.objs[id].ctrl === j && M.temTipo(e, e.objs[id], 'Land')).length;
    if (!M.vivos(e).every(j => j === jj || v(jj) > v(j))) return false;
  }
  if (se.maisTerrenosOponente !== undefined) {   // Land Tax, Loyal Warhound ('algum'); Archaeomancer's Map ('doEvento': quem controla o terreno que entrou)
    const terr = j => e.campo.filter(id => { const o = e.objs[id]; return o.ctrl === j && M.temTipo(e, o, 'Land'); }).length, meus = terr(ctx.voce);
    if (se.maisTerrenosOponente === 'algum') { if (!M.vivos(e).some(j => j !== ctx.voce && terr(j) > meus)) return false; }
    else { const ev = ctx.ev, ob = ev && ev.id !== undefined ? e.objs[ev.id] : null, j = ob ? ob.ctrl : ev ? ev.j : undefined; if (j === undefined || j === ctx.voce || terr(j) <= meus) return false; }
  }
  if (se.modoEscolhido !== undefined) { const E = e.objs[ctx.este]; if (!E || !E.escolha || E.escolha.modo !== se.modoEscolhido) return false; }   // escolhido ao entrar (efeitos.ts decidirEntrada)
  if (se.pagou !== undefined && !!ctx.pagou !== !!se.pagou) return false;
  if (se.esteEm) { const E = e.objs[ctx.este]; if (!E || !se.esteEm.includes(E.zona)) return false; }   // "as long as this is in your graveyard" (Anger, Wonder)
  if (se.objBate) {                                                 // o objeto (este, doEvento, equipada, criadas, alvo) bate no filtro? nao: o contrário
    // doEvento que saiu do campo: como estava ao sair (LKI, 603.10a — "criatura sem voar morre" olha o marcador que ela tinha)
    const lki = se.objBate.em === 'doEvento' && ctx.ev && ctx.ev.snap && ctx.ev.de === 'campo' ? [ctx.ev.snap] : null;
    const naPilha = se.objBate.em === 'doEvento' && ctx.ev && (ctx.ev.ev === 'conjura' || ctx.ev.ev === 'copia');   // a mágica conjurada está na pilha (Boromir, Warden)
    const b = (lki || M.objsDe(e, { em: se.objBate.em, ...(naPilha ? { de: 'pilha' } : {}) }, ctx)).some(o => M.bate(e, o, se.objBate.f || {}, ctx));
    if (b === !!se.objBate.nao) return false;
  }   // "se fizer" do efeito anterior (ctx da resolução)
  const vida = e.jogs[ctx.voce].vida;
  if (se.vidaMin !== undefined && vida < se.vidaMin) return false;
  if (se.vidaMax !== undefined && vida > se.vidaMax) return false;
  if (se.vidaOponenteMax !== undefined && !M.vivos(e).some(j => j !== ctx.voce && e.jogs[j].vida <= se.vidaOponenteMax)) return false;   // "um oponente com N ou menos de vida" (Bloodghast)
  if (se.conta) {   // min/max/igual podem ser outra contagem (Thassa's Oracle: devoção a azul ≥ cartas no grimório)
    const v = M.qtd(e, se.conta.q, ctx); if (v === null) return false;
    const c: any = {}; for (const k of ['min', 'max', 'igual']) if (se.conta[k] !== undefined) { const b = M.qtd(e, se.conta[k], ctx); if (b === null) return false; c[k] = b; }
    if (!compara(v, c)) return false;
  }
  return true;
};
