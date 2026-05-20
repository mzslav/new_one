import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const ACTIONS = [
  { id: 'TRANSCRIBE', label: 'Transcribe', desc: 'Speech to text (.txt)', icon: '🎙' },
  { id: 'TTS', label: 'TTS', desc: 'Text-to-speech script (.txt)', icon: '🔊' },
  { id: 'SUMMARIZE', label: 'Summarize', desc: 'Key points (.txt)', icon: '📝' },
  { id: 'ENHANCE', label: 'Enhance', desc: 'Quality report (.txt)', icon: '✨' },
  { id: 'TRANSLATE', label: 'Translate', desc: 'Translation (.txt)', icon: '🌐' },
];

export default function UploadModal({ onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [actionType, setActionType] = useState(ACTIONS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  function pickFile(f) {
    if (f) setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const { fileId } = await api.uploadFile(file);
      await api.createJob(fileId, actionType);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="glass-window w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.03]">
          <span id="upload-title" className="text-sm font-semibold text-white/80">
            Upload media
          </span>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 text-xs" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Drop zone */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
              ${dragOver ? 'border-mac-blue/60 bg-mac-blue/10 scale-[1.01]' : 'border-white/15 hover:border-white/25 hover:bg-white/[0.03]'}
              ${file ? 'border-mac-green/40 bg-mac-green/5' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              {file ? (
                <>
                  <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center text-2xl mb-3 animate-scale-in">
                    📄
                  </div>
                  <p className="text-sm font-medium text-white/90">{file.name}</p>
                  <p className="text-xs text-white/35 mt-1">
                    {(file.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-3 text-white/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-white/70">Drop file here or click to browse</p>
                  <p className="text-xs text-white/30 mt-1">Audio, video, images, documents</p>
                </>
              )}
            </div>
          </div>

          {/* Action picker — macOS segmented style */}
          <div>
            <label className="label">Processing action</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActionType(a.id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all duration-200
                    ${actionType === a.id
                      ? 'bg-mac-blue/20 border border-mac-blue/40 shadow-[0_0_20px_rgba(10,132,255,0.15)]'
                      : 'glass hover:bg-white/[0.08]'}`}
                >
                  <span className="text-lg">{a.icon}</span>
                  <span>
                    <span className="block text-sm font-medium text-white/90">{a.label}</span>
                    <span className="block text-xs text-white/35 mt-0.5">{a.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-mac-red/10 border border-mac-red/25 text-mac-red text-sm animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !file}>
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                'Upload & Process'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
