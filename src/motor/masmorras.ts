// src/motor/masmorras.ts — o deck de masmorras (Safana do Edigar): infectar e veneno (CR 702.90, 704.5c), masmorras e
// aventurar (CR 309, 701.49), iniciativa (CR 727; o pedido chamava de 725, que no cr.txt de hoje é "Ending Turns").
// Arquivo próprio para mexer o mínimo em estado.ts/efeitos.ts: os outros módulos chamam as funções daqui pelo M.
import { M } from './nucleo';

// ---------- infectar (702.90) e marcadores no jogador (122.1) ----------
// Dano de fonte com infectar: em jogador vira veneno em vez de perda de vida (702.90b); em criatura vira marcadores
// −1/−1 em vez de dano marcado (702.90c, em M.danoEm). Vínculo com a vida continua (o dano foi causado). O veneno mora
// em J.veneno (proliferar e a ABE dos 10 venenos, 704.5c, já liam ali). Limite conhecido: infectar + toque mortífero
// numa criatura não destrói (a ABE olha o.mortal com dano marcado, e o infectar não marca dano).
M.temInfectar = kw => !!kw && kw.some(k => k.k === 'infectar');
/** dano (já sem prevenção) num jogador: veneno com infectar; senão perde vida, se a vida pode mudar (119.7, 119.8) */
M.danoJogador = (e, j, q, kw) => {
  const J = e.jogs[j];
  if (M.temInfectar(kw)) { J.veneno = (J.veneno || 0) + q; M.log(e, J.nome, 'recebe', q, 'veneno (infectar)'); return; }
  if (!M.vidaFixa(e, j)) J.vida -= q;
};
// marcador num jogador (op marcador com quem e sem em): 'poison' (nome do vocabulário, decisão do coordenador 25/11;
// 'veneno' fica aceito até a normalização do banco) em J.veneno; os outros (rad, experience…) em J.marc, que por ora só guarda.
M.marcadorJogador = (e, j, tipo, q, tirar) => {
  const J = e.jogs[j]; if (!J || J.saiu || !(q > 0)) return;
  if (tipo === 'poison' || tipo === 'veneno') { J.veneno = Math.max(0, (J.veneno || 0) + (tirar ? -q : q)); M.log(e, J.nome, tirar ? 'perde' : 'recebe', q, 'veneno'); return; }
  const m = J.marc || (J.marc = {});
  m[tipo] = Math.max(0, (m[tipo] || 0) + (tirar ? -q : q));
};

