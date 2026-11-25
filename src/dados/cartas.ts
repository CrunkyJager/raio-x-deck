// src/dados/cartas.ts — carregador do banco próprio de cartas (banco/cartas/*.json, formato banco/esquema.json v2).
// T43: o banco v2 é o formato RX sem o campo `forge` e com metadados (v, id, oracleHash, rev) que o motor ignora,
// então o carregador entrega a carta como está, indexada pelo nome (`n`). Serve aos testes (Vitest) e ao site (Vite):
// o import.meta.glob põe os arquivos no bundle. No passo (e) o motor lê daqui, com o cartas-rx.js de reserva até a T45.
import type { Carta } from '../tipos/carta';

const arquivos = import.meta.glob<Carta>('../../banco/cartas/*.json', { eager: true, import: 'default' });

let cache: Record<string, Carta> | null = null;

/** Todas as cartas do banco próprio, por nome. */
export function bancoProprio(): Record<string, Carta> {
  if (cache) return cache;
  const db: Record<string, Carta> = {};
  for (const [arq, c] of Object.entries(arquivos) as [string, Carta][]) {
    if (db[c.n]) throw new Error(`carta repetida no banco: ${c.n} (${arq})`);
    db[c.n] = c;
  }
  return (cache = db);
}

/** Banco próprio por cima de uma base de reserva (cartas-rx.js até a T45): a carta nossa ganha. */
export function comReserva(reserva: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return { ...(reserva || {}), ...bancoProprio() };
}

/**
 * Embrulha uma base para anotar os nomes pedidos que não estão nela. O motor engole erro de carta em alguns
 * caminhos (filtros, condições), então o teste não pode confiar só na exceção "carta fora da base".
 */
export function anotandoFaltas<T extends object>(db: T): { db: T; faltas: Set<string> } {
  const faltas = new Set<string>();
  const p = new Proxy(db, {
    get(t, k) { if (typeof k === 'string' && !(k in t)) faltas.add(k); return (t as any)[k]; },
  });
  return { db: p, faltas };
}
