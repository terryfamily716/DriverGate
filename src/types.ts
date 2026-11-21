export type CheckInStatus = 'pending' | 'approved' | 'declined';

export interface Company {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface BadgeAssignment {
  driverBadge: boolean;
  shopStewardBadge: boolean;
  driverBadgeNumber: string | null;
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
  stewardBadgesIssued: number;
}
