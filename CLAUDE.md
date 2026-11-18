# Instruções para o Claude (Raio-X do Deck)

Ao começar uma conversa sobre este projeto:

1. **Acesso de escrita ao repositório.** Chame `add_repo` com `owner: CrunkyJager`, `repo: raio-x-deck`, `access: "push"` logo no início (sem testar antes com curl/gh). Clone em `/home/claude/raio-x-deck` com `git clone --depth 1 https://github.com/CrunkyJager/raio-x-deck /home/claude/raio-x-deck`. Se o pedido de push for negado, avise o usuário na hora e peça para ele liberar (ele quer que as mudanças subam direto).
2. **Leia o `NOTAS.md` inteiro** antes de mexer: organização do código, motor, visual e a lista de pendências em ordem.
3. Publicação: o site é o GitHub Pages da branch `main` (https://crunkyjager.github.io/raio-x-deck/). O usuário quer as mudanças na `main` com push no fim de cada rodada. Troque o `?v=AAAAMMDDHHMM` dos scripts e o `window.RAIOX_V` no `index.html` a cada publicação.
4. Testes: `node ferramentas/lacunas.js` (o que o motor ignora) e `node ferramentas/partida.js Stangg 200 5` (200 partidas: erros tem que dar 0). Para ver a página: `python3 -m http.server` e Chrome headless (`/usr/bin/google-chrome` com playwright, se existir).
5. No fim: atualize o `NOTAS.md` (o que mudou e as pendências), faça commit e push.

O usuário fala português; escreva tudo (interface, notas, commits) em português. Ele não gosta de tela apertada e quer ser avisado quando a conversa passar de ~100 mil tokens.
