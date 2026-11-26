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
  if (typeof f === 'string') return ['qualquerAlvo', 'jogador', 'oponente', 'magica'].includes(f);
  return M.filtroOk(f);
};
// chute (CR 702.33) e oferta de presente (702.174; só o presente 'carta'): escolhas anunciadas com os modos (601.2b).
// alvo.opcao: o alvo só existe com (ou sem) a opção (Tear Asunder, Wear Down, Long River's Pull).
const OPCAO_OK = new Set(['chute', 'semChute', 'presente', 'semPresente']);
const chuteDe = d => (d.kw || []).find(k => k.k === 'chute' && k.custo);
const presenteDe = d => (d.kw || []).find(k => k.k === 'ofertaPresente' && k.tipo === 'carta');
const alvoAtivo = (a, opc) => !a || !a.opcao || !opc ? true : a.opcao === 'chute' ? !!opc.chute : a.opcao === 'semChute' ? !opc.chute
  : a.opcao === 'presente' ? !!opc.presente : !opc.presente;
M.alvoAtivo = alvoAtivo;
// combinações de opção que a carta tem, com a opção primeiro (o agente básico pega a primeira que fecha)
function opcoesConj(e, j, d) {
  let l: any[] = [{}];
  if (chuteDe(d)) l = [{ chute: true }, {}];
  if (presenteDe(d) && M.vivos(e).some(x => x !== j)) l = l.flatMap(o => [{ ...o, presente: true }, o]);
  return l;
}
const custoOpc = (d, custo, opc) => opc.chute ? M.somaCusto(custo, chuteDe(d).custo) : custo;
// pode ser alvo de quem controla a mágica/habilidade? antimagia (CR 702.11b) e manto (CR 702.18a); proteção = T18
const alcancavel = (e, o, voce) => !(M.temKw(e, o, 'manto') || (M.temKw(e, o, 'antimagia') && o.ctrl !== voce));
M.alvoLegal = (e, a, esc, ctx) => {
  const f = a.f, voce = ctx.voce;
  if (esc.jog !== undefined) {
    if (!vivo(e, esc.jog)) return false;
    if (M.protegeJog(e, esc.jog)) return false;                    // 702.16b: proteção contra tudo, não é alvo
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
    for (const k in v) if (k !== 'modos') anda(v[k]);
  };
  anda(fx);
  return [...s].sort((a, b) => a - b);
};

