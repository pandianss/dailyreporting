import { FieldPath, Firestore } from 'firebase-admin/firestore';
import type { Store } from './shared/portal-core.js';

export class FirestoreStore implements Store {
  constructor(private db: Firestore) {}

  private recordRef(key: string) {
    return this.db.collection('records').doc(key);
  }

  private limitRef(key: string) {
    return this.db.collection('auth_limits').doc(key);
  }

  async get(key: string): Promise<any | null> {
    const snap = await this.recordRef(key).get();
    if (!snap.exists) return null;
    const raw = snap.data()?.value;
    return typeof raw === 'string' ? JSON.parse(raw) : raw ?? null;
  }

  async put(key: string, value: any): Promise<void> {
    await this.recordRef(key).set({ value: JSON.stringify(value) });
  }

  async del(key: string): Promise<void> {
    await this.recordRef(key).delete();
  }

  async list(prefix: string): Promise<Array<{ key: string; [k: string]: any }>> {
    const snap = await this.db
      .collection('records')
      .where(FieldPath.documentId(), '>=', prefix)
      .where(FieldPath.documentId(), '<', prefix + '\uf8ff')
      .get();
    return snap.docs.map((d) => {
      const raw = d.data()?.value;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { key: d.id, ...parsed };
    });
  }

  async putIfAbsent(key: string, value: any): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.recordRef(key);
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, { value: JSON.stringify(value) });
      return true;
    });
  }

  async compareAndSet(key: string, expected: any, next: any): Promise<boolean> {
    const expectedJson = JSON.stringify(expected);
    return this.db.runTransaction(async (tx) => {
      const ref = this.recordRef(key);
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const currentRaw = snap.data()?.value;
      const currentJson = typeof currentRaw === 'string' ? currentRaw : JSON.stringify(currentRaw);
      if (currentJson !== expectedJson) return false;
      tx.set(ref, { value: JSON.stringify(next) });
      return true;
    });
  }

  async batch(
    ops: Array<
      | { type: 'put'; key: string; value: any }
      | { type: 'del'; key: string }
      | { type: 'putIfAbsent'; key: string; value: any }
      | { type: 'clearLimit'; key: string }
    >
  ): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const absentChecks = new Map<string, boolean>();
      for (const op of ops) {
        if (op.type === 'putIfAbsent') {
          const snap = await tx.get(this.recordRef(op.key));
          absentChecks.set(op.key, snap.exists);
        }
      }
      for (const op of ops) {
        if (op.type === 'put') {
          tx.set(this.recordRef(op.key), { value: JSON.stringify(op.value) });
        } else if (op.type === 'del') {
          tx.delete(this.recordRef(op.key));
        } else if (op.type === 'putIfAbsent') {
          if (!absentChecks.get(op.key)) {
            tx.set(this.recordRef(op.key), { value: JSON.stringify(op.value) });
          }
        } else if (op.type === 'clearLimit') {
          tx.delete(this.limitRef(op.key));
        }
      }
    });
  }

  async incrementAuthLimit(key: string, now: number, windowMs: number): Promise<number> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.limitRef(key);
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      let attempts = 1;
      let windowEnd = now + windowMs;
      if (data && typeof data.windowEnd === 'number' && data.windowEnd > now) {
        attempts = Number(data.attempts || 0) + 1;
        windowEnd = data.windowEnd;
      }
      tx.set(ref, { attempts, windowEnd });
      return attempts;
    });
  }

  async clearAuthLimit(key: string): Promise<void> {
    await this.limitRef(key).delete();
  }
}