// ---------- masmorras (CR 309) — escritas pelo motor a partir do Oracle (Scryfall, 25/11) ----------
// Masmorra não é carta do deck (309.2): fica fora do jogo até alguém aventurar. Cada sala é uma habilidade desencadeada
// "Quando você move seu marcador de aventura para esta sala, [efeito]" (309.4c): vai para a pilha como gatilho, com
// alvo escolhido ao pôr (603.3d: sem alvo legal, sai). vai = índices das salas seguintes (as setas); sem vai = a última.
// Efeitos no formato RX; o que o vocabulário não tem usa ops internas (prefixo _, que carta nenhuma pode usar):
//   _ateSeuTurno: P/R ou palavra-chave "até o seu próximo turno" (Fungi Cavern, Throne of the Dead Three);
//   _perdeAMenosQue: "cada jogador perde N a menos que descarte / sacrifique" (Veils of Fear, Sandfall Cell);
//   _comprarLembra: compra e lembra as compradas para o efeito seguinte (Mad Wizard's Lair).
// Simplificações anotadas: incitar (Arena, 701.15) vira só "ataca se puder até o seu próximo turno" (sem "um jogador que
// não você"); a Oubliette sacrifica um de cada vez (uma criatura artefato paga só um dos dois); a Throne põe os
// marcadores logo depois de entrar (não "entra com").
const tok = (pt, cores, sub, kw?) => ({ pt, cores, tipos: ['Creature'], sub, ...(kw ? { kw } : {}) });
const TESOURO = { op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'Treasure' } };
const ALVO_CRIATURA = [{ f: { tipo: ['Creature'], zona: 'campo' } }];
const vid = n => ({ op: 'videncia', quem: 'voce', qtd: n });
export const MASMORRAS: Record<string, { undercity?: boolean; salas: { n: string; fx: any[]; alvos?: any[]; vai: number[] }[] }> = {
  'Lost Mine of Phandelver': { salas: [
    { n: 'Cave Entrance', fx: [vid(1)], vai: [1, 2] },
    { n: 'Goblin Lair', fx: [{ op: 'ficha', quem: 'voce', qtd: 1, token: tok([1, 1], 'R', ['Goblin']) }], vai: [3, 4] },
    { n: 'Mine Tunnels', fx: [TESOURO], vai: [4, 5] },
    { n: 'Storeroom', alvos: ALVO_CRIATURA, fx: [{ op: 'marcador', em: { alvo: 0 }, tipoMarc: '+1/+1', qtd: 1 }], vai: [6] },
    { n: 'Dark Pool', fx: [{ op: 'perderVida', quem: 'cadaOponente', qtd: 1 }, { op: 'ganharVida', quem: 'voce', qtd: 1 }], vai: [6] },
    { n: 'Fungi Cavern', alvos: ALVO_CRIATURA, fx: [{ op: '_ateSeuTurno', em: { alvo: 0 }, p: -4, r: 0 }], vai: [6] },
    { n: 'Temple of Dumathoin', fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }], vai: [] },
  ] },
  'Dungeon of the Mad Mage': { salas: [
    { n: 'Yawning Portal', fx: [{ op: 'ganharVida', quem: 'voce', qtd: 1 }], vai: [1] },
    { n: 'Dungeon Level', fx: [vid(1)], vai: [2, 3] },
    { n: 'Goblin Bazaar', fx: [TESOURO], vai: [4] },
    { n: 'Twisted Caverns', alvos: ALVO_CRIATURA, fx: [{ op: 'efeitoTemporario', em: { alvo: 0 }, dura: 'proximoTurnoSeu', est: [{ modo: 'naoPodeAtacar' }] }], vai: [4] },
    { n: 'Lost Level', fx: [vid(2)], vai: [5, 6] },
    { n: 'Runestone Caverns', fx: [{ op: 'cavar', quem: 'voce', olha: 2, pega: 'tudo', para: 'exilio' }, { op: 'jogar', em: 'anterior', dura: 'sempre' }], vai: [7] },
    { n: "Muiral's Graveyard", fx: [{ op: 'ficha', quem: 'voce', qtd: 2, token: tok([1, 1], 'B', ['Skeleton']) }], vai: [7] },
    { n: 'Deep Mines', fx: [vid(3)], vai: [8] },
    { n: "Mad Wizard's Lair", fx: [{ op: '_comprarLembra', qtd: 3 }, { op: 'jogar', em: 'anterior', gratis: true, talvez: true, qtd: 1 }], vai: [] },
  ] },
  'Tomb of Annihilation': { salas: [
    { n: 'Trapped Entry', fx: [{ op: 'perderVida', quem: 'cadaJogador', qtd: 1 }], vai: [1, 3] },
    { n: 'Veils of Fear', fx: [{ op: '_perdeAMenosQue', qtd: 2, custo: 'descartar' }], vai: [2] },
    { n: 'Sandfall Cell', fx: [{ op: '_perdeAMenosQue', qtd: 2, custo: { sacrificar: { f: { tipo: ['Creature', 'Artifact', 'Land'] } } } }], vai: [4] },
    { n: 'Oubliette', fx: [{ op: 'descartar', quem: 'voce', qtd: 1 }, ...['Creature', 'Artifact', 'Land'].map(t => ({ op: 'sacrificar', quem: 'voce', qtd: 1, f: { tipo: [t] } }))], vai: [4] },
    { n: 'Cradle of the Death God', fx: [{ op: 'ficha', quem: 'voce', qtd: 1, token: { nome: 'The Atropal', super: ['Legendary'], ...tok([4, 4], 'B', ['God', 'Horror'], [{ k: 'toqueMortifero' }]) } }], vai: [] },
  ] },
  // "You can't enter this dungeon unless you 'venture into Undercity'" (só pela iniciativa, 727.2 e 701.49d)
  'Undercity': { undercity: true, salas: [
    { n: 'Secret Entrance', fx: [{ op: 'buscar', quem: 'voce', qtd: 1, f: { tipo: ['Land'], super: ['Basic'] }, para: 'mao', revelar: true }, { op: 'embaralhar', quem: 'voce' }], vai: [1, 2] },
    { n: 'Forge', alvos: ALVO_CRIATURA, fx: [{ op: 'marcador', em: { alvo: 0 }, tipoMarc: '+1/+1', qtd: 2 }], vai: [3, 4] },
    { n: 'Lost Well', fx: [vid(2)], vai: [4, 5] },
    { n: 'Trap!', alvos: [{ f: 'jogador' }], fx: [{ op: 'perderVida', quem: { alvo: 0 }, qtd: 5 }], vai: [6] },
    { n: 'Arena', alvos: ALVO_CRIATURA, fx: [{ op: 'efeitoTemporario', em: { alvo: 0 }, dura: 'proximoTurnoSeu', est: [{ modo: 'deveAtacar' }] }], vai: [6, 7] },
    { n: 'Stash', fx: [TESOURO], vai: [7] },
    { n: 'Archives', fx: [{ op: 'comprar', quem: 'voce', qtd: 1 }], vai: [8] },
    { n: 'Catacombs', fx: [{ op: 'ficha', quem: 'voce', qtd: 1, token: tok([4, 1], 'B', ['Skeleton'], [{ k: 'ameaca' }]) }], vai: [8] },
    { n: 'Throne of the Dead Three', fx: [{ op: 'cavar', quem: 'voce', olha: 10, pega: 1, f: { tipo: ['Creature'] }, para: 'campo', revelar: true, resto: 'grimorio' },
      { op: 'marcador', em: 'anterior', tipoMarc: '+1/+1', qtd: 3 }, { op: '_ateSeuTurno', em: 'anterior', kw: [{ k: 'antimagia' }] }, { op: 'embaralhar', quem: 'voce' }], vai: [] },
  ] },
};
M.MASMORRAS = MASMORRAS;
const NOMES = Object.keys(MASMORRAS);
// o "dado" da masmorra como fonte dos gatilhos de sala (no gatilho, ficha = dado da fonte: fonteDado em efeitos.ts)
const DADO = new Map(NOMES.map(n => [n, { n, tipos: ['Dungeon'], cores: '', kw: [] as any[], vm: 0 }]));
// Estado: J.masm = {nome, sala, ts} (a masmorra de que ele é dono na zona de comando, 309.3: uma só), J.completas =
// nomes das completadas (309.7), e.iniciativa = quem tem (727.1). A masmorra não é objeto em e.objs (não é permanente,
// não pode ser conjurada nem sair do comando, 309.2c): a fonte dos gatilhos de sala é o id negativo -(j+1) com o ts da
// masmorra, e a ABE 704.5t olha a pilha e os pendentes por esse par (como a das sagas).
const fonteId = j => -(j + 1);
/** a masmorra de j como objeto de filtro (Dungeon Delver: afeta {tipo Dungeon, dono voce, zona comando}) */
M.masmorraObj = (e, j) => { const A = e.jogs[j].masm; return A ? { id: fonteId(j), n: A.nome, dono: j, ctrl: j, zona: 'comando', ts: A.ts, virada: false, dano: 0, marc: {}, doente: false, cmd: false, ficha: DADO.get(A.nome) } : null; };
const ultima = (nome, i) => !MASMORRAS[nome].salas[i].vai.length;

