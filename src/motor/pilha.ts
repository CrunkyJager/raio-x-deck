// src/motor/pilha.ts (T43: migrado de motor2/pilha.js) — prioridade (CR 117), pilha (CR 405), alvos (CR 115), conjurar (CR 601), ativar (CR 602),
// resolver (CR 608: alvo ilegal 608.2b, informação guardada 608.2h) e o "processo com perguntas" que eles usam.
import { M } from './nucleo';

const PRINCIPAL = new Set(['principal1', 'principal2']);
const PAUSA = { pausa: true };

// ---------- processo com perguntas ----------
// Conjurar, ativar e resolver pedem várias escolhas seguidas. O processo roda de novo do início a cada resposta,
// com as respostas já dadas gravadas (P.resp). Regra de quem escreve um passo: PERGUNTAR TUDO ANTES DE MEXER NO
// ESTADO. Na resolução cada efeito é um passo (P.i): ao terminar um efeito as respostas zeram.
// Ganho: desistir no meio (custo que não fecha) não deixa nada pela metade — CR 727 (voltar atrás) de graça.
function rodarProc(e) {
  const P = e.proc, A = { ip: 0 };
  const ask = (j, tipo, ops, ctx) => {
    if (A.ip < P.resp.length) return ops[P.resp[A.ip++]];
    if (!ops.length) throw new Error('pergunta sem opções: ' + tipo);
    if (ops.length === 1) { P.resp.push(0); A.ip++; return ops[0]; }     // uma opção só: não pergunta
    e.perg = { j, tipo, ops, ctx, proc: true };
    throw PAUSA;
  };
  ask.etapa = () => { P.resp = []; A.ip = 0; };
  try { PROC[P.tp](e, P, ask); } catch (err) { if (err !== PAUSA) throw err; }
}
M.iniciarProc = (e, proc) => { e.proc = { ...proc, resp: [] as any[] }; rodarProc(e); };
M.continuarProc = (e, k) => { e.proc.resp.push(k); rodarProc(e); };

// ---------- leitura ----------
M.temKw = (e, o, k) => M.kwDe(e, o).some(x => x.k === k);   // com as palavras-chave dadas pelas camadas (estado.ts)
const ehMagica = o => o.zona === 'pilha' && !o.hab;
const vivo = (e, j) => !e.jogs[j].saiu;

// "você pode conjurar X como se tivesse lampejo" (CR 702.8, 601.3e): estática de permanente (Liberator, Singer of Swift
// Rivers, Sigarda's Aid; Quick Sliver vale para todos) ou efeito temporário (Alchemist's Refuge, Progenitor's Icon)
const lampejoOk = (e, j, o, s, ctx) => s.modo === 'conjurarComLampejo' && (!s.f || M.bate(e, o, s.f, ctx));
M.lampejoDado = (e, j, o) => {
  for (const id of e.campo) {
    const F = e.objs[id];
    for (const s of M.dadoDe(e, F).est || []) if ((s.afeta === 'cadaJogador' || (s.afeta === 'voce' && F.ctrl === j)) && lampejoOk(e, j, o, s, { voce: j, este: F.id })) return true;
  }
  for (const t of e.efTemp || []) if (t.ctrl === j) for (const s of t.est) if (lampejoOk(e, j, o, s, { voce: j, este: t.este ? t.este.id : -1 })) return true;
  return false;
};
// velocidade (CR 307.1, 117.1a): mágica de feitiço só na principal do ativo com a pilha vazia
M.velFeitico = (e, j) => j === e.turno.ativo && PRINCIPAL.has(e.turno.passo) && !e.pilha.length;

// ---------- alvos (CR 115) ----------
// escolha de alvo: {o: id, ts} (objeto) ou {jog: j}. O ts prende o objeto: mudou de zona → objeto novo (CR 400.7)
const TIPOS_ALVO_OBJ = ['Creature', 'Planeswalker', 'Battle'];
M.alvoSuportado = a => {
  const f = a.f;
  if (a.dividir && a.dividir !== 'igual' && a.dividir !== true) return false;   // 'igual' = Fireball; true = à escolha ao pôr na pilha (601.2d)
  if (a.max !== undefined && a.max !== 'qualquer' && typeof a.max !== 'number') return false;
  if (a.opcao !== undefined && !OPCAO_OK.has(a.opcao)) return false;
  if (a.diferenteDe !== undefined && !Number.isInteger(a.diferenteDe)) return false;
  if (typeof f === 'string') return ['qualquerAlvo', 'jogador', 'oponente', 'magica'].includes(f);
  return M.filtroOk(f);
};
// chute (CR 702.33) e oferta de presente (702.174; só o presente 'carta'): escolhas anunciadas com os modos (601.2b).
// alvo.opcao: o alvo só existe com (ou sem) a opção (Tear Asunder, Wear Down, Long River's Pull).
const OPCAO_OK = new Set(['chute', 'semChute', 'presente', 'semPresente']);
const chuteDe = d => (d.kw || []).find(k => k.k === 'chute' && k.custo);
const proleDe = d => (d.kw || []).find(k => k.k === 'prole' && k.custo);   // CR 702.175a: custo adicional opcional
const presenteDe = d => (d.kw || []).find(k => k.k === 'ofertaPresente' && k.tipo === 'carta');
const alvoAtivo = (a, opc) => opc && opc.sobrecarga ? false : !a || !a.opcao || !opc ? true : a.opcao === 'chute' ? !!opc.chute : a.opcao === 'semChute' ? !opc.chute
  : a.opcao === 'presente' ? !!opc.presente : !opc.presente;
M.alvoAtivo = alvoAtivo;
// combinações de opção que a carta tem, com a opção primeiro (o agente básico pega a primeira que fecha)
// sobrecarga (CR 702.96): custo alternativo em que "alvo" vira "cada" (702.96b). Lido: um alvo só, com filtro de objeto;
// o efeito vira repetirCada sobre o que caberia nesse alvo, com em {alvo:0} trocado pelo objeto da vez ('cadaAtual').
const sobrecargaDe = d => (d.kw || []).find(k => k.k === 'sobrecarga' && k.custo);
const trocaAlvo0 = v => Array.isArray(v) ? v.map(trocaAlvo0) : v && typeof v === 'object'
  ? (Object.keys(v).length === 1 && v.alvo === 0 ? 'cadaAtual' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trocaAlvo0(x)]))) : v;
M.fxSobrecarga = (d, fx) => {
  const a = (d.alvos || [])[0];
  if (!sobrecargaDe(d) || (d.alvos || []).length !== 1 || !a || !a.f || typeof a.f !== 'object' || (a.max ?? 1) !== 1) return null;
  const nf = [{ op: 'repetirCada', cada: { ...a.f, zona: a.f.zona || 'campo' }, fx: trocaAlvo0(fx) }];
  return JSON.stringify(nf).includes('"alvo"') || !M.fxSuportado(nf) ? null : nf;
};
function opcoesConj(e, j, d, o?) {
  let l: any[] = [{}];
  if (chuteDe(d)) l = [{ chute: true }, {}];
  if (d.fx && M.fxSobrecarga(d, d.fx)) l = [{ sobrecarga: true }, ...l];   // o agente básico pega a primeira que fecha
  if (presenteDe(d) && M.vivos(e).some(x => x !== j)) l = l.flatMap(o => [{ ...o, presente: true }, o]);
  if (o) { const alts = altFis(e, j, o, d); if (alts.length) l = [...l, ...alts.flatMap(i => l.filter(x => !x.sobrecarga).map(x => ({ ...x, alt: i })))]; }   // 118.9: depois da normal
  if (proleDe(d)) l = l.flatMap(o => [{ ...o, prole: true }, o]);
  return l;
}
const custoOpc = (d, custo, opc, e?, o?) => { const c = opc.alt !== undefined ? (b => opc.chute ? M.somaCusto(b, chuteDe(d).custo) : b)(e ? M.custoComImposto(e, o, d.est[opc.alt].pagar.mana || {}) : d.est[opc.alt].pagar.mana || {}) : opc.sobrecarga ? (e ? M.custoComImposto(e, o, sobrecargaDe(d).custo) : sobrecargaDe(d).custo) : opc.chute ? M.somaCusto(custo, chuteDe(d).custo) : custo; return opc.prole ? M.somaCusto(c, proleDe(d).custo) : c; };
// pode ser alvo de quem controla a mágica/habilidade? antimagia (CR 702.11b) e manto (CR 702.18a); proteção = T18
const alcancavel = (e, o, voce) => !(M.temKw(e, o, 'manto') || (M.temKw(e, o, 'antimagia') && o.ctrl !== voce));
M.alvoLegal = (e, a, esc, ctx) => {
  const f = a.f, voce = ctx.voce;
  if (esc.jog !== undefined) {
    if (!vivo(e, esc.jog)) return false;
    if (M.protegeJog(e, esc.jog)) return false;                    // 702.16b: proteção contra tudo, não é alvo
    if (esc.jog !== voce && M.antimagiaJog(e, esc.jog)) return false;   // 702.11c: jogador com antimagia
    if (f === 'qualquerAlvo' || f === 'jogador' || a.jog === 'jogador') return true;
    if (f === 'oponente' || a.jog === 'oponente') return esc.jog !== voce;
    return false;
  }
  const o = e.objs[esc.o];
  if (!o || o.ts !== esc.ts) return false;                         // mudou de zona: não é mais o mesmo objeto
  if (f === 'magica') return ehMagica(o);
  if (o.zona === 'campo' && !alcancavel(e, o, voce)) return false;
  if (f === 'qualquerAlvo') return o.zona === 'campo' && TIPOS_ALVO_OBJ.some(t => M.temTipo(e, o, t));
  if (typeof f === 'string') return false;
  if (o.hab) return false;
  const ff = f.zona ? f : { ...f, zona: 'campo' };
  return M.bate(e, o, ff, ctx);
};
// só lê: em lote (cada alvoLegal olha palavra-chave/P-R, e com mil fichas a contagem das estáticas pesava)
M.alvosPossiveis = (e, a, ctx) => M.lote(() => alvosPoss(e, a, ctx));
function alvosPoss(e, a, ctx) {
  const r: any[] = [], f = a.f;
  const jog = f === 'qualquerAlvo' || f === 'jogador' || f === 'oponente' || a.jog;
  if (jog) for (const J of e.jogs) if (M.alvoLegal(e, a, { jog: J.i }, ctx)) r.push({ jog: J.i });
  let ids;
  if (f === 'magica') ids = e.pilha;
  else if (f === 'qualquerAlvo') ids = e.campo;
  else if (typeof f === 'string') ids = [];
  else ids = M.objetosQue(e, f.zona ? f : { ...f, zona: 'campo' }, ctx).map(o => o.id);
  for (const id of ids) { const esc = { o: id, ts: e.objs[id].ts }; if (M.alvoLegal(e, a, esc, ctx)) r.push(esc); }
  return r;
}
// índices de alvo que os efeitos usam (modal: só os modos escolhidos pedem alvo, CR 601.2c)
const alvosUsados = fx => {
  const s = new Set<any>();
  const anda = v => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(anda); return; }
    if (typeof v.alvo === 'number') s.add(v.alvo);
    for (const k in v) if (k !== 'modos' && !(k === 'quando' && v.op === 'reflexo')) {   // o reflexo tem os alvos dele (603.12)
      // a ficha também tem (as habilidades dela, 111.4), mas o resto do token conta: copiaDe {alvo} (Twinflame, 601.2f)
      if (k === 'token' && v.op === 'ficha' && v.token && typeof v.token === 'object') { for (const t in v.token) if (!['gat', 'atv', 'est'].includes(t)) anda(v.token[t]); }
      else anda(v[k]);
    }
  };
  anda(fx);
  return [...s].sort((a, b) => a - b);
};
// quem: 'alvoJogador' ("target player loses 1 life": Blood Artist, Sanguine Bond, Hedron Crab, Liliana) não diz o
// índice; usa o alvo de jogador declarado (f 'jogador'/'oponente'). Sem isso o alvo nunca era escolhido e o efeito sumia.
const alvosUsadosDe = (d, fx) => {
  const s = new Set<number>(alvosUsados(fx));
  if (JSON.stringify(fx || []).includes('"alvoJogador"')) (d.alvos || []).forEach((a, i) => { if (a && (a.f === 'jogador' || a.f === 'oponente')) s.add(i); });
  return [...s].sort((a, b) => a - b);
};

