const fs=require('node:fs'),assert=require('node:assert/strict'),{City}=require('../engine.js');
const c=City.load(fs.readFileSync('tests/metropolis.json','utf8')),times=[];
for(let i=0;i<40;i++){let start=performance.now();c.tick();times.push(performance.now()-start);}
times.sort((a,b)=>a-b);const result={population:c.stats.population,medianTickMs:times[20],p95TickMs:times[38],maxTickMs:times[39]};
assert(result.maxTickMs<1000,'单月模拟超出 1 秒');fs.writeFileSync('tests/performance-results.json',JSON.stringify(result,null,2));console.log(result);
