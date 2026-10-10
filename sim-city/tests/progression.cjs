const {City,W}=require('../engine.js');
const assert=require('node:assert/strict'),fs=require('node:fs');
// Automated mayor: all development goes through paid build actions. No injected money or population.
const c=new City(721);c.disasters=false;const actions=[];
const paid=(x,y,type)=>{if(!c.tiles[y*W+x].type){const r=c.build(x,y,type);assert(r.ok,r.reason);}};
// Grow a profitable neighbourhood before financing the full arterial grid and services.
for(const [x,y]of [[4,9],[5,9],[6,9],[7,9],[11,9],[12,9],[13,9],[14,9],[4,13],[6,13],[8,13],[10,13]])paid(x,y,'residential');
for(const x of [4,5,6,7,8,10,11,12])paid(x,18,'industrial');
for(let i=0;i<48;i++)c.tick();
const add=(x,y,type)=>actions.push({x,y,type});
for(const x of [3,9,15,21])for(let y=2;y<=26;y++)add(x,y,'road');
for(const y of [2,5,8,11,14,17,20,23,26])for(let x=1;x<=23;x++)add(x,y,'road');
add(22,15,'power');add(23,15,'water');
for(const [x,y,t]of [[5,4,'school'],[14,4,'school'],[6,7,'clinic'],[16,7,'clinic'],[5,7,'park'],[13,7,'park'],[17,4,'park'],[2,7,'park'],[10,4,'fire'],[18,10,'school']])add(x,y,t);
for(const y of [12,13,15,16,18,19,21,22,24,25])for(let x=1;x<=23;x++)if(![3,9,15,21].includes(x)&&((y>=18&&x>=10)||(y<=16&&x<=8)))add(x,y,y>=18?'industrial':'commercial');
for(const y of [3,4,6,7,9,10])for(let x=1;x<=20;x++)if(![3,9,15].includes(x))add(x,y,'residential');
c.setFunding('roads',150);c.setFunding('power',150);c.setFunding('water',150);c.setFunding('services',100);
const report=[];let built=0,waited=0;
for(const a of actions){if(c.tiles[a.y*W+a.x].type)continue;while(c.cash<2600+require('../engine.js').TYPES[a.type].cost&&waited<1200){c.tick();waited++;}let r=c.build(a.x,a.y,a.type);if(!r.ok)throw Error(JSON.stringify(a)+':'+r.reason);built++;}
for(let i=0;i<360;i++){
 if(i===36){for(const [x,y,t]of [[1,27,'power'],[2,27,'water'],[4,27,'power'],[5,27,'water'],[4,1,'clinic'],[14,1,'clinic'],[19,1,'park'],[6,1,'fire'],[16,1,'fire']])paid(x,y,t);c.setTax(8);c.setFunding('services',150);}
 if(i>36)for(const type of ['power','water']){
  if(c.stats[type+'Load']>c.stats[type+'Cap']*.88){let x=Array.from({length:23},(_,k)=>k+1).find(x=>!c.tiles[27*W+x].type);assert(x,'utility expansion land exhausted');paid(x,27,type);}
 }
 c.tick();if(i%24===0)report.push({month:c.month,population:c.stats.population,cash:Math.round(c.cash),happiness:Math.round(c.stats.happiness),unemployment:c.stats.unemployment,congestion:c.stats.congestion,net:c.budget.net,goals:[...c.goals]});
}
const result={built,waited,month:c.month,stats:c.stats,cash:c.cash,goals:c.goals,report};fs.writeFileSync('tests/progression-results.json',JSON.stringify(result,null,2));fs.writeFileSync('tests/metropolis.json',c.serialize());console.log(JSON.stringify(result,null,2));assert(c.stats.population>=2000);assert(c.goals.includes('metropolis'));assert(c.stats.happiness>=70);assert(c.budget.net>0);
