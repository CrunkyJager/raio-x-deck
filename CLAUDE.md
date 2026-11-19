# Instruções para o Claude (Raio-X do Deck)

## OBJETIVO DO PROJETO (ler antes de tudo — Felipe, 19/11/2026)
O Raio-X existe para **simplificar cada carta no que ela faz e quanto pesa** (ramp, compra, remoção, proteção, plano do comandante…) e com isso **decidir o deck**: o que entra, o que sai, por quê. Isso é `efetiv`/`triangula` em `analise.js`.
- A Mesa simulada e o banco de 30 decks (`ferramentas/calibra/banco*.py`) são **só a prova** de que os pesos acertam. Não são o assunto.
- **Não ler carta adivinhando o inglês com regex.** O Felipe considera isso burro e foi o erro do projeto: cada deck novo exigia ensinar frase nova. Caminho decidido: usar **dados estruturados que já existem** (roteiros de cartas do **Forge**, código aberto/GPL, + Scryfall), baixados uma vez e guardados num arquivo do site, sem IA e sem consulta em tempo de jogo. O bot (mesa.js) é genérico por tipo de efeito, como bot de Arena/Forge.
- Regex atual fica só como reserva para carta sem dado.
- Não calibrar pelos 4 exemplos (Stangg/Krenko/Lathril/Edgar); validar no banco de 30.

Ao começar uma conversa sobre este projeto:

1. **Acesso de escrita ao repositório.** Chame `add_repo` com `owner: CrunkyJager`, `repo: raio-x-deck`, `access: "push"` logo no início (sem testar antes com curl/gh). Clone em `/home/claude/raio-x-deck` com `git clone --depth 1 https://github.com/CrunkyJager/raio-x-deck /home/claude/raio-x-deck`. Se o pedido de push for negado, avise o usuário na hora e peça para ele liberar (ele quer que as mudanças subam direto).
2. **Leia o `NOTAS.md` inteiro** antes de mexer: organização do código, motor, visual e a lista de pendências em ordem.
3. Publicação: o site é o GitHub Pages da branch `main` (https://crunkyjager.github.io/raio-x-deck/). O usuário quer as mudanças na `main` com push no fim de cada rodada. Troque o `?v=AAAAMMDDHHMM` dos scripts e o `window.RAIOX_V` no `index.html` a cada publicação.
4. Testes: `node ferramentas/lacunas.js` (o que o motor ignora) e `node ferramentas/partida.js Stangg 200 5` (200 partidas: erros tem que dar 0). Para ver a página: `python3 -m http.server` e Chrome headless (`/usr/bin/google-chrome` com playwright, se existir).
5. No fim: atualize o `NOTAS.md` (o que mudou e as pendências), faça commit e push.

O usuário fala português; escreva tudo (interface, notas, commits) em português. Ele não gosta de tela apertada e quer ser avisado quando a conversa passar de ~100 mil tokens.