// dobraGatilho com evs ['sala'] (Dungeon Delver dado ao comandante, Hama Pashar): cada estática do campo que vale soma
// uma vez (603.2d). A fonte do gatilho de sala é a masmorra no comando: o extras() de gatilhos.ts põe a fonte no campo
// para olhar para trás (603.10a), então a sala conta aqui, com a masmorra na zona dela.
function extrasSala(e, j) {
  const F = M.masmorraObj(e, j); if (!F) return 0;
  let n = 0;
  for (const id of M.indiceCampo(e).est) {
    const S = e.objs[id];
    for (const s of M.dadoDe(e, S).est || []) {
      if (s.modo !== 'dobraGatilho' || !(s.evs || []).includes('sala') || !s.afeta || typeof s.afeta !== 'object') continue;
      const ctx = { voce: S.ctrl, este: S.id };
      try { if (!M.filtroOk(s.afeta) || !M.bate(e, F, s.afeta, ctx) || (s.se && !M.condicao(e, s.se, ctx))) continue; } catch (_) { continue; }
      n++;
    }
  }
  return n;
}
// move o marcador de j para a sala i da masmorra que ele tem (309.4a/309.5a): a habilidade da sala dispara
function entrarSala(e, j, i) {
  const A = e.jogs[j].masm, s = MASMORRAS[A.nome].salas[i];
  A.sala = i;
  M.log(e, e.jogs[j].nome, 'entra na sala', s.n, '(' + A.nome + ')');
  const g = { ev: 'sala', fx: s.fx, alvos: s.alvos || [] }, vezes = 1 + extrasSala(e, j);
  for (let v = 0; v < vezes; v++) e.pend.push({ fonte: fonteId(j), ts: A.ts, ctrl: j, k: 'sala:' + i, g, n: A.nome + ' — ' + s.n, face: null, ficha: DADO.get(A.nome), lki: null, ev: { ev: 'sala', j, nome: A.nome, sala: i } });
  M.evento(e, { ev: 'sala', j, nome: A.nome, sala: i });
}
// 309.7: completa ao tirar a masmorra do jogo (ABE 704.5t ou aventurar na última sala, 701.49c)
function completar(e, j) {
  const J = e.jogs[j], nome = J.masm.nome;
  J.masm = null; (J.completas || (J.completas = [])).push(nome);
  M.log(e, J.nome, 'completa a masmorra', nome);
  M.evento(e, { ev: 'completaMasmorra', j, nome });
}
// pôr uma masmorra no comando (309.2a, 309.4a) e entrar na primeira sala
function porMasmorra(e, j, nome) {
  e.jogs[j].masm = { nome, sala: 0, ts: ++e.ts };
  M.log(e, e.jogs[j].nome, 'aventura em', nome);
  entrarSala(e, j, 0);
}
// aventurar (701.49): sem masmorra, escolhe uma (701.49a; a Undercity só pela iniciativa, 701.49d) e entra na 1ª sala;
// com masmorra fora da última sala, escolhe a seta (701.49b; vale para a Undercity também: a regra olha a masmorra que
// você tem, não como entrou); na última sala, completa e começa outra (701.49c). Pergunta tudo antes de mexer.
M.aventurar = (e, j, ask, undercity = false) => {
  const J = e.jogs[j]; if (!J || J.saiu) return;
  const A = J.masm;
  const novaOps = () => undercity ? ['Undercity'] : NOMES.filter(n => !MASMORRAS[n].undercity);
  const escolheNova = () => ask(j, 'masmorra', novaOps().map(nome => ({ a: 'masmorra', nome })), { undercity }).nome;
  if (A && !ultima(A.nome, A.sala)) {
    const vai = MASMORRAS[A.nome].salas[A.sala].vai;
    const i = ask(j, 'sala', vai.map(k => ({ a: 'sala', i: k, n: MASMORRAS[A.nome].salas[k].n })), { nome: A.nome, desde: A.sala }).i;
    entrarSala(e, j, i);
    return;
  }
  const nome = escolheNova();
  if (A) completar(e, j);
  porMasmorra(e, j, nome);
};
// 704.5t: marcador na última sala e nenhuma habilidade de sala dela esperando ou na pilha → sai do jogo (completa).
// 727.4: quem tinha a iniciativa saiu do jogo → o ativo toma (ou o próximo na ordem).
M.abeMasmorras = e => {
  let mudou = false;
  for (const J of e.jogs) {
    const A = J.masm; if (!A || J.saiu || !ultima(A.nome, A.sala)) continue;
    const f = fonteId(J.i);
    if (e.pend.some(p => p.fonte === f && p.ts === A.ts) || e.pilha.some(h => { const x = e.objs[h].hab; return x && x.fonte === f && x.fonteTs === A.ts; })) continue;
    completar(e, J.i); mudou = true;
  }
  if (e.iniciativa != null && e.jogs[e.iniciativa].saiu && !e.fim) {
    let p = e.turno.ativo; const n = e.jogs.length;
    for (let k = 0; k < n && e.jogs[p].saiu; k++) p = (p + 1) % n;
    if (!e.jogs[p].saiu) { M.tomarIniciativa(e, p); mudou = true; } else e.iniciativa = null;
  }
  return mudou;
};

