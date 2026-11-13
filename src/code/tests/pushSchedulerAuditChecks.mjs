import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
/** Synthetic extension-shaped relations only. Never inspects or changes real extensions. */
export async function pushSchedulerAuditChecks(db){
 const sql=await readFile(new URL('../supabase/audit/push_scheduler_exposure.sql',import.meta.url),'utf8');
 await db.exec(`
 create schema net;create schema vault;create schema cron;
 create table net.http_request_queue(id int,headers jsonb,body text);
 create table net._http_response(id int,content text);
 create table vault.decrypted_secrets(decrypted_secret text);
 create table cron.job(jobname text,active boolean,schedule text,command text);
 grant usage on schema net to public;
 grant all on all tables in schema net to public;
 insert into net.http_request_queue values(1,'{"token":"SENTINEL_NEVER_EXPORT"}','SENTINEL_NEVER_EXPORT');
 insert into net._http_response values(1,'SENTINEL_NEVER_EXPORT');
 insert into vault.decrypted_secrets values('SENTINEL_NEVER_EXPORT');
 insert into cron.job values('buscag-staging-match-worker',true,'* * * * *','SENTINEL_NEVER_EXPORT');
 `);
 const jobs=(await db.query('select * from cron.job')).rows;
 const result=await db.exec(sql),rows=(Array.isArray(result)?result:[result]).flatMap(r=>r.rows??[]);
 const queue=rows.find(r=>r.relation_name==='http_request_queue');assert.ok(queue);
 assert.equal(queue.anon_effective_select,true);assert.equal(queue.authenticated_effective_select,true);
 assert.ok(queue.public_privileges.includes('SELECT'));
 const vault=rows.find(r=>r.schema_name==='vault');assert.equal(vault.anon_effective_select,false);
 assert.equal(vault.authenticated_effective_select,false);
 assert.ok(!JSON.stringify(rows).includes('SENTINEL_NEVER_EXPORT'));
 assert.deepEqual((await db.query('select * from cron.job')).rows,jobs);
 assert.equal((await db.query('select count(*)::int n from net.http_request_queue')).rows[0].n,1);
 console.log('PASS: scheduler exposure audit distinguishes PUBLIC grants from protected Vault, exports no secrets/commands and preserves the match job (synthetic metadata only)');
}
