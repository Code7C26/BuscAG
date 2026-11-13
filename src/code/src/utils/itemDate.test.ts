import test from 'node:test';
import assert from 'node:assert/strict';
import {parseItemDate,itemDateInput,serializeItemDate,formatItemDate,itemDateTime} from './itemDate';
for(const zone of ['America/Argentina/Buenos_Aires','Pacific/Auckland','UTC']){
  test(`DATE calendar survives editing and midnight publication in ${zone}`,()=>{
    const before=process.env.TZ;process.env.TZ=zone;
    try {
      assert.equal(itemDateInput('2026-11-03'),'2026-11-03T00:00');
      assert.equal(formatItemDate('2026-11-03'),'3/11/2026');
      for(const local of ['2026-11-03T00:30','2026-11-03T23:30']){
        const serialized=serializeItemDate(local);
        assert.equal(serialized.slice(0,10),'2026-11-03');
        assert.equal(Date.parse(serialized),new Date(local).getTime());
      }
      assert.equal(itemDateTime('2026-11-03'),Date.UTC(2026,10,3));
    }finally {if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
  });
}
test('invalid dates are rejected before upload/write and timestamp precision is preserved',()=>{
  for(const value of ['2026-02-30','2026-02-30T12:30','2026-13-01','not-a-date','2026-11-03T99:00','0000-01-01']){
    assert.equal(parseItemDate(value),null);assert.throws(()=>serializeItemDate(value));
  }
  assert.ok(parseItemDate('2028-02-29'));
  assert.equal(serializeItemDate('2026-11-03T23:30:24.123-03:00'),'2026-11-03T23:30:24.123-03:00');
});

test('nonexistent local times are rejected rather than silently moved through a DST transition',()=>{
  const before=process.env.TZ;process.env.TZ='America/New_York';
  try {assert.equal(parseItemDate('2026-03-08T02:30'),null);assert.ok(parseItemDate('2026-03-08T03:30'));}
  finally {if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
