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
  Clock
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
  const [fundingAmountInput, setFundingAmountInput] = useState<{ [id: string]: string }>({});
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
        setTab('Low balance accounts');
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
            Dindigul region <ChevronRight size={14} /> Low Balance Funding <ChevronRight size={14} /> {tab}
          </div>
          <div className="headeractions">
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
            <span className={'private ' + (isSrm ? 'srm-tag' : '')}>
              {data.user.role === 'branch'
                ? 'Branch head'
                : data.user.role === 'reviewer'
                  ? 'Reviewer'
                  : data.user.role === 'srm'
                    ? 'Senior Regional Manager'
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
                                      {a.funded_by && <small>By {a.funded_by}</small>}
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
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <input
                                        type="number"
                                        placeholder="₹ amt"
                                        style={{ width: 85, fontSize: 12, padding: '4px 6px' }}
                                        value={fundingAmountInput[a.id] ?? ''}
                                        onChange={(e) =>
                                          setFundingAmountInput({
                                            ...fundingAmountInput,
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
                                          updateFundingStatus(
                                            a.sol,
                                            a.id,
                                            { funded: true, funded_amount: entered },
                                            `✓ Account marked funded with ₹${fmt(entered)}!`
                                          );
                                        }}
                                      >
                                        Mark Funded
                                      </button>
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
                <button type="button" className="secondary" onClick={exportCsv}>
                  <Download size={16} /> Export Region Summary
                </button>
              </div>

              <div className="tablewrap branchlist">
                <table>
                  <thead>
                    <tr>
                      <th>BRANCH</th>
                      <th>TOTAL LOW BAL</th>
                      <th>PENDING</th>
                      <th>FUNDED ACCTS</th>
                      <th>FUNDS MOBILIZED</th>
                      <th>CALLED %</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((b: any) => {
                      const branchList = allAccounts.filter((a: any) => a.sol === b.sol);
                      const fList = branchList.filter((a: any) => a.funded);
                      const pList = branchList.filter((a: any) => !a.funded);
                      const cCount = branchList.filter((a: any) => a.call_status && a.call_status !== 'not_called').length;
                      const fAmt = fList.reduce((acc, a) => acc + Number(a.funded_amount || 0), 0);
                      const pct = branchList.length ? Math.round((cCount / branchList.length) * 100) : 0;

                      return (
                        <tr key={b.sol}>
                          <td>
                            <b>{b.name}</b>
                            <small>SOL {b.sol}</small>
                          </td>
                          <td data-label="Total">{branchList.length}</td>
                          <td data-label="Pending">
                            <span style={{ color: pList.length > 0 ? '#dc2626' : '#166534', fontWeight: 600 }}>
                              {pList.length}
                            </span>
                          </td>
                          <td data-label="Funded">
                            <span style={{ color: '#059669', fontWeight: 600 }}>{fList.length}</span>
                          </td>
                          <td data-label="Mobilized">
                            <b>₹{fmt(fAmt)}</b>
                          </td>
                          <td data-label="Called %">
                            <span>{pct}%</span>
                            <small>{cCount} of {branchList.length}</small>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="textbutton"
                              onClick={() => {
                                setSol(b.sol);
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
    </div>
  );
}
