'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  Upload,
  ChevronRight,
  Download,
  Send,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Phone,
  PhoneCall,
  Clock,
  Building2,
  ExternalLink,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import Login from '../Login';
import { parseSMACSV, validateSMAAccounts, cutoffs } from '../model.mjs';

function fmt(n: any) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('en-IN');
}

export default function SmaPortal() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [tab, setTab] = useState('SMA Overview');
  const [sol, setSol] = useState('');
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchSearch, setBranchSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Form states for branch SMA eliminations
  const [sma0Count, setSma0Count] = useState(0);
  const [sma0Amount, setSma0Amount] = useState(0);
  const [sma1Count, setSma1Count] = useState(0);
  const [sma1Amount, setSma1Amount] = useState(0);
  const [sma2Count, setSma2Count] = useState(0);
  const [sma2Amount, setSma2Amount] = useState(0);
  const [smaNotes, setSmaNotes] = useState('');

  // Review remark
  const [reviewText, setReviewText] = useState('');
  const [reviewStatus, setReviewStatus] = useState('reviewed');

  // Admin upload
  const fileRef = useRef<HTMLInputElement>(null);

  async function checkAuth() {
    try {
      const r = await fetch('/api/auth');
      const j: any = await r.json();
      setAuthed(Boolean(j.authenticated));
      if (j.authenticated) load();
    } catch {
      setAuthed(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/portal?date=' + date);
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      if (j.user.role === 'branch') {
        setSol(j.user.sol);
        setTab('Branch follow-up');
      } else if (!sol && j.branches.length) {
        setSol(j.branches[0].sol);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (authed) load();
  }, [date, authed]);

  // Sync form inputs when sol or submissions change
  useEffect(() => {
    if (!data || !sol) return;
    const sub = data.subs?.find((s: any) => s.sol === sol);
    if (sub?.values) {
      setSma0Count(Number(sub.values.sma0_count || 0));
      setSma0Amount(Number(sub.values.sma0_amount || 0));
      setSma1Count(Number(sub.values.sma1_count || 0));
      setSma1Amount(Number(sub.values.sma1_amount || 0));
      setSma2Count(Number(sub.values.sma2_count || 0));
      setSma2Amount(Number(sub.values.sma2_amount || 0));
      setSmaNotes(String(sub.values.notes || ''));
    } else {
      setSma0Count(0);
      setSma0Amount(0);
      setSma1Count(0);
      setSma1Amount(0);
      setSma2Count(0);
      setSma2Amount(0);
      setSmaNotes('');
    }
  }, [sol, data]);

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSmaEliminations() {
    await act(
      {
        action: 'sma-entry',
        sol,
        sma0_count: Number(sma0Count || 0),
        sma0_amount: Number(sma0Amount || 0),
        sma1_count: Number(sma1Count || 0),
        sma1_amount: Number(sma1Amount || 0),
        sma2_count: Number(sma2Count || 0),
        sma2_amount: Number(sma2Amount || 0),
        notes: smaNotes,
      },
      '✓ SMA eliminations saved! Changes immediately reflect in the Daily Reporting Portal.'
    );
  }

  async function updateAccountStatus(accId: string, nextStatus: string, remarks?: string, promiseDate?: string) {
    await act(
      {
        action: 'sma-status',
        sol,
        id: accId,
        status: nextStatus,
        remarks: remarks || '',
        promise_date: promiseDate || null,
      },
      'Account follow-up updated.'
    );
  }

  async function resolveAndAddElimination(acc: any) {
    const bucket = acc.bucket || 'sma0';
    const amt = Number(acc.amount || 0);

    // Update account status to resolved
    await updateAccountStatus(acc.id, 'resolved', 'Resolved & cleared today through recovery follow-up');

    // Also auto-increment elimination form for this bucket
    if (bucket === 'sma0') {
      setSma0Count((c) => c + 1);
      setSma0Amount((a) => a + amt);
    } else if (bucket === 'sma1') {
      setSma1Count((c) => c + 1);
      setSma1Amount((a) => a + amt);
    } else if (bucket === 'sma2') {
      setSma2Count((c) => c + 1);
      setSma2Amount((a) => a + amt);
    }
    setNotice(`✓ Account ${acc.cif} marked resolved! Review and click 'Save SMA Eliminations' to confirm sync with Daily Report.`);
  }

  async function switchPortal() {
    setBusy(true);
    try {
      const r = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handoff' }),
      });
      const j: any = await r.json();
      if (!r.ok || !j.token) throw new Error(j.error || 'Unable to generate handover token');

      const isSmaDomain = window.location.hostname.includes('dailyreport-sma');
      const targetBase = isSmaDomain
        ? 'https://dailyreport-9265a.web.app'
        : window.location.origin;

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
      const rawRows = parseSMACSV(text);
      const validated = validateSMAAccounts(rawRows, data.branches);
      await act({ action: 'upload-sma', rows: validated }, `Successfully imported ${validated.length} SMA accounts across branches.`);
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

  if (authed === false) {
    return <Login onSuccess={() => setAuthed(true)} portalName="SMA Follow-up Portal" portalTag="SPECIAL MENTION ACCOUNTS" />;
  }

  if (!data) {
    return (
      <main className="loading">
        <img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg" />
        <h1>SMA Follow-up Portal</h1>
        <p>{error || 'Connecting to regional database…'}</p>
        {error && <button onClick={load}>Try again</button>}
      </main>
    );
  }

  const isAdmin = data.user.role === 'admin';
  const isSrm = data.user.role === 'srm';
  const isReviewer = data.user.role === 'reviewer' || isSrm;
  const isBranch = data.user.role === 'branch';

  const currentBranch = data.branches.find((b: any) => b.sol === sol);
  const snap = data.pub?.rows?.find((b: any) => b.sol === sol);
  const sub = data.subs?.find((s: any) => s.sol === sol);
  const headContact = data.contacts?.find((c: any) => c.sol === sol);

  // Region-wide aggregates
  const totalSnapSma0Count = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma0_yesterday_count || 0), 0) || 0;
  const totalSnapSma0Amount = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma0_yesterday_amount || 0), 0) || 0;
  const totalSnapSma1Count = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma1_yesterday_count || 0), 0) || 0;
  const totalSnapSma1Amount = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma1_yesterday_amount || 0), 0) || 0;
  const totalSnapSma2Count = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma2_yesterday_count || 0), 0) || 0;
  const totalSnapSma2Amount = data.pub?.rows?.reduce((acc: number, r: any) => acc + (r.sma2_yesterday_amount || 0), 0) || 0;

  const totalElimSma0Count = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma0_count) || 0), 0) || 0;
  const totalElimSma0Amount = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma0_amount) || 0), 0) || 0;
  const totalElimSma1Count = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma1_count) || 0), 0) || 0;
  const totalElimSma1Amount = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma1_amount) || 0), 0) || 0;
  const totalElimSma2Count = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma2_count) || 0), 0) || 0;
  const totalElimSma2Amount = data.subs?.reduce((acc: number, s: any) => acc + (Number(s.values?.sma2_amount) || 0), 0) || 0;

  const grandTotalYesterdayAmount = totalSnapSma0Amount + totalSnapSma1Amount + totalSnapSma2Amount;
  const grandTotalElimAmount = totalElimSma0Amount + totalElimSma1Amount + totalElimSma2Amount;
  const grandTotalElimCount = totalElimSma0Count + totalElimSma1Count + totalElimSma2Count;

  // Branch accounts
  const branchSmaAccounts = (data.smaAccounts || []).filter((a: any) => a.sol === sol);
  const filteredAccounts = branchSmaAccounts.filter((a: any) => {
    const matchBucket = bucketFilter === 'All' || a.bucket.toLowerCase() === bucketFilter.toLowerCase();
    const matchStatus = statusFilter === 'All' || (a.status || 'pending').toLowerCase() === statusFilter.toLowerCase();
    const matchSearch =
      !search ||
      (a.cif + ' ' + a.borrower_name + ' ' + (a.phone || '')).toLowerCase().includes(search.toLowerCase());
    return matchBucket && matchStatus && matchSearch;
  });

  const navItems = [
    ...(!isBranch ? [['SMA Overview', LayoutDashboard]] : []),
    ['Branch follow-up', Users],
    ...(isAdmin ? [['Upload SMA Data', Upload]] : []),
  ];

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
        <div className="navlabel">SMA WORKSPACE</div>
        <nav>
          {navItems.map(([name, Icon]: any) => (
            <button
              key={name}
              className={tab === name ? 'selected' : ''}
              onClick={() => {
                setTab(name);
                setNotice('');
                setError('');
              }}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebottom">
          <span className="avatar">
            {(data.user.name || data.user.email || data.user.phone?.slice(2) || 'U')[0].toUpperCase()}
          </span>
          <div>
            {data.user.role === 'admin'
              ? 'Regional administrator'
              : data.user.role === 'srm'
                ? 'Senior Regional Manager'
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
            Dindigul region <ChevronRight size={14} /> SMA Portal <ChevronRight size={14} /> {tab}
          </div>
          <div className="headeractions">
            <button
              className="secondary"
              onClick={switchPortal}
              title="Open Daily Reporting Portal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#1a56db',
                borderColor: '#bfdbfe',
                background: '#eff6ff',
              }}
            >
              Daily Reporting Portal <ExternalLink size={13} />
            </button>
            <span className={'private ' + (isSrm ? 'srm-tag' : '')}>
              {data.user.role === 'branch'
                ? 'Branch head'
                : data.user.role === 'reviewer'
                  ? 'Reviewer'
                  : data.user.role === 'srm'
                    ? 'Senior Regional Manager (SRM)'
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
            <button className="icon" onClick={load} aria-label="Refresh">
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <div className="content">
          <div className="title">
            <div>
              <div className="eyebrow" style={{ color: '#dc2626' }}>
                SPECIAL MENTION ACCOUNTS (SMA)
              </div>
              <h1>{isBranch ? `${currentBranch?.name || 'Branch'} · SMA Follow-up` : tab}</h1>
              <p>
                {tab === 'SMA Overview'
                  ? 'Regional Special Mention Account positions, elimination tracking, and recovery progress.'
                  : tab === 'Branch follow-up'
                    ? 'Follow up on SMA-0, SMA-1, and SMA-2 borrower accounts and record today’s eliminations.'
                    : 'Bulk upload SMA overdue lists to guide branch follow-up.'}
              </p>
            </div>
            <label className="date">
              Reporting date
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          </div>

          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}

          {/* Banner explaining bi-directional sync */}
          <div
            className="alert neutral"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#059669" />
              <div>
                <b>Live Bi-Directional Synchronization</b>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  All eliminations, overdue updates, and notes saved in this portal immediately reflect in the{' '}
                  <b>Daily Reporting Portal</b> and vice versa.
                </div>
              </div>
            </div>
            <button
              className="secondary"
              onClick={switchPortal}
              style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              Switch to Daily Report <ArrowRight size={14} />
            </button>
          </div>

          {/* TAB 1: SMA OVERVIEW */}
          {tab === 'SMA Overview' && (
            <>
              <div className="stats">
                <div>
                  <span>Total Region SMA Overdue</span>
                  <strong style={{ color: '#b91c1c' }}>₹{fmt(grandTotalYesterdayAmount)}</strong>
                  <small>
                    SMA0: ₹{fmt(totalSnapSma0Amount)} · SMA1: ₹{fmt(totalSnapSma1Amount)} · SMA2: ₹
                    {fmt(totalSnapSma2Amount)}
                  </small>
                </div>
                <div>
                  <span>Today’s Total Eliminations</span>
                  <strong style={{ color: '#047857' }}>₹{fmt(grandTotalElimAmount)}</strong>
                  <small>{grandTotalElimCount} accounts eliminated across region</small>
                </div>
                <div>
                  <span>SMA-0 Eliminated Today</span>
                  <strong>₹{fmt(totalElimSma0Amount)}</strong>
                  <small>{totalElimSma0Count} accts (1-30 days overdue)</small>
                </div>
                <div>
                  <span>SMA-1 & SMA-2 Eliminated</span>
                  <strong>₹{fmt(totalElimSma1Amount + totalElimSma2Amount)}</strong>
                  <small>
                    SMA1: ₹{fmt(totalElimSma1Amount)} · SMA2: ₹{fmt(totalElimSma2Amount)}
                  </small>
                </div>
              </div>

              <div className="panel">
                <div className="paneltop">
                  <div>
                    <h2>Branch-wise SMA Performance & Eliminations</h2>
                    <p>Yesterday’s confirmed balance vs today’s reported eliminations.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      const csvHeader =
                        'SOL,Branch,Yesterday SMA0 Accts,Yesterday SMA0 ₹,Yesterday SMA1 Accts,Yesterday SMA1 ₹,Yesterday SMA2 Accts,Yesterday SMA2 ₹,Today Elim SMA0 Accts,Today Elim SMA0 ₹,Today Elim SMA1 Accts,Today Elim SMA1 ₹,Today Elim SMA2 Accts,Today Elim SMA2 ₹,Total Eliminated ₹\n';
                      const csvRows = data.branches
                        .map((b: any) => {
                          const r = data.pub?.rows?.find((x: any) => x.sol === b.sol);
                          const s = data.subs?.find((x: any) => x.sol === b.sol);
                          const totalElim =
                            Number(s?.values?.sma0_amount || 0) +
                            Number(s?.values?.sma1_amount || 0) +
                            Number(s?.values?.sma2_amount || 0);
                          return [
                            b.sol,
                            `"${b.name}"`,
                            r?.sma0_yesterday_count ?? '',
                            r?.sma0_yesterday_amount ?? '',
                            r?.sma1_yesterday_count ?? '',
                            r?.sma1_yesterday_amount ?? '',
                            r?.sma2_yesterday_count ?? '',
                            r?.sma2_yesterday_amount ?? '',
                            s?.values?.sma0_count ?? '',
                            s?.values?.sma0_amount ?? '',
                            s?.values?.sma1_count ?? '',
                            s?.values?.sma1_amount ?? '',
                            s?.values?.sma2_count ?? '',
                            s?.values?.sma2_amount ?? '',
                            totalElim,
                          ].join(',');
                        })
                        .join('\n');
                      downloadCsv(`IOB_SMA_summary_${date}.csv`, csvHeader + csvRows);
                    }}
                  >
                    <Download size={16} /> Export SMA summary
                  </button>
                </div>

                <div className="toolbar">
                  <input
                    placeholder="Search branch or SOL…"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                  />
                </div>

                <div className="tablewrap branchlist">
                  <table>
                    <thead>
                      <tr>
                        <th>BRANCH</th>
                        <th>SMA-0 (YDAY / TODAY ELIM)</th>
                        <th>SMA-1 (YDAY / TODAY ELIM)</th>
                        <th>SMA-2 (YDAY / TODAY ELIM)</th>
                        <th>TOTAL ELIMINATED TODAY</th>
                        <th>STATUS</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.branches
                        .filter((b: any) =>
                          (b.name + ' ' + b.sol).toLowerCase().includes(branchSearch.toLowerCase())
                        )
                        .map((b: any) => {
                          const r = data.pub?.rows?.find((x: any) => x.sol === b.sol);
                          const s = data.subs?.find((x: any) => x.sol === b.sol);
                          const totalElim =
                            Number(s?.values?.sma0_amount || 0) +
                            Number(s?.values?.sma1_amount || 0) +
                            Number(s?.values?.sma2_amount || 0);
                          const hasElim = totalElim > 0;
                          const hasOverdue =
                            (r?.sma0_yesterday_amount || 0) +
                              (r?.sma1_yesterday_amount || 0) +
                              (r?.sma2_yesterday_amount || 0) >
                            0;

                          return (
                            <tr key={b.sol}>
                              <td>
                                <b>{b.name}</b>
                                <small>SOL {b.sol}</small>
                              </td>
                              <td data-label="SMA-0">
                                <div>
                                  <small>Yday: {r?.sma0_yesterday_count || 0} accts · ₹{fmt(r?.sma0_yesterday_amount)}</small>
                                </div>
                                <span style={{ color: s?.values?.sma0_amount ? '#059669' : '#64748b', fontWeight: 600 }}>
                                  Elim: {s?.values?.sma0_count || 0} accts · ₹{fmt(s?.values?.sma0_amount)}
                                </span>
                              </td>
                              <td data-label="SMA-1">
                                <div>
                                  <small>Yday: {r?.sma1_yesterday_count || 0} accts · ₹{fmt(r?.sma1_yesterday_amount)}</small>
                                </div>
                                <span style={{ color: s?.values?.sma1_amount ? '#059669' : '#64748b', fontWeight: 600 }}>
                                  Elim: {s?.values?.sma1_count || 0} accts · ₹{fmt(s?.values?.sma1_amount)}
                                </span>
                              </td>
                              <td data-label="SMA-2">
                                <div>
                                  <small>Yday: {r?.sma2_yesterday_count || 0} accts · ₹{fmt(r?.sma2_yesterday_amount)}</small>
                                </div>
                                <span style={{ color: s?.values?.sma2_amount ? '#059669' : '#64748b', fontWeight: 600 }}>
                                  Elim: {s?.values?.sma2_count || 0} accts · ₹{fmt(s?.values?.sma2_amount)}
                                </span>
                              </td>
                              <td data-label="Total Eliminated">
                                <b style={{ color: hasElim ? '#059669' : '#64748b' }}>₹{fmt(totalElim)}</b>
                                {s?.values?.notes && <small style={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.values.notes}</small>}
                              </td>
                              <td data-label="Status">
                                <span className={'badge ' + (hasElim ? 'reviewed' : s ? 'submitted' : hasOverdue ? 'clarification' : 'pending')}>
                                  {hasElim ? 'Eliminations Reported' : s ? 'Reported Nil' : 'Pending'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="textbutton"
                                  onClick={() => {
                                    setSol(b.sol);
                                    setTab('Branch follow-up');
                                  }}
                                >
                                  Follow-up <ChevronRight size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BRANCH FOLLOW-UP */}
          {tab === 'Branch follow-up' && (
            <>
              {!isBranch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
                    Select branch:
                    <select
                      value={sol}
                      onChange={(e) => setSol(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      {data.branches.map((b: any) => (
                        <option key={b.sol} value={b.sol}>
                          {b.sol} · {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {headContact?.phone && (
                    <a
                      className="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#25D366',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                      href={`https://wa.me/${headContact.phone}?text=${encodeURIComponent(
                        `IOB Dindigul SMA Follow-up: Dear Branch Head (${currentBranch?.name}), please review your SMA accounts for ${date}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare size={14} /> Message Branch Head
                    </a>
                  )}
                </div>
              )}

              {/* SECTION A: TODAY'S SMA ELIMINATIONS */}
              <div className="panel" style={{ borderTop: '4px solid #2563eb' }}>
                <div className="paneltop">
                  <div>
                    <h2>01 · Today’s SMA Eliminations (Auto-syncs with Daily Report)</h2>
                    <p>
                      Enter accounts and amounts resolved today. Transfers to NPA are not successful eliminations.
                    </p>
                  </div>
                  <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                    Live Sync Enabled
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { key: 'sma0', label: 'SMA-0 (1 to 30 days overdue)', countVal: sma0Count, setCount: setSma0Count, amtVal: sma0Amount, setAmt: setSma0Amount },
                    { key: 'sma1', label: 'SMA-1 (31 to 60 days overdue)', countVal: sma1Count, setCount: setSma1Count, amtVal: sma1Amount, setAmt: setSma1Amount },
                    { key: 'sma2', label: 'SMA-2 (61 to 90 days overdue)', countVal: sma2Count, setCount: setSma2Count, amtVal: sma2Amount, setAmt: setSma2Amount },
                  ].map((b) => {
                    const ydayCount = snap?.[b.key + '_yesterday_count'] || 0;
                    const ydayAmt = snap?.[b.key + '_yesterday_amount'] || 0;
                    const mtdCount = snap?.[b.key + '_prior_count'] || 0;
                    const mtdAmt = snap?.[b.key + '_prior_amount'] || 0;
                    const netAmt = Math.max(0, ydayAmt - b.amtVal);

                    return (
                      <div className="smarow" key={b.key} style={{ background: '#f8fafc', padding: '14px', borderRadius: 8 }}>
                        <div style={{ minWidth: 220 }}>
                          <b style={{ fontSize: 14, color: '#0f172a' }}>{b.label}</b>
                          <small style={{ display: 'block', color: '#64748b' }}>
                            Month-end: {fmt(mtdCount)} accts / ₹{fmt(mtdAmt)}
                          </small>
                          <small style={{ display: 'block', color: '#475569', fontWeight: 600 }}>
                            Yesterday: {fmt(ydayCount)} accts / ₹{fmt(ydayAmt)}
                          </small>
                          <small style={{ display: 'block', color: '#059669', fontWeight: 600, marginTop: 4 }}>
                            Estimated balance: ₹{fmt(netAmt)}
                          </small>
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Eliminated count</span>
                          <input
                            type="number"
                            min="0"
                            disabled={busy || isReviewer}
                            value={b.countVal || ''}
                            onChange={(e) => b.setCount(Number(e.target.value))}
                            placeholder="0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Eliminated amount (₹)</span>
                          <input
                            type="number"
                            min="0"
                            disabled={busy || isReviewer}
                            value={b.amtVal || ''}
                            onChange={(e) => b.setAmt(Number(e.target.value))}
                            placeholder="₹ 0"
                            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </label>
                      </div>
                    );
                  })}

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      SMA Recovery Notes / Strategy / Commitments
                    </span>
                    <textarea
                      rows={2}
                      disabled={busy || isReviewer}
                      value={smaNotes}
                      onChange={(e) => setSmaNotes(e.target.value)}
                      placeholder="e.g. Ramalingam CIF1002341 settled in full; visited Meenakshi Traders for Friday closure commitment."
                      style={{ padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </label>

                  {!isReviewer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <button disabled={busy} onClick={saveSmaEliminations} style={{ minWidth: 260 }}>
                        {busy ? 'Saving & Syncing…' : 'Save SMA Eliminations & Sync to Daily Report'}
                      </button>
                      <small style={{ color: '#64748b' }}>
                        Saved figures will instantly show in today’s branch report on the Daily Reporting Portal.
                      </small>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION B: ACCOUNT-LEVEL SMA FOLLOW-UP */}
              <div className="panel">
                <div className="paneltop">
                  <div>
                    <h2>02 · Account-level Borrower Follow-up List ({branchSmaAccounts.length} accounts)</h2>
                    <p>Track borrower contacts, promise-to-pay dates, and recovery actions.</p>
                  </div>
                  {isAdmin && (
                    <button className="secondary" onClick={() => setTab('Upload SMA Data')}>
                      <Upload size={15} /> Upload Accounts CSV
                    </button>
                  )}
                </div>

                <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    placeholder="Search borrower name or CIF…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)}>
                    <option value="All">All buckets</option>
                    <option value="sma0">SMA-0 (1-30 DPD)</option>
                    <option value="sma1">SMA-1 (31-60 DPD)</option>
                    <option value="sma2">SMA-2 (61-90 DPD)</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="All">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="contacted">Contacted</option>
                    <option value="promised">Promise to pay</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {filteredAccounts.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredAccounts.map((acc: any) => {
                      const isResolved = acc.status === 'resolved';
                      const bucketTag = (acc.bucket || 'sma0').toUpperCase();

                      return (
                        <div
                          key={acc.id}
                          className="repayitem"
                          style={{
                            background: isResolved ? '#f0fdf4' : '#fff',
                            border: `1px solid ${isResolved ? '#bbf7d0' : '#e2e8f0'}`,
                            padding: '14px',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <b style={{ fontSize: 15, color: '#0f172a' }}>{acc.borrower_name}</b>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 11,
                                    background:
                                      bucketTag === 'SMA0'
                                        ? '#fef3c7'
                                        : bucketTag === 'SMA1'
                                          ? '#ffedd5'
                                          : '#fee2e2',
                                    color:
                                      bucketTag === 'SMA0'
                                        ? '#92400e'
                                        : bucketTag === 'SMA1'
                                          ? '#9a3412'
                                          : '#991b1b',
                                  }}
                                >
                                  {bucketTag}
                                </span>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 11,
                                    background:
                                      acc.status === 'resolved'
                                        ? '#dcfce7'
                                        : acc.status === 'promised'
                                          ? '#e0e7ff'
                                          : acc.status === 'contacted'
                                            ? '#fef9c3'
                                            : '#f1f5f9',
                                    color:
                                      acc.status === 'resolved'
                                        ? '#166534'
                                        : acc.status === 'promised'
                                          ? '#3730a3'
                                          : acc.status === 'contacted'
                                            ? '#854d0e'
                                            : '#475569',
                                  }}
                                >
                                  {(acc.status || 'pending').toUpperCase()}
                                </span>
                              </div>
                              <small style={{ color: '#64748b', display: 'block', marginTop: 2 }}>
                                CIF: {acc.cif} {acc.dpd ? `· ${acc.dpd} Days Past Due` : ''}
                              </small>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c' }}>
                                ₹{fmt(acc.amount)}
                              </span>
                              <small style={{ display: 'block', color: '#64748b' }}>Overdue amount</small>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 12,
                              marginTop: 10,
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#f8fafc',
                              padding: '8px 12px',
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {acc.phone && (
                                <>
                                  <a
                                    href={`tel:+${acc.phone}`}
                                    className="secondary"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '4px 8px',
                                      fontSize: 11,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <PhoneCall size={12} /> {acc.phone}
                                  </a>
                                  <a
                                    href={`https://wa.me/${acc.phone}?text=${encodeURIComponent(
                                      `Indian Overseas Bank ${currentBranch?.name} Branch: Dear ${acc.borrower_name}, please clear your overdue amount of ₹${fmt(
                                        acc.amount
                                      )} to regularize your loan account.`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: '#25D366',
                                      color: '#fff',
                                      padding: '4px 8px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      textDecoration: 'none',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <MessageSquare size={12} /> WhatsApp
                                  </a>
                                </>
                              )}
                              {acc.promise_date && (
                                <span style={{ fontSize: 12, color: '#4338ca', fontWeight: 500 }}>
                                  Promise date: {acc.promise_date}
                                </span>
                              )}
                              {acc.remarks && (
                                <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                                  "{acc.remarks}"
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {!isReviewer && !isResolved && (
                                <button
                                  className="secondary"
                                  style={{
                                    fontSize: 11,
                                    padding: '5px 10px',
                                    background: '#ecfdf5',
                                    borderColor: '#a7f3d0',
                                    color: '#065f46',
                                    fontWeight: 600,
                                  }}
                                  onClick={() => resolveAndAddElimination(acc)}
                                >
                                  ✓ Mark Resolved & Add to Eliminations
                                </button>
                              )}
                              {!isReviewer && (
                                <select
                                  value={acc.status || 'pending'}
                                  onChange={(e) => updateAccountStatus(acc.id, e.target.value, acc.remarks, acc.promise_date)}
                                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="promised">Promise to pay</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">
                    <ShieldAlert size={32} />
                    <h3>No SMA borrower accounts found</h3>
                    <p>
                      {branchSmaAccounts.length
                        ? 'No accounts match the current filter.'
                        : 'No borrower accounts uploaded yet for this branch. Use the form above to record bucket-level eliminations.'}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION C: REGIONAL DESK & SRM DIRECTIONS */}
              <div className="panel">
                <h2>03 · Regional Desk & SRM Recovery Directions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {data.reviews
                    .filter((r: any) => r.sol === sol)
                    .map((r: any) => (
                      <div
                        key={r.id}
                        className={'reviewitem ' + (r.status === 'srm_direction' ? 'srm-direction-card' : '')}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: r.status === 'srm_direction' ? '#fffbeb' : '#f8fafc',
                          border: `1px solid ${r.status === 'srm_direction' ? '#fde68a' : '#e2e8f0'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <b>
                            {r.status === 'srm_direction' ? '★ SENIOR REGIONAL MANAGER (SRM) DIRECTION' : 'Regional Review Desk'}
                          </b>
                          <small style={{ color: '#64748b' }}>{r.at?.slice(0, 16).replace('T', ' ')} IST</small>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>{r.text}</p>
                        <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>By: {r.by}</small>
                      </div>
                    ))}
                  {!data.reviews.filter((r: any) => r.sol === sol).length && (
                    <p style={{ color: '#64748b', fontSize: 13 }}>No regional remarks posted for this branch yet.</p>
                  )}
                </div>

                {isReviewer && sub && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc', padding: 14, borderRadius: 8 }}>
                    <b>Issue SMA Follow-up Direction</b>
                    <textarea
                      rows={2}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Enter recovery guidance or priority SMA direction for branch head…"
                      style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                        <option value="reviewed">Standard review</option>
                        {isSrm && <option value="srm_direction">★ Issue as SRM Direction</option>}
                      </select>
                      <button
                        disabled={busy || !reviewText.trim()}
                        onClick={async () => {
                          await act(
                            {
                              action: 'review',
                              sol,
                              revision: sub.revision,
                              text: reviewText,
                              status: reviewStatus,
                            },
                            'Direction issued and added to queue.'
                          );
                          setReviewText('');
                        }}
                      >
                        Post Direction
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: UPLOAD SMA DATA (ADMIN) */}
          {tab === 'Upload SMA Data' && isAdmin && (
            <div className="panel">
              <div className="paneltop">
                <div>
                  <h2>Upload Regional SMA Accounts (CSV)</h2>
                  <p>Bulk upload Special Mention Accounts across all 56 branches to power account-level recovery tracking.</p>
                </div>
                <a
                  className="secondary button"
                  href="/IOB_sma_accounts_template.csv"
                  download="IOB_sma_accounts_template.csv"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <Download size={15} /> Download template CSV
                </a>
              </div>

              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 12,
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  marginBottom: 16,
                }}
              >
                <Upload size={36} color="#64748b" style={{ margin: '0 auto 10px' }} />
                <h3>Select SMA Accounts CSV File</h3>
                <p style={{ color: '#64748b', fontSize: 13, maxWidth: 500, margin: '0 auto 16px' }}>
                  Required columns: <code>branch_code</code>, <code>cif</code>, <code>borrower_name</code>, <code>bucket</code> (SMA0, SMA1, SMA2), <code>overdue_amount</code>.
                  Optional: <code>dpd</code>, <code>phone</code>, <code>status</code>, <code>remarks</code>.
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileRef}
                  onChange={handleCsvUpload}
                  disabled={busy}
                  style={{ display: 'none' }}
                  id="sma-file-input"
                />
                <label
                  htmlFor="sma-file-input"
                  className="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 20px' }}
                >
                  <Upload size={16} /> {busy ? 'Processing CSV…' : 'Choose CSV file'}
                </label>
              </div>

              <div style={{ background: '#f1f5f9', padding: 14, borderRadius: 8, fontSize: 12, color: '#475569' }}>
                <b>CSV Upload Specifications:</b>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Validates 4-digit SOL against the official 56 Dindigul region branches.</li>
                  <li>Re-uploading preserves existing follow-up remarks and borrower status.</li>
                  <li>Branch heads will only see accounts belonging to their assigned SOL.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer>
          Indian Overseas Bank · Dindigul Regional SMA Follow-up Portal · <span>All times are IST</span>
        </footer>
      </main>
    </div>
  );
}
