<script lang="ts">
  // Topo da aba Montar: qual deck, nome, novo/duplicar/apagar e importar (Moxfield, Archidekt, aba Lista).
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const S = mt.S(), d = mt.D(), a = mt.acoes;
  const ids = Object.keys(S.decks).sort((x, y) => S.decks[y].t - S.decks[x].t);
  let txt: HTMLTextAreaElement, url: HTMLInputElement;
</script>

<section class="panel mt-topo"><h2>Montar deck</h2>
    <p class="lead">Monte em quatro passos: escolha as cores e o comandante, conte a ideia do deck, monte junto com as sugestões e faça o ajuste fino. Os decks ficam salvos neste navegador; para levar ao Moxfield, use <b>Copiar para o Moxfield</b> no passo 4.</p>
    <div class="mt-decks">
      <label class="mt-campo"><span>Deck</span><select id="mt-sel" onchange={e => a.selDeck(e.currentTarget.value)}>{#each ids as id}<option value={id} selected={id === S.atual}>{S.decks[id].nome} · {mt.contar(S.decks[id])}/100</option>{/each}</select></label>
      <label class="mt-campo mt-nome"><span>Nome</span><input class="txt" id="mt-nome" defaultValue={d.nome} maxlength="60" onchange={e => a.nome(e.currentTarget.value)}></label>
      <div class="row mt-acoes"><button class="btn" id="mt-novo" onclick={a.novo}>Novo deck</button><button class="btn" id="mt-dup" onclick={a.dup}>Duplicar</button><button class="btn" id="mt-del" onclick={a.apaga}>Apagar</button></div>
    </div>
    <details class="mt-imp" id="mt-imp"><summary>Importar um deck (Moxfield, Archidekt, aba Lista)</summary>
      <div class="mt-imp-g">
        <div><h3>Do Moxfield (ou qualquer site)</h3><p class="note">No Moxfield: abra o deck → <b>More</b> → <b>Export</b> → copie o texto (Plain Text ou MTGO) e cole aqui.</p>
          <textarea id="mt-imp-txt" spellcheck="false" placeholder={'1 Sol Ring\n1 Command Tower\n…'} bind:this={txt}></textarea>
          <div class="row"><button class="btn primary" id="mt-imp-ok" onclick={() => a.impTexto(txt.value)}>Importar texto</button></div></div>
        <div><h3>Por link do Archidekt</h3><p class="note">Cole o endereço do deck (archidekt.com/decks/123456/…). O deck precisa ser público. Link do Moxfield não funciona fora do site deles: use o texto ao lado.</p>
          <input class="txt" id="mt-imp-url" placeholder="https://archidekt.com/decks/…" style="width:100%" bind:this={url}>
          <div class="row"><button class="btn" id="mt-imp-arch" onclick={() => a.impArch(url.value)}>Importar do Archidekt</button></div>
          <h3 style="margin-top:18px">Da aba Lista</h3><p class="note">Traz o deck que está na aba Lista agora.</p>
          <div class="row"><button class="btn" id="mt-imp-lista" onclick={a.impLista}>Trazer da Lista</button></div></div>
      </div>
      <p class="note" id="mt-imp-msg" role="status"></p>
    </details>
  </section>
