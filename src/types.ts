export type CheckInStatus = 'pending' | 'approved' | 'declined';

export type DriverRole = 'driver' | 'supervisor' | 'shop' | 'shopSteward' | 'admin';

export interface Company {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface BadgeAssignment {
  driverBadge: boolean;
  supervisorBadge: boolean;
  shopBadge: boolean;
  shopStewardBadge: boolean;
  driverBadgeNumber: string | null;
  supervisorBadgeNumber: string | null;
  shopBadgeNumber: string | null;
  shopStewardBadgeNumber: string | null;
}

export interface DriverCheckIn {
  id: string;
  checkInCode: string;
  firstName: string;
  lastName: string;
  companyId: string;
  companyName: string;
  selfieDataUrl: string;
  status: CheckInStatus;
  role: DriverRole;
  badges: BadgeAssignment;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface PublicCheckInSummary {
  id: string;
  checkInCode: string;
  firstName: string;
  lastName: string;
  companyId: string;
  companyName: string;
  selfieDataUrl: string;
  status: CheckInStatus;
  role: DriverRole;
  badges: BadgeAssignment;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface AdminAuthStatus {
  configured: boolean;
  mode: 'env' | 'claimed' | 'unclaimed';
}

export interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  declined: number;
  driverBadgesIssued: number;
  supervisorBadgesIssued: number;
  shopBadgesIssued: number;
  stewardBadgesIssued: number;
}
