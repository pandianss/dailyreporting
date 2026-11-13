import crypto from 'node:crypto';

export type Role = 'admin' | 'branch' | 'reviewer' | 'srm' | 'gm' | 'none';

export interface Branch {
  sol: string;
  name: string;
}

export interface PortalConfig {
  adminMobile: string;
  adminEmail?: string;
  waBridgeUrl?: string;
  waBridgeToken?: string;
  waGroupId?: string;
}

export interface Store {
  get(key: string): Promise<any | null>;
  put(key: string, value: any): Promise<void>;
  del(key: string): Promise<void>;
  list(prefix: string): Promise<Array<{ key: string; [k: string]: any }>>;
  putIfAbsent(key: string, value: any): Promise<boolean>;
  compareAndSet(key: string, expected: any, next: any): Promise<boolean>;
  batch(
    ops: Array<
      | { type: 'put'; key: string; value: any }
      | { type: 'del'; key: string }
      | { type: 'putIfAbsent'; key: string; value: any }
      | { type: 'clearLimit'; key: string }
    >
  ): Promise<void>;
  incrementAuthLimit(key: string, now: number, windowMs: number): Promise<number>;
  clearAuthLimit(key: string): Promise<void>;
}

export interface ModelHelpers {
  cutoffs: (date: string) => { yesterday: string; prior: string; first: boolean; april: boolean };
  validateSnapshot: (rows: any[], branches: Branch[], campaigns: any[], date: string) => any[];
  validateEntry: (input: any, snapshot: any, campaigns: any[], date: string) => any;
  validateRepayments: (rows: any[], branches: Branch[]) => any[];
  repaymentsDueInNextDays: (repayments: any[], date: string, days?: number) => any[];
  validateDirectory: (rows: any[], branches: Branch[], adminMobile?: string) => any[];
  validateSMAAccounts: (rows: any[], branches: Branch[]) => any[];
  validateFundingAccounts?: (rows: any[], branches: Branch[]) => any[];
  parseFundingCSV?: (text: string) => any[];
  normalizeDate: (v: any, label?: string) => string;
  number: (v: any, label: string, integer?: boolean, signed?: boolean) => number;
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const SESSION_COOKIE = '__session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function normalizeMobile(value: unknown): string {
  const s = String(value ?? '').replace(/[\s+-]/g, '');
  const n = s.length === 10 ? '91' + s : s;
  if (!/^91[6-9]\d{9}$/.test(n)) {
    throw new Error('Enter a valid 10-digit mobile number');
  }
  return n;
}

export function assertAdminMobile(config: PortalConfig): string {
  const adminMobile = String(config.adminMobile || '').trim();
  if (!/^91[6-9]\d{9}$/.test(adminMobile)) {
    throw new Error('Administrator mobile must be configured on the server');
  }
  return adminMobile;
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function pinHash(pin: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pin, salt, 100000, 32, 'sha256', (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function parseSessionToken(cookieHeader: string): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(SESSION_COOKIE + '=')) {
      return trimmed.slice(SESSION_COOKIE.length + 1);
    }
  }
  return '';
}

export function formatSessionCookie(token: string, secure: boolean, maxAgeSeconds = 28800): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export async function ensureAdminAccount(store: Store, config: PortalConfig, phone: string): Promise<void> {
  const adminMobile = assertAdminMobile(config);
  if (phone === adminMobile) {
    await store.putIfAbsent('account:' + adminMobile, {
      phone: adminMobile,
      email: (config.adminEmail || 'admin@iob.local').toLowerCase(),
      role: 'admin',
      sol: null,
      version: 1,
    });
  }
}

export async function getAccountFor(store: Store, phone: string): Promise<any> {
  const account = await store.get('account:' + phone);
  if (!account) {
    throw new Error('This mobile number is not registered. Contact the administrator.');
  }
  if (account.role === 'none') {
    throw new Error('Access for this mobile number has been revoked. Contact the administrator.');
  }
  return account;
}

export async function authenticateRequest(store: Store, config: PortalConfig, cookieHeader: string) {
  assertAdminMobile(config);
  const rawToken = parseSessionToken(cookieHeader);
  if (!rawToken) {
    throw new HttpError('Mobile and PIN sign-in required', 403);
  }
  const session = await store.get('session:' + sha256Hex(rawToken));
  if (!session || session.expires < Date.now()) {
    throw new HttpError('Session expired. Sign in with your mobile and PIN', 403);
  }
  const account = await getAccountFor(store, session.phone);
  if (session.version !== account.version || !account.hash) {
    throw new HttpError('Account changed. Sign in again', 403);
  }
  return {
    user: {
      name: (account.name || '') as string,
      email: (account.email || '') as string,
      phone: account.phone as string,
      role: account.role as Role,
      sol: (account.sol ?? null) as string | null,
    },
  };
}

