// ferramentas/lacunas-novo.mjs — a régua do MOTOR NOVO (src/motor + banco/cartas): o que ele ainda não faz ou faz aproximado.
// (lacunas.js mede o motor antigo, motor/engine.js; não serve mais de régua.)
// Duas fontes, sem rodar o motor (lê só arquivos, ~1 s):
//   falta          — as frases "falta" das cartas do banco (o que a carta escrita diz que o motor não sabe);
//   simplificação  — os comentários "Simplificação/aproxima" de src/motor/*.ts, ligados às cartas que usam o que o
//                    trecho cita (op, ev, palavra-chave, modo ou campo citado entre aspas ou no texto do comentário).
//                    A ligação é por nome: indica, não prova (uma carta pode usar o campo sem cair no caso simplificado).
// N = em quantos dos 30 decks (ferramentas/calibra/banco.json) a carta aparece; a fila sai pela soma de N.
// Uso:  node ferramentas/lacunas-novo.mjs              resumo + top 20
//       node ferramentas/lacunas-novo.mjs --tudo       a fila inteira
//       node ferramentas/lacunas-novo.mjs "Nome"       o que o motor novo não faz/aproxima numa carta
//       node ferramentas/lacunas-novo.mjs --confere    teste rápido (CI): sai com erro se a régua quebrou
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const VALOR = new Set(['op', 'ev', 'k', 'modo']);              // chaves cujo valor é vocabulário do motor
const COMUM = new Set(['sai', 'entra', 'morre', 'ataca', 'compra', 'vira', 'desvirar', 'escolher', 'descarta', 'conjura']);   // palavras do português que também são ev: solta no comentário não liga
const GERAL = 0.03;                                            // termo usado por mais que isto das cartas é genérico demais para ligar

