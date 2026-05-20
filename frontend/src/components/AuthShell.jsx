import { Link } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../brand.js';
import MacBackground from './MacBackground.jsx';
import FluxonLogo from './FluxonLogo.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <MacBackground />

      <div className="w-full max-w-md animate-scale-in">
        <div className="glass-window">
          <div className="px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.03] text-center">
            <span className="text-xs text-white/40 font-medium tracking-wide uppercase">
              {APP_NAME}
            </span>
          </div>

          <div className="p-8">
            <FluxonLogo />
            <div className="text-center mb-8 animate-fade-in-up stagger-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="text-sm text-white/45 mt-1.5">{subtitle}</p>
            </div>

            <div className="animate-fade-in-up stagger-2">{children}</div>

            {footer && (
              <div className="mt-6 pt-6 border-t border-white/[0.06] text-center text-sm text-white/40 animate-fade-in-up stagger-3">
                {footer}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-6 animate-fade-in stagger-4">
          {APP_TAGLINE}
        </p>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link
      to={to}
      className="text-mac-blue hover:text-mac-blue-hover transition-colors duration-200 font-medium"
    >
      {children}
    </Link>
  );
}
