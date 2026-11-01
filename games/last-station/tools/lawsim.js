// node lawsim.js <runs> <days> [strategies]
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
const RUNS=+(process.argv[2]||20),DAYS=+(process.argv[3]||30),STRATS=(process.argv[4]||'none,harsh,soft,mixed,random').split(','),MODE=process.argv[5]||'A';
(async()=>{const src=fs.readFileSync('/home/user/agent/games/last-station/index.html','utf8');
fs.writeFileSync('page50.html','<!doctype html><html><head><meta charset=utf8></head><body>'+src+'</body></html>');
const b=await chromium.launch({args:['--use-gl=swiftshader']});const ctx=await b.newContext({viewport:{width:800,height:500}});
await ctx.route('**/three.min.js',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/page50.html');await p.waitForTimeout(500);
const all={};
for(const ST of STRATS){all[ST]=[];
 for(let r=0;r<RUNS;r++){
  const res=await p.evaluate(([ST,DAYS,MODE])=>{
   const s=newGame('normal',false);S=s;ui.mode='sim';s.paused=true;const pop0=popTotal(s);let arrivals=0;
   const lawOf=c=>{const m=String(c.f).match(/signLaw\(s,'(\w+)'/);return m?m[1]:null;};
   const HARSH=LAWS.filter(L=>L.br==='harsh'||L.br==='order').map(L=>L.id);
   const SOFT=LAWS.filter(L=>L.br==='care'||L.br==='faith').map(L=>L.id);
   const MIX=['soup','quarantine','cemetery','g_watch','standard','norms','restday','g_repair','ext_shift','private','overcrowd','child_shelter','apprentice','g_militia','g_bounty','recycling','techcourse','scrapdrive','mandatory','arena','crowding','food_ration','g_fort','cap_ind','f_prayer','f_shrines','f_temple','f_penance','f_denounce','f_protector'];
   const allow=id=>ST==='harsh'?HARSH.includes(id):ST==='soft'?SOFT.includes(id):ST==='mixed'?MIX.includes(id):ST==='random';
   const near=(type,cx,cy,maxd)=>{let best=null,bd=1e9;for(let y=1;y<GH-1;y++)for(let x=1;x<GW-1;x++){if(!canPlace(s,type,x,y))continue;const d=Math.hypot(x-cx,y-cy);if(d<bd&&d<=maxd){bd=d;best={x,y};}}return best;};
   const build=(type,cx=GX,cy=GY,md=12)=>{if(!buildAvail(s,type)||!canAfford(s,buildCost(s,type)))return false;const q=near(type,cx,cy,md);if(!q)return false;act(s,{t:'build',type,x:q.x,y:q.y});return true;};
   const cnt=t=>s.bld.filter(b=>b.type===t).length;const signed=[];
   for(let h=0;h<24*DAYS&&!s.over;h++){
    let guard=0;while(s.queue.length&&!s.over&&guard++<20){const e=s.queue[0];const E=EV[e.id];if(!E){s.queue.shift();continue;}
      let i=E.c.findIndex(c=>(!c.ok||c.ok(s,e.p))&&(!lawOf(c)||allow(lawOf(c))));if(i<0)i=E.c.length-1;const pb=popTotal(s);act(s,{t:'choose',i});}
    if(s.over)break;
    const pb=popTotal(s),db=s.deaths;hourTick(s);upgradeStep(s,1);syncTeams(s);
    if(s.wave||(s.zombies||[]).length)for(let k=0;k<20&&(s.wave||s.zombies.length);k++)combatStep(s,.05);
    if(MODE==='B'&&s.hour===6&&!(s.wave&&s.wave.left>0))s.zombies=[];
    if(s.hour===7){
     const pop=popTotal(s);act(s,{t:'gen',k:'stove'});
     if(s.day===1){build('catapult',15,9,4);build('archer',15,9,4);}
     if(cnt('workshop')<1&&s.day>1)build('workshop');else if(cnt('workshop')<2&&s.day>4)build('workshop');
     if(buildAvail(s,'sawmill')&&cnt('sawmill')<3)build('sawmill');
     if(buildAvail(s,'scrapyard')&&cnt('scrapyard')<1)build('scrapyard');
     if(cnt('farm')<Math.ceil(pop/14)&&s.res.food<pop*4)build('farm');
     if(cnt('kitchen')<Math.ceil(pop/45))build('kitchen');
     if(cnt('medpost')<Math.min(3,1+Math.floor(s.day/3))&&s.day>1)build('medpost');
     if(housing(s)<pop)for(let k=0;k<4&&housing(s)<pop;k++)if(!build(has(s,'t_barracks')&&s.res.steel>20?'barracks':'tent'))break;
     for(const t of ['catapult','archer','catapult','archer','catapult','archer'])if(cnt(t)<3&&(t==='catapult'?cnt(t)<Math.min(3,1+Math.floor(s.day/4)):cnt(t)<Math.min(3,1+Math.floor(s.day/3))))build(t,15,9,4);
     if(buildAvail(s,'coalmine')&&cnt('coalmine')<2)build('coalmine');
     if(buildAvail(s,'steamgun')&&cnt('steamgun')<1)build('steamgun',14,8,4);
     for(const lb of ['cemetery','nursery','arena','still','patrol','radio','guardhouse','hall','shrine'])if(buildAvail(s,lb)&&cnt(lb)<1)build(lb);
     const ups=s.bld.filter(b=>!b.build&&!(b.upT>0)&&canUpgrade(b)&&(TOWER[b.type]||b.type==='workshop')).sort((a,c)=>(a.lvl||0)-(c.lvl||0));
     for(const b of ups){const c=upCost(s,b,b.lvl||0);if(canAfford(s,c)&&(s.res.wood-(c.wood||0))>30)act(s,{t:'upgrade',id:b.id});}
     if(s.day>6)for(const b of s.bld.filter(b=>B[b.type].house&&!b.build&&!(b.upT>0)&&(b.ins||0)<2)){const c=insCost(s,b.ins||0,b);if(canAfford(s,c)&&s.res.wood>60)act(s,{t:'insulate',id:b.id});}
     for(const b of s.bld.filter(b=>B[b.type].job).sort((a,c)=>(['farm','kitchen','medpost','hydro'].includes(a.type)?0:1)-(['farm','kitchen','medpost','hydro'].includes(c.type)?0:1)))act(s,{t:'work',id:b.id,n:10});
     {const P=[];for(let i=0;i<s.grid.length;i++)if(s.grid[i].pile){act(s,{t:'work',x:i%GW,y:Math.floor(i/GW),n:0});P.push(i);}
      const pr=r=>r==='wood'?(s.res.wood<150?0:3):r==='steel'?1:r==='stone'?2:r==='coal'?(s.res.coal<24*[0,3,5,8,12][s.gen.lvl]*3?0:4):3;
      P.sort((a,c)=>pr(s.grid[a].pile.r)-pr(s.grid[c].pile.r));for(const i of P)act(s,{t:'work',x:i%GW,y:Math.floor(i/GW),n:5});}
     if(!s.research){const PRI=['t_saw','t_coal','t_scrap','t_barracks','t_heater','t_farm2','t_hospital'];const T0=PRI.map(id=>TECHBY[id]).find(t=>t&&!has(s,t.id)&&(!t.req||t.req.every(r=>has(s,r)))&&canAfford(s,t.cost));if(T0)act(s,{t:'research',id:T0.id});}
     if(!s.research){const T=TECH.filter(t=>!has(s,t.id)&&(!t.req||t.req.every(r=>has(s,r)))&&canAfford(s,t.cost)).sort((a,c)=>a.rp-c.rp)[0];if(T)act(s,{t:'research',id:T.id});}
     for(const tm of s.teams)if(tm.path.length<2&&!tm.explore&&!tm.rest){const k=Object.keys(s.st).filter(k=>s.st[k].k===1);if(k.length)act(s,{t:'send',team:tm.id,to:k[0]});}
     // законы по стратегии
     if(ST!=='none'&&s.lawCd<=0){let cand=LAWS.filter(L=>canSign(s,L.id)&&allow(L.id));
       if(ST==='mixed'){const raises=L=>(L.fx.disc>0)||(L.m&&L.m.d>0)||['ext_shift','child_labor','additives','food_ration','mandatory','norms','scrapdrive','cap_ind','quarantine','communal','recycling'].includes(L.id);if(s.disc>55)cand=cand.filter(L=>!raises(L));cand.sort((a,c)=>MIX.indexOf(a.id)-MIX.indexOf(c.id));const calm=['moonshine','arena','restday','o_watch','o_patrol','f_penance'];if(s.disc>45){const cc=cand.filter(L=>calm.includes(L.id));if(cc.length)cand=cc.concat(cand.filter(L=>!calm.includes(L.id)));}}
       if(ST==='random')cand=cand.sort(()=>Math.random()-.5);
       if(cand.length){act(s,{t:'law',id:cand[0].id});if(has(s,cand[0].id))signed.push(cand[0].id+'@'+s.day);}}
     const days=s.res.coal/Math.max(1,[0,3,5,8,12][s.gen.lvl]*24);const cold=ambient(s);
     const want=cold<-25||days>3?genMax(s):Math.max(1,genMax(s)-1);if(s.gen.lvl!==want)act(s,{t:'gen',k:'lvl',d:want-s.gen.lvl});
     if(!s.gen.on&&s.res.coal>5)act(s,{t:'gen',k:'on'});
    }
   }
   return {ideo:s.laws.filter(x=>LAWBY[x]&&LAWBY[x].cat!=='adapt').length,ideoDay:(signed.find(x=>/^[of]_/.test(x))||'').split('@')[1]||null,over:s.over,day:s.day,pop:popTotal(s),pop0,deaths:s.deaths,dc:s.dc||{},hope:Math.round(s.hope),disc:Math.round(s.disc),laws:s.laws.slice(),signed};
  },[ST,DAYS,MODE]);
  all[ST].push(res);process.stdout.write(`${ST}#${r} ${res.over||'alive'} d${res.day} deaths ${res.deaths} laws ${res.laws.length}\n`);
 }}
fs.writeFileSync('./sim_'+MODE+'_'+DAYS+'.json',JSON.stringify(all));
console.log('ERR',errs.slice(0,5));await b.close();})();
