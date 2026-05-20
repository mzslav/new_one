import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { APP_NAME } from '../brand.js';
import FluxonLogo, { FluxonMark } from '../components/FluxonLogo.jsx';
import JobOutputPanel from '../components/JobOutputPanel.jsx';
import MacBackground from '../components/MacBackground.jsx';
import NotificationsBell from '../components/NotificationsBell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import UploadModal from '../components/UploadModal.jsx';

function StatCard({ label, value, accent, delay }) {
  return (
    <div className={`stat-card animate-fade-in-up stagger-${delay}`}>
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-semibold mt-1 tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up">
      <div className="w-20 h-20 rounded-3xl glass-strong flex items-center justify-center mb-5 shadow-glow">
        <FluxonMark size={40} />
      </div>
      <h3 className="text-lg font-semibold text-white/90">No jobs yet</h3>
      <p className="text-sm text-white/40 mt-1.5 max-w-xs">
        Upload a media file to start your first AI processing job
      </p>
      <button className="btn-primary mt-6" onClick={onUpload}>
        Upload media
      </button>
    </div>
  );
}

function JobRowActions({ job, onSelect }) {
  const ready = job.status === 'Completed' && job.outputFileId;
  const outputName = job.outputFileName || `${job.actionType.toLowerCase()}-output.txt`;

  if (!ready) {
    return <span className="text-xs text-white/25">—</span>;
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn-ghost p-2 text-xs"
        title="Download output .txt"
        onClick={() => api.downloadMediaFile(job.outputFileId, outputName)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M12 3v12m0 0l4-4m-4 4L8 11M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="btn-ghost p-2 text-xs text-mac-blue" onClick={() => onSelect(job)}>
        Details
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'Pending').length,
    completed: jobs.filter((j) => j.status === 'Completed').length,
  }), [jobs]);

  const hasPending = stats.pending > 0;

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [j, n] = await Promise.all([api.listJobs(), api.listNotifications()]);
      setJobs(j);
      setNotifications(n);
      setSelectedJob((prev) => (prev ? j.find((x) => x.id === prev.id) || null : null));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hasPending) return undefined;
    const id = setInterval(() => refresh(true), 5000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      refresh(true);
    }
  }, [refresh]);

  const markOneRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await api.markNotificationRead(id);
    } catch {
      refresh(true);
    }
  }, [refresh]);

  return (
    <div className="min-h-screen relative">
      <MacBackground />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0f]/70 backdrop-blur-mac">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <FluxonLogo compact />
          <p className="hidden sm:block text-[11px] text-white/35 -ml-40">{user?.email}</p>

          <div className="flex items-center gap-2">
            {hasPending && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-mac-orange/80 px-3 py-1.5 rounded-full glass animate-pulse-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-mac-orange" />
                Processing…
              </span>
            )}
            <NotificationsBell
              notifications={notifications}
              onMarkAllRead={markAllRead}
              onMarkOneRead={markOneRead}
            />
            <button className="btn-ghost text-xs" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total jobs" value={stats.total} accent="text-white" delay={1} />
          <StatCard label="Processing" value={stats.pending} accent="text-mac-orange" delay={2} />
          <StatCard label="Completed" value={stats.completed} accent="text-mac-green" delay={3} />
        </div>

        <div className="flex items-center justify-between animate-fade-in-up stagger-4">
          <h2 className="text-base font-semibold text-white/80">Your jobs</h2>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs" onClick={() => refresh()} disabled={refreshing}>
              {refreshing ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Refresh'
              )}
            </button>
            <button className="btn-primary text-xs" onClick={() => setShowUpload(true)}>
              Upload
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-panel px-4 py-3 border-mac-red/30 text-mac-red text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 glass-window animate-fade-in-up stagger-5">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs text-white/30 font-medium">Jobs — {APP_NAME}</span>
              {hasPending && (
                <span className="text-[10px] text-white/25 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-mac-orange animate-pulse" />
                  auto-refresh 5s
                </span>
              )}
            </div>

            {loading ? (
              <JobsSkeleton />
            ) : jobs.length === 0 ? (
              <EmptyState onUpload={() => setShowUpload(true)} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/35 uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="px-5 py-3 font-medium">Action</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Created</th>
                      <th className="px-5 py-3 font-medium">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j, i) => (
                      <tr
                        key={j.id}
                        onClick={() => setSelectedJob(j)}
                        className={`mac-table-row cursor-pointer animate-fade-in-up ${
                          selectedJob?.id === j.id ? 'bg-mac-blue/10' : ''
                        }`}
                        style={{ animationDelay: `${0.05 + i * 0.04}s`, opacity: 0 }}
                      >
                        <td className="px-5 py-4 font-medium text-white/85">{j.actionType}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={j.status} />
                        </td>
                        <td className="px-5 py-4 text-white/40 text-xs">
                          {new Date(j.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <JobRowActions job={j} onSelect={setSelectedJob} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 sticky top-20">
            <JobOutputPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
          </div>
        </div>
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={() => {
            setShowUpload(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
