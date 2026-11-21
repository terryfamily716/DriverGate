import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AdminStats,
  CheckInStatus,
  Company,
  DriverCheckIn,
} from '../types.ts';

interface StoreData {
  companies: Company[];
  checkIns: DriverCheckIn[];
  adminPasscodeHash: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'ralphs-grocery-company',
    name: 'Ralphs Grocery Company',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

let writeQueue: Promise<void> = Promise.resolve();

function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceKey) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return { url: parsed.origin, serviceKey };
  } catch {
    return null;
  }
}

async function supabaseFetch<T>(
  config: { url: string; serviceKey: string },
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/${endpoint}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

interface SupabaseCompanyRow {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

interface SupabaseCheckInRow {
  id: string;
  check_in_code: string;
  first_name: string;
  last_name: string;
  company_id: string;
  company_name: string;
  selfie_data_url: string;
  status: CheckInStatus;
  driver_badge: boolean;
  shop_steward_badge: boolean;
  driver_badge_number: string | null;
  shop_steward_badge_number: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
}

function mapSupabaseCheckIn(row: SupabaseCheckInRow): DriverCheckIn {
  return {
    id: row.id,
    checkInCode: row.check_in_code,
    firstName: row.first_name,
    lastName: row.last_name,
    companyId: row.company_id,
    companyName: row.company_name,
    selfieDataUrl: row.selfie_data_url,
    status: row.status,
    badges: {
      driverBadge: row.driver_badge,
      shopStewardBadge: row.shop_steward_badge,
      driverBadgeNumber: row.driver_badge_number,
      shopStewardBadgeNumber: row.shop_steward_badge_number,
    },
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
  };
}

async function readLocalStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      companies:
        Array.isArray(parsed.companies) && parsed.companies.length > 0
          ? parsed.companies
          : [...DEFAULT_COMPANIES],
      checkIns: Array.isArray(parsed.checkIns) ? parsed.checkIns : [],
      adminPasscodeHash:
        typeof parsed.adminPasscodeHash === 'string' ? parsed.adminPasscodeHash : null,
    };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      const initial: StoreData = {
        companies: [...DEFAULT_COMPANIES],
        checkIns: [],
        adminPasscodeHash: null,
      };
      await writeLocalStore(initial);
      return initial;
    }
    throw err;
  }
}

async function writeLocalStore(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, DATA_FILE);
}

function enqueueLocalMutation<T>(mutator: (data: StoreData) => Promise<T> | T): Promise<T> {
  const resultPromise = writeQueue.then(async () => {
    const data = await readLocalStore();
    const result = await mutator(data);
    await writeLocalStore(data);
    return result;
  });
  writeQueue = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

function generateCheckInCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let partA = '';
  let partB = '';
  for (let i = 0; i < 4; i++) {
    partA += alphabet[bytes[i] % alphabet.length];
    partB += alphabet[bytes[i + 4] % alphabet.length];
  }
  return `DG-${partA}-${partB}`;
}

function generateBadgeNumber(prefix: 'DRV' | 'STW'): string {
  const num = crypto.randomInt(100000, 999999);
  return `${prefix}-${num}`;
}

export async function getActiveCompanies(): Promise<Company[]> {
  const sb = getSupabaseConfig();
  if (sb) {
    const rows = await supabaseFetch<SupabaseCompanyRow[]>(
      sb,
      'companies?active=eq.true&order=created_at.asc'
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      createdAt: r.created_at,
    }));
  }

  const store = await readLocalStore();
  return store.companies.filter((c) => c.active);
}

export async function addCompany(name: string): Promise<Company> {
  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = slug || `company-${crypto.randomBytes(4).toString('hex')}`;

  const sb = getSupabaseConfig();
  if (sb) {
    const created = await supabaseFetch<SupabaseCompanyRow[]>(sb, 'companies', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id, name: trimmed, active: true }),
    });
    const row = created[0];
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  return enqueueLocalMutation((store) => {
    const duplicate = store.companies.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.id === id
    );
    if (duplicate) {
      throw new Error('Company already exists.');
    }
    const company: Company = {
      id,
      name: trimmed,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.companies.push(company);
    return company;
  });
}

export async function createCheckIn(input: {
  firstName: string;
  lastName: string;
  companyId: string;
  selfieDataUrl: string;
}): Promise<DriverCheckIn> {
  const companies = await getActiveCompanies();
  const company = companies.find((c) => c.id === input.companyId);
  if (!company) {
    throw new Error('Selected company is not available.');
  }

  const record: DriverCheckIn = {
    id: crypto.randomUUID(),
    checkInCode: generateCheckInCode(),
    firstName: input.firstName,
    lastName: input.lastName,
    companyId: company.id,
    companyName: company.name,
    selfieDataUrl: input.selfieDataUrl,
    status: 'pending',
    badges: {
      driverBadge: false,
      shopStewardBadge: false,
      driverBadgeNumber: null,
      shopStewardBadgeNumber: null,
    },
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
  };

  const sb = getSupabaseConfig();
  if (sb) {
    const rows = await supabaseFetch<SupabaseCheckInRow[]>(sb, 'driver_checkins', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: record.id,
        check_in_code: record.checkInCode,
        first_name: record.firstName,
        last_name: record.lastName,
        company_id: record.companyId,
        company_name: record.companyName,
        selfie_data_url: record.selfieDataUrl,
        status: 'pending',
        driver_badge: false,
        shop_steward_badge: false,
        driver_badge_number: null,
        shop_steward_badge_number: null,
        submitted_at: record.submittedAt,
      }),
    });
    return mapSupabaseCheckIn(rows[0]);
  }

  return enqueueLocalMutation((store) => {
    store.checkIns.unshift(record);
    return record;
  });
}

