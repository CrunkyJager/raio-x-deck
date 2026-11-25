<script lang="ts">
  // Passo 3: montar junto. O trilho das funções (metas e quanto o deck já tem) e as sugestões da etapa da vez;
  // as contas ficam no montar.ts (G.junto()).
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const { R, G, brl, manaHTML } = mt, a = G.acoes;
  const { P3 } = G.P();
  const J = G.junto(), E = J.E, k = J.k;
  const trilho = E.slots.map(x => ({ x, pct: Math.min(100, 100 * x.tem / Math.max(1, x.alvo)), ok: x.tem >= x.alvo }));
  const nRec = Object.keys(E.d.recusadas).length;
  const nTodas = J.sugs ? Math.min(J.sugs.length, J.falta || J.sugs.length) : 0;
</script>

<section class="panel g-p3"><h2>Passo 3 · Montar junto</h2>
      <p class="lead">O esqueleto de um deck de Commander, etapa por etapa. Aceite ou recuse cada sugestão; clique numa etapa do trilho para pular para ela.</p>
      <div class="g-trilho">{#each trilho as { x, pct, ok }}<button class="g-slot {ok ? 'ok' : ''} {x.k === k ? 'on' : ''}" data-slot={x.k} title="{x.n}: {x.tem} de {x.alvo}" onclick={() => a.slot(x.k)}><span class="g-slot-n">{x.n}</span><span class="g-slot-v"><b>{x.tem}</b>/{x.alvo}{ok ? ' ✓' : ''}</span><span class="g-slot-b"><i style="width:{pct}%"></i></span></button>{/each}</div>
      {#if !k}<div class="g-fim"><h3>O deck chegou a {E.total} cartas.</h3><p>{E.total > 100 ? `Passou ${E.total - 100}: no ajuste fino dá para ver o que tirar.` : 'Esqueleto completo. Agora é o ajuste fino: ver a análise, trocar uma ou outra carta e levar para o Moxfield ou para a mesa.'}</p><div class="row"><button class="btn primary" data-passo="4" onclick={() => a.passo(4)}>Ir para o ajuste fino →</button></div></div>
      {:else}{@const slot = J.slot!}{@const falta = J.falta!}<div class="g-prox"><span class="g-rot">{k === J.auto ? 'Próximo passo' : 'Você escolheu'}</span>
        <h3>{slot.n}{J.extra ? `: ainda cabem ${falta} mágica${falta > 1 ? 's' : ''}` : slot.alvo ? `: ${falta ? `faltam ${falta} de ${slot.alvo}` : `já tem ${slot.tem} (o normal é ${slot.alvo})`}` : ''}</h3>
        {#if J.extra}<p class="note">O esqueleto de funções já está completo; as vagas que sobram (100 menos os {E.landsT} terrenos) vão para {E.on.size ? 'mais cartas da ideia' : 'as cartas mais jogadas nas suas cores'}.</p>{/if}
        <p class="note">Por que importa: {slot.why}. Sugestões nas cores do comandante{E.edh ? `, pela sinergia com a sua ideia (no EDHREC: quanto a carta aparece nos decks do${E.edh.pags.length > 1 ? 's temas escolhidos' : ' tema escolhido'} nessas cores a mais que nos decks dessas cores em geral)` : E.on.size ? ', pela popularidade geral' : ', pela popularidade geral (escolha temas no passo 2 para puxar para a ideia)'}{E.on.size && k !== 'lands' ? ', puxando para a ideia' : ''}{J.filtros!.length ? ', dentro de ' + J.filtros!.join(', ') : ''}.</p>
        {#if J.bas!.length}<div class="g-bas"><span>Completar com básicos pela cor das cartas: <b>{J.bas!.map(([n, q]) => q + ' ' + n).join(', ')}</b></span><button class="btn small primary" id="g-bas" onclick={a.bas}>Pôr os {J.bas!.reduce((s, [, q]) => s + q, 0)} básicos</button></div><p class="note">Ou escolha terrenos especiais abaixo antes (eles dão mais de uma cor).</p>{/if}
        <div class="g-sugs">{#each J.sugs! as s}<article class="g-sug"><button class="g-img g-img-s" data-card={s.c.name} data-img={s.c.name}><span class="note">…</span></button>
          <div class="g-sug-tx"><div class="g-sug-h"><b>{s.c.name}</b><span class="mt-mana">{@html manaHTML(s.c.m)}</span></div>
          <span class="note">{s.c.t.split(' // ')[0]} · {#if s.c.usd}{@html brl(s.c.usd, s.c.usd < 10)}{R.temMyp(s.c.name) ? ' no ' : ' (Scryfall convertido)'}{#if R.temMyp(s.c.name)}{@html R.fonteMyp()}{/if}{:else}sem preço{/if}{#if s.c.gc}{' · '}<b class="mt-gc">game changer</b>{/if}</span>
          {#if s.ia && s.ia.r}<p class="g-ia">{s.ia.r}</p>{/if}
          <ul class="g-pq">{#each s.pq as t}<li>{t}</li>{/each}</ul>
          <div class="row"><button class="btn primary small" data-aceita={s.c.name} onclick={() => a.aceita(s.c.name)}>Pôr no deck</button><button class="btn small" data-nao={s.c.name} onclick={() => a.nao(s.c.name)}>Agora não</button></div></div></article>{:else}<p class="note">Nenhuma sugestão cabe nos filtros (bracket, orçamento, cartas recusadas). Escolha outra etapa no trilho acima, mude o orçamento no passo 2 ou busque livre no passo 4.</p>{/each}</div>
        <div class="row">{#if J.sugs!.length}<button class="btn" id="g-todas" onclick={() => a.todas(J.sugs!.map(s => s.c.name))}>Pôr {nTodas === 1 ? 'a primeira' : 'as ' + nTodas + ' primeiras'}</button>{/if}<button class="btn" id="g-mais3" onclick={a.mais3}>Ver mais sugestões</button>{#if nRec}<button class="btn" id="g-desrec" onclick={a.desrec}>Rever as {nRec} recusadas</button>{/if}{#if P3.slot}<button class="btn" id="g-auto" onclick={a.auto}>Seguir a ordem sugerida</button>{/if}</div>
      </div>{/if}
      <div class="row g-nav"><button class="btn" data-passo="2" onclick={() => a.passo(2)}>← A ideia</button><button class="btn" data-passo="4" onclick={() => a.passo(4)}>Ajuste fino →</button></div>
    </section>
