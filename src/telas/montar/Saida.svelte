<script lang="ts">
  // Passo 4: levar o deck (Moxfield, .txt, análise completa, Mesa).
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const a = mt.acoes;
</script>

{#if mt.D().cmds.length}<section class="panel mt-saida"><h2>Levar o deck</h2>
    <div class="mt-sai-g">
      <div><h3>Moxfield</h3><p class="note">Copia a lista no formato que o Moxfield importa (comandante em cima). Lá: <b>Create Deck</b> → <b>Import</b> → colar.</p>
        <div class="row"><button class="btn primary" id="mt-copia" onclick={a.copia}>Copiar para o Moxfield</button><a class="btn" href="https://moxfield.com/decks/personal" target="_blank" rel="noopener">Abrir o Moxfield</a><button class="btn" id="mt-baixa" onclick={a.baixa}>Baixar .txt</button></div></div>
      <div><h3>Aqui no Raio-X</h3><p class="note">Manda o deck para a análise completa (trocas sugeridas, plano) ou para a mesa, como deck de amigo.</p>
        <div class="row"><button class="btn primary" id="mt-analisa" onclick={a.analisar}>Analisar no Raio-X</button><button class="btn" id="mt-mesa" onclick={a.mesa}>Jogar na Mesa</button></div></div>
    </div>
    <p class="note" id="mt-msg" role="status"></p>
  </section>{/if}
