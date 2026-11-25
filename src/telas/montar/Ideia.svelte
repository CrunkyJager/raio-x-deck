<script lang="ts">
  // Passo 2: a ideia do deck (texto livre, temas, bracket e orçamento). Digitar e clicar nos temas não redesenha a
  // tela: só acende/apaga os temas, como antes.
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const { C, G } = mt, a = G.acoes;
  const d = mt.D(), tb = G.triboDeck();
  let on = $state(G.temasIdeia());
  const cmd = d.cmds[0], ia = window.PAPEIS_IA && window.PAPEIS_IA[cmd];
  const p = G.perfil(cmd);
  const chips = G.CONC().filter(x => x.k !== 'tribe' || tb);
  // valores do começo: o defaultValue não pode seguir o deck (o efeito roda de novo quando os temas mudam)
  const ini = { texto: d.ideia.texto || '', br: String(d.alvo.br || ''), teto: d.alvo.teto || '', tetoCarta: d.alvo.tetoCarta || '' };
  let brtx = $state(G.BR_TX[d.alvo.br || '']);
  function chip(k: string) { const agora = !on.has(k); a.chip(k, agora); const s = new Set(on); if (agora) s.add(k); else s.delete(k); on = s; }
</script>

<section class="panel g-p2"><h2>Passo 2 · A ideia do deck</h2>
      <div class="g-ideia">
        <div class="g-cmdbox">{#each d.cmds as n}<button class="g-img" data-card={n} data-img={n}><span class="note">carregando…</span></button>{/each}
          {#if ia && ia.r}<p class="g-ia"><b>O que ele faz:</b> {ia.r}</p>{/if}
          <p class="note">{p.temas.length || p.tribo ? 'Pelo texto, ele puxa para: ' + [p.tribo ? 'tribo ' + p.tribo : '', ...p.temas.map(G.temaNome)].filter(Boolean).join(', ') + '.' : 'O texto dele não aponta um tema claro: a ideia fica por sua conta.'}</p>
          <div class="row">{#if d.cmds.length === 1 && mt.temPar(C(cmd))}<button class="btn small" id="g-par" onclick={a.par}>+ segundo comandante</button>{/if}<button class="btn small" id="g-troca" onclick={a.troca}>Trocar de comandante</button></div>
        </div>
        <div class="g-ideia-f">
          <label class="mt-campo"><span>Como o deck ganha? Escreva do seu jeito</span><textarea id="g-txt" spellcheck="false" placeholder="ex.: encher a mesa de goblins e atacar com todos; ou: equipar o comandante e bater com ele" defaultValue={ini.texto} oninput={e => { on = a.ideiaTexto(e.currentTarget.value); }}></textarea></label>
          <div><span class="g-rot">O plano (marque o que vale)</span><div class="chips g-chips">{#each chips as x}<button class="cn lock {on.has(x.k) ? 'on' : ''}" data-g2={x.k} aria-pressed={on.has(x.k)} onclick={() => chip(x.k)}>{x.k === 'tribe' ? 'Tribo: ' + tb : x.n}</button>{/each}</div>
          <p class="note">Já vem marcado o que o comandante pede. O que você escrever acende os temas sozinho; clique para ligar ou desligar.</p></div>
          <div class="g-nivel">
            <label class="mt-campo"><span>Bracket que você quer</span><select id="g-br" onchange={e => { brtx = a.br(e.currentTarget.value); }}>{#each ['', 2, 3, 4] as b}<option value={String(b)} selected={ini.br === String(b)}>{b || 'Qualquer'}</option>{/each}</select></label>
            <label class="mt-campo"><span>Orçamento do deck (R$)</span><input class="txt" id="g-teto" inputmode="decimal" defaultValue={ini.teto} placeholder="ex.: 800" onchange={e => a.teto('teto', e.currentTarget.value)}></label>
            <label class="mt-campo"><span>Máximo por carta (R$)</span><input class="txt" id="g-tetoc" inputmode="decimal" defaultValue={ini.tetoCarta} placeholder="ex.: 40" onchange={e => a.teto('tetoCarta', e.currentTarget.value)}></label>
          </div>
          <p class="note" id="g-brtx">{brtx}</p>
        </div>
      </div>
      <div class="row g-nav"><button class="btn" data-passo="1" onclick={() => a.passo(1)}>← Voltar às cores</button><button class="btn primary" data-passo="3" onclick={() => a.passo(3)}>Próximo: montar junto →</button></div>
    </section>
