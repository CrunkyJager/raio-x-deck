<script lang="ts">
  // Casca Svelte 5 (T43 d): a parte fixa da página (cabeçalho, abas, aba Lista, as caixas onde análise, montar e mesa
  // desenham, o rodapé e o #pop) sai do index.html e vem daqui, igual ao HTML de antes. main.ts monta esta casca
  // direto no <body> (antes dos <script>) e só depois sobe os módulos, que continuam desenhando dentro de #out, #montar…
  document.documentElement.dataset.vite = '1';
  /* ícones: só aparecem se a fonte de ícones carregou de verdade (a palavra vira um símbolo estreito); senão somem, em vez de mostrar o nome em texto */
  (function () { const b = document.body; b.classList.add('icwait'); let feito = false;
    const ok = () => { try { const c = document.createElement('canvas').getContext('2d')!; c.font = '24px "Material Symbols Rounded", monospace'; return c.measureText('insights').width < 40; } catch (e) { return false; } };
    const fim = () => { if (feito) return; feito = true; b.classList.remove('icwait'); if (!ok()) b.classList.add('noicons'); };
    if (document.fonts && document.fonts.load) { document.fonts.load('24px "Material Symbols Rounded"', 'insights').then(fim, fim); setTimeout(fim, 4000); } else fim();
    /* no celular a barra rola de lado: traz a aba aberta para a vista */
    const mostra = () => { const a = document.querySelector('#tabs a[aria-current="page"]'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' }); };
    addEventListener('hashchange', () => setTimeout(mostra, 0)); setTimeout(mostra, 300); })();
</script>

<div class="wrap">
  <header class="intro hero">
    <div class="hub" aria-hidden="true"><span class="ic">radiology</span><b>Raio-X</b><small>lê · aponta<br>você decide</small></div>
    <div class="hero-tx">
      <span class="eyebrow">Commander · Magic: The Gathering</span>
      <h1>Raio-X <span>do Deck</span></h1>
      <p>Cole qualquer deck de Commander e veja o que está bem montado, o que falta e por quê. A ferramenta não monta o deck por você: ela aponta os buracos, sugere trocas com o raciocínio de cada uma e deixa o deck jogar partidas para você conferir.</p>
    </div>
  </header>
  <nav class="tabs" id="tabs" aria-label="Telas">
    <span class="tg">Montar</span>
    <a href="#montar" style="--h:96"><span class="ic">build</span><i>00</i>Montar</a>
    <span class="tg">Análise</span>
    <a href="#lista" style="--h:44"><span class="ic">format_list_bulleted</span><i>01</i>Lista</a><a href="#resumo" style="--h:212"><span class="ic">insights</span><i>02</i>Resumo</a><a href="#trocas" style="--h:24"><span class="ic">swap_horiz</span><i>03</i>Trocas</a><a href="#funcoes" style="--h:142"><span class="ic">category</span><i>04</i>Análise</a>
    <span class="tg">Jogo</span>
    <a href="#mesa" style="--h:318"><span class="ic">casino</span><i>05</i>Mesa simulada</a><a href="#aovivo" style="--h:352"><span class="ic">playing_cards</span><i>06</i>Mesa ao vivo</a>
  </nav>
  <div class="empty" id="nodeck" hidden>Nenhum deck analisado ainda. <a href="#lista">Cole uma lista ou escolha um exemplo</a>.</div>

  <section class="panel" data-s="lista">
    <h2>Sua lista</h2>
    <p class="lead">No Moxfield: Export → copiar como texto. Também funciona com Archidekt, LigaMagic, MTGO, MTGA e listas digitadas, uma carta por linha. Se a lista não marcar o comandante, ele é adivinhado e você pode trocar depois.</p>
    <textarea id="deck-in" aria-label="Lista do deck" spellcheck="false"></textarea>
    <div class="row"><button class="btn primary" id="go">Analisar</button><span class="note">Exemplos (decks médios do EDHREC):</span><span id="examples" class="row" style="margin:0"></span></div>
    <p class="note" id="go-msg" role="status"></p>
  </section>

  <div id="montar" class="tout" data-s="montar" hidden></div>
  <div id="out"></div>
  <div id="mesa" class="tout" data-s="mesa" hidden></div>
  <div id="aovivo" class="tout" data-s="aovivo" hidden></div>
  <p class="note" style="margin-top:8px">Preços em reais: menor anúncio no <a class="fonte" href="https://mypcards.com" target="_blank" rel="noopener">MYP Cards</a> (API pública); carta sem anúncio lá usa o preço do Scryfall convertido pela cotação do dia. Dados e imagens de cartas: Scryfall. Funções e popularidade: Scryfall e EDHREC, atualizados em 15/11/2026. As faixas de referência seguem o que decks de Commander costumam usar; são ponto de partida, não lei.</p>
</div>
<div id="pop" class="pop" hidden></div>
