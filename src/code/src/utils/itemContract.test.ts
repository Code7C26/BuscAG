import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationTextError} from './itemContract';
const valid={title:'Objeto',description:'Descripción',locationName:'Plaza'};
test('publication text limits match SQL char_length including supplementary Unicode',()=>{
  for(const [field,limit] of [['title',200],['description',10000],['locationName',300],['reward',200]] as const){
    assert.equal(publicationTextError({...valid,[field]:'😀'.repeat(limit)}),'');
    assert.match(publicationTextError({...valid,[field]:'😀'.repeat(limit+1)}),new RegExp(String(limit)));
  }
});
test('new content rejects blank required fields and PostgreSQL-incompatible NUL without trimming user content',()=>{
  for(const field of ['title','description','locationName'] as const)
    assert.match(publicationTextError({...valid,[field]:' \n\t'}),/obligatorio/);
  for(const field of ['title','description','locationName','reward'] as const)
    assert.match(publicationTextError({...valid,[field]:'before\u0000after'}),/no válido/);
  assert.equal(publicationTextError({...valid,reward:null}),'');
  assert.equal(publicationTextError({...valid,reward:'',title:' Objeto '}),'');
});
test('editing preserves unchanged legacy over-limit fields but rejects new oversized content',()=>{
  const legacy={title:'x'.repeat(201),description:'x'.repeat(10001),locationName:'x'.repeat(301),reward:'x'.repeat(201)};
  assert.equal(publicationTextError(legacy,legacy),'');
  assert.equal(publicationTextError({...legacy,title:'Repaired'},legacy),'');
  assert.match(publicationTextError({...legacy,description:legacy.description+'x'},legacy),/10000/);
});
