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

  const reviewerRole = isGm
    ? 'General Manager (GM)'
    : review?.role === 'admin'
    ? 'Regional Administrator'
    : review?.role === 'reviewer'
    ? 'Regional Reviewer'
    : (review?.role || 'Regional Reviewer');

  const reviewerName = escapeXml(
    review?.by
      ? (review.by.includes('@') ? review.by.split('@')[0].toUpperCase() : review.by)
      : 'Regional Office'
  );

  let revDateStr = date;
  let revTimeStr = '';
  if (review?.at) {
    try {
      const dObj = new Date(review.at);
      revDateStr = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      revTimeStr = dObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    } catch {}
  }
  if (!revTimeStr) {
    revTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }

  const revBadgeText = isGm ? '★ GM EXECUTIVE DIRECTION' : isClarification ? '⚠️ CLARIFICATION REQUIRED' : '✓ REVIEWER FEEDBACK';
  const revBadgeBg = isGm ? '#7e22ce' : isClarification ? '#b45309' : '#15803d';
  const revCardBg = isGm ? '#faf5ff' : isClarification ? '#fffbeb' : '#f0fdf4';
  const revBorder = isGm ? '#c084fc' : isClarification ? '#fde047' : '#86efac';

  // Mobile layout dimensions (720px wide)
  const W = 720;
  const pad = 24;
  const contentW = W - pad * 2; // 672px
  const col2W = (contentW - 14) / 2; // 329px

  let reviewCardH = 0;
  if (hasReview) {
    const estLines = Math.max(1, Math.ceil(revText.length / 48));
    reviewCardH = 92 + estLines * 22;
  }

  let H = 135; // Header
  H += 105; // Branch identity card
  if (hasReview) H += reviewCardH + 16;
  H += 26 + 155 + 12 + 125; // Section 1: Deposits
  H += 26 + 155 + 12 + 105; // Section 2: Lending & Recovery
  H += 55; // Footer

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
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
  <rect width="${W}" height="${H}" fill="#f8fafc" rx="12"/>
  <rect width="${W}" height="${H}" fill="none" stroke="#cbd5e1" stroke-width="1.5" rx="12"/>

  <!-- Top Banner (IOB Navy Gradient) -->
  <rect width="${W}" height="118" fill="url(#headerGrad)" rx="12"/>
  <rect y="106" width="${W}" height="12" fill="url(#headerGrad)"/>

  <!-- Header Typography -->
  <text x="${pad}" y="38" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="21" font-weight="800">INDIAN OVERSEAS BANK</text>
  <text x="${pad}" y="56" fill="#93c5fd" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">DINDIGUL REGION • DAILY PERFORMANCE SCORECARD</text>

  <!-- Date Pill (Top Right) -->
  <rect x="${W - pad - 160}" y="20" width="160" height="46" rx="8" fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.35"/>
  <text x="${W - pad - 148}" y="40" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">📅 ${escapeXml(date)}</text>
  <text x="${W - pad - 148}" y="56" fill="#bfdbfe" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600">REPORTING DATE (IST)</text>

  <!-- Subheader Mobile Mode Bar -->
  <rect y="88" width="${W}" height="30" fill="#000000" fill-opacity="0.18"/>
  <text x="${pad}" y="107" fill="#e0f2fe" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">📱 OFFICIAL REGIONAL REVIEW · MOBILE FORMAT FOR WHATSAPP</text>

  <!-- Branch Identity Card -->
  <g transform="translate(${pad}, 132)">
    <rect width="${contentW}" height="92" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" filter="url(#cardShadow)"/>
    <text x="16" y="32" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800">${escapeXml(branchName.toUpperCase())}</text>
    <rect x="${Math.min(16 + branchName.length * 12 + 10, contentW - 95)}" y="14" width="85" height="24" rx="6" fill="#eff6ff" stroke="#bfdbfe"/>
    <text x="${Math.min(16 + branchName.length * 12 + 20, contentW - 85)}" y="30" fill="#1d4ed8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">SOL ${escapeXml(sol)}</text>
    <text x="16" y="58" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600">👤 Branch Head: ${escapeXml(headName)}</text>
    <text x="16" y="76" fill="#047857" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700">📱 ${escapeXml(headPhone)}</text>
    <text x="${contentW - 16}" y="58" text-anchor="end" fill="#059669" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">Revision ${sub?.revision || 1} • Submitted</text>
    <text x="${contentW - 16}" y="76" text-anchor="end" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">Official Report</text>
  </g>

  ${(() => {
    let y = 132 + 92 + 14;
    let reviewSvg = '';
    if (hasReview) {
      reviewSvg = `
  <!-- Reviewer Feedback / GM Direction Card (Placed at TOP) -->
  <g transform="translate(${pad}, ${y})">
    <rect width="${contentW}" height="${reviewCardH}" rx="10" fill="${revCardBg}" stroke="${revBorder}" stroke-width="2" filter="url(#cardShadow)"/>
    <rect x="14" y="12" width="${revBadgeText.length * 8 + 20}" height="22" rx="6" fill="${revBadgeBg}"/>
    <text x="24" y="27" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800">${revBadgeText}</text>
    <text x="16" y="56" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="600" font-style="italic">"${revText}"</text>
    <text x="16" y="${reviewCardH - 14}" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">— Reviewed by ${reviewerName} (${escapeXml(reviewerRole)}) on ${escapeXml(revDateStr)} at ${escapeXml(revTimeStr)} IST</text>
  </g>`;
      y += reviewCardH + 16;
    }

    const sec1Y = y;
    const cards1Y = sec1Y + 20;
    const tdY = cards1Y + 155 + 12;

    const sec2Y = tdY + 125 + 16;
    const cards2Y = sec2Y + 20;
    const smaY = cards2Y + 155 + 12;

    return `${reviewSvg}

  <!-- Section 1 Title: Deposits -->
  <text x="${pad}" y="${sec1Y + 12}" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">01 · DEPOSIT MOBILIZATION &amp; ACCOUNTS TODAY</text>

  <!-- SB Card -->
  <g transform="translate(${pad}, ${cards1Y})">
    <rect width="${col2W}" height="155" rx="10" fill="#ffffff" stroke="${sbToday >= 0 ? '#bbf7d0' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${col2W}" height="5" rx="3" fill="${sbToday >= 0 ? '#10b981' : '#ef4444'}"/>
    <text x="14" y="26" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">SB GROWTH TODAY</text>
    <text x="14" y="56" fill="${sbToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800">${sbToday >= 0 ? '+' : ''}₹${fmt(sbToday)}</text>
    <rect x="14" y="70" width="${col2W - 28}" height="28" rx="6" fill="#eff6ff"/>
    <text x="22" y="89" fill="#1e40af" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700">SB Opened: +${sbOpened} (${sbFunded} funded)</text>
    <text x="14" y="122" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">Confirmed MTD: ₹${fmt(cumSb)}</text>
    <text x="14" y="140" fill="${sbToday >= 0 ? '#047857' : '#b91c1c'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">${sbToday >= 0 ? '▲ Positive mobilization today' : '▼ Net deficit/degrowth today'}</text>
  </g>

  <!-- CD Card -->
  <g transform="translate(${pad + col2W + 14}, ${cards1Y})">
    <rect width="${col2W}" height="155" rx="10" fill="#ffffff" stroke="${cdToday >= 0 ? '#bbf7d0' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${col2W}" height="5" rx="3" fill="${cdToday >= 0 ? '#10b981' : '#ef4444'}"/>
    <text x="14" y="26" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">CD GROWTH TODAY</text>
    <text x="14" y="56" fill="${cdToday >= 0 ? '#059669' : '#dc2626'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800">${cdToday >= 0 ? '+' : ''}₹${fmt(cdToday)}</text>
    <rect x="14" y="70" width="${col2W - 28}" height="28" rx="6" fill="#f8fafc"/>
    <text x="22" y="89" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700">CD Opened: +${cdOpened} (${cdFunded} funded)</text>
    <text x="14" y="122" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">Confirmed MTD: ₹${fmt(cumCd)}</text>
    <text x="14" y="140" fill="${cdToday >= 0 ? '#047857' : '#b91c1c'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">${cdToday >= 0 ? '▲ Positive accretion today' : '▼ Net deficit/degrowth today'}</text>
  </g>

  <!-- TD Card (Full Width) -->
  <g transform="translate(${pad}, ${tdY})">
    <rect width="${contentW}" height="125" rx="10" fill="#ffffff" stroke="${tdToday >= 0 ? '#bae6fd' : '#fecaca'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${contentW}" height="5" rx="3" fill="${tdToday >= 0 ? '#0284c7' : '#ef4444'}"/>
    <text x="16" y="28" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">TD (TERM DEPOSIT) MOBILIZATION TODAY</text>
    <text x="16" y="58" fill="${tdToday >= 0 ? '#0284c7' : '#dc2626'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800">${tdToday >= 0 ? '+' : ''}₹${fmt(tdToday)}</text>
    <text x="16" y="84" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">Total Deposits Mobilized Today (SB+CD+TD): ₹${fmt(totalDep)}</text>
    <text x="16" y="104" fill="${tdToday >= 0 ? '#0369a1' : '#b91c1c'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">${tdToday >= 0 ? '▲ Positive term deposits accretion today' : '▼ Term deposit outflow today'}</text>
    <!-- Right side summary pill -->
    <rect x="${contentW - 270}" y="22" width="254" height="80" rx="8" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text x="${contentW - 256}" y="44" fill="#166534" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">TOTAL DEPOSIT ACCRETION</text>
    <text x="${contentW - 256}" y="66" fill="#15803d" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800">${totalDep >= 0 ? '+' : ''}₹${fmt(totalDep)} today</text>
    <text x="${contentW - 256}" y="86" fill="#047857" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">SB + CD + TD Net Mobilized</text>
  </g>

  <!-- Section 2 Title: Lending & Recovery -->
  <text x="${pad}" y="${sec2Y + 12}" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">02 · LENDING &amp; RECOVERY PERFORMANCE TODAY</text>

  <!-- Sanctions Card -->
  <g transform="translate(${pad}, ${cards2Y})">
    <rect width="${col2W}" height="155" rx="10" fill="#ffffff" stroke="${sancCnt > 0 ? '#bbf7d0' : '#e2e8f0'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${col2W}" height="5" rx="3" fill="#059669"/>
    <text x="14" y="26" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">LOAN SANCTIONS TODAY</text>
    <text x="14" y="54" fill="${sancCnt > 0 ? '#059669' : '#64748b'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800">₹${fmt(sancAmt)}</text>
    <text x="14" y="74" fill="#065f46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">${sancCnt} loans sanctioned today</text>
    <text x="14" y="98" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• Retail: ₹${fmt(Number(v.sanction_retail_amount || 0))}</text>
    <text x="14" y="118" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• Agri: ₹${fmt(Number(v.sanction_agri_amount || 0))}</text>
    <text x="14" y="138" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• MSME: ₹${fmt(Number(v.sanction_msme_amount || 0))}</text>
  </g>

  <!-- Forwarded to LPC Card -->
  <g transform="translate(${pad + col2W + 14}, ${cards2Y})">
    <rect width="${col2W}" height="155" rx="10" fill="#ffffff" stroke="${lpcCnt > 0 ? '#bae6fd' : '#e2e8f0'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${col2W}" height="5" rx="3" fill="#0284c7"/>
    <text x="14" y="26" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">FORWARDED TO LPC TODAY</text>
    <text x="14" y="54" fill="${lpcCnt > 0 ? '#0284c7' : '#64748b'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800">₹${fmt(lpcAmt)}</text>
    <text x="14" y="74" fill="#0369a1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">${lpcCnt} proposals sent to LPC</text>
    <text x="14" y="98" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• Retail LPC: ₹${fmt(Number(v.lpc_retail_amount || 0))}</text>
    <text x="14" y="118" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• Agri LPC: ₹${fmt(Number(v.lpc_agri_amount || 0))}</text>
    <text x="14" y="138" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11">• MSME LPC: ₹${fmt(Number(v.lpc_msme_amount || 0))}</text>
  </g>

  <!-- SMA Eliminations Full-Width Card -->
  <g transform="translate(${pad}, ${smaY})">
    <rect width="${contentW}" height="105" rx="10" fill="#ffffff" stroke="${smaCnt > 0 ? '#bbf7d0' : '#e2e8f0'}" stroke-width="1.5" filter="url(#cardShadow)"/>
    <rect width="${contentW}" height="5" rx="3" fill="#059669"/>
    <text x="16" y="26" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700">SMA ELIMINATIONS TODAY (OVERDUE RESOLUTION)</text>
    <text x="16" y="56" fill="${smaCnt > 0 ? '#059669' : '#64748b'}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800">₹${fmt(smaAmt)}</text>
    <text x="16" y="80" fill="#065f46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700">${smaCnt} overdue accounts eliminated</text>
    <rect x="${contentW - 300}" y="18" width="284" height="68" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="${contentW - 288}" y="38" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">• SMA 0: ₹${fmt(Number(v.sma0_amount || 0))}</text>
    <text x="${contentW - 288}" y="56" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">• SMA 1: ₹${fmt(Number(v.sma1_amount || 0))}</text>
    <text x="${contentW - 288}" y="74" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">• SMA 2: ₹${fmt(Number(v.sma2_amount || 0))}</text>
  </g>`;
  })()}

  <!-- Footer -->
  <line x1="${pad}" y1="${H - 36}" x2="${W - pad}" y2="${H - 36}" stroke="#cbd5e1" stroke-width="1"/>
  <text x="${pad}" y="${H - 18}" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600">INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL</text>
  <text x="${W - pad}" y="${H - 18}" text-anchor="end" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600">https://dailyreport-9265a.web.app</text>
</svg>`;
}
