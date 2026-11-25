// npm run tipos — gera src/tipos/carta.ts a partir de banco/esquema.json (só lê o esquema; quem muda é o coordenador).
// O resolvedor de $ref do json-schema-to-typescript se perde nas referências circulares do esquema (fx ↔ fxs, filtro…):
// aqui cada $defs/X vira um tipo nomeado e cada {"$ref": "#/$defs/X"} vira {"tsType": "X"} antes de compilar.
import { compile } from 'json-schema-to-typescript';
import { readFileSync, writeFileSync } from 'node:fs';

const esq = JSON.parse(readFileSync('banco/esquema.json', 'utf8'));
const nome = (k) => 'Rx' + k[0].toUpperCase() + k.slice(1);
const troca = (o) => {
  if (Array.isArray(o)) return o.map(troca);
  if (!o || typeof o !== 'object') return o;
  if (typeof o.$ref === 'string') {
    const m = o.$ref.match(/^#\/\$defs\/(\w+)$/);
    if (!m) throw new Error('ref fora de $defs: ' + o.$ref);
    const { $ref, ...resto } = o;
    return { ...troca(resto), tsType: nome(m[1]) };
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, troca(v)]));
};
const opc = { bannerComment: '', additionalProperties: false, style: { singleQuote: true }, declareExternallyReferenced: true };
const { $defs = {}, $schema, $id, ...raiz } = esq;
const partes = ['// GERADO por `npm run tipos` a partir de banco/esquema.json — não editar à mão.\n'];
partes.push(await compile({ ...troca(raiz), title: 'Carta' }, 'Carta', opc));
for (const [k, d] of Object.entries($defs)) partes.push(await compile({ ...troca(d), title: nome(k) }, nome(k), opc));
const ts = partes.join('\n');
writeFileSync('src/tipos/carta.ts', ts);
console.log('src/tipos/carta.ts', ts.split('\n').length, 'linhas,', Object.keys($defs).length + 1, 'tipos');