// ---------- custos (CR 118, 601.2f–h, 602.2b) ----------
const CUSTO_OK = new Set(['mana', 'virar', 'desvirar', 'sacrificar', 'descartar', 'vida', 'exilarEste', 'descartarEste', 'tirarMarcador', 'devolver']);
M.custoSuportado = c => {
  for (const k in c || {}) if (!CUSTO_OK.has(k)) return false;
  if (c && c.vida !== undefined && typeof c.vida !== 'number') return false;
  if (c && c.sacrificar && c.sacrificar !== 'este' && !M.filtroOk(c.sacrificar.f || {})) return false;
  if (c && c.devolver !== undefined && c.devolver !== 'este' && !(c.devolver && typeof c.devolver === 'object' && M.filtroOk(c.devolver.f || {})
    && (c.devolver.qtd === undefined || Number.isInteger(c.devolver.qtd)) && Object.keys(c.devolver).every(k => k === 'f' || k === 'qtd'))) return false;
  return true;
};
// candidatos a sacrificar/descartar de um custo
const candSac = (e, j, c, fonte) => M.objetosQue(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: fonte });
const candDev = (e, j, c, fonte) => M.objetosQue(e, { ...(c.devolver.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: fonte });   // devolver à mão como custo (Master Transmuter)
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
  if (c.descartarEste && (!o || o.zona !== 'mao')) return false;   // canalizar: só da mão (CR 602.2, a habilidade diz a zona)
  if (c.sacrificar && c.sacrificar !== 'este' && !M.temPeloMenos(e, { ...(c.sacrificar.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: o && o.id }, c.sacrificar.qtd || 1)) return false;
  if (c.descartar && candDesc(e, j, daMao).length < c.descartar) return false;
  if (c.devolver === 'este' && (!o || o.zona !== 'campo')) return false;
  if (c.devolver && c.devolver !== 'este' && !M.temPeloMenos(e, { ...(c.devolver.f || {}), ctrl: 'voce', zona: 'campo' }, { voce: j, este: o && o.id }, c.devolver.qtd || 1)) return false;
  if (c.tirarMarcador && (!o || (o.marc[c.tirarMarcador.tipo] || 0) < (c.tirarMarcador.qtd || 1))) return false;
  return true;
}

// mana possível de um jogador (limite de cima, rápido): reserva + o máximo de cada fonte de virar
function manaMax(e, j, excluir, para) {
  let t = M.somaMana(e.jogs[j].reserva);
  for (const f of M.fontesDeMana(e, j, { soVirar: true, para })) if (!excluir || !excluir.includes(f.id)) t += Math.max(...f.pacotes.map(M.somaMana));
  return t;
}
const vidaPhy = (e, j) => M.vidaFixa(e, j) ? 0 : Math.max(0, e.jogs[j].vida - 1);   // 119.8: vida fixa não paga        // phyrexiano: o plano pode gastar vida sem morrer
const plano = (e, j, custo, x, excluir, para?) => M.planoMana(e, j, custo, { x, vidaDisp: vidaPhy(e, j), excluir, para });
// maior X pagável (CR 107.3): sobe enquanto o plano fecha
function maxX(e, j, custo, excluir, para?, teto = 30) {
  let x = 0;
  while (x < teto && plano(e, j, custo, x + 1, excluir, para)) x++;
  return x;
}

// ---------- jogar de outra zona (est podeJogar, CR 601.3/305.1 com permissão): por ora só do cemitério ----------
// Fontes: permanentes do jogador (Conduit of Worlds: terrenos do cemitério) e a própria carta no cemitério
// (Gravecrawler, "as long as you control a Zombie" no 'se', lido com a fonte).
function permissoes(e, j) {
  const mk = M.memo && 'pj' + j;
  if (mk && M.memo[mk]) return M.memo[mk];
  const r: any[] = [];
  const le = (S, zonaFonte) => {
    for (const s of M.dadoDe(e, S).est || []) {
      if (s.modo !== 'podeJogar' || s.de !== 'cemiterio' || !s.afeta || typeof s.afeta !== 'object' || !M.filtroOk(s.afeta)) continue;
      if (zonaFonte === 'cemiterio' && !s.afeta.este) continue;      // no cemitério só vale a permissão para si mesma
      r.push({ s, ctx: { voce: j, este: S.id } });
    }
  };
  for (const id of e.campo) if (e.objs[id].ctrl === j) le(e.objs[id], 'campo');
  for (const id of e.jogs[j].zonas.cemiterio) le(e.objs[id], 'cemiterio');
  if (mk) M.memo[mk] = r;
  return r;
}
M.temPermissaoCemiterio = (e, j) => permissoes(e, j).length > 0;
// permissão dada por efeito (op jogar com dura): o mesmo objeto (id e ts, CR 400.7) em qualquer zona fora do campo
M.permJogar = (e, j, o) => { const l = e.permJogar; if (!l || !l.length) return null; for (const p of l) if (p.j === j && p.id === o.id && p.ts === o.ts && o.zona !== 'campo' && o.zona !== 'pilha') return p; return null; };
// recapitular (CR 702.34): conjurar do cemitério pelo custo de recapitular; ao sair da pilha vai para o exílio (702.34a)
const flashDe = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'flashback' && x.custo); return k ? k.custo : null; };
const porFlash = (e, j, o) => o.zona === 'cemiterio' && o.dono === j && !!flashDe(e, o) && !M.podeJogarDe(e, j, o);
M.porFlash = porFlash;
const custoBase = (e, j, o, opts) => opts.loucura ? custoLoucura(e, o) : porFlash(e, j, o) && !opts.gratis ? flashDe(e, o) : opts.gratis || (M.permJogar(e, j, o) || {}).gratis ? {} : undefined;
M.podeJogarDe = (e, j, o) => !!M.permJogar(e, j, o) || o.zona === 'cemiterio' && o.dono === j && permissoes(e, j).some(({ s, ctx }) => {
  try { return M.bate(e, o, s.afeta, ctx) && M.condicao(e, s.se, ctx); } catch (_) { return false; }
});