// ---------- custos (CR 118, 601.2f–h, 602.2b) ----------
// campos de topo da carta que o motor lê além dos de sempre (a cobertura pergunta aqui): impostoPorAlvo = CR 601.2f
M.CARTA_OK = new Set(['impostoPorAlvo']);
const CUSTO_OK = new Set(['mana', 'virar', 'desvirar', 'sacrificar', 'descartar', 'vida', 'exilarEste', 'descartarEste', 'tirarMarcador', 'devolver', 'virarOutros', 'porMarcador', 'revelar', 'exilarDe']);
M.custoSuportado = c => {
  for (const k in c || {}) if (!CUSTO_OK.has(k)) return false;
  if (c && c.vida !== undefined && typeof c.vida !== 'number') return false;
  // "Put a -1/-1 counter on this creature" como custo (Devoted Druid, CR 118.3/602.2b): {tipo, qtd} na própria fonte
  if (c && c.porMarcador !== undefined && !(c.porMarcador && typeof c.porMarcador.tipo === 'string' && (c.porMarcador.qtd === undefined || Number.isInteger(c.porMarcador.qtd))
    && Object.keys(c.porMarcador).every(k => k === 'tipo' || k === 'qtd'))) return false;
  if (c && c.sacrificar && c.sacrificar !== 'este' && !M.filtroOk(c.sacrificar.f || {})) return false;
  if (c && c.devolver !== undefined && c.devolver !== 'este' && !(c.devolver && typeof c.devolver === 'object' && M.filtroOk(c.devolver.f || {})
    && (c.devolver.qtd === undefined || Number.isInteger(c.devolver.qtd)) && Object.keys(c.devolver).every(k => k === 'f' || k === 'qtd'))) return false;
  // "vire uma criatura lendária desvirada que você controla" (Dungeon Descent): {f, qtd}; não é o {T} dela, enjoo não importa (302.6)
  if (c && c.virarOutros !== undefined && !(c.virarOutros && typeof c.virarOutros === 'object' && M.filtroOk(c.virarOutros.f || {})
    && (c.virarOutros.qtd === undefined || Number.isInteger(c.virarOutros.qtd)) && (c.virarOutros.poder === undefined || (Number.isInteger(c.virarOutros.poder) && c.virarOutros.qtd === undefined)) && Object.keys(c.virarOutros).every(k => k === 'f' || k === 'qtd' || k === 'poder'))) return false;
  // "revele uma carta de Dinossauro da sua mão" (Thunderherd Migration): {f, qtd}; revelar não muda zona (701.20)
  if (c && c.revelar !== undefined && !(c.revelar && typeof c.revelar === 'object' && M.filtroOk({ ...(c.revelar.f || {}), zona: undefined })
    && (c.revelar.qtd === undefined || Number.isInteger(c.revelar.qtd)) && Object.keys(c.revelar).every(k => k === 'f' || k === 'qtd'))) return false;
  if (c && c.mana !== undefined && !(c.mana && typeof c.mana === 'object')) return false;
  // "exile três cartas de criatura do seu cemitério" (Drivnod) / "exile uma carta azul da sua mão" (Force of Will): {zona, f, qtd}
  if (c && c.exilarDe !== undefined && !(c.exilarDe && typeof c.exilarDe === 'object' && ['cemiterio', 'mao'].includes(c.exilarDe.zona) && M.filtroOk(c.exilarDe.f || {})
    && (c.exilarDe.qtd === undefined || Number.isInteger(c.exilarDe.qtd)) && Object.keys(c.exilarDe).every(k => ['f', 'qtd', 'zona'].includes(k)))) return false;
  return true;
};
// candidatos a sacrificar/descartar de um custo
const candSac = (e, j, c, fonte) => M.objetosQue(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: fonte }).filter(o => !c.sacrificar.comEste || o.id !== fonte);
const candDev = (e, j, c, fonte) => M.objetosQue(e, { ...(c.devolver.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: fonte });   // devolver à mão como custo (Master Transmuter)
const candVir = (e, j, c, fonte) => M.objetosQue(e, { ...(c.virarOutros.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: fonte }).filter(o => !o.virada && o.id !== fonte);
M.candVir = candVir;
const candRev = (e, j, c, fora) => M.objetosQue(e, { ...(c.revelar.f || {}), zona: 'mao' }, { voce: j }).filter(o => o.id !== fora && e.jogs[j].zonas.mao.includes(o.id));
const candExi = (e, j, c, fora) => M.objetosQue(e, { ...(c.exilarDe.f || {}), zona: c.exilarDe.zona }, { voce: j }).filter(o => o.id !== fora && e.jogs[j].zonas[c.exilarDe.zona].includes(o.id));
const candDesc = (e, j, fora) => e.jogs[j].zonas.mao.filter(id => id !== fora);
// custo fora da mana dá para pagar agora? (antes da mana: o que sai daqui não paga mana)
function custoFisicoOk(e, j, o, c, { daMao }: any = {}) {
  if (!c) return true;
  const J = e.jogs[j];
  if ((c.virar || c.desvirar) && o) {                              // CR 302.6: criatura sem pressa não usa {T}/{Q}
    if (c.virar && o.virada) return false;
    if (c.desvirar && !o.virada) return false;
    if (M.temTipo(e, o, 'Creature') && o.doente && !M.temKw(e, o, 'pressa')) return false;
  }
  if (c.vida && (J.vida < c.vida || M.vidaFixa(e, j))) return false;   // CR 119.4, 119.8
  if (c.descartarEste && (!o || o.zona !== 'mao')) return false;
  if (c.porMarcador && (!o || o.zona !== 'campo')) return false;   // canalizar: só da mão (CR 602.2, a habilidade diz a zona)
  if (c.sacrificar && c.sacrificar !== 'este' && !M.temPeloMenos(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: o && o.id }, c.sacrificar.qtd || 1)) return false;
  if (c.descartar && candDesc(e, j, daMao).length < c.descartar) return false;
  if (c.devolver === 'este' && (!o || o.zona !== 'campo')) return false;
  if (c.devolver && c.devolver !== 'este' && !M.temPeloMenos(e, { ...(c.devolver.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: o && o.id }, c.devolver.qtd || 1)) return false;
  if (c.tirarMarcador && (!o || (o.marc[c.tirarMarcador.tipo] || 0) < (c.tirarMarcador.qtd || 1))) return false;
  if (c.virarOutros && c.virarOutros.poder === undefined && candVir(e, j, c, o && o.id).length < (c.virarOutros.qtd || 1)) return false;
  if (c.virarOutros && c.virarOutros.poder !== undefined && candVir(e, j, c, o && o.id).reduce((s, x) => s + Math.max(0, M.poder(e, x)), 0) < c.virarOutros.poder) return false;   // tripular N (702.122a)
  if (c.revelar && candRev(e, j, c, daMao).length < (c.revelar.qtd || 1)) return false;
  if (c.exilarDe && candExi(e, j, c, daMao || (o && o.id)).length < (c.exilarDe.qtd || 1)) return false;
  return true;
}

// mana possível de um jogador (limite de cima, rápido): reserva + o máximo de cada fonte de virar
function manaMax(e, j, excluir, para) {
  let t = M.somaMana(e.jogs[j].reserva);
  const fs = M.fontesDeMana(e, j, { soVirar: true, para });
  for (const f of fs) if (!excluir || !excluir.includes(f.id)) t += Math.max(...f.pacotes.map(M.somaMana));
  if (para && M.temKw(e, para, 'improvisar')) {                     // os artefatos que não dão mana pagam {1} cada (702.126)
    const ids = new Set(fs.map(f => f.id));
    t += e.campo.filter(id => { const o = e.objs[id]; return o.ctrl === j && !o.virada && !ids.has(id) && (!excluir || !excluir.includes(id)) && M.temTipo(e, o, 'Artifact'); }).length;
  }
  if (para && M.temKw(e, para, 'delve')) t += cemDelve(e, j, excluir, para).length;   // cada carta exilada do cemitério paga {1} (702.66)
  if (para && M.temKw(e, para, 'convocar')) {                       // as criaturas que não dão mana pagam 1 cada (702.51)
    const ids = new Set(fs.map(f => f.id));
    t += e.campo.filter(id => { const o = e.objs[id]; return o.ctrl === j && !o.virada && !ids.has(id) && (!excluir || !excluir.includes(id)) && M.temTipo(e, o, 'Creature'); }).length;
  }
  return t;
}
const vidaPhy = (e, j) => M.vidaFixa(e, j) ? 0 : Math.max(0, e.jogs[j].vida - 1);   // 119.8: vida fixa não paga        // phyrexiano: o plano pode gastar vida sem morrer
const plano0 = (e, j, custo, x, excluir, para?) => M.planoMana(e, j, custo, { x, vidaDisp: vidaPhy(e, j), excluir, para });
// improvisar (CR 702.126): cada artefato seu desvirado que você vira paga {1} genérico da mágica. Primeiro os que não
// dão mana (virar um Sol Ring para improvisar perde 1); só se não fechar, os que dão mana, um a um. O plano leva
// improv (os ids a virar) e custo (o que sobra em mana); pagarMana vira e paga só o resto.
// convocar (CR 702.51): cada criatura sua desvirada que você vira paga {1} ou uma mana da cor dela. Mesma ordem do
// improvisar (primeiro as que não dão mana); cada uma paga um símbolo colorido dela que ainda falta, senão {1}.
const planoConvocar = (e, j, custo, x, excluir, para) => {
  const fora = new Set(excluir || []);
  const cs = e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && !o.virada && !fora.has(o.id) && M.temTipo(e, o, 'Creature'));
  const fontes = new Set(M.fontesDeMana(e, j, { soVirar: true, para }).map(f => f.id));
  const ordem = [...cs.filter(o => !fontes.has(o.id)), ...cs.filter(o => fontes.has(o.id))];
  for (let n = 0; n <= ordem.length; n++) {
    const c = { ...custo, p: [...(custo.p || [])] }; let ok = true;
    for (const o of ordem.slice(0, n)) {
      const cor = (M.dadoDe(e, o).cores || '').split('').find(k => c.p.includes(k));
      if (cor) c.p.splice(c.p.indexOf(cor), 1); else if (c.g > 0) c.g--; else { ok = false; break; }
    }
    if (!ok) break;
    const ids = ordem.slice(0, n).map(o => o.id);
    const pl = plano0(e, j, c, x, [...(excluir || []), ...ids], para);
    if (pl) return n ? { ...pl, improv: ids, custo: c } : pl;
  }
  return null;
};
// delve (CR 702.66): cada carta que você exila do seu cemitério ao conjurar paga {1} genérico. Primeiro as que não são
// criatura (a criatura pode ser alvo de reanimação), e só as que fecham; os alvos da própria mágica ficam (vêm em excluir).
const cemDelve = (e, j, excluir, para) => {
  const fora = new Set(excluir || []);
  const cs = e.jogs[j].zonas.cemiterio.filter(id => id !== para.id && !fora.has(id)).map(id => e.objs[id]);
  return [...cs.filter(o => !M.temTipo(e, o, 'Creature')), ...cs.filter(o => M.temTipo(e, o, 'Creature'))].map(o => o.id);
};
const planoDelve = (e, j, custo, x, excluir, para) => {
  const ordem = cemDelve(e, j, excluir, para), semCr = ordem.filter(id => !M.temTipo(e, e.objs[id], 'Creature')).length;
  for (let n = Math.min(custo.g || 0, semCr); n <= Math.min(custo.g || 0, ordem.length); n++) {
    const c = { ...custo, g: (custo.g || 0) - n }, pl = plano0(e, j, c, x, excluir, para);
    if (pl) return n ? { ...pl, delve: ordem.slice(0, n), custo: c } : pl;
  }
  return null;
};
const plano = (e, j, custo, x, excluir, para?) => {
  if (para && custo.g && M.temKw(e, para, 'delve')) return planoDelve(e, j, custo, x, excluir, para);
  if (para && M.temKw(e, para, 'convocar')) return planoConvocar(e, j, custo, x, excluir, para);
  if (!para || !custo.g || !M.temKw(e, para, 'improvisar')) return plano0(e, j, custo, x, excluir, para);
  const fora = new Set(excluir || []);
  const arts = e.campo.map(id => e.objs[id]).filter(o => o.ctrl === j && !o.virada && !fora.has(o.id) && M.temTipo(e, o, 'Artifact'));
  const fontes = new Set(M.fontesDeMana(e, j, { soVirar: true, para }).map(f => f.id));
  const ordem = [...arts.filter(o => !fontes.has(o.id)), ...arts.filter(o => fontes.has(o.id))].map(o => o.id);
  const semFonte = arts.filter(o => !fontes.has(o.id)).length;
  for (let n = Math.min(custo.g, semFonte); n <= Math.min(custo.g, ordem.length); n++) {
    const ids = ordem.slice(0, n), c = { ...custo, g: custo.g - n };
    const pl = plano0(e, j, c, x, [...(excluir || []), ...ids], para);
    if (pl) return n ? { ...pl, improv: ids, custo: c } : pl;
  }
  return null;
};
// maior X pagável (CR 107.3): sobe enquanto o plano fecha
function maxX(e, j, custo, excluir, para?, teto = 30) {
  let x = 0;
  while (x < teto && plano(e, j, custo, x + 1, excluir, para)) x++;
  return x;
}

// ---------- jogar de outra zona (est podeJogar, CR 601.3/305.1 com permissão): do cemitério e do topo do grimório ----------
// Fontes: permanentes do jogador (Conduit of Worlds: terrenos do cemitério; Courser of Kruphix, Oracle of Mul Daya:
// do topo, s.de 'grimorio' + afeta.topo) e a própria carta no cemitério (Gravecrawler, "as long as you control a
// Zombie" no 'se', lido com a fonte). est podeOlhar ("you may look at the top card any time", 401.5): só informação —
// o dono vê o topo (M.olhaTopo, a Mesa mostra), a IA não usa.
function permissoes(e, j) {
  const mk = M.memo && 'pj' + j;
  if (mk && M.memo[mk]) return M.memo[mk];
  const r: any[] = [];
  const le = (S, zonaFonte) => {
    for (const s of M.dadoDe(e, S).est || []) {
      if (s.modo !== 'podeJogar' || (s.de !== 'cemiterio' && s.de !== 'grimorio') || !s.afeta || typeof s.afeta !== 'object' || !M.filtroOk(s.afeta)) continue;
      if (s.de === 'grimorio' && (zonaFonte !== 'campo' || !s.afeta.topo)) continue;   // do grimório: só a do topo, com a fonte no campo
      if (zonaFonte === 'cemiterio' && !s.afeta.este) continue;      // no cemitério só vale a permissão para si mesma
      r.push({ s, ctx: { voce: j, este: S.id } });
    }
  };
  for (const id of e.campo) if (e.objs[id].ctrl === j) le(e.objs[id], 'campo');
  for (const id of e.jogs[j].zonas.cemiterio) le(e.objs[id], 'cemiterio');
  if (mk) M.memo[mk] = r;
  return r;
}
M.temPermissaoCemiterio = (e, j) => permissoes(e, j).some(p => p.s.de === 'cemiterio');
const permTopo = (e, j) => permissoes(e, j).some(p => p.s.de === 'grimorio');
// "olhe a carta do topo do seu grimório a qualquer momento" (est podeOlhar, 401.5) com a fonte no campo
M.olhaTopo = (e, j) => e.campo.some(id => { const S = e.objs[id]; return S.ctrl === j && (M.dadoDe(e, S).est || []).some(s => s.modo === 'podeOlhar' && s.afeta && s.afeta.topo && (() => { try { return M.condicao(e, s.se, { voce: j, este: id }); } catch (_) { return false; } })()); });
// permissão dada por efeito (op jogar com dura): o mesmo objeto (id e ts, CR 400.7) em qualquer zona fora do campo
M.permJogar = (e, j, o) => { const l = e.permJogar; if (!l || !l.length) return null; for (const p of l) if (p.j === j && p.id === o.id && p.ts === o.ts && o.zona !== 'campo' && o.zona !== 'pilha') return p; return null; };
// recapitular (CR 702.34): conjurar do cemitério pelo custo de recapitular; ao sair da pilha vai para o exílio (702.34a)
// flashback dado a cartas do cemitério por efeito "neste turno" (Past in Flames, 702.34a): custo = o custo de mana da carta
const flashDado = (e, o) => {
  for (const t of e.efTemp || []) for (const s of t.est) if (s.modo === 'darFlashback' && M.tempTem(t, o)) return M.dadoDe(e, o).custo || null;   // a carta alvo (Flashback, Snapcaster): presa por id+ts
  else if (s.modo === 'continuo' && s.afeta && s.afeta.zona === 'cemiterio') {
    const k = (s.kw || []).find(x => x.k === 'flashback');
    if (k && M.bate(e, o, s.afeta, { voce: t.ctrl, este: -1 })) return k.custo || M.dadoDe(e, o).custo || null;
  }
  return null;
};
const flashDe = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'flashback' && x.custo); return k ? k.custo : o.zona === 'cemiterio' && e.efTemp && e.efTemp.length ? flashDado(e, o) : null; };
const porFlash = (e, j, o) => o.zona === 'cemiterio' && o.dono === j && !!flashDe(e, o) && !M.podeJogarDe(e, j, o);
M.porFlash = porFlash;
// fuga (CR 702.138): conjurar do cemitério pagando o custo de fuga + exilar N OUTRAS cartas do seu cemitério. Da própria
// carta (kw fuga {custo, exilar, comMarc}: Ox of Agonas) ou dada por um permanente seu (est darFuga {afeta, exilar}: Underworld
// Breach, custo = o custo de mana dela). "Foge com N marcadores" (702.138c) só vale se fugiu.
const fugaDe = (e, j, o) => {
  if (o.zona !== 'cemiterio' || o.dono !== j) return null;
  const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'fuga' && x.custo && Number.isInteger(x.exilar));
  if (k) return { mana: k.custo, exilar: k.exilar, comMarc: k.comMarc || null };
  for (const id of e.campo) {
    const F = e.objs[id]; if (F.ctrl !== j) continue;
    for (const s of M.dadoDe(e, F).est || []) if (s.modo === 'darFuga' && Number.isInteger(s.exilar) && M.dadoDe(e, o).custo && M.bate(e, o, { ...s.afeta, zona: 'cemiterio' }, { voce: j, este: F.id })) return { mana: M.dadoDe(e, o).custo, exilar: s.exilar, comMarc: null };
  }
  return null;
};
const porFuga = (e, j, o) => !porFlash(e, j, o) && !M.podeJogarDe(e, j, o) && (() => { const f = fugaDe(e, j, o); return !!f && e.jogs[j].zonas.cemiterio.length - 1 >= f.exilar; })();
M.porFuga = porFuga; M.fugaDe = fugaDe;
// custo alternativo da própria carta (CR 118.9): "você pode conjurar sem pagar o custo de mana se controla um
// comandante" (Deflecting Swat, Fierce Guardianship) ou outro custo de mana. Lido: afeta 'este' com gratis ou
// pagar.mana, e 'se'. Simplificação: usa o alternativo sempre que sai mais barato (ninguém pagaria mais). Pagar vida,
// com parte física (Force of Will, Sephara, Flare of Fortitude): estAltFisOk, uma opção de conjurar {alt: i}.
// Dado por uma permanente sua a outras cartas (afeta filtro: Dracogenesis, Rooftop Storm, Bolas's Citadel, Demon of
// Fate's Design): grátis, {0}, mana, ou vida (pagar.vida: número ou {conta:{de:'evento', o:'vm'}} = o valor de mana da mágica;
// CR 119.4: só paga quem tem essa vida). limite 1 = uma vez por turno. Simplificação: vida só quando sobram mais de 10.
const altVidaOk = v => { if (Number.isInteger(v)) return true; const q = M.qn(v); return !!q && typeof q === 'object' && Object.keys(q).length === 1 && !!q.conta && q.conta.de === 'evento' && q.conta.o === 'vm' && Object.keys(q.conta).length === 2; };   // nome velho vmDoEvento entra por M.qn (contagem.ts)
// só mana/grátis desta carta, ou dado por permanente sua (afeta filtro; pode ser {0}, mana ou vida)
const estAltManaOk = s => !!s && s.modo === 'custoAlternativo' && (s.afeta === 'este' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && Object.keys(s).every(k => ['modo', 'afeta', 'gratis', 'pagar', 'se', ...(s.afeta === 'este' ? [] : ['limite'])].includes(k)) && (s.limite === undefined || s.limite === 1)
  && (s.gratis === true ? !s.pagar : !!s.pagar && (Object.keys(s.pagar).length === 0 ? s.afeta !== 'este'
    : Object.keys(s.pagar).length === 1 && (!!s.pagar.mana || (s.afeta !== 'este' && altVidaOk(s.pagar.vida))))) && (!s.se || M.seOk(s.se));
// alternativo com parte física (Force of Will: 1 de vida + exilar uma carta azul da mão; Sephara: {W} + virar quatro
// criaturas com voar): vira uma opção de conjurar ({alt: i}, 601.2b) — paga a mana dele (com imposto, 601.2f) e o resto
// como custo físico. O agente básico pega a primeira opção que fecha: o custo normal vem antes.
const estAltFisOk = s => !!s && s.modo === 'custoAlternativo' && s.afeta === 'este' && Object.keys(s).every(k => ['modo', 'afeta', 'pagar', 'se'].includes(k))
  && !!s.pagar && Object.keys(s.pagar).some(k => k !== 'mana') && M.custoSuportado(s.pagar) && (!s.se || M.seOk(s.se));
M.estAltOk = s => estAltManaOk(s) || estAltFisOk(s);
const altFis = (e, j, o, d) => (d.est || []).map((s, i) => [s, i]).filter(([s]) => estAltFisOk(s)).filter(([s]) => {
  if (!s.se) return true; try { return M.condicao(e, s.se, { voce: j, este: o.id }); } catch (_) { return false; } }).map(([, i]) => i);
const fisAlt = (d, opc) => { const { mana, ...r } = d.est[opc.alt].pagar; return r; };
// o alternativo dado pelas permanentes de j que vale para o (com o F e a estática, para marcar o limite)
const altDados = (e, j, o) => {
  const r: any[] = [];
  for (const id of e.campo) {
    const F = e.objs[id]; if (F.ctrl !== j || F.id === o.id) continue;
    for (const s of M.dadoDe(e, F).est || []) {
      if (s.modo !== 'custoAlternativo' || s.afeta === 'este' || !M.estAltOk(s)) continue;
      const cx = { voce: j, este: F.id };
      try { if (!M.bate(e, o, s.afeta, cx) || (s.se && !M.condicao(e, s.se, cx))) continue; } catch (_) { continue; }
      if (s.limite && F.altUso && F.altUso.t === e.turno.n && F.altUso.ts === F.ts) continue;
      const vida = s.pagar && s.pagar.vida !== undefined ? (Number.isInteger(s.pagar.vida) ? s.pagar.vida : M.dadoDe(e, o).vm || 0) : 0;
      if (vida && e.jogs[j].vida - vida <= 10) continue;
      r.push({ custo: s.gratis ? {} : s.pagar.mana || {}, vida, F, s });
    }
  }
  return r;
};
const altDe = (e, j, o) => altInfo(e, j, o)?.custo;
const altInfo = (e, j, o) => {
  let melhor: any = null, info: any = null;
  for (const s of M.dadoDe(e, o).est || []) {
    if (s.afeta !== 'este' || !estAltManaOk(s) || !(s.gratis || s.pagar.mana)) continue;
    if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, { voce: j, este: o.id }); } catch (_) { ok = false; } if (!ok) continue; }
    const c = s.gratis ? {} : s.pagar.mana;
    if (!melhor || M.vmDe(c) < M.vmDe(melhor)) melhor = c;
  }
  for (const a of altDados(e, j, o)) if (!melhor || M.vmDe(a.custo) < M.vmDe(melhor) || (M.vmDe(a.custo) === M.vmDe(melhor) && info && a.vida < info.vida)) { melhor = a.custo; info = a; }
  // rondar (702.76a): custo alternativo se neste turno você causou dano de combate a um jogador com uma fonte que tem um tipo de criatura desta
  const D = e.jogs[j].danoCombT, ro = (M.dadoDe(e, o).kw || []).find(x => x.k === 'rondar' && x.custo);
  if (ro && D && D.t === e.turno.n && (M.dadoDe(e, o).sub || []).some(s => D.sub.includes(s)) && (!melhor || M.vmDe(ro.custo) < M.vmDe(melhor))) { melhor = ro.custo; info = null; }
  if (!melhor) return undefined;
  if (info && info.custo !== melhor) info = null;
  return M.vmDe(melhor) < M.vmDe(M.dadoDe(e, o).custo || {}) ? { custo: melhor, ...(info ? { F: info.F, s: info.s, vida: info.vida } : {}) } : undefined;
};
M.altDe = (e, j, o) => altDe(e, j, o);
// o custo alternativo que o custoBase usa (o mesmo encadeamento): para pagar a vida e marcar o limite na conjuração
const altUsado = (e, j, o, opts) => opts.loucura || opts.milagre || (porFlash(e, j, o) && !opts.gratis) || (porFuga(e, j, o) && !opts.gratis) || (porPrevisao(e, j, o) && !opts.gratis) || opts.gratis || (M.permJogar(e, j, o) || {}).gratis ? undefined : altInfo(e, j, o);
const custoBase = (e, j, o, opts) => opts.loucura ? custoLoucura(e, o) : opts.milagre ? M.milagreDe(e, o) : porFlash(e, j, o) && !opts.gratis ? flashDe(e, o) : porFuga(e, j, o) && !opts.gratis ? (fugaDe(e, j, o) as any).mana : porPrevisao(e, j, o) && !opts.gratis ? M.previsaoDe(e, o) : opts.gratis || (M.permJogar(e, j, o) || {}).gratis ? {} : altDe(e, j, o);
M.podeJogarDe = (e, j, o) => !!M.permJogar(e, j, o) || (o.zona === 'cemiterio' || o.zona === 'grimorio') && o.dono === j && permissoes(e, j).some(({ s, ctx }) => {
  if (s.de !== o.zona) return false;
  try { return M.bate(e, o, s.afeta, ctx) && M.condicao(e, s.se, ctx); } catch (_) { return false; }
});

