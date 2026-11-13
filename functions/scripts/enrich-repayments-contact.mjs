import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'dailyreport-9265a' });
const db = getFirestore();

// Sample South Indian mobile prefixes for realistic testing
const sampleMobiles = [
  '9842145892', '9443218765', '9894123890', '9789456123', '9500123489',
  '9629451230', '9843678901', '9442567891', '9944123789', '9790123456',
  '9842890123', '9488123456', '9566789012', '9787123456', '9894567812'
];

async function run() {
  const snap = await db.collection('records').where('__name__', '>=', 'repay:').where('__name__', '<', 'repay:\uf8ff').get();
  console.log(`Found ${snap.size} repayment records in Firestore`);
  
  let updated = 0;
  const batch = db.batch();
  let countInBatch = 0;

  for (let i = 0; i < snap.docs.length; i++) {
    const doc = snap.docs[i];
    const data = doc.data();
    let val = {};
    try {
      val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    } catch {
      val = data;
    }

    // Assign realistic mobile number if not present
    if (!val.mobile) {
      const cifNum = parseInt(String(val.cif || '').replace(/\D/g, '') || String(i), 10);
      const chosenMobile = sampleMobiles[cifNum % sampleMobiles.length];
      val.mobile = '91' + chosenMobile;
      batch.update(doc.ref, { value: JSON.stringify(val) });
      countInBatch++;
      updated++;
      if (countInBatch >= 400) {
        await batch.commit();
        countInBatch = 0;
      }
    }
  }

  if (countInBatch > 0) {
    await batch.commit();
  }

  console.log(`Successfully enriched ${updated} repayment records with contact mobile numbers!`);
}

run().catch(console.error);
