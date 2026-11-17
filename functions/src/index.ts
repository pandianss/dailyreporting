import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FirestoreStore } from './firestore-store.js';
import {
  handleAuthGet,
  handleAuthPost,
  handlePortalGet,
  handlePortalPost,
  type Branch,
  type PortalConfig,
} from './shared/portal-core.js';
import * as model from './shared/model.mjs';
import { renderScorecardSvg } from './scorecard-svg.js';
import { renderAnnouncementSvg } from './announcement-svg.js';

initializeApp();
const db = getFirestore();
const store = new FirestoreStore(db);

const here = path.dirname(fileURLToPath(import.meta.url));
const branches: Branch[] = JSON.parse(
  readFileSync(path.join(here, 'shared', 'branches.json'), 'utf8')
);

function getConfig(): PortalConfig {
  return {
    adminMobile: process.env.ADMIN_MOBILE || '',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@iob.local',
    waBridgeUrl: process.env.WA_BRIDGE_URL || '',
    waBridgeToken: process.env.WA_BRIDGE_TOKEN || '',
    waGroupId: process.env.WA_GROUP_ID || '',
  };
}

function getExpectedOrigin(req: express.Request): string {
  const fwdHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = fwdHost || req.get('host') || '';
  const fwdProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = fwdProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const origin = req.get('origin') || '';
  if (
    process.env.FUNCTIONS_EMULATOR === 'true' &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return origin;
  }
  return `${proto}://${host}`;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.use((_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});

app.get('/api/auth', async (req, res) => {
  const result = await handleAuthGet(store, getConfig(), req.get('cookie') || '');
  res.status(result.status).json(result.body);
});

app.post('/api/auth', async (req, res) => {
  const result = await handleAuthPost(store, getConfig(), {
    origin: req.get('origin') || null,
    expectedOrigin: getExpectedOrigin(req),
    cookieHeader: req.get('cookie') || '',
    body: req.body,
  });
  if (result.setCookie) {
    res.set('Set-Cookie', result.setCookie);
  }
  res.status(result.status).json(result.body);
});

app.get('/api/portal', async (req, res) => {
  const queryDate = typeof req.query.date === 'string' ? req.query.date : null;
  const portal = typeof req.query.portal === 'string' ? req.query.portal : null;
  const result = await handlePortalGet(store, getConfig(), branches, model, {
    cookieHeader: req.get('cookie') || '',
    queryDate,
    portal,
  });
  res.status(result.status).json(result.body);
});

app.post('/api/portal', async (req, res) => {
  const result = await handlePortalPost(store, getConfig(), branches, model, {
    origin: req.get('origin') || null,
    expectedOrigin: getExpectedOrigin(req),
    cookieHeader: req.get('cookie') || '',
    body: req.body,
  });
  res.status(result.status).json(result.body);
});

app.get('/api/card', async (req, res) => {
  try {
    const sol = typeof req.query.sol === 'string' ? req.query.sol : '';
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const type = typeof req.query.type === 'string' ? req.query.type : '';

    if (type === 'announcement' || (!sol && date)) {
      const pub = await store.get('pub:' + date);
      const svg = renderAnnouncementSvg({
        date,
        deadline: pub?.deadline || (typeof req.query.deadline === 'string' ? req.query.deadline : '17:00'),
        cutoff: pub?.cutoff || (typeof req.query.cutoff === 'string' ? req.query.cutoff : 'yesterday'),
        baseline: pub?.baseline || (typeof req.query.baseline === 'string' ? req.query.baseline : 'Prior month-end position'),
        fundedDefinition: pub?.fundedDefinition || (typeof req.query.funded === 'string' ? req.query.funded : 'Official definition'),
        version: pub?.version || 1,
        totalBranches: branches.length,
        reason: pub?.reason || undefined,
        expectedOrigin: getExpectedOrigin(req),
      });
      res.set('Content-Type', 'image/svg+xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=120');
      res.send(svg);
      return;
    }

    if (!sol || !date) {
      res.status(400).send('sol and date query parameters required');
      return;
    }
    const branch = branches.find((b: any) => b.sol === sol);
    const sub = await store.get('sub:' + date + ':' + sol);
    const pub = await store.get('pub:' + date);
    const snap = pub?.rows?.find((r: any) => r.sol === sol);
    const reviews = await store.list('review:' + date + ':');
    const review = reviews.filter((r: any) => r.sol === sol).slice(-1)[0] || null;
    const contact = await store.get('contact:' + sol);

    const svg = renderScorecardSvg({ sol, date, branch, sub, snap, review, contact });
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=120');
    res.send(svg);
  } catch (err: any) {
    res.status(500).send('Failed to generate scorecard image: ' + err.message);
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err?.status || 400).json({ error: err?.message || 'Invalid request' });
});

export const api = onRequest(
  {
    region: 'asia-south1',
    maxInstances: 10,
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  app
);
