# Coordenação dos adeptos (25/11/2026)

Felipe: "pode ser 2 adeptos mas você precisa coordenar para não virar várzea".
Coordenador: **Opus Raio-X** (painel do /raiox). Decide o formato da carta, revisa e faz o merge na `main`.

## Regra de ouro: cada um na sua pasta
| | Adepto A — T43 estrutura | Adepto B — T20 banco |
|---|---|---|
| Ramo | `t43-estrutura` (sai da `main`) | `t20-banco` (sai da `main`) |
| Pode mexer | `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/`, `.github/workflows/`, `index.html`, os .js da raiz que migrar | `banco/cartas/`, `banco/testes/`, `banco/ferramentas/` |
| NÃO mexe | `banco/` (só lê `banco/esquema.json`) | tudo fora de `banco/`; **nem `banco/esquema.json`** |
| Merge | só o coordenador | só o coordenador |

- Precisa de algo no esquema (campo novo, valor novo no vocabulário)? Escrever o pedido em `banco/pedidos-esquema.md` (carta, frase do Oracle, proposta) e seguir com outra carta. O coordenador decide e muda o esquema; os dois puxam da `main`.
- Commits pequenos, em português, com o git do Felipe:
  `git -c user.name=Crunky_Jager -c user.email=65680842+CrunkyJager@users.noreply.github.com commit`
- Push só do próprio ramo. Nunca na `main`, nunca `--force`.
- Status: ao fim de cada bloco, atualizar `planejamento/adeptos/A.md` ou `B.md` (feito / agora / dúvidas, 5 linhas) e avisar o coordenador por SendMessage.
- Sem subagentes. Ler arquivo grande só com grep/sed (cards-db.js, cartas-rx.js e forge-db.js são JSON de 1 linha). Conta compartilhada com o SAC: se o SAC estiver apertado, o coordenador pausa um dos dois.

## Adepto B — como escrever uma carta
1. Fonte: texto Oracle do Scryfall (bulk `oracle-cards`, cache fora do git em `~/.cache/raiox/scryfall/`). `id` = oracle_id; `oracleHash` = 8 hex do sha1 do oracle_text (dupla face: das faces juntas com `\n//\n`).
2. Traduzir cada frase do Oracle para o vocabulário de `banco/esquema.json`. Frase que o vocabulário não cobre → `falta` (a frase original) + pedido em `pedidos-esquema.md` se ela aparece em várias cartas.
3. `python3 banco/valida.py` com 0 erros.
4. Conferir com o Forge **sem copiar**: `banco/ferramentas/compara.py` mostra onde o nosso difere do `cartas-rx.js`. Cada divergência: reler o Oracle e decidir. O Forge pode estar certo ou errado; quem manda é o Oracle.
5. Carta com gatilho, estática ou substituição: um caso em `banco/testes/` (o que deve acontecer no jogo).
6. Ordem: cartas do banco de 30 por frequência (as 159 em 3 decks ou mais primeiro), em blocos de 50; um commit por bloco.
7. `rev`: `{"por":"adepto-b","em":"AAAA-MM-DD"}`.

## Adepto A — como migrar
1. Vite + TypeScript + Svelte 5 (versões estáveis de pelo menos 2 semanas). Tipos da carta gerados de `banco/esquema.json` (json-schema-to-typescript) num script `npm run tipos`.
2. Ordem: (a) esqueleto e build no GitHub Pages; (b) `motor2/` → `src/motor/` em TS, testes do motor2 no Vitest com o mesmo resultado; (c) análise, montar e mesa → módulos; (d) telas em Svelte; (e) o motor lê o banco por um carregador (`src/dados/`), com o `cartas-rx.js` de reserva até a T45.
3. Migração mecânica: `raiox-testes` iguais à linha de base em cada passo. Mudou um número → parar e avisar.
4. Os dados grandes saem do `<script>` global: carregar por demanda (fetch/import dinâmico).
5. Não mexer na lógica de pesos nem no motor além do necessário para tipar (a T17 parte 2 continua depois, já em TS).