export function medir() {
  // ---- cartas do banco: nome → {arquivo, vocabulário, faltas}
  const dir = path.join(raiz, 'banco/cartas'), cartas = [];
  for (const arq of readdirSync(dir)) {
    if (!arq.endsWith('.json')) continue;
    const d = JSON.parse(readFileSync(path.join(dir, arq), 'utf8')), voc = new Set(), vals = new Set(), faltas = [];
    const anda = x => {
      if (Array.isArray(x)) { for (const v of x) anda(v); return; }
      if (!x || typeof x !== 'object') return;
      for (const [k, v] of Object.entries(x)) {
        if (k === 'rev') continue;
        if (k === 'falta' && Array.isArray(v)) { faltas.push(...v.filter(s => typeof s === 'string')); continue; }
        voc.add(k);
        if (VALOR.has(k) && typeof v === 'string') { voc.add(v); vals.add(v); }
        anda(v);
      }
    };
    anda(d);
    cartas.push({ n: d.n, arq, voc, vals, faltas, N: 0 });
  }
  const porNome = new Map();
  for (const c of cartas) { porNome.set(norm(c.n), c); for (const f of c.n.split(' // ')) if (!porNome.has(norm(f))) porNome.set(norm(f), c); }

  // ---- presença nos 30 decks
  const decks = JSON.parse(readFileSync(path.join(raiz, 'ferramentas/calibra/banco.json'), 'utf8'));
  for (const dk of Object.values(decks)) {
    const vistas = new Set();
    for (const l of String(dk.lista || '').split('\n')) {
      const m = l.trim().match(/^\d+x?\s+(.+?)(?:\s+\([A-Z0-9]+\).*)?$/); if (!m) continue;
      const c = porNome.get(norm(m[1])); if (c && !vistas.has(c)) { vistas.add(c); c.N++; }
    }
  }

  // ---- vocabulário específico (o que é raro o bastante para dizer algo)
  const freq = new Map();
  for (const c of cartas) for (const t of c.voc) freq.set(t, (freq.get(t) || 0) + 1);
  const especifico = t => freq.has(t) && freq.get(t) <= GERAL * cartas.length;
  const ehValor = new Set(cartas.flatMap(c => [...c.vals]));

  // ---- comentários de simplificação em src/motor
  const simpl = [], srcDir = path.join(raiz, 'src/motor');
  for (const arq of readdirSync(srcDir).filter(f => f.endsWith('.ts')).sort()) {
    const L = readFileSync(path.join(srcDir, arq), 'utf8').split('\n');
    L.forEach((l, i) => {
      const ci = l.indexOf('//'); if (ci < 0) return;
      const com = l.slice(ci + 2); if (!/simplifica|aproxima/i.test(com)) return;
      // o trecho: a linha da simplificação, a de antes (o assunto) se for comentário, e as 3 linhas de código depois
      const soCom = s => /^\s*\/\//.test(s);
      let a = i, b = i;
      if (soCom(l)) { if (a > 0 && soCom(L[a - 1])) a--; while (b + 1 < L.length && soCom(L[b + 1]) && !/^\s*\/\/\s*-{3}/.test(L[b + 1])) b++; }
      const ctx = L.slice(a, Math.min(L.length, b + 4)).join('\n'), textoCom = L.slice(a, b + 1).map(s => s.slice(s.indexOf('//') + 2)).join(' ') + (soCom(l) ? '' : com);
      // entre aspas (no comentário ou no código): op/ev/palavra-chave/modo ou campo; palavra solta do comentário: só op/ev/palavra-chave/modo
      const tok = new Set([...ctx.matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'/g)].map(m => m[1]));
      for (const w of textoCom.match(/[a-zA-ZÀ-ÿ]{3,}/g) || []) for (const x of [w, w.toLowerCase()]) if (ehValor.has(x) && !COMUM.has(x)) tok.add(x);
      const liga = [...tok].filter(t => especifico(t) && !COMUM.has(t));
      const tx = (soCom(l) ? textoCom : com).replace(/\s+/g, ' ').trim(), pt = tx.search(/simplifica|aproxima/i);
      const texto = pt > 70 ? '…' + tx.slice(tx.lastIndexOf(' ', pt - 50) + 1) : tx;   // a partir de pouco antes da simplificação
      simpl.push({ onde: `${arq}:${i + 1}`, texto, liga, cartas: liga.length ? cartas.filter(c => liga.some(t => c.voc.has(t))) : [] });
    });
  }

  // ---- fila
  const linhas = [];
  for (const c of cartas) for (const f of c.faltas) linhas.push({ tipo: 'falta', texto: f, onde: 'banco/cartas/' + c.arq, cartas: [c] });
  for (const s of simpl) linhas.push({ tipo: 'simplificação', texto: s.texto, onde: s.onde, liga: s.liga, cartas: s.cartas });
  for (const l of linhas) { l.N = l.cartas.reduce((t, c) => t + c.N, 0); l.cartas = [...l.cartas].sort((x, y) => y.N - x.N || x.n.localeCompare(y.n)); }
  linhas.sort((x, y) => y.N - x.N || y.cartas.length - x.cartas.length || x.onde.localeCompare(y.onde));
  return { cartas, simpl, linhas, decks: Object.keys(decks).length };
}

const corta = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const lista = (cs, n = 4) => cs.slice(0, n).map(c => c.N ? `${c.n} (${c.N})` : c.n).join('; ') + (cs.length > n ? `; +${cs.length - n}` : '');

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const t0 = Date.now(), arg = process.argv.slice(2), R = medir();
  const comFalta = R.cartas.filter(c => c.faltas.length), tocadas = new Set(R.simpl.flatMap(s => s.cartas));
  if (arg[0] === '--confere') {
    const erros = [];
    if (R.cartas.length < 1000) erros.push(`só ${R.cartas.length} cartas no banco`);
    if (!R.cartas.some(c => c.N > 0)) erros.push('nenhuma carta do banco achada nos 30 decks');
    if (!R.simpl.length) erros.push('nenhum comentário de simplificação achado em src/motor');
    for (const l of R.linhas) if (l.tipo === 'falta' && l.cartas.length !== 1) erros.push('falta sem carta: ' + l.texto);
    if (Date.now() - t0 > 10000) erros.push(`lento: ${Date.now() - t0} ms`);
    console.log(erros.length ? 'lacunas-novo ✘\n' + erros.join('\n') : `lacunas-novo ✔ ${R.cartas.length} cartas, ${comFalta.length} com falta, ${R.simpl.length} simplificações, ${Date.now() - t0} ms`);
    process.exit(erros.length ? 1 : 0);
  }
  if (arg[0] && !arg[0].startsWith('--')) {
    const alvo = norm(arg[0]), c = R.cartas.find(x => norm(x.n) === alvo) || R.cartas.find(x => norm(x.n).includes(alvo));
    if (!c) { console.log('não achei no banco/cartas'); process.exit(1); }
    console.log(`${c.n} (banco/cartas/${c.arq}) — em ${c.N} dos ${R.decks} decks`);
    console.log(c.faltas.length ? 'falta:\n' + c.faltas.map(f => '  - ' + f).join('\n') : 'falta: nada');
    const ss = R.simpl.filter(s => s.cartas.includes(c));
    console.log(ss.length ? 'simplificações que podem valer (pelo que ela usa):\n' + ss.map(s => `  - ${s.onde} [${s.liga.filter(t => c.voc.has(t)).join(', ')}] ${corta(s.texto, 160)}`).join('\n') : 'simplificações: nenhuma ligada');
    process.exit(0);
  }
  console.log(`# Motor novo — o que ainda não faz ou aproxima (${new Date().toLocaleDateString('pt-BR')}). N = soma, pelas cartas, de em quantos dos ${R.decks} decks ela aparece.`);
  console.log(`Cartas no banco: ${R.cartas.length} (${R.cartas.filter(c => c.N).length} aparecem nos decks).`);
  console.log(`Com "falta": ${comFalta.length} cartas, ${comFalta.reduce((t, c) => t + c.faltas.length, 0)} frases; nos decks: ${comFalta.filter(c => c.N).length} cartas.`);
  console.log(`Simplificações no código: ${R.simpl.length} (${R.simpl.filter(s => s.cartas.length).length} ligadas a cartas); cartas que podem cair nelas: ${tocadas.size} (${[...tocadas].filter(c => c.N).length} nos decks).`);
  const top = arg.includes('--tudo') ? R.linhas : R.linhas.slice(0, 20);
  console.log(`\n${arg.includes('--tudo') ? 'Fila inteira' : 'Top 20'} (N | tipo | onde | o quê | cartas):`);
  for (const l of top) console.log(`${String(l.N).padStart(4)} | ${l.tipo === 'falta' ? 'falta ' : 'simpl.'} | ${l.onde.replace('banco/cartas/', '')} | ${corta(l.texto, 110)} | ${lista(l.cartas)}`);
  console.log(`\n(${Date.now() - t0} ms; "Nome" mostra uma carta; --tudo a fila inteira)`);
}
