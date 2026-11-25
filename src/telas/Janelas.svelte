<script lang="ts">
  // Janelas da análise (T43 d, item 2): a prévia ao passar o mouse (#hov), o detalhe da carta ao clicar (#pop) e a
  // carta ampliada (#zoom). Antes eram innerHTML soltos no fim do analise.ts; agora o estado fica aqui e o HTML
  // sai do template. Os ganchos continuam no document (delegação), na mesma ordem e fase de antes: o clique que
  // fecha a prévia e o do zoom vão na captura, o do detalhe na subida. O analise.ts avisa a troca de aba pelo
  // evento raiox:tela, que fecha o detalhe. main.ts monta isto no fim do <body>, depois que o window.RAIOX sobe.
  import { onMount, flushSync } from 'svelte';
  import type { Carta, RaioX } from '../analise/analise';
  const R: RaioX = window.RAIOX;
  const ia = (c: Carta | null) => (c && window.PAPEIS_IA && window.PAPEIS_IA[c.name]) || null;
  // imagem: undefined = carregando, null = não veio
  type Img = string | null | undefined;

  // ---------- prévia ao passar o mouse nas outras opções ----------
  const ALVO = '[data-altin],[data-altout],.cn[data-card]';
  let hov = $state.raw<{ c: Carta; dica: string; left: number; top: number } | null>(null);
  let hovAberta = $state(false), hovImg = $state<Img>(undefined), hovErro = $state(false);
  let HOVT: ReturnType<typeof setTimeout> | undefined;
  function hovSobre(e: any) {
    const b = e.target.closest && e.target.closest(ALVO); if (!b || b.closest('#pop')) return;
    clearTimeout(HOVT);
    HOVT = setTimeout(() => {
      const c = R.C(b.dataset.n || b.dataset.card); if (!c) return;
      const r = b.getBoundingClientRect(), w = 360, below = r.bottom + 8, hgt = 210;
      hov = { c, dica: b.dataset.altin != null ? 'Clique para colocar esta no lugar.' : b.dataset.altout != null ? 'Clique para tirar esta no lugar.' : 'Clique para ver os detalhes.',
        left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)), top: below + hgt < window.innerHeight ? below : Math.max(8, r.top - hgt - 8) };
      hovImg = undefined; hovErro = false; hovAberta = true;
      R.imgFor(c.name).then(src => { if (hov && hov.c === c) hovImg = src; });
    }, 120);
  }
  function hovSai(e: any) { const b = e.target.closest && e.target.closest(ALVO); if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return; clearTimeout(HOVT); hovAberta = false; }
  function hovFecha() { clearTimeout(HOVT); hovAberta = false; }

  // ---------- detalhe da carta ----------
  let pop = $state.raw<{ c: Carta; roles: string[]; th: string[]; left: number; top: number } | null>(null);
  let popAberta = $state(false), popImg = $state<Img>(undefined), popErro = $state(false);
  function popClique(e: any) {
    const b = e.target.closest('[data-card]');
    if (!b) { if (!e.target.closest('#pop')) popAberta = false; return; }
    const c = R.C(b.dataset.card); if (!c) return;
    const L = R.last;
    const r = b.getBoundingClientRect(), pw = Math.min(620, window.innerWidth - 32);
    pop = { c, roles: [...R.rolesOf(c)].map(k => R.ROLES.find(x => x.k === k)!.n), th: [...R.themesOf(c, L && L.cmdThemes)].map(k => R.THEMES.find(t => t.k === k)!.n),
      left: Math.max(16, Math.min(window.innerWidth - pw - 16, r.left)), top: Math.max(16, Math.min(window.innerHeight - 320, r.bottom + 8)) };
    popImg = undefined; popErro = false; popAberta = true;
    R.imgFor(c.name).then(src => { if (pop && pop.c === c && popAberta) popImg = src; });
  }

  // ---------- ampliar a carta: clique em qualquer imagem ----------
  let zoom = $state.raw<{ nome: string; src: string | null; c: Carta | null } | null>(null);
  let zoomAberta = $state(false), zoomErro = $state(false);
  let fechaZoom: HTMLButtonElement | undefined = $state();
  function zoomClique(e: any) {
    if (zoomAberta) { if (e.target.closest('.zoom-x') || !e.target.closest('.zoom-box')) zoomAberta = false; e.stopPropagation(); return; }
    const img = e.target.closest('.cimg img, .pimg img');
    if (!img) return;
    e.stopPropagation(); e.preventDefault();
    const holder = img.closest('[data-swimg],[data-img]');
    const nome = holder ? (holder.dataset.swimg || holder.dataset.img) : img.alt;
    zoom = { nome, src: R.SCRY(nome, 'large'), c: R.C(nome) }; zoomErro = false; zoomAberta = true;
    flushSync(); fechaZoom?.focus();
  }
  function zoomTecla(e: KeyboardEvent) { if (e.key === 'Escape' && zoomAberta) zoomAberta = false; }

  onMount(() => {
    // mesma ordem de registro de antes (prévia, detalhe, zoom, Esc)
    const L: [string, (e: any) => void, boolean][] = [['mouseover', hovSobre, false], ['mouseout', hovSai, false], ['click', hovFecha, true], ['click', popClique, false], ['click', zoomClique, true], ['keydown', zoomTecla, false]];
    L.forEach(([t, f, cap]) => document.addEventListener(t, f, cap));
    const aba = () => { popAberta = false; };
    document.addEventListener('raiox:tela', aba);
    return () => { L.forEach(([t, f, cap]) => document.removeEventListener(t, f, cap)); document.removeEventListener('raiox:tela', aba); };
  });
