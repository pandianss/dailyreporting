export function renderAnnouncementSvg(opts: {
  date: string;
  deadline?: string;
  cutoff?: string;
  baseline?: string;
  fundedDefinition?: string;
  version?: number;
  totalBranches?: number;
  reason?: string;
  expectedOrigin?: string;
}): string {
  const {
    date,
    deadline = '17:00',
    cutoff = 'yesterday',
    baseline = 'Prior month-end confirmed position',
    fundedDefinition = 'As per official source guidelines',
    version = 1,
    totalBranches = 56,
    reason,
    expectedOrigin = 'https://dailyreport-9265a.web.app',
  } = opts;

  const escapeXml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const formatDeadline = (d?: string) => {
    if (!d) return '05:00 PM';
    try {
      const [hStr, mStr] = d.split(':');
      let h = parseInt(hStr, 10);
      const m = mStr || '00';
      if (isNaN(h)) return d;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    } catch {
      return d;
    }
  };

  const W = 720;
  const H = 990;
  const pad = 24;
  const contentW = W - pad * 2;
  const deadlineFmt = formatDeadline(deadline);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#002855"/>
      <stop offset="100%" stop-color="#0a3d8f"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="${W}" height="${H}" fill="#f8fafc"/>

  <!-- Hero Header -->
  <rect width="${W}" height="224" fill="url(#heroGrad)"/>
  <rect width="${W}" height="5" fill="#f59e0b"/>

  <!-- Logo emblem -->
  <rect x="${pad}" y="18" width="44" height="44" rx="8" fill="#003366" stroke="#93c5fd" stroke-width="1.5"/>
  <text x="${pad + 10}" y="45" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900">IOB</text>

  <!-- Bank titles -->
  <text x="${pad + 54}" y="36" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900">INDIAN OVERSEAS BANK</text>
  <text x="${pad + 54}" y="52" fill="#fde68a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">DINDIGUL REGIONAL OFFICE • PERFORMANCE &amp; OPERATIONS</text>

  <!-- Official Badge -->
  <rect x="${W - pad - 166}" y="22" width="166" height="34" rx="17" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)"/>
  <text x="${W - pad - 150}" y="44" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">📢 OFFICIAL CIRCULAR</text>

  <!-- Divider -->
  <line x1="${pad}" y1="74" x2="${W - pad}" y2="74" stroke="rgba(255,255,255,0.16)"/>

  <!-- Title & Tag -->
  <rect x="${pad}" y="88" width="206" height="24" rx="6" fill="#fef3c7"/>
  <text x="${pad + 10}" y="104" fill="#92400e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">★ DAILY REPORTING DESK</text>

  <text x="${pad}" y="142" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900">DAILY REPORTING IS OPEN</text>
  <text x="${pad}" y="164" fill="#bae6fd" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700">📅 Reporting Date: ${escapeXml(date)} (v${version})</text>
  ${reason ? `<text x="${pad}" y="186" fill="#fef08a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600">Notice: ${escapeXml(reason)}</text>` : ''}

  <!-- Deadline Card -->
  <g transform="translate(${pad}, 240)">
    <rect width="${contentW}" height="104" rx="12" fill="#fff1f2" stroke="#fecdd3" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="6" height="104" rx="3" fill="#e11d48"/>
    <text x="18" y="26" fill="#9f1239" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">⏰ MANDATORY SUBMISSION DEADLINE (TODAY)</text>
    <text x="18" y="58" fill="#be123c" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="900">${deadlineFmt} IST</text>
    <text x="18" y="84" fill="#4c0519" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600">All ${totalBranches} branches in Dindigul region must submit their performance before this time.</text>
  </g>

  <!-- Baseline Card -->
  <g transform="translate(${pad}, 358)">
    <rect width="${contentW}" height="124" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${contentW}" height="5" rx="2.5" fill="#0284c7"/>
    <text x="16" y="24" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">📊 REGIONAL BASELINE &amp; POSITION PARAMETERS</text>

    <text x="16" y="48" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700">CONFIRMED CUTOFF</text>
    <text x="16" y="66" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">Yesterday (${escapeXml(cutoff)})</text>

    <text x="${(contentW - 32) / 2 + 16}" y="48" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700">CONNECTED BRANCHES</text>
    <text x="${(contentW - 32) / 2 + 16}" y="66" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">${totalBranches} Branches (All Active)</text>

    <text x="16" y="92" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700">GROWTH BASELINE</text>
    <text x="16" y="108" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">${escapeXml(baseline)}</text>

    <text x="${(contentW - 32) / 2 + 16}" y="92" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700">FUNDED ACCOUNT DEFINITION</text>
    <text x="${(contentW - 32) / 2 + 16}" y="108" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">${escapeXml(fundedDefinition)}</text>
  </g>

  <!-- Mandatory Checklist Card -->
  <g transform="translate(${pad}, 496)">
    <rect width="${contentW}" height="286" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${contentW}" height="5" rx="2.5" fill="#10b981"/>
    <text x="16" y="24" fill="#065f46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">📋 MANDATORY REPORTING CHECKLIST FOR BRANCH HEADS</text>

    <!-- Row 1 -->
    <g transform="translate(14, 38)">
      <rect width="${contentW - 28}" height="54" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
      <text x="10" y="34" font-size="16">👥</text>
      <text x="36" y="22" fill="#1d4ed8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">Today’s Account Openings (SB &amp; CD)</text>
      <text x="36" y="41" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500">Enter count of SB &amp; CD accounts opened today, and how many are funded.</text>
    </g>

    <!-- Row 2 -->
    <g transform="translate(14, 100)">
      <rect width="${contentW - 28}" height="54" rx="8" fill="#f0fdf4" stroke="#bbf7d0"/>
      <text x="10" y="34" font-size="16">💰</text>
      <text x="36" y="22" fill="#15803d" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">Net Deposit Growth (SB, CD &amp; TD) in Actual ₹</text>
      <text x="36" y="41" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500">Enter net mobilization today in actual Rupees (can be + Growth or − Degrowth).</text>
    </g>

    <!-- Row 3 -->
    <g transform="translate(14, 162)">
      <rect width="${contentW - 28}" height="54" rx="8" fill="#faf5ff" stroke="#e9d5ff"/>
      <text x="10" y="34" font-size="16">📑</text>
      <text x="36" y="22" fill="#7e22ce" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">Core Loan Sanctions &amp; LPC Cases Forwarded</text>
      <text x="36" y="41" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500">Enter today’s sanctions &amp; forwarded proposals for Retail, Agri and MSME.</text>
    </g>

    <!-- Row 4 -->
    <g transform="translate(14, 224)">
      <rect width="${contentW - 28}" height="54" rx="8" fill="#fffbeb" stroke="#fde68a"/>
      <text x="10" y="34" font-size="16">🛡️</text>
      <text x="36" y="22" fill="#b45309" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800">SMA Overdue Eliminations (SMA 0, 1 &amp; 2)</text>
      <text x="36" y="41" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500">Record accounts resolved and overdue amounts eliminated today across buckets.</text>
    </g>
  </g>

  <!-- Portal Link Card -->
  <g transform="translate(${pad}, 796)">
    <rect width="${contentW}" height="100" rx="12" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="6" height="100" rx="3" fill="#0284c7"/>
    <text x="18" y="24" fill="#0369a1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">🌐 SECURE REGIONAL REPORTING PORTAL LINK</text>
    <text x="18" y="54" fill="#0284c7" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900">${escapeXml(expectedOrigin)}/?date=${escapeXml(date)}</text>
    <text x="18" y="80" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">⚡ Mobile-friendly entry • Fast 2-minute submission • Real-time live sync</text>
  </g>

  <!-- Footer -->
  <g transform="translate(0, ${H - 42})">
    <rect width="${W}" height="42" fill="#0f172a"/>
    <text x="${pad}" y="26" fill="#cbd5e1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL</text>
    <text x="${W - pad - 240}" y="26" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">Daily Regional Circular • Good People to Grow With</text>
  </g>
</svg>`;
}
