// src/motor/contagem-trad.ts — tradução dos nomes velhos de contagem para o formato único (ver contagem.ts).
// Sem import nenhum: o motor usa, e o script ferramentas/contagens-converte.mjs (node) também, para converter o banco.
const A = (n: number) => ({ alvo: n });
// nome velho → conta nova (alvo N vem do q.alvo; marc/cores vêm do q.de velho)
export const TRAD: Record<string, (q: any) => any> = {
  poderDoAlvo: q => ({ de: A(q.alvo || 0), o: 'poder' }),
  resistDoAlvo: q => ({ de: A(q.alvo || 0), o: 'resist' }),
  vmDoAlvo: q => ({ de: A(q.alvo || 0), o: 'vm' }),
  grimorioDoAlvo: q => ({ de: A(q.alvo || 0), o: 'grimorio' }),
  vidaDoAlvo: q => ({ de: A(q.alvo || 0), o: 'vida' }),
  maoDoAlvo: q => ({ de: A(q.alvo || 0), o: 'mao' }),
  poderDoEste: () => ({ de: 'este', o: 'poder' }),
  resistDoEste: () => ({ de: 'este', o: 'resist' }),
  vmDoEste: () => ({ de: 'este', o: 'vm' }),
  coresDoEste: () => ({ de: 'este', o: 'cores' }),
  marcadoresNoEste: q => ({ de: 'este', o: 'marcadores', ...(q.de ? { marc: q.de } : {}) }),
  vezesKicker: () => ({ de: 'este', o: 'kicker' }),
  convergir: () => ({ de: 'este', o: 'coresPagas' }),
  cartasNaMao: () => ({ de: 'voce', o: 'mao' }),
  cartasNoGrimorio: () => ({ de: 'voce', o: 'grimorio' }),
  suaVida: () => ({ de: 'voce', o: 'vida' }),
  vidaInicial: () => ({ de: 'voce', o: 'vidaInicial' }),
  devocao: q => ({ de: 'voce', o: 'devocao', cores: q.de }),
  marcadoresSeus: q => ({ de: 'voce', o: 'marcadores', marc: q.de }),
  energia: () => ({ de: 'voce', o: 'marcadores', marc: 'energy' }),
  dominio: () => ({ de: 'voce', o: 'dominio' }),
  impostoCmd: () => ({ de: 'voce', o: 'impostoCmd' }),
  seusTurnos: () => ({ de: 'voce', o: 'turnos' }),
  magiasNoTurno: () => ({ de: 'turno', o: 'magias' }),
  descartadasNoTurno: () => ({ de: 'turno', o: 'descartes' }),
  ataquesNoTurno: () => ({ de: 'turno', o: 'ataques' }),
  resolvidasNoTurno: () => ({ de: 'turno', o: 'resolvidas' }),
  vidaGanhaNoTurno: () => ({ de: 'turno', o: 'vidaGanha' }),
  compradasNoTurno: () => ({ de: 'turno', o: 'compras' }),
  vidaPerdidaNoTurno: () => ({ de: 'turno', o: 'vidaPerdida' }),
  vidaPerdidaOpsNoTurno: () => ({ de: 'turno', o: 'vidaPerdida', quem: 'oponentes', junta: 'soma' }),
  maiorVidaPerdidaOpNoTurno: () => ({ de: 'turno', o: 'vidaPerdida', quem: 'oponentes', junta: 'maior' }),
  resolucoesDestaHabNoTurno: () => ({ de: 'turno', o: 'resolucoesDestaHab' }),
  oponentesAtacados: () => ({ de: 'combate', o: 'oponentesAtacados' }),
  entrouNoTurno: () => ({ de: 'turno', o: 'entraram' }),
  atacantes: () => ({ de: 'combate', o: 'atacantes' }),
  atacantesEmVoce: () => ({ de: 'combate', o: 'atacantesEmVoce' }),
  oponentes: () => ({ de: 'oponentes', o: 'quantos' }),
  jogadores: () => ({ de: 'jogadores', o: 'quantos' }),
  maiorEntreJogadores: () => ({ de: 'jogadores', o: 'maior' }),
  X: () => ({ de: 'X' }),
  resultado: () => ({ de: 'resultado' }),
  numeroEscolhido: () => ({ de: 'escolhido' }),
  lembrados: () => ({ de: 'lembradas', o: 'quantos' }),
  maiorDescarte: () => ({ de: 'lembradas', o: 'quantos', junta: 'maiorPorDono' }),
  evento: () => ({ de: 'evento', o: 'quantos' }),
  vidaGanha: () => ({ de: 'evento', o: 'vida' }),
  danoCausado: () => ({ de: 'evento', o: 'dano' }),
  marcadoresNoEvento: () => ({ de: 'evento', o: 'marcadores' }),
  poderDoEvento: () => ({ de: 'evento', o: 'poder' }),
  resistDoEvento: () => ({ de: 'evento', o: 'resist' }),
  vmDoEvento: () => ({ de: 'evento', o: 'vm' }),
  coresDoEvento: () => ({ de: 'evento', o: 'cores' }),
  maoDoEvento: () => ({ de: 'evento', o: 'mao' }),
  poderDoSacrificado: () => ({ de: 'sacrificadas', o: 'poder', junta: 'soma' }),
  vmDoSacrificado: () => ({ de: 'sacrificadas', o: 'vm', junta: 'soma' }),
  marcadoresNoCada: q => ({ de: 'cada', o: 'marcadores', marc: q.de }),
  vidaDoAtual: () => ({ de: 'cada', o: 'vida' }),
  tipoMaisComum: () => ({ de: 'tipoMaisComum' }),
};
// prop velho (com conta = filtro) → o + junta
export const PROP: Record<string, any> = {
  somaPoder: { o: 'poder', junta: 'soma' }, maiorPoder: { o: 'poder', junta: 'maior' }, somaResist: { o: 'resist', junta: 'soma' },
  somaVm: { o: 'vm', junta: 'soma' }, maiorVm: { o: 'vm', junta: 'maior' }, cores: { o: 'cores', junta: 'diferentes' },
  nomesDiferentes: { o: 'nome', junta: 'diferentes' }, tiposDiferentes: { o: 'tipos', junta: 'diferentes' },
};
export const NOMES_VELHOS = Object.keys(TRAD);
export const PROPS_VELHOS = Object.keys(PROP);
export const nova = c => !!c && typeof c === 'object' && 'de' in c;
/** qtd velha → nova; o que não é contagem (número, 'X', {ate}, {dado}) volta igual. Nome desconhecido → erro. */
export function traduzQtd(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return q;
  if ('ate' in q && q.ate && typeof q.ate === 'object') return { ...q, ate: traduzQtd(q.ate) };
  if (!('conta' in q) || nova(q.conta)) return q;
  const { conta, alvo, de, prop, cond, sim, nao, ...resto } = q;
  let c;
  if (conta === 'se') c = { de: 'se', cond, ...(sim !== undefined ? { sim } : {}), ...(nao !== undefined ? { nao } : {}) };
  else if (typeof conta === 'string') { const t = TRAD[conta]; if (!t) throw new Error('conta velha desconhecida: ' + conta); c = t(q); }
  else { if (prop && !PROP[prop]) throw new Error('prop velho desconhecido: ' + prop); c = { de: { f: conta }, ...(prop ? PROP[prop] : { o: 'quantos' }) }; }
  for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  return { conta: c, ...resto };
}
