<script lang="ts">
  // Trilho dos quatro passos da montagem guiada.
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const d = mt.D(), tem = d.cmds.length > 0;
</script>

<nav class="g-passos" aria-label="Passos da montagem">{#each mt.G.PASSOS as [n, t], i}{#if i}<i class="g-seta" aria-hidden="true"></i>{/if}<button class="g-passo {d.passo === n ? 'on' : ''} {d.passo > n ? 'feito' : ''}" data-passo={n} disabled={n > 1 && !tem} title={n > 1 && !tem ? 'Escolha o comandante primeiro' : undefined} aria-current={d.passo === n ? 'step' : 'false'} onclick={() => mt.G.acoes.passo(n)}><b>{n}</b><span>{t}</span></button>{/each}</nav>
