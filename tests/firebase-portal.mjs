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

// 11. Repayments due in next 3 days + branch completion
const repayCSV = [
  'Branch Code,CIF,Account Name,Due Amount,Due Date',
  '174,CIF100,Ramesh Kumar,45000,12/11/2026',
  '0174,CIF101,Sita Devi,12000,2026-11-15',
  '0174,CIF102,Past Due,9000,2026-11-11',
  '0174,CIF103,Future Due,9000,2026-11-16',
  '0376,CIF200,Palani Traders,80000,2026-11-13',
].join('\n');
const parsedRepay = model.validateRepayments(model.parseRepaymentsCSV(repayCSV), branches);
assert.equal(parsedRepay.length, 5);
assert.equal(parsedRepay[0].sol, '0174');
assert.equal(parsedRepay[0].due_date, '2026-11-12');
count += 3;

assert.equal(
  (await portalPost(date, { action: 'upload-repayments', rows: parsedRepay })).status,
  200
);
count++;

// Re-enroll branch 0174 after reset-pin earlier
assert.equal(
  (await authPost({ action: 'setup', phone: '9000000001', pin: '7351', confirm: '7351' }, 'branch3')).status,
  200
);
count++;

const branchRepayView = await portalGet(date, 'branch3');
assert.equal(branchRepayView.body.repayments.length, 2);
assert.equal(branchRepayView.body.repayments[0].cif, 'CIF100');
assert.equal(branchRepayView.body.repayments[1].cif, 'CIF101');
count += 3;

// SRM cannot mark repayment complete
assert.equal(
  (
    await portalPost(
      date,
      { action: 'repayment-status', sol: '0174', id: parsedRepay[0].id, completed: true },
      'srm'
    )
  ).status,
  400
);
count++;

// Branch head marks repayment complete
assert.equal(
  (
    await portalPost(
      date,
      { action: 'repayment-status', sol: '0174', id: parsedRepay[0].id, completed: true },
      'branch3'
    )
  ).status,
  200
);
count++;

// Re-uploading list preserves completed status
assert.equal(
  (await portalPost(date, { action: 'upload-repayments', rows: parsedRepay })).status,
  200
);
const afterReupload = await portalGet(date, 'srm');
assert.equal(afterReupload.body.repayments.length, 3);
const cif100 = afterReupload.body.repayments.find((r) => r.cif === 'CIF100');
assert.equal(cif100.completed, true);
assert.equal(cif100.completedBy, 'bm0174@iob.in');
count += 4;

// 12. Bulk branch directory CSV upload (including SOL 3933 Regional Office, email optional)
const dirCSV = [
  'sol,branch_name,head_name,phone,email,role',
  '0175,Ayakudi,Karthik Raja,9876543210,,branch',
  '0176,Cumbum,,,,branch', // blank row in 56-branch template should be skipped
  '3933,Regional Office,Regional Desk,9876543211,,reviewer',
  '3933,Regional Office,SRM Head,9876543212,srm2@iob.in,srm',
].join('\n');
const parsedDir = model.validateDirectory(model.parseDirectoryCSV(dirCSV), branches, config.adminMobile);
assert.equal(parsedDir.length, 3);
assert.equal(parsedDir[0].sol, '0175');
assert.equal(parsedDir[0].phone, '919876543210');
assert.equal(parsedDir[0].email, '');
assert.equal(parsedDir[1].role, 'reviewer');
assert.equal(parsedDir[1].sol, '3933');
assert.equal(parsedDir[2].role, 'srm');
assert.equal(parsedDir[2].sol, '3933');
count += 7;

assert.throws(
  () =>
    model.validateDirectory(
      [{ sol: '3933', name: 'Bad', phone: '9876543219', email: 'bad@iob.in', role: 'branch' }],
      branches,
      config.adminMobile
    ),
  /Regional Office/
);
count++;

assert.equal(
  (await portalPost(date, { action: 'upload-directory', rows: parsedDir })).status,
  200
);
const adminViewAfterDir = await portalGet(date, 'owner');
assert.ok(adminViewAfterDir.body.contacts.find((c) => c.sol === '0175' && c.name === 'Karthik Raja'));
assert.equal(adminViewAfterDir.body.contacts.find((c) => c.sol === '3933'), undefined);
assert.ok(adminViewAfterDir.body.grants.find((g) => g.phone === '919876543210' && g.sol === '0175' && g.name === 'Karthik Raja'));
assert.ok(adminViewAfterDir.body.grants.find((g) => g.phone === '919876543211' && g.role === 'reviewer' && g.sol === '3933'));
assert.ok(adminViewAfterDir.body.grants.find((g) => g.phone === '919876543212' && g.role === 'srm' && g.sol === '3933'));
// Branch head uploaded without email can set up PIN and log in
assert.equal((await authPost({ action: 'setup', phone: '9876543210', pin: '6428', confirm: '6428' }, 'bm0175')).status, 200);
assert.equal((await portalGet(date, 'bm0175')).body.user.sol, '0175');
count += 7;

