<script lang="ts">
  // Casca Svelte 5 (T43 a): não desenha nada ainda; marca a página como servida pelo build do Vite.
  $effect(() => { document.documentElement.dataset.vite = '1'; });
</script>
