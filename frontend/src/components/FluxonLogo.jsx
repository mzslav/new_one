import { APP_NAME } from '../brand.js';

export function FluxonMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="8" width="24" height="16" rx="5" fill="url(#fluxonGrad)" fillOpacity="0.2" stroke="url(#fluxonGrad)" strokeWidth="1.5" />
      <path d="M10 16h5l2-4 2 8 2-4h5" stroke="url(#fluxonGrad)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="fluxonGrad" x1="4" y1="8" x2="28" y2="24">
          <stop stopColor="#0A84FF" />
          <stop offset="1" stopColor="#BF5AF2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function FluxonLogo({ subtitle, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <FluxonMark size={28} />
        <span className="text-sm font-semibold tracking-tight text-white/90">{APP_NAME}</span>
      </div>
    );
  }
  return (
    <div className="mx-auto mb-6 w-16 h-16 rounded-2xl glass-strong flex items-center justify-center shadow-glow animate-fade-in-up">
      <FluxonMark size={36} />
    </div>
  );
}
