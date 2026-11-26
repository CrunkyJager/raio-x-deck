// src/motor/mana.ts (T43: migrado de motor2/mana.js) — reserva de mana (CR 106), habilidades de mana (CR 605), pagar custos (CR 601.2g–h, 107.4),
// imposto do comandante (CR 903.8) e o plano automático de quais fontes virar.
import { M } from './nucleo';

const CORES = M.CORES, TIPOS = ['W', 'U', 'B', 'R', 'G', 'C'];

// ---- o que uma habilidade de mana produz: lista de "pacotes" (cada pacote = uma escolha completa) ----
// prod: lista = escolher 1 (Temple: B ou G) · 'qualquer' · 'comandante' (identidade, CR 903.4f: sem cor → nada)
// 'refletida' (Exotic Orchard: o que terrenos de oponentes poderiam produzir) · 'escolhida' (cor escolhida ao entrar: T19)
M.coresDeProd = (e, o, prod) => {
  const esc = o.escolha && o.escolha.cor;                         // cor escolhida ao entrar (Thriving, Coldsteel Heart)
  if (Array.isArray(prod)) return [...new Set(prod.flatMap(c => c === 'escolhida' ? (esc ? [esc] : []) : [c]))];
  if (prod === 'escolhida') return esc ? [esc] : [];
  if (prod === 'qualquer') return CORES;
  if (prod === 'comandante') return CORES.filter(c => e.jogs[o.ctrl].ci.includes(c));
  if (prod === 'refletida' || prod === 'deSeusTerrenos') {
    // refletida (Exotic Orchard): terrenos dos oponentes, só cores. deSeusTerrenos (Incubation Druid): "any TYPE that a
    // land you control could produce" — terrenos seus, incolor conta (CR 106.7, 106.1b)
    const meus = prod === 'deSeusTerrenos', s = new Set<any>();
    for (const id of e.campo) {
      const t = e.objs[id];
      if ((t.ctrl === o.ctrl) !== meus || !M.temTipo(e, t, 'Land')) continue;
      for (const a of M.atvDe(e, t)) if (a.deMana) for (const f of a.fx || [])
        if (f.op === 'mana' && f.prod !== 'refletida' && f.prod !== 'deSeusTerrenos') (M.coresDeProd(e, t, f.prod) || []).forEach(c => s.add(c));
    }
    return TIPOS.filter(c => s.has(c) && (meus || c !== 'C'));
  }
  return null;
};

// filtro da mana restrita → filtro RX que o núcleo entende (null = restrição que ainda não sabe: a fonte não é usada)
// 'escolhido' = o tipo escolhido ao entrar (Cavern of Souls, Unclaimed Territory); 'Legendary' veio como sub
M.filtroSo = (o, so) => {
  const k = Object.keys(so);
  if (!k.length || k.some(x => x !== 'tipo' && x !== 'sub')) return null;
  const f: any = {};
  if (so.tipo) { if (so.tipo.includes('Card')) return null; f.tipo = so.tipo; }
  if (so.sub) {
    if (so.sub.some(x => x === 'Kicked' || x === 'Colorless')) return null;
    if (so.sub.includes('Legendary')) f.super = ['Legendary'];
    const sub = so.sub.filter(x => x !== 'Legendary').map(x => x === 'escolhido' ? o.escolha && o.escolha.tipo : x);
    if (sub.some(x => !x)) return null;
    if (sub.length) f.sub = sub;
  }
  return f;
};
M.pacotesDe = (e, o, atv, ctx: any = {}) => {
  let pac = [M.zeroMana()];
  for (const f of atv.fx || []) {
    if (f.op !== 'mana') return null;              // habilidade de mana com efeito extra: T17/T19
    if (f.so) {                                    // mana restrita (CR 106.6): só no plano de quem paga 'para', e se bater
      const fs = M.filtroSo(o, f.so);
      if (!fs) return null;
      if (!ctx.para || !M.bate(e, ctx.para, fs, { voce: o.ctrl })) continue;
    }
    if (f.se && !M.condicao(e, f.se, { voce: o.ctrl, este: o.id })) continue;
    const cs = M.coresDeProd(e, o, f.prod);
    const q = M.qtd(e, f.qtd, { voce: o.ctrl, este: o.id, x: ctx.x });
    if (!cs || q === null) return null;
    if (!cs.length || q <= 0) continue;
    const novo: any[] = [];
    for (const p of pac) for (const c of cs) { const n = { ...p }; n[c] += q; novo.push(n); }
    pac = novo;
  }
  return pac;
};

