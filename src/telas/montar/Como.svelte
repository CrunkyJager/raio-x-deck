<script lang="ts">
  // Passo 4: como o deck está (preço, bracket, game changers, avisos, réguas das funções e curva).
  import { getContext } from 'svelte';
  import type { MontarAPI } from '../../montar/montar';
  const mt: MontarAPI = getContext('mt');
  const { R, brl } = mt, a = mt.acoes;
  const d = mt.D(), A = mt.A();
  const alvoBr = +d.alvo.br || 0, teto = parseFloat(String(d.alvo.teto || '').replace(',', '.')) || 0;
  const usdBrl = R.usd || 5.56;
  const gcLim = mt.LIM_GC[alvoBr];
  const avisos: string[] = [];
  let regra: { t: string }[] = [], reguas: any[] = [], curva: { q: number; v: number; h: string }[] = [];
  if (A) {
    const reais = A.price * usdBrl;
    if (alvoBr && A.bracket > alvoBr) avisos.push(`O deck está no bracket ${A.bracket}, acima do ${alvoBr} que você quer${A.bracketWhy.length ? ': ' + A.bracketWhy.join(', ') : ''}.`);
    if (gcLim != null && A.gc.length > gcLim) avisos.push(`${A.gc.length} game changer${A.gc.length > 1 ? 's' : ''} (${A.gc.join(', ')}); o bracket ${alvoBr} aceita ${gcLim}.`);
    if (teto && reais > teto) avisos.push(`Passou do orçamento: ${R.brlTxt(A.price)} de ${R.brlTxt(teto / usdBrl)}.`);
    regra = A.issues.filter(i => i.sev === 3 && !/exatamente 100/.test(i.t));
    reguas = A.refs.map(r => {
      const max = Math.max(r.hi * 1.35, r.have) + 1, x = (v: number) => (100 * v / max).toFixed(1) + '%';
      return { r, lo: x(r.lo), hi: x(r.hi), have: x(r.have), dentro: r.have >= r.lo && r.have <= r.hi, falta: r.have < r.lo, papel: r.k === 'lands' ? '' : r.k };
    });
    const cmax = Math.max(1, ...A.curve);
    curva = A.curve.map((q, v) => ({ q, v, h: (100 * q / cmax).toFixed(1) + '%' }));
  }
</script>

{#if A}<section class="panel mt-ana"><h2>Como o deck está</h2>
    <div class="stats mt-stats">
      <div class="stat price"><span class="k">Preço do deck</span><b>{@html brl(A.price)}</b><small>{@html teto ? `orçamento ${R.brlTxt(teto / usdBrl)}` : 'sem orçamento definido'}</small><small class="cot">{@html R.fontePrecos(A.uniq.concat(A.cmds).map(c => c.name))}</small></div>
      <div class="stat"><span class="k">Bracket</span><b>{A.bracket}</b><small>{alvoBr ? 'quer ' + alvoBr : 'estimado'}</small></div>
      <div class="stat"><span class="k">Game changers</span><b>{A.gc.length}</b><small>{gcLim != null ? 'limite ' + gcLim : '—'}</small></div>
      <div class="stat"><span class="k">Custo médio</span><b>{A.avgMV.toFixed(2).replace('.', ',')}</b><small>{A.lands} terrenos</small></div>
    </div>
    <div class="mt-alvo"><label class="mt-campo"><span>Bracket que você quer</span><select id="mt-br" onchange={e => a.alvo('br', e.currentTarget.value)}><option value="">Qualquer</option>{#each [2, 3, 4] as b}<option value={String(b)} selected={alvoBr === b}>{b}</option>{/each}</select></label>
      <label class="mt-campo"><span>Orçamento do deck (R$)</span><input class="txt" id="mt-teto" inputmode="decimal" defaultValue={d.alvo.teto || ''} placeholder="ex.: 800" onchange={e => a.alvo('teto', e.currentTarget.value)}></label></div>
    {#if avisos.length || regra.length}<ul class="mt-av">{#each regra as i}<li class="ruim">{i.t}</li>{/each}{#each avisos as t}<li>{t}</li>{/each}</ul>{/if}
    <div class="graf2">
      <div class="gbox"><h3>Funções</h3><p class="note">A faixa clara é o normal para Commander. <b>buscar</b> filtra a busca pela função que falta.</p><div class="reguas">{#each reguas as g}<div class="rg"><span class="rg-n">{g.r.n}</span><span class="rg-t" title="Faixa comum: {g.r.lo}–{g.r.hi}"><span class="rg-band" style="left:{g.lo};width:calc({g.hi} - {g.lo})"></span><i class="rg-dep {g.dentro ? '' : 'ruim'}" style="left:{g.have}"></i></span><span class="rg-v">{g.r.have % 1 ? g.r.have.toFixed(1) : g.r.have} <small>/ {g.r.lo}–{g.r.hi}</small>{#if g.falta}{' '}<button class="btn small" data-papel={g.papel} data-tipo={g.r.k === 'lands' ? 'Land' : ''} onclick={() => a.buscarPapel(g.papel, g.r.k === 'lands' ? 'Land' : '')}>buscar</button>{/if}</span></div>{/each}</div></div>
      <div class="gbox"><h3>Curva de mana</h3><p class="note">Cartas que não são terreno, por custo.</p><div class="curva2">{#each curva as x}<div class="col" title="Custo {x.v}{x.v === 7 ? '+' : ''}: {x.q}"><span class="col-q">{x.q}</span><span class="col-b"><i class="dep" style="height:{x.h}"></i></span><span class="col-l">{x.v}{x.v === 7 ? '+' : ''}</span></div>{/each}</div></div>
    </div>
  </section>{/if}
