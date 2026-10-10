(function(root){
'use strict';
const W=36,H=30,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TYPES={
 road:{name:'道路',cost:35,upkeep:.35},bridge:{name:'桥梁',cost:220,upkeep:2},
 residential:{name:'住宅区',cost:70,upkeep:0,color:'#62c69c',caps:[0,40,85,150]},
 commercial:{name:'商业区',cost:90,upkeep:0,color:'#63afe1',caps:[0,20,45,85]},
 industrial:{name:'工业区',cost:110,upkeep:0,color:'#efbc65',caps:[0,35,70,130]},
 power:{name:'发电站',cost:2600,upkeep:75,capacity:1500},water:{name:'供水站',cost:1800,upkeep:50,capacity:1800},
 park:{name:'公园',cost:450,upkeep:8,radius:5},fire:{name:'消防站',cost:1500,upkeep:40,radius:8},
 clinic:{name:'诊所',cost:1800,upkeep:50,radius:7},school:{name:'学校',cost:1600,upkeep:45,radius:7},
 bulldoze:{name:'拆除',cost:20,upkeep:0}
};
const ZONES=['residential','commercial','industrial'];
const road=t=>t && (t.type==='road'||t.type==='bridge');
class City{
 constructor(seed=721,starter=true){
  this.version=1;this.seed=seed>>>0;this.month=0;this.cash=28000;this.tax=9;this.funding={power:100,water:100,services:100,roads:100};
  this.loans=[];this.history=[];this.messages=[];this.goals=[];this.lastAction=null;this.disasters=true;
  this.tiles=Array.from({length:W*H},(_,i)=>{let x=i%W,y=Math.floor(i/W),river=26+Math.round(Math.sin(y/5)*1.2);return {terrain:Math.abs(x-river)<=1?'water':(this.random()<.19?'forest':'grass'),type:null,level:0,pop:0,damage:0};});
  this.tiles[14*W]={terrain:'grass',type:'road',level:0,pop:0,damage:0,gateway:true};
  if(starter)this.starter();this.recompute();this.log('欢迎来到江湾市。连接道路、规划分区，让城市慢慢成长。','info');
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 neighbors(i){let x=i%W,y=Math.floor(i/W),a=[];if(x)a.push(i-1);if(x<W-1)a.push(i+1);if(y)a.push(i-W);if(y<H-1)a.push(i+W);return a;}
 starter(){
  const put=(x,y,type,level=0,pop=0)=>{this.tiles[y*W+x]={terrain:'grass',type,level,pop,damage:0};};
  for(let x=1;x<=18;x++)put(x,14,'road');for(let y=8;y<=21;y++)put(9,y,'road');
  for(let x=4;x<=14;x++)put(x,10,'road');for(let x=4;x<=17;x++)put(x,19,'road');
  [[5,11],[6,11],[7,11],[8,11],[10,11],[11,11]].forEach(([x,y],k)=>put(x,y,'residential',1,k<3?25:0));
  [[5,13],[7,13],[11,13]].forEach(([x,y])=>put(x,y,'commercial',1));
  [[13,18],[14,18],[15,18],[16,18]].forEach(([x,y])=>put(x,y,'industrial',1));
  put(17,15,'power');put(18,13,'water');put(8,9,'park');put(10,9,'clinic');put(8,16,'fire');
 }
 log(text,kind='info'){this.messages.unshift({month:this.month,text,kind});this.messages=this.messages.slice(0,40);}
 build(x,y,type){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=W||y>=H||!Object.hasOwn(TYPES,type))return {ok:false,reason:'无效位置或建筑'};
  let i=y*W+x,t=this.tiles[i];if(t.gateway)return {ok:false,reason:'区域入口不能拆除'};
  if(type==='bulldoze'){
   if(!t.type&&t.terrain!=='forest')return {ok:false,reason:'这里没有可拆除的建筑'};
   if(this.cash<20)return {ok:false,reason:'拆除需要 ¥20'};
   this.lastAction={i,before:{...t},cash:this.cash,month:this.month};this.cash-=20;this.tiles[i]={terrain:t.terrain==='forest'?'grass':t.terrain,type:null,level:0,pop:0,damage:0};this.recompute();return {ok:true};
  }
  if(t.type)return {ok:false,reason:'请先拆除现有建筑'};
  if((t.terrain==='water')!==(type==='bridge'))return {ok:false,reason:t.terrain==='water'?'水面只能建桥梁':'桥梁需要建在水面'};
  let cost=TYPES[type].cost+(t.terrain==='forest'?15:0);if(this.cash<cost)return {ok:false,reason:'资金不足'};
  this.lastAction={i,before:{...t},cash:this.cash,month:this.month};this.cash-=cost;t.type=type;t.level=0;t.pop=0;t.damage=0;this.recompute();return {ok:true,cost};
 }
 undo(){let a=this.lastAction;if(!a||a.month!==this.month)return false;this.tiles[a.i]=a.before;this.cash=a.cash;this.lastAction=null;this.recompute();return true;}
 network(){
  this.components=[];this.sources={};this.comp=new Int32Array(W*H).fill(-1);this.access=new Int32Array(W*H).fill(-1);this.adjRoad=new Int32Array(W*H).fill(-1);
  this.tiles.forEach((t,i)=>{if(!road(t)||this.comp[i]>=0)return;let id=this.components.length,list=[i];this.comp[i]=id;for(let k=0;k<list.length;k++)for(let n of this.neighbors(list[k]))if(road(this.tiles[n])&&this.comp[n]<0){this.comp[n]=id;list.push(n);}this.components.push({roads:list,gateway:list.some(n=>this.tiles[n].gateway),power:0,water:0,demandP:0,demandW:0});});
  this.tiles.forEach((t,i)=>{if(!t.type||road(t))return;(this.sources[t.type]??=[]).push(i);let ns=this.neighbors(i).filter(n=>road(this.tiles[n]));ns.sort((a,b)=>Number(this.components[this.comp[b]].gateway)-Number(this.components[this.comp[a]].gateway));if(ns.length){this.adjRoad[i]=ns[0];this.access[i]=this.comp[ns[0]];}});
 }
 utilities(){
  for(let c of this.components){c.power=0;c.water=0;c.demandP=0;c.demandW=0;}
  this.tiles.forEach((t,i)=>{let c=this.components[this.access[i]];t.power=0;t.water=0;if(!c||!t.type||road(t)||t.damage)return;
   if(t.type==='power')c.power+=1500*this.funding.power/100;if(t.type==='water')c.water+=1800*this.funding.water/100;
   let load=t.type==='residential'?Math.max(6,t.pop*.65):ZONES.includes(t.type)?Math.max(8,this.capacity(t)*.65):8;
   c.demandP+=load;c.demandW+=load*(t.type==='industrial'?1.4:1);
  });
  this.tiles.forEach((t,i)=>{let c=this.components[this.access[i]];if(c&&!t.damage){t.power=clamp(c.power/Math.max(1,c.demandP),0,1);t.water=clamp(c.water/Math.max(1,c.demandW),0,1);}});
 }
 capacity(t){return ZONES.includes(t.type)&&!t.damage?TYPES[t.type].caps[t.level]:0;}
 service(i,type){let x=i%W,y=Math.floor(i/W),score=0;for(let j of this.sources[type]||[]){let t=this.tiles[j];if(t.damage||this.access[j]<0||this.access[j]!==this.access[i])continue;let d=Math.hypot(x-j%W,y-Math.floor(j/W));if(d<=TYPES[type].radius)score=Math.max(score,(1-d/(TYPES[type].radius+2))*t.power*t.water*this.funding.services/100);}return clamp(score,0,1);}
 pollution(i){let x=i%W,y=Math.floor(i/W),p=0;for(let type of ['industrial','power'])for(let j of this.sources[type]||[]){let t=this.tiles[j];if(t.damage)continue;let d=Math.hypot(x-j%W,y-Math.floor(j/W));if(d<7)p+=(t.type==='power'?20:t.level*11)*(1-d/7);}return clamp(p,0,100);}
 path(a,b){if(a<0||b<0||this.comp[a]!==this.comp[b])return null;let prev=new Int32Array(W*H).fill(-2),q=[a];prev[a]=-1;for(let k=0;k<q.length;k++){let n=q[k];if(n===b){let p=[];for(let z=b;z>=0;z=prev[z])p.push(z);return p.reverse();}for(let j of this.neighbors(n))if(road(this.tiles[j])&&prev[j]===-2){prev[j]=n;q.push(j);}}return null;}
 employment(){
  this.traffic=new Float64Array(W*H);for(let c of this.components){c.jobs=0;c.workforce=0;}let jobs=[];this.tiles.forEach((t,i)=>{t.workers=0;t.employed=0;t.commute=0;if(['commercial','industrial'].includes(t.type)&&this.access[i]>=0){let cap=Math.floor(this.capacity(t)*Math.min(t.power,t.water));this.components[this.access[i]].jobs+=cap;if(cap)jobs.push({i,left:cap});}});
  let workforce=0,employed=0,distSum=0;
  const homes=this.tiles.map((t,i)=>({t,i})).filter(({t})=>t.type==='residential'&&t.pop>0);
  const trees=new Map();
  for(let {t,i} of homes){let need=Math.floor(t.pop*.55);workforce+=need;const component=this.components[this.access[i]];if(component)component.workforce+=need;
   const start=this.adjRoad[i];if(start<0||!need)continue;
   let tree=trees.get(start);if(!tree){let prev=new Int32Array(W*H).fill(-2),dist=new Int32Array(W*H).fill(-1),q=[start];prev[start]=-1;dist[start]=1;for(let k=0;k<q.length;k++)for(let j of this.neighbors(q[k]))if(road(this.tiles[j])&&prev[j]===-2){prev[j]=q[k];dist[j]=dist[q[k]]+1;q.push(j);}tree={prev,dist};trees.set(start,tree);}
   let options=jobs.filter(j=>j.left>0&&this.access[j.i]===this.access[i]).sort((a,b)=>tree.dist[this.adjRoad[a.i]]-tree.dist[this.adjRoad[b.i]]);
   for(let j of options){if(!need)break;let target=this.adjRoad[j.i];if(tree.dist[target]<0)continue;let path=[];for(let z=target;z>=0;z=tree.prev[z])path.push(z);let n=Math.min(need,j.left);need-=n;j.left-=n;employed+=n;t.employed+=n;this.tiles[j.i].workers+=n;distSum+=n*path.length;t.commute+=n*path.length;for(let k of path)this.traffic[k]+=n*2;}
   t.commute/=Math.max(1,t.employed);
  }
  let capacity=60*Math.max(.15,this.funding.roads/100),congest=0,used=0;for(let i=0;i<this.traffic.length;i++)if(this.traffic[i]>0){congest+=Math.max(0,1-capacity/this.traffic[i]);used++;}
  return {workforce,employed,unemployment:workforce?1-employed/workforce:0,congestion:used?congest/used:0,commute:employed?distSum/employed:0};
 }
 recompute(){
  this.network();this.utilities();let labor=this.employment(),population=0,housing=0,jobs=0,weightedHappy=0,poll=0,fire=0,edu=0,health=0,powered=0,watered=0,buildings=0;
  this.tiles.forEach((t,i)=>{if(ZONES.includes(t.type)){housing+=t.type==='residential'?this.capacity(t):0;jobs+=t.type!=='residential'?Math.floor(this.capacity(t)*Math.min(t.power,t.water)):0;}
   if(t.type&&!road(t)){buildings++;powered+=t.power;watered+=t.water;}
   if(t.type==='residential'){
    let p=this.pollution(i),park=this.service(i,'park'),school=this.service(i,'school'),clinic=this.service(i,'clinic'),f=this.service(i,'fire'),employment=t.pop? t.employed/Math.max(1,Math.floor(t.pop*.55)):1;
    t.happiness=clamp(62+park*16+school*10+clinic*12+f*5-p*.6-(1-t.power)*28-(1-t.water)*32-(1-employment)*24-labor.congestion*20-Math.max(0,t.commute-12)*.65-(this.tax-9)*3,0,100);
    population+=t.pop;weightedHappy+=t.happiness*t.pop;poll+=p*t.pop;fire+=f*t.pop;edu+=school*t.pop;health+=clinic*t.pop;
   }
  });
  let powerCap=this.components.reduce((s,c)=>s+c.power,0),powerLoad=this.components.reduce((s,c)=>s+c.demandP,0),waterCap=this.components.reduce((s,c)=>s+c.water,0),waterLoad=this.components.reduce((s,c)=>s+c.demandW,0);
  let happiness=population?weightedHappy/population:60;
  this.stats={population,housing,jobs,...labor,happiness,pollution:population?poll/population:0,fire:population?fire/population:0,education:population?edu/population:0,health:population?health/population:0,power:buildings?powered/buildings:0,water:buildings?watered/buildings:0,powerCap,powerLoad,waterCap,waterLoad};
  let r=clamp((jobs-labor.workforce)*1.2+(happiness-55)*2-(this.tax-9)*8,-100,100),c=clamp(population*.23-this.tiles.reduce((s,t)=>s+(t.type==='commercial'?this.capacity(t):0),0),-100,100),ind=clamp(population*.45-this.tiles.reduce((s,t)=>s+(t.type==='industrial'?this.capacity(t):0),0)+30,-100,100);
  this.demand={residential:Math.round(r),commercial:Math.round(c),industrial:Math.round(ind)};this.budget=this.calculateBudget();
 }
 calculateBudget(){
  let residentialTax=this.stats.population*this.tax*.15,businessTax=this.stats.employed*this.tax*.21*(1-this.stats.congestion*.25);
  let upkeep={roads:0,power:0,water:0,services:0};this.tiles.forEach(t=>{if(!t.type||!TYPES[t.type])return;let key=road(t)?'roads':['power','water'].includes(t.type)?t.type:'services';upkeep[key]+=TYPES[t.type].upkeep*this.funding[key]/100;});
  const loanPayment=this.loans.reduce((s,l)=>s+l.payment,0),income=Math.round(residentialTax+businessTax),expenses=Math.round(Object.values(upkeep).reduce((a,b)=>a+b,0)+loanPayment);
  return {income,expenses,net:income-expenses,residentialTax:Math.round(residentialTax),businessTax:Math.round(businessTax),upkeep,loanPayment};
 }
 tick(){
  this.month++;this.lastAction=null;this.recompute();let before=this.stats.population;
  this.tiles.forEach((t,i)=>{
   if(t.damage){t.damage--;if(t.type==='residential')t.pop=0;return;}if(!ZONES.includes(t.type))return;
   let c=this.components[this.access[i]],ready=c&&c.gateway&&t.power>.8&&t.water>.8;
   if(t.level===0&&ready){t.level=1;}
   if(!t.level)return;
   if(t.type==='residential'){
    let available=c?c.jobs-c.workforce:0,h=t.happiness??60;
    let growth=ready&&this.cash>=0&&available>0&&h>42?Math.max(2,Math.ceil((this.capacity(t)-t.pop)*.12*(h/70)*clamp((18-this.tax)/9,.1,1.5))):0;
    let loss=(!ready||h<38||this.stats.unemployment>.28)?Math.ceil(t.pop*.09):0;
    t.pop=clamp(t.pop+growth-loss,0,this.capacity(t));
    if(t.level<3&&t.pop>this.capacity(t)*.8&&h>64&&this.service(i,'school')>.2&&this.month%6===0&&this.demand.residential>0)t.level++;
   }else if(t.level<3&&ready&&t.workers>this.capacity(t)*.75&&this.month%6===0&&this.demand[t.type]>0)t.level++;
  });
  this.recompute();
  if(this.disasters&&this.month%3===0){let candidates=this.tiles.map((t,i)=>({t,i})).filter(({t,i})=>t.level>0&&!t.damage&&this.random()<.008*(1-this.service(i,'fire')));if(candidates.length){let {t,i}=candidates[0];t.damage=3;t.pop=0;this.log(`${TYPES[t.type].name}发生火灾，建筑停用 3 个月，居民撤离。扩充消防覆盖可降低风险。`,'warn');this.recompute();}}
  let b=this.budget;this.cash+=b.net;this.loans=this.loans.map(l=>({...l,remaining:l.remaining-1})).filter(l=>l.remaining>0);
  if(this.cash<0){this.tiles.forEach(t=>{if(t.type==='residential')t.pop=Math.floor(t.pop*.97);});if(this.month%6===0)this.log('财政透支：居民额外流失。调整预算或申请贷款。','warn');this.recompute();}
  let s=this.stats;
  if(before<100&&s.population>=100)this.log('首批 100 位市民已定居。留意水电与工作机会。','good');
  if(s.power<.9&&this.month%6===0)this.log('部分建筑电力不足或未连接道路。','warn');
  const milestones=[['settle',s.population>=150,'小镇初成：人口达到 150，奖励 ¥1500。',1500],['balanced',s.population>=300&&b.net>0&&s.unemployment<.15,'自给自足：300 人、财政盈利、失业低于 15%，奖励 ¥2500。',2500],['city',s.population>=800&&s.happiness>=65&&s.congestion<.35,'宜居城市：800 人、幸福度 65、拥堵低于 35%，奖励 ¥5000。',5000],['metropolis',s.population>=2000&&s.happiness>=70&&b.net>0,'江湾都会：2000 人、幸福度 70、财政盈利。全部目标达成，城市仍可继续经营。',8000]];
  for(let [id,ok,msg,reward] of milestones)if(ok&&!this.goals.includes(id)){this.goals.push(id);this.cash+=reward;this.log(msg,'good');}
  this.history.push({month:this.month,population:s.population,cash:Math.round(this.cash),net:b.net,happiness:Math.round(s.happiness),employed:s.employed});this.history=this.history.slice(-120);this.budget=this.calculateBudget();
  return this.stats;
 }
 setTax(n){if(!Number.isFinite(n))return;this.tax=clamp(Math.round(n),3,18);this.recompute();}
 setFunding(key,n){if(!Object.hasOwn(this.funding,key)||!Number.isFinite(n))return;this.funding[key]=clamp(Math.round(n),20,150);this.recompute();}
 borrow(){if(this.loans.length>=3)return {ok:false,reason:'最多同时持有 3 笔贷款'};this.lastAction=null;let payment=360;this.loans.push({remaining:36,payment});this.cash+=10000;this.recompute();this.log('贷款 ¥10000 已到账，未来 36 个月每月偿还 ¥360。','info');return {ok:true};}
 serialize(){return JSON.stringify({version:1,seed:this.seed,month:this.month,cash:this.cash,tax:this.tax,funding:this.funding,loans:this.loans,history:this.history,messages:this.messages,goals:this.goals,disasters:this.disasters,tiles:this.tiles.map(t=>({terrain:t.terrain,type:t.type,level:t.level,pop:t.pop,damage:t.damage,gateway:!!t.gateway}))});}
 static load(json){
  let s=typeof json==='string'?JSON.parse(json):json;
  if(!s||s.version!==1||!Array.isArray(s.tiles)||s.tiles.length!==W*H)throw Error('存档格式或地图尺寸不正确');
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  if(!finite(s.seed,0,4294967295)||!finite(s.month,0,1000000)||!Number.isInteger(s.month)||!finite(s.cash,-1e12,1e12)||!finite(s.tax,3,18))throw Error('存档中的城市数据无效');
  if(!s.funding||Object.keys({power:0,water:0,services:0,roads:0}).some(k=>!finite(s.funding[k],20,150)))throw Error('存档中的预算无效');
  for(let t of s.tiles){if(!t||!['grass','forest','water'].includes(t.terrain)||!(t.type===null||Object.hasOwn(TYPES,t.type)&&t.type!=='bulldoze')||!Number.isInteger(t.level)||!finite(t.level,0,3)||!Number.isInteger(t.pop)||!finite(t.pop,0,150)||!Number.isInteger(t.damage)||!finite(t.damage,0,3)||(t.type!=='residential'&&t.pop!==0)||(t.type==='residential'&&t.pop>TYPES.residential.caps[t.level])||(t.terrain==='water'&&t.type!==null&&t.type!=='bridge')||(t.type==='bridge'&&t.terrain!=='water'))throw Error('存档中的建筑数据无效');}
  if(!s.tiles[14*W].gateway||s.tiles[14*W].type!=='road'||s.tiles.some((t,i)=>t.gateway&&i!==14*W))throw Error('存档缺少有效的区域入口');
  if(!Array.isArray(s.loans)||s.loans.length>3||s.loans.some(l=>!Number.isInteger(l.remaining)||!finite(l.remaining,1,36)||l.payment!==360))throw Error('存档中的贷款无效');
  if(!Array.isArray(s.history)||s.history.length>120||s.history.some(h=>!h||!['month','population','cash','net','happiness','employed'].every(k=>finite(h[k],-1e12,1e12))))throw Error('存档中的历史无效');
  let c=new City(s.seed,false);for(let k of ['seed','month','cash','tax'])c[k]=s[k];c.funding={power:s.funding.power,water:s.funding.water,services:s.funding.services,roads:s.funding.roads};c.loans=s.loans.map(l=>({...l}));c.history=s.history.map(h=>({...h}));c.tiles=s.tiles.map(t=>({terrain:t.terrain,type:t.type,level:t.level,pop:t.pop,damage:t.damage,gateway:!!t.gateway}));c.goals=Array.isArray(s.goals)?s.goals.filter(x=>['settle','balanced','city','metropolis'].includes(x)):[];c.messages=Array.isArray(s.messages)?s.messages.slice(0,40).filter(m=>m&&typeof m.text==='string').map(m=>({month:finite(m.month,0,1e6)?m.month:0,text:m.text.slice(0,500),kind:['info','good','warn'].includes(m.kind)?m.kind:'info'})):[];c.disasters=s.disasters!==false;c.recompute();return c;
 }
}
const api={City,TYPES,W,H,ZONES};if(typeof module!=='undefined')module.exports=api;else root.CitySim=api;
})(typeof globalThis!=='undefined'?globalThis:this);
