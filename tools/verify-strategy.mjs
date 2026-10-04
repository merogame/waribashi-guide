import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
const engine=vm.runInNewContext(script.split('const setup=')[0]+';({legal,apply,encode,decode,swapped,solve,best})');
const {legal,apply,encode,decode,swapped,solve,best}=engine;
const started=performance.now(),table=solve(),elapsed=performance.now()-started;
// Separate action generator: target the opponent or the other own live hand,
// or revive a dead hand using two strictly positive integers with conserved sum.
function reference(h){
  const list=[];
  if(h.slice(0,2).every(x=>x===0)||h.slice(2).every(x=>x===0))return list;
  for(let source=0;source<2;source++){
    if(h[source]===0)continue;
    for(let target=0;target<4;target++){
      if(source===target||h[target]===0)continue;
      const next=[...h];next[target]=(h[target]+h[source])%5;list.push(next);
    }
  }
  if((h[0]===0)!==(h[1]===0))for(let left=1;left<h[0]+h[1];left++)list.push([left,h[0]+h[1]-left,h[2],h[3]]);
  return list;
}
const successors=[];
let edges=0,live=0;
const counts={win:0,loss:0,draw:0};
for(let i=0;i<625;i++){
  const h=Array.from(decode(i));assert.equal(encode(h),i);
  const moves=Array.from(legal(h)),next=moves.map(move=>Array.from(apply(h,move)));
  assert.deepEqual(next.map(encode).sort((a,b)=>a-b),reference(h).map(encode).sort((a,b)=>a-b),'legal actions at '+i);
  successors[i]=next.map(h=>encode(swapped(h)));edges+=next.length;
  if(h[0]+h[1]===0||h[2]+h[3]===0)continue;
  live++;counts[{1:'win','-1':'loss',0:'draw'}[table.value[i]]]++;
  for(const move of moves){
    if(move.left!==undefined){assert.ok(h[1-move.from]===0&&h[move.from]>=2);assert.ok(move.left>0&&move.right>0);assert.equal(move.left+move.right,h[move.from]);}
    else{assert.ok(h[move.from]>0&&h[move.to]>0&&move.from!==move.to);}
  }
  const child=successors[i],v=table.value[i];
  if(v===1){assert.ok(child.some(j=>table.value[j]===-1));assert.equal(table.distance[i],1+Math.min(...child.filter(j=>table.value[j]===-1).map(j=>table.distance[j])));}
  else if(v===-1){assert.ok(child.every(j=>table.value[j]===1));assert.equal(table.distance[i],1+Math.max(...child.map(j=>table.distance[j])));}
  else{assert.ok(child.every(j=>table.value[j]!==-1));assert.ok(child.some(j=>table.value[j]===0));}
  const preferred=Array.from(best(h,table));assert.ok(preferred.length>0);
  for(const move of preferred)assert.ok(table.value[encode(swapped(apply(h,move)))]===-v);
  // Swapping either player's physical left/right hands must preserve outcome.
  assert.equal(v,table.value[encode([h[1],h[0],h[2],h[3]])]);
  assert.equal(v,table.value[encode([h[0],h[1],h[3],h[2]])]);
}
// Independent bounded-horizon dynamic program. A forced result must resolve
// within the finite state count; unresolved states admit indefinite avoidance.
let bounded=new Int8Array(625),iterations=0;
for(let i=0;i<625;i++){const h=decode(i);if(h[0]+h[1]===0&&h[2]+h[3]>0)bounded[i]=-1;else if(h[2]+h[3]===0&&h[0]+h[1]>0)bounded[i]=1;}
for(;iterations<625;iterations++){
  const next=bounded.slice();let changed=false;
  for(let i=0;i<625;i++)if(bounded[i]===0&&successors[i].length){
    if(successors[i].some(j=>bounded[j]===-1))next[i]=1;
    else if(successors[i].every(j=>bounded[j]===1))next[i]=-1;
    if(next[i]!==bounded[i])changed=true;
  }
  bounded=next;if(!changed)break;
}
assert.deepEqual(Array.from(bounded),Array.from(table.value));
assert.equal(legal([0,1,1,1]).some(move=>move.left!==undefined),false);
assert.equal(legal([1,0,1,1]).some(move=>move.left!==undefined),false);
assert.equal(legal([2,2,1,1]).some(move=>move.left!==undefined),false);
assert.deepEqual(Array.from(apply([4,2,4,1],{from:0,to:2})),[4,2,3,1]);
assert.deepEqual(Array.from(apply([4,1,1,1],{from:0,to:1})),[4,0,1,1]);
const initial=encode([1,1,1,1]);
const report={htmlBytes:Buffer.byteLength(html),liveStates:live,edges,counts,iterations,initialValue:table.value[initial],initialDistance:table.distance[initial],initialRecommended:Array.from(best([1,1,1,1],table)),solveMs:elapsed};
writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
