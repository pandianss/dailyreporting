'use client';
import {useEffect,useState,useRef} from 'react';
import {LayoutDashboard,Upload,ClipboardList,MessageSquare,Users,Flag,ArrowUpRight,ArrowDownRight,CheckCircle2,Clock,ChevronRight,Download,Plus,Send,RefreshCw,Building2,ExternalLink,UserCheck,X,FastForward,RotateCcw,Copy,Phone,Sparkles} from 'lucide-react';
import Login from './Login';
import {baseFields,parseCSV,validateSnapshot,cutoffs,sanctionSectors,sanctionSectorLabels,sanctionEntryFields,parseDirectoryCSV,validateDirectory,parseCampaignCSV,validateCampaignData} from './model.mjs';
const sectorLabels:Record<string,string>=sanctionSectorLabels;
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const fmt=(n:any)=>n===undefined?'—':Number(n).toLocaleString('en-IN');
function download(name:string,text:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href);}

function getCampaignGroupMsg(camp: any, branchStats: any[], dateStr: string) {
  const totalToday = branchStats.reduce((acc, b) => acc + Number(b.todayVal || 0), 0);
  const totalMtd = branchStats.reduce((acc, b) => acc + Number(b.mtd || 0), 0);
  const totalCumulative = totalMtd + totalToday;
  const totalTarget = branchStats.reduce((acc, b) => acc + Number(b.target || 0), 0);
  const totalPct = totalTarget > 0 ? Math.round((totalCumulative / totalTarget) * 100) : null;
  const contributing = branchStats.filter((b) => b.todayVal > 0);
  const nilOrPending = branchStats.filter((b) => b.todayVal === 0);
  const submittedCount = branchStats.filter((b) => b.hasSubmitted).length;

  const topBranches = [...branchStats]
    .sort((a, b) => b.todayVal - a.todayVal || b.cumulative - a.cumulative)
    .slice(0, 5)
    .filter((b) => b.todayVal > 0);

  const topLines = topBranches.length
    ? topBranches
        .map(
          (b, i) =>
            `${i + 1}. *${b.branch.name}* (${b.branch.sol}): *+${fmt(b.todayVal)} today* (Total: ${fmt(b.cumulative)}${b.target > 0 ? ` / Tgt: ${fmt(b.target)} [${b.pct}%]` : ''})`
        )
        .join('\n')
    : 'No additions recorded yet today.';

  const branchRankings = [...branchStats]
    .sort((a, b) => b.todayVal - a.todayVal || b.cumulative - a.cumulative)
    .map(
      (b, i) =>
        `${i + 1}. *${b.branch.name}* (${b.branch.sol}): +${fmt(b.todayVal)} | Total: ${fmt(b.cumulative)}${b.target > 0 ? ` / Tgt ${fmt(b.target)} (${b.pct}%)` : ''}${
          b.headPhone ? ' | 📞 +' + b.headPhone : ''
        }`
    )
    .join('\n');

  return (
    `📢 *IOB MADURAI REGION - CAMPAIGN PERFORMANCE REPORT*\n` +
    `🏆 *Campaign:* ${camp?.title || 'Active Campaign'}\n` +
    `📅 *Reporting Date:* ${dateStr || 'Today'}\n` +
    `⏳ *Period:* ${camp?.start || ''} to ${camp?.end || ''}\n\n` +
    `📊 *Regional Summary:*\n` +
    (totalTarget > 0 ? `• Regional Target: *${fmt(totalTarget)}* | Achieved: *${fmt(totalCumulative)}* (*${totalPct}%*)\n` : '') +
    `• Mobilized Today: *+${fmt(totalToday)}* (${contributing.length} of 56 branches contributing)\n` +
    `• Cumulative Total: *${fmt(totalCumulative)}* (MTD: ${fmt(totalMtd)} + Today: ${fmt(totalToday)})\n` +
    `• Branches Submitted Today: *${submittedCount} / 56*\n\n` +
    `🌟 *Top Performing Branches Today:*\n` +
    `${topLines}\n\n` +
    `📋 *Branch-wise Today's Additions & Cumulative Position:*\n` +
    `${branchRankings}\n\n` +
    (nilOrPending.length > 0
      ? `⚠️ *Branches with NIL Addition / Pending Today (${nilOrPending.length} branches):*\n` +
        nilOrPending.map((b) => `${b.branch.name} (${b.branch.sol})`).join(', ') +
        '\n\n'
      : '') +
    `🎯 *Action Required:* All Branch Heads are requested to intensify mobilization and ensure daily submission is completed!\n` +
    `👉 Submit Performance: https://dailyreport-9265a.web.app/?date=${dateStr}`
  );
}

function getCampaignIndividualMsg(camp: any, bStat: any, dateStr: string) {
  const targetLine = bStat.target > 0
    ? `• Assigned Target: *${fmt(bStat.target)}*\n• Cumulative Achievement: *${fmt(bStat.cumulative)}* (*${bStat.pct}%* of target)\n`
    : `• Cumulative Campaign Total: *${fmt(bStat.cumulative)}*\n`;

  const statusRemark =
    bStat.todayVal > 0
      ? `👏 *Commendable effort!* Your branch has added *${fmt(
          bStat.todayVal
        )}* today under this campaign.${bStat.target > 0 ? ` Branch is at *${bStat.pct}%* of assigned target.` : ''} Keep up the momentum to maximize regional ranking!`
      : `⚠️ *Action Required:* NIL additions recorded for today.${bStat.target > 0 ? ` Branch target is ${fmt(bStat.target)} (current achievement: ${bStat.pct}%).` : ''} Please mobilize accounts/commitments immediately before day-end to achieve branch targets.`;

  return (
    `Dear Branch Head (${bStat.branch?.name} - SOL ${bStat.branch?.sol}),\n\n` +
    `📊 *IOB Madurai Region · Campaign Performance Update*\n` +
    `🏆 *Campaign:* ${camp?.title || 'Active Campaign'}\n` +
    `📅 *Reporting Date:* ${dateStr || 'Today'}\n\n` +
    `*Your Branch Campaign Position:*\n` +
    `• Added Today: *${fmt(bStat.todayVal)}* ${
      bStat.hasSubmitted ? '✓ (Submitted)' : '(Pending Submission)'
    }\n` +
    `• Month-to-Date (MTD): *${fmt(bStat.mtd)}*\n` +
    targetLine + `\n` +
    `${statusRemark}\n\n` +
    `👉 Submit & View Portal: https://dailyreport-9265a.web.app/?date=${dateStr}`
  );
}

export default function Portal(){const [auth,setAuth]=useState<any>(undefined);async function check(){const r=await fetch('/api/auth');const j:any=await r.json();setAuth(j.user);}useEffect(()=>{document.title='IOB | Daily Performance Reporting Portal';check().catch(()=>setAuth(null));},[]);if(auth===undefined)return <main className="loading"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg"/><p>Opening your workspace…</p></main>;if(!auth)return <Login onSuccess={check}/>;return <Home onExit={()=>setAuth(null)}/>;}
function Home({onExit}:{onExit:()=>void}){const loadId=useRef(0),routed=useRef(false);const [date,setDate]=useState(today()),[tab,setTab]=useState('Overview'),[data,setData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[filter,setFilter]=useState('All branches'),[loginSearch,setLoginSearch]=useState(''),[loginFilter,setLoginFilter]=useState('All'),[sol,setSol]=useState(''),[values,setValues]=useState<any>({}),[reply,setReply]=useState(''),[reviewStatus,setReviewStatus]=useState('reviewed'),[rows,setRows]=useState<any[]>([]),[importName,setImportName]=useState(''),[dirRows,setDirRows]=useState<any[]>([]),[dirFileName,setDirFileName]=useState(''),[meta,setMeta]=useState<any>({cutoff:cutoffs(today()).yesterday,deadline:'17:00',baseline:'',fundedDefinition:'',reason:''}),[campaign,setCampaign]=useState({title:'',start:today(),end:today()}),[contact,setContact]=useState({sol:'0174',name:'',phone:'91'}),[grant,setGrant]=useState({email:'',phone:'',role:'branch',sol:'0174'});
const [showCampModal, setShowCampModal] = useState(false);
const [selectedCampId, setSelectedCampId] = useState<string>('');
const [campSeqIdx, setCampSeqIdx] = useState<number | null>(null);
const [sentCampBranchSols, setSentCampBranchSols] = useState<string[]>([]);
const [copiedCampGroupMsg, setCopiedCampGroupMsg] = useState(false);
const [copiedCampBranchSol, setCopiedCampBranchSol] = useState<string | null>(null);
const [campBranchFilter, setCampBranchFilter] = useState('All');
const [campBranchSearch, setCampBranchSearch] = useState('');
async function load(isSilent=false){const requestId=++loadId.current;if(!isSilent)setError('');try{const r=await fetch('/api/portal?date='+date+'&_t='+Date.now(),{cache:'no-store'}),j:any=await r.json();if(requestId!==loadId.current)return;if(!r.ok)throw Error(j.error);setData(j);if(j.user.role==='branch'){setSol(j.user.sol);setValues((prev:any)=>Object.keys(prev).length?prev:(j.subs.find((x:any)=>x.sol===j.user.sol)?.values||{}));}if(!routed.current){setTab(j.user.role==='branch'?'Branch report':j.user.role==='reviewer'?'Review desk':(j.user.role==='srm'||j.user.role==='gm')?'Overview':'Publish data');setReviewStatus((j.user.role==='srm'||j.user.role==='gm')?'gm_direction':'reviewed');routed.current=true;}}catch(e:any){if(!isSilent)setError(e.message);if(/sign.in|session|account changed/i.test(e.message))onExit();}}
useEffect(()=>{const d=new URLSearchParams(window.location.search).get('date');if(d){try{cutoffs(d);setDate(d);}catch{}}},[]);
useEffect(()=>{setData(null);load();setValues({});setReply('');setRows([]);setMeta((m:any)=>({...m,cutoff:cutoffs(date).yesterday}));},[date]);
useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')load(true);},8000);const onFocus=()=>load(true);const onVisibility=()=>{if(document.visibilityState==='visible')load(true);};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisibility);return ()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);};},[date]);
async function act(body:any,message:string){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,...body})}),j:any=await r.json();if(!r.ok)throw Error(j.error);await load();setNotice(message);return true;}catch(e:any){setError(e.message);return false;}finally{setBusy(false);}}
function openBranch(s:string,t='Branch report'){setSol(s);setTab(t);const old=data.subs.find((x:any)=>x.sol===s);setValues(old?.values||{});setReply('');}
const active=data?.pub?.campaigns||data?.campaigns?.filter((c:any)=>c.start<=date&&c.end>=date)||[];
const selectedCamp = active.find((c: any) => c.id === (selectedCampId || active[0]?.id)) || active[0];

