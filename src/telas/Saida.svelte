<script lang="ts">
  // O #out inteiro (T43 d): era o render(A)/telas()/wire(A) do analise.ts. O run() chama window.RAIOX_TELAS.saida
  // (main.ts) a cada análise, que desmonta a anterior e monta esta com o A novo. A ordem é a das telas no #out;
  // o show() do analise.ts mostra uma por vez pelo data-s.
  import type { Analise } from '../analise/analise';
  import Resumo from './Resumo.svelte';
  import Trocas from './Trocas.svelte';
  import TelaAnalise from './Analise.svelte';
  let { A }: { A: Analise } = $props();
</script>

<Resumo {A} />
<Trocas {A} />
<TelaAnalise {A} />