export async function handleAuthGet(store: Store, config: PortalConfig, cookieHeader: string) {
  try {
    const auth = await authenticateRequest(store, config, cookieHeader);
    return { status: 200, body: { user: auth.user, authenticated: Boolean(auth?.user) } };
  } catch {
    return { status: 200, body: { user: null, authenticated: false } };
  }
}

export async function handleAuthPost(
  store: Store,
  config: PortalConfig,
  input: { origin: string | null; expectedOrigin: string; cookieHeader: string; body: any }
) {
  try {
    if (input.origin !== input.expectedOrigin) {
      throw new HttpError('Invalid origin', 400);
    }
    assertAdminMobile(config);
    const b = input.body || {};
    const secure = input.expectedOrigin.startsWith('https://');

    if (b.action === 'logout') {
      const rawToken = parseSessionToken(input.cookieHeader);
      if (rawToken) {
        await store.del('session:' + sha256Hex(rawToken));
      }
      return {
        status: 200,
        body: { ok: true },
        setCookie: formatSessionCookie('', secure, 0),
      };
    }

    if (b.action === 'handoff-login') {
      const token = String(b.token || '').trim();
      if (!token) throw new Error('Handoff token required');
      const record = await store.get('handoff:' + token);
      if (!record || !record.phone || record.expires < Date.now()) {
        throw new Error('Handoff link expired or invalid. Please sign in with your PIN');
      }
      await store.del('handoff:' + token);
      const phone = record.phone;
      const account = await getAccountFor(store, phone);
      if (account.role === 'none') {
        throw new Error('Access revoked');
      }
      const rawToken = randomToken();
      const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const nowIso = new Date().toISOString();
      await store.batch([
        {
          type: 'put',
          key: 'session:' + sha256Hex(rawToken),
          value: {
            phone,
            version: account.version,
            expires: Date.now() + SESSION_TTL_MS,
          },
        },
        {
          type: 'put',
          key: 'login:' + todayIst + ':' + phone,
          value: {
            date: todayIst,
            phone,
            role: account.role,
            sol: account.sol || null,
            name: account.name || '',
            email: account.email || '',
            lastActive: nowIso,
          },
        },
      ]);
      return {
        status: 200,
        body: { ok: true },
        setCookie: formatSessionCookie(rawToken, secure),
      };
    }

    const phone = normalizeMobile(b.phone);
    await ensureAdminAccount(store, config, phone);
    const account = await getAccountFor(store, phone);

    if (b.action === 'lookup') {
      return {
        status: 200,
        body: { setup: !account.hash, role: account.role },
      };
    }

    if (!['setup', 'login'].includes(b.action)) {
      throw new Error('Invalid action');
    }

    const attempts = await store.incrementAuthLimit(phone, Date.now(), AUTH_WINDOW_MS);
    if (attempts > 5) {
      throw new Error('Too many attempts. Please try again after 15 minutes');
    }

    if (typeof b.pin !== 'string' || !/^\d{4}$/.test(b.pin)) {
      throw new Error('Enter exactly 4 digits');
    }

    if (b.action === 'setup') {
      if (account.hash) {
        throw new Error('PIN already set. Please sign in');
      }
      if (b.pin !== b.confirm) {
        throw new Error('PINs do not match');
      }
      const salt = randomToken();
      const hash = await pinHash(b.pin, salt);
      const updated = await store.compareAndSet('account:' + phone, account, {
        ...account,
        salt,
        hash,
      });
      if (!updated) {
        throw new Error('Account changed. Please try again');
      }
    } else {
      if (!account.hash || !constantTimeEqual(await pinHash(b.pin, account.salt), account.hash)) {
        throw new Error('Incorrect PIN');
      }
    }

    const latest = await getAccountFor(store, phone);
    if (latest.version !== account.version) {
      throw new Error('Account changed. Please sign in again');
    }

    const rawToken = randomToken();
    const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIso = new Date().toISOString();
    await store.batch([
      {
        type: 'put',
        key: 'session:' + sha256Hex(rawToken),
        value: {
          phone,
          version: latest.version,
          expires: Date.now() + SESSION_TTL_MS,
        },
      },
      {
        type: 'put',
        key: 'login:' + todayIst + ':' + phone,
        value: {
          date: todayIst,
          phone,
          role: latest.role,
          sol: latest.sol || null,
          name: latest.name || '',
          email: latest.email || '',
          lastActive: nowIso,
        },
      },
      { type: 'clearLimit', key: phone },
    ]);

    return {
      status: 200,
      body: { ok: true },
      setCookie: formatSessionCookie(rawToken, secure),
    };
  } catch (e: any) {
    return { status: 400, body: { error: e.message } };
  }
}

