<script lang="ts">
  // O deck em montagem: contador, comandantes e as cartas por tipo (passos 3 e 4).
  // Os botões −/+/✕ (data-sub/data-add/data-uncmd) são lidos pelo ouvinte único de cliques do montar.ts.
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  import type { Carta } from '../../analise/analise';
  const mt: MontarAPI = getContext('mt');
  const { C, brl, manaHTML } = mt, a = mt.acoes;
  const d = mt.D(), n = mt.total();
  const grupos: Record<string, [Carta, number][]> = {};
  for (const [nm, q] of Object.entries(d.cartas)) { const c = C(nm); if (!c) continue; (grupos[mt.grupoDe(c)] = grupos[mt.grupoDe(c)] || []).push([c, q]); }
  const gs = mt.GRUPOS.filter(([k]) => grupos[k]).map(([k, nome]) => ({ nome, g: grupos[k].sort((x, y) => x[0].v - y[0].v || x[0].name.localeCompare(y[0].name)) }));
  const cor = n === 100 ? 'ok' : n > 100 ? 'mais' : '';
</script>

{#if !d.cmds.length}<section class="panel mt-deck"><h2>O deck</h2><p class="note">Escolha o comandante ao lado para começar. Ou importe um deck pronto em <b>Importar um deck</b>, acima.</p></section>
{:else}<section class="panel mt-deck"><h2>O deck</h2>
    <div class="mt-cont {cor}"><b>{n}</b><span>/100 cartas</span><div class="prog"><div style="width:{Math.min(100, n)}%"></div></div><small>{n === 100 ? 'Completo.' : n < 100 ? `Faltam ${100 - n}.` : `Sobram ${n - 100}: tire ${n - 100}.`}</small></div>
    <div class="mt-cmds"><span class="k">Comandante{d.cmds.length > 1 ? 's' : ''}</span>{#each d.cmds as x}<div class="mt-li mt-cmd"><span class="mt-mana">{@html manaHTML(C(x).m)}</span><button class="cn" data-card={x}>{x}</button><span class="mt-bt"><button class="mt-mm" data-uncmd={x} aria-label="Trocar comandante">✕</button></span></div>{/each}
      {#if d.cmds.length === 1 && mt.temPar(C(d.cmds[0]))}<button class="btn small" id="mt-cmd2" onclick={a.cmd2}>+ segundo comandante</button>{/if}</div>
    {#each gs as { nome, g }}<div class="mt-g"><h3>{nome} <span class="note">{g.reduce((s, [, q]) => s + q, 0)}</span></h3>{#each g as [c, q]}<div class="mt-li"><span class="mt-q2">{q}</span><span class="mt-mana">{@html manaHTML(c.m)}</span><button class="cn" data-card={c.name}>{c.name}</button><span class="mt-pr">{@html c.usd ? brl(c.usd * q, c.usd * q < 10) : ''}</span><span class="mt-bt"><button class="mt-mm" data-sub={c.name} aria-label="Tirar uma">−</button>{#if mt.multiOk(c)}<button class="mt-mm" data-add={c.name} aria-label="Pôr mais uma">+</button>{/if}</span></div>{/each}</div>{/each}
    <div class="row mt-fim">{#if n > d.cmds.length}<button class="btn small" id="mt-limpa" onclick={a.limpa}>Esvaziar o deck</button>{/if}</div>
  </section>
{/if}
