import { ActivityDay, ChartPoint, Granularity, METRIC_KEYS, MetricKey } from './types';
const fullFormatter = new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'UTC'});
const shortFormatter = new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',timeZone:'UTC'});
const monthFormatter = new Intl.DateTimeFormat('fr-FR',{month:'short',year:'numeric',timeZone:'UTC'});
const euroFormatter = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2});
const compactFormatter = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1});
export function parseDay(value:string):Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date civile invalide : '+value);
  const d=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==value) throw new Error('Date civile invalide : '+value);
  return d;
}
export function addDays(value:string,n:number) {const d=parseDay(value);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function businessToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function isoWeek(value:string){
  const d=parseDay(value);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const year=d.getUTCFullYear();return {year,week:Math.ceil(((d.getTime()-Date.UTC(year,0,1))/86400000+1)/7)};
}
export function dayLabel(value:string){const d=parseDay(value);return ['Di','Lu','Ma','Me','Je','Ve','Sa'][d.getUTCDay()]+' '+String(d.getUTCDate()).padStart(2,'0');}
export const fullDate=(value:string)=>fullFormatter.format(parseDay(value));
export const shortDate=(value:string)=>shortFormatter.format(parseDay(value));
export const money=(v:number|null)=>v===null?'Indisponible':euroFormatter.format(v/100);
export const compactMoney=(v:number)=>compactFormatter.format(v/100);
function checkedSum(a:number,b:number){const n=a+b;if(!Number.isSafeInteger(n))throw new Error('Précision numérique dépassée');return n;}
export function normalize(input:ActivityDay[]):ActivityDay[]{
  const map=new Map<string,ActivityDay>();
  for(const row of input){
    parseDay(row.date);if(map.has(row.date))throw new Error('Jour agrégé dupliqué : '+row.date);
    for(const key of METRIC_KEYS){const v=row[key];if(v!==null&&(!Number.isSafeInteger(v)||((key==='interventions'||key==='quotes')&&v<0)))throw new Error('Métrique invalide : '+key);}
    map.set(row.date,{...row});
  }
  const sorted=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));if(!sorted.length)return [];
  const result:ActivityDay[]=[];const end=sorted[sorted.length-1].date;
  for(let date=sorted[0].date;date<=end;date=addDays(date,1)){
    if(result.length>=3660)throw new Error('Plus de 3660 jours : utiliser une agrégation serveur');
    result.push(map.get(date)??{date,invoiced:null,performed:null,quoted:null,accepted:null,interventions:null,quotes:null});
  }
  return result;
}
export function total(rows:ActivityDay[],key:MetricKey):number|null{
  if(!rows.length)return null;let sum=0;for(const r of rows){if(r[key]===null)return null;sum=checkedSum(sum,r[key]??0);}return sum;
}
export function chooseGranularity(length:number):Granularity{return length<=90?'day':length<=730?'week':'month';}
export function aggregate(rows:ActivityDay[],granularity:Granularity):ChartPoint[]{
  const groups=new Map<string,ActivityDay[]>();
  for(const row of rows){const w=isoWeek(row.date);const key=granularity==='day'?row.date:granularity==='week'?`${w.year}-W${w.week}`:row.date.slice(0,7);const g=groups.get(key);if(g)g.push(row);else groups.set(key,[row]);}
  return [...groups.values()].map(group=>{
    const first=group[0],last=group[group.length-1],w=isoWeek(first.date);
    const point:ChartPoint={...first,endDate:last.date,periodLabel:granularity==='day'?dayLabel(first.date):granularity==='week'?`S${w.week} · ${shortDate(first.date)}–${shortDate(last.date)}`:monthFormatter.format(parseDay(first.date))};
    for(const key of METRIC_KEYS)point[key]=total(group,key);
    return point;
  });
}
export function cumulative(rows:ChartPoint[]):ChartPoint[]{
  const sums:Record<MetricKey,number|null>={invoiced:0,performed:0,quoted:0,accepted:0,interventions:0,quotes:0};
  return rows.map(row=>{const next={...row};for(const key of METRIC_KEYS){const prev=sums[key],value=row[key];sums[key]=prev===null||value===null?null:checkedSum(prev,value);next[key]=sums[key];}return next;});
}
export function weekGroups(rows:ChartPoint[]){
  const groups:{id:string;first:string;last:string;count:number;label:string}[]=[];
  for(const row of rows){const w=isoWeek(row.date),id=`${w.year}-W${w.week}`;let group=groups[groups.length-1];if(!group||group.id!==id){group={id,first:row.date,last:row.date,count:0,label:`S${w.week} · ${w.year}`};groups.push(group);}group.count++;group.last=row.endDate;}
  return groups;
}
export function exportCsv(rows:ActivityDay[]){
  const safe=(s:string)=>'"'+(/^[=+@\-\t\r]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';
  const header=['Date','Semaine ISO','CA facturé EUR HT','Interventions EUR HT','Devis émis EUR HT','Devis acceptés EUR HT','Interventions nombre','Devis nombre'];
  const lines=rows.map(r=>[r.date,`${isoWeek(r.date).year}-S${isoWeek(r.date).week}`,...METRIC_KEYS.map((k,i)=>r[k]===null?'Indisponible':String((r[k]??0)/(i<4?100:1)).replace('.',','))]);
  const blob=new Blob(['\uFEFF'+[header,...lines].map(r=>r.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='activite.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