// ---------- o que pode ser conjurado ----------
// Faces que dá para anunciar (a escolha vem antes de ir para a pilha: 709.3, 712.8b, 716.3, 702.102a):
// modal, as duas; aventura, a criatura ou a Aventura (do exílio da aventura, só a criatura: 716.3d);
// split, uma metade ou as duas fundidas (fusão só da mão, 702.102a); dupla face que transforma, só a frente (712.8).
const temFusao = c => (c.kw || []).some(k => k.k === 'fusao');
M.facesParaConjurar = (e, j, o) => {
  if (o.copiaPrep) return [0];                                      // a cópia preparada é só a mágica
  const c = o.ficha ? null : M.carta(o.n);
  switch (c && c.faces && c.forma) {
    case 'modal': return [undefined, 0];
    case 'aventura': return o.zona === 'exilio' ? [undefined] : [undefined, 0];
    case 'split': return o.zona === 'mao' && temFusao(c) ? ['esq', 0, 'fundida'] : ['esq', 0];
    default: return [undefined];
  }
};
// carta exilada pela própria aventura: o dono pode conjurá-la enquanto ela ficar lá (716.3d)
const daAventura = (e, j, o) => o.zona === 'exilio' && o.aventura === j;
// prever (702.143): no seu turno, pague {2} e exile da mão (ação especial, 116.2h); num turno seguinte, conjure do exílio pelo custo de prever
M.previsaoDe = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'prever' && x.custo); return k ? k.custo : null; };
const porPrevisao = (e, j, o) => o.zona === 'exilio' && o.previsto != null && o.previsto < e.turno.n && o.dono === j && !!M.previsaoDe(e, o);
M.podePrever = (e, j, o) => o.zona === 'mao' && o.dono === j && e.turno.ativo === j && !!M.previsaoDe(e, o) && !!plano(e, j, { g: 2 }, 0, null, o);
M.prever = (e, j, id) => {
  const o = e.objs[id], pl = M.podePrever(e, j, o) && plano(e, j, { g: 2 }, 0, null, o); if (!pl) return;
  pagarMana(e, j, pl, { g: 2 }, 0);
  M.mover(e, id, 'exilio'); o.previsto = e.turno.n;
  M.log(e, e.jogs[j].nome, 'prevê uma carta (exila virada)');
  M.agiu(e, j);
};
// cópia da mágica de preparo no exílio: só o controlador da criatura preparada (regras do preparar)
const porPreparo = (e, j, o) => !!o.copiaPrep && o.zona === 'exilio' && M.prepValida(e, o) && e.objs[o.copiaPrep.id].ctrl === j;
// só a face que vai ficar para cima é avaliada (712.8c, 709.3a, 716.3a): avalia com o.face trocada e devolve
// opts.loucura: a carta exilada pela loucura, conjurada na resolução do gatilho (CR 702.35b), sem olhar a velocidade
M.podeConjurar = (e, j, o, face?, opts?) => {
  const antes = o.face;
  o.face = face ?? null;
  try { return podeConjurarFace(e, j, o, face, opts || {}); } finally { o.face = antes; }
};
// loucura (702.35): da carta ou dada por um permanente do dono (est darLoucura {afeta}: Falkenrath Gorger, custo = o custo de mana dela)
M.loucuraDe = (e, o) => {
  const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'loucura' && x.custo);
  if (k) return k.custo;
  if (o.zona === 'campo' || !M.dadoDe(e, o).custo) return null;
  for (const id of e.campo) {
    const F = e.objs[id]; if (F.ctrl !== o.dono) continue;
    for (const s of M.dadoDe(e, F).est || []) if (s.modo === 'darLoucura' && M.bate(e, o, { ...(s.afeta || {}), zona: o.zona }, { voce: o.dono, este: F.id })) return M.dadoDe(e, o).custo;
  }
  return null;
};
const custoLoucura = (e, o) => M.loucuraDe(e, o);
function podeConjurarFace(e, j, o, face, opts: any = {}) {
  const louc = !!opts.loucura && o.zona === 'exilio' && o.loucura && !!custoLoucura(e, o);
  const milag = !!opts.milagre && o.zona === 'mao' && !!M.milagreDe(e, o);   // milagre (702.94a): na resolução do gatilho, sem olhar a velocidade
  const agora = !!opts.agora && o.zona !== 'campo' && o.zona !== 'pilha';   // op jogar sem dura: na resolução, de onde estiver
  const d = M.dadoDe(e, o);
  if (o.dono !== j && !agora && !M.permJogar(e, j, o)) return false;
  if (M.temTipo(e, o, 'Land') || !d.custo) return false;          // terreno não é conjurado (CR 305.9); sem custo = só alternativo (T19)
  if (M.naoConjura(e, j)) return false;
  if (!(louc || agora || porFlash(e, j, o) || porFuga(e, j, o) || o.zona === 'mao' || (o.zona === 'comando' && o.cmd) || M.podeJogarDe(e, j, o) || (daAventura(e, j, o) && face == null) || porPreparo(e, j, o) || porPrevisao(e, j, o))) return false;   // mão, comando, permissão (podeJogar), aventura ou loucura
  if ((d.sub || []).includes('Aura') || M.temKw(e, o, 'encantar')) return false;   // Aura mira ao conjurar: anexar = T18
  const inst = M.temTipo(e, o, 'Instant') || M.temKw(e, o, 'lampejo') || M.lampejoDado(e, j, o);
  if (!inst && !louc && !milag && !agora && !M.velFeitico(e, j)) return false;
  if (d.fx && !M.fxSuportado(d.fx)) return false;
  if (!M.ehPermanente(e, o) && !(d.fx && d.fx.length)) return false;   // mágica sem efeito lido: não conjura à toa
  if (modalTopo(d) && M.modosViaveis(e, j, d) < ((d.fx[0].escolhe || {}).min ?? 1)) return false;
  const alts = d.custoAd ? altsAd(e, j, o, d.custoAd) : null;
  if (alts && !alts.length) return false;   // custo adicional (com "ou": basta um pagável)
  const usados = alvosUsados(modalTopo(d) ? [] : d.fx || []);
  if (usados.some(i => !(d.alvos || [])[i] || !M.alvoSuportado(d.alvos[i]))) return false;
  const custo0 = M.custoComImposto(e, o, custoBase(e, j, o, opts));
  const cs = alts ? [...new Set(alts.map(a => a.mana ? M.somaCusto(custo0, a.mana) : custo0))] : [custo0];   // "ou pague {1}": a mana entra no total
  return cs.some(c0 => opcoesConj(e, j, d, opts.gratis || opts.loucura || opts.milagre ? undefined : o).some(opc => opcOk(e, j, d, usados, c0, opc, o)));
}
// a combinação de opções fecha? alvos ativos com escolha legal (CR 601.2c) e custo pagável
function opcOk(e, j, d, usados, custo0, opc, o) {
  const ctx = { voce: j, este: o.id };
  for (const i of usados) {
    const a = d.alvos[i];
    if (!alvoAtivo(a, opc)) continue;
    if ((a.min ?? 1) > 0 && M.alvosPossiveis(e, a, ctx).length < (a.min ?? 1)) return false;
  }
  if (opc.alt !== undefined && !custoFisicoOk(e, j, null, fisAlt(d, opc), { daMao: o.id })) return false;
  const custo = custoOpc(d, custo0, opc, e, o);
  if (M.vmDe(custo) > manaMax(e, j, null, o) + Math.floor(vidaPhy(e, j) / 2)) return false;
  return !!plano(e, j, custo, 0, null, o);
}
const modalTopo = d => d.fx && d.fx.length === 1 && d.fx[0].op === 'modal';

