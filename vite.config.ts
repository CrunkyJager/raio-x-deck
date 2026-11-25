// T43: Vite + Svelte 5. Enquanto a migração anda (passos b..e), os scripts clássicos da raiz
// (<script src> sem type=module no index.html) e as pastas que eles leem por fetch/Worker
// são copiados como estão para dist/. Cada módulo que for para src/ sai desta lista sozinho
// (quando a tag sair do index.html).
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PASTAS = ['motor', 'dados'];   // motor/worker.js (importScripts) e dados/*.json (fetch, opcional)

function classicos(): Plugin {
  let saida = 'dist';
  return {
    name: 'raiox-classicos',
    apply: 'build',
    configResolved(c) { saida = c.build.outDir; },
    closeBundle() {
      const html = readFileSync('index.html', 'utf8');
      const arqs = [...html.matchAll(/<script\s+src="([^"?:]+)(?:\?[^"]*)?"\s*><\/script>/g)].map(m => m[1]);
      for (const a of [...arqs, ...PASTAS]) if (existsSync(a)) cpSync(a, resolve(saida, a), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',          // GitHub Pages em /raio-x-deck/ e python3 -m http.server na raiz, os dois
  plugins: [svelte(), classicos()],
  build: { outDir: 'dist', emptyOutDir: true },
});