</script>

<!-- imagem que não carrega: o mesmo <span class="noimg"> que o gancho de erro do analise.ts põe nas outras telas -->
{#snippet foto(src: string, alt: string, erro: boolean, falhou: () => void)}{#if erro}<span class="noimg">{alt || 'sem imagem'}</span>{:else}<img {src} {alt} onerror={falhou}>{/if}{/snippet}

<div id="hov" class="hov" hidden={!hovAberta} style:left={hov ? hov.left + 'px' : null} style:top={hov ? hov.top + 'px' : null}>
  {#if hov}{@const i = ia(hov.c)}{@const roles = R.roleNames(hov.c)}
    <div class="hov-img" data-hovimg={hov.c.name}>{#if hovImg === undefined}<span class="note">…</span>{:else if hovImg}{@render foto(hovImg, '', hovErro, () => (hovErro = true))}{:else}<span class="note">sem imagem</span>{/if}</div><div><b>{hov.c.name}</b><div style="margin:2px 0 4px">{@html R.manaHTML(hov.c.m)} <span class="note">{hov.c.t}</span></div>{#if i && i.r}<p class="note" style="margin:0 0 4px">{i.r}</p>{:else}<p class="note hov-o" style="margin:0 0 4px">{hov.c.o.split('\n//\n')[0].slice(0, 260)}{hov.c.o.length > 260 ? '…' : ''}</p>{/if}<div class="chips">{#each roles.slice(0, 3) as r}<span class="tag">{r}</span>{/each}</div><p class="note" style="margin:6px 0 0">{hov.dica}</p></div>
  {/if}
</div>

<div id="pop" class="pop" hidden={!popAberta} style:left={pop ? pop.left + 'px' : null} style:top={pop ? pop.top + 'px' : null}>
  {#if pop}{@const c = pop.c}{@const i = ia(c)}
    <div class="pimg" id="pimg">{#if popImg === undefined}<span class="note">carregando imagem…</span>{:else if popImg}{@render foto(popImg, c.name, popErro, () => (popErro = true))}{:else}<span class="note">Não deu para carregar a imagem.</span>{/if}</div><div class="ptxt"><h3>{c.name}</h3><div>{@html R.manaHTML(c.m)} <span class="note">{c.t}</span></div><div class="oracle">{c.o}</div>{#if i && i.r}<p class="note"><b>O que faz:</b> {i.r}</p>{/if}
      <div class="chips">{#each pop.roles as r}<span class="tag">{r}</span>{/each}{#each pop.th as t}<span class="tag th">{t}</span>{/each}{#if c.gc}<span class="tag cmd">game changer</span>{/if}</div>
      <p class="note">{c.r ? `Nº ${c.r.toLocaleString('pt-BR')} entre as mais jogadas no Commander` : 'Quase não aparece em decks de Commander'}{#if c.usd}{' '}· {@html R.brl(c.usd, 1)} {#if R.temMyp(c.name)}no {@html R.fonteMyp()}{:else}(Scryfall convertido){/if}{/if}</p></div>
  {/if}
</div>

<div id="zoom" class="zoom" role="dialog" aria-modal="true" hidden={!zoomAberta}>
  {#if zoom}{@const c = zoom.c}{@const i = ia(c)}
    <div class="zoom-box"><button class="btn small zoom-x" aria-label="Fechar" bind:this={fechaZoom}>Fechar ✕</button>
      <div class="zoom-img">{#if zoom.src}{@render foto(zoom.src, zoom.nome, zoomErro, () => (zoomErro = true))}{:else}<span class="note">sem imagem</span>{/if}</div>
      {#if c}<div class="zoom-txt"><h3>{c.name}</h3><div>{@html R.manaHTML(c.m)} <span class="note">{c.t}</span></div><div class="oracle zoom-oracle">{c.o}</div>{#if c.p}<p class="note">Força/resistência: {c.p}</p>{/if}{#if i && i.r}<p><b>O que faz:</b> {i.r}</p>{/if}</div>{/if}</div>
  {/if}
</div>