// ---------- iniciativa (CR 727) ----------
// Três habilidades inerentes, sem fonte, controladas por quem tinha a iniciativa quando dispararam (727.2): tomar →
// aventura na Undercity; manutenção de quem tem → aventura na Undercity; uma ou mais criaturas de um jogador causam
// dano de combate em quem tem → o controlador delas toma (uma vez por jogador em cada etapa de dano). Tomar de novo
// dispara de novo (727.5). Fonte dos pendentes: id negativo próprio (não é masmorra: a ABE 704.5t não espera por ela).
const INI = { n: 'Iniciativa', tipos: [] as any[], cores: '', kw: [] as any[], vm: 0 };
const G_AVENTURA = { ev: 'tomaIniciativa', fx: [{ op: 'aventurar', quem: 'voce', undercity: true }] };
const G_TOMA = { ev: 'dano', fx: [{ op: 'tomarIniciativa', quem: 'doEvento' }] };
const pendIni = (e, j, k, g, ev) => e.pend.push({ fonte: -1000 - j, ts: 0, ctrl: j, k, g, n: 'Iniciativa', face: null, ficha: INI, lki: null, ev });
M.tomarIniciativa = (e, j) => {
  if (e.jogs[j].saiu) return;
  const de = e.iniciativa; e.iniciativa = j;                                     // 727.3: só um tem
  M.log(e, e.jogs[j].nome, 'toma a iniciativa');
  pendIni(e, j, 'iniciativa:toma', G_AVENTURA, { ev: 'tomaIniciativa', j });
  M.evento(e, { ev: 'tomaIniciativa', j, de });
};
// eventos (chamado no fim do M.evento, gatilhos.ts)
M.masmorrasEvento = (e, ev) => {
  if (ev.ev === 'fase') {
    if (ev.passo === 'manutencao' && e.iniciativa === ev.ativo && !e.jogs[ev.ativo].saiu) pendIni(e, ev.ativo, 'iniciativa:manutencao', G_AVENTURA, { ev: 'fase', passo: 'manutencao', j: ev.ativo });
    if (ev.passo === 'desvirar' && e.temp && e.temp.some(t => t.ate === ev.ativo)) e.temp = e.temp.filter(t => t.ate !== ev.ativo);   // "até o seu próximo turno"
    return;
  }
  if (ev.ev === 'dano' && ev.combate && ev.jog !== undefined && ev.jog === e.iniciativa) {
    const F = e.objs[ev.fonte], c = F ? F.ctrl : undefined;
    if (c === undefined || c === ev.jog || e.pend.some(p => p.k === 'iniciativa:dano' && p.ev.j === c)) return;
    pendIni(e, ev.jog, 'iniciativa:dano', G_TOMA, { ev: 'iniciativaDano', j: c });
    return;
  }
  // morbid ("se uma criatura morreu neste turno"): o turno da última morte
  if (ev.ev === 'zona' && ev.de === 'campo' && ev.para === 'cemiterio' && ev.snap && M.temTipo(e, ev.snap, 'Creature')) e.morreuT = e.turno.n;
};
M.morbido = e => e.morreuT === e.turno.n;

