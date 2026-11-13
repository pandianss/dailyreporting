'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Upload,
  ChevronRight,
  Download,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  Coins,
  AlertCircle,
  Building2,
  Search,
  Filter,
  Check,
  RotateCcw,
  UserCheck,
  TrendingUp,
  Clock,
  Award,
  Printer,
  Pause,
  Play
} from 'lucide-react';
import Login from '../Login';
import { parseFundingCSV, validateFundingAccounts } from '../model.mjs';

function fmt(n: any) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('en-IN');
}

export default function FundingPortal() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [tab, setTab] = useState('Low balance accounts');
  const [sol, setSol] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [balFilter, setBalFilter] = useState('All');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'logins' | 'funded'>('all');
  const [fundingAmountInput, setFundingAmountInput] = useState<{ [id: string]: string }>({});
  const [rollNoInput, setRollNoInput] = useState<{ [id: string]: string }>({});
  const [selectedCertRoll, setSelectedCertRoll] = useState<string | null>(null);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  async function checkAuth() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const handoffToken = urlParams.get('handoff');
      if (handoffToken) {
        const hr = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'handoff-login', token: handoffToken }),
        });
        const hj: any = await hr.json();
        if (hr.ok && hj.ok) {
          window.history.replaceState({}, '', window.location.pathname);
          setAuthed(true);
          load();
          return;
        }
      }

      const r = await fetch('/api/auth', { cache: 'no-store' });
      const j: any = await r.json();
      const isAuthed = Boolean(j.user || j.authenticated);
      setAuthed(isAuthed);
      if (isAuthed) load();
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function load(isSilent = false) {
    if (!isSilent) {
      setBusy(true);
      setError('');
    }
    try {
      const r = await fetch('/api/portal?date=' + date + '&_t=' + Date.now(), { cache: 'no-store' });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      if (j.user.role === 'branch') {
        setSol(j.user.sol);
        setTab((curr) => curr === 'Branch summary' ? 'Low balance accounts' : curr);
      } else if (!sol && j.branches.length) {
        setSol(j.branches[0].sol);
      }
    } catch (e: any) {
      if (!isSilent) setError(e.message);
    } finally {
      if (!isSilent) setBusy(false);
    }
  }

  useEffect(() => {
    if (authed) load();
  }, [date, authed]);

  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load(true);
      }
    }, 8000);
    const onFocus = () => load(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [date, authed]);

  async function act(body: any, okMsg: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, date }),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setNotice(okMsg);
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function updateFundingStatus(accountSol: string, accountId: string, updates: any, msg: string) {
    await act(
      {
        action: 'funding-status',
        sol: accountSol,
        id: accountId,
        ...updates,
      },
      msg
    );
  }

  async function switchPortal(target: 'daily' | 'sma' | 'funding') {
    setBusy(true);
    try {
      const r = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handoff' }),
      });
      const j: any = await r.json();
      if (!r.ok || !j.token) throw new Error(j.error || 'Unable to generate handover token');

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      let targetBase = '';
      if (isLocal) {
        targetBase = target === 'daily' ? window.location.origin : `${window.location.origin}/${target}`;
      } else {
        targetBase =
          target === 'daily'
            ? 'https://dailyreport-9265a.web.app'
            : target === 'sma'
              ? 'https://dailyreport-sma-9265a.web.app'
              : 'https://dailyreport-funding-9265a.web.app';
      }
      window.location.href = `${targetBase}/?handoff=${encodeURIComponent(j.token)}&date=${date}`;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function handleCsvUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const text = await file.text();
      const rawRows = parseFundingCSV(text);
      const validated = validateFundingAccounts(rawRows, data.branches);
      await act(
        { action: 'upload-funding', rows: validated },
        `Successfully imported ${validated.length} low-balance accounts across branches.`
      );
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv(name: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  }

  function downloadTemplate() {
    const header = 'branch_code,account_no,cif,customer_name,mobile,last_known_balance,scheme,opened_date\n';
    const sample = '0174,01740100001234,CIF123456,Sivasubramanian P,9842100000,25.00,SB,' + date + '\n';
    downloadCsv('IOB_low_balance_funding_template.csv', header + sample);
  }

  if (authed === false) {
    return (
      <Login
        onSuccess={() => setAuthed(true)}
        portalName="Low Balance Funding Portal"
        portalTag="CASA ACTIVATION · ZERO & LOW BALANCE ACCOUNT FUNDING"
      />
    );
  }

  if (!data) {
    return (
      <main className="loading">
        <img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg" />
        <h1>Low Balance Funding Portal</h1>
        <p>{error || 'Connecting to regional database…'}</p>
        {error && <button onClick={() => load()}>Try again</button>}
      </main>
    );
  }

  const isAdmin = data.user.role === 'admin';
  const isGm = data.user.role === 'srm' || data.user.role === 'gm';
  const isReviewer = data.user.role === 'reviewer' || isGm;
  const isBranch = data.user.role === 'branch';

  const currentBranch = data.branches.find((b: any) => b.sol === sol);
  const headContact = data.contacts?.find((c: any) => c.sol === sol);

  const allAccounts: any[] = data.fundingAccounts || [];
  const branchAccounts: any[] = isBranch
    ? allAccounts
    : sol
      ? allAccounts.filter((r: any) => r.sol === sol)
      : allAccounts;

  // Metrics
  const totalCount = branchAccounts.length;
  const fundedAccounts = branchAccounts.filter((a) => a.funded);
  const fundedCount = fundedAccounts.length;
  const fundedTotalAmount = fundedAccounts.reduce((acc, a) => acc + Number(a.funded_amount || 0), 0);
  const pendingAccounts = branchAccounts.filter((a) => !a.funded);
  const pendingCount = pendingAccounts.length;
  const pendingBalanceTotal = pendingAccounts.reduce((acc, a) => acc + Number(a.last_known_balance || 0), 0);
  const calledCount = branchAccounts.filter((a) => a.call_status && a.call_status !== 'not_called').length;
  const promisedCount = branchAccounts.filter((a) => a.call_status === 'promised').length;

  // Filter accounts
  const filteredAccounts = branchAccounts.filter((a: any) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (a.customer_name || '').toLowerCase().includes(q) ||
      (a.account_no || '').toLowerCase().includes(q) ||
      (a.cif || '').toLowerCase().includes(q) ||
      (a.mobile || '').includes(q);

    let matchesFilter = true;
    if (filter === 'Pending') matchesFilter = !a.funded;
    else if (filter === 'Funded') matchesFilter = a.funded;
    else if (filter === 'Promised') matchesFilter = a.call_status === 'promised';
    else if (filter === 'Called') matchesFilter = a.call_status && a.call_status !== 'not_called';
    else if (filter === 'Not called') matchesFilter = !a.call_status || a.call_status === 'not_called';

    let matchesBal = true;
    const b = Number(a.last_known_balance || 0);
    if (balFilter === 'Zero balance') matchesBal = b === 0;
    else if (balFilter === '< ₹500') matchesBal = b < 500;
    else if (balFilter === '< ₹1,000') matchesBal = b < 1000;
    else if (balFilter === '≥ ₹1,000') matchesBal = b >= 1000;

    return matchesSearch && matchesFilter && matchesBal;
  });

  const visibleAccounts = showAll ? filteredAccounts : filteredAccounts.slice(0, 20);

  function exportCsv() {
    const rows = [
      ['SOL', 'Branch', 'Account No', 'CIF', 'Customer Name', 'Mobile', 'Scheme', 'Last Known Balance', 'Funded Status', 'Funded Amount', 'Call Status', 'Notes', 'Funded By', 'Funded At'],
      ...filteredAccounts.map((a: any) => {
        const b = data.branches.find((x: any) => x.sol === a.sol);
        return [
          a.sol,
          `"${(b?.name || a.sol).replace(/"/g, '""')}"`,
          `"${a.account_no}"`,
          `"${a.cif || ''}"`,
          `"${(a.customer_name || '').replace(/"/g, '""')}"`,
          a.mobile || '',
          a.scheme || 'SB',
          a.last_known_balance || 0,
          a.funded ? 'Funded' : 'Pending',
          a.funded_amount || 0,
          a.call_status || 'not_called',
          `"${(a.notes || '').replace(/"/g, '""')}"`,
          a.funded_by || '',
          a.funded_at || '',
        ];
      }),
    ];
    downloadCsv(`IOB_Low_Balance_Funding_${date}.csv`, rows.map((r) => r.join(',')).join('\n'));
  }

  const logins: any[] = data.logins || [];
  const branchLogins = logins.filter((l: any) => l.role === 'branch');
  const loggedInSols = new Set(branchLogins.map((l: any) => l.sol));

  // Branch Summary Metrics with sorting: 1. Logged in today at top, 2. Reduction in accounts due (funded accounts)
  const branchSummaryMetrics = (data.branches || []).map((b: any) => {
    const branchList = allAccounts.filter((a: any) => a.sol === b.sol);
    const fList = branchList.filter((a: any) => a.funded);
    const pList = branchList.filter((a: any) => !a.funded);
    const cCount = branchList.filter((a: any) => a.call_status && a.call_status !== 'not_called').length;
    const fAmt = fList.reduce((acc, a) => acc + Number(a.funded_amount || 0), 0);
    const pct = branchList.length ? Math.round((cCount / branchList.length) * 100) : 0;
    const isLoggedIn = loggedInSols.has(b.sol);

    return {
      branch: b,
      isLoggedIn,
      branchList,
      fList,
      pList,
      cCount,
      fAmt,
      pct,
      reduction: fList.length,
    };
  }).sort((a: any, b: any) => {
    // 1. Those who have logged in today at the top
    if (a.isLoggedIn !== b.isLoggedIn) return a.isLoggedIn ? -1 : 1;
    // 2. Further sorted by reduction in accounts due (highest funded/reduced at top)
    if (b.reduction !== a.reduction) return b.reduction - a.reduction;
    // 3. Funds mobilized
    if (b.fAmt !== a.fAmt) return b.fAmt - a.fAmt;
    return a.branch.sol.localeCompare(b.branch.sol);
  });

  // Roll No Aggregations for Appreciation Certificate
  const rollStatsMap = new Map<string, { rollNo: string; count: number; fundedCount: number; amount: number; sols: Set<string> }>();
  for (const a of branchAccounts) {
    const roll = (a.roll_no || '').trim();
    if (!roll) continue;
    let stat = rollStatsMap.get(roll);
    if (!stat) {
      stat = { rollNo: roll, count: 0, fundedCount: 0, amount: 0, sols: new Set<string>() };
      rollStatsMap.set(roll, stat);
    }
    stat.count++;
    if (a.funded) {
      stat.fundedCount++;
      stat.amount += Number(a.funded_amount || 0);
    }
    if (a.sol) stat.sols.add(a.sol);
  }
  const rollLeaderboard = Array.from(rollStatsMap.values()).sort(
    (a, b) => b.fundedCount - a.fundedCount || b.amount - a.amount
  );

  // Chronological Activity Feed for branches that logged in or funded accounts
  const activityFeed: Array<{
    id: string;
    sol: string;
    branchName: string;
    type: 'login' | 'fund' | 'standby';
    detailText: string;
    icon: string;
    time: string;
    timeStr: string;
  }> = [];

  for (const l of branchLogins) {
    const b = data.branches.find((x: any) => x.sol === l.sol);
    const timeStr = l.lastActive
      ? new Date(l.lastActive).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
      : '';
    activityFeed.push({
      id: `login-${l.phone}`,
      sol: l.sol,
      branchName: b?.name || l.sol,
      type: 'login',
      detailText: `Branch Head ${l.name || l.phone?.slice(2)} logged in`,
      icon: '🟢',
      time: l.lastActive || '',
      timeStr,
    });
  }

  for (const a of allAccounts) {
    if (a.funded) {
      const b = data.branches.find((x: any) => x.sol === a.sol);
      const timeStr = a.funded_at
        ? new Date(a.funded_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        : '';
      activityFeed.push({
        id: `fund-${a.id}`,
        sol: a.sol,
        branchName: b?.name || a.sol,
        type: 'fund',
        detailText: `Funded ₹${fmt(a.funded_amount)} for ${a.customer_name}${a.roll_no ? ' (Roll: ' + a.roll_no + ')' : ''}`,
        icon: '💰',
        time: a.funded_at || '',
        timeStr,
      });
    }
  }

  activityFeed.sort((a, b) => b.time.localeCompare(a.time));

  const filteredFeed = activityFeed.filter((item) => {
    if (activityFilter === 'logins') return item.type === 'login';
    if (activityFilter === 'funded') return item.type === 'fund';
    return true;
  });

  const displayFeed = activityExpanded ? filteredFeed : filteredFeed.slice(0, 4);

  return (
    <div className={'shell role-' + data.user.role}>
      <aside>
        <div className="brand">
          <img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo" />
          <div>
            Indian Overseas Bank
            <small>DINDIGUL REGION</small>
          </div>
        </div>

        <div className="navlabel">ACCOUNT FUNDING DESK</div>
        <nav>
          <button
            className={tab === 'Low balance accounts' ? 'selected' : ''}
            onClick={() => {
              setTab('Low balance accounts');
              setNotice('');
            }}
          >
            <Coins size={18} />
            Low balance accounts
          </button>
          {!isBranch && (
            <button
              className={tab === 'Branch summary' ? 'selected' : ''}
              onClick={() => {
                setTab('Branch summary');
                setNotice('');
              }}
            >
              <LayoutDashboard size={18} />
              Branch summary
            </button>
          )}
          <button
            className={tab === 'Appreciation & Certificates' ? 'selected' : ''}
            onClick={() => {
              setTab('Appreciation & Certificates');
              setSelectedCertRoll(null);
              setNotice('');
            }}
          >
            <Award size={18} />
            Appreciation &amp; Certificates
          </button>
          {isAdmin && (
            <button
              className={tab === 'Upload data' ? 'selected' : ''}
              onClick={() => {
                setTab('Upload data');
                setNotice('');
              }}
            >
              <Upload size={18} />
              Upload accounts
            </button>
          )}
        </nav>

        <div className="sidebottom">
          <span className="avatar">
            {(data.user.name || data.user.email || data.user.phone?.slice(2) || 'U')[0].toUpperCase()}
          </span>
          <div>
            {data.user.role === 'admin'
              ? 'Regional administrator'
              : isGm
                ? 'General Manager (GM)'
                : data.user.role === 'branch'
                  ? 'Branch head'
                  : 'Reviewer'}
            <small>{data.user.phone?.slice(2)}</small>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div className="crumb">
            Dindigul region <ChevronRight size={14} /> Low Balance Funding <ChevronRight size={14} /> {tab}
          </div>
          <div className="headeractions">
            <span
              title="Real-time live sync every 8 seconds"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: '#059669',
                fontWeight: 700,
                background: '#ecfdf5',
                padding: '4px 8px',
                borderRadius: 20,
                border: '1px solid #a7f3d0',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Live Sync
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => switchPortal('daily')}
              title="Daily Performance Reporting Portal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#1d4ed8',
                borderColor: '#bfdbfe',
                background: '#eff6ff',
              }}
            >
              Daily Performance <ExternalLink size={13} />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => switchPortal('sma')}
              title="SMA Follow-up Portal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#b91c1c',
                borderColor: '#fecaca',
                background: '#fef2f2',
              }}
            >
              SMA Follow-up <ExternalLink size={13} />
            </button>
            <span className={'private ' + (isGm ? 'srm-tag' : '')}>
              {data.user.role === 'branch'
                ? 'Branch head'
                : data.user.role === 'reviewer'
                  ? 'Reviewer'
                  : isGm
                    ? 'General Manager (GM)'
                    : 'Admin'}
            </span>
            <button
              className="textbutton"
              onClick={async () => {
                await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'logout' }),
                });
                setAuthed(false);
              }}
            >
              Sign out
            </button>
            <button className="icon" onClick={() => load()} aria-label="Refresh">
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <div className="content">
          <div className="title">
            <div>
              <div className="eyebrow" style={{ color: '#0284c7' }}>
                CASA MOBILIZATION & ACTIVATION
              </div>
              <h1>{isBranch ? 'Funding of Low Balance Accounts' : tab}</h1>
              <p>
                Follow up with account holders having low or zero balances. Call directly via dialer, send WhatsApp
                reminders, and track funded accounts to boost branch CASA.
              </p>
            </div>
            <label className="date">
              As on date
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          </div>

          {/* CHRONOLOGICAL REGIONAL LIVE ACTIVITY FEED */}
          <div
            className="no-print"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header bar */}
            <div
              style={{
                background: '#0d2344',
                color: '#ffffff',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)',
                  }}
                />
                <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  Regional CASA Funding Live Activity Feed
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    color: '#e2e8f0',
                  }}
                >
                  {activityFeed.length} updates today
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('all')}
                    style={{
                      background: activityFilter === 'all' ? '#ffffff' : 'transparent',
                      color: activityFilter === 'all' ? '#0d2344' : '#cbd5e1',
                      border: 0,
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      minHeight: 'auto',
                    }}
                  >
                    All ({activityFeed.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('logins')}
                    style={{
                      background: activityFilter === 'logins' ? '#ffffff' : 'transparent',
                      color: activityFilter === 'logins' ? '#0d2344' : '#cbd5e1',
                      border: 0,
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      minHeight: 'auto',
                    }}
                  >
                    🟢 Logins ({activityFeed.filter((i) => i.type === 'login').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('funded')}
                    style={{
                      background: activityFilter === 'funded' ? '#ffffff' : 'transparent',
                      color: activityFilter === 'funded' ? '#0d2344' : '#cbd5e1',
                      border: 0,
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      minHeight: 'auto',
                    }}
                  >
                    💰 Funded ({activityFeed.filter((i) => i.type === 'fund').length})
                  </button>
                </div>

                {filteredFeed.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setActivityExpanded(!activityExpanded)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      minHeight: 'auto',
                    }}
                  >
                    {activityExpanded ? '▲ Show Recent (4)' : `▼ View Full Feed (${filteredFeed.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div>
              {displayFeed.length ? (
                displayFeed.map((item, idx) => {
                  const isLogin = item.type === 'login';
                  const isFund = item.type === 'fund';
                  return (
                    <div
                      key={item.id + idx}
                      style={{
                        padding: '11px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderBottom: idx === displayFeed.length - 1 ? 'none' : '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fcfdfe',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isLogin ? '#047857' : isFund ? '#b45309' : '#64748b',
                            background: isLogin ? '#ecfdf5' : isFund ? '#fefce8' : '#f1f5f9',
                            border: isLogin ? '1px solid #a7f3d0' : isFund ? '1px solid #fef08a' : '1px solid #e2e8f0',
                            padding: '3px 8px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{item.icon}</span>
                          <span>{item.timeStr || 'Today'}</span>
                        </span>

                        <div style={{ fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <b style={{ color: '#0f172a' }}>{item.branchName}</b>
                          <span style={{ color: '#64748b', fontSize: 12, marginLeft: 6 }}>({item.sol})</span>
                          <span style={{ margin: '0 8px', color: '#cbd5e1' }}>•</span>
                          <span style={{ color: isFund ? '#047857' : '#334155', fontWeight: isFund ? 600 : 500 }}>
                            {item.detailText}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setSol(item.sol);
                          setTab('Low balance accounts');
                        }}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontWeight: 600,
                          color: '#1d4ed8',
                          borderColor: '#bfdbfe',
                          background: '#eff6ff',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          minHeight: 'auto',
                        }}
                        title={`Open ${item.branchName} (${item.sol}) accounts`}
                      >
                        Open Branch →
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px 20px', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                  No {activityFilter === 'logins' ? 'logins' : activityFilter === 'funded' ? 'accounts funded' : 'activity'} recorded today yet.
                </div>
              )}
            </div>
          </div>

          {error && <div className="alert error" role="alert">{error}</div>}
          {notice && <div className="alert success" role="status">{notice}</div>}

          {/* Quick Metrics */}
          <div className="stats">
            <div>
              <span>Total Low Balance Accounts</span>
              <strong>{fmt(totalCount)}</strong>
              <small>{fmt(pendingCount)} pending · {fmt(fundedCount)} funded</small>
            </div>
            <div>
              <span>Fresh Funds Mobilized</span>
              <strong style={{ color: '#059669' }}>₹{fmt(fundedTotalAmount)}</strong>
              <small>{fundedCount} accounts funded</small>
            </div>
            <div>
              <span>Pending Low Balance</span>
              <strong style={{ color: '#dc2626' }}>₹{fmt(pendingBalanceTotal)}</strong>
              <small>Last known balance across {pendingCount} accounts</small>
            </div>
            <div>
              <span>Customer Follow-up Progress</span>
              <strong style={{ color: '#0284c7' }}>
                {totalCount ? Math.round((calledCount / totalCount) * 100) : 0}%
              </strong>
              <small>{calledCount} contacted · {promisedCount} promised</small>
            </div>
          </div>

          {tab === 'Low balance accounts' && (
            <>
              {/* Branch Selector (if admin/reviewer/srm) */}
              {!isBranch && (
                <div className="panel branchpicker">
                  <label>
                    Select Branch
                    <select value={sol} onChange={(e) => setSol(e.target.value)}>
                      <option value="">All 56 Branches (Region Overview)</option>
                      {data.branches.map((b: any) => (
                        <option key={b.sol} value={b.sol}>
                          {b.sol} · {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {/* Main Accounts Card */}
              <div className="panel">
                <div className="paneltop">
                  <div>
                    <h2>
                      {isBranch
                        ? `${currentBranch?.name || 'Branch'} · SOL ${sol}`
                        : sol
                          ? `${currentBranch?.name || 'Branch'} · SOL ${sol}`
                          : 'All Branches · Dindigul Region'}
                    </h2>
                    <p>
                      Accounts requiring initial or replenishment funding. Click <b>Call</b> to dial immediately from
                      your phone.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="secondary" onClick={exportCsv}>
                      <Download size={16} /> Export CSV
                    </button>
                    {isAdmin && (
                      <button type="button" className="button" onClick={() => setTab('Upload data')}>
                        <Upload size={16} /> Upload accounts
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters & Search */}
                <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <input
                    placeholder="Search name, account no, CIF or mobile…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ minWidth: 260 }}
                  />
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="All">All statuses</option>
                    <option value="Pending">Pending funding</option>
                    <option value="Funded">Funded</option>
                    <option value="Promised">Promised to fund</option>
                    <option value="Called">Called / In progress</option>
                    <option value="Not called">Not yet called</option>
                  </select>
                  <select value={balFilter} onChange={(e) => setBalFilter(e.target.value)}>
                    <option value="All">All balances</option>
                    <option value="Zero balance">Zero balance (₹0)</option>
                    <option value="< ₹500">Balance &lt; ₹500</option>
                    <option value="< ₹1,000">Balance &lt; ₹1,000</option>
                    <option value="≥ ₹1,000">Balance ≥ ₹1,000</option>
                  </select>
                </div>

                {/* Account List Table */}
                {branchAccounts.length > 0 ? (
                  <>
                    <div className="tablewrap branchlist">
                      <table>
                        <thead>
                          <tr>
                            <th>CUSTOMER &amp; ACCOUNT</th>
                            <th>LAST KNOWN BALANCE</th>
                            <th>PHONE / DIALER</th>
                            <th>CALL STATUS</th>
                            <th>FUNDING STATUS</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAccounts.map((a: any) => {
                            const formattedPhone =
                              a.mobile && a.mobile.length === 12 && a.mobile.startsWith('91')
                                ? a.mobile.slice(2)
                                : a.mobile;
                            const telUri = `tel:${a.mobile ? (a.mobile.startsWith('91') ? '+' + a.mobile : a.mobile) : ''}`;
                            const waText = encodeURIComponent(
                              `Dear ${a.customer_name}, Greetings from Indian Overseas Bank, ${currentBranch?.name || 'Branch'}. Kindly fund your ${a.scheme || 'SB'} account ending in ${a.account_no.slice(-4)} with the required minimum balance to keep all your banking and digital services active. Thank you!`
                            );

                            return (
                              <tr
                                key={a.id}
                                style={{
                                  background: a.funded ? '#f0fdf4' : '#ffffff',
                                }}
                              >
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <b>{a.customer_name}</b>
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: 10,
                                        padding: '1px 5px',
                                        background: a.scheme === 'CD' ? '#e0e7ff' : '#f1f5f9',
                                        color: a.scheme === 'CD' ? '#3730a3' : '#334155',
                                      }}
                                    >
                                      {a.scheme || 'SB'}
                                    </span>
                                  </div>
                                  <small>
                                    A/C: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.account_no}</span>
                                    {a.cif ? ` · CIF: ${a.cif}` : ''}
                                    {!isBranch && !sol && ` · SOL ${a.sol}`}
                                  </small>
                                  {a.roll_no && (
                                    <div>
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#fef3c7',
                                          color: '#92400e',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          marginTop: 3,
                                          display: 'inline-block',
                                        }}
                                      >
                                        🏅 Roll: {a.roll_no}
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td data-label="Last Balance">
                                  <b
                                    style={{
                                      color:
                                        Number(a.last_known_balance) === 0
                                          ? '#dc2626'
                                          : Number(a.last_known_balance) < 500
                                            ? '#d97706'
                                            : '#2563eb',
                                    }}
                                  >
                                    ₹{fmt(a.last_known_balance)}
                                  </b>
                                  <small>{Number(a.last_known_balance) === 0 ? 'Zero balance' : 'Low balance'}</small>
                                </td>

                                <td data-label="Phone / Dialer">
                                  {a.mobile ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      <a
                                        href={telUri}
                                        className="button"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          fontSize: 12,
                                          padding: '5px 10px',
                                          background: '#0284c7',
                                          color: '#fff',
                                          textDecoration: 'none',
                                          borderRadius: 6,
                                          width: 'fit-content',
                                        }}
                                        title="Click to dial customer directly from your phone or device"
                                        onClick={() => {
                                          if (!a.call_status || a.call_status === 'not_called') {
                                            updateFundingStatus(
                                              a.sol,
                                              a.id,
                                              { call_status: 'called' },
                                              'Call initiated · status updated.'
                                            );
                                          }
                                        }}
                                      >
                                        <PhoneCall size={14} /> Call {formattedPhone}
                                      </a>
                                      <a
                                        href={`https://wa.me/${a.mobile}?text=${waText}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          fontSize: 11,
                                          color: '#059669',
                                          textDecoration: 'none',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <MessageSquare size={13} /> WhatsApp reminder
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="muted">No mobile</span>
                                  )}
                                </td>

                                <td data-label="Call Status">
                                  <select
                                    value={a.call_status || 'not_called'}
                                    disabled={busy}
                                    onChange={(e) =>
                                      updateFundingStatus(
                                        a.sol,
                                        a.id,
                                        { call_status: e.target.value },
                                        'Call status updated.'
                                      )
                                    }
                                    style={{
                                      fontSize: 12,
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      borderColor:
                                        a.call_status === 'promised'
                                          ? '#10b981'
                                          : a.call_status === 'called'
                                            ? '#3b82f6'
                                            : '#cbd5e1',
                                    }}
                                  >
                                    <option value="not_called">Not called</option>
                                    <option value="called">Called · In follow-up</option>
                                    <option value="promised">Promised to fund</option>
                                    <option value="ringing">Ringing / No response</option>
                                    <option value="wrong_number">Wrong / Invalid number</option>
                                  </select>
                                  {a.notes && <small style={{ display: 'block', marginTop: 3 }}>{a.notes}</small>}
                                </td>

                                <td data-label="Funding Status">
                                  {a.funded ? (
                                    <div>
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#dcfce7',
                                          color: '#166534',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                        }}
                                      >
                                        <Check size={12} /> Funded ₹{fmt(a.funded_amount)}
                                      </span>
                                      {a.funded_by && <small>By {a.funded_by}{a.roll_no ? ` (${a.roll_no})` : ''}</small>}
                                    </div>
                                  ) : (
                                    <span
                                      className="badge"
                                      style={{
                                        background: '#fee2e2',
                                        color: '#991b1b',
                                      }}
                                    >
                                      Pending
                                    </span>
                                  )}
                                </td>

                                <td>
                                  {a.funded ? (
                                    <button
                                      type="button"
                                      className="secondary"
                                      disabled={busy}
                                      style={{ fontSize: 11, padding: '4px 8px' }}
                                      onClick={() =>
                                        updateFundingStatus(
                                          a.sol,
                                          a.id,
                                          { funded: false, funded_amount: 0 },
                                          'Funding status reverted to pending.'
                                        )
                                      }
                                    >
                                      <RotateCcw size={12} /> Undo
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <input
                                          type="number"
                                          placeholder="₹ amt"
                                          style={{ width: 75, fontSize: 12, padding: '4px 6px' }}
                                          value={fundingAmountInput[a.id] ?? ''}
                                          onChange={(e) =>
                                            setFundingAmountInput({
                                              ...fundingAmountInput,
                                              [a.id]: e.target.value,
                                            })
                                          }
                                        />
                                        <input
                                          type="text"
                                          placeholder="Roll No"
                                          title="Staff roll number for certificate tracking"
                                          style={{ width: 75, fontSize: 12, padding: '4px 6px' }}
                                          value={
                                            rollNoInput[a.id] !== undefined
                                              ? rollNoInput[a.id]
                                              : (typeof window !== 'undefined'
                                                  ? localStorage.getItem('iob_staff_roll_no') || a.roll_no || ''
                                                  : a.roll_no || '')
                                          }
                                          onChange={(e) =>
                                            setRollNoInput({
                                              ...rollNoInput,
                                              [a.id]: e.target.value,
                                            })
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="button"
                                          disabled={busy}
                                          style={{
                                            fontSize: 12,
                                            padding: '5px 10px',
                                            background: '#059669',
                                            color: '#fff',
                                            whiteSpace: 'nowrap',
                                          }}
                                          onClick={() => {
                                            const entered = Number(fundingAmountInput[a.id] || 500);
                                            const roll = (
                                              rollNoInput[a.id] !== undefined
                                                ? rollNoInput[a.id]
                                                : (typeof window !== 'undefined'
                                                    ? localStorage.getItem('iob_staff_roll_no') || a.roll_no || ''
                                                    : a.roll_no || '')
                                            ).trim();
                                            if (roll && typeof window !== 'undefined') {
                                              localStorage.setItem('iob_staff_roll_no', roll);
                                            }
                                            updateFundingStatus(
                                              a.sol,
                                              a.id,
                                              { funded: true, funded_amount: entered, roll_no: roll },
                                              `✓ Account marked funded with ₹${fmt(entered)}! Recorded for Roll No ${roll || 'Staff'}.`
                                            );
                                          }}
                                        >
                                          Mark Funded
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {filteredAccounts.length > 20 && (
                      <button
                        type="button"
                        className="secondary"
                        style={{ marginTop: 12, width: '100%' }}
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll
                          ? 'Show fewer accounts'
                          : `Show all ${filteredAccounts.length} accounts (${filteredAccounts.length - 20} more)`}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Coins size={36} style={{ margin: '0 auto 12px auto', color: '#94a3b8' }} />
                    <h3>No low-balance accounts found</h3>
                    <p>
                      {isAdmin
                        ? 'Upload a CSV of low-balance accounts using the "Upload accounts" tab to populate this portal.'
                        : 'No low-balance accounts have been uploaded for your branch yet.'}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        className="button"
                        style={{ marginTop: 12 }}
                        onClick={() => setTab('Upload data')}
                      >
                        <Upload size={16} /> Upload accounts now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Regional Summary Tab */}
          {tab === 'Branch summary' && !isBranch && (
            <div className="panel">
              <div className="paneltop">
                <div>
                  <h2>Branch-wise Low Balance Funding Summary</h2>
                  <p>Regional overview of low balance accounts, call progress, and funding rate.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    className="badge"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '5px 10px',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    Ranked: Logged in today first · Sorted by reduction in accounts due
                  </span>
                  <button type="button" className="secondary" onClick={exportCsv}>
                    <Download size={16} /> Export Region Summary
                  </button>
                </div>
              </div>

              <div className="tablewrap branchlist">
                <table>
                  <thead>
                    <tr>
                      <th>BRANCH</th>
                      <th>TOTAL LOW BAL</th>
                      <th>PENDING</th>
                      <th>FUNDED ACCTS (REDUCTION)</th>
                      <th>FUNDS MOBILIZED</th>
                      <th>CALLED %</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {branchSummaryMetrics.map((m: any) => {
                      return (
                        <tr key={m.branch.sol} style={{ background: m.isLoggedIn ? '#fcfdfd' : '#fff' }}>
                          <td>
                            <b>{m.branch.name}</b>
                            <small>SOL {m.branch.sol}</small>
                            <div>
                              {m.isLoggedIn ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    marginTop: 3,
                                  }}
                                >
                                  <CheckCircle2 size={11} /> Logged in today
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fef2f2',
                                    color: '#991b1b',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    marginTop: 3,
                                  }}
                                >
                                  Pending login
                                </span>
                              )}
                            </div>
                          </td>
                          <td data-label="Total">{m.branchList.length}</td>
                          <td data-label="Pending">
                            <span style={{ color: m.pList.length > 0 ? '#dc2626' : '#166534', fontWeight: 600 }}>
                              {m.pList.length}
                            </span>
                          </td>
                          <td data-label="Funded">
                            <span style={{ color: '#059669', fontWeight: 700 }}>{m.fList.length}</span>
                            {m.reduction > 0 && (
                              <small style={{ display: 'block', color: '#1e40af', fontWeight: 700 }}>
                                ↓ {m.reduction} funded
                              </small>
                            )}
                          </td>
                          <td data-label="Mobilized">
                            <b>₹{fmt(m.fAmt)}</b>
                          </td>
                          <td data-label="Called %">
                            <span>{m.pct}%</span>
                            <small>{m.cCount} of {m.branchList.length}</small>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="textbutton"
                              onClick={() => {
                                setSol(m.branch.sol);
                                setTab('Low balance accounts');
                              }}
                            >
                              Open <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: APPRECIATION & CERTIFICATES */}
          {tab === 'Appreciation & Certificates' && (
            <div className="panel">
              {selectedCertRoll ? (
                <CertificateView
                  category="funding"
                  rollNo={selectedCertRoll}
                  branchName={
                    data.branches.find((b: any) =>
                      rollStatsMap.get(selectedCertRoll)?.sols.has(b.sol)
                    )?.name || ''
                  }
                  sol={Array.from(rollStatsMap.get(selectedCertRoll)?.sols || []).join(', ')}
                  count={rollStatsMap.get(selectedCertRoll)?.fundedCount || 0}
                  amount={rollStatsMap.get(selectedCertRoll)?.amount || 0}
                  date={date}
                  onClose={() => setSelectedCertRoll(null)}
                />
              ) : (
                <>
                  <div className="paneltop">
                    <div>
                      <h2>🏅 Staff Appreciation &amp; Certificate Leaderboard</h2>
                      <p>
                        Staff officers mobilizing and funding low balance accounts qualify for official Certificates of Appreciation
                        conferred by the General Manager (GM), Dindigul Regional Office.
                      </p>
                    </div>
                  </div>

                  <div className="stats" style={{ marginBottom: 20 }}>
                    <div>
                      <span>Staff Members Active</span>
                      <strong style={{ color: '#0284c7' }}>{rollLeaderboard.length}</strong>
                      <small>Followed up with Roll No</small>
                    </div>
                    <div>
                      <span>Accounts Funded</span>
                      <strong style={{ color: '#059669' }}>
                        {rollLeaderboard.reduce((acc, s) => acc + s.fundedCount, 0)}
                      </strong>
                      <small>CASA accounts activated</small>
                    </div>
                    <div>
                      <span>Total Funds Mobilized</span>
                      <strong style={{ color: '#059669' }}>
                        ₹{fmt(rollLeaderboard.reduce((acc, s) => acc + s.amount, 0))}
                      </strong>
                      <small>Deposited & regularized</small>
                    </div>
                  </div>

                  {rollLeaderboard.length ? (
                    <div className="tablewrap branchlist">
                      <table>
                        <thead>
                          <tr>
                            <th>RANK</th>
                            <th>STAFF ROLL NO</th>
                            <th>BRANCH (SOL)</th>
                            <th>ACCOUNTS FOLLOWED</th>
                            <th>ACCOUNTS FUNDED</th>
                            <th>TOTAL MOBILIZED</th>
                            <th>SUCCESS RATE</th>
                            <th>CERTIFICATE OF APPRECIATION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rollLeaderboard.map((stat, idx) => {
                            const pct = stat.count ? Math.round((stat.fundedCount / stat.count) * 100) : 0;
                            const branchSol = Array.from(stat.sols)[0] || '';
                            const branchName = data.branches.find((b: any) => b.sol === branchSol)?.name || '';

                            return (
                              <tr key={stat.rollNo}>
                                <td>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      color: idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : idx === 2 ? '#b45309' : '#334155',
                                      fontSize: 14,
                                    }}
                                  >
                                    #{idx + 1}
                                  </span>
                                </td>
                                <td data-label="Staff Roll No">
                                  <b style={{ color: '#0284c7', fontSize: 14 }}>{stat.rollNo}</b>
                                </td>
                                <td data-label="Branch">
                                  <b>{branchName || 'Regional Staff'}</b>
                                  <small>SOL {branchSol}</small>
                                </td>
                                <td data-label="Followed">
                                  <b>{stat.count} accounts</b>
                                </td>
                                <td data-label="Funded">
                                  <b style={{ color: '#059669' }}>{stat.fundedCount} accounts</b>
                                </td>
                                <td data-label="Total Mobilized">
                                  <b style={{ color: '#059669' }}>₹{fmt(stat.amount)}</b>
                                </td>
                                <td data-label="Success Rate">
                                  <span className={'badge ' + (pct >= 50 ? 'reviewed' : 'pending')}>
                                    {pct}%
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="button"
                                    style={{
                                      fontSize: 12,
                                      padding: '6px 12px',
                                      background: '#0284c7',
                                      color: '#fff',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                    }}
                                    onClick={() => setSelectedCertRoll(stat.rollNo)}
                                  >
                                    <Award size={14} /> View Certificate
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">
                      <Award size={36} color="#94a3b8" />
                      <h3>No Staff Roll Numbers Recorded Yet</h3>
                      <p>
                        When marking accounts funded, enter your Staff Roll No.
                        Achievements will automatically appear here on the leaderboard for General Manager (GM) appreciation.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Upload Data Tab (Admin) */}
          {tab === 'Upload data' && isAdmin && (
            <div className="panel">
              <div className="paneltop">
                <div>
                  <h2>Upload Regional Low-Balance Account List</h2>
                  <p>CSV format with branch code, account number, customer name, mobile number, and last balance.</p>
                </div>
                <button type="button" className="secondary" onClick={downloadTemplate}>
                  <Download size={16} /> Download CSV template
                </button>
              </div>

              <div className="uploadzone" style={{ margin: '20px 0' }}>
                <Coins size={36} style={{ color: '#0284c7' }} />
                <h3>Choose or drop your low balance CSV file</h3>
                <p>
                  Columns: <code>branch_code</code>, <code>account_no</code>, <code>cif</code>,{' '}
                  <code>customer_name</code>, <code>mobile</code>, <code>last_known_balance</code>, <code>scheme</code>
                </p>
                <input
                  ref={fileRef}
                  aria-label="Upload low balance CSV"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                />
              </div>

              <div className="alert neutral">
                <CheckCircle2 size={18} />
                <div>
                  <b>Smart Status Preservation:</b> Re-uploading does not overwrite existing call statuses, notes, or
                  funded amounts for already tracked accounts.
                </div>
              </div>
            </div>
          )}
        </div>

        <footer>
          Indian Overseas Bank · Dindigul Regional Office
          <span>CASA Growth &amp; Low Balance Funding Desk</span>
        </footer>
      </main>
      <style>{`
        .tickertape-wrap {
          display: flex;
          align-items: center;
          background: #0f172a;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
          border: 1px solid #1e293b;
        }
        .tickertape-label {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #0284c7;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 9px 14px;
          white-space: nowrap;
          z-index: 2;
          box-shadow: 2px 0 8px rgba(0,0,0,0.25);
        }
        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fff;
          display: inline-block;
          animation: pulse 1.5s infinite;
        }
        .tickertape-track {
          flex: 1;
          overflow: hidden;
          position: relative;
          display: flex;
        }
        .tickertape-content {
          display: flex;
          align-items: center;
          gap: 20px;
          white-space: nowrap;
          animation: tickerScroll 280s linear infinite;
        }
        .tickertape-wrap:hover .tickertape-content,
        .tickertape-wrap:active .tickertape-content,
        .tickertape-wrap:focus-within .tickertape-content {
          animation-play-state: paused;
        }
        .tickertape-pause-btn {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          cursor: pointer;
          margin-left: 8px;
          min-height: 22px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1;
        }
        .tickertape-pause-btn:hover {
          background: rgba(255, 255, 255, 0.35);
        }
        .tickertape-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f1f5f9;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }
        .tickertape-item:hover {
          background: #0284c7;
          border-color: #38bdf8;
          color: #fff;
          transform: translateY(-1px);
        }
        .tickertape-icon {
          font-size: 12px;
        }
        .tickertape-text {
          font-weight: 500;
        }
        .tickertape-link {
          font-size: 11px;
          color: #93c5fd;
          font-weight: 700;
          margin-left: 4px;
          text-decoration: underline;
        }
        .tickertape-item:hover .tickertape-link {
          color: #fff;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 860px) {
          .tickertape-wrap {
            flex-direction: column !important;
            align-items: stretch !important;
            border-radius: 8px !important;
            margin-bottom: 14px !important;
          }
          .tickertape-label {
            width: 100% !important;
            justify-content: space-between !important;
            padding: 6px 10px !important;
            font-size: 10px !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            box-sizing: border-box !important;
          }
          .tickertape-track {
            padding: 7px 0 !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .tickertape-content {
            animation: tickerScroll 340s linear infinite !important;
            gap: 12px !important;
          }
          .tickertape-item {
            font-size: 11px !important;
            padding: 3px 8px !important;
          }
        }
        @media print {
          body * { visibility: hidden; }
          .cert-container, .cert-container * { visibility: visible; }
          .cert-container { position: absolute; left: 0; top: 0; width: 100% !important; border: 8px double #1e3a8a !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function CertificateView({
  category,
  rollNo,
  branchName,
  sol,
  count,
  amount,
  date,
  onClose,
}: {
  category: 'sma' | 'funding';
  rollNo: string;
  branchName: string;
  sol: string;
  count: number;
  amount: number;
  date: string;
  onClose: () => void;
}) {
  const isSma = category === 'sma';
  return (
    <div className="cert-wrapper">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="secondary" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← Back to Leaderboard
        </button>
        <button
          className="button"
          onClick={() => window.print()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#1e3a8a',
            color: '#fff',
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
          }}
        >
          <Printer size={16} /> Print Certificate
        </button>
      </div>

      <div
        className="cert-container"
        style={{
          background: '#fff',
          border: '10px double #1e3a8a',
          padding: '44px 36px',
          borderRadius: 16,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          textAlign: 'center',
          position: 'relative',
          maxWidth: 800,
          margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, border: '1px solid #d97706', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
          <img src="/logo.svg" alt="Indian Overseas Bank" style={{ height: 50 }} />
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.5px' }}>
              INDIAN OVERSEAS BANK
            </h2>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#b45309', letterSpacing: '1px' }}>
              DINDIGUL REGIONAL OFFICE (SOL 3933)
            </p>
          </div>
        </div>

        <div style={{ margin: '20px 0 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#64748b' }}>
            REGIONAL HONOUR OF EXCELLENCE
          </span>
          <h1
            style={{
              margin: '8px 0',
              fontSize: 30,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Certificate of Appreciation
          </h1>
          <div style={{ width: 80, height: 4, background: '#d97706', margin: '0 auto 16px', borderRadius: 2 }} />
        </div>

        <p style={{ fontSize: 15, color: '#475569', margin: '0 0 14px', fontStyle: 'italic' }}>
          This Certificate of Appreciation is proudly conferred upon
        </p>

        <div
          style={{
            background: '#f8fafc',
            border: '2px solid #e2e8f0',
            padding: '12px 28px',
            borderRadius: 12,
            display: 'inline-block',
            margin: '0 auto 16px',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>STAFF ROLL NUMBER</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a', letterSpacing: '1px' }}>
            {rollNo || 'Branch Officer'}
          </div>
          <div style={{ fontSize: 13, color: '#334155', fontWeight: 600, marginTop: 4 }}>
            {branchName ? `${branchName} Branch (${sol})` : `SOL ${sol || 'Dindigul Region'}`}
          </div>
        </div>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: '#1e293b',
            maxWidth: 660,
            margin: '12px auto 28px',
          }}
        >
          {isSma
            ? `In grateful recognition of extraordinary diligence, relentless borrower outreach, and exemplary results in SMA Prevention & Timely Recovery, successfully following up and regularizing ${count} accounts amounting to ₹${fmt(
                amount
              )} to safeguard Regional asset quality.`
            : `In grateful recognition of outstanding dedication, proactive customer engagement, and exemplary results in Funding Low Balance Accounts, successfully mobilizing ₹${fmt(
                amount
              )} across ${count} accounts to strengthen low-cost deposits and revitalize customer relationships.`}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px dashed #cbd5e1',
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{date}</div>
            <div style={{ width: 130, height: 1, background: '#94a3b8', margin: '6px auto' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Date of Issue
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 58,
                height: 58,
                borderRadius: '50%',
                border: '3px double #d97706',
                background: '#fffbeb',
                color: '#b45309',
                fontWeight: 800,
                fontSize: 10,
                lineHeight: 1.1,
              }}
            >
              SEAL OF
              <br />
              HONOUR
            </div>
          </div>

          <div style={{ textAlign: 'center', minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a8a' }}>General Manager (GM)</div>
            <div style={{ width: 170, height: 1, background: '#94a3b8', margin: '6px auto' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Regional Office, Dindigul
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Indian Overseas Bank</div>
          </div>
        </div>
      </div>
    </div>
  );
}
