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
  if (prod && typeof prod === 'object' && prod.coresEntre) {      // "one mana of any color among legendary creatures and planeswalkers you control" (Mox Amber)
    const s = new Set<string>();
    for (const x of M.objetosQue(e, { zona: 'campo', ...prod.coresEntre }, { voce: o.ctrl, este: o.id })) for (const c of M.dadoDe(e, x).cores || '') s.add(c);
    return CORES.filter(c => s.has(c));
  }
  if (prod === 'comandante') return CORES.filter(c => e.jogs[o.ctrl].ci.includes(c));
  // {cadaCor: filtro}: "for each color among permanents you control, add one mana of that color" (Faeburrow Elder, Bloom
  // Tender): as cores do conjunto. pacotesDe dá TODAS juntas (um pacote só), não uma à escolha
  if (prod && typeof prod === 'object' && prod.cadaCor) {
    const s = new Set(M.objetosQue(e, prod.cadaCor, { voce: o.ctrl, este: o.id }).flatMap(x => (M.dadoDe(e, x).cores || '').split('')));
    return CORES.filter(c => s.has(c));
  }
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
  if (!k.length || k.some(x => x !== 'tipo' && x !== 'sub' && !(x === 'zona' && so.zona === 'pilha'))) return null;   // zona pilha: "só para conjurar" (o 'para' é sempre a mágica)
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
// CR 605.1b: "sempre que [terreno] for virado para mana, adicione…" (Wild Growth, Fertile Ground, Regal Behemoth,
// Mirari's Wake) é habilidade de mana desencadeada: resolve na hora, sem pilha (605.4a). O motor soma a mana dela aos
// pacotes da habilidade que vira o terreno (o solver já conta com ela). Quem recebe: 'controlador' = quem controla o
// terreno; sem quem = quem controla a fonte do gatilho. Só entra no pacote quando quem recebe é quem virou; senão vai
// direto à reserva do outro no ativarMana.
M.gatManaOk = g => !!g && g.ev === 'viraParaMana' && Object.keys(g).every(k => ['ev', 'quem', 'se', 'fx'].includes(k)) && (!g.quem || M.filtroOk(g.quem))
  && (!g.se || (Object.keys(g.se).every(k => ['monarca', 'controla', 'existe'].includes(k)) && M.condValorOk(g.se))) && (g.fx || []).length > 0
  && g.fx.every(f => f.op === 'mana' && Object.keys(f).every(k => ['op', 'prod', 'qtd', 'quem'].includes(k)) && [undefined, 'voce', 'controlador'].includes(f.quem)
    && (f.qtd === undefined || (Number.isInteger(f.qtd) && f.qtd > 0)) && (f.prod === 'qualquer' || f.prod === 'doTerreno' || (Array.isArray(f.prod) && f.prod.every(c => TIPOS.includes(c)))));
