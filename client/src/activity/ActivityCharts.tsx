import { memo, useId, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ChartPoint, ChartSeries, Granularity } from './types';
import { compactMoney, dayLabel, fullDate, isoWeek, money, parseDay, shortDate, weekGroups } from './analytics';
const MARGIN={top:24,right:28,bottom:12,left:8};
const AXIS_TICK={fill:'#526779',fontSize:11};
const GRID_STYLE={stroke:'#DFE8EF'};
const ACTIVE_DOT={r:5,fill:'#FFFFFF',strokeWidth:2};
const countTick=(value:number)=>String(value);
const moneyTick=(value:number)=>compactMoney(value);
interface ChartProps{rows:ChartPoint[];items:readonly ChartSeries[];relief:boolean;compact:boolean;granularity:Granularity;cumulative?:boolean;volume?:boolean;syncId:string}
export function DayAxisTick({x=0,y=0,payload}:{x?:number;y?:number;payload?:{value:string}}){return <text x={x} y={y+16} textAnchor="middle" fill="#526779" fontSize={11}>{payload?dayLabel(payload.value):''}</text>;}
export const WeekBandAxis=memo(function WeekBandAxis({rows}:{rows:ChartPoint[]}){
  const groups=useMemo(()=>weekGroups(rows),[rows]);
  return <div className="activity-weeks" aria-label="Semaines ISO">{groups.map(g=><span key={g.id} style={{flex:g.count}} title={`${g.label} · ${shortDate(g.first)}–${shortDate(g.last)}`}><b>{g.label}</b><small>{shortDate(g.first)}–{shortDate(g.last)}</small></span>)}</div>;
});
export function ChartShadowLayer({id,compact}:{id:string;compact:boolean}){
  return <defs><filter id={id} x="-10%" y="-20%" width="125%" height="155%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={compact?1.5:3}/><feOffset dx={compact?3:7} dy={compact?7:15}/></filter></defs>;
}
interface TipProps{active?:boolean;label?:string|number;payload?:ReadonlyArray<{dataKey?:string|number;value?:unknown}>;items:readonly ChartSeries[];volume:boolean;rowsByDate:ReadonlyMap<string,ChartPoint>}
export function ActivityTooltip({active,label,payload,items,volume,rowsByDate}:TipProps){
  if(!active||typeof label!=='string'||!payload?.length)return null;
  const row=rowsByDate.get(label);const week=isoWeek(label);
  return <div className="activity-tooltip"><strong>{row&&row.endDate!==label?`${shortDate(label)}–${shortDate(row.endDate)}`:fullDate(label)}</strong><small>{row&&row.endDate!==label?'Période agrégée':`Semaine ${week.week} · ${week.year}`}</small>{items.map(s=>{const p=payload.find(v=>v.dataKey===s.key);const v=typeof p?.value==='number'?p.value:null;return <div key={s.key}><span style={{color:s.color}}>{s.label}</span><span>{v===null?'Indisponible':volume?v:money(v)}</span></div>;})}</div>;
}
const ActivityChart=memo(function ActivityChart({rows,items,relief,compact,granularity,cumulative=false,volume=false,syncId}:ChartProps){
  const unique=useId();const id='activity-shadow-'+unique.replace(/[^a-zA-Z0-9_-]/g,'');
  const shadowsEnabled=relief&&rows.length<=90;
  const data=useMemo(()=>shadowsEnabled?rows.map(r=>({...r,...Object.fromEntries(items.map(s=>['_shadow_'+s.key,r[s.key]]))})):rows,[rows,items,shadowsEnabled]);
  const starts=useMemo(()=>granularity==='day'?rows.filter((r,i)=>i===0||parseDay(r.date).getUTCDay()===1):[],[rows,granularity]);
  const byDate=useMemo(()=>new Map(rows.map(r=>[r.date,r])),[rows]);
  const axisTick=useMemo(()=>granularity==='day'?<DayAxisTick/>:AXIS_TICK,[granularity]);
  const periodFormatter=useMemo(()=>{const labels=new Map(rows.map(r=>[r.date,r.periodLabel]));return (value:string)=>labels.get(value)??value;},[rows]);
  const tickDates=useMemo(()=>{const step=Math.max(1,Math.ceil(rows.length/(granularity==='day'?rows.length||1:16)));return rows.filter((_,i)=>i%step===0||i===rows.length-1).map(r=>r.date);},[rows,granularity]);
  const showDots=rows.length<=31;
  const dotStyles=useMemo(()=>items.map(s=>({r:3,fill:'#FFFFFF',stroke:s.color,strokeWidth:1.8})),[items]);
  const tip=useMemo(()=><ActivityTooltip items={items} volume={volume} rowsByDate={byDate}/>,[items,volume,byDate]);
  const width=granularity==='day'?Math.max(700,rows.length*49):Math.max(700,Math.min(1100,rows.length*35));
  return <div className="activity-canvas" style={{width}}><div style={{height:volume?245:365}} role="img" aria-label={`${volume?'Volumes':'Montants HT'} ${cumulative?'cumulés':'par période'}. Tableau détaillé disponible après les graphiques.`}>
    <ResponsiveContainer width="100%" height="100%" debounce={100}><ComposedChart data={data} syncId={syncId} syncMethod="value" margin={MARGIN}>
      {shadowsEnabled&&<ChartShadowLayer id={id} compact={compact}/>}
      <CartesianGrid {...GRID_STYLE} vertical={false}/>
      <XAxis dataKey="date" scale="band" interval={0} ticks={tickDates} tick={axisTick as any} tickFormatter={periodFormatter} tickLine={false} axisLine={GRID_STYLE} height={granularity==='day'?34:42}/>
      <YAxis width={68} allowDecimals={!volume} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={volume?countTick:moneyTick} label={{value:volume?'Nombre':'€ HT',position:'insideTopLeft',offset:0,fill:'#526779'}}/>
      {starts.map(r=><ReferenceLine key={r.date} x={r.date} stroke="#B8C8D5" strokeDasharray="3 4"/>)}
      <Tooltip filterNull={false} content={tip as any} isAnimationActive={false}/>
      {shadowsEnabled&&items.map(s=><Line key={'shadow-'+s.key} dataKey={'_shadow_'+s.key} type="monotone" stroke={s.color} strokeWidth={compact?4:5} strokeOpacity={compact?.18:.28} filter={`url(#${id})`} dot={false} activeDot={false} isAnimationActive={false} legendType="none" tooltipType="none" connectNulls={false} pointerEvents="none" aria-hidden="true"/>)}
      {items.map((s,i)=><Line key={s.key} name={s.label} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={3} strokeDasharray={i===2?'7 3':i===3?'2 3':undefined} dot={showDots?dotStyles[i]:false} activeDot={ACTIVE_DOT} isAnimationActive={false} connectNulls={false}/>)}
    </ComposedChart></ResponsiveContainer></div>{granularity==='day'&&<WeekBandAxis rows={rows}/>}</div>;
});
export const RevenueTrendChart=memo(function RevenueTrendChart(props:Omit<ChartProps,'volume'>){return <ActivityChart {...props}/>;});
export const ActivityVolumeChart=memo(function ActivityVolumeChart(props:Omit<ChartProps,'volume'>){return <ActivityChart {...props} volume/>;});
