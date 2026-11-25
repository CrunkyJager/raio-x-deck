<script lang="ts">
  // Tela Resumo (T43 d): era o primeiro pedaço do render(A) no analise.ts. O analise.ts continua sem import
  // (o ferramentas/gabarito/mede.js roda ele no node): ele deixa a caixa vazia e chama window.RAIOX_TELAS.resumo,
  // que o main.ts liga a este componente. Os cliques (#cmd-pick, #ask-all, nomes de carta) seguem no wire(A).
  import type { Analise, Carta, RaioX } from '../analise/analise';
  let { A }: { A: Analise } = $props();
  const R: RaioX = window.RAIOX;
  const listLinks = (arr: string[], max = 40) => arr.slice(0, max).map(R.cardLink).join('') + (arr.length > max ? `<span class="note"> e mais ${arr.length - max}</span>` : '');
  const sevName = ['', 'ajuste', 'importante', 'regra'];
  const BRACKET: Record<number, string> = { 2: 'Bracket 2 (núcleo): o nível de um deck pré-montado bem ajustado.', 3: 'Bracket 3 (melhorado): cartas fortes, mas sem combos rápidos nem trava de terrenos.', 4: 'Bracket 4 (otimizado): sem restrições, pensado para ganhar rápido.' };
  const cmdNames = $derived(A.cmds.map((c: Carta) => c.name));
  const ident = $derived([...A.ident] as string[]);
  const pri = $derived(A.issues.slice(0, 3));
  const nonlandU = $derived(A.uniq.filter((c: Carta) => !R.isLand(c)).length || 1);
  const depPct = $derived(Math.round(100 * A.cmdSupport.length / nonlandU));
</script>

<div class="screen" data-s="resumo">
<section class="head panel">
  <div class="who"><div class="cmdname">{cmdNames.join(' + ') || 'Comandante não encontrado'}</div><div class="ident">{#each ident as x}<span class="ms {x}"></span>{:else}<span class="ms">C</span>{/each}</div>
    <div class="stats">
      <div class="stat price"><span class="k">Preço do deck</span><b>{@html R.brl(A.price)}</b>{#if A.pricey && A.pricey.length}<small>Mais caras: {@html A.pricey.slice(0, 3).map((c: Carta) => `${R.esc(c.name)} (${R.brl(c.usd)})`).join(' · ')}</small>{/if}<small class="cot">{@html R.fontePrecos(A.uniq.concat(A.cmds).map((c: Carta) => c.name))}</small></div>
      <div class="stat"><span class="k">Cartas</span><b>{A.total}</b></div>
      <div class="stat"><span class="k">Custo médio</span><b>{A.avgMV.toFixed(2)}</b></div>
      <div class="stat"><span class="k">Terrenos</span><b>{A.lands}</b>{#if A.mdfc}<small>+ {A.mdfc} de duas faces</small>{/if}</div>
    </div>
    {#if A.legendCandidates.length > 1}<label class="field">Trocar comandante <select id="cmd-pick">{#each A.legendCandidates as n}<option selected={cmdNames.includes(n)}>{n}</option>{/each}</select></label>{/if}</div>
  <div class="verdict v-{A.verdict.k}">{@html A.verdict.t}</div>
  {#if A.unknown.length}<p class="note">Não reconheci {A.unknown.length} linha(s): {A.unknown.slice(0, 6).join(', ')}{A.unknown.length > 6 ? '…' : ''}. Confira a grafia em inglês.</p>{/if}
</section>
<section class="panel">
  <h2>O que melhorar primeiro</h2>
  {#if pri.length}<ol class="pri">{#each pri as i}<li><span class="sev s{i.sev}">{sevName[i.sev]}</span> <span class="area">{@html i.area}</span> {i.t}</li>{/each}</ol>{:else}<p>Nada urgente. Os detalhes abaixo mostram onde ainda dá para afinar.</p>{/if}
  {#if A.issues.length > 3}<details><summary>Outros pontos ({A.issues.length - 3})</summary><ul class="pri">{#each A.issues.slice(3) as i}<li><span class="sev s{i.sev}">{sevName[i.sev]}</span> <span class="area">{@html i.area}</span> {i.t}</li>{/each}</ul></details>{/if}
  <div class="ask"><button class="btn" data-claude hidden id="ask-all">Pedir a leitura do Claude</button><div class="ai-ans" id="ans-all" hidden></div></div>
  <div class="row"><a class="btn primary" href="#trocas">Ver as trocas sugeridas, carta por carta</a></div>
</section>
<div class="grid2">
  <section class="panel"><h2>Quanto o deck depende do comandante</h2>
    <div class="big num">{depPct}%</div>
    <p>{A.cmdSupport.length} das {nonlandU} cartas que não são terreno puxam para o mesmo tema do comandante. {depPct >= 60 ? 'O deck é construído em volta dele: se ele cair, boa parte das cartas perde força. Proteção e um plano B importam muito.' : depPct >= 35 ? 'Equilibrado: o comandante ajuda, mas o deck tem jogo sem ele.' : 'O deck joga sozinho; o comandante é um bônus. Vale treinar a ganhar sem ele na mesa.'}</p>
    {#if A.voltronCards.length}<p class="note">{A.voltronCards.length} auras e equipamentos: cartas que pedem uma criatura para carregar.</p>{/if}
    <details><summary>Cartas que funcionam sem ele ({A.standalone.length})</summary><div class="links">{@html listLinks(A.standalone)}</div></details>
  </section>
  <section class="panel"><h2>Nível de poder</h2>
    <div class="big num">Bracket {A.bracket}</div><p>{BRACKET[A.bracket]}</p>
    {#if A.bracketWhy.length}<p class="note">Por causa de: {@html A.bracketWhy.join('; ')}.</p>{:else}<p class="note">Nenhuma carta da lista oficial de "game changers", sem turnos extras em série e sem destruição de terrenos em massa.</p>{/if}
    {#if A.gc.length}<div class="links">{@html listLinks(A.gc)}</div>{/if}
    <p class="note">Estimativa pela lista. Combos de 2 cartas não são detectados; se o deck tiver um, o nível sobe.</p>
  </section>
</div>
</div>