// [fonte, fx, quem recebe] dos gatilhos de mana que olham para o terreno o
const gatsMana = (e, o) => {
  const mk = M.memo && 'vpm';
  let fontes: any[] = mk && M.memo[mk];
  if (!fontes) {
    fontes = [];
    for (const id of e.campo) { const F = e.objs[id]; for (const g of M.gatDe(e, F)) if (g.ev === 'viraParaMana' && M.gatManaOk(g)) fontes.push([F, g]); }
    if (mk) M.memo[mk] = fontes;
  }
  const r: any[] = [];
  for (const [F, g] of fontes) {
    const ctx = { voce: F.ctrl, este: F.id };
    if (g.quem && !M.bate(e, o, { zona: 'campo', ...g.quem }, ctx)) continue;
    if (g.se && !M.condicao(e, g.se, ctx)) continue;
    for (const f of g.fx) r.push([F, f, f.quem === 'controlador' ? o.ctrl : F.ctrl]);
  }
  return r;
};
M.gatsMana = gatsMana;
M.pacotesDe = (e, o, atv, ctx: any = {}) => {
  let pac = [M.zeroMana()];
  for (const f of atv.fx || []) {
    if (f.op !== 'mana') return null;              // habilidade de mana com efeito extra: T17/T19
    if (f.so) {                                    // mana restrita (CR 106.6): só no plano de quem paga 'para', e se bater
      const fs = M.filtroSo(o, f.so);
      if (!fs) return null;
      if (!ctx.comSo && (!ctx.para || !M.bate(e, ctx.para, fs, { voce: o.ctrl }))) continue;   // comSo: a ativação com escolha guarda a restrita à parte
    }
    if (f.se && !M.condicao(e, f.se, { voce: o.ctrl, este: o.id })) continue;
    if (f.prod === 'cadaCorSuas') {                // "para cada cor entre as permanentes que você controla, adicione uma daquela cor" (Faeburrow Elder): um pacote só
      const cs = M.coresEntre(e, e.campo.map(id => e.objs[id]).filter(x => x.ctrl === o.ctrl));
      pac = pac.map(p => { const n = { ...p }; for (const c of cs) n[c] += 1; return n; });
      continue;
    }
    const cs = M.coresDeProd(e, o, f.prod);
    const q = M.qtd(e, f.qtd, { voce: o.ctrl, este: o.id, x: ctx.x });
    if (!cs || q === null) return null;
    if (!cs.length || q <= 0) continue;
    if (f.prod && f.prod.cadaCor) { pac = pac.map(p => { const n = { ...p }; for (const c of cs) n[c] += q; return n; }); continue; }
    const novo: any[] = [];
    for (const p of pac) for (const c of cs) { const n = { ...p }; n[c] += q; novo.push(n); }
    pac = novo;
  }
  if (atv.custo && atv.custo.virar) {   // "add one mana of any type that land produced" (Mirari's Wake, 106.7): dos tipos do pacote do próprio terreno
    const G = gatsMana(e, o).filter(([, f, quem]) => quem === o.ctrl && f.prod === 'doTerreno');
    for (const [, f] of G) { const novo: any[] = []; for (const p of pac) for (const c of TIPOS) if (p[c] > 0) { const n = { ...p }; n[c] += f.qtd ?? 1; novo.push(n); } pac = novo; }
  }
  if (atv.custo && atv.custo.virar) for (const [F, f, quem] of gatsMana(e, o)) {   // 605.1b: só "virado para mana"
    if (quem !== o.ctrl || f.prod === 'doTerreno') continue;
    const cs = M.coresDeProd(e, F, f.prod), q = f.qtd ?? 1, novo: any[] = [];
    for (const p of pac) for (const c of cs) { const n = { ...p }; n[c] += q; novo.push(n); }
    pac = novo;
  }
  return pac;
};

// ---- custo de ativação simples (o que a T14 sabe pagar): virar, mana, sacrificar este, vida, virar outros ----
// virarOutros na mana (Baylen: "vire duas fichas desviradas"): sem pergunta (605.3, mana não usa a pilha); só conta quem
// não tem habilidade de mana própria (senão o solver usaria a mesma ficha duas vezes) e vira primeiro o que não ataca.
const CUSTO_OK = new Set(['virar', 'mana', 'sacrificar', 'vida', 'virarOutros']);
M.custoManaOk = c => Object.keys(c || {}).every(k => CUSTO_OK.has(k)) && (!c.sacrificar || c.sacrificar === 'este') && (!c.virarOutros || M.custoSuportado({ virarOutros: c.virarOutros }));
const virMana = (e, o, c) => M.candVir(e, o.ctrl, c, o.id).filter(x => !M.atvDe(e, x).some(a => a.deMana))
  .sort((a, b) => (M.temTipo(e, a, 'Creature') && !a.doente ? 1 : 0) - (M.temTipo(e, b, 'Creature') && !b.doente ? 1 : 0));
