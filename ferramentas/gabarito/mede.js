// T06 — linha de base: passa cada comandante do gabarito (planos.json) pelo sistema de hoje (planoDe + temas do comandante)
// e compara com o plano principal/secundário revisado pelo Felipe. Só o comandante entra (o próprio deck não prova o plano).
// Uso: node ferramentas/gabarito/mede.js  → imprime o resumo e grava linha-base.json / linha-base.md ao lado.
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = path.join(__dirname, '..', '..'), aqui = __dirname;
const noop = () => {}, el = new Proxy(function () {}, { get: (o, k) => k === Symbol.toPrimitive ? () => '' : el, set: () => true, apply: () => el });
const ctx = { console, document: { addEventListener: noop, dispatchEvent: noop, querySelector: () => el, querySelectorAll: () => [], getElementById: () => el, createElement: () => el, body: el },
  localStorage: { getItem: () => null, setItem: noop }, location: { search: '', hash: '' }, fetch: () => Promise.reject(new Error('offline')),
  setTimeout, CustomEvent: function () {}, scrollTo: noop, scrollY: 0, requestAnimationFrame: noop, addEventListener: noop };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['cards-db.js', 'forge-db.js', 'papeis-ia.js']) if (fs.existsSync(path.join(raiz, f))) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
// analise.js é um IIFE: expõe as funções só na memória, o arquivo não muda
const src = fs.readFileSync(path.join(raiz, 'analise.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.__R = { planoDe, themesOf, C };\n})();');
vm.runInContext(src, ctx, { filename: 'analise.js' });
const { planoDe, themesOf, C } = ctx.__R;

// o que o sistema de hoje sabe dizer → número do plano (planos.md v3). Suposição da T06, documentada no relatório.
const TEMA_PLANO = { voltron: 1, tokens: 2, counters: 4, graveyard: 21, artifacts: 15, enchant: 15, spells: 16, sac: 9, life: 11, lands: 12, combat: 3, draw: 28 };
const ORDEM = Object.keys(TEMA_PLANO);
// nome do gabarito → cartas: nome exato, alias, frente de dupla face ("Esika, God of the Tree" → "Esika… // The Prismatic Bridge") ou parceiros ("A // B")
const DBC = ctx.CARD_DB.cards, ALIAS = ctx.CARD_DB.alias || {};
function um(n) { if (DBC[n]) return C(n); if (ALIAS[n] && DBC[ALIAS[n]]) return C(ALIAS[n]); const k = Object.keys(DBC).find(x => x.startsWith(n + ' // ')); return k ? C(k) : null; }
function achar(nome) { const c = um(nome); if (c) return [c]; const ps = nome.split(' // ').map(um); return ps.length > 1 && ps.every(Boolean) ? ps : null; }
function prever(cmds) {
  const cmdThemes = new Set(); for (const c of cmds) themesOf(c).forEach(t => cmdThemes.add(t));
  const P = planoDe({ cmds, uniq: [], cmdThemes, tribe: null });
  const todos = [];
  if (P.voltron) todos.push(1);
  if (P.goad) todos.push(29);
  for (const k of ORDEM) if (cmdThemes.has(k)) todos.push(TEMA_PLANO[k]);
  if (P.atk) todos.push(3);
  const u = [...new Set(todos)];
  return { principal: u[0] || null, todos: u, temas: [...cmdThemes], flags: ['voltron', 'goad', 'atk'].filter(k => P[k]) };
}

const g = JSON.parse(fs.readFileSync(path.join(aqui, 'planos.json'), 'utf8'));
const nomeP = (i) => i == null ? '(sem palpite)' : `${i} ${g.planos[i]}`;
const linhas = [], faltam = [];
for (const c of g.comandantes) {
  const cards = achar(c.nome); if (!cards) { faltam.push(c.nome); continue; }
  const p = prever(cards), gab = [c.principal, ...c.secundario];
  linhas.push({ nome: c.nome, ci: c.ci, gab_principal: c.principal, gab_sec: c.secundario, prev_principal: p.principal, prev_todos: p.todos, temas: p.temas, flags: p.flags,
    exato: p.principal === c.principal, principal_no_gab: p.principal != null && gab.includes(p.principal), gab_nos_prev: p.todos.includes(c.principal) });
}
const n = linhas.length, pct = (k) => linhas.filter(l => l[k]).length, f1 = (x) => (100 * x / n).toFixed(1).replace('.', ',') + '%';
const semPalpite = linhas.filter(l => l.prev_principal == null).length;
const alcanca = new Set(Object.values(TEMA_PLANO).concat([1, 29, 3]));
const foraAlcance = linhas.filter(l => !alcanca.has(l.gab_principal)).length;
// erros agrupados pelo plano do gabarito e pelos pares (gabarito → previsto)
const porPlano = {}, pares = {};
for (const l of linhas) {
  const k = l.gab_principal; (porPlano[k] = porPlano[k] || { n: 0, ok: 0 }).n++; if (l.exato) porPlano[k].ok++;
  if (!l.exato) { const pk = `${nomeP(l.gab_principal)} → ${nomeP(l.prev_principal)}`; pares[pk] = (pares[pk] || 0) + 1; }
}
const res = { data: new Date().toISOString().slice(0, 10), versao_gabarito: g.versao, n, faltam, exato: pct('exato'), principal_no_gab: pct('principal_no_gab'), gab_nos_prev: pct('gab_nos_prev'), sem_palpite: semPalpite, fora_alcance: foraAlcance, mapa: TEMA_PLANO, linhas };
fs.writeFileSync(path.join(aqui, 'linha-base.json'), JSON.stringify(res, null, 1));

const tPlano = Object.entries(porPlano).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `| ${nomeP(+k)} | ${v.n} | ${v.ok} | ${alcanca.has(+k) ? '' : 'não sabe dizer'} |`);
const tPares = Object.entries(pares).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `| ${k} | ${v} |`);
const md = `# Linha de base do plano (T06, ${res.data})

Gabarito: \`planos.json\` (${g.versao}), ${n} comandantes${faltam.length ? `, faltam na base: ${faltam.join(', ')}` : ''}.
Sistema medido: \`planoDe\` + temas do comandante (\`themesOf\`) em \`analise.js\`, **só o comandante** (sem as 99).
Rodar de novo: \`node ferramentas/gabarito/mede.js\`.

## Resultado
| Medida | Acerto |
|---|---|
| Principal exato | **${res.exato}/${n} (${f1(res.exato)})** |
| Principal previsto está no gabarito (principal ou secundário) | ${res.principal_no_gab}/${n} (${f1(res.principal_no_gab)}) |
| Principal do gabarito aparece em algum palpite | ${res.gab_nos_prev}/${n} (${f1(res.gab_nos_prev)}) |
| Sem palpite nenhum | ${semPalpite}/${n} |
| Principal do gabarito é um plano que o sistema nem sabe dizer | ${foraAlcance}/${n} (${f1(foraAlcance)}) |

## Como o sistema de hoje foi traduzido para os 36 planos (suposição desta medida)
voltron (flag ou tema) → 1 · goad → 29 · ataque (flag/tema combat) → 3 · tokens → 2 · counters → 4 · graveyard → 21 · artifacts/enchant → 15 · spells → 16 · sac → 9 · life → 11 · lands → 12 · draw → 28.
Ordem do principal: voltron > goad > temas na ordem do THEMES > ataque. Planos fora disso: ${36 - alcanca.size} dos 36.

## Por plano do gabarito
| Plano (gabarito) | Comandantes | Acertos | |
|---|---|---|---|
${tPlano.join('\n')}

## Erros mais comuns (gabarito → previsto)
| Par | Vezes |
|---|---|
${tPares.join('\n')}
`;
fs.writeFileSync(path.join(aqui, 'linha-base.md'), md);
console.log(`T06: ${n} comandantes · exato ${res.exato} (${f1(res.exato)}) · previsto no gabarito ${res.principal_no_gab} (${f1(res.principal_no_gab)}) · gabarito nos palpites ${res.gab_nos_prev} (${f1(res.gab_nos_prev)}) · sem palpite ${semPalpite} · fora do alcance ${foraAlcance}${faltam.length ? ' · faltam ' + faltam.length : ''}`);
