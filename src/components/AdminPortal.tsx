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

  const [statusFilter, setStatusFilter] = useState<"all" | CheckInStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [assignDriverBadge, setAssignDriverBadge] = useState(true);
  const [assignStewardBadge, setAssignStewardBadge] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [showCompaniesPanel, setShowCompaniesPanel] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const loadAuthStatus = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch("/api/admin/auth/status");
      if (!res.ok) {
        throw new Error("Failed to check admin auth status");
      }
      const data = (await res.json()) as AdminAuthStatus;
      setAuthStatus(data);
    } catch {
      setAuthError("Unable to reach server authentication status.");
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
        fetch("/api/admin/checkins", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch("/api/companies"),
      ]);

      if (checkInsRes.status === 401) {
        onSignOut();
        setAuthError("Administrator session expired. Please sign in again.");
        return;
      }

      if (!checkInsRes.ok) {
        throw new Error("Failed to load driver check-ins.");
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
        const firstPending = checkInsData.checkIns.find((c) => c.status === "pending");
        return firstPending?.id ?? checkInsData.checkIns[0]?.id ?? null;
      });
    } catch {
      setDataError("Unable to load check-in queue.");
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
    if (selectedCheckIn.status === "pending") {
      setAssignDriverBadge(true);
      setAssignStewardBadge(false);
      setReviewNote("");
    } else {
      setAssignDriverBadge(selectedCheckIn.badges.driverBadge);
      setAssignStewardBadge(selectedCheckIn.badges.shopStewardBadge);
      setReviewNote(selectedCheckIn.reviewNote ?? "");
    }
    setDecisionMessage(null);
  }, [selectedCheckIn]);

  const filteredCheckIns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checkIns.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
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
      setAuthError("Passcode must be at least 8 characters long.");
      return;
    }
    if (passcode !== confirmPasscode) {
      setAuthError("Passcodes do not match.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !payload.token) {
        setAuthError(payload.error ?? "Unable to claim administrator passcode.");
        await loadAuthStatus();
        return;
      }
      setPasscode("");
      setConfirmPasscode("");
      onAuthenticated(payload.token);
    } catch {
      setAuthError("Network error while setting administrator passcode.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passcode) {
      setAuthError("Enter your administrator passcode.");
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !payload.token) {
        setAuthError(payload.error ?? "Invalid administrator passcode.");
        return;
      }
      setPasscode("");
      onAuthenticated(payload.token);
    } catch {
      setAuthError("Network error while signing in.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // PARTIAL FILE - CONTINUES BELOW WITH SCREENSHOT DATA
  // Missing: handleVerifyDecision, handleAddCompany, and the full render return
  // including selfie review UI, badge toggles, companies panel, and check-in list.
  // To be completed with user-provided screenshot OCR text.

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">
          <Lock className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Partial Rebuild In Progress</h1>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          This is a partial reconstruction of AdminPortal.tsx. The first portion through handleLogin is restored. The remaining section including handleVerifyDecision, handleAddCompany, selfie review, badge assignment toggles, and the companies panel will be added from screenshot data.
        </p>
      </div>
    </div>
  );
}