const campBranchStats = (data?.branches || []).map((b: any) => {
  const bSnap = data?.pub?.rows?.find((r: any) => r.sol === b.sol);
  const campDataObj = (data?.campData || []).find((cd: any) => cd.campaign_id === selectedCamp?.id);
  const branchCampRow = campDataObj?.rows?.find((r: any) => r.sol === b.sol);
  const target = Number(branchCampRow?.target || 0);
  const prior = Number(branchCampRow?.prior !== undefined ? branchCampRow.prior : (selectedCamp ? bSnap?.['camp_' + selectedCamp.id + '_prior'] || 0 : 0));
  const mtd = Number(branchCampRow?.mtd !== undefined ? branchCampRow.mtd : (selectedCamp ? bSnap?.['camp_' + selectedCamp.id + '_mtd'] || 0 : 0));
  const bSub = data?.subs?.find((s: any) => s.sol === b.sol);
  const hasSubmitted = Boolean(bSub);
  const todayVal = Number(selectedCamp ? bSub?.values?.['camp_' + selectedCamp.id] || 0 : 0);
  const cumulative = mtd + todayVal;
  const pct = target > 0 ? Math.round((cumulative / target) * 100) : null;

  const branchContact = (data?.contacts || []).find((x: any) => x.sol === b.sol);
  const branchGrant = (data?.grants || []).find((g: any) => g.sol === b.sol && g.role === 'branch');
  const loginInfo = (data?.logins || []).find((l: any) => l.sol === b.sol);
  const headPhone = branchContact?.phone || loginInfo?.phone || branchGrant?.phone || '';
  const headName = branchContact?.name || loginInfo?.name || branchGrant?.name || b.name + ' Branch Head';

  return {
    branch: b,
    target,
    prior,
    mtd,
    todayVal,
    cumulative,
    pct,
    hasSubmitted,
    headPhone,
    headName,
  };
});

const totalCampToday = campBranchStats.reduce((acc: number, x: any) => acc + x.todayVal, 0);
const totalCampMtd = campBranchStats.reduce((acc: number, x: any) => acc + x.mtd, 0);
const totalCampCumulative = totalCampMtd + totalCampToday;
const totalCampTarget = campBranchStats.reduce((acc: number, x: any) => acc + (x.target || 0), 0);
const totalCampPct = totalCampTarget > 0 ? Math.round((totalCampCumulative / totalCampTarget) * 100) : null;
const contributingCampCount = campBranchStats.filter((x: any) => x.todayVal > 0).length;
const submittedCampCount = campBranchStats.filter((x: any) => x.hasSubmitted).length;