// ---- custo de ativação simples (o que a T14 sabe pagar): virar, mana, sacrificar este, vida ----
const CUSTO_OK = new Set(['virar', 'mana', 'sacrificar', 'vida']);
M.podeCustoAtv = (e, o, c) => {
  for (const k in c) if (!CUSTO_OK.has(k)) return false;
  if (c.sacrificar && c.sacrificar !== 'este') return false;
  if (c.virar && (o.virada || (o.doente && M.temTipo(e, o, 'Creature') && !M.temKw(e, o, 'pressa')))) return false;   // CR 302.6, 702.10
  if (c.vida && (typeof c.vida !== 'number' || e.jogs[o.ctrl].vida < c.vida || M.vidaFixa(e, o.ctrl))) return false; // CR 119.4, 119.8
  if (c.mana && !M.pagarDaReserva(e.jogs[o.ctrl].reserva, c.mana)) return false;
  return true;
};
const pagarCustoAtv = (e, o, c) => {
  if (c.virar) o.virada = true;
  if (c.mana) e.jogs[o.ctrl].reserva = M.pagarDaReserva(e.jogs[o.ctrl].reserva, c.mana).resto;
  if (c.vida) e.jogs[o.ctrl].vida -= c.vida;
  if (c.sacrificar === 'este') M.mover(e, o.id, 'cemiterio');
};

// habilidades de mana disponíveis de um jogador: [{id, k, pacotes}]
M.fontesDeMana = (e, j, { soVirar = false, para = null }: any = {}) => {
  const mk = M.memo && 'f' + j + (soVirar ? 'v' : '') + (para ? 'p' + para.id : '');
  if (mk && M.memo[mk]) return M.memo[mk];
  const r: any[] = [];
  if (mk) M.memo[mk] = r;
  for (const id of e.campo) {
    const o = e.objs[id];
    if (o.ctrl !== j) continue;
    M.atvDe(e, o).forEach((a, k) => {
      if (!a.deMana || !a.custo || !M.podeCustoAtv(e, o, a.custo) || !M.atvSeOk(e, a, o)) return;
      // soVirar: sem pagar mana nem vida ({T} e/ou sacrificar este: terreno, Lotus Petal, Treasure, Gold)
      if (soVirar && Object.keys(a.custo).some(x => x !== 'virar' && !(x === 'sacrificar' && a.custo.sacrificar === 'este'))) return;
      const p = M.pacotesDe(e, o, a, { para });
      if (p && p.length && p.some(x => soma(x) > 0)) r.push({ id, k, pacotes: p, sac: a.custo.sacrificar === 'este' ? 1 : 0 });
    });
  }
  return r;
};

// ativar habilidade de mana (CR 605.3: não usa a pilha)
M.ativarMana = (e, j, id, k, escolha = 0, para = null) => {
  const o = e.objs[id], a = M.atvDe(e, o)[k];
  if (o.ctrl !== j || !a.deMana || !M.podeCustoAtv(e, o, a.custo)) throw new Error('mana ilegal: ' + o.n);
  const p = M.pacotesDe(e, o, a, { para })[escolha];
  pagarCustoAtv(e, o, a.custo);
  const R = e.jogs[j].reserva;
  for (const c of TIPOS) R[c] += p[c];
  M.log(e, e.jogs[j].nome, 'mana de', o.n, fmt(p));
};

// CR 106.4: a reserva esvazia no fim de cada etapa e fase
// ficaNoTurno (efeito mana: Neheb, Birgi): dessa mana, o que ainda não foi gasto fica até o fim do turno
M.esvaziarReservas = e => {
  for (const J of e.jogs) {
    const F = J.fica && J.fica.t === e.turno.n && e.turno.passo !== 'limpeza' ? J.fica : null, r = M.zeroMana();
    if (F) for (const c of TIPOS) { r[c] = Math.min(J.reserva[c], F.m[c]); F.m[c] = r[c]; }
    J.reserva = r;
  }
};

const soma = p => TIPOS.reduce((s, c) => s + p[c], 0);
const fmt = p => TIPOS.filter(c => p[c]).map(c => c.repeat(p[c])).join('') || '—';
M.somaMana = soma; M.fmtMana = fmt;

// ---- custo de mana → símbolos (CR 107.4) ----
// retorna {cor:[...], hib:[[a,b]...], fir:[cor...], dois:[cor...], g:n}
const simbolos = (custo, x = 0) => {
  const s = { cor: [] as any[], hib: [] as any[], fir: [] as any[], dois: [] as any[], g: (custo.g || 0) + (custo.x || 0) * x, neve: 0 };
  for (const p of custo.p || []) {
    if (/^[WUBRGC]$/.test(p)) s.cor.push(p);
    else if (p === 'S') s.neve++;
    else if (/^[WUBRG]\/P$/.test(p)) s.fir.push(p[0]);                      // CR 107.4f: cor ou 2 vidas
    else if (/^2\/[WUBRG]$/.test(p)) s.dois.push(p[2]);                     // CR 107.4e: cor ou {2}
    else if (/^[WUBRGC]\/[WUBRG]$/.test(p)) s.hib.push([p[0], p[2]]);       // CR 107.4e híbrido
    else if (/^[WUBRG]\/[WUBRG]\/P$/.test(p)) s.hib.push([p[0], p[2], 'P']); // híbrido phyrexiano
    else throw new Error('símbolo de mana desconhecido: ' + p);
  }
  return s;
};
M.simbolos = simbolos;
M.vmDe = custo => { const s = simbolos(custo); return s.g + s.cor.length + s.hib.length + s.fir.length + s.neve + 2 * s.dois.length; };

