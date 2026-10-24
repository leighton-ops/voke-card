/* Voke V4 inline preview: runs the V4 card (PR #4) inside a chat widget, with a stand-in for the Voke server
   built from a library snapshot. Chat messages from the card go through sendPrompt. */
(function(){
const DATA=window.VOKE_V4_DATA;
const BASE=document.currentScript.src.replace(/host\.js.*$/,'');
const mount=document.getElementById('voke-v4');
const f=document.createElement('iframe');f.title='Voke';f.setAttribute('allow','clipboard-write');
f.style.cssText='display:block;width:100%;height:732px;border:0;background:transparent';
mount.innerHTML='';mount.appendChild(f);
fetch(BASE+'card.html').then(r=>r.text()).then(t=>{f.srcdoc=t;}).catch(()=>{mount.textContent='Couldn’t load the Voke card.';});
const cards=DATA.cards,byName=Object.fromEntries(cards.map(c=>[c.name,c]));
const stars={},mine={};cards.forEach(c=>{stars[c.name]=c.stars||1;mine[c.name]=false;});
const norm=s=>String(s||'').toLowerCase();
const FILLER=new Set('a an the me my some any all for skill skills voke please to of'.split(' '));
function score(c,q){const words=norm(q).split(/[^a-z0-9]+/).filter(w=>w&&!FILLER.has(w));if(!words.length)return 1;let s=0;const t=norm(c.title),tg=norm((c.tags||[]).join(' ')),d=norm(c.description);for(const w of words){const st=w.replace(/s$/,'');if(t.includes(st))s+=3;if(tg.includes(st))s+=2;if(d.includes(st))s+=1;}return s;}
function resolve(kind,q){if(!q)return null;q=norm(q).replace(/^[@#*]/,'');
 if(kind==='category'){const c=DATA.categories.find(x=>x.key===q||norm(x.label)===q);return c?{kind,status:'ok',query:q,value:{key:c.key,label:c.label}}:{kind,status:'none',query:q,candidates:[]};}
 if(kind==='creator'){const hs=[...new Map(cards.map(c=>[c.creator.handle,c.creator.name])).entries()];const ex=hs.find(([h])=>h===q);if(ex)return {kind,status:'ok',query:q,value:{key:ex[0],label:ex[1]}};const m=hs.filter(([h,n])=>h.includes(q)||norm(n).includes(q));if(m.length===1)return {kind,status:'ok',query:q,value:{key:m[0][0],label:m[0][1]}};return m.length?{kind,status:'ambiguous',query:q,candidates:m.slice(0,6).map(([h,n])=>({key:h,label:n}))}:{kind,status:'none',query:q,candidates:[]};}
 return {kind,status:'none',query:q,candidates:[]};}
const withStars=c=>Object.assign({},c,{stars:stars[c.name],starred:mine[c.name]});
function page(a){const filters=['creator','category','resource'].map(k=>resolve(k,a[k])).filter(Boolean);
 let list=cards.map(c=>[c,score(c,a.query||'')]).filter(([,s])=>s>0);
 if(a.query)list.sort((x,y)=>y[1]-x[1]);
 const total_unfiltered=list.length;
 if(filters.some(f=>f.status!=='ok'))list=[];
 for(const fl of filters){if(fl.status!=='ok')continue;list=list.filter(([c])=>fl.kind==='creator'?c.creator.handle===fl.value.key:fl.kind==='category'?c.category===fl.value.key:true);}
 const off=a.offset||0,lim=Math.max(1,Math.min(a.limit||20,50)),res=list.slice(off,off+lim).map(([c])=>withStars(c));
 return {query:a.query||'',mode:a.mode||'browse',filters,categories:DATA.categories,total_unfiltered,total:list.length,results:res,next_offset:off+lim<list.length?off+lim:null,view:'browser'};}
function tool(name,a){
 if(name==='voke'&&(a.action==='page'||a.action==='open'))return {structuredContent:page(a)};
 if(name==='voke_star'){if(a.name){mine[a.name]=!!a.on;stars[a.name]=Math.max(1,stars[a.name]+(a.on?1:-1));const o={};o[a.name]={count:stars[a.name],starred:mine[a.name]};return {structuredContent:{stars:o}};}
  const o={};(a.names||cards.map(c=>c.name)).forEach(n=>{if(n in stars)o[n]={count:stars[n],starred:mine[n]};});return {structuredContent:{stars:o}};}
 if(name==='voke_skill'){const d=DATA.details[a.name];if(!d)return {isError:true,content:[{type:'text',text:'Unknown skill.'}]};return {structuredContent:{skill:withStars(byName[a.name]),detail:d.detail,category_label:d.category_label,license:byName[a.name].license,pairs:d.pairs.map(n=>withStars(byName[n])),similar:d.similar.map(n=>withStars(byName[n]))}};}
 return {isError:true,content:[{type:'text',text:'Not available in the preview.'}]};}
function logSent(t){if(typeof sendPrompt==='function'){sendPrompt(t);return;}const ol=document.getElementById('sent');if(ol.firstElementChild&&ol.firstElementChild.style.listStyle)ol.innerHTML='';const li=document.createElement('li');li.innerHTML='<code></code>';li.firstChild.textContent=t;ol.appendChild(li);}
const theme=(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
window.addEventListener('message',e=>{if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
 const reply=x=>f.contentWindow.postMessage(Object.assign({jsonrpc:'2.0',id:m.id},x),'*');
 if(m.method==='ui/initialize')reply({result:{hostContext:{theme}}});
 else if(m.method==='ui/notifications/initialized')setTimeout(()=>f.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:page({action:'open',query:''})}},'*'),250);
 else if(m.method==='ui/notifications/size-changed'){if(m.params.height)f.style.height=m.params.height+'px';}
 else if(m.method==='tools/call')setTimeout(()=>reply({result:tool(m.params.name,m.params.arguments||{})}),120);
 else if(m.method==='ui/message'){const c=m.params.content;logSent(Array.isArray(c)?c[0].text:c.text);reply({result:{}});}
 else if(m.id!=null)reply({result:{}});
});

})();
