// Ponto de entrada do Vite.
// T43 (c): análise, mesa e montar viraram módulos (src/analise, src/mesa, src/montar) e são carregados daqui, na mesma
// ordem das antigas tags <script> do index.html. Cada um em separado: se um falha, os outros sobem, como antes,
// quando cada script era independente. Os dados grandes (cards-db.js, precos-myp.js…) e o motor/engine.js continuam
// <script> clássicos carregados antes (window.CARD_DB etc.); saem do global num passo seguinte.
import { mount, unmount } from 'svelte';
import App from './App.svelte';
import Saida from './telas/Saida.svelte';
import Janelas from './telas/Janelas.svelte';
import type { Analise } from './analise/analise';
import './versao';

// A casca (App.svelte) vai primeiro e direto no <body>, antes do primeiro <script>, no mesmo lugar onde o HTML
// fixo estava: os módulos abaixo procuram #deck-in, #examples, #out… assim que sobem.
mount(App, { target: document.body, anchor: document.body.querySelector('script') ?? undefined });

// O #out (Resumo, Trocas e Análise) é a Saida.svelte, que o analise.ts desenha a cada análise (ver telas() lá):
// desmonta a anterior e monta a nova com o A novo, porque o #out inteiro é refeito a cada run().
let saida: ReturnType<typeof mount> | null = null;
window.RAIOX_TELAS = {
  saida: (out: Element, A: Analise) => {
    if (saida) unmount(saida);
    out.innerHTML = '';
    saida = mount(Saida, { target: out, props: { A } });
  },
};

async function sobe(nome: string, carrega: () => Promise<unknown>) {
  try { await carrega(); } catch (err) { console.error(`Raio-X: ${nome} não subiu`, err); }
}

await sobe('análise', () => import('./analise/analise'));
// janelas da análise (prévia, detalhe da carta, zoom): no fim do <body>, onde o #hov e o #zoom eram criados; usam o window.RAIOX
if (window.RAIOX) mount(Janelas, { target: document.body });
await sobe('mesa', () => import('./mesa/mesa-ui.js'));
if (window.RAIOX) await sobe('montar', () => import('./montar/montar'));   // antes: if (!R) return; no começo do montar.js