// Pagar da reserva. Retorna {resto, vida} ou null. vidaDisp = quanto de vida pode gastar em phyrexiano (0 = não).
// Ordem: símbolo exato → híbridos (testa as opções) → phyrexiano → 2/cor → genérico (gasta incolor primeiro,
// depois a cor mais sobrando).
M.pagarDaReserva = (reserva, custo, { x = 0, vidaDisp = 0 }: any = {}) => {
  const s = simbolos(custo, x);
  if (s.neve) return null;                         // mana de neve: sem fonte modelada ainda
  const r = { ...reserva };
  for (const c of s.cor) { if (r[c] <= 0) return null; r[c]--; }
  const resto = (r, i, vida) => {
    if (i < s.hib.length) {
      const h = s.hib[i];
      for (const c of h) {
        if (c === 'P') { if (vida + 2 <= vidaDisp) { const v = resto(r, i + 1, vida + 2); if (v) return v; } continue; }
        if (r[c] > 0) { r[c]--; const v = resto(r, i + 1, vida); if (v) return v; r[c]++; }
      }
      return null;
    }
    const q = { ...r }; let v = vida;
    for (const c of s.fir) { if (q[c] > 0) q[c]--; else if (v + 2 <= vidaDisp) v += 2; else return null; }
    let g = s.g;
    for (const c of s.dois) { if (q[c] > 0) q[c]--; else g += 2; }
    const ordem = ['C', ...CORES.slice().sort((a, b) => q[b] - q[a])];
    for (const c of ordem) { const t = Math.min(g, q[c]); q[c] -= t; g -= t; }
    return g > 0 ? null : { resto: q, vida: v };
  };
  return resto(r, 0, 0);
};

// imposto do comandante (CR 903.8): +{2} por vez que já foi conjurado da zona de comando
// custo + vezes × extra (só a parte de mana: genérico g e símbolos p)
M.somaCusto = (c, extra, vezes = 1) => {
  const r = { ...c };
  if (extra.g) r.g = (r.g || 0) + extra.g * vezes;
  if (extra.p && extra.p.length) r.p = [...(r.p || []), ...Array.from({ length: vezes }, () => extra.p).flat()];
  return r;
};
// base: um custo alternativo no lugar do custo de mana (loucura, CR 702.35b); imposto e reduções valem igual (601.2f)
M.custoComImposto = (e, o, base?) => {
  const c = { ...(base || M.dadoDe(e, o).custo || {}) };
  if (o.cmd && o.zona === 'comando') c.g = (c.g || 0) + 2 * (e.jogs[o.dono].imposto[o.id] || 0);
  return reduz(c, reducoes(e, o.dono, o, false));
};
// custo de mana de uma habilidade ativada (só a parte de mana) com as reduções deHabil (Sanctum of Tranquil Light, Otawara)
M.custoAtv = (e, o, a) => a.custo.mana ? reduz({ ...a.custo.mana }, reducoes(e, o.ctrl, o, true)) : a.custo.mana;

