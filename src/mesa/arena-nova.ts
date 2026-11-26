// src/mesa/arena-nova.ts — T22 (Mesa ao vivo, beta): uma partida jogada pelo motor novo (src/motor) com as cartas do
// banco próprio (banco/cartas), devolvida no MESMO formato da arena() do motor velho (motor/mesa.js): {venc, fim,
// turno, ordem, P, log, quadros}. Assim a tela da Mesa ao vivo (src/mesa/mesa-ui.js) desenha as duas sem mudar.
// O que muda é o registro: cada efeito que resolve, cada gatilho que dispara e cada P/R que as camadas mexem vira
// um lance (tp 'efeito', 'gatilho', 'camada', 'habil'), lido do próprio estado (antes × depois), não do texto da carta.
// Carta fora do banco próprio entra pela reserva (só o corpo: tipo, custo, P/R; terreno dá mana das cores) e leva o
// selo ⓘ; carta do banco que o motor não joga inteira leva o selo com os motivos (motor-novo-cobertura.json, gerado
// por `node ferramentas/motor-cobertura.mjs --por-carta src/mesa/motor-novo-cobertura.json`).
// Você joga (cfg.humano): mesma conversa do motor velho (pergunta → resposta → continua); a sessão fica viva no
// Worker e continua de onde parou; desfazer ou outra partida refaz do zero com a mesma semente (dá o mesmo jogo).
import { M } from '../motor/index';
import { bancoProprio } from '../dados/cartas';
import COB from './motor-novo-cobertura.json';

const COBERTURA = COB as Record<string, string[]>;
const LAC_RESERVA = 'fora do banco próprio: o motor novo só joga o corpo (tipo, custo, P/R; terreno dá mana)';
const KW_NOME: Record<string, string> = {
  voar: 'voar', alcance: 'alcance', pressa: 'ímpeto', atropelar: 'atropelar', vigilancia: 'vigilância', vinculoVida: 'vínculo com a vida',
  toqueMortifero: 'toque mortífero', golpeDuplo: 'golpe duplo', primeiroAtaque: 'iniciativa', ameaca: 'ameaçar', antimagia: 'resistência a magia',
  manto: 'manto', indestrutivel: 'indestrutível', defensor: 'defensor', lampejo: 'lampejo', protecao: 'proteção',
};
const kwNome = (k: string) => KW_NOME[k] || k;
const EV_NOME: Record<string, string> = { entra: 'entrou', morre: 'morreu', sai: 'saiu', vaiCemiterio: 'foi ao cemitério', ataca: 'atacou',
  atacantesDeclarados: 'ataque', bloqueia: 'bloqueou', dano: 'causou dano', conjura: 'conjurou', fase: 'começo de etapa', compra: 'comprou',
  ganhaVida: 'ganhou vida', alvoDe: 'virou alvo' };

// ---------- cartas: banco próprio + reserva montada do modelo da página ----------
const TIPOS = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Instant', 'Sorcery', 'Battle', 'Kindred', 'Tribal'];
const SUPER = ['Legendary', 'Basic', 'Snow', 'World'];
function custoDe(txt: string) {
  const c: any = { g: 0, p: [] as string[] };
  for (const m of String(txt || '').split(' // ')[0].matchAll(/\{([^}]+)\}/g)) {
    const s = m[1];
    if (/^\d+$/.test(s)) c.g += +s; else if (s === 'X') c.x = (c.x || 0) + 1; else c.p.push(s);
  }
  if (!c.p.length) delete c.p;
  return c;
}
function reservaDe(m: any) {
  const tl = String(m.tl || '').split(' // ')[0], [esq, dir] = tl.split(/\s+—\s+/);
  const pal = (esq || '').split(/\s+/);
  const tipos = pal.filter(w => TIPOS.includes(w)), sup = pal.filter(w => SUPER.includes(w)), sub = (dir || '').split(/\s+/).filter(Boolean);
  const n = m.frente || m.nome, ci = m.ci || '';
  const c: any = { n, tipos: tipos.length ? tipos : ['Artifact'], ci, vm: m.cmc || 0, _reserva: true };
  if (sup.length) c.super = sup;
  if (sub.length) c.sub = sub;
  if (m.land) {
    const cor = String(m.cor || ''), prod = cor === 'WUBRG' ? 'qualquer' : cor ? cor.split('') : ['C'];
    c.atv = [{ custo: { virar: true }, deMana: true, fx: [{ op: 'mana', prod, qtd: 1 }] }];
    c.cores = '';
    return c;
  }
  c.custo = custoDe(m.custoTxt);
  c.cores = ['W', 'U', 'B', 'R', 'G'].filter(k => JSON.stringify(c.custo.p || []).includes(k)).join('');
  if (tipos.includes('Creature')) c.pt = [m.p || 0, m.t || 1];
  return c;
}

// ---------- a partida ----------
export function arenaNova(Ds: any[], seed: number, cfg: any = {}) {
  const S = novaSessao(Ds, seed, cfg);
  return S.rodar();
}

