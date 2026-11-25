<script lang="ts">
  // Tela Trocas (T43 d): a ideia do deck (renderConcept/wireConcept) e as trocas sugeridas (renderSwaps/wireSwaps)
  // do analise.ts, pelo mesmo gancho das outras telas (window.RAIOX_TELAS.trocas, ver main.ts). O estado das trocas
  // e a ideia continuam no analise.ts (R.trocas), porque o buildSwaps, o newList e a Mesa leem de lá; os pedaços
  // de HTML de dentro de cada troca (cartas, números, porquês) também vêm de lá, como o terrenosHTML na Análise.
  // Refaz tudo quando o analise.ts avisa (raiox:trocas: o EDHREC chegou) ou quando a Mesa termina um teste
  // (raiox:teste: só os números e o resumo).
  import { onMount, untrack } from 'svelte';
  import type { Analise, Carta, RaioX, Troca } from '../analise/analise';
  let { A }: { A: Analise } = $props();
  const R: RaioX = window.RAIOX;
  const T = R.trocas;
  const cmdNames = () => A.cmds.map((c: Carta) => c.name);

  let ver = $state(0);                                   // muda: a tela inteira é refeita (como o rerenderTrocas)
  // o A não muda: cada análise monta a tela de novo (main.ts)
  const ini = untrack(() => T.novas(A));
  let trocas: Troca[] = $state.raw(ini);
  let cv = $state(ini.map(() => 0));                     // muda: só aquela troca é refeita (outra carta escolhida)
  let on = $state(ini.map(() => true));
  let marcadasV = $state(0), testeV = $state(0);         // resumo e gráfico; números da Mesa
  const ligados = () => Object.fromEntries([...T.concOn(A)].map(k => [k, true]));
  let chips: Record<string, boolean> = $state(untrack(ligados));
  let msg = $state('');
  let raiz: HTMLElement;

  function refaz() {
    trocas = T.novas(A); cv = trocas.map(() => 0); on = trocas.map(() => true);
    chips = ligados(); msg = ''; ver++;
  }
  onMount(() => {
    const deNovo = (e: Event) => { if ((e as CustomEvent).detail === A) refaz(); };
    const teste = () => { testeV++; };
    document.addEventListener('raiox:trocas', deNovo); document.addEventListener('raiox:teste', teste);
    return () => { document.removeEventListener('raiox:trocas', deNovo); document.removeEventListener('raiox:teste', teste); };
  });

  // ---- a ideia ----
  const campo = <E extends HTMLInputElement>(id: string) => raiz.querySelector<E>('#' + id)!;
  function sync() {
    const C = T.CONC;
    C.text = campo('cc-text').value; C.mode = campo('cc-mode').value; C.lock = campo('cc-lock').value; C.test = campo('cc-test').value;
    C.br = campo('cc-br').value; C.teto = campo('cc-teto').value; C.tetoCarta = campo('cc-tetoc').value; T.salva(A);
  }
  function digitou() { sync(); chips = ligados(); }
  function chip(e: MouseEvent, k: string) {
    e.stopPropagation(); sync();
    const det = T.concDetected(A).has(k), now = !chips[k], C = T.CONC;
    C.man = C.man || {}; if (now === det) delete C.man[k]; else C.man[k] = now; T.salva(A);
    chips[k] = now;
  }
  const conceitos = () => T.CONCEITOS.filter(x => x.k !== 'tribe' || A.tribe);
  const naoReconheci = () => T.resolveNames(T.CONC.lock).bad.concat(T.resolveNames(T.CONC.test).bad);
  const seguindo = () => { const s = T.concOn(A); return s.size && T.CONC.mode !== 'livre' ? [...s].map(k => k === 'tribe' ? A.tribe![0] : T.CONCEITOS.find(x => x.k === k)!.n.toLowerCase()).join(', ') : ''; };
  const BRS = () => [['', `Manter o estimado (Bracket ${A.bracket})`], ['2', 'Bracket 2 · núcleo, nível de pré-montado'], ['3', 'Bracket 3 · melhorado, até 3 game changers'], ['4', 'Bracket 4 · otimizado, sem limites']];

  // ---- as trocas ----
  const imgs = (el: HTMLElement) => { T.imgs(el); };
  const soma = (_m: number, _t: number) => T.soma(A);
  const graf = (_m: number) => T.graf(A);
  const nums = (s: Troca, _t: number) => T.nums(A, s);
  function marca(i: number, v: boolean) { T.marca(i, v); on[i] = v; marcadasV++; }
  function alt(e: MouseEvent, i: number, lado: 'in' | 'out', n: string) { e.stopPropagation(); if (T.alt(A, i, lado, n)) { cv[i]++; marcadasV++; } }
  function naoTirar(e: MouseEvent, n: string) { e.stopPropagation(); const C = T.CONC; C.lock = (C.lock ? C.lock.replace(/\s+$/, '') + '\n' : '') + n; T.salva(A); refaz(); }
  const caixa = () => document.querySelector<HTMLTextAreaElement>('#deck-in')!;
  async function copiar() { try { await navigator.clipboard.writeText(T.listaNova(A)); msg = 'Lista copiada. Cole no Moxfield ou no Archidekt.'; } catch (e) { caixa().value = T.listaNova(A); msg = 'Não deu para copiar daqui; a lista nova foi para a caixa da aba Lista.'; } }
  function aplicar() { if (!T.nMarcadas()) { msg = 'Nenhuma troca marcada.'; return; } caixa().value = T.listaNova(A); R.run(cmdNames(), 'resumo'); }
  function aoVivo() { if (!T.algumaMarcada()) { msg = 'Nenhuma troca marcada.'; return; } try { localStorage.setItem('raiox:vivoTrocas', '1'); } catch (e) {} window.RAIOX_VIVO_JA = true; location.hash = 'aovivo'; }
  function testar() { window.RAIOX_VOLTA = 'trocas'; location.hash = 'mesa'; setTimeout(() => { const b = document.querySelector<HTMLButtonElement>('#m-tro'); if (b && !b.disabled) b.click(); }, 60); }
  const botaoTeste = (e: MouseEvent) => { if ((e.target as Element).closest('[data-swtest]')) testar(); };
