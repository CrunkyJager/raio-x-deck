// Mede o que o motor ignora nos decks de exemplo, pelo leitor de cláusulas do próprio motor (lacunas/naoModelado).
// Uso, na pasta do projeto:  node ferramentas/lacunas.js            (resumo por deck e por mecânica)
//                            node ferramentas/lacunas.js "Rancor"   (o que o motor ignora numa carta)
// Rode antes e depois de mexer no motor: os números têm que cair.
const path = require('path'), raiz = path.join(__dirname, '..');
global.window = global;
require(path.join(raiz, 'cards-db.js')); require(path.join(raiz, 'exemplos.js'));
const E = require(path.join(raiz, 'motor/engine.js'));
const DB = window.CARD_DB, F = Object.fromEntries(DB.fields.map((f, i) => [f, i]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const IDX = {}; for (const k of Object.keys(DB.cards)) { IDX[norm(k)] = k; IDX[norm(k.split(' // ')[0])] = k; }
// mesmo formato de linha que mesa-ui.js monta (sem a resistência: usa a força)
const row = n => { const k = IDX[norm(n)]; if (!k) return null; const e = DB.cards[k]; const p = String(e[F.p] || '').split(' // ')[0]; return [k, e[F.m], e[F.v], e[F.t], p, p, e[F.o], e[F.ci], e[F.usd], false]; };
if (process.argv[2]) { const r = row(process.argv[2]); if (!r) return console.log('não achei'); const m = E.modelo(r); console.log(m.nome, '\nignora:', m.lac, '\nnão faz nada no jogo:', E.naoModelado(m)); return; }
const MEC = [
  [/equip|equipped|reconfigure|living weapon/, 'Equipamento'], [/enchant creature|enchanted creature|umbra|totem armor|this aura/, 'Aura'],
  [/\+1\/\+1 counter|counter on/, 'Marcadores +1/+1'], [/gets? \+\d|get \+\d/, 'Bônus de P/T (lordes, até o fim do turno)'],
  [/\b(haste|trample|flying|menace|vigilance|first strike|deathtouch|lifelink|reach|protection)\b/, 'Palavra-chave dada a outra criatura'],
  [/whenever [^.]*attacks?/, 'Gatilho de ataque'], [/deals combat damage/, 'Gatilho de dano de combate'], [/whenever you cast|cost \{\d\} less/, 'Gatilho de conjurar / redução por cor'],
  [/token/, 'Fichas (habilidades e gatilhos)'], [/enters/, 'Gatilho de entrar'], [/dies|graveyard/, 'Morrer / cemitério'], [/sacrifice/, 'Sacrifício'],
  [/\{t\}|untap|tap target/, 'Habilidade ativada / virar e desvirar'], [/library|cycling|discover/, 'Grimório (topo, ciclar, descobrir)'], [/additional combat/, 'Combate extra'],
];
const cat = {}, ex = {};
for (const [nome, lista] of Object.entries(window.EXEMPLOS)) {
  const ms = [...new Set(lista.split('\n').map(l => l.replace(/^\d+x?\s+/, '').trim()).filter(l => l && !l.startsWith('//')))].map(row).filter(Boolean).map(E.modelo).filter(m => !m.land);
  console.log(`${nome}: ${ms.filter(m => m.lac.length).length}/${ms.length} cartas com texto ignorado; ${ms.filter(E.naoModelado).length} não fazem nada no jogo`);
  for (const m of ms) for (const fr of m.lac) { const k = (MEC.find(([rx]) => rx.test(fr.toLowerCase())) || [0, 'outros'])[1]; cat[k] = (cat[k] || 0) + 1; (ex[k] = ex[k] || new Set()).add(m.nome); }
}
console.log('\nFrases ignoradas por mecânica:');
for (const [k, q] of Object.entries(cat).sort((a, b) => b[1] - a[1])) console.log(String(q).padStart(4), k, '—', [...ex[k]].slice(0, 4).join('; '));
