import { Award, CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import type { BadgeAssignment, CheckInStatus } from '../types.ts';

export function StatusIndicator({ status }: { status: CheckInStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Approved</span>
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Declined</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Pending Review</span>
    </span>
  );
}

export function BadgeCredentials({
  badges,
  status,
}: {
  badges: BadgeAssignment;
  status: CheckInStatus;
}) {
  if (status !== 'approved') {
    return (
      <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        {status === 'declined'
          ? 'No badges issued. This check-in was declined by the administrator.'
          : 'Driver Badge and Shop Steward Badge assignments are pending administrator verification.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        className={`rounded-lg border p-3.5 transition-colors ${
          badges.driverBadge
            ? 'border-blue-700/25 bg-blue-50/70'
            : 'border-slate-200 bg-slate-50/70 opacity-65'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                badges.driverBadge
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Driver Badge</div>
              <div className="text-xs text-slate-500">
                {badges.driverBadge ? 'Verified & Active' : 'Not Assigned'}
              </div>
            </div>
          </div>
        </div>
        {badges.driverBadge && badges.driverBadgeNumber && (
          <div className="mt-3 pt-2.5 border-t border-blue-200/70 flex items-center justify-between text-xs">
            <span className="text-slate-500">Credential ID</span>
            <span className="font-mono font-semibold text-blue-900 tabular-nums">
              {badges.driverBadgeNumber}
            </span>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg border p-3.5 transition-colors ${
          badges.shopStewardBadge
            ? 'border-emerald-700/25 bg-emerald-50/70'
            : 'border-slate-200 bg-slate-50/70 opacity-65'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                badges.shopStewardBadge
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              <Award className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Shop Steward Badge</div>
              <div className="text-xs text-slate-500">
                {badges.shopStewardBadge ? 'Verified & Active' : 'Not Assigned'}
              </div>
            </div>
          </div>
        </div>
        {badges.shopStewardBadge && badges.shopStewardBadgeNumber && (
          <div className="mt-3 pt-2.5 border-t border-emerald-200/70 flex items-center justify-between text-xs">
            <span className="text-slate-500">Credential ID</span>
            <span className="font-mono font-semibold text-emerald-900 tabular-nums">
              {badges.shopStewardBadgeNumber}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