M.podeCustoAtv = (e, o, c) => {
  if (!M.custoManaOk(c)) return false;
  if (c.virar && (o.virada || (o.doente && M.temTipo(e, o, 'Creature') && !M.temKw(e, o, 'pressa')))) return false;   // CR 302.6, 702.10
  if (c.vida && (typeof c.vida !== 'number' || e.jogs[o.ctrl].vida < c.vida || M.vidaFixa(e, o.ctrl))) return false; // CR 119.4, 119.8
  if (c.mana && !M.pagarDaReserva(e.jogs[o.ctrl].reserva, c.mana)) return false;
  if (c.virarOutros && virMana(e, o, c).length < (c.virarOutros.qtd || 1)) return false;   // 302.6 não vale: não é o {T} delas
  return true;
};
const pagarCustoAtv = (e, o, c) => {
  if (c.virarOutros) for (const x of virMana(e, o, c).slice(0, c.virarOutros.qtd || 1)) M.virarObj(e, x);
  if (c.virar) M.virarObj(e, o);
  if (c.mana) e.jogs[o.ctrl].reserva = M.pagarDaReserva(e.jogs[o.ctrl].reserva, c.mana).resto;
  if (c.vida) M.perderVida(e, o.ctrl, c.vida);
  if (c.sacrificar === 'este') M.mover(e, o.id, 'cemiterio', { sac: true });
};

