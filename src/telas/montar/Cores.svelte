<script lang="ts">
  // Passo 1: escolher as cores e ver quem comanda essa combinação (com tema, ordem e atalho por nome).
  // O botão "Escolher este" (data-cmd) é lido pelo ouvinte único de cliques do montar.ts.
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const { R, C, G, brl, manaHTML } = mt, a = G.acoes;
  const { P1 } = G.P();
  const l = G.listaCmds(), mostra = l.slice(0, P1.pag);
  const sel = P1.cores, sl = sel || '';
  const temas = [['', 'Todos os temas'], ...R.THEMES.map(t => [t.k, t.n]), ['tribo', 'Tribo (um tipo de criatura)']];
  const cartoes = mostra.map(x => ({ x, c: C(x.n), p: G.perfil(x.n), ia: window.PAPEIS_IA && window.PAPEIS_IA[x.n] }));
</script>

<section class="panel g-p1"><h2>Passo 1 · Cores e comandante</h2>
      <p class="lead">Não precisa saber o nome do comandante. Escolha as cores que você quer jogar e veja quem comanda essa combinação.</p>
      <div class="g-cores">{#each G.ORDEM.split('') as x}<button class="g-cor {sl.includes(x) ? 'on' : ''}" data-c1={x} aria-pressed={sl.includes(x)} title={R.COLORNAME[x]} onclick={() => a.c1(x)}><span class="ms {x}"></span><small>{R.COLORNAME[x]}</small></button>{/each}<button class="g-cor g-inc {sel === '' && P1.modo === 'exato' ? 'on' : ''}" data-c1="C" title="Sem cor" onclick={() => a.c1('C')}><span class="ms">C</span><small>Incolor</small></button></div>
      <div class="g-comb"><span class="g-comb-n">{@html G.pipsHTML(sel)} <b>{G.nomeCores(sel)}</b></span>
        <label class="g-modo"><input type="radio" name="g-modo" value="exato" defaultChecked={P1.modo === 'exato'} onchange={() => a.modo('exato')}> exatamente essas cores</label>
        <label class="g-modo"><input type="radio" name="g-modo" value="cabe" defaultChecked={P1.modo === 'cabe'} onchange={() => a.modo('cabe')}> estas cores ou menos</label></div>
      <div class="mt-filtros g-f1">
        <label class="mt-campo"><span>Tema</span><select id="g-tema" onchange={e => a.tema(e.currentTarget.value)}>{#each temas as [k, n]}<option value={k} selected={P1.tema === k}>{n}</option>{/each}</select></label>
        <label class="mt-campo"><span>Ordem</span><select id="g-ord" onchange={e => a.ord(e.currentTarget.value)}><option value="pop" selected={P1.ord === 'pop'}>Mais jogados primeiro</option><option value="preco" selected={P1.ord === 'preco'}>Mais baratos primeiro</option></select></label><span class="note mt-fonte">Preços: {@html R.fonteMyp()}</span>
        <label class="mt-campo g-busca1"><span>Já sabe o nome? (atalho)</span><input class="txt" id="g-q1" type="search" placeholder="Nome do comandante…" defaultValue={P1.txt} autocomplete="off" oninput={e => a.q1(e.currentTarget.value)}></label>
      </div>
      <p class="note">{P1.txt ? `Busca por nome: ${l.length} comandante(s), em qualquer cor.` : `${l.length.toLocaleString('pt-BR')} comandante(s) em ${G.nomeCores(sel)}${P1.modo === 'cabe' && sel ? ' ou menos cores' : ''}${sel == null ? ' (escolha as cores acima para filtrar)' : ''}${P1.tema ? ' com o tema escolhido' : ''}.`} Clique na imagem para ler a carta.</p>
      <div class="g-grade" id="g-grade">{#each cartoes as { x, c, p, ia }}<article class="g-cmd"><button class="g-img" data-card={x.n} data-img={x.n} aria-label="Ver {x.n}"><span class="note">carregando…</span></button>
        <div class="g-cmd-tx"><b>{x.n}</b><span class="g-sub"><span class="mt-mana">{@html manaHTML(c.m)}</span> <span class="note">{G.nomeCores(x.ci)}</span></span>
        {#if ia && ia.r}<p class="g-ia">{ia.r}</p>{/if}
        <div class="chips">{#if p.tribo || p.temas.length}{#if p.tribo}<span class="tag th">Tribo: {p.tribo}</span>{/if}{#each p.temas.slice(0, 3) as k}<span class="tag th">{G.temaNome(k)}</span>{/each}{:else}<span class="tag">sem tema claro</span>{/if}</div>
        <span class="g-meta"><span title="Posição entre os comandantes e cartas mais jogadas">Nº {x.r < 1e6 ? x.r.toLocaleString('pt-BR') : '—'}</span><span>{@html x.usd ? brl(x.usd, x.usd < 10) : '—'}</span></span>
        <button class="btn primary small" data-cmd={x.n}>Escolher este</button></div></article>{:else}<p class="note">Nenhum comandante com esses filtros. Tente outra combinação ou tire o tema.</p>{/each}</div>
      {#if l.length > P1.pag}<div class="row"><button class="btn" id="g-mais1" onclick={a.mais1}>Mostrar mais comandantes</button></div>{/if}
    </section>
