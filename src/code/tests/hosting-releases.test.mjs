import test from 'node:test';
import assert from 'node:assert/strict';
import {listHostingReleases,releaseForRequestedDay,publicHostingError,HostingReadError,READ_SCOPE} from '../scripts/list-hosting-releases.mjs';
const row=(id,time,extra={})=>({name:`sites/buscag-prueba/releases/${id}`,releaseTime:time,version:{name:'sites/buscag-prueba/versions/d14560',status:'FINALIZED'},...extra});
const response=data=>({data});
test('requested Argentine calendar day uses UTC03 boundaries and keeps exact timestamp precision',()=>{
 assert.equal(releaseForRequestedDay(row('a','2026-11-06T02:59:59.999Z')),null);
 assert.equal(releaseForRequestedDay(row('a','2026-11-07T03:00:00Z')),null);
 assert.ok(releaseForRequestedDay(row('a','2026-11-06T03:00:00Z')));
 const r=releaseForRequestedDay(row('d14560-release','2026-11-06T17:27:00.123456789Z',{releaseUser:{email:'private@example.invalid'},message:'token-sentinel'}));
 assert.equal(r.fecha_hora,'2026-11-06T17:27:00.123456789Z');
 assert.deepEqual(Object.keys(r),['release_id','version.name','fecha_hora','estado']);
 assert.equal(JSON.stringify(r).includes('private@'),false);assert.equal(JSON.stringify(r).includes('token-sentinel'),false);
 assert.match(READ_SCOPE,/read-only$/);
});
test('pagination is complete, project/site fixed, responses projected and every API operation is GET',async()=>{
 const requests=[];const client={request:async opts=>{
  requests.push(opts);const u=new URL(opts.url);
  if(requests.length===1)return response({name:'projects/123456/sites/buscag-prueba'});
  if(!u.searchParams.has('pageToken'))return response({releases:[row('late','2026-11-07T02:00:00Z')],nextPageToken:'private-page-token'});
  return response({releases:[row('target','2026-11-06T17:27:00Z'),row('old','2026-11-05T20:00:00Z')]});
 }};
 const rows=await listHostingReleases(client);
 assert.deepEqual(rows.map(r=>r.release_id),['target','late']);assert.equal(requests.length,3);
 for(const request of requests){const u=new URL(request.url);assert.equal(u.origin,'https://firebasehosting.googleapis.com');assert.equal(request.method,'GET');assert.equal(request.maxRedirects,0);assert.equal(request.retry,false);assert.equal(u.searchParams.get('fields').includes('releaseUser'),false);}
 assert.match(requests[0].url,/projects\/buscag-2677c\/sites\/buscag-prueba/);
 assert.equal(JSON.stringify(rows).includes('private-page-token'),false);
});
test('wrong site, unexpected status and malformed metadata fail closed',async()=>{
 assert.throws(()=>releaseForRequestedDay({...row('a','2026-11-06T17:27:00Z'),name:'sites/production/releases/a'}),HostingReadError);
 assert.throws(()=>releaseForRequestedDay(row('a','2026-11-06T17:27:00Z',{version:{name:'sites/buscag-prueba/versions/a',status:'credential-sentinel'}})),HostingReadError);
 assert.throws(()=>releaseForRequestedDay(row('a','invalid')),HostingReadError);
 await assert.rejects(listHostingReleases({request:async()=>response({name:'projects/other/sites/buscag-prueba'})}),HostingReadError);
 const disabled=releaseForRequestedDay(row('disabled','2026-11-06T17:27:00Z',{version:undefined,type:'SITE_DISABLE'}));
 assert.equal(disabled['version.name'],null);assert.equal(disabled.estado,'SITE_DISABLE');
});
test('pagination errors never return partial results or print tokens and HTTP failure details',async()=>{
 let calls=0;const client={request:async()=>++calls===1?response({name:'projects/buscag-2677c/sites/buscag-prueba'}):response({releases:[],nextPageToken:'token-sentinel'})};
 await assert.rejects(listHostingReleases(client),e=>e.code==='PAGINATION_FAILED');
 for(const status of [400,401,403,404,500,undefined]){
  const text=publicHostingError({message:'token-sentinel private@example.invalid',response:{status,data:{email:'private@example.invalid'}},config:{headers:{Authorization:'Bearer token-sentinel'}}});
  assert.equal(text.includes('token-sentinel'),false);assert.equal(text.includes('private@'),false);
 }
 assert.match(publicHostingError(new HostingReadError('ADC_UNAVAILABLE')),/application-default login/);
});
