import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { APP_NAME } from '../brand.js';
import AuthShell, { AuthLink } from '../components/AuthShell.jsx';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await api.register(email, password);
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle={`Join ${APP_NAME}`}
      footer={
        <>
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-mac-red/10 border border-mac-red/25 text-mac-red text-sm animate-fade-in">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 011 1v4a1 1 0 01-2 0V5a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
