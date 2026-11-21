import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AdminPortal } from './components/AdminPortal.tsx';
import { DriverCheckInForm } from './components/DriverCheckInForm.tsx';
import { PassLookup } from './components/PassLookup.tsx';

type ActiveTab = 'checkin' | 'lookup' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('checkin');
  const [lookupCode, setLookupCode] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const handleTrackSubmitted = (code: string) => {
    setLookupCode(code);
    setActiveTab('lookup');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('checkin')}
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer font-display"
          >
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <span>DriverGate</span>
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('checkin')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'checkin'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Driver Check-In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'lookup'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pass Lookup
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin Review
            </button>
          </nav>

          <div className="shrink-0">
            {activeTab === 'admin' && adminToken ? (
              <button
                type="button"
                onClick={() => setAdminToken(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Lock Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Admin Portal
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'checkin' && <DriverCheckInForm onSubmittedLookup={handleTrackSubmitted} />}
        {activeTab === 'lookup' && <PassLookup initialCode={lookupCode} />}
        {activeTab === 'admin' && (
          <AdminPortal
            adminToken={adminToken}
            onAuthenticated={(token) => setAdminToken(token)}
            onSignOut={() => setAdminToken(null)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>DriverGate Verification Portal</span>
          <span>Badges are issued solely after administrator selfie review.</span>
        </div>
      </footer>
    </div>
  );
}
