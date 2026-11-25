<script lang="ts">
  // Aba Montar (T43 d): era o painelTopo() + passos() + o painel do passo, montados num innerHTML pelo montar.ts.
  // O estado e as ações continuam no montar.ts (mt, no contexto); cada ação chama desenha(), que avisa aqui:
  // tudo() refaz a tela inteira (como o innerHTML), busca() só o painel da busca enquanto se digita.
  import { setContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  import Topo from './Topo.svelte';
  import Passos from './Passos.svelte';
  import Cores from './Cores.svelte';
  import Ideia from './Ideia.svelte';
  import Junto from './Junto.svelte';
  import Busca from './Busca.svelte';
  import Deck from './Deck.svelte';
  import Como from './Como.svelte';
  import Saida from './Saida.svelte';
  let { mt }: { mt: MontarAPI } = $props();
  // svelte-ignore state_referenced_locally
  setContext('mt', mt);
  let ver = $state(0), verBusca = $state(0);
  // svelte-ignore state_referenced_locally
  mt.ligaTela({ tudo: () => { ver++; }, busca: () => { verBusca++; } });
</script>

{#key ver}
<Topo /><Passos />
{#if mt.D().passo === 1}<Cores />
{:else if mt.D().passo === 2}<Ideia />
{:else if mt.D().passo === 3}<div class="mt-grade mt-g3"><Junto /><Deck /></div>
{:else}<div class="mt-grade">{#key verBusca}<Busca />{/key}<Deck /></div><Como /><Saida />
{/if}
{/key}