</script>

<div class="screen" data-s="trocas" bind:this={raiz}>
{#key ver}
<section class="panel conc"><h2>A ideia do deck</h2>
    <p class="lead">Conte em poucas palavras como o deck quer ganhar. As trocas passam a seguir isso: carta que encaixa na ideia pesa mais para ficar e para entrar. Fica salvo neste navegador para este comandante.</p>
    <textarea id="cc-text" rows="2" style="min-height:60px;font-family:var(--body);font-size:1rem" placeholder="Ex.: equipar o comandante e bater com ele; fichas para segurar a mesa" defaultValue={T.CONC.text} oninput={digitou}></textarea>
    <div class="cc-row"><span class="note">Temas que li na ideia (clique para ligar ou desligar):</span><div class="links">{#each conceitos() as x}<button class="cn lock {chips[x.k] ? 'on' : ''}" data-cc={x.k} aria-pressed={!!chips[x.k]} onclick={e => chip(e, x.k)}>{x.k === 'tribe' ? 'Tribo: ' + A.tribe![0] : x.n}</button>{/each}</div></div>
    <label class="field">Como seguir <select id="cc-mode" onchange={sync}>{#each T.MODOS as [v, l]}<option value={v} selected={T.CONC.mode === v}>{l}</option>{/each}</select></label>
    <div class="grid2" style="margin-top:12px">
      <label class="cc-box"><b>Cartas que não saem</b><span class="note">Uma por linha ou separadas por vírgula. Vale nome em português.</span><textarea id="cc-lock" rows="3" style="min-height:70px" defaultValue={T.CONC.lock} onchange={sync}></textarea></label>
      <label class="cc-box"><b>Cartas que quero testar entrando</b><span class="note">Cada uma vira uma troca, no lugar da carta que menos faz falta.</span><textarea id="cc-test" rows="3" style="min-height:70px" defaultValue={T.CONC.test} onchange={sync}></textarea></label>
    </div>
    <div class="nivel">
      <h3>Nível e orçamento</h3>
      <p class="note">As trocas mudam bastante com isso: num bracket menor saem os game changers, a destruição de terrenos e o excesso de tutores; num maior entram cartas mais fortes. Com teto de preço, nenhuma carta que entra passa dele e as caras demais saem por outras da mesma função. Deixe em branco para não limitar.</p>
      <div class="nivel-campos">
        <label class="cc-box"><b>Bracket que você quer</b><select id="cc-br" onchange={sync}>{#each BRS() as [v, l]}<option value={v} selected={String(T.CONC.br || '') === v}>{l}</option>{/each}</select></label>
        <label class="cc-box"><b>Preço máximo do deck</b><span class="reais"><i>R$</i><input id="cc-teto" class="txt" type="number" min="0" step="50" inputmode="numeric" placeholder="sem limite" defaultValue={String(T.CONC.teto || '')} onchange={sync}></span><span class="note">Hoje: {@html R.brl(A.price)} · preços do {@html R.fonteMyp()}</span></label>
        <label class="cc-box"><b>Preço máximo por carta</b><span class="reais"><i>R$</i><input id="cc-tetoc" class="txt" type="number" min="0" step="5" inputmode="numeric" placeholder="sem limite" defaultValue={String(T.CONC.tetoCarta || '')} onchange={sync}></span><span class="note">{#if A.pricey && A.pricey[0]}A mais cara hoje: {A.pricey[0].name}, {@html R.brl(A.pricey[0].usd)}{:else}Nenhuma carta cara no deck{/if}</span></label>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="cc-go" onclick={() => { sync(); refaz(); }}>Refazer as trocas com esta ideia</button>{#if naoReconheci().length}<span class="note" style="color:var(--warn)">Não reconheci: {naoReconheci().join(', ')}</span>{/if}{#if seguindo()}<span class="note">Seguindo: {seguindo()}</span>{/if}</div>
  </section>
{#if !trocas.length}
<section class="panel"><h2>Trocas sugeridas</h2><p>Nenhuma troca óbvia pela lista: as funções estão nas faixas, a base de mana cobre as cores e não sobraram cartas sem papel. Para afinar daqui, use a <a href="#mesa">mesa simulada</a>, que mede carta por carta.</p></section>
{:else}
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<section class="panel" onclick={botaoTeste}><h2>Trocas sugeridas</h2>
    <p class="lead">Cada troca é um par: a carta que menos contribui sai, e entra uma das mais jogadas nas suas cores para o buraco apontado no resumo. A lista final continua com 100 cartas. Desmarque o que não quiser, troque a carta que entra pelas outras opções e clique em qualquer nome para ler a carta.</p>
    {@html T.planoBox(A)}
    <div class="kpis sw-sum" id="sw-sum">{@html soma(marcadasV, testeV)}</div>
    <div id="sw-graf">{@html graf(marcadasV)}</div>
    {#if A._testBad && A._testBad.length}<p class="note" style="color:var(--warn)">Fora das cores do comandante, não dá para testar: {A._testBad.join(', ')}.</p>{/if}
    <div id="sw-list">{#each trocas as s, i}{#key cv[i]}<div class="swapcard" class:off={!on[i]} data-sw={i} use:imgs>
    <div class="sw-h"><span class="tag">{s.goal}</span><h3>Troca {i + 1}: {s.out} → {s.inn}</h3><button class="btn small" style="margin-left:auto" data-lockout={s.out} title="Trava a carta que sai e refaz as trocas" onclick={e => naoTirar(e, s.out)}>Não tirar {s.out}</button><label class="field" style="margin:0"><input type="checkbox" data-swon={i} defaultChecked={on[i]} onchange={e => marca(i, e.currentTarget.checked)}> fazer esta troca</label></div>
    <div class="pair">{@html T.box(s.out, 'SAI')}{@html T.box(s.inn, 'ENTRA')}</div>
    {@html nums(s, testeV)}
    <dl class="sw-why"><dt>Por que sai</dt><dd>{s.whyOut}.</dd><dt>Por que entra</dt><dd>{s.whyIn}</dd><dt>Na prática</dt><dd class="cmp">{T.compara(A, s)}</dd>{@html T.planoTroca(A, s)}{@html T.edhTroca(A, s)}</dl>
    {#if s.alts.length}<div class="alt"><span class="note">Prefere outra para entrar?</span><div class="links">{#each s.alts as n}<button class="cn" data-altin={i} data-n={n} onclick={e => alt(e, i, 'in', n)}>{n}</button>{/each}</div></div>{/if}
    {#if s.altsOut.length}<div class="alt"><span class="note">Ou tirar outra no lugar:</span><div class="links">{#each s.altsOut as n}<button class="cn" data-altout={i} data-n={n} onclick={e => alt(e, i, 'out', n)}>{n}</button>{/each}</div></div>{/if}
  </div>{/key}{/each}</div>
    <div class="row" style="margin-top:16px"><button class="btn primary" id="sw-apply" onclick={aplicar}>Aplicar as trocas marcadas e analisar de novo</button><button class="btn" id="sw-copy" onclick={copiar}>Copiar a lista nova</button><button class="btn" id="sw-test" onclick={testar}>Testar na mesa simulada</button><button class="btn" id="sw-vivo" onclick={aoVivo}>Jogar ao vivo com as trocas</button><span class="note" id="sw-msg">{msg}</span></div>
  </section>
{/if}
{/key}
</div>
