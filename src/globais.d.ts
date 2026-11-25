// T43 (c): os módulos que vieram dos scripts clássicos ainda conversam pelo window (RAIOX, CARD_DB, RAIOX_TESTE…)
// e usam funções globais do motor/engine.js (script clássico do Grimório Arena). Até as telas virarem Svelte (passo d),
// o window aceita qualquer nome; cada um ganha tipo quando sair do window.
export {};
declare global {
  interface Window { [nome: string]: any }
  // motor/engine.js (global, carregado antes pelo index.html)
  function norm(s: string): string;
  function parseLista(txt: string): any;
  function modelo(r: any): any;
  function monta(itens: any, achar: any, cmdEsc?: any): any;
}