// 13. SMA Follow-up Portal features: Bulk CSV upload, account tracking, and bidirectional sync to daily report
const smaCSV = [
  'branch_code,cif,borrower_name,bucket,amount,dpd,phone,status,remarks',
  '0174,CIF_SMA0_01,Ramalingam M,SMA0,250000,15,9842100001,pending,Notice sent',
  '0174,CIF_SMA1_01,Kavitha Textiles,SMA1,450000,42,9842100002,promised,Payment committed by Friday',
  '0175,CIF_SMA2_01,Sakthi Traders,SMA2,800000,75,9842100003,contacted,Renewal under process',
].join('\n');
const parsedSMA = model.validateSMAAccounts(model.parseSMACSV(smaCSV), branches);
assert.equal(parsedSMA.length, 3);
assert.equal(parsedSMA[0].sol, '0174');
assert.equal(parsedSMA[0].bucket, 'sma0');
assert.equal(parsedSMA[0].amount, 250000);
count += 4;

// Admin uploads SMA accounts
assert.equal((await portalPost(date, { action: 'upload-sma', rows: parsedSMA })).status, 200);
count++;

// Branch head sees only their branch's SMA accounts
const bm0174Portal = await portalGet(date, 'branch3');
assert.equal(bm0174Portal.body.smaAccounts.length, 2);
assert.ok(bm0174Portal.body.smaAccounts.every((a) => a.sol === '0174'));
// Admin / Reviewer sees all SMA accounts
const adminSmaView = await portalGet(date, 'owner');
assert.equal(adminSmaView.body.smaAccounts.length, 3);
count += 3;

// Branch head updates follow-up on an SMA account
const smaItem = bm0174Portal.body.smaAccounts[0];
assert.equal(
  (
    await portalPost(
      date,
      {
        action: 'sma-status',
        sol: '0174',
        id: smaItem.id,
        status: 'resolved',
        remarks: 'Full overdue cleared today',
      },
      'branch3'
    )
  ).status,
  200
);
const updatedBmSma = await portalGet(date, 'branch3');
const updatedAcc = updatedBmSma.body.smaAccounts.find((a) => a.id === smaItem.id);
assert.equal(updatedAcc.status, 'resolved');
assert.equal(updatedAcc.remarks, 'Full overdue cleared today');
count += 3;

// Branch head saves SMA eliminations from the SMA Follow-up portal (sma-entry)
// This MUST immediately reflect in the daily reporting portal!
assert.equal(
  (
    await portalPost(
      date,
      {
        action: 'sma-entry',
        sol: '0174',
        sma0_count: 1,
        sma0_amount: 250000,
        sma1_count: 0,
        sma1_amount: 0,
        sma2_count: 0,
        sma2_amount: 0,
        notes: 'SMA0 Ramalingam account closed through recovery today.',
      },
      'branch3'
    )
  ).status,
  200
);
count++;

// Daily reporting portal view check: the submission for 0174 now reflects the updated SMA figures!
const reportingPortalView = await portalGet(date, 'owner');
const sub0174 = reportingPortalView.body.subs.find((s) => s.sol === '0174');
assert.ok(sub0174, 'Branch submission must exist');
assert.equal(sub0174.values.sma0_count, 1);
assert.equal(sub0174.values.sma0_amount, 250000);
assert.equal(sub0174.values.notes, 'SMA0 Ramalingam account closed through recovery today.');
// Previously submitted sanctions / account openings remain preserved!
assert.equal(sub0174.values.sanction_retail_count, 2);
assert.equal(sub0174.values.sanction_retail_amount, 500000);
count += 6;

// 14. SSO Handoff token between Daily Reporting and SMA portals
const handoffRes = await portalPost(date, { action: 'handoff' }, 'branch3');
assert.equal(handoffRes.status, 200);
assert.ok(handoffRes.body.token);
const handoffToken = handoffRes.body.token;
count += 2;

// Consume handoff on SMA portal domain to get authenticated session
const consumeRes = await authPost({ action: 'handoff-login', token: handoffToken }, 'smaSession');
assert.equal(consumeRes.status, 200);
assert.ok(consumeRes.setCookie);
assert.ok(cookies['smaSession']);
// Token is single-use: consuming again must fail
assert.equal((await authPost({ action: 'handoff-login', token: handoffToken }, 'badSession')).status, 400);
count += 3;

// 15. Low Balance Funding Portal features: CSV upload, branch isolation, dialer tracking, and funding
const fundingCSV = [
  'branch_code,account_no,cif,customer_name,mobile,last_known_balance,scheme',
  '0174,01740100001001,CIF1001,M Shanmugam,9842101001,15,SB',
  '0174,01740100001002,CIF1002,K Murugan,9842101002,0,SB',
  '0175,01750100002001,CIF2001,V Meenakshi,9842102001,100,SB',
].join('\n');
const parsedFunding = model.validateFundingAccounts(model.parseFundingCSV(fundingCSV), branches);
assert.equal(parsedFunding.length, 3);
assert.equal(parsedFunding[0].sol, '0174');
assert.equal(parsedFunding[0].last_known_balance, 15);
assert.equal(parsedFunding[0].mobile, '919842101001');
count += 4;

