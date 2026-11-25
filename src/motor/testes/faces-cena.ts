// Cartas de mais de uma face para os casos de regra (T43 faces). As 8 do B (bloco faces, v0.8.0) vêm de banco/cartas;
// aqui fica só o que o banco ainda não tem:
// - Lovestruck Beast (Oracle: "Create a 1/1 white Human creature token." na Aventura): a Aventura do Bonecrusher
//   (Stomp: efeitoTemporario) e o gigante do Beanstalk (P/R '*': ptDefinido) ainda não rodam no motor.
// - kw 'fusao' no Wear // Tear: o esquema já tem (v0.8.0), a carta do banco ainda está com a frase em 'falta'.
// comCenaFaces só completa: quando o banco tiver, vale o do banco.
export const CENA_FACES: Record<string, any> = {
  'Lovestruck Beast': {
    n: 'Lovestruck Beast', custo: { g: 2, p: ['G'] }, cores: 'G', tipos: ['Creature'], sub: ['Beast', 'Noble'], pt: [5, 5], vm: 3, ci: 'G', forma: 'aventura',
    faces: [{ n: "Heart's Desire", custo: { p: ['G'] }, cores: 'G', tipos: ['Sorcery'], sub: ['Adventure'],
      fx: [{ op: 'ficha', quem: 'voce', qtd: 1, token: { pt: [1, 1], cores: 'W', tipos: ['Creature'], sub: ['Human'] } }] }],
    falta: ["This creature can't attack unless you control a 1/1 creature."],
  },
};
/** completa o banco com as cartas da cena que ainda faltam nele (as do banco ganham). Wear ganha a kw 'fusao' se faltar. */
export function comCenaFaces<T extends Record<string, any>>(db: T): T {
  const r: Record<string, any> = { ...db };
  for (const [n, c] of Object.entries(CENA_FACES)) if (!r[n]) r[n] = c;
  if (r.Wear && !(r.Wear.kw || []).some((k: any) => k.k === 'fusao')) r.Wear = { ...r.Wear, kw: [...(r.Wear.kw || []), { k: 'fusao' }] };
  return r as T;
}