// ---- reduzCusto (CR 601.2f): depois dos aumentos (imposto), tira genérico; custo.p tira símbolos coloridos (Morophon).
// Fontes: as estáticas do campo (afeta filtro: a mágica que você conjura, ou o permanente dono da habilidade) e a da
// própria carta (afeta 'este', de 'mao' = só da mão: Ghalta, Otawara). O filtro com zona 'pilha' fala da mágica que
// está sendo conjurada (ainda na mão quando o custo é calculado). Redução de genérico não mexe no X (simplificação).
const RED_OK = new Set(['modo', 'afeta', 'de', 'qtd', 'custo', 'deHabil', 'se']);
M.estReduzOk = s => !!s && s.modo === 'reduzCusto' && Object.keys(s).every(k => RED_OK.has(k) || k.startsWith('_'))
  && (s.afeta === 'este' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && (s.de === undefined || s.de === 'mao')
  && (s.custo === undefined ? s.qtd !== undefined && M.qtdEstOk(s.qtd)
    : s.qtd === undefined && Object.keys(s.custo).every(k => k === 'p') && Array.isArray(s.custo.p))
  && (!s.se || M.seOk(s.se));
function reducoes(e, j, o, deHabil) {
  const r = { g: 0, p: [] as string[] };
  const fontes = M.indiceCampo(e).est.map(id => e.objs[id]);
  if (o.zona !== 'campo' && M.dadoDe(e, o).est) fontes.push(o);
  for (const F of fontes) for (const s of M.dadoDe(e, F).est || []) {
    if (s.modo !== 'reduzCusto' || !!s.deHabil !== deHabil || !M.estReduzOk(s)) continue;
    const ctx = { voce: F.ctrl, este: F.id };
    if (s.afeta === 'este') { if (F.id !== o.id || (s.de && o.zona !== s.de)) continue; }
    else {
      if (F.zona !== 'campo') continue;                               // a estática com filtro só vale do campo
      const { zona, ctrl, ...f } = s.afeta;
      if (ctrl && ctrl !== 'qualquer' && (ctrl === 'voce') !== (j === F.ctrl)) continue;
      if (deHabil ? zona && zona !== 'qualquer' && o.zona !== zona : zona && zona !== 'pilha') continue;
      if (!M.bate(e, o, f, ctx)) continue;
    }
    if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } if (!ok) continue; }
    if (s.custo) r.p.push(...s.custo.p); else r.g += Math.max(0, M.qtdEst(e, s.qtd, ctx));
  }
  return r;
}
function reduz(c, r) {
  if (r.g && c.g) c.g = Math.max(0, c.g - r.g);
  if (r.p.length && c.p && c.p.length) { const p = c.p.slice(); for (const x of r.p) { const i = p.indexOf(x); if (i >= 0) p.splice(i, 1); } c.p = p; }
  return c;
}

// ---- plano: quais fontes ativar para pagar um custo (a IA e a conjuração da T15 usam) ----
// Busca em profundidade: fontes menos flexíveis primeiro (Floresta antes de Command Tower), poda por quantidade.
// Retorna {passos:[{id,k,escolha}], resto, vida} ou null.
M.planoMana = (e, j, custo, { x = 0, vidaDisp = 0, limite = 4000, excluir = null, para = null }: any = {}) => {
  const R = e.jogs[j].reserva;
  const direto = M.pagarDaReserva(R, custo, { x, vidaDisp });
  if (direto) return { passos: [] as any[], ...direto };
  const s = simbolos(custo, x);
  // unidades de mana que faltam no mínimo (phyrexiano pode sair em vida; 2/cor conta 1 se vier na cor)
  const precisa = Math.max(0, s.g + s.cor.length + s.hib.length + s.dois.length + s.fir.length - Math.floor(vidaDisp / 2));
  const fontes = M.fontesDeMana(e, j, { soVirar: true, para }).filter(f => !excluir || !excluir.includes(f.id))
    .map(f => ({ ...f, max: Math.max(...f.pacotes.map(soma)), flex: f.pacotes.length }))
    .sort((a, b) => a.sac - b.sac || a.flex - b.flex || b.max - a.max);   // a que se sacrifica por último
  const sufixo: any[] = []; let acc = 0;
  for (let i = fontes.length - 1; i >= 0; i--) { acc += fontes[i].max; sufixo[i] = acc; }
  let nos = 0;
  const passos: any[] = [], r = { ...R }, usados = new Set<any>();
  const dfs = (i, tem) => {
    if (++nos > limite) return null;
    if (tem >= precisa) { const p = M.pagarDaReserva(r, custo, { x, vidaDisp }); if (p) return { passos: passos.slice(), ...p }; }
    if (i >= fontes.length || tem + sufixo[i] < precisa) return null;
    const f = fontes[i];
    if (usados.has(f.id)) return dfs(i + 1, tem);                 // mesma permanente com 2 habilidades de {T}: vira uma vez só
    usados.add(f.id);
    for (let k = 0; k < f.pacotes.length; k++) {
      const p = f.pacotes[k];
      for (const c of TIPOS) r[c] += p[c];
      passos.push({ id: f.id, k: f.k, escolha: k, para });
      const v = dfs(i + 1, tem + soma(p)); if (v) return v;
      passos.pop();
      for (const c of TIPOS) r[c] -= p[c];
    }
    usados.delete(f.id);
    return dfs(i + 1, tem);
  };
  return dfs(0, soma(R));
};

// executa o plano e paga (a conjuração em si é T15; aqui deixa o custo pago e a reserva com o resto)
M.pagarComPlano = (e, j, custo, opc: any = {}) => {
  const pl = M.planoMana(e, j, custo, opc);
  if (!pl) return false;
  for (const p of pl.passos) M.ativarMana(e, j, p.id, p.k, p.escolha, p.para);
  const pg = M.pagarDaReserva(e.jogs[j].reserva, custo, opc);
  e.jogs[j].reserva = pg.resto; e.jogs[j].vida -= pg.vida;
  return true;
};
