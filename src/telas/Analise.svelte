<script lang="ts">
  // Tela Análise (T43 d): funções, mana e curva, plano e cortes. Era o fim do render(A) no analise.ts; entra pelo
  // mesmo gancho do Resumo (Saida.svelte, ver main.ts). A conta dos terrenos (terrenosHTML) e as
  // sugestões vêm do analise.ts pelo API, como estavam.
  import type { Analise, Carta, RaioX } from '../analise/analise';
  let { A }: { A: Analise } = $props();
  const R: RaioX = window.RAIOX;
  const listLinks = (arr: string[], max = 40) => arr.slice(0, max).map(R.cardLink).join('') + (arr.length > max ? `<span class="note"> e mais ${arr.length - max}</span>` : '');
  const ident = $derived([...A.ident] as string[]);
  const st = (r: { have: number; lo: number; hi: number }) => r.have < r.lo ? 'low' : r.have > r.hi ? 'high' : 'ok';
  const maxRef = (r: { have: number; hi: number }) => Math.max(r.hi + 4, r.have + 1);
  // curva de mana
  const W = 460, H = 170, bw = (W - 40) / 8;
  const maxC = $derived(Math.max(...A.curve, 1));
</script>

<div class="screen" data-s="funcoes">
<nav class="subnav" aria-label="Partes da análise"><a href="#funcoes" data-sub="funcoes" style="--h:142"><b>1</b>Funções</a><a href="#mana" data-sub="mana" style="--h:186"><b>2</b>Mana e curva</a><a href="#plano" data-sub="plano" style="--h:268"><b>3</b>Plano e cortes</a></nav>
<div class="sub" id="sub-funcoes" style="--h:142">
<section class="panel">
  <h2>Funções do deck</h2>
  <p class="lead">Todo deck de Commander precisa cobrir algumas funções básicas, não importa o comandante. As faixas são o que decks que funcionam costumam ter. Uma carta pode contar em mais de uma função.</p>
  <div class="refs">{#each A.refs as r}{@const s = st(r)}{@const max = maxRef(r)}<div class="ref">
    <div class="ref-h"><b>{@html r.n}</b><span class="num st-{s}">{R.fmt(r.have)}</span></div>
    <div class="gauge" role="img" aria-label="{r.n}: {R.fmt(r.have)}, faixa {r.lo} a {r.hi}"><span class="band" style="left:{100 * r.lo / max}%;width:{100 * (r.hi - r.lo) / max}%"></span><span class="mark st-{s}" style="left:{Math.min(100, 100 * r.have / max)}%"></span></div>
    <div class="note">faixa comum {r.lo}–{r.hi}</div>
    <p>{@html r.why}</p>
    {#if r.k !== 'lands' && A.byRole[r.k]}<details><summary>Cartas que contam ({A.byRole[r.k].length})</summary><div class="links">{@html listLinks(A.byRole[r.k].map(([n]) => n))}</div></details>{/if}
    {#if r.have < r.lo && r.k !== 'lands'}<details class="sug"><summary>Opções para estudar</summary><p class="note">As mais jogadas nas suas cores que você ainda não tem. Quem escolhe é você.</p><div class="links">{@html R.suggestions(A, r.k).map((c: Carta) => R.cardLink(c.name)).join('')}</div></details>{/if}
  </div>{/each}</div>
</section>
</div>
<div class="sub" id="sub-mana" style="--h:186">
<div class="grid2">
  <section class="panel"><h2>Curva de mana</h2><p class="lead">Quantas cartas (sem contar terrenos) custam 0, 1, 2… manas. Muitas cartas caras deixam os primeiros turnos vazios.</p><svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Curva de mana">{#each [0, .5, 1] as f}<line x1="34" x2={W} y1={12 + (H - 40) * (1 - f)} y2={12 + (H - 40) * (1 - f)} stroke="var(--line)"/><text x="28" y={16 + (H - 40) * (1 - f)} fill="var(--ink-3)" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">{Math.round(maxC * f)}</text>{/each}{#each A.curve as c, i}{@const h = (H - 40) * c / maxC}{@const x = 38 + i * bw}<rect x={x} y={12 + (H - 40) - h} width={bw - 8} height={Math.max(0, h)} rx="3" fill="var(--accent)"/><text x={x + (bw - 8) / 2} y={H - 12} fill="var(--ink-2)" font-size="12" text-anchor="middle" font-family="JetBrains Mono, monospace">{i === 7 ? '7+' : i}</text>{#if c}<text x={x + (bw - 8) / 2} y={8 + (H - 40) - h} fill="var(--ink)" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">{c}</text>{/if}{/each}</svg></section>
  <section class="panel"><h2>Base de mana</h2><p class="lead">Fontes de cada cor (terrenos, pedras e criaturas de mana) contra o quanto as suas cartas pedem daquela cor. A linha clara marca o recomendado.</p>{#each ident as x}{@const need = A.colorNeed[x]}{@const have = A.sources[x]}{@const max = Math.max(need, have, 20)}<div class="crow"><span class="ms {x}"></span><span>{R.COLORNAME[x]}</span><span class="track"><span class="fill {have < need ? 'short' : ''}" style="width:{100 * have / max}%"></span><span class="need" style="left:{100 * need / max}%"></span></span><span class="num">{have}/{need}</span><span class="note num">{A.pips[x].toFixed(0)} símbolos</span></div>{:else}<p class="note">Deck incolor.</p>{/each}<p class="note" style="margin-top:8px">{A.tapped} terreno(s) sempre entram virados.</p></section>
</div>
{@html R.terrenosHTML(A)}
</div>
<div class="sub" id="sub-plano" style="--h:268">
<section class="panel">
  <h2>Plano de jogo</h2>
  <p class="lead">Os temas que mais aparecem nas cartas. Um deck forte tem 1 ou 2 temas claros e quase todas as cartas puxando para eles.{#if A.tribe}{' '}Tribo principal: <b>{A.tribe[0]}</b> ({A.tribe[1]} criaturas).{/if}</p>
  <div class="themes">{#each A.themes.slice(0, 6) as t}<div class="theme"><div class="theme-h"><b>{@html t.n}</b>{#if t.cmd}<span class="tag cmd">o comandante pede</span>{/if}<span class="num">{t.cards.length}</span></div><div class="links">{@html listLinks(t.cards, 24)}</div></div>{:else}<p class="note">Nenhum tema forte apareceu. O deck pode ser uma pilha de cartas boas sem um plano em comum, o que costuma ser mais fraco que um deck focado.</p>{/each}</div>
</section>
<div class="grid2">
  <section class="panel"><h2>Cartas sem papel claro</h2><p class="lead">Todas as cartas são lidas: pelas etiquetas da comunidade, pelas regras de texto e, nas que sobram, pela leitura do texto da carta. Aqui ficam as que não têm função nem conversam com os temas do deck. Clique para ver o que cada uma faz e decida.</p>{#if A.noRole.length}<div class="links">{@html listLinks(A.noRole)}</div>{:else}<p class="note">Nenhuma. Todas as cartas têm alguma função ou tema.</p>{/if}{#if A.bodyOnly.length}<h3 style="margin-top:12px">Só corpo</h3><p class="note">Criaturas sem habilidade que importe para o plano. Às vezes valem pelo tipo (tribo, artefato); senão, são as primeiras candidatas a corte.</p><div class="links">{@html listLinks(A.bodyOnly)}</div>{/if}</section>
  <section class="panel"><h2>Pouco jogadas</h2><p class="lead">Cartas que quase ninguém usa no Commander. Às vezes são achados; muitas vezes existe opção melhor para a mesma função.</p>{#if A.obscure.length}<div class="links">{@html listLinks(A.obscure)}</div>{:else}<p class="note">Nenhuma.</p>{/if}{#if A.pricey.length}<p class="note" style="margin-top:10px">Mais caras: {@html A.pricey.map((c: Carta) => `${R.esc(c.name)} (${R.brl(c.usd)})`).join(', ')}. {@html R.fontePrecos(A.pricey.map((c: Carta) => c.name))}.</p>{/if}</section>
</div>
</div>
</div>