// ---------- o que pode ser ativado (CR 602.2; lealdade CR 606) ----------
// atv.se = "ative só se …" (602.5b; também na de mana: Mox Opal, Sarevok's Tome). Condição que o motor não lê: não ativa.
M.atvSeOk = (e, a, o) => { if (!a.se) return true; if (!M.seOk(a.se)) return false; try { return M.condicao(e, a.se, { voce: o.ctrl, este: o.id }); } catch (_) { return false; } };
M.podeAtivar = (e, j, o, k) => {
  const d = M.dadoDe(e, o), a = M.atvDe(e, o)[k];
  if (!a || a.deMana || o.ctrl !== j || o.zona !== (a.zona || 'campo')) return false;
  if (o.zona === 'campo' && M.ativBloqueada(e, o)) return false;   // Linvala, Myrel (602.5)
  if (!M.atvSeOk(e, a, o)) return false;                             // "Activate only if …" (602.5b)
  if ((d.falta || []).some(s => s.startsWith('Cost'))) return false;   // custo que o conversor não leu: não ativa errado
  if (!M.custoSuportado(a.custo) || !(a.fx && a.fx.length) || !M.fxSuportado(a.fx, { topo: false })) return false;
  if (a.lealdade !== undefined) {                                     // CR 606.3: feitiço, uma por turno por permanente
    if (!M.velFeitico(e, j) || o.lealTurno === e.turno.n) return false;
    if (a.lealdade < 0 && (o.marc.lealdade || 0) < -a.lealdade) return false;
  } else if (a.vel === 'feitico' && !M.velFeitico(e, j) && !(a._equipar && e.turno.ativo === j && M.estSeu(e, j, 'equiparComoInstantanea'))) return false;   // Forge Anew: no seu turno, equipar na velocidade de instantânea
  if (a.limite === 'umaPorTurno' && (o.usos || {})[k] === e.turno.n) return false;
  if (a._nivel && (o.nivel || 1) !== a._nivel - 1) return false;      // CR 716.2a: só do nível N−1
  if (a._soltar && !o.anexo) return false;                            // reconfigurar: soltar só se anexada (702.151a)
  if (!custoFisicoOk(e, j, o, a.custo, { daMao: a.custo.descartarEste ? o.id : undefined })) return false;
  const ctx = { voce: j, este: o.id };
  for (const i of alvosUsados(a.fx)) {
    const al = (a.alvos || [])[i];
    if (!al || !M.alvoSuportado(al)) return false;
    if ((al.min ?? 1) > 0 && M.alvosPossiveis(e, al, ctx).length < (al.min ?? 1)) return false;
  }
  if (a.custo.mana) {
    const ex = a.custo.virar || a.custo.sacrificar === 'este' || (a.custo.sacrificar && a.custo.sacrificar.comEste) || a.custo.devolver === 'este' ? [o.id] : [];
    if (!plano(e, j, M.custoAtv(e, o, a), 0, ex)) return false;
  }
  return true;
};

// ---------- mana com escolha no custo (CR 605.3: não usa a pilha) ----------
// Altares, Krark-Clan, Gilded Goose (sacrificar outra), Steam-Kin/Ramos (tirar marcador), Simian Spirit Guide (exilar
// da mão). Fica fora do solver automático (sacrificaria sem querer): é uma ação de prioridade que pergunta o custo.
// mana restrita (so: Master of Dark Rites): a parte restrita vai para J.restrita (CR 106.6) e só a mágica que bate a gasta.
M.manaEscSuportada = a => !!(a && a.deMana && a.custo && !M.custoManaOk(a.custo) && M.custoSuportado(a.custo) && !a.custo.descartar && !a.custo.devolver && (a.fx || []).every(f => f.op === 'mana' && (!f.so || M.filtroSo({}, f.so))));   // restrita: vai para J.restrita (106.6)
M.podeManaEsc = (e, j, o, k) => {
  const a = M.atvDe(e, o)[k];
  if (!M.manaEscSuportada(a) || o.ctrl !== j || o.zona !== (a.zona || 'campo')) return false;
  if (!M.atvSeOk(e, a, o)) return false;
  if (a.limite === 'umaPorTurno' && (o.usos || {})[k] === e.turno.n) return false;
  if (a.custo.mana && !M.pagarDaReserva(e.jogs[j].reserva, a.custo.mana)) return false;   // a mana do custo sai da reserva
  return custoFisicoOk(e, j, o, a.custo);
};
const pacotesEsc = (e, o, a) => (M.pacotesDe(e, o, a, { comSo: true }) || []).filter(p => M.somaMana(p) > 0);
// a parte restrita (so) de uma habilidade de mana com escolha: {m, f}; uma restrição só por habilidade (Master of Dark Rites)
const restritaEsc = (e, o, a) => {
  const fs = (a.fx || []).filter(f => f.so); if (!fs.length) return null;
  const m = M.zeroMana();
  for (const f of fs) { const cs = M.coresDeProd(e, o, f.prod) || []; if (cs.length === 1) m[cs[0]] += M.qtd(e, f.qtd, { voce: o.ctrl, este: o.id }) || 0; }
  return { m, f: M.filtroSo(o, fs[0].so) };
};
M.fmtFiltroSo = f => [...(f.super || []), ...(f.sub || []), ...(f.tipo || [])].join('/');
M.manaEscOps = (e, j) => {
  const ops: any[] = [];
  const ve = id => { const o = e.objs[id]; M.atvDe(e, o).forEach((a, k) => { if (M.podeManaEsc(e, j, o, k)) pacotesEsc(e, o, a).forEach((_, i) => ops.push({ a: 'manaEsc', id, k, escolha: i })); }); };
  for (const id of e.campo) if (e.objs[id].ctrl === j) ve(id);
  for (const id of e.jogs[j].zonas.mao) ve(id);
  return ops;
};
M.manaEsc = (e, j, id, k, escolha = 0) => M.iniciarProc(e, { tp: 'manaEsc', j, id, k, escolha });

