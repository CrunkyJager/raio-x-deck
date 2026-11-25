// Ponto de entrada do Vite.
// T43 (c): análise, mesa e montar viraram módulos (src/analise, src/mesa, src/montar) e são carregados daqui, na mesma
// ordem das antigas tags <script> do index.html. Cada um em separado: se um falha, os outros sobem, como antes,
// quando cada script era independente. Os dados grandes (cards-db.js, precos-myp.js…) e o motor/engine.js continuam
// <script> clássicos carregados antes (window.CARD_DB etc.); saem do global num passo seguinte.
import { mount } from 'svelte';
import App from './App.svelte';

async function sobe(nome: string, carrega: () => Promise<unknown>) {
  try { await carrega(); } catch (err) { console.error(`Raio-X: ${nome} não subiu`, err); }
}

await sobe('análise', () => import('./analise/analise'));
await sobe('mesa', () => import('./mesa/mesa-ui.js'));
if (window.RAIOX) await sobe('montar', () => import('./montar/montar.js'));   // antes: if (!R) return; no começo do montar.js

const alvo = document.getElementById('rx-app');
if (alvo) mount(App, { target: alvo });
