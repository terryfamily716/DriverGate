import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { PublicCheckInSummary } from '../types.ts';
import { BadgeCredentials, StatusIndicator } from './BadgeCredentials.tsx';

interface PassLookupProps {
  initialCode?: string | null;
}

export function PassLookup({ initialCode }: PassLookupProps) {
  const [codeInput, setCodeInput] = useState(initialCode ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<PublicCheckInSummary | null>(null);

  const performLookup = useCallback(async (targetCode: string) => {
    const clean = targetCode.trim();
    if (!clean) {
      setError('Enter your check-in reference code (for example, DG-XXXX-XXXX).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkins/lookup?code=${encodeURIComponent(clean)}`);
      const payload = (await res.json()) as {
        checkIn?: PublicCheckInSummary;
        error?: string;
      };
      if (!res.ok || !payload.checkIn) {
        setRecord(null);
        setError(payload.error ?? 'No check-in found for that reference code.');
        return;
      }
      setRecord(payload.checkIn);
    } catch {
      setError('Unable to check status right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode);
      void performLookup(initialCode);
    }
  }, [initialCode, performLookup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLookup(codeInput);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Driver Pass &amp; Badge Lookup
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Enter your check-in reference code to verify administrator approval and view your assigned
          Driver Badge and Shop Steward Badge credentials.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter reference code (e.g. DG-XXXX-XXXX)"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
        >
          {loading ? 'Checking...' : 'Check Status'}
        </button>
      </form>

      {error && (
        <div
          className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      {record && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-700 tabular-nums">
                  {record.checkInCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{record.companyName}</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {record.firstName} {record.lastName}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <StatusIndicator status={record.status} />
              <button
                type="button"
                onClick={() => void performLookup(record.checkInCode)}
                disabled={loading}
                title="Refresh verification status"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6">
            <div className="md:col-span-5">
              <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={record.selfieDataUrl}
                  alt={`${record.firstName} ${record.lastName} verification selfie`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div>
                  Submitted:{' '}
                  <span className="text-slate-700 tabular-nums">
                    {new Date(record.submittedAt).toLocaleString()}
                  </span>
                </div>
                {record.reviewedAt && (
                  <div>
                    Reviewed:{' '}
                    <span className="text-slate-700 tabular-nums">
                      {new Date(record.reviewedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-2.5">
                  Administrator Badge Credentials
                </h3>
                <BadgeCredentials badges={record.badges} status={record.status} />
              </div>

              {record.reviewNote && (
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50">
                  <div className="text-xs font-medium text-slate-500">Administrator Note</div>
                  <p className="text-sm text-slate-800 mt-1">{record.reviewNote}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