export async function lookupCheckInByCode(code: string): Promise<DriverCheckIn | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const sb = getSupabaseConfig();
  if (sb) {
    const rows = await supabaseFetch<SupabaseCheckInRow[]>(
      sb,
      `driver_checkins?check_in_code=eq.${encodeURIComponent(normalized)}&limit=1`
    );
    return rows[0] ? mapSupabaseCheckIn(rows[0]) : null;
  }

  const store = await readLocalStore();
  return store.checkIns.find((item) => item.checkInCode.toUpperCase() === normalized) ?? null;
}

export async function listAllCheckIns(): Promise<{
  checkIns: DriverCheckIn[];
  stats: AdminStats;
}> {
  let checkIns: DriverCheckIn[];
  const sb = getSupabaseConfig();
  if (sb) {
    const rows = await supabaseFetch<SupabaseCheckInRow[]>(
      sb,
      'driver_checkins?order=submitted_at.desc'
    );
    checkIns = rows.map(mapSupabaseCheckIn);
  } else {
    const store = await readLocalStore();
    checkIns = [...store.checkIns].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  const stats: AdminStats = {
    total: checkIns.length,
    pending: checkIns.filter((c) => c.status === 'pending').length,
    approved: checkIns.filter((c) => c.status === 'approved').length,
    declined: checkIns.filter((c) => c.status === 'declined').length,
    driverBadgesIssued: checkIns.filter((c) => c.status === 'approved' && c.badges.driverBadge)
      .length,
    stewardBadgesIssued: checkIns.filter(
      (c) => c.status === 'approved' && c.badges.shopStewardBadge
    ).length,
  };

  return { checkIns, stats };
}

export async function verifyCheckIn(
  id: string,
  input: {
    decision: 'approved' | 'declined';
    driverBadge: boolean;
    shopStewardBadge: boolean;
    reviewNote: string | null;
  }
): Promise<DriverCheckIn | null> {
  const sb = getSupabaseConfig();
  if (sb) {
    const existingRows = await supabaseFetch<SupabaseCheckInRow[]>(
      sb,
      `driver_checkins?id=eq.${encodeURIComponent(id)}&limit=1`
    );
    const existing = existingRows[0];
    if (!existing) {
      return null;
    }

    const isApproved = input.decision === 'approved';
    const driverBadge = isApproved && input.driverBadge;
    const shopStewardBadge = isApproved && input.shopStewardBadge;

    const updatedRows = await supabaseFetch<SupabaseCheckInRow[]>(
      sb,
      `driver_checkins?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: input.decision,
          driver_badge: driverBadge,
          shop_steward_badge: shopStewardBadge,
          driver_badge_number: driverBadge
            ? existing.driver_badge_number ?? generateBadgeNumber('DRV')
            : null,
          shop_steward_badge_number: shopStewardBadge
            ? existing.shop_steward_badge_number ?? generateBadgeNumber('STW')
            : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'Administrator',
          review_note: input.reviewNote,
        }),
      }
    );
    return updatedRows[0] ? mapSupabaseCheckIn(updatedRows[0]) : null;
  }

  return enqueueLocalMutation((store) => {
    const target = store.checkIns.find((item) => item.id === id);
    if (!target) {
      return null;
    }

    const isApproved = input.decision === 'approved';
    const driverBadge = isApproved && input.driverBadge;
    const shopStewardBadge = isApproved && input.shopStewardBadge;

    target.status = input.decision;
    target.badges = {
      driverBadge,
      shopStewardBadge,
      driverBadgeNumber: driverBadge
        ? target.badges.driverBadgeNumber ?? generateBadgeNumber('DRV')
        : null,
      shopStewardBadgeNumber: shopStewardBadge
        ? target.badges.shopStewardBadgeNumber ?? generateBadgeNumber('STW')
        : null,
    };
    target.reviewedAt = new Date().toISOString();
    target.reviewedBy = 'Administrator';
    target.reviewNote = input.reviewNote;
    return target;
  });
}

export async function getAdminPasscodeHash(): Promise<string | null> {
  const sb = getSupabaseConfig();
  if (sb) {
    const rows = await supabaseFetch<Array<{ id: string; passcode_hash: string | null }>>(
      sb,
      'admin_config?id=eq.primary&limit=1'
    );
    return rows[0]?.passcode_hash ?? null;
  }

  const store = await readLocalStore();
  return store.adminPasscodeHash;
}

export async function claimAdminPasscodeHash(passcodeHash: string): Promise<boolean> {
  const sb = getSupabaseConfig();
  if (sb) {
    const existing = await getAdminPasscodeHash();
    if (existing) {
      return false;
    }
    await supabaseFetch(sb, 'admin_config', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        id: 'primary',
        passcode_hash: passcodeHash,
        updated_at: new Date().toISOString(),
      }),
    });
    return true;
  }

  return enqueueLocalMutation((store) => {
    if (store.adminPasscodeHash) {
      return false;
    }
    store.adminPasscodeHash = passcodeHash;
    return true;
  });
}
