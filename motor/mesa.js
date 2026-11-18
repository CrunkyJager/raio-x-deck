/* Mesa do Grimório Arena, de Edgar: cada jogador joga o próprio deck. Desde 18/11/2026 o Raio-X tem motor próprio:
   anexos (equipamento/aura), lordes, palavras-chave dadas, gatilhos, marcadores, habilidades ativadas e combate extra (pendência 7). */
/* Arena: mesa de 4 com decks de verdade. Cada jogador joga o proprio deck pelo mesmo modelo de cartas (modelo() do engine.js).
   arena(Ds,seed,{log,T}) -> {venc, turno, fim:[...], st:[por jogador], log, quadros} */

function arena(Ds,seed,cfg){
  cfg=cfg||{};const R=rngDe(seed>>>0),LOG=!!cfg.log,TMAX=cfg.T||20,VIDA=cfg.vida||40;let P=null;
  const log=[],quadros=[];let T=0;
  const NOM=cfg.nomes||Ds.map((D,k)=>k?'Oponente '+k:'Você');
  const diz=(k,tp,txt,c,alvo)=>{if(!LOG)return;log.push({t:T,k,tp,txt,c:c??-1,a:alvo??-1});if(P)foto(k);};

  /* ---------- jogadores ---------- */
  P=Ds.map((D,k)=>{
    const M=D.M,cmdI=D.cmd?D.cmd.i:-1,ci=cmdI>=0?(M[cmdI].ci||''):'';
    let lib=D.base.slice();emb(lib,R);
    const nL=v=>v.filter(i=>M[i].land).length;
    let mao=lib.slice(0,7);
    if(nL(mao)<2||nL(mao)>5){lib=D.base.slice();emb(lib,R);mao=lib.slice(0,7);}
    lib=lib.slice(7);
    const cnt={};for(const i of D.base){const m=M[i];if(m.cri)for(const t of m.tipos||[])if(t!=='*')cnt[t]=(cnt[t]||0)+1;}
    const escolha=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||'';
    return{k,D,M,ci,cmdI,lib,mao,escolha,terr:[],perm:[],gy:[],vida:VIDA,tax:0,zona:cmdI>=0,cmdD:[0,0,0,0],
      vivo:true,aberta:[],tes:0,mortoT:0,causa:'',jogouT:false,
      st:{viu:new Set(),lanc:{},cmdT:0,terrT3:0,terrT5:0,rem:0,wip:0,ctr:0,salvo:0,dano:0,danoRec:0,mortes:0,travou:0}};
  });
  const ordem=P.map((_,k)=>k);emb(ordem,R);
  for(const p of P)p.mao.forEach(i=>p.st.viu.add(i));

  /* ---------- utilidades ---------- */
  const vivos=()=>P.filter(p=>p.vivo);
  const opsDe=p=>P.filter(o=>o.vivo&&o!==p);
  const tem=(p,f)=>p.perm.some(x=>!x.tok&&p.M[x.i][f]);
  const anth=p=>{let s=0;for(const x of p.perm)if(!x.tok&&p.M[x.i].anth)s+=p.M[x.i].anth;return s;};
  /* ---------- Raio-X: anexos, lordes, marcadores, palavras-chave dadas ---------- */
  const mOf=x=>x&&x.i>=0?P[x.k].M[x.i]:null;
  const tiposX=x=>x.i>=0&&!x.cop?(mOf(x).tipos||[]):(x.tipos||[]);
  const ehTipo=(p,x,t)=>{if(!t||t==='*')return true;if(t==='escolha')t=p.escolha;const ts=tiposX(x);return ts.includes(t)||ts.includes('*');};
  const modif=x=>(x.anx&&x.anx.length>0)||(x.cont||0)>0;
  const preso=x=>(x.anx||[]).some(y=>{const m=mOf(y);return m&&m.auraMa;});
  /* bônus calculado fica guardado até o campo mudar (VER sobe a cada entrada, saída, anexo, marcador, ataque ou efeito) */
  let VER=1;
  function bon(p,x){
    if(x._bv===VER)return x._b;
    const b={p:x.cont||0,t:x.cont||0,kw:new Set()};
    for(const y of x.anx||[]){const m=mOf(y);
      if(y.papel){b.p+=1;b.t+=1;b.kw.add('ward');continue;}
      if(!m||!m.da)continue;const d=m.da,q=P[y.k];let n=1;
      if(d.por==='enc')n=q.perm.filter(z=>z.i>=0&&mOf(z).ench).length;
      else if(d.por==='artenc')n=q.perm.filter(z=>z.i>=0&&(mOf(z).ench||mOf(z).a)).length;
      else if(d.por==='anexo')n=x.anx.length;
      else if(d.por==='outroEnc'){n=-1;for(const o of P)if(o.vivo)n+=o.perm.filter(z=>z.i>=0&&mOf(z).ench).length;n=Math.max(0,n);}
      else if(d.por&&d.por.startsWith('tipo:')){const t=d.por.slice(5);n=q.perm.filter(z=>z.cri&&ehTipo(q,z,t)).length;}
      b.p+=d.p*n;b.t+=d.t*n;for(const k of d.kw)b.kw.add(k);}
    for(const z of p.perm){if(z.i<0||z.tok&&!z.cop)continue;const m=mOf(z);if(!m||!m.lorde||z.an)continue;
      for(const L of m.lorde){if(L.outros&&z===x)continue;if(!ehTipo(p,x,L.tipo))continue;if(L.mod&&!modif(x))continue;if(L.atk&&!x.atk)continue;
        let n=1;if(L.por==='fixo2')n=2;else if(L.por&&L.por.startsWith('tipo:'))n=p.perm.filter(w=>w.cri&&ehTipo(p,w,L.por.slice(5))).length;
        b.p+=L.p*n;b.t+=L.t*n;for(const k of L.kw)b.kw.add(k);}}
    if(BRASAO){for(const o of P){if(!o.vivo)continue;for(const z of o.perm)if(z.i>=0&&!z.tok&&mOf(z).brasao){const ts=tiposX(x);if(!ts.length)continue;let n=0;for(const w of p.perm)if(w!==x&&w.cri&&tiposX(w).some(t=>ts.includes(t)||t==='*'))n++;b.p+=n;b.t+=n;}}}
    if(x.kw)for(const k of x.kw)b.kw.add(k);
    if(x.kwT)for(const k of x.kwT)b.kw.add(k);
    x._bv=VER;x._b=b;return b;
  }
  const BRASAO=P.some(p=>p.M.some(m=>m.brasao));
  const temKw=(p,x,k,B)=>{const m=x.i>=0&&!x.tok?p.M[x.i]:null;if(m&&m.kws&&m.kws.includes(k))return true;if(m&&k==='haste'&&(m.has||m.haste))return true;return (B||bon(p,x)).kw.has(k);};
  const poderDe=(p,x)=>{if(!x.cri)return 0;const m=x.tok?null:p.M[x.i];let b=x.p;if(m&&m.bronze)b=p.perm.filter(y=>!y.tok&&p.M[y.i].a).length;const B=bon(p,x);let v=Math.max(0,b+anth(p)+B.p+(x.tmp||0));if(temKw(p,x,'double strike',B))v*=2;return v;};
  const resDe=(p,x)=>{const B=bon(p,x);return x.t+anth(p)+B.t+(x.tmpT??x.tmp??0)-(x.dano||0);};
  const forca=p=>{let s=0;for(const x of p.perm)if(x.cri)s+=poderDe(p,x);return s;};
  const nomeC=(p,i)=>p.M[i].frente||p.M[i].nome;
  const ganha=(p,n)=>{p.vida+=n;if(n>0&&FUNDO>8){laco(p);return;}if(n>0){FUNDO++;for(const z of p.perm.slice())for(const h of habs(z))if(h.q==='ganha')faz(p,z,h.e,{n});FUNDO--;}if(n>0&&tem(p,'ratch')){const j=p.gy.findIndex(g=>p.M[g].a&&!p.M[g].sp&&(p.M[g].cmc||0)<=n);if(j>=0){const c=p.gy.splice(j,1)[0];entra(p,c);}}};
  const protegido=(p,x)=>{if(x.tok)return false;const m=p.M[x.i];if(m.hex)return true;
    for(const y of p.perm){if(y.tok)continue;const n=p.M[y.i];
      if(n.hexA&&(m.a))return true;if(n.hexAO&&m.a&&m.cri&&y!==x)return true;if(n.hexC&&x.cri&&y!==x)return true;
      }
    if(x.cri&&temKw(p,x,'hexproof'))return true;
    return false;};
  const wardBloqueia=(p,o,x)=>{const m=o.M[x.i];const w=m.ward||(m.a&&o.perm.some(y=>!y.tok&&y!==x&&o.M[y.i].wardAO))||(x.cri&&temKw(o,x,'ward'));return !!w&&((T*7+p.k*3+x.i)%5<2);};
  const indes=(p,x)=>{if(x.indT)return true;if(x.cri&&temKw(p,x,'indestructible'))return true;if(x.tok)return false;const m=p.M[x.i];if(m.ind)return true;
    for(const y of p.perm){if(y.tok)continue;const n=p.M[y.i];if(n.indA&&m.a)return true;if(n.indC&&x.cri)return true;}return false;};

  function compra(p,k,motivo){
    for(let j=0;j<k;j++){
      if(!p.lib.length){if(p.vivo){mata(p,'acabou o grimório',-1);}return;}
      const i=p.lib.pop();p.mao.push(i);p.st.viu.add(i);
    }
    if(motivo)diz(p.k,'compra',`compra ${k} (${motivo})`);
  }

  /* ---------- mana ---------- */
  function fontes(p){
    const u=[],lant=tem(p,'lant'),na=p.perm.filter(x=>!x.tok&&p.M[x.i].a).length;
    for(const l of p.terr)if(!l.tap)u.push({s:lant?ANY:l.cor,o:l});
    for(const x of p.perm){if(x.tok||x.tap)continue;const m=p.M[x.i];
      if(m.mana&&!(m.cri&&x.sick))for(let j=0;j<m.mana;j++)u.push({s:m.cor||'',o:x,n:m.mana});
      if(m.manaX&&!(m.cri&&x.sick)){const n=m.manaX==='enc'?p.perm.filter(z=>z.i>=0&&mOf(z).ench).length:P.reduce((s,o)=>s+(o.vivo?o.perm.filter(z=>z.cri&&ehTipo(o,z,m.manaX)).length:0),0);for(let j=0;j<n;j++)u.push({s:ANY,o:x,n});}
      if(m.opal&&na>=3)u.push({s:ANY,o:x});
      if(m.ugin&&x.uMana)for(let j=0;j<3;j++)u.push({s:'',o:x,n:3});
      if(m.amber&&p.perm.some(y=>y.cri&&!y.tok&&p.M[y.i].leg))u.push({s:ANY,o:x});}
    const LM=[];for(const z of p.perm)if(z.i>=0&&!z.tok&&!z.an&&p.M[z.i].lorde)for(const L of p.M[z.i].lorde)if(L.mana)LM.push(L);
    if(LM.length)for(const x of p.perm){if(!x.cri||x.tap||x.sick||x.atk)continue;const m=x.i>=0&&!x.tok?p.M[x.i]:null;if(m&&(m.mana||m.manaX))continue;const L=LM.find(L=>ehTipo(p,x,L.tipo));if(L)u.push({s:L.mana,o:x,n:1});}
    for(let j=0;j<p.tes;j++)u.push({s:ANY,o:'tes'});
    return u;
  }
  function custo(p,i,ehCmd){
    const c=p.M[i];if(c.gratis&&p.perm.some(x=>x.cmd))return{g:0,pip:[]};
    let des=0;
    for(const x of p.perm){if(x.tok)continue;const dd=p.M[x.i].dis;if(!dd)continue;const k=dd[0];
      if(k==='*'||(k==='a'&&c.a)||(k==='C'&&c.inc)||(k==='h'&&(c.hist||c.a))||(k==='c'&&c.cri)||(k==='n'&&!c.cri))des+=dd[1];}
    if(c.blas)des+=P.reduce((s,o)=>s+(o.vivo?o.perm.filter(x=>x.cri).length:0),0);
    if(c.impv)des+=p.perm.filter(x=>!x.tok&&p.M[x.i].a&&!p.M[x.i].mana).length;
    if(c.metal)for(const x of p.perm)if(!x.tok&&p.M[x.i].a&&!p.M[x.i].cri)des+=p.M[x.i].g+p.M[x.i].c;
    if(c.myco)des+=p.perm.filter(x=>!x.tok&&p.M[x.i].a).length;
    if(c.idol)des+=p.perm.filter(x=>x.cri&&!x.tap&&!x.sick).length;
    {const cc=c.custoTxt?corDe(c.custoTxt):'';for(const x of p.perm){if(x.tok||x.i<0||x.an)continue;const dx=p.M[x.i].disX;if(!dx)continue;
      for(const r of dx){if(r.cri&&!c.cri)continue;if(r.cor&&![...r.cor].some(ch=>cc.includes(ch)))continue;if(r.ench&&!c.ench)continue;if(r.art&&!c.a)continue;if(r.sp&&!c.sp)continue;
        if(r.tipo){const t=r.tipo==='escolha'?p.escolha:r.tipo;if(!(c.tipos||[]).includes(t))continue;}des+=r.n;}}}
    if(c.aura&&p.perm.some(x=>x.cri&&x.anx&&x.anx.some(w=>{const mw=mOf(w);return mw&&mw.sb;})))des+=3;
    let g=Math.max(0,c.g-des)+(ehCmd?p.tax:0);
    if(c.x)g+=2;
    return{g,pip:c.pip||[]};
  }
  const tem1=(u,x)=>{for(const ch of x)if(u.indexOf(ch)>=0)return true;return false;};
  function casa(pip,U){
    const us=[],usado=new Uint8Array(U.length);
    for(const x of pip){let bi=-1;for(let j=0;j<U.length;j++){const u=U[j].s;if(usado[j]||!u||!tem1(u,x))continue;if(bi<0||u.length<U[bi].s.length)bi=j;}if(bi<0)return null;usado[bi]=1;us.push(bi);}
    return us;
  }
  function pode(p,i,U,ehCmd,extra){const c=custo(p,i,ehCmd);const tot=c.g+c.pip.length+(extra||0);if(tot>U.length)return false;return casa(c.pip,U)!==null;}
  function paga(p,i,U,ehCmd,extra){
    const c=custo(p,i,ehCmd);const tot=c.g+c.pip.length+(extra||0);if(tot>U.length)return false;
    const us=casa(c.pip,U);if(us===null)return false;
    const fora=[];us.sort((a,b)=>b-a).forEach(j=>fora.push(U.splice(j,1)[0]));
    let g=tot-c.pip.length;U.sort((a,b)=>(a.o==='tes')-(b.o==='tes')||a.s.length-b.s.length);
    while(g-->0&&U.length)fora.push(U.shift());
    for(const f of fora){if(f.o==='tes')p.tes--;else if(f.o.cri!==undefined){f.o.usou=(f.o.usou||0)+1;if(!f.n||f.o.usou>=f.n)f.o.tap=true;}else f.o.tap=true;}
    return true;
  }
  const pagaG=(p,U,k)=>{if(U.length<k)return false;U.sort((a,b)=>a.s.length-b.s.length);for(const f of U.splice(0,k)){if(f.o==='tes')p.tes--;else f.o.tap=true;}return true;};

  /* ---------- permanentes, anexos e morte ---------- */
  function novo(p,i,o){VER++;return Object.assign({i,k:p.k,cri:false,p:0,t:0,sick:true,tap:false,cmd:false,tok:false,anx:[],cont:0},o||{});}
  function entra(p,i,ehCmd,semGat){
    const m=p.M[i];
    const x=novo(p,i,{cri:!!m.cri,p:m.p||0,t:m.t||0,sick:!(m.has||(m.a&&m.cri&&tem(p,'hasteA'))),cmd:!!ehCmd});
    p.perm.push(x);
    if(m.lw){const g=ficha(p,1,0,0,'Germe',{tipos:['phyrexian','germ']},true)[0];if(g)anexa(x,g);}
    if(m.anexaEntra){const h=melhorHost(p,m,x);if(h){anexa(x,h);if(m.morde)morde(p,h,i);}}
    if(!semGat)entrou(p,x);
    return x;
  }
  function ficha(p,n,pw,tg,nome,o,semGat){
    o=o||{};let mult=1;for(const z of p.perm)if(z.i>=0&&!z.tok&&p.M[z.i].dobraFicha)mult*=2;n=Math.min(60,n*mult);
    const out=[];
    for(let j=0;j<n;j++){const x=novo(p,-1,{nome:nome||`Ficha ${pw}/${tg}`,cri:true,p:pw,t:tg,tok:true,tipos:o.tipos||[],kw:o.kw||null,sacFim:o.sac?1:0});
      if(x.kw&&x.kw.includes('haste'))x.sick=false;p.perm.push(x);out.push(x);}
    if(!semGat)for(const x of out)entrou(p,x);
    if(out.length&&o.tipos&&o.tipos.length)diz(p.k,'ficha',`${NOM[p.k]} cria ${out.length} ${nome||'ficha'}${out.length>1?'s':''}`);
    return out;
  }
  function anexa(y,x){VER++;solta(y);y.an=x;x.anx.push(y);const m=mOf(y);if(m&&m.reconf)y.cri=false;}
  function solta(y){VER++;const h=y.an;if(!h)return;const j=h.anx.indexOf(y);if(j>=0)h.anx.splice(j,1);y.an=null;const m=mOf(y);if(m&&m.reconf&&!y.tok)y.cri=true;}
  function morde(p,h,origem){const a=melhorAlvo(p,true,'c');if(!a)return;const pw=poderDe(p,h);if(pw>=resDe(a.o,a.x)&&!indes(a.o,a.x)){diz(p.k,'remo',`${nomeX(p,h)} causa ${pw} de dano em ${nomeX(a.o,a.x)}`,origem,a.o.k);morre(a.o,a.x,false,p.k);}}
  const nomeX=(p,x)=>x.tok&&x.i<0?x.nome:nomeC(p,x.i)+(x.cop?' (cópia)':'');
  /* morre: devolve false se a criatura sobreviveu (umbra) */
  function morre(p,x,exila,quem,sac){
    const k=p.perm.indexOf(x);if(k<0)return false;VER++;
    if(!exila&&!sac&&x.cri){const u=(x.anx||[]).find(y=>{const m=mOf(y);return m&&m.umbra;});
      if(u){x.dano=0;diz(p.k,'resp',`${nomeX(P[u.k],u)} se sacrifica e salva ${nomeX(p,x)} (umbra)`);morre(P[u.k],u,false,quem,true);return false;}}
    p.perm.splice(k,1);
    const m=x.i>=0&&!x.tok?p.M[x.i]:null,pw=x.cri?poderDe(p,x):0,tg=x.cri?Math.max(1,resDe(p,x)+(x.dano||0)):0,mod=modif(x);
    if(x.an)solta(x);
    /* o que estava anexado: aura cai, equipamento fica solto */
    for(const y of (x.anx||[]).slice()){const q=P[y.k],my=mOf(y);
      if(!exila&&my)for(const h of my.hab||[])if(h.q==='hostMorre')faz(q,y,h.e,{x,t:tg,poder:pw});
      solta(y);
      if(y.tok||(my&&my.aura)||y.papel){const j=q.perm.indexOf(y);if(j>=0)morre(q,y,false,quem,true);}}
    if(x.tok){if(x.cri)aoMorrer(p,x,pw,mod,exila);return true;}
    if(x.cmd){p.zona=true;p.tax+=2;diz(p.k,'morte',`${nomeC(p,x.i)} volta pra zona de comando (taxa agora +${p.tax})`);}
    else if(m.rancor&&!exila){p.mao.push(x.i);diz(p.k,'magia',`${nomeC(p,x.i)} volta pra mão`);}
    else if(x.exFim||exila==='ex'){/* exilada */}
    else{if(!m.noGy)p.gy.push(x.i);if(m.mdraw&&!exila)compra(p,1,'Solemn');if(!exila&&m.morte)ficha(p,Math.max(1,Math.round(m.morte/2)),2,2,'Fichas da morte');}
    if(m&&!exila)for(const h of m.hab||[])if(h.q==='auraSai')faz(p,x,h.e,{});
    if(x.cri&&m.a&&p.perm.some(y=>!y.tok&&p.M[y.i].modular)){const y=p.perm.find(z=>z.cri&&!z.tok&&p.M[z.i].a);if(y)y.p++;}
    if(x.cri){p.st.mortes++;aoMorrer(p,x,pw,mod,exila);if(!exila&&m)for(const h of m.hab||[])if(h.q==='morreEu')faz(p,x,h.e,{x,poder:pw});}
    return true;
  }
  /* ---------- efeitos e gatilhos ---------- */
  let FUNDO=0;
  /* ganhar vida -> oponente perde -> ganhar vida... (Vito + Exquisite Blood/Bloodthirsty Conqueror, Sanguine Bond): é laço infinito, vence a mesa */
  function laco(p){if(!p||!p.vivo||p.st.combo)return;p.st.combo=1;diz(p.k,'combo',`${NOM[p.k]} fecha um laço de ganhar e drenar vida (infinito)`);for(const o of opsDe(p))mata(o,'laço de drenar vida de '+NOM[p.k],p.k);}
  function perde(o,n,k){if(n<=0||!o.vivo)return;o.vida-=n;if(k>=0)o.ultDano=k;
    if(FUNDO>8){if(k>=0)laco(P[k]);return;}FUNDO++;for(const q of P){if(!q.vivo||q===o)continue;for(const z of q.perm.slice())for(const h of habs(z))if(h.q==='opPerde')faz(q,z,h.e,{n});}FUNDO--;}
  const habs=z=>{if(z.i<0||(z.tok&&!z.cop))return NADA;const m=mOf(z);return m&&m.hab?m.hab:NADA;};
  const NADA=[];
  function contN(q,z,n,ctx){if(typeof n==='number')return n;if(n==='x')return ctx.n||0;if(n==='dano')return ctx.dano||0;if(n==='poder')return ctx.poder??(z&&z.cri?poderDe(q,z):0);if(n==='t')return ctx.t||0;
    if(String(n).startsWith('tipo:')){const t=n.slice(5);return q.perm.filter(w=>w.cri&&ehTipo(q,w,t)).length;}
    if(String(n).startsWith('atk:')){const t=n.slice(4);return q.perm.filter(w=>w.cri&&w.atk&&ehTipo(q,w,t)).length;}return 1;}
  function melhorMeu(q,f){let b=null,bv=-1e9;for(const x of q.perm){if(!x.cri||x.sacFim||(f&&!f(x)))continue;const v=poderDe(q,x)+(x.cmd?5:0)+(x.atk?2:0);if(v>bv){bv=v;b=x;}}return b;}
  function danoQualquer(q,n,origem,nomeF){
    /* criatura que morre com o dano e vale a pena; senão o oponente com menos vida */
    let b=null,bv=3;for(const o of opsDe(q))for(const x of o.perm){if(!x.cri||protegido(o,x)||indes(o,x))continue;if(resDe(o,x)<=n){const v=valor(o,x);if(v>bv){bv=v;b={o,x};}}}
    const ops=opsDe(q);if(!ops.length)return;const fraco=ops.slice().sort((a,c)=>a.vida-c.vida)[0];
    if(b&&fraco.vida>n){morre(b.o,b.x,false,q.k);diz(q.k,'remo',`${nomeF} causa ${n} de dano em ${nomeX(b.o,b.x)}`,origem,b.o.k);}
    else{perde(fraco,n,q.k);q.st.dano+=n;}
  }
  function faz(q,z,e,ctx){
    if(!q.vivo||!e)return;ctx=ctx||{};VER++;const nm=z?nomeX(q,z):'';const org=z&&z.i>=0?z.i:-1;
    if(e.gemeo&&z){gemeo(q,z,ctx);}
    if(e.fic){const f=e.fic;let n=contN(q,z,f.n,ctx);if(f.porCont)n*=2;
      if(n>0){const t=ficha(q,n,f.p,f.t,f.tipos&&f.tipos.length?f.tipos.map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):'Ficha',{tipos:f.tipos,kw:f.kw,sac:f.sac});
        if(f.atk&&ctx.at){for(const x of t){x.tap=true;x.atk=1;x.sick=false;ctx.at.push(x);}}}}
    if(e.tes){q.tes+=e.tes;}
    if(e.cont){const c=e.cont;let n=contN(q,z,c.n,ctx);for(const w of q.perm)if(w.i>=0&&!w.tok&&q.M[w.i].dobraCont)n*=2;
      let alvos=[];if(c.alvo==='self')alvos=z?[z.an||z]:[];else if(c.alvo==='host')alvos=z&&z.an?[z.an]:[];else if(c.alvo==='mod')alvos=q.perm.filter(w=>w.cri&&modif(w));
      else if(c.alvo==='todos')alvos=q.perm.filter(w=>w.cri).slice(0,4);else if(c.alvo&&c.alvo.startsWith('tipo:'))alvos=q.perm.filter(w=>w.cri&&ehTipo(q,w,c.alvo.slice(5)));else{const b=melhorMeu(q);if(b)alvos=[b];}
      if(z&&z.an&&c.alvo==='self')alvos=[z];
      for(const w of alvos)if(w.cri)w.cont=(w.cont||0)+n;
      if(z&&mOf(z)&&mOf(z).ordalia&&z.an&&(z.an.cont||0)>=3){const h=z.an;morre(q,z,false,-1,true);for(let j=0;j<2;j++)q.terr.push({cor:q.ci||'',tap:true,b:1});diz(q.k,'magia',`${nm} se sacrifica: +2 terrenos (${nomeX(q,h)})`);}}
    if(e.dr){const n=contN(q,z,e.dr,ctx);if(n>0)compra(q,Math.min(n,10),nm);}
    if(e.dren){const n=contN(q,z,e.dren,ctx);let tot=0;const ops=opsDe(q);const alvos=e.drenUm?ops.sort((a,c)=>a.vida-c.vida).slice(0,1):ops;
      for(const o of alvos){perde(o,n,q.k);tot+=n;}ctx.dren=tot;if(tot&&LOG)diz(q.k,'dano',`${nm}: ${alvos.length>1?'cada oponente perde':'perde'} ${n} de vida`);}
    if(e.vida){let n=e.vida==='dren'?(ctx.dren||0):contN(q,z,e.vida,ctx);if(n>0)ganha(q,n);}
    if(e.danoOp){const n=contN(q,z,e.danoOp,ctx);for(const o of opsDe(q))perde(o,n,q.k);if(LOG)diz(q.k,'dano',`${nm}: ${n} de dano em cada oponente`);}
    if(e.espelho&&ctx.dano&&ctx.alvo){for(const o of opsDe(q))if(o!==ctx.alvo)perde(o,ctx.dano,q.k);diz(q.k,'dano',`${nm}: ${ctx.dano} de dano em cada outro oponente`);}
    if(e.danoAlvo){const n=e.danoAlvo==='poder'?(ctx.poder??(z?poderDe(q,z.an||z):0)):contN(q,z,e.danoAlvo,ctx);if(n>0)danoQualquer(q,n,org,nm);}
    if(e.danoCri){const a=melhorAlvo(q,true,'c');if(a&&resDe(a.o,a.x)<=contN(q,z,e.danoCri,ctx)&&!indes(a.o,a.x))morre(a.o,a.x,false,q.k);}
    if(e.danoAtacado&&ctx.alvo){const n=e.danoAtacado==='poder'?poderDe(q,z.an||z):contN(q,z,e.danoAtacado,ctx);if(n>0){perde(ctx.alvo,n,q.k);q.st.dano+=n;diz(q.k,'dano',`${nm}: ${n} de dano em ${NOM[ctx.alvo.k]}`);}}
    if(e.tmp&&z){const w=z.an||z;w.tmp=(w.tmp||0)+(e.tmp.p==='x'?0:e.tmp.p);w.tmpT=(w.tmpT??0)+(e.tmp.t==='x'?0:e.tmp.t);}
    if(e.tmpPor&&z){const t=e.tmpPor;let n=0;for(const w of q.perm)if(w!==z&&w.cri&&(t.startsWith('atk:')?w.atk&&ehTipo(q,w,t.slice(4)):ehTipo(q,w,t.slice(5))))n++;z.tmp=(z.tmp||0)+n*(e.p||1);z.tmpT=(z.tmpT??0)+n*(e.t||0);}
    if(e.tmpTodos){for(const w of q.perm)if(w.cri&&ehTipo(q,w,e.tmpTodos.tipo)){w.tmp=(w.tmp||0)+e.tmpTodos.p;w.tmpT=(w.tmpT??0)+e.tmpTodos.t;}}
    if(e.tmpAlvo){const b=melhorMeu(q,w=>w.atk||!w.sick);if(b){const n=contN(q,z,e.tmpAlvo,ctx);b.tmp=(b.tmp||0)+n;b.tmpT=(b.tmpT??0)+n;}}
    if(e.animo&&ctx.x){const x=ctx.x,ts=tiposX(x);let n=0;for(const w of q.perm)if(w!==x&&w.atk&&tiposX(w).some(t=>ts.includes(t)))n++;x.tmp=(x.tmp||0)+n;}
    if(e.dobra){const b=melhorMeu(q,w=>!w.sick||w.atk);if(b){b.tmp=(b.tmp||0)+poderDe(q,b);b.tmpT=(b.tmpT??0)+Math.max(0,resDe(q,b));}}
    if(e.desvTerr){for(const l of q.terr)l.tap=false;if(LOG)diz(q.k,'magia',`${nm}: desvira todos os terrenos`);}
    if(e.desvMod){for(const w of q.perm)if(w.cri&&modif(w))w.tap=false;}
    if(e.combate&&!q.combX){q.combX=1;}
    if(e.terra){for(let j=0;j<e.terra;j++)q.terr.push({cor:q.ci||'',tap:true,b:1});}
    if(e.recupera){const j=q.gy.findIndex(g=>{const m=q.M[g];return e.recupera==='anexo'?(m.aura||m.eq):(m.tipos||[]).includes(e.recupera);});if(j>=0){const c=q.gy.splice(j,1)[0];q.mao.push(c);diz(q.k,'magia',`${nm}: ${nomeC(q,c)} volta do cemitério pra mão`);}}
    if(e.descobre){const lim=e.descobre;for(let j=q.lib.length-1;j>=0;j--){const c=q.lib[j],m=q.M[c];if(m.land||(m.cmc||0)>lim)continue;q.lib.splice(j,1);diz(q.k,'magia',`${nm}: descobre ${nomeC(q,c)}`);if(m.r||(m.aura&&!melhorHost(q,m)))q.mao.push(c);else resolve(q,c,false);break;}}
    if(e.tempestade){for(const g of q.gy.slice()){const m=q.M[g];if(!m.aura||m.auraMa)continue;const h=melhorHost(q,m);if(!h)break;q.gy.splice(q.gy.indexOf(g),1);const y=entra(q,g,false);y.exFim=1;anexa(y,h);}}
    if(e.papel&&ctx.x&&ctx.x.cri){const y=novo(q,-1,{nome:'Papel real',tok:true,papel:1});q.perm.push(y);anexa(y,ctx.x);}
    if(e.hexMod){for(const w of q.perm)if(w.cri&&modif(w))(w.kwT||(w.kwT=new Set())).add('hexproof');}
  }
  function gemeo(q,z,ctx){
    const t=ficha(q,1,3,4,'Stangg Twin',{tipos:['human','warrior'],sac:1})[0];if(!t)return;
    t.sick=false;t.tap=true;if(ctx.at){t.atk=1;ctx.at.push(t);}
    let nc=0;for(const y of z.anx.slice()){if(y.papel)continue;const c=novo(q,y.i,{k:y.k,tok:true,cop:1,sacFim:1});q.perm.push(c);anexa(c,t);nc++;
      const m=mOf(c);if(m&&m.dr&&m.aura)compra(q,m.dr,nomeX(q,c));entrou(q,c);}
    diz(q.k,'ficha',`${nomeC(q,z.i)} ataca e cria o Stangg Twin (3/4, atacando)${nc?` com cópia de ${nc} aura${nc>1?'s':''}/equipamento${nc>1?'s':''}`:''}`);
  }
  /* algo entrou no campo de p: dispara quem observa */
  function entrou(p,x){
    const m=mOf(x),ehEnc=m&&m.ench,ehAnx=m&&(m.aura||m.eq),ehAura=m&&m.aura;
    for(const z of p.perm.slice()){for(const h of habs(z)){if(h.q!=='entra')continue;
      if(h.f==='cri'){if(!x.cri||x.cop)continue;if(h.outro&&z===x)continue;if(!h.eu&&!h.outro&&z===x)continue;if(!ehTipo(p,x,h.tipo))continue;if(h.pmax!=null&&poderDe(p,x)>h.pmax)continue;}
      else if(h.f==='enc'){if(!ehEnc)continue;if(z===x&&!h.eu)continue;}
      else if(h.f==='anexo'){if(!ehAnx)continue;}
      else if(h.f==='aura'){if(!ehAura)continue;}
      if(h.uma){if(z.usoT===T)continue;z.usoT=T;}
      faz(p,z,h.e,{x});}}
    if(m&&!x.cop)for(const h of m.hab||[])if(h.q==='etb')faz(p,x,h.e,{x});
  }
  function aoMorrer(p,x,pw,mod,exila){
    for(const q of P){if(!q.vivo)continue;for(const z of q.perm.slice())for(const h of habs(z)){if(h.q!=='morre')continue;
      if(h.op&&q===p)continue;if(h.meu&&q!==p)continue;if(h.outro&&z===x)continue;if(h.mod&&!mod)continue;if(!ehTipo(p,x,h.tipo))continue;
      faz(q,z,h.e,{x,poder:pw});}}
  }
  function lancou(p,i){
    const c=p.M[i];
    const ok=h=>h.tipo==='*'||(h.tipo==='enchantment'?c.ench:h.tipo==='creature'?c.cri:h.tipo==='artifact'?c.a:(c.tipos||[]).includes(h.tipo));
    for(const z of p.perm.slice())for(const h of habs(z))if(h.q==='conj'&&ok(h)&&!(h.outro&&z.i===i))faz(p,z,h.e,{});
    if(p.zona&&p.cmdI>=0&&p.cmdI!==i)for(const h of p.M[p.cmdI].hab||[])if(h.q==='conj'&&h.zona&&ok(h))faz(p,null,h.e,{});
  }
  function melhorHost(p,m,ignora){
    if(m.auraMa){const a=melhorAlvo(p,true,'c');return a?a.x:null;}
    const clamp=m.da&&m.da.t<0;
    let b=null,bv=-1e9;
    for(const x of p.perm){if(!x.cri||x===ignora||x.sacFim||x.an)continue;if(m.aura==='m'&&!modif(x))continue;
      let v;
      if(clamp){if(resDe(p,x)!==1)continue;v=10-poderDe(p,x)+(x.tok?3:0);}
      else v=poderDe(p,x)+(x.cmd?6:0)+(x.anx.length*1.5)+(x.tok?-3:0)+((x.sick&&!temKw(p,x,'haste'))?-1:0)+(m.da&&m.da.kw.includes('haste')&&x.sick?2:0);
      if(v>bv){bv=v;b=x;}}
    return b;
  }
  function equipa(p,U){
    for(let volta=0;volta<6;volta++){let feito=false;
      for(const y of p.perm){const m=mOf(y);if(!m||!m.eq||y.tok)continue;
        const h=melhorHost(p,m,y);if(!h||y.an===h)continue;
        if(y.an){if(m.da&&m.da.t<0)continue;const atual=y.an;const v=x=>poderDe(p,x)+(x.cmd?6:0)+x.anx.length*1.5;if(v(h)<v(atual)+4)continue;}
        if(m.reconf&&poderDe(p,h)<2)continue;
        let cu=m.eq;if(h.anx.some(w=>{const mw=mOf(w);return mw&&mw.sb;}))cu=Math.max(0,cu-3);
        if(!pagaG(p,U,cu))continue;
        anexa(y,h);diz(p.k,'magia',`${NOM[p.k]} equipa ${nomeC(p,y.i)} em ${nomeX(p,h)}`,y.i);
        checa();feito=true;break;}
      if(!feito)break;}
  }
  /* habilidades ativadas: {T} de criaturas (Krenko, Lathril, Imperious Perfect...), Kiki-Jiki, Elixir */
  function ativa(p,U){
    const elixir=p.perm.some(z=>!z.tok&&z.i>=0&&p.M[z.i].elixir);
    const pronto=z=>!z.tap&&(!z.sick||elixir||temKw(p,z,'haste'));
    for(const z of p.perm.slice()){if(z.i<0||z.tok||!z.cri)continue;const m=p.M[z.i];
      for(const h of m.hab||[]){if(h.q!=='tap'||!pronto(z))continue;
        if(h.dez){const el=p.perm.filter(w=>w!==z&&w.cri&&!w.tap&&ehTipo(p,w,h.dez));if(el.length<10)continue;for(const w of el.slice(0,10))w.tap=true;z.tap=true;diz(p.k,'magia',`${nomeC(p,z.i)} vira 10 elfos: cada oponente perde 10`,z.i);faz(p,z,h.e,{});continue;}
        if(h.e.fic&&contN(p,z,h.e.fic.n,{})<2&&poderDe(p,z)>=2)continue;
        if(h.custo&&!pagaG(p,U,h.custo))continue;
        z.tap=true;faz(p,z,h.e,{});
        if(elixir&&h.e.fic&&U.length>=1&&pagaG(p,U,1)){z.tap=false;diz(p.k,'magia','Thousand-Year Elixir desvira '+nomeC(p,z.i));faz(p,z,h.e,{});z.tap=true;}}
      if(m.kiki&&pronto(z)){let b=null,bv=-1;for(const w of p.perm)if(w.cri&&!w.tok&&w!==z&&!p.M[w.i].leg){const v=valor(p,w)+((p.M[w.i].hab||[]).some(h=>h.q==='etb')||p.M[w.i].tok?4:0);if(v>bv){bv=v;b=w;}}
        if(b){z.tap=true;const mb=p.M[b.i];const c=novo(p,-1,{nome:'Cópia de '+nomeC(p,b.i),cri:true,p:mb.p||0,t:mb.t||1,tok:true,tipos:mb.tipos||[],kw:[...(mb.kws||[]),'haste'],sacFim:1,sick:false});p.perm.push(c);
          diz(p.k,'ficha',`Kiki-Jiki copia ${nomeC(p,b.i)}`,z.i);if(mb.tok)ficha(p,mb.tokN||1,mb.tokP||1,mb.tokT||1,null,{tipos:mb.tipos&&mb.tipos.includes('goblin')?['goblin']:[]});entrou(p,c);}}}
  }
  /* sacrifício: ficha que vai sumir no fim do turno vira dano; e sacrifica tudo se der para matar alguém */
  function sacrifica(p,U,fimT){
    const outs=p.perm.filter(z=>z.i>=0&&!z.tok&&p.M[z.i].sac);if(!outs.length)return;
    for(const z of outs){const S=p.M[z.i].sac;
      const ok=w=>w.cri&&w!==z&&!w.cmd&&ehTipo(p,w,S.tipo);
      const ops=opsDe(p);if(!ops.length)return;const fraco=ops.slice().sort((a,c)=>a.vida-c.vida)[0];
      const pool=p.perm.filter(ok);const letal=S.dano>0&&pool.length*S.dano>=fraco.vida&&(!S.custo||U.length>=S.custo*Math.ceil(fraco.vida/S.dano));
      const vai=letal?pool:fimT?pool.filter(w=>w.sacFim):[];
      let n=0;for(const w of vai){if(S.custo&&!pagaG(p,U,S.custo))break;if(!fraco.vivo&&S.dano)break;morre(p,w,false,p.k,true);n++;if(S.dano)danoQualquer(p,S.dano,z.i,nomeC(p,z.i));}
      if(n)diz(p.k,'magia',`${nomeC(p,z.i)}: sacrifica ${n} criatura${n>1?'s':''}`,z.i);checa();}
  }
  function mata(p,causa,quem){
    if(!p.vivo)return;p.vivo=false;p.mortoT=T;p.causa=causa;p.quem=quem;
    diz(p.k,'fim',`${NOM[p.k]} está fora: ${causa}`);
    p.perm=[];p.terr=[];VER++;
  }
  function checa(){
    for(const p of P){if(!p.vivo)continue;
      for(const x of p.perm.slice())if(x.cri&&p.perm.includes(x)&&resDe(p,x)<=0){diz(p.k,'morte',`${nomeX(p,x)} fica com resistência 0 e morre`);morre(p,x,false,-1,true);}
      if(p.vivo&&p.vida<=0){
        if(p.perm.some(x=>!x.tok&&p.M[x.i].plat)){p.vida=Math.max(p.vida,0);continue;}
        mata(p,'vida zerada',p.ultDano);}
      for(let j=0;j<4&&p.vivo;j++)if(p.cmdD[j]>=21)mata(p,'21 de dano de comandante de '+NOM[j],j);
    }
  }

  /* ---------- valor de ameaca (pra remocao e ataque) ---------- */
  function valor(p,x){
    if(x.tok)return x.cri?poderDe(p,x)*0.6+(x.anx||[]).length:0;
    const m=p.M[x.i];let v=(x.cri?poderDe(p,x):0);
    if(x.cmd)v+=4;v+=(x.anx||[]).length*1.5;if(m.cada||m.gat||m.tome||m.tokR||(m.hab&&m.hab.length))v+=3;if(m.lorde)v+=2+p.perm.filter(y=>y.cri).length*0.4;if(m.dis)v+=2;if(m.anth)v+=3+p.perm.filter(y=>y.cri).length*0.5;
    if(m.mana&&!x.cri)v+=1;if(m.plat||m.myco||m.tithe)v+=4;if(m.indA||m.indC||m.hexC||m.hexA)v+=3;
    return v;
  }
  function tipoRem(m){const l=(m.txt||'').toLowerCase();
    if(/target (?:nonland )?permanent/.test(l))return'*';if(/target artifact or creature|target creature or artifact/.test(l))return'ac';
    if(/target artifact or enchantment|target enchantment or artifact/.test(l))return'ae';
    if(/target (?:attacking |tapped |nontoken )?creature|any target|creature or planeswalker|that creature/.test(l))return'c';
    if(/target artifact/.test(l))return'a';if(/target enchantment/.test(l))return'e';return'*';}
  function serve(o,x,tp){if(x.cop||x.papel)return false;if(tp==='*')return true;const m=x.tok?{}:o.M[x.i];
    return (tp.includes('c')&&x.cri)||(tp.includes('a')&&m.a)||(tp.includes('e')&&m.ench);}
  function melhorAlvo(p,soCri,tp){
    let b=null,bv=2.5;tp=tp||'*';
    for(const o of opsDe(p))for(const x of o.perm){if(soCri&&!x.cri)continue;if(!serve(o,x,tp))continue;if(protegido(o,x))continue;if(!x.tok&&wardBloqueia(p,o,x))continue;
      const v=valor(o,x)*(1+0.15*(forca(o)>=forca(p)));if(v>bv){bv=v;b={o,x};}}
    return b;
  }

  /* ---------- respostas no turno dos outros ---------- */
  function tentaContra(dono,i,peso){
    /* alguem com contra-magica e mana aberta anula o que for perigoso pra ele */
    for(const o of opsDe(dono)){
      if(peso<6)continue;
      for(const c of o.mao){const m=o.M[c];if(!m.pr||!m.pr.ctr)continue;
        if(!pode(o,c,o.aberta,false))continue;paga(o,c,o.aberta,false);
        o.mao.splice(o.mao.indexOf(c),1);o.gy.push(c);o.st.ctr++;
        diz(o.k,'resp',`${NOM[o.k]} anula ${nomeC(dono,i)} com ${nomeC(o,c)}`);return true;}
    }
    return false;
  }
  function salva(o,tipo,x){
    /* o dono do alvo usa protecao da mao (remocao: r, wipe: w) */
    for(const c of o.mao){const m=o.M[c];if(!m.pr)continue;
      if(tipo==='r'&&!m.pr.r)continue;if(tipo==='w'&&!m.pr.w)continue;if(tipo==='x'&&!m.pr.x)continue;
      if(m.pr.k==='um'&&tipo!=='r')continue;
      if(!pode(o,c,o.aberta,false))continue;paga(o,c,o.aberta,false);
      o.mao.splice(o.mao.indexOf(c),1);o.gy.push(c);o.st.salvo++;
      diz(o.k,'resp',`${NOM[o.k]} responde com ${nomeC(o,c)} e se protege`);
      for(const h of m.hab||[])if(h.q==='sp')faz(o,null,h.e,{x:x||melhorMeu(o)});
      return m.pr;}
    return null;
  }
  function remove(p,alvo,origem){
    const {o,x}=alvo;
    if(salva(o,'r',x))return false;
    const ex=/exile/i.test(p.M[origem]?.txt||'');
    if(indes(o,x)&&!ex){diz(p.k,'remo',`${nomeC(p,origem)} em ${x.tok?x.nome:nomeC(o,x.i)}, mas é indestrutível`);return false;}
    diz(p.k,'remo',`${nomeC(p,origem)} tira ${x.tok?x.nome:nomeC(o,x.i)} de ${NOM[o.k]}`,origem,o.k);
    const foi=morre(o,x,ex,p.k);p.st.rem++;
    if((p.M[origem]?.hab||[]).some(h=>h.q==='sp'&&h.e.fichaDono))ficha(o,1,3,3,'Fera 3/3',{tipos:['beast']});
    return foi;
  }
  function instantaneaNoAtaque(def,atk,atacantes){
    /* defensor usa remocao instantanea no maior atacante */
    const big=atacantes.slice().filter(x=>x.cri).sort((a,b)=>poderDe(atk,b)-poderDe(atk,a))[0];
    if(!big||poderDe(atk,big)<4||protegido(atk,big))return;
    for(const c of def.mao){const m=def.M[c];if(!(m.sp&&m.rem>=1)||!/\bInstant\b/.test(m.tl))continue;
      if(!pode(def,c,def.aberta,false))continue;paga(def,c,def.aberta,false);def.mao.splice(def.mao.indexOf(c),1);def.gy.push(c);
      if(remove(def,{o:atk,x:big},c)){atacantes.splice(atacantes.indexOf(big),1);}return;}
  }

  /* ---------- lancar ---------- */
  function wipe(p,i){
    const m=p.M[i],na=m.wip.na;
    diz(p.k,'wipe',`a mesa é limpa${na?' (menos artefatos)':''}`,i);p.st.wip++;
    for(const o of vivos()){
      const pr=o!==p&&salva(o,'w');
      for(const x of o.perm.slice()){if(!x.cri)continue;if(na&&!x.tok&&o.M[x.i].a)continue;
        if(pr&&(pr.k==='fase'||pr.k==='hi'||pr.ind||pr.volta))continue;
        if(indes(o,x))continue;morre(o,x,false,p.k);}
    }
  }
  function resolve(p,i,ehCmd){
    const m=p.M[i];
    p.st.lanc[i]=(p.st.lanc[i]||0)+1;
    lancou(p,i);
    if(!m.land&&!(m.pip&&m.pip.length)){for(const y of p.perm)if(!y.tok&&p.M[y.i].uginX){const a=melhorAlvo(p,false,'*');if(a)remove(p,a,y.i);}}
    if(m.uginX){const a=melhorAlvo(p,false,'*');if(a)remove(p,a,i);}
    /* gatilhos de quem ja esta em campo */
    for(const x of p.perm){if(x.tok)continue;const g=p.M[x.i].gat;if(!g||!g.cast)continue;
      const t=g.t;if(t==='*'||(t==='a'&&m.a)||(t==='c'&&m.cri)||(t==='h'&&(m.hist||m.a))||(t==='n'&&!m.cri))compra(p,1);}
    for(const x of p.perm){if(x.tok)continue;const r=p.M[x.i].tokR;if(r&&/cast/.test(p.M[x.i].txt.toLowerCase()))ficha(p,1,r.p,r.t);}
    if(m.sp){
      if(m.wip){wipe(p,i);}
      if(m.rem&&!(m.remMetal&&p.perm.filter(x=>!x.tok&&p.M[x.i].a).length<3)){const a=melhorAlvo(p,false,tipoRem(m));if(a&&remove(p,a,i)&&m.giveLand)a.o.terr.push({cor:a.o.ci||'',tap:true,b:1});}
      if(m.wake){const vol=p.gy.filter(j=>p.M[j].a&&!p.M[j].sp);for(const j of vol){p.gy.splice(p.gy.indexOf(j),1);const e=entra(p,j);e.sick=false;}diz(p.k,'magia',`${nomeC(p,i)} devolve ${vol.length} artefatos do cemitério`);}
      if(m.dr)compra(p,m.dr);
      if(m.sham)compra(p,p.perm.filter(x=>x.cri).length);
      if(m.ret)compra(p,Math.max(0,...p.perm.filter(x=>x.cri).map(x=>poderDe(p,x))));
      if(m.ferocious)ganha(p,4*p.perm.filter(x=>x.cri&&poderDe(p,x)>=4).length);
      if(m.ramp){for(let j=0;j<m.ramp;j++)p.terr.push({cor:p.ci||'',tap:true,b:1});}
      if(m.tok)ficha(p,m.tokN||1,m.tokP||1,m.tokT||1);
      if(m.tut)tutor(p,m.tut);
      for(const h of m.hab||[])if(h.q==='sp'&&!h.e.fichaDono)faz(p,null,h.e,{x:melhorMeu(p)});
      p.gy.push(i);
    }else{
      let host=null;
      if(m.aura){host=melhorHost(p,m);if(!host){p.gy.push(i);diz(p.k,'magia',`${nomeC(p,i)} fica sem alvo e vai pro cemitério`);return;}}
      const x=entra(p,i,ehCmd,!!m.aura);
      if(host){anexa(x,host);diz(p.k,'magia',`${nomeC(p,i)} entra em ${nomeX(host.k===p.k?p:P[host.k],host)}`,i);entrou(p,x);if(m.morde)morde(p,host,i);checa();}
      if(m.lifeETB)ganha(p,m.lifeETB);
      if(m.dr)compra(p,m.dr);
      if(m.ramp){for(let j=0;j<m.ramp;j++)p.terr.push({cor:p.ci||'',tap:true,b:1});}
      if(m.tok)ficha(p,m.tokN||1,m.tokP||1,m.tokT||1);
      if(m.remEtb){const a=melhorAlvo(p,false,tipoRem(m));if(a)remove(p,a,i);}
      if(m.tut)tutor(p,m.tut);
      if(m.iron){const j=p.gy.findIndex(j=>p.M[j].a&&!p.M[j].sp);if(j>=0){const c=p.gy.splice(j,1)[0];entra(p,c);diz(p.k,'magia',`devolve ${nomeC(p,c)} do cemitério`);}}
    }
  }
  function tutor(p,tt){
    let b=-1,bv=-1;
    for(let j=0;j<p.lib.length;j++){const c=p.M[p.lib[j]];if(c.land)continue;
      const t=tt.t;if(t!=='*'&&!((t.includes('a')&&c.a)||(t.includes('c')&&c.cri)||(t.includes('e')&&c.ench)||(t.includes('i')&&c.sp)))continue;
      let v=nota(p,p.lib[j],true);for(const ix of pecas[p.k])if(ix.includes(p.lib[j])&&ix.some(q=>q!==p.lib[j]&&(p.mao.includes(q)||p.perm.some(x=>x.i===q)||q===p.cmdI)))v+=30;
      if(v>bv){bv=v;b=j;}}
    if(b<0)return;const c=p.lib.splice(b,1)[0];
    if(tt.campo&&!p.M[c].sp){entra(p,c);diz(p.k,'tutor',`busca ${nomeC(p,c)} direto pro campo`);}
    else{p.mao.push(c);p.st.viu.add(c);diz(p.k,'tutor',`busca ${nomeC(p,c)}`);}
    emb(p.lib,R);
  }
  /* quanto vale lancar a carta agora */
  function nota(p,i,ehCmd){
    const m=p.M[i];if(m.land)return -1;
    if(m.r||(m.pr&&!m.wip))return -1;
    const fo=forca(p),maxO=Math.max(0,...opsDe(p).map(forca)),cedo=T<=6;
    if(m.wip){const na=m.wip.na;let meu=0,deles=0;
      for(const o of vivos())for(const x of o.perm){if(!x.cri)continue;if(na&&!x.tok&&o.M[x.i].a)continue;if(o===p)meu+=poderDe(o,x)+1;else deles+=poderDe(o,x)+1;}
      return deles>=meu+8&&deles>=10?9+deles/5:-1;}
    if(m.sp&&m.rem){const a=melhorAlvo(p,false,tipoRem(m));if(!a)return -1;if(/\bInstant\b/.test(m.tl)&&valor(a.o,a.x)<5)return -1;return 4+valor(a.o,a.x)/2;}
    if(m.wake)return p.gy.filter(j=>p.M[j].a&&!p.M[j].sp).length>=3?8:-1;
    let v=1;
    if(m.mana||m.ramp||m.tithe||m.opal||m.amber)v+=cedo?9:2;
    if(m.dis)v+=cedo?7:3;
    if(m.cada||m.gat||m.tome||m.slate||m.me)v+=6;
    if(m.dr&&m.sp)v+=3+m.dr*0.7;
    if(m.sham)v+=p.perm.filter(x=>x.cri).length*0.8;
    if(m.tut)v+=4;
    if(m.cri)v+=2+(m.p||0)*0.8+(m.ev?1.5:0)+(m.has?1:0)+(m.ind||m.hex?1:0);
    if(m.tok)v+=2+m.tok*0.8;if(m.tokR)v+=3;
    if(m.anth)v+=2+p.perm.filter(x=>x.cri).length*m.anth*0.7;
    if(m.remEtb)v+=melhorAlvo(p,false,tipoRem(m))?4:0;
    if(m.hexA||m.hexAO||m.hexC||m.indA||m.indC||m.boots)v+=p.perm.length>=4?4:1;
    if(m.myco||m.metal||m.magnus)v+=3;
    if(m.aura){if(m.auraMa){const a=melhorAlvo(p,true,'c');return a?4+valor(a.o,a.x)/2:-1;}const h=melhorHost(p,m);if(!h)return -1;const d=m.da||{p:0,t:0,kw:[]};v+=2+(d.p+d.t)*0.6+d.kw.length*0.8+(m.umbra?1.5:0)+(h.cmd?1:0)+(m.hab||[]).length;}
    if(m.eq){const d=m.da||{p:0,t:0,kw:[]};v+=1.5+(d.p+d.t)*0.4+d.kw.length*0.6+(m.lw?2:0);if(!p.perm.some(x=>x.cri)&&!m.lw)v-=1;}
    if(m.lorde)for(const L of m.lorde){const n=p.perm.filter(x=>x.cri&&ehTipo(p,x,L.tipo)).length;v+=n*((L.p+L.t)*0.35+L.kw.length*0.3)+(L.mana?n*0.8:0);}
    if(m.disX)v+=cedo?5:2;
    if(m.hab&&m.hab.length)v+=Math.min(6,m.hab.length*2);
    if(m.sac||m.kiki||m.brasao)v+=3;
    if(ehCmd===true&&p.cmdI===i)v+=4;
    if(fo+6<maxO&&m.cri)v+=1.5;
    return v+(m.g+m.c)*0.15;
  }
  function fase(p){
    /* lanca o melhor que cabe, ate nao caber mais nada */
    let U=fontes(p);
    for(let volta=0;volta<30;volta++){
      let b=null,bv=0;
      for(const i of new Set(p.mao)){const v=nota(p,i);if(v<=bv||!pode(p,i,U,false))continue;b={i,cmd:false};bv=v;}
      if(p.zona&&p.cmdI>=0){const v=nota(p,p.cmdI,true);if(v>bv&&pode(p,p.cmdI,U,true)){b={i:p.cmdI,cmd:true};bv=v;}}
      if(!b)break;
      paga(p,b.i,U,b.cmd);U=fontes(p);
      if(b.cmd){p.zona=false;if(!p.st.cmdT)p.st.cmdT=T;}else p.mao.splice(p.mao.indexOf(b.i),1);
      const m=p.M[b.i],peso=(m.wip?8:0)+(m.cri?(m.p||0):0)+(b.cmd?3:0)+(m.tut?3:0)+(m.cada||m.gat?3:0);
      diz(p.k,'magia',`${NOM[p.k]} lança ${nomeC(p,b.i)}${b.cmd?' (comandante'+(p.tax?`, taxa +${p.tax}`:'')+')':''}`,b.i);
      if(tentaContra(p,b.i,peso)){if(b.cmd){p.zona=true;p.tax+=2;}else if(!m.sp)p.gy.push(b.i);else p.gy.push(b.i);continue;}
      resolve(p,b.i,b.cmd);
      checa();if(!p.vivo)return;
    }
    U=fontes(p);equipa(p,U);if(!p.vivo)return;
    p.aberta=fontes(p);
  }

  /* ---------- combate ---------- */
  /* quem pode bloquear x (atacante de p) entre os bloqueadores livres de alvo */
  function bloqueiam(p,x,alvo,livres){
    const B=bon(p,x),k=w=>temKw(p,x,w,B);
    if(k('imbloq'))return [];
    for(const [w,c] of [['mountainwalk','R'],['forestwalk','G'],['swampwalk','B'],['islandwalk','U'],['plainswalk','W']])if(k(w)&&(alvo.ci||'').includes(c))return [];
    if(!x.tok&&p.M[x.i]&&p.M[x.i].ev&&!(p.M[x.i].kws||[]).length&&R()<.75)return [];
    let L=livres;
    if(k('flying')||k('evasao'))L=L.filter(b=>temKw(alvo,b,'flying')||temKw(alvo,b,'reach'));
    if(k('menace')&&L.length<2)return [];
    return L;
  }
  function combate(p,extra){
    const ops=opsDe(p);if(!ops.length)return;
    let at=p.perm.filter(x=>x.cri&&(!x.sick||temKw(p,x,'haste'))&&!x.tap&&poderDe(p,x)>0&&(x.tok||!p.M[x.i].dfd)&&!preso(x));
    if(!at.length)return;
    /* alvo: quem da pra matar, senao o mais forte com vida baixa */
    const total=at.reduce((s,x)=>s+poderDe(p,x),0);
    let alvo=null,bv=-1e9;
    for(const o of ops){const bl=o.perm.filter(x=>x.cri&&!x.tap).length;
      let v=forca(o)*0.6+(VIDA-o.vida)*0.7-bl*1.5+R()*4;
      if(total>=o.vida+bl*2)v+=50;
      if(v>bv){bv=v;alvo=o;}}
    /* segura bloqueador se a mesa ameaca */
    const perigo=Math.max(...ops.map(forca));
    at.sort((a,b)=>poderDe(p,b)-poderDe(p,a));
    if(p.vida<=perigo*1.2&&at.length>2){const fica=at.slice().filter(x=>!temKw(p,x,'vigilance')).sort((a,b)=>resDe(p,b)-resDe(p,a))[0];if(fica)at.splice(at.indexOf(fica),1);}
    /* nao manda quem morre de graca pra bloqueador maior */
    const blq=alvo.perm.filter(x=>x.cri&&!x.tap&&!preso(x));
    at=at.filter(x=>{if(x.tok&&blq.length>at.length)return true;if(!bloqueiam(p,x,alvo,blq).length)return true;
      return !blq.some(b=>poderDe(alvo,b)>=resDe(p,x)&&resDe(alvo,b)>poderDe(p,x)&&!(b.tok&&poderDe(p,x)>=3))||poderDe(p,x)>=5||at.length>=blq.length+2;});
    if(!at.length)return;
    instantaneaNoAtaque(alvo,p,at);
    if(!at.length)return;
    for(const x of p.perm)x.atk=0;for(const x of at)x.atk=1;VER++;
    {let pk=0;for(const y of p.perm)if(!y.tok&&p.M[y.i].pump)pk=Math.max(pk,p.M[y.i].pump);
     if(pk)for(const y of p.perm)if(y.cri&&!(!y.tok&&p.M[y.i].pump)){y.tmp=(y.tmp||0)+pk;y.tmpT=(y.tmpT??0)+pk;y.indT=1;}
     for(const x of at){const m=!x.tok&&p.M[x.i];if(m&&m.remAtk&&R()<.6){const a=melhorAlvo(p,true,'*');if(a)remove(p,a,x.i);if(m.prowl&&R()<.5)compra(p,1,'Prowl');}}}
    for(const x of at)if(!temKw(p,x,'vigilance'))x.tap=true;
    diz(p.k,'ataque',`${NOM[p.k]} ataca ${NOM[alvo.k]} com ${at.length} criatura${at.length>1?'s':''}${extra?' (combate extra)':''}`,-1,alvo.k);
    /* gatilhos de ataque */
    const ctx={at,alvo};
    for(const x of at.slice()){
      for(const h of habs(x))if(h.q==='atk'&&h.quem!=='host')faz(p,x,h.e,{...ctx,x});
      for(const y of (x.anx||[]).slice()){const my=mOf(y);if(!my)continue;
        for(const h of my.hab||[])if(h.q==='atk'&&h.quem==='host')faz(P[y.k],y,h.e,{...ctx,x});
        for(const h of my.daHab||[])if(h.q==='atk')faz(p,y,h.e,{...ctx,x});}}
    for(const z of p.perm.slice())for(const h of habs(z)){
      if(h.q==='ataque'){faz(p,z,h.e,ctx);continue;}
      if(h.q!=='atkTipo')continue;
      if(h.uma){if(z.usoT===T)continue;}
      const quem=at.filter(x=>p.perm.includes(x)&&ehTipo(p,x,h.tipo)&&(!h.mod||modif(x))&&(h.pmax==null||poderDe(p,x)<=h.pmax)&&(!h.nt||!x.tok));
      if(!quem.length)continue;if(h.uma)z.usoT=T;
      if(h.um)faz(p,z,h.e,ctx);else for(const x of quem)faz(p,z,h.e,{...ctx,x});}
    checa();if(!p.vivo||!alvo.vivo)return;
    if(LOG)diz(p.k,'ataque',`${at.filter(x=>p.perm.includes(x)).length} atacando, ${at.reduce((s,x)=>s+(p.perm.includes(x)?poderDe(p,x):0),0)} de poder`,-1,alvo.k);
    let livres=blq.filter(b=>alvo.perm.includes(b));const inc=at.reduce((s,x)=>s+poderDe(p,x),0);
    let dano=0,cmdDano=0;const golpes=[];
    for(const x of at){
      if(!p.perm.includes(x))continue;
      const pw=poderDe(p,x),B=bon(p,x),k=w=>temKw(p,x,w,B);
      const pode=bloqueiam(p,x,alvo,livres);
      let b=null;
      if(pode.length){
        const mata=pode.filter(y=>poderDe(alvo,y)>=resDe(p,x)||temKw(alvo,y,'deathtouch'));
        const sobra=mata.filter(y=>resDe(alvo,y)>pw&&!k('deathtouch'));
        if(sobra.length)b=sobra[0];
        else if(mata.length&&pw>=4)b=mata.sort((a,c)=>valor(alvo,a)-valor(alvo,c))[0];
        else if(inc-dano>=alvo.vida||(pw>=8&&alvo.vida<=12))b=pode.slice().sort((a,c)=>valor(alvo,a)-valor(alvo,c))[0];
      }
      if(b){livres.splice(livres.indexOf(b),1);
        const bp=poderDe(alvo,b),rb=resDe(alvo,b),ra=resDe(p,x);
        const f1=k('first strike')||k('double strike'),f2=temKw(alvo,b,'first strike')||temKw(alvo,b,'double strike');
        const morreA=(bp>=ra||temKw(alvo,b,'deathtouch'))&&!indes(p,x)&&!(f1&&!f2&&(pw>=rb||k('deathtouch')));
        const morreB=(pw>=rb||k('deathtouch'))&&!indes(alvo,b)&&!(f2&&!f1&&(bp>=ra||temKw(alvo,b,'deathtouch')));
        if(LOG)diz(alvo.k,'bloqueio',`${nomeX(p,x)} é bloqueado por ${nomeX(alvo,b)}${morreA&&morreB?': os dois morrem':morreA?': atacante morre':morreB?': bloqueador morre':''}`);
        if(k('lifelink'))ganha(p,Math.min(pw,Math.max(rb,1)));
        const sobraT=k('trample')?Math.max(0,pw-(k('deathtouch')?1:Math.max(0,rb))):0;
        if(morreB)morre(alvo,b,false,p.k);if(morreA)morre(p,x,false,alvo.k);
        if(sobraT>0&&!(morreA&&f2&&!f1)){dano+=sobraT;golpes.push([x,sobraT]);if(x.cmd){cmdDano+=sobraT;alvo.cmdD[p.k]+=sobraT;}if(k('lifelink'))ganha(p,sobraT);}
      }else{const inf=k('infect')?4:1;dano+=pw*inf;golpes.push([x,pw]);if(x.cmd){cmdDano+=pw;alvo.cmdD[p.k]+=pw;}if(k('lifelink'))ganha(p,pw);
        if(!x.tok&&p.M[x.i].geode&&p.zona&&p.cmdI>=0){p.zona=false;if(!p.st.cmdT)p.st.cmdT=T;diz(p.k,'magia',`${nomeC(p,x.i)}: comandante entra de graça`);resolve(p,p.cmdI,true);}}
    }
    if(dano){perde(alvo,dano,p.k);p.st.dano+=dano;alvo.st.danoRec+=dano;
      diz(p.k,'dano',`${dano} de dano em ${NOM[alvo.k]}${cmdDano?` (${cmdDano} de comandante, total ${alvo.cmdD[p.k]})`:''}: fica com ${alvo.vida}`);}
    /* gatilhos de dano de combate em jogador */
    for(const [x,d] of golpes){if(d<=0)continue;const c2={alvo,dano:d,x};
      for(const h of habs(x))if(h.q==='danoJog'&&h.quem!=='host')faz(p,x,h.e,c2);
      for(const y of (x.anx||[]).slice()){const my=mOf(y);if(!my)continue;for(const h of my.daHab||[])if(h.q==='danoJog')faz(p,y,h.e,c2);for(const h of my.hab||[])if(h.q==='danoJog'&&h.quem==='host')faz(P[y.k],y,h.e,c2);}
      for(const z of p.perm.slice())for(const h of habs(z))if(h.q==='danoJogTipo'&&(h.cmd?x.cmd:(ehTipo(p,x,h.tipo)&&(!h.mod||modif(x)))))faz(p,z,h.e,c2);}
    for(const y of p.perm){y.tmp=0;y.tmpT=undefined;y.indT=0;y.atk=0;}VER++;
    checa();
    if(p.combX===1&&p.vivo){p.combX=2;combate(p,true);}
  }

  /* ---------- combos conhecidos ---------- */
  const CB=(cfg.combos||COMBOS).map(c=>c.map(norm));
  const pecas=P.map(p=>{if(p.D._pc)return p.D._pc;const nm=new Map();p.M.forEach((m,j)=>{nm.set(norm(m.nome),j);nm.set(norm(m.frente),j);});
    const out=[];for(const c of CB){const ix=c.map(n=>nm.has(n)?nm.get(n):-1);if(ix.every(j=>j>=0))out.push(ix);}
    try{Object.defineProperty(p.D,'_pc',{value:out,enumerable:false});}catch(e){}return out;});
  function combo(p){
    for(const ix of pecas[p.k]){
      const fora=ix.filter(j=>!p.perm.some(x=>x.i===j));
      if(!fora.every(j=>p.mao.includes(j)||(j===p.cmdI&&p.zona)))continue;
      let U=fontes(p);if(!fora.every(j=>pode(p,j,U,j===p.cmdI)))continue;
      const tot=fora.reduce((s,j)=>{const c=custo(p,j,j===p.cmdI);return s+c.g+c.pip.length;},0)+1;if(tot>U.length)continue;
      const nomes=ix.map(j=>nomeC(p,j)).join(' + ');
      diz(p.k,'combo',`${NOM[p.k]} monta o combo ${nomes}`,ix[0]);
      for(const j of fora){paga(p,j,U,j===p.cmdI);if(j===p.cmdI)p.zona=false;else p.mao.splice(p.mao.indexOf(j),1);}
      if(tentaContra(p,fora[fora.length-1]??ix[0],20)){return false;}
      p.st.combo=1;
      for(const o of opsDe(p))mata(o,'combo '+nomes,p.k);
      return true;
    }
    return false;
  }

  /* ---------- turno ---------- */
  function joga(p,primeiro){
    for(const l of p.terr)l.tap=false;
    for(const x of p.perm){if(!(x.anx||[]).some(y=>{const m=mOf(y);return m&&m.auraMa&&/doesn't untap/i.test(m.txt);}))x.tap=false;x.sick=false;x.usou=0;x.dano=0;x.atk=0;x.kwT=null;}
    p.combX=0;VER++;
    for(const q of vivos())if(q!==p&&tem(q,'clock')){for(const y of q.perm)if(!y.tok&&q.M[y.i].a)y.tap=false;q.aberta=fontes(q);}
    for(const x of p.perm)if(!x.tok&&p.M[x.i].ugin)x.uMana=p.mao.length>=4;
    for(const q of P){if(!q.vivo)continue;for(const z of q.perm.slice())for(const h of habs(z))if(h.q==='upkeep'&&(q===p||h.todos))faz(q,z,h.e,{});}
    if(!primeiro)compra(p,1);if(!p.vivo)return;
    for(const x of p.perm){if(x.tok)continue;const m=p.M[x.i];
      if(m.cada)compra(p,1,nomeC(p,x.i));
      if(m.pain&&(T+x.i)%3===0)p.vida-=1; /* so dói quando dá mana colorida, ~1 turno em 3 */
      if(m.uin)ficha(p,1,2,2,'Espírito de Ugin');
      if(m.ugin&&!x.uMana){x.uL=(x.uL||7)+2;compra(p,1,nomeC(p,x.i));ganha(p,3);
        if(x.uL>=11&&!x.uU){x.uU=1;x.uL-=11;const ok=[];for(let j=p.lib.length-1;j>=0;j--){const mm=p.M[p.lib[j]];if(!mm.land&&!mm.sp&&!mm.pw&&!(mm.pip&&mm.pip.length)){ok.push(p.lib[j]);p.lib.splice(j,1);}}for(const j of ok){const e=entra(p,j);e.sick=false;}diz(p.k,'magia',`${nomeC(p,x.i)}: -11 solta ${ok.length} artefatos incolores`);}}
      if(m.tithe)p.tes+=Math.round(opsDe(p).length*0.6);
      if(m.tokR&&/upkeep|end step/.test(m.txt.toLowerCase()))ficha(p,m.tokR.n,m.tokR.p,m.tokR.t);
      if(m.tome&&p.mao.length<3&&!x.tomeU){x.tomeU=(x.tomeU||0)+1;if(x.tomeU<=4)compra(p,1,nomeC(p,x.i));}}
    if(!p.vivo)return;
    /* terreno: o que da a cor que falta na mao */
    const ls=p.mao.filter(i=>p.M[i].land);
    if(ls.length){
      const falta={};for(const i of p.mao){const m=p.M[i];if(m.land)continue;for(const c of m.pip||[])for(const ch of c)falta[ch]=(falta[ch]||0)+1;}
      const tem_=new Set(p.terr.map(l=>l.cor).join(''));
      let b=ls[0],bv=-1;for(const i of ls){const cor=p.M[i].cor||'';let v=0;for(const ch of cor)if(!tem_.has(ch))v+=(falta[ch]||0)+.5;if(cor===ANY)v+=1;if(v>bv){bv=v;b=i;}}
      p.mao.splice(p.mao.indexOf(b),1);
      const m=p.M[b];p.terr.push({cor:m.cor||'',tap:/enters (?:the battlefield )?tapped/i.test(m.txt)&&!/unless/i.test(m.txt),i:b});
      diz(p.k,'terreno',`baixa ${nomeC(p,b)} (${p.terr.length} terrenos)`,b);
    }
    {const mi=p.gy.findIndex(j=>p.M[j].metalrec);if(mi>=0&&p.perm.filter(x=>!x.tok&&p.M[x.i].a).length>=6){const sac=p.perm.filter(x=>!x.tok&&p.M[x.i].a&&!p.M[x.i].mana&&!p.M[x.i].cri&&!x.cmd).slice(0,2);if(sac.length===2){for(const s of sac)morre(p,s,true);p.mao.push(p.gy.splice(mi,1)[0]);diz(p.k,'magia','Metalwork Colossus volta pra mão');}}}
    if(combo(p))return;
    if(T===3)p.st.terrT3=p.terr.length;if(T===5)p.st.terrT5=p.terr.length;
    fase(p);if(!p.vivo)return;
    ativa(p,fontes(p));checa();if(!p.vivo)return;
    for(const z of p.perm.slice())for(const h of habs(z))if(h.q==='combate')faz(p,z,h.e,{});
    combate(p);if(!p.vivo)return;
    /* segunda fase: o que sobrou */
    fase(p);if(!p.vivo)return;
    ativa(p,fontes(p));sacrifica(p,fontes(p),false);checa();if(!p.vivo)return;
    /* fim do turno: gatilhos, fichas que se sacrificam, auras do Storm Herald */
    for(const z of p.perm.slice())for(const h of habs(z))if(h.q==='fim')faz(p,z,h.e,{});
    sacrifica(p,fontes(p),true);
    {const sai=p.perm.filter(x=>x.sacFim||x.exFim);if(sai.length){for(const x of sai)if(p.perm.includes(x))morre(p,x,!!x.exFim,-1,true);if(sai.some(x=>x.sacFim&&x.cri))diz(p.k,'morte',`fim do turno: ${sai.filter(x=>x.cri).length} ficha${sai.length>1?'s':''} temporária${sai.length>1?'s':''} sacrificada${sai.length>1?'s':''}`);}}
    checa();if(!p.vivo)return;
    /* descarte */
    while(p.mao.length>7&&!tem(p,'semLimite')){let w=0,wv=1e9;p.mao.forEach((i,j)=>{const v=p.M[i].land?(p.terr.length>=6?-1:5):nota(p,i);if(v<wv){wv=v;w=j;}});p.gy.push(p.mao.splice(w,1)[0]);}
    p.aberta=fontes(p);
  }
  function quadro(k){if(LOG)foto(k);}
  function foto(k){
    quadros.push({t:T,k,log:log.length,j:P.map(p=>({vida:p.vida,vivo:p.vivo,terr:p.terr.length,tes:p.tes,mao:p.mao.slice(),lib:p.lib.length,zona:p.zona,tax:p.tax,cmdD:p.cmdD.slice(),
      perm:p.perm.filter(x=>!x.an).map(x=>{const o={n:nomeX(p,x),p:x.cri?poderDe(p,x):null,t:x.cri?resDe(p,x):null,c:x.cmd?1:0,tok:x.tok?1:0,tap:x.tap?1:0,atk:x.atk?1:0,i:x.tok&&!x.cop?-1:x.i};
        if(x.cri){const b0=x.tok&&x.i<0?{p:x.p,t:x.t}:{p:p.M[x.i].p||0,t:p.M[x.i].t||0};o.bp=o.p-b0.p*(temKw(p,x,'double strike')?2:1);o.bt=o.t-b0.t;if(x.cont)o.ct=x.cont;
          const kw=[...bon(p,x).kw].filter(k=>k!=='evasao'&&k!=='imbloq');if(kw.length)o.kw=kw;}
        if(x.anx&&x.anx.length)o.an=x.anx.map(y=>({n:y.papel?'Papel real':nomeX(P[y.k],y),i:y.papel?-1:y.i,cop:y.cop?1:0,de:y.k!==p.k?y.k:undefined}));
        if(!x.cri&&!x.tok&&x.i>=0&&p.M[x.i].eq)o.solto=1;
        return o;}),tl:p.terr.map(l=>({i:l.i,tap:l.tap?1:0})),
      gy:p.gy.length,gyL:p.gy.slice(-12)}))});
  }

  /* ---------- partida ---------- */
  quadro(-1);
  let venc=-1;
  for(T=1;T<=TMAX&&venc<0;T++){
    for(const k of ordem){const p=P[k];if(!p.vivo)continue;
      if(LOG)diz(k,'turno',`Turno ${T} de ${NOM[k]}`);
      joga(p,T===1&&k===ordem[0]);checa();
      const v=vivos();if(v.length<=1){venc=v.length?v[0].k:-1;break;}}
  }
  let fim='mesa';
  if(venc<0){const v=vivos();if(v.length){v.sort((a,b)=>(b.vida+forca(b)*1.5)-(a.vida+forca(a)*1.5));venc=v[0].k;fim='tempo';}}
  if(LOG)diz(venc,'fim',fim==='tempo'?`Acabou o tempo (${TMAX} rodadas): ${NOM[venc]} na frente`:`${NOM[venc]} vence a mesa no turno ${T-1}`);
  return{venc,fim,turno:T-1,ordem,P:P.map(p=>({vivo:p.vivo,mortoT:p.mortoT,causa:p.causa,quem:p.quem,vida:p.vida,
    st:{...p.st,viu:[...p.st.viu],mao:p.mao.slice()}})),log,quadros};
}

const COMBOS=[["Heliod, Sun-Crowned","Walking Ballista"],["Thassa's Oracle","Demonic Consultation"],["Thassa's Oracle","Tainted Pact"],
 ["Kinnan, Bonder Prodigy","Basalt Monolith"],["Isochron Scepter","Dramatic Reversal"],["Exquisite Blood","Sanguine Bond"],["Niv-Mizzet, Parun","Curiosity"],
 ["Kiki-Jiki, Mirror Breaker","Zealous Conscripts"],["Kiki-Jiki, Mirror Breaker","Pestermite"],["Kiki-Jiki, Mirror Breaker","Deceiver Exarch"],["Splinter Twin","Deceiver Exarch"],["Splinter Twin","Pestermite"],
 ["Mikaeus, the Unhallowed","Triskelion"],["Dualcaster Mage","Twinflame"],["Dualcaster Mage","Heat Shimmer"],["Worldgorger Dragon","Animate Dead"],["Painter's Servant","Grindstone"],
 ["Bloodchief Ascension","Mindcrank"],["Peregrine Drake","Deadeye Navigator"],["Basalt Monolith","Rings of Brighthearth"],["Basalt Monolith","Forsaken Monument"],
 ["Ashnod's Altar","Nim Deathmantle","Wurmcoil Engine"],["Food Chain","Eternal Scourge"],["Food Chain","Squee, the Immortal"],["Underworld Breach","Brain Freeze","Lion's Eye Diamond"],
 ["Sanguine Bond","Vito, Thorn of the Dusk Rose"],["Exquisite Blood","Vito, Thorn of the Dusk Rose"],["Walking Ballista","Mikaeus, the Unhallowed"],["Ghave, Guru of Spores","Ashnod's Altar"],
 ["Krenko, Mob Boss","Skirk Prospector","Impact Tremors"],
 ["Sharuum the Hegemon","Disciple of the Vault","Phyrexian Metamorph"],["Prosper, Tome-Bound","Mayhem Devil","Ashnod's Altar"],["Meren of Clan Nel Toth","Ashnod's Altar","Reassembling Skeleton"],
 
 ["Edgar Markov","Sanguine Bond","Exquisite Blood"],["Isshin, Two Heavens as One","Najeela, the Blade-Blossom"]];
/* N partidas do deck 0 contra 3 sorteados do grupo de oponentes */
function torneio(Dv,Ops,N,seed,prog,nOp){nOp=nOp||3;
  const R=rngDe(seed>>>0),Q=[];
  for(let g=0;g<N;g++){
    const esc=[];const pool=Ops.map((_,j)=>j);emb(pool,R);for(let j=0;j<nOp;j++)esc.push(pool[j%pool.length]);
    const r=arena([Dv,...esc.map(j=>Ops[j])],(R()*4294967296)>>>0,{T:20});
    r.ops=esc;Q.push(r);
    if(prog&&g%25===0)prog('Jogando partidas',g/N);
  }
  return Q;
}
function resumoArena(Dv,Ops,Q){
  const n=Q.length,M=Dv.M;
  const win=Q.filter(r=>r.venc===0),cart={};
  const vs=Ops.map(()=>({j:0,v:0,mat:0}));
  let sT=0,sCmd=0,nCmd=0,t3=0,t5=0,mort=[0,0,0,0],causas={};
  for(const r of Q){const me=r.P[0];
    r.ops.forEach((j,s)=>{vs[j].j++;if(r.venc===0)vs[j].v++;if(me.quem===s+1)vs[j].mat++;if(r.venc===s+1)vs[j].ganhouDeVc=(vs[j].ganhouDeVc||0)+1;});
    if(r.venc===0)sT+=r.turno;
    if(me.st.cmdT){sCmd+=me.st.cmdT;nCmd++;}
    t3+=me.st.terrT3;t5+=me.st.terrT5;
    if(!me.vivo){const c=/^combo/.test(me.causa)?'Combo de alguém':/comandante/.test(me.causa)?'Dano de comandante':me.causa==='acabou o grimório'?'Grimório acabou':'Dano (combate e efeitos)';causas[c]=(causas[c]||0)+1;}
    else if(r.venc!==0)causas['Sobreviveu, mas outro venceu no tempo']=(causas['Sobreviveu, mas outro venceu no tempo']||0)+1;
    const viu=new Set(me.st.viu);
    for(const i of viu){const c=cart[i]||(cart[i]={v:0,j:0,l:0,mao:0});c.j++;if(r.venc===0)c.v++;if(me.st.lanc[i])c.l++;if(me.st.mao.includes(i))c.mao++;}
  }
  const wr=win.length/n;
  const cartas=Object.entries(cart).map(([i,c])=>{i=+i;const nv=n-c.j,vNao=(win.length-c.v);
    return{i,nome:M[i].nome,viu:c.j,gih:c.j?c.v/c.j:0,nao:nv?vNao/nv:0,lanc:c.j?c.l/c.j:0,presa:c.j?c.mao/c.j:0,imp:(c.j?c.v/c.j:0)-(nv?vNao/nv:wr)};}).filter(c=>!M[c.i].land||true);
  return{n,wr,tMed:win.length?sT/win.length:0,cmdT:nCmd?sCmd/nCmd:0,t3:t3/n,t5:t5/n,
    vs:vs.map((x,j)=>({nome:Ops[j].nome,j:x.j,wr:x.j?x.v/x.j:0,mat:x.mat,ganhou:x.ganhouDeVc||0})),
    causas,cartas,porT:hist(win.map(r=>r.turno))};
}
function hist(v){const o={};for(const x of v)o[x]=(o[x]||0)+1;return o;}

/* troca pareada: mesmas sementes, 1 carta trocada */
function testaTrocas(Dv,Ops,pares,N,seed,prog,nOp){
  /* Raio-X: devolve tambem a taxa de vitoria antes/depois (todas as trocas juntas) e o resultado de cada carta (sai na lista atual, entra na lista trocada) */
  const passos=pares.length+(pares.length>1?1:0)+1;let feito=0;const pg=()=>{if(prog)prog('Testando trocas',++feito/passos);};
  const vit=Q=>Q.map(r=>r.venc===0?1:0),taxa=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const quandoViu=(Q,i)=>{let j=0,v=0;for(const r of Q)if(r.P[0].st.viu.includes(i)){j++;if(r.venc===0)v++;}return{j,wr:j?v/j:null};};
  const Qb=torneio(Dv,Ops,N,seed,null,nOp),base=vit(Qb);pg();
  const out=[];
  pares.forEach(pr=>{
    const b=Dv.base.slice(),j=b.indexOf(pr.sai);if(j<0){pg();return;}b[j]=pr.entra;
    const Q2=torneio({...Dv,base:b},Ops,N,seed,null,nOp),q=vit(Q2);const d=dif(base,q);
    out.push({...pr,d:d.d,se:d.se,ok:d.d>1.5*d.se,wr:taxa(q),cSai:quandoViu(Qb,pr.sai),cEntra:quandoViu(Q2,pr.entra)});pg();});
  let todas=null;
  if(out.length===1)todas={wr:out[0].wr,d:out[0].d,se:out[0].se};
  else if(out.length>1){let b=Dv.base.slice();for(const pr of out){const j=b.indexOf(pr.sai);if(j>=0)b[j]=pr.entra;}
    const q=vit(torneio({...Dv,base:b},Ops,N,seed,null,nOp));const d=dif(base,q);todas={wr:taxa(q),d:d.d,se:d.se};pg();}
  return{base:taxa(base),pares:out,todas};
}

/* estudo de trocas no formato do PDF: valor de cada carta, grade fracas x candidatas, confirmacao por tipo de mesa */
function jogos(D,Ops,N,seed,nOp){const Q=torneio(D,Ops,N,seed,null,nOp);return{v:Q.map(r=>r.venc===0?1:0),m:Q.map(r=>r.P[0].vivo?0:1),Q};}
const med=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
function estudo(Dv,Ops,mesas,N,seed,prog,nOp,cfg){cfg=cfg||{};
  const M=Dv.M,ci=Dv.cmd?Dv.cmd.i:-1,nF=cfg.nF||8,nC=cfg.nC||12;
  const tipos=[...new Set(Dv.base)].filter(i=>!M[i].land&&i!==ci);
  const conc=cfg.conc||{},tags=conc.tags||[],rg=tags.length?(conc.rigor||'prefere'):'livre',fit=i=>encaixa(M[i],tags),prot=new Set(conc.prot||[]),ext=Dv.extras||[];
  let cand=(Dv.cand||[]).filter(c=>!ext.includes(c));if(rg==='so')cand=cand.filter(fit);if(rg!=='livre')cand.sort((a,c)=>fit(c)-fit(a));
  cand=[...ext,...cand.slice(0,60)];
  const passos=1+tipos.length+nF*nC+mesas.length*5;let feito=0;
  const pg=f=>{feito++;if(prog)prog(f,feito/passos);};
  const sub=ids=>ids.map(j=>Ops[j]);
  const T0=sub(mesas[0].ids);
  const b=jogos(Dv,T0,N,seed,nOp);pg('Partidas base');
  /* uso de cada carta nas partidas base */
  const uso={};for(const r of b.Q){const me=r.P[0],mao=new Set(me.st.mao);for(const i of new Set(me.st.viu)){const u=uso[i]||(uso[i]={viu:0,lanc:0,presa:0});u.viu++;if(me.st.lanc[i])u.lanc++;if(mao.has(i))u.presa++;}}
  /* 1. valor: troca pela carta vazia */
  const valor=[];
  for(const i of tipos){const q=jogos({...Dv,base:troca(Dv.base,i,Dv.vazio)},T0,N,seed,nOp);const d=dif(q.v,b.v);
    const u=uso[i]||{viu:0,lanc:0,presa:0};
    valor.push({i,v:d.d,se:d.se,viu:u.viu/N,lanc:u.viu?u.lanc/u.viu:0,presa:u.viu?u.presa/u.viu:0});pg('Valor de cada carta');}
  valor.sort((a,c)=>a.v-c.v);
  const pen=rg==='so'?5:rg==='prefere'?2:0;
  const fracas=valor.filter(x=>!prot.has(x.i)).map(x=>({i:x.i,s:x.v+(fit(x.i)?pen:0)})).sort((a,c)=>a.s-c.s).slice(0,nF).map(x=>x.i);
  /* as 10 piores pelo valor puro tambem entram na grade (Top 10 mostra todas testadas) */
  for(const x of valor.filter(x=>!prot.has(x.i)).slice(0,10))if(!fracas.includes(x.i))fracas.push(x.i);
  /* candidatas: as da mesma familia das fracas primeiro, depois as mais versateis */
  const fam=m=>m.mana||m.ramp?'mana':m.dr||m.cada||m.gat?'compra':m.rem||m.wip?'rem':m.cri?'cri':'outro';
  const fs=new Set(fracas.map(i=>fam(M[i])));const cs=[];
  for(const c of ext)if(cs.length<nC)cs.push(c);
  for(const c of cand)if(!cs.includes(c)&&fs.has(fam(M[c]))&&cs.length<Math.ceil(nC*.6)+ext.length)cs.push(c);
  for(const c of cand)if(!cs.includes(c)&&cs.length<nC)cs.push(c);
  /* 2. grade */
  const grade=fracas.map(s=>cs.map(c=>{const q=jogos({...Dv,base:troca(Dv.base,s,c)},T0,N,seed,nOp);const d=dif(b.v,q.v);pg('Grade de trocas');return{d:d.d,se:d.se};}));
  /* 3. escolha gulosa: ate 3 trocas, sai e entra sem repetir, ganho acima do ruido */
  const lst=[];fracas.forEach((s,a)=>cs.forEach((c,k)=>lst.push({sai:s,entra:c,...grade[a][k]})));const bon=rg==='prefere'?1.5:0;for(const t of lst)t.sc=t.d+bon*(fit(t.entra)-fit(t.sai));lst.sort((x,y)=>y.sc-x.sc);
  const esc=[],us=new Set(),ue=new Set();
  for(const t of lst){if(esc.length>=3)break;if(us.has(t.sai)||ue.has(t.entra))continue;if(t.d<=t.se)continue;if(rg==='so'&&fit(t.sai)&&!fit(t.entra)&&!ext.includes(t.entra))continue;esc.push(t);us.add(t.sai);ue.add(t.entra);}
  /* 4. confirmacao nas mesas: cada troca sozinha e combinadas */
  const variantes=[];esc.forEach((t,k)=>variantes.push({nome:'Troca '+(k+1),trocas:[k]}));
  if(esc.length>1)variantes.push({nome:'1 + 2',trocas:[0,1]});if(esc.length>2)variantes.push({nome:'1 + 2 + 3',trocas:[0,1,2]});
  const conf=mesas.map((ms,mi)=>{const T=sub(ms.ids);const bb=mi===0?b:jogos(Dv,T,N,seed+mi,nOp);pg('Confirmando nas mesas');
    const vs=variantes.map(vr=>{let base=Dv.base;for(const k of vr.trocas)base=troca(base,esc[k].sai,esc[k].entra);
      const q=jogos({...Dv,base},T,N,seed+mi,nOp);pg('Confirmando nas mesas');const d=dif(bb.v,q.v),dm=dif(bb.m,q.m);
      return{nome:vr.nome,d:d.d,se:d.se,vence:med(q.v),morre:med(q.m),dm:dm.d};});
    for(let z=vs.length;z<5;z++)pg("Confirmando nas mesas");
    return{nome:ms.nome,n:ms.ids.length,vence:med(bb.v),morre:med(bb.m),vs};});
  const fitM={};for(const x of valor)fitM[x.i]=fit(x.i);for(const c of cs)fitM[c]=fit(c);
  const nl=Dv.base.filter(i=>!M[i].land&&i!==ci),dep=nl.map(i=>{const t=esc.find(e=>e.sai===i);return t?t.entra:i;});
  const ader={antes:nl.filter(fit).length,depois:dep.filter(fit).length,n:nl.length};
  return{conc:{tags,rigor:rg,ideia:conc.ideia||'',prot:[...prot]},fit:fitM,ader,N,nOp,valor,fracas,cs,grade,esc:esc.map(t=>({sai:t.sai,entra:t.entra,d:t.d,se:t.se})),conf,uso};
}

if(typeof self!=='undefined'&&typeof window==='undefined'&&typeof module==='undefined'){
  self.onmessage=e=>{const{id,tipo,Dv,Ops,N,seed,pares}=e.data;
    try{let r;const pg=(fase,p)=>self.postMessage({id,prog:{fase,p}});
      if(tipo==='torneio'){const Q=torneio(Dv,Ops,N,seed,pg,e.data.nOp);r=resumoArena(Dv,Ops,Q);}
      else if(tipo==='partida'){r=arena([Dv,...Ops],seed,{log:true,T:e.data.T||20,vida:e.data.vida,nomes:e.data.nomes});}
      else if(tipo==='estudo'){r=estudo(Dv,Ops,e.data.mesas,N,seed,pg,e.data.nOp,e.data.cfg);}
      else if(tipo==='trocas'){r=testaTrocas(Dv,Ops,pares,N,seed,pg,e.data.nOp);}
      self.postMessage({id,r});}catch(x){self.postMessage({id,erro:String(x)+' '+(x.stack||'')});}};
}
if(typeof module!=='undefined')module.exports={arena,torneio,resumoArena,testaTrocas,estudo};
