# T01 — Licenças (lido na fonte em 23/11/2026)

Resumo: dá pra fazer um **site grátis com anúncio/doação/apoio**. **Cobrar acesso** (assinatura, paywall) bate de frente com Wizards, Scryfall e EDHREC. O Forge obriga a abrir o código se o arquivo derivado dele for entregue ao navegador.

## 1. Forge — GPL-3.0
- Fonte: https://raw.githubusercontent.com/Card-Forge/forge/master/LICENSE
- Trecho: *"To 'convey' a work means any kind of propagation that enables other parties to make or receive copies. Mere interaction with a user through a computer network, with no transfer of a copy, is not conveying."*
- O que significa: `forge-db.js` é gerado dos roteiros do Forge (`cardsfolder`) e **vai para o navegador** (`window.FORGE_FX`) → isso é entregar cópia → vale a GPL: quem distribui tem que oferecer o código-fonte sob GPL-3. Se o dado ficar **só no servidor** (site responde, não manda o arquivo), não é "convey" (GPL-3 não é AGPL).
- Opções: (a) publicar o Raio-X inteiro como GPL-3 (mais simples, combina com "grátis"); (b) manter o FORGE_FX no servidor e mandar só o resultado; (c) trocar a fonte das funções por dado próprio.

## 2. Wizards of the Coast — Fan Content Policy
- Fonte: https://company.wizards.com/en/legal/fancontentpolicy
- Trechos: *"One word: F-R-E-E."* · *"You can't sell or license your Fan Content… must be free for others… to view, access, share, and use without paying you anything"* · *"You can, however, subsidize your Fan Content by taking advantage of sponsorships, ad revenue, and donations—so long as it doesn't interfere with the Community's access"* · obrigatório o aviso *"[Título] is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards…"* · *"Don't use Wizards' IP in other games"* · licença comercial *"you'll need our advance written permission"*.
- O que significa: nome das cartas, texto e imagens só em produto **gratuito**, com aviso de "não oficial". Anúncio, Patreon/doação e patrocínio podem. Assinatura/paywall **não**, sem autorização por escrito.

## 3. Scryfall — API e imagens
- Fontes: https://scryfall.com/docs/api · https://scryfall.com/docs/terms
- Trechos: *"You may not 'paywall' access to Scryfall data… If you have an account system, end-users should be able to access card data anonymously or with free accounts."* · *"You may not simply repackage, republish, or proxy Scryfall data. Your software must create additional value"* · *"Do not cover, crop, or clip off the copyright or artist name"* · cabeçalhos *User-Agent* (ex.: `RaioX/1.0`) e *Accept* obrigatórios; limites de taxa por endpoint · termos: *"You may not place undue burden on Scryfall through the use of automated means"*.
- O que significa: pode usar (inclusive bulk data) desde que o dado de carta fique acessível de graça; análise de deck = valor agregado, ok. Imagem com nome do artista intacto. Usar o bulk em vez de chamada por carta.

## 4. EDHREC — sem API oficial
- Fonte: https://edhrec.com/terms (robots: https://edhrec.com/robots.txt)
- Trechos: *"limited license to access the Site solely for your own personal, noncommercial use"* · *"you shall not access the Site in order to build a similar or competitive website"* · *"no part of the Site may be copied, reproduced, distributed, republished, downloaded…"* · proíbe *"automated agents or scripts… to generate automated searches, requests, or queries to the Site"*.
- O robots.txt não bloqueia `/commanders`/`json.edhrec.com` (respondeu 200), mas os **termos** proíbem consulta automatizada e republicar.
- O que significa: o ponto mais fraco. Usar EDHREC no produto (temas, decks médios, `oponentes-edhrec.js`) **viola os termos** do jeito que está. Uso de pesquisa/calibração pessoal (offline, banco de validação) é zona cinzenta, mas não pode ir pro site. Saídas: pedir permissão por e-mail ao EDHREC; ou montar os temas/planos com dado próprio + Scryfall (tags) + decks públicos com licença aberta; ou só **linkar** a página do EDHREC.

## 5. LigaMagic
- Fontes: https://www.ligamagic.com.br/?view=avisolegal · https://www.ligamagic.com.br/robots.txt
- Trechos: compromete-se a não *"reproduzir, copiar, distribuir, permitir o acesso público, transformar ou modificar os Conteúdos, a menos que possua a prévia autorização"* · hiperlink *"permitirá única e exclusivamente o acesso a home-page… não criar um frame"* · robots: `Crawl-delay: 360`, bloqueia `/decks/`, `pricehistory`.
- O que significa: **não raspar preço**. Gerar a lista no formato que o usuário cola na "Compra por Lista" (o próprio usuário usa o site) continua ok. Preço dentro do Raio-X só com parceria/autorização.

## Para o Felipe decidir (alimenta a T03)
1. Modelo: **grátis com anúncio/doação** (cabe em tudo, menos EDHREC) × pago (exige autorização da Wizards por escrito — irreal no começo).
2. Forge: abrir o código GPL-3 (recomendo) × FORGE_FX só no servidor.
3. EDHREC: pedir permissão × substituir por dado próprio/Scryfall (recomendo começar a substituir; mexe na T04 "temas EDHREC").
4. Preço: só lista para a LigaMagic, sem preço próprio.

*Não é parecer jurídico; é leitura literal dos textos acima na data.*
