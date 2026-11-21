import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  getEnvAdminPasscode,
  hashPasscode,
  issueAdminToken,
  requireAdmin,
  verifyPasscodeHash,
  verifyPlainPasscode,
} from './src/server/auth.ts';
import type { AdminRequest } from './src/server/auth.ts';
import {
  addCompany,
  claimAdminPasscodeHash,
  createCheckIn,
  getActiveCompanies,
  getAdminPasscodeHash,
  listAllCheckIns,
  lookupCheckInByCode,
  verifyCheckIn,
} from './src/server/store.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const MAX_SELFIE_LENGTH = 900_000;
const ALLOWED_SELFIE_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function sanitizeName(value: unknown, fieldLabel: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldLabel} is required.`);
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw new Error(`${fieldLabel} must be between 1 and 60 characters.`);
  }
  return trimmed;
}

async function startServer(): Promise<void> {
  const app = express();

  app.use(express.json({ limit: '1.5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/companies', async (_req, res) => {
    try {
      const companies = await getActiveCompanies();
      res.json({ companies });
    } catch (error) {
      console.error('Failed to load companies:', error);
      res.status(500).json({ error: 'Unable to load companies.' });
    }
  });

  app.post('/api/checkins', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const firstName = sanitizeName(body?.firstName, 'First name');
      const lastName = sanitizeName(body?.lastName, 'Last name');
      const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : '';
      const selfieDataUrl =
        typeof body?.selfieDataUrl === 'string' ? body.selfieDataUrl.trim() : '';

      if (!companyId) {
        res.status(400).json({ error: 'Please select the company you are applying for.' });
        return;
      }

      if (!selfieDataUrl || !ALLOWED_SELFIE_RE.test(selfieDataUrl)) {
        res.status(400).json({
          error: 'A valid verification selfie photo (JPEG, PNG, or WebP) is required.',
        });
        return;
      }

      if (selfieDataUrl.length > MAX_SELFIE_LENGTH) {
        res.status(400).json({
          error: 'Selfie image is too large. Please retake or choose a smaller photo.',
        });
        return;
      }

      const created = await createCheckIn({
        firstName,
        lastName,
        companyId,
        selfieDataUrl,
      });

      res.status(201).json({ checkIn: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit check-in.';
      const status =
        message.includes('required') ||
        message.includes('characters') ||
        message.includes('company')
          ? 400
          : 500;
      if (status === 500) {
        console.error('Check-in creation failed:', error);
      }
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/checkins/lookup', async (req, res) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
      if (!code || code.length < 4 || code.length > 32) {
        res.status(400).json({ error: 'Enter a valid check-in reference code.' });
        return;
      }

      const found = await lookupCheckInByCode(code);
      if (!found) {
        res.status(404).json({ error: 'No driver check-in found for that reference code.' });
        return;
      }

      res.json({ checkIn: found });
    } catch (error) {
      console.error('Lookup failed:', error);
      res.status(500).json({ error: 'Unable to look up check-in status.' });
    }
  });

  app.get('/api/admin/auth/status', async (_req, res) => {
    try {
      const envPasscode = getEnvAdminPasscode();
      if (envPasscode) {
        res.json({ configured: true, mode: 'env' });
        return;
      }
      const storedHash = await getAdminPasscodeHash();
      if (storedHash) {
        res.json({ configured: true, mode: 'claimed' });
        return;
      }
      res.json({ configured: false, mode: 'unclaimed' });
    } catch (error) {
      console.error('Admin auth status failed:', error);
      res.status(500).json({ error: 'Unable to verify administrator configuration.' });
    }
  });

  app.post('/api/admin/auth/claim', async (req, res) => {
    try {
      const envPasscode = getEnvAdminPasscode();
      if (envPasscode) {
        res.status(409).json({
          error: 'Administrator passcode is already configured via environment secrets.',
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
      if (passcode.trim().length < 8 || passcode.length > 128) {
        res.status(400).json({
          error: 'Passcode must be at least 8 characters long.',
        });
        return;
      }

      const hashed = hashPasscode(passcode);
      const claimed = await claimAdminPasscodeHash(hashed);
      if (!claimed) {
        res.status(409).json({
          error: 'Administrator passcode has already been claimed. Please sign in instead.',
        });
        return;
      }

      const session = issueAdminToken();
      res.status(201).json(session);
    } catch (error) {
      console.error('Admin claim failed:', error);
      res.status(500).json({ error: 'Unable to set administrator passcode.' });
    }
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
      if (!passcode) {
        res.status(400).json({ error: 'Enter the administrator passcode.' });
        return;
      }

      const envPasscode = getEnvAdminPasscode();
      let valid = false;

      if (envPasscode) {
        valid = verifyPlainPasscode(passcode, envPasscode);
      } else {
        const storedHash = await getAdminPasscodeHash();
        if (!storedHash) {
          res.status(409).json({
            error: 'No administrator passcode is set yet. Claim the administrator account first.',
          });
          return;
        }
        valid = verifyPasscodeHash(passcode, storedHash);
      }

      if (!valid) {
        res.status(401).json({ error: 'Invalid administrator passcode.' });
        return;
      }

      const session = issueAdminToken();
      res.json(session);
    } catch (error) {
      console.error('Admin login failed:', error);
      res.status(500).json({ error: 'Unable to sign in.' });
    }
  });

  app.get('/api/admin/checkins', requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const data = await listAllCheckIns();
      res.json(data);
    } catch (error) {
      console.error('Failed to list check-ins:', error);
      res.status(500).json({ error: 'Unable to load driver check-ins.' });
    }
  });

  app.patch('/api/admin/checkins/:id/verify', requireAdmin, async (req: AdminRequest, res) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      if (!id) {
        res.status(400).json({ error: 'Invalid check-in identifier.' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const decision = body?.decision;
      if (decision !== 'approved' && decision !== 'declined') {
        res.status(400).json({ error: 'Decision must be approved or declined.' });
        return;
      }

      const driverBadge = Boolean(body?.driverBadge);
      const shopStewardBadge = Boolean(body?.shopStewardBadge);
      const rawNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : '';
      const reviewNote = rawNote.length > 0 ? rawNote.slice(0, 300) : null;

      if (decision === 'approved' && !driverBadge && !shopStewardBadge) {
        res.status(400).json({
          error: 'Assign at least one badge (Driver Badge or Shop Steward Badge) when approving.',
        });
        return;
      }

      const updated = await verifyCheckIn(id, {
        decision,
        driverBadge,
        shopStewardBadge,
        reviewNote,
      });

      if (!updated) {
        res.status(404).json({ error: 'Driver check-in not found.' });
        return;
      }

      res.json({ checkIn: updated });
    } catch (error) {
      console.error('Verification failed:', error);
      res.status(500).json({ error: 'Unable to save verification decision.' });
    }
  });

  app.post('/api/admin/companies', requireAdmin, async (req: AdminRequest, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = sanitizeName(body?.name, 'Company name');
      const company = await addCompany(name);
      res.status(201).json({ company });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add company.';
      const status =
        message.includes('required') ||
        message.includes('characters') ||
        message.includes('exists')
          ? 400
          : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DriverGate server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