// ---------- o que pode ser conjurado ----------
// Faces que dá para anunciar (a escolha vem antes de ir para a pilha: 709.3, 712.8b, 716.3, 702.102a):
// modal, as duas; aventura, a criatura ou a Aventura (do exílio da aventura, só a criatura: 716.3d);
// split, uma metade ou as duas fundidas (fusão só da mão, 702.102a); dupla face que transforma, só a frente (712.8).
const temFusao = c => (c.kw || []).some(k => k.k === 'fusao');
M.facesParaConjurar = (e, j, o) => {
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
// só a face que vai ficar para cima é avaliada (712.8c, 709.3a, 716.3a): avalia com o.face trocada e devolve
// opts.loucura: a carta exilada pela loucura, conjurada na resolução do gatilho (CR 702.35b), sem olhar a velocidade
M.podeConjurar = (e, j, o, face?, opts?) => {
  const antes = o.face;
  o.face = face ?? null;
  try { return podeConjurarFace(e, j, o, face, opts || {}); } finally { o.face = antes; }
};
const custoLoucura = (e, o) => { const k = (M.dadoDe(e, o).kw || []).find(x => x.k === 'loucura' && x.custo); return k ? k.custo : null; };
function podeConjurarFace(e, j, o, face, opts: any = {}) {
  const louc = !!opts.loucura && o.zona === 'exilio' && o.loucura && !!custoLoucura(e, o);
  const agora = !!opts.agora && o.zona !== 'campo' && o.zona !== 'pilha';   // op jogar sem dura: na resolução, de onde estiver
  const d = M.dadoDe(e, o);
  if (o.dono !== j && !agora && !M.permJogar(e, j, o)) return false;
  if (M.temTipo(e, o, 'Land') || !d.custo) return false;          // terreno não é conjurado (CR 305.9); sem custo = só alternativo (T19)
  if (!(louc || agora || porFlash(e, j, o) || o.zona === 'mao' || (o.zona === 'comando' && o.cmd) || M.podeJogarDe(e, j, o) || (daAventura(e, j, o) && face == null))) return false;   // mão, comando, permissão (podeJogar), aventura ou loucura
  if ((d.sub || []).includes('Aura') || M.temKw(e, o, 'encantar')) return false;   // Aura mira ao conjurar: anexar = T18
  const inst = M.temTipo(e, o, 'Instant') || M.temKw(e, o, 'lampejo');
  if (!inst && !louc && !agora && !M.velFeitico(e, j)) return false;
  if (d.fx && !M.fxSuportado(d.fx)) return false;
  if (!M.ehPermanente(e, o) && !(d.fx && d.fx.length)) return false;   // mágica sem efeito lido: não conjura à toa
  if (modalTopo(d) && M.modosViaveis(e, j, d) < ((d.fx[0].escolhe || {}).min ?? 1)) return false;
  if (d.custoAd && !M.custoSuportado(d.custoAd)) return false;
  if (d.custoAd && !custoFisicoOk(e, j, null, d.custoAd, { daMao: o.id })) return false;
  const usados = alvosUsados(modalTopo(d) ? [] : d.fx || []);
  if (usados.some(i => !(d.alvos || [])[i] || !M.alvoSuportado(d.alvos[i]))) return false;
  const custo0 = M.custoComImposto(e, o, custoBase(e, j, o, opts));
  return opcoesConj(e, j, d).some(opc => opcOk(e, j, d, usados, custo0, opc, o));
}
// a combinação de opções fecha? alvos ativos com escolha legal (CR 601.2c) e custo pagável
function opcOk(e, j, d, usados, custo0, opc, o) {
  const ctx = { voce: j, este: o.id };
  for (const i of usados) {
    const a = d.alvos[i];
    if (!alvoAtivo(a, opc)) continue;
    if ((a.min ?? 1) > 0 && M.alvosPossiveis(e, a, ctx).length < (a.min ?? 1)) return false;
  }
  const custo = custoOpc(d, custo0, opc);
  if (M.vmDe(custo) > manaMax(e, j, null, o) + Math.floor(vidaPhy(e, j) / 2)) return false;
  return !!plano(e, j, custo, 0, null, o);
}
const modalTopo = d => d.fx && d.fx.length === 1 && d.fx[0].op === 'modal';

// ---------- o que pode ser ativado (CR 602.2; lealdade CR 606) ----------
M.podeAtivar = (e, j, o, k) => {
  const d = M.dadoDe(e, o), a = M.atvDe(e, o)[k];
  if (!a || a.deMana || o.ctrl !== j || o.zona !== (a.zona || 'campo')) return false;
  if ((d.falta || []).some(s => s.startsWith('Cost'))) return false;   // custo que o conversor não leu: não ativa errado
  if (!M.custoSuportado(a.custo) || !(a.fx && a.fx.length) || !M.fxSuportado(a.fx, { topo: false })) return false;
  if (a.lealdade !== undefined) {                                     // CR 606.3: feitiço, uma por turno por permanente
    if (!M.velFeitico(e, j) || o.lealTurno === e.turno.n) return false;
    if (a.lealdade < 0 && (o.marc.lealdade || 0) < -a.lealdade) return false;
  } else if (a.vel === 'feitico' && !M.velFeitico(e, j)) return false;
  if (a.limite === 'umaPorTurno' && (o.usos || {})[k] === e.turno.n) return false;
  if (a._nivel && (o.nivel || 1) !== a._nivel - 1) return false;      // CR 716.2a: só do nível N−1
  if (!custoFisicoOk(e, j, o, a.custo, { daMao: a.custo.descartarEste ? o.id : undefined })) return false;
  const ctx = { voce: j, este: o.id };
  for (const i of alvosUsados(a.fx)) {
    const al = (a.alvos || [])[i];
    if (!al || !M.alvoSuportado(al)) return false;
    if ((al.min ?? 1) > 0 && M.alvosPossiveis(e, al, ctx).length < (al.min ?? 1)) return false;
  }
  if (a.custo.mana) {
    const ex = a.custo.virar || a.custo.sacrificar === 'este' || a.custo.devolver === 'este' ? [o.id] : [];
    if (!plano(e, j, M.custoAtv(e, o, a), 0, ex)) return false;
  }
  return true;
};

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
  if (M.velFeitico(e, j) && J.terrenos < M.terrenosPorTurno(e, j))
    for (const id of doCem) if (M.temTipo(e, e.objs[id], 'Land') && M.podeJogarDe(e, j, e.objs[id])) ops.push({ a: 'terreno', id });
  const doExilio = J.zonas.exilio.filter(id => daAventura(e, j, e.objs[id]));
  const doFlash = doCem.length ? [] : J.zonas.cemiterio.filter(id => flashDe(e, e.objs[id]));   // recapitular (702.34)
  // permissões de efeito (op jogar): o que não está na mão/comando/cemitério já listados; terreno com permissão de jogar
  const ja = new Set([...J.zonas.mao, ...J.zonas.comando, ...doCem, ...doExilio, ...doFlash]), doPerm: number[] = [];
  for (const p of e.permJogar || []) { const o = e.objs[p.id]; if (p.j === j && o && o.ts === p.ts && !ja.has(p.id) && o.zona !== 'campo' && o.zona !== 'pilha') { ja.add(p.id); doPerm.push(p.id); } }
  if (M.velFeitico(e, j) && J.terrenos < M.terrenosPorTurno(e, j))
    for (const id of doPerm) { const p = M.permJogar(e, j, e.objs[id]); if (p && !p.soConjurar && M.temTipo(e, e.objs[id], 'Land')) ops.push({ a: 'terreno', id }); }
  for (const id of [...J.zonas.mao, ...J.zonas.comando, ...doCem, ...doExilio, ...doFlash, ...doPerm])
    for (const face of M.facesParaConjurar(e, j, e.objs[id]))
      if (M.podeConjurar(e, j, e.objs[id], face)) ops.push(face === undefined ? { a: 'conjurar', id } : { a: 'conjurar', id, face });
  for (const id of e.campo) {
    const o = e.objs[id]; if (o.ctrl !== j) continue;
    M.atvDe(e, o).forEach((a, k) => { if (!a.deMana && M.podeAtivar(e, j, o, k)) ops.push({ a: 'ativar', id, k }); });
  }
  // habilidade ativada da mão (atv zona 'mao': canalizar, Trumpeting Carnosaur). Do cemitério (Reassembling Skeleton…) ainda não
  for (const id of J.zonas.mao) {
    const o = e.objs[id], l = M.atvDe(e, o);
    // só a que tira a carta da mão no custo: sem isso (banco antes da correção 15) ativaria de graça sem parar
    for (let k = 0; k < l.length; k++) if (l[k].zona === 'mao' && !l[k].deMana && (l[k].custo.descartarEste || l[k].custo.exilarEste) && M.podeAtivar(e, j, o, k)) ops.push({ a: 'ativar', id, k });
  }
  for (const f of M.fontesDeMana(e, j)) f.pacotes.forEach((p, k) => ops.push({ a: 'mana', id: f.id, k: f.k, escolha: k }));
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
function escolherAlvos(e, j, d, fx, ctx, ask, cabe?: (n: number) => boolean, opc?: any) {
  const esc: any[] = [];
  let total = 0;
  for (const i of alvosUsados(fx)) {
    if (!alvoAtivo(d.alvos[i], opc)) { esc[i] = []; continue; }     // alvo de outra opção (chute/presente)
    const a = d.alvos[i], min = a.min ?? 1, max = a.max === 'qualquer' ? Infinity : a.max ?? 1, lista: any[] = [];
    while (lista.length < max) {
      let ops = M.alvosPossiveis(e, a, ctx).filter(x => !lista.some(y => mesmo(x, y))).map(x => ({ a: 'alvo', ...x }));   // CR 115.3
      if (lista.length >= min && cabe && !cabe(total + 1)) ops = [];   // mais um alvo não dá para pagar
      if (lista.length >= min) ops.unshift({ a: 'pronto' });
      if (!ops.length || (ops.length === 1 && ops[0].a === 'pronto' && max === Infinity)) break;
      const r = ask(j, 'alvo', ops, { i, de: ctx.este });
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
  while (modos.length < Math.min(max, n)) {
    const ops: any[] = [];
    if (modos.length >= (es.min ?? 1)) ops.push({ a: 'pronto' });
    for (let m = 0; m < n; m++) if (!modos.includes(m) && modoViavel(e, j, d, f.modos[m])) ops.push({ a: 'modo', m });   // CR 700.2d
    if (!ops.length || (ops.length === 1 && ops[0].a === 'pronto')) break;
    const r = ask(j, 'modo', ops, { de, modos: f.modos });
    if (r.a === 'pronto') break;
    modos.push(r.m);
  }
  return modos.sort((a, b) => a - b);
}
// fx efetivo: modal no topo → só os modos escolhidos, em ordem (CR 700.2)
const fxEfetivo = (d, fx, modos) => modos && fx.length === 1 && fx[0].op === 'modal' ? modos.flatMap(m => fx[0].modos[m]) : fx;
M.fxEfetivo = fxEfetivo;
M.escolherModos = (e, j, d, f, ask) => escolherModos(e, j, d, f, ask);

// custo físico com escolha (sacrificar X, descartar)
function escolherCustoFisico(e, j, c, fonte, daMao, ask) {
  const r = { sac: [] as any[], desc: [] as any[], dev: [] as any[] };
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
  if (c.virar) o.virada = true;
  if (c.desvirar) o.virada = false;
  if (c.vida) J.vida -= c.vida;
  if (c.tirarMarcador) o.marc[c.tirarMarcador.tipo] -= (c.tirarMarcador.qtd || 1);
  for (const id of esc.sac) M.mover(e, id, 'cemiterio');            // CR 701.21
  if (esc.desc.length) M.descartar(e, j, esc.desc);
  if (c.sacrificar === 'este') M.mover(e, o.id, 'cemiterio');
  if (c.exilarEste) M.mover(e, o.id, 'exilio');
  if (c.descartarEste) M.descartar(e, j, [o.id]);                  // CR 701.9 (Otawara, Trumpeting Carnosaur)
  for (const id of esc.dev || []) M.mover(e, id, 'mao');            // à mão do dono (Master Transmuter, Mina and Denn)
  if (c.devolver === 'este') M.mover(e, o.id, 'mao');              // Shigeki
}
function pagarMana(e, j, pl, custo, x) {
  for (const p of pl.passos) M.ativarMana(e, j, p.id, p.k, p.escolha, p.para);
  const pg = M.pagarDaReserva(e.jogs[j].reserva, custo, { x, vidaDisp: pl.vida });
  e.jogs[j].reserva = pg.resto; e.jogs[j].vida -= pg.vida;
}

const PROC = {
  conjurar(e, P, ask) {
    const j = P.j, o = e.objs[P.id], ctx = { voce: j, este: o.id };
    o.face = P.face ?? null;                                                          // 709.3, 712.8b, 716.3: a face vem antes
    const d = M.dadoDe(e, o);
    const modos = modalTopo(d) ? escolherModos(e, j, d, d.fx[0], ask, o.id) : null;          // CR 601.2b
    const fx = fxEfetivo(d, d.fx || [], modos);
    const custo0 = M.custoComImposto(e, o, custoBase(e, j, o, P)), usados = alvosUsados(fx);
    const viaveis = opcoesConj(e, j, d).filter(op => opcOk(e, j, d, usados, custo0, op, o));
    let opc: any = viaveis.length > 1 ? ask(j, 'opcao', viaveis.map(v => ({ a: 'opcao', v })), { id: o.id }).v : viaveis[0] || {};   // 601.2b
    if (opc.presente) opc = { ...opc, jog: ask(j, 'presente', M.vivos(e).filter(x => x !== j).map(x => ({ a: 'jogador', jog: x })), { id: o.id }).jog };   // 702.174a: um oponente
    let custo = custoOpc(d, custo0, opc);
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
    const fis = d.custoAd ? escolherCustoFisico(e, j, d.custoAd, null, o.id, ask) : { sac: [] as any[], desc: [] as any[], dev: [] as any[] };
    const pl = plano(e, j, custo, x, fis.sac, o);                                     // CR 601.2g: mana antes de pagar
    e.proc = null;
    if (!pl) { o.face = null; M.log(e, e.jogs[j].nome, 'desiste de', o.n, '(custo não fecha)'); return; }   // CR 727: volta atrás
    const doComando = o.zona === 'comando', de = o.zona, flash = porFlash(e, j, o) && !P.gratis;
    const sacLki = (fis.sac || []).map(id => M.lkiDe(e, e.objs[id]));                 // "o poder da sacrificada" (custo adicional): LKI
    M.mover(e, o.id, 'pilha'); o.ctrl = j; o.face = P.face ?? null; if (flash) o.flash = true;                    // CR 601.2a (o mover zera a face)
    o.pil = { x, alvos, modos, ctrl: j, opc, ...(sacLki.length ? { sac: sacLki } : {}) };
    M.evento(e, { ev: 'conjura', id: o.id, j, de });                                      // 601.2i: "quando conjura"
    M.eventosAlvo(e, alvos, o.id);
    pagarMana(e, j, pl, custo, x);                                                    // CR 601.2h
    if (d.custoAd) pagarFisico(e, j, o, d.custoAd, fis);
    if (doComando) e.jogs[j].imposto[o.id] = (e.jogs[j].imposto[o.id] || 0) + 1;      // CR 903.8
    e.turno.magias = (e.turno.magias || 0) + 1;
    M.log(e, e.jogs[j].nome, 'conjura', o.n, x ? `(X=${x})` : '', opc.chute ? '(com chute)' : '', opc.presente ? `(presente para ${e.jogs[opc.jog].nome})` : '', descAlvos(e, alvos));
    if (!P.loucura && !P.agora) M.agiu(e, j);                                                     // CR 601.2i → 117.3c (loucura: no meio da resolução)
  },

  ativar(e, P, ask) {
    const j = P.j, o = e.objs[P.id], a = M.atvDe(e, o)[P.k], c = a.custo, ctx = { voce: j, este: o.id };
    const ex = c.virar || c.sacrificar === 'este' || c.devolver === 'este' ? [o.id] : [];
    const mana = M.custoAtv(e, o, a);                                                 // CR 602.2b → 601.2f (reduzCusto deHabil)
    let x = 0;
    if (mana && mana.x) {
      const mx = maxX(e, j, mana, ex);
      x = ask(j, 'x', Array.from({ length: mx + 1 }, (_, v) => ({ a: 'x', v })).reverse(), { id: o.id }).v;
    }
    const alvos = escolherAlvos(e, j, a, a.fx, { ...ctx, x }, ask);                   // CR 602.2b → 601.2c
    const fis = escolherCustoFisico(e, j, c, o.id, c.descartarEste ? o.id : null, ask);
    const pl = mana ? plano(e, j, mana, x, [...ex, ...fis.sac, ...fis.dev]) : { passos: [] as any[], vida: 0 };
    e.proc = null;
    if (!pl) { M.log(e, e.jogs[j].nome, 'desiste de ativar', o.n); return; }
    // a habilidade vai para a pilha independente da fonte (CR 113.7a): leva o texto e o que sabia da fonte
    const id = e.prox++;
    const h = { id, n: o.n, dono: j, ctrl: j, zona: 'pilha', ts: ++e.ts, virada: false, dano: 0, marc: {} as any, doente: false, cmd: false,
      hab: { fonte: o.id, fonteTs: o.ts, k: P.k, fx: a.fx, alvos: a.alvos || [], ficha: o.ficha || null },
      pil: { x, alvos, ctrl: j, lki: { este: lkiDe(e, o) } } };
    e.objs[id] = h; e.pilha.push(id);
    M.eventosAlvo(e, alvos, id);
    if (mana) pagarMana(e, j, pl, mana, x);
    pagarFisico(e, j, o, c, fis);
    if (a.lealdade !== undefined) { o.marc.lealdade = (o.marc.lealdade || 0) + a.lealdade; o.lealTurno = e.turno.n; }   // CR 606.4
    if (a.limite === 'umaPorTurno') (o.usos = o.usos || {})[P.k] = e.turno.n;
    M.log(e, e.jogs[j].nome, 'ativa', o.n, descAlvos(e, alvos));
    M.agiu(e, j);
  },

  // CR 608.2: resolve o objeto do topo
  resolver(e, P, ask) {
    const o = e.objs[P.id], pil = o.pil, j = pil.ctrl;
    const d = o.hab ? { fx: o.hab.fx, alvos: o.hab.alvos } : M.dadoDe(e, o);
    const fx = fxEfetivo(d, d.fx || [], pil.modos);
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
    const ctx = P.ctx = P.ctx || { voce: j, este: o.hab ? o.hab.fonte : o.id, x: pil.x, alvos: pil.alvos || [], defAlvos: d.alvos || [], ilegal: P.ilegal, lki: pil.lki, item: o.id, ev: pil.ev || null, opc: pil.opc || null, sac: pil.sac || null, ...(pil.mem || {}) };
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
  if (o.flash && !o.hab) { delete o.flash; o.pil = null; M.mover(e, o.id, 'exilio'); M.log(e, o.n, 'vai para o exílio (recapitular)'); return; }   // 702.34a (resolvida ou anulada)
  if (o.hab) { const k = e.pilha.indexOf(o.id); if (k >= 0) e.pilha.splice(k, 1); delete e.objs[o.id]; return; }
  if (resolveu && M.ehPermanente(e, o)) {
    const plano = M.decidirEntrada(e, o.id, o.pil.ctrl, {}, ask);   // pergunta antes de mexer
    const conj = o.pil.opc;
    o.pil = null;
    M.aplicarEntrada(e, { ...plano, conj });                       // "se foi chutada" depois de entrar (Goblin Bushwhacker)
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

M.resolverTopo = e => {
  const id = e.pilha[e.pilha.length - 1];
  M.iniciarProc(e, { tp: 'resolver', id });
};
M.conjurar = (e, j, id, face?) => M.iniciarProc(e, face === undefined ? { tp: 'conjurar', j, id } : { tp: 'conjurar', j, id, face });
// face de terreno de uma carta modal cuja frente não é terreno (Bala Ged Recovery → Bala Ged Sanctuary); 712.9
M.faceTerreno = (e, o) => M.formaDe(e, o) === 'modal' && ((M.carta(o.n).faces[0] || {}).tipos || []).includes('Land');
M.ativar = (e, j, id, k) => M.iniciarProc(e, { tp: 'ativar', j, id, k });

// anular (CR 701.6): a mágica sai da pilha para o cemitério do dono; habilidade some
M.anular = (e, id) => { const o = e.objs[id]; if (!o || o.zona !== 'pilha') return; o.pil = null; tirarDaPilha(e, o, false); };

function lkiDe(e, o) {
  return { id: o.id, ts: o.ts, n: o.n, ctrl: o.ctrl, dono: o.dono, poder: M.poder(e, o), resist: M.resistencia(e, o), vm: M.dadoDe(e, o).vm || 0, marc: { ...o.marc }, transf: o.transf || 0, face: o.face ?? null };
}
M.lkiDe = lkiDe;
function descAlvos(e, alvos) {
  const t = (alvos || []).flat().filter(Boolean).map(a => a.jog !== undefined ? e.jogs[a.jog].nome : (e.objs[a.o] || {}).n);
  return t.length ? '→ ' + t.join(', ') : '';
}