// ---------- prioridade (CR 117) ----------
M.temPrioridadeNoPasso = passo => passo !== 'desvirar' && passo !== 'limpeza';   // CR 502.4, 514.3
M.proxVivo = (e, j) => { const n = e.jogs.length; let p = j; do p = (p + 1) % n; while (e.jogs[p].saiu && p !== j); return p; };

// opções de quem tem prioridade. O núcleo só pergunta quando há algo além de passar e virar mana.
M.opcoesPrioridade = (e, j) => {
  M.memo = {};                                                        // nada muda enquanto lista: fontes de mana uma vez só
  try { return M.lote(() => opcoes(e, j)); } finally { M.memo = null; }
};
function opcoes(e, j) {
  const J = e.jogs[j], ops: any[] = [{ a: 'passar' }];
  if (M.velFeitico(e, j) && J.terrenos < M.terrenosPorTurno(e, j))      // CR 305.2 (+ 305.2a)
    for (const id of J.zonas.mao) {
      if (M.temTipo(e, e.objs[id], 'Land')) ops.push({ a: 'terreno', id });
      if (M.faceTerreno(e, e.objs[id])) ops.push({ a: 'terreno', id, face: 0 });   // modal: joga a face de terreno (712.9)
    }
  const doCem = M.temPermissaoCemiterio(e, j) ? J.zonas.cemiterio : [];
  const G = J.zonas.grimorio, doTopo = G.length && permTopo(e, j) && M.podeJogarDe(e, j, e.objs[G[G.length - 1]]) ? [G[G.length - 1]] : [];   // Courser, Oracle of Mul Daya
  for (const id of J.zonas.mao) if (M.podePrever(e, j, e.objs[id])) ops.push({ a: 'prever', id });   // 702.143a: no seu turno, com prioridade
  if (M.velFeitico(e, j) && J.terrenos < M.terrenosPorTurno(e, j))
    for (const id of [...doCem, ...doTopo]) if (M.temTipo(e, e.objs[id], 'Land') && M.podeJogarDe(e, j, e.objs[id])) ops.push({ a: 'terreno', id });
  const doExilio = J.zonas.exilio.filter(id => daAventura(e, j, e.objs[id]) || porPreparo(e, j, e.objs[id]) || porPrevisao(e, j, e.objs[id]));
  const doFlash = doCem.length ? [] : J.zonas.cemiterio.filter(id => flashDe(e, e.objs[id]) || porFuga(e, j, e.objs[id]));   // recapitular (702.34), fuga (702.138)
  // permissões de efeito (op jogar): o que não está na mão/comando/cemitério já listados; terreno com permissão de jogar
  const ja = new Set([...J.zonas.mao, ...J.zonas.comando, ...doCem, ...doTopo, ...doExilio, ...doFlash]), doPerm: number[] = [];
  for (const p of e.permJogar || []) { const o = e.objs[p.id]; if (p.j === j && o && o.ts === p.ts && !ja.has(p.id) && o.zona !== 'campo' && o.zona !== 'pilha') { ja.add(p.id); doPerm.push(p.id); } }
  if (M.velFeitico(e, j) && J.terrenos < M.terrenosPorTurno(e, j))
    for (const id of doPerm) { const p = M.permJogar(e, j, e.objs[id]); if (p && !p.soConjurar && M.temTipo(e, e.objs[id], 'Land')) ops.push({ a: 'terreno', id }); }
  for (const id of [...J.zonas.mao, ...J.zonas.comando, ...doCem, ...doTopo, ...doExilio, ...doFlash, ...doPerm])
    for (const face of M.facesParaConjurar(e, j, e.objs[id]))
      if (M.podeConjurar(e, j, e.objs[id], face)) ops.push(face === undefined ? { a: 'conjurar', id } : { a: 'conjurar', id, face });
  for (const id of e.campo) {
    const o = e.objs[id]; if (o.ctrl !== j) continue;
    M.atvDe(e, o).forEach((a, k) => { if (!a.deMana && M.podeAtivar(e, j, o, k)) ops.push({ a: 'ativar', id, k }); });
  }
  // habilidade ativada da mão (atv zona 'mao': canalizar, Trumpeting Carnosaur)
  for (const id of J.zonas.mao) {
    const o = e.objs[id], l = M.atvDe(e, o);
    // só a que tira a carta da mão no custo: sem isso (banco antes da correção 15) ativaria de graça sem parar ninjutsu: a carta sai da mão ao resolver (e o custo devolve um atacante)
    for (let k = 0; k < l.length; k++) if (l[k].zona === 'mao' && !l[k].deMana && (l[k].custo.descartarEste || l[k].custo.exilarEste || l[k]._ninjutsu) && M.podeAtivar(e, j, o, k)) ops.push({ a: 'ativar', id, k });
  }
  // do cemitério: só a que exila a própria carta no custo (eternizar, Kheru Goldkeeper, bis 702.141a) — não repete sem parar
  for (const id of J.zonas.cemiterio) {
    const o = e.objs[id], l = M.atvDe(e, o);
    for (let k = 0; k < l.length; k++) if (l[k].zona === 'cemiterio' && !l[k].deMana && l[k].custo && l[k].custo.exilarEste && M.podeAtivar(e, j, o, k)) ops.push({ a: 'ativar', id, k });
  }
  for (const f of M.fontesDeMana(e, j)) f.pacotes.forEach((p, k) => ops.push({ a: 'mana', id: f.id, k: f.k, escolha: k }));
  ops.push(...M.manaEscOps(e, j));
  return ops;
}

// um passo do laço de prioridade; devolve true se perguntou ou mudou algo
M.passoPrioridade = e => {
  const T = e.turno;
  if (!T.prio) T.prio = { j: T.ativo, n: 0 };                          // CR 117.3a: o ativo recebe primeiro
  const P = T.prio, vivos = M.vivos(e).length;
  if (e.jogs[P.j].saiu) P.j = M.proxVivo(e, P.j);
  if (P.n >= vivos) {                                                 // CR 117.4: todos passaram em sequência
    if (e.pilha.length) { M.resolverTopo(e); P.j = T.ativo; P.n = 0; if (e.jogs[P.j].saiu) P.j = M.proxVivo(e, P.j); return 'resolveu'; }
    return 'fim';                                                     // pilha vazia: acaba a etapa
  }
  const ops = M.opcoesPrioridade(e, P.j);
  if (ops.some(o => o.a !== 'passar' && o.a !== 'mana')) { e.perg = { j: P.j, tipo: 'acao', ops }; return 'perg'; }
  M.passar(e);
  return 'passou';
};
M.passar = e => { const P = e.turno.prio; P.n++; P.j = M.proxVivo(e, P.j); };
M.agiu = (e, j) => { const P = e.turno.prio; if (P) { P.n = 0; P.j = j; } };   // CR 117.3c: quem age recebe de novo

// ---------- conjurar (CR 601.2) ----------
// Ordem da CR: anunciar (move para a pilha), modos, X, alvos, custos. Aqui as escolhas vêm primeiro e a carta só
// vai para a pilha quando tudo fecha — o resultado é o mesmo (nada do jogo muda entre um passo e outro).
// cabe(n): o custo ainda fecha com n alvos no total (impostoPorAlvo, CR 601.2f); sem ele, qualquer número.
// o alvo-jogador i é o primeiro de jogador e o efeito que o usa é bom para quem ganha (Éomer: "target player becomes the monarch")
const paraSi = (fx, alvos, i) => (alvos || []).findIndex(a => a && (a.f === 'jogador' || a.f === 'qualquerAlvo')) === i && (fx || []).some(f => f && f.op === 'virarMonarca' && f.quem === 'alvoJogador');
// de que jogador é o alvo: o próprio jogador; permanente = quem controla; carta fora do campo = o dono (Afterlife from the Loam)
const jogDoAlvo = (e, x) => x.jog !== undefined ? x.jog : e.objs[x.o].zona === 'campo' ? e.objs[x.o].ctrl : e.objs[x.o].dono;
function escolherAlvos(e, j, d, fx, ctx, ask, cabe?: (n: number) => boolean, opc?: any) {
  const esc: any[] = [];
  let total = 0;
  for (const i of alvosUsadosDe(d, fx)) {
    if (!alvoAtivo(d.alvos[i], opc)) { esc[i] = []; continue; }     // alvo de outra opção (chute/presente)
    const a = d.alvos[i], min = a.min ?? 1, max = a.max === 'qualquer' ? Infinity : a.max ?? 1, lista: any[] = [];
    while (lista.length < max) {
      let ops = M.alvosPossiveis(e, a, ctx).filter(x => !lista.some(y => mesmo(x, y)) && !(Number.isInteger(a.diferenteDe) && (esc[a.diferenteDe] || []).some(y => mesmo(x, y)))).map(x => ({ a: 'alvo', ...x }));   // CR 115.3; diferenteDe: "another target" (Markov Retribution)
      if (a.porJogador || a.porOponente) ops = ops.filter(x => { const jx = jogDoAlvo(e, x); return (!a.porOponente || jx !== ctx.voce) && !lista.some(y => jogDoAlvo(e, y) === jx); });   // "for each player/opponent, up to one target … that player controls/owns" (até 1 de cada)
      if (lista.length >= min && cabe && !cabe(total + 1)) ops = [];   // mais um alvo não dá para pagar
      if (lista.length >= min) ops.unshift({ a: 'pronto' });
      if (!ops.length || (ops.length === 1 && ops[0].a === 'pronto' && max === Infinity)) break;
      const r = ask(j, 'alvo', ops, { i, de: ctx.este, ...(paraSi(fx, d.alvos, i) ? { paraSi: true } : {}) });
      if (r.a === 'pronto') break;
      lista.push(r.jog !== undefined ? { jog: r.jog } : { o: r.o, ts: r.ts }); total++;
    }
    esc[i] = lista;
    if (a.dividir === true && lista.length) dividir(e, j, fx, i, lista, ctx, ask);
  }
  return esc;
}
M.escolherAlvos = escolherAlvos;
// CR 601.2d: "distribua N entre…": quem conjura/põe na pilha divide agora, ao menos 1 para cada alvo; a parte fica
// no alvo escolhido (esc.n). Alvo que ficar ilegal perde a parte (608.2b). N = o qtd do efeito que usa o alvo.
function dividir(e, j, fx, i, lista, ctx, ask) {
  const f = (fx || []).find(x => x.em && x.em.alvo === i), q = f && f.qtd;
  let resto = typeof q === 'number' ? q : q === 'X' ? ctx.x || 0 : 0;
  for (let k = 0; k < lista.length; k++) {
    const faltam = lista.length - k - 1, mx = resto - faltam;
    const n = k === lista.length - 1 ? resto : ask(j, 'dividir', Array.from({ length: Math.max(1, mx) }, (_, v) => ({ a: 'dividir', v: Math.max(1, mx) - v })), { i, k }).v;
    lista[k].n = n; resto -= n;
  }
}
M.parteDividida = (ctx, f, alvoObj, jog?) => {
  const ia = f.em && typeof f.em.alvo === 'number' ? f.em.alvo : -1, def = ia >= 0 && (ctx.defAlvos || [])[ia];
  if (!def || def.dividir !== true) return null;
  const x = (ctx.alvos[ia] || []).find(a => jog !== undefined ? a.jog === jog : a.o === alvoObj.id);
  return x ? x.n || 0 : 0;
};
// "torna-se alvo" (CR 115.1, 603.2): um evento por objeto escolhido, quando a mágica/habilidade fica na pilha
M.eventosAlvo = (e, alvos, por) => {
  const vistos = new Set<any>();
  for (const l of alvos || []) for (const a of l || []) if (a.o !== undefined && !vistos.has(a.o)) { vistos.add(a.o); M.evento(e, { ev: 'alvoDe', id: a.o, por }); }
}; M.alvosUsados = fx => alvosUsados(fx);
const mesmo = (x, y) => (x.jog !== undefined ? x.jog === y.jog : x.o === y.o);