// habilidades de mana disponíveis de um jogador: [{id, k, pacotes}]
M.fontesDeMana = (e, j, { soVirar = false, para = null }: any = {}) => {
  const mk = M.memo && 'f' + j + (soVirar ? 'v' : '') + (para ? 'p' + para.id : '');
  if (mk && M.memo[mk]) return M.memo[mk];
  const r: any[] = [];
  if (mk) M.memo[mk] = r;
  for (const id of e.campo) {
    const o = e.objs[id];
    if (o.ctrl !== j || M.ativBloqueada(e, o)) continue;   // Linvala: nem as de mana (605.1a)
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
  if (a.custo.virar) for (const [F, f, quem] of gatsMana(e, o)) if (quem !== j && !e.jogs[quem].saiu) {   // gatilho de mana de outro jogador (Fertile Ground do oponente no seu terreno)
    if (f.prod === 'doTerreno') continue;   // só para quem virou (Mirari's Wake é "you tap")
    const c = (M.coresDeProd(e, F, f.prod) || [])[0]; if (c) { e.jogs[quem].reserva[c] += f.qtd ?? 1; M.log(e, e.jogs[quem].nome, 'mana de', F.n, (f.qtd ?? 1) + c); }
  }
};

// CR 106.4: a reserva esvazia no fim de cada etapa e fase
// ficaNoTurno (efeito mana: Neheb, Birgi): dessa mana, o que ainda não foi gasto fica até o fim do turno
M.esvaziarReservas = e => {
  for (const J of e.jogs) {
    const F = J.fica && J.fica.t === e.turno.n && e.turno.passo !== 'limpeza' ? J.fica : null, r = M.zeroMana();
    // ficaNoCombate (firebending): até o fim do combate — fica ao fim das etapas de combate, menos a do fim do combate
    const C = J.ficaC && J.ficaC.t === e.turno.n && ['inicioCombate', 'atacantes', 'bloqueadores', 'dano'].includes(e.turno.passo) ? J.ficaC : null;
    if (F || C) for (const c of TIPOS) { const f = F ? F.m[c] : 0; r[c] = Math.min(J.reserva[c], f + (C ? C.m[c] : 0)); if (F) F.m[c] = Math.min(f, r[c]); if (C) C.m[c] = r[c] - (F ? F.m[c] : 0); }
    if (!C) J.ficaC = null;
    J.reserva = r; J.restrita = (J.restrita || []).filter(x => x.fica === e.turno.n && e.turno.passo !== 'limpeza');   // restrita com ficaNoTurno (Klauth)
  }
};

// mana restrita na reserva (CR 106.6): J.restrita = [{m, f}] (m = mana, f = filtro RX da mágica que pode pagar).
// Esvazia junto com a reserva. Só a mágica que bate o filtro (o 'para' do plano) enxerga essa mana; ela é gasta primeiro.
M.restritaPara = (e, j, para) => para ? (e.jogs[j].restrita || []).filter(r => M.bate(e, para, r.f, { voce: j })) : [];
M.reservaCom = (e, j, para) => {
  const R = { ...e.jogs[j].reserva };
  for (const r of M.restritaPara(e, j, para)) for (const c of TIPOS) R[c] += r.m[c];
  return R;
};
// depois de pagar com reservaCom: resto = o que sobrou de tudo; a restrita sai primeiro, o resto volta à reserva comum
M.acertarRestrita = (e, j, para, resto) => {
  const rs = M.restritaPara(e, j, para), J = e.jogs[j];
  if (!rs.length) { J.reserva = resto; return; }
  const R = { ...resto }, comum = J.reserva;
  for (const c of TIPOS) {
    let sobraRes = Math.max(0, R[c] - comum[c]);                      // o que sobrou além da comum é restrita
    for (const r of rs) { const k = Math.min(r.m[c], sobraRes); sobraRes -= k; r.m[c] = k; }
    R[c] = Math.min(R[c], comum[c]);
  }
  J.restrita = J.restrita.filter(r => soma(r.m) > 0);
  J.reserva = R;
};

const soma = p => TIPOS.reduce((s, c) => s + p[c], 0);
const fmt = p => TIPOS.filter(c => p[c]).map(c => c.repeat(p[c])).join('') || '—';
M.somaMana = soma; M.fmtMana = fmt;

// ---- custo de mana → símbolos (CR 107.4) ----
// retorna {cor:[...], hib:[[a,b]...], fir:[cor...], dois:[cor...], g:n}
const simbolos = (custo, x = 0) => {
  const s = { cor: [] as any[], hib: [] as any[], fir: [] as any[], dois: [] as any[], g: (custo.g || 0) + Math.max(0, (custo.x || 0) * x - (custo.redX || 0)), neve: 0 };   // redX: redução que sobrou para o X (601.2f)
  for (const p of custo.p || []) {
    if (/^[WUBRGC]$/.test(p)) s.cor.push(p);
    else if (p === 'S') s.neve++;
    else if (/^[WUBRG]\/P$/.test(p)) s.fir.push(p[0]);                      // CR 107.4f: cor ou 2 vidas
    else if (/^2\/[WUBRG]$/.test(p)) s.dois.push(p[2]);                     // CR 107.4e: cor ou {2}
    else if (/^[WUBRGC]\/[WUBRG]$/.test(p)) s.hib.push([p[0], p[2]]);       // CR 107.4e híbrido
    else if (/^[WUBRG]\/[WUBRG]\/P$/.test(p)) s.hib.push([p[0], p[2], 'P']); // híbrido phyrexiano
    else if (p === '*') s.hib.push([...CORES]);                             // interno: mana de qualquer cor paga (609.4b; Drana and Linvala)
    else throw new Error('símbolo de mana desconhecido: ' + p);
  }
  return s;
};
M.simbolos = simbolos;
M.vmDe = custo => { const s = simbolos(custo); return s.g + s.cor.length + s.hib.length + s.fir.length + s.neve + 2 * s.dois.length; };
// a mana que pagar este custo gasta (com o X anunciado; o {2/W} conta 2 e o phyrexiano 1: antes de escolher vida)
M.manaDoCusto = (custo, x = 0) => { const s = simbolos(custo || {}, x); return s.g + s.cor.length + s.hib.length + s.fir.length + s.neve + 2 * s.dois.length; };

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
  if (extra.x) r.x = (r.x || 0) + extra.x * vezes;                  // chute {X} (Thieving Skydiver): o X entra no custo e é anunciado
  return r;
};
// base: um custo alternativo no lugar do custo de mana (loucura, CR 702.35b); imposto e reduções valem igual (601.2f)
M.custoComImposto = (e, o, base?) => {
  const c = { ...(base || M.dadoDe(e, o).custo || {}) };
  if (o.cmd && o.zona === 'comando') c.g = (c.g || 0) + 2 * (e.jogs[o.dono].imposto[o.id] || 0);
  return reduz(c, reducoes(e, o.dono, o, false));
};
// custo de mana de uma habilidade ativada (só a parte de mana) com as reduções deHabil (Sanctum of Tranquil Light, Otawara)
// a.reduz: "This ability costs {1} less to activate for each …" (Voldaren Estate, Otawara) — redução da própria habilidade
M.custoAtv = (e, o, a) => !a.custo.mana ? a.custo.mana : equipGratis(e, o, a) ? {} : comoQualquerCor(e, o, reduz({ ...a.custo.mana }, reducaoAtv(e, o, a, reducoes(e, o.ctrl, o, true))), a);
const reducaoAtv = (e, o, a, r) => { if (a.reduz !== undefined) r.g += Math.max(0, M.qtdEst(e, a.reduz, { voce: o.ctrl, este: o.id })); return r; };
// "you may spend blue mana as though it were mana of any color to pay the activation costs of this creature's abilities"
// (Quicksilver Elemental, CR 609.4b): cada símbolo de outra cor vira híbrido com a cor (R → R/U); incolor {C} e phyrexiano ficam
const comoQualquerCor = (e, o, c, a?) => {
  if (a && a._qualquerCor && c.p && c.p.length) {   // qualquer mana paga a cor (Drana and Linvala): símbolo colorido/híbrido vira genérico; {C} e phyrexiano ficam
    const fica = c.p.filter(p => !/^[WUBRG](\/[WUBRG])?$/.test(p));
    return { ...c, g: (c.g || 0) + c.p.length - fica.length, p: fica };
  }
  const s = (M.dadoDe(e, o).est || []).find(x => x.modo === 'manaComoQualquerCor' && x.afeta === 'este' && /^[WUBRG]$/.test(x.corMana || ''));
  if (!s || !c.p || !c.p.length) return c;
  return { ...c, p: c.p.map(p => /^[WUBRG]$/.test(p) && p !== s.corMana ? p + '/' + s.corMana : p) };
};
// Forge Anew: "you may pay {0} rather than pay the equip cost of the first equip ability you activate each of your turns"
const equipGratis = (e, o, a) => !!a._equipar && e.turno.ativo === o.ctrl && e.jogs[o.ctrl].equipT !== e.turno.n && M.estSeu(e, o.ctrl, 'primeiroEquiparGratis');
/** j controla uma permanente com a estática deste modo (sem filtro: Forge Anew) */
M.estSeu = (e, j, modo) => e.campo.some(id => { const F = e.objs[id]; return F.ctrl === j && (M.dadoDe(e, F).est || []).some(s => s.modo === modo); });

