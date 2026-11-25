<script lang="ts">
  // Passo 4 (e escolha do comandante pela busca): busca na base, filtros, básicos e a lista de resultados.
  // Os botões data-add/data-cmd são lidos pelo ouvinte único de cliques do montar.ts.
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const { R, C, ROLES, TIPOS, brl, manaHTML } = mt, a = mt.acoes;
  const d = mt.D(), Q = mt.Q(), I = mt.ident(), r = mt.busca();
  const cores = [...I];
  const titulo = r.modoCmd ? (d.cmds.length ? 'Segundo comandante (parceiro ou antecedente)' : '1. Escolha o comandante') : 'Buscar cartas';
  const papeisFiltro = ROLES.filter(x => x.k !== 'body' && x.k !== 'enabler');
  const BAS: Record<string, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest', C: 'Wastes' };
  const linhas = r.lista.map(x => {
    const c = C(x.n), q = d.cartas[x.n] || 0;
    const ps = r.modoCmd ? [] : [...mt.papeis(x.n)].filter(k => k !== 'body' && k !== 'enabler').slice(0, 2).map(k => (ROLES.find(o => o.k === k) || <{ n?: string }>{}).n).filter(Boolean);
    return { n: x.n, c, q, ps, bloq: !r.modoCmd && q && !mt.multiOk(c) };
  });
</script>

<section class="panel mt-busca"><h2>{titulo}</h2>
    {#if d.cmds.length && !Q.cmd}<p class="note">Só aparecem cartas dentro da identidade de cor do comandante e fora da lista de banidas. Clique no nome para ver a carta.</p>{:else}<p class="note">{d.cmds.length ? 'Só comandantes que aceitam parceiro.' : 'O comandante trava as cores do deck: depois só aparecem cartas que cabem nele.'} Busque em inglês{Object.keys(R.PTIDX || {}).length ? ' ou português' : ''}.</p>{/if}
    <input class="txt mt-q" id="mt-q" type="search" placeholder={r.modoCmd ? 'Nome do comandante…' : 'Nome da carta…'} defaultValue={Q.txt} autocomplete="off" oninput={e => a.buscaTxt(e.currentTarget.value)}>
    {#if !r.modoCmd}<div class="mt-filtros">
      <select id="mt-tipo" aria-label="Tipo" onchange={e => a.filtro('tipo', e.currentTarget.value)}>{#each TIPOS as [k, n]}<option value={k} selected={Q.tipo === k}>{n}</option>{/each}</select>
      <select id="mt-papel" aria-label="Função" onchange={e => a.filtro('papel', e.currentTarget.value)}><option value="">Todas as funções</option>{#each papeisFiltro as x}<option value={x.k} selected={Q.papel === x.k}>{x.n}</option>{/each}</select>
      <select id="mt-cmc" aria-label="Custo" onchange={e => a.filtro('cmc', e.currentTarget.value)}><option value="">Qualquer custo</option>{#each [0, 1, 2, 3, 4, 5, 6, 7] as v}<option value={String(v)} selected={Q.cmc === String(v)}>Custo {v}{v === 7 ? '+' : ''}</option>{/each}</select>
      <span class="mt-cores">{#each ['', ...cores, 'C'] as x}<button class="mt-cor {Q.cor === x ? 'on' : ''}" data-cor={x} title={x === '' ? 'Todas as cores' : x === 'C' ? 'Incolor' : 'Tem ' + x} onclick={() => a.cor(x)}>{#if x === ''}todas{:else if x === 'C'}<span class="ms">C</span>{:else}<span class="ms {x}"></span>{/if}</button>{/each}</span>
    </div><div class="mt-bas"><span class="note">Terrenos básicos:</span>{#each (cores.length ? cores : ['C']) as x}<button class="btn small" data-add={BAS[x]}><span class="ms {x === 'C' ? '' : x}">{x === 'C' ? 'C' : ''}</span> +1 {BAS[x]}{d.cartas[BAS[x]] ? ` (${d.cartas[BAS[x]]})` : ''}</button>{/each}</div>{/if}
    <div class="mt-lista" id="mt-lista">{#each linhas as x}<div class="mt-res {x.q ? 'tem' : ''}"><span class="mt-mana">{@html manaHTML(x.c.m)}</span><span class="mt-rn"><button class="cn" data-card={x.n}>{x.n}</button><small>{x.c.t.split(' // ')[0]}{x.ps.length ? ' · ' + x.ps.join(', ') : ''}{#if x.c.gc}{' · '}<b class="mt-gc">game changer</b>{/if}</small></span><span class="mt-pr">{@html x.c.usd ? brl(x.c.usd, x.c.usd < 10) : '—'}</span>
      {#if r.modoCmd}<button class="btn small primary" data-cmd={x.n}>Escolher</button>{:else}<button class="btn small {x.bloq ? '' : 'primary'}" data-add={x.n} disabled={!!x.bloq} title={x.bloq ? 'Já está no deck (só 1 de cada)' : undefined}>{x.q ? (x.bloq ? 'no deck' : '+1 (' + x.q + ')') : '+ pôr'}</button>{/if}</div>{:else}<p class="note">Nada encontrado com esses filtros.</p>{/each}</div>
    {#if r.mais}<div class="row"><button class="btn" id="mt-mais" onclick={a.mais}>Mostrar mais</button></div>{/if}
    {#if Q.cmd}<div class="row"><button class="btn" id="mt-cmd-x" onclick={a.cmdX}>Voltar para as cartas</button></div>{/if}
  </section>
