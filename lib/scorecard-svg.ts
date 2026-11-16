export function renderScorecardSvg(opts: {
  sol: string;
  date: string;
  branch?: any;
  sub?: any;
  snap?: any;
  review?: any;
  contact?: any;
}): string {
  const { sol, date, branch, sub, snap, review, contact } = opts;
  const branchName = branch?.name || `BRANCH ${sol}`;
  const headName = contact?.name || 'Branch Head';
  const headPhone = contact?.phone ? (contact.phone.startsWith('91') ? contact.phone.slice(2) : contact.phone) : '—';

  const v = sub?.values || {};
  const sbToday = Number(v.sb_growth_today || 0);
  const cdToday = Number(v.cd_growth_today || 0);
  const tdToday = Number(v.td_growth_today || 0);
  const totalDep = sbToday + cdToday + tdToday;

  const cumSb = snap ? Number(snap.sb_growth || 0) : 0;
  const cumCd = snap ? Number(snap.cd_growth || 0) : 0;

  const sbOpened = Number(v.sb_opened || 0);
  const sbFunded = Number(v.sb_funded || 0);
  const cdOpened = Number(v.cd_opened || 0);
  const cdFunded = Number(v.cd_funded || 0);

  const sancAmt = Number(v.sanction_retail_amount || 0) + Number(v.sanction_agri_amount || 0) + Number(v.sanction_msme_amount || 0);
  const sancCnt = Number(v.sanction_retail_count || 0) + Number(v.sanction_agri_count || 0) + Number(v.sanction_msme_count || 0);

  const lpcAmt = Number(v.lpc_retail_amount || 0) + Number(v.lpc_agri_amount || 0) + Number(v.lpc_msme_amount || 0);
  const lpcCnt = Number(v.lpc_retail_count || 0) + Number(v.lpc_agri_count || 0) + Number(v.lpc_msme_count || 0);

  const smaAmt = Number(v.sma0_amount || 0) + Number(v.sma1_amount || 0) + Number(v.sma2_amount || 0);
  const smaCnt = Number(v.sma0_count || 0) + Number(v.sma1_count || 0) + Number(v.sma2_count || 0);

  const fmt = (n: number) => Number(n).toLocaleString('en-IN');

  const escapeXml = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const hasReview = Boolean(review?.text?.trim());
  const revText = escapeXml(review?.text?.trim() || '');
  const isGm = review?.status === 'gm_direction' || review?.status === 'srm_direction';
  const isClarification = review?.status === 'clarification';

  const revBadgeText = isGm ? '★ GM EXECUTIVE DIRECTION' : isClarification ? '⚠️ CLARIFICATION REQUIRED' : '✓ REVIEWER FEEDBACK';
  const revBadgeBg = isGm ? '#7e22ce' : isClarification ? '#b45309' : '#15803d';
  const revCardBg = isGm ? '#faf5ff' : isClarification ? '#fffbeb' : '#f0fdf4';
  const revBorder = isGm ? '#c084fc' : isClarification ? '#fde047' : '#86efac';

  const baseH = 880;
  const extraH = hasReview ? 140 : 0;
  const H = baseH + extraH;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${H}" viewBox="0 0 900 ${H}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a3272"/>
      <stop offset="50%" stop-color="#0d4b9f"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="900" height="${H}" fill="#f8fafc" rx="12"/>
  <rect width="900" height="${H}" fill="none" stroke="#e2e8f0" stroke-width="1.5" rx="12"/>

  <!-- Top Banner -->
  <rect width="900" height="110" fill="url(#headerGrad)" rx="12"/>
  <rect y="98" width="900" height="12" fill="url(#headerGrad)"/>

  <!-- Header Typography -->
  <text x="32" y="42" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="22" font-weight="800">INDIAN OVERSEAS BANK</text>
  <text x="32" y="66" fill="#93c5fd" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">DINDIGUL REGION • DAILY PERFORMANCE SCORECARD</text>
  <text x="32" y="86" fill="#cbd5e1" font-family="-apple-system, sans-serif" font-size="11" font-weight="500">OFFICIAL REGIONAL REVIEW &amp; SUBMISSION REPORT</text>

  <!-- Date Pill (Top Right) -->
  <rect x="680" y="28" width="188" height="52" rx="8" fill="#ffffff" fill-opacity="0.15" stroke="#ffffff" stroke-opacity="0.3"/>
  <text x="700" y="50" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="14" font-weight="800">📅 ${escapeXml(date)}</text>
  <text x="700" y="68" fill="#bfdbfe" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">REPORTING DATE (IST)</text>

  <!-- Branch Identity Card -->
  <g transform="translate(32, 126)">
    <rect width="836" height="84" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" filter="url(#cardShadow)"/>
    <text x="24" y="34" fill="#0f172a" font-family="-apple-system, sans-serif" font-size="20" font-weight="800">${escapeXml(branchName.toUpperCase())}</text>
    <rect x="${Math.min(24 + branchName.length * 13, 560)}" y="16" width="90" height="24" rx="6" fill="#eff6ff" stroke="#bfdbfe"/>
    <text x="${Math.min(24 + branchName.length * 13 + 12, 572)}" y="32" fill="#1d4ed8" font-family="-apple-system, sans-serif" font-size="12" font-weight="800">SOL ${escapeXml(sol)}</text>
    <text x="24" y="64" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Branch Head: ${escapeXml(headName)} • Mobile: <tspan fill="#047857" font-weight="700">${escapeXml(headPhone)}</tspan></text>
    <text x="812" y="36" text-anchor="end" fill="#059669" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">Revision ${sub?.revision || 1} • Submitted</text>
  </g>

  <!-- Section 1 Title: Deposits -->
  <text x="32" y="240" fill="#1e293b" font-family="-apple-system, sans-serif" font-size="13" font-weight="800">01 · DEPOSIT MOBILIZATION TODAY (SB, CD, TD SEPARATE)</text>

  <!-- Row 1: SB, CD, TD Cards -->
  <!-- SB Card -->
  <g transform="translate(32, 252)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${sbToday >= 0 ? '#bbf7d0' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="268" height="6" rx="3" fill="${sbToday >= 0 ? '#10b981' : '#ef4444'}"/>
    <text x="16" y="30" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">SB GROWTH TODAY</text>
    <text x="16" y="62" fill="${sbToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="22" font-weight="800">${sbToday >= 0 ? '+' : ''}₹${fmt(sbToday)}</text>
    <rect x="16" y="76" width="236" height="28" rx="6" fill="#eff6ff"/>
    <text x="26" y="95" fill="#1e40af" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">SB Opened: +${sbOpened} (${sbFunded} funded)</text>
    <text x="16" y="132" fill="#64748b" font-family="-apple-system, sans-serif" font-size="11">Confirmed MTD: ₹${fmt(cumSb)}</text>
    <text x="16" y="152" fill="${sbToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">${sbToday >= 0 ? '▲ Positive mobilization today' : '▼ Net deficit/degrowth today'}</text>
  </g>

  <!-- CD Card -->
  <g transform="translate(316, 252)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${cdToday >= 0 ? '#bbf7d0' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="268" height="6" rx="3" fill="${cdToday >= 0 ? '#10b981' : '#ef4444'}"/>
    <text x="16" y="30" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">CD GROWTH TODAY</text>
    <text x="16" y="62" fill="${cdToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="22" font-weight="800">${cdToday >= 0 ? '+' : ''}₹${fmt(cdToday)}</text>
    <rect x="16" y="76" width="236" height="28" rx="6" fill="#f8fafc"/>
    <text x="26" y="95" fill="#334155" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">CD Opened: +${cdOpened} (${cdFunded} funded)</text>
    <text x="16" y="132" fill="#64748b" font-family="-apple-system, sans-serif" font-size="11">Confirmed MTD: ₹${fmt(cumCd)}</text>
    <text x="16" y="152" fill="${cdToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">${cdToday >= 0 ? '▲ Positive accretion today' : '▼ Net deficit/degrowth today'}</text>
  </g>

  <!-- TD Card -->
  <g transform="translate(600, 252)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${tdToday >= 0 ? '#bae6fd' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="268" height="6" rx="3" fill="${tdToday >= 0 ? '#0284c7' : '#ef4444'}"/>
    <text x="16" y="30" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">TD MOBILIZATION TODAY</text>
    <text x="16" y="62" fill="${tdToday >= 0 ? '#0284c7' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="22" font-weight="800">${tdToday >= 0 ? '+' : ''}₹${fmt(tdToday)}</text>
    <rect x="16" y="76" width="236" height="28" rx="6" fill="#f0fdf4"/>
    <text x="26" y="95" fill="#166534" font-family="-apple-system, sans-serif" font-size="11" font-weight="700">Total Dep: ₹${fmt(totalDep)} today</text>
    <text x="16" y="132" fill="#64748b" font-family="-apple-system, sans-serif" font-size="11">TD Mobilization Position</text>
    <text x="16" y="152" fill="${tdToday >= 0 ? '#0284c7' : '#dc2626'}" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">${tdToday >= 0 ? '▲ Positive term deposits' : '▼ Net outflow today'}</text>
  </g>

  <!-- Section 2 Title: Lending & Recovery -->
  <text x="32" y="455" fill="#1e293b" font-family="-apple-system, sans-serif" font-size="13" font-weight="800">02 · LENDING &amp; RECOVERY PERFORMANCE TODAY</text>

  <!-- Row 2: Sanctions, LPC, SMA Cards -->
  <!-- Sanctions Card -->
  <g transform="translate(32, 467)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${sancCnt > 0 ? '#bbf7d0' : '#e2e8f0'}" stroke-width="1" filter="url(#cardShadow)"/>
    <rect width="268" height="5" rx="2" fill="#059669"/>
    <text x="16" y="28" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">SANCTIONS TODAY</text>
    <text x="16" y="54" fill="${sancCnt > 0 ? '#059669' : '#64748b'}" font-family="-apple-system, sans-serif" font-size="20" font-weight="800">₹${fmt(sancAmt)}</text>
    <text x="16" y="74" fill="#065f46" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">${sancCnt} loans sanctioned today</text>
    <text x="16" y="104" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• Retail: ₹${fmt(Number(v.sanction_retail_amount || 0))}</text>
    <text x="16" y="124" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• Agri: ₹${fmt(Number(v.sanction_agri_amount || 0))}</text>
    <text x="16" y="144" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• MSME: ₹${fmt(Number(v.sanction_msme_amount || 0))}</text>
  </g>

  <!-- LPC Card -->
  <g transform="translate(316, 467)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${lpcCnt > 0 ? '#bae6fd' : '#e2e8f0'}" stroke-width="1" filter="url(#cardShadow)"/>
    <rect width="268" height="5" rx="2" fill="#0284c7"/>
    <text x="16" y="28" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">FORWARDED TO LPC</text>
    <text x="16" y="54" fill="${lpcCnt > 0 ? '#0284c7' : '#64748b'}" font-family="-apple-system, sans-serif" font-size="20" font-weight="800">₹${fmt(lpcAmt)}</text>
    <text x="16" y="74" fill="#0369a1" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">${lpcCnt} proposals sent to LPC</text>
    <text x="16" y="104" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• Retail LPC: ₹${fmt(Number(v.lpc_retail_amount || 0))}</text>
    <text x="16" y="124" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• Agri LPC: ₹${fmt(Number(v.lpc_agri_amount || 0))}</text>
    <text x="16" y="144" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• MSME LPC: ₹${fmt(Number(v.lpc_msme_amount || 0))}</text>
  </g>

  <!-- SMA Card -->
  <g transform="translate(600, 467)">
    <rect width="268" height="175" rx="10" fill="#ffffff" stroke="${smaCnt > 0 ? '#bbf7d0' : '#e2e8f0'}" stroke-width="1" filter="url(#cardShadow)"/>
    <rect width="268" height="5" rx="2" fill="#059669"/>
    <text x="16" y="28" fill="#475569" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">SMA ELIMINATIONS</text>
    <text x="16" y="54" fill="${smaCnt > 0 ? '#059669' : '#64748b'}" font-family="-apple-system, sans-serif" font-size="20" font-weight="800">₹${fmt(smaAmt)}</text>
    <text x="16" y="74" fill="#065f46" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">${smaCnt} accounts eliminated today</text>
    <text x="16" y="104" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• SMA 0: ₹${fmt(Number(v.sma0_amount || 0))}</text>
    <text x="16" y="124" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• SMA 1: ₹${fmt(Number(v.sma1_amount || 0))}</text>
    <text x="16" y="144" fill="#475569" font-family="-apple-system, sans-serif" font-size="11">• SMA 2: ₹${fmt(Number(v.sma2_amount || 0))}</text>
  </g>

  ${hasReview ? `
  <!-- Section 3: Official Review Feedback -->
  <g transform="translate(32, 665)">
    <rect width="836" height="120" rx="10" fill="${revCardBg}" stroke="${revBorder}" stroke-width="2" filter="url(#cardShadow)"/>
    <rect x="20" y="14" width="${revBadgeText.length * 8 + 20}" height="24" rx="6" fill="${revBadgeBg}"/>
    <text x="30" y="30" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="11" font-weight="800">${revBadgeText}</text>
    <text x="20" y="66" fill="#1e293b" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" font-style="italic">"${revText}"</text>
    <text x="20" y="98" fill="#64748b" font-family="-apple-system, sans-serif" font-size="11" font-weight="500">— Issued by ${isGm ? 'General Manager (GM)' : 'Reviewer'} (${escapeXml(review?.by || 'Regional Office')})</text>
  </g>` : ''}

  <!-- Footer -->
  <line x1="32" y1="${H - 36}" x2="868" y2="${H - 36}" stroke="#e2e8f0" stroke-width="1"/>
  <text x="32" y="${H - 18}" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="10" font-weight="600">INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL • DAILY PERFORMANCE PORTAL</text>
  <text x="868" y="${H - 18}" text-anchor="end" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="10" font-weight="600">https://dailyreport-9265a.web.app</text>
</svg>`;
}
