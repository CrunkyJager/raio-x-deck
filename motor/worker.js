/* Roda o motor do Grimório fora da página, para a tela não travar durante as partidas.
   Repassa o ?v= do worker para os scripts, senão o navegador pode usar um motor velho do cache. */
const V = self.location.search || '';
importScripts('engine.js' + V, 'mesa.js' + V);
