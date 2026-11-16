'use client';

export interface ScorecardOptions {
  branch: { name: string; sol: string };
  headContact: { name: string; displayPhone: string; hasPhone: boolean; phone: string };
  date: string;
  sub: any;
  snap?: any;
  review?: {
    text: string;
    status: string;
    by: string;
    role: string;
    at: string;
  } | null;
  fundingAccounts?: any[];
  campaigns?: any[];
  isGm?: boolean;
}

const fmt = (n: any) => (n === undefined || n === null ? '—' : Number(n).toLocaleString('en-IN'));

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? ' ' : '') + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n];
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

export async function generateBranchPerformanceScorecard(
  opts: ScorecardOptions
): Promise<{ blob: Blob; dataUrl: string; file: File; textSummary: string }> {
  const { branch, headContact, date, sub, snap, review, fundingAccounts = [], campaigns = [], isGm } = opts;
  const values = sub?.values || {};

  // Compute metrics
  const sbToday = Number(values.sb_growth_today || 0);
  const cdToday = Number(values.cd_growth_today || 0);
  const tdToday = Number(values.td_growth_today || 0);
  const totalDepToday = sbToday + cdToday + tdToday;

  const cumSb = snap ? Number(snap.sb_growth || 0) : null;
  const cumCd = snap ? Number(snap.cd_growth || 0) : null;

  const sbOpened = Number(values.sb_opened || 0);
  const sbFunded = Number(values.sb_funded || 0);
  const cdOpened = Number(values.cd_opened || 0);
  const cdFunded = Number(values.cd_funded || 0);

  // Funding portal live sync
  const bFund = fundingAccounts.filter((a: any) => a.sol === branch.sol);
  const bDone = bFund.filter((a: any) => a.funded);
  const bAmt = bDone.reduce((acc: number, a: any) => acc + Number(a.funded_amount || 0), 0);

  // Sanctions
  const sancRCount = Number(values.sanction_retail_count || 0);
  const sancRAmt = Number(values.sanction_retail_amount || 0);
  const sancACount = Number(values.sanction_agri_count || 0);
  const sancAAmt = Number(values.sanction_agri_amount || 0);
  const sancMCount = Number(values.sanction_msme_count || 0);
  const sancMAmt = Number(values.sanction_msme_amount || 0);
  const totalSancCnt = sancRCount + sancACount + sancMCount;
  const totalSancAmt = sancRAmt + sancAAmt + sancMAmt;

  // LPC Forwarded
  const lpcRCount = Number(values.lpc_retail_count || 0);
  const lpcRAmt = Number(values.lpc_retail_amount || 0);
  const lpcACount = Number(values.lpc_agri_count || 0);
  const lpcAAmt = Number(values.lpc_agri_amount || 0);
  const lpcMCount = Number(values.lpc_msme_count || 0);
  const lpcMAmt = Number(values.lpc_msme_amount || 0);
  const totalLpcCnt = lpcRCount + lpcACount + lpcMCount;
  const totalLpcAmt = lpcRAmt + lpcAAmt + lpcMAmt;

  // SMA
  const sma0Cnt = Number(values.sma0_count || 0);
  const sma0Amt = Number(values.sma0_amount || 0);
  const sma1Cnt = Number(values.sma1_count || 0);
  const sma1Amt = Number(values.sma1_amount || 0);
  const sma2Cnt = Number(values.sma2_count || 0);
  const sma2Amt = Number(values.sma2_amount || 0);
  const totalSmaCnt = sma0Cnt + sma1Cnt + sma2Cnt;
  const totalSmaAmt = sma0Amt + sma1Amt + sma2Amt;

  // Active campaigns
  const activeCamps = (campaigns || []).filter((c: any) => c.start <= date && c.end >= date);
  const campLines = activeCamps
    .map((c: any) => {
      const val = Number(values['camp_' + c.id] || 0);
      return val > 0 ? `${c.title}: +${val}` : null;
    })
    .filter(Boolean);

  // Review text estimation for dynamic height
  const hasReview = Boolean(review?.text?.trim());
  const reviewText = review?.text?.trim() || '';

  // Canvas setup
  const W = 960;
  let H = 940;
  if (campLines.length > 0) H += 50;
  if (hasReview) {
    const estimatedReviewLines = Math.ceil(reviewText.length / 75) || 1;
    H += 120 + Math.max(1, estimatedReviewLines) * 22;
  }

  const scale = 2; // Retina 2x
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Outer Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);

  // TOP HEADER BANNER (Gradient #0f3a7d -> #1e3a8a)
  const headerH = 115;
  const grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, '#0a3272');
  grad.addColorStop(0.5, '#0d4b9f');
  grad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);

  // Header Title & Logo space
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK', 32, 42);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DINDIGUL REGION • DAILY PERFORMANCE SCORECARD', 32, 64);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OFFICIAL REGIONAL REVIEW & BRANCH POSITION', 32, 82);

  // Date Pill Badge (Top Right)
  const dateBadgeW = 200;
  const dateBadgeH = 54;
  const dateBadgeX = W - dateBadgeW - 32;
  const dateBadgeY = 28;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, dateBadgeX, dateBadgeY, dateBadgeW, dateBadgeH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📅 ${date}`, dateBadgeX + 16, dateBadgeY + 24);

  ctx.fillStyle = '#bfdbfe';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('REPORTING DATE (IST)', dateBadgeX + 16, dateBadgeY + 42);

  // Try loading logo to draw on header
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/logo.svg';
    await new Promise((res) => {
      logoImg.onload = res;
      logoImg.onerror = res;
      setTimeout(res, 200); // 200ms timeout
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, W - 280, 26, 44, 44);
    }
  } catch {}

  // BRANCH IDENTITY CARD (y = 130)
  let y = 130;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 32, y, W - 64, 86, 10);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Branch Name
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(branch.name.toUpperCase(), 52, y + 36);

  // SOL Pill
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const solText = `SOL ${branch.sol}`;
  const solW = ctx.measureText(solText).width + 16;
  const branchNameW = ctx.measureText(branch.name.toUpperCase()).width;
  const solX = Math.min(52 + branchNameW + 14, W - 240);
  ctx.fillStyle = '#eff6ff';
  roundRect(ctx, solX, y + 16, solW, 26, 6);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.stroke();
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText(solText, solX + 8, y + 34);

  // Branch Head Details
  ctx.fillStyle = '#475569';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Branch Head: ${headContact.name}`, 52, y + 64);

  ctx.fillStyle = headContact.hasPhone ? '#047857' : '#94a3b8';
  ctx.fillText(`• Mobile: ${headContact.displayPhone}`, 52 + ctx.measureText(`Branch Head: ${headContact.name} `).width + 8, y + 64);

  // Revision & Submission Time (Right side of Branch Card)
  if (sub) {
    const revText = `Revision ${sub.revision} • Submitted`;
    ctx.fillStyle = '#10b981';
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const revW = ctx.measureText(revText).width;
    ctx.fillText(revText, W - 52 - revW, y + 36);

    const subTime = sub.at ? new Date(sub.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
    if (subTime) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const timeText = `at ${subTime} IST`;
      const timeW = ctx.measureText(timeText).width;
      ctx.fillText(timeText, W - 52 - timeW, y + 58);
    }
  }

  // SECTION 1: DEPOSIT MOBILIZATION TODAY (SB, CD, TD SEPARATE)
  y += 104;
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('01 · DEPOSIT MOBILIZATION & ACCOUNT OPENINGS TODAY', 32, y);

  y += 14;
  const colW3 = (W - 64 - 24) / 3;

  // Card 1A: SB
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 32, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = sbToday >= 0 ? '#bbf7d0' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Accent Top Bar
  ctx.fillStyle = sbToday >= 0 ? '#10b981' : '#ef4444';
  roundRect(ctx, 32, y, colW3, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SB GROWTH TODAY', 48, y + 30);

  ctx.fillStyle = sbToday >= 0 ? '#059669' : '#dc2626';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${sbToday >= 0 ? '+' : ''}₹${fmt(sbToday)}`, 48, y + 60);

  // Openings pill
  ctx.fillStyle = '#eff6ff';
  roundRect(ctx, 48, y + 74, colW3 - 32, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#1e40af';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SB Opened: +${sbOpened} (${sbFunded} funded)`, 58, y + 93);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Confirmed MTD: ₹${fmt(cumSb)}`, 48, y + 128);
  ctx.fillText(sbToday >= 0 ? '▲ Positive mobilization today' : '▼ Net deficit/degrowth today', 48, y + 148);

  // Card 1B: CD
  const cdX = 32 + colW3 + 12;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cdX, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = cdToday >= 0 ? '#bbf7d0' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = cdToday >= 0 ? '#10b981' : '#ef4444';
  roundRect(ctx, cdX, y, colW3, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CD GROWTH TODAY', cdX + 16, y + 30);

  ctx.fillStyle = cdToday >= 0 ? '#059669' : '#dc2626';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${cdToday >= 0 ? '+' : ''}₹${fmt(cdToday)}`, cdX + 16, y + 60);

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, cdX + 16, y + 74, colW3 - 32, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`CD Opened: +${cdOpened} (${cdFunded} funded)`, cdX + 26, y + 93);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Confirmed MTD: ₹${fmt(cumCd)}`, cdX + 16, y + 128);
  ctx.fillText(cdToday >= 0 ? '▲ Positive accretion today' : '▼ Net deficit/degrowth today', cdX + 16, y + 148);

  // Card 1C: TD (Term Deposits) & Low Balance Funding
  const tdX = cdX + colW3 + 12;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, tdX, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = tdToday >= 0 ? '#bae6fd' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = tdToday >= 0 ? '#0284c7' : '#ef4444';
  roundRect(ctx, tdX, y, colW3, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TD MOBILIZATION TODAY', tdX + 16, y + 30);

  ctx.fillStyle = tdToday >= 0 ? '#0284c7' : '#dc2626';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${tdToday >= 0 ? '+' : ''}₹${fmt(tdToday)}`, tdX + 16, y + 60);

  // Funding portal auto-sync badge
  ctx.fillStyle = '#f0fdf4';
  roundRect(ctx, tdX + 16, y + 74, colW3 - 32, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#166534';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Low Bal Funded: ${bDone.length}/${bFund.length} (₹${fmt(bAmt)})`, tdX + 24, y + 93);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Total Dep Today: ₹${fmt(totalDepToday)}`, tdX + 16, y + 128);
  ctx.fillText(tdToday >= 0 ? '▲ Term deposits accretion' : '▼ Term deposit outflow', tdX + 16, y + 148);

  // SECTION 2: LENDING & RECOVERY (SANCTIONS, LPC & SMA)
  y += 195;
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('02 · LENDING & RECOVERY PERFORMANCE TODAY', 32, y);

  y += 14;

  // Card 2A: BRANCH SANCTIONS
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 32, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = totalSancCnt > 0 ? '#bbf7d0' : '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#059669';
  roundRect(ctx, 32, y, colW3, 5, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SANCTIONS TODAY', 48, y + 28);

  ctx.fillStyle = totalSancCnt > 0 ? '#059669' : '#64748b';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalSancAmt)}`, 48, y + 54);

  ctx.fillStyle = '#065f46';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalSancCnt} loans sanctioned today`, 48, y + 74);

  ctx.fillStyle = '#475569';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• Retail: ${sancRCount} (₹${fmt(sancRAmt)})`, 48, y + 104);
  ctx.fillText(`• Agri: ${sancACount} (₹${fmt(sancAAmt)})`, 48, y + 124);
  ctx.fillText(`• MSME: ${sancMCount} (₹${fmt(sancMAmt)})`, 48, y + 144);

  // Card 2B: LPC FORWARDED
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cdX, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = totalLpcCnt > 0 ? '#bae6fd' : '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  roundRect(ctx, cdX, y, colW3, 5, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('FORWARDED TO LPC', cdX + 16, y + 28);

  ctx.fillStyle = totalLpcCnt > 0 ? '#0284c7' : '#64748b';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalLpcAmt)}`, cdX + 16, y + 54);

  ctx.fillStyle = '#0369a1';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalLpcCnt} proposals sent to LPC`, cdX + 16, y + 74);

  ctx.fillStyle = '#475569';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• Retail LPC: ${lpcRCount} (₹${fmt(lpcRAmt)})`, cdX + 16, y + 104);
  ctx.fillText(`• Agri LPC: ${lpcACount} (₹${fmt(lpcAAmt)})`, cdX + 16, y + 124);
  ctx.fillText(`• MSME LPC: ${lpcMCount} (₹${fmt(lpcMAmt)})`, cdX + 16, y + 144);

  // Card 2C: SMA RESOLUTION
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, tdX, y, colW3, 175, 10);
  ctx.fill();
  ctx.strokeStyle = totalSmaCnt > 0 ? '#bbf7d0' : '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#059669';
  roundRect(ctx, tdX, y, colW3, 5, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SMA ELIMINATIONS TODAY', tdX + 16, y + 28);

  ctx.fillStyle = totalSmaCnt > 0 ? '#059669' : '#64748b';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalSmaAmt)}`, tdX + 16, y + 54);

  ctx.fillStyle = '#065f46';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalSmaCnt} accounts eliminated today`, tdX + 16, y + 74);

  ctx.fillStyle = '#475569';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• SMA 0: ${sma0Cnt} accts (₹${fmt(sma0Amt)})`, tdX + 16, y + 104);
  ctx.fillText(`• SMA 1: ${sma1Cnt} accts (₹${fmt(sma1Amt)})`, tdX + 16, y + 124);
  ctx.fillText(`• SMA 2: ${sma2Cnt} accts (₹${fmt(sma2Amt)})`, tdX + 16, y + 144);

  // SECTION 3: CAMPAIGN ADDITIONS (IF ANY)
  if (campLines.length > 0) {
    y += 195;
    ctx.fillStyle = '#eff6ff';
    roundRect(ctx, 32, y, W - 64, 40, 8);
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.stroke();

    ctx.fillStyle = '#1e40af';
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`🎯 ACTIVE CAMPAIGN ADDITIONS: ${campLines.join('  •  ')}`, 48, y + 25);
  }

  // SECTION 4: OFFICIAL REGIONAL REVIEW / GM DIRECTION
  if (hasReview) {
    y += campLines.length > 0 ? 56 : 195;
    const isGmDirection = review?.status === 'gm_direction' || review?.status === 'srm_direction' || isGm;
    const isClarification = review?.status === 'clarification';

    const cardBg = isGmDirection ? '#faf5ff' : isClarification ? '#fffbeb' : '#f0fdf4';
    const cardBorder = isGmDirection ? '#c084fc' : isClarification ? '#fde047' : '#86efac';
    const badgeBg = isGmDirection ? '#7e22ce' : isClarification ? '#b45309' : '#15803d';

    const estimatedReviewLines = Math.ceil(reviewText.length / 75) || 1;
    const reviewCardH = 90 + Math.max(1, estimatedReviewLines) * 22;

    ctx.fillStyle = cardBg;
    roundRect(ctx, 32, y, W - 64, reviewCardH, 10);
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Badge
    const badgeText = isGmDirection
      ? '★ GENERAL MANAGER (GM) EXECUTIVE DIRECTION'
      : isClarification
      ? '⚠️ CLARIFICATION REQUIRED'
      : '✓ REGIONAL REVIEWER FEEDBACK';
    ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 16;
    ctx.fillStyle = badgeBg;
    roundRect(ctx, 52, y + 14, badgeW, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, 60, y + 30);

    // Remarks Body
    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const nextY = wrapText(ctx, `"${reviewText}"`, 52, y + 60, W - 104, 22);

    // Reviewer Signature
    const reviewerRole = isGmDirection ? 'General Manager (GM)' : 'Reviewer';
    const reviewBy = review?.by || 'Regional Office';
    const revTimeStr = review?.at ? new Date(review.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`— Issued by ${reviewerRole} (${reviewBy}) ${revTimeStr ? `at ${revTimeStr} IST` : ''}`, 52, Math.max(nextY + 6, y + reviewCardH - 16));
  }

  // FOOTER (Always at bottom)
  const footerY = H - 36;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, footerY);
  ctx.lineTo(W - 32, footerY);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL • DAILY PERFORMANCE MONITORING SYSTEM', 32, footerY + 20);

  const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const genText = `Generated: ${genTime}`;
  const genW = ctx.measureText(genText).width;
  ctx.fillText(genText, W - 32 - genW, footerY + 20);

  // Convert canvas to blob & file
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const dataUrl = canvas.toDataURL('image/png');
  const filename = `IOB_Daily_Review_${branch.sol}_${date}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  // Generate WhatsApp text summary to go along with the image
  const isGmDirection = review?.status === 'gm_direction' || review?.status === 'srm_direction' || isGm;
  const reviewHeading = isGmDirection ? '★ *GENERAL MANAGER (GM) EXECUTIVE DIRECTION:*' : '📝 *REGIONAL REVIEW FEEDBACK:*';

  const textSummary =
