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
    reviewerName?: string;
    reviewerRole?: string;
    [k: string]: any;
  } | null;
  fundingAccounts?: any[];
  campaigns?: any[];
  isGm?: boolean;
}

const fmt = (n: any) => (n === undefined || n === null ? '—' : Number(n).toLocaleString('en-IN'));

export function formatReviewerAttribution(name?: string | null, role?: string | null): string {
  const n = (name || '').trim();
  const r = (role || '').trim();

  if (!n && !r) return 'Regional Office';
  if (!r) return n;
  if (!n) return r;

  const nLow = n.toLowerCase();
  const rLow = r.toLowerCase();

  if (nLow === rLow || rLow.startsWith(nLow) || nLow.startsWith(rLow)) {
    return r.length >= n.length ? r : n;
  }

  if (nLow === 'regional office' || nLow === 'reviewer' || nLow === 'regional reviewer') {
    return r;
  }

  return `${n} (${r})`;
}

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
): Promise<{ blob: Blob; dataUrl: string; file: File; textSummary: string; headTextSummary: string; imgUrl: string }> {
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

  // Review metadata extraction
  const hasReview = Boolean(review?.text?.trim());
  const reviewText = review?.text?.trim() || '';
  const isGmDirection = review?.status === 'gm_direction' || review?.status === 'srm_direction' || isGm;
  const isClarification = review?.status === 'clarification';

  const reviewerRoleText = isGmDirection
    ? 'General Manager (GM)'
    : review?.role === 'admin'
    ? 'Regional Administrator'
    : review?.role === 'reviewer'
    ? 'Regional Reviewer'
    : (review?.role || 'Regional Reviewer');

  const rawBy = (review?.by && String(review.by).trim()) || (review?.reviewerName && String(review.reviewerName).trim()) || '';
  const reviewerName = rawBy
    ? (rawBy.includes('@') ? rawBy.split('@')[0].toUpperCase() : rawBy)
    : (isGmDirection ? 'General Manager (GM)' : 'Regional Reviewer');

  const reviewerSig = formatReviewerAttribution(reviewerName, reviewerRoleText);

  let reviewDateStr = date;
  let reviewTimeStr = '';
  if (review?.at) {
    try {
      const dObj = new Date(review.at);
      reviewDateStr = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      reviewTimeStr = dObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    } catch {}
  }
  if (!reviewTimeStr) {
    reviewTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }

  // =========================================================================
  // HIGH-IMPACT MOBILE FORM FACTOR SETUP (Portrait 720px width)
  // Perfectly proportioned for smartphone screens and WhatsApp media viewers!
  // =========================================================================
  const W = 720;
  const pad = 20;
  const contentW = W - pad * 2; // 680px
  const col2W = (contentW - 14) / 2; // 333px

  // Calculate dynamic review card height
  let estimatedReviewCardH = 0;
  if (hasReview) {
    const charsPerLine = 48;
    const estLines = Math.max(1, Math.ceil(reviewText.length / charsPerLine));
    estimatedReviewCardH = 88 + estLines * 22;
  }

  // Height calculations
  const heroH = 175; // Prominent Hero Banner with huge Branch Name
  let H = heroH + 16;
  if (hasReview) H += estimatedReviewCardH + 16;
  H += 26 + 155 + 12 + 125; // Section 1: Deposits
  H += 26 + 155 + 12 + 105; // Section 2: Lending & Recovery
  if (campLines.length > 0) H += 50;
  H += 55; // Footer

  const scale = 2; // High-density Retina 2x for ultra-sharp mobile rendering
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Base Background
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, W, H);

  // Outer Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);

  // -------------------------------------------------------------------------
  // 1. HERO BRANCH BANNER (BRANCH NAME PROMINENT & HIGH CONTRAST)
  // -------------------------------------------------------------------------
  const heroGrad = ctx.createLinearGradient(0, 0, W, heroH);
  heroGrad.addColorStop(0, '#061d47');
  heroGrad.addColorStop(0.4, '#0a3272');
  heroGrad.addColorStop(1, '#0d4b9f');
  ctx.fillStyle = heroGrad;
  ctx.fillRect(0, 0, W, heroH);

  // Logo attempt
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/logo.svg';
    await new Promise((res) => {
      logoImg.onload = res;
      logoImg.onerror = res;
      setTimeout(res, 180);
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, pad, 16, 42, 42);
    }
  } catch {}

  // Top Bank Strip
  const bankStripX = pad + 52;
  ctx.fillStyle = '#93c5fd';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK • DINDIGUL REGION', bankStripX, 30);

  ctx.fillStyle = '#e0f2fe';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DAILY PERFORMANCE SCORECARD (MOBILE)', bankStripX, 46);

  // Top Date & Revision Pill (Top Right)
  const topPillW = 160;
  const topPillH = 42;
  const topPillX = W - pad - topPillW;
  const topPillY = 16;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  roundRect(ctx, topPillX, topPillY, topPillW, topPillH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📅 ${date}`, topPillX + 12, topPillY + 18);
  ctx.fillStyle = '#bae6fd';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Revision ${sub?.revision || 1} • IST`, topPillX + 12, topPillY + 34);

  // --- PROMINENT HERO BRANCH NAME & SOL ---
  // Large prominent branch title banner
  const branchHeroY = 72;
  const branchNameUpper = branch.name.toUpperCase();

  // Adjust font size if branch name is extra long
  const nameFontSize = branchNameUpper.length > 24 ? 24 : branchNameUpper.length > 18 ? 26 : 28;
  ctx.font = `900 ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Draw SOL badge first to measure
  const solText = `SOL ${branch.sol}`;
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const solW = ctx.measureText(solText).width + 18;
  const solH = 26;
  const solBadgeX = pad;
  const solBadgeY = branchHeroY;

  // Gold / Amber SOL Badge
  ctx.fillStyle = '#fef08a';
  roundRect(ctx, solBadgeX, solBadgeY, solW, solH, 6);
  ctx.fill();
  ctx.fillStyle = '#854d0e';
  ctx.fillText(solText, solBadgeX + 9, solBadgeY + 18);

  // Branch Name (Prominent, High Contrast White)
  ctx.font = `900 ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  const nameX = solBadgeX + solW + 12;
  ctx.fillText(branchNameUpper, nameX, branchHeroY + 22);

  // Subtitle / Contact Strip below Branch Name
  const contactY = branchHeroY + 44;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, pad, contactY, contentW, 44, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`👤 Branch Head: ${headContact.name}`, pad + 14, contactY + 20);

  ctx.fillStyle = headContact.hasPhone ? '#86efac' : '#cbd5e1';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📱 ${headContact.displayPhone}`, pad + 14, contactY + 36);

  const subTime = sub?.at ? new Date(sub.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';
  const subStatusText = sub ? `✓ Submitted at ${subTime || '—'} IST` : 'Pending Submission';
  ctx.fillStyle = sub ? '#86efac' : '#fca5a5';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const statusW = ctx.measureText(subStatusText).width;
  ctx.fillText(subStatusText, W - pad - 14 - statusW, contactY + 28);

  let curY = heroH + 16;

  // -------------------------------------------------------------------------
  // 2. REVIEWER REMARKS / GM DIRECTION CARD (Placed at TOP for Mobile Readability)
  // -------------------------------------------------------------------------
  if (hasReview) {
    const cardBg = isGmDirection ? '#faf5ff' : isClarification ? '#fffbeb' : '#f0fdf4';
    const cardBorder = isGmDirection ? '#a855f7' : isClarification ? '#eab308' : '#22c55e';
    const badgeBg = isGmDirection ? '#7e22ce' : isClarification ? '#b45309' : '#15803d';

    ctx.fillStyle = cardBg;
    roundRect(ctx, pad, curY, contentW, estimatedReviewCardH, 12);
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
    const badgeW = ctx.measureText(badgeText).width + 18;
    ctx.fillStyle = badgeBg;
    roundRect(ctx, pad + 14, curY + 12, badgeW, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, pad + 23, curY + 27);

    // Remarks Body
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic 600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const nextY = wrapText(ctx, `"${reviewText}"`, pad + 16, curY + 56, contentW - 32, 22);

    // Reviewer Attribution with Name, Date, and Time
    ctx.fillStyle = '#475569';
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const sigLine = `— Reviewed by ${reviewerSig} on ${reviewDateStr} at ${reviewTimeStr} IST`;
    ctx.fillText(sigLine, pad + 16, Math.max(nextY + 6, curY + estimatedReviewCardH - 14));

    curY += estimatedReviewCardH + 16;
  }

  // -------------------------------------------------------------------------
  // 3. SECTION 1: DEPOSIT MOBILIZATION TODAY (SB, CD, TD 100% SEPARATE)
  // -------------------------------------------------------------------------
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('01 · DEPOSIT MOBILIZATION & ACCOUNTS TODAY', pad, curY + 12);
  curY += 20;

  const depCardH = 155;

  // --- SB CARD ---
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, col2W, depCardH, 12);
  ctx.fill();
  ctx.strokeStyle = sbToday >= 0 ? '#bbf7d0' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top color bar
  ctx.fillStyle = sbToday >= 0 ? '#10b981' : '#ef4444';
  roundRect(ctx, pad, curY, col2W, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SB GROWTH TODAY', pad + 14, curY + 26);

  ctx.fillStyle = sbToday >= 0 ? '#059669' : '#dc2626';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(sbToday >= 0 ? '+₹' + fmt(sbToday) : '−₹' + fmt(Math.abs(sbToday)), pad + 14, curY + 56);

  // SB Opened Pill
  ctx.fillStyle = '#eff6ff';
  roundRect(ctx, pad + 14, curY + 70, col2W - 28, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#1e40af';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SB Opened: +${sbOpened} (${sbFunded} funded)`, pad + 22, curY + 89);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Confirmed MTD: ₹${fmt(cumSb)}`, pad + 14, curY + 122);
  ctx.fillStyle = sbToday >= 0 ? '#047857' : '#b91c1c';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(sbToday >= 0 ? '▲ Positive mobilization today' : '▼ Net deficit/degrowth today', pad + 14, curY + 140);

  // --- CD CARD ---
  const cdX = pad + col2W + 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cdX, curY, col2W, depCardH, 12);
  ctx.fill();
  ctx.strokeStyle = cdToday >= 0 ? '#bbf7d0' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = cdToday >= 0 ? '#10b981' : '#ef4444';
  roundRect(ctx, cdX, curY, col2W, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CD GROWTH TODAY', cdX + 14, curY + 26);

  ctx.fillStyle = cdToday >= 0 ? '#059669' : '#dc2626';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cdToday >= 0 ? '+₹' + fmt(cdToday) : '−₹' + fmt(Math.abs(cdToday)), cdX + 14, curY + 56);

  // CD Opened Pill
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, cdX + 14, curY + 70, col2W - 28, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`CD Opened: +${cdOpened} (${cdFunded} funded)`, cdX + 22, curY + 89);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Confirmed MTD: ₹${fmt(cumCd)}`, cdX + 14, curY + 122);
  ctx.fillStyle = cdToday >= 0 ? '#047857' : '#b91c1c';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cdToday >= 0 ? '▲ Positive accretion today' : '▼ Net deficit/degrowth today', cdX + 14, curY + 140);

  curY += depCardH + 12;

  // --- TD (TERM DEPOSITS) & LOW BALANCE FUNDING FULL-WIDTH CARD ---
  const tdCardH = 125;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, contentW, tdCardH, 12);
  ctx.fill();
  ctx.strokeStyle = tdToday >= 0 ? '#bae6fd' : '#fecaca';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = tdToday >= 0 ? '#0284c7' : '#ef4444';
  roundRect(ctx, pad, curY, contentW, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TD (TERM DEPOSIT) MOBILIZATION TODAY', pad + 16, curY + 28);

  ctx.fillStyle = tdToday >= 0 ? '#0284c7' : '#dc2626';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(tdToday >= 0 ? '+₹' + fmt(tdToday) : '−₹' + fmt(Math.abs(tdToday)), pad + 16, curY + 58);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Total Deposits Mobilized Today (SB+CD+TD): ₹${fmt(totalDepToday)}`, pad + 16, curY + 84);
  ctx.fillText(tdToday >= 0 ? '▲ Positive term deposits accretion today' : '▼ Term deposit outflow today', pad + 16, curY + 104);

  // Low Balance Funding auto-sync badge (Right side)
  const fundBadgeW = 280;
  const fundBadgeH = 80;
  const fundBadgeX = W - pad - fundBadgeW - 14;
  ctx.fillStyle = '#f0fdf4';
  roundRect(ctx, fundBadgeX, curY + 22, fundBadgeW, fundBadgeH, 8);
  ctx.fill();
  ctx.strokeStyle = '#bbf7d0';
  ctx.stroke();

  ctx.fillStyle = '#166534';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ LOW BALANCE FUNDING (AUTO-SYNC)', fundBadgeX + 12, curY + 44);

  ctx.fillStyle = '#15803d';
  ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${bDone.length} of ${bFund.length} accounts funded`, fundBadgeX + 12, curY + 66);

  ctx.fillStyle = '#047857';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(bAmt)} mobilized today`, fundBadgeX + 12, curY + 86);

  curY += tdCardH + 16;

  // -------------------------------------------------------------------------
  // 4. SECTION 2: LENDING & RECOVERY (SANCTIONS, LPC & SMA)
  // -------------------------------------------------------------------------
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('02 · LENDING & RECOVERY PERFORMANCE TODAY', pad, curY + 12);
  curY += 20;

  const lendCardH = 155;

  // --- SANCTIONS CARD ---
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, col2W, lendCardH, 12);
  ctx.fill();
  ctx.strokeStyle = totalSancCnt > 0 ? '#bbf7d0' : '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#059669';
  roundRect(ctx, pad, curY, col2W, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('LOAN SANCTIONS TODAY', pad + 14, curY + 26);

  ctx.fillStyle = totalSancCnt > 0 ? '#059669' : '#64748b';
  ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalSancAmt)}`, pad + 14, curY + 54);

  ctx.fillStyle = '#065f46';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalSancCnt} loans sanctioned today`, pad + 14, curY + 74);

  ctx.fillStyle = '#475569';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• Retail: ${sancRCount} (₹${fmt(sancRAmt)})`, pad + 14, curY + 98);
  ctx.fillText(`• Agri: ${sancACount} (₹${fmt(sancAAmt)})`, pad + 14, curY + 118);
  ctx.fillText(`• MSME: ${sancMCount} (₹${fmt(sancMAmt)})`, pad + 14, curY + 138);

  // --- LPC FORWARDED CARD ---
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cdX, curY, col2W, lendCardH, 12);
  ctx.fill();
  ctx.strokeStyle = totalLpcCnt > 0 ? '#bae6fd' : '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  roundRect(ctx, cdX, curY, col2W, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('FORWARDED TO LPC TODAY', cdX + 14, curY + 26);

  ctx.fillStyle = totalLpcCnt > 0 ? '#0284c7' : '#64748b';
  ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalLpcAmt)}`, cdX + 14, curY + 54);

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalLpcCnt} proposals sent to LPC`, cdX + 14, curY + 74);

  ctx.fillStyle = '#475569';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• Retail LPC: ${lpcRCount} (₹${fmt(lpcRAmt)})`, cdX + 14, curY + 98);
  ctx.fillText(`• Agri LPC: ${lpcACount} (₹${fmt(lpcAAmt)})`, cdX + 14, curY + 118);
  ctx.fillText(`• MSME LPC: ${lpcMCount} (₹${fmt(lpcMAmt)})`, cdX + 14, curY + 138);

  curY += lendCardH + 12;

  // --- SMA ELIMINATIONS FULL-WIDTH CARD ---
  const smaCardH = 105;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, contentW, smaCardH, 12);
  ctx.fill();
  ctx.strokeStyle = totalSmaCnt > 0 ? '#bbf7d0' : '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#059669';
  roundRect(ctx, pad, curY, contentW, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SMA ELIMINATIONS TODAY (OVERDUE RESOLUTION)', pad + 16, curY + 26);

  ctx.fillStyle = totalSmaCnt > 0 ? '#059669' : '#64748b';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`₹${fmt(totalSmaAmt)}`, pad + 16, curY + 56);

  ctx.fillStyle = '#065f46';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${totalSmaCnt} overdue accounts eliminated`, pad + 16, curY + 80);

  // SMA 0, 1, 2 breakdown pills on right
  const smaBreakX = W - pad - 310;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, smaBreakX, curY + 20, 296, 68, 6);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• SMA 0: ${sma0Cnt} accts (₹${fmt(sma0Amt)})`, smaBreakX + 10, curY + 40);
  ctx.fillText(`• SMA 1: ${sma1Cnt} accts (₹${fmt(sma1Amt)})`, smaBreakX + 10, curY + 58);
  ctx.fillText(`• SMA 2: ${sma2Cnt} accts (₹${fmt(sma2Amt)})`, smaBreakX + 10, curY + 76);

  curY += smaCardH + 14;

  // -------------------------------------------------------------------------
  // 5. SECTION 3: CAMPAIGN ADDITIONS (IF ANY)
  // -------------------------------------------------------------------------
  if (campLines.length > 0) {
    ctx.fillStyle = '#eff6ff';
    roundRect(ctx, pad, curY, contentW, 40, 8);
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.stroke();

    ctx.fillStyle = '#1e40af';
    ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`🎯 ACTIVE CAMPAIGN ADDITIONS: ${campLines.join('  •  ')}`, pad + 14, curY + 25);
    curY += 48;
  }

  // -------------------------------------------------------------------------
  // 6. FOOTER
  // -------------------------------------------------------------------------
  const footerY = H - 36;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, footerY);
  ctx.lineTo(W - pad, footerY);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL', pad, footerY + 20);

  const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const genText = `Generated: ${genTime}`;
  const genW = ctx.measureText(genText).width;
  ctx.fillText(genText, W - pad - genW, footerY + 20);

  // Convert canvas to blob & file
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  const dataUrl = canvas.toDataURL('image/png');
  const filename = `IOB_Daily_Review_${branch.sol}_${date}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const imgUrl = `https://dailyreport-9265a.web.app/api/card?sol=${branch.sol}&date=${date}`;

  // =========================================================================
  // ACCOMPANYING WHATSAPP TEXT (Only Review in Text - Performance is in Image)
  // =========================================================================
  const reviewHeading = isGmDirection
    ? '★ *GENERAL MANAGER (GM) EXECUTIVE DIRECTION:*'
    : isClarification
    ? '⚠️ *REGIONAL CLARIFICATION REQUIRED:*'
    : '📝 *REGIONAL REVIEW FEEDBACK:*';

  const textSummary =
