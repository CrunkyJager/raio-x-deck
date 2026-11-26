// Aviso de versão nova (26/11): uma aba aberta desde ontem roda o site de ontem (Felipe viu ⚠ em Kediss e
// Cool but Rude na Mesa ao vivo, que o motor de 25/11 ainda não lia). O index.html publicado traz o nome do pacote
// (assets/index-HASH.js), que muda a cada build: se o publicado for outro, mostra uma faixa para recarregar.
const meu = (document.querySelector('script[type="module"][src*="assets/index-"]') as HTMLScriptElement | null)?.src || '';
const nomeDe = (s: string) => (s.match(/assets\/index-[\w-]+\.js/) || [''])[0];
let avisado = false;

async function confere() {
  if (avisado || !meu || document.hidden) return;
  try {
    const r = await fetch('./index.html?nc=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const novo = nomeDe(await r.text());
    if (novo && novo !== nomeDe(meu)) avisa();
  } catch { /* sem rede: tenta de novo depois */ }
}

function avisa() {
  avisado = true;
  const d = document.createElement('div');
  d.id = 'aviso-versao';
  d.setAttribute('role', 'status');
  d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:calc(100% - 32px);padding:10px 14px;border-radius:10px;background:#e8c35a;color:#1a1a1a;font:600 .95rem/1.3 system-ui,sans-serif;box-shadow:0 4px 16px #0006;display:flex;gap:10px;align-items:center';
  d.innerHTML = '<span>Saiu uma versão nova do Raio-X. Esta aba ainda roda a antiga.</span>';
  const b = document.createElement('button');
  b.textContent = 'Recarregar';
  b.className = 'btn primary';
  b.onclick = () => location.reload();
  d.appendChild(b);
  document.body.appendChild(d);
}

if (meu) {
  setInterval(confere, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) confere(); });
  window.addEventListener('hashchange', confere);
}
