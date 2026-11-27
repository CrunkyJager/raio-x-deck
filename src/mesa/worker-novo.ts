// src/mesa/worker-novo.ts — T22 (beta): Worker do motor novo para a Mesa ao vivo. Fala a mesma mensagem do
// motor/worker.js (motor/mesa.js): {id, tipo, Dv, Ops, seed, T, vida, nomes[, esc, desde]} → {id, r} ou {id, erro}.
// 'partida' = uma partida inteira; 'jogar' = você joga: devolve {perg} (a próxima decisão) ou {fim} (a partida).
// A sessão do 'jogar' fica viva aqui: a resposta nova continua de onde parou; desfazer (lista menor ou diferente)
// refaz do zero com a mesma semente. Torneio, estudo, trocas e variantes ficam no motor velho por enquanto.
import { arenaNova, novaSessao } from './arena-nova';

let SESS: { chave: string; s: ReturnType<typeof novaSessao> } | null = null;
const cfgDe = (d: any) => ({ log: true, T: d.T || 20, vida: d.vida, nomes: d.nomes });

function jogar(d: any) {
  const chave = JSON.stringify([d.seed, d.T, d.vida, d.nomes, d.ks || null, d.Dv.base, d.Dv.M.map((m: any) => m.nome), d.Ops.map((o: any) => [o.base, o.M.map((m: any) => m.nome)])]);
  if (!SESS || SESS.chave !== chave || !SESS.s.continua(d.esc || [], d.desde || 0))
    SESS = { chave, s: novaSessao([d.Dv, ...d.Ops], d.seed, { ...cfgDe(d), humano: { k: 0, ...(d.ks ? { ks: d.ks } : {}), esc: d.esc || [], desde: d.desde || 0 } }) };
  try { const fim = SESS.s.rodar(); SESS = null; return { fim }; }
  catch (x: any) { if (!x.raioxPergunta) { SESS = null; throw x; } return { perg: x.raioxPergunta }; }
}

self.onmessage = (ev: MessageEvent) => {
  const d = ev.data, id = d.id;
  try {
    let r;
    if (d.tipo === 'partida') r = arenaNova([d.Dv, ...d.Ops], d.seed, cfgDe(d));
    else if (d.tipo === 'jogar') r = jogar(d);
    else throw new Error('motor novo (beta): só a Mesa ao vivo por enquanto (' + d.tipo + ' fica no motor velho)');
    (self as any).postMessage({ id, r });
  } catch (x: any) { (self as any).postMessage({ id, erro: String(x) + ' ' + (x && x.stack || '') }); }
};
