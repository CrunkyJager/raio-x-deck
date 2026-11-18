/* Motor do Grimório Arena, de Edgar. Copiado sem mudanças de regra; usado pelo Raio-X na Mesa simulada e na Mesa ao vivo. */
/* Motor do analisador: puro, roda no Worker, na pagina e no node. */
function norm(s){return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').trim();}

function parseLista(txt){
  const out=[];let sec='main';
  for(const raw of String(txt).split(/\r?\n/)){
    let l=raw.trim();if(!l)continue;
    const h=l.replace(/^(\/\/|#)\s*/,'').replace(/:$/,'').replace(/\s*\(\d+\)$/,'').trim().toLowerCase();
    if(/^(commanders?|comandantes?|cmdr)$/.test(h)){sec='cmd';continue;}
    if(/^(deck|main|mainboard|lista|creatures?|criaturas?|lands?|terrenos?|artifacts?|artefatos?|enchantments?|encantamentos?|instants?|instant[aâ]neas?|sorcer(y|ies)|feiti[cç]os?|planeswalkers?|other|outros)$/.test(h)){sec='main';continue;}
    if(/^(sideboard|maybeboard|maybe|considering|side|tokens?)\b/.test(h)){sec='fora';continue;}
    if(/^(\/\/|#)/.test(l)||sec==='fora')continue;
    let cmd=sec==='cmd';if(/\*cmdr\*/i.test(l))cmd=true;
    l=l.replace(/\*[A-Za-z]+\*/g,'').replace(/\s+#.*$/,'').trim();
    const m=l.match(/^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+\[([A-Za-z0-9]{2,6})(?::([\w★-]+))?\]|\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([\w★-]+))?)?(?:\s+[fF])?$/);
    if(!m)continue;
    out.push({q:+(m[1]||1),nome:m[2].replace(/\s\/\s.*$/,'').trim(),set:(m[3]||m[5]||'').toLowerCase(),num:m[4]||m[6]||'',cmd});
  }
  return out;
}

function parseCusto(s){let g=0,c=0,x=false;(String(s||'').match(/\{[^}]+\}/g)||[]).forEach(m=>{const v=m.slice(1,-1);if(/^\d+$/.test(v))g+=+v;else if(v==='X')x=true;else c++;});return{g,c,x};}
const NUM={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7};
const n_=s=>NUM[String(s).toLowerCase()]||parseInt(s,10)||1;

const ANY='WUBRG';
const corDe=s=>{let o='';(String(s).match(/\{[WUBRG]\}/g)||[]).forEach(x=>{if(!o.includes(x[1]))o+=x[1];});return o;};
const somaCor=(a,b)=>{let o=a;for(const ch of b)if(!o.includes(ch))o+=ch;return o;};
function pipsDe(s){const out=[];(String(s||'').match(/\{[^}]+\}/g)||[]).forEach(x=>{const v=x.slice(1,-1);if(/^(\d+|X|C|S)$/.test(v))return;const c=v.replace(/[^WUBRG]/g,'');if(c)out.push(c);});return out;}

/* Efeitos que nao da pra ler com seguranca so pelo texto */
const ESP={
 'Mox Opal':{opal:1},'Mox Amber':{amber:1},
 'Cradle Clearcutter':{g:2,c:1,mana:1,p:1,pip:['G']},
 'Cloud Key':{dis:['a',1]},'Semblance Anvil':{dis:['a',2],imp:1},
 'Mycosynth Golem':{myco:1},'Metalwork Colossus':{metal:1},
 'Bronze Guardian':{bronze:1},'Verdurous Gearhulk':{p:8},
 'Smothering Tithe':{tithe:1},'Unwinding Clock':{clock:1},
 'Ugin, Eye of the Storms':{ugin:1,uginX:1},'Ugin, the Ineffable':{dis:['C',2],uin:1},
 'Losheel, Clockwork Scholar':{gat:{t:'ac',uma:1}},'Canoptek Spyder':{gat:{t:'ac'}},
 'Mazemind Tome':{tome:4},"Mind's Eye":{me:1},'Slate of Ancestry':{slate:1},
 'Ultra Magnus, Tactician':{magnus:1},'Skullclamp':{clamp:1},'Platinum Angel':{plat:1},
 'Hangarback Walker':{g:2,p:2}
};

function modelo(r){
  const nome=r[0],frente=nome.split(' // ')[0],tl=r[3]||'',txt=r[6]||'',low=txt.toLowerCase();
  const m={nome,frente,tl,txt,cmc:r[2]||0,usd:r[8],custoTxt:r[1],ci:r[7]||''};
  m.land=/\bLand\b/.test(tl);
  if(m.land){
    let cor='';const B={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'};
    for(const k in B)if(new RegExp('\\b'+k+'\\b').test(tl))cor=somaCor(cor,B[k]);
    for(const a of txt.matchAll(/Add ([^.\n]*)/g)){if(/any color|any type|color identity/i.test(a[1]))cor=ANY;else cor=somaCor(cor,corDe(a[1]));}
    if(/search your library for an? basic land card/i.test(txt)||/could produce/i.test(txt))cor=ANY;
    const f=txt.match(/search your library for an? (\w+) or (\w+) card/i);if(f)cor=somaCor(cor,(B[f[1]]||'')+(B[f[2]]||''));
    m.cor=cor;return m;
  }
  let cu=parseCusto(r[1]);
  const mt=txt.match(/More Than Meets the Eye ((?:\{[^}]+\})+)/);
  if(mt){cu=parseCusto(mt[1]);m.mtmte=1;}
  m.g=cu.g;m.c=cu.c;m.x=cu.x;m.pip=pipsDe(mt?mt[1]:r[1]);
  m.a=/\bArtifact\b/.test(tl);m.cri=/\bCreature\b/.test(tl);m.ench=/\bEnchantment\b/.test(tl);
  m.sp=/\b(Instant|Sorcery)\b/.test(tl);m.pw=/\bPlaneswalker\b/.test(tl);
  m.leg=/\bLegendary\b/.test(tl);m.hist=m.leg||m.a||/\bSaga\b/.test(tl);
  m.inc=cu.c===0;
  m.p=m.cri?(parseInt(r[4],10)||0):0;
  m.t=m.cri?(parseInt(r[5],10)||1):0;
  if(mt&&r[10]&&/^\d+$/.test(String(r[10][3]||'')))m.p=parseInt(r[10][3],10);
  const inst=/\bInstant\b/.test(tl)||/(?:^|\n)flash\b/i.test(txt);

  /* mana e cor da mana */
  let a=txt.match(/(?:^|\n)\{T\}: Add ([^.\n]*)\./);
  if(a){const s=a[1];
    if(/\btwo mana\b/i.test(s))m.mana=2;else if(/\bthree mana\b/i.test(s))m.mana=3;
    else if(/\bmana\b/i.test(s))m.mana=1;
    else m.mana=(s.split(/ or /i)[0].match(/\{[^}]+\}/g)||[]).length||1;
  }else if(/(?:^|\n)\{1\}, \{T\}: Add (?:\{[^}]+\}){2}/.test(txt))m.mana=1;
  let cr='';for(const b of txt.matchAll(/(?:^|\n)[^:\n]*\{T\}[^:\n]*: Add ([^.\n]*)/g)){if(/any color|any type|color identity/i.test(b[1]))cr=ANY;else cr=somaCor(cr,corDe(b[1]));}
  m.cor=cr;
  if(/lands you control have "[^"]*any color/i.test(txt))m.lant=1;

  /* terreno pro campo */
  a=low.match(/search your library for (?:up to (one|two|three) )?[^.]*?\b(?:lands?|forests?|plains|islands?|swamps?|mountains?)\b[^.]*(?:onto|on) the battlefield/);
  if(a)m.ramp=/put one onto the battlefield/.test(low)?1:(a[1]?n_(a[1]):1);

  /* reducao */
  a=txt.match(/(^|\n|\. )([A-Za-z ]*?)[Ss]pells(?: you cast)? cost \{(\d+)\} less/);
  if(a&&!/first|during|if |as long/i.test(a[2])){
    const k=a[2].trim().toLowerCase();
    const al={'':'*',artifact:'a',historic:'h',creature:'c',colorless:'C',noncreature:'n'}[k];
    if(al)m.dis=[al,+a[3]];
  }

  /* compra */
  const de=low.match(/\bdraw (a|one|two|three|four|five|\d+) cards?\b/);
  const etb=/when[^.\n]*enters[^.\n]*draw/.test(low);
  if(de&&(m.sp||etb))m.dr=n_(de[1]);
  if(/draw a card for each creature you control/.test(low))m.sham=1;
  if(/draw cards equal to the greatest power/.test(low))m.ret=1;
  a=low.match(/whenever you cast an? (artifact|creature|historic|noncreature|legendary)?(?: creature)? ?spell[^.\n]*draw a card/);
  if(a)m.gat={t:{artifact:'a',creature:'c',historic:'h',noncreature:'n',legendary:'h'}[a[1]||'']||'*',cast:1};
  if(/at the beginning of your (upkeep|end step)[^.\n]*draw a card/.test(low)&&!/you may pay/.test(low))m.cada=1;

  /* fichas */
  a=low.match(/(?:when[^.\n]*enters[^.\n]*)?create (a|one|two|three|four|\d+) (\d+)\/(\d+)/);
  if(a&&(m.sp||/when[^.\n]*enters[^.\n]*create/.test(low))){m.tok=n_(a[1])*(+a[2]);m.tokN=n_(a[1]);m.tokP=+a[2];m.tokT=+a[3];}
  {const q=low.match(/whenever [^.\n]*(?:attack|cast|upkeep|end step)[^.\n]*create (a|one|two|three|\d+) (\d+)\/(\d+)/);if(q&&!m.sp){m.tokR={n:n_(q[1]),p:+q[2],t:+q[3]};}}
  a=low.match(/when [^.\n]*dies, create (a|one|two|three|\d+) (\d+)\/(\d+)/);
  if(a)m.morte=n_(a[1])*(+a[2])*(/for each \+1\/\+1 counter/.test(low)?2:1);

  /* palavras-chave do proprio corpo */
  const kw=txt.split('\n').filter(l=>/^(?:(?:flying|haste|vigilance|trample|reach|lifelink|menace|first strike|double strike|deathtouch|indestructible|defender|hexproof|shroud|flash|infect|ward \{\d\})(?:, |$))+$/i.test(l.trim())).join(', ').toLowerCase();
  if(/indestructible/.test(kw))m.ind=1;
  if(/hexproof|shroud/.test(kw))m.hex=1;
  if(/double strike/.test(kw))m.ds=1;
  if(/\binfect\b/.test(kw))m.inf=1;
  if(/vigilance/.test(kw))m.vig=1;
  if(/(?:^|, |\n)haste/.test(kw))m.haste=1;
  if(/first strike/.test(kw)&&!/double strike/.test(kw))m.fs=1;
  {const g=low.match(/whenever you attack, other creatures you control get \+(\d)\/\+\d/);if(g)m.pump=+g[1];}
  if(/other artifact creatures you control have haste/.test(low))m.hasteA=1;
  if(/when this creature dies, you may draw a card/.test(low))m.mdraw=1;
  if(/costs \{1\} less to cast for each attacking creature/.test(low))m.idol=1;
  if(/deals combat damage to a player, you may cast your commander/.test(low))m.geode=1;
  if(/this artifact deals 1 damage to you/.test(low))m.pain=1;
  if(/metalcraft[^.]*exile that creature/.test(low))m.remMetal=1;
  if(/its controller may search their library for a basic land/.test(low))m.giveLand=1;
  if(/shuffle (?:it|[a-z' ,]+) into its owner's library instead/.test(low))m.noGy=1;
  if(/sacrifice two artifacts: return this card from your graveyard to your hand/.test(low))m.metalrec=1;
  if(/for as long as that card remains exiled, its owner may play it/.test(low))m.prowl=1;
  if(/have modular 1/.test(low))m.modular=1;
  {const g=low.match(/you gain (\d+) life/);if(g&&/when this creature enters/.test(low))m.lifeETB=+g[1];}
  if(/ferocious[^.]*you gain 4 life for each creature you control with power 4/.test(low))m.ferocious=1;
  if(/whenever you gain life, you may convert/.test(low))m.ratch=1;
  if(/gain control of slicer/.test(low))m.slicer=1;

  if(/ward \{\d\}/.test(kw))m.ward=1;
  if(m.cri&&(/flying|trample|menace/.test(kw)||/can't be blocked/.test(low)))m.ev=1;
  if(/haste/.test(kw))m.has=1;if(/lifelink/.test(kw))m.ll=1;if(/defender/.test(kw))m.dfd=1;if(/deathtouch/.test(kw))m.dt=1;
  {const an=low.match(/(?:other )?creatures you control get \+(\d+)\/\+(\d+)/);if(an&&!/until end of turn/.test(low.slice(an.index,an.index+80)))m.anth=+an[1];}

  /* protecao fixa em campo */
  if(/(?:^|\n|— )artifacts you control have (?:[a-z ,]*)?hexproof/i.test(txt))m.hexA=1;
  if(/other artifact creatures you control have hexproof/i.test(txt))m.hexAO=1;
  if(/(?:^|\n|— )(?:other )?creatures you control have (?:[a-z ,]*)?hexproof/i.test(txt))m.hexC=1;
  if(/other artifacts you control have ward/i.test(txt))m.wardAO=1;
  if(/equipped creature has [^.\n]*\b(?:hexproof|shroud)\b/i.test(txt))m.boots=1;
  if(/(?:artifacts|permanents) you control have indestructible/i.test(txt))m.indA=1;
  if(/(?:^|\n)(?:other )?creatures you control have indestructible|permanents you control have indestructible/i.test(txt))m.indC=1;

  /* resposta (instantanea): protecao, contra-magica, desvio */
  if(m.sp&&inst){
    if(/phase out/.test(low)&&/permanents you control/.test(low))m.pr={r:1,w:1,x:1,a:1,k:'fase'};
    else if(/(?:permanents|creatures|artifacts) you control gain (?:hexproof and indestructible|indestructible and hexproof)/.test(low))m.pr={r:1,w:1,a:1,k:'hi'};
    else if(/(?:permanents|creatures|artifacts) you control gain indestructible/.test(low))m.pr={r:1,w:1,a:1,ind:1,k:'ind'};
    else if(/return to the battlefield all permanent cards[^.]*put there from the battlefield this turn/.test(low))m.pr={w:1,a:1,volta:1,k:'volta'};
    else if(/\bcounter target (?:spell|noncreature spell|instant or sorcery spell|spell or ability|activated or triggered ability)/.test(low))m.pr={r:1,w:1,x:1,a:1,ctr:1,k:'ctr'};
    else if(/new targets? for target spell|change the target of target spell/.test(low))m.pr={r:1,k:'desvia'};
    else if(/target (?:permanent|creature|artifact) you control gains? (?:hexproof|indestructible|protection)/.test(low))m.pr={r:1,ind:/hexproof|protection/.test(low)?0:1,k:'um'};
  }
  if(/if you control a commander, you may cast this spell without paying/.test(low))m.gratis=1;

  /* remocao e wipe */
  const remRe=/(?:destroy|exile) target (?:nonland permanent|permanent|creature|artifact or creature|creature or planeswalker|attacking creature|tapped creature|nontoken creature)|deals? (?:\d+|x) damage to (?:target creature|any target)|deals damage equal to its power to target creature|owner of target permanent shuffles it|exile that creature|target creature's controller sacrifices/;
  const remFr=/destroy target (?:artifact|enchantment|artifact or enchantment)\b|return target (?:nonland permanent|creature)[^.]*to its owner's hand/;
  if(m.sp){if(remRe.test(low))m.rem=1;else if(remFr.test(low))m.rem=.5;}
  else if(/when [^.\n]*enters[^.\n]*(?:destroy|exile) (?:up to one )?target (?:creature|nonland permanent|permanent|artifact)/.test(low))m.remEtb=1;
  if(!m.sp&&/whenever [^.\n]*attacks?[^.\n]*(?:exile|destroy) (?:up to one )?(?:other )?target|whenever [^.\n]*attack[^.\n]*damage to any target/.test(low))m.remAtk=.3;
  if(m.sp){
    if(/destroy all nonartifact creatures/.test(low))m.wip={na:1};
    else if(/destroy all (?:creatures|nonland permanents|other creatures)|exile all (?:creatures|nonland permanents)|damage to each creature|all creatures get -\d+\/-\d+|each player sacrifices all creatures/.test(low))m.wip={na:0};
    if(/costs \{1\} less to cast for each creature on the battlefield/.test(low))m.blas=1;
    if(/\bimprovise\b/.test(low))m.impv=1;
  }

  /* recursao */
  if(m.sp&&/return all artifact[^.]*cards from your graveyard to the battlefield/.test(low))m.wake=1;
  if(!m.sp&&/return target artifact card from your graveyard to the battlefield/.test(low))m.iron=1;

  /* tutor (terreno fica no ramp) */
  a=low.match(/search your library for (?:an?|up to one|one) ([a-z ,]*?)card[^.]*?(put (?:it|that card) into your hand|put (?:it|that card) onto the battlefield|put that card on top|reveal it, put it into your hand)/);
  if(a&&!/land/.test(a[1])&&(m.sp||/when[^.\n]*enters[^.\n]*search your library/.test(low))){
    const t=a[1];m.tut={t:(/artifact/.test(t)?'a':'')+(/creature/.test(t)?'c':'')+(/enchantment/.test(t)?'e':'')+(/instant|sorcery/.test(t)?'i':'')||'*',campo:/onto the battlefield/.test(a[2]),topo:/on top/.test(a[2]),x:m.x?1:0};
  }

  const e=ESP[frente]||ESP[nome];
  if(e)Object.assign(m,e);
  /* magica sem efeito lido fica como reativa (nao e lancada) */
  m.r=m.sp&&!m.dr&&!m.ramp&&!m.sham&&!m.ret&&!m.tok&&!m.pr&&!m.rem&&!m.wip&&!m.tut&&!m.wake;
  if(m.x&&m.sp&&!m.tut)m.r=true;
  m.lac=lacunas(m);
  return m;
}

/* Leitor de clausulas: separa o texto da carta em frases e diz quais o motor aplica no jogo e quais ignora */
const KWOK={haste:m=>m.haste,'first strike':m=>m.fs,lifelink:m=>m.ll,flying:m=>m.ev,trample:m=>m.ev,menace:m=>m.ev,'double strike':m=>m.ds,infect:m=>m.inf,vigilance:m=>m.vig,indestructible:m=>m.ind,hexproof:m=>m.hex,shroud:m=>m.hex,ward:m=>m.ward,flash:()=>true,reach:()=>true,improvise:m=>m.impv,affinity:m=>m.myco||m.metal};
const CLAUSULAS=[
 [/: add (?:\{|one|two|three|an amount)|^lands you control have/i,m=>m.mana||m.lant||m.opal||m.amber],
 [/untap all artifacts you control during each other/i,m=>m.clock],
 [/costs? (?:\{\w+\} )?less|cost \{x\} less|spells you cast that share|spells you cast of the chosen/i,m=>m.dis||m.blas||m.metal||m.myco||m.impv],
 [/choose artifact, creature, enchantment|as this artifact enters, choose|imprint/i,m=>m.dis],
 [/you can't lose the game/i,m=>m.plat],
 [/phase out|protection from everything|life total can't change|until your next turn/i,m=>m.pr],
 [/new targets? for target spell/i,m=>m.pr],
 [/if you control a commander, you may cast this spell without/i,m=>m.gratis],
 [/choose one|draw cards equal to the greatest power|non-human creatures/i,m=>m.ret],
 [/draw a card for each creature/i,m=>m.sham],
 [/\bdraws? (?:a card|cards|two|three)|whenever (?:you|one or more|another)[^.]*(?:enter|cast)[^.]*draw|exile up to one target permanent/i,m=>m.dr||m.gat||m.cada||m.me||m.tome||m.slate||m.ugin||m.clamp],
 [/search your library/i,m=>m.ramp||m.tut],
 [/destroy all|exile all|damage to each creature/i,m=>m.wip],
 [/return all artifact|return target artifact card from your graveyard|return all artifact and enchantment/i,m=>m.wake||m.iron],
 [/(?:destroy|exile) target|deals? [^.]*damage to (?:target|any)|tap target creature|put a \+1\/\+1 counter on target creature you control, then it deals/i,m=>m.rem||m.remEtb||m.remAtk],
 [/hexproof|\bward\b|shroud/i,m=>m.pr||m.hexA||m.hexAO||m.hexC||m.boots||m.wardAO||m.hex||m.ward],
 [/indestructible/i,m=>m.ind||m.indA||m.indC||m.pr],
 [/equip \{|equipped creature/i,m=>m.boots],
 [/create (?:a|one|two|\d+) [^.]*(?:token|treasure)|whenever an opponent draws a card/i,m=>m.tok||m.morte||m.tithe],
 [/more than meets the eye|convert/i,m=>m.mtmte],
 [/power is equal to the number of artifacts/i,m=>m.bronze],
 [/prototype/i,m=>m.p>0],
 [/whenever you attack, other creatures you control get \+/i,m=>m.pump],
 [/whenever [^.]*attacks[^.]*(?:exile|damage to any target)/i,m=>m.remAtk],
 [/have affinity for artifacts/i,m=>m.myco],
 [/activate only if you control three or more artifacts/i,m=>m.opal],
 [/^exile .*protection\.?$|^exile teferi/i,m=>m.pr],
 [/distribute four \+1\/\+1 counters/i,m=>m.p>=8],
[/other artifact creatures you control have haste|gain haste until end of turn/i,m=>m.hasteA||m.wake],
 [/when this creature dies, you may draw a card/i,m=>m.mdraw],
 [/costs \{1\} less to cast for each attacking creature/i,m=>m.idol],
 [/deals combat damage to a player, you may cast your commander/i,m=>m.geode],
 [/deals 1 damage to you/i,m=>m.pain],
 [/metalcraft[^.]*exile that creature/i,m=>m.remMetal],
 [/its controller may search their library for a basic land/i,m=>m.giveLand],
 [/shuffle (?:it|[a-z' ,]+) into its owner's library instead/i,m=>m.noGy],
 [/sacrifice two artifacts: return this card/i,m=>m.metalrec],
 [/for as long as that card remains exiled|whenever a player plays a card exiled with/i,m=>m.prowl],
 [/have modular 1/i,m=>m.modular],
  [/you gain (?:\d+ life|4 life for each)/i,m=>m.lifeETB||m.ferocious],
 [/target player mills/i,()=>true],
 [/whenever you gain life, you may convert|return target artifact card with mana value/i,m=>m.ratch],
 [/gain control of slicer|untap slicer/i,m=>m.slicer],
 [/prevent all combat damage that would be dealt to attacking artifact creatures/i,()=>true],
 [/only once each turn/i,m=>m.gat],
 [/^unearth/i,()=>true],
 [/^0: add|^\+2:|^[−-]11:|until end of turn, you may cast those cards/i,m=>m.ugin],
];
function lacunas(m){
  if(m.land||!m.txt)return[];
  const out=[];
  for(const ln of String(m.txt).replace(/\([^)]*\)/g,'').split('\n').map(x=>x.trim()).filter(Boolean)){
    const soKw=/^(?:(?:flying|haste|vigilance|trample|reach|lifelink|menace|first strike|double strike|deathtouch|indestructible|defender|hexproof|shroud|flash|infect|improvise|affinity for artifacts|ward \{\d\}|protector)(?:, |$))+$/i.test(ln);
    if(soKw){for(const k of ln.toLowerCase().split(/,\s*/)){const key=k.replace(/ \{\d\}$/,'').replace(/ for artifacts$/,'');const f=KWOK[key];if(f?!f(m):true)out.push(k.trim());}continue;}
    for(const fr of ln.split(/(?<=\.)\s+/).map(x=>x.trim()).filter(Boolean)){
      if(CLAUSULAS.some(c=>c[0].test(fr)&&c[1](m)))continue;
      out.push(fr.length>70?fr.slice(0,67)+'...':fr);
    }
  }
  return out;
}


function rotulo(m){
  if(m.land)return{k:'Terreno',d:m.cor===ANY?'qualquer cor':m.cor?'cor '+m.cor.split('').join('/'):'incolor'};
  if(m.pr){const d={fase:'faz tudo sumir (protege de remoção e wipe, até exílio)',hi:'deixa tudo indestrutível e com resistência a magia',ind:'deixa tudo indestrutível (não salva de exílio)',volta:'devolve o que morreu no wipe',ctr:'anula a remoção, o wipe ou o combo de alguém',desvia:'desvia a remoção do seu comandante',um:'protege uma permanente da remoção'}[m.pr.k];return{k:'Proteção',d:'Guardada na mão; '+d+(m.gratis?'. De graça com o comandante em campo':'')};}
  if(m.rem&&m.sp)return{k:'Remoção',d:m.rem<1?'tira artefato/encantamento do líder (efeito menor)':'mata a maior ameaça do oponente mais forte'};
  if(m.wip)return{k:'Wipe',d:m.wip.na?'mata as criaturas que não são artefato (as suas ficam)':'mata todas as criaturas; lançado quando a mesa está mais forte'};
  if(m.wake)return{k:'Recursão',d:'devolve todos os artefatos do cemitério'};
  if(m.tut)return{k:'Tutor',d:`busca ${{a:'artefato',c:'criatura',e:'encantamento',ae:'artefato ou encantamento',i:'mágica','*':'qualquer carta'}[m.tut.t]||'carta'}${m.tut.topo?' pro topo':m.tut.campo?' direto pro campo':' pra mão'}`};
  if(m.r)return{k:'Reativa',d:'Não é lançada: o efeito não é lido'};
  if(m.mana||m.ramp||m.opal||m.amber||m.tithe)return{k:'Mana',d:m.mana?`+${m.mana} de mana${m.cor===ANY?' de qualquer cor':m.cor?' ('+m.cor.split('').join('/')+')':' incolor'}`:m.ramp?`+${m.ramp} terreno`:'condicional'};
  if(m.dis){const a={'*':'tudo',a:'artefato',h:'histórico',c:'criatura',C:'incolor',n:'não criatura'}[m.dis[0]];return{k:'Redutor',d:`${a} custa ${m.dis[1]} a menos`};}
  if(m.hexA||m.hexAO||m.hexC||m.boots||m.indA||m.indC||m.wardAO)return{k:'Proteção',d:'Em campo: '+(m.boots?'comandante equipado não pode ser alvo':m.indA?'artefatos indestrutíveis':m.indC?'criaturas indestrutíveis':m.wardAO?'outros artefatos com ward':'suas peças não podem ser alvo')+(m.p?`; ${m.p} de poder`:'')};
  if(m.dr||m.sham||m.ret||m.gat||m.cada||m.tome||m.slate||m.me||m.ugin||m.clamp)return{k:'Compra',d:m.dr?`compra ${m.dr}`:m.gat?'compra por gatilho':m.sham||m.ret?'compra variável':m.tome?'compra por ativação':m.clamp?'compra quando criatura morre':'compra todo turno'};
  if(m.clock)return{k:'Mana',d:'desvira seus artefatos no turno dos outros: sobra mana pra responder'};
  if(m.iron)return{k:'Recursão',d:'devolve 1 artefato do cemitério por turno'};
  if(m.plat)return{k:'Ameaça',d:'enquanto estiver em campo você não perde'};
  if(m.remEtb||m.remAtk)return{k:'Ameaça',d:`${m.p||0} de poder e tira ameaça do oponente`+(m.remAtk?' ao atacar':' ao entrar')};
  if(m.cri||m.tok||m.uin)return{k:'Ameaça',d:`${(m.p||0)+(m.tok||0)} de poder`+(m.morte?`; ao morrer deixa ${m.morte}`:'')};
  return{k:'Parada',d:'Lançada, mas o efeito não entra na conta'};
}

/* carta com texto que o motor nao leu */
function naoModelado(m){
  if(m.land||!m.txt||m.r||(m.cri&&m.p>0))return false;
  if(m.mana||m.ramp||m.dis||m.dr||m.sham||m.ret||m.gat||m.cada||m.tok||m.tome||m.slate||m.me||m.ugin||m.uin||m.opal||m.amber||m.myco||m.metal||m.bronze||m.magnus||m.tithe||m.pr||m.rem||m.remEtb||m.remAtk||m.wip||m.wake||m.iron||m.tut||m.hexA||m.hexAO||m.hexC||m.boots||m.indA||m.indC||m.wardAO||m.clock||m.clamp||m.plat||m.morte||m.lant)return false;
  return m.txt.replace(/\b(Flying|Haste|Vigilance|Trample|Reach|Lifelink|Menace|First strike|Double strike|Deathtouch|Indestructible|Defender|Hexproof|Ward \{\d\})\b[,\s]*/gi,'').trim().length>0;
}

function rngDe(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function emb(v,R){for(let i=v.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=v[i];v[i]=v[j];v[j]=t;}}
const gauss=R=>{let u=0;while(!u)u=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*R());};

/* arquétipos dos oponentes (mesão casual, nível 6-7). curva = poder em campo no fim de cada turno;
   rem = remoção em você por turno; c/a/x = chance por turno de wipe de criatura / artefato / exílio; combo a partir do T7 */
const ARQ=[
 {n:'Aggro (fichas)',curva:[0,1,3,6,10,14,18,22,25,28,30,32,34,36],rem:.05,c:.005,a:0,x:0,combo:0,v:.35,ev:.35},
 {n:'Midrange (bichos grandes)',curva:[0,0,2,4,7,11,15,19,23,27,31,34,37,40],rem:.10,c:.015,a:.005,x:0,combo:0,v:.35,ev:.25},
 {n:'Controle (remoção e wipe)',curva:[0,0,1,2,3,5,7,9,12,15,18,21,24,27],rem:.15,c:.035,a:.01,x:.01,combo:0,v:.4,ev:.2},
 {n:'Combo / valor',curva:[0,0,1,2,3,4,6,8,10,12,14,16,18,20],rem:.07,c:.01,a:.005,x:.005,combo:.05,v:.4,ev:.2}];
const PODS=[{n:'Mesa típica',d:'3 oponentes sorteados entre os 4 tipos, a cada partida',ops:null},{n:'Mesa agressiva',d:'2 Aggro + 1 Midrange',ops:[0,0,1]},{n:'Mesa de controle',d:'2 Controle + 1 Midrange',ops:[2,2,1]},{n:'Mesa com combo',d:'Combo + Controle + Midrange',ops:[3,2,1]}];

/* uma partida. ops = 3 arquétipos (mesa de 4) ou null (sozinho) */
function jogo(D,base,R,T,ops){
  const M=D.M,cmd=D.cmd,C=cmd?M[cmd.i]:null,L=x=>M[x].land,EV=D.ev||.3;
  /* sementes por partida e por turno: trocar 1 carta muda pouco o resto (comparacao pareada) */
  const gs=(R()*4294967296)>>>0;R=rngDe(gs);
  let d=base.slice();emb(d,R);let h=d.slice(0,7);d=d.slice(7);
  const nL=()=>{let k=0;for(const x of h)if(L(x))k++;return k;};
  if(nL()<2||nL()>5){d=base.slice();emb(d,R);h=d.slice(0,7);d=d.slice(7);}
  const fonte=n=>{const c=M[n];return c.mana||c.ramp||c.opal||c.amber;};
  const r0=[nL(),h.filter(n=>!L(n)&&fonte(n)).length,h.filter(n=>!L(n)&&M[n].g+M[n].c>=7).length];
  let bat=[],terr=[],mag=false,magt=null,tax=0,ug=0,tok=0,tomeL=4,tomeT=0,slateT=0,gy=[];
  const st={mort:0,rem:0,def:0,wip:0,salvo:0,perda:0,sc:0,mrem:0,mwip:0,tut:0,rec:0,ctr:0};
  const mesa=!!ops,P={tr:0,c:0,a:0,x:0};
  if(mesa)for(const o of ops){const a=ARQ[o];P.tr+=a.rem;P.c+=a.c;P.a+=a.a;P.x+=a.x;}
  const fat=mesa?ops.map(o=>Math.exp(gauss(R)*ARQ[o].v)):null;
  const vida=[40,40,40,40],vivo=[true,true,true,true],pwO=[0,0,0];let Pp=[0,0,0,0];
  const ordem=[0,1,2,3];if(mesa)emb(ordem,R);
  let fim=null,flagW=false;
  const tem=f=>{for(const b of bat)if(M[b][f])return true;return false;};
  const cmdArt=C&&C.a?1:0,cmdCri=C&&C.cri?1:0;
  const nArt=()=>{let k=0;for(const b of bat)if(M[b].a)k++;return k;};
  const artc=()=>nArt()+terr.length*0.1+(mag?cmdArt:0);
  const nCri=()=>{let k=0;for(const b of bat)if(M[b].cri)k++;return k+(mag?cmdCri:0)+Math.ceil((tok+ug)/2);};
  const sumO=()=>{let s=0;for(let i=0;i<3;i++)if(vivo[i+1])s+=pwO[i];return s;};
  const maxO=()=>{let s=0;for(let i=0;i<3;i++)if(vivo[i+1]&&pwO[i]>s)s=pwO[i];return s;};
  function custo(n){
    const c=M[n];if(c.gratis&&mag)return 0;let des=0;
    for(const b of bat){const dd=M[b].dis;if(!dd)continue;const k=dd[0];
      if(k==='*'||(k==='a'&&c.a)||(k==='C'&&c.inc)||(k==='h'&&(c.hist||c.a))||(k==='c'&&c.cri)||(k==='n'&&!c.cri))des+=dd[1];}
    if(c.myco||(tem('myco')&&c.a&&c.cri))des+=Math.floor(artc());
    if(c.metal)for(const b of bat)if(M[b].a&&!M[b].cri)des+=M[b].g+M[b].c;
    if(c.blas)des+=nCri()+Math.round(sumO()/2.5);
    if(c.impv)for(const b of bat)if(M[b].a&&!M[b].mana)des++;
    return Math.max(0,c.g-des)+c.c;
  }
  const pipsN=n=>(M[n].gratis&&mag)?[]:(M[n].pip||[]);
  const tem1=(u,x)=>{for(const ch of x)if(u.indexOf(ch)>=0)return true;return false;};
  function casa(p,U){
    if(!p.length)return [];
    const us=[],usado=new Uint8Array(U.length),cnt=x=>{let k=0;for(const u of U)if(u&&tem1(u,x))k++;return k;};
    const ord=p.length>1?p.slice().sort((a,b)=>cnt(a)-cnt(b)):p;
    for(const x of ord){let bi=-1;for(let i=0;i<U.length;i++){const u=U[i];if(usado[i]||!u||!tem1(u,x))continue;if(bi<0||u.length<U[bi].length)bi=i;}if(bi<0)return null;usado[bi]=1;us.push(bi);}
    return us;
  }
  function pode(n,U,extra){const tot=(extra||0)+custo(n);if(tot>U.length)return false;const p=pipsN(n);return !p.length||casa(p,U)!==null;}
  function paga(n,U,extra){
    const tot=(extra||0)+custo(n),p=pipsN(n);if(tot>U.length)return null;const us=casa(p,U);if(us===null)return null;
    const fora=[];us.sort((a,b)=>b-a).forEach(i=>fora.push(U.splice(i,1)[0]));
    const g=tot-p.length;if(g>0){U.sort((a,b)=>a.length-b.length);for(const u of U.splice(0,g))fora.push(u);}
    return fora;
  }
  const pagaG=(U,k)=>{U.sort((a,b)=>a.length-b.length);U.splice(0,k);};
  function fontes(){const u=[],lant=tem('lant'),na=nArt();
    for(const l of terr)u.push(lant?ANY:l);
    for(const b of bat){const c=M[b];
      if(c.mana)for(let i=0;i<c.mana;i++)u.push(c.cor||'');
      if(c.opal&&na>=3)u.push(ANY);
      if(c.amber&&((mag&&C&&C.leg)||bat.some(x=>M[x].leg&&M[x].cri)))u.push(ANY);
      if(c.tithe)u.push(ANY);}
    return u;}
  function compra(k){for(let i=0;i<k&&d.length;i++)h.push(d.pop());}
  function gatilho(n,lanc,est){
    const c=M[n];
    for(const b of bat){if(b===n||!M[b].gat)continue;const g=M[b].gat;
      if(g.cast&&!lanc)continue;
      const ok=g.t==='*'||(g.t==='c'&&c.cri)||(g.t==='a'&&c.a)||(g.t==='ac'&&c.a&&c.cri)||(g.t==='h'&&c.hist)||(g.t==='n'&&!c.cri);
      if(!ok)continue;
      if(g.uma){if(est.uma)continue;est.uma=1;}
      compra(1);
    }
  }
  const pB=b=>{const c=M[b];return c.bronze?(nArt()+Math.floor(terr.length*.1)+(mag?cmdArt:0)):(c.p||0);};
  function outros(){let s=2*ug+tok;for(const b of bat)s+=pB(b);return s;}
  function poder(){const o=outros();if(!mag)return o;return o+(C.magnus?(o>=4?7:4):(C.p||0));}
  const rank=n=>{const c=M[n];if(c.mana||c.ramp||c.opal||c.amber)return 0;if(c.dis)return 1;if(c.dr||c.gat||c.cada||c.tome||c.slate||c.me||c.ugin||c.clock||c.tut||c.tithe)return 2;return 3;};
  function morre(x,exila){
    if(x==='cmd'){mag=false;tax+=2;st.mort++;return;}
    const i=bat.indexOf(x);if(i<0)return;bat.splice(i,1);
    if(M[x].morte)ug+=M[x].morte/2;
    if(!exila&&M[x].a)gy.push(x);
  }
  function usar(inst,ok){
    let me=-1,mc=1e9;
    for(let k=0;k<h.length;k++){const n=h[k],c=M[n];if(!c.pr||!ok(c.pr))continue;const cu=custo(n);if(cu<mc&&pode(n,inst)){me=k;mc=cu;}}
    if(me<0)return false;const n=h[me];h.splice(me,1);paga(n,inst);if(M[n].pr.ctr)st.ctr++;return true;
  }
  function alvoRem(){
    for(const b of bat)if(M[b].plat)return b;
    if(mag)return 'cmd';
    let x=null,mv=-1;for(const b of bat){const c=M[b];if(!c.cri)continue;const v=c.bronze?8:(c.p||0);if(v>mv){mv=v;x=b;}}
    return x;
  }
  function remocao(inst){
    const x=alvoRem();if(x===null)return;
    const c=x==='cmd'?C:M[x],art=c.a,cri=c.cri,exila=R()<.3;
    const outro=f=>{for(const b of bat)if(b!==x&&M[b][f])return true;return false;};
    if(c.hex||(art&&tem('hexA'))||(art&&cri&&outro('hexAO'))||(cri&&tem('hexC'))||(x==='cmd'&&tem('boots'))){st.def++;return;}
    const w=(c.ward?1:0)+(art&&outro('wardAO')?1:0);
    for(let k=0;k<w;k++)if(R()>.5){st.def++;return;}
    if(usar(inst,p=>p.r&&!(p.ind&&exila))){st.def++;return;}
    if(!exila&&(c.ind||(art&&tem('indA'))||(cri&&tem('indC')))){st.def++;return;}
    morre(x,exila);st.rem++;
  }
  function wipe(tp,inst){
    st.wip++;
    if(usar(inst,p=>!p.volta&&(tp==='x'?p.x:(p.w&&(tp!=='a'||p.a))))){st.salvo++;return;}
    const antes=poder(),antB=bat.slice(),antM=mag,antT=tok,antU=ug,iA=tem('indA'),iC=tem('indC');
    const vale=c=>tp==='a'?c.a:c.cri,sobra=c=>tp!=='x'&&(c.ind||(c.a&&iA)||(c.cri&&iC));
    if(tp!=='a'){tok=0;ug=0;}
    for(const b of antB){const c=M[b];if(vale(c)&&!sobra(c))morre(b,tp==='x');}
    if(mag&&vale(C)&&!sobra(C))morre('cmd');
    if(tp!=='x'&&poder()<antes&&usar(inst,p=>p.volta)){gy=gy.filter(g=>!antB.includes(g));bat=antB;if(antM&&!mag){mag=true;tax-=2;st.mort--;}tok=antT;ug=antU;st.salvo++;}
    st.perda+=Math.max(0,antes-poder());
  }
  function perdaWipe(na){
    const iA=tem('indA'),iC=tem('indC');let s=na?0:tok+2*ug;
    for(const b of bat){const c=M[b];if(c.cri&&!(na&&c.a)&&!(c.ind||(c.a&&iA)||iC))s+=pB(b);}
    if(mag&&!(na&&C.a)&&!(C.a&&iA)&&!iC)s+=poder()-outros();
    return s;
  }
  function wipeMeu(na){
    const iA=tem('indA'),iC=tem('indC');
    if(!na)tok=0;
    for(const b of bat.slice()){const c=M[b];if(c.cri&&!(na&&c.a)&&!(c.ind||(c.a&&iA)||iC))morre(b,false);}
    if(mag&&!(na&&C.a)&&!(C.a&&iA)&&!iC)morre('cmd');
    flagW=true;st.mwip++;
  }
  function bate(q){
    if(!mesa)return;let j=-1;for(let i=0;i<3;i++)if(vivo[i+1]&&(j<0||pwO[i]>pwO[j]))j=i;
    if(j<0||pwO[j]<=0)return;pwO[j]=Math.max(0,pwO[j]-Math.max(2,pwO[j]*.3)*q);st.mrem++;
  }
  function tutor(c,t){
    const tt=c.tut.t,ok=x=>{const m=M[x];if(m.land)return false;if(tt==='*')return true;return (tt.includes('a')&&m.a)||(tt.includes('c')&&m.cri)||(tt.includes('e')&&m.ench)||(tt.includes('i')&&m.sp);};
    const cand=[];for(let k=0;k<d.length;k++)if(ok(d[k])&&(!c.tut.x||M[d[k]].g+M[d[k]].c<=3))cand.push(k);
    if(!cand.length)return;
    let nF=terr.length;for(const b of bat)if(M[b].mana)nF+=M[b].mana;
    let pick=-1;
    if(nF<5){const f=cand.find(k=>fonte(d[k]));if(f!==undefined)pick=f;}
    if(pick<0&&mesa&&t>=4&&!h.some(x=>M[x].pr)){const f=cand.find(k=>M[d[k]].pr&&M[d[k]].pr.x)??cand.find(k=>M[d[k]].pr);if(f!==undefined)pick=f;}
    if(pick<0){let bv=-1;for(const k of cand){const m=M[d[k]],cu=m.g+m.c;if(cu>nF+2)continue;const v=(m.dr||m.gat||m.cada||m.ugin||m.me||m.indA||m.hexA?6:0)+(m.p||0)+(m.tok||0)+cu*.5;if(v>bv){bv=v;pick=k;}}}
    if(pick<0)pick=cand[0];
    const x=d.splice(pick,1)[0];st.tut++;
    if(c.tut.topo)d.push(x);else if(c.tut.campo&&!M[x].sp)bat.push(x);else h.push(x);
  }
  const res={r0,t:[]};
  for(let t=1;t<=T;t++){
    R=rngDe((gs+t*2654435761)>>>0);
    if(t>1)compra(1);
    /* terreno: o que traz a cor que falta */
    {let li=-1,lv=-1;const U0=fontes(),need=new Set();
      for(const n of h)if(!L(n))for(const p of (M[n].pip||[]))for(const ch of p)need.add(ch);
      if(C&&!mag)for(const p of C.pip||[])for(const ch of p)need.add(ch);
      for(let k=0;k<h.length;k++){const n=h[k];if(!L(n))continue;const cor=M[n].cor||'';let v=cor.length*.1;for(const ch of cor)if(need.has(ch)&&!U0.some(u=>u.includes(ch)))v+=1;if(v>lv){lv=v;li=k;}}
      if(li>=0){terr.push(M[h[li]].cor||'');h.splice(li,1);}}
    const est={};const U=fontes();
    /* mana guardada pra resposta: a protecao mais barata da mao */
    let RES=[];
    if(mesa&&t>=5&&!tem('clock')){let me=-1,mc=1e9,free=false;for(const n of h){const c=M[n];if(!c.pr)continue;const cu=custo(n);if(cu===0){free=true;break;}if(cu<mc&&pode(n,U)){me=n;mc=cu;}}
      if(!free&&me>=0)RES=paga(me,U)||[];}
    let prog=true,sc=false;
    while(prog){
      prog=false;
      if(gy.length&&h.some(n=>M[n].wake)){let v=0;for(const g of gy)v+=(M[g].p||0)+1;
        if(v>=6){const k=h.findIndex(n=>M[n].wake&&pode(n,U));if(k>=0){const n=h[k];h.splice(k,1);paga(n,U);for(const g of gy)bat.push(g);gy=[];st.rec++;prog=true;continue;}}}
      if(C&&!mag&&pode(cmd.i,U,tax)&&!h.some(n=>!L(n)&&rank(n)===0&&pode(n,U))){paga(cmd.i,U,tax);mag=true;magt=t;prog=true;continue;}
      if(mesa){
        const mo=maxO();
        if(mo>=Math.max(5,poder()*.5)){const k=h.findIndex(n=>M[n].sp&&M[n].rem&&pode(n,U));if(k>=0){const n=h[k];h.splice(k,1);paga(n,U);bate(M[n].rem);prog=true;continue;}}
        if(mo>=8){const k=h.findIndex(n=>{const w=M[n].wip;if(!w||!pode(n,U))return false;const pl=perdaWipe(w.na);return (mo>=12&&pl<=.35*sumO())||(vida[0]<=15&&pl<=sumO());});
          if(k>=0){const n=h[k];h.splice(k,1);paga(n,U);wipeMeu(M[n].wip.na);prog=true;continue;}}
      }
      let me=-1,mr=9,mv=-1;
      for(const n of h){if(L(n))continue;const c=M[n];if(c.r||c.sham||c.ret||c.pr||c.wip||c.wake||(c.sp&&c.rem))continue;
        if(custo(n)>U.length)continue;
        if(!pode(n,U)){sc=true;continue;}
        const r=rank(n),v=c.g+c.c;if(r<mr||(r===mr&&v>mv)){me=n;mr=r;mv=v;}}
      if(me>=0){const c=M[me];
        if(!(c.imp&&h.filter(x=>!L(x)&&x!==me).length===0)){
          h.splice(h.indexOf(me),1);paga(me,U);prog=true;
          if(c.ramp)for(let k=0;k<c.ramp;k++)terr.push(ANY);
          if(c.sp){if(c.tok)tok+=c.tok;}else bat.push(me);
          if(c.imp){const o=h.filter(x=>!L(x)).sort((a,b)=>M[a].g-M[b].g);h.splice(h.indexOf(o[0]),1);}
          if(c.dr)compra(c.dr);
          if(!c.sp&&c.tok)tok+=c.tok;
          if(c.mana&&!c.cri&&!c.ramp)for(let k=0;k<c.mana;k++)U.push(c.cor||'');
          if(c.cri)gatilho(me,true,est);
          if(c.tut)tutor(c,t);
          if(c.remEtb)bate(1);
          if(c.uginX)bate(1);else if(c.inc&&tem('uginX'))bate(.5);
          continue;
        }
      }
      const iS=h.findIndex(n=>M[n].sham&&pode(n,U));
      const nc=nCri();
      if(iS>=0&&nc>=3){const n=h[iS];h.splice(iS,1);paga(n,U);compra(nc);prog=true;continue;}
      const iR=h.findIndex(n=>M[n].ret&&pode(n,U));
      if(iR>=0){let pw=mag?(C.magnus?7:(C.p||0)):0;for(const b of bat)pw=Math.max(pw,M[b].p||0);if(pw>=3){const n=h[iR];h.splice(iR,1);paga(n,U);compra(pw);prog=true;continue;}}
      if(tomeL>0&&tomeT!==t&&U.length>=2&&tem('tome')){pagaG(U,2);tomeL--;tomeT=t;compra(1);prog=true;continue;}
      if(slateT!==t&&U.length>=4&&tem('slate')){const q=bat.filter(b=>M[b].cri).length;if(q>h.length+1){pagaG(U,4);slateT=t;h=[];compra(q);prog=true;continue;}}
    }
    if(sc)st.sc++;
    if(mag&&C.magnus&&magt<t&&(t-magt)%2===1&&outros()>=4){
      const o=h.filter(n=>M[n].a&&M[n].cri);
      if(o.length){let me=o[0];for(const n of o)if(M[n].g+M[n].c>M[me].g+M[me].c)me=n;h.splice(h.indexOf(me),1);bat.push(me);gatilho(me,false,est);}
    }
    if(tem('ugin')||tem('cada'))compra(bat.filter(b=>M[b].ugin||M[b].cada).length);
    if(tem('uin'))ug++;
    if(tem('clamp')&&U.length>=1&&bat.some(b=>M[b].cri)){pagaG(U,1);compra(bat.some(b=>M[b].cri&&(M[b].p||0)<=1)?2:1);}
    if(tem('iron')&&gy.length&&(mag||bat.some(b=>M[b].iron&&M[b].cri))){gy.sort((a,b)=>(M[b].g+M[b].c)-(M[a].g+M[a].c));bat.push(gy.shift());st.rec++;}
    if(mesa&&t>=3)for(const b of bat)if(M[b].remAtk)bate(M[b].remAtk);
    if(tem('me')){const am=bat.reduce((s,b)=>s+(M[b].a?(M[b].mana||0):0),0);compra(Math.min(3,Math.floor(U.length+(tem('clock')?am*2:0))));}
    /* fase dos oponentes: remocao e wipe em voce */
    let inst=RES.concat(U);
    if(mesa&&t>=3){
      if(tem('clock')){const au=[];for(const b of bat){const c=M[b];if(c.a&&c.mana)for(let k=0;k<c.mana;k++)au.push(c.cor||'');}inst=inst.concat(au);}
      for(let k=0;k<3;k++)if(R()<P.tr/3)remocao(inst);
      if(t>=5){const f=poder()>=25?1.5:1;for(const tp of ['c','a','x'])if(R()<P[tp]*f){wipe(tp,inst);if(tp!=='a')flagW=true;}}
    }
    while(h.length>10){h.sort((a,b)=>(L(a)?-1:M[a].g)-(L(b)?-1:M[b].g));h.shift();}
    const pw=poder(),mm=fontes().length;let tr=0;for(const n of h)if(!L(n)&&!M[n].r&&custo(n)>mm)tr++;
    res.t[t]={l:terr.length,mag,mt:magt,pw,rocks:bat.filter(b=>M[b].mana).length,m:mm,vis:base.length-d.length,tr};
    /* corrida de vida: 4 jogadores */
    if(mesa&&!fim){
      for(let i=0;i<3;i++){const cv=ARQ[ops[i]].curva,a=cv[t-1]*fat[i],inc=t>1?Math.max(0,a-cv[t-2]*fat[i]):a;pwO[i]+=inc;if(flagW)pwO[i]*=.15;}
      flagW=false;
      const plat=tem('plat'),PA=[vivo[0]?pw:0,pwO[0],pwO[1],pwO[2]];
      for(let i=0;i<3&&!fim;i++)if(vivo[i+1]&&t>=7&&R()<ARQ[ops[i]].combo){if(plat)continue;if(usar(inst,p=>p.ctr)){st.def++;continue;}fim={k:'combo',t};}
      if(!fim){
        for(const a of ordem){
          if(!vivo[a]||t<2)continue;const atk=Pp[a];if(atk<=0)continue;
          const al=[];for(let j=0;j<4;j++)if(j!==a&&vivo[j])al.push(j);if(!al.length)break;
          let j;if(R()<.5){j=al[0];for(const q of al)if(PA[q]>PA[j])j=q;}else j=al[Math.floor(R()*al.length)];
          const ev=a===0?EV:ARQ[ops[a-1]].ev,bl=Math.min(atk*(1-ev),.5*PA[j]);
          vida[j]-=Math.max(0,atk-bl);
          if(vida[j]<=0&&!(j===0&&plat))vivo[j]=false;
        }
        Pp=PA;
        if(vivo[0]&&vida[0]<=0&&!plat)vivo[0]=false;
        if(!vivo[0])fim={k:'morreu',t};
        else if(!vivo[1]&&!vivo[2]&&!vivo[3])fim={k:'venceu',t};
        else if(t===T){let bi=0,bs=-1e9;for(let i=0;i<4;i++){const s=vivo[i]?vida[i]+2*PA[i]:-1e9;if(s>bs){bs=s;bi=i;}}fim={k:bi===0?'venceu':'tarde',t};}
      }
    }
    if(t>=8&&(!mesa||fim))break;
  }
  res.fim=fim;res.st=st;res.vida=vida[0];
  return res;
}

const qq=(v,p)=>{const s=v.slice().sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const media=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;

function resumo(Q,T){
  const n=Q.length,pw8=Q.map(r=>r.t[8].pw).sort((a,b)=>a-b),k=Math.max(1,Math.floor(n*.1));
  const m4=Q.map(r=>r.t[4].m);
  const porT=[];for(let t=1;t<=T;t++){const v=Q.map(r=>r.t[t].pw);porT.push({t,p10:qq(v,.1),p50:qq(v,.5),p90:qq(v,.9),m:media(v)});}
  const hist={};pw8.forEach(p=>{const b=Math.floor(p/4)*4;hist[b]=(hist[b]||0)+1;});
  const pc=f=>100*Q.filter(f).length/n;
  const out={n,piso:media(pw8.slice(0,k)),med:media(pw8),teto:media(pw8.slice(n-k)),
    m4:[qq(m4,.1),qq(m4,.5),qq(m4,.9)],
    cmd4:pc(r=>r.t[4].mag),cmd6:pc(r=>r.t[6].mag),par7:pc(r=>r.t[7].pw<8),tr6:pc(r=>r.t[6].tr>=2),sc:pc(r=>r.st.sc>=2),
    vis:media(Q.map(r=>r.t[8].vis)),porT,hist:Object.keys(hist).map(Number).sort((a,b)=>a-b).map(b=>({b,pct:100*hist[b]/n}))};
  const grupo=f=>{const g={};Q.forEach(r=>{const c=f(r);(g[c]=g[c]||[]).push(r);});
    return Object.keys(g).map(Number).sort((a,b)=>a-b).map(c=>{const v=g[c],p=v.map(r=>r.t[8].pw);
      return{c,pct:100*v.length/n,p10:qq(p,.1),p50:qq(p,.5),p90:qq(p,.9),cmd6:100*v.filter(r=>r.t[6].mag).length/v.length,par7:100*v.filter(r=>r.t[7].pw<8).length/v.length,v:v.some(r=>r.fim)?100*v.filter(r=>r.fim&&r.fim.k==='venceu').length/v.length:null};});};
  out.maoT=grupo(r=>r.r0[0]);out.maoM=grupo(r=>r.r0[1]);
  const ord=Q.slice().sort((a,b)=>a.t[8].pw-b.t[8].pw),W=ord.slice(0,k),B=ord.slice(n-k);
  const cmp=[['Terrenos na mão inicial',r=>r.r0[0]],['Fontes de mana na mão inicial',r=>r.r0[1]],['Cartas de custo 7+ na mão inicial',r=>r.r0[2]],['Terrenos no turno 6',r=>r.t[6].l],['Mana disponível no turno 6',r=>r.t[6].m],['Pedras de mana no turno 6',r=>r.t[6].rocks],['Turno do comandante',r=>r.t[8].mt||9],['Cartas impagáveis no turno 6',r=>r.t[6].tr],['Cartas vistas até o turno 8',r=>r.t[8].vis]];
  out.cmp=cmp.map(([a,f])=>({a,w:media(W.map(f)),b:media(B.map(f))}));
  return out;
}

/* placar de vitorias e derrotas */
function placar(Q){
  const n=Q.length,c=k=>Q.filter(r=>r.fim&&r.fim.k===k),v=c('venceu'),mo=c('morreu');
  return{n,venceu:100*v.length/n,morreu:100*mo.length/n,combo:100*c('combo').length/n,tarde:100*c('tarde').length/n,
    tv:media(v.map(r=>r.fim.t)),tm:media(mo.map(r=>r.fim.t)),mort:media(Q.map(r=>r.st.mort)),rem:media(Q.map(r=>r.st.rem)),def:media(Q.map(r=>r.st.def)),
    wip:media(Q.map(r=>r.st.wip)),salvo:media(Q.map(r=>r.st.salvo)),perda:media(Q.map(r=>r.st.perda)),mrem:media(Q.map(r=>r.st.mrem)),mwip:media(Q.map(r=>r.st.mwip)),tut:media(Q.map(r=>r.st.tut))};
}
/* por que ganha e por que perde: quanto cada situacao aparece nas vitorias e nas derrotas */
const FATORES=[
 ['Comandante em campo até o turno 6',r=>r.t[6].mag],
 ['Comandante morreu 2 vezes ou mais',r=>r.st.mort>=2],
 ['Travou: menos de 8 de poder no turno 7',r=>r.t[7].pw<8],
 ['Mão inicial com 2 terrenos ou menos',r=>r.r0[0]<=2],
 ['Carta presa por falta de cor em 2+ turnos',r=>r.st.sc>=2],
 ['Perdeu 10+ de poder em wipe',r=>r.st.perda>=10],
 ['Uma proteção salvou de wipe',r=>r.st.salvo>=1],
 ['Usou remoção ou wipe próprio',r=>r.st.mrem+r.st.mwip>=1],
 ['20+ de poder no turno 8',r=>r.t[8].pw>=20]];
function motivos(Q){
  const V=Q.filter(r=>r.fim&&r.fim.k==='venceu'),P=Q.filter(r=>!(r.fim&&r.fim.k==='venceu'));
  const pc=(v,f)=>v.length?100*v.filter(f).length/v.length:0;
  return FATORES.map(([a,f])=>({a,v:pc(V,f),p:pc(P,f),tot:pc(Q,f)}));
}

/* cartas boas que o motor sabe jogar, testadas como troca (so as da identidade de cor do comandante) */
const STAPLES=['Sol Ring','Arcane Signet','Fellwar Stone','Mind Stone','Thought Vessel',
 'Talisman of Conviction','Talisman of Impulse','Talisman of Unity','Talisman of Progress','Talisman of Dominance','Talisman of Indulgence','Talisman of Creativity','Talisman of Curiosity','Talisman of Hierarchy','Talisman of Resilience',
 'Boros Signet','Gruul Signet','Selesnya Signet','Orzhov Signet','Azorius Signet','Dimir Signet','Golgari Signet','Izzet Signet','Rakdos Signet','Simic Signet',
 'Cultivate',"Kodama's Reach",'Farseek',"Nature's Lore",'Three Visits','Rampant Growth','Birds of Paradise','Llanowar Elves','Chromatic Lantern','Smothering Tithe',
 'Swords to Plowshares','Path to Exile','Generous Gift','Beast Within','Chaos Warp','Anguished Unmaking','Despark',"Assassin's Trophy",'Pongify','Rapid Hybridization','Infernal Grasp','Go for the Throat','Feed the Swarm','Abrade',"Nature's Claim",'Vindicate','Putrefy','Mortify',
 'Counterspell','Arcane Denial','Swan Song','Negate',"An Offer You Can't Refuse",'Fierce Guardianship','Deflecting Swat',
 'Blasphemous Act','Farewell','Austere Command','Vanquish the Horde','Toxic Deluge','Damnation','Wrath of God','Hour of Revelation','Organic Extinction',
 "Teferi's Protection",'Heroic Intervention','Flawless Maneuver','Boros Charm','Lightning Greaves','Swiftfoot Boots','Unbreakable Formation',"Faith's Reward","Akroma's Will","Tamiyo's Safekeeping",'Darksteel Forge',
 'Skullclamp','Harmonize','Rhystic Study','Mystic Remora','Phyrexian Arena','Esper Sentinel','Guardian Project','Beast Whisperer','Return of the Wildspeaker',"Night's Whisper",'Fact or Fiction','Mazemind Tome',
 'Demonic Tutor','Vampiric Tutor','Enlightened Tutor','Worldly Tutor','Fabricate','Whir of Invention','Idyllic Tutor','Gamble',"Eladamri's Call",
 'Unwinding Clock','Leonin Abunas','Cryptothrall','Wake the Past','Brilliant Restoration','Hangarback Walker','Platinum Angel','Dispatch','Knockout Maneuver',"Esika's Chariot"];

function monta(itens,achar,cmdEsc){
  const M=[],idx=new Map(),base=[],falta=[],lin=[];let cmd=null;
  const add=rec=>{if(idx.has(rec[0]))return idx.get(rec[0]);const m=modelo(rec);M.push(m);idx.set(rec[0],M.length-1);return M.length-1;};
  const leg=[];
  for(const it of itens){const rec=achar(it.nome);if(!rec){falta.push(it);continue;}
    if(/\bLegendary\b/.test(rec[3]||'')&&/\bCreature\b/.test(rec[3]||''))leg.push(rec[0]);
    it.rec=rec;}
  let alvo=cmdEsc||null;
  if(!alvo){const c=itens.find(i=>i.cmd&&i.rec);if(c)alvo=c.rec[0];}
  if(!alvo&&leg.length){
    /* sem marcacao: a lendaria cuja identidade de cor cobre mais cartas da lista */
    const cs=itens.filter(i=>i.rec).map(i=>i.rec[7]||'');let melhor=-1;
    for(const n of new Set(leg)){const r=itens.find(i=>i.rec&&i.rec[0]===n).rec,ci=r[7]||'';
      const ok=cs.filter(x=>[...x].every(l=>ci.includes(l))).length+ci.length*.01;
      if(ok>melhor){melhor=ok;alvo=n;}}
  }
  for(const it of itens){if(!it.rec)continue;
    let q=it.q;
    if(!cmd&&it.rec[0]===alvo){const i=add(it.rec);cmd={i};lin.push({i,q:1,cmd:true});q--;if(q<=0)continue;}
    const i=add(it.rec);lin.push({i,q});
    for(let j=0;j<q;j++)base.push(i);
  }
  if(!cmd&&alvo){const rec=achar(alvo);if(rec){const i=add(rec);cmd={i};lin.unshift({i,q:1,cmd:true});}}
  for(const f of falta)for(let j=0;j<f.q;j++){const i=add([f.nome+' (não achada)','',0,'Instant','','','','',null,false]);base.push(i);}
  /* carta vazia (pra medir quanto cada carta vale) e candidatas de troca */
  const vazio=add(['(carta vazia)','',0,'Instant','','','','',null,false]);
  const ci=cmd?(M[cmd.i].ci||''):'WUBRG',naLista=new Set(base.map(i=>M[i].nome));
  const cand=[];
  for(const n of STAPLES){if(naLista.has(n))continue;const rec=achar(n);if(!rec||naLista.has(rec[0]))continue;if(![...(rec[7]||'')].every(l=>ci.includes(l)))continue;cand.push(add(rec));}
  let ev=0,nc=0;for(const i of base){const m=M[i];if(m.cri){nc++;if(m.ev)ev++;}}
  return{M,base,cmd,falta,lin,leg:[...new Set(leg)],vazio,cand,ev:Math.min(.45,Math.max(.25,.25+.2*(nc?ev/nc:0)))};
}

/* ops da mesa: fixo ou sorteado por partida */
function opsDe(pod,R){if(pod.ops)return pod.ops;return [0,1,2].map(()=>Math.floor(R()*4));}
function lote(D,base,pod,N,seed,T){const R=rngDe(seed),Q=[];for(let i=0;i<N;i++)Q.push(jogo(D,base,R,T,pod?opsDe(pod,R):null));return Q;}
function simula(D,N,seed,T){T=T||8;return resumo(lote(D,D.base,null,N,seed,T),T);}
const ganhou=Q=>{const v=new Uint8Array(Q.length);Q.forEach((r,i)=>{v[i]=r.fim&&r.fim.k==='venceu'?1:0;});return v;};
/* diferenca pareada (mesmas sementes): media e erro padrao, em pontos de % */
function dif(a,b){const n=a.length;let s=0,s2=0;for(let i=0;i<n;i++){const d=b[i]-a[i];s+=d;s2+=d*d;}const m=s/n,v=Math.max(0,s2/n-m*m);return{d:100*m,se:100*Math.sqrt(v/n)};}
const troca=(base,de,para)=>{const b=base.slice(),k=b.indexOf(de);if(k>=0)b[k]=para;return b;};

function analise(D,cfg,prog){
  cfg=cfg||{};const N=cfg.N||3000,NL=cfg.NL||1000,NC=cfg.NC||1500,T=14,P=prog||(()=>{});
  const out={pods:[]};
  P('Mesa típica',0);
  const Q0=lote(D,D.base,PODS[0],N,7,T);
  out.resumo=resumo(Q0,8);out.placar=placar(Q0);out.motivos=motivos(Q0);
  out.pods.push({n:PODS[0].n,d:PODS[0].d,...placar(Q0)});
  for(let p=1;p<4;p++){P(PODS[p].n,p/12);const Q=lote(D,D.base,PODS[p],Math.round(N/2),7+p,T);out.pods.push({n:PODS[p].n,d:PODS[p].d,...placar(Q)});}
  /* quanto cada carta vale: troca por uma carta vazia e ve quantas vitorias perde */
  const ref=ganhou(lote(D,D.base,PODS[0],NL,11,T));
  const dist=[...new Set(D.base)].filter(i=>!D.M[i].land&&!(D.cmd&&i===D.cmd.i));
  out.loo=[];
  dist.forEach((i,k)=>{P('Valor de cada carta',.33+.37*k/dist.length);
    const v=ganhou(lote(D,troca(D.base,i,D.vazio),PODS[0],NL,11,T)),x=dif(v,ref);
    out.loo.push({i,nome:D.M[i].nome,d:x.d,se:x.se});});
  out.loo.sort((a,b)=>a.d-b.d);
  /* candidatas: entram no lugar da carta que menos ajuda */
  const pior=out.loo.filter(l=>!(cfg.fixas||[]).includes(l.nome));
  out.cand=[];
  if(pior.length){const sai=pior[0].i,refS=ganhou(lote(D,troca(D.base,sai,D.vazio),PODS[0],NL,13,T)),refB=ganhou(lote(D,D.base,PODS[0],NL,13,T));
    D.cand.forEach((c,k)=>{P('Testando cartas de fora',.7+.15*k/D.cand.length);
      const v=ganhou(lote(D,troca(D.base,sai,c),PODS[0],NL,13,T)),x=dif(refS,v),y=dif(refB,v);
      out.cand.push({i:c,nome:D.M[c].nome,d:x.d,se:x.se,vs:y.d,sai:D.M[sai].nome});});
    out.cand.sort((a,b)=>b.vs-a.vs);}
  /* confirma as 5 melhores, cada uma no lugar de uma das cartas mais fracas, nas 4 mesas */
  const top=out.cand.filter(c=>c.vs>0).slice(0,5),refP=[];out.trocas=[];
  top.forEach((c,k)=>{const s=pior[Math.min(k,pior.length-1)];if(!s)return;
    P('Confirmando trocas nas 4 mesas',.85+.12*k/Math.max(1,top.length));
    const b2=troca(D.base,s.i,c.i),pod=[];
    for(let p=0;p<4;p++){const a=refP[p]||(refP[p]=ganhou(lote(D,D.base,PODS[p],NC,23+p,T))),b=ganhou(lote(D,b2,PODS[p],NC,23+p,T));pod.push(dif(a,b));}
    const pos=pod.filter(x=>x.d>0).length,md=media(pod.map(x=>x.d)),se=Math.sqrt(media(pod.map(x=>x.se*x.se))/4);
    out.trocas.push({sai:s.nome,entra:c.nome,iS:s.i,iE:c.i,pod,pos,d:md,se,ok:md>1.5*se&&pos>=3});});
  const ok=out.trocas.filter(t=>t.ok);
  if(ok.length>1){P('Somando as trocas',.97);let b=D.base.slice();const usados=new Set();
    for(const t of ok){if(usados.has(t.iS))continue;usados.add(t.iS);b=troca(b,t.iS,t.iE);}
    out.junto=[];for(let p=0;p<4;p++){const a=ganhou(lote(D,D.base,PODS[p],NC,31+p,T)),c=ganhou(lote(D,b,PODS[p],NC,31+p,T));out.junto.push({n:PODS[p].n,...dif(a,c)});}}
  P('Pronto',1);
  return out;
}
/* comparar 2 listas nas 4 mesas */
function corrida(D,N){const o=[];for(let p=0;p<4;p++)o.push({n:PODS[p].n,...placar(lote(D,D.base,PODS[p],N||1500,41+p,14))});return o;}


/* conceito do deck: temas (t) definem a ideia; funcoes (f) so valem quando nao ha tema */
const CONC=[
 ['Artefatos','t',/artefato|artifact/i,m=>/Artifact/.test(m.tl||'')],
 ['Criaturas artefato','t',/criaturas? artefato|artifact creature/i,m=>/Artifact/.test(m.tl||'')&&/Creature/.test(m.tl||'')],
 ['Criaturas','t',/\bcriaturas?\b(?! artefato)|aggro|tribal/i,m=>!!m.cri],
 ['Fichas','t',/fichas?\b|tokens?\b/i,m=>/token/i.test(m.txt||'')],
 ['Equipamentos','t',/equipamento|equip/i,m=>/Equipment/.test(m.tl||'')],
 ['Encantamentos','t',/encantamento|enchant/i,m=>/Enchantment/.test(m.tl||'')],
 ['Voar','t',/\bvoa|voadora|flying/i,m=>/Flying/.test(m.txt||'')],
 ['Cemitério','t',/cemit[eé]rio|graveyard|reanima/i,m=>/graveyard/i.test(m.txt||'')],
 ['Marcadores +1/+1','t',/marcador|\+1\/\+1/i,m=>/\+1\/\+1 counter/i.test(m.txt||'')],
 ['Ganho de vida','t',/ganh\w* (de )?vida|lifegain/i,m=>/gain.{0,14}life/i.test(m.txt||'')],
 ['Landfall','t',/landfall|terrenos? extras?/i,m=>/landfall|whenever a land/i.test(m.txt||'')],
 ['Mágicas','t',/instant[aâ]ne|feiti[cç]o|spellslinger/i,m=>/Instant|Sorcery/.test(m.tl||'')],
 ['Ramp','f',/\bramp|acelera/i,m=>!!(m.mana||m.ramp)],
 ['Compra','f',/compra|card draw/i,m=>!!(m.dr||m.cada||m.gat)],
 ['Remoção','f',/remo[cç][aã]o|remov/i,m=>!!(m.rem||m.remEtb||m.wip)],
 ['Contra-mágica','f',/contra-?m[aá]gica|counterspell/i,m=>!!(m.pr&&m.pr.ctr)],
 ['Proteção','f',/prote[cç]|hexproof|indestrut/i,m=>/hexproof|indestructible|protection|shroud/i.test(m.txt||'')],
];
const lerConceito=t=>CONC.filter(c=>c[2].test(t||'')).map(c=>c[0]);
function encaixa(m,tags){if(!tags||!tags.length||m.land)return 1;const T=CONC.filter(c=>tags.includes(c[0])),tm=T.filter(c=>c[1]==='t');
  return (tm.length?tm:T).some(c=>c[3](m))?1:0;}
/* mais candidatas: as mais usadas nos decks da mesa (na identidade de cor) + as que ele quer testar */
function maisCand(D,nomes,achar,extras){const ci=D.cmd?(D.M[D.cmd.i].ci||''):'WUBRG',tem=new Set(D.base.map(i=>D.M[i].nome)),ja=new Set(D.cand.map(i=>D.M[i].nome)),ex=[];
  const put=(n,forca)=>{const rec=achar(n);if(!rec||tem.has(rec[0]))return;if(![...(rec[7]||'')].every(l=>ci.includes(l)))return;
    let i=D.M.findIndex(m=>m.nome===rec[0]);if(i<0){const m=modelo(rec);if(m.land&&!forca)return;D.M.push(m);i=D.M.length-1;}
    if(forca){if(!ex.includes(i))ex.push(i);}else if(!ja.has(rec[0])&&!D.M[i].land){D.cand.push(i);ja.add(rec[0]);}};
  for(const n of extras||[])put(n,true);for(const n of nomes||[])put(n,false);D.extras=ex;return D;}
function popularOps(Ops){const c=new Map();for(const D of Ops)for(const n of new Set(D.base.map(i=>D.M[i]).filter(m=>!m.land).map(m=>m.nome)))c.set(n,(c.get(n)||0)+1);
  return [...c.entries()].filter(x=>x[1]>=3).sort((a,b)=>b[1]-a[1]).slice(0,80).map(x=>x[0]);}
function popular(listas){const c=new Map();for(const t of listas)for(const it of new Map(parseLista(t).map(x=>[x.nome,x])).values())c.set(it.nome,(c.get(it.nome)||0)+1);
  return [...c.entries()].filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);}
if(typeof module!=='undefined')module.exports={popularOps,CONC,lerConceito,encaixa,maisCand,popular,norm,parseLista,modelo,monta,simula,analise,corrida,rotulo,naoModelado,parseCusto,PODS,ARQ,STAPLES,lote,placar,jogo,rngDe};
if(typeof self!=='undefined'&&typeof window==='undefined'&&typeof module==='undefined'){
  self.onmessage=e=>{const{id,tipo,D,N,seed,cfg}=e.data;
    try{let r;
      if(tipo==='analise')r=analise(D,cfg,(fase,p)=>self.postMessage({id,prog:{fase,p}}));
      else if(tipo==='corrida')r=corrida(D,N);
      else r=simula(D,N,seed,8);
      self.postMessage({id,r});}catch(x){self.postMessage({id,erro:String(x)+' '+(x.stack||'')});}};
}
