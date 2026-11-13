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
  Sparkles,
  Award,
  Printer,
  Check,
  UserCheck,
  PhoneCall,
  Phone,
  Pause,
  Play
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
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [selectedCertRoll, setSelectedCertRoll] = useState<string | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'logins' | 'cleared'>('all');
  const [readyRefFilter, setReadyRefFilter] = useState<'all' | 'logged' | 'pending' | 'attended' | 'cleared'>('all');
  const [readyRefSearch, setReadyRefSearch] = useState('');

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
        setTab((curr) => curr === 'Overview' ? 'Repayment follow-up' : curr);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRepaymentStatus(accountSol: string, accountId: string, currentCompleted: boolean, existingRollNo = '') {
    if (currentCompleted) {
      await act(
        {
          action: 'repayment-status',
          sol: accountSol,
          id: accountId,
          completed: false,
        },
        'Repayment marked pending. Status synced with Daily Reporting.'
      );
      return;
    }
    const defaultRoll = existingRollNo || (typeof window !== 'undefined' ? localStorage.getItem('iob_staff_roll_no') || '' : '');
    const roll = window.prompt('Staff Roll No (for Certificate of Appreciation tracking):', defaultRoll);
    if (roll === null) return;
    const trimmedRoll = roll.trim();
    if (trimmedRoll && typeof window !== 'undefined') {
      localStorage.setItem('iob_staff_roll_no', trimmedRoll);
    }
    await act(
      {
        action: 'repayment-status',
        sol: accountSol,
        id: accountId,
        completed: true,
        roll_no: trimmedRoll,
      },
      `✓ Repayment marked completed by Roll No ${trimmedRoll || 'Staff'}! Live synced.`
    );
  }

  async function updateBorrowerMobile(accountSol: string, accountId: string, currentMobile = '') {
    const raw = window.prompt(
      'Enter borrower 10-digit mobile number for calling & WhatsApp follow-up:',
      currentMobile ? currentMobile.replace(/^91/, '') : ''
    );
    if (raw === null) return;
    const clean = raw.replace(/[\s+-]/g, '');
    if (!/^[6-9]\d{9}$/.test(clean)) {
      alert('Please enter a valid 10-digit Indian mobile number (e.g. 9842100000)');
      return;
    }
    await act(
      {
        action: 'repayment-status',
        sol: accountSol,
        id: accountId,
        mobile: '91' + clean,
      },
      `✓ Updated borrower mobile +91 ${clean}. Call and WhatsApp ready.`
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

  // All repayments (due today + next 3 days)
  const allRepayments: any[] = data.repayments || [];
  const rawBranchRepayments: any[] = isBranch
    ? allRepayments
    : sol
      ? allRepayments.filter((r: any) => r.sol === sol)
      : allRepayments;

  // Group and sort by due_date, then CIF, then account_no so accounts under each CIF appear together
  const branchRepayments: any[] = [...rawBranchRepayments].sort(
    (a, b) =>
      a.due_date.localeCompare(b.due_date) ||
      (a.cif || '').localeCompare(b.cif || '') ||
      (a.account_no || '').localeCompare(b.account_no || '')
  );

  const cifAccountCounts = new Map<string, number>();
  for (const r of branchRepayments) {
    if (r.cif) {
      cifAccountCounts.set(r.cif, (cifAccountCounts.get(r.cif) || 0) + 1);
    }
  }

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
    const matchSearch =
      !q ||
      (r.cif + ' ' + (r.account_no || '') + ' ' + r.account_name).toLowerCase().includes(q);
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

  // Explicit real account number check (user: "for now don't show the account numbers, show them after i update the data")
  const hasAnyExplicitAccountNo = branchRepayments.some(
    (r: any) => Boolean(r.account_no) && !r.account_no.includes('020000') && !r.account_no.includes('010000')
  );
  const hasAnyExplicitBalance = branchRepayments.some((r: any) => r.balance !== null && r.balance !== undefined);

  // Group accounts by CIF for presentation
  const cifGroups = (() => {
    const map = new Map<
      string,
      {
        cif: string;
        account_name: string;
        mobile: string;
        sol: string;
        accounts: any[];
        totalDue: number;
        todayDue: number;
        totalBalance: number;
        todayPendingCount: number;
        totalPendingCount: number;
        isAllCompleted: boolean;
      }
    >();

    for (const r of filteredAccounts) {
      const key = r.cif || r.account_no || r.id;
      let grp = map.get(key);
      if (!grp) {
        grp = {
          cif: r.cif || '—',
          account_name: r.account_name,
          mobile: r.mobile || '',
          sol: r.sol,
          accounts: [],
          totalDue: 0,
          todayDue: 0,
          totalBalance: 0,
          todayPendingCount: 0,
          totalPendingCount: 0,
          isAllCompleted: true,
        };
        map.set(key, grp);
      }
      grp.accounts.push(r);
      const due = Number(r.due_amount || 0);
      grp.totalDue += due;
      if (r.balance !== null && r.balance !== undefined) {
        grp.totalBalance += Number(r.balance);
      }
      if (r.due_date === date) {
        grp.todayDue += due;
        if (!r.completed) grp.todayPendingCount++;
      }
      if (!r.completed) {
        grp.totalPendingCount++;
        grp.isAllCompleted = false;
      }
      if (!grp.mobile && r.mobile) {
        grp.mobile = r.mobile;
      }
    }

    return Array.from(map.values());
  })();

  const visibleCifGroups = showAll ? cifGroups : cifGroups.slice(0, 40);

  const logins: any[] = data.logins || [];
  const branchLogins = logins.filter((l: any) => l.role === 'branch');
  const loggedInSols = new Set(branchLogins.map((l: any) => l.sol));

  // Branch Metrics with sorting: 1. Logged in today at top, 2. Reduction in accounts due
  const branchMetrics = (data.branches || []).map((b: any) => {
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
    const isLoggedIn = loggedInSols.has(b.sol);
    const loginInfo = branchLogins.find((l: any) => l.sol === b.sol);
    const todayAttended = todayItems.filter(
      (r: any) => r.completed || (r.history && r.history.length > 0) || r.followup_notes
    );
    const branchGrant = (data.grants || []).find((g: any) => g.sol === b.sol && g.role === 'branch');
    const headPhone = loginInfo?.phone || branchGrant?.phone || b.phone || '';
    const headName = loginInfo?.name || branchGrant?.name || b.name + ' Branch Head';

    return {
      branch: b,
      isLoggedIn,
      loginInfo,
      headPhone,
      headName,
      branchItems,
      todayItems,
      todayAmt,
      todayComp,
      todayPend,
      todayAttended,
      next3Items,
      next3Amt,
      totalAmt,
      compAmt,
      compCount,
      pct,
      reduction: compCount,
      todayReduction: todayComp.length,
    };
  });

  const sortedBranchMetrics = branchMetrics
    .filter((m: any) =>
      (m.branch.name + ' ' + m.branch.sol).toLowerCase().includes(branchSearch.toLowerCase())
    )
    .sort((a: any, b: any) => {
      // 1. Those who have logged in today at the top
      if (a.isLoggedIn !== b.isLoggedIn) {
        return a.isLoggedIn ? -1 : 1;
      }
      // 2. Further sorted by reduction in accounts due (highest reduction at top)
      if (b.reduction !== a.reduction) {
        return b.reduction - a.reduction;
      }
      // Secondary: today's reduction
      if (b.todayReduction !== a.todayReduction) {
        return b.todayReduction - a.todayReduction;
      }
      // Amount cleared
      if (b.compAmt !== a.compAmt) {
        return b.compAmt - a.compAmt;
      }
      return a.branch.sol.localeCompare(b.branch.sol);
    });

  // Roll No Aggregations for Appreciation Certificate
  const rollStatsMap = new Map<string, { rollNo: string; count: number; completedCount: number; amount: number; sols: Set<string> }>();
  for (const r of branchRepayments) {
    const roll = (r.roll_no || '').trim();
    if (!roll) continue;
    let stat = rollStatsMap.get(roll);
    if (!stat) {
      stat = { rollNo: roll, count: 0, completedCount: 0, amount: 0, sols: new Set<string>() };
      rollStatsMap.set(roll, stat);
    }
    stat.count++;
    if (r.completed) {
      stat.completedCount++;
      stat.amount += Number(r.due_amount || 0);
    }
    if (r.sol) stat.sols.add(r.sol);
  }
  const rollLeaderboard = Array.from(rollStatsMap.values()).sort(
    (a, b) => b.completedCount - a.completedCount || b.amount - a.amount
  );

  // Chronological Activity Feed for branches that logged in or cleared accounts
  const activityFeed: Array<{
    id: string;
    sol: string;
    branchName: string;
    type: 'login' | 'clear' | 'standby';
    detailText: string;
    icon: string;
    time: string;
    timeStr: string;
  }> = [];

  // Logged-in branch heads
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

  // Branch updates: repayments marked cleared
  for (const r of allRepayments) {
    if (r.completed) {
      const b = data.branches.find((x: any) => x.sol === r.sol);
      const timeStr = r.completedAt
        ? new Date(r.completedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        : '';
      activityFeed.push({
        id: `clear-${r.id}`,
        sol: r.sol,
        branchName: b?.name || r.sol,
        type: 'clear',
        detailText: `Cleared ₹${fmt(r.due_amount)} for ${r.account_name}${r.roll_no ? ' (Roll: ' + r.roll_no + ')' : ''}`,
        icon: '✓',
        time: r.completedAt || '',
        timeStr,
      });
    }
  }

  activityFeed.sort((a, b) => b.time.localeCompare(a.time));

  const filteredFeed = activityFeed.filter((item) => {
    if (activityFilter === 'logins') return item.type === 'login';
    if (activityFilter === 'cleared') return item.type === 'clear';
    return true;
  });

  const displayFeed = activityExpanded ? filteredFeed : filteredFeed.slice(0, 4);

  const navItems = [
    ...(!isBranch ? [['Overview', LayoutDashboard]] : []),
    ['Repayment follow-up', CalendarClock],
    ...(!isBranch ? [['Branch Activity & Logins', UserCheck]] : []),
    ['Appreciation & Certificates', Award],
    ...(isAdmin ? [['Upload repayments', Upload]] : []),
  ];

  const renderReadyReference = (isFullTab = false) => {
    const totalBranches = data.branches?.length || 56;
    const loggedCount = branchLogins.length;
    const pendingCount = totalBranches - loggedCount;
    const attendedBranches = branchMetrics.filter((m: any) => m.todayAttended.length > 0).length;
    const allClearedBranches = branchMetrics.filter(
      (m: any) => m.todayItems.length > 0 && m.todayPend === 0
    ).length;

    const filteredMetrics = branchMetrics.filter((m: any) => {
      const q = readyRefSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.branch.name.toLowerCase().includes(q) ||
        m.branch.sol.includes(q) ||
        m.headName.toLowerCase().includes(q) ||
        m.headPhone.includes(q);

      if (!matchSearch) return false;

      if (readyRefFilter === 'logged') return m.isLoggedIn;
      if (readyRefFilter === 'pending') return !m.isLoggedIn;
      if (readyRefFilter === 'attended') return m.todayAttended.length > 0;
      if (readyRefFilter === 'cleared') return m.todayItems.length > 0 && m.todayPend === 0;
      return true;
    });

    return (
      <div className="panel" style={{ borderTop: '4px solid #1e40af', marginBottom: 24 }}>
        <div className="paneltop" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <UserCheck size={14} /> READY REFERENCE AUDIT
              </span>
              <h2>Branch Login & Case Attendance Status</h2>
            </div>
            <p>
              Real-time audit of all {totalBranches} branches: login activity, borrower cases attended today ({date}), and 1-click reminders.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="secondary"
              onClick={() => {
                const header =
                  'SOL,Branch Name,Head Name,Head Mobile,Login Status,Login Time,Today Due Count,Today Due Amount,Attended Count,Cleared Count,Pending Count\n';
                const rows = branchMetrics
                  .map((m: any) =>
                    [
                      m.branch.sol,
                      `"${m.branch.name}"`,
                      `"${m.headName}"`,
                      m.headPhone,
                      m.isLoggedIn ? 'Logged In' : 'Pending Login',
                      m.loginInfo?.lastActive
                        ? new Date(m.loginInfo.lastActive).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })
                        : '-',
                      m.todayItems.length,
                      m.todayAmt,
                      m.todayAttended.length,
                      m.todayComp.length,
                      m.todayPend,
                    ].join(',')
                  )
                  .join('\n');
                downloadCsv(`IOB_Branch_Login_Attendance_${date}.csv`, header + rows);
              }}
            >
              <Download size={14} /> Export Attendance CSV
            </button>
            {!isFullTab && (
              <button
                className="secondary"
                onClick={() => setTab('Branch Activity & Logins')}
                style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 600 }}
              >
                Detailed audit tab →
              </button>
            )}
          </div>
        </div>

        {/* 4 Stat KPI Cards */}
        <div className="stats" style={{ marginTop: 14 }}>
          <div style={{ borderLeft: '4px solid #059669' }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>🟢 LOGGED IN TODAY</span>
            <strong style={{ color: '#047857' }}>
              {loggedCount} <small style={{ fontSize: 16, color: '#64748b' }}>/ {totalBranches}</small>
            </strong>
            <small>{Math.round((loggedCount / totalBranches) * 100)}% branch participation</small>
          </div>
          <div style={{ borderLeft: '4px solid #dc2626' }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ PENDING LOGIN</span>
            <strong style={{ color: '#b91c1c' }}>{pendingCount}</strong>
            <small>Branches not yet logged in today</small>
          </div>
          <div style={{ borderLeft: '4px solid #0284c7' }}>
            <span style={{ color: '#0284c7', fontWeight: 700 }}>📋 CASES ATTENDED</span>
            <strong style={{ color: '#0369a1' }}>
              {branchMetrics.reduce((sum: number, m: any) => sum + m.todayAttended.length, 0)}{' '}
              <small style={{ fontSize: 16, color: '#64748b' }}>
                / {branchMetrics.reduce((sum: number, m: any) => sum + m.todayItems.length, 0)}
              </small>
            </strong>
            <small>{attendedBranches} branches actively attending cases</small>
          </div>
          <div style={{ borderLeft: '4px solid #7c3aed' }}>
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>★ 100% CLEARED</span>
            <strong style={{ color: '#6d28d9' }}>{allClearedBranches}</strong>
            <small>Branches with 0 pending accounts</small>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <input
            placeholder="Search branch name, SOL, manager..."
            value={readyRefSearch}
            onChange={(e) => setReadyRefSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All (${totalBranches})` },
              { id: 'logged', label: `🟢 Logged In (${loggedCount})` },
              { id: 'pending', label: `⚠️ Pending Login (${pendingCount})` },
              { id: 'attended', label: `✓ Attended Cases (${attendedBranches})` },
              { id: 'cleared', label: `★ 100% Cleared (${allClearedBranches})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={readyRefFilter === f.id ? '' : 'secondary'}
                onClick={() => setReadyRefFilter(f.id as any)}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontWeight: 600,
                  minHeight: 32,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        <div className="tablewrap branchlist">
          <table>
            <thead>
              <tr>
                <th>BRANCH & SOL</th>
                <th>LOGIN STATUS</th>
                <th>BRANCH HEAD</th>
                <th>TODAY'S DUE ACCOUNTS</th>
                <th>ATTENDANCE & PROGRESS</th>
                <th>DIRECT ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics.map((m: any) => {
                const loginTime = m.loginInfo?.lastActive
                  ? new Date(m.loginInfo.lastActive).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null;
                const cleanPhone = m.headPhone.replace(/\D/g, '');
                const waPhone = cleanPhone.startsWith('91') ? cleanPhone : cleanPhone ? `91${cleanPhone}` : '';
                const waMsg = `Dear Branch Head (${m.branch.name} - SOL ${m.branch.sol}),\n\nDaily SMA Prevention Alert: ${
                  !m.isLoggedIn ? 'You have not logged in yet today. ' : ''
                }You have ${m.todayItems.length} borrower repayment accounts due today totaling ₹${fmt(m.todayAmt)} (${m.todayPend} pending). Please attend to them immediately on the portal to prevent slippage.\n\nPortal: https://dailyreport-sma-9265a.web.app/`;

                return (
                  <tr key={`ready-${m.branch.sol}`} style={{ background: m.isLoggedIn ? '#fcfdfd' : '#fff' }}>
                    <td>
                      <b>{m.branch.name}</b>
                      <small>SOL {m.branch.sol}</small>
                    </td>
                    <td>
                      {m.isLoggedIn ? (
                        <span
                          className="badge"
                          style={{
                            background: '#dcfce7',
                            color: '#166534',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Logged in {loginTime ? `at ${loginTime}` : 'today'}
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <AlertTriangle size={12} /> Not logged in
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.headName}</div>
                      <small>{m.headPhone ? `+${m.headPhone}` : 'No phone listed'}</small>
                    </td>
                    <td>
                      {m.todayItems.length ? (
                        <div>
                          <b style={{ color: m.todayPend ? '#b91c1c' : '#059669' }}>₹{fmt(m.todayAmt)}</b>
                          <small style={{ color: m.todayPend ? '#dc2626' : '#166534', fontWeight: 600 }}>
                            {m.todayComp.length}/{m.todayItems.length} accounts cleared
                          </small>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>No accounts due today</span>
                      )}
                    </td>
                    <td>
                      <div style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span>Attended: <b>{m.todayAttended.length}</b>/{m.todayItems.length}</span>
                          <span style={{ color: m.todayPend === 0 && m.todayItems.length > 0 ? '#059669' : '#64748b', fontWeight: 700 }}>
                            {m.todayItems.length ? Math.round((m.todayComp.length / m.todayItems.length) * 100) : 100}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${m.todayItems.length ? Math.round((m.todayComp.length / m.todayItems.length) * 100) : 100}%`,
                              background: m.todayPend === 0 && m.todayItems.length > 0 ? '#10b981' : '#3b82f6',
                            }}
                          />
                        </div>
                        {m.todayPend > 0 && (
                          <small style={{ color: '#dc2626', fontWeight: 600 }}>★ {m.todayPend} pending</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none',
                              color: '#1e40af',
                              borderColor: '#bfdbfe',
                              background: '#eff6ff',
                            }}
                            title={`Call ${m.headName}`}
                          >
                            <Phone size={11} /> Call
                          </a>
                        )}
                        {waPhone && (
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none',
                              color: '#047857',
                              borderColor: '#a7f3d0',
                              background: '#ecfdf5',
                            }}
                            title="Send WhatsApp Reminder"
                          >
                            <MessageSquare size={11} /> WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 8px', fontSize: 11, minHeight: 28 }}
                          onClick={() => {
                            setSol(m.branch.sol);
                            setTab('Repayment follow-up');
                          }}
                        >
                          Cases →
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
    );
  };

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
            Dindigul region <ChevronRight size={14} /> SMA Prevention <ChevronRight size={14} /> {tab}
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
                  Regional Live Activity Feed
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
                    onClick={() => setActivityFilter('cleared')}
                    style={{
                      background: activityFilter === 'cleared' ? '#ffffff' : 'transparent',
                      color: activityFilter === 'cleared' ? '#0d2344' : '#cbd5e1',
                      border: 0,
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      cursor: 'pointer',
                      minHeight: 'auto',
                    }}
                  >
                    ✓ Cleared ({activityFeed.filter((i) => i.type === 'clear').length})
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
                  const isClear = item.type === 'clear';
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
                            color: isLogin ? '#047857' : isClear ? '#1d4ed8' : '#64748b',
                            background: isLogin ? '#ecfdf5' : isClear ? '#eff6ff' : '#f1f5f9',
                            border: isLogin ? '1px solid #a7f3d0' : isClear ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
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
                          <span style={{ color: isClear ? '#047857' : '#334155', fontWeight: isClear ? 600 : 500 }}>
                            {item.detailText}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setSol(item.sol);
                          setTab('Repayment follow-up');
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
                        title={`Open ${item.branchName} (${item.sol}) repayments`}
                      >
                        Open Branch →
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px 20px', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                  No {activityFilter === 'logins' ? 'logins' : activityFilter === 'cleared' ? 'repayment clearances' : 'activity'} recorded today yet.
                </div>
              )}
            </div>
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

              {/* Ready Reference Summary on Overview */}
              {renderReadyReference(false)}

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

                <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <input
                    placeholder="Search branch or SOL…"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    style={{ minWidth: 240 }}
                  />
                  <span
                    className="badge"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '5px 10px',
                      border: '1px solid #bfdbfe',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Sparkles size={13} /> Ranked: Logged in today first · Sorted by reduction in accounts due
                  </span>
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
                      {sortedBranchMetrics.map((m: any) => {
                        return (
                          <tr key={m.branch.sol} style={{ background: m.isLoggedIn ? '#fcfdfd' : '#fff' }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <b>{m.branch.name}</b>
                              </div>
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
                            <td data-label="Due Today">
                              {m.todayItems.length ? (
                                <div>
                                  <b style={{ color: m.todayPend ? '#b91c1c' : '#059669' }}>₹{fmt(m.todayAmt)}</b>
                                  <small style={{ color: m.todayPend ? '#dc2626' : '#166534', fontWeight: 600 }}>
                                    {m.todayPend ? `★ ${m.todayPend} pending` : 'All cleared'} ({m.todayComp.length}/{m.todayItems.length})
                                  </small>
                                </div>
                              ) : (
                                <span style={{ color: '#64748b' }}>—</span>
                              )}
                            </td>
                            <td data-label="Next 3 Days">
                              {m.next3Items.length ? (
                                <div>
                                  <b>₹{fmt(m.next3Amt)}</b>
                                  <small>{m.next3Items.length} accounts</small>
                                </div>
                              ) : (
                                <span style={{ color: '#64748b' }}>—</span>
                              )}
                            </td>
                            <td data-label="Total Scheduled">
                              <b>₹{fmt(m.totalAmt)}</b>
                              <small>{m.branchItems.length} accounts</small>
                            </td>
                            <td data-label="Cleared">
                              <b style={{ color: m.compCount ? '#059669' : '#64748b' }}>₹{fmt(m.compAmt)}</b>
                              <small>{m.compCount} of {m.branchItems.length} paid</small>
                              {m.reduction > 0 && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'inline-block',
                                    marginTop: 3,
                                  }}
                                >
                                  ↓ {m.reduction} reduced
                                </span>
                              )}
                            </td>
                            <td data-label="Status">
                              <span
                                className={
                                  'badge ' +
                                  (m.todayPend === 0 && m.branchItems.length > 0
                                    ? 'reviewed'
                                    : m.todayPend > 0
                                      ? 'clarification'
                                      : 'pending')
                                }
                              >
                                {m.branchItems.length === 0
                                  ? 'No accounts due'
                                  : m.todayPend > 0
                                    ? `${m.todayPend} due today pending`
                                    : `${m.pct}% cleared`}
                              </span>
                            </td>
                            <td>
                              <button
                                className="textbutton"
                                onClick={() => {
                                  setSol(m.branch.sol);
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

          {/* TAB: BRANCH ACTIVITY & LOGINS (READY REFERENCE) */}
          {tab === 'Branch Activity & Logins' && !isBranch && renderReadyReference(true)}

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

                <div className="toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    placeholder="Search CIF, borrower name, mobile…"
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
                  <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid #cbd5e1' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('grouped')}
                      style={{
                        background: viewMode === 'grouped' ? '#0d4b9f' : 'transparent',
                        color: viewMode === 'grouped' ? '#fff' : '#475569',
                        border: 0,
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      👥 Group by CIF
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('flat')}
                      style={{
                        background: viewMode === 'flat' ? '#0d4b9f' : 'transparent',
                        color: viewMode === 'flat' ? '#fff' : '#475569',
                        border: 0,
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      📋 Flat List
                    </button>
                  </div>
                </div>

                {filteredAccounts.length ? (
                  <>
                    {viewMode === 'grouped' ? (
                      /* VIEW 1: GROUPED BY CIF */
                      <div className="cif-groups-container">
                        {visibleCifGroups.map((grp) => {
                          const isCifDueToday = grp.todayDue > 0;
                          const isTodayPending = grp.todayPendingCount > 0;
                          const rawMobile = grp.mobile ? grp.mobile.replace(/^91/, '') : '';
                          const waMobile = grp.mobile ? (grp.mobile.startsWith('91') ? grp.mobile : '91' + grp.mobile) : '';
                          const callMobile = grp.mobile ? (grp.mobile.startsWith('91') ? '+' + grp.mobile : '+91' + grp.mobile) : '';

                          return (
                            <div
                              key={grp.cif}
                              style={{
                                background: '#fff',
                                border: isTodayPending ? '2px solid #fca5a5' : '1px solid #e2e8f0',
                                borderRadius: 12,
                                marginBottom: 16,
                                boxShadow: isTodayPending ? '0 4px 14px rgba(220, 38, 38, 0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* CIF Group Header Bar */}
                              <div
                                style={{
                                  background: isTodayPending ? '#fff5f5' : '#f8fafc',
                                  padding: '14px 18px',
                                  borderBottom: '1px solid #edf2f7',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                                      {grp.account_name}
                                    </span>
                                    <span
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: '#e2e8f0',
                                        color: '#334155',
                                        padding: '2px 8px',
                                        borderRadius: 5,
                                      }}
                                    >
                                      CIF: {grp.cif}
                                    </span>
                                    {grp.accounts.length > 1 && (
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#dbeafe',
                                          color: '#1e40af',
                                          fontSize: 11,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {grp.accounts.length} A/Cs under CIF
                                      </span>
                                    )}
                                    {isTodayPending && (
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#dc2626',
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 800,
                                          padding: '2px 8px',
                                        }}
                                      >
                                        ★ {grp.todayPendingCount} DUE TODAY
                                      </span>
                                    )}
                                    {grp.isAllCompleted && (
                                      <span
                                        className="badge"
                                        style={{
                                          background: '#dcfce7',
                                          color: '#15803d',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: '2px 8px',
                                        }}
                                      >
                                        ✓ ALL CLEARED
                                      </span>
                                    )}
                                    {!isBranch && <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>SOL {grp.sol}</span>}
                                  </div>

                                  {/* Provision for Mobile Number (Call & WhatsApp / SMS Message) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {rawMobile ? (
                                      <>
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#1e293b',
                                            background: '#f1f5f9',
                                            padding: '3px 8px',
                                            borderRadius: 6,
                                            border: '1px solid #cbd5e1',
                                          }}
                                        >
                                          <Phone size={12} color="#0d4b9f" /> +91 {rawMobile}
                                        </span>
                                        <a
                                          href={`tel:${callMobile}`}
                                          className="button"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            background: '#0d4b9f',
                                            color: '#fff',
                                            fontSize: 11,
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            textDecoration: 'none',
                                            fontWeight: 700,
                                          }}
                                          title={`Call ${grp.account_name} on ${callMobile}`}
                                        >
                                          <Phone size={12} /> Call
                                        </a>
                                        <a
                                          href={`https://wa.me/${waMobile}?text=${encodeURIComponent(
                                            `Indian Overseas Bank ${currentBranch?.name || ''} Branch:\nDear ${grp.account_name},\nYour loan repayment of ₹${fmt(
                                              grp.totalDue
                                            )} is due for repayment ${isCifDueToday ? 'TODAY (' + date + ')' : 'shortly'}. Please deposit the amount to keep your account standard and prevent SMA classification.\nThank you.`
                                          )}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="button"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            background: '#25D366',
                                            color: '#fff',
                                            fontSize: 11,
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            textDecoration: 'none',
                                            fontWeight: 700,
                                          }}
                                          title="Send WhatsApp repayment reminder"
                                        >
                                          <MessageSquare size={12} /> WhatsApp
                                        </a>
                                        <a
                                          href={`sms:${callMobile}?body=${encodeURIComponent(
                                            `IOB ${currentBranch?.name || ''}: Dear ${grp.account_name}, loan repayment of ₹${fmt(
                                              grp.totalDue
                                            )} is due ${isCifDueToday ? 'TODAY' : 'shortly'}. Please ensure payment to keep your account standard.`
                                          )}`}
                                          className="secondary button"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            fontSize: 11,
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            textDecoration: 'none',
                                            fontWeight: 700,
                                          }}
                                          title="Send SMS"
                                        >
                                          ✉ SMS
                                        </a>
                                        {(isBranch || isAdmin) && (
                                          <button
                                            type="button"
                                            onClick={() => updateBorrowerMobile(grp.sol, grp.accounts[0]?.id, grp.mobile)}
                                            style={{
                                              background: 'none',
                                              border: 0,
                                              color: '#64748b',
                                              fontSize: 11,
                                              textDecoration: 'underline',
                                              cursor: 'pointer',
                                              padding: '2px 4px',
                                            }}
                                            title="Change mobile number"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No mobile recorded</span>
                                        {(isBranch || isAdmin) && (
                                          <button
                                            type="button"
                                            onClick={() => updateBorrowerMobile(grp.sol, grp.accounts[0]?.id, '')}
                                            className="secondary"
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 4,
                                              fontSize: 11,
                                              padding: '3px 8px',
                                              borderRadius: 6,
                                            }}
                                          >
                                            + Add Mobile Number
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* CIF Totals */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Repayment Due</div>
                                  <b style={{ fontSize: 18, color: isTodayPending ? '#dc2626' : '#0f172a' }}>
                                    ₹{fmt(grp.totalDue)}
                                  </b>
                                  {hasAnyExplicitBalance && grp.totalBalance > 0 && (
                                    <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                                      Outstanding Bal: ₹{fmt(grp.totalBalance)}
                                    </small>
                                  )}
                                </div>
                              </div>

                              {/* Sub-table of accounts under this CIF */}
                              <div className="tablewrap" style={{ overflowX: 'auto' }}>
                                <table style={{ margin: 0, width: '100%', background: '#fff' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                      {hasAnyExplicitAccountNo && <th style={{ padding: '8px 14px' }}>ACCOUNT NUMBER</th>}
                                      <th style={{ padding: '8px 14px' }}>REPAYMENT DUE</th>
                                      {hasAnyExplicitBalance && <th style={{ padding: '8px 14px' }}>OUTSTANDING BALANCE</th>}
                                      <th style={{ padding: '8px 14px' }}>DUE DATE & PERIOD</th>
                                      <th style={{ padding: '8px 14px' }}>STATUS</th>
                                      <th style={{ padding: '8px 14px' }}>ACTIONS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grp.accounts.map((r: any) => {
                                      const isDueToday = r.due_date === date;
                                      const isPast = r.due_date < date;
                                      return (
                                        <tr
                                          key={r.id}
                                          style={{
                                            background: isDueToday ? (r.completed ? '#f0fdf4' : '#fff1f2') : (r.completed ? '#f0fdf4' : '#fff'),
                                            borderBottom: '1px solid #f1f5f9',
                                          }}
                                        >
                                          {hasAnyExplicitAccountNo && (
                                            <td data-label="Account Number" style={{ padding: '10px 14px' }}>
                                              <span
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 700,
                                                  fontSize: 13,
                                                  color: '#1e293b',
                                                  background: '#f8fafc',
                                                  padding: '2px 6px',
                                                  borderRadius: 4,
                                                  border: '1px solid #e2e8f0',
                                                }}
                                              >
                                                {r.account_no}
                                              </span>
                                            </td>
                                          )}
                                          <td data-label="Repayment Due" style={{ padding: '10px 14px' }}>
                                            <b style={{ color: r.completed ? '#059669' : isDueToday ? '#dc2626' : '#b91c1c', fontSize: 14 }}>
                                              ₹{fmt(r.due_amount)}
                                            </b>
                                            <small style={{ display: 'block', color: '#64748b' }}>
                                              {r.completed ? 'Cleared in CBS' : isDueToday ? '★ Due Today' : 'Scheduled'}
                                            </small>
                                          </td>
                                          {hasAnyExplicitBalance && (
                                            <td data-label="Outstanding Balance" style={{ padding: '10px 14px' }}>
                                              <b style={{ color: '#1e293b', fontSize: 13 }}>₹{fmt(r.balance || 0)}</b>
                                            </td>
                                          )}
                                          <td data-label="Due Date" style={{ padding: '10px 14px' }}>
                                            <b style={{ color: isDueToday ? '#b91c1c' : '#1e293b' }}>{r.due_date}</b>
                                            <small
                                              style={{
                                                display: 'block',
                                                color: isDueToday ? '#dc2626' : isPast ? '#991b1b' : '#0369a1',
                                                fontWeight: isDueToday ? 700 : 600,
                                              }}
                                            >
                                              {dueLabel(r.due_date)}
                                            </small>
                                          </td>
                                          <td data-label="Status" style={{ padding: '10px 14px' }}>
                                            <span className={'badge ' + (r.completed ? 'reviewed' : isDueToday ? 'clarification' : 'pending')}>
                                              {r.completed ? 'Completed' : 'Pending'}
                                            </span>
                                            {r.completed && r.completedBy && (
                                              <small style={{ display: 'block', marginTop: 2, fontSize: 10 }}>
                                                By: {r.completedBy}{r.roll_no ? ` (${r.roll_no})` : ''}
                                              </small>
                                            )}
                                          </td>
                                          <td data-label="Actions" style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                              {(isBranch || isAdmin) && (
                                                <button
                                                  type="button"
                                                  className={r.completed ? 'secondary' : ''}
                                                  disabled={busy}
                                                  onClick={() => toggleRepaymentStatus(r.sol, r.id, r.completed, r.roll_no)}
                                                  style={{
                                                    fontSize: 11,
                                                    padding: '5px 10px',
                                                    background: r.completed ? undefined : isDueToday ? '#dc2626' : undefined,
                                                    borderColor: r.completed ? undefined : isDueToday ? '#b91c1c' : undefined,
                                                  }}
                                                >
                                                  {r.completed ? 'Completed · Undo' : isDueToday ? '★ Mark Paid Today' : 'Mark Complete'}
                                                </button>
                                              )}
                                              <a
                                                className="secondary button"
                                                href={`https://wa.me/${grp.mobile ? (grp.mobile.startsWith('91') ? grp.mobile : '91' + grp.mobile) : ''}?text=${encodeURIComponent(
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
                                                  padding: '5px 8px',
                                                  textDecoration: 'none',
                                                }}
                                              >
                                                <MessageSquare size={12} color="#25D366" /> WhatsApp
                                              </a>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* VIEW 2: FLAT TABLE */
                      <div className="tablewrap branchlist repaylist">
                        <table>
                          <thead>
                            <tr>
                              <th>BORROWER / CIF</th>
                              {hasAnyExplicitAccountNo && <th>ACCOUNT NUMBER</th>}
                              {hasAnyExplicitBalance && <th>OUTSTANDING BALANCE</th>}
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
                              const totalCifAccounts = cifAccountCounts.get(r.cif) || 1;
                              const rawMobile = r.mobile ? r.mobile.replace(/^91/, '') : '';
                              const waMobile = r.mobile ? (r.mobile.startsWith('91') ? r.mobile : '91' + r.mobile) : '';
                              const callMobile = r.mobile ? (r.mobile.startsWith('91') ? '+' + r.mobile : '+91' + r.mobile) : '';

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
                                  <td data-label="Borrower / CIF">
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                                      <small style={{ fontWeight: 600, color: '#475569' }}>CIF: {r.cif}</small>
                                      {totalCifAccounts > 1 && (
                                        <span
                                          className="badge"
                                          style={{
                                            background: '#fef3c7',
                                            color: '#92400e',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                          }}
                                        >
                                          {totalCifAccounts} A/Cs under CIF
                                        </span>
                                      )}
                                    </div>
                                    {rawMobile && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                                          📱 +91 {rawMobile}
                                        </span>
                                        <a href={`tel:${callMobile}`} style={{ fontSize: 11, color: '#0d4b9f', fontWeight: 700 }}>
                                          📞 Call
                                        </a>
                                      </div>
                                    )}
                                    {!isBranch && <small style={{ color: '#0369a1' }}>SOL {r.sol}</small>}
                                    {r.roll_no && (
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
                                          🏅 Roll: {r.roll_no}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  {hasAnyExplicitAccountNo && (
                                    <td data-label="Account number">
                                      <span
                                        style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 700,
                                          fontSize: 13,
                                          color: '#1e293b',
                                          background: '#f8fafc',
                                          padding: '3px 7px',
                                          borderRadius: 5,
                                          border: '1px solid #e2e8f0',
                                          display: 'inline-block',
                                          letterSpacing: '0.5px',
                                        }}
                                      >
                                        {r.account_no}
                                      </span>
                                    </td>
                                  )}
                                  {hasAnyExplicitBalance && (
                                    <td data-label="Outstanding balance">
                                      <b style={{ color: '#1e293b', fontSize: 14 }}>₹{fmt(r.balance || 0)}</b>
                                    </td>
                                  )}
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
                                      <small style={{ display: 'block', marginTop: 2 }}>By: {r.completedBy}{r.roll_no ? ` (${r.roll_no})` : ''}</small>
                                    )}
                                  </td>
                                  <td data-label="Actions">
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                      {(isBranch || isAdmin) && (
                                        <button
                                          type="button"
                                          className={r.completed ? 'secondary' : ''}
                                          disabled={busy}
                                          onClick={() => toggleRepaymentStatus(r.sol, r.id, r.completed, r.roll_no)}
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
                                        href={`https://wa.me/${waMobile}?text=${encodeURIComponent(
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
                                        <MessageSquare size={13} color="#25D366" /> WhatsApp
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {viewMode === 'grouped' ? (
                      cifGroups.length > 40 && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ marginTop: 12, width: '100%' }}
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? 'Show top 40 CIF groups' : `Show all ${cifGroups.length} CIF groups (${filteredAccounts.length} accounts)`}
                        </button>
                      )
                    ) : (
                      filteredAccounts.length > 50 && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ marginTop: 12, width: '100%' }}
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? 'Show top 50 accounts' : `Show all ${filteredAccounts.length} accounts`}
                        </button>
                      )
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
                      'branch_code,cif,account_no,account_name,balance,due_amount,due_date,mobile\n' +
                      `0174,CIF1002341,,Senthil Nathan K,1850000,185000,${date},9842101234\n` +
                      `0174,CIF1002341,,Senthil Nathan K,450000,45000,${date},9842101234\n` +
                      `0332,CIF1005892,,Meenakshi Traders,3200000,420000,${date},9443218765\n` +
                      `0376,CIF2001452,,Palanisamy Murugan,2400000,650000,${addDays(date, 1)},9789456123\n` +
                      `0175,CIF3004519,,Lakshmi Cotton Mills,1600000,320000,${addDays(date, 2)},9500123489\n`;
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
                <p style={{ color: '#64748b', fontSize: 13, maxWidth: 680, margin: '0 auto 16px' }}>
                  Columns: <code>branch_code</code> (SOL), <code>cif</code>, <code>account_name</code>, <code>due_amount</code>, <code>due_date</code> (YYYY-MM-DD or DD/MM/YYYY), <code>mobile</code> (borrower contact for 1-click Call & WhatsApp), <code>balance</code> (optional outstanding balance), <code>account_no</code> (optional specific CBS loan account number).
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

          {/* TAB 4: APPRECIATION & CERTIFICATES */}
          {tab === 'Appreciation & Certificates' && (
            <div className="panel">
              {selectedCertRoll ? (
                <CertificateView
                  category="sma"
                  rollNo={selectedCertRoll}
                  branchName={
                    data.branches.find((b: any) =>
                      rollStatsMap.get(selectedCertRoll)?.sols.has(b.sol)
                    )?.name || ''
                  }
                  sol={Array.from(rollStatsMap.get(selectedCertRoll)?.sols || []).join(', ')}
                  count={rollStatsMap.get(selectedCertRoll)?.completedCount || 0}
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
                        Staff officers who follow up and reduce SMA accounts qualify for official Certificates of Appreciation
                        conferred by the General Manager (GM), Dindigul Regional Office.
                      </p>
                    </div>
                  </div>

                  <div className="stats" style={{ marginBottom: 20 }}>
                    <div>
                      <span>Staff Members Active</span>
                      <strong style={{ color: '#1e3a8a' }}>{rollLeaderboard.length}</strong>
                      <small>Followed up with Roll No</small>
                    </div>
                    <div>
                      <span>Accounts Cleared / Paid</span>
                      <strong style={{ color: '#059669' }}>
                        {rollLeaderboard.reduce((acc, s) => acc + s.completedCount, 0)}
                      </strong>
                      <small>Reduced from SMA risk</small>
                    </div>
                    <div>
                      <span>Total Recovered Amount</span>
                      <strong style={{ color: '#059669' }}>
                        ₹{fmt(rollLeaderboard.reduce((acc, s) => acc + s.amount, 0))}
                      </strong>
                      <small>Mobilized & regularized</small>
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
                            <th>ACCOUNTS CLEARED</th>
                            <th>TOTAL RECOVERED</th>
                            <th>SUCCESS RATE</th>
                            <th>CERTIFICATE OF APPRECIATION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rollLeaderboard.map((stat, idx) => {
                            const pct = stat.count ? Math.round((stat.completedCount / stat.count) * 100) : 0;
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
                                  <b style={{ color: '#1e3a8a', fontSize: 14 }}>{stat.rollNo}</b>
                                </td>
                                <td data-label="Branch">
                                  <b>{branchName || 'Regional Staff'}</b>
                                  <small>SOL {branchSol}</small>
                                </td>
                                <td data-label="Followed">
                                  <b>{stat.count} accounts</b>
                                </td>
                                <td data-label="Cleared">
                                  <b style={{ color: '#059669' }}>{stat.completedCount} accounts</b>
                                  <small>{stat.completedCount ? 'Reduced from due' : 'Pending'}</small>
                                </td>
                                <td data-label="Total Recovered">
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
                                      background: '#1e3a8a',
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
                        When marking repayments complete or updating follow-up status, enter your Staff Roll No.
                        Achievements will automatically appear here on the leaderboard for General Manager (GM) appreciation.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <footer>
          Indian Overseas Bank · Dindigul Regional SMA Prevention Portal · <span>All times are IST</span>
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
          background: #dc2626;
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
          background: #2563eb;
          border-color: #60a5fa;
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