// ---- reduzCusto (CR 601.2f): depois dos aumentos (imposto), tira genérico; custo.p tira símbolos coloridos (Morophon).
// Fontes: as estáticas do campo (afeta filtro: a mágica que você conjura, ou o permanente dono da habilidade) e a da
// própria carta (afeta 'este', de 'mao' = só da mão: Ghalta, Otawara). O filtro com zona 'pilha' fala da mágica que
// está sendo conjurada (ainda na mão quando o custo é calculado). A redução de genérico que sobra abate do X (redX).
const RED_OK = new Set(['modo', 'afeta', 'de', 'qtd', 'custo', 'deHabil', 'se', 'minimo']);
M.estReduzOk = s => !!s && s.modo === 'reduzCusto' && Object.keys(s).every(k => RED_OK.has(k) || k.startsWith('_'))
  && (s.afeta === 'este' || (!!s.afeta && typeof s.afeta === 'object' && M.filtroOk(s.afeta)))
  && (s.de === undefined || s.de === 'mao' || s.de === 'cemiterio')   // cemiterio: só conjurada do cemitério (flashback de Visions of Glory)
  && (s.custo === undefined ? s.qtd !== undefined && M.qtdEstOk(s.qtd)
    : s.qtd === undefined && Object.keys(s.custo).every(k => k === 'p') && Array.isArray(s.custo.p))
  && (!s.se || M.seOk(s.se));
