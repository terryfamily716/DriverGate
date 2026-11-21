import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Lock, UserCheck } from 'lucide-react';
import type { Company, PublicCheckInSummary } from '../types.ts';
import { BadgeCredentials, StatusIndicator } from './BadgeCredentials.tsx';
import { SelfieCapture } from './SelfieCapture.tsx';

interface DriverCheckInFormProps {
  onSubmittedLookup: (code: string) => void;
}

export function DriverCheckInForm({ onSubmittedLookup }: DriverCheckInFormProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<PublicCheckInSummary | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCompanies() {
      try {
        const res = await fetch('/api/companies');
        if (!res.ok) {
          throw new Error('Failed to load companies');
        }
        const data = (await res.json()) as { companies: Company[] };
        if (!active) return;
        setCompanies(data.companies);
        if (data.companies.length === 1) {
          setCompanyId(data.companies[0].id);
        }
      } catch {
        if (active) {
          setFormError('Unable to load company options. Please refresh and try again.');
        }
      } finally {
        if (active) {
          setLoadingCompanies(false);
        }
      }
    }
    void loadCompanies();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSelfieError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setFormError('First name and last name are both required.');
      return;
    }

    if (!companyId) {
      setFormError('Please select the company you are applying for.');
      return;
    }

    if (!selfieDataUrl) {
      setSelfieError('Please take or upload a verification selfie before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          companyId,
          selfieDataUrl,
        }),
      });
      const payload = (await res.json()) as {
        checkIn?: PublicCheckInSummary;
        error?: string;
      };
      if (!res.ok || !payload.checkIn) {
        setFormError(payload.error ?? 'Unable to submit driver check-in.');
        return;
      }

      setSubmittedRecord(payload.checkIn);
    } catch {
      setFormError('Network error while submitting check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!submittedRecord) return;
    try {
      await navigator.clipboard.writeText(submittedRecord.checkInCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleReset = () => {
    setSubmittedRecord(null);
    setFirstName('');
    setLastName('');
    setSelfieDataUrl(null);
    setFormError(null);
    setSelfieError(null);
    if (companies.length === 1) {
      setCompanyId(companies[0].id);
    }
  };

  if (submittedRecord) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">Check-In Submitted</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {submittedRecord.firstName} {submittedRecord.lastName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Applying for{' '}
                <span className="font-medium text-slate-900">{submittedRecord.companyName}</span>
              </p>
            </div>
            <StatusIndicator status={submittedRecord.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 border-b border-slate-200">
            <div className="md:col-span-5">
              <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={submittedRecord.selfieDataUrl}
                  alt={`${submittedRecord.firstName} ${submittedRecord.lastName} verification selfie`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Submitted{' '}
                <span className="tabular-nums">
                  {new Date(submittedRecord.submittedAt).toLocaleString()}
                </span>
              </p>
            </div>

            <div className="md:col-span-7 flex flex-col justify-between gap-5">
              <div>
                <p className="text-xs font-medium text-slate-500">Your Check-In Reference Code</p>
                <div className="mt-2 flex items-center gap-3">
                  <code className="px-3.5 py-2 rounded-lg bg-slate-100 border border-slate-200 font-mono text-lg font-semibold text-slate-900 tracking-wide tabular-nums">
                    {submittedRecord.checkInCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Save this code to check administrator approval and view your assigned Driver and
                  Shop Steward badges in Pass Lookup.
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Badge Assignments</p>
                <BadgeCredentials
                  badges={submittedRecord.badges}
                  status={submittedRecord.status}
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Submit Another Check-In
            </button>
            <button
              type="button"
              onClick={() => onSubmittedLookup(submittedRecord.checkInCode)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Track Verification Status</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 text-balance">
          Driver Profile Check-In
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Complete your profile and capture a live selfie. An administrator must review your photo
          before assigning your Driver Badge and Shop Steward Badge.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="driver-first-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="driver-first-name"
                  type="text"
                  required
                  maxLength={60}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="driver-last-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Last Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="driver-last-name"
                  type="text"
                  required
                  maxLength={60}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label
                  htmlFor="driver-company"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Company Applying For <span className="text-red-600">*</span>
                </label>
                <select
                  id="driver-company"
                  required
                  disabled={loadingCompanies}
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 disabled:bg-slate-50"
                >
                  {loadingCompanies ? (
                    <option value="">Loading companies...</option>
                  ) : (
                    <>
                      {companies.length > 1 && <option value="">Select a company</option>}
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200 space-y-4">
              <div className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Verification and badge assignment (Driver Badge &amp; Shop Steward Badge) are
                  restricted strictly to authorized administrators.
                </span>
              </div>

              {formError && (
                <div
                  className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-800"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || loadingCompanies}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Submitting Check-In...' : 'Submit Profile Check-In'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 lg:pl-8 lg:border-l border-slate-200">
            <SelfieCapture
              value={selfieDataUrl}
              onChange={(dataUrl) => {
                setSelfieDataUrl(dataUrl);
                if (dataUrl) setSelfieError(null);
              }}
              error={selfieError}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
