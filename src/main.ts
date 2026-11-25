// T43 (a): ponto de entrada do Vite. Por enquanto só monta a casca Svelte; as telas continuam
// nos scripts clássicos (analise.js, mesa-ui.js, montar.js) até o passo (d).
import { mount } from 'svelte';
import App from './App.svelte';

const alvo = document.getElementById('rx-app');
if (alvo) mount(App, { target: alvo });
