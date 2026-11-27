// T48 (27/11/2026): conta e decks na nuvem (Firebase, projeto raiox-do-deck). Igual ao Grimório Arena do Edgar:
// entrar com Google (ou e-mail e senha) e "Meus decks" no Firestore em usuarios/<uid>/decks/<id> (regras em firestore.rules:
// cada um só lê e grava os próprios). O SDK só carrega quando a pessoa clica em Entrar, ou ao abrir a página se ela já
// tinha entrado antes (marca raiox:logado no localStorage), para a página não ficar mais pesada para quem não usa conta.
// A apiKey do Firebase web é pública por desenho (quem protege os dados são as regras).
const CFG = {
  apiKey: 'AIzaSyACRqJt9UWt3bWJG7AXCV3n1X27_aVgenE',
  authDomain: 'raiox-do-deck.firebaseapp.com',
  projectId: 'raiox-do-deck',
  storageBucket: 'raiox-do-deck.firebasestorage.app',
  messagingSenderId: '308620900555',
  appId: '1:308620900555:web:1566e66c3b7fe52a18c34e',
};

export type DeckSalvo = { id: string; nome: string; lista: string; atualizado: number };
export const conta = $state({ carregando: false, pronto: false, uid: '', nome: '', email: '', decks: [] as DeckSalvo[], erro: '' });

const MARCA = 'raiox:logado';
const marca = (v: boolean) => { try { v ? localStorage.setItem(MARCA, '1') : localStorage.removeItem(MARCA); } catch (e) {} };

let base: Promise<any> | null = null;
function sdk() {
  return base ??= (async () => {
    conta.carregando = true;
    const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(CFG), auth = A.getAuth(app), db = F.getFirestore(app);
    auth.languageCode = 'pt';
    await new Promise<void>(ok => {
      A.onAuthStateChanged(auth, async (u: any) => {
        conta.uid = u ? u.uid : ''; conta.nome = u ? (u.displayName || u.email || '') : ''; conta.email = u ? (u.email || '') : '';
        marca(!!u); conta.decks = []; conta.pronto = true; conta.carregando = false; ok();
        if (u) await listar();
      });
    });
    return { A, F, auth, db };
  })();
}

const msgErro = (e: any) => {
  const c = String(e && e.code || e);
  if (/popup-closed|cancelled-popup/.test(c)) return '';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'E-mail ou senha errados.';
  if (/email-already-in-use/.test(c)) return 'Este e-mail já tem conta: use Entrar.';
  if (/weak-password/.test(c)) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (/invalid-email/.test(c)) return 'E-mail inválido.';
  if (/network/.test(c)) return 'Sem internet.';
  if (/permission/.test(c)) return 'Sem permissão (entre de novo).';
  return 'Não deu certo: ' + c;
};
async function tenta(f: () => Promise<any>) { conta.erro = ''; try { return await f(); } catch (e) { conta.erro = msgErro(e); } }

export async function entrarGoogle() {
  return tenta(async () => {
    const { A, auth } = await sdk(), p = new A.GoogleAuthProvider();
    try { await A.signInWithPopup(auth, p); }
    catch (e: any) { if (/popup-blocked/.test(String(e && e.code))) { marca(true); await A.signInWithRedirect(auth, p); } else throw e; }   // a marca faz a volta do redirect carregar o SDK
  });
}
export async function entrarEmail(email: string, senha: string, criar: boolean) {
  return tenta(async () => {
    const { A, auth } = await sdk();
    await (criar ? A.createUserWithEmailAndPassword : A.signInWithEmailAndPassword)(auth, email.trim(), senha);
  });
}
export async function sair() { return tenta(async () => { const { A, auth } = await sdk(); await A.signOut(auth); }); }

export async function listar() {
  return tenta(async () => {
    const { F, db } = await sdk(); if (!conta.uid) return;
    const q = F.query(F.collection(db, 'usuarios', conta.uid, 'decks'), F.orderBy('atualizado', 'desc'));
    conta.decks = (await F.getDocs(q)).docs.map((d: any) => ({ id: d.id, ...d.data() }));
  });
}
/** salva a lista; mesmo nome (sem diferença de maiúsculas) = atualiza o deck que já existe */
export async function salvar(nome: string, lista: string) {
  return tenta(async () => {
    const { F, db } = await sdk(); if (!conta.uid) return;
    nome = nome.trim().slice(0, 190) || 'Deck sem nome';
    const ja = conta.decks.find(d => d.nome.toLowerCase() === nome.toLowerCase());
    const col = F.collection(db, 'usuarios', conta.uid, 'decks');
    await F.setDoc(ja ? F.doc(col, ja.id) : F.doc(col), { nome, lista: lista.slice(0, 19000), atualizado: Date.now() });
    await listar();
    return true;
  });
}
export async function apagar(id: string) {
  return tenta(async () => { const { F, db } = await sdk(); await F.deleteDoc(F.doc(db, 'usuarios', conta.uid, 'decks', id)); await listar(); });
}
/** ao abrir a página: só carrega o SDK se a pessoa já tinha entrado antes neste navegador */
export function iniciar() { let m = null; try { m = localStorage.getItem(MARCA); } catch (e) {} if (m) sdk(); }
