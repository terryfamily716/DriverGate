import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  AdminAuthStatus,
  AdminStats,
  CheckInStatus,
  Company,
  DriverCheckIn,
} from '../types.ts';
import { StatusIndicator } from './BadgeCredentials.tsx';

interface AdminPortalProps {
  adminToken: string | null;
  onAuthenticated: (token: string) => void;
  onSignOut: () => void;
}

export function AdminPortal({ adminToken, onAuthenticated, onSignOut }: AdminPortalProps) {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [checkIns, setCheckIns] = useState<DriverCheckIn[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total: 0,
    pending: 0,
    approved: 0,
    declined: 0,
    driverBadgesIssued: 0,
    stewardBadgesIssued: 0,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | CheckInStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [assignDriverBadge, setAssignDriverBadge] = useState(true);
  const [assignStewardBadge, setAssignStewardBadge] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showCompaniesPanel, setShowCompaniesPanel] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const loadAuthStatus = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/admin/auth/status');
      if (!res.ok) {
        throw new Error('Failed to check admin auth status');
      }
      const data = (await res.json()) as AdminAuthStatus;
      setAuthStatus(data);
    } catch {
      setAuthError('Unable to reach server authentication status.');
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const fetchAdminData = useCallback(async () => {
    if (!adminToken) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [checkInsRes, companiesRes] = await Promise.all([
        fetch('/api/admin/checkins', {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch('/api/companies'),
      ]);

      if (checkInsRes.status === 401) {
        onSignOut();
        setAuthError('Administrator session expired. Please sign in again.');
        return;
      }

      if (!checkInsRes.ok) {
        throw new Error('Failed to load driver check-ins.');
      }

      const checkInsData = (await checkInsRes.json()) as {
        checkIns: DriverCheckIn[];
        stats: AdminStats;
      };
      setCheckIns(checkInsData.checkIns);
      setStats(checkInsData.stats);

      if (companiesRes.ok) {
        const compData = (await companiesRes.json()) as { companies: Company[] };
        setCompanies(compData.companies);
      }

      setSelectedId((prev) => {
        if (prev && checkInsData.checkIns.some((c) => c.id === prev)) {
          return prev;
        }
        const firstPending = checkInsData.checkIns.find((c) => c.status === 'pending');
        return firstPending?.id ?? checkInsData.checkIns[0]?.id ?? null;
      });
    } catch {
      setDataError('Unable to load check-in queue.');
    } finally {
      setLoadingData(false);
    }
  }, [adminToken, onSignOut]);

  useEffect(() => {
    if (adminToken) {
      void fetchAdminData();
    }
  }, [adminToken, fetchAdminData]);

  const selectedCheckIn = useMemo(
    () => checkIns.find((c) => c.id === selectedId) ?? null,
    [checkIns, selectedId]
  );

  useEffect(() => {
    if (!selectedCheckIn) return;
    if (selectedCheckIn.status === 'pending') {
      setAssignDriverBadge(true);
      setAssignStewardBadge(false);
      setReviewNote('');
    } else {
      setAssignDriverBadge(selectedCheckIn.badges.driverBadge);
      setAssignStewardBadge(selectedCheckIn.badges.shopStewardBadge);
      setReviewNote(selectedCheckIn.reviewNote ?? '');
    }
    setDecisionMessage(null);
  }, [selectedCheckIn]);

  const filteredCheckIns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checkIns.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        item.checkInCode.toLowerCase().includes(q) ||
        item.companyName.toLowerCase().includes(q)
      );
    });
  }, [checkIns, statusFilter, searchQuery]);

  const handleClaimPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (passcode.trim().length < 8) {
      setAuthError('Passcode must be at least 8 characters long.');
      return;
    }
    if (passcode !== confirmPasscode) {
      setAuthError('Passcodes do not match.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !payload.token) {
        setAuthError(payload.error ?? 'Unable to claim administrator passcode.');
        await loadAuthStatus();
        return;
      }
      setPasscode('');
      setConfirmPasscode('');
      onAuthenticated(payload.token);
    } catch {
      setAuthError('Network error while setting administrator passcode.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passcode) {
      setAuthError('Enter your administrator passcode.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !payload.token) {
        setAuthError(payload.error ?? 'Invalid administrator passcode.');
        return;
      }
      setPasscode('');
      onAuthenticated(payload.token);
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleVerifyDecision = async (decision: 'approved' | 'declined') => {
    if (!selectedCheckIn || !adminToken) return;
    setDecisionMessage(null);

    if (decision === 'approved' && !assignDriverBadge && !assignStewardBadge) {
      setDecisionMessage({
        type: 'error',
        text: 'Select at least one badge (Driver Badge or Shop Steward Badge) to approve.',
      });
      return;
    }

    setSavingDecision(true);
    try {
      const res = await fetch(`/api/admin/checkins/${encodeURIComponent(selectedCheckIn.id)}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision,
          driverBadge: decision === 'approved' ? assignDriverBadge : false,
          shopStewardBadge: decision === 'approved' ? assignStewardBadge : false,
          reviewNote: reviewNote.trim() || null,
        }),
      });

      if (res.status === 401) {
        onSignOut();
        return;
      }

      const payload = (await res.json()) as { checkIn?: DriverCheckIn; error?: string };
      if (!res.ok || !payload.checkIn) {
        setDecisionMessage({
          type: 'error',
          text: payload.error ?? 'Unable to save verification decision.',
        });
        return;
      }

      setDecisionMessage({
        type: 'success',
        text:
          decision === 'approved'
            ? 'Check-in approved and badge credentials assigned.'
            : 'Check-in marked as declined.',
      });
      await fetchAdminData();
    } catch {
      setDecisionMessage({
        type: 'error',
        text: 'Network error while saving verification decision.',
      });
    } finally {
      setSavingDecision(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setCompanyError(null);
    const trimmed = newCompanyName.trim();
    if (!trimmed) {
      setCompanyError('Enter a company name.');
      return;
    }

    setAddingCompany(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = (await res.json()) as { company?: Company; error?: string };
      if (!res.ok || !payload.company) {
        setCompanyError(payload.error ?? 'Unable to add company.');
        return;
      }
      setCompanies((prev) => [...prev, payload.company!]);
      setNewCompanyName('');
    } catch {
      setCompanyError('Network error while adding company.');
    } finally {
      setAddingCompany(false);
    }
  };

  if (!adminToken) {
    if (checkingAuth) {
      return (
        <div className="max-w-md mx-auto py-12">
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Checking administrator access...
          </div>
        </div>
      );
    }

    const isUnclaimed = authStatus?.mode === 'unclaimed';

    return (
      <div className="max-w-md mx-auto py-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {isUnclaimed ? 'Set Administrator Passcode' : 'Administrator Sign-In'}
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            {isUnclaimed
              ? 'Create the administrator passcode to unlock selfie verification and Driver / Shop Steward badge assignment.'
              : 'Only verified administrators can review driver selfies and assign Driver or Shop Steward badges.'}
          </p>

          <form
            onSubmit={(e) => void (isUnclaimed ? handleClaimPasscode(e) : handleLogin(e))}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="admin-passcode"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                {isUnclaimed ? 'New Administrator Passcode' : 'Administrator Passcode'}
              </label>
              <input
                id="admin-passcode"
                type="password"
                required
                minLength={isUnclaimed ? 8 : 1}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={isUnclaimed ? 'At least 8 characters' : 'Enter passcode'}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            {isUnclaimed && (
              <div>
                <label
                  htmlFor="admin-passcode-confirm"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Confirm Passcode
                </label>
                <input
                  id="admin-passcode-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Re-enter passcode"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            )}

            {authError && (
              <div
                className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-800"
                role="alert"
              >
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              {authSubmitting
                ? 'Verifying...'
                : isUnclaimed
                  ? 'Save Passcode & Enter Console'
                  : 'Unlock Verification Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Administrator Verification Console
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect driver selfies and assign Driver Badge and Shop Steward Badge credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCompaniesPanel((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showCompaniesPanel
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Companies ({companies.length})</span>
          </button>
          <button
            type="button"
            onClick={() => void fetchAdminData()}
            disabled={loadingData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4-column metric strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Pending Selfie Review</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{stats.pending}</div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Approved Profiles</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {stats.approved}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Driver Badges Issued</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.driverBadgesIssued}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Shop Steward Badges Issued</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.stewardBadgesIssued}
          </div>
        </div>
      </div>

      {showCompaniesPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Approved Application Companies</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Companies listed here appear in the Driver Profile Check-In dropdown.
              </p>
            </div>
            <form onSubmit={(e) => void handleAddCompany(e)} className="flex items-center gap-2">
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Add another company..."
                maxLength={60}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
              <button
                type="submit"
                disabled={addingCompany}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{addingCompany ? 'Adding...' : 'Add Company'}</span>
              </button>
            </form>
          </div>

          {companyError && (
            <p className="mt-3 text-xs font-medium text-red-700" role="alert">
              {companyError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800"
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {dataError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
          {dataError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Queue Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              {(['all', 'pending', 'approved', 'declined'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap capitalize ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or code..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>
          </div>

          {loadingData && checkIns.length === 0 ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredCheckIns.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-800">No driver check-ins to review</p>
              <p className="text-xs text-slate-500 mt-1">
                {checkIns.length === 0
                  ? 'Submitted driver profiles and selfies will appear here for verification.'
                  : 'No records match your current filter or search query.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Driver</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredCheckIns.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {item.firstName} {item.lastName}
                          </div>
                          <div className="text-xs text-slate-500">{item.companyName}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {item.checkInCode}
                        </td>
                        <td className="py-3 px-3">
                          <StatusIndicator status={item.status} />
                          {item.status === 'approved' && (
                            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                              {[
                                item.badges.driverBadge ? 'Driver' : null,
                                item.badges.shopStewardBadge ? 'Shop Steward' : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inspection & Badge Assignment Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          {!selectedCheckIn ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Select a driver check-in from the queue to inspect their selfie and assign badges.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-medium text-slate-700 tabular-nums">
                      {selectedCheckIn.checkInCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedCheckIn.companyName}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    {selectedCheckIn.firstName} {selectedCheckIn.lastName}
                  </h2>
                </div>
                <StatusIndicator status={selectedCheckIn.status} />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>Submitted Verification Selfie</span>
                  <span className="tabular-nums">
                    {new Date(selectedCheckIn.submittedAt).toLocaleString()}
                  </span>
                </div>
                <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                  <img
                    src={selectedCheckIn.selfieDataUrl}
                    alt={`${selectedCheckIn.firstName} ${selectedCheckIn.lastName} selfie`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-700 mb-2.5">
                  Assign Badges (Administrator Only)
                </p>

                <div className="space-y-2.5">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                      assignDriverBadge
                        ? 'border-blue-700 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={assignDriverBadge}
                      onChange={(e) => setAssignDriverBadge(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
                          <span>Driver Badge</span>
                        </span>
                        {selectedCheckIn.badges.driverBadgeNumber && (
                          <span className="font-mono text-xs text-blue-800 tabular-nums">
                            {selectedCheckIn.badges.driverBadgeNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Verified active driver credential for {selectedCheckIn.companyName}.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                      assignStewardBadge
                        ? 'border-emerald-700 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={assignStewardBadge}
                      onChange={(e) => setAssignStewardBadge(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                          <span>Shop Steward Badge</span>
                        </span>
                        {selectedCheckIn.badges.shopStewardBadgeNumber && (
                          <span className="font-mono text-xs text-emerald-800 tabular-nums">
                            {selectedCheckIn.badges.shopStewardBadgeNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Authorized shop steward representation credential.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-review-note"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Administrator Review Note (Optional)
                </label>
                <textarea
                  id="admin-review-note"
                  rows={2}
                  maxLength={300}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional verification note or reason if declined..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              {decisionMessage && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    decisionMessage.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                  role="status"
                >
                  {decisionMessage.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingDecision}
                  onClick={() => void handleVerifyDecision('approved')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {selectedCheckIn.status === 'approved'
                      ? 'Update Badges'
                      : 'Approve & Assign Badges'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={savingDecision}
                  onClick={() => void handleVerifyDecision('declined')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-300 bg-white text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Decline</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