`*INDIAN OVERSEAS BANK - DINDIGUL REGION*
*DAILY PERFORMANCE REVIEW · ${date}*

📍 *Branch:* ${branch.name} (SOL ${branch.sol})
👤 *Branch Head:* ${headContact.name}
📋 *Submission:* Revision ${sub?.revision || 1}

📊 *DAY'S PERFORMANCE SUMMARY:*
• *SB Growth Today:* ${sbToday >= 0 ? '+' : ''}₹${fmt(sbToday)} (Opened: +${sbOpened} [${sbFunded} funded])
• *CD Growth Today:* ${cdToday >= 0 ? '+' : ''}₹${fmt(cdToday)} (Opened: +${cdOpened} [${cdFunded} funded])
• *TD Growth Today:* ${tdToday >= 0 ? '+' : ''}₹${fmt(tdToday)}
• *Loan Sanctions Today:* ₹${fmt(totalSancAmt)} (${totalSancCnt} loans)
• *LPC Forwarded Today:* ₹${fmt(totalLpcAmt)} (${totalLpcCnt} proposals)
• *SMA Eliminations Today:* ₹${fmt(totalSmaAmt)} (${totalSmaCnt} accounts)
${bDone.length > 0 ? `• *Low Balance Funding:* ${bDone.length} accounts (₹${fmt(bAmt)} mobilized)\n` : ''}${campLines.length > 0 ? `• *Campaigns:* ${campLines.join(', ')}\n` : ''}
${hasReview ? `${reviewHeading}\n"${reviewText}"\n— ${isGmDirection ? 'General Manager (GM)' : 'Reviewer'}\n` : ''}
📸 *Branch performance scorecard image attached.*
👉 View confirmed position: https://dailyreport-9265a.web.app/?date=${date}&sol=${branch.sol}`;

  return { blob, dataUrl, file, textSummary };
}