// modo dá para escolher: efeitos que o núcleo sabe e alvos com opção legal (CR 601.2c)
function modoViavel(e, j, d, fx) {
  if (!M.fxSuportado(fx, { topo: false })) return false;
  return alvosUsados(fx).every(i => { const a = (d.alvos || [])[i]; return a && M.alvoSuportado(a) && ((a.min ?? 1) === 0 || M.alvosPossiveis(e, a, { voce: j }).length >= (a.min ?? 1)); });
}
M.modosViaveis = (e, j, d) => d.fx[0].modos.filter(m => modoViavel(e, j, d, m)).length;
function escolherModos(e, j, d, f, ask, de?) {
  const es = f.escolhe || { min: 1, max: 1 }, n = f.modos.length;
  let max = es.max ?? 1;
  if (es.maxSe && M.condicao(e, es.maxSe.se, { voce: j })) max = es.maxSe.max;
  const modos: any[] = [];
  // "escolha um que não foi escolhido neste turno" (Monument to Endurance): memória por objeto (id+ts, 400.7) e turno
  const F = es.naoRepeteNoTurno && de !== undefined ? e.objs[de] : null, chave = F ? de + ':' + F.ts : null;
  const MT = chave ? (e.modosTurno && e.modosTurno.t === e.turno.n ? e.modosTurno : (e.modosTurno = { t: e.turno.n, usados: {} })) : null;
  const jaUsados = MT ? MT.usados[chave as string] || [] : [];
  while (modos.length < Math.min(max, n)) {
    const ops: any[] = [];
    if (modos.length >= (es.min ?? 1)) ops.push({ a: 'pronto' });
    for (let m = 0; m < n; m++) if (!modos.includes(m) && !jaUsados.includes(m) && modoViavel(e, j, d, f.modos[m])) ops.push({ a: 'modo', m });   // CR 700.2d
    if (!ops.length || (ops.length === 1 && ops[0].a === 'pronto')) break;
    const r = ask(j, 'modo', ops, { de, modos: f.modos });
    if (r.a === 'pronto') break;
    modos.push(r.m);
  }
  if (MT) MT.usados[chave as string] = jaUsados.concat(modos);
  return modos.sort((a, b) => a - b);
}
// fx efetivo: modal no topo → só os modos escolhidos, em ordem (CR 700.2)
const fxEfetivo = (d, fx, modos) => modos && fx.length === 1 && fx[0].op === 'modal' ? modos.flatMap(m => fx[0].modos[m]) : fx;
M.fxEfetivo = fxEfetivo;
M.escolherModos = (e, j, d, f, ask, de?) => escolherModos(e, j, d, f, ask, de);

// custo físico com escolha (sacrificar X, descartar)
// custo adicional com "ou" (Demand Answers): cada opção junta o resto do objeto; só as suportadas e pagáveis agora
const opcoesAd = c => { const { ou, ...resto } = c; return ou ? ou.map(a => ({ ...resto, ...a })) : [c]; };
// "pague X de vida" como custo adicional (Toxic Deluge, CR 601.2b/119.4): o X é anunciado na conjuração (vidaX)
const vidaX = c => !!c && c.vida === 'X' && !c.ou;
M.custoAdSuportado = c => vidaX(c) ? M.custoSuportado({ ...c, vida: 1 }) : opcoesAd(c).some(M.custoSuportado);
function altsAd(e, j, o, c) {
  if (vidaX(c)) return M.vidaFixa(e, j) ? [{ ...c, vida: 0 }] : [c];   // 119.8: vida fixa só paga X = 0
  return opcoesAd(c).filter(a => M.custoSuportado(a) && custoFisicoOk(e, j, null, a, { daMao: o.id }));
}
function escolherAd(e, j, o, c, ask) {
  const alts = altsAd(e, j, o, c);
  if (alts.length <= 1) return alts[0] || c;
  return ask(j, 'custoOu', alts.map(v => ({ a: 'custoOu', v })), { id: o.id }).v;
}
function escolherCustoFisico(e, j, c, fonte, daMao, ask) {
  const r = { sac: [] as any[], desc: [] as any[], dev: [] as any[], vir: [] as any[], rev: [] as any[], exi: [] as any[] };
  if (c.exilarDe) {
    for (let i = 0; i < (c.exilarDe.qtd || 1); i++) {
      const ops = candExi(e, j, c, daMao || fonte).filter(o => !r.exi.includes(o.id)).map(o => ({ a: 'exilar', id: o.id }));
      r.exi.push(ask(j, 'custo', ops, { o: 'exilar' }).id);
    }
  }
  if (c.revelar) {
    for (let i = 0; i < (c.revelar.qtd || 1); i++) {
      const ops = candRev(e, j, c, daMao).filter(o => !r.rev.includes(o.id)).map(o => ({ a: 'revelar', id: o.id }));
      r.rev.push(ask(j, 'custo', ops, { o: 'revelar' }).id);
    }
  }
  if (c.virarOutros && c.virarOutros.poder !== undefined) {        // "vire criaturas com poder total N ou mais" (tripular, 702.122a)
    let soma = 0;
    while (soma < c.virarOutros.poder) {
      const ops = candVir(e, j, c, fonte).filter(o => !r.vir.includes(o.id) && M.poder(e, o) > 0).map(o => ({ a: 'virar', id: o.id }));
      if (!ops.length) break;
      const id = ask(j, 'custo', ops, { o: 'virar' }).id; r.vir.push(id); soma += M.poder(e, e.objs[id]);
    }
  } else if (c.virarOutros) {
    for (let i = 0; i < (c.virarOutros.qtd || 1); i++) {
      const ops = candVir(e, j, c, fonte).filter(o => !r.vir.includes(o.id)).map(o => ({ a: 'virar', id: o.id }));
      r.vir.push(ask(j, 'custo', ops, { o: 'virar' }).id);
    }
  }
  if (c.sacrificar && c.sacrificar !== 'este') {
    for (let i = 0; i < (c.sacrificar.qtd || 1); i++) {
      const ops = candSac(e, j, c, fonte).filter(o => !r.sac.includes(o.id)).map(o => ({ a: 'sacrificar', id: o.id }));
      r.sac.push(ask(j, 'custo', ops, { o: 'sacrificar' }).id);
    }
  }
  if (c.devolver && c.devolver !== 'este') {
    for (let i = 0; i < (c.devolver.qtd || 1); i++) {
      const ops = candDev(e, j, c, fonte).filter(o => !r.dev.includes(o.id) && !r.sac.includes(o.id)).map(o => ({ a: 'devolver', id: o.id }));
      r.dev.push(ask(j, 'custo', ops, { o: 'devolver' }).id);
    }
  }
  if (c.descartar) {
    for (let i = 0; i < c.descartar; i++) {
      const ops = candDesc(e, j, daMao).filter(id => !r.desc.includes(id)).map(id => ({ a: 'descartar', id }));
      r.desc.push(ask(j, 'custo', ops, { o: 'descartar' }).id);
    }
  }
  return r;
}
function pagarFisico(e, j, o, c, esc) {
  const J = e.jogs[j];
  if (c.virar) M.virarObj(e, o);
  if (c.desvirar) M.desvirarObj(e, o);
  for (const id of esc.vir || []) M.virarObj(e, e.objs[id]);          // virarOutros
  for (const id of esc.exi || []) M.mover(e, id, 'exilio');        // exilarDe (CR 406)
  if ((esc.rev || []).length) M.log(e, J.nome, 'revela', esc.rev.map(id => e.objs[id].n).join(', '));   // CR 701.20: só mostra
  if (c.vida) M.perderVida(e, j, c.vida);
  if (c.tirarMarcador) o.marc[c.tirarMarcador.tipo] -= (c.tirarMarcador.qtd || 1);
  if (c.porMarcador) M.porMarcadores(e, o, c.porMarcador.tipo, c.porMarcador.qtd || 1);   // 122.6: com as substituições de marcador
  for (const id of esc.sac) M.mover(e, id, 'cemiterio', { sac: true });            // CR 701.21
  if (esc.desc.length) M.descartar(e, j, esc.desc);
  if (esc.desc.length) o.descCusto = esc.desc.map(id => ({ id, ts: e.objs[id].ts })); else delete o.descCusto;   // em 'descartadaCusto' (Grab the Prize)
  if (c.sacrificar === 'este' || (c.sacrificar && c.sacrificar.comEste && o.zona === 'campo')) M.mover(e, o.id, 'cemiterio', { sac: true });   // comEste: "sacrifice this and N …" (Glass-Cast Heart)
  if (c.exilarEste) M.mover(e, o.id, 'exilio');
  if (c.descartarEste) M.descartar(e, j, [o.id]);                  // CR 701.9 (Otawara, Trumpeting Carnosaur)
  for (const id of esc.dev || []) M.mover(e, id, 'mao');            // à mão do dono (Master Transmuter, Mina and Denn)
  if (c.devolver === 'este') M.mover(e, o.id, 'mao');              // Shigeki
}
function pagarMana(e, j, pl, custo, x, para?) {
  if (pl.improv) { for (const id of pl.improv) M.virarObj(e, e.objs[id]); custo = pl.custo; }   // improvisar (702.126a) e convocar (702.51a)
  if (pl.delve) { for (const id of pl.delve) M.mover(e, id, 'exilio'); custo = pl.custo; }       // delve (702.66a)
  for (const p of pl.passos) M.ativarMana(e, j, p.id, p.k, p.escolha, p.para);
  const pg = M.pagarDaReserva(M.reservaCom(e, j, para), custo, { x, vidaDisp: pl.vida });   // mana restrita (106.6) que bate a mágica
  M.acertarRestrita(e, j, para, pg.resto); M.perderVida(e, j, pg.vida);
}

