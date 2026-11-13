'use client';
import {useEffect,useState,useRef} from 'react';
import {LayoutDashboard,Upload,ClipboardList,MessageSquare,Users,Flag,ArrowUpRight,ArrowDownRight,CheckCircle2,Clock,ChevronRight,Download,Plus,Send,RefreshCw,Building2,ExternalLink,UserCheck} from 'lucide-react';
import Login from './Login';
import {baseFields,parseCSV,validateSnapshot,cutoffs,sanctionSectors,sanctionSectorLabels,sanctionEntryFields,parseDirectoryCSV,validateDirectory} from './model.mjs';
const sectorLabels:Record<string,string>=sanctionSectorLabels;
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const fmt=(n:any)=>n===undefined?'—':Number(n).toLocaleString('en-IN');
function download(name:string,text:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
export default function Portal(){const [auth,setAuth]=useState<any>(undefined);async function check(){const r=await fetch('/api/auth');const j:any=await r.json();setAuth(j.user);}useEffect(()=>{check().catch(()=>setAuth(null));},[]);if(auth===undefined)return <main className="loading"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg"/><p>Opening your workspace…</p></main>;if(!auth)return <Login onSuccess={check}/>;return <Home onExit={()=>setAuth(null)}/>;}
function Home({onExit}:{onExit:()=>void}){const loadId=useRef(0),routed=useRef(false);const [date,setDate]=useState(today()),[tab,setTab]=useState('Overview'),[data,setData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[filter,setFilter]=useState('All branches'),[loginSearch,setLoginSearch]=useState(''),[loginFilter,setLoginFilter]=useState('All'),[sol,setSol]=useState(''),[values,setValues]=useState<any>({}),[reply,setReply]=useState(''),[reviewStatus,setReviewStatus]=useState('reviewed'),[rows,setRows]=useState<any[]>([]),[importName,setImportName]=useState(''),[dirRows,setDirRows]=useState<any[]>([]),[dirFileName,setDirFileName]=useState(''),[meta,setMeta]=useState<any>({cutoff:cutoffs(today()).yesterday,deadline:'17:00',baseline:'',fundedDefinition:'',reason:''}),[campaign,setCampaign]=useState({title:'',start:today(),end:today()}),[contact,setContact]=useState({sol:'0174',name:'',phone:'91'}),[grant,setGrant]=useState({email:'',phone:'',role:'branch',sol:'0174'});
async function load(isSilent=false){const requestId=++loadId.current;if(!isSilent)setError('');try{const r=await fetch('/api/portal?date='+date+'&_t='+Date.now(),{cache:'no-store'}),j:any=await r.json();if(requestId!==loadId.current)return;if(!r.ok)throw Error(j.error);setData(j);if(j.user.role==='branch'){setSol(j.user.sol);setValues((prev:any)=>Object.keys(prev).length?prev:(j.subs.find((x:any)=>x.sol===j.user.sol)?.values||{}));}if(!routed.current){setTab(j.user.role==='branch'?'Branch report':j.user.role==='reviewer'?'Review desk':(j.user.role==='srm'||j.user.role==='gm')?'Overview':'Publish data');setReviewStatus((j.user.role==='srm'||j.user.role==='gm')?'gm_direction':'reviewed');routed.current=true;}}catch(e:any){if(!isSilent)setError(e.message);if(/sign.in|session|account changed/i.test(e.message))onExit();}}
useEffect(()=>{const d=new URLSearchParams(window.location.search).get('date');if(d){try{cutoffs(d);setDate(d);}catch{}}},[]);
useEffect(()=>{setData(null);load();setValues({});setReply('');setRows([]);setMeta((m:any)=>({...m,cutoff:cutoffs(date).yesterday}));},[date]);
useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')load(true);},8000);const onFocus=()=>load(true);const onVisibility=()=>{if(document.visibilityState==='visible')load(true);};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisibility);return ()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);};},[date]);
async function act(body:any,message:string){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,...body})}),j:any=await r.json();if(!r.ok)throw Error(j.error);await load();setNotice(message);return true;}catch(e:any){setError(e.message);return false;}finally{setBusy(false);}}
function openBranch(s:string,t='Branch report'){setSol(s);setTab(t);const old=data.subs.find((x:any)=>x.sol===s);setValues(old?.values||{});setReply('');}
const active=data?.pub?.campaigns||data?.campaigns.filter((c:any)=>c.start<=date&&c.end>=date)||[];
const defaultSnap:any={sb_growth:0,cd_growth:0,sb_fy_opened:0,sb_fy_funded:0,cd_fy_opened:0,cd_fy_funded:0,sb_mtd_opened:0,sb_mtd_funded:0,cd_mtd_opened:0,cd_mtd_funded:0,sma0_yesterday_count:0,sma0_yesterday_amount:0,sma0_prior_count:0,sma0_prior_amount:0,sma1_yesterday_count:0,sma1_yesterday_amount:0,sma1_prior_count:0,sma1_prior_amount:0,sma2_yesterday_count:0,sma2_yesterday_amount:0,sma2_prior_count:0,sma2_prior_amount:0,sanction_retail_prior_count:0,sanction_retail_prior_amount:0,sanction_retail_mtd_count:0,sanction_retail_mtd_amount:0,sanction_agri_prior_count:0,sanction_agri_prior_amount:0,sanction_agri_mtd_count:0,sanction_agri_mtd_amount:0,sanction_msme_prior_count:0,sanction_msme_prior_amount:0,sanction_msme_mtd_count:0,sanction_msme_mtd_amount:0};
const snap=data?.pub?.rows.find((b:any)=>b.sol===sol)||(sol?defaultSnap:null),sub=data?.subs.find((b:any)=>b.sol===sol),branch=data?.branches.find((b:any)=>b.sol===sol);
const set=(k:string,v:any)=>setValues((o:any)=>({...o,[k]:v}));
const field=(label:string,k:string)=> <label>{label}<input type="number" min="0" step={k.endsWith('amount')?'0.01':'1'} value={values[k]??''} onChange={e=>set(k,e.target.value)} placeholder="Enter 0 for NIL"/></label>;
const status=(b:any)=>{const s=data.subs.find((x:any)=>x.sol===b.sol);if(!s)return 'Pending';const rev=data.reviews.filter((x:any)=>x.sol===b.sol&&x.revision===s.revision).sort((a:any,b:any)=>b.at.localeCompare(a.at))[0];return rev?.status==='clarification'?'Clarification':rev?'Reviewed':'Submitted';};
const isAdmin=data?.user.role==='admin';const isGm=data?.user.role==='srm'||data?.user.role==='gm';const canReview=data?.user.role!=='branch';
const logins:any[]=data?.logins||[];
const branchLogins=logins.filter((l:any)=>l.role==='branch');
const branchLoginsSols=new Set(branchLogins.map((l:any)=>l.sol));
const loggedInBranchesCount=(data?.branches||[]).filter((b:any)=>branchLoginsSols.has(b.sol)).length;
const pendingLoginBranches=(data?.branches||[]).filter((b:any)=>!branchLoginsSols.has(b.sol));
const tickerItems: Array<{ id: string; sol: string; branchName: string; text: string; icon: string; time: string; }> = [];
for (const l of branchLogins) {
  const b = data?.branches.find((x: any) => x.sol === l.sol);
  const timeStr = l.lastActive ? new Date(l.lastActive).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
  tickerItems.push({
    id: `login-${l.phone}`,
    sol: l.sol,
    branchName: b?.name || l.sol,
    text: `${b?.name || 'Branch'} (SOL ${l.sol}): Head ${l.name || l.phone?.slice(2)} logged in${timeStr ? ' at ' + timeStr : ''}`,
    icon: '🟢',
    time: l.lastActive || '',
  });
}
for (const s of (data?.subs || [])) {
  const b = data?.branches.find((x: any) => x.sol === s.sol);
  const timeStr = s.at ? new Date(s.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
  tickerItems.push({
    id: `sub-${s.sol}-${s.revision}`,
    sol: s.sol,
    branchName: b?.name || s.sol,
    text: `${b?.name || 'Branch'} (SOL ${s.sol}): Daily report submitted (Rev ${s.revision})${timeStr ? ' at ' + timeStr : ''}`,
    icon: '📊',
    time: s.at || '',
  });
}
tickerItems.sort((a, b) => b.time.localeCompare(a.time));
if (!tickerItems.length && data?.branches?.length) {
  tickerItems.push({
    id: 'standby',
    sol: data.branches[0]?.sol || '0174',
    branchName: data.branches[0]?.name || 'Dindigul Region',
    text: `Dindigul Regional Office: Live activity ticker standby · ${data.branches.length} branches connected`,
    icon: '⚡',
    time: '',
  });
}
const nav=isAdmin?[['Publish data',Upload],['Overview',LayoutDashboard],['Login activity',UserCheck],['Campaigns',Flag],['Branch directory',Users],['Message queue',Send],['Review desk',MessageSquare]]:isGm?[['Overview',LayoutDashboard],['Login activity',UserCheck],['Review desk',MessageSquare],['Campaigns',Flag]]:data?.user.role==='reviewer'?[['Review desk',MessageSquare],['Login activity',UserCheck],['Overview',LayoutDashboard]]:[['Branch report',ClipboardList]];
const total=(key:string)=>(data?.pub?.rows||[]).reduce((a:number,b:any)=>a+Number(b[key]||0),0);
async function upload(file:File){try{const text=await file.text();const r=parseCSV(text);validateSnapshot(r,data.branches,data.campaigns,date);setRows(r);setImportName(file.name);setError('');}catch(e:any){setRows([]);setError(e.message);}}
function template(){let fields=['sol',...baseFields,...active.flatMap((c:any)=>['camp_'+c.id+'_prior','camp_'+c.id+'_mtd'])];download('IOB_upload_'+date+'.csv',fields.join(',')+'\n'+data.branches.map((b:any)=>[b.sol,...fields.slice(1).map(()=> '')].join(',')).join('\n'));}
async function uploadDirectory(file:File){try{const text=await file.text();const r=validateDirectory(parseDirectoryCSV(text),data.branches,data.user.phone);setDirRows(r);setDirFileName(file.name);setError('');}catch(e:any){setDirRows([]);setError(e.message);}}
function directoryTemplate(){download('IOB_branch_directory_template.csv','sol,branch_name,head_name,phone,email,role\n3933,Regional Office,,,,srm\n3933,Regional Office,,,,reviewer\n'+data.branches.map((b:any)=>[b.sol,'"'+(b.name||'').replace(/"/g,'""')+'"','','','','branch'].join(',')).join('\n'));}
async function switchPortal(target:'sma'|'funding'){setBusy(true);try{const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'handoff',date})});const j:any=await r.json();if(!r.ok||!j.token)throw Error(j.error||'Failed to create handover');const isMainDomain=window.location.hostname.includes('dailyreport-9265a');const targetBase=isMainDomain?(target==='sma'?'https://dailyreport-sma-9265a.web.app':'https://dailyreport-funding-9265a.web.app'):window.location.origin+'/'+target;window.location.href=`${targetBase}/?handoff=${encodeURIComponent(j.token)}&date=${date}`;}catch(e:any){setError(e.message);setBusy(false);}}
if(!data)return <main className="loading"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg"/><h1>Daily Performance</h1><p>{error||'Opening your regional workspace…'}</p>{error&&<button onClick={()=>load()}>Try again</button>}</main>;
return <div className={"shell role-"+data.user.role}><aside><div className="brand"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo"/><div>Indian Overseas Bank<small>DINDIGUL REGION</small></div></div><div className="navlabel">PERFORMANCE WORKSPACE</div><nav>{nav.map(([name,Icon]:any)=><button key={name} className={tab===name?'selected':''} onClick={()=>{setTab(name);setNotice('');}}><Icon size={18}/>{name}{name==='Message queue'&&data.jobs.some((x:any)=>x.status!=='sent')&&<i/>}</button>)}</nav><div className="sidebottom"><span className="avatar">{(data.user.name||data.user.email||data.user.phone?.slice(2)||'U')[0].toUpperCase()}</span><div>{data.user.role==='admin'?'Regional administrator':(data.user.role==='srm'||data.user.role==='gm')?'General Manager (GM)':data.user.role==='branch'?'Branch head':'Reviewer'}<small>{data.user.phone?.slice(2)}</small></div></div></aside>
<main><header><div className="crumb">Dindigul region <ChevronRight size={14}/> {tab}</div><div className="headeractions"><span title="Real-time live sync every 8 seconds" style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#059669',fontWeight:700,background:'#ecfdf5',padding:'4px 8px',borderRadius:20,border:'1px solid #a7f3d0'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/> Live Sync</span><button type="button" className="secondary" onClick={()=>switchPortal('sma')} title="Open SMA Follow-up Portal" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#b91c1c',borderColor:'#fecaca',background:'#fef2f2'}}>SMA Follow-up <ExternalLink size={13}/></button><button type="button" className="secondary" onClick={()=>switchPortal('funding')} title="Open Low Balance Funding Portal" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#0284c7',borderColor:'#bae6fd',background:'#f0f9ff'}}>Low Balance Funding <ExternalLink size={13}/></button><span className={"private "+(isGm?"srm-tag":"")}>{data.user.role==='branch'?'Branch head':data.user.role==='reviewer'?'Reviewer':(data.user.role==='srm'||data.user.role==='gm')?'General Manager (GM)':'Admin'}</span><button className="textbutton" onClick={async()=>{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});onExit();}}>Sign out</button><button className="icon" onClick={()=>load()} aria-label="Refresh"><RefreshCw size={17}/></button></div></header><div className="content"><div className="title"><div><div className="eyebrow">DAILY REPORTING</div><h1>{data.user.role==='branch'?'Daily entry':tab}</h1><p>{tab==='Overview'?'A clear view of branch performance. One day at a time.':tab==='Review desk'?'Review submissions, follow commitments and reply to the group.':tab==='Publish data'?'Validate the confirmed position before opening today’s reporting.':'Dindigul regional performance workspace'}</p></div><label className="date">Reporting date<input type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label></div>
<div className="tickertape-wrap no-print"><div className="tickertape-label"><span className="live-dot"/> REGIONAL LIVE PULSE</div><div className="tickertape-track"><div className="tickertape-content">{tickerItems.concat(tickerItems).map((item,idx)=><button key={`${item.id}-${idx}`} type="button" className="tickertape-item" onClick={()=>openBranch(item.sol,tab==='Review desk'?'Review entry':'Branch report')} title={`Click to open ${item.branchName} (${item.sol})`}><span className="tickertape-icon">{item.icon}</span><span className="tickertape-text">{item.text}</span><span className="tickertape-link">Open branch →</span></button>)}</div></div></div>
{error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="alert success" role="status">{notice}</div>}
{!data.pub&&tab!=='Publish data'&&<div className="alert neutral"><Clock size={19}/><div><b>Reporting has not opened for this date.</b><br/>{isAdmin?'Publish the daily position to enable branch submissions.':'Your administrator will open reporting after uploading the daily position.'}</div>{isAdmin&&<button className="secondary" onClick={()=>setTab('Publish data')}>Upload daily data <ChevronRight size={16}/></button>}</div>}
{(tab==='Overview'||tab==='Review desk')&&<><div className="stats"><div><span>Reports submitted</span><strong>{data.subs.length}<em> / {data.branches.length}</em></strong><small>{data.branches.length-data.subs.length} branches pending</small></div><div><span>Today’s Total Sanctions</span><strong>₹{fmt(data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_retail_amount||0)+Number(s.values.sanction_agri_amount||0)+Number(s.values.sanction_msme_amount||0),0))}</strong><small>Retail, Agri & MSME combined</small></div><div><span>Today’s SMA Eliminations</span><strong style={{color:'#059669'}}>₹{fmt(data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma0_amount||0)+Number(s.values.sma1_amount||0)+Number(s.values.sma2_amount||0),0))}</strong><small>{data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma0_count||0)+Number(s.values.sma1_count||0)+Number(s.values.sma2_count||0),0)} accts eliminated</small></div><div><span>SB accounts · this month</span><strong>{data.pub?fmt(total('sb_mtd_opened')):'—'}</strong><small>Confirmed through {data.pub?.cutoff||'source cutoff'}</small></div><div><span>Branches with negative growth</span><strong>{data.pub?data.pub.rows.filter((b:any)=>b.sb_growth<0||b.cd_growth<0).length:'—'}</strong><small>SB or CD · action plan required</small></div></div><div className="panel"><div className="paneltop"><div><h2>{tab==='Review desk'?'Review queue':'Branch performance'}</h2><p>{data.pub?'Published v'+data.pub.version+' · Amounts in ₹ · '+data.pub.baseline:'Confirmed positions will appear after publication.'}</p></div><button className="secondary" onClick={()=>download('IOB_summary_'+date+'.csv','SOL,Branch,Status,SB opened today,CD opened today,Retail sanctions today accts,Retail sanctions today ₹,Agri sanctions today accts,Agri sanctions today ₹,MSME sanctions today accts,MSME sanctions today ₹,SMA0 elim accts,SMA0 elim ₹,SMA1 elim accts,SMA1 elim ₹,SMA2 elim accts,SMA2 elim ₹,Total SMA elim ₹\n'+data.branches.map((b:any)=>{const s=data.subs.find((x:any)=>x.sol===b.sol);const totalSmaElim=Number(s?.values?.sma0_amount||0)+Number(s?.values?.sma1_amount||0)+Number(s?.values?.sma2_amount||0);return [b.sol,b.name,status(b),s?.values.sb_opened??'',s?.values.cd_opened??'',s?.values.sanction_retail_count??'',s?.values.sanction_retail_amount??'',s?.values.sanction_agri_count??'',s?.values.sanction_agri_amount??'',s?.values.sanction_msme_count??'',s?.values.sanction_msme_amount??'',s?.values.sma0_count??'',s?.values.sma0_amount??'',s?.values.sma1_count??'',s?.values.sma1_amount??'',s?.values.sma2_count??'',s?.values.sma2_amount??'',totalSmaElim||''].join(',')}).join('\n'))}><Download size={16}/>Export summary</button></div><div className="toolbar"><input placeholder="Search branch or SOL…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All branches','Pending','Submitted','Reviewed','Clarification','Negative growth','NIL openings'].map(x=><option key={x}>{x}</option>)}</select></div><div className="tablewrap branchlist"><table><thead><tr><th>BRANCH</th><th>SB GROWTH</th><th>CD GROWTH</th><th>TODAY’S SB / CD</th><th>TODAY’S SANCTIONS</th><th>TODAY’S SMA ELIM</th><th>REPORT STATUS</th><th/></tr></thead><tbody>{data.branches.filter((b:any)=>{const s=data.subs.find((x:any)=>x.sol===b.sol),r=data.pub?.rows.find((x:any)=>x.sol===b.sol);return (b.name+' '+b.sol).toLowerCase().includes(search.toLowerCase())&&(filter==='All branches'||filter===status(b)||(filter==='Negative growth'&&(r?.sb_growth<0||r?.cd_growth<0))||(filter==='NIL openings'&&s&&s.values.sb_opened===0&&s.values.cd_opened===0));}).map((b:any)=>{const r=data.pub?.rows.find((x:any)=>x.sol===b.sol),s=data.subs.find((x:any)=>x.sol===b.sol);const totalSma=Number(s?.values?.sma0_amount||0)+Number(s?.values?.sma1_amount||0)+Number(s?.values?.sma2_amount||0);return <tr key={b.sol}><td><b>{b.name}</b><small>SOL {b.sol}</small></td>{['sb','cd'].map(p=><td data-label={p.toUpperCase()+' growth'} key={p}><span className={r?.[p+'_growth']<0?'negative':r?.[p+'_growth']>0?'positive':'muted'}>{r?fmt(r[p+'_growth']):'—'}</span>{r&&<small>{r[p+'_growth']>0?'Positive':r[p+'_growth']<0?'Negative':'Zero growth'}</small>}</td>)}<td data-label="Today’s SB / CD">{s?s.values.sb_opened+' / '+s.values.cd_opened:'—'}</td><td data-label="Today’s Sanctions">{s?<span>₹{fmt(Number(s.values.sanction_retail_amount||0)+Number(s.values.sanction_agri_amount||0)+Number(s.values.sanction_msme_amount||0))}<small>R: ₹{fmt(s.values.sanction_retail_amount)} · A: ₹{fmt(s.values.sanction_agri_amount)} · M: ₹{fmt(s.values.sanction_msme_amount)}</small></span>:'—'}</td><td data-label="Today’s SMA Elim">{s&&totalSma>0?<span>₹{fmt(totalSma)}<small>{Number(s.values.sma0_count||0)+Number(s.values.sma1_count||0)+Number(s.values.sma2_count||0)} accts</small></span>:'—'}</td><td data-label="Report"><span className={'badge '+status(b).toLowerCase()}>{status(b)}</span></td><td><button className="textbutton" onClick={()=>openBranch(b.sol,tab==='Review desk'?'Review entry':'Branch report')}>{tab==='Review desk'?'Review':'Open'} <ChevronRight size={15}/></button></td></tr>})}</tbody></table></div></div><div className="footnote">Confirmed figures and branch-reported additions are kept separate. A missing report is never counted as NIL.</div></>}
{(tab==='Branch report'||tab==='Review entry')&&<>{tab==='Review entry'&&<button className="backbutton secondary" onClick={()=>setTab('Review desk')}>← Back to review queue</button>}<div className="panel branchpicker">{data.user.role==='branch'?<div><h2>{branch?.name}</h2><small>SOL {sol} · Your branch</small></div>:<label>Branch<select value={sol} onChange={e=>openBranch(e.target.value,tab)}><option value="">Select a branch</option>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label>}{sub&&<span className="badge submitted">Revision {sub.revision} · {new Date(sub.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</span>}</div>
{snap&&<><div className="panel"><h2>{branch?.name} <span className="muted">· SOL {sol}</span></h2><p>{data.pub?`Confirmed through ${data.pub.cutoff} · Funded: ${data.pub.fundedDefinition}`:'Awaiting admin baseline publication · You can record and submit today’s performance below.'}</p><div className="tablewrap"><table><thead><tr><th>ACCOUNT POSITION</th><th>SB OPENED / FUNDED</th><th>CD OPENED / FUNDED</th></tr></thead><tbody>{['fy','mtd'].map(p=><tr key={p}><td>{p==='fy'?'FY through prior month-end':'Current month through yesterday'}</td>{['sb','cd'].map(t=><td key={t}>{fmt(snap[t+'_'+p+'_opened'])} / {fmt(snap[t+'_'+p+'_funded'])}</td>)}</tr>)}</tbody></table></div><div className="tablewrap" style={{marginTop:16}}><table><thead><tr><th>SANCTIONS POSITION</th><th>SANCTIONS UPTO LAST MONTH (ACCTS / ₹)</th><th>SANCTIONS IN CURRENT MONTH TILL YESTERDAY (ACCTS / ₹)</th></tr></thead><tbody>{sanctionSectors.map((s:any)=><tr key={s}><td><b>{sectorLabels[s]}</b></td><td>{fmt(snap['sanction_'+s+'_prior_count'])} accts · ₹{fmt(snap['sanction_'+s+'_prior_amount'])}</td><td>{fmt(snap['sanction_'+s+'_mtd_count'])} accts · ₹{fmt(snap['sanction_'+s+'_mtd_amount'])}</td></tr>)}</tbody></table></div><div className="growthline">{['sb','cd'].map(p=><div key={p} className={snap[p+'_growth']<0?'negative':'positive'}>{p.toUpperCase()} growth: ₹{fmt(snap[p+'_growth'])} <b>{snap[p+'_growth']<0?'Negative':snap[p+'_growth']>0?'Positive':'Zero growth'}</b></div>)}</div></div>
{tab==='Branch report'&&data.user.role!=='reviewer'&&<><div className="panel"><div className="paneltop"><div><h2>01 · Today’s account openings</h2><p>Enter today’s additions only. Funded accounts must belong to today’s openings.</p></div><button className="secondary" onClick={()=>setValues((v:any)=>({...v,...Object.fromEntries(['sb_opened','sb_funded','cd_opened','cd_funded','sma0_count','sma0_amount','sma1_count','sma1_amount','sma2_count','sma2_amount',...sanctionEntryFields,...active.map((c:any)=>'camp_'+c.id)].map(k=>[k,0]))}))}>Set today’s additions to NIL</button></div><div className="grid4">{field('SB opened today','sb_opened')}{field('Of these, funded','sb_funded')}{field('CD opened today','cd_opened')}{field('Of these, funded','cd_funded')}</div><div className="miniinfo">Provisional MTD openings: SB {fmt(snap.sb_mtd_opened+Number(values.sb_opened||0))} · CD {fmt(snap.cd_mtd_opened+Number(values.cd_opened||0))}. Confirmed growth remains unchanged.</div></div>
{['sb','cd'].filter(p=>snap[p+'_growth']<0).map(p=><div className="panel plan" key={p}><h2>{p.toUpperCase()} · Plan to become positive</h2><p>Confirmed deficit: ₹{fmt(-snap[p+'_growth'])}. Expected receipts are commitments, not confirmed growth.</p><label>Tentative positivity date<input type="date" min={date} value={values.plans?.[p]?.date||''} onChange={e=>set('plans',{...values.plans,[p]:{...values.plans?.[p],date:e.target.value,funds:values.plans?.[p]?.funds||[{}]}})}/></label>{(values.plans?.[p]?.funds||[{}]).map((f:any,i:number)=><div className="grid3" key={i}>{['reference','amount','date'].map(k=><label key={k}>{k==='reference'?'Account reference (masked)':k==='amount'?'Expected funds (₹)':'Receipt date'}<input type={k==='amount'?'number':k==='date'?'date':'text'} min={k==='date'?date:0} value={f[k]??''} onChange={e=>{let funds=[...(values.plans?.[p]?.funds||[{}])];funds[i]={...funds[i],[k]:e.target.value};set('plans',{...values.plans,[p]:{...values.plans?.[p],funds}});}}/></label>)}</div>)}<button className="textbutton" onClick={()=>set('plans',{...values.plans,[p]:{...values.plans?.[p],funds:[...(values.plans?.[p]?.funds||[{}]),{}]}})}><Plus size={15}/>Add expected receipt</button></div>)}
<div className="panel"><h2>02 · SMA eliminations today</h2><p>Enter resolved accounts and amounts. Transfers between buckets or to NPA are not successful eliminations.</p>{['sma0','sma1','sma2'].map(p=><div className="smarow" key={p}><div><b>{p.toUpperCase()}</b><small>Month-end: {fmt(snap[p+'_prior_count'])} / ₹{fmt(snap[p+'_prior_amount'])}</small><small>Yesterday: {fmt(snap[p+'_yesterday_count'])} / ₹{fmt(snap[p+'_yesterday_amount'])}</small></div>{field('Eliminated count',p+'_count')}{field('Eliminated amount (₹)',p+'_amount')}</div>)}</div>
<div className="panel"><div className="paneltop"><div><h2>03 · Loan sanctions today (Core Retail, Core Agri, Core MSME)</h2><p>Branch heads should fill their present day performance. Confirmed figures upto last month and current month till yesterday are shown alongside.</p></div></div>{sanctionSectors.map((s:any)=><div className="smarow" key={s}><div><b>{sectorLabels[s].toUpperCase()}</b><small>Sanctions upto last month: {fmt(snap['sanction_'+s+'_prior_count'])} accts / ₹{fmt(snap['sanction_'+s+'_prior_amount'])}</small><small>Current month till yesterday: {fmt(snap['sanction_'+s+'_mtd_count'])} accts / ₹{fmt(snap['sanction_'+s+'_mtd_amount'])}</small></div>{field('Sanctioned accounts today','sanction_'+s+'_count')}{field('Sanctioned amount today (₹)','sanction_'+s+'_amount')}</div>)}<div className="miniinfo">Provisional MTD sanctions (including today): {sanctionSectors.map((s:any)=>`${sectorLabels[s]}: ${fmt(Number(snap['sanction_'+s+'_mtd_count']||0)+Number(values['sanction_'+s+'_count']||0))} accts (₹${fmt(Number(snap['sanction_'+s+'_mtd_amount']||0)+Number(values['sanction_'+s+'_amount']||0))})`).join(' · ')}</div></div>
<div className="panel"><h2>04 · Campaign additions</h2>{active.length?active.map((c:any)=><div className="campaignrow" key={c.id}><div><b>{c.title}</b><small>{c.start} — {c.end}</small><small>Prior months: {fmt(snap['camp_'+c.id+'_prior'])} · This month through yesterday: {fmt(snap['camp_'+c.id+'_mtd'])}</small></div>{field('Added today','camp_'+c.id)}</div>):<p>No campaigns are active for this reporting date.</p>}</div><div className="panel submitpanel"><label>Notes / explanation<textarea value={values.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Explain exceptions or relevant changes…"/></label><button disabled={busy} onClick={()=>act({action:'submit',sol,values},'Report saved. Prior revisions are retained.')}>Submit daily performance <CheckCircle2 size={17}/></button></div></>}
{sub&&<div className="panel"><h2>Submitted performance</h2><div className="grid4">{['sb_opened','sb_funded','cd_opened','cd_funded'].map(k=><div key={k}><small>{k.replace('_',' ').toUpperCase()}</small><h2>{fmt(sub.values[k])}</h2></div>)}</div><p>{sub.values.notes||'No additional notes.'}</p>{Object.entries(sub.values.plans||{}).map(([p,plan]:any)=><div key={p}><h3>{p.toUpperCase()} positivity commitment · {plan.date}</h3>{plan.funds.map((f:any,i:number)=><p key={i}>{f.reference} · ₹{fmt(f.amount)} · {f.date}</p>)}</div>)}<div className="grid3">{['sma0','sma1','sma2'].map(p=><p key={p}>{p.toUpperCase()}: {sub.values[p+'_count']} eliminated · ₹{fmt(sub.values[p+'_amount'])}</p>)}</div><div className="grid3">{sanctionSectors.map((s:any)=><p key={s}><b>{sectorLabels[s]} today</b>: {fmt(sub.values['sanction_'+s+'_count'])} accts · ₹{fmt(sub.values['sanction_'+s+'_amount'])}</p>)}</div>{active.map((c:any)=><p key={c.id}>{c.title}: {sub.values['camp_'+c.id]} added today</p>)}</div>}
{sub&&canReview&&<div className="panel"><h2>{isGm?'General Manager (GM) Executive Direction':'Reply to this entry'}</h2><div className="mention"><Users size={16}/>Branch head selected automatically · {branch?.name} ({sol})</div><label>{isGm?'GM remarks / instructions':'Reviewer remarks'}<textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder={isGm?'Provide executive direction or instructions to the branch head…':'Write your feedback or request a clarification…'}/></label><label>Review outcome<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>{isGm&&<option value="gm_direction">★ GM Direction / Instruction</option>}<option value="reviewed">Reviewed</option><option value="clarification">Clarification required</option></select></label><p className="muted">The review is saved immediately. Group delivery waits for a configured connection and a verified branch-head mapping.</p><button disabled={busy} onClick={async()=>{if(await act({action:'review',sol,text:reply,status:reviewStatus,revision:sub.revision},isGm&&reviewStatus==='gm_direction'?'GM direction saved and queued for group delivery.':'Review saved. The group reply is queued; the administrator can check delivery status.'))setReply('');}}><Send size={16}/>{isGm&&reviewStatus==='gm_direction'?'Issue GM Direction':'Save review & queue group reply'}</button></div>}
<div className="panel"><h2>Review history</h2>{data.reviews.filter((r:any)=>r.sol===sol).map((r:any)=><div className={"review "+(r.role==='srm'||r.role==='gm'||r.status==='srm_direction'||r.status==='gm_direction'?'srm-review-card':'')} key={r.id}><div className="paneltop"><b>{(r.role==='srm'||r.role==='gm')?'★ General Manager (GM)':r.by}</b><span className={'badge '+((r.status==='srm_direction'||r.status==='gm_direction')?'srm-badge':r.status)}>{(r.status==='srm_direction'||r.status==='gm_direction')?'GM Direction':r.status}</span></div><small>{(r.role==='srm'||r.role==='gm')?r.by+' · ':''}Report revision {r.revision} · {r.at}</small><p>{r.text}</p></div>)}{!data.reviews.some((r:any)=>r.sol===sol)&&<p>No reviews yet.</p>}</div></>}</>}
{tab==='Publish data'&&isAdmin&&<><div className="steps"><span className="on">1 · Download template</span><ChevronRight size={16}/><span>2 · Upload & validate</span><ChevronRight size={16}/><span>3 · Publish & request reports</span></div><div className="panel"><div className="paneltop"><div><h2>Upload the confirmed branch position</h2><p>CSV format · All 56 branches · Monetary values in rupees</p></div><button className="secondary" onClick={template}><Download size={16}/>Download blank template</button></div><div className="uploadzone"><Upload size={30}/><h3>{importName||'Choose your daily data file'}</h3><p>Include account openings, growth, SMA, loan sanctions (Retail, Agri, MSME) and active campaign figures.</p><input aria-label="Upload daily CSV" type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/></div>{rows.length>0&&<div className="alert success"><CheckCircle2 size={18}/>{rows.length} branches validated. No duplicate SOLs or missing required values.</div>}<div className="grid3">{[['Source cutoff','cutoff','date'],['Submission deadline (IST)','deadline','time'],['Growth comparison baseline','baseline','text']].map(([label,k,type])=><label key={k}>{label}<input type={type} value={meta[k]} onChange={e=>setMeta({...meta,[k]:e.target.value})} placeholder={k==='baseline'?'e.g. balance at 31 March 2026':''}/></label>)}</div><label>Funded-account definition from your source<input value={meta.fundedDefinition} onChange={e=>setMeta({...meta,fundedDefinition:e.target.value})} placeholder="Enter the definition used in the official source report"/></label>{data.pub&&<label>Correction reason (required)<input value={meta.reason} onChange={e=>setMeta({...meta,reason:e.target.value})}/></label>}<button disabled={!rows.length||busy} onClick={()=>act({action:'publish',rows,...meta},'Daily position published. Submission request recorded in message queue.')}><Upload size={16}/>{data.pub?'Publish corrected version':'Publish & request submissions'}</button><p className="muted">Publication opens reporting immediately. Re-publication preserves history and does not duplicate the initial group request.</p></div>{rows.length>0&&<div className="panel"><h2>Upload preview</h2><div className="tablewrap"><table><thead><tr><th>SOL</th><th>SB MTD OPENED</th><th>CD MTD OPENED</th><th>SB GROWTH ₹</th><th>CD GROWTH ₹</th><th>RETAIL SANCTIONS ₹</th><th>AGRI SANCTIONS ₹</th><th>MSME SANCTIONS ₹</th></tr></thead><tbody>{rows.slice(0,8).map(r=><tr key={r.sol}><td>{r.sol}</td><td>{r.sb_mtd_opened}</td><td>{r.cd_mtd_opened}</td><td>{r.sb_growth}</td><td>{r.cd_growth}</td><td>{r.sanction_retail_mtd_amount}</td><td>{r.sanction_agri_mtd_amount}</td><td>{r.sanction_msme_mtd_amount}</td></tr>)}</tbody></table></div><p>First 8 of {rows.length} rows shown.</p></div>}</>}
{tab==='Login activity'&&(isAdmin||isGm||data.user.role==='reviewer')&&<>
  <div className="stats">
    <div>
      <span>Branch Heads Logged In</span>
      <strong style={{color:'#059669'}}>{loggedInBranchesCount}<em> / {data.branches.length}</em></strong>
      <small>{Math.round((loggedInBranchesCount/data.branches.length)*100)}% of branches active</small>
    </div>
    <div>
      <span>Branches Pending Login</span>
      <strong style={{color:'#dc2626'}}>{data.branches.length - loggedInBranchesCount}</strong>
      <small>Workspace not accessed yet</small>
    </div>
    <div>
      <span>Regional Office / Reviewers</span>
      <strong style={{color:'#0284c7'}}>{logins.filter((l:any)=>l.role!=='branch').length}</strong>
      <small>GM, reviewers & admin</small>
    </div>
    <div>
      <span>Total Active Logins</span>
      <strong>{logins.length}</strong>
      <small>Officers on {date}</small>
    </div>
  </div>

  <div className="panel">
    <div className="paneltop">
      <div>
        <h2>Daily Login Activity &amp; Workspace Presence ({date})</h2>
        <p>Monitor which branch heads and regional officers have opened their daily workspace for {date}.</p>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button type="button" className="secondary" onClick={()=>{
          const csvHeader = 'SOL,Branch Name,Head Name,Mobile,Role,Status,Last Active (IST)\n';
          const branchRows = data.branches.map((b:any)=>{
            const l = branchLogins.find((x:any)=>x.sol===b.sol);
            const c = data.contacts?.find((x:any)=>x.sol===b.sol);
            const g = data.grants?.find((x:any)=>x.sol===b.sol);
            const name = l?.name || c?.name || g?.name || 'Branch Head';
            const phone = l?.phone || c?.phone || g?.phone || '';
            const status = l ? 'Logged In' : 'Pending Login';
            const time = l?.lastActive ? new Date(l.lastActive).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'}) : '—';
            return [b.sol, `"${b.name.replace(/"/g,'""')}"`, `"${name.replace(/"/g,'""')}"`, phone, 'branch', status, time].join(',');
          }).join('\n');
          const roRows = logins.filter((l:any)=>l.role!=='branch').map((l:any)=>[l.sol||'3933','Regional Office',`"${(l.name||l.email||'Officer').replace(/"/g,'""')}"`,l.phone||'',l.role,'Logged In',new Date(l.lastActive).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})].join(',')).join('\n');
          download(`IOB_logins_${date}.csv`, csvHeader + branchRows + (roRows ? '\n' + roRows : ''));
        }}>
          <Download size={16}/> Export login CSV
        </button>
        {pendingLoginBranches.length > 0 && <button type="button" className="secondary" onClick={async()=>{
          const text = `*Pending Branch Logins (${date})*\nThe following ${pendingLoginBranches.length} branches have not yet logged in today:\n` + pendingLoginBranches.map((b:any)=>{
            const c = data.contacts?.find((x:any)=>x.sol===b.sol);
            return `• SOL ${b.sol} ${b.name}${c?.name ? ` (${c.name})` : ''}`;
          }).join('\n') + `\n\nPlease log in to report: https://dailyreport-9265a.web.app`;
          await navigator.clipboard.writeText(text);
          setNotice('Pending login list copied to clipboard for WhatsApp sharing.');
        }}>
          Copy pending branches
        </button>}
      </div>
    </div>

    <div className="toolbar">
      <input placeholder="Search SOL, branch, head name or mobile…" value={loginSearch} onChange={e=>setLoginSearch(e.target.value)}/>
      <select value={loginFilter} onChange={e=>setLoginFilter(e.target.value)}>
        <option value="All">All branches (56)</option>
        <option value="Logged in">Logged in today ({loggedInBranchesCount})</option>
        <option value="Pending">Pending login ({data.branches.length - loggedInBranchesCount})</option>
        <option value="Regional Office">Regional Office & Reviewers ({logins.filter((l:any)=>l.role!=='branch').length})</option>
      </select>
    </div>

    <div className="tablewrap branchlist">
      <table>
        <thead>
          <tr>
            <th>BRANCH / OFFICE</th>
            <th>OFFICER &amp; MOBILE</th>
            <th>ROLE</th>
            <th>TODAY'S STATUS</th>
            <th>LAST ACTIVE</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {loginFilter !== 'Regional Office' && data.branches.filter((b:any)=>{
            const l = branchLogins.find((x:any)=>x.sol===b.sol);
            const c = data.contacts?.find((x:any)=>x.sol===b.sol);
            const g = data.grants?.find((x:any)=>x.sol===b.sol);
            const q = loginSearch.toLowerCase();
            const matchesSearch = !q || (b.name + ' ' + b.sol + ' ' + (l?.name||'') + ' ' + (c?.name||'') + ' ' + (l?.phone||'') + ' ' + (c?.phone||'')).toLowerCase().includes(q);
            const matchesFilter = loginFilter === 'All' || (loginFilter === 'Logged in' ? Boolean(l) : !l);
            return matchesSearch && matchesFilter;
          }).map((b:any)=>{
            const l = branchLogins.find((x:any)=>x.sol===b.sol);
            const c = data.contacts?.find((x:any)=>x.sol===b.sol);
            const g = data.grants?.find((x:any)=>x.sol===b.sol);
            const headName = l?.name || c?.name || g?.name || 'Branch Head';
            const phone = l?.phone || c?.phone || g?.phone;
            const waPhone = phone ? (phone.startsWith('91') ? phone : '91' + phone) : null;
            const waReminderText = encodeURIComponent(`Dear ${headName}, Greetings from Regional Office. The daily performance reporting workspace for ${b.name} (SOL ${b.sol}) has not been opened yet for ${date}. Kindly log in and submit your daily position at https://dailyreport-9265a.web.app/?date=${date}`);

            return (
              <tr key={b.sol} style={{background: l ? '#f0fdf4' : '#fff'}}>
                <td>
                  <b>{b.name}</b>
                  <small>SOL {b.sol}</small>
                </td>
                <td data-label="Officer">
                  <b>{headName}</b>
                  {phone ? <small>{phone.length===12 && phone.startsWith('91') ? phone.slice(2) : phone}</small> : <small className="muted">No phone mapped</small>}
                </td>
                <td data-label="Role"><span className="badge">Branch Head</span></td>
                <td data-label="Status">
                  {l ? (
                    <span className="badge" style={{background:'#dcfce7',color:'#15803d',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                      <CheckCircle2 size={13}/> Logged in
                    </span>
                  ) : (
                    <span className="badge" style={{background:'#fee2e2',color:'#b91c1c',fontWeight:700}}>
                      Pending login
                    </span>
                  )}
                </td>
                <td data-label="Last active">
                  {l?.lastActive ? (
                    <span>
                      {new Date(l.lastActive).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}
                      <small>{new Date(l.lastActive).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</small>
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {!l && waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}?text=${waReminderText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{
                        fontSize:11,
                        padding:'4px 8px',
                        background:'#25D366',
                        color:'#fff',
                        textDecoration:'none',
                        borderRadius:6,
                        display:'inline-flex',
                        alignItems:'center',
                        gap:4,
                        whiteSpace:'nowrap'
                      }}
                      title="Send WhatsApp login reminder to branch head"
                    >
                      <Send size={12}/> Remind
                    </a>
                  )}
                </td>
              </tr>
            );
          })}

          {(loginFilter === 'All' || loginFilter === 'Regional Office') && logins.filter((l:any)=>l.role!=='branch').filter((l:any)=>{
            const q = loginSearch.toLowerCase();
            return !q || (l.name + ' ' + l.email + ' ' + l.phone + ' ' + l.role).toLowerCase().includes(q);
          }).map((l:any)=>(
            <tr key={l.phone} style={{background:'#f8fafc'}}>
              <td>
                <b>Regional Office</b>
                <small>SOL 3933 · Dindigul RO</small>
              </td>
              <td data-label="Officer">
                <b>{l.name || l.email || l.phone?.slice(2) || 'Officer'}</b>
                <small>{l.phone?.slice(2)} {l.email ? `· ${l.email}` : ''}</small>
              </td>
              <td data-label="Role">
                <span className={"badge " + ((l.role==='srm'||l.role==='gm')?'srm-badge':'')}>
                  {l.role === 'admin' ? 'Administrator' : (l.role === 'srm' || l.role === 'gm') ? 'General Manager (GM)' : 'Reviewer'}
                </span>
              </td>
              <td data-label="Status">
                <span className="badge" style={{background:'#dbeafe',color:'#1d4ed8',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                  <CheckCircle2 size={13}/> Active today
                </span>
              </td>
              <td data-label="Last active">
                <span>
                  {new Date(l.lastActive).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}
                  <small>{new Date(l.lastActive).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</small>
                </span>
              </td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</>}
{tab==='Campaigns'&&(isAdmin||isGm)&&<>{isAdmin&&<div className="panel"><h2>Add a campaign</h2><p>Campaigns apply to all 56 branches. Dates are inclusive; overlapping campaigns retain separate totals.</p><div className="grid3">{[['Title','title','text'],['Start date','start','date'],['End date','end','date']].map(([l,k,t])=><label key={k}>{l}<input type={t} value={(campaign as any)[k]} onChange={e=>setCampaign({...campaign,[k]:e.target.value})}/></label>)}</div><button disabled={busy} onClick={()=>act({action:'campaign',...campaign},'Campaign created. Download a new upload template to include its columns.')}><Plus size={16}/>Create campaign</button></div>}<div className="campaigns">{data.campaigns.map((c:any)=><div className="panel" key={c.id}><Flag size={24}/><h2>{c.title}</h2><p>{c.start} to {c.end}</p><span className="badge">{c.start<=date&&c.end>=date?'Active':'Outside reporting period'}</span><small>Import ID: {c.id}</small></div>)}</div></>}
{tab==='Branch directory'&&isAdmin&&<><div className="panel"><div className="paneltop"><div><h2>Bulk upload branch directory & access</h2><p>Download the 56-branch CSV template, fill in head name, mobile, and email, then upload once to update both WhatsApp mappings and portal access.</p></div><button className="secondary" onClick={directoryTemplate}><Download size={16}/>Download 56-branch template</button></div><div className="uploadzone"><Upload size={30}/><h3>{dirFileName||'Choose branch directory CSV'}</h3><p>Columns: sol (use 3933 for Regional Office GM/Reviewers), head_name, phone (10 digits or 91+10), email (optional), role (branch/reviewer/srm). Blank rows are skipped.</p><input aria-label="Upload branch directory CSV" type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&uploadDirectory(e.target.files[0])}/></div>{dirRows.length>0&&<><div className="alert success"><CheckCircle2 size={18}/>{dirRows.length} directory entries validated and ready to apply.</div><div className="tablewrap" style={{marginBottom:14}}><table><thead><tr><th>SOL</th><th>HEAD NAME</th><th>MOBILE</th><th>EMAIL</th><th>ROLE</th></tr></thead><tbody>{dirRows.slice(0,8).map((r:any)=><tr key={r.phone}><td>{r.sol||'—'}</td><td>{r.name||'—'}</td><td>{r.phone}</td><td>{r.email||'—'}</td><td>{r.role}</td></tr>)}</tbody></table>{dirRows.length>8&&<p>First 8 of {dirRows.length} rows shown.</p>}</div></>} <button disabled={!dirRows.length||busy} onClick={async()=>{if(await act({action:'upload-directory',rows:dirRows},'Branch directory and access assignments updated.')){setDirRows([]);setDirFileName('');}}}><Upload size={16}/>Upload & apply directory{dirRows.length?' ('+dirRows.length+')':''}</button></div><div className="panel"><h2>Branch-head WhatsApp mapping</h2><p>Numbers are not inferred. Save the correct current head for each branch.</p><div className="grid3"><label>Branch<select value={contact.sol} onChange={e=>setContact({...contact,sol:e.target.value})}>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label><label>Branch head name<input value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/></label><label>WhatsApp number (91 + 10 digits)<input value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})}/></label></div><button disabled={busy} onClick={()=>act({action:'contact',...contact},'Branch-head mapping saved.')}>Save mapping</button><div className="tablewrap"><table><thead><tr><th>BRANCH</th><th>HEAD</th><th>MOBILE</th></tr></thead><tbody>{data.contacts.map((c:any)=><tr key={c.sol}><td>{c.sol} · {data.branches.find((b:any)=>b.sol===c.sol)?.name}</td><td>{c.name}</td><td>{c.phone}</td></tr>)}</tbody></table></div></div><div className="panel"><h2>Portal access assignments</h2><p>Register each mobile number with the officer’s email and role. On first login with their mobile number, that person sets their own 4-digit PIN.</p><div className="grid3"><label>Mobile number<input type="tel" inputMode="numeric" value={grant.phone} onChange={e=>setGrant({...grant,phone:e.target.value})} placeholder="10-digit mobile number"/></label><label>Officer email (optional)<input type="email" value={grant.email} onChange={e=>setGrant({...grant,email:e.target.value})}/></label><label>Role<select value={grant.role} onChange={e=>setGrant({...grant,role:e.target.value})}><option value="branch">Branch head</option><option value="reviewer">Regional reviewer</option><option value="srm">General Manager (GM)</option><option value="none">Revoke access</option></select></label>{grant.role==='branch'?<label>Branch<select value={grant.sol} onChange={e=>setGrant({...grant,sol:e.target.value})}>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label>:(grant.role==='reviewer'||grant.role==='srm'||grant.role==='gm')&&<label>Attached Office<input value="3933 · Regional Office" disabled/></label>}</div><button disabled={busy} onClick={()=>act({action:'grant',...grant,sol:grant.role==='branch'?grant.sol:(grant.role==='reviewer'||grant.role==='srm'||grant.role==='gm')?'3933':null},'Role assignment saved.')}>Save assignment</button>{data.grants.map((g:any)=><div className="accountrow" key={g.phone}><div><b>{g.phone?.slice(2)}</b><small>{[g.name,g.email].filter(Boolean).join(' · ')||'No name/email'} · {g.role==='srm'||g.role==='gm'?'General Manager (GM)':g.role} {g.sol==='3933'?'3933 · Regional Office':g.sol||''}</small></div>{g.role!=='admin'&&<button className="secondary" disabled={busy} onClick={()=>{if(window.confirm('Reset this user’s PIN and sign them out?'))act({action:'reset-pin',phone:g.phone},'PIN reset. The user will set a new PIN on their next login.');}}>Reset PIN</button>}</div>)}</div></>}
{tab==='Message queue'&&isAdmin&&<><div className="alert neutral"><MessageSquare size={22}/><div><b>Group delivery requires a configured WhatsApp connection.</b><br/>A queued or blocked message has not been sent. Use <b>Share via WhatsApp</b> or <b>Copy message</b> below to share directly to your group or branch head.</div></div><div className="panel"><h2>Outbound messages</h2>{data.jobs.length?data.jobs.slice().reverse().map((j:any)=>{const headContact=j.sol?data.contacts.find((c:any)=>c.sol===j.sol):null;return <div className="job" key={j.key}><div className="paneltop"><b>{j.type} · {j.date}{j.sol?' · '+j.sol:''}</b><span className={'badge '+j.status}>{j.status}</span></div><pre>{j.text}</pre>{j.error&&<p className="negative">{j.error}</p>}{j.messageId&&<small>Message reference: {j.messageId}</small>}<div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}><a className="button" style={{display:'inline-flex',alignItems:'center',gap:8,background:'#25D366',color:'#fff',padding:'10px 16px',borderRadius:8,fontWeight:600,textDecoration:'none',fontSize:13}} href={'https://wa.me/?text='+encodeURIComponent(j.text)} target="_blank" rel="noopener noreferrer"><Send size={15}/>Share via WhatsApp</a>{headContact?.phone&&<a className="secondary" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8,fontWeight:600,textDecoration:'none'}} href={'https://wa.me/'+headContact.phone+'?text='+encodeURIComponent(j.text)} target="_blank" rel="noopener noreferrer"><MessageSquare size={15}/>Message {headContact.name}</a>}<button type="button" className="secondary" onClick={async()=>{await navigator.clipboard.writeText(j.text);setNotice('Message copied to clipboard.');}}>Copy message</button>{['pending','blocked'].includes(j.status)&&<button className="secondary" disabled={busy} onClick={()=>act({action:'retry',key:j.key},'Connection checked. See the updated message status.')}><RefreshCw size={15}/>Retry connection</button>}</div></div>;}):<div className="empty"><MessageSquare size={32}/><h3>No messages yet</h3><p>Publication requests and reviewer replies will appear here.</p></div>}</div></>}
</div><footer>Indian Overseas Bank · Dindigul regional reporting <span>All reporting times are IST</span></footer></main></div>;
}
