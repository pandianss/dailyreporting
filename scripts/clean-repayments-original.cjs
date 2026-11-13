const fs = require('fs');
const path = require('path');

const config = JSON.parse(
  fs.readFileSync(path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'), 'utf8')
);
const tokens = config.tokens;

async function getAccessToken() {
  let accessToken = tokens.access_token;
  if (!accessToken || (tokens.expires_at && Date.now() > tokens.expires_at)) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho85t8e.apps.googleusercontent.com',
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });
    const d = await res.json();
    accessToken = d.access_token;
  }
  return accessToken;
}

async function cleanData() {
  const token = await getAccessToken();
  const listUrl = 'https://firestore.googleapis.com/v1/projects/dailyreport-9265a/databases/(default)/documents/records?pageSize=500';
  const res = await fetch(listUrl, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const data = await res.json();
  const docs = data.documents || [];
  const repays = docs.filter(d => d.name.includes('repay:'));

  console.log(`Found ${repays.length} repay records in Firestore.`);

  let deleted = 0;
  let cleaned = 0;

  for (const doc of repays) {
    const docId = doc.name.split('/').pop();
    let val = {};
    try {
      val = JSON.parse(doc.fields?.value?.stringValue || '{}');
    } catch {
      continue;
    }

    // 1. Delete the 2 fake injected test records
    if (
      docId === 'repay:0174:0174_01740100001234_2026-11-13' ||
      docId === 'repay:0174:0174_01740100003465_2026-11-13' ||
      docId.includes('0174010000') ||
      docId.includes('0174020000')
    ) {
      console.log(`Deleting fake added doc: ${docId}`);
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      deleted++;
      continue;
    }

    // 2. Remove dummy generated fields (dummy account_no, dummy balance, dummy mobile)
    let changed = false;
    if (val.account_no && (val.account_no.includes('020000') || val.account_no.includes('010000'))) {
      delete val.account_no;
      changed = true;
    }
    if (val.balance !== null && val.balance !== undefined) {
      // Original uploaded CSV did not have balance
      delete val.balance;
      changed = true;
    }
    if (val.mobile && val.mobile.startsWith('919')) {
      // Remove synthesized mobile numbers
      delete val.mobile;
      changed = true;
    }

    if (changed) {
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            value: { stringValue: JSON.stringify(val) },
          },
        }),
      });
      cleaned++;
    }
  }

  console.log(`Finished: Deleted ${deleted} fake records, cleaned ${cleaned} records.`);
}

cleanData().catch(console.error);