// ---------- condições (temIniciativa, completouMasmorra) ----------
// completouMasmorra: true = completou alguma; false = nenhuma; {nome} = aquela; {nome, nao: true} = não aquela (Acererak)
M.condMasmorraOk = se => (se.temIniciativa === undefined || typeof se.temIniciativa === 'boolean')
  && (se.completouMasmorra === undefined || typeof se.completouMasmorra === 'boolean'
    || (!!se.completouMasmorra && typeof se.completouMasmorra === 'object' && typeof se.completouMasmorra.nome === 'string'
      && Object.keys(se.completouMasmorra).every(k => k === 'nome' || k === 'nao')));
M.condMasmorra = (e, se, ctx) => {
  if (se.temIniciativa !== undefined && (e.iniciativa === ctx.voce) !== se.temIniciativa) return false;
  const c = se.completouMasmorra;
  if (c !== undefined) {
    const l = e.jogs[ctx.voce].completas || [];
    const v = typeof c === 'boolean' ? l.length > 0 === c : l.includes(c.nome) !== !!c.nao;
    if (!v) return false;
  }
  return true;
};

// ---------- efeitos ----------
const H = M.EFEITOS;
const jogsDe = (e, f, ctx) => { const q = f.quem; const vivos = M.vivos(e); return q === undefined || q === 'voce' ? (vivos.includes(ctx.voce) ? [ctx.voce] : []) : q === 'doEvento' ? (ctx.ev && ctx.ev.j !== undefined && vivos.includes(ctx.ev.j) ? [ctx.ev.j] : []) : q === 'cadaJogador' ? vivos : q === 'cadaOponente' ? vivos.filter(j => j !== ctx.voce) : []; };
// fx aventurar (701.49) e tomarIniciativa (727): quem = voce (o banco) ou doEvento (o gatilho inerente do dano)
H.aventurar = {
  campos: ['undercity'],
  ok: f => (f.quem === undefined || f.quem === 'voce') && (f.undercity === undefined || f.undercity === true),
  fx(e, f, ctx, ask) { for (const j of jogsDe(e, f, ctx)) M.aventurar(e, j, ask, !!f.undercity); },
};
H.tomarIniciativa = {
  ok: f => f.quem === undefined || f.quem === 'voce',
  fx(e, f, ctx) { for (const j of jogsDe(e, f, ctx)) M.tomarIniciativa(e, j); },
};
// "até o seu próximo turno": e.temp com sempre (a limpeza não tira) e ate = quem fez; sai quando o turno dele começa
H._ateSeuTurno = {
  campos: ['p', 'r', 'kw'], ok: () => false,
  fx(e, f, ctx) {
    const os = M.objsDe(e, f, ctx).filter(o => o.zona === 'campo'); if (!os.length) return;
    (e.temp || (e.temp = [])).push({ ids: os.map(o => ({ id: o.id, ts: o.ts })), p: f.p || 0, r: f.r || 0, kw: f.kw || [], sempre: true, ate: ctx.voce, ts: ++e.ts });
  },
};
// cada jogador, na ordem do turno (101.4), escolhe pagar (descartar 1 / sacrificar 1 que bate) ou perder qtd; tudo
// escolhido antes, depois acontece junto
H._perdeAMenosQue = {
  campos: ['custo'], ok: () => false,
  fx(e, f, ctx, ask) {
    const q = typeof f.qtd === 'number' ? f.qtd : 1, n = e.jogs.length, plano: any[] = [];
    for (let k = 0; k < n; k++) {
      const j = (e.turno.ativo + k) % n, J = e.jogs[j]; if (J.saiu) continue;
      const ops: any[] = [{ a: 'perder', q }];
      if (f.custo === 'descartar') for (const id of J.zonas.mao) ops.push({ a: 'descartar', id });
      else for (const o of M.objetosQue(e, { ...f.custo.sacrificar.f, ctrl: 'voce', zona: 'campo' }, { voce: j })) ops.push({ a: 'sacrificar', id: o.id });
      plano.push([j, ask(j, 'evitarPerda', ops, { q, custo: f.custo === 'descartar' ? 'descartar' : 'sacrificar' })]);
    }
    for (const [j, r] of plano) {
      if (r.a === 'descartar') M.descartar(e, j, [r.id]);
      else if (r.a === 'sacrificar') { if (e.objs[r.id] && e.objs[r.id].zona === 'campo') M.mover(e, r.id, 'cemiterio'); }
      else if (!M.vidaFixa(e, j)) { e.jogs[j].vida -= q; M.log(e, e.jogs[j].nome, 'perde', q, 'de vida'); }
    }
  },
};
H._comprarLembra = {
  ok: () => false,
  fx(e, f, ctx) {
    const J = e.jogs[ctx.voce], antes = new Set(J.zonas.mao);
    M.comprar(e, ctx.voce, typeof f.qtd === 'number' ? f.qtd : 1);
    const novas = J.zonas.mao.filter(id => !antes.has(id));
    ctx.movidos = novas.map(id => ({ id, ts: e.objs[id].ts }));
    if (novas.length) M.log(e, J.nome, 'revela', novas.map(id => e.objs[id].n).join(', '));
  },
};
