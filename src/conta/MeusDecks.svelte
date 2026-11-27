<script lang="ts">
  // T48: "Meus decks" na aba Lista. Entrar com Google ou e-mail; salvar a lista da caixa; abrir em qualquer PC.
  import { conta, entrarGoogle, entrarEmail, sair, salvar, apagar, iniciar, preCarregar } from './nuvem.svelte';
  import { onMount } from 'svelte';
  let { analisa }: { analisa: () => void } = $props();
  let porEmail = $state(false), email = $state(''), senha = $state(''), nome = $state(''), aviso = $state('');
  iniciar();
  // pré-carrega o SDK quando o bloco aparece na tela (o popup do Google precisa abrir direto no clique)
  let caixaMd: HTMLDivElement;
  onMount(() => {
    if (!('IntersectionObserver' in window)) { preCarregar(); return; }
    const o = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { o.disconnect(); preCarregar(); } });
    o.observe(caixaMd); return () => o.disconnect();
  });
  // nome sugerido = comandante(s) do último deck analisado
  document.addEventListener('raiox:deck', (e: any) => { const c = (e.detail?.cmds || []).map((x: any) => x.name).join(' + '); if (c && !nome) nome = c; });
  const caixa = () => document.getElementById('deck-in') as HTMLTextAreaElement;
  async function guarda() {
    const lista = caixa().value.trim();
    if (!lista) { aviso = 'Cole ou abra uma lista antes de salvar.'; return; }
    aviso = ''; if (await salvar(nome, lista)) aviso = 'Salvo.';
  }
  function abre(l: string, n: string) { caixa().value = l; nome = n; aviso = ''; analisa(); }
  async function tira(id: string, n: string) { if (confirm(`Apagar o deck "${n}"?`)) await apagar(id); }
  const quando = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
</script>

<div class="meus" id="meus-decks" bind:this={caixaMd}>
  <h3>Meus decks</h3>
  {#if conta.uid}
    <p class="note">Conectado como <b>{conta.nome}</b> · <button class="btn small" onclick={sair}>Sair</button></p>
    <div class="row">
      <input id="md-nome" bind:value={nome} placeholder="Nome do deck (ex.: comandante)" aria-label="Nome do deck" maxlength="190">
      <button class="btn primary" id="md-salvar" onclick={guarda}>Salvar a lista da caixa</button>
    </div>
    {#if conta.decks.length}
      <ul class="md-lista">
        {#each conta.decks as d (d.id)}
          <li><b>{d.nome}</b> <small>{quando(d.atualizado)}</small>
            <button class="btn small" onclick={() => abre(d.lista, d.nome)}>Abrir</button>
            <button class="btn small" title="Apagar" onclick={() => tira(d.id, d.nome)}>Apagar</button></li>
        {/each}
      </ul>
    {:else}
      <p class="note">Nenhum deck salvo ainda. Mesmo nome = atualiza o que já existe.</p>
    {/if}
  {:else}
    <p class="note">Entre para salvar seus decks e abrir em qualquer PC.</p>
    <div class="row">
      <button class="btn primary" id="md-google" onclick={entrarGoogle} disabled={conta.carregando}>Entrar com Google</button>
      <button class="btn" onclick={() => (porEmail = !porEmail)}>Entrar com e-mail</button>
    </div>
    {#if porEmail}
      <div class="row">
        <input type="email" bind:value={email} placeholder="E-mail" aria-label="E-mail" autocomplete="email">
        <input type="password" bind:value={senha} placeholder="Senha (6+ letras)" aria-label="Senha" autocomplete="current-password">
        <button class="btn" onclick={() => entrarEmail(email, senha, false)}>Entrar</button>
        <button class="btn" onclick={() => entrarEmail(email, senha, true)}>Criar conta</button>
      </div>
    {/if}
  {/if}
  {#if conta.carregando}<p class="note">Carregando…</p>{/if}
  {#if conta.erro || aviso}<p class="note" role="status">{conta.erro || aviso}</p>{/if}
</div>

<style>
  .meus { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line, #8884); }
  .meus h3 { margin: 0 0 6px; }
  .meus input { padding: 6px 8px; min-width: 0; flex: 1 1 180px; }
  .md-lista { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 6px; }
  .md-lista li { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .md-lista small { opacity: .7; }
</style>
