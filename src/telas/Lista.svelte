<script lang="ts">
  import MeusDecks from '../conta/MeusDecks.svelte';
  // Aba Lista (T43 d): primeira tela em componente. A caixa #deck-in continua sem bind (análise e montar leem e
  // escrevem .value direto); o Analisar e os exemplos chamam window.RAIOX.run, que lê a caixa como antes.
  const ex: Record<string, string> = window.EXEMPLOS || {};
  // 27/11: clique antes da análise carregar (RAIOX ainda não existe) não fazia nada; agora avisa e roda quando ela chegar
  const analisa = () => {
    if (window.RAIOX) { window.RAIOX.run(); return; }
    const m = document.getElementById('go-msg'); if (m) m.textContent = 'Carregando as cartas…';
    setTimeout(analisa, 200);
  };
  function exemplo(nome: string) {
    const caixa = document.getElementById('deck-in') as HTMLTextAreaElement;
    caixa.value = ex[nome]; analisa();
  }
</script>

<section class="panel" data-s="lista">
  <h2>Sua lista</h2>
  <p class="lead">No Moxfield: Export → copiar como texto. Também funciona com Archidekt, LigaMagic, MTGO, MTGA e listas digitadas, uma carta por linha. Se a lista não marcar o comandante, ele é adivinhado e você pode trocar depois.</p>
  <!-- a página abre sem deck: só analisa quando você cola uma lista ou escolhe um exemplo -->
  <textarea id="deck-in" aria-label="Lista do deck" spellcheck="false" placeholder="Cole aqui a lista do deck (uma carta por linha, ex.: 1 Sol Ring)."></textarea>
  <div class="row"><button class="btn primary" id="go" onclick={analisa}>Analisar</button><span class="note">Exemplos (decks médios do EDHREC):</span><span id="examples" class="row" style="margin:0">{#each Object.keys(ex) as nome}<button class="btn small" data-ex={nome} onclick={() => exemplo(nome)}>{nome}</button>{/each}</span></div>
  <p class="note" id="go-msg" role="status"></p>
  <MeusDecks {analisa} />
</section>
