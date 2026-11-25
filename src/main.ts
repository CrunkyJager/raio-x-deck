// Ponto de entrada do Vite.
// T43 (c): análise, mesa e montar viraram módulos (src/analise, src/mesa, src/montar) e são carregados daqui, na mesma
// ordem das antigas tags <script> do index.html. Cada um em separado: se um falha, os outros sobem, como antes,
// quando cada script era independente. Os dados grandes (cards-db.js, precos-myp.js…) e o motor/engine.js continuam
// <script> clássicos carregados antes (window.CARD_DB etc.); saem do global num passo seguinte.
import { mount, unmount } from 'svelte';
import App from './App.svelte';
import Resumo from './telas/Resumo.svelte';
import TelaAnalise from './telas/Analise.svelte';
import type { Analise } from './analise/analise';

// A casca (App.svelte) vai primeiro e direto no <body>, antes do primeiro <script>, no mesmo lugar onde o HTML
// fixo estava: os módulos abaixo procuram #deck-in, #examples, #out… assim que sobem.
mount(App, { target: document.body, anchor: document.body.querySelector('script') ?? undefined });

// Telas em componente que o analise.ts desenha a cada análise (ver telas() lá): monta no lugar do <template>
// e desmonta a anterior, porque o #out inteiro é refeito a cada run().
const vivas: Record<string, ReturnType<typeof mount>> = {};
const tela = (nome: string, C: typeof Resumo) => (lugar: Element, A: Analise) => {
  if (vivas[nome]) unmount(vivas[nome]);
  vivas[nome] = mount(C, { target: lugar.parentNode as Element, anchor: lugar, props: { A } });
};
window.RAIOX_TELAS = { resumo: tela('resumo', Resumo), analise: tela('analise', TelaAnalise) };

async function sobe(nome: string, carrega: () => Promise<unknown>) {
  try { await carrega(); } catch (err) { console.error(`Raio-X: ${nome} não subiu`, err); }
}

await sobe('análise', () => import('./analise/analise'));
await sobe('mesa', () => import('./mesa/mesa-ui.js'));
if (window.RAIOX) await sobe('montar', () => import('./montar/montar'));   // antes: if (!R) return; no começo do montar.js
