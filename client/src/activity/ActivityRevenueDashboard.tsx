import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ActivityDay, ChartPoint, DashboardProps, Granularity, MoneyKey, MONEY_SERIES, VOLUME_SERIES } from './types';
import { addDays, aggregate, businessToday, chooseGranularity, cumulative, exportCsv, fullDate, isoWeek, money, normalize, total } from './analytics';
import { ActivityVolumeChart, RevenueTrendChart } from './ActivityCharts';
import './activity-dashboard.css';
const EMPTY_ISSUES:string[]=[];
const PAGE_SIZE=50;
const GRANULARITY_LABELS={day:'jour',week:'semaine',month:'mois'} as const;
function useCompact(){
  const [compact,setCompact]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(max-width: 600px)');const update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  return compact;
}
export const ActivityKpiCard=memo(function ActivityKpiCard({rows,item,value}:{rows:ChartPoint[];item:typeof MONEY_SERIES[number];value:number|null}){
  return <article className="activity-kpi"><span>{item.label}</span><strong>{money(value)}</strong><div className="activity-spark" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" debounce={150}><LineChart data={rows}><Line dataKey={item.key} type="monotone" stroke={item.color} strokeWidth={2} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><small>{value===null?'Source indisponible ou période incomplète':'Total de la sélection'}</small></article>;
});
export const SeriesLegend=memo(function SeriesLegend({visible,onToggle}:{visible:MoneyKey[];onToggle:(key:MoneyKey)=>void}){
  return <div className="activity-legend">{MONEY_SERIES.map(s=><button type="button" key={s.key} aria-pressed={visible.includes(s.key)} onClick={()=>onToggle(s.key)}><span style={{background:s.color}}/>{s.label}{!visible.includes(s.key)&&' — masqué'}</button>)}</div>;
});
export function ActivityDataQuality({issues}:{issues:readonly string[]}){return issues.length?<aside className="activity-quality"><strong>Qualité des données</strong><ul>{issues.map((s,i)=><li key={i}>{s}</li>)}</ul></aside>:null;}
const DailyRows=memo(function DailyRows({rows}:{rows:ActivityDay[]}){
  const [page,setPage]=useState(0);const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));const safePage=Math.min(page,pages-1);
  const visible=useMemo(()=>rows.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE),[rows,safePage]);
  useEffect(()=>setPage(0),[rows]);
  return <><div className="activity-controls"><button type="button" disabled={safePage===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Précédent</button><span>Page {safePage+1} / {pages}</span><button type="button" disabled={safePage>=pages-1} onClick={()=>setPage(p=>Math.min(pages-1,p+1))}>Suivant</button></div><div className="activity-table"><table><caption>Données quotidiennes : {rows.length} jours. Montants en euros HT.</caption><thead><tr><th scope="col">Date</th><th scope="col">Semaine ISO</th>{MONEY_SERIES.map(s=><th scope="col" key={s.key}>{s.label}</th>)}<th scope="col">Interventions</th><th scope="col">Devis émis</th></tr></thead><tbody>{visible.map(r=><tr key={r.date}><th scope="row">{fullDate(r.date)}</th><td>{isoWeek(r.date).year}-S{isoWeek(r.date).week}</td>{MONEY_SERIES.map(s=><td key={s.key}>{money(r[s.key])}</td>)}<td>{r.interventions??'Indisponible'}</td><td>{r.quotes??'Indisponible'}</td></tr>)}</tbody></table></div></>;
});
export const ActivityDataTable=memo(function ActivityDataTable({rows}:{rows:ActivityDay[]}){
  const [open,setOpen]=useState(false);return <details className="activity-panel" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Voir les données quotidiennes</summary>{open&&<DailyRows rows={rows}/>}</details>;
});
interface FiltersProps{start:string;end:string;min:string;max:string;granularity:Granularity|'auto';onStart:(v:string)=>void;onEnd:(v:string)=>void;onGranularity:(v:Granularity|'auto')=>void}
export const ActivityFilters=memo(function ActivityFilters(p:FiltersProps){return <div className="activity-filters"><label>Du<input type="date" value={p.start} min={p.min} max={p.end||p.max} onChange={e=>p.onStart(e.target.value)}/></label><label>Au<input type="date" value={p.end} min={p.start||p.min} max={p.max} onChange={e=>p.onEnd(e.target.value)}/></label><label>Granularité<select value={p.granularity} onChange={e=>p.onGranularity(e.target.value as Granularity|'auto')}><option value="auto">Automatique</option><option value="day">Jour</option><option value="week">Semaine</option><option value="month">Mois</option></select></label></div>;});
function ReadyDashboard({days,issues=EMPTY_ISSUES}:DashboardProps){
  const normalized=useMemo(()=>normalize(days),[days]);const compact=useCompact();const unique=useId();
  const syncId='activity-'+unique;
  const [start,setStart]=useState(''),[end,setEnd]=useState('');const [requested,setRequested]=useState<Granularity|'auto'>('auto');
  const [mode,setMode]=useState<'period'|'cumulative'>('period');const [relief,setRelief]=useState(true);const [visible,setVisible]=useState<MoneyKey[]>(()=>MONEY_SERIES.map(s=>s.key));
  const top=useRef<HTMLDivElement>(null),bottom=useRef<HTMLDivElement>(null),pending=useRef<number|null>(null),targetScroll=useRef<{element:HTMLDivElement;left:number}|null>(null),locked=useRef<HTMLDivElement|null>(null);
  const today=businessToday(),min=normalized[0]?.date??'',last=normalized[normalized.length-1]?.date??'',max=last&&last<today?last:today;
  const initialStart=addDays(today,-20);const selectedStart=start||(min>initialStart?min:initialStart),selectedEnd=end||max;
  const rows=useMemo(()=>normalized.filter(r=>r.date>=selectedStart&&r.date<=selectedEnd),[normalized,selectedStart,selectedEnd]);
  const effective:Granularity=requested==='auto'?chooseGranularity(rows.length):requested==='day'&&rows.length>90?chooseGranularity(rows.length):requested==='week'&&rows.length>1460?'month':requested;
  const points=useMemo(()=>aggregate(rows,effective),[rows,effective]);
  const graphPoints=useMemo(()=>mode==='cumulative'?cumulative(points):points,[points,mode]);
  const sparkPoints=useMemo(()=>aggregate(rows,rows.length>90?'month':rows.length>31?'week':'day'),[rows]);
  const totals=useMemo(()=>Object.fromEntries(MONEY_SERIES.map(s=>[s.key,total(rows,s.key)])) as Record<MoneyKey,number|null>,[rows]);
  const moneyItems=useMemo(()=>MONEY_SERIES.filter(s=>visible.includes(s.key)),[visible]);
  const toggle=useCallback((key:MoneyKey)=>setVisible(v=>v.includes(key)?v.filter(k=>k!==key):[...v,key]),[]);
  const onGranularity=useCallback((v:Granularity|'auto')=>setRequested(v),[]);
  const download=useCallback(()=>exportCsv(rows),[rows]);
  const sync=useCallback((source:HTMLDivElement,target:HTMLDivElement|null)=>{
    if(!target)return;if(locked.current===source){locked.current=null;return;}
    if(Math.abs(target.scrollLeft-source.scrollLeft)<1)return;
    targetScroll.current={element:target,left:source.scrollLeft};
    if(pending.current!==null)return;
    pending.current=window.requestAnimationFrame(()=>{pending.current=null;const next=targetScroll.current;targetScroll.current=null;if(next&&Math.abs(next.element.scrollLeft-next.left)>=1){locked.current=next.element;next.element.scrollLeft=next.left;}});
  },[]);
  useEffect(()=>()=>{if(pending.current!==null)window.cancelAnimationFrame(pending.current);},[]);
  const onTopScroll=useCallback((e:React.UIEvent<HTMLDivElement>)=>sync(e.currentTarget,bottom.current),[sync]);
  const onBottomScroll=useCallback((e:React.UIEvent<HTMLDivElement>)=>sync(e.currentTarget,top.current),[sync]);
  const quality=useMemo(()=>[...issues,...(rows.some(r=>MONEY_SERIES.some(s=>r[s.key]===null))?['Une série est incomplète : son total est indisponible plutôt que présenté comme complet.']:[])],[issues,rows]);
  if(!normalized.length)return <section className="activity-dashboard activity-panel">Aucune donnée disponible.</section>;
  return <section className="activity-dashboard" aria-label="Suivi de l’activité et du chiffre d’affaires"><header className="activity-header"><div><h2>Suivi de l’activité et du chiffre d’affaires</h2><p>Devis, interventions réalisées et facturation</p></div><button type="button" onClick={download}>Exporter CSV</button></header>
    <ActivityFilters start={selectedStart} end={selectedEnd} min={min} max={max} granularity={requested} onStart={setStart} onEnd={setEnd} onGranularity={onGranularity}/>
    <div className="activity-kpis">{MONEY_SERIES.map(item=><ActivityKpiCard key={item.key} rows={sparkPoints} item={item} value={totals[item.key]}/>)}</div>
    <section className="activity-panel"><header className="activity-header"><h3>Montants par {GRANULARITY_LABELS[effective]} {mode==='cumulative'?'— cumulés':''}</h3><div className="activity-controls"><button type="button" aria-pressed={mode==='period'} onClick={()=>setMode('period')}>Par période</button><button type="button" aria-pressed={mode==='cumulative'} onClick={()=>setMode('cumulative')}>Cumulé</button><label><input type="checkbox" checked={relief} onChange={e=>setRelief(e.target.checked)}/> Relief</label></div></header>
    <SeriesLegend visible={visible} onToggle={toggle}/><p className="activity-hint" role="status">Granularité effective : {GRANULARITY_LABELS[effective]}. {effective!==requested&&requested!=='auto'?'Affichage adapté à la longueur de la sélection pour préserver la lisibilité. ':''}{effective==='day'?'Jours et semaines ISO affichés ; défilement horizontal si nécessaire.':'Les périodes sont agrégées par somme ; aucun jour n’est supprimé.'}</p>
    {rows.length?<div className="activity-scroll" ref={top} tabIndex={0} aria-label="Graphique des montants" onScroll={onTopScroll}><RevenueTrendChart rows={graphPoints} items={moneyItems} relief={relief} compact={compact} granularity={effective} cumulative={mode==='cumulative'} syncId={syncId}/></div>:<p>Aucune donnée dans cette sélection. La source doit fournir les dates demandées.</p>}{!visible.length&&<p>Réactivez une série dans la légende.</p>}</section>
    <section className="activity-panel"><h3>Nombre d’interventions et de devis par {GRANULARITY_LABELS[effective]}</h3><div className="activity-volume-legend">{VOLUME_SERIES.map(s=><span key={s.key} style={{color:s.color}}>● {s.label}</span>)}</div><div className="activity-scroll" ref={bottom} tabIndex={0} aria-label="Graphique des volumes" onScroll={onBottomScroll}><ActivityVolumeChart rows={points} items={VOLUME_SERIES} relief={relief} compact={compact} granularity={effective} syncId={syncId}/></div></section>
    <ActivityDataQuality issues={quality}/><ActivityDataTable rows={rows}/><p className="activity-hint">Les devis, interventions et factures ne s’additionnent pas. Les volumes restent par période, même lorsque les montants sont cumulés. Le CSV contient les données quotidiennes de la sélection.</p>
  </section>;
}
export default function ActivityRevenueDashboard(props:DashboardProps){
  if(props.loading)return <div className="activity-dashboard activity-panel" role="status" aria-busy="true">Chargement du suivi d’activité…</div>;
  if(props.error)return <div className="activity-dashboard activity-panel" role="alert">{props.error}{props.onRetry&&<button type="button" onClick={props.onRetry}>Réessayer</button>}</div>;
  return <ReadyDashboard {...props}/>;
}
