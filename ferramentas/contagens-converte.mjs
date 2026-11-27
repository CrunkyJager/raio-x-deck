// ferramentas/contagens-converte.mjs — passa as contagens das cartas do banco para o formato único {conta:{de, o, junta}}
// (src/motor/contagem-trad.ts). Pode rodar quantas vezes quiser: o que já está no formato novo fica igual.
// uso: node ferramentas/contagens-converte.mjs [arquivo.json …]   (sem arquivo: banco/cartas/*.json e banco/testes/*.json)
//      --ver   só mostra quantas mudariam, sem gravar
import fs from 'node:fs';
import path from 'node:path';
import { traduzQtd, nova } from '../src/motor/contagem-trad.ts';

const args = process.argv.slice(2), ver = args.includes('--ver');
let arqs = args.filter(a => !a.startsWith('--'));
if (!arqs.length) arqs = ['banco/cartas', 'banco/testes'].flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => path.join(d, f)));

// contagem velha = objeto com 'conta' que é nome (string) ou filtro (objeto sem 'de' e sem 'q'; {q,…} é a condição se.conta)
const velha = o => 'conta' in o && (typeof o.conta === 'string' || (!!o.conta && typeof o.conta === 'object' && !Array.isArray(o.conta) && !nova(o.conta) && !('q' in o.conta)));
let n = 0;
function anda(x) {
  if (Array.isArray(x)) return x.map(anda);
  if (!x || typeof x !== 'object') return x;
  if (velha(x)) { n++; x = traduzQtd(x); }
  const r = {}; for (const k of Object.keys(x)) r[k] = anda(x[k]);
  return r;
}
let mudaram = 0;
for (const a of arqs) {
  const txt = fs.readFileSync(a, 'utf8'), antes = n, novo = anda(JSON.parse(txt));
  if (n === antes) continue;
  mudaram++;
  if (!ver) fs.writeFileSync(a, JSON.stringify(novo, null, txt.includes('\n ') ? (txt.match(/\n( +)"/) || [, ' '])[1].length : undefined) + (txt.endsWith('\n') ? '\n' : ''));
}
console.log(`${ver ? 'mudariam' : 'convertidos'}: ${mudaram} arquivos, ${n} contagens`);
