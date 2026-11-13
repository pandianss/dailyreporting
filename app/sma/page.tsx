'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Upload,
  ChevronRight,
  Download,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  CalendarClock,
  Clock,
  AlertTriangle,
  Building2,
  Sparkles
} from 'lucide-react';
import Login from '../Login';
import { parseRepaymentsCSV, validateRepayments, addDays } from '../model.mjs';

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
  const [tab, setTab] = useState('Repayment follow-up');
  const [sol, setSol] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [branchSearch, setBranchSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
        setTab('Repayment follow-up');
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

  async function toggleRepaymentStatus(accountSol: string, accountId: string, currentCompleted: boolean) {
    await act(
      {
        action: 'repayment-status',
        sol: accountSol,
        id: accountId,
        completed: !currentCompleted,
      },
      currentCompleted
        ? 'Repayment marked pending. Status synced with Daily Reporting.'
        : '✓ Repayment marked completed! Reflected in Daily Reporting Portal.'
    );
  }

  async function switchPortal(target: 'daily' | 'funding' = 'daily') {
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
        ? (target === 'daily' ? 'https://dailyreport-9265a.web.app' : 'https://dailyreport-funding-9265a.web.app')
        : (target === 'daily' ? window.location.origin : `${window.location.origin}/funding`);

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
      const rawRows = parseRepaymentsCSV(text);
      const validated = validateRepayments(rawRows, data.branches);
      await act(
        { action: 'upload-repayments', rows: validated },
        `Successfully imported ${validated.length} repayment accounts across branches.`
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

  const dueLabel = (d: string) => {
    if (d === date) return 'Due today';
    const diff = Math.round(
      (new Date(d + 'T12:00:00Z').getTime() - new Date(date + 'T12:00:00Z').getTime()) / 86400000
    );
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  if (authed === false) {
    return (
      <Login
        onSuccess={() => setAuthed(true)}
        portalName="SMA Repayment Follow-up Portal"
        portalTag="PREVENTING SMA SLIPPAGE · TODAY’S DUE & NEXT 3 DAYS"
      />
    );
  }

  if (!data) {
    return (
      <main className="loading">
        <img src="/logo.svg" alt="Indian Overseas Bank Logo" className="sitelogo sitelogo-lg" />
        <h1>SMA Repayment Portal</h1>
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
  const headContact = data.contacts?.find((c: any) => c.sol === sol);

  // All repayments (due today + next 3 days)
  const allRepayments: any[] = data.repayments || [];
  const branchRepayments: any[] = isBranch
    ? allRepayments
    : sol
      ? allRepayments.filter((r: any) => r.sol === sol)
      : allRepayments;

  // Breakdown: Today's due vs Next 3 days due
  const branchDueToday = branchRepayments.filter((r: any) => r.due_date === date);
  const branchDueTodayAmt = branchDueToday.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const branchDueTodayComp = branchDueToday.filter((r: any) => r.completed);
  const branchDueTodayCompAmt = branchDueTodayComp.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const branchDueTodayPend = branchDueToday.filter((r: any) => !r.completed);
  const branchDueTodayPendAmt = branchDueTodayAmt - branchDueTodayCompAmt;

  const branchNext3Days = branchRepayments.filter((r: any) => r.due_date > date);
  const branchNext3DaysAmt = branchNext3Days.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const branchNext3DaysComp = branchNext3Days.filter((r: any) => r.completed);
  const branchNext3DaysCompAmt = branchNext3DaysComp.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const branchNext3DaysPend = branchNext3Days.filter((r: any) => !r.completed);
  const branchNext3DaysPendAmt = branchNext3DaysAmt - branchNext3DaysCompAmt;

  const branchTotalAmt = branchDueTodayAmt + branchNext3DaysAmt;
  const branchTotalCompAmt = branchDueTodayCompAmt + branchNext3DaysCompAmt;
  const branchTotalCompCount = branchDueTodayComp.length + branchNext3DaysComp.length;
  const branchTotalCount = branchRepayments.length;

  // Region-wide metrics
  const regionDueToday = allRepayments.filter((r: any) => r.due_date === date);
  const regionDueTodayAmt = regionDueToday.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const regionDueTodayComp = regionDueToday.filter((r: any) => r.completed);
  const regionDueTodayCompAmt = regionDueTodayComp.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const regionDueTodayPendCount = regionDueToday.length - regionDueTodayComp.length;

  const regionNext3Days = allRepayments.filter((r: any) => r.due_date > date);
  const regionNext3DaysAmt = regionNext3Days.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);

  const regionTotalAmt = regionDueTodayAmt + regionNext3DaysAmt;
  const regionTotalCompAmt = allRepayments
    .filter((r: any) => r.completed)
    .reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
  const regionTotalCompCount = allRepayments.filter((r: any) => r.completed).length;

  // Filtered accounts for display
  const filteredAccounts = branchRepayments.filter((r: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.cif + ' ' + r.account_name).toLowerCase().includes(q);
    const matchFilter =
      filter === 'All'
        ? true
        : filter === 'Due today'
          ? r.due_date === date
          : filter === 'Next 3 days'
            ? r.due_date > date
            : filter === 'Pending'
              ? !r.completed
              : filter === 'Completed'
                ? r.completed
                : true;
    return matchSearch && matchFilter;
  });

  const visibleAccounts = showAll ? filteredAccounts : filteredAccounts.slice(0, 50);

  const navItems = [
    ...(!isBranch ? [['Overview', LayoutDashboard]] : []),
    ['Repayment follow-up', CalendarClock],
    ...(isAdmin ? [['Upload repayments', Upload]] : []),
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
        <div className="navlabel">SMA PREVENTION WORKSPACE</div>
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
            Dindigul region <ChevronRight size={14} /> SMA Prevention <ChevronRight size={14} /> {tab}
          </div>
          <div className="headeractions">
            <button
              type="button"
              className="secondary"
              onClick={() => switchPortal('daily')}
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
              Daily Reporting <ExternalLink size={13} />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => switchPortal('funding')}
              title="Open Low Balance Funding Portal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#0284c7',
                borderColor: '#bae6fd',
                background: '#f0f9ff',
              }}
            >
              Low Balance Funding <ExternalLink size={13} />
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
              <div className="eyebrow" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> TODAY’S DUE & NEXT 3 DAYS ADVANCE REPAYMENT TRACKER
              </div>
              <h1>
                {isBranch
                  ? `${currentBranch?.name || 'Your Branch'} · Today’s Due & Next 3 Days Repayments`
                  : tab === 'Repayment follow-up'
                    ? `${currentBranch?.name || 'Branch'} · Repayment Accounts`
                    : 'Today’s Due & Next 3 Days Overview'}
              </h1>
              <p>
                {tab === 'Overview'
                  ? `Region-wide tracking of borrower repayments due today (${date}) and over the next 3 days (through ${addDays(
                      date,
                      3
                    )}).`
                  : `Monitor accounts due today (${date}) and the next 3 days (${addDays(date, 1)} to ${addDays(
                      date,
                      3
                    )}). Mark complete once paid to prevent SMA slippage.`}
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

          {/* Sync indicator banner */}
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
                <b>Live Bi-Directional Synchronization with Daily Reporting Portal</b>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Marking repayments complete or updating accounts here immediately updates the{' '}
                  <b>Daily Reporting Portal</b> dashboard and branch summary tables.
                </div>
              </div>
            </div>
            <button
              className="secondary"
              onClick={() => switchPortal('daily')}
              style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              Open Daily Reporting Portal <ArrowRight size={14} />
            </button>
          </div>

          {/* TAB 1: REGION-WIDE OVERVIEW (NON-BRANCH) */}
          {tab === 'Overview' && !isBranch && (
            <>
              <div className="stats">
                <div style={{ borderLeft: '4px solid #dc2626' }}>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>★ DUE TODAY ({date})</span>
                  <strong style={{ color: '#b91c1c' }}>₹{fmt(regionDueTodayAmt)}</strong>
                  <small>
                    {regionDueToday.length} accounts due today ({regionDueTodayPendCount} pending ·{' '}
                    {regionDueTodayComp.length} completed)
                  </small>
                </div>
                <div>
                  <span>Next 3 Days Advance Due</span>
                  <strong style={{ color: '#0369a1' }}>₹{fmt(regionNext3DaysAmt)}</strong>
                  <small>{regionNext3Days.length} accounts due {addDays(date, 1)} to {addDays(date, 3)}</small>
                </div>
                <div>
                  <span>Total Scheduled (Today + 3 Days)</span>
                  <strong>₹{fmt(regionTotalAmt)}</strong>
                  <small>{allRepayments.length} total borrower accounts</small>
                </div>
                <div>
                  <span>Total Cleared / Paid</span>
                  <strong style={{ color: '#059669' }}>₹{fmt(regionTotalCompAmt)}</strong>
                  <small>
                    {regionTotalCompCount} accounts cleared ({allRepayments.length ? Math.round((regionTotalCompCount / allRepayments.length) * 100) : 0}%)
                  </small>
                </div>
              </div>

              <div className="panel">
                <div className="paneltop">
                  <div>
                    <h2>Branch Repayment Follow-up Status</h2>
                    <p>Accounts slated for repayment today ({date}) and over the next 3 days.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      const csvHeader =
                        'SOL,Branch,Due Today Accts,Due Today ₹,Due Today Completed,Due Today Pending,Next 3 Days Accts,Next 3 Days ₹,Total Accts,Total Due ₹,Total Cleared ₹,Completion %\n';
                      const csvRows = data.branches
                        .map((b: any) => {
                          const branchItems = allRepayments.filter((r: any) => r.sol === b.sol);
                          const todayItems = branchItems.filter((r: any) => r.due_date === date);
                          const todayAmt = todayItems.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const todayComp = todayItems.filter((r: any) => r.completed);
                          const todayPend = todayItems.length - todayComp.length;
                          const next3Items = branchItems.filter((r: any) => r.due_date > date);
                          const next3Amt = next3Items.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const totalAmt = todayAmt + next3Amt;
                          const totalCompAmt = branchItems
                            .filter((r: any) => r.completed)
                            .reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const totalCompCount = branchItems.filter((r: any) => r.completed).length;
                          const pct = branchItems.length
                            ? Math.round((totalCompCount / branchItems.length) * 100)
                            : 100;

                          return [
                            b.sol,
                            `"${b.name}"`,
                            todayItems.length,
                            todayAmt,
                            todayComp.length,
                            todayPend,
                            next3Items.length,
                            next3Amt,
                            branchItems.length,
                            totalAmt,
                            totalCompAmt,
                            pct + '%',
                          ].join(',');
                        })
                        .join('\n');
                      downloadCsv(`IOB_repayments_summary_${date}.csv`, csvHeader + csvRows);
                    }}
                  >
                    <Download size={16} /> Export repayment summary
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
                        <th>DUE TODAY ({date})</th>
                        <th>NEXT 3 DAYS DUE</th>
                        <th>TOTAL SCHEDULED</th>
                        <th>CLEARED / PAID</th>
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
                          const branchItems = allRepayments.filter((r: any) => r.sol === b.sol);
                          const todayItems = branchItems.filter((r: any) => r.due_date === date);
                          const todayAmt = todayItems.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const todayComp = todayItems.filter((r: any) => r.completed);
                          const todayPend = todayItems.length - todayComp.length;
                          const next3Items = branchItems.filter((r: any) => r.due_date > date);
                          const next3Amt = next3Items.reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const totalAmt = todayAmt + next3Amt;
                          const compAmt = branchItems
                            .filter((r: any) => r.completed)
                            .reduce((acc, r) => acc + Number(r.due_amount || 0), 0);
                          const compCount = branchItems.filter((r: any) => r.completed).length;
                          const pct = branchItems.length ? Math.round((compCount / branchItems.length) * 100) : 100;

                          return (
                            <tr key={b.sol}>
                              <td>
                                <b>{b.name}</b>
                                <small>SOL {b.sol}</small>
                              </td>
                              <td data-label="Due Today">
                                {todayItems.length ? (
                                  <div>
                                    <b style={{ color: todayPend ? '#b91c1c' : '#059669' }}>₹{fmt(todayAmt)}</b>
                                    <small style={{ color: todayPend ? '#dc2626' : '#166534', fontWeight: 600 }}>
                                      {todayPend ? `★ ${todayPend} pending` : 'All cleared'} ({todayComp.length}/{todayItems.length})
                                    </small>
                                  </div>
                                ) : (
                                  <span style={{ color: '#64748b' }}>—</span>
                                )}
                              </td>
                              <td data-label="Next 3 Days">
                                {next3Items.length ? (
                                  <div>
                                    <b>₹{fmt(next3Amt)}</b>
                                    <small>{next3Items.length} accounts</small>
                                  </div>
                                ) : (
                                  <span style={{ color: '#64748b' }}>—</span>
                                )}
                              </td>
                              <td data-label="Total Scheduled">
                                <b>₹{fmt(totalAmt)}</b>
                                <small>{branchItems.length} accounts</small>
                              </td>
                              <td data-label="Cleared">
                                <b style={{ color: compCount ? '#059669' : '#64748b' }}>₹{fmt(compAmt)}</b>
                                <small>{compCount} of {branchItems.length} paid</small>
                              </td>
                              <td data-label="Status">
                                <span
                                  className={
                                    'badge ' +
                                    (todayPend === 0 && branchItems.length > 0
                                      ? 'reviewed'
                                      : todayPend > 0
                                        ? 'clarification'
                                        : 'pending')
                                  }
                                >
                                  {branchItems.length === 0
                                    ? 'No accounts due'
                                    : todayPend > 0
                                      ? `${todayPend} due today pending`
                                      : `${pct}% cleared`}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="textbutton"
                                  onClick={() => {
                                    setSol(b.sol);
                                    setTab('Repayment follow-up');
                                  }}
                                >
                                  Open list <ChevronRight size={15} />
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

          {/* TAB 2: DETAILED REPAYMENT FOLLOW-UP LIST */}
          {tab === 'Repayment follow-up' && (
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
                        `IOB SMA Follow-up: Dear Branch Head (${currentBranch?.name}), please review repayments due today (${branchDueTodayPend.length} pending, ₹${fmt(
                          branchDueTodayPendAmt
                        )}) and next 3 days (${branchNext3DaysPend.length} pending, ₹${fmt(branchNext3DaysPendAmt)}).`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare size={14} /> Message Branch Head
                    </a>
                  )}
                </div>
              )}

              {/* Branch summary stats */}
              <div className="stats">
                <div style={{ borderLeft: '4px solid #dc2626' }}>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>★ DUE TODAY ({date})</span>
                  <strong style={{ color: '#b91c1c' }}>₹{fmt(branchDueTodayAmt)}</strong>
                  <small>
                    {branchDueToday.length} accounts ({branchDueTodayPend.length} pending ·{' '}
                    {branchDueTodayComp.length} cleared)
                  </small>
                </div>
                <div>
                  <span>Next 3 Days Advance Due</span>
                  <strong style={{ color: '#0369a1' }}>₹{fmt(branchNext3DaysAmt)}</strong>
                  <small>{branchNext3Days.length} accounts ({branchNext3DaysPend.length} pending)</small>
                </div>
                <div>
                  <span>Total Due (Today + 3 Days)</span>
                  <strong>₹{fmt(branchTotalAmt)}</strong>
                  <small>{branchTotalCount} total accounts slated for repayment</small>
                </div>
                <div>
                  <span>Total Marked Completed</span>
                  <strong style={{ color: '#059669' }}>₹{fmt(branchTotalCompAmt)}</strong>
                  <small>
                    {branchTotalCompCount} cleared ({branchTotalCount ? Math.round((branchTotalCompCount / branchTotalCount) * 100) : 0}%)
                  </small>
                </div>
              </div>

              <div className="panel">
                <div className="paneltop">
                  <div>
                    <h2>Today’s Repayments Due & Next 3 Days Follow-up</h2>
                    <p>
                      Due dates from today ({date}) through {addDays(date, 3)}. Branch heads should mark each repayment
                      complete once payment is received to prevent SMA slippage.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                      Today: {branchDueTodayPend.length} pending
                    </span>
                    <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                      Total: {branchTotalCompCount} completed
                    </span>
                  </div>
                </div>

                <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    placeholder="Search account name or CIF…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="All">All accounts (Today + 3 Days)</option>
                    <option value="Due today">★ Due Today ({date})</option>
                    <option value="Next 3 days">Next 3 days ({addDays(date, 1)} to {addDays(date, 3)})</option>
                    <option value="Pending">Pending only</option>
                    <option value="Completed">Completed only</option>
                  </select>
                </div>

                {filteredAccounts.length ? (
                  <>
                    <div className="tablewrap branchlist repaylist">
                      <table>
                        <thead>
                          <tr>
                            <th>BORROWER / CIF</th>
                            <th>REPAYMENT DUE</th>
                            <th>DUE DATE & PERIOD</th>
                            <th>STATUS</th>
                            <th>FOLLOW-UP / ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAccounts.map((r: any) => {
                            const isDueToday = r.due_date === date;
                            const isPast = r.due_date < date;

                            return (
                              <tr
                                key={r.id}
                                style={{
                                  background: isDueToday
                                    ? r.completed
                                      ? '#f0fdf4'
                                      : '#fff1f2'
                                    : r.completed
                                      ? '#f0fdf4'
                                      : '#fff',
                                }}
                              >
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <b>{r.account_name}</b>
                                    {isDueToday && (
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#dc2626',
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                        }}
                                      >
                                        DUE TODAY
                                      </span>
                                    )}
                                  </div>
                                  <small>CIF: {r.cif}</small>
                                  {!isBranch && <small style={{ color: '#0369a1' }}>SOL {r.sol}</small>}
                                </td>
                                <td data-label="Repayment due">
                                  <b style={{ color: r.completed ? '#059669' : isDueToday ? '#dc2626' : '#b91c1c', fontSize: 15 }}>
                                    ₹{fmt(r.due_amount)}
                                  </b>
                                  <small>{r.completed ? 'Cleared in CBS' : isDueToday ? '★ Critical today' : 'Scheduled'}</small>
                                </td>
                                <td data-label="Due date">
                                  <b>{r.due_date}</b>
                                  <small
                                    style={{
                                      color: isDueToday ? '#b91c1c' : isPast ? '#991b1b' : '#0369a1',
                                      fontWeight: isDueToday ? 700 : 600,
                                    }}
                                  >
                                    {dueLabel(r.due_date)}
                                  </small>
                                </td>
                                <td data-label="Status">
                                  <span className={'badge ' + (r.completed ? 'reviewed' : isDueToday ? 'clarification' : 'pending')}>
                                    {r.completed ? 'Completed' : 'Pending'}
                                  </span>
                                  {r.completed && r.completedBy && (
                                    <small style={{ display: 'block', marginTop: 2 }}>By: {r.completedBy}</small>
                                  )}
                                </td>
                                <td data-label="Actions">
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {(isBranch || isAdmin) && (
                                      <button
                                        type="button"
                                        className={r.completed ? 'secondary' : ''}
                                        disabled={busy}
                                        onClick={() => toggleRepaymentStatus(r.sol, r.id, r.completed)}
                                        style={{
                                          fontSize: 12,
                                          padding: '6px 12px',
                                          background: r.completed ? undefined : isDueToday ? '#dc2626' : undefined,
                                          borderColor: r.completed ? undefined : isDueToday ? '#b91c1c' : undefined,
                                        }}
                                      >
                                        {r.completed ? 'Completed · Undo' : isDueToday ? '★ Mark Paid Today' : 'Mark Complete'}
                                      </button>
                                    )}
                                    <a
                                      className="secondary button"
                                      href={`https://wa.me/?text=${encodeURIComponent(
                                        `Indian Overseas Bank ${currentBranch?.name || ''} Branch: Dear ${r.account_name}, your loan installment of ₹${fmt(
                                          r.due_amount
                                        )} is due for repayment ${isDueToday ? 'TODAY (' + date + ')' : 'on ' + r.due_date}. Please ensure payment today to keep your account regular and prevent SMA classification.`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 11,
                                        padding: '6px 10px',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      <MessageSquare size={13} color="#25D366" /> Share reminder
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {filteredAccounts.length > 50 && (
                      <button
                        type="button"
                        className="secondary"
                        style={{ marginTop: 12, width: '100%' }}
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? 'Show top 50 accounts' : `Show all ${filteredAccounts.length} accounts`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="empty">
                    <CalendarClock size={32} />
                    <h3>No repayments found</h3>
                    <p>
                      {branchRepayments.length
                        ? 'No accounts match the current filter.'
                        : 'No accounts slated for repayment today or in the next 3 days for this branch.'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: UPLOAD REPAYMENTS (ADMIN ONLY) */}
          {tab === 'Upload repayments' && isAdmin && (
            <div className="panel">
              <div className="paneltop">
                <div>
                  <h2>Upload Repayment Accounts (CSV)</h2>
                  <p>Bulk upload loan accounts with repayments falling due today and in the next 3 days across all 56 branches.</p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const sample =
                      'branch_code,cif,account_name,due_amount,due_date\n0174,CIF1002341,Senthil Nathan K,185000,' +
                      date +
                      '\n0332,CIF1005892,Meenakshi Traders,420000,' +
                      date +
                      '\n0376,CIF2001452,Palanisamy Murugan,650000,' +
                      addDays(date, 1) +
                      '\n0175,CIF3004519,Lakshmi Cotton Mills,320000,' +
                      addDays(date, 2) +
                      '\n';
                    downloadCsv('IOB_repayments_template.csv', sample);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={15} /> Download template CSV
                </button>
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
                <h3>Select Repayments CSV File</h3>
                <p style={{ color: '#64748b', fontSize: 13, maxWidth: 500, margin: '0 auto 16px' }}>
                  Required columns: <code>branch_code</code> (SOL), <code>cif</code>, <code>account_name</code>,{' '}
                  <code>due_amount</code>, <code>due_date</code> (YYYY-MM-DD or DD/MM/YYYY).
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileRef}
                  onChange={handleCsvUpload}
                  disabled={busy}
                  style={{ display: 'none' }}
                  id="repay-file-input"
                />
                <label
                  htmlFor="repay-file-input"
                  className="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '10px 20px',
                  }}
                >
                  <Upload size={16} /> {busy ? 'Processing CSV…' : 'Choose CSV file'}
                </label>
              </div>

              <div style={{ background: '#f1f5f9', padding: 14, borderRadius: 8, fontSize: 12, color: '#475569' }}>
                <b>Repayment List Specifications:</b>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Includes accounts due <b>today ({date})</b> and through the <b>next 3 days ({addDays(date, 3)})</b>.</li>
                  <li>Re-uploading preserves existing completion status marked by branch heads.</li>
                  <li>Branch heads see only repayments belonging to their assigned SOL.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer>
          Indian Overseas Bank · Dindigul Regional SMA Prevention Portal · <span>All times are IST</span>
        </footer>
      </main>
    </div>
  );
}
