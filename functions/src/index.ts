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
  const result = await handlePortalGet(store, getConfig(), branches, model, {
    cookieHeader: req.get('cookie') || '',
    queryDate,
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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err?.status || 400).json({ error: err?.message || 'Invalid request' });
});

export const api = onRequest(
  {
    region: 'asia-south1',
    maxInstances: 10,
  },
  app
);
