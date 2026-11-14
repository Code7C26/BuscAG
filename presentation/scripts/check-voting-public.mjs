import assert from 'node:assert/strict';
const origin='https://buscag-el-experimento-votos.reedyrook2.chatgpt.site';
for(const [path,type] of [['/vote?poll=search','text/html'],['/vote?poll=object','text/html'],['/client.js','javascript'],['/style.css','text/css'],['/api/health','application/json'],['/api/polls','application/json']]){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);assert.ok(r.headers.get('content-type')?.includes(type),path);const body=await r.text();if(path==='/api/polls'){const data=JSON.parse(body);assert.equal(data.polls.length,2);assert.ok(data.polls.every(p=>!p.open),'Release polls must remain closed');} console.log('HTTPS 200 MIME OK',path);
}
const denied=await fetch(origin+'/api/admin/state');assert.equal(denied.status,401);console.log('Private admin rejects anonymous access');
const closed=await fetch(origin+'/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({poll:'search',choice:0})});assert.equal(closed.status,409);console.log('Closed poll rejects vote without recording it');
