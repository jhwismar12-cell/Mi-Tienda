import React, { useState } from 'react';
import { Store, Lock, User, KeyRound, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const LoginScreen: React.FC = () => {
  const { loginUser } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginUser(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Credenciales inválidas o servicio no disponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[var(--ui-chrome)] p-4 select-none">
      <div className="w-full max-w-md bg-[var(--ui-surface)] text-[var(--ui-text)] border border-[var(--ui-border)] rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--ui-brand)] text-white flex items-center justify-center shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ui-text)]">
            Acceso al Punto de Venta
          </h1>
          <p className="text-xs text-[var(--ui-muted)]">
            Ingresa con tu cuenta de administrador o cajero de esta tienda
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[var(--ui-muted)] absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. admin, maria_caja..."
                className="w-full pl-10 pr-3 py-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--ui-muted)] absolute left-3.5 top-3" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Verificando acceso...' : 'Iniciar Sesión'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export const ForcePasswordChangeModal: React.FC = () => {
  const { currentUser, changeMyPassword, logoutUser } = useStore();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!currentUser?.debe_cambiar_clave) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changeMyPassword(currentPwd, newPwd);
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--ui-surface)] text-[var(--ui-text)] border border-[var(--ui-border)] rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--ui-text)]">
              Actualiza la contraseña por defecto
            </h2>
            <p className="text-xs text-[var(--ui-muted)] mt-0.5">
              Por seguridad de tu tienda en línea, define una contraseña propia (mínimo 8 caracteres) antes de continuar.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs md:text-sm">
          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Contraseña actual
            </label>
            <input
              type="password"
              required
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Ej. admin123"
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Nueva contraseña (mín. 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Nueva clave segura"
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Repite la nueva clave"
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={logoutUser}
              className="px-3 py-2 text-xs font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-text)] cursor-pointer"
            >
              Cerrar sesión
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar nueva contraseña'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
