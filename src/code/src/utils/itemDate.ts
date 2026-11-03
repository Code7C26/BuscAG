/** DATE is a calendar day, not UTC midnight. Keep its day in local editors and
 * formatting; timestamp installations retain their original instant/precision. */
const calendar=/^(\d{4})-(\d{2})-(\d{2})$/;
function calendarParts(value:string) {
  const match=calendar.exec(value);
  if(!match) return null;
  const [year,month,day]=match.slice(1).map(Number);
  if(year<1||month<1||month>12||day<1||day>31) return null;
  const check=new Date(0);check.setUTCFullYear(year,month-1,day);check.setUTCHours(0,0,0,0);
  return check.getUTCFullYear()===year&&check.getUTCMonth()===month-1&&check.getUTCDate()===day ? {year,month,day}:null;
}
export function parseItemDate(value:string):Date|null {
  if(typeof value!=='string') return null;
  if(calendar.test(value)) {
    const parts=calendarParts(value);if(!parts) return null;
    const date=new Date(0);date.setFullYear(parts.year,parts.month-1,parts.day);date.setHours(0,0,0,0);return date;
  }
  // Do not let Date normalize impossible calendar dates or accept locale guesses.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)||!calendarParts(value.slice(0,10))) return null;
  const clock=/T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)!;
  if(Number(clock[1])>23||Number(clock[2])>59||Number(clock[3]??0)>59) return null;
  const date=new Date(value);if(!Number.isFinite(date.getTime())) return null;
  if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&
    (date.getFullYear()!==Number(value.slice(0,4))||date.getMonth()+1!==Number(value.slice(5,7))||date.getDate()!==Number(value.slice(8,10))||date.getHours()!==Number(clock[1])||date.getMinutes()!==Number(clock[2]))) return null;
  return date;
}
export function itemDateInput(value:string):string {
  const parsed=parseItemDate(value);if(!parsed) return '';
  if(calendar.test(value)) return value+'T00:00';
  const local=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
}
export function serializeItemDate(value:string):string {
  const parsed=parseItemDate(value);if(!parsed) throw new Error('Selecciona una fecha válida.');
  if(calendar.test(value)) return value;
  if(/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  // Explicit local offset preserves BOTH the local day in a DATE column and the
  // precise instant in timestamptz. toISOString() could change the calendar day.
  const offset=-parsed.getTimezoneOffset();const absolute=Math.abs(offset);
  return value+(offset>=0?'+':'-')+String(Math.floor(absolute/60)).padStart(2,'0')+':'+String(absolute%60).padStart(2,'0');
}
export function formatItemDate(value:string):string {
  return parseItemDate(value)?.toLocaleDateString('es-ES')??'Fecha no disponible';
}
/** Comparable elapsed hours: day-only values have no claimed hour or time zone. */
export function itemDateTime(value:string):number {
  if(calendar.test(value)) return calendarParts(value)?Date.parse(value):NaN;
  return parseItemDate(value)?.getTime()??NaN;
}