async function sendOutboxJob(store: Store, config: PortalConfig, key: string) {
  const job = await store.get(key);
  if (!job || ['sent', 'sending', 'unknown'].includes(job.status)) return;

  if (!config.waBridgeUrl || !config.waBridgeToken || !config.waGroupId) {
    await store.put(key, {
      ...job,
      status: 'blocked',
      error: 'WhatsApp group connection is not configured',
    });
    return;
  }

  let claimed = false;
  try {
    let mentions: string[] = [];
    if (job.sol) {
      const contact = await store.get('contact:' + job.sol);
      if (!contact?.phone) throw new Error('Branch head mobile number missing');
      const r = await fetch(
        config.waBridgeUrl + '/participants?group=' + encodeURIComponent(config.waGroupId),
        { headers: { Authorization: 'Bearer ' + config.waBridgeToken } }
      );
      if (!r.ok) throw new Error('Group membership could not be verified');
      const members: any = await r.json();
      const member = members.find((x: any) => x.phone === contact.phone);
      if (!member?.id) throw new Error('Mapped branch head is not a group participant');
      mentions = [member.id];
    }

    claimed = await store.compareAndSet(key, job, { ...job, status: 'sending' });
    if (!claimed) return;

    const r = await fetch(config.waBridgeUrl + '/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.waBridgeToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({ group_id: config.waGroupId, text: job.text, mentions }),
    });
    if (!r.ok) throw new Error('Bridge returned ' + r.status);
    const result: any = await r.json();
    if (!result.message_id) throw new Error('Bridge did not return a message identifier');

    await store.put(key, {
      ...job,
      status: 'sent',
      messageId: result.message_id,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const current = (await store.get(key)) || job;
    await store.put(key, {
      ...current,
      status: current.status === 'sending' ? 'unknown' : 'blocked',
      error: err.message,
    });
  }
}

export async function handlePortalGet(
  store: Store,
  config: PortalConfig,
  branches: Branch[],
  model: ModelHelpers,
  input: { cookieHeader: string; queryDate?: string | null }
) {
  try {
    const auth = await authenticateRequest(store, config, input.cookieHeader);
    const date =
      input.queryDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    model.cutoffs(date);

    const nowIso = new Date().toISOString();
    try {
      await store.put('login:' + date + ':' + auth.user.phone, {
        date,
        phone: auth.user.phone,
        role: auth.user.role,
        sol: auth.user.sol || null,
        name: auth.user.name || '',
        email: auth.user.email || '',
        lastActive: nowIso,
      });
    } catch {
      // non-blocking
    }

    let pub = await store.get('pub:' + date);
    let subs = await store.list('sub:' + date + ':');
    let reviews = await store.list('review:' + date + ':');

    if (auth.user.role === 'branch') {
      if (pub) {
        pub = { ...pub, rows: pub.rows.filter((b: any) => b.sol === auth.user.sol) };
      }
      subs = subs.filter((s: any) => s.sol === auth.user.sol);
      reviews = reviews.filter((s: any) => s.sol === auth.user.sol);
    }

    const campaigns = await store.list('campaign:');
    const rawRepayments =
      auth.user.role === 'branch'
        ? await store.list('repay:' + auth.user.sol + ':')
        : await store.list('repay:');
    const repayments = model.repaymentsDueInNextDays(rawRepayments, date, 3);
    const rawSma =
      auth.user.role === 'branch'
        ? await store.list('sma:' + auth.user.sol + ':')
        : await store.list('sma:');
    const rawFunding =
      auth.user.role === 'branch'
        ? await store.list('funding:' + auth.user.sol + ':')
        : await store.list('funding:');
    const contacts = auth.user.role === 'admin' ? await store.list('contact:') : [];
    const grants =
      auth.user.role === 'admin'
        ? (await store.list('account:')).map(({ hash, salt, ...a }: any) => a)
        : [];
    const jobs = auth.user.role === 'admin' ? await store.list('out:') : [];
    const logins = await store.list('login:' + date + ':');

    return {
      status: 200,
      body: {
        user: auth.user,
        branches:
          auth.user.role === 'branch'
            ? branches.filter((b) => b.sol === auth.user.sol)
            : branches,
        pub,
        subs,
        reviews,
        campaigns,
        repayments,
        smaAccounts: rawSma,
        fundingAccounts: rawFunding,
        contacts,
        grants,
        jobs,
        logins,
      },
    };
  } catch (e: any) {
    return { status: 403, body: { error: e.message } };
  }
}

export async function handlePortalPost(
  store: Store,
  config: PortalConfig,
  branches: Branch[],
  model: ModelHelpers,
  input: { origin: string | null; expectedOrigin: string; cookieHeader: string; body: any }
) {
  try {
    if (input.origin !== input.expectedOrigin) {
      return { status: 403, body: { error: 'Invalid origin' } };
    }

    const auth = await authenticateRequest(store, config, input.cookieHeader);
    const body = input.body || {};
    const { action, date } = body;
    const adminMobile = assertAdminMobile(config);
    const now = new Date().toISOString();

    const requireAdmin = () => {
      if (auth.user.role !== 'admin') throw new Error('Administrator access required');
    };

    if (action === 'contact') {
      requireAdmin();
      if (
        !branches.find((b) => b.sol === body.sol) ||
        !/^91\d{10}$/.test(body.phone) ||
        !String(body.name || '').trim()
      ) {
        throw new Error('Valid branch, name and 91 + mobile number required');
      }
      await store.put('contact:' + body.sol, {
        sol: body.sol,
        name: String(body.name).trim(),
        phone: body.phone,
      });
    } else if (action === 'grant') {
      requireAdmin();
      const phone = normalizeMobile(body.phone);
      if (phone === adminMobile) {
        throw new Error('The administrator account is reserved');
      }
      const rawEmail = String(body.email || '').trim().toLowerCase();
      const rawName = String(body.name || '').trim().slice(0, 100);
      const roleInput = body.role === 'gm' ? 'srm' : body.role;
      if (
        (rawEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) ||
        !['branch', 'reviewer', 'srm', 'gm', 'none'].includes(body.role)
      ) {
        throw new Error('Valid role (and valid email if provided) required');
      }
      if (roleInput === 'branch' && !branches.find((b) => b.sol === body.sol)) {
        throw new Error('Select a branch');
      }
      const old = await store.get('account:' + phone);
      await store.put('account:' + phone, {
        phone,
        name: rawName || old?.name || '',
        email: rawEmail,
        role: roleInput,
        sol:
          roleInput === 'branch'
            ? body.sol
            : roleInput === 'reviewer' || roleInput === 'srm'
              ? '3933'
              : null,
        version: (old?.version || 0) + 1,
        ...((old?.email || '') === rawEmail && old?.hash
          ? { hash: old.hash, salt: old.salt }
          : {}),
      });
    } else if (action === 'reset-pin') {
      requireAdmin();
      const phone = normalizeMobile(body.phone);
      if (phone === adminMobile) {
        throw new Error('Administrator PIN recovery requires owner-assisted maintenance');
      }
      const old = await store.get('account:' + phone);
      if (!old) throw new Error('Account not found');
      const { hash, salt, ...rest } = old;
      await store.batch([
        { type: 'put', key: 'account:' + phone, value: { ...rest, version: old.version + 1 } },
        { type: 'clearLimit', key: phone },
      ]);
    } else if (action === 'campaign') {
      requireAdmin();
      model.cutoffs(body.start);
      model.cutoffs(body.end);
      if (body.start > body.end || !String(body.title || '').trim()) {
        throw new Error('Invalid campaign dates/title');
      }
      const id = crypto.randomUUID().slice(0, 8);
      await store.put('campaign:' + id, {
        id,
        title: String(body.title).slice(0, 100),
        start: body.start,
        end: body.end,
      });
    } else if (action === 'publish') {
      requireAdmin();
      const cf = model.cutoffs(date);
      if (body.cutoff !== cf.yesterday) {
        throw new Error('Source cutoff must be yesterday');
      }
      if (
        !String(body.baseline || '').trim() ||
        !String(body.fundedDefinition || '').trim() ||
        !body.deadline
      ) {
        throw new Error('Growth baseline, funded definition and deadline required');
      }
      const campaigns = await store.list('campaign:');
      const rows = model.validateSnapshot(body.rows, branches, campaigns, date);
      const old = await store.get('pub:' + date);
      if (old && !String(body.reason || '').trim()) {
        throw new Error('Enter a reason for the corrected publication');
      }
      const pub = {
        date,
        rows,
        version: (old?.version || 0) + 1,
        cutoff: body.cutoff,
        baseline: body.baseline,
        fundedDefinition: body.fundedDefinition,
        deadline: body.deadline,
        campaigns: campaigns.filter((x: any) => x.start <= date && x.end >= date),
        publishedAt: now,
        by: auth.user.email,
        reason: body.reason || '',
      };
      const key = 'out:request:' + date;
      const job = {
        date,
        status: 'pending',
        type: 'Submission request',
        text: `Daily performance reporting is open for ${date}. Please submit by ${body.deadline} IST. ${input.expectedOrigin}/?date=${date}`,
      };
      await store.batch([
        { type: 'put', key: 'pub:' + date, value: pub },
        { type: 'put', key: 'history:' + date + ':' + pub.version, value: pub },
        { type: 'putIfAbsent', key, value: job },
      ]);
      await sendOutboxJob(store, config, key);
    } else if (action === 'submit') {
      model.cutoffs(date);
      const sol = auth.user.role === 'branch' ? auth.user.sol : body.sol;
      if (!branches.find((b) => b.sol === sol)) {
        throw new Error('Select a branch');
      }
      if (auth.user.role === 'reviewer' || auth.user.role === 'srm' || auth.user.role === 'gm') {
        throw new Error('Reviewers and General Manager (GM) cannot submit branch performance');
      }
      const pub = await store.get('pub:' + date);
      if (!pub) {
        throw new Error('Admin must publish this date first');
      }
      const snap = pub.rows.find((b: any) => b.sol === sol);
      const values = model.validateEntry(body.values, snap, pub.campaigns, date);
      const old = await store.get('sub:' + date + ':' + sol);
      const sub = {
        date,
        sol,
        values,
        revision: (old?.revision || 0) + 1,
        snapshotVersion: pub.version,
        by: auth.user.email,
        at: now,
      };
      await store.batch([
        { type: 'put', key: 'sub:' + date + ':' + sol, value: sub },
        {
          type: 'put',
          key: 'submission-history:' + date + ':' + sol + ':' + sub.revision,
          value: sub,
        },
      ]);
    } else if (action === 'review') {
      if (auth.user.role === 'branch') {
        throw new Error('Reviewer access required');
      }
      const sub = await store.get('sub:' + date + ':' + body.sol);
      if (!sub || !String(body.text || '').trim()) {
        throw new Error('Select a submitted branch and enter remarks');
      }
      if (sub.revision !== body.revision) {
        throw new Error('Report changed; refresh before replying');
      }
      const id = crypto.randomUUID();
      const branch = branches.find((b) => b.sol === body.sol)!;
      const isGm = auth.user.role === 'srm' || auth.user.role === 'gm';
      const status =
        body.status === 'clarification'
          ? 'clarification'
          : isGm && (body.status === 'srm_direction' || body.status === 'gm_direction')
            ? body.status
            : 'reviewed';
      const review = {
        id,
        date,
        sol: body.sol,
        text: String(body.text).slice(0, 2000),
        revision: sub.revision,
        status,
        role: auth.user.role === 'gm' ? 'srm' : auth.user.role,
        by: auth.user.email,
        at: now,
      };
      const key = 'out:review:' + id;
      await store.batch([
        { type: 'put', key: 'review:' + date + ':' + id, value: review },
        {
          type: 'put',
          key,
          value: {
            date,
            sol: body.sol,
            type: isGm ? 'GM Direction' : 'Review reply',
            status: 'pending',
            text: `${branch.name} (${body.sol}) • ${date}\n${isGm ? '★ GM DIRECTION:\n' : ''}${review.text}\n${isGm ? 'General Manager (GM): ' : 'Reviewer: '}${auth.user.email}`,
          },
        },
      ]);
      await sendOutboxJob(store, config, key);
    } else if (action === 'upload-repayments') {
      requireAdmin();
      const validated = model.validateRepayments(body.rows, branches);
      const existing = await store.list('repay:');
      const existingMap = new Map<string, { roll_no?: string; completed?: boolean; completedAt?: any; completedBy?: any }>();
      const oldKeysToDelete: string[] = [];
      const nextKeys = new Set(validated.map((r: any) => 'repay:' + r.sol + ':' + r.id));
      for (const old of existing) {
        if (!nextKeys.has(old.key)) {
          oldKeysToDelete.push(old.key);
        } else {
          existingMap.set(old.key, {
            roll_no: old.roll_no,
            completed: old.completed,
            completedAt: old.completedAt,
            completedBy: old.completedBy,
          });
        }
      }
      let chunk: Array<{ type: 'put'; key: string; value: any } | { type: 'del'; key: string }> = [];
      for (const k of oldKeysToDelete) {
        chunk.push({ type: 'del', key: k });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      for (const row of validated) {
        const key = 'repay:' + row.sol + ':' + row.id;
        const prev = existingMap.get(key);
        chunk.push({
          type: 'put',
          key,
          value: {
            ...row,
            roll_no: row.roll_no || prev?.roll_no || '',
            completed: Boolean(prev?.completed),
            completedAt: prev?.completed ? prev.completedAt : null,
            completedBy: prev?.completed ? prev.completedBy : null,
            uploadedAt: now,
            uploadedBy: auth.user.email,
          },
        });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      return { status: 200, body: { ok: true, imported: validated.length } };
    } else if (action === 'repayment-status') {
      if (auth.user.role === 'reviewer' || auth.user.role === 'srm' || auth.user.role === 'gm') {
        throw new Error('Only branch heads or administrator can update repayment status');
      }
      const sol = auth.user.role === 'branch' ? auth.user.sol : body.sol;
      if (!branches.find((b) => b.sol === sol) || !String(body.id || '').trim()) {
        throw new Error('Valid branch and repayment account required');
      }
      const key = 'repay:' + sol + ':' + String(body.id).trim();
      const current = await store.get(key);
      if (!current) {
        throw new Error('Repayment account not found');
      }
      const completed = Boolean(body.completed);
      const roll_no = body.roll_no !== undefined ? String(body.roll_no).trim().slice(0, 30) : (current.roll_no || '');
      const actor = auth.user.name || auth.user.email || auth.user.phone.slice(2);
      await store.put(key, {
        ...current,
        completed,
        roll_no,
        completedAt: completed ? now : null,
        completedBy: completed ? actor : null,
      });
    } else if (action === 'upload-directory') {
      requireAdmin();
      const validated = model.validateDirectory(body.rows, branches, adminMobile);
      const existingAccounts = await store.list('account:');
      const byPhone = new Map(existingAccounts.map((a: any) => [a.phone, a]));
      const ops: Array<{ type: 'put'; key: string; value: any }> = [];
      for (const entry of validated) {
        if (entry.sol && entry.sol !== '3933' && entry.name && entry.role !== 'none') {
          ops.push({
            type: 'put',
            key: 'contact:' + entry.sol,
            value: { sol: entry.sol, name: entry.name, phone: entry.phone },
          });
        }
        const old = byPhone.get(entry.phone);
        const nextEmail = entry.email || '';
        ops.push({
          type: 'put',
          key: 'account:' + entry.phone,
          value: {
            phone: entry.phone,
            name: entry.name || old?.name || '',
            email: nextEmail,
            role: entry.role,
            sol:
              entry.role === 'branch'
                ? entry.sol
                : entry.role === 'reviewer' || entry.role === 'srm'
                  ? entry.sol || '3933'
                  : null,
            version: (old?.version || 0) + 1,
            ...((old?.email || '') === nextEmail && old?.hash
              ? { hash: old.hash, salt: old.salt }
              : {}),
          },
        });
      }
      for (let i = 0; i < ops.length; i += 200) {
        await store.batch(ops.slice(i, i + 200));
      }
    } else if (action === 'retry') {
      requireAdmin();
      if (!String(body.key || '').startsWith('out:')) {
        throw new Error('Invalid job');
      }
      await sendOutboxJob(store, config, body.key);
    } else if (action === 'handoff') {
      const token = randomToken();
      await store.put('handoff:' + token, {
        phone: auth.user.phone,
        expires: Date.now() + 60_000,
      });
      return { status: 200, body: { ok: true, token } };
    } else if (action === 'broadcast-absent-branches') {
      if (auth.user.role === 'branch') {
        throw new Error('Admin or Reviewer access required');
      }
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];
      const ops: Array<{ type: 'put'; key: string; value: any }> = [];
      const keys: string[] = [];
      for (const item of jobs) {
        if (!item.sol || !item.text) continue;
        const key = 'out:absent:' + date + ':' + item.sol;
        keys.push(key);
        ops.push({
          type: 'put',
          key,
          value: {
            date,
            sol: item.sol,
            type: 'Absent Branch Reminder',
            status: 'pending',
            text: item.text,
            by: auth.user.email,
            at: now,
          },
        });
      }
      for (let i = 0; i < ops.length; i += 200) {
        await store.batch(ops.slice(i, i + 200));
      }
      for (const k of keys) {
        await sendOutboxJob(store, config, k);
      }
      return { status: 200, body: { ok: true, queued: keys.length } };
    } else if (action === 'upload-sma') {
      requireAdmin();
      const validated = model.validateSMAAccounts(body.rows, branches);
      const existing = await store.list('sma:');
      const existingMap = new Map<string, { roll_no?: string; status?: string; remarks?: string; promise_date?: any; updatedAt?: any; updatedBy?: any }>();
      const oldKeysToDelete: string[] = [];
      const nextKeys = new Set(validated.map((r: any) => 'sma:' + r.sol + ':' + r.id));
      for (const old of existing) {
        if (!nextKeys.has(old.key)) {
          oldKeysToDelete.push(old.key);
        } else {
          existingMap.set(old.key, {
            roll_no: old.roll_no,
            status: old.status,
            remarks: old.remarks,
            promise_date: old.promise_date,
            updatedAt: old.updatedAt,
            updatedBy: old.updatedBy,
          });
        }
      }
      let chunk: Array<{ type: 'put'; key: string; value: any } | { type: 'del'; key: string }> = [];
      for (const k of oldKeysToDelete) {
        chunk.push({ type: 'del', key: k });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      for (const row of validated) {
        const key = 'sma:' + row.sol + ':' + row.id;
        const prev = existingMap.get(key);
        chunk.push({
          type: 'put',
          key,
          value: {
            ...row,
            roll_no: row.roll_no || prev?.roll_no || '',
            status: prev?.status || row.status || 'pending',
            remarks: prev?.remarks || row.remarks || '',
            promise_date: prev?.promise_date || row.promise_date || null,
            updatedAt: prev?.updatedAt || now,
            updatedBy: prev?.updatedBy || auth.user.email,
          },
        });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      return { status: 200, body: { ok: true, imported: validated.length } };
    } else if (action === 'sma-status') {
      const sol = auth.user.role === 'branch' ? auth.user.sol : body.sol;
      if (!branches.find((b) => b.sol === sol) || !String(body.id || '').trim()) {
        throw new Error('Valid branch and SMA account required');
      }
      const key = 'sma:' + sol + ':' + String(body.id).trim();
      const current = await store.get(key);
      if (!current) {
        throw new Error('SMA account not found');
      }
      const status = String(body.status || current.status || 'pending').toLowerCase();
      if (!['pending', 'contacted', 'promised', 'resolved'].includes(status)) {
        throw new Error('Invalid SMA follow-up status');
      }
      const promise_date = body.promise_date ? model.normalizeDate(body.promise_date, 'Promise date') : null;
      const remarks = String(body.remarks !== undefined ? body.remarks : (current.remarks || '')).slice(0, 500);
      const roll_no = body.roll_no !== undefined ? String(body.roll_no).trim().slice(0, 30) : (current.roll_no || '');
      const actor = auth.user.name || auth.user.email || auth.user.phone.slice(2);
      await store.put(key, {
        ...current,
        status,
        promise_date,
        remarks,
        roll_no,
        updatedAt: now,
        updatedBy: actor,
      });
    } else if (action === 'sma-entry') {
      model.cutoffs(date);
      const sol = auth.user.role === 'branch' ? auth.user.sol : body.sol;
      if (!branches.find((b) => b.sol === sol)) {
        throw new Error('Select a branch');
      }
      if (auth.user.role === 'reviewer' || auth.user.role === 'srm' || auth.user.role === 'gm') {
        throw new Error('Reviewers and General Manager (GM) cannot submit branch performance');
      }
      const pub = await store.get('pub:' + date);
      if (!pub) {
        throw new Error('Admin must publish this date first');
      }
      const snap = pub.rows.find((b: any) => b.sol === sol);
      if (!snap) throw new Error('Branch snapshot not found');

      const oldSub = await store.get('sub:' + date + ':' + sol);
      const prevVals = oldSub?.values || {};

      const smaValues: any = {};
      for (const b of ['sma0', 'sma1', 'sma2']) {
        smaValues[b + '_count'] = model.number(body[b + '_count'] ?? prevVals[b + '_count'] ?? 0, b + ' eliminated count', true);
        smaValues[b + '_amount'] = model.number(body[b + '_amount'] ?? prevVals[b + '_amount'] ?? 0, b + ' eliminated amount');
        if (smaValues[b + '_count'] === 0 && smaValues[b + '_amount'] !== 0) {
          throw new Error(b + ': amount requires an eliminated account');
        }
        if (smaValues[b + '_count'] > snap[b + '_yesterday_count'] && !(body.notes || prevVals.notes)?.trim()) {
          throw new Error('Explain SMA eliminations exceeding yesterday’s count in notes');
        }
      }

      const notes = String(body.notes !== undefined ? body.notes : (prevVals.notes || '')).slice(0, 2000);

      const mergedValues = {
        sb_opened: prevVals.sb_opened || 0,
        sb_funded: prevVals.sb_funded || 0,
        cd_opened: prevVals.cd_opened || 0,
        cd_funded: prevVals.cd_funded || 0,
        sanction_retail_count: prevVals.sanction_retail_count || 0,
        sanction_retail_amount: prevVals.sanction_retail_amount || 0,
        sanction_agri_count: prevVals.sanction_agri_count || 0,
        sanction_agri_amount: prevVals.sanction_agri_amount || 0,
        sanction_msme_count: prevVals.sanction_msme_count || 0,
        sanction_msme_amount: prevVals.sanction_msme_amount || 0,
        plans: prevVals.plans || {},
        ...prevVals,
        ...smaValues,
        notes,
      };

      const sub = {
        date,
        sol,
        values: mergedValues,
        revision: (oldSub?.revision || 0) + 1,
        snapshotVersion: pub.version,
        by: auth.user.email,
        at: now,
      };

      await store.batch([
        { type: 'put', key: 'sub:' + date + ':' + sol, value: sub },
        {
          type: 'put',
          key: 'submission-history:' + date + ':' + sol + ':' + sub.revision,
          value: sub,
        },
      ]);
    } else if (action === 'upload-funding') {
      requireAdmin();
      if (!model.validateFundingAccounts) {
        throw new Error('Funding validator not available');
      }
      const validated = model.validateFundingAccounts(body.rows, branches);
      const existing = await store.list('funding:');
      const existingMap = new Map<string, { roll_no?: string; funded?: boolean; funded_amount?: number; funded_at?: any; funded_by?: any; call_status?: string; notes?: string; updatedAt?: any }>();
      const oldKeysToDelete: string[] = [];
      const nextKeys = new Set(validated.map((r: any) => 'funding:' + r.sol + ':' + r.id));
      for (const old of existing) {
        if (!nextKeys.has(old.key)) {
          oldKeysToDelete.push(old.key);
        } else {
          existingMap.set(old.key, {
            roll_no: old.roll_no,
            funded: old.funded,
            funded_amount: old.funded_amount,
            funded_at: old.funded_at,
            funded_by: old.funded_by,
            call_status: old.call_status,
            notes: old.notes,
            updatedAt: old.updatedAt,
          });
        }
      }
      let chunk: Array<{ type: 'put'; key: string; value: any } | { type: 'del'; key: string }> = [];
      for (const k of oldKeysToDelete) {
        chunk.push({ type: 'del', key: k });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      for (const row of validated) {
        const key = 'funding:' + row.sol + ':' + row.id;
        const prev = existingMap.get(key);
        chunk.push({
          type: 'put',
          key,
          value: {
            ...row,
            roll_no: row.roll_no || prev?.roll_no || '',
            funded: Boolean(prev?.funded),
            funded_amount: prev?.funded ? prev.funded_amount : 0,
            funded_at: prev?.funded ? prev.funded_at : null,
            funded_by: prev?.funded ? prev.funded_by : null,
            call_status: prev?.call_status || 'not_called',
            notes: prev?.notes || '',
            updatedAt: prev?.updatedAt || now,
            uploadedAt: now,
            uploadedBy: auth.user.email,
          },
        });
        if (chunk.length >= 200) {
          await store.batch(chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await store.batch(chunk);
        chunk = [];
      }
      return { status: 200, body: { ok: true, imported: validated.length } };
    } else if (action === 'funding-status') {
      const sol = auth.user.role === 'branch' ? auth.user.sol : body.sol;
      if (!branches.find((b) => b.sol === sol) || !String(body.id || '').trim()) {
        throw new Error('Valid branch and account required');
      }
      const key = 'funding:' + sol + ':' + String(body.id).trim();
      const current = await store.get(key);
      if (!current) {
        throw new Error('Low balance account not found');
      }
      const funded = body.funded !== undefined ? Boolean(body.funded) : current.funded;
      const funded_amount =
        body.funded_amount !== undefined
          ? model.number(body.funded_amount, 'Funded amount', false, false)
          : current.funded_amount || 0;
      const call_status = body.call_status
        ? String(body.call_status).trim().toLowerCase()
        : current.call_status || 'not_called';
      const notes = body.notes !== undefined ? String(body.notes).slice(0, 500) : current.notes || '';
      const roll_no = body.roll_no !== undefined ? String(body.roll_no).trim().slice(0, 30) : (current.roll_no || '');
      const actor = auth.user.name || auth.user.email || auth.user.phone.slice(2);
      await store.put(key, {
        ...current,
        funded,
        funded_amount: funded ? funded_amount : 0,
        funded_at: funded ? (current.funded_at || now) : null,
        funded_by: funded ? (current.funded_by || actor) : null,
        call_status,
        notes,
        roll_no,
        updatedAt: now,
        updatedBy: actor,
      });
    } else {
      throw new Error('Unknown action');
    }

    return { status: 200, body: { ok: true } };
  } catch (e: any) {
    return { status: 400, body: { error: e.message } };
  }
}