const nextCampSeq = () => {
  if (campSeqIdx === null) return;
  const current = campBranchStats[campSeqIdx];
  if (current) {
    setSentCampBranchSols((prev) => Array.from(new Set([...prev, current.branch.sol])));
  }
  if (campSeqIdx + 1 < campBranchStats.length) {
    setCampSeqIdx(campSeqIdx + 1);
  } else {
    setCampSeqIdx(null);
  }
};
const defaultSnap:any={sb_growth:0,cd_growth:0,sb_fy_opened:0,sb_fy_funded:0,cd_fy_opened:0,cd_fy_funded:0,sb_mtd_opened:0,sb_mtd_funded:0,cd_mtd_opened:0,cd_mtd_funded:0,sma0_yesterday_count:0,sma0_yesterday_amount:0,sma0_prior_count:0,sma0_prior_amount:0,sma1_yesterday_count:0,sma1_yesterday_amount:0,sma1_prior_count:0,sma1_prior_amount:0,sma2_yesterday_count:0,sma2_yesterday_amount:0,sma2_prior_count:0,sma2_prior_amount:0,sanction_retail_prior_count:0,sanction_retail_prior_amount:0,sanction_retail_mtd_count:0,sanction_retail_mtd_amount:0,sanction_agri_prior_count:0,sanction_agri_prior_amount:0,sanction_agri_mtd_count:0,sanction_agri_mtd_amount:0,sanction_msme_prior_count:0,sanction_msme_prior_amount:0,sanction_msme_mtd_count:0,sanction_msme_mtd_amount:0};
const snap=data?.pub?.rows.find((b:any)=>b.sol===sol)||(sol?defaultSnap:null),sub=data?.subs.find((b:any)=>b.sol===sol),branch=data?.branches.find((b:any)=>b.sol===sol);
const set=(k:string,v:any)=>setValues((o:any)=>({...o,[k]:v}));
const field=(label:string,k:string)=> <label>{label}<input type="number" min="0" step={k.endsWith('amount')?'0.01':'1'} value={values[k]??''} onChange={e=>set(k,e.target.value)} placeholder="Enter 0 for NIL"/></label>;
const growthField=(label:string,k:string)=> <label>{label}<input type="number" step="0.01" value={values[k]??''} onChange={e=>set(k,e.target.value)} placeholder="Enter ₹ (e.g. 50000 or -25000)"/></label>;
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
function template(){let fields=['sol',...baseFields];download('IOB_upload_'+date+'.csv',fields.join(',')+'\n'+data.branches.map((b:any)=>[b.sol,...fields.slice(1).map(()=> '')].join(',')).join('\n'));}
const [campUploadCampId, setCampUploadCampId] = useState('');
const [campRows, setCampRows] = useState<any[]>([]);
const [campFileName, setCampFileName] = useState('');
async function uploadDirectory(file:File){try{const text=await file.text();const r=validateDirectory(parseDirectoryCSV(text),data.branches,data.user.phone);setDirRows(r);setDirFileName(file.name);setError('');}catch(e:any){setDirRows([]);setError(e.message);}}
function directoryTemplate(){download('IOB_branch_directory_template.csv','sol,branch_name,head_name,phone,email,role\n3933,Regional Office,,,,srm\n3933,Regional Office,,,,reviewer\n'+data.branches.map((b:any)=>[b.sol,'"'+(b.name||'').replace(/"/g,'""')+'"','','','','branch'].join(',')).join('\n'));}
async function switchPortal(target:'sma'|'funding'){setBusy(true);try{const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'handoff',date})});const j:any=await r.json();if(!r.ok||!j.token)throw Error(j.error||'Failed to create handover');const isMainDomain=window.location.hostname.includes('dailyreport-9265a');const targetBase=isMainDomain?(target==='sma'?'https://dailyreport-sma-9265a.web.app':'https://dailyreport-funding-9265a.web.app'):window.location.origin+'/'+target;window.location.href=`${targetBase}/?handoff=${encodeURIComponent(j.token)}&date=${date}`;}catch(e:any){setError(e.message);setBusy(false);}}
if(!data)return <main className="loading"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg"/><h1>Daily Performance</h1><p>{error||'Opening your regional workspace…'}</p>{error&&<button onClick={()=>load()}>Try again</button>}</main>;
return <div className={"shell role-"+data.user.role}><aside><div className="brand"><img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo"/><div>Indian Overseas Bank<small>DAILY PERFORMANCE REPORTING</small></div></div><div className="navlabel">PERFORMANCE WORKSPACE</div><nav>{nav.map(([name,Icon]:any)=><button key={name} className={tab===name?'selected':''} onClick={()=>{setTab(name);setNotice('');}}><Icon size={18}/>{name}{name==='Message queue'&&data.jobs.some((x:any)=>x.status!=='sent')&&<i/>}</button>)}</nav><div className="sidebottom"><span className="avatar">{(data.user.name||data.user.email||data.user.phone?.slice(2)||'U')[0].toUpperCase()}</span><div>{data.user.role==='admin'?'Regional administrator':(data.user.role==='srm'||data.user.role==='gm')?'General Manager (GM)':data.user.role==='branch'?'Branch head':'Reviewer'}<small>{data.user.phone?.slice(2)}</small></div></div></aside>
<main><header><div className="crumb">Dindigul region <ChevronRight size={14}/> {tab}</div><div className="headeractions"><span title="Real-time live sync every 8 seconds" style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'#059669',fontWeight:700,background:'#ecfdf5',padding:'4px 8px',borderRadius:20,border:'1px solid #a7f3d0'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/> Live Sync</span><button type="button" className="secondary" onClick={()=>switchPortal('sma')} title="Open SMA Follow-up Portal" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#b91c1c',borderColor:'#fecaca',background:'#fef2f2'}}>SMA Follow-up <ExternalLink size={13}/></button><button type="button" className="secondary" onClick={()=>switchPortal('funding')} title="Open Low Balance Funding Portal" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#0284c7',borderColor:'#bae6fd',background:'#f0f9ff'}}>Low Balance Funding <ExternalLink size={13}/></button>{(isAdmin||isGm)&&active.length>0&&<button type="button" className="secondary" onClick={()=>{setSelectedCampId(active[0]?.id);setCampSeqIdx(0);setShowCampModal(true);}} title="Open WhatsApp Campaign Messaging Center" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12,fontWeight:600,color:'#15803d',borderColor:'#86efac',background:'#f0fdf4'}}><MessageSquare size={13}/> Campaign WhatsApp ({active.length})</button>}<span className={"private "+(isGm?"srm-tag":"")}>{data.user.role==='branch'?'Branch head':data.user.role==='reviewer'?'Reviewer':(data.user.role==='srm'||data.user.role==='gm')?'General Manager (GM)':'Admin'}</span><button className="textbutton" onClick={async()=>{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});onExit();}}>Sign out</button><button className="icon" onClick={()=>load()} aria-label="Refresh"><RefreshCw size={17}/></button></div></header><div className="content"><div className="title"><div><div className="eyebrow">DAILY REPORTING</div><h1>{data.user.role==='branch'?'Daily entry':tab}</h1><p>{tab==='Overview'?'A clear view of branch performance. One day at a time.':tab==='Review desk'?'Review submissions, follow commitments and reply to the group.':tab==='Publish data'?'Validate the confirmed position before opening today’s reporting.':'Dindigul regional performance workspace'}</p></div><label className="date">Reporting date<input type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label></div>
{data.user.role!=='branch'&&<div className="tickertape-wrap no-print"><div className="tickertape-label"><span className="live-dot"/> REGIONAL LIVE PULSE</div><div className="tickertape-track"><div className="tickertape-content">{tickerItems.concat(tickerItems).map((item,idx)=><button key={`${item.id}-${idx}`} type="button" className="tickertape-item" onClick={()=>openBranch(item.sol,tab==='Review desk'?'Review entry':'Branch report')} title={`Click to open ${item.branchName} (${item.sol})`}><span className="tickertape-icon">{item.icon}</span><span className="tickertape-text">{item.text}</span><span className="tickertape-link">Open branch →</span></button>)}</div></div></div>}
{error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="alert success" role="status">{notice}</div>}
{!data.pub&&tab!=='Publish data'&&<div className="alert neutral"><Clock size={19}/><div><b>Reporting has not opened for this date.</b><br/>{isAdmin?'Publish the daily position to enable branch submissions.':'Your administrator will open reporting after uploading the daily position.'}</div>{isAdmin&&<button className="secondary" onClick={()=>setTab('Publish data')}>Upload daily data <ChevronRight size={16}/></button>}</div>}
{(tab==='Overview'||tab==='Review desk')&&<>{(()=>{
  const sbToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sb_growth_today||0),0);
  const cdToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.cd_growth_today||0),0);
  const tdToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.td_growth_today||0),0);
  const totalDepToday = sbToday + cdToday + tdToday;

  const cumSb = data.pub ? data.pub.rows.reduce((acc:number,r:any)=>acc+Number(r.sb_growth||0),0) : 0;
  const cumCd = data.pub ? data.pub.rows.reduce((acc:number,r:any)=>acc+Number(r.cd_growth||0),0) : 0;

  const sbNegCum = data.pub ? data.pub.rows.filter((b:any)=>Number(b.sb_growth||0)<0).length : 0;
  const cdNegCum = data.pub ? data.pub.rows.filter((b:any)=>Number(b.cd_growth||0)<0).length : 0;

  const sbNegToday = data.subs.filter((s:any)=>Number(s.values.sb_growth_today||0)<0).length;
  const cdNegToday = data.subs.filter((s:any)=>Number(s.values.cd_growth_today||0)<0).length;
  const tdNegToday = data.subs.filter((s:any)=>Number(s.values.td_growth_today||0)<0).length;

  const lpcRCount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_retail_count||0),0);
  const lpcRAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_retail_amount||0),0);
  const lpcACount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_agri_count||0),0);
  const lpcAAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_agri_amount||0),0);
  const lpcMCount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_msme_count||0),0);
  const lpcMAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.lpc_msme_amount||0),0);
  const totalLpcCnt = lpcRCount + lpcACount + lpcMCount;
  const totalLpcAmt = lpcRAmt + lpcAAmt + lpcMAmt;

  const totalSancAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_retail_amount||0)+Number(s.values.sanction_agri_amount||0)+Number(s.values.sanction_msme_amount||0),0);
  const totalSancCnt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_retail_count||0)+Number(s.values.sanction_agri_count||0)+Number(s.values.sanction_msme_count||0),0);

  const sancRCount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_retail_count||0),0);
  const sancRAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_retail_amount||0),0);
  const sancACount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_agri_count||0),0);
  const sancAAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_agri_amount||0),0);
  const sancMCount = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_msme_count||0),0);
  const sancMAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sanction_msme_amount||0),0);

  const totalSmaAmt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma0_amount||0)+Number(s.values.sma1_amount||0)+Number(s.values.sma2_amount||0),0);
  const totalSmaCnt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma0_count||0)+Number(s.values.sma1_count||0)+Number(s.values.sma2_count||0),0);

  const totalSma0Amt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma0_amount||0),0);
  const totalSma1Amt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma1_amount||0),0);
  const totalSma2Amt = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sma2_amount||0),0);

  const sbOpenedToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sb_opened||0),0);
  const sbFundedToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.sb_funded||0),0);
  const cdOpenedToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.cd_opened||0),0);
  const cdFundedToday = data.subs.reduce((acc:number,s:any)=>acc+Number(s.values.cd_funded||0),0);

  const sbMtdOpened = (data.pub ? data.pub.rows.reduce((acc:number,r:any)=>acc+Number(r.sb_mtd_opened||0),0) : 0) + sbOpenedToday;
  const cdMtdOpened = (data.pub ? data.pub.rows.reduce((acc:number,r:any)=>acc+Number(r.cd_mtd_opened||0),0) : 0) + cdOpenedToday;

  const nilOpeningsBranches = data.subs.filter((s:any)=>Number(s.values.sb_opened||0)===0 && Number(s.values.cd_opened||0)===0).length;

  return <>
    {/* ROW 1: TODAY'S GROWTH / MOVEMENT & ACCOUNT OPENING - SB, CD, TD 100% SEPARATE & LPC */}
    <div className="stats">
      <div
        style={{cursor:'pointer',border:filter==='SB Degrowth Today'?'2px solid #0d4b9f':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='SB Degrowth Today'?'All branches':'SB Degrowth Today')}
        title="Click to filter branches by SB degrowth today"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>SB Growth & Accounts Today</span>
          <span style={{fontSize:11,fontWeight:700,color:sbToday>=0?'#059669':'#dc2626',background:sbToday>=0?'#ecfdf5':'#fef2f2',padding:'1px 6px',borderRadius:4}}>
            {sbToday>=0?'▲ ACCRETION':'▼ DEGROWTH'}
          </span>
        </div>
        <strong style={{color:sbToday>=0?'#059669':'#dc2626'}}>₹{fmt(sbToday)}</strong>
        <div style={{margin:'6px 0 6px',padding:'6px 10px',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:700,color:'#1e40af'}}>SB Opened Today:</span>
          <span style={{fontSize:13,fontWeight:800,color:'#1d4ed8'}}>+{sbOpenedToday} <span style={{fontSize:11,fontWeight:600,color:'#1e40af'}}>({sbFundedToday} funded)</span></span>
        </div>
        <small>Confirmed MTD: <b>₹{fmt(cumSb)}</b> &bull; MTD Opened: <b>{sbMtdOpened}</b></small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='CD Degrowth Today'?'2px solid #0d4b9f':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='CD Degrowth Today'?'All branches':'CD Degrowth Today')}
        title="Click to filter branches by CD degrowth today"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>CD Growth & Accounts Today</span>
          <span style={{fontSize:11,fontWeight:700,color:cdToday>=0?'#059669':'#dc2626',background:cdToday>=0?'#ecfdf5':'#fef2f2',padding:'1px 6px',borderRadius:4}}>
            {cdToday>=0?'▲ ACCRETION':'▼ DEGROWTH'}
          </span>
        </div>
        <strong style={{color:cdToday>=0?'#059669':'#dc2626'}}>₹{fmt(cdToday)}</strong>
        <div style={{margin:'6px 0 6px',padding:'6px 10px',background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:700,color:'#334155'}}>CD Opened Today:</span>
          <span style={{fontSize:13,fontWeight:800,color:'#0f172a'}}>+{cdOpenedToday} <span style={{fontSize:11,fontWeight:600,color:'#475569'}}>({cdFundedToday} funded)</span></span>
        </div>
        <small>Confirmed MTD: <b>₹{fmt(cumCd)}</b> &bull; MTD Opened: <b>{cdMtdOpened}</b></small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='TD Degrowth Today'?'2px solid #0d4b9f':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='TD Degrowth Today'?'All branches':'TD Degrowth Today')}
        title="Click to filter branches by TD degrowth today"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>TD Growth Today</span>
          <span style={{fontSize:11,fontWeight:700,color:tdToday>=0?'#059669':'#dc2626',background:tdToday>=0?'#ecfdf5':'#fef2f2',padding:'1px 6px',borderRadius:4}}>
            {tdToday>=0?'▲ MOBILIZATION':'▼ DEGROWTH'}
          </span>
        </div>
        <strong style={{color:tdToday>=0?'#059669':'#dc2626'}}>₹{fmt(tdToday)}</strong>
        <small style={{marginTop:8,display:'block'}}>Term Deposit mobilization today &bull; {data.subs.filter((s:any)=>Number(s.values.td_growth_today||0)>0).length} branches positive</small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='LPC Forwarded Cases'?'2px solid #0284c7':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='LPC Forwarded Cases'?'All branches':'LPC Forwarded Cases')}
        title="Click to filter branches with LPC forwarded cases today"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>Today’s LPC Forwarded</span>
          <span style={{fontSize:11,fontWeight:700,color:'#0284c7',background:'#f0f9ff',padding:'1px 6px',borderRadius:4}}>
            ₹{fmt(totalLpcAmt)}
          </span>
        </div>
        <strong style={{color:'#0284c7'}}>{totalLpcCnt} <em style={{fontSize:17,color:'#64748b',fontWeight:500}}>proposals</em></strong>
        <small style={{fontWeight:600,color:'#0369a1',marginTop:6,display:'block'}}>Retail: {lpcRCount} (₹{fmt(lpcRAmt)}) · Agri: {lpcACount} (₹{fmt(lpcAAmt)}) · MSME: {lpcMCount} (₹{fmt(lpcMAmt)})</small>
      </div>
    </div>

    {/* ROW 2: NEGATIVE BRANCHES COUNT (SB, CD, TD SEPARATELY) & ACCOUNTS OPENED / SUBMISSIONS */}
    <div className="stats" style={{marginTop:-8}}>
      <div
        style={{cursor:'pointer',border:filter==='SB Negative (MTD)'?'2px solid #dc2626':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='SB Negative (MTD)'?'All branches':'SB Negative (MTD)')}
        title="Click to filter branches negative in SB (MTD)"
      >
        <span>SB Negative Branches</span>
        <strong style={{color:sbNegCum>0?'#dc2626':'#059669'}}>{sbNegCum} <em style={{fontSize:17,color:'#64748b'}}>/ {data.branches.length}</em></strong>
        <small style={{lineHeight:1.6}}>
          <b style={{color:'#dc2626'}}>{sbNegCum} branches negative (MTD)</b> &bull; {sbNegToday} degrowth today
        </small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='CD Negative (MTD)'?'2px solid #dc2626':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='CD Negative (MTD)'?'All branches':'CD Negative (MTD)')}
        title="Click to filter branches negative in CD (MTD)"
      >
        <span>CD Negative Branches</span>
        <strong style={{color:cdNegCum>0?'#dc2626':'#059669'}}>{cdNegCum} <em style={{fontSize:17,color:'#64748b'}}>/ {data.branches.length}</em></strong>
        <small style={{lineHeight:1.6}}>
          <b style={{color:'#dc2626'}}>{cdNegCum} branches negative (MTD)</b> &bull; {cdNegToday} degrowth today
        </small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='TD Degrowth Today'?'2px solid #dc2626':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='TD Degrowth Today'?'All branches':'TD Degrowth Today')}
        title="Click to filter branches with TD degrowth today"
      >
        <span>TD Degrowth Branches</span>
        <strong style={{color:tdNegToday>0?'#dc2626':'#059669'}}>{tdNegToday} <em style={{fontSize:17,color:'#64748b'}}>branches</em></strong>
        <small style={{lineHeight:1.6}}>
          <b style={{color:tdNegToday>0?'#dc2626':'#059669'}}>{tdNegToday} branches degrowth today</b> &bull; {data.subs.length-tdNegToday} positive/nil
        </small>
      </div>

      <div
        style={{cursor:'pointer',border:filter==='NIL openings'?'2px solid #ea580c':filter==='Pending'?'2px solid #0d4b9f':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='NIL openings'?'All branches':'NIL openings')}
        title="Click to filter branches by NIL account openings"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>Total Accounts Opened Today</span>
          <span style={{fontSize:10,fontWeight:700,color:'#ea580c',background:'#fff7ed',padding:'1px 5px',borderRadius:4}}>
            {nilOpeningsBranches} NIL OPENINGS
          </span>
        </div>
        <strong style={{color:'#0d4b9f'}}>+{sbOpenedToday + cdOpenedToday} <em style={{fontSize:17,color:'#64748b',fontWeight:500}}>accounts</em></strong>
        <small style={{lineHeight:1.6}}>
          <b>SB: +{sbOpenedToday}</b> ({sbFundedToday} funded) &bull; <b>CD: +{cdOpenedToday}</b> ({cdFundedToday} funded)<br/>
          {data.subs.length} / {data.branches.length} reports submitted ({data.branches.length-data.subs.length} pending)
        </small>
      </div>
    </div>

    {/* ROW 3: SANCTIONS & SMA ELIMINATIONS (LENDING & RECOVERY) */}
    <div className="stats" style={{marginTop:-8,gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))'}}>
      <div
        style={{cursor:'pointer',border:filter==='Sanctions Today'?'2px solid #059669':'1px solid #e6eaf0'}}
        onClick={()=>setFilter(filter==='Sanctions Today'?'All branches':'Sanctions Today')}
        title="Click to filter branches with loan sanctions today"
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>Today’s Total Sanctions</span>
          <span style={{fontSize:11,fontWeight:700,color:'#059669',background:'#ecfdf5',padding:'1px 6px',borderRadius:4}}>
            {totalSancCnt} LOANS
          </span>
        </div>
        <strong style={{color:'#059669'}}>₹{fmt(totalSancAmt)}</strong>
        <small>Retail: {sancRCount} (₹{fmt(sancRAmt)}) · Agri: {sancACount} (₹{fmt(sancAAmt)}) · MSME: {sancMCount} (₹{fmt(sancMAmt)})</small>
      </div>

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span>Today’s SMA Eliminations</span>
          <span style={{fontSize:11,fontWeight:700,color:'#059669',background:'#ecfdf5',padding:'1px 6px',borderRadius:4}}>
            {totalSmaCnt} ACCOUNTS
          </span>
        </div>
        <strong style={{color:'#059669'}}>₹{fmt(totalSmaAmt)}</strong>
        <small>SMA 0: ₹{fmt(totalSma0Amt)} &bull; SMA 1: ₹{fmt(totalSma1Amt)} &bull; SMA 2: ₹{fmt(totalSma2Amt)}</small>
      </div>
    </div>
  </>;
})()}
<div className="panel"><div className="paneltop"><div><h2>{tab==='Review desk'?'Review queue':'Branch performance'}</h2><p>{data.pub?'Published v'+data.pub.version+' · Amounts in ₹ · '+data.pub.baseline:'Confirmed positions will appear after publication.'}</p></div><button className="secondary" onClick={()=>download('IOB_summary_'+date+'.csv','SOL,Branch,Status,SB opened today,CD opened today,SB growth today ₹,CD growth today ₹,TD growth today ₹,Retail sanctions today accts,Retail sanctions today ₹,Agri sanctions today accts,Agri sanctions today ₹,MSME sanctions today accts,MSME sanctions today ₹,Retail LPC forwarded accts,Retail LPC forwarded ₹,Agri LPC forwarded accts,Agri LPC forwarded ₹,MSME LPC forwarded accts,MSME LPC forwarded ₹,SMA0 elim accts,SMA0 elim ₹,SMA1 elim accts,SMA1 elim ₹,SMA2 elim accts,SMA2 elim ₹,Total SMA elim ₹\n'+data.branches.map((b:any)=>{const s=data.subs.find((x:any)=>x.sol===b.sol);const totalSmaElim=Number(s?.values?.sma0_amount||0)+Number(s?.values?.sma1_amount||0)+Number(s?.values?.sma2_amount||0);return [b.sol,b.name,status(b),s?.values.sb_opened??'',s?.values.cd_opened??'',s?.values.sb_growth_today??'',s?.values.cd_growth_today??'',s?.values.td_growth_today??'',s?.values.sanction_retail_count??'',s?.values.sanction_retail_amount??'',s?.values.sanction_agri_count??'',s?.values.sanction_agri_amount??'',s?.values.sanction_msme_count??'',s?.values.sanction_msme_amount??'',s?.values.lpc_retail_count??'',s?.values.lpc_retail_amount??'',s?.values.lpc_agri_count??'',s?.values.lpc_agri_amount??'',s?.values.lpc_msme_count??'',s?.values.lpc_msme_amount??'',s?.values.sma0_count??'',s?.values.sma0_amount??'',s?.values.sma1_count??'',s?.values.sma1_amount??'',s?.values.sma2_count??'',s?.values.sma2_amount??'',totalSmaElim||''].join(',')}).join('\n'))}><Download size={16}/>Export summary</button></div><div className="toolbar"><input placeholder="Search branch or SOL…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All branches','Pending','Submitted','Reviewed','Clarification','SB Negative (MTD)','CD Negative (MTD)','SB Degrowth Today','CD Degrowth Today','TD Degrowth Today','LPC Forwarded Cases','Sanctions Today','NIL openings'].map(x=><option key={x}>{x}</option>)}</select></div><div className="tablewrap branchlist"><table><thead><tr><th>BRANCH</th><th>SB POSITION & OPENINGS</th><th>CD POSITION & OPENINGS</th><th>TD TODAY</th><th>LPC FORWARDED TODAY</th><th>BRANCH SANCTIONS</th><th>SMA ELIM</th><th>REPORT STATUS</th><th/></tr></thead><tbody>{data.branches.filter((b:any)=>{const s=data.subs.find((x:any)=>x.sol===b.sol),r=data.pub?.rows.find((x:any)=>x.sol===b.sol);const hasLpc=s&&(Number(s.values.lpc_retail_count||0)>0||Number(s.values.lpc_agri_count||0)>0||Number(s.values.lpc_msme_count||0)>0);const hasSanction=s&&(Number(s.values.sanction_retail_count||0)>0||Number(s.values.sanction_agri_count||0)>0||Number(s.values.sanction_msme_count||0)>0);return (b.name+' '+b.sol).toLowerCase().includes(search.toLowerCase())&&(filter==='All branches'||filter===status(b)||(filter==='SB Negative (MTD)'&&r?.sb_growth<0)||(filter==='CD Negative (MTD)'&&r?.cd_growth<0)||(filter==='SB Degrowth Today'&&s&&Number(s.values.sb_growth_today||0)<0)||(filter==='CD Degrowth Today'&&s&&Number(s.values.cd_growth_today||0)<0)||(filter==='TD Degrowth Today'&&s&&Number(s.values.td_growth_today||0)<0)||(filter==='LPC Forwarded Cases'&&hasLpc)||(filter==='Sanctions Today'&&hasSanction)||(filter==='NIL openings'&&s&&s.values.sb_opened===0&&s.values.cd_opened===0));}).map((b:any)=>{const r=data.pub?.rows.find((x:any)=>x.sol===b.sol),s=data.subs.find((x:any)=>x.sol===b.sol);const totalSma=Number(s?.values?.sma0_amount||0)+Number(s?.values?.sma1_amount||0)+Number(s?.values?.sma2_amount||0);const totalLpc=Number(s?.values?.lpc_retail_amount||0)+Number(s?.values?.lpc_agri_amount||0)+Number(s?.values?.lpc_msme_amount||0);const totalLpcCnt=Number(s?.values?.lpc_retail_count||0)+Number(s?.values?.lpc_agri_count||0)+Number(s?.values?.lpc_msme_count||0);const totalSanction=Number(s?.values?.sanction_retail_amount||0)+Number(s?.values?.sanction_agri_amount||0)+Number(s?.values?.sanction_msme_amount||0);return <tr key={b.sol}><td><b>{b.name}</b><small>SOL {b.sol}</small></td><td data-label="SB Position & Openings">{r?<div><span className={r.sb_growth<0?'negative':r.sb_growth>0?'positive':'muted'}>MTD: ₹{fmt(r.sb_growth)}</span>{s?.values?.sb_growth_today!=null&&<small style={{color:Number(s.values.sb_growth_today)<0?'#dc2626':'#059669',fontWeight:600}}>Today: ₹{fmt(s.values.sb_growth_today)} {Number(s.values.sb_growth_today)<0?'▼':'▲'}</small>}{s&&<div style={{marginTop:3}}><span style={{display:'inline-block',background:'#e0f2fe',color:'#0369a1',padding:'1px 6px',borderRadius:4,fontSize:11,fontWeight:700}}>Opened: +{s.values.sb_opened} ({s.values.sb_funded} funded)</span></div>}</div>:'—'}</td><td data-label="CD Position & Openings">{r?<div><span className={r.cd_growth<0?'negative':r.cd_growth>0?'positive':'muted'}>MTD: ₹{fmt(r.cd_growth)}</span>{s?.values?.cd_growth_today!=null&&<small style={{color:Number(s.values.cd_growth_today)<0?'#dc2626':'#059669',fontWeight:600}}>Today: ₹{fmt(s.values.cd_growth_today)} {Number(s.values.cd_growth_today)<0?'▼':'▲'}</small>}{s&&<div style={{marginTop:3}}><span style={{display:'inline-block',background:'#f1f5f9',color:'#334155',padding:'1px 6px',borderRadius:4,fontSize:11,fontWeight:700}}>Opened: +{s.values.cd_opened} ({s.values.cd_funded} funded)</span></div>}</div>:'—'}</td><td data-label="TD Today">{s?.values?.td_growth_today!=null?<div><b style={{color:Number(s.values.td_growth_today)<0?'#dc2626':Number(s.values.td_growth_today)>0?'#059669':'#64748b'}}>₹{fmt(s.values.td_growth_today)}</b><small style={{color:Number(s.values.td_growth_today)<0?'#dc2626':'#059669'}}>{Number(s.values.td_growth_today)<0?'▼ Degrowth':Number(s.values.td_growth_today)>0?'▲ Growth':'NIL'}</small></div>:'—'}</td><td data-label="LPC Forwarded Today">{s&&totalLpcCnt>0?<div><b style={{color:'#0284c7'}}>₹{fmt(totalLpc)}</b><small>{totalLpcCnt} cases (R:{s.values.lpc_retail_count||0} · A:{s.values.lpc_agri_count||0} · M:{s.values.lpc_msme_count||0})</small></div>:'—'}</td><td data-label="Branch Sanctions">{s&&totalSanction>0?<div><span>₹{fmt(totalSanction)}</span><small>R: ₹{fmt(s.values.sanction_retail_amount)} · A: ₹{fmt(s.values.sanction_agri_amount)} · M: ₹{fmt(s.values.sanction_msme_amount)}</small></div>:'—'}</td><td data-label="SMA Elim">{s&&totalSma>0?<div><span style={{color:'#059669',fontWeight:600}}>₹{fmt(totalSma)}</span><small>{Number(s.values.sma0_count||0)+Number(s.values.sma1_count||0)+Number(s.values.sma2_count||0)} accts</small></div>:'—'}</td><td data-label="Report"><span className={'badge '+status(b).toLowerCase()}>{status(b)}</span></td><td><button className="textbutton" onClick={()=>openBranch(b.sol,tab==='Review desk'?'Review entry':'Branch report')}>{tab==='Review desk'?'Review':'Open'} <ChevronRight size={15}/></button></td></tr>})}</tbody></table></div></div><div className="footnote">Confirmed figures and branch-reported additions are kept separate. A missing report is never counted as NIL.</div></>}
{(tab==='Branch report'||tab==='Review entry')&&<>{tab==='Review entry'&&<button className="backbutton secondary" onClick={()=>setTab('Review desk')}>← Back to review queue</button>}<div className="panel branchpicker">{data.user.role==='branch'?<div><h2>{branch?.name}</h2><small>SOL {sol} · Your branch</small></div>:<label>Branch<select value={sol} onChange={e=>openBranch(e.target.value,tab)}><option value="">Select a branch</option>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label>}{sub&&<span className="badge submitted">Revision {sub.revision} · {new Date(sub.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</span>}</div>
{snap&&<><div className="panel"><h2>{branch?.name} <span className="muted">· SOL {sol}</span></h2><p>{data.pub?`Confirmed through ${data.pub.cutoff} · Funded: ${data.pub.fundedDefinition}`:'Awaiting admin baseline publication · You can record and submit today’s performance below.'}</p><div className="tablewrap"><table><thead><tr><th>ACCOUNT POSITION</th><th>SB OPENED / FUNDED</th><th>CD OPENED / FUNDED</th></tr></thead><tbody>{['fy','mtd'].map(p=><tr key={p}><td>{p==='fy'?'FY through prior month-end':'Current month through yesterday'}</td>{['sb','cd'].map(t=><td key={t}>{fmt(snap[t+'_'+p+'_opened'])} / {fmt(snap[t+'_'+p+'_funded'])}</td>)}</tr>)}</tbody></table></div><div className="tablewrap" style={{marginTop:16}}><table><thead><tr><th>SANCTIONS POSITION</th><th>SANCTIONS UPTO LAST MONTH (ACCTS / ₹)</th><th>SANCTIONS IN CURRENT MONTH TILL YESTERDAY (ACCTS / ₹)</th></tr></thead><tbody>{sanctionSectors.map((s:any)=><tr key={s}><td><b>{sectorLabels[s]}</b></td><td>{fmt(snap['sanction_'+s+'_prior_count'])} accts · ₹{fmt(snap['sanction_'+s+'_prior_amount'])}</td><td>{fmt(snap['sanction_'+s+'_mtd_count'])} accts · ₹{fmt(snap['sanction_'+s+'_mtd_amount'])}</td></tr>)}</tbody></table></div><div className="growthline">{['sb','cd'].map(p=><div key={p} className={snap[p+'_growth']<0?'negative':'positive'}>{p.toUpperCase()} growth: ₹{fmt(snap[p+'_growth'])} <b>{snap[p+'_growth']<0?'Negative':snap[p+'_growth']>0?'Positive':'Zero growth'}</b></div>)}</div></div>
{tab==='Branch report'&&data.user.role!=='reviewer'&&<><div className="panel"><div className="paneltop"><div><h2>01 · Today’s account openings</h2><p>Enter today’s additions only. Funded accounts must belong to today’s openings.</p></div><button className="secondary" onClick={()=>setValues((v:any)=>({...v,...Object.fromEntries(['sb_opened','sb_funded','cd_opened','cd_funded','sb_growth_today','cd_growth_today','td_growth_today','sma0_count','sma0_amount','sma1_count','sma1_amount','sma2_count','sma2_amount',...sanctionSectors.flatMap((s:any)=>['sanction_'+s+'_count','sanction_'+s+'_amount','lpc_'+s+'_count','lpc_'+s+'_amount']),...active.map((c:any)=>'camp_'+c.id)].map(k=>[k,0]))}))}>Set today’s additions to NIL</button></div><div className="grid4">{field('SB opened today','sb_opened')}{field('Of these, funded','sb_funded')}{field('CD opened today','cd_opened')}{field('Of these, funded','cd_funded')}</div><div className="miniinfo">Provisional MTD openings: SB {fmt(snap.sb_mtd_opened+Number(values.sb_opened||0))} · CD {fmt(snap.cd_mtd_opened+Number(values.cd_opened||0))}. Confirmed growth remains unchanged.</div>{(()=>{const bFund=(data?.fundingAccounts||[]).filter((a:any)=>a.sol===sol);const bDone=bFund.filter((a:any)=>a.funded);const bAmt=bDone.reduce((acc:number,a:any)=>acc+Number(a.funded_amount||0),0);return <div style={{marginTop:14,padding:'12px 16px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><div><div style={{display:'flex',alignItems:'center',gap:6,color:'#0369a1',fontWeight:700,fontSize:13}}><CheckCircle2 size={16} color="#0284c7"/><span>Low Balance Accounts Funding (Live Auto-Sync)</span><span style={{fontSize:10,background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:10,border:'1px solid #bae6fd',fontWeight:700}}>AUTO-FETCHED · NO MANUAL ENTRY</span></div><div style={{fontSize:12,color:'#334155',marginTop:4}}><b>{bDone.length}</b> of <b>{bFund.length}</b> low balance accounts funded &bull; Mobilized: <b style={{color:'#059669'}}>₹{fmt(bAmt)}</b></div></div><button type="button" className="secondary" onClick={()=>switchPortal('funding')} style={{fontSize:12,padding:'5px 12px',display:'inline-flex',alignItems:'center',gap:5,color:'#0284c7',borderColor:'#bae6fd'}}>Open Funding Portal <ExternalLink size={13}/></button></div>;})()}</div>
<div className="panel"><div className="paneltop"><div><h2>01B · Deposit growth today (SB, CD, TD)</h2><p>Enter net deposit growth mobilized by your branch today in rupees (can be positive or negative).</p></div></div><div className="grid3">{growthField('SB Growth Today (₹)','sb_growth_today')}{growthField('CD Growth Today (₹)','cd_growth_today')}{growthField('TD (Term Deposit) Growth Today (₹)','td_growth_today')}</div></div>
{['sb','cd'].filter(p=>snap[p+'_growth']<0).map(p=><div className="panel plan" key={p}><h2>{p.toUpperCase()} · Plan to become positive</h2><p>Confirmed deficit: ₹{fmt(-snap[p+'_growth'])}. Expected receipts are commitments, not confirmed growth.</p><label>Tentative positivity date<input type="date" min={date} value={values.plans?.[p]?.date||''} onChange={e=>set('plans',{...values.plans,[p]:{...values.plans?.[p],date:e.target.value,funds:values.plans?.[p]?.funds||[{}]}})}/></label>{(values.plans?.[p]?.funds||[{}]).map((f:any,i:number)=><div className="grid3" key={i}>{['reference','amount','date'].map(k=><label key={k}>{k==='reference'?'Account reference (masked)':k==='amount'?'Expected funds (₹)':'Receipt date'}<input type={k==='amount'?'number':k==='date'?'date':'text'} min={k==='date'?date:0} value={f[k]??''} onChange={e=>{let funds=[...(values.plans?.[p]?.funds||[{}])];funds[i]={...funds[i],[k]:e.target.value};set('plans',{...values.plans,[p]:{...values.plans?.[p],funds}});}}/></label>)}</div>)}<button className="textbutton" onClick={()=>set('plans',{...values.plans,[p]:{...values.plans?.[p],funds:[...(values.plans?.[p]?.funds||[{}]),{}]}})}><Plus size={15}/>Add expected receipt</button></div>)}
<div className="panel"><h2>02 · SMA eliminations today</h2><p>Enter resolved accounts and amounts. Transfers between buckets or to NPA are not successful eliminations.</p>{['sma0','sma1','sma2'].map(p=><div className="smarow" key={p}><div><b>{p.toUpperCase()}</b><small>Month-end: {fmt(snap[p+'_prior_count'])} / ₹{fmt(snap[p+'_prior_amount'])}</small><small>Yesterday: {fmt(snap[p+'_yesterday_count'])} / ₹{fmt(snap[p+'_yesterday_amount'])}</small></div>{field('Eliminated count',p+'_count')}{field('Eliminated amount (₹)',p+'_amount')}</div>)}</div>
<div className="panel"><div className="paneltop"><div><h2>03 · Loan sanctions today (Core Retail, Core Agri, Core MSME)</h2><p>Branch heads should fill their present day performance. Confirmed figures upto last month and current month till yesterday are shown alongside.</p></div></div>{sanctionSectors.map((s:any)=><div className="smarow" key={s}><div><b>{sectorLabels[s].toUpperCase()}</b><small>Sanctions upto last month: {fmt(snap['sanction_'+s+'_prior_count'])} accts / ₹{fmt(snap['sanction_'+s+'_prior_amount'])}</small><small>Current month till yesterday: {fmt(snap['sanction_'+s+'_mtd_count'])} accts / ₹{fmt(snap['sanction_'+s+'_mtd_amount'])}</small></div>{field('Sanctioned accounts today','sanction_'+s+'_count')}{field('Sanctioned amount today (₹)','sanction_'+s+'_amount')}</div>)}<div className="miniinfo">Provisional MTD sanctions (including today): {sanctionSectors.map((s:any)=>`${sectorLabels[s]}: ${fmt(Number(snap['sanction_'+s+'_mtd_count']||0)+Number(values['sanction_'+s+'_count']||0))} accts (₹${fmt(Number(snap['sanction_'+s+'_mtd_amount']||0)+Number(values['sanction_'+s+'_amount']||0))})`).join(' · ')}</div></div>
<div className="panel"><div className="paneltop"><div><h2>03B · Loans forwarded to LPC today (Core Retail, Core Agri, Core MSME)</h2><p>Proposals forwarded to the Loan Processing Cell (LPC) today for sanction.</p></div></div>{sanctionSectors.map((s:any)=><div className="smarow" key={'lpc_'+s}><div><b>{sectorLabels[s].toUpperCase()}</b><small>Proposals forwarded to LPC today</small></div>{field('Proposals forwarded today','lpc_'+s+'_count')}{field('Proposal amount forwarded (₹)','lpc_'+s+'_amount')}</div>)}<div className="miniinfo">Total LPC proposals forwarded today: {sanctionSectors.reduce((acc:number,s:any)=>acc+Number(values['lpc_'+s+'_count']||0),0)} proposals · ₹{fmt(sanctionSectors.reduce((acc:number,s:any)=>acc+Number(values['lpc_'+s+'_amount']||0),0))}</div></div>
<div className="panel"><h2>04 · Campaign additions</h2>{active.length?active.map((c:any)=><div className="campaignrow" key={c.id}><div><b>{c.title}</b><small>{c.start} — {c.end}</small><small>Prior months: {fmt(snap['camp_'+c.id+'_prior'])} · This month through yesterday: {fmt(snap['camp_'+c.id+'_mtd'])}</small></div>{field('Added today','camp_'+c.id)}</div>):<p>No campaigns are active for this reporting date.</p>}</div><div className="panel submitpanel"><label>Notes / explanation<textarea value={values.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Explain exceptions or relevant changes…"/></label><button disabled={busy} onClick={()=>act({action:'submit',sol,values},'Report saved. Prior revisions are retained.')}>Submit daily performance <CheckCircle2 size={17}/></button></div></>}
{sub&&<div className="panel"><h2>Submitted performance</h2><div className="grid4">{['sb_opened','sb_funded','cd_opened','cd_funded'].map(k=><div key={k}><small>{k.replace('_',' ').toUpperCase()}</small><h2>{fmt(sub.values[k])}</h2></div>)}</div><div style={{marginTop:12,padding:'10px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}><div style={{fontSize:11,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.5px'}}>Deposit Growth Today</div><div className="grid3" style={{marginTop:6}}><div><small>SB Growth Today</small><b style={{display:'block',fontSize:15,color:Number(sub.values.sb_growth_today||0)<0?'#dc2626':'#059669'}}>₹{fmt(sub.values.sb_growth_today||0)}</b></div><div><small>CD Growth Today</small><b style={{display:'block',fontSize:15,color:Number(sub.values.cd_growth_today||0)<0?'#dc2626':'#059669'}}>₹{fmt(sub.values.cd_growth_today||0)}</b></div><div><small>TD Growth Today</small><b style={{display:'block',fontSize:15,color:Number(sub.values.td_growth_today||0)<0?'#dc2626':'#059669'}}>₹{fmt(sub.values.td_growth_today||0)}</b></div></div></div><p>{sub.values.notes||'No additional notes.'}</p>{Object.entries(sub.values.plans||{}).map(([p,plan]:any)=><div key={p}><h3>{p.toUpperCase()} positivity commitment · {plan.date}</h3>{plan.funds.map((f:any,i:number)=><p key={i}>{f.reference} · ₹{fmt(f.amount)} · {f.date}</p>)}</div>)}<div className="grid3">{['sma0','sma1','sma2'].map(p=><p key={p}>{p.toUpperCase()}: {sub.values[p+'_count']} eliminated · ₹{fmt(sub.values[p+'_amount'])}</p>)}</div><div className="grid3">{sanctionSectors.map((s:any)=><p key={s}><b>{sectorLabels[s]} Sanctions today</b>: {fmt(sub.values['sanction_'+s+'_count'])} accts · ₹{fmt(sub.values['sanction_'+s+'_amount'])}</p>)}</div><div className="grid3" style={{marginTop:8}}>{sanctionSectors.map((s:any)=><p key={'lpc_'+s} style={{color:'#0284c7'}}><b>{sectorLabels[s]} LPC Forwarded</b>: {fmt(sub.values['lpc_'+s+'_count']||0)} accts · ₹{fmt(sub.values['lpc_'+s+'_amount']||0)}</p>)}</div>{(()=>{const bFund=(data?.fundingAccounts||[]).filter((a:any)=>a.sol===sol);const bDone=bFund.filter((a:any)=>a.funded);const bAmt=bDone.reduce((acc:number,a:any)=>acc+Number(a.funded_amount||0),0);return <div style={{marginTop:10,fontSize:12,color:'#0369a1',background:'#f0f9ff',padding:'8px 12px',borderRadius:6,border:'1px solid #bae6fd'}}><b>Low Balance Funding (Live Sync)</b>: {bDone.length} of {bFund.length} accounts funded (₹{fmt(bAmt)} mobilized)</div>;})()}{active.map((c:any)=><p key={c.id}>{c.title}: {sub.values['camp_'+c.id]} added today</p>)}</div>}
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
{tab==='Campaigns'&&(isAdmin||isGm)&&<>{active.length>0&&<div className="panel" style={{borderLeft:'4px solid #16a34a',background:'linear-gradient(to right, #f0fdf4, #ffffff)',marginBottom:20}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}><div><div style={{display:'flex',alignItems:'center',gap:10}}><span style={{background:'#25D366',color:'#fff',borderRadius:'50%',width:34,height:34,display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 6px rgba(37,211,102,0.3)'}}><MessageSquare size={18}/></span><div><h3 style={{margin:0,fontSize:16,fontWeight:800,color:'#166534'}}>WhatsApp Campaign Performance Dispatch Center</h3><p style={{margin:'2px 0 0',fontSize:13,color:'#475569'}}>1-click individual performance messages to branch heads & consolidated group summary for {date}.</p></div></div></div><button type="button" onClick={()=>{setSelectedCampId(active[0]?.id);setCampSeqIdx(0);setShowCampModal(true);}} style={{background:'#16a34a',color:'#fff',border:'none',padding:'10px 18px',borderRadius:8,fontWeight:700,fontSize:13,display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',boxShadow:'0 2px 8px rgba(22, 163, 74, 0.25)'}}><MessageSquare size={16}/> Open Campaign WhatsApp Dispatcher ({active.length} Active)</button></div></div>}
{isAdmin&&active.length>0&&<div className="panel"><div className="paneltop"><div><h2>Upload Campaign Targets &amp; Performance</h2><p>Upload targets and CBS performance separately for any active campaign without modifying the daily snapshot CSV.</p></div><div style={{display:'flex',gap:10,alignItems:'center'}}><select value={campUploadCampId||selectedCamp?.id||''} onChange={e=>{setCampUploadCampId(e.target.value);setCampRows([]);setCampFileName('');}} style={{minWidth:200}}>{active.map((c:any)=><option key={c.id} value={c.id}>{c.title}</option>)}</select><button type="button" className="secondary" onClick={()=>{const cId=campUploadCampId||selectedCamp?.id;const c=active.find((x:any)=>x.id===cId)||active[0];if(!c)return;const head='sol,branch_name,target,prior_achievement,mtd_achievement\n';const rows=data.branches.map((b:any)=>`${b.sol},"${(b.name||'').replace(/"/g,'""')}",,,`).join('\n');download(`IOB_campaign_${c.title.replace(/[^a-zA-Z0-9_-]/g,'_')}_targets.csv`,head+rows);}}><Download size={16}/> Download Template</button></div></div><div className="uploadzone"><Upload size={30}/><h3>{campFileName||`Choose CSV file for ${active.find((x:any)=>x.id===(campUploadCampId||selectedCamp?.id))?.title||'selected campaign'}`}</h3><p>Columns: sol (or branch_code), target (assigned target), prior_achievement (or prior), mtd_achievement (or mtd). All 56 branches.</p><input aria-label="Upload campaign targets CSV" type="file" accept=".csv,text/csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const text=await file.text();const parsed=parseCampaignCSV(text);const validated=validateCampaignData(parsed,data.branches);setCampRows(validated);setCampFileName(file.name);setError('');}catch(err:any){setCampRows([]);setError(err.message);}}}/></div>{campRows.length>0&&<><div className="alert success"><CheckCircle2 size={18}/>{campRows.length} branch targets &amp; performance figures validated and ready to save.</div><div className="tablewrap" style={{marginBottom:14}}><table><thead><tr><th>SOL</th><th>BRANCH</th><th>TARGET</th><th>PRIOR ACHIEVED</th><th>MTD ACHIEVED</th></tr></thead><tbody>{campRows.slice(0,8).map((r:any)=><tr key={r.sol}><td>{r.sol}</td><td>{data.branches.find((b:any)=>b.sol===r.sol)?.name}</td><td><b>{fmt(r.target)}</b></td><td>{fmt(r.prior)}</td><td>{fmt(r.mtd)}</td></tr>)}</tbody></table>{campRows.length>8&&<p style={{fontSize:12,color:'#64748b'}}>First 8 of {campRows.length} branch rows shown.</p>}</div><button type="button" disabled={busy} onClick={async()=>{const cId=campUploadCampId||selectedCamp?.id;const ok=await act({action:'upload-campaign-data',campaign_id:cId,rows:campRows},'Campaign targets and performance updated!');if(ok){setCampRows([]);setCampFileName('');}}}><Upload size={16}/> Save Targets &amp; Performance ({campRows.length} Branches)</button></>}</div>}
{isAdmin&&<div className="panel"><h2>Add a campaign</h2><p>Campaigns apply to all 56 branches. Dates are inclusive; overlapping campaigns retain separate totals.</p><div className="grid3">{[['Title','title','text'],['Start date','start','date'],['End date','end','date']].map(([l,k,t])=><label key={k}>{l}<input type={t} value={(campaign as any)[k]} onChange={e=>setCampaign({...campaign,[k]:e.target.value})}/></label>)}</div><button disabled={busy} onClick={()=>act({action:'campaign',...campaign},'Campaign created. Download a new upload template to include its columns.')}><Plus size={16}/>Create campaign</button></div>}<div className="campaigns">{data.campaigns.map((c:any)=>{const isActive=c.start<=date&&c.end>=date;const cToday=(data?.branches||[]).reduce((acc:number,b:any)=>{const s=data?.subs?.find((x:any)=>x.sol===b.sol);return acc+Number(s?.values?.['camp_'+c.id]||0);},0);const cMtd=(data?.branches||[]).reduce((acc:number,b:any)=>{const sn=data?.pub?.rows?.find((x:any)=>x.sol===b.sol);return acc+Number(sn?.['camp_'+c.id+'_mtd']||0);},0);const cCum=cMtd+cToday;const cCount=(data?.branches||[]).filter((b:any)=>{const s=data?.subs?.find((x:any)=>x.sol===b.sol);return Number(s?.values?.['camp_'+c.id]||0)>0;}).length;return <div className="panel" key={c.id}><Flag size={24}/><h2>{c.title}</h2><p>{c.start} to {c.end}</p><span className="badge">{isActive?'Active':'Outside reporting period'}</span><small>Import ID: {c.id}</small>{isActive&&<div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><div style={{display:'flex',gap:12,fontSize:12,flexWrap:'wrap'}}><span style={{color:'#16a34a',fontWeight:700}}>★ Today: +{fmt(cToday)}</span><span style={{color:'#475569'}}>MTD: {fmt(cMtd)}</span><span style={{color:'#0f172a',fontWeight:700}}>Total: {fmt(cCum)}</span><span style={{color:'#0284c7'}}>({cCount}/56 branches active)</span></div><button type="button" className="button" style={{background:'#25D366',color:'#fff',border:'none',padding:'6px 12px',borderRadius:6,fontSize:12,fontWeight:700,display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={()=>{setSelectedCampId(c.id);setCampSeqIdx(0);setShowCampModal(true);}}><MessageSquare size={13}/> WhatsApp Dispatch</button></div>}</div>;})}</div></>}
{tab==='Branch directory'&&isAdmin&&<><div className="panel"><div className="paneltop"><div><h2>Bulk upload branch directory & access</h2><p>Download the 56-branch CSV template, fill in head name, mobile, and email, then upload once to update both WhatsApp mappings and portal access.</p></div><button className="secondary" onClick={directoryTemplate}><Download size={16}/>Download 56-branch template</button></div><div className="uploadzone"><Upload size={30}/><h3>{dirFileName||'Choose branch directory CSV'}</h3><p>Columns: sol (use 3933 for Regional Office GM/Reviewers), head_name, phone (10 digits or 91+10), email (optional), role (branch/reviewer/srm). Blank rows are skipped.</p><input aria-label="Upload branch directory CSV" type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&uploadDirectory(e.target.files[0])}/></div>{dirRows.length>0&&<><div className="alert success"><CheckCircle2 size={18}/>{dirRows.length} directory entries validated and ready to apply.</div><div className="tablewrap" style={{marginBottom:14}}><table><thead><tr><th>SOL</th><th>HEAD NAME</th><th>MOBILE</th><th>EMAIL</th><th>ROLE</th></tr></thead><tbody>{dirRows.slice(0,8).map((r:any)=><tr key={r.phone}><td>{r.sol||'—'}</td><td>{r.name||'—'}</td><td>{r.phone}</td><td>{r.email||'—'}</td><td>{r.role}</td></tr>)}</tbody></table>{dirRows.length>8&&<p>First 8 of {dirRows.length} rows shown.</p>}</div></>} <button disabled={!dirRows.length||busy} onClick={async()=>{if(await act({action:'upload-directory',rows:dirRows},'Branch directory and access assignments updated.')){setDirRows([]);setDirFileName('');}}}><Upload size={16}/>Upload & apply directory{dirRows.length?' ('+dirRows.length+')':''}</button></div><div className="panel"><h2>Branch-head WhatsApp mapping</h2><p>Numbers are not inferred. Save the correct current head for each branch.</p><div className="grid3"><label>Branch<select value={contact.sol} onChange={e=>setContact({...contact,sol:e.target.value})}>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label><label>Branch head name<input value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/></label><label>WhatsApp number (91 + 10 digits)<input value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})}/></label></div><button disabled={busy} onClick={()=>act({action:'contact',...contact},'Branch-head mapping saved.')}>Save mapping</button><div className="tablewrap"><table><thead><tr><th>BRANCH</th><th>HEAD</th><th>MOBILE</th></tr></thead><tbody>{data.contacts.map((c:any)=><tr key={c.sol}><td>{c.sol} · {data.branches.find((b:any)=>b.sol===c.sol)?.name}</td><td>{c.name}</td><td>{c.phone}</td></tr>)}</tbody></table></div></div><div className="panel"><h2>Portal access assignments</h2><p>Register each mobile number with the officer’s email and role. On first login with their mobile number, that person sets their own 4-digit PIN.</p><div className="grid3"><label>Mobile number<input type="tel" inputMode="numeric" value={grant.phone} onChange={e=>setGrant({...grant,phone:e.target.value})} placeholder="10-digit mobile number"/></label><label>Officer email (optional)<input type="email" value={grant.email} onChange={e=>setGrant({...grant,email:e.target.value})}/></label><label>Role<select value={grant.role} onChange={e=>setGrant({...grant,role:e.target.value})}><option value="branch">Branch head</option><option value="reviewer">Regional reviewer</option><option value="srm">General Manager (GM)</option><option value="none">Revoke access</option></select></label>{grant.role==='branch'?<label>Branch<select value={grant.sol} onChange={e=>setGrant({...grant,sol:e.target.value})}>{data.branches.map((b:any)=><option key={b.sol} value={b.sol}>{b.sol} · {b.name}</option>)}</select></label>:(grant.role==='reviewer'||grant.role==='srm'||grant.role==='gm')&&<label>Attached Office<input value="3933 · Regional Office" disabled/></label>}</div><button disabled={busy} onClick={()=>act({action:'grant',...grant,sol:grant.role==='branch'?grant.sol:(grant.role==='reviewer'||grant.role==='srm'||grant.role==='gm')?'3933':null},'Role assignment saved.')}>Save assignment</button>{data.grants.map((g:any)=><div className="accountrow" key={g.phone}><div><b>{g.phone?.slice(2)}</b><small>{[g.name,g.email].filter(Boolean).join(' · ')||'No name/email'} · {g.role==='srm'||g.role==='gm'?'General Manager (GM)':g.role} {g.sol==='3933'?'3933 · Regional Office':g.sol||''}</small></div>{g.role!=='admin'&&<button className="secondary" disabled={busy} onClick={()=>{if(window.confirm('Reset this user’s PIN and sign them out?'))act({action:'reset-pin',phone:g.phone},'PIN reset. The user will set a new PIN on their next login.');}}>Reset PIN</button>}</div>)}</div></>}
{tab==='Message queue'&&isAdmin&&<><div className="alert neutral"><MessageSquare size={22}/><div><b>Group delivery requires a configured WhatsApp connection.</b><br/>A queued or blocked message has not been sent. Use <b>Share via WhatsApp</b> or <b>Copy message</b> below to share directly to your group or branch head.</div></div><div className="panel"><h2>Outbound messages</h2>{data.jobs.length?data.jobs.slice().reverse().map((j:any)=>{const headContact=j.sol?data.contacts.find((c:any)=>c.sol===j.sol):null;return <div className="job" key={j.key}><div className="paneltop"><b>{j.type} · {j.date}{j.sol?' · '+j.sol:''}</b><span className={'badge '+j.status}>{j.status}</span></div><pre>{j.text}</pre>{j.error&&<p className="negative">{j.error}</p>}{j.messageId&&<small>Message reference: {j.messageId}</small>}<div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}><a className="button" style={{display:'inline-flex',alignItems:'center',gap:8,background:'#25D366',color:'#fff',padding:'10px 16px',borderRadius:8,fontWeight:600,textDecoration:'none',fontSize:13}} href={'https://wa.me/?text='+encodeURIComponent(j.text)} target="_blank" rel="noopener noreferrer"><Send size={15}/>Share via WhatsApp</a>{headContact?.phone&&<a className="secondary" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8,fontWeight:600,textDecoration:'none'}} href={'https://wa.me/'+headContact.phone+'?text='+encodeURIComponent(j.text)} target="_blank" rel="noopener noreferrer"><MessageSquare size={15}/>Message {headContact.name}</a>}<button type="button" className="secondary" onClick={async()=>{await navigator.clipboard.writeText(j.text);setNotice('Message copied to clipboard.');}}>Copy message</button>{['pending','blocked'].includes(j.status)&&<button className="secondary" disabled={busy} onClick={()=>act({action:'retry',key:j.key},'Connection checked. See the updated message status.')}><RefreshCw size={15}/>Retry connection</button>}</div></div>;}):<div className="empty"><MessageSquare size={32}/><h3>No messages yet</h3><p>Publication requests and reviewer replies will appear here.</p></div>}</div></>}
{showCampModal && selectedCamp && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 16,
    }}
    onClick={() => { setShowCampModal(false); setCampSeqIdx(null); }}
  >
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 1050,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div
        style={{
          padding: '16px 22px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(37,211,102,0.3)',
            }}
          >
            <MessageSquare size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>
              WhatsApp Campaign Performance Dispatcher
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              1-click individual branch reminders & consolidated regional group message for {date}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowCampModal(false); setCampSeqIdx(null); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Modal Body */}
      <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
        {/* Campaign Selector if multiple active */}
        {active.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {active.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedCampId(c.id); setCampSeqIdx(0); }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: selectedCamp.id === c.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: selectedCamp.id === c.id ? '#f0fdf4' : '#fff',
                  color: selectedCamp.id === c.id ? '#15803d' : '#475569',
                  whiteSpace: 'nowrap',
                }}
              >
                🏆 {c.title}
              </button>
            ))}
          </div>
        )}

        {/* Selected Campaign Header & Performance Strip */}
        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#16a34a', letterSpacing: '0.05em' }}>
                Active Campaign
              </span>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                {selectedCamp.title}
              </h2>
              <small style={{ color: '#64748b' }}>Period: {selectedCamp.start} to {selectedCamp.end}</small>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                {contributingCampCount} Contributing Branches
              </span>
              <span className="badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: 700 }}>
                {submittedCampCount} / 56 Submitted Today
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>★ ADDED TODAY</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>+{fmt(totalCampToday)}</div>
              <small style={{ color: '#64748b' }}>Across 56 branches</small>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>CONFIRMED MTD</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{fmt(totalCampMtd)}</div>
              <small style={{ color: '#64748b' }}>Through yesterday</small>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', borderLeft: '4px solid #2563eb' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>CUMULATIVE TOTAL</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', marginTop: 2 }}>{fmt(totalCampCumulative)}</div>
              <small style={{ color: '#64748b' }}>MTD + Today's addition</small>
            </div>
            {totalCampTarget > 0 && (
              <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>TARGET &amp; ACHIEVEMENT</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: totalCampPct && totalCampPct >= 100 ? '#15803d' : '#b45309', marginTop: 2 }}>
                  {totalCampPct}% <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>({fmt(totalCampCumulative)} / {fmt(totalCampTarget)})</span>
                </div>
                <small style={{ color: '#64748b' }}>Regional Target: {fmt(totalCampTarget)}</small>
              </div>
            )}
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>MESSAGED SO FAR</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {sentCampBranchSols.length} / {campBranchStats.length}
              </div>
              <small style={{ color: '#64748b' }}>Individual branch heads</small>
            </div>
          </div>
        </div>

        {/* 2-Card Row: Individual Dispatcher (Left) & Regional Group Broadcast (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Card 1: 1-Click Individual Branch Dispatch Sequence */}
          <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(34,197,94,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                OPTION 1 · STEP-BY-STEP DISPATCH
              </span>
            </div>
            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              1-Click Individual Branch Reminders
            </h4>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>
              Click to open WhatsApp pre-filled with that branch's exact performance figures and review link.
            </p>

            {campSeqIdx !== null && campSeqIdx < campBranchStats.length ? (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                    Branch {campSeqIdx + 1} of {campBranchStats.length}
                  </span>
                  <span className="badge" style={{ background: sentCampBranchSols.includes(campBranchStats[campSeqIdx].branch.sol) ? '#dcfce7' : '#fee2e2', color: sentCampBranchSols.includes(campBranchStats[campSeqIdx].branch.sol) ? '#166534' : '#991b1b', fontSize: 10 }}>
                    {sentCampBranchSols.includes(campBranchStats[campSeqIdx].branch.sol) ? '✓ Messaged' : 'Pending'}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  {campBranchStats[campSeqIdx].branch.name} (SOL {campBranchStats[campSeqIdx].branch.sol})
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                  Head: <b>{campBranchStats[campSeqIdx].headName}</b> · {campBranchStats[campSeqIdx].headPhone ? `+${campBranchStats[campSeqIdx].headPhone}` : 'No phone listed'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12 }}>
                  <span style={{ color: campBranchStats[campSeqIdx].todayVal > 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                    Today: +{fmt(campBranchStats[campSeqIdx].todayVal)} {campBranchStats[campSeqIdx].todayVal > 0 ? '👏' : '⚠️'}
                  </span>
                  <span style={{ color: '#475569' }}>MTD: {fmt(campBranchStats[campSeqIdx].mtd)}</span>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Total: {fmt(campBranchStats[campSeqIdx].cumulative)}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {campBranchStats[campSeqIdx].headPhone ? (
                    <a
                      href={`https://wa.me/${campBranchStats[campSeqIdx].headPhone}?text=${encodeURIComponent(
                        getCampaignIndividualMsg(selectedCamp, campBranchStats[campSeqIdx], date)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSentCampBranchSols((prev) => Array.from(new Set([...prev, campBranchStats[campSeqIdx].branch.sol])))}
                      style={{
                        background: '#25D366',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                        justifyContent: 'center',
                      }}
                    >
                      <MessageSquare size={14} /> Send WhatsApp to Head
                    </a>
                  ) : (
                    <span style={{ color: '#991b1b', fontSize: 12, padding: '8px 0' }}>
                      No mobile number mapped for this branch
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={nextCampSeq}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Next <FastForward size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: 8, marginBottom: 14 }}>
                <p style={{ margin: 0, color: '#166534', fontWeight: 700 }}>Sequence completed or not started.</p>
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 8, fontSize: 12 }}
                  onClick={() => setCampSeqIdx(0)}
                >
                  <RotateCcw size={13} /> Start Dispatch Sequence from Branch 1
                </button>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                <span>Progress: {sentCampBranchSols.length} of {campBranchStats.length} Branches Sent</span>
                <span>{Math.round((sentCampBranchSols.length / (campBranchStats.length || 1)) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(sentCampBranchSols.length / (campBranchStats.length || 1)) * 100}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>

          {/* Card 2: Consolidated Regional BM Group Broadcast */}
          <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(37,99,235,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                OPTION 2 · INSTANT GROUP POST
              </span>
            </div>
            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              Regional WhatsApp BM Group Broadcast
            </h4>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>
              One comprehensive message with top performing branches, regional totals, and full ranking for the WhatsApp group.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(getCampaignGroupMsg(selectedCamp, campBranchStats, date))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  padding: '9px 14px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                <Send size={14} /> Share to WhatsApp Group
              </a>
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(getCampaignGroupMsg(selectedCamp, campBranchStats, date));
                  setCopiedCampGroupMsg(true);
                  setTimeout(() => setCopiedCampGroupMsg(false), 2500);
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: copiedCampGroupMsg ? '#ecfdf5' : '#fff',
                  color: copiedCampGroupMsg ? '#059669' : '#334155',
                  borderColor: copiedCampGroupMsg ? '#a7f3d0' : '#cbd5e1',
                }}
              >
                {copiedCampGroupMsg ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copiedCampGroupMsg ? 'Copied ✓' : 'Copy Message'}
              </button>
            </div>

            {/* Message Preview Box */}
            <div style={{ flex: 1, maxHeight: 180, overflowY: 'auto', background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#334155' }}>
              {getCampaignGroupMsg(selectedCamp, campBranchStats, date)}
            </div>
          </div>
        </div>

        {/* Card 3: Complete 56-Branch Interactive Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                All 56 Branches Campaign Performance & Messaging Roster
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Search, inspect individual branch performance, and send personalized reminders directly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search branch name or SOL…"
                value={campBranchSearch}
                onChange={(e) => setCampBranchSearch(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', width: 220 }}
              />
              <select
                value={campBranchFilter}
                onChange={(e) => setCampBranchFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
              >
                <option value="All">All 56 Branches</option>
                <option value="Contributed">Contributed Today (&gt;0)</option>
                <option value="NIL">NIL Today (=0)</option>
                <option value="Sent">Sent ({sentCampBranchSols.length})</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="tablewrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>STATUS</th>
                  <th>BRANCH</th>
                  <th>BRANCH HEAD</th>
                  <th style={{ textAlign: 'right' }}>TARGET</th>
                  <th style={{ textAlign: 'right' }}>ADDED TODAY</th>
                  <th style={{ textAlign: 'right' }}>CONFIRMED MTD</th>
                  <th style={{ textAlign: 'right' }}>CUMULATIVE TOTAL</th>
                  <th style={{ textAlign: 'right' }}>% ACHIEVED</th>
                  <th style={{ textAlign: 'center', width: 130 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {campBranchStats
                  .filter((b: any) => {
                    const q = campBranchSearch.toLowerCase().trim();
                    const matchesQuery = !q || b.branch.name.toLowerCase().includes(q) || b.branch.sol.includes(q) || b.headName.toLowerCase().includes(q);
                    if (!matchesQuery) return false;
                    if (campBranchFilter === 'Contributed') return b.todayVal > 0;
                    if (campBranchFilter === 'NIL') return b.todayVal === 0;
                    if (campBranchFilter === 'Sent') return sentCampBranchSols.includes(b.branch.sol);
                    if (campBranchFilter === 'Pending') return !sentCampBranchSols.includes(b.branch.sol);
                    return true;
                  })
                  .map((b: any) => {
                    const isSent = sentCampBranchSols.includes(b.branch.sol);
                    const isCopied = copiedCampBranchSol === b.branch.sol;
                    const indMsg = getCampaignIndividualMsg(selectedCamp, b, date);

                    return (
                      <tr key={b.branch.sol} style={{ background: isSent ? '#f0fdf4' : b.todayVal > 0 ? '#fff' : '#fffaf0' }}>
                        <td>
                          {isSent ? (
                            <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontSize: 10, fontWeight: 700 }}>✓ Sent</span>
                          ) : (
                            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 600 }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.branch.name}</div>
                          <small style={{ color: '#64748b' }}>SOL {b.branch.sol}</small>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{b.headName}</div>
                          <small style={{ color: '#64748b' }}>{b.headPhone ? `+${b.headPhone}` : 'No phone'}</small>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {b.target > 0 ? <b>{fmt(b.target)}</b> : <span className="muted">—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, color: b.todayVal > 0 ? '#15803d' : '#94a3b8' }}>
                            {b.todayVal > 0 ? `+${fmt(b.todayVal)}` : '0'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmt(b.mtd)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(b.cumulative)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {b.pct !== null ? (
                            <span style={{ fontWeight: 800, color: b.pct >= 100 ? '#15803d' : b.pct >= 50 ? '#b45309' : '#dc2626' }}>
                              {b.pct}%
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {b.headPhone ? (
                              <a
                                href={`https://wa.me/${b.headPhone}?text=${encodeURIComponent(indMsg)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setSentCampBranchSols((prev) => Array.from(new Set([...prev, b.branch.sol])))}
                                style={{
                                  background: '#25D366',
                                  color: '#fff',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                title="Open WhatsApp chat with branch head"
                              >
                                <MessageSquare size={12} /> WhatsApp
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>No phone</span>
                            )}
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: '5px 8px', fontSize: 11 }}
                              onClick={async () => {
                                await navigator.clipboard.writeText(indMsg);
                                setCopiedCampBranchSol(b.branch.sol);
                                setTimeout(() => setCopiedCampBranchSol(null), 2000);
                              }}
                              title="Copy personalized reminder message"
                            >
                              {isCopied ? <CheckCircle2 size={12} color="#059669" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div style={{ padding: '12px 22px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="secondary"
          onClick={() => { setSentCampBranchSols([]); setCampSeqIdx(0); }}
          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <RotateCcw size={13} /> Reset Message Tracker
        </button>
        <button
          type="button"
          className="button"
          onClick={() => { setShowCampModal(false); setCampSeqIdx(null); }}
          style={{ padding: '8px 18px', fontSize: 13 }}
        >
          Done
        </button>
      </div>
    </div>
  </div>
)}
</div><footer>Indian Overseas Bank · Dindigul regional reporting <span>All reporting times are IST</span></footer></main></div>;
}
