import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDiagnostic,analyzeDiagnostic} from '../scripts/check-supabase-diagnostic.mjs';
const empty={'01_context':{migration_history_exists:false},'02_inventory':[]};
test('diagnostic parser accepts SQL Editor JSON and quoted one-column CSV without executing metadata',()=>{
  const source=JSON.stringify(empty);
  for(const input of [source,JSON.stringify([{diagnostic:source}]),'diagnostic\r\n"'+source.replace(/"/g,'""')+'"'])assert.deepEqual(parseDiagnostic(input),empty);
  assert.throws(()=>parseDiagnostic('[{},{}]'));assert.throws(()=>parseDiagnostic('untrusted SQL text'));
});
test('incomplete diagnostic blocks readiness rather than inventing a compatible schema',()=>{
  const result=analyzeDiagnostic(empty);assert.equal(result.production_approved,false);assert.equal(result.status,'incompatible_contract');
  assert.equal(result.errors.filter(x=>x.code==='missing_table').length,4);assert.equal(result.migration_history_exists,false);
});
test('analysis distinguishes broad policies and protected-field ACLs from a proven exploit',()=>{
  const result=analyzeDiagnostic({...empty,'05_policies':[{tablename:'items',cmd:'INSERT',with_check:'(true)'},{tablename:'profiles',cmd:'SELECT',qual:'true'},{tablename:'messages',with_check:'existing.item_id = existing.item_id'}],
    '09_column_permissions':[{rolname:'authenticated',relation_name:'profiles',column_name:'rating',can_update:true}],
    '06_roles':[{role:'anon',superuser:false,bypass_rls:false},{role:'authenticated',superuser:false,bypass_rls:true}]});
  assert.ok(result.warnings.some(x=>x.code==='suspicious_message_comparison'));
  assert.ok(result.warnings.some(x=>x.code==='protected_column_acl'));assert.ok(result.errors.some(x=>x.code==='privileged_api_role'));
  assert.equal(result.production_approved,false);
});
