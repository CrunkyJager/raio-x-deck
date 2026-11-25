// src/motor/tipos.ts — tipos do estado do motor. T43 (b): tipagem gradual; os campos dinâmicos ficam abertos
// até a T17 parte 2 (já em TS) e o carregador do banco (passo e) fecharem o formato.
export type Cor = 'W' | 'U' | 'B' | 'R' | 'G';
export type ZonaJog = 'grimorio' | 'mao' | 'cemiterio' | 'exilio' | 'comando';
export type Zona = ZonaJog | 'campo' | 'pilha';

/** objeto do jogo (carta, ficha, cópia na pilha, habilidade na pilha) */
export interface Obj {
  id: number; n: string; dono: number; ctrl: number; zona: Zona; ts: number;
  virada: boolean; dano: number; marc: Record<string, number>; doente: boolean; cmd: boolean;
  [campo: string]: any;
}
export interface Jogador {
  nome: string; vida: number; saiu?: boolean;
  zonas: Record<ZonaJog, number[]>;
  reserva: Record<string, number>;
  [campo: string]: any;
}
/** pergunta pendente: o núcleo nunca decide, quem responde é o agente */
export interface Pergunta { j: number; tipo: string; ops: any[]; ctx?: any; [campo: string]: any }
export interface Estado {
  jogs: Jogador[]; objs: Record<number, Obj>; campo: number[]; pilha: number[];
  prox: number; ts: number;
  turno: { n: number; ativo: number; primeiro: number; passo: string; [campo: string]: any };
  perg: Pergunta | null; fim: any; proc?: any;
  [campo: string]: any;
}
export type Agente = (e: Estado, p: Pergunta) => number;

/** o objeto M: cada módulo pendura as suas funções nele (assinaturas fechadas aos poucos) */
export interface Motor {
  [nome: string]: any;
}