// CR 601.2f: "custa {N} (ou N de vida) a mais" para o oponente que mira (Kopala, Warden of Waves; Terror of the Peaks).
// Cada estática soma uma vez por mágica/habilidade, mesmo mirando várias que ela cobre. deHabil: só habilidade ativada.
M.estAumentaOk = s => !!s && s.modo === 'aumentaCusto' && s.aoMirar === true && s.quem === 'oponente' && Object.keys(s).every(k => ['modo', 'afeta', 'aoMirar', 'quem', 'qtd', 'deHabil', 'pagar'].includes(k))
  && (s.afeta === 'este' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && (s.pagar === undefined ? Number.isInteger(s.qtd) && s.qtd > 0 : s.qtd === undefined && Object.keys(s.pagar).length === 1 && Number.isInteger(s.pagar.vida));
const impostoAlvo = (e, j, alvos, deHabil) => {
  const r = { g: 0, vida: 0 }, os = (alvos || []).flat().filter(a => a && a.o !== undefined).map(a => e.objs[a.o]).filter(Boolean);
  if (!os.length) return r;
  for (const id of M.indiceCampo(e).est) {
    const F = e.objs[id]; if (!F || F.ctrl === j) continue;
    for (const s of M.dadoDe(e, F).est || []) {
      if (s.modo !== 'aumentaCusto' || !M.estAumentaOk(s) || !!s.deHabil !== !!deHabil) continue;
      if (!os.some(o => s.afeta === 'este' ? o.id === F.id : M.bate(e, o, s.afeta, { voce: F.ctrl, este: F.id }))) continue;
      r.g += s.qtd || 0; r.vida += (s.pagar && s.pagar.vida) || 0;
    }
  }
  return r;
};
M.impostoAlvo = impostoAlvo;

const PROC = {
  conjurar(e, P, ask) {
    const j = P.j, o = e.objs[P.id], ctx = { voce: j, este: o.id };
    o.face = P.face ?? null;                                                          // 709.3, 712.8b, 716.3: a face vem antes
    const d = M.dadoDe(e, o);
    const modos = modalTopo(d) ? escolherModos(e, j, d, d.fx[0], ask, o.id) : null;          // CR 601.2b
    const fx = fxEfetivo(d, d.fx || [], modos);
    const custo0 = M.custoComImposto(e, o, custoBase(e, j, o, P)), usados = alvosUsados(fx), alt = altUsado(e, j, o, P);
    const viaveis = opcoesConj(e, j, d, P.gratis || P.loucura || P.milagre ? undefined : o).filter(op => opcOk(e, j, d, usados, custo0, op, o));
    let opc: any = viaveis.length > 1 ? ask(j, 'opcao', viaveis.map(v => ({ a: 'opcao', v })), { id: o.id }).v : viaveis[0] || {};   // 601.2b
    if (opc.presente) opc = { ...opc, jog: ask(j, 'presente', M.vivos(e).filter(x => x !== j).map(x => ({ a: 'jogador', jog: x })), { id: o.id }).jog };   // 702.174a: um oponente
    let custo = custoOpc(d, custo0, opc, e, o);
    let x = 0;
    if (custo.x && !(P.gratis || (M.permJogar(e, j, o) || {}).gratis)) {             // CR 601.2b: anuncia o X (grátis: X = 0, 107.3b)
      const mx = maxX(e, j, custo, null, o);
      x = ask(j, 'x', Array.from({ length: mx + 1 }, (_, v) => ({ a: 'x', v })).reverse(), { id: o.id }).v;
    }
    // impostoPorAlvo (Fireball): {1} a mais por alvo além do primeiro, somado depois dos alvos (CR 601.2f)
    const comAlvos = n => d.impostoPorAlvo && n > 1 ? M.somaCusto(custo, d.impostoPorAlvo, n - 1) : custo;
    const cabe = d.impostoPorAlvo ? n => !!plano(e, j, comAlvos(n), x, null, o) : undefined;
    const alvos = escolherAlvos(e, j, d, fx, { ...ctx, x }, ask, cabe, opc);          // CR 601.2c
    custo = comAlvos(alvos.reduce((s, l) => s + (l ? l.length : 0), 0));
    const imp = impostoAlvo(e, j, alvos, false);                                     // 601.2f: Kopala, Terror of the Peaks
    if (imp.g) custo = M.somaCusto(custo, { g: imp.g });
    if (imp.vida && e.jogs[j].vida < imp.vida) { e.proc = null; o.face = null; M.log(e, e.jogs[j].nome, 'desiste de', o.n, '(sem vida para o custo a mais)'); return; }   // 119.4
    let cad = d.custoAd ? escolherAd(e, j, o, d.custoAd, ask) : null;             // CR 601.2b: anuncia qual custo do "ou"
    if (cad && cad.vida === 'X') {                                                    // 601.2b/119.4: X de vida até a vida que tem
      x = ask(j, 'x', Array.from({ length: Math.max(0, e.jogs[j].vida) + 1 }, (_, v) => ({ a: 'x', v })).reverse(), { id: o.id, vida: true }).v;
      cad = { ...cad, vida: x };
    }
    const fis = cad ? escolherCustoFisico(e, j, cad, null, o.id, ask) : { sac: [] as any[], desc: [] as any[], dev: [] as any[] };
    if (cad && cad.mana) custo = M.somaCusto(custo, cad.mana);
    const fisA = opc.alt !== undefined ? escolherCustoFisico(e, j, fisAlt(d, opc), null, o.id, ask) : null;   // alternativo físico (601.2f)                      // "ou pague {1}" (Thunderherd Migration): soma ao total (601.2f)
    const fuga = !porFlash(e, j, o) && !P.gratis && porFuga(e, j, o) ? fugaDe(e, j, o) : null;   // 702.138: as N outras do cemitério (601.2f)
    const exFuga = fuga ? M.escolherN(ask, j, 'custo', e.jogs[j].zonas.cemiterio.filter(id => id !== o.id), fuga.exilar, { ctx: { o: 'exilar' } }) : [];
    const alvoIds = alvos.flatMap(l => (l || []).filter(a => a.o !== undefined).map(a => a.o));   // delve não exila os alvos
    const pl = plano(e, j, custo, x, [...fis.sac, ...(fisA ? [...fisA.sac, ...fisA.vir] : []), ...exFuga, ...alvoIds], o);   // CR 601.2g: mana antes de pagar
    e.proc = null;
    if (!pl) { o.face = null; M.log(e, e.jogs[j].nome, 'desiste de', o.n, '(custo não fecha)'); return; }   // CR 727: volta atrás
    const doComando = o.zona === 'comando', de = o.zona, flash = porFlash(e, j, o) && !P.gratis;
    const sacLki = (fis.sac || []).map(id => M.lkiDe(e, e.objs[id]));                 // "o poder da sacrificada" (custo adicional): LKI
    if (o.copiaPrep) { const cr = e.objs[o.copiaPrep.id]; if (cr) cr.preparada = false; }   // conjurar a cópia desprepara
    M.mover(e, o.id, 'pilha'); o.ctrl = j; o.face = P.face ?? null; if (flash) o.flash = true; o.conjDe = de; o.conjPrinc = e.turno.ativo === j && ['principal1', 'principal2'].includes(e.turno.passo);   // CR 601.2a (o mover zera a face); conjDe: de que zona foi conjurada
    o.pil = { x, alvos, modos, ctrl: j, opc, ...(sacLki.length ? { sac: sacLki } : {}), ...(fuga ? { fuga: fuga.comMarc || true } : {}) };
    { const J = e.jogs[j]; J.conjT = { t: e.turno.n, n: (J.conjT && J.conjT.t === e.turno.n ? J.conjT.n : 0) + 1 };
      J.conjH = { t: e.turno.n, l: [...(J.conjH && J.conjH.t === e.turno.n ? J.conjH.l : []), { ...o }] }; }   // as mágicas do turno (cópia rasa na pilha): "a primeira mágica não-criatura" (Esper Sentinel)   // conta magiasNoTurno (Aetherflux, Dreamtide Whale)
    const antes = e.conjTodas && e.conjTodas.t === e.turno.n ? e.conjTodas.n : 0; e.conjTodas = { t: e.turno.n, n: antes + 1 };   // de todos os jogadores (tempestade, 702.40a)
    if (M.temKw(e, o, 'tempestade') && antes > 0) e.pend.push({ fonte: o.id, ts: o.ts, ctrl: j, k: 'tempestade', g: { ev: 'conjura', fx: [{ op: 'copiarMagica', em: 'este', novoAlvo: true, qtd: antes }] }, n: o.n, face: o.face ?? null, ficha: null, lki: M.lkiDe(e, o), ev: { ev: 'conjura', id: o.id, j } });   // CR 702.40a: copia uma vez por mágica conjurada antes neste turno
    M.evento(e, { ev: 'conjura', id: o.id, j, de, fontes: (pl.passos || []).map(p => p.id) });                                      // 601.2i: "quando conjura"
    M.eventosAlvo(e, alvos, o.id);
    pagarMana(e, j, pl, custo, x, o);                                                 // CR 601.2h
    if (imp.vida) M.perderVida(e, j, imp.vida);
    if (alt && alt.F) { if (alt.vida) M.perderVida(e, j, alt.vida); if (alt.s.limite) alt.F.altUso = { t: e.turno.n, ts: alt.F.ts }; }   // 119.4: vida paga; "uma vez por turno"
    if (cad) pagarFisico(e, j, o, cad, fis);
    if (fisA) pagarFisico(e, j, o, fisAlt(d, opc), fisA);
    for (const id of exFuga) M.mover(e, id, 'exilio');
    if (doComando) e.jogs[j].imposto[o.id] = (e.jogs[j].imposto[o.id] || 0) + 1;      // CR 903.8
    e.turno.magias = (e.turno.magias || 0) + 1;
    M.log(e, e.jogs[j].nome, 'conjura', o.copiaPrep ? M.dadoDe(e, o).n + ' (cópia preparada de ' + o.n + ')' : o.n, x ? `(X=${x})` : '', opc.chute ? '(com chute)' : '', opc.prole ? '(com prole)' : '', opc.sobrecarga ? '(sobrecarga)' : '', opc.alt !== undefined ? '(custo alternativo)' : '', fuga ? '(fuga: exila ' + exFuga.length + ' do cemitério)' : '', opc.presente ? `(presente para ${e.jogs[opc.jog].nome})` : '', descAlvos(e, alvos));
    if (!P.loucura && !P.milagre && !P.agora) M.agiu(e, j);                                                     // CR 601.2i → 117.3c (loucura: no meio da resolução)
  },

  ativar(e, P, ask) {
    const j = P.j, o = e.objs[P.id], a = M.atvDe(e, o)[P.k], c = a.custo, ctx = { voce: j, este: o.id };
    const ex = c.virar || c.sacrificar === 'este' || (c.sacrificar && c.sacrificar.comEste) || c.devolver === 'este' ? [o.id] : [];
    let mana = M.custoAtv(e, o, a);                                                   // CR 602.2b → 601.2f (reduzCusto deHabil)
    if (a._equipar && e.turno.ativo === j) e.jogs[j].equipT = e.turno.n;                // o 1º equipar do seu turno já foi (Forge Anew)
    let x = 0;
    if (mana && mana.x) {
      const mx = maxX(e, j, mana, ex);
      x = ask(j, 'x', Array.from({ length: mx + 1 }, (_, v) => ({ a: 'x', v })).reverse(), { id: o.id }).v;
    }
    const alvos = escolherAlvos(e, j, a, a.fx, { ...ctx, x }, ask);                   // CR 602.2b → 601.2c
    const imp = impostoAlvo(e, j, alvos, true);                                      // 601.2f via 602.2b: Kopala (habilidade)
    if (imp.g) mana = M.somaCusto(mana || {}, { g: imp.g });
    if (imp.vida && e.jogs[j].vida < imp.vida) { e.proc = null; M.log(e, e.jogs[j].nome, 'desiste de ativar', o.n); return; }
    const fis = escolherCustoFisico(e, j, c, o.id, c.descartarEste ? o.id : null, ask);
    const pl = mana ? plano(e, j, mana, x, [...ex, ...fis.sac, ...fis.dev, ...fis.vir]) : { passos: [] as any[], vida: 0 };
    e.proc = null;
    if (!pl) { M.log(e, e.jogs[j].nome, 'desiste de ativar', o.n); return; }
    // a habilidade vai para a pilha independente da fonte (CR 113.7a): leva o texto e o que sabia da fonte
    const id = e.prox++;
    const h = { id, n: o.n, dono: j, ctrl: j, zona: 'pilha', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false,
      hab: { fonte: o.id, fonteTs: o.ts, k: P.k, fx: a.fx, alvos: a.alvos || [], ficha: o.ficha || null },
      pil: { x, alvos, ctrl: j, lki: { este: lkiDe(e, o) }, ...(fis.sac.length ? { sac: fis.sac.map(id => lkiDe(e, e.objs[id])) } : {}) } };   // "a sacrificada" (custo, LKI 608.2h)
    e.objs[id] = h; e.pilha.push(id);
    M.eventosAlvo(e, alvos, id);
    if (mana) pagarMana(e, j, pl, mana, x);
    if (imp.vida) M.perderVida(e, j, imp.vida);
    const ninja = a._ninjutsu && fis.dev.length ? (e.turno.combate.atk.find(x => x.id === fis.dev[0] && x.ts === e.objs[fis.dev[0]].ts) || {}).alvo : null;   // o defensor do que voltou (702.49c)
    pagarFisico(e, j, o, c, fis);
    if (ninja) (h.pil as any).ninja = ninja;
    if (a._ciclar) M.evento(e, { ev: 'cicla', id: o.id, j });       // CR 702.29: "quando você ciclar" (Magmakin Artillerist)
    if (a.lealdade !== undefined) { o.marc.lealdade = (o.marc.lealdade || 0) + a.lealdade; o.lealTurno = e.turno.n; }   // CR 606.4
    if (a.limite === 'umaPorTurno') (o.usos = o.usos || {})[P.k] = e.turno.n;
    M.log(e, e.jogs[j].nome, 'ativa', o.n, descAlvos(e, alvos));
    M.agiu(e, j);
  },

  manaEsc(e, P, ask) {                                              // CR 605.3a: paga o custo (com escolha) e a mana vai direto à reserva
    const j = P.j, o = e.objs[P.id], a = M.atvDe(e, o)[P.k], c = a.custo;
    if (!M.podeManaEsc(e, j, o, P.k)) throw new Error('mana ilegal: ' + o.n);
    const pac = pacotesEsc(e, o, a)[P.escolha || 0];                 // antes de pagar: o custo pode mudar o que ela produz
    const fis = escolherCustoFisico(e, j, c, o.id, null, ask);
    e.proc = null;
    const J = e.jogs[j], sac = fis.sac.map(id => e.objs[id].n);
    if (c.mana) J.reserva = M.pagarDaReserva(J.reserva, c.mana).resto;
    pagarFisico(e, j, o, c, fis);
    if (a.limite === 'umaPorTurno') (o.usos = o.usos || {})[P.k] = e.turno.n;
    const res = restritaEsc(e, o, a);                                // CR 106.6: a parte restrita fica marcada
    for (const cor in pac) J.reserva[cor] += pac[cor] - (res ? res.m[cor] : 0);
    if (res) (J.restrita || (J.restrita = [])).push(res);
    M.log(e, J.nome, 'mana de', o.n, M.fmtMana(pac), res ? '(só para ' + M.fmtFiltroSo(res.f) + ')' : '', sac.length ? '(sacrifica ' + sac.join(', ') + ')' : c.tirarMarcador ? `(tira ${c.tirarMarcador.qtd || 1} ${c.tirarMarcador.tipo})` : c.exilarEste ? '(exila da mão)' : '');
    M.agiu(e, j);
  },

  // CR 608.2: resolve o objeto do topo
  resolver(e, P, ask) {
    const o = e.objs[P.id], pil = o.pil, j = pil.ctrl;
    const d = o.hab ? { fx: o.hab.fx, alvos: o.hab.alvos } : M.dadoDe(e, o);
    const fx0 = fxEfetivo(d, d.fx || [], pil.modos), fx = !o.hab && pil.opc && pil.opc.sobrecarga ? M.fxSobrecarga(d, fx0) || fx0 : fx0;   // 702.96b
    if (!P.checou) {
      P.checou = true;
      if (!M.gatilhoAindaVale(e, o)) { e.proc = null; M.log(e, o.n, 'não resolve: condição do gatilho falhou (603.4)'); tirarDaPilha(e, o); return; }
      // CR 608.2b: alvos que ficaram ilegais; se TODOS ficaram, não resolve
      const ctx0 = { voce: j, este: o.hab ? o.hab.fonte : o.id, x: pil.x };
      P.ilegal = {};
      let tem = 0, legais = 0;
      (pil.alvos || []).forEach((lista, i) => (lista || []).forEach((esc, k) => {
        tem++;
        if (M.alvoLegal(e, d.alvos[i], esc, ctx0)) legais++; else P.ilegal[i + ':' + k] = true;
      }));
      // CR 608.2h: o que se sabe dos alvos agora (o efeito pode tirá-los do campo no meio)
      pil.lki = pil.lki || {};
      pil.lki.alvos = (pil.alvos || []).map(l => (l || []).map(esc => esc.o !== undefined && e.objs[esc.o] ? lkiDe(e, e.objs[esc.o]) : null));
      if (tem && !legais) { e.proc = null; M.log(e, o.n, 'não resolve: alvos ilegais'); tirarDaPilha(e, o); return; }
      P.i = 0;
      if (pil.opc && pil.opc.presente && !e.jogs[pil.opc.jog].saiu) { M.comprar(e, pil.opc.jog, 1); M.log(e, e.jogs[pil.opc.jog].nome, 'recebe o presente (compra 1)'); }   // 702.174b: antes dos efeitos
    }
    // o ctx fica no processo: o que um efeito deixa (pagou, resultado, lembrados, criadas) vale no seguinte mesmo depois de uma pergunta
    if (!P.ctx && o.hab) {                                          // quantas vezes esta habilidade (da mesma fonte) resolveu neste turno, contando esta
      const T = e.turno, ch = o.hab.fonte + ':' + o.hab.fonteTs + ':' + (o.hab.gat !== undefined ? 'g' + o.hab.gat : 'a' + o.hab.k);
      T.resHab = T.resHab || {}; P.resHab = T.resHab[ch] = (T.resHab[ch] || 0) + 1;
    }
    const ctx = P.ctx = P.ctx || { resHab: P.resHab, voce: j, este: o.hab ? o.hab.fonte : o.id, x: pil.x, alvos: pil.alvos || [], defAlvos: d.alvos || [], ilegal: P.ilegal, lki: pil.lki, item: o.id, ev: pil.ev || null, opc: pil.opc || null, sac: pil.sac || null, ...(pil.mem || {}) };
    if (o.hab && o.hab.talvez && !P.talvez) {                      // CR 603.5: "you may" do gatilho inteiro, escolhido ao resolver
      if (ask(j, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'gatilho', id: o.hab.fonte, n: o.n }).a === 'nao') { e.proc = null; M.log(e, o.n, 'gatilho: escolheu não fazer'); tirarDaPilha(e, o); return; }
      P.talvez = true; ask.etapa();
    }
    while (P.i < fx.length) {
      M.executar(e, fx[P.i], ctx, ask);
      P.i++; ask.etapa();
      if (e.fim) { e.proc = null; return; }
    }
    tirarDaPilha(e, o, true, ask);
    e.proc = null;
  },
};
M.PROC = PROC;