// Admin uploads funding accounts
assert.equal((await portalPost(date, { action: 'upload-funding', rows: parsedFunding })).status, 200);
count++;

// Branch head sees only their branch accounts
const bm0174Funding = await portalGet(date, 'branch3');
assert.equal(bm0174Funding.body.fundingAccounts.length, 2);
assert.ok(bm0174Funding.body.fundingAccounts.every((a) => a.sol === '0174'));
count += 2;

// Admin sees all accounts across branches
const adminFunding = await portalGet(date, 'owner');
assert.equal(adminFunding.body.fundingAccounts.length, 3);
count++;

// Branch head updates call status and marks funded
const targetAcc = bm0174Funding.body.fundingAccounts[0];
assert.equal(
  (
    await portalPost(
      date,
      {
        action: 'funding-status',
        sol: '0174',
        id: targetAcc.id,
        funded: true,
        funded_amount: 1000,
        call_status: 'called',
        notes: 'Called customer, deposited Rs 1000 at cash counter',
      },
      'branch3'
    )
  ).status,
  200
);
count++;

const updatedFundingView = await portalGet(date, 'branch3');
const fundedAcc = updatedFundingView.body.fundingAccounts.find((a) => a.id === targetAcc.id);
assert.equal(fundedAcc.funded, true);
assert.equal(fundedAcc.funded_amount, 1000);
assert.equal(fundedAcc.call_status, 'called');
assert.equal(fundedAcc.notes, 'Called customer, deposited Rs 1000 at cash counter');
assert.ok(fundedAcc.funded_by);
assert.ok(fundedAcc.funded_at);
count += 6;

// 16. Login Activity: tracking who logged in for the day
const adminLoginsView = await portalGet(date, 'owner');
assert.ok(Array.isArray(adminLoginsView.body.logins), 'logins array should be returned');
assert.ok(adminLoginsView.body.logins.length > 0, 'active logins should be recorded');
const bmLogin = adminLoginsView.body.logins.find((l) => l.sol === '0174');
assert.ok(bmLogin, 'Branch 0174 login should be recorded');
assert.equal(bmLogin.role, 'branch');
assert.ok(bmLogin.lastActive, 'lastActive timestamp must exist');
count += 5;

// 17. Updating branch snapshot directly or via partial CSV (e.g. SOL 2287 CD growth -.65)
assert.equal(model.number('-.65', 'test', false, true), -0.65);
assert.equal(model.number('–.65', 'test', false, true), -0.65);
assert.equal(model.number('—.65', 'test', false, true), -0.65);
assert.equal(model.number('−.65', 'test', false, true), -0.65);
count += 4;

const patchRes = await portalPost(
  date,
  {
    action: 'update-branch-snapshot',
    sol: '2287',
    values: { cd_growth: '-.65' },
    reason: 'Correction of Andipatti CD growth to -.65',
  },
  'owner'
);
assert.equal(patchRes.status, 200);
const afterPatchView = await portalGet(date, 'owner');
const patchedRow = afterPatchView.body.pub.rows.find((r) => r.sol === '2287');
assert.equal(patchedRow.cd_growth, -0.65);
count += 2;

// 18. Reviewer name attribution and custom reviewer name in review action
const portalCore = await import('./.portal-core.mjs');
assert.equal(portalCore.formatReviewerAttribution('Reviewer', ''), 'Regional Reviewer');
assert.equal(portalCore.formatReviewerAttribution('Reviewer ()', ''), 'Regional Reviewer');
assert.equal(portalCore.formatReviewerAttribution('Regional Reviewer', ''), 'Regional Reviewer');
assert.equal(portalCore.formatReviewerAttribution('S. Pandian', 'Regional Reviewer'), 'S. Pandian (Regional Reviewer)');
assert.equal(portalCore.formatReviewerAttribution('S. Pandian', ''), 'S. Pandian');
count += 5;

const curSub = (await portalGet(date, 'owner')).body.subs.find((s) => s.sol === '0174');
const customReviewRes = await portalPost(
  date,
  {
    action: 'review',
    sol: '0174',
    revision: curSub.revision,
    text: 'Great performance today, maintain deposit acceleration.',
    reviewerName: 'S. Pandian',
    reviewerRole: 'Regional Reviewer',
  },
  'owner'
);
assert.equal(customReviewRes.status, 200);
const afterCustomRevView = await portalGet(date, 'owner');
const rev0174 = afterCustomRevView.body.reviews.find((r) => r.sol === '0174' && r.text.includes('maintain deposit acceleration'));
assert.ok(rev0174, 'Review with custom reviewer name should exist');
assert.equal(rev0174.reviewerName, 'S. Pandian');
assert.equal(rev0174.by, 'S. Pandian');
count += 4;

await unlink('tests/.portal-core.mjs');
console.log(count + ' Firebase portal checks passed: __session cookie, Mobile+PIN auth, admin bootstrap, Firestore store contract, rate-limit lockout, reset, sanctions, SRM direction, and revocation.');
