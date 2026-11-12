import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import branches from '../app/branches.json' with { type: 'json' };
import * as model from '../app/model.mjs';

const coreSrc = await readFile('lib/portal-core.ts', 'utf8');
await writeFile(
  'tests/.portal-core.mjs',
  ts.transpile(coreSrc, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })
);
const core = await import('./.portal-core.mjs');

const sql = new DatabaseSync(':memory:');
sql.exec(
  'CREATE TABLE records(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE auth_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,window_end INTEGER NOT NULL)'
);

const store = {
  async get(key) {
    const row = sql.prepare('SELECT value FROM records WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : null;
  },
  async put(key, value) {
    sql
      .prepare('INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, JSON.stringify(value));
  },
  async del(key) {
    sql.prepare('DELETE FROM records WHERE key=?').run(key);
  },
  async list(prefix) {
    const rows = sql
      .prepare('SELECT key,value FROM records WHERE key LIKE ? ORDER BY key')
      .all(prefix + '%');
    return rows.map((r) => ({ key: r.key, ...JSON.parse(r.value) }));
  },
  async putIfAbsent(key, value) {
    const res = sql
      .prepare('INSERT OR IGNORE INTO records(key,value) VALUES(?,?)')
      .run(key, JSON.stringify(value));
    return Number(res.changes) > 0;
  },
  async compareAndSet(key, expected, next) {
    const res = sql
      .prepare('UPDATE records SET value=? WHERE key=? AND value=?')
      .run(JSON.stringify(next), key, JSON.stringify(expected));
    return Number(res.changes) > 0;
  },
  async batch(ops) {
    sql.exec('BEGIN');
    try {
      for (const op of ops) {
        if (op.type === 'put') {
          await this.put(op.key, op.value);
        } else if (op.type === 'del') {
          await this.del(op.key);
        } else if (op.type === 'putIfAbsent') {
          await this.putIfAbsent(op.key, op.value);
        } else if (op.type === 'clearLimit') {
          await this.clearAuthLimit(op.key);
        }
      }
      sql.exec('COMMIT');
    } catch (e) {
      sql.exec('ROLLBACK');
      throw e;
    }
  },
  async incrementAuthLimit(key, now, windowMs) {
    const row = sql
      .prepare(
        'INSERT INTO auth_limits(key,attempts,window_end) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_end<=? THEN 1 ELSE attempts+1 END,window_end=CASE WHEN window_end<=? THEN excluded.window_end ELSE window_end END RETURNING attempts'
      )
      .get(key, now + windowMs, now, now);
    return Number(row.attempts);
  },
  async clearAuthLimit(key) {
    sql.prepare('DELETE FROM auth_limits WHERE key=?').run(key);
  },
};

const config = {
  adminMobile: '919000000009',
  adminEmail: 'admin@iob.local',
};

const expectedOrigin = 'https://dailyreport-9265a.web.app';
const cookies = {};

async function authGet(who = 'owner') {
  return core.handleAuthGet(store, config, cookies[who] || '');
}

async function authPost(body, who = 'owner') {
  const res = await core.handleAuthPost(store, config, {
    origin: expectedOrigin,
    expectedOrigin,
    cookieHeader: cookies[who] || '',
    body,
  });
  if (res.setCookie) {
    cookies[who] = res.setCookie.split(';')[0];
    assert.ok(res.setCookie.includes('__session='), 'Firebase Hosting requires __session cookie');
  }
  return res;
}

async function portalGet(date, who = 'owner') {
  return core.handlePortalGet(store, config, branches, model, {
    cookieHeader: cookies[who] || '',
    queryDate: date,
  });
}

async function portalPost(date, body, who = 'owner') {
  return core.handlePortalPost(store, config, branches, model, {
    origin: expectedOrigin,
    expectedOrigin,
    cookieHeader: cookies[who] || '',
    body: { date, ...body },
  });
}

const date = '2026-11-12';
const rows = branches.map((b) => ({
  sol: b.sol,
  ...Object.fromEntries(model.baseFields.map((f) => [f, 0])),
}));
const baseValues = Object.fromEntries(
  [
    'sb_opened',
    'sb_funded',
    'cd_opened',
    'cd_funded',
    'sma0_count',
    'sma0_amount',
    'sma1_count',
    'sma1_amount',
    'sma2_count',
    'sma2_amount',
    ...model.sanctionEntryFields,
  ].map((k) => [k, 0])
);

let count = 0;
function check(fn) {
  fn();
  count++;
}

// 1. Unauthenticated access rejected
check(() => assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n, 0));
assert.equal((await authGet()).body.user, null);
count++;
assert.equal((await portalPost(date, { action: 'publish', rows })).status, 400);
count++;

// 2. Unregistered mobile rejected
assert.equal((await authPost({ action: 'lookup', phone: '9000000088' }, 'unknown')).status, 400);
count++;

// 3. Admin bootstrap via ADMIN_MOBILE + PIN setup
const adminLookup = await authPost({ action: 'lookup', phone: '9000000009' });
assert.equal(adminLookup.status, 200);
assert.equal(adminLookup.body.setup, true);
assert.equal(adminLookup.body.role, 'admin');
count++;

assert.equal(
  (await authPost({ action: 'setup', phone: '9000000009', pin: '1234', confirm: '9999' })).status,
  400
);
count++;
assert.equal(
  (await authPost({ action: 'setup', phone: '9000000009', pin: '5827', confirm: '5827' })).status,
  200
);
count++;
assert.equal((await authGet()).body.user.role, 'admin');
count++;

// 4. Origin CSRF protection
const badOrigin = await core.handlePortalPost(store, config, branches, model, {
  origin: 'https://evil.example',
  expectedOrigin,
  cookieHeader: cookies.owner,
  body: { date, action: 'campaign', title: 'X', start: date, end: date },
});
assert.equal(badOrigin.status, 403);
count++;

// 5. Publish daily snapshot + outbox deduplication
const pubPayload = {
  action: 'publish',
  rows,
  cutoff: '2026-11-11',
  baseline: '31 March 2026',
  fundedDefinition: 'Min balance Rs 500',
  deadline: '17:00',
};
assert.equal((await portalPost(date, pubPayload)).status, 200);
count++;
assert.equal((await portalPost(date, { ...pubPayload, reason: 'Updated' })).status, 200);
count++;
check(() =>
  assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE key LIKE 'out:request:%'").get().n, 1)
);

// 6. Grant branch, reviewer, and SRM roles (Mobile + PIN only)
assert.equal(
  (await portalPost(date, { action: 'grant', phone: '9000000001', email: 'bm0174@iob.in', role: 'branch', sol: '0174' }))
    .status,
  200
);
count++;
assert.equal(
  (await portalPost(date, { action: 'grant', phone: '9000000002', email: 'rev@iob.in', role: 'reviewer' }))
    .status,
  200
);
count++;
assert.equal(
  (await portalPost(date, { action: 'grant', phone: '9000000003', email: 'srm@iob.in', role: 'srm' })).status,
  200
);
count++;

// 7. Branch head setup & submit with Core Retail / Agri / MSME sanctions
assert.equal((await authPost({ action: 'setup', phone: '9000000001', pin: '4286', confirm: '4286' }, 'branch')).status, 200);
count++;
assert.equal(
  (
    await portalPost(
      date,
      {
        action: 'submit',
        sol: '0376', // ignored/enforced to 0174 for branch role
        values: {
          ...baseValues,
          sanction_retail_count: 2,
          sanction_retail_amount: 500000,
          sanction_agri_count: 1,
          sanction_agri_amount: 300000,
          sanction_msme_count: 1,
          sanction_msme_amount: 900000,
        },
      },
      'branch'
    )
  ).status,
  200
);
count++;
const branchGet = await portalGet(date, 'branch');
assert.equal(branchGet.body.branches.length, 1);
assert.equal(branchGet.body.subs[0].sol, '0174');
assert.equal(branchGet.body.subs[0].values.sanction_msme_amount, 900000);
count++;

// 8. Rate limiting (5 failed attempts -> lockout)
for (let i = 0; i < 5; i++) {
  assert.equal((await authPost({ action: 'login', phone: '9000000001', pin: '0000' }, 'branch2')).body.error, 'Incorrect PIN');
  count++;
}
assert.match(
  (await authPost({ action: 'login', phone: '9000000001', pin: '4286' }, 'branch2')).body.error,
  /Too many/
);
count++;

// Admin reset-pin clears limit & invalidates session
assert.equal((await portalPost(date, { action: 'reset-pin', phone: '9000000001' })).status, 200);
count++;
assert.equal((await portalGet(date, 'branch')).status, 403);
count++;

// 9. Reviewer and SRM workflow
assert.equal((await authPost({ action: 'setup', phone: '9000000002', pin: '5892', confirm: '5892' }, 'rev')).status, 200);
assert.equal((await authPost({ action: 'setup', phone: '9000000003', pin: '9832', confirm: '9832' }, 'srm')).status, 200);
count += 2;
assert.equal((await portalPost(date, { action: 'submit', sol: '0174', values: baseValues }, 'srm')).status, 400);
count++;
assert.equal(
  (
    await portalPost(
      date,
      { action: 'review', sol: '0174', revision: 1, text: 'Focus on Core MSME', status: 'srm_direction' },
      'srm'
    )
  ).status,
  200
);
count++;
const srmView = await portalGet(date, 'srm');
assert.equal(srmView.body.reviews[0].status, 'srm_direction');
assert.equal(srmView.body.reviews[0].role, 'srm');
count++;

// 10. Revocation
assert.equal(
  (await portalPost(date, { action: 'grant', phone: '9000000002', email: 'rev@iob.in', role: 'none' })).status,
  200
);
assert.equal(
  (await portalPost(date, { action: 'review', sol: '0174', revision: 1, text: 'Blocked' }, 'rev')).status,
  400
);
count += 2;

await unlink('tests/.portal-core.mjs');
console.log(count + ' Firebase portal checks passed: __session cookie, Mobile+PIN auth, admin bootstrap, Firestore store contract, rate-limit lockout, reset, sanctions, SRM direction, and revocation.');