`*INDIAN OVERSEAS BANK - DINDIGUL REGION*
*DAILY PERFORMANCE REVIEW · ${date}*

📍 *Branch:* ${branch.name} (SOL ${branch.sol})
👤 *Branch Head:* ${headContact.name}

${hasReview ? `${reviewHeading}
"${reviewText}"
— *Reviewed by:* ${reviewerSig}
📅 *Date:* ${reviewDateStr}  •  ⏰ *Time:* ${reviewTimeStr} IST
` : '✓ *DAILY PERFORMANCE SUBMISSION REVIEWED*\n'}
📸 *Branch performance scorecard image (mobile format) attached above.*
👉 View confirmed position: https://dailyreport-9265a.web.app/?date=${date}&sol=${branch.sol}`;

  const headTextSummary =
`Dear ${headContact.name},
Greetings from Regional Office.

*Daily Performance Review & Feedback for ${branch.name} (SOL ${branch.sol}) on ${date}:*

${hasReview ? `${reviewHeading}
"${reviewText}"
— *Reviewed by:* ${reviewerSig}
📅 *Date:* ${reviewDateStr}  •  ⏰ *Time:* ${reviewTimeStr} IST
` : '✓ *Your daily performance report has been reviewed.*\n'}
📸 *Your Day's Performance Scorecard Image (mobile format) is attached above.*
👉 View your confirmed position: https://dailyreport-9265a.web.app/?date=${date}&sol=${branch.sol}`;

  return { blob, dataUrl, file, textSummary, headTextSummary, imgUrl };
}