/** sessão: a partida e o registro; rodar() joga até o fim ou até a próxima pergunta do humano (throw raioxPergunta) */
export function novaSessao(Ds: any[], seed: number, cfg: any = {}) {
  const TMAX = cfg.T || 20, VIDA = cfg.vida || 40, NOM: string[] = cfg.nomes || Ds.map((_, k) => (k ? 'Oponente ' + k : 'Você'));
  const HU = cfg.humano || null, HK = HU ? HU.k : -1;
  const banco: any = bancoProprio();
  // nome no motor de cada carta do modelo (frente para dupla face/split) e o índice de volta (para a tela)
  const db: any = { ...banco };
  const chave = (m: any) => (banco[m.nome] ? m.nome : banco[m.frente] ? m.frente : (m.frente || m.nome));
  const idx: Map<string, number>[] = [];
  const lacs: (string[] | null)[][] = Ds.map((D, k) => {
    const mp = new Map<string, number>(); idx[k] = mp;
    return D.M.map((m: any, i: number) => {
      const n = chave(m);
      if (!mp.has(n)) mp.set(n, i);
      if (!db[n]) db[n] = reservaDe(m);
      if (db[n]._reserva) return [LAC_RESERVA];
      return COBERTURA[n] ? COBERTURA[n].map(x => 'motor novo não lê: ' + x) : null;
    });
  });
  M.usarCartas(db);
  const decks = Ds.map((D, k) => {
    const ci = D.cmd ? D.cmd.i : -1;
    return { nome: NOM[k], comandante: ci >= 0 ? [chave(D.M[ci])] : [], cartas: D.base.filter((i: number) => i !== ci).map((i: number) => chave(D.M[i])) };
  });
  const n = Ds.length;
  const e: any = M.novoJogo(decks, { semente: seed >>> 0, maxTurnos: TMAX * n + n, log: true });
  for (const J of e.jogs) J.vida = VIDA;
  const ag = M.agenteBasico();
  const log: any[] = [], quadros: any[] = [];
  let rodada = 0, ultAtivo = -1, ultTurno = -1, venc = -1, fimTipo = 'mesa';
  const iDe = (o: any) => (!o || o.ficha ? -1 : idx[o.dono] && idx[o.dono].has(o.n) ? idx[o.dono].get(o.n)! : -1);
  const nomeJ = (j: number) => NOM[j] || 'J' + (j + 1);

  // ---------- foto do estado (o quadro que a tela desenha) ----------
  let piDe = new Map<number, number>();
  function foto(k: number) {
    const ps = e.jogs.map((J: any, j: number) => {
      const meus = e.campo.map((id: number) => e.objs[id]).filter((o: any) => o.ctrl === j);
      const terras = meus.filter((o: any) => M.temTipo(e, o, 'Land') && !M.temTipo(e, o, 'Creature'));
      const anexoVis = (o: any) => { const t = M.anexadoA(e, o); return t && t.ctrl === o.ctrl && M.temTipo(e, t, 'Creature') ? t : null; };
      const perm: any[] = [];
      for (const o of meus) {
        if (terras.includes(o) || anexoVis(o)) continue;
        const d = M.dadoDe(e, o), cri = M.temTipo(e, o, 'Creature');
        const x: any = { pi: perm.length, n: o.n, p: cri ? M.poder(e, o) : null, t: cri ? M.resistencia(e, o) : null, c: o.cmd ? 1 : 0, tok: o.ficha ? 1 : 0,
          tap: o.virada ? 1 : 0, atk: M.atacando(e, o) ? 1 : 0, i: o.dono === j ? iDe(o) : -1 };
        if (cri && d.pt) {
          const b = M.camadas(e, o); x.bp = b.p; x.bt = b.r;
          if (o.marc['+1/+1']) x.ct = o.marc['+1/+1'];   // marcador fica à parte do bônus (Edigar 26/11: lorde +1/+1 ≠ marcador +1/+1)
          if (o.marc['-1/-1']) x.cm = o.marc['-1/-1'];
          if (b.kw.length) x.kw = [...new Set(b.kw.map((y: any) => kwNome(y.k)))];
        }
        const an = M.anexosDe(e, o);
        if (an.length) x.an = an.map((a: any) => ({ n: a.n, i: iDe(a), de: a.ctrl !== j ? a.ctrl : undefined }));
        if ((d.sub || []).includes('Equipment') && !M.anexadoA(e, o)) x.solto = 1;
        if (j === HK) piDe.set(o.id, x.pi);
        perm.push(x);
      }
      const cmdD = e.jogs.map((_: any, i: number) => Object.entries(J.danoCmd).filter(([id]) => e.objs[id] && e.objs[id].dono === i).reduce((s, [, v]: any) => s + v, 0));
      return {
        vida: J.vida, vivo: !J.saiu, terr: terras.length, tes: 0, mao: J.zonas.mao.map((id: number) => iDe(e.objs[id])), lib: J.zonas.grimorio.length,
        zona: J.cmd.some((id: number) => e.objs[id] && e.objs[id].zona === 'comando'), tax: J.cmd.reduce((s: number, id: number) => s + 2 * (J.imposto[id] || 0), 0), cmdD,
        perm, tl: terras.map((o: any) => ({ i: iDe(o), tap: o.virada ? 1 : 0 })), gy: J.zonas.cemiterio.length, ex: J.zonas.exilio.length, gyL: J.zonas.cemiterio.slice(-12).map((id: number) => iDe(e.objs[id])),
      };
    });
    quadros.push({ t: rodada, k, log: log.length, j: ps });
  }
  // lance igual ao anterior (mesmo turno, jogador e texto) vira uma linha só com (×N), como no motor velho
  function diz(k: number, tp: string, txt: string, c?: number, alvo?: number) {
    const u = log[log.length - 1];
    if (u && u.t === rodada && u.k === k && u.base === txt) {
      u.n = (u.n || 1) + 1; u.txt = `${txt} (×${u.n})`;
      if (quadros.length && quadros[quadros.length - 1].log === log.length) { quadros.pop(); foto(k); }
      return;
    }
    log.push({ t: rodada, k, tp, txt, base: txt, c: c ?? -1, a: alvo ?? -1 });
    foto(k);
  }

  // ---------- o que mudou (antes × depois): é daqui que sai o registro dos efeitos e das camadas ----------
  function snap() {
    const o: any = { vida: e.jogs.map((J: any) => J.vida), mao: e.jogs.map((J: any) => J.zonas.mao.length), veneno: e.jogs.map((J: any) => J.veneno), z: new Map(), campo: new Map() };
    for (const id in e.objs) { const x = e.objs[id]; if (!x.hab) o.z.set(+id, x.zona + '|' + x.ts); }
    for (const id of e.campo) {
      const x = e.objs[id], cri = M.temTipo(e, x, 'Creature');
      o.campo.set(id, { ts: x.ts, n: x.n, ctrl: x.ctrl, dano: x.dano, marc: JSON.stringify(x.marc), m: x.marc, p: cri ? M.poder(e, x) : null, r: cri ? M.resistencia(e, x) : null,
        kw: cri ? M.kwDe(e, x).map((y: any) => y.k).join(',') : '', anexo: x.anexo ? x.anexo.id + '|' + x.anexo.ts : '' });
    }
    return o;
  }
  // fatos: {k: jogador a quem o fato pertence, tp, txt, c: índice da carta (imagem no centro), a: jogador alvo}
  function fatos(A: any, B: any) {
    const r: any[] = [];
    e.jogs.forEach((J: any, j: number) => {
      const dv = B.vida[j] - A.vida[j];
      if (dv) r.push({ k: j, tp: 'dano', txt: `${nomeJ(j)} ${dv < 0 ? 'perde ' + -dv : 'ganha ' + dv} de vida (${B.vida[j]})`, a: j });
      if (B.veneno[j] > A.veneno[j]) r.push({ k: j, tp: 'dano', txt: `${nomeJ(j)} recebe ${B.veneno[j] - A.veneno[j]} veneno`, a: j });
    });
    // mudanças de zona (objeto novo = id com ts novo; fichas nascem com id novo)
    const entram = new Map<string, { k: number; n: number; c: number; tok: boolean; nome: string; terra: boolean }>();
    const compras = new Map<number, number>();
    for (const [id, zt] of B.z) {
      const antes = A.z.get(id), x = e.objs[id];
      if (antes === zt) continue;
      const de = antes ? antes.split('|')[0] : null, para = zt.split('|')[0];
      if (para === 'pilha' || de === 'pilha' && para !== 'campo' && para !== 'exilio') continue;   // conjurar e resolver mágica: o 'conjura' já diz
      if (para === 'mao' && de === 'grimorio') { compras.set(x.dono, (compras.get(x.dono) || 0) + 1); continue; }
      if (para === 'campo') {
        const terra = de === 'mao' && M.temTipo(e, x, 'Land') && !resolvendo;           // jogar terreno (CR 305): não é efeito
        const ch = x.ctrl + '|' + x.n + '|' + (de || 'novo'), g = entram.get(ch) || { k: x.ctrl, n: 0, c: iDe(x), tok: !!x.ficha, nome: x.n, terra };
        g.n++; entram.set(ch, g); continue;
      }
      if (de === 'campo') {
        const cri = A.campo.get(id) && A.campo.get(id).p != null;
        const verbo = para === 'cemiterio' ? (cri ? 'morre' : 'vai ao cemitério') : para === 'exilio' ? 'é exilado' : para === 'mao' ? 'volta à mão' : para === 'grimorio' ? 'volta ao grimório' : para === 'comando' ? 'volta ao comando' : 'sai';
        r.push({ k: x.ctrl, tp: para === 'cemiterio' && cri ? 'morte' : 'remo', txt: `${x.n} ${verbo}`, c: iDe(x), a: x.ctrl });
        continue;
      }
      if (de === 'grimorio' && para === 'cemiterio') continue;                      // moer: conta abaixo
      if (para === 'comando' && de) r.push({ k: x.dono, tp: 'efeito', txt: `${x.n} volta à zona de comando`, c: iDe(x) });
      else if (de === 'mao' && para === 'cemiterio') r.push({ k: x.dono, tp: 'efeito', txt: `${nomeJ(x.dono)} descarta ${x.n}`, c: iDe(x) });
      else if (de === 'cemiterio' && para === 'mao') r.push({ k: x.dono, tp: 'tutor', txt: `${x.n} volta do cemitério para a mão`, c: iDe(x) });
      else if (de === 'grimorio' && para === 'exilio') r.push({ k: x.dono, tp: 'efeito', txt: `${x.n} é exilado do grimório`, c: iDe(x) });
    }
    for (const [, g] of entram) r.push(g.terra ? { k: g.k, tp: 'terreno', txt: `${nomeJ(g.k)} baixa ${g.nome}`, c: g.c }
      : { k: g.k, tp: g.tok ? 'efeito' : 'magia', txt: g.tok ? `${nomeJ(g.k)} cria ${g.n > 1 ? g.n + ' fichas' : 'a ficha'} ${g.nome}` : `${g.nome} entra no campo${g.n > 1 ? ' (×' + g.n + ')' : ''}`, c: g.c });
    if (rodada > 0) for (const [j, q] of compras) r.push({ k: j, tp: 'compra', txt: `${nomeJ(j)} compra ${q}` });
    // no campo: dano, marcadores, P/R e palavras-chave (camadas), anexos
    for (const [id, b] of B.campo) {
      const a = A.campo.get(id), x = e.objs[id];
      if (!a || a.ts !== b.ts) continue;
      if (b.dano > a.dano) r.push({ k: b.ctrl, tp: 'dano', txt: `${b.n} leva ${b.dano - a.dano} de dano`, c: iDe(x), a: b.ctrl });
      if (b.marc !== a.marc) for (const t of new Set([...Object.keys(a.m), ...Object.keys(b.m)])) {
        const d = (b.m[t] || 0) - (a.m[t] || 0);
        if (d && t !== 'lealdade') r.push({ k: b.ctrl, tp: 'efeito', txt: `${b.n}: ${d > 0 ? '+' : ''}${d} marcador${Math.abs(d) > 1 ? 'es' : ''} ${t}`, c: iDe(x) });
        else if (d && t === 'lealdade') r.push({ k: b.ctrl, tp: 'efeito', txt: `${b.n}: lealdade ${d > 0 ? '+' : ''}${d} (${b.m[t]})`, c: iDe(x) });
      }
      if (b.anexo !== a.anexo && b.anexo) { const t = M.anexadoA(e, x); if (t) r.push({ k: b.ctrl, tp: 'camada', txt: `${b.n} fica preso a ${t.n}`, c: iDe(x) }); }
      else if (b.anexo !== a.anexo) r.push({ k: b.ctrl, tp: 'camada', txt: `${b.n} fica solto`, c: iDe(x) });
      const mudouPR = b.p != null && a.p != null && (b.p !== a.p || b.r !== a.r);
      const ganhou = b.kw.split(',').filter((k: string) => k && !a.kw.split(',').includes(k)), perdeu = a.kw.split(',').filter((k: string) => k && !b.kw.split(',').includes(k));
      if (mudouPR || ganhou.length || perdeu.length) {
        const ps: string[] = [];
        if (mudouPR) ps.push(`${a.p}/${a.r} → ${b.p}/${b.r}`);
        if (ganhou.length) ps.push('ganha ' + ganhou.map(kwNome).join(', '));
        if (perdeu.length) ps.push('perde ' + perdeu.map(kwNome).join(', '));
        r.push({ k: b.ctrl, tp: 'camada', txt: `${b.n}: ${ps.join('; ')}`, c: iDe(x) });
      }
    }
    return r;
  }
  let ult: any = null;
  // vira lances tudo o que mudou desde a última vez (ABE, compras, estáticas que entraram/saíram)
  function despeja() {
    if (e.turno.n !== ultTurno && e.turno.passo !== 'mulligan') {
      const pos = (e.turno.ativo - e.turno.primeiro + n) % n;               // rodada = volta na mesa a partir de quem começou
      if (pos <= ultAtivo || ultAtivo < 0) rodada++;
      ultAtivo = pos; ultTurno = e.turno.n;
      diz(e.turno.ativo, 'turno', `Turno ${rodada} de ${nomeJ(e.turno.ativo)}`);
    }
    const B = snap();
    if (ult) for (const f of fatos(ult, B)) diz(f.k, f.tp, f.txt, f.c, f.a);
    ult = B;
  }

  // ---------- ganchos no motor: o log de texto (conjura, ativa, gatilho, combate) e cada efeito que resolve ----------
  const idxJog = (nm: string) => e.jogs.findIndex((J: any) => J.nome === nm);
  const nomeObj = (nm: string, j: number) => { const k = idx[j] && idx[j].get(nm); return k === undefined ? -1 : k; };
  function lance(p: any[]) {
    const [a0, verbo, a2] = p, j = idxJog(String(a0));
    if (a0 === 'dano de combate:') { despeja(); return; }                    // a vida e o dano saem do antes × depois
    const txt = p.filter(x => x !== '' && x != null).join(' ').replace(/\s+/g, ' ').trim();
    switch (verbo) {
      case 'conjura': {
        despeja();
        const alvoJ = (() => { const m = txt.match(/→ (.+)$/); if (!m) return -1; const t = m[1].split(', '); const jj = t.map(idxJog).find(x => x >= 0); return jj ?? -1; })();
        diz(j, e.pilha.length > 1 || e.turno.ativo !== j ? 'resp' : 'magia', txt, nomeObj(String(a2), j), alvoJ);
        return;
      }
      case 'ativa': despeja(); diz(j, 'habil', txt, nomeObj(String(a2), j)); return;
      case 'gatilho de': despeja(); diz(j, 'gatilho', `${nomeJ(j)}: gatilho de ${a2} (${EV_NOME[String(p[3] || '').replace(/[()]/g, '')] || p[3]})`, nomeObj(String(a2), j)); return;
      case 'ataca com': {
        despeja();
        const alvos = String(a2).split(', ').map(s => idxJog(s.split('→')[1]));
        diz(j, 'ataque', txt, -1, alvos.find(x => x >= 0) ?? -1); return;
      }
      case 'bloqueia:': despeja(); diz(j, 'bloqueio', txt); return;
      case 'sai do jogo:': despeja(); diz(j, 'morte', `${nomeJ(j)} sai do jogo (${a2})`); return;
      case 'põe no campo': if (!resolvendo) despeja(); return;           // terreno jogado ou permanente que resolveu
      default:
        if (String(p[1]).startsWith('não resolve')) { despeja(); diz(e.turno.ativo, 'efeito', txt); }
    }
  }
  let resolvendo = 0;
  const logVelho = M.log, execVelho = M.executar;
  const gancho = () => {
    M.log = (ee: any, ...p: any[]) => { if (ee === e) lance(p); };
    M.executar = (ee: any, f: any, ctx: any, ask: any) => {
      if (ee !== e) return execVelho(ee, f, ctx, ask);
      despeja();
      resolvendo++;
      let ok = false;
      try { const r = execVelho(ee, f, ctx, ask); ok = true; return r; }
      finally {
        resolvendo--;
        if (ok) {
          const B = snap(), fs = fatos(ult, B); ult = B;
          if (fs.length) {
            const it = e.objs[ctx.item], fonte = it ? it.n : ctx.lki && ctx.lki.este ? ctx.lki.este.n : '';
            const j = it ? it.ctrl : ctx.voce, ci = it && !it.hab ? iDe(it) : nomeObj(fonte, j);
            // um lance por efeito: "Lightning Bolt: Grizzly Bears leva 3 de dano; Grizzly Bears morre"
            const tp = fs.some(x => x.tp === 'morte') ? 'remo' : fs.every(x => x.tp === 'camada') ? 'camada' : fs.every(x => x.tp === 'compra') ? 'compra' : 'efeito';
            const semFonte = (t: string) => fonte && t.startsWith(fonte + ': ') ? t.slice(fonte.length + 2) : t;   // "Elenda: 1/1 → 2/2", não "Elenda: Elenda: …"
            diz(j, tp, `${fonte}: ${fs.map(x => semFonte(x.txt)).join('; ')}`, ci, fs.find(x => x.a >= 0 && x.a !== j)?.a ?? -1);
          }
        }
      }
    };
  };
  const solta = () => { M.log = logVelho; M.executar = execVelho; };

  // ---------- o humano (k = HK): a mesma conversa do motor velho ----------
  let esc: any[] = HU ? (HU.esc || []).slice() : [], HI = 0, HD = HU ? HU.desde || 0 : 0, fotoPendente = false;
  let planoAtk: any = null;
  function pede(tipo: string, info: any) {
    if (!fotoPendente) foto(HK); fotoPendente = false;
    if (HI < esc.length) return esc[HI++];
    const q: any = { tipo, n: HI, t: rodada, ...info, quadro: quadros[quadros.length - 1], nq: quadros.length, lacs };
    q.passos = quadros.slice(HD, -1).map(Q => ({ Q, ev: log[Q.log - 1] || null }));
    q.log = log.slice(-40);
    fotoPendente = true;
    const er: any = new Error('pergunta'); er.raioxPergunta = q; throw er;
  }
  const nomeOp = (o: any) => (o ? o.n : '?');
  function rotulo(p: any, op: any) {
    const ob = op.id !== undefined ? e.objs[op.id] : null;
    switch (op.a) {
      case 'alvo': return op.jog !== undefined ? nomeJ(op.jog) : `${nomeOp(e.objs[op.o])} (${nomeJ(e.objs[op.o].ctrl)})`;
      case 'pronto': return 'Pronto';
      case 'sim': return 'Sim'; case 'nao': return 'Não';
      case 'modo': { const fx = p.ctx && p.ctx.modos ? p.ctx.modos[op.m] : null, oq = fx ? [...new Set((Array.isArray(fx) ? fx : fx.fx || [fx]).map((x: any) => x && x.op).filter(Boolean))].join(', ') : ''; return 'Modo ' + (op.m + 1) + (oq ? ' — ' + oq : ''); }
      case 'x': return 'X = ' + op.v;
      case 'nenhum': return 'Nenhum';
      case 'cor': return { W: 'Branco', U: 'Azul', B: 'Preto', R: 'Vermelho', G: 'Verde' }[op.v as string] || op.v;
      case 'tipo': return op.v;
      case 'topo': return `${nomeOp(ob)}: fica no topo`; case 'fundo': return `${nomeOp(ob)}: vai para o fundo`;
      case 'gatilho': return 'Gatilho de ' + (ob ? ob.n : ((e.pend || [])[op.i] || {}).n || '?');   // sala de masmorra/iniciativa: sem objeto, o nome está no pendente
      case 'bloquear': return `Bloquear ${nomeOp(e.objs[op.atk])} com ${nomeOp(ob)}`;
      case 'desfazer': return 'Desfazer bloqueios';
      case 'fica': return `Manter esta ${nomeOp(ob)} (a outra vai para o cemitério)`;
      case 'comando': return 'Mandar de volta para a zona de comando (pode lançar de novo)';
      case 'ficar': { const z = p.ctx && e.objs[p.ctx.id] ? e.objs[p.ctx.id].zona : ''; return z === 'exilio' ? 'Deixar no exílio' : 'Deixar no cemitério'; }
      case 'marcadores': return `${op.q} marcadores nela`; case 'fichas': return `${op.q} Servos 1/1`;
      case 'pagar': return 'Pagar a vida'; case 'naoPagar': return 'Não pagar (entra virado)'; case 'revelar': return 'Revelar ' + nomeOp(e.objs[op.rid]);
      case 'proliferar': return op.jog !== undefined ? nomeJ(op.jog) : nomeOp(ob);
      case 'todos': return 'Todas as criaturas → ' + (op.jog !== undefined ? nomeJ(op.jog) : nomeOp(e.objs[op.o]));
      case 'atacar': return `${nomeOp(ob)} → ${op.jog !== undefined ? nomeJ(op.jog) : nomeOp(e.objs[op.o])}`;
      case 'masmorra': return `Entrar em ${op.nome} (o marcador vai para a 1ª sala e ela acontece)`;
      case 'sala': return `Ir para a sala ${op.n} (o efeito dela acontece)`;
      case 'perder': return `Perder ${op.q} de vida`;
      case 'virar': return `Virar ${nomeOp(ob)} (custo)`;
      case 'descartar': case 'sacrificar': if (p.tipo === 'evitarPerda') return `${op.a === 'descartar' ? 'Descartar' : 'Sacrificar'} ${nomeOp(ob)} (e não perde vida)`; return `${op.a === 'descartar' ? 'Descartar' : 'Sacrificar'} ${nomeOp(ob)}`;
      case 'devolver': return `Devolver ${nomeOp(ob)} para a mão (custo)`;
      case 'custo': return p.ctx && p.ctx.o === 'exilar' ? `Exilar ${nomeOp(ob)} do cemitério` : nomeOp(ob);
      case 'atacado': return op.jog !== undefined ? nomeJ(op.jog) : `${nomeOp(e.objs[op.o])} (${nomeJ(e.objs[op.o].ctrl)})`;
      case 'jogador': return nomeJ(op.jog);
      case 'jogar': return `Conjurar ${nomeOp(ob)}${p.ctx && p.ctx.gratis ? ' de graça' : ''}`;
      case 'mao': return `Pôr ${nomeOp(ob)} na mão`;
      case 'primeiro': return `${nomeOp(ob)} recebe o dano primeiro`;
      case 'dividir': return String(op.v);
      case 'opcao': { const v = op.v || {}; const l = [v.chute ? 'com chute (paga o custo extra)' : '', v.presente ? 'com presente para um oponente' : ''].filter(Boolean); return l.length ? 'Conjurar ' + l.join(' e ') : 'Conjurar normal'; }
      case 'custoOu': { const c = op.v || {}, l: string[] = [];
        if (c.sacrificar) l.push(c.sacrificar === 'este' ? 'sacrificar esta' : `sacrificar ${c.sacrificar.qtd || 1} ${((c.sacrificar.f || {}).tipo || ['permanente']).map((t: string) => TIPO_PT[t] || t).join(' ou ')}`);
        if (c.descartar) l.push(`descartar ${c.descartar} carta${c.descartar > 1 ? 's' : ''}`);
        if (c.vida) l.push(`pagar ${c.vida} de vida`);
        if (c.mana) l.push('pagar ' + ((c.mana.g ? `{${c.mana.g}}` : '') + (c.mana.p || []).map((x: string) => `{${x}}`).join('') || 'mana'));
        if (c.devolver) l.push('devolver um permanente para a mão');
        if (c.exilarEste) l.push('exilar esta');
        return l.length ? l.join(' e ').replace(/^./, (x: string) => x.toUpperCase()) : 'Outro custo'; }
      default: return ob ? `${op.a}: ${ob.n}` : op.a;
    }
  }
  const TIPO_PT: Record<string, string> = { Creature: 'criatura', Artifact: 'artefato', Land: 'terreno', Enchantment: 'encantamento', Planeswalker: 'planeswalker', permanente: 'permanente' };
  const TITULO: Record<string, string> = { alvo: 'Escolha o alvo', modo: 'Escolha o modo', x: 'Quanto vale X?', talvez: 'Quer usar?', custo: 'Pague o custo',
    ordemGatilho: 'Estes gatilhos dispararam juntos, pelo mesmo evento (CR 603.3b). Escolha qual vai para a pilha primeiro: ele resolve por ÚLTIMO.', bloquear: 'Bloqueio: quem bloqueia quem?', ordemDano: 'Ordem do dano', videncia: 'Vidência',
    buscar: 'Busca no grimório', escolherCarta: 'Escolha a carta', destino: 'Para onde vai?', sacrificar: 'Escolha o que sacrificar', lenda: 'Regra da lenda: qual fica?',
    cmdZona: 'Seu comandante saiu do campo. Para onde ele vai?', aMenosQue: 'Como entra?', aMenosQuePagar: 'Pagar para impedir?', escolha: 'Escolha', fabricar: 'Fabricar', proliferar: 'Proliferar: escolha',
    masmorra: 'Aventurar: em qual masmorra entrar?', sala: 'Aventurar: para qual sala seguir?', evitarPerda: 'Perder vida ou pagar para não perder?',
    atacado: 'Ela entra atacando: quem ela ataca?', custoOu: 'Qual custo adicional você paga?', dividir: 'Dividir: quanto vai para este alvo?', presente: 'Presente: para qual oponente?',
    jogar: 'Pode conjurar uma destas agora', opcao: 'Como vai conjurar?', cavar: 'Escolha a carta' };
  function humano(p: any) {
    const J = e.jogs[HK], opIdx = (pred: (o: any) => boolean) => p.ops.findIndex(pred);
    const mao = () => J.zonas.mao.map((id: number) => ({ v: iDe(e.objs[id]), n: e.objs[id].n }));
    switch (p.tipo) {
      case 'mulligan': return pede('mulligan', { nm: J.mulls }) === 1 ? 1 : 0;
      case 'fundo': case 'descartar': {
        const r = pede(p.tipo === 'fundo' ? 'fundo' : 'descarte', { falta: p.ctx && p.ctx.faltam || 1, ops: mao(), mao: mao() });
        const k = opIdx(o => iDe(e.objs[o.id]) === r); return k >= 0 ? k : 0;
      }
      case 'acao': {
        const passar = opIdx(o => o.a === 'passar');
        const minha = e.turno.ativo === HK && (e.turno.passo === 'principal1' || e.turno.passo === 'principal2') && !e.pilha.length;
        const responde = e.pilha.some((id: number) => e.objs[id].ctrl !== HK);
        // Felipe 26/11: a Mesa indica, não limita. Fora da fase principal ela para sempre que você tem algo para usar
        // (instantânea, habilidade, lampejo: CR 117.1a) ou para responder; só passa sozinha quando o único lance é mana.
        const temLance = p.ops.some((o: any) => o.a !== 'passar' && o.a !== 'mana' && o.a !== 'manaEsc');
        if (!minha && !responde && !temLance && !M.somaMana(J.reserva)) return passar;
        const ops: any[] = [];
        // gerar mana a qualquer momento em que você tem prioridade (CR 605.3a), mesmo sem nada para pagar: vira o
        // terreno/artefato e a mana fica na reserva até o fim da etapa (106.4)
        const fontes = M.fontesDeMana(e, HK);
        p.ops.forEach((o: any, k: number) => {
          if (o.a !== 'mana') return;
          const ob = e.objs[o.id], f = fontes.find((x: any) => x.id === o.id && x.k === o.k), pac = f && f.pacotes[o.escolha];
          const sac = f && f.sac ? ' (sacrifica)' : '';
          ops.push({ v: 'mn' + k, n: `${ob.n}${sac} → ${pac ? M.fmtMana(pac).replace(/[WUBRGC]/g, '{$&}') : 'mana'}`, k, a: 'mana' });
        });
        // mana com escolha no custo (altar, Krark-Clan, Steam-Kin, Simian Spirit Guide): o custo é perguntado depois
        p.ops.forEach((o: any, k: number) => {
          if (o.a !== 'manaEsc') return;
          const ob = e.objs[o.id], a = M.atvDe(e, ob)[o.k], c = a.custo, pac = (M.pacotesDe(e, ob, a) || []).filter((x: any) => M.somaMana(x) > 0)[o.escolha];
          const cu = c.sacrificar && c.sacrificar !== 'este' ? ' (sacrifica uma)' : c.tirarMarcador ? ` (tira ${c.tirarMarcador.qtd || 1} marcadores)` : c.exilarEste ? ' (exila da mão)' : '';
          ops.push({ v: 'me' + k, n: `${ob.n}${cu} → ${pac ? M.fmtMana(pac).replace(/[WUBRGC]/g, '{$&}') : 'mana'}`, k, a: 'mana' });
        });
        p.ops.forEach((o: any, k: number) => {
          if (o.a === 'passar' || o.a === 'mana' || o.a === 'manaEsc') return;
          const ob = e.objs[o.id], i = iDe(ob);
          if (ob.zona === 'mao' && o.face === undefined && i >= 0 && ops.some(x => x.v === i && x.a === o.a)) return;   // outra cópia da mesma carta

          if (o.a === 'terreno' && o.face === undefined && ob.zona === 'mao' && !ops.some(x => x.v === i)) ops.push({ v: i, n: ob.n, k, a: o.a });
          else if (o.a === 'conjurar' && ob.cmd && ob.zona === 'comando' && !ops.some(x => x.v === 'cmd')) ops.push({ v: 'cmd', n: ob.n, k });
          else if (o.a === 'conjurar' && ob.zona === 'mao' && o.face === undefined && !ops.some(x => x.v === i)) ops.push({ v: i, n: ob.n, k, a: o.a, lac: !!(lacs[HK][i] && lacs[HK][i]!.length) });
          else ops.push({ v: 'eq' + k, n: o.a === 'ativar' ? `Ativar ${ob.n}` : o.a === 'terreno' ? `Baixar ${ob.n} (outra face)` : `Conjurar ${ob.n}${o.face != null ? ' (outra face)' : ob.zona !== 'mao' ? ' (' + ob.zona + ')' : ''}`, k });
        });
        const mana = M.somaMana(J.reserva) + M.fontesDeMana(e, HK).length;
        const r = pede('lanca', { ops, mao: mao(), mana, resp: !minha, reserva: M.somaMana(J.reserva) ? M.fmtMana(J.reserva) : '', passo: e.turno.passo });
        if (r === -1) return passar;
        const x = ops.find(o => o.v === r);
        return x ? x.k : passar;
      }
      case 'atacar': {
        if (!planoAtk || planoAtk.t !== e.turno.n) {
          const alvos = [...new Set(p.ops.filter((o: any) => o.jog !== undefined).map((o: any) => o.jog))].map((j: any) => ({ v: j, n: nomeJ(j), vida: e.jogs[j].vida }));
          const cri = [...new Set(p.ops.filter((o: any) => o.a === 'atacar').map((o: any) => o.id))].map((id: any) => ({ v: id, pi: piDe.get(id) ?? -1, n: e.objs[id].n }));
          if (!alvos.length || !cri.length) { const k = opIdx(o => o.a === 'pronto'); return k >= 0 ? k : 0; }
          const r = pede('ataque', { alvos, ops: cri });
          planoAtk = { t: e.turno.n, alvo: r.alvo, at: new Set(r.at || []) };
        }
        const k = opIdx(o => o.a === 'atacar' && planoAtk.at.has(o.id) && o.jog === planoAtk.alvo);
        if (k >= 0) { planoAtk.at.delete(p.ops[k].id); return k; }
        const pr = opIdx(o => o.a === 'pronto'); if (pr >= 0) return pr;
        const f = opIdx(o => o.a === 'atacar' && o.jog === planoAtk.alvo); return f >= 0 ? f : 0;   // 508.1d: tem que atacar
      }
      default: {
        const idDe = p.ctx ? (p.ctx.de !== undefined ? p.ctx.de : p.tipo === 'cmdZona' ? p.ctx.id : undefined) : undefined;
        const de = idDe !== undefined && e.objs[idDe] ? ' · ' + e.objs[idDe].n : '';
        const sub = p.tipo === 'talvez' && p.ctx && p.ctx.op === 'subst' && e.objs[p.ctx.id] && e.objs[p.ctx.fonte]
          ? `${e.objs[p.ctx.fonte].n}: pôr ${e.objs[p.ctx.id].n} ${({ grimorio: "no topo do grimório", exilio: "no exílio", mao: "na mão" } as any)[p.ctx.para] || p.ctx.para} em vez do cemitério?` : '';   // substituição opcional (Library of Leng)
        const r = pede('escolha', { x: { n: sub || (TITULO[p.tipo] || p.tipo) + de }, ops: p.ops.map((o: any, k: number) => ({ v: k, n: rotulo(p, o), sec: o.a === 'ficar' || o.a === 'nao' })) });
        return typeof r === 'number' && r >= 0 && r < p.ops.length ? r : 0;
      }
    }
  }

  // ---------- laço ----------
  let comecou = false;
  function rodar() {
    gancho();
    try {
      if (!comecou) { comecou = true; foto(-1); M.avancar(e); despeja(); }
      while (e.perg && !e.fim) {
        despeja();
        if (rodada > TMAX) break;
        const p = e.perg;
        const k = p.j === HK ? humano(p) : ag(e, p);
        M.responder(e, k);
      }
      despeja();
    } finally { solta(); }
    if (e.fim && e.fim.vencedor != null) venc = e.fim.vencedor;
    else {
      const v = e.jogs.filter((J: any) => !J.saiu).sort((a: any, b: any) => b.vida - a.vida);
      venc = v.length ? v[0].i : -1; fimTipo = 'tempo';
    }
    diz(venc, 'fim', fimTipo === 'tempo' ? `Acabou o tempo (${TMAX} rodadas): ${nomeJ(venc)} na frente` : `${nomeJ(venc)} vence a mesa na rodada ${rodada}`);
    const ordem: number[] = []; for (let i = 0; i < n; i++) ordem.push((e.turno.primeiro + i) % n);
    return { venc, fim: fimTipo, turno: rodada, ordem, P: e.jogs.map((J: any) => ({ vivo: !J.saiu, causa: J.saiu || null, vida: J.vida, st: {} })), log, quadros, lacs, motor: 'novo' };
  }
  /** continua com mais respostas (a mesma lista, maior); devolve false se não é continuação (aí refaz do zero) */
  function continua(novas: any[], desde: number) {
    if (novas.length < HI || novas.slice(0, HI).some((v, i) => JSON.stringify(v) !== JSON.stringify(esc[i]))) return false;
    esc = novas.slice(); HD = desde || 0;
    return true;
  }
  return { rodar, continua };
}