// CR 608.3 (permanente entra no campo), 608.2n (instantânea/feitiço vai ao cemitério do dono), 113.7 (habilidade some)
function tirarDaPilha(e, o, resolveu?, ask?) {
  if (o.copia && !(resolveu && M.ehPermanente(e, o))) {              // 707.10a/704.5e: a cópia some (resolvida ou anulada)
    const k = e.pilha.indexOf(o.id); if (k >= 0) e.pilha.splice(k, 1); o.pil = null; o.zona = 'fora'; return;
  }
  if (o.copia) { o.ficha = { ...M.dadoBase(e, o), n: o.n }; delete o.copia; }   // 608.3f: a cópia de permanente entra como ficha
  if (o.flash && !o.hab) { delete o.flash; o.pil = null; M.mover(e, o.id, 'exilio'); M.log(e, o.n, 'vai para o exílio (recapitular)'); return; }   // 702.34a (resolvida ou anulada)
  if (o.hab) { const k = e.pilha.indexOf(o.id); if (k >= 0) e.pilha.splice(k, 1); delete e.objs[o.id]; return; }
  if (resolveu && M.ehPermanente(e, o)) {
    const plano = M.decidirEntrada(e, o.id, o.pil.ctrl, {}, ask);   // pergunta antes de mexer
    const conj = o.pil.opc, x = o.pil.x || 0, fuga = o.pil.fuga;
    o.pil = null;
    const ent = M.aplicarEntrada(e, { ...plano, conj, x });
    if (ent) ent.conjurada = true;     // filtro conjurada: The One Ring, Tiamat, Zacama ("when you cast it" / "if you cast it")
    if (fuga && typeof fuga === 'object') for (const m in fuga) ent.marc[m] = (ent.marc[m] || 0) + fuga[m];   // 702.138c: "foge com"                    // x: "entra com X marcadores" (614.1c)                       // "se foi chutada" depois de entrar (Goblin Bushwhacker)
    return;
  }
  const ctrl = o.pil && o.pil.ctrl;
  o.pil = null;
  if (resolveu && o.face === 0 && M.formaDe(e, o) === 'aventura') {               // 716.3d: a Aventura vai para o exílio
    M.mover(e, o.id, 'exilio'); o.aventura = ctrl;                                // e quem conjurou pode conjurar a criatura de lá
    return;
  }
  M.mover(e, o.id, 'cemiterio');
}
M.tirarDaPilha = tirarDaPilha;

// CR 707.10: copiar uma mágica na pilha. A cópia leva as escolhas da original (modo, X, alvos, chute, custos pagos:
// 707.10), é controlada por quem copiou e NÃO é conjurada (707.10c: sem evento 'conjura', não dispara Zada/Archmage
// de novo). novoAlvo: "you may choose new targets for the copy" — mesmo número de alvos (707.10c). Fora da pilha a
// cópia deixa de existir (704.5e, no M.mover); cópia de mágica de permanente vira ficha ao resolver (608.3f).
// Duas partes por causa do processo com perguntas: M.alvosDaCopia pergunta (antes de mexer), M.criarCopia mexe.
M.alvosDaCopia = (e, o, j, novoAlvo, ask) => {
  const alvos = (o.pil.alvos || []).map(l => (l || []).map(a => ({ ...a })));
  if (!novoAlvo || !alvos.some(l => l.length)) return { alvos, novos: false };
  if (ask(j, 'talvez', [{ a: 'sim' }, { a: 'nao' }], { op: 'novoAlvo', id: o.id, n: o.n }).a === 'nao') return { alvos, novos: false };
  const d = M.dadoDe(e, o), fx = fxEfetivo(d, d.fx || [], o.pil.modos);
  const dFixo = { ...d, alvos: (d.alvos || []).map((a, i) => a && { ...a, min: alvos[i] ? alvos[i].length : 0, max: alvos[i] ? alvos[i].length : 0, dividir: false }) };
  const esc = escolherAlvos(e, j, dFixo, fx, { voce: j, este: o.id, x: o.pil.x }, ask, undefined, o.pil.opc);
  return { alvos: alvos.map((l, i) => esc[i] && esc[i].length === l.length ? esc[i] : l), novos: true };
};
M.criarCopia = (e, o, j, { alvos, novos }) => {
  const id = e.prox++;
  e.objs[id] = { id, n: o.n, dono: j, ctrl: j, zona: 'pilha', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false, face: o.face ?? null, copia: true,
    ...(o.ficha ? { ficha: o.ficha } : {}), ...(o.copiaPrep ? { copiaPrep: o.copiaPrep } : {}),
    pil: { ...o.pil, ctrl: j, alvos, opc: o.pil.opc ? { ...o.pil.opc } : o.pil.opc, lki: undefined } };
  e.pilha.push(id);
  if (novos) M.eventosAlvo(e, alvos, id);                           // "becomes the target" vale para a cópia (ward)
  M.log(e, e.jogs[j].nome, 'copia', o.n, descAlvos(e, alvos));
  if (M.evento && !o.hab) M.evento(e, { ev: 'copia', id, j });     // CR 707.10: copiar não é conjurar; só "cast or copy" (magecraft) dispara
  return e.objs[id];
};

M.resolverTopo = e => {
  const id = e.pilha[e.pilha.length - 1];
  M.iniciarProc(e, { tp: 'resolver', id });
};
M.conjurar = (e, j, id, face?) => M.iniciarProc(e, face === undefined ? { tp: 'conjurar', j, id } : { tp: 'conjurar', j, id, face });
// face de terreno de uma carta modal cuja frente não é terreno (Bala Ged Recovery → Bala Ged Sanctuary); 712.9
M.faceTerreno = (e, o) => M.formaDe(e, o) === 'modal' && ((M.carta(o.n).faces[0] || {}).tipos || []).includes('Land');
M.ativar = (e, j, id, k) => M.iniciarProc(e, { tp: 'ativar', j, id, k });

// anular (CR 701.6): a mágica sai da pilha para o cemitério do dono; habilidade some
// CR 101.2 / 701.6: "não pode ser anulada" — a própria mágica (quem.este, Dovin's Veto) ou as que um permanente protege
// (Rhythm of the Wild, Root Sliver, Chimil). Só mágica (habilidade na pilha não é "spell"). O "não pode" vence o "anule".
function naoAnulavel(e, o) {
  if (o.hab) return null;
  const fontes = [o, ...M.indiceCampo(e).sb.map(i => e.objs[i])];
  for (const F of fontes) for (const sb of M.dadoDe(e, F).subst || []) {
    if (sb.ev !== 'anulada' || !M.substOk(sb)) continue;
    if (sb.quem && sb.quem.este ? F.id !== o.id : F.zona !== 'campo' || (sb.quem && !M.bate(e, o, sb.quem, { voce: F.ctrl, este: F.id }))) continue;
    if (sb.se) { let ok = false; try { ok = M.condicao(e, sb.se, { voce: F.ctrl ?? F.dono, este: F.id }); } catch (_) { ok = false; } if (!ok) continue; }
    return F;
  }
  for (const t of e.efTemp || []) if (t.mag && t.mag.id === o.id && t.mag.ts === o.ts && t.subst.some(sb => sb.ev === 'anulada')) return { n: t.n, id: -1 };   // efeitoTemporario proximaMagica
  return null;
}
M.naoAnulavel = naoAnulavel;
M.anular = (e, id) => {
  const o = e.objs[id]; if (!o || o.zona !== 'pilha') return false;
  const F = naoAnulavel(e, o);
  if (F) { M.log(e, o.n, 'não pode ser anulada' + (F.id !== o.id ? ' (' + F.n + ')' : '')); return false; }
  o.pil = null; tirarDaPilha(e, o, false); return true;
};

function lkiDe(e, o) {
  return { id: o.id, ts: o.ts, n: o.n, ctrl: o.ctrl, dono: o.dono, poder: M.poder(e, o), resist: M.resistencia(e, o), vm: M.dadoDe(e, o).vm || 0, marc: { ...o.marc }, transf: o.transf || 0, face: o.face ?? null };
}
M.lkiDe = lkiDe;
function descAlvos(e, alvos) {
  const t = (alvos || []).flat().filter(Boolean).map(a => a.jog !== undefined ? e.jogs[a.jog].nome : (e.objs[a.o] || {}).n);
  return t.length ? '→ ' + t.join(', ') : '';
}
