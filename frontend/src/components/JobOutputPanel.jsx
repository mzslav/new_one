import { useState } from 'react';
import { api } from '../api/client.js';
import StatusBadge from './StatusBadge.jsx';

export default function JobOutputPanel({ job, onClose }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  if (!job) {
    return (
      <div className="glass-panel h-full min-h-[320px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-4 text-white/25">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-white/50">Select a job to see details and output</p>
      </div>
    );
  }

  const outputId = job.outputFileId;
  const outputName = job.outputFileName || `${job.actionType.toLowerCase()}-output.txt`;
  const canAccessOutput = job.status === 'Completed' && outputId;

  async function handleView() {
    setError('');
    setBusy('view');
    try {
      await api.viewMediaFile(outputId, outputName);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setError('');
    setBusy('download');
    try {
      await api.downloadMediaFile(outputId, outputName);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass-panel h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
        <h3 className="text-sm font-semibold text-white/90">Job details</h3>
        <button type="button" onClick={onClose} className="btn-ghost p-1.5 text-xs" aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        <div>
          <p className="label mb-1">Action</p>
          <p className="text-white font-medium">{job.actionType}</p>
        </div>
        <div>
          <p className="label mb-1">Status</p>
          <StatusBadge status={job.status} />
        </div>
        <div>
          <p className="label mb-1">Created</p>
          <p className="text-sm text-white/60">{new Date(job.createdAt).toLocaleString()}</p>
        </div>

        {canAccessOutput ? (
          <div className="pt-2 border-t border-white/[0.08] space-y-3">
            <p className="label">Processed output</p>
            <p className="text-xs text-white/45 break-all font-mono bg-white/[0.04] px-3 py-2 rounded-lg">
              {outputName}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary w-full text-sm"
                onClick={handleView}
                disabled={!!busy}
              >
                {busy === 'view' ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View output
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-secondary w-full text-sm"
                onClick={handleDownload}
                disabled={!!busy}
              >
                {busy === 'download' ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M12 3v12m0 0l4-4m-4 4L8 11M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download
                  </>
                )}
              </button>
            </div>
          </div>
        ) : job.status === 'Pending' ? (
          <p className="text-xs text-mac-orange/80 pt-2 border-t border-white/[0.08]">
            Output will be available when processing completes (~10s).
          </p>
        ) : job.status === 'Failed' ? (
          <p className="text-xs text-mac-red pt-2 border-t border-white/[0.08]">
            Processing failed. Try uploading again.
          </p>
        ) : null}

        {error && (
          <p className="text-xs text-mac-red">{error}</p>
        )}
      </div>
    </div>
  );
}
