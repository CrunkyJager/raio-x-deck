/* Mesa do Grimório Arena, de Edgar: cada jogador joga o próprio deck. Copiado sem mudanças de regra. */
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
    return{k,D,M,ci,cmdI,lib,mao,terr:[],perm:[],gy:[],vida:VIDA,tax:0,zona:cmdI>=0,cmdD:[0,0,0,0],
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
  const poderDe=(p,x)=>{if(!x.cri)return 0;const m=x.tok?null:p.M[x.i];let b=x.p;if(m&&m.bronze)b=p.perm.filter(y=>!y.tok&&p.M[y.i].a).length;let v=Math.max(0,b+anth(p)+(x.tmp||0));if(m&&m.ds)v*=2;return v;};
  const resDe=(p,x)=>x.t+anth(p)+(x.tmp||0)-(x.dano||0);
  const forca=p=>{let s=0;for(const x of p.perm)if(x.cri)s+=poderDe(p,x);return s;};
  const nomeC=(p,i)=>p.M[i].frente||p.M[i].nome;
  const ganha=(p,n)=>{p.vida+=n;if(n>0&&tem(p,'ratch')){const j=p.gy.findIndex(g=>p.M[g].a&&!p.M[g].sp&&(p.M[g].cmc||0)<=n);if(j>=0){const c=p.gy.splice(j,1)[0];entra(p,c);}}};
  const protegido=(p,x)=>{if(x.tok)return false;const m=p.M[x.i];if(m.hex)return true;
    for(const y of p.perm){if(y.tok)continue;const n=p.M[y.i];
      if(n.hexA&&(m.a))return true;if(n.hexAO&&m.a&&m.cri&&y!==x)return true;if(n.hexC&&x.cri&&y!==x)return true;
      if(n.boots&&x.cmd)return true;}
    return false;};
  const wardBloqueia=(p,o,x)=>{const m=o.M[x.i];const w=m.ward||(m.a&&o.perm.some(y=>!y.tok&&y!==x&&o.M[y.i].wardAO));return !!w&&((T*7+p.k*3+x.i)%5<2);};
  const indes=(p,x)=>{if(x.indT)return true;if(x.tok)return false;const m=p.M[x.i];if(m.ind)return true;
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
      if(m.opal&&na>=3)u.push({s:ANY,o:x});
      if(m.ugin&&x.uMana)for(let j=0;j<3;j++)u.push({s:'',o:x,n:3});
      if(m.amber&&p.perm.some(y=>y.cri&&!y.tok&&p.M[y.i].leg))u.push({s:ANY,o:x});}
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

  /* ---------- permanentes e morte ---------- */
  function entra(p,i,ehCmd){
    const m=p.M[i];
    const x={i,cri:!!m.cri,p:m.p||0,t:m.t||0,sick:!(m.has||(m.a&&m.cri&&tem(p,'hasteA'))),tap:false,cmd:!!ehCmd,tok:false};
    p.perm.push(x);return x;
  }
  function ficha(p,n,pw,tg,nome){for(let j=0;j<n;j++)p.perm.push({i:-1,nome:nome||`Ficha ${pw}/${tg}`,cri:true,p:pw,t:tg,sick:true,tap:false,tok:true});}
  function morre(p,x,exila,quem){
    const k=p.perm.indexOf(x);if(k<0)return;p.perm.splice(k,1);
    if(x.tok)return;
    const m=p.M[x.i];
    if(x.cmd){p.zona=true;p.tax+=2;diz(p.k,'morte',`${nomeC(p,x.i)} volta pra zona de comando (taxa agora +${p.tax})`);}
    else{if(!m.noGy)p.gy.push(x.i);if(m.mdraw&&!exila)compra(p,1,'Solemn');if(!exila&&m.morte)ficha(p,Math.max(1,Math.round(m.morte/2)),2,2,'Fichas da morte');}
    if(x.cri&&m.a&&p.perm.some(y=>!y.tok&&p.M[y.i].modular)){const y=p.perm.find(z=>z.cri&&!z.tok&&p.M[z.i].a);if(y)y.p++;}
    if(x.cri){p.st.mortes++;if(p.perm.some(y=>!y.tok&&p.M[y.i].clamp))compra(p,2,'Skullclamp');}
  }
  function mata(p,causa,quem){
    if(!p.vivo)return;p.vivo=false;p.mortoT=T;p.causa=causa;p.quem=quem;
    diz(p.k,'fim',`${NOM[p.k]} está fora: ${causa}`);
    p.perm=[];p.terr=[];
  }
  function checa(){
    for(const p of P){if(!p.vivo)continue;
      if(p.vivo&&p.vida<=0){
        if(p.perm.some(x=>!x.tok&&p.M[x.i].plat)){p.vida=Math.max(p.vida,0);continue;}
        mata(p,'vida zerada',p.ultDano);}
      for(let j=0;j<4&&p.vivo;j++)if(p.cmdD[j]>=21)mata(p,'21 de dano de comandante de '+NOM[j],j);
    }
  }

  /* ---------- valor de ameaca (pra remocao e ataque) ---------- */
  function valor(p,x){
    if(x.tok)return x.p*0.6;
    const m=p.M[x.i];let v=(x.cri?poderDe(p,x):0);
    if(x.cmd)v+=4;if(m.cada||m.gat||m.tome||m.tokR)v+=3;if(m.dis)v+=2;if(m.anth)v+=3+p.perm.filter(y=>y.cri).length*0.5;
    if(m.mana&&!x.cri)v+=1;if(m.plat||m.myco||m.tithe)v+=4;if(m.indA||m.indC||m.hexC||m.hexA)v+=3;
    return v;
  }
  function tipoRem(m){const l=(m.txt||'').toLowerCase();
    if(/target (?:nonland )?permanent/.test(l))return'*';if(/target artifact or creature|target creature or artifact/.test(l))return'ac';
    if(/target artifact or enchantment|target enchantment or artifact/.test(l))return'ae';
    if(/target (?:attacking |tapped |nontoken )?creature|any target|creature or planeswalker|that creature/.test(l))return'c';
    if(/target artifact/.test(l))return'a';if(/target enchantment/.test(l))return'e';return'*';}
  function serve(o,x,tp){if(tp==='*')return true;const m=x.tok?{}:o.M[x.i];
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
      diz(o.k,'resp',`${NOM[o.k]} responde com ${nomeC(o,c)} e se protege`);return m.pr;}
    return null;
  }
  function remove(p,alvo,origem){
    const {o,x}=alvo;
    if(salva(o,'r',x))return false;
    const ex=/exile/i.test(p.M[origem]?.txt||'');
    if(indes(o,x)&&!ex){diz(p.k,'remo',`${nomeC(p,origem)} em ${x.tok?x.nome:nomeC(o,x.i)}, mas é indestrutível`);return false;}
    diz(p.k,'remo',`${nomeC(p,origem)} tira ${x.tok?x.nome:nomeC(o,x.i)} de ${NOM[o.k]}`,origem,o.k);
    morre(o,x,ex,p.k);p.st.rem++;return true;
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
      p.gy.push(i);
    }else{
      const x=entra(p,i,ehCmd);
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
    p.aberta=fontes(p);
  }

  /* ---------- combate ---------- */
  function combate(p){
    const ops=opsDe(p);if(!ops.length)return;
    let at=p.perm.filter(x=>x.cri&&!x.sick&&!x.tap&&poderDe(p,x)>0&&(x.tok||!p.M[x.i].dfd));
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
    if(p.vida<=perigo*1.2&&at.length>2){const fica=at.slice().sort((a,b)=>resDe(p,b)-resDe(p,a))[0];at.splice(at.indexOf(fica),1);}
    /* nao manda quem morre de graca pra bloqueador maior */
    const blq=alvo.perm.filter(x=>x.cri&&!x.tap);
    at=at.filter(x=>{if(x.tok&&blq.length>at.length)return true;const ev=!x.tok&&p.M[x.i].ev;if(ev)return true;
      return !blq.some(b=>poderDe(alvo,b)>=resDe(p,x)&&resDe(alvo,b)>poderDe(p,x)&&!(b.tok&&poderDe(p,x)>=3))||poderDe(p,x)>=5||at.length>=blq.length+2;});
    if(!at.length)return;
    instantaneaNoAtaque(alvo,p,at);
    if(!at.length)return;
    for(const x of p.perm)x.atk=0;for(const x of at)x.atk=1;
    {let pk=0;for(const y of p.perm)if(!y.tok&&p.M[y.i].pump)pk=Math.max(pk,p.M[y.i].pump);
     if(pk)for(const y of p.perm)if(y.cri&&!(!y.tok&&p.M[y.i].pump)){y.tmp=pk;y.indT=1;}
     for(const x of at){const m=!x.tok&&p.M[x.i];if(m&&m.remAtk&&R()<.6){const a=melhorAlvo(p,true,'*');if(a)remove(p,a,x.i);if(m.prowl&&R()<.5)compra(p,1,'Prowl');}}}
    diz(p.k,'ataque',`${NOM[p.k]} ataca ${NOM[alvo.k]} com ${at.length} criatura${at.length>1?'s':''} (${at.reduce((s,x)=>s+poderDe(p,x),0)} de poder)`,-1,alvo.k);
    for(const x of at)if(!(x.tok?false:/vigilance/i.test(p.M[x.i].txt.split('\n')[0])))x.tap=true;
    let livres=blq.slice();const inc=at.reduce((s,x)=>s+poderDe(p,x),0);
    let dano=0,cmdDano=0;
    for(const x of at){
      const pw=poderDe(p,x),ev=!x.tok&&p.M[x.i].ev&&R()<.75;
      let b=null;
      if(!ev&&livres.length){
        const mata=livres.filter(y=>poderDe(alvo,y)>=resDe(p,x)||(!y.tok&&alvo.M[y.i].dt));
        const sobra=mata.filter(y=>resDe(alvo,y)>pw);
        if(sobra.length)b=sobra[0];
        else if(mata.length&&pw>=4)b=mata.sort((a,c)=>valor(alvo,a)-valor(alvo,c))[0];
        else if(inc-dano>=alvo.vida||(pw>=8&&alvo.vida<=12))b=livres.sort((a,c)=>valor(alvo,a)-valor(alvo,c))[0];
      }
      if(b){livres.splice(livres.indexOf(b),1);
        const bp=poderDe(alvo,b);
        const f1=!x.tok&&(p.M[x.i].fs||p.M[x.i].ds),f2=!b.tok&&(alvo.M[b.i].fs||alvo.M[b.i].ds);
        const morreA=(bp>=resDe(p,x)||(!b.tok&&alvo.M[b.i].dt))&&!indes(p,x)&&!(f1&&!f2&&pw>=resDe(alvo,b));
        const morreB=(pw>=resDe(alvo,b)||(!x.tok&&p.M[x.i].dt))&&!indes(alvo,b)&&!(f2&&!f1&&bp>=resDe(p,x));
        if(LOG)diz(alvo.k,'bloqueio',`${x.tok?x.nome:nomeC(p,x.i)} é bloqueado por ${b.tok?b.nome:nomeC(alvo,b.i)}${morreA&&morreB?': os dois morrem':morreA?': atacante morre':morreB?': bloqueador morre':''}`);
        if(morreB)morre(alvo,b,false,p.k);if(morreA)morre(p,x,false,alvo.k);
      }else{const inf=!x.tok&&p.M[x.i].inf?4:1;dano+=pw*inf;if(x.cmd){cmdDano+=pw;alvo.cmdD[p.k]+=pw;}if(!x.tok&&p.M[x.i].ll)ganha(p,pw);
        if(!x.tok&&p.M[x.i].geode&&p.zona&&p.cmdI>=0){p.zona=false;if(!p.st.cmdT)p.st.cmdT=T;diz(p.k,'magia',`${nomeC(p,x.i)}: comandante entra de graça`);resolve(p,p.cmdI,true);}}
    }
    if(dano){alvo.vida-=dano;alvo.ultDano=p.k;p.st.dano+=dano;alvo.st.danoRec+=dano;
      diz(p.k,'dano',`${dano} de dano em ${NOM[alvo.k]}${cmdDano?` (${cmdDano} de comandante, total ${alvo.cmdD[p.k]})`:''}: fica com ${alvo.vida}`);}
    for(const y of p.perm){y.tmp=0;y.indT=0;}
    checa();
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
    for(const x of p.perm){x.tap=false;x.sick=false;x.usou=0;x.dano=0;x.atk=0;}
    for(const q of vivos())if(q!==p&&tem(q,'clock')){for(const y of q.perm)if(!y.tok&&q.M[y.i].a)y.tap=false;q.aberta=fontes(q);}
    for(const x of p.perm)if(!x.tok&&p.M[x.i].ugin)x.uMana=p.mao.length>=4;
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
    combate(p);if(!p.vivo)return;
    /* segunda fase: o que sobrou */
    fase(p);if(!p.vivo)return;
    /* descarte */
    while(p.mao.length>7){let w=0,wv=1e9;p.mao.forEach((i,j)=>{const v=p.M[i].land?(p.terr.length>=6?-1:5):nota(p,i);if(v<wv){wv=v;w=j;}});p.gy.push(p.mao.splice(w,1)[0]);}
    p.aberta=fontes(p);
  }
  function quadro(k){if(LOG)foto(k);}
  function foto(k){
    quadros.push({t:T,k,log:log.length,j:P.map(p=>({vida:p.vida,vivo:p.vivo,terr:p.terr.length,tes:p.tes,mao:p.mao.slice(),lib:p.lib.length,zona:p.zona,tax:p.tax,cmdD:p.cmdD.slice(),
      perm:p.perm.map(x=>({n:x.tok?x.nome:nomeC(p,x.i),p:x.cri?poderDe(p,x):null,t:x.cri?resDe(p,x):null,c:x.cmd?1:0,tok:x.tok?1:0,tap:x.tap?1:0,atk:x.atk?1:0,i:x.i})),tl:p.terr.map(l=>({i:l.i,tap:l.tap?1:0})),
      gy:p.gy.length}))});
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
  const base=torneio(Dv,Ops,N,seed,null,nOp).map(r=>r.venc===0?1:0);
  const out=[];
  pares.forEach((pr,k)=>{if(prog)prog('Testando trocas',k/pares.length);
    const b=Dv.base.slice(),j=b.indexOf(pr.sai);if(j<0)return;b[j]=pr.entra;
    const D2={...Dv,base:b};const q=torneio(D2,Ops,N,seed,null,nOp).map(r=>r.venc===0?1:0);
    const d=dif(base,q);out.push({...pr,d:d.d,se:d.se,ok:d.d>1.5*d.se});});
  return out;
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
