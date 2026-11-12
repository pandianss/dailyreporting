import crypto from 'node:crypto';

export type Role = 'admin' | 'branch' | 'reviewer' | 'srm' | 'none';

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
      email: account.email as string,
      phone: account.phone as string,
      role: account.role as Role,
      sol: (account.sol ?? null) as string | null,
    },
  };
}

export async function handleAuthGet(store: Store, config: PortalConfig, cookieHeader: string) {
  try {
    const auth = await authenticateRequest(store, config, cookieHeader);
    return { status: 200, body: { user: auth.user } };
  } catch {
    return { status: 200, body: { user: null } };
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
    const contacts = auth.user.role === 'admin' ? await store.list('contact:') : [];
    const grants =
      auth.user.role === 'admin'
        ? (await store.list('account:')).map(({ hash, salt, ...a }: any) => a)
        : [];
    const jobs = auth.user.role === 'admin' ? await store.list('out:') : [];

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
        contacts,
        grants,
        jobs,
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
      if (
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ||
        !['branch', 'reviewer', 'srm', 'none'].includes(body.role)
      ) {
        throw new Error('Valid email and role required');
      }
      if (body.role === 'branch' && !branches.find((b) => b.sol === body.sol)) {
        throw new Error('Select a branch');
      }
      const email = String(body.email).toLowerCase();
      const old = await store.get('account:' + phone);
      await store.put('account:' + phone, {
        phone,
        email,
        role: body.role,
        sol: body.role === 'branch' ? body.sol : null,
        version: (old?.version || 0) + 1,
        ...(old?.email === email && old?.hash ? { hash: old.hash, salt: old.salt } : {}),
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
      if (auth.user.role === 'reviewer' || auth.user.role === 'srm') {
        throw new Error('Reviewers and SRM cannot submit branch performance');
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
      const isSrm = auth.user.role === 'srm';
      const status =
        body.status === 'clarification'
          ? 'clarification'
          : isSrm && body.status === 'srm_direction'
            ? 'srm_direction'
            : 'reviewed';
      const review = {
        id,
        date,
        sol: body.sol,
        text: String(body.text).slice(0, 2000),
        revision: sub.revision,
        status,
        role: auth.user.role,
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
            type: isSrm ? 'SRM Direction' : 'Review reply',
            status: 'pending',
            text: `${branch.name} (${body.sol}) • ${date}\n${isSrm ? '★ SRM DIRECTION:\n' : ''}${review.text}\n${isSrm ? 'Senior Regional Manager (SRM): ' : 'Reviewer: '}${auth.user.email}`,
          },
        },
      ]);
      await sendOutboxJob(store, config, key);
    } else if (action === 'retry') {
      requireAdmin();
      if (!String(body.key || '').startsWith('out:')) {
        throw new Error('Invalid job');
      }
      await sendOutboxJob(store, config, body.key);
    } else {
      throw new Error('Unknown action');
    }

    return { status: 200, body: { ok: true } };
  } catch (e: any) {
    return { status: 400, body: { error: e.message } };
  }
}
