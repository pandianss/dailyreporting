'use client';

export interface AnnouncementOptions {
  date: string;
  deadline?: string;
  cutoff?: string;
  baseline?: string;
  fundedDefinition?: string;
  version?: number;
  totalBranches?: number;
  reason?: string;
  expectedOrigin?: string;
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

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateStr;
  }
}

function formatDeadlineTime(deadline?: string): string {
  if (!deadline) return '05:00 PM';
  try {
    const [hStr, mStr] = deadline.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return deadline;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  } catch {
    return deadline;
  }
}

export async function generateAnnouncementImage(
  opts: AnnouncementOptions
): Promise<{ blob: Blob; dataUrl: string; file: File; textSummary: string; imgUrl: string }> {
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

  const formattedDate = formatDisplayDate(date);
  const formattedDeadline = formatDeadlineTime(deadline);
  const portalUrl = `${expectedOrigin}/?date=${date}`;

  // WhatsApp text summary
  const textSummary = `📢 *INDIAN OVERSEAS BANK · DINDIGUL REGION*
*DAILY PERFORMANCE REPORTING IS OPEN*

📅 *Reporting Date:* ${formattedDate}
⏰ *Submission Deadline:* ${formattedDeadline} IST (Today)

Dear Branch Heads,
Daily performance reporting for *${formattedDate}* has opened on the regional portal. All ${totalBranches} branches are requested to record today's additions and submit without delay.

🔗 *Portal Access:*
${portalUrl}

📋 *Mandatory Reporting Checklist:*
1️⃣ *Account Openings:* SB & CD accounts opened today (and funded count)
2️⃣ *Deposit Mobilization:* Net growth today in actuals (₹) for SB, CD & TD (growth or degrowth)
3️⃣ *Lending:* Loan sanctions today (Retail, Agri, MSME) & proposals forwarded to LPC
4️⃣ *Recovery:* SMA overdue accounts resolved/eliminated today (SMA 0, 1 & 2)

⚠️ _All entries must be in actual Rupees (₹). Please submit before ${formattedDeadline} IST without waiting for individual reminders._

— *Regional Office, IOB Dindigul*`;

  // Canvas mobile form factor setup
  const W = 720;
  const pad = 24;
  const contentW = W - pad * 2;
  const H = 990;

  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  ctx.scale(2, 2);

  // Background base
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // 1. HERO HEADER BANNER (IOB Deep Blue Gradient)
  const heroH = 224;
  const heroGrad = ctx.createLinearGradient(0, 0, W, heroH);
  heroGrad.addColorStop(0, '#002855');
  heroGrad.addColorStop(1, '#0a3d8f');
  ctx.fillStyle = heroGrad;
  ctx.fillRect(0, 0, W, heroH);

  // Top accent line (Gold / Amber)
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, W, 5);

  // Logo attempt
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/logo.svg';
    await new Promise((res) => {
      logoImg.onload = res;
      logoImg.onerror = res;
      setTimeout(res, 200);
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, pad, 18, 44, 44);
    }
  } catch {}

  // Top Bank Strip text
  const bankStripX = pad + 54;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK', bankStripX, 35);

  ctx.fillStyle = '#fde68a';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DINDIGUL REGIONAL OFFICE · PERFORMANCE & OPERATIONS', bankStripX, 52);

  // Top Right Official Badge
  const badgeW = 166;
  const badgeH = 34;
  const badgeX = W - pad - badgeW;
  const badgeY = 22;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 17);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📢 OFFICIAL CIRCULAR', badgeX + 16, badgeY + 22);

  // Inner Divider
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(pad, 74, contentW, 1);

  // Hero Announcement Heading
  // Tag pill
  const tagW = 206;
  const tagH = 24;
  const tagY = 88;
  ctx.fillStyle = '#fef3c7';
  roundRect(ctx, pad, tagY, tagW, tagH, 6);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('★ DAILY REPORTING DESK', pad + 10, tagY + 16);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DAILY REPORTING IS OPEN', pad, tagY + 54);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📅 Reporting Date: ${formattedDate} (v${version})`, pad, tagY + 76);

  if (reason) {
    ctx.fillStyle = '#fef08a';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Notice: ${reason}`, pad, tagY + 98);
  }

  let curY = heroH + 16;

  // 2. SUBMISSION DEADLINE CARD (Rose/Red accent)
  const deadCardH = 104;
  ctx.fillStyle = '#fff1f2';
  roundRect(ctx, pad, curY, contentW, deadCardH, 12);
  ctx.fill();
  ctx.strokeStyle = '#fecdd3';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left red accent bar
  ctx.fillStyle = '#e11d48';
  roundRect(ctx, pad, curY, 6, deadCardH, 3);
  ctx.fill();

  ctx.fillStyle = '#9f1239';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⏰ MANDATORY SUBMISSION DEADLINE (TODAY)', pad + 18, curY + 26);

  ctx.fillStyle = '#be123c';
  ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${formattedDeadline} IST`, pad + 18, curY + 58);

  ctx.fillStyle = '#4c0519';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`All ${totalBranches} branches in Dindigul region must submit their performance before this time.`, pad + 18, curY + 84);

  curY += deadCardH + 14;

  // 3. BASELINE & CUTOFF DETAILS CARD (2x2 Grid)
  const baseCardH = 124;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, contentW, baseCardH, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top blue accent bar
  ctx.fillStyle = '#0284c7';
  roundRect(ctx, pad, curY, contentW, 5, 2.5);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📊 REGIONAL BASELINE & POSITION PARAMETERS', pad + 16, curY + 24);

  const colW = (contentW - 32) / 2;
  const col1X = pad + 16;
  const col2X = pad + 16 + colW;

  // Row 1
  ctx.fillStyle = '#64748b';
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CONFIRMED CUTOFF', col1X, curY + 48);
  ctx.fillText('CONNECTED BRANCHES', col2X, curY + 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Yesterday (${cutoff})`, col1X, curY + 66);
  ctx.fillText(`${totalBranches} Branches (All Active)`, col2X, curY + 66);

  // Row 2
  ctx.fillStyle = '#64748b';
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('GROWTH BASELINE', col1X, curY + 92);
  ctx.fillText('FUNDED ACCOUNT DEFINITION', col2X, curY + 92);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const baselineTrim = baseline.length > 36 ? baseline.slice(0, 36) + '…' : baseline;
  ctx.fillText(baselineTrim, col1X, curY + 108);

  const fundedTrim = fundedDefinition.length > 36 ? fundedDefinition.slice(0, 36) + '…' : fundedDefinition;
  ctx.fillText(fundedTrim, col2X, curY + 108);

  curY += baseCardH + 14;

  // 4. MANDATORY SUBMISSION CHECKLIST (4 PILLARS)
  const checkCardH = 286;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, curY, contentW, checkCardH, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top green accent bar
  ctx.fillStyle = '#10b981';
  roundRect(ctx, pad, curY, contentW, 5, 2.5);
  ctx.fill();

  ctx.fillStyle = '#065f46';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📋 MANDATORY REPORTING CHECKLIST FOR BRANCH HEADS', pad + 16, curY + 24);

  // 4 Item Rows
  const items = [
    {
      num: '01',
      title: 'Today’s Account Openings (SB & CD)',
      desc: 'Enter count of SB & CD accounts opened today, and how many of those are funded.',
      bg: '#eff6ff',
      border: '#bfdbfe',
      titleColor: '#1d4ed8',
      icon: '👥',
    },
    {
      num: '02',
      title: 'Net Deposit Growth (SB, CD & TD) in Actual ₹',
      desc: 'Enter net mobilization today in actual Rupees (can be + Growth or − Degrowth).',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      titleColor: '#15803d',
      icon: '💰',
    },
    {
      num: '03',
      title: 'Core Loan Sanctions & LPC Cases Forwarded',
      desc: 'Enter today’s sanctions & forwarded proposals for Retail, Agri and MSME.',
      bg: '#faf5ff',
      border: '#e9d5ff',
      titleColor: '#7e22ce',
      icon: '📑',
    },
    {
      num: '04',
      title: 'SMA Overdue Eliminations (SMA 0, 1 & 2)',
      desc: 'Record accounts resolved and overdue amounts eliminated today across buckets.',
      bg: '#fffbeb',
      border: '#fde68a',
      titleColor: '#b45309',
      icon: '🛡️',
    },
  ];

  let itemY = curY + 38;
  const itemH = 54;
  for (const it of items) {
    ctx.fillStyle = it.bg;
    roundRect(ctx, pad + 14, itemY, contentW - 28, itemH, 8);
    ctx.fill();
    ctx.strokeStyle = it.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.fillText(it.icon, pad + 24, itemY + 34);

    ctx.fillStyle = it.titleColor;
    ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(it.title, pad + 52, itemY + 22);

    ctx.fillStyle = '#475569';
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(it.desc, pad + 52, itemY + 41);

    itemY += itemH + 8;
  }

  curY += checkCardH + 14;

  // 5. DIRECT ACCESS LINK CARD (Sky/Blue)
  const linkCardH = 100;
  ctx.fillStyle = '#f0f9ff';
  roundRect(ctx, pad, curY, contentW, linkCardH, 12);
  ctx.fill();
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left blue bar
  ctx.fillStyle = '#0284c7';
  roundRect(ctx, pad, curY, 6, linkCardH, 3);
  ctx.fill();

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🌐 SECURE REGIONAL REPORTING PORTAL LINK', pad + 18, curY + 24);

  ctx.fillStyle = '#0284c7';
  ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`https://dailyreport-9265a.web.app/?date=${date}`, pad + 18, curY + 54);

  ctx.fillStyle = '#334155';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ Mobile-friendly entry · Fast 2-minute submission · Real-time live sync', pad + 18, curY + 80);

  // 6. FOOTER BAR
  const footerY = H - 42;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, footerY, W, 42);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INDIAN OVERSEAS BANK • REGIONAL OFFICE, DINDIGUL', pad, footerY + 26);

  const genTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const genText = `Published at ${genTime} IST · Good People to Grow With`;
  const genW = ctx.measureText(genText).width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(genText, W - pad - genW, footerY + 26);

  // Convert canvas to blob & file
  const blob: Blob = await new Promise((res) => {
    canvas.toBlob((b) => res(b || new Blob()), 'image/png', 0.95);
  });
  const dataUrl = canvas.toDataURL('image/png', 0.95);
  const file = new File([blob], `IOB_Reporting_Open_${date}.png`, { type: 'image/png' });

  return {
    blob,
    dataUrl,
    file,
    textSummary,
    imgUrl: dataUrl,
  };
}