function reducoes(e, j, o, deHabil) {
  const r = { g: 0, p: [] as string[], min: 0 };
  const fontes = M.indiceCampo(e).est.map(id => e.objs[id]);
  if (o.zona !== 'campo' && M.dadoDe(e, o).est) fontes.push(o);
  for (const J of e.jogs) for (const id of J.zonas.comando || []) {   // eminência (Ur-Dragon): "as long as … in the command zone or on the battlefield"
    const C = e.objs[id]; if (C && C.id !== o.id && (M.dadoDe(e, C).est || []).some(s => s.modo === 'reduzCusto' && s.se && (s.se.esteEm || []).includes('comando'))) fontes.push(C);
  }
  if (!deHabil) for (const k of M.dadoDe(e, o).kw || []) if (k.k === 'afinidade' && k.tipo)   // CR 702.41: {1} a menos por [tipo] seu
    r.g += M.objetosQue(e, { tipo: [k.tipo], ctrl: 'voce', zona: 'campo' }, { voce: j, este: o.id }).length;
  for (const F of fontes) for (const s of M.dadoDe(e, F).est || []) {
    if (s.modo !== 'reduzCusto' || !!s.deHabil !== deHabil || !M.estReduzOk(s)) continue;
    const ctx = { voce: F.ctrl, este: F.id };
    if (s.afeta === 'este') { if (F.id !== o.id || (s.de && o.zona !== s.de)) continue; }
    else {
      if (F.zona !== 'campo' && !(s.se && (s.se.esteEm || []).includes(F.zona))) continue;   // a estática com filtro só vale do campo (ou de onde o esteEm diz)
      const { zona, ctrl, ...f } = s.afeta;
      if (ctrl && ctrl !== 'qualquer' && (ctrl === 'voce') !== (j === F.ctrl)) continue;
      if (deHabil ? zona && zona !== 'qualquer' && o.zona !== zona : zona && zona !== 'pilha') continue;
      if (!M.bate(e, o, f, ctx)) continue;
    }
    if (s.se) { let ok = false; try { ok = M.condicao(e, s.se, ctx); } catch (_) { ok = false; } if (!ok) continue; }
    if (s.custo) r.p.push(...s.custo.p); else r.g += Math.max(0, M.qtdEst(e, s.qtd, ctx));
    if (s.minimo) r.min = Math.max(r.min, s.minimo);   // "can't reduce the mana in that cost to less than one mana" (Forensic Gadgeteer)
  }
  return r;
}
function reduz(c, r) {
  // 601.2f: o X já entra no total antes das reduções — o que sobra da redução de genérico abate do X (c.redX, lido no
  // plano quando o X é escolhido). Com mínimo (Forensic Gadgeteer) não abate do X.
  if (r.g && c.x && !r.min && r.g > (c.g || 0)) c.redX = (c.redX || 0) + r.g - (c.g || 0);
  if (r.g && c.g) c.g = Math.max(r.min ? Math.min(c.g, r.min - (c.p || []).length) : 0, c.g - r.g);   // minimo: o total não fica abaixo (simplificação: vale para todas as reduções juntas)
  if (r.p.length && c.p && c.p.length) { const p = c.p.slice(); for (const x of r.p) { const i = p.indexOf(x); if (i >= 0) p.splice(i, 1); } c.p = p; }
  return c;
}

// ---- plano: quais fontes ativar para pagar um custo (a IA e a conjuração da T15 usam) ----
// Busca em profundidade: fontes menos flexíveis primeiro (Floresta antes de Command Tower), poda por quantidade.
// Retorna {passos:[{id,k,escolha}], resto, vida} ou null.
M.planoMana = (e, j, custo, { x = 0, vidaDisp = 0, limite = 4000, excluir = null, para = null }: any = {}) => {
  const R = M.reservaCom(e, j, para);                               // + a restrita que esta mágica pode gastar
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
  e.jogs[j].reserva = pg.resto; M.perderVida(e, j, pg.vida);
  return true;
};
